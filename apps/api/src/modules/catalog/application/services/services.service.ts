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
import { Service } from '../../domain/service';
import { ServiceEntity } from '../../infrastructure/persistence/service.entity';
import { CreateServiceCommand } from '../commands/create-service.command';
import { UpdateServiceCommand } from '../commands/update-service.command';

// Postgres unique_violation — see
// https://www.postgresql.org/docs/current/errcodes-appendix.html
// Local constant, matching `CleanersService`/`TeamsService`'s own local
// constant rather than a shared one (spec §3).
const POSTGRES_UNIQUE_VIOLATION = '23505';

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
          name,
          description: command.description ?? null,
          durationMinutes: command.durationMinutes,
          active: true,
        });

        this.assertValid(entity);
        await this.assertNameAvailable(manager, name);

        await this.translateUniqueViolation(() => manager.save(entity));

        await this.auditLogger.log({
          actorId: command.actorId,
          action: 'service.create',
          entityType: 'service',
          entityId: entity.id,
        });

        return entity;
      }),
    );
  }

  // Uses `manager.update()`, not `Object.assign(entity, changes)` +
  // `manager.save(entity)` — same rationale as `CleanersService#updateCleaner`
  // (spec §3): `save()` diffs the in-memory entity against the currently-
  // persisted row and would silently produce a no-op `UPDATE` (no `updatedAt`
  // bump, no distinguishable write) for a caller resubmitting already-current
  // values. `manager.update()` issues a direct, diff-independent `UPDATE`
  // that always sets the given columns.
  updateService(id: string, command: UpdateServiceCommand): Promise<Service> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const entity = await manager.findOneBy(ServiceEntity, { id });
        if (!entity) {
          throw new NotFoundException(`Service ${id} not found`);
        }

        const { actorId, ...changes } = command;

        if (changes.name !== undefined) {
          changes.name = changes.name.trim();
        }

        // Validate the resulting state WITHOUT mutating the tracked entity —
        // manager.update() below persists `changes` directly, it never goes
        // through Object.assign on `entity`.
        this.assertValid({ ...entity, ...changes });

        if (changes.name !== undefined) {
          await this.assertNameAvailable(manager, changes.name, id);
        }

        await this.translateUniqueViolation(() =>
          manager.update(
            ServiceEntity,
            { id },
            { ...changes, updatedAt: new Date() },
          ),
        );

        const updated = await manager.findOneByOrFail(ServiceEntity, { id });

        await this.auditLogger.log({
          actorId,
          action: 'service.update',
          entityType: 'service',
          entityId: updated.id,
        });

        return updated;
      }),
    );
  }

  getService(id: string): Promise<Service | null> {
    return this.serviceRepository.findOneBy({ id });
  }

  // Catalog reads are unfiltered (spec §4.1) — no `active` filter, no
  // arguments; the full set, active and inactive alike.
  listServices(): Promise<Service[]> {
    return this.serviceRepository.find();
  }

  // Case-insensitive name uniqueness pre-check (spec §3) — the application-
  // layer half of the enforcement; the Postgres expression index
  // (`uq_service_name_lower`, added by hand in this module's migration) is
  // the actual authority, and `translateUniqueViolation` below is the
  // race-window fallback for the gap between this check and the write.
  private async assertNameAvailable(
    manager: EntityManager,
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const query = manager
      .getRepository(ServiceEntity)
      .createQueryBuilder('s')
      .where('LOWER(s.name) = LOWER(:name)', { name });
    if (excludeId) {
      query.andWhere('s.id != :excludeId', { excludeId });
    }
    const existing = await query.getOne();
    if (existing) {
      throw new ConflictException('Service name is already in use');
    }
  }

  // Shared by `createService`/`updateService` — the race-window fallback
  // behind `assertNameAvailable`'s pre-check.
  private async translateUniqueViolation<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if ((error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
        throw new ConflictException('Service name is already in use');
      }
      throw error;
    }
  }

  private assertValid(
    service: Pick<Service, 'name' | 'durationMinutes'>,
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
}
