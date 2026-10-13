import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { Role } from '../src/platform/auth/domain/role';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import { seedTenantAdmin } from './helpers/seed-tenant-admin';

// Characterization (#160): pins the existing reads and writes the laundry
// intake modal relies on, as a SCHEDULER: the one intake role that cannot
// create customers (its createCustomer FORBIDDEN is pinned in
// customers-properties.e2e-spec.ts). No API code changes in #160. As in
// laundry-order-list-filters.e2e-spec.ts, rows stay in the shared bootstrap
// tenant and every name carries a per-run tag.
describe('laundry intake customer search (e2e)', () => {
  let app: INestApplication<App>;
  let ownerCookie: string;
  let schedulerCookie: string;
  let tag: string;
  const customerIds = { anaFirst: '', anaSecond: '' };

  const SEARCH = `query($f: CustomerFilter, $p: OffsetPaging, $s: [CustomerSort!]) {
    customers(filter: $f, paging: $p, sorting: $s) {
      totalCount
      nodes { id fullName email phone }
    }
  }`;

  function gql(cookie: string, query: string, variables?: object) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query, variables });
  }

  async function login(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `mutation L($i: LoginInput!) { login(loginInput: $i) { success } }`,
        variables: { i: { email, password } },
      });
    return (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
  }

  async function customer(name: string, slug: string, phone: string): Promise<string> {
    const res = await gql(
      ownerCookie,
      `mutation($i: CreateCustomerInput!){ createCustomer(input:$i){ id } }`,
      { i: { email: `${slug}-${tag}@example.com`, fullName: `${name} ${tag}`, phone } },
    );
    expect(res.body.errors).toBeUndefined();
    return res.body.data.createCustomer.id;
  }

  // The modal's variables (apps/web/lib/use-laundry-customer-search.ts).
  function searchVariables(text: string, limit = 20) {
    return {
      f: { fullName: { iLike: `%${text}%` } },
      p: { limit },
      s: [
        { direction: 'ASC', field: 'fullName' },
        { direction: 'ASC', field: 'id' },
      ],
    };
  }

  async function searchIds(text: string): Promise<string[]> {
    const res = await gql(schedulerCookie, SEARCH, searchVariables(text));
    expect(res.body.errors).toBeUndefined();
    return res.body.data.customers.nodes.map((node: { id: string }) => node.id).sort();
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    applyPlatformPipes(app);
    await app.init();

    const dataSource = moduleFixture.get(DataSource);
    const owner = await seedTenantAdmin(dataSource, Role.TENANT_OWNER, BOOTSTRAP_TENANT_ID);
    const scheduler = await seedTenantAdmin(dataSource, Role.SCHEDULER, BOOTSTRAP_TENANT_ID);
    ownerCookie = await login(owner.email, owner.password);
    schedulerCookie = await login(scheduler.email, scheduler.password);
    tag = `${scheduler.id.slice(0, 8)}${Date.now()}`;

    customerIds.anaFirst = await customer('Ana Reyes', 'ana-first', '555-0101');
    customerIds.anaSecond = await customer('Ana Reyes', 'ana-second', '555-0102');
    await customer('Ben Cruz', 'ben', '555-0103');
  });

  afterAll(async () => {
    await app.close();
  });

  it('finds customers by name for a SCHEDULER, with phone and email to tell namesakes apart', async () => {
    const res = await gql(schedulerCookie, SEARCH, searchVariables(`ana reyes ${tag}`));
    expect(res.body.errors).toBeUndefined();
    const { nodes, totalCount } = res.body.data.customers;
    expect(totalCount).toBe(2);
    expect(nodes.map((node: { id: string }) => node.id).sort()).toEqual(
      [customerIds.anaFirst, customerIds.anaSecond].sort(),
    );
    expect(nodes.map((node: { phone: string }) => node.phone).sort()).toEqual(['555-0101', '555-0102']);
    expect(new Set(nodes.map((node: { email: string }) => node.email)).size).toBe(2);
  });

  it('matches a mixed-case fragment from inside the name', async () => {
    // "eYeS <TAG>" starts mid-word and flips the case of the stored name.
    expect(await searchIds(`eYeS ${tag.toUpperCase()}`)).toEqual(
      [customerIds.anaFirst, customerIds.anaSecond].sort(),
    );
  });

  it('applies the page limit on the server while totalCount still counts every match', async () => {
    const res = await gql(schedulerCookie, SEARCH, searchVariables(`ana reyes ${tag}`, 1));
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.customers.nodes).toHaveLength(1);
    expect(res.body.data.customers.totalCount).toBe(2);
  });

  it('lets a SCHEDULER receive an order for a customer found by search', async () => {
    const received = await gql(
      schedulerCookie,
      `mutation($i: ReceiveLaundryOrderInput!){ receiveLaundryOrder(input:$i){ id } }`,
      { i: { customerId: customerIds.anaSecond, fulfillmentType: 'DELIVERY' } },
    );
    expect(received.body.errors).toBeUndefined();
    const id = received.body.data.receiveLaundryOrder.id;
    const read = await gql(
      schedulerCookie,
      `query($id: ID!){ laundryOrder(id:$id){ id status fulfillmentType customer { id } } }`,
      { id },
    );
    expect(read.body.errors).toBeUndefined();
    expect(read.body.data.laundryOrder).toEqual({
      id,
      customer: { id: customerIds.anaSecond },
      fulfillmentType: 'DELIVERY',
      status: 'RECEIVED',
    });
  });
});
