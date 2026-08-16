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
import { CleanersService } from '../src/modules/cleaners/application/services/cleaners.service';
import { TeamsService } from '../src/modules/cleaners/application/services/teams.service';
import { Role } from '../src/platform/auth/domain/role';
import { seedOwner } from './helpers/seed-owner';

// Proves plan task-6 brief's full 13-step Cleaners & Teams E2E acceptance
// scenario end-to-end: real HTTP (supertest) against the real `AppModule`
// (full composition root — GraphQL, auth guard/strategy, cleaners/teams
// services, request-scoped `CleanerTeamLoaders`, audit logger) and a real
// Postgres connection. This is a black-box proof of the resolver -> guard ->
// service -> loader -> database wiring; it deliberately does NOT re-prove
// what Task 1/2's real-Postgres service-level tests
// (`cleaners-teams.service.e2e-spec.ts`) already cover (explicit-`null`-vs-
// omitted persistence, audit-failure rollback, unique-constraint
// translation) — that would be redundant coverage of the same guarantee
// through a slower path.
//
// Self-contained, following `customers-properties.e2e-spec.ts`'s exact
// precedent: seeds its own Owner via `helpers/seed-owner.ts`, creates its
// own Scheduler/Customer Support/Finance/Analyst admins rather than
// depending on any other suite's fixtures or execution order, uses
// unique-per-run data (interpolating the seeded Owner's id), and scopes
// every assertion to specific returned ids rather than exact counts/global
// truncation — which is what makes it safe to run against the same,
// non-truncated, real Postgres database as every other suite without
// needing the advisory-lock helper `cleaners-teams.service.e2e-spec.ts`
// uses.
//
// No GraphQL query exposes audit events (matching Admin Foundation/
// Customers & Properties precedent) — every audit assertion below reads
// `AuditEventEntity` directly via a repository pulled off the same
// `TestingModule`, never through a query this suite invents.
describe('Cleaners & Teams (e2e)', () => {
  let app: INestApplication<App>;
  let adminUserRepository: Repository<AdminUserEntity>;
  let auditEventRepository: Repository<AuditEventEntity>;
  let teamsService: TeamsService;
  let cleanersService: CleanersService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirrors main.ts's bootstrap(), which this test doesn't go through.
    // `cookie-parser` is required here specifically: `JwtStrategy`'s cookie
    // extractor reads `req.cookies[SESSION_COOKIE_NAME]`, which is only
    // populated when this middleware runs ahead of it.
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
    teamsService = moduleFixture.get(TeamsService);
    cleanersService = moduleFixture.get(CleanersService);
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
      createAdmin(createAdminInput: $input) {
        id
        email
        role
        isActive
      }
    }
  `;

  const CREATE_CLEANER_MUTATION = `
    mutation CreateCleaner($input: CreateCleanerInput!) {
      createCleaner(input: $input) {
        id
        fullName
        phone
        email
        notes
      }
    }
  `;

  const UPDATE_CLEANER_MUTATION = `
    mutation UpdateCleaner($id: ID!, $input: UpdateCleanerInput!) {
      updateCleaner(id: $id, input: $input) {
        id
        fullName
        phone
        email
        notes
      }
    }
  `;

  const CREATE_TEAM_MUTATION = `
    mutation CreateTeam($input: CreateTeamInput!) {
      createTeam(input: $input) {
        id
        name
      }
    }
  `;

  const ASSIGN_CLEANER_TO_TEAM_MUTATION = `
    mutation AssignCleanerToTeam($cleanerId: ID!, $teamId: ID!) {
      assignCleanerToTeam(cleanerId: $cleanerId, teamId: $teamId) {
        id
      }
    }
  `;

  const CLEANER_QUERY = `
    query Cleaner($id: ID!) {
      cleaner(id: $id) {
        id
        fullName
        phone
        email
        notes
        team { id name }
      }
    }
  `;

  const CLEANERS_QUERY = `
    query Cleaners {
      cleaners {
        id
        team { id name }
      }
    }
  `;

  const TEAMS_QUERY = `
    query Teams {
      teams {
        id
        name
        cleaners { id }
      }
    }
  `;

  // See `admin-foundation.e2e-spec.ts`'s identical helper for why this
  // "capture the Set-Cookie header, forward it explicitly" approach is used
  // instead of supertest's `request.agent()` jar — that jar silently drops
  // cookies over the plain-HTTP transport supertest drives, because
  // `AdminResolver.setSessionCookie` always sets `secure: true`.
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

  it('proves the full Cleaners & Teams E2E acceptance scenario', async () => {
    const owner = await seedOwner(adminUserRepository);
    const runId = owner.id;

    const ownerLoginResponse = await login(owner.email, owner.password);
    expect(ownerLoginResponse.body.errors).toBeUndefined();
    expect(ownerLoginResponse.body.data.login).toEqual({
      success: true,
      admin: { id: owner.id, role: Role.OWNER },
    });
    const ownerSessionCookie = extractSessionCookie(ownerLoginResponse);

    // --- Step 1: Owner logs in -> createCleaner succeeds -> createTeam
    // succeeds -> assignCleanerToTeam succeeds -> cleaner(id) query returns
    // the cleaner with `team` populated -> teams query includes the team
    // with the cleaner nested under `cleaners` -> cleaner.create/team.create/
    // cleaner.assign_team audit events recorded. ---
    const cleanerEmail = `cleaner-${runId}@example.com`;
    const createCleanerResponse = await authedRequest(ownerSessionCookie).send({
      query: CREATE_CLEANER_MUTATION,
      variables: {
        input: {
          fullName: 'Jane Cleaner',
          phone: '555-0100',
          email: cleanerEmail,
          notes: 'Initial notes',
        },
      },
    });
    expect(createCleanerResponse.body.errors).toBeUndefined();
    const createdCleaner = createCleanerResponse.body.data.createCleaner;
    expect(createdCleaner).toMatchObject({
      fullName: 'Jane Cleaner',
      phone: '555-0100',
      email: cleanerEmail,
      notes: 'Initial notes',
    });
    const cleanerId: string = createdCleaner.id;

    const cleanerCreateAuditEvent = await auditEventRepository.findOneBy({
      action: 'cleaner.create',
      entityId: cleanerId,
    });
    expect(cleanerCreateAuditEvent).not.toBeNull();
    expect(cleanerCreateAuditEvent?.actorId).toBe(owner.id);

    const teamName = `Team Alpha ${runId}`;
    const createTeamResponse = await authedRequest(ownerSessionCookie).send({
      query: CREATE_TEAM_MUTATION,
      variables: { input: { name: teamName } },
    });
    expect(createTeamResponse.body.errors).toBeUndefined();
    const createdTeam = createTeamResponse.body.data.createTeam;
    expect(createdTeam).toMatchObject({ name: teamName });
    const teamId: string = createdTeam.id;

    const teamCreateAuditEvent = await auditEventRepository.findOneBy({
      action: 'team.create',
      entityId: teamId,
    });
    expect(teamCreateAuditEvent).not.toBeNull();
    expect(teamCreateAuditEvent?.actorId).toBe(owner.id);

    const assignResponse = await authedRequest(ownerSessionCookie).send({
      query: ASSIGN_CLEANER_TO_TEAM_MUTATION,
      variables: { cleanerId, teamId },
    });
    expect(assignResponse.body.errors).toBeUndefined();
    expect(assignResponse.body.data.assignCleanerToTeam).toEqual({
      id: cleanerId,
    });

    const cleanerAssignAuditEvent = await auditEventRepository.findOneBy({
      action: 'cleaner.assign_team',
      entityId: cleanerId,
    });
    expect(cleanerAssignAuditEvent).not.toBeNull();
    expect(cleanerAssignAuditEvent?.actorId).toBe(owner.id);

    const cleanerAfterAssignResponse = await authedRequest(
      ownerSessionCookie,
    ).send({
      query: CLEANER_QUERY,
      variables: { id: cleanerId },
    });
    expect(cleanerAfterAssignResponse.body.errors).toBeUndefined();
    expect(cleanerAfterAssignResponse.body.data.cleaner).toMatchObject({
      id: cleanerId,
      team: { id: teamId, name: teamName },
    });

    const teamsAfterAssignResponse = await authedRequest(
      ownerSessionCookie,
    ).send({ query: TEAMS_QUERY });
    expect(teamsAfterAssignResponse.body.errors).toBeUndefined();
    const teamsAfterAssign: Array<{
      id: string;
      name: string;
      cleaners: Array<{ id: string }>;
    }> = teamsAfterAssignResponse.body.data.teams;
    const teamAlphaRow = teamsAfterAssign.find((t) => t.id === teamId);
    expect(teamAlphaRow).toBeDefined();
    expect(teamAlphaRow?.cleaners).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: cleanerId })]),
    );

    // --- Step 2: assignCleanerToTeam to the SAME team again -> succeeds
    // (not an error) -> a second cleaner.assign_team audit event exists for
    // the same cleaner (same-state decision proven end-to-end). ---
    const reassignSameTeamResponse = await authedRequest(
      ownerSessionCookie,
    ).send({
      query: ASSIGN_CLEANER_TO_TEAM_MUTATION,
      variables: { cleanerId, teamId },
    });
    expect(reassignSameTeamResponse.body.errors).toBeUndefined();
    expect(reassignSameTeamResponse.body.data.assignCleanerToTeam).toEqual({
      id: cleanerId,
    });

    const assignAuditEventsForCleaner = await auditEventRepository.findBy({
      action: 'cleaner.assign_team',
      entityId: cleanerId,
    });
    expect(assignAuditEventsForCleaner.length).toBeGreaterThanOrEqual(2);

    // --- Step 3: updateCleaner with only `phone` set -> re-fetch confirms
    // fullName/email unchanged, phone updated -> cleaner.update recorded. ---
    const updateCleanerResponse = await authedRequest(ownerSessionCookie).send({
      query: UPDATE_CLEANER_MUTATION,
      variables: { id: cleanerId, input: { phone: '555-9999' } },
    });
    expect(updateCleanerResponse.body.errors).toBeUndefined();
    expect(updateCleanerResponse.body.data.updateCleaner).toMatchObject({
      id: cleanerId,
      fullName: 'Jane Cleaner',
      email: cleanerEmail,
      phone: '555-9999',
      notes: 'Initial notes',
    });

    const cleanerUpdateAuditEvent = await auditEventRepository.findOneBy({
      action: 'cleaner.update',
      entityId: cleanerId,
    });
    expect(cleanerUpdateAuditEvent).not.toBeNull();
    expect(cleanerUpdateAuditEvent?.actorId).toBe(owner.id);

    const cleanerAfterUpdateResponse = await authedRequest(
      ownerSessionCookie,
    ).send({
      query: CLEANER_QUERY,
      variables: { id: cleanerId },
    });
    expect(cleanerAfterUpdateResponse.body.errors).toBeUndefined();
    expect(cleanerAfterUpdateResponse.body.data.cleaner).toMatchObject({
      id: cleanerId,
      fullName: 'Jane Cleaner',
      email: cleanerEmail,
      phone: '555-9999',
      notes: 'Initial notes',
    });

    // --- Step 4: Fixture — Team A (2 cleaners), Team B (1 cleaner), Team C
    // (0 cleaners), plus 1 unassigned cleaner. `cleaners { team { name } }`
    // asserts the correct team/null per row; `teams { cleaners { id } }`
    // asserts Team A's 2, Team B's 1, Team C's `[]` (empty-team case proves
    // the grouping logic defaults correctly rather than merely omitting
    // keys with no matches). This fixture is reused by step 5. ---
    async function createCleanerFixture(label: string) {
      const email = `${label}-${runId}@example.com`;
      const response = await authedRequest(ownerSessionCookie).send({
        query: CREATE_CLEANER_MUTATION,
        variables: {
          input: { fullName: label, phone: '555-0200', email },
        },
      });
      expect(response.body.errors).toBeUndefined();
      return response.body.data.createCleaner.id as string;
    }

    async function createTeamFixture(name: string) {
      const response = await authedRequest(ownerSessionCookie).send({
        query: CREATE_TEAM_MUTATION,
        variables: { input: { name } },
      });
      expect(response.body.errors).toBeUndefined();
      return response.body.data.createTeam.id as string;
    }

    async function assignFixture(
      assignCleanerId: string,
      assignTeamId: string,
    ) {
      const response = await authedRequest(ownerSessionCookie).send({
        query: ASSIGN_CLEANER_TO_TEAM_MUTATION,
        variables: { cleanerId: assignCleanerId, teamId: assignTeamId },
      });
      expect(response.body.errors).toBeUndefined();
    }

    const teamAId = await createTeamFixture(`Team A ${runId}`);
    const teamBId = await createTeamFixture(`Team B ${runId}`);
    const teamCId = await createTeamFixture(`Team C ${runId}`);

    const teamACleaner1Id = await createCleanerFixture(`team-a-cleaner-1`);
    const teamACleaner2Id = await createCleanerFixture(`team-a-cleaner-2`);
    const teamBCleaner1Id = await createCleanerFixture(`team-b-cleaner-1`);
    const unassignedCleanerId =
      await createCleanerFixture(`unassigned-cleaner`);

    await assignFixture(teamACleaner1Id, teamAId);
    await assignFixture(teamACleaner2Id, teamAId);
    await assignFixture(teamBCleaner1Id, teamBId);

    const cleanersFixtureResponse = await authedRequest(
      ownerSessionCookie,
    ).send({ query: CLEANERS_QUERY });
    expect(cleanersFixtureResponse.body.errors).toBeUndefined();
    const cleanersFixtureRows: Array<{
      id: string;
      team: { id: string; name: string } | null;
    }> = cleanersFixtureResponse.body.data.cleaners;
    const byId = new Map(cleanersFixtureRows.map((row) => [row.id, row]));
    expect(byId.get(teamACleaner1Id)?.team).toMatchObject({ id: teamAId });
    expect(byId.get(teamACleaner2Id)?.team).toMatchObject({ id: teamAId });
    expect(byId.get(teamBCleaner1Id)?.team).toMatchObject({ id: teamBId });
    expect(byId.get(unassignedCleanerId)?.team).toBeNull();

    const teamsFixtureResponse = await authedRequest(ownerSessionCookie).send({
      query: TEAMS_QUERY,
    });
    expect(teamsFixtureResponse.body.errors).toBeUndefined();
    const teamsFixtureRows: Array<{
      id: string;
      cleaners: Array<{ id: string }>;
    }> = teamsFixtureResponse.body.data.teams;
    const teamsById = new Map(teamsFixtureRows.map((row) => [row.id, row]));
    expect(new Set(teamsById.get(teamAId)?.cleaners.map((c) => c.id))).toEqual(
      new Set([teamACleaner1Id, teamACleaner2Id]),
    );
    expect(new Set(teamsById.get(teamBId)?.cleaners.map((c) => c.id))).toEqual(
      new Set([teamBCleaner1Id]),
    );
    expect(teamsById.get(teamCId)?.cleaners).toEqual([]);

    // --- Step 5: Batching/query-count proof, distinct from step 4. Spies
    // wrap the REAL implementation (no `.mockImplementation`) so the actual
    // batched DB calls happen; only the call count/arguments are inspected.
    // These spies are intentionally left active (not restored) for the rest
    // of the suite — no later step calls `getTeamsByIds`/
    // `listCleanersByTeamIds` in a way the spies would affect, since step 6
    // exercises `cleaner(id) { team }`, which resolves through
    // `teamLoader`/`getTeamsByIds` too, but each request gets its own fresh
    // loader/spy-call regardless of the wrapping — the spy only counts calls,
    // it does not share state across requests. ---
    const getTeamsByIdsSpy = jest.spyOn(teamsService, 'getTeamsByIds');
    const listCleanersByTeamIdsSpy = jest.spyOn(
      cleanersService,
      'listCleanersByTeamIds',
    );

    const cleanersBatchResponse = await authedRequest(ownerSessionCookie).send({
      query: CLEANERS_QUERY,
    });
    expect(cleanersBatchResponse.body.errors).toBeUndefined();
    expect(getTeamsByIdsSpy).toHaveBeenCalledTimes(1);
    const expectedTeamIdsForCleanersQuery = (
      cleanersBatchResponse.body.data.cleaners as Array<{
        team: { id: string } | null;
      }>
    )
      .filter((row) => row.team !== null)
      .map((row) => row.team!.id);
    expect(new Set(getTeamsByIdsSpy.mock.calls[0][0])).toEqual(
      new Set(expectedTeamIdsForCleanersQuery),
    );

    const teamsBatchResponse = await authedRequest(ownerSessionCookie).send({
      query: TEAMS_QUERY,
    });
    expect(teamsBatchResponse.body.errors).toBeUndefined();
    expect(listCleanersByTeamIdsSpy).toHaveBeenCalledTimes(1);
    const expectedTeamIdsForTeamsQuery = (
      teamsBatchResponse.body.data.teams as Array<{ id: string }>
    ).map((row) => row.id);
    expect(new Set(listCleanersByTeamIdsSpy.mock.calls[0][0])).toEqual(
      new Set(expectedTeamIdsForTeamsQuery),
    );
    // Team C's id (an empty-result key) must still appear in the batch
    // call's argument set.
    expect(expectedTeamIdsForTeamsQuery).toContain(teamCId);

    // --- Step 6: Request-isolation proof. Two genuinely separate Supertest
    // requests (two HTTP round-trips), not two field selections within one
    // query document. First query while on Team A, reassign to Team B in
    // between, then query again — the second request must reflect Team B,
    // proving the request-scoped `CleanerTeamLoaders` is constructed fresh
    // per request rather than reused/cached across requests. ---
    const isolationCleanerId = teamACleaner1Id;

    const beforeReassignResponse = await authedRequest(ownerSessionCookie).send(
      {
        query: CLEANER_QUERY,
        variables: { id: isolationCleanerId },
      },
    );
    expect(beforeReassignResponse.body.errors).toBeUndefined();
    expect(beforeReassignResponse.body.data.cleaner.team).toMatchObject({
      id: teamAId,
    });

    await assignFixture(isolationCleanerId, teamBId);

    const afterReassignResponse = await authedRequest(ownerSessionCookie).send({
      query: CLEANER_QUERY,
      variables: { id: isolationCleanerId },
    });
    expect(afterReassignResponse.body.errors).toBeUndefined();
    expect(afterReassignResponse.body.data.cleaner.team).toMatchObject({
      id: teamBId,
    });

    // --- Step 7: Owner creates a Scheduler, Customer Support, Finance, and
    // Analyst admin within this suite — no dependency on the Customers &
    // Properties suite's fixtures or execution order. ---
    const schedulerEmail = `scheduler-${runId}@example.com`;
    const schedulerPassword = 'scheduler-pw-12345';
    const scheduler = await createAdmin(
      ownerSessionCookie,
      schedulerEmail,
      schedulerPassword,
      Role.SCHEDULER,
    );
    expect(scheduler).toMatchObject({
      email: schedulerEmail,
      role: Role.SCHEDULER,
      isActive: true,
    });

    const customerSupportEmail = `customer-support-${runId}@example.com`;
    const customerSupportPassword = 'customer-support-pw-12345';
    const customerSupport = await createAdmin(
      ownerSessionCookie,
      customerSupportEmail,
      customerSupportPassword,
      Role.CUSTOMER_SUPPORT,
    );
    expect(customerSupport).toMatchObject({
      email: customerSupportEmail,
      role: Role.CUSTOMER_SUPPORT,
      isActive: true,
    });

    const financeEmail = `finance-${runId}@example.com`;
    const financePassword = 'finance-pw-12345';
    const finance = await createAdmin(
      ownerSessionCookie,
      financeEmail,
      financePassword,
      Role.FINANCE,
    );
    expect(finance).toMatchObject({
      email: financeEmail,
      role: Role.FINANCE,
      isActive: true,
    });

    const analystEmail = `analyst-${runId}@example.com`;
    const analystPassword = 'analyst-pw-12345';
    const analyst = await createAdmin(
      ownerSessionCookie,
      analystEmail,
      analystPassword,
      Role.ANALYST,
    );
    expect(analyst).toMatchObject({
      email: analystEmail,
      role: Role.ANALYST,
      isActive: true,
    });

    // --- Step 8: Scheduler logs in -> cleaners query succeeds (view-
    // allowed) -> createCleaner denied (write-restricted). ---
    const schedulerLoginResponse = await login(
      schedulerEmail,
      schedulerPassword,
    );
    expect(schedulerLoginResponse.body.errors).toBeUndefined();
    expect(schedulerLoginResponse.body.data.login.success).toBe(true);
    const schedulerSessionCookie = extractSessionCookie(schedulerLoginResponse);

    const schedulerCleanersResponse = await authedRequest(
      schedulerSessionCookie,
    ).send({ query: CLEANERS_QUERY });
    expect(schedulerCleanersResponse.body.errors).toBeUndefined();
    const schedulerCleanerIds: string[] =
      schedulerCleanersResponse.body.data.cleaners.map(
        (c: { id: string }) => c.id,
      );
    expect(schedulerCleanerIds).toContain(cleanerId);

    const schedulerCreateCleanerResponse = await authedRequest(
      schedulerSessionCookie,
    ).send({
      query: CREATE_CLEANER_MUTATION,
      variables: {
        input: {
          fullName: 'Should Not Be Created',
          phone: '555-0000',
          email: `should-not-be-created-scheduler-${runId}@example.com`,
        },
      },
    });
    expect(
      schedulerCreateCleanerResponse.body.data?.createCleaner,
    ).toBeUndefined();
    expect(
      schedulerCreateCleanerResponse.body.errors?.[0]?.extensions?.code,
    ).toBe('FORBIDDEN');

    // --- Step 9: Analyst logs in -> cleaners query succeeds (view-
    // allowed). ---
    const analystLoginResponse = await login(analystEmail, analystPassword);
    expect(analystLoginResponse.body.errors).toBeUndefined();
    expect(analystLoginResponse.body.data.login.success).toBe(true);
    const analystSessionCookie = extractSessionCookie(analystLoginResponse);

    const analystCleanersResponse = await authedRequest(
      analystSessionCookie,
    ).send({ query: CLEANERS_QUERY });
    expect(analystCleanersResponse.body.errors).toBeUndefined();
    const analystCleanerIds: string[] =
      analystCleanersResponse.body.data.cleaners.map(
        (c: { id: string }) => c.id,
      );
    expect(analystCleanerIds).toContain(cleanerId);

    // --- Step 10: Customer Support logs in -> cleaners query denied (no
    // view access per the RBAC matrix) -> createCleaner denied. ---
    const customerSupportLoginResponse = await login(
      customerSupportEmail,
      customerSupportPassword,
    );
    expect(customerSupportLoginResponse.body.errors).toBeUndefined();
    expect(customerSupportLoginResponse.body.data.login.success).toBe(true);
    const customerSupportSessionCookie = extractSessionCookie(
      customerSupportLoginResponse,
    );

    const customerSupportCleanersResponse = await authedRequest(
      customerSupportSessionCookie,
    ).send({ query: CLEANERS_QUERY });
    expect(customerSupportCleanersResponse.body.data?.cleaners).toBeUndefined();
    expect(
      customerSupportCleanersResponse.body.errors?.[0]?.extensions?.code,
    ).toBe('FORBIDDEN');

    const customerSupportCreateCleanerResponse = await authedRequest(
      customerSupportSessionCookie,
    ).send({
      query: CREATE_CLEANER_MUTATION,
      variables: {
        input: {
          fullName: 'Should Not Be Created',
          phone: '555-0000',
          email: `should-not-be-created-customer-support-${runId}@example.com`,
        },
      },
    });
    expect(
      customerSupportCreateCleanerResponse.body.data?.createCleaner,
    ).toBeUndefined();
    expect(
      customerSupportCreateCleanerResponse.body.errors?.[0]?.extensions?.code,
    ).toBe('FORBIDDEN');

    // --- Step 11: Finance admin logs in -> cleaners query denied ->
    // createCleaner denied. ---
    const financeLoginResponse = await login(financeEmail, financePassword);
    expect(financeLoginResponse.body.errors).toBeUndefined();
    expect(financeLoginResponse.body.data.login.success).toBe(true);
    const financeSessionCookie = extractSessionCookie(financeLoginResponse);

    const financeCleanersResponse = await authedRequest(
      financeSessionCookie,
    ).send({ query: CLEANERS_QUERY });
    expect(financeCleanersResponse.body.data?.cleaners).toBeUndefined();
    expect(financeCleanersResponse.body.errors?.[0]?.extensions?.code).toBe(
      'FORBIDDEN',
    );

    const financeCreateCleanerResponse = await authedRequest(
      financeSessionCookie,
    ).send({
      query: CREATE_CLEANER_MUTATION,
      variables: {
        input: {
          fullName: 'Should Not Be Created',
          phone: '555-0000',
          email: `should-not-be-created-finance-${runId}@example.com`,
        },
      },
    });
    expect(
      financeCreateCleanerResponse.body.data?.createCleaner,
    ).toBeUndefined();
    expect(
      financeCreateCleanerResponse.body.errors?.[0]?.extensions?.code,
    ).toBe('FORBIDDEN');

    // --- Step 12: assignCleanerToTeam with a nonexistent teamId (as Owner)
    // is rejected with a not-found error; the cleaner's team is unchanged on
    // re-fetch. `@nestjs/apollo` only remaps HTTP 401/403/400/422 to
    // well-known Apollo codes — a 404 `NotFoundException` falls through to
    // `extensions.code: 'INTERNAL_SERVER_ERROR'` with the original HTTP
    // status preserved at `extensions.status`, so that (not `NOT_FOUND`) is
    // what a not-found GraphQL error actually looks like in this codebase. ---
    const nonexistentTeamId = '00000000-0000-0000-0000-000000000000';
    const missingTeamResponse = await authedRequest(ownerSessionCookie).send({
      query: ASSIGN_CLEANER_TO_TEAM_MUTATION,
      variables: { cleanerId: unassignedCleanerId, teamId: nonexistentTeamId },
    });
    expect(missingTeamResponse.body.data?.assignCleanerToTeam).toBeUndefined();
    const missingTeamError = missingTeamResponse.body.errors?.[0];
    expect(missingTeamError?.extensions?.status).toBe(404);
    expect(missingTeamError?.message).toContain(
      `Team ${nonexistentTeamId} not found`,
    );

    const unassignedCleanerAfterFailedAssignResponse = await authedRequest(
      ownerSessionCookie,
    ).send({
      query: CLEANER_QUERY,
      variables: { id: unassignedCleanerId },
    });
    expect(
      unassignedCleanerAfterFailedAssignResponse.body.errors,
    ).toBeUndefined();
    expect(
      unassignedCleanerAfterFailedAssignResponse.body.data.cleaner.team,
    ).toBeNull();

    // --- Step 13: createTeam with a name matching an already-existing team
    // is rejected with a conflict error; no duplicate persisted.
    // `TeamsService.createTeam` throws a 409 `ConflictException`
    // ('Team name is already in use'), which — like the 404
    // `NotFoundException` in step 12 — is outside `@nestjs/apollo`'s
    // remapped set (only 400/401/403/422 get well-known codes), so it also
    // falls through to `extensions.code: 'INTERNAL_SERVER_ERROR'` with the
    // original HTTP status preserved at `extensions.status: 409`. ---
    const duplicateTeamResponse = await authedRequest(ownerSessionCookie).send({
      query: CREATE_TEAM_MUTATION,
      variables: { input: { name: teamName } },
    });
    expect(duplicateTeamResponse.body.data?.createTeam).toBeUndefined();
    const duplicateTeamError = duplicateTeamResponse.body.errors?.[0];
    expect(duplicateTeamError?.extensions?.status).toBe(409);
    expect(duplicateTeamError?.message).toContain('already in use');

    const teamsAfterDuplicateResponse = await authedRequest(
      ownerSessionCookie,
    ).send({ query: TEAMS_QUERY });
    expect(teamsAfterDuplicateResponse.body.errors).toBeUndefined();
    const teamsNamedTeamName = (
      teamsAfterDuplicateResponse.body.data.teams as Array<{ name: string }>
    ).filter((t) => t.name === teamName);
    expect(teamsNamedTeamName).toHaveLength(1);
  });
});
