import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
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

// `AddOn` is a fully independent domain object — global add-ons, not scoped
// to any `Service` (spec §4.1). Structurally near-identical to
// `ServicesService` (Task 1); see that class's comments for the full
// rationale behind the `manager.update()`-not-`save()` shape and the
// pre-check + expression-index uniqueness strategy.
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
          name,
          description: command.description ?? null,
          priceMinorUnits: command.priceMinorUnits,
          active: true,
        });

        this.assertValid(entity);
        await this.assertNameAvailable(manager, name);

        await this.translateUniqueViolation(() => manager.save(entity));

        await this.auditLogger.log({
          actorId: command.actorId,
          action: 'add_on.create',
          entityType: 'add_on',
          entityId: entity.id,
        });

        return entity;
      }),
    );
  }

  // Uses `manager.update()`, not `Object.assign(entity, changes)` +
  // `manager.save(entity)` — same rationale as `ServicesService#updateService`
  // (spec §3): `save()` diffs the in-memory entity against the currently-
  // persisted row and would silently produce a no-op `UPDATE` (no `updatedAt`
  // bump, no distinguishable write) for a caller resubmitting already-current
  // values. `manager.update()` issues a direct, diff-independent `UPDATE`
  // that always sets the given columns.
  updateAddOn(id: string, command: UpdateAddOnCommand): Promise<AddOn> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const entity = await manager.findOneBy(AddOnEntity, { id });
        if (!entity) {
          throw new NotFoundException(`AddOn ${id} not found`);
        }

        const { actorId, ...changes } = command;

        if (changes.name !== undefined) {
          changes.name = changes.name.trim();
          await this.assertNameAvailable(manager, changes.name, id);
        }

        // Validate the resulting state WITHOUT mutating the tracked entity —
        // manager.update() below persists `changes` directly, it never goes
        // through Object.assign on `entity`.
        this.assertValid({ ...entity, ...changes });

        await this.translateUniqueViolation(() =>
          manager.update(
            AddOnEntity,
            { id },
            { ...changes, updatedAt: new Date() },
          ),
        );

        const updated = await manager.findOneByOrFail(AddOnEntity, { id });

        await this.auditLogger.log({
          actorId,
          action: 'add_on.update',
          entityType: 'add_on',
          entityId: updated.id,
        });

        return updated;
      }),
    );
  }

  // Catalog reads are unfiltered (spec §4.1) — no `active` filter, no
  // arguments; the full set, active and inactive alike. No `getAddOn(id)`
  // read method exists (spec §4.5 lists no `addOn(id)` GraphQL query, and no
  // caller in this plan needs a single-`AddOn` read path) — `updateAddOn`'s
  // existence check goes directly through the transaction manager instead.
  listAddOns(): Promise<AddOn[]> {
    return this.addOnRepository.find();
  }

  // Case-insensitive name uniqueness pre-check (spec §3) — the application-
  // layer half of the enforcement; the Postgres expression index
  // (`uq_add_on_name_lower`, added by hand in this module's migration) is
  // the actual authority, and `translateUniqueViolation` below is the
  // race-window fallback for the gap between this check and the write.
  private async assertNameAvailable(
    manager: EntityManager,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const query = manager
      .getRepository(AddOnEntity)
      .createQueryBuilder('a')
      .where('LOWER(a.name) = LOWER(:name)', { name });
    if (excludeId) {
      query.andWhere('a.id != :excludeId', { excludeId });
    }
    const existing = await query.getOne();
    if (existing) {
      throw new ConflictException('Add-on name is already in use');
    }
  }

  // Shared by `createAddOn`/`updateAddOn` — the race-window fallback behind
  // `assertNameAvailable`'s pre-check.
  private async translateUniqueViolation<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if ((error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
        throw new ConflictException('Add-on name is already in use');
      }
      throw error;
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
}
