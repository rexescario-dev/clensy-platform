# Laundry Lifecycle Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Accepted (revision 2.10)** at M5, 2026-10-25 ([M5 decision](#m5-decision)). Drafted at M4 from 2026-10-24. Revision 1 was returned by the owner with five decisions (U1–U5) and seven corrections ([Revision 2 changes](#revision-2-changes)). Revision 2.1 tightens lock ownership, #166 compatibility and race-test validity after the owner's preliminary review ([Revision 2.1 changes](#revision-21-changes)). Revision 2.2 makes per-order lock isolation explicit and tested, and tightens the acquire contract and the evidence rules ([Revision 2.2 changes](#revision-22-changes)). Revision 2.3 makes the order-switch test prove the key is necessary (same root, same page instance), pins the editor's early-return path, and states what an M5 record may and may not claim ([Revision 2.3 changes](#revision-23-changes)). M5 review of revision 2.2: **Revise** (2026-10-24). Revision 2.4 corrects five test-design and consistency gaps found in a full audit of 2.3 ([Revision 2.4 changes](#revision-24-changes)). Review of the #166 amendment text in 2.4: **Revise before sign-off** (2026-10-24). Revision 2.5 narrows Rules item 2 and separates the destructive dialog's own submission from the page lock ([Revision 2.5 changes](#revision-25-changes)). Revision 2.6 corrects an ambiguous eligibility sentence and adds the helper's verbs for every race fixture ([Revision 2.6 changes](#revision-26-changes)); revision 2.7 corrects two cells of that table. Revision 2.8 makes the race matrix prove that both competing handlers run ([Revision 2.8 changes](#revision-28-changes)). Revision 2.9 corrects the lock-removal procedure so each run records the actual mutation outcome independently of the lock-log assertions ([Revision 2.9 changes](#revision-29-changes)). Revision 2.10 measures row M9, whose two clicks share one mutation spy, by its total submitted mutations ([Revision 2.10 changes](#revision-210-changes)). Accepted at M5 with the owner's sign-off on the #166 amendment. No command in this plan has been run; every result below is expected, not actual, until M6 records it. |
| M5 decision | **Accepted** — 2026-10-25, revision 2.10, by the owner. See [M5 decision](#m5-decision). |
| M6 | **Complete** — 2026-10-26, on `feat/165-laundry-lifecycle-actions`. Actual results and deviations in the [Execution record](#execution-record-m6). |
| M7 | **Approved** (round 2, 2026-10-26) by a fresh independent reviewer. Round 1 Returned one blocking finding, B1, fixed in `6836371`. See [M7 round 1](#m7-round-1--returned-2026-10-26) and [M7 round 2](#m7-round-2--approved-2026-10-26). |
| M8 | **N/A**. See [M8](#m8--not-applicable). |
| M9 | **Complete** (2026-10-26). See [M9](#m9--documentation-2026-10-26). |
| Merge and closeout | Merged in PR [#210](https://github.com/rexescario-dev/clensy-platform/pull/210) (`edd6f9e`, 2026-10-26); #165 closed; follow-ups #211 and #212 filed. See [Closeout](#closeout-2026-10-26). |
| Date | 2026-10-24 |
| Tracking issue | [#165](https://github.com/rexescario-dev/clensy-platform/issues/165) "Laundry lifecycle actions". Epic [#154](https://github.com/rexescario-dev/clensy-platform/issues/154). Depends on [#156](https://github.com/rexescario-dev/clensy-platform/issues/156) (order page, merged in #183) and the laundry UI foundation (`laundryOrderActions`, merged). Follows [#166](https://github.com/rexescario-dev/clensy-platform/issues/166) (merged in #207), which owns the payment verbs and created the transition hook this slice extends. |
| Branch | `feat/165-laundry-lifecycle-actions`, from `main` at `e2e73e9`, created at M6. One PR for this plan, its M5 record and the implementation. |
| Scope | `packages/client`: `updatedAt` on the `LaundryOrderDetail` fragment, regenerated output, one client test. `apps/web`: a new page mutation lock, the transition hook (widened), the price-confirm and generate-invoice hooks and the weighing editor (each joins the lock), a new pure module, a new presentational component, the order page, two existing laundry components (one `disabled` prop each), and tests. `packages/web`: `laundry` copy. **No** API, schema, migration, resolver, GraphQL type, `@clensy/ui` or dependency change. The list page and drawer (`apps/web/app/app/laundry/page.tsx`) are not edited (#161 owns the cutover). |
| Implements (Accepted) | [Laundry Orders & Lifecycle](../specs/2026-09-06-laundry-orders-lifecycle-design.md), Status **Accepted** (2026-09-06), with **Amendment #164**, Accepted 2026-10-10. Governing text: **§8.4.4** action bullet ("Action buttons are the §4.3 matrix intersected with the fulfillment branch and the actor's §4.4 role. `cancel`, `reject`, `lost`, `damaged`, and `refund` require an explicit confirmation. The client mirror is presentation only."), the workspace bullet (lifecycle actions on the page; `AWAITING_PICKUP` and `AWAITING_DELIVERY` mutually exclusive by `fulfillmentType`), the invoice bullet (marking `PAID` / `AWAITING_PAYMENT` is a lifecycle verb that records no invoice payment). **§4.3** (matrix), **§4.4** (verbs, roles, audit actions), **§4.9** (status-badge tones). |
| Relies on (Accepted, merged) | [Laundry Invoice and Payment plan](2026-10-24-laundry-invoice-payment-plan.md) (#166): `useLaundryOrderTransition` and its [Shared in-flight guard contract](2026-10-24-laundry-invoice-payment-plan.md#shared-in-flight-guard-contract) (**amended by this plan**, see [Amendment to the #166 guard contract](#amendment-to-the-166-guard-contract)), `laundryPaymentFailureAlert` (decision k), the Order payment card, `useGenerateLaundryInvoice`. [Laundry Price Review plan](2026-10-15-laundry-price-review-plan.md) (#162): `useConfirmLaundryPrice`, `graphQLErrorMessage`, the jsdom page harness, the `weighing` staleness flag. [Multi-entry Laundry Weighing plan](2026-10-14-multi-entry-laundry-weighing-plan.md) (#155): `LaundryWeighingEditor`. [Laundry Order Page plan](2026-10-14-laundry-order-page-plan.md) (#156): `OrderSection`, `LAUNDRY_ORDER_SECTIONS`, `laundryLifecycleVerbs`, `currentLaundryOrderSection`, the render harness. Laundry UI foundation: `laundryOrderActions`, `LAUNDRY_DESTRUCTIVE_VERBS`, the `actions.*`, `confirm.*`, `success.*`, `failure.*` copy. #194: `ConfirmDialog` stays open while `confirming`. |
| Authority | Where this plan and an Accepted spec disagree, the **spec wins** and this plan must be revised. Issue #165 refines §8.4.4 with layout, copy, behavior and test requirements. The owner's revision-1 decisions (U1–U5) are recorded in [Owner decisions](#owner-decisions-revision-1-review). File names, helper names, copy keys and task order are planning decisions, not product semantics. |
| Spec amendment | **None needed.** Every behavior below is allowed by §8.4.4 and §4.3/§4.4. `updatedAt` already exists on the GraphQL `LaundryOrder` type (`apps/api/src/schema.gql`; `laundry-order.type.ts`); this slice only selects it. The shared lock changes an Accepted **plan's** client contract (#166), not a spec; M5 accepting this plan accepts that amendment. |
| Planning decisions for M5 to confirm | (a)–(k) below, and the [#166 contract amendment](#amendment-to-the-166-guard-contract). |
| Edit anchors | Edits to existing files are given against `main` at `e2e73e9`. Apply each by the quoted code, not by line number. |
| Package names | `pnpm --filter web` is `apps/web`. `pnpm --filter @clensy/web` is `packages/web`. `pnpm --filter @clensy/client` is `packages/client`. |
| Pre-validation | **None.** No code in this plan was run before M5. Every `Expected:` line is a prediction until M6 records the actual result. |
| M7 | Application code changes. `CLAUDE.md` requires a **fresh independent reviewer** on the most capable model that did not implement the change, given the Accepted spec, this plan once Accepted, the #166 plan's guard contract with this plan's amendment, and the branch diff. The M7 record cites that review. |

**Goal:** On `/app/laundry/<id>`, the Actions section replaces its read-only verb list with one button per lifecycle verb the helper allows (forward actions, then a separator, then destructive ones behind `ConfirmDialog`); every mutation on the page (weigh, confirm price, generate invoice, the two payment verbs and the ten lifecycle verbs) takes one shared, synchronous page lock, so only one runs at a time; and a new Activity section, last on the page, shows created time, updated time and the current status without implying an event log.

**Architecture:**

- **Page mutation lock (`apps/web/lib/use-laundry-mutation-lock.ts`, new):** one per order workspace. `tryAcquire(owner)` is synchronous (a ref) and returns a unique **lease**, or `null` when the lock is held, so a second mutation that lands before React re-renders is refused; only the holder of the current lease can release it; `held` is render state for disabling controls. See [Shared page mutation lock](#shared-page-mutation-lock).
- **Transition hook (`apps/web/lib/use-laundry-order-transition.ts`, widened):** `LaundryTransitionVerb` becomes the two payment verbs plus the ten Actions verbs; one mutation per verb; acquires the page lock as owner `transition`; `pending` and `failure` unchanged in shape; one new field, `message` (decision a).
- **Price-confirm hook, generate-invoice hook, weighing editor (existing):** each keeps its own state, guard and failure display, and also acquires the page lock (owners `price`, `generateInvoice`, `weigh`).
- **Pure module (`apps/web/lib/laundry-order-lifecycle-actions.ts`, new):** `LaundryActionVerb`, `isLaundryPaymentVerb`, `laundryActionGroups(verbs)` and `laundryActionFailure(failure, message)` → `LaundryActionFailure | null` where `LaundryActionFailure = { verb: LaundryActionVerb; message: string | null }`. The component turns it into text.
- **Component (`apps/web/components/laundry/laundry-order-actions.tsx`, new):** presentational `LaundryOrderActions`: buttons, separator, alert, controlled `ConfirmDialog`.
- **Page:** `LaundryOrderWorkspace` creates the lock first, passes it to all four mutation owners, disables every mutation control while `lock.held`, owns the confirm state, renders `LaundryOrderActions` in Actions and Activity last.

**Tech Stack:** React 19, Next.js 16, Apollo Client 3.14 (`@clensy/client` generated hooks), Tailwind 4, Vitest (node `renderToStaticMarkup`; jsdom with `createRoot` + `act`).

**Spec:** `docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md` §8.4.4, §4.3, §4.4, §4.9.

---

## Revision 2 changes

| # | Owner request | Change |
| --- | --- | --- |
| 1 | U5: a genuinely shared synchronous guard | New [Shared page mutation lock](#shared-page-mutation-lock): every mutation entry point traced, acquire/release on every outcome, unmount behavior. The derived `busy` flag (revision 1 decision c) is removed. The #166 contract change is documented in [Amendment to the #166 guard contract](#amendment-to-the-166-guard-contract). |
| 2 | Tests that prove the shared guard | New Task 2 (lock unit tests); lock cases added to every mutation owner's tests (Tasks 4–5); a page-level [race matrix](#race-matrix) in both directions for every pair that can coexist on one status, with release on success, failure and refetch failure, using same-tick clicks rather than disabled states. Existing same-hook double-run tests are kept unchanged. |
| 3 | One failure-helper interface | `laundryActionFailure` returns `{ verb, message: string \| null }` everywhere; the component computes `message ?? t(\`failure.${verb}\`)`. The `{ verb, text }` wording is removed. |
| 4 | Cross-section behavior | New [Cross-section behavior](#cross-section-behavior) table: each owner's pending state and failure display under the lock, and each deviation from Accepted #162/#166 behavior. |
| 5 | Keep other decisions and boundaries | Unchanged: helper and matrix, payment verbs out of Actions, confirm before destructive mutation, server messages, refetch, Activity without a timeline, no API/schema/`packages/ui`/list-page edits. |
| 6 | Reconcile every section | Tasks renumbered (8 tasks); file map, interfaces, fixtures, gates, traceability and risks updated; U1–U5 moved to [Owner decisions](#owner-decisions-revision-1-review). |
| 7 | Honest evidence | Status Draft revision 2; no `Expected:` line is a result. |

## Revision 2.1 changes

After the owner's preliminary review of revision 2 (2026-10-24), three points were checked in the plan text and tightened:

| # | Owner check | Change |
| --- | --- | --- |
| 1 | Release only by the operation that acquired, on every path; a refused attempt never releases another's lock | `tryAcquire` returns a unique lease object (or `null`); `release(lease)` is a no-op unless that exact lease is the current holder. Releasing by owner name is removed, so two operations of the same owner kind can never release each other. Each owner holds its lease in a local `const` declared before its `try`, so only the invocation that acquired reaches a `release`. New lock unit tests for stale, foreign and double releases; new per-owner tests that a refused attempt leaves the holder's lock held. |
| 2 | #166 compatibility | New [Unchanged by the amendment](#unchanged-by-the-amendment) list naming decision k, F1–F10, the generate alert rule and every invoice/payment semantic that the amendment leaves alone. |
| 3 | Race-test validity | Each race row now asserts, before the race, that both controls are present and enabled; dispatches both through the real handlers in one `act`; and after the race asserts the winner's mutation was called once, the loser's zero times, the loser showing no pending or failure state, and the winner's pending state shown. That the refused attempt leaves the holder's lease in place is asserted directly on the lock in the owner tests (Tasks 4–5). A new required [lock-removal check](#lock-removal-check) (M6, outside the commit, like a characterization break): five runs, each removing one owner's participation, with the rows expected to fail and to pass, and why. |

## Revision 2.2 changes

Requested by the owner for the final M5 review (2026-10-24). Architecture, U1–U5, scope, the eight tasks and the #166 amendment are unchanged.

| # | Owner request | Change |
| --- | --- | --- |
| 1 | Per-order lock isolation, explicit and tested | New [Per-order isolation](#per-order-isolation): the route's mount path traced; `key={id}` on `LaundryOrderWorkspace` required at that boundary, with the lock created inside the keyed component and nowhere above it; why order A's pending operation can release only A's lock. New Task 7 interaction case 11 switches from order A (mutation pending) to order B and proves B's lock is independent and starts unlocked, and that A's settling neither releases nor blocks B. New [key-removal check](#key-removal-check) proves that case fails when the key is removed. |
| 2 | Acquire contract | Rules item 2 states the order of operations per owner explicitly, including the weighing editor: validation before acquisition, the synchronous `isHeld()` check before any state change, and why its later `tryAcquire` cannot be refused. Task 5 editor tests name the early-return cleanup they assert. |
| 3 | #166 amendment and decisions | Unchanged. |
| 4 | Race evidence | The lock-removal check requires actual results for all five runs, compared with the predicted rows; any mismatch stops M6. The isolation case and the key-removal check are added to the file map, dependencies, acceptance mapping and gates. Interaction case 9's fallback wording is removed. |
| 5 | Whole-document reconciliation | Status, gates, risks and acceptance mapping updated; one pre-existing behavior is recorded as a risk (a success toast from order A can appear after switching to order B); it is not changed. |

## Revision 2.3 changes

From the M5 review of revision 2.2 (decision **Revise**, 2026-10-24). Architecture, U1–U5, scope, the eight tasks and the #166 amendment are unchanged.

| # | Review item | Change |
| --- | --- | --- |
| 1 | Blocker: the order-switch test must prove the key is necessary | Task 7 interaction case 11 now names the harness behavior it relies on, verified on `main` at `e2e73e9`: `root` is created once per test in `beforeEach` (`root = createRoot(container)`), and `mount()` only calls `root.render(...)` on that root, so a second `mount()` re-renders into the same root and React keeps the same `LaundryOrderPage` instance. Case 11 renders its own tree with a local `renderTree()` on that same `root` (not `mount()`), with a mount-counter probe beside the page; `mounts === 1` after the switch shows the root and the page instance were kept. The [key-removal check](#key-removal-check) now predicts case 11's exact failing assertion and requires the mount-counter assertion to still pass in that run, so a fresh root cannot explain the failure. |
| 2 | Editor failure cleanup must exercise the real early return | Task 5 test 2 now drives both failure outcomes (a rejected `weighLaundryOrder` and a resolved result with GraphQL `errors`) through the `if (failed !== undefined) { setFailure(failed); return; }` branch inside the `try`, and asserts `onRecorded` was **not** called (the success path was not taken) before asserting the cleanup. |
| 3 | Break-run evidence | Unchanged from 2.2; restated in the M5 record rule below. |
| 4 | One `laundryActionFailure` shape | Re-checked: `{ verb, message: string \| null }` in the architecture, Task 3 interface and tests, Task 6 props and tests, and Task 7 wiring. The only remaining "`{ verb, text }`" is the revision-2 change log describing its removal. |
| 5 | The M5 record must separate design from evidence | New [What an M5 acceptance records](#what-an-m5-acceptance-records). |
| 6 | Wording | "Why A cannot release or block B" now says the handler captures the `lock` from the render that created it (revision 2.2 said the options are read when the handler runs). |

## Revision 2.4 changes

From a full audit of revision 2.3 against the repository on `main` at `e2e73e9` (2026-10-24). Architecture, U1–U5, scope, the eight tasks, the race-matrix pairs, the lock-removal predictions and the #166 amendment are unchanged.

| # | Finding in 2.3 | Correction |
| --- | --- | --- |
| 1 | Case 11 said to settle A's promises "directly" without saying which ones. The interaction harness queues every call to one mutation in one shared deferred list, and every order refetch in `page.refetches` (`deferred()`; `useLaundryOrderQuery` returns `refetch: page.refetch` for any id). | Case 11 now names the indices: A's mutation is entry 0 and B's entry 1 of the `startLaundryProcessing` list; A's refetch is `page.refetches[0]` (it starts only after A's mutation settles, while B's mutation is still pending), settled with the file's `finish()` so `page.order` stays B; B's refetch is `page.refetches[1]`. It also sets the new expected-call flag for `startLaundryProcessing` and does not assert on toasts. |
| 2 | Task 7 Step 2 did not say to add the ten mutation mocks or `updatedAt` to the interaction harness (only the render harness was covered). The harness's `weighed()` fixture has no `updatedAt`. | Task 7 Step 2 now adds both: one deferred list and one expected-call flag per new mutation (checked in `afterEach`, as for weigh and payment), and `updatedAt` in `weighed()`. |
| 3 | Race row M9 had outcome "—", but every row settles the winner (step 5) and re-clicks the loser (step 6). | M9's outcome is success. |
| 4 | Task 5 test 2 did not prove the editor's request was sent, so a validation-blocked submit could satisfy "onRecorded not called"; it did not cover the fallback message; and it did not say how the editor test gets a lock. | Test 2 now asserts the weigh mutation was called exactly once before the failure (so the validation path was not taken) and that `onRecorded` was not called and no "Weight recorded." toast appeared (so the success path was not taken), which leaves only the `return` inside the `try`. It adds outcome (iii), a network rejection, for the fallback "Unable to record weight.". The editor harness gains a host that owns a `useLaundryMutationLock`, exposes it to the test, and passes an `onPendingChange` spy. |
| 5 | Rules item 2's code block read as every owner's sequence, but the weighing editor's differs (refusal through `isHeld()` before validation). | The block is labelled as the three hooks' sequence and points to the table for the editor. |

## Revision 2.5 changes

From the review of the shared-lock section of revision 2.4 (decision **Revise before sign-off**, 2026-10-24). Everything else is unchanged.

| # | Review finding | Correction |
| --- | --- | --- |
| 1 | Rules item 2 said every owner acquires "before any state change", but the weighing editor's own table sets `attempted` and clears its failure before acquiring, and Rules item 4 requires validation before acquisition. | Item 2 now says every owner acquires before starting a mutation or changing mutation-related state, and that the weighing editor may make its existing validation-state updates first, provided it has already refused when the lock is held and never acquires for invalid input. The table and item 4 are unchanged. |
| 2 | Rules item 6 and decision d set the dialog's `confirming={lock.held}`. An unrelated mutation holding the lock would then disable Cancel and block dismissal of a confirmation that never started. | `confirming` now reflects only this dialog's own submission: a page state `submittingVerb`, set when the dialog's Confirm passes the lock check and calls `run`, and cleared when that `run` settles. While another owner holds the lock, the dialog stays cancellable and dismissible; its Confirm is refused by the synchronous `lock.isHeld()` check and sends nothing. #194's protection still applies once this dialog's own transition has started. Amendment item 4, the cross-section table, decision d, the Task 6 prop comment, the Task 7 wiring and the race-matrix note are updated to match, and Task 7 gains interaction case 12. |

## Revision 2.6 changes

From the M5 review of revision 2.5 (2026-10-24), which read race rows M7/M8 and interaction case 11 as offering Generate invoice on a status where it is not available.

| # | Review finding | Evidence | Correction |
| --- | --- | --- | --- |
| 1 | M7/M8 use `PAID` while expecting Generate invoice; the plan said generation is "only from `PRICED`". | Generation is legal on `PAID`. `INVOICEABLE` in `packages/web/src/laundry/laundry-order-actions.ts` is `PRICED`, `AWAITING_PAYMENT`, `PAID`, `PROCESSING`, `READY`, `AWAITING_PICKUP`, `AWAITING_DELIVERY`, `COMPLETED`; `generateInvoice` is allowed for `INVOICE` = FINANCE, TENANT_OWNER; `laundry-order-actions.test.ts` already pins `['PAID', 'PICKUP', 'FINANCE', ['generateInvoice', 'refund']]`. Laundry invoices spec §4.3 lists `PAID` as eligible, as does the #166 plan's global constraints. The sentence "generate only from `PRICED`" meant *from `PRICED` onward*, but read as *only at `PRICED`*. | M7, M8 and their lock-removal predictions are **unchanged** (they are valid). The coverage note now states the eligible statuses explicitly. A new [Race fixture eligibility](#race-fixture-eligibility) table lists, for each fixture, the verbs `laundryOrderActions` returns, so each row's two controls can be checked against the helper. |
| 2 | Case 11 sets B to `PAID` but expects both Start processing and Generate invoice. | As in row 1: TENANT_OWNER on `PAID` gets `startProcessing`, `generateInvoice`, `refund`; with no invoice the Invoice card's view is `generate`. | Case 11 is **unchanged**. Its step 1 now cites the eligibility table. |
| 3 | Check every other status/role/control combination against the eligibility rules. | Every race row, interaction case 1–12 and render case 1–8 checked against `LEGAL_VERBS`, `VERB_ROLES`, `INVOICEABLE` and the fulfillment filter. | No other contradiction found. |

The shared-lock contract and the revision 2.5 dialog behavior are unchanged.

**Correction (2026-10-25, revision 2.7).** Row 3's "No other contradiction found" was wrong. The [Race fixture eligibility](#race-fixture-eligibility) table that this revision added said it lists verbs in `LAUNDRY_ORDER_VERBS` order, but gave `reject` before `cancel` for `RECEIVED` / OPS_MANAGER and `WEIGHED` / OPS_MANAGER; `LAUNDRY_ORDER_VERBS` puts `cancel` first, as does `laundry-order-actions.test.ts` (`['RECEIVED', 'PICKUP', 'OPS_MANAGER', ['weigh', 'cancel', 'reject']]`). The revision 2.6 review missed it; the self-review of revision 2.6 found it (B1). Revision 2.7 corrects those two cells only. No fixture, case, prediction, mapping or contract text changes.

## Revision 2.8 changes

From the M5 review of revision 2.7 (2026-10-25): the race matrix assumed that two `.click()` calls inside one `act` both reach their handlers before React re-renders, but nothing in the plan proved it.

**Evidence inspected (source only; nothing run).**

- jsdom 29.1.1 (the version installed), `HTMLElement-impl.js` `click()`: `if (isDisabled(this)) { return; }`. A `.click()` on a disabled control dispatches nothing. So a second click that landed after a re-render had disabled its button would be **silently dropped**, and "the loser's mutation was not called" would pass without the lock ever being consulted.
- The existing same-`act` double-click tests (#162 interaction case 6, #166 interaction cases 2 and 9, the weighing editor's "sends one mutation for a double click") assert only the number of requests. Each is equally satisfied by a refused second click and by a dropped one, so none establishes that the second handler runs. The weighing harness's header comment says the two clicks "both land before React re-renders"; that is a statement, not a check.
- React and React DOM 19.2.8 are installed. That an update from a click inside `act` is not committed until the `act` callback returns is how React's act environment is expected to behave, but this plan has not demonstrated it in this harness.

**Corrections.**

| # | Change |
| --- | --- |
| 1 | New [race harness check H1](#race-harness-check-h1), a test in the interaction file that must pass before any race row counts. A test-only button whose handler counts calls and disables itself is clicked twice in one `act`; H1 asserts the handler ran twice and the button was still enabled between the clicks. If H1 fails, M6 stops and the race technique returns to M4. |
| 2 | New [lock probe](#lock-probe): the interaction file wraps the real `useLaundryMutationLock` (delegating every call and returning its real results) and logs each `tryAcquire` and `isHeld` call with its result. Each race row now asserts the exact lock records its race produced, so a lock-based refusal is shown directly and cannot be confused with a click that never reached its handler. |
| 3 | Race step 2 no longer claims the pre-race enabled check guarantees both handlers run. Race step 3 now asserts, inside the race `act` between the two clicks, that the second control is still not `disabled`, and counts native `click` events reaching it. Record weight is raced with `.click()` on its submit button (as the weighing harness already does), not `form.requestSubmit()`. |
| 4 | Each row gains its expected lock records ([Expected lock records](#expected-lock-records)). Rows M1 and M9 race two transitions; their loser is refused by the transition hook's own `inFlight` guard before it reaches the lock, so those two rows rely on H1 plus the between-clicks check, and say so. |
| 5 | The race-matrix note said a winning lifecycle verb is refused by "the other owner's own guard"; it is the other owner's lock check. Corrected. |
| 6 | The twelve pairings, the lock-removal predictions, the key-removal check and case 11 are unchanged. The [Execution risks](#execution-risks) entry on same-tick clicks now points to H1 instead of allowing an unrecorded alternative. |

**Correction (2026-10-25, revision 2.9).** Row 6's "the lock-removal predictions … are unchanged" was wrong, as was the matching sentence under the lock-removal table. Once every race row asserts its exact lock log, removing the transition hook's lock makes M1, M2 and M9 fail at the lock-log assertion even though their losers are still refused by the hook's own guard, and removing the dialog checks as well (run 5) makes M4 and M6 fail too; M11 and M12 (weigh against price) are unaffected by either run. The plan's author found this while sending the 2.8 diff for review. Revision 2.9 replaces the predictions; see [Revision 2.9 changes](#revision-29-changes).

## Revision 2.9 changes

From the M5 review of revision 2.8 (2026-10-25). The twelve pairings, the expected lock records for normal runs, case 11 and the key-removal check are unchanged.

| # | Review requirement | Change |
| --- | --- | --- |
| 1 | Keep the real lock probe for all five lock-removal runs | The probe stays in place for every run (unchanged from 2.8), and its log is recorded per row. |
| 2 | Keep exact expected-lock-record assertions for normal runs | Unchanged: step 4 still asserts the row's [expected lock records](#expected-lock-records). |
| 3 | Capture the actual log and both mutation counts even when an assertion fails first | Step 4 now begins by recording a **race observation** for the row (winner calls, loser calls and a copy of the lock log since the race began) before any assertion, and prints it as one tagged line. Its assertions then run with the mutation counts first, then the lock log, then the UI checks. |
| 4 | A row demonstrates the predicted failure only when both mutations are called | The [lock-removal check](#lock-removal-check) now judges each row by its recorded observation, in three outcome classes: **both called** (the only class that demonstrates missing lock participation), **refused, log as normal**, and **refused, log differs**. The predictions table gives every row's class per run, and the log for each "log differs" row. |
| 5 | Keep the stop-and-investigate rule | The evidence rule now compares each row's observed class and log with the prediction. Any difference, including an unexpected log or a test failure in any assertion other than the predicted one, stops M6, and is not counted as proof of lock participation. |
| 6 | H1's two-button variant checks the second button between clicks | It did not. Added: inside the `act`, after the first click, assert the second button is still not `disabled`. |
| 7 | Consistency | The 2.8 row-6 claim is corrected in a note under the 2.8 table rather than rewritten. The M1/M9 note under the expected lock records, the sentence under the lock-removal table, the evidence rule, the Task 8 gate line and the same-tick risk are updated. The two stray blank lines under "Steps" (noted in the 2.8 review) are removed. |

**Correction (2026-10-25, revision 2.10).** Row 3 says the observation records "winner calls, loser calls". For M9 both clicks are on the same Start processing button and send the same mutation, so one spy cannot say which click a call came from, and separate winner and loser counts do not exist. Revision 2.10 replaces those two fields with per-spy counts; see [Revision 2.10 changes](#revision-210-changes).

## Revision 2.10 changes

From the M5 review of revision 2.9 (2026-10-25). The twelve pairings, H1, the lock probe, the expected lock records, the lock-removal predictions, case 11 and the key-removal check are unchanged.

| # | Review requirement | Finding and change |
| --- | --- | --- |
| 1 | Identify M9's spy | M9 clicks Start processing twice, so both clicks call `useStartLaundryProcessingMutation`'s `vi.fn()` (one deferred list; Task 7 Step 2). One spy. |
| 2 | Can winner and loser counts be measured separately for every row? | No, not for M9. A new [Measurement per row](#measurement-per-row) table names each row's spy or spies. The other eleven rows use two different spies, one per control, so their counts are separate. M9 is the only row whose two attempts share a spy. |
| 3 | Define M9's observation | The observation now records `calls`, a map from each of the row's spies to its calls since the race began. For M9 that is one entry, and M9 is judged by its **total submitted** count: 1 means the second attempt was refused, 2 means both were submitted. The observation does not say which click caused a call. |
| 4 | Keep the three kinds of evidence distinct | Native click dispatch (the counter), submitted mutations (`calls`) and the lock log stay separate fields and separate assertions. For M9 the counter is on the one button, so it counts both clicks: expected 2. |
| 5 | Consistent schema, classes, predictions and evidence rule | Step 3, step 4, step 6, the outcome classes and the evidence rule now use `calls`. M9's lock-removal predictions are unchanged (runs 1–3 "refused, log as normal"; runs 4 and 5 "refused, log differs" with total 1), and are now stated in terms of its total. |
| 6 | Any other shared spy? | None: see the table. |

## Owner decisions (revision 1 review)

Given by the owner on 2026-10-24 and incorporated here.

| # | Decision | Where |
| --- | --- | --- |
| U1 | An Actions failure stays visible, including when another user may already have made the intended transition (ticket: "If the server rejects a button the helper showed, show the error."). Not #166 decision k. | Decision b; Task 7 interaction case 7 |
| U2 | The failed-role-query message is deferred. Actions keeps rendering nothing while `currentAdmin` is unresolved or failed. | Decision i; [Explicit deferrals](#explicit-deferrals) |
| U3 | Activity is last, after Actions, in the page and the nav. | Decision g |
| U4 | The label stays "Updated". | Decision h |
| U5 | A genuinely shared, synchronous page-level mutation guard; a derived flag that disables only after re-render is insufficient. | [Shared page mutation lock](#shared-page-mutation-lock) |

## Requirement check against the current code

Each ticket requirement, the code it rests on, and what this slice does. "Verified" means read on `main` at `e2e73e9` while drafting; nothing was executed.

| # | Ticket requirement | Current code (verified) | This slice |
| --- | --- | --- | --- |
| R1 | One button per helper verb, excluding `markAwaitingPayment`, `markPaid` (invoice card) and weigh/price (forms) | `laundryLifecycleVerbs` (`apps/web/lib/laundry-order-page.ts`) already drops `weigh`, `price`, `generateInvoice`, `markAwaitingPayment`, `markPaid`. Actions renders the rest as text (`ActionsBody`). | Buttons for the same list. No new filter. |
| R2 | Ten verbs and their labels | `actions.*` in `packages/web/src/i18n/messages/en/laundry.ts` matches every label in the ticket's table exactly. | Reuse. |
| R3 | Each verb has a mutation | `packages/client/src/operations/laundry.graphql`: `StartLaundryProcessing`, `MarkLaundryOrderReady`, `MarkLaundryOrderAwaitingPickup`, `MarkLaundryOrderAwaitingDelivery`, `CompleteLaundryOrder`, `CancelLaundryOrder`, `RejectLaundryOrder`, `MarkLaundryOrderLost`, `MarkLaundryOrderDamaged`, `RefundLaundryOrder`; each takes `LaundryOrderRefInput` (`{ orderId }`) and returns `...LaundryOrderDetail`. Generated hooks exist (the drawer uses them). | Reuse; send exactly `{ input: { orderId } }`. |
| R4 | Role and status visibility | `laundryOrderActions` (`packages/web/src/laundry/laundry-order-actions.ts`): `LEGAL_VERBS` ∩ `VERB_ROLES` ∩ fulfillment; role sets match `laundry-order.resolver.ts` `@Roles`. Every ticket role example holds: ANALYST → `[]`; CUSTOMER_SUPPORT on `RECEIVED` → `cancel` only; OPS_MANAGER on `RECEIVED` → `weigh`, `reject`, `cancel`; SCHEDULER on `PAID` → `startProcessing`; FINANCE on `PAID` → `refund`; OPS_MANAGER on `READY` + `DELIVERY` → `markAwaitingDelivery`; `REFUNDED`, `CANCELLED`, `REJECTED` → `[]`. | No change to the helper (ticket Out of scope). Page tests pin the rendered buttons. |
| R5 | Pickup/delivery exclusive | Helper filters by `fulfillmentType`; `READY` offers exactly one. | Pinned by page tests for both fulfillment types. |
| R6 | Forward, `Separator`, destructive | `LAUNDRY_DESTRUCTIVE_VERBS` = `cancel`, `reject`, `markLost`, `markDamaged`, `refund`, exactly the ticket's secondary set. `Separator` is exported from `@clensy/ui` (`packages/ui/src/index.ts`). The matrix offers at most **one** forward Actions verb per status. | `laundryActionGroups`. |
| R7 | Styles: forward `default`, destructive `secondary`; no new red style | `Button` variants: `default`, `destructive`, `ghost`, `link`, `outline`, `secondary`. | `default` and `secondary` only. `ConfirmDialog`'s own confirm button is `destructive` inside `@clensy/ui`; unchanged. |
| R8 | Empty: "No further actions for this order." | `noActions` exists and is rendered today. | Keep. |
| R9 | `ConfirmDialog` for the five destructive verbs, ticket copy | `confirm.*` holds the five sentences verbatim. `ConfirmDialog` takes `title`, `description`, `confirmLabel`, `confirming`; #194 keeps it open on Escape/backdrop/Cancel while `confirming`. `Modal` renders inline (no portal), so `renderToStaticMarkup` shows it. | Reuse; titles per decision e. |
| R10 | Non-destructive verbs run immediately | — | `onRun(verb)` on click. |
| R11 | One page-level pending flag; two verbs never in flight together; all mutation buttons disabled while pending | Four independent synchronous guards today: `useLaundryOrderTransition` (`inFlight` ref), `useConfirmLaundryPrice` (`inFlight` ref), `useGenerateLaundryInvoice` (`inFlight` ref), `LaundryWeighingEditor` (`inFlight` ref). Cross-disabling exists only between weigh and price (`disabled={confirmPrice.confirming}`, `weighing`), and it is render-time, not synchronous. A lifecycle verb in flight does not disable Generate; generating does not disable the payment buttons. | One page lock acquired synchronously by all four (U5). `lock.held` disables every mutation control. |
| R12 | Error in `role="alert"`: server message when present, else "Unable to {verb}." | `failure.*` copy exists for all ten verbs. `graphQLErrorMessage` extracts the server message. The transition hook keeps only `failure` (the verb). | Decision a: add `message`. |
| R13 | Toast on success | `success.*` exists for all ten; the hook already toasts `success.${verb}`. | Reuse. |
| R14 | No client state machine; refetch after success; show the server's error | The transition hook refetches the order on every outcome and keeps no status. | Unchanged. |
| R15 | Activity: created, updated, current status; label "Activity"; add `updatedAt` to the detail fragment | `LaundryOrderRow` (spread into `LaundryOrderDetail`) selects `createdAt` only. `LaundryOrder.updatedAt: DateTime!` exists in `schema.gql`; the entity uses `@UpdateDateColumn`. `LAUNDRY_ORDER_SECTIONS` has no `activity`. | Tasks 1, 3, 7. |
| R16 | No audit API; no invented timeline | No GraphQL query reads audit rows. | None added; a test pins that Activity names no audit action. |
| R17 | Payment and operational verbs separate | #166 renders the payment verbs in the Order payment card and narrows `failure` through `laundryPaymentFailureAlert`. | Actions never renders a payment verb; each card shows only its own failures (decision b). |

## Shared page mutation lock

### Entry points traced

Every control on `/app/laundry/<id>` that sends a mutation, on `main` at `e2e73e9`:

| Owner | Entry point | Mutation | Guard today | Release today | Refetch |
| --- | --- | --- | --- | --- | --- |
| `weigh` | `LaundryWeighingEditor` `handleSubmit` (form submit) | `weighLaundryOrder` | own `inFlight` ref, taken after validation | `finally`, after the success refetch; the failure path returns early inside `try` (no refetch), and `finally` still runs | `onRecorded` (order), success only |
| `price` | `PriceBody` → `useConfirmLaundryPrice.confirm` (Confirm price button) | `priceLaundryOrder` | own `inFlight` ref | `finally`, after the refetch | order, on every outcome |
| `generateInvoice` | `LaundryInvoiceCard` → `useGenerateLaundryInvoice.generate` (Generate button) | `generateInvoiceFromOrder` | own `inFlight` ref | `finally`, after the refetch | invoice, on every outcome |
| `transition` | `LaundryOrderPaymentCard` (Mark paid, Mark awaiting payment) and, in this slice, `LaundryOrderActions` (forward buttons; destructive dialog Confirm) → `useLaundryOrderTransition.run` | the 2 payment and 10 lifecycle mutations | own `inFlight` ref | `finally`, after the refetch | order, on every outcome |

There is no other mutation on the page: Services sends only the `previewLaundryOrderPrice` **query**, which is not a mutation and stays outside the lock (its staleness handling under `weighing` is unchanged).

### Interface

```ts
export type LaundryMutationOwner = 'generateInvoice' | 'price' | 'transition' | 'weigh';

// A new object per successful acquire. `owner` is for debugging and tests;
// release compares the object, never the owner.
export interface LaundryMutationLease {
  readonly owner: LaundryMutationOwner;
}

export interface LaundryMutationLock {
  // Synchronous. When no lease is held, takes the lock and returns a new,
  // unique lease; otherwise returns null and changes nothing.
  tryAcquire: (owner: LaundryMutationOwner) => LaundryMutationLease | null;
  // Releases only when `lease` is the current holder (identity check);
  // a stale, foreign or repeated release is a no-op.
  release: (lease: LaundryMutationLease) => void;
  // Synchronous read of the ref, for event handlers that must refuse
  // before changing any state.
  isHeld: () => boolean;
  // Render state: true from a successful `tryAcquire` until its `release`.
  // For disabling controls only; never the exclusion itself.
  held: boolean;
}

export function useLaundryMutationLock(): LaundryMutationLock;
```

Implementation: a `useRef<LaundryMutationLease | null>` holder and a `useState<boolean>` mirror. `tryAcquire` returns `null` if the ref is set; otherwise it creates `{ owner }`, stores it in the ref, calls `setHeld(true)` and returns it. `release(lease)` returns unless `ref.current === lease`; then it clears the ref and calls `setHeld(false)`. `isHeld` is read only inside event handlers and async functions, never during render (react-hooks lint rules).

### Rules

1. **One lock per order workspace.** `LaundryOrderWorkspace` calls `useLaundryMutationLock()` before any mutation hook. The workspace is keyed by order id, so another order starts unlocked. See [Per-order isolation](#per-order-isolation).
2. **Every owner acquires the lock before starting a mutation or changing mutation-related state** (its pending flag, its failure state, its request). The weighing editor may make its existing validation-state updates (`attempted`, clearing its failure) before acquiring, provided it has first refused when the lock is held and never acquires for invalid input (#155). At its existing guard point, before the first `await`, each of the three hooks does the following (the weighing editor's sequence is in the table below):

   ```ts
   if (inFlight.current) return;
   const lease = lock ? lock.tryAcquire(owner) : undefined;
   if (lease === null) return; // refused: nothing changed, nothing to release
   inFlight.current = true;
   // …existing pending/failure updates, then `try { … } finally { …; if (lease) lock.release(lease); }`
   ```

   A refused attempt returns before its `try`, so it never reaches a `release`, sends no request, shows no toast, runs no refetch, and changes neither its pending flag nor its failure state (it never clears an earlier failure).

   Order of operations per owner (each line runs synchronously, in one event-handler segment, before the first `await`):

   | Owner | 1. Refusal checks | 2. Validation | 3. Acquire | 4. Then, as today |
   | --- | --- | --- | --- | --- |
   | `useLaundryOrderTransition.run` | `inFlight.current` | — | `tryAcquire('transition')`; `null` → return | `inFlight = true`, `setPending(true)`, `setFailure(null)`, `setMessage(null)`, `try` |
   | `useConfirmLaundryPrice.confirm` | `inFlight.current` | — (`PriceBody` already requires `ready && priceInput` before calling) | `tryAcquire('price')`; `null` → return | `inFlight = true`, `setConfirming(true)`, `setFailure(null)`, `try` |
   | `useGenerateLaundryInvoice.generate` | `inFlight.current` | — | `tryAcquire('generateInvoice')`; `null` → return | `inFlight = true`, `setGenerating(true)`, `setFailed(false)`, `try` |
   | `LaundryWeighingEditor.handleSubmit` | `event.preventDefault()`; then `inFlight.current \|\| disabled \|\| lock?.isHeld()` → return | `setAttempted(true)`, `setFailure(undefined)`, `summarizeWeightEntries`; a blocked submit returns here, holding nothing | `tryAcquire('weigh')`; `null` → return | `inFlight = true`, `setPending(true)`, `onPendingChange(true)`, `try` |

   The weighing editor keeps validation before acquisition (#155): a blocked submit never takes the lock. Its refusal therefore happens at step 1, through `isHeld()`, before `setAttempted` or `setFailure`, so a refused submit changes no state. Steps 1 to 3 run in one synchronous segment with no `await` and no other handler in between, so when step 1 found the lock free, step 3's `tryAcquire` cannot return `null`; the `null` check stays as a defensive return and is unreachable in practice. Without a `lock` (existing callers), each owner behaves exactly as today.
3. **Only the acquiring invocation releases, and it always does.** The lease is a local `const` of the invocation that acquired it, declared before its `try`; the only `release` call is in that `try`'s `finally`, guarded by `if (lease)`. That `finally` runs after the mutation and the refetch that follows it have settled, on: mutation success; each failure outcome (rejection, resolved GraphQL `errors`, missing payload); a rejected refetch (already caught inside the `try`); and the weighing editor's early-return failure path (a `return` inside the `try`, so `finally` runs). No other code path calls `release`. Because release compares lease identity, even a bug that released twice, or released another invocation's lease, could not free a lock held by someone else.
4. **Validation happens before acquiring.** The weighing editor's blocked submit (invalid rows) returns before `tryAcquire` and never holds the lock. Price's `PriceBody` sends only when `ready && priceInput`, also before `confirm`.
5. **Unmount.** The lock lives in the workspace, not in a section. If a section unmounts mid-flight (for example the order refetch fails and the page shows its error state), the owner's pending promise still reaches `finally` and releases the workspace's lock; state setters on an unmounted component are no-ops in React 19. If the workspace itself unmounts (navigation to another order), see [Per-order isolation](#per-order-isolation).
6. **Opening a confirmation is not a mutation, and the page lock does not lock the dialog.** A destructive button opens `ConfirmDialog` only when `!lock.isHeld()` (synchronous check in the handler). The dialog's `confirming` prop reflects **only this dialog's own submission**, never `lock.held`:
   - Confirm checks `lock.isHeld()` synchronously. If the lock is free, it sets `submittingVerb` to the verb, calls `transition.run(verb)` (which acquires the lock in the same synchronous segment), and, when `run` settles, clears `submittingVerb` and closes the dialog. While `submittingVerb` is set, `confirming` is true, so #194 disables Confirm and Cancel and ignores Escape and the backdrop.
   - If the lock is held by another owner when Confirm is pressed, Confirm sends nothing and changes nothing (refusal, rule 2); `submittingVerb` stays `null`, so the dialog stays open, **Cancel, Escape and the backdrop still close it**, and Confirm can be pressed again once the holder releases.
   - A dialog whose verb is no longer in the refetched helper list is not rendered (decision d).
7. **Exclusion claim.** The page passes the same lock to all four owners. Mutual exclusion is claimed only for that wiring, and it is proven by the [race matrix](#race-matrix), which drives the real page, hooks and editor. A hook or editor used without a lock (its existing tests, any other screen) behaves exactly as today: its own `inFlight` guard only.
8. **Own guards stay.** Each owner keeps its `inFlight` ref. With the lock present it is redundant, but it keeps every existing same-hook double-run test and any lock-less use unchanged.

### Per-order isolation

**Mount path, traced on `main` at `e2e73e9`.** `/app/laundry/[id]` is `apps/web/app/app/laundry/[id]/page.tsx`. Above it is only `apps/web/app/app/layout.tsx` (no `layout.tsx` or `template.tsx` under `laundry/` or `[id]/`), and that layout persists across navigations. So moving from `/app/laundry/A` to `/app/laundry/B` may keep the route's page component mounted; the plan does not rely on Next.js remounting it. The page component is:

```tsx
export default function LaundryOrderPage() {
  const { id } = useParams<{ id: string }>();
  // A new key per order, so moving between orders starts fresh.
  return <LaundryOrderWorkspace key={id} id={id} />;
}
```

`LaundryOrderPage` holds no state and calls no hook other than `useParams`. Every query, hook and piece of state is inside `LaundryOrderWorkspace`.

**Requirement.**

1. `key={id}` stays on `<LaundryOrderWorkspace>`, where `id` is the same `useParams` value passed as its `id` prop. The key changes exactly when the order changes, so React unmounts A's workspace and mounts a new one for B.
2. `useLaundryMutationLock()` is called inside `LaundryOrderWorkspace`, the keyed component, and **nowhere above it** (not in `LaundryOrderPage`, the layout, or a context provider). So each mounted workspace, and only it, owns its lock.
3. No component above the key holds a lock, a lease, `confirmVerb` or any mutation state.

**Why A cannot release or block B.** A's pending invocation closed over the `lock` object from A's workspace render (the handler captures the hook options of the render that created it, and that render belongs to A's workspace) and over its own lease from A's lock. Its `finally` calls `release(lease)` on A's lock object, which compares against A's holder ref. B's workspace has a different `useRef`, so B's holder is never compared, read or written by A's invocation. B's lock starts with an empty ref and `held === false`, so nothing A does before or after the switch blocks B.

**Proof.** Task 7 interaction case 11 and the [key-removal check](#key-removal-check).

### Amendment to the #166 guard contract

The [#166 contract](2026-10-24-laundry-invoice-payment-plan.md#shared-in-flight-guard-contract) items, as amended. M5 accepting this plan accepts these changes; the #166 plan text is not edited (it is a merged, Accepted record), and this section is the authority for the amended items.

| Item | #166 text (summary) | Amended | Why |
| --- | --- | --- | --- |
| 1 | One instance per order page, created in `LaundryOrderWorkspace` | Unchanged; the workspace also creates the page lock and passes it in. | — |
| 2 | `run(verb)` takes the guard synchronously; a call while held is dropped | `run(verb)` takes its own ref **and** the page lock synchronously; a call while **either** is held is dropped with no state change (rule 2). | U5 |
| 3 | `pending` true from `run` until the refetch settles | Unchanged. `pending` is still true only for a transition. | — |
| 4 | Every lifecycle-verb control calls `run` and is disabled while `pending` | Every lifecycle-verb **button** (the Actions buttons and the two payment buttons) calls `run` and is disabled while **`lock.held`** (true whenever `pending` is, and also while weigh, price or generate run). The destructive dialog's Confirm calls `run` only after a synchronous `lock.isHeld()` check and is disabled only while its own submission runs (rule 6), so an unrelated mutation never makes an unsubmitted confirmation impossible to cancel. | U5: no second mutation can start; #194 still protects a started confirmation |
| 5 | `failure` is the last failed verb; cleared when the next `run` starts; sections narrow it | Unchanged in shape and timing. A **refused** `run` does not clear it. Narrowing per decision b. New sibling field `message` (decision a). | R12; rule 2 |
| 6 | The verb union is the extension point | Widened to the ten Actions verbs, as #166 anticipated. | #165 |
| 7 | Generate, price and weigh are **not under this guard**; each keeps its own guard and is not routed through the hook | Generate, price and weigh are still **not routed through the transition hook** and keep their own hooks, guards, pending flags and failure displays. **Each also acquires the page lock.** | U5 |

`run`'s signature is unchanged: `(verb: LaundryTransitionVerb) => Promise<void>`. A refused `run` resolves immediately.

#### Unchanged by the amendment

The amendment changes only *when a mutation may start* and *when controls are disabled*. These #166 behaviors are not changed, and the existing #166 tests that pin them stay as they are:

- **Decision k, payment-alert suppression:** `laundryPaymentFailureAlert` is not edited. A payment failure is hidden only when the refetched status confirms the intended outcome (`markPaid` → `PAID`; `markAwaitingPayment` → `AWAITING_PAYMENT` or `PAID`), and is otherwise kept. The page only adds a narrowing step before it (`isLaundryPaymentVerb`), so a lifecycle verb in `failure` reaches it as `null`, exactly as `null` reaches it today.
- **F1–F10 in the #166 plan:** generate success and failure, the conflict refetch that shows another user's invoice, the invoice refetch failure, payment success and failure, the order refetch failure. The lock adds no branch to any of them; it only refuses a start.
- **The generate alert** renders only in the `generate` view (decision k / F4), from `useGenerateLaundryInvoice.failed`, which the lock does not touch.
- **Invoice and payment semantics:** generating creates an `UNPAID` invoice with the chosen terms only; marking paid or awaiting payment changes the order status only; nothing records a payment or changes `Invoice.paymentStatus` / `amountPaidMinorUnits` (invoices spec §2, #39); the generate input is exactly `{ laundryOrderId, paymentTerms }`; the payment verbs send exactly `{ input: { orderId } }`.
- **`pending` and `failure`:** same types, same timing; `failure` is still cleared when the next *started* `run` begins.
- **Copy:** the payment card's failure text stays `failure.${verb}`; it does not read `message`.

**Compatibility.** `UseLaundryOrderTransitionOptions`, `UseConfirmLaundryPriceOptions`, `UseGenerateLaundryInvoiceOptions` and `LaundryWeighingEditorProps` each gain an **optional** `lock?: LaundryMutationLock`. Without it, behavior is unchanged, so every existing hook and editor test passes untouched. `LaundryOrderTransitionState` gains `message`; its other fields keep their shape. Visible behavior changes on the order page are listed in [Cross-section behavior](#cross-section-behavior).

### Cross-section behavior

What each existing owner shows when the lock coordinates it. "Accepted" cites the slice that set the current behavior.

| Owner | Own pending display | Disabled while another owner holds the lock | Failure display | Deviation from Accepted behavior |
| --- | --- | --- | --- | --- |
| Weighing editor | `pending` locks its controls; focus returns to Record weight after its own save (unchanged); `onPendingChange` still drives Price's `weighing` staleness (#162, unchanged) | `disabled={lock.held}` replaces `disabled={confirmPrice.confirming}` (price holds the lock, so this is a superset). A submit is refused by `lock.isHeld()` before `setAttempted`, so no validation errors appear from a refused submit. | Its own server-message alert (#155), unchanged. Not cleared by other owners. | Also disabled while a transition or generate runs (previously only while price confirmed). |
| Price card | `confirming` shows "Confirming…" (unchanged) | Estimate card gains `disabled?: boolean`; Confirm uses `!ready \|\| confirming \|\| disabled`; the page passes `disabled={lock.held}`. Estimate state and rows unchanged. | Its own alert, scoped to the selection (#162 decision e), unchanged. | Also disabled while a transition or generate runs (previously only while weighing). |
| Services editor | — (sends no mutation) | Unchanged: `disabled={confirmPrice.confirming}` (#162 owner decision 6.3). | — | None. Not a lock participant (decision c). |
| Invoice card | `generating` shows "Generating…" (unchanged) | Gains `disabled?: boolean`; Generate and the terms control use `generating \|\| disabled`; the page passes `disabled={lock.held}`. | "Unable to generate invoice." in the `generate` view only (#166 decision k / F4), unchanged. | Also disabled while weigh, price or a transition runs. |
| Order payment card | — (no pending text) | `pending={lock.held}` instead of `transition.pending`. | `laundryPaymentFailureAlert(isLaundryPaymentVerb(failure) ? failure : null, status)`: payment failures only, decision k unchanged. A lifecycle failure never shows here. | Also disabled while weigh, price or generate runs. |
| Actions | — | `disabled={lock.held}` on every button. The dialog's `confirming` is `submittingVerb !== null` (its own submission only); while another owner holds the lock the dialog stays cancellable and its Confirm is refused (rule 6). | `laundryActionFailure(failure, message)`: lifecycle failures only, kept until the next `run` starts (U1). A payment failure never shows here. | New. |

Because `failure` is one field, a new `run` of any transition clears both the payment card's and Actions' alert (contract item 5, unchanged). A refused `run` clears nothing.

## Planning decisions for M5 to confirm

**(a) The hook gains `message`; `failure` keeps its shape.** `message: string | null` is the server's message for the failed run: `graphQLErrorMessage(error)` for a rejection, `graphQLErrorMessage({ graphQLErrors: result.errors })` for a resolved result with errors, `null` for a missing payload or a network failure. It is set with `failure` and cleared with it when the next `run` starts. The Order payment card keeps its Accepted #166 copy and does not read `message`.

**(b) Two failure readers, one hook.**
- Order payment card: `laundryPaymentFailureAlert(isLaundryPaymentVerb(failure) ? failure : null, status)` (unchanged decision k).
- Actions: `laundryActionFailure(failure, message)` returns `LaundryActionFailure | null`, where `LaundryActionFailure = { verb: LaundryActionVerb; message: string | null }`: `null` for `null` or a payment verb, otherwise `{ verb: failure, message }`. The component renders `failure.message ?? t(\`failure.${failure.verb}\`)` in `role="alert"`. It is shown whatever the refetched status (U1), until the next `run` starts.

**(c) Lock participants.** Exactly the four mutation owners in [Entry points traced](#entry-points-traced). The Services editor and the price preview query are not participants: they send no mutation.

**(d) Confirm dialog is controlled by the page.** `confirmVerb: LaundryActionVerb | null` lives in `LaundryOrderWorkspace` (keyed by order id). A destructive button sets it only when `!lock.isHeld()` and sends nothing. The page passes `confirmVerb` to the component only while it is in `laundryActionGroups(verbs).destructive`; otherwise the dialog is not rendered (a refetch that removes the verb hides it). A second page state, `submittingVerb: LaundryActionVerb | null`, is set only by the dialog's Confirm. Confirm: `if (lock.isHeld()) return; setSubmittingVerb(verb); try { await transition.run(verb); } finally { setSubmittingVerb(null); setConfirmVerb(null); }`, so the dialog closes after its own `run` settles, on success and failure alike (the failure shows in Actions); `run` catches every failure itself, so the `finally` is for clarity, not error handling. `confirming={submittingVerb !== null}`. Cancel / Escape / backdrop call `setConfirmVerb(null)`; #194 ignores them only while `confirming`, that is, only while this dialog's own transition runs.

**(e) Dialog titles.** The ticket gives Cancel's title only: "Cancel order", which is `actions.cancel`. All five use `actions.${verb}` as title and confirm label. No new copy.

**(f) Server messages are shown as returned.** For an illegal transition the server's message is `Laundry order cannot transition from ${from} to ${to}` (`laundry-order-status-transition-policy.ts`), with enum names. Rewording would change the server; out of scope.

**(g) Activity is the last section (U3).** `LAUNDRY_ORDER_SECTIONS` becomes `overview, weighing, services, price, invoice, actions, activity`. `currentLaundryOrderSection` never returns `activity`.

**(h) Activity body (U4).** A `dl` with "Created", "Updated" and "Status" (`StatusBadge` with `LAUNDRY_STATUS_TONE`). Times use the list's rule: `new Date(value).toLocaleString()`, falling back to the raw value when unparsable (`formatCreatedAt` in `laundry-order-data-table.tsx`), through a new `formatLaundryOrderTime` in `apps/web/lib/laundry-order-page.ts`, so the list file stays untouched. No list element and no audit action name. Activity renders whatever the role.

**(i) The role query (U2).** Unchanged: while `currentAdmin` is unresolved or failed, Actions renders nothing.

**(j) A refused attempt is silent.** A click refused by the lock sends nothing and shows nothing (no toast, no alert), as every existing guard drops a double click today. The control is disabled on the next render.

**(k) Characterization tests: none.** Every new test fails before its task's implementation: the lock, `message`, the ten verbs, the lock option on each owner, the buttons, the dialog, Activity and the race matrix do not exist yet. Existing tests are kept; the ones whose assertions change are listed in Task 7. The [lock-removal check](#lock-removal-check) and the [key-removal check](#key-removal-check) are deliberate break runs, made outside the commit, that prove the race matrix depends on each owner's lock participation and that case 11 depends on the workspace key; they use the characterization-break procedure but label no test as a characterization test.

## Remaining unresolved decisions

**None blocking.** The owner's U1–U5 answer every open question raised in revision 1. One item needs explicit owner sign-off at M5, but it is a gate item, not an open design question: accepting the [amendment to the #166 guard contract](#amendment-to-the-166-guard-contract), which changes an Accepted plan's client contract and makes the payment buttons, Generate, Confirm price and the weighing editor disabled during any other page mutation.

## Global constraints

- SHALL NOT add or call any mutation other than the ten Actions mutations plus the existing weigh, price, generate and payment mutations (ticket; §8.4.4).
- SHALL send each Actions mutation exactly `{ input: { orderId } }`.
- SHALL derive every button from `laundryOrderActions(order.status, order.fulfillmentType, role)` through `laundryLifecycleVerbs`. SHALL NOT add a second role or status table, and SHALL NOT change `laundryOrderActions`, `LEGAL_VERBS`, `VERB_ROLES` or any API role (ticket Out of scope).
- SHALL NOT render a disabled button for an illegal verb; upcoming steps stay in `LaundryOrderProgress` only. (Disabling a legal button while the lock is held is not this.)
- SHALL NOT render `markPaid` or `markAwaitingPayment` in Actions, nor an Actions verb in the Order payment card.
- SHALL NOT call a destructive mutation before Confirm.
- SHALL route every page mutation through the shared lock: weigh, price, generate, and every transition. SHALL NOT start a mutation while the lock is held.
- SHALL NOT keep a client status, optimistic update or second state machine: the page shows the refetched order only.
- SHALL NOT add an audit-log query, field or timeline; SHALL NOT label anything "History".
- SHALL use only `Button` variants `default` and `secondary` for the new buttons.
- SHALL NOT edit `apps/web/app/app/laundry/page.tsx`, `apps/api`, or `packages/ui`.
- SHALL NOT record a payment or change `Invoice.paymentStatus` (invoices spec §2; #39).
- Role names: the code uses `TENANT_OWNER`; there is no `OWNER` role.

New copy (`packages/web/src/i18n/messages/en/laundry.ts`), all under `order`:

| Key | Text |
| --- | --- |
| `order.sections.activity` | Activity |
| `order.activity.created` | Created |
| `order.activity.updated` | Updated |
| `order.activity.status` | Status |

Reused copy: `actions.*` (labels and dialog titles), `confirm.*` (dialog sentences), `success.*` (toasts), `failure.*` (fallback alert), `noActions`. `order.actions.available` ("Available to your role:") is removed with the text list.

## File map

| File | Change | Task |
| --- | --- | --- |
| `packages/client/src/operations/laundry.graphql` | `updatedAt` in `LaundryOrderDetail` | 1 |
| `packages/client/src/generated/graphql.ts` | Regenerate: `pnpm --filter @clensy/client codegen` | 1 |
| `packages/client/src/laundry-operations.test.ts` | Two cases | 1 |
| `apps/web/lib/use-laundry-mutation-lock.ts`, `.hook.test.tsx` | New | 2 |
| `apps/web/lib/laundry-order-lifecycle-actions.ts`, `.test.ts` | New pure module | 3 |
| `apps/web/lib/laundry-order-page.ts`, `.test.ts` | `activity` section, `formatLaundryOrderTime` | 3 |
| `packages/web/src/i18n/messages/en/laundry.ts` | Activity keys (Task 3); drop `order.actions.available` (Task 7) | 3, 7 |
| `apps/web/lib/use-laundry-order-transition.ts`, `.hook.test.tsx` | Ten verbs, `message`, lock | 4 |
| `apps/web/lib/use-confirm-laundry-price.ts`, `.hook.test.tsx` | Optional lock | 5 |
| `apps/web/lib/use-generate-laundry-invoice.ts`, `.hook.test.tsx` | Optional lock | 5 |
| `apps/web/components/laundry/laundry-weighing-editor.tsx` | Optional lock | 5 |
| `apps/web/lib/laundry-weighing-editor.interaction.test.tsx` | Lock cases | 5 |
| `apps/web/components/laundry/laundry-order-actions.tsx` | New component | 6 |
| `apps/web/lib/laundry-order-actions.render.test.tsx` | New | 6 |
| `apps/web/components/laundry/laundry-invoice-payment.tsx` | `disabled` prop on `LaundryInvoiceCard` | 7 |
| `apps/web/components/laundry/laundry-price-card.tsx` | `disabled` prop on the estimate card | 7 |
| `apps/web/app/app/laundry/[id]/page.tsx` | Lock, Actions, dialog, Activity | 7 |
| `apps/web/lib/laundry-order-page.render.test.tsx`, `.interaction.test.tsx` | New and changed cases, race matrix with harness check H1 and the lock probe, order-switch isolation case | 7 |
| `apps/web/app/app/laundry/[id]/page.tsx` (`LaundryOrderPage`) | Not edited: `key={id}` already present; required to stay | 7 |

## Task order and dependencies

1 → (2, 3 in either order) → 4 (needs 2 and 3) → 5 (needs 2) → 6 (needs 3) → 7 (needs all; its isolation case 11 needs 2 and 4) → 8 (the lock-removal and key-removal checks need 7).

## Tasks

### Task 1: Select `updatedAt` on the order detail

**Type:** `code`. **Traces to:** ticket "There is no order-history API"; §8.4.4 workspace bullet.

- [ ] **Step 1: Write the failing tests** in `packages/client/src/laundry-operations.test.ts`, using the file's `visit` helpers: `LaundryOrderDocument`'s `laundryOrder` selection includes `updatedAt`; `LaundryOrdersDocument` (the list) does **not** select `updatedAt`.
- [ ] **Step 2: Run.** `pnpm --filter @clensy/client exec vitest run src/laundry-operations.test.ts` — Expected: FAIL (no `updatedAt`).
- [ ] **Step 3: Edit** `fragment LaundryOrderDetail` to select `updatedAt` after `...LaundryOrderRow`. Run `pnpm --filter @clensy/client codegen`.
- [ ] **Step 4: Run** the same command — Expected: PASS. Then `pnpm --filter @clensy/client build` — Expected: exit 0.

### Task 2: The page mutation lock

**Type:** `code`. **Traces to:** ticket "In flight and errors" ("Two verbs cannot be in flight together"); U5; [Shared page mutation lock](#shared-page-mutation-lock).

- [ ] **Step 1: Write the failing hook test** `apps/web/lib/use-laundry-mutation-lock.hook.test.tsx` (jsdom Probe, as `use-laundry-order-transition.hook.test.tsx`):
  1. Starts unheld: `held` false, `isHeld()` false.
  2. `tryAcquire('weigh')` returns a lease with `owner: 'weigh'`; `isHeld()` true at once (same tick, before re-render); `held` true after re-render.
  3. A second `tryAcquire`, for every other owner and for the same owner, returns `null` while held, in the same tick as the first, and the first lease still holds.
  4. Foreign release: a lease-shaped object that was never returned (`{ owner: 'weigh' }`) does not release.
  5. Release frees: `release(first)` → `isHeld()` false at once; `held` false after re-render.
  6. Stale and double release: acquire A, release A, acquire B; then `release(A)` and a second `release(A)` leave B holding (`isHeld()` true).
  7. Each successful acquire returns a distinct object (A !== B even for the same owner).
  8. Two Probe instances have independent locks.
- [ ] **Step 2: Run.** `pnpm --filter web exec vitest run lib/use-laundry-mutation-lock.hook.test.tsx` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** per the [Interface](#interface).
- [ ] **Step 4: Run** the same command — Expected: PASS. Then `pnpm --filter web lint` — Expected: exit 0 (no ref read during render).

### Task 3: Pure module, sections and copy

**Type:** `code`. **Traces to:** ticket "Actions", "Layout", "Activity"; R1, R6, R15, R17; decisions b, g, h.

**Interfaces (produces), `apps/web/lib/laundry-order-lifecycle-actions.ts`:**

```ts
import type { LaundryOrderVerb } from '@clensy/web';
import type { LaundryPaymentVerb } from './laundry-invoice-payment';

export type LaundryActionVerb =
  | 'cancel' | 'complete' | 'markAwaitingDelivery' | 'markAwaitingPickup' | 'markDamaged'
  | 'markLost' | 'markReady' | 'refund' | 'reject' | 'startProcessing';

export interface LaundryActionFailure {
  verb: LaundryActionVerb;
  message: string | null; // the server's message, or null for the catalog fallback
}

export function isLaundryPaymentVerb(verb: LaundryActionVerb | LaundryPaymentVerb | null): verb is LaundryPaymentVerb;
export function laundryActionGroups(verbs: readonly LaundryOrderVerb[]): { destructive: LaundryActionVerb[]; forward: LaundryActionVerb[] };
export function laundryActionFailure(failure: LaundryActionVerb | LaundryPaymentVerb | null, message: string | null): LaundryActionFailure | null;
```

`laundryActionGroups` applies `laundryLifecycleVerbs` first, then splits on `LAUNDRY_DESTRUCTIVE_VERBS`, keeping `LAUNDRY_ORDER_VERBS` order. This module does not import the transition hook (the hook imports it), so there is no cycle.

- [ ] **Step 1: Write the failing tests.** `laundry-order-lifecycle-actions.test.ts`:
  - groups from fixture verb lists: `['startProcessing', 'refund']` → forward `[startProcessing]`, destructive `[refund]`; `['weigh', 'reject', 'cancel']` → forward `[]`, destructive `[cancel, reject]`; `['markPaid', 'markAwaitingPayment', 'cancel']` → no payment verb in either group; `['generateInvoice', 'price']` → both empty; `[]` → both empty.
  - `laundryActionFailure`: `null` → `null`; `'markPaid'` / `'markAwaitingPayment'` → `null`; `('cancel', 'Server says no')` → `{ verb: 'cancel', message: 'Server says no' }`; `('markReady', null)` → `{ verb: 'markReady', message: null }`.
  - `isLaundryPaymentVerb`: true for the two payment verbs only; false for `null` and each Actions verb.
  In `laundry-order-page.test.ts`: the sections list has seven entries ending in `activity`; `currentLaundryOrderSection` never returns `activity` (existing cases unchanged); `formatLaundryOrderTime` returns `toLocaleString()` for an ISO string and the raw value for an unparsable one.
- [ ] **Step 2: Run.** `pnpm --filter web exec vitest run lib/laundry-order-lifecycle-actions.test.ts lib/laundry-order-page.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**, and add the four Activity keys to `laundry.ts`. Update the `LAUNDRY_ORDER_SECTIONS` comment.
- [ ] **Step 4: Run** the same command — Expected: PASS. Then `pnpm --filter @clensy/web test && pnpm --filter @clensy/web build` — Expected: pass. `pnpm --filter web exec tsc --noEmit` may report the render test's section count; record it and fix in Task 7.

### Task 4: Widen the transition hook and join the lock

**Type:** `code`. **Traces to:** §8.4.4 action bullet; ticket "In flight and errors"; amended contract items 2–7; decision a.

**Interfaces (produces):**

```ts
export type LaundryTransitionVerb = LaundryPaymentVerb | LaundryActionVerb;
export interface UseLaundryOrderTransitionOptions {
  orderId: string;
  refetch: () => Promise<unknown>;
  lock?: LaundryMutationLock; // new, optional
}
export interface LaundryOrderTransitionState {
  run: (verb: LaundryTransitionVerb) => Promise<void>;
  pending: boolean;                      // unchanged
  failure: LaundryTransitionVerb | null; // unchanged shape
  message: string | null;                // new
}
```

- [ ] **Step 1: Extend the hook test** (`use-laundry-order-transition.hook.test.tsx`), keeping every #166 case unchanged (they run without a lock). Mock the ten new mutation hooks. Add:
  - Parameterized over all twelve verbs (`[verb, mutationField, toast]`): (1) sends exactly `{ variables: { input: { orderId } } }` to that verb's mutation and no other; (2) success: toast text, `failure` and `message` `null`, `pending` true until the refetch settles; (3) each of the five `OUTCOMES`: no toast, `failure === verb`, refetch once, `pending` false after.
  - `message`: rejection with `graphQLErrors[0].extensions.originalError.message` → that text; resolved `errors: [{ message }]` → that text; network `Error` → `null`; missing payload → `null`; cleared with `failure` when the next `run` starts.
  - Own guard: a second `run` with a **different** verb while the first is pending sends nothing.
  - With a lock (Probe also holds `useLaundryMutationLock`): (L1) `run` acquires as `transition`: `lock.isHeld()` true synchronously after calling `run`, before any await resolves; (L2) held until the refetch settles, released after: success; each failure outcome; a rejected refetch; (L3) lock pre-acquired by the test as `weigh` (its lease kept by the test): `run` sends no request, does not toast, does not refetch, `pending` stays false, an existing `failure`/`message` from an earlier run is **not** cleared, and after the refused `run` promise resolves the lock is **still held** by the test's lease; (L4) after the test releases its lease, `run` proceeds; (L5) the same with the lock pre-acquired as `transition` by the test (same owner name, different lease): the refused `run` still does not release it.
- [ ] **Step 2: Run.** `pnpm --filter web exec vitest run lib/use-laundry-order-transition.hook.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement.** One mutation hook per verb; a map from verb to `{ mutate, field }` replaces the `if` in `send`, keeping the success test `(result.errors?.length ?? 0) === 0 && Boolean(result.data?.[field])`. `send` returns `{ ok: true } | { ok: false; message: string | null }`, via `graphQLErrorMessage` as `useConfirmLaundryPrice` does. In `run`: the guard sequence of [Rules](#rules) item 2 with owner `transition`; the existing body inside `try`; `finally` adds `if (lease) lock.release(lease)`. Update the file's comments.
- [ ] **Step 4: Run** the same command — Expected: PASS. Then `pnpm --filter web exec tsc --noEmit` — Expected: exit 0.

### Task 5: Price, generate and weigh join the lock

**Type:** `code`. **Traces to:** U5; amended contract item 7; [Rules](#rules) 2–5.

Same edit in each owner: an optional `lock?: LaundryMutationLock` (hook option or editor prop) and the guard sequence of [Rules](#rules) item 2 at the existing guard point: `const lease = lock ? lock.tryAcquire(owner) : undefined; if (lease === null) return;` immediately before the existing `inFlight.current = true`, and `if (lease) lock.release(lease)` in the existing `finally`. The editor additionally checks `lock?.isHeld()` at the top of `handleSubmit`, alongside `inFlight.current || disabled`, so a refused submit changes no state. Owners: `useConfirmLaundryPrice` → `price`; `useGenerateLaundryInvoice` → `generateInvoice`; `LaundryWeighingEditor` → `weigh`.

- [ ] **Step 1: Write the failing tests.** Keep every existing case (no lock). Add, for each owner (the two hook tests and `laundry-weighing-editor.interaction.test.tsx`, each with a `useLaundryMutationLock` in its Probe or host):
  1. Acquires synchronously as its owner on a valid attempt.
  2. Releases after: success (after the refetch); each failure outcome; a rejected refetch (price, generate); for the editor, the failure path and the success path with a rejected `onRecorded`.
     **Editor harness.** `laundry-weighing-editor.interaction.test.tsx` gains a lock-aware mount: a host component that calls `useLaundryMutationLock()`, stores it where the test can read `isHeld()` and take or release its own lease, and renders `LaundryWeighingEditor` with `lock`, `onRecorded` and an `onPendingChange` `vi.fn()`. The existing `mount()` and its cases stay unchanged (no lock).
     **Editor early-return path.** `handleSubmit` has three ways to end without recording: the validation return (before any request), the `if (failed !== undefined) { setFailure(failed); return; }` branch inside the `try` (after a request), and the success path whose `onRecorded` rejects (caught inside the `try`, after the success toast). The test isolates the second. Drive it from a valid row with each failure outcome: (i) `weighLaundryOrder` rejects with a GraphQL error carrying `extensions.originalError.message`; (ii) it resolves with `errors: [{ message }]`; (iii) it rejects with a network `Error` (no server message). For each, assert first: `weigh.calls` has exactly one entry (a request was sent, so the validation return was not taken); `onRecorded` was **not** called and "Weight recorded." did not appear (the success path was not taken). Then the cleanup: the lock is released (`isHeld()` false); Record weight and the rows are enabled again (`pending` false); `onPendingChange` was called with `true` then `false`, in that order, and no more; the alert shows the server message for (i) and (ii) and "Unable to record weight." for (iii); the rows keep their values; a new valid submit sends exactly one more request (`weigh.calls` has two entries).
  3. Refused while the test holds a lease (once with another owner's name, once with this owner's name): no request, no toast, no refetch, own pending flag unchanged, own earlier failure not cleared; for the editor, no validation errors appear and `onPendingChange` is not called; after the refused attempt settles, the test's lease **still holds** the lock.
  4. Editor only: a blocked submit (invalid rows) never acquires the lock (`isHeld()` false during and after it) and still shows its validation error, as today.
  5. Editor only: unmounting the editor while its save is pending, then resolving the save, releases the lock (the host's `lock.isHeld()` is false after).
- [ ] **Step 2: Run.** `pnpm --filter web exec vitest run lib/use-confirm-laundry-price.hook.test.tsx lib/use-generate-laundry-invoice.hook.test.tsx lib/laundry-weighing-editor.interaction.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run** the same command — Expected: PASS.

### Task 6: The Actions component

**Type:** `code`. **Traces to:** ticket "Actions", "Confirmation", "Layout", "Tests"; R6–R10, R12; decisions b, d, e.

**Interfaces (produces):**

```ts
export interface LaundryOrderActionsProps {
  verbs: readonly LaundryOrderVerb[];       // laundryOrderActions(...) for the order
  disabled: boolean;                        // lock.held
  failure: LaundryActionFailure | null;     // laundryActionFailure(transition.failure, transition.message)
  confirmVerb: LaundryActionVerb | null;    // a destructive verb awaiting confirmation, still in the list
  confirming: boolean;                      // this dialog's own submission (submittingVerb !== null), never lock.held
  onRun: (verb: LaundryActionVerb) => void;            // forward buttons
  onRequestConfirm: (verb: LaundryActionVerb) => void; // destructive buttons
  onConfirm: (verb: LaundryActionVerb) => Promise<void>;
  onCloseConfirm: () => void;
}
```

Markup: `flex flex-wrap gap-2` per group; `Separator` between groups only when both are non-empty; forward `variant="default"`, destructive `variant="secondary"`, all `type="button"` and `disabled={disabled}`. `<p>` with `noActions` when both groups are empty. `<p role="alert">` with `failure.message ?? t(\`failure.${failure.verb}\`)` whenever `failure` is non-null, buttons or not. `ConfirmDialog` only while `confirmVerb !== null`: `title` and `confirmLabel` `actions.${verb}`, `description` `confirm.${verb}`, `confirming`, `onClose={onCloseConfirm}`, `onConfirm={() => onConfirm(verb)}`.

- [ ] **Step 1: Write the failing render tests** (`lib/laundry-order-actions.render.test.tsx`, `renderToStaticMarkup`). Fixture verb lists, not the helper:
  1. `['startProcessing', 'refund']`: "Start processing" with the `default` variant class, then a separator, then "Refund order" with the `secondary` class, in that order.
  2. `['cancel']`: one secondary button, no separator.
  3. `['markReady']`: one primary button, no separator.
  4. `['markAwaitingDelivery']` and `['markAwaitingPickup']` each render exactly that label and not the other.
  5. `['markPaid', 'markAwaitingPayment', 'weigh', 'price', 'generateInvoice']`: none of those labels; "No further actions for this order."
  6. `[]`: the empty sentence; no `<button`.
  7. `disabled: true`: every button has `disabled`.
  8. Dialog absent: `confirmVerb: null` with `['cancel']` → no `role="dialog"` and no cancel sentence; `onConfirm` and `onRun` spies not called by rendering.
  9. Dialog present: `confirmVerb: 'cancel'` → `role="dialog"`, title "Cancel order", the exact cancel sentence, confirm button "Cancel order"; `onConfirm` not called. Repeat for the other four with their sentences and titles.
  10. `confirming: true` with a dialog open → both dialog buttons `disabled`.
  11. `failure: { verb: 'reject', message: 'Server says no' }` → `role="alert"` with "Server says no"; `failure: { verb: 'cancel', message: null }` → "Unable to cancel the order."; with `verbs: []` the alert still renders.
- [ ] **Step 2: Run.** `pnpm --filter web exec vitest run lib/laundry-order-actions.render.test.tsx` — Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the component.
- [ ] **Step 4: Run** the same command — Expected: PASS. Then `pnpm --filter web lint` — Expected: exit 0.

### Task 7: Wire the page

**Type:** `code`. **Traces to:** §8.4.4; ticket "In flight and errors", "Role examples", "Acceptance criteria", "Tests"; R4, R5, R11, R14–R17; U1–U5; decisions b, d, g, h.

Page edits (against `e2e73e9`):

- `LaundryOrderWorkspace`, first hook after the queries: `const lock = useLaundryMutationLock();`. Pass `lock` to `useConfirmLaundryPrice`, `useLaundryOrderTransition`, `useGenerateLaundryInvoice`, and through `WeighingBody` to `LaundryWeighingEditor`.
- `const [confirmVerb, setConfirmVerb] = useState<LaundryActionVerb | null>(null);` and `const [submittingVerb, setSubmittingVerb] = useState<LaundryActionVerb | null>(null);` (rule 6).
- `WeighingBody disabled={confirmPrice.confirming}` → `disabled={lock.held}`.
- `PriceBody`: pass `disabled={lock.held}` to the estimate `LaundryPriceCard`, which gains `disabled?: boolean` and uses `disabled={!ready || confirming || disabled}` on Confirm. Estimate state unchanged.
- `LaundryInvoiceCard` gains `disabled?: boolean`; Generate and the terms control use `generating || disabled`; pass `disabled={lock.held}`.
- `LaundryOrderPaymentCard`: `pending={lock.held}`; `failure={laundryPaymentFailureAlert(isLaundryPaymentVerb(transition.failure) ? transition.failure : null, order.status)}`.
- Replace `ActionsBody` with `LaundryOrderActions` (still `null` while `role === undefined`, U2): `verbs`, `disabled={lock.held}`, `confirming={submittingVerb !== null}`, `failure={laundryActionFailure(transition.failure, transition.message)}`, `confirmVerb={confirmVerb !== null && laundryActionGroups(verbs).destructive.includes(confirmVerb) ? confirmVerb : null}`, `onRun={(verb) => void transition.run(verb)}`, `onRequestConfirm={(verb) => { if (!lock.isHeld()) setConfirmVerb(verb); }}`, `onConfirm={async (verb) => { if (lock.isHeld()) return; setSubmittingVerb(verb); try { await transition.run(verb); } finally { setSubmittingVerb(null); setConfirmVerb(null); } }}`, `onCloseConfirm={() => setConfirmVerb(null)}`.
- Add `<OrderSection section="activity" t={t}>` last, with `ActivityBody` (decision h).
- Update the page's header comment. Remove `order.actions.available` from `laundry.ts`.

- [ ] **Step 1: Write the failing render tests** (`laundry-order-page.render.test.tsx`, new `describe('order page lifecycle actions (#165)')`, real helper through the page). Extend the `@clensy/client` mock with the ten mutation hooks (never called by a static render) and `updatedAt` on the fixture order. Assert within `section(html, 'actions')`:
  1. ANALYST on every status: no `<button` in Actions.
  2. CUSTOMER_SUPPORT on `RECEIVED`: "Cancel order"; not "Reject order"; no weighing editor and no "Record weight".
  3. OPS_MANAGER on `RECEIVED`: "Cancel order" and "Reject order"; no separator.
  4. SCHEDULER on `PAID`: "Start processing"; not "Refund order".
  5. FINANCE on `PAID`: "Refund order"; not "Start processing".
  6. OPS_MANAGER on `READY` + `DELIVERY`: "Mark awaiting delivery", not "Mark awaiting pickup"; on `READY` + `PICKUP`: the reverse. Both have a separator before Mark lost / Mark damaged / Refund order.
  7. TENANT_OWNER on `REFUNDED`, `CANCELLED`, `REJECTED`: no button; "No further actions for this order."
  8. OPS_MANAGER on `PRICED`: "Cancel order" in Actions; "Mark paid" exactly once on the page, in Invoice and payment.
  9. Role loading: Actions body empty (existing case, kept).
  10. No confirm dialog in the initial markup for any case above.
  11. Seven sections in order; nav lists "Activity" last; no element says "History".
  12. Activity shows "Created" and "Updated" with `formatLaundryOrderTime` of the fixture values, and the status badge label; no `<ul`, `<ol` or `<li`; none of `laundry_order.received`, `laundry_order.weighed`, `laundry_order.priced`, `laundry_order.cancelled`.
  Changed existing assertions (recorded in the M6 record): the #156 case "names the role-allowed lifecycle actions as text in Actions" becomes buttons; #166 case 10 ("Actions keeps only the remaining lifecycle verbs, as text") becomes buttons; "renders the section nav and six sections in order" becomes seven.
- [ ] **Step 2: Write the failing interaction tests** (`laundry-order-page.interaction.test.tsx`, new `describe('order page lifecycle actions (#165)')`, real page, hooks, editors and lock in jsdom; deferred mutation and refetch promises as the #166 cases use). Extend the file's `@clensy/client` mock with the ten new mutation hooks, each returning a `vi.fn()` that queues into its own deferred list (as `page.paid` / `page.paids` do), reset in `beforeEach`; add one expected-call flag per new mutation, checked in `afterEach` as the file does for weigh and payment, so an unexpected call fails the test; and add `updatedAt` to the `weighed()` fixture.
  1. Forward verb: OPS_MANAGER on `PAID`; click "Start processing" → one `startLaundryProcessing` call with `{ input: { orderId } }`; while pending, every mutation control on the page is disabled; resolve and refetch to `PROCESSING` → toast "Processing started."; Actions shows "Mark ready" and no "Start processing".
  2. Double click "Start processing" in one `act` → one request (own guard; kept from the #166 pattern).
  3. Destructive, cancel path: OPS_MANAGER on `RECEIVED`; click "Cancel order" → dialog with the cancel sentence; `cancelLaundryOrder` not called; the dialog's Cancel closes it; still not called.
  4. Destructive, confirm path: open again, Confirm → one call; while pending the dialog's buttons are disabled and Escape does not close it; resolve and refetch to `CANCELLED` → dialog closes, toast "Order cancelled.", "No further actions for this order."
  5. Failure with server message: confirm Reject; the mutation rejects with `graphQLErrors[0].extensions.originalError.message = 'Laundry order cannot transition from RECEIVED to REJECTED'`; refetch returns the order unchanged (`RECEIVED`) → dialog closed, `role="alert"` in Actions with that text, the header badge still says Received, buttons enabled again.
  6. Failure without message: a forward verb resolves with `data: {}` → alert "Unable to mark the order ready."; status unchanged on screen after refetch.
  7. U1: a lifecycle verb fails and the refetched status is that verb's target (`markReady` failed, refetch returns `READY`) → the Actions alert stays.
  8. Separation: a failed `markPaid` shows its alert in the payment card only; a failed `cancel` shows in Actions only.
  9. A failed order refetch after a verb → the page's order error state, no Actions buttons. (That the lock is released after a rejected refetch is asserted directly on the lock in Task 4 L2.)
  10. **Race matrix** ([below](#race-matrix)).
  11. **Order switch, per-order isolation.** TENANT_OWNER.
      - **Harness behavior relied on (verified on `main` at `e2e73e9`):** `root` is created once per test in `beforeEach` (`root = createRoot(container)`), and the file's `mount()` only calls `root.render(...)` on that root; nothing in the file creates a second root during a test.
      - **Rendering in this case:** a local `renderTree()` calls `act(() => root.render(<ToastProvider><MountCounter /><LaundryOrderPage /></ToastProvider>))` on the shared `root`, with a comment that it must never call `createRoot`. Case 11 calls `renderTree()` once for A and once for the switch, and does not call `mount()`. `MountCounter` is a test-only sibling whose `useEffect(() => { mounts += 1; }, [])` counts its mounts.
      - **Why the counter proves the instance is kept:** `MountCounter` and `LaundryOrderPage` are siblings under the same `ToastProvider`, rendered with the same element types in the same positions both times. React re-mounts `MountCounter` only if the root or the tree above the page is recreated, and in that case it would re-mount `LaundryOrderPage` too. So `mounts === 1` after the switch shows the same root and the same `LaundryOrderPage` instance were kept, and only `key={id}` can give B a new workspace.
      - **Steps:**
        1. Set `page.id = A` and a `PAID` order A (TENANT_OWNER on `PAID` gets Start processing, Generate invoice and Refund order: see [Race fixture eligibility](#race-fixture-eligibility)); `renderTree()`; assert `mounts === 1`.
        2. Click "Start processing": exactly one `startLaundryProcessing` call with `orderId: A`, left pending; A's mutation controls are disabled.
        3. Switch the route **without unmounting**: set `page.id = B` and `page.order` to a `PAID` order B (id B, no invoice); `renderTree()` again on the same `root`. The `useParams` mock now returns B.
        4. Assert `mounts === 1` (same root, same page instance).
        5. Before A settles, assert: B's "Start processing" and Generate invoice buttons are present and **not** `disabled` (B's lock starts unlocked) — **assertion 11.5a**; clicking B's "Start processing" sends exactly one call with `orderId: B` (B acquires while A's operation is pending) — **11.5b**; B's controls are then disabled (B's own lease holds B's lock) — **11.5c**.
        6. Resolve A's mutation (entry 0 of the `startLaundryProcessing` deferred list) with a non-null payload for A. A's hook then calls its refetch, which queues `page.refetches[0]` (B's mutation, entry 1, is still pending, so B has not queued a refetch). Settle `page.refetches[0]` with the file's `finish()`, **not** `settleRefetch`, so `page.order` stays B. Assert B's controls are **still** disabled (A's release did not release B's lock) — **11.6**.
        7. Resolve B's mutation (entry 1); settle `page.refetches[1]` with `settleRefetch(1, { order: <B, PAID> })`; assert B's controls are enabled — **11.7**.
      - The mutation spy is shared across both workspaces, so every call assertion filters by `variables.input.orderId`: after 11.5b, exactly one call for A and one for B. The case sets the expected-call flag for `startLaundryProcessing`; `page.invoiceExpected` stays false (no invoice call for either order). It does not assert on toasts: A's success toast appears while B is shown (see [Execution risks](#execution-risks)).
  12. **An unrelated mutation does not lock an unsubmitted dialog (rule 6).** OPS_MANAGER on `RECEIVED` with one valid weight row. Open the Cancel dialog (lock free). Then, in one `act`, submit Record weight (behind the modal), so the weighing editor holds the lock. Assert: the dialog's Confirm and Cancel are **not** `disabled`; clicking Confirm sends no `cancelLaundryOrder` call and leaves the dialog open; pressing Escape closes the dialog; `cancelLaundryOrder` was never called. Then settle the weigh and its refetch. Repeat with the dialog's Cancel button instead of Escape.
- [ ] **Step 3: Run.** `pnpm --filter web exec vitest run lib/laundry-order-page.render.test.tsx lib/laundry-order-page.interaction.test.tsx` — Expected: FAIL.
- [ ] **Step 4: Implement** the page and component edits above.
- [ ] **Step 5: Run** the same command, then `pnpm --filter web test` — Expected: PASS. [#205](https://github.com/rexescario-dev/clensy-platform/issues/205) records intermittent jsdom timeouts in this suite; if one occurs, record the failing test and the re-run result, and do not raise the timeout in this slice.

#### Race matrix

Each row is one test that drives the real page, the real hooks and editor, and the one lock the page creates. Every prediction below (H1, the lock records, the refusals) is expected, not observed, until M6 runs the tests.

##### Race harness check H1

A test in `laundry-order-page.interaction.test.tsx`, in the same `describe` as the race rows, that proves the technique the rows depend on, in this React and jsdom:

- A test-only `RaceProbe` renders one `<button>` whose `onClick` increments a module-level `handled` counter and calls `setDisabled(true)`.
- In **one** `act` callback: `.click()` it; assert `button.disabled === false`; `.click()` it again.
- After the `act`: assert `handled === 2` and `button.disabled === true`.
- A second variant uses two buttons, where the first button's handler disables the second. In **one** `act` callback: `.click()` the first; assert the second is still **not** `disabled`; `.click()` the second. After the `act`: assert the second handler ran once and the second button is now `disabled`.

H1 passing shows that inside one `act`, a click's state update is not committed before the next click is dispatched, so the second handler runs against the same render. **If H1 fails, M6 stops**: the race rows cannot distinguish a refusal from a dropped click, and the race technique returns to M4.

##### Lock probe

The interaction file wraps the page's real lock without changing its behavior:

```ts
vi.mock('./use-laundry-mutation-lock', async (importOriginal) => {
  const real = await importOriginal<typeof import('./use-laundry-mutation-lock')>();
  return {
    ...real,
    useLaundryMutationLock: () => {
      const lock = real.useLaundryMutationLock();
      return {
        ...lock, // `held` and `release` unchanged
        tryAcquire: (owner) => {
          const lease = lock.tryAcquire(owner);
          lockLog.push({ op: 'tryAcquire', owner, granted: lease !== null });
          return lease;
        },
        isHeld: () => {
          const held = lock.isHeld();
          lockLog.push({ op: 'isHeld', held });
          return held;
        },
      };
    },
  };
});
```

`lockLog` is reset in `beforeEach` and again immediately before each race `act`. Because `isHeld` is never read during render (Rules item 2 and the Interface), every record comes from an event handler or an owner's guard, so the records logged inside the race `act` belong to the two raced handlers. An unexpected record is itself a failure.

##### Steps

1. **Arrange** the status, role and fixture; for a destructive verb, open its dialog in an earlier `act`.
2. **Precondition:** query both controls from the DOM and assert each is present and **not** `disabled` (and, for the weighing form, that its Record weight button is enabled and the row is valid). This shows both controls start enabled. It does not by itself show that the second handler runs: that rests on H1, step 3's between-clicks check and step 4's records.
3. **Race:** reset `lockLog`, and attach a native capture-phase `click` listener to the second control that counts events (for M9 the second control is the same button as the first, so the counter counts both clicks). In **one** `act` callback: `.click()` the first control; assert the second control is still **not** `disabled` (no commit happened between the clicks); `.click()` the second control (for Record weight, its submit button, as the weighing harness does). Per H1, the second handler then runs against the same render.
4. **Record, then assert the refusal.** First, before any assertion, record the row's **race observation**: `{ row, calls, lockLog }`. `calls` maps each of the row's mutation spies ([Measurement per row](#measurement-per-row)) to its calls since the race began, filtered by order id: two entries for a row whose controls send different mutations, one entry for M9. `lockLog` is a copy of the log since the reset in step 3. Push the observation to a module-level `raceObservations` list and print it as one line, `[race-observation] <JSON>`, with `console.info`. Then assert, in this order:
   - **submitted mutations:** for a two-spy row, the winner's spy has exactly one call and the loser's has **zero**; for M9, its one spy has exactly one call in total;
   - **click dispatch:** the native counter on the second control is exactly 1 (its click was dispatched); for M9, exactly 2 (both clicks on the one button were dispatched);
   - **lock log:** `lockLog` equals the row's [expected lock records](#expected-lock-records), in order: the winner's acquisition, then the loser's refusal (or, for M1 and M9, no loser record);
   - the second owner shows no pending text ("Confirming…", "Generating…") and no failure alert; the winner's pending state is shown.
5. **Settle** the winner with the row's outcome, then its refetch.
6. **Assert release:** every mutation control is enabled again; a fresh `.click()` on the second control sends exactly one call to its mutation. For M9 that click is on the same button, and its spy's total since the race becomes 2.

Destructive verbs: the race `act` clicks the other control (behind the modal; `.click()` reaches it in jsdom) and the dialog's Confirm. When the lifecycle verb loses, the page's `onConfirm` refuses before calling `run` (rule 6): the dialog stays open, with Confirm and Cancel enabled (`confirming` is false, because this dialog's submission never started), and step 6's fresh click is on that dialog's Confirm. When the lifecycle verb wins, its `run` holds the lease and the other owner's **lock check** refuses: `tryAcquire` returns `null` for the price and generate hooks, and the weighing editor's `isHeld()` returns true (Tasks 4–5 prove each owner's refusal in isolation).

| # | Status, role, fixture | First (wins) | Second (refused) | First's outcome | Covers |
| --- | --- | --- | --- | --- | --- |
| M1 | `PRICED`, OPS_MANAGER | Confirm Cancel | Mark paid | success | lifecycle → payment |
| M2 | `PRICED`, OPS_MANAGER | Mark paid | Confirm Cancel | GraphQL error | payment → lifecycle |
| M3 | `RECEIVED`, OPS_MANAGER, one valid weight row | Confirm Reject | Record weight (submit) | rejection (network) | lifecycle → weigh |
| M4 | `RECEIVED`, OPS_MANAGER, one valid weight row | Record weight | Confirm Cancel | success | weigh → lifecycle |
| M5 | `WEIGHED`, OPS_MANAGER, a ready estimate | Confirm Cancel | Confirm price | missing payload | lifecycle → price |
| M6 | `WEIGHED`, OPS_MANAGER, a ready estimate | Confirm price | Confirm Reject | success | price → lifecycle |
| M7 | `PAID`, TENANT_OWNER, no invoice | Start processing | Generate invoice | success | lifecycle → generate |
| M8 | `PAID`, TENANT_OWNER, no invoice | Generate invoice | Start processing | GraphQL error | generate → lifecycle |
| M9 | `PAID`, TENANT_OWNER, no invoice | Start processing | Start processing (same button twice) | success | same-hook double run (also case 2) |
| M10 | `PRICED`, TENANT_OWNER, no invoice | Mark paid | Generate invoice | success | payment → generate |
| M11 | `WEIGHED`, OPS_MANAGER, ready estimate, one valid weight row | Record weight | Confirm price | success | weigh → price |
| M12 | `WEIGHED`, OPS_MANAGER, ready estimate, one valid weight row | Confirm price | Record weight | rejection | price → weigh |

#### Measurement per row

The mutation spy each raced control calls, in the Task 7 interaction harness (one `vi.fn()` per generated mutation hook, each with its own deferred list). `calls` in the race observation has one entry per spy listed.

| # | Winner's spy | Loser's spy | Counts separable? |
| --- | --- | --- | --- |
| M1 | `cancelLaundryOrder` | `markLaundryOrderPaid` (`page.paid`) | yes |
| M2 | `markLaundryOrderPaid` (`page.paid`) | `cancelLaundryOrder` | yes |
| M3 | `rejectLaundryOrder` | `weighLaundryOrder` (`page.weigh`) | yes |
| M4 | `weighLaundryOrder` (`page.weigh`) | `cancelLaundryOrder` | yes |
| M5 | `cancelLaundryOrder` | `priceLaundryOrder` (`page.price`) | yes |
| M6 | `priceLaundryOrder` (`page.price`) | `rejectLaundryOrder` | yes |
| M7 | `startLaundryProcessing` | `generateInvoiceFromOrder` (`page.invoice`) | yes |
| M8 | `generateInvoiceFromOrder` (`page.invoice`) | `startLaundryProcessing` | yes |
| M9 | `startLaundryProcessing` | the same spy | **no**: judged by the spy's total (1 or 2) |
| M10 | `markLaundryOrderPaid` (`page.paid`) | `generateInvoiceFromOrder` (`page.invoice`) | yes |
| M11 | `weighLaundryOrder` (`page.weigh`) | `priceLaundryOrder` (`page.price`) | yes |
| M12 | `priceLaundryOrder` (`page.price`) | `weighLaundryOrder` (`page.weigh`) | yes |

#### Expected lock records

The records each row's race `act` is predicted to log, in order. "acquire X ✓" is `{ op: 'tryAcquire', owner: X, granted: true }`, "acquire X ✗" the same with `granted: false`, and "isHeld F / T" is `{ op: 'isHeld', held: false / true }`. A dialog Confirm logs `isHeld` (the page's check) before its `run` acquires; the weighing editor logs `isHeld` (its top check) before it acquires.

| # | Winner's records | Loser's records | Loser refused by |
| --- | --- | --- | --- |
| M1 | isHeld F, acquire `transition` ✓ | none | transition hook's own `inFlight` guard (both sides are transitions) |
| M2 | acquire `transition` ✓ | isHeld T | page's dialog check |
| M3 | isHeld F, acquire `transition` ✓ | isHeld T | weighing editor's lock check |
| M4 | isHeld F, acquire `weigh` ✓ | isHeld T | page's dialog check |
| M5 | isHeld F, acquire `transition` ✓ | acquire `price` ✗ | price hook's lock check |
| M6 | acquire `price` ✓ | isHeld T | page's dialog check |
| M7 | acquire `transition` ✓ | acquire `generateInvoice` ✗ | generate hook's lock check |
| M8 | acquire `generateInvoice` ✓ | acquire `transition` ✗ | transition hook's lock check |
| M9 | acquire `transition` ✓ | none | transition hook's own `inFlight` guard (same button) |
| M10 | acquire `transition` ✓ | acquire `generateInvoice` ✗ | generate hook's lock check |
| M11 | isHeld F, acquire `weigh` ✓ | acquire `price` ✗ | price hook's lock check |
| M12 | acquire `price` ✓ | isHeld T | weighing editor's lock check |

For ten rows the loser's refusal record proves its handler reached the lock and was refused there. For M1 and M9 the loser stops at the hook's own guard, which logs nothing. Those two rows rest on H1, the between-clicks `disabled === false` check and the native click counter. They are the #166 one-guard property, not shared-lock participation: in the lock-removal check their losers are still refused without the transition hook's lock (runs 4 and 5 predict "refused, log differs" for them, never "both called").

#### Lock-removal check

Required at M6, run **outside the committed change** and not committed, as for a characterization break. Each run removes one owner's participation in the shared lock, everything else unchanged (the [lock probe](#lock-probe) stays in place), and runs the race matrix. An owner without the lock neither acquires as a winner nor is refused as a loser.

**How a row is judged.** By its recorded race observation (step 4), not by whether the test passed: the observation is written before any assertion, so it exists even when an assertion fails. Each row falls in one class; any other counts (for example a winner with zero calls, or an M9 total of 0 or more than 2) fit no class and stop M6:

- **Both called** — for a two-spy row, `calls[winner] === 1` and `calls[loser] === 1`; for M9, its spy's total is 2. The only class that demonstrates a missing lock participation. The test fails at its first assertion (the mutation counts).
- **Refused, log as normal** — for a two-spy row, `calls[winner] === 1` and `calls[loser] === 0`; for M9, a total of 1; and the log equals the row's expected lock records. The test passes.
- **Refused, log differs** — the same counts as the previous class, but the log differs from the expected records because the removed owner no longer logs. The test fails at the lock-log assertion. This is **not** evidence of lock participation: another layer refused the loser.

**Predictions.** Rows not listed in a run's cells are "refused, log as normal" (they do not involve the removed owner).

| Run | Behavior removed | Both called | Refused, log differs (predicted log) |
| --- | --- | --- | --- |
| 1 | The weighing editor receives no lock | M3, M4, M11, M12 | none |
| 2 | `useConfirmLaundryPrice` receives no lock | M5, M6, M11, M12 | none |
| 3 | `useGenerateLaundryInvoice` receives no lock | M7, M8, M10 | none |
| 4 | `useLaundryOrderTransition` receives no lock; the page's dialog checks (rule 6) stay | M3, M5, M7, M8, M10 | M1 (isHeld F), M2 (isHeld F), M9 (empty; spy total 1): the transition hook's own `inFlight` guard still refuses the loser, the #166 one-guard property. M4 and M6 stay "refused, log as normal": their loser is a dialog Confirm, refused by the page's `lock.isHeld()` check, and their winner (weigh, price) still logs |
| 5 | As run 4, and the page's dialog `lock.isHeld()` checks also removed | Run 4's rows, plus M4, M6 | M1 (empty), M2 (empty), M9 (empty; spy total 1) |

Why the run 4 and 5 logs: in M1 the winner is a dialog Confirm whose page check logs `isHeld F`, and its `run` no longer acquires; in M2 the winner (Mark paid) no longer acquires, and the loser's dialog check finds the lock free and logs `isHeld F` before its `run` is refused by `inFlight`; in M9 neither click reaches the lock. With the dialog checks removed (run 5), nothing in those three rows logs.

**Evidence rule.** M6 runs all five, and records, per run, the edit made, the command, and for every row its printed race observation (`calls`, `lockLog`), its class, and the first failing assertion if the test failed, next to this table's prediction. These are actual results; the table is only a prediction. M6 **stops** and reports for investigation, before continuing, if any row's counts fit no class, if its observed class differs from the prediction, if a "log differs" row's log differs from its predicted log, or if a test fails at any assertion other than the one its class predicts. A mismatch is not explained away in the record, and neither an unexpected log nor an unexplained assertion failure is counted as proof of lock participation, even if a plausible cause is found; the plan is revised (or the cause fixed and all five runs repeated) first. After the runs, the tree is restored and `git status` shows no change from those edits.

#### Key-removal check

Required at M6, outside the committed change, under the same evidence rule. **Break:** `LaundryOrderPage` renders the workspace without `key={id}`. Because case 11 keeps the same root and page instance (`renderTree()` on the shared `root`, mount counter), the same workspace instance, with the same lock, stays mounted across the switch. **Expected (prediction):**

- Case 11 step 4 (`mounts === 1`) **passes**: the root and page were kept, so a fresh root does not explain anything that follows.
- Case 11 **fails at assertion 11.5a**: B's buttons are disabled, because A's lease still holds the one, reused lock.
- Every other case in the two page test files passes (no other case switches orders).

M6 records the actual result of the same command. If case 11 passes without the key, or fails anywhere other than 11.5a, or step 4 fails, or any other case changes result, M6 stops: the case does not yet prove the key is necessary.

Every pair of owners that can coexist on one status is covered in both directions for the lifecycle pairs (ticket: lifecycle versus payment, weighing, price confirmation and invoice generation), and at least one direction for the other pairs. Which owners can coexist follows from the helper: `weigh` is legal only in `RECEIVED` and `WEIGHED`; `price` only in `WEIGHED`; the payment verbs only in `PRICED` and `AWAITING_PAYMENT`; `generateInvoice` in every `INVOICEABLE` status, `PRICED` through `COMPLETED` (`PRICED`, `AWAITING_PAYMENT`, `PAID`, `PROCESSING`, `READY`, `AWAITING_PICKUP`, `AWAITING_DELIVERY`, `COMPLETED`), for FINANCE and TENANT_OWNER. So weigh and generate never coexist, and price and generate never coexist, and those pairs have no row; payment and generate coexist in `PRICED` and `AWAITING_PAYMENT` (row M10). Each terminal outcome (success, GraphQL error, rejection, missing payload) is a winner's outcome in at least one row; a rejected refetch is covered per owner in Tasks 4–5.

#### Race fixture eligibility

The verbs `laundryOrderActions(status, 'PICKUP', role)` returns for each fixture, from `LEGAL_VERBS`, `VERB_ROLES` and `INVOICEABLE` on `main` at `e2e73e9`, in `LAUNDRY_ORDER_VERBS` order. Generate invoice is shown only when the invoice query has resolved with no invoice (`laundryInvoiceView` → `generate`), which every row's "no invoice" fixture provides. The weighing editor is shown when `weigh` is present, and Confirm price when `price` is present and the estimate is ready.

| Fixture | Rows and cases | Helper verbs | Controls each row races |
| --- | --- | --- | --- |
| `PRICED`, OPS_MANAGER | M1, M2; interaction 8; render 8 | `markAwaitingPayment`, `markPaid`, `cancel` (OPS_MANAGER is not in `INVOICE`, so no `generateInvoice`) | Mark paid (payment card); Cancel order (Actions) |
| `RECEIVED`, OPS_MANAGER | M3, M4; interaction 3–5, 12 | `weigh`, `cancel`, `reject` | Record weight; Reject or Cancel order |
| `WEIGHED`, OPS_MANAGER | M5, M6, M11, M12 | `weigh`, `price`, `cancel`, `reject` | Confirm price; Record weight; Reject or Cancel order |
| `PAID`, TENANT_OWNER | M7, M8, M9; interaction 11 (orders A and B) | `startProcessing`, `generateInvoice`, `refund` | Start processing (Actions); Generate invoice (Invoice card) |
| `PRICED`, TENANT_OWNER | M10 | `markAwaitingPayment`, `markPaid`, `generateInvoice`, `cancel` | Mark paid (payment card); Generate invoice (Invoice card) |

Every row's two controls are in its fixture's list, so both are rendered; the race precondition (step 2) asserts both are also enabled before the same-`act` race.

### Task 8: Verification and browser check

**Type:** `code`. **Traces to:** M6 verification.

- [ ] **Step 1: Run every gate** and record the actual output in the Execution record:
  - `pnpm --filter web test`
  - `pnpm --filter web lint`
  - `pnpm --filter web exec tsc --noEmit`
  - `pnpm --filter @clensy/web test`
  - `pnpm --filter @clensy/web lint`
  - `pnpm --filter @clensy/web build`
  - `pnpm --filter @clensy/client test`
  - `pnpm --filter @clensy/client build`
  - `pnpm --filter @clensy/client lint`
  - `pnpm --filter @clensy/client codegen && git diff --exit-code packages/client/src/generated/graphql.ts` (the committed output matches the schema).
  - Scope check: `git diff --name-only main...HEAD` lists no file under `apps/api/` or `packages/ui/`, and not `apps/web/app/app/laundry/page.tsx`.
  - Lock participation check: `grep -n "lock" "apps/web/app/app/laundry/[id]/page.tsx"` shows the one `useLaundryMutationLock()` call and the lock passed to all four owners (recorded; the race matrix is the proof).
  - [Lock-removal check](#lock-removal-check): the five runs, outside the commit; every row's printed race observation, class and first failing assertion recorded next to the prediction; any mismatch stops M6; the tree is restored and `git status` is clean afterwards.
  - [Key-removal check](#key-removal-check): outside the commit; actual result recorded; any mismatch stops M6; tree restored.
- [ ] **Step 2: Browser check** (the `run` / ui-ux verification skill), on a seeded tenant: an OPS_MANAGER walks one PICKUP order from `PAID` to `COMPLETED` and cancels one `RECEIVED` order through the dialog; while a verb runs, Generate, the payment buttons and the weighing editor are disabled; at 375 px width the buttons wrap; Activity shows the times and status. Record screenshots or a GIF path. If the stack cannot be started, record that, and do not claim the check.

## Acceptance criteria → tests

| Ticket acceptance criterion | Tests |
| --- | --- |
| Buttons match the helper and disappear when the status changes | Task 6 cases 1–6; Task 7 render 1–8, interaction 1, 4 |
| Destructive actions do not call the mutation until confirm | Task 6 cases 8–9; Task 7 interaction 3–4 and 12 |
| Two verbs cannot be in flight together | Task 2; Task 4 own-guard and L1–L5; Task 5; Task 7 interaction 2, race harness check H1, race matrix M1–M12 with the lock probe, and the lock-removal check |
| (Plan requirement, U5) One order's pending mutation never blocks or releases another order's lock | Task 2 case 8; Task 7 interaction 11 and the key-removal check |
| Pickup and delivery stay mutually exclusive | Task 6 case 4; Task 7 render 6 |
| Activity shows created, updated, current status, and is not an audit trail | Task 3; Task 7 render 11–12 |
| Failed mutations leave the status unchanged on screen after refetch | Task 7 interaction 5–6 |

## What an M5 acceptance records

When the owner accepts this plan, the M5 record states:

- **Accepted:** the design and the test plan in this revision, including the [#166 contract amendment](#amendment-to-the-166-guard-contract), with the owner's sign-off on that amendment named separately.
- **Not claimed:** no test, gate, break run or browser check has run. Every `Expected:` line, the race-matrix outcomes, the lock-removal predictions and the key-removal prediction are predictions until M6 records actual results.
- **Who reviewed:** the M5 reviewer, and whether that was a self-review.
- **Owner sign-off on the #166 amendment:** recorded only from Rex's explicit approval, quoted with its date. A reviewer's technical assessment is not that approval. As of revision 2.4 it has not been given.

## M5 decision

**Accepted — 2026-10-25, revision 2.10.** Recorded per [What an M5 acceptance records](#what-an-m5-acceptance-records).

- **Accepted:** the design and the test plan in revision 2.10, including the [#166 contract amendment](#amendment-to-the-166-guard-contract) (text unchanged since revision 2.5).
- **Owner sign-off on the #166 amendment, and M5 acceptance:** Rex, 2026-10-25, quoted: "I approve the #166 amendment and accept revision 2.10 at M5."
- **Who reviewed:** M5 review rounds on revisions 2.2 to 2.10 were supplied by the owner from a reviewer outside this session; the last, on revision 2.10, found no remaining blocker. The review of revision 2.6 (finding B1) was a **self-review** by the plan's author. The plan's author also found and corrected the lock-removal prediction error in revision 2.8 and the correction-note errors in revision 2.9.
- **Not claimed:** no test, gate, break run (H1, race matrix, lock-removal, key-removal) or browser check has run. Every `Expected:` line, the race-matrix outcomes, the expected lock records, the lock-removal predictions and the key-removal prediction remain predictions until M6 records actual results.
- **Next:** M6 on `feat/165-laundry-lifecycle-actions`. M7 is a fresh independent review (`CLAUDE.md`: application code).

## Execution record (M6)

2026-10-25 to 2026-10-26, on `feat/165-laundry-lifecycle-actions` from `main` at `e2e73e9`. Every result below was observed in this session. Nothing here is a prediction.

### Commits

| Task | Commit | Summary |
| --- | --- | --- |
| Plan and M5 | `d4e7fe1` | This plan, revision 2.10, with its M5 record |
| 1 | `83e458c` | `updatedAt` on `LaundryOrderDetail`; regenerated client |
| 2 | `4722a9e` | `useLaundryMutationLock` |
| 3 | `8d5f67e` | `laundry-order-lifecycle-actions`; `activity` section; `formatLaundryOrderTime`; Activity copy |
| 4 | `b86ce36` | Transition hook: ten verbs, `message`, lock |
| 5 | `efe2ac1` | Price, generate and weighing join the lock |
| 6 | `dea85d4` | `LaundryOrderActions` |
| 7 | `7a149fd` | Page wiring, cards' `disabled`, Activity, render and interaction tests |

### Red and green per task

| Task | Red (before the change) | Green |
| --- | --- | --- |
| 1 | Client test failed: `updatedAt` not selected | 5/5 client operation tests; client build exit 0 |
| 2 | Module missing | 8/8 lock tests |
| 3 | Module missing; section list and formatter tests failed | 99/99 in the two files; `@clensy/web` 418/418 and build exit 0 |
| 4 | 76 of the new hook cases failed (ten verbs unknown, no `message`, no lock) | 101/101 hook tests |
| 5 | 16/16 new price and generate lock cases failed; 10 of 11 new editor lock cases failed (see deviation 5) | 89/89 in the three files |
| 6 | Module missing | 18/18 render tests |
| 7 | Run after the fact (deviation 6): against the committed pre-Task-7 page, 9 of 15 new render cases and 24 of 26 new interaction cases failed | 90/90 render, 57/57 interaction |

### Deviations from the plan

1. **Task 1 touched a Task 5 file.** The weighing editor test's `RECORDED` fixture is typed by the generated fragment, so adding `updatedAt` to the fragment broke the web typecheck until the fixture gained the field. The client test's new helper was also moved to satisfy `contextforge/function-order`.
2. **Task 3 updated a render assertion early.** The nav gained a seventh link, so the #156 case "marks the next step forward as current" now counts 6 non-current links, not 5. The plan placed render-test changes in Task 7. They were made here to keep the commit green.
3. **Task 4 did two Task 7 steps early, to keep the commit green.** The widened hook's failure no longer fits `laundryPaymentFailureAlert`, so the page's narrowing (`isLaundryPaymentVerb`) went in with Task 4. The page now calls the ten new mutation hooks through the transition hook, so both page harnesses gained their mocks, deferred lists and expected-call flags in Task 4.
4. **No `as` casts were needed** for the transition hook's verb-to-mutation map; the generated mutate functions are assignable to its `Mutate` type.
5. **Tests that pass before their implementation.** Decision (k) said there are none. These pass on the code before the change, because they assert an absence that already held, or they do not involve the changed code:
   - "never marks Activity" (Task 3);
   - "never acquires for a blocked submit" (Task 5);
   - render #165 cases 1, 7 (three statuses), 9 and 10;
   - H1's two tests.

   No characterization break evidence is claimed for them. In Task 5, four editor cases that first passed trivially (the lock was never taken) were strengthened before implementation to assert the lock is held while the save is pending, and then failed as expected.
6. **Task 7 TDD order.** The page was wired before the render and interaction tests were written. Red evidence was then taken by restoring the committed pre-Task-7 page, outside the commit, and running the new #165 cases against it:
   - render: 9 of 15 failed; the six above passed;
   - interaction: 24 of 26 failed; H1's two passed.

   The page was restored afterwards and `cmp` confirmed it.
7. **Task 7 changed six existing render assertions, not three.** The plan listed three. All six:
   - "six sections" became seven;
   - "names the role-allowed lifecycle actions as text" became buttons;
   - #166 case 10 became buttons;
   - three cases that treated Actions as having no controls ("no controls in the read-only sections"; the Services-editor and weighing-editor "controls only in …" cases) now exclude Actions and check Activity instead.
8. **A race-matrix assertion was corrected before commit.** A first version asserted that the loser's control is disabled after the race. That is wrong for a losing dialog Confirm, which rule 6 keeps enabled and cancellable. M2, M4 and M6 failed on it, and the assertion was changed to follow rule 6. No code changed.
9. **Race observations need `--disableConsoleIntercept`.** The interaction file uses fake timers, and with them Vitest 5 did not print intercepted `console.info` output. The lock-removal runs used `--disableConsoleIntercept`.
10. **No jsdom timeouts (#205)** occurred in any run.

### Gates (Task 8 Step 1)

| Command | Result |
| --- | --- |
| `pnpm --filter web test` | exit 0 — 57 files, 2516/2516 |
| `pnpm --filter web lint` | exit 0 |
| `pnpm --filter web exec tsc --noEmit` | exit 0 |
| `pnpm --filter @clensy/web test` | exit 0 — 16 files, 418/418 |
| `pnpm --filter @clensy/web lint` | exit 0 |
| `pnpm --filter @clensy/web build` | exit 0 |
| `pnpm --filter @clensy/client test` | exit 0 — 2 files, 15/15 |
| `pnpm --filter @clensy/client build` | exit 0 |
| `pnpm --filter @clensy/client lint` | exit 0 |
| `pnpm --filter @clensy/client codegen && git diff --exit-code packages/client/src/generated/graphql.ts` | exit 0 (committed output matches) |
| Scope: `git diff --name-only main...HEAD` | no file under `apps/api/` or `packages/ui/`; `apps/web/app/app/laundry/page.tsx` not changed |
| Lock participation: `grep -n "lock" "apps/web/app/app/laundry/[id]/page.tsx"` | one `useLaundryMutationLock()`; passed to `useConfirmLaundryPrice`, `useLaundryOrderTransition`, `useGenerateLaundryInvoice` and, through `WeighingBody`, `LaundryWeighingEditor` |

### Race matrix, normal run

`pnpm --filter web exec vitest run lib/laundry-order-page.interaction.test.tsx -t "race matrix" --disableConsoleIntercept`: 12/12 passed. Every printed observation matched its [expected lock records](#expected-lock-records), with winner 1 call, loser 0 (M9: total 1), and the click counter at 1 (M9: 2).

### Lock-removal check (actual)

Five runs, each an edit to `apps/web/app/app/laundry/[id]/page.tsx` outside the commit, followed by the race-matrix command above with `--reporter=json`. The page was restored after the runs, and `git status` was clean.

| Run | Edit | Both called | Refused, log differs (actual log) | Refused, log as normal | Matches prediction |
| --- | --- | --- | --- | --- | --- |
| 1 | `lock={lock}` removed from `LaundryWeighingEditor` | M3, M4, M11, M12 | none | the other eight | yes |
| 2 | `lock` removed from `useConfirmLaundryPrice` | M5, M6, M11, M12 | none | the other eight | yes |
| 3 | `lock` removed from `useGenerateLaundryInvoice` | M7, M8, M10 | none | the other nine | yes |
| 4 | `lock` removed from `useLaundryOrderTransition` | M3, M5, M7, M8, M10 | M1 (isHeld F), M2 (isHeld F), M9 (empty; total 1) | M4, M6, M11, M12 | yes |
| 5 | As run 4, and both dialog `lock.isHeld()` checks removed | M3, M4, M5, M6, M7, M8, M10 | M1 (empty), M2 (empty), M9 (empty; total 1) | M11, M12 | yes |

Every "both called" row failed first at the loser's mutation-count assertion (test file line 1375). Every "log differs" row failed first at the lock-log assertion (line 1378). Every "log as normal" row passed. No mismatch.

### Key-removal check (actual)

`key={id}` was removed from `LaundryOrderPage` outside the commit, and both page test files were run (`--reporter=json`): 146 of 147 passed. The one failure was case 11 at line 1108, assertion 11.5a (`expected true to be false`: B's Start processing is disabled), after step 4's `mounts === 1` passed. The page was restored and `git status` was clean. This matches the prediction.

### Browser check (Task 8 Step 2)

On 2026-10-26, against the local Docker API and Postgres, as the seeded TENANT_OWNER. The owner approved two things for this check: stopping the `clensy-platform-web-1` container and serving this branch on port 3001, because the API's CORS allows only `http://localhost:3001`. The Claude in Chrome extension was not connected, so the check used the Playwright plugin's Chromium. `next dev` failed with "OS file watch limit reached", so the branch was built (`pnpm --filter web build`) and served with `next start` on 3001. The container was started again afterwards. To observe the in-flight state, the page's `fetch` was wrapped to hold mutation responses for 4 seconds.

- **Order `72c06f77…` (customer pickup), RECEIVED → COMPLETED:** record weight → base service → Confirm price → Mark paid → Start processing → Mark ready → Mark awaiting pickup → Complete order.
  - RECEIVED: Actions offered Cancel order, Reject order.
  - PRICED: Mark paid and Mark awaiting payment were in the payment card only; Actions showed Cancel order.
  - While Start processing ran: Generate invoice, all three payment-terms radios, Start processing and Refund order were disabled.
  - READY: Mark awaiting pickup (no delivery verb), a separator, then Mark lost, Mark damaged, Refund order.
  - COMPLETED: Refund order only. Activity showed Created, Updated (later than Created) and the status badge.
- **At 375 px (READY):** no horizontal page overflow; the three destructive buttons wrapped onto two rows; no button group overflowed.
- **Order `79aad04f…` (customer pickup), RECEIVED → CANCELLED through the dialog:**
  - The dialog showed the exact cancel sentence, with Cancel and Cancel order enabled.
  - After Confirm, while the mutation ran: both dialog buttons, both Actions buttons and every weighing-editor control were disabled, and Escape did not close the dialog.
  - Afterwards: the dialog closed, the "Order cancelled." toast appeared, the header showed Cancelled, Actions said "No further actions for this order.", and Activity updated.
- **Console:** no errors other than a missing `favicon.ico` (404).
- **Screenshots:** in the session scratchpad (`browser/165-02` to `165-06`), not committed.
- **Test data left:** these two orders remain in the local database, one Completed and one Cancelled.



## M7 round 1 — Returned (2026-10-26)

**Reviewer:** a fresh independent agent on Opus, which did not implement the change (`CLAUDE.md`). It was given the Accepted spec, this plan and `git diff main...feat/165-laundry-lifecycle-actions` (PR #210). It re-ran the following, all exit 0: `pnpm --filter web test` (2516/2516), web lint, web `tsc --noEmit`, `@clensy/web` test (418/418) and `@clensy/client` test (15/15). It did not re-run the break runs or the browser check; for those it relied on the M6 record. It found Tasks 1–8 conforming, the scope clean, decision k and #166 semantics intact, and no M6 deviation blocking.

**B1 (blocking, verification).** The test "releases the lock when the save settles after the editor unmounted" (Task 5 case 5, Rules item 5) proved nothing. `mountWithLock` defines a new `Host` on every call, so `mountWithLock(false)` mounted a new host with a fresh lock and reassigned `lock`. The final assertion therefore read a lock that was never held. The code was correct by reading; the proof was missing.

**Fix (`6836371`).** The test now captures the editor's lock before the remount (`const held = lock`). It asserts that `lock` was replaced and `held` is still held after the editor unmounts, and that `held` is released once the save settles. Verified:

- The fixed test passes.
- Break run, outside the commit: the editor's `if (lease) lock?.release(lease);` was removed, and the test then failed at its final assertion (line 756, `expected true to be false`). The editor was restored and `git status` showed only the test file changed.
- Gates after the fix: `pnpm --filter web test` 2516/2516; web lint and `tsc --noEmit` exit 0.

**Non-blocking observations.** Recorded, not changed:

- Race step 6 checks only the second control, not every mutation control.
- Step 4 checks the loser's pending label but not the absence of a failure alert.
- Interaction case 1's "every control" holds for its fixture.
- Case 11's assertion 11.6 holds by construction once the key is present.
- The Services editor stays outside the lock, by decision c.

**Plan document fix.** Commit `8ad4277` (the M6 record) dropped the `## Verification gates` heading above the gates table below. It is restored here; no content changed.

## M7 round 2 — Approved (2026-10-26)

**Reviewer:** the same fresh independent agent as round 1, not the implementer. **Decision: Approved for merge.** It reviewed `6836371` and `eaa7c55` and found:

- B1 is fixed. The test now reads the lock the editor took (`held`), shows it is still held after the editor unmounts, and requires it to be released once the save settles, so a missing `finally` release fails the final assertion. This agrees with the implementer's break run.
- `eaa7c55` is a plan-only change.

It re-ran, all passing: the weighing-editor test file (53/53), `pnpm --filter web test` (2516/2516), web lint and `tsc --noEmit` (exit 0); `git status` was clean afterwards. It did not repeat the break run, because the review was read-only. No blocking findings. The round 1 non-blocking observations stand.

## M8 — Not applicable

No refactoring. Neither the M7 reviewer nor M6 identified a maintainability issue that needed it. No code changed for M8.

## M9 — Documentation (2026-10-26)

Scope: `apps/web/README.md`, `docs/features/laundry.md` and this plan. Each change follows from the M7-approved implementation (PR #210).

- **`apps/web/README.md`, content:**
  - The order page has seven sections, ending in Activity, and only Overview and Activity are read-only.
  - New entries cover the page mutation lock, Actions (grouping, confirmation, outcome) and Activity.
  - The weighing editor, Confirm price, Generate and transition-guard entries now describe the lock.
  - The out-of-date "Actions names … as text" and "#165 replaces/reuses" wording is removed.
- **`docs/features/laundry.md`, content:** the list of web screens now includes invoice and payment, lifecycle actions and activity. One paragraph after the transition table says the order page offers these transitions as role-filtered buttons, confirms the destructive ones, shows the server's refusal, and has no history view because no API reads the audit rows.
- **This plan:** the Status rows for M7, M8 and M9, and these records.
- **Editorial checks:**
  - The new relative links resolve (the plan path, from `apps/web/`), and the features doc's `#laundry-list-applaundry` anchor still matches its heading.
  - The heading hierarchy is unchanged, apart from this plan's restored `## Verification gates`.
  - No old wording ("six sections", "names … as text", "#165 replaces", "#165 reuses it") is left.
  - Terms follow the spec and the copy catalog: Actions, Activity, the verb labels.

## M10 — Not applicable

No workflow asset under `docs/workflows/` or installer-managed file changed.

## Closeout (2026-10-26)

**Merge check (§2.12, before the merge).** Each applicable stage was checked in order. Every one had a recorded outcome. No stage was skipped or overridden.

| Gate | Outcome |
| --- | --- |
| M1 | Installed prompt library present |
| M2 | No new specification or amendment; the Accepted lifecycle spec (Amendment #164 §8.4.4, §4.3, §4.4, §4.9) governs |
| M3 | Spec already Accepted |
| M4 | Plan drafted (revisions 1–2.10) |
| M5 | Plan Accepted (revision 2.10, owner), with the owner's sign-off on the #166 guard-contract amendment |
| M6 | Complete, including the browser check (not waived) |
| M7 | Approved for merge (independent, round 2) |
| M8 | N/A |
| M9 | Complete |
| M10 | Does not apply (no workflow assets changed) |

**Merge.**

- Authorized by the owner ("merge 210, closeout").
- Merged as a merge commit with `gh pr merge 210 --merge --delete-branch`. The head was `608d0c9`, on which PR CI passed (Lint, Test, API e2e and Release gate all `SUCCESS`). Nothing after the M7-reviewed `eaa7c55` is code: `608d0c9` is the M9 docs commit.

**Verification.**

- PR #210 shows `MERGED`, with merge commit `edd6f9e`, at 2026-10-26T02:37:44Z (UTC).
- `608d0c9` is an ancestor of `origin/main`, and `git diff 608d0c9 edd6f9e` is empty.
- Local `main` fast-forwarded to `edd6f9e`.
- #165 closed automatically (2026-10-26T02:37:46Z).

**Post-merge cleanup.**

- `--delete-branch` removed `feat/165-laundry-lifecycle-actions` from the remote. #166's closeout left its branch in place, but that branch is no longer on the remote either. The project defines no cleanup policy.
- Follow-up issues #211 and #212 linked to files on that branch, so their links were repointed to `main`.
- **Local data left from the M6 browser check:** two test orders for the seeded customer Amara Chidi stay in the local database: `72c06f77-9a53-4690-b4ba-c1c72c2f102c` (Completed) and `79aad04f-7699-409d-aca3-321a43da77a1` (Cancelled). A gitignored production build is left in `apps/web/.next`.

**Final M7 position.** Approved for merge in round 2, with no blocking findings. The round-1 return (B1, a test that proved nothing) was resolved in `6836371` with a break-run proof. The round 1 non-blocking observations are filed as #212.

**Follow-ups.**

| Item | Outcome |
| --- | --- |
| Message when the role lookup fails (U2, deferred by the owner) | Filed as [#211](https://github.com/rexescario-dev/clensy-platform/issues/211) (`enhancement`). Deferred; to be prioritized separately. |
| Race-matrix test hardening (M7 non-blocking observations) | Filed as [#212](https://github.com/rexescario-dev/clensy-platform/issues/212). Deferred; to be prioritized separately. |
| Order event timeline (audit rows not readable through any API) | Not filed; needs a separate product decision. |
| #161 cutover (rows and intake still open the drawer) | Already tracked as #161. |
| Toast from order A shown after switching to order B | Pre-existing behaviour recorded under Execution risks; not filed. |
| Race observations print only with `--disableConsoleIntercept` | Recorded in the M6 execution record (deviation 9); not filed. |
| `next dev` hits the OS file-watch limit on the owner's machine | Environment only; not filed. |

## Slice Completion Report (final)

| Field | Result |
| --- | --- |
| Slice | #165 Laundry lifecycle actions |
| Tracking | https://github.com/rexescario-dev/clensy-platform/issues/165 |
| M4 | Plan **Accepted** (revision 2.10) |
| M5 | Review **Accepted** (owner, 2026-10-25) |
| M6 | **Complete** |
| M7 | **Approved** (independent, round 2) |
| M8 | **N/A** |
| M9 | **Complete** |
| Branch | `feat/165-laundry-lifecycle-actions` (merged and deleted) |
| PR | https://github.com/rexescario-dev/clensy-platform/pull/210 |
| Status | **Slice complete** |

### Shipped

- **Actions buttons:** one button per lifecycle verb the role, status and fulfillment allow. Forward verbs come first, then a separator, then the destructive verbs. Payment verbs stay in Invoice and payment.
- **Confirmation:** a `ConfirmDialog` with the catalog sentence for Cancel, Reject, Mark lost, Mark damaged and Refund. Nothing is sent before Confirm, and an unrelated mutation never makes an unsubmitted dialog impossible to cancel.
- **One page mutation lock:** weighing, price confirmation, invoice generation and every lifecycle or payment verb share one synchronous lock, so two mutations never overlap. Each order has its own lock.
- **Failures:** the server's message, or the catalog fallback, appears in Actions. Payment failures stay in the payment card (decision k unchanged).
- **Activity:** the last section, showing created time, updated time and status. It is not an audit timeline.
- **Docs:** the web README and the laundry feature doc describe the lock, Actions and Activity.

### Validation

| Check | Result |
| --- | --- |
| Tests | **Passed**: web 2516/2516, `@clensy/web` 418/418, `@clensy/client` 15/15; CI Test and API e2e pass |
| Typecheck | **Passed** |
| Lint | **Passed** (also CI) |
| Build | **Passed** (`@clensy/web`, `@clensy/client`) |
| Package validation | **Passed**: codegen output matches the committed client; scope check clean; CI Release gate passes |

### Next Gate

**None — slice complete**

## Verification gates

| Gate | When | Who |
| --- | --- | --- |
| M5 plan review | Before any task | Owner, including sign-off on the #166 contract amendment |
| TDD red/green per task | Each task's run steps | M6 implementer, recorded |
| Full gate list (Task 8), including the lock-removal and key-removal checks | Before M7 | M6 implementer, actual outputs recorded; any mismatch with a predicted result stops M6 |
| M7 code review | After M6 | **Fresh independent reviewer** on the most capable model, not the implementer, given the Accepted lifecycle spec (§8.4.4, §4.3, §4.4), this plan once Accepted, the #166 guard contract with this plan's amendment, and the branch diff (`CLAUDE.md`: application code). The M7 record cites it. |
| M8 | After M7 | Expected N/A unless M7 asks for a refactor |
| M9 | After M7/M8 | `apps/web/README.md` (order page sections; the page mutation lock) and `docs/features/laundry.md` (Actions and Activity; "Activity is not an audit trail") |
| M10 | Closeout | Does not apply unless a workflow asset changes |
| CI | PR | Required checks green before merge |

Slice Completion Reports are emitted at M6–M9 handoffs and final acceptance per `docs/workflows/conventions/reporting-conventions.md`.

## Traceability

| Spec / ticket / decision | Tasks |
| --- | --- |
| §8.4.4 action bullet (matrix ∩ fulfillment ∩ role; five confirmations; client mirror presentation only) | 3, 4, 6, 7 |
| §8.4.4 workspace bullet (lifecycle actions on the page; pickup/delivery exclusive) | 6, 7 |
| §8.4.4 invoice bullet (payment verbs separate) | 3, 7 |
| §4.3, §4.4 (matrix, roles: unchanged, pinned by tests) | 7 |
| §4.9 (status-badge tones) | 7 (Activity badge) |
| Ticket: Activity, `updatedAt` | 1, 3, 7 |
| Ticket: In flight and errors; U5 | 2, 4, 5, 7 |
| Ticket: Role examples, Acceptance criteria, Tests | 6, 7 |
| U1 | 6, 7 |
| U2, U3, U4 | 3, 7 |

## Explicit deferrals

- An audit or event timeline, and any GraphQL read of audit rows (ticket; separate decision).
- A message for a failed `currentAdmin` query (U2; issue comment).
- #39 payment recording.
- Any change to the transition matrix, roles or server messages.
- The list page and drawer (#161).

## Execution risks

- **jsdom timeouts (#205)** in the interaction suite: record and re-run; do not raise timeouts here. The race matrix adds twelve cases to that suite.
- **Same-tick clicks in `act`:** the race rows depend on both handlers running before React re-renders. This is no longer assumed: [H1](#race-harness-check-h1) checks it in this React and jsdom, each row asserts the second control is still enabled between the clicks, and the [lock probe](#lock-probe) shows where each loser was refused. In lock-removal runs a row is judged by its recorded race observation, not by which assertion failed first. If H1 fails, M6 stops and the race technique returns to M4; no alternative technique may be substituted without a plan revision.
- **Fixtures with two owners:** M5, M6, M11 and M12 need a ready estimate on a `WEIGHED` order, built with the #162 harness helpers; M3, M4, M11, M12 need a valid weight row. If a combination cannot be built in the harness, M6 stops and reports it rather than dropping the row.
- **Locale-dependent times:** tests compare against `formatLaundryOrderTime` of the same fixture, never a hard-coded string.
- **Mock completeness:** the page harnesses mock `@clensy/client` per hook; a missing mutation mock throws at render. Task 7 Step 1 adds all ten first.
- **Toast after an order switch (pre-existing, not changed):** an operation started on order A that succeeds after the user moved to order B still shows its success toast (the `ToastProvider` is above the workspace). This is today's behavior for every hook on the page; case 11 does not assert against it, and this slice does not change it.
- **Broader disabling:** the payment buttons, Generate, Confirm price and the weighing editor are disabled during any page mutation (amendment item 4). Existing #162/#166 interaction cases that click one of them while another owner is pending would now be refused; M6 lists any such case and its changed assertion.
