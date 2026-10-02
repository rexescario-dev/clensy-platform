# Two-Tenant Isolation Release Gate — Implementation Plan

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Kind** | Implementation plan (M4) for **one** delivery slice |
| **Date** | 2026-10-02 |
| **Tracking** | GitHub [#92](https://github.com/rexescario-dev/clensy-platform/issues/92) (program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81); depends on #89, #90, #91, all merged). One PR for this plan (to be Accepted at M5) and the implementation (process §2.8). Branch `feat/92-two-tenant-release-gate`. |
| **Package / repo** | `clensy-platform`: `apps/api/test` only (new `release-gate/` helpers, two extracted inventory helpers, one new e2e suite, two existing suites re-pointed at the extracted inventories), one `apps/api/package.json` script, and docs (README, RFC Tracking row). **No** `src/`, migration, `schema.gql`, `apps/web`, resolver, REST route or role-list changes. |
| **Depends on (Accepted)** | [Multi-Tenant Architecture](../specs/2026-09-23-multi-tenant-architecture-design.md) (Accepted, M3 2026-09-23): §4.2 (RBAC + tenant predicate both required; Super Admin not on tenant business resolvers; role failure is `Forbidden`), §4.3 (`OWNER` → `TENANT_OWNER` on every Accepted `@Roles()` list), §4.4 (same-tenant references), §4.5 (tenant from the principal only; filters cannot widen scope; cross-tenant reads and mutations behave as missing, never `403`; REST `/bookings` is a tenant surface), §4.6 (audit), §4.9 (worked examples), §5 invariants 1, 6, 7, 8, 10, 11. **Where this plan and that specification disagree, the specification wins**: stop and return to M2/M3. Role matrices are transcribed from the Accepted module specs cited per entry in Task 3. Relies on the shipped [Audit & Security Sweep plan](2026-10-01-tenant-aware-audit-security-sweep-plan.md) (#90: root-operation classification and `graphql-surface.ts`) and [Legacy REST & Surface Cleanup plan](2026-10-02-legacy-rest-surface-cleanup-plan.md) (#91: HTTP route classification and `http-surface.ts`). |

> **For agentic workers:** **M5 Accepted 2026-10-02** (developer review of the Draft, commit `568d025`). **Execution method:** **Native**, inline (superpowers:executing-plans) in the developer's session, with one fresh whole-branch review as the final gate. The Accept is plan acceptance only, not merge, push or PR authorization: implementation stays local through the final review. Steps use checkbox (`- [ ]`) syntax.
> - **M5 rulings:** the three planning refinements are Accepted: the never-existed control (decision 10), runtime phases not depending on Phase 1b (decision 11), and the own-row-count check for unfiltered lists (decision 10; the count query is read-only and scoped to the attacker's fixture tenant). The fixture code was not run at planning time: Task 4 validates the fixture assumptions first, fixing any misread field name against the entity and never dropping the field. After each of Tasks 5–11 the Phase 1b missing-key count must match the plan (56 → 47 → 39 → 29 → 23 → 3 → 0); an unexpected count is investigated, not worked around.
>
> **M6 (2026-10-02): complete.** Tasks 1–13 executed in order (commits `7cacd4f`..`eb773cc` plus the docs commit). Rulings:
> - The `tsc --noEmit` baseline on `main` is **1** error (`service-read.resolver.spec.ts`), not 2: #109 fixed `test/bookings.e2e-spec.ts`. The gate is "no errors beyond that 1".
> - `classifyRest` stringifies a non-string, non-array `message` with `JSON.stringify` (lint `no-base-to-string`).
> - Object keys in the new files follow `contextforge/record-key-order` (id keys first). The rule has no autofix, so they were reordered mechanically; order only.
> - Task 5 and Tasks 6–10 ended with Phase 1b red by design. The missing-key counts were exactly as planned (56, 47, 39, 29, 23, 3), and every other test passed. Task 11 made the gate fully green.
> - The README also states that the interim rule is lifted by the #92 merge with the gate passing, not by a local pass (decision 14; the plan's README block had left it out).
> - Fixture assumptions were validated: every planned entity field type-checked unchanged, and a gate run leaves no test tenant, gate customer or Super Admin behind.
>
> **Negative controls (Task 12):** each was a temporary edit, reverted (`git diff --quiet -- apps/api/src apps/api/test`).
>
> | Control | Edit | Failed at | First failure |
> | --- | --- | --- | --- |
> | 1 | `Query.gateCanary` added and classified TENANT | Phase 1a (1b also; 2–7 not run) | `[inventory] tenant surface vs role matrix: unexpected Query.gateCanary` |
> | 2 | `ANALYST` removed from customer `VIEW_ROLES` | Phase 2 (3–7 not run) | `[policy] Query.customers (CustomerReadResolver.queryMany): live @Roles … != pinned …` |
> | 3 | `getCustomer` without the tenant predicate | Phase 5, both directions | `[isolation] Query.customer "target id belongs to the other tenant" … expected null, got OK`, plus the never-existed mismatch. Also caught: `createBooking`, `receiveLaundryOrder` and `POST /bookings` customer references |
> | 4 | `CustomersService.update` writes before its scoped lookup | Phase 6 only (Phase 5 passed: the 404 matched the control) | `[integrity] victim tenant B: customer_entity changed during cross-tenant calls` |
>
> **Verification (2026-10-02):**
>
> | Check | Result |
> | --- | --- |
> | `pnpm --filter api test:e2e:release-gate` | 11/11 pass (~14 s) |
> | `pnpm --filter api test:e2e` | 43 suites, 419/419 pass |
> | `pnpm --filter api test` | 71 suites, 954/954 pass |
> | `pnpm --filter api lint` | clean, no diff |
> | `pnpm --filter api exec tsc --noEmit` | only the 1 baseline error |
> | `pnpm run build` / `lint` / `test` (workspace) | 7/7, 6/6, 9/9 tasks successful |
> | `git diff --quiet main -- apps/api/src` | unchanged (test-only slice) |
> - **Order and verification:** execute the tasks in order, test-first as written. Every task ends green on `pnpm --filter api lint` (lint must leave no diff) and the e2e suites it names. `pnpm --filter api exec tsc --noEmit` must report **no errors beyond the 2 present on `main`** (`src/modules/catalog/tests/graphql/service-read.resolver.spec.ts`, `test/bookings.e2e-spec.ts`; deferred in #90). Workspace `build`/`lint`/`test` and the full e2e run happen in Task 13.
> - **Stop conditions:** this slice is test-only. If the gate finds a real product defect (any `[policy]`, `[authentication]`, `[enforcement]`, `[isolation]` or `[integrity]` failure that is not a mistake in the gate itself), **stop and report it** with the failure output. Do not fix product code in this slice and do not weaken a probe to make it pass. No push or PR as a side effect.

**Goal:** Close #92. Add an executable, fail-closed release gate that proves, against a real Postgres and the real Nest app, that two tenants cannot read or mutate each other's data through any tenant GraphQL operation or REST route, and that operation-level role authorization holds. Merging this slice with the gate passing lifts the "do not provision a second production tenant" rule.

**Architecture:** One e2e suite, `apps/api/test/two-tenant-release-gate.e2e-spec.ts`, boots `AppModule` and runs ordered phases over **two independent inventories**: the *operation inventory* (live schema root fields / live controller routes, checked against #90's and #91's classifications, now extracted into shared helpers) and the *role matrix* (a pinned table of allowed roles per operation/route, transcribed from the Accepted specs). Every inventoried tenant operation/route has exactly one **probe** (a typed description of how to call it same-tenant, and which cross-tenant variants exist and what "missing" looks like for each). A **two-tenant world** of fresh tenants is inserted directly through TypeORM repositories (never through the API under test). A **typed outcome classifier** turns every response into exactly one outcome; anything it cannot classify is `UNEXPECTED` and fails. A **tenant snapshot** (every row of every table carrying `tenantId`, plus declared child tables) proves that a rejected cross-tenant call changed nothing.

**Tech Stack:** NestJS 11 (`@nestjs/core` `DiscoveryModule`, `@nestjs/graphql` `GraphQLSchemaHost`), TypeORM 0.3 + PostgreSQL, supertest, Jest e2e (`pnpm --filter api test:e2e`, `maxWorkers: 1`), pnpm workspace + Turborepo.

**Spec:** `docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md`

## Slice decisions (brainstorm 2026-10-02, developer-approved)

These are planning decisions for this slice. They add no product semantics beyond the RFC and the Accepted module specs.

1. **No new M2 specification.** The Accepted multi-tenant RFC governs #92; decisions are recorded here and reviewed at M5, as for #82–#91.
2. **Gate shape: inventory-driven, API level.** Browser/UI testing is out of the gate (the API is the security boundary, RFC §4.5/§4.8). The six module `*.tenant-isolation.e2e-spec.ts` suites stay unchanged; #92 is the cross-module gate, not their replacement.
3. **One inventory source.** #90's `CLASSIFICATION` and #91's `ROUTE_CLASSIFICATION` move, unchanged, into `test/helpers/root-operation-inventory.ts` and `test/helpers/http-route-inventory.ts`. #90's and #91's suites import them with no assertion change. The gate never keeps a second copy of the operation list.
4. **Two independent inventories, three failure classes.**

   | Failure | Phase | Message prefix | Meaning |
   | --- | --- | --- | --- |
   | An operation/route exists but has no matrix entry or no probe (or vice versa) | 1 | `[inventory]` | A new surface escaped the release gate |
   | Pinned matrix ≠ live `@Roles()` metadata | 2 | `[policy]` | Authorization policy drift |
   | Matrix = metadata, runtime result wrong | 3–6 | `[authentication]` / `[enforcement]` / `[isolation]` / `[integrity]` | Enforcement or isolation defect |

5. **Fail closed.** Any missing, extra, duplicate or unexpected entry in either inventory, the matrix or the probe registry fails the gate. Nothing is skipped.
6. **Pinned role matrix** (`test/release-gate/role-matrix.ts`): 7 roles × (59 GraphQL operations + 5 REST routes). Each of the 64 entries is explicit and cites its Accepted source section; `OWNER` reads as `TENANT_OWNER` (RFC §4.3); `SUPER_ADMIN` is never allowed (RFC §4.2). **REST entries are their own entries with their own citation**, never inherited from a GraphQL operation (#91 treats REST as its own surface). The matrix changes only deliberately, when an Accepted authorization spec changes. *Planning check (2026-10-02):* the transcribed matrix was compared with live metadata during planning and agrees on all 64 entries.
7. **Fixture model.** Two fresh test tenants (`createTestTenant`). Each gets one principal per tenant role (6: `TENANT_OWNER`, `OPS_MANAGER`, `SCHEDULER`, `CUSTOMER_SUPPORT`, `FINANCE`, `ANALYST`) and a full business world (customer, property, service + active pricing rule, add-on + pricing rule, team, cleaner on that team, booking, job with a 3-item checklist, laundry order, invoice with a line). **One** shared `SUPER_ADMIN` (`PLATFORM` scope, no tenant) is seeded separately and tested against every tenant operation and route. All rows are inserted with TypeORM repositories (`release-gate/two-tenant-world.ts`), not through the API under test. Cleanup: audit rows of every seeded principal, `removeTestTenants`, and the Super Admin row.
8. **Typed outcome contract** (`release-gate/outcome.ts`). Every call classifies to exactly one of `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `OK` (no error, value present: ids extracted), `NULL` (no error, field `null`), `ERROR` (a 4xx other than 401/403, with status and message) or `UNEXPECTED` (anything else: 5xx, GraphQL validation errors, several errors, partial data, inconsistent `code`/`status`). For GraphQL the status is `extensions.status ?? extensions.originalError.statusCode`, else derived from `extensions.code` (`UNAUTHENTICATED` → 401, `FORBIDDEN` → 403); a `code` and `status` that disagree are `UNEXPECTED`.
9. **Probe contract** (`release-gate/probe.ts`). Each probe declares: its key; an optional `prepare` (fresh, disposable target rows in a given tenant, so allowed calls can succeed and destructive calls never consume shared fixtures); its same-tenant call; its `ok` expectation (`returnsId`, `listIncludes` or `createdInOwnTenant`); an optional **declared** `domainRejected` (status + message pattern); its cross-tenant variants, each with a declared `MissingForm` (`null`, `error` 400/404, `emptyConnection`, `excludes`); or, when it has no tenant-owned input, an explicit `noCrossTenantInput` reason.
10. **Outcome rules per phase.**
    - Unauthenticated calls must be exactly `UNAUTHENTICATED`.
    - Denied roles (including `SUPER_ADMIN`) must be exactly `FORBIDDEN`.
    - Allowed roles must be `OK` meeting the probe's `ok` expectation, or the probe's declared `domainRejected`. An undeclared 4xx is a failure. `DOMAIN_REJECTED` is accepted **only** in the same-tenant role phase.
    - Cross-tenant calls accept **only** the variant's declared `MissingForm`. `FORBIDDEN`, any other `ERROR`, `UNEXPECTED`, or a successful response is a failure.
    - **Never-existed control** (planning refinement for M5): every cross-tenant variant except `excludes` is also called with the foreign id(s) replaced by fresh random UUIDs, by the same actor. Actual and control must normalize identically (outcome kind, status, message with UUIDs replaced by `<uuid>`, id count). This is RFC §4.5's "as if the resource does not exist" stated as a runtime check: another tenant's id must be indistinguishable from an id that never existed.
    - `excludes` (unfiltered lists): the result contains none of the victim's ids **and** its count (`totalCount`, or the array length) equals the attacker tenant's own row count in the database, so a foreign row cannot hide on a later page or in the count.
11. **Phase order** (each phase is one Jest test; a later phase does not run its checks when a phase it depends on failed, and fails with `not run: earlier gate phase(s) failed: …`):
    1. **Phase 1a — inventory vs classification vs matrix.** Live root fields = `ROOT_OPERATION_CLASSIFICATION` keys; live controller routes = `HTTP_ROUTE_CLASSIFICATION` keys; tenant-classified keys = matrix keys.
    2. **Phase 1b — probe completeness.** Probe keys are unique and equal the tenant-classified keys; `crossTenant` is non-empty exactly when `noCrossTenantInput` is absent.
    3. **Phase 2 — policy.** For every matrix entry: exactly one live handler/route, `AuthGuard` present, live roles (method first, then class) equal the pinned roles, `SUPER_ADMIN` absent.
    4. **Fixture check.** Both worlds populate every tenant-owned and child table (except the two declared lazily-written tables), and no undeclared child table exists.
    5. **Phase 3 — authentication** (no cookie).
    6. For attacker A / victim B: **Phase 4 — enforcement** (7 roles × 64 entries, tenant A data), **Phase 5 — isolation** (every allowed tenant-A role × every cross-tenant variant; targets prepared in both tenants first, then both tenants snapshotted, then the calls), **Phase 6 — integrity** (both tenants' snapshots byte-identical; zero new `audit_event_entity` rows whose actor is a tenant-A principal).
    7. **Phase 7 — symmetry:** Phases 4–6 again with B attacking A.

    Phases 3–7 depend on 1a, 2 and the fixture check, **not on 1b**: when a probe is missing, 1b fails (the gate is red) but the runtime phases still run for the probes that exist, so the report shows both the escaped surface and any runtime defect. (Refinement of the "each phase stops the run" wording, for M5 to confirm.)
12. **Audit follows the existing contract.** Today only `admin.login.failed` is audited on failure; every business action is audited on success only. So Phase 6 requires zero new audit rows by attacker principals during Phase 5 (all logins happen at setup), and the tenant snapshots include `audit_event_entity` rows of both tenants. #92 adds no audit policy.
13. **Not in CI.** The gate is on demand: `pnpm --filter api test:e2e:release-gate` (needs Postgres, as every e2e suite). It also runs inside `pnpm --filter api test:e2e`.
14. **Lifting the rule.** The rule is **not** lifted merely because the gate passes locally. It is lifted when the #92 PR **merges** with the release gate passing. This PR records that in the RFC Tracking row and the README. At closeout (after the developer merges) #81's body is updated and #92 closed with `gh`; #81 stays open while #106 is open, and closing #81 is asked first.
15. **"Program slices complete" ≠ "#106 resolved".** The docs say the program's delivery slices are complete and the interim rule is lifted, and separately that relation-level RBAC (#106) remains open and is **not** covered by this gate.
16. **Out of scope:** relation-field role checks (#106), browser/UI, CI wiring, query-count / SQL-shape checks (#109's domain), replacing module suites, product fixes.

## Global Constraints

- Test-only: no file under `apps/api/src/` changes in any commit of this slice (Task 12's negative controls are temporary local edits, reverted before any commit; `git diff --quiet -- apps/api/src` must hold at every commit).
- Inventory sizes on `main` (2026-10-02): 62 root fields = 21 tenant queries + 38 tenant mutations + `currentAdmin` (AUTHENTICATED) + `login`/`logout` (PUBLIC); 6 controller routes = 5 tenant REST routes + `GET /graphiql` (PUBLIC_DEV_ONLY).
- Role identifiers: `Role` from `apps/api/src/platform/auth/domain/role.ts`. Tenant roles: `TENANT_OWNER`, `OPS_MANAGER`, `SCHEDULER`, `CUSTOMER_SUPPORT`, `FINANCE`, `ANALYST`.
- Object keys in new test files sorted (repo lint rule `contextforge/record-key-order`); run `pnpm --filter api lint` and commit its autofixes with the task.
- Commit messages: Conventional Commits with `(92)` scope; **no `Co-Authored-By` trailer and no "Generated with Claude Code" line** (developer's global rule).
- The e2e database is the one in `apps/api/.env` (`DB_*`), shared and non-truncated: every fixture is unique per run and removed in `afterAll`.

## Review Focus

1. **A cross-tenant call answered with a different-but-plausible error** (e.g. `400 Property does not belong to the given customer` instead of `404 Customer … not found`) — would read as "isolated" to a lenient check. Pinned by the declared `MissingForm` plus the never-existed control (Task 5 `matchesMissing` + control comparison).
2. **A foreign row hidden beyond the first page or only visible in `totalCount`** — pinned by the `excludes` own-count check (Task 5).
3. **A cross-tenant mutation that writes, then throws 404** — response looks perfect. Pinned by Phase 6 snapshots (Task 5) and proven by negative control 4 (Task 12).
4. **A fixture world missing a table** (e.g. a new tenant-owned table added later) — snapshots would compare empty to empty. Pinned by the fixture check and undeclared-child detection (Task 4).
5. **Allowed calls failing for fixture reasons** (wrong state, shared row consumed by an earlier call) — would surface as false `[enforcement]` failures or tempt a lenient `domainRejected`. Pinned by per-call `prepare` of fresh targets (Tasks 6–11).

---

## File structure

| File | Responsibility |
| --- | --- |
| `apps/api/test/helpers/root-operation-inventory.ts` (new) | `ROOT_OPERATION_CLASSIFICATION` (moved from #90's suite), `rootOperationKey`, `tenantRootOperationKeys()` |
| `apps/api/test/helpers/http-route-inventory.ts` (new) | `HTTP_ROUTE_CLASSIFICATION` (moved from #91's suite), `tenantHttpRouteKeys()` |
| `apps/api/test/root-operation-authorization.e2e-spec.ts` (modify) | import the classification instead of declaring it |
| `apps/api/test/http-route-authorization.e2e-spec.ts` (modify) | import the classification instead of declaring it |
| `apps/api/test/release-gate/outcome.ts` (new) | outcome types, `classifyGraphql`, `classifyRest`, `normalizeOutcome`, `describeOutcome` |
| `apps/api/test/release-gate/outcome.e2e-spec.ts` (new) | classifier tests on synthetic responses (no DB) |
| `apps/api/test/release-gate/probe.ts` (new, Task 4) | `Call`, `Probe`, `CrossTenantVariant`, `MissingForm`, `OkExpectation`, `gqlCall`/`restCall` |
| `apps/api/test/release-gate/client.ts` (new) | `GateClient`: login, execute a `Call` → `Outcome` |
| `apps/api/test/release-gate/role-matrix.ts` (new) | `ROLE_MATRIX` (64 entries, cited), `ALL_ROLES`, `TENANT_ROLES` |
| `apps/api/test/release-gate/two-tenant-world.ts` (new) | `Fixtures` (repository inserts), `TenantWorld`, `GateWorld`, `buildGateWorld`, `destroyGateWorld` |
| `apps/api/test/release-gate/tenant-snapshot.ts` (new) | `discoverTenantTables`, `snapshotTenant`, `CHILD_TABLES`, `LAZILY_WRITTEN_TABLES` |
| `apps/api/test/release-gate/engine.ts` (new) | runtime phases 3–6 over a probe list |
| `apps/api/test/release-gate/probes/shapes.ts` (new) | probe factories: `getByIdProbe`, `connectionProbe` |
| `apps/api/test/release-gate/probes/{customers,catalog,cleaners,bookings,bookings-rest,jobs,laundry,billing,admins}.ts` (new) | one probe per tenant operation/route |
| `apps/api/test/release-gate/probes/index.ts` (new) | `PROBES` registry |
| `apps/api/test/two-tenant-release-gate.e2e-spec.ts` (new) | the gate: phases 1a–7 |
| `apps/api/package.json` (modify) | `test:e2e:release-gate` script |
| `README.md`, `docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md` (Tracking row only), this plan | docs |

---

### Task 1: Extract the shared inventories (RFC §4.5 traceability; decision 3)

Pure move. #90's and #91's assertions do not change.

**Files:**
- Create: `apps/api/test/helpers/root-operation-inventory.ts`
- Create: `apps/api/test/helpers/http-route-inventory.ts`
- Modify: `apps/api/test/root-operation-authorization.e2e-spec.ts` (lines 11–85: the `RootClass` type, comment and `CLASSIFICATION` table)
- Modify: `apps/api/test/http-route-authorization.e2e-spec.ts` (the `RouteClass` type and `ROUTE_CLASSIFICATION` table, lines 41–50)

**Interfaces:**
- Produces: `RootClass`, `ROOT_OPERATION_CLASSIFICATION: Readonly<Record<string, RootClass>>`, `rootOperationKey(operation: string, field: string): string`, `tenantRootOperationKeys(): string[]`; `RouteClass`, `HTTP_ROUTE_CLASSIFICATION: Readonly<Record<string, RouteClass>>`, `tenantHttpRouteKeys(): string[]`.

- [ ] **Step 1: Baseline the two suites**

Run: `pnpm --filter api test:e2e -- root-operation-authorization http-route-authorization`
Expected: PASS (both suites). Record the test counts.

- [ ] **Step 2: Create `apps/api/test/helpers/root-operation-inventory.ts`**

Move the comment block, `RootClass` and the full 62-entry table **verbatim** from `root-operation-authorization.e2e-spec.ts` (only the constant's name changes):

```ts
// Root-operation inventory shared by #90's metadata guard
// (`root-operation-authorization.e2e-spec.ts`) and #92's two-tenant release
// gate (decision 3: one inventory source). Every root (operation, field)
// must be classified here; a new field fails both suites until someone
// decides its class.
export type RootClass = 'AUTHENTICATED' | 'PUBLIC' | 'TENANT';

// PUBLIC: RFC §4.2 (only login/logout). AUTHENTICATED: any role
// (Admin Foundation §4.9). TENANT: tenant business and tenant staff
// administration — 21 queries and 38 mutations. Keys sorted (lint).
export const ROOT_OPERATION_CLASSIFICATION: Readonly<Record<string, RootClass>> = {
  // ← the 62 entries, copied unchanged from `CLASSIFICATION`
};

export function rootOperationKey(operation: string, field: string): string {
  return `${operation}.${field}`;
}

export function tenantRootOperationKeys(): string[] {
  return Object.entries(ROOT_OPERATION_CLASSIFICATION)
    .filter(([, rootClass]) => rootClass === 'TENANT')
    .map(([key]) => key)
    .sort();
}
```

- [ ] **Step 3: Create `apps/api/test/helpers/http-route-inventory.ts`**

```ts
// Controller-route inventory shared by #91's route guard
// (`http-route-authorization.e2e-spec.ts`) and #92's release gate
// (decision 3). Keys are `routeKey(method, path)` from `http-surface.ts`.
export type RouteClass = 'PUBLIC_DEV_ONLY' | 'TENANT_VIEW' | 'TENANT_WRITE';

export const HTTP_ROUTE_CLASSIFICATION: Readonly<Record<string, RouteClass>> = {
  'DELETE /bookings/:id': 'TENANT_WRITE',
  'GET /bookings': 'TENANT_VIEW',
  'GET /bookings/:id': 'TENANT_VIEW',
  'GET /graphiql': 'PUBLIC_DEV_ONLY',
  'PATCH /bookings/:id': 'TENANT_WRITE',
  'POST /bookings': 'TENANT_WRITE',
};

export function tenantHttpRouteKeys(): string[] {
  return Object.entries(HTTP_ROUTE_CLASSIFICATION)
    .filter(([, routeClass]) => routeClass !== 'PUBLIC_DEV_ONLY')
    .map(([key]) => key)
    .sort();
}
```

- [ ] **Step 4: Re-point #90's suite**

In `root-operation-authorization.e2e-spec.ts`: delete the local `RootClass`, its comment and `CLASSIFICATION`; delete the local `key` arrow function; add

```ts
import {
  ROOT_OPERATION_CLASSIFICATION as CLASSIFICATION,
  rootOperationKey as key,
} from './helpers/root-operation-inventory';
```

Keep the file's header comment, adding one sentence: `The classification lives in helpers/root-operation-inventory.ts, shared with #92's release gate.` No assertion changes.

- [ ] **Step 5: Re-point #91's suite**

In `http-route-authorization.e2e-spec.ts`: delete the local `RouteClass` and `ROUTE_CLASSIFICATION`; add

```ts
import { HTTP_ROUTE_CLASSIFICATION as ROUTE_CLASSIFICATION } from './helpers/http-route-inventory';
```

and, if the file references the `RouteClass` type, `import type { RouteClass } from './helpers/http-route-inventory';`. Add to the header comment: `The classification lives in helpers/http-route-inventory.ts, shared with #92's release gate.` No assertion changes.

- [ ] **Step 6: Verify unchanged behavior**

Run: `pnpm --filter api test:e2e -- root-operation-authorization http-route-authorization` → PASS with the same test counts as Step 1.
Run: `pnpm --filter api lint` → clean (commit any autofix).
Run: `git diff --quiet -- apps/api/src` → exit 0.

- [ ] **Step 7: Commit**

```bash
git add apps/api/test/helpers/root-operation-inventory.ts apps/api/test/helpers/http-route-inventory.ts apps/api/test/root-operation-authorization.e2e-spec.ts apps/api/test/http-route-authorization.e2e-spec.ts
git commit -m "test(92): extract the root-operation and HTTP route inventories into shared helpers"
```

---

### Task 2: Typed outcome classifier (decision 8)

**Files:**
- Create: `apps/api/test/release-gate/outcome.ts`
- Test: `apps/api/test/release-gate/outcome.e2e-spec.ts`

**Interfaces:**
- Produces (`outcome.ts`): `type Outcome`, `classifyGraphql(body: unknown, field: string): Outcome`, `classifyRest(status: number, body: unknown): Outcome`, `normalizeOutcome(outcome: Outcome): string`, `describeOutcome(outcome: Outcome): string`.

- [ ] **Step 1: Write the failing classifier tests** — `apps/api/test/release-gate/outcome.e2e-spec.ts`

```ts
import {
  classifyGraphql,
  classifyRest,
  normalizeOutcome,
} from './outcome';

// Pure tests of #92's outcome contract (decision 8). No app, no database.
describe('release-gate outcome classifier (#92)', () => {
  const uuid = '3f1c2a4e-9b7d-4c1a-8e2f-0a1b2c3d4e5f';

  it('classifies GraphQL authentication and role failures by status or code', () => {
    expect(
      classifyGraphql(
        { data: null, errors: [{ extensions: { code: 'UNAUTHENTICATED' }, message: 'Unauthorized' }] },
        'customers',
      ),
    ).toEqual({ kind: 'UNAUTHENTICATED' });
    expect(
      classifyGraphql(
        { data: null, errors: [{ extensions: { code: 'FORBIDDEN', originalError: { statusCode: 403 } }, message: 'Forbidden resource' }] },
        'customers',
      ),
    ).toEqual({ kind: 'FORBIDDEN' });
  });

  it('treats a code that disagrees with the status as UNEXPECTED', () => {
    expect(
      classifyGraphql(
        { data: null, errors: [{ extensions: { code: 'FORBIDDEN', status: 404 }, message: 'x' }] },
        'customer',
      ).kind,
    ).toBe('UNEXPECTED');
  });

  it('classifies a 4xx GraphQL error with its status and message', () => {
    expect(
      classifyGraphql(
        { data: null, errors: [{ extensions: { originalError: { statusCode: 404 } }, message: `Customer ${uuid} not found` }] },
        'updateCustomer',
      ),
    ).toEqual({ kind: 'ERROR', message: `Customer ${uuid} not found`, status: 404 });
  });

  it('treats 5xx, validation errors, several errors and partial data as UNEXPECTED', () => {
    const cases: unknown[] = [
      { data: null, errors: [{ extensions: { code: 'INTERNAL_SERVER_ERROR' }, message: 'boom' }] },
      { errors: [{ extensions: { code: 'GRAPHQL_VALIDATION_FAILED' }, message: 'Cannot query field' }] },
      { data: null, errors: [{ extensions: { status: 404 }, message: 'a' }, { extensions: { status: 404 }, message: 'b' }] },
      { data: { customer: { id: uuid } }, errors: [{ extensions: { status: 404 }, message: 'a' }] },
      { data: {} },
    ];
    for (const body of cases) {
      expect(classifyGraphql(body, 'customer').kind).toBe('UNEXPECTED');
    }
  });

  it('extracts ids from an object, a connection and an array; null is NULL', () => {
    expect(classifyGraphql({ data: { customer: { id: uuid } } }, 'customer')).toEqual({ ids: [uuid], kind: 'OK', totalCount: null });
    expect(classifyGraphql({ data: { customers: { nodes: [{ id: uuid }], totalCount: 1 } } }, 'customers')).toEqual({ ids: [uuid], kind: 'OK', totalCount: 1 });
    expect(classifyGraphql({ data: { admins: [{ id: uuid }] } }, 'admins')).toEqual({ ids: [uuid], kind: 'OK', totalCount: null });
    expect(classifyGraphql({ data: { customer: null } }, 'customer')).toEqual({ kind: 'NULL' });
  });

  it('classifies REST responses by status', () => {
    expect(classifyRest(401, {})).toEqual({ kind: 'UNAUTHENTICATED' });
    expect(classifyRest(403, {})).toEqual({ kind: 'FORBIDDEN' });
    expect(classifyRest(404, { message: `Booking ${uuid} not found` })).toEqual({ kind: 'ERROR', message: `Booking ${uuid} not found`, status: 404 });
    expect(classifyRest(200, [{ id: uuid }])).toEqual({ ids: [uuid], kind: 'OK', totalCount: null });
    expect(classifyRest(500, {}).kind).toBe('UNEXPECTED');
  });

  it('normalizes UUIDs so a foreign id and a never-existed id compare equal', () => {
    const foreign = classifyGraphql({ data: null, errors: [{ extensions: { status: 404 }, message: `Customer ${uuid} not found` }] }, 'x');
    const control = classifyGraphql({ data: null, errors: [{ extensions: { status: 404 }, message: 'Customer 00000000-0000-4000-8000-000000000000 not found' }] }, 'x');
    expect(normalizeOutcome(foreign)).toBe(normalizeOutcome(control));
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm --filter api test:e2e -- release-gate/outcome`
Expected: FAIL — `Cannot find module './outcome'`.

- [ ] **Step 3: Implement `apps/api/test/release-gate/outcome.ts`**

```ts
// #92 typed outcome contract (decision 8). Every gate call is classified
// into exactly one outcome; whatever this file cannot classify is
// UNEXPECTED and fails every phase. Phases interpret outcomes (decision 10):
// e.g. ERROR is "declared domain rejection" only in the role phase and a
// declared MISSING form only in the cross-tenant phase.
export type Outcome =
  | { ids: string[]; kind: 'OK'; totalCount: number | null }
  | { kind: 'ERROR'; message: string; status: number }
  | { kind: 'FORBIDDEN' }
  | { kind: 'NULL' }
  | { kind: 'UNAUTHENTICATED' }
  | { detail: string; kind: 'UNEXPECTED' };

interface GraphqlError {
  extensions?: {
    code?: string;
    originalError?: { statusCode?: number };
    status?: number;
  };
  message?: string;
}

const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

const STATUS_BY_CODE: Readonly<Record<string, number>> = {
  FORBIDDEN: 403,
  UNAUTHENTICATED: 401,
};

function unexpected(detail: string, body: unknown): Outcome {
  return {
    detail: `${detail}: ${JSON.stringify(body).slice(0, 500)}`,
    kind: 'UNEXPECTED',
  };
}

function okFrom(value: unknown, body: unknown): Outcome {
  const idOf = (node: unknown): string | null =>
    typeof node === 'object' &&
    node !== null &&
    typeof (node as { id?: unknown }).id === 'string'
      ? (node as { id: string }).id
      : null;
  const idsOf = (nodes: unknown[]): string[] | null => {
    const ids = nodes.map(idOf);
    return ids.every((id): id is string => id !== null) ? ids : null;
  };
  if (Array.isArray(value)) {
    const ids = idsOf(value);
    return ids ? { ids, kind: 'OK', totalCount: null } : unexpected('array without ids', body);
  }
  if (typeof value === 'object' && value !== null) {
    const { nodes, totalCount } = value as { nodes?: unknown; totalCount?: unknown };
    if (Array.isArray(nodes)) {
      const ids = idsOf(nodes);
      return ids && typeof totalCount === 'number'
        ? { ids, kind: 'OK', totalCount }
        : unexpected('connection without ids or totalCount', body);
    }
    const id = idOf(value);
    return id ? { ids: [id], kind: 'OK', totalCount: null } : unexpected('object without id', body);
  }
  return unexpected('scalar result', body);
}

function fromStatus(status: number, message: string, body: unknown): Outcome {
  if (status === 401) return { kind: 'UNAUTHENTICATED' };
  if (status === 403) return { kind: 'FORBIDDEN' };
  if (status >= 400 && status < 500) return { kind: 'ERROR', message, status };
  return unexpected(`status ${status}`, body);
}

export function classifyGraphql(body: unknown, field: string): Outcome {
  const { data, errors } = (body ?? {}) as {
    data?: Record<string, unknown> | null;
    errors?: GraphqlError[];
  };
  if (errors && errors.length > 0) {
    if (errors.length !== 1) return unexpected(`${errors.length} errors`, body);
    if (data && data[field] != null) return unexpected('error with partial data', body);
    const [error] = errors;
    const code = error.extensions?.code;
    const reported =
      error.extensions?.status ?? error.extensions?.originalError?.statusCode;
    const fromCode = code === undefined ? undefined : STATUS_BY_CODE[code];
    if (reported !== undefined && fromCode !== undefined && reported !== fromCode) {
      return unexpected(`code ${code} disagrees with status ${reported}`, body);
    }
    const status = reported ?? fromCode;
    if (status === undefined) return unexpected(`unclassified error (code ${code})`, body);
    return fromStatus(status, error.message ?? '', body);
  }
  if (!data || !(field in data)) return unexpected(`no data.${field}`, body);
  return data[field] === null ? { kind: 'NULL' } : okFrom(data[field], body);
}

export function classifyRest(status: number, body: unknown): Outcome {
  if (status >= 200 && status < 300) return okFrom(body, body);
  const raw = (body as { message?: unknown } | null)?.message;
  const message = Array.isArray(raw) ? raw.join('; ') : String(raw ?? '');
  return fromStatus(status, message, body);
}

export function normalizeOutcome(outcome: Outcome): string {
  switch (outcome.kind) {
    case 'ERROR':
      return `ERROR ${outcome.status} ${outcome.message.replace(UUID_PATTERN, '<uuid>')}`;
    case 'OK':
      return `OK ids=${outcome.ids.length} total=${outcome.totalCount}`;
    case 'UNEXPECTED':
      return `UNEXPECTED ${outcome.detail.replace(UUID_PATTERN, '<uuid>')}`;
    default:
      return outcome.kind;
  }
}

export function describeOutcome(outcome: Outcome): string {
  switch (outcome.kind) {
    case 'ERROR':
      return `ERROR ${outcome.status} "${outcome.message}"`;
    case 'OK':
      return `OK ids=[${outcome.ids.join(', ')}] totalCount=${outcome.totalCount}`;
    case 'UNEXPECTED':
      return `UNEXPECTED ${outcome.detail}`;
    default:
      return outcome.kind;
  }
}
```

- [ ] **Step 4: Run the classifier tests**

Run: `pnpm --filter api test:e2e -- release-gate/outcome` → PASS (7 tests).
Run: `pnpm --filter api lint` → clean (commit autofixes); `pnpm --filter api exec tsc --noEmit` → only the 2 baseline errors.

- [ ] **Step 5: Commit**

```bash
git add apps/api/test/release-gate/outcome.ts apps/api/test/release-gate/outcome.e2e-spec.ts
git commit -m "test(92): add the release gate's typed outcome classifier"
```

---

### Task 3: Pinned role matrix and the gate's inventory and policy phases (decisions 4–6, 11; RFC §4.2, §4.3)

**Files:**
- Create: `apps/api/test/release-gate/role-matrix.ts`
- Create: `apps/api/test/two-tenant-release-gate.e2e-spec.ts` (Phases 1a and 2 only in this task)
- Modify: `apps/api/package.json` (script)

**Interfaces:**
- Consumes: `ROOT_OPERATION_CLASSIFICATION`, `rootOperationKey`, `tenantRootOperationKeys` (Task 1); `HTTP_ROUTE_CLASSIFICATION`, `tenantHttpRouteKeys` (Task 1); `collectRootHandlers`, `rootFields` (`helpers/graphql-surface.ts`); `collectDeclaredRoutes`, `DeclaredRoute` (`helpers/http-surface.ts`).
- Produces: `RoleMatrixEntry { allowed: readonly Role[]; source: string }`, `ROLE_MATRIX: Readonly<Record<string, RoleMatrixEntry>>`, `TENANT_ROLES: readonly Role[]`, `ALL_ROLES: readonly Role[]`.

- [ ] **Step 1: Write the failing gate skeleton** — `apps/api/test/two-tenant-release-gate.e2e-spec.ts`

```ts
import { INestApplication } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { App } from 'supertest/types';
import { AppModule } from '../src/app/app.module';
import { Role } from '../src/platform/auth/domain/role';
import { AuthGuard } from '../src/platform/auth/guards/auth.guard';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import { collectRootHandlers, rootFields } from './helpers/graphql-surface';
import {
  HTTP_ROUTE_CLASSIFICATION,
  tenantHttpRouteKeys,
} from './helpers/http-route-inventory';
import { collectDeclaredRoutes } from './helpers/http-surface';
import {
  ROOT_OPERATION_CLASSIFICATION,
  rootOperationKey,
  tenantRootOperationKeys,
} from './helpers/root-operation-inventory';
import { ROLE_MATRIX } from './release-gate/role-matrix';

// #92 Two-Tenant Isolation Release Gate (RFC §4.2, §4.3, §4.5; plan
// decisions 4–12). The final multi-tenancy release criterion: merging #92
// with this suite passing lifts the "do not provision a second production
// tenant" rule. Run alone with `pnpm --filter api test:e2e:release-gate`.
//
// Failure prefixes: [inventory] a surface escaped the gate; [policy] the
// pinned role matrix drifted from live @Roles(); [authentication] /
// [enforcement] / [isolation] / [integrity] a runtime defect. Out of scope:
// relation-field RBAC (#106), UI, query counts.
describe('Two-tenant isolation release gate (#92)', () => {
  let app: INestApplication<App>;
  const passed = new Set<string>();

  function requirePassed(...phases: string[]): void {
    const missing = phases.filter((phase) => !passed.has(phase));
    if (missing.length > 0) {
      throw new Error(
        `not run: earlier gate phase(s) failed: ${missing.join(', ')}`,
      );
    }
  }

  function sameKeys(label: string, actual: string[], expected: string[]): string[] {
    const a = new Set(actual);
    const e = new Set(expected);
    return [
      ...[...a].filter((key) => !e.has(key)).map((key) => `[inventory] ${label}: unexpected ${key}`),
      ...[...e].filter((key) => !a.has(key)).map((key) => `[inventory] ${label}: missing ${key}`),
      ...(actual.length !== a.size ? [`[inventory] ${label}: duplicate keys`] : []),
    ];
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule, DiscoveryModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    applyPlatformPipes(app);
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('Phase 1a — inventory: live surfaces = classification; tenant classification = role matrix', () => {
    const liveRoot = rootFields(app).map(({ field, operation }) => rootOperationKey(operation, field));
    const liveRoutes = collectDeclaredRoutes(app).map((route) => route.key);
    const matrixKeys = Object.keys(ROLE_MATRIX);
    const failures = [
      ...sameKeys('live GraphQL root fields vs classification', liveRoot, Object.keys(ROOT_OPERATION_CLASSIFICATION)),
      ...sameKeys('live controller routes vs classification', liveRoutes, Object.keys(HTTP_ROUTE_CLASSIFICATION)),
      ...sameKeys('tenant surface vs role matrix', [...tenantRootOperationKeys(), ...tenantHttpRouteKeys()], matrixKeys),
    ];
    expect(failures).toEqual([]);
    expect(matrixKeys).toHaveLength(64);
    passed.add('1a');
  });

  it('Phase 2 — policy: pinned role matrix = live @Roles(); AuthGuard on all; SUPER_ADMIN nowhere', () => {
    requirePassed('1a');
    const handlers = collectRootHandlers(app);
    const routes = collectDeclaredRoutes(app);
    const failures: string[] = [];
    const sorted = (roles: readonly Role[] | undefined) => [...(roles ?? [])].sort();
    for (const [key, entry] of Object.entries(ROLE_MATRIX)) {
      if (entry.allowed.includes(Role.SUPER_ADMIN)) {
        failures.push(`[policy] ${key}: matrix allows SUPER_ADMIN`);
      }
      const graphqlMatches = handlers.filter((h) => rootOperationKey(h.operation, h.field) === key);
      const routeMatches = routes.filter((route) => route.key === key);
      const matches = [
        ...graphqlMatches.map((h) => ({ guards: h.guards, owner: h.owner, roles: h.roles })),
        ...routeMatches.map((r) => ({ guards: r.guards, owner: r.owner, roles: r.roles })),
      ];
      if (matches.length !== 1) {
        failures.push(`[policy] ${key}: expected exactly one live handler/route, found ${matches.length}`);
        continue;
      }
      const [live] = matches;
      if (!live.guards.includes(AuthGuard)) {
        failures.push(`[policy] ${key} (${live.owner}): AuthGuard missing`);
      }
      if (JSON.stringify(sorted(live.roles)) !== JSON.stringify(sorted(entry.allowed))) {
        failures.push(
          `[policy] ${key} (${live.owner}): live @Roles ${JSON.stringify(sorted(live.roles))} != pinned ${JSON.stringify(sorted(entry.allowed))} (${entry.source})`,
        );
      }
    }
    expect(failures).toEqual([]);
    passed.add('2');
  });
});
```

> If `DeclaredRoute` names its fields differently from `key`/`owner`/`guards`/`roles`, adapt only the property reads above to `helpers/http-surface.ts`'s `DeclaredRoute` (planning saw exactly those four, plus `declaredOn`).

- [ ] **Step 2: Add the script** — in `apps/api/package.json` `scripts`, after `"test:e2e"`:

```json
"test:e2e:release-gate": "jest --config ./test/jest-e2e.json two-tenant-release-gate",
```

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm --filter api test:e2e:release-gate`
Expected: FAIL — `Cannot find module './release-gate/role-matrix'`.

- [ ] **Step 4: Implement `apps/api/test/release-gate/role-matrix.ts`**

Transcribed from the Accepted specs, **not** from metadata. Each constant is one spec row; each matrix entry names its constant explicitly. REST constants are separate from GraphQL constants even where the role sets coincide.

```ts
import { Role } from '../../src/platform/auth/domain/role';

// #92 pinned role matrix (plan decision 6). The independent oracle for
// operation-level RBAC: transcribed from the Accepted specs, with OWNER
// read as TENANT_OWNER (RFC §4.3) and SUPER_ADMIN never allowed (RFC §4.2).
// Phase 2 compares it with live @Roles(); change it only when an Accepted
// authorization spec changes. Specs live in docs/superpowers/specs/.
export interface RoleMatrixEntry {
  allowed: readonly Role[];
  source: string;
}

export const TENANT_ROLES: readonly Role[] = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];

export const ALL_ROLES: readonly Role[] = [...TENANT_ROLES, Role.SUPER_ADMIN];

const { ANALYST, CUSTOMER_SUPPORT, FINANCE, OPS_MANAGER, SCHEDULER, TENANT_OWNER } = Role;
const RFC = 'RFC 2026-09-23 §4.3 (OWNER→TENANT_OWNER)';

const STAFF_ADMIN: RoleMatrixEntry = { allowed: [TENANT_OWNER], source: `Admin Foundation §4.5 "Staff account management"; ${RFC} staff lifecycle` };
const CUSTOMER_WRITE: RoleMatrixEntry = { allowed: [TENANT_OWNER, OPS_MANAGER, CUSTOMER_SUPPORT], source: `Customers & Properties §4.3 "Create / update customer"; ${RFC}` };
const PROPERTY_WRITE: RoleMatrixEntry = { allowed: [TENANT_OWNER, OPS_MANAGER, CUSTOMER_SUPPORT], source: `Customers & Properties §4.3 "Create / update property"; ${RFC}` };
const CUSTOMER_VIEW: RoleMatrixEntry = { allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT, ANALYST], source: `Customers & Properties §4.3 "View customer / property"; ${RFC}` };
const SERVICE_WRITE: RoleMatrixEntry = { allowed: [TENANT_OWNER, OPS_MANAGER], source: `Catalog §4.3 "Create / update service"; ${RFC}` };
const ADD_ON_WRITE: RoleMatrixEntry = { allowed: [TENANT_OWNER, OPS_MANAGER], source: `Catalog §4.3 "Create / update add-on"; ${RFC}` };
const PRICING_RULE_WRITE: RoleMatrixEntry = { allowed: [TENANT_OWNER, OPS_MANAGER], source: `Catalog §4.3 "Create pricing rule"; Laundry Catalog Foundation §4.5 (unchanged); ${RFC}` };
const CATALOG_VIEW: RoleMatrixEntry = { allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT, FINANCE, ANALYST], source: `Catalog §4.3 "View service / add-on / active pricing"; ${RFC}` };
const CLEANER_WRITE: RoleMatrixEntry = { allowed: [TENANT_OWNER, OPS_MANAGER], source: `Cleaners & Teams §4.3 "Create / update cleaner"; ${RFC}` };
const TEAM_WRITE: RoleMatrixEntry = { allowed: [TENANT_OWNER, OPS_MANAGER], source: `Cleaners & Teams §4.3 "Create team / assign cleaner to team"; ${RFC}` };
const WORKFORCE_VIEW: RoleMatrixEntry = { allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER, ANALYST], source: `Cleaners & Teams §4.3 "View cleaner / team"; ${RFC}` };
const BOOKING_WRITE: RoleMatrixEntry = { allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT], source: `Bookings §4.3 "Create / update / cancel / delete booking" (GraphQL); ${RFC}` };
const BOOKING_VIEW: RoleMatrixEntry = { allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT, FINANCE, ANALYST], source: `Bookings §4.3 "View booking" (GraphQL); ${RFC}` };
const JOB_CREATE: RoleMatrixEntry = { allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT], source: `Jobs & Checklists §4.3 "Create job from booking"; ${RFC}` };
const JOB_ASSIGN: RoleMatrixEntry = { allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER], source: `Jobs & Checklists §4.3 "Assign team to job"; ${RFC}` };
const JOB_EXECUTE: RoleMatrixEntry = { allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER], source: `Jobs & Checklists §4.3 "Complete checklist item / complete job"; ${RFC}` };
const JOB_VIEW: RoleMatrixEntry = { allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT, FINANCE, ANALYST], source: `Jobs & Checklists §4.3 "View job"; ${RFC}` };
const LAUNDRY_VIEW: RoleMatrixEntry = { allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT, FINANCE, ANALYST], source: `Laundry Orders & Lifecycle §4.4 (reads use VIEW_ROLES, M3 Accepted 2026-09-06); ${RFC}` };
const laundryVerb = (verb: string, allowed: readonly Role[]): RoleMatrixEntry => ({ allowed, source: `Laundry Orders & Lifecycle §4.4 verb table "${verb}" (M3 Accepted 2026-09-06); ${RFC}` });
const INVOICE_GENERATE: RoleMatrixEntry = { allowed: [TENANT_OWNER, FINANCE], source: `Laundry Invoices §4.7/§4.8 "FINANCE or OWNER"; ${RFC}` };
const INVOICE_VIEW: RoleMatrixEntry = { allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT, FINANCE, ANALYST], source: `Laundry Invoices §4.7 "VIEW roles"; ${RFC}` };
const REST_BOOKING_WRITE: RoleMatrixEntry = { allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT], source: 'REST: Booking tenant isolation plan #85 (Accepted) — BookingController per-route @Roles(...WRITE_ROLES); RFC §4.5 (REST is a tenant surface); #91 slice decision 1' };
const REST_BOOKING_VIEW: RoleMatrixEntry = { allowed: [TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT, FINANCE, ANALYST], source: 'REST: Booking tenant isolation plan #85 (Accepted) — BookingController per-route @Roles(...VIEW_ROLES); RFC §4.5; #91 slice decision 1' };

