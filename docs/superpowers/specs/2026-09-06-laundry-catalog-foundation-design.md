# Laundry Architecture & Catalog Foundation — Specification

| Field | Value |
| --- | --- |
| **Status** | Draft |
| **Kind** | Architecture RFC (product behavior/contracts for this slice, not a process specification) |
| **Date** | 2026-09-06 |
| **Tracking** | [#36](https://github.com/rexescario-dev/clensy-platform/issues/36) — prerequisite ticket for the Laundry epic (#37–#45) |
| **Depends on (informative)** | [Catalog](2026-08-16-catalog-design.md) (Accepted) — this specification extends `PricingRuleEntity`/`PricingRulesService` additively; it does not redesign `Service`, `AddOn`, or the existing `active`-flag deactivate-then-insert contract. [Bookings](2026-08-22-bookings-design.md) (Accepted) — `BookingsService.resolveAndValidate`/`getActivePricing` are consumed unchanged; this specification does not alter their behavior or call signature. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M2 |
| **Followed by** | #37 (`LaundryOrder`) consumes `resolveEffectivePricing` directly; this specification does not define any laundry-domain entity. |

## 1. Primary question & thesis

**Question:** Does laundry get its own catalog/pricing system, or does it extend what already exists — and, either way, how does `PricingRuleEntity` grow to express effective-dated, unit-aware, minimum-charge pricing for both `Service` and `AddOn` without breaking `Booking`'s existing simple pricing flow?

**Thesis:** Laundry services and add-ons are ordinary `ServiceEntity`/`AddOnEntity` rows — no parallel laundry catalog is introduced. `PricingRuleEntity` remains the single append-only pricing-history mechanism for the whole platform; it is extended (never replaced) to carry `unit`, an effective date range (`effectiveFrom`/`effectiveTo`), an optional `minimumChargeMinorUnits` floor, and an optional `addOnId` target alongside its existing `serviceId` target. Two independent resolution mechanisms coexist on the same table: the existing `active`-flag mechanism (`getActivePricing`, consumed exclusively by `BookingsService`, untouched) and a new date-range mechanism (`resolveEffectivePricing`, consumed by the yet-to-be-built laundry module). Nothing in this specification requires the two to be kept in sync — see §5 and §7.

## 2. Scope

### In scope (normative)

- Catalog-tenancy decision: laundry services/add-ons are `ServiceEntity`/`AddOnEntity` rows. Recorded here (§5), not in a separate ADR file — this ticket produces both the decision and the schema work it implies, and this repository's convention is one spec per ticket ([Catalog](2026-08-16-catalog-design.md), [Bookings](2026-08-22-bookings-design.md)).
- `PricingRuleEntity` schema: additive columns `unit`, `effectiveFrom`, `effectiveTo`, `minimumChargeMinorUnits`, `addOnId`; `serviceId` relaxed from `NOT NULL` to nullable (the one non-purely-additive change — see §5).
- A mutual-exclusivity invariant: exactly one of `serviceId`/`addOnId` is set per row.
- A new application-layer resolution method, `resolveEffectivePricing`, covering both `Service`- and `AddOn`-targeted rules by effective date.
- Extension of `createPricingRule`/`CreatePricingRuleCommand` to accept the new optional fields and maintain the new effective-date chain transactionally, for both target kinds.
- A migration-time backfill reconstructing `effectiveFrom`/`effectiveTo` for every existing `PricingRuleEntity` row from `createdAt` ordering, so historical resolution is correct for pre-migration data too.
- The platform-wide weight convention: laundry weight is represented as a non-negative integer number of grams. Documented here as a binding convention for #37; no column is added in this ticket (no weight-bearing entity exists yet).

### Out of scope (normative)

- `LaundryOrder`, `LaundryOrderLine`, or any laundry-domain entity, application service, GraphQL surface, or web UI — entirely #37 (Laundry Orders & Operational Lifecycle).
- Any change to `BookingsService.resolveAndValidate`/`getActivePricing`, `active`, or `uq_pricing_rule_active_service` — consumed exactly as-is (§5, §7).
- Any mechanism that promotes a scheduled (`effectiveFrom > now`) `PricingRule` into the legacy `active` flag when its date arrives — named as a future extension point, not built (§5, §7).
- Tiered/banded pricing (a different per-kg rate above a quantity threshold) — `PricingRule` still expresses exactly one flat rate per effective interval.
- Multi-currency support — unchanged from Catalog's decision; `priceMinorUnits`/`minimumChargeMinorUnits` remain raw integers with an implicit single operating currency.
- Retroactive insertion into pricing history (splicing a new interval between two existing ones, or before the earliest one) — the effective-date chain only ever extends forward from whatever interval is currently open (§5).
- Any GraphQL query exposing `resolveEffectivePricing` or a price-history list — #37 consumes it as a direct application-service call, the same cross-module pattern `BookingsService` already uses for `ServicesService`/`PricingRulesService` (no new query surface is required by this ticket's scope).
- A laundry-vs-cleaning distinguishing flag on `Service`/`AddOn` — which catalog rows are "laundry" is implicit in which rows #37 references; no new column is introduced for this.

## 3. Terminology

- **Effective interval** — the `[effectiveFrom, effectiveTo)` half-open range during which a `PricingRule` row is the resolvable price for its target. `effectiveTo: null` means the interval is open-ended (currently the newest scheduled/active price for that target).
- **Target** — the single catalog row a `PricingRule` prices: exactly one of a `Service` (via `serviceId`) or an `AddOn` (via `addOnId`).
- **Legacy active pricing** — the existing `active`-flag mechanism and `getActivePricing`, scoped to `Service` targets only, consumed exclusively by `BookingsService`. Not extended or reinterpreted by this specification.
- **Effective-dated resolution** — the new `resolveEffectivePricing(target, asOf)` mechanism: returns the one `PricingRule` row for a target whose effective interval covers `asOf`, or `null`.
- **Unit** — `PER_KG | PER_ITEM | FLAT | PER_SERVICE`, the pricing basis a rule expresses. `PER_SERVICE` is the flat-per-booking basis every existing `PricingRule` row implicitly uses today.
- **Minimum charge** — `minimumChargeMinorUnits`, an optional floor a consuming module (e.g. #37) applies after computing a quantity-based amount (e.g. weight × per-kg rate). This specification only stores the value; it does not implement any charge computation.

## 4. Domain and behavioral contracts

### 4.1 Catalog tenancy decision

Laundry services (e.g. "Wash & Fold," "Dry Cleaning") and laundry add-ons (e.g. "Same-Day Turnaround") are created as ordinary `ServiceEntity`/`AddOnEntity` rows through the existing `ServicesService`/`AddOnsService` — no new module, table, or GraphQL type is introduced for "what laundry sells." This follows the same maximal-reuse precedent already established across this codebase (Cleaners/Teams, Customers/Properties are never duplicated per consuming domain), satisfies this ticket's own acceptance criterion ("no second, competing pricing/service system"), and gives #37 a stable, already-Accepted catalog contract to reference by plain `serviceId`/`addOnId` — no laundry-specific foreign-key type is introduced. The boundary this draws: `Service`/`AddOn` answer *what is this item*; `PricingRule` (extended below) answers *what does it cost, under which conditions, over which effective interval*; `LaundryOrder` (#37) owns *what did the customer actually order, and which specific `PricingRule` priced it* — a `pricingRuleId` reference on each order line for traceability, not a re-derivation of price at read time.

### 4.2 `PricingRule` domain object (extended)

`PricingRule` (all pre-existing fields — `id`, `priceMinorUnits`, `active`, `createdAt` — unchanged in meaning; `serviceId` becomes conditionally required, see below):

- `serviceId: string | null` — foreign key to `Service.id`. Exactly one of `serviceId`/`addOnId` is non-null on any row (enforced by a database `CHECK` constraint, §4.7). All pre-existing rows keep `serviceId` populated and `addOnId` null.
- `addOnId: string | null` — foreign key to `AddOn.id`, `ON DELETE RESTRICT`, mirroring `fk_pricing_rule_service`'s existing policy. New in this ticket; always null on pre-existing rows.
- `unit: PricingUnit` (`PER_KG | PER_ITEM | FLAT | PER_SERVICE`) — required. Backfilled to `PER_SERVICE` for every pre-existing row (§4.8), matching what those rows already mean today: one flat amount per booking.
- `effectiveFrom: Date` — required. Backfilled from each row's own `createdAt` (§4.8).
- `effectiveTo: Date | null` — nullable; `null` means this row's interval is currently open-ended. Backfilled per-target by chaining each row's `effectiveTo` to the `createdAt` of whichever row superseded it, `null` for the newest row per target (§4.8).
- `minimumChargeMinorUnits: number | null` — optional non-negative integer floor. `null` for every pre-existing row; no legacy caller sets it.

`active` and its meaning are **unchanged**: it continues to mean "the row `getActivePricing` returns for this `serviceId`," set exclusively by the legacy deactivate-then-insert transaction, and it is never populated or read for `addOnId`-targeted rows (§4.4). `active` and "has an open effective interval" are two independent, deliberately-uncoupled indicators on the same row for `Service`-targeted rules created before this ticket's cut-over point and for every immediately-effective rule created after it (§4.4) — they are not guaranteed to stay in lockstep for a rule scheduled with a future `effectiveFrom` (§4.4, §5).

### 4.3 Effective-dated resolution

`PricingRulesService.resolveEffectivePricing(target: { serviceId: string } | { addOnId: string }, asOf: Date): Promise<PricingRule | null>` — returns the row for that target whose interval covers `asOf`: `effectiveFrom <= asOf AND (effectiveTo IS NULL OR effectiveTo > asOf)`. Returns `null` if the target has never had a `PricingRule` created, or if `asOf` falls before the target's first `effectiveFrom` (there is no interval covering it yet). At most one row can ever satisfy this predicate for a given target and `asOf`, by construction (§4.4, §4.7) — this method does not need to guard against or arbitrate multiple matches.

This method does not check `Service.active`/`AddOn.active` (catalog "not retired" status) — consistent with `getActivePricing`'s existing precedent that pricing resolution and catalog-retirement status are independent concerns (Catalog spec §4.1).

### 4.4 `createPricingRule` (extended)

`CreatePricingRuleCommand` gains: `addOnId?: string` (mutually exclusive with `serviceId`, exactly one required), `unit?: PricingUnit` (default `PER_SERVICE`), `effectiveFrom?: Date` (default: transaction start time), `effectiveTo?: Date` (default: `null`), `minimumChargeMinorUnits?: number` (default: `null`). Every existing call shape (`serviceId` + `priceMinorUnits` only) continues to produce byte-for-byte the same `active`/`createdAt`/`priceMinorUnits` state as today — the new fields only add columns, they do not change how the existing ones are populated.

Within one transaction, `createPricingRule` now performs, for every call regardless of target:

1. **Existence check** — `Service`/`AddOn` (whichever `serviceId`/`addOnId` was given) must exist (`NotFoundException` otherwise), mirroring the existing `Service` check.
2. **Validation** — `priceMinorUnits` (existing rule), plus the new invariants in §4.7.
3. **Effective-date chain close-then-insert** — find the row currently open (`effectiveTo IS NULL`) for this exact target, if any; if the new rule's `effectiveFrom` is not strictly after that row's `effectiveFrom`, reject (§4.7 — forward-only chain). Close it by setting its `effectiveTo` to the new rule's `effectiveFrom`. Insert the new row with the given `effectiveFrom`/`effectiveTo`/`unit`/`minimumChargeMinorUnits`. The uniqueness guarantee that only one such "open" row per target can ever exist under concurrent writers comes from a new partial unique index, not from this read-then-write sequence alone (§4.7) — the same reasoning the existing `active` mechanism already documents for itself.
4. **Legacy `active`-flag step — `serviceId` targets only, branched on whether the rule is immediately effective:**
   - If `effectiveFrom <= now` (an immediately-effective rule — the shape every existing caller produces, since they never pass `effectiveFrom`): run the existing deactivate-then-insert step unchanged — deactivate whatever `serviceId` row currently has `active: true`, insert the new row with `active: true`.
   - If `effectiveFrom > now` (a genuinely future-scheduled rule): do **not** touch any other row's `active` value, and insert the new row with `active: false`. The currently active legacy row is left exactly as it was.
   - For `addOnId` targets, this step is skipped entirely — `active` carries no meaning for add-on-targeted rows and is left at its column default.
5. **Audit** — one `pricing_rule.create` event, entity id the new row's id, unchanged shape, now also emitted for `addOnId`-targeted rows.

Two concurrent calls attempting to open a new interval for the same target race on the new partial unique index exactly as today's two concurrent legacy calls race on `uq_pricing_rule_active_service`; the loser's insert fails with Postgres `23505`, translated to the existing `ConflictException` message (§4.7).

### 4.5 RBAC and audit

Unchanged from the Catalog specification: creating a `PricingRule` (now for either target) remains Owner/Ops Manager only; reads remain broadly available. No new `@Roles()` combination or audit `action`/`entityType` string is introduced — `pricing_rule.create` already generalizes correctly to either target.

### 4.6 GraphQL surface

`CreatePricingRuleInput` gains the same optional fields as `CreatePricingRuleCommand` (§4.4): `addOnId`, `unit`, `effectiveFrom`, `effectiveTo`, `minimumChargeMinorUnits`, with `serviceId` becoming optional (exactly one of `serviceId`/`addOnId` required — validated at the application layer, §4.7). No new query is added in this ticket (§2) — `resolveEffectivePricing` is consumed by #37 as a direct injected-service call, the same pattern `BookingsService` already uses for `ServicesService`/`PricingRulesService`.

### 4.7 Validation invariants

- **Mutual exclusivity** — exactly one of `serviceId`/`addOnId` is non-null. Enforced at the database layer by `CHECK (num_nonnulls("serviceId", "addOnId") = 1)`, hand-added to the migration's raw SQL (TypeORM cannot express a multi-column check from entity metadata), plus an application-layer pre-check producing a clean `BadRequestException` rather than a raw driver error.
- **At most one open interval per target** — enforced by two new partial unique indexes, `uq_pricing_rule_open_service ON ("serviceId") WHERE "effectiveTo" IS NULL` and `uq_pricing_rule_open_addon ON ("addOnId") WHERE "effectiveTo" IS NULL`, both hand-added, following `uq_pricing_rule_active_service`'s existing precedent exactly. A standard Postgres unique index does not consider `NULL` values equal to each other, so these two indexes never interfere with each other or with `uq_pricing_rule_active_service`.
- **Forward-only chain extension** — a new rule's `effectiveFrom` must be strictly after the currently-open interval's `effectiveFrom` for that target, if one exists (no such check when the target has no `PricingRule` yet). Enforced at the application layer only (documented here, not a database constraint) — this ticket does not support retroactively splicing a new interval into the middle of existing history (§2).
- **Interval well-formedness** — if `effectiveTo` is provided, it must be strictly after `effectiveFrom`. Application-layer check.
- **`unit`** must be one of the four enumerated values — enforced at the database layer as a Postgres `enum` type (same mechanism as `BookingStatus`/`JobStatus`, Catalog/Bookings precedent), so this is not a new validation pattern.
- **`minimumChargeMinorUnits`**, when provided, must be a non-negative integer (`>= 0`) — a floor of exactly `0` is a meaningful, if unusual, configuration (equivalent to no floor); a negative value is not.
- **`priceMinorUnits`** — unchanged existing invariant (positive integer).
- All pre-existing invariants (`Service`/`AddOn` existence, `priceMinorUnits` positivity, the `23505` → `ConflictException` translation for the open-interval race) continue to apply unmodified.

### 4.8 Migration and backfill

One additive migration:

- Add `unit` (`enum`, `NOT NULL`) with a static column default of `PER_SERVICE` at `ADD COLUMN` time — Postgres backfills every existing row from the column default in the same statement, no separate `UPDATE` needed.
- Add `addOnId` (nullable `uuid`) with its FK (`fk_pricing_rule_addon`, `ON DELETE RESTRICT`) and `minimumChargeMinorUnits` (nullable `integer`) — both start `NULL` on every existing row, which is already their correct backfilled value.
- Add `effectiveFrom` as nullable first, backfill with a single `UPDATE ... SET "effectiveFrom" = "createdAt"` (every existing row's own creation time is its correct effective start), then `ALTER COLUMN ... SET NOT NULL`.
- Add `effectiveTo` as nullable, backfill with one `UPDATE` using a `LEAD("createdAt") OVER (PARTITION BY "serviceId" ORDER BY "createdAt")` window (per-`serviceId`, since every pre-existing row is `serviceId`-targeted): each row's `effectiveTo` becomes the `createdAt` of whichever row next superseded it for that service, `NULL` for the newest (currently-active) row per service. This is what makes the acceptance criterion "historical resolution as of a past date returns the rule in effect then" true for pre-migration data, not only for rules created after this ticket ships.
- Relax `serviceId` from `NOT NULL` to nullable. No existing row is affected (every existing row already has `serviceId` populated); this is the one change in this migration that is not a pure column addition, called out explicitly because "additive migration only" (the ticket's own phrase) is otherwise a materially accurate description of every other statement in it.
- Add the two new partial unique indexes and the mutual-exclusivity `CHECK` constraint (§4.7).
- `Booking.pricingSnapshot` is untouched by this migration — it is an independent, already-persisted embedded value on `BookingEntity`, not derived from `PricingRule` at read time, so no backfill of any `Booking` row is required or performed.

## 5. Rationale

- **Reuse over a parallel catalog (§4.1)** — the alternative (a `LaundryService`/`LaundryAddOn` table set) duplicates CRUD, naming-uniqueness, and lifecycle machinery `ServicesService`/`AddOnsService` already provide, for no behavioral gain; it is exactly the "second, competing... system" this ticket's own acceptance criteria rule out.
- **`addOnId` as a nullable sibling column on `PricingRuleEntity`, not a generalized `entityType`/`entityId` pair, and not a separate `AddOnPricingRule` table** — a generalized pair would require either dropping the real `serviceId → Service` foreign key (weakening referential integrity, since a generic `entityId` cannot itself carry two different FK targets) or repurposing the existing `serviceId` column, which conflicts with this ticket's additive-migration constraint. A separate table would duplicate the open-interval uniqueness mechanism and the resolution method rather than sharing one. The nullable-sibling-column shape keeps `serviceId`'s existing FK, index, and legacy semantics completely untouched while giving `AddOn` the identical append-only, effective-dated history mechanism through one shared resolution path.
- **Two independent resolution mechanisms on one table, not one unified mechanism (§4.2, §4.4)** — collapsing `active` into a derivation of the date-range columns (e.g., redefining `getActivePricing` to query `effectiveTo IS NULL AND effectiveFrom <= now()`) would be behaviorally equivalent for all current data, but it changes the implementation of a code path this ticket's own scope says to preserve, not extend. Keeping `active` and its index completely untouched is the lower-risk choice for a prerequisite ticket that many other tickets will build on top of, at the cost of the two indicators needing to be populated together only in the one case that matters (an immediately-effective `serviceId` rule, §4.4 step 4) — every other case (future-scheduled, or `addOnId`-targeted) leaves `active` alone by design.
- **No mechanism promotes a scheduled rule into `active` when its date arrives** — `resolveEffectivePricing` (what #37 actually calls) never reads `active`, so a laundry price scheduled for a future date resolves correctly on that date with zero promotion logic needed. The only scenario where this would matter is a `Service` row that is simultaneously scheduled for a future price *and* actively priced through the legacy `Booking` path — a theoretical overlap, not a real one, since a given catalog row belongs to one domain's pricing flow or the other in practice (a laundry service is never booked as a cleaning booking). Building a promotion mechanism (a scheduled job, or a lazy-check-on-read for `getActivePricing`) would add a moving part neither this ticket nor `Booking` currently needs; it is named as an explicit future extension point rather than built speculatively (§7).
- **Forward-only chain extension, no retroactive splicing (§4.7)** — the ticket's own non-goals rule out tiered/banded pricing as a now-problem; retroactive history editing is a similarly speculative capability with no named consumer in this epic. Every real use case identified (#37's line pricing) only ever needs "what's effective now or in the future," never "insert a correction into the middle of settled history."
- **Partial unique indexes over a `btree_gist` exclusion constraint for the open-interval race guard** — the ticket's own wording asks for "the existing partial-unique-index-style concurrency guard," and the forward-only, single-open-interval invariant (§4.4, §4.7) makes a plain partial unique index on `effectiveTo IS NULL` sufficient to catch the concurrent-open-a-new-interval race; a full non-overlap guarantee across arbitrary ranges (which would need a GiST exclusion constraint and a new Postgres extension) is not needed because arbitrary/retroactive ranges are out of scope by construction.
- **`unit` as a Postgres `enum`, not a plain string column** — matches `BookingStatus`/`JobStatus`'s existing precedent exactly; no new validation pattern is introduced.
- **Weight as integer grams, documented but not modeled here (§2, §3)** — this ticket has no table that stores a measured weight; `PricingRule.unit = PER_KG` only defines the pricing *basis*, and #37's `LaundryOrderLine` is where an actual weight value will be stored and multiplied against a resolved per-kg rate. Recording the convention now, rather than leaving it to #37 to invent, keeps money/quantity representation consistent across the whole epic (integer minor units for money, established by Catalog; integer grams for weight, established here).
- **No laundry/cleaning distinguishing column on `Service`/`AddOn`** — nothing in this ticket or #37 needs to query "give me all laundry services" as a set; #37 references specific `serviceId`s it already knows. Adding a categorization column now would be speculative.

## 6. Acceptance criteria (for this specification)

- The catalog-tenancy decision (reuse, no parallel catalog) is confirmed and its reasoning traceable to this ticket's own acceptance criteria (§4.1, §5).
- The `AddOn` pricing-history mechanism (nullable `addOnId` sibling column, shared resolution/creation path) is confirmed as the chosen design, with the two rejected alternatives' trade-offs explicit (§5).
- The relationship between `active`/`getActivePricing` (legacy, `Service`-only, untouched) and `effectiveFrom`/`effectiveTo`/`resolveEffectivePricing` (new, both targets) is stated precisely enough that no later ticket can silently assume they are kept in sync (§4.2, §4.4, §5, §7).
- The migration's backfill strategy for `effectiveFrom`/`effectiveTo` on pre-existing rows is specified concretely enough (the `LEAD(createdAt)`-per-`serviceId` reconstruction) that M4 planning does not need to invent it, and the acceptance criterion "historical resolution as of a past date is correct" is traceable to this backfill, not left implicit.
- The forward-only chain-extension rule and the two new partial unique indexes are specified precisely enough to write the unit/integration/e2e tests named in the ticket's "Tests expected" section without further design decisions (boundary dates at exactly `effectiveFrom`/`effectiveTo`, the concurrent-open-interval race, invalid/overlapping range rejection).
- No open contradiction with the Accepted Catalog or Bookings specifications; `BookingsService.resolveAndValidate`/`getActivePricing`'s existing contract is confirmed unmodified.
- The weight-as-integer-grams convention is recorded as binding for #37 without introducing any schema in this ticket.

## 7. Non-goals

- Redesigning any Catalog or Bookings contract (`Service`/`AddOn`'s own CRUD, RBAC, audit shape, `active`'s "not retired" semantics, `getActivePricing`, the deactivate-then-insert transaction, the `23505` → `ConflictException` translation pattern) — all reused or extended additively, never redesigned.
- A mechanism that synchronizes a scheduled `PricingRule`'s arrival into the legacy `active` flag — explicitly deferred (§5); revisit only if a concrete consumer needs `Booking`-path pricing to reflect a scheduled future price automatically.
- Tiered/banded pricing, multi-currency support, retroactive history splicing, a price-history query, or any GraphQL query surfacing `resolveEffectivePricing` — all named and deferred in §2/§4.6/§5.
- `LaundryOrder`, `LaundryOrderLine`, and every other laundry-domain concept in #37–#45 — this specification's only obligation to them is a stable `resolveEffectivePricing` contract and the `PER_KG`/integer-grams convention.
- A laundry-vs-cleaning categorization column on `Service`/`AddOn` — not needed by any named consumer (§5).
