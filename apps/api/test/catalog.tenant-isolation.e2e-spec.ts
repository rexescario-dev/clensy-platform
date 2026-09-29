import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { BookingsService } from '../src/modules/bookings/application/services/bookings.service';
import { AddOnsService } from '../src/modules/catalog/application/services/add-ons.service';
import { PricingRulesService } from '../src/modules/catalog/application/services/pricing-rules.service';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { PricingUnit } from '../src/modules/catalog/domain/pricing-unit';
import { CustomerEntity } from '../src/modules/customers/infrastructure/persistence/customer.entity';
import { PropertyEntity } from '../src/modules/customers/infrastructure/persistence/property.entity';
import { LaundryFulfillmentType } from '../src/modules/laundry/domain/laundry-fulfillment-type';
import { LaundryOrdersService } from '../src/modules/laundry/application/services/laundry-orders.service';
import { LaundryOrderEntity } from '../src/modules/laundry/infrastructure/persistence/laundry-order.entity';
import { LaundryOrderLineEntity } from '../src/modules/laundry/infrastructure/persistence/laundry-order-line.entity';
import { InvoiceEntity } from '../src/modules/billing/infrastructure/persistence/invoice.entity';
import { InvoiceLineEntity } from '../src/modules/billing/infrastructure/persistence/invoice-line.entity';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { AdminScope } from '../src/platform/auth/domain/admin-scope';
import { Role } from '../src/platform/auth/domain/role';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import {
  createTestTenant,
  removeTestTenants,
  seedTenantAdmin,
} from './helpers/seed-tenant-admin';
import { uniqueEmail } from './helpers/unique-email';

