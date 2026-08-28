# Jobs & Checklists — Specification

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Kind** | Architecture RFC (product behavior/contracts for this slice, not a process specification) |
| **Date** | 2026-08-27 |
| **Tracking** | [#6](https://github.com/rexescario-dev/clensy-platform/issues/6) (milestone M7 — Jobs & Checklists) |
| **Depends on (informative)** | [Phase 1 Design](2026-08-14-clensy-platform-phase1-design.md) §2.1 (GraphQL-only for new modules), §2.3 (jobs row), §2.6 (cross-module dependency rules), §3 (web `/app/jobs`, testing), §4 (M7; depends on M6 Bookings, M5 UX, M3 Teams), §5 (vertical-slice DoD). [Admin Foundation](2026-08-14-admin-foundation-design.md) (Accepted) — `AuthGuard`, `@Roles()`, `@CurrentUser()`, `AuditLogger` / `runAuditInTransaction`, consumed as-is. [Cleaners & Teams](2026-08-16-cleaners-teams-design.md) (Accepted) — `TeamsService.getTeam` / `getTeamsByIds`; `assignCleanerToTeam` as a dedicated, independently auditable mutation (the precedent this slice follows for `assignTeamToJob`); N+1 batching invariant; same-state mutation success. [Bookings](2026-08-22-bookings-design.md) (Accepted) — `Booking` identity, `BookingStatus`, `BookingsService.findOne` / `findAll`, computed GraphQL relations, and the explicit non-goal that booking-to-job linkage is M7's concern. This slice **constrains** `removeBooking` with an additive FK-violation error (see §4.1); it does not reopen Bookings' domain model. [Dashboard UX Foundation](2026-08-17-dashboard-ux-foundation-design.md) (Accepted) — `packages/ui` primitives (`DataTable`, `FormDialog`, `DetailDrawer`, `ConfirmDialog`), `/app/*` shell, `?detail=` drawer convention, `middleware.ts` matcher already covering `/app/jobs`. |
| **Followed by (informative)** | [Quality & Re-cleans](https://github.com/rexescario-dev/clensy-platform/issues/7) (#7, Phase 1 M8) — `QualityIssue` / `ReCleanJob`; must not be designed here. Operations Dashboard (#8, M9) — read model across this module's application contracts. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M2 |
| **Revision note** | M3 round 1 (reviewer: project owner) returned the draft for contract/concurrency tightening, not a redesign. Architecture, module boundaries, RBAC/audit, GraphQL/UI scope, and testing intent were approved. Required: scope `23505` translation to the named `bookingId` unique constraint; make the N+1 invariant O(1) in N, including job→checklist and checklist→items; state snapshot-at-observed-booking semantics (no cross-module locking); explicit `JobStatus` transition matrix; dedicated test that a `COMPLETED` booking can create a job; minimum persistence/batch-read capabilities; `CreateJobFromBooking` atomic across job/checklist/items/audit; `updatedAt` as successful mutation *activity*. Also applied: `position` uniqueness guaranteed by the creation algorithm (no extra unique index); created checklists always contain exactly three items; query `job()` returns null vs mutations throw `NotFoundException`; post-create UI navigation; client-side "already has a job" filtering depends on the unpaginated `jobs` query; `removeBooking`'s new `ConflictException` is an additive Bookings error-contract change; checklist progress is client-derived (no job-level progress field); aggregate boundary stated as `CleaningJob` root → `Checklist` → `ChecklistItem`. |
| **M3 decision** | **Accepted** — 2026-08-27. Round-1 tightenings verified: all must-fix and should-fix items present; architecture unchanged. One non-blocking M4 note: preserve normative-vs-mechanism distinction (N+1 invariant is O(1) in N; DataLoader is not a new architectural requirement) and map each tightened contract to a task/test. Ready for M4 Implementation Planning. |

## 1. Primary question & thesis

**Question:** What is "what the operations team needs to execute" — a job and its checklist, generated from a booking but deliberately not the same thing as a booking — and what exactly does this first Jobs slice own versus leave to Quality, Dashboard, or a later pass?

**Thesis:** `modules/jobs` owns the `CleaningJob` aggregate: `CleaningJob` (root), `Checklist`, and `ChecklistItem`. A `CleaningJob` is the operations-side execution unit for exactly one `Booking`; a `Checklist` is the job's execution script (a 1:1 companion created with the job, holding an ordered list of completable items). `Checklist` and `ChecklistItem` have no independent application commands or lifecycle. Creating a job is an explicit `CreateJobFromBooking` mutation — not a side effect of `createBooking` — because Bookings was specified to never model this relationship (Bookings spec §2, §7) and because Phase 1 Design §2.3 requires that a booking be able to outlive, precede, or diverge from the job it generates (reschedule the booking without moving the job; cancel the booking without erasing a job that already exists). Completing checklist items and completing the job are separate commands: ticking the last box does not close the job. Team assignment is its own mutation (`AssignTeamToJob`), following the Cleaners spec's "create vs. assign" split rather than Bookings' `teamId`-as-a-plain-field choice, because assigning who executes the work is an independently auditable operations event. The `teamId` copied at creation is a **snapshot of the booking's planning team**, not an assignment event; `AssignTeamToJob` is what turns (or confirms) it as execution responsibility. The slice is GraphQL-only (Phase 1 Design §2.1 / §7). It does not write back into `Booking.status`, does not implement re-cleans (`ReCleanJob` is M8), and does not invent availability/conflict checking.

## 2. Scope

### In scope (normative)

- `modules/jobs` domain: `CleaningJob` (aggregate root), `Checklist`, and `ChecklistItem` (plain TS, no framework dependencies). `ChecklistItem` is a child of `Checklist`, not a third issue-named aggregate — see §4.1 and §5.
- Application layer: `CreateJobFromBooking`, `AssignTeamToJob`, `CompleteChecklistItem`, `CompleteJob`, plus specification-authored `GetJob` / `ListJobs` (needed by job list/detail and by GraphQL; same class of addition as Catalog's `GetService` and Cleaners' `GetCleaner`/`GetTeam` — see §5).
- Infrastructure: TypeORM entities and repositories for `CleaningJob`, `Checklist`, and `ChecklistItem`; real migrations (not `synchronize`); `CleaningJob.bookingId` and `CleaningJob.teamId` as plain UUID columns with hand-added FKs (no TypeORM relation decorators), per Phase 1 Design §2.6 and every prior slice. Minimum persistence capabilities in §4.2.
- Presentation: GraphQL resolver, object types, and input types only. **No REST surface** (issue DoD; Phase 1 Design §2.1 / §7 — `bookings` remains the sole REST exception).
- RBAC: every operation declares `@Roles(...)` per §4.3; every operation requires `AuthGuard` (no public operations).
- Audit: every mutation logs via the existing `AuditLogger` port, inside the same transaction as the state change (`runAuditInTransaction`).
- Additive, Jobs-owned changes in `modules/bookings` (not a Bookings redesign — the same class of additive contract Bookings itself applied to customers/catalog for N+1 batching):
  - `BookingsModule` **MUST** export `BookingsService` (it currently exports nothing; Jobs cannot consume `findOne` / `findAll` otherwise).
  - `BookingsService.getBookingsByIds(ids: string[]): Promise<Booking[]>` — additive bulk read, identical empty-array short-circuit and "return only the rows found" contract as `getCustomersByIds` / `getTeamsByIds`. Existing `findOne` / `findAll` are unchanged.
  - `BookingsService.remove`: **additive error-contract change.** Existing success and not-found behavior is unchanged. When deletion violates an FK restriction (Postgres `23503`), it now returns `ConflictException('Booking cannot be deleted because other records reference it')` rather than exposing a database error. This becomes part of the Bookings GraphQL (`removeBooking`) and REST (`DELETE /bookings/:id`) contract for callers after this slice. The message is generic (not Jobs-specific) so Bookings does not import `modules/jobs`. See §4.1, §5.
- `apps/web`: `/app/jobs` — list (`DataTable`) + create (`FormDialog`, booking select) + job detail (`DetailDrawer`, `?detail=<id>`) with checklist execution. Sidebar: add **Jobs** under the existing Operations group next to Bookings. `/app/bookings` DetailDrawer: **"Create job"** when the booking has no job yet, **"View job"** when it does (§4.6). No middleware change (`/app/:path*` already covers `/app/jobs`).
- Tests: unit tests for the application layer; one e2e covering **booking → job creation → checklist completion → job completed** (issue DoD), plus the dedicated cases in **Tests** below.

**Tests (normative, in this slice):**

- Application-layer unit coverage for each `NotFoundException` / `BadRequestException` / `ConflictException` trigger in §4.2 / §4.7.
- One GraphQL e2e golden path: create a booking (existing Bookings contracts) → `createJobFromBooking` → complete every checklist item → `completeJob` → assert `CleaningJob.status === COMPLETED` and every item `completed === true`.
- **Creation:** `createJobFromBooking` against `BookingStatus.COMPLETED` **succeeds** (dedicated case — not implied by the golden path, which may use `PENDING`); `createJobFromBooking` against `CANCELLED` → `BadRequestException`; second `createJobFromBooking` for the same booking → `ConflictException('A job already exists for this booking')`; created job copies the booking's `scheduledAt` and `teamId` as observed at the `findOne` call; a subsequent `updateBooking` of `scheduledAt` / `teamId` does **not** change the job; any failure persisting job, checklist, items, or audit rolls back the entire create (no observable partial job).
- **Concurrency:** two concurrent `createJobFromBooking` calls for the same booking produce exactly one `CleaningJob` and one successful create; the loser receives `ConflictException('A job already exists for this booking')`.
- **State:** first real (incomplete → complete) item completion changes `PENDING` → `IN_PROGRESS`; subsequent item completion leaves `IN_PROGRESS`; completing the last incomplete item does **not** set `COMPLETED`; `completeJob` with all items complete changes `IN_PROGRESS` → `COMPLETED`.
- **Idempotency:** same-state `assignTeamToJob`, same-state `completeChecklistItem`, and same-state `completeJob` each succeed, bump `updatedAt`, and emit their audit event.
- **Integrity:** `removeBooking` of a booking that has a job returns `ConflictException('Booking cannot be deleted because other records reference it')` (FK `ON DELETE RESTRICT`); `completeChecklistItem` with an `itemId` that belongs to a different job → `NotFoundException`; `assignTeamToJob` / `completeChecklistItem` on a `COMPLETED` job → `BadRequestException`; `completeJob` while any item is incomplete → `BadRequestException`.
- **N+1:** `jobs { booking { id } team { name } checklist { items { label } } }` over N jobs is O(1) in N per §4.5.
- RBAC allowed/denied per §4.3.

### Out of scope (normative)

- Any REST surface for jobs.
- Auto-creating a job inside `BookingsService.create` / `createBooking` — CreateJobFromBooking is explicit. Bookings' application layer is not modified to emit jobs.
- Writing back to `Booking.status` (or any other Booking field) when a job is created, assigned, or completed. Booking and job status **diverge** by design (Phase 1 Design §2.3). Completing a job does **not** mark the booking `COMPLETED`; cancelling a booking does **not** cancel its job.
- A second `CleaningJob` for the same booking — **at most one `CleaningJob` per `bookingId`** in this slice (§4.1, §5). Additional execution after quality failure is M8's `ReCleanJob`, not another `CleaningJob`.
- `CancelJob`, `UpdateJob`, `DeleteJob`, unassign-team, or editing `scheduledAt` / checklist labels after creation.
- Re-cleans, quality issues, photos, or any `modules/quality` type — issue #7 / Phase 1 M8.
- Per-service or per-property checklist templates, Catalog-owned checklist definitions, or client-supplied item labels on `CreateJobFromBooking`. This slice materializes a **jobs-owned default item list** (§4.1).
- A `jobByBookingId` (or equivalent filtered) GraphQL query — the booking drawer's "does this booking have a job?" check uses the full `jobs` list (§4.6). Adding a lookup-by-booking query is deferred until pagination or a stated need appears.
- A job-level progress / `completedCount` read-model field — list progress is derived client-side from `checklist.items` (§4.6).
- Availability / conflict checking (double-booking a team, overlapping `scheduledAt`) — not in the issue DoD; same deferral Bookings made (§2 of that spec).
- Individual cleaner assignment (a job is assigned to a `Team`, not to a `Cleaner`) — Cleaners spec's single-team membership is consumed as-is; "which cleaner on the team did the work" is not modeled.
- `modules/dashboard` read models — M9.
- Search, filtering, sorting, or pagination beyond a full `listJobs` — same Phase 1 list precedent as every prior module.
- Browser-automation tests for `apps/web` (Phase 1 Design §7).
- Jobs seed fixtures / changes to `BookingSeeder` — `/app/jobs` empty state is the acceptable first-run UX; existing booking fixtures are unchanged.
- Roadmap issues #9–#19.

## 3. Terminology

- **CleaningJob** — aggregate root: a `modules/jobs` domain object representing what operations must execute for one `Booking`. Answers "what does the team need to do?", not "what did the customer schedule?".
- **Checklist** — the job's execution script. Created 1:1 with the `CleaningJob`; not independently created, listed, or deleted. Owns an ordered list of `ChecklistItem`s. No application commands of its own.
- **ChecklistItem** — one completable step on a `Checklist` (`label`, `position`, `completed` / `completedAt`). Identity exists so `CompleteChecklistItem` can target a specific step. No application commands of its own.
- **Create job from booking** — the only way a `CleaningJob` comes into existence in this slice. Explicit mutation; not implied by booking creation, confirmation, or any Booking status change.
- **Complete item** vs. **Complete job** — two distinct operations. Completing items records execution progress. Completing the job closes the job, and is only legal once every item is complete. The last item tick is not an implicit `CompleteJob`.
- **Team snapshot (at creation)** — `CleaningJob.teamId` as copied from `Booking.teamId` during `CreateJobFromBooking`. This is planning data frozen onto the job at the moment of the `findOne` observation. It is **not** an `AssignTeamToJob` event and MUST NOT be audited as `job.assign_team`.
- **Team assignment** — the `AssignTeamToJob` mutation, which sets execution responsibility. After this mutation (including a same-state call), `teamId` is an assignment field, not merely a leftover snapshot.
- **Diverge** — Phase 1 Design §2.3: a booking and its job are allowed to disagree. This slice's concrete reading: `CleaningJob.scheduledAt` and the creation-time `teamId` snapshot are taken from the booking observed by `CreateJobFromBooking`; subsequent `updateBooking` of `scheduledAt` / `teamId` / `status` does not mutate the job, and job mutations do not mutate the booking.
- **Actor** — the `AuthenticatedPrincipal` performing a mutation, threaded into `AuditLogger` as `actorId`, per Admin Foundation (unchanged).

## 4. Domain and behavioral contracts

### 4.1 Domain objects

**Aggregate boundary (normative):**

```text
CleaningJob          (aggregate root; the only object with application commands)
 └── Checklist       (1:1, created with the job; no independent lifecycle)
      └── ChecklistItem[]  (exactly three at creation; no independent lifecycle)
```

`CleaningJob`:
- `id: string` (UUID, generated; not client-settable)
- `bookingId: string` (required; references `modules/bookings`' `Booking.id`; **immutable** after creation; **unique** — at most one `CleaningJob` per booking in this slice; unique constraint name **`UQ_cleaning_job_booking_id`**)
- `teamId: string | null` (optional; references `modules/cleaners`' `Team.id`; `null` means unassigned. **Creation:** copied from `Booking.teamId` as a team snapshot (§3). **Afterwards:** mutated **only** via `AssignTeamToJob`, never via a generic update and never by `updateBooking` on the source booking)
- `scheduledAt: Date` (required; copied from `Booking.scheduledAt` at creation as a snapshot of the observed booking; **immutable** in this slice — there is no reschedule-job operation)
- `status: JobStatus` (`PENDING | IN_PROGRESS | COMPLETED` — see the transition matrix below)
- `createdAt: Date` (set once; not client-settable)
- `updatedAt: Date` (not client-settable). **`updatedAt` records successful mutation *activity* on the job, not merely structural state changes.** Every successful `assignTeamToJob`, `completeChecklistItem`, and `completeJob` invocation — including same-state calls that change no domain field except this timestamp — sets `updatedAt` to the current timestamp. Dashboard / M9 MUST NOT treat `updatedAt > previousUpdatedAt` as proof that `status`, `teamId`, or checklist completion changed.

`JobStatus` legal transitions (normative — the only transitions the API can produce):

| Current | Operation | Result |
| --- | --- | --- |
| *(none)* | `CreateJobFromBooking` | `PENDING` |
| `PENDING` | `CompleteChecklistItem` that flips incomplete → complete | `IN_PROGRESS` |
| `PENDING` | `CompleteChecklistItem` same-state (item already complete) | `PENDING` (should not occur after a well-formed create, because items start incomplete; still specified: same-state does not advance status) |
| `PENDING` | `CompleteJob` | rejected (`BadRequestException`) — items start incomplete, so `PENDING → COMPLETED` is impossible through the API |
| `IN_PROGRESS` | `CompleteChecklistItem` (including last item; including same-state) | `IN_PROGRESS` |
| `IN_PROGRESS` | `CompleteJob`, all items complete | `COMPLETED` |
| `COMPLETED` | `CompleteJob` (same-state) | `COMPLETED` |
| `COMPLETED` | `CompleteChecklistItem` | rejected (`BadRequestException`) |
| `COMPLETED` | `AssignTeamToJob` | rejected (`BadRequestException`) |
| `PENDING` or `IN_PROGRESS` | `AssignTeamToJob` | status unchanged |

`PENDING → COMPLETED` in a single `CompleteJob` call is impossible because a newly created checklist always has three incomplete items (§4.1 invariant below). There is no `CANCELLED` job status in this slice (no `CancelJob`). `JobStatus` is not client-settable as a raw field.

`CleaningJob` does **not** contain `booking`, `team`, or `checklist` as domain fields — it owns scalar fields and raw FK ids. Related objects are GraphQL presentation-layer computed data (§4.5), matching Bookings / Cleaners.

`Checklist`:
- `id: string` (UUID, generated; not client-settable)
- `jobId: string` (required; references `CleaningJob.id`; unique — 1:1)
- `createdAt: Date` (set once with the job)
- Items are **not** a collection field on the domain object stored as JSON. They are `ChecklistItem` children loaded through the application/persistence layer. GraphQL exposes `checklist.items`.
- **Hard invariant:** a checklist created by `CreateJobFromBooking` always contains **exactly three** items — the default template below, in that order. An empty checklist is not representable through the public API; `CompleteJob` on zero items is therefore unreachable and MUST NOT be treated as a supported path.

`ChecklistItem`:
- `id: string` (UUID, generated; not client-settable)
- `checklistId: string` (required; references `Checklist.id`)
- `label: string` (required, non-empty after trim; copied from the default template at creation; **immutable**)
- `position: number` (required, non-negative integer; display order; assigned at creation as `0`, `1`, `2`; **immutable**). Within one checklist, `position` values are unique. Uniqueness is **guaranteed by the creation algorithm** (the frozen template inserts three distinct positions). This slice does **not** add a database unique constraint on `(checklistId, position)`.
- `completed: boolean` (default `false`; set `true` by `CompleteChecklistItem`; never set back to `false` in this slice)
- `completedAt: Date | null` (`null` until completed; set once)

**Default checklist template (normative, jobs-owned).** `CreateJobFromBooking` always materializes these items, in this order, as the new job's checklist. There is no input field for custom labels in this slice.

| `position` | `label` |
| ---: | --- |
| 0 | Arrive on site |
| 1 | Complete assigned work |
| 2 | Final walkthrough |

Three items is enough for the golden path without pretending Catalog owns service-specific templates (Catalog has no such type; adding one would be a Catalog spec change). A later slice that wants per-service templates must specify that Catalog (or Jobs) contract explicitly.

**FK and delete policy.** `bookingId` and `teamId` are plain `@Column({ type: 'uuid'[, nullable: true] })` with **no** TypeORM relation decorator. FK constraints are hand-added in the migration's raw SQL:

- `CleaningJob.bookingId → booking_entity.id` — `ON DELETE RESTRICT`, unique constraint **`UQ_cleaning_job_booking_id`** on `bookingId`.
- `CleaningJob.teamId → team_entity.id` — `ON DELETE RESTRICT` (nullable column; `NULL` is valid). Team has no delete in Phase 1 (Cleaners spec §2), so this is moot in practice and still decided explicitly.
- `Checklist.jobId → cleaning_job.id` — `ON DELETE CASCADE` (checklist cannot outlive its job; this slice has no `DeleteJob`, so CASCADE is structural pairing, not a user-facing delete policy).
- `ChecklistItem.checklistId → checklist.id` — `ON DELETE CASCADE`.

Because `Booking` **does** have a hard-delete (`removeBooking`, Bookings spec §3 / §4.2), `ON DELETE RESTRICT` on `bookingId` is load-bearing: a booking that has a job cannot be deleted until/unless a later slice adds job deletion. Bookings MUST NOT import Jobs to pre-check this; the database is the authority. `BookingsService.remove` **retains its existing success and not-found behavior**; when deletion violates an FK restriction it now returns `ConflictException('Booking cannot be deleted because other records reference it')` rather than a driver 500. That translation is generic — it also covers any future RESTRICT reference (e.g. Quality) without Bookings learning module names — and is an additive Bookings error-contract change (§2).

`CleaningJob` does **not** copy `customerId` / `propertyId` / `serviceId`. Those remain on `Booking` and are reached via `job.booking { customer property service }` in GraphQL. Copying them onto the job would duplicate Bookings' reference-only model without a Jobs-side invariant that needs them.

### 4.2 Application layer

Mirrors existing modules: `application/commands` + `application/services`. `JobsService` is the only application service that mutates the aggregate. `Checklist` and `ChecklistItem` have no independent commands.

Each mutation owns its transaction boundary: entity write(s) + `AuditLogger.log()` in one transaction via `runAuditInTransaction`.

**`CreateJobFromBooking` is fully atomic.** The `CleaningJob` insert, the `Checklist` insert, the three `ChecklistItem` inserts, and the `job.create` audit event execute in **one** database transaction. Any failure in any of those writes rolls back the entire operation. A partially-created job (job without checklist, checklist without items, rows without audit, or audit without rows) is never observable.

**Query vs mutation missing-job behavior (normative):**

| Path | Missing `CleaningJob` |
| --- | --- |
| `JobsService.getJob(id)` / GraphQL `job(id)` | return `null` |
| `assignTeamToJob`, `completeChecklistItem`, `completeJob` | `NotFoundException(\`Job ${jobId} not found\`)` |

Mutations MUST NOT expose `getJob()`'s null to the client. They load the job internally and throw. `listJobs()` returns the full set (possibly empty), never null.

**Cross-module reads and the creation-time snapshot.** `BookingsService.findOne` (and `TeamsService.getTeam` on assign) run **before** the job transaction opens — those methods take no `EntityManager`; Phase 1 §2.6 forbids reaching into the other module's repository. **The `scheduledAt` / `teamId` snapshot is based on the `Booking` representation observed by that `findOne` call. No cross-module locking, repeatable-read across modules, or serializable transaction is required.** A concurrent `updateBooking` between `findOne` and the job insert MAY cause the job to freeze values the booking no longer has; that is the snapshot-at-creation semantics, not a bug. M4 MUST NOT "fix" this with a transaction spanning Bookings and Jobs, a two-phase commit, or SELECT FOR UPDATE on `booking_entity` from `modules/jobs`.

`Booking` **can** be hard-deleted. A concurrent `removeBooking` + `createJobFromBooking` pair may produce either a job or a deleted booking, not both — last writer + FK decides; this slice does not add distributed locking.

**Minimum persistence / batch-read capabilities (normative for the N+1 and uniqueness contracts).** Exact class/file names are M4, but M4 MUST provide these capabilities (as dedicated repository methods, or equivalent queries used only inside this module):

| Capability | Purpose |
| --- | --- |
| `CleaningJob`: find by id; find by `bookingId`; find all; insert; update | get/list/create/assign/complete; uniqueness pre-check |
| `Checklist`: find by `jobId`; find by job ids (plural); insert | 1:1 load; **batch job → checklist** |
| `ChecklistItem`: find by id; find by `checklistId`; find by checklist ids (plural); insert; update | complete-item; **batch checklist → items** |

`findByChecklistIds` (plural) is required by the N+1 invariant (§4.5). Singular-only item loads over a `jobs` list do not satisfy it.

- `CreateJobFromBookingCommand` → `JobsService.createFromBooking` — `{ actorId: string; bookingId: string }`. In order, before the transaction:
  1. `BookingsService.findOne(bookingId)` — already throws `NotFoundException(\`Booking ${bookingId} not found\`)` if missing; reuse that exception, do not wrap it.
  2. If `booking.status === BookingStatus.CANCELLED` → `BadRequestException('Cannot create a job from a cancelled booking')`. `PENDING`, `CONFIRMED`, and `COMPLETED` are all accepted. **`COMPLETED` is accepted** because Bookings' status model is transition-free and this slice does not treat booking completion as a job gate (they diverge). Cancelled is the one booking state that means "do not execute." This is a dedicated, named test (§2), not merely prose.
  3. If a `CleaningJob` already exists for `bookingId` → `ConflictException('A job already exists for this booking')` (application-layer pre-check). The unique constraint **`UQ_cleaning_job_booking_id`** is the concurrent-authority. A racing second insert's Postgres `23505` is translated to that same `ConflictException` **only when the violation is `UQ_cleaning_job_booking_id`**. Other unique violations MUST NOT be mapped to this message. Catalog/Cleaners' broader "any `23505` → this module's ConflictException" pattern is **not** copied here for this constraint.
  4. Copy `scheduledAt` from the observed booking. Copy `teamId` from the observed booking (`null` stays `null`) as a **team snapshot**, not an assignment. Do **not** call `TeamsService.getTeam` at create time — Bookings already validated `teamId` at booking create/update, and Team has no delete in Phase 1. If `booking.teamId` is non-null and the team were somehow missing, the `teamId` FK would reject the insert; that is not an expected Phase 1 path.
  5. Inside one transaction: insert `CleaningJob` with `status: PENDING` and `updatedAt = createdAt`; insert `Checklist`; insert the three default `ChecklistItem`s (`completed: false`, `completedAt: null`, `position` 0..2); audit `job.create`. Failure of any write rolls back all of them.
- `AssignTeamToJobCommand` → `JobsService.assignTeam` — `{ actorId: string; jobId: string; teamId: string }`. `teamId` is required (not nullable): this slice ships no unassign, matching Cleaners' `assignCleanerToTeam`. `TeamsService.getTeam(teamId)` — `NotFoundException(\`Team ${teamId} not found\`)` if `null` (Cleaners `getTeam` returns null; Bookings `findOne` throws — use each contract as it exists). Job missing → `NotFoundException(\`Job ${jobId} not found\`)`. Job `status === COMPLETED` → `BadRequestException('Cannot assign a team to a completed job')`. Same-state assignment (already that `teamId`) is **success**: still `manager.update()`, still bump `updatedAt`, still audit (Cleaners spec §4.2 / §4.4). Last-write-wins under concurrency; no assignment history.
- `CompleteChecklistItemCommand` → `JobsService.completeChecklistItem` — `{ actorId: string; jobId: string; itemId: string }`. Job missing → `NotFoundException`. Item missing, or item whose checklist is not this job's checklist → `NotFoundException(\`Checklist item ${itemId} not found\`)` (do not leak cross-job ids as `BadRequest` vs `NotFound` distinction). Job `COMPLETED` → `BadRequestException('Cannot complete a checklist item on a completed job')`. Same-state (item already `completed === true`) is **success**: still bump job `updatedAt`, still audit `job.checklist_item.complete` — do not skip; do **not** change `status`. If this call is the first item on the job to move from incomplete → complete, set `CleaningJob.status = IN_PROGRESS` in the same transaction. Completing further items leaves `IN_PROGRESS` unchanged. Completing the last remaining incomplete item does **not** set `COMPLETED`.
- `CompleteJobCommand` → `JobsService.completeJob` — `{ actorId: string; jobId: string }`. Job missing → `NotFoundException`. If any item on the job's checklist has `completed === false` → `BadRequestException('Cannot complete a job with incomplete checklist items')`. On success, whether first completion or same-state: `status → COMPLETED`, `updatedAt →` current timestamp, audit `job.complete`. `teamId` is allowed to be `null` at completion — assigning a team is not a gate on `CompleteJob` (booking's team is similarly optional; this slice does not invent a new "must be assigned" rule the issue does not ask for).

`AssignTeamToJob` is **not** a field of create. A job may be created already holding a copied `teamId` from the booking; that is a team snapshot, not an assignment event, and is **not** separately audited as `job.assign_team`. The first `job.assign_team` audit occurs only when `AssignTeamToJob` is invoked.

### 4.3 RBAC (`@Roles()` matrix — GraphQL)

Every operation requires `AuthGuard`. No operation in this module is public.

| Capability | Owner | Ops Manager | Scheduler | Customer Support | Finance | Analyst |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Create job from booking | ✓ | ✓ | ✓ | ✓ | | |
| Assign team to job | ✓ | ✓ | ✓ | | | |
| Complete checklist item / complete job | ✓ | ✓ | ✓ | | | |
| View job (get, list) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Rationale: **creating** a job is the operations counterpart of booking intake, so Customer Support stays on that mutation (Bookings write matrix). **Executing** the job (team assignment, checklist, completion) is Scheduler / Ops work, not a support-desk action — CS is excluded from those three mutations. Read access is broad: Finance/Analyst need job volume for the later dashboard; CS needs to see whether a booking has been turned into a job. This is a deliberate split inside one module, not an inconsistency with Bookings' single write row.

### 4.4 Audit logging

Every mutation logs one `AuditLogger.log()` call, Admin Foundation contract unchanged. One successful mutation invocation → one event, including same-state calls.

| Mutation | `action` | `entityType` | `entityId` |
| --- | --- | --- | --- |
| `createJobFromBooking` | `job.create` | `job` | new `CleaningJob.id` |
| `assignTeamToJob` | `job.assign_team` | `job` | `CleaningJob.id` |
| `completeChecklistItem` | `job.checklist_item.complete` | `job` | `CleaningJob.id` (the job is the aggregate root). `metadata` is empty / unused — this slice does not introduce mutation-specific metadata, matching Cleaners spec §4.4. The item id is not persisted on the audit event. |
| `completeJob` | `job.complete` | `job` | `CleaningJob.id` |

Checklist/item rows created inside `createJobFromBooking` are **not** separately audited — one business action, one event (Catalog's `createPricingRule` deactivates the previous rule without a second event). Reads are not audited. All four mutations MUST persist the audit event in the same transaction as the state change.

The creation-time team snapshot is **not** an `job.assign_team` event.

### 4.5 GraphQL operation surface

Queries:
- `job(id: ID!): CleaningJob` (nullable — missing id returns `null`, not `NotFoundException`)
- `jobs: [CleaningJob!]!`

Mutations (missing job → `NotFoundException`, never null):
- `createJobFromBooking(input: CreateJobFromBookingInput!): CleaningJob!`
- `assignTeamToJob(input: AssignTeamToJobInput!): CleaningJob!`
- `completeChecklistItem(input: CompleteChecklistItemInput!): CleaningJob!`
- `completeJob(input: CompleteJobInput!): CleaningJob!`

`CreateJobFromBookingInput`: `bookingId: ID!` — nothing else.

`AssignTeamToJobInput`: `jobId: ID!`, `teamId: ID!`.

`CompleteChecklistItemInput`: `jobId: ID!`, `itemId: ID!`.

`CompleteJobInput`: `id: ID!`. Every mutation in this module takes an input object (Catalog spec §5's "positional arguments → input object" precedent), including the single-id `completeJob`.

`CleaningJob` GraphQL type exposes:
- Direct: `id`, `scheduledAt`, `status`, `createdAt`, `updatedAt`
- Computed: `booking: Booking!` — `BookingsService` bulk path (`getBookingsByIds`). Non-nullable: `ON DELETE RESTRICT` + no `DeleteJob` means a job's booking remains resolvable for the job's lifetime.
- Computed: `team: Team` (nullable) — `TeamsService.getTeamsByIds` when `teamId` is non-null; `null` when unassigned. Same shape as `Booking.team` / `Cleaner.team`.
- Computed: `checklist: Checklist!` — loaded with its items, ordered by `position` ascending. Non-nullable: every job has a checklist from creation.

**No raw `bookingId` / `teamId` GraphQL fields** on `CleaningJob` — Bookings/Cleaners precedent (`booking.team.id`, not `booking.teamId`).

`Checklist` GraphQL type: `id`, `items: [ChecklistItem!]!`.

`ChecklistItem` GraphQL type: `id`, `label`, `position`, `completed`, `completedAt` (nullable).

**N+1 invariant (normative).** For `jobs { booking { id } team { name } checklist { items { label } } }` over N jobs, **database query count MUST be O(1) with respect to N** — independent of how many jobs are returned. Per-row `Promise.all` over `findOne` / `getTeam` / `find checklist by jobId` / `find items by checklistId` does **not** satisfy this (Bookings spec §4.5).

Concretely, both of these fan-outs are forbidden:

```text
N jobs → N checklist queries
N checklists → N item queries
```

Required batching:

```text
jobs → bookings:     batch by booking IDs   (getBookingsByIds)
jobs → teams:        batch by team IDs      (getTeamsByIds)
jobs → checklists:   batch by job IDs
checklists → items:  batch by checklist IDs
```

An equivalent DataLoader implementation is an M4 mechanism choice; its **total database work MUST still be O(1) in N**. A shape that satisfies the invariant:

```text
1 query: jobs
1 query: bookings by IDs
1 query: teams by IDs
1 query: checklists by job IDs
1 query: checklist items by checklist IDs
```

The exact integer (five vs. a DataLoader's batched round) is not frozen; "1 + N checklist queries + 1 item query" is **not** compliant, even though the item query is bounded.

`apps/web` create-job flow reuses the existing `bookings` query to populate the booking select — no new Bookings GraphQL operation. To hide bookings that already have a job, the client uses the `jobs { booking { id } }` result; the server still enforces uniqueness. **This client-side filter is correct only because both `bookings` and `jobs` are unpaginated full lists in Phase 1.** It MUST be revisited when either list becomes paginated. This slice does **not** add `jobByBookingId`.

### 4.6 Web UI

- `/app/jobs` — list (`DataTable`): booking customer name, property address line, service name, `scheduledAt`, job status badge, team name or "Unassigned", checklist progress (`completedCount / totalCount`). **Checklist progress is derived client-side from `checklist.items` in this slice; no job-level progress read model is introduced.** "+ New Job" opens a `FormDialog` with a booking `<select>`; bookings that already have a job are **omitted** from the list (server uniqueness still rejects a stale duplicate). Submit calls `createJobFromBooking`. **On success: close the dialog, refresh the `jobs` query, and open the newly created job in the detail drawer (`?detail=<newId>`).**
- Row click opens `DetailDrawer` (`?detail=<id>` on `/app/jobs`, Dashboard UX convention). Drawer shows booking summary (customer / property / service / booking status / booking scheduled time — made visible specifically so divergence from `job.scheduledAt` is obvious), job `scheduledAt`, job status, team (select + "Assign team" calling `assignTeamToJob`; the assign control is **not rendered** when job is `COMPLETED`), and the checklist: each item is a checkbox, disabled if already completed or job is `COMPLETED`. Checking an incomplete item calls `completeChecklistItem`. A **"Complete job"** action is enabled only when every item is completed and the job is not already `COMPLETED`; it calls `completeJob` (no `ConfirmDialog` — not destructive). No delete action.
- `/app/bookings` DetailDrawer: **"Create job"** when `jobs` contains no row whose `booking.id` matches; **"View job"** (navigates to `/app/jobs?detail=<existingId>`) when it does. Never both. This uses the full unpaginated `jobs` query on purpose (no `jobByBookingId` in this slice). On successful create from this drawer: navigate to `/app/jobs?detail=<newId>`. This is a web-only addition; Bookings GraphQL is unchanged.
- Sidebar: Operations group becomes Bookings, **Jobs** (`/app/jobs`). Quality is not added (module does not exist).
- Selects that `FormField` cannot represent stay raw `<select>` + `<label htmlFor>`, matching Bookings / Admin / Cleaners precedent.
- No new `packages/ui` primitive. No `[id]` route. No middleware edit.

### 4.7 Validation invariants

- `bookingId` MUST reference an existing `Booking` (`NotFoundException` via `findOne`) that is not `CANCELLED` (`BadRequestException`). `COMPLETED` bookings are valid sources.
- At most one `CleaningJob` per `bookingId` (`ConflictException('A job already exists for this booking')` + unique constraint `UQ_cleaning_job_booking_id`; `23505` translation **only** for that constraint).
- A checklist created by `CreateJobFromBooking` always contains exactly three items with positions `0`, `1`, `2` and the template labels in §4.1.
- `teamId` on `AssignTeamToJob` MUST reference an existing `Team` (`NotFoundException`).
- `CompleteChecklistItem` target MUST belong to that job's checklist (`NotFoundException` if not).
- `CompleteJob` requires every item `completed === true` (`BadRequestException`).
- `AssignTeamToJob` and `CompleteChecklistItem` are illegal on `COMPLETED` jobs (`BadRequestException`).
- Default item labels MUST be the three strings in §4.1, trimmed and non-empty (template is code, not user input; they are not configurable in this slice).
- `NotFoundException` / `ConflictException` / `BadRequestException` (`@nestjs/common`) are used directly. No module-specific domain error type.
- Cross-module `NotFoundException` messages use this codebase's interpolated-id convention (`` `Booking ${id} not found` ``, `` `Team ${id} not found` ``, `` `Job ${id} not found` ``). `BadRequestException` / `ConflictException` messages use this spec's prose verbatim.

## 5. Rationale

- **Explicit `CreateJobFromBooking`, not a booking-create hook.** Bookings spec §2 / §7 forbids this slice from being implied by Bookings, and Phase 1 §2.3's "outlive / precede / diverge" is unsatisfiable if every booking secretly is a job. An explicit mutation also keeps audit as "someone decided to execute this booking," which is the operations event.
- **At most one `CleaningJob` per booking.** Phase 1's "job(s)" is read here as covering the product lifetime including M8 `ReCleanJob`, not as "this slice must allow many `CleaningJob` rows." A unique constraint prevents double-click duplicates and keeps the golden path 1:1. Reschedule-divergence is modeled by **not** updating `CleaningJob.scheduledAt` when `updateBooking` changes `scheduledAt`, not by inserting a second job. Confirmed M3 round 1 (architecture approved; uniqueness not reversed).
- **`AssignTeamToJob` is a dedicated mutation**, unlike Bookings' `teamId` on create/update. Bookings treated team as one field in an intake walk (Bookings spec §5). A job's team is "who is executing," closer to Cleaners' HR-style assignment than to intake. The issue names `AssignTeamToJob` as its own application command; this spec does not collapse it into create/update. Copying `Booking.teamId` at creation is a **team snapshot** (planning data frozen at the `findOne` observation) so the jobs UI is not empty of team when the booking already had one — it is not an assignment event and is not audited as one.
- **Snapshot race with concurrent `updateBooking` is intentional.** Cross-module reads cannot join the Jobs transaction without violating Phase 1 §2.6. Treating the observed booking as the snapshot source is the whole point of diverge-at-creation; locking Bookings from Jobs would be a hidden coupling this slice exists to avoid.
- **`23505` translation is constraint-scoped.** Catalog/Cleaners map any unique violation in a service to that service's `ConflictException`. This slice names `UQ_cleaning_job_booking_id` so a future second unique index cannot be misreported as "a job already exists for this booking."
- **Checklist items are a jobs-owned default list, not Catalog templates and not create-input labels.** Catalog has no checklist type; adding one would reopen an Accepted spec. Client-supplied labels would make the e2e and the UI invent copy independently. Three frozen strings are enough for Phase 1 execution; per-service templates are a real product later, not a silent extra now. `position` uniqueness is an algorithm property of that frozen insert, not a second unique index to maintain.
- **`CompleteChecklistItem` and `CompleteJob` stay separate.** The issue lists both. Auto-completing the job on the last tick would make "complete job" dead API surface and would remove the supervisor-style "work is done / I am closing this" distinction. Same-state `completeJob` is success so a double-submit is not an error.
- **Jobs never write `Booking.status`.** The whole point of two modules is that execution and the commercial booking can disagree. Closing that gap here would smuggle a Bookings redesign into Jobs.
- **`ChecklistItem` is specified even though the issue names only `CleaningJob` and `Checklist`.** A completable checklist without addressable items cannot support `CompleteChecklistItem`. Items are children of the `CleaningJob` aggregate, not a third bounded context.
- **Customer Support can create a job but cannot complete one.** Intake vs. field execution. Collapsing to Bookings' single write row would let CS tick checklists they have no stated operational role in.
- **`COMPLETED` booking may still generate a job.** Bookings allows setting `COMPLETED` without a job existing (Bookings has no job hook). Rejecting that would invent a cross-module status machine Bookings explicitly does not have. Only `CANCELLED` is refused. Surprising enough that it is a dedicated acceptance test, not only a paragraph.
- **Generic `23503` translation on `BookingsService.remove`, not a Jobs import.** Preserves §2.6 direction (Jobs → Bookings, never the reverse) while keeping `removeBooking` from becoming a 500 once RESTRICT exists. Callers of `removeBooking` / `DELETE /bookings/:id` gain a new documented failure mode; success/not-found are unchanged.
- **Checklist progress stays client-derived.** A server `completedCount` field would be a dashboard/read-model concern (M9). Phase 1 job volume does not justify it.
- **No REST.** New module, Phase 1 default, issue DoD.

## 6. Acceptance criteria (for this specification)

- Domain shape (`CleaningJob` aggregate → `Checklist` → `ChecklistItem`), uniqueness (one job per booking, constraint `UQ_cleaning_job_booking_id`), default checklist contents (exactly three items), status-transition matrix (§4.1), and "no write-back to Booking" are confirmed against the project owner's intent.
- **`CreateJobFromBooking` is explicit, not a `createBooking` side effect** — confirmed, including that Bookings application code is not modified to emit jobs, and that create is atomic across job/checklist/items/audit.
- **Creation-time `scheduledAt` / `teamId` are snapshots of the booking observed by `findOne`** — concurrent `updateBooking` need not be serialized; M4 must not introduce a cross-module transaction. The copied `teamId` is a snapshot, not an audited assignment.
- **`AssignTeamToJob` as a dedicated mutation** (Cleaners precedent, not Bookings' plain `teamId` field) is confirmed.
- **Separate `CompleteChecklistItem` / `CompleteJob`**, last-item-does-not-auto-complete, same-state success, and `updatedAt` as mutation *activity* are confirmed.
- **RBAC split** (CS may create job, may not assign/complete) is confirmed, not collapsed to Bookings' write row.
- **Cancelled booking cannot generate a job; `COMPLETED` booking can** — confirmed, with a dedicated test for the latter.
- Additive Bookings changes (export `BookingsService`, `getBookingsByIds`, generic `23503` translation on `remove` as an error-contract change) are confirmed as in-scope for this slice and **not** a Bookings spec reopen.
- GraphQL-only; N+1 is O(1) in N including job→checklist and checklist→items; `/app/jobs` + `?detail=` drawer; post-create opens the new job drawer; bookings-drawer Create/View job; client-side already-has-job filtering is Phase-1-unpaginated-only.
- The e2e golden path **booking → job → checklist completion → job completed** is named as this slice's Phase 1 §5 vertical-slice DoD, plus the dedicated tests in §2 (including concurrent create and completed-booking create).
- No open contradiction with Accepted Phase 1 Design, Admin Foundation, Cleaners & Teams, Bookings, or Dashboard UX Foundation.
- Scope boundaries (§2) are explicit enough that M4 does not invent further product rules (availability, re-cleans, templates, cancel-job, multi-job, `jobByBookingId`, job-level progress field).

## 7. Non-goals

- Redesigning any Admin Foundation, Cleaners & Teams, Bookings, Catalog, Customers, or Dashboard UX Foundation contract — consumed or added to additively as §2 states, not reinterpreted.
- `modules/quality` / `ReCleanJob` / issue #7.
- `modules/dashboard` / issue #8.
- Auto-sync between `Booking.status` and `JobStatus`.
- Multiple `CleaningJob`s per booking, `CancelJob`, checklist templates, client-supplied item labels, unassign-team, job-level reschedule, cleaner-level assignment, availability/conflict checking.
- REST for jobs.
- Pagination/search/filter of `jobs`.
- `jobByBookingId` / server-side job progress field.
- Browser-automation tests for `apps/web`.
- Cross-module locking or two-phase commit between Jobs and Bookings.
