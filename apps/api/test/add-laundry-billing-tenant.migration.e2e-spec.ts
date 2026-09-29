import { randomUUID } from 'crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import { AddLaundryBillingTenant1790784000000 } from '../src/platform/database/migrations/1790784000000-AddLaundryBillingTenant';
import { connectionOptions, migrationsBefore } from './helpers/migration-db';

const TABLES = [
  'laundry_order_entity',
  'laundry_order_line_entity',
  'invoice_entity',
] as const;

const NEW_CONSTRAINTS = [
  ['laundry_order_entity', 'fk_laundry_order_tenant'],
  ['laundry_order_entity', 'uq_laundry_order_id_tenant'],
  ['laundry_order_entity', 'fk_laundry_order_customer_tenant'],
  ['laundry_order_line_entity', 'fk_laundry_order_line_tenant'],
  ['laundry_order_line_entity', 'fk_laundry_order_line_order_tenant'],
  ['laundry_order_line_entity', 'fk_laundry_order_line_service_tenant'],
  ['laundry_order_line_entity', 'fk_laundry_order_line_add_on_tenant'],
  ['invoice_entity', 'fk_invoice_tenant'],
  ['invoice_entity', 'fk_invoice_laundry_order_tenant'],
  ['invoice_entity', 'fk_invoice_customer_tenant'],
  ['invoice_entity', 'uq_invoice_tenant_number'],
  ['invoice_number_counter', 'fk_invoice_number_counter_tenant'],
] as const;
const OLD_CONSTRAINTS = [
  ['laundry_order_entity', 'fk_laundry_order_customer'],
  ['laundry_order_line_entity', 'fk_laundry_order_line_order'],
  ['laundry_order_line_entity', 'fk_laundry_order_line_service'],
  ['laundry_order_line_entity', 'fk_laundry_order_line_add_on'],
  ['invoice_entity', 'fk_invoice_laundry_order'],
  ['invoice_entity', 'fk_invoice_customer'],
  ['invoice_entity', 'uq_invoice_number'],
] as const;

// Same statement `allocateInvoiceNumber` runs (#87 slice decision 9).
const ALLOCATE_SQL =
  'INSERT INTO "invoice_number_counter" ("tenantId", "lastValue") VALUES ($1, 1) ON CONFLICT ("tenantId") DO UPDATE SET "lastValue" = "invoice_number_counter"."lastValue" + 1 RETURNING "lastValue"';
const MAX_SAFE = '9007199254740991';

type Snapshot = {
  sequence: unknown;
  invoices: unknown;
  constraints: Record<string, string[]>;
};

// A throwaway database migrated to just before `AddLaundryBillingTenant`.
async function createMigrationDb(): Promise<{
  admin: DataSource;
  dataSource: DataSource;
  queryRunner: QueryRunner;
  database: string;
}> {
  const database = `clensy_migration_${randomUUID().replace(/-/g, '')}`;
  const admin = new DataSource(
    connectionOptions(process.env.DB_NAME ?? 'clensy'),
  );
  await admin.initialize();
  await admin.query(`CREATE DATABASE "${database}"`);
  const dataSource = new DataSource({
    ...connectionOptions(database),
    migrations: migrationsBefore('1790784000000'),
  });
  await dataSource.initialize();
  await dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await dataSource.runMigrations();
  return {
    admin,
    database,
    dataSource,
    queryRunner: dataSource.createQueryRunner(),
  };
}

async function dropMigrationDb(db: {
  admin: DataSource;
  dataSource: DataSource;
  queryRunner: QueryRunner;
  database: string;
}): Promise<void> {
  await db.queryRunner?.release();
  await db.dataSource?.destroy();
  await db.admin?.query(`DROP DATABASE IF EXISTS "${db.database}"`);
  await db.admin?.destroy();
}

