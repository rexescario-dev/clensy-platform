import { randomUUID } from 'crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import { AddLaundryLineDescription1790956800000 } from '../src/platform/database/migrations/1790956800000-AddLaundryLineDescription';
import { connectionOptions, migrationsBefore } from './helpers/migration-db';

const LINE_COLUMNS = `"id", "tenantId", "laundryOrderId", "serviceId", "addOnId", "pricingSnapshotRateMinorUnits", "pricingSnapshotUnit", "pricingSnapshotQuantity", "pricingSnapshotAmountMinorUnits", "pricingSnapshotMinimumChargeApplied"`;

// #159 (lifecycle spec Amendment #164 §8.4.2): adds
// `pricingSnapshotDescription`, backfills it from the catalog name current at
// migration time (`Service.name`, or `AddOn.name || ' (add-on)'`, joined on
// id AND tenant), enforces `not null`, and down() drops only the column — on
// a throwaway database migrated to just before it. Sequential cases.
describe('AddLaundryLineDescription migration (real Postgres)', () => {
  const database = `clensy_migration_${randomUUID().replace(/-/g, '')}`;
  const migration = new AddLaundryLineDescription1790956800000();
  let admin: DataSource;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  const secondTenant = randomUUID();
  const serviceLine = randomUUID();
  const addOnLines = [randomUUID(), randomUUID()];
  const secondTenantLine = randomUUID();
  const bootstrapService = randomUUID();

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

  async function descriptionColumn(): Promise<
    { data_type: string; is_nullable: string } | undefined
  > {
    const rows = await dataSource.query(
      `SELECT "data_type", "is_nullable" FROM information_schema.columns WHERE "table_name" = 'laundry_order_line_entity' AND "column_name" = 'pricingSnapshotDescription'`,
    );
    return rows[0];
  }

  async function description(lineId: string): Promise<string> {
    const [row] = await dataSource.query(
      `SELECT "pricingSnapshotDescription" AS "description" FROM "laundry_order_line_entity" WHERE "id" = $1`,
      [lineId],
    );
    return row.description;
  }

  async function lineCount(): Promise<number> {
    const [{ count }] = await dataSource.query(
      `SELECT COUNT(*)::int AS "count" FROM "laundry_order_line_entity"`,
    );
    return count;
  }

  // One customer, service, add-on and PRICED order in `tenantId`; returns
  // their ids.
  async function seedTenant(
    tenantId: string,
    names: { service: string; addOn: string },
    serviceId: string = randomUUID(),
  ): Promise<{ addOnId: string; orderId: string; serviceId: string }> {
    const customerId = randomUUID();
    const addOnId = randomUUID();
    const orderId = randomUUID();
    await dataSource.query(
      `INSERT INTO "customer_entity" ("id", "tenantId", "fullName", "email", "phone") VALUES ($1, $2, 'Line Customer', $3, '555-0100')`,
      [customerId, tenantId, `${customerId}@example.com`],
    );
    await dataSource.query(
      `INSERT INTO "service_entity" ("id", "tenantId", "name", "durationMinutes") VALUES ($1, $2, $3, 60)`,
      [serviceId, tenantId, names.service],
    );
    await dataSource.query(
      `INSERT INTO "add_on_entity" ("id", "tenantId", "name", "priceMinorUnits") VALUES ($1, $2, $3, 500)`,
      [addOnId, tenantId, names.addOn],
    );
    await dataSource.query(
      `INSERT INTO "laundry_order_entity" ("id", "customerId", "tenantId", "fulfillmentType", "status", "weightGrams", "totalMinorUnits") VALUES ($1, $2, $3, 'PICKUP', 'PRICED', 1000, 1000)`,
      [orderId, customerId, tenantId],
    );
    return { addOnId, orderId, serviceId };
  }

  async function insertLine(
    id: string,
    tenantId: string,
    orderId: string,
    target: { addOnId: string } | { serviceId: string },
  ): Promise<void> {
    await dataSource.query(
      `INSERT INTO "laundry_order_line_entity" (${LINE_COLUMNS}) VALUES ($1, $2, $3, $4, $5, 1000, 'FLAT', 1, 1000, false)`,
      [
        id,
        tenantId,
        orderId,
        'serviceId' in target ? target.serviceId : null,
        'addOnId' in target ? target.addOnId : null,
      ],
    );
  }

  beforeAll(async () => {
    admin = new DataSource(connectionOptions(process.env.DB_NAME ?? 'clensy'));
    await admin.initialize();
    await admin.query(`CREATE DATABASE "${database}"`);
    dataSource = new DataSource({
      ...connectionOptions(database),
      migrations: migrationsBefore('1790956800000'),
    });
    await dataSource.initialize();
    await dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await dataSource.runMigrations();
    queryRunner = dataSource.createQueryRunner();

    const bootstrap = await seedTenant(
      BOOTSTRAP_TENANT_ID,
      { addOn: 'Ironing', service: 'Wash & Fold' },
      bootstrapService,
    );
    await insertLine(serviceLine, BOOTSTRAP_TENANT_ID, bootstrap.orderId, {
      serviceId: bootstrap.serviceId,
    });
    // A repeated add-on: two lines on the same add-on (§8.4.3).
    for (const id of addOnLines) {
      await insertLine(id, BOOTSTRAP_TENANT_ID, bootstrap.orderId, {
        addOnId: bootstrap.addOnId,
      });
    }

    await dataSource.query(
      `INSERT INTO "tenant_entity" ("id", "name") VALUES ($1, 'Second')`,
      [secondTenant],
    );
    const second = await seedTenant(secondTenant, {
      addOn: 'Other Fold',
      service: 'Other Wash',
    });
    await insertLine(secondTenantLine, secondTenant, second.orderId, {
      serviceId: second.serviceId,
    });
  }, 120_000);

  afterAll(async () => {
    await queryRunner?.release();
    await dataSource?.destroy();
    await admin?.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin?.destroy();
  });

  it('up() adds a text column, backfills every line from its catalog row and enforces not null', async () => {
    expect(await descriptionColumn()).toBeUndefined();

    await inTransaction((r) => migration.up(r));

    expect(await descriptionColumn()).toEqual({
      data_type: 'text',
      is_nullable: 'NO',
    });
    expect(await description(serviceLine)).toBe('Wash & Fold');
    for (const id of addOnLines) {
      expect(await description(id)).toBe('Ironing (add-on)');
    }
    expect(await description(secondTenantLine)).toBe('Other Wash');
  });

  it('copies the name current at migration time; a later rename does not change it', async () => {
    await dataSource.query(
      `UPDATE "service_entity" SET "name" = 'Renamed' WHERE "id" = $1`,
      [bootstrapService],
    );

    expect(await description(serviceLine)).toBe('Wash & Fold');
  });

  it('down() drops only the column and keeps every line row', async () => {
    const before = await lineCount();

    await inTransaction((r) => migration.down(r));

    expect(await descriptionColumn()).toBeUndefined();
    expect(await lineCount()).toBe(before);
  });

  it('up() succeeds on an empty line table and still enforces not null', async () => {
    await dataSource.query(`DELETE FROM "laundry_order_line_entity"`);

    await inTransaction((r) => migration.up(r));

    expect(await descriptionColumn()).toEqual({
      data_type: 'text',
      is_nullable: 'NO',
    });
  });
});
