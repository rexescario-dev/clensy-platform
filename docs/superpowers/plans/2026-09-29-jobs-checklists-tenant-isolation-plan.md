# Cleaning Jobs & Checklists Tenant Isolation — Implementation Plan

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Kind** | Implementation plan (M4) for **one** delivery slice |
| **Date** | 2026-09-29 |
| **Tracking** | GitHub [#86](https://github.com/rexescario-dev/clensy-platform/issues/86) (program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81)). One PR for this plan (Accepted at M5) + implementation (process §2.8). Branch `feat/86-jobs-checklists-tenant-isolation`. |
| **Package / repo** | `clensy-platform` — `apps/api` only |
| **Depends on (Accepted)** | [Multi-Tenant Architecture](../specs/2026-09-23-multi-tenant-architecture-design.md) (Accepted, M3 2026-09-23). **Where this plan and that specification disagree, the specification wins** — stop and return to M2/M3. Relies on the shipped [Tenant Identity Foundation plan](2026-09-23-tenant-identity-foundation-plan.md) (#68: principal `{ id, role, scope, tenantId }`, `BOOTSTRAP_TENANT_ID`, `test/helpers/seed-tenant-admin.ts`), [Customer & Property plan](2026-09-24-customer-property-tenant-isolation-plan.md) (#82: `tenantReadAuthorizer` / `tenantFilterFor`, `requireTenantId`, relation-override regression pattern), [Teams & Cleaners plan](2026-09-27-teams-cleaners-tenant-isolation-plan.md) (#83: `uq_team_id_tenant`, per-tenant `JobRelationLoaders.teamLoaderFor`, `AssignTeamToJobCommand.tenantId`, audit tagging pattern), [Catalog plan](2026-09-28-catalog-tenant-isolation-plan.md) (#84) and [Booking plan](2026-09-28-booking-tenant-isolation-plan.md) (#85: `uq_booking_id_tenant`, `CreateJobFromBookingCommand.tenantId`, `fieldResolverEnhancers: ['interceptors']`, and the three #86-owned residual exposures). Also relies on [Jobs & Checklists](../specs/2026-08-27-jobs-checklists-design.md), [nestjs-query GraphQL Reads](../specs/2026-08-28-nestjs-query-graphql-reads-design.md), [Paginated GraphQL Collections](../specs/2026-08-28-paginated-graphql-collections-design.md) and [Admin Foundation](../specs/2026-08-14-admin-foundation-design.md) §4.6 (audit) as **extended/constrained by the RFC**. |

> **For agentic workers:** **M5 Accepted 2026-09-29.** Tracking [#86](https://github.com/rexescario-dev/clensy-platform/issues/86). Execution method: inline (superpowers:executing-plans) in the developer's session, chosen at M5 with M6–M10 authorized to run in sequence. Each task ends green on unit tests and `tsc` before the next task starts, and a design/signature problem found in a task is fixed there (plan or implementation) before continuing. Steps use checkbox (`- [ ]`) syntax. Do **not** invent product semantics; the Accepted specification wins. M6 constraints: no production-tenant provisioning, no unrelated refactoring, no push or PR as a side effect; do not weaken failing assertions to get a suite green.
>
> **M5 review (2026-09-29): Accepted — no plan blockers.** The reviewer's final checklist was checked against the repository:
> 1. The expected-drift list matches the migration's hand-written objects (three composite FKs, `uq_cleaning_job_id_tenant`, `idx_cleaning_job_tenant_scheduled`). The baseline diff itself is taken at M6 Task 1 Step 6.
> 2. The `pg_constraint` check names the exact column pairs, `confdeltype` `r`/`r`/`c`, and id-only FK detection.
> 3. The final gate reruns both checks.
> 4. The execution-risks note and revision notes reflect the correction.
> 5. No implementation or push happened during review.
>
> The migrations glob (`data-source.ts`: `migrations/*.ts`) picks up the new file.
>
> **Pre-M5 review revision (2026-09-29):** three findings, each verified against the code before it was applied.
> - **P1: ORM ownership of the parent FKs.** Only `booking` is a TypeORM relation. `teamId` and `ChecklistEntity.jobId` are plain columns whose FKs were always hand-written. This is now stated explicitly in Task 1 Step 4, and a `schema:log` drift check was added (Task 1 Step 6, final gate).
> - **P2: checklist-item lookup.** `getChecklistItemsByChecklistIds` is now scoped through the parent checklist's `tenantId` in the same query. Items still have no `tenantId` (Decisions 2, 6).
> - **P2: audit `entityId`.** The existing convention was verified: `job.checklist_item.complete` logs the job id. It is recorded in Decision 10 and asserted as-is in Task 5 case 9.
>
> The ChecklistItem ownership decision and the slice scope are unchanged.
>
> **Second pre-M5 revision (2026-09-29):** Task 1 Step 6's pass condition contradicted Step 4. TypeORM proposes dropping constraints it has no metadata for, and on `main` it already does so for the hand-written job/checklist FKs (`ExtendPricingRuleEffectiveDating.ts:3-8`). So a proposed drop of a hand-written `_tenant` FK is expected drift. Step 6 now sorts every diff line into one of three buckets: expected, mapping defect, or unexplained. It checks the real constraints separately with `pg_constraint`, looking at column pairs and `ON DELETE` actions, and blocks on unexplained differences.

**Goal:** Make CleaningJob and Checklist tenant-owned: required `tenantId`, database-enforced same-tenant references (job → booking, job → team, checklist → job), the caller's tenant applied to every job and checklist read and write, and job audit events tagged with the caller's tenant. ChecklistItem inherits tenant ownership through its Checklist.

**Architecture:** One migration adds `tenantId` to `cleaning_job_entity` and `checklist_entity`, backfills both with the bootstrap tenant, **validates** that no existing job references a booking or team in another tenant, then adds NOT NULL, the tenant FKs and `uq_cleaning_job_id_tenant`. In the same migration it replaces the three id-only parent FKs with composite `(refId, "tenantId") → parent (id, "tenantId")` FKs. `JobsService` takes a tenant on every operation and puts it in the same query as the id. `CleaningJobType` and `ChecklistType` get `@Authorize(tenantReadAuthorizer())`. `job(id)` and the checklist loader take the principal's tenant. The four job mutations use `requireTenantId`.

**Tech Stack:** NestJS 11, TypeORM 1.1.x migrations (hand-written constraints), PostgreSQL, `@ptc-org/nestjs-query-*` 9.5.0, Jest unit (`pnpm --filter api test`) and e2e against real Postgres (`pnpm --filter api test:e2e`).

**Spec:** [docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md](../specs/2026-09-23-multi-tenant-architecture-design.md) §4.2, §4.4 (CleaningJob and Checklist rows; job → booking reference; `UQ_cleaning_job_booking_id` stays), §4.5, §4.6 (audit), §4.7 (backfill), invariants 1, 4, 6, 7, 8, 12.

## Delivery intent

Implement RFC §4.4–§4.6 for **CleaningJob** and **Checklist**. After this slice:

- A tenant principal cannot see, count, filter to, detect, read, or mutate another tenant's job, its checklist, or its checklist items through any GraphQL path.
- The database rejects a job whose booking or team belongs to a different tenant than the job, and a checklist whose job belongs to a different tenant than the checklist.
- The three #85 residual exposures that name #86 are closed (see "Residual exposures closed").
- `job.create`, `job.assign_team`, `job.checklist_item.complete` and `job.complete` audit events carry `scope: TENANT` and the caller's `tenantId`.

Laundry orders and invoices remain unscoped (#87). Booking audit tagging remains with #90.

## Slice decisions (recorded during brainstorming, 2026-09-29)

These resolve planning-level choices the RFC leaves to M4. None adds product semantics beyond what the RFC authorizes; each one's source is named.

1. **Process.** The Accepted RFC is the architectural specification. No separate spec document is written; these decisions are the brainstorm record, and the plan is reviewed at M5 before any implementation (#84/#85 precedent).

2. **Tenant-owned resources: CleaningJob and Checklist only; ChecklistItem is owned via its Checklist (developer decision, 2026-09-29).** RFC §4.4 lists CleaningJob and Checklist as tenant-owned and does not list ChecklistItem. Every externally reachable CleaningJob and Checklist read/write is constrained by the caller's `tenantId`. ChecklistItems inherit tenant ownership through their Checklist and are **never** independently tenant-scoped: `checklist_item_entity` gets no `tenantId`, no composite FK and no authorizer. Rationale: items have no root query or mutation surface of their own, `checklistId → checklist` already binds each item to exactly one checklist, and a second copy of the tenant would be one more invariant to keep in sync. "Owned via Checklist" does **not** mean trusting a client-supplied item id: `completeChecklistItem` resolves the item only through the tenant-scoped job and its tenant-scoped checklist, in one query keyed on both `id` and `checklistId` (Decision 7).

   ```text
   Booking (id, tenantId)
      │ (bookingId, tenantId)
      ▼
   CleaningJob (id, tenantId, bookingId, teamId?) ── (teamId, tenantId) ──▶ Team (id, tenantId)
      │ (jobId, tenantId)
      ▼
   Checklist (id, tenantId, jobId)
      │ checklistId            (unchanged, id-only, ON DELETE CASCADE)
      ▼
   ChecklistItem (id, checklistId)
   ```

3. **Security invariants (normative for this slice).**
   - **I-1: a job's `tenantId` is authoritative for its booking and team, and a checklist's `tenantId` equals its job's.** The application enforces it (tenant-scoped lookups before write; new rows take the caller's tenant) and so does the database (composite FKs, Decision 4). RFC §4.4: "Application validation and database constraints MUST both prevent cross-tenant references".
   - **I-2: no job or checklist lookup uses a caller-supplied tenant.** The only tenant source is `AuthenticatedPrincipal.tenantId` (RFC §4.5, invariant 1). `tenantId` never appears as a GraphQL field, filterable field or input field on `CleaningJob`, `Checklist` or `ChecklistItem`.

4. **Composite FK invariant (implements I-1 in the database).**

   ```text
   cleaning_job_entity ("bookingId", "tenantId") → booking_entity      ("id", "tenantId")  -- fk_cleaning_job_booking_tenant  ON DELETE RESTRICT
   cleaning_job_entity ("teamId",    "tenantId") → team_entity         ("id", "tenantId")  -- fk_cleaning_job_team_tenant     ON DELETE RESTRICT
   checklist_entity    ("jobId",     "tenantId") → cleaning_job_entity ("id", "tenantId")  -- fk_checklist_job_tenant         ON DELETE CASCADE
   ```

   They replace `fk_cleaning_job_booking`, `fk_cleaning_job_team` and `fk_checklist_job` in the same migration step, **keeping each original `ON DELETE` action**. The referenced pairs are backed by `uq_booking_id_tenant` (#85), `uq_team_id_tenant` (#83) and the new `uq_cleaning_job_id_tenant`. Default `MATCH SIMPLE`: a job with `teamId IS NULL` is not checked against teams, which is the existing "unassigned" state. `fk_checklist_item_checklist` is unchanged (Decision 2). `UQ_cleaning_job_booking_id` and `UQ_checklist_job_id` are unchanged (RFC §4.4: they remain and are consistent with a single tenant).

5. **Read paths.**
   - `jobs` (nestjs-query root list and `totalCount`), and relation filters from it (`jobs(filter: { booking: … })`): constrained by `@Authorize(tenantReadAuthorizer<CleaningJobType>())` on `CleaningJobType`.
   - `job(id)` (custom query, nullable): `JobsService.getJob(id, currentUser.tenantId)`. A null tenant returns `null` without a query; this follows the #83 `team(id)` precedent (`getTeam(id, tenantId: string | null)`), because `job` is a nullable read whose missing-row contract is `null`, not an error.
   - `CleaningJob.checklist` (custom `@ResolveField` through `JobRelationLoaders`): the checklist loader becomes per-tenant, `checklistLoaderFor(tenantId)`, mirroring `teamLoaderFor` (#83). The batch function passes the tenant to `getChecklistsByJobIds(ids, tenantId)`, and a null tenant resolves every key to `null` without touching the service.
   - `ChecklistType` also gets `@Authorize(tenantReadAuthorizer<ChecklistType>())`. No nestjs-query path reads checklists today (both roots of `ChecklistReadResolver` are disabled and no relation targets `ChecklistType`), so this is fail-closed insurance against a root or relation being enabled later (RFC §4.5 lists nestjs-query paths). Verified against `@ptc-org/nestjs-query-graphql` 9.5.0 `default-crud.authorizer.js`: a relation's filter comes from the relation's own `auth` or from the **target** DTO's authorizer, so `Checklist.items` (target `ChecklistItemType`, no authorizer) is unaffected. Task 3 pins this, and existing `jobs.e2e-spec.ts` nested-items coverage proves it end to end.
   - `Checklist.items` (nestjs-query relation on `ChecklistReadResolver`): no authorizer (Decision 2). It is reachable only from a `ChecklistType` parent, which is reachable only through the tenant-scoped `CleaningJob.checklist` loader.
   - `CleaningJob.booking` (nestjs-query relation): already filtered by `BookingDTO`'s authorizer (#85). Unchanged.
   - `CleaningJob.team` (custom `@ResolveField`): already per-tenant (#83). Unchanged.

6. **Write paths: every job/checklist lookup puts `tenantId` in the same query; never fetch-then-filter.** `tenantId` is never part of an update's SET list.
   - `assignTeam`: `findOneBy(CleaningJobEntity, { id, tenantId })`, `manager.update(CleaningJobEntity, { id, tenantId }, …)`, re-read with `{ id, tenantId }`. The existing `TeamsService.getTeam(teamId, tenantId)` pre-check stays.
   - `completeJob`: job `{ id, tenantId }`; checklist `{ jobId: job.id, tenantId }`; items by `checklistId` (Decision 2); update and re-read `{ id, tenantId }`.
   - `completeChecklistItem`: see Decision 7.
   - `createFromBooking`: `BookingsService.findOne(bookingId, tenantId)` (#85, unchanged); the existing-job pre-check becomes `findOneBy({ bookingId, tenantId })`; the job and checklist are created with `tenantId: command.tenantId`; items as today.
   - `getChecklistsByJobIds(ids, tenantId: string)`: `findBy({ jobId: In(ids), tenantId })`.
   - `listJobs(tenantId: string)`: `find({ where: { tenantId } })`. It has no production caller; it is scoped rather than removed so no unscoped public service method remains (removal would be unrelated refactoring).
   - `getChecklistItemsByChecklistIds(ids, tenantId: string)`: `findBy({ checklistId: In(ids), checklist: { tenantId } })`, a join through the existing `ChecklistItemEntity.checklist` `@ManyToOne` in the same query (M5 finding 2). The service boundary enforces the parent's tenant, so safety does not depend on a caller convention. Items still have no `tenantId` of their own (Decision 2). It has no production caller (only unit and service-e2e tests), and it is scoped for the same reason as `listJobs`.

7. **`completeChecklistItem` resolves the item only through the scoped chain.** Job `{ id: jobId, tenantId }` ⇒ checklist `{ jobId: job.id, tenantId }` ⇒ item `findOneBy(ChecklistItemEntity, { id: itemId, checklistId: checklist.id })`. This replaces today's fetch-by-id-then-compare `item.checklistId !== checklist.id`. The missing-row outcomes are the existing ones: missing job ⇒ `NotFoundException('Job … not found')`; missing checklist or item (including an item of another job or tenant) ⇒ `NotFoundException('Checklist item … not found')`. The item `UPDATE` stays keyed on `{ id: item.id }`, because the item was already resolved through the tenant-scoped chain inside the same transaction. The job `UPDATE` is keyed on `{ id, tenantId }`.

8. **Cross-tenant = missing row (RFC §4.5).** `jobs` lists and counts exclude other tenants' jobs. `job(id)` for another tenant's id returns `null` with no error, exactly like a nonexistent id. `assignTeamToJob`, `completeChecklistItem` and `completeJob` against another tenant's job ⇒ the existing `NotFoundException` (404). `createJobFromBooking` with another tenant's booking ⇒ the existing 404 (#85). Never 403 for another tenant's row. Role failure (including Super Admin) remains `Forbidden`.

9. **Mutations take the tenant from `requireTenantId(currentUser)`.** `CompleteChecklistItemCommand` and `CompleteJobCommand` gain `tenantId: string`. `AssignTeamToJobCommand` and `CreateJobFromBookingCommand` already carry it (#83, #85). A null-tenant principal ⇒ `ForbiddenException` before the service is called. The `@Roles()` lists (`CREATE_ROLES`, `EXECUTE_ROLES`, `VIEW_ROLES`) are unchanged, and `SUPER_ADMIN` is not added (RFC §4.2).

10. **Audit (developer decision, 2026-09-29; RFC §4.6).** `job.create`, `job.assign_team`, `job.checklist_item.complete` and `job.complete` record `scope: AdminScope.TENANT` and `tenantId: command.tenantId`. `command.tenantId` is the value `requireTenantId` validated from the principal, never client input. This follows the #82–#84 precedent (each slice tags its own module's events) using the existing `AuditLogger.log` fields (`audit-logger.port.ts`: `tenantId?`, `scope?`), exactly as `TeamsService` does. No new audit format. `actorId`, `action`, `entityType` and `entityId` are unchanged. The existing convention (verified at M5 in `jobs.service.ts`) is that all four events log `entityType: 'job'` and `entityId: <job id>`, including `job.checklist_item.complete` (job id, not item id). Booking, laundry and invoice audit tagging stays with #90.

11. **Migration backfill and validation (RFC §4.7).** Every existing job and checklist is attached to the bootstrap tenant, per the RFC's literal rule (#85 precedent), and is not derived from the booking. Before any constraint is created, the migration validates:
    - **booking** tenant equality for **every** job (required reference);
    - **team** tenant equality **only when `teamId IS NOT NULL`**.

    Checklist → job needs no validation: both are backfilled to the same bootstrap tenant in step 2, so they cannot mismatch. The validation checks tenant mismatch only, not missing parents, because the id-only FKs are still in place at that step. If any count is non-zero, the migration throws an explicit error naming the counts, and the single transaction rolls back with nothing modified. In production every booking and team is already bootstrap-owned (#83, #85), so this is a fail-closed guard for dev/e2e databases with leftover test-tenant rows.

12. **`uq_cleaning_job_id_tenant` = `UNIQUE ("id", "tenantId")`** exists only as the FK target of `fk_checklist_job_tenant` (RFC §4.4: "that uniqueness exists so the composite FK is valid, not as an extra product rule"). `checklist_entity` gets **no** `(id, tenantId)` unique, because nothing tenant-aware references it (Decision 2).

## Residual exposures closed (from the #85 plan)

| #85 residual | Closed by | Pinned by |
| --- | --- | --- |
| `CleaningJob.booking` reached through the unscoped job root (error instead of invisibility) | Decision 5 (`job(id)` scoped; `jobs` authorized) | Task 5 case 3; Task 4 replaces #85 cases 10 / 10b |
| `jobs(filter: { booking: { … } })` as an existence/value oracle over another tenant's booking scalars | Decision 5 (root scoped) + Decision 4 (every visible job's booking is same-tenant) | Task 5 case 2 |
| Per-request `ctx.authorizer` sharing, exploitable only through an unscoped parent → tenant-owned relation | No unscoped parent of a tenant-owned relation remains among jobs/checklists (Decision 5) | Task 5 cases 2–3 (structural; no separate probe) |

**Still open after #86 (owned elsewhere):** the laundry-order cross-tenant pricing path and laundry/invoice tables (#87); booking/laundry/invoice audit tagging and the relation-level `guards`/`@Roles()` observation (#90); the two-tenant release gate (#92). **Interim operating rule (unchanged from #82–#85):** do not provision a second production tenant before #87 has shipped.

## Global constraints

- SHALL derive the tenant **only** from `AuthenticatedPrincipal.tenantId` (I-2). SHALL NOT expose `tenantId` on `CleaningJob`, `CleaningJobFilter`, `Checklist`, `ChecklistItem` or any job input type.
- SHALL NOT hardcode `BOOTSTRAP_TENANT_ID` in any request path. It MAY appear only in the migration and tests.
- SHALL enforce, in the database:
  - `cleaning_job_entity."tenantId" uuid NOT NULL` + `fk_cleaning_job_tenant` → `tenant_entity(id)` `ON DELETE RESTRICT`;
  - `checklist_entity."tenantId" uuid NOT NULL` + `fk_checklist_tenant` → `tenant_entity(id)` `ON DELETE RESTRICT`;
  - `uq_cleaning_job_id_tenant`;
  - the three composite FKs of Decision 4;
  - `idx_cleaning_job_tenant_scheduled` on `("tenantId", "scheduledAt" DESC, "id")`, matching the `jobs` default sort.

  The three id-only FKs are removed. `UQ_cleaning_job_booking_id`, `UQ_checklist_job_id`, the `teamId` index and everything on `checklist_item_entity` are unchanged.
- SHALL order the migration exactly: **(0)** assert the bootstrap tenant exists → **(1)** add nullable `tenantId` to both tables → **(2)** backfill both → **(3)** validate (Decision 11) → **(4)** NOT NULL + tenant FKs on both → **(5)** `uq_cleaning_job_id_tenant` → **(6)** drop each id-only parent FK and add its composite replacement (same step) → **(7)** `idx_cleaning_job_tenant_scheduled`. All in **one** migration; SHALL NOT split it. No committed state lacks a parent FK.
- SHALL treat `@Authorize` on `CleaningJobType` and `ChecklistType` as a **security invariant**. No relation targeting either type may carry a relation-level `auth` or enable relation `update`/`remove`. Planning-time inventory: **no** nestjs-query relation targets `CleaningJobType` or `ChecklistType`; exactly one targets `ChecklistItemType` (`Checklist.items`). Task 3 pins this.
- SHALL keep `@Roles()` sets unchanged and SHALL NOT add `SUPER_ADMIN` to any job resolver (RFC §4.2).
- SHALL NOT change `booking_entity`, `team_entity`, laundry/billing tables, or `checklist_item_entity`.
- SHALL NOT use PostgreSQL RLS (invariant 12).
- SHALL NOT change `apps/web`, `packages/*`, GraphQL operation documents, or the public GraphQL schema. Adding `@Authorize` does not change the schema.

## Ownership boundaries

**This slice owns:** `apps/api/src/modules/jobs/**`; one new migration in `apps/api/src/platform/database/migrations/`; `test/helpers/seed-tenant-admin.ts` (`removeTestTenants` job cleanup and comment); e2e suites that insert jobs or pin #86 interim behaviour (`jobs.service.e2e-spec.ts`, `jobs.e2e-spec.ts`, `teams-cleaners.tenant-isolation.e2e-spec.ts`, `bookings.tenant-isolation.e2e-spec.ts`); stale `#86` code comments outside applied migrations.

**Must not change:** Bookings / Customers / Catalog / Teams / Cleaners persistence, services, types or authorizers; `tenantReadAuthorizer` / `requireTenantId` / `AuthGuard` / `@CurrentUser()` / `@Roles()` (consumed as-is); the audit port and logger; `platform/graphql`; Laundry / Billing; `apps/web`; `packages/*`.

## Contract inventory

| Surface | Change |
| --- | --- |
| `cleaning_job_entity` | `tenantId uuid NOT NULL` + `fk_cleaning_job_tenant`; `uq_cleaning_job_id_tenant`; `fk_cleaning_job_booking_tenant` and `fk_cleaning_job_team_tenant` replacing the id-only FKs; `idx_cleaning_job_tenant_scheduled` |
| `checklist_entity` | `tenantId uuid NOT NULL` + `fk_checklist_tenant`; `fk_checklist_job_tenant` replacing `fk_checklist_job` (CASCADE kept) |
| `CleaningJob` / `Checklist` domain | + `tenantId: string` |
| `CleaningJobEntity` | + `tenantId` column and `tenant` relation (`fk_cleaning_job_tenant`); `booking` `@ManyToOne` gets `createForeignKeyConstraints: false` (#82 `PropertyEntity` precedent) |
| `ChecklistEntity` | + `tenantId` column and `tenant` relation (`fk_checklist_tenant`) |
| `CompleteChecklistItemCommand`, `CompleteJobCommand` | + `tenantId: string` |
| `JobsService` | `assignTeam` / `completeChecklistItem` / `completeJob` / `createFromBooking` scoped per Decisions 6–7 and audit-tagged (Decision 10); `getJob(id, tenantId: string \| null)`; `listJobs(tenantId: string)`; `getChecklistsByJobIds(ids, tenantId: string)`; `getChecklistItemsByChecklistIds(ids, tenantId: string)` (scoped through the parent checklist) |
| `JobRelationLoaders` | `checklistLoader` → `checklistLoaderFor(tenantId: string \| null)`; `createChecklistBatchFn(jobsService, tenantId)` |
| GraphQL `CleaningJobType`, `ChecklistType` | `@Authorize(tenantReadAuthorizer<…>())` |
| GraphQL `JobResolver` | `job(id)` passes `currentUser.tenantId`; `checklist` field uses the principal's tenant loader; `completeChecklistItem` / `completeJob` pass `requireTenantId(currentUser)` |

**Deferred:** laundry/invoice tenant ownership (#87); booking/laundry/invoice audit tagging (#90); two-tenant release gate (#92); any UI.

## TDD / verification strategy

- **Unit (Jest):**
  - `JobsService`: the tenant predicate is in the same query for every lookup and update, `tenantId` is absent from every SET list, new job and checklist rows carry the tenant, audit tags are present, and a null tenant on `getJob` makes no repository call.
  - Loaders: per-tenant memoization; a null tenant makes no call.
  - Resolver: the tenant comes from the principal, and a null-tenant principal on a mutation throws `ForbiddenException` before the service is called.
  - `@Authorize` metadata on both types, the relation-inventory regression, and `tenantId` absent from the schema.
- **Migration e2e (throwaway database; `add-booking-tenant.migration.e2e-spec.ts` harness):** bootstrap assertion; backfill; a validation abort leaves data untouched; constraint swap with the original `ON DELETE` actions; the composite FKs reject each tenant-mismatched reference; a null `teamId` is accepted; checklist cascade still works; `down` restores.
- **Two-tenant API e2e (real Postgres, `AppModule`):** every Decision 5–10 case, the #85 residual cases, spoofing (I-2), audit tags and the DB backstop (I-1).
- **Suite health:** Tasks 1–4 are coupled. After Task 1 the NOT NULL columns break e2e fixtures that insert jobs directly. Unit tests MUST be green at the end of every task. The full e2e suite MUST be green from Task 4 onward, except for failures that already exist on `main`: record their names at the start of M6 by running `pnpm --filter api test:e2e` on `main`. Any other failure blocks.
- **Final gate (Task 6):** `pnpm --filter api lint`, `test`, `test:e2e` and `build`; `migration:run` against a fresh database; `git diff --stat main -- apps/web packages` empty; generated GraphQL schema diff against `main` empty.

## Review Focus

These are failure modes the RFC implies but reviewers can easily miss. The task named for each item has the test that pins it.

1. **Item-id confusion (Decision 7):** as B, `completeChecklistItem({ jobId: <B's job>, itemId: <A's item> })` ⇒ 404 and A's item still `completed: false`. Also as B, `{ jobId: <A's job>, itemId: <A's item> }` ⇒ 404 (Task 2 unit, Task 5 e2e).
2. **Update scoped in every statement:** every `manager.update(CleaningJobEntity, …)` WHERE carries `tenantId`, and no SET carries it (Task 2 unit).
3. **Relation filter as an oracle (closes #85 residual):** as B, `jobs(filter: { booking: { id: { eq: <A's booking> } } })` and the `status` / `scheduledAt` equivalents ⇒ `nodes: []`, `totalCount: 0`; the same filters as A return A's job (positive control) (Task 5).
4. **Checklist loader cache across tenants:** a cached checklist is only served back to the tenant it was loaded for (per-tenant loader map) (Task 3 unit).
5. **Client input tries to supply or widen the tenant (I-2):** `jobs(filter: { tenantId: … })` ⇒ schema error; `or`-widening filter ⇒ empty; `x-tenant-id` header ignored; `createJobFromBooking` input with `tenantId` ⇒ validation error (Task 5).
6. **Audit tagged with the caller's tenant, not the row's:** in the success path they are equal by construction. The unit test asserts `tenantId: command.tenantId` and `scope: TENANT` on each of the four events (Task 2), and the e2e reads the rows back (Task 5).

---

### Task 1: Schema — domain, entities, migration, test cleanup helper

**Spec:** §4.4 (job → booking reference; `(id, tenantId)` uniqueness), §4.5 (NOT NULL, tenant FK, indexes), §4.7 (backfill before NOT NULL); Slice decisions 2, 4, 11, 12.

**Files:**
- Modify: `apps/api/src/modules/jobs/domain/cleaning-job.ts`, `domain/checklist.ts` (+ `tenantId: string`)
- Modify: `apps/api/src/modules/jobs/infrastructure/persistence/cleaning-job.entity.ts`, `checklist.entity.ts`
- Create: `apps/api/src/platform/database/migrations/1790697600000-AddJobChecklistTenant.ts`
- Modify: `apps/api/test/helpers/seed-tenant-admin.ts`
- Test: `apps/api/test/add-job-checklist-tenant.migration.e2e-spec.ts`

**Interfaces:**
- Produces: `CleaningJob.tenantId: string`, `Checklist.tenantId: string`; entity `tenantId` / `tenant` on both; constraint names `fk_cleaning_job_tenant`, `fk_checklist_tenant`, `uq_cleaning_job_id_tenant`, `fk_cleaning_job_booking_tenant`, `fk_cleaning_job_team_tenant`, `fk_checklist_job_tenant`; index `idx_cleaning_job_tenant_scheduled`.

- [ ] **Step 1: Write the failing migration e2e.** Use the same harness as `test/add-booking-tenant.migration.e2e-spec.ts`: a throwaway database, `connectionOptions` / `migrationsBefore` from `test/helpers/migration-db.ts`, and the explicit `inTransaction` wrapper, with sequential cases. Fixtures are raw SQL inserts:
   - one bootstrap customer, property, service, team and booking;
   - one second tenant with its own customer, property, service, team and booking.

   Jobs, checklists and items are inserted with raw SQL (no `tenantId` before `up`).

```ts
const NEW_CONSTRAINTS = [
  ['cleaning_job_entity', 'fk_cleaning_job_tenant'],
  ['cleaning_job_entity', 'uq_cleaning_job_id_tenant'],
  ['cleaning_job_entity', 'fk_cleaning_job_booking_tenant'],
  ['cleaning_job_entity', 'fk_cleaning_job_team_tenant'],
  ['checklist_entity', 'fk_checklist_tenant'],
  ['checklist_entity', 'fk_checklist_job_tenant'],
] as const;
const OLD_CONSTRAINTS = [
  ['cleaning_job_entity', 'fk_cleaning_job_booking'],
  ['cleaning_job_entity', 'fk_cleaning_job_team'],
  ['checklist_entity', 'fk_checklist_job'],
] as const;
```

Cases, in order:
1. **Bootstrap missing ⇒ abort.** With the bootstrap tenant row temporarily absent (same technique as the booking suite), `up` rejects with `/bootstrap tenant .* not found/`, and neither table has a `tenantId` column.
2. **Validation abort (Decision 11).**
   - Insert a job on the **second tenant's booking**. `up` rejects with `/AddJobChecklistTenant: .*booking/`. Afterwards neither table has a `tenantId` column, the job row is unchanged, and every `OLD_CONSTRAINTS` name still exists. Delete that job.
   - Repeat with a job on the bootstrap booking whose **non-null** `teamId` is the second tenant's team ⇒ rejects with `/team/`. Delete it.
3. **Happy path.** Insert two jobs on bootstrap bookings, one with the bootstrap team and one with `teamId` NULL. The NULL one proves validation does not reject an unassigned job. Give each job one checklist and one item, then run `up`. Then:
   - every job and checklist has `tenantId = BOOTSTRAP_TENANT_ID`, and both columns are `NOT NULL`;
   - every `NEW_CONSTRAINTS` name exists in `pg_constraint` for its table, and no `OLD_CONSTRAINTS` name does;
   - `pg_constraint.confdeltype` is `'r'` for `fk_cleaning_job_booking_tenant` / `fk_cleaning_job_team_tenant` and `'c'` for `fk_checklist_job_tenant`;
   - `idx_cleaning_job_tenant_scheduled` exists in `pg_indexes`;
   - `UQ_cleaning_job_booking_id`, `UQ_checklist_job_id` and `fk_checklist_item_checklist` still exist;
   - `checklist_item_entity` has no `tenantId` column (Decision 2).
4. **Composite FKs reject mismatches (I-1).** Each case expects a rejection whose `error.driverError.constraint` names the matching FK:
   - a job insert with `tenantId` = bootstrap and `bookingId` = the second tenant's booking ⇒ `fk_cleaning_job_booking_tenant`;
   - the same with `teamId` = the second tenant's team ⇒ `fk_cleaning_job_team_tenant`;
   - a checklist insert with `tenantId` = the second tenant and `jobId` = a bootstrap job ⇒ `fk_checklist_job_tenant`.

   A job insert with `teamId` NULL succeeds.
5. **Cascade kept.** Deleting a bootstrap job deletes its checklist and that checklist's items.
6. **`down`.** It restores every `OLD_CONSTRAINTS` name (with the original `ON DELETE` actions), drops every `NEW_CONSTRAINTS` name and the index, and drops both columns. Existing rows survive.

- [ ] **Step 2: Run and confirm failure.** `pnpm --filter api test:e2e -- add-job-checklist-tenant` ⇒ fails (migration module does not exist).

- [ ] **Step 3: Write the migration.**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../bootstrap-tenant';

// Tenant ownership for CleaningJob and Checklist (#86; RFC §4.4, §4.5,
// §4.7). ChecklistItem is owned via its Checklist and is not touched
// (#86 slice decision 2). Step order is load-bearing and the whole
// migration is one transaction:
//
//   0. Assert the bootstrap tenant exists; abort before touching any row.
//   1. Nullable `tenantId` on both tables.
//   2. Backfill every job and checklist to the bootstrap tenant.
//   3. Validate: no job may reference a booking, or a non-null team, in
//      another tenant (slice decision 11). Checklist → job cannot mismatch
//      after step 2. Fails closed; the transaction rolls back with nothing
//      modified.
//   4. NOT NULL + FK to `tenant_entity` (ON DELETE RESTRICT) on both.
//   5. `UNIQUE (id, "tenantId")` on jobs — the target of
//      `fk_checklist_job_tenant` (slice decision 12).
//   6. Replace each id-only parent FK with its composite `(refId,
//      "tenantId")` FK in the same step, keeping its ON DELETE action
//      (slice decision 4). MATCH SIMPLE: a NULL `teamId` is not checked.
//   7. Tenant-leading index matching the `jobs` default sort.
export class AddJobChecklistTenant1790697600000 implements MigrationInterface {
  name = 'AddJobChecklistTenant1790697600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = (await queryRunner.query(
      `SELECT 1 FROM "tenant_entity" WHERE "id" = $1`,
      [BOOTSTRAP_TENANT_ID],
    )) as unknown[];
    if (tenants.length === 0) {
      throw new Error(
        `AddJobChecklistTenant: bootstrap tenant ${BOOTSTRAP_TENANT_ID} not found — run AddTenantAndAdminScope first`,
      );
    }

    for (const table of ['cleaning_job_entity', 'checklist_entity']) {
      await queryRunner.query(`ALTER TABLE "${table}" ADD "tenantId" uuid`);
      await queryRunner.query(`UPDATE "${table}" SET "tenantId" = $1`, [
        BOOTSTRAP_TENANT_ID,
      ]);
    }

    // Slice decision 11. Tenant mismatch only: the id-only parent FKs are
    // still in place here and already guarantee every non-null reference
    // exists.
    const mismatches: string[] = [];
    for (const [column, table, label, onlyWhenPresent] of [
      ['bookingId', 'booking_entity', 'booking', false],
      ['teamId', 'team_entity', 'team', true],
    ] as const) {
      const presence = onlyWhenPresent ? ` AND j."${column}" IS NOT NULL` : '';
      const [{ count }] = (await queryRunner.query(
        `SELECT COUNT(*)::int AS "count" FROM "cleaning_job_entity" j JOIN "${table}" p ON p."id" = j."${column}" WHERE p."tenantId" <> j."tenantId"${presence}`,
      )) as { count: number }[];
      if (count > 0) {
        mismatches.push(
          `${count} job(s) reference a ${label} outside the bootstrap tenant`,
        );
      }
    }
    if (mismatches.length > 0) {
      throw new Error(`AddJobChecklistTenant: ${mismatches.join('; ')}`);
    }

    for (const [table, fk] of [
      ['cleaning_job_entity', 'fk_cleaning_job_tenant'],
      ['checklist_entity', 'fk_checklist_tenant'],
    ] as const) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ALTER COLUMN "tenantId" SET NOT NULL`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${fk}" FOREIGN KEY ("tenantId") REFERENCES "tenant_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "cleaning_job_entity" ADD CONSTRAINT "uq_cleaning_job_id_tenant" UNIQUE ("id", "tenantId")`,
    );

    for (const [table, oldName, newName, column, parent, onDelete] of [
      ['cleaning_job_entity', 'fk_cleaning_job_booking', 'fk_cleaning_job_booking_tenant', 'bookingId', 'booking_entity', 'RESTRICT'],
      ['cleaning_job_entity', 'fk_cleaning_job_team', 'fk_cleaning_job_team_tenant', 'teamId', 'team_entity', 'RESTRICT'],
      ['checklist_entity', 'fk_checklist_job', 'fk_checklist_job_tenant', 'jobId', 'cleaning_job_entity', 'CASCADE'],
    ] as const) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${oldName}"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${newName}" FOREIGN KEY ("${column}", "tenantId") REFERENCES "${parent}"("id", "tenantId") ON DELETE ${onDelete} ON UPDATE NO ACTION`,
      );
    }

    await queryRunner.query(
      `CREATE INDEX "idx_cleaning_job_tenant_scheduled" ON "cleaning_job_entity" ("tenantId", "scheduledAt" DESC, "id")`,
    );
  }

  // Reverses 7 → 1, restoring the original id-only FKs under their
  // original names and ON DELETE actions (`AddCleaningJob`).
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_cleaning_job_tenant_scheduled"`);
    for (const [table, oldName, newName, column, parent, onDelete] of [
      ['checklist_entity', 'fk_checklist_job', 'fk_checklist_job_tenant', 'jobId', 'cleaning_job_entity', 'CASCADE'],
      ['cleaning_job_entity', 'fk_cleaning_job_team', 'fk_cleaning_job_team_tenant', 'teamId', 'team_entity', 'RESTRICT'],
      ['cleaning_job_entity', 'fk_cleaning_job_booking', 'fk_cleaning_job_booking_tenant', 'bookingId', 'booking_entity', 'RESTRICT'],
    ] as const) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${newName}"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${oldName}" FOREIGN KEY ("${column}") REFERENCES "${parent}"("id") ON DELETE ${onDelete}`,
      );
    }
    await queryRunner.query(
      `ALTER TABLE "cleaning_job_entity" DROP CONSTRAINT "uq_cleaning_job_id_tenant"`,
    );
    for (const [table, fk] of [
      ['checklist_entity', 'fk_checklist_tenant'],
      ['cleaning_job_entity', 'fk_cleaning_job_tenant'],
    ] as const) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${fk}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "tenantId"`);
    }
  }
}
```

Confirm during M6 that the migration is picked up by the data source's migrations glob, as `1790611200000-AddBookingTenant.ts` is.

- [ ] **Step 4: Domain + entities.**
   - `CleaningJob` and `Checklist` gain `tenantId: string`, with a comment citing I-1. Update the `CleaningJob` header comment: the job's tenant is its booking's.
   - `CleaningJobEntity`:
     - Add a `tenantId` column plus a `tenant` `@ManyToOne(() => TenantEntity, …)` with `@JoinColumn({ name: 'tenantId', foreignKeyConstraintName: 'fk_cleaning_job_tenant' })`. Copy the `PropertyEntity` shape.
     - On `booking`, replace `onDelete` / `foreignKeyConstraintName` with `createForeignKeyConstraints: false`.
     - Replace the header comment's FK sentence with the #82-style note: "the composite `fk_cleaning_job_booking_tenant` / `fk_cleaning_job_team_tenant` FKs are hand-written in `AddJobChecklistTenant`; `migration:generate` may propose dropping them or re-adding id-only FKs — do not apply that".
   - `ChecklistEntity`: add a `tenantId` column plus a `tenant` relation (`fk_checklist_tenant`), and the same note for `fk_checklist_job_tenant`.
   - `ChecklistItemEntity` is unchanged (Decision 2).
   - **ORM ownership of the three parent FKs (M5 finding 1; recon 2026-09-29):**

     | Constraint replaced | ORM mapping today | Action |
     | --- | --- | --- |
     | `fk_cleaning_job_booking` | `CleaningJobEntity.booking` `@ManyToOne` + `@JoinColumn({ foreignKeyConstraintName })` (TypeORM-owned) | `createForeignKeyConstraints: false`, keeping the relation (Relatable filters `jobs(filter: { booking })` need it) |
     | `fk_cleaning_job_team` | **none**: `teamId` is a plain `@Column` + `@Index()`; the FK exists only in the hand-written `AddCleaningJob` | No relation is added (adding one would make TypeORM own an id-only FK). Keep `teamId` a plain column. The entity comment names `fk_cleaning_job_team_tenant` as hand-written |
     | `fk_checklist_job` | **none**: `ChecklistEntity.jobId` is a plain `@Column`; the FK is hand-written in `AddCleaningJob` | Same: no relation added, and the comment names `fk_checklist_job_tenant` |

     Re-confirm this table at M6 start (`grep -n "ManyToOne\|JoinColumn" apps/api/src/modules/jobs/infrastructure/persistence/*.ts`). If a `team` or `job` relation has appeared since, give it `createForeignKeyConstraints: false` like `booking`.

- [ ] **Step 5: Cleanup helper.** In `removeTestTenants`, replace the booking-keyed job delete with a tenant-keyed one, still before the booking delete:

   ```ts
   // Jobs first: `fk_cleaning_job_booking_tenant` is ON DELETE RESTRICT;
   // their checklists/items go with them (`fk_checklist_job_tenant` and
   // `fk_checklist_item_checklist` are ON DELETE CASCADE). By #86's
   // composite FKs a test tenant's job can only reference that tenant's
   // booking/team.
   await dataSource.query(
     `DELETE FROM "cleaning_job_entity" WHERE "tenantId" = ANY($1)`,
     [ids],
   );
   ```

   Update the helper comment:
   - Remove the "`fk_cleaning_job_team` … id-only until #86 … callers creating such rows must delete them first" sentence. A job can no longer reference another tenant's team.
   - Keep the bootstrap-exclusion invariant unchanged.
   - Re-check at M6 with `grep -rn 'REFERENCES "cleaning_job_entity"' apps/api/src/platform/database/migrations` that no new RESTRICT reference to jobs exists.

- [ ] **Step 6: ORM drift check (M5 finding 1).**
   - **Baseline, recorded at M6 start on `main`:** migrate a fresh database with `pnpm --filter api migration:run`, then save the output of `pnpm --filter api typeorm schema:log`. Pre-existing drift, such as that noted in `ExtendPricingRuleEffectiveDating`, is expected there.
   - **After this task:** migrate a fresh database again, rerun `schema:log`, and diff the two outputs.
   - **Interpretation.** TypeORM's entity-vs-schema diff proposes dropping database constraints it has no metadata for. On `main` it already proposes dropping the hand-written `fk_cleaning_job_team` and `fk_checklist_job` (`ExtendPricingRuleEffectiveDating.ts:3-8`). Constraints this migration deliberately hand-writes will therefore appear as proposed drops. That is **expected drift**, not a defect. Classify every changed line in the diff into exactly one bucket:
     - **Expected (hand-written, not in entity metadata).** A proposed `DROP CONSTRAINT` of `fk_cleaning_job_booking_tenant`, `fk_cleaning_job_team_tenant`, `fk_checklist_job_tenant` or `uq_cleaning_job_id_tenant`, and a proposed `DROP INDEX` of `idx_cleaning_job_tenant_scheduled`. Also expected: the corresponding **disappearance** of the baseline's proposed drops of `fk_cleaning_job_booking` / `fk_cleaning_job_team` / `fk_checklist_job`, which no longer exist.
     - **Mapping defect (blocks the task).** A proposed add of an id-only FK `("bookingId") REFERENCES "booking_entity"`, `("teamId") REFERENCES "team_entity"` or `("jobId") REFERENCES "cleaning_job_entity"`. This means the `booking` relation still owns an FK, or a `team`/`job` relation was added. Also blocking: any proposal touching `fk_cleaning_job_tenant`, `fk_checklist_tenant` or either `tenantId` column. These are ORM-mapped through the `tenant` relations and `foreignKeyConstraintName`, so they must show **no** drift.
     - **Unexplained.** Anything else. Review each line. Unexplained differences block completion until they are fixed in the entity (never by editing the migration to match) or recorded with a reason.
   - **Constraint verification against the real database** (`schema:log` alone does not prove the constraints are right). On the freshly migrated database, query `pg_constraint`. It must show:
     - `fk_cleaning_job_booking_tenant` on `("bookingId", "tenantId") → booking_entity ("id", "tenantId")`, `confdeltype = 'r'`;
     - `fk_cleaning_job_team_tenant` on `("teamId", "tenantId") → team_entity ("id", "tenantId")`, `'r'`;
     - `fk_checklist_job_tenant` on `("jobId", "tenantId") → cleaning_job_entity ("id", "tenantId")`, `'c'`;
     - no FK on `cleaning_job_entity` or `checklist_entity` whose column list is only `bookingId`, `teamId` or `jobId`.

     Use `pg_get_constraintdef(oid)` for a readable check. Task 1 case 3 pins the same facts in the migration e2e.
   - Record both `schema:log` outputs, the classified diff and the constraint query results in the task report. A proposed drop of a deliberately hand-written constraint is not, by itself, evidence that the mapping or the migration is wrong.

- [ ] **Step 7: Run.** `pnpm --filter api test:e2e -- add-job-checklist-tenant` ⇒ PASS. `pnpm --filter api test` (unit) ⇒ PASS. TypeScript may now flag `CleaningJob` / `Checklist` literals in unit specs without `tenantId`; add `tenantId: 'tenant-1'` there. Other e2e suites are expected to fail until Task 4.

- [ ] **Step 8: Commit.** `git commit -m "feat(86): add job/checklist tenant ownership and composite parent FKs"`

---

### Task 2: `JobsService` tenant-scoped on every operation, audit-tagged

**Spec:** §4.4 (application validation), §4.5 (same predicate on services, batch lookups, mutations; cross-tenant = missing row), §4.6; Slice decisions 2, 6, 7, 8, 10; I-1, I-2.

**Files:**
- Modify: `apps/api/src/modules/jobs/application/commands/complete-checklist-item.command.ts`, `complete-job.command.ts` (+ `tenantId: string`, header comment in the style of `assign-team-to-job.command.ts` citing #86 Slice decision 9)
- Modify: `apps/api/src/modules/jobs/application/services/jobs.service.ts`
- Test: `apps/api/src/modules/jobs/tests/application/jobs.service.spec.ts`

**Interfaces:**
- Consumes: `CleaningJob.tenantId`, `Checklist.tenantId` (Task 1).
- Produces:
  - `CompleteChecklistItemCommand { actorId; jobId; itemId; tenantId: string }`;
  - `CompleteJobCommand { actorId; jobId; tenantId: string }`;
  - `getJob(id: string, tenantId: string | null): Promise<CleaningJob | null>`;
  - `listJobs(tenantId: string): Promise<CleaningJob[]>`;
  - `getChecklistsByJobIds(ids: string[], tenantId: string): Promise<Checklist[]>`;
  - `getChecklistItemsByChecklistIds(ids: string[], tenantId: string): Promise<ChecklistItem[]>`.

- [ ] **Step 1: Write failing unit tests** (extend the existing mocks):
   - **`createFromBooking({ actorId: 'u', bookingId: 'b1', tenantId: 't1' })`:**
     - the existing-job pre-check is `jobRepository.findOneBy({ bookingId: 'b1', tenantId: 't1' })`;
     - `manager.create(CleaningJobEntity, …)` and `manager.create(ChecklistEntity, …)` both include `tenantId: 't1'`;
     - items are created as today, with no `tenantId`;
     - the audit call is `{ actorId: 'u', entityId: <job id>, action: 'job.create', entityType: 'job', tenantId: 't1', scope: AdminScope.TENANT }`;
     - the existing `findOne('b1', 't1')` and conflict tests are kept.
   - **`assignTeam({ …, tenantId: 't1' })`:**
     - `manager.findOneBy(CleaningJobEntity, { id, tenantId: 't1' })`;
     - `manager.update(CleaningJobEntity, { id, tenantId: 't1' }, { teamId, updatedAt })`, and the SET has no `tenantId` key;
     - `findOneByOrFail(CleaningJobEntity, { id, tenantId: 't1' })`;
     - a `null` job ⇒ `NotFoundException` and no `update`;
     - the audit call is tagged.
   - **`completeJob({ actorId, jobId, tenantId: 't1' })`:** the job lookup, checklist lookup (`{ jobId, tenantId: 't1' }`), update WHERE and re-read carry `tenantId`, and the audit call is tagged.
   - **`completeChecklistItem({ …, tenantId: 't1' })`:**
     - job `{ id, tenantId }`;
     - checklist `{ jobId: job.id, tenantId: 't1' }`;
     - item `findOneBy(ChecklistItemEntity, { id: itemId, checklistId: checklist.id })`, a single query with no follow-up comparison;
     - an item lookup returning `null` ⇒ `NotFoundException('Checklist item … not found')` and no `update` calls;
     - a checklist lookup returning `null` ⇒ the same exception, and the item lookup is not called;
     - the job update WHERE is `{ id, tenantId: 't1' }`, and the audit call is tagged.
   - **Reads:**
     - `getJob('j1', 't1')` ⇒ `findOneBy({ id: 'j1', tenantId: 't1' })`;
     - `getJob('j1', null)` ⇒ `null` and no repository call;
     - `listJobs('t1')` ⇒ `find({ where: { tenantId: 't1' } })`;
     - `getChecklistsByJobIds([], 't1')` ⇒ `[]` with no call;
     - `getChecklistsByJobIds(['a'], 't1')` ⇒ `findBy({ jobId: In(['a']), tenantId: 't1' })`.
   - `getChecklistItemsByChecklistIds([], 't1')` ⇒ `[]` with no call; `getChecklistItemsByChecklistIds(['a', 'b'], 't1')` ⇒ `checklistItemRepository.findBy({ checklistId: In(['a', 'b']), checklist: { tenantId: 't1' } })`.
   - Replace the existing `getJob('missing-id')`, `listJobs()` and `getChecklistItemsByChecklistIds` tests with the scoped forms.

- [ ] **Step 2: Run** `pnpm --filter api test -- jobs.service` ⇒ FAIL.

- [ ] **Step 3: Implement** per Step 1 and Decisions 6, 7 and 10:
   - Import `AdminScope` from `platform/auth/domain/admin-scope`.
   - Refresh the stale comments: "`fk_cleaning_job_team` stays id-only until #86" becomes "application half of I-1; `fk_cleaning_job_team_tenant` is the database half". Remove "`cleaning_job_entity` stays unscoped by tenant until #86".
   - On `getChecklistItemsByChecklistIds`, add a comment citing Decisions 2 and 6: items have no tenant of their own and are scoped through the parent checklist's `tenantId` in the same query.

- [ ] **Step 4: Run** `pnpm --filter api test -- jobs.service` ⇒ PASS. The resolver and loaders will not compile until Task 3; run with `--testPathPattern jobs.service` for now.

- [ ] **Step 5: Commit.** `git commit -m "feat(86): scope JobsService by tenant and tag job audit events"`

---

### Task 3: GraphQL — `@Authorize`, `job(id)`, per-tenant checklist loader, mutations, relation regression

**Spec:** §4.5 (nestjs-query QueryService / ReadResolver / Relatable paths, relation resolvers, batch loaders, mutations); Slice decisions 5, 8, 9.

**Files:**
- Modify: `apps/api/src/modules/jobs/presentation/graphql/cleaning-job.type.ts`, `checklist.type.ts`, `job-relation.loaders.ts`, `job.resolver.ts`
- Test: `apps/api/src/modules/jobs/tests/graphql/job.resolver.spec.ts`, `job-relation.loaders.spec.ts`, `job-read.resolver.spec.ts`
- Create test: `apps/api/src/modules/jobs/tests/graphql/job-relations.authorization.spec.ts`

**Interfaces:**
- Consumes: Task 2 signatures.
- Produces: `JobRelationLoaders.checklistLoaderFor(tenantId: string | null)`; `createChecklistBatchFn(jobsService, tenantId: string | null)`.

- [ ] **Step 1: Failing tests.**
   - **`job-relation.loaders.spec.ts`:**
     - `createChecklistBatchFn(service, 't1')` calls `getChecklistsByJobIds(ids, 't1')` and maps by `jobId`, with `null` for misses;
     - `createChecklistBatchFn(service, null)` resolves every key to `null` with no service call;
     - `checklistLoaderFor('t1')` returns the same instance on repeat calls and a different instance for `'t2'`, the same shape as the existing `teamLoaderFor` tests.
   - **`job.resolver.spec.ts`:**
     - `job('j1', principal)` calls `getJob('j1', principal.tenantId)`, and a principal with `tenantId: null` calls `getJob('j1', null)`;
     - `checklist(job, principal)` uses `checklistLoaderFor(principal.tenantId)`;
     - `completeChecklistItem` / `completeJob` pass `tenantId: principal.tenantId`;
     - for each of the four mutations, a `tenantId: null` principal ⇒ `ForbiddenException`, and the service is not called.
   - **`job-read.resolver.spec.ts`:** add a tenant-authorizer `describe.each` over `[CleaningJobType, ChecklistType]`, copied from `apps/api/src/modules/catalog/tests/graphql/service-read.resolver.spec.ts:118-150`. It checks:
     - the authorizer is registered;
     - `{ req: { user: { tenantId: 't-a' } } }` ⇒ `{ tenantId: { eq: 't-a' } }`;
     - no `req.user` ⇒ `{ id: { is: null } }`.

     In the same spec, build the schema from `[JobReadResolver, ChecklistReadResolver, JobResolver]`, as the catalog spec does at `:66-77`. Assert that `CleaningJob`, `CleaningJobFilter`, `Checklist`, `ChecklistItem`, `CreateJobFromBookingInput`, `AssignTeamToJobInput`, `CompleteJobInput` and `CompleteChecklistItemInput` have no `tenantId` field. If building `JobResolver` in the schema factory requires unavailable providers, assert the input types from the resolver-free schema instead and record it.
   - **New `job-relations.authorization.spec.ts`** (own file: importing other modules' GraphQL types registers them globally):

```ts
// TEST-ONLY deep import, tied to the installed @ptc-org/nestjs-query-graphql
// 9.5.0 package layout (it does not re-export getRelations from the package
// root). Same pattern as #82-#85.
import { getRelations } from '@ptc-org/nestjs-query-graphql/src/decorators';
import { BookingDTO } from '../../../bookings/presentation/graphql/booking.dto';
import { PropertyType } from '../../../customers/presentation/graphql/property.type';
import { ChecklistItemType } from '../../presentation/graphql/checklist-item.type';
import { ChecklistType } from '../../presentation/graphql/checklist.type';
import { CleaningJobType } from '../../presentation/graphql/cleaning-job.type';

// #86 Slice decision 5 / Global constraints. nestjs-query gives a
// relation's own `auth` precedence over the target DTO's `@Authorize`, so an
// `auth` on any relation into a job/checklist type would bypass the tenant
// predicate. Planning-time inventory: nothing targets CleaningJob or
// Checklist; only Checklist.items targets ChecklistItem (owned via its
// Checklist, slice decision 2).
describe('Relations targeting CleaningJob / Checklist / ChecklistItem (tenant isolation, #86)', () => {
  it('matches the inventory, overrides no auth, and enables no relation mutations', () => {
    const targets = new Set<unknown>([
      CleaningJobType,
      ChecklistType,
      ChecklistItemType,
    ]);
    const owners = [
      ['CleaningJob', CleaningJobType],
      ['Checklist', ChecklistType],
      ['ChecklistItem', ChecklistItemType],
      ['Booking', BookingDTO],
      ['Property', PropertyType],
    ] as const;
    const found: string[] = [];
    for (const [ownerName, owner] of owners) {
      const { many = {}, one = {} } = getRelations(owner as never);
      for (const [relationName, relation] of Object.entries({ ...many, ...one })) {
        if (!targets.has(relation.DTO)) continue;
        found.push(`${ownerName}.${relationName}`);
        expect(relation.auth).toBeUndefined();
        expect(relation.update?.enabled).toBe(false);
        expect(relation.remove?.enabled).toBe(false);
      }
    }
    expect(found.sort()).toEqual(['Checklist.items']);
  });

  it('CleaningJob.booking keeps deferring to BookingDTO’s authorizer', () => {
    const { one = {} } = getRelations(CleaningJobType as never);
    expect(one.booking.auth).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run** `pnpm --filter api test -- jobs` ⇒ FAIL.

- [ ] **Step 3: Implement.**
   - `cleaning-job.type.ts` / `checklist.type.ts`: add `@Authorize(tenantReadAuthorizer<…>())` above `@QueryOptions`, using the #82 comment wording. The `ChecklistType` comment also states Decision 5's reasoning: no nestjs-query path reads checklists today, and `items` is unaffected because a relation's filter comes from the target DTO's authorizer.
   - `job-relation.loaders.ts`:
     - `createChecklistBatchFn(jobsService, tenantId)` with the null short-circuit and a comment mirroring `createJobTeamBatchFn`;
     - replace the `checklistLoader` field with a `checklistLoaders` map and `checklistLoaderFor(tenantId)`;
     - update the class comment: one DataLoader per tenant id for both teams and checklists.
   - `job.resolver.ts`:
     - `job(id, @CurrentUser() currentUser)` ⇒ `getJob(id, currentUser.tenantId)`;
     - `checklist(job, @CurrentUser() currentUser: AuthenticatedPrincipal | undefined)` ⇒ `checklistLoaderFor(currentUser?.tenantId ?? null).load(job.id)`, keeping the existing `toChecklistType(checklist!)`. A job reached through a tenant-scoped path has a same-tenant checklist by `fk_checklist_job_tenant` and the create transaction;
     - `completeChecklistItem` / `completeJob` pass `tenantId: requireTenantId(currentUser)`.

- [ ] **Step 4: Run** `pnpm --filter api test` (whole unit suite) ⇒ PASS, and `pnpm --filter api build` ⇒ PASS (all call sites compile).

- [ ] **Step 5: Commit.** `git commit -m "feat(86): tenant-authorize job/checklist reads and scope job mutations"`

---

### Task 4: Existing e2e suites follow the new contract

**Spec:** RFC §4.5; Slice decisions 5, 8. No product change: this task brings existing tests in line with Tasks 1–3 and replaces the interim cases #83 and #85 marked "#86".

**Files (verify at M6 start with `grep -rln "CleaningJobEntity\|ChecklistEntity\|jobsService\.\|#86" apps/api/test`):**
- Modify: `apps/api/test/jobs.service.e2e-spec.ts`, `jobs.e2e-spec.ts` (only if it fails), `teams-cleaners.tenant-isolation.e2e-spec.ts`, `bookings.tenant-isolation.e2e-spec.ts`

- [ ] **Step 1: Run** `pnpm --filter api test:e2e` and list the failures. Every failure must be one of:
   - (a) a direct `CleaningJobEntity` / `ChecklistEntity` insert without `tenantId`;
   - (b) a direct `JobsService` call with the old signature;
   - (c) an interim "B can name A's job" expectation.

   Any other failure is a defect in Tasks 1–3: stop and fix it there.

- [ ] **Step 2: (a)/(b) `jobs.service.e2e-spec.ts`.**
   - Pass `TENANT_ID` (the suite's bootstrap constant) as the new `tenantId` argument or command field, including the four `getChecklistItemsByChecklistIds` calls.
   - Add one real-Postgres case: `getChecklistItemsByChecklistIds([checklist.id], <a createTestTenant() id>)` ⇒ `[]`, proving the join-through-parent predicate in SQL, not only in mocks. Remove that tenant with `removeTestTenants` in `afterAll`.
   - Add `tenantId: TENANT_ID` to any direct job or checklist insert.
   - Keep every assertion. Where the suite asserts audit rows, extend the `job.*` rows to expect `tenantId: TENANT_ID` and `scope: 'TENANT'`.

- [ ] **Step 3: (a)/(c) `teams-cleaners.tenant-isolation.e2e-spec.ts`.**
   - The direct `jobRepository.create({...})` fixture gains `tenantId: tenantA`.
   - "CleaningJob.team is null for another tenant's team" becomes "B cannot see A's job":
     - as B, `job(id)` ⇒ no errors, `data.job: null`;
     - as A ⇒ `{ id: job.id, team: { id: teamA.id } }`.
   - "assignTeamToJob with another tenant's team is 404": update the comment. The job is now tenant-scoped, so B naming A's job is a missing job (Decision 8). Keep the assertions. The own-job/other-tenant-team case moves to Task 5.
   - Refresh the fixture comment at the "Booking/Job" block: the job is tenant-owned as of #86.

- [ ] **Step 4: (c) `bookings.tenant-isolation.e2e-spec.ts`.** Cases 10 and 10b ("known residual exposure — closed by #86") become "B cannot see A's job":
   - as B, `job(id: jobA) { id booking { id customer { id } } }` ⇒ no errors, `data.job: null`, and the serialized body contains neither `bookingA.id` nor `customerA.id`;
   - 10b keeps the sibling `bookings { … }` root and asserts the same;
   - positive control: as A, the same query returns `booking.id = bookingA.id`.

- [ ] **Step 5: Run** `pnpm --filter api test:e2e` ⇒ all green, except the pre-existing `main` failures recorded at M6 start.

- [ ] **Step 6: Commit.** `git commit -m "test(86): align e2e fixtures and interim cases with tenant-owned jobs"`

---

### Task 5: Two-tenant jobs & checklists isolation e2e (acceptance)

**Spec:** RFC §4.4, §4.5, §4.6, §4.9; Slice decisions 2–10; "Residual exposures closed".

**Files:**
- Create: `apps/api/test/jobs-checklists.tenant-isolation.e2e-spec.ts`

**Interfaces:**
- Consumes: everything above. The setup mirrors `bookings.tenant-isolation.e2e-spec.ts`: `AppModule`, `cookieParser`, `applyPlatformPipes`, `createTestTenant` ×2, `seedTenantAdmin(TENANT_OWNER)` per tenant, `seedSuperAdmin`, `loginAs`, `gql` and `errorStatus` (copy these helpers verbatim from that file).
- Fixtures go through the application services. Per tenant, create one customer + property, one active-priced service, one team (`teamA`, `teamB`), and one booking with its team (`bookingA`, `bookingB`) via `BookingsService.create`. Then create one job per tenant via GraphQL `createJobFromBooking` as that tenant's owner (`jobA`, `jobB`). Read `checklistA` / `itemA0` and `checklistB` from the repositories.
- `afterAll` deletes the audit rows it can attribute, then calls `removeTestTenants`.

- [ ] **Step 1: Write the suite.** Numbered cases, each a `describe` or `it`:
  1. **Root scoping.**
     - As B, `jobs(filter: { id: { in: [jobA, jobB] } }) { totalCount nodes { id } }` ⇒ only `jobB`, `totalCount: 1`. As A ⇒ only `jobA`.
     - As B, `job(id: jobA.id) { id }` ⇒ no errors, `data.job: null`, identical to `job(id: <random uuid>)`.
  2. **Relation-filter oracle (closes #85 residual).** For each of the following filters, as B ⇒ `nodes: []`, `totalCount: 0`; as A ⇒ `jobA`, `totalCount: 1`:
     - `{ booking: { id: { eq: bookingA.id } } }`
     - `{ booking: { status: { eq: <bookingA.status> } }, id: { eq: jobA.id } }`
     - `{ booking: { scheduledAt: { eq: <bookingA.scheduledAt> } } }`
     - `{ or: [ { booking: { id: { eq: bookingA.id } } }, { id: { eq: jobA.id } } ] }`

     Use `it.each`. If a field is not filterable on `BookingDTO`, drop that row and record it in the task report. `id` rows always stay.
  3. **Nested paths (closes #85 residual).** As B, `job(id: jobA.id) { id booking { id } team { id } checklist { id items { nodes { id } } } }` ⇒ no errors and `data.job: null`. The body contains none of `bookingA.id`, `teamA.id`, `checklistA.id`, `itemA0.id`. As A, the same query returns all of them, including three items.
  4. **Cross-tenant job mutations (Decision 8).** As B, each of the following ⇒ 404:
     - `assignTeamToJob({ jobId: jobA.id, teamId: teamB.id })`;
     - `completeChecklistItem({ jobId: jobA.id, itemId: itemA0.id })`;
     - `completeJob({ id: jobA.id })`.

     Afterwards, a repository read shows `jobA` with its status, `teamId` and `updatedAt` unchanged, and `itemA0.completed` still `false`.
  5. **Mixed ids (Decision 7, Review Focus 1).** As B:
     - `completeChecklistItem({ jobId: jobB.id, itemId: itemA0.id })` ⇒ 404, `itemA0` unchanged, and `jobB` status unchanged;
     - `assignTeamToJob({ jobId: jobB.id, teamId: teamA.id })` ⇒ 404 and `jobB.teamId` unchanged.
  6. **Create from booking (Decision 6).** Covered here to pin tenant persistence:
     - Create a second booking for B and run `createJobFromBooking` on it as B.
     - The repository shows the job's and its checklist's `tenantId` equal to `tenantB`.
     - `createJobFromBooking({ bookingId: bookingA.id })` as B ⇒ 404, and no second job for `bookingA`.
  7. **Spoofing (I-2, Review Focus 5).** As B:
     - `jobs(filter: { tenantId: { eq: tenantA } })` ⇒ GraphQL validation error;
     - `jobs(filter: { or: [{ id: { eq: jobA.id } }, { id: { is: null } }] }) { totalCount nodes { id } }` ⇒ `nodes: []`, `totalCount: 0`;
     - `gql(...)` with an added `x-tenant-id: tenantA` header running `jobs { nodes { id } }` ⇒ only B's rows;
     - `createJobFromBooking(input: { bookingId: <B's>, tenantId: tenantA })` ⇒ GraphQL validation error, no row.
  8. **Role boundary.** The Super Admin cookie on `jobs`, `job(id)` and each of the four mutations ⇒ 403 (role, RFC §4.2), with no A or B data in the body.
  9. **Audit (Decision 10).** As A, run `assignTeamToJob` (A's own team), `completeChecklistItem` for each of A's three items, and `completeJob` on `jobA`. Then the `audit_event_entity` rows with `entityType = 'job'` and `entityId = jobA.id` include actions `job.create`, `job.assign_team`, `job.checklist_item.complete` (×3) and `job.complete`. All of them have `tenantId = tenantA`, `scope = 'TENANT'` and `actorId` = A's owner. Keying `job.checklist_item.complete` on the job id asserts the existing convention (Decision 10, verified at M5), not a new one. If M6 finds the convention differs, assert the existing one and keep the tenant/scope assertions. This case runs **after** cases 4–5, which require `jobA` to be incomplete; order the `describe`s accordingly.
  10. **Database backstop (I-1 database half).** Each insert below rejects with `QueryFailedError` whose `driverError.constraint` names the given FK:
      - `cleaning_job_entity` insert with `tenantId: tenantB` and `bookingId` = a B booking with no job, but `teamId: teamA.id` ⇒ `fk_cleaning_job_team_tenant`;
      - `tenantId: tenantB` and `bookingId: bookingA.id` ⇒ `fk_cleaning_job_booking_tenant`. `UQ_cleaning_job_booking_id` would also fire, since `bookingA` already has a job, so use a fresh A booking without a job;
      - `checklist_entity` insert with `tenantId: tenantB` and `jobId: jobA.id` ⇒ `fk_checklist_job_tenant`.

- [ ] **Step 2: Run** `pnpm --filter api test:e2e -- jobs-checklists.tenant-isolation` ⇒ PASS. It is expected to pass on the first run because it verifies Tasks 1–4. If a case fails, fix the owning task's code, never the assertion, and record the fix in the task report.

- [ ] **Step 3: Commit.** `git commit -m "test(86): two-tenant jobs and checklists isolation e2e"`

---

### Task 6: Documentation touch-points and final verification

**Spec:** process §2.8; RFC tracking row.

**Files:**
- Modify: `docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md`, tracking row only: add "Jobs & Checklists slice: #86 (PR …)" and move #86 out of "Remaining slices". This is a tracking-field update, not a design change.
- Modify: stale `#86` comments found by `grep -rn "#86" apps/api/src apps/api/test` that describe a now-false interim state, for example `booking.entity.ts` ("target of #86's cleaning-job composite FK" becomes a present-tense description). Do not edit applied migration files (`AddTeamCleanerTenant`, `AddBookingTenant`).
- Modify: `README.md` only if it describes jobs as unscoped (check it; expected no change).

- [ ] **Step 1: Comments and tracking.** Apply the edits above.
- [ ] **Step 2: Final gate.**
  - `pnpm --filter api lint`
  - `pnpm --filter api test`
  - `pnpm --filter api test:e2e`
  - `pnpm --filter api build`
  - `migration:run` against a fresh database (`pnpm --filter api migration:run`, per README)
  - `migration:revert` once on that database, then `migration:run` again. `down` restores the original FK names and `ON DELETE` actions without losing rows; Task 1 case 6 is the precise check
  - the `schema:log` drift classification and `pg_constraint` verification of Task 1 Step 6, rerun on the final branch
  - `git diff --stat main -- apps/web packages` ⇒ empty
  - the generated GraphQL schema diff against `main` ⇒ **empty**

  Compare e2e results against the baseline failures recorded on `main` at M6 start (TDD / verification strategy). Record all outputs for the M6 Slice Completion Report.
- [ ] **Step 3: Commit.** `git commit -m "docs(86): document job/checklist tenant isolation; refresh stale #86 comments"`

---

## Traceability

| RFC | Tasks |
| --- | --- |
| §4.2 principal-only tenant, no Super Admin bypass | 2, 3, 5 (cases 7, 8) |
| §4.4 CleaningJob / Checklist tenant-owned; job → booking same-tenant; `(id, tenantId)` uniqueness; `UQ_cleaning_job_booking_id` retained | 1, 2, 5 (cases 5, 6, 10) |
| §4.5 predicate on services, nestjs-query, relations, loaders, mutations; filters cannot widen; missing-row semantics | 2, 3, 4, 5 (cases 1–7) |
| §4.6 tenant-scoped audit | 2, 5 (case 9) |
| §4.7 backfill before NOT NULL | 1 |
| #85 residual exposures naming #86 | 3, 4, 5 (cases 2, 3) |

## Execution risks

- **Coupled task window (Tasks 1–4).** e2e is red between Task 1 and Task 4. Unit tests and `tsc` gate each task. Do not merge a partial branch.
- **Leftover dev data.** A developer database holding jobs on non-bootstrap bookings (#85 two-tenant fixtures that were not cleaned up) makes `AddJobChecklistTenant` abort by design (Decision 11). The fix is to delete those jobs and re-run. Mention this in the PR description.
- **`migration:generate` drift.** The composite FKs are hand-written, as in #82–#85, so `schema:log` / `migration:generate` will propose dropping them. That is expected and classified in Task 1 Step 6, never applied. The entity comments warn against applying generated drops (Task 1 Step 4).
