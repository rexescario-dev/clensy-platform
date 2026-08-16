import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import type { AuditLogger } from '../../../../platform/audit/application/audit-logger.port';
import { runAuditInTransaction } from '../../../../platform/audit/infrastructure/audit-logger.service';
import { Cleaner } from '../../domain/cleaner';
import { CleanerEntity } from '../../infrastructure/persistence/cleaner.entity';
import { TeamEntity } from '../../infrastructure/persistence/team.entity';
import { AssignCleanerToTeamCommand } from '../commands/assign-cleaner-to-team.command';
import { CreateCleanerCommand } from '../commands/create-cleaner.command';
import { UpdateCleanerCommand } from '../commands/update-cleaner.command';

// Postgres unique_violation — see
// https://www.postgresql.org/docs/current/errcodes-appendix.html
// Local constant, matching `TeamsService`'s own local constant rather than a
// shared one (spec §3).
const POSTGRES_UNIQUE_VIOLATION = '23505';

@Injectable()
export class CleanersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(CleanerEntity)
    private readonly cleanerRepository: Repository<CleanerEntity>,
    @InjectRepository(TeamEntity)
    private readonly teamRepository: Repository<TeamEntity>,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  // Mirrors `TeamsService.createTeam` exactly — a fresh INSERT via
  // `manager.create`/`manager.save`, no diffing risk, so plain `save()` is
  // correct here (only the two UPDATE-path methods below need
  // `manager.update()`, see their comments).
  createCleaner(command: CreateCleanerCommand): Promise<Cleaner> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const entity = manager.create(CleanerEntity, {
          fullName: command.fullName,
          phone: command.phone,
          email: command.email,
          notes: command.notes ?? null,
          teamId: null,
        });

        this.assertValid(entity);

        await this.translateUniqueViolation(() => manager.save(entity));

        await this.auditLogger.log({
          actorId: command.actorId,
          action: 'cleaner.create',
          entityType: 'cleaner',
          entityId: entity.id,
        });

        return entity;
      }),
    );
  }

  // Uses `manager.update()`, not `Object.assign(entity, changes)` +
  // `manager.save(entity)`: `save()` diffs the in-memory entity against the
  // currently-persisted row and omits unchanged columns from the generated
  // `UPDATE`, which would silently produce a no-op `UPDATE` (no `updatedAt`
  // bump, no distinguishable write) when a caller resubmits already-current
  // values. Spec §4.2 requires `updatedAt` to advance and an audit event to
  // fire on every successful call, even a same-value one — `manager.update()`
  // issues a direct, diff-independent `UPDATE` that always sets the given
  // columns regardless of whether they actually changed.
  updateCleaner(id: string, command: UpdateCleanerCommand): Promise<Cleaner> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const entity = await manager.findOneBy(CleanerEntity, { id });
        if (!entity) {
          throw new NotFoundException(`Cleaner ${id} not found`);
        }

        const { actorId, ...changes } = command;

        // Validate the resulting state WITHOUT mutating the tracked entity —
        // manager.update() below persists `changes` directly, it never goes
        // through Object.assign on `entity`.
        this.assertValid({ ...entity, ...changes });

        await this.translateUniqueViolation(() =>
          manager.update(
            CleanerEntity,
            { id },
            { ...changes, updatedAt: new Date() },
          ),
        );

        const updated = await manager.findOneByOrFail(CleanerEntity, { id });

        await this.auditLogger.log({
          actorId,
          action: 'cleaner.update',
          entityType: 'cleaner',
          entityId: updated.id,
        });

        return updated;
      }),
    );
  }

  // Same `manager.update()` rationale as `updateCleaner` above: `teamId`
  // could already equal its current value (re-assigning to the same team),
  // and `save()`'s diffing would risk a no-op `UPDATE` in that case, silently
  // violating the requirement that `updatedAt` bump and an audit event fire
  // unconditionally on every successful call.
  assignCleanerToTeam(command: AssignCleanerToTeamCommand): Promise<Cleaner> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const team = await manager.findOneBy(TeamEntity, {
          id: command.teamId,
        });
        if (!team) {
          throw new NotFoundException(`Team ${command.teamId} not found`);
        }

        const cleaner = await manager.findOneBy(CleanerEntity, {
          id: command.cleanerId,
        });
        if (!cleaner) {
          throw new NotFoundException(`Cleaner ${command.cleanerId} not found`);
        }

        await manager.update(
          CleanerEntity,
          { id: command.cleanerId },
          { teamId: command.teamId, updatedAt: new Date() },
        );

        const updated = await manager.findOneByOrFail(CleanerEntity, {
          id: command.cleanerId,
        });

        await this.auditLogger.log({
          actorId: command.actorId,
          action: 'cleaner.assign_team',
          entityType: 'cleaner',
          entityId: updated.id,
        });

        return updated;
      }),
    );
  }

  getCleaner(id: string): Promise<Cleaner | null> {
    return this.cleanerRepository.findOneBy({ id });
  }

  listCleaners(): Promise<Cleaner[]> {
    return this.cleanerRepository.find();
  }

  // No existence check on `teamId` (spec §4.2, §4.5) — `[]` for a team with
  // no members is indistinguishable from, and treated the same as, a
  // nonexistent team at this layer; existence is the caller's concern.
  listTeamCleaners(teamId: string): Promise<Cleaner[]> {
    return this.cleanerRepository.findBy({ teamId });
  }

  // Bulk lookup for Task 3's DataLoader; deliberately not exposed over
  // GraphQL directly. Exists alongside `listTeamCleaners`, not instead of
  // it — see this module's plan notes.
  listCleanersByTeamIds(teamIds: string[]): Promise<Cleaner[]> {
    return this.cleanerRepository.findBy({ teamId: In(teamIds) });
  }

  // Shared by `createCleaner`/`updateCleaner` (M8 dedup — behavior
  // unchanged, same translation each call site already performed inline).
  private async translateUniqueViolation<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if ((error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
        throw new ConflictException('Email is already in use');
      }
      throw error;
    }
  }

  private assertValid(
    cleaner: Pick<Cleaner, 'fullName' | 'phone' | 'email'>,
  ): void {
    if (!cleaner.fullName?.trim()) {
      throw new BadRequestException('fullName must not be empty');
    }
    if (!cleaner.phone?.trim()) {
      throw new BadRequestException('phone must not be empty');
    }
    if (!cleaner.email?.trim()) {
      throw new BadRequestException('email must not be empty');
    }
  }
}
