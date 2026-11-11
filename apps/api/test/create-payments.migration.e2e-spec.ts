import { randomUUID } from 'crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import { CreatePayments1791043200000 } from '../src/platform/database/migrations/1791043200000-CreatePayments';
import { migrationsBefore } from './helpers/migration-db';
import {
  e2eConnectionOptions,
  ScratchDatabases,
} from './support/e2e-connection';

// One registry per file: scratch databases are created and dropped only
// through it (E2E isolation spec §4.5 item 2, invariant 4).
const scratch = new ScratchDatabases();

const PAYMENT_COLUMNS = `"id", "tenantId", "invoiceId", "type", "method", "amountMinorUnits", "status", "paidAt", "refundedPaymentId", "recordedByStaffId", "idempotencyKey"`;

interface PaymentRow {
  amountMinorUnits?: number;
  id?: string;
  idempotencyKey?: string;
  invoiceId: string;
  recordedByStaffId?: string | null;
  refundedPaymentId?: string | null;
  tenantId: string;
  type?: 'PAYMENT' | 'REFUND';
}

// #39 (payments spec §4.2, §4.9; Amendment #39 §9.1 items 1, 5): adds
// `OVERPAID` / `REFUNDED` to `invoice_payment_status_enum`, the
// `uq_invoice_id_tenant` / `uq_admin_user_id_tenant` composite-FK targets,
// and `payment_entity` with its CHECKs, composite FKs and per-tenant
// idempotency key; down() refuses while an invoice holds either new status.
// Throwaway database migrated to just before it. Sequential cases.
describe('CreatePayments migration (real Postgres)', () => {
  const database = scratch.generate();
  const migration = new CreatePayments1791043200000();
  let admin: DataSource;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;

  const secondTenant = randomUUID();
  // Two invoices in the bootstrap tenant (a refund must stay on its own
  // invoice), one in the second tenant.
  let invoiceA: string;
  let invoiceB: string;
  let secondInvoice: string;
  let staff: string;
  let secondStaff: string;
  let paymentA: string;

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

  async function insertPayment(row: PaymentRow): Promise<string> {
    const id = row.id ?? randomUUID();
    await dataSource.query(
      `INSERT INTO "payment_entity" (${PAYMENT_COLUMNS}) VALUES ($1, $2, $3, $4, 'CASH', $5, 'COMPLETED', now(), $6, $7, $8)`,
      [
        id,
        row.tenantId,
        row.invoiceId,
        row.type ?? 'PAYMENT',
        row.amountMinorUnits ?? 500,
        row.refundedPaymentId ?? null,
        row.recordedByStaffId === undefined ? staff : row.recordedByStaffId,
        row.idempotencyKey ?? randomUUID(),
      ],
    );
    return id;
  }

  async function invoiceStatusLabels(): Promise<string[]> {
    const rows: { label: string }[] = await dataSource.query(
      `SELECT e."enumlabel" AS "label" FROM pg_enum e JOIN pg_type t ON t."oid" = e."enumtypid" WHERE t."typname" = 'invoice_payment_status_enum' ORDER BY e."enumsortorder"`,
    );
    return rows.map((r) => r.label);
  }

  async function paymentTableExists(): Promise<boolean> {
    const [{ exists }] = await dataSource.query(
      `SELECT to_regclass('public.payment_entity') IS NOT NULL AS "exists"`,
    );
    return exists;
  }

  async function constraintNames(): Promise<string[]> {
    const rows: { name: string }[] = await dataSource.query(
      `SELECT "conname" AS "name" FROM pg_constraint WHERE "conname" IN ('uq_invoice_id_tenant', 'uq_admin_user_id_tenant') ORDER BY "conname"`,
    );
    return rows.map((r) => r.name);
  }

  async function paymentTypeNames(): Promise<string[]> {
    const rows: { name: string }[] = await dataSource.query(
      `SELECT "typname" AS "name" FROM pg_type WHERE "typname" IN ('payment_type_enum', 'payment_method_enum', 'payment_record_status_enum') ORDER BY "typname"`,
    );
    return rows.map((r) => r.name);
  }

  // One customer, PRICED order and UNPAID invoice in `tenantId`.
  async function seedInvoice(tenantId: string): Promise<string> {
    const customerId = randomUUID();
    const orderId = randomUUID();
    const invoiceId = randomUUID();
    await dataSource.query(
      `INSERT INTO "customer_entity" ("id", "tenantId", "fullName", "email", "phone") VALUES ($1, $2, 'Pay Customer', $3, '555-0100')`,
      [customerId, tenantId, `${customerId}@example.com`],
    );
    await dataSource.query(
      `INSERT INTO "laundry_order_entity" ("id", "customerId", "tenantId", "fulfillmentType", "status", "weightGrams", "totalMinorUnits") VALUES ($1, $2, $3, 'PICKUP', 'PRICED', 1000, 1500)`,
      [orderId, customerId, tenantId],
    );
    await dataSource.query(
      `INSERT INTO "invoice_entity" ("id", "tenantId", "invoiceNumber", "laundryOrderId", "customerId", "subtotalMinorUnits", "discountMinorUnits", "totalMinorUnits", "amountPaidMinorUnits", "paymentStatus", "paymentTerms", "issueDate") VALUES ($1, $2, $3, $4, $5, 1500, 0, 1500, 0, 'UNPAID', 'PAY_NOW', now())`,
      [
        invoiceId,
        tenantId,
        `INV-2026-${invoiceId.slice(0, 6)}`,
        orderId,
        customerId,
      ],
    );
    return invoiceId;
  }

  async function seedStaff(tenantId: string): Promise<string> {
    const id = randomUUID();
    await dataSource.query(
      `INSERT INTO "admin_user_entity" ("id", "email", "passwordHash", "role", "scope", "tenantId") VALUES ($1, $2, 'x', 'FINANCE', 'TENANT', $3)`,
      [id, `${id}@example.com`, tenantId],
    );
    return id;
  }

  beforeAll(async () => {
    admin = new DataSource(e2eConnectionOptions());
    await admin.initialize();
    await scratch.create(admin, database);
    dataSource = new DataSource({
      ...e2eConnectionOptions(database),
      migrations: migrationsBefore('1791043200000'),
    });
    await dataSource.initialize();
    await dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await dataSource.runMigrations();
    queryRunner = dataSource.createQueryRunner();

    await dataSource.query(
      `INSERT INTO "tenant_entity" ("id", "name") VALUES ($1, 'Second')`,
      [secondTenant],
    );
    invoiceA = await seedInvoice(BOOTSTRAP_TENANT_ID);
    invoiceB = await seedInvoice(BOOTSTRAP_TENANT_ID);
    secondInvoice = await seedInvoice(secondTenant);
    staff = await seedStaff(BOOTSTRAP_TENANT_ID);
    secondStaff = await seedStaff(secondTenant);
  }, 120_000);

  afterAll(async () => {
    await queryRunner?.release();
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    if (admin) {
      await scratch.drop(admin, database);
    }
    if (admin?.isInitialized) {
      await admin.destroy();
    }
  });

  it('up() adds OVERPAID and REFUNDED to invoice_payment_status_enum and creates payment_entity', async () => {
    expect(await paymentTableExists()).toBe(false);

    await inTransaction((r) => migration.up(r));

    expect(await invoiceStatusLabels()).toEqual(
      expect.arrayContaining(['OVERPAID', 'REFUNDED']),
    );
    expect(await paymentTableExists()).toBe(true);
    expect(await constraintNames()).toEqual([
      'uq_admin_user_id_tenant',
      'uq_invoice_id_tenant',
    ]);
  });

  it('accepts a valid PAYMENT and a REFUND of it on the same invoice', async () => {
    paymentA = await insertPayment({
      invoiceId: invoiceA,
      tenantId: BOOTSTRAP_TENANT_ID,
    });
    await expect(
      insertPayment({
        invoiceId: invoiceA,
        refundedPaymentId: paymentA,
        tenantId: BOOTSTRAP_TENANT_ID,
        type: 'REFUND',
      }),
    ).resolves.toEqual(expect.any(String));
  });

  it('ck_payment_refund_reference rejects a PAYMENT with refundedPaymentId and a REFUND without one', async () => {
    await expect(
      insertPayment({
        invoiceId: invoiceA,
        refundedPaymentId: paymentA,
        tenantId: BOOTSTRAP_TENANT_ID,
        type: 'PAYMENT',
      }),
    ).rejects.toThrow(/ck_payment_refund_reference/);
    await expect(
      insertPayment({
        invoiceId: invoiceA,
        refundedPaymentId: null,
        tenantId: BOOTSTRAP_TENANT_ID,
        type: 'REFUND',
      }),
    ).rejects.toThrow(/ck_payment_refund_reference/);
  });

  it('fk_payment_refunded_payment rejects a REFUND of a payment on another invoice in the same tenant', async () => {
    await expect(
      insertPayment({
        invoiceId: invoiceB,
        refundedPaymentId: paymentA,
        tenantId: BOOTSTRAP_TENANT_ID,
        type: 'REFUND',
      }),
    ).rejects.toThrow(/fk_payment_refunded_payment/);
  });

  it('fk_payment_invoice_tenant rejects a payment on another tenant’s invoice', async () => {
    await expect(
      insertPayment({
        invoiceId: secondInvoice,
        tenantId: BOOTSTRAP_TENANT_ID,
      }),
    ).rejects.toThrow(/fk_payment_invoice_tenant/);
  });

  it.each([0, -1])(
    'ck_payment_amount_positive rejects amountMinorUnits %d',
    async (amountMinorUnits) => {
      await expect(
        insertPayment({
          amountMinorUnits,
          invoiceId: invoiceA,
          tenantId: BOOTSTRAP_TENANT_ID,
        }),
      ).rejects.toThrow(/ck_payment_amount_positive/);
    },
  );

  it('uq_payment_tenant_idempotency_key rejects a repeated key in the same tenant and accepts it in another', async () => {
    const idempotencyKey = randomUUID();
    await insertPayment({
      invoiceId: invoiceA,
      tenantId: BOOTSTRAP_TENANT_ID,
      idempotencyKey,
    });

    await expect(
      insertPayment({
        invoiceId: invoiceB,
        tenantId: BOOTSTRAP_TENANT_ID,
        idempotencyKey,
      }),
    ).rejects.toThrow(/uq_payment_tenant_idempotency_key/);
    await expect(
      insertPayment({
        invoiceId: secondInvoice,
        recordedByStaffId: secondStaff,
        tenantId: secondTenant,
        idempotencyKey,
      }),
    ).resolves.toEqual(expect.any(String));
  });

  it('fk_payment_recorded_by_staff_tenant rejects a recorder from another tenant', async () => {
    await expect(
      insertPayment({
        invoiceId: invoiceA,
        recordedByStaffId: secondStaff,
        tenantId: BOOTSTRAP_TENANT_ID,
      }),
    ).rejects.toThrow(/fk_payment_recorded_by_staff_tenant/);
  });

  it('down() refuses, changing nothing, while an invoice is OVERPAID', async () => {
    await dataSource.query(
      `UPDATE "invoice_entity" SET "paymentStatus" = 'OVERPAID' WHERE "id" = $1`,
      [invoiceA],
    );
    const labels = await invoiceStatusLabels();

    await expect(inTransaction((r) => migration.down(r))).rejects.toThrow(
      /1 invoice/,
    );

    expect(await paymentTableExists()).toBe(true);
    expect(await invoiceStatusLabels()).toEqual(labels);
    expect(await constraintNames()).toEqual([
      'uq_admin_user_id_tenant',
      'uq_invoice_id_tenant',
    ]);
  });

  it('down() succeeds once no invoice holds OVERPAID / REFUNDED and restores the previous schema', async () => {
    await dataSource.query(
      `UPDATE "invoice_entity" SET "paymentStatus" = 'UNPAID' WHERE "id" = $1`,
      [invoiceA],
    );

    await inTransaction((r) => migration.down(r));

    expect(await paymentTableExists()).toBe(false);
    expect(await paymentTypeNames()).toEqual([]);
    expect(await constraintNames()).toEqual([]);
    expect(await invoiceStatusLabels()).toEqual([
      'UNPAID',
      'PARTIALLY_PAID',
      'PAID',
      'VOID',
    ]);
    const [{ status }] = await dataSource.query(
      `SELECT "paymentStatus" AS "status" FROM "invoice_entity" WHERE "id" = $1`,
      [invoiceA],
    );
    expect(status).toBe('UNPAID');
  });

  it('up() applies again after down()', async () => {
    await inTransaction((r) => migration.up(r));

    expect(await paymentTableExists()).toBe(true);
    expect(await paymentTypeNames()).toEqual([
      'payment_method_enum',
      'payment_record_status_enum',
      'payment_type_enum',
    ]);
  });
});