function fixtures(getRunner: () => QueryRunner) {
  const q = (sql: string, params?: unknown[]) =>
    getRunner().query(sql, params) as Promise<unknown[]>;
  return {
    async insertInvoice(
      orderId: string,
      customerId: string,
      invoiceNumber: string,
      tenantId?: string,
    ): Promise<string> {
      const id = randomUUID();
      const columns = `"id", "invoiceNumber", "laundryOrderId", "customerId", "subtotalMinorUnits", "discountMinorUnits", "totalMinorUnits", "amountPaidMinorUnits", "paymentStatus", "paymentTerms", "issueDate"`;
      if (tenantId === undefined) {
        await q(
          `INSERT INTO "invoice_entity" (${columns}) VALUES ($1, $2, $3, $4, 1000, 0, 1000, 0, 'UNPAID', 'PAY_NOW', now())`,
          [id, invoiceNumber, orderId, customerId],
        );
      } else {
        await q(
          `INSERT INTO "invoice_entity" (${columns}, "tenantId") VALUES ($1, $2, $3, $4, 1000, 0, 1000, 0, 'UNPAID', 'PAY_NOW', now(), $5)`,
          [id, invoiceNumber, orderId, customerId, tenantId],
        );
      }
      return id;
    },
    async insertInvoiceLine(invoiceId: string): Promise<string> {
      const id = randomUUID();
      await q(
        `INSERT INTO "invoice_line_entity" ("id", "invoiceId", "description", "quantity", "unit", "rateMinorUnits", "amountMinorUnits") VALUES ($1, $2, 'Wash', 1, 'FLAT', 1000, 1000)`,
        [id, invoiceId],
      );
      return id;
    },
    async insertLine(
      orderId: string,
      target: { addOnId: string } | { serviceId: string },
      tenantId?: string,
    ): Promise<string> {
      const id = randomUUID();
      const serviceId = 'serviceId' in target ? target.serviceId : null;
      const addOnId = 'addOnId' in target ? target.addOnId : null;
      const columns = `"id", "laundryOrderId", "serviceId", "addOnId", "pricingSnapshotRateMinorUnits", "pricingSnapshotUnit", "pricingSnapshotQuantity", "pricingSnapshotAmountMinorUnits", "pricingSnapshotMinimumChargeApplied"`;
      if (tenantId === undefined) {
        await q(
          `INSERT INTO "laundry_order_line_entity" (${columns}) VALUES ($1, $2, $3, $4, 1000, 'FLAT', 1, 1000, false)`,
          [id, orderId, serviceId, addOnId],
        );
      } else {
        await q(
          `INSERT INTO "laundry_order_line_entity" (${columns}, "tenantId") VALUES ($1, $2, $3, $4, 1000, 'FLAT', 1, 1000, false, $5)`,
          [id, orderId, serviceId, addOnId, tenantId],
        );
      }
      return id;
    },
    async insertOrder(customerId: string, tenantId?: string): Promise<string> {
      const id = randomUUID();
      if (tenantId === undefined) {
        await q(
          `INSERT INTO "laundry_order_entity" ("id", "customerId", "fulfillmentType", "status", "weightGrams", "totalMinorUnits") VALUES ($1, $2, 'PICKUP', 'PRICED', 1000, 1000)`,
          [id, customerId],
        );
      } else {
        await q(
          `INSERT INTO "laundry_order_entity" ("id", "customerId", "tenantId", "fulfillmentType", "status", "weightGrams", "totalMinorUnits") VALUES ($1, $2, $3, 'PICKUP', 'PRICED', 1000, 1000)`,
          [id, customerId, tenantId],
        );
      }
      return id;
    },
  };
}

