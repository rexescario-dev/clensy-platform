import { randomUUID } from 'crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import { AddCatalogTenant1790524800000 } from '../src/platform/database/migrations/1790524800000-AddCatalogTenant';
import { connectionOptions, migrationsBefore } from './helpers/migration-db';

const TABLES = `'service_entity'::regclass, 'add_on_entity'::regclass, 'pricing_rule_entity'::regclass`;
const NEW_CONSTRAINTS = [
  'fk_service_tenant',
  'fk_add_on_tenant',
  'fk_pricing_rule_tenant',
  'uq_service_id_tenant',
  'uq_add_on_id_tenant',
  'fk_pricing_rule_service_tenant',
  'fk_pricing_rule_add_on_tenant',
];
const OLD_CONSTRAINTS = ['fk_pricing_rule_service', 'fk_pricing_rule_addon'];
const NEW_INDEXES = [
  'uq_service_tenant_name_lower',
  'uq_add_on_tenant_name_lower',
  'idx_service_tenant_created',
  'idx_add_on_tenant_created',
];
const OLD_INDEXES = ['uq_service_name_lower', 'uq_add_on_name_lower'];
const UNCHANGED = [
  'ck_pricing_rule_target',
  'uq_pricing_rule_active_service',
  'uq_pricing_rule_open_service',
  'uq_pricing_rule_open_addon',
];

