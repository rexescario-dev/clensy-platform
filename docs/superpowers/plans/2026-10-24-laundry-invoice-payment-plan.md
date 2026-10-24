# Laundry Invoice and Payment Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Accepted (revision 3)** at M5, 2026-10-24. Revision 1 was returned by the M4 review for four corrections ([Revision 2 changes](#revision-2-changes)). The M5 review of revision 2 accepted the direction and asked for three focused corrections ([Revision 3 changes](#revision-3-changes)). The owner authorized M6 on 2026-10-24 and it is recorded in the [Execution record](#execution-record). The independent M7 review **returned** the slice on verification grounds only (no code defect); see [M7 round 1](#m7-round-1--returned-for-revision-2026-10-24). |
| M5 decision | **Accepted** — 2026-10-24, revision 3, by the owner. The owner kept decision (k)'s rule for later statuses unchanged: a failed payment alert is hidden only when the refetched status confirms the intended outcome (`markPaid` → `PAID`; `markAwaitingPayment` → `AWAITING_PAYMENT` or `PAID`). `PROCESSING` and any other status that does not meet those conditions keep the alert, "conservative and avoids silently treating an ambiguous outcome as success". The owner confirmed the revision 3 corrections: the F9 cancelled-order failure stays visible with no button left; the Apollo recovery wording separates what the plan relies on from what the helper-based tests prove; and the payment-recording check reads added diff lines only, with generated client code excluded.<br>The acceptance covers the plan, not an implementation. The M5 review was a self-review by the plan's author, and no command in this plan has been run. Every `Expected:` line is still a prediction until M6 records the actual result. M7 remains a fresh independent review of the branch diff against the Accepted specs and this plan (`CLAUDE.md`). The three [open business decisions](#open-business-decisions-for-the-owner) stay open; acceptance does not answer them. |
| Date | 2026-10-24 |
| Tracking issue | [#166](https://github.com/rexescario-dev/clensy-platform/issues/166) "Laundry invoice and payment experience". Epic [#154](https://github.com/rexescario-dev/clensy-platform/issues/154). Depends on [#156](https://github.com/rexescario-dev/clensy-platform/issues/156) (merged in #183: the order page). Shares the in-flight guard with [#165](https://github.com/rexescario-dev/clensy-platform/issues/165) (open, not started: no branch or PR), so this slice introduces the page-level guard and #165 reuses it ([contract](#shared-in-flight-guard-contract)). |
| Branch | `feat/166-laundry-invoice-payment`, from `main` at `9135546`. One PR for this plan, its M5 record and the implementation. |
| Scope | `packages/client`: one operation document (`InvoiceForOrder`) and its regenerated output, plus a client test. `apps/web`: a new pure module, two new hooks, a new presentational component file, the shared invoice payment-status tone map (moved out of the billing page), the order page, and tests. `packages/web`: `laundry` copy. **No** API, schema, migration, resolver, GraphQL type, `@clensy/ui` or dependency change. The list page and the drawer (`apps/web/app/app/laundry/page.tsx`) are not edited. |
| Implements (Accepted) | [Laundry Orders & Lifecycle](../specs/2026-09-06-laundry-orders-lifecycle-design.md), Status **Accepted** (2026-09-06), with **Amendment #164**, Accepted 2026-10-10. Governing text: **§8.4.4**, invoice bullet ("Invoice generation stays the Accepted `generateInvoiceFromOrder` rules. Marking the order `PAID` or `AWAITING_PAYMENT` is a laundry lifecycle verb. Neither action records an invoice payment. `PROCESSING` remains reachable only from `PAID`."), the workspace bullet (the page has an invoice section and lifecycle actions), the action bullet (matrix ∩ fulfillment ∩ §4.4 role; only `cancel`, `reject`, `lost`, `damaged`, `refund` need a confirmation). **§8.2** (invoice generation, `UNPAID` at generation and no payment-recording mutation stay as Accepted). **§4.3 / §4.4** (matrix and roles). [Laundry Invoices](../specs/2026-09-06-laundry-invoices-design.md), Status **Accepted** (2026-09-06): **§4.3** (at most one invoice per order, enforced by `uq_invoice_laundry_order`; eligible statuses; generation does not depend on `PAID`), **§4.4** (`dueDate` = issue date for `PAY_NOW`, else `null`), **§2 out of scope** (payment recording and any change to `amountPaidMinorUnits` / `paymentStatus` after generation are #39; no void or regeneration operation). |
| Relies on (Accepted, merged) | [Laundry Order Page plan](2026-10-14-laundry-order-page-plan.md) (#156): the route, `OrderSection`, `resolvedInvoiceNodes`, `currentLaundryOrderSection`, `laundryLifecycleVerbs`, the render-test harness. [Laundry Price Review plan](2026-10-15-laundry-price-review-plan.md) (#162): the synchronous in-flight guard and refetch-on-both-paths pattern of `useConfirmLaundryPrice`, the jsdom page harness `laundry-order-page.interaction.test.tsx`. [Laundry UI foundation plan](2026-10-10-laundry-ui-foundation-plan.md): `laundryOrderActions`, the `success.*` / `failure.*` / `paymentTerms.*` / `invoicePaymentStatus.*` copy. |
| Authority | Where this plan and an Accepted spec disagree, the **spec wins** and this plan must be revised. Issue #166 refines §8.4.4 with layout, copy, behavior and test requirements. File names, helper names, copy keys and task order are planning decisions, not product semantics. |
| Spec amendment | **None needed.** Every behavior below is already allowed by the Accepted specs; the issue adds presentation only. No new mutation, field or rule. |
| Owner input | The owner chose to skip the brainstorm questions (2026-10-24) and asked that the plan rest on the ticket, code and Accepted specs only, separate recording payment, updating the invoice, and setting the paid status, and flag any business decision the evidence does not settle. See [Evidence: payment, invoice and paid status](#evidence-payment-invoice-and-paid-status) and [Open business decisions](#open-business-decisions-for-the-owner). |
| Planning decisions for M5 to confirm | See [Planning decisions](#planning-decisions-for-m5-to-confirm) (a)–(k) and [Section ownership after this slice](#section-ownership-after-this-slice). |
| Edit anchors | New files are described by their interfaces and tests. Edits to existing files are given against `main` at `9135546`. Apply each by the quoted code, not by line number. |
| Package names | `pnpm --filter web` is `apps/web`. `pnpm --filter @clensy/web` is `packages/web`. `pnpm --filter @clensy/client` is `packages/client`. |
| Pre-validation | **None.** No code in this plan was run before M5. Every `Expected:` line is a prediction until M6 records the actual result. |
| M7 | Application code changes. `CLAUDE.md` requires a **fresh independent reviewer** on the most capable model, given the Accepted specs, this plan once Accepted, and the branch diff. |

**Goal:** On `/app/laundry/<id>`, the Invoice section becomes "Invoice and payment": an Invoice card that generates an invoice with chosen terms or shows the existing one, and an Order payment card that offers the next order-level payment verb (Mark paid / Mark awaiting payment), with the two kept visibly separate.

**Architecture:**

- **Pure module (`apps/web/lib/laundry-invoice-payment.ts`):** `laundryInvoiceView` (which body the Invoice card shows) and `laundryPaymentView` (which verbs or sentence the Order payment card shows). They read only the resolved invoice result and `laundryOrderActions` verbs.
- **Tone map (`apps/web/lib/invoice-payment-status.ts`):** billing's existing `STATUS_TONE`, moved unchanged and imported by both the billing page and the order page (issue: "reuse it rather than inventing a second one").
- **Generate hook (`apps/web/lib/use-generate-laundry-invoice.ts`):** `generateInvoiceFromOrder` behind a synchronous ref guard; toast on success; alert on failure; refetches `InvoiceForOrder` on both paths.
- **Transition hook (`apps/web/lib/use-laundry-order-transition.ts`):** the page-level in-flight guard #165 will share ([contract](#shared-in-flight-guard-contract)). Runs `markLaundryOrderPaid` or `markLaundryOrderAwaitingPayment` behind one synchronous ref guard; toast on success; alert on failure; refetches the order on both paths.
- **Cards (`apps/web/components/laundry/laundry-invoice-payment.tsx`):** presentational `LaundryInvoiceCard` and `LaundryOrderPaymentCard`.
- **Page:** `LaundryOrderWorkspace` owns both hooks. The Invoice section renders both cards. `markPaid` and `markAwaitingPayment` move from the Actions text list into the Order payment card, and the nav marks the section that now holds them. Every other lifecycle verb stays a text item in Actions for #165 ([ownership](#section-ownership-after-this-slice)).

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

A **failure** in rows F3, F4, F8 and F9 is any of the three outcomes the hooks treat alike: the mutation promise rejects, it resolves with GraphQL `errors`, or it resolves without the expected payload (no `data`, or the mutation field missing or `null`).

| # | Case | Server result | Page behavior | Test |
| --- | --- | --- | --- | --- |
| F1 | Generate succeeds | Invoice created `UNPAID` | Toast "Invoice generated."; refetch `InvoiceForOrder`; card shows number, amount, Unpaid, terms. Order status unchanged and the order is not refetched. | Task 3 hook cases 1–2; Task 5 interaction case 1 |
| F2 | Generate double click before re-render | — | One request (ref guard). | Task 3 hook case 3; Task 5 interaction case 2 |
| F3 | Generate fails and the refetch still shows no invoice: status changed to an ineligible one (`BadRequestException`), role lost, network | Failure | Alert "Unable to generate invoice."; the invoice query is refetched on every failure outcome; Generate is enabled again once the refetch settles. | Task 3 hook cases 4, 7; Task 4 card case 4; Task 5 interaction cases 3–4 |
| F4 | Generate fails because another user already generated (`ConflictException`) | Failure; invoice exists | The failure refetch returns the other user's invoice, so the card shows it (number, amount, badge, terms, link). The generate alert is **not** shown: it renders only in the `generate` view (decision k). | Task 4 card case 12; Task 5 interaction case 5 |
| F5 | The invoice refetch fails, after a generate success or failure | Unknown to the page | Invoice card shows "Unable to load invoice." only (no generate alert, never "No invoice yet."); the order header and the other sections stay. | Task 3 hook cases 6–7; Task 4 card cases 2, 12; Task 5 interaction case 6 |
| F6 | Mark paid / awaiting payment succeeds | Status `PAID` / `AWAITING_PAYMENT` | Toast; refetch the order; card moves to the next state. Invoice untouched and not refetched. | Task 3 hook cases 8–9; Task 5 interaction cases 7–8 |
| F7 | Two payment verbs, or one verb twice, before re-render | — | One request: both buttons share one ref guard and one `pending` flag. | Task 3 hook case 10; Task 5 interaction case 9 |
| F8 | A payment verb fails and the refetched order still offers it: role lost, network | Failure | Alert "Unable to mark the order paid." (or "…awaiting payment."); the order is refetched on every failure outcome; the buttons are enabled again once it settles. | Task 3 hook case 11; Task 4 card case 7; Task 5 interaction cases 10–11 |
| F9 | A payment verb fails because the order already moved (another user acted first) | Failure; status changed | The failure refetch shows the true status. Whether the alert stays depends on that status (decision k):<br>(i) **The attempted transition's outcome was reached anyway** — `markPaid` and the order is now `PAID`; `markAwaitingPayment` and the order is now `AWAITING_PAYMENT` or `PAID`. The alert is **not** shown; the card shows the refetched state (for example "Paid. Processing can start.").<br>(ii) **Any other status**, for example `CANCELLED` after another user cancelled the order. The alert **stays**, even though the status no longer offers the button, so a failed payment transition is never concealed. In neither case has any money been recorded against the invoice; the alert is about the order's status only. | Task 2 view cases (`laundryPaymentFailureAlert`); Task 4 card case 13; Task 5 interaction cases 12 (outcome reached) and 14 (cancelled) |
| F10 | The order refetch fails after a payment verb | Unknown to the page | The page's existing order error state ("Unable to load laundry order."); the order sections, including both cards and their buttons, are not rendered. Guaranteed by the page guard `if (!validId \|\| orderQuery.error \|\| !order)` in `apps/web/app/app/laundry/[id]/page.tsx`, which returns `ErrorState` before any section renders, whatever data Apollo retains (#156 M5 review 2; render test "shows the error state, not a retained order, when the order query fails"). | Task 3 hook case 13 (the hook swallows the refetch rejection and clears `pending`); Task 5 interaction case 13 (the page's response to the query error state). Neither test exercises Apollo's own refetch: that Apollo sets `error` on a failed `refetch()` is Apollo's behavior, relied on as #162 interaction case 10 does. |
| F11 | Order marked paid while its invoice reads Unpaid | Both true by design | The Order payment card says the two are separate: "The order must be marked paid before processing starts. That is separate from the invoice payment status." | Task 4 card case 6 |

## Open business decisions for the owner

The evidence does not settle these. The plan implements the Accepted behavior and does **not** assume an answer. M5 may confirm "proceed as planned", or return the plan.

1. **Should staff be steered to invoice before marking paid (or the reverse)?** The specs make the two independent and the issue's Mark paid rule has no invoice condition, so the plan shows both cards' controls independently. If the shop wants, for example, Mark paid hidden until an invoice exists, that is a new product rule and needs a spec amendment (M2/M3), not a plan change.
2. **Is an order marked Paid next to an invoice reading Unpaid acceptable until #39 lands?** It is what the Accepted specs produce (no operation updates `Invoice.paymentStatus`). The plan shows both facts with the issue's explanatory sentence. If the owner wants different wording or an extra note on the invoice card, that is copy only and can be changed in M5.
3. **Who records the money, and when, at the counter?** No artifact establishes it, and no feature in this slice records money. It is #39's question and is recorded here only so it is not mistaken for something this slice decides.

## Planning decisions for M5 to confirm

- **(a) Payment verbs move into the Invoice section.** `SECTION_VERBS` gains `markPaid` and `markAwaitingPayment`, so `laundryLifecycleVerbs` drops them and the Actions text list no longer names them (they are buttons in the Order payment card instead). The Actions section itself is otherwise unchanged: it still names the remaining lifecycle verbs as text, or says "No further actions for this order." when none remain, exactly as it already does today when only section-owned verbs remain (for example SCHEDULER on `WEIGHED`). `currentLaundryOrderSection` then marks `invoice` when either verb is offered, applying #156's existing rule ("the next step forward the actor may take") to where the verb now lives. Changed rows: `PRICED` as TENANT_OWNER with an invoice (or unresolved invoice) → `invoice` (was `actions`). Unchanged: `PAID` as SCHEDULER → `actions` (`startProcessing`). See [Section ownership after this slice](#section-ownership-after-this-slice).
- **(b) The section heading and nav label become "Invoice and payment".** Same key (`order.sections.invoice`), same id (`laundry-order-invoice`).
- **(c) Terms control is a native radio group** (`fieldset` + `legend` "Payment terms"), each option with its one-line help visible and linked by `aria-describedby`. The issue allows a select or a radio group; radios show all three meanings at once. Default `PAY_ON_COMPLETION`.
- **(d) Failure copy is fixed, not the server message.** The issue fixes "Unable to generate invoice."; the payment verbs use the existing `failure.markPaid` / `failure.markAwaitingPayment`. The refetch shows the true state, so a server message (for example "An invoice already exists for this laundry order") is not needed to recover. This differs from #162, which shows the server message.
- **(e) Two existing strings are reworded to the issue's text:** `failure.generateInvoice` "Unable to generate the invoice." → "Unable to generate invoice."; `order.invoice.error` "Unable to load the invoice." → "Unable to load invoice.". Neither is read anywhere else (`grep` on `main`: only the order page reads `order.invoice.error`; nothing reads `failure.generateInvoice`).
- **(f) Generate refetches the invoice after every outcome:** success and each of the three failure outcomes (F3–F5), as `useConfirmLaundryPrice` refetches the order on both paths. The payment verbs likewise refetch the order after every outcome (F6, F8–F10).
- **(g) Generate and the payment verbs do not block each other.** The issue gives Generate its own `generating` flag and the payment verbs the shared lifecycle guard. The two server operations are independent (Evidence), so running one while the other is in flight cannot corrupt either.
- **(h) Unresolved-but-not-loading invoice results show nothing in the Invoice card,** as today (#156 M5 review 3 tests). Only `loading` shows `LoadingState`, only `error` shows the error sentence.
- **(i) `amountDueMinorUnits` is requested but not displayed.** The issue asks for it in the query and does not place it in the layout. It equals the total until #39.
- **(j) The Order payment card shows for every role,** with its explanation, and "Paid. Processing can start." on a `PAID` order. Only the buttons are role-gated (through `laundryOrderActions`), so SCHEDULER and ANALYST never see them.
- **(k) A failure alert is hidden only when the refreshed state shows the attempted outcome was reached anyway.** The hooks keep the failure state (`failed`, `failure`) until the next attempt starts. Whether the alert is still true of what the user sees is decided per card:
  - **Generate.** `LaundryInvoiceCard` renders the "Unable to generate invoice." alert only in the `generate` view. When the failure refetch shows an invoice (F4), the invoice the user wanted exists and is authoritative, so the alert is not rendered. When the refetch fails (F5), the card shows only "Unable to load invoice.".
  - **Payment verbs.** The page passes the card `laundryPaymentFailureAlert(transition.failure, order.status)` (Task 2), which hides the alert only when the refetched status is the attempted transition's accepted outcome:

    | Failed verb | Alert hidden when the order is now | Alert shown otherwise, for example |
    | --- | --- | --- |
    | `markPaid` | `PAID` | `PRICED` / `AWAITING_PAYMENT` (still offered), `CANCELLED`, any later status |
    | `markAwaitingPayment` | `AWAITING_PAYMENT` or `PAID` | `PRICED` (still offered), `CANCELLED`, any later status |

    `LaundryOrderPaymentCard` renders the alert it is given in **every** view, including `paid` and `none` where no button is shown. So a cancellation by another user never silently conceals a failed Mark paid (F9 ii).

  The toast is the only success feedback, and the refetched state is the recovery. The issue does not address this case; it is a presentation choice, not a new rule, and the alert copy speaks only about the order's status, never about money recorded against the invoice. The table follows the owner's M5 instruction literally: a status later than `PAID` (for example `PROCESSING`, reached if another user marked the order paid and started processing before this refetch) keeps the alert.

## Section ownership after this slice

What each section of `/app/laundry/<id>` owns once #166 merges, and what #165 then owns. "Verb" means a `laundryOrderActions` verb; each is shown only when that function returns it.

| Section | Verbs it owns | Rendered as, after #166 | Owner of later change |
| --- | --- | --- | --- |
| Weighing | `weigh` | Editor (#155) | — |
| Services / Price | `price` | Selection and Confirm (#158, #162) | — |
| Invoice and payment | `generateInvoice` (Invoice card) | Terms control and **Generate invoice** button | **#166 (this slice)** |
| Invoice and payment | `markPaid`, `markAwaitingPayment` (Order payment card) | **Mark paid** / **Mark awaiting payment** buttons | **#166 (this slice)** |
| Actions | `startProcessing`, `markReady`, `markAwaitingPickup`, `markAwaitingDelivery`, `complete`, `cancel`, `reject`, `markLost`, `markDamaged`, `refund` | Text list, unchanged (`ActionsBody` with `laundryLifecycleVerbs(verbs)`); "No further actions for this order." when empty | **#165**: replaces this list with buttons, including the `ConfirmDialog` for `cancel`, `reject`, `markLost`, `markDamaged`, `refund` (§8.4.4), and the cancellation of an `AWAITING_PAYMENT` order (issue Submit: "Cancellation of an awaiting-payment order is the lifecycle issue") |

#166 moves exactly two verbs, `markPaid` and `markAwaitingPayment`, from the Actions text list to buttons. It adds no button to Actions and changes no other verb's section. `generateInvoice` was already section-owned (#156 `SECTION_VERBS`); this slice turns its facts into a control.

### Shared in-flight guard contract

`useLaundryOrderTransition` is the one page-level guard for **order lifecycle verbs**. This slice creates it; #165 extends it rather than adding a second guard.

1. **One instance per order page**, created in `LaundryOrderWorkspace` (keyed by order id, so another order starts with a fresh guard) and passed down to every section that offers a lifecycle verb.
2. **`run(verb)` takes the guard synchronously**, before any `await`. A `run` call while the guard is held returns without sending a request; calls are dropped, not queued.
3. **`pending` is `true` from the `run` call until the order refetch that follows the mutation settles**, on success and on every failure outcome.
4. **Every control that sends a lifecycle verb calls `run` and is `disabled` while `pending`.** In this slice: the two Order payment buttons. In #165: each Actions button, and the confirm action of each `ConfirmDialog`.
5. **`failure` is the verb whose last run failed**, or `null`. It is cleared when the next `run` starts. How a section shows it is that section's choice (this slice: decision k, through `laundryPaymentFailureAlert`, which takes only payment verbs). When #165 widens the union, the page narrows `failure` to a `LaundryPaymentVerb` (or `null`) before passing it to that helper, so a failed #165 verb is shown by #165's Actions controls and not by the payment card.
6. **The verb union is the extension point.** This slice declares `type LaundryTransitionVerb = LaundryPaymentVerb` (`'markAwaitingPayment' | 'markPaid'`). #165 widens `LaundryTransitionVerb` and adds the mutation for each new member inside the hook. The guard, `pending` and `failure` do not change shape.
7. **Not under this guard:** `generateInvoiceFromOrder` (its own `generating` guard, decision g), `priceLaundryOrder` (`useConfirmLaundryPrice`), `weighLaundryOrder` (the weighing editor's guard). Each keeps its own guard and is not routed through this hook.

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

1. **Another user acts first.** A second staff member generates the invoice, marks the order paid, or cancels it while this page is open. The mutation fails and the refetch shows the real invoice or status with no dead button. The alert is hidden only when that state is the outcome the user attempted; a cancellation keeps it (F4, F9: Task 2 `laundryPaymentFailureAlert` cases; Task 4 card cases 12–13; Task 5 interaction cases 5, 12 and 14).
2. **A click on Mark paid and Mark awaiting payment in the same tick.** One request only (F7: Task 3 hook case 10; Task 5 interaction case 9).
3. **The invoice query fails after a generate.** "Unable to load invoice.", never "No invoice yet.", and the order page stays (F5: Task 3 hook cases 6–7; Task 5 interaction case 6).
4. **An order marked paid whose invoice reads Unpaid.** Both shown, with the explanation (F11: Task 4 card case 6).
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
| `apps/web/lib/use-laundry-order-transition.ts` | Create | `useLaundryOrderTransition` (the shared guard) |
| `apps/web/lib/use-laundry-order-transition.hook.test.tsx` | Create | Guard, success, failure, refetch |
| `apps/web/components/laundry/laundry-invoice-payment.tsx` | Create | `LaundryInvoiceCard`, `LaundryOrderPaymentCard` |
| `apps/web/lib/laundry-invoice-payment.render.test.tsx` | Create | Static markup per state |
| `apps/web/app/app/laundry/[id]/page.tsx` | Modify | Wire hooks and cards |
| `apps/web/lib/laundry-order-page.render.test.tsx` | Modify | Mocks, role matrix, changed assertions |
| `apps/web/lib/laundry-order-page.interaction.test.tsx` | Modify | Mocks, `settleInvoiceRefetch`, opt-out teardown flags; generate and payment flows, failure recovery |
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

**Type:** `code`. **Traces to:** issue Layout and States; §8.4.4 action bullet; decision (a), (h), (j), (k).

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
  - `laundryPaymentFailureAlert(failure: LaundryPaymentVerb | null, status: LaundryOrderStatus): LaundryPaymentVerb | null` — decision (k): returns `null` when `failure` is `null`, when `failure === 'markPaid'` and `status === 'PAID'`, or when `failure === 'markAwaitingPayment'` and `status` is `AWAITING_PAYMENT` or `PAID`; otherwise returns `failure`. It reads only the failed verb and the refetched status, never the role or the invoice.
  - `export type LaundryPaymentVerb = 'markAwaitingPayment' | 'markPaid'` is declared **here**, so this pure module does not import the hook. Task 3 imports it.
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

it.each([
  // [failed verb, refetched status, expected] — decision (k)
  [null, 'PRICED', null],
  // Accepted outcome reached: hidden.
  ['markPaid', 'PAID', null],
  ['markAwaitingPayment', 'AWAITING_PAYMENT', null],
  ['markAwaitingPayment', 'PAID', null],
  // Still offered: shown.
  ['markPaid', 'PRICED', 'markPaid'],
  ['markPaid', 'AWAITING_PAYMENT', 'markPaid'],
  ['markAwaitingPayment', 'PRICED', 'markAwaitingPayment'],
  // Another user cancelled: shown, though no button remains.
  ['markPaid', 'CANCELLED', 'markPaid'],
  ['markAwaitingPayment', 'CANCELLED', 'markAwaitingPayment'],
  // Later than the accepted outcome: shown (decision k, literal rule).
  ['markPaid', 'PROCESSING', 'markPaid'],
  ['markAwaitingPayment', 'PROCESSING', 'markAwaitingPayment'],
])('laundryPaymentFailureAlert: %s failed, order now %s → %s', …);
```

In `laundry-order-page.test.ts`, change rows `['PRICED', 'TENANT_OWNER', true, 'actions']` and `['PRICED', 'TENANT_OWNER', undefined, 'actions']` to `'invoice'`; add `['AWAITING_PAYMENT', 'CUSTOMER_SUPPORT', true, 'invoice']` and `['PRICED', 'OPS_MANAGER', true, 'invoice']`; keep `['PAID', 'SCHEDULER', true, 'actions']`. Change the `laundryLifecycleVerbs` test to expect `['weigh','price','generateInvoice','markPaid','markAwaitingPayment','cancel']` → `['cancel']`, and rename it "drops the verbs that the weighing, services and invoice and payment sections own".

- [ ] **Step 2: Run.** `pnpm --filter web exec vitest run lib/laundry-invoice-payment.test.ts lib/laundry-order-page.test.ts` — Expected: FAIL (modules missing; changed rows).
- [ ] **Step 3: Implement** the two modules and the `laundry-order-page.ts` changes. Update the comment on `SECTION_VERBS` ("Verbs that the Weighing, Services and Invoice and payment sections own") and on `currentLaundryOrderSection`. Edit the billing page import.
- [ ] **Step 4: Run.** Same command — Expected: PASS. Then `pnpm --filter web exec tsc --noEmit` — Expected: exit 0 except errors in `laundry-order-page.render.test.tsx` that Task 5 fixes, if any; record them.
- [ ] **Step 5: Commit.** `git commit -m "feat(166): invoice and payment views; payment verbs move to the invoice section"`

---

### Task 3: Generate and transition hooks

**Type:** `code`. **Traces to:** issue Submit; §8.4.4; Evidence F1–F10; decisions (d), (f), (g); [Shared in-flight guard contract](#shared-in-flight-guard-contract). Follow `use-confirm-laundry-price.ts` and its test harness `use-confirm-laundry-price.hook.test.tsx` (Probe component, deferred promises, `ToastProvider`).

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

import type { LaundryPaymentVerb } from './laundry-invoice-payment'; // Task 2
// The lifecycle verbs this guard runs. #165 widens this union (contract item 6).
export type LaundryTransitionVerb = LaundryPaymentVerb;
export interface LaundryOrderTransitionState {
  run: (verb: LaundryTransitionVerb) => Promise<void>;
  pending: boolean;                       // the page-level guard #165 will share
  failure: LaundryTransitionVerb | null;  // the verb that last failed; cleared when the next run starts
}
export function useLaundryOrderTransition(options: { orderId: string; refetch: () => Promise<unknown> }): LaundryOrderTransitionState;
```

Both hooks implement the [Shared in-flight guard contract](#shared-in-flight-guard-contract) items 2, 3 and 5 for their own guard. **Failure outcomes:** each hook treats exactly three outcomes as a failure, as `useConfirmLaundryPrice` does: (R) the mutation promise rejects; (E) it resolves with a non-empty `errors` array; (P) it resolves without the expected payload, meaning `data` is absent, or the mutation field (`generateInvoiceFromOrder`, `markLaundryOrderPaid`, `markLaundryOrderAwaitingPayment`) is absent or `null`. On every failure outcome the hook sets its failure state, shows no success toast, and still awaits the refetch. A refetch that throws is swallowed, as in `useConfirmLaundryPrice`. Recovery then **relies on** Apollo leaving the query with `error` set after a failed `refetch()`; the page's guards turn that state into the invoice card's error sentence (F5) or the page error state (F10). This slice does not test that Apollo behavior: the hook tests here prove only that the rejection is swallowed and the flags clear, and the Task 5 page cases use helpers (`settleRefetch`, `settleInvoiceRefetch`) that set the query state directly instead of running Apollo's refetch. The hooks render no alert; the cards render it from the failure state (Task 4, decision k), and Task 5 checks the alert on the page.

- [ ] **Step 1: Write the failing tests.** Mock `useGenerateInvoiceFromOrderMutation`, `useMarkLaundryOrderPaidMutation`, `useMarkLaundryOrderAwaitingPaymentMutation` and `usePriceLaundryOrderMutation` with deferred promises; render inside `ToastProvider` and assert toast text on `document.body.textContent`, as the confirm hook test does. `OUTCOMES` covers the three failure outcomes, R, E, and P in each of its three forms, as a function of the mutation field name:

```ts
const OUTCOMES = [
  ['rejects', 'reject', () => new Error('network down')],
  ['resolves with errors', 'resolve', () => ({ errors: [{ message: 'Conflict' }] })],
  ['resolves without data', 'resolve', () => ({})],
  ['resolves without the payload field', 'resolve', () => ({ data: {} })],
  ['resolves with a null payload', 'resolve', (field: string) => ({ data: { [field]: null } })],
] as const;
```

Generate hook (`ORDER = '00000000-0000-4000-8000-000000000001'`):
1. `sends exactly the order id and terms`: `generate('PAY_NOW')` → mutation called once with `{ variables: { input: { laundryOrderId: ORDER, paymentTerms: 'PAY_NOW' } } }` (`toEqual`, so no extra key such as a paid flag); no `markPaid` / `markAwaitingPayment` / `priceLaundryOrder` mock called.
2. `toasts and refetches on success, keeping generating true until the refetch settles`: resolve with `{ data: { generateInvoiceFromOrder: { id: 'i1' } } }` → `generating` still `true` while the refetch is pending; toast text "Invoice generated."; then `generating` `false`, `failed` `false`; refetch called exactly once.
3. `drops a second generate while one is in flight`: two `generate` calls in one `act` → one mutation call.
4. `it.each(OUTCOMES)` `fails when the mutation %s, and still refetches the invoice`: settle the mutation with the outcome (field `generateInvoiceFromOrder`) → while the refetch is pending, `failed` `true` and `generating` `true`; refetch called **exactly once**; no "Invoice generated." in `document.body.textContent`; after the refetch resolves, `generating` `false` and `failed` still `true`.
5. `clears the failure when the next generate starts`: after a case-4 failure, call `generate` again → `failed` `false` before that mutation settles.
6. `survives a failed refetch after success`: refetch rejects → no throw; `generating` `false`; `failed` `false`.
7. `survives a failed refetch after a failure`: mutation rejects, then refetch rejects → no throw; `generating` `false`; `failed` `true`.

Transition hook:
8. `marks paid with the order id`: `run('markPaid')` → paid mutation `{ variables: { input: { orderId: ORDER } } }`; toast "Order marked paid."; order refetch called exactly once; generate and awaiting-payment mutations not called; `failure` `null`.
9. `marks awaiting payment`: same for `markAwaitingPayment` → awaiting mutation `{ variables: { input: { orderId: ORDER } } }`, toast "Order marked awaiting payment.".
10. `one guard for both verbs`: `run('markPaid')` then `run('markAwaitingPayment')` in one `act` → one mutation call in total; `pending` `true` through the mutation and until the refetch settles, then `false`.
11. `it.each` over `['markPaid', 'markLaundryOrderPaid', 'Order marked paid.']` and `['markAwaitingPayment', 'markLaundryOrderAwaitingPayment', 'Order marked awaiting payment.']` × `OUTCOMES`: `fails %s when the mutation %s, and still refetches the order` → while the refetch is pending, `failure` equals the verb and `pending` `true`; refetch called **exactly once**; the success toast text absent; after the refetch resolves, `pending` `false` and `failure` still the verb.
12. `clears the failure when the next run starts`: after a case-11 failure, `run('markPaid')` → `failure` `null` before that mutation settles.
13. `survives a failed refetch`: mutation resolves `{ data: { markLaundryOrderPaid: { id: ORDER } } }`, refetch rejects → no throw; `pending` `false`; `failure` `null`.

- [ ] **Step 2: Run.** `pnpm --filter web exec vitest run lib/use-generate-laundry-invoice.hook.test.tsx lib/use-laundry-order-transition.hook.test.tsx` — Expected: FAIL (modules missing).
- [ ] **Step 3: Implement** both hooks (`'use client'`; `useRef` guard taken synchronously; `useState` for the flags; `useToast().success(t('success.<verb>'))`). Change `failure.generateInvoice` to "Unable to generate invoice.".
- [ ] **Step 4: Run.** Same command — Expected: PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(166): generate-invoice and order payment transition hooks"`

---

### Task 4: Invoice and Order payment cards

**Type:** `code`. **Traces to:** issue Layout, States; decisions (c), (h), (i), (j), (k).

**Files:**
- Create: `apps/web/components/laundry/laundry-invoice-payment.tsx`, `apps/web/lib/laundry-invoice-payment.render.test.tsx`
- Modify: `packages/web/src/i18n/messages/en/laundry.ts` (all remaining keys in [Global constraints](#global-constraints))

**Interfaces:**
- Consumes: `LaundryInvoiceView`, `LaundryPaymentView`, `LaundryPaymentVerb`, `INVOICE_PAYMENT_STATUS_TONE` (Task 2); `GenerateLaundryInvoiceState` field types (Task 3).
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
  // Already filtered by the page with `laundryPaymentFailureAlert` (decision k).
  failure: LaundryPaymentVerb | null;
  onRun: (verb: LaundryPaymentVerb) => void;
}): JSX.Element;
```

Markup: each card is `<div className="rounded-md border border-slate-200 p-4">` with an `h3` (`order.invoice.title` / `order.payment.title`). `LaundryInvoiceCard` keeps the selected terms in local state, default `PAY_ON_COMPLETION`, and passes it to `onGenerate`. Radio `name="laundry-invoice-terms"`, ids `laundry-invoice-terms-<TERM>`, help ids `laundry-invoice-terms-<TERM>-help`. The Generate `Button` is the default variant, `disabled={generating}`, label `order.invoice.generating` while generating. Mark paid is the default variant; Mark awaiting payment is `variant="secondary"`, placed after it; both `disabled={pending}`. Failures render `<p role="alert" className="text-red-600">`, subject to decision (k): the generate alert only when `view === 'generate' && failed`; the payment alert (`t(`failure.${failure}`)`) whenever `failure` is not `null`, in every view, including `paid` and `none` where no button is shown. The payment card does no filtering of its own; the page passes the result of `laundryPaymentFailureAlert`. The existing-invoice body is a `dl` (number, total via `formatMinorUnits`, payment status as `StatusBadge` with `label={t(`invoicePaymentStatus.${s}`)}` and the shared tone, terms as `t(`paymentTerms.${terms}`)`) and a `Link` to ``/app/billing?detail=${encodeURIComponent(invoice.id)}``.

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
12. `the generate alert shows only beside the generate form` (decision k; F4, F5): `failed: true` with `view: 'invoice'` (and an invoice) → the invoice body, no `role="alert"`, no "Unable to generate invoice."; `failed: true` with `view: 'error'` → "Unable to load invoice." and no "Unable to generate invoice."; `failed: true` with `view: 'loading'`, `'unresolved'` or `'none'` → no "Unable to generate invoice.".
13. `the payment card shows the alert it is given in every view, and none without one` (decision k; F9): `failure: 'markPaid'` with `view: 'none'` (a cancelled order) → `role="alert"` "Unable to mark the order paid." and no `<button`; `failure: 'markAwaitingPayment'` with `view: 'markPaid'` → the Mark paid button and `role="alert"` "Unable to mark the order awaiting payment."; `failure: 'markPaid'` with `view: 'markPaid'` → `role="alert"` "Unable to mark the order paid."; `failure: null` with `view: 'paid'` → "Paid. Processing can start." and no `role="alert"`. No case renders text about money received or the invoice's paid amount.

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
  - `const transition = useLaundryOrderTransition({ orderId: id, refetch: () => orderQuery.refetch() });` declared beside `confirmPrice`, with a comment that it is the page's one lifecycle-verb guard and that #165's Actions buttons and confirm dialogs use this same instance ([contract](#shared-in-flight-guard-contract)).
  - Replace `InvoiceBody` with `InvoicePaymentBody`, rendering `<div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-4">` holding `LaundryInvoiceCard` (view from `laundryInvoiceView({ error: Boolean(invoiceQuery.error), loading: invoiceQuery.loading, invoices, verbs })`, `invoice={invoices?.[0]}`, `generating` / `failed` / `onGenerate` from `generateInvoice`) and `LaundryOrderPaymentCard` (view from `laundryPaymentView(order.status, verbs)`, `pending={transition.pending}`, `failure={laundryPaymentFailureAlert(transition.failure, order.status)}`, `onRun={(verb) => void transition.run(verb)}`). `order.status` is the status of the order the page is showing, so after the failure refetch settles it is the refetched status.
  - `ActionsBody` and its call (`<ActionsBody verbs={laundryLifecycleVerbs(verbs)} t={t} />`) are **not** edited: the Actions list loses `markPaid` and `markAwaitingPayment` only through Task 2's `SECTION_VERBS` change.
  - Update the file's top comment: Invoice and payment (#166) generates invoices and runs the two payment verbs; Actions (#165) still names the remaining lifecycle verbs as text. Update `ActionsBody`'s comment ("The server re-checks every verb; this page offers no control") to say Actions offers no control yet, the payment verbs being buttons in Invoice and payment.
  - Remove the now-unused `Invoice` type alias if nothing else reads it.

- [ ] **Step 1: Update the render harness and write the failing render tests.** The render harness's `vi.mock('@clensy/client', …)` does not spread the original module, so add `useGenerateInvoiceFromOrderMutation`, `useMarkLaundryOrderPaidMutation`, `useMarkLaundryOrderAwaitingPaymentMutation` (each `() => [vi.fn(), { loading: false }]`) and a `refetch: () => Promise.resolve()` on the `useInvoiceForOrderQuery` result. Update existing tests:
  - "renders the header, back link, … no controls in the read-only sections": drop `section(html, 'invoice')` from the read-only list (it now holds controls); keep header, Overview and Actions.
  - "renders the section nav and six sections in order": the heading list reads "Invoice and payment".
  - "names the role-allowed lifecycle actions as text in Actions" (PRICED, TENANT_OWNER): Actions contains "Cancel order" and **not** "Mark paid" / "Mark awaiting payment"; it still contains no `<button`.
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
  10. `Actions keeps only the remaining lifecycle verbs, as text` (ownership table): status `PRICED`, role `FINANCE` (offered: `markAwaitingPayment`, `markPaid`, `generateInvoice`; FINANCE may not cancel) → Actions contains "No further actions for this order." and no `<button`; the Invoice section contains the "Mark paid" button and the "Generate invoice" button. Status `PAID`, role `OPS_MANAGER` → Actions names "Start processing" (the `actions.startProcessing` text) and "Refund order" as text with no `<button`.

- [ ] **Step 2: Update the interaction harness and write the failing interaction cases.**
  - Mocks: add `useMarkLaundryOrderAwaitingPaymentMutation: () => [page.awaiting, { loading: false }]`. In `beforeEach`, after the existing `mockReset()` calls, give `page.invoice`, `page.paid` and `page.awaiting` deferred implementations (`deferred(page.invoices)`, `deferred(page.paids)`, `deferred(page.awaitings)`, the existing `deferred` helper) so each case settles them with `finish`.
  - Teardown: the harness's `afterEach` asserts that `page.invoice` and `page.paid` are never called (#162: "Confirm never generates an invoice or marks an order paid"). Keep that guarantee for every case that does not opt out, following the `weighExpected` precedent: add `page.invoiceExpected` and `page.paymentExpected` (reset to `false` in `beforeEach`), and change the teardown to `if (!page.invoiceExpected) expect(page.invoice).not.toHaveBeenCalled();` and `if (!page.paymentExpected) { expect(page.paid).not.toHaveBeenCalled(); expect(page.awaiting).not.toHaveBeenCalled(); }`. Generate cases set `invoiceExpected`; payment cases set `paymentExpected`; no case sets both, so each also proves the other card's mutation was not sent.
  - Invoice query: make `useInvoiceForOrderQuery` return `{ data: { invoices: { nodes: page.invoiceNodes } }, error: page.invoiceError, loading: false, refetch: page.invoiceRefetch }`, with `page.invoiceRefetch` a deferred into `page.invoiceRefetches`.
  - Add `settleInvoiceRefetch(index, outcome: { error: Error } | { nodes: unknown[] })`, the invoice twin of `settleRefetch`: it sets `page.invoiceNodes` or `page.invoiceError`, settles the promise the hook awaits, and remounts. Like `settleRefetch`, it does **not** exercise Apollo's refetch; it sets the query state the real hook would expose, so these cases prove the page's response to that state.
  - Reset all new fields in `beforeEach`.

  Cases (status `PRICED`, role `TENANT_OWNER` unless stated; `INVOICE = { id: 'i1', invoiceNumber: 'INV-2026-000001', totalMinorUnits: 45000, amountDueMinorUnits: 45000, paymentStatus: 'UNPAID', paymentTerms: 'PAY_NOW' }`):
  1. `generate sends the chosen terms and laundry order id only, toasts, and refetches the invoice` (F1): click the "Pay now" radio, click "Generate invoice", resolve `{ data: { generateInvoiceFromOrder: { id: 'i1' } } }`, `settleInvoiceRefetch(0, { nodes: [INVOICE] })` → `page.invoice` called once with `{ variables: { input: { laundryOrderId: ID, paymentTerms: 'PAY_NOW' } } }` (`toEqual`); toast "Invoice generated."; the Invoice section shows "INV-2026-000001", "Unpaid", "Pay now"; `page.paid`, `page.awaiting` and the order refetch (`page.refetch`) not called; the status badge still reads "Priced".
  2. `a double click on Generate sends one request` (F2).
  3. `a rejected generate alerts, refetches, and re-enables Generate` (F3, outcome R): reject, `settleInvoiceRefetch(0, { nodes: [] })` → `page.invoiceRefetches` has length 1; `role="alert"` "Unable to generate invoice." in the Invoice section; the Generate button is enabled; no "Invoice generated.".
  4. `a generate that resolves with errors alerts and refetches` (F3, outcome E): resolve `{ errors: [{ message: 'Bad request' }] }`, `settleInvoiceRefetch(0, { nodes: [] })` → as case 3. (Outcome P is covered per form by Task 3 case 4; the page renders the same `failed` state.)
  5. `when another user generated first, the refetch shows their invoice and no stale alert` (F4): reject with `new Error('An invoice already exists for this laundry order')`, `settleInvoiceRefetch(0, { nodes: [INVOICE] })` → the Invoice section shows "INV-2026-000001" and `href="/app/billing?detail=i1"`; contains no `role="alert"` and no "Unable to generate invoice."; no "Generate invoice" button.
  6. `a failed invoice refetch says so and keeps the order page` (F5): resolve the generate, `settleInvoiceRefetch(0, { error: new Error('reload failed') })` → the Invoice section contains "Unable to load invoice." and neither "No invoice yet." nor "Unable to generate invoice."; the `h1` "Ana Reyes" and `#laundry-order-actions` are still rendered.
  7. `Mark paid sends the order id, toasts, and refetches the order` (F6): click "Mark paid", resolve `{ data: { markLaundryOrderPaid: { id: ID } } }`, `settleRefetch(0, { order: …status PAID })` → `page.paid` `{ variables: { input: { orderId: ID } } }`; "Order marked paid."; the Order payment card reads "Paid. Processing can start."; `page.invoice` and `page.invoiceRefetch` not called.
  8. `Mark awaiting payment` (F6) → `page.awaiting` with the same variables, "Order marked awaiting payment.", and after `settleRefetch` to `AWAITING_PAYMENT` the card shows the Mark paid button only.
  9. `while one payment verb runs, both buttons are disabled and a second click sends nothing` (F7): keep `page.paids[0]` pending; click "Mark paid", then "Mark awaiting payment" → `page.paid` + `page.awaiting` calls total 1; both buttons `disabled` until `settleRefetch` settles.
  10. `a rejected Mark paid alerts, refetches, and re-enables the buttons` (F8, outcome R): reject, `settleRefetch(0, { order: …status PRICED })` → `page.refetches` has length 1; `role="alert"` "Unable to mark the order paid."; both buttons enabled.
  11. `a Mark paid that resolves without its payload alerts and refetches` (F8, outcome P): resolve `{ data: { markLaundryOrderPaid: null } }`, `settleRefetch(0, { order: …status PRICED })` → as case 10, and no "Order marked paid.". (Outcome E and the other P forms are covered by Task 3 case 11.)
  12. `it.each` `when another user already reached the attempted outcome, the refetch shows it and no alert` (F9 i): rows `[button 'Mark paid', verb mock page.paid, refetched status 'PAID']`, `['Mark awaiting payment', page.awaiting, 'AWAITING_PAYMENT']`, `['Mark awaiting payment', page.awaiting, 'PAID']`. Click the button, reject the mutation, `settleRefetch(0, { order: …status })` → the Invoice section contains no `role="alert"` and neither "Unable to mark the order paid." nor "Unable to mark the order awaiting payment."; for `PAID`, "Paid. Processing can start." and no payment buttons; for `AWAITING_PAYMENT`, the Mark paid button only.
  13. `a failed order refetch shows the page error state, not live payment buttons` (F10): resolve the Mark paid, `settleRefetch(0, { error: new Error('reload failed') })` → `container.textContent` contains "Unable to load laundry order."; `#laundry-order-invoice` is `null`; no button named "Mark paid" or "Mark awaiting payment" in `container`. Mirrors #162 interaction case 10.
  14. `when another user cancelled the order, the failed Mark paid stays visible` (F9 ii): click "Mark paid", reject the mutation, `settleRefetch(0, { order: …status CANCELLED, totalMinorUnits: 45000 })` → the status badge reads "Cancelled"; the Invoice section contains `role="alert"` "Unable to mark the order paid." and no "Mark paid" or "Mark awaiting payment" button; no "Order marked paid." toast. (A `PRICED` order may be cancelled, lifecycle spec §4.3 note 5, and keeps its total.)

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
- [ ] **Step 2: Confirm the unchanged paths.** `git diff --stat main...HEAD -- apps/api packages/ui 'apps/web/app/app/laundry/page.tsx'` — Expected: empty. API suites are recorded **NOT RUN** (no API change) and not claimed as covered.

  Then check that no added line records money or reads the invoice's paid amount. Only added lines are inspected, so the existing `amountPaidMinorUnits` in `apps/web/app/app/billing/page.tsx` (which this slice edits for the tone-map import) is not a false positive:

  Run: `git diff main...HEAD -- apps packages ':(exclude)packages/client/src/generated' | grep -E '^\+' | grep -vE '^\+\+\+ ' | grep -nE 'recordPayment|amountPaidMinorUnits'`
  Expected: no output (`grep` exit status 1). Record the command and its exit status. Any output is a finding to fix in the task that added the line, not to be explained away.

  The codegen output is excluded because it already carries `amountPaidMinorUnits` for billing's `InvoiceDetail` fragment, and a regenerated file can move existing lines. What this slice adds to that file is pinned instead by Task 1's test, which fixes the `InvoiceForOrder` selection to exactly `id`, `invoiceNumber`, `totalMinorUnits`, `amountDueMinorUnits`, `paymentStatus`, `paymentTerms`.
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
| One in-flight guard for lifecycle verbs, shared with #165 under an explicit contract | Issue Submit | 3, 5; [contract](#shared-in-flight-guard-contract) |
| #166 moves only `markPaid` / `markAwaitingPayment` out of Actions; the rest stay text for #165 | Issue Purpose, Submit; decision (a) | 2, 5 (render cases 10 and the updated Actions test) |
| Every failure outcome (rejected, GraphQL errors, missing payload) fails and refetches | Issue Submit; `useConfirmLaundryPrice` precedent | 3 (cases 4, 11); 5 (cases 3–4, 10–11) |
| Concurrent generate or status change: refetched state shown; alert hidden only when the attempted outcome was reached, kept on cancellation | Decision (k); invoices spec §4.3 (one invoice per order); lifecycle spec §4.3 | 2 (`laundryPaymentFailureAlert` cases); 4 (cases 12–13); 5 (cases 5, 12, 14) |
| Failed refetch: invoice error in the card (invoice) or page error state (order) | Issue States; #156 page guard | 3 (cases 6–7, 13); 5 (cases 6, 13) |
| No confirm dialog for these verbs | §8.4.4 action bullet | 4 |
| Loading / error / empty states; resolved-result rule kept | Issue States; issue comment | 2, 4, 5 |
| No payment recording, no invoice payment-state change | §8.2; invoices spec §2; #39 | Global constraints; 6 Step 2 |
| Estimate UI not on the card | Issue Acceptance | 4, 5 |

## Revision 2 changes

The M4 review returned revision 1 for four corrections. None changes product behavior allowed by the Accepted specs, and none needs a spec amendment.

1. **Actions ownership.** Revision 1 said "Actions (#165) still names verbs as text" while removing two verbs from that list, without saying which verbs remained. Added [Section ownership after this slice](#section-ownership-after-this-slice), which lists each section's verbs and the issue that owns its next change, and the [Shared in-flight guard contract](#shared-in-flight-guard-contract) (seven items). Decision (a) now states the Actions list's remaining content and its empty sentence. `LaundryTransitionVerb` is declared as the extension point. Task 5 adds render case 10 and says `ActionsBody` is not edited.
2. **Mutation-failure tests.** Revision 1 tested a rejected mutation and asserted the refetch only on that path. Task 3 cases 4 and 11 now run every failure outcome for both hooks and every verb: rejection, GraphQL `errors`, and a missing payload in three forms. Each checks the failure state, the absence of the success toast, exactly one refetch, and the flag clearing after the refetch. The page-level alert is checked in Task 5 cases 3–4 and 10–11, and its rendering in Task 4.
3. **Recovery claims.** Revision 1 claimed F8 (now F10) with only a hook test. F10 now cites the page guard that guarantees it (`if (!validId || orderQuery.error || !order)` returns `ErrorState` before any section), adds Task 5 interaction case 13 using the harness's existing `settleRefetch`, and states the limit of that evidence: neither test exercises Apollo's own refetch. F5 (invoice refetch failure) gets the matching page case 6 and a `settleInvoiceRefetch` helper with the same stated limit.
4. **Concurrent generation.** Revision 1 did not say whether the generate alert stays once a refetch shows another user's invoice. New decision (k): an alert shows only while the control that failed is still shown. F4 is split out of F3 and tested in Task 4 case 12 and Task 5 case 5. The same rule covers a payment verb whose status has moved (F9; Task 4 case 13, Task 5 case 12).

Adjacent updates: failure cases renumbered F1–F11, with Review focus, the Task 3 header and Traceability references updated to match. The interaction harness keeps #162's "never generates an invoice or marks paid" teardown through opt-out flags. Pre-validation is still **None**: every `Expected:` line remains a prediction until M6 records the actual result.

## Revision 3 changes

The M5 review of revision 2 accepted the plan's direction and asked for three focused corrections. Scope, the Accepted specs, the three open business questions, the predicted-versus-actual rule and the M7 independent-review gate are unchanged.

1. **Payment-alert suppression narrowed.** Revision 2 hid a payment alert whenever the refetched status no longer offered the failed verb, which would hide a failed Mark paid after another user cancelled the order. Decision (k) now hides it only when the attempted transition's accepted outcome was reached: `markPaid` → `PAID`; `markAwaitingPayment` → `AWAITING_PAYMENT` or `PAID`. Every other status keeps the alert, including `CANCELLED` and statuses later than `PAID`. Changes:
   - a new pure helper `laundryPaymentFailureAlert` in Task 2, with a case table;
   - `LaundryPaymentVerb` is now declared in Task 2's module and imported by Task 3;
   - the payment card renders any alert it is given, in every view (Task 4 case 13 rewritten);
   - the page passes the helper's result (Task 5);
   - Task 5 case 12 covers all three accepted outcomes, and new case 14 proves a cancellation keeps the alert;
   - F9 is split into (i) and (ii), and contract item 5 says how #165 narrows a widened `failure` before the helper.

   The generate rule (F4) is unchanged: an invoice found by the refetch is the outcome the user wanted.
2. **Apollo wording qualified.** Task 3 now says recovery *relies on* Apollo setting `error` after a failed `refetch()`, that this slice does not test it, and that the page cases use state-setting helpers rather than Apollo's refetch.
3. **Payment-recording check made precise.** Task 6 Step 2 now inspects only added diff lines (`git diff main...HEAD -- apps packages`, `+` lines without the `+++` headers, generated client output excluded) for `recordPayment` or `amountPaidMinorUnits`, and expects no output. The pre-existing billing-page reference is no longer a false positive. The generated file is covered by Task 1's exact-selection test instead.

## Execution record

### M6 — 2026-10-24

The owner authorized M6 on 2026-10-24 ("m6") after recording the M5 acceptance (`a848f08`). It was executed inline in one session (superpowers:executing-plans), task by task in plan order, each test watched failing before the code that passes it. Every result below is an **actual** result from this session, not a prediction.

| Task | Commit | RED (observed) | GREEN (observed) |
| --- | --- | --- | --- |
| 1 `InvoiceForOrder` fields | `1f9e071` | The new client test failed: the selection lacked `amountDueMinorUnits` and `paymentTerms`. | 4/4 in the file; `@clensy/client` build exit 0. Codegen changed 4 lines of `generated/graphql.ts`, with no reordering. |
| 2 Pure views, tones, section ownership | `a139484` | The new test file failed on the missing module; 4 changed `currentLaundryOrderSection` rows and the `laundryLifecycleVerbs` test failed. | 109/109 in the two unit files; with the render file, 174/174; `tsc --noEmit` exit 0. |
| 3 Hooks | `068883d` | Both hook files failed on missing modules. | 26/26 (generate 11, transition 15); `tsc` and `eslint` exit 0. |
| 4 Cards | `2fe7ba5` | The render file failed on the missing module. One assertion of my own was wrong on the first green run: it matched `disabled` inside Tailwind's `disabled:` classes. It was fixed to assert the `disabled=""` attribute. | 16/16 cards; 95/95 with the page tests; `@clensy/web` test 418/418, build and lint exit 0. |
| 5 Page wiring | `4c069b5` | 7 new render cases failed. All 16 new interaction cases failed, each because the control did not exist yet (`Cannot read properties of undefined (reading 'click')`); the 14 #162 cases still passed. | 105/105 in the two page files; full `apps/web` suite 54 files, 2308/2308. |

**Rulings made during execution** (each also in the session ledger):

1. **Task 2.** Moving `markPaid` and `markAwaitingPayment` into `SECTION_VERBS` broke 6 existing render tests. The plan placed one of them in Task 5 and did not list the other 5. Those 5 asserted that Actions is the current section for a `PRICED` order as TENANT_OWNER, which decision (a) changes. They were fixed in Task 2 so every commit stays green. They exist to prove retained or incomplete invoice data never marks Invoice (#156 M5 reviews 1 and 3). They now use `PROCESSING`, where TENANT_OWNER may generate an invoice but has no payment verb, so the invoice result alone still decides the nav. *Cost if wrong:* those five no longer exercise `PRICED`; the new #166 render cases cover `PRICED`.
2. **Task 4.** The copy changes broke 3 existing render assertions that the plan updates in Task 5 (the section heading list, and "Unable to load invoice." twice). They were updated in Task 4 with the plan's own edits, so the commit stays green. *Cost if wrong:* none.
3. **Task 5.** Render cases 2, 4, 8 and 9 passed before the page change. They assert that controls or wording are absent, which the old read-only Invoice body satisfies. They were kept as written because they pin role and status gating once controls exist; cases 1, 3, 5–7 and 10 failed first and cover the presence side. *Cost if wrong:* those four have not shown they can fail; M7 may ask for a break run.
4. **Task 5.** The existing render test "says when there is no invoice yet" used the default TENANT_OWNER on `AWAITING_PAYMENT`. That role now sees the Generate form, as the issue's Layout requires. Its role was changed to OPS_MANAGER, who may not generate. *Cost if wrong:* none to behavior.

No ruling changes product behavior, the Accepted specs, or the M5-accepted decisions. No characterization tests were labelled by the plan, and none were added.

### Task 6 — verification (actual results)

| Check | Command | Result |
| --- | --- | --- |
| Web tests | `pnpm --filter web test` | exit 0 — 54 files, 2308/2308 |
| Web lint | `pnpm --filter web lint` | exit 0 |
| Web typecheck | `pnpm --filter web exec tsc --noEmit` | exit 0 |
| `@clensy/web` tests | `pnpm --filter @clensy/web test` | exit 0 — 418/418 |
| `@clensy/web` lint | `pnpm --filter @clensy/web lint` | exit 0 |
| `@clensy/web` build | `pnpm --filter @clensy/web build` | exit 0 |
| `@clensy/client` tests | `pnpm --filter @clensy/client test` | exit 0 — 14/14 |
| `@clensy/client` build | `pnpm --filter @clensy/client build` | exit 0 |
| `@clensy/client` lint | `pnpm --filter @clensy/client lint` | exit 0 |
| Unchanged paths | `git diff --stat main...HEAD -- apps/api packages/ui 'apps/web/app/app/laundry/page.tsx'` | empty |
| No payment recording added | `git diff main...HEAD -- apps packages ':(exclude)packages/client/src/generated' \| grep -E '^\+' \| grep -vE '^\+\+\+ ' \| grep -nE 'recordPayment\|amountPaidMinorUnits'` | no output, grep exit 1 |
| API suites | — | **NOT RUN**: no API change; not claimed as covered |
| Browser check (Step 3) | — | **NOT RUN — environment constraint.** The running `clensy-platform-web-1` container serves a built image (`pnpm start`, no source mount), not this branch, and holds port 3001, the only browser origin the API's CORS accepts (`WEB_ORIGIN`). Checking this branch means stopping that container and running `next dev` from the working tree; the `docker stop` was **not authorized** (the session's permission policy denied it), and the owner chose on 2026-10-24 to skip the check rather than authorize it. Not passed, and nothing stands in for it: the 375 px / 1280 px layout, the keyboard pass of the terms radio group, and the real billing-drawer link are unverified. See the setup and cleanup note below. |

The jsdom timeouts recorded in #205 did not occur in any run in this session.

**Browser-check setup and cleanup.** Before the container stop was refused, three QA staff accounts were created in the local dev tenant, following the #155/#158 `qa…` precedent: `qa166-finance-973af1@example.com`, `qa166-ops-manager-973af1@example.com` and `qa166-scheduler-973af1@example.com`. The seed owner's credentials were read from `.env` and never printed. A `next dev` started from this branch failed at once because port 3001 was taken; the container was never stopped or changed. When the owner chose to skip the check, all three accounts were disabled through `disableAdmin` (confirmed `isActive = false` in the database) and the file with their generated passwords was deleted. No order or invoice was changed.

### Owner-directed review fixes (after the M6 commits, before M7)

The owner reviewed the code diff in six parts, found no blocking defect, and directed four optional fixes. They are uncommitted until M7 and the browser check are reviewed.

1. **Per-instance terms ids and radio group.** `GenerateForm` builds its radio ids, help-text ids and radio `name` from React's `useId()` (`${prefix}-terms-<TERM>`, `${prefix}-terms-<TERM>-help`, `name="${prefix}-terms"`). This replaces Task 4's fixed `laundry-invoice-terms-<TERM>` ids and `name="laundry-invoice-terms"`. The plan treats ids and names as planning decisions, so the accepted plan is not revised; its behavioral requirements are unchanged (choices, default, label and help-text links). The owner kept the `name` change too, because radios that share a name behave as one group across forms. Card case 4 now checks the label and `aria-describedby` relationships instead of literal ids. A new card test, "two generate forms on one page share no id and no radio group", **failed first** on the fixed ids (12 ids, 6 distinct) and passes now.
2. **Page comment.** The comment on `order.status` in `InvoicePaymentBody` now says the page relies on Apollo applying the refetch, or setting `error` when it fails, and that this is not tested. No logic changed.
3. **Interaction case 15** (F9 ii boundary): Mark paid is rejected and the refetch shows `AWAITING_PAYMENT`; the alert stays, Mark paid stays, Mark awaiting payment is absent, and there is no success toast. It passed on first run because it pins existing behavior. Break evidence, run outside the change and not kept: `laundryPaymentFailureAlert` was temporarily made to hide a `markPaid` failure at `AWAITING_PAYMENT` too. Case 15 then failed (`expected [] to deeply equal [ 'Unable to mark the order paid.' ]`), and the file was restored from git and confirmed clean.
4. **Generate hook case 3** also asserts that the one surviving request carries the first call's `PAY_NOW` and the order id. This has not been shown to fail on its own: removing the guard trips the call-count assertion first. The owner kept it as documentation of the contract.

Results after the fixes (actual): the four affected test files 134/134; `pnpm --filter web exec tsc --noEmit` exit 0; `pnpm --filter web lint` exit 0; `pnpm --filter web test` exit 0, 54 files, 2310/2310.

### M7 round 1 — Returned for Revision (2026-10-24)

An **independent** review by a fresh agent on the most capable model, which did not implement the change (`CLAUDE.md`). It was given the Accepted specs, this plan and `git diff main` (the six commits plus the uncommitted review fixes), and it modified no file.

- **Decision:** Returned for Revision, on verification only. Tasks 1–5 conform to the plan and both Accepted specs, with no correctness, scope or convention defect.
- **Blocking 1 (verification):** the Task 6 Step 3 browser check was not run, and the plan allows "not run" only for states the seed data cannot produce.
- **Blocking 2 (subject integrity):** the reviewed fixes and this record were uncommitted.
- **Evidence the reviewer re-ran itself:**
  - web 2310/2310; web lint and `tsc` exit 0; `@clensy/client` 14/14; `@clensy/web` 418/418;
  - the unchanged-path diff (empty) and the added-lines payment grep (no output);
  - a probe against real Apollo Client 3.14.1 (`watchQuery`, `network-only`, scripted link). A successful `refetch()` applies the new data before its promise resolves, and `loading` does not flip. A failed `refetch()` rejects and leaves the query with `error` set and the old data retained.

**Accepted reviewer conclusions (the owner adopted these, 2026-10-24):**

- **Apollo refetch reliance is acceptable.** The probe confirms both behaviors the hooks rely on, and the ordering means `pending` clears only after `order.status` is the reloaded status. A dedicated `MockedProvider` integration test is **optional follow-up**, not needed before merge.
- The guard contract (items 1–7), Review focus 1–5 and the four M6 rulings hold. Nothing implies money is recorded or that `Invoice.paymentStatus` changes, and the three open business decisions remain unanswered by the UI.

**Owner decisions on the return (2026-10-24):**

1. **Browser check: not run, environment constraint.** The container stop was not authorized, and the owner chose not to authorize it for this slice. The check is recorded above as not run, never as passed. M7 is asked to confirm whether this documented exception satisfies the plan's gate.
2. **Commit:** commit the five reviewed code files, unchanged, with this record, then send the delta to the M7 reviewer for re-review. No push and no PR yet.

**Deferred (follow-up, not in this slice):**

- **Due-date display.** The issue says of `dueDate` (issue date for Pay now, otherwise null), "Display that". The Accepted plan's invoice-exists layout lists number, amount, payment-status badge, terms and the billing link, and the card follows it. The owner left the card as planned for this review. Whether the card should show the due date is recorded as a clarification for the owner to settle in a follow-up, not as a silent scope change.
- **Optional `MockedProvider` refetch integration test** (from the M7 conclusion above).
- **Minor fixture note** (reviewer): the `PROCESSING` render fixture's invoice node lacks `paymentTerms`. This is harmless to its assertions.

**Status summary:**

| Class | Items |
| --- | --- |
| Passed | Automated tests, lint and typecheck, as recorded by M6 and re-run independently by M7 |
| Not run | Browser check (environment constraint; container stop not authorized) |
| Accepted reviewer conclusion | Apollo refetch reliance acceptable; integration test optional |
| Deferred | Due-date display clarification; optional integration test |
