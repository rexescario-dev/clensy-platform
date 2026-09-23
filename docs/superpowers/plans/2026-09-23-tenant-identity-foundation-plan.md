# Tenant Identity Foundation — Implementation Plan

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Kind** | Implementation plan (M4) for **one** delivery slice |
| **Date** | 2026-09-23 |
| **Tracking** | GitHub [#68](https://github.com/rexescario-dev/clensy-platform/issues/68). One PR for this Accepted plan + implementation (process §2.8). |
| **Package / repo** | `clensy-platform` — `apps/api`, `apps/web`, `packages/client` |
| **Depends on (Accepted)** | [Multi-Tenant Architecture](../specs/2026-09-23-multi-tenant-architecture-design.md) (Accepted, M3 2026-09-23). **Where this plan and that specification disagree, the specification wins** — stop and return to M2/M3. Also relies on [Admin Foundation](../specs/2026-08-14-admin-foundation-design.md) (cookie JWT `{ sub }`, `AuthGuard`, `@Roles()`, login indistinguishability) without redesigning those mechanics. |

> **For agentic workers:** **M5 Accepted 2026-09-23.** Tracking [#68](https://github.com/rexescario-dev/clensy-platform/issues/68). Use superpowers:subagent-driven-development or superpowers:executing-plans task-by-task. Do **not** invent product semantics; the Accepted specification wins.

**Goal:** Ship tenant identity, explicit platform/tenant scope, the additive role model, principal/`currentAdmin` contracts, and tenant-scoped staff APIs — without tenant-scoping business tables (customers, bookings, catalog, …).

**Architecture:** Add `Tenant` and columns on `AdminUser`. JWT stays `{ sub }`; `AdminIdentityLookupService` loads `{ id, role, scope, tenantId }` every request. Replace `OWNER` with `TENANT_OWNER` on all existing `@Roles()` lists (RBAC only). Staff create/list/disable apply the tenant predicate. Super Admin is not added to business resolvers. Business `tenantId` columns, composite FKs, invoice allocation, nestjs-query row filters, and REST `/bookings` belong to later slice plans.

**Tech Stack:** NestJS, TypeORM, PostgreSQL enums/CHECK/FKs, GraphQL code-first + `@clensy/client` codegen, Next.js App Router, Jest (`apps/api`), vitest (`apps/web`).

**Spec:** [docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md](../specs/2026-09-23-multi-tenant-architecture-design.md) §4.1–§4.3, §4.6 (admin/login audit tenant fields), §4.7 (bootstrap tenant + `OWNER` designation), §4.8 only for staff-console UX that this slice must not break.

## Reconciled delivery program (planning only — not this PR)

Pre-RFC labels `MT-000`–`MT-018` are **not** GitHub issues. After M5 of each slice, open **one issue per Accepted plan**. Mapping against the Accepted RFC:

| Slice | RFC | Notes vs old draft |
| --- | --- | --- |
| **This plan — identity** | §4.1–4.3, §4.7 AdminUser, staff APIs | Merges old MT-006 + identity half of MT-007 (bootstrap tenant, Owner designation). |
| Later: two-tenant **business** fixtures | helpers used by resource slices | Keep a shared e2e helper module; expand when customers gain `tenantId`. |
| Customer / Property modernization | §4.4–4.5, §4.8 | Old MT-008. After identity. |
| Teams / Cleaners modernization | §4.4 | Old MT-011. After identity; **blocks** Booking/Laundry. |
| Catalog modernization | §4.4 | Old MT-012. After identity; **blocks** Booking/Laundry. |
| Booking modernization + REST | §4.4–4.5 REST rule | Old MT-009 + MT-017 REST. After Customer **and** Catalog **and** Teams. |
| Jobs / Checklist | §4.4 | Old MT-010. After Booking. |
| Laundry / Billing | §4.4 invoice allocation | Old MT-013. After Customer **and** Catalog. |
| Staff UI extraction / shell | §4.8, deferred nav | Old MT-014 **minus Super Admin control plane** (RFC out of scope). Old MT-015 stays small. |
| Audit sweep + leftover queries | §4.6, §4.5 | Old MT-016. After resource slices. |
| Two-tenant e2e release gate | isolation properties | Old MT-018. Last. |

**Dropped from the old draft:** MT-001–005 (done: Accepted RFC). Super Admin tenant browsing/APIs (RFC §2 out of scope / §10). Membership, RLS, tenant URLs.

Do **not** write those later M4 plans in this document.

## Global constraints

- SHALL keep JWT payload `{ sub }` plus `iat`/`exp`. SHALL NOT put `role`, `scope`, or `tenantId` in the token (spec §4.1).
- SHALL load principal from the database on every request, including `scope` and `tenantId` (spec §4.1).
- SHALL keep `AdminUser` (no rename to `User`). SHALL NOT add a membership table (spec §4.1).
- SHALL keep `AdminUser.email` globally unique (spec §4.1).
- SHALL introduce explicit `scope` `PLATFORM` \| `TENANT`. SHALL NOT infer Super Admin from `tenantId IS NULL` (spec §4.1, invariant 2).
- SHALL enforce DB: platform ⇒ `tenantId` null and `role = SUPER_ADMIN`; tenant ⇒ `tenantId` not null and role in the tenant role set (spec §4.1).
- SHALL replace every `@Roles(… OWNER …)` with `TENANT_OWNER`. SHALL NOT add `SUPER_ADMIN` to tenant business resolvers (spec §4.2–§4.3).
- SHALL NOT tenant-filter customers, bookings, catalog, jobs, laundry, or invoices in this slice (spec §4.4 is later plans).
- SHALL fail migration if any `OWNER` row lacks an explicit designation (spec §4.3, §4.7). SHALL NOT map `OWNER` → Super Admin or Tenant Owner automatically.
- SHALL treat `OWNER` designation as a **deterministic, explicit input** to the migration process (one designation per existing `OWNER` id: `SUPER_ADMIN` or `TENANT_OWNER`). SHALL abort **before** any irreversible enum removal if designations are missing, duplicate, extra, or invalid. SHALL NOT read designations from `process.env` (migrations MUST remain self-contained and reproducible). The concrete artifact (committed file, bundled JSON, etc.) is an M6 choice; the helper in Task 4 stays the validator.
- SHALL NOT remove `OWNER` from the Postgres role enum until every existing `OWNER` row has been designated **and** converted.
- SHALL let the **migration** create the single bootstrap tenant. Dev/production seed and e2e helpers SHALL consume that tenant (or create additional **test-only** tenants). SHALL NOT invent a second bootstrap tenant from seed.
- SHALL keep login/logout public, cookie `clensy_admin_session`, bcrypt, disabled-account rejection (Admin Foundation).
- SHALL NOT implement Super Admin customer/booking APIs, RLS, tenant switcher, or invoice/catalog `tenantId`.
- SHALL NOT treat planning file names as product semantics.

## Ownership boundaries

**This slice owns:** `platform/auth` principal/role/scope, `modules/admins` (entity, login lookup, staff lifecycle), GraphQL `currentAdmin` / `createAdmin` / `disableAdmin` / `admins` / `login` result admin shape, TypeORM migrations for `Tenant` + `AdminUser` + `AuditEvent` tenant/scope columns for **admin/login** events, `packages/client` operations/codegen for those fields, `apps/web` staff page + `role-presentation` + `CurrentAdmin` query so the console does not keep checking `OWNER`.

**Must not change (except mechanical `OWNER` → `TENANT_OWNER` on `@Roles()` / test fixtures):** customer/property/booking/job/laundry/billing/catalog/cleaner **services**, nestjs-query QueryServices, REST `BookingController` behavior (still unauthenticated; production rule is a later slice), `@clensy/ui`, `@clensy/web` LoginForm/BookingDataTable internals (login page stays wiring-only).

## Contract inventory

| Surface | Change |
| --- | --- |
| `Role` enum | Add `SUPER_ADMIN`, `TENANT_OWNER`; remove `OWNER` after data migration |
| `AdminScope` | New: `PLATFORM`, `TENANT` |
| `AuthenticatedPrincipal` | `{ id, role, scope, tenantId: string \| null }` |
| `CurrentAdmin` GraphQL | Add `scope`, `tenantId` |
| `AdminUser` GraphQL `Admin` type | Expose `scope`, `tenantId` if already exposing role/email; do not expose password hash |
| `createAdmin` | Actor’s tenant; role cannot be `SUPER_ADMIN`; new row `scope=TENANT` |
| `admins` / `disableAdmin` | Tenant predicate; last `TENANT_OWNER` per tenant; no self-disable |
| Login | Unchanged credentials; principal includes scope/tenant |
| `AuditEvent` | **Existing schema** (`audit-event.entity.ts` / `AddAuditEvent1786721735737`): `id`, `actorId` (varchar, nullable), `action`, `entityType`, `entityId`, `metadata` jsonb, `occurredAt`. **No** scope column or enum today. This slice adds **one** representation aligned with identity `AdminScope`: `scope` nullable `PLATFORM` \| `TENANT` (same enum as `AdminUser`, not a second audit-specific vocabulary) and `tenantId` nullable **varchar** (same id-format convention as `actorId`, not a new UUID-FK style). Invariant: `TENANT` ⇒ `tenantId` required; `PLATFORM` ⇒ `tenantId` null. Failed login (no actor, spec §4.6) keeps `actorId` and `tenantId` null and MUST NOT set `scope = PLATFORM` (null scope is “no principal”, distinct from platform). |

## TDD / verification

- Unit: identity lookup, AdminsService create/list/disable, designation helper, AuthGuard with new principal, role metadata on resolvers (`TENANT_OWNER` not `OWNER`).
- E2E: `admin-foundation.e2e-spec.ts` rewritten for bootstrap tenant + `TENANT_OWNER`; Scheduler still cannot createAdmin; disabled session still rejected; Tenant Owner A cannot list/disable Tenant B’s staff (two tenants, identity-only).
- Migration unit/e2e: undesignated `OWNER` fails; designated rows convert.
- Web: `role-presentation.test.ts` for new roles; admin page uses `TENANT_OWNER`.
- Run existing module e2e after mechanical role rename — they still seed a privileged tenant user and hit **unscoped** business data (correct for this slice).

---

### Task 1: Domain types — `AdminScope`, `Role`, principal

**Files:** `apps/api/src/platform/auth/domain/role.ts`, new `admin-scope.ts`, `authenticated-principal.ts`, `modules/admins/domain/admin-user.ts`

**Spec:** §4.1, §4.3

- [ ] Write failing tests that `Role` contains `SUPER_ADMIN` and `TENANT_OWNER` and not `OWNER` (update `auth.guard.spec.ts` fixtures in Task 5; here assert enum members in a small unit test or existing role consumers).
- [ ] Implement `AdminScope` enum `PLATFORM` \| `TENANT`.
- [ ] Set `Role` to `SUPER_ADMIN`, `TENANT_OWNER`, `OPS_MANAGER`, `SCHEDULER`, `CUSTOMER_SUPPORT`, `FINANCE`, `ANALYST` (no `OWNER`).
- [ ] Extend `AuthenticatedPrincipal` and `AdminUser` with `scope` and `tenantId` (`string | null` on principal; entity: UUID \| null).

---

### Task 2: `Tenant` entity + TypeORM registration

**Files:** new `apps/api/src/modules/admins/infrastructure/persistence/tenant.entity.ts` (or `platform/` if preferred — **planning:** keep next to admins as identity owner; do not invent a `modules/tenants` GraphQL API). `data-source.ts`, `database.module.ts` / `AdminsModule` `forFeature`.

**Spec:** §4.1

- [ ] `TenantEntity`: UUID PK `id`, `name`, timestamps. No slug/status APIs.
- [ ] Register on the CLI `DataSource` and Nest TypeORM module.

---

### Task 3: `AdminUserEntity` columns + CHECK (entity metadata)

**Files:** `admin-user.entity.ts`

**Spec:** §4.1

- [ ] Add `scope` enum column; `tenantId` uuid nullable; `@ManyToOne` / `JoinColumn` to `Tenant` with FK name planned in the migration (`fk_admin_user_tenant`).
- [ ] Document that CHECK constraints are hand-written in the migration (TypeORM cannot express the scope/role/`tenantId` triple). `generate` proposing to drop them MUST NOT be applied (same convention as other hand-written CHECKs in this repo).

---

### Task 4: Designation helper + migration

**Files:** new `apps/api/src/platform/database/owner-designation.ts` (pure function), `apps/api/src/platform/database/migrations/<timestamp>-AddTenantAndAdminScope.ts`, tests `owner-designation.spec.ts`

**Spec:** §4.3, §4.7, §4.6 (audit columns)

**Planning (non-normative):** Designations are a reviewable data artifact loaded by the migration **as data**, not `process.env`. Example: a committed JSON map `{ "<adminUserUuid>": "SUPER_ADMIN" | "TENANT_OWNER" }` next to the migration. Empty map is valid when zero `OWNER` rows exist. Bootstrap tenant is inserted **once** by this migration; use a **stable UUID constant** in the migration (implementer chooses the literal) so seed/tests can look it up without creating another bootstrap row.

**Migration invariant:** Validate **all** designations against **all** current `OWNER` ids **before** any irreversible enum change. **No operation may remove `OWNER` from the enum until all existing `OWNER` rows have been successfully designated and converted.**

- [ ] Test: OWNER ids `a`,`b` and map `{ a: TENANT_OWNER }` → throw (undesignated `b`) — **before** any enum drop in the real migration.
- [ ] Test: complete map → no throw; extra map keys → throw; duplicate/invalid values → throw.
- [ ] Test: empty OWNER list → no throw even if map empty.
- [ ] Implement helper; migration `up` order:
  1. `CREATE TABLE tenant_entity`; insert **exactly one** bootstrap tenant (stable id).
  2. Add enum values `SUPER_ADMIN`, `TENANT_OWNER` if needed for conversion (**additive** only at this step).
  3. Add nullable `AdminUser.scope` / `tenantId`; add `AuditEvent.scope` / `tenantId` per contract inventory (existing audit table has no scope today).
  4. `SELECT` all `role = OWNER`; run designation helper; **abort here** on failure (enum still contains `OWNER`).
  5. UPDATE designated OWNER rows (role + scope + tenantId); UPDATE other admins to `TENANT` + bootstrap `tenantId`.
  6. Assert zero remaining `OWNER` rows.
  7. **Then** recreate the role enum **without** `OWNER`.
  8. SET NOT NULL on `AdminUser.scope`; CHECK constraints spec §4.1; FK `admin_user.tenantId → tenant.id`; CHECK on audit: `(scope = 'TENANT' AND tenantId IS NOT NULL) OR (scope = 'PLATFORM' AND tenantId IS NULL) OR (scope IS NULL AND tenantId IS NULL)` for pre-auth events.
- [ ] `down`: reverse only if safe; document if `OWNER` enum removal is irreversible.
- [ ] Test: undesignated OWNER causes `up` to fail **with `OWNER` still in the enum** (helper unit tests are the primary proof; one integration test if practical).

---

### Task 5: Identity lookup + AuthGuard tests

**Files:** `admin-identity-lookup.service.ts`, `admin-identity-lookup.service.spec.ts`, `jwt.strategy.spec.ts`, `auth.guard.spec.ts`, `auth.module.composition-root.spec.ts`

**Spec:** §4.1, §4.2

- [ ] Failing tests: active tenant user → principal `{ id, role, scope: TENANT, tenantId }`; Super Admin → `scope: PLATFORM`, `tenantId: null`; disabled → null.
- [ ] Implement lookup selecting `scope`/`tenantId`/`role`.
- [ ] Update guard tests to pass full principal; `@Roles(TENANT_OWNER)` replaces `OWNER`.

---

### Task 6: `AdminsService` staff lifecycle

**Files:** `admins.service.ts`, `create-admin.command.ts`, `disable-admin.command.ts`, `admins.service.spec.ts`, `admins.service.e2e-spec.ts`, `admins.service.disable-concurrency.e2e-spec.ts`

**Spec:** §4.3

- [ ] `create`: set `tenantId`/`scope` from **actor** (must be `TENANT_OWNER` of that tenant). Reject `role === SUPER_ADMIN`. Duplicate email still `ConflictException`.
- [ ] `list`: `find` where `tenantId = actorTenantId` (command must include actor tenant from principal — resolver passes it). SHALL NOT return Super Admins or other tenants.
- [ ] `disable`: same tenant only (else NotFound, spec §4.5 missing-row for cross-tenant); last active `TENANT_OWNER` **of that tenant** cannot be disabled; self-disable forbidden.
- [ ] Concurrency e2e: two last-owner disables for **one tenant** — one fails (adapt lock query from `role = OWNER` to `TENANT_OWNER` + `tenantId`).

---

### Task 7: GraphQL admins + currentAdmin

**Files:** `admin.resolver.ts`, `current-admin.type.ts`, `admin.type.ts`, `login-result.type.ts`, `create-admin.input.ts`, `admin.resolver.spec.ts`, `packages/client/src/operations/current-admin.graphql`, `admins.graphql`, `login.graphql`, codegen

**Spec:** §4.1–§4.3

- [ ] Register `AdminScope` on GraphQL.
- [ ] `CurrentAdminType`: `id`, `role`, `scope`, `tenantId` (nullable).
- [ ] `currentAdmin` maps full principal.
- [ ] `@Roles(Role.TENANT_OWNER)` on create/disable/admins.
- [ ] Resolver tests: metadata roles; currentAdmin returns scope/tenantId.
- [ ] Update client operations; run graphql-codegen.

---

### Task 8: Mechanical `OWNER` → `TENANT_OWNER` on business resolvers and tests

**Files:** every `Role.OWNER` hit in `apps/api/src/modules/**` and `apps/api/test/**` **except** migration designation code. `apps/api/test/helpers/seed-owner.ts` (rename behavior: seed `TENANT_OWNER` + bootstrap tenant). `apps/api/src/platform/database/seed.ts`.

**Spec:** §4.3

- [ ] Replace `@Roles` lists and VIEW_ROLES arrays.
- [ ] `seedOwner` / `seedTenantOwner`: **look up** the bootstrap tenant created by the migration (stable id from Task 4). Insert `TENANT_OWNER` with `scope=TENANT` and that `tenantId`. SHALL NOT `INSERT` a new bootstrap tenant. Two-tenant tests insert **additional** named test tenants in test setup only.
- [ ] Dev seed (`platform/database/seed.ts`): attach `TENANT_OWNER` to the **existing** bootstrap tenant; never `OWNER`; never a second bootstrap row.
- [ ] Run `pnpm --filter api test` (unit) and affected e2e; fix fixture principal objects `{ id, role, scope, tenantId }`.

---

### Task 9: Web staff console + role presentation

**Files:** `packages/client` generated types (Task 7), `apps/web/lib/role-presentation.ts`, `role-presentation.test.ts`, `apps/web/app/app/admin/page.tsx`, `packages/client/src/operations/current-admin.graphql` already updated, `user-menu.tsx` (consumes role via `presentRole` — add labels for `TENANT_OWNER`, `SUPER_ADMIN`)

**Spec:** §4.3, §4.8 (do not extract `@clensy/web` staff table in this slice unless the page cannot compile otherwise — **planning:** keep page-local DataTable; only replace `role === 'OWNER'` with `TENANT_OWNER`. Full staff-domain extraction is a later slice.)

- [ ] Tests: `presentRole('TENANT_OWNER')` and `presentRole('SUPER_ADMIN')` defined; `presentRole('OWNER')` undefined.
- [ ] Admin page: `isOwner` → tenant owner check on `currentAdmin.role === 'TENANT_OWNER'`; redirect on missing `currentAdmin` unchanged; `ROLE_OPTIONS` for create: operational roles + `TENANT_OWNER`, **not** `SUPER_ADMIN`.
- [ ] SHALL NOT add Super Admin tenant-management UI.

---

### Task 10: Admin-foundation e2e + two-tenant staff isolation

**Files:** `apps/api/test/admin-foundation.e2e-spec.ts`, new helper `apps/api/test/helpers/seed-tenant-admin.ts` if not folded into Task 8

**Spec:** §4.3, §4.5 (staff rows only)

- [ ] Flow: login Tenant Owner A → create Scheduler in tenant A → Scheduler denied createAdmin → disable Scheduler → disabled cookie rejected.
- [ ] New: Tenant Owner B cannot `admins` see A’s users; `disableAdmin(A's id)` → not found.
- [ ] Super Admin calling `customers` receives **`Forbidden`**. Insert a `SUPER_ADMIN` (`scope=PLATFORM`, `tenantId` null) and assert the GraphQL error is authorization failure, not a customer list. This is a regression test that Super Admin was not added to tenant business resolvers (spec §4.2).

---

## Traceability

| Task | Spec |
| --- | --- |
| 1–3 | §4.1 |
| 4 | §4.3 designation, §4.7 |
| 5 | §4.1 JWT/lookup |
| 6–7, 10 | §4.3 staff, §4.2 RBAC vs tenant |
| 8 | §4.3 OWNER replacement |
| 9 | §4.3, §4.8 minimal UX |
| Audit columns in 4 | §4.6 |

## Risks (operational)

- Postgres enum value add vs drop may need two migrations; designation validation MUST still run before the drop.
- Fresh test DBs never have `OWNER`; designation-fail coverage is primarily the pure helper; optional raw-SQL integration if the enum still contains `OWNER` mid-migration.
- Mechanical role replace is wide but shallow; do not “fix” unscoped `find()` on customers in this PR.
- Local DBs that still have `OWNER` rows need a designation artifact before `migration:run`; empty artifact is enough for empty/new databases.

## Out of this plan

Business `tenantId`, composite FKs, nestjs-query tenant authorizer, invoice sequences, REST `/bookings`, `@clensy/web` customer/booking extraction, Super Admin control plane, shell nav filtering (beyond role labels).

## M5 Plan Review

**Decision: Accepted** (2026-09-23)

```text
Decision: Accepted
Subject (plan): docs/superpowers/plans/2026-09-23-tenant-identity-foundation-plan.md
Accepted specification: docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md
Delivery goal: Identity/scope/roles/principal/staff isolation + OWNER designation/migration; no business tenantId
Review summary: After M4 revisions, designation is a self-contained migration input (not env), enum drop is gated on conversion, AuditEvent reuses AdminScope, bootstrap tenant is migration-owned, Super Admin customers is Forbidden, Task 9 stays page-local. Slice still excludes business tenantId and nestjs-query tenant filters.
Findings: None (no plan blockers)
Traceability: adequate (coverage + deferrals checked)
Gate: Proceed to M6. No implementation activity before this Accept.
Authority: Plan governs sequencing/execution; specification governs product semantics.
```

Create the GitHub tracking issue from **this** Accepted plan (one PR for plan + implementation). Then M6.

Tracking: [#68](https://github.com/rexescario-dev/clensy-platform/issues/68). M6 may begin on that issue’s PR.
