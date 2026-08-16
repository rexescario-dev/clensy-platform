# Cleaners & Teams — Specification

| Field | Value |
| --- | --- |
| **Status** | Draft |
| **Kind** | Architecture RFC (product behavior/contracts for this slice, not a process specification) |
| **Date** | 2026-08-16 |
| **Tracking** | [#3](https://github.com/rexescario-dev/clensy-platform/issues/3) (milestone M3 — Cleaners & Teams) |
| **Depends on (informative)** | [Phase 1 Design](2026-08-14-clensy-platform-phase1-design.md) §2.3 (cleaners row), §2.6 (cross-module dependency rules), §4 (M3), §5 (vertical-slice DoD). [Admin Foundation](2026-08-14-admin-foundation-design.md) (Accepted) — this slice depends on it for `AuthGuard`, `@Roles()`, `@CurrentUser()`, and `AuditLogger` (including its transactional-audit rule); it does not redesign any of those contracts. [Customers & Properties](2026-08-15-customers-properties-design.md) (Accepted) — precedent for computed presentation-layer fields and no-ORM-relation-decorator FK modeling, reused here, not extended. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M2 |

## 1. Primary question & thesis

**Question:** What is the workforce record-keeping workflow — cleaners and their team assignment — that later milestones (M6 Jobs & Checklists onward) will reference by identity, and what exactly does it own versus defer?

**Thesis:** `modules/cleaners` owns two domain objects, `Cleaner` and `Team`. A `Cleaner` may be assigned to at most one `Team` at a time (nullable, reassignable, single-valued — not a many-to-many membership). The slice ships create/read/update for `Cleaner`, create/read for `Team` (no team update — see §2), and a single `assignCleanerToTeam` operation, gated by the existing Admin Foundation RBAC, audit-logged on every mutation, exposed over GraphQL, and surfaced in `apps/web` at `/cleaners` (list, detail, team management). No delete operation exists for either object in this slice.

## 2. Scope

### In scope (normative)

- `modules/cleaners` domain: `Cleaner`, `Team` (plain TS, no framework dependencies).
- Application layer: `CreateCleaner`, `UpdateCleaner`, `GetCleaner`, `ListCleaners`, `CreateTeam`, `GetTeam`, `ListTeams`, `AssignCleanerToTeam`.
- Infrastructure: TypeORM entities and repositories for both objects, with `Cleaner.teamId` as a nullable foreign key to `Team.id`.
- Presentation: GraphQL resolver, object types, and input types only (GraphQL-only, no REST surface, per Phase 1 Design §2.3).
- RBAC: every operation declares `@Roles(...)` per the matrix in §4.3; every operation requires `AuthGuard` (no public operations in this module).
- Audit: every mutation (`createCleaner`, `updateCleaner`, `createTeam`, `assignCleanerToTeam`) logs via the existing `AuditLogger` port.
- `apps/web`: `/cleaners` (list), `/cleaners/[id]` (detail), `/cleaners/teams` (team list + detail with member management), create/edit forms; route-group auth gate extended to cover `/cleaners`.
- Tests: unit tests for the application layer; one e2e covering create cleaner → create team → assign (Phase 1 Design §3, §5, and the issue's own DoD).

### Out of scope (normative)

- Delete/deactivate for `Cleaner` or `Team` — the issue's Definition of Done lists no delete operation.
- `UpdateTeam` (e.g. renaming a team) — the issue's DoD lists `CreateTeam` and `AssignCleanerToTeam` only, no team-update operation. If a later need arises to rename or otherwise edit a team, that is a new operation for a later slice, not assumed here.
- Cleaner availability, scheduling, shift status, or capacity — this slice is workforce *identity and team membership* only. "Is this cleaner available today" belongs to M6 Jobs & Checklists or later, not here.
- Multi-team membership — a `Cleaner` belongs to at most one `Team` at a time (§4.1). Modeling a cleaner as working across multiple concurrent teams is explicitly rejected for Phase 1; revisit only if a real multi-team operating model emerges.
- Any relationship to `bookings` or `jobs` — `Cleaner`/`Team` identity exists independently in Phase 1; wiring a job to the cleaner(s) who execute it is M6's concern, not this slice's.
- Search, filtering, sorting, or pagination beyond a simple list — `ListCleaners` and `ListTeams` return the full set. Same rationale as the Customers & Properties precedent: Phase 1's workforce volume does not yet justify pagination.
- Cleaner-facing accounts or authentication — a `Cleaner` is a record `apps/web` staff manage, not a principal who can log in. Distinct from `AdminUser` entirely (same distinction the Customers spec draws for `Customer`).

## 3. Terminology

- **Cleaner** — a `modules/cleaners` domain object representing a member of Clensy's cleaning workforce. Owns identity/contact fields but is not an authentication principal.
- **Team** — a `modules/cleaners` domain object representing a named grouping of cleaners who work together. A `Team` may have zero or more `Cleaner`s assigned to it at any time.
- **Assignment** — the act of setting a `Cleaner`'s `teamId`. Assigning a cleaner already on a team to a different team reassigns them (single mutation, not an add-to-list operation); it does not create a history of past assignments in this slice.
- **Actor** — the `AuthenticatedPrincipal` performing a mutation, threaded into `AuditLogger` calls as `actorId`, per the Admin Foundation contract (unchanged here).

## 4. Domain and behavioral contracts

### 4.1 Domain objects

`Cleaner`:
- `id: string` (UUID, generated; not client-settable)
- `fullName: string` (required, non-empty)
- `phone: string` (required, non-empty)
- `email: string` (required, non-empty; domain invariant is non-empty only, same email-syntax/domain split as the Customers spec §4.7 — syntax validation is a presentation-layer concern)
- `notes: string | null` (optional free text — e.g. certifications, equipment notes)
- `teamId: string | null` (foreign key to `Team.id`; `null` means unassigned; set only via `assignCleanerToTeam`, §4.2 — never a direct field of `CreateCleanerInput`/`UpdateCleanerInput`)
- `createdAt: Date` (set once at creation; not client-settable), `updatedAt: Date` (set on every successful mutation of this record; not client-settable)

`Cleaner` does **not** contain a `team` field — the domain object owns only its own scalar fields including the raw `teamId`. The full `Team` object, when needed, is reached only through the GraphQL presentation layer (§4.5), mirroring the Customers & Properties precedent for `Customer.properties`.

`Team`:
- `id: string` (UUID, generated; not client-settable)
- `name: string` (required, non-empty)
- `createdAt: Date` (set once at creation; not client-settable), `updatedAt: Date` (set on every successful mutation of this record; not client-settable — `updatedAt` changes only if `Team` itself is later given a mutable field; in this slice nothing mutates an existing `Team` row directly, since there is no `UpdateTeam`, but the column exists for schema consistency with every other entity in this codebase)

`Team` does **not** contain a `cleaners` field — the set of cleaners currently assigned to a team is derived by querying `Cleaner` rows where `teamId` matches, never stored as a collection on `Team` itself. Reached only through the GraphQL presentation layer (§4.5).

The `Cleaner.teamId → Team.id` foreign key, when set, does **not** cascade-delete on `Team` removal, matching the Customers & Properties precedent's rationale: since this slice exposes no delete operation for `Team` (§2), the FK's `ON DELETE` policy is `RESTRICT` (or the database's equivalent default-deny), not `CASCADE` or `SET NULL`. A later slice that adds team deletion must decide that behavior explicitly rather than inheriting a default set here. Following the same precedent, `Cleaner.teamId` is a plain `@Column({ type: 'uuid', nullable: true })` with no TypeORM relation decorator — the FK constraint is hand-added to the migration's raw SQL, not derived from an ORM relation, to prevent an accidental bidirectional ORM aggregate.

### 4.2 Application layer

Mirrors the `customers`/`bookings` modules' `application/commands` + `application/services` split:

- `CreateCleanerCommand` → `CleanersService.createCleaner` — `teamId` is not a field of `CreateCleanerInput`; a cleaner is always created unassigned (`teamId: null`) and assigned afterward via `assignCleanerToTeam`, keeping "create a cleaner" and "put them on a team" as two distinct, independently auditable operations.
- `UpdateCleanerCommand` → `CleanersService.updateCleaner` — **partial-update semantics**, identical shape to the Customers spec's `updateCustomer`: `UpdateCleanerInput` fields are all optional; an omitted field retains its current value, a provided field is applied; the resulting full entity state is revalidated against §4.7. `teamId` is not a field of `UpdateCleanerInput` either — it can only change via `assignCleanerToTeam` (§4.2 below), never as a side effect of an unrelated field update. Throws `NotFoundException` if `id` does not exist.
- `CleanersService.getCleaner(id)` — returns `null` if `id` does not exist (nullable GraphQL type, §4.5); `CleanersService.listCleaners()` — returns the full set.
- `AssignCleanerToTeamCommand` → `CleanersService.assignCleanerToTeam(cleanerId, teamId)` — sets `Cleaner.teamId = teamId`, overwriting any prior assignment. Throws `NotFoundException` if `cleanerId` does not exist. `teamId` is required (not nullable) in this operation's input: this slice ships no explicit "unassign" operation, since the issue's DoD names only `AssignCleanerToTeam`. If a future need arises to unassign a cleaner without reassigning them to a specific team, that is a new operation for a later slice. Throws `NotFoundException` if `teamId` does not reference an existing `Team`, mirroring `createProperty`'s existing-parent check in the Customers spec.
- `CreateTeamCommand` → `TeamsService.createTeam`.
- `TeamsService.getTeam(id)` — returns `null` if `id` does not exist; `TeamsService.listTeams()` — returns the full set.

### 4.3 RBAC (`@Roles()` matrix)

Every operation requires `AuthGuard` (authentication). No operation in this module is public.

| Capability | Owner | Ops Manager | Scheduler | Customer Support | Finance | Analyst |
| --- | :---: | :---: | :---: | :---: | :---: | :---: |
| Create / update cleaner | ✓ | ✓ | | | | |
| Create team / assign cleaner to team | ✓ | ✓ | | | | |
| View cleaner / team (get, list) | ✓ | ✓ | ✓ | | | ✓ |

Rationale: workforce management (hiring record-keeping, team composition) is an Ops Manager responsibility, not Scheduler's — Scheduler needs to *see* who's on which team to build a schedule, but does not own headcount or team composition, so it is read-only here, mirroring the Customer Support/Scheduler split established in the Customers spec §4.3. Customer Support has no stated need to view or manage workforce data in this slice, so it is fully excluded (unlike Customers & Properties, where it was the primary write role) — this is the same "deliberate, temporary boundary, not an architectural exclusion" pattern the Customers spec applied to Finance: a later milestone with a stated reason must add the capability explicitly, never inherit it implicitly. Analyst (read-only across Phase 1 by role design) gets view access for reporting. Finance has no stated need here for the same reason it was excluded from Customers & Properties.

### 4.4 Audit logging

Every mutation logs one `AuditLogger.log()` call, following the existing `AuditLogEvent` contract unchanged:

| Mutation | `action` | `entityType` | `entityId` |
| --- | --- | --- | --- |
| `createCleaner` | `cleaner.create` | `cleaner` | new `Cleaner.id` |
| `updateCleaner` | `cleaner.update` | `cleaner` | `Cleaner.id` |
| `createTeam` | `team.create` | `team` | new `Team.id` |
| `assignCleanerToTeam` | `cleaner.assign_team` | `cleaner` | `Cleaner.id` |

`assignCleanerToTeam`'s audit event is scoped to `entityType: 'cleaner'` (not `team`) because the mutated row is the `Cleaner`'s `teamId` column — consistent with "the audit event describes the row that changed," not the row that was referenced. The assigned `teamId` value is not carried in `metadata` in this slice (no audit event in this codebase currently carries mutation-specific metadata beyond the four required fields; introducing that pattern here would be new scope, not a reuse of an existing one).

**Failure semantics are inherited from the Admin Foundation `AuditLogger` contract, unchanged, not redesigned here:** all four mutations above are state-changing operations, so each MUST persist its audit event within the same database transaction as the state change it describes, per the Admin Foundation spec's transactional-audit rule. This slice introduces no new audit failure behavior, retry logic, or async/queued delivery.

No audit event is logged for read operations, matching precedent.

### 4.5 GraphQL operation surface

Queries:
- `cleaner(id: ID!): Cleaner`
- `cleaners: [Cleaner!]!`
- `team(id: ID!): Team`
- `teams: [Team!]!`

Mutations:
- `createCleaner(input: CreateCleanerInput!): Cleaner!`
- `updateCleaner(id: ID!, input: UpdateCleanerInput!): Cleaner!`
- `createTeam(input: CreateTeamInput!): Team!`
- `assignCleanerToTeam(cleanerId: ID!, teamId: ID!): Cleaner!` — returns the updated `Cleaner`, not the `Team`, consistent with it being a `Cleaner`-row mutation (§4.4). `apps/web`'s team-detail screen re-fetches `teamCleaners`/`team` after a successful assignment rather than relying on this return value to update team-scoped UI state.

`Team` GraphQL type additionally exposes a `cleaners: [Cleaner!]!` field, and `Cleaner` GraphQL type exposes a `team: Team` (nullable) field. Both are **presentation-layer computed data only** — neither is a field of the respective domain object (§4.1) and neither requires a TypeORM relation, bidirectional association, or ORM-level eager/lazy loading. `Team.cleaners` is backed by a new application-layer method, `CleanersService.listTeamCleaners(teamId)` (returns cleaners where `teamId` matches; empty list, not an error, for a team with no members — unlike the Customers spec's `listCustomerProperties`, there is no "typo'd ID looks like zero results" ambiguity risk here worth guarding against, because `Team.cleaners` is only ever resolved starting from an already-fetched, already-valid `Team` object, never from a client-supplied ID directly). `Cleaner.team` is backed by `TeamsService.getTeam(cleaner.teamId)`, returning `null` when `cleaner.teamId` is `null`, reusing the existing nullable `getTeam` method — no new service method needed for this direction.

`GetCleaner`/`GetTeam` (the `cleaner`/`team` singular queries) are not named explicitly in the issue's Application bullet, which lists only `CreateCleaner, UpdateCleaner, ListCleaners, CreateTeam, AssignCleanerToTeam, ListTeams`. They are included here as a necessary minimum to satisfy the issue's own Web DoD ("cleaner list/**detail**, team list/**detail**"): a detail screen needs a single-record fetch, and the Customers & Properties precedent established the same `get*` pattern for the same reason. This is flagged explicitly for M3 to confirm rather than silently assumed.

### 4.6 Web UI

- `/cleaners` — list view (`DataTable` from `packages/ui`), one row per `Cleaner` (name, phone, email, team name if assigned), link to detail.
- `/cleaners/[id]` — detail view: cleaner fields, edit form, current team (if any), and a control to assign/reassign the cleaner to a team (a select populated from `teams`).
- `/cleaners/teams` — team list view (`DataTable`), one row per `Team` (name, member count), link to detail; create-team form.
- `/cleaners/teams/[id]` — team detail view: team name, and a `DataTable` of its currently assigned cleaners (read-only membership list here — reassignment happens from the cleaner's own detail page, §4.5, not by editing the team's member list directly, to keep "who owns this mutation" unambiguous: a `Cleaner` row's `teamId` is always changed from the cleaner side).
- Route-group auth gate: `apps/web/middleware.ts`'s `matcher` is extended to include `/cleaners` and `/cleaners/:path*`, using the same UX-hint-only cookie-presence check already in place for `/admin` and `/customers`. The API's `@Roles()` guards remain the authoritative enforcement point; the frontend gate is UX layering only.
- Forms use `FormField` from `packages/ui`; no screen hand-rolls its own inputs.

### 4.7 Validation invariants

- `Cleaner.fullName`, `.phone`, `.email` MUST be non-empty at creation and, per the partial-update semantics in §4.2, in the resulting entity state after any update. Email domain/presentation split is identical to the Customers spec §4.7: domain invariant is non-empty only, syntax validation is a presentation/input-layer concern.
- `Team.name` MUST be non-empty at creation. There is no update path for `Team` in this slice (§2), so no post-update revalidation applies to it.
- `assignCleanerToTeam`'s `teamId` MUST reference an existing `Team`; `cleanerId` MUST reference an existing `Cleaner`. Both enforced at the application layer (explicit existence checks throwing `NotFoundException`, §4.2) and at the database layer (FK constraint on `teamId`) — the application-layer check exists to produce a clean GraphQL error instead of surfacing a raw FK-violation error to the client, same rationale as the Customers spec.

## 5. Rationale

- **Single-team membership (`Cleaner.teamId`, not a join table)** is the simplest model that satisfies the issue's DoD ("AssignCleanerToTeam", singular) and Phase 1 Design's "workforce and team assignment" framing. A many-to-many membership model is explicitly deferred (§2) since no stated Phase 1 workflow needs a cleaner on multiple concurrent teams; adding a join table later is a additive migration, not a breaking one, if that need emerges.
- **`teamId` excluded from `CreateCleanerInput`/`UpdateCleanerInput`, assignment is its own operation** keeps "a cleaner exists" and "a cleaner is on a team" as separately auditable events (§4.4), and avoids the ambiguity of what an omitted `teamId` in a partial update would mean (retain current team? unassign?) — the same ambiguity-avoidance reasoning the Customers spec applied to keeping `Property.customerId` out of `UpdatePropertyInput` entirely.
- **No `UpdateTeam`, no delete for either object** matches the issue's Definition of Done exactly and mirrors both prior slices' precedent of shipping only the lifecycle operations a slice actually needs.
- **`GetCleaner`/`GetTeam` added despite not being named in the issue's Application bullet** — see §4.5's inline rationale; this is the one point in this specification where the author (not the issue) makes an addition, and it is called out for M3 to explicitly confirm or reject rather than silently ship.
- **No REST surface** — GraphQL-only is the Phase 1 default for every module without a pre-existing REST consumer (`bookings` is the sole legacy exception); `cleaners` has none.

## 6. Acceptance criteria (for this specification)

- The domain objects, application operations, RBAC matrix, audit mapping, and GraphQL surface are confirmed correct against the project owner's intent, including the single-team-membership decision (§4.1, §5) and the `GetCleaner`/`GetTeam` addition (§4.5, §5).
- No open contradiction with the Accepted Phase 1 Design or Accepted Admin Foundation spec.
- Scope boundaries (§2) are explicit enough that M4 planning does not need to make further scope decisions.
- The team-assignment model (single FK vs. many-to-many) and the audit `entityType` choice for `assignCleanerToTeam` (§4.4) are explicitly confirmed, not assumed.

## 7. Non-goals

- Redesigning any Admin Foundation contract (`AuthGuard`, `@Roles()`, `@CurrentUser()`, `AuditLogger`, JWT/session mechanics) or any Customers & Properties contract — all consumed as-is.
- Any `modules/bookings` or future `modules/jobs` change — team/cleaner-to-job assignment is M6's concern per Phase 1 Design §4 dependency order.
- Pagination, search, filtering, multi-team membership, delete/deactivate, or cleaner availability/scheduling — all explicitly deferred per §2.
