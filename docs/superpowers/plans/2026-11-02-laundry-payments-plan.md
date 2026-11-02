# Laundry Invoice Payments & Refunds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Accepted** (M5), 2026-11-02 — M4 revision 4, with the round 4 non-blocking notes folded in (wording and test-setup clarifications only). |
| M5 history | **Round 1** (2026-11-02, fresh independent reviewer, read-only, nothing executed): **REVISE**. Three blockers: (1) the new staff/invoice references break `admins.service*.e2e-spec.ts` (bare `TRUNCATE` of a referenced table) and `billing.service.e2e-spec.ts` (explicit entity list), and the Task 3 commit would not boot; (2) "Load more" would not append rows under Apollo 3.14 with no merge policy, and the planned test could not detect it; (3) already-passing `formatMinorUnits` cases were not labelled characterization tests. Decisions b, c, l accepted; f accepted with amendments; j accepted with the rationale corrected. Revision 2 resolves all three blockers, both amendments and the non-blocking notes — see the [M5 round 1 resolution table](#m5-round-1-resolution). **Round 2** (2026-11-02, a different fresh independent reviewer, read-only, nothing executed): **REVISE**. Confirmed the three round 1 blockers resolved and decisions f and j accepted. Two new blockers: (N1) Task 5 adds a GraphQL type, a custom object field and two root mutations but no task updated the guard suites that pin the live surface (`tenant-read-authorizers`, `laundry-billing.tenant-isolation`, and the hard-coded counts in `root-operation-authorization` and `two-tenant-release-gate`); (N2) the Task 7 characterization break ("lose centavos padding") fails only the `0` case. Seven non-blocking notes. Revision 3 resolves both blockers and all seven notes — see the [M5 round 2 resolution table](#m5-round-2-resolution). **Round 3** (2026-11-02, focused re-check by a third fresh independent reviewer, read-only, nothing executed): **REVISE**. N1, N2 and the seven round 2 notes confirmed resolved, with evidence; decisions b, c, l, f, j unchanged; no spec contradiction. One blocker present in every revision: (B1) existing `apps/web` suites broken by Tasks 7 and 9 and named by no task — the four-entry tone test, the laundry page interaction suite, and stubbing/case-5 changes in two Task 9 files. Four non-blocking notes. Revision 4 resolves B1 and the four notes — see the [M5 round 3 resolution table](#m5-round-3-resolution). **Round 4** (2026-11-02, focused B1 re-check by a fourth fresh independent reviewer on the most capable model, read-only, nothing executed; it diffed revision 4 against revision 3 and read the affected web, API and release-gate sources): **ACCEPT**. B1(a), B1(b), B1(c) and the four round 3 notes resolved with file:line evidence; no new blocker; no contradiction with spec §4.10. Five non-blocking notes, folded in after acceptance (see the [M5 round 4 notes](#m5-round-4-notes)). **M5 decision:** Accepted by the project owner, 2026-11-02. **Evidence limitation:** every review round was read-only; no plan step or `Expected:` line has been executed — they remain predictions until M6 records actual results. |
| Date | 2026-11-02 |
| Tracking issue | [#39](https://github.com/rexescario-dev/clensy-platform/issues/39) "Payments & Financial Lifecycle for Laundry Invoices" |
| Branch | `docs/39-laundry-payments-spec` (carries the Accepted spec, Amendment #39 and this plan). M6 continues on this branch, or a `feat/39-laundry-payments` branch cut from it; one PR for spec, plan and implementation (process spec §2.8). |
| Implements (Accepted) | [Laundry Invoice Payments & Refunds](../specs/2026-11-02-laundry-payments-design.md), Status **Accepted** 2026-11-02 (M3), and [Amendment #39](../specs/2026-09-06-laundry-invoices-design.md#9-amendment-39--payment-recording) to the Laundry Invoices spec, Accepted 2026-11-02. M3 evidence limitation: maintainer acceptance on self-review; spec test expectations not executed. |
| Relies on (Accepted) | [Laundry Invoices](../specs/2026-09-06-laundry-invoices-design.md) (remainder unchanged); [Multi-Tenant Architecture](../specs/2026-09-23-multi-tenant-architecture-design.md) §4.2 (relation fields), §4.4–§4.5 (composite FKs), §4.6 (audit); [Laundry Orders & Lifecycle](../specs/2026-09-06-laundry-orders-lifecycle-design.md) incl. Amendment #164 (unchanged; read only for the page). |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. File names, helper names, copy keys, task order and test file layout are planning decisions, not product semantics. |
| Scope | `apps/api` (new `modules/payments`; `modules/billing` enum, write port, entity relation and GraphQL connection; one migration; tests and release-gate fixtures), `packages/client` (operations, regenerated client), `packages/web` (laundry copy), `apps/web` (money/time helpers, payments panel, laundry page and billing drawer wiring), `docs/development/database-migrations.md`. No `@clensy/ui` change. No new dependency. No change to `modules/laundry` source. |
| Package names | `pnpm --filter api` is `apps/api`; `pnpm --filter web` is `apps/web`; `pnpm --filter @clensy/web` is `packages/web`; `pnpm --filter @clensy/client` is `packages/client`. |
| Pre-validation | **None.** No code in this plan was run before M5. Every `Expected:` line is a prediction until M6 records the actual result. |
| M7 | Application code, authorization, tenant isolation and schema change. `CLAUDE.md` requires a **fresh independent reviewer** on the most capable model, given the Accepted spec, this plan and the branch diff. |

**Goal:** Staff record payments and refunds against a laundry invoice; the invoice's `amountPaidMinorUnits` and `paymentStatus` are always derived server-side from those rows, transaction-safely, and shown with the payment history on the laundry order page and the billing invoice drawer.

**Architecture:** A new `modules/payments` owns the `Payment` ledger (entity, pure derivation, two commands, GraphQL type and mutations). `modules/billing` stays the only writer of `invoice_entity` through a narrow `InvoicePaymentWriter` port (lock + persist the derived pair). `Invoice.payments` is a nestjs-query nested offset connection backed by an `InvoiceEntity → PaymentEntity` relation; the target's tenant authorizer is resolved globally, so billing never imports `PaymentsModule`. The web adds one `InvoicePaymentsPanel` that loads its own invoice payments query and is mounted on both pages.

**Tech Stack:** NestJS 11, TypeORM (PostgreSQL), `@nestjs/graphql` + `@ptc-org/nestjs-query` 9.5, `dataloader`, Jest (unit + e2e); Next.js / React, Apollo client codegen, Vitest (jsdom).

**Spec:** `docs/superpowers/specs/2026-11-02-laundry-payments-design.md` (+ Amendment #39 in `docs/superpowers/specs/2026-09-06-laundry-invoices-design.md` §9). Executors read both.

---

## Global Constraints

Copied from the Accepted spec. Every task implicitly includes them.

- `MAX_MINOR_UNITS = 2147483647`. Every amount and net paid is an integer in range; no floating point on money anywhere (spec §3, §4.3).
- `PaymentType = PAYMENT | REFUND`; `PaymentMethod = CASH | GCASH | MAYA | BANK_TRANSFER | CARD | OTHER`; `PaymentRecordStatus = COMPLETED | PENDING | FAILED`, v1 writes only `COMPLETED` (spec §3).
- `InvoicePaymentStatus = UNPAID | PARTIALLY_PAID | PAID | OVERPAID | REFUNDED | VOID`; no #39 operation enters or leaves `VOID` (spec §3; Amendment §9.1 item 1).
- Payment rows are append-only: no update, no delete, no GraphQL update/delete (spec §4.2).
- `billing` is the only writer of `invoice_entity`; the port writes only `amountPaidMinorUnits` and `paymentStatus` (spec §4.1).
- `payments` does not import from `laundry`; no `LaundryOrder` status is read or written (spec §4.1, §4.8).
- Roles (platform `Role` enum): record = `TENANT_OWNER, OPS_MANAGER, FINANCE, CUSTOMER_SUPPORT`; refund = `TENANT_OWNER, FINANCE`; reads = all six tenant roles (spec §4.7).
- Check order is exactly spec §4.5 A1–A4 (before the transaction) then B1–B7 (under the invoice lock); first failure wins.
- Error types: not found → `NotFoundException`; idempotency mismatch → `ConflictException`; every other check → `BadRequestException` (spec §4.5).
- Audit actions `payment.recorded` / `payment.refunded`, `entityType: 'payment'`, `entityId: payment.id`, `tenantAuditTags`; none on an idempotent replay (spec §4.5, §4.6).
- `Invoice.payments` sort `paidAt ASC, createdAt ASC, id ASC`, no `totalCount` (spec §4.7).
- `Payment` GraphQL fields exclude `tenantId` and `idempotencyKey`; staff identity only as `recordedByStaffId` (spec §4.7).
- Web: "Recorded by" = "You" / staff email for `TENANT_OWNER` (from `admins`) / "Staff member"; `paidAt` entered and shown in `Asia/Manila`; sent only when the user changed it (spec §4.5, §4.10).
- `formatMinorUnits` renders negatives as `−₱1.50` (U+2212), integer-only (spec §4.10).
- The GraphQL object class for `Payment` is `PaymentObjectType` (`@ObjectType('Payment')`); `PaymentType` always means the domain enum (GraphQL enum `PaymentType`).
- `payment.type.ts` (the `PaymentObjectType` file) never imports `invoice.type.ts`; only `invoice.type.ts` → `payment.type.ts` and `payment.resolver.ts` → `invoice.type.ts` edges exist (decision l).
- A3 counts characters as Unicode code points (`[...reference].length`), matching PostgreSQL `varchar(120)` character semantics (spec §4.2 "max 120 characters").
- Every task's commit boots `AppModule` and leaves every pre-existing suite it touches passing; each task's verification step names the boot check.
- App code goes through `@clensy/ui`; never import shadcn/ui directly (project memory). Use the `ui-ux` and `javascript-conventions` skills in M6.

## Review Focus

Failure modes the spec implies that are most likely to bite a real user; each has a pinned test in the named task.

1. **Double-submit / lost response on Record payment** — a double click or a retry must never create two payments. Pinned: Task 4 Step 1 (replay unit), Task 6 Step 1 (e2e replay + concurrent same-key), Task 8 Step 1 (key reused across a retry, new key after success).
2. **Two staff refunding the same payment at once** — total refunds must never exceed the payment. Pinned: Task 6 Step 2 (deterministic lock race, `refund-race` condition).
3. **Negative amounts on screen** — an overpaid invoice must not render `₱-1.-50`. Pinned: Task 7 Step 1, Task 8 Step 1.
4. **Back-dated entry near midnight Manila** — a payment entered as 00:30 Manila on a date is stored as the previous UTC day and displayed back as 00:30 Manila. Pinned: Task 7 Step 3.
5. **A non-owner sees a staff email** — "Recorded by" must not leak emails to non-owners. Pinned: Task 8 Step 1 (`recordedByLabel`, and the panel render test asserting `useAdminsQuery` is skipped for non-owners).

---

## Planning decisions for M5 to confirm

| # | Decision | Why |
| --- | --- | --- |
| a | The billing port is a new injectable `InvoicePaymentWriter` in `modules/billing/application/services/`, exported from `BillingModule`, with exactly `lockForPayment` and `applyDerivedPayment`. | Spec §4.1 fixes the port's two capabilities; a separate class keeps `InvoicesService` (generation) untouched. |
| b | `recordedByStaffId` gets a **tenant-composite** FK `("recordedByStaffId","tenantId") → admin_user_entity(id,"tenantId")`, which requires a new `uq_admin_user_id_tenant UNIQUE (id,"tenantId")` on `admin_user_entity`. | Spec §4.9 leaves this to M4 and forbids weakening isolation. No table references `admin_user_entity` today, so there is no precedent; the composite FK is the RFC §4.4 rule. `MATCH SIMPLE` skips the check when `recordedByStaffId` is null. |
| c | All A-checks (A1–A4) run in `PaymentsService` before the transaction, not in class-validator decorators. Input DTOs carry only type-shape decorators (`@IsString`, `@IsInt`, `@IsEnum`, `@IsOptional`, `@IsDate`) to satisfy `whitelist`. | Spec §4.5 fixes one ordered sequence with first-failure-wins; split validation between the pipe and the service would reorder it. |
| d | `refundableMinorUnits` is batched by a request-scoped `RefundableAmountLoader` (the `ActivePricingLoader` precedent): one grouped `SUM` over completed refunds per tenant per request. | Spec §4.7 says "batched; mechanism M4". |
| e | `Payment.invoice` is a hand-written `@ResolveField` calling `InvoicesService.getInvoice(id, tenantId)`; `PaymentObjectType` gets no nestjs-query read resolver and no root query. | Spec §2 forbids a root `payments` query; a `Relatable` resolver would need one. |
| f | The concurrency e2e uses a **payment save barrier** (the #138 `PricingRule` barrier technique, `catalog.service.e2e-spec.ts:484–720`). **Intercepted call:** exactly `EntityManager.prototype.save(entity)` with a single `PaymentEntity` instance argument — the only insert shape Task 4 permits; any other `save` shape carrying a `PaymentEntity` fails the test at once. On interception the barrier reads the paused call's backend pid on the same transactional manager (`SELECT pg_backend_pid()`), then pauses. **Waited-on statement:** the other calls block in `InvoicePaymentWriter.lockForPayment`, i.e. TypeORM's `SELECT … FROM "invoice_entity" … FOR UPDATE`. **Conditions** (polled from `pg_stat_activity` on a separate `DataSource` connection, every 20 ms, timeout 3000 ms; every poll is restricted to `datname = current_database() AND pid <> pg_backend_pid()`, so backends of other databases on the same server and the polling connection itself are never counted): `refund-race` — one other backend with `wait_event_type = 'Lock'`, `pg_blocking_pids(pid)` containing the paused pid, and `query` matching `/FROM "invoice_entity".*FOR UPDATE/s`; `record-queue` (N = 5) — exactly 4 other backends with `wait_event_type = 'Lock'`, a non-empty `pg_blocking_pids`, and that same `query` match, and at least one of them blocked directly by the paused pid (tuple-lock queueing makes later waiters block on the head waiter, so "all blocked by the paused pid" is not required). Only the first arriving save is paused; later saves pass through. A missed condition rejects the paused save (rolling it back) and fails with a diagnostic naming the condition and the observed wait state. No sleeps. | Spec §7 requires a deterministic overlap proof; M5 round 1 amendment. |
| g | Web `paidAt` uses a native `<input type="datetime-local">` interpreted as `Asia/Manila` (fixed UTC+8, no DST): `YYYY-MM-DDTHH:mm` → `YYYY-MM-DDTHH:mm:00+08:00`. | Spec §4.2 / §4.10; no date library in the tree. |
| h | Payment history pages are **accumulated in hook state, not in the Apollo cache**. `useInvoicePaymentHistory` reads page 0 with `useInvoicePaymentsQuery` (`offset: 0`, `network-only`); "Load more" calls `client.query` for `InvoicePaymentsDocument` with `offset = nextOffset` and `fetchPolicy: 'network-only'`, appending the page's nodes to state; the rendered list is `mergePaymentPages([page0, ...extra])`, which concatenates in page order and keeps the **first** occurrence of each `id`. **Offset rule:** `nextOffset = lastOffset + lastPage.length`, where `lastOffset`/`lastPage` are the offset and raw (pre-de-duplication) nodes of the most recently fetched page (page 0: offset `0`); it never uses `merged.length`, so a page whose rows are all duplicates still advances the offset. `hasNextPage` comes from the most recent page. **Generation counter:** the hook keeps a `generation` ref; `reload()` increments it, clears the extra pages, resets `loadingMore`/`loadMoreFailed`, and refetches page 0; `loadMore()` captures the generation at start and discards its result (no append, no error flag) if the generation changed before the page arrived, so an in-flight page can never be appended to a freshly reloaded list. **Why no duplicates and no gaps:** the server order (`paidAt, createdAt, id`) is total, and rows are append-only (no delete), so a concurrent insert can only shift later rows to higher offsets — a following page may repeat rows (removed by the `id` de-duplication) but can never skip one. | Apollo 3.14 with the repo's plain `InMemoryCache()` (`packages/client/src/apollo-client.ts`, no `typePolicies` / `updateQuery` anywhere) stores each `offset` separately and never merges pages. Spec §4.10 "every row"; M5 round 1 blocker 2. |
| i | The laundry page's mutation lock gains owner `'payment'`; the billing drawer has no page lock and relies on the panel's own in-flight guard. | Spec §4.10 "reuse the page's shared pending flag on the laundry page". |
| j | Refund uses `FormDialog` only (no extra `ConfirmDialog`), with **permanent-action wording** in the dialog: "Refunds are recorded permanently. They cannot be edited or deleted." A refund is a deliberate form submission with an amount entry, not a single-click verb; `ConfirmDialog` in this app guards single-click irreversible order verbs (`LAUNDRY_DESTRUCTIVE_VERBS`), and `FormDialog` already refuses dismissal while submitting (#180). A refund row is permanent: no edit, delete or correction exists (spec §2, §5.1 call 8). | Spec §4.10 "`ConfirmDialog`-level wording only if the existing destructive-verb convention requires it"; the wording above satisfies the laundry lifecycle spec's "destructive/financial" convention without a second dialog. M5 round 1 amendment. |
| l | Billing's persistence and presentation layers reference payments' classes for the relation only: `InvoiceEntity.payments` (`@OneToMany(() => PaymentEntity)`) and `InvoiceType`'s `@OffsetConnection('payments', () => PaymentObjectType)`. `BillingModule` does **not** import `PaymentsModule`. `payment.type.ts` must never import `invoice.type.ts`: nestjs-query evaluates relation type thunks eagerly when `Relatable(InvoiceType…)` is built, so `PaymentObjectType` must be fully defined first. `PaymentEntity` becomes mandatory wherever `InvoiceEntity` is registered (TypeORM metadata), which Task 3 handles; nestjs-query resolves the target authorizer with `moduleRef.get(…, { strict: false })` (`default-crud.authorizer.js`), the mechanism `Invoice.customer` already relies on. | Spec §4.1 allows wiring `Invoice.payments` either way; this is the existing nested-connection pattern and avoids a module cycle. |
| m | **Existing suites.** `admins.service.e2e-spec.ts:80` and `admins.service.disable-concurrency.e2e-spec.ts:72` replace `getRepository(AdminUserEntity).clear()` with `query('TRUNCATE TABLE "payment_entity", "admin_user_entity"')` — an explicit two-table list with **no `CASCADE`**. PostgreSQL refuses a TRUNCATE of a referenced table unless every referencing table is in the same statement, so this statement can never reach a table it does not name; a future table that references `admin_user_entity` makes it fail loudly instead of being silently emptied. Those suites already delete every admin in the test database, so every payment row would have a dangling recorder; the precedent is `cleaners-teams.service.e2e-spec.ts:76–93`. `billing.service.e2e-spec.ts` adds `PaymentEntity` to `ENTITIES` (its `TRUNCATE … "invoice_entity" … CASCADE` already reaches `payment_entity`, the suite's existing practice) and `laundry.service.e2e-spec.ts` needs no change (it registers no `InvoiceEntity`; its CASCADE reaches `payment_entity` through `invoice_entity`, which is intended). No production constraint changes. | M5 round 1 blocker 1. |
| n | `applyDerivedPayment` writes the two columns with **raw SQL**: `UPDATE "invoice_entity" SET "amountPaidMinorUnits" = $1, "paymentStatus" = $2 WHERE "id" = $3 AND "tenantId" = $4`, asserting exactly one row affected. `updatedAt` therefore does **not** change on payment writes. | Spec §4.1: "The port MUST NOT accept or write any other `Invoice` field." `manager.update` / `UpdateQueryBuilder` would also set the `UpdateDateColumn`. If the owner wants `updatedAt` to move, that is a spec change, not a plan choice. |
| o | **Where the amounts appear.** The panel always renders its amounts block (total, amount paid, amount due via `amountDueView`, status badge; spec §4.10 "Contents: Amounts"). **Laundry page:** the laundry `InvoiceFacts` keeps invoice number, terms and the "Open invoice" link and drops its own total and status, because the panel inside the same card shows them. **Billing drawer — spec-literal, recorded interpretation of §4.10:** §4.10 places the panel "in the `/app/billing` invoice `DetailDrawer`, below the amount block" and requires "the drawer amount block [to] show an overpaid due as 'Overpaid by ₱x'". The drawer therefore **keeps its amount block** — Subtotal, Discount, Total, Amount paid, **Amount due** (now rendered through `amountDueView`, so a negative due reads "Overpaid by ₱x") and the payment status row (translated label) — and the panel, with its own amounts block, renders below it. In the drawer, total, amount paid, amount due and status therefore appear twice (drawer block, then panel). This is accepted as the literal reading of the Accepted spec; hiding either copy would be a spec change for the owner, not a plan choice. Revision 2's removal of the drawer's total/paid/due rows is withdrawn. | M5 round 1 note; M5 round 2 note (drawer vs §4.10). |
| q | `newIdempotencyKey()` returns `crypto.randomUUID()` when it exists, and otherwise builds an RFC 4122 v4 UUID from `crypto.getRandomValues(new Uint8Array(16))` (set `byte[6] = (byte[6] & 0x0f) \| 0x40`, `byte[8] = (byte[8] & 0x3f) \| 0x80`, lower-case hex in 8-4-4-4-12 groups). `crypto.randomUUID` exists only in secure contexts (HTTPS or `localhost`); `crypto.getRandomValues` exists in every context, so staff opening the app over plain HTTP from a LAN address still get a canonical key that passes A1. No `Math.random` fallback (a key must be unpredictable and unique; `packages/ui/src/base/toast.tsx:47`'s `Date.now()`/`Math.random` toast-id fallback is not a UUID and is not reused). | M5 round 2 note (non-secure LAN contexts). The app is not established as HTTPS-only, so a fallback is required. |
| r | `PaymentResolver` puts `@UseGuards(AuthGuard)` and `@Roles(…)` on the **two mutation methods only** — never on the class. The `@ResolveField`s `invoice` and `refundableMinorUnits` carry no guard and no `@Roles`. | `relation-field-authorization.e2e-spec.ts:375–394` ("declares no guards or @Roles() on any relation field resolver") reads class-level guards as applying to every handler (#135), so a class-level guard fails it. M5 round 2 note. |
| s | **GraphQL guard suites move with the surface they pin.** Every suite that inventories the live schema, root operations or tenant tables is updated in the task whose commit first changes what it inventories: the release-gate world fixture and `removeTestTenants` in Task 3 (the table appears); all schema/root-operation/role-matrix guards in Task 5 (the type, field and mutations appear). Task 6 adds only the new payments suites. | Global constraint "every task's commit … leaves every pre-existing suite it touches passing"; M5 round 2 blocker N1. |
| p | The insert in `PaymentsService` is exactly `manager.save(manager.create(PaymentEntity, {...}))` — the barrier's interception contract (decision f). | Makes the race test's intercepted call shape explicit. |
| k | Copy lives in `packages/web/src/i18n/messages/en/laundry.ts` under a new `payments` key; the billing page uses `useClensyTranslations('laundry')` for status/method/type labels only. Other billing-page English is untouched. | Spec §4.10 requires translated status labels on billing; nothing more. |

## File map

| File | Responsibility |
| --- | --- |
| `apps/api/src/modules/payments/domain/{payment-type,payment-method,payment-record-status}.ts` | Enums (spec §3) |
| `apps/api/src/modules/payments/domain/payment.ts` | `Payment` interface (spec §4.2) |
| `apps/api/src/modules/payments/domain/money-limits.ts` | `MAX_MINOR_UNITS` |
| `apps/api/src/modules/payments/domain/derive-invoice-payment.ts` | Pure derivation (spec §4.3) |
| `apps/api/src/modules/payments/domain/refundable-amount.ts` | Refundable amount (spec §3) |
| `apps/api/src/modules/payments/domain/idempotency-key.ts` | A1 syntax check |
| `apps/api/src/modules/billing/domain/invoice-payment-status.ts` | + `OVERPAID`, `REFUNDED` |
| `apps/api/src/modules/billing/application/services/invoice-payment-writer.ts` | Billing write port |
| `apps/api/src/modules/billing/infrastructure/persistence/invoice.entity.ts` | + `@OneToMany payments` |
| `apps/api/src/modules/payments/infrastructure/persistence/payment.entity.ts` | `PaymentEntity` |
| `apps/api/src/platform/database/migrations/<ts>-CreatePayments.ts` | The migration (spec §4.9) |
| `apps/api/src/platform/database/data-source.ts` | Register `PaymentEntity` |
| `apps/api/src/modules/payments/application/commands/*.command.ts` | Command shapes |
| `apps/api/src/modules/payments/application/services/payments.service.ts` | Record/refund, refundable lookup |
| `apps/api/src/modules/payments/presentation/graphql/{payment.type,payment.inputs,payment.resolver,refundable-amount.loader,mappers}.ts` | GraphQL surface |
| `apps/api/src/modules/billing/presentation/graphql/invoice.type.ts` | + `payments` connection |
| `apps/api/src/modules/payments/payments.module.ts`, `apps/api/src/app/app.module.ts` | Module wiring |
| `packages/client/src/operations/billing.graphql`, `packages/client/src/generated/graphql.ts` | Operations, generated client |
| `apps/web/lib/format-price.ts`, `apps/web/lib/manila-time.ts`, `apps/web/lib/invoice-payment-status.ts` | Money/time helpers, tones |
| `apps/web/lib/invoice-payments.ts`, `apps/web/lib/use-invoice-payment-mutations.ts` | Pure view rules, write hook |
| `apps/web/components/billing/invoice-payments-panel.tsx` | Shared panel + dialogs |
| `apps/web/app/app/laundry/[id]/page.tsx`, `apps/web/components/laundry/laundry-invoice-payment.tsx`, `apps/web/lib/use-laundry-mutation-lock.ts` | Laundry page wiring |
| `apps/web/app/app/billing/page.tsx` | Billing list/drawer changes |
| `packages/web/src/i18n/messages/en/laundry.ts` | Copy |
| `apps/web/lib/use-invoice-payment-history.ts` | Page accumulation and merge (decision h) |
| `apps/api/src/modules/admins/infrastructure/persistence/admin-user.entity.ts` | Header comment: new `uq_admin_user_id_tenant` |
| `apps/api/test/admins.service.e2e-spec.ts`, `apps/api/test/admins.service.disable-concurrency.e2e-spec.ts`, `apps/api/test/billing.service.e2e-spec.ts` | Existing-suite compatibility (decision m) |
| `apps/api/src/platform/graphql/tests/paginated-collections-allowlist.spec.ts`, `apps/web/lib/laundry-presentation-contract.test.ts` | Static guards for the new connection and copy keys |
| `apps/api/test/helpers/seed-tenant-admin.ts`, `apps/api/test/remove-test-tenants.e2e-spec.ts`, `apps/api/test/release-gate/two-tenant-world.ts` | Test-tenant removal and release-gate world fixture for the new table (Task 3; decision s) |
| `apps/api/test/tenant-read-authorizers.e2e-spec.ts`, `apps/api/test/laundry-billing.tenant-isolation.e2e-spec.ts`, `apps/api/test/root-operation-authorization.e2e-spec.ts`, `apps/api/test/helpers/root-operation-inventory.ts`, `apps/api/test/two-tenant-release-gate.e2e-spec.ts`, `apps/api/test/release-gate/{role-matrix,probes/billing}.ts`, `apps/api/test/relation-field-authorization.e2e-spec.ts`, `apps/api/test/paginated-collections-allowlist.e2e-spec.ts` | Live-surface guard suites for the new type, field and mutations (Task 5; decision s, N1) |
| `apps/web/lib/laundry-invoice-payment.test.ts` (Task 7), `apps/web/lib/laundry-invoice-payment.render.test.tsx`, `apps/web/lib/laundry-order-page.render.test.tsx`, `apps/web/lib/laundry-order-page.interaction.test.tsx` (Task 9) | Existing web suites affected by the tone map and the mounted panel (B1) |

---

## Task 1: Payments domain — enums, limits, derivation, refundable amount, key syntax

**Type:** `code` · **Spec:** §3, §4.2 (refund ceiling), §4.3, §4.5 A1

**Files:**
- Create: the six `apps/api/src/modules/payments/domain/*.ts` files in the file map
- Modify: `apps/api/src/modules/billing/domain/invoice-payment-status.ts` (add `OVERPAID = 'OVERPAID'`, `REFUNDED = 'REFUNDED'`; update the header comment to Amendment #39 ownership)
- Test: `apps/api/src/modules/payments/tests/domain/derive-invoice-payment.spec.ts`, `.../refundable-amount.spec.ts`, `.../idempotency-key.spec.ts`

**Interfaces — Produces:**
```ts
export const MAX_MINOR_UNITS = 2_147_483_647;
export interface PaymentRowForDerivation { type: PaymentType; status: PaymentRecordStatus; amountMinorUnits: number }
export interface DerivedInvoicePayment { amountPaidMinorUnits: number; paymentStatus: InvoicePaymentStatus }
export function deriveInvoicePayment(input: { totalMinorUnits: number; currentStatus: InvoicePaymentStatus; rows: readonly PaymentRowForDerivation[] }): DerivedInvoicePayment;
export function refundableMinorUnits(originalAmountMinorUnits: number, completedRefundAmountsMinorUnits: readonly number[]): number;
export function isCanonicalUuid(value: string): boolean;
```
`Payment` interface: exactly the spec §4.2 fields (`id, tenantId, invoiceId, type, method, amountMinorUnits, reference, status, paidAt, refundedPaymentId, recordedByStaffId, idempotencyKey, createdAt`).

- [ ] **Step 1: Write the failing tests**

`derive-invoice-payment.spec.ts` — a table test over the spec §4.3 worked examples with `totalMinorUnits: 1000` (each row: rows in, expected `{ amountPaidMinorUnits, paymentStatus }`):
`[] → {0, UNPAID}`; `P400 → {400, PARTIALLY_PAID}`; `P400,P600 → {1000, PAID}`; `P400,P600,P200 → {1200, OVERPAID}`; `+R200 → {1000, PAID}`; `+R100 → {900, PARTIALLY_PAID}`; `+R500 → {400, PARTIALLY_PAID}`; `+R400 → {0, REFUNDED}`; `+P1000 → {1000, PAID}`. Plus:
- a `PENDING` and a `FAILED` `PAYMENT` of 500 alongside `P400` → `{400, PARTIALLY_PAID}` (ignored);
- `totalMinorUnits: 0`, no rows → `{0, UNPAID}`; one `P1` → `{1, OVERPAID}`;
- `currentStatus: VOID` → throws;
- `P100, R200` → throws `RangeError` (negative net);
- `P2147483647` → `{2147483647, OVERPAID}`; `P2147483647, P1` → throws `RangeError`.

`refundable-amount.spec.ts`: `(600, []) → 600`; `(600, [100, 500]) → 0`; `(600, [100]) → 500`; `(600, [700])` → throws `RangeError`.

`idempotency-key.spec.ts`: `true` for `'5f0c7a8e-1b2c-4d3e-8f90-a1b2c3d4e5f6'`, its upper-case form, and `'00000000-0000-0000-0001-000000000001'`; `false` for `''`, `'not-a-uuid'`, `'5f0c7a8e1b2c4d3e8f90a1b2c3d4e5f6'` (no hyphens), `'5f0c7a8e-1b2c-4d3e-8f90-a1b2c3d4e5f'` (short group), `'5f0c7a8e-1b2c-4d3e-8f90-a1b2c3d4e5fg'` (non-hex), `' 5f0c7a8e-1b2c-4d3e-8f90-a1b2c3d4e5f6 '` (whitespace).

- [ ] **Step 2: Run them and verify they fail**

Run: `pnpm --filter api test -- src/modules/payments/tests/domain`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the domain files**

`deriveInvoicePayment`: follow spec §4.3 steps 1–4 literally, in that order (VOID check is step 2, after the range checks; both throw). Sums use plain numbers; after summing, throw `RangeError` if `!Number.isSafeInteger(paid) || !Number.isSafeInteger(refunded)`, `net < 0`, or `net > MAX_MINOR_UNITS`. `isCanonicalUuid`: `/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`, no trimming.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `pnpm --filter api test -- src/modules/payments/tests/domain src/modules/billing/tests`
Expected: PASS (billing tests unaffected by the two new enum values).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/payments apps/api/src/modules/billing/domain/invoice-payment-status.ts
git commit -m "feat(39): payments domain — derivation, refundable amount, key syntax"
```

---

## Task 2: Billing write port

**Type:** `code` · **Spec:** §4.1, §4.6 step 1/4; Amendment §9.1 item 4; planning decisions a, n

**Files:**
- Create: `apps/api/src/modules/billing/application/services/invoice-payment-writer.ts`
- Modify: `apps/api/src/modules/billing/billing.module.ts` (provide + export `InvoicePaymentWriter`), `apps/api/src/modules/billing/tests/billing.module.di.spec.ts`
- Test: `apps/api/src/modules/billing/tests/application/invoice-payment-writer.spec.ts`

**Interfaces — Produces:**
```ts
export interface DerivedInvoicePayment { amountPaidMinorUnits: number; paymentStatus: InvoicePaymentStatus } // billing-owned, same file
@Injectable() export class InvoicePaymentWriter {
  lockForPayment(manager: EntityManager, invoiceId: string, tenantId: string): Promise<Invoice | null>;
  applyDerivedPayment(manager: EntityManager, invoice: Pick<Invoice, 'id' | 'tenantId'>, derived: DerivedInvoicePayment): Promise<void>;
}
```
Billing's `DerivedInvoicePayment` is structurally identical to the payments domain type of the same name; billing imports nothing from payments in this layer.

- [ ] **Step 1: Write the failing tests** (mocked `EntityManager`, the `laundry-orders.service.spec.ts` style)
  - `lockForPayment` calls `manager.findOne(InvoiceEntity, { lock: { mode: 'pessimistic_write' }, where: { id, tenantId } })` and returns its result (including `null`).
  - `applyDerivedPayment` calls `manager.query` once with exactly `UPDATE "invoice_entity" SET "amountPaidMinorUnits" = $1, "paymentStatus" = $2 WHERE "id" = $3 AND "tenantId" = $4` and `[amountPaid, status, id, tenantId]`; it throws when the reported affected row count is not 1. (`updatedAt` is not in the statement — decision n.)
  - DI spec: `BillingModule` exports `InvoicePaymentWriter`.
- [ ] **Step 2: Run and verify fail** — `pnpm --filter api test -- src/modules/billing/tests` → FAIL (class missing).
- [ ] **Step 3: Implement** as specified. (`manager.query` on an UPDATE returns `[rows, affectedCount]` with the `pg` driver; read the count from that tuple.)
- [ ] **Step 4: Run and verify pass** — same command → PASS; `pnpm --filter api exec tsc --noEmit` → clean. Boot check: no module graph change beyond a new provider; covered by the DI spec.
- [ ] **Step 5: Commit** — `feat(39): billing InvoicePaymentWriter port`

---

## Task 3: Persistence — PaymentEntity, skeletal PaymentsModule, invoice relation, migration, existing suites and fixtures, docs

**Type:** `code` · **Spec:** §4.2, §4.9; Amendment §9.1 items 1, 5; planning decisions b, m, s

**Files:**
- Create: `apps/api/src/modules/payments/infrastructure/persistence/payment.entity.ts`, `apps/api/src/modules/payments/payments.module.ts` (**skeletal**: `TypeOrmModule.forFeature([PaymentEntity])` only), `apps/api/src/platform/database/migrations/<timestamp>-CreatePayments.ts` (timestamp greater than `1790956800000`)
- Modify: `apps/api/src/app/app.module.ts` (import `PaymentsModule`), `apps/api/src/modules/billing/infrastructure/persistence/invoice.entity.ts` (`@OneToMany(() => PaymentEntity, (p) => p.invoice) payments!: PaymentEntity[];` and its header comment: replace "There is no relation to any `Payment`" with the payments relation and the hand-written `uq_invoice_id_tenant`), `apps/api/src/modules/admins/infrastructure/persistence/admin-user.entity.ts` (header comment: hand-written `uq_admin_user_id_tenant`, target of `fk_payment_recorded_by_staff_tenant`), `apps/api/src/platform/database/data-source.ts` (register `PaymentEntity`), `apps/api/test/admins.service.e2e-spec.ts`, `apps/api/test/admins.service.disable-concurrency.e2e-spec.ts`, `apps/api/test/billing.service.e2e-spec.ts` (decision m), `apps/api/test/helpers/seed-tenant-admin.ts` (`removeTestTenants` deletes the tenants' payment rows as its **first two** statements — `DELETE FROM "payment_entity" WHERE "tenantId" = ANY($1) AND "type" = 'REFUND'`, then the remaining `payment_entity` rows — before `invoice_entity` (`fk_payment_invoice_tenant` RESTRICT) and before the tenants' admins (`fk_payment_recorded_by_staff_tenant` RESTRICT). Refunds go first so the self-referencing `fk_payment_refunded_payment` (`ON DELETE RESTRICT`) never sees an original deleted while its refund exists, without relying on how PostgreSQL orders RESTRICT checks inside one multi-row `DELETE`. Update its header comment), `apps/api/test/remove-test-tenants.e2e-spec.ts` (insert one `COMPLETED` `PAYMENT` **and one `REFUND` of it** in the test tenant; assert both are removed and the removal does not throw — this exercises `fk_payment_refunded_payment` during tenant removal), `apps/api/test/release-gate/two-tenant-world.ts` (`paymentId: string` on `TenantWorld`; a `payment(world)` method on the fixtures object inserting one `COMPLETED` `PAYMENT` against the world invoice through the repository, `recordedByStaffId` = the world's `TENANT_OWNER`, fresh `randomUUID()` key; **`buildTenantWorld` (`two-tenant-world.ts:362–420`) calls `fixtures.payment` after it creates the world invoice and sets `paymentId` on the returned world**, so both worlds hold a payment before the gate's fixture phase runs) (decision s), `apps/api/test/tenant-read-authorizers.e2e-spec.ts` (`CUSTOM_SURFACE_ENTITIES` += the `PaymentEntity` entry from Task 5's guard-suite table; decision s), `docs/development/database-migrations.md`
- Test: `apps/api/test/create-payments.migration.e2e-spec.ts` (the `add-laundry-line-description.migration.e2e-spec.ts` harness: throwaway DB via `helpers/migration-db`)

**Why the module is created here:** the `InvoiceEntity.payments` relation makes `PaymentEntity` mandatory wherever `InvoiceEntity` is registered. With `autoLoadEntities: true` (`database.module.ts`), registering it through a skeletal `PaymentsModule` in this task keeps `AppModule` bootable at this commit (M5 round 1 blocker 1c). Task 4 extends the module.

**Why the release-gate world and test-tenant removal change here (decision s):** from this commit `payment_entity` is a tenant-owned table. The release gate's fixture phase (`two-tenant-release-gate.e2e-spec.ts:201–223`) fails unless both worlds hold a row in every tenant-owned table (`payment_entity` is not lazily written), and `removeTestTenants` would hit `fk_payment_invoice_tenant` once any test tenant has a payment. Both are fixed in this task so the commit leaves the gate green. For the same reason the `PaymentEntity` entry in `tenant-read-authorizers.e2e-spec.ts` `CUSTOM_SURFACE_ENTITIES` is added here: that suite's "accounts for every tenant-owned entity" case (line 377) fails as soon as a tenant-owned entity with no read resolver is registered.

**Entity rules:** columns per spec §4.2 (`amountMinorUnits integer`, `reference varchar(120) null`, `paidAt timestamptz`, `idempotencyKey uuid`, `createdAt` `CreateDateColumn timestamptz`, no `updatedAt`); module-local enums `payment_type_enum`, `payment_method_enum`, `payment_record_status_enum`; `@ManyToOne(() => InvoiceEntity, { createForeignKeyConstraints: false }) @JoinColumn({ name: 'invoiceId' }) invoice` and the tenant `@ManyToOne` with `foreignKeyConstraintName: 'fk_payment_tenant'` (the `InvoiceEntity` precedent). `refundedPaymentId` and `recordedByStaffId` are plain columns (no relation decorator): their constraints are hand-written composite FKs.

**Expressible vs hand-written objects (drift check).** Objects TypeORM metadata can express are **declared on `PaymentEntity`**, so `migration:generate` models them and never proposes them: `@Unique('uq_payment_tenant_idempotency_key', ['tenantId', 'idempotencyKey'])` (the `invoice.entity.ts:52` `@Unique` precedent — a real constraint, not `@Index({ unique: true })`), `@Index('idx_payment_tenant_invoice_paid', ['tenantId', 'invoiceId', 'paidAt'])`, `@Index('idx_payment_refunded_payment', ['refundedPaymentId'])`. Everything else stays **hand-written**, following the repository convention (no entity uses `@Check`; every `uq_*_id_tenant` and composite FK is hand-written): `ck_payment_amount_positive`, `ck_payment_refund_reference`, `uq_payment_id_invoice_tenant`, the three composite FKs, `uq_invoice_id_tenant`, `uq_admin_user_id_tenant`. The header comment lists every hand-written object, as `invoice.entity.ts` does. The drift check runs **after** these are recorded in `database-migrations.md` (Steps 6–7), so it is judged against the updated hand-written list.

**Migration `up` (TypeORM's migration transaction, in this order):**
1. `ALTER TYPE "invoice_payment_status_enum" ADD VALUE IF NOT EXISTS 'OVERPAID'`; same for `'REFUNDED'`. (Allowed in a transaction on the PostgreSQL 16 used by CI and docker-compose because nothing uses the values in the same transaction.)
2. `ALTER TABLE "invoice_entity" ADD CONSTRAINT "uq_invoice_id_tenant" UNIQUE ("id", "tenantId")`.
3. `ALTER TABLE "admin_user_entity" ADD CONSTRAINT "uq_admin_user_id_tenant" UNIQUE ("id", "tenantId")` (decision b; NULL `tenantId` rows for platform admins are distinct under UNIQUE, and `id` is the PK, so existing data cannot violate it).
4. Create the three enums and `payment_entity` with: PK `id uuid DEFAULT uuid_generate_v4()`; `fk_payment_tenant`; `fk_payment_invoice_tenant ("invoiceId","tenantId") → invoice_entity(id,"tenantId") ON DELETE RESTRICT`; `uq_payment_id_invoice_tenant UNIQUE (id,"invoiceId","tenantId")`; `fk_payment_refunded_payment ("refundedPaymentId","invoiceId","tenantId") → payment_entity(id,"invoiceId","tenantId") ON DELETE RESTRICT`; `fk_payment_recorded_by_staff_tenant ("recordedByStaffId","tenantId") → admin_user_entity(id,"tenantId") ON DELETE RESTRICT`; `ck_payment_amount_positive CHECK ("amountMinorUnits" > 0)`; `ck_payment_refund_reference CHECK (("type" = 'REFUND') = ("refundedPaymentId" IS NOT NULL))`; `uq_payment_tenant_idempotency_key UNIQUE ("tenantId","idempotencyKey")`; indexes `idx_payment_tenant_invoice_paid ("tenantId","invoiceId","paidAt")`, `idx_payment_refunded_payment ("refundedPaymentId")`.

**Migration `down`:** first `SELECT COUNT(*) FROM invoice_entity WHERE "paymentStatus" IN ('OVERPAID','REFUNDED')`; if non-zero, `throw new Error(...)` naming the count (no data rewrite, before any DDL). Then drop `payment_entity`, its enums, `uq_admin_user_id_tenant`, `uq_invoice_id_tenant`, and recreate `invoice_payment_status_enum` without the two values (rename old type, create new, `ALTER COLUMN ... TYPE ... USING "paymentStatus"::text::<new>`, drop old).

- [ ] **Step 1: Write the failing migration e2e** (sequential cases on a DB migrated to just before this migration, then `up`):
  - `pg_enum` for `invoice_payment_status_enum` contains `OVERPAID` and `REFUNDED`.
  - A valid `PAYMENT` row inserts; a `PAYMENT` with `refundedPaymentId` set is rejected by `ck_payment_refund_reference`; a `REFUND` with `refundedPaymentId` null is rejected by the same check.
  - A `REFUND` referencing a payment of **another invoice** in the same tenant is rejected by `fk_payment_refunded_payment`.
  - `amountMinorUnits` 0 and −1 are rejected by `ck_payment_amount_positive`.
  - A second row with the same `(tenantId, idempotencyKey)` is rejected by `uq_payment_tenant_idempotency_key`; the same key in another tenant is accepted.
  - `recordedByStaffId` of an admin in another tenant is rejected by `fk_payment_recorded_by_staff_tenant`.
  - `down` with an invoice in `OVERPAID` throws and leaves the schema unchanged; after resetting that invoice to `UNPAID`, `down` succeeds and `payment_entity` no longer exists.
- [ ] **Step 2: Run and verify fail** — `pnpm --filter api test:e2e -- create-payments.migration` → FAIL (migration missing).
- [ ] **Step 3: Implement** the entity (with the declared `@Unique`/`@Index` objects above), the skeletal module + `AppModule` import, the relation, the data-source registration and the migration.
- [ ] **Step 4: Update the existing suites and fixtures (decisions m, s).** In both admin suites replace the `AdminUserEntity` `.clear()` with `await <dataSource>.query('TRUNCATE TABLE "payment_entity", "admin_user_entity"')` (keep the audit-event clear before it), with a comment citing decision m and the cleaners-teams precedent. In `billing.service.e2e-spec.ts` add `PaymentEntity` to `ENTITIES`. In `seed-tenant-admin.ts` add the two `payment_entity` deletes (refunds, then the remaining rows) as the first two statements of `removeTestTenants`; extend `remove-test-tenants.e2e-spec.ts`; add the `payment(world)` fixture and `paymentId` to `two-tenant-world.ts`; add the `PaymentEntity` entry to `CUSTOM_SURFACE_ENTITIES` in `tenant-read-authorizers.e2e-spec.ts`.
- [ ] **Step 5: Run and verify pass**
  - `pnpm --filter api migration:run` (dev DB) → applies cleanly.
  - `pnpm --filter api test:e2e -- create-payments.migration admins.service billing.service billing.e2e laundry.service remove-test-tenants tenant-read-authorizers relation-field-authorization release-gate/` → PASS. `relation-field-authorization` and the `release-gate/` suites (all four under `apps/api/test/release-gate/`: `engine`, `outcome`, `tenant-snapshot`, `two-tenant-world`; the world and engine suites) build and tear down the gate world this task changes, including the failure-cleanup cases that now cover a tenant with a payment. `admins.service` matches both admin suites; `billing.e2e` boots the full `AppModule` (the bootability check for this commit).
  - `pnpm --filter api test:e2e:release-gate` → PASS (the fixture phase now sees a `payment_entity` row in both worlds; the GraphQL surface is unchanged at this commit, so no other phase changes).
  - `pnpm --filter api exec tsc --noEmit` → clean.
- [ ] **Step 6: Update `docs/development/database-migrations.md`**: add `PaymentEntity` to the registered list; add a `### <timestamp>-CreatePayments` section listing every **hand-written** object above (and naming the three entity-declared ones as entity metadata, not hand-written), the `down` refusal, that `refundedPaymentId` / `recordedByStaffId` deliberately have no relation decorator, that `admin_user_entity` is now a referenced table (suites that empty it must truncate `payment_entity` in the same statement — decision m), and that a later migration must not use `OVERPAID` / `REFUNDED` in the same `migration:run` transaction as this one.
- [ ] **Step 7: Drift check (after Step 6).** Run `pnpm --filter api migration:generate check payments drift` against the fully migrated dev DB. Expected: no proposal touching `uq_payment_tenant_idempotency_key`, `idx_payment_tenant_invoice_paid` or `idx_payment_refunded_payment` (entity-declared); any proposal to drop or recreate a hand-written object listed in Step 6 is deleted from the file and, if it is new, appended to the "Known noise" list in `database-migrations.md` in this step; nothing else is proposed. Delete the generated file. A proposal outside both categories is a defect in the entity or the migration, fixed before the commit.
- [ ] **Step 8: Commit** — `feat(39): payment_entity, invoice relation and CreatePayments migration`

---

## Task 4: Application — PaymentsService and PaymentsModule

**Type:** `code` · **Spec:** §4.5, §4.6; planning decisions a, c, p

**Files:**
- Create: `apps/api/src/modules/payments/application/commands/record-invoice-payment.command.ts`, `.../refund-invoice-payment.command.ts`, `apps/api/src/modules/payments/application/services/payments.service.ts`
- Modify: `apps/api/src/modules/payments/payments.module.ts` (extend the Task 3 skeleton; `AppModule` already imports it)
- Test: `apps/api/src/modules/payments/tests/application/payments.service.spec.ts`, `apps/api/src/modules/payments/tests/payments.no-laundry-import.spec.ts`, `apps/api/src/modules/payments/tests/payments.module.di.spec.ts`

**Interfaces — Consumes:** Task 1 domain; Task 2 `InvoicePaymentWriter`; `AUDIT_LOGGER`, `runAuditInTransaction`, `tenantAuditTags`; `isPostgresUniqueViolation` (copy the billing helper's pattern into payments, or move it to `platform/database` — M6's choice, no behavior change).

**Produces:**
```ts
export interface RecordInvoicePaymentCommand { actorId: string; tenantId: string; invoiceId: string; idempotencyKey: string; method: PaymentMethod; amountMinorUnits: number; reference?: string | null; paidAt?: Date | null }
export interface RefundInvoicePaymentCommand { actorId: string; tenantId: string; paymentId: string; idempotencyKey: string; method: PaymentMethod; amountMinorUnits: number; reference?: string | null; paidAt?: Date | null }
@Injectable() export class PaymentsService {
  record(command: RecordInvoicePaymentCommand): Promise<Payment>;
  refund(command: RefundInvoicePaymentCommand): Promise<Payment>;
  refundableByPaymentIds(paymentIds: readonly string[], tenantId: string): Promise<Map<string, number>>;
}
```
`PaymentsModule` (extending Task 3's skeleton): keeps `TypeOrmModule.forFeature([PaymentEntity])`; imports `AuditModule`, `BillingModule`; provides `PaymentsService`. Task 5 adds `NestjsQueryTypeOrmModule.forFeature([PaymentEntity])`, `NestjsQueryGraphQLModule.forFeature({ dtos: [{ DTOClass: PaymentObjectType }] })`, the resolver and the loader.

**Algorithm (spec §4.5/§4.6, exact order):**
1. A1 `isCanonicalUuid(idempotencyKey)`; A2 integer in `[1, MAX_MINOR_UNITS]`; A3 normalize `reference` (trim; `''` → `null`) then `[...reference].length` ≤ 120; A4 `paidAt` supplied and `> now` → reject. `now = new Date()` captured once at entry; resolved `paidAt = command.paidAt ?? now`.
2. `dataSource.transaction(manager => runAuditInTransaction(manager, async () => { … }))`.
3. Record: `invoice = writer.lockForPayment(manager, invoiceId, tenantId)`; null → B1 404. Refund: pre-lock `manager.findOne(PaymentEntity, { where: { id: paymentId, tenantId } })`; null → B1 404; lock its invoice; re-read the original and `find` its refunds under the lock (re-read missing → B1 404).
4. B2: `manager.findOne(PaymentEntity, { where: { tenantId, idempotencyKey } })`. Match = same `type`, same `invoiceId` (record) / `refundedPaymentId` (refund), same `method`, `amountMinorUnits`, normalized `reference`, and — only when `command.paidAt` was supplied — same `paidAt.getTime()`. Match → return it (no write, no audit). Exists but no match → 409 with the message "This request key was already used for a different entry. Close the dialog and start a new entry."
5. B3 `invoice.paymentStatus === VOID` → 400. Refund: B4 original not `PAYMENT` or not `COMPLETED` → 400; B5 resolved `paidAt < original.paidAt` → 400; B6 amount > `refundableMinorUnits(original.amount, completedRefunds)` → 400 with message containing the refundable amount. Record: B7 load the invoice's completed rows, current net + amount > `MAX_MINOR_UNITS` → 400 with message containing `MAX_MINOR_UNITS − net`.
6. Insert with exactly `manager.save(manager.create(PaymentEntity, { …, status: COMPLETED, recordedByStaffId: actorId }))` (decision p); a `uq_payment_tenant_idempotency_key` violation → 409 with the same message as step 4.
7. Re-read all the invoice's payment rows on `manager`, `deriveInvoicePayment`, `writer.applyDerivedPayment`.
8. Audit `payment.recorded` / `payment.refunded`; return the inserted row re-read by `{ id, tenantId }`.

`refundableByPaymentIds(ids, tenantId)`: one query selecting the requested `COMPLETED` `PAYMENT` rows in the tenant with `COALESCE(SUM(r."amountMinorUnits") FILTER (WHERE r."status" = 'COMPLETED'), 0)::text` over their refunds (`LEFT JOIN payment_entity r ON r."refundedPaymentId" = p."id" AND r."tenantId" = p."tenantId"`), grouped by payment. Each sum is converted with `Number(...)` and checked with `Number.isSafeInteger`, throwing otherwise (spec §4.3, the `allocateInvoiceNumber` precedent); refundable = `refundableMinorUnits(amount, [sum])`.

- [ ] **Step 1: Write the failing unit tests** (mocked manager/writer/audit; one `describe` per command):
  - every A and B row of spec §4.5 rejects with the stated exception type, and **only the first** fails when two are violated (cases: invalid key + amount 0 → the key error; amount 0 + reference 121 chars → the amount error; VOID invoice + over-refund → VOID error);
  - each invalid key from Task 1 rejects before `dataSource.transaction` is called (assert not called); the non-v4 fixture key passes A1;
  - replay with an identical request returns the existing row, and `save`, `applyDerivedPayment` and `audit.log` are not called;
  - replay with a different amount → `ConflictException`;
  - replay of a refund whose original is now fully refunded returns the refund (B2 precedes B6);
  - B7: current net 2147483646, amount 1 → inserted; amount 2 → `BadRequestException` whose message contains `1`;
  - refund `paidAt` defaulted to now and original `paidAt` in the future of now → B5 400;
  - happy path calls in order: lock → insert → derive (asserted args) → `applyDerivedPayment` → `audit.log({ action: 'payment.recorded', entityType: 'payment', entityId, actorId, scope: 'TENANT', tenantId })`;
  - an insert unique violation on `uq_payment_tenant_idempotency_key` → `ConflictException`;
  - A3 counts code points: a 120-emoji reference passes, 121 fails;
  - `refundableByPaymentIds`: a returned sum string `'9007199254740993'` → throws; `'300'` → refundable `amount − 300`;
  - the insert goes through `manager.save` with one `PaymentEntity` argument (decision p).
  - DI spec: `PaymentsModule` compiles with `PaymentsService` resolvable.
  - Source guard (`payments.no-laundry-import.spec.ts`): no file under `src/modules/payments` imports from `modules/laundry` (spec §4.1; a `readdirSync`/`readFileSync` scan, the `paginated-collections-allowlist.spec.ts` style).
- [ ] **Step 2: Run and verify fail** — `pnpm --filter api test -- src/modules/payments/tests` → FAIL.
- [ ] **Step 3: Implement** per the algorithm above.
- [ ] **Step 4: Run and verify pass** — same → PASS; `pnpm --filter api exec tsc --noEmit` → clean; boot check `pnpm --filter api test:e2e -- billing.e2e` → PASS.
- [ ] **Step 5: Commit** — `feat(39): PaymentsService record/refund with ordered checks under the invoice lock`

---

## Task 5: GraphQL surface

**Type:** `code` · **Spec:** §4.7; planning decisions d, e, r, s

**Files:**
- Create: `apps/api/src/modules/payments/presentation/graphql/payment.type.ts`, `payment.inputs.ts`, `payment.resolver.ts`, `refundable-amount.loader.ts`, `mappers.ts`
- Modify: `apps/api/src/modules/billing/presentation/graphql/invoice.type.ts` (`@OffsetConnection('payments', () => PaymentObjectType, { defaultResultSize: PLATFORM_PAGE_DEFAULT, defaultSort: paidAt ASC, createdAt ASC, id ASC, enableTotalCount: false, maxResultsSize: PLATFORM_PAGE_MAX, nullable: false, relationName: 'payments', remove: { enabled: false }, update: { enabled: false } })`), `apps/api/src/modules/payments/payments.module.ts`, `apps/api/src/modules/billing/tests/graphql/invoice-relations.authorization.spec.ts` (add `PaymentObjectType` to targets and `Invoice.payments` to the inventory), `apps/api/src/platform/graphql/tests/paginated-collections-allowlist.spec.ts` (`DEFAULT_SORTS` row for `invoice.payments`: `paidAt ASC, createdAt ASC, id ASC`), and the live-surface guard suites in the table below (decision s; M5 round 2 blocker N1)
- Test: `apps/api/src/modules/payments/tests/graphql/payment.resolver.spec.ts`, `.../refundable-amount.loader.spec.ts`

**Live-surface guard suites (N1).** Each pins the live schema, root operations or role matrix, so it fails at this commit unless updated here (except the `PaymentEntity` row, done in Task 3). Counts verified against the current source; each count rises by exactly the two new mutations (no new query, no new HTTP route).

| File | Change | Why it fails otherwise |
| --- | --- | --- |
| `apps/api/test/tenant-read-authorizers.e2e-spec.ts` | **Task 3** (when the entity is registered): `CUSTOM_SURFACE_ENTITIES` (line 76) += `PaymentEntity: 'Read only via Invoice.payments (nested connection, tenantReadAuthorizer on Payment) and Payment.invoice; no read resolver or root query (#39).'`. **Task 5:** `CUSTOM_OBJECT_FIELDS` (line 86) += `'Payment.invoice': 'PaymentResolver @ResolveField via InvoicesService.getInvoice keyed by the principal tenant (#39).'` | "accounts for every tenant-owned entity" (line 377): `PaymentEntity` is tenant-owned from Task 3 and never gets a read resolver. "accounts for every object-typed field" (line 308): `Payment.invoice` returns `Invoice` and is not a declared nestjs-query relation. (`Invoice.payments` *is* a declared relation, and `Payment` is tenant-scoped by `tenantReadAuthorizer`, so no other entry is needed.) |
| `apps/api/test/laundry-billing.tenant-isolation.e2e-spec.ts` | `expected` list (lines 441–451) += `'Payment.invoice'` | The scan collects every object field whose named type is in `TARGETS` (`LaundryOrder`, `LaundryOrderLine`, `Invoice`, `InvoiceLine`; line 349); `Payment.invoice` returns `Invoice`. The two mutations return `Payment`, not a target, so they are not added; `Invoice.payments` targets `Payment`, not a target. |
| `apps/api/test/helpers/root-operation-inventory.ts` | `'Mutation.recordInvoicePayment': 'TENANT'`, `'Mutation.refundInvoicePayment': 'TENANT'`; update the count comment | `root-operation-authorization` requires the classification keys to equal the live root fields. (Moved from Task 6.) |
| `apps/api/test/root-operation-authorization.e2e-spec.ts` | line 55: `expect(schemaKeys).toHaveLength(63)` → `toHaveLength(65)` | Two new root mutations. |
| `apps/api/test/release-gate/role-matrix.ts` | `PAYMENT_RECORD` = the four record roles, `PAYMENT_REFUND` = `[TENANT_OWNER, FINANCE]`, entries for both mutations, sources citing payments spec §4.7 | Release-gate Phase 1a (tenant surface = role matrix) and Phase 2 (pinned matrix = live `@Roles()`). (Moved from Task 6.) |
| `apps/api/test/two-tenant-release-gate.e2e-spec.ts` | line 147: `expect(matrixKeys).toHaveLength(65)` → `toHaveLength(67)` | Two new tenant root operations in the matrix. |
| `apps/api/test/release-gate/probes/billing.ts`, `apps/api/test/release-gate/two-tenant-world.ts` | The two probes in Task 6's "Release-gate probes" list, and the probe fixture creating a fresh invoice + `COMPLETED PAYMENT 1000` | Phase 1b requires exactly one probe per tenant operation; Phases 3–6 run them. (Moved from Task 6.) |
| `apps/api/test/relation-field-authorization.e2e-spec.ts` | add `Invoice.payments` to the cross-tenant relation cases | The new nested connection is a relation field; its cross-tenant behavior is pinned with the others. Its "no guards on relation field resolvers" check (lines 375–394) also covers `Payment.invoice` / `refundableMinorUnits` (decision r). (Moved from Task 6.) |
| `apps/api/test/paginated-collections-allowlist.e2e-spec.ts` | `NESTED_CONNECTIONS += { field: 'payments', parent: 'Invoice', sortColumns: ['paidAt','createdAt','id'], sortFields: 'PaymentSortFields' }` | Pins the new nested connection's paging and sort shape. (Moved from Task 6.) |

**Shapes:**
- `PaymentObjectType` (`@ObjectType('Payment')`, `@Authorize(tenantReadAuthorizer<PaymentObjectType>())`), in `payment.type.ts`, which imports only payments domain enums and platform helpers — never `invoice.type.ts` (Global constraints): `@IDField id`; `@FilterableField(() => ID) invoiceId`; `type`, `method`, `status` (registered enums `PaymentType`, `PaymentMethod`, `PaymentRecordStatus` — GraphQL enum names exactly these); `@Field(() => Int) amountMinorUnits`; `reference: String` nullable; `@FilterableField() paidAt`; `refundedPaymentId: ID` nullable; `recordedByStaffId: ID` nullable; `@FilterableField() createdAt`. No `tenantId`, no `idempotencyKey`.
- Inputs `RecordInvoicePaymentInput { invoiceId: ID!, idempotencyKey: ID!, method: PaymentMethod!, amountMinorUnits: Int!, reference: String, paidAt: DateTime }` and `RefundInvoicePaymentInput { paymentId: ID!, … }` — decorators per planning decision c.
- `PaymentResolver` (`@Resolver(() => PaymentObjectType)`): mutations `recordInvoicePayment` (`@Roles(TENANT_OWNER, OPS_MANAGER, FINANCE, CUSTOMER_SUPPORT)`) and `refundInvoicePayment` (`@Roles(TENANT_OWNER, FINANCE)`), both `@UseGuards(AuthGuard)` — guards and `@Roles` on these **two methods only, never on the class** (decision r) — `actorId: user.id`, `tenantId: requireTenantId(user)`; `@ResolveField(() => InvoiceType) invoice` → `InvoicesService.getInvoice(parent.invoiceId, user.tenantId)` mapped by `toInvoiceType` (non-null; a missing invoice throws `NotFoundException`); `@ResolveField(() => Int, { nullable: true }) refundableMinorUnits` → `null` unless `type === PAYMENT && status === COMPLETED`, else `loader.loaderFor(user.tenantId).load(parent.id)`.
- `RefundableAmountLoader` (request-scoped, per-tenant `DataLoader`), batch fn `createRefundableBatchFn(service, tenantId)` → `PaymentsService.refundableByPaymentIds` (one query: the payments by id + `SUM` of completed refunds grouped by `refundedPaymentId`, both filtered by `tenantId`); `tenantId === null` → every key `null`.

- [ ] **Step 1: Write the failing tests**
  - resolver spec: role metadata on both mutations equals the spec §4.7 lists exactly; the mutations pass `actorId`/`tenantId` from the principal; `refundableMinorUnits` is `null` for a `REFUND` and for a non-`COMPLETED` payment without calling the loader; `PaymentResolver` (the class) carries no `GUARDS_METADATA` and no roles metadata, and neither do the `invoice` / `refundableMinorUnits` methods (decision r).
  - guard suites (N1): apply every change in the "Live-surface guard suites" table **before** Step 3. Run against the pre-Step-3 schema they fail as stale-in-the-other-direction (`CUSTOM_OBJECT_FIELDS`, the isolation `expected` list and the inventory name `Payment.invoice` and two mutations that do not exist yet; the counts expect 65 and 67), which proves each edit is checked by its suite.
  - loader spec: values returned in key order; an id absent from the service's map → `null`; `tenantId null` → all `null` without calling the service.
  - relation inventory spec: `Invoice.payments` present, no `auth` override, `update`/`remove` disabled.
  - a schema assertion (in the resolver spec via `GraphQLSchemaBuilderModule` or in Task 6 e2e — M6's choice): `Payment` fields equal the list above.
- [ ] **Step 2: Run and verify fail** — `pnpm --filter api test -- src/modules/payments/tests/graphql src/modules/billing/tests/graphql` → FAIL; `pnpm --filter api test:e2e -- tenant-read-authorizers laundry-billing.tenant-isolation root-operation-authorization relation-field-authorization paginated-collections-allowlist` → FAIL (stale allowlist entries and counts, as above).
- [ ] **Step 3: Implement**; wire the resolver, loader and DTO into `PaymentsModule`.
- [ ] **Step 4: Run and verify pass**
  - `pnpm --filter api test -- src/modules/payments/tests/graphql src/modules/billing/tests/graphql src/platform/graphql/tests` → PASS; `pnpm --filter api exec tsc --noEmit` → clean.
  - `pnpm --filter api test:e2e -- tenant-read-authorizers laundry-billing.tenant-isolation root-operation-authorization relation-field-authorization paginated-collections-allowlist billing.e2e` → PASS.
  - `pnpm --filter api test:e2e:release-gate` → PASS (Phases 1a/1b/2 with 67 matrix keys and the two new probes; Phases 3–6 exercise them).
  - Boot check: `billing.e2e` above boots `AppModule` (this also rewrites the schema); confirm `git diff --stat apps/api/src/schema.gql` (gitignored, local only) shows the `Payment` type, the two inputs/mutations, three enums, `Invoice.payments`, and the two new `InvoicePaymentStatus` values.
- [ ] **Step 5: Commit** — `feat(39): Payment GraphQL type, Invoice.payments, record/refund mutations`

---

## Task 6: API e2e — flows, concurrency, authorization, tenant isolation, release gate

**Type:** `code` · **Spec:** §4.5–§4.7, §4.9 (fixtures), §7

**Files:**
- Create: `apps/api/test/payments.e2e-spec.ts`, `apps/api/test/payments.concurrency.e2e-spec.ts`
- Modify: `apps/api/test/helpers/billing-db-test-lock.ts` (comment: also scopes the payments specs; acquire it in both new specs). The removal order, release-gate world fixture and `remove-test-tenants` case moved to **Task 3**; the root-operation inventory, role matrix, probes, relation-field case, nested-connection allowlist and the other live-surface guard suites moved to **Task 5** (decision s). Task 6 re-runs all of them.

**Release-gate probes** (implemented in **Task 5**, listed here with the other payments coverage; each call builds a fresh `randomUUID()` key):
- `Mutation.recordInvoicePayment`: `prepare` → fresh invoice; `sameTenant` → record `CASH 100` on it; `ok: { kind: 'createdInOwnTenant', table: 'payment_entity' }`; `crossTenant` → foreign `invoiceId` → `{ kind: 'error', status: 404 }`.
- `Mutation.refundInvoicePayment`: `prepare` → fresh invoice + `COMPLETED PAYMENT 1000`; `sameTenant` → refund 100 of it; `ok: createdInOwnTenant payment_entity`; `crossTenant` → foreign `paymentId` → 404.

- [ ] **Step 1: Write `payments.e2e-spec.ts`** (the `billing.e2e-spec.ts` HTTP harness, but in a **test tenant**: `createTestTenant` + `seedTenantAdmin` for each role, a priced order → generated invoice with total 1700; `afterAll` → `removeTestTenants`, which removes its payments — the suite leaves no payment rows). Cases:
  - **flow**: record 1000 → `PARTIALLY_PAID`, `amountPaid 1000`, `amountDue 700`; record 900 → `OVERPAID`, `amountDue −200`; refund 200 of the second → `PAID`; refund 500 of the first → `PARTIALLY_PAID`, the original row unchanged (DB read); refund the rest of both → `REFUNDED`; after every write the laundry order's `status` is unchanged (spec §4.8); over-refund by 1 → 400 with the payment's refundable amount in the message, no new row, derived pair unchanged, no new audit event.
  - **audit**: one `payment.recorded` / `payment.refunded` event per write with `entityType 'payment'` and the tenant tags.
  - **idempotency**: same key + same input twice → one row, one audit event, identical `id` in both responses; same key + different amount → 409; two concurrent same-key requests (`Promise.all`) → exactly one row and one audit event, both responses return that row's `id`, neither is an error.
  - **invalid keys** (each Task 1 invalid value) → 400 and no row; the non-v4 fixture key → success.
  - **range**: on a fresh invoice record 2147483646 then 1 → success, `amountPaid 2147483647`; then 1 → 400, no row, no audit; a refund of 1 → allowed; `amountMinorUnits` 0, −1 → 400; `2147483648` → GraphQL validation error.
  - **paidAt**: one hour in the future → 400; a refund dated before its original → 400; omitted → stored ≈ now.
  - **history order**: insert three rows with identical `paidAt` and `createdAt` directly (repository), read `invoice.payments` twice and with `paging { limit: 1, offset: n }` → identical `id ASC` order every time.
  - **public fields**: introspect `Payment` → field names equal the Task 5 list; no `idempotencyKey`, no `tenantId`; no input type field named `paymentStatus` or `amountPaidMinorUnits` anywhere in the schema; no `createOneInvoice` / `updateOneInvoice` / `createOnePayment` / `updateOnePayment` / `deleteOnePayment`.
  - **refund target**: refund of a `REFUND` id → 400 (B4), no row; refund of a `PENDING` `PAYMENT` inserted directly through the repository → 400 (B4), no row.
  - **port writes two columns only**: `invoice_entity."updatedAt"` is unchanged after a record and after a refund (decision n).
  - **authorization**: for each of the six roles, record and refund succeed exactly for the spec §4.7 lists and are `Forbidden` otherwise; all six read `invoice { payments { nodes { id } } }`; unauthenticated → `Unauthorized`.
- [ ] **Step 2: Write `payments.concurrency.e2e-spec.ts`** — boots `AppModule` via `Test.createTestingModule` (so every entity is registered through `autoLoadEntities`), gets `PaymentsService` and `DataSource` from the module, and calls the service **directly** (no HTTP) in a test tenant; acquires the billing advisory lock. Uses the decision f barrier:
  - **record-queue:** five `record` calls of 100 on one invoice started together; the first to reach the save is paused holding the invoice lock; condition `record-queue` observed (4 waiters on the invoice `FOR UPDATE`, at least one blocked directly by the paused pid); release → all five fulfill; 5 rows; `amountPaid 500`; status derived from the total; `assertReleased()` passes.
  - **refund-race:** one `COMPLETED` 1000 payment; two `refund` calls of 700 started together; the first to reach the save is paused; condition `refund-race` observed; release → exactly one fulfills and the other rejects with `BadRequestException` (B6); one refund row; `amountPaid 300`.
  - **failed write:** an over-refund leaves no row, an unchanged derived pair, and no audit event.
  - **barrier contract:** a `save` call carrying a `PaymentEntity` in any other shape fails the test immediately (unit-level check inside the spec, as the pricing barrier does); the barrier's `pg_stat_activity` poll SQL contains `datname = current_database()` and `pid <> pg_backend_pid()` (decision f).
- [ ] **Step 3: (No fixture edits.)** The cross-cutting fixtures were updated in Tasks 3 and 5 (decision s); if Steps 1–2 need a fixture change, make it here and re-run the Task 5 guard suites.
- [ ] **Step 4: Run and verify** — `pnpm --filter api migration:run && pnpm --filter api test:e2e -- payments create-payments remove-test-tenants paginated-collections-allowlist root-operation-authorization relation-field-authorization tenant-read-authorizers laundry-billing.tenant-isolation admins.service billing.service billing.e2e laundry.service release-gate/` → PASS (`payments` matches both new specs; `release-gate/` covers the world and engine suites); then `pnpm --filter api test:e2e:release-gate` → PASS, including the fixture check that `payment_entity` is populated in both worlds and `matrixKeys` of length 67.
- [ ] **Step 5: Commit** — `test(39): payments e2e, lock race, tenant isolation and release-gate coverage`

---

## Task 7: Client operations, money and Manila-time helpers, tones and copy

**Type:** `code` · **Spec:** §4.2 (`paidAt`), §4.7, §4.10; planning decisions g, k

**Files:**
- Modify: `packages/client/src/operations/billing.graphql`, `packages/client/src/generated/graphql.ts` (regenerated), `apps/web/lib/format-price.ts`, `apps/web/lib/invoice-payment-status.ts`, `packages/web/src/i18n/messages/en/laundry.ts`, `apps/web/lib/laundry-presentation-contract.test.ts` (pin the new status, method and type label keys), `apps/web/lib/laundry-invoice-payment.test.ts` (the existing "keeps billing tones" case, lines 19–26, pins `INVOICE_PAYMENT_STATUS_TONE` to exactly four entries; it is updated to six — M5 round 3 blocker B1(a))
- Create: `apps/web/lib/manila-time.ts`, `apps/web/lib/format-price.test.ts`, `apps/web/lib/manila-time.test.ts`

**Operations (`billing.graphql`):**
- `fragment PaymentRow on Payment { id invoiceId type method amountMinorUnits reference status paidAt refundedPaymentId recordedByStaffId createdAt refundableMinorUnits }`
- `query InvoicePayments($id: ID!, $offset: Int!) { invoice(id: $id) { id totalMinorUnits amountPaidMinorUnits amountDueMinorUnits paymentStatus payments(paging: { limit: 100, offset: $offset }) { nodes { ...PaymentRow } pageInfo { hasNextPage } } } }`
- `mutation RecordInvoicePayment($input: RecordInvoicePaymentInput!) { recordInvoicePayment(input: $input) { ...PaymentRow invoice { id amountPaidMinorUnits amountDueMinorUnits paymentStatus } } }` and the same shape for `RefundInvoicePayment`.
- `InvoiceForOrder` adds `amountPaidMinorUnits`.

**Helpers — Produces:**
```ts
// format-price.ts (changed)
export function formatMinorUnits(minorUnits: number): string; // negative → '−₱1.50' (U+2212)
// manila-time.ts
export function toManilaDateTimeLocal(instant: Date | string): string;           // 'YYYY-MM-DDTHH:mm'
export function manilaDateTimeLocalToIso(value: string): string | null;          // '…T…:00+08:00' or null if not 'YYYY-MM-DDTHH:mm'
export function formatManilaDateTime(instant: Date | string): string;            // Intl, timeZone 'Asia/Manila'
```

- [ ] **Step 1: Write the helper tests**
  - **New behavior (fail before Step 3):** `formatMinorUnits(-50) === '−₱0.50'`, `(-150) === '−₱1.50'`, `(-200) === '−₱2.00'`.
  - **Characterization group "positive formatting unchanged"** (pass before Step 3; see [Characterization tests](#characterization-tests)): `formatMinorUnits(0) === '₱0.00'`, `(150) === '₱1.50'`, `(2147483647) === '₱21474836.47'`. Exact-string `toBe` assertions, one `it` per input, so a break shows three separate failures.
  - **Tone map (new behavior; fail before Step 3):** in `laundry-invoice-payment.test.ts`, "keeps billing tones" becomes `expect(INVOICE_PAYMENT_STATUS_TONE).toEqual({ PAID: 'success', PARTIALLY_PAID: 'warning', UNPAID: 'neutral', VOID: 'danger', OVERPAID: 'warning', REFUNDED: 'neutral' })` — the four existing tones unchanged, two added (spec §4.10). Rename it "keeps billing tones and adds OVERPAID and REFUNDED". It is a new-behavior test, not a characterization test: it fails until Step 3 adds the two entries.
  - `manila-time` (new behavior): `toManilaDateTimeLocal('2026-11-01T16:30:00.000Z') === '2026-11-02T00:30'`; `manilaDateTimeLocalToIso('2026-11-02T00:30') === '2026-11-02T00:30:00+08:00'` and `new Date(that).toISOString() === '2026-11-01T16:30:00.000Z'`; `manilaDateTimeLocalToIso('2026-11-02')` → `null`; `formatManilaDateTime('2026-11-01T16:30:00.000Z')` contains `12:30` and `Nov 2` (the test pins the exact string the chosen `Intl` options produce).
- [ ] **Step 2: Run and verify** — `pnpm --filter web test -- lib/format-price lib/manila-time lib/laundry-invoice-payment.test` → the negative, `manila-time` and tone-map cases FAIL; the characterization group PASSES. Then make the characterization break (omit `₱`; [Characterization tests](#characterization-tests)) in the working tree, re-run `pnpm --filter web test -- lib/format-price` → all three characterization cases FAIL; revert the break (`git diff apps/web/lib/format-price.ts` empty) before Step 3. Record both runs in the M6 record.
- [ ] **Step 3: Implement** the helpers (integer arithmetic on the absolute value, sign prepended; no float formatting); add `OVERPAID: 'warning'`, `REFUNDED: 'neutral'` to `INVOICE_PAYMENT_STATUS_TONE`; add copy: `invoicePaymentStatus.OVERPAID 'Overpaid'`, `.REFUNDED 'Refunded'`; `payments.*` (title "Payments", amount labels "Total" / "Amount paid" / "Amount due" / "Overpaid by {amount}", history column labels, types "Payment" / "Refund", methods "Cash", "GCash", "Maya", "Bank transfer", "Card", "Other", "Recorded by", "You", "Staff member", "Refund of {payment}", dialog titles and submit labels "Record payment" / "Refund payment", "Paid at (Manila time)", help "Leave as now unless the money moved earlier.", the refund notice "Refunds are recorded permanently. They cannot be edited or deleted.", amount errors "Enter an amount such as 150.00." / "Enter an amount greater than zero." / "That amount is too large." / "A refund cannot exceed {amount}.", success toasts "Payment recorded." / "Refund recorded.", failure fallbacks "Unable to record payment." / "Unable to record refund.", empty "No payments yet.", "Load more", "Unable to load more payments."). Placeholders follow the existing convention (`t(key).replace('{amount}', value)` at the call site). Pin the new label keys in `laundry-presentation-contract.test.ts`. Run `pnpm --filter @clensy/client codegen` against the Task 5 schema.
- [ ] **Step 4: Run and verify pass** — `pnpm --filter web test -- lib/format-price lib/manila-time lib/laundry-presentation-contract lib/laundry-invoice-payment.test` → PASS; `pnpm --filter web exec tsc --noEmit` → clean (the tone map now covers six statuses); `pnpm --filter @clensy/web test` → PASS.
- [ ] **Step 5: Commit** — `feat(39): payment client operations, sign-aware money, Manila time helpers, copy`

---

## Task 8: Payments panel — pure rules, history hook, write hook, component

**Type:** `code` · **Spec:** §4.5 (idempotency key lifecycle, `paidAt` contract), §4.10; planning decisions h, i, j, o

**Files:**
- Create: `apps/web/lib/invoice-payments.ts`, `apps/web/lib/invoice-payments.test.ts`, `apps/web/lib/use-invoice-payment-history.ts`, `apps/web/lib/use-invoice-payment-history.apollo.test.tsx`, `apps/web/lib/use-invoice-payment-mutations.ts`, `apps/web/lib/use-invoice-payment-mutations.hook.test.tsx`, `apps/web/components/billing/invoice-payments-panel.tsx`, `apps/web/lib/invoice-payments-panel.render.test.tsx`
- Modify: `apps/web/lib/use-laundry-mutation-lock.ts` (`LaundryMutationOwner += 'payment'`)

**Interfaces — Produces:**
```ts
// invoice-payments.ts
export const RECORD_PAYMENT_ROLES: readonly Role[]; // TENANT_OWNER, OPS_MANAGER, FINANCE, CUSTOMER_SUPPORT
export const REFUND_PAYMENT_ROLES: readonly Role[]; // TENANT_OWNER, FINANCE
export function canRecordPayment(role: Role | undefined, status: InvoicePaymentStatus): boolean;      // false for VOID
export function canRefundPayment(role: Role | undefined, status: InvoicePaymentStatus, payment: { type: PaymentType; refundableMinorUnits: number | null }): boolean; // false for VOID
export type RecordedBy = { kind: 'you' } | { kind: 'email'; email: string } | { kind: 'staff' };
export function recordedByLabel(input: { recordedByStaffId: string | null; viewerId: string | undefined; viewerRole: Role | undefined; staffEmails: ReadonlyMap<string, string> | undefined }): RecordedBy;
export type AmountDueView = { kind: 'due'; minorUnits: number } | { kind: 'overpaid'; minorUnits: number };
export function amountDueView(amountDueMinorUnits: number): AmountDueView;
export function recordAmountPrefill(amountDueMinorUnits: number): string; // '' when ≤ 0, else toEditableAmount
export type ParsedPaymentAmount = { ok: true; minorUnits: number } | { ok: false; error: 'invalid' | 'zero' | 'tooLarge' | 'overRefundable' };
export function parsePaymentAmount(input: string, maxMinorUnits: number): ParsedPaymentAmount; // max = MAX_MINOR_UNITS for a payment, the refundable amount for a refund
export function mergePaymentPages<T extends { id: string }>(pages: readonly (readonly T[])[]): T[]; // page order, first occurrence of each id kept
export function newIdempotencyKey(): string; // crypto.randomUUID() if present, else a v4 UUID from crypto.getRandomValues (decision q)
// use-invoice-payment-history.ts (decision h)
export interface InvoicePaymentHistory {
  invoice: InvoicePaymentsQuery['invoice'] | undefined; // page-0 result: amounts and status
  payments: PaymentRowFragment[];                        // merged, de-duplicated, server order
  hasNextPage: boolean; loading: boolean; error: boolean;
  loadingMore: boolean; loadMoreFailed: boolean;
  loadMore(): Promise<void>; // no-op while loadingMore or !hasNextPage; offset = lastOffset + lastPage.length; result dropped if reload() ran meanwhile
  reload(): Promise<void>;   // generation += 1, clears extra pages and load-more flags, refetches page 0
}
export function useInvoicePaymentHistory(invoiceId: string): InvoicePaymentHistory;
// use-invoice-payment-mutations.ts
export interface InvoicePaymentMutations {
  record(input: Omit<RecordInvoicePaymentInput, 'invoiceId'>): Promise<boolean>;
  refund(input: RefundInvoicePaymentInput): Promise<boolean>;
  pending: boolean;
  error: string | null; // server message or the fallback copy; cleared when the next write starts
}
export function useInvoicePaymentMutations(options: { invoiceId: string; refetch: () => Promise<unknown>; lock?: LaundryMutationLock }): InvoicePaymentMutations;
// invoice-payments-panel.tsx
export interface InvoicePaymentsPanelProps { invoiceId: string; role: Role | undefined; viewerId: string | undefined; lock?: LaundryMutationLock; onChanged?: () => Promise<unknown> }
export function InvoicePaymentsPanel(props: InvoicePaymentsPanelProps): JSX.Element;
```
`parsePaymentAmount`: `''`/malformed → `invalid` (via `parsePesosToMinorUnits`'s format); the digit string is checked for length before conversion so values beyond `Number.MAX_SAFE_INTEGER` never reach `parseInt` → `tooLarge`; `0` → `zero`; `> maxMinorUnits` → `tooLarge` (payment) or `overRefundable` (refund). The server stays authoritative (A2, B6, B7).

**Panel behavior:** uses `useInvoicePaymentHistory`; runs `useAdminsQuery` **only** when `role === 'TENANT_OWNER'` (`skip` otherwise). Always renders the amounts block (total, amount paid, amount due via `amountDueView` — "Overpaid by ₱x" when negative — and the status badge; decision o). History in merged order with `formatManilaDateTime`; refund amounts as `−₱x`; "Refund of" names the original by its `paidAt` and amount. "Record payment" (only if `canRecordPayment`) opens a `FormDialog`: method `<select>` required; amount input pre-filled by `recordAmountPrefill`; reference input; `datetime-local` paid-at pre-filled with now in Manila and `max` = now in Manila. "Refund" per row (only if `canRefundPayment`) opens a `FormDialog` with the permanent-action notice (decision j); amount pre-filled with the refundable amount. Field errors from `parsePaymentAmount` show inline and block the submit (no mutation). The idempotency key is created with `newIdempotencyKey()` when a dialog **opens**, kept for every submit while it stays open, and discarded on close. `paidAt` is sent only if the user edited the field (`manilaDateTimeLocalToIso`). After success: toast, close, `history.reload()`, then `onChanged?.()`. Failure: inline `role="alert"` with `error`, dialog stays open, key kept. "Load more" shows while `hasNextPage` and calls `loadMore`; its failure shows "Unable to load more payments." and keeps the rows already loaded.

- [ ] **Step 1: Write the failing tests**
  - `invoice-payments.test.ts`: role tables for both `can*` functions (all six roles × `UNPAID`/`VOID`); `canRefundPayment` false for a `REFUND` row and for `refundableMinorUnits` 0 or null; `recordedByLabel`: own id → `you` (any role); other staff + `TENANT_OWNER` + email known → `email`; other staff + `FINANCE` with a map → `staff` (map ignored); `TENANT_OWNER` with the id missing from the map → `staff`; `null` id → `staff`; `amountDueView(-200) → { kind: 'overpaid', minorUnits: 200 }`, `(0)` and `(700)` → `due`; `recordAmountPrefill(700) === '7.00'`, `(0)` and `(-5)` → `''`; `parsePaymentAmount`: `'abc'` and `''` → `invalid`, `'0'` and `'0.00'` → `zero`, `'21474836.47'` → `ok 2147483647`, `'21474836.48'` → `tooLarge`, `'99999999999999999999'` → `tooLarge` (no `parseInt` precision loss), `('5.01', 500)` → `overRefundable` when called for a refund; `mergePaymentPages([[a,b],[b,c]])` → `[a,b,c]`, `([[a],[]])` → `[a]`, order of first occurrences preserved; `newIdempotencyKey()` with `crypto.randomUUID` present returns its value; with `randomUUID` removed (stub `globalThis.crypto` to an object exposing only `getRandomValues`) returns a string matching `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/` that also passes the API's A1 regex, and two calls differ.
  - `use-invoice-payment-history.apollo.test.tsx` (**real Apollo**, `MockedProvider` with an `InMemoryCache`, the `use-laundry-catalog-search.apollo.test.tsx` harness): mocks `InvoicePayments` for `offset: 0` → nodes `[p1, p2]`, `hasNextPage: true`; and `offset: 2` → nodes `[p2, p3]`, `hasNextPage: false`. After `loadMore()`: the rendered `payments` ids are exactly `['p1','p2','p3']` (`p3` **appears**, `p2` once), and `hasNextPage` is false. A failing `offset: 2` mock leaves `['p1','p2']` and sets `loadMoreFailed`. After `reload()`, the extra page is cleared and page 0 is requested again.
    - **all-duplicate page advances:** mocks `offset: 0` → `[p1, p2]`, `hasNextPage: true`; `offset: 2` → `[p1, p2]` (shifted by concurrent inserts), `hasNextPage: true`; `offset: 4` → `[p3]`, `hasNextPage: false`. Two `loadMore()` calls → ids `['p1','p2','p3']`, and the second request used `offset: 4` (not `2` again).
    - **reload during load more:** the `offset: 2` mock is delayed (`delay` on the mocked response); start `loadMore()`, then call `reload()` (page 0 mock returns `[p1, p2]`) before the delayed page resolves; after both settle, ids are exactly `['p1','p2']` — the stale page was discarded — and `loadingMore` is false.
  - hook test for writes (the `use-generate-laundry-invoice.hook.test.tsx` harness): a second `record` while one is pending is dropped (one mutation call); with a lock held by `'transition'`, `record` is refused; a failure sets `error` to the GraphQL message and `pending` returns to false; success calls `refetch` and returns `true`; the variables include the caller's `idempotencyKey` unchanged.
  - panel render test (mocked client hooks):
    - an `OVERPAID` invoice shows "Overpaid by ₱2.00" and no `₱-`;
    - a **mixed history** (payment, partial refund, second payment) renders three rows in server order, the refund as `−₱x` naming its original;
    - a **`REFUNDED`** invoice shows the "Refunded" badge, amount due equal to the total, and no Refund action on fully refunded payments;
    - role gating: `FINANCE` sees Record and Refund; `CUSTOMER_SUPPORT` sees Record, no Refund; `ANALYST` sees neither; `VOID` hides Record and Refund;
    - `useAdminsQuery` is called with `skip: true` for `FINANCE` and `skip: false` for `TENANT_OWNER`;
    - **invalid amount input** (`abc`, `0`) shows the inline error and makes no mutation call; a **very large amount** (`99999999999999999999`, `21474836.48`) shows "That amount is too large." and makes no mutation call; a refund above the refundable amount shows "A refund cannot exceed ₱x." and makes no call;
    - the refund dialog shows the permanent-action notice;
    - **retry keeps the key**: a submit fails, a second submit → both mutation calls carry the same `idempotencyKey`; after success, reopening the dialog → a different key;
    - an untouched paid-at field → no `paidAt` in the input; an edited one → `'…+08:00'`; the field's `max` is now in Manila;
    - empty history → "No payments yet."
- [ ] **Step 2: Run and verify fail** — `pnpm --filter web test -- lib/invoice-payments lib/use-invoice-payment-history lib/use-invoice-payment-mutations lib/invoice-payments-panel` → FAIL.
- [ ] **Step 3: Implement** the units with `@clensy/ui` primitives only (`FormDialog`, `FormField`, `Input`, `Label`, `Button`, `StatusBadge`, `LoadingState`, `useToast`). The history hook uses `useApolloClient().query` for extra pages; it does **not** use `fetchMore` or a cache field policy (decision h).
- [ ] **Step 4: Run and verify pass** — same → PASS; `pnpm --filter web lint` → clean (hooks rules at `error`); `pnpm --filter web exec tsc --noEmit` → clean.
- [ ] **Step 5: Commit** — `feat(39): invoice payments panel with record and refund dialogs`

---

## Task 9: Wire the panel into the laundry page and the billing drawer

**Type:** `code` · **Spec:** §4.10 (both mount points, the panel "below the amount block" in the drawer, existing billing screens, "Order payment" copy unchanged); planning decision o

**Files:**
- Modify: `apps/web/app/app/laundry/[id]/page.tsx` (the page-local `InvoicePaymentBody` receives and forwards `role`, `viewerId` = `currentAdmin.id`, `lock`, and `onPaymentsChanged: () => invoiceQuery.refetch()` to `LaundryInvoiceCard`), `apps/web/components/laundry/laundry-invoice-payment.tsx` (`LaundryInvoiceCardProps` gains `role`, `viewerId`, `lock`, `onPaymentsChanged`; `InvoiceFacts` keeps invoice number, terms and the "Open invoice" link, drops its total and status, and renders `<InvoicePaymentsPanel …/>` below), `apps/web/app/app/billing/page.tsx` (list: status badge labels via `useClensyTranslations('laundry')` `invoicePaymentStatus.*`; "Amount due" cell via `amountDueView` → "Overpaid by ₱x"; drawer (decision o, spec-literal): the amount block is **kept** — Subtotal, Discount, Total, Amount paid and Amount due, with Amount due now rendered through `amountDueView` ("Overpaid by ₱x" when negative) — and the payment status row stays with its label translated; `useCurrentAdminQuery` supplies role and viewer id; the panel renders **below the amount block** with `onChanged` refetching the drawer `Invoice` query and the list `Invoices` query)
- Test: `apps/web/lib/laundry-invoice-payment.render.test.tsx` (stubs + case 5 rewrite), `apps/web/lib/laundry-order-page.render.test.tsx` (stubs + extend), `apps/web/lib/laundry-order-page.interaction.test.tsx` (stubs), new `apps/web/lib/billing-page.render.test.tsx`

**Existing suites that mount the panel (M5 round 3 blocker B1(b/c)).** After this task the Invoice card renders `InvoicePaymentsPanel`, whose hooks (`useInvoicePaymentsQuery`, `useRecordInvoicePaymentMutation`, `useRefundInvoicePaymentMutation`, `useAdminsQuery` from `@clensy/client`; `useApolloClient` from `@apollo/client` for Load more; `useToast` from `@clensy/ui`) need an Apollo client and a `ToastProvider`. Each existing suite that renders a card with an invoice **stubs the panel's client hooks** (not the panel component), so the real panel renders and its badge and amounts stay assertable:

| Suite | Today | Required change |
| --- | --- | --- |
| `laundry-order-page.interaction.test.tsx` | Partial `@clensy/client` mock that keeps real hooks (`:128–139`); only `useApolloClient` mocked (`:98–101`); no Apollo provider; `ToastProvider` present (`:335`). Cases at `:698` and `:734` settle the invoice refetch with `INVOICE`, and `:700` asserts `invoiceText()` contains "Unpaid" | Add to its `@clensy/client` mock: `useInvoicePaymentsQuery` returning `{ data: { invoice: { id, totalMinorUnits, amountPaidMinorUnits: 0, amountDueMinorUnits, paymentStatus, payments: { nodes: [], pageInfo: { hasNextPage: false } } } }, loading: false, error: undefined, refetch }` built from `page.invoiceNodes[0]` (the hoisted `vi.mock` factory cannot reach the `describe`-local `INVOICE`), with `amountPaidMinorUnits` defaulting to `0` and `amountDueMinorUnits` defaulting to `totalMinorUnits` when the node omits them; both payment mutation hooks returning `[vi.fn(), { loading: false }]`; `useAdminsQuery` returning `{ data: undefined }`. The "Unpaid" assertion at `:700` is then satisfied by the panel's badge (the facts block no longer renders a status) and stays unchanged |
| `laundry-order-page.render.test.tsx` | Full `@clensy/client` replacement (`:101`), so unlisted hooks are undefined; `useApolloClient` mocked; `ToastProvider` present (`:173`) | Add the same four hook stubs to its factory, reading `page.invoiceNodes[0]` with the same defaults (its nodes carry total 45000 and no `amountDueMinorUnits`, and its invoice case needs `₱450.00`), plus `InvoicePaymentsDocument: {}` (the `PreviewLaundryOrderPriceDocument: {}` precedent at `:102`) |
| `laundry-invoice-payment.render.test.tsx` | Renders `LaundryInvoiceCard` with `renderToStaticMarkup` and **no providers or mocks**; case 5 (`:143–155`) asserts `₱450.00` and `>Unpaid<` from `InvoiceFacts` | Add `vi.mock('@clensy/client', …)` with the four hook stubs (data from the invoice the case passes, same defaults) and `InvoicePaymentsDocument: {}` and `vi.mock('@apollo/client', …)` overriding `useApolloClient`; wrap `invoiceCard` in `ToastProvider`; pass the new `role`/`viewerId` props. Rewrite case 5 as below |

**Case 5 rewrite** — `case 5: existing invoice shows number, terms and the billing link; the payments panel shows the total and badge`: split the static HTML at the panel's "Payments" heading. The part **before** it (`InvoiceFacts`) contains `INV-2026-000001`, "Pay on delivery", `href="/app/billing?detail=i1"` and "Open invoice", and does **not** contain `₱450.00` or `>Unpaid<`. The part **from** the heading on (the panel, fed by the `useInvoicePaymentsQuery` stub with `totalMinorUnits: 45000`, `paymentStatus: 'UNPAID'`) contains `₱450.00` and `>Unpaid<`; `>UNPAID<` appears nowhere, and `>Unpaid<` appears exactly once in the whole card. (`₱450.00` is not count-asserted: for an unpaid invoice the panel shows it twice, as total and as amount due.) The card is rendered with `role: 'ANALYST'` (no Record or Refund action). The old case 5 whole-card checks `not.toContain('<button')` and `not.toContain('<input')` are kept but applied to the **facts part only**; any old check that "Amount due" is absent is dropped, because the panel renders "Amount due". This case is new behavior: it fails before Step 3 (the facts block still renders the total and status).


- [ ] **Step 1: Write the tests**
  - laundry card render (new behavior): with an invoice, the panel renders inside the Invoice card, and the card shows the status badge exactly once (from the panel) — see the case 5 rewrite above; with the page lock held by `'transition'`, Record is disabled.
  - **Suite stubs (B1(b/c))** — add the hook stubs from the table above to `laundry-order-page.interaction.test.tsx`, `laundry-order-page.render.test.tsx` and `laundry-invoice-payment.render.test.tsx` in this step, before Step 3. They are inert until the panel is mounted.
  - **Characterization test** — `keeps the Order payment explanation`: the "Order payment" card still renders `order.payment.explanation` and its verbs unchanged (spec §4.10). It passes before Step 3 (see [Characterization tests](#characterization-tests)).
  - laundry page render: `InvoicePaymentBody` forwards role, viewer id and lock to the card; after a successful payment write, `InvoiceForOrder` is refetched once.
  - billing page render: list badge shows "Partially paid", not `PARTIALLY_PAID`; an `OVERPAID` row's Amount due cell shows "Overpaid by ₱2.00"; the drawer's amount block for an `OVERPAID` invoice shows "Overpaid by ₱2.00" in its Amount due row and no `₱-` anywhere in the drawer; the drawer status row shows the translated label; the panel renders after (below) the amount block in document order; a successful write refetches both `Invoice` and `Invoices`.
- [ ] **Step 2: Run and verify** — `pnpm --filter web test -- lib/laundry-invoice-payment lib/laundry-order-page lib/billing-page` → new-behavior tests (including rewritten case 5) FAIL; the characterization test and every unchanged existing case (including the interaction suite's invoice cases at `:698` and `:734`) PASS. The pattern `lib/laundry-order-page` matches the render and interaction suites; `lib/laundry-invoice-payment` matches the render suite and Task 7's `laundry-invoice-payment.test.ts`.
- [ ] **Step 3: Implement** the wiring.
- [ ] **Step 4: Run and verify pass** — same → PASS; `pnpm --filter web exec tsc --noEmit` → clean; `pnpm --filter web lint` → clean.
- [ ] **Step 5: Commit** — `feat(39): show invoice payments on the laundry order page and billing drawer`

---

## Task 10: Full verification, browser check and M6 report

**Type:** `docs/process` (verification replaces TDD)

- [ ] **Step 1: Run the CI set** from the repository root: `pnpm lint`, `pnpm --filter api exec tsc --noEmit`, `pnpm --filter web exec tsc --noEmit`, `pnpm test`, `pnpm build`. Expected: all pass.
- [ ] **Step 2: Run the database suites**: `pnpm --filter api migration:run`, `pnpm --filter api test:e2e`. Expected: all pass, including the release gate.
- [ ] **Step 3: Browser check** (the `run` skill; Docker stack): as `TENANT_OWNER`, on a priced laundry order with an invoice: record ₱10.00 cash (Partially paid), record an overpayment (Overpaid by …), refund the excess (Paid), refund all (Refunded); confirm the billing list and drawer agree and show translated labels; as `CUSTOMER_SUPPORT`, confirm Record is shown and Refund is not; as `ANALYST`, confirm neither. Record what was checked; #209 remains the owner of the formal browser verification.
- [ ] **Step 4: Append the M6 execution record and Slice Completion Report** to this plan (deviations, actual command results), per `docs/workflows/conventions/reporting-conventions.md`.
- [ ] **Step 5: Commit** — `docs(39): record M6 implementation`

---

## Characterization tests

These pin already-correct behavior, so they pass before their task's implementation step. Each break run is made **outside the committed change and is not committed**; the break is stated in behavioral terms and M6 chooses the edit.

| Test (task) | Behavior deliberately broken | Tests expected to fail | Run |
| --- | --- | --- | --- |
| Task 7 group "positive formatting unchanged" (`0`, `150`, `2147483647`) | `formatMinorUnits` omits the `₱` currency sign for every input. Today's output is `₱0.00`, `₱1.50`, `₱21474836.47`; under the break it is `0.00`, `1.50`, `21474836.47`, so **each of the three** assertions fails. (Revision 2's "lose centavos padding" break failed only `0`: `String(150 % 100)` is `'50'` and `String(2147483647 % 100)` is `'47'`, already two digits, so `padStart` never pads them — `format-price.ts:10`. M5 round 2 blocker N2.) | All three cases of that group, each with its own failure message; the negative cases already fail before Step 3 for their own reason | On the pre-Step-3 code, after Step 2 and before Step 3; outside the committed change; reverted and not committed |
| Task 9 `keeps the Order payment explanation` | The Order payment card no longer renders its explanation sentence | That test only | Outside the committed change; not committed |

Every other listed test is a new-behavior test and fails before its task's implementation step. All `Expected:` lines remain predictions until M6 records results.

## M5 round 1 resolution

| M5 finding | Resolution | Where |
| --- | --- | --- |
| Blocker 1a — admin suites `TRUNCATE` a newly referenced table | Explicit two-table `TRUNCATE "payment_entity", "admin_user_entity"`, no `CASCADE` | Decision m; Task 3 Step 4 |
| Blocker 1b — `billing.service` explicit entity list | `PaymentEntity` added to `ENTITIES` | Decision m; Task 3 Step 4 |
| Blocker 1c — Task 3 commit would not boot | Skeletal `PaymentsModule` registered in Task 3; boot check (`billing.e2e`) in Tasks 3, 4, 5; Global constraint on bootable commits | Task 3, Task 4 Step 4, Task 5 Step 4 |
| Blocker 1d — no task runs the affected suites | Added to Task 3 Step 5 and Task 6 Step 4 commands | Task 3, Task 6 |
| Blocker 2 — "Load more" does not append; test cannot detect | Hook-state accumulation + `mergePaymentPages` de-duplication; real-Apollo test proving `p3` renders and `p2` appears once | Decision h; Task 8 |
| Blocker 3 — unlabelled characterization tests | Task 7 positive cases labelled and given a break entry | Task 7 Step 1; Characterization tests |
| Decision f amendments | Intercepted call, waited-on statement, both conditions, direct service calls via `AppModule` | Decision f, p; Task 4 step 6; Task 6 Step 2 |
| Decision j rationale | "Correctable by a new payment" removed; permanent-action notice added | Decision j; Task 7 copy; Task 8 |
| Note — SQL `SUM` safe integer | Explicit `::text` + `Number.isSafeInteger` check, with a unit test | Task 4 |
| Note — `updatedAt` bump | Raw two-column `UPDATE`; `updatedAt` unchanged, asserted in e2e | Decision n; Task 2; Task 6 Step 1 |
| Note — web coverage gaps | Mixed history, `REFUNDED`, invalid and very large amounts, refund cap, paid-at `max` | Task 8 Step 1 |
| Note — amounts shown twice | Panel owns the amounts on the laundry page; the laundry host drops its duplicates. **Superseded for the billing drawer in revision 3** (spec-literal §4.10 reading; see round 2 table) | Decision o; Task 9 |
| Note — `PaymentType` name clash | DTO class renamed `PaymentObjectType` | Global constraints; Task 5 |
| Note — entity header comments | `invoice.entity.ts` and `admin-user.entity.ts` updated | Task 3 |
| Note — `payment.type.ts` import rule | Stated as a Global constraint and in decision l | Global constraints |
| Note — A3 UTF-16 vs characters | Code-point count, with a unit test | Global constraints; Task 4 |
| Note — B4 non-`COMPLETED` e2e | Direct `PENDING` insert case | Task 6 Step 1 |
| Note — "no laundry import" unenforced | Source-guard unit spec | Task 4 Step 1 |
| Note — wiring through `InvoicePaymentBody` | Stated explicitly | Task 9 |
| Note — key after cancel / 409 dead end | Spec-literal lifecycle kept (one key per dialog open); 409 message tells the user to close and start a new entry | Task 4 step 4 |
| Note — `formatMinorUnits` source-text check | Dropped | Task 7 |
| Note — `ADD VALUE` in a later migration | Recorded in `database-migrations.md` | Task 3 Step 6 |
| Optional — allowlist `DEFAULT_SORTS`, label-key contract | Both added | Task 5; Task 7 |

## M5 round 2 resolution

| M5 round 2 finding | Resolution | Where |
| --- | --- | --- |
| **Blocker N1** — Task 5 breaks live-surface guard suites no task touched | Every guard suite now changes in the task whose commit first changes what it inventories (decision s). `tenant-read-authorizers.e2e-spec.ts`: `PaymentEntity` → `CUSTOM_SURFACE_ENTITIES` in **Task 3** (the suite fails as soon as the tenant-owned entity is registered — found while verifying N1), `'Payment.invoice'` → `CUSTOM_OBJECT_FIELDS` in Task 5. `laundry-billing.tenant-isolation.e2e-spec.ts`: `'Payment.invoice'` → `expected` (Task 5). `root-operation-authorization.e2e-spec.ts:55` 63 → 65 with the two inventory keys (Task 5). `two-tenant-release-gate.e2e-spec.ts:147` 65 → 67 with role matrix and probes (Task 5). Counts re-verified against current source. Same-cause moves, for the same per-commit reason: release-gate world fixture, `removeTestTenants` and its e2e case → Task 3 (the gate's fixture phase requires a `payment_entity` row once the table exists); root-operation inventory, role matrix, probes, relation-field case and nested-connection allowlist e2e → Task 5. All named suites are in the Task 3, 5 and 6 run commands, and the release gate runs in Tasks 3, 5 and 6 | Decision s; Task 3 Files, Steps 4–5; Task 5 guard-suite table, Steps 1–2, 4; Task 6 Files, Steps 3–4; File map; Risks |
| **Blocker N2** — characterization break fails only `0` | Break is now "omit the `₱` sign", which changes all three outputs (`0.00`, `1.50`, `21474836.47`); one `it` per input; the break run is a recorded step between Step 2 and Step 3, reverted before Step 3 and never committed | Characterization tests; Task 7 Steps 1–2 |
| Note — load-more/reload race | Generation counter: `reload()` increments it; a `loadMore()` result from an older generation is discarded; real-Apollo test with a delayed page | Decision h; Task 8 interface, Step 1 |
| Note — all-duplicate page stalls | `nextOffset = lastOffset + lastPage.length` (raw page length, not `merged.length`); real-Apollo test asserting the second request uses `offset: 4` | Decision h; Task 8 interface, Step 1 |
| Note — `crypto.randomUUID` absent on non-secure LAN origins | Fallback to a v4 UUID built from `crypto.getRandomValues`; no `Math.random`; unit test with `randomUUID` removed. HTTPS-only is **not** assumed | Decision q; Task 8 interface, Step 1 |
| Note — `PaymentResolver` guards must be method-level | Guards and `@Roles` on the two mutations only; resolver spec asserts no class-level or field-resolver guard metadata; `relation-field-authorization` re-run in Task 5 | Decision r; Task 5 shapes, Step 1, guard-suite table |
| Note — drift-check order | `uq_payment_tenant_idempotency_key` and both indexes declared on the entity; CHECKs, `uq_*_id_tenant` and composite FKs stay hand-written (repository convention); the drift check moved after the docs step and judged against the updated list, new noise recorded there | Task 3 entity rules, Steps 3, 6, 7 |
| Note — barrier poll scope | Every `pg_stat_activity` poll filtered by `datname = current_database() AND pid <> pg_backend_pid()`, asserted in the barrier contract case | Decision f; Task 6 Step 2 |
| Note — drawer "Amount due" vs spec §4.10 | Spec-literal: the drawer keeps its amount block including Amount due (via `amountDueView`, "Overpaid by ₱x") and the status row; the panel renders below it. The resulting duplication in the drawer is recorded as the literal reading; changing it is an owner spec decision | Decision o; Task 9 Files, Step 1 |

## M5 round 3 resolution

| M5 round 3 finding | Resolution | Where |
| --- | --- | --- |
| **Blocker B1(a)** — Task 7 breaks "keeps billing tones" (`laundry-invoice-payment.test.ts:19–26`, exactly four tones) | File added to Task 7 Files and to the Step 2 and Step 4 run commands; the case expects the six-entry map (four existing tones unchanged, `OVERPAID: 'warning'`, `REFUNDED: 'neutral'`) and is labelled a new-behavior test that fails before Step 3 | Task 7 Files, Steps 1, 2, 4; File map |
| **Blocker B1(b)** — Task 9 breaks `laundry-order-page.interaction.test.tsx` (real panel hooks, no Apollo provider) | File added to Task 9; its partial `@clensy/client` mock gains stubs for `useInvoicePaymentsQuery`, both payment mutations and `useAdminsQuery`; its existing "Unpaid" assertion is then met by the panel badge | Task 9 Test list, "Existing suites that mount the panel" table, Steps 1–2 |
| **Blocker B1(c)** — `laundry-order-page.render.test.tsx` (full client mock) and case 5 of `laundry-invoice-payment.render.test.tsx` (no providers; asserts total and badge from `InvoiceFacts`) | Render suite: the same four hook stubs. Card suite: client and `useApolloClient` mocks, `ToastProvider` wrapper, new props; case 5 rewritten to assert number/terms/link in the facts part and total/badge in the panel part, failing before Step 3. Hook stubbing chosen over a panel stub so the badge stays assertable through the real panel | Task 9 table and case 5 rewrite |
| Note 1 — world-building suites not run in Task 3/6 | `relation-field-authorization release-gate/` added to Task 3 Step 5; `release-gate/` added to Task 6 Step 4 | Task 3 Step 5; Task 6 Step 4 |
| Note 2 — `buildTenantWorld` wiring | Task 3 Files state that `buildTenantWorld` (`two-tenant-world.ts:362–420`) calls `fixtures.payment` after creating the world invoice and sets `paymentId` | Task 3 Files |
| Note 3 — Task 3 decision references | Type line now cites decisions b, m, s | Task 3 |
| Note 4 (optional) — refund in the tenant-removal test | **Added**: the case inserts a payment and a refund of it and asserts both are removed. `removeTestTenants` deletes `REFUND` rows before the rest, so the self-referencing RESTRICT FK never depends on intra-statement check order | Task 3 Files |

## M5 round 4 notes

Folded in after the round 4 ACCEPT; none changes behavior or task structure.

| Round 4 note | Change | Where |
| --- | --- | --- |
| 1 — stub data must come from each suite's own invoice | Stubs read `page.invoiceNodes[0]` (card suite: the passed invoice), amount paid defaults to 0, amount due to the total | Task 9 table |
| 2 — `InvoicePaymentsDocument` in full-replacement mocks | `InvoicePaymentsDocument: {}` added to the page render and card suite mocks | Task 9 table |
| 3 — old case 5 checks | Role `ANALYST`; `<button`/`<input` checks kept on the facts part only; "Amount due" absence check dropped | Task 9 case 5 rewrite |
| 4 — `release-gate/` runs four suites | All four named | Task 3 Step 5 |
| 5 — Step 4 vs Files wording | Step 4 says the two deletes, refunds first | Task 3 Step 4 |

## Traceability

| Spec section | Task(s) |
| --- | --- |
| §3 terminology, enums, `MAX_MINOR_UNITS` | 1 |
| §4.1 module placement, billing port | 2, 4, 5 |
| §4.2 `Payment` fields, refund ceiling, immutability | 1, 3, 4 |
| §4.3 derivation and worked examples | 1, 6 |
| §4.4 amended invariants, negative amount due | 1, 7, 8, 9 |
| §4.5 A1–A4, B1–B7, idempotency, `paidAt` contract | 4, 6, 8 |
| §4.6 transaction, lock, guarantees 1–5, audit | 4, 6 |
| §4.7 GraphQL surface, roles, public fields, order | 3 (tenant-surface allowlist), 5 (surface and its guard suites), 6 |
| §4.8 no order coupling, terms informational | Constraint; Task 6 flow test asserts the order status is unchanged after every write; Task 4 adds no laundry import |
| §4.9 migration and fixtures | 3 (migration, world fixture, tenant removal), 5 (release-gate probes, role matrix), 6 |
| §4.10 web panel, billing screens, formatting | 7, 8, 9 |
| §4.11 compatibility | 7 (tone map type-check), 9 |
| §7 tests expected | 1, 3, 4, 5, 6, 7, 8, 9 |
| §4.10 "every row" (pagination) | 7 (query), 8 (history hook, real-Apollo test) |
| Amendment #39 §9.1 items 1–6 | 1, 2, 3, 7, 9 |
| M3 deferred notes: Refund on `VOID` in the UI | 8 (`canRefundPayment` false for `VOID`) |
| M3 deferred notes: "Recorded by" label test | 8 |
| M3 deferred notes: `recordedByStaffId = null` label | 8 (`staff`) |

## Deferred / out of scope

Per spec §2 and §8: gateways and customer-initiated payment; voiding invoices or payment entries; any order-status coupling or relaxing the prepaid gate; a root `payments` query; reconciliation and cash-drawer reports (#43); receipts, printing, notifications; translating the rest of the billing page; `docs/features/laundry.md` (M9).

## Execution / scheduling risks

- **E2e database contention.** The new specs share the billing advisory lock; run them with the billing specs, not in parallel with ad-hoc DB work.
- **`ALTER TYPE … ADD VALUE` in a transaction.** Allowed on PostgreSQL ≥ 12 as long as the new values are not used in the same transaction; the migration does not use them. If the CI Postgres is older, M6 records the deviation and splits step 1 into its own non-transactional migration.
- **Generated client drift.** Task 7 regenerates `generated/graphql.ts`; any unrelated diff in it means the local schema was stale — reboot the API and regenerate before committing.
- **Release-gate fixture check.** The gate fails closed until `payment_entity` is populated in both worlds; the world fixture is added in Task 3, the commit that creates the table (decision s).
- **Whole-table truncation in some suites.** `admins.service*` (explicitly) and `billing.service` / `laundry.service` (through their existing `CASCADE`) empty `payment_entity` in the e2e database. This matches those suites' existing practice of emptying whole tables; run e2e only against a disposable database, never one holding browser-check data you want to keep.
- **Intermediate commits.** Each code task names its boot check; if a boot check fails at a commit, fix it in that task rather than deferring to a later one.

## M6 execution record

Executed on branch `feat/39-laundry-payments` (base `f937355`), tasks 1 to 10, with the Accepted spec and the Accepted plan above. Nothing was pushed. All counts below are the actual results recorded by each task.

### Per-task commits and verification

| Task | Commit | Actual verification |
| --- | --- | --- |
| 1 Payments domain | `73d181d feat(39): payments domain — derivation, refundable amount, key syntax` | RED: 3 suites failed on missing modules. GREEN: 10 suites, 97 tests. API `tsc` clean. |
| 2 Billing writer port | `af3a7f3 feat(39): billing InvoicePaymentWriter port` | RED: 2 suites failed on the missing module. GREEN: 8 suites, 74 tests. API `tsc` clean. |
| 3 Persistence | `8ef509b feat(39): payment_entity, invoice relation and CreatePayments migration`; follow-up `3c71186 test(39): keep the gate-world invoice's derived pair consistent with its payment` | Migration e2e RED on the missing module, then 12/12. `migration:run` executed `CreatePayments1791043200000`. 13 e2e suites, 89 tests. Release gate 12/12. API unit 79 suites, 1106 tests. |
| 4 PaymentsService | `8bd85c7 feat(39): PaymentsService record/refund with ordered checks under the invoice lock` | RED: 3 suites failed. GREEN: 6 suites, 103 tests. Boot check `billing.e2e` 5 tests. Full API unit 82 suites, 1180 tests. |
| 5 GraphQL surface | `3696250 feat(39): Payment GraphQL type, Invoice.payments, record/refund mutations` | RED: 3 unit suites failed on missing modules; 5 guard e2e suites failed (7 tests) on stale inventories. GREEN: unit 9 suites, 45 tests; guard e2e 6 suites, 75 tests; release gate 12/12. Full API unit 84 suites, 1204 tests. Full e2e 53 suites, 493 tests. |
| 6 E2e, race, isolation, gate | `bb5fe19 test(39): payments e2e, lock race, tenant isolation and release-gate coverage` | payments.e2e 31, payments.concurrency 7, payments e2e filter run five times in a row 50/50 each time. Release gate 12/12 (matrix of 67). |
| 7 Client operations, money, copy | `f50758e feat(39): payment client operations, sign-aware money, Manila time helpers, copy` | RED: format-price negatives (3), manila-time (module missing), tone map case failed; characterization group passed. GREEN: web 60 files, 2568 tests; `@clensy/web` 16 files, 431 tests; `tsc` clean. |
| 8 Panel and dialogs | `3a292b2 feat(39): invoice payments panel with record and refund dialogs` | RED: 4 new files failed to load. GREEN: web 64 files, 2665 tests; the four new files alone 97 tests. |
| 9 Page and drawer wiring | `8107827 feat(39): show invoice payments on the laundry order page and billing drawer` | RED: 11 failed, 2665 passed (2676). GREEN: 65 files, 2676 tests, no act or React warnings. |
| 10 Verification and record | this commit `docs(39): record M6 implementation` | See "Task 10 verification". |

### Characterization evidence

- **Task 7, "positive formatting unchanged" (`0`, `150`, `2147483647`).** The three cases passed on the pre-Step-3 code. Break: `formatMinorUnits` returned `${whole}.${fraction}` without the `₱` sign. Under the break **3 of 3 failed**, each for the missing sign: `expected '0.00' to be '₱0.00'`, `expected '1.50' to be '₱1.50'`, `expected '21474836.47' to be '₱21474836.47'`. (The break also failed 14 pre-existing consumers of the sign in render and page tests, expected collateral.) Reverted with `git checkout`; the diff was 0 bytes before Step 3; never committed.
- **Task 9, `keeps the Order payment explanation`.** Passed on the pre-implementation code. Break: the `order.payment.explanation` paragraph was deleted from `LaundryOrderPaymentCard`. The test **failed** (`expected '<div class="rounded-md border border-…' to contain 'The order must be marked paid before processing starts. …'`), as did the existing `case 6` for the same cause. Reverted with `git checkout`; the diff was 0 bytes; never committed.

### Deviations and rulings

1. **Task 3, gate-world payment fixture.** The fixture also sets the world invoice's derived pair (500 / `PARTIALLY_PAID`; later re-derived through `deriveInvoicePayment` in Task 5), following spec §4.4 over the brief's insert-only wording.
2. **Task 5, guard suites and fakes.** `laundry-billing.tenant-isolation` needed both mutations in its `valueRoots` exemption list (exact names, live-checked). `payments.module.di.spec` gained a fake `BillingModule` export. The `refundableMinorUnits` no-guard rule is pinned by a unit test, because the relation-field check covers only object-typed fields. Two stale count comments were corrected.
3. **Task 6, decision f barrier waiter match.** `pg_stat_activity.query` is truncated at 1 kB, so `FOR UPDATE` is invisible. A waiter is now a backend whose query contains `FROM "invoice_entity"` and that holds a granted `RowShareLock` on `invoice_entity`; the Lock-wait and `pg_blocking_pids` conditions are unchanged. The lock-removal mutation makes both race tests fail.
4. **Task 6, "no input field named `paymentStatus` / `amountPaidMinorUnits`".** Narrowed: the pre-existing #38 read-only `InvoiceFilter.paymentStatus` is the only such field, pinned by name and type.
5. **Task 8, method select.** The method select is pre-selected (`CASH` for record; the original's method for refund) because no placeholder copy exists. **Open owner question.**
6. **Task 9, relocated tests.** Two tests moved from the static render suite to the jsdom interaction suite (lock forwarding; `InvoiceForOrder` refetched once), because `renderToStaticMarkup` cannot click.
7. **Task 10, stale client test (found by `pnpm test`).** `packages/client/src/laundry-operations.test.ts` ("requests the invoice card fields for the order invoice") still expected the pre-#39 `InvoiceForOrder` selection and failed with `amountPaidMinorUnits` added by Task 7 (planned: "`InvoiceForOrder` adds `amountPaidMinorUnits`"). No earlier task ran that package's tests. The expectation now includes `amountPaidMinorUnits`; the assertion is otherwise unchanged (not loosened).
8. **Task 10, database used for Step 2.** The brief's commands read `DB_NAME=clensy` from `.env`, which is the dev database that the Docker stack uses, and the e2e suites truncate tables (see the scheduling risk above). Step 2 was run with `DB_NAME=clensy_e2e` (an existing disposable database) instead; no database was deleted or reset. `clensy` already had `CreatePayments1791043200000` applied by Task 3.

### Task 10 verification (repository root unless stated)

| Command | Result |
| --- | --- |
| `pnpm lint` | Passed: 6 of 6 tasks, exit 0 |
| `pnpm --filter api exec tsc --noEmit` | Passed, exit 0 |
| `pnpm --filter web exec tsc --noEmit` | Passed, exit 0 |
| `pnpm test` (first run) | **Failed**: `@clensy/client` `laundry-operations.test.ts` > "requests the invoice card fields for the order invoice" (received an extra `amountPaidMinorUnits`). Deviation 7. |
| `pnpm test` (after the fix) | Passed, 10 of 10 tasks: ui 11 files / 124 tests, validation 6 / 79, client 2 / 15, `@clensy/web` 16 / 431, api 84 suites / 1204, web 65 files / 2676 |
| `pnpm build` | Passed, 7 of 7 tasks, exit 0 (turbo output-file warnings only) |
| `pnpm --filter api migration:run` (`DB_NAME=clensy_e2e`) | `CreatePayments1791043200000` executed successfully |
| `pnpm --filter api test:e2e` (`DB_NAME=clensy_e2e`) | Passed: 55 suites, 531 tests, including the release gate |

### Browser check

**Browser check not performed — the running Docker API does not serve this branch.** `clensy-platform-api-1` runs `node dist/main.js` from an image started 2026-11-01, and its live schema rejects `recordInvoicePayment` ("Cannot query field \"recordInvoicePayment\" on type \"Mutation\""). Checking this branch needs the API and web images rebuilt and recreated, which changes the owner's running stack, and no role credentials for `TENANT_OWNER`, `CUSTOMER_SUPPORT` and `ANALYST` were available to this run. Nothing was faked or inferred. The planned scenarios (record ₱10.00 cash to Partially paid; overpay; refund the excess to Paid; refund all to Refunded; list and drawer agreement; translated labels; role visibility of Record and Refund) remain unchecked in a real browser. The same behaviors are covered by the jsdom, render and e2e tests above. #209 remains the owner of the formal browser verification.

## Slice Completion Report

| Field | Result |
| --- | --- |
| Slice | Laundry invoice payments (#39) |
| Tracking | https://github.com/rexescario-dev/clensy-platform/issues/39 |
| M4 | Plan **Accepted** |
| M5 | Review **Accepted** (round 4) |
| M6 | **Complete** |
| M7 | Pending |
| M8 | Pending |
| M9 | Pending |
| Branch | `feat/39-laundry-payments` |
| PR | None yet |
| Status | **Ready for M7** |

### Shipped

- Payments domain: per-invoice `PAYMENT` and `REFUND` entries, derivation of the amount paid and the payment status (now including `OVERPAID` and `REFUNDED`), and the refundable-amount rule.
- `payment_entity` persistence and the `CreatePayments` migration, with tenant-composite foreign keys and an idempotency key.
- `PaymentsService` record and refund, run under the invoice lock with ordered validation and replay-safe idempotency.
- GraphQL surface: `Payment`, `Invoice.payments` (offset connection), `recordInvoicePayment` and `refundInvoicePayment` with their role limits.
- Web: the invoice payments panel with record and refund dialogs and paged history, on the laundry order page and in the billing drawer.
- Sign-aware money formatting, Manila time helpers and the payment copy.
- Coverage: end-to-end, lock-race, tenant-isolation and release-gate suites.

### Validation

| Check | Result |
| --- | --- |
| Tests | **Passed** (`pnpm test` 10 of 10 tasks after the Task 10 fix; API e2e 55 suites, 531 tests, including the release gate) |
| Typecheck | **Passed** (API and web `tsc --noEmit`) |
| Lint | **Passed** (`pnpm lint`) |
| Build | **Passed** (`pnpm build`) |
| Package validation | N/A |
| Browser check | **Not performed** (running stack does not serve this branch; #209 owns the formal check) |

### Next Gate

**M7 — Code Review.** This slice changes application code, authorization, tenant isolation and the schema, so `CLAUDE.md` requires a fresh, independent reviewer on the most capable model that did not implement the change, given the Accepted spec, the Accepted plan and the branch diff. The M7 record must cite that review.

### M6 final whole-branch review (after Task 10)

A fresh reviewer on the most capable model reviewed `d9a7c54..4f553a8` (read-only, nothing executed): **Ready to merge — with fixes**. It confirmed lock coverage, the §4.5 check order, money range and derivation, idempotency, authorization, tenant isolation and migration safety, and agreed with all four controller rulings (gate-world derived pair; barrier waiter match; `InvoiceFilter.paymentStatus` pin; pre-selected payment method).

One Important finding: the B6, B7 and A2 server messages named amounts as "N minor units", which the panel shows verbatim, so staff could misread a refundable amount by a factor of 100. Fixed in `0610d2e` with three small minors in the same commit:

| Finding | Fix |
| --- | --- |
| Important — "minor units" in server messages | Payments-domain `formatPesos` (integer-only, unit-tested); messages now read e.g. "…refundable amount of ₱50.00."; A2 reads "The amount must be from ₱0.01 to ₱21474836.47." |
| Over-refund e2e assertion was `toContain('500')` | Exact message asserted |
| Edited paid-at invalid or in the future showed only a red help text | Field error "Enter a time that is not in the future." (`payments.error.paidAtFuture`), render test |
| Empty actions column header | Visually hidden "Actions" (`payments.actionsHeader`) |
| `down()` silently drops payment rows | Documented in `database-migrations.md` and above `down()`; behaviour unchanged |

Fix-wave verification (`DB_NAME=clensy_e2e` for e2e): API `tsc` clean; payments unit 134 passed; payments e2e 50 passed; web 2677 passed; web `tsc` and lint clean; `@clensy/web` 431 passed. A scoped re-review verdicted all five findings ADDRESSED with no new breakage.

Not changed, for the owner: the billing drawer shows total, paid, due and status twice (decision o, spec-literal; raise at #209); the method field is a native `<select>` as the plan specified; the payment method is pre-selected (CASH for a record, the original's method for a refund). Twenty-nine deferred minors from the task reviews were triaged as safe to follow after merge.

Status remains **Ready for M7**.
