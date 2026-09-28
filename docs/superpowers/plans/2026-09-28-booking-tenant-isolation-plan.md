# Booking Tenant Isolation — Implementation Plan

| Field | Value |
| --- | --- |
| **Status** | Draft |
| **Kind** | Implementation plan (M4) for **one** delivery slice |
| **Date** | 2026-09-28 |
| **Tracking** | GitHub [#85](https://github.com/rexescario-dev/clensy-platform/issues/85) (program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81)). One PR for this plan (Accepted at M5) + implementation (process §2.8). Branch `feat/85-booking-tenant-isolation`. |
| **Package / repo** | `clensy-platform` — `apps/api` only |
| **Depends on (Accepted)** | [Multi-Tenant Architecture](../specs/2026-09-23-multi-tenant-architecture-design.md) (Accepted, M3 2026-09-23). **Where this plan and that specification disagree, the specification wins** — stop and return to M2/M3. Relies on the shipped [Tenant Identity Foundation plan](2026-09-23-tenant-identity-foundation-plan.md) (#68: principal `{ id, role, scope, tenantId }`, `BOOTSTRAP_TENANT_ID`, `test/helpers/seed-tenant-admin.ts`), [Customer & Property Tenant Isolation plan](2026-09-24-customer-property-tenant-isolation-plan.md) (#82: `tenantReadAuthorizer` / `tenantFilterFor`, `requireTenantId`, `uq_customer_id_tenant`, `uq_property_id_tenant`, relation-override regression pattern, I1 relation-filter finding carried to this slice), [Teams & Cleaners Tenant Isolation plan](2026-09-27-teams-cleaners-tenant-isolation-plan.md) (#83: `uq_team_id_tenant`, `UpdateBookingCommand.tenantId`) and [Catalog Tenant Isolation plan](2026-09-28-catalog-tenant-isolation-plan.md) (#84: `uq_service_id_tenant`, booking-root service-name probe handed to #85). Also relies on [Bookings](../specs/2026-08-22-bookings-design.md), [Jobs & Checklists](../specs/2026-08-27-jobs-checklists-design.md), [nestjs-query GraphQL Reads](../specs/2026-08-28-nestjs-query-graphql-reads-design.md), [Paginated GraphQL Collections](../specs/2026-08-28-paginated-graphql-collections-design.md) and [Admin Foundation](../specs/2026-08-14-admin-foundation-design.md) (§4.1 cookie JWT / `AuthGuard`, §4.2 `@Roles()`, §4.7 `@CurrentUser()`) as **extended/constrained by the RFC**. |

> **For agentic workers:** Draft — awaiting M5. Execution method is chosen at M5. Steps use checkbox (`- [ ]`) syntax. Do **not** invent product semantics; the Accepted specification wins. M6 constraints: no production-tenant provisioning, no unrelated refactoring, no push or PR as a side effect; do not weaken failing assertions to get a suite green.

**Goal:** Make Booking tenant-owned: required `tenantId`, database-enforced same-tenant references to Customer, Property, Service and Team, and the caller's tenant applied to every booking read and write on GraphQL, REST and the Jobs lookup. REST `/bookings` becomes authenticated.

**Architecture:** One migration adds `booking_entity."tenantId"`, backfills it with the bootstrap tenant, **validates** that no existing booking references a parent in another tenant, then adds NOT NULL, `fk_booking_tenant` and `uq_booking_id_tenant`. In the same migration it replaces the four id-only parent FKs with composite `(refId, "tenantId") → parent (id, "tenantId")` FKs. `BookingsService` takes a non-null `tenantId` on every operation and drops its null-tenant/null-actor special cases. `BookingDTO` gets `@Authorize(tenantReadAuthorizer())`. `AuthGuard` and `@CurrentUser()` become transport-aware so that the rebuilt REST controller uses the same authentication, `@Roles()` and `requireTenantId` as GraphQL. `JobsService.createFromBooking` passes the caller's tenant into the booking lookup.

**Tech Stack:** NestJS 11, `@nestjs/passport` + passport-jwt (cookie), TypeORM 1.1.x migrations (hand-written constraints), PostgreSQL, `@ptc-org/nestjs-query-*` 9.5.0, Jest unit (`pnpm --filter api test`) and e2e against real Postgres (`pnpm --filter api test:e2e`).

**Spec:** [docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md](../specs/2026-09-23-multi-tenant-architecture-design.md) §4.2, §4.4 (Booking row and booking → customer / property / service / team references), §4.5 (including the REST `/bookings` production rule), §4.7 (backfill), §4.9 (worked examples: `bookings` filter omitting tenant; booking create with another tenant's `serviceId`), invariants 1, 11, 12.

## Delivery intent

Implement RFC §4.4–§4.5 for **Booking**. After this slice:

- A tenant principal cannot see, count, filter to, create against, update, delete, or look up another tenant's booking through GraphQL, REST or Jobs.
- The database rejects a booking whose customer, property, service or team belongs to a different tenant than the booking.
- REST `/bookings` is no longer an unauthenticated tenant surface (RFC §4.5, invariant 11).

Cleaning jobs, checklists, laundry and invoices remain unscoped (#86, #87). Booking audit tagging remains with #90.

## Slice decisions (recorded during brainstorming, 2026-09-28/29)

These resolve planning-level choices the RFC leaves to M4. None adds product semantics beyond what the RFC authorizes; each one's source is named.

1. **Process.** The Accepted RFC is the architectural specification. No separate spec document is written; these decisions are the brainstorm record, and the plan is reviewed at M5 before any implementation (#84 precedent).

2. **Security invariants (normative for this slice).**
   - **I-1 — A Booking's `tenantId` is authoritative for every related foreign key.** A booking row cannot reference a Customer, Property, Service, or Team belonging to another tenant. Both the application (tenant-scoped lookups before write) and the database (composite FKs, Decision 5) enforce this (RFC §4.4 "Application validation and database constraints MUST both prevent cross-tenant references").
   - **I-2 — No Booking lookup may use a caller-supplied tenant identifier in preference to the authenticated principal's tenant.** The only tenant source is `AuthenticatedPrincipal.tenantId` (RFC §4.5, invariant 1). `tenantId` never appears in a GraphQL input, filter or field, a REST body, param, query or header read. Client-input spoofing is pinned by e2e (Task 8, Review Focus 1), mirroring #84.

3. **REST `/bookings`: rebuilt as authenticated, not removed (RFC §4.5 leaves the choice open; §8 lists it as an M4 decision).** A repo-wide search (`git ls-files`, 2026-09-29) found **no runtime consumer**: no `apps/web`, `packages/`, scripts, or Postman/`.http`/OpenAPI collections. However, `README.md` states the surface is "kept for the REST/GraphQL comparison this repo exists to run". **The REST/GraphQL comparison is an explicit purpose of the repository**, so keeping REST preserves an existing product/development surface. It is not compatibility carry-over. Therefore:
   - All five routes (`POST /bookings`, `GET /bookings`, `GET /bookings/:id`, `PATCH /bookings/:id`, `DELETE /bookings/:id`) keep their paths, DTOs and response shape, and change **together**. No route is left partially scoped.
   - Every route requires the session cookie (`AuthGuard`) and a role from the **same** sets GraphQL uses: `VIEW_ROLES` for the two `GET`s, `WRITE_ROLES` for `POST`/`PATCH`/`DELETE`. Unauthenticated ⇒ 401; wrong role or Super Admin ⇒ 403.
   - Every route obtains the tenant with `requireTenantId(currentUser)` and the actor with `currentUser.id`. REST mutations are therefore **audited**, consistent with GraphQL. The Bookings spec's "REST unaudited" rule rested on REST having no principal (`actorId: null` = "no actor"). RFC §4.5 removes that premise, so M5 should confirm this consequence explicitly.
   - All operations go through the same tenant-scoped `BookingsService`, which loses its `tenantId: null` / `actorId: null` special cases (Decision 7).
   - The REST response shape is **unchanged**: the controller does not serialize the new `tenantId` field. Swagger at `/docs` keeps listing the routes.
   - `README.md`'s REST row is updated to say it is authenticated (Task 9). The comparison purpose is kept verbatim.
   - #91 still owns any remaining legacy-surface cleanup. #85 closes the booking REST isolation requirement.

4. **Authentication becomes transport-aware at the shared platform boundary; authorization and tenant enforcement stay transport-independent.** Recon (2026-09-29) found that `AuthGuard.getRequest`/`getResponse` and `@CurrentUser()` unconditionally use `GqlExecutionContext.create(context).getContext().req`. On an HTTP route that yields `undefined`, so the guard cannot authenticate REST requests today. Cookie extraction itself is transport-neutral (`JwtStrategy` reads `req.cookies`; `cookie-parser` is global in `main.ts`). Decision:
   - `AuthGuard` resolves the request/response by `context.getType()`. `'graphql'` uses the existing `GqlExecutionContext` path unchanged; `'http'` uses `context.switchToHttp().getRequest()` / `.getResponse()`.
   - `@CurrentUser()` resolves `req.user` the same way.
   - `@Roles()` metadata and the role check are unchanged and shared. `requireTenantId()` remains the tenant boundary and is unchanged.
   - **No** separate `HttpAuthGuard` / `@CurrentHttpUser()`.
   - The platform change is limited to `auth.guard.ts`, `current-user.decorator.ts` and their unit tests. It is part of this slice because Decision 3 cannot be met without it; it is not an auth refactor.

5. **Composite FK invariant (implements I-1 in the database).**

   ```text
   booking_entity ("customerId", "tenantId") → customer_entity ("id", "tenantId")   -- fk_booking_customer_tenant
   booking_entity ("propertyId", "tenantId") → property_entity ("id", "tenantId")   -- fk_booking_property_tenant
   booking_entity ("serviceId",  "tenantId") → service_entity  ("id", "tenantId")   -- fk_booking_service_tenant
   booking_entity ("teamId",     "tenantId") → team_entity     ("id", "tenantId")   -- fk_booking_team_tenant
   ```

   They replace `fk_booking_customer`, `fk_booking_property`, `fk_booking_service`, `fk_booking_team` in the same migration step (all `ON DELETE RESTRICT`). The referenced pairs are backed by `uq_customer_id_tenant`, `uq_property_id_tenant`, `uq_service_id_tenant`, `uq_team_id_tenant` (#82–#84). Default `MATCH SIMPLE`: a booking with `teamId IS NULL` is not checked against teams, which is the existing "unassigned" state.

6. **`uq_booking_id_tenant` = `UNIQUE ("id", "tenantId")` is added now.** It exists as the FK target #86 needs for `cleaning_job_entity ("bookingId", "tenantId") → booking_entity ("id", "tenantId")`. That gives #86 the same tenant-safe parent-key pattern #82–#84 established. It is not an extra product rule (RFC §4.4).

7. **Service null-tenant contract: removed, not carried forward.** After Decision 3 every `BookingsService` caller has a principal. The service signatures become `tenantId: string` and `actorId: string`, and `null` cannot type-check into them. Writes and REST reads obtain the tenant via `requireTenantId(currentUser)` (`ForbiddenException` before the service is called). The nestjs-query roots (`bookings`, `booking`, `Property.bookings`, `CleaningJob.booking`) are constrained by `@Authorize(tenantReadAuthorizer())`. For a null tenant that yields `tenantFilterFor(null)` and may issue the resulting no-match query: the same framework-level exception #82–#84 recorded.

8. **Every booking lookup puts `tenantId` in the same query.** `findOne` (`findOneBy({ id, tenantId })`), `findAll` (`find({ where: { tenantId } })`), `getBookingsByIds` (`findBy({ id: In(ids), tenantId })`), `update`'s existence check, its `manager.update(BookingEntity, { id, tenantId }, changes)` and its re-read, and `remove`'s existence check. Never fetch-then-filter. `tenantId` is never part of `update`'s SET list.

9. **Cross-tenant = missing row (RFC §4.5).** `booking(id)` for another tenant's id behaves exactly like a nonexistent id (the existing nestjs-query `getById` not-found error). `bookings` lists and counts exclude it. `updateBooking` / `removeBooking` / `PATCH` / `DELETE` / `GET /bookings/:id` ⇒ the existing `NotFoundException` (404). `createBooking` / `POST` with another tenant's customer, property, service or team ⇒ the existing `NotFoundException`. `createJobFromBooking` with another tenant's booking ⇒ the existing `NotFoundException` from `BookingsService.findOne`. Never 403 for another tenant's row.

10. **Relation-filter acceptance criterion (carried from #82 I1; also closes the #83 team probe and the #84 service-name probe).** A tenant-B `bookings` query cannot obtain, count, or detect a tenant-A booking by widening or altering relation filters on `customer`, `property`, `service` or `team`: equality, prefix `like`, and `or` combinations. Once the root is tenant-scoped (Decision 7) and I-1 holds (Decision 5), every row the root can return, and every related row a relation filter can join, is in the caller's tenant. The two-tenant e2e **exercises the filter paths explicitly** (`nodes: []` **and** `totalCount: 0`) rather than relying on the constraint argument alone (Task 8).

11. **Jobs boundary.** `CreateJobFromBookingCommand` gains `tenantId: string`. `JobResolver.createJobFromBooking` passes `requireTenantId(currentUser)`, and `JobsService.createFromBooking` passes it to `BookingsService.findOne`. `cleaning_job_entity` gets **no** `tenantId`, and `fk_cleaning_job_booking` stays id-only (#86). Jobs queries are otherwise unchanged.

12. **Audit boundary.** Booking audit events (`booking.create`, `booking.update`, `booking.remove`) are **not** tenant-tagged in #85; that stays with #90. This follows the precedent of each slice tagging only its own module's events, set by the #82–#84 deferral lines. #85 only makes REST mutations emit the same events GraphQL already emits (Decision 3).

13. **Migration backfill and validation (RFC §4.7).** Every existing booking is attached to the bootstrap tenant. Before any constraint is created, the migration counts bookings whose customer, property, service or (non-null) team has a `tenantId` different from the booking's. If any count is non-zero, it throws an explicit error naming the counts, and the single transaction rolls back with nothing modified. In production every parent is already bootstrap-owned (#82–#84 backfills), so this is a fail-closed guard for dev/e2e databases with leftover test-tenant rows. It is not an expected path.

## Known residual exposure (until #86)

- **`CleaningJob.booking` through the unscoped job root.** `cleaning_job_entity` is unscoped until #86. A tenant-B principal can still list a tenant-A job. Selecting `booking { … }` on it now resolves through `BookingDTO`'s authorizer, finds nothing, and yields `Cannot return null for non-nullable field CleaningJob.booking`: no A booking data, but an error rather than invisibility. This is the same interim shape #82 accepted for `Booking.customer`. Task 8 pins "no A booking data reaches B". #86 MUST make the job itself invisible to B and replace that case.
- `fk_cleaning_job_booking` stays id-only (#86 swaps it for a composite FK against `uq_booking_id_tenant`).
- The laundry-order cross-tenant pricing path recorded in #84 is unchanged by this slice (#87).

**Interim operating rule (unchanged from #82–#84):** do not provision a second production tenant before #86 and #87 have shipped.

## Global constraints

- SHALL derive the tenant **only** from `AuthenticatedPrincipal.tenantId` (I-2). SHALL NOT expose `tenantId` as a GraphQL field, filterable field or input field on `Booking`. SHALL NOT read `tenantId` from any REST body, param, query or header. REST DTOs are unchanged, and the global `ValidationPipe` (`whitelist` + `forbidNonWhitelisted`) rejects a body `tenantId` with 400.
- SHALL NOT hardcode `BOOTSTRAP_TENANT_ID` in any request path. It MAY appear only in the migration, dev seed data, and tests.
- SHALL enforce, in the database: `booking_entity."tenantId" uuid NOT NULL`, `fk_booking_tenant` → `tenant_entity(id)` `ON DELETE RESTRICT`; `uq_booking_id_tenant`; the four composite FKs of Decision 5 (`ON DELETE RESTRICT`, `MATCH SIMPLE`); `idx_booking_tenant_scheduled` on `("tenantId", "scheduledAt" DESC, "id")` (matches the `bookings` default sort). The four id-only `fk_booking_*` constraints are removed. The existing single-column indexes on `customerId`/`propertyId`/`serviceId`/`teamId` are unchanged.
- SHALL order the migration exactly: **(0)** assert the bootstrap tenant exists → **(1)** add nullable `tenantId` → **(2)** backfill → **(3)** validate (Decision 13) → **(4)** NOT NULL + `fk_booking_tenant` → **(5)** `uq_booking_id_tenant` → **(6)** drop each id-only parent FK and add its composite replacement (same step) → **(7)** `idx_booking_tenant_scheduled`. All in **one** migration. SHALL NOT split it. No committed state lacks a parent FK.
- SHALL NOT change `cleaning_job_entity`, `fk_cleaning_job_booking`, `UQ_cleaning_job_booking_id`, or any laundry/billing table (#86, #87).
- SHALL treat `@Authorize` on `BookingDTO` as a **security invariant**. No relation targeting `BookingDTO` may carry a relation-level `auth`, and none may enable relation `update`/`remove`. Planning-time inventory: exactly two such relations exist, `CleaningJob.booking` (`@FilterableRelation`) and `Property.bookings` (`@OffsetConnection`). Task 4 pins this.
- SHALL keep `@Roles()` sets unchanged (GraphQL `VIEW_ROLES` / `WRITE_ROLES`). SHALL NOT add `SUPER_ADMIN` to any booking route or resolver (RFC §4.2).
- SHALL keep GraphQL behaviour of `AuthGuard` / `@CurrentUser()` byte-for-byte unchanged on the `'graphql'` path (Decision 4).
- SHALL NOT use PostgreSQL RLS (invariant 12).
- SHALL NOT change `apps/web`, `packages/*`, GraphQL operation documents, or the public GraphQL schema. Adding `@Authorize` does not change the schema.
- SHALL NOT change booking audit event payloads (Decision 12).

## Ownership boundaries

**This slice owns:** `apps/api/src/modules/bookings/**`; one new migration in `apps/api/src/platform/database/migrations/`; `apps/api/src/platform/auth/guards/auth.guard.ts`, `apps/api/src/platform/auth/decorators/current-user.decorator.ts` and their tests (Decision 4 only); the Jobs **call path only**: `create-job-from-booking.command.ts`, `JobResolver.createJobFromBooking`, `JobsService.createFromBooking`; the dev booking seed data; `test/helpers/seed-tenant-admin.ts` (`removeTestTenants` booking cleanup); e2e fixtures that insert bookings or call REST `/bookings`; the README REST row; stale `#85` code comments.

**Must not change:** Customer / Property / Catalog / Team / Cleaner persistence, types or authorizers; `tenantReadAuthorizer` / `requireTenantId` (consumed as-is); `JwtStrategy`, `TokenService`, the principal shape, `@Roles()`; Jobs / Laundry / Billing persistence and every other Jobs path; `apps/web`.

## Contract inventory

| Surface | Change |
| --- | --- |
| `booking_entity` | `tenantId uuid NOT NULL` + `fk_booking_tenant`; `uq_booking_id_tenant`; four composite parent FKs replacing the id-only ones; `idx_booking_tenant_scheduled` |
| `Booking` domain | + `tenantId: string` |
| `BookingEntity` | + `tenantId` column and `tenant` relation (`fk_booking_tenant`); the four parent `@ManyToOne`s get `createForeignKeyConstraints: false` (#82 `PropertyEntity` precedent) |
| `CreateBookingCommand` | `actorId: string`, `tenantId: string` (were nullable) |
| `UpdateBookingCommand` | `actorId: string`, `tenantId: string` (were nullable) |
| `BookingsService` | `create(command)`; `findAll(tenantId: string)`; `findOne(id, tenantId: string)`; `getBookingsByIds(ids, tenantId: string)`; `update(id, command)`; `remove(id, actorId: string, tenantId: string)`; `logAuditIfAuthenticated` → `logAudit` (always logs) |
| GraphQL `BookingDTO` | `@Authorize(tenantReadAuthorizer<BookingDTO>())`. `WRITE_ROLES` moves here from `booking.resolver.ts` and is exported beside `VIEW_ROLES` so REST and GraphQL share one definition |
| GraphQL `createBooking`, `updateBooking`, `removeBooking` | pass `requireTenantId(currentUser)` |
| REST `BookingController` | class-level `@UseGuards(AuthGuard)`; per-route `@Roles(...VIEW_ROLES)` / `@Roles(...WRITE_ROLES)`; `@CurrentUser()`; `requireTenantId`; responses via `toBookingResponse` (omits `tenantId`) |
| `AuthGuard` | `getRequest` / `getResponse` branch on `context.getType()` |
| `@CurrentUser()` | factory extracted as exported `principalFromContext(context)`; branches on `context.getType()` |
| `CreateJobFromBookingCommand` | + `tenantId: string` |

**Deferred:** job/checklist tenant ownership and `fk_cleaning_job_booking` composite (#86); booking audit tagging (#90); remaining legacy-surface cleanup (#91); two-tenant release gate (#92); any UI.

## TDD / verification strategy

- **Unit (Jest):** transport-aware guard/decorator (both branches); `BookingsService` tenant predicates in the same query, `tenantId` absent from the SET list, always-audit; resolvers and controller pass `requireTenantId(currentUser)` and a null-tenant principal throws `ForbiddenException` before the service is called; controller route metadata (guard on class, roles per route); `@Authorize` metadata on `BookingDTO`; relation-override regression; Jobs passes the tenant.
- **Migration e2e (throwaway database; `add-catalog-tenant.migration.e2e-spec.ts` harness):** bootstrap assertion, backfill, validation abort leaves data untouched, constraint swap, composite FKs reject each tenant-mismatched reference, null `teamId` accepted, `down` restores.
- **Two-tenant API e2e (real Postgres, `AppModule`):** every Decision 9/10 case, spoofing (I-2), the REST auth matrix, Jobs, and the DB backstop (I-1).
- **Acceptance is behavioral:** rows absent, counts scoped, lookups missing.
- **Suite health:** Tasks 2–7 are coupled. After Task 2 the NOT NULL column breaks e2e fixtures that insert bookings directly, and after Task 5 unauthenticated REST e2e calls return 401. Unit tests MUST be green at the end of every task. The full e2e suite MUST be green from Task 7 onward, excepting failures pre-existing on `main`: record their names at the start of M6 by running `pnpm --filter api test:e2e` on `main`. Any other failure blocks.
- **Final gate (Task 9):** `pnpm --filter api lint`, `pnpm --filter api test`, `pnpm --filter api test:e2e`, `pnpm --filter api build`, `migration:run` against a fresh database; `git diff --stat main -- apps/web packages` empty; generated GraphQL schema unchanged.

## Review Focus

Failure modes the RFC implies that are easy to miss. Each is pinned by a test in the named task.

1. **Client input tries to supply or widen the tenant (I-2):**
   - a GraphQL `createBooking` / `updateBooking` input carrying `tenantId` ⇒ GraphQL validation error, no row;
   - REST `POST`/`PATCH` body `tenantId` ⇒ 400, no row/change;
   - an `x-tenant-id` header naming A ⇒ ignored (B still sees only B);
   - `bookings(filter: { or: [{ id: { eq: <A's> } }, { id: { is: null } }] })` ⇒ `nodes: []`, `totalCount: 0`;
   - `bookings(filter: { tenantId: … })` ⇒ schema error (not a filterable field).

   (Task 8.)
2. **Relation filter as an oracle:** as B, `bookings(filter: { customer: { fullName: { like: "<A's prefix>%" } } })` and the `property` / `service` / `team` equivalents ⇒ `nodes: []`, `totalCount: 0`. The same filters as A return A's booking (positive control, so the case is not vacuous) (Task 8).
3. **Update/remove path scoped in every statement:** `updateBooking` / `PATCH` / `removeBooking` / `DELETE` against A's id as B ⇒ 404, and A's row is unchanged or still present. `manager.update` WHERE carries `tenantId` and its SET does not (Task 3 unit, Task 8 e2e).
4. **Some REST route left unguarded, or HTTP principal not resolved:** each of the five routes without a cookie ⇒ 401; `FINANCE` on `POST`/`PATCH`/`DELETE` ⇒ 403; Super Admin on every route ⇒ 403; an authorized tenant principal succeeds and sees only its own rows. `@CurrentUser()` on HTTP returns the same principal the guard attached (Tasks 1, 5, 7, 8).
5. **Jobs creating from another tenant's booking:** `createJobFromBooking(bookingId: <A's>)` as B ⇒ 404 and **no** `cleaning_job_entity` row for that booking (Task 6 unit, Task 8 e2e).

---

### Task 1: Transport-aware `AuthGuard` and `@CurrentUser()`

**Spec:** RFC §4.5 (REST must use the **same** cookie-JWT authentication as GraphQL); Admin Foundation §4.1, §4.2, §4.7; Slice decision 4.

**Files:**
- Modify: `apps/api/src/platform/auth/guards/auth.guard.ts`
- Modify: `apps/api/src/platform/auth/decorators/current-user.decorator.ts`
- Test: `apps/api/src/platform/auth/tests/auth.guard.spec.ts`
- Create test: `apps/api/src/platform/auth/tests/current-user.decorator.spec.ts`

**Interfaces:**
- Produces: `AuthGuard` usable on HTTP controllers with unchanged GraphQL behaviour; `principalFromContext(context: ExecutionContext): AuthenticatedPrincipal` (exported from `current-user.decorator.ts`); `CurrentUser` unchanged in name and use.

- [ ] **Step 1: Write the failing guard tests.** In `auth.guard.spec.ts`, keep `buildContext` (GraphQL) as-is. Add `buildHttpContext(req, handler)`: `getType: () => 'http'`, `switchToHttp().getRequest()` returns `req`, and `getArgByIndex`/`getArgs` return `[req, {}, () => undefined]`, the Express shape where index 2 is `next`, not a GraphQL context. Add a `describe('over HTTP', …)` that repeats the five existing cases through `buildHttpContext`: no cookie ⇒ rejects; disabled account ⇒ rejects; no `@Roles()` ⇒ `true`; role not listed ⇒ rejects with `ForbiddenException`; Super Admin on `tenantOwnerOnly` ⇒ `ForbiddenException`. Add one assertion that after an HTTP `canActivate` resolves `true`, `req.user` equals the looked-up principal.

- [ ] **Step 2: Write the failing decorator test.**

```ts
import { ExecutionContext } from '@nestjs/common';
import { AdminScope } from '../domain/admin-scope';
import { Role } from '../domain/role';
import { principalFromContext } from '../decorators/current-user.decorator';

const principal = {
  id: 'admin-1',
  role: Role.SCHEDULER,
  scope: AdminScope.TENANT,
  tenantId: 'tenant-1',
};

// #85 Slice decision 4: the same principal is read from GraphQL's context
// and from an HTTP request.
describe('principalFromContext', () => {
  it('reads req.user from the GraphQL context', () => {
    const args = [{}, {}, { req: { user: principal } }, {}];
    const context = {
      getArgByIndex: (i: number) => args[i],
      getArgs: () => args,
      getType: () => 'graphql',
    } as unknown as ExecutionContext;
    expect(principalFromContext(context)).toBe(principal);
  });

  it('reads req.user from an HTTP request', () => {
    const req = { user: principal };
    const context = {
      getArgByIndex: (i: number) => [req, {}, () => undefined][i],
      getType: () => 'http',
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    expect(principalFromContext(context)).toBe(principal);
  });
});
```

- [ ] **Step 3: Run and confirm failure.** `pnpm --filter api test -- auth.guard current-user.decorator`. Expected: the HTTP guard cases fail (Passport receives `undefined` as the request), and the decorator spec fails to compile (`principalFromContext` is not exported).

- [ ] **Step 4: Implement.** In `auth.guard.ts` replace `getRequest`/`getResponse` with the following, keep the rest, and extend the header comment with one paragraph citing #85 Slice decision 4:

```ts
  getRequest(context: ExecutionContext): RequestWithPrincipal {
    if (context.getType<GqlContextType>() === 'graphql') {
      return GqlExecutionContext.create(context).getContext<GqlContext>().req;
    }
    return context.switchToHttp().getRequest<RequestWithPrincipal>();
  }

  getResponse(context: ExecutionContext): unknown {
    if (context.getType<GqlContextType>() === 'graphql') {
      return GqlExecutionContext.create(context).getContext<GqlContext>().res;
    }
    return context.switchToHttp().getResponse<unknown>();
  }
```

(`GqlContextType` from `@nestjs/graphql`.) In `current-user.decorator.ts`:

```ts
export function principalFromContext(
  context: ExecutionContext,
): AuthenticatedPrincipal {
  const req =
    context.getType<GqlContextType>() === 'graphql'
      ? GqlExecutionContext.create(context).getContext<GqlContext>().req
      : context.switchToHttp().getRequest<RequestWithPrincipal>();
  return req.user!;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedPrincipal =>
    principalFromContext(context),
);
```

The branch is deliberately duplicated in the two files, not extracted: Decision 4 limits the platform change to these two files.

- [ ] **Step 5: Run.** `pnpm --filter api test -- auth` ⇒ PASS; then the full `pnpm --filter api test` ⇒ PASS (GraphQL behaviour unchanged).

- [ ] **Step 6: Commit.** `git commit -m "feat(85): make AuthGuard and @CurrentUser transport-aware"`

---

### Task 2: Schema — domain, entity, migration, seed, test cleanup helper

**Spec:** §4.4 (booking references, `(id, tenantId)` uniqueness), §4.5 (NOT NULL, tenant FK, indexes), §4.7 (backfill before NOT NULL); Slice decisions 5, 6, 13.

**Files:**
- Modify: `apps/api/src/modules/bookings/domain/booking.ts` (+ `tenantId: string`)
- Modify: `apps/api/src/modules/bookings/infrastructure/persistence/booking.entity.ts`
- Create: `apps/api/src/platform/database/migrations/1790611200000-AddBookingTenant.ts`
- Modify: `apps/api/src/modules/bookings/infrastructure/persistence/seed/booking.seed-data.ts` (+ `tenantId: BOOTSTRAP_TENANT_ID` on the interface and every row)
- Modify: `apps/api/test/helpers/seed-tenant-admin.ts` (`removeTestTenants` deletes the tenants' bookings first)
- Test: `apps/api/test/add-booking-tenant.migration.e2e-spec.ts`

**Interfaces:**
- Produces: `Booking.tenantId: string`; `BookingEntity.tenantId` / `.tenant`; constraint names `fk_booking_tenant`, `uq_booking_id_tenant`, `fk_booking_customer_tenant`, `fk_booking_property_tenant`, `fk_booking_service_tenant`, `fk_booking_team_tenant`, index `idx_booking_tenant_scheduled`.

- [ ] **Step 1: Write the failing migration e2e.** Use the same harness as `test/add-catalog-tenant.migration.e2e-spec.ts`: a throwaway database, `connectionOptions` / `migrationsBefore` from `test/helpers/migration-db.ts`, and the explicit `inTransaction` wrapper, with sequential cases. Fixtures are raw SQL inserts of one bootstrap customer, property, service and team, plus one second tenant with its own customer, property, service and team.

```ts
const NEW_CONSTRAINTS = [
  'fk_booking_tenant',
  'uq_booking_id_tenant',
  'fk_booking_customer_tenant',
  'fk_booking_property_tenant',
  'fk_booking_service_tenant',
  'fk_booking_team_tenant',
];
const OLD_CONSTRAINTS = [
  'fk_booking_customer',
  'fk_booking_property',
  'fk_booking_service',
  'fk_booking_team',
];
```

Cases, in order:
1. **Bootstrap missing ⇒ abort.** With the bootstrap tenant row temporarily absent (same technique as the catalog suite), `up` rejects with `/bootstrap tenant .* not found/`, and `booking_entity` has no `tenantId` column.
2. **Validation abort (Decision 13).** Insert a booking whose customer/property belong to the second tenant. `up` rejects with `/AddBookingTenant: .*customer/`. Afterwards `booking_entity` has no `tenantId` column, the booking row is unchanged, and `OLD_CONSTRAINTS` all still exist. Delete that booking.
3. **Happy path.** Insert two bootstrap bookings (one with `teamId` NULL) and run `up`. Every booking has `tenantId = BOOTSTRAP_TENANT_ID`; the column is `NOT NULL`; every `NEW_CONSTRAINTS` name exists in `pg_constraint` for `booking_entity`; no `OLD_CONSTRAINTS` name exists; `idx_booking_tenant_scheduled` exists in `pg_indexes`; `fk_cleaning_job_booking` still exists and is unchanged.
4. **Composite FKs reject mismatches (I-1).** For each of `customerId`, `propertyId`, `serviceId`, `teamId`: an insert with `tenantId` = bootstrap and that one reference pointing at the second tenant's row rejects with the matching `fk_booking_*_tenant` constraint name (`error.driverError.constraint`). An insert with `teamId` NULL succeeds.
5. **`down`.** It restores `OLD_CONSTRAINTS`, drops every `NEW_CONSTRAINTS` name and the index, and drops the column. Existing rows survive.

- [ ] **Step 2: Run and confirm failure.** `pnpm --filter api test:e2e -- add-booking-tenant` ⇒ fails (migration module does not exist).

- [ ] **Step 3: Write the migration.**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../bootstrap-tenant';

// Tenant ownership for Booking (#85; RFC §4.4, §4.5, §4.7). Step order is
// load-bearing and the whole migration is one transaction:
//
//   0. Assert the bootstrap tenant exists; abort before touching any row.
//   1. Nullable `tenantId`.
//   2. Backfill every booking to the bootstrap tenant.
//   3. Validate: no booking may reference a customer/property/service/team
//      in another tenant (#85 slice decision 13). Fails closed; the
//      transaction rolls back with nothing modified.
//   4. NOT NULL + FK to `tenant_entity` (ON DELETE RESTRICT).
//   5. `UNIQUE (id, "tenantId")` — the FK target #86's cleaning-job
//      composite FK needs (slice decision 6).
//   6. Replace each id-only parent FK with its composite `(refId,
//      "tenantId")` FK in the same step (slice decision 5). MATCH SIMPLE:
//      a NULL `teamId` is not checked.
//   7. Tenant-leading index matching the `bookings` default sort.
//
// `fk_cleaning_job_booking` stays id-only — #86.
export class AddBookingTenant1790611200000 implements MigrationInterface {
  name = 'AddBookingTenant1790611200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = (await queryRunner.query(
      `SELECT 1 FROM "tenant_entity" WHERE "id" = $1`,
      [BOOTSTRAP_TENANT_ID],
    )) as unknown[];
    if (tenants.length === 0) {
      throw new Error(
        `AddBookingTenant: bootstrap tenant ${BOOTSTRAP_TENANT_ID} not found — run AddTenantAndAdminScope first`,
      );
    }

    await queryRunner.query(`ALTER TABLE "booking_entity" ADD "tenantId" uuid`);
    await queryRunner.query(`UPDATE "booking_entity" SET "tenantId" = $1`, [
      BOOTSTRAP_TENANT_ID,
    ]);

    const mismatches: string[] = [];
    for (const [column, table, label] of [
      ['customerId', 'customer_entity', 'customer'],
      ['propertyId', 'property_entity', 'property'],
      ['serviceId', 'service_entity', 'service'],
      ['teamId', 'team_entity', 'team'],
    ] as const) {
      const [{ count }] = (await queryRunner.query(
        `SELECT COUNT(*)::int AS "count" FROM "booking_entity" b JOIN "${table}" p ON p."id" = b."${column}" WHERE p."tenantId" <> b."tenantId"`,
      )) as { count: number }[];
      if (count > 0) {
        mismatches.push(`${count} booking(s) reference a ${label} outside the bootstrap tenant`);
      }
    }
    if (mismatches.length > 0) {
      throw new Error(`AddBookingTenant: ${mismatches.join('; ')}`);
    }

    await queryRunner.query(
      `ALTER TABLE "booking_entity" ALTER COLUMN "tenantId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_entity" ADD CONSTRAINT "fk_booking_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_entity" ADD CONSTRAINT "uq_booking_id_tenant" UNIQUE ("id", "tenantId")`,
    );

    for (const [oldName, newName, column, table] of [
      ['fk_booking_customer', 'fk_booking_customer_tenant', 'customerId', 'customer_entity'],
      ['fk_booking_property', 'fk_booking_property_tenant', 'propertyId', 'property_entity'],
      ['fk_booking_service', 'fk_booking_service_tenant', 'serviceId', 'service_entity'],
      ['fk_booking_team', 'fk_booking_team_tenant', 'teamId', 'team_entity'],
    ] as const) {
      await queryRunner.query(
        `ALTER TABLE "booking_entity" DROP CONSTRAINT "${oldName}"`,
      );
      await queryRunner.query(
        `ALTER TABLE "booking_entity" ADD CONSTRAINT "${newName}" FOREIGN KEY ("${column}", "tenantId") REFERENCES "${table}"("id", "tenantId") ON DELETE RESTRICT ON UPDATE NO ACTION`,
      );
    }

    await queryRunner.query(
      `CREATE INDEX "idx_booking_tenant_scheduled" ON "booking_entity" ("tenantId", "scheduledAt" DESC, "id")`,
    );
  }

  // Reverses 7 → 1, restoring the original id-only FKs under their
  // original names (`ON DELETE RESTRICT`, default ON UPDATE).
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_booking_tenant_scheduled"`);
    for (const [oldName, newName, column, table] of [
      ['fk_booking_team', 'fk_booking_team_tenant', 'teamId', 'team_entity'],
      ['fk_booking_service', 'fk_booking_service_tenant', 'serviceId', 'service_entity'],
      ['fk_booking_property', 'fk_booking_property_tenant', 'propertyId', 'property_entity'],
      ['fk_booking_customer', 'fk_booking_customer_tenant', 'customerId', 'customer_entity'],
    ] as const) {
      await queryRunner.query(
        `ALTER TABLE "booking_entity" DROP CONSTRAINT "${newName}"`,
      );
      await queryRunner.query(
        `ALTER TABLE "booking_entity" ADD CONSTRAINT "${oldName}" FOREIGN KEY ("${column}") REFERENCES "${table}"("id") ON DELETE RESTRICT`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "booking_entity" DROP CONSTRAINT "uq_booking_id_tenant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_entity" DROP CONSTRAINT "fk_booking_tenant"`,
    );
    await queryRunner.query(`ALTER TABLE "booking_entity" DROP COLUMN "tenantId"`);
  }
}
```

Confirm during M6 that the migration is picked up by the data source's migrations glob, the same way `1790524800000-AddCatalogTenant.ts` is.

- [ ] **Step 4: Domain + entity.** `Booking` gains `tenantId: string`, with a comment citing I-1. In `BookingEntity`, add the following, and keep the column-level `@Index()`es:
   - a `tenantId` column plus a `tenant` `@ManyToOne(() => TenantEntity, …)` with `@JoinColumn({ name: 'tenantId', foreignKeyConstraintName: 'fk_booking_tenant' })` (copy the `PropertyEntity` shape);
   - on each of `customer`, `property`, `service`, `team`: replace `onDelete` / `foreignKeyConstraintName` with `createForeignKeyConstraints: false`, and replace the header comment's FK sentence with the #82-style note ("the composite `fk_booking_*_tenant` FKs are hand-written in `AddBookingTenant`; `migration:generate` may propose dropping them or re-adding id-only FKs — do not apply that").

- [ ] **Step 5: Seed + cleanup helper.** Add `tenantId: BOOTSTRAP_TENANT_ID` to `BookingSeedData` and to every row, updating the file's comment if it lists the fields. In `removeTestTenants`, first delete `cleaning_job_entity` rows whose booking is in the given tenants, via `checklist_item_entity` → `checklist_entity` → `cleaning_job_entity` with `WHERE "bookingId" IN (SELECT "id" FROM "booking_entity" WHERE "tenantId" = ANY($1))`. Confirm the checklist table and column names against `AddCleaningJob` during M6. Then delete `booking_entity WHERE "tenantId" = ANY($1)`, before the existing property/customer/team/service deletes. Update the helper's comment: bookings are now tenant-owned and deleted here, and callers no longer delete bookings/jobs they created for these tenants by hand.

- [ ] **Step 6: Run.** `pnpm --filter api test:e2e -- add-booking-tenant` ⇒ PASS. `pnpm --filter api test` (unit) ⇒ PASS; TypeScript may now flag `Booking` literals in unit specs without `tenantId`, so add `tenantId: 'tenant-1'` there. Other e2e suites are expected to fail until Task 7.

- [ ] **Step 7: Commit.** `git commit -m "feat(85): add booking tenant ownership and composite parent FKs"`

---

### Task 3: `BookingsService` tenant-scoped on every operation

**Spec:** §4.4 (application validation), §4.5 (same predicate on services, batch lookups, mutations; cross-tenant = missing row); Slice decisions 7, 8, 9; I-1, I-2.

**Files:**
- Modify: `apps/api/src/modules/bookings/application/commands/create-booking.command.ts`, `update-booking.command.ts`
- Modify: `apps/api/src/modules/bookings/application/services/bookings.service.ts`
- Test: `apps/api/src/modules/bookings/tests/application/bookings.service.spec.ts`

**Interfaces:**
- Consumes: `Booking.tenantId` (Task 2).
- Produces: `CreateBookingCommand { actorId: string; tenantId: string; customerId; propertyId; serviceId; teamId?; scheduledAt }`; `UpdateBookingCommand { actorId: string; tenantId: string; scheduledAt?; status?; teamId? }`; `findAll(tenantId: string): Promise<Booking[]>`; `findOne(id: string, tenantId: string): Promise<Booking>`; `getBookingsByIds(ids: string[], tenantId: string): Promise<Booking[]>`; `update(id: string, command: UpdateBookingCommand): Promise<Booking>`; `remove(id: string, actorId: string, tenantId: string): Promise<Booking>`.

- [ ] **Step 1: Write failing unit tests** (extend the existing mocks in `bookings.service.spec.ts`):
   - `create` builds the entity with `tenantId: command.tenantId`, and passes `command.tenantId` to `getCustomer`, `getProperty`, `getService`, `getActivePricing` and `getTeam` (existing assertions; keep them).
   - `create` always calls `auditLogger.log` with `{ actorId, action: 'booking.create', entityType: 'booking', entityId }`, with no scope/tenant fields (Decision 12).
   - `findAll('t1')` ⇒ `bookingRepository.find({ where: { tenantId: 't1' } })`.
   - `findOne('b1', 't1')` ⇒ `findOneBy({ id: 'b1', tenantId: 't1' })`; `null` ⇒ `NotFoundException('Booking b1 not found')`.
   - `getBookingsByIds([], 't1')` ⇒ `[]` and no repository call; `getBookingsByIds(['a','b'], 't1')` ⇒ `findBy({ id: In(['a','b']), tenantId: 't1' })`.
   - `update('b1', { actorId: 'u', tenantId: 't1', status: CONFIRMED })`:
     - the manager `findOneBy` is called with `(BookingEntity, { id: 'b1', tenantId: 't1' })`;
     - `manager.update` with `(BookingEntity, { id: 'b1', tenantId: 't1' }, { status: CONFIRMED })`, and the changes object has **no** `tenantId` or `actorId` key;
     - `findOneByOrFail` with `{ id: 'b1', tenantId: 't1' }`;
     - `findOneBy` resolving `null` ⇒ `NotFoundException` and no `update` call.
   - `update` with `teamId` passes `command.tenantId` to `getTeam` (existing; keep it).
   - `remove('b1', 'u', 't1')` ⇒ `findOneBy(BookingEntity, { id: 'b1', tenantId: 't1' })`; `null` ⇒ `NotFoundException`; the success path logs `booking.remove`.
   - Delete the tests that asserted "no audit when `actorId` is null" and "REST passes null tenant". Those behaviours are removed by Decision 7, not weakened. The commit message names them.

- [ ] **Step 2: Run** `pnpm --filter api test -- bookings.service` ⇒ FAIL.

- [ ] **Step 3: Implement.**
   - Commands:
     - `actorId: string`, `tenantId: string`.
     - Replace the nullable-REST comments with: "`tenantId` is the caller's tenant from `requireTenantId(currentUser)` (GraphQL and REST alike, #85 Slice decisions 3, 7); never from client input (I-2)".
     - Keep `UpdateBookingCommand`'s note that `tenantId` never reaches the SET list.
   - Service:
     - `create` adds `tenantId: command.tenantId` to `manager.create(BookingEntity, …)`.
     - `findAll`, `findOne`, `findEntity`, `getBookingsByIds`, `update` and `remove` gain the predicates listed in Step 1. `findEntity(id, tenantId)` uses `findOneBy({ id, tenantId })`.
     - In `update`, keep `const { actorId, tenantId, ...rawChanges } = command;`. Now use `tenantId` in the WHERE (`manager.update(BookingEntity, { id, tenantId }, changes)`) and in the existence check and re-read, instead of `void tenantId`. Update the comment: `tenantId` is a column now, but it is the row's owner, never a change.
     - Rename `logAuditIfAuthenticated` to `logAudit`, remove its null branch, and type `actorId: string`. Replace its comment (every caller has a principal after #85 Slice decision 3).
     - Refresh the `resolveAndValidate` comment: it becomes the application half of I-1, and `fk_booking_*_tenant` is the database half. Also remove "stays id-only until #85" and the "REST passes null" sentences in `update`.

- [ ] **Step 4: Run** `pnpm --filter api test -- bookings.service` ⇒ PASS. Resolver, controller and jobs call sites will not compile until Tasks 4–6; for now run with `--testPathPattern bookings.service`, and expect `tsc` errors elsewhere until Task 6.

- [ ] **Step 5: Commit.** `git commit -m "feat(85): scope BookingsService by tenant; drop null tenant/actor paths"`

---

### Task 4: GraphQL — `@Authorize` on `BookingDTO`, mutations, relation regression

**Spec:** §4.5 (nestjs-query QueryService / ReadResolver / Relatable paths and relation resolvers; mutations); §4.9 (`bookings` filter omitting tenant); Slice decisions 7, 9, 10.

**Files:**
- Modify: `apps/api/src/modules/bookings/presentation/graphql/booking.dto.ts`
- Modify: `apps/api/src/modules/bookings/presentation/graphql/booking.resolver.ts`
- Test: `apps/api/src/modules/bookings/tests/graphql/booking.resolver.spec.ts`
- Create test: `apps/api/src/modules/bookings/tests/graphql/booking-relations.authorization.spec.ts`

**Interfaces:**
- Consumes: Task 3 commands/signatures.
- Produces: exported `VIEW_ROLES`, `WRITE_ROLES` from `booking.dto.ts` (consumed by Task 5).

- [ ] **Step 1: Failing tests.**
   - In `booking.resolver.spec.ts`:
     - `createBooking` / `updateBooking` build commands with `tenantId: principal.tenantId` and `actorId: principal.id`, and `removeBooking` calls `remove(id, principal.id, principal.tenantId)`.
     - For each of the three, a principal with `tenantId: null` rejects with `ForbiddenException`, and the service mock is **not** called.
     - A `BookingDTO tenant authorizer` block, copied from the `describe.each` at `apps/api/src/modules/catalog/tests/graphql/service-read.resolver.spec.ts:118-150` (`getAuthorizer` deep import from `@ptc-org/nestjs-query-graphql/src/decorators`; `new Authorizer!({}, undefined)`; `authorize(ctx, { operationGroup: 'read' })`):
       - it is registered;
       - a principal with `tenantId: 't-a'` resolves to `{ tenantId: { eq: 't-a' } }`;
       - a context with no `req.user` resolves to `{ id: { is: null } }`.
   - New `booking-relations.authorization.spec.ts`:

```ts
// @ptc-org/nestjs-query-graphql 9.5.0 does not re-export getRelations from
// the package root, so this deep import is required.
import { getRelations } from '@ptc-org/nestjs-query-graphql/src/decorators';
import { PropertyType } from '../../../customers/presentation/graphql/property.type';
import { CleaningJobType } from '../../../jobs/presentation/graphql/cleaning-job.type';
import { BookingDTO } from '../../presentation/graphql/booking.dto';

// Kept in its own file: importing other modules' GraphQL types registers
// their object types globally, which would leak into the booking resolver
// specs.
describe('Relations targeting Booking (tenant isolation, #85)', () => {
  // nestjs-query gives a relation's own `auth` precedence over the target
  // DTO's `@Authorize`, so an `auth` on any of these would silently bypass
  // the tenant predicate. Relation `update`/`remove` must stay disabled:
  // `@Authorize` is relied on for reads only.
  it('no relation targeting Booking overrides auth or enables relation mutations', () => {
    const owners = [
      ['Booking', BookingDTO],
      ['CleaningJob', CleaningJobType],
      ['Property', PropertyType],
    ] as const;
    const found: string[] = [];
    for (const [ownerName, owner] of owners) {
      const { many = {}, one = {} } = getRelations(owner as never);
      for (const [relationName, relation] of Object.entries({
        ...many,
        ...one,
      })) {
        if (relation.DTO !== BookingDTO) continue;
        found.push(`${ownerName}.${relationName}`);
        expect(relation.auth).toBeUndefined();
        expect(relation.update?.enabled).toBe(false);
        expect(relation.remove?.enabled).toBe(false);
      }
    }
    expect(found.sort()).toEqual(['CleaningJob.booking', 'Property.bookings']);
  });
});
```

  `PropertyType` resolves `bookingDto` lazily with `require`, so `relation.DTO` may be a thunk result. If the equality check misses it, compare `relation.DTO?.name === 'BookingDTO'` and keep the inventory assertion.

- [ ] **Step 2: Run** `pnpm --filter api test -- booking` ⇒ FAIL.

- [ ] **Step 3: Implement.**
   - In `booking.dto.ts`, add `@Authorize(tenantReadAuthorizer<BookingDTO>())` above `@QueryOptions`, with the #82 comment wording: the root list/count, `booking(id)` and every relation targeting this type are ANDed with the principal's tenant, and `tenantId` is deliberately not a GraphQL field.
   - Move `WRITE_ROLES` from `booking.resolver.ts` into `booking.dto.ts`, and export `{ VIEW_ROLES, WRITE_ROLES }`.
   - In `booking.resolver.ts`, import `WRITE_ROLES`, use `requireTenantId(currentUser)` in all three mutations, and call `remove(id, currentUser.id, tenantId)`.

- [ ] **Step 4: Run** `pnpm --filter api test -- booking customer-property-relations team-cleaner-relations catalog-relations` ⇒ PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat(85): tenant-authorize Booking reads and scope booking mutations"`

---

### Task 5: REST `/bookings` rebuilt as authenticated

**Spec:** §4.5 REST rule, invariant 11; Slice decisions 3, 4, 7; I-2.

**Files:**
- Modify: `apps/api/src/modules/bookings/presentation/rest/booking.controller.ts`
- Create: `apps/api/src/modules/bookings/presentation/rest/mappers.ts`
- Test: `apps/api/src/modules/bookings/tests/rest/booking.controller.spec.ts`

**Interfaces:**
- Consumes: `AuthGuard`, `CurrentUser` (Task 1); `VIEW_ROLES`, `WRITE_ROLES` (Task 4); service signatures (Task 3).
- Produces: `toBookingResponse(booking: Booking): Omit<Booking, 'tenantId'>`.

- [ ] **Step 1: Failing controller unit tests** (replace the existing file's cases):
   - **Route metadata:**
     - `Reflect.getMetadata('__guards__', BookingController)` contains `AuthGuard` (class-level, so every route is covered).
     - For `findAll` / `findOne`, `Reflect.getMetadata(ROLES_KEY, BookingController.prototype.findAll)` equals `VIEW_ROLES`.
     - For `create` / `update` / `remove`, it equals `WRITE_ROLES`.
   - **Service calls:**
     - `create(dto, principal)` ⇒ `bookingsService.create({ ...dto, actorId: principal.id, tenantId: principal.tenantId })`;
     - `findAll(principal)` ⇒ `findAll(principal.tenantId)`;
     - `findOne(id, principal)` ⇒ `findOne(id, principal.tenantId)`;
     - `update(id, dto, principal)` ⇒ `update(id, { ...dto, actorId, tenantId })`;
     - `remove(id, principal)` ⇒ `remove(id, principal.id, principal.tenantId)`.
   - **Null tenant:** each of the five with a `tenantId: null` principal ⇒ `ForbiddenException`, service not called.
   - **Response shape:** every returned value lacks a `tenantId` key; `findAll` maps each element.

- [ ] **Step 2: Run** `pnpm --filter api test -- booking.controller` ⇒ FAIL.

- [ ] **Step 3: Implement.**

```ts
// presentation/rest/mappers.ts
import { Booking } from '../../domain/booking';

// REST response shape is unchanged by #85 (Slice decision 3): the owning
// tenant is the caller's own and is not part of the REST contract.
export function toBookingResponse(booking: Booking): Omit<Booking, 'tenantId'> {
  const { tenantId, ...response } = booking;
  void tenantId;
  return response;
}
```

   The controller:
   - Class decorators `@ApiTags('bookings') @Controller('bookings') @UseGuards(AuthGuard)`.
   - Each handler gets `@Roles(...VIEW_ROLES)` or `@Roles(...WRITE_ROLES)` and a `@CurrentUser() currentUser: AuthenticatedPrincipal` parameter, and computes `const tenantId = requireTenantId(currentUser);`.
   - Each handler returns through `toBookingResponse`.
   - Replace the header comment. The REST/GraphQL comparison surface, kept deliberately (README), now uses the same cookie session, roles, tenant source and audit as GraphQL (RFC §4.5; #85 Slice decisions 3–4). Remove every "`actorId: null` / `tenantId: null`" comment.

- [ ] **Step 4: Run** `pnpm --filter api test -- booking.controller` ⇒ PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat(85): authenticate and tenant-scope REST /bookings"`

---

### Task 6: Jobs passes the caller's tenant into the booking lookup

**Spec:** §4.5 (batch/lookups and mutations use the same predicate; cross-tenant = missing row); Slice decision 11.

**Files:**
- Modify: `apps/api/src/modules/jobs/application/commands/create-job-from-booking.command.ts`
- Modify: `apps/api/src/modules/jobs/presentation/graphql/job.resolver.ts` (`createJobFromBooking` only)
- Modify: `apps/api/src/modules/jobs/application/services/jobs.service.ts` (`createFromBooking` only)
- Test: `apps/api/src/modules/jobs/tests/application/jobs.service.spec.ts`, `apps/api/src/modules/jobs/tests/graphql/job.resolver.spec.ts`

**Interfaces:**
- Consumes: `BookingsService.findOne(id, tenantId: string)` (Task 3).
- Produces: `CreateJobFromBookingCommand { actorId: string; bookingId: string; tenantId: string }`.

- [ ] **Step 1: Failing tests.**
   - `jobs.service.spec.ts`: `createFromBooking({ actorId, bookingId: 'b1', tenantId: 't1' })` calls `bookingsService.findOne('b1', 't1')`. A `NotFoundException` from it propagates, and no transaction is opened (`dataSource.transaction` not called).
   - `job.resolver.spec.ts`: the resolver passes `tenantId: principal.tenantId`; a null-tenant principal ⇒ `ForbiddenException`, service not called.

- [ ] **Step 2: Run** `pnpm --filter api test -- jobs` ⇒ FAIL.

- [ ] **Step 3: Implement.** Add `tenantId: string` to the command, with the same header comment style as `assign-team-to-job.command.ts`. The resolver passes `tenantId: requireTenantId(currentUser)`. The service calls `this.bookingsService.findOne(command.bookingId, command.tenantId)` and updates its comment: a cross-tenant booking is the existing 404 (#85 Slice decision 9); job tables stay unscoped until #86.

- [ ] **Step 4: Run** `pnpm --filter api test` (whole unit suite) ⇒ PASS, and `pnpm --filter api build` ⇒ PASS (all call sites compile).

- [ ] **Step 5: Commit.** `git commit -m "feat(85): pass caller tenant from createJobFromBooking to booking lookup"`

---

### Task 7: Existing e2e suites — fixtures and interim cases follow the new contract

**Spec:** RFC §4.5; Slice decisions 3, 9, 10. No product change: this task brings existing tests in line with Tasks 2–6 and replaces the interim guards #82–#84 marked "remove/replace in #85".

**Files (verify the list at M6 start with `grep -rln "BookingEntity\|/bookings" apps/api/test`):**
- Modify: `apps/api/test/customers-properties.tenant-isolation.e2e-spec.ts`, `teams-cleaners.tenant-isolation.e2e-spec.ts`, `catalog.tenant-isolation.e2e-spec.ts`, `app.e2e-spec.ts`, `bookings-rest.e2e-spec.ts`, and any other suite that inserts `BookingEntity` rows directly.

- [ ] **Step 1: Run** `pnpm --filter api test:e2e` and list the failures. Every failure must be one of: (a) direct `BookingEntity` insert without `tenantId`; (b) unauthenticated REST call now 401; (c) interim "B sees A's booking" expectation. Any other failure is a defect in Tasks 1–6: stop and fix there.

- [ ] **Step 2: (a) Fixtures.** Add `tenantId` equal to the tenant of the booking's customer to every direct `bookingRepository.create({...})`. Remove per-suite `delete({ id: booking.id })` cleanup only where `removeTestTenants` now covers it; keep it for bootstrap-tenant rows, which `removeTestTenants` never touches.

- [ ] **Step 3: (c) Replace interim cases:**
   - **`customers-properties.tenant-isolation`**: the `it.each(['customer','property'])` "never resolves another tenant's %s through a booking relation" case becomes "does not return another tenant's booking at all". As B, `bookings(filter: { id: { eq: crossTenantBooking.id } }) { totalCount nodes { id customer { id } property { id } } }` ⇒ no errors, `nodes: []`, `totalCount: 0`, and the serialized body contains neither `customerA.id` nor `propertyA.id`. As A (positive control) ⇒ one node with `customerA.id` / `propertyA.id`.
   - **`teams-cleaners.tenant-isolation`**: "Booking.team is null for another tenant's team" becomes: as B ⇒ `nodes: []`; as A ⇒ `team: { id: teamA.id }`. The `REST fail-closed` describe is rewritten as `REST cross-tenant team (authenticated)`, with every request sending `cookieA`:
     - `PATCH /bookings/${unassignedBooking.id}` with the suite's tenant-B team id ⇒ 404, `teamId` still null;
     - `PATCH` with `{ status: 'CONFIRMED' }` only ⇒ 200, with `teamId` unchanged and no `tenantId` key in the body;
     - `POST /bookings` with the tenant-B team id ⇒ 404.

     If the suite has no tenant-B team fixture, add one via `TeamsService.createTeam` with `tenantId: tenantB`, following the suite's existing setup style.
   - **`catalog.tenant-isolation`**: Case 5 ("interim residual-exposure guard (remove/replace in #85)") becomes "B cannot see A's booking". The `bookings(filter: { id: { eq: bookingA.id } }) { totalCount nodes { id service { id } } }` query ⇒ no errors, `nodes: []`, `totalCount: 0`, body without `serviceA.id`. As A ⇒ `service: { id: serviceA.id }`.

- [ ] **Step 4: (b) REST callers.**
   - **`app.e2e-spec.ts`**: log in the seeded owner (the suite already calls `seedOwner`; use its login helper, or add the standard `loginAs` from the catalog suite). Send the cookie on `GET /bookings` and `DELETE /bookings/:id`, and add `tenantId: BOOTSTRAP_TENANT_ID` to its seeded booking. Add one assertion that `GET /bookings` without a cookie ⇒ 401.
   - **`bookings-rest.e2e-spec.ts`** is rewritten as the REST contract suite (bootstrap tenant, `seedTenantAdmin` for roles, `seedSuperAdmin`):
     1. Each of the five routes without a cookie ⇒ 401.
     2. `FINANCE` on `POST`, `PATCH`, `DELETE` ⇒ 403; `FINANCE` on both `GET`s ⇒ 200.
     3. Super Admin on all five ⇒ 403.
     4. `TENANT_OWNER` full CRUD, in one flow:
        - `POST` ⇒ 201, and the body has no `tenantId` key;
        - `GET /bookings` contains it;
        - `GET /bookings/:id` ⇒ 200;
        - `PATCH` ⇒ 200;
        - `DELETE` ⇒ 200, then `GET /bookings/:id` ⇒ 404.
     5. After the `POST`, the `audit_event_entity` row with `action = 'booking.create'` and `entityId` = the new id has `actorId` = the owner's id (Decision 3).
   - **`test/helpers/booking-db-test-lock.ts`**: unchanged unless it inserts bookings; check it.

- [ ] **Step 5: Run** `pnpm --filter api test:e2e` ⇒ all green, excepting the pre-existing `main` failures recorded at M6 start.

- [ ] **Step 6: Commit.** `git commit -m "test(85): align e2e fixtures and interim guards with tenant-owned bookings"`

---

### Task 8: Two-tenant booking isolation e2e (acceptance)

**Spec:** RFC §4.4, §4.5, §4.9; Slice decisions 2 (I-1, I-2), 3, 9, 10, 11; issue #85 acceptance criterion (from #82 I1).

**Files:**
- Create: `apps/api/test/bookings.tenant-isolation.e2e-spec.ts`

**Interfaces:**
- Consumes: everything above. The setup mirrors `catalog.tenant-isolation.e2e-spec.ts`: `AppModule`, `cookieParser`, `applyPlatformPipes`, `createTestTenant` ×2, `seedTenantAdmin(TENANT_OWNER)` per tenant, a `FINANCE` admin in A, `seedSuperAdmin`, `loginAs`, `gql`, and `errorStatus` (copy these helpers verbatim from that file). Fixtures go through the application services: per tenant, one customer + property (`insertCustomerAndProperty` from the catalog suite), one active-priced service, one team, and one booking **with a team** created via `BookingsService.create` (`bookingA`, `bookingB`). Customer full names use a per-run prefix: `Customer A ${run}` / `Customer B ${run}`. `afterAll` deletes the audit rows it can attribute, then calls `removeTestTenants`.

- [ ] **Step 1: Write the suite.** Numbered cases, each a `describe` or `it`:
  1. **Root scoping.**
     - As B, `bookings(filter: { id: { in: [A, B] } }) { totalCount nodes { id } }` ⇒ only `bookingB`, `totalCount: 1`.
     - As A ⇒ only `bookingA`.
     - As B, `booking(id: bookingA.id)` ⇒ errors present and `data.booking` null, identical in shape to `booking(id: <random uuid>)` (assert the same `errorStatus` and message pattern for both).
  2. **Relation-filter oracle (Decision 10).** For each of the following filters, as B ⇒ `nodes: []` and `totalCount: 0`; as A ⇒ `bookingA` and `totalCount: 1`:
     - `{ customer: { id: { eq: customerA.id } } }`
     - `{ customer: { fullName: { like: "Customer A ${run}%" } } }`
     - `{ property: { id: { eq: propertyA.id } } }`
     - `{ property: { label: { like: "Home A ${run}%" } } }`
     - `{ service: { name: { eq: serviceA.name } } }`
     - `{ team: { id: { eq: teamA.id } } }`
     - `{ team: { name: { eq: teamA.name } } }`
     - `{ or: [ { customer: { id: { eq: customerA.id } } }, { service: { id: { eq: serviceA.id } } } ] }`

     Use `it.each` over the filter list. If a field in the list is not filterable on the target type, drop that row and record it in the task report. `id` rows always stay.
  3. **Nested relation.** As B, `property(id: propertyA.id) { bookings { nodes { id } } }` ⇒ `property: null`. As A ⇒ contains `bookingA`.
  4. **Cross-tenant GraphQL writes (Decision 9).** As B:
     - `updateBooking({ id: bookingA.id, status: CANCELLED })` ⇒ 404;
     - `removeBooking(id: bookingA.id)` ⇒ 404.

     As A, `bookingA` is unchanged and still present.
  5. **Cross-tenant references on create/update (I-1 application half, RFC §4.9).** As B, `createBooking` with B's own customer/property/service and **one** of A's `customerId`, `propertyId`, `serviceId` or `teamId` (four `it.each` rows) ⇒ 404, and the `booking_entity` count for tenant B is unchanged. As B, `updateBooking({ id: bookingB.id, teamId: teamA.id })` ⇒ 404, `bookingB.teamId` unchanged.
  6. **Spoofing (I-2, Review Focus 1).** As B:
     - `createBooking` with `createBookingInput` containing `tenantId: tenantA` ⇒ GraphQL validation error, no new row in either tenant;
     - `bookings(filter: { tenantId: { eq: tenantA } })` ⇒ GraphQL validation error;
     - `bookings(filter: { or: [{ id: { eq: bookingA.id } }, { id: { is: null } }] }) { totalCount nodes { id } }` ⇒ `nodes: []`, `totalCount: 0`;
     - `gql(...)` with an added `x-tenant-id: tenantA` header, `bookings { nodes { id } }` ⇒ only B's rows;
     - REST `POST /bookings` with B's cookie and a body including `tenantId: tenantA` ⇒ 400, and no row;
     - REST `PATCH /bookings/${bookingB.id}` with body `{ tenantId: tenantA }` ⇒ 400, and `bookingB.tenantId` is still `tenantB` (repository read).
  7. **REST cross-tenant (Decision 3).** With B's cookie:
     - `GET /bookings` ⇒ 200, ids ⊆ tenant B and excluding `bookingA.id`;
     - `GET /bookings/${bookingA.id}` ⇒ 404;
     - `PATCH /bookings/${bookingA.id}` `{ status: 'CANCELLED' }` ⇒ 404;
     - `DELETE /bookings/${bookingA.id}` ⇒ 404.

     As A, `bookingA` is unchanged and still present.
  8. **REST auth matrix (Review Focus 4).**
     - No cookie on each of the five routes ⇒ 401.
     - The A `FINANCE` cookie on `POST`/`PATCH`/`DELETE` ⇒ 403, and on `GET /bookings` ⇒ 200 with A's rows only.
     - The Super Admin cookie on each route ⇒ 403.
  9. **Jobs (Decision 11).** As B, `createJobFromBooking(input: { bookingId: bookingA.id })` ⇒ 404, and there is no `cleaning_job_entity` row with `bookingId = bookingA.id`.
  10. **Interim `CleaningJob.booking` guard (Known residual exposure; remove/replace in #86).** As A, create a job from `bookingA` via GraphQL. As B, `job(id) { id booking { id customer { id } } }`: the body contains neither `bookingA.id` nor `customerA.id`, and if `errors` is present its path ends in `booking`. The case does not pin the error text.
  11. **Database backstop (I-1 database half).** Using `dataSource.getRepository(BookingEntity).insert({...})` with `tenantId: tenantB` and one reference to A's row, for each of the four references ⇒ rejects with `QueryFailedError` whose `driverError.constraint` is the matching `fk_booking_*_tenant`.

- [ ] **Step 2: Run** `pnpm --filter api test:e2e -- bookings.tenant-isolation` ⇒ PASS. It is expected to pass on the first run because it verifies Tasks 1–7. If a case fails, fix the owning task's code, never the assertion, and record the fix in the task report.

- [ ] **Step 3: Commit.** `git commit -m "test(85): two-tenant booking isolation e2e"`

---

### Task 9: Documentation touch-points and final verification

**Spec:** Slice decision 3 (README comparison purpose kept); process §2.8.

**Files:**
- Modify: `README.md` (REST row, line ~143; the `apps/api/src` structure paragraph, line ~40, only where it says the REST surface is unauthenticated, if it does)
- Modify: stale "`#85`" comments found by `grep -rn "#85" apps/api/src apps/api/test` that describe a now-false interim state, for example `1790524800000-AddCatalogTenant.ts` "stay id-only — #85 / #87" (leave migration history comments as-is; only non-migration comments change), `seed-tenant-admin.ts`

- [ ] **Step 1: README.** Change the REST row to: `REST API | http://localhost:3000/bookings | full CRUD — \`bookings\` only, authenticated with the same session cookie, roles and tenant scope as GraphQL; kept for the REST/GraphQL comparison; …` (keep the rest of the row). Keep the paragraph's "kept for the REST/GraphQL comparison this repo exists to run" wording unchanged.
- [ ] **Step 2: Comments.** For each hit, update the comment if it states an interim #85 condition that is now false. Do not edit applied migration files.
- [ ] **Step 3: Final gate.**
  - `pnpm --filter api lint`
  - `pnpm --filter api test`
  - `pnpm --filter api test:e2e`
  - `pnpm --filter api build`
  - `migration:run` against a fresh database (`pnpm --filter api migration:run`, per README)
  - `git diff --stat main -- apps/web packages` ⇒ empty
  - the generated GraphQL schema diff ⇒ none

  Record all outputs for the M6 Slice Completion Report.
- [ ] **Step 4: Commit.** `git commit -m "docs(85): REST bookings is authenticated; refresh stale #85 comments"`

---

## Traceability

| RFC | Tasks |
| --- | --- |
| §4.2 principal-only tenant, no Super Admin bypass | 1, 4, 5, 8 (cases 6, 8) |
| §4.4 same-tenant references, `(id, tenantId)` uniqueness | 2, 3, 8 (cases 5, 11) |
| §4.5 predicate on services, nestjs-query, relations, batch, mutations; missing-row semantics | 3, 4, 6, 8 (cases 1–5, 7, 9) |
| §4.5 REST `/bookings` production rule / invariant 11 | 1, 5, 7, 8 (cases 7, 8) |
| §4.7 backfill before NOT NULL | 2 |
| §4.9 `bookings` filter omitting tenant; cross-tenant `serviceId` | 8 (cases 1, 2, 5) |
| #82 I1 relation-filter acceptance criterion | 4, 8 (case 2) |

## Execution risks

- **Coupled task window (Tasks 2–7).** e2e is red between Task 2 and Task 7. Unit tests and `tsc` gate each task. Do not merge a partial branch.
- **`removeTestTenants` ordering.** Job/checklist rows referencing a test tenant's bookings must go first (`fk_cleaning_job_booking` is RESTRICT). Confirm the checklist table/column names from `AddCleaningJob` before writing the SQL.
- **Leftover dev data.** A developer database holding interim #82–#84 cross-tenant booking fixtures makes `AddBookingTenant` abort by design (Decision 13). Remedy: delete those bookings (and their jobs) and re-run. Mention this in the PR description.