// Keys sorted (lint). 59 GraphQL + 5 REST = 64.
export const ROLE_MATRIX: Readonly<Record<string, RoleMatrixEntry>> = {
  'DELETE /bookings/:id': REST_BOOKING_WRITE,
  'GET /bookings': REST_BOOKING_VIEW,
  'GET /bookings/:id': REST_BOOKING_VIEW,
  'Mutation.assignCleanerToTeam': TEAM_WRITE,
  'Mutation.assignTeamToJob': JOB_ASSIGN,
  'Mutation.cancelLaundryOrder': laundryVerb('cancelLaundryOrder', [TENANT_OWNER, OPS_MANAGER, CUSTOMER_SUPPORT]),
  'Mutation.completeChecklistItem': JOB_EXECUTE,
  'Mutation.completeJob': JOB_EXECUTE,
  'Mutation.completeLaundryOrder': laundryVerb('completeLaundryOrder', [TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT]),
  'Mutation.createAddOn': ADD_ON_WRITE,
  'Mutation.createAdmin': STAFF_ADMIN,
  'Mutation.createBooking': BOOKING_WRITE,
  'Mutation.createCleaner': CLEANER_WRITE,
  'Mutation.createCustomer': CUSTOMER_WRITE,
  'Mutation.createJobFromBooking': JOB_CREATE,
  'Mutation.createPricingRule': PRICING_RULE_WRITE,
  'Mutation.createProperty': PROPERTY_WRITE,
  'Mutation.createService': SERVICE_WRITE,
  'Mutation.createTeam': TEAM_WRITE,
  'Mutation.disableAdmin': STAFF_ADMIN,
  'Mutation.generateInvoiceFromOrder': INVOICE_GENERATE,
  'Mutation.markLaundryOrderAwaitingDelivery': laundryVerb('markLaundryOrderAwaitingDelivery', [TENANT_OWNER, OPS_MANAGER, SCHEDULER]),
  'Mutation.markLaundryOrderAwaitingPayment': laundryVerb('markLaundryOrderAwaitingPayment', [TENANT_OWNER, OPS_MANAGER, FINANCE, CUSTOMER_SUPPORT]),
  'Mutation.markLaundryOrderAwaitingPickup': laundryVerb('markLaundryOrderAwaitingPickup', [TENANT_OWNER, OPS_MANAGER, SCHEDULER]),
  'Mutation.markLaundryOrderDamaged': laundryVerb('markLaundryOrderDamaged', [TENANT_OWNER, OPS_MANAGER]),
  'Mutation.markLaundryOrderLost': laundryVerb('markLaundryOrderLost', [TENANT_OWNER, OPS_MANAGER]),
  'Mutation.markLaundryOrderPaid': laundryVerb('markLaundryOrderPaid', [TENANT_OWNER, OPS_MANAGER, FINANCE, CUSTOMER_SUPPORT]),
  'Mutation.markLaundryOrderReady': laundryVerb('markLaundryOrderReady', [TENANT_OWNER, OPS_MANAGER, SCHEDULER]),
  'Mutation.priceLaundryOrder': laundryVerb('priceLaundryOrder', [TENANT_OWNER, OPS_MANAGER, SCHEDULER]),
  'Mutation.receiveLaundryOrder': laundryVerb('receiveLaundryOrder', [TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT]),
  'Mutation.refundLaundryOrder': laundryVerb('refundLaundryOrder', [TENANT_OWNER, OPS_MANAGER, FINANCE]),
  'Mutation.rejectLaundryOrder': laundryVerb('rejectLaundryOrder', [TENANT_OWNER, OPS_MANAGER]),
  'Mutation.removeBooking': BOOKING_WRITE,
  'Mutation.startLaundryProcessing': laundryVerb('startLaundryProcessing', [TENANT_OWNER, OPS_MANAGER, SCHEDULER]),
  'Mutation.updateAddOn': ADD_ON_WRITE,
  'Mutation.updateBooking': BOOKING_WRITE,
  'Mutation.updateCleaner': CLEANER_WRITE,
  'Mutation.updateCustomer': CUSTOMER_WRITE,
  'Mutation.updateProperty': PROPERTY_WRITE,
  'Mutation.updateService': SERVICE_WRITE,
  'Mutation.weighLaundryOrder': laundryVerb('weighLaundryOrder', [TENANT_OWNER, OPS_MANAGER, SCHEDULER]),
  'PATCH /bookings/:id': REST_BOOKING_WRITE,
  'POST /bookings': REST_BOOKING_WRITE,
  'Query.activePricing': CATALOG_VIEW,
  'Query.addOns': CATALOG_VIEW,
  'Query.admins': STAFF_ADMIN,
  'Query.booking': BOOKING_VIEW,
  'Query.bookings': BOOKING_VIEW,
  'Query.cleaner': WORKFORCE_VIEW,
  'Query.cleaners': WORKFORCE_VIEW,
  'Query.customer': CUSTOMER_VIEW,
  'Query.customerProperties': CUSTOMER_VIEW,
  'Query.customers': CUSTOMER_VIEW,
  'Query.invoice': INVOICE_VIEW,
  'Query.invoices': INVOICE_VIEW,
  'Query.job': JOB_VIEW,
  'Query.jobs': JOB_VIEW,
  'Query.laundryOrder': LAUNDRY_VIEW,
  'Query.laundryOrders': LAUNDRY_VIEW,
  'Query.property': CUSTOMER_VIEW,
  'Query.service': CATALOG_VIEW,
  'Query.services': CATALOG_VIEW,
  'Query.team': WORKFORCE_VIEW,
  'Query.teams': WORKFORCE_VIEW,
};
```

- [ ] **Step 5: Run the gate**

Run: `pnpm --filter api test:e2e:release-gate`
Expected: PASS — Phase 1a and Phase 2. If Phase 2 reports a `[policy]` difference, **stop** (decision 6 recorded agreement at planning time; a difference now is drift to report, not to edit away).

- [ ] **Step 6: Lint, type-check, commit**

Run: `pnpm --filter api lint` (commit autofixes); `pnpm --filter api exec tsc --noEmit` (only the 2 baseline errors).

```bash
git add apps/api/test/release-gate/role-matrix.ts apps/api/test/two-tenant-release-gate.e2e-spec.ts apps/api/package.json
git commit -m "test(92): pin the tenant role matrix and add the release gate's inventory and policy phases"
```

---

### Task 4: Probe contract, two-tenant world, tenant snapshot, and the fixture check (decisions 7, 9, 12; RFC §4.4)

**Files:**
- Create: `apps/api/test/release-gate/probe.ts`
- Create: `apps/api/test/release-gate/two-tenant-world.ts`
- Create: `apps/api/test/release-gate/tenant-snapshot.ts`
- Create: `apps/api/test/release-gate/client.ts`
- Modify: `apps/api/test/two-tenant-release-gate.e2e-spec.ts` (world in `beforeAll`/`afterAll`; fixture check)

**Interfaces:**
- Consumes: `createTestTenant`, `removeTestTenants`, `seedTenantAdmin`, `seedSuperAdmin`, `SeededAdmin` (`helpers/seed-tenant-admin.ts`); `Call` (Task 2); `classifyGraphql`, `classifyRest`, `Outcome` (Task 2); `TENANT_ROLES` (Task 3).
- Produces:
  - `probe.ts`: `Call`, `Prepared`, `ProbeArgs`, `VariantArgs`, `OkExpectation`, `MissingForm`, `CrossTenantVariant`, `Probe`, `gqlCall(field, document, variables)`, `restCall(method, path, body?)`
  - `class Fixtures { constructor(dataSource: DataSource, run: string); customer(tenantId): Promise<string>; property(tenantId, customerId): Promise<string>; service(tenantId, options?: { priced?: boolean }): Promise<{ pricingRuleId: string | null; serviceId: string }>; addOn(tenantId, options?: { priced?: boolean }): Promise<string>; team(tenantId): Promise<string>; cleaner(tenantId, teamId): Promise<string>; booking(world: TenantWorld): Promise<string>; job(world: TenantWorld, options: { itemsCompleted: boolean }): Promise<{ itemIds: string[]; jobId: string }>; laundryOrder(world: TenantWorld, status: LaundryOrderStatus, fulfillmentType?: LaundryFulfillmentType): Promise<string>; invoice(world: TenantWorld): Promise<string>; staffAdmin(tenantId): Promise<string> }`
  - `interface TenantWorld { addOnId; adminIds: string[]; bookingId; cleanerId; cookies: Readonly<Record<Role, string>>; customerId; invoiceId; jobId; jobItemIds: string[]; laundryOrderId; name: 'A' | 'B'; pricingRuleId; principals: Readonly<Record<Role, SeededAdmin>>; propertyId; serviceId; teamId; tenantId }` (all ids `string`)
  - `interface GateWorld { a: TenantWorld; b: TenantWorld; fixtures: Fixtures; run: string; superAdmin: SeededAdmin; superAdminCookie: string }`
  - `buildGateWorld(dataSource: DataSource, client: GateClient): Promise<GateWorld>`; `destroyGateWorld(dataSource: DataSource, world: GateWorld | undefined): Promise<void>`
  - `class GateClient { constructor(app: INestApplication<App>); login(email: string, password: string): Promise<string>; execute(cookie: string | null, call: Call): Promise<Outcome> }`
  - `interface TenantTables { children: readonly ChildTable[]; owned: readonly string[]; undeclaredChildren: readonly string[] }`, `discoverTenantTables(dataSource): Promise<TenantTables>`, `snapshotTenant(dataSource, tables: TenantTables, tenantId: string): Promise<TenantSnapshot>` where `TenantSnapshot = Record<string, string[]>`; `LAZILY_WRITTEN_TABLES: Readonly<Record<string, string>>`.

- [ ] **Step 1: Add the failing fixture check to the gate**

In the gate spec, add imports and state:

```ts
import { DataSource } from 'typeorm';
import { GateClient } from './release-gate/client';
import {
  discoverTenantTables,
  LAZILY_WRITTEN_TABLES,
  snapshotTenant,
  TenantTables,
} from './release-gate/tenant-snapshot';
import {
  buildGateWorld,
  destroyGateWorld,
  GateWorld,
} from './release-gate/two-tenant-world';
```

```ts
  let dataSource: DataSource;
  let client: GateClient;
  let world: GateWorld;
  let tables: TenantTables;
