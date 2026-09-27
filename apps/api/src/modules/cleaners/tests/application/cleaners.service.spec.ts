import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import { CleanersService } from '../../application/services/cleaners.service';
import { Cleaner } from '../../domain/cleaner';
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

  function makeEntity(overrides: Partial<Cleaner> = {}): Cleaner {
    return {
      id: 'cleaner-1',
      tenantId: 't-a',
      teamId: null,
      createdAt: new Date(),
      email: 'jane@example.com',
      fullName: 'Jane',
      notes: null,
      phone: '555',
      updatedAt: new Date(),
      ...overrides,
    };
  }

  beforeEach(async () => {
    manager = {
      create: jest.fn(
        (_entityClass: unknown, data: Record<string, unknown>) => ({
          ...data,
        }),
      ),
      findOneBy: jest.fn(),
      findOneByOrFail: jest.fn(),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      update: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: jest.fn((cb: (manager: unknown) => unknown) => cb(manager)),
    };
    cleanerRepository = {
      find: jest.fn(),
      findBy: jest.fn(),
      findOneBy: jest.fn(),
    };
    teamRepository = {
      find: jest.fn(),
      findBy: jest.fn(),
      findOneBy: jest.fn(),
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
        { email: 'a@b.com', fullName: '', phone: '555' },
      ],
      [
        'fullName',
        'whitespace-only',
        { email: 'a@b.com', fullName: '   ', phone: '555' },
      ],
      [
        'phone',
        'empty string',
        { email: 'a@b.com', fullName: 'Jane', phone: '' },
      ],
      [
        'phone',
        'whitespace-only',
        { email: 'a@b.com', fullName: 'Jane', phone: '   ' },
      ],
      ['email', 'empty string', { email: '', fullName: 'Jane', phone: '555' }],
      [
        'email',
        'whitespace-only',
        { email: '   ', fullName: 'Jane', phone: '555' },
      ],
    ])(
      'throws BadRequestException before any repository call when %s is %s',
      async (_field, _label, fields) => {
        await expect(
          service.createCleaner({
            actorId: 'actor-1',
            tenantId: 't-a',
            ...fields,
          }),
        ).rejects.toThrow(BadRequestException);

        expect(manager.save).not.toHaveBeenCalled();
        expect(auditLogger.log).not.toHaveBeenCalled();
      },
    );
  });

  describe('assertValid via updateCleaner', () => {
    it('throws BadRequestException when the resulting fullName would be whitespace-only', async () => {
      manager.findOneBy.mockResolvedValue(makeEntity());

      await expect(
        service.updateCleaner('cleaner-1', {
          actorId: 'actor-1',
          tenantId: 't-a',
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
          tenantId: 't-a',
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
          tenantId: 't-a',
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
        .mockResolvedValueOnce({ id: 'team-1', tenantId: 't-a', name: 'Alpha' }) // team lookup
        .mockResolvedValueOnce(null); // cleaner lookup

      await expect(
        service.assignCleanerToTeam({
          actorId: 'actor-1',
          tenantId: 't-a',
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
      const cleaner = makeEntity();
      cleanerRepository.findOneBy.mockResolvedValue(cleaner);

      await expect(
        service.getCleaner('cleaner-1', 't-a'),
      ).resolves.toEqual(cleaner);
      expect(cleanerRepository.findOneBy).toHaveBeenCalledWith({
        id: 'cleaner-1',
        tenantId: 't-a',
      });
    });

    it('returns null for a nonexistent id', async () => {
      cleanerRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.getCleaner('missing-id', 't-a'),
      ).resolves.toBeNull();
    });
  });

  describe('listCleaners', () => {
    it('returns all cleaners for the tenant', async () => {
      const cleaners = [makeEntity()];
      cleanerRepository.find.mockResolvedValue(cleaners);

      await expect(service.listCleaners('t-a')).resolves.toEqual(cleaners);
    });

    it('returns an empty array when none exist', async () => {
      cleanerRepository.find.mockResolvedValue([]);

      await expect(service.listCleaners('t-a')).resolves.toEqual([]);
    });
  });

  describe('listTeamCleaners', () => {
    it('returns cleaners for the given teamId', async () => {
      const cleaners = [makeEntity({ teamId: 'team-1' })];
      cleanerRepository.findBy.mockResolvedValue(cleaners);

      await expect(
        service.listTeamCleaners('team-1', 't-a'),
      ).resolves.toEqual(cleaners);
      expect(cleanerRepository.findBy).toHaveBeenCalledWith({
        teamId: 'team-1',
        tenantId: 't-a',
      });
    });

    it('returns an empty array for a team with no members', async () => {
      cleanerRepository.findBy.mockResolvedValue([]);

      await expect(
        service.listTeamCleaners('team-1', 't-a'),
      ).resolves.toEqual([]);
    });
  });

  describe('tenant predicate (#83)', () => {
    it('getCleaner / listCleaners / listTeamCleaners scope by tenant', async () => {
      cleanerRepository.findOneBy.mockResolvedValue(null);
      cleanerRepository.find.mockResolvedValue([]);
      cleanerRepository.findBy.mockResolvedValue([]);

      await service.getCleaner('c-1', 't-a');
      await service.listCleaners('t-a');
      await service.listTeamCleaners('team-1', 't-a');

      expect(cleanerRepository.findOneBy).toHaveBeenCalledWith({
        id: 'c-1',
        tenantId: 't-a',
      });
      expect(cleanerRepository.find).toHaveBeenCalledWith({
        where: { tenantId: 't-a' },
      });
      expect(cleanerRepository.findBy).toHaveBeenCalledWith({
        teamId: 'team-1',
        tenantId: 't-a',
      });
    });

    it('null tenant fails closed without a repository query', async () => {
      await expect(service.getCleaner('c-1', null)).resolves.toBeNull();
      await expect(service.listCleaners(null)).resolves.toEqual([]);
      await expect(
        service.listTeamCleaners('team-1', null),
      ).resolves.toEqual([]);

      expect(cleanerRepository.findOneBy).not.toHaveBeenCalled();
      expect(cleanerRepository.find).not.toHaveBeenCalled();
      expect(cleanerRepository.findBy).not.toHaveBeenCalled();
    });

    it('createCleaner persists the tenant and tags the audit event', async () => {
      await service.createCleaner({
        actorId: 'a',
        tenantId: 't-a',
        fullName: 'N',
        phone: '1',
        email: 'e@x.com',
      });

      expect(manager.create).toHaveBeenCalledWith(
        CleanerEntity,
        expect.objectContaining({ tenantId: 't-a', teamId: null }),
      );
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cleaner.create',
          scope: AdminScope.TENANT,
          tenantId: 't-a',
        }),
      );
    });

    it('updateCleaner looks up and updates within the tenant and never writes tenantId', async () => {
      manager.findOneBy.mockResolvedValueOnce(
        makeEntity({ id: 'c-1', tenantId: 't-a' }),
      );
      manager.findOneByOrFail.mockResolvedValueOnce(
        makeEntity({ id: 'c-1', tenantId: 't-a' }),
      );

      await service.updateCleaner('c-1', {
        actorId: 'a',
        tenantId: 't-a',
        fullName: 'New',
      });

      expect(manager.findOneBy).toHaveBeenCalledWith(CleanerEntity, {
        id: 'c-1',
        tenantId: 't-a',
      });
      const [, where, set] = manager.update.mock.calls[0] as [
        unknown,
        object,
        Record<string, unknown>,
      ];
      expect(where).toEqual({ id: 'c-1', tenantId: 't-a' });
      expect(set).not.toHaveProperty('tenantId');
      expect(set).not.toHaveProperty('actorId');
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cleaner.update',
          scope: AdminScope.TENANT,
          tenantId: 't-a',
        }),
      );
    });

    it('updateCleaner on another tenant’s cleaner is NotFound', async () => {
      manager.findOneBy.mockResolvedValueOnce(null);

      await expect(
        service.updateCleaner('c-foreign', {
          actorId: 'a',
          tenantId: 't-b',
          fullName: 'X',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('assignCleanerToTeam resolves team and cleaner within the tenant before mutating', async () => {
      manager.findOneBy.mockResolvedValueOnce(null); // team of another tenant

      await expect(
        service.assignCleanerToTeam({
          actorId: 'a',
          tenantId: 't-b',
          cleanerId: 'c-1',
          teamId: 'team-a',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(manager.findOneBy).toHaveBeenCalledWith(TeamEntity, {
        id: 'team-a',
        tenantId: 't-b',
      });
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('assignCleanerToTeam tags the audit event', async () => {
      manager.findOneBy
        .mockResolvedValueOnce({ id: 'team-a', tenantId: 't-a' })
        .mockResolvedValueOnce(makeEntity({ id: 'c-1', tenantId: 't-a' }));
      manager.findOneByOrFail.mockResolvedValueOnce(
        makeEntity({ id: 'c-1', tenantId: 't-a', teamId: 'team-a' }),
      );

      await service.assignCleanerToTeam({
        actorId: 'a',
        tenantId: 't-a',
        cleanerId: 'c-1',
        teamId: 'team-a',
      });

      expect(manager.findOneBy).toHaveBeenNthCalledWith(2, CleanerEntity, {
        id: 'c-1',
        tenantId: 't-a',
      });
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cleaner.assign_team',
          scope: AdminScope.TENANT,
          tenantId: 't-a',
        }),
      );
    });

    it('maps uq_cleaner_tenant_email to Conflict and rethrows other unique violations', async () => {
      manager.save.mockRejectedValueOnce({
        code: '23505',
        driverError: { constraint: 'uq_cleaner_tenant_email' },
      });
      await expect(
        service.createCleaner({
          actorId: 'a',
          tenantId: 't-a',
          fullName: 'N',
          phone: '1',
          email: 'e@x.com',
        }),
      ).rejects.toThrow(new ConflictException('Email is already in use'));

      const other = {
        code: '23505',
        driverError: { constraint: 'uq_cleaner_id_tenant' },
      };
      manager.save.mockRejectedValueOnce(other);
      await expect(
        service.createCleaner({
          actorId: 'a',
          tenantId: 't-a',
          fullName: 'N',
          phone: '1',
          email: 'e@x.com',
        }),
      ).rejects.toBe(other);
    });
  });
});
