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
import { AddOn } from '../../domain/add-on';
import { AddOnEntity } from '../../infrastructure/persistence/add-on.entity';
import { CreateAddOnCommand } from '../commands/create-add-on.command';
import { UpdateAddOnCommand } from '../commands/update-add-on.command';

// Postgres unique_violation — see
// https://www.postgresql.org/docs/current/errcodes-appendix.html
// Local constant, matching `ServicesService`'s own local constant rather
// than a shared one (spec §3).
const POSTGRES_UNIQUE_VIOLATION = '23505';

const ADD_ON_TENANT_NAME_CONSTRAINT = 'uq_add_on_tenant_name_lower';

// `AddOn` is tenant-owned (RFC §4.4) and not scoped to any `Service`.
// Structurally near-identical to `ServicesService` (Task 1); see that
// class's comments for the full rationale behind the
// `manager.update()`-not-`save()` shape and the pre-check +
// expression-index uniqueness strategy.
@Injectable()
export class AddOnsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(AddOnEntity)
    private readonly addOnRepository: Repository<AddOnEntity>,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  createAddOn(command: CreateAddOnCommand): Promise<AddOn> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const name = command.name.trim();

        const entity = manager.create(AddOnEntity, {
          tenantId: command.tenantId,
          active: true,
          description: command.description ?? null,
          name,
          priceMinorUnits: command.priceMinorUnits,
        });

        this.assertValid(entity);
        await this.assertNameAvailable(manager, command.tenantId, name);

        await this.translateUniqueViolation(() => manager.save(entity));

        await this.auditLogger.log({
          actorId: command.actorId,
          entityId: entity.id,
          tenantId: command.tenantId,
          action: 'add_on.create',
          entityType: 'add_on',
          scope: AdminScope.TENANT,
        });

        return entity;
      }),
    );
  }

  // Bulk lookup, mirroring `ServicesService.getServicesByIds` verbatim.
  // Added for the Billing module (#38): `generateInvoiceFromOrder` resolves
  // each invoice line's frozen `description` from the catalog `AddOn` /
  // `Service` name at generation time (#38 spec §4.1, §4.4). Not exposed
  // over GraphQL directly. Returns exactly the rows that exist for the
  // given ids — no synthetic entries for missing ones. `tenantId` MUST be in
  // the same `where` as `id: In(ids)` — never fetch by ids then filter in
  // memory (#84 slice decision 6). A foreign id is simply absent.
  getAddOnsByIds(ids: string[], tenantId: string | null): Promise<AddOn[]> {
    if (ids.length === 0 || tenantId === null) {
      return Promise.resolve([]);
    }
    return this.addOnRepository.findBy({ id: In(ids), tenantId });
  }

  // Catalog reads are unfiltered (spec §4.1) — no `active` filter; the full
  // set, active and inactive alike, scoped to the caller's tenant. No
  // `getAddOn(id)` single-read exists — `updateAddOn`'s existence check goes
  // directly through the transaction manager instead.
  listAddOns(tenantId: string | null): Promise<AddOn[]> {
    if (tenantId === null) {
      return Promise.resolve([]);
    }
    return this.addOnRepository.find({ where: { tenantId } });
  }

  // Uses `manager.update()`, not `Object.assign(entity, changes)` +
  // `manager.save(entity)` — same rationale as `ServicesService#updateService`
  // (spec §3): `save()` diffs the in-memory entity against the currently-
  // persisted row and would silently produce a no-op `UPDATE` (no `updatedAt`
  // bump, no distinguishable write) for a caller resubmitting already-current
  // values. `manager.update()` issues a direct, diff-independent `UPDATE`
  // that always sets the given columns.
  // Scoped by tenantId, not just id: another tenant's row is
  // indistinguishable from a missing one (RFC §4.5) — NotFoundException
  // either way, never a 403 leaking cross-tenant existence.
  updateAddOn(id: string, command: UpdateAddOnCommand): Promise<AddOn> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const entity = await manager.findOneBy(AddOnEntity, {
          id,
          tenantId: command.tenantId,
        });
        if (!entity) {
          throw new NotFoundException(`AddOn ${id} not found`);
        }

        // `actorId`/`tenantId` are part of the command (needed for the
        // lookup above / the audit call below) but neither is an `AddOn`
        // field the caller may write — `tenantId` in particular must never
        // become a de facto writable field (invariant 1). Destructured out
        // rather than merged into `changes`, mirroring
        // `ServicesService.updateService`'s idiom.
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
            AddOnEntity,
            { id, tenantId },
            { ...changes, updatedAt: new Date() },
          ),
        );

        const updated = await manager.findOneByOrFail(AddOnEntity, {
          id,
          tenantId,
        });

        await this.auditLogger.log({
          actorId,
          entityId: updated.id,
          tenantId,
          action: 'add_on.update',
          entityType: 'add_on',
          scope: AdminScope.TENANT,
        });

        return updated;
      }),
    );
  }

  // Case-insensitive name uniqueness pre-check (spec §3), scoped per tenant
  // (#84 slice decision 2) — the application-layer half of the enforcement;
  // the Postgres unique index (`uq_add_on_tenant_name_lower`, on
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
      .getRepository(AddOnEntity)
      .createQueryBuilder('a')
      .where('LOWER(a.name) = LOWER(:name)', { name })
      .andWhere('a.tenantId = :tenantId', { tenantId });
    if (excludeId) {
      query.andWhere('a.id != :excludeId', { excludeId });
    }
    const existing = await query.getOne();
    if (existing) {
      throw new ConflictException('Add-on name is already in use');
    }
  }

  private assertValid(addOn: Pick<AddOn, 'name' | 'priceMinorUnits'>): void {
    if (!addOn.name?.trim()) {
      throw new BadRequestException('name must not be empty');
    }
    if (
      !Number.isInteger(addOn.priceMinorUnits) ||
      addOn.priceMinorUnits <= 0
    ) {
      throw new BadRequestException(
        'priceMinorUnits must be a positive integer',
      );
    }
  }

  // Shared by `createAddOn`/`updateAddOn` — the race-window fallback behind
  // `assertNameAvailable`'s pre-check. Constraint-name match (mirroring
  // `CustomersService.translateUniqueViolation`, #82 idiom): an unrelated
  // 23505 is never mislabelled as a name conflict; with no constraint name
  // available, fall back to the code alone.
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
          constraint === ADD_ON_TENANT_NAME_CONSTRAINT
        ) {
          throw new ConflictException('Add-on name is already in use');
        }
      }
      throw error;
    }
  }
}
