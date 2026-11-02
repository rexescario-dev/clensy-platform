# Laundry Invoice Payments & Refunds — Specification

| Field | Value |
| --- | --- |
| **Status** | Draft |
| **Kind** | Architecture RFC (product behavior and contracts for this slice, not a process specification) |
| **Date** | 2026-11-02 |
| **Revision note** | Pre-M3 preliminary review (owner, 2026-11-02) provisionally confirmed author calls 2–6, 9, 10 and 12 (§5.1) and asked for five clarifications before M3. They are folded in, and none expands scope: (1) net-paid worked examples, including several refunds against one payment (§4.3); (2) the concurrency contract restated as a numbered guarantee list (§4.6); (3) amount due when overpaid or refunded, with its effect on existing screens, including a `formatMinorUnits` negative-amount defect (§4.4, §4.10); (4) immutability, staff attribution, duplicate submissions (a new required idempotency key, call 13) and failed transactions (§4.2, §4.5, §4.6); (5) an Amendment #39 compatibility check against #38 and the current screens (§4.11). `paidAt` timezone semantics are stated (§4.2). **M3 round 1 (owner, 2026-11-02)** returned the Draft with four required changes and three clarifications, none a redesign: (1) the maximum supported `amountPaidMinorUnits` is `MAX_MINOR_UNITS = 2147483647`; a write whose resulting net paid would exceed it is rejected, and `deriveInvoicePayment` rejects an out-of-range result (§3, §4.3, §4.4, §4.5); (2) the role identifiers were checked against the `Role` enum on `main`: the tenant owner is `TENANT_OWNER`, and #38's `OWNER` is the retired pre-tenancy identifier the multi-tenant RFC §4.3 replaced (§4.7, §4.11); (3) payment history order is `paidAt ASC, createdAt ASC, id ASC` (§4.7); (4) both idempotency keys are validated as UUIDs (§4.5). Clarified: a refund's original being a `PAYMENT` is enforced in the application under the invoice lock, not by the composite FK (§4.2, §4.9); the GraphQL `Payment` type's public fields are listed, `idempotencyKey` is not exposed, and staff identity is exposed only as `recordedByStaffId` (§4.7, §4.10); #39 owns every payment-status transition except into or out of `VOID` (§3). Also tightened: the §4.5 check order is now one sequence, split into pre-transaction input checks and under-lock checks. Calls 1, 7, 11 and 13 confirmed (§5.1). |
| **Tracking** | [#39](https://github.com/rexescario-dev/clensy-platform/issues/39) — Payments & Financial Lifecycle for Laundry Invoices |
| **Depends on** | [Laundry Invoices & Billing Document](2026-09-06-laundry-invoices-design.md) (Accepted, #38). **Extends** it: this ticket is the designated mover of `Invoice.amountPaidMinorUnits` / `paymentStatus`. **Amends** it in place (Amendment #39, Draft — see that document's status rows): the `0 <= amountPaidMinorUnits <= totalMinorUnits` invariant becomes `amountPaidMinorUnits >= 0`, and `InvoicePaymentStatus` gains `OVERPAID` and `REFUNDED` (§4.3, §5 below). Every other #38 contract — the immutable commercial snapshot, generation, eligibility, numbering — is relied upon unchanged. [Multi-Tenant Architecture](2026-09-23-multi-tenant-architecture-design.md) (Accepted). **Constrains** this slice: `Payment` is tenant-owned (§4.4, §4.5 of that RFC); its references are tenant-aware composite FKs. [Laundry Orders & Operational Lifecycle](2026-09-06-laundry-orders-lifecycle-design.md) (Accepted, incl. Amendment #164). **Relied upon, not changed**: no order status, transition or role is altered (§4.8). |
| **Followed by (informative)** | [#43](https://github.com/rexescario-dev/clensy-platform/issues/43) Laundry Reporting — reads `Payment` rows for reconciliation. [#41](https://github.com/rexescario-dev/clensy-platform/issues/41) Customer History & Loyalty — reads invoice balances. [#40](https://github.com/rexescario-dev/clensy-platform/issues/40) Promotions — unaffected (moves `discountMinorUnits`, which this ticket only reads through `totalMinorUnits`). [#209](https://github.com/rexescario-dev/clensy-platform/issues/209) — browser verification of the invoice/payment UI. |
| **Governing process** | [Standardized Agent Workflows](../../workflows/specs/agent-workflow-design.md) — stage M2 |
| **Source-material note** | #39 cites a "Laundry Module Discovery report, §8/§12". As recorded in the Accepted #37 and #38 specifications, that document does not exist as a retrievable artifact. This specification is reconstructed from the #39 ticket body, the Accepted #37/#38/multi-tenant specifications, #154/#166 (which fixed the current invoice/payment UI and deferred money recording to #39), and repository patterns. The owner chose to skip M2 brainstorming questions; every decision not literally in the ticket is an author call, listed in §5.1 for M3 to confirm or overturn. |

---

## 1. Primary question & thesis

**Question:** An `Invoice` (#38) carries `amountPaidMinorUnits` and `paymentStatus`, but nothing records the money movements that should produce them, and nothing may change them. How are payments and refunds recorded against an invoice — one or many, by method, at any time the customer actually pays — so that the invoice's payment figures are always a pure, transaction-safe derivation of those records and can never be set by a client?

**Thesis:** A new `modules/payments` owns a tenant-owned, append-only `Payment` ledger, 1:N against `Invoice`. A row is either a `PAYMENT` (money in) or a `REFUND` (money out) — a discriminator, never a signed amount; `amountMinorUnits` is always a positive integer. A refund is a new row that references the `PAYMENT` it returns money from, and can never return more than that payment's still-unrefunded amount. Two staff commands — `recordInvoicePayment` and `refundInvoicePayment` — each run in one transaction that locks the invoice row, inserts the row, **recomputes** `amountPaidMinorUnits` (net of refunds) and `paymentStatus` from the full set of the invoice's completed rows using the pure function `deriveInvoicePayment`, writes them through a narrow billing port, and emits one audit event. No GraphQL input anywhere carries `paymentStatus` or `amountPaidMinorUnits`. Payment recording is decoupled from the laundry order's operational status: it neither reads nor moves `LaundryOrder.status`. The web gains a shared payments panel (amounts, history, record and refund dialogs) used on the laundry order page and in the billing invoice drawer.

---

## 2. Scope

### In scope (normative)

- **Domain (plain TS, `modules/payments/domain`):** `Payment`; enums `PaymentType`, `PaymentMethod`, `PaymentRecordStatus`; the pure function `deriveInvoicePayment` (§4.3); the refund ceiling rule (§4.2).
- **Billing changes (`modules/billing`):** `InvoicePaymentStatus` gains `OVERPAID` and `REFUNDED`; a narrow application port that locks an invoice for a payment write and persists the derived pair (§4.1). No change to generation.
- **Application:** `RecordInvoicePaymentCommand`, `RefundInvoicePaymentCommand`, and a `PaymentsService` implementing them (§4.5, §4.6).
- **Infrastructure:** `PaymentEntity` (TypeORM) and one migration (§4.9).
- **Presentation (GraphQL):** `Payment` type, a nested `Invoice.payments` offset connection, two mutations with their inputs, enum registration, allowlist updates (§4.7).
- **Web:** a shared invoice payments panel on `/app/laundry/[id]` (the existing "Invoice and payment" section) and in the `/app/billing` invoice drawer; new status tones/labels (§4.10).
- **Tests:** the categories in §7.

### Out of scope (normative)

- **Payment gateways / processors / online or customer-initiated payment.** All v1 rows are staff-entered. `recordedByStaffId` being nullable anticipates a future non-staff actor and nothing else; no v1 path writes `null`.
- **Coupling to `LaundryOrder.status`.** Recording a payment does not mark the order `PAID`; refunding does not move it to `REFUNDED`; order transitions never write `Payment` rows. Changing the #37 prepaid-processing gate is out of scope (§4.8, §5.2).
- **Voiding an invoice, and producing `VOID`.** Still a later ticket. This ticket only *refuses writes* against a `VOID` invoice.
- **Correcting or deleting a mistaken `Payment` row.** Rows are append-only; no edit, delete, or "void entry" operation (§5.1 call 8).
- **Reconciliation reporting, cash-drawer close-out, receipts/PDF, customer notifications** — #43 and later.
- **A root `payments` collection query.** Payments are read through `Invoice.payments` only.
- **Multi-currency.** Single currency, integer minor units (₱ centavos), as in #38.
- **Changing `paymentTerms` or `dueDate`** after generation, or any terms-based enforcement (§4.8).

---

## 3. Terminology

- **Payment row / `Payment`** — one recorded money movement against one invoice. Append-only: never updated or deleted after insert.
- **`PaymentType`** — `PAYMENT | REFUND`. `PAYMENT` = money received from the customer. `REFUND` = money returned to the customer.
- **`PaymentMethod`** — `CASH | GCASH | MAYA | BANK_TRANSFER | CARD | OTHER`. How the money moved. Recorded, never processed. A refund carries its own method (a GCash payment may be refunded in cash).
- **`PaymentRecordStatus`** — `COMPLETED | PENDING | FAILED`. v1 writes only `COMPLETED`; `PENDING` / `FAILED` are reserved for a future gateway (the #38 precedent of defining `VOID` before its workflow). Only `COMPLETED` rows count toward any derived figure.
- **Original payment** — the `PAYMENT` row a `REFUND` references through `refundedPaymentId`.
- **Refundable amount (of a payment)** — `original.amountMinorUnits − Σ amountMinorUnits of COMPLETED REFUND rows referencing it`. Never negative.
- **Gross paid** — `Σ amountMinorUnits` of the invoice's `COMPLETED` `PAYMENT` rows.
- **Gross refunded** — `Σ amountMinorUnits` of the invoice's `COMPLETED` `REFUND` rows.
- **Net paid** — `gross paid − gross refunded`. This is what `Invoice.amountPaidMinorUnits` stores.
- **Idempotency key** — a client-generated UUID sent with every payment write. A repeat of the same write with the same key returns the original row instead of recording money twice (§4.5).
- **`MAX_MINOR_UNITS`** — `2147483647`, the PostgreSQL `integer` maximum and the column type of `Invoice.amountPaidMinorUnits` and `Payment.amountMinorUnits`. The largest supported value for any single amount **and** for net paid.
- **Derived pair** — `(amountPaidMinorUnits, paymentStatus)` on `Invoice`. Written only by the payment commands, only from `deriveInvoicePayment`.
- **`InvoicePaymentStatus`** (amended) — `UNPAID | PARTIALLY_PAID | PAID | OVERPAID | REFUNDED | VOID`. The ticket's `VOIDED` is the existing #38 value `VOID` — not renamed (§5.1 call 2). **Ownership:** #39 owns every transition among `UNPAID`, `PARTIALLY_PAID`, `PAID`, `OVERPAID` and `REFUNDED`, and those transitions happen only through `deriveInvoicePayment`. `VOID` remains an invoice-lifecycle state, not a payment outcome: no #39 operation moves an invoice into or out of `VOID`, and payment writes against a `VOID` invoice are refused (§4.5).

---

## 4. Domain and behavioral contracts

### 4.1 Module placement and cross-module rules

- `modules/payments` owns `Payment`, its entity, the two commands, `deriveInvoicePayment`, and the GraphQL `Payment` type and mutations.
- `modules/billing` remains the **only** writer of `invoice_entity`. It exposes to `payments` one application-level port that, given the caller's transaction manager:
  1. reads the invoice by `(id, tenantId)` **with a row lock held to commit** (`pessimistic_write`), returning `null` when absent; and
  2. persists a new derived pair for that locked invoice.
  The port MUST NOT accept or write any other `Invoice` field. It is not exposed through GraphQL.
- `Invoice.payments` (the nested read) is resolved in `payments` (or wired from billing to a payments read service — M4's choice); billing's domain object gains **no** payments field.
- `payments` does not import from `laundry`. Order-related display data on the web comes from existing queries.

### 4.2 Domain object — `Payment`

| Field | Type | Rule |
| --- | --- | --- |
| `id` | uuid | PK |
| `tenantId` | uuid | required; equals the invoice's `tenantId` (composite FK, §4.9) |
| `invoiceId` | uuid | required; same-tenant composite FK to `invoice_entity (id, tenantId)` |
| `type` | `PaymentType` | required |
| `method` | `PaymentMethod` | required |
| `amountMinorUnits` | integer | required; `1 <= x <= MAX_MINOR_UNITS`; positive for **both** types |
| `reference` | string \| null | optional free text (receipt number, GCash reference); trimmed; empty after trim → `null`; max 120 characters |
| `status` | `PaymentRecordStatus` | required; always `COMPLETED` in v1 |
| `paidAt` | timestamptz | required; the **instant** the money actually moved (for a refund: when it was returned), stored as `timestamptz` (UTC). Every bound below compares instants, not calendar dates. The web enters and displays it in `Asia/Manila`, the platform locale (#38 §3). Defaults to the server's now when the input omits it. MUST NOT be later than the server's now at write. For a `REFUND`, MUST NOT be earlier than the original payment's `paidAt`. May be earlier than the invoice's `issueDate` (money taken at drop-off, invoice generated later). |
| `refundedPaymentId` | uuid \| null | `null` iff `type = PAYMENT` (database `CHECK`); for `REFUND`, the original payment, which MUST be a `PAYMENT` row of the **same invoice and tenant**. Same invoice and tenant are enforced by the composite FK (§4.9). That the referenced row is a `PAYMENT` and is `COMPLETED` is enforced by **application validation under the invoice lock** (§4.5), not by the FK. |
| `recordedByStaffId` | uuid \| null | the acting staff user (`AdminUser`); every v1 write sets it; nullable only for the future non-staff actor |
| `idempotencyKey` | uuid | required; client-generated per intended write; validated as a UUID before any database access (§4.5); `UNIQUE (tenantId, idempotencyKey)`; never exposed through GraphQL reads (§4.7) |
| `createdAt` | timestamptz | insert time; the tie-breaker for ordering |

No `updatedAt`: rows are never updated. **Immutability and attribution:** no operation updates or deletes a `Payment` row; the GraphQL type has no update/delete; every v1 row records its staff actor in `recordedByStaffId` and in its audit event's `actorId`.

**Refund ceiling (domain rule):** a refund's `amountMinorUnits` MUST NOT exceed the original payment's refundable amount, evaluated inside the write transaction under the invoice lock (§4.6). It follows that net paid is never negative. A `REFUND` may not reference a `REFUND`.

### 4.3 Derivation — `deriveInvoicePayment` (pure)

Input: `totalMinorUnits`, the current `paymentStatus`, and the invoice's payment rows (`type`, `status`, `amountMinorUnits`). Output: the derived pair. Integer arithmetic only.

1. Consider only `COMPLETED` rows. `paid` = gross paid, `refunded` = gross refunded, `net = paid − refunded`. `net < 0` is a bug → throw `RangeError`. `net > MAX_MINOR_UNITS`, or any sum that is not a safe integer, → throw `RangeError` (the command rejects such a write first, §4.5; reaching this throw is a bug). Sums are computed in JavaScript numbers. Each row is at most `MAX_MINOR_UNITS`, so a sum stays an exact safe integer for more than four million rows per invoice. If M4 computes the sums in SQL, `SUM(integer)` returns `bigint` and MUST be converted with a safe-integer check, as `allocateInvoiceNumber` already does.
2. If the current status is `VOID` → throw (callers refuse writes against `VOID` before reaching here; §4.5).
3. `amountPaidMinorUnits = net`.
4. `paymentStatus`, first match wins:
   - `net === 0` and `refunded === 0` → `UNPAID`
   - `net === 0` and `refunded > 0` → `REFUNDED`
   - `net < totalMinorUnits` → `PARTIALLY_PAID`
   - `net === totalMinorUnits` → `PAID`
   - `net > totalMinorUnits` → `OVERPAID`

Consequences, stated so M4 tests them (§7): one full payment → `PAID`; partials → `PARTIALLY_PAID` then `PAID`; a payment above the balance → `OVERPAID`; refunding the excess of an `OVERPAID` invoice → `PAID`; a partial refund of a `PAID` invoice → `PARTIALLY_PAID`; refunding everything → `REFUNDED`; a new payment after `REFUNDED` → `PARTIALLY_PAID` / `PAID` / `OVERPAID` by the same rules. A zero-total invoice with no rows stays `UNPAID`, matching #38 generation; any payment on it is `OVERPAID`.

**Worked examples** (invoice `totalMinorUnits = 1000`; P = payment, R = refund; amounts in minor units):

| Rows (in order) | Gross paid | Gross refunded | Net = `amountPaid` | `amountDue` | Status | Refundable left |
| --- | --- | --- | --- | --- | --- | --- |
| *(none)* | 0 | 0 | 0 | 1000 | `UNPAID` | — |
| P1 400 | 400 | 0 | 400 | 600 | `PARTIALLY_PAID` | P1: 400 |
| P1 400, P2 600 | 1000 | 0 | 1000 | 0 | `PAID` | P1: 400, P2: 600 |
| P1 400, P2 600, P3 200 | 1200 | 0 | 1200 | −200 | `OVERPAID` | P1 400, P2 600, P3 200 |
| … + R1 200 of P3 | 1200 | 200 | 1000 | 0 | `PAID` | P3: 0 |
| … + R2 100 of P2 | 1200 | 300 | 900 | 100 | `PARTIALLY_PAID` | P2: 500 |
| … + R3 500 of P2 | 1200 | 800 | 400 | 600 | `PARTIALLY_PAID` | P2: 0 |
| … + R4 400 of P1 | 1200 | 1200 | 0 | 1000 | `REFUNDED` | all 0 |
| … + R5 1 of P1 | — | — | — | — | *rejected* (P1 refundable 0) | — |
| … + P4 1000 | 2200 | 1200 | 1000 | 0 | `PAID` | P4: 1000 |

Several refunds may reference one payment. Each payment's refundable amount is tracked separately: a refund draws down only its own original, never another payment's balance, even when the invoice as a whole is overpaid. Net paid is invoice-wide: all completed payments minus all completed refunds, whichever payment each refund references.

The derivation is always from the **full row set**, never incremental (`old + amount`), so a derived pair cannot drift from its rows.

### 4.4 Amended invoice invariants (Amendment #39 to the #38 specification)

- `0 <= amountPaidMinorUnits <= MAX_MINOR_UNITS` and always equals net paid of the invoice's `COMPLETED` rows (replaces `0 <= amountPaidMinorUnits <= totalMinorUnits`). Not a database `CHECK` (the #38 convention), enforced by §4.3 + §4.6.
- `amountDueMinorUnits` stays derived as `totalMinorUnits − amountPaidMinorUnits` and is **negative** when `OVERPAID` (the credit owed back). It is not clamped; the web labels a negative due as "Overpaid by ₱x" (§4.10). For a `REFUNDED` invoice, amount due returns to the full total, because net paid is zero; the status badge, not the due figure, tells staff the money was returned. Downstream readers (#41 balances, #43 reports) MUST treat a negative due as a credit owed to the customer, not as an error.
- An invoice with zero `Payment` rows has `(0, UNPAID)` — every existing invoice already satisfies this, so no backfill.
- The commercial snapshot stays immutable; the derived pair is the only mutable surface, and only payment commands move it.

### 4.5 Commands

`RecordInvoicePaymentCommand = { actorId, tenantId, invoiceId, idempotencyKey, method, amountMinorUnits, reference?, paidAt? }`

`RefundInvoicePaymentCommand = { actorId, tenantId, paymentId, idempotencyKey, method, amountMinorUnits, reference?, paidAt? }` — the invoice is the original payment's invoice; the caller does not name it.

Validation and error mapping. This is the **one** check sequence; §4.6 performs it in this order, and the first failing check wins.

**A. Input checks, before the transaction opens (no database access):**

| # | Condition | Error |
| --- | --- | --- |
| A1 | `idempotencyKey` is not a UUID: the canonical 8-4-4-4-12 hexadecimal form, case-insensitive. The version and variant nibbles are **not** checked, so deterministic test keys are valid, matching the project's seeded fixture ids. | `BadRequestException` |
| A2 | `amountMinorUnits` not an integer in `[1, MAX_MINOR_UNITS]` | `BadRequestException` (GraphQL `Int` already rejects non-integers and values outside 32 bits) |
| A3 | `reference` longer than 120 characters after trim | `BadRequestException` |
| A4 | `paidAt` supplied and later than the server's now | `BadRequestException` |

**B. Under the invoice lock (§4.6 step 1), in this order:**

| # | Condition | Error |
| --- | --- | --- |
| B1 | Invoice (record) / original payment (refund) not found in the caller's tenant | `NotFoundException` (cross-tenant = missing) |
| B2 | Idempotency lookup (below): a matching replay returns the existing row and **stops here**; a same-key mismatch fails | `ConflictException` on mismatch |
| B3 | Invoice `paymentStatus === VOID` | `BadRequestException` |
| B4 | Refund: original is not a `PAYMENT` or not `COMPLETED` (the composite FK cannot check this) | `BadRequestException` |
| B5 | Refund: `paidAt` (supplied or defaulted) before the original's `paidAt` | `BadRequestException` |
| B6 | Refund: amount > original's refundable amount | `BadRequestException` naming the refundable amount |
| B7 | Payment: current net paid + amount > `MAX_MINOR_UNITS` | `BadRequestException` naming the largest amount that can still be recorded |

A refund lowers net paid, so it never needs B7. B2 runs before B3–B7, so a replay of a write that already succeeded returns the original row even if a later check would now fail. For example, a replay of the refund that used up a payment returns that refund instead of failing B6.

**Why A1 differs from the project's id convention:** entity-reference ids in this codebase use `@IsString()`, not `@IsUUID()`, and leave existence to a `NotFoundException`. The idempotency key is not a reference. The client invents it, and it is stored in a PostgreSQL `uuid` column, where a malformed value would surface as a database cast error (500) instead of a 400. A1 checks syntax only, for the same fixture-id reason that convention gives.

**Duplicate submissions (idempotency).** Both inputs carry a required `idempotencyKey` (UUID). The web generates one key when a dialog opens, reuses it for retries of that submission, and generates a new key after success. At step B2, under the invoice lock:

- No row has `(tenantId, idempotencyKey)` → proceed normally.
- A row exists with the same key **and** the same request (same type, same invoice (record) or original payment (refund), method, amount, normalized reference, and the same `paidAt` when the request supplied one) → return that existing row unchanged. No new row, no re-derivation write, no audit event.
- A row exists with the same key but a different request → `ConflictException`.
- A same-key insert that races past the lookup (possible only across different invoices, since the invoice lock serializes the same invoice) hits `UNIQUE (tenantId, idempotencyKey)`, which maps to `ConflictException`.

`paidAt` input contract: when omitted, the server uses its own now. The web sends `paidAt` only when the user changed it, so client clock skew cannot reject a "now" payment.

No `paymentTerms`, due-date or order-status check exists (§4.8). Overpayment is allowed, not rejected (§5.1 call 4).

### 4.6 Transaction, concurrency, and audit

Each command runs in one `dataSource.transaction` + `runAuditInTransaction`:

1. Lock the invoice row via the billing port (§4.1). For a refund, first resolve the original payment's `invoiceId` in the tenant, then lock that invoice, then re-read the original and its refunds under the lock.
2. Run the §4.5 B-checks in order. (The A-checks ran before the transaction opened.)
3. Insert the `Payment` row (`status: COMPLETED`, `recordedByStaffId: actorId`).
4. Read every `Payment` row of the invoice (same manager), call `deriveInvoicePayment`, persist the derived pair through the port.
5. Emit one audit event — `payment.recorded` or `payment.refunded`, `entityType: 'payment'`, `entityId: payment.id`, with `tenantAuditTags`.
6. Return the inserted row.

**Guarantees** (each MUST be covered by §7 tests):

1. Every payment write for one invoice serializes on that invoice's row lock (`pessimistic_write`, held to commit). Writes against different invoices do not block each other.
2. The derived pair is recomputed from the persisted rows, read inside the same transaction after the insert. It is never computed from client input or incremented from the previous value.
3. The refund ceiling is evaluated under the lock against the persisted refunds of the original. When two refunds of one payment race and together exceed its refundable amount, exactly one commits and the other gets `BadRequestException`.
4. **Failed transactions leave no trace.** Any exception (validation under the lock, constraint violation, audit failure) rolls back the row, the derived pair and the audit event together. No partial payment is ever visible, and the client may retry with the same idempotency key.
5. Duplicate submissions are absorbed by the idempotency key, not by the lock alone.

**Correctness mechanism:** the invoice row lock serializes every payment write for one invoice, so concurrent writes each derive from a row set that includes all previously committed rows, and two concurrent refunds of one payment cannot together exceed its refundable amount. Writes against different invoices do not block each other. Any failure rolls back the row, the derived pair and the audit event together.

### 4.7 GraphQL surface

- **`Payment` type — intentional public fields:** `id`, `invoiceId`, `type`, `method`, `amountMinorUnits`, `reference`, `status`, `paidAt`, `refundedPaymentId`, `recordedByStaffId` (nullable `ID`), `createdAt`; plus the resolve-fields `refundableMinorUnits: Int` (the refundable amount for a `COMPLETED` `PAYMENT`, `null` for a `REFUND`; batched, mechanism M4) and the `invoice: Invoice!` relation. `@Authorize(tenantReadAuthorizer)`; read-only (no nestjs-query create/update/delete).
  - **Not exposed:** `tenantId` (the platform rule for every type) and `idempotencyKey`. The key is a write-side deduplication token. No read consumer needs it, and exposing it would let any reader see the token for a write they did not make.
  - **Staff identity:** only the opaque `recordedByStaffId`. `AdminUser` has no display name, only `email`, and staff listing (`admins`) is `TENANT_OWNER`-only today. This type therefore adds **no** resolve-field that reveals a staff email to the six read roles. The web resolves the id as described in §4.10.
- **`Invoice.payments`** — nested offset connection, no `totalCount`, default sort `paidAt ASC, createdAt ASC, id ASC` (`id` makes the order total and deterministic even when two rows share both timestamps), platform paging defaults/max; added to `paginated-collections-allowlist`. Authorized by the root operation that reaches it (multi-tenant RFC §4.2 relation-field rule); the target authorizer re-applies the tenant predicate.
- **Mutations** (separate resolver class, `AuthGuard` + `@Roles`):

| Mutation | Input | Returns | Roles | Audit |
| --- | --- | --- | --- | --- |
| `recordInvoicePayment` | `RecordInvoicePaymentInput { invoiceId: ID!, idempotencyKey: ID!, method: PaymentMethod!, amountMinorUnits: Int!, reference: String, paidAt: DateTime }` | `Payment!` | `TENANT_OWNER`, `OPS_MANAGER`, `FINANCE`, `CUSTOMER_SUPPORT` | `payment.recorded` |
| `refundInvoicePayment` | `RefundInvoicePaymentInput { paymentId: ID!, idempotencyKey: ID!, method: PaymentMethod!, amountMinorUnits: Int!, reference: String, paidAt: DateTime }` | `Payment!` | `TENANT_OWNER`, `FINANCE` | `payment.refunded` |

  `Payment` exposes an `invoice: Invoice!` relation so a caller can re-read the new derived pair in the same response.
- **Reads** of `Payment` (via `Invoice`): all six tenant roles (`VIEW_ROLES`), as for invoices.
- **Role identifiers** are the platform `Role` enum on `main` (`apps/api/src/platform/auth/domain/role.ts`): `TENANT_OWNER`, `OPS_MANAGER`, `SCHEDULER`, `CUSTOMER_SUPPORT`, `FINANCE`, `ANALYST` (plus the platform-only `SUPER_ADMIN`, which is in no list here). No role is introduced or renamed. The record roles equal the laundry resolver's existing `PAYMENT` constant.
- **No client-settable derived pair:** no input type in the schema has a `paymentStatus` or `amountPaidMinorUnits` field, and `Invoice` keeps no nestjs-query create/update mutation. The root-operation authorization metadata guard is updated for the two new mutations.
- `registerEnumType` for `PaymentType`, `PaymentMethod`, `PaymentRecordStatus`; `InvoicePaymentStatus` gains the two values; `@clensy/client` is regenerated.

### 4.8 Relationship to the laundry order and payment terms

- **Order status is neither read nor written.** A payment may be recorded or refunded whatever the order's status, including `COMPLETED`, `CANCELLED`, or `REFUNDED`. This is what makes pay-later and pay-on-delivery work: money is recorded when it is received, even after the order is delivered.
- The existing order verbs "Mark awaiting payment" / "Mark paid" / "Refund" are unchanged and remain separate from invoice payments, as #166 established. The UI states this (§4.10).
- **`paymentTerms` and `dueDate` are informational.** They tell staff when payment is expected; they never block or allow a write. Paying early under `PAY_ON_DELIVERY` is valid; so is paying late under `PAY_NOW`. "Supports pay-now / pay-on-completion / pay-on-delivery" means each term's normal collection moment (at issue, at completion, at delivery) can be recorded, with `paidAt` reflecting when it happened.

### 4.9 Migration

One migration (`up` + `down`):

1. `ALTER TYPE invoice_payment_status_enum ADD VALUE 'OVERPAID'`, then `'REFUNDED'`. (`ADD VALUE` cannot be used in the same transaction that adds it — irrelevant here, as no row uses them during the migration. `down` recreates the enum without them and MUST fail loudly if any row holds either value, rather than rewriting data.)
2. `ALTER TABLE invoice_entity ADD CONSTRAINT uq_invoice_id_tenant UNIQUE (id, "tenantId")` — the target for the composite FK (it does not exist today).
3. PG enums `payment_type_enum`, `payment_method_enum`, `payment_record_status_enum` (module-local).
4. `payment_entity` with the §4.2 columns, and:
   - FK `("tenantId") → tenant(id)`.
   - Composite FK `("invoiceId", "tenantId") → invoice_entity(id, "tenantId")` `ON DELETE RESTRICT`.
   - `UNIQUE (id, "invoiceId", "tenantId")` and a composite FK `("refundedPaymentId", "invoiceId", "tenantId") → payment_entity(id, "invoiceId", "tenantId")` `ON DELETE RESTRICT` — so a refund can only reference a payment of the same invoice and tenant, enforced in the database.
   - `CHECK ("amountMinorUnits" > 0)`.
   - `CHECK (("type" = 'REFUND') = ("refundedPaymentId" IS NOT NULL))`.
   - Not database-enforced, by design: that the referenced row's `type` is `PAYMENT` and its `status` is `COMPLETED`. A `CHECK` cannot read another row, and no trigger is introduced. §4.5 B4 enforces both under the invoice lock, and §7 tests that a refund of a refund is rejected.
   - FK `recordedByStaffId → admin_user_entity(id)` `ON DELETE RESTRICT` (nullable). Whether this must also be tenant-composite is decided in M4 against how other staff references are modelled; it MUST NOT weaken tenant isolation.
   - `UNIQUE ("tenantId", "idempotencyKey")` (`uq_payment_tenant_idempotency_key`).
   - Indexes: `("tenantId", "invoiceId", "paidAt")`, `("refundedPaymentId")`.
5. No data backfill (§4.4).

The new table joins every existing tenant-wide test fixture that enumerates tenant-owned tables: the two-tenant release gate (world, snapshot, probes), test-tenant removal, and the billing test lock helper. `docs/development/database-migrations.md` conventions apply.

### 4.10 Web

A shared **invoice payments panel** (one component, `@clensy/ui` primitives only, i18n per the app's existing message setup) is rendered:

- on `/app/laundry/[id]` inside the existing "Invoice and payment" invoice card, when an invoice exists; and
- in the `/app/billing` invoice `DetailDrawer`, below the amount block.

Contents:

- **Amounts:** total, amount paid (net), and amount due; a negative due renders as "Overpaid by ₱x". Payment status badge.
- **Negative money formatting (existing defect, fixed here).** `formatMinorUnits` (`apps/web/lib/format-price.ts`) mishandles negatives today: `-150` renders `₱-1.-50`, and `-50` renders `₱0.-50`. This slice makes it sign-aware (`−₱1.50`), still integer-only. Every surface that shows `amountDueMinorUnits` or a refund amount uses it.
- **History:** every row in the connection's order (§4.7): date (`paidAt`, shown in `Asia/Manila`), type ("Payment" / "Refund"), method label, amount (refunds shown as money out, e.g. "−₱50.00"), reference, recorded by. A refund row names the payment it refunds. **Recorded by** shows "You" when `recordedByStaffId` equals the viewer's `currentAdmin` id. For a `TENANT_OWNER` it shows the staff email from the existing `admins` list. Otherwise it shows "Staff member". No new staff read is added.
- **Record payment** (`FormDialog`): method (required), amount in pesos (required; parsed with the existing `parsePesosToMinorUnits`; pre-filled with the amount due when it is positive), reference (optional), paid at (date-time, defaults to now, cannot be in the future). Shown to the four record roles. Hidden when the invoice is `VOID`.
- **Refund** (action on each `PAYMENT` row with `refundableMinorUnits > 0`; `FormDialog`): method, amount (pre-filled with and capped in the UI at the refundable amount), reference, paid at. Shown to `TENANT_OWNER` and `FINANCE`. Uses `ConfirmDialog`-level wording only if the existing destructive-verb convention requires it (M4 checks).
- After a write: success toast, refetch the invoice (derived pair + history). Failure: inline alert with the server message. One in-flight write at a time (reuse the page's shared pending flag on the laundry page).
- The "Order payment" card's existing copy ("separate from the invoice payment status") stays; no order verb is added or removed.
- `INVOICE_PAYMENT_STATUS_TONE` gains `OVERPAID: 'warning'` and `REFUNDED: 'neutral'`. The laundry message catalogue's `invoicePaymentStatus` gains "Overpaid" and "Refunded", and labels are added for every method and type.
- **Existing billing screens:** the `/app/billing` list "Amount due" column and the drawer amount block show an overpaid due as "Overpaid by ₱x", not a bare negative. The billing list and drawer currently print the raw enum (`PARTIALLY_PAID`) as the badge label; they switch to the same translated labels the laundry page uses, so the new statuses do not ship as raw enums.

The server is authoritative for roles and amounts; UI gating is a mirror.

### 4.11 Compatibility with #38 and the current screens

Checked against the Accepted #38 text and the code on `main` (2026-11-02):

| #38 statement | Effect of this slice |
| --- | --- |
| §3 / §4.2 / §4.5 / §6: `0 <= amountPaidMinorUnits <= totalMinorUnits` | Replaced by Amendment #39 §9.1 item 2 (`>= 0`, equals net paid). |
| §3: "#39 owns the transitions among the first three" statuses | #39 owns `UNPAID` / `PARTIALLY_PAID` / `PAID` / `OVERPAID` / `REFUNDED`. `VOID` is still not produced. |
| §4.5 generation invariants (`amountPaid = 0`, `UNPAID`, `amountDue = total` at generation) | Unchanged: generation is untouched, and a fresh invoice has no payment rows. |
| §4.4 immutable commercial snapshot | Unchanged: the port writes only the derived pair. |
| §4.7 `amountDueMinorUnits` = `total − amountPaid`, derived | Unchanged formula, now possibly negative (Amendment §9.1 item 3). |
| §4.10 web tones (`UNPAID` neutral, `PARTIALLY_PAID` warning, `PAID` success, `VOID` danger) | Kept. Adds `OVERPAID` warning and `REFUNDED` neutral (Amendment §9.1 item 6). |
| `INVOICE_PAYMENT_STATUS_TONE` is a `Record<InvoicePaymentStatus, …>` | Adding enum values breaks the web type-check until both new tones exist. That is intended: no screen can silently miss a status. |
| `laundry-invoice-payment.tsx` "Order payment" card: "separate from the invoice payment status" | Still true (§4.8). Kept. |
| §4.7 / §4.10 role lists name `OWNER` | `OWNER` is the pre-tenancy identifier. The Accepted multi-tenant RFC §4.3 replaced it with `TENANT_OWNER` in every module role list, and `main` has no `OWNER` (`generateInvoiceFromOrder` is `@Roles(Role.FINANCE, Role.TENANT_OWNER)`). This spec uses `TENANT_OWNER` throughout. No #38 behavior changes. |

---

## 5. Rationale

- **Separate `modules/payments`, billing as sole invoice writer.** The ticket asks for `modules/payments`, and the #38 rationale already drew this boundary ("#39 has a distinct 1:N payment-event lifecycle"). Keeping billing the only writer of `invoice_entity`, behind a port that accepts only the derived pair, preserves #38's "only the derived pair may move" guarantee by construction rather than by convention.
- **Type discriminator plus positive amount.** This is the ticket's stated reason, and it also lets a single `CHECK (> 0)` guard every row and keeps report queries free of sign logic.
- **Recompute from the full row set under an invoice row lock.** An incremental update can drift, and an optimistic retry adds a failure mode staff would see. Pessimistic locking is the established pattern (`LaundryOrdersService` transitions), and one invoice has few payments, so the full recompute is cheap. The lock also makes the refund ceiling race-free without a separate counter.
- **Append-only rows.** The ticket requires that a refund never mutate the original. Extending the rule to every row gives reporting (#43) an immutable ledger.
- **Database-enforced same-invoice refunds.** The multi-tenant RFC requires database constraints, not only application checks, for same-tenant references. Including `invoiceId` in the refund's composite FK extends that guarantee to "same invoice" at no extra cost.
- **No coupling to order status.** The ticket scopes this as money movement "independent of the invoice's own document lifecycle", and #154/#166 deliberately kept the order's "Mark paid" separate. Auto-transitioning orders would change the #37 matrix's actors and audit trail, which needs its own amendment.

### 5.1 Author calls for M3 to confirm (owner skipped M2 questions)

Decision record: calls 2, 3, 4, 5, 6, 9, 10 and 12 were provisionally confirmed at the pre-M3 review (2026-11-02). Calls 1, 7, 11 and 13 were confirmed at M3 round 1 (2026-11-02). Call 6's owner role is the platform identifier `TENANT_OWNER`. This record is not M3 acceptance of the document.

1. **Module split** — `modules/payments` plus a billing write port (above), not payments inside `modules/billing`.
2. **`VOIDED` → keep the existing `VOID`.** It is already in the Accepted #38 spec, the PG enum, the GraphQL schema and the web tone map, and no row holds it. A rename would be churn with no behavior change.
3. **Status precedence** (§4.3): `REFUNDED` only when net is zero after at least one refund; a partial refund reads as `PARTIALLY_PAID` (the ticket's own test case).
4. **Overpayment is accepted and recorded**, not rejected. The ticket defines `OVERPAID`, and change-giving errors happen. It is corrected by refunding the excess.
5. **Methods** — `CASH | GCASH | MAYA | BANK_TRANSFER | CARD | OTHER`, chosen for a Philippine (₱, Asia/Manila) laundry shop.
6. **Roles** — recording uses the four roles that already "Mark paid" at the counter (`TENANT_OWNER`, `OPS_MANAGER`, `FINANCE`, `CUSTOMER_SUPPORT`). Refunding (money out) is restricted to `TENANT_OWNER` and `FINANCE`. This is deliberately narrower than the laundry order's operational `refundLaundryOrder` verb, which also allows `OPS_MANAGER`: moving an order to `REFUNDED` returns no money, but this refund records cash out.
7. **`PaymentRecordStatus`** — defined with `PENDING` / `FAILED` reserved; v1 writes only `COMPLETED` (the #38 `VOID` precedent).
8. **No correction of mistaken entries in v1.** A mis-keyed overpayment is fixed with a refund of the excess. A proper "void entry" operation is a follow-on if staff need it.
9. **Terms are informational** (§4.8): there is no enforcement and `dueDate` is never backfilled.
10. **Payments allowed whatever the order's status**, including on an invoice whose order was later `CANCELLED` (possible because `PRICED → CANCELLED` is legal after invoicing). Voiding such invoices belongs with the future void ticket.
11. **Negative `amountDueMinorUnits`** when overpaid, not clamped to zero.
12. **Past-dated `paidAt`** is allowed, so money already taken (orders marked `PAID` before #39 shipped) can be recorded retroactively. Future dates are rejected.
13. **Required idempotency key on both payment writes** (§4.5). A double-click or a retry after a lost response would otherwise record money twice, and the in-flight UI flag cannot prevent the retry case. Refunding the duplicate would leave a misleading ledger.

### 5.2 Known tension (informative, not resolved here)

Under #37, `PROCESSING` is reachable only from `PAID`, so a `PAY_ON_COMPLETION` / `PAY_ON_DELIVERY` order must still be marked operationally "paid" before work starts, even though no money has moved yet. This ticket records that money correctly when it arrives, but it does not change the order gate. If the owner wants terms to relax the prepaid gate, that is a #37 amendment and a separate ticket.

---

## 6. Acceptance criteria (for this specification)

This Draft may move to Accepted after M3 when:

- The `Payment` field list (§4.2) and migration (§4.9) are complete enough to write the entity and migration without further design, including every constraint that enforces type/reference consistency, same-tenant and same-invoice references, and positive amounts.
- `deriveInvoicePayment` (§4.3) is a total, ordered rule over every combination of rows, with `VOID` and negative-net handling stated.
- The amended #38 invariants (§4.4) are recorded as Amendment #39 in the #38 specification, and that amendment is Accepted together with this document. The rest of #38 is unaffected.
- The transaction and lock contract (§4.6) names the correctness mechanism for concurrent payments and concurrent refunds.
- Role gating for both mutations and for reads is explicit and uses the platform `Role` identifiers (§4.7).
- The maximum supported amount and net paid are stated, with the rejecting check and the derivation guard (§3, §4.3, §4.5 A2/B7).
- Payment history order is total (`paidAt, createdAt, id`), and the `Payment` type's public and withheld fields are listed (§4.7).
- Duplicate-submission and failed-transaction behavior is stated (§4.5, §4.6), and the compatibility table (§4.11) shows no contradiction with the unamended remainder of #38.
- The "client cannot set `paymentStatus`" criterion is stated as a schema-level property that can be tested (§4.7).
- Every author call in §5.1 is confirmed or overturned by the owner.
- Non-goals (§2) are explicit enough to stop gateway, order-coupling, voiding, entry-correction and reporting work from entering M4–M6.

---

## 7. Tests expected (informative — M4 owns the plan)

- **Unit — `deriveInvoicePayment`:** no rows; a single full payment; multiple partials reaching `PAID`; overpayment; refund of the excess back to `PAID`; partial refund of a `PAID` invoice → `PARTIALLY_PAID`; full refund → `REFUNDED`; a payment after `REFUNDED`; non-`COMPLETED` rows ignored; zero-total invoice; `VOID` throws; negative net throws.
- **Unit — command validation:** every row of the §4.5 A and B tables, in the stated order, including the refund ceiling and the `paidAt` bounds. **Invalid idempotency keys** on both commands: empty string, non-hex characters, wrong group lengths, missing hyphens, and a valid UUID with surrounding whitespace each → 400 before any database access. A non-v4 deterministic key (`00000000-0000-0000-0001-000000000001`) is accepted.
- **Unit/e2e — integer range:** `deriveInvoicePayment` with net exactly `MAX_MINOR_UNITS` → accepted; with net `MAX_MINOR_UNITS + 1` → `RangeError`. A payment that brings net paid to exactly `MAX_MINOR_UNITS` → recorded. One more minor unit → 400, with no row, an unchanged derived pair and no audit event. A refund on an invoice at `MAX_MINOR_UNITS` → allowed. `amountMinorUnits` of 0, −1, and `MAX_MINOR_UNITS + 1` (rejected by GraphQL `Int` or by A2) → rejected.
- **e2e — concurrency:** N concurrent `recordInvoicePayment` calls against one invoice end with `amountPaidMinorUnits` equal to the sum of the rows and a status consistent with it. Two concurrent refunds of one payment whose sum exceeds its refundable amount: exactly one succeeds. Deterministic, in the spirit of the `PricingRule` race test (#138): a barrier proves both transactions overlapped. The test must not just fire both calls and hope.
- **e2e — idempotency:** the same key and request sent twice → one row, one audit event, and the same response. The same key with a different amount → 409. Two concurrent same-key requests → one row.
- **e2e — failed write:** a write that fails under the lock (e.g. over-refund) leaves no row, unchanged `amountPaidMinorUnits` / `paymentStatus`, and no audit event.
- **e2e — refund flow:** record a payment → `PAID`, then a partial refund → `PARTIALLY_PAID` with the refund row referencing the original, which is unchanged. Refund the rest → `REFUNDED`. Over-refund → 400.
- **e2e — payment history order:** rows with equal `paidAt` and equal `createdAt` come back in `id ASC` order, and the order is identical across repeated reads and pages.
- **e2e — public fields:** introspection of `Payment` shows the §4.7 field list and no `idempotencyKey` or `tenantId`.
- **e2e — refund of a refund / non-completed original:** rejected by B4 (400), with no row written.
- **e2e — derived pair not settable:** schema introspection shows no input field named `paymentStatus` or `amountPaidMinorUnits`; `Invoice` has no create/update mutation.
- **e2e — authorization:** the role matrix for both mutations (allowed and forbidden roles), reads for all six roles, unauthenticated rejected.
- **e2e — tenant isolation:** a cross-tenant `invoiceId` / `paymentId` → not found. `Invoice.payments` never returns another tenant's rows. The release gate covers `payment_entity`.
- **Migration e2e:** up/down, the constraints reject a refund with no original, a `PAYMENT` with an original, a cross-invoice original, and a non-positive amount; `down` refuses when `OVERPAID` / `REFUNDED` rows exist.
- **Web — money formatting:** `formatMinorUnits` for 0, positive, −50 and −150, integer-only.
- **Web:** panel render states (no rows, mixed history, overpaid, refunded, void), role gating of both dialogs, amount parsing/pre-fill, refetch after a write, failure alert.

---

## 8. Explicit deferrals / follow-ons

- Payment gateway integration and customer-initiated payment (`recordedByStaffId = null`, `PENDING` / `FAILED`).
- Voiding an invoice (producing `VOID`) and voiding mistaken payment entries.
- Any automatic link between invoice payment status and `LaundryOrder.status`, and relaxing the prepaid-processing gate by terms (§5.2).
- A root `payments` query, reconciliation and cash-drawer reports (#43).
- Receipts, printing and customer notifications.
