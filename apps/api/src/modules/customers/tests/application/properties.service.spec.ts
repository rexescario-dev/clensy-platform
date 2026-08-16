import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import { PropertiesService } from '../../application/services/properties.service';
import { PropertyEntity } from '../../infrastructure/persistence/property.entity';
import { CustomerEntity } from '../../infrastructure/persistence/customer.entity';

// Mocked `Repository`/`DataSource` unit tests (test level 1, spec §7) —
// mirrors `customers.service.spec.ts` exactly. `PropertiesService.create`/
// `.update` open their own transaction via `DataSource.transaction`; the
// mock `manager` stands in for the transaction's `EntityManager`. This
// level proves not-found/validation/read-path logic only — it cannot and
// does not attempt to prove real transactional rollback (that's the
// level-2, real-Postgres file's job).
describe('PropertiesService', () => {
  let service: PropertiesService;
  let manager: {
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let propertyRepository: {
    findOneBy: jest.Mock;
    findBy: jest.Mock;
  };
  let customerRepository: {
    findOneBy: jest.Mock;
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
      findOneBy: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn((cb: (manager: unknown) => unknown) => cb(manager)),
    };
    propertyRepository = {
      findOneBy: jest.fn(),
      findBy: jest.fn(),
    };
    customerRepository = {
      findOneBy: jest.fn(),
    };
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PropertiesService,
        { provide: DataSource, useValue: dataSource },
        {
          provide: getRepositoryToken(PropertyEntity),
          useValue: propertyRepository,
        },
        {
          provide: getRepositoryToken(CustomerEntity),
          useValue: customerRepository,
        },
        { provide: AUDIT_LOGGER, useValue: auditLogger },
      ],
    }).compile();

    service = module.get<PropertiesService>(PropertiesService);
  });

  const validCreateCommand = {
    actorId: 'actor-1',
    customerId: 'customer-1',
    label: 'Home',
    addressLine1: '123 Main St',
    city: 'Springfield',
    region: 'IL',
    postalCode: '62704',
  };

  const existingProperty = {
    id: 'property-1',
    customerId: 'customer-1',
    label: 'Home',
    addressLine1: '123 Main St',
    addressLine2: null,
    city: 'Springfield',
    region: 'IL',
    postalCode: '62704',
    accessNotes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('create', () => {
    it('throws NotFoundException when customerId does not reference an existing customer', async () => {
      manager.findOneBy.mockResolvedValue(null);

      await expect(service.create(validCreateCommand)).rejects.toThrow(
        NotFoundException,
      );

      expect(manager.save).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('throws NotFoundException for a nonexistent id', async () => {
      manager.findOneBy.mockResolvedValue(null);

      await expect(
        service.update('missing-id', { actorId: 'actor-1', label: 'New' }),
      ).rejects.toThrow(NotFoundException);

      expect(manager.save).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });

    // Regression-style test mirroring CustomersService.update's fix:
    // `command.actorId` is required by `UpdatePropertyCommand` (needed for
    // the audit call) but is not a `Property` field, so it must not leak
    // onto the returned entity.
    it('does not leak actorId from the command onto the returned entity', async () => {
      manager.findOneBy.mockResolvedValue({ ...existingProperty });

      const result = await service.update('property-1', {
        actorId: 'actor-1',
        label: 'Updated Label',
      });

      expect(result).not.toHaveProperty('actorId');
    });
  });

  describe('assertValid via create', () => {
    it.each([
      ['label', { label: '   ' }],
      ['addressLine1', { addressLine1: '' }],
      ['city', { city: '   ' }],
      ['region', { region: '' }],
      ['postalCode', { postalCode: '   ' }],
    ])(
      'throws BadRequestException before any repository call when %s is empty/whitespace-only',
      async (_field, override) => {
        manager.findOneBy.mockResolvedValue({ id: 'customer-1' });

        await expect(
          service.create({
            ...validCreateCommand,
            ...override,
          }),
        ).rejects.toThrow(BadRequestException);

        expect(manager.save).not.toHaveBeenCalled();
        expect(auditLogger.log).not.toHaveBeenCalled();
      },
    );
  });

  describe('assertValid via update', () => {
    it.each([
      ['label', { label: '   ' }],
      ['addressLine1', { addressLine1: '' }],
      ['city', { city: '   ' }],
      ['region', { region: '' }],
      ['postalCode', { postalCode: '   ' }],
    ])(
      'throws BadRequestException before any repository call when %s becomes empty/whitespace-only',
      async (_field, override) => {
        manager.findOneBy.mockResolvedValue({ ...existingProperty });

        await expect(
          service.update('property-1', { actorId: 'actor-1', ...override }),
        ).rejects.toThrow(BadRequestException);

        expect(manager.save).not.toHaveBeenCalled();
        expect(auditLogger.log).not.toHaveBeenCalled();
      },
    );
  });

  describe('getProperty', () => {
    it('returns the property for an existing id', async () => {
      propertyRepository.findOneBy.mockResolvedValue(existingProperty);

      await expect(service.getProperty('property-1')).resolves.toEqual(
        existingProperty,
      );
      expect(propertyRepository.findOneBy).toHaveBeenCalledWith({
        id: 'property-1',
      });
    });

    it('returns null for a nonexistent id', async () => {
      propertyRepository.findOneBy.mockResolvedValue(null);

      await expect(service.getProperty('missing-id')).resolves.toBeNull();
    });
  });

  describe('listCustomerProperties', () => {
    it('throws NotFoundException when customerId does not exist', async () => {
      customerRepository.findOneBy.mockResolvedValue(undefined);

      await expect(
        service.listCustomerProperties('missing-customer'),
      ).rejects.toThrow(NotFoundException);

      expect(propertyRepository.findBy).not.toHaveBeenCalled();
    });

    it('returns the properties for an existing customer', async () => {
      customerRepository.findOneBy.mockResolvedValue({ id: 'customer-1' });
      propertyRepository.findBy.mockResolvedValue([existingProperty]);

      await expect(
        service.listCustomerProperties('customer-1'),
      ).resolves.toEqual([existingProperty]);
      expect(propertyRepository.findBy).toHaveBeenCalledWith({
        customerId: 'customer-1',
      });
    });
  });
});
