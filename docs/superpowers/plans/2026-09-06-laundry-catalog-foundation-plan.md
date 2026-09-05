# Laundry Architecture & Catalog Foundation: Implementation Plan

| Field | Value |
| --- | --- |
| **Status** | Draft |
| **Date** | 2026-09-06 |
| **Tracking** | [#36](https://github.com/rexescario-dev/clensy-platform/issues/36) — prerequisite ticket for the Laundry epic (#37–#45) |
| **Package/repo scope** | `apps/api` (modified: `modules/catalog/domain/**`, `modules/catalog/infrastructure/persistence/pricing-rule.entity.ts`, `modules/catalog/application/{commands,services}/*pricing-rule*`, `modules/catalog/presentation/graphql/{create-pricing-rule.input,pricing-rule.type,mappers}.ts`, `platform/database/migrations/` (new file); modified test files under `modules/catalog/tests/**` and `apps/api/test/`); `packages/client` (regenerated `src/generated/graphql.ts` only — no operation-document changes) |
| **Depends on (Accepted)** | [Laundry Architecture & Catalog Foundation Specification](../specs/2026-09-06-laundry-catalog-foundation-design.md) — Status: Accepted, 2026-09-06 (including its post-acceptance addendum on `PricingRuleType`). Also relies on the already-Accepted [Catalog](../specs/2026-08-16-catalog-design.md) spec/plan for the deactivate-then-insert/`23505`→`ConflictException` translation precedent, the `manager.update()`-over-`save()` rule, RBAC/audit wiring, and the hand-added-migration-SQL convention for constraints TypeORM's entity metadata cannot express — none of that is redesigned here. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M4 |

Where this plan and the Accepted specification disagree, the specification wins and this plan must be revised.

## 1. Delivery intent

Implement exactly what the Accepted specification authorizes: `PricingRuleEntity`'s additive extension (`unit`, `effectiveFrom`, `effectiveTo`, `minimumChargeMinorUnits`, `addOnId`, `serviceId` relaxed to nullable — spec §4.2), the migration backfill reconstructing history for pre-existing rows (spec §4.8), the rewritten `createPricingRule` with its one-insert/explicit-branching sequence and close-and-read concurrency mechanism (spec §4.4), the new `resolveEffectivePricing` method (spec §4.3), and the `CreatePricingRuleInput`/`PricingRuleType` GraphQL surface changes including the post-acceptance addendum (spec §4.6). Not a redesign of any of it — no `LaundryOrder`, no laundry-domain entity, no GraphQL query beyond the existing mutation's extended input, no scheduler.

## 2. Constraints (SHALL / SHALL NOT)

**SHALL** (traced to spec section):
- Laundry services/add-ons remain ordinary `ServiceEntity`/`AddOnEntity` rows; this plan introduces no new catalog table, module, or GraphQL type for "what laundry sells" (spec §4.1).
- `PricingRule` (domain interface and entity) gains `addOnId: string | null` (FK → `AddOn.id`, `ON DELETE RESTRICT`), `unit: PricingUnit` (NOT NULL), `effectiveFrom: Date` (NOT NULL), `effectiveTo: Date | null`, `minimumChargeMinorUnits: number | null`; `serviceId` becomes `string | null` (spec §4.2).
- Exactly one of `serviceId`/`addOnId` is non-null on any row — enforced by a database `CHECK (num_nonnulls("serviceId", "addOnId") = 1)` plus an application-layer pre-check (spec §4.2, §4.7).
- `effectiveTo` is never a creation input on `CreatePricingRuleCommand`/`CreatePricingRuleInput`; every newly inserted row has `effectiveTo: null`; it is only ever set as the side effect of a later call closing it (spec §4.2, §4.4, §4.6, §4.7).
- Migration backfill: `unit` defaults to `PER_SERVICE` for every pre-existing row (via column default, no separate `UPDATE`); `effectiveFrom` backfills from each row's own `createdAt`; `effectiveTo` backfills via `LEAD("createdAt") OVER (PARTITION BY "serviceId" ORDER BY "createdAt", "id")`, `NULL` for the newest row per service (spec §4.8).
- Two new partial unique indexes: `uq_pricing_rule_open_service ON ("serviceId") WHERE "effectiveTo" IS NULL`, `uq_pricing_rule_open_addon ON ("addOnId") WHERE "effectiveTo" IS NULL` (spec §4.7).
- `active`, `uq_pricing_rule_active_service`, and `getActivePricing` are **not modified in any way** — same predicate, same query, same return shape, same call sites (spec §2, §4.2, §7). `BookingsService` is not touched.
- `createPricingRule` captures exactly one `operationNow` timestamp per call; `effectiveFrom` defaults to it when the caller omits it (spec §4.4).
- `createPricingRule`'s sequence, in order, within one transaction: (1) mutual-exclusivity + existence check; (2) `priceMinorUnits`/`minimumChargeMinorUnits` validation; (3) one atomic predicate `UPDATE ... RETURNING "effectiveFrom"` closing the target's currently-open row (if any) to the new rule's `effectiveFrom`, with the forward-only check validated against the *returned* value; (4) for `serviceId` targets only, the existing deactivate step runs and the new row gets `active: true` **only if** `effectiveFrom <= operationNow` — otherwise the deactivate step is skipped and the new row gets `active: false`; `addOnId` targets always get `active: false`; (5) exactly one `INSERT` with every column set together; (6) one `pricing_rule.create` audit event (spec §4.4).
- `resolveEffectivePricing(target, asOf)` — new method on `PricingRulesService` — returns the row whose interval covers `asOf` (`effectiveFrom <= asOf AND (effectiveTo IS NULL OR effectiveTo > asOf)`) for either target kind; does not check `Service.active`/`AddOn.active` (spec §4.3).
- RBAC/audit unchanged: `createPricingRule` remains Owner/Ops Manager only for either target kind; `pricing_rule.create`/`pricing_rule` audit action/entityType strings are unchanged (spec §4.5).
- `CreatePricingRuleInput` gains `addOnId`, `unit`, `effectiveFrom`, `minimumChargeMinorUnits` (all optional); `serviceId` becomes optional (spec §4.6). `effectiveTo` is **not** added to this input.
- `PricingRuleType.serviceId` becomes nullable; `PricingRuleType` gains a nullable `addOnId`; `toPricingRuleType` maps both explicitly (spec §4.6 post-acceptance addendum).
- No new GraphQL query is added — `resolveEffectivePricing` is consumed only as a direct injected-service call (spec §2, §4.6).

**SHALL NOT** (explicit spec non-goals — do not invent):
- No `LaundryOrder`, `LaundryOrderLine`, or any laundry-domain entity/service/GraphQL surface/web UI (spec §2, §7).
- No mechanism that promotes a scheduled `PricingRule` into the legacy `active` flag — no scheduled job, no lazy-check-on-read (spec §5, §7).
- No tiered/banded pricing, no multi-currency support (spec §2).
- No retroactive splicing into settled history, no general arbitrary-interval-overlap detection against non-adjacent historical intervals (spec §4.7, §7).
- No caller-supplied `effectiveTo` at creation time, in either `CreatePricingRuleCommand` or `CreatePricingRuleInput` (spec §2, §4.2, §4.4, §4.6, §5, §7).
- No GraphQL query surfacing `resolveEffectivePricing` or a price-history list (spec §2, §4.6, §7).
- No laundry-vs-cleaning categorization column on `Service`/`AddOn` (spec §2, §5, §7).
- No new npm dependency; no `btree_gist` extension or GiST exclusion constraint — the concurrency guard is the partial-unique-index mechanism spec §4.7 specifies (spec §5).
- No change to `Service`/`AddOn`'s own CRUD, RBAC, audit shape, or the Catalog spec's "not retired" `active` semantics (spec §7).

## 3. Implementation decisions (M4 choices)

The specification fixes behavior; these are mechanism details it deliberately leaves to implementation:

- **`PricingUnit` enum lives at `apps/api/src/modules/catalog/domain/pricing-unit.ts`**, mirroring `BookingStatus`/`JobStatus`'s own file-per-enum precedent (`modules/bookings/domain/booking-status.ts`, `modules/jobs/domain/job-status.ts`) rather than inlining it into `pricing-rule.ts`.
  ```ts
  export enum PricingUnit {
    PER_KG = 'PER_KG',
    PER_ITEM = 'PER_ITEM',
    FLAT = 'FLAT',
    PER_SERVICE = 'PER_SERVICE',
  }
  ```
- **`registerEnumType(PricingUnit, { name: 'PricingUnit' })` is called once, in `create-pricing-rule.input.ts`** — the first (and in this ticket, only) file that declares a `@Field(() => PricingUnit)` — matching `booking.dto.ts`'s/`cleaning-job.type.ts`'s "register where first used as a GraphQL type" precedent exactly.
- **The close-and-read step (spec §4.4 step 3) is a `QueryBuilder` `UPDATE ... RETURNING`, not `manager.update()`**, because `manager.update()` cannot return the row it modified and this step's forward-only check needs the prior open interval's `effectiveFrom` in the same statement:
  ```ts
  const targetColumn = command.serviceId !== undefined ? 'serviceId' : 'addOnId';
  const targetId = (command.serviceId ?? command.addOnId) as string;

  const closeResult = await manager
    .createQueryBuilder()
    .update(PricingRuleEntity)
    .set({ effectiveTo: effectiveFrom })
    .where(`"${targetColumn}" = :targetId AND "effectiveTo" IS NULL`, { targetId })
    .returning(['effectiveFrom'])
    .execute();

  const priorEffectiveFrom = closeResult.raw[0]?.effectiveFrom as Date | undefined;
  if (priorEffectiveFrom !== undefined && effectiveFrom <= priorEffectiveFrom) {
    throw new BadRequestException(
      "effectiveFrom must be strictly after the target's current open interval",
    );
  }
  ```
  `targetColumn` is one of exactly two literal column names (`'serviceId'` or `'addOnId'`), never user-supplied text — the interpolation is safe from injection because its only possible values are these two compile-time literals, not caller input; `targetId` itself is always passed as a bound parameter, never interpolated.
- **`unit`'s validity is enforced entirely by the GraphQL schema, not a redundant application-layer check.** `@Field(() => PricingUnit)` + `registerEnumType` makes an invalid enum value a GraphQL-layer coercion error before the resolver ever runs — the same reasoning this codebase already applies to `BookingStatus`/`JobStatus` input fields (neither has its own `assertValid` enum re-check). `PricingRulesService.createPricingRule`'s TypeScript signature (`unit?: PricingUnit`) makes an invalid value a compile error for any non-GraphQL caller.
- **Mutual exclusivity is checked once, at the very start of `createPricingRule`, before the existence check** — `command.serviceId` and `command.addOnId` are checked with `!=` `undefined` (not truthiness, so an explicitly-passed empty string is still treated as "provided" and caught by the existence check, not silently ignored): exactly one must be defined, or `BadRequestException`. This is deliberately not a `class-validator` cross-field decorator on `CreatePricingRuleInput` — this codebase has no existing precedent for one, and the spec itself attributes this check to the application layer (§4.7), not the GraphQL input layer.
- **`assertValid` is extended, not duplicated**: the existing `PricingRulesService.assertValid(rule: Pick<PricingRule, 'priceMinorUnits'>)` becomes `assertValid(command: Pick<CreatePricingRuleCommand, 'priceMinorUnits' | 'minimumChargeMinorUnits'>)`, adding: `minimumChargeMinorUnits`, when defined, must satisfy `Number.isInteger(x) && x >= 0`.
- **`resolveEffectivePricing`'s query is a `QueryBuilder`, not `findOneBy`**, because the interval predicate (`effectiveFrom <= asOf AND (effectiveTo IS NULL OR effectiveTo > asOf)`) is not expressible as a plain `FindOptionsWhere` object:
  ```ts
  async resolveEffectivePricing(
    target: { serviceId: string } | { addOnId: string },
    asOf: Date,
  ): Promise<PricingRule | null> {
    const qb = this.pricingRuleRepository.createQueryBuilder('rule');
    if ('serviceId' in target) {
      qb.where('rule."serviceId" = :targetId', { targetId: target.serviceId });
    } else {
      qb.where('rule."addOnId" = :targetId', { targetId: target.addOnId });
    }
    return qb
      .andWhere('rule."effectiveFrom" <= :asOf', { asOf })
      .andWhere('(rule."effectiveTo" IS NULL OR rule."effectiveTo" > :asOf)', { asOf })
      .getOne();
  }
  ```
- **`PricingRuleResolver.createPricingRule` requires no code change.** Its existing body (`const command: CreatePricingRuleCommand = { ...input, actorId: currentUser.id }`) already structurally forwards every new optional field on `CreatePricingRuleInput` into `CreatePricingRuleCommand` — the two shapes are extended in lockstep (§2), so the spread continues to work without modification. This task only touches the input/type/command/service files, not the resolver file itself; the resolver is re-verified by its existing and extended tests, not edited.
- **Migration is one file, `<timestamp>-ExtendPricingRuleEffectiveDating.ts`, in this exact statement order** (additive-then-backfill-then-constrain, so every intermediate state is valid):
  1. `ALTER TABLE "pricing_rule_entity" ALTER COLUMN "serviceId" DROP NOT NULL;`
  2. `ALTER TABLE "pricing_rule_entity" ADD COLUMN "addOnId" uuid;`
  3. `CREATE INDEX "IDX_pricing_rule_addon_id" ON "pricing_rule_entity" ("addOnId");`
  4. `ALTER TABLE "pricing_rule_entity" ADD CONSTRAINT "fk_pricing_rule_addon" FOREIGN KEY ("addOnId") REFERENCES "add_on_entity"("id") ON DELETE RESTRICT;`
  5. `CREATE TYPE "public"."pricing_rule_entity_unit_enum" AS ENUM('PER_KG', 'PER_ITEM', 'FLAT', 'PER_SERVICE');` (matching `booking_entity_status_enum`'s exact naming shape)
  6. `ALTER TABLE "pricing_rule_entity" ADD COLUMN "unit" "public"."pricing_rule_entity_unit_enum" NOT NULL DEFAULT 'PER_SERVICE';`
  7. `ALTER TABLE "pricing_rule_entity" ADD COLUMN "minimumChargeMinorUnits" integer;`
  8. `ALTER TABLE "pricing_rule_entity" ADD COLUMN "effectiveFrom" TIMESTAMP WITH TIME ZONE;`
  9. `UPDATE "pricing_rule_entity" SET "effectiveFrom" = "createdAt";`
  10. `ALTER TABLE "pricing_rule_entity" ALTER COLUMN "effectiveFrom" SET NOT NULL;`
  11. `ALTER TABLE "pricing_rule_entity" ADD COLUMN "effectiveTo" TIMESTAMP WITH TIME ZONE;`
  12. Backfill `effectiveTo` (per spec §4.8's `LEAD` reconstruction):
      ```sql
      UPDATE "pricing_rule_entity" AS p
      SET "effectiveTo" = sub."nextCreatedAt"
      FROM (
        SELECT "id", LEAD("createdAt") OVER (PARTITION BY "serviceId" ORDER BY "createdAt", "id") AS "nextCreatedAt"
        FROM "pricing_rule_entity"
      ) AS sub
      WHERE p."id" = sub."id"
      ```
  13. `ALTER TABLE "pricing_rule_entity" ADD CONSTRAINT "ck_pricing_rule_target" CHECK (num_nonnulls("serviceId", "addOnId") = 1);`
  14. `CREATE UNIQUE INDEX "uq_pricing_rule_open_service" ON "pricing_rule_entity" ("serviceId") WHERE "effectiveTo" IS NULL;`
  15. `CREATE UNIQUE INDEX "uq_pricing_rule_open_addon" ON "pricing_rule_entity" ("addOnId") WHERE "effectiveTo" IS NULL;`

  `down()` reverses in the opposite order (drop the two indexes and the CHECK constraint; drop `effectiveTo`; re-require `effectiveFrom` nullable then drop it; drop `minimumChargeMinorUnits`; drop the `unit` column then its enum type; drop the addon FK, its index, and the column; restore `serviceId` `NOT NULL`) — restoring `serviceId NOT NULL` in `down()` is only valid if no `addOnId`-targeted row exists yet, which is true for any environment where this migration is being rolled back before Task 2 ships real add-on pricing; this is the same "down() is a best-effort mirror, not guaranteed safe against arbitrary intervening data" caveat every prior migration in this codebase already carries implicitly.
- **Backfill correctness is verified two ways, not one**: the `LEAD(..., "id")` SQL pattern itself is exercised directly (Task 1's own test, against manually-seeded tied-timestamp rows — see §7/§8), separately from `resolveEffectivePricing`'s runtime correctness against freshly-created rows (Task 3/5's tests). This plan does not attempt to re-run the actual migration against a hand-seeded "pre-migration-shaped" database inside the Jest suite — no existing migration in this codebase has that kind of test, and inventing one now would be new test infrastructure beyond this ticket's scope.
- **No new environment variables or secrets.**

## 4. Ownership boundaries

| Owns (this slice) | Must remain untouched |
| --- | --- |
| `apps/api/src/modules/catalog/domain/pricing-rule.ts`, `pricing-unit.ts` (new) | `apps/api/src/modules/catalog/domain/service.ts`, `add-on.ts` |
| `apps/api/src/modules/catalog/infrastructure/persistence/pricing-rule.entity.ts` | `service.entity.ts`, `add-on.entity.ts` — neither gains an inverse relation to `PricingRuleEntity`; the FK direction is one-way, matching `serviceId`'s existing precedent |
| `apps/api/src/modules/catalog/application/commands/create-pricing-rule.command.ts`, `application/services/pricing-rules.service.ts` | `services.service.ts`, `add-ons.service.ts` |
| `apps/api/src/modules/catalog/presentation/graphql/create-pricing-rule.input.ts`, `pricing-rule.type.ts`, `mappers.ts` (only `toPricingRuleType`) | `pricing-rule.resolver.ts` (no code change — §3), `service.type.ts`, `add-on.type.ts`, `service.resolver.ts`, `add-on.resolver.ts`, `active-pricing.loader.ts`, `service-read.resolver.ts`, `add-on-read.resolver.ts` |
| `apps/api/src/platform/database/migrations/<new file>` | Every existing migration file — none is edited or regenerated |
| — | `apps/api/src/modules/bookings/**` (entirely untouched — `BookingsService.resolveAndValidate`/`getActivePricing` behavior is unmodified, spec §2/§7) |
| — | `apps/web/**` — no page or component in this ticket; `apps/web/app/app/catalog/page.tsx`'s existing `createPricingRule` call (serviceId-only) is a regression target, not a file to edit |
| `packages/client/src/generated/graphql.ts` (regenerated via `pnpm --filter client codegen`, mechanical) | `packages/client/src/operations/services.graphql` — no operation document changes; the existing `CreatePricingRule` operation doesn't select any new field and needs none |
| — | `apps/api/package.json`, `pnpm-lock.yaml` — no new dependency (§3) |

## 5. Contract inventory (only what the Accepted spec authorizes)

- `PricingRule { id, serviceId: string | null, addOnId: string | null, priceMinorUnits, unit: PricingUnit, effectiveFrom, effectiveTo: Date | null, minimumChargeMinorUnits: number | null, active, createdAt }` (`modules/catalog/domain`)
- `PricingRulesService.createPricingRule(command: CreatePricingRuleCommand): Promise<PricingRule>` — `CreatePricingRuleCommand { actorId, serviceId?, addOnId?, priceMinorUnits, unit?, effectiveFrom?, minimumChargeMinorUnits? }`
- `PricingRulesService.resolveEffectivePricing(target: { serviceId: string } | { addOnId: string }, asOf: Date): Promise<PricingRule | null>` — new; not exposed over GraphQL (spec §2, §4.6)
- `PricingRulesService.getActivePricing`, `getActivePricingForServiceIds` — unchanged signatures and behavior
- GraphQL: `CreatePricingRuleInput { serviceId?, addOnId?, priceMinorUnits, unit?, effectiveFrom?, minimumChargeMinorUnits? }`; `PricingRuleType { id, serviceId: ID (nullable), addOnId: ID (nullable), priceMinorUnits, createdAt }`; `createPricingRule(input): PricingRule!` mutation unchanged in shape at the operation level (spec §4.6, addendum). No other GraphQL operation changes.

Exact internal helper/private-method names beyond the above are implementation detail decided per-task below; the spec does not freeze them further and this plan does not either.

## 6. Slice sequence

```text
1. Schema: domain interface, entity, migration (additive + backfill)   (independent)
2. createPricingRule: rewrite (write path + validation)                (depends on 1)
3. resolveEffectivePricing (read path)                                 (depends on 1)
4. GraphQL surface: input/type/mapper extension                        (depends on 2)
5. E2E acceptance                                                      (depends on 1-4)
```

Tasks 2 and 3 have no dependency on each other (both depend only on Task 1's schema) and could be executed in either order or in parallel; this plan sequences 2 before 3 only to keep task numbering aligned with the spec's own section order (§4.4 before §4.3 in the plan's task list would be more confusing, not less). Task 4 depends specifically on Task 2 (it forwards `CreatePricingRuleCommand`'s new fields), not on Task 3.

## 7. TDD / verification strategy

Three test levels, matching every prior slice in this codebase:

1. **Mocked unit tests** (`pricing-rules.service.spec.ts`, mocked `Repository`/`DataSource`) for: mutual-exclusivity rejection (both or neither of `serviceId`/`addOnId` provided), `assertValid`'s new `minimumChargeMinorUnits` branch, and `resolveEffectivePricing`'s target-branching logic against a mocked query builder (asserting the correct `WHERE` target is used for each target shape). A mocked repository cannot prove a real constraint violation, a real backfill, or a real concurrent-transaction race — this level does not attempt any of those.
2. **Real-Postgres service-level tests** (extending `apps/api/test/catalog.service.e2e-spec.ts`'s existing `PricingRule`/`PricingRulesService` block) for: the schema-level invariants themselves (the `CHECK` constraint rejects a row with both or neither target populated, attempted directly via `manager.query()` raw SQL — not reachable through the service, since the service's own mutual-exclusivity check would intercept it first, but the *database* constraint must independently hold for any future caller that bypasses the service layer); the two new partial unique indexes; the backfill SQL pattern's determinism (seed two rows for the same service with an explicitly-set, identical `createdAt` via raw `manager.query()`, then run the exact `LEAD(..., "id")` `SELECT` from §3 directly and assert the ordering it produces is well-defined, not that the migration itself was re-run); `createPricingRule`'s full behavior for both target kinds (immediate vs. future scheduling, the close-and-insert sequence, forward-only rejection at and before the boundary, the concurrency race); `resolveEffectivePricing`'s correctness for past/current/future/boundary dates; and the existing repricing/rollback/audit tests from the Catalog plan (Task 3 there) re-run **unmodified** to prove regression-free behavior.
3. **Integration/e2e** (extending `apps/api/test/catalog.e2e-spec.ts`, GraphQL via Supertest against a real Postgres): `createPricingRule` mutation with `addOnId` returns `{ addOnId: <id>, serviceId: null }`; with `serviceId` returns `{ serviceId: <id>, addOnId: null }`; and the existing golden-path e2e (create service → attach pricing → list active catalog, from the Catalog plan) re-run **unmodified** to prove the GraphQL-level regression-free claim, not just the service level.

Level 2 continues using the existing `catalog-db-test-lock.ts` advisory lock and `beforeEach` truncation (`pricing_rule_entity`, `add_on_entity`, `service_entity`, in that FK-respecting order — unchanged from the Catalog plan, since no new table is added). Level 3 continues the existing unique-per-run fixture convention, no truncation, no lock.

No test-framework changes. `apps/api/src/modules/catalog/tests/catalog.module.di.spec.ts` needs no new coverage — `PricingRulesService`'s constructor signature and provider registration are unchanged by this plan.

### Self-check before handoff

| Check | Status |
| --- | --- |
| Every major task traces to Accepted specification | Yes — §2 above cites every SHALL to a spec section |
| No task introduces new product semantics | Yes — §3's decisions are mechanism-only; the one product-facing decision (`PricingRuleType` nullability) was resolved via the post-acceptance spec addendum, not invented here |
| Task ordering is executable without inventing missing work | Yes — Task 1 is a pure prerequisite; Tasks 2/3 are independent of each other; Task 4 depends only on Task 2 |
| Deferred work explicitly identified | Yes — §2's SHALL NOT list, carried from spec §7 |
| Missing design semantics → stopped and returned to M2/M3 | Yes — the `PricingRuleType` nullability gap was caught during this planning session and resolved as a post-acceptance spec addendum before this plan was drafted, not filled in silently here |

## 8. Task breakdown

### Task 1 — Schema: domain interface, entity, migration (additive + backfill)

**Files (new):**
- `apps/api/src/modules/catalog/domain/pricing-unit.ts` — `PricingUnit` enum (§3).

**Files (modified):**
- `apps/api/src/modules/catalog/domain/pricing-rule.ts` — add `addOnId: string | null`, `unit: PricingUnit`, `effectiveFrom: Date`, `effectiveTo: Date | null`, `minimumChargeMinorUnits: number | null`; change `serviceId: string` to `serviceId: string | null`. Update the file's header comment to state the mutual-exclusivity invariant and that `effectiveTo` is never client-settable (spec §4.2).
- `apps/api/src/modules/catalog/infrastructure/persistence/pricing-rule.entity.ts`:
  - `serviceId`: `@Column({ type: 'uuid', nullable: true }) @Index()` (was non-nullable).
  - `addOnId`: `@Column({ type: 'uuid', nullable: true }) @Index()` — plain column, no `@ManyToOne`, same no-relation-decorator precedent as `serviceId` (spec §4.1's inherited reasoning).
  - `unit`: `@Column({ type: 'enum', enum: PricingUnit, default: PricingUnit.PER_SERVICE })`.
  - `effectiveFrom`: `@Column({ type: 'timestamptz' })`.
  - `effectiveTo`: `@Column({ type: 'timestamptz', nullable: true })`.
  - `minimumChargeMinorUnits`: `@Column({ type: 'integer', nullable: true })`.
  - Update the file's header comment: the mutual-exclusivity `CHECK` and the two new partial unique indexes are hand-added migration SQL, not expressible in entity metadata — same category as the existing FK/partial-unique-index comment already there.
- `apps/api/src/platform/database/migrations/<generated-timestamp>-ExtendPricingRuleEffectiveDating.ts` — new migration, exact statement sequence per §3 above.

**Tests to write first (TDD) — level 2, extending `catalog.service.e2e-spec.ts`:**
- After migration, every pre-existing `PricingRule` row (created via `createPricingRule` in this same test, using **only** today's call shape — `serviceId` + `priceMinorUnits`, no new fields) has `unit: PricingUnit.PER_SERVICE`, `effectiveFrom` equal to its `createdAt`, `minimumChargeMinorUnits: null`, `addOnId: null`.
- Two `createPricingRule` calls in sequence for the same service (a repricing, today's shape only) — after backfill logic runs at the SQL level on this data (simulated by directly querying with the `LEAD(..., "id")` expression from §3, not by re-running the migration): the first (superseded) row's computed `effectiveTo` equals the second row's `createdAt`; the second (current) row's computed `effectiveTo` is `NULL`.
- **Backfill tie-breaker determinism:** insert two rows for the same `serviceId` directly via `manager.query()` with an identical, explicitly-set `createdAt` (bypassing `@CreateDateColumn`) and two different, known `id`s; running the exact `LEAD(..., "id")` `SELECT` from §3 against them deterministically orders the lower `id` as superseded first, every time (repeat the query 3× in the same test to rule out order-dependent flakiness).
- The `CHECK (num_nonnulls("serviceId", "addOnId") = 1)` constraint: a direct `manager.query()` `INSERT` with both `serviceId` and `addOnId` set (or both `NULL`) throws a Postgres constraint-violation error — proves the database-level invariant holds independently of the application-layer check that will be added in Task 2 (this task adds no application code that could intercept it first).
- `uq_pricing_rule_open_service`/`uq_pricing_rule_open_addon`: a direct `manager.query()` `INSERT` of a second row for the same `serviceId` (or `addOnId`) with `effectiveTo IS NULL` while one already exists throws a Postgres unique-violation error.
- Regression: every existing Task-1/2/3-level test from the Catalog plan for `Service`/`AddOn`/`PricingRule` continues to pass **unmodified** — this task changes no application code, only schema, so this is the direct proof that the migration alone is behavior-preserving.

**Traceability:** spec §4.1, §4.2, §4.7, §4.8.

### Task 2 — `createPricingRule`: rewrite (write path + validation)

**Files (modified):**
- `apps/api/src/modules/catalog/application/commands/create-pricing-rule.command.ts` — `serviceId`/`addOnId` become optional; add `unit?: PricingUnit`, `effectiveFrom?: Date`, `minimumChargeMinorUnits?: number`.
- `apps/api/src/modules/catalog/application/services/pricing-rules.service.ts` — `createPricingRule` rewritten per §3's code shape and spec §4.4's six-step sequence: mutual-exclusivity + existence check (whichever of `Service`/`AddOn` is targeted), `assertValid` (extended, §3), the `UPDATE ... RETURNING` close-and-read with forward-only validation, the `serviceId`-only active-flag branch (immediate vs. future), the single `INSERT` with every column set together, the one audit event. `POSTGRES_UNIQUE_VIOLATION`'s `try/catch` around the insert is unchanged in mechanism, now catching either partial-unique-index's violation.

**Tests to write first (TDD) — level 1, `pricing-rules.service.spec.ts` (mocked):**
- `createPricingRule` with both `serviceId` and `addOnId` set: `BadRequestException`, no repository call attempted.
- `createPricingRule` with neither set: `BadRequestException`, no repository call attempted.
- `assertValid` (via `createPricingRule` with a mocked repository): `minimumChargeMinorUnits` of `-1`/non-integer throws `BadRequestException` before any write; `minimumChargeMinorUnits: 0` does not throw.
- Existing `createPricingRule`/`getActivePricing` mocked tests from the Catalog plan continue to pass unmodified with today's call shape (`serviceId` + `priceMinorUnits` only).

**Tests to write first (TDD) — level 2, extending `catalog.service.e2e-spec.ts`:**
- **Immediate, `serviceId`-targeted (today's shape, no new fields):** identical observable behavior to the pre-Task-2 code — active flips, exactly one active row, `effectiveTo` of the previous row is now non-null and equal to the new row's `effectiveFrom`, `effectiveFrom` of the new row equals `operationNow` (asserted via a tight time-window check, not exact-equality against a separately-captured `Date.now()`), `effectiveTo` of the new row is `null`.
- **Future-scheduled, `serviceId`-targeted:** `effectiveFrom` in the future → the new row is inserted with `active: false`; the previously-active row's `active` remains `true` and unchanged; `getActivePricing` still returns the old row; querying the table directly confirms the old row's `effectiveTo` is now the new row's `effectiveFrom` (the date chain closed correctly even though `active` did not move).
- **`addOnId`-targeted (first-ever rule for that add-on):** inserted with `active: false` regardless of `effectiveFrom`; `serviceId` is `null`, `addOnId` matches.
- **Forward-only rejection:** given an open interval with `effectiveFrom = T`, a second call with `effectiveFrom = T` (equal) and one with `effectiveFrom < T` both throw `BadRequestException`; the open interval's `effectiveTo` is confirmed unchanged (still `null`) afterward — proving the rejected call's close attempt was rolled back, not partially applied.
- **Valid forward extension, adjacent boundary:** a second call with `effectiveFrom` strictly after the open interval's `effectiveFrom` succeeds; the first interval's `effectiveTo` now exactly equals the second interval's `effectiveFrom`.
- **Concurrency race (both target kinds, matching the Catalog plan's existing concurrency-test precedent):** `Promise.allSettled([svc.createPricingRule(cmdA), svc.createPricingRule(cmdB)])` for the same `serviceId` (and, as a second case, the same `addOnId`) with two different valid future `effectiveFrom` values — exactly one fulfilled, one rejected with `ConflictException`; exactly one row has `effectiveTo IS NULL` for that target afterward.
- With `auditLogger.log` mocked to reject on a forward-extension call, the transaction rolls back entirely — the previously-open row's `effectiveTo` is confirmed still `null` afterward (rollback proof covering the close step, not just the insert — extends the Catalog plan's existing rollback-proof pattern to this new step).

**Traceability:** spec §4.2, §4.4, §4.7.

### Task 3 — `resolveEffectivePricing` (read path)

**Files (modified):**
- `apps/api/src/modules/catalog/application/services/pricing-rules.service.ts` — add `resolveEffectivePricing` per §3's code shape.

**Tests to write first (TDD) — level 1, `pricing-rules.service.spec.ts` (mocked query builder):**
- Given a `{ serviceId }` target, the query builder's `.where()` is called with the `serviceId`-scoped condition, not the `addOnId`-scoped one (and vice versa for `{ addOnId }`).

**Tests to write first (TDD) — level 2, extending `catalog.service.e2e-spec.ts`:**
- Given two chained intervals for the same service (`A: [T1, T2)`, `B: [T2, null)`, created via Task 2's `createPricingRule`): `resolveEffectivePricing({ serviceId }, T1)` → `A`; `resolveEffectivePricing({ serviceId }, T1.5)` → `A`; `resolveEffectivePricing({ serviceId }, T2)` → `B` (the half-open-boundary case — proves `>=`/`<` semantics land on the correct side, not merely "some value near the boundary works"); `resolveEffectivePricing({ serviceId }, someDateBeforeT1)` → `null`.
- Same shape repeated for an `addOnId` target, confirming the method is target-kind-agnostic in behavior, not merely in type signature.
- A target that has never had a `PricingRule` created → `null` (no existence check, unlike `getActivePricing` — spec §4.3 deliberately omits one; confirm no `NotFoundException` is thrown for a syntactically valid but never-priced id).
- `resolveEffectivePricing` against a `Service`/`AddOn` with `active: false` (catalog-retired) still resolves normally — confirms the method does not check catalog retirement status (spec §4.3).

**Traceability:** spec §4.3.

### Task 4 — GraphQL surface: input/type/mapper extension

**Files (modified):**
- `apps/api/src/modules/catalog/presentation/graphql/create-pricing-rule.input.ts` — `serviceId`/`addOnId` both `@Field(() => ID, { nullable: true }) @IsOptional() @IsString()`; add `unit?: PricingUnit` (`@Field(() => PricingUnit, { nullable: true }) @IsOptional() @IsEnum(PricingUnit)`, plus the `registerEnumType` call, §3); `effectiveFrom?: Date` (`@Field({ nullable: true }) @IsOptional() @IsDate()`, matching `CreateBookingInput.scheduledAt`'s bare-`@Field()` Date-scalar convention); `minimumChargeMinorUnits?: number` (`@Field(() => Int, { nullable: true }) @IsOptional() @IsInt() @Min(0)`). `priceMinorUnits` unchanged. No `effectiveTo` field (spec §4.6).
- `apps/api/src/modules/catalog/presentation/graphql/pricing-rule.type.ts` — `serviceId` becomes `@Field(() => ID, { nullable: true }) serviceId!: string | null;`; add `addOnId!: string | null` with the same nullable `ID` field. Update the file's header comment: the mutual-exclusivity invariant now lives on the GraphQL type too, mirroring the domain object (spec §4.6 addendum).
- `apps/api/src/modules/catalog/presentation/graphql/mappers.ts` — `toPricingRuleType` maps `addOnId: rule.addOnId` alongside the existing `serviceId: rule.serviceId` (now potentially `null`, which the mapper passes through unchanged — no new branching needed since both are plain pass-through fields).

**Files (regenerated, not hand-edited):**
- `packages/client/src/generated/graphql.ts` — via `pnpm --filter client codegen`, picking up the extended `CreatePricingRuleInput`/`PricingRuleType` schema shapes. No operation document (`services.graphql`) change — the existing `CreatePricingRule` operation selects `id`/`priceMinorUnits` only and needs neither new field.

**Tests to write first (TDD) — level 1, extending `pricing-rule.resolver.spec.ts`:**
- `createPricingRule` resolver: given an `input` containing `addOnId` (no `serviceId`), the constructed `CreatePricingRuleCommand` passed to the (mocked) service carries `addOnId` and `serviceId: undefined` — proves the existing `{ ...input, actorId }` spread genuinely requires no resolver code change (§3), rather than merely asserting the file is unedited.

**Tests to write first (TDD) — level 3, extending `catalog.e2e-spec.ts`:**
- `createPricingRule` mutation called with `input: { addOnId, priceMinorUnits, unit: PER_ITEM }` (no `serviceId`) returns `{ serviceId: null, addOnId: <id> }` over the real GraphQL endpoint.
- `createPricingRule` mutation called with today's shape (`input: { serviceId, priceMinorUnits }`, no new fields) returns `{ serviceId: <id>, addOnId: null }` — the explicit regression proof at the GraphQL layer, not just the service layer, that adding `addOnId` to the schema didn't change the existing shape's observable response.
- The existing golden-path e2e (create service → attach pricing → list active catalog, from the Catalog plan) re-run **unmodified** and still green.

**Traceability:** spec §4.6 (including its post-acceptance addendum).

### Task 5 — E2E acceptance

No new production files. This task closes the acceptance-criteria loop with cross-cutting tests that don't belong to any single prior task, and re-confirms the full regression surface once all four preceding tasks are integrated.

**Files (modified):**
- `apps/api/test/catalog.service.e2e-spec.ts` — add a dedicated `describe('effective-dated pricing — cross-cutting', ...)` block (does not duplicate any assertion already covered in Tasks 1–3's own test lists):
  - **Full scenario, `serviceId`:** create an immediate rule (`R1`), a future-scheduled rule (`R2`, `effectiveFrom` = 30 days out). Assert simultaneously: `getActivePricing` → `R1` (legacy path unaffected); `resolveEffectivePricing(now)` → `R1`; `resolveEffectivePricing(30 days out)` → `R2`; `resolveEffectivePricing(29 days out)` → `R1` (still — the boundary hasn't arrived yet).
  - **Full scenario, `addOnId`:** create an add-on, price it, confirm `active: false` always, `resolveEffectivePricing` resolves it correctly, and `getActivePricing` is never called against an `addOnId` (not applicable — this test documents that boundary, it doesn't call the method with the wrong argument type, which wouldn't compile).
  - **Regression, exhaustive:** every level-2 test from the Catalog plan's original Task 3 (`PricingRule`/`PricingRulesService`) — deactivate-then-insert, the original concurrency test, `getActivePricing`'s `NotFoundException`/`null` cases — re-run **unmodified** in this same file and confirmed still green, as the single point-in-time proof that this entire ticket's changes are additive.
- `apps/api/test/catalog.e2e-spec.ts` — a full mutation-to-query round trip: `createPricingRule` with `addOnId` + `unit: PER_KG` + a future `effectiveFrom`, followed by a direct service-layer `resolveEffectivePricing` call (via `app.get(PricingRulesService)`, the same `AppModule`-resolution technique the Catalog plan's N+1 test uses) confirming the created row resolves correctly through the full DI graph, not just a directly-instantiated service.

**Traceability:** spec §4.3, §4.4, §6 (acceptance criteria), Ticket #36's own "Tests expected" section (effective-date resolution boundary/past/current/future dates; overlapping/invalid range rejection; regression; concurrency race).
