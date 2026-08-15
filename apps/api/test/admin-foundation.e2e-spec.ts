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
import { Role } from '../src/platform/auth/domain/role';
import { seedOwner } from './helpers/seed-owner';

// Proves spec §4.10's full 5-step Admin Foundation acceptance scenario
// end-to-end: real HTTP (supertest) against the real `AppModule` (full
// composition root — GraphQL, auth guard/strategy, admins service, audit
// logger) and a real Postgres connection. Self-contained: seeds its own
// Owner via `helpers/seed-owner.ts` rather than depending on
// `src/platform/database/seed.ts` (Task 3's dev-only, env-var-gated
// script) or any prior `pnpm db:seed` run — matching `app.e2e-spec.ts`'s
// "creates its own data" precedent.
//
// No GraphQL query exposes audit events (per spec §3) — every audit
// assertion below reads `AuditEventEntity` directly via a repository
// pulled off the same `TestingModule`, never through a query this suite
// invents.
describe('Admin Foundation (e2e)', () => {
  let app: INestApplication<App>;
  let adminUserRepository: Repository<AdminUserEntity>;
  let auditEventRepository: Repository<AuditEventEntity>;

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
      currentAdmin { id role }
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
      success: true,
      admin: { id: owner.id, role: Role.OWNER },
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
      role: Role.SCHEDULER,
      isActive: true,
    });
    const schedulerId: string = createdAdmin.id;

    const createdAuditEvent = await auditEventRepository.findOneBy({
      action: 'admin.created',
      entityId: schedulerId,
    });
    expect(createdAuditEvent).not.toBeNull();
    expect(createdAuditEvent?.actorId).toBe(owner.id);

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
      where: { action: 'admin.login.failed' },
      order: { occurredAt: 'DESC' },
    });
    expect(failedLoginAuditEvent).not.toBeNull();
    expect(failedLoginAuditEvent?.actorId).toBeNull();
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
});
