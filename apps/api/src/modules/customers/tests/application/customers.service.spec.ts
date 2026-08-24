import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import { CustomersService } from '../../application/services/customers.service';
import { CustomerEntity } from '../../infrastructure/persistence/customer.entity';

// Mocked `Repository`/`DataSource` unit tests (test level 1, spec §7):
// `CustomersService.create`/`.update` open their own transaction via
// `DataSource.transaction`, unlike `BookingsService`. The mock `manager`
// stands in for the transaction's `EntityManager`; `dataSource.transaction`
// just invokes the callback with it synchronously, same as a real
// transaction would from the caller's perspective. This level proves
// not-found/validation/read-path logic only — it cannot and does not
// attempt to prove real transactional rollback (that's the level-2,
// real-Postgres file's job).
describe('CustomersService', () => {
  let service: CustomersService;
  let manager: {
    create: jest.Mock;
    save: jest.Mock;
    findOneBy: jest.Mock;
  };
  let dataSource: { transaction: jest.Mock };
  let customerRepository: {
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
      findOneBy: jest.fn(),
    };
    dataSource = {
      transaction: jest.fn((cb: (manager: unknown) => unknown) => cb(manager)),
    };
    customerRepository = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      findBy: jest.fn(),
    };
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersService,
        { provide: DataSource, useValue: dataSource },
        {
          provide: getRepositoryToken(CustomerEntity),
          useValue: customerRepository,
        },
        { provide: AUDIT_LOGGER, useValue: auditLogger },
      ],
    }).compile();

    service = module.get<CustomersService>(CustomersService);
  });

  describe('update', () => {
    it('throws NotFoundException for a nonexistent id', async () => {
      manager.findOneBy.mockResolvedValue(null);

      await expect(
        service.update('missing-id', { actorId: 'actor-1', phone: '555' }),
      ).rejects.toThrow(NotFoundException);

      expect(manager.save).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });

    // Regression test: `command.actorId` is required by `UpdateCustomerCommand`
    // (needed for the audit call) but is not a `Customer` field. An earlier
    // version of `update()` did `Object.assign(entity, command)` with the
    // full command object, which leaked a stray `actorId` property onto the
    // returned entity.
    it('does not leak actorId from the command onto the returned entity', async () => {
      manager.findOneBy.mockResolvedValue({
        id: 'customer-1',
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '555-0100',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.update('customer-1', {
        actorId: 'actor-1',
        phone: '555-9999',
      });

      expect(result).not.toHaveProperty('actorId');
    });
  });

  describe('assertValid via create', () => {
    it.each([
      ['fullName', { fullName: '   ' }],
      ['email', { email: '' }],
      ['phone', { phone: '   ' }],
    ])(
      'throws BadRequestException before any repository call when %s is empty/whitespace-only',
      async (_field, override) => {
        await expect(
          service.create({
            actorId: 'actor-1',
            fullName: 'Jane Doe',
            email: 'jane@example.com',
            phone: '555-0100',
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
      ['fullName', { fullName: '   ' }],
      ['email', { email: '' }],
      ['phone', { phone: '   ' }],
    ])(
      'throws BadRequestException before any repository call when %s becomes empty/whitespace-only',
      async (_field, override) => {
        manager.findOneBy.mockResolvedValue({
          id: 'customer-1',
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          phone: '555-0100',
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await expect(
          service.update('customer-1', { actorId: 'actor-1', ...override }),
        ).rejects.toThrow(BadRequestException);

        expect(manager.save).not.toHaveBeenCalled();
        expect(auditLogger.log).not.toHaveBeenCalled();
      },
    );
  });

  describe('getCustomer', () => {
    it('returns the customer for an existing id', async () => {
      const customer = {
        id: 'customer-1',
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '555-0100',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      customerRepository.findOneBy.mockResolvedValue(customer);

      await expect(service.getCustomer('customer-1')).resolves.toEqual(
        customer,
      );
      expect(customerRepository.findOneBy).toHaveBeenCalledWith({
        id: 'customer-1',
      });
    });

    it('returns null for a nonexistent id', async () => {
      customerRepository.findOneBy.mockResolvedValue(null);

      await expect(service.getCustomer('missing-id')).resolves.toBeNull();
    });
  });

  describe('listCustomers', () => {
    it('returns all customers', async () => {
      const customers = [
        {
          id: 'customer-1',
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          phone: '555-0100',
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      customerRepository.find.mockResolvedValue(customers);

      await expect(service.listCustomers()).resolves.toEqual(customers);
    });

    it('returns an empty array when none exist', async () => {
      customerRepository.find.mockResolvedValue([]);

      await expect(service.listCustomers()).resolves.toEqual([]);
    });
  });

  describe('getCustomersByIds', () => {
    it('returns exactly the rows found, with no synthetic entries for missing ids', async () => {
      const customers = [
        {
          id: 'customer-1',
          fullName: 'Jane Doe',
          email: 'jane@example.com',
          phone: '555-0100',
          notes: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      customerRepository.findBy.mockResolvedValue(customers);

      await expect(
        service.getCustomersByIds(['customer-1', 'customer-2']),
      ).resolves.toEqual(customers);
    });

    it('returns an empty array without querying when ids is empty', async () => {
      await expect(service.getCustomersByIds([])).resolves.toEqual([]);
      expect(customerRepository.findBy).not.toHaveBeenCalled();
    });
  });
});
