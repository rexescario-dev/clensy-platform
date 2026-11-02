import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { InvoicesService } from '../src/modules/billing/application/services/invoices.service';
import { InvoicePaymentTerms } from '../src/modules/billing/domain/invoice-payment-terms';
import { InvoiceEntity } from '../src/modules/billing/infrastructure/persistence/invoice.entity';
import { AddOnsService } from '../src/modules/catalog/application/services/add-ons.service';
import { PricingRulesService } from '../src/modules/catalog/application/services/pricing-rules.service';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { PricingUnit } from '../src/modules/catalog/domain/pricing-unit';
import { CustomerEntity } from '../src/modules/customers/infrastructure/persistence/customer.entity';
import { LaundryOrdersService } from '../src/modules/laundry/application/services/laundry-orders.service';
import { LaundryFulfillmentType } from '../src/modules/laundry/domain/laundry-fulfillment-type';
import { PaymentsService } from '../src/modules/payments/application/services/payments.service';
import { Payment } from '../src/modules/payments/domain/payment';
import { PaymentMethod } from '../src/modules/payments/domain/payment-method';
import { PaymentRecordStatus } from '../src/modules/payments/domain/payment-record-status';
import { PaymentType } from '../src/modules/payments/domain/payment-type';
import { PaymentEntity } from '../src/modules/payments/infrastructure/persistence/payment.entity';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { Role } from '../src/platform/auth/domain/role';
import {
  acquireBillingDbTestLock,
  BillingDbTestLock,
} from './helpers/billing-db-test-lock';
import {
  createTestTenant,
  removeTestTenants,
  seedTenantAdmin,
} from './helpers/seed-tenant-admin';
import { uniqueEmail } from './helpers/unique-email';

// Deterministic proof of spec §4.6 guarantees 1 and 3 (#39, spec §7
// "concurrency"): payment writes for one invoice serialize on the invoice
// row lock, and two refunds of one payment that together exceed its
// refundable amount cannot both commit. Firing calls together and hoping is
// not enough, so a payment save barrier (planning decision f; the #138
// `PricingRule` barrier in `catalog.service.e2e-spec.ts`) pauses the first
// call to reach its INSERT while it holds the invoice lock, and releases it
// only once Postgres shows the other calls blocked on that lock.
//
// Boots `AppModule` (every entity registered via `autoLoadEntities`) and
// calls `PaymentsService` directly, in a fresh test tenant; holds the
// billing advisory lock for the whole file.

// Interception contract (decisions f, p): `PaymentsService` inserts with
// exactly `manager.save(manager.create(PaymentEntity, {...}))`, i.e.
// `EntityManager.prototype.save(entity)` with one `PaymentEntity` instance.
// Any other `save` shape carrying a `PaymentEntity` (a target plus an
// object, an array, an options argument) fails the test at once instead of
// bypassing the barrier. An insert that stops going through `save` never
// arrives, so the condition is never observed and the timeout fails the
// test. If the insert changes shape, update this barrier, never loosen it.
//
// On interception the barrier reads the paused call's backend pid on the
// same transactional manager, then pauses. Only the first arriving save is
// paused; once released, later saves pass straight through. Conditions,
// polled from `pg_stat_activity` on a dedicated connection every 20 ms
// (timeout 3000 ms), every poll restricted to `datname = current_database()
// AND pid <> pg_backend_pid()` so other databases' backends and the poller
// itself are never counted; a waiter is a backend with `wait_event_type =
// 'Lock'` that is blocked in TypeORM's `SELECT … FROM "invoice_entity" …
// FOR UPDATE` (`InvoicePaymentWriter.lockForPayment`).
//
// Waiter identification deviates from decision f's literal
// `/FROM "invoice_entity".*FOR UPDATE/s` on `pg_stat_activity.query`:
// PostgreSQL truncates that column at `track_activity_query_size` (1024
// bytes by default), and TypeORM's `SELECT` of every invoice column is
// longer, so the observed text ends inside the `WHERE` clause and never
// contains `FOR UPDATE` (first run: all 4 record-queue waiters present and
// correctly blocked, yet unmatched). The statement is therefore identified
// by `INVOICE_LOCK_QUERY` (`FROM "invoice_entity"`, inside the first 1024
// bytes) plus the lock `FOR UPDATE` takes: a granted `RowShareLock` on
// `invoice_entity` held by that same backend. A plain `SELECT` takes
// `AccessShareLock` and never waits on a lock, so this pins the same
// statement without relying on truncated text.
//
// - `refund-race`: exactly one waiter, and its `pg_blocking_pids` contains
//   the paused pid.
// - `record-queue` (N = 5): exactly 4 waiters, each with a non-empty
//   `pg_blocking_pids`, at least one blocked directly by the paused pid
//   (tuple-lock queueing makes later waiters block on the head waiter, so
//   "all blocked by the paused pid" is not required).
//
// A missed condition rejects the paused save (rolling its transaction back)
// and fails with a diagnostic naming the condition and the observed wait
// state. `restore` removes the spy, rejects anything still paused and
// resolves once the polling loop has settled. No sleeps: the only timer is
// the poll interval.
type PaymentSaveBarrierCondition = 'record-queue' | 'refund-race';

