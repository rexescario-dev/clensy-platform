import { randomUUID } from 'crypto';
import { readdirSync } from 'fs';
import { join } from 'path';
import { DataSource, MigrationInterface, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import { AddTenantAndAdminScope1790180877633 } from '../src/platform/database/migrations/1790180877633-AddTenantAndAdminScope';
import { OwnerDesignationError } from '../src/platform/database/owner-designation';

const MIGRATIONS_DIR = join(__dirname, '../src/platform/database/migrations');

// Every migration that precedes `AddTenantAndAdminScope`, as classes, so the
// throwaway database can be brought to the exact pre-tenancy schema (with the
// OWNER role still in the enum) before the migration under test runs.
function migrationsBeforeTenantScope(): (new () => MigrationInterface)[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.ts'))
    .sort()
    .filter((file) => file < '1790180877633')
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

async function roleEnumValues(queryRunner: QueryRunner): Promise<string[]> {
  const [{ values }]: { values: string }[] = await queryRunner.query(
    `SELECT enum_range(NULL::admin_user_entity_role_enum)::text AS "values"`,
  );
  return values.replace(/[{}]/g, '').split(',');
}

// Plan Task 4: an undesignated OWNER must abort the migration with OWNER
// still in the role enum; a complete designation converts every row. Runs
// in its own throwaway database so no shared database's OWNER rows are
// touched.
describe('AddTenantAndAdminScope migration (real Postgres)', () => {
  const database = `clensy_migration_${randomUUID().replace(/-/g, '')}`;
  let admin: DataSource;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  const ownerA = randomUUID();
  const ownerB = randomUUID();
  const opsManager = randomUUID();

  beforeAll(async () => {
    admin = new DataSource(connectionOptions(process.env.DB_NAME ?? 'clensy'));
    await admin.initialize();
    await admin.query(`CREATE DATABASE "${database}"`);

    dataSource = new DataSource({
      ...connectionOptions(database),
      migrations: migrationsBeforeTenantScope(),
    });
    await dataSource.initialize();
    await dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await dataSource.runMigrations();

    await dataSource.query(
      `INSERT INTO "admin_user_entity" ("id", "email", "passwordHash", "role") VALUES
        ($1, 'owner-a@example.com', 'x', 'OWNER'),
        ($2, 'owner-b@example.com', 'x', 'OWNER'),
        ($3, 'ops@example.com', 'x', 'OPS_MANAGER')`,
      [ownerA, ownerB, opsManager],
    );
    queryRunner = dataSource.createQueryRunner();
  }, 60_000);

  afterAll(async () => {
    await queryRunner?.release();
    await dataSource?.destroy();
    await admin.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin.destroy();
  });

  it('aborts on an undesignated OWNER, leaving OWNER in the enum and no tenant table', async () => {
    const migration = new AddTenantAndAdminScope1790180877633([
      { adminUserId: ownerA, role: 'TENANT_OWNER' },
    ]);

    await queryRunner.startTransaction();
    await expect(migration.up(queryRunner)).rejects.toThrow(
      OwnerDesignationError,
    );
    await queryRunner.rollbackTransaction();

    expect(await roleEnumValues(queryRunner)).toContain('OWNER');
    const [{ exists }]: { exists: boolean }[] = await queryRunner.query(
      `SELECT to_regclass('public.tenant_entity') IS NOT NULL AS "exists"`,
    );
    expect(exists).toBe(false);
    const owners: unknown[] = await queryRunner.query(
      `SELECT 1 FROM "admin_user_entity" WHERE "role" = 'OWNER'`,
    );
    expect(owners).toHaveLength(2);
  });

  it('converts designated OWNERs, attaches staff to the bootstrap tenant, and retires OWNER', async () => {
    const migration = new AddTenantAndAdminScope1790180877633([
      { adminUserId: ownerA, role: 'TENANT_OWNER' },
      { adminUserId: ownerB, role: 'SUPER_ADMIN' },
    ]);

    await queryRunner.startTransaction();
    await migration.up(queryRunner);
    await queryRunner.commitTransaction();

    const rows: {
      id: string;
      tenantId: string | null;
      role: string;
      scope: string;
    }[] = await queryRunner.query(
      `SELECT "id", "tenantId", "role", "scope" FROM "admin_user_entity"`,
    );
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(ownerA)).toMatchObject({
      tenantId: BOOTSTRAP_TENANT_ID,
      role: 'TENANT_OWNER',
      scope: 'TENANT',
    });
    expect(byId.get(ownerB)).toMatchObject({
      tenantId: null,
      role: 'SUPER_ADMIN',
      scope: 'PLATFORM',
    });
    expect(byId.get(opsManager)).toMatchObject({
      tenantId: BOOTSTRAP_TENANT_ID,
      role: 'OPS_MANAGER',
      scope: 'TENANT',
    });

    expect(await roleEnumValues(queryRunner)).not.toContain('OWNER');
    const tenants: { id: string }[] = await queryRunner.query(
      `SELECT "id" FROM "tenant_entity"`,
    );
    expect(tenants).toEqual([{ id: BOOTSTRAP_TENANT_ID }]);
  });

  it.each([
    ['PLATFORM with a tenant', 'SUPER_ADMIN', 'PLATFORM', BOOTSTRAP_TENANT_ID],
    ['PLATFORM with a tenant role', 'TENANT_OWNER', 'PLATFORM', null],
    ['TENANT without a tenant', 'SCHEDULER', 'TENANT', null],
    ['TENANT as SUPER_ADMIN', 'SUPER_ADMIN', 'TENANT', BOOTSTRAP_TENANT_ID],
  ])(
    'rejects an admin row that is %s',
    async (_label, role, scope, tenantId) => {
      await expect(
        queryRunner.query(
          `INSERT INTO "admin_user_entity" ("email", "passwordHash", "role", "scope", "tenantId") VALUES ($1, 'x', $2, $3, $4)`,
          [`${randomUUID()}@example.com`, role, scope, tenantId],
        ),
      ).rejects.toThrow(/ck_admin_user_/);
    },
  );

  it.each([
    ['TENANT without a tenant', 'TENANT', null],
    ['PLATFORM with a tenant', 'PLATFORM', 'some-tenant'],
    ['no scope with a tenant', null, 'some-tenant'],
  ])('rejects an audit event that is %s', async (_label, scope, tenantId) => {
    await expect(
      queryRunner.query(
        `INSERT INTO "audit_event_entity" ("action", "scope", "tenantId") VALUES ('test', $1, $2)`,
        [scope, tenantId],
      ),
    ).rejects.toThrow(/ck_audit_event_scope_tenant/);
  });

  it('refuses to revert', async () => {
    await expect(
      new AddTenantAndAdminScope1790180877633().down(),
    ).rejects.toThrow(/irreversible/);
  });
});
