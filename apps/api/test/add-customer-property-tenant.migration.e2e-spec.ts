import { randomUUID } from 'crypto';
import { readdirSync } from 'fs';
import { join } from 'path';
import { DataSource, MigrationInterface, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import { CustomerEmailDuplicateError } from '../src/platform/database/customer-email-duplicates';
import { AddCustomerPropertyTenant1790265191400 } from '../src/platform/database/migrations/1790265191400-AddCustomerPropertyTenant';

const MIGRATIONS_DIR = join(__dirname, '../src/platform/database/migrations');

// Every migration that precedes `AddCustomerPropertyTenant`, as classes, so
// the throwaway database is at the exact pre-#82 schema (no customer or
// property `tenantId`) before the migration under test runs.
function migrationsBeforeCustomerTenant(): (new () => MigrationInterface)[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.ts'))
    .sort()
    .filter((file) => file < '1790265191400')
    .map((file) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamic load of every migration file by name
      const exported = require(join(MIGRATIONS_DIR, file)) as Record<
        string,
        new () => MigrationInterface
      >;
      return Object.values(exported)[0];
    });
}

function connectionOptions(database: string) {
  return {
    database,
    host: process.env.DB_HOST ?? 'localhost',
    password: process.env.DB_PASSWORD ?? 'clensy_dev',
    port: Number(process.env.DB_PORT ?? 5432),
    type: 'postgres' as const,
    username: process.env.DB_USERNAME ?? 'clensy',
  };
}

const NEW_CONSTRAINTS = [
  'fk_customer_tenant',
  'fk_property_tenant',
  'uq_customer_id_tenant',
  'uq_property_id_tenant',
  'fk_property_customer_tenant',
];
const NEW_INDEXES = [
  'uq_customer_tenant_email',
  'idx_customer_tenant_created',
  'idx_property_tenant_customer',
];