```

At the end of `beforeAll`:

```ts
    dataSource = moduleFixture.get(DataSource);
    client = new GateClient(app);
    world = await buildGateWorld(dataSource, client);
    tables = await discoverTenantTables(dataSource);
```

Replace `afterAll` with:

```ts
  afterAll(async () => {
    try {
      if (dataSource) await destroyGateWorld(dataSource, world);
    } finally {
      await app?.close();
    }
  });
```

Add after Phase 2:

```ts
  it('Fixture — both worlds populate every tenant-owned and child table; no undeclared child table', async () => {
    const failures = tables.undeclaredChildren.map(
      (table) => `[inventory] ${table} references a tenant-owned table but has no tenantId and is not declared in CHILD_TABLES`,
    );
    for (const tenant of [world.a, world.b]) {
      const snapshot = await snapshotTenant(dataSource, tables, tenant.tenantId);
      for (const [table, rows] of Object.entries(snapshot)) {
        if (rows.length === 0 && !(table in LAZILY_WRITTEN_TABLES)) {
          failures.push(`[inventory] tenant ${tenant.name}: fixture world has no ${table} row`);
        }
      }
    }
    expect(failures).toEqual([]);
    expect(tables.owned.length).toBeGreaterThanOrEqual(16);
    passed.add('fixture');
  });
