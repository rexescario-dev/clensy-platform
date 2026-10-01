import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import type { AuditLogger } from '../../../../platform/audit/application/audit-logger.port';
import { runAuditInTransaction } from '../../../../platform/audit/infrastructure/audit-logger.service';
import { Team } from '../../domain/team';
import { TeamEntity } from '../../infrastructure/persistence/team.entity';
import { CreateTeamCommand } from '../commands/create-team.command';
import { tenantAuditTags } from '../../../../platform/audit/application/audit-tags';

// Postgres unique_violation — see
// https://www.postgresql.org/docs/current/errcodes-appendix.html
// Matches `AdminsService`'s exact local constant (spec §3) rather than a
// shared one.
const POSTGRES_UNIQUE_VIOLATION = '23505';

const TEAM_TENANT_NAME_CONSTRAINT = 'uq_team_tenant_name';

@Injectable()
export class TeamsService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(TeamEntity)
    private readonly teamRepository: Repository<TeamEntity>,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  // Opens its own transaction and wraps the work in `runAuditInTransaction`
  // (mirroring `CustomersService.create`/`AdminsService.create` exactly,
  // spec §4.4/§4.6's transactional-audit rule): the entity write goes
  // through the transaction's own `manager`, and the `auditLogger.log()`
  // call made inside `fn` automatically detects the ambient transaction and
  // uses that same `manager`, so a persistence failure there rolls back the
  // `TeamEntity` insert with it.
  createTeam(command: CreateTeamCommand): Promise<Team> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const entity = manager.create(TeamEntity, {
          tenantId: command.tenantId,
          name: command.name,
        });
        this.assertValid(entity);

        await this.translateUniqueViolation(() => manager.save(entity));

        await this.auditLogger.log({
          actorId: command.actorId,
          entityId: entity.id,
          action: 'team.create',
          entityType: 'team',
          ...tenantAuditTags(command.tenantId),
        });

        return entity;
      }),
    );
  }

  // `tenantId: null` (no principal tenant scope, RFC §4.5) fails closed
  // WITHOUT issuing a repository query.
  getTeam(id: string, tenantId: string | null): Promise<Team | null> {
    if (tenantId === null) {
      return Promise.resolve(null);
    }
    return this.teamRepository.findOneBy({ id, tenantId });
  }

  // Bulk lookup for the `Cleaner.team` / `CleaningJob.team` loaders. `tenantId`
  // MUST be in the same `where` as `id: In(ids)` — never fetch by ids then
  // filter in memory. A foreign id is simply absent; the loader maps it to null.
  getTeamsByIds(ids: string[], tenantId: string | null): Promise<Team[]> {
    if (ids.length === 0 || tenantId === null) {
      return Promise.resolve([]);
    }
    return this.teamRepository.findBy({ id: In(ids), tenantId });
  }

  listTeams(tenantId: string | null): Promise<Team[]> {
    if (tenantId === null) {
      return Promise.resolve([]);
    }
    return this.teamRepository.find({ where: { tenantId } });
  }

  private assertValid(team: Pick<Team, 'name'>): void {
    if (!team.name?.trim()) {
      throw new BadRequestException('name must not be empty');
    }
  }

  // Same constraint-name match as `CustomersService.translateUniqueViolation`
  // (#82): an unrelated 23505 is never mislabelled as a name conflict; with no
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
          constraint === TEAM_TENANT_NAME_CONSTRAINT
        ) {
          throw new ConflictException('Team name is already in use');
        }
      }
      throw error;
    }
  }
}