interface PaymentSaveBarrier {
  assertReleased(): void;
  restore(): Promise<void>;
}

const PAYMENT_SAVE_BARRIER_TIMEOUT_MS = 3000;
const PAYMENT_SAVE_BARRIER_POLL_MS = 20;
const RECORD_QUEUE_N = 5;
const INVOICE_LOCK_QUERY = /FROM "invoice_entity"/;

// Both `pg_stat_activity` reads the barrier issues.
const WAIT_STATE_SQL = `SELECT a.pid, a.wait_event_type, a.wait_event,
        pg_blocking_pids(a.pid) AS blocked_by, a.query,
        EXISTS (
          SELECT 1 FROM pg_locks l
           WHERE l.pid = a.pid AND l.locktype = 'relation'
             AND l.relation = 'invoice_entity'::regclass
             AND l.mode = 'RowShareLock' AND l.granted
        ) AS for_update_on_invoice
   FROM pg_stat_activity a
  WHERE a.datname = current_database() AND a.pid <> pg_backend_pid()
    AND a.wait_event_type = 'Lock'`;
const DIAGNOSTIC_SQL = `SELECT pid, state, wait_event_type, wait_event,
        pg_blocking_pids(pid) AS blocked_by, left(query, 120) AS query
   FROM pg_stat_activity
  WHERE datname = current_database() AND pid <> pg_backend_pid()`;

interface Poller {
  query<T>(sql: string): Promise<T>;
}

function carriesPayment(value: unknown): boolean {
  return (
    value === PaymentEntity ||
    value === 'PaymentEntity' ||
    value instanceof PaymentEntity ||
    (Array.isArray(value) && value.some(carriesPayment))
  );
}

