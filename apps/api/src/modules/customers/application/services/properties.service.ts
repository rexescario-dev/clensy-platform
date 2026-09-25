import {
  BadRequestException,
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
import { Property } from '../../domain/property';
import { CustomerEntity } from '../../infrastructure/persistence/customer.entity';
import { PropertyEntity } from '../../infrastructure/persistence/property.entity';
import { CreatePropertyCommand } from '../commands/create-property.command';
import { UpdatePropertyCommand } from '../commands/update-property.command';

@Injectable()
export class PropertiesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PropertyEntity)
    private readonly propertyRepository: Repository<PropertyEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customerRepository: Repository<CustomerEntity>,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  // Mirrors `CustomersService.create` exactly (transaction +
  // `runAuditInTransaction`, spec §4.4). The `customerId` existence check
  // (spec §4.7) happens inside the same transaction, before the
  // `PropertyEntity` is built/saved, via the transaction's own `manager` —
  // not the injected `customerRepository`, which is reserved for read-only
  // paths (`listCustomerProperties`). Scoped by `{ id, tenantId }`, not just
  // `id` (spec §4.4, property → customer same tenant): a customer belonging
  // to another tenant is indistinguishable from a missing one —
  // `NotFoundException` either way, never a cross-tenant reference.
  create(command: CreatePropertyCommand): Promise<Property> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const customer = await manager.findOneBy(CustomerEntity, {
          id: command.customerId,
          tenantId: command.tenantId,
        });
        if (!customer) {
          throw new NotFoundException(
            `Customer ${command.customerId} not found`,
          );
        }

        const entity = manager.create(PropertyEntity, {
          customerId: command.customerId,
          tenantId: command.tenantId,
          accessNotes: command.accessNotes ?? null,
          addressLine1: command.addressLine1,
          addressLine2: command.addressLine2 ?? null,
          city: command.city,
          label: command.label,
          postalCode: command.postalCode,
          region: command.region,
        });

        this.assertValid(entity);
        await manager.save(entity);

        await this.auditLogger.log({
          actorId: command.actorId,
          entityId: entity.id,
          tenantId: command.tenantId,
          action: 'property.create',
          entityType: 'property',
          scope: AdminScope.TENANT,
        });

        return entity;
      }),
    );
  }

  // Bulk lookup for Bookings' GraphQL relation-batching loader (Bookings
  // spec §4.5); deliberately not exposed over GraphQL directly. Returns
  // exactly the rows that exist for the given ids — no synthetic entries
  // for missing ones, the caller's loader handles gaps. `tenantId` MUST be
  // in the same `where` as `id: In(ids)` — never fetch by ids then filter in
  // memory, which would leak cross-tenant existence via timing/row content.
  // `tenantId: null` (no principal tenant scope, RFC §4.5 invariant 1) fails
  // closed WITHOUT issuing a repository query.
  getPropertiesByIds(
    ids: string[],
    tenantId: string | null,
  ): Promise<Property[]> {
    if (ids.length === 0 || tenantId === null) {
      return Promise.resolve([]);
    }
    return this.propertyRepository.findBy({ id: In(ids), tenantId });
  }

  // `tenantId: null` (no principal tenant scope, RFC §4.5 invariant 1) fails
  // closed WITHOUT issuing a repository query — never "issue the query and
  // discard the result".
  getProperty(id: string, tenantId: string | null): Promise<Property | null> {
    if (tenantId === null) {
      return Promise.resolve(null);
    }
    return this.propertyRepository.findOneBy({ id, tenantId });
  }

  // Guards a query explicitly scoped to a single customer (spec §4.2):
  // silently returning `[]` for a typo'd/stale `customerId` would be
  // indistinguishable from "this customer genuinely has no properties," so
  // a nonexistent `customerId` is surfaced as `NotFoundException` instead.
  // This is a read path, so it uses the injected `customerRepository`
  // directly rather than opening a transaction. `tenantId: null` fails
  // closed as `NotFoundException` WITHOUT querying either repository — a
  // missing tenant scope is "no such customer" here too, never an empty
  // result set derived from a live query.
  async listCustomerProperties(
    customerId: string,
    tenantId: string | null,
  ): Promise<Property[]> {
    if (tenantId === null) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    const customer = await this.customerRepository.findOneBy({
      id: customerId,
      tenantId,
    });
    if (!customer) {
      throw new NotFoundException(`Customer ${customerId} not found`);
    }

    return this.propertyRepository.findBy({ customerId, tenantId });
  }

  update(id: string, command: UpdatePropertyCommand): Promise<Property> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        // Scoped by tenantId, not just id: another tenant's row is
        // indistinguishable from a missing one (RFC §4.5) — NotFoundException
        // either way, never a 403 leaking cross-tenant existence.
        const entity = await manager.findOneBy(PropertyEntity, {
          id,
          tenantId: command.tenantId,
        });
        if (!entity) {
          throw new NotFoundException(`Property ${id} not found`);
        }

        // Same safety as `CustomersService.update`: `command` is built by
        // the resolver via spread, so it only carries keys the caller
        // actually provided. `actorId` and `tenantId` are destructured out
        // first — both are part of the command (needed for the lookup
        // above / the audit call below) but neither is a `Property` field
        // the caller may write: merging them in would leak a stray
        // `actorId` property onto the returned entity and, worse, make
        // `tenantId` a de facto writable input field (invariant 1 forbids
        // that).
        const { actorId, tenantId, ...fields } = command;
        void actorId; // consumed via `command.actorId` in the audit call below
        void tenantId; // consumed via `command.tenantId` in the lookup above
        Object.assign(entity, fields);

        this.assertValid(entity);
        await manager.save(entity);

        await this.auditLogger.log({
          actorId: command.actorId,
          entityId: entity.id,
          tenantId: command.tenantId,
          action: 'property.update',
          entityType: 'property',
          scope: AdminScope.TENANT,
        });

        return entity;
      }),
    );
  }

  // Application-layer validation (spec §4.7), run on the merged entity
  // state (post `Object.assign` in `update`), not the raw incoming command.
  private assertValid(
    property: Pick<
      Property,
      'addressLine1' | 'city' | 'label' | 'postalCode' | 'region'
    >,
  ): void {
    if (!property.label?.trim()) {
      throw new BadRequestException('label must not be empty');
    }
    if (!property.addressLine1?.trim()) {
      throw new BadRequestException('addressLine1 must not be empty');
    }
    if (!property.city?.trim()) {
      throw new BadRequestException('city must not be empty');
    }
    if (!property.region?.trim()) {
      throw new BadRequestException('region must not be empty');
    }
    if (!property.postalCode?.trim()) {
      throw new BadRequestException('postalCode must not be empty');
    }
  }
}