```

Run: `pnpm --filter api test:e2e:release-gate` → FAIL (`Cannot find module './release-gate/client'`).

- [ ] **Step 2: Implement the probe contract** — `apps/api/test/release-gate/probe.ts`

```ts
import type { Fixtures, TenantWorld } from './two-tenant-world';

// #92 probe contract (decision 9). One probe per tenant GraphQL operation
// or REST route; the gate's Phase 1b requires probe keys to equal the
// tenant inventory exactly.
export type Call =
  | {
      document: string;
      field: string;
      kind: 'graphql';
      variables: Record<string, unknown>;
    }
  | {
      body?: Record<string, unknown>;
      kind: 'rest';
      method: 'DELETE' | 'GET' | 'PATCH' | 'POST';
      path: string;
    };

// Ids of rows a probe's `prepare` inserted for one call.
export type Prepared = Readonly<Record<string, string>>;

export interface ProbeArgs {
  own: TenantWorld;
  prepared: Prepared;
  unique: string;
}

// `foreign`: the victim ids for the actual call, or fresh random UUIDs
// (same length) for the never-existed control.
export interface VariantArgs extends ProbeArgs {
  foreign: readonly string[];
}

export type OkExpectation =
  | { id: (args: ProbeArgs) => string; kind: 'listIncludes' }
  | { id: (args: ProbeArgs) => string; kind: 'returnsId' }
  | { kind: 'createdInOwnTenant'; table: string };

export type MissingForm =
  | { kind: 'emptyConnection' }
  | { kind: 'error'; status: 400 | 404 }
  | { kind: 'excludes'; table: string }
  | { kind: 'null' };

export interface CrossTenantVariant {
  call: (args: VariantArgs) => Call;
  foreignIds: (victim: TenantWorld, preparedVictim: Prepared) => string[];
  missing: MissingForm;
  name: string;
}

export interface Probe {
  crossTenant: readonly CrossTenantVariant[];
  domainRejected?: { message: RegExp; status: number };
  key: string;
  noCrossTenantInput?: string;
  ok: OkExpectation;
  prepare?: (fixtures: Fixtures, tenant: TenantWorld) => Promise<Prepared>;
  sameTenant: (args: ProbeArgs) => Call;
}

export function gqlCall(
  field: string,
  document: string,
  variables: Record<string, unknown>,
): Call {
  return { document, field, kind: 'graphql', variables };
}

export function restCall(
  method: 'DELETE' | 'GET' | 'PATCH' | 'POST',
  path: string,
  body?: Record<string, unknown>,
): Call {
  return { body, kind: 'rest', method, path };
}
```

- [ ] **Step 3: Implement `apps/api/test/release-gate/client.ts`**

```ts
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { classifyGraphql, classifyRest, Outcome } from './outcome';
import type { Call } from './probe';

const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(loginInput: $input) { success }
  }
`;

// The only way the gate talks to the API: real HTTP through supertest,
// with the session cookie the login mutation sets (RFC §4.1 cookie JWT).
export class GateClient {
  constructor(private readonly app: INestApplication<App>) {}

  async login(email: string, password: string): Promise<string> {
    const response = await request(this.app.getHttpServer())
      .post('/graphql')
      .send({ query: LOGIN_MUTATION, variables: { input: { email, password } } });
    const setCookie = response.headers['set-cookie'] as unknown as string[] | undefined;
    if (!setCookie || setCookie.length === 0) {
      throw new Error(`gate login failed for ${email}: ${JSON.stringify(response.body)}`);
    }
    return setCookie[0].split(';')[0];
  }

  async execute(cookie: string | null, call: Call): Promise<Outcome> {
    const server = this.app.getHttpServer();
    if (call.kind === 'graphql') {
      let pending = request(server).post('/graphql');
      if (cookie) pending = pending.set('Cookie', cookie);
      const response = await pending.send({ query: call.document, variables: call.variables });
      return classifyGraphql(response.body, call.field);
    }
    const agent = request(server);
    let pending =
      call.method === 'GET' ? agent.get(call.path)
      : call.method === 'POST' ? agent.post(call.path)
      : call.method === 'PATCH' ? agent.patch(call.path)
      : agent.delete(call.path);
    if (cookie) pending = pending.set('Cookie', cookie);
    const response = call.body ? await pending.send(call.body) : await pending;
    return classifyRest(response.status, response.body);
  }
}
```

- [ ] **Step 4: Implement `apps/api/test/release-gate/tenant-snapshot.ts`**

```ts
import { DataSource } from 'typeorm';

// #92 tenant snapshot (decisions 7, 12). Every table with a "tenantId"
// column is discovered from the live schema (so a new tenant-owned table is
// covered automatically); tables without tenantId that reference one by FK
// must be declared as children here, or the fixture check fails closed.
export interface ChildTable {
  column: string;
  parent: string;
  table: string;
}

export const CHILD_TABLES: readonly ChildTable[] = [
  // Owned through its checklist (README: "items are owned through their checklist").
  { column: 'checklistId', parent: 'checklist_entity', table: 'checklist_item_entity' },
  // Owned through its invoice (README: "invoice lines are owned through their invoice").
  { column: 'invoiceId', parent: 'invoice_entity', table: 'invoice_line_entity' },
];

// Tables the repository-built world cannot populate; a row appearing in one
// is still caught by the snapshot comparison ([] vs [row]).
export const LAZILY_WRITTEN_TABLES: Readonly<Record<string, string>> = {
  audit_event_entity: 'written only by audited actions; the world is inserted directly',
  invoice_number_counter: 'created on the first generateInvoiceFromOrder for a tenant',
};

export interface TenantTables {
  children: readonly ChildTable[];
  owned: readonly string[];
  undeclaredChildren: readonly string[];
}

export type TenantSnapshot = Record<string, string[]>;

export async function discoverTenantTables(dataSource: DataSource): Promise<TenantTables> {
  const owned = (
    (await dataSource.query(
      `SELECT table_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'tenantId'
       ORDER BY table_name`,
    )) as { table_name: string }[]
  ).map((row) => row.table_name);
  const referencing = (await dataSource.query(
    `SELECT DISTINCT conrelid::regclass::text AS child, confrelid::regclass::text AS parent
     FROM pg_constraint
     WHERE contype = 'f'
       AND confrelid::regclass::text = ANY($1)
       AND NOT (conrelid::regclass::text = ANY($1))`,
    [owned],
  )) as { child: string; parent: string }[];
  const undeclaredChildren = referencing
    .filter(({ child, parent }) => !CHILD_TABLES.some((c) => c.table === child && c.parent === parent))
    .map(({ child, parent }) => `${child} → ${parent}`);
  return { children: CHILD_TABLES, owned, undeclaredChildren };
}

export async function snapshotTenant(
  dataSource: DataSource,
  tables: TenantTables,
  tenantId: string,
): Promise<TenantSnapshot> {
  const snapshot: TenantSnapshot = {};
  for (const table of tables.owned) {
    const rows = (await dataSource.query(
      `SELECT to_jsonb(t)::text AS row FROM "${table}" t WHERE t."tenantId"::text = $1 ORDER BY 1`,
      [tenantId],
    )) as { row: string }[];
    snapshot[table] = rows.map((r) => r.row);
  }
  for (const { column, parent, table } of tables.children) {
    const rows = (await dataSource.query(
      `SELECT to_jsonb(c)::text AS row FROM "${table}" c
       JOIN "${parent}" p ON c."${column}" = p.id
       WHERE p."tenantId"::text = $1 ORDER BY 1`,
      [tenantId],
    )) as { row: string }[];
    snapshot[table] = rows.map((r) => r.row);
  }
  return snapshot;
}
```

- [ ] **Step 5: Implement `apps/api/test/release-gate/two-tenant-world.ts`**

```ts
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { AdminUserEntity } from '../../src/modules/admins/infrastructure/persistence/admin-user.entity';
import { InvoicePaymentStatus } from '../../src/modules/billing/domain/invoice-payment-status';
import { InvoicePaymentTerms } from '../../src/modules/billing/domain/invoice-payment-terms';
import { InvoiceLineEntity } from '../../src/modules/billing/infrastructure/persistence/invoice-line.entity';
import { InvoiceEntity } from '../../src/modules/billing/infrastructure/persistence/invoice.entity';
import { BookingStatus } from '../../src/modules/bookings/domain/booking-status';
import { BookingEntity } from '../../src/modules/bookings/infrastructure/persistence/booking.entity';
import { PricingUnit } from '../../src/modules/catalog/domain/pricing-unit';
import { AddOnEntity } from '../../src/modules/catalog/infrastructure/persistence/add-on.entity';
import { PricingRuleEntity } from '../../src/modules/catalog/infrastructure/persistence/pricing-rule.entity';
import { ServiceEntity } from '../../src/modules/catalog/infrastructure/persistence/service.entity';
import { CleanerEntity } from '../../src/modules/cleaners/infrastructure/persistence/cleaner.entity';
import { TeamEntity } from '../../src/modules/cleaners/infrastructure/persistence/team.entity';
import { CustomerEntity } from '../../src/modules/customers/infrastructure/persistence/customer.entity';
import { PropertyEntity } from '../../src/modules/customers/infrastructure/persistence/property.entity';
import { JobStatus } from '../../src/modules/jobs/domain/job-status';
import { ChecklistItemEntity } from '../../src/modules/jobs/infrastructure/persistence/checklist-item.entity';
import { ChecklistEntity } from '../../src/modules/jobs/infrastructure/persistence/checklist.entity';
import { CleaningJobEntity } from '../../src/modules/jobs/infrastructure/persistence/cleaning-job.entity';
import { LaundryFulfillmentType } from '../../src/modules/laundry/domain/laundry-fulfillment-type';
import { LaundryOrderStatus } from '../../src/modules/laundry/domain/laundry-order-status';
import { LaundryOrderLineEntity } from '../../src/modules/laundry/infrastructure/persistence/laundry-order-line.entity';
import { LaundryOrderEntity } from '../../src/modules/laundry/infrastructure/persistence/laundry-order.entity';
import { Role } from '../../src/platform/auth/domain/role';
import {
  createTestTenant,
  removeTestTenants,
  SeededAdmin,
  seedSuperAdmin,
  seedTenantAdmin,
} from '../helpers/seed-tenant-admin';
import type { GateClient } from './client';
import { TENANT_ROLES } from './role-matrix';

// #92 two-tenant world (decision 7). Every row is inserted with TypeORM
// repositories — never through the GraphQL/REST surface under test — so the
// gate's setup cannot depend on the code it checks. `Fixtures` is also what
// probes' `prepare` hooks use to create fresh, disposable targets.
const PAST = new Date('2020-01-01T00:00:00.000Z');
const UNPRICED = new Set([LaundryOrderStatus.RECEIVED, LaundryOrderStatus.WEIGHED]);

export interface TenantWorld {
  addOnId: string;
  adminIds: string[];
  bookingId: string;
  cleanerId: string;
  cookies: Readonly<Record<Role, string>>;
  customerId: string;
  invoiceId: string;
  jobId: string;
  jobItemIds: string[];
  laundryOrderId: string;
  name: 'A' | 'B';
  pricingRuleId: string;
  principals: Readonly<Record<Role, SeededAdmin>>;
  propertyId: string;
  serviceId: string;
  teamId: string;
  tenantId: string;
}

export interface GateWorld {
  a: TenantWorld;
  b: TenantWorld;
  fixtures: Fixtures;
  run: string;
  superAdmin: SeededAdmin;
  superAdminCookie: string;
}

export class Fixtures {
  private sequence = 0;

  constructor(
    private readonly dataSource: DataSource,
    private readonly run: string,
  ) {}

  private label(): string {
    this.sequence += 1;
    return `${this.run}-${this.sequence}`;
  }

  private future(): Date {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  async customer(tenantId: string): Promise<string> {
    const repository = this.dataSource.getRepository(CustomerEntity);
    const label = this.label();
    const row = await repository.save(
      repository.create({ email: `gate-${label}@example.com`, fullName: `Gate Customer ${label}`, notes: null, phone: '555-0100', tenantId }),
    );
    return row.id;
  }

  async property(tenantId: string, customerId: string): Promise<string> {
    const repository = this.dataSource.getRepository(PropertyEntity);
    const row = await repository.save(
      repository.create({ accessNotes: null, addressLine1: '1 Gate Street', addressLine2: null, city: 'Gate City', customerId, label: `Gate Property ${this.label()}`, postalCode: '00000', region: 'GC', tenantId }),
    );
    return row.id;
  }

  async service(tenantId: string, options: { priced?: boolean } = {}): Promise<{ pricingRuleId: string | null; serviceId: string }> {
    const services = this.dataSource.getRepository(ServiceEntity);
    const service = await services.save(
      services.create({ active: true, description: null, durationMinutes: 60, name: `Gate Service ${this.label()}`, tenantId }),
    );
    if (options.priced === false) return { pricingRuleId: null, serviceId: service.id };
    const rules = this.dataSource.getRepository(PricingRuleEntity);
    const rule = await rules.save(
      rules.create({ active: true, addOnId: null, effectiveFrom: PAST, effectiveTo: null, minimumChargeMinorUnits: null, priceMinorUnits: 1000, serviceId: service.id, tenantId, unit: PricingUnit.PER_KG }),
    );
    return { pricingRuleId: rule.id, serviceId: service.id };
  }

  async addOn(tenantId: string, options: { priced?: boolean } = {}): Promise<string> {
    const addOns = this.dataSource.getRepository(AddOnEntity);
    const addOn = await addOns.save(
      addOns.create({ active: true, description: null, name: `Gate Add-on ${this.label()}`, priceMinorUnits: 300, tenantId }),
    );
    if (options.priced !== false) {
      const rules = this.dataSource.getRepository(PricingRuleEntity);
      await rules.save(
        rules.create({ active: true, addOnId: addOn.id, effectiveFrom: PAST, effectiveTo: null, minimumChargeMinorUnits: null, priceMinorUnits: 300, serviceId: null, tenantId, unit: PricingUnit.FLAT }),
      );
    }
    return addOn.id;
  }

  async team(tenantId: string): Promise<string> {
    const repository = this.dataSource.getRepository(TeamEntity);
    return (await repository.save(repository.create({ name: `Gate Team ${this.label()}`, tenantId }))).id;
  }

  async cleaner(tenantId: string, teamId: string): Promise<string> {
    const repository = this.dataSource.getRepository(CleanerEntity);
    const label = this.label();
    const row = await repository.save(
      repository.create({ email: `gate-cleaner-${label}@example.com`, fullName: `Gate Cleaner ${label}`, notes: null, phone: '555-0101', teamId, tenantId }),
    );
    return row.id;
  }

  async booking(world: TenantWorld): Promise<string> {
    const repository = this.dataSource.getRepository(BookingEntity);
    const row = await repository.save(
      repository.create({
        customerId: world.customerId,
        pricingSnapshot: { priceMinorUnits: 1000 },
        propertyId: world.propertyId,
        scheduledAt: this.future(),
        serviceId: world.serviceId,
        status: BookingStatus.PENDING,
        teamId: world.teamId,
        tenantId: world.tenantId,
      }),
    );
    return row.id;
  }

  async job(world: TenantWorld, options: { itemsCompleted: boolean }): Promise<{ itemIds: string[]; jobId: string }> {
    const bookingId = await this.booking(world);
    const jobs = this.dataSource.getRepository(CleaningJobEntity);
    const job = await jobs.save(
      jobs.create({ bookingId, scheduledAt: this.future(), status: JobStatus.PENDING, teamId: world.teamId, tenantId: world.tenantId }),
    );
    const checklists = this.dataSource.getRepository(ChecklistEntity);
    const checklist = await checklists.save(checklists.create({ jobId: job.id, tenantId: world.tenantId }));
    const items = this.dataSource.getRepository(ChecklistItemEntity);
    const itemIds: string[] = [];
    for (const position of [1, 2, 3]) {
      const item = await items.save(
        items.create({ checklistId: checklist.id, completed: options.itemsCompleted, completedAt: options.itemsCompleted ? new Date() : null, label: `Gate item ${position}`, position }),
      );
      itemIds.push(item.id);
    }
    return { itemIds, jobId: job.id };
  }

  async laundryOrder(world: TenantWorld, status: LaundryOrderStatus, fulfillmentType: LaundryFulfillmentType = LaundryFulfillmentType.PICKUP): Promise<string> {
    const priced = !UNPRICED.has(status);
    const orders = this.dataSource.getRepository(LaundryOrderEntity);
    const order = await orders.save(
      orders.create({
        customerId: world.customerId,
        fulfillmentType,
        status,
        tenantId: world.tenantId,
        totalMinorUnits: priced ? 2000 : null,
        weightGrams: status === LaundryOrderStatus.RECEIVED ? null : 2000,
      }),
    );
    if (priced) {
      const lines = this.dataSource.getRepository(LaundryOrderLineEntity);
      await lines.save(
        lines.create({
          addOnId: null,
          laundryOrderId: order.id,
          pricingSnapshot: { amountMinorUnits: 2000, minimumChargeApplied: false, minimumChargeMinorUnits: null, pricingRuleId: world.pricingRuleId, quantity: 2, rateMinorUnits: 1000, unit: PricingUnit.PER_KG },
          serviceId: world.serviceId,
          tenantId: world.tenantId,
        }),
      );
    }
    return order.id;
  }

  async invoice(world: TenantWorld): Promise<string> {
    const laundryOrderId = await this.laundryOrder(world, LaundryOrderStatus.PRICED);
    const invoices = this.dataSource.getRepository(InvoiceEntity);
    const invoice = await invoices.save(
      invoices.create({
        amountPaidMinorUnits: 0,
        customerId: world.customerId,
        discountMinorUnits: 0,
        dueDate: null,
        invoiceNumber: `GATE-${this.label()}`,
        issueDate: new Date(),
        laundryOrderId,
        paymentStatus: InvoicePaymentStatus.UNPAID,
        paymentTerms: InvoicePaymentTerms.PAY_NOW,
        subtotalMinorUnits: 2000,
        tenantId: world.tenantId,
        totalMinorUnits: 2000,
      }),
    );
    const lines = this.dataSource.getRepository(InvoiceLineEntity);
    await lines.save(
      lines.create({ amountMinorUnits: 2000, description: 'Gate line', invoiceId: invoice.id, quantity: 2, rateMinorUnits: 1000, unit: PricingUnit.PER_KG }),
    );
    return invoice.id;
  }

  async staffAdmin(tenantId: string): Promise<string> {
    return (await seedTenantAdmin(this.dataSource, Role.SCHEDULER, tenantId)).id;
  }
}

async function buildTenantWorld(
  name: 'A' | 'B',
  dataSource: DataSource,
  fixtures: Fixtures,
  client: GateClient,
): Promise<TenantWorld> {
  const tenantId = await createTestTenant(dataSource);
  const principals = {} as Record<Role, SeededAdmin>;
  const cookies = {} as Record<Role, string>;
  for (const role of TENANT_ROLES) {
    principals[role] = await seedTenantAdmin(dataSource, role as Exclude<Role, Role.SUPER_ADMIN>, tenantId);
    cookies[role] = await client.login(principals[role].email, principals[role].password);
  }
  const customerId = await fixtures.customer(tenantId);
  const propertyId = await fixtures.property(tenantId, customerId);
  const { pricingRuleId, serviceId } = await fixtures.service(tenantId);
  const addOnId = await fixtures.addOn(tenantId);
  const teamId = await fixtures.team(tenantId);
  const cleanerId = await fixtures.cleaner(tenantId, teamId);
  const partial = {
    addOnId, adminIds: Object.values(principals).map((p) => p.id), bookingId: '', cleanerId, cookies, customerId,
    invoiceId: '', jobId: '', jobItemIds: [] as string[], laundryOrderId: '', name, pricingRuleId: pricingRuleId as string,
    principals, propertyId, serviceId, teamId, tenantId,
  };
  partial.bookingId = await fixtures.booking(partial);
  const job = await fixtures.job(partial, { itemsCompleted: false });
  partial.jobId = job.jobId;
  partial.jobItemIds = job.itemIds;
  partial.laundryOrderId = await fixtures.laundryOrder(partial, LaundryOrderStatus.RECEIVED);
  partial.invoiceId = await fixtures.invoice(partial);
  return partial;
}

export async function buildGateWorld(dataSource: DataSource, client: GateClient): Promise<GateWorld> {
  const run = randomUUID();
  const fixtures = new Fixtures(dataSource, run);
  const a = await buildTenantWorld('A', dataSource, fixtures, client);
  const b = await buildTenantWorld('B', dataSource, fixtures, client);
  const superAdmin = await seedSuperAdmin(dataSource);
  const superAdminCookie = await client.login(superAdmin.email, superAdmin.password);
  return { a, b, fixtures, run, superAdmin, superAdminCookie };
}

// Audit rows of every seeded principal (logins, role-phase writes), then
// both tenants (removeTestTenants deletes admins created by createAdmin
// probes with them), then the Super Admin.
export async function destroyGateWorld(dataSource: DataSource, world: GateWorld | undefined): Promise<void> {
  if (!world) return;
  const actorIds = [...world.a.adminIds, ...world.b.adminIds, world.superAdmin.id];
  const tenantIds = [world.a.tenantId, world.b.tenantId];
  await dataSource.query(
    `DELETE FROM "audit_event_entity" WHERE "actorId" = ANY($1) OR "tenantId" = ANY($2)`,
    [actorIds, tenantIds],
  );
  await removeTestTenants(dataSource, tenantIds);
  await dataSource.getRepository(AdminUserEntity).delete({ id: world.superAdmin.id });
}
```