function installPaymentSaveBarrier(
  poller: Poller,
  condition: PaymentSaveBarrierCondition,
): PaymentSaveBarrier {
  let paused:
    | { pid: number; reject: (error: Error) => void; resolve: () => void }
    | undefined;
  let pausedPid: number | undefined;
  let claimed = false;
  let arrivals = 0;
  let failure: Error | undefined;
  let released = false;
  let stopped = false;
  let lastWaitState = '[]';

  function fail(error: Error) {
    failure ??= error;
    const current = paused;
    paused = undefined;
    current?.reject(failure);
  }

  const originalSave = Object.getOwnPropertyDescriptor(
    EntityManager.prototype,
    'save',
  )!.value as (this: EntityManager, ...args: unknown[]) => Promise<unknown>;
  const saveSpy = jest
    .spyOn(EntityManager.prototype, 'save')
    .mockImplementation(async function (
      this: EntityManager,
      ...args: unknown[]
    ) {
      const isBarrierShape =
        args.length === 1 && args[0] instanceof PaymentEntity;
      if (!isBarrierShape && args.some(carriesPayment)) {
        fail(
          new Error(
            'Payment save barrier: unsupported save call shape for ' +
              'PaymentEntity; expected manager.save(entity) with one ' +
              'PaymentEntity instance. Update the barrier to the new shape.',
          ),
        );
        throw failure!;
      }
      if (isBarrierShape) {
        arrivals += 1;
        if (failure !== undefined) {
          throw failure;
        }
        // The slot is claimed synchronously, before the pid query awaits,
        // so only the first arrival ever pauses even if several saves
        // arrive together (they cannot under the invoice lock; if the lock
        // were missing they would, and must pass through so the condition
        // fails instead of leaving extra transactions paused).
        if (!released && !claimed) {
          claimed = true;
          const [{ pid }] = await this.query<{ pid: number }[]>(
            'SELECT pg_backend_pid() AS pid',
          );
          pausedPid = pid;
          await new Promise<void>((resolve, reject) => {
            if (failure !== undefined) {
              reject(failure);
              return;
            }
            paused = { pid, reject, resolve };
          });
        }
      }
      return originalSave.apply(this, args);
    } as never);

  async function conditionMet(): Promise<boolean> {
    if (paused === undefined) {
      return false;
    }
    const holder = paused.pid;
    const rows = await poller.query<
      {
        blocked_by: number[];
        for_update_on_invoice: boolean;
        pid: number;
        query: string;
        wait_event: string | null;
      }[]
    >(WAIT_STATE_SQL);
    const waiters = rows.filter(
      (r) => r.for_update_on_invoice && INVOICE_LOCK_QUERY.test(r.query),
    );
    lastWaitState = JSON.stringify(
      rows.map((r) => ({
        blocked_by: r.blocked_by,
        for_update_on_invoice: r.for_update_on_invoice,
        pid: r.pid,
        query: r.query.slice(0, 60),
        wait_event: r.wait_event,
      })),
    );
    if (condition === 'refund-race') {
      return waiters.length === 1 && waiters[0].blocked_by.includes(holder);
    }
    return (
      waiters.length === RECORD_QUEUE_N - 1 &&
      waiters.every((w) => w.blocked_by.length > 0) &&
      waiters.some((w) => w.blocked_by.includes(holder))
    );
  }

  async function watch() {
    const deadline = Date.now() + PAYMENT_SAVE_BARRIER_TIMEOUT_MS;
    while (!stopped && failure === undefined) {
      if (await conditionMet()) {
        released = true;
        const current = paused!;
        paused = undefined;
        current.resolve();
        return;
      }
      if (Date.now() >= deadline) {
        fail(
          new Error(
            `Payment save barrier: condition '${condition}' not observed ` +
              `within ${PAYMENT_SAVE_BARRIER_TIMEOUT_MS} ms; ` +
              `arrivals=${arrivals}; paused pid=${String(pausedPid)}; ` +
              `last lock waiters=${lastWaitState}; ` +
              `pg_stat_activity=${JSON.stringify(
                await poller.query<unknown[]>(DIAGNOSTIC_SQL),
              )}`,
          ),
        );
        return;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, PAYMENT_SAVE_BARRIER_POLL_MS),
      );
    }
  }
  const watching = watch().catch((error: unknown) => {
    fail(error instanceof Error ? error : new Error(String(error)));
  });

  return {
    assertReleased() {
      if (failure !== undefined) {
        throw failure;
      }
      if (!released) {
        throw new Error(
          `Payment save barrier: condition '${condition}' was never ` +
            `observed; arrivals=${arrivals}`,
        );
      }
    },
    async restore() {
      stopped = true;
      saveSpy.mockRestore();
      if (!released) {
        fail(
          new Error(
            `Payment save barrier: restored before condition ` +
              `'${condition}' was observed; arrivals=${arrivals}`,
          ),
        );
      }
      await watching;
    },
  };
}

