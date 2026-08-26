# Jobs & Checklists: Implementation Plan

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-08-27 |
| **Tracking** | [#6](https://github.com/rexescario-dev/clensy-platform/issues/6) (milestone M7 — Jobs & Checklists) |
| **Package/repo scope** | `apps/api` (new: `modules/jobs/**`; modified: `modules/bookings/bookings.module.ts` export, `BookingsService.getBookingsByIds` + `remove` `23503` translation, `app/app.module.ts`, `platform/database/data-source.ts`); `apps/web` (new: `/app/jobs`; modified: `components/app-shell/sidebar.tsx`, `app/app/bookings/page.tsx`); `packages/client` (new operation documents + regenerated codegen). No REST. No seed. |
| **Depends on (Accepted)** | [Jobs & Checklists Specification](../specs/2026-08-27-jobs-checklists-design.md) — Status: **Accepted**, 2026-08-27 (M3 round 2). Also relies on already-Accepted [Admin Foundation](../specs/2026-08-14-admin-foundation-design.md) (`AuthGuard`, `@Roles()`, `@CurrentUser()`, `AuditLogger` / `runAuditInTransaction`), [Cleaners & Teams](../specs/2026-08-16-cleaners-teams-design.md) (`TeamsService.getTeam` / `getTeamsByIds`, `assignCleanerToTeam` same-state/audit precedent, request-scoped DataLoader already in this repo), [Bookings](../specs/2026-08-22-bookings-design.md) (`BookingsService.findOne` / `findAll`, `BookingStatus`, `removeBooking` success/not-found unchanged except the additive FK error), [Dashboard UX Foundation](../specs/2026-08-17-dashboard-ux-foundation-design.md) (`DataTable`, `FormDialog`, `DetailDrawer`, `/app/*` shell, `?detail=`). None of that is re-implemented here. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M4 |
| **Revision note** | M5 round 1 (reviewer: project owner) returned for plan-executability tightening, not a redesign. Architecture/task split approved. Required: Jobs GraphQL must not take Catalog/Customer persistence dependencies — nested `Booking.customer/property/service` uses existing Bookings resolvers/loaders; Task 4 DI test must not register those entities. Clarify loader ownership (Jobs wires resolvers; cross-module loaders only call existing bulk service methods). Make `listJobs()` a plain `find()` with no invented ordering. Explicit Task 3 transaction boundaries for complete-item / complete-job (aggregate-local reads inside the tx; `getTeam` before the tx). Fix `booking.fullName?` to the real Booking schema. Schema tests include computed-field nullability. Verify named FKs/uniques in Task 2. Also applied: `updatedAt` init as creation activity; Task 1 preserves existing `remove` audit contract (only adds `23503` mapping); unit-test helper uses a minimal fake error shape, real Postgres proves TypeORM's path; `teamId` `@Index()` is the nullable-FK indexing convention, not a list-by-team query. M5 round 2 (reviewer: project owner): all required and recommended items confirmed present; no remaining architecture drift; no M3 specification change required. **Accepted.** |
| **M5 decision** | **Accepted** — 2026-08-27. Round-1 tightenings verified. Ready for M6 Implementation. |

Where this plan and the Accepted specification disagree, the specification wins and this plan must be revised.

This plan **does not add product semantics**. File names, task order, DataLoader vs. equivalent batching, and helper names are M4 choices. The O(1)-in-N query invariant, unique-constraint name `UQ_cleaning_job_booking_id`, status matrix, and other SHALL items below are the spec.

## 1. Delivery intent

Implement exactly what the Accepted specification authorizes: new `modules/jobs` (`CleaningJob` aggregate → `Checklist` → `ChecklistItem`); explicit `CreateJobFromBooking` (not a booking-create hook); `AssignTeamToJob`; `CompleteChecklistItem` / `CompleteJob`; GraphQL-only surface with O(1)-in-N relation loading; `/app/jobs` plus a bookings-drawer Create/View job action; additive Bookings export + `getBookingsByIds` + `remove` FK `23503` translation. No Quality, no Dashboard, no REST, no seed, no write-back to `Booking.status`.

## 2. Constraints (SHALL / SHALL NOT)

**SHALL** (traced to spec — product contracts, not this plan's taste):

- `CleaningJob` holds `bookingId` (immutable, unique — constraint **`UQ_cleaning_job_booking_id`**), `teamId` (nullable), `scheduledAt` (immutable snapshot), `status`, `createdAt`, `updatedAt` (§4.1).
- Creation copies `scheduledAt` and `teamId` from the `Booking` observed by `BookingsService.findOne`. That observation is the snapshot; no cross-module lock/2PC/SELECT FOR UPDATE on `booking_entity` from Jobs (§4.2).
- Copied `teamId` is a **team snapshot**, not `job.assign_team` (§3, §4.2, §4.4).
- `AssignTeamToJob` is the only post-create mutation of `teamId`; `teamId` is required (no unassign) (§4.2).
- Checklist created with the job always contains **exactly three** items, positions `0,1,2`, labels Arrive on site / Complete assigned work / Final walkthrough (§4.1). `position` uniqueness is the creation algorithm; **no** `(checklistId, position)` unique index (§4.1).
- `CreateJobFromBooking` is one transaction: job + checklist + three items + `job.create` audit. Any failure rolls back all; a partial job is never observable (§4.2).
- `JobStatus` transitions are exactly the matrix in spec §4.1. Last item complete does not set `COMPLETED`. `PENDING → COMPLETED` is impossible through the API.
- `getJob(id)` / GraphQL `job(id)` return `null` when missing. Mutations throw `NotFoundException(\`Job ${id} not found\`)` and MUST NOT leak `getJob`'s null (§4.2, §4.5).
- Cancelled booking → `BadRequestException('Cannot create a job from a cancelled booking')`. **COMPLETED booking → create succeeds** (§4.2, §2 tests).
- Duplicate `bookingId` → `ConflictException('A job already exists for this booking')`. Postgres `23505` is translated to that message **only** when `constraint === 'UQ_cleaning_job_booking_id'` (§4.2, §4.7).
- `updatedAt` records successful mutation **activity**, including same-state assign / complete-item / complete-job (§4.1). Creation is the first successful mutation: initialize `createdAt` and `updatedAt` to the same timestamp; later successful invocations update `updatedAt` only.
- `CompleteJob` success: `status → COMPLETED`, `updatedAt → now`, audit `job.complete` (§4.2).
- GraphQL operations exactly: `job`, `jobs`, `createJobFromBooking`, `assignTeamToJob`, `completeChecklistItem`, `completeJob` — all take input objects as spec §4.5. No raw `bookingId`/`teamId` fields on `CleaningJob` type.
- N+1: `jobs { booking { id } team { name } checklist { items { label } } }` over N jobs is **O(1) in N**. Required batching: jobs→bookings, jobs→teams, jobs→checklists, checklists→items. `1 + N checklist + 1 items` is non-compliant (§4.5).
- RBAC / audit actions exactly spec §4.3 / §4.4. GraphQL-only; every operation `AuthGuard`.
- `BookingsModule` exports `BookingsService`. `getBookingsByIds` empty-array short-circuit, return only found rows (§2).
- `BookingsService.remove`: success/not-found unchanged; Postgres `23503` → `ConflictException('Booking cannot be deleted because other records reference it')` — additive Bookings error contract for GraphQL **and** REST, because they share this method (§2, §4.1).
- FKs hand-added, no TypeORM relation decorator on `bookingId`/`teamId`. `bookingId`/`teamId` `ON DELETE RESTRICT`. Checklist/item CASCADE (§4.1).
- Tests listed in spec §2, including concurrent create, completed-booking create, snapshot immutability after `updateBooking`, create rollback, FK `removeBooking`, N+1 O(1), RBAC.

**SHALL NOT** (spec §2 / §7 — do not invent):

- No REST for jobs. No job seed. No `createBooking` hook. No write-back to Booking. No second `CleaningJob` per booking. No `CancelJob`/`UpdateJob`/`DeleteJob`/unassign/reschedule. No Quality/Dashboard. No checklist templates or client-supplied labels. No `jobByBookingId`. No job-level progress field. No pagination/search. No availability checking. No cleaner-level assignment. No cross-module transaction. No new `packages/ui` primitive. No middleware matcher edit.

## 3. Implementation decisions (M4 choices)

These are **not** new product rules. They exist so M6 does not choose alone. If a later M5 review prefers a different mechanism that still satisfies the spec, swap the mechanism — do not change the SHALL list.

- **N+1 mechanism = existing request-scoped DataLoader pattern**, not a new architecture. The spec's invariant remains **O(1) in N**; DataLoader is how this codebase already implements that class of invariant (`BookingRelationLoaders`, `CleanerTeamLoaders`, `ActivePricingLoader`). Do not introduce a second batching style (resolver-level `Promise.all` over singular gets, Nest plugins, etc.).
- **Loader ownership (dependency direction).** `JobRelationLoaders` (`presentation/graphql/job-relation.loaders.ts`, `Scope.REQUEST`) is owned by `JobsModule` and is the resolver-facing wiring for `CleaningJob` fields. It does **not** reimplement Bookings' or Cleaners' loaders, and it does **not** access foreign repositories.
  - `bookingLoader` → **only** `BookingsService.getBookingsByIds`. The returned object is mapped with Bookings' existing `toBookingType`. Nested `Booking.customer` / `property` / `service` / `team` are resolved by the **already-registered `BookingResolver` field resolvers and `BookingRelationLoaders`** (AppModule already imports `BookingsModule`). Jobs does not load customers, properties, or services.
  - `teamLoader` → **only** `TeamsService.getTeamsByIds` (job's own `teamId` snapshot/assignment, spec §4.5).
  - `checklistLoader` / `itemsLoader` → `JobsService.getChecklistsByJobIds` / `getChecklistItemsByChecklistIds` (Jobs-owned aggregate).
  `BookingRelationLoaders` / `CleanerTeamLoaders` are not exported from their modules; Jobs does not import them. Creating Jobs-owned wrappers that **delegate to bulk application contracts** is not a second booking/team loader implementation.
- **Batch functions live on `JobsService`**, matching `TeamsService.getTeamsByIds`: `getChecklistsByJobIds(ids: string[]): Promise<Checklist[]>` and `getChecklistItemsByChecklistIds(ids: string[]): Promise<ChecklistItem[]>`. Empty `ids` → `[]` without querying. Return only rows found; loaders gap-fill. Checklists returned **without** items (items are a second batch).
- **`23505` inspection** uses TypeORM `QueryFailedError.driverError` (`code` + `constraint`). Helper `isPostgresUniqueViolation(error, 'UQ_cleaning_job_booking_id')` in `jobs.service.ts`. Any other unique violation is rethrown, not remapped. Task 2's level-2 test MUST assert a real insert against `UQ_cleaning_job_booking_id` produces this message (not only the application pre-check).
- **`23503` on `BookingsService.remove`** catches `QueryFailedError.driverError.code === '23503'` **regardless of constraint name** (spec: generic message for any RESTRICT, including a future Quality FK). Do not import Jobs. Wrap `manager.remove` in try/catch; rethrow non-23503.
- **Table names** stay TypeORM defaults: `cleaning_job_entity`, `checklist_entity`, `checklist_item_entity`. Constraint names: `UQ_cleaning_job_booking_id` (spec), `UQ_checklist_job_id` (M4 name for 1:1 `checklist.jobId`), `fk_cleaning_job_booking`, `fk_cleaning_job_team`, `fk_checklist_job`, `fk_checklist_item_checklist`.
- **No `@Index()` on `bookingId`** — the unique constraint already indexes it. `teamId` keeps `@Index()` as the existing convention for nullable foreign-key identifier columns (`CleanerEntity.teamId`). That is not a list-by-`teamId` query and does not add a filter contract.
- **No TypeORM relation decorators** on any of the four FKs (including intra-module `jobId` / `checklistId`), so `migration:generate` does not invent relations. Hand-add all four FKs + two uniques in the migration. Trim generated output of spurious drops of other modules' hand-added FKs (same cleanup `AddPricingRule` / bookings migration already do).
- **`DEFAULT_CHECKLIST_ITEMS`** is a const in `modules/jobs/domain/default-checklist-items.ts` — the only source of labels/positions. `JobsService.createFromBooking` maps it; tests import the same const rather than duplicating strings.
- **`JobsService` method names** (spec left them open): `createFromBooking`, `assignTeam`, `completeChecklistItem`, `completeJob`, `getJob`, `listJobs`. Commands: `CreateJobFromBookingCommand`, `AssignTeamToJobCommand`, `CompleteChecklistItemCommand`, `CompleteJobCommand`.
- **`listJobs()`** is `this.jobRepository.find()` — full set, no filter, no pagination, **no ORDER BY this plan invents**. It returns `CleaningJob` rows only (scalars + FK ids). `booking` / `team` / `checklist` are GraphQL loader fields, never eagerly loaded here.
- **Mutations load via `manager.findOneBy` inside the transaction** (not `getJob()`), then throw `NotFoundException` — keeps query-vs-mutation null/throw split.
- **`assignTeam` / `completeJob` / same-state complete-item use `manager.update()`**, not `save()`, so same-state calls still persist and bump `updatedAt` (Cleaners/Bookings lesson). Complete-item that flips incomplete→complete updates the item (`completed`, `completedAt`) and the job (`status` if first, always `updatedAt`) in the same transaction.
- **Cross-module reads before the transaction** for create (`BookingsService.findOne`) and assign (`TeamsService.getTeam`). Those calls MUST NOT run inside `dataSource.transaction`. Create does not call `getTeam` (spec §4.2 step 4).
- **`JobsModule` does not export `JobsService`** — nothing in this slice consumes it (Bookings did not export until Jobs needed it). Quality/Dashboard will add the export when they exist. Runtime `imports`: `AuditModule`, `BookingsModule`, `CleanersModule` only — not `CustomersModule` or `CatalogModule`.
- **Error messages** interpolated-id for `NotFoundException`; spec prose verbatim for `BadRequestException` / `ConflictException`.
- **No new npm dependency.** `dataloader` already approved.
- **Web** mirrors `/app/bookings`: one page, `useDetailDrawer`, `FormDialog` create, `DetailDrawer` execute. Booking `<select>` is raw `<select>` + `<label htmlFor>`. Checklist progress = `items.filter(i => i.completed).length + ' / ' + items.length` client-side. On create success: close dialog, `jobsQuery.refetch()`, `openDetail(newId)`. Bookings drawer: if some job's `booking.id === booking.id` show View job (`router.push('/app/jobs?detail='+id)`), else Create job then navigate. Both pages will request `jobs { booking { id } }` — acceptable because lists are unpaginated (spec §4.5/§4.6).
- **Lock key** for level-2 truncation: `JOB_DB_TEST_LOCK_KEY = 836_551_204` (must not collide with existing admin/customer/cleaner/catalog/booking keys).

## 4. Ownership boundaries

| Owns (this slice) | Must remain untouched |
| --- | --- |
| `apps/api/src/modules/jobs/**` (new) | `modules/quality/**`, `modules/dashboard/**` (do not exist; out of scope) |
| `BookingsModule.exports`, `BookingsService.getBookingsByIds`, `BookingsService.remove` 23503 catch | Bookings domain, GraphQL operation names, REST routes, validation chain, pricing snapshot |
| `app/app.module.ts` (`JobsModule` import), `data-source.ts` (three new entities) | Auth/audit/catalog/customers/cleaners contracts |
| `apps/web/app/app/jobs/page.tsx`, `sidebar.tsx` Operations item, `bookings/page.tsx` Create/View job | Other `/app/*` pages, `middleware.ts`, `packages/ui` |
| `packages/client/src/operations/jobs.graphql` + codegen | Other operation documents' contracts |

## 5. Contract inventory (only what the Accepted spec authorizes)

- Domain: `CleaningJob`, `JobStatus`, `Checklist`, `ChecklistItem`, `DEFAULT_CHECKLIST_ITEMS`
- GraphQL: `job(id): CleaningJob`, `jobs: [CleaningJob!]!`, `createJobFromBooking(input)`, `assignTeamToJob(input)`, `completeChecklistItem(input)`, `completeJob(input)`
- `CleaningJob` type: `id`, `scheduledAt`, `status`, `createdAt`, `updatedAt`, computed `booking: Booking!`, `team: Team`, `checklist: Checklist!`
- `Checklist`: `id`, `items: [ChecklistItem!]!`
- `ChecklistItem`: `id`, `label`, `position`, `completed`, `completedAt`
- Inputs: `CreateJobFromBookingInput { bookingId }`, `AssignTeamToJobInput { jobId, teamId }`, `CompleteChecklistItemInput { jobId, itemId }`, `CompleteJobInput { id }`
- Internal (not GraphQL): `getBookingsByIds`, `getChecklistsByJobIds`, `getChecklistItemsByChecklistIds`
- Additive Bookings: module export; `remove` `23503` → ConflictException (GraphQL + REST)

## 6. Slice sequence

```text
1. Bookings additive — export, getBookingsByIds, remove 23503     (independent)
2. Jobs core — domain, migration, JobsService create/get/list
   + uniqueness + atomicity + snapshot                             (independent of 1)
3. Jobs mutations — assignTeam, completeChecklistItem, completeJob (depends on 2)
4. GraphQL + JobRelationLoaders + JobsModule + AppModule           (depends on 1, 2, 3)
5. packages/client + /app/jobs + bookings drawer + sidebar         (depends on 4)
6. E2E acceptance                                                  (depends on 1–5)
```

Tasks 1 and 2 can proceed in parallel. Task 3 needs Task 2's entities. Task 4 needs Bookings export + JobsService batch methods (Task 2 adds the jobs-side batch methods even though GraphQL is Task 4).

## 7. TDD / verification strategy

Three levels, same as Catalog/Bookings:

1. **Mocked unit tests** — `JobsService` branching (each exception), constraint-scoped `23505` helper (minimal fake `{ code, constraint }`, not a reconstructed TypeORM class), batch methods' empty-array / subset-return, `JobRelationLoaders` batch functions' order/gap-fill, `getBookingsByIds`, `BookingsService.remove` 23503 vs other errors (helper-level). Existing `remove` audit behavior is not re-specified here.
2. **Real-Postgres service tests** — `apps/api/test/jobs.service.e2e-spec.ts` + `helpers/job-db-test-lock.ts`. Instantiates `JobsService` / `BookingsService` against a real `DataSource`; fake `auditLogger`. Covers: create from PENDING/CONFIRMED/**COMPLETED**; reject CANCELLED; copy snapshot; `updateBooking` does not mutate job; exactly three items; unique pre-check + real `UQ_cleaning_job_booking_id` race; concurrent creates → one winner + specified ConflictException; audit/item failure rolls back (no leftover job row); assign/complete-item/complete-job matrix; same-state activity `updatedAt`+audit; `remove` of a booking-with-job → specified ConflictException (this is the proof of TypeORM's real `23503` shape). Also asserts the migration constraints exist with the names in §3 (see Task 2).
3. **GraphQL e2e** — `apps/api/test/jobs.e2e-spec.ts` against `AppModule`: golden path booking → job → all items → completeJob; RBAC matrix; `job(id)` null vs mutation NotFound; N+1 spies (`getBookingsByIds`, `getTeamsByIds`, `getChecklistsByJobIds`, `getChecklistItemsByChecklistIds` each `toHaveBeenCalledTimes(1)` **and** invoked with the complete set of N ids). Unique-per-run fixtures; no truncation.

Web: no automated suite (Phase 1 Design §7). Task 5 has a short manual checklist.

## 8. Traceability (spec → task)

| Spec contract | Task |
| --- | --- |
| Export `BookingsService`, `getBookingsByIds` | 1 |
| `removeBooking` `23503` → ConflictException (GraphQL+REST) | 1, 2 (service proof), 6 (GraphQL) |
| Domain + migration + named FKs/uniques (`UQ_*`, RESTRICT/CASCADE) | 2 |
| `CreateJobFromBooking` atomic + snapshot + cancelled/completed + uniqueness + constraint-scoped 23505 + concurrent create + rollback | 2 |
| `getJob` null / `listJobs` (plain `find()`, no order) | 2 |
| `AssignTeamToJob`, complete item/job, status matrix, same-state `updatedAt` | 3 |
| GraphQL surface, no raw FKs, query vs mutation missing-job, computed-field nullability | 4 |
| N+1 O(1) including job→checklist and checklist→items | 4 (loaders), 6 (spy proof) |
| RBAC / audit action names | 3 (service audit), 4 (decorators), 6 (e2e) |
| `/app/jobs`, post-create drawer, client progress, unpaginated filter caveat, bookings Create/View | 5 |
| Golden path e2e | 6 |
| SHALL NOT (REST, seed, Quality, `jobByBookingId`, progress field, 2PC) | no task; Task 4 schema test proves no extra operations |

## 9. Task breakdown

### Task 1 — Additive Bookings contracts

**Files (modified):**
- `apps/api/src/modules/bookings/bookings.module.ts` — `exports: [BookingsService]`
- `apps/api/src/modules/bookings/application/services/bookings.service.ts` — `getBookingsByIds(ids: string[]): Promise<Booking[]>` (`if (ids.length === 0) return [];` then `findBy({ id: In(ids) })`); `remove` try/catch `23503` → `ConflictException('Booking cannot be deleted because other records reference it')`
- `apps/api/src/modules/bookings/tests/application/bookings.service.spec.ts` — bulk-read + 23503 unit cases
- `apps/api/src/modules/bookings/tests/bookings.module.di.spec.ts` — still resolves after export (no new providers)

**Tests first:**
- `getBookingsByIds([])` does not call the repository; returns `[]`.
- `getBookingsByIds(['a','b'])` returns exactly the mocked `findBy` rows (no synthetic nulls).
- `remove` **error mapping only**: a small helper (or the catch branch) maps `{ code: '23503' }` → `ConflictException('Booking cannot be deleted because other records reference it')` and rethrows any other `code`. Do **not** reconstruct TypeORM `QueryFailedError` internals in the unit test. Existing `remove` success/not-found/`actorId` audit behavior is unchanged — do not add or rewrite those cases in this task. The real TypeORM/`23503` path is proven in Task 2's Postgres test (booking with a job).

**Traceability:** spec §2 additive Bookings bullets, §4.1, §4.5 (`getBookingsByIds`).

### Task 2 — Jobs core: domain, migration, create/get/list

**Files (new):**
- `apps/api/src/modules/jobs/domain/job-status.ts` — enum `PENDING | IN_PROGRESS | COMPLETED`
- `apps/api/src/modules/jobs/domain/cleaning-job.ts` — interface
- `apps/api/src/modules/jobs/domain/checklist.ts`, `checklist-item.ts`
- `apps/api/src/modules/jobs/domain/default-checklist-items.ts` — three `{ position, label }` entries
- `apps/api/src/modules/jobs/infrastructure/persistence/{cleaning-job,checklist,checklist-item}.entity.ts`
- `apps/api/src/platform/database/migrations/<generated>-AddCleaningJob.ts` — create three tables; hand-add FKs/uniques named in §3; trim spurious cross-module FK churn
- `apps/api/src/modules/jobs/application/commands/create-job-from-booking.command.ts`
- `apps/api/src/modules/jobs/application/services/jobs.service.ts` — `createFromBooking`, `getJob`, `listJobs`, `getChecklistsByJobIds`, `getChecklistItemsByChecklistIds` (assign/complete in Task 3 as empty stubs would fail Task 3's tests — implement create/get/list/batch only here)
- `apps/api/src/modules/jobs/tests/application/jobs.service.spec.ts`
- `apps/api/test/helpers/job-db-test-lock.ts`
- `apps/api/test/jobs.service.e2e-spec.ts` (create/uniqueness/snapshot/rollback/completed-booking cases; Task 3 extends it)
- `apps/api/src/platform/database/data-source.ts` — register the three entities (CLI)

**Create path:** `BookingsService.findOne` + cancelled check + existing-job pre-check **before** `dataSource.transaction`. Inside `dataSource.transaction` + `runAuditInTransaction`: insert job `PENDING` with `createdAt` and `updatedAt` set to the same timestamp (creation is the first successful mutation activity), insert checklist, insert three items from `DEFAULT_CHECKLIST_ITEMS`, audit `{ action: 'job.create', entityType: 'job', entityId: job.id }`. Catch insert `23505` only for `UQ_cleaning_job_booking_id`.

**`listJobs()`:** `jobRepository.find()` — no filter, no pagination, no ordering clause this plan adds. No `relations:` / eager load.

**Tests first (mocked):** cancelled → BadRequest; missing booking propagates Bookings `NotFoundException`; existing job pre-check → ConflictException; `23505` + matching `{ code, constraint }` → same ConflictException; other constraint → rethrown; `getJob` missing → null; batch empty → `[]`.

**Tests first (Postgres):** COMPLETED booking create succeeds; CANCELLED rejected; snapshot equals observed booking; after `BookingsService.update` of `scheduledAt`/`teamId`, job unchanged; three items exact labels/positions; two concurrent `createFromBooking` → one row, loser specified ConflictException; audit logger throw inside transaction → zero `cleaning_job_entity` rows for that booking; `remove` booking with job → specified ConflictException (uses Task 1's catch; this is the real driver path). **Constraint inventory (query `pg_constraint` / `information_schema` once in this suite):** `UQ_cleaning_job_booking_id` unique on `cleaning_job_entity.bookingId`; `UQ_checklist_job_id` unique on `checklist_entity.jobId`; `fk_cleaning_job_booking` and `fk_cleaning_job_team` are `RESTRICT`; `fk_checklist_job` and `fk_checklist_item_checklist` are `CASCADE`.

**Traceability:** spec §4.1, §4.2 create/get/list, §4.7 uniqueness, §2 creation/concurrency/integrity tests.

### Task 3 — Assign, complete item, complete job

**Files (modified):**
- `jobs.service.ts` — `assignTeam`, `completeChecklistItem`, `completeJob`
- command files for the three mutations
- `jobs.service.spec.ts`, `jobs.service.e2e-spec.ts` extended

**`assignTeam` sequence:**
```text
TeamsService.getTeam(teamId)     // BEFORE dataSource.transaction; NotFound if null
BEGIN
  load job                       // manager.findOneBy; NotFound if missing
  reject if status === COMPLETED
  manager.update teamId + updatedAt
  audit job.assign_team
COMMIT
```
Do **not** call `getTeam` inside the Jobs transaction.

**`completeChecklistItem` sequence (all job/item/audit reads and writes inside one transaction):**
```text
BEGIN
  load job
  load item; reject unless it belongs to this job's checklist
  determine first incomplete→complete vs same-state from that in-tx state
  update item (if flipping)
  update job status if first completion (PENDING → IN_PROGRESS)
  update job.updatedAt
  audit job.checklist_item.complete
COMMIT
```
Same-state: still `updatedAt` + audit; do not change status. Last item still `IN_PROGRESS`. COMPLETED job → BadRequest `'Cannot complete a checklist item on a completed job'`. Wrong/missing item → NotFound `'Checklist item ${itemId} not found'`.

**`completeJob` sequence (aggregate-local persistence reads — no GraphQL loaders):**
```text
BEGIN
  load job
  load checklist for job
  load all checklist items for that checklist
  if any completed === false → BadRequest
  manager.update status COMPLETED + updatedAt
  audit job.complete
COMMIT
```
Same-state COMPLETED: still `updatedAt` + audit. `teamId` may be null.

**Tests first:** every matrix row in spec §4.1; same-state three mutations bump `updatedAt` and write audit; last item does not complete the job; completeJob with incomplete items rejected; assign on COMPLETED rejected.

**Traceability:** spec §4.1 matrix, §4.2 assign/complete, §4.4, §2 state/idempotency tests.

### Task 4 — GraphQL, loaders, module wiring

**Files (new):**
- `presentation/graphql/cleaning-job.type.ts`, `checklist.type.ts`, `checklist-item.type.ts`, inputs, `mappers.ts`
- `job.resolver.ts`, `checklist.resolver.ts` (`items` ResolveField)
- `job-relation.loaders.ts` — `bookingLoader`, `teamLoader`, `checklistLoader`, `itemsLoader`; extracted `create*BatchFn`
- `jobs.module.ts` — `TypeOrmModule.forFeature` three entities; `imports: [AuditModule, BookingsModule, CleanersModule]` (**not** `CustomersModule` / `CatalogModule`); providers: service, resolvers, loaders; **no `exports`** (no in-slice consumer)
- `jobs.module.di.spec.ts`, loader spec, resolver RBAC/schema spec

**Files (modified):**
- `app/app.module.ts` — `JobsModule`

`job` query: `getJob` → null or mapper (computed fields filled by ResolveField). `CleaningJob.booking` ResolveField: `bookingLoader` → `toBookingType`. Nested `customer` / `property` / `service` / `booking.team` are **not** Jobs ResolveFields — existing `BookingResolver` + `BookingRelationLoaders` run because `BookingType` is already in the schema. `CleaningJob.team` is Jobs' own field (`job.teamId` via `getTeamsByIds`). Mutations map input → command with `actorId: currentUser.id`. Roles: VIEW all six; CREATE job Owner/Ops/Scheduler/CS; assign/complete Owner/Ops/Scheduler (§4.3).

**Tests first:**
- Schema introspection — `CleaningJob` has no `bookingId`/`teamId`; operations are exactly the six named; `job: CleaningJob` nullable; mutations return `CleaningJob!`; `CleaningJob.booking: Booking!`; `CleaningJob.team: Team` (nullable); `CleaningJob.checklist: Checklist!`; `Checklist.items: [ChecklistItem!]!`; `ChecklistItem.completedAt` nullable DateTime.
- Batch fns preserve order and gap-fill; they call only `getBookingsByIds` / `getTeamsByIds` / `getChecklistsByJobIds` / `getChecklistItemsByChecklistIds`.
- DI: `JobsModule` resolves `JobsService` with fake `DataSource` + repo tokens for **`CleaningJobEntity` / `ChecklistEntity` / `ChecklistItemEntity` only**, plus `AUDIT_LOGGER`, plus **mocked `BookingsService` and `TeamsService`** (`overrideModule(BookingsModule)` / `overrideModule(CleanersModule)` with fakes that export those two services). **Do not** register or override `CustomerEntity`, `PropertyEntity`, `ServiceEntity`, `AddOnEntity`, `PricingRuleEntity`, or Catalog/Customers repositories. Transitive Bookings persistence is out of this test's scope (proven by Bookings' own tests and Task 6 `AppModule` e2e).

**Traceability:** spec §4.3–§4.5.

### Task 5 — Client + web

**Files (new):**
- `packages/client/src/operations/jobs.graphql` — `Jobs`, `Job`, `CreateJobFromBooking`, `AssignTeamToJob`, `CompleteChecklistItem`, `CompleteJob`. Selection set uses the **existing Booking GraphQL contract** (same fields as `packages/client/src/operations/bookings.graphql`), e.g. `booking { id scheduledAt status customer { id fullName } property { id addressLine1 } service { id name } team { id name } }` plus job `status` / `scheduledAt` / `team` / `checklist { items { id label position completed completedAt } }`. **No `booking.fullName`** — that field does not exist on `Booking`.
- `apps/web/app/app/jobs/page.tsx`

**Files (modified):**
- `packages/client/src/generated/graphql.ts` via `pnpm --filter @clensy/client codegen` (or repo-documented equivalent)
- `apps/web/components/app-shell/sidebar.tsx` — Operations: Bookings, Jobs (`/app/jobs`)
- `apps/web/app/app/bookings/page.tsx` — `useJobsQuery`; Create job vs View job, never both

**Manual check (no web automation):** empty state; create from jobs dialog omits booked bookings, success opens drawer; tick items; last tick does not enable complete until Complete job; completed job hides assign; bookings drawer Create/View; progress is `n / 3` from items, not a server field.

**Traceability:** spec §4.6.

### Task 6 — GraphQL e2e

**Files (new):** `apps/api/test/jobs.e2e-spec.ts`

Golden path + RBAC + `job(missing)` null + completeJob missing → GraphQL error NotFound + N+1 spies + create from COMPLETED booking + duplicate create Conflict + cancelled BadRequest + removeBooking with job Conflict. Unique-per-run data; `maxWorkers: 1` already set.

**Traceability:** spec §2 Tests, §6.

## 10. Risks (operational, not redesign)

- `migration:generate` will propose dropping other modules' hand-added FKs — trim them; do not apply the raw generate output.
- `QueryFailedError.driverError.constraint` must be confirmed against a real unique violation in Task 2's Postgres test; if the driver nests the field differently, adjust the helper to the observed shape without changing which constraint is translated.
- Level-2 truncation must include `checklist_item_entity` / `checklist_entity` / `cleaning_job_entity` (FK order) plus the booking fixtures that suite creates; use `JOB_DB_TEST_LOCK_KEY`.
- Do not add `JobsModule` to `BookingsModule.imports`.

## 11. Deferred (explicit)

Quality (#7), Dashboard (#8), `jobByBookingId`, pagination, job-level progress, REST, seed, CancelJob, multi-job, templates, availability, 2PC — spec §2/§7. Not in any task.
