import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import type { AuditLogger } from '../../../../platform/audit/application/audit-logger.port';
import { runAuditInTransaction } from '../../../../platform/audit/infrastructure/audit-logger.service';
import { Customer } from '../../domain/customer';
import { CustomerEntity } from '../../infrastructure/persistence/customer.entity';
import { CreateCustomerCommand } from '../commands/create-customer.command';
import { UpdateCustomerCommand } from '../commands/update-customer.command';

// Postgres unique_violation — see
// https://www.postgresql.org/docs/current/errcodes-appendix.html
// Local constant, matching `CleanersService`'s own local constant rather
// than a shared one (spec §3).
const POSTGRES_UNIQUE_VIOLATION = '23505';

const CUSTOMER_TENANT_EMAIL_CONSTRAINT = 'uq_customer_tenant_email';

@Injectable()
export class CustomersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CustomerEntity)
    private readonly customerRepository: Repository<CustomerEntity>,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  // Opens its own transaction and wraps the work in `runAuditInTransaction`
  // (mirroring `AdminsService.create` exactly, spec §4.4/Admin Foundation
  // §4.6's transactional-audit rule): the entity write goes through the
  // transaction's own `manager`, and the `auditLogger.log()` call made
  // inside `fn` automatically detects the ambient transaction and uses that
  // same `manager`, so a persistence failure there rolls back the
  // `CustomerEntity` insert with it.
  create(command: CreateCustomerCommand): Promise<Customer> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const entity = manager.create(CustomerEntity, {
          tenantId: command.tenantId,
          email: command.email,
          fullName: command.fullName,
          notes: command.notes ?? null,
          phone: command.phone,
        });

        this.assertValid(entity);
        await this.translateUniqueViolation(() => manager.save(entity));

        await this.auditLogger.log({
          actorId: command.actorId,
          entityId: entity.id,
          tenantId: command.tenantId,
          action: 'customer.create',
          entityType: 'customer',
          scope: AdminScope.TENANT,
        });

        return entity;
      }),
    );
  }

  // `tenantId: null` (no principal tenant scope, RFC §4.5 invariant 1) fails
  // closed WITHOUT issuing a repository query — never "issue the query and
  // discard the result".
  getCustomer(id: string, tenantId: string | null): Promise<Customer | null> {
    if (tenantId === null) {
      return Promise.resolve(null);
    }
    return this.customerRepository.findOneBy({ id, tenantId });
  }

  // Bulk lookup for Bookings' GraphQL relation-batching loader (Bookings
  // spec §4.5); deliberately not exposed over GraphQL directly. Returns
  // exactly the rows that exist for the given ids — no synthetic entries
  // for missing ones, the caller's loader handles gaps. `tenantId` MUST be
  // in the same `where` as `id: In(ids)` — never fetch by ids then filter in
  // memory, which would leak cross-tenant existence via timing/row content.
  getCustomersByIds(
    ids: string[],
    tenantId: string | null,
  ): Promise<Customer[]> {
    if (ids.length === 0 || tenantId === null) {
      return Promise.resolve([]);
    }
    return this.customerRepository.findBy({ id: In(ids), tenantId });
  }

  listCustomers(tenantId: string | null): Promise<Customer[]> {
    if (tenantId === null) {
      return Promise.resolve([]);
    }
    return this.customerRepository.find({ where: { tenantId } });
  }

  update(id: string, command: UpdateCustomerCommand): Promise<Customer> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        // Scoped by tenantId, not just id: another tenant's row is
        // indistinguishable from a missing one (RFC §4.5) — NotFoundException
        // either way, never a 403 leaking cross-tenant existence.
        const entity = await manager.findOneBy(CustomerEntity, {
          id,
          tenantId: command.tenantId,
        });
        if (!entity) {
          throw new NotFoundException(`Customer ${id} not found`);
        }

        // Safe because `command` is constructed by the resolver via spread
        // (spec §4.2) — it only carries keys the caller actually provided,
        // so an omitted field retains its current value and a provided
        // field (including `notes: null`) is applied. `actorId` and
        // `tenantId` are destructured out first — both are part of the
        // command (needed for the lookup above / the audit call below) but
        // neither is a `Customer` field the caller may write: merging them
        // in would leak a stray `actorId` property onto the returned entity
        // and, worse, make `tenantId` a de facto writable input field
        // (invariant 1 forbids that).
        const { actorId, tenantId, ...fields } = command;
        void actorId; // consumed via `command.actorId` in the audit call below
        void tenantId; // consumed via `command.tenantId` in the lookup above
        Object.assign(entity, fields);

        this.assertValid(entity);
        await this.translateUniqueViolation(() => manager.save(entity));

        await this.auditLogger.log({
          actorId: command.actorId,
          entityId: entity.id,
          tenantId: command.tenantId,
          action: 'customer.update',
          entityType: 'customer',
          scope: AdminScope.TENANT,
        });

        return entity;
      }),
    );
  }

  // Application-layer validation (spec §4.7): the domain invariant for
  // `email` is non-empty only — syntax validation is a presentation-layer
  // concern owned by the GraphQL input types, not this service.
  private assertValid(
    customer: Pick<Customer, 'email' | 'fullName' | 'phone'>,
  ): void {
    if (!customer.fullName?.trim()) {
      throw new BadRequestException('fullName must not be empty');
    }
    if (!customer.email?.trim()) {
      throw new BadRequestException('email must not be empty');
    }
    if (!customer.phone?.trim()) {
      throw new BadRequestException('phone must not be empty');
    }
  }

  // Maps the tenant-scoped email uniqueness constraint (Task 2's
  // `uq_customer_tenant_email`, on `("tenantId", lower(email))`) to a
  // `ConflictException`, mirroring `CleanersService.translateUniqueViolation`.
  // Matches on the constraint name — not just the `23505` error code — so an
  // unrelated unique violation is never mislabelled as an email conflict.
  // Postgres reports a unique *index* violation with the index name as
  // `constraint`; TypeORM's `QueryFailedError` carries it at
  // `driverError.constraint`, falling back to `error.constraint` for a
  // plain/mocked error shape. If neither is present, falls back to matching
  // on `code` alone, same as `CleanersService`.
  private async translateUniqueViolation<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const err = error as {
        code?: string;
        constraint?: string;
        driverError?: { constraint?: string };
      };
      if (err.code === POSTGRES_UNIQUE_VIOLATION) {
        const constraint = err.driverError?.constraint ?? err.constraint;
        if (
          constraint === undefined ||
          constraint === CUSTOMER_TENANT_EMAIL_CONSTRAINT
        ) {
          throw new ConflictException('Email is already in use');
        }
      }
      throw error;
    }
  }
}