// #87 Task 1. Same harness as the #82–#86 migration e2e suites: every
// `up`/`down` runs inside an explicit transaction (`inTransaction`), exactly
// as TypeORM's default `migrationsTransactionMode: 'all'` runs it.
// Sequential cases.
describe('AddLaundryBillingTenant migration (real Postgres)', () => {
  let db: Awaited<ReturnType<typeof createMigrationDb>>;
  let queryRunner: QueryRunner;
  const migration = new AddLaundryBillingTenant1790784000000();
  const f = fixtures(() => queryRunner);

  const bootstrapCustomer = randomUUID();
  const bootstrapService = randomUUID();
  const bootstrapAddOn = randomUUID();
  const secondTenant = randomUUID();
  const secondCustomer = randomUUID();
  const secondService = randomUUID();
  const secondAddOn = randomUUID();

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
      `SELECT conname FROM pg_constraint WHERE conrelid = $1::regclass ORDER BY conname`,
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

  async function regclass(name: string): Promise<string | null> {
    const [{ r }]: { r: string | null }[] = await queryRunner.query(
      `SELECT to_regclass($1)::text AS r`,
      [name],
    );
    return r;
  }

  // Committed state, read with no transaction open (F2, F6). Reading the
  // sequence's `last_value` / `is_called` does not advance it.
  async function snapshot(): Promise<Snapshot> {
    const constraints: Record<string, string[]> = {};
    for (const table of TABLES) {
      constraints[table] = await constraintNames(table);
    }
    return {
      constraints,
      invoices: await queryRunner.query(
        `SELECT * FROM "invoice_entity" ORDER BY "id"`,
      ),
      sequence: await queryRunner.query(
        `SELECT last_value, is_called FROM "billing_invoice_number_seq"`,
      ),
    };
  }

  async function expectUntouched(before: Snapshot): Promise<void> {
    expect(queryRunner.isTransactionActive).toBe(false);
    expect(await snapshot()).toEqual(before);
    for (const table of TABLES) {
      expect(await hasTenantColumn(table)).toBe(false);
    }
    expect(await regclass('invoice_number_counter')).toBeNull();
    expect(await regclass('billing_invoice_number_seq')).not.toBeNull();
  }

  async function expectUpRejects(pattern: RegExp): Promise<void> {
    const before = await snapshot();
    await expect(inTransaction((r) => migration.up(r))).rejects.toThrow(
      pattern,
    );
    await expectUntouched(before);
  }

  beforeAll(async () => {
    db = await createMigrationDb();
    queryRunner = db.queryRunner;

    // Bootstrap-tenant fixtures are inserted after the "bootstrap tenant
    // missing" test (below) — their `fk_*_tenant` FKs to `tenant_entity`
    // would block deleting the bootstrap tenant row.
    await queryRunner.query(
      `INSERT INTO "tenant_entity" ("id", "name") VALUES ($1, 'Second')`,
      [secondTenant],
    );
    await queryRunner.query(
      `INSERT INTO "customer_entity" ("id", "tenantId", "fullName", "email", "phone") VALUES ($1, $2, 'Second Customer', 'second@example.com', '555-0002')`,
      [secondCustomer, secondTenant],
    );
    await queryRunner.query(
      `INSERT INTO "service_entity" ("id", "tenantId", "name", "durationMinutes") VALUES ($1, $2, 'Second Wash', 60)`,
      [secondService, secondTenant],
    );
    await queryRunner.query(
      `INSERT INTO "add_on_entity" ("id", "tenantId", "name", "priceMinorUnits") VALUES ($1, $2, 'Second Fold', 500)`,
      [secondAddOn, secondTenant],
    );
  }, 60_000);

  afterAll(async () => {
    await dropMigrationDb(db);
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
      await expectUpRejects(
        new RegExp(
          `AddLaundryBillingTenant: bootstrap tenant ${BOOTSTRAP_TENANT_ID} not found`,
        ),
      );
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
      `INSERT INTO "service_entity" ("id", "tenantId", "name", "durationMinutes") VALUES ($1, $2, 'Wash', 60)`,
      [bootstrapService, BOOTSTRAP_TENANT_ID],
    );
    await queryRunner.query(
      `INSERT INTO "add_on_entity" ("id", "tenantId", "name", "priceMinorUnits") VALUES ($1, $2, 'Fold', 500)`,
      [bootstrapAddOn, BOOTSTRAP_TENANT_ID],
    );
  });

  describe('reachable reference validation aborts (slice decision 12)', () => {
    it('a laundry order on another tenant’s customer', async () => {
      const order = await f.insertOrder(secondCustomer);
      try {
        await expectUpRejects(
          /AddLaundryBillingTenant: .*laundry order\(s\) reference a customer/,
        );
      } finally {
        await queryRunner.query(
          `DELETE FROM "laundry_order_entity" WHERE "id" = $1`,
          [order],
        );
      }
    });

    it.each([
      ['service', () => ({ serviceId: secondService })],
      ['add-on', () => ({ addOnId: secondAddOn })],
    ] as const)(
      'a line whose non-null %s belongs to another tenant',
      async (label, target) => {
        const order = await f.insertOrder(bootstrapCustomer);
        await f.insertLine(order, target());
        try {
          await expectUpRejects(
            new RegExp(
              `AddLaundryBillingTenant: .*laundry line\\(s\\) reference an? ${label}`,
            ),
          );
        } finally {
          await queryRunner.query(
            `DELETE FROM "laundry_order_entity" WHERE "id" = $1`,
            [order],
          );
        }
      },
    );

    it('an invoice on another tenant’s customer', async () => {
      const order = await f.insertOrder(bootstrapCustomer);
      const invoice = await f.insertInvoice(
        order,
        secondCustomer,
        'INV-2026-000001',
      );
      try {
        await expectUpRejects(
          /AddLaundryBillingTenant: .*invoice\(s\) reference a customer/,
        );
      } finally {
        await queryRunner.query(
          `DELETE FROM "invoice_entity" WHERE "id" = $1`,
          [invoice],
        );
        await queryRunner.query(
          `DELETE FROM "laundry_order_entity" WHERE "id" = $1`,
          [order],
        );
      }
    });
  });

  describe('invoice-number validation aborts (slice decision 10)', () => {
    it.each([
      ['LEGACY-7', /invoice number format/],
      ['INV-2026--5', /invoice number format/],
      ['INV-2026-9007199254740992', /invoice number suffix out of range/],
      ['INV-2026-000000', /invoice number suffix out of range/],
      [
        'INV-2026-99999999999999999999999',
        /invoice number suffix out of range/,
      ],
    ])('rejects %s', async (invoiceNumber, pattern) => {
      const order = await f.insertOrder(bootstrapCustomer);
      const invoice = await f.insertInvoice(
        order,
        bootstrapCustomer,
        invoiceNumber,
      );
      try {
        await expectUpRejects(pattern);
      } finally {
        await queryRunner.query(
          `DELETE FROM "invoice_entity" WHERE "id" = $1`,
          [invoice],
        );
        await queryRunner.query(
          `DELETE FROM "laundry_order_entity" WHERE "id" = $1`,
          [order],
        );
      }
    });

    it('rejects a suffix repeated within a tenant across years', async () => {
      const orders = [
        await f.insertOrder(bootstrapCustomer),
        await f.insertOrder(bootstrapCustomer),
      ];
      await f.insertInvoice(orders[0], bootstrapCustomer, 'INV-2025-000010');
      await f.insertInvoice(orders[1], bootstrapCustomer, 'INV-2026-000010');
      try {
        await expectUpRejects(/duplicate invoice number/);
      } finally {
        await queryRunner.query(
          `DELETE FROM "invoice_entity" WHERE "laundryOrderId" = ANY($1)`,
          [orders],
        );
        await queryRunner.query(
          `DELETE FROM "laundry_order_entity" WHERE "id" = ANY($1)`,
          [orders],
        );
      }
    });
  });

  // Happy-path fixtures, inserted by the unreachable-branch case below and
  // migrated by the happy-path case after it.
  let serviceOrder: string;
  let serviceLine: string;
  let addOnOrder: string;
  let serviceInvoice: string;
  let addOnInvoice: string;

  describe('unreachable validation branches, called directly (F3, F5)', () => {
    beforeAll(async () => {
      serviceOrder = await f.insertOrder(bootstrapCustomer);
      serviceLine = await f.insertLine(serviceOrder, {
        serviceId: bootstrapService,
      });
      addOnOrder = await f.insertOrder(bootstrapCustomer);
      await f.insertLine(addOnOrder, { addOnId: bootstrapAddOn });
      serviceInvoice = await f.insertInvoice(
        serviceOrder,
        bootstrapCustomer,
        'INV-2026-000041',
      );
      addOnInvoice = await f.insertInvoice(
        addOnOrder,
        bootstrapCustomer,
        'INV-2026-000042',
      );
      await f.insertInvoiceLine(serviceInvoice);
      await f.insertInvoiceLine(addOnInvoice);
      // Burned sequence values: the counter must seed from 42, not 45.
      await queryRunner.query(
        `SELECT setval('billing_invoice_number_seq', 45)`,
      );
    });

    // Prepares the post-backfill state (steps 1–2) by hand, applies one
    // corruption the id-only FKs still accept, captures `validateBackfill`,
    // then forces a rollback.
    async function problemsAfter(
      corrupt: (r: QueryRunner) => Promise<void>,
    ): Promise<string[]> {
      const before = await snapshot();
      let problems: string[] = [];
      await expect(
        inTransaction(async (r) => {
          for (const table of TABLES) {
            await r.query(`ALTER TABLE "${table}" ADD "tenantId" uuid`);
            await r.query(`UPDATE "${table}" SET "tenantId" = $1`, [
              BOOTSTRAP_TENANT_ID,
            ]);
          }
          await corrupt(r);
          problems =
            await AddLaundryBillingTenant1790784000000.validateBackfill(r);
          throw new Error('rollback');
        }),
      ).rejects.toThrow('rollback');
      await expectUntouched(before);
      return problems;
    }

    it('a line in another tenant than its order', async () => {
      const problems = await problemsAfter(async (r) => {
        // Also move the line's service to that tenant, so only the order
        // check can fire.
        await r.query(
          `UPDATE "laundry_order_line_entity" SET "tenantId" = $1, "serviceId" = $2 WHERE "id" = $3`,
          [secondTenant, secondService, serviceLine],
        );
      });
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(/laundry line\(s\) reference an order/);
    });

    it('an invoice in another tenant than its laundry order', async () => {
      const problems = await problemsAfter(async (r) => {
        // Also move the invoice's customer to that tenant, so only the
        // order check can fire.
        await r.query(
          `UPDATE "invoice_entity" SET "tenantId" = $1, "customerId" = $2 WHERE "id" = $3`,
          [secondTenant, secondCustomer, serviceInvoice],
        );
      });
      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(/invoice\(s\) reference a laundry order/);
    });

    it.each([
      ['laundry_order_entity', () => serviceOrder],
      ['laundry_order_line_entity', () => serviceLine],
      ['invoice_entity', () => serviceInvoice],
    ])('a %s row left without a tenant', async (table, id) => {
      const problems = await problemsAfter(async (r) => {
        await r.query(
          `UPDATE "${table}" SET "tenantId" = NULL WHERE "id" = $1`,
          [id()],
        );
      });
      expect(problems).toEqual([
        `${table}: 1 row(s) without a tenant after backfill`,
      ]);
    });
  });

  it('backfills, swaps to composite FKs, seeds the counter from the max suffix and drops the sequence', async () => {
    await inTransaction((r) => migration.up(r));

    for (const table of TABLES) {
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
      `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname LIKE 'fk_%_tenant' AND conrelid = ANY($1::regclass[])`,
      [[...TABLES]],
    );
    expect(
      Object.fromEntries(defs.map((row) => [row.conname, row.def])),
    ).toEqual({
      fk_invoice_customer_tenant:
        'FOREIGN KEY ("customerId", "tenantId") REFERENCES customer_entity(id, "tenantId") ON DELETE RESTRICT',
      fk_invoice_laundry_order_tenant:
        'FOREIGN KEY ("laundryOrderId", "tenantId") REFERENCES laundry_order_entity(id, "tenantId") ON DELETE RESTRICT',
      fk_invoice_tenant:
        'FOREIGN KEY ("tenantId") REFERENCES tenant_entity(id) ON DELETE RESTRICT',
      fk_laundry_order_customer_tenant:
        'FOREIGN KEY ("customerId", "tenantId") REFERENCES customer_entity(id, "tenantId") ON DELETE RESTRICT',
      fk_laundry_order_line_add_on_tenant:
        'FOREIGN KEY ("addOnId", "tenantId") REFERENCES add_on_entity(id, "tenantId") ON DELETE RESTRICT',
      fk_laundry_order_line_order_tenant:
        'FOREIGN KEY ("laundryOrderId", "tenantId") REFERENCES laundry_order_entity(id, "tenantId") ON DELETE CASCADE',
      fk_laundry_order_line_service_tenant:
        'FOREIGN KEY ("serviceId", "tenantId") REFERENCES service_entity(id, "tenantId") ON DELETE RESTRICT',
      fk_laundry_order_line_tenant:
        'FOREIGN KEY ("tenantId") REFERENCES tenant_entity(id) ON DELETE RESTRICT',
      fk_laundry_order_tenant:
        'FOREIGN KEY ("tenantId") REFERENCES tenant_entity(id) ON DELETE RESTRICT',
    });

    const indexes: { indexname: string }[] = await queryRunner.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = ANY($1)`,
      [['laundry_order_entity', 'invoice_entity']],
    );
    expect(indexes.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        'idx_laundry_order_tenant_created',
        'idx_invoice_tenant_issue',
      ]),
    );

    expect(await constraintNames('invoice_entity')).toContain(
      'uq_invoice_laundry_order',
    );
    expect(await constraintNames('invoice_line_entity')).toContain(
      'fk_invoice_line_invoice',
    );
    expect(await constraintNames('laundry_order_line_entity')).toContain(
      'ck_laundry_order_line_target',
    );
    expect(await constraintNames('laundry_order_entity')).toContain(
      'ck_laundry_order_weight_non_negative',
    );
    // #87 slice decision 2: InvoiceLine is owned via its Invoice.
    expect(await hasTenantColumn('invoice_line_entity')).toBe(false);

    expect(await regclass('billing_invoice_number_seq')).toBeNull();
    expect(
      await queryRunner.query(
        `SELECT "tenantId", "lastValue" FROM "invoice_number_counter"`,
      ),
    ).toEqual([{ tenantId: BOOTSTRAP_TENANT_ID, lastValue: '42' }]);
  });

  it('bounds the counter to the allocator’s safe-integer range (F7)', async () => {
    const setCounter = (value: string) =>
      queryRunner.query(
        `UPDATE "invoice_number_counter" SET "lastValue" = $1 WHERE "tenantId" = $2`,
        [value, BOOTSTRAP_TENANT_ID],
      );
    const counter = async () =>
      (
        (await queryRunner.query(
          `SELECT "lastValue" FROM "invoice_number_counter" WHERE "tenantId" = $1`,
          [BOOTSTRAP_TENANT_ID],
        )) as { lastValue: string }[]
      )[0].lastValue;
    try {
      for (const bad of ['9007199254740992', '-1']) {
        await expect(setCounter(bad)).rejects.toMatchObject({
          driverError: { constraint: 'ck_invoice_number_counter_range' },
        });
      }
      await setCounter(MAX_SAFE);
      await expect(
        queryRunner.query(ALLOCATE_SQL, [BOOTSTRAP_TENANT_ID]),
      ).rejects.toMatchObject({
        driverError: { constraint: 'ck_invoice_number_counter_range' },
      });
      expect(await counter()).toBe(MAX_SAFE);
    } finally {
      await setCounter('42');
    }
  });

  it('rejects each tenant-mismatched reference and allows a per-tenant duplicate number', async () => {
    const reject = (constraint: string) => ({
      driverError: { constraint },
    });

    await expect(
      f.insertOrder(secondCustomer, BOOTSTRAP_TENANT_ID),
    ).rejects.toMatchObject(reject('fk_laundry_order_customer_tenant'));
    // The line's service is moved to the second tenant too, so only the
    // order FK can fire.
    await expect(
      f.insertLine(serviceOrder, { serviceId: secondService }, secondTenant),
    ).rejects.toMatchObject(reject('fk_laundry_order_line_order_tenant'));
    await expect(
      f.insertLine(
        serviceOrder,
        { serviceId: secondService },
        BOOTSTRAP_TENANT_ID,
      ),
    ).rejects.toMatchObject(reject('fk_laundry_order_line_service_tenant'));
    await expect(
      f.insertLine(serviceOrder, { addOnId: secondAddOn }, BOOTSTRAP_TENANT_ID),
    ).rejects.toMatchObject(reject('fk_laundry_order_line_add_on_tenant'));

    const freshOrder = await f.insertOrder(
      bootstrapCustomer,
      BOOTSTRAP_TENANT_ID,
    );
    await expect(
      f.insertInvoice(
        freshOrder,
        secondCustomer,
        'INV-2026-000100',
        secondTenant,
      ),
    ).rejects.toMatchObject(reject('fk_invoice_laundry_order_tenant'));
    await expect(
      f.insertInvoice(
        freshOrder,
        secondCustomer,
        'INV-2026-000100',
        BOOTSTRAP_TENANT_ID,
      ),
    ).rejects.toMatchObject(reject('fk_invoice_customer_tenant'));
    await expect(
      f.insertInvoice(
        freshOrder,
        bootstrapCustomer,
        'INV-2026-000042',
        BOOTSTRAP_TENANT_ID,
      ),
    ).rejects.toMatchObject(reject('uq_invoice_tenant_number'));
    await queryRunner.query(
      `DELETE FROM "laundry_order_entity" WHERE "id" = $1`,
      [freshOrder],
    );

    // Unique per tenant only: the second tenant may hold the same string.
    const secondOrder = await f.insertOrder(secondCustomer, secondTenant);
    await f.insertInvoice(
      secondOrder,
      secondCustomer,
      'INV-2026-000042',
      secondTenant,
    );
  });

  it('deleting an order with no invoice still cascades to its lines', async () => {
    const order = await f.insertOrder(bootstrapCustomer, BOOTSTRAP_TENANT_ID);
    await f.insertLine(
      order,
      { serviceId: bootstrapService },
      BOOTSTRAP_TENANT_ID,
    );
    await queryRunner.query(
      `DELETE FROM "laundry_order_entity" WHERE "id" = $1`,
      [order],
    );
    expect(
      await queryRunner.query(
        `SELECT 1 FROM "laundry_order_line_entity" WHERE "laundryOrderId" = $1`,
        [order],
      ),
    ).toHaveLength(0);
  });

  describe('down (slice decision 15)', () => {
    it('fails loudly, rolling back, while two tenants share a number string', async () => {
      await expect(inTransaction((r) => migration.down(r))).rejects.toThrow(
        /uq_invoice_number/,
      );
      for (const [table, name] of NEW_CONSTRAINTS) {
        expect(await constraintNames(table)).toContain(name);
      }
      expect(
        await queryRunner.query(
          `SELECT "lastValue" FROM "invoice_number_counter" WHERE "tenantId" = $1`,
          [BOOTSTRAP_TENANT_ID],
        ),
      ).toEqual([{ lastValue: '42' }]);
      const indexes: { indexname: string }[] = await queryRunner.query(
        `SELECT indexname FROM pg_indexes WHERE tablename = ANY($1)`,
        [['laundry_order_entity', 'invoice_entity']],
      );
      expect(indexes.map((row) => row.indexname)).toEqual(
        expect.arrayContaining([
          'idx_laundry_order_tenant_created',
          'idx_invoice_tenant_issue',
        ]),
      );
    });

    it('restores the id-only FKs, the global unique and a usable sequence', async () => {
      await queryRunner.query(
        `DELETE FROM "invoice_entity" WHERE "tenantId" = $1`,
        [secondTenant],
      );
      await queryRunner.query(
        `DELETE FROM "laundry_order_entity" WHERE "tenantId" = $1`,
        [secondTenant],
      );
      const counts = async () =>
        Promise.all(
          [...TABLES, 'invoice_line_entity'].map(
            async (table) =>
              (
                (await queryRunner.query(
                  `SELECT count(*) FROM "${table}"`,
                )) as { count: string }[]
              )[0].count,
          ),
        );
      const before = await counts();

      await inTransaction((r) => migration.down(r));

      for (const table of TABLES) {
        expect(await hasTenantColumn(table)).toBe(false);
      }
      const defs: { conname: string; def: string }[] = await queryRunner.query(
        `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conname = ANY($1)`,
        [OLD_CONSTRAINTS.map(([, name]) => name)],
      );
      expect(
        Object.fromEntries(defs.map((row) => [row.conname, row.def])),
      ).toEqual({
        fk_invoice_customer:
          'FOREIGN KEY ("customerId") REFERENCES customer_entity(id) ON DELETE RESTRICT',
        fk_invoice_laundry_order:
          'FOREIGN KEY ("laundryOrderId") REFERENCES laundry_order_entity(id) ON DELETE RESTRICT',
        fk_laundry_order_customer:
          'FOREIGN KEY ("customerId") REFERENCES customer_entity(id) ON DELETE RESTRICT',
        fk_laundry_order_line_add_on:
          'FOREIGN KEY ("addOnId") REFERENCES add_on_entity(id) ON DELETE RESTRICT',
        fk_laundry_order_line_order:
          'FOREIGN KEY ("laundryOrderId") REFERENCES laundry_order_entity(id) ON DELETE CASCADE',
        fk_laundry_order_line_service:
          'FOREIGN KEY ("serviceId") REFERENCES service_entity(id) ON DELETE RESTRICT',
        uq_invoice_number: 'UNIQUE ("invoiceNumber")',
      });
      for (const [table, name] of NEW_CONSTRAINTS) {
        if (table === 'invoice_number_counter') continue;
        expect(await constraintNames(table)).not.toContain(name);
      }
      expect(await regclass('invoice_number_counter')).toBeNull();
      const indexes: { indexname: string }[] = await queryRunner.query(
        `SELECT indexname FROM pg_indexes WHERE tablename = ANY($1)`,
        [['laundry_order_entity', 'invoice_entity']],
      );
      expect(indexes.map((row) => row.indexname)).not.toEqual(
        expect.arrayContaining(['idx_laundry_order_tenant_created']),
      );
      expect(indexes.map((row) => row.indexname)).not.toEqual(
        expect.arrayContaining(['idx_invoice_tenant_issue']),
      );
      expect(await counts()).toEqual(before);

      // Usable, not exact: positioned after the remaining max suffix (42),
      // not the pre-`up` 45 (slice decision 15).
      expect(
        await queryRunner.query(
          `SELECT nextval('billing_invoice_number_seq')::int AS n`,
        ),
      ).toEqual([{ n: 43 }]);
    });
  });
});

describe('AddLaundryBillingTenant migration — maximum supported suffix (F7)', () => {
  let db: Awaited<ReturnType<typeof createMigrationDb>>;
  const f = fixtures(() => db.queryRunner);

  beforeAll(async () => {
    db = await createMigrationDb();
  }, 60_000);

  afterAll(async () => {
    await dropMigrationDb(db);
  });

  it('accepts 2^53 − 1 and seeds the counter with it exactly', async () => {
    const customer = randomUUID();
    await db.queryRunner.query(
      `INSERT INTO "customer_entity" ("id", "tenantId", "fullName", "email", "phone") VALUES ($1, $2, 'Max Customer', 'max@example.com', '555-0009')`,
      [customer, BOOTSTRAP_TENANT_ID],
    );
    const order = await f.insertOrder(customer);
    await f.insertInvoice(order, customer, `INV-2026-${MAX_SAFE}`);

    await db.queryRunner.startTransaction();
    try {
      await new AddLaundryBillingTenant1790784000000().up(db.queryRunner);
      await db.queryRunner.commitTransaction();
    } catch (error) {
      await db.queryRunner.rollbackTransaction();
      throw error;
    }

    expect(
      await db.queryRunner.query(
        `SELECT "tenantId", "lastValue" FROM "invoice_number_counter"`,
      ),
    ).toEqual([{ tenantId: BOOTSTRAP_TENANT_ID, lastValue: MAX_SAFE }]);
  });
});
