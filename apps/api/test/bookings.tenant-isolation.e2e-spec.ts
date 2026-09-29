import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, In, Repository } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { BookingsService } from '../src/modules/bookings/application/services/bookings.service';
import { BookingStatus } from '../src/modules/bookings/domain/booking-status';
import { BookingEntity } from '../src/modules/bookings/infrastructure/persistence/booking.entity';
import { PricingRulesService } from '../src/modules/catalog/application/services/pricing-rules.service';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { PricingUnit } from '../src/modules/catalog/domain/pricing-unit';
import { TeamsService } from '../src/modules/cleaners/application/services/teams.service';
import { CustomerEntity } from '../src/modules/customers/infrastructure/persistence/customer.entity';
import { PropertyEntity } from '../src/modules/customers/infrastructure/persistence/property.entity';
import { CleaningJobEntity } from '../src/modules/jobs/infrastructure/persistence/cleaning-job.entity';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { Role } from '../src/platform/auth/domain/role';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import {
  createTestTenant,
  removeTestTenants,
  seedSuperAdmin,
  seedTenantAdmin,
} from './helpers/seed-tenant-admin';
import { uniqueEmail } from './helpers/unique-email';

// Two-tenant isolation through the real GraphQL + REST + application-service
// stack for the Bookings slice (#85). Proves I-1 (a booking's tenantId is
// authoritative for every related FK — application half via cross-tenant
// create/update, database half via the composite `fk_booking_*_tenant`
// constraints) and I-2 (the only tenant source is the authenticated
// principal — never a GraphQL input/filter, REST body/param/query, or a
// spoofed header) end to end. Mirrors
// `catalog.tenant-isolation.e2e-spec.ts`'s shape and helpers.
//
// Self-contained: two fresh test tenants, unique-per-run rows, and every
// assertion is scoped to the ids this suite created — safe against the
// shared, non-truncated e2e database and jest's single-worker `maxWorkers:
// 1` (`test/jest-e2e.json`), which serializes spec files so no other
// file's TRUNCATE can interleave with this one. Cases are numbered as in
// the plan's Task 8 brief and run in that order because several later
// cases depend on state left unchanged by earlier ones (e.g. Case 9's "no
// job row yet" check must run before Case 10 creates one).
describe('Bookings tenant isolation (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let bookingsService: BookingsService;
  let servicesService: ServicesService;
  let pricingRulesService: PricingRulesService;
  let teamsService: TeamsService;
  let auditEventRepository: Repository<AuditEventEntity>;
  let bookingRepository: Repository<BookingEntity>;
  let cleaningJobRepository: Repository<CleaningJobEntity>;

  const run = randomUUID();
  let tenantA: string;
  let tenantB: string;
  let cookieA: string;
  let cookieB: string;
  let cookieFinanceA: string;
  let cookieSuperAdmin: string;
  let ownerAId: string;
  let ownerBId: string;
  let financeAId: string;
  let serviceA: { id: string; name: string };
  let serviceB: { id: string; name: string };
  let teamA: { id: string; name: string };
  let teamB: { id: string; name: string };
  let customerA: CustomerEntity;
  let customerB: CustomerEntity;
  let propertyA: PropertyEntity;
  let propertyB: PropertyEntity;
  let bookingA: { id: string };
  let bookingB: { id: string };

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

  // See `catalog.tenant-isolation.e2e-spec.ts`'s identical helper for the
  // full rationale on reading both extension shapes.
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
        email: uniqueEmail(`booking-isolation-${label.toLowerCase()}`),
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

  function baselineCreateInputForB(
    overrides: Partial<{
      customerId: string;
      propertyId: string;
      serviceId: string;
      teamId: string;
    }> = {},
  ) {
    return {
      customerId: customerB.id,
      propertyId: propertyB.id,
      serviceId: serviceB.id,
      teamId: teamB.id,
      scheduledAt: '2031-01-01T09:00:00.000Z',
      ...overrides,
    };
  }

  function bookingCountForTenant(tenantId: string): Promise<number> {
    return bookingRepository.count({ where: { tenantId } });
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
    bookingsService = moduleFixture.get(BookingsService);
    servicesService = moduleFixture.get(ServicesService);
    pricingRulesService = moduleFixture.get(PricingRulesService);
    teamsService = moduleFixture.get(TeamsService);
    auditEventRepository = moduleFixture.get(
      getRepositoryToken(AuditEventEntity),
    );
    bookingRepository = moduleFixture.get(getRepositoryToken(BookingEntity));
    cleaningJobRepository = moduleFixture.get(
      getRepositoryToken(CleaningJobEntity),
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
    const financeA = await seedTenantAdmin(dataSource, Role.FINANCE, tenantA);
    const superAdmin = await seedSuperAdmin(dataSource);
    ownerAId = ownerA.id;
    ownerBId = ownerB.id;
    financeAId = financeA.id;
    cookieA = await loginAs(ownerA.email, ownerA.password);
    cookieB = await loginAs(ownerB.email, ownerB.password);
    cookieFinanceA = await loginAs(financeA.email, financeA.password);
    cookieSuperAdmin = await loginAs(superAdmin.email, superAdmin.password);

    // Catalog/Teams fixtures, via the application services (not GraphQL) —
    // mirrors `catalog.tenant-isolation.e2e-spec.ts`'s own setup shape.
    serviceA = await servicesService.createService({
      actorId: ownerAId,
      tenantId: tenantA,
      durationMinutes: 45,
      name: `Booking Deep A ${run}`,
    });
    await pricingRulesService.createPricingRule({
      actorId: ownerAId,
      serviceId: serviceA.id,
      tenantId: tenantA,
      priceMinorUnits: 5000,
      unit: PricingUnit.PER_SERVICE,
    });
    serviceB = await servicesService.createService({
      actorId: ownerBId,
      tenantId: tenantB,
      durationMinutes: 30,
      name: `Booking Deep B ${run}`,
    });
    await pricingRulesService.createPricingRule({
      actorId: ownerBId,
      serviceId: serviceB.id,
      tenantId: tenantB,
      priceMinorUnits: 4000,
      unit: PricingUnit.PER_SERVICE,
    });

    teamA = await teamsService.createTeam({
      actorId: ownerAId,
      tenantId: tenantA,
      name: `Booking Team A ${run}`,
    });
    teamB = await teamsService.createTeam({
      actorId: ownerBId,
      tenantId: tenantB,
      name: `Booking Team B ${run}`,
    });

    ({ customer: customerA, property: propertyA } =
      await insertCustomerAndProperty(tenantA, 'A'));
    ({ customer: customerB, property: propertyB } =
      await insertCustomerAndProperty(tenantB, 'B'));

    // A booking with a team, for each tenant, via `BookingsService.create`.
    bookingA = await bookingsService.create({
      actorId: ownerAId,
      customerId: customerA.id,
      propertyId: propertyA.id,
      serviceId: serviceA.id,
      teamId: teamA.id,
      tenantId: tenantA,
      scheduledAt: new Date('2030-06-01T09:00:00Z'),
    });
    bookingB = await bookingsService.create({
      actorId: ownerBId,
      customerId: customerB.id,
      propertyId: propertyB.id,
      serviceId: serviceB.id,
      teamId: teamB.id,
      tenantId: tenantB,
      scheduledAt: new Date('2030-06-02T09:00:00Z'),
    });
  });

  afterAll(async () => {
    try {
      if (dataSource) {
        // Audit rows this suite can attribute to its own actors — deleted
        // before `removeTestTenants` (which does not touch
        // `audit_event_entity`).
        await auditEventRepository.delete({
          actorId: In([ownerAId, ownerBId, financeAId]),
        });
        // `bookingA`/`bookingB` (and any job created from them, and the
        // Case 5 positive-control booking) are owned by tenantA/tenantB and
        // are removed by `removeTestTenants` — jobs before bookings,
        // properties before customers, teams, services (see that helper's
        // own comment for the full FK order).
        await removeTestTenants(dataSource, [tenantA, tenantB]);
      }
    } finally {
      await app?.close();
    }
  });

  const BOOKINGS_BY_IDS_QUERY = `
    query Bookings($ids: [ID!]) {
      bookings(filter: { id: { in: $ids } }, paging: { limit: 50 }) {
        totalCount
        nodes { id }
      }
    }
  `;

  const BOOKING_QUERY = `
    query Booking($id: ID!) {
      booking(id: $id) { id status }
    }
  `;

  // Case 1: root scoping — list/count and single-id lookup.
  it("scopes bookings list/count and booking(id) to the caller's tenant", async () => {
    const ids = [bookingA.id, bookingB.id];

    const asB = await gql(cookieB, BOOKINGS_BY_IDS_QUERY, { ids });
    expect(asB.body.errors).toBeUndefined();
    expect(asB.body.data.bookings).toEqual({
      totalCount: 1,
      nodes: [{ id: bookingB.id }],
    });

    const asA = await gql(cookieA, BOOKINGS_BY_IDS_QUERY, { ids });
    expect(asA.body.errors).toBeUndefined();
    expect(asA.body.data.bookings).toEqual({
      totalCount: 1,
      nodes: [{ id: bookingA.id }],
    });

    const crossTenant = await gql(cookieB, BOOKING_QUERY, {
      id: bookingA.id,
    });
    const missing = await gql(cookieB, BOOKING_QUERY, { id: randomUUID() });

    // `booking(id)` is a non-nullable root field (unlike `property(id)`), so
    // a not-found error nulls the whole `data` object, not just the
    // `booking` key — still "identical in shape" and still no booking data
    // in the response either way.
    expect(crossTenant.body.errors).toBeDefined();
    expect(crossTenant.body.data).toBeNull();
    expect(missing.body.errors).toBeDefined();
    expect(missing.body.data).toBeNull();

    // Identical in shape: same status, same message pattern (the message
    // itself includes the id, so only the pattern — not the exact string —
    // is shared between the two).
    expect(errorStatus(crossTenant)).toBe(404);
    expect(errorStatus(missing)).toBe(404);
    const messagePattern = /^Unable to find BookingEntity with id: /;
    expect(crossTenant.body.errors[0].message).toMatch(messagePattern);
    expect(missing.body.errors[0].message).toMatch(messagePattern);
  });

  const BOOKINGS_FILTER_QUERY = `
    query Bookings($filter: BookingFilter) {
      bookings(filter: $filter, paging: { limit: 50 }) {
        totalCount
        nodes { id }
      }
    }
  `;

  // Case 2 (Decision 10): a relation filter can only narrow, never widen,
  // across the tenant boundary. Every field below is confirmed filterable
  // on its target type (`id` via `@IDField`, the rest via
  // `@FilterableField`); none are dropped.
  const RELATION_FILTER_CASES: [string, () => Record<string, unknown>][] = [
    ['customer.id', () => ({ customer: { id: { eq: customerA.id } } })],
    [
      'customer.fullName (prefix like)',
      () => ({
        customer: { fullName: { like: `Customer A ${run}%` } },
      }),
    ],
    ['property.id', () => ({ property: { id: { eq: propertyA.id } } })],
    [
      // M5 amendment: `label` is not filterable on `PropertyType`.
      'property.customerId',
      () => ({ property: { customerId: { eq: customerA.id } } }),
    ],
    ['service.name', () => ({ service: { name: { eq: serviceA.name } } })],
    ['team.id', () => ({ team: { id: { eq: teamA.id } } })],
    ['team.name', () => ({ team: { name: { eq: teamA.name } } })],
    [
      'or(customer.id, service.id)',
      () => ({
        or: [
          { customer: { id: { eq: customerA.id } } },
          { service: { id: { eq: serviceA.id } } },
        ],
      }),
    ],
  ];

  describe.each(RELATION_FILTER_CASES)(
    'Case 2: relation filter %s cannot widen the root past the tenant boundary',
    (_label, buildFilter) => {
      it('is empty for B and matches bookingA for A', async () => {
        const filter = buildFilter();

        const asB = await gql(cookieB, BOOKINGS_FILTER_QUERY, { filter });
        expect(asB.body.errors).toBeUndefined();
        expect(asB.body.data.bookings).toEqual({ totalCount: 0, nodes: [] });

        const asA = await gql(cookieA, BOOKINGS_FILTER_QUERY, { filter });
        expect(asA.body.errors).toBeUndefined();
        expect(asA.body.data.bookings).toEqual({
          totalCount: 1,
          nodes: [{ id: bookingA.id }],
        });
      });
    },
  );

  // Case 3: nested relation (`Property.bookings`) is equally tenant-scoped
  // — B cannot even name A's property to reach the nested connection.
  it("scopes Property.bookings to the caller's tenant (B cannot even name A's property)", async () => {
    // `Property.bookings` disables `totalCount` (`property.type.ts`'s
    // `@OffsetConnection('bookings', ..., { enableTotalCount: false })`) —
    // only `nodes` is queried here.
    const query = `
      query PropertyBookings($id: ID!) {
        property(id: $id) {
          id
          bookings { nodes { id } }
        }
      }
    `;

    const asB = await gql(cookieB, query, { id: propertyA.id });
    expect(asB.body.errors).toBeUndefined();
    expect(asB.body.data.property).toBeNull();

    const asA = await gql(cookieA, query, { id: propertyA.id });
    expect(asA.body.errors).toBeUndefined();
    expect(asA.body.data.property.id).toBe(propertyA.id);
    expect(asA.body.data.property.bookings.nodes).toEqual([
      { id: bookingA.id },
    ]);
  });

  const UPDATE_BOOKING_MUTATION = `
    mutation UpdateBooking($input: UpdateBookingInput!) {
      updateBooking(updateBookingInput: $input) { id status }
    }
  `;
  const REMOVE_BOOKING_MUTATION = `
    mutation RemoveBooking($id: ID!) {
      removeBooking(id: $id) { id }
    }
  `;

  // Case 4 (Decision 9): cross-tenant GraphQL writes are 404, not 403, and
  // change nothing.
  it("updateBooking/removeBooking against A's booking as B are 404, and A's booking is unchanged", async () => {
    const updateRes = await gql(cookieB, UPDATE_BOOKING_MUTATION, {
      input: { id: bookingA.id, status: 'CANCELLED' },
    });
    expect(errorStatus(updateRes)).toBe(404);

    const removeRes = await gql(cookieB, REMOVE_BOOKING_MUTATION, {
      id: bookingA.id,
    });
    expect(errorStatus(removeRes)).toBe(404);

    const stillA = await gql(cookieA, BOOKING_QUERY, { id: bookingA.id });
    expect(stillA.body.errors).toBeUndefined();
    expect(stillA.body.data.booking).toEqual({
      id: bookingA.id,
      status: BookingStatus.PENDING,
    });
  });

  const CREATE_BOOKING_MUTATION = `
    mutation CreateBooking($input: CreateBookingInput!) {
      createBooking(createBookingInput: $input) { id }
    }
  `;

  // Case 5 (I-1 application half, RFC §4.9): every reference on
  // create/update is resolved within the caller's own tenant.
  describe('Case 5: cross-tenant references on create/update', () => {
    let controlBookingId: string | undefined;

    it('accepts the unmodified baseline (all-B) input as a positive control', async () => {
      const res = await gql(cookieB, CREATE_BOOKING_MUTATION, {
        input: baselineCreateInputForB(),
      });
      expect(res.body.errors).toBeUndefined();
      controlBookingId = res.body.data.createBooking.id;
      expect(controlBookingId).toBeTruthy();
    });

    const CROSS_TENANT_REFERENCE_CASES: [
      string,
      () => Record<string, string>,
    ][] = [
      ['customerId', () => ({ customerId: customerA.id })],
      ['propertyId', () => ({ propertyId: propertyA.id })],
      ['serviceId', () => ({ serviceId: serviceA.id })],
      ["teamId (B's team replaced by A's)", () => ({ teamId: teamA.id })],
    ];

    it.each(CROSS_TENANT_REFERENCE_CASES)(
      'createBooking with %s pointing at tenant A is 404 and leaves tenant B unchanged',
      async (_label, buildOverride) => {
        const countBefore = await bookingCountForTenant(tenantB);

        const res = await gql(cookieB, CREATE_BOOKING_MUTATION, {
          input: baselineCreateInputForB(buildOverride()),
        });
        expect(errorStatus(res)).toBe(404);

        const countAfter = await bookingCountForTenant(tenantB);
        expect(countAfter).toBe(countBefore);
      },
    );

    it("updateBooking(teamId: A's team) as B is 404, and bookingB.teamId is unchanged", async () => {
      const res = await gql(cookieB, UPDATE_BOOKING_MUTATION, {
        input: { id: bookingB.id, teamId: teamA.id },
      });
      expect(errorStatus(res)).toBe(404);

      const check = await gql(
        cookieB,
        `query($id: ID!){ booking(id:$id){ team { id } } }`,
        { id: bookingB.id },
      );
      expect(check.body.errors).toBeUndefined();
      expect(check.body.data.booking.team).toEqual({ id: teamB.id });
    });

    afterAll(async () => {
      if (controlBookingId) {
        // Belt-and-suspenders: `removeTestTenants` (afterAll) deletes it
        // too via `tenantId`, but removing it here keeps this describe
        // block's own accounting exact for any test that runs after it in
        // this file and recomputes tenant B's booking count.
        await bookingRepository.delete({ id: controlBookingId });
      }
    });
  });

  // Case 6 (I-2, Review Focus 1): `tenantId` is not an exposed input/filter,
  // and no client-supplied tenant signal (input, filter, header, REST body)
  // is ever honored.
  describe('Case 6: spoofing — tenantId is never accepted from the client', () => {
    it('createBooking rejects a tenantId field on the input (GraphQL validation error, no row in either tenant)', async () => {
      const beforeA = await bookingCountForTenant(tenantA);
      const beforeB = await bookingCountForTenant(tenantB);

      const res = await gql(cookieB, CREATE_BOOKING_MUTATION, {
        input: { ...baselineCreateInputForB(), tenantId: tenantA },
      });
      expect(res.body.errors).toBeDefined();
      expect(res.body.data).toBeUndefined();

      expect(await bookingCountForTenant(tenantA)).toBe(beforeA);
      expect(await bookingCountForTenant(tenantB)).toBe(beforeB);
    });

    it('bookings(filter: { tenantId }) is a GraphQL validation error (tenantId is not a filterable field)', async () => {
      const res = await gql(
        cookieB,
        `query($filter: BookingFilter){ bookings(filter:$filter){ totalCount } }`,
        { filter: { tenantId: { eq: tenantA } } },
      );
      expect(res.body.errors).toBeDefined();
      expect(res.body.data).toBeUndefined();
    });

    it("a widened or-filter naming A's id (plus an always-false branch) still returns nothing for B", async () => {
      const res = await gql(cookieB, BOOKINGS_FILTER_QUERY, {
        filter: {
          or: [{ id: { eq: bookingA.id } }, { id: { is: null } }],
        },
      });
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.bookings).toEqual({ totalCount: 0, nodes: [] });
    });

    it('an x-tenant-id header naming A is ignored; B still only sees its own bookings', async () => {
      const res = await request(app.getHttpServer())
        .post('/graphql')
        .set('Cookie', cookieB)
        .set('x-tenant-id', tenantA)
        .send({
          query: BOOKINGS_BY_IDS_QUERY,
          variables: { ids: [bookingA.id, bookingB.id] },
        });
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.bookings).toEqual({
        totalCount: 1,
        nodes: [{ id: bookingB.id }],
      });
    });

    it('REST POST /bookings rejects a tenantId body field (400), no row created', async () => {
      const beforeB = await bookingCountForTenant(tenantB);

      const res = await request(app.getHttpServer())
        .post('/bookings')
        .set('Cookie', cookieB)
        .send({
          customerId: customerB.id,
          propertyId: propertyB.id,
          serviceId: serviceB.id,
          teamId: teamB.id,
          tenantId: tenantA,
          scheduledAt: '2031-01-05T09:00:00.000Z',
        });
      expect(res.status).toBe(400);

      expect(await bookingCountForTenant(tenantB)).toBe(beforeB);
    });

    it('REST PATCH /bookings/:id rejects a tenantId body field (400), bookingB.tenantId unchanged', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/bookings/${bookingB.id}`)
        .set('Cookie', cookieB)
        .send({ tenantId: tenantA });
      expect(res.status).toBe(400);

      const stillB = await bookingRepository.findOneBy({ id: bookingB.id });
      expect(stillB?.tenantId).toBe(tenantB);
    });
  });

  // Case 7 (Decision 3): REST cross-tenant reads/writes are 404, and A's
  // booking is unaffected.
  it('REST cross-tenant reads/writes for booking A as B are all 404, and A is unchanged', async () => {
    const server = app.getHttpServer();

    const listRes = await request(server)
      .get('/bookings')
      .set('Cookie', cookieB);
    expect(listRes.status).toBe(200);
    const ids: string[] = (listRes.body as { id: string }[]).map((b) => b.id);
    expect(ids).toContain(bookingB.id);
    expect(ids).not.toContain(bookingA.id);

    const getRes = await request(server)
      .get(`/bookings/${bookingA.id}`)
      .set('Cookie', cookieB);
    expect(getRes.status).toBe(404);

    const patchRes = await request(server)
      .patch(`/bookings/${bookingA.id}`)
      .set('Cookie', cookieB)
      .send({ status: 'CANCELLED' });
    expect(patchRes.status).toBe(404);

    const deleteRes = await request(server)
      .delete(`/bookings/${bookingA.id}`)
      .set('Cookie', cookieB);
    expect(deleteRes.status).toBe(404);

    const stillA = await request(server)
      .get(`/bookings/${bookingA.id}`)
      .set('Cookie', cookieA);
    expect(stillA.status).toBe(200);
    expect(stillA.body).toMatchObject({
      id: bookingA.id,
      status: BookingStatus.PENDING,
    });
  });

  // Case 8 (Review Focus 4): REST auth matrix — no session is 401, a role
  // outside VIEW_ROLES/WRITE_ROLES is 403 (never leaking a 404 that would
  // imply the row was reachable), Super Admin is 403 everywhere (no booking
  // route grants SUPER_ADMIN).
  it('REST auth matrix: no cookie is 401 everywhere, FINANCE cannot write (403) but can read only its own tenant, Super Admin is 403 everywhere', async () => {
    const server = app.getHttpServer();

    expect((await request(server).post('/bookings').send({})).status).toBe(401);
    expect((await request(server).get('/bookings')).status).toBe(401);
    expect((await request(server).get(`/bookings/${bookingA.id}`)).status).toBe(
      401,
    );
    expect(
      (await request(server).patch(`/bookings/${bookingA.id}`).send({})).status,
    ).toBe(401);
    expect(
      (await request(server).delete(`/bookings/${bookingA.id}`)).status,
    ).toBe(401);

    expect(
      (
        await request(server)
          .post('/bookings')
          .set('Cookie', cookieFinanceA)
          .send({
            customerId: customerA.id,
            propertyId: propertyA.id,
            serviceId: serviceA.id,
            teamId: teamA.id,
            scheduledAt: '2031-01-06T09:00:00.000Z',
          })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(server)
          .patch(`/bookings/${bookingA.id}`)
          .set('Cookie', cookieFinanceA)
          .send({ status: 'CANCELLED' })
      ).status,
    ).toBe(403);
    expect(
      (
        await request(server)
          .delete(`/bookings/${bookingA.id}`)
          .set('Cookie', cookieFinanceA)
      ).status,
    ).toBe(403);

    const financeListRes = await request(server)
      .get('/bookings')
      .set('Cookie', cookieFinanceA);
    expect(financeListRes.status).toBe(200);
    const financeIds: string[] = (financeListRes.body as { id: string }[]).map(
      (b) => b.id,
    );
    expect(financeIds).toContain(bookingA.id);
    expect(financeIds).not.toContain(bookingB.id);

    expect(
      (
        await request(server)
          .post('/bookings')
          .set('Cookie', cookieSuperAdmin)
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (await request(server).get('/bookings').set('Cookie', cookieSuperAdmin))
        .status,
    ).toBe(403);
    expect(
      (
        await request(server)
          .get(`/bookings/${bookingA.id}`)
          .set('Cookie', cookieSuperAdmin)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(server)
          .patch(`/bookings/${bookingA.id}`)
          .set('Cookie', cookieSuperAdmin)
          .send({})
      ).status,
    ).toBe(403);
    expect(
      (
        await request(server)
          .delete(`/bookings/${bookingA.id}`)
          .set('Cookie', cookieSuperAdmin)
      ).status,
    ).toBe(403);
  });

  const CREATE_JOB_MUTATION = `
    mutation CreateJobFromBooking($input: CreateJobFromBookingInput!) {
      createJobFromBooking(input: $input) { id }
    }
  `;

  // Case 9 (Decision 11): createJobFromBooking against another tenant's
  // booking is 404, and no job row is created for it. Must run before
  // Case 10, which creates a job from `bookingA`.
  it("createJobFromBooking with A's booking as B is 404, and no job row is created for it", async () => {
    const res = await gql(cookieB, CREATE_JOB_MUTATION, {
      input: { bookingId: bookingA.id },
    });
    expect(errorStatus(res)).toBe(404);

    const job = await cleaningJobRepository.findOneBy({
      bookingId: bookingA.id,
    });
    expect(job).toBeNull();
  });

  // Case 10 (#86 closed the #85 residual exposure): jobs are tenant-owned,
  // so B naming A's job gets `job: null` — no error and no A booking or
  // customer data. As A (positive control) the same query resolves the
  // booking.
  it("B naming A's job through job(id) gets null and no A booking/customer data", async () => {
    const createRes = await gql(cookieA, CREATE_JOB_MUTATION, {
      input: { bookingId: bookingA.id },
    });
    expect(createRes.body.errors).toBeUndefined();
    const jobAId: string = createRes.body.data.createJobFromBooking.id;
    const JOB_QUERY = `query($id: ID!){ job(id:$id){ id booking { id customer { id } } } }`;

    const res = await gql(cookieB, JOB_QUERY, { id: jobAId });
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.job).toBeNull();
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(bookingA.id);
    expect(raw).not.toContain(customerA.id);

    const resA = await gql(cookieA, JOB_QUERY, { id: jobAId });
    expect(resA.body.errors).toBeUndefined();
    expect(resA.body.data.job.booking.id).toBe(bookingA.id);
  });

  // Case 10b (regression for the #85 Case 10 root cause): with a sibling
  // nestjs-query root (`bookings`) in the same request, B still gets
  // `job: null` and no A data.
  it("B naming A's job next to a nestjs-query root field still gets null and no A data", async () => {
    const job = await cleaningJobRepository.findOneByOrFail({
      bookingId: bookingA.id,
    });

    const res = await gql(
      cookieB,
      `query($id: ID!){
        bookings { nodes { id customer { id } } }
        job(id:$id){ id booking { id customer { id } } }
      }`,
      { id: job.id },
    );

    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.job).toBeNull();
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain(bookingA.id);
    expect(raw).not.toContain(customerA.id);
  });

  // Case 11 (I-1 database half): even bypassing the application layer, the
  // composite `fk_booking_*_tenant` FKs reject a booking row whose
  // reference belongs to another tenant.
  it('rejects a booking row referencing another tenant at the database (composite fk_booking_*_tenant)', async () => {
    const baseRow = {
      customerId: customerB.id,
      propertyId: propertyB.id,
      serviceId: serviceB.id,
      teamId: teamB.id,
      tenantId: tenantB,
      pricingSnapshot: { priceMinorUnits: 1 },
      scheduledAt: new Date('2031-02-01T09:00:00Z'),
    };

    await expect(
      bookingRepository.insert({ ...baseRow, customerId: customerA.id }),
    ).rejects.toMatchObject({
      driverError: { constraint: 'fk_booking_customer_tenant' },
    });

    await expect(
      bookingRepository.insert({ ...baseRow, propertyId: propertyA.id }),
    ).rejects.toMatchObject({
      driverError: { constraint: 'fk_booking_property_tenant' },
    });

    await expect(
      bookingRepository.insert({ ...baseRow, serviceId: serviceA.id }),
    ).rejects.toMatchObject({
      driverError: { constraint: 'fk_booking_service_tenant' },
    });

    await expect(
      bookingRepository.insert({ ...baseRow, teamId: teamA.id }),
    ).rejects.toMatchObject({
      driverError: { constraint: 'fk_booking_team_tenant' },
    });
  });
});
