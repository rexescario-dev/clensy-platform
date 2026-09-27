import { randomUUID } from 'crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import { AddTeamCleanerTenant1790438400000 } from '../src/platform/database/migrations/1790438400000-AddTeamCleanerTenant';
import { connectionOptions, migrationsBefore } from './helpers/migration-db';

const NEW_CONSTRAINTS = [
  'fk_team_tenant',
  'fk_cleaner_tenant',
  'uq_team_id_tenant',
  'uq_cleaner_id_tenant',
  'uq_team_tenant_name',
  'uq_cleaner_tenant_email',
  'fk_cleaner_team_tenant',
];
const NEW_INDEXES = ['idx_team_tenant_created', 'idx_cleaner_tenant_created'];
const OLD_CONSTRAINTS = [
  'UQ_77fe6acc7fed8f35637f86a2163',
  'UQ_ff219644065361c10ec6890f339',
  'fk_cleaner_team',
];

// #83 Task 1. Same harness as the #82 migration e2e: every `up`/`down` runs
// in a transaction exactly as TypeORM runs it. Sequential cases.
describe('AddTeamCleanerTenant migration (real Postgres)', () => {
  const database = `clensy_migration_${randomUUID().replace(/-/g, '')}`;
  let admin: DataSource;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  const migration = new AddTeamCleanerTenant1790438400000();
  const teamA = randomUUID();
  const cleanerInTeam = randomUUID();
  const cleanerNoTeam = randomUUID();
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
      `SELECT conname FROM pg_constraint WHERE conrelid IN ('team_entity'::regclass, 'cleaner_entity'::regclass)`,
    );
    return rows.map((row) => row.conname);
  }

  async function indexNames(): Promise<string[]> {
    const rows: { indexname: string }[] = await queryRunner.query(
      `SELECT indexname FROM pg_indexes WHERE tablename IN ('team_entity', 'cleaner_entity')`,
    );
    return rows.map((row) => row.indexname);
  }

  beforeAll(async () => {
    admin = new DataSource(connectionOptions(process.env.DB_NAME ?? 'clensy'));
    await admin.initialize();
    await admin.query(`CREATE DATABASE "${database}"`);
    dataSource = new DataSource({
      ...connectionOptions(database),
      migrations: migrationsBefore('1790438400000'),
    });
    await dataSource.initialize();
    await dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await dataSource.runMigrations();
    queryRunner = dataSource.createQueryRunner();

    await queryRunner.query(
      `INSERT INTO "team_entity" ("id", "name") VALUES ($1, 'Alpha')`,
      [teamA],
    );
    await queryRunner.query(
      `INSERT INTO "cleaner_entity" ("id", "fullName", "phone", "email", "teamId") VALUES ($1, 'In Team', '555', 'in@example.com', $2)`,
      [cleanerInTeam, teamA],
    );
    await queryRunner.query(
      `INSERT INTO "cleaner_entity" ("id", "fullName", "phone", "email") VALUES ($1, 'No Team', '555', 'none@example.com')`,
      [cleanerNoTeam],
    );
  }, 60_000);

  afterAll(async () => {
    await queryRunner?.release();
    await dataSource?.destroy();
    await admin?.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin?.destroy();
  });

  // Same mechanics as #82's equivalent case: the throwaway DB has no rows
  // referencing the bootstrap tenant, so it can be deleted and re-inserted.
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
        `AddTeamCleanerTenant: bootstrap tenant ${BOOTSTRAP_TENANT_ID} not found — run AddTenantAndAdminScope first`,
      );
      const cols: unknown[] = await queryRunner.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name IN ('team_entity','cleaner_entity') AND column_name = 'tenantId'`,
      );
      expect(cols).toHaveLength(0);
    } finally {
      await queryRunner.query(
        `INSERT INTO "tenant_entity" ("id", "name") VALUES ($1, $2)`,
        [BOOTSTRAP_TENANT_ID, tenant.name],
      );
    }
  });

  it('backfills the bootstrap tenant and swaps global uniques for tenant-scoped ones', async () => {
    await inTransaction((r) => migration.up(r));

    const teams: { tenantId: string }[] = await queryRunner.query(
      `SELECT "tenantId" FROM "team_entity"`,
    );
    const cleaners: { tenantId: string }[] = await queryRunner.query(
      `SELECT "tenantId" FROM "cleaner_entity"`,
    );
    expect(new Set([...teams, ...cleaners].map((row) => row.tenantId))).toEqual(
      new Set([BOOTSTRAP_TENANT_ID]),
    );
    const constraints = await constraintNames();
    expect(constraints).toEqual(expect.arrayContaining(NEW_CONSTRAINTS));
    for (const old of OLD_CONSTRAINTS) {
      expect(constraints).not.toContain(old);
    }
    expect(await indexNames()).toEqual(expect.arrayContaining(NEW_INDEXES));
  });

  it('enforces tenant-scoped, case-sensitive uniqueness', async () => {
    await queryRunner.query(
      `INSERT INTO "tenant_entity" ("id", "name") VALUES ($1, 'Second')`,
      [secondTenant],
    );
    // Same name, other tenant: allowed.
    await queryRunner.query(
      `INSERT INTO "team_entity" ("name", "tenantId") VALUES ('Alpha', $1)`,
      [secondTenant],
    );
    // Different case, same tenant: allowed (case-sensitive, Slice decision 2).
    await queryRunner.query(
      `INSERT INTO "team_entity" ("name", "tenantId") VALUES ('alpha', $1)`,
      [BOOTSTRAP_TENANT_ID],
    );
    // Exact duplicate, same tenant: rejected by uq_team_tenant_name.
    await expect(
      queryRunner.query(
        `INSERT INTO "team_entity" ("name", "tenantId") VALUES ('Alpha', $1)`,
        [BOOTSTRAP_TENANT_ID],
      ),
    ).rejects.toMatchObject({
      driverError: { constraint: 'uq_team_tenant_name' },
    });
    await queryRunner.query(
      `INSERT INTO "cleaner_entity" ("fullName", "phone", "email", "tenantId") VALUES ('X', '555', 'in@example.com', $1)`,
      [secondTenant],
    );
    await expect(
      queryRunner.query(
        `INSERT INTO "cleaner_entity" ("fullName", "phone", "email", "tenantId") VALUES ('X', '555', 'in@example.com', $1)`,
        [BOOTSTRAP_TENANT_ID],
      ),
    ).rejects.toMatchObject({
      driverError: { constraint: 'uq_cleaner_tenant_email' },
    });
  });

  it('rejects a cleaner assigned to another tenant’s team and allows no team', async () => {
    // The second-tenant cleaner inserted by the previous case.
    const [{ id: foreignCleaner }] = (await queryRunner.query(
      `SELECT "id" FROM "cleaner_entity" WHERE "tenantId" = $1 LIMIT 1`,
      [secondTenant],
    )) as { id: string }[];
    await expect(
      queryRunner.query(
        `UPDATE "cleaner_entity" SET "teamId" = $1 WHERE "id" = $2`,
        [teamA, foreignCleaner],
      ),
    ).rejects.toMatchObject({
      driverError: { constraint: 'fk_cleaner_team_tenant' },
    });
    const [{ teamId }] = (await queryRunner.query(
      `SELECT "teamId" FROM "cleaner_entity" WHERE "id" = $1`,
      [cleanerNoTeam],
    )) as { teamId: string | null }[];
    expect(teamId).toBeNull();
  });

  it('down restores the pre-tenant schema', async () => {
    await queryRunner.query(
      `DELETE FROM "cleaner_entity" WHERE "tenantId" = $1`,
      [secondTenant],
    );
    await queryRunner.query(
      `DELETE FROM "team_entity" WHERE "tenantId" = $1 OR "name" = 'alpha'`,
      [secondTenant],
    );
    await inTransaction((r) => migration.down(r));
    const constraints = await constraintNames();
    expect(constraints).toEqual(expect.arrayContaining(OLD_CONSTRAINTS));
    for (const added of NEW_CONSTRAINTS) {
      expect(constraints).not.toContain(added);
    }
  });
});
