import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { AdminUserEntity } from '../src/modules/admins/infrastructure/persistence/admin-user.entity';
import { AdminScope } from '../src/platform/auth/domain/admin-scope';
import { Role } from '../src/platform/auth/domain/role';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import { seedOwner } from './helpers/seed-owner';
import {
  createTestTenant,
  removeTestTenants,
  seedSuperAdmin,
  seedTenantAdmin,
} from './helpers/seed-tenant-admin';

// Proves spec §4.10's full 5-step Admin Foundation acceptance scenario
// end-to-end: real HTTP (supertest) against the real `AppModule` (full
// composition root — GraphQL, auth guard/strategy, admins service, audit
// logger) and a real Postgres connection. Self-contained: seeds its own
// Owner via `helpers/seed-owner.ts` rather than depending on
// `src/platform/database/seed.ts` (Task 3's dev-only, env-var-gated
// script) or any prior `pnpm db:seed` run — matching `app.e2e-spec.ts`'s
// "creates its own data" precedent.
//
// Multi-tenant identity slice (plan Task 10): the privileged user is a
// TENANT_OWNER of the migration-created bootstrap tenant, and a second,
// test-only tenant proves staff isolation. Business data is still unscoped
// in this slice; only staff rows are tenant-isolated here.
//
// No GraphQL query exposes audit events (per spec §3) — every audit
// assertion below reads `AuditEventEntity` directly via a repository
// pulled off the same `TestingModule`, never through a query this suite
// invents.
describe('Admin Foundation (e2e)', () => {
  let app: INestApplication<App>;
  let adminUserRepository: Repository<AdminUserEntity>;
  let auditEventRepository: Repository<AuditEventEntity>;
  let dataSource: DataSource;
  const testTenantIds: string[] = [];

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
    applyPlatformPipes(app);
    await app.init();

    adminUserRepository = moduleFixture.get(
      getRepositoryToken(AdminUserEntity),
    );
    auditEventRepository = moduleFixture.get(
      getRepositoryToken(AuditEventEntity),
    );
    dataSource = moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    await removeTestTenants(dataSource, testTenantIds);
    await app.close();
  });

  const LOGIN_MUTATION = `
    mutation Login($input: LoginInput!) {
      login(loginInput: $input) {
        success
        admin { id role scope tenantId }
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

  const DISABLE_ADMIN_MUTATION = `
    mutation DisableAdmin($id: ID!) {
      disableAdmin(id: $id) {
        id
        isActive
      }
    }
  `;

  const CURRENT_ADMIN_QUERY = `
    query {
      currentAdmin { id role scope tenantId }
    }
  `;

  const ADMINS_QUERY = `
    query {
      admins { id email role scope tenantId }
    }
  `;

  // supertest/superagent's `request.agent(...)` cookie jar (the `cookiejar`
  // package) filters strictly on the `Secure` attribute vs. the request
  // URL's protocol (`cookiejar.js`'s `Cookie.access()`:
  // `this.secure && !access_info.secure` is excluded) — and
  // `AdminResolver.setSessionCookie` always sets `secure: true` (spec's
  // deliberate, non-environment-conditional choice; see that method's own
  // comment). Since supertest drives a bare `http://127.0.0.1:<port>` test
  // server (`app.getHttpServer()`, no TLS), `request.agent()`'s automatic
  // jar silently drops the cookie on every request after login — confirmed
  // empirically (a follow-up `currentAdmin` query came back `Unauthorized`
  // even immediately after a successful login). This is a
  // supertest-vs-plain-HTTP transport limitation, not a bug in the resolver
  // or guard.
  //
  // So each "session" here is a plain `sessionCookie` string, captured from
  // `login`'s `Set-Cookie` response header and forwarded explicitly via
  // `.set('Cookie', ...)` on every subsequent request — functionally
  // equivalent to (and, since it's explicit, an even more direct proof of)
  // "reuse this exact session's cookie" than an opaque jar would be,
  // without being defeated by the `Secure` attribute.
  function extractSessionCookie(response: request.Response): string {
    // superagent's `Response.headers` type is `{ [index: string]: string }`,
    // but Node's `http.IncomingMessage` (what's actually behind it)
    // special-cases `set-cookie` as `string[]` at runtime — hence the
    // `unknown` round-trip rather than a direct `as string[]`.
    const setCookieHeader = response.headers['set-cookie'] as unknown as
      string[] | undefined;
    if (!setCookieHeader || setCookieHeader.length === 0) {
      throw new Error('Expected a Set-Cookie header on the login response');
    }
    // Only the `name=value` pair belongs in a request's `Cookie` header —
    // not the `Set-Cookie` response header's other attributes
    // (`HttpOnly`/`Secure`/`SameSite`/`Path`/`Max-Age`/`Expires`).
    return setCookieHeader[0].split(';')[0];
  }

  async function login(email: string, password: string) {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: LOGIN_MUTATION,
        variables: { input: { email, password } },
      });
    return response;
  }

  function authedRequest(sessionCookie: string) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', sessionCookie);
  }

  it('proves the full Admin Foundation acceptance scenario (spec §4.10)', async () => {
    const owner = await seedOwner(adminUserRepository);

    // --- Step 1: Owner logs in, creates a Scheduler, admin.created is recorded ---
    const ownerLoginResponse = await login(owner.email, owner.password);
    expect(ownerLoginResponse.body.errors).toBeUndefined();
    expect(ownerLoginResponse.body.data.login).toEqual({
      admin: {
        id: owner.id,
        tenantId: BOOTSTRAP_TENANT_ID,
        role: Role.TENANT_OWNER,
        scope: AdminScope.TENANT,
      },
      success: true,
    });
    // The session cookie must actually have been issued — everything from
    // here on (including step 5's rejection) depends on that being true.
    const ownerSessionCookie = extractSessionCookie(ownerLoginResponse);

    // The cookie's *attributes* (spec §4.8), asserted against the raw
    // `Set-Cookie` header — `extractSessionCookie` above deliberately
    // discards everything but the `name=value` pair (that's all a `Cookie`
    // request header may carry), so without this, dropping e.g.
    // `httpOnly: true` in `AdminResolver.setSessionCookie` would leave the
    // whole suite green.
    const ownerSetCookieHeader = (
      ownerLoginResponse.headers['set-cookie'] as unknown as string[]
    )[0];
    expect(ownerSetCookieHeader).toContain('HttpOnly');
    expect(ownerSetCookieHeader).toContain('Secure');
    expect(ownerSetCookieHeader).toContain('SameSite=Lax');
    expect(ownerSetCookieHeader).toContain('Path=/');
    // 28800s = 8h, matching the default `JWT_EXPIRES_IN=8h`.
    expect(ownerSetCookieHeader).toContain('Max-Age=28800');

    const schedulerEmail = `scheduler-${owner.id}@example.com`;
    const schedulerPassword = 'scheduler-pw-12345';
    const createAdminResponse = await authedRequest(ownerSessionCookie).send({
      query: CREATE_ADMIN_MUTATION,
      variables: {
        input: {
          email: schedulerEmail,
          password: schedulerPassword,
          role: Role.SCHEDULER,
        },
      },
    });
    expect(createAdminResponse.body.errors).toBeUndefined();
    const createdAdmin = createAdminResponse.body.data.createAdmin;
    expect(createdAdmin).toMatchObject({
      email: schedulerEmail,
      isActive: true,
      role: Role.SCHEDULER,
    });
    const schedulerId: string = createdAdmin.id;

    const createdAuditEvent = await auditEventRepository.findOneBy({
      action: 'admin.created',
      entityId: schedulerId,
    });
    expect(createdAuditEvent).not.toBeNull();
    expect(createdAuditEvent?.actorId).toBe(owner.id);
    expect(createdAuditEvent?.tenantId).toBe(BOOTSTRAP_TENANT_ID);
    expect(createdAuditEvent?.scope).toBe(AdminScope.TENANT);

    // --- Step 2: Scheduler logs in (separate session); createAdmin/disableAdmin are denied ---
    const schedulerLoginResponse = await login(
      schedulerEmail,
      schedulerPassword,
    );
    expect(schedulerLoginResponse.body.errors).toBeUndefined();
    expect(schedulerLoginResponse.body.data.login.success).toBe(true);
    const schedulerSessionCookie = extractSessionCookie(schedulerLoginResponse);

    const deniedCreateResponse = await authedRequest(
      schedulerSessionCookie,
    ).send({
      query: CREATE_ADMIN_MUTATION,
      variables: {
        input: {
          email: `should-not-be-created-${owner.id}@example.com`,
          password: 'irrelevant-password',
          role: Role.SCHEDULER,
        },
      },
    });
    expect(deniedCreateResponse.body.data?.createAdmin).toBeUndefined();
    expect(deniedCreateResponse.body.errors?.[0]?.extensions?.code).toBe(
      'FORBIDDEN',
    );

    const deniedDisableResponse = await authedRequest(
      schedulerSessionCookie,
    ).send({
      query: DISABLE_ADMIN_MUTATION,
      variables: { id: owner.id },
    });
    expect(deniedDisableResponse.body.data?.disableAdmin).toBeUndefined();
    expect(deniedDisableResponse.body.errors?.[0]?.extensions?.code).toBe(
      'FORBIDDEN',
    );

    // --- Step 3: Owner disables the Scheduler; admin.disabled is recorded ---
    const disableResponse = await authedRequest(ownerSessionCookie).send({
      query: DISABLE_ADMIN_MUTATION,
      variables: { id: schedulerId },
    });
    expect(disableResponse.body.errors).toBeUndefined();
    expect(disableResponse.body.data.disableAdmin).toEqual({
      id: schedulerId,
      isActive: false,
    });

    const disabledAuditEvent = await auditEventRepository.findOneBy({
      action: 'admin.disabled',
      entityId: schedulerId,
    });
    expect(disabledAuditEvent).not.toBeNull();
    expect(disabledAuditEvent?.actorId).toBe(owner.id);
    expect(disabledAuditEvent?.tenantId).toBe(BOOTSTRAP_TENANT_ID);
    expect(disabledAuditEvent?.scope).toBe(AdminScope.TENANT);

    // --- Step 4: Bad-password login attempt is generic, and audited with no actor ---
    const badPasswordResponse = await login(
      owner.email,
      'definitely-the-wrong-password',
    );
    expect(badPasswordResponse.body.data?.login).toBeUndefined();
    const badPasswordError = badPasswordResponse.body.errors?.[0];
    // Generic, non-discriminating message (spec §4.3 — see
    // `AdminResolver.login`'s own comment): the exact same message an
    // unknown-email or disabled-account login attempt would get, never a
    // specific "wrong password" message that would confirm the email
    // exists.
    expect(badPasswordError?.message).toBe('Invalid email or password');
    expect(badPasswordError?.extensions?.code).toBe('UNAUTHENTICATED');

    const failedLoginAuditEvent = await auditEventRepository.findOne({
      order: { occurredAt: 'DESC' },
      where: { action: 'admin.login.failed' },
    });
    expect(failedLoginAuditEvent).not.toBeNull();
    expect(failedLoginAuditEvent?.actorId).toBeNull();
    // No principal: no tenant, and NOT platform scope (spec §4.6).
    expect(failedLoginAuditEvent?.tenantId).toBeNull();
    expect(failedLoginAuditEvent?.scope).toBeNull();
    expect(failedLoginAuditEvent?.metadata).toMatchObject({
      email: owner.email.toLowerCase(),
    });

    // --- Step 5: The disabled Scheduler's session cookie is rejected on its
    // next protected request — reusing the EXACT SAME `schedulerSessionCookie`
    // string captured at login in step 2, now stale after step 3's disable.
    // This exercises the full chain (cookie -> JWT extraction -> signature
    // validation -> fresh DB lookup -> disabled account -> rejection), not
    // merely "a fresh login would now be required." ---
    const staleSessionResponse = await authedRequest(
      schedulerSessionCookie,
    ).send({
      query: CURRENT_ADMIN_QUERY,
    });
    expect(staleSessionResponse.body.data?.currentAdmin).toBeUndefined();
    // Specifically `UNAUTHENTICATED` (from `JwtStrategy.validate()` throwing
    // `UnauthorizedException` when `ADMIN_IDENTITY_LOOKUP` finds no
    // *active* admin for this id) — not `FORBIDDEN` (step 2's role-check
    // failure). That distinction is exactly what proves this is
    // §4.1's DB-authoritative disabled-account check firing on an
    // otherwise still cryptographically-valid, unexpired JWT, rather than
    // some other unrelated rejection.
    expect(staleSessionResponse.body.errors?.[0]?.extensions?.code).toBe(
      'UNAUTHENTICATED',
    );
  });

  it('logout expires the session cookie and is idempotent without one', async () => {
    const owner = await seedOwner(adminUserRepository);
    const loginResponse = await login(owner.email, owner.password);
    expect(loginResponse.body.errors).toBeUndefined();
    const loginCookie = extractSessionCookie(loginResponse);

    const logoutResponse = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', loginCookie)
      .send({ query: 'mutation { logout }' });

    expect(logoutResponse.body.data.logout).toBe(true);
    const clearedCookie = logoutResponse.headers['set-cookie']?.[0];
    expect(clearedCookie).toBeDefined();
    expect(clearedCookie).toMatch(/clensy_admin_session=;/); // cleared value
    expect(clearedCookie).toMatch(/Expires=Thu, 01 Jan 1970/i); // clearCookie's expiry

    // idempotent: no cookie at all still succeeds
    const noCookieResponse = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: 'mutation { logout }' });
    expect(noCookieResponse.body.data.logout).toBe(true);
  });

  it("isolates staff by tenant: Tenant Owner B cannot list or disable Tenant A's staff", async () => {
    const tenantB = await createTestTenant(dataSource);
    testTenantIds.push(tenantB);
    const ownerA = await seedOwner(adminUserRepository);
    const staffA = await seedTenantAdmin(dataSource, Role.SCHEDULER);
    const ownerB = await seedTenantAdmin(
      dataSource,
      Role.TENANT_OWNER,
      tenantB,
    );
    const staffB = await seedTenantAdmin(dataSource, Role.FINANCE, tenantB);
    await seedSuperAdmin(dataSource);

    const ownerBLogin = await login(ownerB.email, ownerB.password);
    expect(ownerBLogin.body.errors).toBeUndefined();
    const ownerBCookie = extractSessionCookie(ownerBLogin);

    // `admins` returns exactly tenant B — no tenant A staff, no Super Admin.
    const listResponse = await authedRequest(ownerBCookie).send({
      query: ADMINS_QUERY,
    });
    expect(listResponse.body.errors).toBeUndefined();
    const listed = listResponse.body.data.admins as {
      id: string;
      tenantId: string;
      scope: string;
    }[];
    expect(listed.map((admin) => admin.id).sort()).toEqual(
      [ownerB.id, staffB.id].sort(),
    );
    expect(
      listed.every(
        (admin) =>
          admin.tenantId === tenantB && admin.scope === AdminScope.TENANT,
      ),
    ).toBe(true);

    // Disabling a tenant A user looks exactly like disabling an id that
    // does not exist at all (missing-row semantics, spec §4.5).
    const crossTenantDisable = await authedRequest(ownerBCookie).send({
      query: DISABLE_ADMIN_MUTATION,
      variables: { id: staffA.id },
    });
    const missingId = randomUUID();
    const nonexistentDisable = await authedRequest(ownerBCookie).send({
      query: DISABLE_ADMIN_MUTATION,
      variables: { id: missingId },
    });
    expect(crossTenantDisable.body.data?.disableAdmin).toBeUndefined();
    const crossTenantError = crossTenantDisable.body.errors?.[0];
    const nonexistentError = nonexistentDisable.body.errors?.[0];
    expect(crossTenantError?.extensions?.status).toBe(404);
    expect(crossTenantError?.extensions?.code).toBe(
      nonexistentError?.extensions?.code,
    );
    expect(crossTenantError?.message).toBe(
      String(nonexistentError?.message).replace(missingId, staffA.id),
    );

    expect(
      (await adminUserRepository.findOneBy({ id: staffA.id }))?.isActive,
    ).toBe(true);
    expect(
      (await adminUserRepository.findOneBy({ id: ownerA.id }))?.isActive,
    ).toBe(true);

    // A staff member created by Tenant Owner B lands in tenant B.
    const createResponse = await authedRequest(ownerBCookie).send({
      query: CREATE_ADMIN_MUTATION,
      variables: {
        input: {
          email: `tenant-b-staff-${randomUUID()}@example.com`,
          password: 'tenant-b-staff-pw',
          role: Role.ANALYST,
        },
      },
    });
    expect(createResponse.body.errors).toBeUndefined();
    expect(
      (
        await adminUserRepository.findOneBy({
          id: createResponse.body.data.createAdmin.id as string,
        })
      )?.tenantId,
    ).toBe(tenantB);
  });

  it('denies a Tenant Owner creating a Super Admin', async () => {
    const owner = await seedOwner(adminUserRepository);
    const ownerCookie = extractSessionCookie(
      await login(owner.email, owner.password),
    );
    const email = `would-be-super-${randomUUID()}@example.com`;

    const response = await authedRequest(ownerCookie).send({
      query: CREATE_ADMIN_MUTATION,
      variables: {
        input: { email, password: 'irrelevant-pw', role: Role.SUPER_ADMIN },
      },
    });

    expect(response.body.data?.createAdmin).toBeUndefined();
    expect(response.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
    expect(await adminUserRepository.findOneBy({ email })).toBeNull();
  });

  // Regression guard for spec §4.2: SUPER_ADMIN was NOT added to tenant
  // business resolvers, so a Super Admin is refused like any other role not
  // on `@Roles()` — it never receives tenant business rows.
  it('gives a Super Admin a PLATFORM principal but Forbidden on customers', async () => {
    const superAdmin = await seedSuperAdmin(dataSource);
    const loginResponse = await login(superAdmin.email, superAdmin.password);
    expect(loginResponse.body.errors).toBeUndefined();
    const superAdminCookie = extractSessionCookie(loginResponse);

    const meResponse = await authedRequest(superAdminCookie).send({
      query: CURRENT_ADMIN_QUERY,
    });
    expect(meResponse.body.data.currentAdmin).toEqual({
      id: superAdmin.id,
      tenantId: null,
      role: Role.SUPER_ADMIN,
      scope: AdminScope.PLATFORM,
    });

    const loginAudit = await auditEventRepository.findOne({
      order: { occurredAt: 'DESC' },
      where: { action: 'admin.login.succeeded', actorId: superAdmin.id },
    });
    expect(loginAudit?.scope).toBe(AdminScope.PLATFORM);
    expect(loginAudit?.tenantId).toBeNull();

    const customersResponse = await authedRequest(superAdminCookie).send({
      query: 'query { customers { nodes { id } } }',
    });
    expect(customersResponse.body.data?.customers ?? null).toBeNull();
    expect(customersResponse.body.errors?.[0]?.extensions?.code).toBe(
      'FORBIDDEN',
    );

    const adminsResponse = await authedRequest(superAdminCookie).send({
      query: ADMINS_QUERY,
    });
    expect(adminsResponse.body.errors?.[0]?.extensions?.code).toBe('FORBIDDEN');
  });
});
