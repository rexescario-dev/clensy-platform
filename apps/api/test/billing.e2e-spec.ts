import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { AdminUserEntity } from '../src/modules/admins/infrastructure/persistence/admin-user.entity';
import { InvoiceEntity } from '../src/modules/billing/infrastructure/persistence/invoice.entity';
import { InvoiceLineEntity } from '../src/modules/billing/infrastructure/persistence/invoice-line.entity';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import { seedOwner } from './helpers/seed-owner';

// Black-box proof of the resolver -> AuthGuard -> InvoicesService ->
// transaction -> Postgres wiring over real HTTP: generation, the ticket's
// historical-immutability acceptance criterion (GraphQL AND direct DB
// rows), FINANCE/OWNER authorization, and the excluded-status guard.
// Self-contained + id-scoped, like `laundry.e2e-spec.ts` — no truncation.
describe('Billing (e2e)', () => {
  let app: INestApplication<App>;
  let adminUserRepository: Repository<AdminUserEntity>;
  let auditEventRepository: Repository<AuditEventEntity>;
  let invoiceRepository: Repository<InvoiceEntity>;
  let invoiceLineRepository: Repository<InvoiceLineEntity>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    applyPlatformPipes(app);
    await app.init();
    adminUserRepository = moduleFixture.get(
      getRepositoryToken(AdminUserEntity),
    );
    auditEventRepository = moduleFixture.get(
      getRepositoryToken(AuditEventEntity),
    );
    invoiceRepository = moduleFixture.get(getRepositoryToken(InvoiceEntity));
    invoiceLineRepository = moduleFixture.get(
      getRepositoryToken(InvoiceLineEntity),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  const LOGIN = `mutation L($i: LoginInput!) { login(loginInput: $i) { success } }`;

  function extractCookie(res: request.Response): string {
    const h = res.headers['set-cookie'] as unknown as string[] | undefined;
    if (!h?.length) throw new Error('no Set-Cookie on login');
    return h[0].split(';')[0];
  }

  async function gql(cookie: string, query: string, variables?: object) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query, variables });
  }

  async function loginAs(email: string, password: string): Promise<string> {
    return extractCookie(
      await request(app.getHttpServer())
        .post('/graphql')
        .send({ query: LOGIN, variables: { i: { email, password } } }),
    );
  }

  interface Ctx {
    ownerCookie: string;
    financeCookie: string;
    opsCookie: string;
    customerId: string;
    serviceId: string;
    addOnId: string;
    tag: string;
  }

  // A priced laundry order (base PER_ITEM service + one FLAT add-on) with
  // fresh catalog fixtures. Returns the order id.
  async function pricedOrder(ctx: Ctx): Promise<string> {
    const stamp = `${ctx.tag}-${Date.now()}-${Math.random()}`;
    const received = await gql(
      ctx.ownerCookie,
      `mutation($i: ReceiveLaundryOrderInput!){ receiveLaundryOrder(input:$i){ id } }`,
      { i: { customerId: ctx.customerId, fulfillmentType: 'PICKUP' } },
    );
    expect(received.body.errors).toBeUndefined();
    const orderId = received.body.data.receiveLaundryOrder.id as string;

    await gql(
      ctx.ownerCookie,
      `mutation($i: WeighLaundryOrderInput!){ weighLaundryOrder(input:$i){ id } }`,
      { i: { orderId, weightGrams: 3000 } },
    );
    const priced = await gql(
      ctx.ownerCookie,
      `mutation($i: PriceLaundryOrderInput!){ priceLaundryOrder(input:$i){ status totalMinorUnits } }`,
      {
        i: {
          orderId,
          baseServiceId: ctx.serviceId,
          baseQuantity: 3,
          addOns: [{ addOnId: ctx.addOnId }],
        },
      },
    );
    expect(priced.body.errors).toBeUndefined();
    expect(priced.body.data.priceLaundryOrder.status).toBe('PRICED');
    // base: 3 * 500 = 1500 ; add-on FLAT: 200 ; total 1700
    expect(priced.body.data.priceLaundryOrder.totalMinorUnits).toBe(1700);
    void stamp;
    return orderId;
  }

  async function context(): Promise<Ctx> {
    const owner = await seedOwner(adminUserRepository);
    const ownerCookie = await loginAs(owner.email, owner.password);
    const tag = owner.id.slice(0, 8);
    const uniq = `${tag}-${Date.now()}`;

    const financeEmail = `finance-${uniq}@example.com`;
    const opsEmail = `ops-${uniq}@example.com`;
    const pw = 'admin-pw-123456';
    const CREATE_ADMIN = `mutation($i: CreateAdminInput!){ createAdmin(createAdminInput:$i){ id } }`;
    await gql(ownerCookie, CREATE_ADMIN, {
      i: { email: financeEmail, password: pw, role: 'FINANCE' },
    });
    await gql(ownerCookie, CREATE_ADMIN, {
      i: { email: opsEmail, password: pw, role: 'OPS_MANAGER' },
    });
    const financeCookie = await loginAs(financeEmail, pw);
    const opsCookie = await loginAs(opsEmail, pw);

    const customerId = (
      await gql(
        ownerCookie,
        `mutation($i: CreateCustomerInput!){ createCustomer(input:$i){ id } }`,
        {
          i: {
            fullName: `Billing Jane ${uniq}`,
            email: `bj-${uniq}@example.com`,
            phone: '555-9',
          },
        },
      )
    ).body.data.createCustomer.id as string;

    const serviceId = (
      await gql(
        ownerCookie,
        `mutation($i: CreateServiceInput!){ createService(input:$i){ id } }`,
        { i: { name: `Press ${uniq}`, durationMinutes: 1 } },
      )
    ).body.data.createService.id as string;
    await gql(
      ownerCookie,
      `mutation($i: CreatePricingRuleInput!){ createPricingRule(input:$i){ id } }`,
      { i: { serviceId, priceMinorUnits: 500, unit: 'PER_ITEM' } },
    );

    const addOnId = (
      await gql(
        ownerCookie,
        `mutation($i: CreateAddOnInput!){ createAddOn(input:$i){ id } }`,
        { i: { name: `Fold ${uniq}`, priceMinorUnits: 999 } },
      )
    ).body.data.createAddOn.id as string;
    await gql(
      ownerCookie,
      `mutation($i: CreatePricingRuleInput!){ createPricingRule(input:$i){ id } }`,
      { i: { addOnId, priceMinorUnits: 200, unit: 'FLAT' } },
    );

    return {
      ownerCookie,
      financeCookie,
      opsCookie,
      customerId,
      serviceId,
      addOnId,
      tag,
    };
  }

  const GENERATE = `mutation($i: GenerateInvoiceFromOrderInput!){
    generateInvoiceFromOrder(input:$i){
      id invoiceNumber laundryOrderId customerId
      subtotalMinorUnits discountMinorUnits totalMinorUnits
      amountPaidMinorUnits amountDueMinorUnits paymentStatus paymentTerms
      issueDate dueDate
    }
  }`;

  const INVOICE_DETAIL = `query($id: ID!){
    invoice(id:$id){
      invoiceNumber customerId paymentTerms issueDate dueDate
      subtotalMinorUnits discountMinorUnits totalMinorUnits
      customer { id }
      laundryOrder { id }
      lines { nodes { description unit quantity rateMinorUnits amountMinorUnits } }
    }
  }`;

  it('generates an invoice from a priced order and resolves the full surface', async () => {
    const ctx = await context();
    const orderId = await pricedOrder(ctx);

    const res = await gql(ctx.financeCookie, GENERATE, {
      i: { laundryOrderId: orderId, paymentTerms: 'PAY_NOW' },
    });
    expect(res.body.errors).toBeUndefined();
    const inv = res.body.data.generateInvoiceFromOrder;
    expect(inv.invoiceNumber).toMatch(/^INV-\d{4}-\d{6,}$/);
    expect(inv.laundryOrderId).toBe(orderId);
    expect(inv.customerId).toBe(ctx.customerId);
    expect(inv.subtotalMinorUnits).toBe(1700);
    expect(inv.discountMinorUnits).toBe(0);
    expect(inv.totalMinorUnits).toBe(1700);
    expect(inv.amountPaidMinorUnits).toBe(0);
    expect(inv.amountDueMinorUnits).toBe(1700);
    expect(inv.paymentStatus).toBe('UNPAID');
    expect(inv.paymentTerms).toBe('PAY_NOW');
    expect(inv.dueDate).toBe(inv.issueDate);

    const detail = await gql(ctx.financeCookie, INVOICE_DETAIL, { id: inv.id });
    expect(detail.body.errors).toBeUndefined();
    const d = detail.body.data.invoice;
    expect(d.customer.id).toBe(ctx.customerId);
    expect(d.laundryOrder.id).toBe(orderId);
    // The nested `lines` connection sorts `createdAt ASC, id ASC`; both
    // lines are inserted in one transaction so `createdAt` collides and the
    // `id` tiebreak is arbitrary — assert the set, not the order.
    expect(d.lines.nodes).toHaveLength(2);
    expect(d.lines.nodes).toEqual(
      expect.arrayContaining([
        {
          description: expect.stringMatching(/^Press /),
          unit: 'PER_ITEM',
          quantity: 3,
          rateMinorUnits: 500,
          amountMinorUnits: 1500,
        },
        {
          description: expect.stringMatching(/^Fold .* \(add-on\)$/),
          unit: 'FLAT',
          quantity: 1,
          rateMinorUnits: 200,
          amountMinorUnits: 200,
        },
      ]),
    );

    const events = await auditEventRepository.find({
      where: { entityType: 'invoice', entityId: inv.id },
    });
    expect(events.map((e) => e.action)).toEqual(['invoice.generated']);

    // appears in the root connection
    const list = await gql(
      ctx.financeCookie,
      `query{ invoices(paging:{limit:100}){ nodes { id } } }`,
    );
    expect(
      list.body.data.invoices.nodes.some(
        (n: { id: string }) => n.id === inv.id,
      ),
    ).toBe(true);
  });

  it('is immune to later catalog/pricing changes — GraphQL and stored rows unchanged (ticket AC)', async () => {
    const ctx = await context();
    const orderId = await pricedOrder(ctx);
    const inv = (
      await gql(ctx.financeCookie, GENERATE, {
        i: { laundryOrderId: orderId, paymentTerms: 'PAY_ON_COMPLETION' },
      })
    ).body.data.generateInvoiceFromOrder;

    const before = (
      await gql(ctx.financeCookie, INVOICE_DETAIL, { id: inv.id })
    ).body.data.invoice;
    const storedLinesBefore = await invoiceLineRepository.find({
      where: { invoiceId: inv.id as string },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    const storedInvoiceBefore = await invoiceRepository.findOneByOrFail({
      id: inv.id as string,
    });

    // Mutate the referenced catalog + pricing rows.
    await gql(
      ctx.ownerCookie,
      `mutation($id: ID!, $i: UpdateServiceInput!){ updateService(id:$id, input:$i){ id } }`,
      { id: ctx.serviceId, i: { name: `RENAMED ${Date.now()}` } },
    );
    await gql(
      ctx.ownerCookie,
      `mutation($id: ID!, $i: UpdateAddOnInput!){ updateAddOn(id:$id, input:$i){ id } }`,
      { id: ctx.addOnId, i: { name: `RENAMED-ADDON ${Date.now()}` } },
    );
    await gql(
      ctx.ownerCookie,
      `mutation($i: CreatePricingRuleInput!){ createPricingRule(input:$i){ id } }`,
      {
        i: {
          serviceId: ctx.serviceId,
          priceMinorUnits: 99999,
          unit: 'PER_ITEM',
        },
      },
    );

    const after = (await gql(ctx.financeCookie, INVOICE_DETAIL, { id: inv.id }))
      .body.data.invoice;
    expect(after).toEqual(before);
    expect(after.paymentTerms).toBe('PAY_ON_COMPLETION');
    expect(after.dueDate).toBeNull();

    const storedLinesAfter = await invoiceLineRepository.find({
      where: { invoiceId: inv.id as string },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    expect(storedLinesAfter).toEqual(storedLinesBefore);
    expect(
      await invoiceRepository.findOneByOrFail({ id: inv.id as string }),
    ).toEqual(storedInvoiceBefore);
  });

  it('gates generation to FINANCE and OWNER', async () => {
    const ctx = await context();

    const o1 = await pricedOrder(ctx);
    const ownerRes = await gql(ctx.ownerCookie, GENERATE, {
      i: { laundryOrderId: o1, paymentTerms: 'PAY_NOW' },
    });
    expect(ownerRes.body.errors).toBeUndefined();

    const o2 = await pricedOrder(ctx);
    const financeRes = await gql(ctx.financeCookie, GENERATE, {
      i: { laundryOrderId: o2, paymentTerms: 'PAY_NOW' },
    });
    expect(financeRes.body.errors).toBeUndefined();

    const o3 = await pricedOrder(ctx);
    const opsRes = await gql(ctx.opsCookie, GENERATE, {
      i: { laundryOrderId: o3, paymentTerms: 'PAY_NOW' },
    });
    expect(opsRes.body.errors?.[0]?.message).toMatch(/forbidden|permission/i);
    expect(opsRes.body.data?.generateInvoiceFromOrder ?? null).toBeNull();
  });

  it('rejects generation for a cancelled order and creates no invoice', async () => {
    const ctx = await context();
    const orderId = await pricedOrder(ctx);
    await gql(
      ctx.ownerCookie,
      `mutation($i: LaundryOrderRefInput!){ cancelLaundryOrder(input:$i){ status } }`,
      { i: { orderId } },
    );

    const res = await gql(ctx.financeCookie, GENERATE, {
      i: { laundryOrderId: orderId, paymentTerms: 'PAY_NOW' },
    });
    expect(res.body.errors).toBeDefined();
    expect(
      await invoiceRepository.findOneBy({ laundryOrderId: orderId }),
    ).toBeNull();
  });

  it('rejects a second generation for the same order with a conflict', async () => {
    const ctx = await context();
    const orderId = await pricedOrder(ctx);
    await gql(ctx.financeCookie, GENERATE, {
      i: { laundryOrderId: orderId, paymentTerms: 'PAY_NOW' },
    });
    const second = await gql(ctx.financeCookie, GENERATE, {
      i: { laundryOrderId: orderId, paymentTerms: 'PAY_NOW' },
    });
    expect(second.body.errors?.[0]?.message).toMatch(/already exists/i);
  });
});
