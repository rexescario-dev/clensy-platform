# Laundry Orders & Operational Lifecycle — Specification

| Field | Value |
| --- | --- |
| **Status** | Accepted — 2026-09-06. [Amendment #164](#8-amendment-164--focused-order-workspace) Accepted — 2026-10-10; where §8.4 replaces a sentence in §§1–7, §8.4 governs. |
| **Kind** | Architecture RFC (product behavior/contracts for this slice, not a process specification) |
| **Date** | 2026-09-06 |
| **Tracking** | [#37](https://github.com/rexescario-dev/clensy-platform/issues/37) — milestone M11 (Laundry Orders & Lifecycle); first ticket of the Laundry epic after the #36 prerequisite |
| **Depends on (informative)** | [Laundry Architecture & Catalog Foundation](2026-09-06-laundry-catalog-foundation-design.md) (Accepted) — `PricingRulesService.resolveEffectivePricing(target, asOf)` is consumed directly as a stable injected-service call; `PricingUnit` (`PER_KG \| PER_ITEM \| FLAT \| PER_SERVICE`), the integer-minor-units money convention, and the integer-grams weight convention are all reused verbatim. This specification defines the first `minimumChargeMinorUnits` *calculation* semantics — #36 §4.2/§4.7/§5 explicitly deferred them to this ticket. [Bookings](2026-08-22-bookings-design.md) (Accepted) — `BookingPricingSnapshotEmbeddable`'s `@Column(() => …, { prefix: false })` embedded-value pattern and the "snapshot frozen at creation, never re-read" discipline are copied for `LaundryOrderLine`; `BookingStatus`'s Postgres-`enum` column mechanism is reused. [Jobs & Checklists](2026-08-27-jobs-checklists-design.md) (Accepted) — the `dataSource.transaction` + `runAuditInTransaction` write pattern, the nestjs-query `ReadResolver` / separate `@Resolver` mutation-class split, the nested-offset-connection shape (`Checklist.items`), and the constraint-scoped unique-violation → `ConflictException` helper are all reused. [Admin Foundation](2026-08-14-admin-foundation-design.md) (Accepted) — `AuthGuard`, `@Roles()`, `@CurrentUser()`, `AuditLogger` port + `runAuditInTransaction`, consumed as-is. [Customers & Properties](2026-08-15-customers-properties-design.md) (Accepted) — `CustomersService.getCustomer` read contract; `CustomerEntity` reused as the order's only party reference. [Dashboard UX Foundation](2026-08-17-dashboard-ux-foundation-design.md) (Accepted) — `packages/ui` primitives (`DataTable`, `DetailDrawer`, `StatusBadge`, `FormDialog`, `ConfirmDialog`, `PageHeader`), the `/app/*` shell, the `?detail=` drawer convention, and the `/app/:path*` middleware matcher, consumed as-is. [Paginated nestjs-query GraphQL collections](2026-08-28-paginated-graphql-collections-design.md) (Accepted) — the root-Connection (`totalCount`, default 20, max 100) / nested-offset-connection (no `totalCount`) contract and the `paginated-collections-allowlist.e2e-spec.ts` regression pattern. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M2 |
| **Source-material note** | Issue #37 (and #38–#45) cite a "Laundry Module Discovery report, §7/§8/§15/§19" as an architecture reference. That document does not exist as a retrievable artifact — it is absent from the repository (all branches, full history, deleted files, stashes), the ContextForge runtime tree, the GitHub wiki (never created), gists, and issue comments. Per the developer's instruction, this specification is reconstructed from the #37 ticket body, the Accepted #36 specification, and existing repository patterns; every lifecycle edge not literally present in the ticket text was resolved interactively with the project owner during M2 brainstorming (recorded as ratified decisions in §4.3 and §5). #36 followed the same interactive-resolution pattern for the same reason. |
| **Revision note** | M3 round 1 (reviewer: project owner) returned the draft for four required corrections plus six precision items, not a redesign. Required: (1) `PAID → CANCELLED` removed — since `CANCELLED` is terminal it created a paid order with no path to `REFUNDED`, contradicting `REFUNDED`'s reason for existing; cancellation is now reachable only before payment is recorded, and every `PAID` order retains a path to `REFUNDED` (§4.3, §4.4, §5). (2) `minimumChargeMinorUnits` is now frozen into the per-line pricing snapshot, so a historical line is fully self-contained and re-derivable without reading `PricingRule` (§4.2, §4.5, §4.7, §4.10); `pricingRuleId` is demoted to a soft traceability pointer with no foreign key. (3) The snapshot's `quantity` is stated explicitly to store the canonical input in the unit's integer representation — grams for `PER_KG` — with the `÷1000` kilogram conversion confined to the amount calculation so no fractional value is ever persisted (§3, §4.2, §4.5). (4) The web action set is defined as `matrix-legal ∩ order-local branch predicate (fulfillmentType) ∩ actor RBAC`, with the server authoritative (§4.9). Precision items folded in: `WEIGHED → REJECTED`'s business meaning stated (§4.3 n.6); `REFUNDED` explicitly does not imply `LOST`/`DAMAGED` (§4.3 n.8a); the pre-transaction `getCustomer` read reframed as an error-shape choice with the FK as the correctness mechanism (§4.1); the `unit` Postgres enum is module-local (`laundry_order_line_unit_enum`), not a reuse of catalog's TypeORM-generated `pricing_rule_entity_unit_enum` (§4.10, §5); the concurrency acceptance test now requires a competing-valid-target race as the load-bearing case (§4.6, §6); `fulfillmentType` clarified as *return* fulfillment, not intake logistics (§3, §4.2). |
| **M3 decision** | **Accepted** — 2026-09-06. M3 round 1's four required corrections and six precision items all verified present and consistent across the matrix (§4.3), the verb table (§4.4), pricing (§4.5), validation (§4.8), the migration (§4.10), and rationale (§5) — not merely asserted. Round 2 raised one final verification item — the `baseQuantity` × `unit` interaction — resolved by adding §4.5 step 3a: one quantity-resolution rule applied identically to the base-service line and every add-on line, keyed on the *resolved* `PricingRule.unit`, where `PER_KG` always prices on `order.weightGrams` and a supplied quantity there is silently ignored (not rejected, because the client cannot know the resolved unit in advance), `PER_ITEM` uses the caller's quantity, `FLAT`/`PER_SERVICE` use `1`, and the stored snapshot `quantity` is always the canonical value the amount was computed from. No remaining design blocker; no further design fork. Ready for M4 Implementation Planning. |
| **Amendment #164** | **Accepted** — 2026-10-10 (M3). Tracking [#164](https://github.com/rexescario-dev/clensy-platform/issues/164), parent [#154](https://github.com/rexescario-dev/clensy-platform/issues/154). Slice-local; does not replace this specification. The owner explicitly **confirmed** §8.4.1 (`weightGrams` ≥ 1) and §8.4.2 (frozen line `description`, with approval to plan an additive migration that backfills existing rows). §8.4.3 was revised before merge to keep the Accepted repeated-add-on behavior. M3 precision items folded in: §8.4.2 now states the backfill rule and `not null` for every row; the §2, §4.2, §4.4, §4.8 and §4.9 cross-references point at §8.4. No remaining design blocker. Ready for M4. |

---

## 1. Primary question & thesis

**Question:** The codebase has no laundry-domain aggregate. Intake, weighing, service/add-on selection, operational progress (received → completed), and exceptional outcomes have nowhere to live. Neither `BookingStatus` nor `JobStatus` enforces valid transitions — any status value is accepted unconditionally today. A laundry lifecycle has meaningfully more states and branches and cannot inherit that gap. What does `LaundryOrder` look like as the central operational aggregate, how is its status lifecycle made a *checked* contract (the first in this codebase), and how does each order line capture an immutable price resolved from #36's effective-dated pricing?

**Thesis:** A new `modules/laundry` follows the existing domain → application → infrastructure → presentation layering. `LaundryOrder` is a **customer-only** aggregate (`customerId` required, no `propertyId`) owning intake through completion; `LaundryOrderLine` is one row per priced service or add-on, each embedding an immutable `LaundryOrderLinePricingSnapshot` modeled directly on `BookingPricingSnapshotEmbeddable`. The order moves through a **15-state lifecycle whose every legal edge is defined by an explicit transition matrix (§4.3)** — the single executable contract owned by `LaundryOrderStatusTransitionPolicy` (`canTransition` / `assertTransition`). The public GraphQL surface exposes **one verb-specific mutation per meaningful operation** (`weighLaundryOrder`, `priceLaundryOrder`, `startLaundryProcessing`, …, `cancelLaundryOrder`, `refundLaundryOrder`) — never a generic `transitionLaundryOrderStatus`; every mutation that changes `status` calls `assertTransition(current, target)` immediately before the write. Line pricing is resolved exactly once, at `priceLaundryOrder`, via `PricingRulesService.resolveEffectivePricing` with a single captured `asOf` timestamp, and frozen — the same discipline as `Booking.pricingSnapshot`. Every write goes through `dataSource.transaction` + `runAuditInTransaction` with verb-specific `laundry_order.<verb>` audit actions, and re-reads the order row under a pessimistic write lock so concurrent transitions serialize deterministically. `LaundryOrder` has **no structural coupling** to `Invoice`, `Payment`, `Promotion`, `Delivery`, or `Loyalty` — those are #38–#45.

---

## 2. Scope

### In scope (normative)

- **`modules/laundry`** — a new module in `apps/api/src/modules/laundry`, following the domain / application / infrastructure / presentation layering every other module uses. It imports `CustomersModule` and `CatalogModule` for their exported application services, and `AuditModule`; it never imports another module's entities or repositories (Phase 1 Design §2.6, reaffirmed by Bookings §4.2 and #36).
- **Domain (plain TS, no framework):** `LaundryOrder`, `LaundryOrderLine`, `LaundryOrderLinePricingSnapshot`; the `LaundryOrderStatus` (15 values) and `LaundryFulfillmentType` (2 values) enums; `LaundryOrderStatusTransitionPolicy` and its transition matrix (§4.3); a pure `computeLaundryLineAmount` pricing function with a named integer-safe half-up rounding helper (§4.5).
- **Application:** `LaundryOrdersService` with one command per verb operation (§4.4) — intake, record weight, resolve line pricing, and every status transition — each enforcing the transition matrix through the policy before any status write, inside a transaction, with audit.
- **Infrastructure:** `LaundryOrderEntity`, `LaundryOrderLineEntity` (with the embedded `LaundryOrderLinePricingSnapshotEmbeddable`, `prefix: false`), a Postgres `enum` type per enum, an FK to `customer_entity` (`ON DELETE RESTRICT`), a `CHECK` enforcing one-of-`serviceId`/`addOnId` per line, and one additive migration creating both tables (no backfill — new tables).
- **Presentation (GraphQL only):** a nestjs-query `ReadResolver` exposing `laundryOrders` as a root offset Connection (`totalCount`, default 20, max 100) and `laundryOrder(id)` as a single query; a nested `LaundryOrder.lines` offset Connection (no `totalCount`); a separate `@Resolver` mutation class holding the verb mutations (§4.4); `LaundryOrderType`, `LaundryOrderLineType`, `LaundryOrderLinePricingSnapshotType`, the input types, and `registerEnumType` for both enums; additions to `paginated-collections-allowlist.e2e-spec.ts` (root connection, nested connection, sort fields).
- **Web** (superseded in part by Amendment #164 §8.4.4: detail moves to `/app/laundry/[id]`, intake gets a searchable customer picker): `/app/laundry` — order list (`DataTable` + `StatusBadge`), order detail (`DetailDrawer` showing lines, per-line snapshot, and order total), an intake form (`FormDialog`: customer select + fulfillment type), and per-order action controls that offer exactly the transitions legal from the order's current status (destructive/financial ones behind `ConfirmDialog`). A nav entry under the existing "Operations" group. Built only from existing `packages/ui` primitives — no new list/detail component.
- **Tests:** unit (the transition policy — every illegal edge rejected, every legal edge allowed; `computeLaundryLineAmount` — weight × rate, minimum-charge floor, rounding); e2e against real Postgres (intake → priced golden path; a concurrent status-transition race); frontend list/detail smoke coverage consistent with existing module depth.

### Out of scope (normative)

- `Invoice`, `InvoiceLine`, `Payment`, `Promotion`/discount, `Delivery`/logistics, `Loyalty`/history aggregate — #38–#45. `LaundryOrder` carries the operational payment/fulfillment *states* it needs for its own lifecycle (§4.3) but creates no financial or logistics record and holds no foreign key to any of those future aggregates.
- Item-, tag-, or bag-level tracking of individual garments — a named extension point, not built.
- A `propertyId` on `LaundryOrder` — the order is customer-only (§4.2, §5). Reusing `PropertyEntity` for a laundry address is explicitly rejected (consistent with #42's own framing).
- Re-pricing, snapshot mutation, or any recomputation of a `LaundryOrderLine` after it is created — there is no operation that changes a line's price (§4.5).
- A generic `transitionLaundryOrderStatus(orderId, toStatus)` mutation on the public GraphQL schema — the transition policy may be invoked by an internal service method, but the API exposes only verb-specific mutations (§4.4, §5).
- A REST surface for laundry — GraphQL only (issue #37). The Bookings REST controller is not a precedent to follow here; it exists only as that slice's REST-vs-GraphQL comparison artifact.
- Any change to `BookingStatus`, `JobStatus`, `Booking`/`Job` transition semantics (there are none), `PricingRuleEntity`, `getActivePricing`, `resolveEffectivePricing`'s signature or behavior, or the legacy `active` pricing mechanism.
- Any mechanism that promotes a future-scheduled `PricingRule` into effect — `resolveEffectivePricing` already resolves by date (#36 §5).
- Multi-currency — `*MinorUnits` remain raw integers in the single implicit operating currency (Catalog §5, #36 §2).
- A laundry-vs-cleaning categorization flag on `Service`/`AddOn` — which catalog rows are "laundry" is implicit in which rows an order references (#36 §2, §5).
- Weighing modeled as anything other than one order-level integer-grams value (§4.2, §4.5).

---

## 3. Terminology

- **`LaundryOrder`** — the `modules/laundry` aggregate representing one customer drop-off: who the customer is, how the finished laundry will be **returned** to them (`fulfillmentType`), its measured weight, its priced lines, its lifecycle status, and its frozen total.
- **`LaundryOrderLine`** — one row per priced item on an order: exactly one of a base `Service` (via `serviceId`) or an `AddOn` (via `addOnId`), plus an embedded immutable pricing snapshot. Mirrors `PricingRule`'s own one-of-two-targets shape.
- **Base-service line** — the single `LaundryOrderLine` whose `serviceId` is set. Every priced order has exactly one.
- **Add-on line** — a `LaundryOrderLine` whose `addOnId` is set. An order has zero or more.
- **Pricing snapshot** — a `LaundryOrderLine`-owned value object (`{ rateMinorUnits, unit, quantity, amountMinorUnits, minimumChargeMinorUnits, minimumChargeApplied, pricingRuleId }`) captured once when the line is created and never recomputed — the same guarantee as `Booking.pricingSnapshot`. Self-contained: every number needed to re-derive and audit the line's price is frozen here, so no read of `PricingRule` is ever required (`pricingRuleId` is a soft pointer for traceability, not a data dependency). Not an independently addressable entity.
- **`quantity` (snapshot field)** — the canonical priced input, stored in the pricing unit's **integer** representation: for `PER_KG`, the order's `weightGrams` (grams, *not* fractional kilograms); for `PER_ITEM`, the item count; `1` for `FLAT`/`PER_SERVICE`. The gram→kilogram (`÷1000`) conversion for `PER_KG` lives only inside the amount calculation (§4.5) — it is never persisted.
- **Effective-dated resolution** — #36's `PricingRulesService.resolveEffectivePricing(target, asOf)`: the one `PricingRule` row for a `Service`/`AddOn` whose `[effectiveFrom, effectiveTo)` interval covers `asOf`, or `null`.
- **`asOf`** — the single timestamp captured at the start of the `priceLaundryOrder` command and used for every line's `resolveEffectivePricing` call in that command. One notion of "now" per pricing operation (mirrors #36's `operationNow`).
- **Transition matrix** — the total function `LaundryOrderStatus → Set<LaundryOrderStatus>` in §4.3 defining every legal status edge. The executable contract for `LaundryOrderStatusTransitionPolicy`, its table-driven tests, the mutation tests, and the concurrency test.
- **`LaundryOrderStatusTransitionPolicy`** — the single domain object that owns the matrix. `canTransition(from, to): boolean`; `assertTransition(from, to): void` (throws `BadRequestException` on an illegal edge). No status write anywhere happens without `assertTransition` first.
- **Status transition** vs **state-preserving operation** — a *transition* changes `LaundryOrder.status` and must pass `assertTransition`. A *state-preserving operation* (a re-weigh of an already-`WEIGHED`, not-yet-`PRICED` order) runs through the same service/transaction/audit boundary but does not change `status` and does not consult the policy. The matrix contains no self-edges.
- **`fulfillmentType`** — `PICKUP | DELIVERY`, chosen at intake, immutable. Describes how the **finished** laundry is returned to the customer (they collect it, or it is delivered back), *not* how the order is first received — in this ticket an order is always an in-person drop-off. Selects which branch (`AWAITING_PICKUP` vs `AWAITING_DELIVERY`) is legal out of `READY`. Delivery *logistics* (routes, legs, addresses) are #42; this field only records the customer's stated return preference.
- **Exceptional exit** — a transition to `REJECTED`, `CANCELLED`, `LOST`, `DAMAGED`, or `REFUNDED`. Each is an explicit matrix edge with defined source states — never generic error handling.
- **Fully terminal state** — no outbound matrix edge: `CANCELLED`, `REJECTED`, `REFUNDED`.
- **Success terminal state** — `COMPLETED`: the order was fulfilled; its only outbound edge is the post-hoc `→ REFUNDED` (a later dispute).
- **Semi-terminal state** — `LOST` and `DAMAGED`: the operational incident is terminal, but a single financial-resolution edge to `REFUNDED` remains.
- **Minimum-charge floor** — `minimumChargeMinorUnits`, read from the resolved `PricingRule` and **frozen into the line snapshot**, applied to the line's computed amount **after rounding** (§4.5). `minimumChargeApplied` records whether the floor determined the final amount.

---

## 4. Domain and behavioral contracts

### 4.1 Module placement and cross-module rules

`modules/laundry` follows the established layering. `LaundryOrdersService` (application) reads other modules only through their exported application services:

- `CustomersService.getCustomer(id)` — existence check for the order's `customerId` at intake. Runs **before** the transaction opens (it takes no `EntityManager`), exactly as `BookingsService` does. This pre-transaction read exists for application-level validation and a clean `NotFoundException`; it is **not** the correctness mechanism. Referential integrity is enforced independently by `fk_laundry_order_customer` — if the customer were deleted between the check and the insert, the insert fails on the foreign key and the transaction rolls back. The read closes the common case with a good error message; the FK closes the race.
- `PricingRulesService.resolveEffectivePricing(target, asOf)` — called once per line during `priceLaundryOrder` (§4.5). Also a pre-transaction read (it takes no `EntityManager`); the effective interval that covers a fixed `asOf` cannot change between resolution and the line insert. The resolved rule's values are copied into the immutable line snapshot (§4.2, §4.5), so the line stays correct even if the `PricingRule` row is later changed or removed — there is no foreign key from a line to `pricing_rule_entity` (§4.8, §4.10).

**A database foreign key is not an application-module dependency.** `modules/laundry` owns the scalar `customerId` / `serviceId` / `addOnId` values and depends on the referenced module's *application service* for application-level validation — never on its entity or repository. `LaundryOrderEntity` / `LaundryOrderLineEntity` may declare TypeORM `@ManyToOne` relations to `CustomerEntity` / `ServiceEntity` / `AddOnEntity` as persistence metadata (the Bookings/nestjs-query precedent), but `LaundryModule` MUST NOT register any of those foreign entities on `TypeOrmModule.forFeature` / `NestjsQueryTypeOrmModule.forFeature` — their owning modules stay their sole registrants. Application and command code writes the scalar id, never the relation.

Audit goes through the `AUDIT_LOGGER` port and `runAuditInTransaction`; `modules/laundry` never touches `platform/audit`'s persistence.

### 4.2 Domain objects

**`LaundryOrder`:**

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | UUID, generated, not client-settable |
| `customerId` | `string` | required; references `Customer.id`; FK `ON DELETE RESTRICT`; immutable after creation |
| `fulfillmentType` | `LaundryFulfillmentType` (`PICKUP \| DELIVERY`) | required; set at intake; immutable; describes how the **finished** laundry is returned to the customer (not intake logistics — §3); selects the `READY` branch (§4.3) |
| `status` | `LaundryOrderStatus` | starts at `RECEIVED`; only ever changed through a §4.3 transition |
| `weightGrams` | `number \| null` | `null` until the order is weighed; thereafter an integer ≥ 1 (Amendment #164 §8.4.1; originally “non-negative, 0 permitted”). Locked once the order is `PRICED` |
| `totalMinorUnits` | `number \| null` | `null` until `PRICED`; then the frozen sum of every line's `amountMinorUnits` (§4.5). Never recomputed |
| `createdAt` | `Date` | `@CreateDateColumn` |
| `updatedAt` | `Date` | `@UpdateDateColumn` |

No `propertyId`. No foreign key or nullable id column for `Invoice`, `Payment`, `Promotion`, `Delivery`, or `Loyalty` — a future ticket that needs one adds it then.

**`LaundryOrderLine`:**

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | UUID, generated |
| `laundryOrderId` | `string` | required; FK → `laundry_order_entity`; `ON DELETE CASCADE` (a line has no meaning without its order) |
| `serviceId` | `string \| null` | FK → `service_entity`, `ON DELETE RESTRICT`; exactly one of `serviceId`/`addOnId` non-null (`CHECK (num_nonnulls("serviceId","addOnId") = 1)`, §4.8) |
| `addOnId` | `string \| null` | FK → `add_on_entity`, `ON DELETE RESTRICT` |
| `pricingSnapshot` | `LaundryOrderLinePricingSnapshot` | embedded, immutable (below) |
| `createdAt` | `Date` | `@CreateDateColumn`; nested-connection default sort key |

**`LaundryOrderLinePricingSnapshot`** (plain interface in domain; `LaundryOrderLinePricingSnapshotEmbeddable` with `@Column(() => …, { prefix: false })` and explicit `pricingSnapshot…`-prefixed column names in infrastructure, exactly the `BookingPricingSnapshotEmbeddable` pattern):

| Field | Type | Notes |
| --- | --- | --- |
| `rateMinorUnits` | `number` | integer. The resolved `PricingRule.priceMinorUnits` — copied, never re-read |
| `unit` | `PricingUnit` | the resolved rule's unit. Persisted via a module-local Postgres enum, `laundry_order_line_unit_enum` (§4.10) — the `PricingUnit` *TypeScript* enum is shared from catalog's domain, but the DB type is not catalog's |
| `quantity` | `number` | integer, in the unit's canonical representation: the order's `weightGrams` for a `PER_KG` line; the caller-supplied item count for `PER_ITEM`; `1` for `FLAT`/`PER_SERVICE`. The `÷1000` kg conversion is confined to the amount calculation (§4.5) — a fractional value is never stored here |
| `amountMinorUnits` | `number` | integer, computed once (§4.5) |
| `minimumChargeMinorUnits` | `number \| null` | integer floor, copied verbatim from the resolved rule at pricing time; `null` when the rule carried none. Frozen — makes the snapshot self-contained: given `rateMinorUnits`, `quantity`, `unit`, and this value, `amountMinorUnits` and `minimumChargeApplied` are fully re-derivable with no read of `PricingRule` |
| `minimumChargeApplied` | `boolean` | `true` iff the minimum-charge floor determined `amountMinorUnits` (`raw < minimumChargeMinorUnits`) |
| `pricingRuleId` | `string \| null` | a **soft** traceability pointer to the `PricingRule.id` that priced this line — a plain `uuid` column with **no foreign key** (§4.8, §4.10). Nullable in the schema (a future manual-override path may price with no rule); always populated by this ticket's `priceLaundryOrder`. The snapshot, not the rule, is authoritative for what was charged — the pointer may dangle if the rule is ever removed, and that does not affect the line |

All money is integer minor units; weight is integer grams; **no floating-point column anywhere in either table** (issue #37 acceptance criterion; #45 will add a guard).

### 4.3 The status lifecycle and transition matrix

**`LaundryOrderStatus`** (Postgres `enum`, SCREAMING_SNAKE — the `BookingStatus`/`JobStatus` precedent):

`RECEIVED`, `WEIGHED`, `PRICED`, `AWAITING_PAYMENT`, `PAID`, `PROCESSING`, `READY`, `AWAITING_PICKUP`, `AWAITING_DELIVERY`, `COMPLETED`, `CANCELLED`, `REJECTED`, `LOST`, `DAMAGED`, `REFUNDED`

**`LaundryFulfillmentType`** (Postgres `enum`): `PICKUP`, `DELIVERY`.

**Complete transition matrix** — this table is the contract. `LaundryOrderStatusTransitionPolicy` is a direct, literal encoding of it; any edge not listed is illegal and `assertTransition` rejects it.

| From \\ legal `to` |
| --- |
| **`RECEIVED`** → `WEIGHED`, `REJECTED`, `CANCELLED` |
| **`WEIGHED`** → `PRICED`, `REJECTED`, `CANCELLED` |
| **`PRICED`** → `AWAITING_PAYMENT`, `PAID`, `CANCELLED` |
| **`AWAITING_PAYMENT`** → `PAID`, `CANCELLED` |
| **`PAID`** → `PROCESSING`, `REFUNDED` |
| **`PROCESSING`** → `READY`, `LOST`, `DAMAGED`, `REFUNDED` |
| **`READY`** → `AWAITING_PICKUP`, `AWAITING_DELIVERY`, `LOST`, `DAMAGED`, `REFUNDED` |
| **`AWAITING_PICKUP`** → `COMPLETED`, `LOST`, `DAMAGED`, `REFUNDED` |
| **`AWAITING_DELIVERY`** → `COMPLETED`, `LOST`, `DAMAGED`, `REFUNDED` |
| **`COMPLETED`** → `REFUNDED` |
| **`LOST`** → `REFUNDED` |
| **`DAMAGED`** → `REFUNDED` |
| **`CANCELLED`** → *(none — terminal)* |
| **`REJECTED`** → *(none — terminal)* |
| **`REFUNDED`** → *(none — terminal)* |

Notes that are part of the contract:

1. **Creation.** `receiveLaundryOrder` creates the order at `RECEIVED`. There is no prior state, so no `assertTransition` call — the `BookingStatus.PENDING`-at-create precedent.
2. **Branch constraint out of `READY`.** Both `READY → AWAITING_PICKUP` and `READY → AWAITING_DELIVERY` are matrix-legal, but the verb command additionally enforces `order.fulfillmentType` (§4.4): `markLaundryOrderAwaitingPickup` requires `PICKUP`, `markLaundryOrderAwaitingDelivery` requires `DELIVERY`. The matrix governs status legality; the command governs which branch this order may take.
3. **Prepaid gate.** `PROCESSING` is reachable only from `PAID`. There is no work-before-payment path in this ticket.
4. **Payment branches.** `PRICED → AWAITING_PAYMENT` (payment requested/deferred) and `PRICED → PAID` (paid immediately at drop-off) are both intentional. `AWAITING_PAYMENT → PAID` completes a deferred payment.
5. **`CANCELLED` is legal only *before payment is recorded*** — from `RECEIVED`, `WEIGHED`, `PRICED`, `AWAITING_PAYMENT`. It is **not** legal from `PAID`: once money has been collected, an order that is called off resolves through `REFUNDED`, not `CANCELLED`. This keeps `CANCELLED` unambiguously "called off before any money changed hands," and guarantees every `PAID` order still has a lifecycle path to `REFUNDED` (an earlier draft allowed `PAID → CANCELLED`, which — `CANCELLED` being terminal — stranded collected money with no resolution edge).
6. **`REJECTED`** is legal only at intake and weighing (`RECEIVED`, `WEIGHED`). Its business meaning: *the shop declines to proceed with the order before pricing* — including after weighing, during an intake inspection that reveals the order can't be taken on (unsuitable items, contamination, etc.). `REJECTED` = **refused at intake**; `CANCELLED` = **accepted, then called off before payment**. The two are not interchangeable, and both are pre-payment terminal outcomes.
7. **`LOST`** is legal from `PROCESSING` onward (the shop is actively handling garments). **`DAMAGED`** likewise. Both are semi-terminal: the only edge out is `→ REFUNDED`.
8. **`REFUNDED`** is legal from every state in which money has been collected: `PAID`, `PROCESSING`, `READY`, `AWAITING_PICKUP`, `AWAITING_DELIVERY`, `COMPLETED`, `LOST`, `DAMAGED`. It is terminal. `CANCELLED` (an order called off, pre-payment) and `REFUNDED` (money returned, post-payment) are disjoint outcomes.
   8a. **`REFUNDED` is *financial* resolution and does not imply an operational incident.** Reaching `REFUNDED` directly from `PAID`/`PROCESSING`/`READY`/`AWAITING_*`/`COMPLETED` is a normal path — a refund does **not** require a prior `LOST` or `DAMAGED`, and an implementer must not treat refunds as something that only follows an exceptional state.
9. **No self-edges.** The matrix contains no `X → X`. A re-weigh of a `WEIGHED` order is a state-preserving operation (§4.4), not a transition.
10. **Total function.** Every one of the 15 statuses is a key in the policy map (`CANCELLED`/`REJECTED`/`REFUNDED` map to the empty set; `COMPLETED`/`LOST`/`DAMAGED` map to `{REFUNDED}`), so `canTransition` never throws on an unknown key.

**Lifecycle invariants that follow mechanically from the matrix** (state these in the spec; do not re-derive them in code — they are properties of the table above):

- **Every order that reaches `PAID` has a lifecycle path to `REFUNDED`**, regardless of subsequent operational outcome (`PROCESSING`, `READY`, `AWAITING_*`, `COMPLETED`, `LOST`, `DAMAGED` all have a `→ REFUNDED` edge).
- **No order is ever both paid and cancelled** — `CANCELLED` is unreachable from `PAID` and every later state.
- **`CANCELLED` and `REJECTED` are pre-payment terminal outcomes; `REFUNDED` is the post-payment financial terminal outcome; `COMPLETED` is the successful terminal outcome (with a single post-hoc `→ REFUNDED` edge for a later dispute).**

**`LaundryOrderStatusTransitionPolicy` API:**

```
canTransition(from: LaundryOrderStatus, to: LaundryOrderStatus): boolean
assertTransition(from: LaundryOrderStatus, to: LaundryOrderStatus): void
  // throws BadRequestException(
  //   `Laundry order cannot transition from ${from} to ${to}`)
```

**Load-bearing invariant:** *Every code path that changes `LaundryOrder.status` — service method, resolver, seed, or test helper — MUST call `assertTransition(currentStatus, targetStatus)` immediately before applying the change, on the status value it just read inside the same transaction.* State-preserving operations that do not change `status` are exempt (they have nothing to assert).

### 4.4 Verb operations

Each row is one application command and one GraphQL mutation. All follow the §4.6 transaction/lock/audit pattern. `actorId` is always present (GraphQL-only surface, all mutations behind `AuthGuard`).

| Mutation | Command effect | Extra precondition | RBAC (proposed) | Audit action |
| --- | --- | --- | --- | --- |
| `receiveLaundryOrder(input)` | create order at `RECEIVED`; capture `customerId`, `fulfillmentType` | `CustomersService.getCustomer` must resolve | OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT | `laundry_order.received` |
| `weighLaundryOrder(input)` | if `RECEIVED`: transition `→ WEIGHED` and set `weightGrams`. If already `WEIGHED`: **state-preserving** — update `weightGrams` only, no transition | status ∈ {`RECEIVED`, `WEIGHED`}; `weightGrams` an integer ≥ 1 (Amendment #164 §8.4.1) | OWNER, OPS_MANAGER, SCHEDULER | `laundry_order.weighed` |
| `priceLaundryOrder(input)` | create every `LaundryOrderLine` with a frozen snapshot (§4.5); set `totalMinorUnits`; transition `WEIGHED → PRICED` | status = `WEIGHED`; exactly one `baseServiceId`; each target resolves via `resolveEffectivePricing` (else `BadRequestException`, full rollback) | OWNER, OPS_MANAGER, SCHEDULER | `laundry_order.priced` |
| `markLaundryOrderAwaitingPayment(input)` | transition `PRICED → AWAITING_PAYMENT` | — | OWNER, OPS_MANAGER, FINANCE, CUSTOMER_SUPPORT | `laundry_order.awaiting_payment` |
| `markLaundryOrderPaid(input)` | transition `PRICED \| AWAITING_PAYMENT → PAID` | — | OWNER, OPS_MANAGER, FINANCE, CUSTOMER_SUPPORT | `laundry_order.paid` |
| `startLaundryProcessing(input)` | transition `PAID → PROCESSING` | — | OWNER, OPS_MANAGER, SCHEDULER | `laundry_order.processing_started` |
| `markLaundryOrderReady(input)` | transition `PROCESSING → READY` | — | OWNER, OPS_MANAGER, SCHEDULER | `laundry_order.ready` |
| `markLaundryOrderAwaitingPickup(input)` | transition `READY → AWAITING_PICKUP` | `order.fulfillmentType = PICKUP` (else `BadRequestException`) | OWNER, OPS_MANAGER, SCHEDULER | `laundry_order.awaiting_pickup` |
| `markLaundryOrderAwaitingDelivery(input)` | transition `READY → AWAITING_DELIVERY` | `order.fulfillmentType = DELIVERY` | OWNER, OPS_MANAGER, SCHEDULER | `laundry_order.awaiting_delivery` |
| `completeLaundryOrder(input)` | transition `AWAITING_PICKUP \| AWAITING_DELIVERY → COMPLETED` | — | OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT | `laundry_order.completed` |
| `cancelLaundryOrder(input)` | transition `{RECEIVED, WEIGHED, PRICED, AWAITING_PAYMENT} → CANCELLED` (not legal from `PAID` — §4.3 n.5) | — | OWNER, OPS_MANAGER, CUSTOMER_SUPPORT | `laundry_order.cancelled` |
| `rejectLaundryOrder(input)` | transition `{RECEIVED, WEIGHED} → REJECTED` | — | OWNER, OPS_MANAGER | `laundry_order.rejected` |
| `markLaundryOrderLost(input)` | transition `{PROCESSING, READY, AWAITING_PICKUP, AWAITING_DELIVERY} → LOST` | — | OWNER, OPS_MANAGER | `laundry_order.lost` |
| `markLaundryOrderDamaged(input)` | transition `{PROCESSING, READY, AWAITING_PICKUP, AWAITING_DELIVERY} → DAMAGED` | — | OWNER, OPS_MANAGER | `laundry_order.damaged` |
| `refundLaundryOrder(input)` | transition `{PAID, PROCESSING, READY, AWAITING_PICKUP, AWAITING_DELIVERY, COMPLETED, LOST, DAMAGED} → REFUNDED` | — | OWNER, OPS_MANAGER, FINANCE | `laundry_order.refunded` |

`entityType` for every audit event is `laundry_order`; `entityId` is the order id; actions follow the `entity.verb` convention. The verb-specific action strings **supersede** the ticket's illustrative `laundry_order.status_changed` — an audit trail of business operations, not undifferentiated status writes.

The generic transition (`policy.assertTransition` + status write) is factored into one private `LaundryOrdersService` helper that every status-changing command calls; only that helper writes `status`. It is not exposed as a mutation.

The per-mutation RBAC sets above are a **proposal for M3 to ratify or adjust** — the role list is `OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT, FINANCE, ANALYST` (`ANALYST` read-only). Reads use the full six-role `VIEW_ROLES` set, matching every other module.

### 4.5 Pricing computation

`priceLaundryOrder` (status `WEIGHED` → `PRICED`) is the only operation that creates lines, and it runs exactly once per order:

1. Capture one `asOf = new Date()` at the start of the command.
2. Validate (shape only): exactly one `baseServiceId`, optional `baseQuantity`; each add-on input has an `addOnId` and optional `quantity`; every supplied quantity is an integer `≥ 1`; `order.weightGrams` is set. How each quantity is actually applied is step 3a.
3. For the base service and each add-on, call `resolveEffectivePricing({ serviceId } | { addOnId }, asOf)`. If any returns `null`, throw `BadRequestException(\`No effective price for …\`)` — the whole command rolls back, no line is created.

3a. **Per-line quantity resolution — one rule, applied identically to the base-service line and every add-on line.** The `unit` on the *resolved* `PricingRule` (never anything the client declares) decides which quantity a line is priced on:

| Resolved `unit` | Line `quantity` used and stored | The caller's `baseQuantity` / add-on `quantity` |
| --- | --- | --- |
| `PER_KG` | `order.weightGrams` (integer grams) — **always**; a supplied quantity **never** overrides it | ignored |
| `PER_ITEM` | the caller's `baseQuantity` (for the base line) or that add-on's `quantity` (for an add-on line); `1` if omitted | used |
| `FLAT` / `PER_SERVICE` | `1` | ignored |

A supplied quantity that ends up ignored is **not an error** — the client cannot know a target's resolved unit in advance (pricing is effective-dated and resolved server-side), so `priceLaundryOrder` silently disregards a `baseQuantity` on a `PER_KG` base service rather than rejecting the call. The only quantity validation is shape: any supplied value must be an integer `≥ 1` (§4.8). The snapshot's `quantity` is always the value in the "used and stored" column above — the canonical quantity the amount was actually computed from, never the raw client input when that differs.

4. For each resolved rule, compute the line via the pure function:

```
computeLaundryLineAmount({
  unit, rateMinorUnits, quantity, minimumChargeMinorUnits,
}): { amountMinorUnits: number; minimumChargeApplied: boolean }
```

- `quantity` fed in is the value resolved in step 3a — `order.weightGrams` (integer grams) for `PER_KG`, the caller's item count for `PER_ITEM`, `1` for `FLAT`/`PER_SERVICE` — and it is stored on the snapshot verbatim.
- `raw`:
  - `PER_KG` → `divideRoundHalfUp(quantity * rateMinorUnits, 1000)` — `quantity` is grams, so this is `grams × rate ÷ 1000`, i.e. kilograms × rate. This is the **only** branch that rounds; `quantity * rateMinorUnits` is an exact integer well inside `Number.MAX_SAFE_INTEGER` for any realistic input (≈ 10⁵ g × 10⁷ ≈ 10¹²). The `÷1000` happens **here only** — `quantity` on the stored snapshot stays the integer gram value.
  - `PER_ITEM` → `quantity * rateMinorUnits` (exact integer, no rounding).
  - `FLAT` / `PER_SERVICE` → `rateMinorUnits` (exact integer, no rounding).
- `floor = minimumChargeMinorUnits ?? 0`.
- `amountMinorUnits = Math.max(raw, floor)`.
- `minimumChargeApplied = raw < floor`.

`divideRoundHalfUp(numerator, denominator)` is a named, unit-tested integer-safe helper — half-up on the fractional part, for non-negative inputs. `Math.round` is **not** used as the monetary abstraction even where it would coincide: the business rule (half-up, then floor) is named and independently testable. An implementer must not "simplify" this to `quantity = weightGrams / 1000` — that would persist a fractional `quantity` and violate the integer-only schema (§4.2).

5. Insert every `LaundryOrderLine` with its frozen snapshot `{ rateMinorUnits, unit, quantity, amountMinorUnits, minimumChargeMinorUnits, minimumChargeApplied, pricingRuleId }` — `minimumChargeMinorUnits` copied verbatim from the resolved rule (or `null`), so the line is re-derivable without `PricingRule`.
6. Set `order.totalMinorUnits = Σ line.amountMinorUnits` — stored and frozen; a historical order retains exactly what was calculated. Never a resolver-computed sum.
7. Transition `WEIGHED → PRICED` (through the §4.3 helper) and emit `laundry_order.priced`.

After `PRICED`, `weightGrams`, every line, and `totalMinorUnits` are immutable. Correcting a mispriced order means cancelling it (legal from `PRICED`, before payment) and receiving a new one; after payment the correction path is `REFUNDED` (§4.3).

### 4.6 Transaction, concurrency, and audit

Every command:

```
return this.dataSource.transaction((manager) =>
  runAuditInTransaction(manager, async () => {
    const order = await manager.findOne(LaundryOrderEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },   // SELECT … FOR UPDATE
    });
    if (!order) throw new NotFoundException(...);
    // verb-specific precondition checks
    this.policy.assertTransition(order.status, targetStatus);  // status-changing verbs only
    await manager.update(LaundryOrderEntity, { id }, { status: targetStatus, /* … */ });
    await this.auditLogger.log({ actorId, action: 'laundry_order.<verb>',
                                entityType: 'laundry_order', entityId: id });
    return manager.findOneByOrFail(LaundryOrderEntity, { id });
  }),
);
```

The `pessimistic_write` lock is the concurrency mechanism: two mutations racing on the same order serialize on the row lock; the loser re-reads the winner's committed `status` and its `assertTransition` rejects if that status no longer permits the edge. The required **concurrent status-transition race** e2e (two real Postgres connections, `Promise.allSettled`, the `AdminsService.disable` race test as the shape) must cover **two cases**:

1. **Competing valid targets (load-bearing).** From one starting row at `PAID`, `T1` attempts `PAID → PROCESSING` and `T2` attempts `PAID → REFUNDED` — both individually legal. Assert: exactly one transaction commits; the order's final status is exactly that transaction's target; exactly one corresponding audit event exists; the loser fails with the transition-policy `BadRequestException` (its re-read sees a status from which its target is no longer legal).
2. **Same target.** Both transactions attempt `PAID → PROCESSING`. Assert: one commits, the loser's re-read sees `PROCESSING` and `assertTransition(PROCESSING, PROCESSING)` rejects (no self-edge); the order ends in `PROCESSING` with exactly one audit event.

Audit failures inside the transaction propagate and roll back the whole operation (the `runAuditInTransaction` contract).

### 4.7 GraphQL surface

- **Read** (`LaundryOrderReadResolver`, nestjs-query `ReadResolver` + `Relatable`, the `JobReadResolver` shape):
  - `laundryOrders: LaundryOrderConnection!` — root offset Connection, `{ nodes, pageInfo, totalCount }`, `paging` default `{ limit: 20 }`, max 100, default sort `createdAt DESC, id ASC`.
  - `laundryOrder(id: ID!): LaundryOrder` — single, nullable (the `job`/`customer` precedent).
  - `LaundryOrder.lines: LaundryOrderLineConnection!` — nested offset Connection, `{ nodes, pageInfo }` (no `totalCount`), `paging` default `{ limit: 20 }`, max 100, default sort `createdAt ASC, id ASC` (creation order).
- **Mutations** (`LaundryOrderMutationResolver`, a separate `@Resolver` class — the `JobResolver` split): the 15 verbs in §4.4, each `@UseGuards(AuthGuard)` + `@Roles(...)`, taking a single `input` and returning `LaundryOrderType`.
- **Types:** `LaundryOrderType`, `LaundryOrderLineType`, `LaundryOrderLinePricingSnapshotType` (all seven snapshot fields — `rateMinorUnits`, `unit`, `quantity`, `amountMinorUnits`, `minimumChargeMinorUnits`, `minimumChargeApplied`, `pricingRuleId` — exposed read-only); computed `customer` resolve-field via a batched loader (the `JobResolver.team` DataLoader precedent). `registerEnumType(LaundryOrderStatus, …)` and `registerEnumType(LaundryFulfillmentType, …)`.
- **Inputs:** `ReceiveLaundryOrderInput { customerId: ID!, fulfillmentType: LaundryFulfillmentType! }`, `WeighLaundryOrderInput { orderId: ID!, weightGrams: Int! }`, `PriceLaundryOrderInput { orderId: ID!, baseServiceId: ID!, baseQuantity: Int, addOns: [LaundryOrderAddOnInput!]! }`, `LaundryOrderAddOnInput { addOnId: ID!, quantity: Int }`, and a shared `LaundryOrderRefInput { orderId: ID! }` for the payload-free verbs. `baseQuantity` / `quantity` are honoured only for a line whose resolved `unit = PER_ITEM` (§4.5).
- **Allowlist regression:** `paginated-collections-allowlist.e2e-spec.ts` gains a `ROOT_CONNECTIONS` row (`laundryOrders` / `LaundryOrderConnection` / `LaundryOrderSortFields` / `['createdAt','id']`), a `NESTED_CONNECTIONS` row (`LaundryOrder.lines` / `LaundryOrderLineSortFields` / `['createdAt','id']`), and the generated-CRUD / generic-mutation-name checks must still pass (no `createOneLaundryOrder`, no `transitionLaundryOrderStatus`).

### 4.8 Validation invariants

- **Line target exclusivity** — `CHECK (num_nonnulls("serviceId","addOnId") = 1)` on `laundry_order_line_entity`, hand-added to the migration (TypeORM cannot express a multi-column check), plus an application pre-check for a clean `BadRequestException`. Mirrors #36 §4.7.
- **Exactly one base-service line** — `priceLaundryOrder` requires exactly one `baseServiceId`; enforced in the command (no DB constraint, since it is a per-order cardinality rule across rows).
- **`weightGrams`** — integer ≥ 1 (Amendment #164 §8.4.1); `null` only while status is `RECEIVED`; required for `priceLaundryOrder`.
- **`baseQuantity` / add-on `quantity` inputs** — integer `≥ 1` when provided; default 1; used only when that line's resolved `unit = PER_ITEM`, otherwise ignored (§4.5).
- **`minimumChargeMinorUnits`** — consumed as resolved from the `PricingRule` (#36 already validates it `≥ 0`), then **frozen into the line snapshot** (§4.2). This ticket adds the *application* semantics (§4.5) and the snapshot column.
- **Status / fulfillment / unit enums** — each a Postgres `enum` type (the `BookingStatus` mechanism). `LaundryOrderStatus` → `laundry_order_status_enum`; `LaundryFulfillmentType` → `laundry_fulfillment_type_enum`; the snapshot `unit` → a **module-local** `laundry_order_line_unit_enum` with the same four `PricingUnit` values (§4.10, §5) — *not* catalog's `pricing_rule_entity_unit_enum`. An out-of-range value is a driver error, not reachable through the typed GraphQL surface.
- **Transition legality** — `assertTransition` before every status write (§4.3). No status setter bypasses it.
- **`fulfillmentType` branch** — enforced by `markLaundryOrderAwaitingPickup` / `…AwaitingDelivery` against `order.fulfillmentType`.
- **Immutability post-`PRICED`** — no command mutates `weightGrams`, a line, or `totalMinorUnits` once the order is `PRICED`; there is simply no such operation.
- **FK policies** — `laundry_order.customerId` / line `serviceId` / line `addOnId`: `ON DELETE RESTRICT`. `laundry_order_line.laundryOrderId`: `ON DELETE CASCADE`. `pricingRuleId` has **no foreign key** — it is a soft traceability pointer only (§4.2, §5); the immutable snapshot, not the rule row, is authoritative.

### 4.9 Web — `/app/laundry`

> **Amended by #164 §8.4.4 (Accepted 2026-10-10).** The dedicated `/app/laundry/[id]` order page, the `?detail=` redirect, and the searchable intake picker replace this section’s single route, drawer, and 100-row customer `<select>`. The status-badge tones and the action-set rule below still apply.

One route, built entirely from `packages/ui` primitives and the `/app/*` shell (the `/app/:path*` middleware matcher already covers it):

- **List** — `DataTable` of orders: customer, `fulfillmentType`, status (`StatusBadge`, tones: `RECEIVED`/`WEIGHED`/`PRICED`/`AWAITING_PAYMENT` → neutral; `PAID`/`PROCESSING`/`READY`/`AWAITING_PICKUP`/`AWAITING_DELIVERY` → warning; `COMPLETED` → success; `CANCELLED`/`REJECTED`/`LOST`/`DAMAGED`/`REFUNDED` → danger), weight, total (`formatMinorUnits`), created. Offset pagination, `pageSize` 20, the `bookings/page.tsx` shape.
- **Intake** — `FormDialog`: customer `<select>` (from `useCustomersQuery`, `limit: 100`), `fulfillmentType` `<select>`. Calls `receiveLaundryOrder`.
- **Detail** — `DetailDrawer` (`?detail=<id>`): order header, `weightGrams`, `fulfillmentType`, status, `totalMinorUnits`, and the `lines` connection (service/add-on name, unit, quantity, rate, amount, `minimumChargeMinorUnits`, "min charge applied" flag).
- **Actions** — the drawer offers the buttons whose transition is `(matrix-legal from the current status)` **∩** `(the order-local branch predicate — only fulfillmentType, selecting pickup vs delivery out of READY)` **∩** `(the actor's role permits it)`. The client mirrors the §4.3 matrix and that one branch predicate **for presentation only**, as a small constant; it MUST NOT reimplement any other domain rule. The server is authoritative for every transition, precondition, and authorization check — a client that offers a button the server then rejects is a display bug, not a correctness bug. `weighLaundryOrder` / `priceLaundryOrder` open small forms; payload-free verbs fire directly; `cancel`/`reject`/`lost`/`damaged`/`refund` go through `ConfirmDialog` with explicit, non-euphemistic wording.
- **Nav** — a "Laundry" entry in the sidebar "Operations" group.

Frontend smoke tests cover list render + intake + one transition, at the depth of `bookings`/`jobs` page tests.

### 4.10 Migration

One additive migration, `…-CreateLaundryOrders.ts`. It **creates only laundry-owned objects** — it never creates, alters, or drops anything belonging to `modules/catalog` (in particular, it does **not** touch `pricing_rule_entity_unit_enum`, which is #36's, owned by the `ExtendPricingRuleEffectiveDating` migration).

**`up()` order:**

1. `CREATE TYPE` `laundry_order_status_enum` (15 values), `laundry_fulfillment_type_enum` (`PICKUP`, `DELIVERY`), and `laundry_order_line_unit_enum` (`PER_KG`, `PER_ITEM`, `FLAT`, `PER_SERVICE` — same values as `PricingUnit`, a **separate module-local type**; TypeORM's `@Column({ type: 'enum', enum: PricingUnit })` on the embeddable generates exactly this per-column type, so no cross-module coupling).
2. `laundry_order_entity` — `id uuid pk`, `customerId uuid not null` + FK `fk_laundry_order_customer` → `customer_entity` (`ON DELETE RESTRICT`), `fulfillmentType laundry_fulfillment_type_enum not null`, `status laundry_order_status_enum not null default 'RECEIVED'`, `weightGrams integer null`, `totalMinorUnits integer null`, `createdAt`/`updatedAt timestamptz`. Index on `customerId`, on `status`, and `(createdAt, id)` for the default sort.
3. `laundry_order_line_entity` — `id uuid pk`, `laundryOrderId uuid not null` + FK `fk_laundry_order_line_order` → `laundry_order_entity` (`ON DELETE CASCADE`), `serviceId uuid null` + FK → `service_entity` (`ON DELETE RESTRICT`), `addOnId uuid null` + FK → `add_on_entity` (`ON DELETE RESTRICT`), then the seven `pricingSnapshot…` columns: `pricingSnapshotRateMinorUnits integer not null`, `pricingSnapshotUnit laundry_order_line_unit_enum not null`, `pricingSnapshotQuantity integer not null`, `pricingSnapshotAmountMinorUnits integer not null`, `pricingSnapshotMinimumChargeMinorUnits integer null`, `pricingSnapshotMinimumChargeApplied boolean not null`, `pricingSnapshotPricingRuleId uuid null` (**no FK** — soft pointer, §4.2/§4.8), and `createdAt timestamptz`. `CHECK (num_nonnulls("serviceId","addOnId") = 1)` hand-added. Index on `laundryOrderId` and `(laundryOrderId, createdAt, id)` for the nested sort.

**`down()` order** (dependency-safe, explicit so an executor does not have to infer it): `DROP TABLE laundry_order_line_entity` → `DROP TABLE laundry_order_entity` → `DROP TYPE laundry_order_line_unit_enum` → `DROP TYPE laundry_fulfillment_type_enum` → `DROP TYPE laundry_order_status_enum`. No `pricing_rule_entity_unit_enum` drop — it is not this migration's to drop.

No backfill — both tables are new.

---

## 5. Rationale

- **A new `modules/laundry`, not an extension of `modules/bookings`.** A laundry order and a cleaning booking share almost nothing structurally: no property, a weight, priced *lines* rather than one snapshot, a 15-state checked lifecycle rather than a 4-value free enum, and a different set of dependent modules. Forcing both into one aggregate would make `Booking` carry a large mode-switch. The maximal-reuse precedent this codebase follows is *reuse the shared building blocks* (`Customer`, `Service`/`AddOn`, `PricingRule`, audit, pagination, UI primitives) — which this design does — not *reuse the aggregate*.
- **Payment and fulfillment states live in the single `LaundryOrderStatus` enum.** Issue #37 puts `AwaitingPayment/Paid` and `AwaitingPickup/AwaitingDelivery` directly in the lifecycle, and #38/#39/#42 are out of scope, so there is no `Invoice`/`Payment`/`Delivery` aggregate to hold them. Modelling them as operational status keeps one coherent timeline with one source of truth; when #38/#39/#42 land they attach records *to* these states without a lifecycle change. The alternative — a parallel `paymentState` field now — would fragment the very thing the transition guard exists to make coherent.
- **Verb-specific mutations, one transition policy.** The transition graph must have exactly one authoritative guard (`LaundryOrderStatusTransitionPolicy`) so rules are never duplicated across mutations. But the *public* API should not be a generic `transitionLaundryOrderStatus(orderId, toStatus)`: that makes every graph-valid-but-business-invalid request part of the API contract, gives clients arbitrary state-string manipulation, and leaves no natural home for per-operation preconditions (weight required, pricing computed), RBAC, or audit meaning. Verb mutations put authorization and audit on the *business operation*, give each transition a place to grow side effects later, and keep the guard centralized. This is the developer's explicit M2 decision.
- **The transition matrix is written out in full in the spec (§4.3), not left for the implementation to infer.** It is the executable contract for the policy, its table-driven tests, every mutation test, and the concurrency test. A phrase like "any post-payment state may be refunded" is not good enough — the exact source-state set for `REFUNDED` (and for every other edge) is enumerated so a reviewer and a test author never have to reconstruct intent.
- **`assertTransition` on status change, not on every mutation.** A re-weigh of a `WEIGHED` order is a legitimate correction that does not change status; forcing a `WEIGHED → WEIGHED` self-edge into the matrix just to satisfy "every verb calls the policy" would pollute the guard with non-transitions. The precise invariant — *every status change is preceded by `assertTransition` on the freshly-read status* — is strong enough and keeps the policy semantically clean.
- **`CANCELLED` is reachable only before payment is recorded.** An earlier draft allowed `PAID → CANCELLED`; since `CANCELLED` is terminal, that produced a paid order with no lifecycle path to `REFUNDED`, directly contradicting the reason `REFUNDED` exists. `CANCELLED` now means unambiguously "called off before any money changed hands"; once `PAID`, an order that is called off resolves through `REFUNDED`. This yields the clean invariant *every `PAID` order can always reach `REFUNDED`*, and keeps `CANCELLED`/`REJECTED` (pre-payment) and `REFUNDED` (post-payment) as disjoint terminal outcomes. Deferring "paid but cancelled" to #39 was rejected because #37 claims its lifecycle is a *complete* checked contract.
- **`REJECTED` is meaningful even after weighing.** The shop can take enough custody to weigh an order and still decline it during intake inspection (unsuitable/contaminated items). `REJECTED` = refused at intake; `CANCELLED` = accepted then called off. The spec states this distinction rather than leaving "why is `WEIGHED → REJECTED` legal?" to interpretation.
- **The pricing snapshot is fully self-contained.** It freezes `minimumChargeMinorUnits` alongside `rateMinorUnits`, `quantity`, and `unit`, so `amountMinorUnits` and `minimumChargeApplied` are re-derivable and auditable without ever reading `PricingRule`. `pricingRuleId` is a soft traceability pointer with **no foreign key** — #36 treats `PricingRule` as append-only history, but this module takes no referential dependency on it; the snapshot, not the rule, is authoritative for what was charged, and the pointer is allowed to dangle.
- **`quantity` stores the canonical input in the unit's integer representation** — grams for `PER_KG`, item count for `PER_ITEM`, `1` otherwise. The gram→kilogram (`÷1000`) conversion is confined to the amount calculation, so no fractional value is ever persisted and the integer-only-schema invariant holds for `quantity` too.
- **The snapshot `unit` uses a module-local Postgres enum**, not catalog's `pricing_rule_entity_unit_enum`. That type is a TypeORM-generated, table-scoped artifact owned by #36's migration; reusing it by name would couple laundry's schema and `down()` to catalog's internals and would fight TypeORM's own per-column enum generation. The `PricingUnit` *TypeScript* enum is the shared contract; the DB representation is each module's own.
- **Pessimistic row lock for the transition race.** `SELECT … FOR UPDATE` on the order row inside the transaction is the simplest mechanism that makes concurrent transitions serialize and re-check against committed state. The `AdminsService.disable` race already establishes two-connection concurrency testing in this codebase; there is no need for an advisory lock or an optimistic version column.
- **`asOf` = the pricing-command execution time.** The price a customer pays is the rate in effect when staff prices the order, resolved once and frozen — the same "snapshot at the operation, never re-read" discipline as `Booking.pricingSnapshot`. Using drop-off time instead would require persisting an intent-to-price separate from the priced lines, for no real benefit at this scale.
- **Minimum-charge floor applied *after* rounding, behind a named utility.** The minimum charge is a guarantee about the *printed* (rounded) price. Rounding first, then flooring, is what "the customer is never charged less than X" means operationally. `divideRoundHalfUp` is a named, directly-tested function rather than an inline `Math.round` so the monetary rule is explicit and cannot be silently changed by a future edit that "simplifies" the arithmetic. #36 deliberately left this decision to this ticket.
- **Customer-only order.** Nothing in #37 needs a property; laundry is a drop-off, not a site visit. #42 explicitly rejects reusing `PropertyEntity` for the delivery address. Adding a nullable `propertyId` now would be speculative.
- **`fulfillmentType` is *return* fulfillment, chosen at intake.** The `READY` branch needs a discriminator, and the customer states "I'll collect it" vs "deliver it back" when they drop off. It records only that stated preference — not how the order was received (always an in-person drop-off here) and not delivery logistics (routes/legs/addresses, which are #42). It is the one structural field #37's "fields needed to receive their eventual foreign keys" clause anticipates for #42.
- **A database FK is not a module dependency.** Stated explicitly (§4.1) so an M4 worker does not register `CustomerEntity`/`ServiceEntity`/`AddOnEntity` in `LaundryModule` on the strength of the schema-level foreign keys. And the pre-transaction `getCustomer` read is framed as an error-shape/UX choice with `fk_laundry_order_customer` as the actual check/write-race guard — more robust than resting on "Customer has no delete today," which a future ticket could invalidate.
- **`LOST`/`DAMAGED` semi-terminal.** The operational incident is a real terminal outcome that must remain visible in the status; but the customer is owed money, so a single `→ REFUNDED` edge is the honest financial resolution. Making them fully terminal would force the refund to be invisible until #39.
- **`totalMinorUnits` stored and frozen.** Consistent with the immutable per-line snapshots — a historical order must show exactly what was charged, not a sum recomputed against whatever the lines say later (they cannot change, but the discipline is the point).
- **Nested `lines` as an offset Connection, not a plain list.** The platform collection contract (root Connection / nested offset Connection) is enforced by an allowlist regression test; a one-off `[LaundryOrderLineType!]!` list would be the first exception and would fail that test's intent. Lines per order are few, but consistency wins.
- **The discovery report's absence is disclosed, not papered over.** Every reconstructed lifecycle edge is marked and was ratified by the project owner in M2; M3 review has the full matrix in front of it rather than an implementation that quietly invented edges.

---

## 6. Acceptance criteria (for this specification)

- The complete 15-state transition matrix (§4.3) is unambiguous: for every ordered pair of statuses it is decidable from the table alone whether the edge is legal, with no "any post-X state" phrasing left to interpret.
- Every reconstructed decision (RA-1 re-weigh as state-preserving; RA-2 dual payment branches; RA-3 prepaid gate; RA-4 `fulfillmentType` branch; RA-5 the exceptional-exit source sets; RA-6 `LOST`/`DAMAGED` semi-terminal) is recorded with its rationale and traceable to the M2 brainstorming decisions, not silently embedded.
- The lifecycle invariants (§4.3) — every `PAID` order can reach `REFUNDED`; no order is both paid and cancelled; `CANCELLED`/`REJECTED` are pre-payment terminal and `REFUNDED` is post-payment terminal — are stated and follow mechanically from the matrix, not re-derived in code.
- The pricing snapshot's field list (§4.2, including `minimumChargeMinorUnits`) is sufficient to reproduce and audit a line's price with **no read of `PricingRule`**; `pricingRuleId` has no foreign key.
- The `computeLaundryLineAmount` contract (§4.5) is precise enough to write the required unit tests without further design: `PER_KG` (grams × rate ÷ 1000) with half-up rounding then the floor; `PER_ITEM` count × rate; `FLAT`/`PER_SERVICE` flat rate; `minimumChargeApplied` true exactly when the floor beat the computed amount; a `0`-gram `PER_KG` order floored to the minimum; `quantity` persisted as an integer in every case.
- The per-line quantity-resolution rule (§4.5 step 3a) is unambiguous for every `unit`: `baseQuantity` / add-on `quantity` apply only to a line whose *resolved* rule is `PER_ITEM`; a `PER_KG` line is always priced on `order.weightGrams` and a supplied quantity there is silently ignored, not an error; the stored snapshot `quantity` is always the canonical value used in the calculation.
- The concurrency mechanism (§4.6 pessimistic write lock) is specified concretely enough for the e2e test, **including the competing-valid-target race (`PAID → PROCESSING` vs `PAID → REFUNDED`) as the load-bearing case** plus a same-target race.
- The GraphQL surface (§4.7) matches the existing pagination/connection conventions exactly, verifiable against `paginated-collections-allowlist.e2e-spec.ts`'s patterns, and adds no generated-CRUD or generic-transition mutation.
- No contradiction with the Accepted #36, Bookings, or Jobs specifications: `resolveEffectivePricing`, `getActivePricing`, `PricingRuleEntity` (including its `pricing_rule_entity_unit_enum`, untouched by the laundry migration), `BookingStatus`, `JobStatus`, and the legacy `active` pricing mechanism are all consumed unchanged.
- The "no floating-point column" and "integer minor units / integer grams" invariants are stated for every column both new tables introduce.
- The per-mutation RBAC proposal (§4.4) is explicit enough for M3 to ratify or amend without re-deriving it.

---

## 7. Non-goals

- `Invoice`, `InvoiceLine`, `Payment`, `Promotion`, `Delivery`, `Loyalty`, or any structural foreign key to them — #38–#45. `LaundryOrder` carries only the operational payment/fulfillment *states* its own lifecycle needs.
- Item/tag/bag-level garment tracking — a named extension point.
- A generic `transitionLaundryOrderStatus` mutation on the public schema; a REST surface for laundry; a `propertyId` on the order.
- Re-pricing, snapshot mutation, or any post-`PRICED` recomputation of a line, weight, or total.
- A foreign key from a line to `pricing_rule_entity` — `pricingRuleId` is a soft pointer only (§4.2, §5).
- Any change to `Booking`/`Job`/`PricingRule` contracts, the legacy `active` pricing path, `resolveEffectivePricing`'s signature, or catalog's `pricing_rule_entity_unit_enum`.
- Multi-currency; tiered/banded pricing; a scheduled-pricing promotion mechanism; a laundry-vs-cleaning catalog flag.
- Work-before-payment (`AWAITING_PAYMENT → PROCESSING`); cancellation once an order is `PAID` (replaced by the `REFUNDED` path); cancellation after processing begins; a direct `READY → COMPLETED` edge — all considered and declined in M2/M3 (§5, §4.3).
- Implementation sequencing, task breakdown, and the TDD plan — M4.

---

## 8. Amendment #164 — Focused order workspace

| Field | Value |
| --- | --- |
| **Status** | **Accepted** — 2026-10-10 (M3). §8.4.1 and §8.4.2 explicitly confirmed by the owner. |
| **Date** | 2026-10-10 |
| **Tracking** | [#164](https://github.com/rexescario-dev/clensy-platform/issues/164), under [#154](https://github.com/rexescario-dev/clensy-platform/issues/154) |
| **Kind** | Slice-local amendment of this architecture RFC. Not a second specification. |
| **Depends on** | This specification (Accepted 2026-09-06). [Laundry invoices](2026-09-06-laundry-invoices-design.md) (Accepted) for the frozen `InvoiceLine.description` precedent and for the rule that generation does not settle the invoice. |

### 8.1 Question and thesis

**Question:** The Accepted web contract (§4.9) puts intake, weighing, pricing, invoicing, and lifecycle actions in one list page and a `?detail=` drawer. The agreed workspace is a list, a creation modal, and a dedicated order page, including several temporary weight entries that still persist as one `weightGrams`. Which of those changes are presentation only, and which ones alter validation or stored data?

**Thesis:** The lifecycle matrix, verb RBAC, pricing formula, prepaid-processing rule, and post-`PRICED` immutability stay as Accepted. The web end state replaces the drawer. Two owner recommendations change the contract if, and only if, M3 confirms them: `weighLaundryOrder` rejects a zero weight, and each priced line freezes the catalog name in a new snapshot field. Neither is implemented, and no migration is written, before that confirmation.

### 8.2 What this amendment changes, and what it does not

On acceptance, the sentences in §8.4 replace the cited Accepted sentences. They do not replace anything else.

Unchanged, and still Accepted whether or not this amendment is accepted:

- The §4.3 matrix, including no self-edges. Re-weigh of a `WEIGHED` order remains a state-preserving update of `weightGrams`.
- §4.4 RBAC and every verb precondition other than the `weightGrams` precondition on `weighLaundryOrder`. `priceLaundryOrder` keeps its Accepted inputs and preconditions, including how it handles a repeated `addOnId` (§8.4.3).
- §4.5 amount calculation, quantity resolution, and post-`PRICED` immutability of weight, lines, and `totalMinorUnits`.
- `computeLaundryLineAmount` still defines the 0-gram `PER_KG` case (Accepted §6). If §8.4.1 is accepted, that case is no longer reachable through `weighLaundryOrder`. The pure function’s definition does not change.
- Invoice generation, `paymentStatus: UNPAID` at generation, and the absence of a payment-recording mutation. Recording money against an invoice stays [#39](https://github.com/rexescario-dev/clensy-platform/issues/39).
- No bag, basket, or batch table. Several weight-entry rows are client input only. They are summed to one integer `weightGrams` and are not persisted.
- No audit-event read API. The order page may show `createdAt`, `updatedAt`, and current status. It must not present that as an event history.
- No inline customer creation in the intake modal.
- No second pricing implementation. A preview, if accepted, calls the same `resolveEffectivePricing` and `computeLaundryLineAmount` path and writes nothing.

### 8.3 Schema finding for line names

Investigated against the current model. No name is stored on a laundry line.

`LaundryOrderLinePricingSnapshot` and `LaundryOrderLinePricingSnapshotEmbeddable` persist only `rateMinorUnits`, `unit`, `quantity`, `amountMinorUnits`, `minimumChargeMinorUnits`, `minimumChargeApplied`, and `pricingRuleId`. `LaundryOrderLine` also stores `serviceId` or `addOnId`, foreign keys to the live catalog row (`ON DELETE RESTRICT`). Those ids keep the row from being deleted. They do not keep the name. A later rename of `Service.name` or `AddOn.name` changes any label read from the catalog.

`InvoiceLine.description` is the existing frozen-name pattern: a string copied at invoice generation (`Service.name`, or `AddOn.name + " (add-on)"`), with no foreign key back to the catalog. That string is not on the laundry line, so an invoice cannot be used as the order page’s source before an invoice exists, and it is not created until generation.

A frozen name on the order line therefore needs a new column. This amendment does not add that column. M3 acceptance of §8.4.2 is the approval to plan an additive migration. Existing rows cannot be repaired to the name that was current at pricing time, because that name was never stored. A backfill can only copy the catalog name at migration time, and must say so. The owner chose that backfill (§8.4.2).

M3 confirmed the column, so the live-label fallback is not used. Invoice descriptions stay frozen as before.

### 8.4 Replacements

These are the only normative changes. They are in force since M3 accepted this amendment on 2026-10-10. The owner explicitly confirmed §8.4.1 and §8.4.2. The other bullets were accepted with the amendment as a whole.

#### 8.4.1 Positive weight — confirmed

Replace §4.2 `weightGrams` note “thereafter a non-negative integer (0 permitted)” and the §4.4 / §4.8 precondition “non-negative integer”.

Contract: `weightGrams` is `null` until the order is weighed, and thereafter an integer **≥ 1**. `weighLaundryOrder` rejects `0` and any negative or non-integer with `BadRequestException`. `WeighLaundryOrderInput.weightGrams` uses that same minimum. The UI rejects blank, non-numeric, zero, and negative entries and must not be the only check.

Confirmed by the owner at M3 (2026-10-10): every order that leaves `RECEIVED` has a positive measured weight. Orders already stored with `weightGrams = 0` are not rewritten; the rule applies to `weighLaundryOrder` calls from acceptance on.

#### 8.4.2 Frozen line description — confirmed

Add one field to `LaundryOrderLinePricingSnapshot`:

| Field | Type | Notes |
| --- | --- | --- |
| `description` | `string` | The catalog name copied once at `priceLaundryOrder`. Base service: `Service.name`. Add-on: `AddOn.name + " (add-on)"`, the same string [#38](https://github.com/rexescario-dev/clensy-platform/issues/38) freezes onto `InvoiceLine.description`. Not a foreign key. A later catalog rename does not change it. |

`priceLaundryOrder` copies it inside the same transaction that inserts the line. If the catalog row cannot be read, the command fails and rolls back, matching invoice generation’s missing-name guard. The order page and the price preview show this frozen string after pricing. They do not re-read `Service.name` / `AddOn.name` for a priced line.

Persistence is an additive column on `laundry_order_line_entity` (proposed name `pricingSnapshotDescription`, `text not null`). The migration backfills every existing line with the catalog name current **at migration time**, using the same string rule (`Service.name`, or `AddOn.name + " (add-on)"`), then enforces `not null`. A backfilled value is the name at migration, not the name at pricing (§8.3). The migration must say so in a comment. The snapshot's GraphQL type exposes `description`. Pricing amounts and authorization do not change.

The migration is planned in M4 and authored in M6. Applying it to staging or production follows the project's established manual schema-change process.

Preview of a not-yet-priced order always uses the current catalog name, because nothing has been frozen yet.

#### 8.4.3 Repeated add-ons — no change

This amendment does not change how `priceLaundryOrder` treats a repeated `addOnId`. The Accepted §4.4 and §4.8 preconditions stand: the server prices each `addOns` entry as its own line, as it does today. The preview in §8.4.5 does the same, so an estimate never disagrees with the committed price. The order page may offer each add-on once in its picker. That is presentation only. It is not a server rule and must not be described as one. A server-side rejection of repeated add-ons is deferred (§8.6) until a product decision explicitly authorizes changing pricing behavior.

#### 8.4.4 Web end state

Replace §4.9’s “one route” and “Detail — `DetailDrawer` (`?detail=<id>`)” as the primary detail experience. Also replace the intake control that is a customer `<select>` limited to 100 rows.

End state:

- `/app/laundry` is the list: server-side filter on customer name, status, and fulfillment type; sort on the existing `LaundryOrderSortFields`; human-readable status and fulfillment labels; `formatMinorUnits` for money; kilograms rendered from integer grams; offset page size 20; a row opens `/app/laundry/[id]`.
- Intake stays a `FormDialog` on the list. Customer selection can reach any customer the customers query returns, not only the first 100. Fulfillment is `PICKUP` (customer pickup) or `DELIVERY`, chosen at intake and immutable. The form says that the choice is fixed and that delivery does not schedule a route. Creating a customer inline is out of scope. Success opens `/app/laundry/[id]` for the new order.
- `/app/laundry/[id]` is the order workspace: back link to the list, customer, order id, fulfillment, status, progress through the §4.3 happy path (the `AWAITING_PAYMENT` branch is shown when that is the status, not as a required step), summary, weighing, services, price, invoice, and lifecycle actions. `AWAITING_PICKUP` and `AWAITING_DELIVERY` stay mutually exclusive by `fulfillmentType`.
- `/app/laundry?detail=<id>` redirects to `/app/laundry/[id]`, so existing links keep working. The `DetailDrawer` is not the primary detail experience; it is removed once the order page is verified.
- Weighing UI may show multiple temporary rows. The client sums them, in whole grams, at most three decimal places of kilograms, and submits one `weightGrams`. The server remains authoritative. Re-weigh stays legal only in `RECEIVED` and `WEIGHED`.
- Services follow §4.5 step 3a. A `PER_KG` line shows weight and no item quantity. A `PER_ITEM` line shows an item count. `FLAT` / `PER_SERVICE` show no quantity. The client does not compute the amount.
- Before `priceLaundryOrder`, displayed amounts are an estimate from §8.4.5. Confirming price is `priceLaundryOrder`, once. After `PRICED`, the page shows the frozen snapshot, not a new estimate.
- Invoice generation stays the Accepted `generateInvoiceFromOrder` rules. Marking the order `PAID` or `AWAITING_PAYMENT` is a laundry lifecycle verb. Neither action records an invoice payment. `PROCESSING` remains reachable only from `PAID`.
- Action buttons are the §4.3 matrix intersected with the fulfillment branch and the actor’s §4.4 role. `cancel`, `reject`, `lost`, `damaged`, and `refund` require an explicit confirmation. The client mirror is presentation only.

§4.9’s status-badge tones stay as Accepted.

#### 8.4.5 Price preview

Add a read, not a mutation:

`previewLaundryOrderPrice(input: PriceLaundryOrderInput!): LaundryPricePreview!`

- Same input and same quantity-resolution and amount rules as `priceLaundryOrder` (§4.5), including ignoring a quantity unless the resolved unit is `PER_ITEM`.
- Allowed only when status is `WEIGHED` and `weightGrams` is set. Otherwise `BadRequestException`.
- Does not insert lines, change status, set `totalMinorUnits`, emit `laundry_order.priced`, generate an invoice, or mark an order paid.
- Authorization matches `priceLaundryOrder` (TENANT_OWNER, OPS_MANAGER, SCHEDULER).
- Each returned line includes the current catalog name (§8.4.2’s string rule), `unit`, canonical `quantity`, `rateMinorUnits`, `amountMinorUnits`, `minimumChargeMinorUnits`, and `minimumChargeApplied`, plus the estimated total (sum of line amounts). The result is an estimate. The committed total remains `LaundryOrder.totalMinorUnits` after pricing.
- A repeated `addOnId` is handled exactly as `priceLaundryOrder` handles it (§8.4.3). The preview adds no precondition of its own.

This read does not expose `PricingRule.unit` on the catalog `PricingRule` type. The preview payload carries the unit for that quote only.

### 8.5 Acceptance criteria for this amendment

M3 may accept the amendment only when all of the following are true:

- A reviewer can see, from §8.2 and §8.4 alone, which Accepted sentences change and which do not.
- §8.4.1 is either explicitly confirmed or explicitly declined. Silence is not acceptance of a zero-weight change.
- §8.4.2 is either explicitly confirmed, including approval to plan the additive column, or explicitly declined in favor of live catalog labels. Silence is not approval to migrate.
- The preview (§8.4.5) is specified as a non-write, and it uses the existing amount function rather than a second formula.
- Temporary weight rows are specified as not persisted.
- No task breakdown or implementation sequence is required to understand the contract.

### 8.6 Deferrals

- Inline customer creation.
- An audit-event query, and any timeline that would require one.
- Recording invoice payments ([#39](https://github.com/rexescario-dev/clensy-platform/issues/39)).
- Persisted per-bag weights.
- Editing a price after `PRICED`.
- Rejecting a repeated `addOnId` on `priceLaundryOrder` (§8.4.3). This needs its own product decision, because it changes Accepted pricing behavior.
- Implementation planning (M4) and any code or migration (M6) follow this acceptance through the workflow. M3 acceptance is not itself a code or schema change.