describe('PaymentsService concurrency (real Postgres)', () => {
  let moduleRef: TestingModule;
  let dataSource: DataSource;
  let dbLock: BillingDbTestLock;
  let pollRunner: QueryRunner;
  let payments: PaymentsService;
  let tenantId: string;
  let actorId: string;
  let fixture: { addOnId: string; customerId: string; serviceId: string };
  // Every SQL the barrier sent to the poller (decision f filter check).
  const polledSql: string[] = [];
  const poller: Poller = {
    query: <T>(sql: string) => {
      polledSql.push(sql);
      return pollRunner.query(sql) as Promise<T>;
    },
  };

  // Base PER_ITEM 3 x 500 + FLAT add-on 200 = 1700.
  async function freshInvoice(): Promise<string> {
    const laundryOrders = moduleRef.get(LaundryOrdersService);
    const order = await laundryOrders.receive({
      actorId,
      customerId: fixture.customerId,
      tenantId,
      fulfillmentType: LaundryFulfillmentType.PICKUP,
    });
    await laundryOrders.weigh({
      actorId,
      orderId: order.id,
      tenantId,
      weightGrams: 3000,
    });
    await laundryOrders.price({
      actorId,
      baseServiceId: fixture.serviceId,
      orderId: order.id,
      tenantId,
      addOns: [{ addOnId: fixture.addOnId }],
      baseQuantity: 3,
    });
    const invoice = await moduleRef.get(InvoicesService).generateFromOrder({
      actorId,
      laundryOrderId: order.id,
      tenantId,
      paymentTerms: InvoicePaymentTerms.PAY_NOW,
    });
    expect(invoice.totalMinorUnits).toBe(1700);
    return invoice.id;
  }

  function record(invoiceId: string, amountMinorUnits: number) {
    return payments.record({
      actorId,
      invoiceId,
      tenantId,
      amountMinorUnits,
      idempotencyKey: randomUUID(),
      method: PaymentMethod.CASH,
    });
  }

  function refund(paymentId: string, amountMinorUnits: number) {
    return payments.refund({
      actorId,
      paymentId,
      tenantId,
      amountMinorUnits,
      idempotencyKey: randomUUID(),
      method: PaymentMethod.CASH,
    });
  }

  async function invoicePair(invoiceId: string) {
    const row = await dataSource
      .getRepository(InvoiceEntity)
      .findOneByOrFail({ id: invoiceId });
    return {
      amountPaidMinorUnits: row.amountPaidMinorUnits,
      paymentStatus: row.paymentStatus,
    };
  }

  function rowsOf(invoiceId: string) {
    return dataSource.getRepository(PaymentEntity).findBy({ invoiceId });
  }

  function paymentAuditCount(): Promise<number> {
    return dataSource
      .getRepository(AuditEventEntity)
      .countBy({ entityType: 'payment', tenantId });
  }

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    await moduleRef.init();
    dataSource = moduleRef.get(DataSource);
    payments = moduleRef.get(PaymentsService);
    dbLock = await acquireBillingDbTestLock(dataSource);
    pollRunner = dataSource.createQueryRunner();
    await pollRunner.connect();

    tenantId = await createTestTenant(dataSource);
    actorId = (await seedTenantAdmin(dataSource, Role.TENANT_OWNER, tenantId))
      .id;
    const run = randomUUID().slice(0, 8);
    const service = await moduleRef.get(ServicesService).createService({
      actorId,
      tenantId,
      durationMinutes: 1,
      name: `Race Press ${run}`,
    });
    const pricingRules = moduleRef.get(PricingRulesService);
    await pricingRules.createPricingRule({
      actorId,
      serviceId: service.id,
      tenantId,
      priceMinorUnits: 500,
      unit: PricingUnit.PER_ITEM,
    });
    const addOn = await moduleRef.get(AddOnsService).createAddOn({
      actorId,
      tenantId,
      name: `Race Fold ${run}`,
      priceMinorUnits: 999,
    });
    await pricingRules.createPricingRule({
      actorId,
      addOnId: addOn.id,
      tenantId,
      priceMinorUnits: 200,
      unit: PricingUnit.FLAT,
    });
    const customers = dataSource.getRepository(CustomerEntity);
    const customer = await customers.save(
      customers.create({
        tenantId,
        email: uniqueEmail('payments-race'),
        fullName: `Race Customer ${run}`,
        notes: null,
        phone: '555-0139',
      }),
    );
    fixture = {
      addOnId: addOn.id,
      customerId: customer.id,
      serviceId: service.id,
    };
  }, 60_000);

  afterAll(async () => {
    try {
      await removeTestTenants(dataSource, [tenantId]);
    } finally {
      await pollRunner?.release();
      await dbLock?.release();
      await moduleRef.close();
    }
  });

  it('record-queue: five concurrent records of 100 serialize on the invoice lock; 5 rows, amountPaid 500', async () => {
    const invoiceId = await freshInvoice();
    const barrier = installPaymentSaveBarrier(poller, 'record-queue');
    const results = await Promise.allSettled(
      Array.from({ length: RECORD_QUEUE_N }, () => record(invoiceId, 100)),
    ).finally(() => barrier.restore());
    barrier.assertReleased();

    expect(results.map((r) => r.status)).toEqual(
      Array(RECORD_QUEUE_N).fill('fulfilled'),
    );
    const rows = await rowsOf(invoiceId);
    expect(rows).toHaveLength(RECORD_QUEUE_N);
    expect(new Set(rows.map((r) => r.id))).toEqual(
      new Set(
        results.map((r) => (r as PromiseFulfilledResult<Payment>).value.id),
      ),
    );
    // 500 of 1700: derived from the total, not just counted.
    expect(await invoicePair(invoiceId)).toEqual({
      amountPaidMinorUnits: 500,
      paymentStatus: 'PARTIALLY_PAID',
    });
  }, 20_000);

  it('refund-race: two refunds of 700 against one COMPLETED 1000 payment; exactly one commits, the other is B6', async () => {
    const invoiceId = await freshInvoice();
    const original = await record(invoiceId, 1000);
    const barrier = installPaymentSaveBarrier(poller, 'refund-race');
    const results = await Promise.allSettled([
      refund(original.id, 700),
      refund(original.id, 700),
    ]).finally(() => barrier.restore());
    barrier.assertReleased();

    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<Payment> => r.status === 'fulfilled',
    );
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === 'rejected',
    );
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(BadRequestException);
    expect((rejected[0].reason as Error).message).toContain(
      'refundable amount of ₱3.00.',
    );

    const refunds = (await rowsOf(invoiceId)).filter(
      (r) => r.type === PaymentType.REFUND,
    );
    expect(refunds.map((r) => r.id)).toEqual([fulfilled[0].value.id]);
    expect(await invoicePair(invoiceId)).toEqual({
      amountPaidMinorUnits: 300,
      paymentStatus: 'PARTIALLY_PAID',
    });
  }, 20_000);

  it('failed write: an over-refund leaves no row, an unchanged derived pair and no audit event', async () => {
    const invoiceId = await freshInvoice();
    const original = await record(invoiceId, 1700);
    const rowsBefore = await rowsOf(invoiceId);
    const pairBefore = await invoicePair(invoiceId);
    const auditBefore = await paymentAuditCount();

    await expect(refund(original.id, 1701)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(await rowsOf(invoiceId)).toEqual(rowsBefore);
    expect(await invoicePair(invoiceId)).toEqual(pairBefore);
    expect(pairBefore).toEqual({
      amountPaidMinorUnits: 1700,
      paymentStatus: 'PAID',
    });
    expect(await paymentAuditCount()).toBe(auditBefore);
  }, 20_000);

  describe('barrier contract', () => {
    it.each([
      [
        'save(target, object)',
        (m: EntityManager, e: PaymentEntity) => m.save(PaymentEntity, e),
      ],
      ['save([entity])', (m: EntityManager, e: PaymentEntity) => m.save([e])],
      [
        'save(entity, options)',
        (m: EntityManager, e: PaymentEntity) => m.save(e, { reload: false }),
      ],
    ])('a PaymentEntity %s fails at once', async (_shape, call) => {
      const barrier = installPaymentSaveBarrier(poller, 'refund-race');
      const entity = dataSource.manager.create(PaymentEntity, {
        invoiceId: randomUUID(),
        recordedByStaffId: actorId,
        refundedPaymentId: null,
        tenantId,
        amountMinorUnits: 1,
        idempotencyKey: randomUUID(),
        method: PaymentMethod.CASH,
        paidAt: new Date(),
        reference: null,
        status: PaymentRecordStatus.COMPLETED,
        type: PaymentType.PAYMENT,
      });
      await expect(call(dataSource.manager, entity)).rejects.toThrow(
        /unsupported save call shape for PaymentEntity/,
      );
      await barrier.restore();
      expect(() => barrier.assertReleased()).toThrow(
        /unsupported save call shape for PaymentEntity/,
      );
    });

    it('every pg_stat_activity poll is restricted to this database and excludes the poller', () => {
      const polls = polledSql.filter((sql) => sql.includes('pg_stat_activity'));
      expect(polls.length).toBeGreaterThan(0);
      for (const sql of polls) {
        expect(sql).toContain('datname = current_database()');
        expect(sql).toContain('pid <> pg_backend_pid()');
      }
      for (const sql of [WAIT_STATE_SQL, DIAGNOSTIC_SQL]) {
        expect(sql).toContain('datname = current_database()');
        expect(sql).toContain('pid <> pg_backend_pid()');
      }
    });
  });
});
