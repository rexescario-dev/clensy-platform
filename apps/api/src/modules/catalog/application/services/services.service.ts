import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import type { AuditLogger } from '../../../../platform/audit/application/audit-logger.port';
import { runAuditInTransaction } from '../../../../platform/audit/infrastructure/audit-logger.service';
import { Service } from '../../domain/service';
import { ServiceEntity } from '../../infrastructure/persistence/service.entity';
import { CreateServiceCommand } from '../commands/create-service.command';
import { UpdateServiceCommand } from '../commands/update-service.command';

// Postgres unique_violation — see
// https://www.postgresql.org/docs/current/errcodes-appendix.html
// Local constant, matching `CleanersService`/`TeamsService`'s own local
// constant rather than a shared one (spec §3).
const POSTGRES_UNIQUE_VIOLATION = '23505';

const SERVICE_TENANT_NAME_CONSTRAINT = 'uq_service_tenant_name_lower';

@Injectable()
export class ServicesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(ServiceEntity)
    private readonly serviceRepository: Repository<ServiceEntity>,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  createService(command: CreateServiceCommand): Promise<Service> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const name = command.name.trim();

        const entity = manager.create(ServiceEntity, {
          tenantId: command.tenantId,
          active: true,
          description: command.description ?? null,
          durationMinutes: command.durationMinutes,
          name,
        });

        this.assertValid(entity);
        await this.assertNameAvailable(manager, command.tenantId, name);

        await this.translateUniqueViolation(() => manager.save(entity));

        await this.auditLogger.log({
          actorId: command.actorId,
          entityId: entity.id,
          tenantId: command.tenantId,
          action: 'service.create',
          entityType: 'service',
          scope: AdminScope.TENANT,
        });

        return entity;
      }),
    );
  }

  // Reads: `tenantId: null` (no principal tenant scope, RFC §4.5) fails
  // closed WITHOUT issuing a repository query (#84 slice decision 4).
  getService(id: string, tenantId: string | null): Promise<Service | null> {
    if (tenantId === null) {
      return Promise.resolve(null);
    }
    return this.serviceRepository.findOneBy({ id, tenantId });
  }

  // Bulk lookup for Bookings' GraphQL relation-batching loader (Bookings
  // spec §4.5) and Billing's invoice-line name resolution; deliberately not
  // exposed over GraphQL directly. Returns exactly the rows that exist for
  // the given ids — no synthetic entries for missing ones, the caller's
  // loader handles gaps. `tenantId` MUST be in the same `where` as
  // `id: In(ids)` — never fetch by ids then filter in memory (#84 slice
  // decision 6). A foreign id is simply absent.
  getServicesByIds(ids: string[], tenantId: string | null): Promise<Service[]> {
    if (ids.length === 0 || tenantId === null) {
      return Promise.resolve([]);
    }
    return this.serviceRepository.findBy({ id: In(ids), tenantId });
  }

  // Catalog reads are unfiltered (spec §4.1) — no `active` filter; the full
  // set, active and inactive alike, scoped to the caller's tenant.
  listServices(tenantId: string | null): Promise<Service[]> {
    if (tenantId === null) {
      return Promise.resolve([]);
    }
    return this.serviceRepository.find({ where: { tenantId } });
  }

  // Uses `manager.update()`, not `Object.assign(entity, changes)` +
  // `manager.save(entity)` — same rationale as `CleanersService#updateCleaner`
  // (spec §3): `save()` diffs the in-memory entity against the currently-
  // persisted row and would silently produce a no-op `UPDATE` (no `updatedAt`
  // bump, no distinguishable write) for a caller resubmitting already-current
  // values. `manager.update()` issues a direct, diff-independent `UPDATE`
  // that always sets the given columns.
  // Scoped by tenantId, not just id: another tenant's row is
  // indistinguishable from a missing one (RFC §4.5) — NotFoundException
  // either way, never a 403 leaking cross-tenant existence.
  updateService(id: string, command: UpdateServiceCommand): Promise<Service> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const entity = await manager.findOneBy(ServiceEntity, {
          id,
          tenantId: command.tenantId,
        });
        if (!entity) {
          throw new NotFoundException(`Service ${id} not found`);
        }

        // `actorId`/`tenantId` are part of the command (needed for the
        // lookup above / the audit call below) but neither is a `Service`
        // field the caller may write — `tenantId` in particular must never
        // become a de facto writable field (invariant 1). Destructured out
        // rather than merged into `changes`, mirroring
        // `CleanersService.updateCleaner`'s (#83) idiom.
        const { actorId, tenantId, ...changes } = command;

        if (changes.name !== undefined) {
          changes.name = changes.name.trim();
        }

        // Validate the resulting state WITHOUT mutating the tracked entity —
        // manager.update() below persists `changes` directly, it never goes
        // through Object.assign on `entity`.
        this.assertValid({ ...entity, ...changes });

        if (changes.name !== undefined) {
          await this.assertNameAvailable(manager, tenantId, changes.name, id);
        }

        await this.translateUniqueViolation(() =>
          manager.update(
            ServiceEntity,
            { id, tenantId },
            { ...changes, updatedAt: new Date() },
          ),
        );

        const updated = await manager.findOneByOrFail(ServiceEntity, {
          id,
          tenantId,
        });

        await this.auditLogger.log({
          actorId,
          entityId: updated.id,
          tenantId,
          action: 'service.update',
          entityType: 'service',
          scope: AdminScope.TENANT,
        });

        return updated;
      }),
    );
  }

  // Case-insensitive name uniqueness pre-check (spec §3), scoped per tenant
  // (#84 slice decision 2) — the application-layer half of the enforcement;
  // the Postgres unique index (`uq_service_tenant_name_lower`, on
  // `("tenantId", LOWER("name"))`, Task 1's migration) is the actual
  // authority, and `translateUniqueViolation` below is the race-window
  // fallback for the gap between this check and the write.
  private async assertNameAvailable(
    manager: EntityManager,
    tenantId: string,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const query = manager
      .getRepository(ServiceEntity)
      .createQueryBuilder('s')
      .where('LOWER(s.name) = LOWER(:name)', { name })
      .andWhere('s.tenantId = :tenantId', { tenantId });
    if (excludeId) {
      query.andWhere('s.id != :excludeId', { excludeId });
    }
    const existing = await query.getOne();
    if (existing) {
      throw new ConflictException('Service name is already in use');
    }
  }

  private assertValid(
    service: Pick<Service, 'durationMinutes' | 'name'>,
  ): void {
    if (!service.name?.trim()) {
      throw new BadRequestException('name must not be empty');
    }
    if (
      !Number.isInteger(service.durationMinutes) ||
      service.durationMinutes <= 0
    ) {
      throw new BadRequestException(
        'durationMinutes must be a positive integer',
      );
    }
  }

  // Shared by `createService`/`updateService` — the race-window fallback
  // behind `assertNameAvailable`'s pre-check. Constraint-name match
  // (mirroring `CustomersService.translateUniqueViolation`, #82 idiom): an
  // unrelated 23505 is never mislabelled as a name conflict; with no
  // constraint name available, fall back to the code alone.
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
          constraint === SERVICE_TENANT_NAME_CONSTRAINT
        ) {
          throw new ConflictException('Service name is already in use');
        }
      }
      throw error;
    }
  }
}
