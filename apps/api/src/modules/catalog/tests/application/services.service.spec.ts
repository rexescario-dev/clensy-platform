import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import { ServicesService } from '../../application/services/services.service';
import { ServiceEntity } from '../../infrastructure/persistence/service.entity';

// Mocked `Repository`/`DataSource` unit tests (test level 1, spec §7):
// `ServicesService`'s transactional methods open their own transaction via
// `DataSource.transaction`. The mock `manager` stands in for the
// transaction's `EntityManager`; `dataSource.transaction` just invokes the
// callback with it synchronously, same as a real transaction would from the
// caller's perspective. This level proves validation/read-path/existence-
// check logic only — it cannot and does not attempt to prove real
// transactional rollback or the unique-violation-to-ConflictException
// translation, or real case-insensitive uniqueness against a persisted row
// (that's the level-2, real-Postgres file's job — see
// `catalog.service.e2e-spec.ts`).
describe('ServicesService', () => {
  let service: ServicesService;
  let manager: {
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    findOneBy: jest.Mock;
    findOneByOrFail: jest.Mock;
    getRepository: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let serviceRepository: {
    find: jest.Mock;
    findOneBy: jest.Mock;
  };
  let auditLogger: { log: jest.Mock };
  let nameQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    getOne: jest.Mock;
  };

  beforeEach(async () => {
    nameQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
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
      getRepository: jest.fn(() => ({
        createQueryBuilder: jest.fn(() => nameQueryBuilder),
      })),
    };
    dataSource = {
      transaction: jest.fn((cb: (manager: unknown) => unknown) => cb(manager)),
    };
    serviceRepository = {
      find: jest.fn(),
      findOneBy: jest.fn(),
    };
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: DataSource, useValue: dataSource },
        {
          provide: getRepositoryToken(ServiceEntity),
          useValue: serviceRepository,
        },
        { provide: AUDIT_LOGGER, useValue: auditLogger },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
  });

  describe('assertValid via createService', () => {
    it.each([
      ['name', 'empty string', { name: '', durationMinutes: 30 }],
      ['name', 'whitespace-only', { name: '   ', durationMinutes: 30 }],
      [
        'durationMinutes',
        'zero',
        { name: 'Standard Clean', durationMinutes: 0 },
      ],
      [
        'durationMinutes',
        'negative',
        { name: 'Standard Clean', durationMinutes: -5 },
      ],
      [
        'durationMinutes',
        'non-integer',
        { name: 'Standard Clean', durationMinutes: 30.5 },
      ],
    ])(
      'throws BadRequestException before any repository call when %s is %s',
      async (_field, _label, fields) => {
        await expect(
          service.createService({ actorId: 'actor-1', ...fields }),
        ).rejects.toThrow(BadRequestException);

        expect(manager.save).not.toHaveBeenCalled();
        expect(auditLogger.log).not.toHaveBeenCalled();
      },
    );
  });

  describe('getService', () => {
    it('returns the service for an existing id', async () => {
      const svc = {
        id: 'service-1',
        name: 'Standard Clean',
        description: null,
        durationMinutes: 60,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      serviceRepository.findOneBy.mockResolvedValue(svc);

      await expect(service.getService('service-1')).resolves.toEqual(svc);
      expect(serviceRepository.findOneBy).toHaveBeenCalledWith({
        id: 'service-1',
      });
    });

    it('returns null for a nonexistent id', async () => {
      serviceRepository.findOneBy.mockResolvedValue(null);

      await expect(service.getService('missing-id')).resolves.toBeNull();
    });
  });

  describe('listServices', () => {
    it('returns all services including inactive ones', async () => {
      const services = [
        {
          id: 'service-1',
          name: 'Standard Clean',
          description: null,
          durationMinutes: 60,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'service-2',
          name: 'Deep Clean',
          description: null,
          durationMinutes: 120,
          active: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      serviceRepository.find.mockResolvedValue(services);

      await expect(service.listServices()).resolves.toEqual(services);
      expect(serviceRepository.find).toHaveBeenCalledWith();
    });

    it('returns an empty array when none exist', async () => {
      serviceRepository.find.mockResolvedValue([]);

      await expect(service.listServices()).resolves.toEqual([]);
    });
  });

  describe('updateService', () => {
    it('throws NotFoundException for a nonexistent id', async () => {
      manager.findOneBy.mockResolvedValue(null);

      await expect(
        service.updateService('missing-id', {
          actorId: 'actor-1',
          name: 'New Name',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(manager.update).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });

    // Final-review fix: validate-before-uniqueness-check, matching
    // createService's order. Input that is invalid in both ways (a
    // colliding name AND an invalid field) must fail with the validation
    // error, not the uniqueness error — same as createService already does.
    it('throws BadRequestException, not ConflictException, when durationMinutes is invalid and name collides', async () => {
      manager.findOneBy.mockResolvedValue({
        id: 'service-1',
        name: 'Standard Clean',
        description: null,
        durationMinutes: 60,
        active: true,
      });
      nameQueryBuilder.getOne.mockResolvedValue({
        id: 'other-service',
        name: 'Existing Name',
      });

      await expect(
        service.updateService('service-1', {
          actorId: 'actor-1',
          name: 'Existing Name',
          durationMinutes: -5,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(manager.update).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });
  });
});