> A `create(...)` call that TypeScript rejects because an entity field is named differently means the planning read of that entity was wrong: fix the field name to the entity, never drop the field. Entities were read at planning time from `apps/api/src/modules/*/infrastructure/persistence/*.entity.ts`.

- [ ] **Step 6: Run the gate**

Run: `pnpm --filter api test:e2e:release-gate`
Expected: PASS — Phase 1a, Phase 2, Fixture. The fixture test must list no `[inventory]` failure. If it reports an undeclared child table, **stop** (a tenant-owned table the RFC inventory does not know about is a design question).

- [ ] **Step 7: Lint, type-check, commit**

Run: `pnpm --filter api lint`; `pnpm --filter api exec tsc --noEmit` → only the 2 baseline errors.

```bash
git add apps/api/test/release-gate/probe.ts apps/api/test/release-gate/client.ts apps/api/test/release-gate/tenant-snapshot.ts apps/api/test/release-gate/two-tenant-world.ts apps/api/test/two-tenant-release-gate.e2e-spec.ts
git commit -m "test(92): add the probe contract, two-tenant world and tenant snapshots for the release gate"
```

---

### Task 5: Runtime engine, probe registry, Phases 1b and 3–7, and the Customers & Properties probes (RFC §4.2, §4.5, §4.9; decisions 9–12)

The engine and the first module's probes land together so the engine is tested by real probes. After this task Phase 1b is **red by design** (51 tenant keys still lack probes), while Phases 3–7 run and pass for the 8 Customers & Properties probes (decision 11). Tasks 6–11 shrink the 1b list to zero.

**Files:**
- Create: `apps/api/test/release-gate/engine.ts`
- Create: `apps/api/test/release-gate/probes/shapes.ts`
- Create: `apps/api/test/release-gate/probes/customers.ts`
- Create: `apps/api/test/release-gate/probes/index.ts`
- Modify: `apps/api/test/two-tenant-release-gate.e2e-spec.ts`

**Interfaces:**
- Consumes: Tasks 2–4 (`probe.ts` from Task 4).
- Produces: `PROBES: readonly Probe[]`; `getByIdProbe({ field, id, key, missing }): Probe`; `connectionProbe({ field, filterType, id, key, table }): Probe`; engine functions `runAuthenticationPhase(ctx)`, `runRolePhase(ctx, actor)`, `prepareCrossTenant(ctx, attacker, victim)`, `runCrossTenantPhase(ctx, attacker, victim, tasks)`, `attackerAuditCount(ctx, attacker)`, all returning `Promise<string[]>` failures except `prepareCrossTenant` (`Promise<CrossTenantTask[]>`) and `attackerAuditCount` (`Promise<number>`); `interface GateContext { client: GateClient; dataSource: DataSource; probes: readonly Probe[]; world: GateWorld }`.

- [ ] **Step 1: Write the probe factories** — `apps/api/test/release-gate/probes/shapes.ts`

```ts
import { gqlCall, MissingForm, Probe } from '../probe';
import type { TenantWorld } from '../two-tenant-world';

// get-by-id: one target variant (RFC §4.9 example 1).
export function getByIdProbe(options: {
  field: string;
  id: (tenant: TenantWorld) => string;
  key: string;
  missing: MissingForm;
}): Probe {
  const document = `query Gate($id: ID!) { ${options.field}(id: $id) { id } }`;
  return {
    crossTenant: [
      {
        call: ({ foreign }) => gqlCall(options.field, document, { id: foreign[0] }),
        foreignIds: (victim) => [options.id(victim)],
        missing: options.missing,
        name: 'target id belongs to the other tenant',
      },
    ],
    key: options.key,
    ok: { id: ({ own }) => options.id(own), kind: 'returnsId' },
    sameTenant: ({ own }) => gqlCall(options.field, document, { id: options.id(own) }),
  };
}

// nestjs-query connection: a filter that names the other tenant's id must
// return nothing, and an unfiltered list must exclude it and count only
// own-tenant rows (RFC §4.5 "filters MUST NOT widen"; §4.9 example 2).
export function connectionProbe(options: {
  field: string;
  filterType: string;
  id: (tenant: TenantWorld) => string;
  key: string;
  table: string;
}): Probe {
  const document = `query Gate($filter: ${options.filterType}!) {
    ${options.field}(filter: $filter, paging: { limit: 100 }, sorting: []) { totalCount nodes { id } }
  }`;
  return {
    crossTenant: [
      {
        call: ({ foreign }) => gqlCall(options.field, document, { filter: { id: { in: foreign } } }),
        foreignIds: (victim) => [options.id(victim)],
        missing: { kind: 'emptyConnection' },
        name: 'filter asserts the other tenant’s id',
      },
      {
        call: () => gqlCall(options.field, document, { filter: {} }),
        foreignIds: (victim) => [options.id(victim)],
        missing: { kind: 'excludes', table: options.table },
        name: 'unfiltered list',
      },
    ],
    key: options.key,
    ok: { id: ({ own }) => options.id(own), kind: 'listIncludes' },
    sameTenant: ({ own }) => gqlCall(options.field, document, { filter: { id: { in: [options.id(own)] } } }),
  };
}
```

- [ ] **Step 2: Write the Customers & Properties probes** — `apps/api/test/release-gate/probes/customers.ts`

```ts
import { gqlCall, Probe } from '../probe';
import { connectionProbe, getByIdProbe } from './shapes';

const NO_TENANT_INPUT =
  'input carries no tenant-owned id; the tenant comes only from the principal (RFC §4.5), pinned by createdInOwnTenant';

const UPDATE_CUSTOMER = `mutation Gate($id: ID!, $input: UpdateCustomerInput!) { updateCustomer(id: $id, input: $input) { id } }`;
const CREATE_PROPERTY = `mutation Gate($customerId: ID!, $input: CreatePropertyInput!) { createProperty(customerId: $customerId, input: $input) { id } }`;
const UPDATE_PROPERTY = `mutation Gate($id: ID!, $input: UpdatePropertyInput!) { updateProperty(id: $id, input: $input) { id } }`;
const CUSTOMER_PROPERTIES = `query Gate($customerId: ID!) { customerProperties(customerId: $customerId) { totalCount nodes { id } } }`;

const propertyInput = (unique: string) => ({
  addressLine1: '2 Gate Street', city: 'Gate City', label: `Gate Property ${unique}`, postalCode: '00000', region: 'GC',
});

export const CUSTOMER_PROBES: readonly Probe[] = [
  getByIdProbe({ field: 'customer', id: (t) => t.customerId, key: 'Query.customer', missing: { kind: 'null' } }),
  connectionProbe({ field: 'customers', filterType: 'CustomerFilter', id: (t) => t.customerId, key: 'Query.customers', table: 'customer_entity' }),
  getByIdProbe({ field: 'property', id: (t) => t.propertyId, key: 'Query.property', missing: { kind: 'null' } }),
  {
    crossTenant: [
      {
        call: ({ foreign }) => gqlCall('customerProperties', CUSTOMER_PROPERTIES, { customerId: foreign[0] }),
        foreignIds: (victim) => [victim.customerId],
        missing: { kind: 'emptyConnection' },
        name: 'customerId belongs to the other tenant',
      },
    ],
    key: 'Query.customerProperties',
    ok: { id: ({ own }) => own.propertyId, kind: 'listIncludes' },
    sameTenant: ({ own }) => gqlCall('customerProperties', CUSTOMER_PROPERTIES, { customerId: own.customerId }),
  },
  {
    crossTenant: [],
    key: 'Mutation.createCustomer',
    noCrossTenantInput: NO_TENANT_INPUT,
    ok: { kind: 'createdInOwnTenant', table: 'customer_entity' },
    sameTenant: ({ unique }) =>
      gqlCall('createCustomer', `mutation Gate($input: CreateCustomerInput!) { createCustomer(input: $input) { id } }`, {
        input: { email: `gate-new-${unique}@example.com`, fullName: `Gate New ${unique}`, phone: '555-0102' },
      }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign, unique }) => gqlCall('updateCustomer', UPDATE_CUSTOMER, { id: foreign[0], input: { notes: `gate ${unique}` } }),
        foreignIds: (victim) => [victim.customerId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
    ],
    key: 'Mutation.updateCustomer',
    ok: { id: ({ own }) => own.customerId, kind: 'returnsId' },
    sameTenant: ({ own, unique }) => gqlCall('updateCustomer', UPDATE_CUSTOMER, { id: own.customerId, input: { notes: `gate ${unique}` } }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign, unique }) => gqlCall('createProperty', CREATE_PROPERTY, { customerId: foreign[0], input: propertyInput(unique) }),
        foreignIds: (victim) => [victim.customerId],
        missing: { kind: 'error', status: 404 },
        name: 'reference customerId belongs to the other tenant',
      },
    ],
    key: 'Mutation.createProperty',
    ok: { kind: 'createdInOwnTenant', table: 'property_entity' },
    sameTenant: ({ own, unique }) => gqlCall('createProperty', CREATE_PROPERTY, { customerId: own.customerId, input: propertyInput(unique) }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign, unique }) => gqlCall('updateProperty', UPDATE_PROPERTY, { id: foreign[0], input: { accessNotes: `gate ${unique}` } }),
        foreignIds: (victim) => [victim.propertyId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
    ],
    key: 'Mutation.updateProperty',
    ok: { id: ({ own }) => own.propertyId, kind: 'returnsId' },
    sameTenant: ({ own, unique }) => gqlCall('updateProperty', UPDATE_PROPERTY, { id: own.propertyId, input: { accessNotes: `gate ${unique}` } }),
  },
];
```

- [ ] **Step 3: Create the registry** — `apps/api/test/release-gate/probes/index.ts`

```ts
import type { Probe } from '../probe';
import { CUSTOMER_PROBES } from './customers';

// Exactly one probe per tenant GraphQL operation and REST route (Phase 1b).
export const PROBES: readonly Probe[] = [...CUSTOMER_PROBES];
```

- [ ] **Step 4: Add the failing runtime phases to the gate**

Imports:

```ts
import {
  attackerAuditCount,
  CrossTenantTask,
  GateContext,
  prepareCrossTenant,
  runAuthenticationPhase,
  runCrossTenantPhase,
  runRolePhase,
} from './release-gate/engine';
import { PROBES } from './release-gate/probes';
import { TenantSnapshot } from './release-gate/tenant-snapshot';
import { TenantWorld } from './release-gate/two-tenant-world';
```

After the Fixture test:

```ts
  it('Phase 1b — inventory: exactly one probe per tenant operation and route', () => {
    const keys = PROBES.map((probe) => probe.key);
    const failures = [
      ...sameKeys('probes vs tenant surface', keys, [...tenantRootOperationKeys(), ...tenantHttpRouteKeys()]),
      ...PROBES.filter((p) => (p.crossTenant.length === 0) !== (p.noCrossTenantInput !== undefined)).map(
        (p) => `[inventory] ${p.key}: needs cross-tenant variants or a noCrossTenantInput reason (exactly one)`,
      ),
    ];
    expect(failures).toEqual([]);
    passed.add('1b');
  });

  const context = (): GateContext => ({ client, dataSource, probes: PROBES, world });

  it('Phase 3 — authentication: every tenant operation and route rejects a missing session', async () => {
    requirePassed('1a', '2', 'fixture');
    expect(await runAuthenticationPhase(context())).toEqual([]);
    passed.add('3');
  }, 600_000);

  for (const [label, attackerOf, victimOf, step] of [
    ['A attacks B', (w: GateWorld) => w.a, (w: GateWorld) => w.b, 'AB'],
    ['Phase 7 — symmetry: B attacks A', (w: GateWorld) => w.b, (w: GateWorld) => w.a, 'BA'],
  ] as const) {
    describe(label, () => {
      let tasks: CrossTenantTask[] = [];
      let before: { attacker: TenantSnapshot; audit: number; victim: TenantSnapshot } | undefined;
      const attacker = (): TenantWorld => attackerOf(world);
      const victim = (): TenantWorld => victimOf(world);

      it('Phase 4 — enforcement: 7 roles × every probe on the attacker’s own data', async () => {
        requirePassed('3');
        expect(await runRolePhase(context(), attacker())).toEqual([]);
        passed.add(`4${step}`);
      }, 600_000);

      it('Phase 5 — isolation: every allowed role × every cross-tenant variant answers as missing', async () => {
        requirePassed(`4${step}`);
        tasks = await prepareCrossTenant(context(), attacker(), victim());
        before = {
          attacker: await snapshotTenant(dataSource, tables, attacker().tenantId),
          audit: await attackerAuditCount(context(), attacker()),
          victim: await snapshotTenant(dataSource, tables, victim().tenantId),
        };
        expect(await runCrossTenantPhase(context(), attacker(), victim(), tasks)).toEqual([]);
        passed.add(`5${step}`);
      }, 900_000);

      it('Phase 6 — integrity: Phase 5 changed no row in either tenant and wrote no audit row', async () => {
        requirePassed(`4${step}`);
        if (!before) throw new Error('not run: Phase 5 took no snapshot');
        const failures: string[] = [];
        for (const [who, tenant, snapshot] of [
          ['attacker', attacker(), before.attacker],
          ['victim', victim(), before.victim],
        ] as const) {
          const after = await snapshotTenant(dataSource, tables, tenant.tenantId);
          for (const table of Object.keys(after)) {
            if (JSON.stringify(after[table]) !== JSON.stringify(snapshot[table])) {
              failures.push(`[integrity] ${who} tenant ${tenant.name}: ${table} changed during cross-tenant calls`);
            }
          }
        }
        const audit = await attackerAuditCount(context(), attacker());
        if (audit !== before.audit) {
          failures.push(`[integrity] ${audit - before.audit} audit row(s) written by tenant ${attacker().name} principals during cross-tenant calls`);
        }
        expect(failures).toEqual([]);
        passed.add(`6${step}`);
      }, 120_000);
    });
  }
```

