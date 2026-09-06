# Laundry Orders & Operational Lifecycle — Specification

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Kind** | Architecture RFC (product behavior/contracts for this slice, not a process specification) |
| **Date** | 2026-09-06 |
| **Tracking** | [#37](https://github.com/rexescario-dev/clensy-platform/issues/37) — milestone M11 (Laundry Orders & Lifecycle); first ticket of the Laundry epic after the #36 prerequisite |
| **Depends on (informative)** | [Laundry Architecture & Catalog Foundation](2026-09-06-laundry-catalog-foundation-design.md) (Accepted) — `PricingRulesService.resolveEffectivePricing(target, asOf)` is consumed directly as a stable injected-service call; `PricingUnit` (`PER_KG \| PER_ITEM \| FLAT \| PER_SERVICE`), the integer-minor-units money convention, and the integer-grams weight convention are all reused verbatim. This specification defines the first `minimumChargeMinorUnits` *calculation* semantics — #36 §4.2/§4.7/§5 explicitly deferred them to this ticket. [Bookings](2026-08-22-bookings-design.md) (Accepted) — `BookingPricingSnapshotEmbeddable`'s `@Column(() => …, { prefix: false })` embedded-value pattern and the "snapshot frozen at creation, never re-read" discipline are copied for `LaundryOrderLine`; `BookingStatus`'s Postgres-`enum` column mechanism is reused. [Jobs & Checklists](2026-08-27-jobs-checklists-design.md) (Accepted) — the `dataSource.transaction` + `runAuditInTransaction` write pattern, the nestjs-query `ReadResolver` / separate `@Resolver` mutation-class split, the nested-offset-connection shape (`Checklist.items`), and the constraint-scoped unique-violation → `ConflictException` helper are all reused. [Admin Foundation](2026-08-14-admin-foundation-design.md) (Accepted) — `AuthGuard`, `@Roles()`, `@CurrentUser()`, `AuditLogger` port + `runAuditInTransaction`, consumed as-is. [Customers & Properties](2026-08-15-customers-properties-design.md) (Accepted) — `CustomersService.getCustomer` read contract; `CustomerEntity` reused as the order's only party reference. [Dashboard UX Foundation](2026-08-17-dashboard-ux-foundation-design.md) (Accepted) — `packages/ui` primitives (`DataTable`, `DetailDrawer`, `StatusBadge`, `FormDialog`, `ConfirmDialog`, `PageHeader`), the `/app/*` shell, the `?detail=` drawer convention, and the `/app/:path*` middleware matcher, consumed as-is. [Paginated nestjs-query GraphQL collections](2026-08-28-paginated-graphql-collections-design.md) (Accepted) — the root-Connection (`totalCount`, default 20, max 100) / nested-offset-connection (no `totalCount`) contract and the `paginated-collections-allowlist.e2e-spec.ts` regression pattern. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M2 |
| **Source-material note** | Issue #37 (and #38–#45) cite a "Laundry Module Discovery report, §7/§8/§15/§19" as an architecture reference. That document does not exist as a retrievable artifact — it is absent from the repository (all branches, full history, deleted files, stashes), the ContextForge runtime tree, the GitHub wiki (never created), gists, and issue comments. Per the developer's instruction, this specification is reconstructed from the #37 ticket body, the Accepted #36 specification, and existing repository patterns; every lifecycle edge not literally present in the ticket text was resolved interactively with the project owner during M2 brainstorming (recorded as ratified decisions in §4.3 and §5). #36 followed the same interactive-resolution pattern for the same reason. |
| **Revision note** | M3 round 1 (reviewer: project owner) returned the draft for four required corrections plus six precision items, not a redesign. Required: (1) `PAID → CANCELLED` removed — since `CANCELLED` is terminal it created a paid order with no path to `REFUNDED`, contradicting `REFUNDED`'s reason for existing; cancellation is now reachable only before payment is recorded, and every `PAID` order retains a path to `REFUNDED` (§4.3, §4.4, §5). (2) `minimumChargeMinorUnits` is now frozen into the per-line pricing snapshot, so a historical line is fully self-contained and re-derivable without reading `PricingRule` (§4.2, §4.5, §4.7, §4.10); `pricingRuleId` is demoted to a soft traceability pointer with no foreign key. (3) The snapshot's `quantity` is stated explicitly to store the canonical input in the unit's integer representation — grams for `PER_KG` — with the `÷1000` kilogram conversion confined to the amount calculation so no fractional value is ever persisted (§3, §4.2, §4.5). (4) The web action set is defined as `matrix-legal ∩ order-local branch predicate (fulfillmentType) ∩ actor RBAC`, with the server authoritative (§4.9). Precision items folded in: `WEIGHED → REJECTED`'s business meaning stated (§4.3 n.6); `REFUNDED` explicitly does not imply `LOST`/`DAMAGED` (§4.3 n.8a); the pre-transaction `getCustomer` read reframed as an error-shape choice with the FK as the correctness mechanism (§4.1); the `unit` Postgres enum is module-local (`laundry_order_line_unit_enum`), not a reuse of catalog's TypeORM-generated `pricing_rule_entity_unit_enum` (§4.10, §5); the concurrency acceptance test now requires a competing-valid-target race as the load-bearing case (§4.6, §6); `fulfillmentType` clarified as *return* fulfillment, not intake logistics (§3, §4.2). |
| **M3 decision** | **Accepted** — 2026-09-06. M3 round 1's four required corrections and six precision items all verified present and consistent across the matrix (§4.3), the verb table (§4.4), pricing (§4.5), validation (§4.8), the migration (§4.10), and rationale (§5) — not merely asserted. Round 2 raised one final verification item — the `baseQuantity` × `unit` interaction — resolved by adding §4.5 step 3a: one quantity-resolution rule applied identically to the base-service line and every add-on line, keyed on the *resolved* `PricingRule.unit`, where `PER_KG` always prices on `order.weightGrams` and a supplied quantity there is silently ignored (not rejected, because the client cannot know the resolved unit in advance), `PER_ITEM` uses the caller's quantity, `FLAT`/`PER_SERVICE` use `1`, and the stored snapshot `quantity` is always the canonical value the amount was computed from. No remaining design blocker; no further design fork. Ready for M4 Implementation Planning. |

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
- **Web:** `/app/laundry` — order list (`DataTable` + `StatusBadge`), order detail (`DetailDrawer` showing lines, per-line snapshot, and order total), an intake form (`FormDialog`: customer select + fulfillment type), and per-order action controls that offer exactly the transitions legal from the order's current status (destructive/financial ones behind `ConfirmDialog`). A nav entry under the existing "Operations" group. Built only from existing `packages/ui` primitives — no new list/detail component.
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
| `weightGrams` | `number \| null` | `null` until the order is weighed; thereafter a non-negative integer (0 permitted). Locked once the order is `PRICED` |
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
| `weighLaundryOrder(input)` | if `RECEIVED`: transition `→ WEIGHED` and set `weightGrams`. If already `WEIGHED`: **state-preserving** — update `weightGrams` only, no transition | status ∈ {`RECEIVED`, `WEIGHED`}; `weightGrams` a non-negative integer | OWNER, OPS_MANAGER, SCHEDULER | `laundry_order.weighed` |
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
- **`weightGrams`** — non-negative integer; `null` only while status is `RECEIVED`; required for `priceLaundryOrder`.
- **`baseQuantity` / add-on `quantity` inputs** — integer `≥ 1` when provided; default 1; used only when that line's resolved `unit = PER_ITEM`, otherwise ignored (§4.5).
- **`minimumChargeMinorUnits`** — consumed as resolved from the `PricingRule` (#36 already validates it `≥ 0`), then **frozen into the line snapshot** (§4.2). This ticket adds the *application* semantics (§4.5) and the snapshot column.
- **Status / fulfillment / unit enums** — each a Postgres `enum` type (the `BookingStatus` mechanism). `LaundryOrderStatus` → `laundry_order_status_enum`; `LaundryFulfillmentType` → `laundry_fulfillment_type_enum`; the snapshot `unit` → a **module-local** `laundry_order_line_unit_enum` with the same four `PricingUnit` values (§4.10, §5) — *not* catalog's `pricing_rule_entity_unit_enum`. An out-of-range value is a driver error, not reachable through the typed GraphQL surface.
- **Transition legality** — `assertTransition` before every status write (§4.3). No status setter bypasses it.
- **`fulfillmentType` branch** — enforced by `markLaundryOrderAwaitingPickup` / `…AwaitingDelivery` against `order.fulfillmentType`.
- **Immutability post-`PRICED`** — no command mutates `weightGrams`, a line, or `totalMinorUnits` once the order is `PRICED`; there is simply no such operation.
- **FK policies** — `laundry_order.customerId` / line `serviceId` / line `addOnId`: `ON DELETE RESTRICT`. `laundry_order_line.laundryOrderId`: `ON DELETE CASCADE`. `pricingRuleId` has **no foreign key** — it is a soft traceability pointer only (§4.2, §5); the immutable snapshot, not the rule row, is authoritative.

### 4.9 Web — `/app/laundry`

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
