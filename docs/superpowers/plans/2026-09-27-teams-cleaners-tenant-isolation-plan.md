# Teams & Cleaners Tenant Isolation — Implementation Plan

| Field | Value |
| --- | --- |
| **Status** | Draft |
| **Kind** | Implementation plan (M4) for **one** delivery slice |
| **Date** | 2026-09-27 |
| **Tracking** | GitHub [#83](https://github.com/rexescario-dev/clensy-platform/issues/83) (program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81)). One PR for this plan (Accepted at M5) + implementation (process §2.8). Branch `feat/83-teams-cleaners-tenant-isolation`. |
| **Package / repo** | `clensy-platform` — `apps/api` only |
| **Depends on (Accepted)** | [Multi-Tenant Architecture](../specs/2026-09-23-multi-tenant-architecture-design.md) (Accepted, M3 2026-09-23). **Where this plan and that specification disagree, the specification wins** — stop and return to M2/M3. Relies on the shipped [Tenant Identity Foundation plan](2026-09-23-tenant-identity-foundation-plan.md) (#68: `Tenant`, `BOOTSTRAP_TENANT_ID`, principal `{ id, role, scope, tenantId }`, `AuditLogEvent.scope`/`tenantId`, `test/helpers/seed-tenant-admin.ts`) and the shipped [Customer & Property Tenant Isolation plan](2026-09-24-customer-property-tenant-isolation-plan.md) (#82: `tenantReadAuthorizer` / `tenantFilterFor`, `requireTenantId`, service null-tenant contract, relation-override regression pattern). Also relies on [Cleaners & Teams](../specs/2026-08-16-cleaners-teams-design.md), [nestjs-query GraphQL Reads](../specs/2026-08-28-nestjs-query-graphql-reads-design.md) and [Paginated GraphQL Collections](../specs/2026-08-28-paginated-graphql-collections-design.md) as **extended/constrained by the RFC** (§8). |

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do **not** invent product semantics; the Accepted specification wins. Do not begin until M5 has Accepted this plan.

**Goal:** Make Team and Cleaner tenant-owned — required `tenantId`, per-tenant (case-sensitive) name/email uniqueness, database-enforced same-tenant Cleaner → Team reference, and a principal-derived tenant predicate on every Team/Cleaner read and write path (services, nestjs-query list/count/relations, DataLoaders, mutations, cross-module lookups).

**Architecture:** One migration adds `tenantId` to `team_entity` and `cleaner_entity`, backfills the bootstrap tenant, then swaps the global `UNIQUE(name)` / `UNIQUE(email)` for tenant-scoped ones and replaces the id-only `fk_cleaner_team` with a composite `(teamId, tenantId) → team(id, tenantId)` FK. `TeamsService` / `CleanersService` take `tenantId` explicitly on every operation. nestjs-query read paths are constrained by `@Authorize(tenantReadAuthorizer())` on `TeamType` / `CleanerType` (reusing #82's `platform/` helper). The two custom `team` field resolvers (`Cleaner.team`, `CleaningJob.team`) read the principal with `@CurrentUser()` and ask a per-tenant DataLoader (`teamLoaderFor(tenantId)`) whose batch query is `id IN (…) AND tenantId = …`. Bookings and Jobs pass the caller's tenant when they look up a team; the unauthenticated REST `/bookings` passes `null` and therefore fails closed.

**Tech Stack:** NestJS, TypeORM 1.1.x migrations (hand-written constraints), PostgreSQL, `@ptc-org/nestjs-query-*` 9.5.0, `dataloader`, Jest unit (`pnpm --filter api test`) and e2e against real Postgres (`pnpm --filter api test:e2e`).

**Spec:** [docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md](../specs/2026-09-23-multi-tenant-architecture-design.md) §4.2, §4.4 (Team/Cleaner rows only), §4.5, §4.6 (Team/Cleaner events only), §4.7 (backfill), §4.9.

## Delivery intent

Implement RFC §4.4–§4.6 for **Team** and **Cleaner** only. After this slice a tenant principal can neither see nor write another tenant's teams or cleaners through any API path, the database rejects a cleaner assigned to another tenant's team, and team/cleaner audit events carry the tenant. Booking and CleaningJob tables stay unscoped (their slices: #85, #86); they only change how they **ask** for a team.

## Slice decisions (recorded during brainstorming, 2026-09-27)

These resolve planning-level choices the RFC leaves to M4. None adds product semantics.

1. **No duplicate pre-check in the migration.** Today `team_entity."name"` (`UQ_77fe6acc7fed8f35637f86a2163`) and `cleaner_entity."email"` (`UQ_ff219644065361c10ec6890f339`) are **globally** unique (verified against migrations `1786862765323-AddTeam`, `1786871992353-AddCleaner`; no later migration touches them). Backfilling every row to one tenant therefore cannot create a duplicate under `(tenantId, name)` / `(tenantId, email)`. The migration swaps the constraints directly; Task 1's migration e2e confirms on real Postgres.
2. **Case sensitivity is preserved.** RFC §4.4: Cleaner `(tenantId, email)` "email remains stored uniquely as today", Team `(tenantId, name)`. Both stay **case-sensitive** plain unique constraints. Do **not** copy #82's `lower(email)` index. `Alpha` and `alpha` in one tenant are two distinct teams.
3. **Runtime conflicts keep their messages.** Same name in the same tenant ⇒ `ConflictException('Team name is already in use')`; same cleaner email in the same tenant ⇒ `ConflictException('Email is already in use')`. Same name/email in different tenants ⇒ both succeed. Translation matches the new constraint name (#82's `CustomersService.translateUniqueViolation` idiom) so an unrelated `23505` is not mislabelled.
4. **Loader tenant source: resolver → tenant → loader → tenant-scoped query.** `Cleaner.team` and `CleaningJob.team` read `@CurrentUser()` and call `loaders.teamLoaderFor(currentUser?.tenantId ?? null)`. The loader holds one `DataLoader` per tenant id and its batch function calls `TeamsService.getTeamsByIds(ids, tenantId)`, whose query is `id IN (…) AND tenantId = …` in a single `where` — never fetch-then-filter. A cross-tenant id resolves to `null`; a `null` tenant resolves every key to `null` **without** a query. The loader does **not** inject GraphQL `CONTEXT`.
5. **Dead code is removed, not scoped.** `CleanerTeamLoaders.teamCleanersLoader`, `createTeamCleanersBatchFn` and `CleanersService.listCleanersByTeamIds` have no production caller (`Team.cleaners` is served by nestjs-query's `@OffsetConnection`, which `CleanerType`'s `@Authorize` scopes). They are deleted in this slice.
6. **Legacy REST `/bookings` (extends #82 Slice decision 4).** `UpdateBookingCommand` gains `tenantId: string | null`. GraphQL passes the principal's tenant; the unauthenticated REST controller passes `null`. A non-null `teamId` on REST `POST` or `PATCH` therefore resolves no team ⇒ existing `NotFoundException` (404) — the RFC/#82 fail-closed missing-row semantics. REST `PATCH` without `teamId` (or with `teamId: null`, which clears and performs no lookup), `GET` and `DELETE` are unchanged. **No principal means no tenant scope** — never bootstrap-tenant traffic. REST removal/rebuild stays with #85/#91.
7. **Audit.** `team.create`, `cleaner.create`, `cleaner.update`, `cleaner.assign_team` record `scope: TENANT` and `tenantId: principal.tenantId` (RFC §4.6). `job.assign_team` and `booking.*` audit tagging stays with #90.
8. **`Booking.team` is scoped only where the Team is resolved.** `@Authorize` on `TeamType` guarantees that when a Team object is resolved through `Booking.team`, it belongs to the caller's tenant (another tenant's team resolves `null`). It does **not** make `booking_entity.teamId` tenant-isolated: Booking remains outside database tenant isolation in this slice, and `Booking.team` may still expose an unscoped relation path (relation **filters** — see Deferred) until #85. The Team lookup itself is tenant-scoped.

## Global constraints

- SHALL derive the tenant for authorization **only** from `AuthenticatedPrincipal.tenantId` (RFC §4.5, invariant 1). SHALL NOT accept `tenantId` from GraphQL args, inputs, filters, headers, or REST bodies. SHALL NOT expose `tenantId` as a GraphQL field or writable input field on `Team` / `Cleaner`.
- SHALL NOT hardcode `BOOTSTRAP_TENANT_ID` in any request path. It MAY appear only in the migration backfill, dev seed fixtures, and tests.
- SHALL treat a missing tenant as "no tenant scope", with two distinct mechanisms (same as #82):
  - **Services and loaders:** `tenantId === null` passed to a team/cleaner service operation or to `teamLoaderFor` returns `null` / `[]` / `NotFoundException` **without** issuing a repository query.
  - **nestjs-query:** a request with no principal or no principal tenant gets `tenantFilterFor(null)` (`{ id: { is: null } }`), which **matches no rows**. It MAY still issue a (deliberately empty) query.
- SHALL treat the `@Authorize` tenant filter as a **security invariant**. No relation declaration targeting `TeamType` / `CleanerType` may carry a relation-level `auth` override (nestjs-query gives a relation's `auth` precedence over the related DTO's `@Authorize`). Planning-time inventory: exactly two such relations exist — `Booking.team` (`@FilterableRelation`, spreads `relationReadOpts` = guards, roles, `update`/`remove` disabled) and `Team.cleaners` (`@OffsetConnection`, `update`/`remove` disabled); `grep -rn "auth:" src/modules` finds none. Task 5 pins this with a regression test.
- SHALL make cross-tenant get/update/assign/reference look exactly like a missing row: `null` for the nullable `team` / `cleaner` queries and for `team` object fields; `NotFoundException` where the operation already throws it (RFC §4.5). SHALL NOT return `403` for another tenant's row.
- SHALL keep `@Roles()` lists unchanged. SHALL NOT add `SUPER_ADMIN` to any team/cleaner resolver (RFC §4.2).
- SHALL enforce, in the database: `team_entity."tenantId"` / `cleaner_entity."tenantId"` `uuid NOT NULL` with FK to `tenant_entity` (`ON DELETE RESTRICT`); `UNIQUE (id, "tenantId")` on both tables; `UNIQUE ("tenantId", "name")` on team; `UNIQUE ("tenantId", "email")` on cleaner; composite FK `cleaner("teamId", "tenantId") → team(id, "tenantId")` (`ON DELETE RESTRICT`, default `MATCH SIMPLE`, so `teamId IS NULL` is permitted); the global `UQ_77fe6acc7fed8f35637f86a2163`, `UQ_ff219644065361c10ec6890f339` and id-only `fk_cleaner_team` removed (RFC §4.4–§4.5).
- SHALL order the migration **assert bootstrap tenant exists → add nullable columns → backfill → NOT NULL + tenant FKs → composite-FK targets → tenant-scoped uniques (replacing global ones) → composite FK (replacing `fk_cleaner_team`) → indexes**, all in **one** migration transaction. SHALL NOT split it.
- SHALL keep all four Team/Cleaner mutations (`createTeam`, `createCleaner`, `updateCleaner`, `assignCleanerToTeam` — there are no others) as **custom resolvers calling the services**. `TeamReadResolver` / `CleanerReadResolver` are `ReadResolver`-only (`one: { disabled: true }`) and every relation to/from these types has `update`/`remove` disabled, so nestjs-query generates no Team/Cleaner mutation. `@Authorize` is relied on for **reads only**; write isolation comes from the services' `{ id, tenantId }` lookups.
- SHALL NOT add `tenantId` to `booking_entity` or `cleaning_job_entity`; SHALL NOT change `fk_booking_team` or `fk_cleaning_job_team` (#85, #86). The application-level team lookup in Bookings/Jobs is tenant-scoped **now**; database-level composite ownership for those references comes with #85/#86.
- SHALL NOT use PostgreSQL RLS (invariant 12).
- SHALL NOT change `apps/web`, `@clensy/web`, `@clensy/ui`, GraphQL operation documents, or the public GraphQL schema. Adding `tenantId` to `UpdateBookingCommand` / `AssignTeamToJobCommand` (application commands) is not a schema change.
- SHALL keep the existing nullable/NotFound contracts of the Cleaners & Teams spec (`team` / `cleaner` nullable; `assignCleanerToTeam` / `updateCleaner` NotFound on missing row; `listTeamCleaners` returns `[]` for a missing team).

## Ownership boundaries

**This slice owns:** `apps/api/src/modules/cleaners/**`; one new migration in `apps/api/src/platform/database/migrations/`; the dev seed's `bookingFixtureTeam` gaining `tenantId`; the **call sites only** in `bookings.service.ts`, `booking.resolver.ts`, `booking.controller.ts`, `update-booking.command.ts`, `jobs.service.ts`, `assign-team-to-job.command.ts`, `job.resolver.ts`, `job-relation.loaders.ts`; `test/helpers/seed-tenant-admin.ts` cleanup; test fixtures that create teams/cleaners.

**Must not change:** Booking/Jobs/Catalog/Customers/Laundry/Billing persistence, their nestjs-query types and authorization, `@Roles()` matrices, `AuthGuard`/principal loading, `tenantReadAuthorizer` / `requireTenantId` (consumed as-is), `apps/web`, REST routes or DTO shapes.

## Contract inventory

| Surface | Change |
| --- | --- |
| `team_entity`, `cleaner_entity` | `tenantId uuid NOT NULL` + FK to tenant; `UNIQUE(id, tenantId)`; team `UNIQUE(tenantId, name)`, cleaner `UNIQUE(tenantId, email)` replacing the global uniques; cleaner composite FK to team replacing `fk_cleaner_team`; tenant-leading list indexes |
| `Team` / `Cleaner` domain | add `tenantId: string` |
| `TeamsService` | `createTeam(command)` — command carries `tenantId: string`; `getTeam(id, tenantId)`, `getTeamsByIds(ids, tenantId)`, `listTeams(tenantId)` (`tenantId: string \| null`); duplicate ⇒ `ConflictException` |
| `CleanersService` | `createCleaner` / `updateCleaner(id, …)` / `assignCleanerToTeam` — commands carry `tenantId: string`; `getCleaner(id, tenantId)`, `listCleaners(tenantId)`, `listTeamCleaners(teamId, tenantId)`; `listCleanersByTeamIds` **deleted** |
| `CleanerTeamLoaders` | `teamLoaderFor(tenantId: string \| null): DataLoader<string, Team \| null>`; `teamLoader` / `teamCleanersLoader` / `createTeamCleanersBatchFn` removed; `createTeamBatchFn(teamsService, tenantId)` |
| `JobRelationLoaders` | `teamLoaderFor(tenantId)` replaces `teamLoader`; `createJobTeamBatchFn(teamsService, tenantId)`; `checklistLoader` unchanged |
| GraphQL `TeamType`, `CleanerType` | `@Authorize(tenantReadAuthorizer())`. No new public fields |
| GraphQL `team`, `cleaner`, `createTeam`, `createCleaner`, `updateCleaner`, `assignCleanerToTeam` | reads pass `currentUser.tenantId`; writes pass `requireTenantId(currentUser)` |
| `Cleaner.team`, `CleaningJob.team` field resolvers | `@CurrentUser()` → `teamLoaderFor(currentUser?.tenantId ?? null)` |
| Relations `Team.cleaners`, `Booking.team` | constrained by the target DTO's authorizer (nestjs-query default `authorizeRelation` falls back to the target's `@Authorize` when the relation has no `auth`). No code change on those declarations; Task 5 adds a regression guard |
| `UpdateBookingCommand` | + `tenantId: string \| null` (GraphQL: principal's; REST: `null`) |
| `AssignTeamToJobCommand` | + `tenantId: string` |
| `AuditEvent` for team/cleaner actions | `scope = TENANT`, `tenantId` = principal's tenant |

**Deferred:**
- `booking_entity.teamId` / `cleaning_job_entity.teamId` keep id-only FKs (`fk_booking_team`, `fk_cleaning_job_team`); composite `(teamId, tenantId)` FKs arrive with Booking (#85) and CleaningJob (#86) tenant ownership.
- **Relation-filter gap on `BookingDTO`:** `@FilterableRelation('team', …)` lets a client filter the (unscoped) `bookings` root by fields of another tenant's team (e.g. `filter: { team: { name: { eq: … } } }`), an existence oracle over other tenants' team names. `TeamType`'s `@Authorize` covers relation *resolution*, not relation *filters* on another root. Fixed when the Booking root is scoped in #85. **Do not provision a second production tenant before then** (same interim rule as #82).
- Booking / Job / other modules' audit tagging (#90); REST `/bookings` removal (#85/#91); two-tenant release gate (#92); any UI surfacing.

## TDD / verification strategy

- **Unit (Jest, mocked repositories/manager):** `TeamsService` / `CleanersService` tenant predicates, fail-closed `null` (no repository call), constraint-name Conflict mapping, audit tags; loader batch functions pass `tenantId` and null-tenant makes no call; `teamLoaderFor` memoizes per tenant; resolvers pass `currentUser.tenantId` / `requireTenantId(currentUser)`; `@Authorize` metadata present on both types; relation-override regression; `BookingsService` / `JobsService` pass the tenant to `getTeam`.
- **Migration e2e (throwaway database, `add-customer-property-tenant.migration.e2e-spec.ts` precedent):** bootstrap-tenant assertion, backfill, constraint swap, composite FK rejects a tenant-mismatched cleaner and accepts `teamId = NULL`, case-sensitive uniqueness, `down` restores the previous schema.
- **Two-tenant API e2e (real Postgres, `AppModule`):** every RFC §4.9-style cross-tenant case for teams/cleaners, including filter narrowing with `totalCount`, relation safety through `Team.cleaners`, `Cleaner.team`, `job.team`, `booking.team`, cross-tenant writes from Bookings/Jobs, uniqueness across tenants, REST fail-closed, and audit rows.
- **Acceptance is behavioral.** Isolation is proven by cross-tenant outcomes (rows absent, counts scoped, relations `null`). Captured SQL is supporting evidence only.
- **Suite health:** Tasks 1–7 are coupled — after Task 1 the NOT NULL columns break e2e fixtures until Task 7. Unit tests MUST be green at the end of every task; the full e2e suite MUST be green from Task 7 onward (excepting the 3 failures pre-existing on `main`, recorded in PR #95: SQL-count assertions in `bookings.e2e` / `jobs.e2e`).
- Final gate: `pnpm --filter api lint`, `pnpm --filter api test`, `pnpm --filter api test:e2e`, `pnpm --filter api build`, and `migration:run` against a fresh database; confirm `git diff --stat main -- apps/web packages` is empty and the generated GraphQL schema is unchanged.

## Review Focus

Failure modes the RFC implies that are easy to miss; each is pinned by a test in the named task.

1. **Client filter tries to widen or assert another tenant** (`teams(filter: { id: { eq: <A's team> } })` as tenant B; `cleaners(filter: { email: { eq: <A's email> } })`) — expect empty `nodes` **and** `totalCount: 0` (Task 8).
2. **Relation read resolving a foreign Team/Cleaner** — `booking.team` / `job.team` where the unscoped parent points at A's team, read as B, must be `null`; `Team.cleaners` must list only the caller's cleaners (Task 4 loader units, Task 5 relation guard, Task 8 e2e).
3. **Loader receives the tenant but ignores it** — the batch function must put `tenantId` in the same `where` as `id IN (…)`, and `teamLoaderFor(null)` must not query (Task 2, Task 4).
4. **Same name/email, different case vs different tenant** — `Alpha` and `alpha` in one tenant both succeed (case-sensitive); `Alpha` twice in one tenant ⇒ 409; `Alpha` in A and B ⇒ both succeed; same for cleaner email (Task 1 migration e2e, Task 8).
5. **Update path writing `tenantId` where it must not** — `BookingsService.update` must destructure `tenantId` out of the changes it hands to `manager.update(BookingEntity, …)` (booking has no `tenantId` column yet); `CleanersService.updateCleaner` must never let `tenantId` into its `UPDATE` SET list (Task 3, Task 6).

---

### Task 1: Schema — domain, entities, migration

**Spec:** §4.4 (Cleaner/Team uniqueness, same-tenant Cleaner → Team, `(id, tenantId)` uniqueness), §4.5 (NOT NULL, tenant FK, indexes), §4.7 (backfill before NOT NULL); Slice decisions 1–2.

**Files:**
- Modify: `apps/api/src/modules/cleaners/domain/team.ts`, `domain/cleaner.ts` (+ `tenantId: string`)
- Modify: `apps/api/src/modules/cleaners/infrastructure/persistence/team.entity.ts`, `cleaner.entity.ts`
- Create: `apps/api/src/platform/database/migrations/1790438400000-AddTeamCleanerTenant.ts`
- Test: `apps/api/test/add-team-cleaner-tenant.migration.e2e-spec.ts`

**Interfaces:**
- Produces: `Team.tenantId: string`, `Cleaner.tenantId: string`; constraint names `uq_team_tenant_name`, `uq_cleaner_tenant_email` (consumed by Tasks 2–3 conflict mapping), `fk_cleaner_team_tenant`, `uq_team_id_tenant`, `uq_cleaner_id_tenant`, `fk_team_tenant`, `fk_cleaner_tenant`, indexes `idx_team_tenant_created`, `idx_cleaner_tenant_created`.

- [ ] **Step 1: Write the failing migration e2e**

Model the harness on `test/add-customer-property-tenant.migration.e2e-spec.ts` (throwaway database, `connectionOptions` / `migrationsBefore` from `test/helpers/migration-db.ts`, explicit `inTransaction` wrapper). Cases are sequential:

```ts
import { randomUUID } from 'crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import { AddTeamCleanerTenant1790438400000 } from '../src/platform/database/migrations/1790438400000-AddTeamCleanerTenant';
import { connectionOptions, migrationsBefore } from './helpers/migration-db';

const NEW_CONSTRAINTS = [
  'fk_team_tenant',
  'fk_cleaner_tenant',
  'uq_team_id_tenant',
  'uq_cleaner_id_tenant',
  'uq_team_tenant_name',
  'uq_cleaner_tenant_email',
  'fk_cleaner_team_tenant',
];
const NEW_INDEXES = ['idx_team_tenant_created', 'idx_cleaner_tenant_created'];
const OLD_CONSTRAINTS = [
  'UQ_77fe6acc7fed8f35637f86a2163',
  'UQ_ff219644065361c10ec6890f339',
  'fk_cleaner_team',
];

// #83 Task 1. Same harness as the #82 migration e2e: every `up`/`down` runs
// in a transaction exactly as TypeORM runs it. Sequential cases.
describe('AddTeamCleanerTenant migration (real Postgres)', () => {
  const database = `clensy_migration_${randomUUID().replace(/-/g, '')}`;
  let admin: DataSource;
  let dataSource: DataSource;
  let queryRunner: QueryRunner;
  const migration = new AddTeamCleanerTenant1790438400000();
  const teamA = randomUUID();
  const cleanerInTeam = randomUUID();
  const cleanerNoTeam = randomUUID();
  const secondTenant = randomUUID();

  async function inTransaction(run: (r: QueryRunner) => Promise<void>) {
    await queryRunner.startTransaction();
    try {
      await run(queryRunner);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    }
  }

  async function constraintNames(): Promise<string[]> {
    const rows: { conname: string }[] = await queryRunner.query(
      `SELECT conname FROM pg_constraint WHERE conrelid IN ('team_entity'::regclass, 'cleaner_entity'::regclass)`,
    );
    return rows.map((row) => row.conname);
  }

  async function indexNames(): Promise<string[]> {
    const rows: { indexname: string }[] = await queryRunner.query(
      `SELECT indexname FROM pg_indexes WHERE tablename IN ('team_entity', 'cleaner_entity')`,
    );
    return rows.map((row) => row.indexname);
  }

  beforeAll(async () => {
    admin = new DataSource(connectionOptions(process.env.DB_NAME ?? 'clensy'));
    await admin.initialize();
    await admin.query(`CREATE DATABASE "${database}"`);
    dataSource = new DataSource({
      ...connectionOptions(database),
      migrations: migrationsBefore('1790438400000'),
    });
    await dataSource.initialize();
    await dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await dataSource.runMigrations();
    queryRunner = dataSource.createQueryRunner();

    await queryRunner.query(
      `INSERT INTO "team_entity" ("id", "name") VALUES ($1, 'Alpha')`,
      [teamA],
    );
    await queryRunner.query(
      `INSERT INTO "cleaner_entity" ("id", "fullName", "phone", "email", "teamId") VALUES ($1, 'In Team', '555', 'in@example.com', $2)`,
      [cleanerInTeam, teamA],
    );
    await queryRunner.query(
      `INSERT INTO "cleaner_entity" ("id", "fullName", "phone", "email") VALUES ($1, 'No Team', '555', 'none@example.com')`,
      [cleanerNoTeam],
    );
  }, 60_000);

  afterAll(async () => {
    await queryRunner?.release();
    await dataSource?.destroy();
    await admin?.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin?.destroy();
  });

  // Same mechanics as #82's equivalent case: the throwaway DB has no rows
  // referencing the bootstrap tenant, so it can be deleted and re-inserted.
  it('fails with an explicit error when the bootstrap tenant is missing', async () => {
    const [tenant]: { name: string }[] = await queryRunner.query(
      `SELECT "name" FROM "tenant_entity" WHERE "id" = $1`,
      [BOOTSTRAP_TENANT_ID],
    );
    await queryRunner.query(`DELETE FROM "tenant_entity" WHERE "id" = $1`, [
      BOOTSTRAP_TENANT_ID,
    ]);
    try {
      await expect(inTransaction((r) => migration.up(r))).rejects.toThrow(
        `AddTeamCleanerTenant: bootstrap tenant ${BOOTSTRAP_TENANT_ID} not found — run AddTenantAndAdminScope first`,
      );
      const cols: unknown[] = await queryRunner.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name IN ('team_entity','cleaner_entity') AND column_name = 'tenantId'`,
      );
      expect(cols).toHaveLength(0);
    } finally {
      await queryRunner.query(
        `INSERT INTO "tenant_entity" ("id", "name") VALUES ($1, $2)`,
        [BOOTSTRAP_TENANT_ID, tenant.name],
      );
    }
  });

  it('backfills the bootstrap tenant and swaps global uniques for tenant-scoped ones', async () => {
    await inTransaction((r) => migration.up(r));

    const teams: { tenantId: string }[] = await queryRunner.query(
      `SELECT "tenantId" FROM "team_entity"`,
    );
    const cleaners: { tenantId: string }[] = await queryRunner.query(
      `SELECT "tenantId" FROM "cleaner_entity"`,
    );
    expect(new Set([...teams, ...cleaners].map((row) => row.tenantId))).toEqual(
      new Set([BOOTSTRAP_TENANT_ID]),
    );
    const constraints = await constraintNames();
    expect(constraints).toEqual(expect.arrayContaining(NEW_CONSTRAINTS));
    for (const old of OLD_CONSTRAINTS) {
      expect(constraints).not.toContain(old);
    }
    expect(await indexNames()).toEqual(expect.arrayContaining(NEW_INDEXES));
  });

  it('enforces tenant-scoped, case-sensitive uniqueness', async () => {
    await queryRunner.query(`INSERT INTO "tenant_entity" ("id", "name") VALUES ($1, 'Second')`, [secondTenant]);
    // Same name, other tenant: allowed.
    await queryRunner.query(
      `INSERT INTO "team_entity" ("name", "tenantId") VALUES ('Alpha', $1)`,
      [secondTenant],
    );
    // Different case, same tenant: allowed (case-sensitive, Slice decision 2).
    await queryRunner.query(
      `INSERT INTO "team_entity" ("name", "tenantId") VALUES ('alpha', $1)`,
      [BOOTSTRAP_TENANT_ID],
    );
    // Exact duplicate, same tenant: rejected by uq_team_tenant_name.
    await expect(
      queryRunner.query(
        `INSERT INTO "team_entity" ("name", "tenantId") VALUES ('Alpha', $1)`,
        [BOOTSTRAP_TENANT_ID],
      ),
    ).rejects.toMatchObject({ driverError: { constraint: 'uq_team_tenant_name' } });
    await queryRunner.query(
      `INSERT INTO "cleaner_entity" ("fullName", "phone", "email", "tenantId") VALUES ('X', '555', 'in@example.com', $1)`,
      [secondTenant],
    );
    await expect(
      queryRunner.query(
        `INSERT INTO "cleaner_entity" ("fullName", "phone", "email", "tenantId") VALUES ('X', '555', 'in@example.com', $1)`,
        [BOOTSTRAP_TENANT_ID],
      ),
    ).rejects.toMatchObject({ driverError: { constraint: 'uq_cleaner_tenant_email' } });
  });

  it('rejects a cleaner assigned to another tenant’s team and allows no team', async () => {
    // The second-tenant cleaner inserted by the previous case.
    const [{ id: foreignCleaner }] = (await queryRunner.query(
      `SELECT "id" FROM "cleaner_entity" WHERE "tenantId" = $1 LIMIT 1`,
      [secondTenant],
    )) as { id: string }[];
    await expect(
      queryRunner.query(`UPDATE "cleaner_entity" SET "teamId" = $1 WHERE "id" = $2`, [teamA, foreignCleaner]),
    ).rejects.toMatchObject({ driverError: { constraint: 'fk_cleaner_team_tenant' } });
    const [{ teamId }] = (await queryRunner.query(
      `SELECT "teamId" FROM "cleaner_entity" WHERE "id" = $1`,
      [cleanerNoTeam],
    )) as { teamId: string | null }[];
    expect(teamId).toBeNull();
  });

  it('down restores the pre-tenant schema', async () => {
    await queryRunner.query(`DELETE FROM "cleaner_entity" WHERE "tenantId" = $1`, [secondTenant]);
    await queryRunner.query(`DELETE FROM "team_entity" WHERE "tenantId" = $1 OR "name" = 'alpha'`, [secondTenant]);
    await inTransaction((r) => migration.down(r));
    const constraints = await constraintNames();
    expect(constraints).toEqual(expect.arrayContaining(OLD_CONSTRAINTS));
    for (const added of NEW_CONSTRAINTS) {
      expect(constraints).not.toContain(added);
    }
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm --filter api test:e2e -- add-team-cleaner-tenant` → FAIL (migration module not found).

- [ ] **Step 3: Domain + entities**

`domain/team.ts` and `domain/cleaner.ts`: add `tenantId: string;` after `id`.

`team.entity.ts` — remove `unique: true` from `name`; add the tenant column/relation (same shape as `CustomerEntity`); extend the header comment:

```ts
// Tenant ownership (#83): `tenantId` + `fk_team_tenant` are expressed here.
// `AddTeamCleanerTenant` also hand-writes objects this metadata does not
// express, which `migration:generate` may propose dropping — do not apply
// that: `uq_team_id_tenant` (target of the composite
// `fk_cleaner_team_tenant`), `uq_team_tenant_name` (case-sensitive
// `("tenantId", "name")`), `idx_team_tenant_created`.
@Entity()
export class TeamEntity implements Team {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  tenantId!: string;

  @ManyToOne(() => TenantEntity, { nullable: false, eager: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tenantId', foreignKeyConstraintName: 'fk_team_tenant' })
  tenant!: TenantEntity;

  @Column()
  name!: string;
  // … cleaners, createdAt, updatedAt unchanged
}
```

`cleaner.entity.ts` — remove `unique: true` from `email`; add `tenantId` + `tenant` (`fk_cleaner_tenant`); on `team` replace the `@JoinColumn` FK name with `createForeignKeyConstraints: false` (the composite FK is migration-owned, #82 `PropertyEntity.customer` precedent):

```ts
  @ManyToOne(() => TeamEntity, (team) => team.cleaners, {
    nullable: true,
    eager: false,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'teamId' })
  team!: TeamEntity | null;
```

Header comment lists hand-written `uq_cleaner_id_tenant`, `uq_cleaner_tenant_email`, `fk_cleaner_team_tenant`, `idx_cleaner_tenant_created`, with the same "do not apply `migration:generate`'s proposal to drop these or re-add an id-only FK" warning.

- [ ] **Step 4: Migration**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';
import { BOOTSTRAP_TENANT_ID } from '../bootstrap-tenant';

// Tenant ownership for Team and Cleaner (#83; RFC §4.4, §4.5, §4.7). Step
// order is load-bearing and the whole migration is one transaction:
//
//   0. Assert the bootstrap tenant exists; abort before touching any row.
//   1. Nullable `tenantId` on `team_entity` and `cleaner_entity`.
//   2. Backfill every row to the bootstrap tenant.
//   3. NOT NULL + FKs to `tenant_entity` (ON DELETE RESTRICT).
//   4. `UNIQUE (id, "tenantId")` on both tables (composite FK target).
//   5. Replace the global `UNIQUE(name)` / `UNIQUE(email)` with
//      `("tenantId", name)` / `("tenantId", email)` — case-sensitive, as
//      today (slice decision 2). No duplicate pre-check: the global uniques
//      being replaced already rule out duplicates within one tenant (slice
//      decision 1).
//   6. Replace the id-only `fk_cleaner_team` with the composite
//      `fk_cleaner_team_tenant` in the same step. MATCH SIMPLE: a cleaner
//      with `teamId IS NULL` is not checked.
//   7. Tenant-scoped list indexes (the existing `teamId` index stays).
//
// `fk_booking_team` / `fk_cleaning_job_team` (id-only, referencing
// `team_entity.id`) are untouched — #85 / #86.
export class AddTeamCleanerTenant1790438400000 implements MigrationInterface {
  name = 'AddTeamCleanerTenant1790438400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tenants = (await queryRunner.query(
      `SELECT 1 FROM "tenant_entity" WHERE "id" = $1`,
      [BOOTSTRAP_TENANT_ID],
    )) as unknown[];
    if (tenants.length === 0) {
      throw new Error(
        `AddTeamCleanerTenant: bootstrap tenant ${BOOTSTRAP_TENANT_ID} not found — run AddTenantAndAdminScope first`,
      );
    }

    await queryRunner.query(`ALTER TABLE "team_entity" ADD "tenantId" uuid`);
    await queryRunner.query(`ALTER TABLE "cleaner_entity" ADD "tenantId" uuid`);

    await queryRunner.query(`UPDATE "team_entity" SET "tenantId" = $1`, [BOOTSTRAP_TENANT_ID]);
    await queryRunner.query(`UPDATE "cleaner_entity" SET "tenantId" = $1`, [BOOTSTRAP_TENANT_ID]);

    await queryRunner.query(`ALTER TABLE "team_entity" ALTER COLUMN "tenantId" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "cleaner_entity" ALTER COLUMN "tenantId" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "team_entity" ADD CONSTRAINT "fk_team_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cleaner_entity" ADD CONSTRAINT "fk_cleaner_tenant" FOREIGN KEY ("tenantId") REFERENCES "tenant_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`ALTER TABLE "team_entity" ADD CONSTRAINT "uq_team_id_tenant" UNIQUE ("id", "tenantId")`);
    await queryRunner.query(`ALTER TABLE "cleaner_entity" ADD CONSTRAINT "uq_cleaner_id_tenant" UNIQUE ("id", "tenantId")`);

    await queryRunner.query(`ALTER TABLE "team_entity" DROP CONSTRAINT "UQ_77fe6acc7fed8f35637f86a2163"`);
    await queryRunner.query(`ALTER TABLE "team_entity" ADD CONSTRAINT "uq_team_tenant_name" UNIQUE ("tenantId", "name")`);
    await queryRunner.query(`ALTER TABLE "cleaner_entity" DROP CONSTRAINT "UQ_ff219644065361c10ec6890f339"`);
    await queryRunner.query(`ALTER TABLE "cleaner_entity" ADD CONSTRAINT "uq_cleaner_tenant_email" UNIQUE ("tenantId", "email")`);

    await queryRunner.query(`ALTER TABLE "cleaner_entity" DROP CONSTRAINT "fk_cleaner_team"`);
    await queryRunner.query(
      `ALTER TABLE "cleaner_entity" ADD CONSTRAINT "fk_cleaner_team_tenant" FOREIGN KEY ("teamId", "tenantId") REFERENCES "team_entity"("id", "tenantId") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`CREATE INDEX "idx_team_tenant_created" ON "team_entity" ("tenantId", "createdAt" DESC, "id")`);
    await queryRunner.query(`CREATE INDEX "idx_cleaner_tenant_created" ON "cleaner_entity" ("tenantId", "createdAt" DESC, "id")`);
  }

  // Reverses 7 → 1. Restores the original global uniques under their
  // original names; fails (correctly) if cross-tenant duplicates now exist.
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_cleaner_tenant_created"`);
    await queryRunner.query(`DROP INDEX "public"."idx_team_tenant_created"`);
    await queryRunner.query(`ALTER TABLE "cleaner_entity" DROP CONSTRAINT "fk_cleaner_team_tenant"`);
    await queryRunner.query(
      `ALTER TABLE "cleaner_entity" ADD CONSTRAINT "fk_cleaner_team" FOREIGN KEY ("teamId") REFERENCES "team_entity"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "cleaner_entity" DROP CONSTRAINT "uq_cleaner_tenant_email"`);
    await queryRunner.query(`ALTER TABLE "cleaner_entity" ADD CONSTRAINT "UQ_ff219644065361c10ec6890f339" UNIQUE ("email")`);
    await queryRunner.query(`ALTER TABLE "team_entity" DROP CONSTRAINT "uq_team_tenant_name"`);
    await queryRunner.query(`ALTER TABLE "team_entity" ADD CONSTRAINT "UQ_77fe6acc7fed8f35637f86a2163" UNIQUE ("name")`);
    await queryRunner.query(`ALTER TABLE "cleaner_entity" DROP CONSTRAINT "uq_cleaner_id_tenant"`);
    await queryRunner.query(`ALTER TABLE "team_entity" DROP CONSTRAINT "uq_team_id_tenant"`);
    await queryRunner.query(`ALTER TABLE "cleaner_entity" DROP CONSTRAINT "fk_cleaner_tenant"`);
    await queryRunner.query(`ALTER TABLE "team_entity" DROP CONSTRAINT "fk_team_tenant"`);
    await queryRunner.query(`ALTER TABLE "cleaner_entity" DROP COLUMN "tenantId"`);
    await queryRunner.query(`ALTER TABLE "team_entity" DROP COLUMN "tenantId"`);
  }
}
```

M6 note: `1790438400000` is a planning placeholder timestamp that already sorts after `1790265191400`; keep it unless a migration with a later timestamp lands on `main` first, in which case re-stamp (file name, class name, `name`, and the e2e's `migrationsBefore` argument together).

- [ ] **Step 5: Run** — migration e2e PASS; `pnpm --filter api test` PASS (unit suites may need the `tenantId` field added to `makeTeam` / `makeCleaner` fixtures — do that here); `pnpm --filter api build` PASS.
- [ ] **Step 6: Commit** — `feat(83): add tenant ownership to team and cleaner tables`

---

### Task 2: `TeamsService` tenant predicate

**Spec:** §4.4 (Team uniqueness), §4.5 (principal tenant; not-found semantics), §4.6; Slice decisions 3, 7.

**Files:**
- Modify: `apps/api/src/modules/cleaners/application/commands/create-team.command.ts` (+ `tenantId: string`)
- Modify: `apps/api/src/modules/cleaners/application/services/teams.service.ts`
- Test: `apps/api/src/modules/cleaners/tests/application/teams.service.spec.ts`

**Interfaces:**
- Consumes: `Team.tenantId`, constraint `uq_team_tenant_name` (Task 1).
- Produces: `createTeam(command: CreateTeamCommand /* { actorId, tenantId: string, name } */): Promise<Team>`; `getTeam(id: string, tenantId: string | null): Promise<Team | null>`; `getTeamsByIds(ids: string[], tenantId: string | null): Promise<Team[]>`; `listTeams(tenantId: string | null): Promise<Team[]>`. Consumed by Tasks 3, 4, 5, 6.

- [ ] **Step 1: Write the failing tests** (add to the existing spec; existing `createTeam` calls gain `tenantId: 't-a'`)

```ts
describe('tenant predicate (#83)', () => {
  it('getTeam scopes by id and tenant', async () => {
    teamRepository.findOneBy.mockResolvedValue(null);
    await expect(service.getTeam('team-1', 't-a')).resolves.toBeNull();
    expect(teamRepository.findOneBy).toHaveBeenCalledWith({ id: 'team-1', tenantId: 't-a' });
  });

  it('getTeamsByIds puts tenantId in the same where as the id list', async () => {
    teamRepository.findBy.mockResolvedValue([]);
    await service.getTeamsByIds(['a', 'b'], 't-a');
    expect(teamRepository.findBy).toHaveBeenCalledWith({ id: In(['a', 'b']), tenantId: 't-a' });
  });

  it('listTeams scopes by tenant', async () => {
    teamRepository.find.mockResolvedValue([]);
    await service.listTeams('t-a');
    expect(teamRepository.find).toHaveBeenCalledWith({ where: { tenantId: 't-a' } });
  });

  it.each([
    ['getTeam', () => service.getTeam('team-1', null), null],
    ['getTeamsByIds', () => service.getTeamsByIds(['a'], null), []],
    ['getTeamsByIds (empty ids)', () => service.getTeamsByIds([], 't-a'), []],
    ['listTeams', () => service.listTeams(null), []],
  ])('%s fails closed without a repository query', async (_label, call, expected) => {
    await expect(call()).resolves.toEqual(expected);
    expect(teamRepository.findOneBy).not.toHaveBeenCalled();
    expect(teamRepository.findBy).not.toHaveBeenCalled();
    expect(teamRepository.find).not.toHaveBeenCalled();
  });

  it('createTeam persists the tenant and tags the audit event', async () => {
    await service.createTeam({ actorId: 'actor-1', tenantId: 't-a', name: 'Alpha' });
    expect(manager.create).toHaveBeenCalledWith(TeamEntity, { tenantId: 't-a', name: 'Alpha' });
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'team.create', scope: AdminScope.TENANT, tenantId: 't-a' }),
    );
  });

  it('maps uq_team_tenant_name to Conflict and rethrows other unique violations', async () => {
    manager.save.mockRejectedValueOnce({ code: '23505', driverError: { constraint: 'uq_team_tenant_name' } });
    await expect(
      service.createTeam({ actorId: 'actor-1', tenantId: 't-a', name: 'Alpha' }),
    ).rejects.toThrow(new ConflictException('Team name is already in use'));

    const other = { code: '23505', driverError: { constraint: 'uq_team_id_tenant' } };
    manager.save.mockRejectedValueOnce(other);
    await expect(
      service.createTeam({ actorId: 'actor-1', tenantId: 't-a', name: 'Alpha' }),
    ).rejects.toBe(other);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm --filter api test -- teams.service` → FAIL.

- [ ] **Step 3: Implement**

```ts
const TEAM_TENANT_NAME_CONSTRAINT = 'uq_team_tenant_name';

createTeam(command: CreateTeamCommand): Promise<Team> {
  return this.dataSource.transaction((manager) =>
    runAuditInTransaction(manager, async () => {
      const entity = manager.create(TeamEntity, {
        tenantId: command.tenantId,
        name: command.name,
      });
      this.assertValid(entity);
      await this.translateUniqueViolation(() => manager.save(entity));
      await this.auditLogger.log({
        actorId: command.actorId,
        entityId: entity.id,
        tenantId: command.tenantId,
        action: 'team.create',
        entityType: 'team',
        scope: AdminScope.TENANT,
      });
      return entity;
    }),
  );
}

// `tenantId: null` (no principal tenant scope, RFC §4.5) fails closed
// WITHOUT issuing a repository query.
getTeam(id: string, tenantId: string | null): Promise<Team | null> {
  if (tenantId === null) {
    return Promise.resolve(null);
  }
  return this.teamRepository.findOneBy({ id, tenantId });
}

// Bulk lookup for the `Cleaner.team` / `CleaningJob.team` loaders. `tenantId`
// MUST be in the same `where` as `id: In(ids)` — never fetch by ids then
// filter in memory. A foreign id is simply absent; the loader maps it to null.
getTeamsByIds(ids: string[], tenantId: string | null): Promise<Team[]> {
  if (ids.length === 0 || tenantId === null) {
    return Promise.resolve([]);
  }
  return this.teamRepository.findBy({ id: In(ids), tenantId });
}

listTeams(tenantId: string | null): Promise<Team[]> {
  if (tenantId === null) {
    return Promise.resolve([]);
  }
  return this.teamRepository.find({ where: { tenantId } });
}

// Same constraint-name match as `CustomersService.translateUniqueViolation`
// (#82): an unrelated 23505 is never mislabelled as a name conflict; with no
// constraint name available, fall back to the code alone.
private async translateUniqueViolation<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const err = error as { code?: string; constraint?: string; driverError?: { constraint?: string } };
    if (err.code === POSTGRES_UNIQUE_VIOLATION) {
      const constraint = err.driverError?.constraint ?? err.constraint;
      if (constraint === undefined || constraint === TEAM_TENANT_NAME_CONSTRAINT) {
        throw new ConflictException('Team name is already in use');
      }
    }
    throw error;
  }
}
```

Callers of `getTeam` / `getTeamsByIds` in other files will fail to type-check until Tasks 4–6. To keep `pnpm --filter api test` green per task:
- `BookingsService` create validation already has `command.tenantId` (#82) — wire it for real now: `getTeam(command.teamId, command.tenantId)`.
- `TeamResolver.createTeam` needs a `string` tenant: wire `tenantId: requireTenantId(currentUser)` now (Task 5 adds its test).
- Every other call site (`BookingsService.update`, `JobsService.assignTeam`, `TeamResolver.team`, both loader batch functions) gets a temporary `null` second argument with a `// #83 Task N` marker naming the task that wires it. Never pass `BOOTSTRAP_TENANT_ID`. `null` fails closed, so the temporary state can only hide rows, never leak them.
- Update those call sites' existing unit-test expectations for the extra argument (e.g. `toHaveBeenCalledWith('team-1', null)`); Tasks 4–6 change them to the real tenant.
- Tasks 4–6 replace every marker; Task 8's final gate greps that no `// #83 Task` marker remains.

- [ ] **Step 4: Run** — PASS (`pnpm --filter api test`).
- [ ] **Step 5: Commit** — `feat(83): scope TeamsService by tenant`

---

### Task 3: `CleanersService` tenant predicate

**Spec:** §4.4 (Cleaner uniqueness; same-tenant cleaner → team), §4.5, §4.6; Slice decisions 3, 5, 7.

**Files:**
- Modify: `apps/api/src/modules/cleaners/application/commands/create-cleaner.command.ts`, `update-cleaner.command.ts`, `assign-cleaner-to-team.command.ts` (+ `tenantId: string` each)
- Modify: `apps/api/src/modules/cleaners/application/services/cleaners.service.ts`
- Test: `apps/api/src/modules/cleaners/tests/application/cleaners.service.spec.ts`

**Interfaces:**
- Consumes: `Cleaner.tenantId`, constraint `uq_cleaner_tenant_email` (Task 1).
- Produces: `createCleaner(command)`, `updateCleaner(id, command)`, `assignCleanerToTeam(command)` — commands carry `tenantId: string`; `getCleaner(id: string, tenantId: string | null): Promise<Cleaner | null>`; `listCleaners(tenantId: string | null): Promise<Cleaner[]>`; `listTeamCleaners(teamId: string, tenantId: string | null): Promise<Cleaner[]>`. `listCleanersByTeamIds` is **deleted** (Task 4 removes its only caller).

- [ ] **Step 1: Write the failing tests**

```ts
describe('tenant predicate (#83)', () => {
  it('getCleaner / listCleaners / listTeamCleaners scope by tenant', async () => {
    cleanerRepository.findOneBy.mockResolvedValue(null);
    cleanerRepository.find.mockResolvedValue([]);
    cleanerRepository.findBy.mockResolvedValue([]);
    await service.getCleaner('c-1', 't-a');
    await service.listCleaners('t-a');
    await service.listTeamCleaners('team-1', 't-a');
    expect(cleanerRepository.findOneBy).toHaveBeenCalledWith({ id: 'c-1', tenantId: 't-a' });
    expect(cleanerRepository.find).toHaveBeenCalledWith({ where: { tenantId: 't-a' } });
    expect(cleanerRepository.findBy).toHaveBeenCalledWith({ teamId: 'team-1', tenantId: 't-a' });
  });

  it('null tenant fails closed without a repository query', async () => {
    await expect(service.getCleaner('c-1', null)).resolves.toBeNull();
    await expect(service.listCleaners(null)).resolves.toEqual([]);
    await expect(service.listTeamCleaners('team-1', null)).resolves.toEqual([]);
    expect(cleanerRepository.findOneBy).not.toHaveBeenCalled();
    expect(cleanerRepository.find).not.toHaveBeenCalled();
    expect(cleanerRepository.findBy).not.toHaveBeenCalled();
  });

  it('createCleaner persists the tenant and tags the audit event', async () => {
    await service.createCleaner({ actorId: 'a', tenantId: 't-a', fullName: 'N', phone: '1', email: 'e@x.com' });
    expect(manager.create).toHaveBeenCalledWith(CleanerEntity, expect.objectContaining({ tenantId: 't-a', teamId: null }));
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cleaner.create', scope: AdminScope.TENANT, tenantId: 't-a' }),
    );
  });

  it('updateCleaner looks up and updates within the tenant and never writes tenantId', async () => {
    manager.findOneBy.mockResolvedValueOnce(makeEntity({ id: 'c-1', tenantId: 't-a' }));
    manager.findOneByOrFail.mockResolvedValueOnce(makeEntity({ id: 'c-1', tenantId: 't-a' }));
    await service.updateCleaner('c-1', { actorId: 'a', tenantId: 't-a', fullName: 'New' });
    expect(manager.findOneBy).toHaveBeenCalledWith(CleanerEntity, { id: 'c-1', tenantId: 't-a' });
    const [, where, set] = manager.update.mock.calls[0] as [unknown, object, Record<string, unknown>];
    expect(where).toEqual({ id: 'c-1', tenantId: 't-a' });
    expect(set).not.toHaveProperty('tenantId');
    expect(set).not.toHaveProperty('actorId');
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cleaner.update', scope: AdminScope.TENANT, tenantId: 't-a' }),
    );
  });

  it('updateCleaner on another tenant’s cleaner is NotFound', async () => {
    manager.findOneBy.mockResolvedValueOnce(null);
    await expect(
      service.updateCleaner('c-foreign', { actorId: 'a', tenantId: 't-b', fullName: 'X' }),
    ).rejects.toThrow(NotFoundException);
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('assignCleanerToTeam resolves team and cleaner within the tenant before mutating', async () => {
    manager.findOneBy.mockResolvedValueOnce(null); // team of another tenant
    await expect(
      service.assignCleanerToTeam({ actorId: 'a', tenantId: 't-b', cleanerId: 'c-1', teamId: 'team-a' }),
    ).rejects.toThrow(NotFoundException);
    expect(manager.findOneBy).toHaveBeenCalledWith(TeamEntity, { id: 'team-a', tenantId: 't-b' });
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('assignCleanerToTeam tags the audit event', async () => {
    manager.findOneBy
      .mockResolvedValueOnce({ id: 'team-a', tenantId: 't-a' })
      .mockResolvedValueOnce(makeEntity({ id: 'c-1', tenantId: 't-a' }));
    manager.findOneByOrFail.mockResolvedValueOnce(makeEntity({ id: 'c-1', tenantId: 't-a', teamId: 'team-a' }));
    await service.assignCleanerToTeam({ actorId: 'a', tenantId: 't-a', cleanerId: 'c-1', teamId: 'team-a' });
    expect(manager.findOneBy).toHaveBeenNthCalledWith(2, CleanerEntity, { id: 'c-1', tenantId: 't-a' });
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'cleaner.assign_team', scope: AdminScope.TENANT, tenantId: 't-a' }),
    );
  });

  it('maps uq_cleaner_tenant_email to Conflict and rethrows other unique violations', async () => {
    manager.save.mockRejectedValueOnce({ code: '23505', driverError: { constraint: 'uq_cleaner_tenant_email' } });
    await expect(
      service.createCleaner({ actorId: 'a', tenantId: 't-a', fullName: 'N', phone: '1', email: 'e@x.com' }),
    ).rejects.toThrow(new ConflictException('Email is already in use'));
    const other = { code: '23505', driverError: { constraint: 'uq_cleaner_id_tenant' } };
    manager.save.mockRejectedValueOnce(other);
    await expect(
      service.createCleaner({ actorId: 'a', tenantId: 't-a', fullName: 'N', phone: '1', email: 'e@x.com' }),
    ).rejects.toBe(other);
  });
});
```

(`makeEntity` is a local test helper returning a full `CleanerEntity`-shaped object with defaults; add it if the spec has no equivalent. Extend the existing `manager` mock with `findOneBy`, `findOneByOrFail`, `update` if not already present. Remove tests for `listCleanersByTeamIds`.)

- [ ] **Step 2: Run to verify failure** — `pnpm --filter api test -- cleaners.service` → FAIL.

- [ ] **Step 3: Implement**

- `assignCleanerToTeam`: `manager.findOneBy(TeamEntity, { id: command.teamId, tenantId: command.tenantId })`, then `manager.findOneBy(CleanerEntity, { id: command.cleanerId, tenantId: command.tenantId })`; `manager.update(CleanerEntity, { id: command.cleanerId, tenantId: command.tenantId }, { teamId: command.teamId, updatedAt: new Date() })`; `findOneByOrFail(CleanerEntity, { id: command.cleanerId, tenantId: command.tenantId })`; audit with `tenantId: command.tenantId, scope: AdminScope.TENANT`.
- `createCleaner`: `manager.create(CleanerEntity, { tenantId: command.tenantId, teamId: null, … })`; audit tagged.
- `getCleaner` / `listCleaners` / `listTeamCleaners`: null-tenant short-circuit, then `findOneBy({ id, tenantId })` / `find({ where: { tenantId } })` / `findBy({ teamId, tenantId })`.
- `updateCleaner`: lookup `{ id, tenantId: command.tenantId }`; `const { actorId, tenantId, ...changes } = command;` (both consumed elsewhere — `void` them with a comment, #82 `CustomersService.update` idiom); `manager.update(CleanerEntity, { id, tenantId }, { ...changes, updatedAt: new Date() })`; `findOneByOrFail(CleanerEntity, { id, tenantId })`; audit tagged.
- Delete `listCleanersByTeamIds` (and the `In` import if now unused).
- `translateUniqueViolation`: constraint-name match on `uq_cleaner_tenant_email` (fallback to code alone when no constraint name), message unchanged.

So the suite compiles: the three `CleanerResolver` mutations wire `tenantId: requireTenantId(currentUser)` now (after the input spread; Task 5 adds their tests), and `CleanerResolver.cleaner` gets the `null` placeholder with a `// #83 Task 5` marker (Task 2 Step 3 rule). `CleanerTeamLoaders` still references `listCleanersByTeamIds`: delete `createTeamCleanersBatchFn` / `teamCleanersLoader` and their unit tests here (Slice decision 5) — Task 4 finishes the loader.

- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — `feat(83): scope CleanersService by tenant`

---

### Task 4: Tenant-scoped team loaders

**Spec:** §4.5 (same predicate on batch loaders); Slice decisions 4, 5.

**Files:**
- Modify: `apps/api/src/modules/cleaners/presentation/graphql/cleaner-team.loaders.ts`
- Modify: `apps/api/src/modules/jobs/presentation/graphql/job-relation.loaders.ts`
- Test: `apps/api/src/modules/cleaners/tests/graphql/cleaner-team.loaders.spec.ts`
- Test: `apps/api/src/modules/jobs/tests/graphql/job-relation.loaders.spec.ts` (create if absent; otherwise extend the existing jobs loader spec)

**Interfaces:**
- Consumes: `TeamsService.getTeamsByIds(ids, tenantId)` (Task 2).
- Produces: `createTeamBatchFn(teamsService: Pick<TeamsService, 'getTeamsByIds'>, tenantId: string | null): DataLoader.BatchLoadFn<string, Team | null>`; `CleanerTeamLoaders.teamLoaderFor(tenantId: string | null): DataLoader<string, Team | null>`; `createJobTeamBatchFn(teamsService, tenantId)` and `JobRelationLoaders.teamLoaderFor(tenantId)` (same shapes). Consumed by Task 5 (`Cleaner.team`) and Task 6 (`CleaningJob.team`).

- [ ] **Step 1: Write the failing tests** (cleaners; the jobs spec mirrors it with `createJobTeamBatchFn` / `JobRelationLoaders`)

```ts
describe('teamLoader batch function (#83 tenant scope)', () => {
  it('asks the service for the ids within the given tenant and maps misses to null', async () => {
    const teamA = makeTeam('a');
    const teamsService = { getTeamsByIds: jest.fn().mockResolvedValue([teamA]) };
    const batchFn = createTeamBatchFn(teamsService, 't-a');
    await expect(batchFn(['a', 'foreign'])).resolves.toEqual([teamA, null]);
    expect(teamsService.getTeamsByIds).toHaveBeenCalledWith(['a', 'foreign'], 't-a');
  });

  it('null tenant resolves every key to null without calling the service', async () => {
    const teamsService = { getTeamsByIds: jest.fn() };
    const batchFn = createTeamBatchFn(teamsService, null);
    await expect(batchFn(['a', 'b'])).resolves.toEqual([null, null]);
    expect(teamsService.getTeamsByIds).not.toHaveBeenCalled();
  });
});

describe('CleanerTeamLoaders.teamLoaderFor', () => {
  it('returns one DataLoader per tenant id, memoized for the request', () => {
    const loaders = new CleanerTeamLoaders({ getTeamsByIds: jest.fn() } as never);
    expect(loaders.teamLoaderFor('t-a')).toBe(loaders.teamLoaderFor('t-a'));
    expect(loaders.teamLoaderFor('t-a')).not.toBe(loaders.teamLoaderFor('t-b'));
    expect(loaders.teamLoaderFor(null)).toBe(loaders.teamLoaderFor(null));
  });

  it('batches loads within one tenant into one tenant-scoped call', async () => {
    const getTeamsByIds = jest.fn().mockResolvedValue([makeTeam('a')]);
    const loaders = new CleanerTeamLoaders({ getTeamsByIds } as never);
    const loader = loaders.teamLoaderFor('t-a');
    await Promise.all([loader.load('a'), loader.load('b')]);
    expect(getTeamsByIds).toHaveBeenCalledTimes(1);
    expect(getTeamsByIds).toHaveBeenCalledWith(['a', 'b'], 't-a');
  });
});
```

(`makeTeam` gains `tenantId: 't-a'`; `makeCleaner` / `createTeamCleanersBatchFn` tests are already gone from Task 3.)

- [ ] **Step 2: Run to verify failure** — `pnpm --filter api test -- loaders` → FAIL.

- [ ] **Step 3: Implement** (cleaners; jobs identical in shape, keeping its `checklistLoader`)

```ts
// `tenantId` comes from the resolver (`@CurrentUser()`), never from
// ambient request state (#83 slice decision 4). `null` — no tenant scope —
// resolves every key to null without touching the service.
export function createTeamBatchFn(
  teamsService: Pick<TeamsService, 'getTeamsByIds'>,
  tenantId: string | null,
): DataLoader.BatchLoadFn<string, Team | null> {
  return async (ids) => {
    if (tenantId === null) {
      return ids.map(() => null);
    }
    const teams = await teamsService.getTeamsByIds([...ids], tenantId);
    const byId = new Map(teams.map((team) => [team.id, team]));
    return ids.map((id) => byId.get(id) ?? null);
  };
}

// Request-scoped: fresh caches per GraphQL request. One DataLoader per
// tenant id, so a cached Team can only ever be served back to a caller of
// the tenant it was loaded for.
@Injectable({ scope: Scope.REQUEST })
export class CleanerTeamLoaders {
  private readonly teamLoaders = new Map<string | null, DataLoader<string, Team | null>>();

  constructor(private readonly teamsService: TeamsService) {}

  teamLoaderFor(tenantId: string | null): DataLoader<string, Team | null> {
    let loader = this.teamLoaders.get(tenantId);
    if (!loader) {
      loader = new DataLoader(createTeamBatchFn(this.teamsService, tenantId));
      this.teamLoaders.set(tenantId, loader);
    }
    return loader;
  }
}
```

`CleanerTeamLoaders` no longer injects `CleanersService`; update `cleaners.module.di.spec.ts` if it asserts the constructor deps. Replace the Task 2/3 `// #83 Task 4` markers. `teamLoader` no longer exists, so switch its two callers now: `CleanerResolver.team` → `this.loaders.teamLoaderFor(null) // #83 Task 5` and `JobResolver.team` → `this.loaders.teamLoaderFor(null) // #83 Task 6` (fail-closed placeholders; Tasks 5 and 6 wire `@CurrentUser()`).

- [ ] **Step 4: Run** — PASS.
- [ ] **Step 5: Commit** — `feat(83): tenant-scope team DataLoaders`

---

### Task 5: GraphQL — `@Authorize`, resolvers, relation guard

**Spec:** §4.2 (roles unchanged, no Super Admin), §4.5 (principal-only tenant; filters narrow only; relations and loaders share the predicate; not-found semantics); Slice decisions 4, 8.

**Files:**
- Modify: `apps/api/src/modules/cleaners/presentation/graphql/team.type.ts`, `cleaner.type.ts` (+ `@Authorize(tenantReadAuthorizer())`)
- Modify: `apps/api/src/modules/cleaners/presentation/graphql/team.resolver.ts`, `cleaner.resolver.ts`
- Modify: `apps/api/src/modules/cleaners/presentation/graphql/mappers.ts` (keep `tenantId` out of the GraphQL objects; no change unless the type checker requires it)
- Test: `apps/api/src/modules/cleaners/tests/graphql/team.resolver.spec.ts`, `cleaner.resolver.spec.ts`
- Create test: `apps/api/src/modules/cleaners/tests/graphql/team-cleaner-relations.authorization.spec.ts`

**Interfaces:**
- Consumes: `tenantReadAuthorizer`, `requireTenantId` (#82); Tasks 2–4 service/loader signatures.
- Produces: no new public GraphQL surface.

- [ ] **Step 1: Write the failing tests**

Resolver specs (extend the existing ones; `principal = { id: 'u', role: Role.OPS_MANAGER, scope: AdminScope.TENANT, tenantId: 't-a' }`):

```ts
it('team(id) passes the caller tenant', async () => {
  teamsService.getTeam.mockResolvedValue(null);
  await expect(resolver.team('team-1', principal)).resolves.toBeNull();
  expect(teamsService.getTeam).toHaveBeenCalledWith('team-1', 't-a');
});

it('createTeam takes tenantId from the principal, after the input spread', async () => {
  teamsService.createTeam.mockResolvedValue(makeTeam());
  await resolver.createTeam({ name: 'Alpha', tenantId: 'evil' } as never, principal);
  expect(teamsService.createTeam).toHaveBeenCalledWith({ name: 'Alpha', actorId: 'u', tenantId: 't-a' });
});

it('cleaner(id) passes the caller tenant', async () => {
  cleanersService.getCleaner.mockResolvedValue(null);
  await resolver.cleaner('c-1', principal);
  expect(cleanersService.getCleaner).toHaveBeenCalledWith('c-1', 't-a');
});

it.each(['createCleaner', 'updateCleaner', 'assignCleanerToTeam'])(
  '%s passes requireTenantId(principal)',
  async (mutation) => { /* call each with minimal args; assert command.tenantId === 't-a' */ },
);

it('Cleaner.team uses the loader for the caller tenant', async () => {
  const load = jest.fn().mockResolvedValue(null);
  loaders.teamLoaderFor.mockReturnValue({ load });
  await resolver.team({ id: 'c-1', teamId: 'team-a' }, principal);
  expect(loaders.teamLoaderFor).toHaveBeenCalledWith('t-a');
  expect(load).toHaveBeenCalledWith('team-a');
});

it('Cleaner.team with no principal uses the null-tenant loader', async () => {
  const load = jest.fn().mockResolvedValue(null);
  loaders.teamLoaderFor.mockReturnValue({ load });
  await resolver.team({ id: 'c-1', teamId: 'team-a' }, undefined);
  expect(loaders.teamLoaderFor).toHaveBeenCalledWith(null);
});
```

Write each of the `it.each` cases out explicitly in M6 (three calls, three `toHaveBeenCalledWith(expect.objectContaining({ tenantId: 't-a' }))` assertions).

`@Authorize` metadata (in the resolver specs or a small `team-cleaner.authorize.spec.ts`):

```ts
import { getAuthorizer } from '@ptc-org/nestjs-query-graphql/src/decorators'; // deep import as in #82 if not re-exported
it.each([TeamType, CleanerType])('%p carries the tenant read authorizer', async (DTO) => {
  const authorizer = getAuthorizer(DTO as never);
  expect(authorizer).toBeDefined();
  await expect(
    authorizer!.authorize({ req: { user: principal } } as never, { operationGroup: 'read' } as never),
  ).resolves.toEqual({ tenantId: { eq: 't-a' } });
});
```

(If `getAuthorizer` is not reachable, assert through `@Authorize`'s reflect-metadata key the way #82's spec did; M6 checks `customer-read.resolver.spec.ts` for the exact mechanism.)

Relation guard (mirrors #82's file):

```ts
// @ptc-org/nestjs-query-graphql 9.5.0 does not re-export getRelations from
// the package root, so this deep import is required.
import { getRelations } from '@ptc-org/nestjs-query-graphql/src/decorators';
import { BookingDTO } from '../../../bookings/presentation/graphql/booking.dto';
import { CleaningJobType } from '../../../jobs/presentation/graphql/cleaning-job.type';
import { CleanerType } from '../../presentation/graphql/cleaner.type';
import { TeamType } from '../../presentation/graphql/team.type';

describe('Relations targeting Team/Cleaner (tenant isolation, #83)', () => {
  it('no relation targeting Team/Cleaner overrides auth or enables relation mutations', () => {
    const owners = [
      ['Booking', BookingDTO],
      ['CleaningJob', CleaningJobType],
      ['Team', TeamType],
      ['Cleaner', CleanerType],
    ] as const;
    const targets: unknown[] = [TeamType, CleanerType];
    const found: string[] = [];
    for (const [ownerName, owner] of owners) {
      const { many = {}, one = {} } = getRelations(owner as never);
      for (const [relationName, relation] of Object.entries({ ...many, ...one })) {
        if (!targets.includes(relation.DTO)) continue;
        found.push(`${ownerName}.${relationName}`);
        expect(relation.auth).toBeUndefined();
        expect(relation.update?.enabled).toBe(false);
        expect(relation.remove?.enabled).toBe(false);
      }
    }
    expect(found.sort()).toEqual(['Booking.team', 'Team.cleaners'].sort());
  });
});
```

(`CleaningJob.team` and `Cleaner.team` are Clensy `@ResolveField`s, not nestjs-query relations, so they are absent from `found`; their scoping is Task 4 + this task's resolver tests.)

- [ ] **Step 2: Run to verify failure** — `pnpm --filter api test -- cleaners` → FAIL.

- [ ] **Step 3: Implement**

- `team.type.ts` / `cleaner.type.ts`: `@Authorize(tenantReadAuthorizer())` above `@ObjectType`. No `tenantId` field.
- `TeamResolver.createTeam`: `{ ...input, actorId: currentUser.id, tenantId: requireTenantId(currentUser) }`. `team(id, @CurrentUser() currentUser)`: `getTeam(id, currentUser.tenantId)`.
- `CleanerResolver`: the three mutations add `tenantId: requireTenantId(currentUser)` after `...input` / explicit fields; `cleaner(id, @CurrentUser())` passes `currentUser.tenantId`; `team` field:

```ts
// Tenant from the principal, never from the parent row (#83 slice decision
// 4). No principal ⇒ null-tenant loader ⇒ null.
@ResolveField(() => TeamType, { nullable: true })
async team(
  @Parent() cleaner: Pick<Cleaner, 'id' | 'teamId'>,
  @CurrentUser() currentUser: AuthenticatedPrincipal | undefined,
): Promise<TeamType | null> {
  if (cleaner.teamId === null) {
    return null;
  }
  const team = await this.loaders
    .teamLoaderFor(currentUser?.tenantId ?? null)
    .load(cleaner.teamId);
  return team ? toTeamType(team) : null;
}
```

Update the resolver header comments in the #82 style (tenant only from the principal; reads pass it, writes require it). Replace all `// #83 Task 5` markers.

- [ ] **Step 4: Run** — PASS; `pnpm --filter api build` PASS; regenerate the schema the way the repo does (`pnpm --filter api build` / schema emit) and confirm `git diff` shows **no** schema change.
- [ ] **Step 5: Commit** — `feat(83): enforce tenant isolation on team and cleaner GraphQL`

---

### Task 6: Consumers — Bookings, Jobs, seed

**Spec:** §4.4 (booking → team, job → team same-tenant at the application layer), §4.5 (REST fail-closed; principal-only tenant); Slice decisions 6, 8.

**Files:**
- Modify: `apps/api/src/modules/bookings/application/commands/update-booking.command.ts` (+ `tenantId: string | null`)
- Modify: `apps/api/src/modules/bookings/application/services/bookings.service.ts` (lines ~140 `update`, ~280 create validation)
- Modify: `apps/api/src/modules/bookings/presentation/graphql/booking.resolver.ts` (`updateBooking`)
- Modify: `apps/api/src/modules/bookings/presentation/rest/booking.controller.ts` (`update`)
- Modify: `apps/api/src/modules/jobs/application/commands/assign-team-to-job.command.ts` (+ `tenantId: string`)
- Modify: `apps/api/src/modules/jobs/application/services/jobs.service.ts` (`assignTeam`)
- Modify: `apps/api/src/modules/jobs/presentation/graphql/job.resolver.ts` (`assignTeamToJob`, `team` field)
- Modify: `apps/api/src/modules/bookings/infrastructure/persistence/seed/booking-fixtures.seed-data.ts` (`bookingFixtureTeam` + `tenantId: BOOTSTRAP_TENANT_ID`)
- Test: `bookings.service.spec.ts`, `booking.resolver.spec.ts`, `booking.controller.spec.ts`, `jobs.service.spec.ts`, `job.resolver.spec.ts`

**Interfaces:**
- Consumes: `TeamsService.getTeam(id, tenantId)` (Task 2); `JobRelationLoaders.teamLoaderFor` (Task 4).
- Produces: `UpdateBookingCommand.tenantId: string | null`; `AssignTeamToJobCommand.tenantId: string`.

- [ ] **Step 1: Write the failing tests**

```ts
// bookings.service.spec.ts
it('create validates teamId within the command tenant', async () => {
  /* arrange valid customer/property/service/pricing mocks as existing tests do */
  teamsService.getTeam.mockResolvedValue(null);
  await expect(service.create({ ...validCommand, tenantId: 't-b', teamId: 'team-a' })).rejects.toThrow(NotFoundException);
  expect(teamsService.getTeam).toHaveBeenCalledWith('team-a', 't-b');
});

it('update validates teamId within the command tenant', async () => {
  teamsService.getTeam.mockResolvedValue(null);
  await expect(service.update('b-1', { actorId: 'u', tenantId: 't-b', teamId: 'team-a' })).rejects.toThrow(NotFoundException);
  expect(teamsService.getTeam).toHaveBeenCalledWith('team-a', 't-b');
});

it('update with a null tenant and a teamId fails closed (REST)', async () => {
  teamsService.getTeam.mockResolvedValue(null);
  await expect(service.update('b-1', { actorId: null, tenantId: null, teamId: 'team-a' })).rejects.toThrow(NotFoundException);
});

it('update never passes tenantId to manager.update', async () => {
  teamsService.getTeam.mockResolvedValue({ id: 'team-a', tenantId: 't-a' });
  manager.findOneBy.mockResolvedValue(existingBooking);
  await service.update('b-1', { actorId: 'u', tenantId: 't-a', teamId: 'team-a' });
  const [, , set] = manager.update.mock.calls[0] as [unknown, unknown, Record<string, unknown>];
  expect(set).not.toHaveProperty('tenantId');
});

it('update without teamId does not look up a team, even with a null tenant', async () => {
  manager.findOneBy.mockResolvedValue(existingBooking);
  await service.update('b-1', { actorId: null, tenantId: null, status: BookingStatus.CONFIRMED });
  expect(teamsService.getTeam).not.toHaveBeenCalled();
});

// booking.resolver.spec.ts
it('updateBooking passes the caller tenant', async () => {
  await resolver.updateBooking({ id: 'b-1', teamId: 'team-a' } as never, principal);
  expect(bookingsService.update).toHaveBeenCalledWith('b-1', expect.objectContaining({ tenantId: 't-a' }));
});

// booking.controller.spec.ts
it('PATCH passes a null tenant (no principal ⇒ no tenant scope)', async () => {
  await controller.update('b-1', { teamId: 'team-a' } as never);
  expect(bookingsService.update).toHaveBeenCalledWith('b-1', expect.objectContaining({ actorId: null, tenantId: null }));
});

// jobs.service.spec.ts
it('assignTeam looks the team up within the command tenant', async () => {
  teamsService.getTeam.mockResolvedValue(null);
  await expect(service.assignTeam({ actorId: 'u', tenantId: 't-b', jobId: 'j-1', teamId: 'team-a' })).rejects.toThrow(NotFoundException);
  expect(teamsService.getTeam).toHaveBeenCalledWith('team-a', 't-b');
  expect(dataSource.transaction).not.toHaveBeenCalled();
});

// job.resolver.spec.ts
it('assignTeamToJob passes requireTenantId(principal)', async () => {
  await resolver.assignTeamToJob({ jobId: 'j-1', teamId: 'team-a' } as never, principal);
  expect(jobsService.assignTeam).toHaveBeenCalledWith({ actorId: 'u', jobId: 'j-1', teamId: 'team-a', tenantId: 't-a' });
});

it('CleaningJob.team uses the loader for the caller tenant', async () => {
  const load = jest.fn().mockResolvedValue(null);
  loaders.teamLoaderFor.mockReturnValue({ load });
  await expect(resolver.team({ teamId: 'team-a' } as never, principal)).resolves.toBeNull();
  expect(loaders.teamLoaderFor).toHaveBeenCalledWith('t-a');
});
```

- [ ] **Step 2: Run to verify failure** — `pnpm --filter api test -- bookings jobs` → FAIL.

- [ ] **Step 3: Implement**

- `BookingsService.update`: `getTeam(command.teamId, command.tenantId)`; destructure `const { actorId, tenantId, ...rawChanges } = command;` (`void tenantId;` with a comment: consumed by the team lookup above; `booking_entity` has no `tenantId` column until #85, so it must never reach `manager.update`).
- `BookingsService` create validation: `getTeam(command.teamId, command.tenantId)`.
- `BookingMutationResolver.updateBooking`: `tenantId: currentUser.tenantId`.
- `BookingController.update`: `{ ...dto, actorId: null, tenantId: null }` with the #82-style comment (no principal ⇒ no tenant scope; a non-null `teamId` fails closed with the existing 404; #85/#91 remove/rebuild REST).
- `JobsService.assignTeam`: `getTeam(command.teamId, command.tenantId)`. Comment: application-level same-tenant check now; `fk_cleaning_job_team` stays id-only until #86.
- `JobResolver.assignTeamToJob`: `tenantId: requireTenantId(currentUser)`. `team` field: `@CurrentUser() currentUser: AuthenticatedPrincipal | undefined` → `this.loaders.teamLoaderFor(currentUser?.tenantId ?? null).load(job.teamId)`.
- Seed: `bookingFixtureTeam = { id: …, tenantId: BOOTSTRAP_TENANT_ID, name: 'Seed Team A' }`.
- Replace the remaining `// #83 Task 6` markers.

- [ ] **Step 4: Run** — PASS (`pnpm --filter api test`), `pnpm --filter api build` PASS.
- [ ] **Step 5: Commit** — `feat(83): look up teams in the caller tenant from bookings and jobs`

---

### Task 7: Existing e2e fixtures and cleanup helper

**Spec:** §4.4 (required `tenantId`); verification only — no product change.

**Files:**
- Modify: `apps/api/test/helpers/seed-tenant-admin.ts` (`removeTestTenants`)
- Modify (as needed to compile/pass): `test/cleaners-teams.e2e-spec.ts`, `test/cleaners-teams.service.e2e-spec.ts`, `test/jobs.e2e-spec.ts`, `test/jobs.service.e2e-spec.ts`, `test/bookings.e2e-spec.ts`, `test/bookings.service.e2e-spec.ts`, and any other spec from `grep -rln "createTeam\|createCleaner\|TeamEntity\|CleanerEntity\|team_entity\|cleaner_entity" test`

- [ ] **Step 1: Run the e2e suite to see the breakage** — `pnpm --filter api test:e2e` → FAIL (NOT NULL `tenantId`, changed service signatures).

- [ ] **Step 2: Fix fixtures**
  - Service calls gain `tenantId`. Where tenancy is incidental, use `BOOTSTRAP_TENANT_ID`, and log in as a bootstrap-tenant admin (the existing `seed-owner` / `seedTenantAdmin` defaults), so GraphQL reads through `@Authorize` see the rows.
  - Direct repository inserts of `TeamEntity` / `CleanerEntity` gain `tenantId`.
  - Team names / cleaner emails stay unique per run where the spec already randomizes them; do not add randomization where a test asserts on a fixed value.
  - Assertions that relied on global uniqueness (e.g. "same email in any context ⇒ 409") move to "same tenant ⇒ 409"; cross-tenant cases belong to Task 8.
- [ ] **Step 3: Extend `removeTestTenants`** — before deleting admins, delete `cleaner_entity` then `team_entity` rows `WHERE "tenantId" = ANY($1)`. Update its comment: callers whose tests insert a Booking/CleaningJob referencing a test tenant's team MUST delete those first (`fk_booking_team`, `fk_cleaning_job_team` are `ON DELETE RESTRICT`).
- [ ] **Step 4: Run** — `pnpm --filter api test:e2e` → PASS, except the 3 pre-existing `main` failures (record their names in the task report; any other failure blocks).
- [ ] **Step 5: Commit** — `test(83): give team and cleaner fixtures a tenant`

---

### Task 8: Two-tenant isolation e2e + final gate

**Spec:** §4.2, §4.4, §4.5, §4.6, §4.9; Review Focus 1–5.

**Files:**
- Create: `apps/api/test/teams-cleaners.tenant-isolation.e2e-spec.ts`

**Interfaces:**
- Consumes: everything above; helpers `createTestTenant`, `seedTenantAdmin`, `removeTestTenants`, `uniqueEmail`; login/`gql` helpers copied from `customers-properties.tenant-isolation.e2e-spec.ts` (the existing file keeps its own copies — do not extract a shared helper in this slice).

- [ ] **Step 1: Write the suite** (it should pass immediately if Tasks 1–7 are right; to prove it can fail, temporarily remove `@Authorize` from `TeamType` locally and confirm the list/filter/relation cases fail, then restore — record the count in the task report, #82 precedent)

Setup (`beforeAll`): two test tenants A and B; a `TENANT_OWNER` for each, logged in (`cookieA`, `cookieB`); via services as each tenant: `teamA` (`Alpha ${run}`), `cleanerA` assigned to `teamA`, `teamB`, `cleanerB`; a bookable service + price (catalog is still unscoped, #84); customer/property per tenant (as in #82's suite); a booking row (repository insert, #82 `crossTenantBooking` shape) with `teamId: teamA.id` and a job created from it with `teamId: teamA.id` (repository insert or `JobsService` with A's tenant). `afterAll`: delete the job, bookings, then `removeTestTenants([tenantA, tenantB])`.

Cases (each `it` asserts `response.body.errors` explicitly):

1. **List + count scoped:** as B, `teams(paging: { limit: 50 }) { totalCount nodes { id } }` and `cleaners(...)` include B's ids and exclude A's.
2. **Widening filter (Review Focus 1):** as B, `teams(filter: { id: { eq: teamA.id } }) { totalCount nodes { id } }` ⇒ `nodes: []`, `totalCount: 0`; `teams(filter: { name: { eq: teamA.name } })` ⇒ same; `cleaners(filter: { email: { eq: cleanerA.email } })` ⇒ same.
3. **Get-by-id:** as B, `team(id: teamA.id)` ⇒ `null`; `cleaner(id: cleanerA.id)` ⇒ `null` (no errors, no 403).
4. **Relation safety (Review Focus 2):**
   - as A, `teams(filter: { id: { eq: teamA.id } }) { nodes { cleaners { nodes { id } } } }` ⇒ exactly `[cleanerA.id]`; as B for `teamB` ⇒ exactly `[cleanerB.id]`.
   - as A, `cleaner(id: cleanerA.id) { team { id } }` ⇒ `teamA.id`.
   - as B, `job(id: job.id) { team { id } }` ⇒ `team: null`; as A ⇒ `teamA.id`.
   - as B, `bookings(filter: { id: { eq: booking.id } }) { nodes { team { id } } }` ⇒ the booking node (Booking is unscoped until #85) with `team: null`; as A ⇒ `teamA.id`.
5. **Cross-tenant writes ⇒ 404 (not 403):** as B — `updateCleaner(id: cleanerA.id, …)`; `assignCleanerToTeam(cleanerId: cleanerB.id, teamId: teamA.id)`; `assignCleanerToTeam(cleanerId: cleanerA.id, teamId: teamB.id)`; `assignTeamToJob(input: { jobId: job.id, teamId: teamA.id })`; `updateBooking(updateBookingInput: { id: booking.id, teamId: teamA.id })`; `createBooking` with B's customer/property and `teamId: teamA.id`. Each ⇒ `errors[0].extensions.status === 404`; re-read A's rows unchanged (cleanerB still in `teamB`/no team, job still `teamA`).
6. **Uniqueness (Review Focus 4):** as A `createTeam(name: "Shared ${run}")` and as B the same ⇒ both succeed; as A again ⇒ 409 `Team name is already in use`; as A `createTeam(name: "shared ${run}")` (case differs) ⇒ succeeds. Same for `createCleaner` email: A and B ⇒ both succeed; A again ⇒ 409 `Email is already in use`.
7. **REST fail-closed (Slice decision 6):** `PATCH /bookings/:id` with `{ teamId: teamA.id }` ⇒ 404; `PATCH /bookings/:id` with `{ status: … }` (no `teamId`) ⇒ 200; `POST /bookings` with a `teamId` ⇒ 404 (already 404 from #82's customer lookup — assert the status only).
8. **Audit:** after A's `createTeam`, `createCleaner`, `updateCleaner`, `assignCleanerToTeam`, the `audit_event` rows for those entity ids have `tenantId = tenantA` and `scope = 'TENANT'`.
9. **Database backstop:** `dataSource.query('UPDATE "cleaner_entity" SET "teamId" = $1 WHERE "id" = $2', [teamA.id, cleanerB.id])` rejects with constraint `fk_cleaner_team_tenant`.

- [ ] **Step 2: Run** — `pnpm --filter api test:e2e -- teams-cleaners.tenant-isolation` → PASS.
- [ ] **Step 3: Final gate**

```bash
pnpm --filter api lint
pnpm --filter api test
pnpm --filter api test:e2e
pnpm --filter api build
# fresh database: create an empty DB, point DB_NAME at it, then
pnpm --filter api migration:run
grep -rn "// #83 Task" apps/api/src apps/api/test   # expect no output
git diff --stat main -- apps/web packages           # expect no output
```

Also confirm the generated GraphQL schema and `@clensy/client` are unchanged.

- [ ] **Step 4: Commit** — `test(83): add two-tenant team and cleaner isolation e2e`

---

## Traceability

| Task | RFC section(s) | Slice decision(s) |
| --- | --- | --- |
| 1 Schema + migration | §4.4 uniqueness/references, §4.5 DB constraints, §4.7 | 1, 2 |
| 2 `TeamsService` | §4.4, §4.5, §4.6 | 3, 7 |
| 3 `CleanersService` | §4.4, §4.5, §4.6 | 3, 5, 7 |
| 4 Loaders | §4.5 (loaders share the predicate) | 4, 5 |
| 5 GraphQL | §4.2, §4.5 | 4, 8 |
| 6 Bookings / Jobs / seed | §4.4 references, §4.5 REST | 6, 8 |
| 7 Fixtures | §4.4 (required `tenantId`) | — |
| 8 Isolation e2e | §4.2, §4.4–§4.6, §4.9 | all |

## Execution risks

- **Coupled suite:** e2e is red from Task 1 until Task 7 (see TDD strategy). Do not merge an intermediate state.
- **`@CurrentUser()` on field resolvers:** relies on `req.user` set by the parent operation's `AuthGuard`; the decorator's non-null assertion is not trusted — both field resolvers use `currentUser?.tenantId ?? null`. Task 8 case 4 proves it end-to-end.
- **Operational:** local dev databases behind `main` need #68's and #82's migrations first; this migration asserts the bootstrap tenant and aborts cleanly otherwise.