// #84 Task 1. Same harness as the #82/#83 migration e2e: every `up`/`down`
// runs in a transaction exactly as TypeORM runs it. Sequential cases.
describe('AddCatalogTenant migration (real Postgres)', () => {
  const database = `clensy_migration_${randomUUID().replace(/-/g, '')}`;
  let admin: DataSource;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  const migration = new AddCatalogTenant1790524800000();
  const serviceA = randomUUID();
  const addOnA = randomUUID();
  const secondTenant = randomUUID();

  async function inTransaction(run: (r: QueryRunner) => Promise<void>) {
    await queryRunner.startTransaction();
    try {
      await run(queryRunner);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    }
  }

  async function constraintNames(): Promise<string[]> {
    const rows: { conname: string }[] = await queryRunner.query(
      `SELECT conname FROM pg_constraint WHERE conrelid IN (${TABLES})`,
    );
    return rows.map((row) => row.conname);
  }

  async function indexNames(): Promise<string[]> {
    const rows: { indexname: string }[] = await queryRunner.query(
      `SELECT indexname FROM pg_indexes WHERE tablename IN ('service_entity', 'add_on_entity', 'pricing_rule_entity')`,
    );
    return rows.map((row) => row.indexname);
  }

  beforeAll(async () => {
    admin = new DataSource(connectionOptions(process.env.DB_NAME ?? 'clensy'));
    await admin.initialize();
    await admin.query(`CREATE DATABASE "${database}"`);
    dataSource = new DataSource({
      ...connectionOptions(database),
      migrations: migrationsBefore('1790524800000'),
    });
    await dataSource.initialize();
    await dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await dataSource.runMigrations();
    queryRunner = dataSource.createQueryRunner();

    await queryRunner.query(
      `INSERT INTO "service_entity" ("id", "name", "durationMinutes") VALUES ($1, 'Deep Clean', 60)`,
      [serviceA],
    );
    await queryRunner.query(
      `INSERT INTO "add_on_entity" ("id", "name", "priceMinorUnits") VALUES ($1, 'Fridge', 500)`,
      [addOnA],
    );
    await queryRunner.query(
      `INSERT INTO "pricing_rule_entity" ("serviceId", "priceMinorUnits", "effectiveFrom") VALUES ($1, 1000, now())`,
      [serviceA],
    );
    await queryRunner.query(
      `INSERT INTO "pricing_rule_entity" ("addOnId", "priceMinorUnits", "active", "effectiveFrom") VALUES ($1, 500, false, now())`,
      [addOnA],
    );
  }, 60_000);

  afterAll(async () => {
    await queryRunner?.release();
    await dataSource?.destroy();
    await admin?.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin?.destroy();
  });

  it('fails with an explicit error when the bootstrap tenant is missing', async () => {
    const [tenant]: { name: string }[] = await queryRunner.query(
      `SELECT "name" FROM "tenant_entity" WHERE "id" = $1`,
      [BOOTSTRAP_TENANT_ID],
    );
    await queryRunner.query(`DELETE FROM "tenant_entity" WHERE "id" = $1`, [
      BOOTSTRAP_TENANT_ID,
    ]);
    try {
      await expect(inTransaction((r) => migration.up(r))).rejects.toThrow(
        `AddCatalogTenant: bootstrap tenant ${BOOTSTRAP_TENANT_ID} not found — run AddTenantAndAdminScope first`,
      );
      const cols: unknown[] = await queryRunner.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name IN ('service_entity','add_on_entity','pricing_rule_entity') AND column_name = 'tenantId'`,
      );
      expect(cols).toHaveLength(0);
    } finally {
      await queryRunner.query(
        `INSERT INTO "tenant_entity" ("id", "name") VALUES ($1, $2)`,
        [BOOTSTRAP_TENANT_ID, tenant.name],
      );
    }
  });

  it('backfills the bootstrap tenant and swaps global constraints for tenant-aware ones', async () => {
    await inTransaction((r) => migration.up(r));

    const rows: { tenantId: string }[] = await queryRunner.query(
      `SELECT "tenantId" FROM "service_entity"
       UNION ALL SELECT "tenantId" FROM "add_on_entity"
       UNION ALL SELECT "tenantId" FROM "pricing_rule_entity"`,
    );
    expect(rows).toHaveLength(4);
    expect(new Set(rows.map((row) => row.tenantId))).toEqual(
      new Set([BOOTSTRAP_TENANT_ID]),
    );
    const constraints = await constraintNames();
    const indexes = await indexNames();
    expect(constraints).toEqual(expect.arrayContaining(NEW_CONSTRAINTS));
    expect(indexes).toEqual(expect.arrayContaining(NEW_INDEXES));
    expect([...constraints, ...indexes]).toEqual(
      expect.arrayContaining(UNCHANGED),
    );
    for (const old of OLD_CONSTRAINTS) {
      expect(constraints).not.toContain(old);
    }
    for (const old of OLD_INDEXES) {
      expect(indexes).not.toContain(old);
    }
  });

  it('enforces tenant-scoped, case-insensitive name uniqueness', async () => {
    await queryRunner.query(
      `INSERT INTO "tenant_entity" ("id", "name") VALUES ($1, 'Second')`,
      [secondTenant],
    );
    // Same name (different case), other tenant: allowed.
    await queryRunner.query(
      `INSERT INTO "service_entity" ("name", "durationMinutes", "tenantId") VALUES ('deep clean', 60, $1)`,
      [secondTenant],
    );
    await queryRunner.query(
      `INSERT INTO "add_on_entity" ("name", "priceMinorUnits", "tenantId") VALUES ('FRIDGE', 500, $1)`,
      [secondTenant],
    );
    // Different case, same tenant: rejected (case-insensitive).
    await expect(
      queryRunner.query(
        `INSERT INTO "service_entity" ("name", "durationMinutes", "tenantId") VALUES ('DEEP CLEAN', 60, $1)`,
        [BOOTSTRAP_TENANT_ID],
      ),
    ).rejects.toMatchObject({
      driverError: { constraint: 'uq_service_tenant_name_lower' },
    });
    await expect(
      queryRunner.query(
        `INSERT INTO "add_on_entity" ("name", "priceMinorUnits", "tenantId") VALUES ('fridge', 500, $1)`,
        [BOOTSTRAP_TENANT_ID],
      ),
    ).rejects.toMatchObject({
      driverError: { constraint: 'uq_add_on_tenant_name_lower' },
    });
  });

  it('rejects a pricing rule whose target belongs to another tenant', async () => {
    // Closed interval + inactive: the open/active partial unique indexes are
    // checked immediately and would otherwise fire before the (end-of-
    // statement) FK check, masking it.
    await expect(
      queryRunner.query(
        `INSERT INTO "pricing_rule_entity" ("serviceId", "priceMinorUnits", "active", "effectiveFrom", "effectiveTo", "tenantId") VALUES ($1, 1, false, now() - interval '2 days', now() - interval '1 day', $2)`,
        [serviceA, secondTenant],
      ),
    ).rejects.toMatchObject({
      driverError: { constraint: 'fk_pricing_rule_service_tenant' },
    });
    await expect(
      queryRunner.query(
        `INSERT INTO "pricing_rule_entity" ("addOnId", "priceMinorUnits", "active", "effectiveFrom", "effectiveTo", "tenantId") VALUES ($1, 1, false, now() - interval '2 days', now() - interval '1 day', $2)`,
        [addOnA, secondTenant],
      ),
    ).rejects.toMatchObject({
      driverError: { constraint: 'fk_pricing_rule_add_on_tenant' },
    });
  });

  it('down restores the pre-tenant schema', async () => {
    await queryRunner.query(
      `DELETE FROM "service_entity" WHERE "tenantId" = $1`,
      [secondTenant],
    );
    await queryRunner.query(
      `DELETE FROM "add_on_entity" WHERE "tenantId" = $1`,
      [secondTenant],
    );
    await queryRunner.query(`DELETE FROM "tenant_entity" WHERE "id" = $1`, [
      secondTenant,
    ]);
    await inTransaction((r) => migration.down(r));

    // Column is gone from all three tables.
    const cols: unknown[] = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name IN ('service_entity','add_on_entity','pricing_rule_entity') AND column_name = 'tenantId'`,
    );
    expect(cols).toHaveLength(0);

    // Restored objects have their original definitions, not just their names.
    // Captured from `clensy_e2e_84` (main's schema) per M6 note.
    const defs: { conname: string; def: string }[] = await queryRunner.query(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname IN ('fk_pricing_rule_service', 'fk_pricing_rule_addon')`,
    );
    expect(
      Object.fromEntries(defs.map((row) => [row.conname, row.def])),
    ).toEqual({
      fk_pricing_rule_service:
        'FOREIGN KEY ("serviceId") REFERENCES service_entity(id) ON DELETE RESTRICT',
      fk_pricing_rule_addon:
        'FOREIGN KEY ("addOnId") REFERENCES add_on_entity(id) ON DELETE RESTRICT',
    });
    const indexDefs: { indexname: string; indexdef: string }[] =
      await queryRunner.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE indexname IN ('uq_service_name_lower', 'uq_add_on_name_lower')`,
      );
    for (const { indexdef } of indexDefs) {
      expect(indexdef).toMatch(
        /CREATE UNIQUE INDEX .* USING btree \(lower\(\(name\)::text\)\)$/,
      );
    }
    expect(indexDefs).toHaveLength(2);

    // The pre-migration rows survive and global name uniqueness is back.
    const [{ count }]: { count: string }[] = await queryRunner.query(
      `SELECT count(*) FROM "pricing_rule_entity"`,
    );
    expect(Number(count)).toBe(2);

    const constraints = await constraintNames();
    const indexes = await indexNames();
    // `NEW_CONSTRAINTS` includes the three tenant FKs (fk_service_tenant,
    // fk_add_on_tenant, fk_pricing_rule_tenant); asserted absent below.
    expect(constraints).toEqual(expect.arrayContaining(OLD_CONSTRAINTS));
    expect(indexes).toEqual(expect.arrayContaining(OLD_INDEXES));
    for (const added of NEW_CONSTRAINTS) {
      expect(constraints).not.toContain(added);
    }
    for (const added of NEW_INDEXES) {
      expect(indexes).not.toContain(added);
    }
  });
});
