# Legacy REST & Surface Cleanup — Implementation Plan

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Kind** | Implementation plan (M4) for **one** delivery slice |
| **Date** | 2026-10-02 |
| **Tracking** | GitHub [#91](https://github.com/rexescario-dev/clensy-platform/issues/91) (program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81); depends on #85, merged). One PR for this plan (to be Accepted at M5) and the implementation (process §2.8). Branch `feat/91-legacy-rest-surface-cleanup`. |
| **Package / repo** | `clensy-platform`: `apps/api` (one new source file, `main.ts`, tests), removal of `apps/worker/` and `packages/ui/src/domain/`, comment-only edit in `packages/testing`, and docs. **No** migration, `schema.gql`, `apps/web`, GraphQL resolver, REST route, or documented REST path/operation changes. |
| **Depends on (Accepted)** | [Multi-Tenant Architecture](../specs/2026-09-23-multi-tenant-architecture-design.md) (Accepted, M3 2026-09-23): §4.5 (REST `/bookings` must not be an unauthenticated production surface; it must use the same cookie-JWT authentication and tenant isolation as GraphQL, or be removed or lab-only), §4.2 (no implicit Super Admin data access), §10 (the open "delete or rebuild REST `/bookings`" deferral, resolved by this slice). **Where this plan and that specification disagree, the specification wins**: stop and return to M2/M3. Relies on the shipped [Booking plan](2026-09-28-booking-tenant-isolation-plan.md) (#85: REST shares `AuthGuard`, `VIEW_ROLES`/`WRITE_ROLES`, `requireTenantId` and audit with GraphQL) and the [Audit & Security Sweep plan](2026-10-01-tenant-aware-audit-security-sweep-plan.md) (#90: metadata-derived GraphQL guard suites; this slice adds the HTTP counterpart). |

> **For agentic workers:** **M5 Accepted 2026-10-02** (developer review of revision 2, commit `8f875d3`, the implementation contract). **Execution method:** **Native**, inline (superpowers:executing-plans) in the developer's session, with one independent whole-branch review as the final gate. The Accept is plan acceptance only, not merge, push or deploy authorization. Steps use checkbox (`- [ ]`) syntax.
> - **Order and verification:** execute the tasks in order, test-first as written. Each `apps/api` task ends green on `pnpm --filter api test`, `pnpm --filter api lint` (lint must leave no diff) and the e2e suites the task names. `pnpm --filter api exec tsc --noEmit` must report **no errors beyond the 2 present on `main`** (`src/modules/catalog/tests/graphql/service-read.resolver.spec.ts`, `test/bookings.e2e-spec.ts`; deferred in #90). The full e2e suite, workspace `build`, `lint` and `test` run in Task 6.
> - **Stop conditions:** do not invent product semantics; stop and report on any need for a design or scope change. No push or PR as a side effect.
>
> **M5 review 1 (2026-10-02): changes requested; revised.** Each item was checked against the installed code (`@nestjs/core` 11.1.29 `paths-explorer.js`/`guards-context-creator.js`, Express 5.2.1) before it was applied.
> - **P0, Swagger route ownership.** Production mounts none of `/docs`, `/docs-json`, `/docs-yaml`; non-production mounts all three unchanged. The Task 1 guard covers `AppModule`'s controller routes, and the Swagger suite owns the three Swagger routes (Architecture, decision 2 limits, decision 3, Global Constraints).
> - **P1, OpenAPI claim narrowed** to the same `info` and documented paths and operations. No full-document snapshot is taken.
> - **P1, Express shape.** The reader asserts `router.stack` is an array and fails with a named error; the 5.2.1 dependency is pinned in the Global Constraints.
> - **P1, owner.** Each route now records `owner` (the controller Nest routes to) and `declaredOn` (the class defining the handler; `getAllMethodNames` includes inherited methods). Both are included in every per-route assertion, and a focused test pins two of them.
> - **P1, global guards.** The "no global guards" assertion is removed; the RFC does not require it. Nest concatenates global guards before route guards and all must pass, so they cannot weaken a route. The original rationale in this plan ("bypass") was wrong.
> - **P1, `AuthGuard` identity** is documented as pinning the current declared mechanism.
> - **P2:** `git grep` replaces `grep`; the first `pnpm install` is labelled lockfile regeneration only; Task 3's expected count follows `CROSS_TENANT_REFERENCE_CASES`.

**Goal:** Close #91. REST `/bookings` stays as the authenticated, tenant-scoped REST/GraphQL comparison surface, and a structural guard now keeps it (and any future REST route) that way. Swagger `/docs` is served outside production only. Two dead workspace surfaces are removed, and the docs and RFC record how the deferral was resolved.

**Architecture:** A new e2e guard suite boots `AppModule` and builds two inventories. One comes from Nest controller metadata (`DiscoveryService`, `PATH_METADATA`, `METHOD_METADATA`). The other is the live Express route layers Nest registered. The suite asserts the two match exactly, classifies every `(method, path)` against an exact table, and checks guards and roles with the precedence Nest uses at runtime. It then probes each route over HTTP. That suite covers the **controller routes `AppModule` registers**. Swagger setup moves out of `main.ts` into `setupApiDocs(app, nodeEnv)`, which mounts the Swagger routes only when `nodeEnv !== 'production'`, the same rule `GraphqlModule` uses for GraphiQL. The Swagger routes are `/docs` (UI and its assets), `/docs-json` and `/docs-yaml`. They are registered by `main.ts` and not by `AppModule`, so a separate Swagger suite owns them (decision 3). Together the two suites cover every HTTP route the API serves. The rest is deletions and doc edits.

**Tech Stack:** NestJS 11 (`@nestjs/core` `DiscoveryService`/`MetadataScanner`/`Reflector`, `@nestjs/common/constants`), `@nestjs/platform-express` (Express 5.2.1 `router.stack`), `@nestjs/swagger` 11, Jest unit (`pnpm --filter api test`) and e2e against real Postgres (`pnpm --filter api test:e2e`), pnpm workspace + Turborepo.

**Spec:** `docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md`

## Slice decisions (brainstorm 2026-10-02, developer-approved)

These are planning decisions for this slice. They add no product semantics beyond the RFC.

1. **REST `/bookings` is kept; RFC §10 is resolved as "kept, authenticated, tenant-scoped".** #85 already satisfies RFC §4.5, so its routes, request DTOs, response shape, roles and audit are unchanged. #91 adds regression protection only (decisions 2 and 4).
2. **HTTP route authorization guard** (`apps/api/test/http-route-authorization.e2e-spec.ts`), the HTTP counterpart of #90's root-operation suite:
   - **Two inventories, exact match.**
     - *Declared:* every controller from `DiscoveryService.getControllers()`. For each method from `MetadataScanner.getAllMethodNames(prototype)` that carries `METHOD_METADATA`, the route is `<RequestMethod name> /<controller PATH_METADATA>/<method PATH_METADATA>` (slashes collapsed, trailing slash removed, `/` for empty).
     - *Registered:* every Express `router.stack` layer that has a `route`, one entry per `route.methods` key, upper-cased: `<METHOD> <route.path>`. This deliberately couples the guard to Express internals: Express **5.2.1**, as installed through `@nestjs/platform-express` 11, exposes `app.router.stack`. The reader first asserts that `router.stack` is an array. If it is not, it fails with a named error stating the Express-shape dependency, rather than an opaque `Cannot read properties of undefined`.
     - The two sets must be equal, with no duplicate in either.
     - Fail closed on metadata this guard does not model: a non-string or array controller/method path, `VERSION_METADATA` on a controller or handler, or a `RequestMethod` that is not one of `GET`/`POST`/`PUT`/`PATCH`/`DELETE`.
   - **Exact classification table** keyed by `"<METHOD> <path>"`, no wildcards or prefixes. The table must equal the registered set in both directions, so a new route fails until classified and a stale entry fails too. Current table:

     | Route | Class |
     | --- | --- |
     | `GET /graphiql` | `PUBLIC_DEV_ONLY` |
     | `GET /bookings` | `TENANT_VIEW` |
     | `GET /bookings/:id` | `TENANT_VIEW` |
     | `POST /bookings` | `TENANT_WRITE` |
     | `PATCH /bookings/:id` | `TENANT_WRITE` |
     | `DELETE /bookings/:id` | `TENANT_WRITE` |

   - **Guards and roles, read the way Nest resolves them.**
     - Guards: class-level `GUARDS_METADATA` followed by method-level `GUARDS_METADATA`. That is the order `GuardsContextCreator` builds from the controller class and the handler function the router invokes. The handler is `prototype[methodName]` of the live controller's metatype.
     - Roles: `Reflector.getAllAndOverride(ROLES_KEY, [handler, class])`. This is the exact call `AuthGuard.canActivate` makes, and the suite uses the app's own `Reflector`.
     - Global guards are **not** asserted absent; the RFC requires no such invariant. `GuardsContextCreator` runs global guards and then route guards (`globalGuards.concat(scopedGuards)`), and every guard must pass. A global guard can therefore only add restrictions and can never weaken a route's `AuthGuard`/roles requirement. The live 401 probe measures the effective result.
     - **Owner.** Nest scans inherited methods too (`MetadataScanner.getAllMethodNames` walks the prototype chain) and invokes `prototype[methodName]`. The inventory therefore records `owner` as `<Controller>.<method>`, which is the controller Nest routes to, plus `declaredOn`: the class in that prototype chain that actually defines the function. Both appear in every per-route assertion object, so a failure names the route's real handler. `declaredOn` is diagnostic only. No rule depends on inheritance, and today's two controllers declare their handlers directly.
     - **`AuthGuard` identity.** The check is `guards.includes(AuthGuard)`, the class reference. It deliberately pins the repository's **current declared mechanism**, class-level `@UseGuards(AuthGuard)` on `BookingController`. It is not a generic Nest authorization guarantee: a guard applied as an instance or through another wrapper fails the check, and the suite must then be revised consciously.
   - **Class rules.**
     - `PUBLIC_DEV_ONLY`: no `AuthGuard`, no roles.
     - `TENANT_VIEW`: guards contain `AuthGuard`, and roles **equal** `VIEW_ROLES`.
     - `TENANT_WRITE`: guards contain `AuthGuard`, and roles **equal** `WRITE_ROLES`.

     `VIEW_ROLES`/`WRITE_ROLES` are imported from `booking.dto.ts`, the source GraphQL uses, so REST/GraphQL role parity is pinned. Neither set contains `SUPER_ADMIN`, which is asserted explicitly (RFC §4.2).
   - **Live probe.**
     - Every `TENANT_*` route, requested without a cookie (`:id` replaced by a random UUID), returns **401**.
     - `GET /graphiql` returns 200 `text/html`.
     - `GET /graphiql/extra` and `GET /bookings/<uuid>/extra` return 404, which pins that the allowlist is exact and not a prefix.
   - **GraphiQL dev-only** is pinned by a unit test. With `NODE_ENV=production` set before `graphql.module` is loaded (`jest.isolateModules`), `GraphqlModule`'s `controllers` metadata is empty; with `NODE_ENV=test` it is `[GraphiqlController]`.
   - **Limits, stated in the suite header:** these are metadata and route-table checks plus unauthenticated probes. They do not replace the runtime two-tenant suites. Middleware mounts (`/graphql` Apollo, CORS, body parsers, static assets) are not routes and are out of scope: GraphQL is covered by #90's suites. The Swagger routes (`/docs*`, `/docs-json`, `/docs-yaml`) are not in this inventory because they are registered by `main.ts` via `setupApiDocs`, not by `AppModule`. The Swagger suite owns them (decision 3).
3. **Swagger `/docs` is mounted outside production only.**
   - `main.ts`'s inline Swagger block moves verbatim into `src/platform/openapi/setup-api-docs.ts` as `setupApiDocs(app: INestApplication, nodeEnv: string | undefined): void`. It mounts at `docs` iff `nodeEnv !== 'production'`, the same rule as `GraphqlModule`'s GraphiQL.
   - `main.ts` calls `setupApiDocs(app, process.env.NODE_ENV)`.
   - Route ownership: `setupApiDocs` registers `/docs` (UI plus its asset routes), `/docs-json` and `/docs-yaml`. In production, **none** of them is mounted. Outside production, all of them are mounted exactly as today.
   - The `DocumentBuilder` title, description and version, the mount path `docs`, and the documented REST paths and operations are unchanged. The slice is about **mounting**, so it does not claim, or test, a byte-identical OpenAPI document. Schemas, parameters and responses are produced by the same unchanged decorators. This is about documentation and schema disclosure only. It touches no auth or tenant context, imports nothing from `platform/auth`, and changes no route.
   - Pinned by `test/api-docs.e2e-spec.ts`:
     - **Production:** no route layer whose path starts with `/docs` is registered, and `GET /docs`, `GET /docs-json` and `GET /docs-yaml` all return 404.
     - **Non-production:** `GET /docs` returns 200 HTML and `GET /docs-yaml` returns 200. `GET /docs-json` returns today's exact `info` and the same documented paths and operations: `/graphiql` (`get`), `/bookings` (`get`, `post`), `/bookings/{id}` (`get`, `patch`, `delete`). These values were captured by a planning-time probe against `main`.
4. **REST parity for cross-tenant references.**
   - Before this slice, `bookings.tenant-isolation` Case 5 pinned the 404 for another tenant's `customerId`/`propertyId`/`serviceId`/`teamId` on create through GraphQL only.
   - On REST, only `teamId` was covered (`teams-cleaners.tenant-isolation`), and only on `PATCH`/`POST`.
   - This slice adds the REST rows to Case 5, using the same `CROSS_TENANT_REFERENCE_CASES` table:
     - `POST /bookings` as tenant B with each tenant-A id returns 404, and tenant B's booking count is unchanged;
     - `PATCH /bookings/:id` with A's `teamId` returns 404, and `bookingB.teamId` is unchanged;
     - a REST positive control.
   - These pass on first run; they are parity coverage, not a fix. Task 3 proves they can fail.
5. **Dead workspace surfaces are removed.** Neither one touches tenant data; both are now intentional #91 cleanup.
   - **`apps/worker/`** (`README.md` and `package.json` only; no CI, Docker, compose or turbo reference). Delete it, refresh `pnpm-lock.yaml` (drops the `apps/worker: {}` importer), and update its mentions:
     - root `README.md` tree (line 13) and the Docker paragraph (line 107);
     - `infrastructure/README.md`;
     - the comment in `packages/testing/src/index.ts`.
   - **`packages/ui/src/domain/`** (`README.md` only; nothing imports, exports or configures it). Delete it and rewrite the `domain/` lines in `packages/ui/README.md`: the "Boundary" bullet (line 14), the "Layout" bullet (lines 37–42) and the `src/index.ts` note (lines 45–46). The new text points domain composition to `@clensy/web`.
   - Historical specs and plans under `docs/superpowers/` are **not** edited.
6. **Docs.**
   - Root `README.md`:
     - REST row: keep the existing (accurate) text and append that every HTTP route is checked by the #91 route guard.
     - REST docs and OpenAPI rows: mark them **dev-only** like GraphiQL.
   - `docs/README.md`: add a `## Legacy REST & surface cleanup (#91)` section.
   - RFC (`2026-09-23-multi-tenant-architecture-design.md`), and only these two edits:
     - **Tracking cell:** add `Legacy REST & Surface Cleanup slice: [#91](…/issues/91) (PR [#…](…)).` after the #90 entry, and change `Remaining slices: [#91](…)–[#92](…)` to `Remaining slice: [#92](…)`.
     - **§10 bullet** "Whether REST `/bookings` is deleted or rebuilt …": append ` — **Resolved:** REST is kept, authenticated, and tenant-scoped (#85/#91).`
   - The `BookingController` header comment stays: it is accurate. The single-production-tenant rule is not touched (#92).

## Global Constraints

- RFC §4.5: tenant id only from `AuthenticatedPrincipal.tenantId`; REST `/bookings` stays authenticated and tenant-isolated; cross-tenant is 404, never 403.
- RFC §4.2: no REST route grants `SUPER_ADMIN`.
- No change to any REST route, DTO, response shape, role set, audit event, GraphQL operation, `schema.gql`, migration, or the documented REST paths and operations (decision 3).
- Route ownership: the HTTP route guard (Task 1) owns every controller route `AppModule` registers. The Swagger suite (Task 2) owns `/docs`, `/docs-json` and `/docs-yaml`, which only `main.ts` registers via `setupApiDocs`: none of them in production, all of them unchanged elsewhere.
- The route guard's registered inventory depends on Express 5's `router.stack` shape (installed 5.2.1). A shape change must fail with a named error (decision 2).
- `setupApiDocs` must not depend on auth or tenant context (decision 3).
- Allowlists are exact `(METHOD, path)` keys with no prefix or wildcard (decision 2).
- RFC text is edited only in the Tracking cell and the one §10 bullet (decision 6). Historical plans and specs are untouched.
- The single-production-tenant rule stays in force; lifting it is #92 and a human decision.

## Review Focus

Failure modes the design implies that no existing test exercises, most likely first. Each one is pinned by a test in the owning task.

1. **A route that is registered but not declared, or declared under a different path** (path normalization, a future global prefix or versioning) would slip past a metadata-only guard. Pinned in Task 1: the declared and Express-registered inventories must be equal, and versioning metadata fails closed.
2. **A prefix-style allowlist** would make `/graphiql/anything` or `/docs/foo` public. Pinned in Task 1: exact-key table equality plus 404 probes on `GET /graphiql/extra` and `GET /bookings/<uuid>/extra`.
3. **Roles present on the class but overridden on the handler** change effective authorization without changing class metadata. Pinned in Task 1: roles are read with the app's `Reflector.getAllAndOverride([handler, class])`, and the live 401 probe measures the effective result, global guards included.
4. **Swagger gating that also changes what is documented** (title, paths, operations), or that misses `/docs-json` or `/docs-yaml`. Pinned in Task 2: exact `info`, paths and operations in non-production, and no `/docs*` layers plus 404 on all three in production.
5. **Deleting a workspace package breaks the lockfile or a turbo pipeline.** Pinned in Task 4: `pnpm install --frozen-lockfile` and the workspace `build`/`lint`/`test` pass.

---

### Task 1: HTTP route authorization guard (decision 2)

**Files:**
- Create: `apps/api/test/helpers/http-surface.ts`
- Create: `apps/api/test/http-route-authorization.e2e-spec.ts`
- Create: `apps/api/src/platform/graphql/tests/graphiql-dev-only.spec.ts`

**Interfaces:**
- Produces: `collectDeclaredRoutes(app: INestApplication): DeclaredRoute[]`, `collectRegisteredRoutes(app: INestApplication): string[]`, `routeKey(method: string, path: string): string`, and `type DeclaredRoute = { key: string; owner: string; declaredOn: string; guards: unknown[]; roles: Role[] | undefined }`.

The helper is deliberately separate from #90's `graphql-surface.ts`. That file is left untouched in this slice; merging the two readers is an M8 candidate, not #91 scope.

- [ ] **Step 1: Write the helper**

```ts
// apps/api/test/helpers/http-surface.ts
import { INestApplication, RequestMethod } from '@nestjs/common';
import {
  GUARDS_METADATA,
  METHOD_METADATA,
  PATH_METADATA,
  VERSION_METADATA,
} from '@nestjs/common/constants';
import { DiscoveryService, MetadataScanner, Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../src/platform/auth/decorators/roles.decorator';
import type { Role } from '../../src/platform/auth/domain/role';

export interface DeclaredRoute {
  key: string;
  // `<Controller>.<method>`: the controller Nest routes to.
  owner: string;
  // The class in that controller's prototype chain that defines the
  // handler (MetadataScanner also returns inherited methods). Diagnostic.
  declaredOn: string;
  guards: unknown[];
  roles: Role[] | undefined;
}

const SUPPORTED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

export function routeKey(method: string, path: string): string {
  const normalized = `/${path}`.replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
  return `${method.toUpperCase()} ${normalized}`;
}

function declaringClass(prototype: object, methodName: string): string {
  for (
    let current: object | null = prototype;
    current;
    current = Object.getPrototypeOf(current) as object | null
  ) {
    if (Object.prototype.hasOwnProperty.call(current, methodName)) {
      return (current as { constructor: { name: string } }).constructor.name;
    }
  }
  throw new Error(`${methodName}: no declaring class in the prototype chain`);
}

function singlePath(value: unknown, where: string): string {
  if (value === undefined) return '';
  if (typeof value !== 'string') {
    throw new Error(`${where}: unsupported path metadata ${JSON.stringify(value)}`);
  }
  return value;
}

// Declared inventory: what Nest's RouterExplorer registers, read from the
// same metadata it reads. Guards are concatenated class-first then
// method, the order GuardsContextCreator builds; roles use the app's own
// Reflector with AuthGuard's exact getAllAndOverride([handler, class]).
export function collectDeclaredRoutes(app: INestApplication): DeclaredRoute[] {
  const discovery = app.get(DiscoveryService);
  const scanner = app.get(MetadataScanner);
  const reflector = app.get(Reflector);
  const routes: DeclaredRoute[] = [];
  for (const wrapper of discovery.getControllers()) {
    const controller = wrapper.metatype as
      | (new (...args: unknown[]) => unknown)
      | null;
    if (!controller) {
      throw new Error(`controller ${String(wrapper.name)} has no metatype`);
    }
    if (Reflect.getMetadata(VERSION_METADATA, controller) !== undefined) {
      throw new Error(`${controller.name}: versioned controllers are not modelled`);
    }
    const basePath = singlePath(
      Reflect.getMetadata(PATH_METADATA, controller),
      controller.name,
    );
    const prototype = controller.prototype as Record<string, unknown>;
    for (const methodName of scanner.getAllMethodNames(prototype)) {
      const handler = prototype[methodName] as object;
      const requestMethod = Reflect.getMetadata(METHOD_METADATA, handler) as
        | RequestMethod
        | undefined;
      if (requestMethod === undefined) continue;
      const owner = `${controller.name}.${methodName}`;
      const method = RequestMethod[requestMethod];
      if (!SUPPORTED_METHODS.has(method)) {
        throw new Error(`${owner}: unsupported request method ${method}`);
      }
      if (Reflect.getMetadata(VERSION_METADATA, handler) !== undefined) {
        throw new Error(`${owner}: versioned handlers are not modelled`);
      }
      const path = singlePath(Reflect.getMetadata(PATH_METADATA, handler), owner);
      routes.push({
        key: routeKey(method, `${basePath}/${path}`),
        owner,
        declaredOn: declaringClass(prototype, methodName),
        guards: [
          ...((Reflect.getMetadata(GUARDS_METADATA, controller) as
            unknown[] | undefined) ?? []),
          ...((Reflect.getMetadata(GUARDS_METADATA, handler) as
            unknown[] | undefined) ?? []),
        ],
        roles: reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [
          handler as () => unknown,
          controller,
        ]),
      });
    }
  }
  return routes;
}

interface ExpressLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

// Registered inventory: the Express route layers that actually serve
// requests. Middleware mounts (Apollo `/graphql`, CORS, body parsers,
// static assets) carry no `route` and are out of scope (suite header).
// Deliberately coupled to Express 5's internal `app.router.stack` (5.2.1
// via @nestjs/platform-express 11); a shape change fails here by name.
export function collectRegisteredRoutes(app: INestApplication): string[] {
  const instance = app.getHttpAdapter().getInstance() as {
    router?: { stack?: unknown };
  };
  const stack = instance.router?.stack;
  if (!Array.isArray(stack)) {
    throw new Error(
      'collectRegisteredRoutes: expected Express 5 `app.router.stack` to be an array; ' +
        'the Express router shape changed, so update this reader',
    );
  }
  return (stack as ExpressLayer[]).flatMap((layer) =>
    layer.route
      ? Object.keys(layer.route.methods).map((method) =>
          routeKey(method, layer.route!.path),
        )
      : [],
  );
}
```

- [ ] **Step 2: Write the e2e suite**

```ts
// apps/api/test/http-route-authorization.e2e-spec.ts
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
type RouteClass = 'PUBLIC_DEV_ONLY' | 'TENANT_VIEW' | 'TENANT_WRITE';

const ROUTE_CLASSIFICATION: Record<string, RouteClass> = {
  'GET /graphiql': 'PUBLIC_DEV_ONLY',
  'GET /bookings': 'TENANT_VIEW',
  'GET /bookings/:id': 'TENANT_VIEW',
  'POST /bookings': 'TENANT_WRITE',
  'PATCH /bookings/:id': 'TENANT_WRITE',
  'DELETE /bookings/:id': 'TENANT_WRITE',
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
      declared.map(({ key, owner, declaredOn }) => ({ key, owner, declaredOn })),
    ).toEqual(
      expect.arrayContaining([
        { key: 'GET /graphiql', owner: 'GraphiqlController.serve', declaredOn: 'GraphiqlController' },
        { key: 'DELETE /bookings/:id', owner: 'BookingController.remove', declaredOn: 'BookingController' },
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
      const { key, owner, declaredOn } = route;
      expect({ key, owner, declaredOn, roles: route.roles ?? [] }).toEqual({
        key,
        owner,
        declaredOn,
        roles: expect.not.arrayContaining([Role.SUPER_ADMIN]),
      });
    }
  });

  it('enforces each class: public dev-only, tenant view roles, tenant write roles', () => {
    const expected: Record<RouteClass, { hasAuthGuard: boolean; roles: Role[] | undefined }> = {
      PUBLIC_DEV_ONLY: { hasAuthGuard: false, roles: undefined },
      TENANT_VIEW: { hasAuthGuard: true, roles: [...VIEW_ROLES] },
      TENANT_WRITE: { hasAuthGuard: true, roles: [...WRITE_ROLES] },
    };
    for (const route of declared) {
      const { key, owner, declaredOn } = route;
      const routeClass = ROUTE_CLASSIFICATION[key];
      expect({
        key,
        owner,
        declaredOn,
        hasAuthGuard: route.guards.includes(AuthGuard),
        roles: route.roles ? [...route.roles] : undefined,
      }).toEqual({ key, owner, declaredOn, ...expected[routeClass] });
    }
  });

  it('rejects every tenant route without a session cookie (401)', async () => {
    const server = app.getHttpServer();
    for (const [key, routeClass] of Object.entries(ROUTE_CLASSIFICATION)) {
      if (routeClass === 'PUBLIC_DEV_ONLY') continue;
      const [method, path] = key.split(' ');
      const url = path.replace(':id', randomUUID());
      const res = await request(server)[
        method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete'
      ](url).send({});
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
```

If `VIEW_ROLES`/`WRITE_ROLES` are not exported from `booking.dto.ts` under those names, use whatever the controller imports today (`booking.controller.ts:20`). Do **not** redefine the sets in the test.

- [ ] **Step 3: Write the GraphiQL dev-only unit test**

```ts
// apps/api/src/platform/graphql/tests/graphiql-dev-only.spec.ts
import { MODULE_METADATA } from '@nestjs/common/constants';

// #91 decision 2: GraphiQL is the only public HTTP route, and only outside
// production. `graphql.module.ts` decides at import time, so each case
// loads it in isolation under the NODE_ENV being tested.
function controllersFor(nodeEnv: string): unknown[] {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    let controllers: unknown[] = [];
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { GraphqlModule } = require('../graphql.module') as {
        GraphqlModule: object;
      };
      controllers = Reflect.getMetadata(
        MODULE_METADATA.CONTROLLERS,
        GraphqlModule,
      ) as unknown[];
    });
    return controllers;
  } finally {
    process.env.NODE_ENV = previous;
  }
}

describe('GraphqlModule GraphiQL registration', () => {
  it('registers no controller in production', () => {
    expect(controllersFor('production')).toEqual([]);
  });

  it('registers GraphiqlController outside production', () => {
    const controllers = controllersFor('test');
    expect(controllers).toHaveLength(1);
    expect((controllers[0] as { name: string }).name).toBe('GraphiqlController');
  });
});
```

If the repo's ESLint config already allows `require` in tests, drop the disable comment. `pnpm --filter api lint` must leave no diff.

- [ ] **Step 4: Run both and verify they pass**

Run: `pnpm --filter api test:e2e -- http-route-authorization` and `pnpm --filter api test -- graphiql-dev-only`
Expected: PASS. This is a guard over already-correct code. If a step fails, the cause is a real finding or a wrong assumption in this plan: stop and report it, and do not loosen the assertion.

- [ ] **Step 5: Prove the guard bites (throwaway, not committed)**

Make each of the following changes in turn, run the e2e suite, confirm the named failure, then revert with `git checkout -- <file>`:
1. Remove `@Roles(...WRITE_ROLES)` from `BookingController.remove`. Expect the class-rules test to fail (roles `undefined` vs `WRITE_ROLES`).
2. Add `@Get('ping') ping() { return 'ok'; }` to `BookingController`. Expect the classification test to fail with an extra `GET /bookings/ping`.
3. Change `ROUTE_CLASSIFICATION`'s `'GET /graphiql'` key to `'GET /graphiql/*'`. Expect the classification test to fail.

Run `git status --short` afterwards; only the three new files may appear.

- [ ] **Step 6: Lint, typecheck, commit**

```bash
pnpm --filter api lint && git diff --exit-code
pnpm --filter api exec tsc --noEmit   # only the 2 pre-existing errors
git add apps/api/test/helpers/http-surface.ts apps/api/test/http-route-authorization.e2e-spec.ts apps/api/src/platform/graphql/tests/graphiql-dev-only.spec.ts
git commit -m "test(91): HTTP route authorization guard over declared and registered routes"
```

---

### Task 2: Swagger `/docs` outside production only (decision 3)

**Files:**
- Create: `apps/api/src/platform/openapi/setup-api-docs.ts`
- Create: `apps/api/test/api-docs.e2e-spec.ts`
- Modify: `apps/api/src/main.ts:3,31-37`

**Interfaces:**
- Produces: `setupApiDocs(app: INestApplication, nodeEnv: string | undefined): void`

- [ ] **Step 1: Write the failing e2e test**

```ts
// apps/api/test/api-docs.e2e-spec.ts
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app/app.module';
import { setupApiDocs } from '../src/platform/openapi/setup-api-docs';
import { collectRegisteredRoutes } from './helpers/http-surface';

// #91 decision 3: Swagger is a documentation/schema-disclosure surface,
// mounted only outside production (the GraphiQL rule). The document itself
// documents the same paths and operations; the expected values were
// captured from `main` at planning.
async function bootWithDocs(nodeEnv: string): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  setupApiDocs(app, nodeEnv);
  await app.init();
  return app;
}

describe('API docs (Swagger) mounting (#91)', () => {
  describe('production', () => {
    let app: INestApplication<App>;
    beforeAll(async () => {
      app = await bootWithDocs('production');
    });
    afterAll(async () => {
      await app.close();
    });

    it('registers no /docs route', () => {
      expect(
        collectRegisteredRoutes(app).filter((key) =>
          key.split(' ')[1].startsWith('/docs'),
        ),
      ).toEqual([]);
    });

    it('serves none of /docs, /docs-json, /docs-yaml', async () => {
      const server = app.getHttpServer();
      for (const path of ['/docs', '/docs-json', '/docs-yaml']) {
        expect({ path, status: (await request(server).get(path)).status }).toEqual({
          path,
          status: 404,
        });
      }
    });
  });

  describe('non-production', () => {
    let app: INestApplication<App>;
    beforeAll(async () => {
      app = await bootWithDocs('development');
    });
    afterAll(async () => {
      await app.close();
    });

    it('serves the Swagger UI and the YAML document', async () => {
      const ui = await request(app.getHttpServer()).get('/docs');
      expect(ui.status).toBe(200);
      expect(ui.headers['content-type']).toMatch(/text\/html/);
      expect((await request(app.getHttpServer()).get('/docs-yaml')).status).toBe(200);
    });

    // Mounting slice: pins the same info and documented paths/operations,
    // not a byte-identical OpenAPI document (decision 3).
    it('documents the same REST paths and operations', async () => {
      const res = await request(app.getHttpServer()).get('/docs-json');
      expect(res.status).toBe(200);
      const doc = res.body as {
        info: Record<string, unknown>;
        paths: Record<string, Record<string, unknown>>;
      };
      expect(doc.info).toEqual({
        title: 'Clensy Platform API',
        description: 'REST surface — see /graphql for the GraphQL equivalent',
        version: '0.0.1',
        contact: {},
      });
      expect(
        Object.fromEntries(
          Object.entries(doc.paths).map(([path, ops]) => [
            path,
            Object.keys(ops).sort(),
          ]),
        ),
      ).toEqual({
        '/graphiql': ['get'],
        '/bookings': ['get', 'post'],
        '/bookings/{id}': ['delete', 'get', 'patch'],
      });
    });
  });
});
```

The e2e run sets `NODE_ENV=test`, so `/graphiql` is registered in both boots. The production case only exercises `setupApiDocs`'s own argument.

- [ ] **Step 2: Run it and verify it fails**

Run: `pnpm --filter api test:e2e -- api-docs`
Expected: FAIL. `Cannot find module '../src/platform/openapi/setup-api-docs'`.

- [ ] **Step 3: Implement `setupApiDocs`**

```ts
// apps/api/src/platform/openapi/setup-api-docs.ts
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Swagger UI (`/docs`) and the raw document (`/docs-json`, `/docs-yaml`)
// are a schema-disclosure/dev tool, like GraphiQL, so they follow the same
// rule: mounted only when NODE_ENV is not 'production' (#91 decision 3;
// see graphql.module.ts for GraphiQL). What is documented is unchanged.
// Deliberately independent of auth and tenant context.
export function setupApiDocs(
  app: INestApplication,
  nodeEnv: string | undefined,
): void {
  if (nodeEnv === 'production') {
    return;
  }
  const config = new DocumentBuilder()
    .setTitle('Clensy Platform API')
    .setDescription('REST surface — see /graphql for the GraphQL equivalent')
    .setVersion('0.0.1')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
}
```

- [ ] **Step 4: Call it from `main.ts`**

Replace the `DocumentBuilder`/`SwaggerModule` block (`main.ts:31-37`) with:

```ts
  setupApiDocs(app, process.env.NODE_ENV);
```

Replace the import `import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';` with `import { setupApiDocs } from './platform/openapi/setup-api-docs';`. Keep the call at the same position, after `applyPlatformPipes(app)` and before the GraphiQL static assets.

- [ ] **Step 5: Run and verify it passes**

Run: `pnpm --filter api test:e2e -- api-docs` and `pnpm --filter api build`
Expected: PASS, and the build compiles `main.ts`.

- [ ] **Step 6: Lint, typecheck, commit**

```bash
pnpm --filter api lint && git diff --exit-code
pnpm --filter api exec tsc --noEmit   # only the 2 pre-existing errors
git add apps/api/src/platform/openapi/setup-api-docs.ts apps/api/src/main.ts apps/api/test/api-docs.e2e-spec.ts
git commit -m "feat(91): mount Swagger /docs outside production only, document unchanged"
```

---

### Task 3: REST parity for cross-tenant references (decision 4)

**Files:**
- Modify: `apps/api/test/bookings.tenant-isolation.e2e-spec.ts` (inside `describe('Case 5: …')`, after the GraphQL `updateBooking(teamId …)` test, before its `afterAll`)

**Interfaces:**
- Consumes: the file's existing `app`, `cookieB`, `bookingB`, `teamB`, `teamA`, `tenantB`, `bookingRepository`, `baselineCreateInputForB`, `bookingCountForTenant`, and Case 5's `CROSS_TENANT_REFERENCE_CASES`.

- [ ] **Step 1: Add the REST cases**

```ts
    // #91 decision 4: REST parity. The same tenant-A references are 404
    // through REST `/bookings`, and nothing is written.
    let restControlBookingId: string | undefined;

    it('REST POST /bookings accepts the unmodified baseline (all-B) body as a positive control', async () => {
      const res = await request(app.getHttpServer())
        .post('/bookings')
        .set('Cookie', cookieB)
        .send(baselineCreateInputForB());
      expect(res.status).toBe(201);
      restControlBookingId = (res.body as { id: string }).id;
      expect(restControlBookingId).toBeTruthy();
    });

    it.each(CROSS_TENANT_REFERENCE_CASES)(
      'REST POST /bookings with %s pointing at tenant A is 404 and leaves tenant B unchanged',
      async (_label, buildOverride) => {
        const countBefore = await bookingCountForTenant(tenantB);

        const res = await request(app.getHttpServer())
          .post('/bookings')
          .set('Cookie', cookieB)
          .send(baselineCreateInputForB(buildOverride()));
        expect(res.status).toBe(404);

        expect(await bookingCountForTenant(tenantB)).toBe(countBefore);
      },
    );

    it("REST PATCH /bookings/:id with A's teamId as B is 404, and bookingB.teamId is unchanged", async () => {
      const res = await request(app.getHttpServer())
        .patch(`/bookings/${bookingB.id}`)
        .set('Cookie', cookieB)
        .send({ teamId: teamA.id });
      expect(res.status).toBe(404);

      const stillB = await bookingRepository.findOneBy({ id: bookingB.id });
      expect(stillB?.teamId).toBe(teamB.id);
    });
```

Extend Case 5's existing `afterAll` to also delete `restControlBookingId`:

```ts
      if (restControlBookingId) {
        await bookingRepository.delete({ id: restControlBookingId });
      }
```

If `BookingEntity` exposes the team as a relation rather than a `teamId` column, assert through `GET /bookings/:id` as B instead (`res.body.teamId === teamB.id`; `toBookingResponse` includes `teamId`). Use whichever the entity defines; do not add a column.

- [ ] **Step 2: Run and verify it passes**

Run: `pnpm --filter api test:e2e -- bookings.tenant-isolation`
Expected: PASS, with one REST positive control, one test per existing `CROSS_TENANT_REFERENCE_CASES` entry, and one REST PATCH test.

- [ ] **Step 3: Prove it bites (throwaway, not committed)**

In `bookings.service.ts` `resolveAndValidate` (around line 281), temporarily change `if (!customer) {` to `if (false) {`. A foreign `customerId` then gets past the tenant-scoped lookup, and the request ends in the database's composite-FK rejection (#85), so it no longer returns 404. Rerun `bookings.tenant-isolation` and expect the REST `customerId` row, and its GraphQL twin, to fail on the status assertion. Revert with `git checkout -- apps/api/src/modules/bookings/application/services/bookings.service.ts`.

- [ ] **Step 4: Lint, commit**

```bash
pnpm --filter api lint && git diff --exit-code
git add apps/api/test/bookings.tenant-isolation.e2e-spec.ts
git commit -m "test(91): REST parity for cross-tenant booking references"
```

---

### Task 4: Remove the `apps/worker` placeholder (decision 5)

TDD does not apply (deletion plus docs). Verification: lockfile, workspace build and a reference scan.

**Files:**
- Delete: `apps/worker/README.md`, `apps/worker/package.json`
- Modify: `pnpm-lock.yaml` (regenerated), `README.md:13` and `README.md:107`, `infrastructure/README.md:3`, `packages/testing/src/index.ts:1-2`

- [ ] **Step 1: Delete and refresh the lockfile**

```bash
git rm -r apps/worker
pnpm install   # lockfile regeneration only, not validation (Step 3 validates)
git diff pnpm-lock.yaml   # expect only the `apps/worker: {}` importer removed
```

If the lockfile diff touches anything other than the `apps/worker` importer, stop and report it.

- [ ] **Step 2: Update the references**

- `README.md` tree: delete the line `└── worker/   not yet implemented`, and change the previous `├── web/` line's connector to `└── web/`. Re-indent the two continuation lines under `web/` from `│             ` to `              `.
- `README.md:107`: delete the final sentence ``"`apps/worker` has no `docker-compose.yml` service — it's not yet implemented (see the tree above)."``.
- `infrastructure/README.md:3`: `Not yet populated. Planned home for per-service Dockerfiles once more services need container builds.`
- `packages/testing/src/index.ts:1-2`: `// Not yet implemented. Intended to hold shared test utilities/fixtures` / `// reused across apps/api and apps/web test suites.`

- [ ] **Step 3: Verify**

```bash
pnpm install --frozen-lockfile
pnpm build
git grep -n -E 'apps/worker|worker/ ' -- ':!docs/superpowers/'
```

Expected: `pnpm install --frozen-lockfile` passes (the invariant for the final tree), the build succeeds, and `git grep` finds nothing (exit 1). It scans tracked files only. Historical specs and plans are excluded on purpose.

- [ ] **Step 4: Commit**

```bash
git add -A apps/worker pnpm-lock.yaml README.md infrastructure/README.md packages/testing/src/index.ts
git commit -m "chore(91): remove the unimplemented apps/worker placeholder"
```

---

### Task 5: Remove the legacy `packages/ui/src/domain/` (decision 5)

TDD does not apply (deletion plus docs). Verification: package build, lint, test and a reference scan.

**Files:**
- Delete: `packages/ui/src/domain/README.md`
- Modify: `packages/ui/README.md:14,37-42,45-46`

- [ ] **Step 1: Delete**

```bash
git rm -r packages/ui/src/domain
```

- [ ] **Step 2: Rewrite the README lines**

- Boundary bullet (line 14), replace with: `- Domain-specific composition (components representing a Clensy business concept) does not belong here; it lives in [`@clensy/web`](../../packages/web/README.md).`
- Layout: delete the `src/domain/` bullet (lines 37–42).
- `src/index.ts` bullet (lines 45–46), replace with: `- `src/index.ts` — the public export surface: every `base/` export.`

- [ ] **Step 3: Verify**

```bash
pnpm --filter @clensy/ui build && pnpm --filter @clensy/ui lint && pnpm --filter @clensy/ui test
git grep -n -E 'src/domain|domain/' -- packages/ui
```

Expected: all three pass, and `git grep` finds nothing (exit 1).

- [ ] **Step 4: Commit**

```bash
git add -A packages/ui
git commit -m "chore(91): remove the legacy empty @clensy/ui domain/ directory"
```

---

### Task 6: Docs, RFC resolution and full verification (decisions 1, 6)

TDD does not apply (docs). Verification: the full suites below.

**Files:**
- Modify: `README.md` (REST, REST docs and OpenAPI rows, lines 144–146)
- Modify: `docs/README.md` (new section after `## Tenant-aware audit & security sweep (#90)`)
- Modify: `docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md` (Tracking cell, line 8; §10 bullet, line 267)

- [ ] **Step 1: Root README rows**

- REST API row: keep the text, and append `; every HTTP route is checked by the #91 route guard`.
- REST docs (Swagger UI) row: `interactive explorer, equivalent to GraphiQL — dev-only (not mounted when NODE_ENV=production)`.
- OpenAPI spec row: `raw JSON — dev-only, with /docs`.

- [ ] **Step 2: `docs/README.md` section**

```markdown
## Legacy REST & surface cleanup (#91)

REST `/bookings` stays as the REST/GraphQL comparison surface. It is authenticated with the same session cookie, roles and tenant scope as GraphQL (#85), which resolves the RFC §10 "delete or rebuild" question: kept, authenticated, tenant-scoped. A new e2e guard (`apps/api/test/http-route-authorization.e2e-spec.ts`) checks every controller route on each run. The routes Nest declares must match the routes Express serves exactly. Each route must be listed in an exact classification table. Tenant routes must use `AuthGuard` with GraphQL's own view or write role set, which never includes Super Admin. Every tenant route must return 401 without a session. The only public route is GraphiQL, which is dev-only. The guard covers the controller routes `AppModule` registers. The Swagger routes are covered by their own suite. These are metadata and route-table checks; the two-tenant suites remain the runtime proof of isolation. REST cross-tenant references (another tenant's customer, property, service or team) are now pinned as 404 alongside the GraphQL cases.

Swagger (`/docs`, `/docs-json`, `/docs-yaml`) is now mounted only outside production, the same rule as GraphiQL. In production none of the three is served. Elsewhere they are unchanged and document the same REST paths and operations.

Removed: the unimplemented `apps/worker` placeholder and the empty legacy `packages/ui/src/domain/` directory. Domain composition lives in `@clensy/web`.
```

- [ ] **Step 3: RFC, these two edits only**

- Tracking cell: after `Tenant-Aware Audit & Security Sweep slice: [#90](…) (PR [#107](…)).` insert ` Legacy REST & Surface Cleanup slice: [#91](https://github.com/rexescario-dev/clensy-platform/issues/91) (PR [#<n>](https://github.com/rexescario-dev/clensy-platform/pull/<n>)).`, using the PR number once the PR exists. Before then, leave `(PR pending)` and replace it at PR creation. Change `Remaining slices: [#91](…)–[#92](…) under program [#81](…)` to `Remaining slice: [#92](https://github.com/rexescario-dev/clensy-platform/issues/92) under program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81)`.
- §10: append to the bullet `Whether REST `/bookings` is deleted or rebuilt as authenticated GraphQL-equivalent (both satisfy §4.5 if not left unauthenticated in production).` the text ` **Resolved:** REST is kept, authenticated, and tenant-scoped (#85/#91).`

Check: `git diff docs/superpowers/specs/` shows exactly those two hunks.

- [ ] **Step 4: Full verification**

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm lint && git diff --exit-code
pnpm test
pnpm --filter api test:e2e
pnpm --filter api exec tsc --noEmit   # only the 2 pre-existing errors
git diff main --stat -- apps/api/src/modules apps/api/src/schema.gql apps/api/src/platform/database   # expect empty
```

Expected: every command passes, and the last diff is empty (no route, resolver, schema or migration change).

- [ ] **Step 5: Commit**

```bash
git add README.md docs/README.md docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md
git commit -m "docs(91): document the REST route guard and dev-only Swagger, resolve RFC §10 REST deferral"
```

## Traceability

| Task | Decision | RFC |
| --- | --- | --- |
| 1 HTTP route guard | 2 | §4.5 (REST uses GraphQL's auth and tenant isolation), §4.2 (no Super Admin) |
| 2 Swagger dev-only | 3 | §4.5 (no production lab surfaces), informative |
| 3 REST reference parity | 4 | §4.4 / §4.5 (cross-tenant references are 404) |
| 4–5 Dead surfaces | 5 | #91 scope ("tenant-unaware or dead application surfaces") |
| 6 Docs / RFC | 1, 6 | §10 deferral resolved; Tracking |

## Deferred / out of scope

- #92 two-tenant release gate and lifting the single-production-tenant rule.
- #106 relation-level RBAC.
- Merging `http-surface.ts` with #90's `graphql-surface.ts` readers (M8 candidate).
- The 2 pre-existing `tsc --noEmit` errors and CI's missing `tsc` step (recorded in #90).
- Any GraphQL, UI, schema or migration change.