// #82 Task 2: the migration asserts the bootstrap tenant, backfills,
// validates duplicate emails, and only then adds constraints — all in one
// transaction. Every `up`/`down` here runs inside a transaction exactly as
// TypeORM runs it (commit on success, rollback on throw), so the tests prove
// the rollback rather than assume it. Runs in its own throwaway database.
describe('AddCustomerPropertyTenant migration (real Postgres)', () => {
  const database = `clensy_migration_${randomUUID().replace(/-/g, '')}`;
  let admin: DataSource;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  const migration = new AddCustomerPropertyTenant1790265191400();
  const customerA = randomUUID();
  const propertyA = randomUUID();
  const janeUpper = randomUUID();
  const janeLower = randomUUID();
  const secondTenant = randomUUID();

  async function inTransaction(
    run: (runner: QueryRunner) => Promise<void>,
  ): Promise<void> {
    await queryRunner.startTransaction();
    try {
      await run(queryRunner);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    }
  }

  async function hasTenantColumn(table: string): Promise<boolean> {
    const rows: unknown[] = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'tenantId'`,
      [table],
    );
    return rows.length > 0;
  }

  async function constraintNames(): Promise<string[]> {
    const rows: { conname: string }[] = await queryRunner.query(
      `SELECT conname FROM pg_constraint WHERE conrelid IN ('customer_entity'::regclass, 'property_entity'::regclass)`,
    );
    return rows.map((row) => row.conname);
  }

  async function indexNames(): Promise<string[]> {
    const rows: { indexname: string }[] = await queryRunner.query(
      `SELECT indexname FROM pg_indexes WHERE tablename IN ('customer_entity', 'property_entity')`,
    );
    return rows.map((row) => row.indexname);
  }

  async function customerSnapshot(): Promise<string[]> {
    const rows: { row: string }[] = await queryRunner.query(
      `SELECT row_to_json(c)::text AS "row" FROM "customer_entity" c ORDER BY "id"`,
    );
    return rows.map((row) => row.row);
  }

  function insertCustomer(
    id: string,
    email: string,
    tenantId?: string,
  ): Promise<unknown> {
    return tenantId === undefined
      ? queryRunner.query(
          `INSERT INTO "customer_entity" ("id", "fullName", "email", "phone") VALUES ($1, 'Name', $2, '555')`,
          [id, email],
        )
      : queryRunner.query(
          `INSERT INTO "customer_entity" ("id", "fullName", "email", "phone", "tenantId") VALUES ($1, 'Name', $2, '555', $3)`,
          [id, email, tenantId],
        );
  }

  beforeAll(async () => {
    admin = new DataSource(connectionOptions(process.env.DB_NAME ?? 'clensy'));
    await admin.initialize();
    await admin.query(`CREATE DATABASE "${database}"`);

    dataSource = new DataSource({
      ...connectionOptions(database),
      migrations: migrationsBeforeCustomerTenant(),
    });
    await dataSource.initialize();
    await dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await dataSource.runMigrations();
    queryRunner = dataSource.createQueryRunner();

    await insertCustomer(customerA, 'owner@example.com');
    await queryRunner.query(
      `INSERT INTO "property_entity" ("id", "customerId", "label", "addressLine1", "city", "region", "postalCode") VALUES ($1, $2, 'Home', '1 Main St', 'Town', 'RG', '00000')`,
      [propertyA, customerA],
    );
    await insertCustomer(janeUpper, 'Jane@Example.com');
    await insertCustomer(janeLower, 'jane@example.com');
  }, 60_000);

  afterAll(async () => {
    await queryRunner?.release();
    await dataSource?.destroy();
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.destroy();
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
      await expect(
        inTransaction((runner) => migration.up(runner)),
      ).rejects.toThrow(
        `AddCustomerPropertyTenant: bootstrap tenant ${BOOTSTRAP_TENANT_ID} not found — run AddTenantAndAdminScope first`,
      );
      expect(await hasTenantColumn('customer_entity')).toBe(false);
      expect(await hasTenantColumn('property_entity')).toBe(false);
    } finally {
      await queryRunner.query(
        `INSERT INTO "tenant_entity" ("id", "name") VALUES ($1, $2)`,
        [BOOTSTRAP_TENANT_ID, tenant.name],
      );
    }
  });

  it('aborts on duplicate emails, rolling back the backfill and leaving no new schema objects', async () => {
    const before = await customerSnapshot();

    let error: unknown;
    try {
      await inTransaction((runner) => migration.up(runner));
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(CustomerEmailDuplicateError);
    const message = (error as Error).message;
    expect(message).toContain(janeUpper);
    expect(message).toContain(janeLower);
    expect(message).toContain('jane@example.com');
    expect(message).toContain(BOOTSTRAP_TENANT_ID);

    expect(await hasTenantColumn('customer_entity')).toBe(false);
    expect(await hasTenantColumn('property_entity')).toBe(false);
    const constraints = await constraintNames();
    expect(constraints).toContain('fk_property_customer');
    for (const name of NEW_CONSTRAINTS) {
      expect(constraints).not.toContain(name);
    }
    const indexes = await indexNames();
    for (const name of NEW_INDEXES) {
      expect(indexes).not.toContain(name);
    }
    expect(await customerSnapshot()).toEqual(before);
  });

  it('succeeds after manual remediation and backfills every row to the bootstrap tenant', async () => {
    await queryRunner.query(
      `UPDATE "customer_entity" SET "email" = 'jane.upper@example.com' WHERE "id" = $1`,
      [janeUpper],
    );

    await inTransaction((runner) => migration.up(runner));

    const customers: { tenantId: string }[] = await queryRunner.query(
      `SELECT "tenantId" FROM "customer_entity"`,
    );
    expect(customers).toHaveLength(3);
    expect(customers.every((row) => row.tenantId === BOOTSTRAP_TENANT_ID)).toBe(
      true,
    );
    const properties: { tenantId: string }[] = await queryRunner.query(
      `SELECT "tenantId" FROM "property_entity"`,
    );
    expect(properties).toEqual([{ tenantId: BOOTSTRAP_TENANT_ID }]);

    const nullable: { table_name: string; is_nullable: string }[] =
      await queryRunner.query(
        `SELECT table_name, is_nullable FROM information_schema.columns WHERE table_name IN ('customer_entity', 'property_entity') AND column_name = 'tenantId' ORDER BY table_name`,
      );
    expect(nullable).toEqual([
      { table_name: 'customer_entity', is_nullable: 'NO' },
      { table_name: 'property_entity', is_nullable: 'NO' },
    ]);
    const constraints = await constraintNames();
    expect(constraints).not.toContain('fk_property_customer');
    for (const name of NEW_CONSTRAINTS) {
      expect(constraints).toContain(name);
    }
    const indexes = await indexNames();
    for (const name of NEW_INDEXES) {
      expect(indexes).toContain(name);
    }
  });

  it('rejects a property whose customer belongs to another tenant', async () => {
    await queryRunner.query(
      `INSERT INTO "tenant_entity" ("id", "name") VALUES ($1, 'Second tenant')`,
      [secondTenant],
    );
    const foreignCustomer = randomUUID();
    await insertCustomer(foreignCustomer, 'foreign@example.com', secondTenant);

    await expect(
      queryRunner.query(
        `INSERT INTO "property_entity" ("customerId", "tenantId", "label", "addressLine1", "city", "region", "postalCode") VALUES ($1, $2, 'Home', '1 Main St', 'Town', 'RG', '00000')`,
        [foreignCustomer, BOOTSTRAP_TENANT_ID],
      ),
    ).rejects.toThrow(/fk_property_customer_tenant/);
  });

  it('enforces case-insensitive email uniqueness per tenant only', async () => {
    await expect(
      insertCustomer(randomUUID(), 'JANE@EXAMPLE.COM', BOOTSTRAP_TENANT_ID),
    ).rejects.toThrow(/uq_customer_tenant_email/);

    await expect(
      insertCustomer(randomUUID(), 'JANE@EXAMPLE.COM', secondTenant),
    ).resolves.toBeDefined();
  });

  it('round-trips down then up', async () => {
    // `down` drops tenant ownership, so a re-run would backfill every row to
    // the bootstrap tenant; remove the second tenant's rows first so the
    // round-trip is not blocked by a legitimate cross-tenant duplicate.
    await queryRunner.query(
      `DELETE FROM "customer_entity" WHERE "tenantId" = $1`,
      [secondTenant],
    );

    await inTransaction((runner) => migration.down(runner));

    expect(await hasTenantColumn('customer_entity')).toBe(false);
    expect(await hasTenantColumn('property_entity')).toBe(false);
    let constraints = await constraintNames();
    expect(constraints).toContain('fk_property_customer');
    for (const name of NEW_CONSTRAINTS) {
      expect(constraints).not.toContain(name);
    }
    let indexes = await indexNames();
    for (const name of NEW_INDEXES) {
      expect(indexes).not.toContain(name);
    }

    await inTransaction((runner) => migration.up(runner));

    constraints = await constraintNames();
    expect(constraints).not.toContain('fk_property_customer');
    for (const name of NEW_CONSTRAINTS) {
      expect(constraints).toContain(name);
    }
    indexes = await indexNames();
    for (const name of NEW_INDEXES) {
      expect(indexes).toContain(name);
    }
  });
});
