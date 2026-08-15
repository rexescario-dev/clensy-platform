import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { AuditLogger } from '../../../../platform/audit/application/audit-logger.port';
import { AuditEventEntity } from '../../../../platform/audit/infrastructure/persistence/audit-event.entity';
import { Role } from '../../../../platform/auth/domain/role';
import { AdminsService } from '../../application/services/admins.service';
import { AdminUserEntity } from '../../infrastructure/persistence/admin-user.entity';
import {
  acquireAdminDbTestLock,
  AdminDbTestLock,
} from '../support/admin-db-test-lock';

// Separate file, on purpose: this test proves actual Postgres row-locking
// behavior, which no mock can do. It opens TWO independent `DataSource`
// instances (two real connections/pools) against the same local
// docker-compose Postgres and constructs one `AdminsService` per connection,
// so the two concurrent `disable()` calls below run on genuinely separate DB
// sessions — exactly the race the brief's last-active-Owner lock exists to
// serialize (spec §4.4).
//
// Also holds the same Postgres advisory lock as `admins.service.spec.ts`
// (see `../support/admin-db-test-lock.ts`) for the whole file's run, so the
// two real-DB spec files can never overlap regardless of Jest's worker
// scheduling — without serializing the rest of the suite.
describe('AdminsService.disable — last-active-Owner race (real Postgres, two connections)', () => {
  let dataSourceA: DataSource;
  let dataSourceB: DataSource;
  let dbLock: AdminDbTestLock;
  let serviceA: AdminsService;
  let serviceB: AdminsService;

  const makeDataSource = () =>
    new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'clensy',
      password: process.env.DB_PASSWORD ?? 'clensy_dev',
      database: process.env.DB_NAME ?? 'clensy',
      entities: [AdminUserEntity, AuditEventEntity],
    });

  beforeAll(async () => {
    dataSourceA = makeDataSource();
    dataSourceB = makeDataSource();
    await dataSourceA.initialize();
    await dataSourceB.initialize();
    dbLock = await acquireAdminDbTestLock(dataSourceA);
  });

  afterAll(async () => {
    await dbLock.release();
    await dataSourceA.destroy();
    await dataSourceB.destroy();
  });

  beforeEach(async () => {
    await dataSourceA.getRepository(AuditEventEntity).clear();
    await dataSourceA.getRepository(AdminUserEntity).clear();

    const noopAuditLogger = {
      log: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditLogger;
    serviceA = new AdminsService(dataSourceA, noopAuditLogger);
    serviceB = new AdminsService(dataSourceB, noopAuditLogger);
  });

  it('allows at most one of two concurrent disable-each-other calls to succeed, leaving exactly one active Owner', async () => {
    const repo = dataSourceA.getRepository(AdminUserEntity);
    const ownerA = await repo.save(
      repo.create({
        email: 'race-owner-a@example.com',
        passwordHash: await bcrypt.hash('irrelevant', 4),
        role: Role.OWNER,
        isActive: true,
      }),
    );
    const ownerB = await repo.save(
      repo.create({
        email: 'race-owner-b@example.com',
        passwordHash: await bcrypt.hash('irrelevant', 4),
        role: Role.OWNER,
        isActive: true,
      }),
    );

    const [resultA, resultB] = await Promise.allSettled([
      serviceA.disable({ actorId: ownerB.id, targetId: ownerA.id }),
      serviceB.disable({ actorId: ownerA.id, targetId: ownerB.id }),
    ]);

    const outcomes = [resultA, resultB];
    const fulfilled = outcomes.filter((r) => r.status === 'fulfilled');
    const rejected = outcomes.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const rejectionReason = rejected[0].reason as Error;
    expect(rejectionReason.message).toMatch(/last active owner/i);

    const remainingActiveOwners = await repo.count({
      where: { role: Role.OWNER, isActive: true },
    });
    expect(remainingActiveOwners).toBe(1);
  });
});
