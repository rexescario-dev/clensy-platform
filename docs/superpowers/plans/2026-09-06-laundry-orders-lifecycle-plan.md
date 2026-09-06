# Laundry Orders & Operational Lifecycle: Implementation Plan

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Date** | 2026-09-06 |
| **Tracking** | [#37](https://github.com/rexescario-dev/clensy-platform/issues/37) — milestone M11 (Laundry Orders & Lifecycle) |
| **Revision note** | M5 round 1 (reviewer: project owner) returned the Draft for four required plan-level tightenings plus five recommended ones — no semantic redesign, no return to M2/M3. Required: (1) line ownership made explicit — `receive` creates a lineless order, `price` is the only operation that creates lines, snapshotting them in its transaction (§2 "Line ownership", Task 10); (2) `receive`'s full transaction boundary spelled out — customer validation before the transaction, create + audit inside it (Task 10); (3) `price`'s exact create-lines-then-price-then-persist sequence written as nine ordered steps (Task 10); (4) an evidence-based Slice 0 baseline preflight added so every "pre-existing / unrelated" closeout claim cites a recorded run, not #36's handoff (Slice 0, Task 0, §6). Recommended, all applied: transaction/audit atomicity + "loser emits no audit event" stated as an invariant (§2); the `transition()` helper contract fixed to the locked row only, no re-read, no caller `currentStatus` (§2, Task 10); a hand-added `CHECK ("weightGrams" IS NULL OR >= 0)` plus `pg_constraint`/`pg_type` introspection verification (§3, Task 8, §6 Slice B); a direct no-re-pricing / snapshot-column-immutability e2e (§6 Slice E, Task 19); Task 12 now requires reading `modules/jobs`'s actual nested-connection code rather than approximating it; the concurrency test wording clarified that the loser fails on the **application** state-machine after re-reading the committed row, not on a Postgres lock error (§6 Slice E); web role-gating clarified as hide-only with the server authoritative (§2, Task 22). |
| **M5 decision** | **Accepted** — 2026-09-06. Round 1's four required tightenings and five recommended ones verified present in §2, §3, §5, §6, and the Task 10 breakdown — not merely asserted. Round 2 (same reviewer) applied two final wording determinisms, no redesign: (a) `price`'s step 8 now unambiguously requires `policy.assertTransition(order.status, PRICED)` *immediately adjacent to* the `manager.update` that writes `status` + `totalMinorUnits`, with step 2 explicitly re-labelled a precondition guard rather than the load-bearing assertion — the §2 "assert immediately before the write" invariant is now literally true for `price`; (b) the §2 atomicity statement reconciled with `receive`'s documented pre-check ("transactional work commits/rolls back as one unit; a command MAY do explicitly documented read-only pre-checks before the transaction, never relied on for write-time integrity"). No missing design semantics. Slice sequence executable without inventing work. Ready for **M6 Implementation**, starting Slice 0 (baseline) then Slice A. |
| **Package/repo scope** | `apps/api` (new: `src/modules/laundry/**`, one `src/platform/database/migrations/*` file; modified: `src/platform/database/data-source.ts`, `src/app/app.module.ts`, `test/paginated-collections-allowlist.e2e-spec.ts`, new `test/laundry*.e2e-spec.ts`); `packages/client` (new operation docs under `src/operations/`, regenerated `src/generated/graphql.ts`); `apps/web` (new `app/app/laundry/page.tsx`, modified `components/app-shell/sidebar.tsx`, new page smoke test) |
| **Depends on (Accepted)** | [Laundry Orders & Operational Lifecycle Specification](../specs/2026-09-06-laundry-orders-lifecycle-design.md) — Status: **Accepted**, 2026-09-06 (including its M3 decision row on §4.5 step 3a). Relies by reference on the Accepted [#36 Catalog Foundation](../specs/2026-09-06-laundry-catalog-foundation-design.md) for `resolveEffectivePricing`, `PricingUnit`, and the integer money/weight conventions; the Accepted [Bookings](../specs/2026-08-22-bookings-design.md) spec for the `BookingPricingSnapshotEmbeddable` embedded-value pattern; the Accepted [Jobs](../specs/2026-08-27-jobs-checklists-design.md) spec for the `dataSource.transaction` + `runAuditInTransaction` pattern, the `ReadResolver`/separate-mutation-`@Resolver` split, and the nested-offset-connection shape; the Accepted [Paginated Collections](../specs/2026-08-28-paginated-graphql-collections-design.md) spec for the allowlist regression pattern. None of those is redesigned here. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M4 |

Where this plan and the Accepted specification disagree, the specification wins and this plan must be revised.

## 1. Delivery intent

Implement exactly what the Accepted spec authorizes: a new `modules/laundry` with the `LaundryOrder`/`LaundryOrderLine` aggregate (spec §4.2), the 15-state `LaundryOrderStatusTransitionPolicy` and its complete transition matrix (spec §4.3), the pure `computeLaundryLineAmount` pricing function with a named integer-safe half-up helper (spec §4.5), `LaundryOrdersService` with one command per verb operation routing every status change through the policy inside a `dataSource.transaction` + `runAuditInTransaction` with a pessimistic row lock (spec §4.4, §4.6), the TypeORM entities + one additive migration (spec §4.10), the GraphQL read/mutation surface following the platform pagination/connection contract (spec §4.7), and the `/app/laundry` web page built from existing `packages/ui` primitives (spec §4.9). No Invoice/Payment/Promotion/Delivery/Loyalty; no generic `transitionLaundryOrderStatus` on the schema; no REST surface; no change to any existing module's contract.

## 2. Constraints (SHALL / SHALL NOT)

**SHALL** (traced to spec section):

- `LaundryOrder` is customer-only: `customerId` required, FK → `customer_entity` `ON DELETE RESTRICT`, immutable; **no `propertyId`**; no FK/id column for Invoice/Payment/Promotion/Delivery/Loyalty (spec §2, §4.2).
- `LaundryOrder` carries `fulfillmentType: PICKUP | DELIVERY` (set at intake, immutable), `status` (Postgres enum, default `RECEIVED`), `weightGrams: integer | null` (non-negative; `null` only while `RECEIVED`; locked once `PRICED`), `totalMinorUnits: integer | null` (frozen at `PRICED`), `createdAt`/`updatedAt` (spec §4.2).
- `LaundryOrderLine` carries exactly one of `serviceId`/`addOnId` (DB `CHECK (num_nonnulls("serviceId","addOnId") = 1)` + application pre-check), FKs `ON DELETE RESTRICT`, plus the embedded snapshot; `laundryOrderId` FK `ON DELETE CASCADE` (spec §4.2, §4.8).
- The embedded `LaundryOrderLinePricingSnapshot` has exactly seven fields — `rateMinorUnits` (int), `unit` (`PricingUnit`), `quantity` (int), `amountMinorUnits` (int), `minimumChargeMinorUnits` (int | null), `minimumChargeApplied` (bool), `pricingRuleId` (uuid | null, **no FK**) — persisted as an embeddable with `@Column(() => …, { prefix: false })` and explicit `pricingSnapshot…`-prefixed column names (spec §4.2, §4.5).
- All money is integer minor units; weight is integer grams; **no floating-point column** in either table (spec §4.2).
- `LaundryOrderStatus` has the 15 values listed in spec §4.3; `LaundryFulfillmentType` has `PICKUP`, `DELIVERY`.
- `LaundryOrderStatusTransitionPolicy` is a literal encoding of the spec §4.3 matrix — `canTransition(from,to): boolean`, `assertTransition(from,to): void` (throws `BadRequestException`). Every one of the 15 statuses is a key; `CANCELLED`/`REJECTED`/`REFUNDED` → `∅`, `COMPLETED`/`LOST`/`DAMAGED` → `{REFUNDED}` (spec §4.3).
- **Every code path that changes `LaundryOrder.status` calls `assertTransition(currentStatus, targetStatus)` immediately before the write, on the status read inside the same transaction.** State-preserving operations (a re-weigh of a `WEIGHED` order) do not change `status` and do not consult the policy (spec §3, §4.3, §4.4).
- The public GraphQL schema exposes **no** generic `transitionLaundryOrderStatus`; it exposes the 15 verb mutations in spec §4.4, each with its own `@Roles(...)`, its own `laundry_order.<verb>` audit action, and its own extra precondition (spec §4.4). The generic policy call is a private `LaundryOrdersService` helper only.
- `cancelLaundryOrder` is legal from `{RECEIVED, WEIGHED, PRICED, AWAITING_PAYMENT}` only — **not** from `PAID` (spec §4.3 n.5, §4.4).
- `priceLaundryOrder` captures one `asOf = new Date()`, resolves each line's price via `PricingRulesService.resolveEffectivePricing({serviceId|addOnId}, asOf)` (fail → `BadRequestException`, full rollback), applies the spec §4.5 step 3a quantity-resolution rule (keyed on the *resolved* `PricingRule.unit`), computes each line via `computeLaundryLineAmount`, freezes all seven snapshot fields, sets `totalMinorUnits = Σ amountMinorUnits`, and transitions `WEIGHED → PRICED` — all in one transaction, exactly once per order (spec §4.5).
- `computeLaundryLineAmount({ unit, rateMinorUnits, quantity, minimumChargeMinorUnits })` → `{ amountMinorUnits, minimumChargeApplied }`: `raw` = `divideRoundHalfUp(quantity * rateMinorUnits, 1000)` for `PER_KG` (quantity is grams), `quantity * rateMinorUnits` for `PER_ITEM`, `rateMinorUnits` for `FLAT`/`PER_SERVICE`; `floor = minimumChargeMinorUnits ?? 0`; `amountMinorUnits = Math.max(raw, floor)`; `minimumChargeApplied = raw < floor`. `divideRoundHalfUp` is a named, unit-tested integer-safe helper — not `Math.round` inline (spec §4.5).
- The snapshot `quantity` is always the canonical value used in the calculation — `order.weightGrams` for `PER_KG` (grams, never `/1000`), the caller's `baseQuantity`/add-on `quantity` for `PER_ITEM`, `1` for `FLAT`/`PER_SERVICE`; a supplied quantity on a non-`PER_ITEM` line is silently ignored, not rejected (spec §4.5 step 3a).
- Every mutation runs inside `dataSource.transaction((manager) => runAuditInTransaction(manager, …))`, re-reads the order with `lock: { mode: 'pessimistic_write' }` before the precondition/assert/write, and emits its audit event (`entityType: 'laundry_order'`, `entityId`: the order id) inside the transaction (spec §4.6).
- GraphQL reads follow the platform contract: `laundryOrders` root offset Connection (`{ nodes, pageInfo, totalCount }`, `paging` default `{ limit: 20 }`, max 100, default sort `createdAt DESC, id ASC`); `laundryOrder(id)` single nullable query (the `job` precedent); `LaundryOrder.lines` nested offset Connection (`{ nodes, pageInfo }`, no `totalCount`, default sort `createdAt ASC, id ASC`) (spec §4.7).
- `paginated-collections-allowlist.e2e-spec.ts` gains a `ROOT_CONNECTIONS` row and a `NESTED_CONNECTIONS` row for laundry, and the generated-CRUD / generic-mutation-name assertions still pass (spec §4.7).
- Per-mutation RBAC is the spec §4.4 table (Accepted as proposed); reads use the six-role `VIEW_ROLES` set.
- One additive migration creates only laundry-owned objects; it does **not** touch `pricing_rule_entity_unit_enum` or any catalog object; `down()` order is `laundry_order_line_entity` → `laundry_order_entity` → `laundry_order_line_unit_enum` → `laundry_fulfillment_type_enum` → `laundry_order_status_enum` (spec §4.10).
- The snapshot `unit` column uses a **module-local** `laundry_order_line_unit_enum` (same four `PricingUnit` values) — not catalog's enum (spec §4.10, §5).
- **Line ownership.** `receiveLaundryOrder` creates a `LaundryOrder` with **zero** `LaundryOrderLine` rows. The base-service line and every add-on line are created **only** by `priceLaundryOrder`, together with their frozen snapshots, in that command's single transaction (spec §4.5: "`priceLaundryOrder` … is the only operation that creates lines"). There is no separate line-add/line-select operation; lines never exist in an unpriced state.
- **Transaction / audit atomicity.** Every command's **transactional work** — the order create-or-update, the line inserts (for `price`), and the audit event — commits or rolls back as one unit. Any exception raised before commit rolls back the status/line write **and** its audit event. A concurrent transition that loses the race and is rejected by the policy emits **no** audit event and leaves no partial write. A command MAY perform an explicitly documented **read-only pre-check** before it opens the transaction (only `receive`'s `CustomersService.getCustomer` does, for a clean `NotFoundException`); such pre-checks are never relied on for write-time integrity — the database FK is (spec §4.1).
- **`transition()` helper contract.** The private status-change helper has signature `transition(manager, lockedOrder, target, action, actorId)`. It MUST NOT re-read the order's status and MUST NOT accept a caller-supplied `currentStatus` — it asserts `policy.assertTransition(lockedOrder.status, target)` against the status of the row that was just read under the pessimistic write lock in the same transaction, then `manager.update` + audit. `lockedOrder` is always the result of the in-transaction `findOne(..., { lock: { mode: 'pessimistic_write' } })`, never an entity loaded earlier.
- `/app/laundry` is one route built only from existing `packages/ui` primitives + the `/app/*` shell; the action set offered is `matrix-legal ∩ fulfillmentType branch ∩ actor-role`, **presentation-only** — role-gating only *hides* buttons, and the server independently authorizes and re-checks every mutation (spec §4.9).

**SHALL NOT** (explicit spec non-goals — do not invent):

- No `Invoice`/`InvoiceLine`/`Payment`/`Promotion`/`Delivery`/`Loyalty` entity, service, GraphQL surface, or foreign key (spec §2, §7).
- No item/tag/bag-level garment tracking (spec §2, §7).
- No generic `transitionLaundryOrderStatus` mutation on the public schema; no REST controller for laundry (spec §2, §7).
- No `propertyId` on `LaundryOrder` (spec §2, §5).
- No FK from `LaundryOrderLine` to `pricing_rule_entity` — `pricingRuleId` is a plain nullable `uuid` column (spec §4.2, §4.8, §7).
- No re-pricing, snapshot mutation, or post-`PRICED` recomputation of a line/weight/total (spec §2, §4.5, §7).
- No change to `Booking`/`Job`/`PricingRule` contracts, `getActivePricing`, the legacy `active` path, `resolveEffectivePricing`'s signature, or `pricing_rule_entity_unit_enum` (spec §2, §7).
- No `AWAITING_PAYMENT → PROCESSING` edge, no `PAID → CANCELLED` edge, no `PROCESSING → CANCELLED` edge, no direct `READY → COMPLETED` edge (spec §4.3, §7).
- No multi-currency, tiered/banded pricing, scheduled-pricing promotion, or laundry-vs-cleaning catalog flag (spec §2, §7).
- No new npm dependency; no `btree_gist`/GiST exclusion constraint (pessimistic lock is the concurrency mechanism — spec §4.6).
- No seeder for `modules/laundry` in this ticket (no spec requirement; e2e and web flows create their own data via mutations).

## 3. Implementation decisions (M4 choices — non-normative)

The spec fixes behavior; these are mechanism details it leaves to implementation:

- **File layout** mirrors `modules/jobs`:
  - `domain/laundry-order-status.ts`, `domain/laundry-fulfillment-type.ts` (enums, file-per-enum precedent), `domain/laundry-order.ts`, `domain/laundry-order-line.ts`, `domain/laundry-order-line-pricing-snapshot.ts` (interfaces), `domain/laundry-order-status-transition-policy.ts` (the matrix + `canTransition`/`assertTransition`; a plain class, no framework), `domain/laundry-line-pricing.ts` (`computeLaundryLineAmount` + `divideRoundHalfUp`, pure functions).
  - `application/commands/*.command.ts` (one interface per verb; `ReceiveLaundryOrderCommand`, `WeighLaundryOrderCommand`, `PriceLaundryOrderCommand`, and a shared `LaundryOrderTransitionCommand { actorId; orderId }` reused by the payload-free verbs), `application/services/laundry-orders.service.ts`.
  - `infrastructure/persistence/laundry-order.entity.ts`, `laundry-order-line.entity.ts`, `laundry-order-line-pricing-snapshot.embeddable.ts`.
  - `presentation/graphql/laundry-order.type.ts`, `laundry-order-line.type.ts`, `laundry-order-line-pricing-snapshot.type.ts`, `*.input.ts`, `laundry-order-read.resolver.ts`, `laundry-order.resolver.ts` (mutations + the custom `laundryOrder` nullable query), `laundry-order-relation.loaders.ts` (customer DataLoader), `mappers.ts`.
  - `laundry.module.ts`; `tests/**` mirroring `modules/jobs/tests/**` (`application/`, `graphql/`, `laundry.module.di.spec.ts`).
- **The transition matrix** is a `ReadonlyMap<LaundryOrderStatus, ReadonlySet<LaundryOrderStatus>>` (or `Record`), built once as a module constant. `assertTransition` throws `BadRequestException(\`Laundry order cannot transition from ${from} to ${to}\`)`. A table-driven test iterates all 15×15 ordered pairs against a second, independently hand-written copy of the matrix in the test file (so a typo in the source matrix cannot silently pass).
- **`divideRoundHalfUp(numerator, denominator)`**: `Math.floor((numerator + Math.floor(denominator / 2)) / denominator)` for non-negative integer inputs — asserts inputs are non-negative integers, has its own unit tests for exact-half, just-below-half, just-above-half.
- **`registerEnumType(LaundryOrderStatus, { name: 'LaundryOrderStatus' })`** and `registerEnumType(LaundryFulfillmentType, …)` are called once each in `laundry-order.type.ts` (first GraphQL use), mirroring `cleaning-job.type.ts`.
- **The single-order query** is a custom `@Query(() => LaundryOrderType, { name: 'laundryOrder', nullable: true })` on `LaundryOrderResolver` with `one: { disabled: true }` on the `ReadResolver` — the exact `JobResolver.job` / `JobReadResolver` split (spec §4.7 asks for the nullable `job` precedent, which the `ReadResolver` `one` default does not give).
- **The pessimistic lock** is `manager.findOne(LaundryOrderEntity, { where: { id }, lock: { mode: 'pessimistic_write' } })` inside the transaction; `NotFoundException` if absent. `manager.update(LaundryOrderEntity, { id }, { status, updatedAt: new Date(), …})` for the write, then `manager.findOneByOrFail` for the return value (the `JobsService` shape).
- **`LaundryOrderType` fields:** `id`, `customerId`, `customer` (resolve-field via DataLoader → `CustomerType`), `fulfillmentType`, `status`, `weightGrams`, `totalMinorUnits`, `createdAt`, `updatedAt`, `lines` (nested connection). `LaundryOrderLineType`: `id`, `serviceId`, `addOnId`, `pricingSnapshot`, `createdAt` (service/add-on name resolution in the web layer via existing `services`/`addOns` queries — no new resolve-field required by the spec; a `service`/`addOn` resolve-field MAY be added if trivial, else deferred).
- **Migration filename**: `apps/api/src/platform/database/migrations/<epoch-ms>-CreateLaundryOrders.ts`, timestamp greater than `1788630872126` (#36's).
- **DB-level structural CHECKs (defense-in-depth, non-normative mechanism for spec-required invariants).** In addition to the mandated line-target `CHECK (num_nonnulls("serviceId","addOnId") = 1)` (spec §4.8), the migration hand-adds `CHECK ("weightGrams" IS NULL OR "weightGrams" >= 0)` on `laundry_order_entity` — the spec (§4.2, §4.8) requires `weightGrams` to be a non-negative integer and enforces it in the application; this CHECK is a cheap backstop in the same style as #36's hand-added constraints, not a new product rule. Integer-ness is already guaranteed by the `integer` column type. No CHECK is added for the `weightGrams`-null-only-while-`RECEIVED` or the `totalMinorUnits`-null-until-`PRICED` rules — those are lifecycle invariants the application owns, not structural ones.
- **`data-source.ts`** `entities: [...]` gains `LaundryOrderEntity`, `LaundryOrderLineEntity` (runtime uses `autoLoadEntities: true`, so `TypeOrmModule.forFeature` in `LaundryModule` covers the app; the explicit list is only for the migration CLI's DataSource).
- **`LaundryModule`** imports `TypeOrmModule.forFeature([LaundryOrderEntity, LaundryOrderLineEntity])`, `NestjsQueryTypeOrmModule.forFeature([...])`, `NestjsQueryGraphQLModule.forFeature({ dtos: [...] })`, `AuditModule`, `CustomersModule`, `CatalogModule`; providers: the two resolvers, `LaundryOrdersService`, `LaundryOrderStatusTransitionPolicy`, `LaundryOrderRelationLoaders`; exports: `LaundryOrdersService`. **The exact nestjs-query registration for the nested `LaundryOrder.lines` connection is taken by reading `modules/jobs`'s actual code, not approximated** — specifically `modules/jobs/presentation/graphql/checklist.type.ts` (how `Checklist.items` is declared as a nested offset connection: the relation decorator, `PagingStrategies.OFFSET`, the `QueryOptions`) and `modules/jobs/jobs.module.ts` (whether the child entity/DTO — `ChecklistItemEntity`/`ChecklistItemType` — must appear in `NestjsQueryTypeOrmModule.forFeature` / the `dtos` array for the nested connection to resolve). Replicate that for `LaundryOrderLineEntity`/`LaundryOrderLineType`. The allowlist test (Task 18) is the backstop, but the registration is derived from the real precedent first. Registered in `app.module.ts` `imports`.
- **`packages/client`** operation docs: `src/operations/laundry.graphql` (queries `LaundryOrders`, `LaundryOrder`; the 15 mutations). Regenerate with `pnpm --filter @clensy/client codegen` after `apps/api` emits `src/schema.gql`.

## 4. Contract inventory

| Surface | Spec § | Slice |
| --- | --- | --- |
| `LaundryOrderStatus`, `LaundryFulfillmentType` enums | §4.3 | A |
| `LaundryOrder`, `LaundryOrderLine`, `LaundryOrderLinePricingSnapshot` domain interfaces | §4.2 | A |
| `LaundryOrderStatusTransitionPolicy` (`canTransition`, `assertTransition`) + matrix | §4.3 | A |
| `computeLaundryLineAmount`, `divideRoundHalfUp` | §4.5 | A |
| `LaundryOrderEntity`, `LaundryOrderLineEntity`, `LaundryOrderLinePricingSnapshotEmbeddable` | §4.2 | B |
| `CreateLaundryOrders` migration (3 enums, 2 tables, CHECK, indexes) | §4.10 | B |
| `data-source.ts` entities registration | §4.10 | B |
| `LaundryOrdersService` + verb commands (`receive`, `weigh`, `price`, 12 transition verbs) | §4.4, §4.5, §4.6 | C |
| `LaundryModule` (application wiring) | §4.1 | C |
| `LaundryOrderType`, `LaundryOrderLineType`, `LaundryOrderLinePricingSnapshotType` + `registerEnumType` | §4.7 | D |
| `ReceiveLaundryOrderInput`, `WeighLaundryOrderInput`, `PriceLaundryOrderInput`, `LaundryOrderAddOnInput`, `LaundryOrderRefInput` | §4.7 | D |
| `LaundryOrderReadResolver` (root connection, nested `lines` connection) | §4.7 | D |
| `LaundryOrderResolver` (15 verb mutations + custom `laundryOrder` query) | §4.4, §4.7 | D |
| customer DataLoader resolve-field | §4.7 | D |
| `app.module.ts` registration; `laundry.module.di.spec.ts` | §4.1 | D |
| `paginated-collections-allowlist.e2e-spec.ts` rows | §4.7 | D |
| `packages/client` operation docs + regenerated types | §4.9 | F |
| `apps/web/app/app/laundry/page.tsx` (list, intake, detail, actions) | §4.9 | F |
| sidebar nav entry | §4.9 | F |

Deferred (named, not built): `service`/`addOn` resolve-fields on `LaundryOrderLineType` if non-trivial; any laundry seeder; everything in spec §7.

## 5. Slice sequence

Smallest independently reviewable slices; all land on the one `feat/37-laundry-orders-lifecycle` branch / PR (process spec §2.8). Hard prerequisites noted.

0. **Slice 0 — Baseline preflight (no code).** Before any implementation, run the existing `apps/api` unit suite and e2e suite on a clean `feat/37-laundry-orders-lifecycle` checkout against a fresh database and record: the exact set of failing/skipped tests, their failure signatures, and whether any laundry-touched file (GraphQL schema generation, `app.module.ts`, TypeORM metadata, the pagination allowlist) is implicated. Commit this as a short note (or capture it in the branch's first Slice Completion Report). Every later "pre-existing, unrelated" claim at closeout must cite this record, not #36's handoff.
1. **Slice A — Domain + policy + pricing (pure TS).** No wiring, no DB, no NestJS. Fully reviewable and testable alone. Prereq for C.
2. **Slice B — Infrastructure: entities + migration.** Depends on A (imports the enums/interfaces). Verifiable alone (migration up/down against real Postgres; entity-metadata sync check). Prereq for C's persistence and all e2e.
3. **Slice C — Application: `LaundryOrdersService` + commands + partial `LaundryModule`.** Depends on A + B. Unit-tested with mocked repository/`DataSource`/`AuditLogger`. Not yet wired into `app.module.ts` (no GraphQL surface yet).
4. **Slice D — Presentation: GraphQL types, inputs, resolvers, module wiring, allowlist rows, DI test.** Depends on C. After this slice `apps/api` boots with the full laundry surface; `src/schema.gql` regenerates.
5. **Slice E — e2e (real Postgres).** Depends on D. Golden path + snapshot immutability + the two concurrency races + an illegal-transition rejection over GraphQL.
6. **Slice F — Web.** Depends on D (needs `src/schema.gql`). `packages/client` operation docs + regen, then `apps/web/app/app/laundry/page.tsx` + nav + smoke test; verify `apps/web` build and drive the page in a browser.

No slice leaves a partially-implemented user-visible behavior: A–C add no schema surface; D adds the whole surface at once; E/F are verification and UI.

## 6. TDD / verification strategy

| Slice | Tests that fail first → behavior verified | Non-TDD verification |
| --- | --- | --- |
| **0** | — | `pnpm --filter api test` + `pnpm --filter api test:e2e` on a clean checkout; the failing/skipped set and signatures recorded as the closeout baseline. |
| **A** | `laundry-order-status-transition-policy.spec.ts` — table-driven over all 15×15 ordered pairs vs an independent in-test matrix: every legal edge `canTransition` true / `assertTransition` no-throw; every illegal edge false / throws `BadRequestException`; the three fully-terminal states have empty out-sets; `COMPLETED`/`LOST`/`DAMAGED` out-sets are exactly `{REFUNDED}`. `laundry-line-pricing.spec.ts` — `PER_KG` (2350 g × 15000 → 35250; exact-half rounding case; a case where `raw < floor` sets `minimumChargeApplied` and `amountMinorUnits = floor`; 0 g → `raw = 0`, floored); `PER_ITEM` (3 × 800 → 2400, no rounding); `FLAT`/`PER_SERVICE` (→ rate); `minimumChargeMinorUnits: null` → `floor = 0`, never applied. `divideRoundHalfUp` — just-below / exact / just-above half. | — |
| **B** | — | `pnpm --filter api migration:run` then `migration:revert` against a real database (both clean); `pnpm --filter api migration:generate` produces **no** further diff for the two entities (metadata matches the migration). Then verify against **PostgreSQL's own catalogs** (`information_schema` / `pg_constraint` / `pg_type` — not TypeORM metadata, since the migration is hand-authored): the line-target `CHECK` rejects a both-null and a both-set row; the `weightGrams >= 0` CHECK rejects `-1`, permits `NULL` and `0` and a positive integer; `pricingSnapshotPricingRuleId` has **no** foreign key; `laundry_order_line_unit_enum` exists with exactly the four values; `pricing_rule_entity_unit_enum` and every other `pricing_rule_entity` / catalog constraint is byte-for-byte unchanged; the `ON DELETE` actions are `RESTRICT` for `customerId`/`serviceId`/`addOnId` and `CASCADE` for `laundryOrderId`. |
| **C** | `laundry-orders.service.spec.ts` (mocked repo/`DataSource`/`AuditLogger`) — `receive` validates the customer (→ `NotFoundException` when absent) and creates at `RECEIVED` with `laundry_order.received`; `weigh` from `RECEIVED` transitions + sets `weightGrams` + audits `laundry_order.weighed`; `weigh` from `WEIGHED` updates weight only, no `assertTransition`, still audits; `weigh` with a negative/non-integer weight → `BadRequestException`; `price` from `WEIGHED` resolves each line, applies the §4.5 3a quantity rule per resolved unit, freezes all seven snapshot fields, sets `totalMinorUnits`, transitions to `PRICED`, audits `laundry_order.priced`; `price` when a target has no effective price → `BadRequestException`, nothing persisted; each transition verb calls `assertTransition` on the locked row and rejects an illegal source state; `markAwaitingPickup` on a `DELIVERY` order → `BadRequestException`; `cancel` from `PAID` → rejected by the policy. | — |
| **D** | `laundry-order-read.resolver.spec.ts` / `laundry-order.resolver.spec.ts` — mutations map input → command and return the mapped type; `@Roles` metadata present per the §4.4 table; `laundryOrder` returns `null` for a missing id. `laundry.module.di.spec.ts` — the module compiles with faked `CustomersModule`/`CatalogModule`/global `DataSource` (the `jobs.module.di.spec.ts` shape). `paginated-collections-allowlist.e2e-spec.ts` — the new `laundryOrders` root row (`LaundryOrderConnection`, `totalCount`, `paging` default `{ limit: 20 }`, sort fields include `createdAt`,`id`) and the `LaundryOrder.lines` nested row (no `totalCount`) pass; no `createOneLaundryOrder`, no `transitionLaundryOrderStatus` in the schema. | `pnpm --filter api build` + `nest start` boot; `src/schema.gql` regenerates and contains the 15 verb mutations. |
| **E** | `test/laundry.e2e-spec.ts` — full golden path `receive → weigh → price → markAwaitingPayment → markPaid → startProcessing → markReady → markAwaitingPickup → complete`, asserting status + audit events + line snapshots at each step; **pricing-rule independence** — price an order, then create a new effective `PricingRule` for the same service at a different rate, re-fetch, assert every line snapshot and `totalMinorUnits` unchanged; **no re-pricing** — call `priceLaundryOrder` again on the already-`PRICED` order → rejected by the status guard (`price` requires `WEIGHED`), and re-fetch to assert the line count, all seven snapshot columns per line, and `totalMinorUnits` are byte-for-byte unchanged (this is the direct "the snapshot is immutable after `PRICED`" assertion — no code path updates a `pricingSnapshot…` column or `totalMinorUnits` once set); **illegal transition** — `startProcessing` on a `PRICED` order → GraphQL error, status unchanged. `test/laundry.service.e2e-spec.ts` (two real connections, `Promise.allSettled`, the `admins.service.disable-concurrency.e2e-spec.ts` shape) — **competing targets**: from one `PAID` row, `T1: startProcessing` vs `T2: refund` → exactly one commits; the loser, **after blocking on the winner's row lock, seeing the winner's committed status on re-read, and having its own `assertTransition` reject that source→target**, fails with the application `BadRequestException` (not a Postgres lock/serialization error) and writes **no** audit event; final status is exactly one target; exactly one matching audit event exists. **Same target**: both `startProcessing` → one commits; the loser's post-lock re-read sees `PROCESSING` and `assertTransition(PROCESSING, PROCESSING)` rejects (no self-edge); one audit event total. | — |
| **F** | `apps/web` `app/app/laundry/page.tsx` smoke test (the `bookings`/`jobs` page-test depth) — list renders rows; intake `FormDialog` submits `receiveLaundryOrder`; the detail drawer shows lines + snapshot fields and offers only the actions legal for the current status + `fulfillmentType`. | `pnpm --filter web build` clean; drive the page in a browser (intake → weigh → price → advance), confirm `StatusBadge` tones and the action set at `READY` respect `fulfillmentType`. |

Full-suite regression (`pnpm --filter api test`, `pnpm --filter api test:e2e`, lint, `packages/client` + `apps/web` builds) after Slice F. Compare the result **against the Slice 0 baseline record**, not against #36's handoff — the closeout must classify every non-passing test as pre-existing (in the baseline), a regression from #37 (new — must be fixed before PR), or newly fixed.

## 7. Task breakdown

**Slice 0**
0. Run `pnpm --filter api test` and `pnpm --filter api test:e2e` on a clean branch checkout / fresh DB; record the failing+skipped set, signatures, and any laundry-adjacent file involved (§5 Slice 0). This record is the sole baseline every closeout "pre-existing / unrelated" claim cites.

**Slice A**
1. `domain/laundry-order-status.ts`, `domain/laundry-fulfillment-type.ts` — the two enums.
2. `domain/laundry-order.ts`, `laundry-order-line.ts`, `laundry-order-line-pricing-snapshot.ts` — plain interfaces per spec §4.2.
3. `domain/laundry-order-status-transition-policy.ts` — the matrix constant + `canTransition`/`assertTransition`; **write the failing table-driven spec first** (all 15×15 pairs vs an independent in-test matrix).
4. `domain/laundry-line-pricing.ts` — `divideRoundHalfUp` then `computeLaundryLineAmount`; **failing spec first** (the §6 Slice A cases).

**Slice B**
5. `infrastructure/persistence/laundry-order-line-pricing-snapshot.embeddable.ts` — `@Column`-decorated, `prefix: false`, explicit `pricingSnapshot…` names; `unit` as `enum` (generates `laundry_order_line_unit_enum`).
6. `laundry-order.entity.ts`, `laundry-order-line.entity.ts` — `implements` the domain interfaces; dual scalar+`@ManyToOne` for `customerId`/`serviceId`/`addOnId` (persistence metadata only); `pricingRuleId` a plain `@Column({ type: 'uuid', nullable: true })` with **no** relation.
7. Register both entities in `platform/database/data-source.ts` `entities: [...]`.
8. `<epoch>-CreateLaundryOrders.ts` — `up()` per spec §4.10 (3 `CREATE TYPE`; `laundry_order_entity` with the hand-added `CHECK ("weightGrams" IS NULL OR "weightGrams" >= 0)`; `laundry_order_line_entity` with the hand-added `CHECK (num_nonnulls("serviceId","addOnId") = 1)` and `pricingSnapshotPricingRuleId` as a plain column with no FK; indexes on `customerId`/`status`/`(createdAt,id)` and `laundryOrderId`/`(laundryOrderId,createdAt,id)`); `down()` in the spec §4.10 order (`laundry_order_line_entity` → `laundry_order_entity` → `laundry_order_line_unit_enum` → `laundry_fulfillment_type_enum` → `laundry_order_status_enum`; no catalog object touched). Run `migration:generate` and confirm no residual diff; then run the `pg_constraint`/`pg_type`/`information_schema` introspection checks in §6 Slice B.

**Slice C**
9. `application/commands/*.command.ts` — `ReceiveLaundryOrderCommand { actorId; customerId; fulfillmentType }`, `WeighLaundryOrderCommand { actorId; orderId; weightGrams }`, `PriceLaundryOrderCommand { actorId; orderId; baseServiceId; baseQuantity?; addOns: { addOnId; quantity? }[] }`, `LaundryOrderTransitionCommand { actorId; orderId }`.
10. `application/services/laundry-orders.service.ts` — constructor injects `DataSource`, `@InjectRepository(LaundryOrderEntity)`, `@InjectRepository(LaundryOrderLineEntity)`, `LaundryOrderStatusTransitionPolicy`, `CustomersService`, `PricingRulesService`, `AUDIT_LOGGER`. **Failing `laundry-orders.service.spec.ts` first.**

   **`transition(manager, lockedOrder, target, action, actorId)` — private helper.** `policy.assertTransition(lockedOrder.status, target)` → `manager.update(LaundryOrderEntity, { id: lockedOrder.id }, { status: target, updatedAt: new Date() })` → `auditLogger.log({ actorId, action, entityType: 'laundry_order', entityId: lockedOrder.id })`. It does not re-read status and takes no `currentStatus` argument (§2 helper-contract constraint) — `lockedOrder` is always the pessimistic-locked row from the current transaction.

   **Per-command transaction boundaries** (every command is `dataSource.transaction((manager) => runAuditInTransaction(manager, async () => { … }))` — the whole body commits or rolls back atomically, audit included):

   - **`receive`** — `CustomersService.getCustomer(customerId)` runs **before** `dataSource.transaction` (pre-check for a clean `NotFoundException`; `fk_laundry_order_customer` is the actual check/write-race guard — spec §4.1). Inside the transaction: `manager.save` a new `LaundryOrderEntity` at `RECEIVED` with `fulfillmentType`, `weightGrams: null`, `totalMinorUnits: null`; `auditLogger.log('laundry_order.received')`; return it. No lock (nothing to lock — the row does not exist yet).
   - **`weigh`** — inside the transaction: lock the row (`findOne … pessimistic_write`); `NotFoundException` if absent; reject a negative/non-integer `weightGrams` (`BadRequestException`); if `status === RECEIVED`, `transition(manager, order, WEIGHED, 'laundry_order.weighed', actorId)` **and** in the same `manager.update` set `weightGrams`; if `status === WEIGHED`, `manager.update` sets `weightGrams` only (no `assertTransition`, no status change) and still `auditLogger.log('laundry_order.weighed')`; any other status → `BadRequestException` (weigh is not legal). Return the reloaded row.
   - **`price`** — the immutable-snapshot operation, exactly once per order. Sequence inside one transaction:
     1. lock the row (`findOne … pessimistic_write`); `NotFoundException` if absent.
     2. **Precondition guard:** `status` must be `WEIGHED` — reject anything else (including an already-`PRICED` order) with `BadRequestException`. This is the no-re-pricing guard; it is *not* the load-bearing transition assertion (that is step 8).
     3. shape-validate the input (exactly one `baseServiceId`; each `quantity`/`baseQuantity` an integer ≥ 1; `order.weightGrams` set).
     4. capture one `asOf = new Date()`.
     5. for the base service and each add-on, `PricingRulesService.resolveEffectivePricing({ serviceId | addOnId }, asOf)` — any `null` → `BadRequestException`, whole transaction rolls back, nothing persisted.
     6. for each resolved rule, apply the spec §4.5 step 3a quantity rule keyed on the **resolved** `PricingRule.unit` (`PER_KG` → `order.weightGrams`; `PER_ITEM` → the caller's `baseQuantity`/add-on `quantity`, default 1; `FLAT`/`PER_SERVICE` → 1; a supplied quantity on a non-`PER_ITEM` line is ignored, not an error) and compute `computeLaundryLineAmount`.
     7. `manager.save` every `LaundryOrderLineEntity` with its frozen 7-field snapshot.
     8. **Final status write — the load-bearing assertion lives here:** call `policy.assertTransition(order.status, PRICED)` **immediately before** the `manager.update(LaundryOrderEntity, { id: order.id }, { status: PRICED, totalMinorUnits: Σ amountMinorUnits, updatedAt: new Date() })`. No other status-changing operation happens between the assertion and this write. (`order.status` here is still the value from the step-1 locked read — nothing in steps 2–7 changes it.) The generic `transition()` helper is *not* used for `price` because this write also sets `totalMinorUnits`; the assertion is inlined immediately adjacent to the `manager.update` instead, keeping the §2 invariant literally true.
     9. `auditLogger.log('laundry_order.priced')` — only after step 8's write, inside the same transaction. Return the reloaded order.
   - **The 12 transition verbs** (`markAwaitingPayment`, `markPaid`, `startProcessing`, `markReady`, `markAwaitingPickup`, `markAwaitingDelivery`, `complete`, `cancel`, `reject`, `markLost`, `markDamaged`, `refund`) — inside the transaction: lock the row; `NotFoundException` if absent; run the verb's extra precondition (`markAwaitingPickup`/`markAwaitingDelivery` check `order.fulfillmentType`; the rest have none); `transition(manager, order, <target>, 'laundry_order.<verb>', actorId)`; return the reloaded row. The target status and the audit action string per verb come from the spec §4.4 table.
11. `laundry.module.ts` — application-layer wiring (no resolvers yet).

**Slice D**
12. `presentation/graphql/laundry-order-line-pricing-snapshot.type.ts`, `laundry-order-line.type.ts`, `laundry-order.type.ts` (+ both `registerEnumType` calls). **First read `modules/jobs/presentation/graphql/checklist.type.ts` and `cleaning-job.type.ts` in full** and replicate the exact mechanism by which `Checklist.items` becomes a nested offset connection (the relation decorator, `PagingStrategies.OFFSET`, `QueryOptions`, `enableTotalCount: false`, default sort) — do not approximate it. `LaundryOrder.lines` follows that pattern; `LaundryOrderLineType`/`LaundryOrderLinePricingSnapshotType` are `@ObjectType`s exposing the fields in §3.
13. `presentation/graphql/*.input.ts` — the five inputs per spec §4.7.
14. `presentation/graphql/mappers.ts` + `laundry-order-relation.loaders.ts` — domain → type mappers; customer DataLoader.
15. `laundry-order-read.resolver.ts` — `ReadResolver` + `Relatable`, `one: { disabled: true }`, `many: { name: 'laundryOrders' }`, offset paging, `enableTotalCount: true`, default sort `createdAt DESC, id ASC`.
16. `laundry-order.resolver.ts` — the custom `laundryOrder(id)` nullable query + the 15 verb `@Mutation`s, each `@UseGuards(AuthGuard)` + `@Roles(...)` per spec §4.4, delegating to `LaundryOrdersService` and returning `toLaundryOrderType(...)`; the `customer` `@ResolveField`.
17. Extend `laundry.module.ts` with the nestjs-query feature registrations + resolver/loader providers; add `LaundryModule` to `app.module.ts` `imports`.
18. `tests/laundry.module.di.spec.ts` + resolver specs; add the two rows to `paginated-collections-allowlist.e2e-spec.ts`. **Failing first where practical.**

**Slice E**
19. `test/laundry.e2e-spec.ts` — golden path + snapshot immutability + illegal-transition-over-GraphQL.
20. `test/laundry.service.e2e-spec.ts` — competing-target race + same-target race (two connections).

**Slice F**
21. `packages/client/src/operations/laundry.graphql` — `LaundryOrders` list query (nodes: id, customer{id,fullName}, fulfillmentType, status, weightGrams, totalMinorUnits, createdAt), `LaundryOrder` detail query (+ `lines { nodes { … pricingSnapshot { … } } }`), the 15 mutations. `pnpm --filter @clensy/client codegen`.
22. `apps/web/app/app/laundry/page.tsx` — `Suspense` shell + content (the `bookings/page.tsx` structure): `PageHeader` + intake `FormDialog` (customer `<select>`, `fulfillmentType` `<select>`), `DataTable` + `StatusBadge` (tones per spec §4.9), `DetailDrawer` via `useDetailDrawer` showing lines + snapshot + total, and an action area computing `matrix-legal ∩ fulfillmentType branch ∩ role` from a small client constant mirroring the spec §4.3 matrix. Role is used **only to hide** buttons the actor cannot use — the server independently authorizes every mutation and rejects an unauthorized or illegal call regardless of what the client rendered. `weigh`/`price` open sub-forms; exceptional verbs behind `ConfirmDialog`.
23. `apps/web/components/app-shell/sidebar.tsx` — add `{ label: 'Laundry', href: '/app/laundry' }` to the "Operations" group.
24. `apps/web` page smoke test; `pnpm --filter web build`; browser walk-through.

**Closeout**
25. Full-suite regression + lint + both downstream builds; Slice Completion Report; PR on `feat/37-laundry-orders-lifecycle`.

## 8. Traceability

| Task(s) | Accepted spec § |
| --- | --- |
| 0 | process spec §2.11 (evidence-based closeout baseline); not spec-semantic |
| 1–2 | §4.2, §4.3 (enum values) |
| 3 | §4.3 (matrix, policy API, load-bearing invariant) |
| 4 | §4.5 (formula, `divideRoundHalfUp`, floor-after-rounding) |
| 5–7 | §4.2 (entities, embeddable, no-FK `pricingRuleId`), §4.10 |
| 8 | §4.10 (migration, module-local enum, `down()` order, catalog untouched) |
| 9–10 | §4.4 (verb commands, RBAC, audit actions), §4.5 (pricing steps, §3a quantity rule), §4.6 (transaction, lock) |
| 11, 17 | §4.1 (module boundaries, no foreign-entity registration) |
| 12–16 | §4.7 (types, inputs, read/mutation split, nested connection, nullable single query) |
| 18 | §4.7 (allowlist regression), §4.1 (DI) |
| 19–20 | §2 "Tests" (golden path, race), §4.5 (immutability), §4.6 (competing-target race as load-bearing) |
| 21–23 | §4.9 (web: primitives-only, action-set derivation, nav) |
| 24–25 | §2 "Tests" (frontend smoke), process spec §2.11 (Slice Completion Report) |

## 9. Execution / dependency risks

- **`ReadResolver` `one` nullability.** nestjs-query's generated single-entity query is non-null / throws on miss; the spec wants the nullable `job` precedent. Mitigation: `one: { disabled: true }` + a hand-written `@Query(nullable: true)` — already how `modules/jobs` does it; Task 15/16 follow it exactly.
- **Nested-connection registration.** `LaundryOrderLineEntity` must be registered with `NestjsQueryTypeOrmModule.forFeature` for the `lines` relation connection to resolve; the allowlist test will catch a missing `LaundryOrderLineConnection`/`LaundryOrderLineSortFields`. Task 12 + 17.
- **`migration:generate` drift.** TypeORM's embedded-column naming (`prefix: false` + explicit names) and the module-local enum must match the hand-written migration exactly or `migration:generate` shows a diff. Task 8 includes an explicit generate-and-verify step; the `BookingPricingSnapshotEmbeddable` comments document the `titleCase()` pitfall this avoids.
- **Pessimistic lock in tests.** `lock: { pessimistic_write }` requires an active transaction; unit tests mock `dataSource.transaction` to invoke the callback with a mocked `manager` whose `findOne` ignores the `lock` option — fine for unit level. The real lock behavior is only exercised in Task 20 (two connections), which is where it matters.
- **`schema.gql` timing for `packages/client`.** Slice F Task 21 must run after Slice D has emitted the updated `apps/api/src/schema.gql` (autoSchemaFile on boot/build). Sequence enforced by the slice order.
- **Client codegen scope.** `pnpm --filter @clensy/client codegen` regenerates `src/generated/graphql.ts` from all `src/**/*.graphql`; the only new documents are laundry's, so the diff should be additive — verify no unrelated operation changed (the #36 plan's discipline).
- **`price` line-creation atomicity.** `price` both creates `LaundryOrderLine` rows and transitions the order; a failure at any step (a target with no effective price, a DB error) must leave the order at `WEIGHED` with zero lines and no `laundry_order.priced` audit event. The single `dataSource.transaction` wrapping the whole Task 10 `price` body (steps 1–9) provides this; the e2e "no effective price → nothing persisted" case (Task 19) is the check.
- **Re-weigh vs transition audit.** Both the `RECEIVED → WEIGHED` transition and a `WEIGHED` state-preserving re-weigh emit `laundry_order.weighed`. That is intentional (spec §4.4) — the audit stream shows every weight capture; a reader distinguishes the first from a correction by whether an earlier `laundry_order.weighed` exists for the entity. No separate `reweighed` action.

## 10. Self-check

| Check | Result |
| --- | --- |
| Every major task traces to Accepted spec | Yes — §8 |
| No task introduces new product semantics | Yes — §3 items are file layout / helper shape / registration mechanics; all behavior is cited to the spec |
| Task ordering executable without inventing missing work | Yes — A→B→C→D→E/F, prerequisites stated in §5/§9 |
| Deferred work explicitly identified | Yes — §4 (line `service`/`addOn` resolve-fields, seeder), §2 SHALL NOT |
| Missing design semantics → stop and return to M2/M3 | None found — the M3 round-2 `baseQuantity` gap was the last, and it is resolved in the Accepted spec (§4.5 step 3a) |
| Line-creation timing is explicit (not left to inference) | Yes — §2 "Line ownership" + Task 10 `price` steps 1–9: lines are created only by `price`, in its transaction |
| Every command's transaction boundary is explicit | Yes — Task 10 per-command boundaries (`receive` validates the customer before the transaction, everything else locks then acts) |
| Transaction/audit atomicity + loser-emits-no-audit stated as an invariant | Yes — §2 "Transaction / audit atomicity"; verified in Task 20 |
| Closeout baseline is evidence-based, not assumed | Yes — Slice 0 / Task 0; recorded in §11 |

## 11. Slice 0 baseline (recorded 2026-09-06, `feat/37-laundry-orders-lifecycle` at `53de9f9`, Docker Postgres)

- **`pnpm --filter api test`** (unit): **43 suites / 287 tests, all passing.** Clean.
- **`pnpm --filter api test:e2e`**: **15 suites pass / 2 fail; 131 tests pass / 3 fail.** Failing:
  - `test/bookings.e2e-spec.ts` › *proves the full Bookings E2E acceptance scenario* — `expect(atSix.counts[table]).toBeGreaterThan(0)` fails (relation-table row counts read as `0`).
  - `test/jobs.e2e-spec.ts` › *proves the full Jobs GraphQL E2E acceptance scenario*
  - `test/jobs.e2e-spec.ts` › *filters jobs by booking relation (mechanism 1) with limit 1 and loads nested items in O(1)*
- **Nature:** all three depend on the same query-logging/relation-count capture helper that does not function in this sandbox environment — the exact failure family #36's handoff documented (then 2 tests; the Jobs suite now trips one extra assertion in the same helper). **No laundry-touched file is involved** (no GraphQL schema-generation, `app.module.ts`, TypeORM-metadata, or pagination-allowlist failure). These three are the pre-existing baseline; the #37 closeout must show the same three and no others (beyond newly-added laundry tests passing).
- **Lint / builds** not part of the baseline gate but confirmed green in #36's merged closeout; re-checked at #37 closeout against this record.
