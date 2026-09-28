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
import { AddOnsService } from '../../application/services/add-ons.service';
import { AddOnEntity } from '../../infrastructure/persistence/add-on.entity';

// Mocked `Repository`/`DataSource` unit tests (test level 1, spec §7) —
// structurally identical to `services.service.spec.ts`; see that file's
// header comment for the full rationale this file shares. This level proves
// validation/read-path/existence-check logic and (since #84) the
// unique-violation-to-ConflictException translation via constraint-name
// matching — it does not attempt real transactional rollback or real
// case-insensitive uniqueness against a persisted row (that's the level-2,
// real-Postgres file's job — see `catalog.service.e2e-spec.ts`).
describe('AddOnsService', () => {
  let service: AddOnsService;
  let manager: {
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    findOneBy: jest.Mock;
    findOneByOrFail: jest.Mock;
    getRepository: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let addOnRepository: {
    find: jest.Mock;
    findBy: jest.Mock;
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
    addOnRepository = {
      find: jest.fn(),
      findBy: jest.fn(),
      findOneBy: jest.fn(),
    };
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AddOnsService,
        { provide: DataSource, useValue: dataSource },
        {
          provide: getRepositoryToken(AddOnEntity),
          useValue: addOnRepository,
        },
        { provide: AUDIT_LOGGER, useValue: auditLogger },
      ],
    }).compile();

    service = module.get<AddOnsService>(AddOnsService);
  });

  describe('assertValid via createAddOn', () => {
    it.each([
      ['name', 'empty string', { name: '', priceMinorUnits: 500 }],
      ['name', 'whitespace-only', { name: '   ', priceMinorUnits: 500 }],
      ['priceMinorUnits', 'zero', { name: 'Extra Towels', priceMinorUnits: 0 }],
      [
        'priceMinorUnits',
        'negative',
        { name: 'Extra Towels', priceMinorUnits: -5 },
      ],
      [
        'priceMinorUnits',
        'non-integer',
        { name: 'Extra Towels', priceMinorUnits: 12.5 },
      ],
    ])(
      'throws BadRequestException before any repository call when %s is %s',
      async (_field, _label, fields) => {
        await expect(
          service.createAddOn({
            actorId: 'actor-1',
            tenantId: 't-a',
            ...fields,
          }),
        ).rejects.toThrow(BadRequestException);

        expect(manager.save).not.toHaveBeenCalled();
        expect(auditLogger.log).not.toHaveBeenCalled();
        // Closes the same M8 gap fixed in services.service.spec.ts: proves
        // the name-availability query builder was never reached either.
        expect(manager.getRepository).not.toHaveBeenCalled();
      },
    );
  });

  describe('updateAddOn', () => {
    it('throws NotFoundException for a nonexistent id', async () => {
      manager.findOneBy.mockResolvedValue(null);

      await expect(
        service.updateAddOn('missing-id', {
          actorId: 'actor-1',
          tenantId: 't-a',
          name: 'New Name',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(manager.update).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });

    // Final-review fix: validate-before-uniqueness-check, matching
    // createAddOn's order. Input that is invalid in both ways (a colliding
    // name AND an invalid field) must fail with the validation error, not
    // the uniqueness error — same as createAddOn already does.
    it('throws BadRequestException, not ConflictException, when priceMinorUnits is invalid and name collides', async () => {
      manager.findOneBy.mockResolvedValue({
        id: 'add-on-1',
        tenantId: 't-a',
        active: true,
        description: null,
        name: 'Extra Towels',
        priceMinorUnits: 500,
      });
      nameQueryBuilder.getOne.mockResolvedValue({
        id: 'other-add-on',
        name: 'Existing Name',
      });

      await expect(
        service.updateAddOn('add-on-1', {
          actorId: 'actor-1',
          tenantId: 't-a',
          name: 'Existing Name',
          priceMinorUnits: -5,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(manager.update).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });
  });

  describe('listAddOns', () => {
    it('returns all add-ons including inactive ones', async () => {
      const addOns = [
        {
          id: 'add-on-1',
          tenantId: 't-a',
          active: true,
          createdAt: new Date(),
          description: null,
          name: 'Extra Towels',
          priceMinorUnits: 500,
          updatedAt: new Date(),
        },
        {
          id: 'add-on-2',
          tenantId: 't-a',
          active: false,
          createdAt: new Date(),
          description: null,
          name: 'Pet Hair Removal',
          priceMinorUnits: 1500,
          updatedAt: new Date(),
        },
      ];
      addOnRepository.find.mockResolvedValue(addOns);

      await expect(service.listAddOns('t-a')).resolves.toEqual(addOns);
      expect(addOnRepository.find).toHaveBeenCalledWith({
        where: { tenantId: 't-a' },
      });
    });

    it('returns an empty array when none exist', async () => {
      addOnRepository.find.mockResolvedValue([]);

      await expect(service.listAddOns('t-a')).resolves.toEqual([]);
    });
  });

  describe('getAddOnsByIds', () => {
    it('returns exactly the rows found, with no synthetic entries for missing ids', async () => {
      const addOns = [
        {
          id: 'add-on-1',
          tenantId: 't-a',
          active: true,
          createdAt: new Date(),
          description: null,
          name: 'Starch Finish',
          priceMinorUnits: 500,
          updatedAt: new Date(),
        },
      ];
      addOnRepository.findBy.mockResolvedValue(addOns);

      await expect(
        service.getAddOnsByIds(['add-on-1', 'add-on-2'], 't-a'),
      ).resolves.toEqual(addOns);
    });

    it('returns an empty array without querying when ids is empty', async () => {
      await expect(service.getAddOnsByIds([], 't-a')).resolves.toEqual([]);
      expect(addOnRepository.findBy).not.toHaveBeenCalled();
    });
  });

  describe('tenant predicate (#84)', () => {
    it('getAddOnsByIds puts tenantId in the same where as the id list', async () => {
      addOnRepository.findBy.mockResolvedValue([]);
      await service.getAddOnsByIds(['a', 'b'], 't-a');
      expect(addOnRepository.findBy).toHaveBeenCalledWith({
        id: In(['a', 'b']),
        tenantId: 't-a',
      });
    });

    it('listAddOns scopes by tenant', async () => {
      addOnRepository.find.mockResolvedValue([]);
      await service.listAddOns('t-a');
      expect(addOnRepository.find).toHaveBeenCalledWith({
        where: { tenantId: 't-a' },
      });
    });

    it.each([
      ['getAddOnsByIds', () => service.getAddOnsByIds(['a'], null)],
      ['getAddOnsByIds (empty ids)', () => service.getAddOnsByIds([], 't-a')],
      ['listAddOns', () => service.listAddOns(null)],
    ])('%s fails closed without a repository query', async (_label, call) => {
      await expect(call()).resolves.toEqual([]);
      expect(addOnRepository.findBy).not.toHaveBeenCalled();
      expect(addOnRepository.find).not.toHaveBeenCalled();
    });

    it('createAddOn persists the tenant, pre-checks the name within it, and tags the audit event', async () => {
      await service.createAddOn({
        actorId: 'u',
        tenantId: 't-a',
        name: 'Fridge',
        priceMinorUnits: 500,
      });
      expect(manager.create).toHaveBeenCalledWith(
        AddOnEntity,
        expect.objectContaining({ tenantId: 't-a' }),
      );
      expect(nameQueryBuilder.andWhere).toHaveBeenCalledWith(
        'a.tenantId = :tenantId',
        { tenantId: 't-a' },
      );
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'add_on.create',
          scope: AdminScope.TENANT,
          tenantId: 't-a',
        }),
      );
    });

    it('updateAddOn looks up and updates within the tenant and never writes tenantId', async () => {
      manager.findOneBy.mockResolvedValueOnce({
        id: 'ao-1',
        tenantId: 't-a',
        name: 'Fridge',
        priceMinorUnits: 500,
      });
      manager.findOneByOrFail.mockResolvedValueOnce({
        id: 'ao-1',
        tenantId: 't-a',
        name: 'Oven',
        priceMinorUnits: 500,
      });
      await service.updateAddOn('ao-1', {
        actorId: 'u',
        tenantId: 't-a',
        name: 'Oven',
      });
      expect(manager.findOneBy).toHaveBeenCalledWith(AddOnEntity, {
        id: 'ao-1',
        tenantId: 't-a',
      });
      const [, where, set] = manager.update.mock.calls[0] as [
        unknown,
        object,
        Record<string, unknown>,
      ];
      expect(where).toEqual({ id: 'ao-1', tenantId: 't-a' });
      expect(set).not.toHaveProperty('tenantId');
      expect(set).not.toHaveProperty('actorId');
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'add_on.update',
          scope: AdminScope.TENANT,
          tenantId: 't-a',
        }),
      );
    });

    it('updateAddOn on another tenant’s add-on is NotFound with no write', async () => {
      manager.findOneBy.mockResolvedValueOnce(null);
      await expect(
        service.updateAddOn('ao-foreign', {
          actorId: 'u',
          tenantId: 't-b',
          name: 'X',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(manager.update).not.toHaveBeenCalled();
    });

    it('maps uq_add_on_tenant_name_lower to Conflict and rethrows other unique violations', async () => {
      manager.save.mockRejectedValueOnce({
        code: '23505',
        driverError: { constraint: 'uq_add_on_tenant_name_lower' },
      });
      await expect(
        service.createAddOn({
          actorId: 'u',
          tenantId: 't-a',
          name: 'Fridge',
          priceMinorUnits: 500,
        }),
      ).rejects.toThrow(new ConflictException('Add-on name is already in use'));

      const other = {
        code: '23505',
        driverError: { constraint: 'uq_add_on_id_tenant' },
      };
      manager.save.mockRejectedValueOnce(other);
      await expect(
        service.createAddOn({
          actorId: 'u',
          tenantId: 't-a',
          name: 'Fridge',
          priceMinorUnits: 500,
        }),
      ).rejects.toBe(other);
    });
  });
});
