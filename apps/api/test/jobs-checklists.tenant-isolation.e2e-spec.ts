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
import { PricingRulesService } from '../src/modules/catalog/application/services/pricing-rules.service';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { PricingUnit } from '../src/modules/catalog/domain/pricing-unit';
import { TeamsService } from '../src/modules/cleaners/application/services/teams.service';
import { CustomerEntity } from '../src/modules/customers/infrastructure/persistence/customer.entity';
import { PropertyEntity } from '../src/modules/customers/infrastructure/persistence/property.entity';
import { JobStatus } from '../src/modules/jobs/domain/job-status';
import { ChecklistEntity } from '../src/modules/jobs/infrastructure/persistence/checklist.entity';
import { ChecklistItemEntity } from '../src/modules/jobs/infrastructure/persistence/checklist-item.entity';
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

// Two-tenant isolation for CleaningJob and Checklist (#86) through the real
// GraphQL + application-service stack. Proves I-1 (a job's tenant is
// authoritative for its booking and team, a checklist's equals its job's —
// application half via cross-tenant mutations, database half via the
// composite FKs) and I-2 (the only tenant source is the authenticated
// principal), closes the three #85 residual exposures, and checks job audit
// tags (#86 Slice decision 10). ChecklistItems are owned via their
// Checklist (Slice decision 2) and are reached only through it here.
//
// Self-contained: two fresh test tenants, unique-per-run rows, assertions
// scoped to the ids this suite created. Cases are numbered as in the plan's
// Task 5 and run in order: cases 4–5 need `jobA` incomplete and untouched,
// case 9 then completes it.
describe('Jobs & Checklists tenant isolation (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let bookingsService: BookingsService;
  let auditEventRepository: Repository<AuditEventEntity>;
  let jobRepository: Repository<CleaningJobEntity>;
  let checklistRepository: Repository<ChecklistEntity>;
  let itemRepository: Repository<ChecklistItemEntity>;

  const run = randomUUID();
  let tenantA: string;
  let tenantB: string;
  let cookieA: string;
  let cookieB: string;
  let cookieSuperAdmin: string;
  let ownerAId: string;
  let ownerBId: string;
  let serviceA: { id: string };
  let serviceB: { id: string };
  let teamA: { id: string };
  let teamB: { id: string };
  let customerA: CustomerEntity;
  let customerB: CustomerEntity;
  let propertyA: PropertyEntity;
  let propertyB: PropertyEntity;
  let bookingA: { id: string; status: string; scheduledAt: Date };
  let jobA: { id: string };
  let jobB: { id: string };
  let checklistA: ChecklistEntity;
  let itemsA: ChecklistItemEntity[];

  const LOGIN_MUTATION = `
    mutation Login($input: LoginInput!) {
      login(loginInput: $input) { success }
    }
  `;
  const CREATE_JOB_MUTATION = `
    mutation CreateJobFromBooking($input: CreateJobFromBookingInput!) {
      createJobFromBooking(input: $input) { id }
    }
  `;
  const ASSIGN_TEAM_MUTATION = `
    mutation AssignTeamToJob($input: AssignTeamToJobInput!) {
      assignTeamToJob(input: $input) { id }
    }
  `;
  const COMPLETE_ITEM_MUTATION = `
    mutation CompleteChecklistItem($input: CompleteChecklistItemInput!) {
      completeChecklistItem(input: $input) { id status }
    }
  `;
  const COMPLETE_JOB_MUTATION = `
    mutation CompleteJob($input: CompleteJobInput!) {
      completeJob(input: $input) { id status }
    }
  `;
  const JOBS_QUERY = `
    query Jobs($filter: CleaningJobFilter) {
      jobs(filter: $filter, paging: { limit: 50 }) {
        totalCount
        nodes { id }
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
    headers: Record<string, string> = {},
  ) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', cookie)
      .set(headers)
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
        email: uniqueEmail(`job-isolation-${label.toLowerCase()}`),
        fullName: `Job Customer ${label} ${run}`,
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

  function createBooking(tenant: 'A' | 'B', scheduledAt: string) {
    return tenant === 'A'
      ? bookingsService.create({
          actorId: ownerAId,
          customerId: customerA.id,
          propertyId: propertyA.id,
          serviceId: serviceA.id,
          teamId: teamA.id,
          tenantId: tenantA,
          scheduledAt: new Date(scheduledAt),
        })
      : bookingsService.create({
          actorId: ownerBId,
          customerId: customerB.id,
          propertyId: propertyB.id,
          serviceId: serviceB.id,
          teamId: teamB.id,
          tenantId: tenantB,
          scheduledAt: new Date(scheduledAt),
        });
  }

  async function createJobAs(cookie: string, bookingId: string) {
    const res = await gql(cookie, CREATE_JOB_MUTATION, {
      input: { bookingId },
    });
    expect(res.body.errors).toBeUndefined();
    return { id: res.body.data.createJobFromBooking.id as string };
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
    const servicesService = moduleFixture.get(ServicesService);
    const pricingRulesService = moduleFixture.get(PricingRulesService);
    const teamsService = moduleFixture.get(TeamsService);
    auditEventRepository = moduleFixture.get(
      getRepositoryToken(AuditEventEntity),
    );
    jobRepository = moduleFixture.get(getRepositoryToken(CleaningJobEntity));
    checklistRepository = dataSource.getRepository(ChecklistEntity);
    itemRepository = dataSource.getRepository(ChecklistItemEntity);

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
    const superAdmin = await seedSuperAdmin(dataSource);
    ownerAId = ownerA.id;
    ownerBId = ownerB.id;
    cookieA = await loginAs(ownerA.email, ownerA.password);
    cookieB = await loginAs(ownerB.email, ownerB.password);
    cookieSuperAdmin = await loginAs(superAdmin.email, superAdmin.password);

    serviceA = await servicesService.createService({
      actorId: ownerAId,
      tenantId: tenantA,
      durationMinutes: 45,
      name: `Job Clean A ${run}`,
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
      name: `Job Clean B ${run}`,
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
      name: `Job Team A ${run}`,
    });
    teamB = await teamsService.createTeam({
      actorId: ownerBId,
      tenantId: tenantB,
      name: `Job Team B ${run}`,
    });
    ({ customer: customerA, property: propertyA } =
      await insertCustomerAndProperty(tenantA, 'A'));
    ({ customer: customerB, property: propertyB } =
      await insertCustomerAndProperty(tenantB, 'B'));

    bookingA = await createBooking('A', '2031-03-01T09:00:00Z');
    const bookingB = await createBooking('B', '2031-03-02T09:00:00Z');
    jobA = await createJobAs(cookieA, bookingA.id);
    jobB = await createJobAs(cookieB, bookingB.id);
    checklistA = await checklistRepository.findOneByOrFail({ jobId: jobA.id });
    itemsA = await itemRepository.find({
      where: { checklistId: checklistA.id },
      order: { position: 'ASC' },
    });
    expect(itemsA).toHaveLength(3);
  });

  afterAll(async () => {
    try {
      if (dataSource) {
        await auditEventRepository.delete({
          actorId: In([ownerAId, ownerBId]),
        });
        // Jobs (and their checklists/items), bookings, catalog and teams of
        // tenantA/tenantB are removed by `removeTestTenants`.
        await removeTestTenants(dataSource, [tenantA, tenantB]);
      }
    } finally {
      await app?.close();
    }
  });

  // Case 1: root scoping.
  describe('Case 1: root scoping', () => {
    it('jobs lists and counts only the caller tenant', async () => {
      const filter = { id: { in: [jobA.id, jobB.id] } };
      const asB = await gql(cookieB, JOBS_QUERY, { filter });
      expect(asB.body.errors).toBeUndefined();
      expect(asB.body.data.jobs).toEqual({
        totalCount: 1,
        nodes: [{ id: jobB.id }],
      });
      const asA = await gql(cookieA, JOBS_QUERY, { filter });
      expect(asA.body.data.jobs).toEqual({
        totalCount: 1,
        nodes: [{ id: jobA.id }],
      });
    });

    it("job(id) for another tenant's job is null, exactly like a nonexistent id", async () => {
      const JOB = `query($id: ID!){ job(id: $id) { id } }`;
      const foreign = await gql(cookieB, JOB, { id: jobA.id });
      const missing = await gql(cookieB, JOB, { id: randomUUID() });
      expect(foreign.body).toEqual({ data: { job: null } });
      expect(missing.body).toEqual({ data: { job: null } });
    });
  });

  // Case 2: relation-filter oracle (closes the #85 residual).
  describe('Case 2: relation filters cannot probe another tenant', () => {
    const filters = (): [string, Record<string, unknown>][] => [
      ['booking.id', { booking: { id: { eq: bookingA.id } } }],
      [
        'booking.status + id',
        { booking: { status: { eq: bookingA.status } }, id: { eq: jobA.id } },
      ],
      [
        'booking.scheduledAt',
        { booking: { scheduledAt: { eq: bookingA.scheduledAt } } },
      ],
      [
        'or(booking.id, id)',
        {
          or: [
            { booking: { id: { eq: bookingA.id } } },
            { id: { eq: jobA.id } },
          ],
        },
      ],
    ];

    it.each([0, 1, 2, 3])('filter #%i: empty for B, jobA for A', async (i) => {
      const [, filter] = filters()[i];
      const asB = await gql(cookieB, JOBS_QUERY, { filter });
      expect(asB.body.errors).toBeUndefined();
      expect(asB.body.data.jobs).toEqual({ totalCount: 0, nodes: [] });

      const asA = await gql(cookieA, JOBS_QUERY, { filter });
      expect(asA.body.errors).toBeUndefined();
      expect(asA.body.data.jobs).toEqual({
        totalCount: 1,
        nodes: [{ id: jobA.id }],
      });
    });
  });

  // Case 3: nested paths (closes the #85 residual).
  it('Case 3: B reaches none of A’s booking, team, checklist or items through job(id)', async () => {
    const NESTED = `query($id: ID!){
      job(id: $id) {
        id
        booking { id }
        team { id }
        checklist { id items { nodes { id } } }
      }
    }`;
    const asB = await gql(cookieB, NESTED, { id: jobA.id });
    expect(asB.body.errors).toBeUndefined();
    expect(asB.body.data.job).toBeNull();
    const raw = JSON.stringify(asB.body);
    for (const id of [
      bookingA.id,
      teamA.id,
      checklistA.id,
      ...itemsA.map((item) => item.id),
    ]) {
      expect(raw).not.toContain(id);
    }

    const asA = await gql(cookieA, NESTED, { id: jobA.id });
    expect(asA.body.errors).toBeUndefined();
    expect(asA.body.data.job).toEqual({
      id: jobA.id,
      booking: { id: bookingA.id },
      checklist: {
        id: checklistA.id,
        items: {
          nodes: expect.arrayContaining(itemsA.map(({ id }) => ({ id }))),
        },
      },
      team: { id: teamA.id },
    });
    expect(asA.body.data.job.checklist.items.nodes).toHaveLength(3);
  });

  async function expectJobAUntouched(before: CleaningJobEntity) {
    const after = await jobRepository.findOneByOrFail({ id: jobA.id });
    expect(after.status).toBe(before.status);
    expect(after.teamId).toBe(before.teamId);
    expect(after.updatedAt).toEqual(before.updatedAt);
    const item = await itemRepository.findOneByOrFail({ id: itemsA[0].id });
    expect(item.completed).toBe(false);
  }

  // Case 4: cross-tenant job mutations are 404 and change nothing.
  describe('Case 4: cross-tenant job mutations', () => {
    it.each([
      [
        'assignTeamToJob',
        () => ({
          query: ASSIGN_TEAM_MUTATION,
          input: { jobId: jobA.id, teamId: teamB.id },
        }),
      ],
      [
        'completeChecklistItem',
        () => ({
          query: COMPLETE_ITEM_MUTATION,
          input: { jobId: jobA.id, itemId: itemsA[0].id },
        }),
      ],
      [
        'completeJob',
        () => ({ query: COMPLETE_JOB_MUTATION, input: { id: jobA.id } }),
      ],
    ])('%s on A’s job as B is 404', async (_name, make) => {
      const before = await jobRepository.findOneByOrFail({ id: jobA.id });
      const { query, input } = make();
      const res = await gql(cookieB, query, { input });
      expect(errorStatus(res)).toBe(404);
      await expectJobAUntouched(before);
    });
  });

  // Case 5: mixed ids (Decision 7, Review Focus 1).
  describe('Case 5: B’s own job with A’s item or team', () => {
    it('completeChecklistItem(jobB, A’s item) is 404 and changes neither', async () => {
      const before = await jobRepository.findOneByOrFail({ id: jobA.id });
      const res = await gql(cookieB, COMPLETE_ITEM_MUTATION, {
        input: { jobId: jobB.id, itemId: itemsA[0].id },
      });
      expect(errorStatus(res)).toBe(404);
      await expectJobAUntouched(before);
      const jobBAfter = await jobRepository.findOneByOrFail({ id: jobB.id });
      expect(jobBAfter.status).toBe(JobStatus.PENDING);
    });

    it('assignTeamToJob(jobB, A’s team) is 404 and jobB keeps its team', async () => {
      const res = await gql(cookieB, ASSIGN_TEAM_MUTATION, {
        input: { jobId: jobB.id, teamId: teamA.id },
      });
      expect(errorStatus(res)).toBe(404);
      const jobBAfter = await jobRepository.findOneByOrFail({ id: jobB.id });
      expect(jobBAfter.teamId).toBe(teamB.id);
    });
  });

  // Case 6: create persists the caller's tenant (Decision 6).
  it('Case 6: createJobFromBooking stores the job and checklist in the caller tenant; A’s booking is 404', async () => {
    const booking = await createBooking('B', '2031-03-03T09:00:00Z');
    const job = await createJobAs(cookieB, booking.id);
    const row = await jobRepository.findOneByOrFail({ id: job.id });
    expect(row.tenantId).toBe(tenantB);
    const checklist = await checklistRepository.findOneByOrFail({
      jobId: job.id,
    });
    expect(checklist.tenantId).toBe(tenantB);

    const foreign = await gql(cookieB, CREATE_JOB_MUTATION, {
      input: { bookingId: bookingA.id },
    });
    expect(errorStatus(foreign)).toBe(404);
    expect(await jobRepository.countBy({ bookingId: bookingA.id })).toBe(1);
  });

  // Case 7: spoofing (I-2).
  describe('Case 7: client input cannot supply or widen the tenant', () => {
    it('jobs(filter: { tenantId }) is a GraphQL validation error', async () => {
      const res = await gql(cookieB, JOBS_QUERY, {
        filter: { tenantId: { eq: tenantA } },
      });
      expect(res.body.errors).toBeDefined();
      expect(res.body.data).toBeUndefined();
    });

    it('an or-widening filter returns nothing of A', async () => {
      const res = await gql(cookieB, JOBS_QUERY, {
        filter: { or: [{ id: { eq: jobA.id } }, { id: { is: null } }] },
      });
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.jobs).toEqual({ totalCount: 0, nodes: [] });
    });

    it('an x-tenant-id header naming A is ignored', async () => {
      const res = await gql(
        cookieB,
        JOBS_QUERY,
        { filter: { id: { in: [jobA.id, jobB.id] } } },
        { 'x-tenant-id': tenantA },
      );
      expect(res.body.errors).toBeUndefined();
      expect(res.body.data.jobs.nodes).toEqual([{ id: jobB.id }]);
    });

    it('createJobFromBooking with a tenantId input field is a validation error and creates nothing', async () => {
      const booking = await createBooking('B', '2031-03-04T09:00:00Z');
      const res = await gql(cookieB, CREATE_JOB_MUTATION, {
        input: { bookingId: booking.id, tenantId: tenantA },
      });
      expect(res.body.errors).toBeDefined();
      expect(await jobRepository.countBy({ bookingId: booking.id })).toBe(0);
    });
  });

  // Case 8: role boundary (RFC §4.2).
  describe('Case 8: Super Admin is refused by role', () => {
    it.each([
      ['jobs', () => ({ query: JOBS_QUERY, variables: {} })],
      [
        'job(id)',
        () => ({
          query: `query($id: ID!){ job(id: $id) { id } }`,
          variables: { id: jobA.id },
        }),
      ],
      [
        'createJobFromBooking',
        () => ({
          query: CREATE_JOB_MUTATION,
          variables: { input: { bookingId: bookingA.id } },
        }),
      ],
      [
        'assignTeamToJob',
        () => ({
          query: ASSIGN_TEAM_MUTATION,
          variables: { input: { jobId: jobA.id, teamId: teamA.id } },
        }),
      ],
      [
        'completeChecklistItem',
        () => ({
          query: COMPLETE_ITEM_MUTATION,
          variables: { input: { jobId: jobA.id, itemId: itemsA[0].id } },
        }),
      ],
      [
        'completeJob',
        () => ({
          query: COMPLETE_JOB_MUTATION,
          variables: { input: { id: jobA.id } },
        }),
      ],
    ])('%s is 403 with no tenant data', async (_name, make) => {
      const { query, variables } = make();
      const res = await gql(cookieSuperAdmin, query, variables);
      expect(errorStatus(res)).toBe(403);
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain(jobB.id);
      expect(raw).not.toContain(checklistA.id);
    });
  });

  // Case 9: audit tags (Decision 10). Runs after cases 4–5, which need jobA
  // incomplete.
  it('Case 9: every job audit event carries the caller tenant and TENANT scope', async () => {
    const assign = await gql(cookieA, ASSIGN_TEAM_MUTATION, {
      input: { jobId: jobA.id, teamId: teamA.id },
    });
    expect(assign.body.errors).toBeUndefined();
    for (const item of itemsA) {
      const res = await gql(cookieA, COMPLETE_ITEM_MUTATION, {
        input: { jobId: jobA.id, itemId: item.id },
      });
      expect(res.body.errors).toBeUndefined();
    }
    const complete = await gql(cookieA, COMPLETE_JOB_MUTATION, {
      input: { id: jobA.id },
    });
    expect(complete.body.errors).toBeUndefined();
    expect(complete.body.data.completeJob.status).toBe(JobStatus.COMPLETED);

    // Existing convention (verified at M5): every job event, including
    // checklist-item completion, is keyed on the job id.
    const events = await auditEventRepository.find({
      where: { entityType: 'job', entityId: jobA.id },
    });
    expect(events.map((event) => event.action).sort()).toEqual(
      [
        'job.assign_team',
        'job.checklist_item.complete',
        'job.checklist_item.complete',
        'job.checklist_item.complete',
        'job.complete',
        'job.create',
      ].sort(),
    );
    for (const event of events) {
      expect(event).toMatchObject({
        actorId: ownerAId,
        scope: 'TENANT',
        tenantId: tenantA,
      });
    }
  });

  // Case 10: database backstop (I-1, database half).
  describe('Case 10: the database rejects cross-tenant job/checklist rows', () => {
    it('job → team', async () => {
      const bookingB2 = await createBooking('B', '2031-03-05T09:00:00Z');
      await expect(
        jobRepository.insert({
          bookingId: bookingB2.id,
          teamId: teamA.id,
          tenantId: tenantB,
          scheduledAt: new Date(),
        }),
      ).rejects.toMatchObject({
        driverError: { constraint: 'fk_cleaning_job_team_tenant' },
      });
    });

    it('job → booking, and checklist → job', async () => {
      // A fresh A booking with no job, so `UQ_cleaning_job_booking_id`
      // cannot fire first.
      const bookingA2 = await createBooking('A', '2031-03-06T09:00:00Z');
      await expect(
        jobRepository.insert({
          bookingId: bookingA2.id,
          teamId: null,
          tenantId: tenantB,
          scheduledAt: new Date(),
        }),
      ).rejects.toMatchObject({
        driverError: { constraint: 'fk_cleaning_job_booking_tenant' },
      });

      // An A job with no checklist yet, so `UQ_checklist_job_id` cannot
      // fire first.
      const inserted = await jobRepository.insert({
        bookingId: bookingA2.id,
        teamId: null,
        tenantId: tenantA,
        scheduledAt: new Date(),
      });
      const jobA2Id = (inserted.identifiers[0] as { id: string }).id;
      await expect(
        checklistRepository.insert({ tenantId: tenantB, jobId: jobA2Id }),
      ).rejects.toMatchObject({
        driverError: { constraint: 'fk_checklist_job_tenant' },
      });
    });
  });
});
