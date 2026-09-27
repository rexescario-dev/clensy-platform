import { BadRequestException, ConflictException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, In } from 'typeorm';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import { TeamsService } from '../../application/services/teams.service';
import { TeamEntity } from '../../infrastructure/persistence/team.entity';

// Mocked `Repository`/`DataSource` unit tests (test level 1, spec §7):
// `TeamsService.createTeam` opens its own transaction via
// `DataSource.transaction`. The mock `manager` stands in for the
// transaction's `EntityManager`; `dataSource.transaction` just invokes the
// callback with it synchronously, same as a real transaction would from the
// caller's perspective. This level proves validation/read-path logic only —
// it cannot and does not attempt to prove real transactional rollback or the
// unique-violation-to-ConflictException translation (that's the level-2,
// real-Postgres file's job).
describe('TeamsService', () => {
  let service: TeamsService;
  let manager: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let teamRepository: {
    find: jest.Mock;
    findOneBy: jest.Mock;
    findBy: jest.Mock;
  };
  let auditLogger: { log: jest.Mock };

  beforeEach(async () => {
    manager = {
      create: jest.fn(
        (_entityClass: unknown, data: Record<string, unknown>) => ({
          ...data,
        }),
      ),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    };
    dataSource = {
      transaction: jest.fn((cb: (manager: unknown) => unknown) => cb(manager)),
    };
    teamRepository = {
      find: jest.fn(),
      findBy: jest.fn(),
      findOneBy: jest.fn(),
    };
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: DataSource, useValue: dataSource },
        {
          provide: getRepositoryToken(TeamEntity),
          useValue: teamRepository,
        },
        { provide: AUDIT_LOGGER, useValue: auditLogger },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
  });

  describe('assertValid via createTeam', () => {
    it.each([
      ['empty string', ''],
      ['whitespace-only', '   '],
    ])(
      'throws BadRequestException before any repository call when name is %s',
      async (_label, name) => {
        await expect(
          service.createTeam({ actorId: 'actor-1', tenantId: 't-a', name }),
        ).rejects.toThrow(BadRequestException);

        expect(manager.save).not.toHaveBeenCalled();
        expect(auditLogger.log).not.toHaveBeenCalled();
      },
    );
  });

  describe('getTeam', () => {
    it('returns the team for an existing id scoped to the tenant', async () => {
      const team = {
        id: 'team-1',
        tenantId: 't-a',
        createdAt: new Date(),
        name: 'Alpha Team',
        updatedAt: new Date(),
      };
      teamRepository.findOneBy.mockResolvedValue(team);

      await expect(service.getTeam('team-1', 't-a')).resolves.toEqual(team);
      expect(teamRepository.findOneBy).toHaveBeenCalledWith({
        id: 'team-1',
        tenantId: 't-a',
      });
    });

    it('returns null for a nonexistent id', async () => {
      teamRepository.findOneBy.mockResolvedValue(null);

      await expect(service.getTeam('missing-id', 't-a')).resolves.toBeNull();
    });
  });

  describe('listTeams', () => {
    it('returns all teams for the tenant', async () => {
      const teams = [
        {
          id: 'team-1',
          tenantId: 't-a',
          createdAt: new Date(),
          name: 'Alpha Team',
          updatedAt: new Date(),
        },
      ];
      teamRepository.find.mockResolvedValue(teams);

      await expect(service.listTeams('t-a')).resolves.toEqual(teams);
      expect(teamRepository.find).toHaveBeenCalledWith({
        where: { tenantId: 't-a' },
      });
    });

    it('returns an empty array when none exist', async () => {
      teamRepository.find.mockResolvedValue([]);

      await expect(service.listTeams('t-a')).resolves.toEqual([]);
    });
  });

  describe('getTeamsByIds', () => {
    it('returns exactly the teams found for a subset of requested ids, no synthetic entries for missing ones', async () => {
      const found = [
        {
          id: 'team-1',
          tenantId: 't-a',
          createdAt: new Date(),
          name: 'Alpha Team',
          updatedAt: new Date(),
        },
      ];
      teamRepository.findBy.mockResolvedValue(found);

      await expect(
        service.getTeamsByIds(['team-1', 'missing-id'], 't-a'),
      ).resolves.toEqual(found);
    });
  });

  describe('tenant predicate (#83)', () => {
    it('getTeam scopes by id and tenant', async () => {
      teamRepository.findOneBy.mockResolvedValue(null);
      await expect(service.getTeam('team-1', 't-a')).resolves.toBeNull();
      expect(teamRepository.findOneBy).toHaveBeenCalledWith({
        id: 'team-1',
        tenantId: 't-a',
      });
    });

    it('getTeamsByIds puts tenantId in the same where as the id list', async () => {
      teamRepository.findBy.mockResolvedValue([]);
      await service.getTeamsByIds(['a', 'b'], 't-a');
      expect(teamRepository.findBy).toHaveBeenCalledWith({
        id: In(['a', 'b']),
        tenantId: 't-a',
      });
    });

    it('listTeams scopes by tenant', async () => {
      teamRepository.find.mockResolvedValue([]);
      await service.listTeams('t-a');
      expect(teamRepository.find).toHaveBeenCalledWith({
        where: { tenantId: 't-a' },
      });
    });

    it.each([
      ['getTeam', () => service.getTeam('team-1', null), null],
      ['getTeamsByIds', () => service.getTeamsByIds(['a'], null), []],
      ['getTeamsByIds (empty ids)', () => service.getTeamsByIds([], 't-a'), []],
      ['listTeams', () => service.listTeams(null), []],
    ])(
      '%s fails closed without a repository query',
      async (_label, call, expected) => {
        await expect(call()).resolves.toEqual(expected);
        expect(teamRepository.findOneBy).not.toHaveBeenCalled();
        expect(teamRepository.findBy).not.toHaveBeenCalled();
        expect(teamRepository.find).not.toHaveBeenCalled();
      },
    );

    it('createTeam persists the tenant and tags the audit event', async () => {
      await service.createTeam({
        actorId: 'actor-1',
        tenantId: 't-a',
        name: 'Alpha',
      });
      expect(manager.create).toHaveBeenCalledWith(TeamEntity, {
        tenantId: 't-a',
        name: 'Alpha',
      });
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'team.create',
          scope: AdminScope.TENANT,
          tenantId: 't-a',
        }),
      );
    });

    it('maps uq_team_tenant_name to Conflict and rethrows other unique violations', async () => {
      manager.save.mockRejectedValueOnce({
        code: '23505',
        driverError: { constraint: 'uq_team_tenant_name' },
      });
      await expect(
        service.createTeam({ actorId: 'actor-1', tenantId: 't-a', name: 'Alpha' }),
      ).rejects.toThrow(new ConflictException('Team name is already in use'));

      const other = { code: '23505', driverError: { constraint: 'uq_team_id_tenant' } };
      manager.save.mockRejectedValueOnce(other);
      await expect(
        service.createTeam({ actorId: 'actor-1', tenantId: 't-a', name: 'Alpha' }),
      ).rejects.toBe(other);
    });
  });
});
