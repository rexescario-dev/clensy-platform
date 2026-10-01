# Tenant-Aware Audit & Security Sweep — Implementation Plan

| Field | Value |
| --- | --- |
| **Status** | Draft (revision 2 — addresses the first M5 review) |
| **Kind** | Implementation plan (M4) for **one** delivery slice |
| **Date** | 2026-10-01 |
| **Tracking** | GitHub [#90](https://github.com/rexescario-dev/clensy-platform/issues/90) (program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81); depends on #85, #86, #87, all merged). One PR for this plan (to be Accepted at M5) + implementation (process §2.8). Branch `feat/90-tenant-aware-audit-sweep`. PR: opened at M9. Split out of this slice: [#106](https://github.com/rexescario-dev/clensy-platform/issues/106) (GraphQL relation-level RBAC policy). |
| **Package / repo** | `clensy-platform` — `apps/api` and docs only. **No** `apps/web`, `packages/*`, migration, or schema (`schema.gql`) changes. |
| **Depends on (Accepted)** | [Multi-Tenant Architecture](../specs/2026-09-23-multi-tenant-architecture-design.md) (Accepted, M3 2026-09-23) — §4.2 (tenant principal needs role **and** tenant predicate; Super Admin is not on any tenant business resolver), §4.5 (one tenant predicate for services, nestjs-query, relations, loaders, mutations; principal-only tenant source), §4.6 (tenant events record the principal's tenant; platform events record explicit `PLATFORM` scope and `tenantId = null`; failed login has no tenant; transactional vs best-effort rules unchanged), §5 invariants 1, 7, 10. **Where this plan and that specification disagree, the specification wins** — stop and return to M2/M3. Relies on the shipped [Tenant Identity Foundation plan](2026-09-23-tenant-identity-foundation-plan.md) (#68: `audit_event_entity.scope`/`tenantId`, `ck_audit_event_scope_tenant`, `AdminScope`, `test/helpers/seed-tenant-admin.ts`), [Customer & Property plan](2026-09-24-customer-property-tenant-isolation-plan.md) (#82: `tenantReadAuthorizer`, `requireTenantId`), [Booking plan](2026-09-28-booking-tenant-isolation-plan.md) (#85: Decision 12 left `booking.*` audit untagged for #90; REST `/bookings` shares GraphQL auth and audit), [Jobs & Checklists plan](2026-09-29-jobs-checklists-tenant-isolation-plan.md) (#86) and [Laundry & Billing plan](2026-09-30-laundry-billing-tenant-isolation-plan.md) (#87), whose "Still open" lists hand booking audit tagging and the relation-level `guards`/`@Roles()` observation to #90. |

> **For agentic workers:** **Draft — not yet Accepted.** Do not start M6 until M5 Accepts this plan (process §2.5). Once Accepted: execute tasks in order with TDD as written; steps use checkbox (`- [ ]`) syntax. Each task ends green on `pnpm --filter api test`, `pnpm --filter api exec tsc --noEmit` and `pnpm --filter api lint` (lint must leave no diff), plus the e2e suites the task names. The full e2e suite and `build` run in Task 6. Do not invent product semantics; stop and report on any need for a design or scope change. No push or PR as a side effect.
>
> **M5 review 1 (2026-10-01): returned for targeted revision.** Each finding was checked against the repository and the pinned dependencies (`@nestjs/graphql` 13, `@ptc-org/nestjs-query-*` 9.5.0) before it was applied. Throwaway probes were run against the real `AppModule` and deleted. The scope, the three-variant union, the no-backfill decision and the #106 split are unchanged.
> - **P0 tenant-id runtime guarantee.** The runtime boundary is now explicit (Audit invariants, item 8). `tenantAuditTags` rejects an empty or blank tenant id, and both helpers throw one error type, `InvalidAuditTagsError`. Tests assert the type, not the message. The union is described as compile-time shape only.
> - **P1 handler discovery.** `collectRootHandlers` now reads `TypeMetadataStorage.getQueriesMetadata()`/`getMutationsMetadata()`. That is the metadata Nest builds the schema from; after compile it re-targets inherited handlers to the concrete resolver class, so the probe showed `customers → CustomerReadResolver.queryMany`. Handlers are keyed by `(operation, field)`. The suite asserts:
>   - exact coverage in both directions against the schema;
>   - one handler per field, with a matching operation;
>   - each handler belongs to a live provider and is a real function;
>   - the handler exists before its metadata is read.
>
>   A focused test pins one inherited generated handler (`customers`) and one own decorated handler (`customer`).
> - **P1 read-surface inventory.** Read resolvers are identified by type: `service instanceof TypeOrmQueryService`, plus class-level `@Resolver` metadata naming a live `ObjectType`. Unresolved metadata fails. A new **object-field inventory** classifies every object-typed field of every schema type as either a declared nestjs-query relation or an allowlisted custom field (loader-backed or embedded). A missing authorizer provider is an explicit failure, never an exclusion.
> - **P1 docs claim** narrowed (decision 9, Task 6). Tenant filtering and role authorization are kept distinct throughout.
> - **P1/P2:**
>   - more mutation checks (Tasks 4–5);
>   - all three union variants are accepted explicitly (Task 2);
>   - `principalAuditTags` is tested with an unknown scope both with and without a tenant;
>   - the service-file count is corrected;
>   - root-field count corrected to **62** (22 queries, 40 mutations; the classification table already had 62);
>   - the deep import gets a sentinel (Task 5);
>   - the no-backfill premise is backed by evidence (decision 2).
> - **Not adopted (reason recorded):** an HTTP-level test with an inconsistent identity row. `ck_admin_user_platform_scope` / `ck_admin_user_tenant_scope` reject such a row, so it cannot be seeded through the database. #89's plan handled its inconsistent-principal cases the same way. The fail-closed path is pinned at the service boundary (Task 2), which is where a session would be issued.

**Goal:** Every audit event carries a scope/tenant that matches its principal, enforced by the compiler for shape and by the helpers at runtime. The tenant-isolation sweep becomes structural regression guards over the live GraphQL surface. Behaviour changes are limited to tagging `booking.*` events, plus the fail-closed paths in invariants 4 and 8.

**Architecture:** `AuditLogEvent` becomes a three-variant discriminated union that mirrors `ck_audit_event_scope_tenant`: tenant, platform, anonymous. Two helpers in `platform/audit/application/audit-tags.ts` build validated tags: `tenantAuditTags(tenantId)` for business services, and `principalAuditTags({ scope, tenantId })` for login. Every call site uses them. Two new e2e guard suites boot `AppModule` and read **live** metadata: the GraphQL `TypeMetadataStorage` resolver metadata and schema, Nest discovery, nestjs-query relation and authorizer metadata, and TypeORM entity metadata. One classifies every root `Query`/`Mutation` field. The other inventories every nestjs-query read resolver, relation and object-typed field, and every tenant-owned entity. The suites **complement**, and do not replace, the per-module two-tenant e2e suites, which remain the runtime proof of tenant isolation.

**Tech Stack:** NestJS 11, `@nestjs/graphql` 13 (`GraphQLSchemaHost`, `TypeMetadataStorage`, `RESOLVER_NAME_METADATA`), `@nestjs/core` `DiscoveryService`, `@ptc-org/nestjs-query-graphql` / `-typeorm` 9.5.0, TypeORM, PostgreSQL, Jest unit (`pnpm --filter api test`) and e2e against real Postgres (`pnpm --filter api test:e2e`), `tsc --noEmit` for type-level tests.

**Spec:** `docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md`

## Slice decisions (brainstorm, 2026-10-01 — developer-approved; revised after M5 review 1)

These are planning decisions for this slice. They add no product semantics beyond the RFC.

1. **Relation-level RBAC is out of scope and tracked in [#106](https://github.com/rexescario-dev/clensy-platform/issues/106).** Relation fields keep their current behaviour. Their declared `guards`/`@Roles()` options are left untouched, neither removed nor enforced. Tenant *filtering* on relations is enforced: the relation `AuthorizerInterceptor` runs because of `fieldResolverEnhancers: ['interceptors']`. Role *authorization* on relation fields is **not** claimed as enforced anywhere in this slice's code comments, tests or docs. Planning-time finding, recorded in #106: every declared relation role list mirrors the *parent* type's view roles. So enforcing the declarations would not stop, for example, `FINANCE` reading `invoice { customer }`. The open question is whether relation reads must satisfy the *target* type's read roles.
2. **No audit backfill and no migration.**
   - **Premise:** the developer stated on 2026-10-01 that the feature has never been published and there is no real production data. Planning-time evidence agrees: the repository has no GitHub releases and no GitHub deployments (`gh release list` is empty; `GET /repos/…/deployments` returns 0), and `.github/workflows/ci.yml` is its only workflow, with no deploy or production step. This verification covers only GitHub; an environment outside it would be an explicit compatibility decision for the developer.
   - **Consequence:** pre-#90 business events stay as recorded (`scope`/`tenantId` null). #90 guarantees that **newly** recorded events satisfy the stricter contract. No migration rewrites audit history.
   - `ck_audit_event_scope_tenant` and the nullable columns are unchanged: the anonymous variant (failed login) still needs null/null.
3. **Typed union on the port.** `AuditLogEvent` is exactly:
   - `{ actorId: string; scope: AdminScope.TENANT; tenantId: string }`
   - `{ actorId: string; scope: AdminScope.PLATFORM; tenantId: null }`
   - `{ actorId: null; scope: null; tenantId: null }`

   Each variant also carries the unchanged `action`, `entityType`, `entityId` and optional `metadata`. `scope` and `tenantId` are required in every variant. Because the anonymous variant requires `actorId: null`, an event with an actor cannot bypass tagging through it. The union is a **compile-time shape** guarantee only (see Audit invariants, item 8). The DB CHECK remains the final integrity safeguard. This matters because a best-effort write (login) swallows a CHECK violation at runtime.
4. **Two helpers, one file, one error type.**
   - `tenantAuditTags(tenantId: string): TenantAuditTags` serves business services, which hold a `requireTenantId`-validated `command.tenantId`, not a principal. It throws `InvalidAuditTagsError` if `tenantId` is not a non-blank string.
   - `principalAuditTags(principal: { scope: AdminScope; tenantId: string | null }): PrincipalAuditTags` maps a DB-loaded identity: `TENANT` + non-blank tenant → tenant tags; `PLATFORM` + null → platform tags. Anything else throws `InvalidAuditTagsError` rather than inferring a scope.
   - The error message names neither the tenant id nor the scope value. Tests assert the error type.
   - The anonymous variant has no helper: its single call site (failed login) writes `scope: null, tenantId: null` explicitly.
5. **Login fails closed on an inconsistent identity row.** If `principalAuditTags` throws during login, the error propagates: no principal is returned and no session is issued. The admin-user CHECKs already forbid that row shape, so the path is unreachable in practice; this decision only makes the code path explicit. It is an identity-validation error, not an audit *persistence* failure, so the best-effort rule (RFC §4.6, Admin Foundation) does not swallow it. Persistence failures stay swallowed and logged.
6. **Every audit call site uses the helpers: 13 service files.**
   - **Twelve tenant-scoped services** use `tenantAuditTags`. Eleven are business services: `customers`, `properties`, `teams`, `cleaners`, `services`, `add-ons`, `pricing-rules`, `bookings`, `jobs`, `laundry-orders`, `invoices`. The twelfth is `admins` (tenant staff administration).
   - **One identity flow**, `login.service.ts`, uses `principalAuditTags` for success and the explicit anonymous literal for failure.
   - The per-module `jobAuditTags` helper and the inline `scope: AdminScope.TENANT` / `tenantId:` pairs are removed.
   - `booking.create`/`booking.update`/`booking.remove` gain tags for the first time, through both GraphQL and REST: both reach `BookingsService`.
7. **Sweep outcome: guard tests, not fixes.** The planning-time sweep identified **no additional tenant-filtering gap within the reviewed surfaces**:
   - service lookups and query builders;
   - the three request-scoped, tenant-keyed loaders;
   - REST `/bookings`;
   - every nestjs-query read resolver, relation and custom object field.

   Relation-level role authorization remains open in #106. The sweep therefore ships as two e2e guard suites over **live** metadata, which *complement* the per-module two-tenant runtime suites:
   - **Root-operation classification** (`test/root-operation-authorization.e2e-spec.ts`):
     - Every `(operation, field)` in the live schema (22 queries, 40 mutations) appears in an explicit classification table, and every table entry exists in the schema under the same operation. Either direction fails on drift.
     - Every field has exactly one handler in Nest's GraphQL resolver metadata, with the same operation. The handler's class is a live provider and the handler is a real function.
     - `PUBLIC` fields (`login`, `logout`) have no `AuthGuard` and no roles. `AUTHENTICATED` (`currentAdmin`) has `AuthGuard` and no roles.
     - `TENANT` fields (all others) have `AuthGuard`, a non-empty `@Roles()` that excludes `SUPER_ADMIN`, and only tenant-scope roles.
     - Guards and roles are read from the handler function Nest invokes and from its concrete class: method then class, the precedence `AuthGuard` uses.
   - **Tenant read surfaces** (`test/tenant-read-authorizers.e2e-spec.ts`):
     - **Read-resolver inventory:** a provider whose `service` is a `TypeOrmQueryService`, with class-level `@Resolver` metadata that must name a live `ObjectType` (unresolved fails). Its DTO must be tenant-scoped and its entity must have `tenantId`.
     - **Relation inventory:** every nestjs-query relation of every live `ObjectType` must be exposed as a field of that type in the schema, and must target a live `ObjectType`.
     - **Object-field inventory:** every object-typed field of every live, non-connection `ObjectType` is either a declared nestjs-query relation or listed in `CUSTOM_OBJECT_FIELDS` with its reason. Any unrecognized field fails.
     - **Tenant scoping:** every read-resolver DTO and every relation target is tenant-scoped, unless it is a child-row exception. Scoped means the live authorizer returns `{ tenantId: { eq: <principal tenant> } }`, and `{ id: { is: null } }` for a principal without a tenant. A missing authorizer provider is an explicit failure.
     - **No unscoped parent:** every type that declares relations is tenant-scoped. That closes the precondition for the `authorizeRelation` `{}` fall-open recorded in #85.
     - **Entity coverage:** every TypeORM entity with `tenantId` is either a read-resolver entity or in `CUSTOM_SURFACE_ENTITIES`.
     - Every allowlist fails on stale entries.
   - **Limits, stated in both suites:** they are metadata checks, not proof of effective runtime authorization. They do not prove relation-level RBAC (#106). Custom `@Query` handlers and the custom loader-backed fields scope inside their services and loaders; that is proven by the module two-tenant suites, which this slice keeps.
8. **Allowlists (narrow, each with its reason):**

   | Allowlist | Entry | Why it is exempt |
   | --- | --- | --- |
   | `CHILD_ROW_TYPES` (no own authorizer) | `ChecklistItem` | No `tenantId` column. A row belongs to one checklist, and the type is reachable only as `Checklist.items`; `Checklist` is tenant-scoped. |
   | | `InvoiceLine` | No `tenantId` column. Reachable only as `Invoice.lines`; `Invoice` is tenant-scoped. |
   | | `LaundryOrderLine` | Has `tenantId`, bound to its order by composite FK (#87), but no authorizer. Reachable only as `LaundryOrder.lines`; `LaundryOrder` is tenant-scoped. |
   | `CUSTOM_SURFACE_ENTITIES` (tenant-owned, no read resolver) | `AdminUserEntity` | Read only through the custom `admins` query; `AdminsService` lists by the principal's tenant (#68). |
   | | `PricingRuleEntity` | Read only through `activePricing` (query and `Service.activePricing` loader); `PricingRulesService` scopes by tenant (#84). |
   | | `LaundryOrderLineEntity` | Child rows of `LaundryOrder`, read only via `LaundryOrder.lines` and `LaundryOrdersService` (#87). |
   | | `AuditEventEntity` | Not exposed through GraphQL. |
   | `CUSTOM_OBJECT_FIELDS` (object fields that are not nestjs-query relations) | `Service.activePricing` | `ServiceResolver` `@ResolveField` through the request-scoped `ActivePricingLoader`, keyed by the principal's tenant (#84). |
   | | `Cleaner.team` | `CleanerResolver` `@ResolveField` through `CleanerTeamLoaders`, keyed by the principal's tenant (#83). |
   | | `CleaningJob.checklist` | `JobResolver` `@ResolveField` through `JobRelationLoaders`, keyed by the principal's tenant (#86). |
   | | `CleaningJob.team` | `JobResolver` `@ResolveField` through `JobRelationLoaders`, keyed by the principal's tenant (#86). |
   | | `Booking.pricingSnapshot` | TypeORM embeddable stored on the booking row; no separate read. |
   | | `LaundryOrderLine.pricingSnapshot` | TypeORM embeddable stored on the line row; no separate read. |
   | | `LoginResult.admin` | The caller's own principal, returned by `login`. |

   For each child-row type the suite also asserts that it declares no relations, is no read resolver's DTO, is not a root connection node, and has at least one parent relation. Every parent is covered by the "no unscoped parent" rule.
9. **Docs.**
   - Remove or correct the stale "Known interim gap" notes in `docs/README.md`. The #85 section's "(until #86)" note is the one named in review. The #82, #83 and #84 sections carry the same kind of note, each resolved by #85–#87. Each note is checked against the shipped code before it is changed (Task 6).
   - Add a #90 section covering the audit contract, no backfill (decision 2), and the guard suites.
   - The security claim in that section is limited to: *the planning-time sweep identified no additional tenant-filtering gap within the reviewed surfaces; relation-level role authorization remains open in #106.* The guard suites are described as metadata checks that complement the runtime isolation suites.
   - Update only the RFC's **Tracking** cell for #90; the RFC's semantics are unchanged.

## Audit invariants (what this slice guarantees, and where it is pinned)

| # | Invariant | Pinned by |
| --- | --- | --- |
| 1 | Tenant events: `actorId` non-null, `scope = TENANT`, `tenantId` = the tenant derived from the authenticated principal. | Union (Task 2 type test); booking unit tests (exact objects); Task 3 e2e (stored rows vs caller) |
| 2 | Platform events: `actorId` non-null, `scope = PLATFORM`, `tenantId = null`. | Union; `principalAuditTags` unit tests; Task 3 Super Admin login |
| 3 | Anonymous events: `actorId = null`, `scope = null`, `tenantId = null`; failed login is the only documented use. | Union (an actor-bearing anonymous event is rejected); login unit tests; Task 3 failed-login row |
| 4 | Identity inconsistency: a successful credential check against an invalid scope/tenant combination issues no principal or session. | Task 2 login unit test (throws `InvalidAuditTagsError`, returns nothing, writes no audit) |
| 5 | Best-effort persistence: a DB failure while recording a valid login event does not prevent login. Identity-validation errors are not swallowed. | Task 2 real-`AuditLoggerService` login test; invariant 4 test |
| 6 | No client-controlled tenant tags: business tags use the validated command tenant (`requireTenantId` → command), login tags use the DB-loaded identity. | Task 2 call-site migration (tenant expression per site); Task 3 two-tenant e2e |
| 7 | No history rewrite: existing null-tagged rows are unchanged; only new events meet the stricter contract. | No migration (Task 6 diff check) |
| 8 | Runtime boundary for the tenant id: the union checks shape only. The runtime guarantees are: `requireTenantId` rejects a null principal tenant; the principal tenant comes from `admin_user.tenantId` (uuid, FK to `tenant`, admin-user CHECKs); `tenantAuditTags` rejects a non-string or blank id; `ck_audit_event_scope_tenant` rejects null on a `TENANT` row. `audit_event_entity.tenantId` is `varchar` with no FK, by design (#68). This slice does not add one, so the audit table alone does not prove that a tenant id names an existing tenant. | `audit-tags` unit tests (blank and empty ids); existing `requireTenantId` usage |

## Global Constraints

- RFC §4.6: tenant events record `tenantId` = principal tenant and `scope = TENANT`. Platform events record `scope = PLATFORM`, `tenantId = null`. Failed login keeps `actorId = null` and no tenant. Secrets never go in `metadata`. Transactional vs best-effort semantics are unchanged.
- RFC §4.5 / invariant 1: the tenant used for tagging comes only from the DB-loaded principal (directly, or via `requireTenantId` → `command.tenantId`), never from client input.
- RFC §4.2 / invariant 10: no tenant business root operation may list `SUPER_ADMIN`.
- No migration, no backfill, no `schema.gql` change, no `apps/web`/`packages/*` change, no change to relation `guards`/`@Roles()` options or `fieldResolverEnhancers` (decision 1).
- REST `/bookings` behaviour other than its audit tags is unchanged (#91 owns REST cleanup). The single-production-tenant rule stays in force (#92).
- The Accepted RFC's text is not edited except its Tracking cell (decision 9).

## Review Focus

Failure modes the spec implies that are easy to miss, most likely first. Each one is pinned by a test in the owning task.

1. **Spread order lets a later key override the tags.** A call site that spreads `...tenantAuditTags(x)` and then writes `tenantId`/`scope` again would persist the wrong tenant. Pinned: the tags are the **last** property at every call site (Task 2 Step 5); the booking unit tests assert the **exact** event object (Task 2); the e2e asserts the stored row's tenant equals the caller's (Task 3).
2. **REST and GraphQL booking mutations disagree.** REST is a second adapter over the same service. Pinned: Task 3 asserts tags for all three mutations through **both** adapters, with a different tenant per adapter, so a hard-coded tenant cannot pass.
3. **An inconsistent identity row at login** must not yield a session or a mislabelled audit row. Pinned: Task 2 login unit test.
4. **Best-effort audit still best-effort after the port change.** Pinned: Task 2 wires the real `AuditLoggerService` with a rejecting repository into `LoginService`.
5. **Guard suites that pass vacuously.** Examples: discovery finds nothing, a surface is skipped because a provider or metadata is missing, or an allowlist goes stale. Pinned: non-empty inventories and named sentinels; exact `(operation, field)` equality with the schema; explicit failures for missing providers and unresolved metadata; stale checks on every allowlist. Each guard is shown to fail by temporary mutations before it is accepted (Tasks 4–5).

---

## File structure

| File | Responsibility | Task |
| --- | --- | --- |
| `apps/api/src/platform/audit/application/audit-tags.ts` (create) | `tenantAuditTags`, `principalAuditTags`, `InvalidAuditTagsError`, tag types | 1 |
| `apps/api/src/platform/audit/tests/audit-tags.spec.ts` (create) | helper unit tests | 1 |
| `apps/api/src/platform/audit/application/audit-logger.port.ts` (modify) | `AuditLogEvent` union | 2 |
| `apps/api/src/platform/audit/tests/audit-log-event.types.spec.ts` (create) | type-level tests (`@ts-expect-error`), checked by `tsc` | 2 |
| `apps/api/src/platform/audit/infrastructure/audit-logger.service.ts` (modify) | persist `event.scope`/`event.tenantId` as given | 2 |
| `apps/api/src/platform/audit/tests/audit-logger.service.spec.ts` (modify) | events carry explicit tags | 2 |
| 13 service files (decision 6) under `apps/api/src/modules/*/application/services/` (modify) | call sites use helpers; bookings gains tags | 2 |
| `apps/api/src/modules/bookings/tests/application/bookings.service.spec.ts` (modify) | exact tagged booking events | 2 |
| `apps/api/src/modules/admins/tests/application/login.service.spec.ts` (modify) | fail-closed + best-effort cases | 2 |
| `apps/api/test/tenant-audit-tags.e2e-spec.ts` (create) | booking GraphQL + REST tags, login tags | 3 |
| `apps/api/test/helpers/graphql-surface.ts` (create) | boot `AppModule`; collect root handlers from resolver metadata | 4 |
| `apps/api/test/root-operation-authorization.e2e-spec.ts` (create) | root-operation classification guard | 4 |
| `apps/api/test/tenant-read-authorizers.e2e-spec.ts` (create) | read-surface, object-field and entity-coverage guard | 5 |
| `docs/README.md`, RFC Tracking cell, this plan's Tracking row (modify) | docs | 6 |

---

### Task 0: M6 baseline (no code)

- [ ] **Step 1:** On `main`, run `pnpm --filter api test:e2e` and record the names of any failing suites/tests in the M6 verification record. During this slice, only those may fail; any other failure blocks.
- [ ] **Step 2:** On `feat/90-tenant-aware-audit-sweep`, run `pnpm --filter api test`, `pnpm --filter api exec tsc --noEmit`, `pnpm --filter api lint`; all green, lint leaves no diff.

### Task 1: Audit tag helpers (RFC §4.6; decisions 3–4; invariants 2, 8)

Additive only: nothing consumes the helpers yet, so the port is unchanged in this task.

**Files:**
- Create: `apps/api/src/platform/audit/application/audit-tags.ts`
- Test: `apps/api/src/platform/audit/tests/audit-tags.spec.ts`

**Interfaces:**
- Produces (used by Tasks 2–3):
  - `interface TenantAuditTags { scope: AdminScope.TENANT; tenantId: string }`
  - `interface PlatformAuditTags { scope: AdminScope.PLATFORM; tenantId: null }`
  - `type PrincipalAuditTags = TenantAuditTags | PlatformAuditTags`
  - `function tenantAuditTags(tenantId: string): TenantAuditTags`
  - `function principalAuditTags(principal: { scope: AdminScope; tenantId: string | null }): PrincipalAuditTags`
  - `class InvalidAuditTagsError extends Error`

- [ ] **Step 1: Write the failing test** — `audit-tags.spec.ts`:

```ts
import { AdminScope } from '../../auth/domain/admin-scope';
import {
  InvalidAuditTagsError,
  principalAuditTags,
  tenantAuditTags,
} from '../application/audit-tags';

describe('audit tags (multi-tenant spec §4.6; #90 decision 4)', () => {
  describe('tenantAuditTags', () => {
    it('tags the given tenant with TENANT scope', () => {
      expect(tenantAuditTags('tenant-1')).toEqual({
        scope: AdminScope.TENANT,
        tenantId: 'tenant-1',
      });
    });

    it.each(['', '   '])('rejects a blank tenant id (%j)', (tenantId) => {
      expect(() => tenantAuditTags(tenantId)).toThrow(InvalidAuditTagsError);
    });

    it('rejects a non-string tenant id smuggled past the type system', () => {
      expect(() => tenantAuditTags(null as unknown as string)).toThrow(
        InvalidAuditTagsError,
      );
    });
  });

  describe('principalAuditTags', () => {
    it('maps a tenant principal to tenant tags', () => {
      expect(
        principalAuditTags({ scope: AdminScope.TENANT, tenantId: 'tenant-1' }),
      ).toEqual({ scope: AdminScope.TENANT, tenantId: 'tenant-1' });
    });

    it('maps a platform principal to PLATFORM + null tenant', () => {
      expect(
        principalAuditTags({ scope: AdminScope.PLATFORM, tenantId: null }),
      ).toEqual({ scope: AdminScope.PLATFORM, tenantId: null });
    });

    it.each([
      ['TENANT without a tenant', AdminScope.TENANT, null],
      ['TENANT with a blank tenant', AdminScope.TENANT, ' '],
      ['PLATFORM with a tenant', AdminScope.PLATFORM, 'tenant-1'],
      ['an unknown scope with a tenant', 'UNKNOWN', 'tenant-1'],
      ['an unknown scope without a tenant', 'UNKNOWN', null],
    ])('rejects %s instead of guessing', (_label, scope, tenantId) => {
      expect(() =>
        principalAuditTags({ scope: scope as AdminScope, tenantId }),
      ).toThrow(InvalidAuditTagsError);
    });
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter api test -- audit-tags` ⇒ FAIL (`Cannot find module '../application/audit-tags'`).

- [ ] **Step 3: Implement** — `audit-tags.ts`:

```ts
import { AdminScope } from '../../auth/domain/admin-scope';

// Audit tags (multi-tenant spec §4.6; #90 decisions 3–4). The shapes mirror
// the tenant and platform branches of `ck_audit_event_scope_tenant`; the
// anonymous branch (failed login) has no helper — its one call site writes
// `scope: null, tenantId: null` explicitly.
//
// Runtime boundary (#90 audit invariant 8): `AuditLogEvent` only checks the
// shape at compile time. These helpers reject blank or inconsistent input
// at runtime; the tenant id itself comes from the DB-loaded principal
// (`requireTenantId` for commands), and the DB CHECK is the last safeguard.
export interface TenantAuditTags {
  scope: AdminScope.TENANT;
  tenantId: string;
}

export interface PlatformAuditTags {
  scope: AdminScope.PLATFORM;
  tenantId: null;
}

export type PrincipalAuditTags = TenantAuditTags | PlatformAuditTags;

// Deliberately carries no scope or tenant value in its message.
export class InvalidAuditTagsError extends Error {
  constructor(reason: string) {
    super(`Invalid audit tags: ${reason}`);
    this.name = 'InvalidAuditTagsError';
  }
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

// Business services: `tenantId` is the `requireTenantId`-validated principal
// tenant carried on the command — never client input (spec §4.5).
export function tenantAuditTags(tenantId: string): TenantAuditTags {
  if (!isNonBlankString(tenantId)) {
    throw new InvalidAuditTagsError('a TENANT event needs a non-blank tenant id');
  }
  return { scope: AdminScope.TENANT, tenantId };
}

// A DB-loaded identity (login). Rejects any combination the schema forbids
// rather than inferring a scope from `tenantId` (spec §3: scope is explicit).
export function principalAuditTags(principal: {
  scope: AdminScope;
  tenantId: string | null;
}): PrincipalAuditTags {
  if (principal.scope === AdminScope.TENANT) {
    return tenantAuditTags(principal.tenantId as string);
  }
  if (principal.scope === AdminScope.PLATFORM && principal.tenantId === null) {
    return { scope: AdminScope.PLATFORM, tenantId: null };
  }
  throw new InvalidAuditTagsError(
    'the principal scope and tenant do not form a valid combination',
  );
}
```

(`tenantAuditTags(principal.tenantId as string)` relies on `tenantAuditTags` rejecting `null` at runtime, which the "non-string" test pins.)

- [ ] **Step 4: Run** `pnpm --filter api test -- audit-tags` ⇒ PASS. Then `pnpm --filter api test`, `pnpm --filter api exec tsc --noEmit`, `pnpm --filter api lint` ⇒ green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/platform/audit/application/audit-tags.ts apps/api/src/platform/audit/tests/audit-tags.spec.ts
git commit -m "feat(90): add validated tenant and principal audit tag helpers"
```

### Task 2: `AuditLogEvent` union and every call site (RFC §4.6; decisions 3–6; invariants 1–6)

The port change, its type tests and the call-site migration land together, because `tsc` must be green at the end of the task.

**Files:**
- Modify: `apps/api/src/platform/audit/application/audit-logger.port.ts`
- Create: `apps/api/src/platform/audit/tests/audit-log-event.types.spec.ts`
- Modify: `apps/api/src/platform/audit/infrastructure/audit-logger.service.ts:47-56`
- Modify: `apps/api/src/platform/audit/tests/audit-logger.service.spec.ts`
- Modify (decision 6, 13 files, all under `apps/api/src/modules/`):
  - 11 business services: `customers/application/services/customers.service.ts`, `customers/application/services/properties.service.ts`, `cleaners/application/services/teams.service.ts`, `cleaners/application/services/cleaners.service.ts`, `catalog/application/services/services.service.ts`, `catalog/application/services/add-ons.service.ts`, `catalog/application/services/pricing-rules.service.ts`, `bookings/application/services/bookings.service.ts`, `jobs/application/services/jobs.service.ts`, `laundry/application/services/laundry-orders.service.ts`, `billing/application/services/invoices.service.ts`
  - tenant staff administration: `admins/application/services/admins.service.ts`
  - identity flow: `admins/application/services/login.service.ts`
- Modify tests: `modules/bookings/tests/application/bookings.service.spec.ts`, `modules/admins/tests/application/login.service.spec.ts`

**Interfaces:**
- Consumes: Task 1 exports.
- Produces: `type AuditLogEvent` (union below); `AuditLogger.log(event: AuditLogEvent)` signature unchanged.

- [ ] **Step 1: Write the type-level test** — `audit-log-event.types.spec.ts`. Each rejected literal stays on **one line**, so the `@ts-expect-error` directly above it is the line that carries the error. The planning-time check type-checked this exact set against the union: every accepted shape compiles and all six directives are consumed.

```ts
import { AdminScope } from '../../auth/domain/admin-scope';
import type { AuditLogEvent } from '../application/audit-logger.port';
import { principalAuditTags, tenantAuditTags } from '../application/audit-tags';

// Type-level contract (#90 decision 3), enforced by
// `pnpm --filter api exec tsc --noEmit`. Each `@ts-expect-error` fails the
// type-check if the line below it ever starts compiling. Compile-time
// shape only — runtime validation lives in `audit-tags.spec.ts`.
const base = { action: 'x', entityId: null, entityType: null };
const TENANT = AdminScope.TENANT;
const PLATFORM = AdminScope.PLATFORM;

function ok(event: AuditLogEvent): AuditLogEvent {
  return event;
}

describe('AuditLogEvent (type-level)', () => {
  it('accepts the tenant variant (helper and principal-derived)', () => {
    const events = [
      ok({ ...base, actorId: 'a1', ...tenantAuditTags('t1') }),
      ok({
        ...base,
        actorId: 'a1',
        ...principalAuditTags({ scope: TENANT, tenantId: 't1' }),
      }),
    ];
    expect(events.map((event) => event.scope)).toEqual([TENANT, TENANT]);
  });

  it('accepts the platform variant (literal and principal-derived)', () => {
    const events = [
      ok({ ...base, actorId: 'a1', scope: PLATFORM, tenantId: null }),
      ok({
        ...base,
        actorId: 'a1',
        ...principalAuditTags({ scope: PLATFORM, tenantId: null }),
      }),
    ];
    expect(events.map((event) => event.scope)).toEqual([PLATFORM, PLATFORM]);
  });

  it('accepts the anonymous variant only without an actor', () => {
    const event = ok({ ...base, actorId: null, scope: null, tenantId: null });
    expect(event.scope).toBeNull();
  });

  it('rejects untagged, inconsistent and actor-bearing anonymous events', () => {
    const widened: { scope: AdminScope; tenantId: string } = {
      scope: TENANT,
      tenantId: 't1',
    };
    const rejected = [
      // @ts-expect-error untagged event
      () => ok({ ...base, actorId: 'a1' }),
      // @ts-expect-error TENANT scope without a tenant
      () => ok({ ...base, actorId: 'a1', scope: TENANT, tenantId: null }),
      // @ts-expect-error PLATFORM scope with a tenant
      () => ok({ ...base, actorId: 'a1', scope: PLATFORM, tenantId: 't1' }),
      // @ts-expect-error an actor cannot use the anonymous variant
      () => ok({ ...base, actorId: 'a1', scope: null, tenantId: null }),
      // @ts-expect-error an actorless event cannot carry a tenant
      () => ok({ ...base, actorId: null, ...tenantAuditTags('t1') }),
      // @ts-expect-error a widened scope is not a valid discriminant
      () => ok({ ...base, actorId: 'a1', ...widened }),
    ];
    expect(rejected).toHaveLength(6);
  });
});
```

The rejected cases are wrapped in arrow functions, so the runtime test never constructs them; it only counts them. If Prettier (via `lint --fix`) wraps any rejected line, shorten it. Do **not** add `// prettier-ignore` or move a directive.

- [ ] **Step 2: Run** `pnpm --filter api exec tsc --noEmit` ⇒ FAIL with `Unused '@ts-expect-error' directive` on all six rejected lines. Today's optional `scope`/`tenantId` and `actorId: string | null` accept every one of them.

- [ ] **Step 3: Change the port** — replace the `AuditLogEvent` interface and its comment in `audit-logger.port.ts`:

```ts
import { JsonValue } from '../domain/json-value';
import type { PlatformAuditTags, TenantAuditTags } from './audit-tags';

interface AuditEventFields {
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata?: Record<string, JsonValue>;
}

// The event shape callers pass to `log()` — deliberately not `AuditEvent`
// itself: `id`/`occurredAt` are assigned by persistence, and `metadata` is
// optional here (an event may have none) but stored as `null` at rest.
//
// Discriminated on `scope`, mirroring `ck_audit_event_scope_tenant`
// (multi-tenant spec §4.6; #90 decision 3): a tenant event names its
// tenant, a platform event has none, and only an actorless event (failed
// login) may omit both. This is a compile-time shape check only: build
// tags with `tenantAuditTags` / `principalAuditTags` (`./audit-tags`),
// which validate at runtime. The DB CHECK stays the last safeguard, but
// best-effort writes swallow its violations.
export type AuditLogEvent =
  | (AuditEventFields & TenantAuditTags & { actorId: string })
  | (AuditEventFields & PlatformAuditTags & { actorId: string })
  | (AuditEventFields & { actorId: null; scope: null; tenantId: null });
```

Keep the `AuditLogger` interface, its comment and `AUDIT_LOGGER` unchanged. Remove the now-unused `AdminScope` import from the port.

- [ ] **Step 4: Persist tags as given** — in `AuditLoggerService.log()`, replace `tenantId: event.tenantId ?? null` with `tenantId: event.tenantId`, and `scope: event.scope ?? null` with `scope: event.scope`. In `audit-logger.service.spec.ts`, add `scope: null, tenantId: null` to the two actorless events (the "persists a row matching the event shape…" and "stores null scope and tenantId…" cases). An event with an actor that already writes `scope: AdminScope.TENANT, tenantId: 'tenant-1'` compiles unchanged. Expectations are unchanged.

- [ ] **Step 5: Migrate the twelve tenant-scoped services.** In each block below, delete the `tenantId: …,` and `scope: AdminScope.TENANT,` lines and add `...tenantAuditTags(<tenant expression>),` as the **last** property of the object literal, so nothing after it can override the tags (Review Focus 1). Import `tenantAuditTags` from `../../../../platform/audit/application/audit-tags`. Remove the `AdminScope` import where it becomes unused; `admins.service.ts` still uses it at line 34, so it stays there.

| File | Events | Tenant expression |
| --- | --- | --- |
| `customers.service.ts` | `customer.create`, `customer.update` | `command.tenantId` |
| `properties.service.ts` | `property.create`, `property.update` | `command.tenantId` |
| `teams.service.ts` | `team.create` | `command.tenantId` |
| `cleaners.service.ts` | `cleaner.assign_team`, `cleaner.create`, `cleaner.update` | `command.tenantId` |
| `services.service.ts` | `service.create` / `service.update` | `command.tenantId` / `tenantId` |
| `add-ons.service.ts` | `add_on.create` / `add_on.update` | `command.tenantId` / `tenantId` |
| `pricing-rules.service.ts` | `pricing_rule.create` | `command.tenantId` |
| `admins.service.ts` | `admin.created`, `admin.disabled` | `tenantId` |
| `laundry-orders.service.ts` | shared audit method (all laundry actions) | `tenantId` |
| `invoices.service.ts` | `invoice.generated` | `invoice.tenantId` (persisted from `command.tenantId` in the same transaction) |
| `jobs.service.ts` | `job.create`, `job.assign_team`, `job.checklist_item.complete`, `job.complete` | `command.tenantId`: replace `...jobAuditTags(command.tenantId)` with `...tenantAuditTags(command.tenantId)` and delete the `jobAuditTags` function (lines 53–55) |
| `bookings.service.ts` | `booking.create`, `booking.update`, `booking.remove` | Steps 6–7 |

Example, `customers.service.ts` `customer.create`:

```ts
        await this.auditLogger.log({
          actorId: command.actorId,
          entityId: entity.id,
          action: 'customer.create',
          entityType: 'customer',
          ...tenantAuditTags(command.tenantId),
        });
```

- [ ] **Step 6: Tag booking events — write the failing unit assertions first.** In `bookings.service.spec.ts`:
  - Every exact `auditLogger.log` expectation for `booking.create` and `booking.remove` (around lines 286, 306, 499) gains `scope: AdminScope.TENANT` and `tenantId: 't-a'`, the tenant those cases pass.
  - The `booking.update` expectation (around line 459) gains `scope: AdminScope.TENANT, tenantId: 't-a'` inside its `objectContaining`.
  - Rename `'always calls auditLogger.log with no scope/tenant fields (Decision 12)'` to `'tags booking.create with the command tenant and TENANT scope (#90 decision 6)'`.
  - Import `AdminScope` if the spec does not already.

  Run `pnpm --filter api test -- bookings.service` ⇒ FAIL (events lack tags).

- [ ] **Step 7: Implement booking tags** — in `bookings.service.ts`, change `logAudit` and its three callers:

```ts
  // Every caller has a principal after #85 Slice decision 3: `actorId` is
  // always a real actor, and every successful call emits its audit event
  // unconditionally. #90 decision 6: tagged with the same principal tenant
  // the caller's `{ id, tenantId }` lookup used. Single enforcement point
  // for that rule, shared by `create`/`update`/`remove`.
  private async logAudit(
    actorId: string,
    tenantId: string,
    action: string,
    entityId: string,
  ): Promise<void> {
    await this.auditLogger.log({
      actorId,
      entityId,
      action,
      entityType: 'booking',
      ...tenantAuditTags(tenantId),
    });
  }
```

Callers: `this.logAudit(command.actorId, command.tenantId, 'booking.create', entity.id)` (line 75), `this.logAudit(actorId, tenantId, 'booking.remove', id)` (line 130), and `this.logAudit(<the actor variable already passed today>, command.tenantId, 'booking.update', id)` (line 207). Run `pnpm --filter api test -- bookings.service` ⇒ PASS.

- [ ] **Step 8: Login — failing tests first.** In `login.service.spec.ts`, add:

```ts
  it('fails closed on an identity row whose scope and tenant disagree (#90 decision 5)', async () => {
    repository.findOneBy.mockResolvedValue({
      id: 'admin-x',
      email: 'x@example.com',
      passwordHash: activeAdminPasswordHash,
      isActive: true,
      role: Role.OPS_MANAGER,
      scope: AdminScope.TENANT,
      tenantId: null,
    });

    await expect(
      service.login('x@example.com', 'correct-password'),
    ).rejects.toThrow(InvalidAuditTagsError);
    expect(auditLogger.log).not.toHaveBeenCalled();
  });
```

and a separate `describe` that wires the real best-effort logger:

```ts
describe('LoginService with the real AuditLoggerService (best-effort, spec §4.6)', () => {
  it('still returns the principal when the audit write fails', async () => {
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const adminRepository = {
      findOneBy: jest.fn().mockResolvedValue({
        id: 'admin-1',
        email: 'owner@example.com',
        passwordHash,
        isActive: true,
        role: Role.TENANT_OWNER,
        scope: AdminScope.TENANT,
        tenantId: 'tenant-1',
      }),
    };
    const auditRepository = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn().mockRejectedValue(new Error('audit table unavailable')),
    };
    const logger = { error: jest.fn(), log: jest.fn(), warn: jest.fn() };
    const module = await Test.createTestingModule({
      providers: [
        LoginService,
        AuditLoggerService,
        { provide: AUDIT_LOGGER, useExisting: AuditLoggerService },
        { provide: getRepositoryToken(AdminUserEntity), useValue: adminRepository },
        { provide: getRepositoryToken(AuditEventEntity), useValue: auditRepository },
        { provide: Logger, useValue: logger },
      ],
    }).compile();

    const principal = await module
      .get(LoginService)
      .login('owner@example.com', 'correct-password');

    expect(principal).toEqual({
      id: 'admin-1',
      role: Role.TENANT_OWNER,
      scope: AdminScope.TENANT,
      tenantId: 'tenant-1',
    });
    expect(auditRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.login.succeeded',
        scope: AdminScope.TENANT,
        tenantId: 'tenant-1',
      }),
    );
    expect(logger.error).toHaveBeenCalled();
  });
});
```

Imports to add:
- `Logger` from `@nestjs/common`
- `AuditLoggerService` from `platform/audit/infrastructure/audit-logger.service`
- `AuditEventEntity`
- `InvalidAuditTagsError` from `platform/audit/application/audit-tags`

The existing failed-login case at line 218 already asserts no scope or tenant; keep it. Run `pnpm --filter api test -- login.service` ⇒ the fail-closed case FAILS, because today's code logs `scope: TENANT, tenantId: null` and returns a principal.

- [ ] **Step 9: Implement login tags** — in `login.service.ts`:

```ts
    if (!isValid) {
      await this.auditLogger.log({
        actorId: null,
        entityId: null,
        action: 'admin.login.failed',
        entityType: null,
        metadata: { email: normalizedEmail, reason: 'invalid_credentials' },
        scope: null,
        tenantId: null,
      });
      return null;
    }

    // Failed logins above carry no scope/tenant (no principal, spec §4.6);
    // a success records the principal's explicit scope, so a Super Admin
    // login is PLATFORM + null tenant rather than an ambiguous null.
    // `principalAuditTags` throws on a row whose scope and tenant disagree
    // (forbidden by the admin_user CHECKs): login fails closed rather than
    // issuing a session for an identity the RFC says cannot exist (#90
    // decision 5). That is an identity-validation error, not an audit
    // persistence failure, so the best-effort rule does not swallow it.
    const auditTags = principalAuditTags(admin);
    await this.auditLogger.log({
      actorId: admin.id,
      entityId: admin.id,
      action: 'admin.login.succeeded',
      entityType: 'AdminUser',
      ...auditTags,
    });
```

Run `pnpm --filter api test -- login.service` ⇒ PASS.

- [ ] **Step 10: Inventory the call sites.** `grep -rn "auditLogger.log({" apps/api/src --include=*.ts | grep -v "/tests/"` must list exactly these sites, each ending in `...tenantAuditTags(`, `...auditTags` or the failed-login literal. Record them in the M6 verification record:
  - `customers` 2, `properties` 2, `teams` 1, `cleaners` 3, `services` 2, `add-ons` 2, `pricing-rules` 1, `admins` 2, `laundry-orders` 1, `invoices` 1, `jobs` 4, `bookings` 1 (the shared `logAudit`);
  - `login` 2.

  These must print nothing:
  - `grep -rn "jobAuditTags\|scope: AdminScope.TENANT" apps/api/src/modules --include=*.ts | grep -v "/tests/"`
  - `grep -rn "tenantId?: string | null\|scope?: AdminScope" apps/api/src/platform/audit`

- [ ] **Step 11: Run** `pnpm --filter api test`, `pnpm --filter api exec tsc --noEmit` (the type-level spec now consumes all six directives), `pnpm --filter api lint` ⇒ green. `pnpm --filter api test:e2e -- admin-foundation tenant-isolation cleaners-teams.service` ⇒ PASS: the existing audit assertions on tagged modules still hold.

- [ ] **Step 12: Commit**

```bash
git add apps/api/src
git commit -m "feat(90): make AuditLogEvent a scope-discriminated union and tag every audit call site, including booking events"
```

### Task 3: Audit tag e2e — booking (GraphQL + REST) and login (RFC §4.6; invariants 1–3, 6; Review Focus 1–2)

**Files:**
- Create: `apps/api/test/tenant-audit-tags.e2e-spec.ts`

**Interfaces:**
- Consumes: `test/helpers/seed-tenant-admin.ts` (`createTestTenant`, `removeTestTenants`, `seedTenantAdmin`, `seedSuperAdmin`), `test/helpers/unique-email.ts`, the application services used for fixtures in `test/bookings.tenant-isolation.e2e-spec.ts`.

- [ ] **Step 1: Write the suite.** Use the same setup shape as `bookings.tenant-isolation.e2e-spec.ts` (lines 48–332): `AppModule`, `cookieParser`, `applyPlatformPipes`, and the `loginAs`/`gql` helpers.
  - **Fixtures:** two test tenants A and B, a `TENANT_OWNER` in each, one Super Admin, and in each tenant a service with a pricing rule plus a customer and property. Create them via `ServicesService`/`PricingRulesService` and repository inserts, exactly as that suite's `beforeAll` and `insertCustomerAndProperty` do.
  - **`afterAll`:** delete audit rows for this suite's actor ids, plus the failed-login rows for its unique email (`metadata->>'email'`), then call `removeTestTenants`.

  Cases:

```ts
  async function bookingEvents(entityId: string) {
    return auditEventRepository.find({
      order: { occurredAt: 'ASC' },
      where: { entityId, entityType: 'booking' },
    });
  }

  it('tags booking.create/update/remove made through GraphQL with the caller tenant', async () => {
    const created = await gql(cookieA, CREATE_BOOKING_MUTATION, {
      input: {
        customerId: customerA.id,
        propertyId: propertyA.id,
        serviceId: serviceA.id,
        scheduledAt: '2031-02-01T09:00:00.000Z',
      },
    });
    expect(created.body.errors).toBeUndefined();
    const id: string = created.body.data.createBooking.id;

    const updated = await gql(cookieA, UPDATE_BOOKING_MUTATION, {
      input: { id, status: 'CANCELLED' },
    });
    expect(updated.body.errors).toBeUndefined();
    const removed = await gql(cookieA, REMOVE_BOOKING_MUTATION, { id });
    expect(removed.body.errors).toBeUndefined();

    const events = await bookingEvents(id);
    expect(events.map((e) => e.action)).toEqual([
      'booking.create',
      'booking.update',
      'booking.remove',
    ]);
    for (const event of events) {
      expect(event).toMatchObject({
        actorId: ownerAId,
        scope: AdminScope.TENANT,
        tenantId: tenantA,
      });
    }
  });

  it('tags booking.create/update/remove made through REST with the caller tenant', async () => {
    const server = app.getHttpServer();
    const created = await request(server)
      .post('/bookings')
      .set('Cookie', cookieB)
      .send({
        customerId: customerB.id,
        propertyId: propertyB.id,
        serviceId: serviceB.id,
        scheduledAt: '2031-02-02T09:00:00.000Z',
      });
    expect(created.status).toBe(201);
    const id: string = created.body.id;

    expect(
      (
        await request(server)
          .patch(`/bookings/${id}`)
          .set('Cookie', cookieB)
          .send({ status: 'CANCELLED' })
      ).status,
    ).toBe(200);
    expect(
      (await request(server).delete(`/bookings/${id}`).set('Cookie', cookieB))
        .status,
    ).toBe(200);

    const events = await bookingEvents(id);
    expect(events.map((e) => e.action)).toEqual([
      'booking.create',
      'booking.update',
      'booking.remove',
    ]);
    for (const event of events) {
      expect(event).toMatchObject({
        actorId: ownerBId,
        scope: AdminScope.TENANT,
        tenantId: tenantB,
      });
    }
  });

  it('tags a tenant login with TENANT + its tenant, and a Super Admin login with PLATFORM + null', async () => {
    const tenantLogin = await auditEventRepository.findOneOrFail({
      order: { occurredAt: 'DESC' },
      where: { action: 'admin.login.succeeded', actorId: ownerAId },
    });
    expect(tenantLogin).toMatchObject({
      scope: AdminScope.TENANT,
      tenantId: tenantA,
    });

    const platformLogin = await auditEventRepository.findOneOrFail({
      order: { occurredAt: 'DESC' },
      where: { action: 'admin.login.succeeded', actorId: superAdminId },
    });
    expect(platformLogin).toMatchObject({
      scope: AdminScope.PLATFORM,
      tenantId: null,
    });
  });

  it('records a failed login with no actor, scope or tenant, and issues no session', async () => {
    const email = uniqueEmail('audit-tags-failed');
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: LOGIN_MUTATION,
        variables: { input: { email, password: 'wrong' } },
      });
    expect(response.headers['set-cookie']).toBeUndefined();

    const failed = await auditEventRepository
      .createQueryBuilder('e')
      .where('e.action = :action', { action: 'admin.login.failed' })
      .andWhere(`e.metadata->>'email' = :email`, { email })
      .getOneOrFail();
    expect(failed).toMatchObject({
      actorId: null,
      scope: null,
      tenantId: null,
    });
  });
```

`CREATE_BOOKING_MUTATION`, `UPDATE_BOOKING_MUTATION`, `REMOVE_BOOKING_MUTATION` and `LOGIN_MUTATION` are the same strings as in `bookings.tenant-isolation.e2e-spec.ts`. `superAdminId` is `seedSuperAdmin(...).id`, captured in `beforeAll`. If the REST `PATCH`/`DELETE` status codes differ from 200 in `booking.controller.ts`, assert the codes that `bookings.tenant-isolation.e2e-spec.ts` already asserts for successful REST calls. Do not change the controller.

The inconsistent-identity case is not covered over HTTP: the admin-user CHECKs make that row impossible to seed (see the M5 review 1 note). It is pinned in Task 2 at the service that issues the principal.

- [ ] **Step 2: Prove the suite discriminates.** Temporarily change `bookings.service.ts` `logAudit` to `...tenantAuditTags('00000000-0000-0000-0000-000000000000')`. Run `pnpm --filter api test:e2e -- tenant-audit-tags` ⇒ the two booking cases FAIL on the stored `tenantId`. Revert, and check with `git diff --stat` that only the new spec differs.

- [ ] **Step 3: Run** `pnpm --filter api test:e2e -- tenant-audit-tags` ⇒ PASS. Unit, `tsc` and lint ⇒ green.

- [ ] **Step 4: Commit**

```bash
git add apps/api/test/tenant-audit-tags.e2e-spec.ts
git commit -m "test(90): e2e audit tags for booking GraphQL/REST mutations and login"
```

### Task 4: Root-operation classification guard (RFC §4.2, §4.5; decision 7)

**Files:**
- Create: `apps/api/test/helpers/graphql-surface.ts`
- Create: `apps/api/test/root-operation-authorization.e2e-spec.ts`

**Interfaces:**
- Produces (Task 5 reuses `bootGraphqlSurface`):
  - `bootGraphqlSurface(): Promise<INestApplication>`
  - `collectRootHandlers(app: INestApplication): RootHandler[]`, where `RootHandler = { operation: RootOperation; field: string; owner: string; isLiveProvider: boolean; ownMethod: boolean; guards: unknown[]; roles: Role[] | undefined }` and `RootOperation = 'Query' | 'Mutation'`
  - `rootFields(app: INestApplication): { operation: RootOperation; field: string }[]`

**Why this metadata source (planning-time verification).** `TypeMetadataStorage.getQueriesMetadata()` / `getMutationsMetadata()` are what `@nestjs/graphql` 13 builds the schema from. After schema compile it "reassigns every handler declared on a base class to the resolver class that implements it" (`type-metadata.storage.d.ts`). The probe against `AppModule` confirmed this:
- 62 entries for 62 schema root fields;
- inherited nestjs-query handlers reported on the concrete class (`customers → CustomerReadResolver.queryMany`, `booking → BookingReadResolver.findById`);
- no duplicates;
- no entries outside the schema.

Nest's guard and roles consumers read metadata from `instance[methodName]` and `instance.constructor`. For the concrete class, `target.prototype[methodName]` resolves through the prototype chain to that same function object, so the suite inspects exactly what `AuthGuard` evaluates.

- [ ] **Step 1: Write the helper** — `test/helpers/graphql-surface.ts`:

```ts
import { INestApplication } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { GraphQLSchemaHost, TypeMetadataStorage } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { AppModule } from '../../src/app/app.module';
import { ROLES_KEY } from '../../src/platform/auth/decorators/roles.decorator';
import { Role } from '../../src/platform/auth/domain/role';

export type RootOperation = 'Query' | 'Mutation';

export interface RootHandler {
  operation: RootOperation;
  field: string;
  owner: string;
  isLiveProvider: boolean;
  ownMethod: boolean;
  guards: unknown[];
  roles: Role[] | undefined;
}

// Boots the real AppModule (as `paginated-collections-allowlist` does) plus
// Nest discovery, so guard suites read the live schema and the metadata
// `AuthGuard` evaluates — never a hand-copied inventory.
export async function bootGraphqlSurface(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule, DiscoveryModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return app;
}

export function rootFields(
  app: INestApplication,
): { operation: RootOperation; field: string }[] {
  const { schema } = app.get(GraphQLSchemaHost);
  return [
    ...Object.keys(schema.getQueryType()?.getFields() ?? {}).map((field) => ({
      field,
      operation: 'Query' as const,
    })),
    ...Object.keys(schema.getMutationType()?.getFields() ?? {}).map(
      (field) => ({ field, operation: 'Mutation' as const }),
    ),
  ];
}

// One entry per root handler in the metadata @nestjs/graphql builds the
// schema from (handlers already re-targeted to their concrete class). Guards
// are method + class (both run); roles are method-first, then class — the
// `Reflector.getAllAndOverride` precedence `AuthGuard` uses.
export function collectRootHandlers(app: INestApplication): RootHandler[] {
  const liveClasses = new Set<unknown>(
    app
      .get(DiscoveryService)
      .getProviders()
      .map((wrapper) => wrapper.instance as object | undefined)
      .filter((instance): instance is object => typeof instance === 'object' && instance !== null)
      .map((instance) => instance.constructor),
  );
  const entries = [
    ...TypeMetadataStorage.getQueriesMetadata().map((meta) => ({ meta, operation: 'Query' as const })),
    ...TypeMetadataStorage.getMutationsMetadata().map((meta) => ({ meta, operation: 'Mutation' as const })),
  ];
  return entries.map(({ meta, operation }) => {
    const target = meta.target as { name: string; prototype: Record<string, unknown> };
    const handler = target.prototype[meta.methodName];
    if (typeof handler !== 'function') {
      throw new Error(
        `${operation}.${meta.schemaName}: ${target.name}.${meta.methodName} is not a function`,
      );
    }
    return {
      field: meta.schemaName,
      guards: [
        ...((Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[] | undefined) ?? []),
        ...((Reflect.getMetadata(GUARDS_METADATA, target) as unknown[] | undefined) ?? []),
      ],
      isLiveProvider: liveClasses.has(target),
      operation,
      owner: `${target.name}.${meta.methodName}`,
      ownMethod: Object.prototype.hasOwnProperty.call(target.prototype, meta.methodName),
      roles:
        (Reflect.getMetadata(ROLES_KEY, handler) as Role[] | undefined) ??
        (Reflect.getMetadata(ROLES_KEY, target) as Role[] | undefined),
    };
  });
}
```

(Format with Prettier per lint; long lines are compacted here only.)

- [ ] **Step 2: Write the guard suite** — `test/root-operation-authorization.e2e-spec.ts`. The table is the explicit classification the review requires, keyed by `"<Operation>.<field>"`. It is verified in both directions against the live schema:

```ts
import { INestApplication } from '@nestjs/common';
import { Role } from '../src/platform/auth/domain/role';
import { AuthGuard } from '../src/platform/auth/guards/auth.guard';
import {
  bootGraphqlSurface,
  collectRootHandlers,
  RootHandler,
  rootFields,
} from './helpers/graphql-surface';

// Regression guard for the #90 sweep (decision 7; RFC §4.2/§4.5). Every
// root (operation, field) must be explicitly classified here; a new field
// fails until someone decides its class. This is a metadata check of
// root-operation authentication and roles. It does not prove runtime
// tenant isolation (the module two-tenant suites do) and does not cover
// relation-field RBAC (#106).
type RootClass = 'PUBLIC' | 'AUTHENTICATED' | 'TENANT';

const CLASSIFICATION: Record<string, RootClass> = {
  // Public (RFC §4.2: only login/logout)
  'Mutation.login': 'PUBLIC',
  'Mutation.logout': 'PUBLIC',
  // Authenticated, any role (Admin Foundation §4.9)
  'Query.currentAdmin': 'AUTHENTICATED',
  // Tenant business / tenant staff administration — queries (21)
  'Query.activePricing': 'TENANT',
  'Query.addOns': 'TENANT',
  'Query.admins': 'TENANT',
  'Query.booking': 'TENANT',
  'Query.bookings': 'TENANT',
  'Query.cleaner': 'TENANT',
  'Query.cleaners': 'TENANT',
  'Query.customer': 'TENANT',
  'Query.customerProperties': 'TENANT',
  'Query.customers': 'TENANT',
  'Query.invoice': 'TENANT',
  'Query.invoices': 'TENANT',
  'Query.job': 'TENANT',
  'Query.jobs': 'TENANT',
  'Query.laundryOrder': 'TENANT',
  'Query.laundryOrders': 'TENANT',
  'Query.property': 'TENANT',
  'Query.service': 'TENANT',
  'Query.services': 'TENANT',
  'Query.team': 'TENANT',
  'Query.teams': 'TENANT',
  // Tenant business / tenant staff administration — mutations (38)
  'Mutation.assignCleanerToTeam': 'TENANT',
  'Mutation.assignTeamToJob': 'TENANT',
  'Mutation.cancelLaundryOrder': 'TENANT',
  'Mutation.completeChecklistItem': 'TENANT',
  'Mutation.completeJob': 'TENANT',
  'Mutation.completeLaundryOrder': 'TENANT',
  'Mutation.createAddOn': 'TENANT',
  'Mutation.createAdmin': 'TENANT',
  'Mutation.createBooking': 'TENANT',
  'Mutation.createCleaner': 'TENANT',
  'Mutation.createCustomer': 'TENANT',
  'Mutation.createJobFromBooking': 'TENANT',
  'Mutation.createPricingRule': 'TENANT',
  'Mutation.createProperty': 'TENANT',
  'Mutation.createService': 'TENANT',
  'Mutation.createTeam': 'TENANT',
  'Mutation.disableAdmin': 'TENANT',
  'Mutation.generateInvoiceFromOrder': 'TENANT',
  'Mutation.markLaundryOrderAwaitingDelivery': 'TENANT',
  'Mutation.markLaundryOrderAwaitingPayment': 'TENANT',
  'Mutation.markLaundryOrderAwaitingPickup': 'TENANT',
  'Mutation.markLaundryOrderDamaged': 'TENANT',
  'Mutation.markLaundryOrderLost': 'TENANT',
  'Mutation.markLaundryOrderPaid': 'TENANT',
  'Mutation.markLaundryOrderReady': 'TENANT',
  'Mutation.priceLaundryOrder': 'TENANT',
  'Mutation.receiveLaundryOrder': 'TENANT',
  'Mutation.refundLaundryOrder': 'TENANT',
  'Mutation.rejectLaundryOrder': 'TENANT',
  'Mutation.removeBooking': 'TENANT',
  'Mutation.startLaundryProcessing': 'TENANT',
  'Mutation.updateAddOn': 'TENANT',
  'Mutation.updateBooking': 'TENANT',
  'Mutation.updateCleaner': 'TENANT',
  'Mutation.updateCustomer': 'TENANT',
  'Mutation.updateProperty': 'TENANT',
  'Mutation.updateService': 'TENANT',
  'Mutation.weighLaundryOrder': 'TENANT',
};

const TENANT_ROLES = new Set<Role>([
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
]);

const key = (operation: string, field: string) => `${operation}.${field}`;

describe('Root operation authorization (#90 sweep guard)', () => {
  let app: INestApplication;
  let schemaKeys: string[];
  let handlers: Map<string, RootHandler[]>;

  beforeAll(async () => {
    app = await bootGraphqlSurface();
    schemaKeys = rootFields(app).map(({ operation, field }) => key(operation, field));
    handlers = new Map();
    for (const handler of collectRootHandlers(app)) {
      const handlerKey = key(handler.operation, handler.field);
      handlers.set(handlerKey, [...(handlers.get(handlerKey) ?? []), handler]);
    }
  });

  afterAll(async () => {
    await app?.close();
  });

  it('classifies exactly the live schema root fields, per operation (no unclassified, no stale)', () => {
    expect(schemaKeys).toHaveLength(62);
    expect([...schemaKeys].sort()).toEqual(Object.keys(CLASSIFICATION).sort());
  });

  it('maps every root field to exactly one live handler of the same operation, and no handler to a missing field', () => {
    for (const schemaKey of schemaKeys) {
      expect({ schemaKey, handlers: handlers.get(schemaKey)?.length ?? 0 }).toEqual({
        schemaKey,
        handlers: 1,
      });
    }
    expect([...handlers.keys()].filter((handlerKey) => !schemaKeys.includes(handlerKey))).toEqual([]);
    for (const [handlerKey, [handler]] of handlers) {
      expect({ handlerKey, owner: handler.owner, isLiveProvider: handler.isLiveProvider }).toEqual({
        handlerKey,
        owner: handler.owner,
        isLiveProvider: true,
      });
    }
  });

  it('resolves both an inherited nestjs-query handler and an own decorated handler (pinned versions)', () => {
    const [generated] = handlers.get('Query.customers') ?? [];
    expect(generated).toMatchObject({ owner: 'CustomerReadResolver.queryMany', ownMethod: false });
    expect(generated.guards).toContain(AuthGuard);
    expect(generated.roles?.length).toBeGreaterThan(0);

    const [decorated] = handlers.get('Query.customer') ?? [];
    expect(decorated).toMatchObject({ owner: 'CustomerResolver.customer', ownMethod: true });
    expect(decorated.guards).toContain(AuthGuard);
    expect(decorated.roles?.length).toBeGreaterThan(0);
  });

  it('enforces each class: public, authenticated-only, tenant roles without SUPER_ADMIN', () => {
    for (const schemaKey of schemaKeys) {
      const [handler] = handlers.get(schemaKey) ?? [];
      expect({ schemaKey, hasHandler: handler !== undefined }).toEqual({
        schemaKey,
        hasHandler: true,
      });
      if (!handler) continue;
      const roles = handler.roles ?? [];
      const actual = {
        schemaKey,
        owner: handler.owner,
        hasAuthGuard: handler.guards.includes(AuthGuard),
        hasRoles: roles.length > 0,
        superAdmin: roles.includes(Role.SUPER_ADMIN),
        nonTenantRoles: roles.filter((role) => !TENANT_ROLES.has(role)),
      };
      const expected = {
        PUBLIC: { hasAuthGuard: false, hasRoles: false, superAdmin: false, nonTenantRoles: [] },
        AUTHENTICATED: { hasAuthGuard: true, hasRoles: false, superAdmin: false, nonTenantRoles: [] },
        TENANT: { hasAuthGuard: true, hasRoles: true, superAdmin: false, nonTenantRoles: [] },
      }[CLASSIFICATION[schemaKey]];
      expect(actual).toEqual({ schemaKey, owner: handler.owner, ...expected });
    }
  });
});
```

Every assertion carries `schemaKey`, and `owner` where relevant, so a failure names the offending operation. A missing handler fails the assertion; it does not crash with a `TypeError`.

- [ ] **Step 3: Run** `pnpm --filter api test:e2e -- root-operation-authorization` ⇒ PASS. The code is already correct, so this is a regression guard: it starts green and Step 4 proves it can fail.

- [ ] **Step 4: Prove each check fails, then revert each change.** Run the suite once per mutation and record which test fails:
  - (a) **Unclassified field:** add a throwaway `@Query(() => Boolean) probe90() { return true; }` with `@UseGuards(AuthGuard) @Roles(Role.TENANT_OWNER)` to `AdminResolver` ⇒ "classifies exactly…" FAILS.
  - (b) **Renamed / disappearing field:** give `AdminResolver.admins` `{ name: 'adminsRenamed' }` in its `@Query` options ⇒ "classifies exactly…" FAILS on both the stale `Query.admins` and the unclassified `Query.adminsRenamed`.
  - (c) **Super Admin added:** add `Role.SUPER_ADMIN` to `@Roles` on `AdminResolver.admins` ⇒ the class check FAILS for `Query.admins`.
  - (d) **Authorization metadata present but not applied:** remove `guards: [AuthGuard]` from `CustomerReadResolver`'s `ReadResolver` options while its `Roles(...)` decorator stays. `AuthGuard` evaluates `@Roles()`, so without it the roles are never applied. ⇒ the class check FAILS for `Query.customers` (`hasAuthGuard: false`), and so does the focused inherited-handler test.
  - (e) **Public operation gains roles:** add `@Roles(Role.TENANT_OWNER)` to `AdminResolver.logout` ⇒ the class check FAILS for `Mutation.logout`.

  After reverting all five, `git diff --stat` shows only the two new test files.

- [ ] **Step 5: Run** unit, `tsc` and lint ⇒ green. **Commit**

```bash
git add apps/api/test/helpers/graphql-surface.ts apps/api/test/root-operation-authorization.e2e-spec.ts
git commit -m "test(90): root-operation classification guard over live GraphQL resolver metadata"
```

### Task 5: Tenant read-surface, object-field and entity-coverage guard (RFC §4.4–§4.5; decisions 7–8)

**Files:**
- Create: `apps/api/test/tenant-read-authorizers.e2e-spec.ts`

**Interfaces:**
- Consumes: `bootGraphqlSurface` (Task 4).
- **Pinned-version implementation dependencies:**
  - **Deep import** `@ptc-org/nestjs-query-graphql/src/decorators` for `getRelations`. 9.5.0 has no `exports` map and no public accessor. A bump that adds an `exports` map fails module resolution, so the suite fails loudly, and the sentinel test below fails if the function stops returning relations.
  - **DI token convention** `` `${DTOClass.name}Authorizer` `` for nestjs-query authorizer providers.
  - **`TypeOrmQueryService`** from `@ptc-org/nestjs-query-typeorm`, to identify read resolvers by type.
  - **Class-level `RESOLVER_NAME_METADATA`**, which `@Resolver(() => DTO)` sets to the `ObjectType` name.
  - All four were confirmed by planning-time probes against `AppModule`:
    - 11 read resolvers, each with a resolvable DTO name (including relation-only `ChecklistReadResolver → Checklist`);
    - tenant authorizers return `{ tenantId: { eq } }`, and the three child-row types return `{}`;
    - every object-typed field is either a declared relation or one of the seven `CUSTOM_OBJECT_FIELDS`.

- [ ] **Step 1: Write the guard suite:**

```ts
import { INestApplication } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import {
  GraphQLSchemaHost,
  RESOLVER_NAME_METADATA,
  TypeMetadataStorage,
} from '@nestjs/graphql';
// Pinned-version dependency (9.5.0): no public accessor, no `exports` map.
import { getRelations } from '@ptc-org/nestjs-query-graphql/src/decorators';
import { TypeOrmQueryService } from '@ptc-org/nestjs-query-typeorm';
import { getNamedType, GraphQLObjectType, GraphQLSchema, isObjectType } from 'graphql';
import { DataSource, EntityMetadata } from 'typeorm';
import { bootGraphqlSurface } from './helpers/graphql-surface';

// Regression guard for the #90 sweep (decisions 7–8; RFC §4.5). Reads live
// GraphQL, nestjs-query, Nest discovery and TypeORM metadata. A metadata
// check of tenant *read filters* and inventory completeness; it does not
// prove runtime isolation (the module two-tenant suites do), relation-level
// RBAC (#106), or the scoping inside custom @Query handlers and loaders.

// `TypeMetadataStorage` types ObjectType targets as `Function`.
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type DtoClass = Function;

const CHILD_ROW_TYPES: Record<string, string> = {
  ChecklistItem:
    'No tenantId column; reachable only as Checklist.items, and Checklist is tenant-scoped.',
  InvoiceLine:
    'No tenantId column; reachable only as Invoice.lines, and Invoice is tenant-scoped.',
  LaundryOrderLine:
    'tenantId bound to its order by composite FK (#87); reachable only as LaundryOrder.lines, and LaundryOrder is tenant-scoped.',
};

const CUSTOM_SURFACE_ENTITIES: Record<string, string> = {
  AdminUserEntity:
    'Read only via the custom `admins` query; AdminsService lists by the principal tenant (#68).',
  PricingRuleEntity:
    'Read only via `activePricing` (query and Service.activePricing loader); PricingRulesService scopes by tenant (#84).',
  LaundryOrderLineEntity:
    'Child rows of LaundryOrder; read only via LaundryOrder.lines and LaundryOrdersService (#87).',
  AuditEventEntity: 'Not exposed through GraphQL.',
};

const CUSTOM_OBJECT_FIELDS: Record<string, string> = {
  'Service.activePricing':
    'ServiceResolver @ResolveField via request-scoped ActivePricingLoader keyed by the principal tenant (#84).',
  'Cleaner.team':
    'CleanerResolver @ResolveField via CleanerTeamLoaders keyed by the principal tenant (#83).',
  'CleaningJob.checklist':
    'JobResolver @ResolveField via JobRelationLoaders keyed by the principal tenant (#86).',
  'CleaningJob.team':
    'JobResolver @ResolveField via JobRelationLoaders keyed by the principal tenant (#86).',
  'Booking.pricingSnapshot': 'TypeORM embeddable stored on the booking row.',
  'LaundryOrderLine.pricingSnapshot': 'TypeORM embeddable stored on the line row.',
  'LoginResult.admin': "The caller's own principal, returned by login.",
};

const PROBE_TENANT = 'tenant-probe';
const READ_CONTEXT = {
  many: true,
  operationGroup: 'read',
  operationName: 'queryMany',
  readonly: true,
};

interface Authorizer {
  authorize(context: unknown, authorizationContext: unknown): Promise<unknown>;
}

interface ReadResolverRecord {
  resolver: string;
  dtoName: string | undefined;
  entity: EntityMetadata;
}

interface RelationRecord {
  parent: string;
  name: string;
  target: string | undefined;
}

describe('Tenant read surfaces (#90 sweep guard)', () => {
  let app: INestApplication;
  let schema: GraphQLSchema;
  const typesByName = new Map<string, DtoClass>();
  const readResolvers: ReadResolverRecord[] = [];
  const relations: RelationRecord[] = [];
  let tenantEntityNames: string[] = [];

  function relationsOf(target: DtoClass): { name: string; dto: DtoClass }[] {
    const declared = getRelations(target as never) as {
      one?: Record<string, { DTO: DtoClass }>;
      many?: Record<string, { DTO: DtoClass }>;
    };
    return [
      ...Object.entries(declared.one ?? {}),
      ...Object.entries(declared.many ?? {}),
    ].map(([name, relation]) => ({ name, dto: relation.DTO }));
  }

  function nameOf(target: DtoClass): string | undefined {
    return TypeMetadataStorage.getObjectTypesMetadata().find(
      (type) => type.target === target,
    )?.name;
  }

  function isConnection(type: GraphQLObjectType): boolean {
    return 'nodes' in type.getFields();
  }

  // Throws (failing the test) if nestjs-query registered no authorizer for
  // a surface: a missing provider is never treated as an exclusion.
  async function tenantScopeOf(name: string): Promise<{ name: string; tenantScoped: boolean }> {
    const target = typesByName.get(name);
    if (!target) throw new Error(`${name}: not a live ObjectType`);
    let authorizer: Authorizer;
    try {
      authorizer = app.get<Authorizer>(`${target.name}Authorizer`, { strict: false });
    } catch {
      throw new Error(`${name}: no nestjs-query authorizer provider (${target.name}Authorizer)`);
    }
    const tenant = await authorizer.authorize(
      { req: { user: { tenantId: PROBE_TENANT } } },
      READ_CONTEXT,
    );
    const none = await authorizer.authorize({ req: { user: undefined } }, READ_CONTEXT);
    return {
      name,
      tenantScoped:
        JSON.stringify(tenant) === JSON.stringify({ tenantId: { eq: PROBE_TENANT } }) &&
        JSON.stringify(none) === JSON.stringify({ id: { is: null } }),
    };
  }

  beforeAll(async () => {
    app = await bootGraphqlSurface();
    schema = app.get(GraphQLSchemaHost).schema;
    for (const meta of TypeMetadataStorage.getObjectTypesMetadata()) {
      const live = schema.getType(meta.name);
      if (isObjectType(live) && !isConnection(live)) {
        typesByName.set(meta.name, meta.target);
      }
    }
    for (const wrapper of app.get(DiscoveryService).getProviders()) {
      const instance = wrapper.instance as { service?: unknown } | undefined;
      if (!(instance?.service instanceof TypeOrmQueryService)) continue;
      const service = instance.service as TypeOrmQueryService<object>;
      readResolvers.push({
        dtoName: Reflect.getMetadata(RESOLVER_NAME_METADATA, instance.constructor) as
          | string
          | undefined,
        entity: service.repo.metadata,
        resolver: instance.constructor.name,
      });
    }
    for (const [parent, target] of typesByName) {
      for (const relation of relationsOf(target)) {
        relations.push({ name: relation.name, parent, target: nameOf(relation.dto) });
      }
    }
    tenantEntityNames = app
      .get(DataSource)
      .entityMetadatas.filter((entity) =>
        entity.columns.some((column) => column.propertyName === 'tenantId'),
      )
      .map((entity) => entity.name);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('inventories read resolvers, relations and tenant entities from live metadata (sentinels)', () => {
    expect(typeof getRelations).toBe('function');
    expect(readResolvers.map((r) => `${r.resolver}->${r.dtoName}`)).toEqual(
      expect.arrayContaining([
        'CustomerReadResolver->Customer',
        'ChecklistReadResolver->Checklist', // relation-only read resolver (no root query)
      ]),
    );
    expect(relations).toEqual(
      expect.arrayContaining([{ name: 'customer', parent: 'Invoice', target: 'Customer' }]),
    );
    expect(tenantEntityNames).toEqual(expect.arrayContaining(['CustomerEntity']));
  });

  it('resolves every read resolver to a live DTO type and a tenant-owned entity', () => {
    for (const record of readResolvers) {
      expect({
        resolver: record.resolver,
        dtoLive: record.dtoName !== undefined && typesByName.has(record.dtoName),
        entityHasTenantId: tenantEntityNames.includes(record.entity.name),
      }).toEqual({ resolver: record.resolver, dtoLive: true, entityHasTenantId: true });
    }
  });

  it('exposes every declared relation as a live schema field targeting a live type', () => {
    for (const relation of relations) {
      const parentType = schema.getType(relation.parent) as GraphQLObjectType;
      expect({
        relation: `${relation.parent}.${relation.name}`,
        exposed: relation.name in parentType.getFields(),
        targetLive: relation.target !== undefined && typesByName.has(relation.target),
      }).toEqual({
        relation: `${relation.parent}.${relation.name}`,
        exposed: true,
        targetLive: true,
      });
    }
  });

  it('accounts for every object-typed field: declared relation or allowlisted custom field', () => {
    const seen: string[] = [];
    for (const [typeName] of typesByName) {
      const liveType = schema.getType(typeName) as GraphQLObjectType;
      const declared = new Set(
        relations.filter((r) => r.parent === typeName).map((r) => r.name),
      );
      for (const [fieldName, field] of Object.entries(liveType.getFields())) {
        if (!isObjectType(getNamedType(field.type))) continue;
        const fieldKey = `${typeName}.${fieldName}`;
        seen.push(fieldKey);
        expect({
          fieldKey,
          recognized: declared.has(fieldName) || fieldKey in CUSTOM_OBJECT_FIELDS,
        }).toEqual({ fieldKey, recognized: true });
      }
    }
    for (const fieldKey of Object.keys(CUSTOM_OBJECT_FIELDS)) {
      const [typeName, fieldName] = fieldKey.split('.');
      expect({
        fieldKey,
        live: seen.includes(fieldKey),
        isDeclaredRelation: relations.some(
          (r) => r.parent === typeName && r.name === fieldName,
        ),
      }).toEqual({ fieldKey, live: true, isDeclaredRelation: false });
    }
  });

  it('tenant-scopes every read-resolver DTO and relation target (child rows excepted)', async () => {
    const surfaces = new Set<string>([
      ...readResolvers.map((r) => r.dtoName ?? '<unresolved>'),
      ...relations.map((r) => r.target ?? '<unresolved>'),
    ]);
    expect(surfaces.size).toBeGreaterThan(0);
    for (const name of surfaces) {
      if (name in CHILD_ROW_TYPES) continue;
      expect(await tenantScopeOf(name)).toEqual({ name, tenantScoped: true });
    }
  });

  it('never lets an unscoped type own a nestjs-query relation', async () => {
    const parents = new Set(relations.map((r) => r.parent));
    expect(parents.size).toBeGreaterThan(0);
    for (const name of parents) {
      expect(await tenantScopeOf(name)).toEqual({ name, tenantScoped: true });
    }
  });

  it('keeps the child-row allowlist narrow and live', () => {
    const readDtos = readResolvers.map((r) => r.dtoName);
    for (const name of Object.keys(CHILD_ROW_TYPES)) {
      expect({
        name,
        live: typesByName.has(name),
        ownRelations: relations.filter((r) => r.parent === name).length,
        isReadResolverDto: readDtos.includes(name),
        parentRelations: relations.filter((r) => r.target === name).length > 0,
      }).toEqual({
        name,
        live: true,
        ownRelations: 0,
        isReadResolverDto: false,
        parentRelations: true,
      });
    }
  });

  it('accounts for every tenant-owned entity (read resolver or allowlisted custom surface)', () => {
    const resolverEntities = new Set(readResolvers.map((r) => r.entity.name));
    for (const entity of tenantEntityNames) {
      expect({
        entity,
        covered: resolverEntities.has(entity) || entity in CUSTOM_SURFACE_ENTITIES,
      }).toEqual({ entity, covered: true });
    }
    for (const entity of Object.keys(CUSTOM_SURFACE_ENTITIES)) {
      expect({
        entity,
        tenantOwned: tenantEntityNames.includes(entity),
        servedByReadResolver: resolverEntities.has(entity),
      }).toEqual({ entity, tenantOwned: true, servedByReadResolver: false });
    }
  });
});
```

(Format with Prettier per lint. "Root connection node" from the review is subsumed: every root connection field is served by a read resolver, whose DTO is checked here.)

- [ ] **Step 2: Run** `pnpm --filter api test:e2e -- tenant-read-authorizers` ⇒ PASS (regression guard; starts green).

- [ ] **Step 3: Prove each check fails, then revert each change.** Run once per mutation:
  - (a) **Missing authorizer on a parent and read surface:** remove `@Authorize(tenantReadAuthorizer<TeamType>())` from `team.type.ts` ⇒ "tenant-scopes every read-resolver DTO…" and "never lets an unscoped type own a relation" FAIL for `Team`.
  - (b) **Unscoped relation target:** delete the `LaundryOrderLine` entry from `CHILD_ROW_TYPES` ⇒ "tenant-scopes every…" FAILS for `LaundryOrderLine`.
  - (c) **New unrecognized surface (an object field outside discovery):** add a throwaway `@ResolveField(() => TeamType, { nullable: true }) probeTeam() { return null; }` to `CleanerResolver` ⇒ "accounts for every object-typed field" FAILS for `Cleaner.probeTeam`.
  - (d) **Stale or disappearing inventory entries:** add `Ghost: 'x'` to `CHILD_ROW_TYPES` and `'Service.ghost': 'x'` to `CUSTOM_OBJECT_FIELDS` ⇒ "keeps the child-row allowlist…" and "accounts for every object-typed field" FAIL.
  - (e) **Tenant-owned entity on an unrecognized path:** delete `PricingRuleEntity` from `CUSTOM_SURFACE_ENTITIES` ⇒ "accounts for every tenant-owned entity" FAILS.
  - (f) **Unresolved read-resolver metadata:** change `@Resolver(() => ChecklistType)` on `ChecklistReadResolver` to `@Resolver()` ⇒ "resolves every read resolver to a live DTO" and the sentinel FAIL. If the app no longer boots with that change, record that boot failure as the observed failure instead.

  Revert all six; `git diff --stat` shows only the new spec.

- [ ] **Step 4: Run** unit, `tsc` and lint ⇒ green. **Commit**

```bash
git add apps/api/test/tenant-read-authorizers.e2e-spec.ts
git commit -m "test(90): tenant read-surface, object-field and tenant-entity coverage guard over live metadata"
```

### Task 6: Docs, tracking and full verification (decision 9)

**Files:**
- Modify: `docs/README.md` (sections #82, #83, #84, #85; new #90 section)
- Modify: `docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md` (**Tracking** cell only)
- Modify: this plan's Tracking row (PR link)

- [ ] **Step 1: Verify each stale note before changing it.** Each check must hold; if one does not, stop and report:

| README section | Note | Resolved by | Evidence to check |
| --- | --- | --- | --- |
| #82 | relation *filters* on Booking/Invoice/LaundryOrder not tenant-scoped "until #85/#87" | #85, #87 | `@Authorize(tenantReadAuthorizer…)` on `BookingDTO`, `InvoiceType`, `LaundryOrderType`; relation-filter cases in `bookings.tenant-isolation` / `laundry-billing.tenant-isolation` e2e |
| #83 | `Booking.team` filters and booking/job team FKs "until #85/#86" | #85, #86 | composite booking/job team FKs in `AddBookingTenant` / `AddJobChecklistTenant` migrations |
| #84 | laundry line service/add-on FKs id-only "until #87" | #87 | composite laundry-line FKs in `AddLaundryBillingTenant` |
| #85 | "Known interim gap (until #86)": unscoped jobs, `jobs(filter: { booking })` oracle, booking audit untagged "until #90" | #86, #90 | `CleaningJobType` authorizer; `jobs-checklists.tenant-isolation` e2e; Tasks 2–3 of this plan |

- [ ] **Step 2: Edit `docs/README.md`.** In each section above, replace the "Known interim gap" paragraph with one line: `**Interim gap resolved** by #… (see that slice below / its plan).` Keep the interim operating rule only where still true, and state it once, in the #90 section. Then add after the #85 section:

```markdown
## Tenant-aware audit & security sweep (#90)

Shipped in this slice (PR [#…](…)). Every audit event now records a scope that matches its principal. `AuditLogEvent` is a union of tenant (`TENANT` + tenant id), platform (`PLATFORM` + no tenant) and anonymous (no actor, scope or tenant; failed login only) events. The compiler checks that shape; the `tenantAuditTags` / `principalAuditTags` helpers validate the values at runtime, and the `ck_audit_event_scope_tenant` CHECK stays as the last safeguard. Booking create/update/remove events, through GraphQL and REST, are now tagged with the caller's tenant like every other module. A login whose stored scope and tenant disagree is refused instead of producing a session.

**No audit backfill.** The feature has not been published and there is no real production data (no releases or deployments exist), so events recorded before #90 are left as they are (no scope or tenant) and no migration rewrites audit history.

**Sweep result.** The planning-time sweep identified no additional tenant-filtering gap within the reviewed surfaces: services and query builders, loaders, REST `/bookings`, and every nestjs-query read resolver, relation and custom object field. Two guard suites now check that metadata on every run:
- every root query and mutation is classified (public, authenticated-only, or tenant with roles that exclude Super Admin);
- every nestjs-query read surface, object field and tenant-owned entity is tenant-scoped or explicitly allowlisted with a reason.

These suites are metadata checks that complement, not replace, the per-module two-tenant isolation tests.

**Open: relation-level role authorization ([#106](https://github.com/rexescario-dev/clensy-platform/issues/106)).** Relation fields are tenant-filtered, but their reads are not checked against the target type's read roles. For example, Finance can read a customer's fields through `invoice { customer }` although it cannot call `customers`. Treat relation-level role authorization as not enforced until #106 is resolved. The interim rule stands: do not provision a second production tenant before the #92 release gate passes.

- Spec (Accepted): [2026-09-23-multi-tenant-architecture-design.md](superpowers/specs/2026-09-23-multi-tenant-architecture-design.md)
- Plan (Accepted): [2026-10-01-tenant-aware-audit-security-sweep-plan.md](superpowers/plans/2026-10-01-tenant-aware-audit-security-sweep-plan.md)
```

- [ ] **Step 3: RFC Tracking cell only.** Insert `Tenant-Aware Audit & Security Sweep slice: [#90](…/issues/90) (PR [#…](…)).` after the #89 entry. Change `Remaining slices: [#90]…–[#92]` to `Remaining slices: [#91]…–[#92]`. Add `Relation-level RBAC policy: [#106](…/issues/106) (open).` Do not touch any other cell or section.

- [ ] **Step 4: Full verification.** `pnpm --filter api lint` (no diff), `pnpm --filter api exec tsc --noEmit`, `pnpm --filter api test`, `pnpm --filter api test:e2e` (only Task 0 baseline failures allowed), `pnpm --filter api build`. Also check that `git diff main --stat -- apps/api/src/schema.gql apps/api/src/platform/database/migrations apps/web packages` is empty (invariant 7; Global Constraints).

- [ ] **Step 5: Commit**

```bash
git add docs/README.md docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md docs/superpowers/plans/2026-10-01-tenant-aware-audit-security-sweep-plan.md
git commit -m "docs(90): document tenant-aware audit contract and sweep guards, keep relation RBAC open (#106), resolve stale interim notes"
```

---

## Traceability

| Task | RFC section(s) | Slice decision(s) | Audit invariants |
| --- | --- | --- | --- |
| 1 | §4.6, §3 (scope explicit) | 3, 4 | 2, 8 |
| 2 | §4.6, §4.5 (principal-only tenant), §5.1 | 3, 4, 5, 6 | 1–6 |
| 3 | §4.6, §4.5 (REST shares GraphQL rules) | 6 | 1–3, 6 |
| 4 | §4.2, §4.5, §5.10 | 7 | — |
| 5 | §4.4, §4.5, §5.7 | 7, 8 | — |
| 6 | Tracking only | 1, 2, 9 | 7 |

## Deferred / out of scope

- Relation-level RBAC policy and enforcement: [#106](https://github.com/rexescario-dev/clensy-platform/issues/106).
- REST `/bookings` cleanup: #91.
- Two-tenant release gate and lifting the single-production-tenant rule: #92.
- Audit backfill, any migration, and an FK from `audit_event_entity.tenantId` to `tenant` (decision 2; invariant 8). Any UI.
- Super Admin audit events beyond login (no Super Admin business APIs exist; RFC §10).

## Execution risks (operational only)

- **Pinned-version metadata dependencies in Tasks 4–5:**
  - the nestjs-query deep import;
  - the authorizer DI token convention;
  - `TypeOrmQueryService` identity;
  - `TypeMetadataStorage` handler re-targeting.

  A dependency bump that changes any of them makes the suites fail loudly, through module resolution, sentinels or exact-count assertions, rather than pass vacuously.
- **Prettier vs `@ts-expect-error`** (Task 2 Step 1): keep each rejected literal on one line.
- **Shared e2e database:** Task 3 uses fresh test tenants and deletes only its own audit rows (by actor ids and its unique failed-login email), matching the existing suites' isolation pattern under `maxWorkers: 1`.
