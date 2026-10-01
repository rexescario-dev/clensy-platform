import { INestApplication } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app/app.module';
import {
  VIEW_ROLES,
  WRITE_ROLES,
} from '../src/modules/bookings/presentation/graphql/booking.dto';
import { Role } from '../src/platform/auth/domain/role';
import { AuthGuard } from '../src/platform/auth/guards/auth.guard';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import {
  collectDeclaredRoutes,
  collectRegisteredRoutes,
  DeclaredRoute,
} from './helpers/http-surface';

// Regression guard for #91 (decision 2; RFC §4.5, §4.2): the HTTP
// counterpart of #90's root-operation suite. Every Express route Nest
// registered must be declared by a controller, classified in the exact
// table below, and carry the guards/roles its class requires, read the
// way Nest resolves them at runtime. Limits: metadata + route-table checks
// plus unauthenticated probes. They complement, not replace, the two-tenant
// runtime suites. Scope: the controller routes `AppModule` registers.
// Middleware mounts (`/graphql`, CORS, body parsers, static assets) are not
// routes: GraphQL is covered by #90's suites. Swagger's `/docs`,
// `/docs-json` and `/docs-yaml` are registered only by `main.ts` via
// `setupApiDocs`, never in this boot, and are owned by
// `api-docs.e2e-spec.ts`. Global guards are not asserted absent: Nest
// runs them before route guards and all must pass, so they can only add
// restrictions; the 401 probe measures the effective result. The
// `AuthGuard` check pins the current declared mechanism (class-level
// `@UseGuards(AuthGuard)`), not a generic Nest guarantee.
// This boot mirrors `main.ts` by hand (cookie parser, platform pipes). An
// app-level `setGlobalPrefix`/`enableVersioning` added only in `main.ts`
// would not appear in either inventory here; prefixes or versions set
// through module/controller metadata do, and fail closed. A prefix does not
// change guards or roles, so authorization coverage is unaffected.
type RouteClass = 'PUBLIC_DEV_ONLY' | 'TENANT_VIEW' | 'TENANT_WRITE';

const ROUTE_CLASSIFICATION: Record<string, RouteClass> = {
  'DELETE /bookings/:id': 'TENANT_WRITE',
  'GET /bookings': 'TENANT_VIEW',
  'GET /bookings/:id': 'TENANT_VIEW',
  'GET /graphiql': 'PUBLIC_DEV_ONLY',
  'PATCH /bookings/:id': 'TENANT_WRITE',
  'POST /bookings': 'TENANT_WRITE',
};

describe('HTTP route authorization (#91 guard)', () => {
  let app: INestApplication<App>;
  let declared: DeclaredRoute[];
  let registered: string[];

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule, DiscoveryModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    applyPlatformPipes(app);
    await app.init();
    declared = collectDeclaredRoutes(app);
    registered = collectRegisteredRoutes(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('runs in a non-production environment (GraphiQL is expected to be registered)', () => {
    expect(process.env.NODE_ENV).not.toBe('production');
  });

  it('records the controller Nest routes to and the declaring class for every route', () => {
    expect(
      declared.map(({ key, owner, declaredOn }) => ({
        key,
        owner,
        declaredOn,
      })),
    ).toEqual(
      expect.arrayContaining([
        {
          key: 'GET /graphiql',
          owner: 'GraphiqlController.serve',
          declaredOn: 'GraphiqlController',
        },
        {
          key: 'DELETE /bookings/:id',
          owner: 'BookingController.remove',
          declaredOn: 'BookingController',
        },
      ]),
    );
  });

  it('registers exactly the declared controller routes, without duplicates', () => {
    const declaredKeys = declared.map((route) => route.key);
    expect(new Set(declaredKeys).size).toBe(declaredKeys.length);
    expect(new Set(registered).size).toBe(registered.length);
    expect([...registered].sort()).toEqual([...declaredKeys].sort());
  });

  it('classifies every registered route exactly, with no stale entries', () => {
    expect([...registered].sort()).toEqual(
      Object.keys(ROUTE_CLASSIFICATION).sort(),
    );
  });

  it('grants SUPER_ADMIN on no route', () => {
    expect(VIEW_ROLES).not.toContain(Role.SUPER_ADMIN);
    expect(WRITE_ROLES).not.toContain(Role.SUPER_ADMIN);
    for (const route of declared) {
      const { declaredOn, key, owner } = route;
      expect({ declaredOn, key, owner, roles: route.roles ?? [] }).toEqual({
        declaredOn,
        key,
        owner,
        roles: expect.not.arrayContaining([Role.SUPER_ADMIN]),
      });
    }
  });

  it('enforces each class: public dev-only, tenant view roles, tenant write roles', () => {
    const expected: Record<
      RouteClass,
      { hasAuthGuard: boolean; roles: Role[] | undefined }
    > = {
      PUBLIC_DEV_ONLY: { hasAuthGuard: false, roles: undefined },
      TENANT_VIEW: { hasAuthGuard: true, roles: [...VIEW_ROLES] },
      TENANT_WRITE: { hasAuthGuard: true, roles: [...WRITE_ROLES] },
    };
    for (const route of declared) {
      const { declaredOn, key, owner } = route;
      const routeClass = ROUTE_CLASSIFICATION[key];
      expect({
        declaredOn,
        hasAuthGuard: route.guards.includes(AuthGuard),
        key,
        owner,
        roles: route.roles ? [...route.roles] : undefined,
      }).toEqual({ declaredOn, key, owner, ...expected[routeClass] });
    }
  });

  it('rejects every tenant route without a session cookie (401)', async () => {
    const server = app.getHttpServer();
    for (const [key, routeClass] of Object.entries(ROUTE_CLASSIFICATION)) {
      if (routeClass === 'PUBLIC_DEV_ONLY') continue;
      const [method, path] = key.split(' ');
      const url = path.replace(':id', randomUUID());
      const res = await request(server)
        [method.toLowerCase() as 'delete' | 'get' | 'patch' | 'post'](url)
        .send({});
      expect({ key, status: res.status }).toEqual({ key, status: 401 });
    }
  });

  it('serves the public dev-only route and nothing beneath it', async () => {
    const server = app.getHttpServer();
    const graphiql = await request(server).get('/graphiql');
    expect(graphiql.status).toBe(200);
    expect(graphiql.headers['content-type']).toMatch(/text\/html/);
    expect((await request(server).get('/graphiql/extra')).status).toBe(404);
    expect(
      (await request(server).get(`/bookings/${randomUUID()}/extra`)).status,
    ).toBe(404);
  });
});
