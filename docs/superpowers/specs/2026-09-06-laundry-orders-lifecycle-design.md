# Laundry Orders & Operational Lifecycle — Specification

| Field | Value |
| --- | --- |
| **Status** | Draft |
| **Kind** | Architecture RFC (product behavior/contracts for this slice, not a process specification) |
| **Date** | 2026-09-06 |
| **Tracking** | [#37](https://github.com/rexescario-dev/clensy-platform/issues/37) — milestone M11 (Laundry Orders & Lifecycle); first ticket of the Laundry epic after the #36 prerequisite |
| **Depends on (informative)** | [Laundry Architecture & Catalog Foundation](2026-09-06-laundry-catalog-foundation-design.md) (Accepted) — `PricingRulesService.resolveEffectivePricing(target, asOf)` is consumed directly as a stable injected-service call; `PricingUnit` (`PER_KG \| PER_ITEM \| FLAT \| PER_SERVICE`), the integer-minor-units money convention, and the integer-grams weight convention are all reused verbatim. This specification defines the first `minimumChargeMinorUnits` *calculation* semantics — #36 §4.2/§4.7/§5 explicitly deferred them to this ticket. [Bookings](2026-08-22-bookings-design.md) (Accepted) — `BookingPricingSnapshotEmbeddable`'s `@Column(() => …, { prefix: false })` embedded-value pattern and the "snapshot frozen at creation, never re-read" discipline are copied for `LaundryOrderLine`; `BookingStatus`'s Postgres-`enum` column mechanism is reused. [Jobs & Checklists](2026-08-27-jobs-checklists-design.md) (Accepted) — the `dataSource.transaction` + `runAuditInTransaction` write pattern, the nestjs-query `ReadResolver` / separate `@Resolver` mutation-class split, the nested-offset-connection shape (`Checklist.items`), and the constraint-scoped unique-violation → `ConflictException` helper are all reused. [Admin Foundation](2026-08-14-admin-foundation-design.md) (Accepted) — `AuthGuard`, `@Roles()`, `@CurrentUser()`, `AuditLogger` port + `runAuditInTransaction`, consumed as-is. [Customers & Properties](2026-08-15-customers-properties-design.md) (Accepted) — `CustomersService.getCustomer` read contract; `CustomerEntity` reused as the order's only party reference. [Dashboard UX Foundation](2026-08-17-dashboard-ux-foundation-design.md) (Accepted) — `packages/ui` primitives (`DataTable`, `DetailDrawer`, `StatusBadge`, `FormDialog`, `ConfirmDialog`, `PageHeader`), the `/app/*` shell, the `?detail=` drawer convention, and the `/app/:path*` middleware matcher, consumed as-is. [Paginated nestjs-query GraphQL collections](2026-08-28-paginated-graphql-collections-design.md) (Accepted) — the root-Connection (`totalCount`, default 20, max 100) / nested-offset-connection (no `totalCount`) contract and the `paginated-collections-allowlist.e2e-spec.ts` regression pattern. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M2 |
| **Source-material note** | Issue #37 (and #38–#45) cite a "Laundry Module Discovery report, §7/§8/§15/§19" as an architecture reference. That document does not exist as a retrievable artifact — it is absent from the repository (all branches, full history, deleted files, stashes), the ContextForge runtime tree, the GitHub wiki (never created), gists, and issue comments. Per the developer's instruction, this specification is reconstructed from the #37 ticket body, the Accepted #36 specification, and existing repository patterns; every lifecycle edge not literally present in the ticket text was resolved interactively with the project owner during M2 brainstorming (recorded as ratified decisions in §4.3 and §5). #36 followed the same interactive-resolution pattern for the same reason. |

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

- **`LaundryOrder`** — the `modules/laundry` aggregate representing one customer drop-off: who the customer is, how it will be returned (`fulfillmentType`), its measured weight, its priced lines, its lifecycle status, and its frozen total.
- **`LaundryOrderLine`** — one row per priced item on an order: exactly one of a base `Service` (via `serviceId`) or an `AddOn` (via `addOnId`), plus an embedded immutable pricing snapshot. Mirrors `PricingRule`'s own one-of-two-targets shape.
- **Base-service line** — the single `LaundryOrderLine` whose `serviceId` is set. Every priced order has exactly one.
- **Add-on line** — a `LaundryOrderLine` whose `addOnId` is set. An order has zero or more.
- **Pricing snapshot** — a `LaundryOrderLine`-owned value object (`{ rateMinorUnits, unit, quantity, amountMinorUnits, minimumChargeApplied, pricingRuleId }`) captured once when the line is created and never recomputed — the same guarantee as `Booking.pricingSnapshot`. Not an independently addressable entity.
- **Effective-dated resolution** — #36's `PricingRulesService.resolveEffectivePricing(target, asOf)`: the one `PricingRule` row for a `Service`/`AddOn` whose `[effectiveFrom, effectiveTo)` interval covers `asOf`, or `null`.
- **`asOf`** — the single timestamp captured at the start of the `priceLaundryOrder` command and used for every line's `resolveEffectivePricing` call in that command. One notion of "now" per pricing operation (mirrors #36's `operationNow`).
- **Transition matrix** — the total function `LaundryOrderStatus → Set<LaundryOrderStatus>` in §4.3 defining every legal status edge. The executable contract for `LaundryOrderStatusTransitionPolicy`, its table-driven tests, the mutation tests, and the concurrency test.
- **`LaundryOrderStatusTransitionPolicy`** — the single domain object that owns the matrix. `canTransition(from, to): boolean`; `assertTransition(from, to): void` (throws `BadRequestException` on an illegal edge). No status write anywhere happens without `assertTransition` first.
- **Status transition** vs **state-preserving operation** — a *transition* changes `LaundryOrder.status` and must pass `assertTransition`. A *state-preserving operation* (a re-weigh of an already-`WEIGHED`, not-yet-`PRICED` order) runs through the same service/transaction/audit boundary but does not change `status` and does not consult the policy. The matrix contains no self-edges.
- **`fulfillmentType`** — `PICKUP | DELIVERY`, chosen at intake, immutable, selecting which branch (`AWAITING_PICKUP` vs `AWAITING_DELIVERY`) is legal out of `READY`.
- **Exceptional exit** — a transition to `REJECTED`, `CANCELLED`, `LOST`, `DAMAGED`, or `REFUNDED`. Each is an explicit matrix edge with defined source states — never generic error handling.
- **Terminal state** — a status with no outbound matrix edges: `COMPLETED`, `CANCELLED`, `REJECTED`, `REFUNDED`.
- **Semi-terminal state** — `LOST` and `DAMAGED`: the operational incident is terminal, but a single financial-resolution edge to `REFUNDED` remains.
- **Minimum-charge floor** — `minimumChargeMinorUnits` from the resolved `PricingRule`, applied to a line's computed amount **after rounding** (§4.5). `minimumChargeApplied` records whether the floor determined the final amount.

