import { BadRequestException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
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
      findOneBy: jest.fn(),
      findBy: jest.fn(),
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
          service.createTeam({ actorId: 'actor-1', name }),
        ).rejects.toThrow(BadRequestException);

        expect(manager.save).not.toHaveBeenCalled();
        expect(auditLogger.log).not.toHaveBeenCalled();
      },
    );
  });

  describe('getTeam', () => {
    it('returns the team for an existing id', async () => {
      const team = {
        id: 'team-1',
        name: 'Alpha Team',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      teamRepository.findOneBy.mockResolvedValue(team);

      await expect(service.getTeam('team-1')).resolves.toEqual(team);
      expect(teamRepository.findOneBy).toHaveBeenCalledWith({ id: 'team-1' });
    });

    it('returns null for a nonexistent id', async () => {
      teamRepository.findOneBy.mockResolvedValue(null);

      await expect(service.getTeam('missing-id')).resolves.toBeNull();
    });
  });

  describe('listTeams', () => {
    it('returns all teams', async () => {
      const teams = [
        {
          id: 'team-1',
          name: 'Alpha Team',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      teamRepository.find.mockResolvedValue(teams);

      await expect(service.listTeams()).resolves.toEqual(teams);
    });

    it('returns an empty array when none exist', async () => {
      teamRepository.find.mockResolvedValue([]);

      await expect(service.listTeams()).resolves.toEqual([]);
    });
  });

  describe('getTeamsByIds', () => {
    it('returns exactly the teams found for a subset of requested ids, no synthetic entries for missing ones', async () => {
      const found = [
        {
          id: 'team-1',
          name: 'Alpha Team',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      teamRepository.findBy.mockResolvedValue(found);

      await expect(
        service.getTeamsByIds(['team-1', 'missing-id']),
      ).resolves.toEqual(found);
    });
  });
});
