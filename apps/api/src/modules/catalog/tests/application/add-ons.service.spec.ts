import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import { AddOnsService } from '../../application/services/add-ons.service';
import { AddOnEntity } from '../../infrastructure/persistence/add-on.entity';

// Mocked `Repository`/`DataSource` unit tests (test level 1, spec §7) —
// structurally identical to `services.service.spec.ts`; see that file's
// header comment for the full rationale this file shares (this level proves
// validation/read-path/existence-check logic only, not real transactional
// rollback or unique-violation translation — that's `catalog.service.e2e-spec.ts`'s
// job).
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
    addOnRepository = {
      find: jest.fn(),
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
          service.createAddOn({ actorId: 'actor-1', ...fields }),
        ).rejects.toThrow(BadRequestException);

        expect(manager.save).not.toHaveBeenCalled();
        expect(auditLogger.log).not.toHaveBeenCalled();
      },
    );
  });

  describe('updateAddOn', () => {
    it('throws NotFoundException for a nonexistent id', async () => {
      manager.findOneBy.mockResolvedValue(null);

      await expect(
        service.updateAddOn('missing-id', {
          actorId: 'actor-1',
          name: 'New Name',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(manager.update).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });
  });

  describe('listAddOns', () => {
    it('returns all add-ons including inactive ones', async () => {
      const addOns = [
        {
          id: 'add-on-1',
          name: 'Extra Towels',
          description: null,
          priceMinorUnits: 500,
          active: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'add-on-2',
          name: 'Pet Hair Removal',
          description: null,
          priceMinorUnits: 1500,
          active: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      addOnRepository.find.mockResolvedValue(addOns);

      await expect(service.listAddOns()).resolves.toEqual(addOns);
      expect(addOnRepository.find).toHaveBeenCalledWith();
    });

    it('returns an empty array when none exist', async () => {
      addOnRepository.find.mockResolvedValue([]);

      await expect(service.listAddOns()).resolves.toEqual([]);
    });
  });
});
