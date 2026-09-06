# Laundry Invoices & Billing Document — Specification

| Field | Value |
| --- | --- |
| **Status** | Draft |
| **Kind** | Architecture RFC (product behavior/contracts for this slice, not a process specification) |
| **Date** | 2026-09-06 |
| **Tracking** | [#38](https://github.com/rexescario-dev/clensy-platform/issues/38) — Billing: Invoices for Laundry Orders; the Laundry epic ticket after [#37](https://github.com/rexescario-dev/clensy-platform/issues/37) |
| **Depends on (informative)** | [Laundry Orders & Operational Lifecycle](2026-09-06-laundry-orders-lifecycle-design.md) (Accepted) — a `LaundryOrder` must have been priced (frozen `totalMinorUnits`, immutable `LaundryOrderLine` rows with their pricing snapshots) before an invoice can be generated from it; this specification consumes `LaundryOrdersService` as an injected application service and reads the order + its lines through **one new additive read method** (§4.1), never through laundry's repositories or entities. [Laundry Architecture & Catalog Foundation](2026-09-06-laundry-catalog-foundation-design.md) (Accepted) — the `PricingUnit` TypeScript enum (`PER_KG \| PER_ITEM \| FLAT \| PER_SERVICE`) and the integer-minor-units money convention are reused verbatim; `ServicesService.getServicesByIds` is consumed and a sibling `AddOnsService.getAddOnsByIds` is added (§4.1). [Bookings](2026-08-22-bookings-design.md) (Accepted) — the "snapshot frozen at creation, never re-read" discipline is copied for `InvoiceLine`. [Jobs & Checklists](2026-08-27-jobs-checklists-design.md) (Accepted) — the `dataSource.transaction` + `runAuditInTransaction` write pattern, the nestjs-query `ReadResolver` / separate `@Resolver` mutation-class split, the nested-offset-connection shape, and the constraint-scoped unique-violation → `ConflictException` helper are all reused. [Admin Foundation](2026-08-14-admin-foundation-design.md) (Accepted) — `AuthGuard`, `@Roles()`, `@CurrentUser()`, the `Role` enum, `AuditLogger` port + `runAuditInTransaction`, and the two-connection concurrency test shape (`AdminsService.disable`) consumed as-is. [Customers & Properties](2026-08-15-customers-properties-design.md) (Accepted) — `CustomersService` read contract; `CustomerEntity` reused only as a foreign-key target. [Dashboard UX Foundation](2026-08-17-dashboard-ux-foundation-design.md) (Accepted) — `packages/ui` primitives (`DataTable`, `DetailDrawer`, `StatusBadge`, `FormDialog`, `PageHeader`), the `/app/*` shell, the `?detail=` drawer convention, `formatMinorUnits`, and the `/app/:path*` middleware matcher, consumed as-is. [Paginated nestjs-query GraphQL collections](2026-08-28-paginated-graphql-collections-design.md) (Accepted) — the root-Connection (`totalCount`, default 20, max 100) / nested-offset-connection (no `totalCount`) contract and the `paginated-collections-allowlist.e2e-spec.ts` regression pattern. |
| **Followed by (informative)** | [#39](https://github.com/rexescario-dev/clensy-platform/issues/39) Payments & Financial Lifecycle — records money-movement events against an `Invoice` and drives `amountPaidMinorUnits` / `paymentStatus`; **this ticket produces neither**. [#40](https://github.com/rexescario-dev/clensy-platform/issues/40) Promotions & Discounts — computes the applied-discount amount that will feed `discountMinorUnits`; **this ticket fixes `discountMinorUnits` at `0`**. [#41](https://github.com/rexescario-dev/clensy-platform/issues/41) Customer Laundry History & Loyalty — reads across `LaundryOrder` / `Invoice` for balances; `Invoice.customerId` (§4.2) exists partly to serve it. |
| **Governing process** | [Standardized Agent Workflows](../workflows/specs/agent-workflow-design.md) — stage M2 |
| **Source-material note** | Issue #38 cites a "Laundry Module Discovery report, §8/§12/§14". As recorded in the Accepted #37 specification, that document does not exist as a retrievable artifact anywhere (repository history, ContextForge runtime tree, GitHub wiki, gists, issue comments). Per the same developer instruction that governed #36 and #37, this specification is reconstructed from the #38 ticket body, the Accepted #36/#37 specifications, the #39–#42 ticket bodies (for boundary-setting only), and existing repository patterns. Every decision not literally present in the ticket text was resolved interactively with the project owner during M2 brainstorming and is recorded with its rationale in §5. |

---

## 1. Primary question & thesis

**Question:** Nothing in the codebase models an invoice, an invoice line, a subtotal / discount / total, or a payment status. `LaundryOrder` (#37) tracks operational state — including the operational `AWAITING_PAYMENT` / `PAID` / `REFUNDED` lifecycle states it needs for its own transitions — but it deliberately carries no financial *document*. A financial document has its own identity (a unique human-readable number), its own immutability guarantees (its displayed values must never change when catalog, pricing, or promotion data changes afterward), and its own lifecycle (a payment state that later tickets will drive). Where does that document live, how is it generated from a priced order as an immutable snapshot, and what is the smallest payment-state model that #39 can build on without remodelling anything?

**Thesis:** A new `modules/billing` follows the established domain → application → infrastructure → presentation layering. `Invoice` is generated **once** from a `LaundryOrder` that has passed `PRICED`, by **copying** — not referencing — each `LaundryOrderLine`'s resolved figures into an `InvoiceLine` row whose `description` is the catalog `Service` / `AddOn` name **frozen at generation time**. An `Invoice` has exactly one originating `LaundryOrder` (a database `UNIQUE` constraint, not an application pre-check, is the correctness mechanism); regeneration, correction, voiding, and reissue are **out of scope**. `invoiceNumber` is drawn from a dedicated PostgreSQL sequence and rendered `INV-{issueYear}-{6-digit}`; the sequence is global, never resets, and is expected to contain gaps. All monetary arithmetic is integer minor units; `computeInvoiceTotals` is a pure, deterministic function. In this ticket `discountMinorUnits` is always `0`, `amountPaidMinorUnits` is always `0`, `paymentStatus` is always `UNPAID`, and `amountDueMinorUnits` is **derived, never stored**. The single mutation, `generateInvoiceFromOrder`, is gated to `FINANCE` or `OWNER`. `Invoice` has **no structural coupling** to `Payment` (#39), `Promotion` / `AppliedPromotion` (#40), loyalty (#41), or logistics (#42), and adds **no field** to the Accepted `LaundryOrder` aggregate.

---

## 2. Scope

### In scope (normative)

- **`modules/billing`** — a new module in `apps/api/src/modules/billing`, following the domain / application / infrastructure / presentation layering every other module uses. It imports `LaundryModule`, `CatalogModule`, and `CustomersModule` for their exported application services, and `AuditModule`; it never imports another module's entities or repositories (Phase 1 Design §2.6, reaffirmed by Bookings §4.2, #36, and #37 §4.1).
- **Domain (plain TS, no framework):** `Invoice`, `InvoiceLine`; the `InvoicePaymentStatus` (4 values) and `InvoicePaymentTerms` (3 values) enums; a pure `computeInvoiceTotals` function; a pure `formatInvoiceNumber` function; the monetary invariants of §4.5.
- **Application:** `InvoicesService.generateFromOrder` — the single command; plus invoice read helpers. One new **additive** read method on `LaundryOrdersService` (`getOrderForInvoicing`, §4.1) and one new **additive** read method on `AddOnsService` (`getAddOnsByIds`, §4.1). No other change to `modules/laundry` or `modules/catalog`.
- **Infrastructure:** `InvoiceEntity`, `InvoiceLineEntity`; a PostgreSQL `enum` type per enum; a PostgreSQL `SEQUENCE` for invoice numbering; an FK to `laundry_order_entity` (`ON DELETE RESTRICT`) that is **also `UNIQUE`**, an FK to `customer_entity` (`ON DELETE RESTRICT`), an FK from line → invoice (`ON DELETE CASCADE`), a `UNIQUE` on `invoiceNumber`; one additive migration creating the sequence, the enum types, and both tables (no backfill — new tables).
- **Presentation (GraphQL only):** a nestjs-query `ReadResolver` exposing `invoices` as a root offset Connection (`totalCount`, default 20, max 100) and `invoice(id)` as a single nullable query; a nested `Invoice.lines` offset Connection (no `totalCount`); a separate `@Resolver` mutation class holding `generateInvoiceFromOrder`; `InvoiceType` (with a computed `amountDueMinorUnits`), `InvoiceLineType`, the input type, and `registerEnumType` for both enums; batched `customer` and `laundryOrder` resolve-fields; additions to `paginated-collections-allowlist.e2e-spec.ts`.
- **Web:** a new `/app/billing` route — invoice list (`DataTable` + `StatusBadge`) and invoice detail (`DetailDrawer` showing header, amounts, terms, dates, and the lines connection) — plus a nav entry; and an additive **"Invoice" section on the existing `/app/laundry` order detail drawer** — a "Generate invoice" control (with a `paymentTerms` select) when the order is eligible and has no invoice, and the invoice number / total / link once one exists. Built only from existing `packages/ui` primitives.
- **Tests:** unit (`computeInvoiceTotals`; `formatInvoiceNumber`; `InvoicesService.generateFromOrder` — snapshot immutability, eligibility rejection, regeneration `Conflict`, RBAC); e2e against real Postgres (golden path; the historical-immutability scenario from the ticket's acceptance criteria; an authorization test; a concurrent-generation race); frontend list/detail/generate smoke coverage at the depth of `bookings` / `jobs` / `laundry`.

### Out of scope (normative)

- **Payment recording** — `Payment`, payment methods, partial payments, refunds, and **any mutation of `amountPaidMinorUnits` or `paymentStatus` after generation** — #39. This ticket writes `amountPaidMinorUnits = 0` and `paymentStatus = UNPAID` once, at generation, and never changes them.
- **Promotion / discount computation** — `Promotion`, `AppliedPromotion`, promo codes, eligibility logic — #40. This ticket writes `discountMinorUnits = 0` and the generation operation accepts **no** discount input.
- **Tax** — no `taxMinorUnits` column or field is introduced. When tax becomes a real requirement it arrives with its own calculation and source semantics, not as a dead placeholder.
- **Invoice correction, regeneration, voiding, reissue, editing, or deletion** — there is exactly one generation operation and no other invoice-mutating operation. `InvoicePaymentStatus.VOID` is defined in the enum for the eventual lifecycle but **no operation in this ticket produces it**.
- **A credit note / adjustment document** — the deliberate line copy (§4.4) exists so a *future* correction never has to mutate the operational order line; this ticket builds no correction path.
- **Any field, column, relation, or lifecycle change on `LaundryOrder` / `LaundryOrderLine`** — the Accepted #37 aggregate is untouched. The only laundry-module change is one additive read method (§4.1).
- **Multi-currency** — `*MinorUnits` remain raw integers in the single implicit operating currency.
- **A dedicated print or PDF rendering pipeline** — none is introduced. Browser printing of the `DetailDrawer` is sufficient for #38; a real document-rendering pipeline is a later ticket if ever needed.
- **Customer-facing invoice access** — the GraphQL surface and the web route are staff-only, behind `AuthGuard`, exactly like every other module.
- **Item-, tag-, or bag-level line breakdown** — an `InvoiceLine` corresponds one-to-one to a `LaundryOrderLine` (one base service, zero-or-more add-ons); nothing finer.
- **A REST surface for billing** — GraphQL only, consistent with #37.

---

## 3. Terminology

- **`Invoice`** — the `modules/billing` aggregate: an immutable financial document generated from exactly one priced `LaundryOrder`. Carries a unique human-readable number, the frozen monetary figures, the payment terms, the issue and (optional) due dates, and a payment-state field that later tickets drive.
- **`InvoiceLine`** — one row per priced item on the invoice: a **copy** of the corresponding `LaundryOrderLine`'s figures (`quantity`, `unit`, `rateMinorUnits`, `amountMinorUnits`) plus a `description` string frozen from the catalog `Service` / `AddOn` name at generation. Not an independently addressable entity. Holds **no** foreign key or id pointer to `service_entity` / `add_on_entity` / `pricing_rule_entity` / `laundry_order_line_entity` — it is a self-contained snapshot.
- **Generation** — the one-time act, performed by `InvoicesService.generateFromOrder`, of creating an `Invoice` and its `InvoiceLine` rows from a `LaundryOrder`. There is no "regeneration".
- **Eligible order** — a `LaundryOrder` from which an invoice may be generated: `order.totalMinorUnits !== null` (⟺ the order has passed `PRICED`; #37 §4.2 makes this signal authoritative — the field is `null` before `PRICED` and frozen after) **and** `order.status` is not an excluded status (§4.3). An order that already has an `Invoice` is not eligible (a second attempt is a `Conflict`).
- **`InvoicePaymentStatus`** — `UNPAID | PARTIALLY_PAID | PAID | VOID`. The full vocabulary is defined now; this ticket only ever writes `UNPAID`. #39 owns the transitions among the first three; the operation that produces `VOID` is a later ticket.
- **`InvoicePaymentTerms`** — `PAY_NOW | PAY_ON_COMPLETION | PAY_ON_DELIVERY`. An explicit field, supplied at generation, never inferred from status. Determines `dueDate` (§4.5).
- **`invoiceNumber`** — a unique, human-readable string `INV-{issueYear}-{NNNNNN}` where `issueYear` is the four-digit year of `issueDate` and `NNNNNN` is a zero-padded value from the `billing_invoice_number_seq` PostgreSQL sequence. The sequence is **global** (it does not reset per year — `issueYear` is presentation only) and **gap-tolerant** (a rolled-back generation burns its drawn value; this is expected and must not be "fixed" into a gapless counter table).
- **`subtotalMinorUnits`** — `Σ` of every `InvoiceLine.amountMinorUnits`. Integer, `>= 0`.
- **`discountMinorUnits`** — an invoice-level integer discount, `0 <= discountMinorUnits <= subtotalMinorUnits`. Always `0` in this ticket (§4.5). #40 will populate it.
- **`totalMinorUnits`** — `subtotalMinorUnits - discountMinorUnits`. Integer, `>= 0`. Equals `subtotalMinorUnits` in this ticket.
- **`amountPaidMinorUnits`** — integer, `0 <= amountPaidMinorUnits <= totalMinorUnits`. Always `0` at generation; #39 drives it thereafter.
- **`amountDueMinorUnits`** — `totalMinorUnits - amountPaidMinorUnits`. **Derived, never persisted** — computed in the GraphQL type and any web/read consumer. Equals `totalMinorUnits` in this ticket.
- **`issueDate`** — the timestamp captured at the start of the `generateFromOrder` command; the invoice's "as-of" moment. `issueYear` for the number is taken from it.
- **`dueDate`** — `nullable`. `PAY_NOW` → `issueDate`; `PAY_ON_COMPLETION` / `PAY_ON_DELIVERY` → `null` (the triggering lifecycle date is not known at generation). No net-N term and no automatic default are introduced.
- **`customerId` (on `Invoice`)** — the invoicing customer **reference**, copied from `order.customerId` at generation and immutable thereafter. It is a foreign-key reference, not a snapshot of the customer's name / phone / email; those are read live from `CustomerEntity` when displaying an invoice.

---

## 4. Domain and behavioral contracts

### 4.1 Module placement and cross-module rules

`modules/billing` follows the established layering. `InvoicesService` (application) reads other modules only through their exported application services:

- **`LaundryOrdersService.getOrderForInvoicing(id)`** — **new, additive**. Returns the `LaundryOrder` plus its `LaundryOrderLine` rows (each line's `serviceId` / `addOnId` and its frozen `pricingSnapshot` — `quantity`, `unit`, `rateMinorUnits` (as `pricingSnapshot.rateMinorUnits`), `amountMinorUnits`), or `null` if the order does not exist. A read-only projection shaped for invoicing; it does **not** expose laundry's repositories, and it changes **no** existing `LaundryOrdersService` method or `LaundryOrder` contract. This is the only modification to `modules/laundry`. Rationale: #37 §4.1 already establishes that a database foreign key is not a module dependency and that cross-module reads go through the owning module's application service; `getOrderForInvoicing` is that service call for billing.
- **`ServicesService.getServicesByIds(ids)`** — existing. Resolves base-service line descriptions.
- **`AddOnsService.getAddOnsByIds(ids)`** — **new, additive**. `AddOnsService` today exposes only an unfiltered list (its header documents the deliberate absence of a by-id read); this adds the batch-by-ids read, mirroring `ServicesService.getServicesByIds` exactly (`findBy({ id: In(ids) })`). Resolves add-on line descriptions. No other catalog change.
- **`CustomersService`** — not called at generation. `order.customerId` is copied directly and its integrity is enforced by `fk_invoice_customer`; the customer's existence was already validated when the order was received (#37 §4.1). Displaying an invoice reads the customer through the GraphQL `customer` resolve-field.

`InvoiceEntity` / `InvoiceLineEntity` may declare TypeORM `@ManyToOne` relations to `LaundryOrderEntity` / `CustomerEntity` as persistence metadata (the #37 precedent), but `BillingModule` MUST NOT register `LaundryOrderEntity` / `CustomerEntity` / `LaundryOrderLineEntity` on `TypeOrmModule.forFeature` / `NestjsQueryTypeOrmModule.forFeature` — their owning modules stay their sole registrants. `InvoiceLineEntity` declares **no** relation to any catalog entity.

Audit goes through the `AUDIT_LOGGER` port and `runAuditInTransaction`; `modules/billing` never touches `platform/audit`'s persistence.

### 4.2 Domain objects

**`Invoice`:**

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | UUID, generated, not client-settable |
| `invoiceNumber` | `string` | unique; `INV-{issueYear}-{NNNNNN}` (§3, §4.6); generated, not client-settable |
| `laundryOrderId` | `string` | required; references `LaundryOrder.id`; FK `ON DELETE RESTRICT`; **`UNIQUE`** — at most one invoice per order (§4.3); immutable after creation |
| `customerId` | `string` | required; copied from `order.customerId` at generation; FK → `customer_entity` `ON DELETE RESTRICT`; a reference, immutable after creation (§3) |
| `subtotalMinorUnits` | `number` | integer `>= 0`; `Σ InvoiceLine.amountMinorUnits`; frozen |
| `discountMinorUnits` | `number` | integer; `0 <= x <= subtotalMinorUnits`; **always `0` in this ticket** (§4.5); frozen |
| `totalMinorUnits` | `number` | integer `>= 0`; `subtotalMinorUnits - discountMinorUnits`; frozen |
| `amountPaidMinorUnits` | `number` | integer; `0 <= x <= totalMinorUnits`; **always `0` at generation** (§4.5); #39 drives it |
| `paymentStatus` | `InvoicePaymentStatus` | **always `UNPAID` at generation** (§4.5); #39 drives it; PG enum `invoice_payment_status_enum` |
| `paymentTerms` | `InvoicePaymentTerms` | required; supplied at generation; immutable; PG enum `invoice_payment_terms_enum` |
| `issueDate` | `Date` | captured at the start of `generateFromOrder`; frozen |
| `dueDate` | `Date \| null` | `issueDate` for `PAY_NOW`, else `null` (§4.5); frozen |
| `createdAt` | `Date` | `@CreateDateColumn` |
| `updatedAt` | `Date` | `@UpdateDateColumn` |

`amountDueMinorUnits` is **not** a column — it is `totalMinorUnits - amountPaidMinorUnits`, computed on read (§4.7). No foreign key or nullable id column for `Payment`, `Promotion`, `AppliedPromotion`, loyalty, or logistics — a future ticket that needs one adds it then.

**`InvoiceLine`:**

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | UUID, generated |
| `invoiceId` | `string` | required; FK → `invoice_entity`; `ON DELETE CASCADE` (a line has no meaning without its invoice) |
| `description` | `string` | the catalog `Service` / `AddOn` name, resolved and **frozen** at generation (§4.4). Add-on lines are suffixed ` (add-on)` to disambiguate in a flat list |
| `quantity` | `number` | integer; copied verbatim from the source `LaundryOrderLine.pricingSnapshot.quantity` (grams for `PER_KG`, item count for `PER_ITEM`, `1` for `FLAT` / `PER_SERVICE` — #37 §3) |
| `unit` | `PricingUnit` | copied from the source snapshot; PG enum `invoice_line_unit_enum` — a **module-local** type with the same four values, never catalog's `pricing_rule_entity_unit_enum` (#37 §5 precedent) |
| `rateMinorUnits` | `number` | integer; copied from the source snapshot's `rateMinorUnits` |
| `amountMinorUnits` | `number` | integer; copied from the source snapshot's `amountMinorUnits` (the fully-resolved line amount, minimum-charge floor already applied by #37 §4.5) |
| `createdAt` | `Date` | `@CreateDateColumn`; nested-connection default sort key |

`InvoiceLine` carries **no** `serviceId` / `addOnId` / `pricingRuleId` / `laundryOrderLineId`. Everything needed to display and audit the line is frozen in the row itself. The line does **not** copy `minimumChargeMinorUnits` / `minimumChargeApplied` from the source snapshot — `amountMinorUnits` is already the resolved figure and #38 has no operation that would re-derive it.

All money is integer minor units; **no floating-point column anywhere in either table** (issue #38 acceptance criterion).

### 4.3 Invoice-per-order cardinality and eligibility

**Cardinality.** An `Invoice` has exactly one originating `LaundryOrder`, and a `LaundryOrder` has **at most one** `Invoice`. This is enforced by a database `UNIQUE` constraint on `invoice_entity.laundryOrderId` (`uq_invoice_laundry_order`) — **the constraint, not an application pre-check, is the correctness mechanism** (the #37 §4.1 principle: the pre-check gives a clean error for the common case, the constraint closes the race). `generateFromOrder` also does an application pre-check for a clean `ConflictException`; if two calls race past the pre-check, the second `INSERT` fails on `uq_invoice_laundry_order` and the constraint-scoped unique-violation helper (Jobs precedent) translates it to `ConflictException` with the whole transaction rolled back — no partial invoice, no orphan lines, no audit record.

**Eligibility.** `generateFromOrder` requires:

1. `order.totalMinorUnits !== null` — the order has passed `PRICED` (#37 §4.2 makes this the authoritative signal; the value is `null` before `PRICED` and frozen after). A caller must not rely on merely observing a non-null number — the #37 status invariant is what makes it meaningful.
2. `order.status` is **not** in the excluded set. **Settled for M2:** `CANCELLED` and `REJECTED` are excluded — an order refused at intake or called off before payment is not a billable event, and `REJECTED` never has a total anyway. **Deferred to M3 (§6):** whether `COMPLETED` and `REFUNDED` should also be excluded. They are *not* excluded merely for being terminal — the cardinality decision (§5) deliberately allows generation from post-payment and successful-completion states (a completed order is the canonical thing to bill; an invoice may legitimately need to exist for a refunded order). M3 resolves this against #37's terminal-state semantics; the M2 draft states the open question rather than pre-deciding it.
3. No `Invoice` already references `order.id`.

A failed eligibility check throws `BadRequestException` (not priced / excluded status) or `ConflictException` (already invoiced) before any write.

### 4.4 Generation and the deliberate line copy

`generateFromOrder(command: GenerateInvoiceFromOrderCommand)` where `GenerateInvoiceFromOrderCommand = { actorId: string; laundryOrderId: string; paymentTerms: InvoicePaymentTerms }`:

1. Capture one `issueDate = new Date()` at the start of the command.
2. `order = await laundryOrdersService.getOrderForInvoicing(laundryOrderId)`; `NotFoundException` if `null`.
3. Eligibility checks (§4.3) — throw before opening the transaction.
4. Collect the distinct `serviceId`s and `addOnId`s across `order.lines`; `servicesById = ServicesService.getServicesByIds(...)`, `addOnsById = AddOnsService.getAddOnsByIds(...)`. Every id resolves — the source `LaundryOrderLine` FKs are `ON DELETE RESTRICT` (#37 §4.10), so the referenced catalog row cannot have been deleted.
5. For each `order.lines` entry, build an `InvoiceLine` payload by **copying** from the line's frozen `pricingSnapshot`:
   - `description` = `servicesById.get(line.serviceId).name` for a base-service line; `addOnsById.get(line.addOnId).name + ' (add-on)'` for an add-on line. This string is **frozen** — a later rename of the catalog row never changes it.
   - `quantity` = `snapshot.quantity`; `unit` = `snapshot.unit`; `rateMinorUnits` = `snapshot.rateMinorUnits`; `amountMinorUnits` = `snapshot.amountMinorUnits`. Verbatim copies — **no recomputation**, no call to `resolveEffectivePricing`, no read of `PricingRule`.
6. `{ subtotalMinorUnits, totalMinorUnits } = computeInvoiceTotals({ lineAmountsMinorUnits: [...], discountMinorUnits: 0 })` (§4.5).
7. `dueDate` = `issueDate` if `paymentTerms === PAY_NOW`, else `null`.
8. Inside `dataSource.transaction` + `runAuditInTransaction` (§4.6): draw `nextval('billing_invoice_number_seq')`, format `invoiceNumber`, insert the `Invoice` (`customerId` = `order.customerId`, `subtotalMinorUnits`, `discountMinorUnits: 0`, `totalMinorUnits`, `amountPaidMinorUnits: 0`, `paymentStatus: UNPAID`, `paymentTerms`, `issueDate`, `dueDate`), insert every `InvoiceLine`, emit audit `invoice.generated` (`entityType: 'invoice'`, `entityId: invoice.id`), return the re-read invoice.

**Why the copy is deliberate (from the ticket):** an `InvoiceLine` never references a `LaundryOrderLine` or a catalog row, so a *future* invoice correction (a damaged-item credit, a price dispute) can be modelled without ever mutating the still-operational order line it came from. This ticket builds no correction path — but it makes one possible later without a schema fight.

After generation, every `Invoice` and `InvoiceLine` field written by this ticket is immutable. There is no operation in #38 that updates an invoice or a line.

### 4.5 Monetary computation and invariants

**`computeInvoiceTotals`** — pure, deterministic, integer-only:

```
computeInvoiceTotals({
  lineAmountsMinorUnits: number[],   // each an integer >= 0
  discountMinorUnits: number,        // integer, 0 in #38
}): { subtotalMinorUnits: number; totalMinorUnits: number }
```

- `subtotalMinorUnits = lineAmountsMinorUnits.reduce((a, b) => a + b, 0)` — an exact integer sum (line amounts are already-resolved integers well inside `Number.MAX_SAFE_INTEGER`).
- Precondition: `0 <= discountMinorUnits <= subtotalMinorUnits`; violation throws (`RangeError` / `BadRequestException` at the call site). In #38 `discountMinorUnits` is always `0`, so this holds trivially; the guard is stated now for #40.
- `totalMinorUnits = subtotalMinorUnits - discountMinorUnits`.
- No rounding, no division, no floating point anywhere in this function — every input and output is an integer.

**`formatInvoiceNumber`** — pure:

```
formatInvoiceNumber(sequenceValue: number, issueDate: Date): string
  // `INV-${issueDate.getUTCFullYear()}-${String(sequenceValue).padStart(6, '0')}`
```

- `issueYear` is presentation only. The sequence is **not** partitioned or reset by year; `INV-2027-000101` legitimately follows `INV-2026-000100`.
- Zero-padding is to 6 digits; a `sequenceValue` above `999999` simply renders more digits (no wrap, no error).

**Generation invariants** (each `Invoice` produced by #38):

- `subtotalMinorUnits >= 0` and equals `Σ InvoiceLine.amountMinorUnits`.
- `discountMinorUnits === 0`.
- `totalMinorUnits === subtotalMinorUnits`.
- `amountPaidMinorUnits === 0`.
- `amountDueMinorUnits` (derived) `=== totalMinorUnits`.
- `paymentStatus === UNPAID`.
- `dueDate === issueDate` when `paymentTerms === PAY_NOW`, else `dueDate === null`.
- every monetary field is an integer; no floating-point column exists.

**Domain invariant** (holds for #38 and constrains #39):

- `0 <= amountPaidMinorUnits <= totalMinorUnits`. #38 satisfies it at `0`; #39 must preserve it as payments and refunds move `amountPaidMinorUnits`.

### 4.6 Transaction, concurrency, and audit

`generateFromOrder`'s write phase:

```
return this.dataSource.transaction((manager) =>
  runAuditInTransaction(manager, async () => {
    // application pre-check: reject if an invoice already references this order
    const existing = await manager.findOneBy(InvoiceEntity, { laundryOrderId });
    if (existing) throw new ConflictException(...);

    const seq = await manager.query(`SELECT nextval('billing_invoice_number_seq') AS n`);
    const invoiceNumber = formatInvoiceNumber(Number(seq[0].n), issueDate);

    const invoice = manager.create(InvoiceEntity, { /* §4.4 step 8 */ });
    await this.translateUniqueViolation(() => manager.save(invoice)); // uq_invoice_laundry_order / uq_invoice_number -> ConflictException

    for (const line of linePayloads) {
      await manager.save(manager.create(InvoiceLineEntity, { invoiceId: invoice.id, ...line }));
    }
    await this.auditLogger.log({ actorId, action: 'invoice.generated',
                                entityType: 'invoice', entityId: invoice.id });
    return manager.findOneByOrFail(InvoiceEntity, { id: invoice.id });
  }),
);
```

- **The `UNIQUE(laundryOrderId)` constraint is the concurrency guarantee, not the pre-check.** Two `generateFromOrder` calls racing on the same order: both may pass the pre-check; the first `save` commits; the second fails on `uq_invoice_laundry_order`, `translateUniqueViolation` raises `ConflictException`, and `runAuditInTransaction` rolls the whole second transaction back — no invoice, no lines, no `invoice.generated` audit row. The sequence value drawn by the losing attempt is **burned** (a permanent gap) — expected, per §3.
- Audit failure inside the transaction propagates and rolls the operation back (the `runAuditInTransaction` contract).
- The order row is **not** locked — `generateFromOrder` reads the order (through `getOrderForInvoicing`, outside the transaction) and never writes it. The order's own concurrency is #37's concern; billing takes nothing but a copy.

### 4.7 GraphQL surface

- **Read** (`InvoiceReadResolver`, nestjs-query `ReadResolver` + `Relatable`, the `LaundryOrderReadResolver` shape):
  - `invoices: InvoiceConnection!` — root offset Connection, `{ nodes, pageInfo, totalCount }`, `paging` default `{ limit: 20 }`, max 100, default sort `issueDate DESC, createdAt DESC, id ASC`.
  - `invoice(id: ID!): Invoice` — single, nullable, hand-written `@Query` on the mutation resolver class (the `LaundryOrderResolver.laundryOrder` / `one: { disabled: true }` precedent).
  - `Invoice.lines: InvoiceLineConnection!` — nested offset Connection, `{ nodes, pageInfo }` (no `totalCount`), `paging` default `{ limit: 20 }`, max 100, default sort `createdAt ASC, id ASC`.
- **Mutation** (`InvoiceMutationResolver`, a separate `@Resolver` class — the `LaundryOrderResolver` split): `generateInvoiceFromOrder(input: GenerateInvoiceFromOrderInput!): Invoice!`, `@UseGuards(AuthGuard)` + `@Roles(Role.FINANCE, Role.OWNER)`. **This is the only mutation the module adds.**
- **Types:** `InvoiceType` (all `Invoice` fields, plus a computed `amountDueMinorUnits: Int!` resolve-field = `total - amountPaid`); `InvoiceLineType` (all `InvoiceLine` fields, read-only); `registerEnumType(InvoicePaymentStatus, …)` and `registerEnumType(InvoicePaymentTerms, …)`; computed `customer: CustomerType!` and `laundryOrder: LaundryOrderType!` resolve-fields via batched DataLoaders (the `JobResolver.team` precedent), or `@FilterableRelation` if the entity relations suffice.
- **Input:** `GenerateInvoiceFromOrderInput { laundryOrderId: ID!, paymentTerms: InvoicePaymentTerms! }`. `paymentTerms` is a required GraphQL enum — an out-of-range value is rejected by GraphQL validation before reaching the service; the service does not defend against it. The service is responsible for the *semantic* mapping to `dueDate` (§4.5), not for enum validation.
- **VIEW roles:** reads use the full six-role set (`OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT, FINANCE, ANALYST`), matching every other module.
- **Allowlist regression:** `paginated-collections-allowlist.e2e-spec.ts` gains a `ROOT_CONNECTIONS` row (`invoices` / `InvoiceConnection` / `InvoiceSortFields` / `['issueDate','createdAt','id']`), a `NESTED_CONNECTIONS` row (`Invoice.lines` / `InvoiceLineSortFields` / `['createdAt','id']`), and the generated-CRUD / generic-mutation-name checks must still pass (no `createOneInvoice`, no `updateOneInvoice`, no `deleteOneInvoice`).

### 4.8 Validation invariants

- **Invoice-per-order** — `UNIQUE(laundryOrderId)` on `invoice_entity` (`uq_invoice_laundry_order`), plus an application pre-check for a clean `ConflictException` (§4.3, §4.6).
- **`invoiceNumber` uniqueness** — `UNIQUE(invoiceNumber)` (`uq_invoice_number`). A sequence collision is not expected; the constraint is defence-in-depth.
- **Eligibility** — `order.totalMinorUnits !== null` and `order.status ∉ excluded set` (§4.3), checked in the command before any write.
- **Monetary fields** — every `*MinorUnits` column is `integer`; the generation invariants of §4.5 hold for every produced invoice; `computeInvoiceTotals` enforces `0 <= discount <= subtotal`.
- **`paymentTerms` / `paymentStatus` / `unit` enums** — each a PostgreSQL `enum` type (the `BookingStatus` mechanism). `InvoicePaymentStatus` → `invoice_payment_status_enum`; `InvoicePaymentTerms` → `invoice_payment_terms_enum`; `InvoiceLine.unit` → module-local `invoice_line_unit_enum` (four `PricingUnit` values, **not** catalog's type).
- **FK policies** — `invoice.laundryOrderId` → `laundry_order_entity` `ON DELETE RESTRICT` **+ `UNIQUE`**; `invoice.customerId` → `customer_entity` `ON DELETE RESTRICT`; `invoice_line.invoiceId` → `invoice_entity` `ON DELETE CASCADE`. No FK from `invoice_line` to any catalog table.
- **Immutability post-generation** — no command mutates an `Invoice` or `InvoiceLine` after creation; there is simply no such operation in #38.
- **Authorization** — `generateInvoiceFromOrder` is reachable only by `FINANCE` or `OWNER`; every other authenticated role is forbidden. Reads follow the six-role VIEW set.

### 4.9 Migration

One additive migration, `…-CreateBillingInvoices.ts`. It **creates only billing-owned objects** — it never creates, alters, or drops anything belonging to `modules/laundry`, `modules/catalog`, or `modules/customers`.

**`up()` order:**

1. `CREATE SEQUENCE "billing_invoice_number_seq"` (default `START 1 INCREMENT 1`, no cycle).
2. `CREATE TYPE` `invoice_payment_status_enum` (`UNPAID`, `PARTIALLY_PAID`, `PAID`, `VOID`), `invoice_payment_terms_enum` (`PAY_NOW`, `PAY_ON_COMPLETION`, `PAY_ON_DELIVERY`), `invoice_line_unit_enum` (`PER_KG`, `PER_ITEM`, `FLAT`, `PER_SERVICE` — a separate module-local type; TypeORM's per-column enum generation produces exactly this, no cross-module coupling).
3. `invoice_entity` — `id uuid pk`, `invoiceNumber varchar not null`, `laundryOrderId uuid not null`, `customerId uuid not null`, `subtotalMinorUnits integer not null`, `discountMinorUnits integer not null`, `totalMinorUnits integer not null`, `amountPaidMinorUnits integer not null`, `paymentStatus invoice_payment_status_enum not null`, `paymentTerms invoice_payment_terms_enum not null`, `issueDate timestamptz not null`, `dueDate timestamptz null`, `createdAt`/`updatedAt timestamptz`. `UNIQUE(invoiceNumber)` (`uq_invoice_number`), `UNIQUE(laundryOrderId)` (`uq_invoice_laundry_order`). Index on `customerId`, on `paymentStatus`. FK `fk_invoice_laundry_order` → `laundry_order_entity` (`ON DELETE RESTRICT`), FK `fk_invoice_customer` → `customer_entity` (`ON DELETE RESTRICT`).
4. `invoice_line_entity` — `id uuid pk`, `invoiceId uuid not null` + FK `fk_invoice_line_invoice` → `invoice_entity` (`ON DELETE CASCADE`), `description varchar not null`, `quantity integer not null`, `unit invoice_line_unit_enum not null`, `rateMinorUnits integer not null`, `amountMinorUnits integer not null`, `createdAt timestamptz`. Index on `invoiceId`.

No composite `(issueDate, id)` / `(invoiceId, createdAt, id)` sort index — the #37 §4.10 precedent (bookings / jobs / laundry carry none; the default-sort ORDER BY runs unindexed; a composite index would cause permanent `migration:generate` drift). Any `migration:generate` proposal to touch a non-billing constraint (the documented cross-table drift from earlier hand-added constraints) is removed by hand, not executed.

**`down()` order** (dependency-safe, explicit): drop the two line FKs and the two invoice FKs → `DROP TABLE invoice_line_entity` → `DROP TABLE invoice_entity` → `DROP TYPE invoice_line_unit_enum` → `DROP TYPE invoice_payment_terms_enum` → `DROP TYPE invoice_payment_status_enum` → `DROP SEQUENCE billing_invoice_number_seq`.

No backfill — both tables are new.

### 4.10 Web — `/app/billing` and the laundry drawer section

**`/app/billing`** — one new route, built entirely from `packages/ui` primitives and the `/app/*` shell (the `/app/:path*` middleware matcher already covers it):

- **List** — `DataTable` of invoices: `invoiceNumber`, customer name (from the `customer` resolve-field), `totalMinorUnits` (`formatMinorUnits`), `amountDueMinorUnits` (`formatMinorUnits`), `paymentStatus` (`StatusBadge`; tones: `UNPAID` → neutral, `PARTIALLY_PAID` → warning, `PAID` → success, `VOID` → danger), `issueDate`. Offset pagination, `pageSize` 20, the `bookings/page.tsx` shape.
- **Detail** — `DetailDrawer` (`?detail=<id>`): header (`invoiceNumber`, link to the originating laundry order, `paymentTerms`, `issueDate`, `dueDate`), the amount block (`subtotalMinorUnits`, `discountMinorUnits`, `totalMinorUnits`, `amountPaidMinorUnits`, `amountDueMinorUnits`, `paymentStatus`), and the `lines` connection (`description`, `unit`, `quantity`, `rateMinorUnits`, `amountMinorUnits`).
- **Nav** — a "Billing" (or "Invoices") entry in the sidebar; placed in the existing "Operations" group unless a "Finance" grouping already fits the sidebar structure (M4 detail).
- **No generation form on this route** — the list/detail surface is read-only discovery. Generation happens from the laundry order.

**`/app/laundry` order detail drawer — additive "Invoice" section:**

- When the order is eligible (§4.3) and has no invoice: a "Generate invoice" control — a small form with a `paymentTerms` `<select>` — calling `generateInvoiceFromOrder`. Rendered only for a user whose role is `FINANCE` or `OWNER` (presentation mirror of §4.7; the server is authoritative).
- When an invoice exists: the `invoiceNumber`, `totalMinorUnits`, `paymentStatus`, and a link to `/app/billing?detail=<invoiceId>`.
- The client reads eligibility from the order's `status` / `totalMinorUnits` **for presentation only**; the server re-checks every rule.

**No print / PDF pipeline is introduced.** Browser printing of the `DetailDrawer` is the printable representation for #38.

Frontend smoke tests cover the billing list render, the detail drawer, and the generate-from-order action from the laundry drawer, at the depth of `bookings` / `jobs` / `laundry` page tests.

---

## 5. Rationale

- **A new `modules/billing`, not fields on `LaundryOrder` and not a shared `financials` module.** #37's own rationale applies directly: an invoice and an order share almost nothing structurally, and an invoice has its own identity, its own immutability lifecycle, and its own downstream dependents (#39 payments, #41 balances). Adding `subtotal` / `discount` / `total` / `paymentStatus` columns to the Accepted `LaundryOrder` aggregate would remodel #37 to carry document concerns it deliberately excluded. Bundling #38 + #39 into one `financials` module is premature — #39 has a distinct 1:N payment-event lifecycle with its own state machine; the module boundary is cleaner drawn now.
- **The invoice is a pure snapshot; the line copy is deliberate.** The ticket's central acceptance criterion is that changing `Service` / `AddOn` / `PricingRule` / `Promotion` after generation never alters an existing invoice's displayed values. `InvoiceLine` copies the already-resolved figures out of the `LaundryOrderLine.pricingSnapshot` (which #37 already froze) and freezes the catalog *name* as `description` — with **no** foreign key or id pointer to any catalog or order-line row. `PricingRule` changes cannot reach the invoice because the invoice copied a resolved amount, not a rule reference; catalog renames cannot reach it because `description` is a frozen string. This also leaves room for a future correction document (a damaged-item credit) that never has to mutate the operational order line — exactly the ticket's stated reason for the copy.
- **`amountDueMinorUnits` is derived, never stored.** `total - amountPaid` has one representation. Persisting it alongside `amountPaidMinorUnits` creates two facts that can drift once #39 starts moving `amountPaidMinorUnits`. The GraphQL type and every read consumer compute it.
- **`discountMinorUnits` is `0` and the generation operation takes no discount input.** #40 owns promotion computation and the authority model for who may set a discount. Exposing a caller-supplied `discountMinorUnits` now would put an unvalidated money input into the API before that authority exists; adding a `discountMinorUnits` column to `LaundryOrder` now would remodel the Accepted #37 aggregate for a concern it does not have yet. The `Invoice` schema carries the field (invoices need it), initialised to `0`; #40 wires the computation and may add its own carrier then.
- **The full `InvoicePaymentStatus` vocabulary is defined now; #38 only writes `UNPAID`.** #39 transitions `UNPAID → PARTIALLY_PAID → PAID` without a schema migration just to add enum values. `VOID` is defined for the eventual document lifecycle even though no #38 operation produces it — the state exists in the model before the workflow that reaches it.
- **`paymentTerms` is a required input; `dueDate` is derived, not supplied.** Payment terms are a business decision made at invoicing, so making them required avoids silently imposing a default credit policy. `PAY_NOW` has a deterministic due date (`issueDate`); `PAY_ON_COMPLETION` / `PAY_ON_DELIVERY` depend on lifecycle events that have not happened at generation, so a fabricated date would be wrong — `dueDate` is `null` for them. No net-N term is introduced. Deriving `dueDate` in the domain (rather than accepting it in the input) prevents contradictory requests like `PAY_NOW` with a future due date.
- **`invoiceNumber` from a dedicated PostgreSQL sequence, `INV-{YYYY}-{6-digit}`.** A sequence is the right primitive: unique and concurrency-safe with no application-level lock. Gaps are acceptable and expected — a rolled-back generation burns a value — and trying to make numbers gapless would force a single serialization point (a locked counter row) for a property #38 does not need. The year prefix is operationally useful for staff and customers; it is presentation only and the sequence never resets. A dedicated sequence (not a reused entity-id sequence) plus a `UNIQUE(invoiceNumber)` constraint. **A future maintainer must not "fix" the gaps into a counter table.**
- **One invoice per order, enforced by a `UNIQUE` constraint.** The database constraint — not the application pre-check — is the correctness mechanism for the race, exactly as #37 §4.1 frames the customer-existence check. The pre-check exists only for a clean `ConflictException` in the common case. No regeneration / void / reissue / edit in #38 — those need accounting semantics (what happens to a voided number, how a corrected invoice relates to the original) that this ticket does not define.
- **`customerId` copied as a reference.** A financial document names its party, and #41 needs to query invoices by customer without walking `Invoice → LaundryOrder → Customer`. It is copied once at generation and frozen — but it is a foreign-key reference, not a snapshot of the customer's name / contact details, which are read live when displaying the invoice.
- **`generateInvoiceFromOrder` gated to `FINANCE` or `OWNER`.** The ticket asks for `FINANCE` gating on invoice-mutating operations; `OWNER` is the standing super-role across every module. No wider set — creating a financial document is a finance operation, not a general operations one.
- **The additive `getOrderForInvoicing` read, not direct repository access.** #37 §4.1 establishes that cross-module reads go through the owning module's application service and that a database FK is not a module dependency. `getOrderForInvoicing` is a narrow read-only projection shaped for exactly this consumer; it adds no capability to mutate an order and changes no existing #37 contract. The alternative — billing querying `laundry_order_line_entity` directly — would be the first violation of the module-boundary rule the codebase has held since Phase 1.
- **`InvoiceLine.unit` is a module-local PostgreSQL enum.** The `PricingUnit` TypeScript enum is the shared contract; the database representation is each module's own, exactly as #37 §5 argued for `laundry_order_line_unit_enum` — reusing catalog's table-scoped generated type by name would couple billing's schema and `down()` to catalog internals.
- **No tax field.** The ticket says not to build tax logic and to add a field only if trivially additive. An unused `taxMinorUnits: 0` is a misleading contract — a consumer would reasonably assume tax is supported. When tax is real it arrives with its calculation and source.
- **The discovery report's absence is disclosed, not papered over** — the same discipline #36 and #37 followed.

---

## 6. Acceptance criteria (for this specification)

- The `Invoice` and `InvoiceLine` field lists (§4.2) are complete enough to write the entities and the migration without further design, including which fields are frozen copies, which is derived (`amountDueMinorUnits`), and which PostgreSQL enum / sequence backs each.
- The invoice-per-order rule (§4.3, §4.8) is unambiguous: the `UNIQUE(laundryOrderId)` constraint is named as the correctness mechanism, the application pre-check as a UX affordance, and the race outcome (second attempt → `ConflictException`, full rollback, burned sequence value) is specified.
- The eligibility rule (§4.3) states exactly what is settled for M2 (`totalMinorUnits !== null`; `CANCELLED` / `REJECTED` excluded) and exactly what M3 must decide (`COMPLETED` / `REFUNDED`), without the draft asserting both a "PRICED-or-later, later states allowed" rule and a "terminal states excluded" rule as if both were final.
- The line copy (§4.4) is precise: every `InvoiceLine` field is a verbatim copy of a `LaundryOrderLine.pricingSnapshot` field except `description`, which is the catalog name frozen at generation; no `InvoiceLine` holds any FK or id pointer to a catalog or order-line row; no amount is recomputed.
- `computeInvoiceTotals` and `formatInvoiceNumber` (§4.5) are specified precisely enough to unit-test without further design: the subtotal sum, the `0 <= discount <= subtotal` guard, `total = subtotal - discount`, integer-only throughout; the number format, 6-digit zero-pad, year-prefix-is-presentation-only, and no per-year reset.
- The generation invariants (§4.5) are enumerated: `subtotal >= 0`, `discount == 0`, `total == subtotal`, `amountPaid == 0`, `amountDue == total`, `paymentStatus == UNPAID`, `dueDate` per `paymentTerms`, all integers.
- The domain invariant `0 <= amountPaidMinorUnits <= totalMinorUnits` is stated as a constraint that #38 satisfies and #39 must preserve.
- The authorization rule (§4.7, §4.8) is stated consistently as **`FINANCE` or `OWNER`** everywhere it appears, and the authorization test covers all three cases: `FINANCE` allowed, `OWNER` allowed, any other authenticated role forbidden.
- The GraphQL surface (§4.7) matches the existing pagination / connection conventions exactly, verifiable against `paginated-collections-allowlist.e2e-spec.ts`, and adds no generated CRUD and exactly one mutation.
- The historical-immutability test is specified concretely (§4.4, §7): generate → mutate a referenced `Service` name and a referenced `PricingRule` → re-read the invoice → every `InvoiceLine.description` and every monetary field is unchanged, with the two mechanisms named (frozen `description` string; copied resolved amount, no rule reference).
- The migration (§4.9) is specified object-by-object with a dependency-safe `down()` and creates nothing outside `modules/billing`.
- No contradiction with the Accepted #36 / #37 / Bookings / Jobs specifications: `resolveEffectivePricing`, `PricingRuleEntity`, `LaundryOrder` / `LaundryOrderLine` contracts, `BookingStatus`, `JobStatus`, and catalog's `pricing_rule_entity_unit_enum` are all consumed unchanged; the only additive changes are `LaundryOrdersService.getOrderForInvoicing` and `AddOnsService.getAddOnsByIds`.

---

## 7. Tests expected (informative — M4 owns the plan)

- **Unit — `computeInvoiceTotals`:** subtotal is the exact integer sum of line amounts; `discount = 0` path; `total = subtotal - discount`; `0 <= discount <= subtotal` guard rejects an over-large discount; deterministic (same inputs → same output); no floating point.
- **Unit — `formatInvoiceNumber`:** `INV-2026-000042` for `(42, 2026-…)`; 6-digit zero-pad; `>999999` renders more digits without wrapping; year taken from `issueDate`, sequence value not reset per year.
- **Unit — `InvoicesService.generateFromOrder`:**
  - **Snapshot immutability** — generate from a priced order; then rename the referenced `Service` and change the referenced `PricingRule`'s `priceMinorUnits`; re-read the invoice; every `InvoiceLine.description` and every monetary field is unchanged. (The `PricingRule` change cannot reach the invoice because the amount was copied, not re-resolved; the catalog rename cannot reach it because `description` is frozen.)
  - **Eligibility** — rejects an order with `totalMinorUnits === null` (`BadRequestException`); rejects a `CANCELLED` / `REJECTED` order; (M3-pending: `COMPLETED` / `REFUNDED`).
  - **Regeneration** — a second `generateFromOrder` for an order that already has an invoice throws `ConflictException`; no second invoice row exists.
  - **RBAC** — allowed for `FINANCE`; allowed for `OWNER`; forbidden for `OPS_MANAGER` / `SCHEDULER` / `CUSTOMER_SUPPORT` / `ANALYST`.
  - **Terms → due date** — `PAY_NOW` → `dueDate === issueDate`; `PAY_ON_COMPLETION` → `dueDate === null`; `PAY_ON_DELIVERY` → `dueDate === null`.
- **e2e (real Postgres):**
  - **Golden path** — receive → weigh → price a laundry order; `generateInvoiceFromOrder`; assert `invoiceNumber` format, `subtotalMinorUnits` / `totalMinorUnits` / `amountPaidMinorUnits` / `amountDueMinorUnits`, `paymentStatus === UNPAID`, and one `InvoiceLine` per order line with the copied figures and the frozen description.
  - **Historical immutability (ticket AC)** — generate; then mutate catalog (`Service` / `AddOn` name) and pricing (`PricingRule`); re-read the invoice via GraphQL; all displayed values unchanged.
  - **Authorization** — a non-`FINANCE`, non-`OWNER` token is rejected by `generateInvoiceFromOrder`.
  - **Concurrent generation race** — two real connections call `generateInvoiceFromOrder` for the same order under `Promise.allSettled` (the `AdminsService.disable` shape): exactly one invoice exists; exactly one call succeeds; exactly one gets `ConflictException`; no orphan `InvoiceLine` rows and no `invoice.generated` audit event from the failed attempt; a sequence gap is acceptable.
  - **Allowlist regression** — `paginated-collections-allowlist.e2e-spec.ts` passes with the new root + nested connection rows and no generated-CRUD mutations for `Invoice`.
- **Frontend smoke** — `/app/billing` list renders; the detail drawer opens from `?detail=`; the "Generate invoice" action on the laundry order drawer creates an invoice and reflects it — at the depth of the `bookings` / `jobs` / `laundry` page tests.

---

## 8. Non-goals

- `Payment`, payment methods, partial payments, refunds, and any post-generation mutation of `amountPaidMinorUnits` / `paymentStatus` — #39.
- `Promotion`, `AppliedPromotion`, promo codes, discount computation, and any caller-supplied discount input — #40. `discountMinorUnits` is `0`.
- Tax of any kind — no field, no logic.
- Invoice correction, regeneration, voiding, reissue, editing, deletion; a credit-note document; the operation that produces `InvoicePaymentStatus.VOID`.
- Any field / column / relation / lifecycle change on `LaundryOrder` / `LaundryOrderLine`; any change to `Booking` / `Job` / `PricingRule` / catalog-enum contracts or `resolveEffectivePricing`'s signature. The only additive changes are `LaundryOrdersService.getOrderForInvoicing` and `AddOnsService.getAddOnsByIds`.
- Persisting `amountDueMinorUnits`; a composite sort index; a REST surface; customer-facing invoice access; a print / PDF pipeline; multi-currency; item / tag / bag-level line breakdown.
- Implementation sequencing, task breakdown, and the TDD plan — M4.
- The Design Review decision itself (M3) — this document stops at **Draft** and does not self-Accept. The `COMPLETED` / `REFUNDED` eligibility question (§4.3, §6) is explicitly left for M3.