Phase 6 depends on Phase 4, not on Phase 5 passing: when Phase 5 fails, its snapshot was still taken, and Phase 6 still reports whether anything was written.

Run: `pnpm --filter api test:e2e:release-gate` → FAIL (`Cannot find module './release-gate/engine'`).

- [ ] **Step 5: Implement `apps/api/test/release-gate/engine.ts`**

```ts
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { Role } from '../../src/platform/auth/domain/role';
import type { GateClient } from './client';
import { describeOutcome, normalizeOutcome, Outcome } from './outcome';
import type { CrossTenantVariant, MissingForm, Prepared, Probe, ProbeArgs } from './probe';
import { ALL_ROLES, ROLE_MATRIX } from './role-matrix';
import type { GateWorld, TenantWorld } from './two-tenant-world';

// #92 runtime phases 3–6 (plan decisions 10–12). Each function returns the
// list of failures (prefixed per decision 4) rather than stopping at the
// first, so one run reports every defect.
export interface GateContext {
  client: GateClient;
  dataSource: DataSource;
  probes: readonly Probe[];
  world: GateWorld;
}

export interface CrossTenantTask {
  preparedOwn: Prepared;
  preparedVictim: Prepared;
  probe: Probe;
  role: Role;
  variant: CrossTenantVariant;
}

let sequence = 0;
function unique(world: GateWorld): string {
  sequence += 1;
  return `${world.run}-call-${sequence}`;
}

function cookieFor(world: GateWorld, tenant: TenantWorld, role: Role): string {
  return role === Role.SUPER_ADMIN ? world.superAdminCookie : tenant.cookies[role];
}

async function prepare(ctx: GateContext, probe: Probe, tenant: TenantWorld): Promise<Prepared> {
  return probe.prepare ? probe.prepare(ctx.world.fixtures, tenant) : {};
}

async function rowTenant(ctx: GateContext, table: string, id: string): Promise<string | null> {
  const rows = (await ctx.dataSource.query(
    `SELECT "tenantId"::text AS "tenantId" FROM "${table}" WHERE id = $1`,
    [id],
  )) as { tenantId: string }[];
  return rows[0]?.tenantId ?? null;
}

async function ownCount(ctx: GateContext, table: string, tenantId: string): Promise<number> {
  const rows = (await ctx.dataSource.query(
    `SELECT count(*)::int AS count FROM "${table}" WHERE "tenantId"::text = $1`,
    [tenantId],
  )) as { count: number }[];
  return rows[0].count;
}

async function checkAllowed(ctx: GateContext, probe: Probe, args: ProbeArgs, outcome: Outcome): Promise<string | null> {
  const declared = probe.domainRejected;
  if (declared && outcome.kind === 'ERROR' && outcome.status === declared.status && declared.message.test(outcome.message)) {
    return null;
  }
  if (outcome.kind !== 'OK') return `expected OK, got ${describeOutcome(outcome)}`;
  const { ok } = probe;
  if (ok.kind === 'returnsId') {
    return outcome.ids.length === 1 && outcome.ids[0] === ok.id(args) ? null : `expected id ${ok.id(args)}, got ${describeOutcome(outcome)}`;
  }
  if (ok.kind === 'listIncludes') {
    return outcome.ids.includes(ok.id(args)) ? null : `expected the list to include ${ok.id(args)}, got ${describeOutcome(outcome)}`;
  }
  if (outcome.ids.length !== 1) return `expected one created id, got ${describeOutcome(outcome)}`;
  const tenant = await rowTenant(ctx, ok.table, outcome.ids[0]);
  return tenant === args.own.tenantId ? null : `created ${ok.table} ${outcome.ids[0]} has tenantId ${tenant}, expected ${args.own.tenantId}`;
}

async function matchesMissing(ctx: GateContext, missing: MissingForm, outcome: Outcome, foreign: readonly string[], attacker: TenantWorld): Promise<string | null> {
  switch (missing.kind) {
    case 'null':
      return outcome.kind === 'NULL' ? null : `expected null, got ${describeOutcome(outcome)}`;
    case 'error':
      return outcome.kind === 'ERROR' && outcome.status === missing.status ? null : `expected ERROR ${missing.status}, got ${describeOutcome(outcome)}`;
    case 'emptyConnection':
      return outcome.kind === 'OK' && outcome.ids.length === 0 && outcome.totalCount === 0 ? null : `expected an empty connection, got ${describeOutcome(outcome)}`;
    case 'excludes': {
      if (outcome.kind !== 'OK') return `expected OK, got ${describeOutcome(outcome)}`;
      const leaked = outcome.ids.filter((id) => foreign.includes(id));
      if (leaked.length > 0) return `foreign id(s) returned: ${leaked.join(', ')}`;
      const expected = await ownCount(ctx, missing.table, attacker.tenantId);
      const count = outcome.totalCount ?? outcome.ids.length;
      return count === expected ? null : `count ${count} != attacker's own ${missing.table} rows ${expected}`;
    }
  }
}

export async function runAuthenticationPhase(ctx: GateContext): Promise<string[]> {
  const failures: string[] = [];
  for (const probe of ctx.probes) {
    const prepared = await prepare(ctx, probe, ctx.world.a);
    const outcome = await ctx.client.execute(null, probe.sameTenant({ own: ctx.world.a, prepared, unique: unique(ctx.world) }));
    if (outcome.kind !== 'UNAUTHENTICATED') {
      failures.push(`[authentication] ${probe.key}: expected UNAUTHENTICATED, got ${describeOutcome(outcome)}`);
    }
  }
  return failures;
}

export async function runRolePhase(ctx: GateContext, actor: TenantWorld): Promise<string[]> {
  const failures: string[] = [];
  for (const probe of ctx.probes) {
    const allowed = ROLE_MATRIX[probe.key]?.allowed ?? [];
    for (const role of ALL_ROLES) {
      const args: ProbeArgs = { own: actor, prepared: await prepare(ctx, probe, actor), unique: unique(ctx.world) };
      const outcome = await ctx.client.execute(cookieFor(ctx.world, actor, role), probe.sameTenant(args));
      const problem = allowed.includes(role)
        ? await checkAllowed(ctx, probe, args, outcome)
        : outcome.kind === 'FORBIDDEN' ? null : `expected FORBIDDEN, got ${describeOutcome(outcome)}`;
      if (problem) failures.push(`[enforcement] ${probe.key} as ${role} of tenant ${actor.name}: ${problem}`);
    }
  }
  return failures;
}

// Prepares every target first (both tenants), so the caller can snapshot
// after all fixture writes and before any cross-tenant call.
export async function prepareCrossTenant(ctx: GateContext, attacker: TenantWorld, victim: TenantWorld): Promise<CrossTenantTask[]> {
  const tasks: CrossTenantTask[] = [];
  for (const probe of ctx.probes) {
    const allowed = (ROLE_MATRIX[probe.key]?.allowed ?? []).filter((role) => role !== Role.SUPER_ADMIN);
    for (const variant of probe.crossTenant) {
      for (const role of allowed) {
        tasks.push({
          preparedOwn: await prepare(ctx, probe, attacker),
          preparedVictim: await prepare(ctx, probe, victim),
          probe,
          role,
          variant,
        });
      }
    }
  }
  return tasks;
}

export async function runCrossTenantPhase(ctx: GateContext, attacker: TenantWorld, victim: TenantWorld, tasks: readonly CrossTenantTask[]): Promise<string[]> {
  const failures: string[] = [];
  for (const { preparedOwn, preparedVictim, probe, role, variant } of tasks) {
    const cookie = cookieFor(ctx.world, attacker, role);
    const base: ProbeArgs = { own: attacker, prepared: preparedOwn, unique: unique(ctx.world) };
    const foreign = variant.foreignIds(victim, preparedVictim);
    const where = `[isolation] ${probe.key} "${variant.name}" as ${role} of tenant ${attacker.name}`;
    const actual = await ctx.client.execute(cookie, variant.call({ ...base, foreign }));
    const problem = await matchesMissing(ctx, variant.missing, actual, foreign, attacker);
    if (problem) failures.push(`${where}: ${problem}`);
    if (variant.missing.kind !== 'excludes') {
      const control = await ctx.client.execute(cookie, variant.call({ ...base, foreign: foreign.map(() => randomUUID()) }));
      if (normalizeOutcome(actual) !== normalizeOutcome(control)) {
        failures.push(`${where}: distinguishable from a never-existed id — actual ${describeOutcome(actual)}, control ${describeOutcome(control)}`);
      }
    }
  }
  return failures;
}

export async function attackerAuditCount(ctx: GateContext, attacker: TenantWorld): Promise<number> {
  const rows = (await ctx.dataSource.query(
    `SELECT count(*)::int AS count FROM "audit_event_entity" WHERE "actorId" = ANY($1)`,
    [attacker.adminIds],
  )) as { count: number }[];
  return rows[0].count;
}
```

- [ ] **Step 6: Run the gate**

Run: `pnpm --filter api test:e2e:release-gate`
Expected: Phase 1a, 2, Fixture, 3, and both directions' 4/5/6 **PASS**; **Phase 1b FAILS** listing `[inventory] probes vs tenant surface: missing …` for exactly the 56 non-customer keys (51 GraphQL + 5 REST). Any other failure: if it is a gate bug (wrong document, wrong expected form contradicted by the module's own Accepted contract), fix the probe; if it is a product defect, **stop** (decision: test-only slice).

- [ ] **Step 7: Lint, type-check, commit**

```bash
git add apps/api/test/release-gate/engine.ts apps/api/test/release-gate/probes apps/api/test/two-tenant-release-gate.e2e-spec.ts
git commit -m "test(92): add the release gate's runtime phases with Customers & Properties probes"
```

---

### Task 6: Catalog probes (Catalog §4.3; RFC §4.4 pricing rule → service/add-on)

**Files:**
- Create: `apps/api/test/release-gate/probes/catalog.ts`
- Modify: `apps/api/test/release-gate/probes/index.ts` (append `...CATALOG_PROBES`)

**Interfaces:** Consumes `gqlCall`, `Probe` (Task 4), `connectionProbe`, `getByIdProbe` (Task 5), `Fixtures.service`/`addOn` with `{ priced: false }` (Task 4). Produces `CATALOG_PROBES` (9 probes).

- [ ] **Step 1: Write the probes**

```ts
import { gqlCall, Probe } from '../probe';
import { connectionProbe, getByIdProbe } from './shapes';

const NO_TENANT_INPUT =
  'input carries no tenant-owned id; the tenant comes only from the principal (RFC §4.5), pinned by createdInOwnTenant';
const ACTIVE_PRICING = `query Gate($serviceId: ID!) { activePricing(serviceId: $serviceId) { id } }`;
const UPDATE_SERVICE = `mutation Gate($id: ID!, $input: UpdateServiceInput!) { updateService(id: $id, input: $input) { id } }`;
const UPDATE_ADD_ON = `mutation Gate($id: ID!, $input: UpdateAddOnInput!) { updateAddOn(id: $id, input: $input) { id } }`;
const CREATE_PRICING_RULE = `mutation Gate($input: CreatePricingRuleInput!) { createPricingRule(input: $input) { id } }`;

export const CATALOG_PROBES: readonly Probe[] = [
  getByIdProbe({ field: 'service', id: (t) => t.serviceId, key: 'Query.service', missing: { kind: 'null' } }),
  connectionProbe({ field: 'services', filterType: 'ServiceFilter', id: (t) => t.serviceId, key: 'Query.services', table: 'service_entity' }),
  connectionProbe({ field: 'addOns', filterType: 'AddOnFilter', id: (t) => t.addOnId, key: 'Query.addOns', table: 'add_on_entity' }),
  {
    // Catalog §4.2: activePricing throws NotFound for a service that does not exist.
    crossTenant: [
      {
        call: ({ foreign }) => gqlCall('activePricing', ACTIVE_PRICING, { serviceId: foreign[0] }),
        foreignIds: (victim) => [victim.serviceId],
        missing: { kind: 'error', status: 404 },
        name: 'serviceId belongs to the other tenant',
      },
    ],
    key: 'Query.activePricing',
    ok: { id: ({ own }) => own.pricingRuleId, kind: 'returnsId' },
    sameTenant: ({ own }) => gqlCall('activePricing', ACTIVE_PRICING, { serviceId: own.serviceId }),
  },
  {
    crossTenant: [],
    key: 'Mutation.createService',
    noCrossTenantInput: NO_TENANT_INPUT,
    ok: { kind: 'createdInOwnTenant', table: 'service_entity' },
    sameTenant: ({ unique }) =>
      gqlCall('createService', `mutation Gate($input: CreateServiceInput!) { createService(input: $input) { id } }`, {
        input: { durationMinutes: 45, name: `Gate New Service ${unique}` },
      }),
  },
  {
    // Description only: renaming or deactivating the shared service would break later probes.
    crossTenant: [
      {
        call: ({ foreign, unique }) => gqlCall('updateService', UPDATE_SERVICE, { id: foreign[0], input: { description: `gate ${unique}` } }),
        foreignIds: (victim) => [victim.serviceId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
    ],
    key: 'Mutation.updateService',
    ok: { id: ({ own }) => own.serviceId, kind: 'returnsId' },
    sameTenant: ({ own, unique }) => gqlCall('updateService', UPDATE_SERVICE, { id: own.serviceId, input: { description: `gate ${unique}` } }),
  },
  {
    crossTenant: [],
    key: 'Mutation.createAddOn',
    noCrossTenantInput: NO_TENANT_INPUT,
    ok: { kind: 'createdInOwnTenant', table: 'add_on_entity' },
    sameTenant: ({ unique }) =>
      gqlCall('createAddOn', `mutation Gate($input: CreateAddOnInput!) { createAddOn(input: $input) { id } }`, {
        input: { name: `Gate New Add-on ${unique}`, priceMinorUnits: 250 },
      }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign, unique }) => gqlCall('updateAddOn', UPDATE_ADD_ON, { id: foreign[0], input: { description: `gate ${unique}` } }),
        foreignIds: (victim) => [victim.addOnId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
    ],
    key: 'Mutation.updateAddOn',
    ok: { id: ({ own }) => own.addOnId, kind: 'returnsId' },
    sameTenant: ({ own, unique }) => gqlCall('updateAddOn', UPDATE_ADD_ON, { id: own.addOnId, input: { description: `gate ${unique}` } }),
  },
  {
    // Fresh, unpriced targets per call so the shared service's active rule never changes.
    crossTenant: [
      {
        call: ({ foreign }) => gqlCall('createPricingRule', CREATE_PRICING_RULE, { input: { priceMinorUnits: 1200, serviceId: foreign[0], unit: 'PER_SERVICE' } }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.serviceId],
        missing: { kind: 'error', status: 404 },
        name: 'reference serviceId belongs to the other tenant',
      },
      {
        call: ({ foreign }) => gqlCall('createPricingRule', CREATE_PRICING_RULE, { input: { addOnId: foreign[0], priceMinorUnits: 200, unit: 'FLAT' } }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.addOnId],
        missing: { kind: 'error', status: 404 },
        name: 'reference addOnId belongs to the other tenant',
      },
    ],
    key: 'Mutation.createPricingRule',
    ok: { kind: 'createdInOwnTenant', table: 'pricing_rule_entity' },
    prepare: async (fixtures, tenant) => ({
      addOnId: await fixtures.addOn(tenant.tenantId, { priced: false }),
      serviceId: (await fixtures.service(tenant.tenantId, { priced: false })).serviceId,
    }),
    sameTenant: ({ prepared }) =>
      gqlCall('createPricingRule', CREATE_PRICING_RULE, { input: { priceMinorUnits: 1200, serviceId: prepared.serviceId, unit: 'PER_SERVICE' } }),
  },
];
```

- [ ] **Step 2: Register and run**

Append `...CATALOG_PROBES` (import from `./catalog`) to `PROBES`.
Run: `pnpm --filter api test:e2e:release-gate`
Expected: everything passes except Phase 1b, which now lists exactly 47 missing keys (42 GraphQL + 5 REST), none of them catalog keys. Stop rules as in Task 5 Step 6.

- [ ] **Step 3: Lint, type-check, commit**

```bash
git add apps/api/test/release-gate/probes/catalog.ts apps/api/test/release-gate/probes/index.ts
git commit -m "test(92): add Catalog probes to the release gate"
```

---

### Task 7: Teams & Cleaners probes (Cleaners & Teams §4.3; RFC §4.4 cleaner → team)

**Files:**
- Create: `apps/api/test/release-gate/probes/cleaners.ts`
- Modify: `apps/api/test/release-gate/probes/index.ts` (append `...CLEANER_PROBES`)

**Interfaces:** Produces `CLEANER_PROBES` (8 probes).

- [ ] **Step 1: Write the probes**

```ts
import { gqlCall, Probe } from '../probe';
import { connectionProbe, getByIdProbe } from './shapes';

const NO_TENANT_INPUT =
  'input carries no tenant-owned id; the tenant comes only from the principal (RFC §4.5), pinned by createdInOwnTenant';
const UPDATE_CLEANER = `mutation Gate($id: ID!, $input: UpdateCleanerInput!) { updateCleaner(id: $id, input: $input) { id } }`;
const ASSIGN = `mutation Gate($cleanerId: ID!, $teamId: ID!) { assignCleanerToTeam(cleanerId: $cleanerId, teamId: $teamId) { id } }`;

export const CLEANER_PROBES: readonly Probe[] = [
  getByIdProbe({ field: 'team', id: (t) => t.teamId, key: 'Query.team', missing: { kind: 'null' } }),
  connectionProbe({ field: 'teams', filterType: 'TeamFilter', id: (t) => t.teamId, key: 'Query.teams', table: 'team_entity' }),
  getByIdProbe({ field: 'cleaner', id: (t) => t.cleanerId, key: 'Query.cleaner', missing: { kind: 'null' } }),
  connectionProbe({ field: 'cleaners', filterType: 'CleanerFilter', id: (t) => t.cleanerId, key: 'Query.cleaners', table: 'cleaner_entity' }),
  {
    crossTenant: [],
    key: 'Mutation.createTeam',
    noCrossTenantInput: NO_TENANT_INPUT,
    ok: { kind: 'createdInOwnTenant', table: 'team_entity' },
    sameTenant: ({ unique }) =>
      gqlCall('createTeam', `mutation Gate($input: CreateTeamInput!) { createTeam(input: $input) { id } }`, { input: { name: `Gate New Team ${unique}` } }),
  },
  {
    crossTenant: [],
    key: 'Mutation.createCleaner',
    noCrossTenantInput: NO_TENANT_INPUT,
    ok: { kind: 'createdInOwnTenant', table: 'cleaner_entity' },
    sameTenant: ({ unique }) =>
      gqlCall('createCleaner', `mutation Gate($input: CreateCleanerInput!) { createCleaner(input: $input) { id } }`, {
        input: { email: `gate-new-cleaner-${unique}@example.com`, fullName: `Gate New Cleaner ${unique}`, phone: '555-0103' },
      }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign, unique }) => gqlCall('updateCleaner', UPDATE_CLEANER, { id: foreign[0], input: { notes: `gate ${unique}` } }),
        foreignIds: (victim) => [victim.cleanerId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
    ],
    key: 'Mutation.updateCleaner',
    ok: { id: ({ own }) => own.cleanerId, kind: 'returnsId' },
    sameTenant: ({ own, unique }) => gqlCall('updateCleaner', UPDATE_CLEANER, { id: own.cleanerId, input: { notes: `gate ${unique}` } }),
  },
  {
    // Same-team reassignment is an unconditional success (Cleaners & Teams §4.4, M3 round 2).
    crossTenant: [
      {
        call: ({ foreign, own }) => gqlCall('assignCleanerToTeam', ASSIGN, { cleanerId: foreign[0], teamId: own.teamId }),
        foreignIds: (victim) => [victim.cleanerId],
        missing: { kind: 'error', status: 404 },
        name: 'target cleanerId belongs to the other tenant',
      },
      {
        call: ({ foreign, own }) => gqlCall('assignCleanerToTeam', ASSIGN, { cleanerId: own.cleanerId, teamId: foreign[0] }),
        foreignIds: (victim) => [victim.teamId],
        missing: { kind: 'error', status: 404 },
        name: 'reference teamId belongs to the other tenant',
      },
    ],
    key: 'Mutation.assignCleanerToTeam',
    ok: { id: ({ own }) => own.cleanerId, kind: 'returnsId' },
    sameTenant: ({ own }) => gqlCall('assignCleanerToTeam', ASSIGN, { cleanerId: own.cleanerId, teamId: own.teamId }),
  },
];
```

- [ ] **Step 2: Register and run** — append `...CLEANER_PROBES`; run the gate. Expected: Phase 1b lists exactly 39 missing keys (34 GraphQL + 5 REST), no cleaner/team keys; everything else passes.

- [ ] **Step 3: Lint, type-check, commit**

```bash
git add apps/api/test/release-gate/probes/cleaners.ts apps/api/test/release-gate/probes/index.ts
git commit -m "test(92): add Teams & Cleaners probes to the release gate"
```

---

### Task 8: Booking probes — GraphQL and REST (Bookings §4.3; #85; RFC §4.4, §4.5 REST)

**Files:**
- Create: `apps/api/test/release-gate/probes/bookings.ts`
- Create: `apps/api/test/release-gate/probes/bookings-rest.ts`
- Modify: `apps/api/test/release-gate/probes/index.ts` (append `...BOOKING_PROBES, ...BOOKING_REST_PROBES`)

**Interfaces:** Consumes `restCall` (Task 4), `Fixtures.booking` (Task 4). Produces `BOOKING_PROBES` (5), `BOOKING_REST_PROBES` (5).

- [ ] **Step 1: Write the GraphQL probes** — `probes/bookings.ts`

```ts
import { gqlCall, Probe, VariantArgs } from '../probe';
import type { TenantWorld } from '../two-tenant-world';
import { connectionProbe, getByIdProbe } from './shapes';