---

## 4. Domain and behavioral contracts

### 4.1 Module placement and cross-module rules

`modules/laundry` follows the established layering. `LaundryOrdersService` (application) reads other modules only through their exported application services:

- `CustomersService.getCustomer(id)` — existence check for the order's `customerId` at intake. Runs **before** the transaction opens (it takes no `EntityManager`), exactly as `BookingsService` does; sound because `Customer` has no delete operation that could invalidate the reference between the check and the write.
- `PricingRulesService.resolveEffectivePricing(target, asOf)` — called once per line during `priceLaundryOrder` (§4.5). Also a pre-transaction read (it takes no `EntityManager`); the effective interval that covers a fixed `asOf` cannot change between resolution and the line insert.

`LaundryOrderEntity` may declare a TypeORM `@ManyToOne` relation to `CustomerEntity` as persistence metadata (the Bookings/nestjs-query precedent), but `LaundryModule` MUST NOT register `CustomerEntity` on `TypeOrmModule.forFeature` / `NestjsQueryTypeOrmModule.forFeature` — `CustomersModule` stays its sole registrant. Application and command code writes the `customerId` scalar, never the relation.

Audit goes through the `AUDIT_LOGGER` port and `runAuditInTransaction`; `modules/laundry` never touches `platform/audit`'s persistence.

### 4.2 Domain objects

