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
      findOneBy: jest.fn(),
      save: jest.fn((entity: unknown) => Promise.resolve(entity)),
    };
    dataSource = {
      transaction: jest.fn((cb: (manager: unknown) => unknown) => cb(manager)),
    };
    customerRepository = {
      find: jest.fn(),
      findBy: jest.fn(),
      findOneBy: jest.fn(),
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

  describe('create', () => {
    it('persists tenantId from the command', async () => {
      const result = await service.create({
        actorId: 'actor-1',
        tenantId: 't-a',
        email: 'jane@example.com',
        fullName: 'Jane Doe',
        phone: '555-0100',
      });

      expect(result).toMatchObject({ tenantId: 't-a' });
      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't-a' }),
      );
    });

    it('audits customer.create with tenant scope and tenantId', async () => {
      const result = await service.create({
        actorId: 'actor-1',
        tenantId: 't-a',
        email: 'jane@example.com',
        fullName: 'Jane Doe',
        phone: '555-0100',
      });

      expect(auditLogger.log).toHaveBeenCalledWith({
        actorId: 'actor-1',
        entityId: result.id,
        tenantId: 't-a',
        action: 'customer.create',
        entityType: 'customer',
        scope: AdminScope.TENANT,
      });
    });

    it('translates a uq_customer_tenant_email violation into ConflictException', async () => {
      manager.save.mockRejectedValue(
        Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: 'uq_customer_tenant_email',
        }),
      );

      await expect(
        service.create({
          actorId: 'actor-1',
          tenantId: 't-a',
          email: 'jane@example.com',
          fullName: 'Jane Doe',
          phone: '555-0100',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('translates a unique violation reported via driverError.constraint', async () => {
      manager.save.mockRejectedValue({
        code: '23505',
        driverError: { constraint: 'uq_customer_tenant_email' },
      });

      await expect(
        service.create({
          actorId: 'actor-1',
          tenantId: 't-a',
          email: 'jane@example.com',
          fullName: 'Jane Doe',
          phone: '555-0100',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('translates a unique violation with no constraint name at all (code-only fallback)', async () => {
      manager.save.mockRejectedValue({ code: '23505' });

      await expect(
        service.create({
          actorId: 'actor-1',
          tenantId: 't-a',
          email: 'jane@example.com',
          fullName: 'Jane Doe',
          phone: '555-0100',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('rethrows a unique violation on an unrelated constraint unchanged', async () => {
      const error = Object.assign(new Error('duplicate key'), {
        code: '23505',
        constraint: 'some_other_constraint',
      });
      manager.save.mockRejectedValue(error);

      await expect(
        service.create({
          actorId: 'actor-1',
          tenantId: 't-a',
          email: 'jane@example.com',
          fullName: 'Jane Doe',
          phone: '555-0100',
        }),
      ).rejects.toBe(error);
    });

    it('rethrows a non-unique-violation error unchanged', async () => {
      const error = new Error('connection lost');
      manager.save.mockRejectedValue(error);

      await expect(
        service.create({
          actorId: 'actor-1',
          tenantId: 't-a',
          email: 'jane@example.com',
          fullName: 'Jane Doe',
          phone: '555-0100',
        }),
      ).rejects.toBe(error);
    });
  });

  describe('update', () => {
    it('throws NotFoundException for a nonexistent id', async () => {
      manager.findOneBy.mockResolvedValue(null);

      await expect(
        service.update('missing-id', {
          actorId: 'actor-1',
          tenantId: 't-a',
          phone: '555',
        }),
      ).rejects.toThrow(NotFoundException);

      expect(manager.save).not.toHaveBeenCalled();
      expect(auditLogger.log).not.toHaveBeenCalled();
    });

    it('looks up the entity scoped by id and tenantId', async () => {
      manager.findOneBy.mockResolvedValue({
        id: 'customer-1',
        tenantId: 't-a',
        createdAt: new Date(),
        email: 'jane@example.com',
        fullName: 'Jane Doe',
        notes: null,
        phone: '555-0100',
        updatedAt: new Date(),
      });

      await service.update('customer-1', {
        actorId: 'actor-1',
        tenantId: 't-a',
        phone: '555-9999',
      });

      expect(manager.findOneBy).toHaveBeenCalledWith(CustomerEntity, {
        id: 'customer-1',
        tenantId: 't-a',
      });
    });

    // Regression test: `command.actorId` is required by `UpdateCustomerCommand`
    // (needed for the audit call) but is not a `Customer` field. An earlier
    // version of `update()` did `Object.assign(entity, command)` with the
    // full command object, which leaked a stray `actorId` property onto the
    // returned entity.
    it('does not leak actorId from the command onto the returned entity', async () => {
      manager.findOneBy.mockResolvedValue({
        id: 'customer-1',
        tenantId: 't-a',
        createdAt: new Date(),
        email: 'jane@example.com',
        fullName: 'Jane Doe',
        notes: null,
        phone: '555-0100',
        updatedAt: new Date(),
      });

      const result = await service.update('customer-1', {
        actorId: 'actor-1',
        tenantId: 't-a',
        phone: '555-9999',
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
        id: 'customer-1',
        tenantId: 't-old',
        createdAt: new Date(),
        email: 'jane@example.com',
        fullName: 'Jane Doe',
        notes: null,
        phone: '555-0100',
        updatedAt: new Date(),
      });

      const result = await service.update('customer-1', {
        actorId: 'actor-1',
        tenantId: 't-a',
        phone: '555-9999',
      });

      expect(result.tenantId).toBe('t-old');
      expect(manager.save).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't-old' }),
      );
    });

    it('audits customer.update with tenant scope and tenantId', async () => {
      manager.findOneBy.mockResolvedValue({
        id: 'customer-1',
        tenantId: 't-a',
        createdAt: new Date(),
        email: 'jane@example.com',
        fullName: 'Jane Doe',
        notes: null,
        phone: '555-0100',
        updatedAt: new Date(),
      });

      await service.update('customer-1', {
        actorId: 'actor-1',
        tenantId: 't-a',
        phone: '555-9999',
      });

      expect(auditLogger.log).toHaveBeenCalledWith({
        actorId: 'actor-1',
        entityId: 'customer-1',
        tenantId: 't-a',
        action: 'customer.update',
        entityType: 'customer',
        scope: AdminScope.TENANT,
      });
    });

    it('translates a uq_customer_tenant_email violation into ConflictException', async () => {
      manager.findOneBy.mockResolvedValue({
        id: 'customer-1',
        tenantId: 't-a',
        createdAt: new Date(),
        email: 'jane@example.com',
        fullName: 'Jane Doe',
        notes: null,
        phone: '555-0100',
        updatedAt: new Date(),
      });
      manager.save.mockRejectedValue(
        Object.assign(new Error('duplicate key'), {
          code: '23505',
          constraint: 'uq_customer_tenant_email',
        }),
      );

      await expect(
        service.update('customer-1', {
          actorId: 'actor-1',
          tenantId: 't-a',
          email: 'jane@example.com',
        }),
      ).rejects.toThrow(ConflictException);
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
            tenantId: 't-a',
            email: 'jane@example.com',
            fullName: 'Jane Doe',
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
          tenantId: 't-a',
          createdAt: new Date(),
          email: 'jane@example.com',
          fullName: 'Jane Doe',
          notes: null,
          phone: '555-0100',
          updatedAt: new Date(),
        });

        await expect(
          service.update('customer-1', {
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

  describe('getCustomer', () => {
    it('calls findOneBy scoped to id and tenantId for an existing id', async () => {
      const customer = {
        id: 'customer-1',
        tenantId: 't-a',
        createdAt: new Date(),
        email: 'jane@example.com',
        fullName: 'Jane Doe',
        notes: null,
        phone: '555-0100',
        updatedAt: new Date(),
      };
      customerRepository.findOneBy.mockResolvedValue(customer);

      await expect(service.getCustomer('customer-1', 't-a')).resolves.toEqual(
        customer,
      );
      expect(customerRepository.findOneBy).toHaveBeenCalledWith({
        id: 'customer-1',
        tenantId: 't-a',
      });
    });

    it('returns null for a nonexistent id', async () => {
      customerRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.getCustomer('missing-id', 't-a'),
      ).resolves.toBeNull();
    });

    it('returns null without querying the repository when tenantId is null', async () => {
      await expect(service.getCustomer('customer-1', null)).resolves.toBeNull();
      expect(customerRepository.findOneBy).not.toHaveBeenCalled();
    });
  });

  describe('listCustomers', () => {
    it('calls find scoped to tenantId and returns all customers', async () => {
      const customers = [
        {
          id: 'customer-1',
          tenantId: 't-a',
          createdAt: new Date(),
          email: 'jane@example.com',
          fullName: 'Jane Doe',
          notes: null,
          phone: '555-0100',
          updatedAt: new Date(),
        },
      ];
      customerRepository.find.mockResolvedValue(customers);

      await expect(service.listCustomers('t-a')).resolves.toEqual(customers);
      expect(customerRepository.find).toHaveBeenCalledWith({
        where: { tenantId: 't-a' },
      });
    });

    it('returns an empty array when none exist', async () => {
      customerRepository.find.mockResolvedValue([]);

      await expect(service.listCustomers('t-a')).resolves.toEqual([]);
    });

    it('returns an empty array without querying the repository when tenantId is null', async () => {
      await expect(service.listCustomers(null)).resolves.toEqual([]);
      expect(customerRepository.find).not.toHaveBeenCalled();
    });
  });

  describe('getCustomersByIds', () => {
    it('puts tenantId in the same where clause as id: In(ids)', async () => {
      const customers = [
        {
          id: 'customer-1',
          tenantId: 't-b',
          createdAt: new Date(),
          email: 'jane@example.com',
          fullName: 'Jane Doe',
          notes: null,
          phone: '555-0100',
          updatedAt: new Date(),
        },
      ];
      customerRepository.findBy.mockResolvedValue(customers);

      await expect(
        service.getCustomersByIds(['customer-1', 'customer-2'], 't-b'),
      ).resolves.toEqual(customers);
      expect(customerRepository.findBy).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't-b' }),
      );
    });

    it('returns an empty array without querying when ids is empty', async () => {
      await expect(service.getCustomersByIds([], 't-a')).resolves.toEqual([]);
      expect(customerRepository.findBy).not.toHaveBeenCalled();
    });

    it('returns an empty array without querying the repository when tenantId is null', async () => {
      await expect(
        service.getCustomersByIds(['customer-1'], null),
      ).resolves.toEqual([]);
      expect(customerRepository.findBy).not.toHaveBeenCalled();
    });
  });
});
