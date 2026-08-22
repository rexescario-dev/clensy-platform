import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { AdminUserEntity } from '../src/modules/admins/infrastructure/persistence/admin-user.entity';
import { CustomersService } from '../src/modules/customers/application/services/customers.service';
import { PropertiesService } from '../src/modules/customers/application/services/properties.service';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { TeamsService } from '../src/modules/cleaners/application/services/teams.service';
import { Role } from '../src/platform/auth/domain/role';
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

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
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
        id
        customer { fullName }
        property { addressLine1 }
        service { name }
        team { name }
      }
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

    // --- Step 5: batching/query-count proof (spec §4.5) — spies wrap the
    // REAL implementations so the actual batched DB calls happen; only call
    // count/arguments are inspected. The bulk methods aren't exposed as
    // named exports on a single loaders object the way Catalog's is, so
    // each owning module's own service is spied on directly. ---
    const getCustomersByIdsSpy = jest.spyOn(
      customersService,
      'getCustomersByIds',
    );
    const getPropertiesByIdsSpy = jest.spyOn(
      propertiesService,
      'getPropertiesByIds',
    );
    const getServicesByIdsSpy = jest.spyOn(servicesService, 'getServicesByIds');
    const getTeamsByIdsSpy = jest.spyOn(teamsService, 'getTeamsByIds');

    const bookingsBatchResponse = await authedRequest(ownerSessionCookie).send({
      query: BOOKINGS_QUERY,
    });
    expect(bookingsBatchResponse.body.errors).toBeUndefined();
    const bookingsRows: Array<{ id: string }> =
      bookingsBatchResponse.body.data.bookings;
    expect(bookingsRows.length).toBeGreaterThanOrEqual(2);

    expect(getCustomersByIdsSpy).toHaveBeenCalledTimes(1);
    expect(getPropertiesByIdsSpy).toHaveBeenCalledTimes(1);
    expect(getServicesByIdsSpy).toHaveBeenCalledTimes(1);
    expect(getTeamsByIdsSpy).toHaveBeenCalledTimes(1);

    getCustomersByIdsSpy.mockRestore();
    getPropertiesByIdsSpy.mockRestore();
    getServicesByIdsSpy.mockRestore();
    getTeamsByIdsSpy.mockRestore();

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
    const afterRemoveIds: string[] = afterRemoveResponse.body.data.bookings.map(
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
  });
});