const CREATE = `mutation Gate($input: CreateBookingInput!) { createBooking(createBookingInput: $input) { id } }`;
const UPDATE = `mutation Gate($input: UpdateBookingInput!) { updateBooking(updateBookingInput: $input) { id } }`;
const REMOVE = `mutation Gate($id: ID!) { removeBooking(id: $id) { id } }`;

export const scheduledAt = (): string => new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

export function bookingInput(own: TenantWorld, override: Record<string, string> = {}): Record<string, string> {
  return { customerId: own.customerId, propertyId: own.propertyId, scheduledAt: scheduledAt(), serviceId: own.serviceId, teamId: own.teamId, ...override };
}

// RFC §4.4 booking references: customer, property, service, team. Shared
// with the REST probe so each surface keeps its own probe (decision 6).
export const BOOKING_REFERENCES: readonly (keyof TenantWorld & ('customerId' | 'propertyId' | 'serviceId' | 'teamId'))[] = [
  'customerId', 'propertyId', 'serviceId', 'teamId',
];

export const BOOKING_PROBES: readonly Probe[] = [
  // `booking(id)` is non-nullable: a missing row is a 404 error (#85 suite).
  getByIdProbe({ field: 'booking', id: (t) => t.bookingId, key: 'Query.booking', missing: { kind: 'error', status: 404 } }),
  connectionProbe({ field: 'bookings', filterType: 'BookingFilter', id: (t) => t.bookingId, key: 'Query.bookings', table: 'booking_entity' }),
  {
    crossTenant: BOOKING_REFERENCES.map((reference) => ({
      call: ({ foreign, own }: VariantArgs) => gqlCall('createBooking', CREATE, { input: bookingInput(own, { [reference]: foreign[0] }) }),
      foreignIds: (victim: TenantWorld) => [victim[reference]],
      missing: { kind: 'error', status: 404 } as const,
      name: `reference ${reference} belongs to the other tenant`,
    })),
    key: 'Mutation.createBooking',
    ok: { kind: 'createdInOwnTenant', table: 'booking_entity' },
    sameTenant: ({ own }) => gqlCall('createBooking', CREATE, { input: bookingInput(own) }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign }) => gqlCall('updateBooking', UPDATE, { input: { id: foreign[0], scheduledAt: scheduledAt() } }),
        foreignIds: (victim) => [victim.bookingId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
      {
        call: ({ foreign, own }) => gqlCall('updateBooking', UPDATE, { input: { id: own.bookingId, teamId: foreign[0] } }),
        foreignIds: (victim) => [victim.teamId],
        missing: { kind: 'error', status: 404 },
        name: 'reference teamId belongs to the other tenant',
      },
    ],
    key: 'Mutation.updateBooking',
    ok: { id: ({ own }) => own.bookingId, kind: 'returnsId' },
    sameTenant: ({ own }) => gqlCall('updateBooking', UPDATE, { input: { id: own.bookingId, scheduledAt: scheduledAt() } }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign }) => gqlCall('removeBooking', REMOVE, { id: foreign[0] }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.bookingId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
    ],
    key: 'Mutation.removeBooking',
    ok: { id: ({ prepared }) => prepared.bookingId, kind: 'returnsId' },
    prepare: async (fixtures, tenant) => ({ bookingId: await fixtures.booking(tenant) }),
    sameTenant: ({ prepared }) => gqlCall('removeBooking', REMOVE, { id: prepared.bookingId }),
  },
];
```

- [ ] **Step 2: Write the REST probes** — `probes/bookings-rest.ts`

```ts
import { Probe, restCall, VariantArgs } from '../probe';
import type { TenantWorld } from '../two-tenant-world';
import { BOOKING_REFERENCES, bookingInput, scheduledAt } from './bookings';

// REST /bookings is its own tenant surface (RFC §4.5; #85; #91 decision 1):
// its own probes, roles pinned separately in the matrix.
export const BOOKING_REST_PROBES: readonly Probe[] = [
  {
    crossTenant: [
      {
        call: () => restCall('GET', '/bookings'),
        foreignIds: (victim) => [victim.bookingId],
        missing: { kind: 'excludes', table: 'booking_entity' },
        name: 'unfiltered list',
      },
    ],
    key: 'GET /bookings',
    ok: { id: ({ own }) => own.bookingId, kind: 'listIncludes' },
    sameTenant: () => restCall('GET', '/bookings'),
  },
  {
    crossTenant: [
      {
        call: ({ foreign }) => restCall('GET', `/bookings/${foreign[0]}`),
        foreignIds: (victim) => [victim.bookingId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
    ],
    key: 'GET /bookings/:id',
    ok: { id: ({ own }) => own.bookingId, kind: 'returnsId' },
    sameTenant: ({ own }) => restCall('GET', `/bookings/${own.bookingId}`),
  },
  {
    crossTenant: BOOKING_REFERENCES.map((reference) => ({
      call: ({ foreign, own }: VariantArgs) => restCall('POST', '/bookings', bookingInput(own, { [reference]: foreign[0] })),
      foreignIds: (victim: TenantWorld) => [victim[reference]],
      missing: { kind: 'error', status: 404 } as const,
      name: `reference ${reference} belongs to the other tenant`,
    })),
    key: 'POST /bookings',
    ok: { kind: 'createdInOwnTenant', table: 'booking_entity' },
    sameTenant: ({ own }) => restCall('POST', '/bookings', bookingInput(own)),
  },
  {
    crossTenant: [
      {
        call: ({ foreign }) => restCall('PATCH', `/bookings/${foreign[0]}`, { scheduledAt: scheduledAt() }),
        foreignIds: (victim) => [victim.bookingId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
      {
        call: ({ foreign, own }) => restCall('PATCH', `/bookings/${own.bookingId}`, { teamId: foreign[0] }),
        foreignIds: (victim) => [victim.teamId],
        missing: { kind: 'error', status: 404 },
        name: 'reference teamId belongs to the other tenant',
      },
    ],
    key: 'PATCH /bookings/:id',
    ok: { id: ({ own }) => own.bookingId, kind: 'returnsId' },
    sameTenant: ({ own }) => restCall('PATCH', `/bookings/${own.bookingId}`, { scheduledAt: scheduledAt() }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign }) => restCall('DELETE', `/bookings/${foreign[0]}`),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.bookingId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
    ],
    key: 'DELETE /bookings/:id',
    ok: { id: ({ prepared }) => prepared.bookingId, kind: 'returnsId' },
    prepare: async (fixtures, tenant) => ({ bookingId: await fixtures.booking(tenant) }),
    sameTenant: ({ prepared }) => restCall('DELETE', `/bookings/${prepared.bookingId}`),
  },
];
```

- [ ] **Step 3: Register and run** — append both arrays; run the gate. Expected: Phase 1b lists exactly 29 missing keys (all GraphQL; none booking, none REST); everything else passes.

- [ ] **Step 4: Lint, type-check, commit**

```bash
git add apps/api/test/release-gate/probes/bookings.ts apps/api/test/release-gate/probes/bookings-rest.ts apps/api/test/release-gate/probes/index.ts
git commit -m "test(92): add GraphQL and REST booking probes to the release gate"
```

---

### Task 9: Jobs & Checklists probes (Jobs & Checklists §4.3; RFC §4.4 job → booking, team)

**Files:**
- Create: `apps/api/test/release-gate/probes/jobs.ts`
- Modify: `apps/api/test/release-gate/probes/index.ts` (append `...JOB_PROBES`)

**Interfaces:** Consumes `Fixtures.job`, `Fixtures.booking`. Produces `JOB_PROBES` (6).

- [ ] **Step 1: Write the probes**

```ts
import { gqlCall, Probe } from '../probe';
import { connectionProbe, getByIdProbe } from './shapes';

const CREATE_FROM_BOOKING = `mutation Gate($input: CreateJobFromBookingInput!) { createJobFromBooking(input: $input) { id } }`;
const ASSIGN_TEAM = `mutation Gate($input: AssignTeamToJobInput!) { assignTeamToJob(input: $input) { id } }`;
const COMPLETE_ITEM = `mutation Gate($input: CompleteChecklistItemInput!) { completeChecklistItem(input: $input) { id } }`;
const COMPLETE_JOB = `mutation Gate($input: CompleteJobInput!) { completeJob(input: $input) { id } }`;

// Fresh jobs per call: execution mutations change job state (Jobs §4.1).
const freshJob = (itemsCompleted: boolean) => async (fixtures, tenant) => {
  const { itemIds, jobId } = await fixtures.job(tenant, { itemsCompleted });
  return { itemId: itemIds[0], jobId };
};

export const JOB_PROBES: readonly Probe[] = [
  getByIdProbe({ field: 'job', id: (t) => t.jobId, key: 'Query.job', missing: { kind: 'null' } }),
  connectionProbe({ field: 'jobs', filterType: 'CleaningJobFilter', id: (t) => t.jobId, key: 'Query.jobs', table: 'cleaning_job_entity' }),
  {
    crossTenant: [
      {
        call: ({ foreign }) => gqlCall('createJobFromBooking', CREATE_FROM_BOOKING, { input: { bookingId: foreign[0] } }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.bookingId],
        missing: { kind: 'error', status: 404 },
        name: 'reference bookingId belongs to the other tenant',
      },
    ],
    key: 'Mutation.createJobFromBooking',
    ok: { kind: 'createdInOwnTenant', table: 'cleaning_job_entity' },
    prepare: async (fixtures, tenant) => ({ bookingId: await fixtures.booking(tenant) }),
    sameTenant: ({ prepared }) => gqlCall('createJobFromBooking', CREATE_FROM_BOOKING, { input: { bookingId: prepared.bookingId } }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign, own }) => gqlCall('assignTeamToJob', ASSIGN_TEAM, { input: { jobId: foreign[0], teamId: own.teamId } }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.jobId],
        missing: { kind: 'error', status: 404 },
        name: 'target jobId belongs to the other tenant',
      },
      {
        call: ({ foreign, prepared }) => gqlCall('assignTeamToJob', ASSIGN_TEAM, { input: { jobId: prepared.jobId, teamId: foreign[0] } }),
        foreignIds: (victim) => [victim.teamId],
        missing: { kind: 'error', status: 404 },
        name: 'reference teamId belongs to the other tenant',
      },
    ],
    key: 'Mutation.assignTeamToJob',
    ok: { id: ({ prepared }) => prepared.jobId, kind: 'returnsId' },
    prepare: freshJob(false),
    sameTenant: ({ own, prepared }) => gqlCall('assignTeamToJob', ASSIGN_TEAM, { input: { jobId: prepared.jobId, teamId: own.teamId } }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign }) => gqlCall('completeChecklistItem', COMPLETE_ITEM, { input: { itemId: foreign[1], jobId: foreign[0] } }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.jobId, preparedVictim.itemId],
        missing: { kind: 'error', status: 404 },
        name: 'target job and item belong to the other tenant',
      },
      {
        call: ({ foreign, prepared }) => gqlCall('completeChecklistItem', COMPLETE_ITEM, { input: { itemId: foreign[0], jobId: prepared.jobId } }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.itemId],
        missing: { kind: 'error', status: 404 },
        name: 'reference itemId belongs to the other tenant',
      },
    ],
    key: 'Mutation.completeChecklistItem',
    ok: { id: ({ prepared }) => prepared.jobId, kind: 'returnsId' },
    prepare: freshJob(false),
    sameTenant: ({ prepared }) => gqlCall('completeChecklistItem', COMPLETE_ITEM, { input: { itemId: prepared.itemId, jobId: prepared.jobId } }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign }) => gqlCall('completeJob', COMPLETE_JOB, { input: { id: foreign[0] } }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.jobId],
        missing: { kind: 'error', status: 404 },
        name: 'target id belongs to the other tenant',
      },
    ],
    key: 'Mutation.completeJob',
    ok: { id: ({ prepared }) => prepared.jobId, kind: 'returnsId' },
    prepare: freshJob(true),
    sameTenant: ({ prepared }) => gqlCall('completeJob', COMPLETE_JOB, { input: { id: prepared.jobId } }),
  },
];
```

Type the `freshJob` parameters explicitly (`fixtures: Fixtures, tenant: TenantWorld`, returning `Promise<Prepared>`) with `import type { Fixtures, TenantWorld } from '../two-tenant-world'` and `Prepared` from `../probe` if lint requires.

- [ ] **Step 2: Register and run** — expected: Phase 1b lists exactly 23 missing keys (laundry, billing, admins only); everything else passes.

- [ ] **Step 3: Lint, type-check, commit**

```bash
git add apps/api/test/release-gate/probes/jobs.ts apps/api/test/release-gate/probes/index.ts
git commit -m "test(92): add Jobs & Checklists probes to the release gate"
```

---

### Task 10: Laundry & Billing probes (Laundry Orders §4.4; Laundry Invoices §4.7; RFC §4.4 order → customer, line → service/add-on, invoice → order)

**Files:**
- Create: `apps/api/test/release-gate/probes/laundry.ts`
- Create: `apps/api/test/release-gate/probes/billing.ts`
- Modify: `apps/api/test/release-gate/probes/index.ts` (append `...LAUNDRY_PROBES, ...BILLING_PROBES`)

**Interfaces:** Consumes `Fixtures.laundryOrder`, `LaundryOrderStatus`, `LaundryFulfillmentType`. Produces `LAUNDRY_PROBES` (17), `BILLING_PROBES` (3).

- [ ] **Step 1: Write the laundry probes** — `probes/laundry.ts`

Each transition gets a fresh order in the state its verb accepts (Laundry Orders §4.3/§4.4), so every allowed call can succeed.

```ts
import { LaundryFulfillmentType } from '../../../src/modules/laundry/domain/laundry-fulfillment-type';
import { LaundryOrderStatus } from '../../../src/modules/laundry/domain/laundry-order-status';
import { gqlCall, Probe } from '../probe';
import { connectionProbe, getByIdProbe } from './shapes';

const RECEIVE = `mutation Gate($input: ReceiveLaundryOrderInput!) { receiveLaundryOrder(input: $input) { id } }`;
const WEIGH = `mutation Gate($input: WeighLaundryOrderInput!) { weighLaundryOrder(input: $input) { id } }`;
const PRICE = `mutation Gate($input: PriceLaundryOrderInput!) { priceLaundryOrder(input: $input) { id } }`;

function transitionProbe(field: string, from: LaundryOrderStatus, fulfillmentType: LaundryFulfillmentType = LaundryFulfillmentType.PICKUP): Probe {
  const document = `mutation Gate($input: LaundryOrderRefInput!) { ${field}(input: $input) { id } }`;
  return {
    crossTenant: [
      {
        call: ({ foreign }) => gqlCall(field, document, { input: { orderId: foreign[0] } }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.orderId],
        missing: { kind: 'error', status: 404 },
        name: 'target order belongs to the other tenant',
      },
    ],
    key: `Mutation.${field}`,
    ok: { id: ({ prepared }) => prepared.orderId, kind: 'returnsId' },
    prepare: async (fixtures, tenant) => ({ orderId: await fixtures.laundryOrder(tenant, from, fulfillmentType) }),
    sameTenant: ({ prepared }) => gqlCall(field, document, { input: { orderId: prepared.orderId } }),
  };
}

