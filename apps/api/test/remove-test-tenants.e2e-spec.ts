import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { TenantEntity } from '../src/modules/admins/infrastructure/persistence/tenant.entity';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import {
  acquireBillingDbTestLock,
  BillingDbTestLock,
} from './helpers/billing-db-test-lock';
import {
  acquireLaundryDbTestLock,
  LaundryDbTestLock,
} from './helpers/laundry-db-test-lock';
import { connectionOptions } from './helpers/migration-db';
import {
  createTestTenant,
  removeTestTenants,
} from './helpers/seed-tenant-admin';

const BOOTSTRAP_COUNTED = [
  'laundry_order_entity',
  'laundry_order_line_entity',
  'invoice_entity',
  'invoice_line_entity',
  'invoice_number_counter',
] as const;

// #87 Task 1 Step 5 (F8): `removeTestTenants` removes a test tenant's whole
// laundry/billing graph — order, lines, invoice, invoice lines and counter
// row — without a RESTRICT FK blocking it, and never touches the bootstrap
// tenant's rows.
describe('removeTestTenants — laundry & billing rows (#87)', () => {
  let dataSource: DataSource;
  let billingLock: BillingDbTestLock;
  let laundryLock: LaundryDbTestLock;

  beforeAll(async () => {
    dataSource = new DataSource({
      ...connectionOptions(process.env.DB_NAME ?? 'clensy'),
      entities: [TenantEntity],
    });
    await dataSource.initialize();
    billingLock = await acquireBillingDbTestLock(dataSource);
    laundryLock = await acquireLaundryDbTestLock(dataSource);
  });

  afterAll(async () => {
    await laundryLock?.release();
    await billingLock?.release();
    await dataSource?.destroy();
  });

  const count = async (sql: string, params: unknown[]): Promise<number> =>
    (await dataSource.query(sql, params))[0].count;

  const bootstrapState = async () => {
    const counts: Record<string, number> = {};
    for (const table of BOOTSTRAP_COUNTED) {
      counts[table] =
        table === 'invoice_line_entity'
          ? await count(
              `SELECT COUNT(*)::int AS "count" FROM "invoice_line_entity" l JOIN "invoice_entity" i ON i."id" = l."invoiceId" WHERE i."tenantId" = $1`,
              [BOOTSTRAP_TENANT_ID],
            )
          : await count(
              `SELECT COUNT(*)::int AS "count" FROM "${table}" WHERE "tenantId" = $1`,
              [BOOTSTRAP_TENANT_ID],
            );
    }
    const counter: unknown = await dataSource.query(
      `SELECT "lastValue" FROM "invoice_number_counter" WHERE "tenantId" = $1`,
      [BOOTSTRAP_TENANT_ID],
    );
    return { counter, counts };
  };

  it('removes the tenant’s orders, lines, invoices, invoice lines and counter row', async () => {
    const before = await bootstrapState();

    const tenantId = await createTestTenant(dataSource);
    const customer = randomUUID();
    const service = randomUUID();
    const addOn = randomUUID();
    const order = randomUUID();
    const invoice = randomUUID();
    await dataSource.query(
      `INSERT INTO "customer_entity" ("id", "tenantId", "fullName", "email", "phone") VALUES ($1, $2, 'Cleanup Customer', $3, '555-0100')`,
      [customer, tenantId, `cleanup-${customer}@example.com`],
    );
    await dataSource.query(
      `INSERT INTO "service_entity" ("id", "tenantId", "name", "durationMinutes") VALUES ($1, $2, $3, 60)`,
      [service, tenantId, `Cleanup Wash ${service}`],
    );
    await dataSource.query(
      `INSERT INTO "add_on_entity" ("id", "tenantId", "name", "priceMinorUnits") VALUES ($1, $2, $3, 500)`,
      [addOn, tenantId, `Cleanup Fold ${addOn}`],
    );
    await dataSource.query(
      `INSERT INTO "laundry_order_entity" ("id", "tenantId", "customerId", "fulfillmentType", "status", "weightGrams", "totalMinorUnits") VALUES ($1, $2, $3, 'PICKUP', 'PRICED', 1000, 1500)`,
      [order, tenantId, customer],
    );
    for (const [serviceId, addOnId] of [
      [service, null],
      [null, addOn],
    ]) {
      await dataSource.query(
        `INSERT INTO "laundry_order_line_entity" ("tenantId", "laundryOrderId", "serviceId", "addOnId", "pricingSnapshotRateMinorUnits", "pricingSnapshotUnit", "pricingSnapshotQuantity", "pricingSnapshotAmountMinorUnits", "pricingSnapshotMinimumChargeApplied") VALUES ($1, $2, $3, $4, 1000, 'FLAT', 1, 1000, false)`,
        [tenantId, order, serviceId, addOnId],
      );
    }
    await dataSource.query(
      `INSERT INTO "invoice_entity" ("id", "tenantId", "invoiceNumber", "laundryOrderId", "customerId", "subtotalMinorUnits", "discountMinorUnits", "totalMinorUnits", "amountPaidMinorUnits", "paymentStatus", "paymentTerms", "issueDate") VALUES ($1, $2, 'INV-2026-000001', $3, $4, 1500, 0, 1500, 0, 'UNPAID', 'PAY_NOW', now())`,
      [invoice, tenantId, order, customer],
    );
    await dataSource.query(
      `INSERT INTO "invoice_line_entity" ("invoiceId", "description", "quantity", "unit", "rateMinorUnits", "amountMinorUnits") VALUES ($1, 'Wash', 1, 'FLAT', 1500, 1500)`,
      [invoice],
    );
    await dataSource.query(
      `INSERT INTO "invoice_number_counter" ("tenantId", "lastValue") VALUES ($1, 1)`,
      [tenantId],
    );

    await expect(
      removeTestTenants(dataSource, [tenantId]),
    ).resolves.toBeUndefined();

    for (const [sql, params] of [
      [
        `SELECT COUNT(*)::int AS "count" FROM "laundry_order_entity" WHERE "tenantId" = $1`,
        [tenantId],
      ],
      [
        `SELECT COUNT(*)::int AS "count" FROM "laundry_order_line_entity" WHERE "tenantId" = $1 OR "laundryOrderId" = $2`,
        [tenantId, order],
      ],
      [
        `SELECT COUNT(*)::int AS "count" FROM "invoice_entity" WHERE "tenantId" = $1 OR "id" = $2`,
        [tenantId, invoice],
      ],
      [
        `SELECT COUNT(*)::int AS "count" FROM "invoice_line_entity" WHERE "invoiceId" = $1`,
        [invoice],
      ],
      [
        `SELECT COUNT(*)::int AS "count" FROM "invoice_number_counter" WHERE "tenantId" = $1`,
        [tenantId],
      ],
      [
        `SELECT COUNT(*)::int AS "count" FROM "customer_entity" WHERE "tenantId" = $1`,
        [tenantId],
      ],
      [
        `SELECT COUNT(*)::int AS "count" FROM "service_entity" WHERE "tenantId" = $1`,
        [tenantId],
      ],
      [
        `SELECT COUNT(*)::int AS "count" FROM "add_on_entity" WHERE "tenantId" = $1`,
        [tenantId],
      ],
      [
        `SELECT COUNT(*)::int AS "count" FROM "tenant_entity" WHERE "id" = $1`,
        [tenantId],
      ],
    ] as const) {
      expect({ sql, remaining: await count(sql, [...params]) }).toEqual({
        sql,
        remaining: 0,
      });
    }

    expect(await bootstrapState()).toEqual(before);
  });
});
