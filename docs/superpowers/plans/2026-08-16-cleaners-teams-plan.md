# Cleaners & Teams: Implementation Plan

| Field | Value |
| --- | --- |
| **Status** | Draft |
| **Date** | 2026-08-16 |
| **Tracking** | [#3](https://github.com/rexescario-dev/clensy-platform/issues/3) (milestone M3 — Cleaners & Teams) |
| **Package/repo scope** | `apps/api` (new: `modules/cleaners`; modified: `app/app.module.ts`, `platform/database/data-source.ts`); `apps/web` (new: `/cleaners`, `/cleaners/[id]`, `/cleaners/teams`, `/cleaners/teams/[id]`; modified: `middleware.ts`); `packages/client` (new operation documents + regenerated codegen output) |
| **Depends on (Accepted)** | [Cleaners & Teams Specification](../specs/2026-08-16-cleaners-teams-design.md) — Status: Accepted, 2026-08-16. Also relies on the already-Accepted [Admin Foundation](../specs/2026-08-14-admin-foundation-design.md) and [Customers & Properties](../specs/2026-08-15-customers-properties-design.md) specs/plans for `AuthGuard`, `@Roles()`, `@CurrentUser()`, `AuditLogger`/`runAuditInTransaction`, `ConflictException`-on-`23505` translation, and the `apps/web` bootstrap (Next.js, Apollo Client, `packages/ui`) they already shipped — none of that is re-implemented here. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M4 |
| **Revision note** | M5 round 1 (reviewer: project owner) returned the draft for precision/testability fixes, not a redesign: `CleanerType`'s exclusion of a raw `teamId` scalar made explicit (§2, §5) rather than left implicit; the N+1 batching invariant given an actual query-count test (Task 6, `jest.spyOn` on the real bulk service methods) in addition to the prior functional-only proof; Task 6's RBAC/Analyst fixtures now created within the suite itself rather than left as "implementer's choice"; the loader's grouping code simplified to a plain `Map`/`for` loop with the unsafe `!` assertion's necessity explained instead of asserted away; failed-mutation audit semantics and `UpdateCleanerInput`'s omitted-vs-`null` distinction made explicit; the `Object.assign`/object-spread rule reframed as a contract with a recommended mechanism rather than a single mandated implementation; `app.module.ts`'s dependency wording corrected; the DI-resolution test renamed `cleaners.module.di.spec.ts` to distinguish it from Task 4's actual composition-root concern; Task 5's refetch/error-handling behavior stated explicitly. M5 round 2 caught two genuine plan-internal bugs the round-1 edit introduced or left behind: Task 2's `updateCleaner` bullet still described `Object.assign(entity, command)` (would have assigned `actorId` onto `CleanerEntity`) despite §3's contract already forbidding it, and Task 3's `CleanerType`/`toCleanerType()` description (`Omit<CleanerType, 'team'>`) would have stripped `teamId` from the object `Cleaner.team`'s resolver needs to read at runtime — both fixed, along with Task 3's stale duplicate copy of the loader code (now points at §3's single copy instead of re-describing it), a precise (count + argument-length) batching assertion, an explicit request-isolation e2e test, an `updateCleaner`-path duplicate-email test, an `updatedAt`-assertion anti-flake fix (`>=` with the second audit event as primary proof), and the `23505`/uniqueness wording tightened per the reviewer's precision note. `listTeamCleaners` was reviewed for possible removal as apparently-unused; kept, because the Accepted spec (§4.2, §4.5) names it as a required operation independent of the batching mechanism — see Task 2's inline rationale. |
| **M5 decision** | **Pending** — one item (the `dataloader` dependency) requires explicit approve/reject before Accept; all other M5 round 1 and round 2 findings applied. |

Where this plan and the Accepted specification disagree, the specification wins and this plan must be revised.

## 1. Delivery intent

Implement exactly what the Accepted specification authorizes: `modules/cleaners` (`Cleaner`, `Team` domain objects; `CleanersService`/`TeamsService` application layer; TypeORM infrastructure; GraphQL presentation per spec §4.5), gated by `AuthGuard`/`@Roles()` per spec §4.3, audit-logged per spec §4.4, and the `apps/web` `/cleaners`, `/cleaners/[id]`, `/cleaners/teams`, `/cleaners/teams/[id]` screens per spec §4.6. Not a redesign of any of it — every behavioral decision below traces to the Accepted spec or is called out explicitly as an M4 implementation choice the spec deliberately left open.

## 2. Constraints (SHALL / SHALL NOT)

