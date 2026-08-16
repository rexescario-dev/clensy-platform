import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import { CleanersService } from '../../application/services/cleaners.service';
import { CleanerEntity } from '../../infrastructure/persistence/cleaner.entity';
import { TeamEntity } from '../../infrastructure/persistence/team.entity';

// Mocked `Repository`/`DataSource` unit tests (test level 1, spec §7):
// `CleanersService`'s transactional methods open their own transaction via
// `DataSource.transaction`. The mock `manager` stands in for the
// transaction's `EntityManager`; `dataSource.transaction` just invokes the
// callback with it synchronously, same as a real transaction would from the
// caller's perspective. This level proves validation/read-path/existence-
// check logic only — it cannot and does not attempt to prove real
// transactional rollback or the unique-violation-to-ConflictException
// translation (that's the level-2, real-Postgres file's job — see
// `cleaners-teams.service.e2e-spec.ts`).
describe('CleanersService', () => {
  let service: CleanersService;
  let manager: {
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    findOneBy: jest.Mock;
    findOneByOrFail: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let cleanerRepository: {
    find: jest.Mock;
    findOneBy: jest.Mock;
    findBy: jest.Mock;
  };
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
      update: jest.fn().mockResolvedValue(undefined),
      findOneBy: jest.fn(),
      findOneByOrFail: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn((cb: (manager: unknown) => unknown) => cb(manager)),
    };
    cleanerRepository = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      findBy: jest.fn(),
    };
    teamRepository = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      findBy: jest.fn(),
    };
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CleanersService,
        { provide: DataSource, useValue: dataSource },
        {
          provide: getRepositoryToken(CleanerEntity),
          useValue: cleanerRepository,
        },
        {
          provide: getRepositoryToken(TeamEntity),
          useValue: teamRepository,
        },
        { provide: AUDIT_LOGGER, useValue: auditLogger },
      ],
    }).compile();

    service = module.get<CleanersService>(CleanersService);
  });

  describe('assertValid via createCleaner', () => {
    it.each([
      [
        'fullName',
        'empty string',
        { fullName: '', phone: '555', email: 'a@b.com' },
      ],
      [
        'fullName',
        'whitespace-only',
        { fullName: '   ', phone: '555', email: 'a@b.com' },
      ],
      [
        'phone',
        'empty string',
        { fullName: 'Jane', phone: '', email: 'a@b.com' },
      ],
      [
        'phone',
        'whitespace-only',
        { fullName: 'Jane', phone: '   ', email: 'a@b.com' },
      ],
      ['email', 'empty string', { fullName: 'Jane', phone: '555', email: '' }],
      [
        'email',
        'whitespace-only',
        { fullName: 'Jane', phone: '555', email: '   ' },
      ],
    ])(
      'throws BadRequestException before any repository call when %s is %s',
      async (_field, _label, fields) => {
        await expect(
          service.createCleaner({ actorId: 'actor-1', ...fields }),
        ).rejects.toThrow(BadRequestException);

        expect(manager.save).not.toHaveBeenCalled();
        expect(auditLogger.log).not.toHaveBeenCalled();
      },
    );
  });

  describe('assertValid via updateCleaner', () => {
    it('throws BadRequestException when the resulting fullName would be whitespace-only', async () => {
      manager.findOneBy.mockResolvedValue({
        id: 'cleaner-1',
        fullName: 'Jane',
        phone: '555',
        email: 'jane@example.com',
        notes: null,
        teamId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.updateCleaner('cleaner-1', {
          actorId: 'actor-1',
          fullName: '   ',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(manager.update).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });
  });

  describe('updateCleaner', () => {
    it('throws NotFoundException for a nonexistent id', async () => {
      manager.findOneBy.mockResolvedValue(null);

      await expect(
        service.updateCleaner('missing-id', {
          actorId: 'actor-1',
          fullName: 'Jane',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(manager.update).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });
  });

  describe('assignCleanerToTeam', () => {
    it('throws NotFoundException for a nonexistent teamId without attempting a cleaner lookup', async () => {
      manager.findOneBy.mockResolvedValueOnce(null); // team lookup

      await expect(
        service.assignCleanerToTeam({
          actorId: 'actor-1',
          cleanerId: 'cleaner-1',
          teamId: 'missing-team',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(manager.findOneBy).toHaveBeenCalledTimes(1);
      expect(manager.update).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for a nonexistent cleanerId (checked after the team lookup succeeds)', async () => {
      manager.findOneBy
        .mockResolvedValueOnce({ id: 'team-1', name: 'Alpha' }) // team lookup
        .mockResolvedValueOnce(null); // cleaner lookup

      await expect(
        service.assignCleanerToTeam({
          actorId: 'actor-1',
          cleanerId: 'missing-cleaner',
          teamId: 'team-1',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(manager.findOneBy).toHaveBeenCalledTimes(2);
      expect(manager.update).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });
  });

  describe('getCleaner', () => {
    it('returns the cleaner for an existing id', async () => {
      const cleaner = {
        id: 'cleaner-1',
        fullName: 'Jane',
        phone: '555',
        email: 'jane@example.com',
        notes: null,
        teamId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      cleanerRepository.findOneBy.mockResolvedValue(cleaner);

      await expect(service.getCleaner('cleaner-1')).resolves.toEqual(cleaner);
      expect(cleanerRepository.findOneBy).toHaveBeenCalledWith({
        id: 'cleaner-1',
      });
    });

    it('returns null for a nonexistent id', async () => {
      cleanerRepository.findOneBy.mockResolvedValue(null);

      await expect(service.getCleaner('missing-id')).resolves.toBeNull();
    });
  });

  describe('listCleaners', () => {
    it('returns all cleaners', async () => {
      const cleaners = [
        {
          id: 'cleaner-1',
          fullName: 'Jane',
          phone: '555',
          email: 'jane@example.com',
          notes: null,
          teamId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      cleanerRepository.find.mockResolvedValue(cleaners);

      await expect(service.listCleaners()).resolves.toEqual(cleaners);
    });

    it('returns an empty array when none exist', async () => {
      cleanerRepository.find.mockResolvedValue([]);

      await expect(service.listCleaners()).resolves.toEqual([]);
    });
  });

  describe('listTeamCleaners', () => {
    it('returns cleaners for the given teamId', async () => {
      const cleaners = [
        {
          id: 'cleaner-1',
          fullName: 'Jane',
          phone: '555',
          email: 'jane@example.com',
          notes: null,
          teamId: 'team-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      cleanerRepository.findBy.mockResolvedValue(cleaners);

      await expect(service.listTeamCleaners('team-1')).resolves.toEqual(
        cleaners,
      );
      expect(cleanerRepository.findBy).toHaveBeenCalledWith({
        teamId: 'team-1',
      });
    });

    it('returns an empty array for a team with no members', async () => {
      cleanerRepository.findBy.mockResolvedValue([]);

      await expect(service.listTeamCleaners('team-1')).resolves.toEqual([]);
    });
  });

  describe('listCleanersByTeamIds', () => {
    it('returns exactly the cleaners found for a subset of requested teamIds', async () => {
      const found = [
        {
          id: 'cleaner-1',
          fullName: 'Jane',
          phone: '555',
          email: 'jane@example.com',
          notes: null,
          teamId: 'team-1',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      cleanerRepository.findBy.mockResolvedValue(found);

      await expect(
        service.listCleanersByTeamIds(['team-1', 'missing-team']),
      ).resolves.toEqual(found);
    });

    it('returns an empty array when none exist', async () => {
      cleanerRepository.findBy.mockResolvedValue([]);

      await expect(service.listCleanersByTeamIds(['team-1'])).resolves.toEqual(
        [],
      );
    });
  });
});
