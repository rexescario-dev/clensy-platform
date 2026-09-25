import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueryServiceToken, QueryService } from '@ptc-org/nestjs-query-core';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { BookingEntity } from '../src/modules/bookings/infrastructure/persistence/booking.entity';
import { PricingRulesService } from '../src/modules/catalog/application/services/pricing-rules.service';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { ServiceEntity } from '../src/modules/catalog/infrastructure/persistence/service.entity';
import { CustomersService } from '../src/modules/customers/application/services/customers.service';
import { PropertiesService } from '../src/modules/customers/application/services/properties.service';
import { CustomerEntity } from '../src/modules/customers/infrastructure/persistence/customer.entity';
import { PropertyEntity } from '../src/modules/customers/infrastructure/persistence/property.entity';
import { AdminScope } from '../src/platform/auth/domain/admin-scope';
import { tenantFilterFor } from '../src/platform/auth/authorization/tenant-read.authorizer';
import { Role } from '../src/platform/auth/domain/role';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import {
  createTestTenant,
  removeTestTenants,
  seedTenantAdmin,
} from './helpers/seed-tenant-admin';
import { uniqueEmail } from './helpers/unique-email';

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
  let customersService: CustomersService;
  let propertiesService: PropertiesService;
  let servicesService: ServicesService;
  let pricingRulesService: PricingRulesService;
  let auditEventRepository: Repository<AuditEventEntity>;

  const run = randomUUID();
  let tenantA: string;
  let tenantB: string;
  let cookieA: string;
  let cookieB: string;
  let customerA: CustomerEntity;
  let customerB: CustomerEntity;
  let propertyA: PropertyEntity;
  let propertyB: PropertyEntity;
  let service: ServiceEntity;
  let bookableService: { id: string };
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
    customersService = moduleFixture.get(CustomersService);
    propertiesService = moduleFixture.get(PropertiesService);
    servicesService = moduleFixture.get(ServicesService);
    pricingRulesService = moduleFixture.get(PricingRulesService);
    auditEventRepository = moduleFixture.get(
      getRepositoryToken(AuditEventEntity),
    );

    tenantA = await createTestTenant(dataSource);
    tenantB = await createTestTenant(dataSource);
    const ownerA = await seedTenantAdmin(
      dataSource,
      Role.TENANT_OWNER,
      tenantA,
    );
    const ownerB = await seedTenantAdmin(
      dataSource,
      Role.TENANT_OWNER,
      tenantB,
    );
    cookieA = await loginAs(ownerA.email, ownerA.password);
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
    propertyB = await propertyRepository.save(
      propertyRepository.create({
        customerId: customerB.id,
        tenantId: tenantB,
        accessNotes: null,
        addressLine1: '1 B Street',
        addressLine2: null,
        city: 'B City',
        label: `Home B ${run}`,
        postalCode: '00002',
        region: 'BR',
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

    // A real, active-priced service (RFC §4.9's "another tenant's id"
    // worked example needs a well-formed request — the only thing wrong
    // with it is the customer/property ids — not a service that would fail
    // for an unrelated reason).
    bookableService = await servicesService.createService({
      actorId: 'e2e',
      durationMinutes: 45,
      name: `Tenant isolation bookable service ${run}`,
    });
    await pricingRulesService.createPricingRule({
      actorId: 'e2e',
      priceMinorUnits: 2500,
      serviceId: bookableService.id,
    });
  });

  afterAll(async () => {
    try {
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
        if (bookableService) {
          await dataSource.query(
            `DELETE FROM "pricing_rule_entity" WHERE "serviceId" = $1`,
            [bookableService.id],
          );
          await dataSource
            .getRepository(ServiceEntity)
            .delete({ id: bookableService.id });
        }
        if (tenantIds.length > 0) {
          // Deletes every Customer/Property row under these tenants,
          // including ones individual tests below create via GraphQL
          // (item 8's duplicate-email customers, item 9's audit-probe
          // customer/property) — not just the two inserted above.
          await removeTestTenants(dataSource, tenantIds);
        }
      }
    } finally {
      await app?.close();
    }
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

  it("returns empty for an id-filtered list naming another tenant's row", async () => {
    const page = await customersAsB({ id: { eq: customerA.id } });
    expect(page.nodes).toEqual([]);
    expect(page.totalCount).toBe(0);
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
      const errors = (
        response.body as { errors?: { path?: unknown[]; message?: string }[] }
      ).errors;
      expect(errors?.map((error) => error.path)).toEqual([
        ['bookings', 'nodes', 0, relation],
      ]);
      // Interim error shape (#85 makes this booking invisible to B instead):
      // GraphQL's non-null-field violation, not a bespoke tenant-scoping
      // error — asserted precisely so a future relaxation of `customer`/
      // `property`'s non-nullability is caught here, not just by the path.
      expect(errors?.[0]?.message).toMatch(
        /Cannot return null for non-nullable field Booking\.(customer|property)/,
      );
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

  // ---- Task 8 brief: the remaining twelve acceptance cases -----------------

  const CREATE_CUSTOMER_MUTATION = `
    mutation CreateCustomer($input: CreateCustomerInput!) {
      createCustomer(input: $input) { id email }
    }
  `;

  const UPDATE_CUSTOMER_MUTATION = `
    mutation UpdateCustomer($id: ID!, $input: UpdateCustomerInput!) {
      updateCustomer(id: $id, input: $input) { id phone }
    }
  `;

  const CREATE_PROPERTY_MUTATION = `
    mutation CreateProperty($customerId: ID!, $input: CreatePropertyInput!) {
      createProperty(customerId: $customerId, input: $input) { id }
    }
  `;

  const UPDATE_PROPERTY_MUTATION = `
    mutation UpdateProperty($id: ID!, $input: UpdatePropertyInput!) {
      updateProperty(id: $id, input: $input) { id label }
    }
  `;

  const CUSTOMER_PROPERTIES_QUERY = `
    query CustomerProperties($customerId: ID!) {
      customerProperties(customerId: $customerId) {
        totalCount
        nodes { id }
      }
    }
  `;

  const CREATE_BOOKING_MUTATION = `
    mutation CreateBooking($input: CreateBookingInput!) {
      createBooking(createBookingInput: $input) { id }
    }
  `;

  const RECEIVE_LAUNDRY_ORDER_MUTATION = `
    mutation ReceiveLaundryOrder($input: ReceiveLaundryOrderInput!) {
      receiveLaundryOrder(input: $input) { id }
    }
  `;

  function errorStatus(response: request.Response): number | undefined {
    return (
      response.body as { errors?: { extensions?: { status?: number } }[] }
    ).errors?.[0]?.extensions?.status;
  }

  // Item 1: nullable get-by-id contracts (RFC §4.5) — another tenant's row
  // is indistinguishable from a missing one: `null`, not an error, not 403.
  describe('cross-tenant get-by-id', () => {
    it("customer(id)/property(id) return null for another tenant's row", async () => {
      const customerResponse = await gql(
        cookieB,
        `query Customer($id: ID!) { customer(id: $id) { id } }`,
        { id: customerA.id },
      );
      expect(customerResponse.body.errors).toBeUndefined();
      expect(customerResponse.body.data.customer).toBeNull();

      const propertyResponse = await gql(
        cookieB,
        `query Property($id: ID!) { property(id: $id) { id } }`,
        { id: propertyA.id },
      );
      expect(propertyResponse.body.errors).toBeUndefined();
      expect(propertyResponse.body.data.property).toBeNull();
    });
  });

  // Item 3: `customerProperties(customerId)` for another tenant's customer.
  //
  // Deviation from the brief's literal wording ("⇒ NotFound error"): the
  // resolver (paginated-graphql-collections plan, Task 4) queries
  // `PropertyQueryService` directly with a `{ customerId, tenantId }`
  // server scope — it never calls `PropertiesService.listCustomerProperties`
  // (the only NotFound-throwing path) and has no customer-existence check at
  // all, cross-tenant or otherwise. Confirmed against
  // `customers-properties.e2e-spec.ts`, which has no NotFound case for this
  // field either. Given the tenant-isolation plan's own Task 5 section
  // ("`customerProperties` scopes data and count... discards a client
  // `tenantId`... in both the page query and the count"), an empty,
  // zero-count connection — not a thrown error — is the correct, already-
  // implemented isolation contract here. Asserting a NotFound this resolver
  // structurally cannot produce would be testing the brief's prose, not the
  // security property; the assertion below is the tenant-scoping guarantee
  // that actually matters: A's property never appears, and B is told "zero
  // rows for that customer," not "found nothing to filter."
  describe('customerProperties across tenants', () => {
    it("returns an empty, zero-count connection for another tenant's customerId", async () => {
      const response = await gql(cookieB, CUSTOMER_PROPERTIES_QUERY, {
        customerId: customerA.id,
      });
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.customerProperties).toEqual({
        totalCount: 0,
        nodes: [],
      });
    });
  });

  // Item 4: updateCustomer/updateProperty across tenants — NotFound, and the
  // target row is verified unchanged directly against Postgres.
  describe('cross-tenant update', () => {
    it('updateCustomer throws NotFound and leaves the row unchanged', async () => {
      const response = await gql(cookieB, UPDATE_CUSTOMER_MUTATION, {
        id: customerA.id,
        input: { phone: '555-9999' },
      });
      expect(response.body.data?.updateCustomer).toBeUndefined();
      expect(errorStatus(response)).toBe(404);

      const stillA = await dataSource
        .getRepository(CustomerEntity)
        .findOneBy({ id: customerA.id });
      expect(stillA?.phone).toBe(customerA.phone);
    });

    it('updateProperty throws NotFound and leaves the row unchanged', async () => {
      const response = await gql(cookieB, UPDATE_PROPERTY_MUTATION, {
        id: propertyA.id,
        input: { label: 'Hijacked by tenant B' },
      });
      expect(response.body.data?.updateProperty).toBeUndefined();
      expect(errorStatus(response)).toBe(404);

      const stillA = await dataSource
        .getRepository(PropertyEntity)
        .findOneBy({ id: propertyA.id });
      expect(stillA?.label).toBe(propertyA.label);
    });
  });

  // Item 5: createProperty(customerId) for another tenant's customer.
  describe('cross-tenant createProperty', () => {
    it('throws NotFound and persists no property row', async () => {
      const uniqueLabel = `should-not-persist-${run}`;
      const response = await gql(cookieB, CREATE_PROPERTY_MUTATION, {
        customerId: customerA.id,
        input: {
          addressLine1: '1 Nowhere Ave',
          city: 'Nowhere',
          label: uniqueLabel,
          postalCode: '00000',
          region: 'NA',
        },
      });
      expect(response.body.data?.createProperty).toBeUndefined();
      expect(errorStatus(response)).toBe(404);

      const persisted = await dataSource
        .getRepository(PropertyEntity)
        .findOneBy({ label: uniqueLabel });
      expect(persisted).toBeNull();
    });
  });

  // Item 6: createBooking referencing another tenant's customer/property
  // (RFC §4.9's "another tenant's id" worked example, applied to Customer).
  describe('cross-tenant createBooking', () => {
    it("throws NotFound for another tenant's customerId/propertyId", async () => {
      const response = await gql(cookieB, CREATE_BOOKING_MUTATION, {
        input: {
          customerId: customerA.id,
          propertyId: propertyA.id,
          serviceId: bookableService.id,
          scheduledAt: '2030-02-01T09:00:00.000Z',
        },
      });
      expect(response.body.data?.createBooking).toBeUndefined();
      expect(errorStatus(response)).toBe(404);
      expect(response.body.errors?.[0]?.message).toContain(
        `Customer ${customerA.id} not found`,
      );
    });
  });

  // Item 7: receiveLaundryOrder referencing another tenant's customer.
  describe('cross-tenant receiveLaundryOrder', () => {
    it("throws NotFound for another tenant's customerId", async () => {
      const response = await gql(cookieB, RECEIVE_LAUNDRY_ORDER_MUTATION, {
        input: { customerId: customerA.id, fulfillmentType: 'DELIVERY' },
      });
      expect(response.body.data?.receiveLaundryOrder).toBeUndefined();
      expect(errorStatus(response)).toBe(404);
      expect(response.body.errors?.[0]?.message).toContain(
        `Customer ${customerA.id} not found`,
      );
    });
  });

  // Item 8: per-tenant email uniqueness — A's exact email is free for B to
  // reuse; within B, the same email in a different case still conflicts.
  describe('per-tenant email uniqueness', () => {
    it("lets tenant B reuse tenant A's exact email, then rejects a case-variant duplicate", async () => {
      const sameEmailResponse = await gql(cookieB, CREATE_CUSTOMER_MUTATION, {
        input: {
          email: customerA.email,
          fullName: 'Tenant B Same Email',
          phone: '555-0200',
        },
      });
      expect(sameEmailResponse.body.errors).toBeUndefined();
      expect(sameEmailResponse.body.data.createCustomer.email).toBe(
        customerA.email,
      );

      const duplicateResponse = await gql(cookieB, CREATE_CUSTOMER_MUTATION, {
        input: {
          email: customerA.email.toUpperCase(),
          fullName: 'Tenant B Duplicate Email',
          phone: '555-0201',
        },
      });
      expect(duplicateResponse.body.data?.createCustomer).toBeUndefined();
      expect(errorStatus(duplicateResponse)).toBe(409);
    });
  });

  // Item 9: tenant A reading its own nested `properties`, and the TENANT-
  // scoped audit trail for the create calls that produced them.
  describe('same-tenant read and audit', () => {
    it('reads its own property through the nested relation and records TENANT-scoped audit events', async () => {
      const createCustomerResponse = await gql(
        cookieA,
        CREATE_CUSTOMER_MUTATION,
        {
          input: {
            email: uniqueEmail('tenant-a-audit'),
            fullName: `Audit Customer A ${run}`,
            phone: '555-0300',
          },
        },
      );
      expect(createCustomerResponse.body.errors).toBeUndefined();
      const auditCustomerId: string =
        createCustomerResponse.body.data.createCustomer.id;

      const createPropertyResponse = await gql(
        cookieA,
        CREATE_PROPERTY_MUTATION,
        {
          customerId: auditCustomerId,
          input: {
            addressLine1: '1 Audit St',
            city: 'Audit City',
            label: 'Audit Home',
            postalCode: '00003',
            region: 'AU',
          },
        },
      );
      expect(createPropertyResponse.body.errors).toBeUndefined();
      const auditPropertyId: string =
        createPropertyResponse.body.data.createProperty.id;

      const readResponse = await gql(
        cookieA,
        `query Customer($id: ID!) {
          customer(id: $id) { id properties { nodes { id } } }
        }`,
        { id: auditCustomerId },
      );
      expect(readResponse.body.errors).toBeUndefined();
      expect(
        readResponse.body.data.customer.properties.nodes.map(
          (node: { id: string }) => node.id,
        ),
      ).toEqual([auditPropertyId]);

      const customerAudit = await auditEventRepository.findOneBy({
        action: 'customer.create',
        entityId: auditCustomerId,
      });
      expect(customerAudit?.scope).toBe(AdminScope.TENANT);
      expect(customerAudit?.tenantId).toBe(tenantA);

      const propertyAudit = await auditEventRepository.findOneBy({
        action: 'property.create',
        entityId: auditPropertyId,
      });
      expect(propertyAudit?.scope).toBe(AdminScope.TENANT);
      expect(propertyAudit?.tenantId).toBe(tenantA);
    });
  });

  // Item 10: Super Admin -> Forbidden on `customers` is already an exact
  // regression guard in `admin-foundation.e2e-spec.ts`
  // ("gives a Super Admin a PLATFORM principal but Forbidden on customers"),
  // asserting `customersResponse.body.errors?.[0]?.extensions?.code ===
  // 'FORBIDDEN'` against the exact `{ customers { nodes { id } } }` query
  // this brief item describes. Not duplicated here.

  // Item 11: batch lookups (service-level) — not exposed over GraphQL.
  describe('batch lookups (service-level)', () => {
    it('getCustomersByIds/getPropertiesByIds return only rows in the given tenant, [] for a null tenant', async () => {
      const customers = await customersService.getCustomersByIds(
        [customerA.id, customerB.id],
        tenantB,
      );
      expect(customers.map((customer) => customer.id)).toEqual([customerB.id]);

      const properties = await propertiesService.getPropertiesByIds(
        [propertyA.id, propertyB.id],
        tenantB,
      );
      expect(properties.map((property) => property.id)).toEqual([propertyB.id]);

      expect(
        await customersService.getCustomersByIds(
          [customerA.id, customerB.id],
          null,
        ),
      ).toEqual([]);
      expect(
        await propertiesService.getPropertiesByIds(
          [propertyA.id, propertyB.id],
          null,
        ),
      ).toEqual([]);
    });
  });
});
