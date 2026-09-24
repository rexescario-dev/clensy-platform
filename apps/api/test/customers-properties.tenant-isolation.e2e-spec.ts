import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getQueryServiceToken, QueryService } from '@ptc-org/nestjs-query-core';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { BookingEntity } from '../src/modules/bookings/infrastructure/persistence/booking.entity';
import { ServiceEntity } from '../src/modules/catalog/infrastructure/persistence/service.entity';
import { CustomerEntity } from '../src/modules/customers/infrastructure/persistence/customer.entity';
import { PropertyEntity } from '../src/modules/customers/infrastructure/persistence/property.entity';
import { tenantFilterFor } from '../src/platform/auth/authorization/tenant-read.authorizer';
import { Role } from '../src/platform/auth/domain/role';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import {
  createTestTenant,
  removeTestTenants,
  seedTenantAdmin,
} from './helpers/seed-tenant-admin';

// Customer/Property tenant isolation through the real GraphQL stack (#82).
// Starts as the Task 5 M6 verification spike: `@Authorize(tenantReadAuthorizer())`
// on `CustomerType` / `PropertyType` with `tenantId` NOT exposed as a GraphQL
// field. The pass criteria are behavioral (rows returned), not SQL shape.
//
// Self-contained: two fresh test tenants, unique-per-run rows, and every
// assertion is scoped to the ids this suite created — safe against the
// shared, non-truncated e2e database.
describe('Customers & Properties tenant isolation (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  const run = randomUUID();
  let tenantA: string;
  let tenantB: string;
  let cookieB: string;
  let customerA: CustomerEntity;
  let customerB: CustomerEntity;
  let propertyA: PropertyEntity;
  let service: ServiceEntity;
  let crossTenantBooking: BookingEntity;

  const LOGIN_MUTATION = `
    mutation Login($input: LoginInput!) {
      login(loginInput: $input) { success }
    }
  `;

  function extractSessionCookie(response: request.Response): string {
    const setCookieHeader = response.headers['set-cookie'] as unknown as
      string[] | undefined;
    if (!setCookieHeader || setCookieHeader.length === 0) {
      throw new Error('Expected a Set-Cookie header on the login response');
    }
    return setCookieHeader[0].split(';')[0];
  }

  async function loginAs(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: LOGIN_MUTATION,
        variables: { input: { email, password } },
      });
    return extractSessionCookie(response);
  }

  function gql(
    cookie: string,
    query: string,
    variables: Record<string, unknown> = {},
  ) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query, variables });
  }

  async function insertCustomer(
    tenantId: string,
    label: string,
  ): Promise<CustomerEntity> {
    const repository = dataSource.getRepository(CustomerEntity);
    return repository.save(
      repository.create({
        tenantId,
        email: `${label.toLowerCase().replace(/\s+/g, '-')}-${run}@example.com`,
        fullName: `${label} ${run}`,
        notes: null,
        phone: '555-0100',
      }),
    );
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

    tenantA = await createTestTenant(dataSource);
    tenantB = await createTestTenant(dataSource);
    const ownerB = await seedTenantAdmin(
      dataSource,
      Role.TENANT_OWNER,
      tenantB,
    );
    cookieB = await loginAs(ownerB.email, ownerB.password);

    customerA = await insertCustomer(tenantA, 'Customer A');
    customerB = await insertCustomer(tenantB, 'Customer B');

    const propertyRepository = dataSource.getRepository(PropertyEntity);
    propertyA = await propertyRepository.save(
      propertyRepository.create({
        customerId: customerA.id,
        tenantId: tenantA,
        accessNotes: null,
        addressLine1: '1 A Street',
        addressLine2: null,
        city: 'A City',
        label: `Home A ${run}`,
        postalCode: '00001',
        region: 'AR',
      }),
    );

    // Bookings and services are not tenant-owned yet (#85) — a booking that
    // references tenant A's customer/property is visible to tenant B, which
    // is exactly what makes it a relation-scoping probe.
    const serviceRepository = dataSource.getRepository(ServiceEntity);
    service = await serviceRepository.save(
      serviceRepository.create({
        active: true,
        description: null,
        durationMinutes: 60,
        name: `Tenant isolation service ${run}`,
      }),
    );
    const bookingRepository = dataSource.getRepository(BookingEntity);
    crossTenantBooking = await bookingRepository.save(
      bookingRepository.create({
        customerId: customerA.id,
        propertyId: propertyA.id,
        serviceId: service.id,
        teamId: null,
        pricingSnapshot: { priceMinorUnits: 1000 },
        scheduledAt: new Date('2030-01-01T09:00:00Z'),
      }),
    );
  });

  afterAll(async () => {
    const tenantIds = [tenantA, tenantB].filter(Boolean);
    if (dataSource) {
      if (crossTenantBooking) {
        await dataSource
          .getRepository(BookingEntity)
          .delete({ id: crossTenantBooking.id });
      }
      if (service) {
        await dataSource
          .getRepository(ServiceEntity)
          .delete({ id: service.id });
      }
      if (tenantIds.length > 0) {
        await dataSource.query(
          `DELETE FROM "property_entity" WHERE "tenantId" = ANY($1)`,
          [tenantIds],
        );
        await dataSource.query(
          `DELETE FROM "customer_entity" WHERE "tenantId" = ANY($1)`,
          [tenantIds],
        );
        await removeTestTenants(dataSource, tenantIds);
      }
    }
    await app?.close();
  });

  const CUSTOMERS_QUERY = `
    query Customers($filter: CustomerFilter) {
      customers(filter: $filter, paging: { limit: 100 }) {
        totalCount
        nodes { id fullName }
      }
    }
  `;

  interface CustomersPage {
    totalCount: number;
    nodes: { id: string; fullName: string }[];
  }

  async function customersAsB(filter: Record<string, unknown>) {
    const response = await gql(cookieB, CUSTOMERS_QUERY, { filter });
    expect(response.body.errors).toBeUndefined();
    return (response.body as { data: { customers: CustomersPage } }).data
      .customers;
  }

  it("excludes another tenant's customers from the root list", async () => {
    const page = await customersAsB({
      fullName: { in: [customerA.fullName, customerB.fullName] },
    });
    const ids = page.nodes.map((node) => node.id);
    expect(ids).toContain(customerB.id);
    expect(ids).not.toContain(customerA.id);
  });

  it('still lets a client filter narrow within the tenant', async () => {
    const own = await customersAsB({ fullName: { eq: customerB.fullName } });
    expect(own.nodes.map((node) => node.id)).toEqual([customerB.id]);

    const foreign = await customersAsB({
      fullName: { eq: customerA.fullName },
    });
    expect(foreign.nodes).toEqual([]);
    expect(foreign.totalCount).toBe(0);
  });

  it("counts only the principal tenant's rows in totalCount", async () => {
    const unfiltered = await customersAsB({});
    // Tenant B is a fresh test tenant: its only customer is customer B.
    expect(unfiltered.totalCount).toBe(1);
    expect(unfiltered.nodes.map((node) => node.id)).toEqual([customerB.id]);
  });

  // Booking is not tenant-owned yet (#85), so tenant B can see a booking that
  // references tenant A's customer/property. The tenant authorizer (applied
  // to the relation via the target DTO's `@Authorize`) filters the related
  // row out; `Booking.customer` / `Booking.property` are non-nullable, so the
  // field errors instead of returning A's row. That error is the evidence
  // the relation read ran and was scoped — not a vacuous empty result.
  it.each(['customer', 'property'] as const)(
    "never resolves another tenant's %s through a booking relation",
    async (relation) => {
      const response = await gql(
        cookieB,
        `query Bookings($id: ID!) {
          bookings(filter: { id: { eq: $id } }) {
            nodes { id ${relation} { id } }
          }
        }`,
        { id: crossTenantBooking.id },
      );
      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain(customerA.id);
      expect(serialized).not.toContain(propertyA.id);
      const errors = (response.body as { errors?: { path?: unknown[] }[] })
        .errors;
      expect(errors?.map((error) => error.path)).toEqual([
        ['bookings', 'nodes', 0, relation],
      ]);
    },
  );

  // `@Authorize` is relied on for reads only; write isolation comes from the
  // four custom service-backed mutations. Any nestjs-query-generated
  // Customer/Property mutation (CRUD or relation — e.g. `createOneCustomer`,
  // `addPropertiesToCustomer`, `setCustomerOnBooking`) would bypass that, so
  // the whole-app schema is matched by pattern, not a fixed deny-list.
  it('exposes no generated Customer/Property mutation', async () => {
    const response = await gql(
      cookieB,
      '{ __schema { mutationType { fields { name } } } }',
    );
    const names = (
      response.body as {
        data: { __schema: { mutationType: { fields: { name: string }[] } } };
      }
    ).data.__schema.mutationType.fields.map((field) => field.name);
    expect(names.length).toBeGreaterThan(0);
    const touchingCustomerOrProperty = names.filter((name) =>
      /customer|propert/i.test(name),
    );
    expect(touchingCustomerOrProperty.sort()).toEqual(
      [
        'createCustomer',
        'createProperty',
        'updateCustomer',
        'updateProperty',
      ].sort(),
    );
  });

  it('matches no rows with the no-tenant filter on real Postgres', async () => {
    const queryService = app.get<QueryService<CustomerEntity>>(
      getQueryServiceToken(CustomerEntity),
      { strict: false },
    );
    const rows = await queryService.query({
      filter: tenantFilterFor(null),
    });
    expect(rows).toEqual([]);
    expect(await queryService.count(tenantFilterFor(null))).toBe(0);
  });
});