// Two-tenant isolation through the real GraphQL + application-service stack
// for the whole Catalog (Service/AddOn/PricingRule) slice, plus the
// cross-module propagation into Bookings, Laundry and Billing (#84).
// Self-contained: two fresh test tenants, unique-per-run rows, and every
// assertion is scoped to the ids this suite created — safe against the
// shared, non-truncated e2e database and jest's single-worker `maxWorkers:
// 1` (`test/jest-e2e.json`), which serializes spec files so no other file's
// TRUNCATE can interleave with this one.
describe('Catalog tenant isolation (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let servicesService: ServicesService;
  let addOnsService: AddOnsService;
  let pricingRulesService: PricingRulesService;
  let bookingsService: BookingsService;
  let laundryOrdersService: LaundryOrdersService;
  let auditEventRepository: Repository<AuditEventEntity>;

  const run = randomUUID();
  let tenantA: string;
  let tenantB: string;
  let cookieA: string;
  let cookieB: string;
  let ownerAId: string;
  let ownerBId: string;
  let serviceA: { id: string; name: string };
  let addOnA: { id: string; name: string };
  let ruleA: { id: string };
  let addOnRuleA: { id: string };
  let serviceB: { id: string; name: string };
  let addOnB: { id: string; name: string };
  let ruleB: { id: string };
  let customerA: CustomerEntity;
  let customerB: CustomerEntity;
  let propertyA: PropertyEntity;
  let propertyB: PropertyEntity;
  let bookingA: { id: string };
  let bookingBId: string | undefined; // created inside Case 7's positive control
  let laundryOrderAId: string; // A, priced (serviceA + addOnA) — invoice case
  let laundryOrderBId: string; // B, WEIGHED — cross-tenant price case
  let invoiceAId: string | undefined;

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

  // NestJS's default GraphQL exception formatting puts the HTTP status at
  // `extensions.status` for statuses with no dedicated Apollo error code
  // (404 NotFoundException, 409 ConflictException — confirmed against this
  // suite's own 404/409 cases). A status WITH a dedicated Apollo code (400
  // BadRequestException -> `code: 'BAD_REQUEST'`) omits the top-level
  // `.status` and only carries it nested under `extensions.originalError.
  // statusCode` — verified directly against this app's real GraphQL error
  // responses (`{i:{orderId,baseServiceId,addOns:[]}}` against
  // `priceLaundryOrder`, `{id,i:{name}}` against `updateService`). Reading
  // both keeps one assertion helper correct for every status this suite
  // checks (400/404/409) without depending on which of the two shapes a
  // given exception type happens to produce.
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

  async function insertCustomerAndProperty(
    tenantId: string,
    label: string,
  ): Promise<{ customer: CustomerEntity; property: PropertyEntity }> {
    const customerRepository = dataSource.getRepository(CustomerEntity);
    const customer = await customerRepository.save(
      customerRepository.create({
        tenantId,
        email: uniqueEmail(`catalog-isolation-${label.toLowerCase()}`),
        fullName: `Customer ${label} ${run}`,
        notes: null,
        phone: '555-0100',
      }),
    );
    const propertyRepository = dataSource.getRepository(PropertyEntity);
    const property = await propertyRepository.save(
      propertyRepository.create({
        customerId: customer.id,
        tenantId,
        accessNotes: null,
        addressLine1: `1 ${label} Street`,
        addressLine2: null,
        city: `${label} City`,
        label: `Home ${label} ${run}`,
        postalCode: '00001',
        region: 'XX',
      }),
    );
    return { customer, property };
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
    servicesService = moduleFixture.get(ServicesService);
    addOnsService = moduleFixture.get(AddOnsService);
    pricingRulesService = moduleFixture.get(PricingRulesService);
    bookingsService = moduleFixture.get(BookingsService);
    laundryOrdersService = moduleFixture.get(LaundryOrdersService);
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
    ownerAId = ownerA.id;
    ownerBId = ownerB.id;
    cookieA = await loginAs(ownerA.email, ownerA.password);
    cookieB = await loginAs(ownerB.email, ownerB.password);

    // Catalog fixtures, via the application services (not GraphQL) — mirrors
    // `teams-cleaners.tenant-isolation.e2e-spec.ts`'s own setup shape.
    serviceA = await servicesService.createService({
      actorId: ownerAId,
      tenantId: tenantA,
      durationMinutes: 45,
      name: `Deep ${run}`,
    });
    ruleA = await pricingRulesService.createPricingRule({
      actorId: ownerAId,
      serviceId: serviceA.id,
      tenantId: tenantA,
      priceMinorUnits: 5000,
      unit: PricingUnit.PER_SERVICE,
    });
    addOnA = await addOnsService.createAddOn({
      actorId: ownerAId,
      tenantId: tenantA,
      name: `Fridge ${run}`,
      priceMinorUnits: 700,
    });
    addOnRuleA = await pricingRulesService.createPricingRule({
      actorId: ownerAId,
      addOnId: addOnA.id,
      tenantId: tenantA,
      priceMinorUnits: 700,
      unit: PricingUnit.FLAT,
    });

    serviceB = await servicesService.createService({
      actorId: ownerBId,
      tenantId: tenantB,
      durationMinutes: 30,
      name: `Bravo Deep ${run}`,
    });
    ruleB = await pricingRulesService.createPricingRule({
      actorId: ownerBId,
      serviceId: serviceB.id,
      tenantId: tenantB,
      priceMinorUnits: 4000,
      unit: PricingUnit.PER_SERVICE,
    });
    addOnB = await addOnsService.createAddOn({
      actorId: ownerBId,
      tenantId: tenantB,
      name: `Bravo Fridge ${run}`,
      priceMinorUnits: 600,
    });
    await pricingRulesService.createPricingRule({
      actorId: ownerBId,
      addOnId: addOnB.id,
      tenantId: tenantB,
      priceMinorUnits: 600,
      unit: PricingUnit.FLAT,
    });

    ({ customer: customerA, property: propertyA } =
      await insertCustomerAndProperty(tenantA, 'A'));
    ({ customer: customerB, property: propertyB } =
      await insertCustomerAndProperty(tenantB, 'B'));

    // A booking, as A, via `BookingsService.create` — fixture setup
    // convenience, mirroring the catalog fixtures above (also application
    // services, not GraphQL mutations). Booking is tenant-owned as of #85;
    // Laundry/Billing are not yet (#87).
    bookingA = await bookingsService.create({
      actorId: ownerAId,
      customerId: customerA.id,
      propertyId: propertyA.id,
      serviceId: serviceA.id,
      tenantId: tenantA,
      scheduledAt: new Date('2030-01-01T09:00:00Z'),
    });

    // A's priced laundry order (serviceA + addOnA) — the positive path and
    // the cross-tenant `generateInvoiceFromOrder` target (Case 7).
    const receivedA = await laundryOrdersService.receive({
      actorId: ownerAId,
      customerId: customerA.id,
      tenantId: tenantA,
      fulfillmentType: LaundryFulfillmentType.PICKUP,
    });
    await laundryOrdersService.weigh({
      actorId: ownerAId,
      orderId: receivedA.id,
      weightGrams: 1000,
    });
    const pricedA = await laundryOrdersService.price({
      actorId: ownerAId,
      baseServiceId: serviceA.id,
      orderId: receivedA.id,
      tenantId: tenantA,
      addOns: [{ addOnId: addOnA.id }],
    });
    laundryOrderAId = pricedA.id;

    // B's WEIGHED (not yet priced) laundry order — the cross-tenant
    // `priceLaundryOrder` target (Case 7); left WEIGHED so the case's two
    // failing `priceLaundryOrder` attempts don't advance its status.
    const receivedB = await laundryOrdersService.receive({
      actorId: ownerBId,
      customerId: customerB.id,
      tenantId: tenantB,
      fulfillmentType: LaundryFulfillmentType.PICKUP,
    });
    await laundryOrdersService.weigh({
      actorId: ownerBId,
      orderId: receivedB.id,
      weightGrams: 1000,
    });
    laundryOrderBId = receivedB.id;
  });

  afterAll(async () => {
    try {
      if (dataSource) {
        if (invoiceAId) {
          await dataSource
            .getRepository(InvoiceLineEntity)
            .delete({ invoiceId: invoiceAId });
          await dataSource
            .getRepository(InvoiceEntity)
            .delete({ id: invoiceAId });
        }
        if (laundryOrderAId) {
          await dataSource
            .getRepository(LaundryOrderLineEntity)
            .delete({ laundryOrderId: laundryOrderAId });
          await dataSource
            .getRepository(LaundryOrderEntity)
            .delete({ id: laundryOrderAId });
        }
        if (laundryOrderBId) {
          await dataSource
            .getRepository(LaundryOrderLineEntity)
            .delete({ laundryOrderId: laundryOrderBId });
          await dataSource
            .getRepository(LaundryOrderEntity)
            .delete({ id: laundryOrderBId });
        }
        // `bookingA`/`bookingBId` are owned by tenantA/tenantB (#85), so
        // `removeTestTenants` below deletes them (before the
        // pricing-rule/service rows they reference, FK order) — this suite
        // no longer deletes them by hand. Any extra service/add-on/
        // pricing-rule rows this suite's tests create (uniqueness cases,
        // audit case) live under tenantA/tenantB and are removed by
        // `removeTestTenants` too.
        await removeTestTenants(dataSource, [tenantA, tenantB]);
      }
    } finally {
      await app?.close();
    }
  });

  const SERVICES_QUERY = `
    query Services($filter: ServiceFilter) {
      services(filter: $filter, paging: { limit: 50 }) {
        totalCount
        nodes { id }
      }
    }
  `;

  const ADD_ONS_QUERY = `
    query AddOns($filter: AddOnFilter) {
      addOns(filter: $filter, paging: { limit: 50 }) {
        totalCount
        nodes { id }
      }
    }
  `;

  interface Page {
    totalCount: number;
    nodes: { id: string }[];
  }

  async function servicesAs(
    cookie: string,
    filter: Record<string, unknown> = {},
  ): Promise<Page> {
    const response = await gql(cookie, SERVICES_QUERY, { filter });
    expect(response.body.errors).toBeUndefined();
    return (response.body as { data: { services: Page } }).data.services;
  }

  async function addOnsAs(
    cookie: string,
    filter: Record<string, unknown> = {},
  ): Promise<Page> {
    const response = await gql(cookie, ADD_ONS_QUERY, { filter });
    expect(response.body.errors).toBeUndefined();
    return (response.body as { data: { addOns: Page } }).data.addOns;
  }

  const ids = (page: Page) => page.nodes.map((node) => node.id);

  // Case 1: list/count scoped to the caller's tenant.
  it("scopes the services/addOns lists and counts to the caller's tenant", async () => {
    const services = await servicesAs(cookieB);
    expect(ids(services)).toContain(serviceB.id);
    expect(ids(services)).not.toContain(serviceA.id);
    expect(services.totalCount).toBe(services.nodes.length);

    const addOns = await addOnsAs(cookieB);
    expect(ids(addOns)).toContain(addOnB.id);
    expect(ids(addOns)).not.toContain(addOnA.id);
    expect(addOns.totalCount).toBe(addOns.nodes.length);
  });

  // Case 2 (Review Focus 3): a client filter can only narrow, never widen,
  // across the tenant boundary.
  it("returns empty for a filter naming another tenant's service/add-on", async () => {
    const byId = await servicesAs(cookieB, { id: { eq: serviceA.id } });
    expect(byId).toEqual({ totalCount: 0, nodes: [] });

    const byName = await servicesAs(cookieB, {
      name: { eq: serviceA.name },
    });
    expect(byName).toEqual({ totalCount: 0, nodes: [] });

    const addOnByName = await addOnsAs(cookieB, {
      name: { eq: addOnA.name },
    });
    expect(addOnByName).toEqual({ totalCount: 0, nodes: [] });
  });

  // Case 3: get-by-id / active pricing look exactly like a missing row.
  it("returns null for service(id) and 404 for activePricing(serviceId) of another tenant's service", async () => {
    const serviceResponse = await gql(
      cookieB,
      `query Service($id: ID!) { service(id: $id) { id } }`,
      { id: serviceA.id },
    );
    expect(serviceResponse.body.errors).toBeUndefined();
    expect(serviceResponse.body.data.service).toBeNull();

    const ACTIVE_PRICING = `
      query ActivePricing($serviceId: ID!) {
        activePricing(serviceId: $serviceId) { id priceMinorUnits }
      }
    `;
    const asB = await gql(cookieB, ACTIVE_PRICING, { serviceId: serviceA.id });
    expect(asB.body.errors).toBeDefined();
    expect(errorStatus(asB)).toBe(404);

    const asA = await gql(cookieA, ACTIVE_PRICING, { serviceId: serviceA.id });
    expect(asA.body.errors).toBeUndefined();
    expect(asA.body.data.activePricing).toEqual({
      id: ruleA.id,
      priceMinorUnits: 5000,
    });
  });

  // Case 4 (Review Focus 4): the `ActivePricingLoader` is tenant-scoped —
  // both the batched `Service.activePricing` relation path and the
  // single-key `service(id)` path.
  describe('activePricing loader tenant scoping', () => {
    const SERVICES_WITH_PRICING = `
      query ServicesWithPricing($ids: [ID!]) {
        services(filter: { id: { in: $ids } }, paging: { limit: 50 }) {
          nodes { id activePricing { id priceMinorUnits } }
        }
      }
    `;

    it("A sees its own service's active pricing via the batched relation", async () => {
      const response = await gql(cookieA, SERVICES_WITH_PRICING, {
        ids: [serviceA.id],
      });
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.services.nodes).toEqual([
        {
          id: serviceA.id,
          activePricing: { id: ruleA.id, priceMinorUnits: 5000 },
        },
      ]);
    });

    it("B cannot even name A's service through the (tenant-filtered) root list", async () => {
      const response = await gql(cookieB, SERVICES_WITH_PRICING, {
        ids: [serviceA.id],
      });
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.services.nodes).toEqual([]);
    });

    it("B's own service(id) resolves B's own active pricing", async () => {
      const response = await gql(
        cookieB,
        `query Service($id: ID!) { service(id: $id) { activePricing { id } } }`,
        { id: serviceB.id },
      );
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.service.activePricing).toEqual({
        id: ruleB.id,
      });
    });
  });

  // Case 5 (#85: the Booking root is now tenant-scoped): B cannot see A's
  // booking row at all — not merely a relation-level error on an
  // otherwise-visible row. A's own query is the positive control proving
  // the fixture and query shape are otherwise correct.
  it("B cannot see A's booking", async () => {
    const query = `query Bookings($id: ID!) {
      bookings(filter: { id: { eq: $id } }) {
        totalCount
        nodes { id service { id } }
      }
    }`;

    const asB = await gql(cookieB, query, { id: bookingA.id });
    expect(asB.body.errors).toBeUndefined();
    expect(asB.body.data.bookings.nodes).toEqual([]);
    expect(asB.body.data.bookings.totalCount).toBe(0);
    expect(JSON.stringify(asB.body)).not.toContain(serviceA.id);

    const asA = await gql(cookieA, query, { id: bookingA.id });
    expect(asA.body.errors).toBeUndefined();
    expect(asA.body.data.bookings.nodes).toEqual([
      { id: bookingA.id, service: { id: serviceA.id } },
    ]);
    expect(asA.body.data.bookings.totalCount).toBe(1);
  });

  // Case 6 (Review Focus 2): cross-tenant catalog writes are 404, not 403,
  // and change nothing.
  describe('cross-tenant catalog writes', () => {
    it('updateService/updateAddOn/createPricingRule against another tenant are 404 and change nothing', async () => {
      const updateServiceRes = await gql(
        cookieB,
        `mutation($id: ID!, $i: UpdateServiceInput!){ updateService(id:$id, input:$i){ id } }`,
        { id: serviceA.id, i: { name: 'X' } },
      );
      expect(errorStatus(updateServiceRes)).toBe(404);

      const updateAddOnRes = await gql(
        cookieB,
        `mutation($id: ID!, $i: UpdateAddOnInput!){ updateAddOn(id:$id, input:$i){ id } }`,
        { id: addOnA.id, i: { name: 'X' } },
      );
      expect(errorStatus(updateAddOnRes)).toBe(404);

      const createRuleForServiceRes = await gql(
        cookieB,
        `mutation($i: CreatePricingRuleInput!){ createPricingRule(input:$i){ id } }`,
        { i: { serviceId: serviceA.id, priceMinorUnits: 1 } },
      );
      expect(errorStatus(createRuleForServiceRes)).toBe(404);

      const createRuleForAddOnRes = await gql(
        cookieB,
        `mutation($i: CreatePricingRuleInput!){ createPricingRule(input:$i){ id } }`,
        { i: { addOnId: addOnA.id, priceMinorUnits: 1 } },
      );
      expect(errorStatus(createRuleForAddOnRes)).toBe(404);

      // As A: nothing changed.
      const stillServiceA = await gql(
        cookieA,
        `query($id: ID!){ service(id:$id){ id name } }`,
        { id: serviceA.id },
      );
      expect(stillServiceA.body.errors).toBeUndefined();
      expect(stillServiceA.body.data.service).toEqual({
        id: serviceA.id,
        name: serviceA.name,
      });

      // Selects `name`, not just `id` — proving `updateAddOn` didn't apply
      // its `name: 'X'` change, not merely that the row still exists.
      const stillAddOnARes = await gql(
        cookieA,
        `query($filter: AddOnFilter){ addOns(filter:$filter, paging:{limit:50}){ nodes { id name } } }`,
        { filter: { id: { eq: addOnA.id } } },
      );
      expect(stillAddOnARes.body.errors).toBeUndefined();
      expect(stillAddOnARes.body.data.addOns.nodes).toEqual([
        { id: addOnA.id, name: addOnA.name },
      ]);

      const stillActivePricing = await gql(
        cookieA,
        `query($id: ID!){ activePricing(serviceId:$id){ id } }`,
        { id: serviceA.id },
      );
      expect(stillActivePricing.body.errors).toBeUndefined();
      expect(stillActivePricing.body.data.activePricing).toEqual({
        id: ruleA.id,
      });

      const openRule = await dataSource.query(
        `SELECT "id" FROM "pricing_rule_entity" WHERE "serviceId" = $1 AND "effectiveTo" IS NULL`,
        [serviceA.id],
      );
      expect(openRule).toEqual([{ id: ruleA.id }]);

      const openAddOnRule = await dataSource.query(
        `SELECT "id" FROM "pricing_rule_entity" WHERE "addOnId" = $1 AND "effectiveTo" IS NULL`,
        [addOnA.id],
      );
      expect(openAddOnRule).toEqual([{ id: addOnRuleA.id }]);
    });
  });

  // Case 7: cross-module catalog lookups (Bookings, Laundry, Billing) are
  // tenant-scoped too — a foreign id is indistinguishable from a missing one.
  describe('cross-module catalog lookups', () => {
    it("createBooking with B's own customer/property but serviceA.id is 404 (not vacuous — proven by a same-shape success with serviceB)", async () => {
      const crossTenantRes = await gql(
        cookieB,
        `mutation($i: CreateBookingInput!){ createBooking(createBookingInput:$i){ id } }`,
        {
          i: {
            customerId: customerB.id,
            propertyId: propertyB.id,
            serviceId: serviceA.id,
            scheduledAt: '2030-02-01T09:00:00.000Z',
          },
        },
      );
      expect(errorStatus(crossTenantRes)).toBe(404);
      // Ties the 404 to the service lookup specifically — Customer/Property
      // lookups also 404, so the status code alone would be vacuous here.
      expect(crossTenantRes.body.errors[0].message).toBe(
        `Service ${serviceA.id} not found`,
      );

      // Positive control: the exact same shape of request, but with B's own
      // service, succeeds — proving the 404 above is caused by the foreign
      // `serviceId`, not by some unrelated problem with B's customer/property.
      const positiveRes = await gql(
        cookieB,
        `mutation($i: CreateBookingInput!){ createBooking(createBookingInput:$i){ id } }`,
        {
          i: {
            customerId: customerB.id,
            propertyId: propertyB.id,
            serviceId: serviceB.id,
            scheduledAt: '2030-02-02T09:00:00.000Z',
          },
        },
      );
      expect(positiveRes.body.errors).toBeUndefined();
      bookingBId = positiveRes.body.data.createBooking.id;
      expect(bookingBId).toBeTruthy();
    });

    it("priceLaundryOrder on B's weighed order with baseServiceId: serviceA.id is 400 (no effective price)", async () => {
      const response = await gql(
        cookieB,
        `mutation($i: PriceLaundryOrderInput!){ priceLaundryOrder(input:$i){ id } }`,
        {
          i: {
            orderId: laundryOrderBId,
            baseServiceId: serviceA.id,
            addOns: [],
          },
        },
      );
      expect(response.body.errors).toBeDefined();
      expect(errorStatus(response)).toBe(400);
      expect(response.body.errors[0].message).toContain(
        `No effective price for serviceId ${serviceA.id}`,
      );
    });

    it("priceLaundryOrder on B's weighed order with an add-on from A is 400 (no effective price)", async () => {
      const response = await gql(
        cookieB,
        `mutation($i: PriceLaundryOrderInput!){ priceLaundryOrder(input:$i){ id } }`,
        {
          i: {
            orderId: laundryOrderBId,
            baseServiceId: serviceB.id,
            addOns: [{ addOnId: addOnA.id }],
          },
        },
      );
      expect(response.body.errors).toBeDefined();
      expect(errorStatus(response)).toBe(400);
      expect(response.body.errors[0].message).toContain(
        `No effective price for addOnId ${addOnA.id}`,
      );
    });

    const GENERATE = `mutation($i: GenerateInvoiceFromOrderInput!){
      generateInvoiceFromOrder(input:$i){ id }
    }`;

    it("generateInvoiceFromOrder on A's priced order is 400 for B, and succeeds for A", async () => {
      const asB = await gql(cookieB, GENERATE, {
        i: { laundryOrderId: laundryOrderAId, paymentTerms: 'PAY_NOW' },
      });
      expect(asB.body.errors).toBeDefined();
      expect(errorStatus(asB)).toBe(400);
      // Anchored to `^Service` — the add-on variant of this same message
      // ("Add-on ... could not be resolved") would also match a bare
      // `/could not be resolved/`.
      expect(asB.body.errors[0].message).toMatch(
        /^Service .* could not be resolved/,
      );

      const asA = await gql(cookieA, GENERATE, {
        i: { laundryOrderId: laundryOrderAId, paymentTerms: 'PAY_NOW' },
      });
      expect(asA.body.errors).toBeUndefined();
      invoiceAId = asA.body.data.generateInvoiceFromOrder.id;
      expect(invoiceAId).toBeTruthy();
    });
  });

  // Case 8 (Review Focus 1): uniqueness is per tenant and case-insensitive
  // within a tenant.
  describe('per-tenant uniqueness', () => {
    const CREATE_SERVICE = `
      mutation($i: CreateServiceInput!){ createService(input:$i){ id name } }
    `;
    const CREATE_ADD_ON = `
      mutation($i: CreateAddOnInput!){ createAddOn(input:$i){ id name } }
    `;

    it('allows the same service name in two tenants, rejects a case-insensitive dup within one', async () => {
      const name = `Shared ${run}`;
      const lower = `shared ${run}`;
      const upper = `SHARED ${run}`;

      const inA = await gql(cookieA, CREATE_SERVICE, {
        i: { name, durationMinutes: 10 },
      });
      expect(inA.body.errors).toBeUndefined();

      const inB = await gql(cookieB, CREATE_SERVICE, {
        i: { name: lower, durationMinutes: 10 },
      });
      expect(inB.body.errors).toBeUndefined();

      const dupInA = await gql(cookieA, CREATE_SERVICE, {
        i: { name: upper, durationMinutes: 10 },
      });
      expect(dupInA.body.errors).toBeDefined();
      expect(errorStatus(dupInA)).toBe(409);
      expect(dupInA.body.errors[0].message).toBe(
        'Service name is already in use',
      );

      const updateToShared = await gql(
        cookieA,
        `mutation($id: ID!, $i: UpdateServiceInput!){ updateService(id:$id, input:$i){ id } }`,
        { id: serviceA.id, i: { name: lower } },
      );
      expect(updateToShared.body.errors).toBeDefined();
      expect(errorStatus(updateToShared)).toBe(409);
      expect(updateToShared.body.errors[0].message).toBe(
        'Service name is already in use',
      );
      // The extra service this test created in A (and B) beyond
      // `serviceA`/`serviceB` is removed by `removeTestTenants` in
      // `afterAll` — no separate cleanup needed here.
    });

    it('allows the same add-on name in two tenants, rejects a case-insensitive dup within one', async () => {
      const name = `Shared AddOn ${run}`;
      const lower = `shared addon ${run}`;

      const inA = await gql(cookieA, CREATE_ADD_ON, {
        i: { name, priceMinorUnits: 100 },
      });
      expect(inA.body.errors).toBeUndefined();

      const inB = await gql(cookieB, CREATE_ADD_ON, {
        i: { name: lower, priceMinorUnits: 100 },
      });
      expect(inB.body.errors).toBeUndefined();

      const dupInA = await gql(cookieA, CREATE_ADD_ON, {
        i: { name: lower, priceMinorUnits: 100 },
      });
      expect(dupInA.body.errors).toBeDefined();
      expect(errorStatus(dupInA)).toBe(409);
      expect(dupInA.body.errors[0].message).toBe(
        'Add-on name is already in use',
      );
    });
  });

  // Case 9: TENANT-scoped audit for the five catalog mutations.
  it("records catalog audit events with the caller's tenant and TENANT scope", async () => {
    const createService = await gql(
      cookieA,
      `mutation($i: CreateServiceInput!){ createService(input:$i){ id } }`,
      { i: { name: `Audit Service ${run}`, durationMinutes: 15 } },
    );
    expect(createService.body.errors).toBeUndefined();
    const auditServiceId: string = createService.body.data.createService.id;

    const updateService = await gql(
      cookieA,
      `mutation($id: ID!, $i: UpdateServiceInput!){ updateService(id:$id, input:$i){ id } }`,
      { id: auditServiceId, i: { durationMinutes: 20 } },
    );
    expect(updateService.body.errors).toBeUndefined();

    const createAddOn = await gql(
      cookieA,
      `mutation($i: CreateAddOnInput!){ createAddOn(input:$i){ id } }`,
      { i: { name: `Audit AddOn ${run}`, priceMinorUnits: 250 } },
    );
    expect(createAddOn.body.errors).toBeUndefined();
    const auditAddOnId: string = createAddOn.body.data.createAddOn.id;

    const updateAddOn = await gql(
      cookieA,
      `mutation($id: ID!, $i: UpdateAddOnInput!){ updateAddOn(id:$id, input:$i){ id } }`,
      { id: auditAddOnId, i: { priceMinorUnits: 260 } },
    );
    expect(updateAddOn.body.errors).toBeUndefined();

    const createPricingRule = await gql(
      cookieA,
      `mutation($i: CreatePricingRuleInput!){ createPricingRule(input:$i){ id } }`,
      { i: { serviceId: auditServiceId, priceMinorUnits: 1234 } },
    );
    expect(createPricingRule.body.errors).toBeUndefined();
    const auditRuleId: string =
      createPricingRule.body.data.createPricingRule.id;

    for (const [action, entityId] of [
      ['service.create', auditServiceId],
      ['service.update', auditServiceId],
      ['add_on.create', auditAddOnId],
      ['add_on.update', auditAddOnId],
      ['pricing_rule.create', auditRuleId],
    ] as const) {
      const event = await auditEventRepository.findOneBy({
        action,
        entityId,
      });
      expect({
        action,
        tenantId: event?.tenantId,
        scope: event?.scope,
      }).toEqual({ action, tenantId: tenantA, scope: AdminScope.TENANT });
    }
  });

  // Case 10: the database backstop rejects a cross-tenant pricing-rule ->
  // service/add-on reference even when the application layer is bypassed.
  // A closed, already-lapsed interval (`effectiveTo` one day ago,
  // `effectiveFrom` two days ago, `active: false`) so the open/active
  // partial unique indexes cannot fire first and mask the FK violation.
  it('rejects cross-tenant pricing_rule -> service/add_on references at the database', async () => {
    await expect(
      dataSource.query(
        `INSERT INTO "pricing_rule_entity" ("serviceId", "priceMinorUnits", "active", "effectiveFrom", "effectiveTo", "tenantId") VALUES ($1, 1, false, now() - interval '2 days', now() - interval '1 day', $2)`,
        [serviceA.id, tenantB],
      ),
    ).rejects.toMatchObject({
      driverError: { constraint: 'fk_pricing_rule_service_tenant' },
    });

    await expect(
      dataSource.query(
        `INSERT INTO "pricing_rule_entity" ("addOnId", "priceMinorUnits", "active", "effectiveFrom", "effectiveTo", "tenantId") VALUES ($1, 1, false, now() - interval '2 days', now() - interval '1 day', $2)`,
        [addOnA.id, tenantB],
      ),
    ).rejects.toMatchObject({
      driverError: { constraint: 'fk_pricing_rule_add_on_tenant' },
    });
  });

  // Case 11 (Slice decision 8): the PricingRule GraphQL surface inventory —
  // exactly `activePricing` (Query) and `Service.activePricing` reach it,
  // no `pricingRules` query, no PricingRule connection type.
  it('pins the PricingRule GraphQL surface to exactly the two intended paths', async () => {
    interface IntrospectedType {
      name: string | null;
      ofType: IntrospectedType | null;
    }
    interface IntrospectedField {
      name: string;
      type: IntrospectedType;
    }
    function unwrap(type: IntrospectedType): IntrospectedType {
      return type.ofType ? unwrap(type.ofType) : type;
    }

    const queryFieldsRes = await gql(
      cookieA,
      `{ __schema { queryType { fields {
        name
        type { name ofType { name ofType { name ofType { name ofType { name } } } } }
      } } } }`,
    );
    expect(queryFieldsRes.body.errors).toBeUndefined();
    const queryFields: IntrospectedField[] =
      queryFieldsRes.body.data.__schema.queryType.fields;
    const pricingRuleQueryFields = queryFields.filter(
      (f) => unwrap(f.type).name === 'PricingRule',
    );
    expect(pricingRuleQueryFields.map((f) => f.name)).toEqual([
      'activePricing',
    ]);
    expect(queryFields.some((f) => f.name === 'pricingRules')).toBe(false);

    const serviceTypeRes = await gql(
      cookieA,
      `{ __type(name: "Service") { fields {
        name
        type { name ofType { name ofType { name ofType { name ofType { name } } } } }
      } } }`,
    );
    expect(serviceTypeRes.body.errors).toBeUndefined();
    const serviceFields: IntrospectedField[] =
      serviceTypeRes.body.data.__type.fields;
    const pricingRuleServiceFields = serviceFields.filter(
      (f) => unwrap(f.type).name === 'PricingRule',
    );
    expect(pricingRuleServiceFields.map((f) => f.name)).toEqual([
      'activePricing',
    ]);

    for (const typeName of [
      'PricingRuleConnection',
      'PricingRuleOffsetConnection',
    ]) {
      const typeRes = await gql(
        cookieA,
        `query($name: String!){ __type(name: $name) { name } }`,
        { name: typeName },
      );
      expect(typeRes.body.errors).toBeUndefined();
      expect(typeRes.body.data.__type).toBeNull();
    }
  });
});
