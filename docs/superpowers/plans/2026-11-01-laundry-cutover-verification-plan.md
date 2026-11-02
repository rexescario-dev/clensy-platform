# Laundry End-to-End Verification and Drawer Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan and the owner has separately authorized M6.**

| Field | Value |
| --- | --- |
| Status | **Accepted (revision 2)** at M5, 2026-11-01 ([M5 decision](#m5-decision)). Drafted at M4 on 2026-11-01. Revision 1 was reviewed at M5: **revise before acceptance**, three required corrections. Revision 2 resolves them ([Revision 2 changes](#revision-2-changes)); nothing else changed. When it was Accepted, no command in this plan had been run. M6 is complete, and M7 Approved for merge. M8 is Complete, M9 is Complete and M10 does not apply. **Slice complete:** merged in PR [#218](https://github.com/rexescario-dev/clensy-platform/pull/218) (`20cfba7`, 2026-11-02), and #161 is closed. See [Closeout](#closeout-2026-11-02). Actual results are in the [Execution record (M6)](#execution-record-m6), the [Code review (M7)](#code-review-m7), [Refactoring (M8)](#refactoring-m8) and [Documentation (M9)](#documentation-m9) records. |
| Revision 3 | **Accepted** at M5 by the owner, 2026-11-01: B6 narrowed to the SCHEDULER row only. It was raised at M6 and corrects one Task 1 break assignment ([Revision 3 changes](#revision-3-changes)). Acceptance authorizes no commits (G2) and no later task beyond what the owner approved. |
| Revision 4 | **Accepted** at M5, 2026-11-02 (third-pass independent review: Accept; owner: accepted with seven notes incorporated, [M5 decision for revision 4](#m5-decision-for-revision-4)), raised at M6 Task 6 (K4 failed). Adds [Task 7: keep focus in the weighing editor after a bag is removed](#task-7-keep-focus-in-the-weighing-editor-after-a-bag-is-removed-type-code-revision-4) and widens the scope to the weighing editor. Two independent M5 reviews returned **Revise** (first pass: two blockers; second pass: one blocker); this pass answers both ([first pass](#m5-review-of-revision-4-first-pass), [second pass](#m5-review-of-revision-4-second-pass)). Implementation needs **both** a fresh independent M5 acceptance **and** the owner's explicit acceptance; either alone is not enough. Revisions 2 and 3 stay Accepted for everything else. |
| M5 decision | **Accepted**, 2026-11-01, revision 2. Findings 1–3 resolved; decision (e) confirmed against the live #161. Acceptance authorizes no implementation, branch or environment change: M6 stays blocked until the owner authorizes gates G0 and G1. See [M5 decision](#m5-decision). |
| Date | 2026-11-01 |
| Tracking issue | [#161](https://github.com/rexescario-dev/clensy-platform/issues/161) "Laundry end-to-end verification and responsive polish". Epic [#154](https://github.com/rexescario-dev/clensy-platform/issues/154). Every prerequisite is closed: #163, #160, #156, #155, #158, #162, #166, #165. |
| Branch | `feat/161-laundry-cutover`, from `main` at `563c855`, **created at M6, not before**. One PR for this plan, its M5 record and the implementation (process spec §2.8). |
| Implements (Accepted) | [Laundry Orders & Lifecycle](../specs/2026-09-06-laundry-orders-lifecycle-design.md), Status **Accepted** (2026-09-06), with **Amendment #164**, Accepted 2026-10-10. Governing text is **§8.4.4**: "a row opens `/app/laundry/[id]`"; "Success opens `/app/laundry/[id]` for the new order"; "`/app/laundry?detail=<id>` redirects to `/app/laundry/[id]`, so existing links keep working. The `DetailDrawer` is not the primary detail experience; it is removed once the order page is verified." Also §8.4.1 (positive weight; the UI rejects blank, zero and negative weights), §8.4.5 (the preview writes nothing), §4.3/§4.4 (matrix and verb roles), and §4.9 (status-badge tones, unchanged). |
| Relies on (Accepted, merged) | [Order page plan](2026-10-14-laundry-order-page-plan.md) (#156): `laundryOrderHref`, `laundryDetailRedirectHref`. [Order list plan](2026-10-10-laundry-order-list-plan.md) (#163) and the [#173 drawer-marker plan](2026-10-11-drawer-history-entry-marker-plan.md): the native-history list writes, `openWithHref`/`closeWithHref`, `drawerEntryState`. [Intake modal plan](2026-10-13-laundry-intake-modal-plan.md) (#160): `CreateLaundryOrderDialog` and its `onCreated(orderId)` contract, which stays the same. [Weighing](2026-10-14-multi-entry-laundry-weighing-plan.md) (#155), [price review](2026-10-15-laundry-price-review-plan.md) (#162), [invoice and payment](2026-10-24-laundry-invoice-payment-plan.md) (#166) and [lifecycle actions](2026-10-24-laundry-lifecycle-actions-plan.md) (#165): the order page under test. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. Issue #161, together with its three follow-up comments (from #173/PR #174, #160/PR #179 and #156/PR #183), refines §8.4.4 with the verification script and the cleanup list. File names, test names, task order and the manual-pass layout are planning decisions, not product semantics. |
| Spec amendment | **None needed.** §8.4.4 already requires the redirect, row and create navigation, and the drawer's removal after verification. Nothing here changes an API, schema, role, matrix or copy contract. |
| Scope | `apps/web` only: the list page, `lib/use-detail-drawer.ts`, `lib/use-laundry-order-list-url-state.ts`, their tests, `lib/nav-groups.test.ts`, the order-page interaction test, the customer-picker interaction test, `apps/web/README.md`; and, from revision 4, `components/laundry/laundry-weighing-editor.tsx` (focus after a bag is removed, nothing else) and its test `lib/laundry-weighing-editor.interaction.test.tsx`. `packages/web`: one test file (`laundry-order-actions.test.ts`). **No** API, schema, migration, GraphQL, `@clensy/client`, `@clensy/ui` or dependency change. **No** new test framework. |
| Pre-validation | **None** before M6. Results recorded since are in the [Execution record (M6)](#execution-record-m6); every other `Expected:` line is a prediction until M6 records it. |
| M7 | Application code changes. `CLAUDE.md` requires a **fresh independent reviewer** on the most capable model, one that did not implement the change. Give it the Accepted spec, this plan once Accepted, and the branch diff. The M7 record cites that review. |
| Package names | `pnpm --filter web` is `apps/web`. `pnpm --filter @clensy/web` is `packages/web`. `pnpm --filter api` is `apps/api`. |

**Goal:** Prove the focused laundry workflow end to end, in tests and in one recorded browser pass, then cut `/app/laundry` over to the order page and delete the laundry drawer and its laundry-only history plumbing. Staff should never be able to land in both UIs.

**Architecture:**

- **Navigation:** a row click and a successful create call one page function, `openOrder(id)`. It commits any search still waiting to the list entry, using the existing native `replaceState`, and then calls `router.push(laundryOrderHref(id))`. The list entry stays behind the order page, so browser Back returns to the list URL with its search and filters.
- **Redirect:** `LaundryPage` reads `laundryDetailRedirectHref(useSearchParams())`. When that is non-null, the page renders a small `LaundryDetailRedirect` component, which calls `router.replace(href)` once in an effect and shows `LoadingState`. The list, its query and the dialog are not mounted.
- **Removal:** `page.tsx` keeps only the list and the create modal. `useDetailDrawer` loses `openWithHref` and `closeWithHref`. `drawerEntryState` loses its export. The list URL-state hook stops copying the marker and drops its `set`/`remove` href options, whose only callers were the drawer. `@clensy/ui` `DetailDrawer`, `open`/`close` and the marker stay for the eight other drawer pages.

**Tech Stack:** Next.js 16 App Router (client pages), React 19, Apollo Client, Vitest with jsdom and `renderToStaticMarkup`. The manual pass uses a browser automation tool (Claude in Chrome, or the Playwright plugin's Chromium if Chrome is not connected).

**Spec:** [`docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md`](../specs/2026-09-06-laundry-orders-lifecycle-design.md) §8.4.4 (Amendment #164).

## Global Constraints

- §8.4.4: a row opens `/app/laundry/[id]`. Create success opens `/app/laundry/[id]` for the new order. `/app/laundry?detail=<id>` redirects to `/app/laundry/[id]`.
- §8.4.4: "it is removed once the order page is verified". The drawer is deleted only after the Task 3 verification gate passes.
- #161: do **not** delete `@clensy/ui` `DetailDrawer`. Do **not** leave a feature flag that mounts both UIs.
- #161: no bag table, no payment-recording mutation, no lifecycle change, no new test framework, no Playwright/Storybook harness added to the app.
- #161 acceptance: `apps/web/app/app/laundry/page.tsx` no longer references `DetailDrawer` or `useDetailDrawer`.
- #173 follow-up: the other eight drawer pages keep `open`/`close` and the marker unchanged (`billing`, `bookings`, `catalog`, `catalog/add-ons`, `cleaners`, `cleaners/teams`, `customers`, `jobs`).
- #160 follow-up: the dialog's `onCreated(orderId)` contract stays the same. Only `handleCreated` in `page.tsx` changes.
- Manual-pass records: who ran it, viewport, role, result, for the happy path and the mobile pass (owner instruction, 2026-11-01). The Escape-in-picker check stays in the manual pass (owner instruction; #160 commit `9a0e67a`).

## Review Focus

The five failure modes most likely to reach a user that no unit test fully pins. Each one has a test in its owning task or a numbered manual row.

1. **A search typed just before a row click is lost or applied over the order page.** Task 2 test `commits a waiting search to the list entry, then opens the order page; nothing applies later`; manual row R2.
2. **`?detail=` with a malformed or empty id loops, or lands on a broken order page.** Task 2 tests for invalid and empty `detail`; manual row R4.
3. **The redirect flashes the list or fires the list query first.** Task 2 test `replaces ?detail=<uuid> with the order page and mounts no list` asserts no list query render.
4. **Removing `openWithHref`/`closeWithHref` breaks another drawer page.** Task 4 keeps `use-detail-drawer.test.tsx`'s `open`/`close` suites and the guard test green, and the guard test's `DRAWER_PAGES` drops only laundry.
5. **Mobile users meet a clipped primary action or horizontal page scroll on the order page.** Manual rows M1–M3, with a measured `scrollWidth` check rather than eyeballing.

---

## Planning decisions for M5 to confirm

- **(a) Two-step cutover.** Task 2 wires the row click, create success and the redirect while the drawer code is still in the file. With every `detail` URL redirected, the drawer can no longer mount, but it is not deleted yet. Task 3 verifies the order page in the browser. Only then does Task 4 delete the drawer. This is how the plan meets "removed once the order page is verified" without a flag: the intermediate state exists only on the branch, never on `main`.
- **(b) Redirect mechanism.** A client effect with `router.replace`, not `redirect()` during render. Reasons: it is testable in the existing jsdom harness, which mocks `useRouter`; it writes no history entry; and the list is not mounted while it runs. `redirect()` from `next/navigation` would also replace, but it throws during render, and the harness would have to model that.
- **(c) No list refetch after create.** Today `handleCreated` refetches the list behind the drawer. After the cutover the list unmounts on navigation, and its `network-only` query runs again when the user comes Back. The refetch is dropped. Manual row H1 checks that the new order is in the list after Back.
- **(d) A defect found in a manual pass stops M6.** M6 records the failing row, then asks the owner. A fix not described in this plan needs either a plan revision (M4 → M5) or the owner's explicit authorization as a recorded M6 deviation for M7 to review. The "responsive polish" in the issue title is delivered as verification, plus any fix authorized this way. This plan pre-authorizes no CSS change.
- **(e) "Pickup-plus-pay-now" is the direct `PRICED → PAID` path.** #161's exact wording: "Repeat the branch `PRICED → AWAITING_PAYMENT → PAID` and the delivery branch `READY → AWAITING_DELIVERY` at least as helper-level tests if a full manual pass of both is too long. One manual pass of pickup-plus-pay-now is required; the other branches need automated coverage of the helper plus one UI render each." The happy path it calls for (steps 1–6) generates the invoice with **Pay on completion** (step 4: "FINANCE user generates an invoice with Pay on completion. Order status stays `PRICED`."), then marks the order paid (step 5) without going through `AWAITING_PAYMENT`. "Pay now" therefore means paying straight from `PRICED`, not the `PAY_NOW` invoice term, which the issue never selects. Coverage by branch:
  - **Pickup, pay now** (required manual pass): H1–H6.
  - **Delivery** `READY → AWAITING_DELIVERY → COMPLETED`: the issue requires only helper tests and one render. This plan **also** runs it manually as DL1–DL3 (Task 3), because the extra pass costs one more order.
  - **Pay later** `PRICED → AWAITING_PAYMENT → PAID`: helper rows in Task 1 Step 5, plus the existing render `case 6: AWAITING_PAYMENT offers Mark paid only`. It is **not** run manually; the issue does not require it, and its UI is the same Invoice and payment card that H5 exercises.
- **(f) Roles for the manual pass.** The issue names role *sets*, mapped to concrete roles by `packages/web/src/laundry/laundry-order-actions.ts`. Intake: **CUSTOMER_SUPPORT**. Operational: **SCHEDULER**. Invoice and payment: **FINANCE**. Cancel from `PRICED`: **OPS_MANAGER**. Read-only: **ANALYST**. Each role gets one local staff user, created through `/app/admin` by the seeded TENANT_OWNER.
- **(g) Who runs the manual pass.** Claude drives the local stack through the browser tool. The owner watches and reviews the evidence (owner instruction, 2026-11-01). Each record names "Claude (claude-opus-5-5) via <tool>, observed by the owner".

---

## Owner-approval gates

Accepting this plan at M5 authorizes **none** of the actions below. Each one needs the owner's explicit approval in the session, at the time, and the M6 record notes when it was given. A step that reaches a gate without that approval stops there.

| Gate | Action | Where |
| --- | --- | --- |
| G0 | Start M6 at all (separate from M5 acceptance, owner instruction 2026-11-01) | Before Task 1 |
| G1 | Create the branch `feat/161-laundry-cutover` | Before Task 1 |
| G2 | Each `git commit`. The owner may approve each commit separately, or approve all of this plan's commits at once; either way the approval is recorded. Without it, the work stays uncommitted on the branch and M6 continues. | Task 1 Step 8, Task 2 Step 6, Task 4 Step 7, Task 5 Step 5, Task 7 Step 6 |
| G3 | Stop the `clensy-platform-web-1` container and serve the branch on port 3001 | Task 3 Step 1, Task 6 (rebuild) |
| G4 | Create local staff users | Task 3 Step 2 |
| G5 | Create a catalog service or pricing rule, only if no active `PER_KG` one exists | Task 3 Step 2 |
| G6 | Create laundry orders in the local database (H1, F2, F4, DL1) | Task 3 Step 2, for the whole pass |
| G7 | Start `clensy-platform-web-1` again | Task 6 Step 6 |
| G8 | Push the branch and open the PR | After M6, not part of this plan's tasks |

Reading the local stack's state (`docker compose ps`, signing in, viewing pages) needs no gate.

## Existing coverage this plan relies on (cite, do not duplicate)

| #161 requirement | Existing test |
| --- | --- |
| Weight sum `1.25 + 0.80 + 0.45` → `2.50 kg`, `weightGrams: 2500` | `apps/web/lib/laundry-weighing-editor.interaction.test.tsx` (the `weightGrams: 2500` call, line ~191); `lib/laundry-weight-entries.test.ts` `sums three valid rows to whole grams and allows submit` |
| Zero, blank, negative rows do not submit | `lib/laundry-weight-entries.test.ts` (`blank`, `is not greater than zero`); `lib/laundry-weighing-editor.interaction.test.tsx` (the `blank`/`zero`/`negative` table, line ~207) |
| Double submit sends one mutation: record weight | `lib/laundry-weighing-editor.interaction.test.tsx` `sends one mutation for a double click and disables every control while it is in flight` |
| Double submit sends one mutation: confirm price | `lib/use-confirm-laundry-price.hook.test.tsx` `case 2: a synchronous double invocation sends one request`; `lib/laundry-order-page.interaction.test.tsx` `case 6: a double click before the re-render sends one request` |
| Estimate versus final copy | `lib/laundry-price-card.render.test.tsx` cases 1 and 6; `lib/laundry-price-review.test.ts` |
| Role matrix | `packages/web/src/laundry/laundry-order-actions.test.ts` (ANALYST no verbs; SCHEDULER no cancel/refund/paid; CUSTOMER_SUPPORT no weigh/price); `lib/laundry-order-page.render.test.tsx` Actions cases 1, 2, 4 and invoice case 2 |
| `AWAITING_PAYMENT` UI render | `lib/laundry-order-page.render.test.tsx` invoice `case 6: AWAITING_PAYMENT offers Mark paid only` |
| Delivery branch UI render | `lib/laundry-order-page.render.test.tsx` the `['DELIVERY', 'Mark awaiting delivery', 'Mark awaiting pickup']` row (line ~969) |
| Preview does not change status (API) | `apps/api/test/laundry.e2e-spec.ts` `previews a WEIGHED order without writing anything` and `rejects a preview outside WEIGHED and changes nothing`. These are the only coverage, so Task 6 **re-runs** them. No new API test is added. |
| `detail` redirect helper | `lib/laundry-order-page.test.ts` (`laundryDetailRedirectHref`). Task 2 adds the wiring tests. |

---

## Task 1: Gap tests before the cutover (type: `code`, tests only)

Five groups of tests, each pinning behavior that is already correct on `main`, so **every test in this task is a characterization test**. No production file changes.

**Files:**
- Modify: `apps/web/lib/laundry-customer-picker.interaction.test.tsx` (the test `selects an option by click, keeping focus in the input`)
- Modify: `apps/web/lib/laundry-list-page.interaction.test.tsx` (the `/app/laundry intake modal` describe)
- Modify: `apps/web/lib/nav-groups.test.ts` (the `findActiveHref` describe)
- Modify: `apps/web/lib/laundry-order-page.interaction.test.tsx` (the Actions describe that holds `case 4: Confirm sends once…`)
- Modify: `packages/web/src/laundry/laundry-order-actions.test.ts` (new describe)

**Interfaces:** Consumes the existing harness helpers named below. Produces nothing later tasks use.

- [x] **Step 1: #160 gap T3-b, click selection closes the list.** In `selects an option by click, keeping focus in the input`, focus the input before typing (`act(() => field().focus())`). After the click, add:

  ```ts
  expect(field().getAttribute('aria-expanded')).toBe('false');
  expect(document.activeElement).toBe(field());
  ```

- [x] **Step 2: #160 gap T5-c, the submit guard is released after a validation failure.** New test in `/app/laundry intake modal`:

  ```ts
  it('releases the submit guard after a validation failure: choosing a customer then submitting sends exactly one create', async () => {
    start();
    openCreate();
    await submitCreate();
    expect(nav.receiveCalls).toEqual([]);
    chooseCustomer();
    await submitCreate();
    expect(nav.receiveCalls).toEqual([{ customerId: 'c1', fulfillmentType: 'PICKUP' }]);
  });
  ```

- [x] **Step 3: Laundry stays active on the detail URL.** In `findActiveHref`:

  ```ts
  it('keeps Laundry active on an order page (#161)', () => {
    expect(findActiveHref('/app/laundry/3f2a9c1e-0b7d-4e55-9a10-6c2b8d4e7f01')).toBe('/app/laundry');
  });
  ```

- [x] **Step 4: Cancel from `PRICED`.** New test in the Actions describe, next to case 4, built with that describe's `lifecycle`, `start`, `buttonIn`, `dialog`, `dialogButton`, `finish`, `settleRefetch` and `at`:

  ```ts
  it('case 4b (#161): cancel from PRICED shows the plain-language dialog, then the terminal progress sentence', async () => {
    const cancel = lifecycle('cancelLaundryOrder');
    start('PRICED', 'OPS_MANAGER');
    act(() => buttonIn('actions', 'Cancel order')!.click());
    expect(dialog()?.textContent).toContain(
      'Cancel this order? It will be called off before payment. This cannot be undone.',
    );
    act(() => dialogButton('Cancel order').click());
    expect(cancel.fn).toHaveBeenCalledTimes(1);
    await finish(cancel.list, 0, 'resolve', { data: { cancelLaundryOrder: { id: page.id } } });
    await settleRefetch(0, { order: at('CANCELLED') });
    expect(dialog()).toBeNull();
    expect(container.textContent).toContain('This order was cancelled before payment.');
    expect(container.querySelector('[aria-label="Order progress"]')).toBeNull();
  });
  ```

- [x] **Step 5: Journey helper tests.** In `laundry-order-actions.test.ts`, add `describe('laundry journeys (#161)')` with one `it.each` per journey, each row asserting `laundryOrderActions(status, fulfillment, role)` `toEqual` the exact list. The expected values below come from `LEGAL_VERBS`, `VERB_ROLES` and `LAUNDRY_ORDER_VERBS` order on `main`:

  | Journey | Status | Fulfillment | Role | Expected |
  | --- | --- | --- | --- | --- |
  | happy pickup | RECEIVED | PICKUP | SCHEDULER | `['weigh']` |
  | happy pickup | WEIGHED | PICKUP | SCHEDULER | `['weigh', 'price']` |
  | happy pickup | PRICED | PICKUP | FINANCE | `['markAwaitingPayment', 'markPaid', 'generateInvoice']` |
  | happy pickup (processing not offered before PAID) | PRICED | PICKUP | SCHEDULER | `[]` |
  | happy pickup | PAID | PICKUP | SCHEDULER | `['startProcessing']` |
  | happy pickup | PROCESSING | PICKUP | SCHEDULER | `['markReady']` |
  | happy pickup | READY | PICKUP | SCHEDULER | `['markAwaitingPickup']` |
  | happy pickup | AWAITING_PICKUP | PICKUP | SCHEDULER | `['complete']` |
  | pay later | PRICED | PICKUP | CUSTOMER_SUPPORT | `['markAwaitingPayment', 'markPaid', 'cancel']` |
  | pay later | AWAITING_PAYMENT | PICKUP | CUSTOMER_SUPPORT | `['markPaid', 'cancel']` |
  | pay later | PAID | PICKUP | SCHEDULER | `['startProcessing']` |
  | delivery | READY | DELIVERY | SCHEDULER | `['markAwaitingDelivery']` |
  | delivery | AWAITING_DELIVERY | DELIVERY | SCHEDULER | `['complete']` |

  If a row disagrees with `main` when first run, **stop**. The table, not the helper, is then suspect. Record the actual value and ask the owner before changing either.

- [x] **Step 6: Run and expect PASS** (characterization tests pin current behavior):

  ```bash
  pnpm --filter web exec vitest run lib/laundry-customer-picker.interaction.test.tsx lib/laundry-list-page.interaction.test.tsx lib/nav-groups.test.ts lib/laundry-order-page.interaction.test.tsx
  pnpm --filter @clensy/web exec vitest run src/laundry/laundry-order-actions.test.ts
  ```
  Expected: all pass.

- [x] **Step 7: Break runs (outside the commit, not committed).** For each break, M6 picks the source edit that produces the named behavior, runs the named test file, records the failing test names and assertion, then restores the file and confirms `git status` shows only this task's test changes.

  | Break (behavior) | Run | Expected to fail |
  | --- | --- | --- |
  | B1: selecting a customer by click leaves the list open | picker interaction test | Step 1 test (`aria-expanded`) |
  | B2: selecting a customer by click moves focus off the input | picker interaction test | Step 1 test (`activeElement`) |
  | B3: the create dialog's submit guard stays taken after a submit that fails validation | list interaction test | Step 2 test (0 calls, not 1) |
  | B4: nav matching is exact-path only, so a sub-path never activates its parent item | `nav-groups.test.ts` | Step 3 test, and the existing segment test |
  | B5: progress keeps showing the step list for `CANCELLED` | order-page interaction test | Step 4 test (progress still present); the existing render test `renders the shared progress terminal sentence for a cancelled order` too |
  | B6: `startProcessing` is legal from `PRICED` | `laundry-order-actions.test.ts` | the `happy pickup` `PRICED`/`SCHEDULER` row (revision 3: the `PRICED`/`FINANCE` row is no longer assigned; see [Revision 3 changes](#revision-3-changes)) |
  | B7: the fulfillment branch filter is ignored (both pickup and delivery are offered from `READY`) | `laundry-order-actions.test.ts` | both `READY` rows, and the existing `never offers both pickup and delivery` |

- [x] **Step 8: Commit, owner-approval gate G2** (only the five test files). Without approval, leave the changes uncommitted and continue:

  ```bash
  git commit -m "test(161): pin the #160 gaps, nav, cancel-from-PRICED and the laundry journeys"
  ```

## Task 2: Open orders on the order page and redirect `?detail=` (type: `code`)

Implements §8.4.4's row, create-success and redirect sentences. The drawer code stays in the file for now (decision a), but no URL can mount it.

**Files:**
- Modify: `apps/web/app/app/laundry/page.tsx`
- Test: `apps/web/lib/laundry-list-page.interaction.test.tsx`, `apps/web/lib/laundry-list-page.test.tsx`

**Interfaces:**
- Consumes: `laundryOrderHref(id: string): string` and `laundryDetailRedirectHref(search: URLSearchParams | string): string | null` from `apps/web/lib/laundry-order-page.ts`; `useRouter` from `next/navigation`.
- Produces: in `page.tsx`, `function LaundryDetailRedirect({ href }: { href: string })` (renders `LoadingState`, calls `router.replace(href)` once in an effect), and `openOrder(id: string): void` inside `LaundryPageContent`.

- [x] **Step 1: Write the failing tests** in `laundry-list-page.interaction.test.tsx` `/app/laundry list interactions`. Replace the drawer-specific tests (listed in Step 2) with these:

  ```ts
  it('commits a waiting search to the list entry, then opens the order page; nothing applies later', () => {
    start('status=READY&offset=20');
    act(() => typeSearch('ana'));
    act(() => vi.advanceTimersByTime(100));
    act(() => clickRow());
    act(() => vi.advanceTimersByTime(1000));
    expect(nav.entries).toHaveLength(1);
    const listEntry = new URLSearchParams(nav.entries[0].split('?')[1]);
    expect({ detail: listEntry.get('detail'), q: listEntry.get('q'), status: listEntry.get('status') })
      .toEqual({ detail: null, q: 'ana', status: 'READY' });
    expect(nav.routerCalls).toEqual([`push /app/laundry/${ORDER_ID}`]);
  });

  it('replaces ?detail=<uuid> with the order page and mounts no list', () => {
    start(`status=PAID&detail=${ORDER_ID}`);
    expect(nav.routerCalls).toEqual([`replace /app/laundry/${ORDER_ID}`]);
    expect(nav.queryVariables).toEqual([]);
    expect(container.querySelector('table')).toBeNull();
    expect(container.querySelector('[role="status"]')).not.toBeNull();
  });

  it('replaces an invalid detail with the list, keeping every other param', () => {
    start('status=PAID&detail=not-a-uuid&q=ana');
    expect(nav.routerCalls).toEqual(['replace /app/laundry?status=PAID&q=ana']);
  });

  it('replaces an empty detail with the list', () => {
    start('detail=');
    expect(nav.routerCalls).toEqual(['replace /app/laundry']);
  });
  ```

  In `/app/laundry intake modal`, rename and rewrite `creates with the chosen customer and fulfillment, toasts, and opens the drawer on the returned id without waiting for the refresh` to `creates with the chosen customer and fulfillment, toasts, and opens the new order page`. Keep the fixture and assertions up to the toast, then replace the drawer assertions with:

  ```ts
  expect(nav.routerCalls).toEqual(['push /app/laundry/new-order']);
  expect(nav.refetchCalls).toBe(0);
  expect(nav.entries).toHaveLength(1);
  ```

  In `lib/laundry-list-page.test.tsx`, replace `keeps the drawer for ?detail= until the order page cutover, loading that order` with `renders no list and no order query for ?detail=, only the redirect's loading state`: with `page.search = \`q=ana&detail=${order.id}\``, `page.ordersQueryOptions` and `page.orderQueryOptions` stay empty and the HTML contains `role="status"`. That file's `next/navigation` mock already provides `useRouter`. `renderToStaticMarkup` runs no effects, so the redirect's `replace` is asserted only in the interaction test.

- [x] **Step 2: Remove the drawer-only tests** from `/app/laundry list interactions`. Each one asserts drawer behavior that §8.4.4 retires:
  - `commits a waiting search to the list entry, then pushes the drawer; nothing applies later` (replaced by the first test above)
  - `returns to the list as typed when the drawer is closed with Back`
  - `keeps detail for a list update made right after opening, before React re-renders`
  - `opens the new order after create with the live list URL, natively, before React re-renders`
  - `closes a drawer reached by a direct link with the live list URL, natively`
  - `leaves no empty "?" when closing a direct-link drawer removes the last param`
  - `closes a drawer opened from the list with Back`
  - `goes Back again when the drawer reappears through Forward, leaving no duplicate entry` (#173)
  - `keeps the drawer marker through a list update made while the drawer is open` (#173)

  Rewrite two to keep the list-only half:
  - `keeps the hash and every unrelated param when opening the drawer and on list updates` becomes `keeps the hash and every unrelated param on list updates`. Drop the row click and the last assertion.
  - `lets Back and Forward restore the URL, controls, query and drawer of the entry the user goes to` becomes `lets Back and Forward restore the URL, controls and query of the entry the user goes to`, with `start('status=READY', '', ['status=PAID'])`. `goBack()` gives status `PAID` in the URL, the select and the last query variables. `goForward()` gives `READY` in all three. `nav.routerCalls` stays `[]`.

- [x] **Step 3: Run to verify the new tests fail.**

  ```bash
  pnpm --filter web exec vitest run lib/laundry-list-page.interaction.test.tsx lib/laundry-list-page.test.tsx
  ```
  Expected: FAIL. The row click gives an entry count of 2 and no router call. The `?detail=` tests see no `replace` and a list render. The create test sees no `push`.

- [x] **Step 4: Implement in `page.tsx`.**
  - `LaundryPage` keeps its `Suspense`, now around a new `LaundryRoute` that reads `useSearchParams()`. When `laundryDetailRedirectHref(searchParams)` is non-null, `LaundryRoute` renders `<LaundryDetailRedirect href={…} />`. Otherwise it renders `<LaundryPageContent />`.
  - `LaundryDetailRedirect`: `useRouter()`, then `useEffect(() => router.replace(href), [router, href])`, and render `<LoadingState />`.
  - `openOrder(id)`: `const pending = search.takePending(); if (pending !== undefined) setListState((c) => withLaundryFilterChange(c, { search: pending }));` then `router.push(laundryOrderHref(id))`.
  - `handleRowClick(row)` calls `openOrder(row.id)`.
  - `handleCreated(orderId)` calls `setFormOpen(false)`, `toast.success(t('create.success'))` and `openOrder(orderId)`. The `ordersQuery.refetch()` call is removed (decision c).
  - Replace the two `// Until the order page cutover (#161)…` comments with one comment on `openOrder` saying why the waiting search is committed first: so Back returns to the list as typed.
  - Update the comment above `useDetailDrawer()`. It is now only used to read `activeId` until Task 4 deletes it.

- [x] **Step 5: Run to verify the tests pass.** Same command as Step 3. Expected: PASS. Then:

  ```bash
  pnpm --filter web exec tsc --noEmit
  pnpm --filter web lint
  ```
  Expected: exit 0 for both.

- [x] **Step 6: Commit, owner-approval gate G2.** Without approval, leave the changes uncommitted and continue.

  ```bash
  git commit -m "feat(161): open laundry orders on their page and redirect ?detail="
  ```

## Task 3: Order-page verification gate, browser pass A (type: `code`, verification only)

Implements "once the order page is verified" (§8.4.4). This task runs on the Task 2 build. **Task 4 MUST NOT start until every row below is recorded Pass**, or until the owner has explicitly accepted a recorded failure per decision (d).

**Environment** (each step that changes the environment or data names its [owner-approval gate](#owner-approval-gates)):

- [x] **Step 1: Prepare the stack.** `docker compose ps -a` shows Postgres healthy, `migrate` exited 0 and `api` running. **Gate G3** before stopping `clensy-platform-web-1`. The API's CORS allows only `http://localhost:3001`, which is why the branch must be served there. Then run `pnpm --filter web build` and serve the branch on 3001 with `next start` (as in the #165 M6 record). If `next dev` is used instead and fails on the file-watch limit, fall back to build + start.
- [x] **Step 2: Prepare data.** Sign in as the seeded TENANT_OWNER. **Gate G4** before creating one staff user each for CUSTOMER_SUPPORT, SCHEDULER, FINANCE, OPS_MANAGER and ANALYST through `/app/admin`. Check `/app/catalog` for an active service with a `PER_KG` pricing rule; if there is none, **gate G5** before creating one. **Gate G6** before the first order is created; that one approval covers the four orders this pass creates (H1, F2, F4, DL1). Passwords stay out of the record.
- [x] **Step 3: Run the rows below at 1280×800** with the browser tool. Record a GIF for H1–H6 (`laundry_161_happy_path.gif`) and one for DL1–DL3 (`laundry_161_delivery.gif`), and screenshots for the rest. Collect request evidence by the evidence rule below.

**Evidence rule.** A row is **Pass** only when its evidence is recorded. Request evidence (the operation name, the count, and the variables) is required for H2 (`weighLaundryOrder` ×1, `weightGrams: 2500`), H3 (`previewLaundryOrderPrice` ≥1, then `priceLaundryOrder` ×1), H4 (`generateInvoiceFromOrder` ×1, `paymentTerms: PAY_ON_COMPLETION`), H5 (`markLaundryOrderPaid` ×1) and F4 (`cancelLaundryOrder` ×1). These are the schema's root fields. The request's `operationName` is the matching PascalCase document name, for example `MarkLaundryOrderPaid`; record both. Collect it in this order:

1. **The browser tool's network reader**, if it exposes request bodies: filter on `/graphql` from the row's first action to its last, and record each mutation's `operationName` and `variables`.
2. **Otherwise, a page-level recorder**: before the row, run a script through the tool's script runner that wraps `window.fetch` to append `{ operationName, variables }` for each `/graphql` request to `window.__laundry161Requests`, then read that array back after the row. This only observes requests: it does not delay, change or drop them. It lasts until the page reloads, so it is installed again after each full navigation.
3. **If neither is available**, record the row as **Not verified: no request evidence (<tool limitation>)** and stop the pass for the owner to decide. A visual result alone never makes a request-evidence row Pass.

Rows without request evidence need a screenshot (or a GIF frame) showing the expected state. Record the tool used and its version for every row.

**Record format** (one table, appended to this plan's M6 record):

| Row | Ran by | Viewport | Role | Steps | Expected | Result | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |

"Ran by" is `Claude (claude-opus-5-5) via <Claude in Chrome | Playwright Chromium>, observed by the owner`. "Result" is **Pass** or **Fail: <what was seen>**.

**Happy path (customer pickup, direct mark-paid; decision e):**

| Row | Role | Steps | Expected |
| --- | --- | --- | --- |
| H1 | CUSTOMER_SUPPORT | On `/app/laundry`, "+ New Laundry Order"; type part of the seeded customer's name; choose them from the results; keep Customer pickup; Create order. Then Back. | "Laundry order created." toast; URL is `/app/laundry/<new id>`; the header shows the customer and Received. After Back: the list URL, with the new order in the list. |
| H2 | SCHEDULER | On that order: enter `1.25`, add a row with `0.80`, add a row with `0.45`; Record weight. | Combined total `2.50 kg` before submit. Exactly one `weighLaundryOrder` request, with `weightGrams: 2500`. Status Weighed. |
| H3 | SCHEDULER | Choose the per-kg service; wait for the estimate; Confirm price. | "Estimate" shown from a `previewLaundryOrderPrice` request. Exactly one `priceLaundryOrder` request. Then "Final price", status Priced, and the weighing editor replaced by the locked sentence. |
| H4 | FINANCE | Choose Pay on completion; Generate invoice. | Invoice number shown with Unpaid. Status still Priced. |
| H4b | SCHEDULER | Open the same order. | No Start processing, no Generate invoice, no Mark paid. |
| H5 | FINANCE | Mark paid. | Status Paid; "Paid. Processing can start." |
| H6 | SCHEDULER | Start processing → Mark ready → Mark awaiting pickup → Complete order. | Each status in turn. Mark awaiting delivery is never offered. Ends Completed. |

**Delivery journey** (decision e; beyond what the issue requires):

| Row | Role | Steps | Expected |
| --- | --- | --- | --- |
| DL1 | CUSTOMER_SUPPORT, then SCHEDULER, then FINANCE | Create an order with **Delivery**. As SCHEDULER, record one weight and confirm a price. As FINANCE, Mark paid. | URL `/app/laundry/<id>` after create; the header shows Delivery; status reaches Paid. |
| DL2 | SCHEDULER | Start processing → Mark ready. | At Ready, Actions offers **Mark awaiting delivery** and never Mark awaiting pickup. |
| DL3 | SCHEDULER | Mark awaiting delivery → Complete order. | Status Awaiting delivery, then Completed. Request evidence: `markLaundryOrderAwaitingDelivery` ×1, `completeLaundryOrder` ×1. |

**Failure and permission:**

| Row | Role | Steps | Expected |
| --- | --- | --- | --- |
| F1 | ANALYST | Open `/app/laundry` and the H1 order's URL. | List visible with no "+ New Laundry Order". Order page: no buttons or inputs in Weighing, Services, Price, Invoice and payment or Actions. |
| F2 | CUSTOMER_SUPPORT | Create a second order (pickup), stay on it. | No weighing editor or Record weight; no Confirm price. |
| F3 | SCHEDULER | Open the H1 order at Completed, and a Paid order if one exists (the H5 state, observed before H6). | No Generate invoice and no Refund order at any point. |
| F4 | OPS_MANAGER, then SCHEDULER to weigh/price | Take a third order to Priced; as OPS_MANAGER, Cancel order. | Dialog reads "Cancel this order? It will be called off before payment. This cannot be undone."; after Confirm: "Order cancelled." and the terminal sentence "This order was cancelled before payment." |

**Route regression:**

| Row | Role | Steps | Expected |
| --- | --- | --- | --- |
| R1 | TENANT_OWNER | Load `/app/laundry?detail=<H1 id>` in the address bar. Then Back. | URL becomes `/app/laundry/<H1 id>`. Back does not return to the `?detail=` URL. |
| R2 | TENANT_OWNER | On the list, set Status = Completed and search the customer; click the H1 row; browser Back. | The list URL has the same `q` and `status`, and the controls show them. |
| R3 | TENANT_OWNER | On `/app/laundry/<id>`, inspect the sidebar. | The Laundry item is current (`aria-current="page"`). |
| R4 | TENANT_OWNER | Load `/app/laundry?detail=nope&status=PAID`. | URL becomes `/app/laundry?status=PAID`, and the list shows that filter. |

- [x] **Step 4: Gate.** Every row (H, DL, F, R) is Pass with its evidence, and the console shows no errors other than a known `favicon.ico` 404. A row that is **Not verified** blocks the gate just as a Fail does. Record the M6 "order page verified" line with the date. On any Fail, stop (decision d).

## Task 4: Delete the laundry drawer and its laundry-only plumbing (type: `code`)

Implements the §8.4.4 removal and the #173 follow-up.

**Files:**
- Modify: `apps/web/app/app/laundry/page.tsx`
- Modify: `apps/web/lib/use-detail-drawer.ts`
- Modify: `apps/web/lib/use-laundry-order-list-url-state.ts`
- Modify: `apps/web/lib/use-detail-drawer.test.tsx`, `apps/web/lib/use-detail-drawer.guard.test.ts`, `apps/web/lib/laundry-list-page.interaction.test.tsx`, `apps/web/lib/laundry-list-page.test.tsx`
- Test (new assertion): `apps/web/lib/laundry-list-page.test.tsx`

**Interfaces:**
- Produces: `useDetailDrawer(paramName?)` returns `{ activeId, close, open }`. `drawerEntryState` is module-private. `useLaundryOrderListUrlState()` returns `{ hrefFor, setState, state }` with `hrefFor(update: LaundryOrderListUpdate): string`. `LaundryOrderHrefParams` is removed.

- [x] **Step 1: Write the failing test** in `laundry-list-page.test.tsx`:

  ```ts
  it('is the list and the create modal only: no drawer, no drawer hook (#161)', () => {
    const source = readFileSync(new URL('../app/app/laundry/page.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/\bDetailDrawer\b/);
    expect(source).not.toMatch(/\buseDetailDrawer\b/);
  });
  ```

  In `use-detail-drawer.guard.test.ts`, remove `'apps/web/app/app/laundry/page.tsx'` from `DRAWER_PAGES`. Its test `usingHook … toEqual([...DRAWER_PAGES])` then fails until the page stops calling the hook.

- [x] **Step 2: Run to verify it fails.**

  ```bash
  pnpm --filter web exec vitest run lib/laundry-list-page.test.tsx lib/use-detail-drawer.guard.test.ts
  ```
  Expected: FAIL on both new expectations.

- [x] **Step 3: Delete from `page.tsx`:** `LaundryDetailDrawer`, `InvoiceSection`, `STATUS_TONE`, `MATRIX`, `RefVerb`, `TARGET_TO_VERB`, `DESTRUCTIVE`, `VERB_LABEL`, `formatWeight`, `BILLABLE_STATUSES`, `INVOICE_ROLES`, `PAYMENT_TERMS`, the `useDetailDrawer` call and the `{activeId ? …}` mount, plus every import that is then unused (the mutation hooks, `useLaundryOrderQuery`, `useServicesQuery`, `useInvoiceForOrderQuery`, `ConfirmDialog`, `DetailDrawer`, `ErrorState`, `StatusBadge`, `StatusTone`, `LaundryOrderStatus`, `Link`, `useDetailDrawer`). `hrefFor` is no longer destructured. Keep `useToast`, `PageHeader`, `Button`, `LoadingState`, the list and the dialog.

- [x] **Step 4: Trim the hooks.**
  - `use-detail-drawer.ts`: delete `openWithHref`, `closeWithHref` and their comment block. Drop `export` from `drawerEntryState` (its last outside importer goes in the next bullet). Change the return to `{ activeId, close, open }`. In the header comment, replace the `closeWithHref` mention with the `close` path only.
  - `use-laundry-order-list-url-state.ts`: remove the `drawerEntryState` import, and write `window.history.replaceState(null, '', href)` in `setState`. Delete `LaundryOrderHrefParams` and the `set`/`remove` options of `hrefFor`. Rewrite the native-history comment block so it describes list updates (`replaceState`), Back/Forward, and navigation to an order through `router.push` from the page. Remove the "drawer's `detail`" wording in the two type comments; `detail` is now just a param the list does not own and carries through.
  - **Grep check:** `grep -rn "openWithHref\|closeWithHref\|drawerEntryState\|LaundryOrderHrefParams" apps/web packages --include=*.ts --include=*.tsx | grep -v node_modules` returns only the private `drawerEntryState` inside `use-detail-drawer.ts`.

- [x] **Step 5: Trim the tests.**
  - `use-detail-drawer.test.tsx`: delete `LaundryLikePage` and its three tests, `closeWithHref replaces an entry it did not push`, `closeWithHref goes Back for an entry it pushed, after Forward too, and never replaces it` and `closeWithHref goes Back once for × then × again, and never replaces the entry`. Every `open`/`close` test stays.
  - `laundry-list-page.interaction.test.tsx`: remove the mocks the page no longer imports (the 14 lifecycle/weigh/price mutation hooks, `useGenerateInvoiceFromOrderMutation`, `useInvoiceForOrderQuery`, `useLaundryOrderQuery`, `useServicesQuery`) and `nav.orderQueryIds`. Fix the `dialog()` helper comment, which no longer has a drawer to tell apart. Keep `nav.entryStates`: list writes now pass `null`, and the existing `showEntry` still reads it.
  - `laundry-list-page.test.tsx`: remove the same now-unused mocks and `page.orderQueryOptions`, where present.

- [x] **Step 6: Run to verify everything passes.**

  ```bash
  pnpm --filter web test
  pnpm --filter web exec tsc --noEmit
  pnpm --filter web lint
  ```
  Expected: all exit 0. `use-detail-drawer.guard.test.ts` passes with eight drawer pages.

- [x] **Step 7: Commit, owner-approval gate G2.** Without approval, leave the changes uncommitted and continue.

  ```bash
  git commit -m "feat(161): remove the laundry drawer and its laundry-only history helpers"
  ```

## Task 5: README (type: `docs/process`)

TDD does not apply. Verification: the grep and read-through below.

**Files:** Modify `apps/web/README.md` ("Laundry list", "Laundry intake").

- [x] **Step 1:** In **Native history writes**, keep the list-update and Back/Forward bullets. Replace the "Opening the drawer", "Closing the drawer" and "List updates made while a drawer is open" bullets with one bullet: a row opens `/app/laundry/[id]` with `router.push`, after committing a waiting search to the list entry, so Back returns to the list as typed. Replace "The page makes no `router.push` or `router.replace` of its own." with a sentence saying the only router calls are that push and the `?detail=` redirect's `replace`, made when the list is leaving or not mounted. Add: `/app/laundry?detail=<id>` replaces to the order page (`laundryDetailRedirectHref`); an empty or invalid `detail` replaces to the list without it.
- [x] **Step 2:** In **Drawer hook**, delete the sentence about the two laundry-only methods, and say the hook serves the eight drawer pages with `open` and `close`. Delete the line "Until #161, a row opens the drawer…".
- [x] **Step 3:** In **Laundry intake → Success**, say the page closes the dialog, toasts "Laundry order created." and opens `/app/laundry/<id>`. Delete "Until #161…".
- [x] **Step 4: Verify.** `grep -n "openWithHref\|closeWithHref\|Until \[#161\]\|Until #161" apps/web/README.md` prints nothing. `grep -rn "#161" docs/features/laundry.md` gets checked, and any "until #161" wording there gets the same fix.
- [x] **Step 5: Commit, owner-approval gate G2.** `git commit -m "docs(161): describe the order-page cutover"`. Without approval, leave the change uncommitted.

## Task 6: Final verification, browser pass B and gates (type: `code`, verification only)

On the final branch build (rebuild and serve as in Task 3 Step 1, under the same gate G3 approval, or a fresh one if the container was restarted in between). Task 3's evidence rule applies to every row here.

- [x] **Step 1: Re-run route regression** R1–R4 from Task 3 against the final build, plus:

| Row | Role | Steps | Expected |
| --- | --- | --- | --- |
| R5 | TENANT_OWNER | On a list row, check that no drawer opens anywhere: click a row; load `?detail=<id>`. | Always the order page; no `role="dialog"` drawer on `/app/laundry`. |

- [x] **Step 2: Mobile pass at 375×812** (below `sm`, 640 px). Use the same record format. Measure horizontal scroll with `document.documentElement.scrollWidth <= window.innerWidth` through the tool's script runner, and screenshot each row.

| Row | Role | Steps | Expected |
| --- | --- | --- | --- |
| M1 | SCHEDULER | `/app/laundry` | Orders as cards, not a table. No horizontal page scroll. |
| M2 | SCHEDULER | A Received order: add three weight rows; scroll the page. | Sections stack in one column. Weight inputs and the remove buttons are usable. The combined total is visible without horizontal scroll. No horizontal page scroll. |
| M3 | CUSTOMER_SUPPORT, then SCHEDULER | Scroll to "+ New Laundry Order" and the dialog's Create order; Record weight; Confirm price on a Weighed order. | Each one fully on screen after scrolling, not clipped. |
| M4 | SCHEDULER | Read the status badges on the list and the order page. | Each status has a text label, so it is not conveyed by color alone. |

- [x] **Step 3: Keyboard and focus pass at 1280×800**, keyboard only:

| Row | Role | Steps | Expected |
| --- | --- | --- | --- |
| K1 | CUSTOMER_SUPPORT | Open the create dialog; type a name; ArrowDown; Enter. | The option is selected, the list is closed, focus stays in the input, and the form is not submitted. |
| K2 (Escape in picker) | CUSTOMER_SUPPORT | Type to open the list; press Escape once; then Escape again. | First Escape closes **only** the list; the dialog stays open. Second Escape closes the dialog. (#160, commit `9a0e67a`; jsdom cannot show this, so it must be checked here.) |
| K3 | CUSTOMER_SUPPORT | Tab to the fulfillment radios; arrow keys. | The selection moves between Customer pickup and Delivery. |
| K4 | SCHEDULER | In Weighing, add a row and remove a row with Tab and Enter/Space. | A row is added and removed; focus stays in the editor. |
| K5 | OPS_MANAGER | Tab to Cancel order on a Received order; Enter; Tab to the dialog's buttons; Escape. | The dialog's Cancel and Cancel order buttons can be reached and activated from the keyboard; Escape closes it with nothing sent. (`@clensy/ui` `Modal` has no focus trap today. Record where focus goes, but a missing trap is not a #161 failure.) |
| K6 | any | Tab to the back link on the order page; Enter. | `/app/laundry` opens. |
| K7 | any | Screenshot a focused input, button and link. | A visible focus ring (`focus:ring-2` or the shared equivalent). |

- [x] **Step 4: Desktop check at 1280×800.**

| Row | Role | Steps | Expected |
| --- | --- | --- | --- |
| D1 | TENANT_OWNER | `/app/laundry` | A table with its columns. |
| D2 | TENANT_OWNER | An order page | The summary grid uses more than one column. |

- [x] **Step 5: Automated gates.**

  ```bash
  pnpm --filter web test
  pnpm --filter web exec tsc --noEmit
  pnpm --filter web lint
  pnpm --filter @clensy/web test
  pnpm --filter @clensy/web build
  pnpm --filter api test:e2e -- laundry.e2e-spec
  ```
  Expected: all exit 0. The last command needs the local Postgres, and it re-runs the two preview tests cited above. If the e2e cannot run (no database), record it as **Not run** with the reason. Do not claim it.

- [x] **Step 6: Restore the environment.** Stop the branch server, then **gate G7** before starting `clensy-platform-web-1` again. Record the test data left in the local database (order ids, staff users created).

- [x] **Step 7: M6 record.** Append to this plan: the actual command results, the break-run results (Task 1 Step 7 and Task 7 Step 4b), the build each browser row ran on (the Task 6 build before Task 7, or the rebuild after it), the browser tables from Tasks 3 and 6 with evidence paths, deviations, and the M6 Slice Completion Report. The PR description carries the manual-pass tables (#161 acceptance: "The manual script in the PR records who ran it, the viewport, the role, and the result").

---

## Traceability

| Task | Spec / issue source |
| --- | --- |
| 1 | #161 "Automated tests cover the weight sum, the role matrix, the estimate-versus-final copy…" (cited coverage plus new journey rows); #161 Failure and permission (cancel from PRICED); #161 Route regression (nav active); #160 follow-up comment (T3-b, T5-c) |
| 2 | §8.4.4 row / create success / `?detail=` redirect; #160 follow-up (`handleCreated`); #156 follow-up (helpers) |
| 3 | §8.4.4 "removed once the order page is verified"; #161 Happy path, Failure and permission, Route regression |
| 4 | §8.4.4 removal; #161 Remove obsolete UI and acceptance; #173 follow-up comment |
| 5 | #173 follow-up comment (README sections) |
| 6 | #161 Mobile and accessibility, desktop check, preview e2e re-run; owner instruction (Escape-in-picker) |
| 7 | The Accepted K4 Expected ("focus stays in the editor"), with WCAG 2.4.3 Focus Order as its rationale; #161 Mobile and accessibility ("add/remove weight row") as the scope it sits in; owner decisions 2026-11-01 (fix in this slice, decision (d)) and 2026-11-02 (one rule for every input method) |

## Deferred and out of scope

- New test frameworks or an in-app browser harness (#161).
- #44 dashboard, #39 payments, bookings/customers/billing redesign (#161).
- The section-nav history entries noted in the #156 follow-up ("optional polish"). Not requested here.
- Any CSS or layout fix found by the mobile pass, unless authorized under decision (d).
- Any change to `@clensy/ui` `DetailDrawer` or the eight other drawer pages.

## Self-check (planner)

| Check | Result |
| --- | --- |
| Every task traces to the Accepted spec or issue #161 | Yes (Traceability) |
| No new product semantics | Yes: navigation targets, redirect and removal are §8.4.4 text. Task 7 is presentation only (where focus goes after a remove): no data, request, role or copy change. |
| Order executable without inventing work | Yes: 1 → 2 → 3 (gate) → 4 → 5 → 6 through K4 (stopped) → 7 → 6 from K4 onward (the K4 re-run, the repeated rows in [Retained Task 6 evidence](#retained-task-6-evidence), then K5, D1, D2 and Steps 5–7) |
| Characterization tests labelled, with break, covered tests and outside-commit run | Task 1 Step 7; Task 7 Step 4b (test 6) |
| Every task typed | 1, 2, 3, 4, 6, 7 `code`; 5 `docs/process`. No `configuration` task. |
| Pre-validation claim | None made |

## Revision 2 changes

M5 review of revision 1 (2026-11-01) asked for three corrections before acceptance and found the cutover and scope boundaries sound (finding 4). Revision 2 changes only these:

| Finding | Change |
| --- | --- |
| 1. The browser gate does not cover the delivery path; confirm the "pickup plus pay now" reading | Decision (e) now quotes #161's exact wording and gives the coverage for each branch. A manual delivery journey, **DL1–DL3**, is added to Task 3 and to its gate. The pay-later branch stays automated only, as the issue allows, and the reason is stated. |
| 2. No fallback for request evidence | Task 3 has an **Evidence rule**: it lists the rows that need request evidence and the exact operation, count and variables each one needs. It tries the network reader first, then a page-level `fetch` recorder that only observes, and otherwise records **Not verified** and stops. A Not verified row blocks the gate. Task 6 applies the same rule. |
| 3. Commit steps conflict with the approval boundary | A new **Owner-approval gates** section (G0–G8) states that M5 acceptance authorizes none of them. Every commit step is now gate G2, and without approval the work stays uncommitted. The environment and data steps in Tasks 3 and 6 name their gates (G3–G7). Order creation (G6) and the PR (G8) are now listed explicitly. |

Unchanged from revision 1: the header scope, the Global Constraints, the Review Focus, decisions (a)–(d), (f) and (g), the cited coverage, Tasks 1, 2, 4 and 5 except their commit-step wording, the Task 6 rows and gates, Traceability and Deferred. Revision 1 → 2 is the diff of this file.

## M5 decision

**Accepted**, 2026-11-01, revision 2.

| Round | Revision | Outcome |
| --- | --- | --- |
| 1 | 1 | **Revise before acceptance.** Three required corrections: (1) the browser gate did not cover the delivery path, and the "pickup plus pay now" reading needed confirming; (2) no fallback for request evidence; (3) the commit steps conflicted with the approval boundary. Finding 4: the cutover and scope boundaries are sound. |
| 2 (focused) | 2 | **Accept**, subject to checking the decision (e) quote against the live issue. Findings 1–3 resolved. |

**Source check for decision (e)** (2026-11-01, `gh issue view 161`; the issue was last updated 2026-10-14T02:22:53Z):

- The branch-coverage sentence quoted in decision (e) appears **verbatim** in the #161 body.
- The step 4 quote ("FINANCE user generates an invoice with Pay on completion. Order status stays `PRICED`.") appears **verbatim** in the body.
- `PAY_NOW` does not appear in the body. "pay-now" appears once, in the quoted sentence.
- None of the three follow-up comments (2026-10-12, 2026-10-13, 2026-10-14) mentions pay-now, delivery, `AWAITING_PAYMENT` or invoice terms, so none changes the reading.
- Result: decision (e) is **confirmed**; no further revision is needed.

**What acceptance does not authorize:** implementation, creating the branch, commits, stopping or starting containers, creating users, services or orders, pushing, or opening a PR. Each stays behind its [owner-approval gate](#owner-approval-gates). M6 is blocked until the owner authorizes G0 (start M6) and G1 (create the branch).

## Revision 3 changes

**Status: Accepted** at M5 by the owner, 2026-11-01. It was raised at M6 Task 1 Step 7. The owner's words: "a correction to the test plan, not a change to the implementation or test code. Re-run B6 and record the actual result before treating Task 1 as fully verified."

**Finding (M6 step 3.6, unsuccessful break run).** B6 (`startProcessing` legal from `PRICED`) was assigned "the `PRICED`/`SCHEDULER` and `PRICED`/`FINANCE` rows". The run made `happy pickup: PRICED PICKUP as SCHEDULER` fail as predicted, but `happy pickup: PRICED PICKUP as FINANCE` **passed**. FINANCE is not in the operational role set, so no change to which statuses allow `startProcessing` can alter what FINANCE is offered. That was a planning error. The run is therefore not characterization evidence for the FINANCE row.

**Change.** B6's assignment becomes the `happy pickup` `PRICED`/`SCHEDULER` row only. The break, the test file and the test code are unchanged. The FINANCE row stays in the test as a role-matrix assertion; it is pinned by the existing role tests (`never shows SCHEDULER cancel, refund or paid; …`, the API-oracle rows), not by B6.

**Unchanged.** Everything else in revision 2, including B1–B5 and B7 and their recorded outcomes.

**After M5 accepts revision 3**, M6 re-runs B6 against the new assignment and records it. (The run already made shows that row failing; M6 repeats it, so the evidence matches the accepted assignment.)

## Execution record (M6)

Branch `feat/161-laundry-cutover` from `main` at `563c855`, created 2026-11-01. The owner approved G0 and G1 ("m6"), then G3, G4, G5 (conditional) and G6, and accepted revision 3 at M5. **G2 is not approved**: nothing is staged or committed.

### Task 1 (characterization tests)

- Run: four web files 352/352 pass; `@clensy/web` `laundry-order-actions.test.ts` 241/241 pass.
- Break runs were made outside the commit. Each source file was restored with `git checkout --` and checked clean.

| Break | Assigned test(s) | Result |
| --- | --- | --- |
| B1 click leaves list open | picker `selects an option by click…` | Failed (`aria-expanded` `'true'`). Success |
| B2 click blurs input | same test | Failed (`activeElement` was `<body>`). Success |
| B3 guard kept after invalid submit | `releases the submit guard…` | Failed (`[]`, not one call); no other intake test failed. Success |
| B4 exact-path nav | `keeps Laundry active…`, `matches on path segments…` | Both failed, along with other segment tests. Success |
| B5 CANCELLED shows steps | `case 4b (#161)…`, render `renders the shared progress terminal sentence…` | Exactly those two failed. Success |
| B6 (rev. 1 assignment) | PRICED/SCHEDULER and PRICED/FINANCE rows | The FINANCE row **passed**. Unsuccessful for that assignment; returned to M4/M5 as revision 3 |
| B6 (rev. 3 assignment) | `happy pickup: PRICED PICKUP as SCHEDULER` | Failed (`['startProcessing']` vs `[]`). Success |
| B7 fulfillment filter ignored | both READY rows, `never offers both pickup and delivery` | All failed. Success |

### Task 2 (cutover wiring)

- RED: the six new or rewritten tests failed for the predicted reasons.
- GREEN: the two list test files pass 39/39. `pnpm --filter web test` passes 58 files, 2549/2549. `tsc --noEmit` and lint exit 0.

### Task 3: browser pass A, order page verification (2026-11-01)

**Ran by:** Claude (claude-opus-5-5) via the Playwright plugin's Chromium (Claude in Chrome was not connected), observed by the owner. **Viewport:** 1280×800. **Build:** `feat/161-laundry-cutover` working tree after Task 2, `pnpm --filter web build` then `next start -p 3001`. The local Docker API and Postgres were left running; `clensy-platform-web-1` was stopped under G3. **Request evidence:** the Playwright network reader (request events with `postData`), evidence source 1. **Screenshots:** `.superpowers/sdd/2026-11-01-laundry-cutover-verification-plan/evidence/` (gitignored, not committed). Playwright has no GIF recorder, so step screenshots replace the two planned GIFs (ruling in the ledger).

**Setup:**
- G4: five staff users created in the seeded owner's tenant, all Active: `qa161-{customer-support,scheduler,finance,ops-manager,analyst}-48326d@example.test`. Their passwords are kept only in the gitignored workspace.
- G5: the existing active `PER_KG` service "Wash & Fold 1791989995601-…" (₱15.00/kg) was reused; nothing was created.
- G6: four orders were created for the seeded customer Amara Chidi:

| Order | Id | Fulfillment |
| --- | --- | --- |
| H1 | `2b47309e-cbf4-4fb4-a8e9-5b88db169dcc` | PICKUP |
| F2 | `fe8fcfd5-e523-4927-84c0-24466bfaf0bc` | PICKUP |
| DL1 | `590d830a-7fc0-43e2-85f9-4bb7bcb8c286` | DELIVERY |
| F4 | `d250c6f5-99f1-4e54-9df5-50ce7fb8fe3a` | PICKUP |

| Row | Role | Result | Evidence |
| --- | --- | --- | --- |
| H1 | CUSTOMER_SUPPORT | **Pass.** Search "Amara" → "Amara Chidi 555-0110"; pickup checked; one `ReceiveLaundryOrder` `{customerId: …0001, fulfillmentType: PICKUP}`; toast "Laundry order created."; landed on `/app/laundry/2b47309e…` with h1 "Amara Chidi" and status Received; after Back, the URL was `/app/laundry` and the list response included the new id | H1-01…04.png |
| H2 | SCHEDULER | **Pass.** Bags 1.25, 0.80, 0.45 → "Combined weight 2.50 kg"; exactly one `WeighLaundryOrder` with `weightGrams: 2500`; status Weighed | H2-01-three-bags.png |
| H3 | SCHEDULER | **Pass.** One `PreviewLaundryOrderPrice` → "ESTIMATE … 2.50 kg ₱15.00 per kg ₱37.50 Estimated total ₱37.50"; exactly one `PriceLaundryOrder` `{baseServiceId: 90ababd0…, addOns: []}`; then "FINAL PRICE … Order total ₱37.50", status Priced, Weighing "Weight is locked…" with 0 inputs | H3-01-estimate.png, H3-02-final-price.png |
| H4 | FINANCE | **Pass.** Exactly one `GenerateInvoiceFromOrder` `{paymentTerms: PAY_ON_COMPLETION}`; INV-2026-000350, ₱37.50, Unpaid, Pay on completion; status still Priced | H4-invoice.png |
| H4b | SCHEDULER | **Pass.** H1 at Priced: Invoice buttons `[]`, Actions buttons `[]`, so no Start processing, Generate or Mark paid | view-H1-A.png |
| H5 | FINANCE | **Pass.** Exactly one `MarkLaundryOrderPaid`; status Paid; "Paid. Processing can start." | H5-paid.png |
| H6 | SCHEDULER | **Pass.** Offered and clicked in turn: Start processing → Mark ready → Mark awaiting pickup → Complete order (one request each), the status following each time; at Ready only "Mark awaiting pickup" was offered; ends Completed, Actions `[]`, Activity Created/Updated/Completed | H6-completed.png |
| DL1 | CUSTOMER_SUPPORT, SCHEDULER, FINANCE | **Pass.** Created with Delivery (header "Received Delivery"); one weigh (1000 g), one preview, one price (₱15.00); one `MarkLaundryOrderPaid`; Paid | DL1-01-created.png, DL1-priced.png |
| DL2 | SCHEDULER | **Pass.** Start processing → Mark ready; at Ready only "Mark awaiting delivery" was offered, never pickup | DL2-ready.png |
| DL3 | SCHEDULER | **Pass.** Exactly one `MarkLaundryOrderAwaitingDelivery` and one `CompleteLaundryOrder`; Awaiting delivery → Completed | DL3-completed.png |
| F1 | ANALYST | **Pass.** List: no "+ New Laundry Order". H1 page: 0 buttons and 0 inputs in Weighing, Services, Price, Invoice and payment, and Actions | F1-analyst-list.png, F1-analyst-order.png |
| F2 | CUSTOMER_SUPPORT | **Pass.** New order at Received: Weighing "Not weighed yet." (0 inputs, no Record weight); Services and Price have no controls (no Confirm price); Actions only "Cancel order" | F2-cs-received.png |
| F3 | SCHEDULER | **Pass.** Priced: no Generate, no Refund. Paid: Invoice `[]`, Actions only "Start processing". Completed: Actions `[]` (no Refund) | view-H1-A.png, F3-scheduler-paid.png, H6-completed.png |
| F4 | OPS_MANAGER (SCHEDULER weighed and priced) | **Pass.** Priced order offered "Cancel order"; dialog read "Cancel this order? It will be called off before payment. This cannot be undone."; exactly one `CancelLaundryOrder`; toast "Order cancelled."; the dialog closed; terminal sentence "This order was cancelled before payment.", with no progress list | F4-dialog.png, F4-cancelled.png |
| R1 | TENANT_OWNER | **Pass.** `/app/laundry?detail=2b47309e…` → `/app/laundry/2b47309e…`; Back → `/app/bookings`, not the `?detail=` URL | R1-redirected.png |
| R2 | TENANT_OWNER | **Pass.** Status Completed plus search "Amara" → `?q=Amara&status=COMPLETED&…`; the first row (DL1, the newest match) opened `/app/laundry/590d830a…`; Back restored the same URL, with the status control `COMPLETED` and search `Amara` | R2-back-with-filters.png |
| R3 | TENANT_OWNER | **Pass.** On the order page, the Primary nav "Laundry" link has `aria-current="page"` | R3-nav-active.png |
| R4 | TENANT_OWNER | **Pass.** `/app/laundry?detail=nope&status=PAID` → `/app/laundry?status=PAID`; status control `PAID` | R4-invalid-detail.png |

**Console:** the only errors were the known `favicon.ico` 404 and two 400s from this run's own malformed identity-check queries (`currentAdmin { email }`), sent at 55 s and 59 s before the field was corrected. None came from the app.

**Order page verified** (Task 3 Step 4 gate): **passed**, 2026-11-01. Task 4 may start.

### Task 6: browser pass B (in progress, **stopped at K4**, 2026-11-01)

Run on the final build: Tasks 1–5 working tree, rebuilt with `pnpm --filter web build` (exit 0) and served on 3001 under the same G3 approval. Same runner and tool as Task 3. Screenshots are in the same evidence folder. The R1–R4 shots were overwritten by the final-build shots.

| Row | Role | Viewport | Result |
| --- | --- | --- | --- |
| R1–R4 (re-run) | TENANT_OWNER | 1280×800 | **Pass.** Identical results to Task 3 |
| R5 | SCHEDULER | 375×812 | **Pass.** 0 dialogs on `/app/laundry`; a card opens `/app/laundry/d250c6f5…`, which has 0 dialogs |
| M1 | SCHEDULER | 375×812 | **Pass.** Table hidden, 9 order cards; `scrollWidth` 360 ≤ `innerWidth` 375 |
| M2 | SCHEDULER | 375×812 | **Pass.** All seven sections at x=24, width 312 (stacked); three bag inputs and "Remove bag 3" fully on screen; "Combined weight 1.75 kg" on screen; no horizontal scroll |
| M3 | CUSTOMER_SUPPORT, SCHEDULER | 375×812 | **Pass.** "+ New Laundry Order", the dialog's "Create order", "Record weight" and "Confirm price" each fully on screen after scrolling; no horizontal scroll. Data: F2 weighed to 1750 g (now Weighed; price not confirmed) |
| M4 | SCHEDULER | 375×812 | **Pass.** Status shown as text on cards ("Cancelled") and in the header ("Received") |
| K1 | CUSTOMER_SUPPORT | 1280×800 | **Pass.** Keyboard open → focus in `#laundry-customer`; type, ArrowDown, Enter → "Amara Chidi", `aria-expanded="false"`, focus stays in the input, dialog open, no `ReceiveLaundryOrder` |
| K2 (Escape in picker) | CUSTOMER_SUPPORT | 1280×800 | **Pass.** List open (`aria-expanded="true"`); first Escape → list closed, dialog still open; second Escape → dialog closed |
| K3 | CUSTOMER_SUPPORT | 1280×800 | **Pass.** ArrowDown from Customer pickup → Delivery checked and focused; ArrowUp → Customer pickup |
| K4 | SCHEDULER | 1280×800 | **Fail.** Add and remove work by keyboard (1 → 2 → 1 rows; Shift+Tab from "Add bag" reaches "Remove bag 2"; Space removes it). After the remove, **focus drops to `<body>`**, outside the editor. Expected: "focus stays in the editor". Pre-existing #155 behavior: the editor restores focus only after a blocked submit or a settled save, and no test covers focus after a remove. Evidence: K4-after-remove.png |
| K6 | CUSTOMER_SUPPORT | 1280×800 | **Pass.** Enter on the focused "Back to laundry orders" → `/app/laundry` |
| K7 | CUSTOMER_SUPPORT, SCHEDULER | 1280×800 | **Pass.** Tab-focused link: visible focus outline. Tab-focused "Add bag": `focus-visible:ring-3 ring-ring/50` gives a 2.5 px ring (absent when unfocused). Customer input: ring style present. Evidence: K7-*.png |

**Incident (no data change):** the first K4 script assumed that "Add bag" moves focus to the new row. It does not, so the script's Space press landed on "Record weight". The blank new row blocked the submit ("Enter a weight."). GraphQL confirms F2 unchanged: Weighed, 1750 g, `updatedAt` 14:33:35Z from M3b.

**Stopped under decision (d).** Not yet run: K5, D1, D2, Step 5 (automated gates, including the preview e2e), Step 6 (restore, G7) and Step 7. The owner decides how K4 is handled.

### Task 7 (revision 4): focus after a bag is removed (2026-11-02)

Run under the owner's revision 4 acceptance (2026-11-02), after the seven review notes were incorporated. Nothing is staged or committed (G2 not approved).

- **Step 1–2 (RED):** six tests added to `laundry weighing editor`. `vitest run lib/laundry-weighing-editor.interaction.test.tsx` → **5 failed | 54 passed (59)**. Each of tests 1–5 fails only on `activeElement`, with `<body>` focused. Test 6 and the 53 existing tests pass. This matches Step 2.
- **Step 3:** `removeEntry` records the target, a `focusAfterRemove` state and effect were added, and `addRef` was put on "Add bag", as planned. Lint asked for the union in `{ add: true } | { key: number } | null` order (`sort-type-constituents`), which is cosmetic.
- **Step 4 (GREEN):**
  - editor file 59/59;
  - `laundry-order-page.interaction` + `.render` 171/171;
  - `tsc --noEmit` exit 0;
  - `web lint` exit 0.
- **Step 4b (break run for test 6, outside the commit):**
  - **The break:** only `}, [focusAfterRemove]);` was changed to `});`.
  - **Result:** **2 failed | 57 passed**. Test 6 failed on `activeElement`, with the **Bag 2 input** focused: `<input id="laundry-weight-entry-1" value="0.80">`, which is the target. The break run is therefore **successful** under the fail-closed rule.
  - **Also failed (information only):** `keeps focus on Record weight when only the form-level error blocks a submit`. The dependency-free effect moved focus to "Add bag".
  - **Restore:** the file was restored from a copy and is byte-identical (`cmp`), and the suite is back to 59/59. The break was never staged.
- **Step 5:** README Editor bullet: "Removing a bag moves focus to the bag above it, or to Add bag when the first bag is removed."
- **Step 6:** G2 not approved. Nothing was staged or committed.
- **Step 7:**
  - The container `clensy-platform-web-1` was still `Exited`, so the existing G3 approval held.
  - The old branch server was stopped.
  - `pnpm --filter web build` exit 0, then `next start -p 3001`.

### Task 6 continued on the revision 4 build (2026-11-02)

**Ran by:** Claude (claude-opus-5-5) via Playwright Chromium, observed by the owner. **Build:** the working tree after Task 7, rebuilt 2026-11-02 (the "r4 build"). Every row below ran on the r4 build. The rows in the earlier table ran on the Task 6 build from before Task 7 (see [Retained Task 6 evidence](#retained-task-6-evidence)).

| Row | Role | Viewport | Result |
| --- | --- | --- | --- |
| K4 (re-run) | SCHEDULER | 1280×800 | **Pass.** `activeElement` was logged before each of 15 key presses, and every one matched the expected stop. Row 1 (start on the Bag 1 input; Tab, Tab, Enter): 2 rows, focus on "Add bag". Row 2 (Shift+Tab to "Remove bag 2", Space): 1 row, focus `INPUT#laundry-weight-entry-0` "Bag 1", in the editor. Row 3 (Tab, Tab, Enter, Enter → 3 rows; Shift+Tab ×5 through Remove bag 3, Bag 3, Remove bag 2, Bag 2, Remove bag 1; Space): 2 rows, focus "Add bag". F2 unchanged (WEIGHED, 1750 g, `updatedAt` 2026-11-01T14:33:35.512Z). Evidence: K4-r4-after-remove-bag-2.png, K4-r4-after-remove-bag-1.png |
| M2-r4 | SCHEDULER | 375×812 | **Pass.** Touch context (`hasTouch: true`, `isMobile: true`), with Remove pressed by `tap()`. 3 rows, tap "Remove bag 3": 2 rows, focus `INPUT#laundry-weight-entry-1` "Bag 2", `scrollY` 889 → 889. Tap "Remove bag 1": 1 row, focus "Add bag", `scrollY` 889 → 889. M2's original checks with 3 rows: all seven sections at x=24, width 327 (stacked); 3 inputs and 3 Remove buttons fully on screen; "Combined weight 1.75 kg" on screen; `scrollWidth` 375 ≤ 375. F2 unchanged. **Not verified:** whether a real phone opens its on-screen keyboard, including iOS on a programmatic focus. Desktop Chromium shows none. Evidence: M2-r4-after-tap.png, M2-r4-after-tap-remove-bag-1.png, M2-r4-weighing-375.png |
| K5 | OPS_MANAGER | 1280×800 | **Pass**, on F2 (Weighed); see the ruling below. Tab reached "Cancel order"; Enter opened the dialog with focus on its "Cancel". Tab stops cycled between Cancel order and Cancel, both in the dialog, so focus did not leave it. Escape closed it, and focus returned to "Cancel order". Enter on the dialog's "Cancel" also closed it. **No mutation sent** (request log empty). Status unchanged. Evidence: K5-dialog.png |
| D1 | OPS_MANAGER (planned: TENANT_OWNER) | 1280×800 | **Pass.** A table with columns Customer, Order, Fulfillment, Status, Weight, Total, Created. Evidence: D1-list-1280.png |
| D2 | OPS_MANAGER (planned: TENANT_OWNER) | 1280×800 | **Pass.** The header summary `<dl>` is a 4-column grid (Customer, Fulfillment, Weight, …). Evidence: D2-order-1280.png |

**Rulings:**
- **K5 ran on F2 (Weighed), not a Received order.** No Received order exists locally, and G6 allows no new orders. F2 offers Cancel order. K5 checks keyboard access to the dialog and sends nothing, so the status does not affect it. *Cost if wrong:* K5 is re-run on a Received order.
- **D1 and D2 ran as OPS_MANAGER, not TENANT_OWNER.** This session had no TENANT_OWNER sign-in. Both rows check layout only, and the list table and summary grid do not vary by role. *Cost if wrong:* D1 and D2 are re-run as TENANT_OWNER once the owner signs in.

**Task 6 Step 5 (automated gates, r4 build tree):**
- `pnpm --filter web test`: **2553/2553** (58 files), exit 0. That is 2547 before Task 7, plus 6.
- `pnpm --filter web exec tsc --noEmit`: exit 0.
- `pnpm --filter web lint`: exit 0.
- `pnpm --filter @clensy/web test`: **431/431** (16 files), exit 0.
- `pnpm --filter @clensy/web build`: exit 0.
- `pnpm --filter api test:e2e -- laundry.e2e-spec`: **5/5 pass** (1 suite, 2.5 s), exit 0, run 2026-11-02 from 01:32:54Z. It was held at first because it writes to the local `clensy` database beyond G6's four orders. The owner then approved it on 2026-11-02 "for this specific test run" (no truncation, no reset, no unrelated records). Only `test/laundry.e2e-spec.ts` matched the pattern. See [API e2e: records left in the local database](#api-e2e-records-left-in-the-local-database).

### API e2e: records left in the local database

The spec seeds its own data and has **no teardown** for it ("Self-contained … no truncation"). **No cleanup was performed**, and nothing was truncated, reset or deleted. The rows below remain in the local `clensy` database, all in the bootstrap tenant. The counts are row counts before and after the run. The ids are the rows with `createdAt` at or after the run's start, and they match the count differences exactly.

| Table | Before → after | Left behind |
| --- | --- | --- |
| `admin_user_entity` | 41 → 47 | **6 users:** 4 TENANT_OWNER (`tenant-owner-<uuid>@…`), 1 CUSTOMER_SUPPORT, 1 SCHEDULER |
| `laundry_order_entity` | 14 → 18 | **4 orders:** `6b66c95e…` Completed, `007e52c4…` Weighed, `03c1c754…` Priced, `2b527ba4…` Weighed |
| `laundry_order_line_entity` | 11 → 13 | 2 lines |
| `customer_entity` | 6 → 10 | 4 customers |
| `service_entity` | 6 → 10 | 4 services ("Wash&Fold 6ccffe24-…", three "Preview Wash …") |
| `audit_event_entity` | 162 → 195 | 33 audit events |
| `invoice_entity`, `tenant_entity` | 3 → 3, 1 → 1 | none |

- **Pre-existing records unchanged:** the newest `updatedAt` among orders created before the run is still 2026-11-01 14:33:35.512 (F2). H1, F2, F4 and DL1 were not touched.
- **Cleanup limitation:** removing these rows would mean deleting records, including audit events, which this approval does not cover. They stay unless the owner decides otherwise. The full id list is in the gitignored workspace, at `e2e-created-records.txt`.

### Task 6 Step 6: restore (2026-11-02)

- The branch server (`next start -p 3001`, from the working tree) was stopped. Afterwards nothing was listening on 3001.
- G7, owner-approved 2026-11-02: `docker start clensy-platform-web-1`, that container only. The API, Postgres and migrate containers were not restarted, and the database was not touched.
- **Result:**
  - `clensy-platform-web-1` is **Up**, publishing `0.0.0.0:3001->3001/tcp`.
  - The container log shows `next start -p 3001` from `/repo/apps/web`, Next.js 16.3.1, "✓ Ready in 165ms".
  - `GET :3001/login` returns 200, and `GET :3001/app/laundry` returns 307 to `/login`.
  - No host `next start` process remains.
- The original local web environment is **restored**, and the branch server was not restarted.

### Task 6 Step 7: M6 summary

**Which build each browser row ran on:**
- **Task 2 working tree:** Task 3 pass A (H1–R4).
- **Task 6 build, before Task 7:** R1–R4 re-run, R5, M1–M4, K1–K3, K4 (Fail), K6, K7.
- **r4 build:** K4 re-run, M2-r4, K5, D1, D2.

All rows were run by Claude (claude-opus-5-5) through Playwright Chromium and observed by the owner. Each row's viewport and role are given in its table.

**Caveats that stand:**
- **K5** verifies **only the dialog's keyboard interaction**, on F2 in the **Weighed** state, because no Received order was available under G6. No mutation was sent. It does **not** verify the Received-state workflow.
- **D1 and D2** passed as **OPS_MANAGER**, not TENANT_OWNER. **No owner-role verification is claimed** for them. The plan needs no role-specific evidence for these layout rows, so they were not re-run.
- **Phone keyboard:** what a real phone's on-screen keyboard does after a tap on Remove, including iOS on a programmatic focus, is **not verified**. Desktop Chromium shows none.
- **R1–R4 screenshots:** the originals from Task 3 were overwritten by the Task 6 re-run. The retained evidence for the Task 3 R1–R4 results is the text record in the Task 3 table.

**Deviations, each recorded in the ledger:**
1. B6 was reassigned in revision 3.
2. K4 failed and revision 4 was raised; it passed after Task 7.
3. The `sort-type-constituents` reorder of the union.
4. K5 ran on F2.
5. D1 and D2 ran as OPS_MANAGER.
6. Step screenshots replace the two planned GIFs, because Playwright has no GIF recorder.
7. The API e2e left records in the local database, with no cleanup.

**Commits (G2, owner-approved 2026-11-02, scope regrouped as the approval allowed):** the owner approved three commits, "subject to that final diff check", with this condition: "Adjust the grouping if needed to preserve dependencies".
- **The check:** the test-file diffs alone were applied to `main` in a throwaway worktree, and **14 tests failed**. Those were the redirect, drawer-removal and K4 focus tests, which need the commit 2 code.
- **The regrouping:** commit 1 holds only the Task 1 characterization tests, which pass on `main`. Each test that needs the new code moved into commit 2, with that code.
- **Commit 1 state, checked in the worktree:** web 2553/2553, `@clensy/web` 431/431, `tsc` exit 0, lint exit 0.
- **Commit 2 state:** the verified M6 tree without the README.
- **Accounted for:** all 14 modified files and this plan. No other files are included.

| Commit | Hash | Files |
| --- | --- | --- |
| `test(161): cover laundry cutover behavior` | `6703f00` | `apps/web/lib/laundry-customer-picker.interaction.test.tsx`, `apps/web/lib/laundry-order-page.interaction.test.tsx`, `apps/web/lib/nav-groups.test.ts`, `packages/web/src/laundry/laundry-order-actions.test.ts` |
| `fix(161): complete laundry cutover and preserve editor focus` | `dd8d894` | `apps/web/app/app/laundry/page.tsx`, `apps/web/components/laundry/laundry-weighing-editor.tsx`, `apps/web/lib/use-detail-drawer.ts`, `apps/web/lib/use-laundry-order-list-url-state.ts`, `apps/web/lib/laundry-list-page.interaction.test.tsx`, `apps/web/lib/laundry-list-page.test.tsx`, `apps/web/lib/laundry-weighing-editor.interaction.test.tsx`, `apps/web/lib/use-detail-drawer.guard.test.ts`, `apps/web/lib/use-detail-drawer.test.tsx` |
| `docs(161): record laundry cutover verification` | the commit that adds this record | `apps/web/README.md`, `docs/superpowers/plans/2026-11-01-laundry-cutover-verification-plan.md` |

#### Slice Completion Report (M6)

| Field | Result |
| --- | --- |
| Slice | #161 Laundry end-to-end verification and drawer cutover |
| Tracking | https://github.com/rexescario-dev/clensy-platform/issues/161 |
| M4 | Plan **Accepted** (revision 4) |
| M5 | Review **Accepted** (revision 4, with 7 notes incorporated) |
| M6 | **Complete**, committed under G2 (2026-11-02) |
| M7 | Pending |
| M8 | Pending |
| M9 | Pending |
| Branch | `feat/161-laundry-cutover` (from `main` at `563c855`; commits `6703f00`, `dd8d894` and the docs commit) |
| PR | None. G8 is out of scope |
| Status | **Ready for M7** |

##### Shipped

- Laundry orders open on the order page; the list's detail drawer is removed. A `?detail=<id>` URL redirects to `/app/laundry/<id>`, and an invalid one is dropped while the other filters are kept.
- Back from an order returns to the list with its filters intact. The Laundry nav item stays active on order pages.
- In the weighing editor, removing a bag moves focus to the bag above it, or to Add bag when the first or only bag is removed. This is one rule for mouse, touch and keyboard (K4, WCAG 2.4.3).
- Characterization and gap tests were added for the picker, intake, list, nav, order actions and drawer guard. Each has a break run recorded.
- The README was updated for the order page and the editor's focus rule.
- The browser verification ran on the local stack: the happy path, delivery, role restrictions, cancel, redirects, mobile at 375×812, keyboard and desktop layout. Results and caveats are above.

##### Validation

| Check | Result |
| --- | --- |
| Tests | **Passed**: web 2553/2553; `@clensy/web` 431/431; API `laundry.e2e-spec` 5/5 |
| Typecheck | **Passed**: `web tsc --noEmit` exit 0 |
| Lint | **Passed**: `web lint` exit 0 |
| Build | **Passed**: `web build` exit 0 (r4 build); `@clensy/web build` exit 0 |
| Package validation | N/A |

##### Next Gate

**M7 — Code Review.** It is preceded by the owner's G2 approval of the commit scope. Under CLAUDE.md, a fresh independent reviewer on the most capable model is required, given the Accepted spec, the Accepted plan and the branch diff.

## Code review (M7)

```text
Decision: Approved for merge
Subject: branch feat/161-laundry-cutover, 563c855..7bbb0b6 (6703f00 test, dd8d894 fix, 7bbb0b6 docs)
Accepted specification: docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md (Accepted 2026-09-06; Amendment #164 Accepted 2026-10-10; §8.4.4 governing)
Accepted implementation plan: docs/superpowers/plans/2026-11-01-laundry-cutover-verification-plan.md (revisions 2, 3, 4 Accepted)
Reviewer: independent, a fresh agent (Opus) that did not implement the change, given the Accepted spec, the Accepted plan and the branch diff (CLAUDE.md M7 rule: application code changed). Date: 2026-11-02.

Plan tasks reviewed:
- Task 1 (characterization tests): ✓ (T5-c lives in dd8d894 under the owner-approved G2 regrouping)
- Task 2 (row/create navigation, ?detail= redirect): ✓
- Task 3 (browser pass A, order-page verified gate): ✓ (recorded manual evidence; not re-run by the reviewer)
- Task 4 (drawer and laundry-only plumbing removal): ✓
- Task 5 (README): ✓
- Task 6 (browser pass B, gates, restore): ✓ (caveats on K5, D1/D2 and the phone keyboard recorded)
- Task 7 (rev. 4, K4 focus after remove): ✓

Verification evidence:
- Reviewer ran: pnpm --filter web test → 58 files, 2553/2553; tsc --noEmit exit 0; web lint exit 0; pnpm --filter @clensy/web test → 431/431.
- Reviewer ran commit 6703f00 alone (git archive export): web 2523 passed across 57 files; the guard file (30 tests, unchanged in commit 1) cannot run outside a git checkout; packages/web 431/431. Consistent with the M6 record.
- M6 record reviewed: Task 1 B1–B7 break runs (B6 per revision 3), Task 7 RED 5/59 and the Step 4b break (test 6 failed with focus on #laundry-weight-entry-1), browser passes A/B, API laundry.e2e 5/5.

Review summary: §8.4.4 is met. Rows and create success push /app/laundry/<id>. ?detail=<uuid> is replaced to the order page without mounting the list. An empty or invalid detail is replaced to the list with the other params kept. No drawer remains on the laundry list. The removal touched only laundry-only plumbing: the eight other drawer pages, open/close and the #173 marker guard are unchanged and tested. The K4 focus fix applies the owner rule, re-runs once per remove, does not touch the blocked-submit and save-settle focus effects, and is presentation-only and within scope. Each deleted test covered only removed API. All ten implementer rulings: agreed.
Blocking findings: None (no merge blockers)

Non-blocking observations (all Minor):
1. lib/laundry-order-page.ts:40 comment "Not wired in yet" is out of date.
2. Commit 6703f00 message lists the intake submit-guard test, which is in dd8d894.
3. lib/laundry-list-page.test.tsx:153 title says "no order query" but asserts it only implicitly.
4. The invalid/empty-detail redirect drops the URL hash (spec silent).
5. The hrefFor return of useLaundryOrderListUrlState has no external caller (per plan; M8 candidate).
6. Lost blank line at lib/laundry-list-page.interaction.test.tsx:349.
7. Plan step checkboxes left unchecked.

Gate: Merge per human/project norms (G8 push/PR is owner-gated). M8/M9 may follow.
```

### Post-M7 fix pass (owner: "fix all minor notes, then m8", 2026-11-02)

The owner asked for all seven non-blocking notes to be fixed. **Note 4 changes behavior**, so it is recorded here as a fix pass made test-first, not under M8. The fixes are **uncommitted** until the owner approves the commit scope (G2).

| Note | Fix | Evidence |
| --- | --- | --- |
| 1 | The `laundryDetailRedirectHref` comment now says the laundry list route redirects with it | — |
| 2 | **Correction to the G2 commit map above:** commit 1 holds **only Task 1 tests, but not all of them**. The intake submit-guard test (T5-c, `laundry-list-page.interaction.test.tsx`) is in `dd8d894`, because its file also holds Task 2 tests. The `6703f00` message is wrong on that point. It is left as it is, since the commit was reviewed | The file table above was already correct |
| 3 | Renamed to "renders no list and no list query for ?detail=…". The drawer-removal test now also asserts that `page.tsx` does not use `useLaundryOrderQuery` | Test passes |
| 4 | An empty or invalid `detail` redirect now keeps the URL hash, as the list's own writes do. A UUID still goes to the order page without the list's hash. `laundryDetailRedirectHref(search, hash = '')`, and `LaundryDetailRedirect` reads `window.location.hash` in its effect | **RED:** 3 failed / 114 passed. The 2 new helper rows failed with the hash missing (`'/app/laundry?status=PAID'`), and so did the new interaction test `keeps the hash when it replaces an invalid detail with the list`. **GREEN:** 125/125 across the three list/helper files |
| 5 | `useLaundryOrderListUrlState()` now returns `{ setState, state }`, and `hrefFor` is private to the hook. **Ruling:** this departs from Task 4's Produces line (`{ hrefFor, setState, state }`), on the owner's instruction to fix every note. The hook is internal to the app, and the only caller (`page.tsx`) never used `hrefFor`. *Cost if wrong:* re-export one name | `tsc` exit 0 |
| 6 | Blank line restored | — |
| 7 | All 45 step checkboxes ticked. The per-task commit steps ran as the three regrouped G2 commits above, and every deviation is listed in the Task 6 Step 7 summary | — |

**After the fix pass:**
- web 2558/2558, which is 2553 plus the 5 new hash tests;
- `tsc` exit 0;
- lint exit 0.

## Code review (M7), delta: post-M7 fix pass and M8

```text
Decision: Approved
Subject: feat/161-laundry-cutover uncommitted working tree vs HEAD 7bbb0b6 (post-M7 fix pass for notes 1–7; M8 use-detail-drawer.ts simplification)
Accepted specification: docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md (§8.4.4 governing)
Accepted implementation plan: docs/superpowers/plans/2026-11-01-laundry-cutover-verification-plan.md (revision 4)
Reviewer: independent, a fresh agent (Opus) that did not implement the change (CLAUDE.md M7 rule: application code changed). Date: 2026-11-02.

Review summary:
- Note 4 (hash): laundryDetailRedirectHref(search, hash = '') adds the hash only to the empty/invalid-detail list redirect. The UUID path returns the order href before the hash is added. LaundryRoute renders from the search string only, and window.location.hash is read only inside LaundryDetailRedirect's effect, so SSR and hydration are safe. The list target has no detail, so there is no redirect loop. The new interaction test and the two list helper rows fail without the fix (checked by reading; consistent with the recorded RED of 3).
- Note 5: hrefFor is no longer returned. Its only remaining use is inside the hook, and page.tsx takes { setState, state }. Ruling agreed.
- Notes 1, 3, 6, 7: correct. The new useLaundryOrderQuery source assertion is a real check.
- M8: isDrawerEntryPushedHere is equivalent to the old drawerEntryState()?.[KEY] === paramName for every history.state shape (non-object, null, missing key, non-string marker, other paramName → false; matching marker → true). The pushState call in open is identical, and open's dependencies are equivalent. Behavior is preserved for the eight drawer pages and the #173 marker guard.
Verification evidence (reviewer ran): pnpm --filter web test → 58 files, 2558/2558; tsc --noEmit exit 0; web lint exit 0.
Blocking findings: None
Non-blocking (Minor):
1. apps/web/README.md and docs/superpowers/README.md changed during the review (M9 work, outside this delta). The apps/web/README.md hunks were checked and match the code; docs/superpowers/README.md (plan count) is covered by the M9 record. The G2 commit scope names both files explicitly.
2. In page.tsx, `if (href !== null)` can never be false. It is harmless and keeps the types honest; left as is.
3. The redirect effect does not re-run on a change to the hash alone. That cannot matter, because the component redirects at once; left as is.
Gate: Approved. The G2 commit of the fix pass, M8 and M9 is owner-gated.
```

## Refactoring (M8)

```text
Decision: Complete
Subject: feat/161-laundry-cutover working tree after the post-M7 fix pass
Scope:
- apps/web/lib/use-detail-drawer.ts (the slice touched it in Task 4)
Accepted specification: docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md
Accepted implementation plan: docs/superpowers/plans/2026-11-01-laundry-cutover-verification-plan.md
M7 / authorization: Approved for merge (2026-11-02); owner: "fix all minor notes, then m8"

Maintainability goals:
- Remove indirection left behind when Task 4 deleted openWithHref/closeWithHref and the laundry list's marker copy.

Changes:
- drawerEntryState() built a fresh { marker } state object only for the deleted replaceState caller. It is removed, and isDrawerEntryPushedHere(paramName) reads the marker from history.state directly, with the same result for every state (non-object, null, missing, non-string or other-param marker → false).
- The private push helper had one remaining caller. It is inlined into open, with the same pushState call and the same { [DRAWER_ENTRY_KEY]: paramName } state.
- Considered and left alone: the weighing editor's focusAfterRemove effect next to the focusRow/save-settle effects. Their separation is what M7 relied on to show that they do not interact, so merging them would be risk without benefit. page.tsx, use-laundry-order-list-url-state.ts and laundry-order-page.ts: nothing further worth changing after the fix pass.

Verification:
Before (after the post-M7 fix pass): pnpm --filter web test → 58 files, 2558/2558; tsc --noEmit exit 0; web lint exit 0.
After: pnpm --filter web test → 58 files, 2558/2558 (including use-detail-drawer.test.tsx and the #173 guard's 30 tests); tsc --noEmit exit 0; web lint exit 0; pnpm --filter web build exit 0.
Characterization: no new tests. The drawer's open/close, marker and guard behavior is covered by the existing use-detail-drawer and guard suites, reviewed at M7.

Externally observable behavior changes: None

Gate: Complete — proceed to M9.
```

### Slice Completion Report (M8)

| Field | Result |
| --- | --- |
| Slice | #161 Laundry end-to-end verification and drawer cutover |
| Tracking | https://github.com/rexescario-dev/clensy-platform/issues/161 |
| M4 | Plan **Accepted** (revision 4) |
| M5 | Review **Accepted** (revision 4) |
| M6 | **Complete** |
| M7 | **Approved** (independent fresh-agent review). The post-M7 fix pass for its seven notes is above |
| M8 | **Complete** |
| M9 | Pending |
| Branch | `feat/161-laundry-cutover` (`563c855..7bbb0b6`, plus the uncommitted fix pass and M8 change) |
| PR | None. G8 is owner-gated |
| Status | **Ready for M9**, after the G2 commit of the fix pass and M8 |

#### Shipped

- The M7 notes are fixed: an empty or invalid `?detail=` redirect now keeps the URL hash; a stale comment and a test name are corrected; the unused `hrefFor` return is gone; the plan is corrected.
- M8: the shared drawer hook is simpler now that the laundry-only helpers are gone. Behavior is unchanged.

#### Validation

| Check | Result |
| --- | --- |
| Tests | **Passed**: web 2558/2558 (`@clensy/web` and API untouched since M6: 431/431, 5/5) |
| Typecheck | **Passed** |
| Lint | **Passed** |
| Build | **Passed**: `web build` exit 0 |
| Package validation | N/A |

#### Next Gate

**M9 — Documentation**

## Documentation (M9)

```text
Decision: Complete
Subject: #161, branch feat/161-laundry-cutover (563c855..7bbb0b6 plus the uncommitted post-M7 fix pass and M8 change)
Accepted specification: docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md (Amendment #164, §8.4.4)
Accepted implementation plan: docs/superpowers/plans/2026-11-01-laundry-cutover-verification-plan.md
M7: Approved for merge (2026-11-02). The post-M7 fix pass gets a delta review under the CLAUDE.md M7 rule; see "Code review (M7), delta" above
M8: Complete

Documentation scope:
- apps/web/README.md
- docs/superpowers/README.md
- this plan (status line, M9/M10 records)
Inventoried and left unchanged:
- docs/features/laundry.md: it describes the API lifecycle and links to the web README for screens, so nothing there changed.
- docs/history/shipped-slices.md: it notes only slices that changed the API's behavior, and #161 is web-only.
- docs/README.md: its laundry links are still correct.
- the spec index row "Laundry orders & lifecycle": still Accepted with Amendment #164. #161 implements it and does not amend it.

Updated artifacts:
- apps/web/README.md "?detail= redirect" ← post-M7 fix pass, note 4: an empty or invalid detail keeps the other params and the hash, and the hash is not carried to the order page.
- apps/web/README.md order-page "Cutover helpers" ← note 4: laundryDetailRedirectHref(search, hash).
- docs/superpowers/README.md plan count 72 → 77 ← this plan (the count was already out of date before it).
- Plan status line ← the M6–M9 outcomes and M10 N/A.
(The README's other #161 lines landed in 7bbb0b6 and were checked for accuracy at M7.)

Editorial changes:
- The M8 Slice Completion Report headings went from #### / ##### to ### / ####, which removes a skipped level under "## Refactoring (M8)".
Content updates:
- The README redirect and helper lines, the plan count, and the plan status line, as listed above.

Verification:
- Links checked: every relative link and in-file anchor in the plan, apps/web/README.md and docs/superpowers/README.md resolves (script check). 0 broken.
- Heading hierarchy checked: no skipped levels after the fix above.
- Status consistency checked: the plan header, the M6/M7/M8 reports and this record agree. M6 Complete; M7 Approved; M8 Complete; M9 Complete; M10 N/A; PR none (G8).
- Cross-references checked: the README names only symbols that exist (laundryDetailRedirectHref, laundryOrderHref, useDetailDrawer open/close). No reference remains to hrefFor, openWithHref, closeWithHref, drawerEntryState or LaundryOrderHrefParams outside the plans.
- Terminology checked: "order page", "list", "?detail= redirect", "drawer" and "bag" as in §8.4.4 and the existing README.
- Duplicates and outdated refs checked: the stale "Not wired in yet" code comment was fixed in the fix pass. No contradictory sections found.

Gate: Documentation complete. Code, behavior and contracts unchanged by this stage.
```

## Workflow validation (M10)

**N/A.** M10 applies only when a slice changes workflow assets (process spec §2.12, step 1). #161 changes no file under `docs/workflows/`, no `workflow.yaml` and no workflow prompt or convention.

### Slice Completion Report (M9)

| Field | Result |
| --- | --- |
| Slice | #161 Laundry end-to-end verification and drawer cutover |
| Tracking | https://github.com/rexescario-dev/clensy-platform/issues/161 |
| M4 | Plan **Accepted** (revision 4) |
| M5 | Review **Accepted** (revision 4) |
| M6 | **Complete** |
| M7 | **Approved** (independent review). The delta review of the post-M7 fix pass is recorded above: **Approved** |
| M8 | **Complete** |
| M9 | **Complete** |
| Branch | `feat/161-laundry-cutover` |
| PR | None. G8 (push and PR) is owner-gated |
| Status | **Ready for closeout**, once the G2 commit of the fix pass, M8 and M9 is approved and G8 is approved |

#### Shipped

- The documentation matches the shipped redirect, including the hash kept on list redirects, and the current helper signature.
- The plan index count is corrected.
- The plan records M6–M9, with M10 N/A.

#### Validation

| Check | Result |
| --- | --- |
| Tests | **Passed**: web 2558/2558 (no code change at M9) |
| Typecheck | **Passed** (unchanged since M8) |
| Lint | **Passed** (unchanged since M8) |
| Build | **Passed**: `web build` exit 0 (M8) |
| Package validation | N/A |

#### Next Gate

**Closeout** (§2.12). It starts with the merge: push and PR (G8), then a merge authorized by the owner.

## Closeout (2026-11-02)

**Authorization.**
- 2026-11-02, "make PR" (G8): commit the proposed scope, push, and open PR #218.
- 2026-11-02, "merge, closeout": merge #218 and run closeout.

**M1–M10 check before the merge** (process spec §2.12, step 1):

| Stage | Outcome |
| --- | --- |
| M1 | Passed: the installed prompt library is present |
| M2 / M3 | Passed: the lifecycle spec is Accepted, with Amendment #164 Accepted 2026-10-10 |
| M4 / M5 | Passed: this plan is Accepted. Revisions 2 and 3 were accepted 2026-11-01, and revision 4 on 2026-11-02 after three independent reviews and the owner's acceptance |
| M6 | Passed: [Execution record](#execution-record-m6), M6 Slice Completion Report |
| M7 | Passed: [Approved for merge](#code-review-m7). The post-M7 fix pass also got a [delta review](#code-review-m7-delta-post-m7-fix-pass-and-m8), Approved |
| M8 | Passed: [Complete](#refactoring-m8) |
| M9 | Passed: [Complete](#documentation-m9) |
| M10 | Does not apply ([N/A](#workflow-validation-m10)) |

No applicable stage was missing, so no stage was skipped or overridden.

**Merge verification.**
- PR #218 was merged with a merge commit at 2026-11-02T02:08:28Z, as `20cfba7`. The head was `17dfbfc`.
- `17dfbfc` is an ancestor of `main`.
- #161 is closed (by the PR's "Closes #161").
- CI on the head passed all four checks: API e2e, Lint, Release gate and Test.

**Post-merge cleanup.**
- `feat/161-laundry-cutover` was deleted locally and on the remote.
- **The executor's gitignored workspace is kept**, unlike #205's. `.superpowers/sdd/2026-11-01-laundry-cutover-verification-plan/` holds the browser evidence screenshots, the local `qa161` test credentials and the id list of the e2e-created rows. The owner decides when it goes.
- **Local data left in place:**
  - The four G6 orders (H1, F2, DL1, F4).
  - The five `qa161-*` staff users (G4).
  - The rows the owner-approved API e2e run created: 6 users, 4 laundry orders, 2 lines, 4 customers, 4 services and 33 audit events ([API e2e records](#api-e2e-records-left-in-the-local-database)).

  All of these are in the local `clensy` database only. Removing them needs a separate owner decision, because it means deleting records, including audit events.
- **Services:** `clensy-platform-web-1` was restored at Task 6 Step 6. No branch server is running.

**Final M7 position.** Approved for merge, and the delta review Approved. There are no blockers. Every Minor note from M7 was fixed in the post-M7 fix pass. The delta review's three Minor notes need no change.

**Limits that stand** (recorded in M6, not follow-ups):
- K5 verifies the cancel dialog's keyboard behavior on a Weighed order, not the Received-state workflow.
- D1 and D2 were checked as OPS_MANAGER, not TENANT_OWNER.
- Real-phone on-screen keyboard behavior is unverified.
- The original R1–R4 screenshots were overwritten, so the text record is the evidence.

**Follow-ups.** None filed.

## Final Slice Completion Report

| Field | Result |
| --- | --- |
| Slice | #161 Laundry end-to-end verification and drawer cutover |
| Tracking | https://github.com/rexescario-dev/clensy-platform/issues/161 |
| M4 | Plan **Accepted** (revision 4) |
| M5 | Review **Accepted** (revision 4) |
| M6 | **Complete** |
| M7 | **Approved**, and the delta review **Approved** |
| M8 | **Complete** |
| M9 | **Complete** |
| Branch | `feat/161-laundry-cutover`, deleted after the merge |
| PR | https://github.com/rexescario-dev/clensy-platform/pull/218 (merged, `20cfba7`) |
| Status | **Slice complete** |

### Shipped

- Laundry rows and create success open `/app/laundry/<id>`. The list's detail drawer and its laundry-only history helpers are removed.
- `/app/laundry?detail=<id>` redirects to the order page. An empty or invalid `detail` is dropped, and the other list params and the hash are kept.
- Back from an order returns to the list with its filters. The Laundry nav item stays active on order pages.
- Weighing editor: removing a bag moves focus to the bag above it, or to Add bag when the first or only bag is removed (K4).
- Characterization and gap tests with recorded break runs. The README, the plan index count and the full M6–M10 record are updated.
- The browser verification passes of the order flow, at desktop and mobile widths, recorded with their caveats.

### Validation

| Check | Result |
| --- | --- |
| Tests | **Passed**: web 2558/2558; `@clensy/web` 431/431; API `laundry.e2e-spec` 5/5; CI Test and API e2e passed |
| Typecheck | **Passed** |
| Lint | **Passed** (also in CI) |
| Build | **Passed**: `web build`, `@clensy/web build` |
| Package validation | N/A |

### Next Gate

None — slice complete

## Revision 4 changes

**Status: Accepted** at M5 on 2026-11-02 ([M5 decision for revision 4](#m5-decision-for-revision-4)). Raised at M6 Task 6 Step 3, 2026-11-01. Revised twice after independent M5 reviews, then accepted on the third pass. It goes to a **fresh** independent M5 reviewer. That acceptance is necessary but not sufficient: the owner must also explicitly accept this plan before Task 7 starts. **No code for it has been written.** The owner directed that K4 stays **Fail** until the behavior below is implemented and K4 is re-run.

### Why

- **What was observed.** K4 ran on this branch's final build (Task 6, 1280×800, SCHEDULER, order F2). Adding and removing a bag by keyboard both work (1 → 2 → 1 rows). After Space on "Remove bag 2", the button and its row are gone, and **focus falls to `<body>`**. A keyboard or screen-reader user is sent back to the top of the page and loses their place in the editor.
- **Where it comes from.** The behavior was **not introduced by this branch**. It is existing [#155](https://github.com/rexescario-dev/clensy-platform/issues/155) behavior in `apps/web/components/laundry/laundry-weighing-editor.tsx`, which this branch does not modify. That editor restores focus only after a blocked submit (the first invalid row) and after a save settles (Record weight). `removeEntry` moves no focus, and no test covers focus after a remove. Task 6 surfaced it in K4, the keyboard check over the add/remove interaction.
- **Why #161 must correct it.** The requirement that focus stays in the editor comes from **this plan's Accepted K4 row** (Expected: "focus stays in the editor"). Its rationale is WCAG 2.4.3 Focus Order: after a control removes itself, focus should land somewhere that keeps the user's place, not at the top of the document. #161 supplies the scope, not the focus rule: its Mobile and accessibility section requires a manual keyboard pass over "customer combobox, fulfillment radios, **add/remove weight row**, confirm dialog, and back link", and its acceptance needs the manual script's result. #161 does not itself specify focus restoration. K4 is Accepted and failed, so #161 cannot be accepted without either this correction or a documented failure. The owner chose to fix it in this slice rather than record a documented failure (decision (d)).
- **Spec basis.** Amendment #164 §8.4.4 allows the weighing UI to show several temporary rows. Focus management is presentation; it changes no data, request, role or copy. No spec amendment is needed.

### Scope (and what it does not touch)

- **In scope:** where focus goes after a bag row is removed, in `LaundryWeighingEditor`, plus its tests and one README sentence.
- **Out of scope:**
  - any other editor behavior: add, change, validation, submit, the save-settle focus, the lock, copy;
  - moving focus to the new row on **Add bag** (K4 records that focus stays on "Add bag", which is not a failure);
  - a general refactor or #155 cleanup;
  - any `@clensy/ui` change.

### Behavior (owner decisions, 2026-11-01 and 2026-11-02)

After a bag row is removed with its "Remove bag N" button, **by keyboard, mouse or touch alike** (all three reach the same `onClick`; owner decision 2026-11-02: one rule, no branching on input method):

1. **When a previous bag exists** (the removed row was not the first), focus moves to **the previous bag's weight input**: the row directly above the removed one, which after renumbering is "Bag N−1".
2. **When the removed row was the first** (whether other rows remain or it was the only one), focus moves to **"Add bag"**.

**Keyboard and accessibility considerations:**

- **The target always exists and is enabled.** A Remove button can only be activated when the editor is not `locked`: they share the same `disabled={locked}`. In that same render, the previous row's input and "Add bag" are enabled too, since they use the same flag or none. "Add bag" is always rendered.
- **Focus moves after React has rendered the removal.** It happens in an effect keyed by a new object per remove, the existing `focusRow` pattern, so it runs again when the same target is chosen twice in a row.
  - **An input target** is found by `entryInputId(key)`. If it no longer exists when the effect runs, nothing is focused. That cannot happen in one render, but the guard keeps it safe.
  - **"Add bag"** is reached through a new ref.
- **On a phone (touch).** Tapping Remove focuses the previous bag's text input, so the on-screen keyboard is expected to open and the browser may scroll that input into view. The owner accepted this on 2026-11-02 as predictable and often useful, since the next likely action is editing a remaining weight. Removing the first or only bag focuses a button, so no keyboard is expected then. Task 7 Step 7 records the observable part (where focus lands, the scroll position, the rows staying usable). The automated browser is desktop Chromium in a 375×812 viewport and **cannot show an on-screen keyboard**, so that part is **not verified** and must not be reported as verified.
- **What a screen reader announces.** An input target is read with its label ("Bag N−1"), its current value, and its error if one is shown. "Add bag" is read as a button. The existing polite live region (`role="status"`) holds **only the formatted total** (for example "1.45 kg"), so the new total is announced; the "Combined weight" label sits in a separate `<p>` outside it and is not part of the announcement. **Known limitation:** after the only bag is removed, the form-level error "Add at least one weight." appears in a plain `<p>` that is not a live region, and it is described by Record weight, not by "Add bag". A screen-reader user therefore hears "Add bag, button" and "0.00 kg", but not the error, until they reach Record weight. This is accepted, not changed here. No new live region is added: the focused element's label and value already tell the user where they are, and announcing the error belongs to the submit path, which is out of scope.
- **No other focus rule changes.** The blocked-submit and save-settle rules keep running as before. A remove cannot happen during a save, because the buttons are disabled.

## Task 7: Keep focus in the weighing editor after a bag is removed (type: `code`, revision 4)

Runs only after **both** a fresh independent M5 reviewer accepts revision 4 **and** the owner explicitly accepts it. Then Task 6 resumes at K4. Tests 1–5 are **regression tests**: they fail first against current behavior, so no break run applies to them. Test 6 is a **characterization test (guard)**: it pins already-correct behavior (focus is not pulled back), passes before and after the change, and is proved by the break run in Step 4b.

**Files:**
- Modify: `apps/web/components/laundry/laundry-weighing-editor.tsx` (`removeEntry`, one new focus-target state and effect, a ref on "Add bag")
- Test: `apps/web/lib/laundry-weighing-editor.interaction.test.tsx` (the `laundry weighing editor` describe, which holds `updates the total at once when a row is edited or removed, and renumbers the rows`; it uses the file's helpers `enterThreeBags`, `mount`, `button` and `inputs`)
- Docs: `apps/web/README.md`, the weighing "Editor" bullet

**Interfaces:** Consumes nothing from earlier tasks. Produces no exported symbol; the editor's props are unchanged.

- [x] **Step 1: Write the tests** (five failing-first regression tests and one characterization guard). Tests 1–5 each focus the Remove button first, the way a keyboard user activates it, then clicks it. jsdom moves focus to `<body>` when the focused element is removed (the file's `submitFromRecordWeight` helper relies on the same jsdom behavior), so today each test ends with `<body>` focused.

  ```ts
  function removeByKeyboard(name: string) {
    act(() => button(name).focus());
    act(() => button(name).click());
  }

  it('focuses the previous bag after removing a middle bag (#161 K4)', async () => {
    await enterThreeBags();
    removeByKeyboard('Remove bag 2');
    expect(inputs().map((input) => input.value)).toEqual(['1.25', '0.45']);
    expect(document.activeElement).toBe(inputs()[0]);
  });

  it('focuses the previous bag after removing the last bag (#161 K4)', async () => {
    await enterThreeBags();
    removeByKeyboard('Remove bag 3');
    expect(inputs().map((input) => input.value)).toEqual(['1.25', '0.80']);
    expect(document.activeElement).toBe(inputs()[1]);
  });

  it('focuses Add bag after removing the first bag (#161 K4)', async () => {
    await enterThreeBags();
    removeByKeyboard('Remove bag 1');
    expect(inputs().map((input) => input.value)).toEqual(['0.80', '0.45']);
    expect(document.activeElement).toBe(button('Add bag'));
  });

  it('focuses Add bag after removing the only bag (#161 K4)', async () => {
    await mount(null);
    removeByKeyboard('Remove bag 1');
    expect(inputs()).toEqual([]);
    expect(document.activeElement).toBe(button('Add bag'));
  });

  it('focuses the same previous bag again on a second remove below it (#161 K4)', async () => {
    await enterThreeBags();
    removeByKeyboard('Remove bag 3');
    act(() => button('Add bag').click());
    removeByKeyboard('Remove bag 3');
    expect(document.activeElement).toBe(inputs()[1]);
  });

  it('does not pull focus back after the user moves on (#161 K4)', async () => {
    await enterThreeBags();
    removeByKeyboard('Remove bag 3');
    act(() => button('Add bag').focus());
    type(0, '2.00');
    expect(document.activeElement).toBe(button('Add bag'));
  });
  ```

  Test 6 (**characterization, guard**) re-renders the editor twice after the remove, without the code moving focus. First, `button('Add bag').focus()` blurs the Bag 2 input, which the remove had focused. jsdom fires `focusout`, and React's `onBlur` calls `touchEntry`, which sets a new array and re-renders. Second, the file's `type(index, text)` helper sets a value and dispatches `input`, which also re-renders. An effect with no dependency list would steal focus back to Bag 2 on the first of those re-renders, before any typing. Today the test passes because nothing moves focus. It must still pass after Step 3. That it catches an effect running on every render is a claim, proved only by the break run in Step 4b.

  Test 5 pins the "new object per remove" requirement: two removes in a row choose the same target, so the effect must run again.

- [x] **Step 2: Run them and confirm they fail for the right reason.**

  ```bash
  pnpm --filter web exec vitest run lib/laundry-weighing-editor.interaction.test.tsx
  ```
  Expected: tests 1–5 FAIL. The value assertions pass; each fails on `activeElement`, which is `<body>` instead of the input or "Add bag". Test 6 and all existing tests in the file pass.

- [x] **Step 3: Implement in `laundry-weighing-editor.tsx`.**
  - Add `const addRef = useRef<HTMLButtonElement>(null);` and pass `ref={addRef}` to the "Add bag" `Button`.
  - Add `const [focusAfterRemove, setFocusAfterRemove] = useState<{ key: number } | { add: true } | null>(null);`. Set it to a new object on every remove.
  - In `removeEntry(key)`, find the removed row's index in the rendered `entries`. If the index is > 0, set `{ key: entries[index - 1].key }`; otherwise (index 0, or −1 if the key is not found) set `{ add: true }`. Sending a not-found key to Add bag is deliberate: Add bag always exists and is enabled. The existing `setFailure(undefined)` and the functional filter stay unchanged. Add a one-line comment: reading the rendered `entries` is safe because React commits each click before the next one, so the list the user clicked on is the list being filtered.
  - Add a `useEffect` on `[focusAfterRemove]`: for `{ key }`, focus `document.getElementById(entryInputId(key))` if it exists; for `{ add: true }`, focus `addRef.current`. Give it a comment in the file's style citing #161 K4.
  - Do not change `focusRow`, the save-settle effect, `addEntry`, `changeEntry`, `touchEntry` or `handleSubmit`.

- [x] **Step 4: Run and confirm they pass.** Same command as Step 2. Expected: every test in the file passes, including the six new ones. Then:

  ```bash
  pnpm --filter web exec vitest run lib/laundry-order-page.interaction.test.tsx lib/laundry-order-page.render.test.tsx
  pnpm --filter web exec tsc --noEmit
  pnpm --filter web lint
  ```
  Expected: all pass and exit 0. The order page mounts this editor, so its suites are the regression check.

- [x] **Step 4b: Break run for test 6 (characterization), outside the commit.**
  - **Behavior broken:** the remove-focus rule runs on every render instead of once per remove. Make it so by deleting the `[focusAfterRemove]` dependency list from the new effect, and nothing else.
  - **Tests covered by the break:** test 6, `does not pull focus back after the user moves on (#161 K4)`.
  - **Run:** the Step 2 command. Expected: test 6 **FAILS** on its `activeElement` assertion, with focus on **the Bag 2 input** (`#laundry-weight-entry-<key>`) instead of "Add bag". The mechanism is the one in Step 1: the blur re-render from `button('Add bag').focus()` (`focusout` → `onBlur` → `touchEntry`) runs the dependency-free effect, which takes focus back before `type` runs. Record the actual focused element from the failure message (its tag and id). Also record every other test that fails under the break; that is information, not a condition.
  - **Restore** the dependency list, re-run the Step 2 command (all pass), and check with `git diff` that the effect matches Step 3. The break is never staged or committed.
  - **Fail closed.** The break run is successful **only** if test 6 fails with focus on the Bag 2 input. If test 6 passes, or fails with `<body>` or any other element focused, the break run is unsuccessful: stop, and the plan returns to M4/M5 (the M6 rule already applied in Task 1).
  - The M6 record notes the break, the command, and the result.

- [x] **Step 5: README.** In `apps/web/README.md`, in the weighing "Editor" bullet's focus sentences, add: "Removing a bag moves focus to the bag above it, or to Add bag when the first bag is removed." Verify with `grep -n "Removing a bag moves focus" apps/web/README.md`, which prints one line.

- [x] **Step 6: Commit, owner-approval gate G2.** Without approval, leave the changes uncommitted and continue. Proposed, if and when G2 is approved (recording it here does not authorize it):

  ```bash
  git add apps/web/components/laundry/laundry-weighing-editor.tsx apps/web/lib/laundry-weighing-editor.interaction.test.tsx apps/web/README.md
  git commit -m "fix(161): keep focus in the weighing editor after a bag is removed"
  ```

- [x] **Step 7: Resume Task 6 at K4.** Rebuild (`pnpm --filter web build`) and restart the branch server on 3001 under the existing G3 approval. That approval holds only while `clensy-platform-web-1` has stayed stopped since it was given. If the container has been restarted in the meantime, a **fresh G3 approval** is needed before the branch is served again. Re-run K4 at 1280×800 as SCHEDULER on F2. F2 is Weighed, so it offers the editor for a re-weigh. **No weight is recorded:** the K4 re-run touches only Add bag and Remove, so F2's data does not change.

  | Check | Expected |
  | --- | --- |
  | Start: 1 row, focus placed on the "Bag 1" input. Tab (stop: "Remove bag 1"); Tab (stop: "Add bag"); Enter | 2 rows; focus stays on "Add bag" (unchanged behavior) |
  | From "Add bag", Shift+Tab (stop: "Remove bag 2"); Space | 1 row; focus on the "Bag 1" input (`document.activeElement` is `#laundry-weight-entry-<key>`), inside the editor |
  | From the "Bag 1" input, Tab (stop: "Remove bag 1"); Tab (stop: "Add bag"); Enter, Enter (3 rows; focus stays on "Add bag"). Then Shift+Tab ×5, with stops: 1 "Remove bag 3", 2 "Bag 3" input, 3 "Remove bag 2", 4 "Bag 2" input, 5 "Remove bag 1"; Space | 2 rows; focus on "Add bag" |
  | Screenshot after each remove | K4-r4-*.png in the evidence folder |

  The script reads and logs `document.activeElement` (tag, id or accessible name) **before every key press**, and stops if focus is not on the expected control. This prevents a repeat of the first run's incident, where a Space meant for Remove landed on Record weight. K4 is **Pass** only if every check holds.

  Then, at **375×812** as SCHEDULER on F2 (again **no weight recorded**), repeat M2 as **M2-r4**, with a tap on Remove. If the tool can open a browser context with `hasTouch: true` and use `tap()`, use that and record it. Otherwise use a pointer click in the 375×812 viewport and record that it was a click, not a touch event:

  | Check | Expected | Record |
  | --- | --- | --- |
  | Add bag twice (3 rows), then tap "Remove bag 3" | 2 rows; focus on the "Bag 2" input | `document.activeElement` id; `window.scrollY` before and after; screenshot M2-r4-after-tap.png |
  | Tap "Remove bag 1" | 1 row; focus on "Add bag" | the same three items |
  | M2's original Expected, on this build | Sections stacked, weight inputs and Remove usable, total visible, `scrollWidth <= innerWidth` | as in M2 |

  The scroll position is recorded, not judged: moving the focused input into view is expected. **Not verified:** whether a real phone opens its on-screen keyboard, including whether iOS opens it on a programmatic focus. The record says so in those words. M2-r4 is **Pass** only if every Expected holds.

  Then continue with K5, D1, D2 and Task 6 Steps 5–7 as written.

**Unchanged by revision 4:** Tasks 1–6 as Accepted (with revision 3), and the owner-approval gates apart from G2's new Task 7 Step 6 entry. Recorded results carry forward only as stated in [Retained Task 6 evidence](#retained-task-6-evidence). G2 stays unapproved, and G7 restoration is still required before M6 closes.

### Retained Task 6 evidence

Task 7 changes one thing on the page: where focus goes after a Remove in the weighing editor. It adds a ref and a focus effect; it changes no markup, class, copy, layout, data or request. So:

| Recorded result | After the rebuild | Why |
| --- | --- | --- |
| Task 3, all rows (the order-page verification gate) | **Stands** | It is the §8.4.4 gate that allowed Task 4, and it was met on its build. None of its rows depended on focus after a Remove. The final build is still covered by the repeated rows below and the Task 6 Step 5 gates. **Evidence limitation:** the original Task 3 R1–R4 screenshots were overwritten by the Task 6 re-run (see the Task 6 execution record). For R1–R4 on the Task 3 build, the retained evidence is Task 3's text records only; those screenshots are not available. The R1–R4 screenshots now in the folder are from the Task 6 build. |
| R1–R5, M1, M3, M4, K1, K2, K3, K6, K7 | **Stand** | None of them presses Remove. The editor's rendered markup is unchanged, so M3's "Record weight on screen" and K7's "Add bag" focus ring are unaffected. |
| **M2** | **Repeated** on the new build, as M2-r4 | Its Expected includes "the remove buttons are usable", and what Remove does has changed. The earlier M2 Pass is **not** carried forward as evidence for the changed interaction. |
| **K4** | **Repeated** (it is Fail) | It is the failing row this revision fixes. |
| K5, D1, D2, Steps 5–7 | **Not yet run** | They run on the new build as written. |

### M5 review of revision 4, first pass

Independent reviewer (a fresh agent that had not seen the implementation), 2026-11-02: **Revise**. The design, React timing and five tests were confirmed against the code. Blockers and how this pass answers them:

| Finding | Answer |
| --- | --- |
| B1: Scope row, G2, Traceability and Self-check not updated for Task 7 | Scope row names the editor and its test; G2 lists Task 7 Step 6; Traceability has a Task 7 row; Self-check gives the real order (6 through K4 → 7 → 6 from K4) and types Task 7. |
| B2: touch behavior, and retained Task 6 evidence | Owner decision 2026-11-02: one rule for every input method ([Behavior](#behavior-owner-decisions-2026-11-01-and-2026-11-02)). Step 7 adds the 375×812 tap check with the on-screen-keyboard limit stated. [Retained Task 6 evidence](#retained-task-6-evidence) says what stands and what is repeated; M2 is repeated. |
| Note 1: live-region wording; empty-state error | Corrected and the limitation documented under Behavior. |
| Note 2: requirement source | The focus rule is attributed to the Accepted K4 row and WCAG 2.4.3; #161 is cited as scope only. |
| Note 3: who authorizes Task 7 | Both the fresh M5 acceptance and the owner's explicit acceptance (header row, status line, Task 7). |
| Note 4: index lookup | Step 3 adds the comment. |
| Note 5: Test 3's `disabled` assertion | Removed. |
| Optional: no focus pull-back on a later re-render | **Added** as test 6, labelled a characterization guard with its own break run (Task 7 Step 4b), after the second review (below). |
| Optional: remove after a blocked submit | **Not added.** The two effects have separate state and separate dependency lists, and the blocked-submit effect has its own tests. The case would test React rather than this change, and it broadens the task. |

### M5 review of revision 4, second pass

A fresh independent reviewer (not the first one) reviewed the second pass on 2026-11-02 and returned **Revise**. It confirmed that both first-pass blockers and all five notes are resolved in the plan text, and it ran the existing editor test file (53/53 pass). This third pass answers it:

| Finding | Answer |
| --- | --- |
| B1: test 6 passes today but was covered by "regression tests… no break run applies" | Task 7 intro and Step 1 now call test 6 a characterization guard. Step 4b adds its break run: the behavior broken, the covered test, the outside-the-commit run, the restore, and the fail-closed rule. Step 7's M6 record lists it. |
| Note 1: index −1 | Step 3 sends a key that is not found to Add bag on purpose. |
| Note 2: Self-check semantics row; header "no command has been run" | The Self-check row covers Task 7. The Status and Pre-validation rows now point to the Execution record. |
| Note 3: which build each row ran on | Step 7's M6 record states the build for every row. |
| Note 4: the K4 script could misfire again | Step 7 logs `activeElement` before every key press and stops on a mismatch. |
| Note 5: tap vs click | Step 7 uses `hasTouch` and `tap()` if the tool allows, otherwise a click recorded as such. iOS programmatic-focus keyboard behavior is listed as not verified. |
| Note 6: heading date; Step 1 title; K4 starting focus | Heading covers both decision dates (anchors updated). Step 1 is retitled. The K4 row starts from the Bag 1 input. |

### M5 decision for revision 4

- **Third pass:** a fresh independent reviewer (neither of the earlier two) reviewed it on 2026-11-02 and returned **Accept**, with no blockers and seven non-blocking notes.
- **Owner:** explicitly accepted revision 4 for Task 7 on 2026-11-02, on condition that all seven notes were incorporated first. No further M5 review is needed for them. The notes and where each now sits:
  1. Step 1 and Step 4b explain the blur re-render (`focusout` → `onBlur` → `touchEntry`).
  2. Step 4b fails closed unless test 6 fails with focus on the Bag 2 input, and the actual element is recorded.
  3. The Self-check cites Task 7 Step 4b.
  4. The K4 re-run names its starting focus and every Tab and Shift+Tab stop, including the five from "Add bag" to "Remove bag 1".
  5. Task 7 Step 6 carries the proposed commit message, which is not authorized.
  6. "Task 6 Steps 5–7", and a fresh G3 approval if the container was restarted.
  7. The Task 3 R1–R4 screenshot limitation is recorded in Retained Task 6 evidence.
- **Boundaries:**
  - **Task 7:** authorized.
  - **K4:** stays Fail until the fix and the full re-verification pass.
  - **G2:** not approved. Nothing is staged or committed.
  - **G3:** the existing approval holds for the current server and container state.
  - **G7:** required before M6 closes.
  - **G8:** outside this authorization.
