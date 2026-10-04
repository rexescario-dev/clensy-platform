import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { AddTenantLabelOverrides1790870400000 } from '../src/platform/database/migrations/1790870400000-AddTenantLabelOverrides';
import { connectionOptions, migrationsBefore } from './helpers/migration-db';

// #118 (tenant label overrides spec §4.1, §6.1): adds only the nullable
// jsonb column, writes no data (every existing tenant row stays NULL), and
// down() drops it — on a throwaway database migrated to just before it.
describe('AddTenantLabelOverrides migration (real Postgres)', () => {
  const database = `clensy_migration_${randomUUID().replace(/-/g, '')}`;
  let admin: DataSource;
  let dataSource: DataSource;

  async function labelOverridesColumn(): Promise<
    { data_type: string; is_nullable: string } | undefined
  > {
    const rows = await dataSource.query(
      `SELECT "data_type", "is_nullable" FROM information_schema.columns WHERE "table_name" = 'tenant_entity' AND "column_name" = 'labelOverrides'`,
    );
    return rows[0];
  }

  const preMigrationName = `pre-migration-${randomUUID()}`;

  async function tenantCount(): Promise<{ total: number; unset: number }> {
    const [counts] = await dataSource.query(
      `SELECT COUNT(*)::int AS "total", (COUNT(*) FILTER (WHERE "labelOverrides" IS NULL))::int AS "unset" FROM "tenant_entity"`,
    );
    return counts;
  }

  beforeAll(async () => {
    admin = new DataSource(connectionOptions(process.env.DB_NAME ?? 'clensy'));
    await admin.initialize();
    await admin.query(`CREATE DATABASE "${database}"`);
    dataSource = new DataSource({
      ...connectionOptions(database),
      migrations: migrationsBefore('1790870400000'),
    });
    await dataSource.initialize();
    await dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await dataSource.runMigrations();
    await dataSource.query(`INSERT INTO "tenant_entity" ("name") VALUES ($1)`, [
      preMigrationName,
    ]);
  }, 120_000);

  afterAll(async () => {
    await dataSource?.destroy();
    await admin?.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin?.destroy();
  });

  it('adds a nullable jsonb column, leaves every existing tenant NULL, and down() drops it', async () => {
    const migration = new AddTenantLabelOverrides1790870400000();
    const queryRunner = dataSource.createQueryRunner();
    try {
      expect(await labelOverridesColumn()).toBeUndefined();
      const [{ count: before }] = await dataSource.query(
        `SELECT COUNT(*)::int AS "count" FROM "tenant_entity"`,
      );

      await migration.up(queryRunner);
      expect(await labelOverridesColumn()).toEqual({
        data_type: 'jsonb',
        is_nullable: 'YES',
      });
      // Writes no data: the same rows, every one still NULL — including the
      // row this test inserted, independent of any baseline seed data.
      const { total, unset } = await tenantCount();
      expect(total).toBe(before);
      expect(unset).toBe(total);
      const [inserted] = await dataSource.query(
        `SELECT "labelOverrides" FROM "tenant_entity" WHERE "name" = $1`,
        [preMigrationName],
      );
      expect(inserted.labelOverrides).toBeNull();

      await migration.down(queryRunner);
      expect(await labelOverridesColumn()).toBeUndefined();
    } finally {
      await queryRunner.release();
    }
  });
});
