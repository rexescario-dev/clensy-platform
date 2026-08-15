import { DataSource } from 'typeorm';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { CustomersService } from '../src/modules/customers/application/services/customers.service';
import { CustomerEntity } from '../src/modules/customers/infrastructure/persistence/customer.entity';
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
// Task 2 extends this file with a `Property`/`PropertiesService` describe
// block and adds `PropertyEntity` to the shared `beforeEach` `.clear()`.
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
      entities: [CustomerEntity, AuditEventEntity],
    });
    await dataSource.initialize();
    dbLock = await acquireCustomerDbTestLock(dataSource);
  });

  afterAll(async () => {
    await dbLock.release();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.getRepository(AuditEventEntity).clear();
    await dataSource.getRepository(CustomerEntity).clear();
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
