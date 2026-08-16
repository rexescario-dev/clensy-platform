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

// Postgres unique_violation — see
// https://www.postgresql.org/docs/current/errcodes-appendix.html
// Matches `AdminsService`'s exact local constant (spec §3) rather than a
// shared one.
const POSTGRES_UNIQUE_VIOLATION = '23505';

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
        const entity = manager.create(TeamEntity, { name: command.name });
        this.assertValid(entity);

        try {
          await manager.save(entity);
        } catch (error) {
          if ((error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
            throw new ConflictException('Team name is already in use');
          }
          throw error;
        }

        await this.auditLogger.log({
          actorId: command.actorId,
          action: 'team.create',
          entityType: 'team',
          entityId: entity.id,
        });

        return entity;
      }),
    );
  }

  getTeam(id: string): Promise<Team | null> {
    return this.teamRepository.findOneBy({ id });
  }

  listTeams(): Promise<Team[]> {
    return this.teamRepository.find();
  }

  // Bulk lookup for Task 3's DataLoader; deliberately not exposed over
  // GraphQL directly. Returns exactly the rows that exist for the given
  // ids — no synthetic entries for missing ones, the loader handles gaps.
  getTeamsByIds(ids: string[]): Promise<Team[]> {
    return this.teamRepository.findBy({ id: In(ids) });
  }

  private assertValid(team: Pick<Team, 'name'>): void {
    if (!team.name?.trim()) {
      throw new BadRequestException('name must not be empty');
    }
  }
}
