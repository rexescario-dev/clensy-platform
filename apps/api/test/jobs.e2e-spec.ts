import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { assertNoPerParentChildSelect, countSqlMentioning, withCapturedSql } from './helpers/capture-sql';
import { TeamsService } from '../src/modules/cleaners/application/services/teams.service';
import { CustomersService } from '../src/modules/customers/application/services/customers.service';
import { PropertiesService } from '../src/modules/customers/application/services/properties.service';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { JobsService } from '../src/modules/jobs/application/services/jobs.service';
import { DEFAULT_CHECKLIST_ITEMS } from '../src/modules/jobs/domain/default-checklist-items';
import { AdminUserEntity } from '../src/modules/admins/infrastructure/persistence/admin-user.entity';
import { Role } from '../src/platform/auth/domain/role';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import { seedOwner } from './helpers/seed-owner';

// GraphQL e2e against AppModule (plan Task 6): golden path, RBAC, missing
// job query-vs-mutation, N+1 batch spies, completed-booking create,
// duplicate Conflict, cancelled BadRequest, removeBooking FK Conflict.
// Unique-per-run fixtures; no truncation (`maxWorkers: 1` in jest-e2e.json).
describe('Jobs (e2e)', () => {
  let app: INestApplication<App>;
  let adminUserRepository: Repository<AdminUserEntity>;
  let customersService: CustomersService;
  let propertiesService: PropertiesService;
  let servicesService: ServicesService;
  let teamsService: TeamsService;
  let jobsService: JobsService;
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
    customersService = moduleFixture.get(CustomersService);
    propertiesService = moduleFixture.get(PropertiesService);
    servicesService = moduleFixture.get(ServicesService);
    teamsService = moduleFixture.get(TeamsService);
    jobsService = moduleFixture.get(JobsService, { strict: false });
    dataSource = moduleFixture.get(DataSource);
  }, 30000);

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
      createBooking(createBookingInput: $input) { id scheduledAt status }
    }
  `;

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

  const JOB_FIELDS = `
    id
    scheduledAt
    status
    createdAt
    updatedAt
    booking {
      id
      scheduledAt
      status
      customer { id fullName }
      property { id addressLine1 }
      service { id name }
      team { id name }
    }
    team { id name }
    checklist {
      id
      items { nodes { id label position completed completedAt } }
    }
  `;

  const CREATE_JOB_MUTATION = `
    mutation CreateJobFromBooking($input: CreateJobFromBookingInput!) {
      createJobFromBooking(input: $input) { ${JOB_FIELDS} }
    }
  `;

  const ASSIGN_TEAM_MUTATION = `
    mutation AssignTeamToJob($input: AssignTeamToJobInput!) {
      assignTeamToJob(input: $input) { ${JOB_FIELDS} }
    }
  `;

  const COMPLETE_ITEM_MUTATION = `
    mutation CompleteChecklistItem($input: CompleteChecklistItemInput!) {
      completeChecklistItem(input: $input) { ${JOB_FIELDS} }
    }
  `;

  const COMPLETE_JOB_MUTATION = `
    mutation CompleteJob($input: CompleteJobInput!) {
      completeJob(input: $input) { ${JOB_FIELDS} }
    }
  `;

  const JOB_QUERY = `
    query Job($id: ID!) {
      job(id: $id) { ${JOB_FIELDS} }
    }
  `;

  const JOBS_QUERY = `
    query Jobs {
      jobs { nodes { ${JOB_FIELDS} } }
    }
  `;

  const JOBS_N_PLUS_ONE_QUERY = `
    query JobsNPlusOne {
      jobs {
        nodes {
          booking { id }
          team { name }
          checklist { items { nodes { label } } }
        }
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

  async function createFixture(runId: string) {
    const customer = await customersService.create({
      actorId: 'e2e',
      fullName: `Jobs Fixture Customer ${runId}`,
      email: `jobs-fixture-${runId}@example.com`,
      phone: '555-0100',
    });
    const property = await propertiesService.create({
      actorId: 'e2e',
      customerId: customer.id,
      label: 'Home',
      addressLine1: `${runId} Jobs St`,
      city: 'City',
      region: 'Region',
      postalCode: '00000',
    });
    const service = await servicesService.createService({
      actorId: 'e2e',
      name: `Jobs Fixture Service ${runId}`,
      durationMinutes: 60,
    });
    const team = await teamsService.createTeam({
      actorId: 'e2e',
      name: `Jobs Fixture Team ${runId}`,
    });
    return { customer, property, service, team };
  }

  async function createPricedBooking(
    sessionCookie: string,
    runId: string,
    scheduledAt = '2026-09-01T09:00:00.000Z',
  ) {
    const fixture = await createFixture(runId);
    const pricingResponse = await authedRequest(sessionCookie).send({
      query: `mutation CreatePricingRule($input: CreatePricingRuleInput!) {
        createPricingRule(input: $input) { id }
      }`,
      variables: {
        input: { serviceId: fixture.service.id, priceMinorUnits: 5000 },
      },
    });
    expect(pricingResponse.body.errors).toBeUndefined();

    const bookingResponse = await authedRequest(sessionCookie).send({
      query: CREATE_BOOKING_MUTATION,
      variables: {
        input: {
          customerId: fixture.customer.id,
          propertyId: fixture.property.id,
          serviceId: fixture.service.id,
          teamId: fixture.team.id,
          scheduledAt,
        },
      },
    });
    expect(bookingResponse.body.errors).toBeUndefined();
    return {
      ...fixture,
      bookingId: bookingResponse.body.data.createBooking.id as string,
      scheduledAt,
    };
  }

  it('proves the full Jobs GraphQL E2E acceptance scenario', async () => {
    const owner = await seedOwner(adminUserRepository);
    const runId = owner.id;

    const ownerLoginResponse = await login(owner.email, owner.password);
    expect(ownerLoginResponse.body.errors).toBeUndefined();
    const ownerSessionCookie = extractSessionCookie(ownerLoginResponse);

    // --- Step 1: golden path — booking → createJobFromBooking → complete
    // every item → completeJob (spec §2 / plan Task 6). ---
    const golden = await createPricedBooking(ownerSessionCookie, runId);

    const createJobResponse = await authedRequest(ownerSessionCookie).send({
      query: CREATE_JOB_MUTATION,
      variables: { input: { bookingId: golden.bookingId } },
    });
    expect(createJobResponse.body.errors).toBeUndefined();
    const createdJob = createJobResponse.body.data.createJobFromBooking;
    expect(createdJob.status).toBe('PENDING');
    expect(createdJob.scheduledAt).toBe(golden.scheduledAt);
    expect(createdJob.booking.id).toBe(golden.bookingId);
    expect(createdJob.team).toEqual({
      id: golden.team.id,
      name: golden.team.name,
    });
    expect(createdJob.checklist.items.nodes).toHaveLength(3);
    expect(
      createdJob.checklist.items.nodes.map(
        (item: { position: number; label: string; completed: boolean }) => ({
          position: item.position,
          label: item.label,
          completed: item.completed,
        }),
      ),
    ).toEqual(
      DEFAULT_CHECKLIST_ITEMS.map((item) => ({
        position: item.position,
        label: item.label,
        completed: false,
      })),
    );
    const jobId: string = createdJob.id;
    const itemIds: string[] = createdJob.checklist.items.nodes.map(
      (item: { id: string }) => item.id,
    );

    let currentJob = createdJob;
    for (let index = 0; index < itemIds.length; index += 1) {
      const completeItemResponse = await authedRequest(ownerSessionCookie).send(
        {
          query: COMPLETE_ITEM_MUTATION,
          variables: { input: { jobId, itemId: itemIds[index] } },
        },
      );
      expect(completeItemResponse.body.errors).toBeUndefined();
      currentJob = completeItemResponse.body.data.completeChecklistItem;
      expect(currentJob.status).toBe('IN_PROGRESS');
      expect(
        currentJob.checklist.items.nodes.filter(
          (item: { completed: boolean }) => item.completed,
        ),
      ).toHaveLength(index + 1);
    }

    const completeJobResponse = await authedRequest(ownerSessionCookie).send({
      query: COMPLETE_JOB_MUTATION,
      variables: { input: { id: jobId } },
    });
    expect(completeJobResponse.body.errors).toBeUndefined();
    const completedJob = completeJobResponse.body.data.completeJob;
    expect(completedJob.status).toBe('COMPLETED');
    expect(
      completedJob.checklist.items.nodes.every(
        (item: { completed: boolean }) => item.completed === true,
      ),
    ).toBe(true);

    const jobQueryResponse = await authedRequest(ownerSessionCookie).send({
      query: JOB_QUERY,
      variables: { id: jobId },
    });
    expect(jobQueryResponse.body.errors).toBeUndefined();
    expect(jobQueryResponse.body.data.job.status).toBe('COMPLETED');

    // --- Step 2: job(missing) is null; mutation missing job is GraphQL
    // NotFound (404), never a null payload (spec §4.2 / §4.5). ---
    const missingJobId = '00000000-0000-0000-0003-000000000099';
    const missingQueryResponse = await authedRequest(ownerSessionCookie).send({
      query: JOB_QUERY,
      variables: { id: missingJobId },
    });
    expect(missingQueryResponse.body.errors).toBeUndefined();
    expect(missingQueryResponse.body.data.job).toBeNull();

    const missingMutationResponse = await authedRequest(
      ownerSessionCookie,
    ).send({
      query: COMPLETE_JOB_MUTATION,
      variables: { input: { id: missingJobId } },
    });
    expect(missingMutationResponse.body.data?.completeJob).toBeUndefined();
    const missingMutationError = missingMutationResponse.body.errors?.[0];
    expect(missingMutationError?.extensions?.status).toBe(404);
    expect(missingMutationError?.message).toContain(
      `Job ${missingJobId} not found`,
    );

    // --- Step 3: create from COMPLETED booking succeeds; duplicate
    // create is Conflict; cancelled booking is BadRequest; removeBooking
    // of a booking-with-job is Conflict (spec §2). ---
    const completedSource = await createPricedBooking(
      ownerSessionCookie,
      `${runId}-completed`,
    );
    const markCompletedResponse = await authedRequest(ownerSessionCookie).send({
      query: UPDATE_BOOKING_MUTATION,
      variables: {
        input: { id: completedSource.bookingId, status: 'COMPLETED' },
      },
    });
    expect(markCompletedResponse.body.errors).toBeUndefined();

    const completedBookingJobResponse = await authedRequest(
      ownerSessionCookie,
    ).send({
      query: CREATE_JOB_MUTATION,
      variables: { input: { bookingId: completedSource.bookingId } },
    });
    expect(completedBookingJobResponse.body.errors).toBeUndefined();
    expect(
      completedBookingJobResponse.body.data.createJobFromBooking.status,
    ).toBe('PENDING');

    const duplicateResponse = await authedRequest(ownerSessionCookie).send({
      query: CREATE_JOB_MUTATION,
      variables: { input: { bookingId: completedSource.bookingId } },
    });
    expect(duplicateResponse.body.data?.createJobFromBooking).toBeUndefined();
    const duplicateError = duplicateResponse.body.errors?.[0];
    expect(duplicateError?.extensions?.status).toBe(409);
    expect(duplicateError?.message).toContain(
      'A job already exists for this booking',
    );

    const cancelledSource = await createPricedBooking(
      ownerSessionCookie,
      `${runId}-cancelled`,
    );
    const markCancelledResponse = await authedRequest(ownerSessionCookie).send({
      query: UPDATE_BOOKING_MUTATION,
      variables: {
        input: { id: cancelledSource.bookingId, status: 'CANCELLED' },
      },
    });
    expect(markCancelledResponse.body.errors).toBeUndefined();

    const cancelledJobResponse = await authedRequest(ownerSessionCookie).send({
      query: CREATE_JOB_MUTATION,
      variables: { input: { bookingId: cancelledSource.bookingId } },
    });
    expect(
      cancelledJobResponse.body.data?.createJobFromBooking,
    ).toBeUndefined();
    expect(cancelledJobResponse.body.errors?.[0]?.message).toContain(
      'Cannot create a job from a cancelled booking',
    );

    const removeWithJobResponse = await authedRequest(ownerSessionCookie).send({
      query: REMOVE_BOOKING_MUTATION,
      variables: { id: completedSource.bookingId },
    });
    expect(removeWithJobResponse.body.data?.removeBooking).toBeUndefined();
    const removeWithJobError = removeWithJobResponse.body.errors?.[0];
    expect(removeWithJobError?.extensions?.status).toBe(409);
    expect(removeWithJobError?.message).toContain(
      'Booking cannot be deleted because other records reference it',
    );

    // --- Step 4: N+1 spies — jobs { booking, team, checklist.items } over
    // N jobs is O(1) in N (spec §4.5). Spies wrap real implementations. ---
    const n1a = await createPricedBooking(ownerSessionCookie, `${runId}-n1a`);
    const n1b = await createPricedBooking(ownerSessionCookie, `${runId}-n1b`);
    const n1aJobResponse = await authedRequest(ownerSessionCookie).send({
      query: CREATE_JOB_MUTATION,
      variables: { input: { bookingId: n1a.bookingId } },
    });
    const n1bJobResponse = await authedRequest(ownerSessionCookie).send({
      query: CREATE_JOB_MUTATION,
      variables: { input: { bookingId: n1b.bookingId } },
    });
    expect(n1aJobResponse.body.errors).toBeUndefined();
    expect(n1bJobResponse.body.errors).toBeUndefined();
    const n1aJob = n1aJobResponse.body.data.createJobFromBooking;
    const n1bJob = n1bJobResponse.body.data.createJobFromBooking;

    const getTeamsByIdsSpy = jest.spyOn(teamsService, 'getTeamsByIds');
    const getChecklistsByJobIdsSpy = jest.spyOn(
      jobsService,
      'getChecklistsByJobIds',
    );

    const nPlusOneResponse = await authedRequest(ownerSessionCookie).send({
      query: JOBS_N_PLUS_ONE_QUERY,
    });
    expect(nPlusOneResponse.body.errors).toBeUndefined();
    const jobsRows: Array<{ booking: { id: string } }> =
      nPlusOneResponse.body.data.jobs.nodes;
    expect(jobsRows.length).toBeGreaterThanOrEqual(2);

    expect(getTeamsByIdsSpy).toHaveBeenCalledTimes(1);
    expect(getTeamsByIdsSpy.mock.calls[0][0]).toEqual(
      expect.arrayContaining([n1a.team.id, n1b.team.id]),
    );
    expect(getChecklistsByJobIdsSpy).toHaveBeenCalledTimes(1);
    expect(getChecklistsByJobIdsSpy.mock.calls[0][0]).toEqual(
      expect.arrayContaining([n1aJob.id, n1bJob.id]),
    );

    getTeamsByIdsSpy.mockRestore();
    getChecklistsByJobIdsSpy.mockRestore();

    const { result: nestedCustomerResponse, queries: nestedCustomerQueries } =
      await withCapturedSql(dataSource, () =>
        authedRequest(ownerSessionCookie).send({
          query: `query JobsNestedBookingCustomer {
        jobs { nodes { booking { customer { fullName } } } }
      }`,
        }),
      );
    expect(nestedCustomerResponse.body.errors).toBeUndefined();
    const nestedJobCount = nestedCustomerResponse.body.data.jobs.nodes
      .length as number;
    expect(nestedJobCount).toBeGreaterThanOrEqual(2);
    const customerSqlCount = countSqlMentioning(
      nestedCustomerQueries,
      'customer_entity',
    );
    expect(customerSqlCount).toBeGreaterThan(0);
    expect(customerSqlCount).toBeLessThan(nestedJobCount);

    // --- Step 5: RBAC — view all six roles; create Owner/Ops/Scheduler/CS;
    // assign/complete Owner/Ops/Scheduler only (spec §4.3). ---
    const opsEmail = `ops-${runId}@example.com`;
    const opsPassword = 'ops-pw-12345';
    await createAdmin(
      ownerSessionCookie,
      opsEmail,
      opsPassword,
      Role.OPS_MANAGER,
    );

    const schedulerEmail = `scheduler-${runId}@example.com`;
    const schedulerPassword = 'scheduler-pw-12345';
    await createAdmin(
      ownerSessionCookie,
      schedulerEmail,
      schedulerPassword,
      Role.SCHEDULER,
    );

    const customerSupportEmail = `cs-${runId}@example.com`;
    const customerSupportPassword = 'cs-pw-12345';
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

    const viewRoles = [
      { email: opsEmail, password: opsPassword },
      { email: schedulerEmail, password: schedulerPassword },
      { email: customerSupportEmail, password: customerSupportPassword },
      { email: financeEmail, password: financePassword },
      { email: analystEmail, password: analystPassword },
    ];
    for (const { email, password } of viewRoles) {
      const loginResponse = await login(email, password);
      const sessionCookie = extractSessionCookie(loginResponse);
      const readResponse = await authedRequest(sessionCookie).send({
        query: JOBS_QUERY,
      });
      expect(readResponse.body.errors).toBeUndefined();
      expect(Array.isArray(readResponse.body.data.jobs.nodes)).toBe(true);
    }

    const createAllowed = [
      { email: opsEmail, password: opsPassword, tag: 'ops' },
      { email: schedulerEmail, password: schedulerPassword, tag: 'sch' },
      {
        email: customerSupportEmail,
        password: customerSupportPassword,
        tag: 'cs',
      },
    ];
    const createdByRole: Record<
      string,
      { jobId: string; itemId: string; teamId: string }
    > = {};
    for (const { email, password, tag } of createAllowed) {
      const source = await createPricedBooking(
        ownerSessionCookie,
        `${runId}-rbac-${tag}`,
      );
      const loginResponse = await login(email, password);
      const sessionCookie = extractSessionCookie(loginResponse);
      const writeResponse = await authedRequest(sessionCookie).send({
        query: CREATE_JOB_MUTATION,
        variables: { input: { bookingId: source.bookingId } },
      });
      expect(writeResponse.body.errors).toBeUndefined();
      expect(writeResponse.body.data.createJobFromBooking.id).toBeDefined();
      createdByRole[tag] = {
        jobId: writeResponse.body.data.createJobFromBooking.id,
        itemId:
          writeResponse.body.data.createJobFromBooking.checklist.items.nodes[0].id,
        teamId: source.team.id,
      };
    }

    const createDenied = [
      { email: financeEmail, password: financePassword },
      { email: analystEmail, password: analystPassword },
    ];
    for (const { email, password } of createDenied) {
      const source = await createPricedBooking(
        ownerSessionCookie,
        `${runId}-rbac-denied-${email.split('@')[0]}`,
      );
      const loginResponse = await login(email, password);
      const sessionCookie = extractSessionCookie(loginResponse);
      const writeDeniedResponse = await authedRequest(sessionCookie).send({
        query: CREATE_JOB_MUTATION,
        variables: { input: { bookingId: source.bookingId } },
      });
      expect(
        writeDeniedResponse.body.data?.createJobFromBooking,
      ).toBeUndefined();
      expect(writeDeniedResponse.body.errors?.[0]?.extensions?.code).toBe(
        'FORBIDDEN',
      );
    }

    const executeAllowedLogin = await login(schedulerEmail, schedulerPassword);
    const executeAllowedCookie = extractSessionCookie(executeAllowedLogin);
    const assignAllowedResponse = await authedRequest(
      executeAllowedCookie,
    ).send({
      query: ASSIGN_TEAM_MUTATION,
      variables: {
        input: {
          jobId: createdByRole.sch.jobId,
          teamId: createdByRole.sch.teamId,
        },
      },
    });
    expect(assignAllowedResponse.body.errors).toBeUndefined();

    const executeDenied = [
      {
        email: customerSupportEmail,
        password: customerSupportPassword,
      },
      { email: financeEmail, password: financePassword },
      { email: analystEmail, password: analystPassword },
    ];
    for (const { email, password } of executeDenied) {
      const loginResponse = await login(email, password);
      const sessionCookie = extractSessionCookie(loginResponse);
      const assignDenied = await authedRequest(sessionCookie).send({
        query: ASSIGN_TEAM_MUTATION,
        variables: {
          input: {
            jobId: createdByRole.cs.jobId,
            teamId: createdByRole.cs.teamId,
          },
        },
      });
      expect(assignDenied.body.data?.assignTeamToJob).toBeUndefined();
      expect(assignDenied.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');

      const completeItemDenied = await authedRequest(sessionCookie).send({
        query: COMPLETE_ITEM_MUTATION,
        variables: {
          input: {
            jobId: createdByRole.cs.jobId,
            itemId: createdByRole.cs.itemId,
          },
        },
      });
      expect(
        completeItemDenied.body.data?.completeChecklistItem,
      ).toBeUndefined();
      expect(completeItemDenied.body.errors?.[0]?.extensions?.code).toBe(
        'FORBIDDEN',
      );

      const completeJobDenied = await authedRequest(sessionCookie).send({
        query: COMPLETE_JOB_MUTATION,
        variables: { input: { id: createdByRole.cs.jobId } },
      });
      expect(completeJobDenied.body.data?.completeJob).toBeUndefined();
      expect(completeJobDenied.body.errors?.[0]?.extensions?.code).toBe(
        'FORBIDDEN',
      );
    }
  }, 120000);

  it('filters jobs by booking relation (mechanism 1) with limit 1 and loads nested items in O(1)', async () => {
    const owner = await seedOwner(adminUserRepository);
    const ownerLogin = await login(owner.email, owner.password);
    expect(ownerLogin.body.errors).toBeUndefined();
    const cookie = extractSessionCookie(ownerLogin);
    const runId = owner.id;

    const first = await createPricedBooking(cookie, `${runId}-exist-a`);
    const created = await authedRequest(cookie).send({
      query: CREATE_JOB_MUTATION,
      variables: { input: { bookingId: first.bookingId } },
    });
    expect(created.body.errors).toBeUndefined();
    const jobId = created.body.data.createJobFromBooking.id as string;

    const { result: existence, queries } = await withCapturedSql(dataSource, () =>
      authedRequest(cookie).send({
        query: `query JobByBooking($bookingId: ID!) {
          jobs(filter: { booking: { id: { eq: $bookingId } } }, paging: { limit: 1 }) {
            nodes { id }
          }
        }`,
        variables: { bookingId: first.bookingId },
      }),
    );
    expect(existence.body.errors).toBeUndefined();
    expect(existence.body.data.jobs.nodes).toHaveLength(1);
    expect(existence.body.data.jobs.nodes[0].id).toBe(jobId);
    expect(queries.some((sql) => /\blimit\b/i.test(sql))).toBe(true);

    const jobIds: string[] = [jobId];
    for (let index = 1; index < 6; index += 1) {
      const source = await createPricedBooking(cookie, `${runId}-items-${index}`);
      const jobResponse = await authedRequest(cookie).send({
        query: CREATE_JOB_MUTATION,
        variables: { input: { bookingId: source.bookingId } },
      });
      expect(jobResponse.body.errors).toBeUndefined();
      jobIds.push(jobResponse.body.data.createJobFromBooking.id);
    }

    const listParentQuery = `query ListJobs($ids: [ID!]!) {
      jobs(filter: { id: { in: $ids } }, paging: { limit: 20 }) {
        nodes {
          id
          checklist {
            items { nodes { id } pageInfo { hasNextPage } }
          }
        }
      }
    }`;

    const captureAtN = async (parentN: number, ids: string[]) => {
      const { result, queries: captured } = await withCapturedSql(
        dataSource,
        () =>
          authedRequest(cookie).send({
            query: listParentQuery,
            variables: { ids },
          }),
      );
      expect(result.body.errors).toBeUndefined();
      expect(result.body.data.jobs.nodes).toHaveLength(parentN);
      assertNoPerParentChildSelect(captured, parentN, 'checklist_item_entity');
      return captured.length;
    };

    const atSix = await captureAtN(6, jobIds);
    for (let index = 6; index < 12; index += 1) {
      const source = await createPricedBooking(cookie, `${runId}-items-${index}`);
      const jobResponse = await authedRequest(cookie).send({
        query: CREATE_JOB_MUTATION,
        variables: { input: { bookingId: source.bookingId } },
      });
      expect(jobResponse.body.errors).toBeUndefined();
      jobIds.push(jobResponse.body.data.createJobFromBooking.id);
    }
    const atTwelve = await captureAtN(12, jobIds);
    const delta = Math.abs(atTwelve - atSix);
    expect(delta === 0 || delta <= 2).toBe(true);
  }, 120000);
});
