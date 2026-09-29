import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { BookingEntity } from '../src/modules/bookings/infrastructure/persistence/booking.entity';
import { PricingRulesService } from '../src/modules/catalog/application/services/pricing-rules.service';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { CleanersService } from '../src/modules/cleaners/application/services/cleaners.service';
import { TeamsService } from '../src/modules/cleaners/application/services/teams.service';
import { Cleaner } from '../src/modules/cleaners/domain/cleaner';
import { Team } from '../src/modules/cleaners/domain/team';
import { CleanerEntity } from '../src/modules/cleaners/infrastructure/persistence/cleaner.entity';
import { CustomerEntity } from '../src/modules/customers/infrastructure/persistence/customer.entity';
import { PropertyEntity } from '../src/modules/customers/infrastructure/persistence/property.entity';
import { CleaningJobEntity } from '../src/modules/jobs/infrastructure/persistence/cleaning-job.entity';
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

// Team/Cleaner tenant isolation through the real GraphQL + REST stack (#83).
// The acceptance test for the slice: list/count/filter scoping via
// `@Authorize` on `TeamType`/`CleanerType`, nullable get-by-id, relation
// safety (`Team.cleaners`, `Cleaner.team`, `CleaningJob.team`,
// `Booking.team`), cross-tenant writes as 404, per-tenant uniqueness,
// REST fail-closed, TENANT-scoped audit, and the composite-FK backstop.
//
// Self-contained: two fresh test tenants, unique-per-run rows, and every
// assertion is scoped to the ids this suite created — safe against the
// shared, non-truncated e2e database.
describe('Teams & Cleaners tenant isolation (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let teamsService: TeamsService;
  let cleanersService: CleanersService;
  let servicesService: ServicesService;
  let pricingRulesService: PricingRulesService;
  let auditEventRepository: Repository<AuditEventEntity>;

  const run = randomUUID();
  let tenantA: string;
  let tenantB: string;
  let cookieA: string;
  let cookieB: string;
  let teamA: Team;
  let teamB: Team;
  let cleanerA: Cleaner;
  let cleanerB: Cleaner;
  let customerA: CustomerEntity;
  let customerB: CustomerEntity;
  let propertyA: PropertyEntity;
  let propertyB: PropertyEntity;
  let bookableServiceA: { id: string };
  let bookableServiceB: { id: string };
  let booking: BookingEntity;
  let unassignedBooking: BookingEntity;
  let job: CleaningJobEntity;

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

  function errorStatus(response: request.Response): number | undefined {
    return (
      response.body as { errors?: { extensions?: { status?: number } }[] }
    ).errors?.[0]?.extensions?.status;
  }

  async function insertCustomerAndProperty(
    tenantId: string,
    label: string,
  ): Promise<{ customer: CustomerEntity; property: PropertyEntity }> {
    const customerRepository = dataSource.getRepository(CustomerEntity);
    const customer = await customerRepository.save(
      customerRepository.create({
        tenantId,
        email: uniqueEmail(`teams-isolation-${label.toLowerCase()}`),
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
    teamsService = moduleFixture.get(TeamsService);
    cleanersService = moduleFixture.get(CleanersService);
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

    teamA = await teamsService.createTeam({
      actorId: ownerA.id,
      tenantId: tenantA,
      name: `Alpha ${run}`,
    });
    teamB = await teamsService.createTeam({
      actorId: ownerB.id,
      tenantId: tenantB,
      name: `Bravo ${run}`,
    });
    const createdCleanerA = await cleanersService.createCleaner({
      actorId: ownerA.id,
      tenantId: tenantA,
      email: uniqueEmail('cleaner-a'),
      fullName: `Cleaner A ${run}`,
      phone: '555-0101',
    });
    cleanerA = await cleanersService.assignCleanerToTeam({
      actorId: ownerA.id,
      cleanerId: createdCleanerA.id,
      teamId: teamA.id,
      tenantId: tenantA,
    });
    const createdCleanerB = await cleanersService.createCleaner({
      actorId: ownerB.id,
      tenantId: tenantB,
      email: uniqueEmail('cleaner-b'),
      fullName: `Cleaner B ${run}`,
      phone: '555-0102',
    });
    cleanerB = await cleanersService.assignCleanerToTeam({
      actorId: ownerB.id,
      cleanerId: createdCleanerB.id,
      teamId: teamB.id,
      tenantId: tenantB,
    });

    ({ customer: customerA, property: propertyA } =
      await insertCustomerAndProperty(tenantA, 'A'));
    ({ customer: customerB, property: propertyB } =
      await insertCustomerAndProperty(tenantB, 'B'));

    // Catalog is tenant-owned as of #84: each test tenant gets its own
    // bookable service + price. Tenant A's backs the direct-insert booking
    // fixtures below; tenant B's is passed by the "createBooking with own
    // customer/property but another tenant's team" mutation (Case 5) — that
    // request must be well-formed for tenant B in every respect except the
    // foreign team, so `BookingsService`'s service/pricing checks pass and
    // the assertion actually reaches the team check it targets.
    bookableServiceA = await servicesService.createService({
      actorId: 'e2e',
      tenantId: tenantA,
      durationMinutes: 45,
      name: `Teams isolation bookable service A ${run}`,
    });
    await pricingRulesService.createPricingRule({
      actorId: 'e2e',
      serviceId: bookableServiceA.id,
      tenantId: tenantA,
      priceMinorUnits: 2500,
    });
    bookableServiceB = await servicesService.createService({
      actorId: 'e2e',
      tenantId: tenantB,
      durationMinutes: 45,
      name: `Teams isolation bookable service B ${run}`,
    });
    await pricingRulesService.createPricingRule({
      actorId: 'e2e',
      serviceId: bookableServiceB.id,
      tenantId: tenantB,
      priceMinorUnits: 2500,
    });

    // Booking/Job: both are tenant-owned (#85, #86; tenant A here), so
    // `Booking.team` and `CleaningJob.team` are root-scoping probes: B
    // cannot reach A's booking or job at all.
    const bookingRepository = dataSource.getRepository(BookingEntity);
    booking = await bookingRepository.save(
      bookingRepository.create({
        customerId: customerA.id,
        propertyId: propertyA.id,
        serviceId: bookableServiceA.id,
        teamId: teamA.id,
        tenantId: tenantA,
        pricingSnapshot: { priceMinorUnits: 2500 },
        scheduledAt: new Date('2030-01-01T09:00:00Z'),
      }),
    );
    // Dedicated, team-less booking for the cross-tenant `updateBooking`
    // write: its `teamId: null` makes the post-rejection re-read non-vacuous.
    unassignedBooking = await bookingRepository.save(
      bookingRepository.create({
        customerId: customerA.id,
        propertyId: propertyA.id,
        serviceId: bookableServiceA.id,
        teamId: null,
        tenantId: tenantA,
        pricingSnapshot: { priceMinorUnits: 2500 },
        scheduledAt: new Date('2030-01-02T09:00:00Z'),
      }),
    );
    const jobRepository = dataSource.getRepository(CleaningJobEntity);
    job = await jobRepository.save(
      jobRepository.create({
        tenantId: tenantA,
        bookingId: booking.id,
        teamId: teamA.id,
        scheduledAt: booking.scheduledAt,
      }),
    );
  });

  afterAll(async () => {
    try {
      const tenantIds = [tenantA, tenantB].filter(Boolean);
      if (dataSource && tenantIds.length > 0) {
        // `job`/`booking`/`unassignedBooking`/`bookableServiceA`/
        // `bookableServiceB` (and its pricing rule) are all owned by
        // tenant A/B, not the bootstrap tenant — `removeTestTenants`
        // deletes cleaning jobs, then bookings, then pricing rules/
        // services (FK order), so it alone covers all of them, plus every
        // Team/Cleaner/Customer/Property row under these tenants,
        // including the ones tests below create via GraphQL.
        await removeTestTenants(dataSource, tenantIds);
      }
    } finally {
      await app?.close();
    }
  });

  const TEAMS_QUERY = `
    query Teams($filter: TeamFilter) {
      teams(filter: $filter, paging: { limit: 50 }) {
        totalCount
        nodes { id }
      }
    }
  `;

  const CLEANERS_QUERY = `
    query Cleaners($filter: CleanerFilter) {
      cleaners(filter: $filter, paging: { limit: 50 }) {
        totalCount
        nodes { id }
      }
    }
  `;

  interface Page {
    totalCount: number;
    nodes: { id: string }[];
  }

  async function teamsAs(
    cookie: string,
    filter: Record<string, unknown> = {},
  ): Promise<Page> {
    const response = await gql(cookie, TEAMS_QUERY, { filter });
    expect(response.body.errors).toBeUndefined();
    return (response.body as { data: { teams: Page } }).data.teams;
  }

  async function cleanersAs(
    cookie: string,
    filter: Record<string, unknown> = {},
  ): Promise<Page> {
    const response = await gql(cookie, CLEANERS_QUERY, { filter });
    expect(response.body.errors).toBeUndefined();
    return (response.body as { data: { cleaners: Page } }).data.cleaners;
  }

  const ids = (page: Page) => page.nodes.map((node) => node.id);

  // Case 1
  it("scopes the teams/cleaners lists and counts to the caller's tenant", async () => {
    const teams = await teamsAs(cookieB);
    expect(ids(teams)).toContain(teamB.id);
    expect(ids(teams)).not.toContain(teamA.id);
    expect(teams.totalCount).toBe(teams.nodes.length);

    const cleaners = await cleanersAs(cookieB);
    expect(ids(cleaners)).toContain(cleanerB.id);
    expect(ids(cleaners)).not.toContain(cleanerA.id);
    expect(cleaners.totalCount).toBe(cleaners.nodes.length);
  });

  // Case 2 (Review Focus 1): a client filter can only narrow, never widen.
  it("returns empty for a filter naming another tenant's team/cleaner", async () => {
    const byId = await teamsAs(cookieB, { id: { eq: teamA.id } });
    expect(byId).toEqual({ totalCount: 0, nodes: [] });

    const byName = await teamsAs(cookieB, { name: { eq: teamA.name } });
    expect(byName).toEqual({ totalCount: 0, nodes: [] });

    const byEmail = await cleanersAs(cookieB, {
      email: { eq: cleanerA.email },
    });
    expect(byEmail).toEqual({ totalCount: 0, nodes: [] });
  });

  // Case 3
  it("returns null (no error) for team(id)/cleaner(id) of another tenant's row", async () => {
    const teamResponse = await gql(
      cookieB,
      `query Team($id: ID!) { team(id: $id) { id } }`,
      { id: teamA.id },
    );
    expect(teamResponse.body.errors).toBeUndefined();
    expect(teamResponse.body.data.team).toBeNull();

    const cleanerResponse = await gql(
      cookieB,
      `query Cleaner($id: ID!) { cleaner(id: $id) { id } }`,
      { id: cleanerA.id },
    );
    expect(cleanerResponse.body.errors).toBeUndefined();
    expect(cleanerResponse.body.data.cleaner).toBeNull();
  });

  // Case 4 (Review Focus 2): relation safety.
  describe('relation safety', () => {
    const TEAM_CLEANERS_QUERY = `
      query TeamCleaners($id: ID!) {
        teams(filter: { id: { eq: $id } }) {
          nodes { id cleaners { nodes { id } } }
        }
      }
    `;

    it('Team.cleaners returns exactly the own-tenant members', async () => {
      const responseA = await gql(cookieA, TEAM_CLEANERS_QUERY, {
        id: teamA.id,
      });
      expect(responseA.body.errors).toBeUndefined();
      expect(responseA.body.data.teams.nodes).toEqual([
        { id: teamA.id, cleaners: { nodes: [{ id: cleanerA.id }] } },
      ]);

      const responseB = await gql(cookieB, TEAM_CLEANERS_QUERY, {
        id: teamB.id,
      });
      expect(responseB.body.errors).toBeUndefined();
      expect(responseB.body.data.teams.nodes).toEqual([
        { id: teamB.id, cleaners: { nodes: [{ id: cleanerB.id }] } },
      ]);
    });

    it('Cleaner.team resolves the own-tenant team', async () => {
      const response = await gql(
        cookieA,
        `query Cleaner($id: ID!) { cleaner(id: $id) { id team { id } } }`,
        { id: cleanerA.id },
      );
      expect(response.body.errors).toBeUndefined();
      expect(response.body.data.cleaner.team).toEqual({ id: teamA.id });
    });

    // #86: the job is tenant-owned, so B does not see A's job at all
    // (replaces the #83 interim "team is null" relation probe).
    it("B cannot see another tenant's job (and so not its team)", async () => {
      const JOB_QUERY = `query Job($id: ID!) { job(id: $id) { id team { id } } }`;

      const responseB = await gql(cookieB, JOB_QUERY, { id: job.id });
      expect(responseB.body.errors).toBeUndefined();
      expect(responseB.body.data.job).toBeNull();
      expect(JSON.stringify(responseB.body)).not.toContain(teamA.id);

      const responseA = await gql(cookieA, JOB_QUERY, { id: job.id });
      expect(responseA.body.errors).toBeUndefined();
      expect(responseA.body.data.job).toEqual({
        id: job.id,
        team: { id: teamA.id },
      });
    });

    it("Booking.team is null for another tenant's team", async () => {
      const BOOKING_QUERY = `
        query Bookings($id: ID!) {
          bookings(filter: { id: { eq: $id } }) {
            nodes { id team { id } }
          }
        }
      `;

      // Booking is tenant-owned as of #85: the root itself excludes A's
      // booking for B, not merely `Booking.team`.
      const responseB = await gql(cookieB, BOOKING_QUERY, { id: booking.id });
      expect(responseB.body.errors).toBeUndefined();
      expect(responseB.body.data.bookings.nodes).toEqual([]);

      const responseA = await gql(cookieA, BOOKING_QUERY, { id: booking.id });
      expect(responseA.body.errors).toBeUndefined();
      expect(responseA.body.data.bookings.nodes).toEqual([
        { id: booking.id, team: { id: teamA.id } },
      ]);
    });
  });

  // Case 5: cross-tenant writes look exactly like a missing row (404).
  describe('cross-tenant writes', () => {
    it('updateCleaner on another tenant’s cleaner is 404 and changes nothing', async () => {
      const response = await gql(
        cookieB,
        `mutation UpdateCleaner($id: ID!, $input: UpdateCleanerInput!) {
          updateCleaner(id: $id, input: $input) { id }
        }`,
        { id: cleanerA.id, input: { phone: '555-9999' } },
      );
      expect(response.body.errors).toBeDefined();
      expect(errorStatus(response)).toBe(404);

      const stillA = await dataSource
        .getRepository(CleanerEntity)
        .findOneByOrFail({ id: cleanerA.id });
      expect(stillA.phone).toBe(cleanerA.phone);
      expect(stillA.teamId).toBe(teamA.id);
    });

    it.each([
      ['own cleaner into a foreign team', () => [cleanerB.id, teamA.id]],
      ['foreign cleaner into an own team', () => [cleanerA.id, teamB.id]],
    ] as const)(
      'assignCleanerToTeam with %s is 404 and changes nothing',
      async (_label, args) => {
        const [cleanerId, teamId] = args();
        const response = await gql(
          cookieB,
          `mutation Assign($cleanerId: ID!, $teamId: ID!) {
            assignCleanerToTeam(cleanerId: $cleanerId, teamId: $teamId) { id }
          }`,
          { cleanerId, teamId },
        );
        expect(response.body.errors).toBeDefined();
        expect(errorStatus(response)).toBe(404);

        const cleanerRepository = dataSource.getRepository(CleanerEntity);
        expect(
          (await cleanerRepository.findOneByOrFail({ id: cleanerA.id })).teamId,
        ).toBe(teamA.id);
        expect(
          (await cleanerRepository.findOneByOrFail({ id: cleanerB.id })).teamId,
        ).toBe(teamB.id);
      },
    );

    it("assignTeamToJob with another tenant's team is 404 and changes nothing", async () => {
      // Assigning A's own team to A's job from B: B can name neither (the
      // team lookup and, since #86, the job lookup are tenant-scoped), so it
      // is a missing row. B's own job + A's team is covered by the #86
      // jobs-checklists isolation suite.
      const response = await gql(
        cookieB,
        `mutation AssignTeamToJob($input: AssignTeamToJobInput!) {
          assignTeamToJob(input: $input) { id }
        }`,
        { input: { jobId: job.id, teamId: teamA.id } },
      );
      expect(response.body.errors).toBeDefined();
      expect(errorStatus(response)).toBe(404);

      const stillJob = await dataSource
        .getRepository(CleaningJobEntity)
        .findOneByOrFail({ id: job.id });
      expect(stillJob.teamId).toBe(teamA.id);
    });

    it("updateBooking with another tenant's team is 404", async () => {
      const response = await gql(
        cookieB,
        `mutation UpdateBooking($input: UpdateBookingInput!) {
          updateBooking(updateBookingInput: $input) { id }
        }`,
        { input: { id: unassignedBooking.id, teamId: teamA.id } },
      );
      expect(response.body.errors).toBeDefined();
      expect(errorStatus(response)).toBe(404);
      expect(response.body.errors[0].message).toContain(
        `Team ${teamA.id} not found`,
      );

      const stillUnassigned = await dataSource
        .getRepository(BookingEntity)
        .findOneByOrFail({ id: unassignedBooking.id });
      expect(stillUnassigned.teamId).toBeNull();
    });

    it("createBooking with own customer/property but another tenant's team is 404", async () => {
      const response = await gql(
        cookieB,
        `mutation CreateBooking($input: CreateBookingInput!) {
          createBooking(createBookingInput: $input) { id }
        }`,
        {
          input: {
            customerId: customerB.id,
            propertyId: propertyB.id,
            serviceId: bookableServiceB.id,
            teamId: teamA.id,
            scheduledAt: '2030-02-01T09:00:00.000Z',
          },
        },
      );
      expect(response.body.errors).toBeDefined();
      expect(errorStatus(response)).toBe(404);
      expect(response.body.errors[0].message).toContain(
        `Team ${teamA.id} not found`,
      );
      const persisted = await dataSource
        .getRepository(BookingEntity)
        .findOneBy({ customerId: customerB.id });
      expect(persisted).toBeNull();
    });
  });

  // Case 6 (Review Focus 4): uniqueness is per tenant and case-sensitive.
  describe('per-tenant uniqueness', () => {
    const CREATE_TEAM_MUTATION = `
      mutation CreateTeam($input: CreateTeamInput!) {
        createTeam(input: $input) { id name }
      }
    `;

    const CREATE_CLEANER_MUTATION = `
      mutation CreateCleaner($input: CreateCleanerInput!) {
        createCleaner(input: $input) { id email }
      }
    `;

    it('allows the same team name in two tenants, rejects it within one, and is case-sensitive', async () => {
      const name = `Shared ${run}`;

      const inA = await gql(cookieA, CREATE_TEAM_MUTATION, {
        input: { name },
      });
      expect(inA.body.errors).toBeUndefined();
      expect(inA.body.data.createTeam.name).toBe(name);

      const inB = await gql(cookieB, CREATE_TEAM_MUTATION, {
        input: { name },
      });
      expect(inB.body.errors).toBeUndefined();
      expect(inB.body.data.createTeam.name).toBe(name);

      const againInA = await gql(cookieA, CREATE_TEAM_MUTATION, {
        input: { name },
      });
      expect(againInA.body.errors).toBeDefined();
      expect(errorStatus(againInA)).toBe(409);
      expect(againInA.body.errors[0].message).toBe(
        'Team name is already in use',
      );

      const caseVariant = await gql(cookieA, CREATE_TEAM_MUTATION, {
        input: { name: `shared ${run}` },
      });
      expect(caseVariant.body.errors).toBeUndefined();
      expect(caseVariant.body.data.createTeam.name).toBe(`shared ${run}`);
    });

    it('allows the same cleaner email in two tenants and rejects it within one', async () => {
      const email = uniqueEmail('shared-cleaner');
      const input = { email, fullName: `Shared Cleaner ${run}`, phone: '555' };

      const inA = await gql(cookieA, CREATE_CLEANER_MUTATION, { input });
      expect(inA.body.errors).toBeUndefined();
      expect(inA.body.data.createCleaner.email).toBe(email);

      const inB = await gql(cookieB, CREATE_CLEANER_MUTATION, { input });
      expect(inB.body.errors).toBeUndefined();
      expect(inB.body.data.createCleaner.email).toBe(email);

      const againInA = await gql(cookieA, CREATE_CLEANER_MUTATION, { input });
      expect(againInA.body.errors).toBeDefined();
      expect(errorStatus(againInA)).toBe(409);
      expect(againInA.body.errors[0].message).toBe('Email is already in use');
    });
  });

  // Case 7 (#85 Slice decision 3): REST is now authenticated and
  // tenant-scoped like GraphQL — an authenticated caller naming another
  // tenant's team gets the same 404 GraphQL does, not a special
  // unauthenticated-fails-closed case.
  describe('REST cross-tenant team (authenticated)', () => {
    it("PATCH /bookings/:id with another tenant's team id is 404 and leaves the team unchanged", async () => {
      // Uses `unassignedBooking` (teamId: null), not `booking` (teamId:
      // teamA already), so the re-read below can actually detect a leak: if
      // the PATCH wrongly applied `teamId: teamB.id`, `stillBooking.teamId`
      // would flip from null to teamB.id instead of staying null.
      const response = await request(app.getHttpServer())
        .patch(`/bookings/${unassignedBooking.id}`)
        .set('Cookie', cookieA)
        .send({ teamId: teamB.id });
      expect(response.status).toBe(404);

      const stillBooking = await dataSource
        .getRepository(BookingEntity)
        .findOneByOrFail({ id: unassignedBooking.id });
      expect(stillBooking.teamId).toBeNull();
    });

    it('PATCH /bookings/:id without a teamId still succeeds', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/bookings/${booking.id}`)
        .set('Cookie', cookieA)
        .send({ status: 'CONFIRMED' });
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('CONFIRMED');
      expect(response.body.teamId).toBe(teamA.id);
      expect(response.body).not.toHaveProperty('tenantId');
    });

    it("POST /bookings with another tenant's team id is 404", async () => {
      const response = await request(app.getHttpServer())
        .post('/bookings')
        .set('Cookie', cookieA)
        .send({
          customerId: customerA.id,
          propertyId: propertyA.id,
          serviceId: bookableServiceA.id,
          teamId: teamB.id,
          scheduledAt: '2030-03-01T09:00:00.000Z',
        });
      expect(response.status).toBe(404);
    });
  });

  // Case 8: TENANT-scoped audit for all four team/cleaner mutations.
  it("records team/cleaner audit events with the caller's tenant and TENANT scope", async () => {
    const createTeam = await gql(
      cookieA,
      `mutation CreateTeam($input: CreateTeamInput!) {
        createTeam(input: $input) { id }
      }`,
      { input: { name: `Audit ${run}` } },
    );
    expect(createTeam.body.errors).toBeUndefined();
    const auditTeamId: string = createTeam.body.data.createTeam.id;

    const createCleaner = await gql(
      cookieA,
      `mutation CreateCleaner($input: CreateCleanerInput!) {
        createCleaner(input: $input) { id }
      }`,
      {
        input: {
          email: uniqueEmail('audit-cleaner'),
          fullName: `Audit Cleaner ${run}`,
          phone: '555-0400',
        },
      },
    );
    expect(createCleaner.body.errors).toBeUndefined();
    const auditCleanerId: string = createCleaner.body.data.createCleaner.id;

    const updateCleaner = await gql(
      cookieA,
      `mutation UpdateCleaner($id: ID!, $input: UpdateCleanerInput!) {
        updateCleaner(id: $id, input: $input) { id }
      }`,
      { id: auditCleanerId, input: { phone: '555-0401' } },
    );
    expect(updateCleaner.body.errors).toBeUndefined();

    const assign = await gql(
      cookieA,
      `mutation Assign($cleanerId: ID!, $teamId: ID!) {
        assignCleanerToTeam(cleanerId: $cleanerId, teamId: $teamId) {
          id team { id }
        }
      }`,
      { cleanerId: auditCleanerId, teamId: auditTeamId },
    );
    expect(assign.body.errors).toBeUndefined();
    expect(assign.body.data.assignCleanerToTeam.team).toEqual({
      id: auditTeamId,
    });

    for (const [action, entityId] of [
      ['team.create', auditTeamId],
      ['cleaner.create', auditCleanerId],
      ['cleaner.update', auditCleanerId],
      ['cleaner.assign_team', auditCleanerId],
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

  // Case 9: the database backstop rejects a cross-tenant team reference
  // even when the application layer is bypassed.
  it('rejects a cross-tenant cleaner→team reference with fk_cleaner_team_tenant', async () => {
    await expect(
      dataSource.query(
        'UPDATE "cleaner_entity" SET "teamId" = $1 WHERE "id" = $2',
        [teamA.id, cleanerB.id],
      ),
    ).rejects.toMatchObject({
      driverError: { constraint: 'fk_cleaner_team_tenant' },
    });

    const stillB = await dataSource
      .getRepository(CleanerEntity)
      .findOneByOrFail({ id: cleanerB.id });
    expect(stillB.teamId).toBe(teamB.id);
  });
});
