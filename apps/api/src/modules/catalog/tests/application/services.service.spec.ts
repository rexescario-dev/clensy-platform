import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, In } from 'typeorm';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import { ServicesService } from '../../application/services/services.service';
import { ServiceEntity } from '../../infrastructure/persistence/service.entity';

// Mocked `Repository`/`DataSource` unit tests (test level 1, spec §7):
// `ServicesService`'s transactional methods open their own transaction via
// `DataSource.transaction`. The mock `manager` stands in for the
// transaction's `EntityManager`; `dataSource.transaction` just invokes the
// callback with it synchronously, same as a real transaction would from the
// caller's perspective. This level proves validation/read-path/existence-
// check logic, and — by throwing synthetic `23505` errors from the mocked
// manager — the constraint-name mapping in `translateUniqueViolation`; it
// cannot and does not attempt to prove real transactional rollback or real
// case-insensitive uniqueness/race behaviour against a persisted row (that's
// the level-2, real-Postgres file's job — see `catalog.service.e2e-spec.ts`).
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
    findBy: jest.Mock;
  };
  let auditLogger: { log: jest.Mock };
  let nameQueryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    getOne: jest.Mock;
  };

  beforeEach(async () => {
    nameQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
      where: jest.fn().mockReturnThis(),
    };
    manager = {
      create: jest.fn(
        (_entityClass: unknown, data: Record<string, unknown>) => ({
          ...data,
        }),
      ),
      findOneBy: jest.fn(),
      findOneByOrFail: jest.fn(),
      getRepository: jest.fn(() => ({
        createQueryBuilder: jest.fn(() => nameQueryBuilder),
      })),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
      update: jest.fn().mockResolvedValue(undefined),
    };
    dataSource = {
      transaction: jest.fn((cb: (manager: unknown) => unknown) => cb(manager)),
    };
    serviceRepository = {
      find: jest.fn(),
      findBy: jest.fn(),
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
      ['name', 'empty string', { durationMinutes: 30, name: '' }],
      ['name', 'whitespace-only', { durationMinutes: 30, name: '   ' }],
      [
        'durationMinutes',
        'zero',
        { durationMinutes: 0, name: 'Standard Clean' },
      ],
      [
        'durationMinutes',
        'negative',
        { durationMinutes: -5, name: 'Standard Clean' },
      ],
      [
        'durationMinutes',
        'non-integer',
        { durationMinutes: 30.5, name: 'Standard Clean' },
      ],
    ])(
      'throws BadRequestException before any repository call when %s is %s',
      async (_field, _label, fields) => {
        await expect(
          service.createService({
            actorId: 'actor-1',
            tenantId: 't-a',
            ...fields,
          }),
        ).rejects.toThrow(BadRequestException);

        expect(manager.save).not.toHaveBeenCalled();
        expect(auditLogger.log).not.toHaveBeenCalled();
        // Closes the M8 gap: the title claims validation runs "before any
        // repository call," but until this assertion the test only proved
        // `save`/`log` were skipped — it never proved the name-availability
        // query builder (`manager.getRepository(...).createQueryBuilder(...)`)
        // was skipped too. A regression that reordered createService to
        // check name availability first would have passed this test silently.
        expect(manager.getRepository).not.toHaveBeenCalled();
      },
    );
  });

  describe('getService', () => {
    it('returns the service for an existing id', async () => {
      const svc = {
        id: 'service-1',
        tenantId: 't-a',
        active: true,
        createdAt: new Date(),
        description: null,
        durationMinutes: 60,
        name: 'Standard Clean',
        updatedAt: new Date(),
      };
      serviceRepository.findOneBy.mockResolvedValue(svc);

      await expect(service.getService('service-1', 't-a')).resolves.toEqual(
        svc,
      );
      expect(serviceRepository.findOneBy).toHaveBeenCalledWith({
        id: 'service-1',
        tenantId: 't-a',
      });
    });

    it('returns null for a nonexistent id', async () => {
      serviceRepository.findOneBy.mockResolvedValue(null);

      await expect(service.getService('missing-id', 't-a')).resolves.toBeNull();
    });
  });

  describe('listServices', () => {
    it('returns all services including inactive ones', async () => {
      const services = [
        {
          id: 'service-1',
          tenantId: 't-a',
          active: true,
          createdAt: new Date(),
          description: null,
          durationMinutes: 60,
          name: 'Standard Clean',
          updatedAt: new Date(),
        },
        {
          id: 'service-2',
          tenantId: 't-a',
          active: false,
          createdAt: new Date(),
          description: null,
          durationMinutes: 120,
          name: 'Deep Clean',
          updatedAt: new Date(),
        },
      ];
      serviceRepository.find.mockResolvedValue(services);

      await expect(service.listServices('t-a')).resolves.toEqual(services);
      expect(serviceRepository.find).toHaveBeenCalledWith({
        where: { tenantId: 't-a' },
      });
    });

    it('returns an empty array when none exist', async () => {
      serviceRepository.find.mockResolvedValue([]);

      await expect(service.listServices('t-a')).resolves.toEqual([]);
    });
  });

  describe('updateService', () => {
    it('throws NotFoundException for a nonexistent id', async () => {
      manager.findOneBy.mockResolvedValue(null);

      await expect(
        service.updateService('missing-id', {
          actorId: 'actor-1',
          tenantId: 't-a',
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
        tenantId: 't-a',
        active: true,
        description: null,
        durationMinutes: 60,
        name: 'Standard Clean',
      });
      nameQueryBuilder.getOne.mockResolvedValue({
        id: 'other-service',
        name: 'Existing Name',
      });

      await expect(
        service.updateService('service-1', {
          actorId: 'actor-1',
          tenantId: 't-a',
          durationMinutes: -5,
          name: 'Existing Name',
        }),
      ).rejects.toThrow(BadRequestException);

      expect(manager.update).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });
  });

  describe('getServicesByIds', () => {
    it('returns exactly the rows found, with no synthetic entries for missing ids', async () => {
      const services = [
        {
          id: 'service-1',
          tenantId: 't-a',
          active: true,
          createdAt: new Date(),
          description: null,
          durationMinutes: 60,
          name: 'Standard Clean',
          updatedAt: new Date(),
        },
      ];
      serviceRepository.findBy.mockResolvedValue(services);

      await expect(
        service.getServicesByIds(['service-1', 'service-2'], 't-a'),
      ).resolves.toEqual(services);
    });

    it('returns an empty array without querying when ids is empty', async () => {
      await expect(service.getServicesByIds([], 't-a')).resolves.toEqual([]);
      expect(serviceRepository.findBy).not.toHaveBeenCalled();
    });
  });

  describe('tenant predicate (#84)', () => {
    it('getService scopes by id and tenant', async () => {
      serviceRepository.findOneBy.mockResolvedValue(null);
      await expect(service.getService('s-1', 't-a')).resolves.toBeNull();
      expect(serviceRepository.findOneBy).toHaveBeenCalledWith({
        id: 's-1',
        tenantId: 't-a',
      });
    });

    it('getServicesByIds puts tenantId in the same where as the id list', async () => {
      serviceRepository.findBy.mockResolvedValue([]);
      await service.getServicesByIds(['a', 'b'], 't-a');
      expect(serviceRepository.findBy).toHaveBeenCalledWith({
        id: In(['a', 'b']),
        tenantId: 't-a',
      });
    });

    it('listServices scopes by tenant', async () => {
      serviceRepository.find.mockResolvedValue([]);
      await service.listServices('t-a');
      expect(serviceRepository.find).toHaveBeenCalledWith({
        where: { tenantId: 't-a' },
      });
    });

    it.each([
      ['getService', () => service.getService('s-1', null), null],
      ['getServicesByIds', () => service.getServicesByIds(['a'], null), []],
      [
        'getServicesByIds (empty ids)',
        () => service.getServicesByIds([], 't-a'),
        [],
      ],
      ['listServices', () => service.listServices(null), []],
    ])(
      '%s fails closed without a repository query',
      async (_label, call, expected) => {
        await expect(call()).resolves.toEqual(expected);
        expect(serviceRepository.findOneBy).not.toHaveBeenCalled();
        expect(serviceRepository.findBy).not.toHaveBeenCalled();
        expect(serviceRepository.find).not.toHaveBeenCalled();
      },
    );

    it('createService persists the tenant, pre-checks the name within it, and tags the audit event', async () => {
      await service.createService({
        actorId: 'u',
        tenantId: 't-a',
        durationMinutes: 60,
        name: ' Deep ',
      });
      expect(manager.create).toHaveBeenCalledWith(
        ServiceEntity,
        expect.objectContaining({ tenantId: 't-a', name: 'Deep' }),
      );
      expect(nameQueryBuilder.andWhere).toHaveBeenCalledWith(
        's.tenantId = :tenantId',
        { tenantId: 't-a' },
      );
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'service.create',
          scope: AdminScope.TENANT,
          tenantId: 't-a',
        }),
      );
    });

    it('updateService looks up and updates within the tenant and never writes tenantId', async () => {
      manager.findOneBy.mockResolvedValueOnce({
        id: 's-1',
        tenantId: 't-a',
        durationMinutes: 60,
        name: 'Old',
      });
      manager.findOneByOrFail.mockResolvedValueOnce({
        id: 's-1',
        tenantId: 't-a',
        durationMinutes: 60,
        name: 'New',
      });
      await service.updateService('s-1', {
        actorId: 'u',
        tenantId: 't-a',
        name: 'New',
      });
      expect(manager.findOneBy).toHaveBeenCalledWith(ServiceEntity, {
        id: 's-1',
        tenantId: 't-a',
      });
      const [, where, set] = manager.update.mock.calls[0] as [
        unknown,
        object,
        Record<string, unknown>,
      ];
      expect(where).toEqual({ id: 's-1', tenantId: 't-a' });
      expect(set).not.toHaveProperty('tenantId');
      expect(set).not.toHaveProperty('actorId');
      expect(manager.findOneByOrFail).toHaveBeenCalledWith(ServiceEntity, {
        id: 's-1',
        tenantId: 't-a',
      });
      expect(nameQueryBuilder.andWhere).toHaveBeenCalledWith(
        's.tenantId = :tenantId',
        { tenantId: 't-a' },
      );
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'service.update',
          scope: AdminScope.TENANT,
          tenantId: 't-a',
        }),
      );
    });

    it('updateService on another tenant’s service is NotFound with no write', async () => {
      manager.findOneBy.mockResolvedValueOnce(null);
      await expect(
        service.updateService('s-foreign', {
          actorId: 'u',
          tenantId: 't-b',
          name: 'X',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('maps uq_service_tenant_name_lower to Conflict and rethrows other unique violations', async () => {
      manager.save.mockRejectedValueOnce({
        code: '23505',
        driverError: { constraint: 'uq_service_tenant_name_lower' },
      });
      await expect(
        service.createService({
          actorId: 'u',
          tenantId: 't-a',
          durationMinutes: 60,
          name: 'Deep',
        }),
      ).rejects.toThrow(
        new ConflictException('Service name is already in use'),
      );

      const other = {
        code: '23505',
        driverError: { constraint: 'uq_service_id_tenant' },
      };
      manager.save.mockRejectedValueOnce(other);
      await expect(
        service.createService({
          actorId: 'u',
          tenantId: 't-a',
          durationMinutes: 60,
          name: 'Deep',
        }),
      ).rejects.toBe(other);
    });
  });
});
