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
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import { Role } from '../src/platform/auth/domain/role';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import { seedOwner } from './helpers/seed-owner';
import { seedTenantAdmin } from './helpers/seed-tenant-admin';

// Black-box proof of the resolver -> AuthGuard -> LaundryOrdersService ->
// transaction/policy -> Postgres wiring over real HTTP, and that the
// `LaundryOrder.lines` nested connection + `customer` relation actually
// resolve in a query response. Self-contained (own Owner, unique data,
// id-scoped assertions) like `catalog.e2e-spec.ts` — no truncation. The
// exhaustive pricing/transition/immutability/race coverage lives in
// `laundry.service.e2e-spec.ts`.
describe('Laundry (e2e)', () => {
  let app: INestApplication<App>;
  let adminUserRepository: Repository<AdminUserEntity>;
  let auditEventRepository: Repository<AuditEventEntity>;

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

  it('drives the intake -> priced -> completed flow over GraphQL and resolves lines + customer', async () => {
    const owner = await seedOwner(adminUserRepository);
    const cookie = extractCookie(
      await request(app.getHttpServer())
        .post('/graphql')
        .send({
          query: LOGIN,
          variables: { i: { email: owner.email, password: owner.password } },
        }),
    );

    const tag = owner.id.slice(0, 8);
    // Fixtures via the catalog GraphQL surface.
    const customerId = (
      await gql(
        cookie,
        `mutation($i: CreateCustomerInput!){ createCustomer(input:$i){ id } }`,
        {
          i: {
            email: `lj-${tag}-${Date.now()}@example.com`,
            fullName: 'Laundry Jane',
            phone: '555-1',
          },
        },
      )
    ).body.data.createCustomer.id;

    const serviceName = `Wash&Fold ${tag}-${Date.now()}`;
    const serviceId = (
      await gql(
        cookie,
        `mutation($i: CreateServiceInput!){ createService(input:$i){ id } }`,
        { i: { durationMinutes: 1, name: serviceName } },
      )
    ).body.data.createService.id;

    await gql(
      cookie,
      `mutation($i: CreatePricingRuleInput!){ createPricingRule(input:$i){ id } }`,
      {
        i: {
          serviceId,
          minimumChargeMinorUnits: 1000,
          priceMinorUnits: 2000,
          unit: 'PER_KG',
        },
      },
    );

    // Golden path.
    const received = await gql(
      cookie,
      `mutation($i: ReceiveLaundryOrderInput!){ receiveLaundryOrder(input:$i){ id status } }`,
      { i: { customerId, fulfillmentType: 'DELIVERY' } },
    );
    expect(received.body.errors).toBeUndefined();
    const orderId = received.body.data.receiveLaundryOrder.id;
    expect(received.body.data.receiveLaundryOrder.status).toBe('RECEIVED');

    // Amendment #164 §8.4.1: a zero weight is rejected over GraphQL by the
    // input's minimum, and the order stays RECEIVED and unweighed.
    const zero = await gql(
      cookie,
      `mutation($i: WeighLaundryOrderInput!){ weighLaundryOrder(input:$i){ status } }`,
      { i: { orderId, weightGrams: 0 } },
    );
    expect(zero.body.errors).toBeDefined();
    expect(JSON.stringify(zero.body.errors)).toContain(
      'weightGrams must not be less than 1',
    );
    const afterZero = await gql(
      cookie,
      `query($id: ID!){ laundryOrder(id:$id){ status weightGrams } }`,
      { id: orderId },
    );
    expect(afterZero.body.data.laundryOrder).toEqual({
      status: 'RECEIVED',
      weightGrams: null,
    });

    await gql(
      cookie,
      `mutation($i: WeighLaundryOrderInput!){ weighLaundryOrder(input:$i){ status weightGrams } }`,
      { i: { orderId, weightGrams: 400 } },
    );

    const priced = await gql(
      cookie,
      `mutation($i: PriceLaundryOrderInput!){ priceLaundryOrder(input:$i){ status totalMinorUnits } }`,
      { i: { addOns: [], baseServiceId: serviceId, orderId } },
    );
    expect(priced.body.errors).toBeUndefined();
    // 400 g * 2000 / 1000 = 800 -> floored to the 1000 minimum charge.
    expect(priced.body.data.priceLaundryOrder).toEqual({
      status: 'PRICED',
      totalMinorUnits: 1000,
    });

    // Query the single order with the nested line connection + customer relation.
    const detail = await gql(
      cookie,
      `query($id: ID!){ laundryOrder(id:$id){
         id status customer { id fullName }
         lines { nodes { serviceId pricingSnapshot { unit quantity amountMinorUnits minimumChargeApplied pricingRuleId description } } pageInfo { hasNextPage } }
       } }`,
      { id: orderId },
    );
    expect(detail.body.errors).toBeUndefined();
    const order = detail.body.data.laundryOrder;
    expect(order.customer.fullName).toBe('Laundry Jane');
    expect(order.lines.nodes).toHaveLength(1);
    expect(order.lines.nodes[0]).toEqual({
      pricingSnapshot: {
        pricingRuleId: expect.any(String),
        amountMinorUnits: 1000,
        // Frozen at pricing (Amendment #164 §8.4.2).
        description: serviceName,
        minimumChargeApplied: true,
        quantity: 400,
        unit: 'PER_KG',
      },
      serviceId,
    });

    // Illegal transition over GraphQL -> error, status unchanged.
    const illegal = await gql(
      cookie,
      `mutation($i: LaundryOrderRefInput!){ startLaundryProcessing(input:$i){ status } }`,
      { i: { orderId } },
    );
    expect(illegal.body.errors).toBeDefined();
    expect(illegal.body.errors[0].message).toMatch(/cannot transition/i);

    // Finish the happy path.
    for (const m of [
      'markLaundryOrderPaid',
      'startLaundryProcessing',
      'markLaundryOrderReady',
      'markLaundryOrderAwaitingDelivery',
      'completeLaundryOrder',
    ]) {
      const r = await gql(
        cookie,
        `mutation($i: LaundryOrderRefInput!){ ${m}(input:$i){ status } }`,
        { i: { orderId } },
      );
      expect(r.body.errors).toBeUndefined();
    }
    const final = await gql(
      cookie,
      `query($id: ID!){ laundryOrder(id:$id){ status } }`,
      { id: orderId },
    );
    expect(final.body.data.laundryOrder.status).toBe('COMPLETED');

    const events = await auditEventRepository.find({
      where: { entityId: orderId, entityType: 'laundry_order' },
    });
    expect(events.map((e) => e.action).sort()).toEqual(
      [
        'laundry_order.received',
        'laundry_order.weighed',
        'laundry_order.priced',
        'laundry_order.paid',
        'laundry_order.processing_started',
        'laundry_order.ready',
        'laundry_order.awaiting_delivery',
        'laundry_order.completed',
      ].sort(),
    );
    // #87 slice decision 11: every event carries the order's tenant.
    const [{ tenantId }]: { tenantId: string }[] =
      await auditEventRepository.manager.query(
        `SELECT "tenantId" FROM "laundry_order_entity" WHERE "id" = $1`,
        [orderId],
      );
    for (const event of events) {
      expect({ scope: event.scope, tenantId: event.tenantId }).toEqual({
        scope: 'TENANT',
        tenantId,
      });
    }
  });

  it('rejects laundryOrders for an unauthenticated request', async () => {
    const res = await request(app.getHttpServer()).post('/graphql').send({
      query: `query { laundryOrders(paging:{limit:1}){ totalCount } }`,
    });
    expect(res.body.errors).toBeDefined();
  });

  // Amendment #164 §8.4.5 over real HTTP: the preview is a read for the
  // OPERATIONAL roles and writes nothing.
  describe('previewLaundryOrderPrice', () => {
    const PREVIEW = `query($i: PriceLaundryOrderInput!){ previewLaundryOrderPrice(input:$i){
      estimatedTotalMinorUnits
      lines { serviceId addOnId description unit quantity rateMinorUnits amountMinorUnits minimumChargeMinorUnits minimumChargeApplied }
    } }`;

    async function login(email: string, password: string): Promise<string> {
      return extractCookie(
        await request(app.getHttpServer())
          .post('/graphql')
          .send({ query: LOGIN, variables: { i: { email, password } } }),
      );
    }

    // An owner session, a customer, and a service priced PER_KG at 2000 with
    // a 1000 floor, all in the bootstrap tenant.
    async function setup(): Promise<{
      cookie: string;
      customerId: string;
      serviceId: string;
      serviceName: string;
    }> {
      const owner = await seedOwner(adminUserRepository);
      const cookie = await login(owner.email, owner.password);
      const tag = `${owner.id.slice(0, 8)}-${Date.now()}`;
      const customerId = (
        await gql(
          cookie,
          `mutation($i: CreateCustomerInput!){ createCustomer(input:$i){ id } }`,
          {
            i: {
              email: `lp-${tag}@example.com`,
              fullName: 'Preview Pat',
              phone: '555-2',
            },
          },
        )
      ).body.data.createCustomer.id;
      const serviceName = `Preview Wash ${tag}`;
      const serviceId = (
        await gql(
          cookie,
          `mutation($i: CreateServiceInput!){ createService(input:$i){ id } }`,
          { i: { durationMinutes: 1, name: serviceName } },
        )
      ).body.data.createService.id;
      await gql(
        cookie,
        `mutation($i: CreatePricingRuleInput!){ createPricingRule(input:$i){ id } }`,
        {
          i: {
            serviceId,
            minimumChargeMinorUnits: 1000,
            priceMinorUnits: 2000,
            unit: 'PER_KG',
          },
        },
      );
      return { customerId, serviceId, cookie, serviceName };
    }

    async function receive(cookie: string, customerId: string) {
      return (
        await gql(
          cookie,
          `mutation($i: ReceiveLaundryOrderInput!){ receiveLaundryOrder(input:$i){ id } }`,
          { i: { customerId, fulfillmentType: 'PICKUP' } },
        )
      ).body.data.receiveLaundryOrder.id as string;
    }

    async function weigh(cookie: string, orderId: string) {
      await gql(
        cookie,
        `mutation($i: WeighLaundryOrderInput!){ weighLaundryOrder(input:$i){ id } }`,
        { i: { orderId, weightGrams: 400 } },
      );
    }

    async function readOrder(cookie: string, orderId: string) {
      return (
        await gql(
          cookie,
          `query($id: ID!){ laundryOrder(id:$id){ status totalMinorUnits lines { nodes { id } } } }`,
          { id: orderId },
        )
      ).body.data.laundryOrder;
    }

    it('previews a WEIGHED order without writing anything', async () => {
      const { cookie, customerId, serviceId, serviceName } = await setup();
      const orderId = await receive(cookie, customerId);
      await weigh(cookie, orderId);

      // baseQuantity is ignored for a PER_KG service (spec §4.5 step 3a).
      const res = await gql(cookie, PREVIEW, {
        i: { baseServiceId: serviceId, orderId, addOns: [], baseQuantity: 5 },
      });

      expect(res.body.errors).toBeUndefined();
      // 400 g * 2000 / 1000 = 800 -> floored to the 1000 minimum charge.
      expect(res.body.data.previewLaundryOrderPrice).toEqual({
        estimatedTotalMinorUnits: 1000,
        lines: [
          {
            addOnId: null,
            serviceId,
            amountMinorUnits: 1000,
            description: serviceName,
            minimumChargeApplied: true,
            minimumChargeMinorUnits: 1000,
            quantity: 400,
            rateMinorUnits: 2000,
            unit: 'PER_KG',
          },
        ],
      });
      expect(await readOrder(cookie, orderId)).toEqual({
        lines: { nodes: [] },
        status: 'WEIGHED',
        totalMinorUnits: null,
      });
      const events = await auditEventRepository.find({
        where: { entityId: orderId, entityType: 'laundry_order' },
      });
      expect(events.map((e) => e.action).sort()).toEqual([
        'laundry_order.received',
        'laundry_order.weighed',
      ]);
    });

    it('rejects a preview outside WEIGHED and changes nothing', async () => {
      const { cookie, customerId, serviceId } = await setup();
      const orderId = await receive(cookie, customerId);
      const input = { addOns: [], baseServiceId: serviceId, orderId };

      const received = await gql(cookie, PREVIEW, { i: input });
      expect(received.body.errors[0].message).toBe(
        'Cannot price a laundry order in status RECEIVED',
      );
      expect((await readOrder(cookie, orderId)).status).toBe('RECEIVED');

      await weigh(cookie, orderId);
      await gql(
        cookie,
        `mutation($i: PriceLaundryOrderInput!){ priceLaundryOrder(input:$i){ id } }`,
        { i: input },
      );
      const priced = await gql(cookie, PREVIEW, { i: input });
      expect(priced.body.errors[0].message).toBe(
        'Cannot price a laundry order in status PRICED',
      );
      const after = await readOrder(cookie, orderId);
      expect(after.status).toBe('PRICED');
      expect(after.totalMinorUnits).toBe(1000);
      expect(after.lines.nodes).toHaveLength(1);
    });

    it('forbids CUSTOMER_SUPPORT and allows SCHEDULER', async () => {
      const { cookie, customerId, serviceId } = await setup();
      const orderId = await receive(cookie, customerId);
      await weigh(cookie, orderId);
      const dataSource = adminUserRepository.manager.connection;
      const support = await seedTenantAdmin(
        dataSource,
        Role.CUSTOMER_SUPPORT,
        BOOTSTRAP_TENANT_ID,
      );
      const scheduler = await seedTenantAdmin(
        dataSource,
        Role.SCHEDULER,
        BOOTSTRAP_TENANT_ID,
      );
      const input = { addOns: [], baseServiceId: serviceId, orderId };

      const forbidden = await gql(
        await login(support.email, support.password),
        PREVIEW,
        { i: input },
      );
      const allowed = await gql(
        await login(scheduler.email, scheduler.password),
        PREVIEW,
        { i: input },
      );

      expect(forbidden.body.errors[0].extensions.code).toBe('FORBIDDEN');
      expect(forbidden.body.data).toBeNull();
      expect(allowed.body.errors).toBeUndefined();
      expect(
        allowed.body.data.previewLaundryOrderPrice.estimatedTotalMinorUnits,
      ).toBe(1000);
    });
  });
});