**`LaundryOrder`:**

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | UUID, generated, not client-settable |
| `customerId` | `string` | required; references `Customer.id`; FK `ON DELETE RESTRICT`; immutable after creation |
| `fulfillmentType` | `LaundryFulfillmentType` (`PICKUP \| DELIVERY`) | required; set at intake; immutable; selects the `READY` branch (§4.3) |
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
| `rateMinorUnits` | `number` | the resolved `PricingRule.priceMinorUnits` — copied, never re-read |
| `unit` | `PricingUnit` | the resolved rule's unit |
| `quantity` | `number` | integer. `weightGrams` for a `PER_KG` line; the caller-supplied item count for `PER_ITEM`; `1` for `FLAT`/`PER_SERVICE` |
| `amountMinorUnits` | `number` | integer, computed once (§4.5) |
| `minimumChargeApplied` | `boolean` | `true` iff the minimum-charge floor determined `amountMinorUnits` |
| `pricingRuleId` | `string \| null` | the resolved `PricingRule.id`, for traceability. Nullable in the schema (a future manual-override path may set a price with no rule); always populated by this ticket's `priceLaundryOrder` |

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
| **`PAID`** → `PROCESSING`, `CANCELLED`, `REFUNDED` |
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
5. **`CANCELLED`** is legal only before processing begins (`RECEIVED`…`PAID`). Once `PROCESSING` starts, the outcomes are `READY` (work finished), `LOST`, or `DAMAGED` — not cancellation.
6. **`REJECTED`** is legal only at intake/weighing (`RECEIVED`, `WEIGHED`) — staff refusing to take the order on.
7. **`LOST`** is legal from `PROCESSING` onward (the shop is actively handling garments). **`DAMAGED`** likewise. Both are semi-terminal: the only edge out is `→ REFUNDED`.
8. **`REFUNDED`** is legal from every state in which money has been collected: `PAID`, `PROCESSING`, `READY`, `AWAITING_PICKUP`, `AWAITING_DELIVERY`, `COMPLETED`, `LOST`, `DAMAGED`. It is terminal. `CANCELLED` (an order called off) and `REFUNDED` (money returned) are distinct outcomes — cancellation carries no assertion about money movement (which is #39's concern); a refund does.
9. **No self-edges.** The matrix contains no `X → X`. A re-weigh of a `WEIGHED` order is a state-preserving operation (§4.4), not a transition.
10. **Total function.** Every one of the 15 statuses is a key in the policy map (terminal states map to the empty set), so `canTransition` never throws on an unknown key.

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
| `cancelLaundryOrder(input)` | transition `{RECEIVED, WEIGHED, PRICED, AWAITING_PAYMENT, PAID} → CANCELLED` | — | OWNER, OPS_MANAGER, CUSTOMER_SUPPORT | `laundry_order.cancelled` |
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
2. Validate: exactly one `baseServiceId`; add-on inputs each have an `addOnId` and an optional integer `quantity ≥ 1` (default 1); `order.weightGrams` is set.
3. For the base service and each add-on, call `resolveEffectivePricing({ serviceId } | { addOnId }, asOf)`. If any returns `null`, throw `BadRequestException(\`No effective price for …\`)` — the whole command rolls back, no line is created.
4. For each resolved rule, compute the line via the pure function:

```
computeLaundryLineAmount({
  unit, rateMinorUnits, quantity, minimumChargeMinorUnits,
}): { amountMinorUnits: number; minimumChargeApplied: boolean }
```

- `quantity` fed in is: `order.weightGrams` when `unit = PER_KG`; the caller's per-line item count when `unit = PER_ITEM`; `1` when `unit ∈ {FLAT, PER_SERVICE}` (any caller-supplied quantity ignored).
- `raw`:
  - `PER_KG` → `divideRoundHalfUp(weightGrams * rateMinorUnits, 1000)` — the **only** case that rounds; `weightGrams * rateMinorUnits` is an exact integer well inside `Number.MAX_SAFE_INTEGER` for any realistic input.
  - `PER_ITEM` → `quantity * rateMinorUnits` (exact integer).
  - `FLAT` / `PER_SERVICE` → `rateMinorUnits` (exact integer).
- `floor = minimumChargeMinorUnits ?? 0`.
- `amountMinorUnits = Math.max(raw, floor)`.
- `minimumChargeApplied = raw < floor`.

`divideRoundHalfUp(numerator, denominator)` is a named, unit-tested integer-safe helper — half-up on the fractional part, for non-negative inputs. `Math.round` is **not** used as the monetary abstraction even where it would coincide: the business rule (half-up, floor-after-rounding) is named and independently testable.

5. Insert every `LaundryOrderLine` with its frozen snapshot `{ rateMinorUnits, unit, quantity, amountMinorUnits, minimumChargeApplied, pricingRuleId }`.
6. Set `order.totalMinorUnits = Σ line.amountMinorUnits` — stored and frozen; a historical order retains exactly what was calculated. Never a resolver-computed sum.
7. Transition `WEIGHED → PRICED` (through the §4.3 helper) and emit `laundry_order.priced`.

After `PRICED`, `weightGrams`, every line, and `totalMinorUnits` are immutable. Correcting a mispriced order means cancelling it (legal from `PRICED`) and receiving a new one.

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

The `pessimistic_write` lock is the concurrency mechanism: two mutations racing on the same order serialize on the row lock; the loser re-reads the winner's committed `status` and its `assertTransition` rejects if that status no longer permits the edge. This is what makes the required **concurrent status-transition race** e2e deterministic (two real Postgres connections, `Promise.allSettled`, assert exactly one fulfilled and the order ends in exactly one valid state — the `AdminsService.disable` race test is the shape to follow).

Audit failures inside the transaction propagate and roll back the whole operation (the `runAuditInTransaction` contract).

### 4.7 GraphQL surface

- **Read** (`LaundryOrderReadResolver`, nestjs-query `ReadResolver` + `Relatable`, the `JobReadResolver` shape):
  - `laundryOrders: LaundryOrderConnection!` — root offset Connection, `{ nodes, pageInfo, totalCount }`, `paging` default `{ limit: 20 }`, max 100, default sort `createdAt DESC, id ASC`.
  - `laundryOrder(id: ID!): LaundryOrder` — single, nullable (the `job`/`customer` precedent).
  - `LaundryOrder.lines: LaundryOrderLineConnection!` — nested offset Connection, `{ nodes, pageInfo }` (no `totalCount`), `paging` default `{ limit: 20 }`, max 100, default sort `createdAt ASC, id ASC` (creation order).
- **Mutations** (`LaundryOrderMutationResolver`, a separate `@Resolver` class — the `JobResolver` split): the 15 verbs in §4.4, each `@UseGuards(AuthGuard)` + `@Roles(...)`, taking a single `input` and returning `LaundryOrderType`.
- **Types:** `LaundryOrderType`, `LaundryOrderLineType`, `LaundryOrderLinePricingSnapshotType` (all six snapshot fields exposed read-only); computed `customer` resolve-field via a batched loader (the `JobResolver.team` DataLoader precedent). `registerEnumType(LaundryOrderStatus, …)` and `registerEnumType(LaundryFulfillmentType, …)`.
- **Inputs:** `ReceiveLaundryOrderInput { customerId: ID!, fulfillmentType: LaundryFulfillmentType! }`, `WeighLaundryOrderInput { orderId: ID!, weightGrams: Int! }`, `PriceLaundryOrderInput { orderId: ID!, baseServiceId: ID!, addOns: [LaundryOrderAddOnInput!]! }`, `LaundryOrderAddOnInput { addOnId: ID!, quantity: Int }`, and a shared `LaundryOrderRefInput { orderId: ID! }` for the payload-free verbs.
- **Allowlist regression:** `paginated-collections-allowlist.e2e-spec.ts` gains a `ROOT_CONNECTIONS` row (`laundryOrders` / `LaundryOrderConnection` / `LaundryOrderSortFields` / `['createdAt','id']`), a `NESTED_CONNECTIONS` row (`LaundryOrder.lines` / `LaundryOrderLineSortFields` / `['createdAt','id']`), and the generated-CRUD / generic-mutation-name checks must still pass (no `createOneLaundryOrder`, no `transitionLaundryOrderStatus`).

### 4.8 Validation invariants

- **Line target exclusivity** — `CHECK (num_nonnulls("serviceId","addOnId") = 1)` on `laundry_order_line_entity`, hand-added to the migration (TypeORM cannot express a multi-column check), plus an application pre-check for a clean `BadRequestException`. Mirrors #36 §4.7.
- **Exactly one base-service line** — `priceLaundryOrder` requires exactly one `baseServiceId`; enforced in the command (no DB constraint, since it is a per-order cardinality rule across rows).
- **`weightGrams`** — non-negative integer; `null` only while status is `RECEIVED`; required for `priceLaundryOrder`.
- **`quantity` (add-on input)** — integer `≥ 1` when provided; defaults to 1; ignored for non-`PER_ITEM` units.
- **`minimumChargeMinorUnits`** — consumed as resolved from the `PricingRule` (#36 already validates it `≥ 0`); this ticket adds only the *application* semantics (§4.5).
- **Status enum** — Postgres `enum` type (the `BookingStatus` mechanism); an out-of-range value is a driver error, not reachable through the typed GraphQL surface.
- **Transition legality** — `assertTransition` before every status write (§4.3). No status setter bypasses it.
- **`fulfillmentType` branch** — enforced by `markLaundryOrderAwaitingPickup` / `…AwaitingDelivery` against `order.fulfillmentType`.
- **Immutability post-`PRICED`** — no command mutates `weightGrams`, a line, or `totalMinorUnits` once the order is `PRICED`; there is simply no such operation.
- **FK policies** — `customerId` / line `serviceId` / line `addOnId`: `ON DELETE RESTRICT`. `laundryOrderId`: `ON DELETE CASCADE`.

### 4.9 Web — `/app/laundry`

One route, built entirely from `packages/ui` primitives and the `/app/*` shell (the `/app/:path*` middleware matcher already covers it):

- **List** — `DataTable` of orders: customer, `fulfillmentType`, status (`StatusBadge`, tones: `RECEIVED`/`WEIGHED`/`PRICED`/`AWAITING_PAYMENT` → neutral; `PAID`/`PROCESSING`/`READY`/`AWAITING_PICKUP`/`AWAITING_DELIVERY` → warning; `COMPLETED` → success; `CANCELLED`/`REJECTED`/`LOST`/`DAMAGED`/`REFUNDED` → danger), weight, total (`formatMinorUnits`), created. Offset pagination, `pageSize` 20, the `bookings/page.tsx` shape.
- **Intake** — `FormDialog`: customer `<select>` (from `useCustomersQuery`, `limit: 100`), `fulfillmentType` `<select>`. Calls `receiveLaundryOrder`.
- **Detail** — `DetailDrawer` (`?detail=<id>`): order header, `weightGrams`, `fulfillmentType`, status, `totalMinorUnits`, and the `lines` connection (service/add-on name, unit, quantity, rate, amount, "min charge applied" flag).
- **Actions** — the drawer renders one button per transition legal from the current status (derived from the §4.3 matrix, mirrored as a small client constant): `weighLaundryOrder` and `priceLaundryOrder` open small forms; the payload-free verbs fire directly; `cancel`/`reject`/`lost`/`damaged`/`refund` go through `ConfirmDialog` with explicit, non-euphemistic wording.
- **Nav** — a "Laundry" entry in the sidebar "Operations" group.

Frontend smoke tests cover list render + intake + one transition, at the depth of `bookings`/`jobs` page tests.

### 4.10 Migration

One additive migration, `…-CreateLaundryOrders.ts`:

- `CREATE TYPE` for `laundry_order_status_enum` (15 values) and `laundry_fulfillment_type_enum` (2 values).
- `laundry_order_entity` — `id uuid pk`, `customerId uuid not null` + FK `fk_laundry_order_customer` (`RESTRICT`), `fulfillmentType` enum not null, `status` enum not null default `RECEIVED`, `weightGrams integer null`, `totalMinorUnits integer null`, `createdAt`/`updatedAt timestamptz`. Index on `customerId`, on `status`, and `(createdAt, id)` for the default sort.
- `laundry_order_line_entity` — `id uuid pk`, `laundryOrderId uuid not null` + FK `fk_laundry_order_line_order` (`CASCADE`), `serviceId uuid null` + FK (`RESTRICT`), `addOnId uuid null` + FK (`RESTRICT`), the six `pricingSnapshot…` columns (`rateMinorUnits integer not null`, `unit` = the existing `pricing_unit` enum `not null`, `quantity integer not null`, `amountMinorUnits integer not null`, `minimumChargeApplied boolean not null`, `pricingRuleId uuid null`), `createdAt timestamptz`. `CHECK (num_nonnulls("serviceId","addOnId") = 1)` hand-added. Index on `laundryOrderId` and `(laundryOrderId, createdAt, id)` for the nested sort.
- No backfill — both tables are new. `down()` drops both tables and both enum types.

---

## 5. Rationale

- **A new `modules/laundry`, not an extension of `modules/bookings`.** A laundry order and a cleaning booking share almost nothing structurally: no property, a weight, priced *lines* rather than one snapshot, a 15-state checked lifecycle rather than a 4-value free enum, and a different set of dependent modules. Forcing both into one aggregate would make `Booking` carry a large mode-switch. The maximal-reuse precedent this codebase follows is *reuse the shared building blocks* (`Customer`, `Service`/`AddOn`, `PricingRule`, audit, pagination, UI primitives) — which this design does — not *reuse the aggregate*.
- **Payment and fulfillment states live in the single `LaundryOrderStatus` enum.** Issue #37 puts `AwaitingPayment/Paid` and `AwaitingPickup/AwaitingDelivery` directly in the lifecycle, and #38/#39/#42 are out of scope, so there is no `Invoice`/`Payment`/`Delivery` aggregate to hold them. Modelling them as operational status keeps one coherent timeline with one source of truth; when #38/#39/#42 land they attach records *to* these states without a lifecycle change. The alternative — a parallel `paymentState` field now — would fragment the very thing the transition guard exists to make coherent.
- **Verb-specific mutations, one transition policy.** The transition graph must have exactly one authoritative guard (`LaundryOrderStatusTransitionPolicy`) so rules are never duplicated across mutations. But the *public* API should not be a generic `transitionLaundryOrderStatus(orderId, toStatus)`: that makes every graph-valid-but-business-invalid request part of the API contract, gives clients arbitrary state-string manipulation, and leaves no natural home for per-operation preconditions (weight required, pricing computed), RBAC, or audit meaning. Verb mutations put authorization and audit on the *business operation*, give each transition a place to grow side effects later, and keep the guard centralized. This is the developer's explicit M2 decision.
- **The transition matrix is written out in full in the spec (§4.3), not left for the implementation to infer.** It is the executable contract for the policy, its table-driven tests, every mutation test, and the concurrency test. A phrase like "any post-payment state may be refunded" is not good enough — the exact source-state set for `REFUNDED` (and for every other edge) is enumerated so a reviewer and a test author never have to reconstruct intent.
- **`assertTransition` on status change, not on every mutation.** A re-weigh of a `WEIGHED` order is a legitimate correction that does not change status; forcing a `WEIGHED → WEIGHED` self-edge into the matrix just to satisfy "every verb calls the policy" would pollute the guard with non-transitions. The precise invariant — *every status change is preceded by `assertTransition` on the freshly-read status* — is strong enough and keeps the policy semantically clean.
- **Pessimistic row lock for the transition race.** `SELECT … FOR UPDATE` on the order row inside the transaction is the simplest mechanism that makes concurrent transitions serialize and re-check against committed state. The `AdminsService.disable` race already establishes two-connection concurrency testing in this codebase; there is no need for an advisory lock or an optimistic version column.
- **`asOf` = the pricing-command execution time.** The price a customer pays is the rate in effect when staff prices the order, resolved once and frozen — the same "snapshot at the operation, never re-read" discipline as `Booking.pricingSnapshot`. Using drop-off time instead would require persisting an intent-to-price separate from the priced lines, for no real benefit at this scale.
- **Minimum-charge floor applied *after* rounding, behind a named utility.** The minimum charge is a guarantee about the *printed* (rounded) price. Rounding first, then flooring, is what "the customer is never charged less than X" means operationally. `divideRoundHalfUp` is a named, directly-tested function rather than an inline `Math.round` so the monetary rule is explicit and cannot be silently changed by a future edit that "simplifies" the arithmetic. #36 deliberately left this decision to this ticket.
- **Customer-only order.** Nothing in #37 needs a property; laundry is a drop-off, not a site visit. #42 explicitly rejects reusing `PropertyEntity` for the delivery address. Adding a nullable `propertyId` now would be speculative.
- **`fulfillmentType` chosen at intake.** The `READY` branch needs a discriminator, and the customer states pickup-vs-delivery when they drop off. It is the one structural field #37's "fields needed to receive their eventual foreign keys" clause anticipates for #42.
- **`LOST`/`DAMAGED` semi-terminal.** The operational incident is a real terminal outcome that must remain visible in the status; but the customer is owed money, so a single `→ REFUNDED` edge is the honest financial resolution. Making them fully terminal would force the refund to be invisible until #39.
- **`totalMinorUnits` stored and frozen.** Consistent with the immutable per-line snapshots — a historical order must show exactly what was charged, not a sum recomputed against whatever the lines say later (they cannot change, but the discipline is the point).
- **Nested `lines` as an offset Connection, not a plain list.** The platform collection contract (root Connection / nested offset Connection) is enforced by an allowlist regression test; a one-off `[LaundryOrderLineType!]!` list would be the first exception and would fail that test's intent. Lines per order are few, but consistency wins.
- **The discovery report's absence is disclosed, not papered over.** Every reconstructed lifecycle edge is marked and was ratified by the project owner in M2; M3 review has the full matrix in front of it rather than an implementation that quietly invented edges.

---

## 6. Acceptance criteria (for this specification)

- The complete 15-state transition matrix (§4.3) is unambiguous: for every ordered pair of statuses it is decidable from the table alone whether the edge is legal, with no "any post-X state" phrasing left to interpret.
- Every reconstructed decision (RA-1 re-weigh as state-preserving; RA-2 dual payment branches; RA-3 prepaid gate; RA-4 `fulfillmentType` branch; RA-5 the exceptional-exit source sets; RA-6 `LOST`/`DAMAGED` semi-terminal) is recorded with its rationale and traceable to the M2 brainstorming decisions, not silently embedded.
- The `computeLaundryLineAmount` contract (§4.5) is precise enough to write the required unit tests without further design: `PER_KG` weight × rate with half-up rounding and the floor-after-rounding rule; `PER_ITEM` quantity × rate; `FLAT`/`PER_SERVICE` flat rate; `minimumChargeApplied` true exactly when the floor beat the computed amount; a `0`-gram `PER_KG` order floored to the minimum.
- The concurrency mechanism (§4.6 pessimistic write lock) and the expected race outcome (exactly one of two concurrent transitions succeeds; the order ends in exactly one valid state) are specified concretely enough for the e2e test.
- The GraphQL surface (§4.7) matches the existing pagination/connection conventions exactly, verifiable against `paginated-collections-allowlist.e2e-spec.ts`'s patterns, and adds no generated-CRUD or generic-transition mutation.
- No contradiction with the Accepted #36, Bookings, or Jobs specifications: `resolveEffectivePricing`, `getActivePricing`, `PricingRuleEntity`, `BookingStatus`, `JobStatus`, and the legacy `active` pricing mechanism are all consumed unchanged.
- The "no floating-point column" and "integer minor units / integer grams" invariants are stated for every column both new tables introduce.
- The per-mutation RBAC proposal (§4.4) is explicit enough for M3 to ratify or amend without re-deriving it.

---

## 7. Non-goals

- `Invoice`, `InvoiceLine`, `Payment`, `Promotion`, `Delivery`, `Loyalty`, or any structural foreign key to them — #38–#45. `LaundryOrder` carries only the operational payment/fulfillment *states* its own lifecycle needs.
- Item/tag/bag-level garment tracking — a named extension point.
- A generic `transitionLaundryOrderStatus` mutation on the public schema; a REST surface for laundry; a `propertyId` on the order.
- Re-pricing, snapshot mutation, or any post-`PRICED` recomputation of a line, weight, or total.
- Any change to `Booking`/`Job`/`PricingRule` contracts, the legacy `active` pricing path, or `resolveEffectivePricing`'s signature.
- Multi-currency; tiered/banded pricing; a scheduled-pricing promotion mechanism; a laundry-vs-cleaning catalog flag.
- Work-before-payment (`AWAITING_PAYMENT → PROCESSING`); cancellation after processing begins; a direct `READY → COMPLETED` edge — all considered and declined in M2 (§5, §4.3).
- Implementation sequencing, task breakdown, and the TDD plan — M4.
