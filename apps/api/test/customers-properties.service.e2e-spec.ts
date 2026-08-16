import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { CustomersService } from '../src/modules/customers/application/services/customers.service';
import { PropertiesService } from '../src/modules/customers/application/services/properties.service';
import { CustomerEntity } from '../src/modules/customers/infrastructure/persistence/customer.entity';
import { PropertyEntity } from '../src/modules/customers/infrastructure/persistence/property.entity';
import {
  acquireCustomerDbTestLock,
  CustomerDbTestLock,
} from './helpers/customer-db-test-lock';

// Real Postgres, single connection — NOT mocked repositories. The
// transactional-rollback assertions below ("the row does not exist
// afterward") are an actual transactional guarantee: a mock can only prove
// "we called manager.save then it threw," never that persistence didn't
// happen. Only the `AuditLogger` boundary is faked (so failures can be
// injected on demand); the DB write path is real. Points at the same local
// docker-compose Postgres the rest of the suite/e2e tests use (`apps/api`'s
// gitignored `.env`).
//
// Lives under `apps/api/test/` (the `pnpm test:e2e` path), not `src/`'s
// mocked/no-infra `pnpm test` path — this file opens a real `DataSource`
// and truncates real tables, which `pnpm test` must never do.
//
// Holds a Postgres advisory lock (see `./helpers/customer-db-test-lock.ts`)
// for the whole file's run so its truncate/seed steps never overlap with
// another spec file touching the same tables, regardless of how Jest
// schedules files across parallel workers.
//
describe('CustomersService (real Postgres)', () => {
  let dataSource: DataSource;
  let dbLock: CustomerDbTestLock;
  let auditLogger: { log: jest.Mock };
  let service: CustomersService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'clensy',
      password: process.env.DB_PASSWORD ?? 'clensy_dev',
      database: process.env.DB_NAME ?? 'clensy',
      entities: [CustomerEntity, PropertyEntity, AuditEventEntity],
    });
    await dataSource.initialize();
    dbLock = await acquireCustomerDbTestLock(dataSource);
  });

  afterAll(async () => {
    await dbLock.release();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    // `property_entity` now carries a real FK to `customer_entity`
    // (this task's `AddProperty` migration), so a plain single-table
    // `TRUNCATE customer_entity` (what `Repository.clear()` issues) always
    // fails with "cannot truncate a table referenced in a foreign key
    // constraint" — regardless of table emptiness or clear-call order.
    // Postgres requires either both tables in the same TRUNCATE statement
    // or CASCADE; a raw multi-table TRUNCATE is used here instead of two
    // `.clear()` calls. `audit_event_entity` is deliberately NOT truncated
    // here — this file fakes `auditLogger` as `{ log: jest.fn() }` and never
    // reads a real `AuditEventEntity` row, so truncating it would only widen
    // this file's blast radius onto other spec files' audit-row assertions
    // for no benefit.
    await dataSource.query(
      'TRUNCATE TABLE "property_entity", "customer_entity"',
    );
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };
    service = new CustomersService(
      dataSource,
      dataSource.getRepository(CustomerEntity),
      auditLogger,
    );
  });

  const seedCustomer = async (overrides?: Partial<CustomerEntity>) => {
    const repo = dataSource.getRepository(CustomerEntity);
    return repo.save(
      repo.create({
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '555-0100',
        notes: 'Gate code 1234',
        ...overrides,
      }),
    );
  };

  describe('create', () => {
    it('persists a CustomerEntity with the given fields, notes defaulting to null when omitted, and records customer.create', async () => {
      const created = await service.create({
        actorId: 'actor-1',
        fullName: 'John Smith',
        email: 'john@example.com',
        phone: '555-0200',
      });

      expect(created.notes).toBeNull();

      const row = await dataSource
        .getRepository(CustomerEntity)
        .findOneBy({ id: created.id });
      expect(row).not.toBeNull();
      expect(row?.fullName).toBe('John Smith');
      expect(row?.email).toBe('john@example.com');
      expect(row?.phone).toBe('555-0200');
      expect(row?.notes).toBeNull();

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'actor-1',
          action: 'customer.create',
          entityType: 'customer',
          entityId: created.id,
        }),
      );
    });

    it('rolls back the CustomerEntity row when the audit write fails inside the transaction', async () => {
      auditLogger.log.mockRejectedValueOnce(new Error('audit down'));

      await expect(
        service.create({
          actorId: 'actor-1',
          fullName: 'Rollback Case',
          email: 'rollback@example.com',
          phone: '555-0300',
        }),
      ).rejects.toThrow('audit down');

      const row = await dataSource
        .getRepository(CustomerEntity)
        .findOneBy({ email: 'rollback@example.com' });
      expect(row).toBeNull();
    });
  });

  describe('update', () => {
    it('updates only the provided field, leaving the others unchanged in the re-read row', async () => {
      const existing = await seedCustomer();

      await service.update(existing.id, {
        actorId: 'actor-1',
        phone: '555-9999',
      });

      const row = await dataSource
        .getRepository(CustomerEntity)
        .findOneBy({ id: existing.id });
      expect(row?.phone).toBe('555-9999');
      expect(row?.fullName).toBe('Jane Doe');
      expect(row?.email).toBe('jane@example.com');
      expect(row?.notes).toBe('Gate code 1234');
    });

    it('explicitly clears notes to null when the command sets notes: null', async () => {
      const existing = await seedCustomer({ notes: 'Some existing note' });

      await service.update(existing.id, {
        actorId: 'actor-1',
        notes: null,
      });

      const row = await dataSource
        .getRepository(CustomerEntity)
        .findOneBy({ id: existing.id });
      expect(row?.notes).toBeNull();
    });

    it('rolls back the update when the audit write fails inside the transaction', async () => {
      const existing = await seedCustomer();
      auditLogger.log.mockRejectedValueOnce(new Error('audit down'));

      await expect(
        service.update(existing.id, {
          actorId: 'actor-1',
          phone: '555-0000',
        }),
      ).rejects.toThrow('audit down');

      const row = await dataSource
        .getRepository(CustomerEntity)
        .findOneBy({ id: existing.id });
      expect(row?.phone).toBe('555-0100');
    });
  });
});

