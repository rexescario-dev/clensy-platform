# Laundry Invoice and Payment Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Draft** (M4), 2026-10-24. Not reviewed. |
| Date | 2026-10-24 |
| Tracking issue | [#166](https://github.com/rexescario-dev/clensy-platform/issues/166) "Laundry invoice and payment experience". Epic [#154](https://github.com/rexescario-dev/clensy-platform/issues/154). Depends on [#156](https://github.com/rexescario-dev/clensy-platform/issues/156) (merged in #183: the order page). Shares the in-flight flag with [#165](https://github.com/rexescario-dev/clensy-platform/issues/165) (open, not started: no branch or PR), so this slice introduces the page-level flag and #165 reuses it. |
| Branch | `feat/166-laundry-invoice-payment`, from `main` at `9135546`. One PR for this plan, its M5 record and the implementation. |
| Scope | `packages/client`: one operation document (`InvoiceForOrder`) and its regenerated output, plus a client test. `apps/web`: a new pure module, two new hooks, a new presentational component file, the shared invoice payment-status tone map (moved out of the billing page), the order page, and tests. `packages/web`: `laundry` copy. **No** API, schema, migration, resolver, GraphQL type, `@clensy/ui` or dependency change. The list page and the drawer (`apps/web/app/app/laundry/page.tsx`) are not edited. |
| Implements (Accepted) | [Laundry Orders & Lifecycle](../specs/2026-09-06-laundry-orders-lifecycle-design.md), Status **Accepted** (2026-09-06), with **Amendment #164**, Accepted 2026-10-10. Governing text: **§8.4.4**, invoice bullet ("Invoice generation stays the Accepted `generateInvoiceFromOrder` rules. Marking the order `PAID` or `AWAITING_PAYMENT` is a laundry lifecycle verb. Neither action records an invoice payment. `PROCESSING` remains reachable only from `PAID`."), the workspace bullet (the page has an invoice section and lifecycle actions), the action bullet (matrix ∩ fulfillment ∩ §4.4 role; only `cancel`, `reject`, `lost`, `damaged`, `refund` need a confirmation). **§8.2** (invoice generation, `UNPAID` at generation and no payment-recording mutation stay as Accepted). **§4.3 / §4.4** (matrix and roles). [Laundry Invoices](../specs/2026-09-06-laundry-invoices-design.md), Status **Accepted** (2026-09-06): **§4.3** (at most one invoice per order, enforced by `uq_invoice_laundry_order`; eligible statuses; generation does not depend on `PAID`), **§4.4** (`dueDate` = issue date for `PAY_NOW`, else `null`), **§2 out of scope** (payment recording and any change to `amountPaidMinorUnits` / `paymentStatus` after generation are #39; no void or regeneration operation). |
| Relies on (Accepted, merged) | [Laundry Order Page plan](2026-10-14-laundry-order-page-plan.md) (#156): the route, `OrderSection`, `resolvedInvoiceNodes`, `currentLaundryOrderSection`, `laundryLifecycleVerbs`, the render-test harness. [Laundry Price Review plan](2026-10-15-laundry-price-review-plan.md) (#162): the synchronous in-flight guard and refetch-on-both-paths pattern of `useConfirmLaundryPrice`, the jsdom page harness `laundry-order-page.interaction.test.tsx`. [Laundry UI foundation plan](2026-10-10-laundry-ui-foundation-plan.md): `laundryOrderActions`, the `success.*` / `failure.*` / `paymentTerms.*` / `invoicePaymentStatus.*` copy. |
| Authority | Where this plan and an Accepted spec disagree, the **spec wins** and this plan must be revised. Issue #166 refines §8.4.4 with layout, copy, behavior and test requirements. File names, helper names, copy keys and task order are planning decisions, not product semantics. |
| Spec amendment | **None needed.** Every behavior below is already allowed by the Accepted specs; the issue adds presentation only. No new mutation, field or rule. |
| Owner input | The owner chose to skip the brainstorm questions (2026-10-24) and asked that the plan rest on the ticket, code and Accepted specs only, separate recording payment, updating the invoice, and setting the paid status, and flag any business decision the evidence does not settle. See [Evidence: payment, invoice and paid status](#evidence-payment-invoice-and-paid-status) and [Open business decisions](#open-business-decisions-for-the-owner). |
| Planning decisions for M5 to confirm | See [Planning decisions](#planning-decisions-for-m5-to-confirm) (a)–(j). |
| Edit anchors | New files are described by their interfaces and tests. Edits to existing files are given against `main` at `9135546`. Apply each by the quoted code, not by line number. |
| Package names | `pnpm --filter web` is `apps/web`. `pnpm --filter @clensy/web` is `packages/web`. `pnpm --filter @clensy/client` is `packages/client`. |
| Pre-validation | **None.** No code in this plan was run before M5. Every `Expected:` line is a prediction until M6 records the actual result. |
| M7 | Application code changes. `CLAUDE.md` requires a **fresh independent reviewer** on the most capable model, given the Accepted specs, this plan once Accepted, and the branch diff. |

**Goal:** On `/app/laundry/<id>`, the Invoice section becomes "Invoice and payment": an Invoice card that generates an invoice with chosen terms or shows the existing one, and an Order payment card that offers the next order-level payment verb (Mark paid / Mark awaiting payment), with the two kept visibly separate.

**Architecture:**

- **Pure module (`apps/web/lib/laundry-invoice-payment.ts`):** `laundryInvoiceView` (which body the Invoice card shows) and `laundryPaymentView` (which verbs or sentence the Order payment card shows). They read only the resolved invoice result and `laundryOrderActions` verbs.
- **Tone map (`apps/web/lib/invoice-payment-status.ts`):** billing's existing `STATUS_TONE`, moved unchanged and imported by both the billing page and the order page (issue: "reuse it rather than inventing a second one").
- **Generate hook (`apps/web/lib/use-generate-laundry-invoice.ts`):** `generateInvoiceFromOrder` behind a synchronous ref guard; toast on success; alert on failure; refetches `InvoiceForOrder` on both paths.
- **Transition hook (`apps/web/lib/use-laundry-order-transition.ts`):** the page-level in-flight flag #165 will share. Runs `markLaundryOrderPaid` or `markLaundryOrderAwaitingPayment` behind one synchronous ref guard; toast on success; alert on failure; refetches the order on both paths.
- **Cards (`apps/web/components/laundry/laundry-invoice-payment.tsx`):** presentational `LaundryInvoiceCard` and `LaundryOrderPaymentCard`.
- **Page:** `LaundryOrderWorkspace` owns both hooks. The Invoice section renders both cards. `markPaid` and `markAwaitingPayment` move from the Actions text list into the Order payment card, and the nav marks the section that now holds them.

**Tech Stack:** React 19, Next.js 16, Apollo Client 3.14 (`@clensy/client` generated hooks), Tailwind 4, Vitest (node `renderToStaticMarkup`; jsdom with `createRoot` + `act`).

**Spec:** `docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md` §8.4.4, §8.2, §4.3, §4.4; `docs/superpowers/specs/2026-09-06-laundry-invoices-design.md` §2, §4.3, §4.4.

---

## Evidence: payment, invoice and paid status

The owner asked for these three to be kept apart. This is what the repository establishes, with the source for each line.

### Three separate things

| Concern | What exists today | Who may do it | This slice |
| --- | --- | --- | --- |
| **Recording a payment** (money received against an invoice: cash, card, partial) | **Nothing.** There is no `Payment` aggregate and no mutation that records money. Invoices spec §2 Out of scope: "Payment recording … and any mutation of `amountPaidMinorUnits` or `paymentStatus` after generation — #39." Lifecycle spec §8.2: "the absence of a payment-recording mutation" stays. | No one (#39 will define it). | **Not built.** No `recordPayment`, no amount input, no payment method. |
| **Updating the invoice's payment state** (`Invoice.paymentStatus`, `amountPaidMinorUnits`) | Written **once**, at generation: `paymentStatus: UNPAID`, `amountPaidMinorUnits: 0` (`invoices.service.ts` `generateFromOrder`; invoices spec §4.4 step 8). No code path changes them afterwards. `VOID` exists in the enum but no operation produces it (invoices spec §2). | No one after generation. | **Read only.** The card shows the stored `paymentStatus` as a badge. |
| **Setting the order's paid status** (`LaundryOrder.status` → `PAID` or `AWAITING_PAYMENT`) | Lifecycle verbs `markLaundryOrderPaid` (from `PRICED` or `AWAITING_PAYMENT`) and `markLaundryOrderAwaitingPayment` (from `PRICED`). Each is a plain `transitionVerb` with an audit event (`laundry-orders.service.ts` `markPaid`, `markAwaitingPayment`). Neither reads, creates or changes an invoice. | `PAYMENT` roles: TENANT_OWNER, OPS_MANAGER, FINANCE, CUSTOMER_SUPPORT (`laundry-order.resolver.ts` `@Roles(...PAYMENT)`; `laundry-order-actions.ts`). | **Built:** two buttons in the Order payment card. |

Generating an invoice is a fourth, separate action: `generateInvoiceFromOrder`, FINANCE and TENANT_OWNER only (`invoice.resolver.ts`), from `PRICED` through `COMPLETED`. It creates an `UNPAID` invoice and does not change the order's status.

### Ordering: what the evidence fixes, and what it does not

- **No ordering between invoicing and marking paid is enforced or specified.** `markPaid` has no invoice precondition (`laundry-orders.service.ts`). Generation is allowed both before and after `PAID` (invoices spec §4.3 Allowed list includes `PRICED`, `AWAITING_PAYMENT` and `PAID`), and "Generation does **not** depend on the operational meaning of `PAID`" (invoices spec §4.3 note). The lifecycle spec keeps `LaundryOrder` free of any coupling to `Invoice` (§1 thesis; §2 out of scope). So both sequences are legal:
  1. Generate invoice → mark paid (the invoice still reads Unpaid).
  2. Mark paid → generate invoice (the new invoice is created Unpaid).
- **The counter choice at `PRICED` is stated by the issue:** "Mark paid if the customer pays at the counter. Mark awaiting payment if they will pay later." That is the only documented guidance on when to use each verb, and this plan uses it as the help text. The issue gives no rule tying either verb to the invoice.
- **Processing waits for `PAID`** (§8.4.4, §4.3: `startLaundryProcessing` is legal only from `PAID`). That button belongs to #165; this slice shows "Paid. Processing can start." and nothing more.

This plan therefore enforces **no** sequence between the two cards. Each card's controls depend only on the order's status and the actor's role, exactly as the server does.

### Failure cases this plan handles

| # | Case | Server result | Page behavior | Test |
| --- | --- | --- | --- | --- |
| F1 | Generate succeeds | Invoice created `UNPAID` | Toast "Invoice generated."; refetch `InvoiceForOrder`; card shows number, amount, Unpaid, terms. Order status unchanged. | Task 3 hook cases 1–2; Task 5 interaction case 1 |
| F2 | Generate double click before re-render | — | One request (ref guard). | Task 3 hook case 3; Task 5 interaction case 2 |
| F3 | Generate fails: another user already generated (`ConflictException`), status changed to an ineligible one (`BadRequestException`), role lost, network | Error | Alert "Unable to generate invoice."; the invoice query is refetched anyway, so an invoice someone else created appears. | Task 3 hook cases 4–5; Task 5 interaction case 3 |
| F4 | Generate succeeds but the invoice refetch fails | Invoice exists | Invoice card shows "Unable to load invoice."; the rest of the page stays. Never "No invoice yet." | Task 3 hook case 6; Task 4 card case 2 |
| F5 | Mark paid / awaiting payment succeeds | Status `PAID` / `AWAITING_PAYMENT` | Toast; refetch the order; card moves to the next state. Invoice untouched and not refetched. | Task 3 hook cases 7–8; Task 5 interaction cases 4–5 |
| F6 | Two payment verbs, or one verb twice, before re-render | — | One request: both buttons share one ref guard and one `pending` flag. | Task 3 hook case 9; Task 5 interaction case 6 |
| F7 | Mark paid fails: the order already moved (another user marked it paid or cancelled it), role lost, network | Error | Alert "Unable to mark the order paid." (or "…awaiting payment."); the order is refetched, so the card shows the true status. | Task 3 hook case 10; Task 5 interaction case 7 |
| F8 | Mark paid succeeds but the order refetch fails | Status changed | The page's existing order error state ("Unable to load laundry order."), not a stale order with live buttons. | Task 3 hook case 11 |
| F9 | Order marked paid while its invoice reads Unpaid | Both true by design | The Order payment card says the two are separate: "The order must be marked paid before processing starts. That is separate from the invoice payment status." | Task 4 card case 6 |

## Open business decisions for the owner

The evidence does not settle these. The plan implements the Accepted behavior and does **not** assume an answer. M5 may confirm "proceed as planned", or return the plan.

1. **Should staff be steered to invoice before marking paid (or the reverse)?** The specs make the two independent and the issue's Mark paid rule has no invoice condition, so the plan shows both cards' controls independently. If the shop wants, for example, Mark paid hidden until an invoice exists, that is a new product rule and needs a spec amendment (M2/M3), not a plan change.
2. **Is an order marked Paid next to an invoice reading Unpaid acceptable until #39 lands?** It is what the Accepted specs produce (no operation updates `Invoice.paymentStatus`). The plan shows both facts with the issue's explanatory sentence. If the owner wants different wording or an extra note on the invoice card, that is copy only and can be changed in M5.
3. **Who records the money, and when, at the counter?** No artifact establishes it, and no feature in this slice records money. It is #39's question and is recorded here only so it is not mistaken for something this slice decides.

## Planning decisions for M5 to confirm

- **(a) Payment verbs move into the Invoice section.** `SECTION_VERBS` gains `markPaid` and `markAwaitingPayment`, so the Actions text list no longer names them (they are buttons in the Order payment card instead). `currentLaundryOrderSection` then marks `invoice` when either verb is offered, applying #156's existing rule ("the next step forward the actor may take") to where the verb now lives. Changed rows: `PRICED` as TENANT_OWNER with an invoice (or unresolved invoice) → `invoice` (was `actions`). Unchanged: `PAID` as SCHEDULER → `actions` (`startProcessing`).
- **(b) The section heading and nav label become "Invoice and payment".** Same key (`order.sections.invoice`), same id (`laundry-order-invoice`).
- **(c) Terms control is a native radio group** (`fieldset` + `legend` "Payment terms"), each option with its one-line help visible and linked by `aria-describedby`. The issue allows a select or a radio group; radios show all three meanings at once. Default `PAY_ON_COMPLETION`.
- **(d) Failure copy is fixed, not the server message.** The issue fixes "Unable to generate invoice."; the payment verbs use the existing `failure.markPaid` / `failure.markAwaitingPayment`. The refetch shows the true state, so a server message (for example "An invoice already exists for this laundry order") is not needed to recover. This differs from #162, which shows the server message.
- **(e) Two existing strings are reworded to the issue's text:** `failure.generateInvoice` "Unable to generate the invoice." → "Unable to generate invoice."; `order.invoice.error` "Unable to load the invoice." → "Unable to load invoice.". Neither is read anywhere else (`grep` on `main`: only the order page reads `order.invoice.error`; nothing reads `failure.generateInvoice`).
- **(f) Generate refetches the invoice on failure as well as success** (F3), as `useConfirmLaundryPrice` refetches the order on both paths.
- **(g) Generate and the payment verbs do not block each other.** The issue gives Generate its own `generating` flag and the payment verbs the shared lifecycle flag. The two server operations are independent (Evidence), so running one while the other is in flight cannot corrupt either.
- **(h) Unresolved-but-not-loading invoice results show nothing in the Invoice card,** as today (#156 M5 review 3 tests). Only `loading` shows `LoadingState`, only `error` shows the error sentence.
- **(i) `amountDueMinorUnits` is requested but not displayed.** The issue asks for it in the query and does not place it in the layout. It equals the total until #39.
- **(j) The Order payment card shows for every role,** with its explanation, and "Paid. Processing can start." on a `PAID` order. Only the buttons are role-gated (through `laundryOrderActions`), so SCHEDULER and ANALYST never see them.

## Global constraints

- SHALL NOT add or call any mutation other than `generateInvoiceFromOrder`, `markLaundryOrderPaid` and `markLaundryOrderAwaitingPayment` (issue; §8.2).
- SHALL NOT record a payment, accept an amount, or change `Invoice.paymentStatus` / `amountPaidMinorUnits` (invoices spec §2; #39).
- SHALL send `generateInvoiceFromOrder` exactly `{ input: { laundryOrderId, paymentTerms } }` and nothing else (issue Tests: "do not include a paid flag").
- SHALL NOT let the user type a due date; SHALL NOT edit terms after generation (issue; invoices spec §4.4).
- SHALL gate Generate on `laundryOrderActions(...)` including `generateInvoice` and a resolved empty invoice list, and the payment buttons on `markPaid` / `markAwaitingPayment` in the same verb list. No second role or status table in the page (§8.4.4 action bullet).
- SHALL keep the eligible statuses exactly `PRICED`, `AWAITING_PAYMENT`, `PAID`, `PROCESSING`, `READY`, `AWAITING_PICKUP`, `AWAITING_DELIVERY`, `COMPLETED` (unchanged `INVOICEABLE` in `laundry-order-actions.ts`).
- SHALL keep `resolvedInvoiceNodes` as the only source for "is there an invoice": loading, failed or incomplete results never show "No invoice yet." (issue comment).
- SHALL NOT show a confirm dialog for any verb in this slice (§8.4.4: not in the destructive set).
- SHALL NOT render a second invoice view: "Open invoice" links to `/app/billing?detail=<invoice id>`.
- SHALL NOT edit `apps/web/app/app/laundry/page.tsx`, `apps/api`, or `packages/ui`.
- Role names: the code uses `TENANT_OWNER`; there is no `OWNER` role.

Exact copy (issue):

| Key | Text |
| --- | --- |
| `order.sections.invoice` | Invoice and payment |
| `order.invoice.title` | Invoice |
| `order.invoice.terms` | Payment terms |
| `order.invoice.termsHelp.PAY_NOW` | Due when the invoice is issued. |
| `order.invoice.termsHelp.PAY_ON_COMPLETION` | Due when the work is complete. No due date is set yet. |
| `order.invoice.termsHelp.PAY_ON_DELIVERY` | Due when the laundry is delivered. No due date is set yet. |
| `order.invoice.generating` | Generating… |
| `order.invoice.open` | Open invoice |
| `order.invoice.error` | Unable to load invoice. |
| `order.invoice.none` | No invoice yet. (unchanged) |
| `failure.generateInvoice` | Unable to generate invoice. |
| `order.payment.title` | Order payment |
| `order.payment.explanation` | The order must be marked paid before processing starts. That is separate from the invoice payment status. |
| `order.payment.choose` | Mark paid if the customer pays at the counter. Mark awaiting payment if they will pay later. |
| `order.payment.paid` | Paid. Processing can start. |

Reused unchanged: `actions.generateInvoice`, `actions.markPaid`, `actions.markAwaitingPayment`, `success.generateInvoice`, `success.markPaid`, `success.markAwaitingPayment`, `failure.markPaid`, `failure.markAwaitingPayment`, `paymentTerms.*`, `invoicePaymentStatus.*`, `order.invoice.number`, `order.invoice.total`, `order.invoice.paymentStatus`. Add `order.invoice.termsLabel` only if the implementer needs a separate key for the existing-invoice `dt`; otherwise reuse `order.invoice.terms`.

## Review focus

Input classes the issue implies but does not spell out, most likely first. Each names the test that pins it.

1. **Another user acts first.** A second staff member generates the invoice or marks the order paid while this page is open. The mutation fails, the alert shows, and the refetch shows the real invoice or status with no dead button (F3, F7: Task 3 hook cases 4 and 10; Task 5 interaction cases 3 and 7).
2. **A click on Mark paid and Mark awaiting payment in the same tick.** One request only (F6: Task 3 hook case 9; Task 5 interaction case 6).
3. **The invoice query fails after a successful generate.** "Unable to load invoice.", never "No invoice yet.", and the order page stays (F4: Task 3 hook case 6; Task 4 card case 2).
4. **An order marked paid whose invoice reads Unpaid.** Both shown, with the explanation (F9: Task 4 card case 6).
5. **The role still loading.** No Generate, no payment buttons, and no "Paid. Processing can start." withheld wrongly: the sentence depends on status only (Task 2 view cases; Task 5 render case 8).

## File map

| File | Change | Responsibility |
|---|---|---|
| `packages/client/src/operations/billing.graphql` | Modify | `InvoiceForOrder` adds `paymentTerms`, `amountDueMinorUnits` |
| `packages/client/src/generated/graphql.ts` | Regenerate | `pnpm --filter @clensy/client codegen` |
| `packages/client/src/laundry-operations.test.ts` | Modify | `InvoiceForOrder` selection |
| `apps/web/lib/invoice-payment-status.ts` | Create | `INVOICE_PAYMENT_STATUS_TONE` (moved from billing) |
| `apps/web/app/app/billing/page.tsx` | Modify | Import the moved map; delete the local `STATUS_TONE` |
| `apps/web/lib/laundry-invoice-payment.ts` | Create | `laundryInvoiceView`, `laundryPaymentView` |
| `apps/web/lib/laundry-invoice-payment.test.ts` | Create | View tables, tone map |
| `apps/web/lib/laundry-order-page.ts` | Modify | `SECTION_VERBS`, `currentLaundryOrderSection` (decision a) |
| `apps/web/lib/laundry-order-page.test.ts` | Modify | Changed rows |
| `apps/web/lib/use-generate-laundry-invoice.ts` | Create | `useGenerateLaundryInvoice` |
| `apps/web/lib/use-generate-laundry-invoice.hook.test.tsx` | Create | Guard, success, failure, refetch |
| `apps/web/lib/use-laundry-order-transition.ts` | Create | `useLaundryOrderTransition` (the shared flag) |
| `apps/web/lib/use-laundry-order-transition.hook.test.tsx` | Create | Guard, success, failure, refetch |
| `apps/web/components/laundry/laundry-invoice-payment.tsx` | Create | `LaundryInvoiceCard`, `LaundryOrderPaymentCard` |
| `apps/web/lib/laundry-invoice-payment.render.test.tsx` | Create | Static markup per state |
| `apps/web/app/app/laundry/[id]/page.tsx` | Modify | Wire hooks and cards |
| `apps/web/lib/laundry-order-page.render.test.tsx` | Modify | Mocks, role matrix, changed assertions |
| `apps/web/lib/laundry-order-page.interaction.test.tsx` | Modify | Mocks; generate and payment flows |
| `packages/web/src/i18n/messages/en/laundry.ts` | Modify | Copy above |
| `docs/superpowers/plans/2026-10-24-laundry-invoice-payment-plan.md` | Modify (M6+) | Execution record |

M9 (not a task here) updates `apps/web/README.md` § "Laundry order page" lines that say Invoice is read-only and that #166 replaces it, and its "Current section" line.

---

### Task 1: `InvoiceForOrder` requests terms and amount due

**Type:** `code`. **Traces to:** issue "Extend that operation…"; invoices spec §4.3 (one invoice per order, so no sort is needed — this also answers the #156 review comment on the issue: `uq_invoice_laundry_order` makes a second invoice impossible, and no void/regenerate operation exists).

**Files:**
- Modify: `packages/client/src/operations/billing.graphql` (`query InvoiceForOrder` node selection)
- Regenerate: `packages/client/src/generated/graphql.ts`
- Test: `packages/client/src/laundry-operations.test.ts`

**Interfaces:**
- Produces: `InvoiceForOrderQuery['invoices']['nodes'][number]` with `id`, `invoiceNumber`, `totalMinorUnits`, `amountDueMinorUnits: number`, `paymentStatus: InvoicePaymentStatus`, `paymentTerms: InvoicePaymentTerms`.

- [ ] **Step 1: Write the failing test** in `laundry-operations.test.ts` (import `InvoiceForOrderDocument`):

```ts
// #166: the order page's Invoice card shows terms; one invoice per order
// (uq_invoice_laundry_order), so the query needs no sort.
it('requests the invoice card fields for the order invoice', () => {
  expect(selectionsUnder(InvoiceForOrderDocument, 'nodes')).toEqual([
    ['id', 'invoiceNumber', 'totalMinorUnits', 'amountDueMinorUnits', 'paymentStatus', 'paymentTerms'],
  ]);
});
```

- [ ] **Step 2: Run it.** `pnpm --filter @clensy/client exec vitest run src/laundry-operations.test.ts` — Expected: FAIL (the selection lacks `amountDueMinorUnits` and `paymentTerms`).
- [ ] **Step 3: Edit the operation** to select, in this order, `id invoiceNumber totalMinorUnits amountDueMinorUnits paymentStatus paymentTerms`. Keep the existing comment. Run `pnpm --filter @clensy/client codegen`.
- [ ] **Step 4: Run it again.** Same command — Expected: PASS. Then `pnpm --filter @clensy/client build` — Expected: exit 0.
- [ ] **Step 5: Commit.** `git add packages/client && git commit -m "feat(166): request invoice terms and amount due for the order page"`

---

### Task 2: Pure views, shared tone map, and section ownership

**Type:** `code`. **Traces to:** issue Layout and States; §8.4.4 action bullet; decision (a), (h), (j).

**Files:**
- Create: `apps/web/lib/invoice-payment-status.ts`, `apps/web/lib/laundry-invoice-payment.ts`, `apps/web/lib/laundry-invoice-payment.test.ts`
- Modify: `apps/web/app/app/billing/page.tsx` (replace the local `const STATUS_TONE …` block with an import; both uses keep the name via `INVOICE_PAYMENT_STATUS_TONE`), `apps/web/lib/laundry-order-page.ts`, `apps/web/lib/laundry-order-page.test.ts`

**Interfaces:**
- Produces:
  - `INVOICE_PAYMENT_STATUS_TONE: Readonly<Record<InvoicePaymentStatus, StatusTone>>` = `{ PAID: 'success', PARTIALLY_PAID: 'warning', UNPAID: 'neutral', VOID: 'danger' }`.
  - `type LaundryInvoiceView = 'error' | 'loading' | 'unresolved' | 'generate' | 'none' | 'invoice'`
  - `laundryInvoiceView(input: { error: boolean; loading: boolean; invoices: readonly unknown[] | undefined; verbs: readonly LaundryOrderVerb[] }): LaundryInvoiceView` — precedence: `error` → `'error'`; `loading` → `'loading'`; `invoices === undefined` → `'unresolved'`; `invoices.length > 0` → `'invoice'`; `verbs.includes('generateInvoice')` → `'generate'`; else `'none'`.
  - `type LaundryPaymentView = 'choose' | 'markPaid' | 'paid' | 'none'`
  - `laundryPaymentView(status: LaundryOrderStatus, verbs: readonly LaundryOrderVerb[]): LaundryPaymentView` — both `markPaid` and `markAwaitingPayment` in `verbs` → `'choose'`; `markPaid` only → `'markPaid'`; `status === 'PAID'` → `'paid'`; else `'none'`.
  - `laundryLifecycleVerbs` now also drops `markPaid` and `markAwaitingPayment`.
  - `currentLaundryOrderSection`: after the `generateInvoice` line, `if (verbs.includes('markPaid') || verbs.includes('markAwaitingPayment')) return 'invoice';` and update its comment.

- [ ] **Step 1: Write the failing tests** in `laundry-invoice-payment.test.ts`, building `verbs` with `laundryOrderActions(status, 'PICKUP', role)`:

```ts
it('keeps billing tones', () => {
  expect(INVOICE_PAYMENT_STATUS_TONE).toEqual({ PAID: 'success', PARTIALLY_PAID: 'warning', UNPAID: 'neutral', VOID: 'danger' });
});

it.each([
  // [label, error, loading, invoices, status, role, expected]
  ['error wins over retained data', true, false, [], 'PRICED', 'FINANCE', 'error'],
  ['loading', false, true, undefined, 'PRICED', 'FINANCE', 'loading'],
  ['incomplete result', false, false, undefined, 'PRICED', 'FINANCE', 'unresolved'],
  ['existing invoice', false, false, [{ id: 'i1' }], 'PRICED', 'FINANCE', 'invoice'],
  ['FINANCE on PRICED', false, false, [], 'PRICED', 'FINANCE', 'generate'],
  ['TENANT_OWNER on COMPLETED', false, false, [], 'COMPLETED', 'TENANT_OWNER', 'generate'],
  ['OPS_MANAGER on PRICED', false, false, [], 'PRICED', 'OPS_MANAGER', 'none'],
  ['SCHEDULER on PRICED', false, false, [], 'PRICED', 'SCHEDULER', 'none'],
  ['FINANCE on RECEIVED', false, false, [], 'RECEIVED', 'FINANCE', 'none'],
  ['FINANCE on WEIGHED', false, false, [], 'WEIGHED', 'FINANCE', 'none'],
  ['FINANCE on CANCELLED', false, false, [], 'CANCELLED', 'FINANCE', 'none'],
  ['role loading', false, false, [], 'PRICED', undefined, 'none'],
])('laundryInvoiceView: %s', …);

it.each([
  ['PRICED', 'OPS_MANAGER', 'choose'],
  ['PRICED', 'FINANCE', 'choose'],
  ['PRICED', 'CUSTOMER_SUPPORT', 'choose'],
  ['AWAITING_PAYMENT', 'TENANT_OWNER', 'markPaid'],
  ['PRICED', 'SCHEDULER', 'none'],
  ['PRICED', 'ANALYST', 'none'],
  ['AWAITING_PAYMENT', 'SCHEDULER', 'none'],
  ['PAID', 'FINANCE', 'paid'],
  ['PAID', 'ANALYST', 'paid'],
  ['PAID', undefined, 'paid'],
  ['RECEIVED', 'OPS_MANAGER', 'none'],
  ['PROCESSING', 'OPS_MANAGER', 'none'],
])('laundryPaymentView: %s as %s → %s', …);
```

In `laundry-order-page.test.ts`, change rows `['PRICED', 'TENANT_OWNER', true, 'actions']` and `['PRICED', 'TENANT_OWNER', undefined, 'actions']` to `'invoice'`; add `['AWAITING_PAYMENT', 'CUSTOMER_SUPPORT', true, 'invoice']` and `['PRICED', 'OPS_MANAGER', true, 'invoice']`; keep `['PAID', 'SCHEDULER', true, 'actions']`. Change the `laundryLifecycleVerbs` test to expect `['weigh','price','generateInvoice','markPaid','markAwaitingPayment','cancel']` → `['cancel']`, and rename it "drops the verbs that the weighing, services and invoice and payment sections own".

- [ ] **Step 2: Run.** `pnpm --filter web exec vitest run lib/laundry-invoice-payment.test.ts lib/laundry-order-page.test.ts` — Expected: FAIL (modules missing; changed rows).
- [ ] **Step 3: Implement** the two modules and the `laundry-order-page.ts` changes. Update the comment on `SECTION_VERBS` ("Verbs that the Weighing, Services and Invoice and payment sections own") and on `currentLaundryOrderSection`. Edit the billing page import.
- [ ] **Step 4: Run.** Same command — Expected: PASS. Then `pnpm --filter web exec tsc --noEmit` — Expected: exit 0 except errors in `laundry-order-page.render.test.tsx` that Task 5 fixes, if any; record them.
- [ ] **Step 5: Commit.** `git commit -m "feat(166): invoice and payment views; payment verbs move to the invoice section"`

---

### Task 3: Generate and transition hooks

**Type:** `code`. **Traces to:** issue Submit; §8.4.4; Evidence F1–F8; decisions (d), (f), (g). Follow `use-confirm-laundry-price.ts` and its test harness `use-confirm-laundry-price.hook.test.tsx` (Probe component, deferred promises, `ToastProvider`).

**Files:**
- Create: `apps/web/lib/use-generate-laundry-invoice.ts`, `apps/web/lib/use-generate-laundry-invoice.hook.test.tsx`, `apps/web/lib/use-laundry-order-transition.ts`, `apps/web/lib/use-laundry-order-transition.hook.test.tsx`
- Modify: `packages/web/src/i18n/messages/en/laundry.ts` (`failure.generateInvoice` only; the rest in Task 4)

**Interfaces:**
- Produces:

```ts
import type { InvoicePaymentTerms } from '@clensy/client'; // 'PAY_NOW' | 'PAY_ON_COMPLETION' | 'PAY_ON_DELIVERY'
export interface GenerateLaundryInvoiceState {
  generate: (paymentTerms: InvoicePaymentTerms) => Promise<void>;
  generating: boolean;   // true through the mutation and the refetch
  failed: boolean;       // cleared when the next generate starts
}
export function useGenerateLaundryInvoice(options: { orderId: string; refetch: () => Promise<unknown> }): GenerateLaundryInvoiceState;

export type LaundryPaymentVerb = 'markAwaitingPayment' | 'markPaid';
export interface LaundryOrderTransitionState {
  run: (verb: LaundryPaymentVerb) => Promise<void>;
  pending: boolean;                    // the page-level flag #165 will share
  failure: LaundryPaymentVerb | null;  // the verb that last failed; cleared when the next run starts
}
export function useLaundryOrderTransition(options: { orderId: string; refetch: () => Promise<unknown> }): LaundryOrderTransitionState;
```

`LaundryPaymentVerb` is the set this slice wires. #165 widens it and adds its mutations; the guard and `pending` stay one per page. Both hooks treat a resolved result with `errors` or without the mutation field as a failure, as `useConfirmLaundryPrice` does. A refetch that throws is swallowed (Apollo puts the query in error and the page shows its error state).

- [ ] **Step 1: Write the failing tests.** Mock `useGenerateInvoiceFromOrderMutation`, `useMarkLaundryOrderPaidMutation`, `useMarkLaundryOrderAwaitingPaymentMutation` and `usePriceLaundryOrderMutation`; render inside `ToastProvider` and assert toast text on `document.body.textContent`, as the confirm hook test does.

Generate hook (`ORDER = '00000000-0000-4000-8000-000000000001'`):
1. `sends exactly the order id and terms`: `generate('PAY_NOW')` → mutation called once with `{ variables: { input: { laundryOrderId: ORDER, paymentTerms: 'PAY_NOW' } } }` (`toEqual`, so no extra key such as a paid flag); no `markPaid` / `markAwaitingPayment` mock called.
2. `toasts and refetches on success, keeping generating true until the refetch settles`: resolve with `{ data: { generateInvoiceFromOrder: { id: 'i1' } } }` → `generating` still `true` while the refetch is pending; toast text "Invoice generated."; then `generating` `false`, `failed` `false`.
3. `drops a second generate while one is in flight`: two `generate` calls in one `act` → one mutation call.
4. `fails on a rejected mutation and still refetches`: reject → `failed` `true`, refetch called once, no success toast.
5. `fails on a resolved result with errors or no invoice`: `{ errors: [{ message: 'x' }] }` and `{ data: {} }` → `failed` `true`.
6. `survives a failed refetch`: refetch rejects after success → no throw; `generating` `false`.

Transition hook:
7. `marks paid with the order id`: `run('markPaid')` → paid mutation `{ variables: { input: { orderId: ORDER } } }`; toast "Order marked paid."; order refetch called; generate mutation not called.
8. `marks awaiting payment`: same for `markAwaitingPayment`, toast "Order marked awaiting payment.".
9. `one flag for both verbs`: `run('markPaid')` then `run('markAwaitingPayment')` in one `act` → one mutation call in total; `pending` `true` until the refetch settles.
10. `failure names the verb and refetches`: reject paid → `failure === 'markPaid'`, refetch called; next `run` clears it.
11. `survives a failed refetch`: refetch rejects → no throw; `pending` `false`.

- [ ] **Step 2: Run.** `pnpm --filter web exec vitest run lib/use-generate-laundry-invoice.hook.test.tsx lib/use-laundry-order-transition.hook.test.tsx` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** both hooks (`'use client'`; `useRef` guard taken synchronously; `useState` for the flags; `useToast().success(t('success.<verb>'))`). Change `failure.generateInvoice` to "Unable to generate invoice.".
- [ ] **Step 4: Run.** Same command — Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(166): generate-invoice and order payment transition hooks"`

---

### Task 4: Invoice and Order payment cards

**Type:** `code`. **Traces to:** issue Layout, States; decisions (c), (h), (i), (j).

**Files:**
- Create: `apps/web/components/laundry/laundry-invoice-payment.tsx`, `apps/web/lib/laundry-invoice-payment.render.test.tsx`
- Modify: `packages/web/src/i18n/messages/en/laundry.ts` (all remaining keys in [Global constraints](#global-constraints))

**Interfaces:**
- Consumes: `LaundryInvoiceView`, `LaundryPaymentView`, `INVOICE_PAYMENT_STATUS_TONE` (Task 2); `GenerateLaundryInvoiceState`, `LaundryOrderTransitionState` field types (Task 3).
- Produces:

```ts
export function LaundryInvoiceCard(props: {
  view: LaundryInvoiceView;
  invoice: InvoiceForOrderQuery['invoices']['nodes'][number] | undefined; // set when view === 'invoice'
  generating: boolean;
  failed: boolean;
  onGenerate: (paymentTerms: InvoicePaymentTerms) => void;
}): JSX.Element;

export function LaundryOrderPaymentCard(props: {
  view: LaundryPaymentView;
  pending: boolean;
  failure: LaundryPaymentVerb | null;
  onRun: (verb: LaundryPaymentVerb) => void;
}): JSX.Element;
```

Markup: each card is `<div className="rounded-md border border-slate-200 p-4">` with an `h3` (`order.invoice.title` / `order.payment.title`). `LaundryInvoiceCard` keeps the selected terms in local state, default `PAY_ON_COMPLETION`, and passes it to `onGenerate`. Radio `name="laundry-invoice-terms"`, ids `laundry-invoice-terms-<TERM>`, help ids `laundry-invoice-terms-<TERM>-help`. The Generate `Button` is the default variant, `disabled={generating}`, label `order.invoice.generating` while generating. Mark paid is the default variant; Mark awaiting payment is `variant="secondary"`, placed after it; both `disabled={pending}`. Failures render `<p role="alert" className="text-red-600">`. The existing-invoice body is a `dl` (number, total via `formatMinorUnits`, payment status as `StatusBadge` with `label={t(`invoicePaymentStatus.${s}`)}` and the shared tone, terms as `t(`paymentTerms.${terms}`)`) and a `Link` to ``/app/billing?detail=${encodeURIComponent(invoice.id)}``.

- [ ] **Step 1: Write the failing render tests** (`renderToStaticMarkup` inside `ToastProvider`):
1. `loading shows LoadingState only`: `view: 'loading'` → contains `role="status"`; no "No invoice yet.", no `<button`.
2. `error says it cannot load`: "Unable to load invoice."; no "No invoice yet.".
3. `unresolved shows no body`: neither sentence, no `<button`, no `role="status"`.
4. `generate shows the three terms in human language with help, Pay on completion checked`: contains "Payment terms" in a `<legend`; "Pay now", "Pay on completion", "Pay on delivery"; the three help sentences exactly; `value="PAY_ON_COMPLETION"` input carries `checked`; no `PAY_NOW<`/`>PAY_ON` raw enum text; no `type="date"`; a `<button` "Generate invoice"; with `generating: true` the button is `disabled` and reads "Generating…"; with `failed: true` a `role="alert"` "Unable to generate invoice.".
5. `existing invoice shows number, amount, badge, terms and the billing link`: invoice `{ id: 'i1', invoiceNumber: 'INV-2026-000001', totalMinorUnits: 45000, amountDueMinorUnits: 45000, paymentStatus: 'UNPAID', paymentTerms: 'PAY_ON_DELIVERY' }` → "INV-2026-000001", "₱450.00", "Unpaid", "Pay on delivery", `href="/app/billing?detail=i1"`, "Open invoice"; no `<button`, no `<input`; no "Amount due".
6. `payment card explains the separation`: every view contains the `order.payment.explanation` text and "Order payment".
7. `choose`: "Mark paid" button before "Mark awaiting payment" button; the second has `data-variant="secondary"`, the first does not; the help sentence `order.payment.choose`; `pending: true` disables both; `failure: 'markAwaitingPayment'` → `role="alert"` "Unable to mark the order awaiting payment.".
8. `markPaid`: one button "Mark paid"; no "Mark awaiting payment"; no `order.payment.choose` sentence.
9. `paid`: "Paid. Processing can start."; no `<button`.
10. `none`: no `<button`, no "Paid. Processing can start.".
11. `no estimate wording`: no card contains "Estimate".

- [ ] **Step 2: Run.** `pnpm --filter web exec vitest run lib/laundry-invoice-payment.render.test.tsx` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the component file and the copy.
- [ ] **Step 4: Run.** Same command — Expected: PASS. Then `pnpm --filter @clensy/web test && pnpm --filter @clensy/web build` — Expected: pass (catches a copy-shape test in `packages/web`, if any).
- [ ] **Step 5: Commit.** `git commit -m "feat(166): invoice and order payment cards"`

---

### Task 5: Order page wiring

**Type:** `code`. **Traces to:** issue Layout, Submit, States, Acceptance criteria, Tests; §8.4.4.

**Files:**
- Modify: `apps/web/app/app/laundry/[id]/page.tsx`, `apps/web/lib/laundry-order-page.render.test.tsx`, `apps/web/lib/laundry-order-page.interaction.test.tsx`

**Interfaces:**
- Consumes: Tasks 2–4.
- Changes in `LaundryOrderWorkspace`:
  - `const generateInvoice = useGenerateLaundryInvoice({ orderId: id, refetch: () => invoiceQuery.refetch() });`
  - `const transition = useLaundryOrderTransition({ orderId: id, refetch: () => orderQuery.refetch() });` declared beside `confirmPrice`, with a comment that #165's Actions buttons use this same `transition.pending`.
  - Replace `InvoiceBody` with `InvoicePaymentBody`, rendering `<div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-4">` holding `LaundryInvoiceCard` (view from `laundryInvoiceView({ error: Boolean(invoiceQuery.error), loading: invoiceQuery.loading, invoices, verbs })`, `invoice={invoices?.[0]}`) and `LaundryOrderPaymentCard` (view from `laundryPaymentView(order.status, verbs)`).
  - Update the file's top comment: Invoice (#166) has controls; Actions (#165) still names verbs as text.
  - Remove the now-unused `Invoice` type alias if nothing else reads it.

- [ ] **Step 1: Update the render harness and write the failing render tests.** The render harness's `vi.mock('@clensy/client', …)` does not spread the original module, so add `useGenerateInvoiceFromOrderMutation`, `useMarkLaundryOrderPaidMutation`, `useMarkLaundryOrderAwaitingPaymentMutation` (each `() => [vi.fn(), { loading: false }]`) and a `refetch: () => Promise.resolve()` on the `useInvoiceForOrderQuery` result. Update existing tests:
  - "renders the header, back link, … no controls in the read-only sections": drop `section(html, 'invoice')` from the read-only list (it now holds controls); keep header, Overview and Actions.
  - "renders the section nav and six sections in order": the heading list reads "Invoice and payment".
  - "names the role-allowed lifecycle actions as text in Actions" (PRICED, TENANT_OWNER): Actions contains "Cancel order" and **not** "Mark paid" / "Mark awaiting payment".
  - The current-section table row `['PRICED', 'TENANT_OWNER', 'invoice']` stays; it now passes for both reasons.
  - Every "Unable to load the invoice." → "Unable to load invoice.".
  - "ignores retained invoice data while the invoice query reloads": additionally expects `role="status"` inside the Invoice section.

New render cases (issue Tests):
  1. `FINANCE sees Generate invoice on PRICED`: status `PRICED`, role `FINANCE`, `invoiceNodes = []` → Invoice section contains `<button` "Generate invoice" and "Pay on completion".
  2. `SCHEDULER sees neither Generate nor payment buttons on PRICED` → no "Generate invoice", no "Mark paid" button text in the Invoice section; contains "No invoice yet.".
  3. `OPS_MANAGER sees Mark paid and not Generate on PRICED` → "Mark paid" and "Mark awaiting payment" buttons; no "Generate invoice".
  4. `RECEIVED offers neither generate nor mark paid` (role `TENANT_OWNER`) → no `<button` in the Invoice section.
  5. `existing invoice shows number, formatted amount, terms and the billing href`: `invoiceNodes = [{ id: 'i1', invoiceNumber: 'INV-0001', totalMinorUnits: 45000, amountDueMinorUnits: 45000, paymentStatus: 'UNPAID', paymentTerms: 'PAY_NOW' }]` → "INV-0001", "₱450.00", "Unpaid", "Pay now", `href="/app/billing?detail=i1"`; no "Generate invoice".
  6. `AWAITING_PAYMENT offers Mark paid only` (role `CUSTOMER_SUPPORT`).
  7. `PAID says processing can start, with no payment button` (role `OPS_MANAGER`).
  8. `role loading offers no buttons in the Invoice section` (`page.role = undefined`, PRICED).
  9. `the estimate is not on the invoice card`: PRICED → Invoice section has no "Estimate".

- [ ] **Step 2: Update the interaction harness and write the failing interaction cases.** Add `useMarkLaundryOrderAwaitingPaymentMutation: () => [page.awaiting, { loading: false }]`; make `useInvoiceForOrderQuery` return `page.invoiceNodes` with `refetch: page.invoiceRefetch`; reset both in `beforeEach`. Cases (status `PRICED`, role `TENANT_OWNER` unless stated):
  1. `generate sends the chosen terms and laundry order id only, toasts, and refetches the invoice`: click the "Pay now" radio, click "Generate invoice" → `page.invoice` called once with `{ variables: { input: { laundryOrderId: ID, paymentTerms: 'PAY_NOW' } } }` (`toEqual`); toast "Invoice generated."; `page.invoiceRefetch` called; `page.paid` and `page.awaiting` not called; the order refetch not called (generation does not change status).
  2. `a double click on Generate sends one request`.
  3. `a failed generate alerts and refetches the invoice`.
  4. `Mark paid sends the order id, toasts, and refetches the order`: → `page.paid` `{ variables: { input: { orderId: ID } } }`; "Order marked paid."; `page.invoice` not called; `page.invoiceRefetch` not called.
  5. `Mark awaiting payment` → `page.awaiting`, "Order marked awaiting payment.".
  6. `while one payment verb runs, both buttons are disabled and a second click sends nothing`: keep `page.paid` pending; click "Mark paid", then "Mark awaiting payment" → one call total; both buttons `disabled`.
  7. `a failed Mark paid alerts and refetches the order`.

- [ ] **Step 3: Run.** `pnpm --filter web exec vitest run lib/laundry-order-page.render.test.tsx lib/laundry-order-page.interaction.test.tsx` — Expected: FAIL (the page still renders `InvoiceBody`).
- [ ] **Step 4: Implement** the page changes.
- [ ] **Step 5: Run.** Same command, then `pnpm --filter web test` — Expected: PASS. Note: [#205](https://github.com/rexescario-dev/clensy-platform/issues/205) records intermittent jsdom timeouts in this suite; if one occurs, record the failing test and the re-run result, do not raise the timeout in this slice.
- [ ] **Step 6: Commit.** `git commit -m "feat(166): invoice and payment section on the order page"`

---

### Task 6: Verification and browser check

**Type:** `code` (verification only). No new behavior; this task records evidence for M6.

- [ ] **Step 1: Run the full checks** and record the **actual** result (pass/fail, counts, exit code) in the Execution record:
  - `pnpm --filter web test`
  - `pnpm --filter web lint`
  - `pnpm --filter web exec tsc --noEmit`
  - `pnpm --filter @clensy/web test`
  - `pnpm --filter @clensy/web lint`
  - `pnpm --filter @clensy/web build`
  - `pnpm --filter @clensy/client test`
  - `pnpm --filter @clensy/client build`
  - `pnpm --filter @clensy/client lint`

  Expected: all pass. A failure is fixed in the task that owns the code, re-run, and recorded with both results.
- [ ] **Step 2: Confirm the unchanged paths.** `git diff --stat main...HEAD -- apps/api packages/ui 'apps/web/app/app/laundry/page.tsx'` — Expected: empty. API suites are recorded **NOT RUN** (no API change) and not claimed as covered. Also `grep -rn "recordPayment\|amountPaidMinorUnits" apps/web/app apps/web/components apps/web/lib --include=*.ts --include=*.tsx` — Expected: no new hits in files this slice created or changed.
- [ ] **Step 3: Browser check** with the dev stack and seeded data, at 1280 px and 375 px:
  - as FINANCE on a `PRICED` order with no invoice: the three terms and help, Generate, the toast, then number, amount, Unpaid badge and terms; the order status badge is still "Priced"; "Open invoice" opens the billing drawer for that invoice;
  - as OPS_MANAGER on the same order: no Generate; Mark paid (primary) and Mark awaiting payment (secondary); Mark paid toasts and the card reads "Paid. Processing can start."; the invoice still reads Unpaid;
  - as SCHEDULER: no payment or generate buttons;
  - at 375 px the cards stack with no horizontal scroll; at 1280 px they sit side by side.

  Record each check separately. A state the seed data cannot produce is recorded **not run** with the reason.
- [ ] **Step 4: Commit the Execution record.** `git commit -m "docs(166): record the M6 verification"`

---

## Traceability

| Requirement | Source | Task |
| --- | --- | --- |
| Query adds terms, amount due; no sort; at most one invoice | Issue; invoices spec §4.3 | 1 |
| Generate only for FINANCE / TENANT_OWNER in eligible statuses | Issue; invoices spec §4.3; `laundryOrderActions` | 2, 4, 5 |
| Terms in human language with help; default Pay on completion; no due-date input | Issue; invoices spec §4.4 | 4 |
| Generate creates Unpaid and does not change order status | §8.4.4; invoices spec §4.4 | 3, 5 |
| Existing invoice: number, amount, badge (billing tones), terms, billing link | Issue | 2, 4, 5 |
| Mark paid / awaiting payment for PAYMENT roles from PRICED / AWAITING_PAYMENT only | §4.3, §4.4, §8.4.4; issue | 2, 4, 5 |
| One in-flight flag for lifecycle verbs, shareable with #165 | Issue Submit | 3, 5 |
| No confirm dialog for these verbs | §8.4.4 action bullet | 4 |
| Loading / error / empty states; resolved-result rule kept | Issue States; issue comment | 2, 4, 5 |
| No payment recording, no invoice payment-state change | §8.2; invoices spec §2; #39 | Global constraints; 6 Step 2 |
| Estimate UI not on the card | Issue Acceptance | 4, 5 |

## Execution record

*(Appended at M6.)*
