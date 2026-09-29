import { randomUUID } from 'crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import { AddBookingTenant1790611200000 } from '../src/platform/database/migrations/1790611200000-AddBookingTenant';
import { connectionOptions, migrationsBefore } from './helpers/migration-db';

const NEW_CONSTRAINTS = [
  'fk_booking_tenant',
  'uq_booking_id_tenant',
  'fk_booking_customer_tenant',
  'fk_booking_property_tenant',
  'fk_booking_service_tenant',
  'fk_booking_team_tenant',
];
const OLD_CONSTRAINTS = [
  'fk_booking_customer',
  'fk_booking_property',
  'fk_booking_service',
  'fk_booking_team',
];

// #85 Task 2. Same harness as the #82/#83/#84 migration e2e suites: every
// `up`/`down` runs in a transaction exactly as TypeORM runs it. Sequential
// cases.
describe('AddBookingTenant migration (real Postgres)', () => {
  const database = `clensy_migration_${randomUUID().replace(/-/g, '')}`;
  let admin: DataSource;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  const migration = new AddBookingTenant1790611200000();

  const bootstrapCustomer = randomUUID();
  const bootstrapProperty = randomUUID();
  const bootstrapService = randomUUID();
  const bootstrapTeam = randomUUID();
  const secondTenant = randomUUID();
  const secondCustomer = randomUUID();
  const secondProperty = randomUUID();
  const secondService = randomUUID();
  const secondTeam = randomUUID();

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
      `SELECT conname FROM pg_constraint WHERE conrelid = 'booking_entity'::regclass`,
    );
    return rows.map((row) => row.conname);
  }

  async function indexNames(): Promise<string[]> {
    const rows: { indexname: string }[] = await queryRunner.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'booking_entity'`,
    );
    return rows.map((row) => row.indexname);
  }

  async function insertBooking(fields: {
    customerId: string;
    propertyId: string;
    serviceId: string;
    teamId?: string | null;
    tenantId?: string;
  }): Promise<string> {
    const id = randomUUID();
    if (fields.tenantId === undefined) {
      await queryRunner.query(
        `INSERT INTO "booking_entity" ("id", "customerId", "propertyId", "serviceId", "teamId", "scheduledAt", "status", "pricingSnapshotPriceMinorUnits") VALUES ($1, $2, $3, $4, $5, now(), 'PENDING', 1000)`,
        [
          id,
          fields.customerId,
          fields.propertyId,
          fields.serviceId,
          fields.teamId ?? null,
        ],
      );
    } else {
      await queryRunner.query(
        `INSERT INTO "booking_entity" ("id", "customerId", "propertyId", "serviceId", "teamId", "tenantId", "scheduledAt", "status", "pricingSnapshotPriceMinorUnits") VALUES ($1, $2, $3, $4, $5, $6, now(), 'PENDING', 1000)`,
        [
          id,
          fields.customerId,
          fields.propertyId,
          fields.serviceId,
          fields.teamId ?? null,
          fields.tenantId,
        ],
      );
    }
    return id;
  }

  beforeAll(async () => {
    admin = new DataSource(connectionOptions(process.env.DB_NAME ?? 'clensy'));
    await admin.initialize();
    await admin.query(`CREATE DATABASE "${database}"`);
    dataSource = new DataSource({
      ...connectionOptions(database),
      migrations: migrationsBefore('1790611200000'),
    });
    await dataSource.initialize();
    await dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await dataSource.runMigrations();
    queryRunner = dataSource.createQueryRunner();

    // Bootstrap-tenant fixtures are inserted after the "bootstrap tenant
    // missing" test (below) — they carry `fk_*_tenant` FKs to
    // `tenant_entity` (from the #82/#83/#84 migrations, already applied
    // here) that would block deleting the bootstrap tenant row.

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
        `AddBookingTenant: bootstrap tenant ${BOOTSTRAP_TENANT_ID} not found — run AddTenantAndAdminScope first`,
      );
      const cols: unknown[] = await queryRunner.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'booking_entity' AND column_name = 'tenantId'`,
      );
      expect(cols).toHaveLength(0);
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

  it('aborts when a booking references a customer/property outside the bootstrap tenant', async () => {
    const badBooking = await insertBooking({
      customerId: secondCustomer,
      propertyId: secondProperty,
      serviceId: bootstrapService,
    });
    try {
      await expect(inTransaction((r) => migration.up(r))).rejects.toThrow(
        /AddBookingTenant: .*customer/,
      );
      const cols: unknown[] = await queryRunner.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'booking_entity' AND column_name = 'tenantId'`,
      );
      expect(cols).toHaveLength(0);
      const constraints = await constraintNames();
      for (const name of OLD_CONSTRAINTS) {
        expect(constraints).toContain(name);
      }
      const [row]: { customerId: string }[] = await queryRunner.query(
        `SELECT "customerId" FROM "booking_entity" WHERE "id" = $1`,
        [badBooking],
      );
      expect(row.customerId).toBe(secondCustomer);
    } finally {
      await queryRunner.query(`DELETE FROM "booking_entity" WHERE "id" = $1`, [
        badBooking,
      ]);
    }
  });

  it('aborts when a non-null teamId belongs to another tenant', async () => {
    const badBooking = await insertBooking({
      customerId: bootstrapCustomer,
      propertyId: bootstrapProperty,
      serviceId: bootstrapService,
      teamId: secondTeam,
    });
    try {
      await expect(inTransaction((r) => migration.up(r))).rejects.toThrow(
        /AddBookingTenant: .*team/,
      );
      const cols: unknown[] = await queryRunner.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name = 'booking_entity' AND column_name = 'tenantId'`,
      );
      expect(cols).toHaveLength(0);
    } finally {
      await queryRunner.query(`DELETE FROM "booking_entity" WHERE "id" = $1`, [
        badBooking,
      ]);
    }
  });

  it('backfills the bootstrap tenant, adds the tenant FK/unique/composite FKs, and the tenant index', async () => {
    const withTeam = await insertBooking({
      customerId: bootstrapCustomer,
      propertyId: bootstrapProperty,
      serviceId: bootstrapService,
      teamId: bootstrapTeam,
    });
    // `teamId` NULL proves validation does not reject an unassigned booking.
    const withoutTeam = await insertBooking({
      customerId: bootstrapCustomer,
      propertyId: bootstrapProperty,
      serviceId: bootstrapService,
      teamId: null,
    });

    await inTransaction((r) => migration.up(r));

    const rows: { id: string; tenantId: string }[] = await queryRunner.query(
      `SELECT "id", "tenantId" FROM "booking_entity"`,
    );
    expect(rows).toEqual(
      expect.arrayContaining([
        { id: withTeam, tenantId: BOOTSTRAP_TENANT_ID },
        { id: withoutTeam, tenantId: BOOTSTRAP_TENANT_ID },
      ]),
    );
    expect(new Set(rows.map((row) => row.tenantId))).toEqual(
      new Set([BOOTSTRAP_TENANT_ID]),
    );

    const [{ is_nullable: isNullable }]: { is_nullable: string }[] =
      await queryRunner.query(
        `SELECT is_nullable FROM information_schema.columns WHERE table_name = 'booking_entity' AND column_name = 'tenantId'`,
      );
    expect(isNullable).toBe('NO');

    const constraints = await constraintNames();
    expect(constraints).toEqual(expect.arrayContaining(NEW_CONSTRAINTS));
    for (const old of OLD_CONSTRAINTS) {
      expect(constraints).not.toContain(old);
    }

    const indexes = await indexNames();
    expect(indexes).toContain('idx_booking_tenant_scheduled');

    // `fk_cleaning_job_booking` is untouched by this migration (#86 owns it).
    const jobConstraints: { conname: string }[] = await queryRunner.query(
      `SELECT conname FROM pg_constraint WHERE conname = 'fk_cleaning_job_booking'`,
    );
    expect(jobConstraints).toHaveLength(1);
  });

  it('rejects a composite parent FK mismatch for each reference and accepts a null teamId', async () => {
    await expect(
      insertBooking({
        customerId: secondCustomer,
        propertyId: bootstrapProperty,
        serviceId: bootstrapService,
        teamId: bootstrapTeam,
        tenantId: BOOTSTRAP_TENANT_ID,
      }),
    ).rejects.toMatchObject({
      driverError: { constraint: 'fk_booking_customer_tenant' },
    });
    await expect(
      insertBooking({
        customerId: bootstrapCustomer,
        propertyId: secondProperty,
        serviceId: bootstrapService,
        teamId: bootstrapTeam,
        tenantId: BOOTSTRAP_TENANT_ID,
      }),
    ).rejects.toMatchObject({
      driverError: { constraint: 'fk_booking_property_tenant' },
    });
    await expect(
      insertBooking({
        customerId: bootstrapCustomer,
        propertyId: bootstrapProperty,
        serviceId: secondService,
        teamId: bootstrapTeam,
        tenantId: BOOTSTRAP_TENANT_ID,
      }),
    ).rejects.toMatchObject({
      driverError: { constraint: 'fk_booking_service_tenant' },
    });
    await expect(
      insertBooking({
        customerId: bootstrapCustomer,
        propertyId: bootstrapProperty,
        serviceId: bootstrapService,
        teamId: secondTeam,
        tenantId: BOOTSTRAP_TENANT_ID,
      }),
    ).rejects.toMatchObject({
      driverError: { constraint: 'fk_booking_team_tenant' },
    });

    const nullTeam = await insertBooking({
      customerId: bootstrapCustomer,
      propertyId: bootstrapProperty,
      serviceId: bootstrapService,
      teamId: null,
      tenantId: BOOTSTRAP_TENANT_ID,
    });
    await queryRunner.query(`DELETE FROM "booking_entity" WHERE "id" = $1`, [
      nullTeam,
    ]);
  });

  it('down restores the id-only FKs and drops the tenant column, index, and composite FKs', async () => {
    const [{ count: beforeCount }]: { count: string }[] =
      await queryRunner.query(`SELECT count(*) FROM "booking_entity"`);

    await inTransaction((r) => migration.down(r));

    const cols: unknown[] = await queryRunner.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name = 'booking_entity' AND column_name = 'tenantId'`,
    );
    expect(cols).toHaveLength(0);

    const defs: { conname: string; def: string }[] = await queryRunner.query(
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = ANY($1)`,
      [OLD_CONSTRAINTS],
    );
    expect(
      Object.fromEntries(defs.map((row) => [row.conname, row.def])),
    ).toEqual({
      fk_booking_customer:
        'FOREIGN KEY ("customerId") REFERENCES customer_entity(id) ON DELETE RESTRICT',
      fk_booking_property:
        'FOREIGN KEY ("propertyId") REFERENCES property_entity(id) ON DELETE RESTRICT',
      fk_booking_service:
        'FOREIGN KEY ("serviceId") REFERENCES service_entity(id) ON DELETE RESTRICT',
      fk_booking_team:
        'FOREIGN KEY ("teamId") REFERENCES team_entity(id) ON DELETE RESTRICT',
    });

    const constraints = await constraintNames();
    const indexes = await indexNames();
    for (const added of NEW_CONSTRAINTS) {
      expect(constraints).not.toContain(added);
    }
    expect(indexes).not.toContain('idx_booking_tenant_scheduled');

    const [{ count: afterCount }]: { count: string }[] =
      await queryRunner.query(`SELECT count(*) FROM "booking_entity"`);
    expect(afterCount).toBe(beforeCount);
  });
});