describe('PropertiesService (real Postgres)', () => {
  let dataSource: DataSource;
  let dbLock: CustomerDbTestLock;
  let auditLogger: { log: jest.Mock };
  let service: PropertiesService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'clensy',
      password: process.env.DB_PASSWORD ?? 'clensy_dev',
      database: process.env.DB_NAME ?? 'clensy',
      entities: [CustomerEntity, PropertyEntity, AuditEventEntity],
    });
    await dataSource.initialize();
    dbLock = await acquireCustomerDbTestLock(dataSource);
  });

  afterAll(async () => {
    await dbLock.release();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    // See the identical comment in the `CustomersService` describe block
    // above — plain single-table TRUNCATE on either table fails now that
    // `property_entity` carries a real FK to `customer_entity`, and
    // `audit_event_entity` is deliberately NOT truncated here for the same
    // reason (this file never reads a real `AuditEventEntity` row).
    await dataSource.query(
      'TRUNCATE TABLE "property_entity", "customer_entity"',
    );
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };
    service = new PropertiesService(
      dataSource,
      dataSource.getRepository(PropertyEntity),
      dataSource.getRepository(CustomerEntity),
      auditLogger,
    );
  });

  const seedCustomer = async (overrides?: Partial<CustomerEntity>) => {
    const repo = dataSource.getRepository(CustomerEntity);
    return repo.save(
      repo.create({
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '555-0100',
        notes: 'Gate code 1234',
        ...overrides,
      }),
    );
  };

  const seedProperty = async (
    customerId: string,
    overrides?: Partial<PropertyEntity>,
  ) => {
    const repo = dataSource.getRepository(PropertyEntity);
    return repo.save(
      repo.create({
        customerId,
        label: 'Home',
        addressLine1: '123 Main St',
        addressLine2: null,
        city: 'Springfield',
        region: 'IL',
        postalCode: '62704',
        accessNotes: 'Gate code 1234',
        ...overrides,
      }),
    );
  };

  describe('create', () => {
    it('persists a PropertyEntity referencing the given Customer and records property.create', async () => {
      const customer = await seedCustomer();

      const created = await service.create({
        actorId: 'actor-1',
        customerId: customer.id,
        label: 'Downtown Office',
        addressLine1: '456 Market St',
        city: 'Springfield',
        region: 'IL',
        postalCode: '62701',
      });

      expect(created.addressLine2).toBeNull();
      expect(created.accessNotes).toBeNull();

      const row = await dataSource
        .getRepository(PropertyEntity)
        .findOneBy({ id: created.id });
      expect(row).not.toBeNull();
      expect(row?.customerId).toBe(customer.id);
      expect(row?.label).toBe('Downtown Office');
      expect(row?.addressLine1).toBe('456 Market St');
      expect(row?.city).toBe('Springfield');
      expect(row?.region).toBe('IL');
      expect(row?.postalCode).toBe('62701');

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'actor-1',
          action: 'property.create',
          entityType: 'property',
          entityId: created.id,
        }),
      );
    });

    it('throws NotFoundException and persists no row for a nonexistent customerId', async () => {
      await expect(
        service.create({
          actorId: 'actor-1',
          customerId: '00000000-0000-0000-0000-000000000000',
          label: 'Home',
          addressLine1: '123 Main St',
          city: 'Springfield',
          region: 'IL',
          postalCode: '62704',
        }),
      ).rejects.toThrow(NotFoundException);

      const rows = await dataSource.getRepository(PropertyEntity).find();
      expect(rows).toHaveLength(0);
    });

    it('rolls back the PropertyEntity row when the audit write fails inside the transaction', async () => {
      const customer = await seedCustomer();
      auditLogger.log.mockRejectedValueOnce(new Error('audit down'));

      await expect(
        service.create({
          actorId: 'actor-1',
          customerId: customer.id,
          label: 'Rollback Case',
          addressLine1: '789 Rollback Ave',
          city: 'Springfield',
          region: 'IL',
          postalCode: '62704',
        }),
      ).rejects.toThrow('audit down');

      const row = await dataSource
        .getRepository(PropertyEntity)
        .findOneBy({ label: 'Rollback Case' });
      expect(row).toBeNull();
    });
  });

  describe('update', () => {
    it('updates only the provided field, leaving the others unchanged in the re-read row', async () => {
      const customer = await seedCustomer();
      const existing = await seedProperty(customer.id);

      await service.update(existing.id, {
        actorId: 'actor-1',
        label: 'Updated Label',
      });

      const row = await dataSource
        .getRepository(PropertyEntity)
        .findOneBy({ id: existing.id });
      expect(row?.label).toBe('Updated Label');
      expect(row?.addressLine1).toBe('123 Main St');
      expect(row?.city).toBe('Springfield');
      expect(row?.region).toBe('IL');
      expect(row?.postalCode).toBe('62704');
      expect(row?.accessNotes).toBe('Gate code 1234');
    });

    it('explicitly clears accessNotes to null when the command sets accessNotes: null', async () => {
      const customer = await seedCustomer();
      const existing = await seedProperty(customer.id, {
        accessNotes: 'Some existing note',
      });

      await service.update(existing.id, {
        actorId: 'actor-1',
        accessNotes: null,
      });

      const row = await dataSource
        .getRepository(PropertyEntity)
        .findOneBy({ id: existing.id });
      expect(row?.accessNotes).toBeNull();
    });

    it('rolls back the update when the audit write fails inside the transaction', async () => {
      const customer = await seedCustomer();
      const existing = await seedProperty(customer.id);
      auditLogger.log.mockRejectedValueOnce(new Error('audit down'));

      await expect(
        service.update(existing.id, {
          actorId: 'actor-1',
          label: 'Should Not Persist',
        }),
      ).rejects.toThrow('audit down');

      const row = await dataSource
        .getRepository(PropertyEntity)
        .findOneBy({ id: existing.id });
      expect(row?.label).toBe('Home');
    });
  });

  describe('listCustomerProperties', () => {
    it('returns both properties for a customer with two persisted properties', async () => {
      const customer = await seedCustomer();
      const first = await seedProperty(customer.id, { label: 'Home' });
      const second = await seedProperty(customer.id, {
        label: 'Downtown Office',
      });

      const result = await service.listCustomerProperties(customer.id);

      expect(result).toHaveLength(2);
      expect(result.map((p) => p.id).sort()).toEqual(
        [first.id, second.id].sort(),
      );
    });

    it('returns an empty array for a customer with zero persisted properties', async () => {
      const customer = await seedCustomer();

      await expect(
        service.listCustomerProperties(customer.id),
      ).resolves.toEqual([]);
    });

    it('throws NotFoundException for a nonexistent customerId', async () => {
      await expect(
        service.listCustomerProperties('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
