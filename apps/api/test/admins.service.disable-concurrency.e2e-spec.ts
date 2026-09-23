import { DataSource } from 'typeorm';
import { AuditLogger } from '../src/platform/audit/application/audit-logger.port';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { Role } from '../src/platform/auth/domain/role';
import { AdminsService } from '../src/modules/admins/application/services/admins.service';
import { AdminUserEntity } from '../src/modules/admins/infrastructure/persistence/admin-user.entity';
import { TenantEntity } from '../src/modules/admins/infrastructure/persistence/tenant.entity';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import {
  acquireAdminDbTestLock,
  AdminDbTestLock,
} from './helpers/admin-db-test-lock';
import {
  createTestTenant,
  removeTestTenants,
  seedTenantAdmin,
} from './helpers/seed-tenant-admin';

// Separate file, on purpose: this test proves actual Postgres row-locking
// behavior, which no mock can do. It opens TWO independent `DataSource`
// instances (two real connections/pools) against the same local
// docker-compose Postgres and constructs one `AdminsService` per connection,
// so the two concurrent `disable()` calls below run on genuinely separate DB
// sessions — exactly the race the brief's last-active-Owner lock exists to
// serialize (spec §4.4).
//
// Lives under `apps/api/test/` (the `pnpm test:e2e` path), not `src/`'s
// mocked/no-infra `pnpm test` path — this file opens two real `DataSource`s
// and truncates real tables, which `pnpm test` must never do.
//
// Also holds the same Postgres advisory lock as `admins.service.e2e-spec.ts`
// (see `./helpers/admin-db-test-lock.ts`) for the whole file's run, so the
// two real-DB spec files can never overlap regardless of Jest's worker
// scheduling — without serializing the rest of the suite.
describe('AdminsService.disable — last-active-Tenant-Owner race (real Postgres, two connections)', () => {
  let dataSourceA: DataSource;
  let dataSourceB: DataSource;
  let dbLock: AdminDbTestLock;
  let serviceA: AdminsService;
  let serviceB: AdminsService;
  let otherTenantId: string;

  const makeDataSource = () =>
    new DataSource({
      database: process.env.DB_NAME ?? 'clensy',
      entities: [AdminUserEntity, AuditEventEntity, TenantEntity],
      host: process.env.DB_HOST ?? 'localhost',
      password: process.env.DB_PASSWORD ?? 'clensy_dev',
      port: Number(process.env.DB_PORT ?? 5432),
      type: 'postgres',
      username: process.env.DB_USERNAME ?? 'clensy',
    });

  beforeAll(async () => {
    dataSourceA = makeDataSource();
    dataSourceB = makeDataSource();
    await dataSourceA.initialize();
    await dataSourceB.initialize();
    dbLock = await acquireAdminDbTestLock(dataSourceA);
    otherTenantId = await createTestTenant(dataSourceA);
  });

  afterAll(async () => {
    await removeTestTenants(dataSourceA, [otherTenantId]);
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

  it('allows at most one of two concurrent disable-each-other calls to succeed, leaving exactly one active Tenant Owner in that tenant', async () => {
    const ownerA = await seedTenantAdmin(dataSourceA);
    const ownerB = await seedTenantAdmin(dataSourceA);
    // An active owner of ANOTHER tenant must not count toward this
    // tenant's "more than one active Tenant Owner" check.
    await seedTenantAdmin(dataSourceA, Role.TENANT_OWNER, otherTenantId);

    const [resultA, resultB] = await Promise.allSettled([
      serviceA.disable({ actor: ownerB.principal, targetId: ownerA.id }),
      serviceB.disable({ actor: ownerA.principal, targetId: ownerB.id }),
    ]);

    const outcomes = [resultA, resultB];
    const fulfilled = outcomes.filter((r) => r.status === 'fulfilled');
    const rejected = outcomes.filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const rejectionReason = rejected[0].reason as Error;
    expect(rejectionReason.message).toMatch(/last active tenant owner/i);

    const remainingActiveOwners = await dataSourceA
      .getRepository(AdminUserEntity)
      .count({
        where: {
          tenantId: BOOTSTRAP_TENANT_ID,
          isActive: true,
          role: Role.TENANT_OWNER,
        },
      });
    expect(remainingActiveOwners).toBe(1);
  });
});