const { AWAITING_PICKUP, PAID, PRICED, PROCESSING, READY, RECEIVED, WEIGHED } = LaundryOrderStatus;

export const LAUNDRY_PROBES: readonly Probe[] = [
  getByIdProbe({ field: 'laundryOrder', id: (t) => t.laundryOrderId, key: 'Query.laundryOrder', missing: { kind: 'null' } }),
  connectionProbe({ field: 'laundryOrders', filterType: 'LaundryOrderFilter', id: (t) => t.laundryOrderId, key: 'Query.laundryOrders', table: 'laundry_order_entity' }),
  {
    crossTenant: [
      {
        call: ({ foreign }) => gqlCall('receiveLaundryOrder', RECEIVE, { input: { customerId: foreign[0], fulfillmentType: 'PICKUP' } }),
        foreignIds: (victim) => [victim.customerId],
        missing: { kind: 'error', status: 404 },
        name: 'reference customerId belongs to the other tenant',
      },
    ],
    key: 'Mutation.receiveLaundryOrder',
    ok: { kind: 'createdInOwnTenant', table: 'laundry_order_entity' },
    sameTenant: ({ own }) => gqlCall('receiveLaundryOrder', RECEIVE, { input: { customerId: own.customerId, fulfillmentType: 'PICKUP' } }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign }) => gqlCall('weighLaundryOrder', WEIGH, { input: { orderId: foreign[0], weightGrams: 2500 } }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.orderId],
        missing: { kind: 'error', status: 404 },
        name: 'target order belongs to the other tenant',
      },
    ],
    key: 'Mutation.weighLaundryOrder',
    ok: { id: ({ prepared }) => prepared.orderId, kind: 'returnsId' },
    prepare: async (fixtures, tenant) => ({ orderId: await fixtures.laundryOrder(tenant, RECEIVED) }),
    sameTenant: ({ prepared }) => gqlCall('weighLaundryOrder', WEIGH, { input: { orderId: prepared.orderId, weightGrams: 2500 } }),
  },
  {
    // A foreign service/add-on has no effective price for the caller's
    // tenant: 400 "No effective price for …" (#84/#87 suites), the same
    // answer a never-existed id gets — the control proves it.
    crossTenant: [
      {
        call: ({ foreign, own }) => gqlCall('priceLaundryOrder', PRICE, { input: { addOns: [{ addOnId: own.addOnId }], baseServiceId: own.serviceId, orderId: foreign[0] } }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.orderId],
        missing: { kind: 'error', status: 404 },
        name: 'target order belongs to the other tenant',
      },
      {
        call: ({ foreign, own, prepared }) => gqlCall('priceLaundryOrder', PRICE, { input: { addOns: [{ addOnId: own.addOnId }], baseServiceId: foreign[0], orderId: prepared.orderId } }),
        foreignIds: (victim) => [victim.serviceId],
        missing: { kind: 'error', status: 400 },
        name: 'reference baseServiceId belongs to the other tenant',
      },
      {
        call: ({ foreign, own, prepared }) => gqlCall('priceLaundryOrder', PRICE, { input: { addOns: [{ addOnId: foreign[0] }], baseServiceId: own.serviceId, orderId: prepared.orderId } }),
        foreignIds: (victim) => [victim.addOnId],
        missing: { kind: 'error', status: 400 },
        name: 'reference addOnId belongs to the other tenant',
      },
    ],
    key: 'Mutation.priceLaundryOrder',
    ok: { id: ({ prepared }) => prepared.orderId, kind: 'returnsId' },
    prepare: async (fixtures, tenant) => ({ orderId: await fixtures.laundryOrder(tenant, WEIGHED) }),
    sameTenant: ({ own, prepared }) => gqlCall('priceLaundryOrder', PRICE, { input: { addOns: [{ addOnId: own.addOnId }], baseServiceId: own.serviceId, orderId: prepared.orderId } }),
  },
  transitionProbe('markLaundryOrderAwaitingPayment', PRICED),
  transitionProbe('markLaundryOrderPaid', PRICED),
  transitionProbe('startLaundryProcessing', PAID),
  transitionProbe('markLaundryOrderReady', PROCESSING),
  transitionProbe('markLaundryOrderAwaitingPickup', READY, LaundryFulfillmentType.PICKUP),
  transitionProbe('markLaundryOrderAwaitingDelivery', READY, LaundryFulfillmentType.DELIVERY),
  transitionProbe('completeLaundryOrder', AWAITING_PICKUP),
  transitionProbe('cancelLaundryOrder', RECEIVED),
  transitionProbe('rejectLaundryOrder', RECEIVED),
  transitionProbe('markLaundryOrderLost', PROCESSING),
  transitionProbe('markLaundryOrderDamaged', PROCESSING),
  transitionProbe('refundLaundryOrder', PAID),
];
```

- [ ] **Step 2: Write the billing probes** — `probes/billing.ts`

```ts
import { LaundryOrderStatus } from '../../../src/modules/laundry/domain/laundry-order-status';
import { gqlCall, Probe } from '../probe';
import { connectionProbe, getByIdProbe } from './shapes';

const GENERATE = `mutation Gate($input: GenerateInvoiceFromOrderInput!) { generateInvoiceFromOrder(input: $input) { id } }`;

export const BILLING_PROBES: readonly Probe[] = [
  getByIdProbe({ field: 'invoice', id: (t) => t.invoiceId, key: 'Query.invoice', missing: { kind: 'null' } }),
  connectionProbe({ field: 'invoices', filterType: 'InvoiceFilter', id: (t) => t.invoiceId, key: 'Query.invoices', table: 'invoice_entity' }),
  {
    crossTenant: [
      {
        call: ({ foreign }) => gqlCall('generateInvoiceFromOrder', GENERATE, { input: { laundryOrderId: foreign[0], paymentTerms: 'PAY_NOW' } }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.orderId],
        missing: { kind: 'error', status: 404 },
        name: 'reference laundryOrderId belongs to the other tenant',
      },
    ],
    key: 'Mutation.generateInvoiceFromOrder',
    ok: { kind: 'createdInOwnTenant', table: 'invoice_entity' },
    prepare: async (fixtures, tenant) => ({ orderId: await fixtures.laundryOrder(tenant, LaundryOrderStatus.PRICED) }),
    sameTenant: ({ prepared }) => gqlCall('generateInvoiceFromOrder', GENERATE, { input: { laundryOrderId: prepared.orderId, paymentTerms: 'PAY_NOW' } }),
  },
];
```

- [ ] **Step 3: Register and run** — expected: Phase 1b lists exactly 3 missing keys (`Query.admins`, `Mutation.createAdmin`, `Mutation.disableAdmin`); everything else passes.

- [ ] **Step 4: Lint, type-check, commit**

```bash
git add apps/api/test/release-gate/probes/laundry.ts apps/api/test/release-gate/probes/billing.ts apps/api/test/release-gate/probes/index.ts
git commit -m "test(92): add Laundry & Billing probes to the release gate"
```

---

### Task 11: Staff administration probes and a fully green gate (Admin Foundation §4.5; RFC §4.3, §4.9 example 3)

**Files:**
- Create: `apps/api/test/release-gate/probes/admins.ts`
- Modify: `apps/api/test/release-gate/probes/index.ts` (append `...ADMIN_PROBES`)

**Interfaces:** Consumes `Fixtures.staffAdmin`. Produces `ADMIN_PROBES` (3).

- [ ] **Step 1: Write the probes**

```ts
import { Role } from '../../../src/platform/auth/domain/role';
import { gqlCall, Probe } from '../probe';

const DISABLE = `mutation Gate($id: ID!) { disableAdmin(id: $id) { id } }`;
const ADMINS = `query Gate { admins { id } }`;

export const ADMIN_PROBES: readonly Probe[] = [
  {
    // RFC §4.9 example 3: only that tenant's admins — never another
    // tenant's, never the Super Admin. The own-count check catches both.
    crossTenant: [
      {
        call: () => gqlCall('admins', ADMINS, {}),
        foreignIds: (victim) => victim.adminIds,
        missing: { kind: 'excludes', table: 'admin_user_entity' },
        name: 'unfiltered list',
      },
    ],
    key: 'Query.admins',
    ok: { id: ({ own }) => own.principals[Role.TENANT_OWNER].id, kind: 'listIncludes' },
    sameTenant: () => gqlCall('admins', ADMINS, {}),
  },
  {
    crossTenant: [],
    key: 'Mutation.createAdmin',
    noCrossTenantInput:
      'input carries no tenant-owned id; the new admin\'s tenant comes only from the Tenant Owner principal (RFC §4.3, §4.5), pinned by createdInOwnTenant',
    ok: { kind: 'createdInOwnTenant', table: 'admin_user_entity' },
    sameTenant: ({ unique }) =>
      gqlCall('createAdmin', `mutation Gate($input: CreateAdminInput!) { createAdmin(createAdminInput: $input) { id } }`, {
        input: { email: `gate-staff-${unique}@example.com`, password: `gate-${unique}`, role: 'SCHEDULER' },
      }),
  },
  {
    crossTenant: [
      {
        call: ({ foreign }) => gqlCall('disableAdmin', DISABLE, { id: foreign[0] }),
        foreignIds: (_victim, preparedVictim) => [preparedVictim.adminId],
        missing: { kind: 'error', status: 404 },
        name: 'target admin belongs to the other tenant',
      },
    ],
    key: 'Mutation.disableAdmin',
    ok: { id: ({ prepared }) => prepared.adminId, kind: 'returnsId' },
    prepare: async (fixtures, tenant) => ({ adminId: await fixtures.staffAdmin(tenant.tenantId) }),
    sameTenant: ({ prepared }) => gqlCall('disableAdmin', DISABLE, { id: prepared.adminId }),
  },
];
```

- [ ] **Step 2: Register and run the full gate**

Run: `pnpm --filter api test:e2e:release-gate`
Expected: **every test PASSES** — Phase 1a, 2, Fixture, 1b, 3, and 4/5/6 in both directions (Phase 7 = the `B attacks A` block). Record the test count and wall time.

- [ ] **Step 3: Lint, type-check, commit**

```bash
git add apps/api/test/release-gate/probes/admins.ts apps/api/test/release-gate/probes/index.ts
git commit -m "test(92): add staff administration probes; the release gate covers every tenant surface"
```

---

### Task 12: Negative controls — prove the gate can fail at each phase (decision 4; Review Focus 3)

Temporary local edits only. **Nothing from this task is committed except the outcome record in Task 13.** After each control: `git checkout -- apps/api/src apps/api/test` (or the specific files), then `git status --short` must show no change outside docs.

- [ ] **Control 1 — `[inventory]` (Phase 1a):** in `apps/api/src/modules/customers/presentation/graphql/customer.resolver.ts`, add to `CustomerResolver`:

```ts
  @Query(() => Boolean, { name: 'gateCanary' })
  @UseGuards(AuthGuard)
  @Roles(Role.TENANT_OWNER)
  gateCanary(): boolean {
    return true;
  }
```

and add `'Query.gateCanary': 'TENANT',` to `ROOT_OPERATION_CLASSIFICATION` (a developer who updated #90's list but not the gate). Run the gate. Expected: Phase 1a fails with `[inventory] tenant surface vs role matrix: unexpected Query.gateCanary`; Phases 2–7 report `not run: earlier gate phase(s) failed: 1a`; Phase 1b reports `[inventory] probes vs tenant surface: missing Query.gateCanary`. Revert.

- [ ] **Control 2 — `[policy]` (Phase 2):** in `apps/api/src/modules/customers/presentation/graphql/customer.type.ts`, remove `Role.ANALYST` from `VIEW_ROLES`. Run the gate. Expected: Phase 2 fails with `[policy] Query.customers (CustomerReadResolver.queryMany): live @Roles … != pinned …` (and `Query.customer`, `Query.property`, `Query.customerProperties` if they share the list); runtime phases `not run`. Revert.

- [ ] **Control 3 — `[isolation]` (Phase 5):** in `CustomersService.getCustomer` (`apps/api/src/modules/customers/application/services/customers.service.ts`), change `findOneBy({ id, tenantId })` to `findOneBy({ id })`. Run the gate. Expected: Phase 5 fails with `[isolation] Query.customer "target id belongs to the other tenant" as … : expected null, got OK ids=[…]` and the control-mismatch line; other probes using `getCustomer` (e.g. `Mutation.createProperty`, `Mutation.createBooking` customer reference, `Mutation.receiveLaundryOrder`) may also fail — record which. Revert.

- [ ] **Control 4 — `[integrity]` (Phase 6):** in `CustomersService.update`, insert as the first statement of the method body (before `return this.dataSource.transaction(`):

```ts
    await this.dataSource.getRepository(CustomerEntity).update({ id }, { notes: 'gate-control' });
```

(make the method `async`). Run the gate. Expected: Phase 5 **passes** for `Mutation.updateCustomer` (the response is still 404 and matches the control) while Phase 6 fails with `[integrity] victim tenant B: customer_entity changed during cross-tenant calls` (and the `B attacks A` block with tenant A). Revert.

- [ ] **Record** for each control: the edit, the phase that failed, and the exact first failure message. Confirm `git diff --quiet -- apps/api/src apps/api/test` → exit 0 after the last revert.

---

### Task 13: Docs, rule lifting record, and full verification (decisions 13–15)

**Files:**
- Modify: `README.md` (new section after "Scripts", and the `pnpm --filter api test:e2e` sentence)
- Modify: `docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md` (Tracking cell only)
- Modify: this plan (outcome record)

- [ ] **Step 1: README** — add after the "Scripts" section:

```markdown
## Two-tenant release gate

`pnpm --filter api test:e2e:release-gate` runs `apps/api/test/two-tenant-release-gate.e2e-spec.ts` (needs the e2e Postgres, like every e2e suite; it also runs as part of `pnpm --filter api test:e2e`). It is the multi-tenancy release criterion ([#92](https://github.com/rexescario-dev/clensy-platform/issues/92)): it is **not** in CI and is run on demand. It boots the real API against two fresh tenants and checks, in order:

1. **Inventory** — every live GraphQL root field and controller route is classified (`test/helpers/root-operation-inventory.ts`, `test/helpers/http-route-inventory.ts`), and every tenant operation/route has exactly one role-matrix entry and one probe. A new operation fails the gate until it has both.
2. **Policy** — the pinned role matrix (`test/release-gate/role-matrix.ts`, transcribed from the Accepted specs) equals the live `@Roles()`; `SUPER_ADMIN` is on no tenant operation.
3. **Authentication** — every tenant operation/route rejects a request with no session.
4. **Authorization** — each of the 7 roles gets exactly the matrix's answer on its own tenant's data.
5. **Isolation** — every allowed role's cross-tenant read, write, reference and filter answers as "missing", indistinguishable from an id that never existed.
6. **Integrity** — those cross-tenant calls changed no row in either tenant and wrote no audit row.
7. **Symmetry** — 4–6 again with the tenants swapped.

Update `role-matrix.ts` only when an Accepted authorization spec changes. The gate does not cover relation-field role checks ([#106](https://github.com/rexescario-dev/clensy-platform/issues/106), still open), the web UI, or query counts.
```

Change the line `Package-specific commands can be run directly, e.g. \`pnpm --filter api test:e2e\`, …` to include `` `pnpm --filter api test:e2e:release-gate` `` after `test:e2e`.

- [ ] **Step 2: RFC Tracking cell** (no normative section changes) — in the Tracking cell:
  - after the Legacy REST & Surface Cleanup entry, add `Two-Tenant Isolation Release Gate: [#92](https://github.com/rexescario-dev/clensy-platform/issues/92) (PR pending).`
  - replace `**Interim operating rule:** do not provision a second production tenant. It stays in force after #82–#87 and is lifted only when the [#92](…) two-tenant release gate passes (developer decision, 2026-09-30).` with `**Interim operating rule (lifted):** "do not provision a second production tenant" (developer decision, 2026-09-30) is lifted when the #92 PR merges with the two-tenant release gate (\`pnpm --filter api test:e2e:release-gate\`) passing — not by a local pass alone.`
  - replace `Remaining slice: [#92](…) under program [#81](…).` with `All delivery slices of program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81) are complete. Relation-level RBAC ([#106](https://github.com/rexescario-dev/clensy-platform/issues/106)) remains open and is not covered by the release gate.`
  - Leave the existing `Relation-level RBAC policy: [#106](…) (open).` entry as is.

- [ ] **Step 3: Full verification**

Run each and record the result in the outcome record:
- `pnpm --filter api test:e2e:release-gate` → PASS
- `pnpm --filter api test:e2e` → full suite; compare against `main` (any failure must reproduce on unmodified `main` to be called pre-existing)
- `pnpm --filter api test` → PASS
- `pnpm --filter api lint` → clean, no diff
- `pnpm --filter api exec tsc --noEmit` → only the 2 baseline errors
- `pnpm run build`, `pnpm run lint`, `pnpm run test` (workspace) → PASS
- `git diff --quiet main -- apps/api/src` → exit 0 (test-only slice)

- [ ] **Step 4: Outcome record** — add an "M6 outcome" block to this plan's agent note with: commits, gate test count and wall time, the four negative-control results from Task 12, the verification table from Step 3.

- [ ] **Step 5: Commit**

```bash
git add README.md docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md docs/superpowers/plans/2026-10-02-two-tenant-release-gate-plan.md
git commit -m "docs(92): document the two-tenant release gate and record the interim rule as lifted on merge"
```

---

## Traceability

| RFC requirement | Gate evidence |
| --- | --- |
| §4.2 role gate + tenant predicate both required | Phase 2 (policy) + Phase 4 (enforcement) + Phase 5 (isolation) per operation |
| §4.2 Super Admin not on tenant business resolvers | Matrix never allows `SUPER_ADMIN`; Phase 2; Phase 4 expects `FORBIDDEN` for Super Admin on all 64 |
| §4.3 `OWNER` → `TENANT_OWNER`; staff admin per tenant | Matrix sources; `Query.admins` / `createAdmin` / `disableAdmin` probes |
| §4.4 same-tenant references | Every reference variant (booking ×4, property → customer, pricing rule → service/add-on, cleaner → team, job → booking/team, item → job, order → customer, line → service/add-on, invoice → order) |
| §4.5 tenant from principal only; filters cannot widen | `createdInOwnTenant` on every create; `connectionProbe` filter variant; `excludes` own-count check |
| §4.5 cross-tenant = missing, not 403 | Declared `MissingForm` + never-existed control on every variant |
| §4.5 REST `/bookings` is a tenant surface | 5 REST probes and matrix entries |
| §4.6 audit | Phase 6 audit count; tenant snapshots include `audit_event_entity` |
| §5 invariants 1, 6, 7, 8, 10, 11 | Phases 4–6 |

## Deferred / not in this slice

- Relation-field RBAC policy — #106.
- CI execution of the gate — decision 13.
- Browser/UI-level checks — decision 2.
- Closing #81 — asked at closeout while #106 is open (decision 14).
