import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
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
      findOneBy: jest.fn(),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    };
    dataSource = {
      transaction: jest.fn((cb: (manager: unknown) => unknown) => cb(manager)),
    };
    propertyRepository = {
      findBy: jest.fn(),
      findOneBy: jest.fn(),
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
    tenantId: 't-a',
    addressLine1: '123 Main St',
    city: 'Springfield',
    label: 'Home',
    postalCode: '62704',
    region: 'IL',
  };

  const existingProperty = {
    id: 'property-1',
    customerId: 'customer-1',
    tenantId: 't-a',
    accessNotes: null,
    addressLine1: '123 Main St',
    addressLine2: null,
    city: 'Springfield',
    createdAt: new Date(),
    label: 'Home',
    postalCode: '62704',
    region: 'IL',
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

    // Regression guard for the property→customer same-tenant invariant
    // (spec §4.4): the customer lookup must scope by tenantId in the same
    // where clause as id, not just id — otherwise a customer belonging to
    // another tenant would be found and treated as valid.
    it('looks up the customer scoped by customerId and tenantId', async () => {
      manager.findOneBy.mockResolvedValue({ id: 'customer-1' });

      await service.create(validCreateCommand);

      expect(manager.findOneBy).toHaveBeenCalledWith(CustomerEntity, {
        id: 'customer-1',
        tenantId: 't-a',
      });
    });

    it('persists tenantId from the command', async () => {
      manager.findOneBy.mockResolvedValue({ id: 'customer-1' });

      const result = await service.create(validCreateCommand);

      expect(result).toMatchObject({ tenantId: 't-a' });
      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't-a' }),
      );
    });

    it('audits property.create with tenant scope and tenantId', async () => {
      manager.findOneBy.mockResolvedValue({ id: 'customer-1' });

      const result = await service.create(validCreateCommand);

      expect(auditLogger.log).toHaveBeenCalledWith({
        actorId: 'actor-1',
        entityId: result.id,
        tenantId: 't-a',
        action: 'property.create',
        entityType: 'property',
        scope: AdminScope.TENANT,
      });
    });
  });

  describe('update', () => {
    it('throws NotFoundException for a nonexistent id', async () => {
      manager.findOneBy.mockResolvedValue(null);

      await expect(
        service.update('missing-id', {
          actorId: 'actor-1',
          tenantId: 't-a',
          label: 'New',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(manager.save).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });

    it('looks up the entity scoped by id and tenantId', async () => {
      manager.findOneBy.mockResolvedValue({ ...existingProperty });

      await service.update('property-1', {
        actorId: 'actor-1',
        tenantId: 't-a',
        label: 'Updated Label',
      });

      expect(manager.findOneBy).toHaveBeenCalledWith(PropertyEntity, {
        id: 'property-1',
        tenantId: 't-a',
      });
    });

    // Regression-style test mirroring CustomersService.update's fix:
    // `command.actorId` is required by `UpdatePropertyCommand` (needed for
    // the audit call) but is not a `Property` field, so it must not leak
    // onto the returned entity.
    it('does not leak actorId from the command onto the returned entity', async () => {
      manager.findOneBy.mockResolvedValue({ ...existingProperty });

      const result = await service.update('property-1', {
        actorId: 'actor-1',
        tenantId: 't-a',
        label: 'Updated Label',
      });

      expect(result).not.toHaveProperty('actorId');
    });

    // `tenantId` is server-owned (multi-tenant spec invariant 1) — never a
    // writable input field. The command's `tenantId` is used only to scope
    // the `findOneBy` lookup above; it must not be `Object.assign`-ed onto
    // the entity, which would make it a de facto writable field. The mocked
    // entity's `tenantId` ('t-old') deliberately differs from the command's
    // ('t-a') — `manager.findOneBy` is mocked and returns the entity
    // regardless of its where-clause, so this is the only way this
    // mocked-manager unit test can distinguish "destructured out, entity
    // untouched" from the regression it guards against (in a real DB the two
    // would always match, since the lookup itself is scoped by
    // `command.tenantId`).
    it('does not overwrite the entity tenantId from the command', async () => {
      manager.findOneBy.mockResolvedValue({
        ...existingProperty,
        tenantId: 't-old',
      });

      const result = await service.update('property-1', {
        actorId: 'actor-1',
        tenantId: 't-a',
        label: 'Updated Label',
      });

      expect(result.tenantId).toBe('t-old');
      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't-old' }),
      );
    });

    it('audits property.update with tenant scope and tenantId', async () => {
      manager.findOneBy.mockResolvedValue({ ...existingProperty });

      await service.update('property-1', {
        actorId: 'actor-1',
        tenantId: 't-a',
        label: 'Updated Label',
      });

      expect(auditLogger.log).toHaveBeenCalledWith({
        actorId: 'actor-1',
        entityId: 'property-1',
        tenantId: 't-a',
        action: 'property.update',
        entityType: 'property',
        scope: AdminScope.TENANT,
      });
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
          service.update('property-1', {
            actorId: 'actor-1',
            tenantId: 't-a',
            ...override,
          }),
        ).rejects.toThrow(BadRequestException);

        expect(manager.save).not.toHaveBeenCalled();
        expect(auditLogger.log).not.toHaveBeenCalled();
      },
    );
  });

  describe('getProperty', () => {
    it('calls findOneBy scoped to id and tenantId for an existing id', async () => {
      propertyRepository.findOneBy.mockResolvedValue(existingProperty);

      await expect(service.getProperty('property-1', 't-a')).resolves.toEqual(
        existingProperty,
      );
      expect(propertyRepository.findOneBy).toHaveBeenCalledWith({
        id: 'property-1',
        tenantId: 't-a',
      });
    });

    it('returns null for a nonexistent id', async () => {
      propertyRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.getProperty('missing-id', 't-a'),
      ).resolves.toBeNull();
    });

    it('returns null without querying the repository when tenantId is null', async () => {
      await expect(service.getProperty('property-1', null)).resolves.toBeNull();
      expect(propertyRepository.findOneBy).not.toHaveBeenCalled();
    });
  });

  describe('listCustomerProperties', () => {
    it('throws NotFoundException when customerId does not exist', async () => {
      customerRepository.findOneBy.mockResolvedValue(undefined);

      await expect(
        service.listCustomerProperties('missing-customer', 't-a'),
      ).rejects.toThrow(NotFoundException);

      expect(propertyRepository.findBy).not.toHaveBeenCalled();
    });

    it('looks up the customer scoped by customerId and tenantId', async () => {
      customerRepository.findOneBy.mockResolvedValue({ id: 'customer-1' });
      propertyRepository.findBy.mockResolvedValue([existingProperty]);

      await service.listCustomerProperties('customer-1', 't-a');

      expect(customerRepository.findOneBy).toHaveBeenCalledWith({
        id: 'customer-1',
        tenantId: 't-a',
      });
    });

    it('returns the properties for an existing customer', async () => {
      customerRepository.findOneBy.mockResolvedValue({ id: 'customer-1' });
      propertyRepository.findBy.mockResolvedValue([existingProperty]);

      await expect(
        service.listCustomerProperties('customer-1', 't-a'),
      ).resolves.toEqual([existingProperty]);
      expect(propertyRepository.findBy).toHaveBeenCalledWith({
        customerId: 'customer-1',
        tenantId: 't-a',
      });
    });

    it('throws NotFoundException without querying either repository when tenantId is null', async () => {
      await expect(
        service.listCustomerProperties('customer-1', null),
      ).rejects.toThrow(NotFoundException);

      expect(customerRepository.findOneBy).not.toHaveBeenCalled();
      expect(propertyRepository.findBy).not.toHaveBeenCalled();
    });
  });

  describe('getPropertiesByIds', () => {
    it('puts tenantId in the same where clause as id: In(ids)', async () => {
      propertyRepository.findBy.mockResolvedValue([existingProperty]);

      await expect(
        service.getPropertiesByIds(['property-1', 'property-2'], 't-a'),
      ).resolves.toEqual([existingProperty]);
      expect(propertyRepository.findBy).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't-a' }),
      );
    });

    it('returns an empty array without querying when ids is empty', async () => {
      await expect(service.getPropertiesByIds([], 't-a')).resolves.toEqual([]);
      expect(propertyRepository.findBy).not.toHaveBeenCalled();
    });

    it('returns an empty array without querying the repository when tenantId is null', async () => {
      await expect(
        service.getPropertiesByIds(['property-1'], null),
      ).resolves.toEqual([]);
      expect(propertyRepository.findBy).not.toHaveBeenCalled();
    });
  });
});