Not every constraint below is a verbatim restatement of the spec — some are M4 clarification decisions the spec deliberately left open (exact exception types, the batching mechanism, the `ON DELETE` policy's concrete migration shape). Each is cited to a spec section where the *behavior* is normative; where the citation says "implements §X," the specific mechanism is this plan's choice, not the spec's. §3 collects the M4-only decisions separately for anything not directly traceable this way.

**SHALL** (traced to spec section):
- `Cleaner` domain object has no `team` field; `Team` domain object has no `cleaners` field. Both are reached only through the GraphQL presentation layer, never a domain- or ORM-level relation (§4.1, §4.5).
- `Cleaner.teamId` is settable only via `assignCleanerToTeam` — never a field of `CreateCleanerInput`/`UpdateCleanerInput` (§4.1, §4.2).
- **`CleanerType` does not expose a raw `teamId` scalar field.** Team membership is represented on the GraphQL surface exclusively through the computed, nullable `team` field (§4.5). The spec fixes `team` as the exposed representation but does not separately enumerate `CleanerType`'s full field list, so this exclusion is an M4 planning decision, not a spec restatement — recorded here rather than left implicit, per the M5 review that flagged the ambiguity. (Contrast with `PropertyType.customerId`, which *is* exposed: `Property` has no reciprocal computed field pointing back at its parent, so the raw FK was the only way to reference it; `Cleaner` has no such gap, since `team` already covers that direction.)
- `Cleaner.teamId → Team.id` foreign key policy is `ON DELETE RESTRICT`, never `CASCADE`/`SET NULL` (§4.1).
- `id`, `createdAt`, `updatedAt` on both entities are server-generated and never accepted as client input on any mutation (§4.1).
- `updateCleaner` uses **partial-update semantics**: omitted input fields retain their current value; provided fields are applied; the resulting full entity state is revalidated against §4.7's non-empty invariants (§4.2, §4.7).
- `getCleaner`/`getTeam` return `null` when the id does not exist; `updateCleaner`/`assignCleanerToTeam` throw `NotFoundException` when their target id does not exist; `assignCleanerToTeam` also throws `NotFoundException` when `teamId` does not reference an existing `Team` (§4.2).
- `Cleaner.email`'s domain invariant is non-empty only; syntax validation is a presentation/input-layer concern, not a domain rule (§4.7) — same split as `Customer.email`.
- `Cleaner.email` and `Team.name` MUST be unique (database-enforced); `Cleaner.phone` is explicitly not unique (§4.7).
- A same-state `assignCleanerToTeam` call (requested `teamId` equals the cleaner's current `teamId`) succeeds — it is not an error — and is still audited and still bumps `updatedAt`, exactly like any other successful call; no diff check suppresses either effect, for either `assignCleanerToTeam` or `updateCleaner` (§4.2, §4.4).
- Every operation requires `AuthGuard`; no operation in this module is public (§4.3).
- `@Roles()` per the matrix in spec §4.3: Owner/Ops Manager may create/update cleaners, create teams, and assign cleaners to teams; Owner/Ops Manager/Scheduler/Analyst may view (get/list); Customer Support and Finance have no access in this slice.
- Each successful mutation (`createCleaner`, `updateCleaner`, `createTeam`, `assignCleanerToTeam`) produces exactly one audit event, persisted in the same database transaction as its state change, using the existing `runAuditInTransaction` mechanism from `platform/audit` (§4.4, inherited from Admin Foundation spec §4.6). No new audit failure behavior, retry logic, or async delivery is introduced. A mutation that does not reach a successful state change — a `NotFoundException`/`ConflictException`/`BadRequestException` thrown before `manager.save()`, or a validation failure — produces **no** audit event; state change and audit event commit atomically, or neither happens.
- Audit `action`/`entityType` values are exactly: `cleaner.create`/`cleaner`, `cleaner.update`/`cleaner`, `team.create`/`team`, `cleaner.assign_team`/`cleaner` (§4.4) — `assignCleanerToTeam`'s event is scoped to the `Cleaner` entity, never `Team`.
- GraphQL surface is exactly: `cleaner`, `cleaners`, `team`, `teams`, `createCleaner`, `updateCleaner`, `createTeam`, `assignCleanerToTeam` — no others, and specifically no standalone `teamCleaners` query (§4.5). `Team.cleaners` and `Cleaner.team` are GraphQL-only computed fields.
- Computed relationship fields (`Team.cleaners`, `Cleaner.team`) MUST NOT resolve via one database query per parent row when resolving a list result (§4.5) — see §3 for the concrete batching mechanism.
- GraphQL object types are explicitly-defined presentation types, not domain interfaces or TypeORM entities used directly (matches the Admin Foundation/Customers precedent this spec inherits).
- `/cleaners` and `/cleaners/:path*` are added to `apps/web/middleware.ts`'s route-group matcher, using the same cookie-presence-only UX-hint check already in place for `/admin`/`/customers` — no new auth mechanism (§4.6).
- One e2e covers create cleaner → create team → assign, per spec §2/Phase 1 Design §5.

**SHALL NOT** (explicit spec/design non-goals — do not invent):
- No delete/deactivate operation for `Cleaner` or `Team` (spec §2).
- No `UpdateTeam` operation (spec §2).
- No cleaner availability, scheduling, shift status, or capacity concept (spec §2).
- No multi-team membership — `Cleaner.teamId` is a single scalar FK, never a join table (spec §2, §4.1).
- No change to `modules/bookings` or a future `modules/jobs` (spec §2, §7).
- No cleaner-facing authentication or account (spec §2).
- No search, filtering, sorting, or pagination beyond a full-set list (spec §2).
- No REST surface for this module (spec §2, §5).
- No redesign of any Admin Foundation, Customers & Properties, or Cleaners & Teams spec contract (`AuthGuard`, `@Roles()`, `@CurrentUser()`, `AuditLogger`, session/JWT mechanics, the unconditional mutation/audit convention) (spec §7).
- No cross-module, diff-aware audit-suppression mechanism (spec §7) — the unconditional-audit decision above is final for this slice.

## 3. Implementation decisions (M4 choices)

The specification leaves these implementation details open; this plan fixes them for M6 execution so no implementer has to choose alone:

- **No TypeORM relation decorator anywhere for `Cleaner.teamId`.** The column is a plain `@Column({ type: 'uuid', nullable: true })`, and the foreign key constraint (`REFERENCES team_entity(id) ON DELETE RESTRICT`) is added directly in the migration's raw SQL, not via `@ManyToOne`/`@OneToMany` — the identical mechanism the Customers & Properties plan used for `Property.customerId`, applied here for the identical reason (spec §4.1's ban on an ORM relation existing merely to support GraphQL nesting). `CleanersService` queries by `teamId` directly (`findBy({ teamId })`), never through a relation.
- **`UpdateCleanerInput` uses `PartialType(CreateCleanerInput)`** (`@nestjs/graphql`), the same mechanism `UpdateCustomerInput`/`UpdatePropertyInput` already use. It takes `id` as a separate mutation argument (`updateCleaner(id: ID!, input: UpdateCleanerInput!)`), matching the Customers precedent, not `updateBooking`'s embedded-id pattern. `CreateTeamInput` has no `PartialType` counterpart — there is no `UpdateTeam` (spec §2). `UpdateCleanerInput` preserves GraphQL's omitted-vs-`null` distinction: a field the caller does not include in the request is not assigned at all and the cleaner's existing value is retained; `notes: null` is a value the caller explicitly sent and clears the persisted `notes`. This is the mechanism the "omitted retains, provided applies" constraint in §2 depends on, not a separate behavior.
- **Contract: `updateCleaner` MUST only ever assign fields represented by `UpdateCleanerCommand`'s non-`actorId` fields onto the entity — never `actorId` itself, `teamId`, `id`, or either timestamp — regardless of the exact code used to apply them.** The concrete mechanism this plan specifies has two parts, both required: object spread at the resolver (`{ ...input, actorId }`, never manual per-field listing), because manual field-by-field listing of a fully-optional `PartialType` input would materialize `undefined` for every omitted key, and `Object.assign` would then use those `undefined`s to overwrite the entity's existing values — silently breaking the omitted-fields-retain-current-value guarantee; and, in the service, destructuring `actorId` out of `command` *before* the `Object.assign` call (`const { actorId, ...changes } = command; Object.assign(entity, changes);`), never `Object.assign(entity, command)` directly, because `command` itself carries `actorId` and `CleanerEntity` has no such property to receive it. An implementer may use an equivalent mechanism that satisfies the same contract; this plan's recommendation matches what `CustomersService`/`PropertiesService` already do, not because no other correct implementation exists.
- **`CleanersService`/`TeamsService` follow the `AdminsService`/`CustomersService` transaction/audit pattern exactly** — the transaction wrapper and the audit call within it, together:
  ```ts
  async createCleaner(command: CreateCleanerCommand): Promise<Cleaner> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const entity = manager.create(CleanerEntity, { /* ...fields, teamId: null */ });
        try {
          await manager.save(entity);
        } catch (error) {
          if ((error as { code?: string }).code === POSTGRES_UNIQUE_VIOLATION) {
            throw new ConflictException('Email is already in use');
          }
          throw error;
        }
        await this.auditLogger.log({ actorId: command.actorId, action: 'cleaner.create', entityType: 'cleaner', entityId: entity.id });
        return entity;
      }),
    );
  }
  ```
  `runAuditInTransaction(manager, fn)` only stashes `manager` in `AsyncLocalStorage`; the `this.auditLogger.log(...)` call inside `fn` is the same `@Inject(AUDIT_LOGGER) auditLogger: AuditLogger` constructor-injected dependency `AdminsService`/`CustomersService` already use — nothing new. `assignCleanerToTeam` uses the same wrapper: `manager.findOneBy(TeamEntity, { id: teamId })` (existence check) → `manager.findOneBy(CleanerEntity, { id: cleanerId })` (existence check) → `Object.assign(cleaner, { teamId })` → `manager.save(cleaner)` (unconditionally, including the same-state case, §2) → audit `cleaner.assign_team`. Reads (`getCleaner`, `getTeam`, `listCleaners`, `listTeams`) use plain injected `Repository`s — no transaction needed.
- **Uniqueness enforcement mirrors `AdminsService.create`'s existing pattern exactly**, not a new mechanism: `@Column({ unique: true })` on `CleanerEntity.email` and `TeamEntity.name`; the Postgres `23505` (`unique_violation`) error code caught in `CleanersService.createCleaner`/`updateCleaner` and `TeamsService.createTeam` and translated to `ConflictException('Email is already in use')` / `ConflictException('Team name is already in use')` respectively. Per the Accepted spec §4.7's caution: this works only because, at this slice's current schema, each service owns exactly one client-triggerable unique constraint (`CleanersService` → `CleanerEntity.email`; `TeamsService` → `TeamEntity.name`) — the catch block does not itself know *which* constraint fired, it simply has no second possibility to distinguish from. A later slice that adds a second unique constraint to either entity would reintroduce the ambiguity the spec warns about, and its `23505` handling would then need to inspect the driver error's constraint name rather than assuming.
- **Resulting-state validation lives in the application service, not the domain layer and not GraphQL alone** — identical pattern and rationale to `CustomersService`/`PropertiesService.assertValid`. `CleanersService` gets a private `assertValid(cleaner: Pick<Cleaner, 'fullName' | 'phone' | 'email'>): void` (throws `BadRequestException` if any is empty/whitespace-only after `.trim()`), called against the entity's full resulting state — the freshly built field set on `createCleaner`, the post-`Object.assign` merged entity on `updateCleaner` — always *before* `manager.save()`, never after. `TeamsService` gets the equivalent single-field check for `name` in `createTeam` only (no `updateTeam` exists).
- **Email syntax validation**: `@IsEmail()` (`class-validator`) on `CreateCleanerInput.email`, consistent with spec §4.7's presentation-layer-only placement — identical to `CreateCustomerInput.email`.
- **`Cleaner.teamId` gets a plain (non-unique) index** (`@Index()`) — every `listCleanersByTeamIds` bulk lookup (§3 below) filters on it; not spec-mandated, low-risk, consistent with `Property.customerId`'s existing precedent.
- **Two migrations, not one — `AddTeam` (Task 1) then `AddCleaner` (Task 2, adds the FK to the already-existing `team_entity` table).** `Team` is created first even though a `Cleaner` can exist without a team, because the FK direction requires `team_entity` to exist before `cleaner_entity`'s constraint can reference it — the identical ordering logic the Customers plan used for `Customer`-before-`Property`, just with the dependency direction determined by the FK rather than by which object is created first in a user workflow. Because `CleanerEntity.teamId` carries no TypeORM relation metadata (above), `pnpm migration:generate` cannot infer the foreign key; the generated `AddCleaner` migration only produces the table/column baseline, and the FK constraint (`ALTER TABLE cleaner_entity ADD CONSTRAINT fk_cleaner_team FOREIGN KEY ("teamId") REFERENCES team_entity(id) ON DELETE RESTRICT`, with the matching `DROP CONSTRAINT` in `down()`) is hand-added and becomes the sole, authoritative source of the FK — it must not be regenerated from entity metadata later, identical to the Customers plan's `AddProperty` precedent.
- **N+1 batching mechanism for `Cleaner.team`/`Team.cleaners` (spec §4.5's normative invariant): per-GraphQL-request `dataloader` instances, one new npm dependency.** Unlike the Customers & Properties slice (which had one non-reciprocal computed field and explicitly accepted N+1 as a recorded tradeoff, since its spec left that door open), this spec's §4.5 normatively forbids one-query-per-parent for both `Cleaner.team` and `Team.cleaners`. The concrete mechanism: a new request-scoped (`@Injectable({ scope: Scope.REQUEST })`) provider, `CleanerTeamLoaders` (`apps/api/src/modules/cleaners/presentation/graphql/cleaner-team.loaders.ts`), constructed fresh per GraphQL request and holding two `DataLoader` instances:
  ```ts
  this.teamLoader = new DataLoader<string, Team | null>(async (ids) => {
    const teams = await this.teamsService.getTeamsByIds([...ids]);
    const byId = new Map(teams.map((team) => [team.id, team]));
    return ids.map((id) => byId.get(id) ?? null);
  });

  this.teamCleanersLoader = new DataLoader<string, Cleaner[]>(async (teamIds) => {
    const cleaners = await this.cleanersService.listCleanersByTeamIds([...teamIds]);
    const cleanersByTeamId = new Map<string, Cleaner[]>();
    for (const cleaner of cleaners) {
      const existing = cleanersByTeamId.get(cleaner.teamId as string);
      if (existing) {
        existing.push(cleaner);
      } else {
        cleanersByTeamId.set(cleaner.teamId as string, [cleaner]);
      }
    }
    return teamIds.map((teamId) => cleanersByTeamId.get(teamId) ?? []);
  });
  ```
  `teamLoader`'s batch function calls a new bulk method, `TeamsService.getTeamsByIds(ids)` → `Repository<TeamEntity>.findBy({ id: In(ids) })`, then re-maps results into the loader's required same-length/same-order response. `teamCleanersLoader`'s batch function calls a new bulk method, `CleanersService.listCleanersByTeamIds(teamIds)` → `Repository<CleanerEntity>.findBy({ teamId: In(teamIds) })`; every row this bulk method returns matched `teamId: In(teamIds)`, so `cleaner.teamId` is never `null` inside this specific batch function — the `as string` reflects that guarantee rather than asserting away a real risk. `CleanerResolver`/`TeamResolver` inject `CleanerTeamLoaders` (Nest automatically promotes them to request scope as a result); `Cleaner.team`'s `@ResolveField` calls `loaders.teamLoader.load(cleaner.teamId)` (short-circuits to `null` without a loader call when `cleaner.teamId` is `null`); `Team.cleaners`'s `@ResolveField` calls `loaders.teamCleanersLoader.load(team.id)`. The Accepted spec (§4.5) normatively requires request-level batching for both computed fields; `dataloader` provides request-local key batching and per-key caching in a small, single-purpose package, satisfying that requirement with little module-local infrastructure to write and maintain, rather than hand-rolling the tick-coalescing logic it exists to solve — **this one new dependency needs explicit approval before Task 3 is executed; see the chat message accompanying this plan.**
- **No new environment variables or secrets** — this slice introduces no new configuration surface beyond the one dependency above.

## 4. Ownership boundaries

| Owns (this slice) | Must remain untouched |
| --- | --- |
| `apps/api/src/modules/cleaners/**` (new) | `apps/api/src/modules/bookings/**`, `apps/api/src/modules/customers/**` |
| `apps/api/src/app/app.module.ts` (composition root — registers `CleanersModule`) | `apps/api/src/platform/auth/**`, `apps/api/src/platform/audit/**`, `apps/api/src/platform/graphql/**` (consumed read-only, not modified — the batching loaders live entirely inside `modules/cleaners`, §3) |
| `apps/api/src/platform/database/data-source.ts` (add new entities) | `apps/api/src/modules/admins/**` |
| `apps/web/app/cleaners/**` (new) | `apps/web/app/admin/**`, `apps/web/app/customers/**`, `apps/web/app/login/**` |
| `apps/web/middleware.ts` (extend `matcher` only) | Everything else in `apps/web/middleware.ts` |
| `packages/client/src/operations/cleaners.graphql`, `teams.graphql` (new), regenerated `src/generated/graphql.ts` | `packages/client/src/apollo-client.ts`, existing `admins.graphql`/`customers.graphql`/`properties.graphql`/`login.graphql`/etc. |
| `apps/api/package.json` (add `dataloader`, pending approval) | Every other dependency entry |
| — | `packages/ui/**` (consumed as-is; no new primitives needed — `Button`, `DataTable`, `FormField` cover this slice's UI; the team-assignment control is a plain native `<select>`, not a `FormField`, since `FormField` only wraps an `<input>` — see Task 5) |

## 5. Contract inventory (only what the Accepted spec authorizes)

- `Cleaner { id, fullName, phone, email, notes, teamId, createdAt, updatedAt }` (`modules/cleaners/domain` — includes `teamId`, the raw persistence field)
- `Team { id, name, createdAt, updatedAt }` (`modules/cleaners/domain`)
- `CleanerType { id, fullName, phone, email, notes, team, createdAt, updatedAt }` (GraphQL — **no `teamId`**; see §2's `CleanerType`-exposure decision) / `TeamType { id, name, cleaners, createdAt, updatedAt }`
- GraphQL: `cleaner(id)`, `cleaners`, `team(id)`, `teams`, `createCleaner(input)`, `updateCleaner(id, input)`, `createTeam(input)`, `assignCleanerToTeam(cleanerId, teamId)` (spec §4.5) — exactly these 8 operations, no others. `Cleaner.team`/`Team.cleaners` are computed GraphQL fields, not separate operations.

Exact internal service/command/file names beyond the above are implementation detail decided per-task below; the spec does not freeze them further and this plan does not either.

## 6. Slice sequence

```text
1. Team     — domain, infrastructure, application, migration        (independent)
2. Cleaner  — domain, infrastructure, application, migration        (depends on 1 — FK to team_entity)
3. GraphQL presentation — CleanerResolver, TeamResolver, loaders     (depends on 1 + 2)
4. apps/api composition root — register CleanersModule               (depends on 3)
5. packages/client operations + apps/web /cleaners screens            (depends on 4)
6. E2E acceptance                                                      (depends on 1-5)
```

Each numbered task below is an independently reviewable slice. Task 4 is a thin regression-check task, matching the Customers & Properties plan's Task 4 precedent — `CleanersModule` needs only a single `imports` addition to `AppModule`, no bespoke cross-module binding.

## 7. TDD / verification strategy

Three test levels, matching the levels both prior slices converged on:

1. **Mocked unit tests** (Jest, `customers.service.spec.ts`'s mocked-`Repository`/`Test.createTestingModule` pattern) for logic that doesn't depend on real transactional behavior: `CleanersService`/`TeamsService`'s not-found errors, `getX`/`listX` read paths, `assertValid`'s rejection of empty fields, and the `CleanerTeamLoaders` batch functions' grouping/ordering logic in isolation (mocked bulk-fetch methods, asserting the loader returns results in the same order/length as the input keys). A mocked `DataSource`/`EntityManager` cannot prove a real rollback or a real unique-constraint violation — this level does not attempt either.
2. **Real-Postgres service-level tests** (mirroring `apps/api/test/customers-properties.service.e2e-spec.ts` exactly: a real `DataSource` against the same local Postgres, services instantiated directly, only `auditLogger` faked) for: the transactional-audit rollback guarantee; the partial-update/explicit-vs-omitted behavior against real persisted rows; the real `23505` → `ConflictException` translation for both `Cleaner.email` and `Team.name` (a mock cannot produce a real unique-constraint violation); and same-state `assignCleanerToTeam` actually re-persisting and re-auditing against a real row (proves the "unconditional, no diff suppression" decision at the persistence level, not just by reading the code).
3. **Integration/e2e** (Jest + Supertest against a real Postgres via `AppModule`, mirroring `customers-properties.e2e-spec.ts`): the full GraphQL-request-to-database golden path in spec §2 (create cleaner → create team → assign), RBAC-denied/view-only cases per the §4.3 matrix, and — distinct from the functional correctness above — a **query-count** proof of the N+1 batching invariant (§3's `dataloader` mechanism), because functional correctness alone cannot distinguish a correctly batched implementation from an N+1 one that happens to return the right data. That test `jest.spyOn`s the real `TeamsService.getTeamsByIds`/`CleanersService.listCleanersByTeamIds` instances resolved from the running `AppModule` (`app.get(TeamsService)`/`app.get(CleanersService)`) and asserts each bulk method is called **exactly once** per GraphQL request, regardless of how many cleaners/teams the request resolves — the signal a mocked batch-function test (level 1) cannot produce, since mocking the bulk method's own inputs/outputs assumes it was called correctly rather than proving how many times the real resolver chain calls it per request. See Task 6.

Level 2 truncates (`.clear()`s) `cleaner_entity`/`team_entity` in `beforeEach`; per the existing advisory-lock precedent, Task 1 adds `apps/api/test/helpers/cleaner-db-test-lock.ts` (identical pattern to `customer-db-test-lock.ts`, new arbitrary lock key), acquired only by the level-2 file. Level 3 (Task 6) follows the established precedent instead — unique-per-run fixture data and id-scoped assertions — so it does not truncate and does not need the lock. `apps/api/test/jest-e2e.json` already runs with `maxWorkers: 1` (Customers & Properties plan's final-review fix), so no additional cross-file race exists to introduce here.

No test-framework changes — reuse the existing `apps/api` Jest config (level-1 unit specs under `apps/api/src/modules/cleaners/tests/`, levels 2–3 under `apps/api/test/`). Task 1 also adds `apps/api/src/modules/cleaners/tests/cleaners.module.di.spec.ts` up front (mirroring `customers.module.composition-root.spec.ts`'s technique, renamed — see the note under Task 1) — the Customers & Properties slice only added this test *after* a review caught a missing `AuditModule` import; this plan includes it from Task 1 so the same class of bug is caught by TDD rather than by a later fix round.

## 8. Task breakdown

### Task 1 — `Team`: domain, infrastructure, application

**Files (new):**
- `apps/api/src/modules/cleaners/domain/team.ts` — plain `Team` interface (§4.1 of spec)
- `apps/api/src/modules/cleaners/infrastructure/persistence/team.entity.ts` — TypeORM entity implementing `Team`. `id` (`@PrimaryGeneratedColumn('uuid')`), `name` (`@Column({ unique: true })`), `createdAt` (`@CreateDateColumn({ type: 'timestamptz' })`), `updatedAt` (`@UpdateDateColumn({ type: 'timestamptz' })`). No relation decorator to `CleanerEntity` (§3 above).
- `apps/api/src/modules/cleaners/application/commands/create-team.command.ts` — `{ actorId: string; name: string }`
- `apps/api/src/modules/cleaners/application/services/teams.service.ts` — `TeamsService`:
  - `createTeam(command)`: transaction + `runAuditInTransaction` (§3's code shape); builds the entity; calls `this.assertValid(entity)`; `manager.save(entity)` inside a `try/catch` translating Postgres `23505` to `ConflictException('Team name is already in use')`; `await this.auditLogger.log({ actorId: command.actorId, action: 'team.create', entityType: 'team', entityId: entity.id })`; returns the entity.
  - `private assertValid(team: Pick<Team, 'name'>): void` — throws `BadRequestException` if `name` is empty/whitespace-only after `.trim()`.
  - `getTeam(id)`: injected `Repository<TeamEntity>.findOneBy({ id })` — `null` if absent.
  - `listTeams()`: injected `Repository<TeamEntity>.find()`.
  - `getTeamsByIds(ids: string[])`: injected `Repository<TeamEntity>.findBy({ id: In(ids) })` — bulk method for Task 3's loader; not exposed over GraphQL directly.
  - Constructor takes `DataSource`, injected `Repository<TeamEntity>`, and `@Inject(AUDIT_LOGGER) auditLogger: AuditLogger`.
- `apps/api/src/modules/cleaners/cleaners.module.ts` — `@Module({ imports: [TypeOrmModule.forFeature([TeamEntity]), AuditModule], providers: [TeamsService], exports: [TeamsService] })` (Task 2 extends this with `CleanerEntity`/`CleanersService`; imports `AuditModule` directly from Task 1, matching `customers.module.ts`'s precedent exactly rather than repeating its original omission)
- `apps/api/src/modules/cleaners/tests/application/teams.service.spec.ts` — mocked-`Repository` unit tests (test level 1, §7)
- `apps/api/src/modules/cleaners/tests/cleaners.module.di.spec.ts` — real DI-resolution proof, mirroring `customers.module.composition-root.spec.ts`'s technique exactly, renamed per the M5 review: this test proves `CleanersModule` can construct its own providers in isolation (a fake global `DataSource` + repository-token overrides, no real Postgres, no `AppModule`), which is a distinct concern from Task 4's proof that `AppModule` actually imports `CleanersModule` — "composition root" more precisely names Task 4's concern, so this file's name reflects what it actually proves (module-internal DI wiring) instead. Task 1 covers `TeamsService`/`AUDIT_LOGGER`, Task 2 extends it with `CleanersService`.
- `apps/api/test/helpers/cleaner-db-test-lock.ts` — advisory-lock helper, identical pattern to `customer-db-test-lock.ts` with a new arbitrary lock key; used only by the level-2 file below
- `apps/api/test/cleaners-teams.service.e2e-spec.ts` — real-Postgres service-level tests (test level 2, §7); this task adds the file and its `Team`/`TeamsService` `describe` block, acquiring/releasing the Task 1 lock helper in `beforeAll`/`afterAll` and `.clear()`-ing `TeamEntity` in `beforeEach`; Task 2 extends the same file with a `Cleaner`/`CleanersService` block (and adds `CleanerEntity` to the `beforeEach` clear)

**Files (modified):**
- `apps/api/src/platform/database/data-source.ts` — add `TeamEntity` to `entities`
- Generate migration: `pnpm migration:generate add team` → new file under `platform/database/migrations/`

**Tests to write first (TDD) — level 1, `teams.service.spec.ts` (mocked `Repository`):**
- `assertValid` (exercised via `createTeam` with a mocked repository): an empty/whitespace-only `name` throws `BadRequestException` before any repository call.
- `getTeam`: returns the team for an existing id; returns `null` for a nonexistent id.
- `listTeams`: returns all teams (empty array when none exist).
- `getTeamsByIds`: given a mocked repository returning teams for a subset of requested ids, returns exactly those (no synthetic entries for missing ids — the loader in Task 3 handles the gap-filling).

**Tests to write first (TDD) — level 2, `cleaners-teams.service.e2e-spec.ts` (real Postgres, faked `auditLogger` only):**
- `createTeam`: persists a `TeamEntity` with the given `name`; `auditLogger.log` called with `{ actorId, action: 'team.create', entityType: 'team', entityId }`. A second `createTeam` with the same `name` throws `ConflictException`, and only one row exists afterward. With `auditLogger.log` mocked to reject, `createTeam` rejects and no row exists afterward (real rollback proof).

**Traceability:** spec §4.1, §4.2, §4.4, §4.7.

### Task 2 — `Cleaner`: domain, infrastructure, application

**Files (new):**
- `apps/api/src/modules/cleaners/domain/cleaner.ts` — plain `Cleaner` interface (§4.1 of spec)
- `apps/api/src/modules/cleaners/infrastructure/persistence/cleaner.entity.ts` — TypeORM entity implementing `Cleaner`. `id` (`@PrimaryGeneratedColumn('uuid')`), `fullName`/`phone` (`@Column()`), `email` (`@Column({ unique: true })`), `notes` (`@Column({ type: 'text', nullable: true })`), `teamId` (`@Column({ type: 'uuid', nullable: true }) @Index()`, plain column, no relation decorator — §3 above), `createdAt`/`updatedAt` (`@CreateDateColumn`/`@UpdateDateColumn`, `type: 'timestamptz'`).
- `apps/api/src/modules/cleaners/application/commands/create-cleaner.command.ts` — `{ actorId: string; fullName: string; phone: string; email: string; notes?: string | null }` (no `teamId` — §2 above)
- `apps/api/src/modules/cleaners/application/commands/update-cleaner.command.ts` — `{ actorId: string; fullName?: string; phone?: string; email?: string; notes?: string | null }` (no `teamId`)
- `apps/api/src/modules/cleaners/application/commands/assign-cleaner-to-team.command.ts` — `{ actorId: string; cleanerId: string; teamId: string }`
- `apps/api/src/modules/cleaners/application/services/cleaners.service.ts` — `CleanersService`:
  - `createCleaner(command)`: transaction + `runAuditInTransaction`; builds the entity's fields from `command` (`notes: command.notes ?? null`, `teamId: null`); calls `this.assertValid(entity)`; `manager.save(entity)` inside a `try/catch` translating `23505` to `ConflictException('Email is already in use')`; logs `cleaner.create`; returns the entity.
  - `updateCleaner(id, command)`: same transaction/audit wrapper; `manager.findOneBy(CleanerEntity, { id })`, throws `NotFoundException('Cleaner ${id} not found')` if absent; `const { actorId, ...changes } = command; Object.assign(entity, changes);` — **never `Object.assign(entity, command)` directly**, since `command.actorId` is audit metadata, not a `Cleaner` field, and `CleanerEntity` has no `actorId` property to receive it (an M5 review caught this exact bug in this plan's own text: an earlier draft of this bullet described `Object.assign(entity, command)`, which would have assigned `actorId` onto the entity, contradicting §3's own contract); calls `this.assertValid(entity)`; `manager.save(entity)` with the same `23505` → `ConflictException` translation; logs `cleaner.update` using the destructured `actorId`; returns the entity.
  - `assignCleanerToTeam(command)`: same transaction/audit wrapper; `manager.findOneBy(TeamEntity, { id: command.teamId })`, throws `NotFoundException('Team ${command.teamId} not found')` if absent; `manager.findOneBy(CleanerEntity, { id: command.cleanerId })`, throws `NotFoundException('Cleaner ${command.cleanerId} not found')` if absent; `Object.assign(entity, { teamId: command.teamId })`; `manager.save(entity)` unconditionally (including when `entity.teamId` already equalled `command.teamId` — §2's same-state rule, no pre-check short-circuits this); logs `cleaner.assign_team` with `entityType: 'cleaner'`, `entityId: entity.id`; returns the entity.
  - `private assertValid(cleaner: Pick<Cleaner, 'fullName' | 'phone' | 'email'>): void` — throws `BadRequestException` if any is empty/whitespace-only after `.trim()`.
  - `getCleaner(id)`: injected `Repository<CleanerEntity>.findOneBy({ id })` — `null` if absent.
  - `listCleaners()`: injected `Repository<CleanerEntity>.find()`.
  - `listTeamCleaners(teamId)`: injected `Repository<CleanerEntity>.findBy({ teamId })` — `[]` for a team with no members, no existence check on `teamId` (spec §4.2, §4.5 — a formally spec-named operation, not this plan's invention; kept even though Task 3's `Team.cleaners` resolver does not call it directly — see below).
  - `listCleanersByTeamIds(teamIds: string[])`: injected `Repository<CleanerEntity>.findBy({ teamId: In(teamIds) })` — bulk method for Task 3's loader; not exposed over GraphQL directly. **This method exists alongside `listTeamCleaners`, not instead of it** — an M5 review questioned why both exist, since only this bulk method is actually called from `Team.cleaners`'s resolver. The Accepted spec (§4.2, §4.5) explicitly names `ListTeamCleaners`/`listTeamCleaners(teamId)` as a required application-layer operation and states `Team.cleaners` is conceptually "backed by" it; the spec's separate, later N+1 invariant (§4.5) deliberately leaves the *batching mechanism* unspecified. This plan reads those two spec statements together as: `listTeamCleaners` is the required single-team application operation (available to any future single-team caller, and satisfying the spec's named-surface requirement), while `listCleanersByTeamIds` is this plan's M4-only addition for the mechanism that makes list resolution comply with the N+1 invariant. Removing `listTeamCleaners` to avoid the apparent duplication, as the review suggested, would under-implement an operation the Accepted spec names explicitly — this plan keeps both rather than resolve that tension unilaterally in the direction of removing spec-authorized surface.
  - Constructor takes `DataSource`, injected `Repository<CleanerEntity>`, injected `Repository<TeamEntity>` (for `assignCleanerToTeam`'s existence check), and `@Inject(AUDIT_LOGGER) auditLogger: AuditLogger`.
- `apps/api/src/modules/cleaners/tests/application/cleaners.service.spec.ts` — mocked-`Repository` unit tests (test level 1, §7)

**Files (modified):**
- `apps/api/src/modules/cleaners/cleaners.module.ts` — add `CleanerEntity` to `TypeOrmModule.forFeature([...])`, add `CleanersService` to `providers`/`exports`
- `apps/api/src/platform/database/data-source.ts` — add `CleanerEntity` to `entities`
- Generate migration: `pnpm migration:generate add cleaner` → new file under `platform/database/migrations/`; hand-edit to add the foreign key constraint (`ALTER TABLE cleaner_entity ADD CONSTRAINT fk_cleaner_team FOREIGN KEY ("teamId") REFERENCES team_entity(id) ON DELETE RESTRICT`, with the matching `DROP CONSTRAINT` in `down()`) — authoritative source of the FK, not to be regenerated later (§3)
- `apps/api/test/cleaners-teams.service.e2e-spec.ts` — extend with the `Cleaner`/`CleanersService` `describe` block (Task 1 created the file); add `CleanerEntity` to the shared `beforeEach` `.clear()`
- `apps/api/src/modules/cleaners/tests/cleaners.module.di.spec.ts` — extend to prove `CleanersService` also resolves

**Tests to write first (TDD) — level 1, `cleaners.service.spec.ts` (mocked `Repository`):**
- `updateCleaner`: nonexistent `id` throws `NotFoundException`. No test attempts to update `teamId` via `updateCleaner` — the command type has no such field, a compile-time guarantee.
- `assertValid` (exercised via `createCleaner`/`updateCleaner` with mocked repositories): an empty/whitespace-only `fullName`, `phone`, or `email` throws `BadRequestException` before any repository call.
- `assignCleanerToTeam`: nonexistent `cleanerId` throws `NotFoundException` (mocked cleaner lookup returns `undefined`, checked after the team lookup succeeds); nonexistent `teamId` throws `NotFoundException` (mocked team lookup returns `undefined`) without a cleaner lookup being attempted.
- `getCleaner`/`listCleaners`/`listTeamCleaners`/`listCleanersByTeamIds`: existing-id/empty-result read-path cases, mirroring the Customers precedent's read-method tests.

**Tests to write first (TDD) — level 2, `cleaners-teams.service.e2e-spec.ts` (real Postgres, faked `auditLogger` only):**
- `createCleaner`: persists a `CleanerEntity` with `teamId: null`; `auditLogger.log` called with `cleaner.create`. A second `createCleaner` with a duplicate `email` throws `ConflictException`, no second row persisted. With `auditLogger.log` mocked to reject, the row does not exist afterward (rollback proof).
- `updateCleaner`: a command with only `phone` set leaves `fullName`/`email`/`notes` unchanged in the re-read row; `notes: null` explicitly clears an existing value (proves explicit-null-vs-omitted against real persisted state, mirroring the Customers precedent). **Given two persisted cleaners A and B, updating B with B's own `email` set to A's `email` throws `ConflictException`, and B's row is unchanged on re-read** — the same `23505` → `ConflictException` translation `createCleaner` already proves, exercised through the `updateCleaner` code path specifically, since it's a separate `try/catch` around a separate `manager.save()` call (§3).
- `assignCleanerToTeam`: given a persisted `Cleaner` and two persisted `Team`s, assigning to the first team sets `teamId` and audits `cleaner.assign_team`. Assigning to the same team again re-persists and audits a **second** `cleaner.assign_team` event — the concrete proof of the "unconditional, no same-state suppression" decision (§2) against a real row and a real audit table, not just the mocked level-1 path; the second audit event's existence is the test's primary proof, not `updatedAt`. As a secondary, non-blocking check, `updatedAt` after the same-state call is asserted `>=` (not strictly `>`) its value before — Postgres `timestamptz` has sub-millisecond resolution and two real `manager.save()` round trips are extremely unlikely to tie, but the assertion tolerates a tie rather than risk a flaky failure on an assertion that isn't this test's actual point. Given a nonexistent `teamId`, throws `NotFoundException` and the cleaner's `teamId` is unchanged afterward.

**Traceability:** spec §4.1, §4.2, §4.4, §4.7.

### Task 3 — GraphQL presentation

**Files (new):**
- `apps/api/src/modules/cleaners/presentation/graphql/cleaner.type.ts` — `@ObjectType('Cleaner')` class declares `@Field()`s for exactly: `id` (`ID`), `fullName`, `phone`, `email`, `notes` (nullable), `team` (`TeamType`, nullable), `createdAt`, `updatedAt` — no `@Field()` for `teamId`, so GraphQL's schema/introspection never exposes it and no client can query it (§2's `CleanerType`-exposure decision). **`toCleanerType(cleaner: Cleaner): CleanerType`, however, maps every field of the domain `Cleaner` onto the returned object unchanged — including `teamId` — and only casts the result to `CleanerType` for the resolver method's declared return type.** GraphQL field exposure is controlled entirely by a class's `@Field()` decorators, not by which properties happen to exist on the runtime object; a property with no matching `@Field()` is simply invisible to the schema, but it remains an ordinary, readable property on the plain JS object NestJS passes into `@ResolveField()`'s `@Parent()` argument for that same object. This is what lets `Cleaner.team`'s field resolver (below) read `cleaner.teamId` at runtime despite `teamId` never appearing in the public schema — an M5 review flagged an earlier version of this bullet (`Omit<CleanerType, 'team'>`) as ambiguous about exactly this, since an `Omit`-based mapper return type would in fact have stripped `teamId` and left the `team` resolver with nothing to key off. The `@ResolveField()` method's own `@Parent()` parameter is typed `Pick<Cleaner, 'id' | 'teamId'>` (not `CleanerType`) to make this dependency on the domain shape explicit rather than implicit through a cast.
- `apps/api/src/modules/cleaners/presentation/graphql/team.type.ts` — `@ObjectType('Team')`: `id`, `name`, `cleaners` (`[CleanerType!]!`, resolved exclusively via `@ResolveField`), `createdAt`, `updatedAt`. Same `Omit<TeamType, 'cleaners'>` base-return-type pattern.
- `apps/api/src/modules/cleaners/presentation/graphql/create-cleaner.input.ts` — `@InputType()`: `fullName`, `phone`, `email` (`@IsEmail()`), `notes` (nullable, optional) — no `teamId`
- `apps/api/src/modules/cleaners/presentation/graphql/update-cleaner.input.ts` — `@InputType() class UpdateCleanerInput extends PartialType(CreateCleanerInput) {}`
- `apps/api/src/modules/cleaners/presentation/graphql/create-team.input.ts` — `@InputType()`: `name`
- `apps/api/src/modules/cleaners/presentation/graphql/cleaner-team.loaders.ts` — `@Injectable({ scope: Scope.REQUEST }) class CleanerTeamLoaders`, constructed with `TeamsService`/`CleanersService` injected, holding `teamLoader`/`teamCleanersLoader` exactly as specified in §3's code block above — that code block is this file's authoritative content; it is not repeated or re-derived here to avoid the two copies drifting apart (an earlier revision of this plan had exactly that drift: §3 was fixed to the simplified `Map`/`for`-loop grouping in one review round, but this task's own inline description still showed the older, unsafe one-line expression until the next round caught it).
- `apps/api/src/modules/cleaners/presentation/graphql/cleaner.resolver.ts` — `CleanerResolver`:
  - `@Query(() => CleanerType, { name: 'cleaner', nullable: true })` `cleaner(@Args('id', { type: () => ID }) id)` → `CleanersService.getCleaner`, mapped, `@UseGuards(AuthGuard) @Roles(Role.OWNER, Role.OPS_MANAGER, Role.SCHEDULER, Role.ANALYST)` (view matrix)
  - `@Query(() => [CleanerType], { name: 'cleaners' })` → `CleanersService.listCleaners`, same guard/roles
  - `@Mutation(() => CleanerType)` `createCleaner` / `updateCleaner` → `@UseGuards(AuthGuard) @Roles(Role.OWNER, Role.OPS_MANAGER)`, builds the command via `{ ...input, actorId: currentUser.id }`, calls `CleanersService.createCleaner`/`.updateCleaner`
  - `@Mutation(() => CleanerType)` `assignCleanerToTeam(@Args('cleanerId') cleanerId, @Args('teamId') teamId, @CurrentUser() currentUser)` → same write-matrix guard/roles, calls `CleanersService.assignCleanerToTeam({ actorId: currentUser.id, cleanerId, teamId })`
  - `@ResolveField(() => TeamType, { nullable: true })` `team(@Parent() cleaner: Pick<Cleaner, 'id' | 'teamId'>)` — reads `CleanerTeamLoaders` from the resolver's own constructor-injected field (request-scoped provider, §3 — not `@Context()`) → returns `null` immediately if `cleaner.teamId` is `null`, otherwise `this.loaders.teamLoader.load(cleaner.teamId)`, mapped to `TeamType`. The parent parameter is deliberately typed against the domain `Cleaner`, not `CleanerType` (see `cleaner.type.ts` above), since `teamId` is exactly the field the public GraphQL type omits.
- `apps/api/src/modules/cleaners/presentation/graphql/team.resolver.ts` — `TeamResolver`:
  - `@Query(() => TeamType, { name: 'team', nullable: true })`, `@Query(() => [TeamType], { name: 'teams' })` — same view-matrix guard/roles as `CleanerResolver`'s queries
  - `@Mutation(() => TeamType)` `createTeam` — same write-matrix guard/roles, `{ ...input, actorId: currentUser.id }`, calls `TeamsService.createTeam`
  - `@ResolveField(() => [CleanerType])` `cleaners(@Parent() team: TeamType)` → `loaders.teamCleanersLoader.load(team.id)`, mapped to `CleanerType[]`
- `apps/api/src/modules/cleaners/presentation/graphql/mappers.ts` — `toCleanerType`, `toTeamType` (from the outset, matching the Customers & Properties M8 refactor's end state rather than starting with duplicated inline mapping and refactoring later)
- `apps/api/src/modules/cleaners/tests/graphql/cleaner.resolver.spec.ts`, `team.resolver.spec.ts`
- `apps/api/src/modules/cleaners/tests/graphql/cleaner-team.loaders.spec.ts` — unit tests for the loader batch functions in isolation (mocked `TeamsService.getTeamsByIds`/`CleanersService.listCleanersByTeamIds`): given keys `[a, b, c]` and a bulk result covering only `a` and `c`, `teamLoader`'s batch function returns `[team_a, null, team_c]` in that exact order; `teamCleanersLoader`'s batch function returns `[[], [...cleaners for b]]`-shaped results for teams with and without members, in input-key order

**Files (modified):**
- `apps/api/src/modules/cleaners/cleaners.module.ts` — add `CleanerResolver`, `TeamResolver`, `CleanerTeamLoaders` to `providers`
- `apps/api/package.json` — add `dataloader` dependency (pending approval, §3)

**Tests to write first (TDD):**
- Resolver-level (reflected-metadata technique, matching `customer.resolver.spec.ts`): `createCleaner`/`updateCleaner`/`createTeam`/`assignCleanerToTeam` are decorated with `AuthGuard` and `@Roles(Role.OWNER, Role.OPS_MANAGER)` (write matrix). `cleaner`/`cleaners`/`team`/`teams` are decorated with `AuthGuard` and `@Roles(Role.OWNER, Role.OPS_MANAGER, Role.SCHEDULER, Role.ANALYST)` (view matrix — Customer Support and Finance excluded, per spec §4.3).
- `CleanerType`/`TeamType`'s field sets match the domain objects plus their one computed field; no field leaks anything not in spec §4.1. `CleanerType` specifically does **not** expose `teamId` — assert via the generated schema/metadata (e.g. `getMetadataStorage().collectObjectTypeMetadata(CleanerType)`'s field list) that no `teamId` field exists, the same belt-and-suspenders technique the Customers plan used for `UpdatePropertyInput`/`customerId`.
- `CleanerTeamLoaders`' batch-function ordering/grouping tests above.

**Traceability:** spec §4.3, §4.4, §4.5.

### Task 4 — `apps/api` composition root

**Files (modified):**
- `apps/api/src/app/app.module.ts` — add `CleanersModule` to `imports`, alongside `AuditModule`, `AdminsModule`, `AuthModule.forRootAsync(...)`, `BookingsModule`, `CustomersModule`. `CleanersModule` imports the existing modules its own providers require (`AuditModule`, for the same reason `CustomersModule` does — Task 1) and its resolvers import `AuthGuard`/`@Roles()` as plain classes/decorators (no module-level binding needed, same as every other resolver in this codebase); no new cross-module binding is introduced at the `AppModule` level.
- Run `pnpm migration:run` locally (dev-environment step, not a committed file change beyond the migrations already generated in Tasks 1 and 2).

**Tests:** none new — verification is that the full `AppModule` still boots and the existing `bookings`/`admin-foundation`/`customers-properties` e2e suites still pass unmodified (regression check).

**Traceability:** ties Tasks 1–3 into the running application; no new spec surface.

### Task 5 — `packages/client` operations + `apps/web` `/cleaners` screens

**Files (new):**
- `packages/client/src/operations/cleaners.graphql` — `query Cleaners { cleaners { id fullName phone email team { id name } } }`, `query Cleaner($id: ID!) { cleaner(id: $id) { id fullName phone email notes team { id name } } }`, `mutation CreateCleaner($input: CreateCleanerInput!) { createCleaner(input: $input) { id } }`, `mutation UpdateCleaner($id: ID!, $input: UpdateCleanerInput!) { updateCleaner(id: $id, input: $input) { id } }`, `mutation AssignCleanerToTeam($cleanerId: ID!, $teamId: ID!) { assignCleanerToTeam(cleanerId: $cleanerId, teamId: $teamId) { id } }`
- `packages/client/src/operations/teams.graphql` — `query Teams { teams { id name cleaners { id } } }`, `query Team($id: ID!) { team(id: $id) { id name cleaners { id fullName phone email } } }`, `mutation CreateTeam($input: CreateTeamInput!) { createTeam(input: $input) { id } }`
- Regenerate `packages/client/src/generated/graphql.ts` via `pnpm --filter @clensy/client codegen` (Task 3's schema must be current — run after Task 3/4 are in place)
- `apps/web/app/cleaners/page.tsx` — `useCleanersQuery`, `DataTable` (columns: name, phone, email, team name — `row.team?.name ?? '—'`; row links to `/cleaners/[id]`); inline "Add cleaner" form section (`FormField`s for `fullName`/`phone`/`email`/`notes`; `useCreateCleanerMutation`, `refetch()` on success) — mirrors `apps/web/app/customers/page.tsx`'s inline-create-section pattern, no modal.
- `apps/web/app/cleaners/[id]/page.tsx` — `useCleanerQuery({ variables: { id } })`; cleaner fields shown with an inline edit form covering `fullName`/`phone`/`email`/`notes` (`useUpdateCleanerMutation`); current team display (`data.cleaner.team?.name ?? 'Unassigned'`); a team-assignment control — `useTeamsQuery` populates a plain native `<select>` (not a `FormField` — §4 above) listing all teams, `onChange` calls `useAssignCleanerToTeamMutation({ variables: { cleanerId: id, teamId: selected } })` then `refetch()` (a network refetch of the `Cleaner` query, not an Apollo cache write — the list/detail pages in this slice do not use optimistic updates or manual cache manipulation anywhere, matching the Customers & Properties precedent). Mutation failure (network error, or a GraphQL error from a denied/invalid request) is surfaced using this codebase's existing pattern — a static inline error message set on catch (e.g. `'Unable to assign team.'`), the same approach `apps/web/app/customers/[id]/page.tsx`'s edit forms already use; no new error-display primitive, and no attempt to parse/display the underlying GraphQL error message, is introduced.
- `apps/web/app/cleaners/teams/page.tsx` — `useTeamsQuery`, `DataTable` (columns: name, member count — `row.cleaners.length`; row links to `/cleaners/teams/[id]`); inline "Add team" form (`FormField` for `name`; `useCreateTeamMutation`, `refetch()`).
- `apps/web/app/cleaners/teams/[id]/page.tsx` — `useTeamQuery({ variables: { id } })`; team name (read-only — no `UpdateTeam`, §2); a read-only `DataTable` of `data.team.cleaners` (columns: name, phone, email) — no member-editing control here (spec §4.6: reassignment happens only from the cleaner's own detail page).
- `apps/web/app/cleaners/tests/`: none — matches the Customers & Properties plan's Task 5 precedent (web-layer behavior verified by Task 6's e2e plus the manual acceptance checklist below).

**Files (modified):**
- `apps/web/middleware.ts` — `matcher: ['/admin', '/admin/:path*', '/customers', '/customers/:path*', '/cleaners', '/cleaners/:path*']`

**Tests:** none required beyond Task 6's e2e — matches the established precedent. Manual acceptance checklist, run once against the dev server before Task 5 is considered done:

```text
[ ] /cleaners loads and lists seeded cleaners
[ ] "Add cleaner" creates a cleaner and it appears in the list (via query refetch, not a page reload)
[ ] /cleaners/[id] loads an existing cleaner's fields, shows "Unassigned" with no team
[ ] Editing a cleaner field and submitting persists after a reload
[ ] Assigning a cleaner to a team on their detail page updates the shown team name
[ ] Reassigning the same cleaner to the same team again succeeds (no error) and the page still shows that team
[ ] /cleaners/teams loads and lists seeded teams with correct member counts
[ ] "Add team" creates a team and it appears in the list (via query refetch, not a page reload)
[ ] /cleaners/teams/[id] loads a team's assigned cleaners
[ ] Creating a team with a name that already exists shows an error, no duplicate created
[ ] Visiting /cleaners or /cleaners/[id] with no session cookie redirects to /login (middleware matcher)
```

**Traceability:** spec §4.5, §4.6.

### Task 6 — E2E acceptance

This task proves the resolver/guard/service/loader wiring end-to-end over real GraphQL requests — it does not re-prove what Task 1/2's level-2 real-Postgres service tests already cover (explicit-`null`-vs-omitted persistence, audit-failure rollback, unique-constraint translation) at the service layer.

**Files (new):**
- `apps/api/test/cleaners-teams.e2e-spec.ts` — reuses `apps/api/test/helpers/seed-owner.ts` to seed and log in as the fixture Owner; unique-per-run data and id-scoped assertions throughout (§7 — no truncation, no lock needed):
  1. Log in as Owner → `createCleaner` succeeds → `createTeam` succeeds → `assignCleanerToTeam` succeeds → `cleaner(id)` query returns the cleaner with `team` populated → `teams` query includes the team with the cleaner nested under `cleaners` → `cleaner.create`/`team.create`/`cleaner.assign_team` audit events recorded (direct repository/DB read).
  2. `assignCleanerToTeam` to the *same* team again → succeeds (not an error) → a second `cleaner.assign_team` audit event exists for the same cleaner (proves the same-state decision end-to-end, spec §2/§4.4).
  3. `updateCleaner` with only `phone` set → re-fetch confirms `fullName`/`email` unchanged, `phone` updated → `cleaner.update` recorded.
  4. `cleaners { team { name } }` over a set of ≥3 cleaners spanning ≥2 teams and an unassigned cleaner → asserts the correct `team`/`null` per row (functional correctness of the resolved data).
  5. **Batching/query-count proof, distinct from step 4** (§7): before issuing the request, `jest.spyOn(app.get(TeamsService), 'getTeamsByIds')` and `jest.spyOn(app.get(CleanersService), 'listCleanersByTeamIds')`. Re-issue a `cleaners { team { name } }` request over the same ≥3-cleaner/≥2-team fixture from step 4 → assert the spy's `mock.calls` array has length 1 (called exactly once, not per-row) **and** `mock.calls[0][0]` (its sole call's argument array) has exactly as many entries as there are distinct non-null `teamId`s in the result set, via `expect(spy.mock.calls[0][0]).toEqual(expect.arrayContaining(expectedTeamIds))` combined with `expect(spy.mock.calls[0][0]).toHaveLength(expectedTeamIds.length)` — the length check is what rules out "called once, but only for the first row" from separately passing. Separately, issue a `teams { cleaners { id } }` request over the same fixture → the same two-part assertion against `listCleanersByTeamIds`'s spy. This is the test that actually fails if a resolver regresses to one `getTeam`/`listTeamCleaners` call per parent row — step 4 alone would still pass in that regression, since both a batched and an N+1 implementation return identical data.
  6. **Request-isolation proof**: issue two *separate* Supertest requests (not two field resolutions within one request) — first `cleaner(id) { team { name } }` for a cleaner on Team A, then, after reassigning that cleaner to Team B via `assignCleanerToTeam` in between, the same `cleaner(id) { team { name } }` query again. The second request's result must reflect Team B, not a stale Team A cached from the first request's `CleanerTeamLoaders` instance — proving the request-scoped provider is actually constructed fresh per request rather than reused/singleton (§3). A singleton-scoped loader would still pass steps 1–5 (which each issue only one relevant request) but would fail this step by returning cached, stale data.
  7. Use the existing Owner-only `createAdmin` mutation to create a Scheduler, a Customer Support, a Finance, and an Analyst admin **within this suite** for the RBAC checks below — this suite does not depend on fixtures created by, or the execution order of, the Customers & Properties e2e suite or any other file.
  8. Log in as the Scheduler → `cleaners` query succeeds (view-allowed) → `createCleaner` denied (write-restricted).
  9. Log in as the Analyst → `cleaners` query succeeds (view-allowed).
  10. Log in as the Customer Support admin → `cleaners` query denied (no view access per §4.3's matrix) → `createCleaner` denied.
  11. Log in as the Finance admin → `cleaners` query denied → `createCleaner` denied.
  12. `assignCleanerToTeam` with a nonexistent `teamId` (as Owner) → rejected with a not-found error, the cleaner's `team` is unchanged on re-fetch.
  13. `createTeam` with a `name` matching an already-existing team → rejected with a conflict error, no duplicate persisted.

**Traceability:** spec §2 (golden path), §4.2 (not-found/missing-parent/same-state policies), §4.3 (RBAC matrix), §4.4 (audit), §4.5 (batching — functional in step 4, query-count in step 5).

## 9. Public surfaces requiring implementation

| | Surface |
| --- | --- |
| **Public** (fixed by spec §4.5/§5 above) | `Cleaner`, `Team` domain shapes; 8 GraphQL operations (`cleaner`, `cleaners`, `team`, `teams`, `createCleaner`, `updateCleaner`, `createTeam`, `assignCleanerToTeam`); `CleanerType.team`, `TeamType.cleaners` computed fields |
| **Internal** (M4 rule 12 — implementation detail, not exposed over GraphQL, not part of this plan's contract) | `CleanersService`, `TeamsService`; commands; `CleanerEntity`, `TeamEntity`; `CleanerTeamLoaders`; the two bulk-fetch methods (`getTeamsByIds`, `listCleanersByTeamIds`); `toCleanerType`/`toTeamType` mappers |

No additional public surface is introduced anywhere in the task breakdown.

## 10. Self-check (planner)

| Check | Status |
| --- | --- |
| Every major task traces to the Accepted specification | ✅ — each task cites spec section(s) |
| No task introduces new product semantics | ✅ — Task 4's composition-root change, Task 5's client/web scaffolding, and Task 3's loaders are execution necessities/mechanism choices, not new capabilities |
| Task ordering executable without inventing missing work | ✅ — §6 hard-prerequisite chain (Team before Cleaner before presentation before web) |
| Deferred work explicitly identified | ✅ — §2 SHALL NOT list |
| Missing design semantics → returned to M2/M3 | N/A — none found; the Accepted spec's two M3 revision rounds already resolved every ambiguity this plan would otherwise have had to invent around |
| Public contract matches the Accepted spec exactly | ✅ — §9; 8 GraphQL operations, matching spec §4.5 exactly |
| New dependency flagged for explicit approval before use | ✅ — §3/§4, `dataloader`; not yet approved as of this Draft |

## 11. Non-goals of this plan

- Redesigning the Accepted specification.
- Plan Review decisions (M5) — this plan does not self-Accept.
- Any implementation activity (M6) — no code is written at this stage, and the `dataloader` dependency is not installed by this plan itself.
- New `packages/ui` primitives — this slice's UI is fully covered by `Button`, `DataTable`, `FormField`, plus one plain native `<select>` for team assignment (§4).
