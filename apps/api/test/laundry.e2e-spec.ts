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
import { seedOwner } from './helpers/seed-owner';

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
            fullName: 'Laundry Jane',
            email: `lj-${tag}-${Date.now()}@example.com`,
            phone: '555-1',
          },
        },
      )
    ).body.data.createCustomer.id;

    const serviceId = (
      await gql(
        cookie,
        `mutation($i: CreateServiceInput!){ createService(input:$i){ id } }`,
        { i: { name: `Wash&Fold ${tag}-${Date.now()}`, durationMinutes: 1 } },
      )
    ).body.data.createService.id;

    await gql(
      cookie,
      `mutation($i: CreatePricingRuleInput!){ createPricingRule(input:$i){ id } }`,
      {
        i: {
          serviceId,
          priceMinorUnits: 2000,
          unit: 'PER_KG',
          minimumChargeMinorUnits: 1000,
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

    await gql(
      cookie,
      `mutation($i: WeighLaundryOrderInput!){ weighLaundryOrder(input:$i){ status weightGrams } }`,
      { i: { orderId, weightGrams: 400 } },
    );

    const priced = await gql(
      cookie,
      `mutation($i: PriceLaundryOrderInput!){ priceLaundryOrder(input:$i){ status totalMinorUnits } }`,
      { i: { orderId, baseServiceId: serviceId, addOns: [] } },
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
         lines { nodes { serviceId pricingSnapshot { unit quantity amountMinorUnits minimumChargeApplied pricingRuleId } } pageInfo { hasNextPage } }
       } }`,
      { id: orderId },
    );
    expect(detail.body.errors).toBeUndefined();
    const order = detail.body.data.laundryOrder;
    expect(order.customer.fullName).toBe('Laundry Jane');
    expect(order.lines.nodes).toHaveLength(1);
    expect(order.lines.nodes[0]).toEqual({
      serviceId,
      pricingSnapshot: {
        unit: 'PER_KG',
        quantity: 400,
        amountMinorUnits: 1000,
        minimumChargeApplied: true,
        pricingRuleId: expect.any(String),
      },
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
      where: { entityType: 'laundry_order', entityId: orderId },
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
  });

  it('rejects laundryOrders for an unauthenticated request', async () => {
    const res = await request(app.getHttpServer()).post('/graphql').send({
      query: `query { laundryOrders(paging:{limit:1}){ totalCount } }`,
    });
    expect(res.body.errors).toBeDefined();
  });
});
