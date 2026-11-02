import { INestApplication } from '@nestjs/common';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import { GraphQLInputObjectType, GraphQLObjectType } from 'graphql';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { InvoicesService } from '../src/modules/billing/application/services/invoices.service';
import { InvoicePaymentStatus } from '../src/modules/billing/domain/invoice-payment-status';
import { InvoicePaymentTerms } from '../src/modules/billing/domain/invoice-payment-terms';
import { InvoiceEntity } from '../src/modules/billing/infrastructure/persistence/invoice.entity';
import { AddOnsService } from '../src/modules/catalog/application/services/add-ons.service';
import { PricingRulesService } from '../src/modules/catalog/application/services/pricing-rules.service';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { PricingUnit } from '../src/modules/catalog/domain/pricing-unit';
import { CustomerEntity } from '../src/modules/customers/infrastructure/persistence/customer.entity';
import { LaundryOrdersService } from '../src/modules/laundry/application/services/laundry-orders.service';
import { LaundryFulfillmentType } from '../src/modules/laundry/domain/laundry-fulfillment-type';
import { LaundryOrderEntity } from '../src/modules/laundry/infrastructure/persistence/laundry-order.entity';
import { PaymentMethod } from '../src/modules/payments/domain/payment-method';
import { PaymentRecordStatus } from '../src/modules/payments/domain/payment-record-status';
import { PaymentType } from '../src/modules/payments/domain/payment-type';
import { PaymentEntity } from '../src/modules/payments/infrastructure/persistence/payment.entity';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { Role } from '../src/platform/auth/domain/role';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import {
  acquireBillingDbTestLock,
  BillingDbTestLock,
} from './helpers/billing-db-test-lock';
import {
  createTestTenant,
  removeTestTenants,
  SeededAdmin,
  seedTenantAdmin,
} from './helpers/seed-tenant-admin';
import { uniqueEmail } from './helpers/unique-email';

