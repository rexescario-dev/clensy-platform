import { randomUUID } from 'crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import { AddJobChecklistTenant1790697600000 } from '../src/platform/database/migrations/1790697600000-AddJobChecklistTenant';
import { connectionOptions, migrationsBefore } from './helpers/migration-db';

const NEW_CONSTRAINTS = [
  ['cleaning_job_entity', 'fk_cleaning_job_tenant'],
  ['cleaning_job_entity', 'uq_cleaning_job_id_tenant'],
  ['cleaning_job_entity', 'fk_cleaning_job_booking_tenant'],
  ['cleaning_job_entity', 'fk_cleaning_job_team_tenant'],
  ['checklist_entity', 'fk_checklist_tenant'],
  ['checklist_entity', 'fk_checklist_job_tenant'],
] as const;
const OLD_CONSTRAINTS = [
  ['cleaning_job_entity', 'fk_cleaning_job_booking'],
  ['cleaning_job_entity', 'fk_cleaning_job_team'],
  ['checklist_entity', 'fk_checklist_job'],
] as const;

// #86 Task 1. Same harness as the #82–#85 migration e2e suites: every
// `up`/`down` runs in a transaction exactly as TypeORM runs it. Sequential
// cases.
describe('AddJobChecklistTenant migration (real Postgres)', () => {
  const database = `clensy_migration_${randomUUID().replace(/-/g, '')}`;
  let admin: DataSource;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  const migration = new AddJobChecklistTenant1790697600000();

  const bootstrapCustomer = randomUUID();
  const bootstrapProperty = randomUUID();
  const bootstrapService = randomUUID();
  const bootstrapTeam = randomUUID();
  const secondTenant = randomUUID();
  const secondCustomer = randomUUID();
  const secondProperty = randomUUID();
  const secondService = randomUUID();
  const secondTeam = randomUUID();
  const secondBooking = randomUUID();

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

  async function constraintNames(table: string): Promise<string[]> {
    const rows: { conname: string }[] = await queryRunner.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = $1::regclass`,
      [table],
    );
    return rows.map((row) => row.conname);
  }

  async function hasTenantColumn(table: string): Promise<boolean> {
    const cols: unknown[] = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = 'tenantId'`,
      [table],
    );
    return cols.length > 0;
  }

  async function insertBooking(
    tenantId: string,
    customerId: string,
    propertyId: string,
    serviceId: string,
    id: string = randomUUID(),
  ): Promise<string> {
    await queryRunner.query(
      `INSERT INTO "booking_entity" ("id", "tenantId", "customerId", "propertyId", "serviceId", "scheduledAt", "status", "pricingSnapshotPriceMinorUnits") VALUES ($1, $2, $3, $4, $5, now(), 'PENDING', 1000)`,
      [id, tenantId, customerId, propertyId, serviceId],
    );
    return id;
  }

  async function insertJob(fields: {
    bookingId: string;
    teamId?: string | null;
    tenantId?: string;
  }): Promise<string> {
    const id = randomUUID();
    if (fields.tenantId === undefined) {
      await queryRunner.query(
        `INSERT INTO "cleaning_job_entity" ("id", "bookingId", "teamId", "scheduledAt") VALUES ($1, $2, $3, now())`,
        [id, fields.bookingId, fields.teamId ?? null],
      );
    } else {
      await queryRunner.query(
        `INSERT INTO "cleaning_job_entity" ("id", "bookingId", "teamId", "tenantId", "scheduledAt") VALUES ($1, $2, $3, $4, now())`,
        [id, fields.bookingId, fields.teamId ?? null, fields.tenantId],
      );
    }
    return id;
  }

  async function insertChecklistWithItem(
    jobId: string,
  ): Promise<{ checklistId: string; itemId: string }> {
    const checklistId = randomUUID();
    const itemId = randomUUID();
    await queryRunner.query(
      `INSERT INTO "checklist_entity" ("id", "jobId") VALUES ($1, $2)`,
      [checklistId, jobId],
    );
    await queryRunner.query(
      `INSERT INTO "checklist_item_entity" ("id", "checklistId", "label", "position") VALUES ($1, $2, 'Arrive on site', 0)`,
      [itemId, checklistId],
    );
    return { checklistId, itemId };
  }

  beforeAll(async () => {
    admin = new DataSource(connectionOptions(process.env.DB_NAME ?? 'clensy'));
    await admin.initialize();
    await admin.query(`CREATE DATABASE "${database}"`);
    dataSource = new DataSource({
      ...connectionOptions(database),
      migrations: migrationsBefore('1790697600000'),
    });
    await dataSource.initialize();
    await dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await dataSource.runMigrations();
    queryRunner = dataSource.createQueryRunner();

    // Bootstrap-tenant fixtures are inserted after the "bootstrap tenant
    // missing" test (below) — their `fk_*_tenant` FKs to `tenant_entity`
    // would block deleting the bootstrap tenant row.

    // Second-tenant fixtures.
    await queryRunner.query(
      `INSERT INTO "tenant_entity" ("id", "name") VALUES ($1, 'Second')`,
      [secondTenant],
    );
    await queryRunner.query(
      `INSERT INTO "customer_entity" ("id", "tenantId", "fullName", "email", "phone") VALUES ($1, $2, 'Second Customer', 'second@example.com', '555-0002')`,
      [secondCustomer, secondTenant],
    );
    await queryRunner.query(
      `INSERT INTO "property_entity" ("id", "tenantId", "customerId", "label", "addressLine1", "city", "region", "postalCode") VALUES ($1, $2, $3, 'Home', '2 Main St', 'Cebu', 'Cebu', '6000')`,
      [secondProperty, secondTenant, secondCustomer],
    );
    await queryRunner.query(
      `INSERT INTO "service_entity" ("id", "tenantId", "name", "durationMinutes") VALUES ($1, $2, 'Second Clean', 60)`,
      [secondService, secondTenant],
    );
    await queryRunner.query(
      `INSERT INTO "team_entity" ("id", "tenantId", "name") VALUES ($1, $2, 'Second Team')`,
      [secondTeam, secondTenant],
    );
    await insertBooking(
      secondTenant,
      secondCustomer,
      secondProperty,
      secondService,
      secondBooking,
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
        `AddJobChecklistTenant: bootstrap tenant ${BOOTSTRAP_TENANT_ID} not found — run AddTenantAndAdminScope first`,
      );
      expect(await hasTenantColumn('cleaning_job_entity')).toBe(false);
      expect(await hasTenantColumn('checklist_entity')).toBe(false);
    } finally {
      await queryRunner.query(
        `INSERT INTO "tenant_entity" ("id", "name") VALUES ($1, $2)`,
        [BOOTSTRAP_TENANT_ID, tenant.name],
      );
    }

    // Bootstrap-tenant fixtures, needed by every subsequent test.
    await queryRunner.query(
      `INSERT INTO "customer_entity" ("id", "tenantId", "fullName", "email", "phone") VALUES ($1, $2, 'Bootstrap Customer', 'bootstrap@example.com', '555-0001')`,
      [bootstrapCustomer, BOOTSTRAP_TENANT_ID],
    );
    await queryRunner.query(
      `INSERT INTO "property_entity" ("id", "tenantId", "customerId", "label", "addressLine1", "city", "region", "postalCode") VALUES ($1, $2, $3, 'Home', '1 Main St', 'Cebu', 'Cebu', '6000')`,
      [bootstrapProperty, BOOTSTRAP_TENANT_ID, bootstrapCustomer],
    );
    await queryRunner.query(
      `INSERT INTO "service_entity" ("id", "tenantId", "name", "durationMinutes") VALUES ($1, $2, 'Deep Clean', 60)`,
      [bootstrapService, BOOTSTRAP_TENANT_ID],
    );
    await queryRunner.query(
      `INSERT INTO "team_entity" ("id", "tenantId", "name") VALUES ($1, $2, 'Bootstrap Team')`,
      [bootstrapTeam, BOOTSTRAP_TENANT_ID],
    );
  });

  it('aborts when a job references a booking outside the bootstrap tenant', async () => {
    const badJob = await insertJob({ bookingId: secondBooking });
    try {
      await expect(inTransaction((r) => migration.up(r))).rejects.toThrow(
        /AddJobChecklistTenant: .*booking/,
      );
      expect(await hasTenantColumn('cleaning_job_entity')).toBe(false);
      expect(await hasTenantColumn('checklist_entity')).toBe(false);
      for (const [table, name] of OLD_CONSTRAINTS) {
        expect(await constraintNames(table)).toContain(name);
      }
      const [row]: { bookingId: string }[] = await queryRunner.query(
        `SELECT "bookingId" FROM "cleaning_job_entity" WHERE "id" = $1`,
        [badJob],
      );
      expect(row.bookingId).toBe(secondBooking);
    } finally {
      await queryRunner.query(
        `DELETE FROM "cleaning_job_entity" WHERE "id" = $1`,
        [badJob],
      );
    }
  });

  it('aborts when a non-null teamId belongs to another tenant', async () => {
    const booking = await insertBooking(
      BOOTSTRAP_TENANT_ID,
      bootstrapCustomer,
      bootstrapProperty,
      bootstrapService,
    );
    const badJob = await insertJob({ bookingId: booking, teamId: secondTeam });
    try {
      await expect(inTransaction((r) => migration.up(r))).rejects.toThrow(
        /AddJobChecklistTenant: .*team/,
      );
      expect(await hasTenantColumn('cleaning_job_entity')).toBe(false);
    } finally {
      await queryRunner.query(
        `DELETE FROM "cleaning_job_entity" WHERE "id" = $1`,
        [badJob],
      );
      await queryRunner.query(`DELETE FROM "booking_entity" WHERE "id" = $1`, [
        booking,
      ]);
    }
  });

  let assignedJob: string;
  let unassignedJob: string;

  it('backfills the bootstrap tenant, adds tenant FKs, the unique, composite FKs and the tenant index', async () => {
    const bookingOne = await insertBooking(
      BOOTSTRAP_TENANT_ID,
      bootstrapCustomer,
      bootstrapProperty,
      bootstrapService,
    );
    const bookingTwo = await insertBooking(
      BOOTSTRAP_TENANT_ID,
      bootstrapCustomer,
      bootstrapProperty,
      bootstrapService,
    );
    assignedJob = await insertJob({
      bookingId: bookingOne,
      teamId: bootstrapTeam,
    });
    // `teamId` NULL proves validation does not reject an unassigned job.
    unassignedJob = await insertJob({ bookingId: bookingTwo, teamId: null });
    await insertChecklistWithItem(assignedJob);
    await insertChecklistWithItem(unassignedJob);

    await inTransaction((r) => migration.up(r));

    for (const table of ['cleaning_job_entity', 'checklist_entity']) {
      const rows: { tenantId: string }[] = await queryRunner.query(
        `SELECT "tenantId" FROM "${table}"`,
      );
      expect(rows.length).toBeGreaterThan(0);
      expect(new Set(rows.map((row) => row.tenantId))).toEqual(
        new Set([BOOTSTRAP_TENANT_ID]),
      );
      const [{ is_nullable: isNullable }]: { is_nullable: string }[] =
        await queryRunner.query(
          `SELECT is_nullable FROM information_schema.columns WHERE table_name = $1 AND column_name = 'tenantId'`,
          [table],
        );
      expect(isNullable).toBe('NO');
    }

    for (const [table, name] of NEW_CONSTRAINTS) {
      expect(await constraintNames(table)).toContain(name);
    }
    for (const [table, name] of OLD_CONSTRAINTS) {
      expect(await constraintNames(table)).not.toContain(name);
    }

    const defs: { conname: string; def: string }[] = await queryRunner.query(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = ANY($1)`,
      [
        [
          'fk_cleaning_job_booking_tenant',
          'fk_cleaning_job_team_tenant',
          'fk_checklist_job_tenant',
        ],
      ],
    );
    expect(
      Object.fromEntries(defs.map((row) => [row.conname, row.def])),
    ).toEqual({
      fk_cleaning_job_booking_tenant:
        'FOREIGN KEY ("bookingId", "tenantId") REFERENCES booking_entity(id, "tenantId") ON DELETE RESTRICT',
      fk_cleaning_job_team_tenant:
        'FOREIGN KEY ("teamId", "tenantId") REFERENCES team_entity(id, "tenantId") ON DELETE RESTRICT',
      fk_checklist_job_tenant:
        'FOREIGN KEY ("jobId", "tenantId") REFERENCES cleaning_job_entity(id, "tenantId") ON DELETE CASCADE',
    });

    const indexes: { indexname: string }[] = await queryRunner.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'cleaning_job_entity'`,
    );
    expect(indexes.map((row) => row.indexname)).toContain(
      'idx_cleaning_job_tenant_scheduled',
    );

    expect(await constraintNames('cleaning_job_entity')).toContain(
      'UQ_cleaning_job_booking_id',
    );
    expect(await constraintNames('checklist_entity')).toContain(
      'UQ_checklist_job_id',
    );
    expect(await constraintNames('checklist_item_entity')).toContain(
      'fk_checklist_item_checklist',
    );
    // #86 slice decision 2: ChecklistItem is owned via its Checklist.
    expect(await hasTenantColumn('checklist_item_entity')).toBe(false);
  });

  it('rejects a composite parent FK mismatch for each reference and accepts a null teamId', async () => {
    const booking = await insertBooking(
      BOOTSTRAP_TENANT_ID,
      bootstrapCustomer,
      bootstrapProperty,
      bootstrapService,
    );

    await expect(
      insertJob({ bookingId: secondBooking, tenantId: BOOTSTRAP_TENANT_ID }),
    ).rejects.toMatchObject({
      driverError: { constraint: 'fk_cleaning_job_booking_tenant' },
    });
    await expect(
      insertJob({
        bookingId: booking,
        teamId: secondTeam,
        tenantId: BOOTSTRAP_TENANT_ID,
      }),
    ).rejects.toMatchObject({
      driverError: { constraint: 'fk_cleaning_job_team_tenant' },
    });
    // A job with no checklist yet, so `UQ_checklist_job_id` cannot fire
    // first. Its `teamId` is NULL, which also proves the unassigned state
    // is accepted.
    const nullTeam = await insertJob({
      bookingId: booking,
      teamId: null,
      tenantId: BOOTSTRAP_TENANT_ID,
    });
    await expect(
      queryRunner.query(
        `INSERT INTO "checklist_entity" ("id", "jobId", "tenantId") VALUES ($1, $2, $3)`,
        [randomUUID(), nullTeam, secondTenant],
      ),
    ).rejects.toMatchObject({
      driverError: { constraint: 'fk_checklist_job_tenant' },
    });

    await queryRunner.query(
      `DELETE FROM "cleaning_job_entity" WHERE "id" = $1`,
      [nullTeam],
    );
    await queryRunner.query(`DELETE FROM "booking_entity" WHERE "id" = $1`, [
      booking,
    ]);
  });

  it('deleting a job still cascades to its checklist and items', async () => {
    const [{ id: checklistId }]: { id: string }[] = await queryRunner.query(
      `SELECT "id" FROM "checklist_entity" WHERE "jobId" = $1`,
      [assignedJob],
    );
    await queryRunner.query(
      `DELETE FROM "cleaning_job_entity" WHERE "id" = $1`,
      [assignedJob],
    );
    expect(
      await queryRunner.query(
        `SELECT 1 FROM "checklist_entity" WHERE "id" = $1`,
        [checklistId],
      ),
    ).toHaveLength(0);
    expect(
      await queryRunner.query(
        `SELECT 1 FROM "checklist_item_entity" WHERE "checklistId" = $1`,
        [checklistId],
      ),
    ).toHaveLength(0);
  });

  it('down restores the id-only FKs and drops the tenant columns, index, unique and composite FKs', async () => {
    const counts = async () =>
      Promise.all(
        [
          'cleaning_job_entity',
          'checklist_entity',
          'checklist_item_entity',
        ].map(
          async (table) =>
            (
              (await queryRunner.query(`SELECT count(*) FROM "${table}"`)) as {
                count: string;
              }[]
            )[0].count,
        ),
      );
    const before = await counts();

    await inTransaction((r) => migration.down(r));

    expect(await hasTenantColumn('cleaning_job_entity')).toBe(false);
    expect(await hasTenantColumn('checklist_entity')).toBe(false);

    const defs: { conname: string; def: string }[] = await queryRunner.query(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = ANY($1)`,
      [OLD_CONSTRAINTS.map(([, name]) => name)],
    );
    expect(
      Object.fromEntries(defs.map((row) => [row.conname, row.def])),
    ).toEqual({
      fk_cleaning_job_booking:
        'FOREIGN KEY ("bookingId") REFERENCES booking_entity(id) ON DELETE RESTRICT',
      fk_cleaning_job_team:
        'FOREIGN KEY ("teamId") REFERENCES team_entity(id) ON DELETE RESTRICT',
      fk_checklist_job:
        'FOREIGN KEY ("jobId") REFERENCES cleaning_job_entity(id) ON DELETE CASCADE',
    });

    for (const [table, name] of NEW_CONSTRAINTS) {
      expect(await constraintNames(table)).not.toContain(name);
    }
    const indexes: { indexname: string }[] = await queryRunner.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'cleaning_job_entity'`,
    );
    expect(indexes.map((row) => row.indexname)).not.toContain(
      'idx_cleaning_job_tenant_scheduled',
    );

    expect(await counts()).toEqual(before);
  });
});
