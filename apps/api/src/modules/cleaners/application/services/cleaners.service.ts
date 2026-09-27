import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
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

const CLEANER_TENANT_EMAIL_CONSTRAINT = 'uq_cleaner_tenant_email';

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

  // Same `manager.update()` rationale as `updateCleaner` below: `teamId`
  // could already equal its current value (re-assigning to the same team),
  // and `save()`'s diffing would risk a no-op `UPDATE` in that case, silently
  // violating the requirement that `updatedAt` bump and an audit event fire
  // unconditionally on every successful call. Team and cleaner are both
  // resolved scoped to `command.tenantId` before any write — another
  // tenant's team/cleaner id is indistinguishable from a missing one (RFC
  // §4.5), NotFoundException either way, never a 403 leaking cross-tenant
  // existence.
  assignCleanerToTeam(command: AssignCleanerToTeamCommand): Promise<Cleaner> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const team = await manager.findOneBy(TeamEntity, {
          id: command.teamId,
          tenantId: command.tenantId,
        });
        if (!team) {
          throw new NotFoundException(`Team ${command.teamId} not found`);
        }

        const cleaner = await manager.findOneBy(CleanerEntity, {
          id: command.cleanerId,
          tenantId: command.tenantId,
        });
        if (!cleaner) {
          throw new NotFoundException(`Cleaner ${command.cleanerId} not found`);
        }

        await manager.update(
          CleanerEntity,
          { id: command.cleanerId, tenantId: command.tenantId },
          { teamId: command.teamId, updatedAt: new Date() },
        );

        const updated = await manager.findOneByOrFail(CleanerEntity, {
          id: command.cleanerId,
          tenantId: command.tenantId,
        });

        await this.auditLogger.log({
          actorId: command.actorId,
          entityId: updated.id,
          tenantId: command.tenantId,
          action: 'cleaner.assign_team',
          entityType: 'cleaner',
          scope: AdminScope.TENANT,
        });

        return updated;
      }),
    );
  }

  // Mirrors `TeamsService.createTeam` exactly — a fresh INSERT via
  // `manager.create`/`manager.save`, no diffing risk, so plain `save()` is
  // correct here (only the two UPDATE-path methods below need
  // `manager.update()`, see their comments).
  createCleaner(command: CreateCleanerCommand): Promise<Cleaner> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const entity = manager.create(CleanerEntity, {
          teamId: null,
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
          action: 'cleaner.create',
          entityType: 'cleaner',
          scope: AdminScope.TENANT,
        });

        return entity;
      }),
    );
  }

  // `tenantId: null` (no principal tenant scope, RFC §4.5) fails closed
  // WITHOUT issuing a repository query — never "issue the query and discard
  // the result".
  getCleaner(id: string, tenantId: string | null): Promise<Cleaner | null> {
    if (tenantId === null) {
      return Promise.resolve(null);
    }
    return this.cleanerRepository.findOneBy({ id, tenantId });
  }

  listCleaners(tenantId: string | null): Promise<Cleaner[]> {
    if (tenantId === null) {
      return Promise.resolve([]);
    }
    return this.cleanerRepository.find({ where: { tenantId } });
  }

  // No existence check on `teamId` (spec §4.2, §4.5) — `[]` for a team with
  // no members is indistinguishable from, and treated the same as, a
  // nonexistent team at this layer; existence is the caller's concern.
  listTeamCleaners(
    teamId: string,
    tenantId: string | null,
  ): Promise<Cleaner[]> {
    if (tenantId === null) {
      return Promise.resolve([]);
    }
    return this.cleanerRepository.findBy({ teamId, tenantId });
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
        // Scoped by tenantId, not just id: another tenant's row is
        // indistinguishable from a missing one (RFC §4.5) — NotFoundException
        // either way, never a 403 leaking cross-tenant existence.
        const entity = await manager.findOneBy(CleanerEntity, {
          id,
          tenantId: command.tenantId,
        });
        if (!entity) {
          throw new NotFoundException(`Cleaner ${id} not found`);
        }

        // `actorId`/`tenantId` are part of the command (needed for the
        // lookup above / the audit call below) but neither is a `Cleaner`
        // field the caller may write — `tenantId` in particular must never
        // become a de facto writable field (invariant 1). Destructured out
        // rather than merged into `changes`, mirroring
        // `CustomersService.update`'s (#82) idiom.
        const { actorId, tenantId, ...changes } = command;
        void actorId; // consumed via `command.actorId` in the audit call below
        void tenantId; // consumed via `command.tenantId` in the lookup above

        // Validate the resulting state WITHOUT mutating the tracked entity —
        // manager.update() below persists `changes` directly, it never goes
        // through Object.assign on `entity`.
        this.assertValid({ ...entity, ...changes });

        await this.translateUniqueViolation(() =>
          manager.update(
            CleanerEntity,
            { id, tenantId: command.tenantId },
            { ...changes, updatedAt: new Date() },
          ),
        );

        const updated = await manager.findOneByOrFail(CleanerEntity, {
          id,
          tenantId: command.tenantId,
        });

        await this.auditLogger.log({
          actorId: command.actorId,
          entityId: updated.id,
          tenantId: command.tenantId,
          action: 'cleaner.update',
          entityType: 'cleaner',
          scope: AdminScope.TENANT,
        });

        return updated;
      }),
    );
  }

  private assertValid(
    cleaner: Pick<Cleaner, 'email' | 'fullName' | 'phone'>,
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

  // Shared by `createCleaner`/`updateCleaner` (M8 dedup — behavior
  // unchanged, same translation each call site already performed inline).
  // Constraint-name match (mirroring `TeamsService`/`CustomersService`'s own
  // `translateUniqueViolation`, #82/Task 2 idiom): an unrelated 23505 is
  // never mislabelled as an email conflict; with no constraint name
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
          constraint === CLEANER_TENANT_EMAIL_CONSTRAINT
        ) {
          throw new ConflictException('Email is already in use');
        }
      }
      throw error;
    }
  }
}