// Invoice payments and refunds (#39) over real HTTP GraphQL against the real
// database: the record/refund flow and its derived pair, audit, idempotency,
// A-check and B-check rejections, integer range, `paidAt` bounds, history
// order, the public schema surface, decision n (the port leaves
// `invoice_entity."updatedAt"` alone), the spec §4.7 role matrix and tenant
// isolation. Runs in two fresh test tenants; `afterAll`'s
// `removeTestTenants` deletes every payment row this suite wrote. Holds the
// billing advisory lock (it writes `invoice_entity` / `payment_entity`).
//
// Rows inserted straight through the repository (the identical-timestamp
// history rows, the PENDING original) deliberately bypass `PaymentsService`.
describe('Payments (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let dbLock: BillingDbTestLock;
  let laundryOrders: LaundryOrdersService;
  let invoices: InvoicesService;

  const run = randomUUID().slice(0, 8);
  let tenantA: string;
  let tenantB: string;
  const admins = {} as Record<TenantRole, SeededAdmin>;
  const cookies = {} as Record<TenantRole, string>;
  let ownerB: SeededAdmin;
  let cookieB: string;
  const catalog: Record<
    string,
    { addOnId: string; customerId: string; serviceId: string }
  > = {};

  type TenantRole = Exclude<Role, Role.SUPER_ADMIN>;
  const ROLES: TenantRole[] = [
    Role.TENANT_OWNER,
    Role.OPS_MANAGER,
    Role.SCHEDULER,
    Role.CUSTOMER_SUPPORT,
    Role.FINANCE,
    Role.ANALYST,
  ];
  // Spec §4.7.
  const RECORD_ROLES: TenantRole[] = [
    Role.TENANT_OWNER,
    Role.OPS_MANAGER,
    Role.FINANCE,
    Role.CUSTOMER_SUPPORT,
  ];
  const REFUND_ROLES: TenantRole[] = [Role.TENANT_OWNER, Role.FINANCE];

  const LOGIN = `mutation($i: LoginInput!){ login(loginInput:$i){ success } }`;
  const PAYMENT_FIELDS = `id invoiceId type method amountMinorUnits reference status paidAt refundedPaymentId recordedByStaffId createdAt refundableMinorUnits
    invoice { id amountPaidMinorUnits amountDueMinorUnits paymentStatus }`;
  const RECORD = `mutation($i: RecordInvoicePaymentInput!){ recordInvoicePayment(input:$i){ ${PAYMENT_FIELDS} } }`;
  const REFUND = `mutation($i: RefundInvoicePaymentInput!){ refundInvoicePayment(input:$i){ ${PAYMENT_FIELDS} } }`;
  const INVOICE_PAYMENTS = `query($id: ID!, $p: OffsetPaging){ invoice(id:$id){ payments(paging:$p){ nodes { id } } } }`;

  function extractSessionCookie(response: request.Response): string {
    const header = response.headers['set-cookie'] as unknown as
      string[] | undefined;
    if (!header?.length) {
      throw new Error('Expected a Set-Cookie header on the login response');
    }
    return header[0].split(';')[0];
  }

  async function loginAs(admin: SeededAdmin): Promise<string> {
    return extractSessionCookie(
      await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: LOGIN,
          variables: { i: { email: admin.email, password: admin.password } },
        }),
    );
  }

  function gql(
    cookie: string | null,
    query: string,
    variables: Record<string, unknown> = {},
  ) {
    const req = request(app.getHttpServer()).post('/graphql');
    if (cookie !== null) {
      req.set('Cookie', cookie);
    }
    return req.send({ query, variables });
  }

  // Reads both extension shapes (see `laundry-billing.tenant-isolation`).
  function errorStatus(response: request.Response): number | undefined {
    const error = (
      response.body as {
        errors?: {
          extensions?: {
            status?: number;
            originalError?: { statusCode?: number };
          };
        }[];
      }
    ).errors?.[0];
    return (
      error?.extensions?.status ?? error?.extensions?.originalError?.statusCode
    );
  }

  function errorCode(response: request.Response): string | undefined {
    return (response.body as { errors?: { extensions?: { code?: string } }[] })
      .errors?.[0]?.extensions?.code;
  }

  function errorMessage(response: request.Response): string {
    return (response.body as { errors?: { message: string }[] }).errors?.[0]
      ?.message as string;
  }

  function ok(response: request.Response): request.Response {
    expect(response.body.errors).toBeUndefined();
    return response;
  }

  interface PaymentResult {
    id: string;
    invoiceId: string;
    type: string;
    amountMinorUnits: number;
    paidAt: string;
    refundedPaymentId: string | null;
    recordedByStaffId: string | null;
    refundableMinorUnits: number | null;
    invoice: {
      id: string;
      amountPaidMinorUnits: number;
      amountDueMinorUnits: number;
      paymentStatus: string;
    };
  }

  function recordInput(
    invoiceId: string,
    amountMinorUnits: number,
    extra: Record<string, unknown> = {},
  ) {
    return {
      i: {
        invoiceId,
        amountMinorUnits,
        idempotencyKey: randomUUID(),
        method: PaymentMethod.CASH,
        ...extra,
      },
    };
  }

  function refundInput(
    paymentId: string,
    amountMinorUnits: number,
    extra: Record<string, unknown> = {},
  ) {
    return {
      i: {
        paymentId,
        amountMinorUnits,
        idempotencyKey: randomUUID(),
        method: PaymentMethod.CASH,
        ...extra,
      },
    };
  }

  async function record(
    invoiceId: string,
    amountMinorUnits: number,
    cookie: string = cookies[Role.TENANT_OWNER],
    extra: Record<string, unknown> = {},
  ): Promise<PaymentResult> {
    const res = ok(
      await gql(
        cookie,
        RECORD,
        recordInput(invoiceId, amountMinorUnits, extra),
      ),
    );
    return res.body.data.recordInvoicePayment as PaymentResult;
  }

  async function refund(
    paymentId: string,
    amountMinorUnits: number,
    cookie: string = cookies[Role.TENANT_OWNER],
    extra: Record<string, unknown> = {},
  ): Promise<PaymentResult> {
    const res = ok(
      await gql(
        cookie,
        REFUND,
        refundInput(paymentId, amountMinorUnits, extra),
      ),
    );
    return res.body.data.refundInvoicePayment as PaymentResult;
  }

  // A priced order (base PER_ITEM 3 x 500 + FLAT add-on 200 = 1700) and the
  // invoice generated from it, in `tenantId`.
  async function freshInvoice(
    tenantId: string = tenantA,
    actorId: string = admins[Role.TENANT_OWNER].id,
  ): Promise<{ invoiceId: string; orderId: string }> {
    const fixture = catalog[tenantId];
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
    const invoice = await invoices.generateFromOrder({
      actorId,
      laundryOrderId: order.id,
      tenantId,
      paymentTerms: InvoicePaymentTerms.PAY_NOW,
    });
    expect(invoice.totalMinorUnits).toBe(1700);
    return { invoiceId: invoice.id, orderId: order.id };
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

  async function orderStatus(orderId: string): Promise<string> {
    return (
      await dataSource
        .getRepository(LaundryOrderEntity)
        .findOneByOrFail({ id: orderId })
    ).status;
  }

  function paymentRows(invoiceId: string): Promise<PaymentEntity[]> {
    return dataSource
      .getRepository(PaymentEntity)
      .find({ order: { createdAt: 'ASC', id: 'ASC' }, where: { invoiceId } });
  }

  function paymentAuditCount(tenantId: string = tenantA): Promise<number> {
    return dataSource
      .getRepository(AuditEventEntity)
      .countBy({ entityType: 'payment', tenantId });
  }

  async function seedCatalog(tenantId: string, actorId: string, label: string) {
    const servicesService = app.get(ServicesService);
    const addOnsService = app.get(AddOnsService);
    const pricingRulesService = app.get(PricingRulesService);
    const service = await servicesService.createService({
      actorId,
      tenantId,
      durationMinutes: 1,
      name: `Pay Press ${label} ${run}`,
    });
    await pricingRulesService.createPricingRule({
      actorId,
      serviceId: service.id,
      tenantId,
      priceMinorUnits: 500,
      unit: PricingUnit.PER_ITEM,
    });
    const addOn = await addOnsService.createAddOn({
      actorId,
      tenantId,
      name: `Pay Fold ${label} ${run}`,
      priceMinorUnits: 999,
    });
    await pricingRulesService.createPricingRule({
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
        email: uniqueEmail(`payments-${label.toLowerCase()}`),
        fullName: `Pay ${label} ${run}`,
        notes: null,
        phone: '555-0139',
      }),
    );
    catalog[tenantId] = {
      addOnId: addOn.id,
      customerId: customer.id,
      serviceId: service.id,
    };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    applyPlatformPipes(app);
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    dbLock = await acquireBillingDbTestLock(dataSource);
    laundryOrders = moduleFixture.get(LaundryOrdersService);
    invoices = moduleFixture.get(InvoicesService);

    tenantA = await createTestTenant(dataSource);
    tenantB = await createTestTenant(dataSource);
    for (const role of ROLES) {
      admins[role] = await seedTenantAdmin(dataSource, role, tenantA);
      cookies[role] = await loginAs(admins[role]);
    }
    ownerB = await seedTenantAdmin(dataSource, Role.TENANT_OWNER, tenantB);
    cookieB = await loginAs(ownerB);
    await seedCatalog(tenantA, admins[Role.TENANT_OWNER].id, 'A');
    await seedCatalog(tenantB, ownerB.id, 'B');
  }, 60_000);

  afterAll(async () => {
    try {
      await removeTestTenants(dataSource, [tenantA, tenantB]);
    } finally {
      await dbLock?.release();
      await app.close();
    }
  });

  it('flow: record, overpay, refunds back to PAID / PARTIALLY_PAID / REFUNDED; order status untouched; over-refund rejected cleanly', async () => {
    const { invoiceId, orderId } = await freshInvoice();
    const orderStatusBefore = await orderStatus(orderId);

    const p1 = await record(invoiceId, 1000);
    expect(p1.invoice).toEqual({
      id: invoiceId,
      amountDueMinorUnits: 700,
      amountPaidMinorUnits: 1000,
      paymentStatus: 'PARTIALLY_PAID',
    });
    expect(await orderStatus(orderId)).toBe(orderStatusBefore);

    const p2 = await record(invoiceId, 900);
    expect(p2.invoice).toMatchObject({
      amountDueMinorUnits: -200,
      amountPaidMinorUnits: 1900,
      paymentStatus: 'OVERPAID',
    });
    expect(await orderStatus(orderId)).toBe(orderStatusBefore);

    const r1 = await refund(p2.id, 200);
    expect(r1).toMatchObject({
      refundedPaymentId: p2.id,
      refundableMinorUnits: null,
      type: 'REFUND',
    });
    expect(r1.invoice).toMatchObject({
      amountDueMinorUnits: 0,
      amountPaidMinorUnits: 1700,
      paymentStatus: 'PAID',
    });
    expect(await orderStatus(orderId)).toBe(orderStatusBefore);

    const p1Before = await dataSource
      .getRepository(PaymentEntity)
      .findOneByOrFail({ id: p1.id });
    const r2 = await refund(p1.id, 500);
    expect(r2.refundedPaymentId).toBe(p1.id);
    expect(r2.invoice).toMatchObject({
      amountDueMinorUnits: 500,
      amountPaidMinorUnits: 1200,
      paymentStatus: 'PARTIALLY_PAID',
    });
    expect(
      await dataSource.getRepository(PaymentEntity).findOneByOrFail({
        id: p1.id,
      }),
    ).toEqual(p1Before);
    expect(await orderStatus(orderId)).toBe(orderStatusBefore);

    // Over-refund by 1: P1's refundable amount is now 500.
    const rowsBefore = await paymentRows(invoiceId);
    const pairBefore = await invoicePair(invoiceId);
    const auditBefore = await paymentAuditCount();
    const over = await gql(
      cookies[Role.TENANT_OWNER],
      REFUND,
      refundInput(p1.id, 501),
    );
    expect(errorStatus(over)).toBe(400);
    expect(errorMessage(over)).toBe(
      "This refund is more than the payment's refundable amount of ₱5.00.",
    );
    expect(await paymentRows(invoiceId)).toEqual(rowsBefore);
    expect(await invoicePair(invoiceId)).toEqual(pairBefore);
    expect(await paymentAuditCount()).toBe(auditBefore);

    // Refund the rest of both payments.
    const r3 = await refund(p1.id, 500);
    expect(r3.invoice).toMatchObject({
      amountPaidMinorUnits: 700,
      paymentStatus: 'PARTIALLY_PAID',
    });
    const r4 = await refund(p2.id, 700);
    expect(r4.invoice).toMatchObject({
      amountDueMinorUnits: 1700,
      amountPaidMinorUnits: 0,
      paymentStatus: 'REFUNDED',
    });
    expect(await orderStatus(orderId)).toBe(orderStatusBefore);

    const history = await gql(cookies[Role.TENANT_OWNER], INVOICE_PAYMENTS, {
      id: invoiceId,
    });
    expect(
      ok(history).body.data.invoice.payments.nodes.map(
        (n: { id: string }) => n.id,
      ),
    ).toHaveLength(6);
  }, 30_000);

  it('audit: one payment.recorded / payment.refunded event per write, tenant-tagged', async () => {
    const { invoiceId } = await freshInvoice();
    const finance = admins[Role.FINANCE];
    const payment = await record(invoiceId, 1700, cookies[Role.FINANCE]);
    const refunded = await refund(payment.id, 100, cookies[Role.FINANCE]);

    const audits = dataSource.getRepository(AuditEventEntity);
    for (const [entityId, action] of [
      [payment.id, 'payment.recorded'],
      [refunded.id, 'payment.refunded'],
    ] as const) {
      const events = await audits.findBy({ entityId });
      expect(
        events.map((e) => ({
          actorId: e.actorId,
          tenantId: e.tenantId,
          action: e.action,
          entityType: e.entityType,
          scope: e.scope,
        })),
      ).toEqual([
        {
          actorId: finance.id,
          tenantId: tenantA,
          action,
          entityType: 'payment',
          scope: 'TENANT',
        },
      ]);
    }
  }, 30_000);

  describe('idempotency', () => {
    it('same key + same input twice -> one row, one audit event, same id', async () => {
      const { invoiceId } = await freshInvoice();
      const input = recordInput(invoiceId, 300);
      const first = ok(await gql(cookies[Role.TENANT_OWNER], RECORD, input));
      const second = ok(await gql(cookies[Role.TENANT_OWNER], RECORD, input));
      const id = first.body.data.recordInvoicePayment.id as string;
      expect(second.body.data.recordInvoicePayment.id).toBe(id);
      expect(await paymentRows(invoiceId)).toHaveLength(1);
      expect(
        await dataSource
          .getRepository(AuditEventEntity)
          .countBy({ entityId: id }),
      ).toBe(1);
      expect(await invoicePair(invoiceId)).toEqual({
        amountPaidMinorUnits: 300,
        paymentStatus: 'PARTIALLY_PAID',
      });
    }, 30_000);

    it('same key + different amount -> 409, no second row', async () => {
      const { invoiceId } = await freshInvoice();
      const input = recordInput(invoiceId, 300);
      ok(await gql(cookies[Role.TENANT_OWNER], RECORD, input));
      const mismatch = await gql(cookies[Role.TENANT_OWNER], RECORD, {
        i: { ...input.i, amountMinorUnits: 301 },
      });
      expect(errorStatus(mismatch)).toBe(409);
      expect(await paymentRows(invoiceId)).toHaveLength(1);
    }, 30_000);

    it('two concurrent same-key requests -> exactly one row and one audit event; both return its id', async () => {
      const { invoiceId } = await freshInvoice();
      const input = recordInput(invoiceId, 400);
      const [a, b] = await Promise.all([
        gql(cookies[Role.TENANT_OWNER], RECORD, input),
        gql(cookies[Role.TENANT_OWNER], RECORD, input),
      ]);
      expect(a.body.errors).toBeUndefined();
      expect(b.body.errors).toBeUndefined();
      const rows = await paymentRows(invoiceId);
      expect(rows).toHaveLength(1);
      expect(a.body.data.recordInvoicePayment.id).toBe(rows[0].id);
      expect(b.body.data.recordInvoicePayment.id).toBe(rows[0].id);
      expect(
        await dataSource
          .getRepository(AuditEventEntity)
          .countBy({ entityId: rows[0].id }),
      ).toBe(1);
    }, 30_000);
  });

  describe('invalid idempotency keys', () => {
    let invoiceId: string;
    let paymentId: string;

    beforeAll(async () => {
      invoiceId = (await freshInvoice()).invoiceId;
      paymentId = (await record(invoiceId, 1000)).id;
    }, 30_000);

    // The Task 1 invalid values (`idempotency-key.spec.ts`).
    it.each([
      '',
      'not-a-uuid',
      '5f0c7a8e1b2c4d3e8f90a1b2c3d4e5f6',
      '5f0c7a8e-1b2c-4d3e-8f90-a1b2c3d4e5f',
      '5f0c7a8e-1b2c-4d3e-8f90-a1b2c3d4e5fg',
      ' 5f0c7a8e-1b2c-4d3e-8f90-a1b2c3d4e5f6 ',
    ])('%j -> 400 on record and refund, no row', async (key) => {
      const recorded = await gql(cookies[Role.TENANT_OWNER], RECORD, {
        i: { ...recordInput(invoiceId, 10).i, idempotencyKey: key },
      });
      expect(errorStatus(recorded)).toBe(400);
      const refunded = await gql(cookies[Role.TENANT_OWNER], REFUND, {
        i: { ...refundInput(paymentId, 10).i, idempotencyKey: key },
      });
      expect(errorStatus(refunded)).toBe(400);
      expect(await paymentRows(invoiceId)).toHaveLength(1);
    });

    it('the non-v4 fixture key is accepted', async () => {
      const res = await gql(cookies[Role.TENANT_OWNER], RECORD, {
        i: {
          ...recordInput(invoiceId, 10).i,
          idempotencyKey: '00000000-0000-0000-0001-000000000001',
        },
      });
      expect(res.body.errors).toBeUndefined();
      expect(await paymentRows(invoiceId)).toHaveLength(2);
    });
  });

  it('range: net paid reaches exactly MAX_MINOR_UNITS; one more is 400 with no trace; a refund is still allowed; 0 / -1 / 2^31 rejected', async () => {
    const { invoiceId } = await freshInvoice();
    await record(invoiceId, 2147483646);
    const one = await record(invoiceId, 1);
    expect(one.invoice).toMatchObject({
      amountPaidMinorUnits: 2147483647,
      paymentStatus: 'OVERPAID',
    });

    const rowsBefore = await paymentRows(invoiceId);
    const pairBefore = await invoicePair(invoiceId);
    const auditBefore = await paymentAuditCount();
    const tooMuch = await gql(
      cookies[Role.TENANT_OWNER],
      RECORD,
      recordInput(invoiceId, 1),
    );
    expect(errorStatus(tooMuch)).toBe(400);
    expect(errorMessage(tooMuch)).toContain('is ₱0.00.');
    expect(await paymentRows(invoiceId)).toEqual(rowsBefore);
    expect(await invoicePair(invoiceId)).toEqual(pairBefore);
    expect(await paymentAuditCount()).toBe(auditBefore);

    const refunded = await refund(one.id, 1);
    expect(refunded.invoice.amountPaidMinorUnits).toBe(2147483646);

    for (const amount of [0, -1]) {
      const res = await gql(
        cookies[Role.TENANT_OWNER],
        RECORD,
        recordInput(invoiceId, amount),
      );
      expect(errorStatus(res)).toBe(400);
    }
    const overflow = await gql(
      cookies[Role.TENANT_OWNER],
      RECORD,
      recordInput(invoiceId, 2147483648),
    );
    expect(overflow.body.errors?.[0]?.message).toMatch(
      /Int cannot represent non 32-bit signed integer value/,
    );
    expect(overflow.body.data ?? null).toBeNull();
    expect(await paymentRows(invoiceId)).toHaveLength(rowsBefore.length + 1);
  }, 30_000);

  describe('paidAt', () => {
    it('one hour in the future -> 400, no row', async () => {
      const { invoiceId } = await freshInvoice();
      const res = await gql(
        cookies[Role.TENANT_OWNER],
        RECORD,
        recordInput(invoiceId, 100, {
          paidAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        }),
      );
      expect(errorStatus(res)).toBe(400);
      expect(await paymentRows(invoiceId)).toHaveLength(0);
    }, 30_000);

    it('a refund dated before its original -> 400, no row', async () => {
      const { invoiceId } = await freshInvoice();
      const original = await record(
        invoiceId,
        1000,
        cookies[Role.TENANT_OWNER],
        { paidAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
      );
      const res = await gql(
        cookies[Role.TENANT_OWNER],
        REFUND,
        refundInput(original.id, 100, {
          paidAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        }),
      );
      expect(errorStatus(res)).toBe(400);
      expect(await paymentRows(invoiceId)).toHaveLength(1);
    }, 30_000);

    it('omitted -> stored as the server now', async () => {
      const { invoiceId } = await freshInvoice();
      const before = Date.now();
      const payment = await record(invoiceId, 100);
      const after = Date.now();
      const stored = await dataSource
        .getRepository(PaymentEntity)
        .findOneByOrFail({ id: payment.id });
      expect(stored.paidAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(stored.paidAt.getTime()).toBeLessThanOrEqual(after + 1000);
    }, 30_000);
  });

  it('history order: identical paidAt and createdAt come back id ASC on every read and page', async () => {
    const { invoiceId } = await freshInvoice();
    const repository = dataSource.getRepository(PaymentEntity);
    const instant = new Date(Date.now() - 60 * 1000);
    for (let n = 0; n < 3; n += 1) {
      await repository.insert({
        invoiceId,
        recordedByStaffId: admins[Role.TENANT_OWNER].id,
        refundedPaymentId: null,
        tenantId: tenantA,
        amountMinorUnits: 100,
        createdAt: instant,
        idempotencyKey: randomUUID(),
        method: PaymentMethod.CASH,
        paidAt: instant,
        reference: null,
        status: PaymentRecordStatus.COMPLETED,
        type: PaymentType.PAYMENT,
      });
    }
    const stored = await repository.findBy({ invoiceId });
    expect(stored).toHaveLength(3);
    for (const row of stored) {
      expect(row.paidAt.getTime()).toBe(instant.getTime());
      expect(row.createdAt.getTime()).toBe(instant.getTime());
    }
    // PostgreSQL orders `uuid` bytewise, i.e. lower-case hex string order.
    const expected = stored.map((r) => r.id).sort();

    const ids = async (paging?: {
      limit: number;
      offset: number;
    }): Promise<string[]> =>
      ok(
        await gql(cookies[Role.TENANT_OWNER], INVOICE_PAYMENTS, {
          id: invoiceId,
          p: paging,
        }),
      ).body.data.invoice.payments.nodes.map((n: { id: string }) => n.id);

    expect(await ids()).toEqual(expected);
    expect(await ids()).toEqual(expected);
    const paged: string[] = [];
    for (let offset = 0; offset < 3; offset += 1) {
      paged.push(...(await ids({ limit: 1, offset })));
    }
    expect(paged).toEqual(expected);
  }, 30_000);

  it('public fields: Payment exposes the spec §4.7 list only; no settable derived pair; no generic invoice/payment writes', () => {
    const schema = app.get(GraphQLSchemaHost).schema;
    const payment = schema.getType('Payment') as GraphQLObjectType;
    expect(Object.keys(payment.getFields()).sort()).toEqual(
      [
        'amountMinorUnits',
        'createdAt',
        'id',
        'invoice',
        'invoiceId',
        'method',
        'paidAt',
        'recordedByStaffId',
        'reference',
        'refundableMinorUnits',
        'refundedPaymentId',
        'status',
        'type',
      ].sort(),
    );
    expect(payment.getFields()).not.toHaveProperty('idempotencyKey');
    expect(payment.getFields()).not.toHaveProperty('tenantId');

    // Every input field named after the derived pair, with its type. The
    // one pre-existing hit is #38's read-side filter predicate
    // (`@FilterableField paymentStatus` -> `InvoiceFilter.paymentStatus`, a
    // `...FilterComparison` of eq/in/... operators used only by the
    // `invoices` read). It cannot set a value; it is pinned here by exact
    // name and type so any other input field (a write input, or another
    // filter) fails this test.
    const named: string[] = [];
    for (const type of Object.values(schema.getTypeMap())) {
      if (type instanceof GraphQLInputObjectType) {
        for (const [name, field] of Object.entries(type.getFields())) {
          if (name === 'paymentStatus' || name === 'amountPaidMinorUnits') {
            named.push(`${type.name}.${name}: ${String(field.type)}`);
          }
        }
      }
    }
    expect(named).toEqual([
      'InvoiceFilter.paymentStatus: InvoicePaymentStatusFilterComparison',
    ]);

    const mutations = Object.keys(schema.getMutationType()!.getFields());
    for (const name of [
      'createOneInvoice',
      'updateOneInvoice',
      'createOnePayment',
      'updateOnePayment',
      'deleteOnePayment',
    ]) {
      expect(mutations).not.toContain(name);
    }
  });

  describe('refund target (B4)', () => {
    it('refund of a REFUND -> 400, no row', async () => {
      const { invoiceId } = await freshInvoice();
      const payment = await record(invoiceId, 1000);
      const firstRefund = await refund(payment.id, 100);
      const res = await gql(
        cookies[Role.TENANT_OWNER],
        REFUND,
        refundInput(firstRefund.id, 10),
      );
      expect(errorStatus(res)).toBe(400);
      expect(errorMessage(res)).toBe(
        'Only a completed payment can be refunded.',
      );
      expect(await paymentRows(invoiceId)).toHaveLength(2);
    }, 30_000);

    it('refund of a PENDING PAYMENT -> 400, no row', async () => {
      const { invoiceId } = await freshInvoice();
      const repository = dataSource.getRepository(PaymentEntity);
      const pending = await repository.save(
        repository.create({
          invoiceId,
          recordedByStaffId: admins[Role.TENANT_OWNER].id,
          refundedPaymentId: null,
          tenantId: tenantA,
          amountMinorUnits: 1000,
          idempotencyKey: randomUUID(),
          method: PaymentMethod.GCASH,
          paidAt: new Date(Date.now() - 60 * 1000),
          reference: null,
          status: PaymentRecordStatus.PENDING,
          type: PaymentType.PAYMENT,
        }),
      );
      const res = await gql(
        cookies[Role.TENANT_OWNER],
        REFUND,
        refundInput(pending.id, 10),
      );
      expect(errorStatus(res)).toBe(400);
      expect(errorMessage(res)).toBe(
        'Only a completed payment can be refunded.',
      );
      expect(await paymentRows(invoiceId)).toHaveLength(1);
    }, 30_000);
  });

  // No #39 operation produces VOID (spec §3); the repository sets it, as a
  // future invoice-lifecycle write would.
  describe('VOID invoice (B3)', () => {
    const VOID_MESSAGE =
      'Payments cannot be recorded or refunded on a void invoice.';

    async function voidInvoice(invoiceId: string): Promise<void> {
      await dataSource
        .getRepository(InvoiceEntity)
        .update(
          { id: invoiceId, tenantId: tenantA },
          { paymentStatus: InvoicePaymentStatus.VOID },
        );
    }

    it('record on a VOID invoice -> 400, no row, derived pair unchanged, no audit', async () => {
      const { invoiceId } = await freshInvoice();
      await voidInvoice(invoiceId);
      const before = await invoicePair(invoiceId);
      expect(before.paymentStatus).toBe(InvoicePaymentStatus.VOID);
      const audits = await paymentAuditCount();
      const res = await gql(
        cookies[Role.TENANT_OWNER],
        RECORD,
        recordInput(invoiceId, 500),
      );
      expect(errorStatus(res)).toBe(400);
      expect(errorMessage(res)).toBe(VOID_MESSAGE);
      expect(await paymentRows(invoiceId)).toHaveLength(0);
      expect(await invoicePair(invoiceId)).toEqual(before);
      expect(await paymentAuditCount()).toBe(audits);
    }, 30_000);

    it('refund of a COMPLETED payment on a VOID invoice -> 400, nothing written', async () => {
      const { invoiceId } = await freshInvoice();
      const payment = await record(invoiceId, 1000);
      await voidInvoice(invoiceId);
      const before = await invoicePair(invoiceId);
      const audits = await paymentAuditCount();
      const res = await gql(
        cookies[Role.TENANT_OWNER],
        REFUND,
        refundInput(payment.id, 100),
      );
      expect(errorStatus(res)).toBe(400);
      expect(errorMessage(res)).toBe(VOID_MESSAGE);
      expect(await paymentRows(invoiceId)).toHaveLength(1);
      expect(await invoicePair(invoiceId)).toEqual(before);
      expect(await paymentAuditCount()).toBe(audits);
    }, 30_000);
  });

  it('the port writes two columns only: invoice updatedAt is unchanged after a record and a refund (decision n)', async () => {
    const { invoiceId } = await freshInvoice();
    const updatedAt = async () =>
      (
        await dataSource
          .getRepository(InvoiceEntity)
          .findOneByOrFail({ id: invoiceId })
      ).updatedAt.getTime();
    const before = await updatedAt();
    const payment = await record(invoiceId, 1000);
    expect(await updatedAt()).toBe(before);
    await refund(payment.id, 100);
    expect(await updatedAt()).toBe(before);
    expect(await invoicePair(invoiceId)).toEqual({
      amountPaidMinorUnits: 900,
      paymentStatus: 'PARTIALLY_PAID',
    });
  }, 30_000);

  describe('authorization (spec §4.7)', () => {
    let invoiceId: string;
    let paymentId: string;

    beforeAll(async () => {
      invoiceId = (await freshInvoice()).invoiceId;
      paymentId = (await record(invoiceId, 1700)).id;
    }, 30_000);

    it.each(ROLES)(
      '%s: record / refund allowed exactly per the role lists; reads allowed',
      async (role) => {
        const recordRes = await gql(
          cookies[role],
          RECORD,
          recordInput(invoiceId, 1),
        );
        if (RECORD_ROLES.includes(role)) {
          expect(recordRes.body.errors).toBeUndefined();
          expect(
            recordRes.body.data.recordInvoicePayment.recordedByStaffId,
          ).toBe(admins[role].id);
        } else {
          expect(errorCode(recordRes)).toBe('FORBIDDEN');
          expect(errorStatus(recordRes)).toBe(403);
          expect(recordRes.body.data?.recordInvoicePayment ?? null).toBeNull();
        }

        const refundRes = await gql(
          cookies[role],
          REFUND,
          refundInput(paymentId, 1),
        );
        if (REFUND_ROLES.includes(role)) {
          expect(refundRes.body.errors).toBeUndefined();
          expect(refundRes.body.data.refundInvoicePayment).toMatchObject({
            recordedByStaffId: admins[role].id,
            refundedPaymentId: paymentId,
          });
        } else {
          expect(errorCode(refundRes)).toBe('FORBIDDEN');
          expect(errorStatus(refundRes)).toBe(403);
          expect(refundRes.body.data?.refundInvoicePayment ?? null).toBeNull();
        }

        const read = ok(
          await gql(cookies[role], INVOICE_PAYMENTS, { id: invoiceId }),
        );
        expect(
          read.body.data.invoice.payments.nodes.map(
            (n: { id: string }) => n.id,
          ),
        ).toContain(paymentId);
      },
    );

    it('row count matches exactly the allowed writes', async () => {
      // 1 seed payment + 4 record roles + 2 refund roles.
      const rows = await paymentRows(invoiceId);
      expect(rows).toHaveLength(1 + RECORD_ROLES.length + REFUND_ROLES.length);
    });

    it('unauthenticated -> Unauthorized on record, refund and read', async () => {
      for (const [query, variables] of [
        [RECORD, recordInput(invoiceId, 1)],
        [REFUND, refundInput(paymentId, 1)],
        [INVOICE_PAYMENTS, { id: invoiceId }],
      ] as const) {
        const res = await gql(null, query, variables);
        expect(errorCode(res)).toBe('UNAUTHENTICATED');
        expect(errorMessage(res)).toBe('Unauthorized');
      }
      expect(await paymentRows(invoiceId)).toHaveLength(
        1 + RECORD_ROLES.length + REFUND_ROLES.length,
      );
    });
  });

  describe('tenant isolation', () => {
    let invoiceA: string;
    let paymentA: string;
    let invoiceB: string;
    let paymentB: string;

    beforeAll(async () => {
      invoiceA = (await freshInvoice()).invoiceId;
      paymentA = (await record(invoiceA, 1000)).id;
      invoiceB = (await freshInvoice(tenantB, ownerB.id)).invoiceId;
      paymentB = (await record(invoiceB, 800, cookieB)).id;
    }, 30_000);

    it('a foreign invoiceId / paymentId is not found and writes nothing', async () => {
      const auditBefore = await paymentAuditCount(tenantB);
      const recorded = await gql(cookieB, RECORD, recordInput(invoiceA, 10));
      expect(errorStatus(recorded)).toBe(404);
      const refunded = await gql(cookieB, REFUND, refundInput(paymentA, 10));
      expect(errorStatus(refunded)).toBe(404);
      expect(await paymentRows(invoiceA)).toHaveLength(1);
      expect(await invoicePair(invoiceA)).toEqual({
        amountPaidMinorUnits: 1000,
        paymentStatus: 'PARTIALLY_PAID',
      });
      expect(await paymentAuditCount(tenantB)).toBe(auditBefore);
      expect(JSON.stringify(recorded.body)).not.toContain(paymentA);
    });

    it("Invoice.payments returns only the caller tenant's rows; the other tenant's invoice is unreachable", async () => {
      const ownA = ok(
        await gql(cookies[Role.TENANT_OWNER], INVOICE_PAYMENTS, {
          id: invoiceA,
        }),
      );
      expect(
        ownA.body.data.invoice.payments.nodes.map((n: { id: string }) => n.id),
      ).toEqual([paymentA]);
      const ownB = ok(await gql(cookieB, INVOICE_PAYMENTS, { id: invoiceB }));
      expect(
        ownB.body.data.invoice.payments.nodes.map((n: { id: string }) => n.id),
      ).toEqual([paymentB]);

      const crossed = await gql(cookieB, INVOICE_PAYMENTS, { id: invoiceA });
      expect(crossed.body.data?.invoice ?? null).toBeNull();
      expect(JSON.stringify(crossed.body)).not.toContain(paymentA);
    });
  });
});
