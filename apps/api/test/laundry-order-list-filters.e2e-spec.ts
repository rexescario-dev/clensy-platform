import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { AdminUserEntity } from '../src/modules/admins/infrastructure/persistence/admin-user.entity';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import { seedOwner } from './helpers/seed-owner';

// Characterization (#163): pins the existing `laundryOrders` filter and
// sort capabilities the redesigned list relies on. No API code changes in
// #163. Every assertion is scoped by a per-run name tag, because the
// bootstrap tenant is shared across suites and runs.
describe('laundryOrders list filters (e2e)', () => {
  let app: INestApplication<App>;
  let cookie: string;
  let tag: string;
  const ids: Record<'anaDelivery' | 'anaPickup' | 'benPickup', string> = {
    anaDelivery: '',
    anaPickup: '',
    benPickup: '',
  };
  const customerIds = { ana: '', ben: '' };

  const ORDERS = `query($f: LaundryOrderFilter, $s: [LaundryOrderSort!]) {
    laundryOrders(filter: $f, sorting: $s, paging: { limit: 50 }) {
      totalCount
      nodes { id status fulfillmentType customer { fullName } }
    }
  }`;

  function gql(query: string, variables?: object) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query, variables });
  }

  async function nodeIds(
    filter: object,
    sorting?: object[],
  ): Promise<string[]> {
    const res = await gql(ORDERS, { f: filter, s: sorting });
    expect(res.body.errors).toBeUndefined();
    return res.body.data.laundryOrders.nodes.map((n: { id: string }) => n.id);
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    applyPlatformPipes(app);
    await app.init();

    const owner = await seedOwner(
      moduleFixture.get<Repository<AdminUserEntity>>(
        getRepositoryToken(AdminUserEntity),
      ),
    );
    const login = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `mutation L($i: LoginInput!) { login(loginInput: $i) { success } }`,
        variables: { i: { email: owner.email, password: owner.password } },
      });
    cookie = (login.headers['set-cookie'] as unknown as string[])[0].split(
      ';',
    )[0];
    tag = `${owner.id.slice(0, 8)}${Date.now()}`;

    async function customer(name: string): Promise<string> {
      const res = await gql(
        `mutation($i: CreateCustomerInput!){ createCustomer(input:$i){ id } }`,
        {
          i: {
            email: `${name.replace(/ /g, '-')}-${tag}@example.com`,
            fullName: `${name} ${tag}`,
            phone: '555-1',
          },
        },
      );
      return res.body.data.createCustomer.id;
    }
    async function receive(
      customerId: string,
      fulfillmentType: string,
    ): Promise<string> {
      const res = await gql(
        `mutation($i: ReceiveLaundryOrderInput!){ receiveLaundryOrder(input:$i){ id } }`,
        { i: { customerId, fulfillmentType } },
      );
      return res.body.data.receiveLaundryOrder.id;
    }

    customerIds.ana = await customer('Ana Reyes');
    customerIds.ben = await customer('Ben Cruz');
    // Received in this order, one request each, so createdAt is strictly
    // increasing: anaPickup, anaDelivery, benPickup.
    ids.anaPickup = await receive(customerIds.ana, 'PICKUP');
    ids.anaDelivery = await receive(customerIds.ana, 'DELIVERY');
    ids.benPickup = await receive(customerIds.ben, 'PICKUP');
    await gql(
      `mutation($i: WeighLaundryOrderInput!){ weighLaundryOrder(input:$i){ id } }`,
      { i: { orderId: ids.anaDelivery, weightGrams: 1200 } },
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('matches customer.fullName case-insensitively through the customer relation', async () => {
    const found = await nodeIds({
      customer: { fullName: { iLike: `%ana reyes ${tag}%` } },
    });
    expect(found.sort()).toEqual([ids.anaDelivery, ids.anaPickup].sort());
  });

  it('combines the name filter with an exact id match under or', async () => {
    const found = await nodeIds({
      or: [
        { customer: { fullName: { iLike: `%nobody ${tag}%` } } },
        { id: { eq: ids.benPickup } },
      ],
    });
    expect(found).toEqual([ids.benPickup]);
    // `or` is ANDed with a sibling filter: the `or` matches anaDelivery
    // (WEIGHED) and benPickup (RECEIVED); the sibling must drop benPickup.
    const weighed = await nodeIds({
      or: [
        { customer: { fullName: { iLike: `%ana reyes ${tag}%` } } },
        { id: { eq: ids.benPickup } },
      ],
      status: { eq: 'WEIGHED' },
    });
    expect(weighed).toEqual([ids.anaDelivery]);
  });

  it('ANDs status and fulfillmentType with the search clause', async () => {
    const name = { customer: { fullName: { iLike: `%${tag}%` } } };
    expect(await nodeIds({ ...name, status: { eq: 'WEIGHED' } })).toEqual([
      ids.anaDelivery,
    ]);
    expect(
      (await nodeIds({ ...name, fulfillmentType: { eq: 'PICKUP' } })).sort(),
    ).toEqual([ids.anaPickup, ids.benPickup].sort());
  });

  // Orders by each field, both directions. The request supplies the
  // `id ASC` tie-breaker itself: the API does not add one, the web list's
  // query builder does. Postgres orders an enum by declaration order
  // (PICKUP before DELIVERY; RECEIVED before WEIGHED), not by label.
  it('orders by every LaundryOrderSortFields member when given the id ASC tie-breaker', async () => {
    const name = { customer: { fullName: { iLike: `%${tag}%` } } };
    const rows = [
      {
        id: ids.anaPickup,
        customerId: customerIds.ana,
        createdAt: 0,
        fulfillmentType: 0,
        status: 0,
      },
      {
        id: ids.anaDelivery,
        customerId: customerIds.ana,
        createdAt: 1,
        fulfillmentType: 1,
        status: 1,
      },
      {
        id: ids.benPickup,
        customerId: customerIds.ben,
        createdAt: 2,
        fulfillmentType: 0,
        status: 0,
      },
    ];
    for (const field of [
      'createdAt',
      'customerId',
      'fulfillmentType',
      'id',
      'status',
    ] as const) {
      for (const direction of ['ASC', 'DESC'] as const) {
        const sign = direction === 'ASC' ? 1 : -1;
        const expected = [...rows]
          .sort((x, y) => {
            const primary =
              x[field] < y[field] ? -1 : x[field] > y[field] ? 1 : 0;
            return primary !== 0 ? sign * primary : x.id < y.id ? -1 : 1;
          })
          .map((row) => row.id);
        const sorting =
          field === 'id'
            ? [{ direction, field }]
            : [
                { direction, field },
                { direction: 'ASC', field: 'id' },
              ];
        expect({
          direction,
          field,
          found: await nodeIds(name, sorting),
        }).toEqual({
          direction,
          field,
          found: expected,
        });
      }
    }
  });

  // Database characterization of `iLike` patterns, not of the web helper:
  // `\%` in a pattern is a literal percent sign. Escaping raw user text is
  // the web query builder's job, tested in laundry-order-list-query.test.ts.
  it('reads an escaped % in an iLike pattern literally', async () => {
    expect(
      await nodeIds({ customer: { fullName: { iLike: `%${tag}\\%%` } } }),
    ).toEqual([]);
  });

  // The #163 spike: partial id search is not available on the uuid column.
  it('rejects a partial iLike on the uuid id', async () => {
    const res = await gql(ORDERS, {
      f: { id: { iLike: `%${ids.benPickup.slice(0, 8)}%` } },
    });
    expect(res.body.errors).toBeDefined();
  });

  // #171: `OffsetPaging.offset` is a GraphQL `Int` (32-bit signed). The web
  // list therefore treats a URL offset above 2147483647 as malformed.
  it('accepts an offset at the top of the GraphQL Int range and rejects one above it', async () => {
    const PAGE = `query($o: Int!) { laundryOrders(paging: { limit: 20, offset: $o }) { totalCount nodes { id } } }`;
    const inRange = await gql(PAGE, { o: 2147483640 });
    expect(inRange.body.errors).toBeUndefined();
    expect(inRange.body.data.laundryOrders.nodes).toEqual([]);
    const above = await gql(PAGE, { o: 2147483648 });
    // The Int coercion error specifically, not any error.
    expect(above.body.errors?.[0]?.message).toMatch(
      /Int cannot represent non 32-bit signed integer value/,
    );
  });
});
