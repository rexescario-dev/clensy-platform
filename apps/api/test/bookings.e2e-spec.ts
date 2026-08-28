import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { AdminUserEntity } from '../src/modules/admins/infrastructure/persistence/admin-user.entity';
import { BookingsService } from '../src/modules/bookings/application/services/bookings.service';
import { CustomersService } from '../src/modules/customers/application/services/customers.service';
import { PropertiesService } from '../src/modules/customers/application/services/properties.service';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { TeamsService } from '../src/modules/cleaners/application/services/teams.service';
import { Role } from '../src/platform/auth/domain/role';
import { countSqlMentioning, withCapturedSql } from './helpers/capture-sql';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import { seedOwner } from './helpers/seed-owner';

// Proves the resolver -> guard -> service -> loader -> database wiring
// end-to-end over real GraphQL requests (plan §7) — it does not re-prove
// what bookings.service.e2e-spec.ts's level-2 real-Postgres service tests
// already cover (validation-chain branching, pricing-snapshot immutability,
// audit rollback) at the service layer; this file's own pricing-snapshot
// assertion (step 2) is the end-to-end counterpart of that proof, not a
// duplicate of its exhaustive coverage.
//
// Self-contained, mirroring catalog.e2e-spec.ts's/cleaners-teams.e2e-spec
// .ts's exact precedent: seeds its own Owner via helpers/seed-owner.ts,
// creates its own Scheduler/Customer Support/Finance/Analyst admins, uses
// unique-per-run data (interpolating the seeded Owner's id), and scopes
// every assertion to specific returned ids — safe to run against the same
// non-truncated, real Postgres database as every other suite.
//
// Kept as one file rather than split into golden-path/RBAC-audit/batching
// suites (considered at M5 round 1) — matches the Accepted Catalog plan's
// own precedent; steps are grouped and numbered for readability instead.
describe('Bookings (e2e)', () => {
  let app: INestApplication<App>;
  let adminUserRepository: Repository<AdminUserEntity>;
  let auditEventRepository: Repository<AuditEventEntity>;
  let customersService: CustomersService;
  let propertiesService: PropertiesService;
  let servicesService: ServicesService;
  let teamsService: TeamsService;
  let bookingsService: BookingsService;
  let dataSource: DataSource;

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
    customersService = moduleFixture.get(CustomersService);
    propertiesService = moduleFixture.get(PropertiesService);
    servicesService = moduleFixture.get(ServicesService);
    teamsService = moduleFixture.get(TeamsService);
    bookingsService = moduleFixture.get(BookingsService);
    dataSource = moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  const LOGIN_MUTATION = `
    mutation Login($input: LoginInput!) {
      login(loginInput: $input) {
        success
        admin { id role }
      }
    }
  `;

  const CREATE_ADMIN_MUTATION = `
    mutation CreateAdmin($input: CreateAdminInput!) {
      createAdmin(createAdminInput: $input) { id email role isActive }
    }
  `;

  const CREATE_BOOKING_MUTATION = `
    mutation CreateBooking($input: CreateBookingInput!) {
      createBooking(createBookingInput: $input) {
        id
        scheduledAt
        status
        pricingSnapshot { priceMinorUnits }
        customer { id fullName }
        property { id addressLine1 }
        service { id name }
        team { id name }
      }
    }
  `;

  const UPDATE_BOOKING_MUTATION = `
    mutation UpdateBooking($input: UpdateBookingInput!) {
      updateBooking(updateBookingInput: $input) {
        id
        scheduledAt
        status
        team { id name }
      }
    }
  `;

  const REMOVE_BOOKING_MUTATION = `
    mutation RemoveBooking($id: ID!) {
      removeBooking(id: $id) { id }
    }
  `;

  const BOOKING_QUERY = `
    query Booking($id: ID!) {
      booking(id: $id) {
        id
        pricingSnapshot { priceMinorUnits }
      }
    }
  `;

  const BOOKINGS_QUERY = `
    query Bookings {
      bookings {
        totalCount
        nodes {
          id
          customer { fullName }
          property { addressLine1 }
          service { name }
          team { name }
        }
      }
    }
  `;

  const BOOKINGS_BATCH_QUERY = `
    query BookingsBatch($customerId: ID!) {
      bookings(filter: { customer: { id: { eq: $customerId } } }) {
        nodes {
          id
          customer { fullName }
          property { addressLine1 }
          service { name }
          team { name }
        }
      }
    }
  `;

  const BOOKINGS_NO_TEAM_QUERY = `
    query BookingsNoTeam($customerId: ID!) {
      bookings(filter: { customer: { id: { eq: $customerId } } }) {
        nodes {
          id
          customer { fullName }
        }
      }
    }
  `;

  const MISSING_BOOKING_QUERY = `
    query MissingBooking {
      booking(id: "00000000-0000-0000-0000-000000000099") { id }
    }
  `;

  const RELATION_TABLES = [
    'customer_entity',
    'property_entity',
    'service_entity',
    'team_entity',
  ] as const;

  function extractSessionCookie(response: request.Response): string {
    const setCookieHeader = response.headers['set-cookie'] as unknown as
      string[] | undefined;
    if (!setCookieHeader || setCookieHeader.length === 0) {
      throw new Error('Expected a Set-Cookie header on the login response');
    }
    return setCookieHeader[0].split(';')[0];
  }

  async function login(email: string, password: string) {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: LOGIN_MUTATION,
        variables: { input: { email, password } },
      });
  }

  function authedRequest(sessionCookie: string) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', sessionCookie);
  }

  async function createAdmin(
    ownerSessionCookie: string,
    email: string,
    password: string,
    role: Role,
  ) {
    const response = await authedRequest(ownerSessionCookie).send({
      query: CREATE_ADMIN_MUTATION,
      variables: { input: { email, password, role } },
    });
    expect(response.body.errors).toBeUndefined();
    return response.body.data.createAdmin;
  }

  // Fixture chain built directly through each owning module's own
  // application service (not through this suite's own GraphQL mutations —
  // those modules' own e2e suites already prove their own mutation wiring;
  // this file only needs valid upstream rows to exist).
  async function createFixture(runId: string, priceMinorUnits = 5000) {
    const customer = await customersService.create({
      actorId: 'e2e',
      fullName: `Fixture Customer ${runId}`,
      email: `fixture-${runId}@example.com`,
      phone: '555-0100',
    });
    const property = await propertiesService.create({
      actorId: 'e2e',
      customerId: customer.id,
      label: 'Home',
      addressLine1: `${runId} Main St`,
      city: 'City',
      region: 'Region',
      postalCode: '00000',
    });
    const service = await servicesService.createService({
      actorId: 'e2e',
      name: `Fixture Service ${runId}`,
      durationMinutes: 60,
    });
    const team = await teamsService.createTeam({
      actorId: 'e2e',
      name: `Fixture Team ${runId}`,
    });
    return { customer, property, service, team, priceMinorUnits };
  }

  it('proves the full Bookings E2E acceptance scenario', async () => {
    const owner = await seedOwner(adminUserRepository);
    const runId = owner.id;

    const ownerLoginResponse = await login(owner.email, owner.password);
    expect(ownerLoginResponse.body.errors).toBeUndefined();
    const ownerSessionCookie = extractSessionCookie(ownerLoginResponse);

    // --- Step 1: golden path — customer -> property -> service + active
    // pricing -> booking (spec §2's M3-round-2 wording). PricingRulesService
    // isn't injected directly here; a real active price is required for
    // createBooking to succeed, so it's created via that module's own
    // GraphQL mutation instead of reaching into its service. ---
    const { customer, property, service, team } = await createFixture(
      runId,
      5000,
    );
    const createPricingRuleResponse = await authedRequest(
      ownerSessionCookie,
    ).send({
      query: `mutation CreatePricingRule($input: CreatePricingRuleInput!) {
        createPricingRule(input: $input) { id }
      }`,
      variables: { input: { serviceId: service.id, priceMinorUnits: 5000 } },
    });
    expect(createPricingRuleResponse.body.errors).toBeUndefined();

    const scheduledAt = '2026-09-01T09:00:00.000Z';
    const createBookingResponse = await authedRequest(ownerSessionCookie).send({
      query: CREATE_BOOKING_MUTATION,
      variables: {
        input: {
          customerId: customer.id,
          propertyId: property.id,
          serviceId: service.id,
          teamId: team.id,
          scheduledAt,
        },
      },
    });
    expect(createBookingResponse.body.errors).toBeUndefined();
    const createdBooking = createBookingResponse.body.data.createBooking;
    expect(createdBooking).toMatchObject({
      scheduledAt,
      status: 'PENDING',
      pricingSnapshot: { priceMinorUnits: 5000 },
      customer: { id: customer.id, fullName: customer.fullName },
      property: { id: property.id, addressLine1: property.addressLine1 },
      service: { id: service.id, name: service.name },
      team: { id: team.id, name: team.name },
    });
    const bookingId: string = createdBooking.id;

    const bookingCreateAuditEvent = await auditEventRepository.findOneBy({
      action: 'booking.create',
      entityId: bookingId,
    });
    expect(bookingCreateAuditEvent).not.toBeNull();
    expect(bookingCreateAuditEvent?.actorId).toBe(owner.id);

    // --- Step 2: pricing-snapshot immutability, end-to-end (spec §2/§6) —
    // change the service's active price, re-fetch the booking, snapshot
    // unchanged. ---
    const repriceResponse = await authedRequest(ownerSessionCookie).send({
      query: `mutation CreatePricingRule($input: CreatePricingRuleInput!) {
        createPricingRule(input: $input) { id }
      }`,
      variables: { input: { serviceId: service.id, priceMinorUnits: 6000 } },
    });
    expect(repriceResponse.body.errors).toBeUndefined();

    const refetchedBookingResponse = await authedRequest(
      ownerSessionCookie,
    ).send({
      query: BOOKING_QUERY,
      variables: { id: bookingId },
    });
    expect(refetchedBookingResponse.body.errors).toBeUndefined();
    expect(refetchedBookingResponse.body.data.booking.pricingSnapshot).toEqual({
      priceMinorUnits: 5000,
    });

    // --- Step 2b: updateBooking with only `id` — no other field — does not
    // crash (M7 finding). This is the level that actually caught the real
    // bug: the resolver hands `BookingsService` a real, class-transformer-
    // hydrated `UpdateBookingInput` where every untouched optional field is
    // an explicit `undefined`-valued own property, not simply absent —
    // level-1/level-2 tests built with plain object literals didn't
    // reproduce that shape, only a genuine GraphQL request over real HTTP
    // does. ---
    const emptyUpdateResponse = await authedRequest(ownerSessionCookie).send({
      query: UPDATE_BOOKING_MUTATION,
      variables: { input: { id: bookingId } },
    });
    expect(emptyUpdateResponse.body.errors).toBeUndefined();
    expect(emptyUpdateResponse.body.data.updateBooking).toMatchObject({
      id: bookingId,
      scheduledAt,
    });

    // --- Step 3: status transition to CANCELLED is non-destructive — the
    // booking stays visible via `bookings`, every other field unchanged. ---
    const cancelResponse = await authedRequest(ownerSessionCookie).send({
      query: UPDATE_BOOKING_MUTATION,
      variables: { input: { id: bookingId, status: 'CANCELLED' } },
    });
    expect(cancelResponse.body.errors).toBeUndefined();
    expect(cancelResponse.body.data.updateBooking).toMatchObject({
      id: bookingId,
      scheduledAt,
      status: 'CANCELLED',
      team: { id: team.id },
    });

    const bookingUpdateAuditEvent = await auditEventRepository.findOneBy({
      action: 'booking.update',
      entityId: bookingId,
    });
    expect(bookingUpdateAuditEvent).not.toBeNull();

    // --- Step 4: teamId — set, clear to null, then omit (preserves
    // whatever it was last set to). ---
    const {
      customer: c2,
      property: p2,
      service: s2,
      team: t2,
    } = await createFixture(`${runId}-2`, 4000);
    await authedRequest(ownerSessionCookie).send({
      query: `mutation CreatePricingRule($input: CreatePricingRuleInput!) {
        createPricingRule(input: $input) { id }
      }`,
      variables: { input: { serviceId: s2.id, priceMinorUnits: 4000 } },
    });
    const secondBookingResponse = await authedRequest(ownerSessionCookie).send({
      query: CREATE_BOOKING_MUTATION,
      variables: {
        input: {
          customerId: c2.id,
          propertyId: p2.id,
          serviceId: s2.id,
          scheduledAt: '2026-09-05T09:00:00.000Z',
        },
      },
    });
    expect(secondBookingResponse.body.errors).toBeUndefined();
    const secondBookingId: string =
      secondBookingResponse.body.data.createBooking.id;

    const assignTeamResponse = await authedRequest(ownerSessionCookie).send({
      query: UPDATE_BOOKING_MUTATION,
      variables: { input: { id: secondBookingId, teamId: t2.id } },
    });
    expect(assignTeamResponse.body.data.updateBooking.team).toEqual({
      id: t2.id,
      name: t2.name,
    });

    const clearTeamResponse = await authedRequest(ownerSessionCookie).send({
      query: UPDATE_BOOKING_MUTATION,
      variables: { input: { id: secondBookingId, teamId: null } },
    });
    expect(clearTeamResponse.body.data.updateBooking.team).toBeNull();

    const omitTeamResponse = await authedRequest(ownerSessionCookie).send({
      query: UPDATE_BOOKING_MUTATION,
      variables: {
        input: { id: secondBookingId, scheduledAt: '2026-09-06T09:00:00.000Z' },
      },
    });
    expect(omitTeamResponse.body.data.updateBooking.team).toBeNull();

    // --- Step 5: SQL O(1) in N (spec §4.8) — same four-relation list at
    // N=6 and N=12. Counts must be constant in N, not per-parent. ---
    const batchFixture = await createFixture(`${runId}-batch`, 5500);
    const batchPricing = await authedRequest(ownerSessionCookie).send({
      query: `mutation CreatePricingRule($input: CreatePricingRuleInput!) {
        createPricingRule(input: $input) { id }
      }`,
      variables: {
        input: { serviceId: batchFixture.service.id, priceMinorUnits: 5500 },
      },
    });
    expect(batchPricing.body.errors).toBeUndefined();

    const seedBatchBookings = async (count: number, dayOffset: number) => {
      for (let index = 0; index < count; index += 1) {
        const day = String(dayOffset + index + 1).padStart(2, '0');
        await bookingsService.create({
          actorId: owner.id,
          customerId: batchFixture.customer.id,
          propertyId: batchFixture.property.id,
          serviceId: batchFixture.service.id,
          teamId: batchFixture.team.id,
          scheduledAt: new Date(`2026-10-${day}T09:00:00.000Z`),
        });
      }
    };

    await seedBatchBookings(6, 0);

    const captureAtN = async (expectedN: number) => {
      const { result: response, queries } = await withCapturedSql(
        dataSource,
        () =>
          authedRequest(ownerSessionCookie).send({
            query: BOOKINGS_BATCH_QUERY,
            variables: { customerId: batchFixture.customer.id },
          }),
      );
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.bookings.nodes).toHaveLength(expectedN);
      return {
        queries,
        counts: Object.fromEntries(
          RELATION_TABLES.map((table) => [
            table,
            countSqlMentioning(queries, table),
          ]),
        ) as Record<(typeof RELATION_TABLES)[number], number>,
      };
    };

    const atSix = await captureAtN(6);
    await seedBatchBookings(6, 6);
    const atTwelve = await captureAtN(12);

    for (const table of RELATION_TABLES) {
      expect(atSix.counts[table]).toBeGreaterThan(0);
      expect(atTwelve.counts[table]).toBe(atSix.counts[table]);
      expect(atSix.counts[table]).toBeLessThan(6);
      expect(atTwelve.counts[table]).toBeLessThan(12);
    }

    const { result: noTeamResponse, queries: noTeamQueries } =
      await withCapturedSql(dataSource, () =>
        authedRequest(ownerSessionCookie).send({
          query: BOOKINGS_NO_TEAM_QUERY,
          variables: { customerId: batchFixture.customer.id },
        }),
      );
    expect(noTeamResponse.body.errors).toBeUndefined();
    expect(countSqlMentioning(noTeamQueries, 'team_entity')).toBe(0);

    const missingBookingResponse = await authedRequest(ownerSessionCookie).send(
      {
        query: MISSING_BOOKING_QUERY,
      },
    );
    expect(missingBookingResponse.body.errors?.length).toBeGreaterThan(0);
    expect(missingBookingResponse.body.data?.booking ?? null).toBeNull();

    // --- Step 6: negative validation cases — each rejected, no row
    // persisted, none reaching the next validation step. ---
    const nonexistentId = '00000000-0000-0000-0002-000000000099';

    const missingCustomerResponse = await authedRequest(
      ownerSessionCookie,
    ).send({
      query: CREATE_BOOKING_MUTATION,
      variables: {
        input: {
          customerId: nonexistentId,
          propertyId: property.id,
          serviceId: service.id,
          scheduledAt,
        },
      },
    });
    expect(missingCustomerResponse.body.data?.createBooking).toBeUndefined();
    expect(missingCustomerResponse.body.errors?.[0]?.message).toContain(
      `Customer ${nonexistentId} not found`,
    );

    const mismatchedPropertyResponse = await authedRequest(
      ownerSessionCookie,
    ).send({
      query: CREATE_BOOKING_MUTATION,
      variables: {
        input: {
          customerId: c2.id,
          propertyId: property.id,
          serviceId: service.id,
          scheduledAt,
        },
      },
    });
    expect(mismatchedPropertyResponse.body.data?.createBooking).toBeUndefined();
    expect(mismatchedPropertyResponse.body.errors?.[0]?.message).toContain(
      'Property does not belong to the given customer',
    );

    await servicesService.updateService(s2.id, {
      actorId: 'e2e',
      active: false,
    });
    const inactiveServiceResponse = await authedRequest(
      ownerSessionCookie,
    ).send({
      query: CREATE_BOOKING_MUTATION,
      variables: {
        input: {
          customerId: c2.id,
          propertyId: p2.id,
          serviceId: s2.id,
          scheduledAt,
        },
      },
    });
    expect(inactiveServiceResponse.body.data?.createBooking).toBeUndefined();
    expect(inactiveServiceResponse.body.errors?.[0]?.message).toContain(
      'Service is not active',
    );

    const missingTeamResponse = await authedRequest(ownerSessionCookie).send({
      query: CREATE_BOOKING_MUTATION,
      variables: {
        input: {
          customerId: customer.id,
          propertyId: property.id,
          serviceId: service.id,
          teamId: nonexistentId,
          scheduledAt,
        },
      },
    });
    expect(missingTeamResponse.body.data?.createBooking).toBeUndefined();
    expect(missingTeamResponse.body.errors?.[0]?.message).toContain(
      `Team ${nonexistentId} not found`,
    );

    // --- Step 7: remove — gone from `bookings`, audit event recorded (new
    // coverage — this operation was never audited before this slice). ---
    const removeResponse = await authedRequest(ownerSessionCookie).send({
      query: REMOVE_BOOKING_MUTATION,
      variables: { id: secondBookingId },
    });
    expect(removeResponse.body.errors).toBeUndefined();
    expect(removeResponse.body.data.removeBooking.id).toBe(secondBookingId);

    const afterRemoveResponse = await authedRequest(ownerSessionCookie).send({
      query: BOOKINGS_QUERY,
    });
    const afterRemoveIds: string[] =
      afterRemoveResponse.body.data.bookings.nodes.map(
        (b: { id: string }) => b.id,
      );
    expect(afterRemoveIds).not.toContain(secondBookingId);

    const bookingRemoveAuditEvent = await auditEventRepository.findOneBy({
      action: 'booking.remove',
      entityId: secondBookingId,
    });
    expect(bookingRemoveAuditEvent).not.toBeNull();

    // --- Step 8: RBAC matrix — create four non-Owner admins within this
    // suite. Scheduler/Customer Support (write-allowed) succeed at both
    // read and write; Finance/Analyst (view-only) succeed at read, are
    // denied at write. ---
    const schedulerEmail = `scheduler-${runId}@example.com`;
    const schedulerPassword = 'scheduler-pw-12345';
    await createAdmin(
      ownerSessionCookie,
      schedulerEmail,
      schedulerPassword,
      Role.SCHEDULER,
    );

    const customerSupportEmail = `customer-support-${runId}@example.com`;
    const customerSupportPassword = 'customer-support-pw-12345';
    await createAdmin(
      ownerSessionCookie,
      customerSupportEmail,
      customerSupportPassword,
      Role.CUSTOMER_SUPPORT,
    );

    const financeEmail = `finance-${runId}@example.com`;
    const financePassword = 'finance-pw-12345';
    await createAdmin(
      ownerSessionCookie,
      financeEmail,
      financePassword,
      Role.FINANCE,
    );

    const analystEmail = `analyst-${runId}@example.com`;
    const analystPassword = 'analyst-pw-12345';
    await createAdmin(
      ownerSessionCookie,
      analystEmail,
      analystPassword,
      Role.ANALYST,
    );

    const writeAllowedRoles = [
      { email: schedulerEmail, password: schedulerPassword },
      { email: customerSupportEmail, password: customerSupportPassword },
    ];
    for (const { email, password } of writeAllowedRoles) {
      const loginResponse = await login(email, password);
      const sessionCookie = extractSessionCookie(loginResponse);

      const readResponse = await authedRequest(sessionCookie).send({
        query: BOOKINGS_QUERY,
      });
      expect(readResponse.body.errors).toBeUndefined();

      const writeResponse = await authedRequest(sessionCookie).send({
        query: CREATE_BOOKING_MUTATION,
        variables: {
          input: {
            customerId: customer.id,
            propertyId: property.id,
            serviceId: service.id,
            scheduledAt,
          },
        },
      });
      expect(writeResponse.body.errors).toBeUndefined();
      expect(writeResponse.body.data.createBooking.id).toBeDefined();
    }

    const viewOnlyRoles = [
      { email: financeEmail, password: financePassword },
      { email: analystEmail, password: analystPassword },
    ];
    for (const { email, password } of viewOnlyRoles) {
      const loginResponse = await login(email, password);
      const sessionCookie = extractSessionCookie(loginResponse);

      const readResponse = await authedRequest(sessionCookie).send({
        query: BOOKINGS_QUERY,
      });
      expect(readResponse.body.errors).toBeUndefined();

      const writeDeniedResponse = await authedRequest(sessionCookie).send({
        query: CREATE_BOOKING_MUTATION,
        variables: {
          input: {
            customerId: customer.id,
            propertyId: property.id,
            serviceId: service.id,
            scheduledAt,
          },
        },
      });
      expect(writeDeniedResponse.body.data?.createBooking).toBeUndefined();
      expect(writeDeniedResponse.body.errors?.[0]?.extensions?.code).toBe(
        'FORBIDDEN',
      );
    }
  }, 120000);

  it('clamps bookings paging.limit above 100, defaults omitted paging to 20, and sorts equal scheduledAt by id ASC', async () => {
    const owner = await seedOwner(adminUserRepository);
    const ownerLoginResponse = await login(owner.email, owner.password);
    expect(ownerLoginResponse.body.errors).toBeUndefined();
    const ownerSessionCookie = extractSessionCookie(ownerLoginResponse);

    const fixture = await createFixture(`paging-${owner.id}`, 5000);
    const pricing = await authedRequest(ownerSessionCookie).send({
      query: `mutation CreatePricingRule($input: CreatePricingRuleInput!) {
        createPricingRule(input: $input) { id }
      }`,
      variables: {
        input: { serviceId: fixture.service.id, priceMinorUnits: 5000 },
      },
    });
    expect(pricing.body.errors).toBeUndefined();

    const sameScheduledAt = new Date('2026-11-15T09:00:00.000Z');
    const created: { id: string }[] = [];
    for (let index = 0; index < 21; index += 1) {
      created.push(
        await bookingsService.create({
          actorId: owner.id,
          customerId: fixture.customer.id,
          propertyId: fixture.property.id,
          serviceId: fixture.service.id,
          teamId: fixture.team.id,
          scheduledAt:
            index < 2
              ? sameScheduledAt
              : new Date(`2026-12-${String(index).padStart(2, '0')}T09:00:00.000Z`),
        }),
      );
    }

    const clampResponse = await authedRequest(ownerSessionCookie).send({
      query: `query Clamp($paging: OffsetPaging) {
        bookings(paging: $paging) {
          totalCount
          nodes { id }
        }
      }`,
      variables: { paging: { limit: 1000, offset: 0 } },
    });
    expect(clampResponse.body.errors).toBeUndefined();
    expect(clampResponse.body.data.bookings.nodes.length).toBe(
      Math.min(100, clampResponse.body.data.bookings.totalCount),
    );
    expect(clampResponse.body.data.bookings.nodes.length).toBeLessThanOrEqual(
      100,
    );

    const defaultResponse = await authedRequest(ownerSessionCookie).send({
      query: `query DefaultPage {
        bookings {
          totalCount
          nodes { id }
        }
      }`,
    });
    expect(defaultResponse.body.errors).toBeUndefined();
    expect(defaultResponse.body.data.bookings.nodes).toHaveLength(20);
    expect(defaultResponse.body.data.bookings.totalCount).toBeGreaterThanOrEqual(
      21,
    );

    const page0 = await authedRequest(ownerSessionCookie).send({
      query: `query SortPage($paging: OffsetPaging) {
        bookings(paging: $paging) { nodes { id scheduledAt } }
      }`,
      variables: { paging: { limit: 1, offset: 0 } },
    });
    const page1 = await authedRequest(ownerSessionCookie).send({
      query: `query SortPage($paging: OffsetPaging) {
        bookings(paging: $paging) { nodes { id scheduledAt } }
      }`,
      variables: { paging: { limit: 1, offset: 1 } },
    });
    expect(page0.body.errors).toBeUndefined();
    expect(page1.body.errors).toBeUndefined();
    const first = page0.body.data.bookings.nodes[0];
    const second = page1.body.data.bookings.nodes[0];
    expect(first.id).not.toBe(second.id);
    if (first.scheduledAt === second.scheduledAt) {
      expect(first.id < second.id).toBe(true);
    }

    const tiedIds = [created[0].id, created[1].id].sort();
    const tiedPage0 = await authedRequest(ownerSessionCookie).send({
      query: `query Tied($filter: BookingFilter, $paging: OffsetPaging) {
        bookings(
          filter: $filter
          paging: $paging
        ) { nodes { id } }
      }`,
      variables: {
        filter: { id: { in: tiedIds } },
        paging: { limit: 1, offset: 0 },
      },
    });
    const tiedPage1 = await authedRequest(ownerSessionCookie).send({
      query: `query Tied($filter: BookingFilter, $paging: OffsetPaging) {
        bookings(
          filter: $filter
          paging: $paging
        ) { nodes { id } }
      }`,
      variables: {
        filter: { id: { in: tiedIds } },
        paging: { limit: 1, offset: 1 },
      },
    });
    expect(tiedPage0.body.errors).toBeUndefined();
    expect(tiedPage1.body.errors).toBeUndefined();
    expect(tiedPage0.body.data.bookings.nodes[0].id).toBe(tiedIds[0]);
    expect(tiedPage1.body.data.bookings.nodes[0].id).toBe(tiedIds[1]);
  }, 120000);
});
