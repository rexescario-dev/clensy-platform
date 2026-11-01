# Bookings Delete: One Delete at a Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or superpowers:subagent-driven-development) to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Accepted (revision 2)** at M5, 2026-11-01 ([M5 decision](#m5-decision)). M6 **Complete**, uncommitted ([Execution record (M6)](#execution-record-m6)). M7 **Approved** on 2026-11-01, on a fresh independent review ([M7 decision](#m7-decision)). M8 **N/A**, M9 **Complete**, M10 **does not apply** ([M8](#m8--not-applicable), [M9](#m9--documentation-2026-11-01), [M10](#m10--not-applicable)). **Ready for closeout.** On 2026-11-01 the owner authorized committing, pushing and opening the PR ("push, make PR"). Merging and closing #205 are not yet authorized. Drafted at M4 on 2026-11-01. Revision 1 was returned by an independent M5 review (**Request changes**, 2026-11-01); revision 2 addresses it ([Revision 2 changes](#revision-2-changes)). At M4 and M5 nothing in this plan had been run against the repository: every `Expected:` line was a prediction. |
| Tracking issue | [#205](https://github.com/rexescario-dev/clensy-platform/issues/205) "Prevent a second Bookings delete while one is in progress". Follow-up from [#194](https://github.com/rexescario-dev/clensy-platform/issues/194) (PR #203). |
| Relies on (Accepted) | [Dashboard UX Foundation](../specs/2026-08-17-dashboard-ux-foundation-design.md) §4.4 (`ConfirmDialog`: `confirming` is caller-owned) and Amendment #194 §9.3 (a confirming `ConfirmDialog` refuses user dismissal). Neither is changed. |
| Spec amendment | **None needed.** §9.7 records the Bookings trigger as caller-side duplicate-action hardening, to be done, "if wanted, [as] a separate issue", and §9.5 says that is each caller's responsibility. §9.7's "No change to any `ConfirmDialog` caller, including the Bookings 'Delete booking' trigger, which stays enabled while a delete runs" describes #194's own scope. This slice is the separate issue §9.7 anticipated and does not reopen #194. Issue #205's acceptance criteria are the requirements; the [owner decision](#owner-decision) settles the one UI choice they leave open. |
| Authority | Where this plan and the Accepted spec or issue #205 disagree, those win and this plan must be revised. Names (`deletingRef`, `deleting`, the test file name, helper names) and task order are planning decisions, not product behavior. |
| Branch and commits | `feat/205-bookings-delete-guard` from `main`, created only when the owner authorizes M6. Staging, committing, pushing and opening the PR each need the owner's explicit approval (precedent: #211). One PR carries this plan, its M5–M10 records and the implementation. |
| M7 | This slice changes application code, so `CLAUDE.md` requires a **fresh, independent reviewer** on the most capable model that did not implement the change. It receives the Accepted spec (§4.4, §9), issue #205, this plan once Accepted, and the branch diff. |
| Package names | `pnpm --filter web` is `apps/web`. |

## M5 decision

**Accepted** on 2026-11-01, revision 2.

**Review history.**
- An independent review of revision 1 returned it (**Request changes**): one blocker (test E) and three required corrections. See [Revision 2 changes](#revision-2-changes).
- A fresh independent review of revision 2, on the most capable model, by an agent that wrote no revision, gave **Approve**, with no blockers and no required corrections. It derived from the source the result of every test (S, F, R, A–E) before and after the change, and the failing tests for each break run K1–K9. All matched the plan.

**Owner acceptance.** The owner was asked to accept revision 2 and to authorize M6, and replied "m6" (2026-11-01). That is recorded as accepting revision 2 and authorizing M6. M6 covers creating the local branch and executing this plan. Staging, committing, pushing and opening the PR are not authorized.

**Non-blocking review notes carried into M6:**
1. `beforeEach` also clears the queue of pending `removeBooking` resolve and reject functions.
2. The traceability "Tests" row may also cite K7–K9.
3. Task 3 matches the README sentence's exact text; the README uses double quotes.
4. Task 3 may note that this slice supersedes the "stays enabled" behavior described in #194 §9.7.
5. `trigger()` can identify the button by its destructive variant plus its text.

## Execution record (M6)

Authorized by the owner on 2026-11-01 ("m6"). Branch `feat/205-bookings-delete-guard` (local only), from `main` at `e9b55de`. No commit is authorized, so the work is uncommitted. Executed inline (superpowers:executing-plans). Break runs were made in the working tree and restored. After each one, `page.tsx` was verified: `git diff --quiet` for Task 1 (against `HEAD`), and `cmp` against a saved copy of the green file for Task 2. Nothing broken was kept.

**Task 1 (characterization).**
- `pnpm --filter web exec vitest run lib/bookings-delete.interaction.test.tsx` on unchanged `page.tsx`: **3 passed** (S, F, R), as predicted.
- Break runs, each failing exactly the predicted tests, on the assertion its break targets:

| Run | Failed | Failing assertion |
| --- | --- | --- |
| K1 (no `onSaved`) | S | `listRefetchCalls`: expected 0 to be 1 |
| K2 (no `onClose`) | S | `routerCalls`: expected `[]` to equal `['replace /app/bookings']` |
| K3 (no error shown) | F, R | `deleteError()`: expected `null` to be `'Unable to delete booking.'` |
| K4 (dialog not closed in `finally`) | S, F | `confirmDialog()`: expected the dialog to be `null` |
| K5 (error not cleared on retry) | R | `deleteError()`: expected `'Unable to delete booking.'` to be `null` |

**Task 2 (guard).**
- **RED.** On unchanged `page.tsx`, A, B, C and D failed, as predicted:
  - A and C on `trigger().disabled` (`false`).
  - B on call count 2.
  - D on call count 3.
  E and the Task 1 tests passed (4 passed).
- **GREEN.** After the change: **8 passed**.
- **Break runs on the changed code**, each failing exactly the predicted tests:
  - K6: E, on `confirmButton().disabled`.
  - K7: B and D, on call counts 2 and 3.
  - K8: C, on `disabled`.
  - K9: R and D, with `TypeError` from `confirmButton()` being `null`, because the guard stayed set, so no dialog opened.
- **Full checks** (`apps/web`):
  - `pnpm test`: **58 files, 2551 tests passed**.
  - `pnpm lint`: exit 0, after reordering object keys and one union in the new test file to satisfy `contextforge/record-key-order` and `@typescript-eslint/sort-type-constituents`; no behavior change.
  - `pnpm exec tsc --noEmit`: exit 0.

**Task 3 (README).** `apps/web/README.md`: the #194 paragraph no longer says the trigger stays enabled. A new "One Bookings delete at a time" paragraph describes the owner decision and the guard, and says it replaces the behavior described in #194 §9.7 (review note 4). This is a separate paragraph rather than an in-place rewrite of the sentence; it is a wording choice only.

**Review notes applied:**
1. `beforeEach` resets `bookings.pending`.
2. Not applied: the traceability table was left as Accepted.
3. Not applied: no README sentence was quoted.
4. Applied in the README.
5. `trigger()` uses `data-variant="destructive"` plus its text.

**Incident (no effect).** An attempt to measure the pre-change suite count with `git stash` ran from the wrong directory: it stashed and immediately restored `page.tsx` without running anything. `cmp` against the saved green copy showed `page.tsx` intact, and the stash list was unchanged. The baseline count was not measured separately. The full suite of 2551 includes the 8 new tests.

**Files:** `apps/web/app/app/bookings/page.tsx` (modified), `apps/web/lib/bookings-delete.interaction.test.tsx` (new), `apps/web/README.md` (modified), this plan.

## M7 decision

**Approved** on 2026-11-01, on a fresh independent review. `CLAUDE.md` requires one for application code: a fresh agent, on the most capable model, that did not implement the change, given the Accepted spec (§4.4, §9), issue #205, this Accepted plan and the uncommitted branch diff. There were no blockers and no required corrections.

**What the reviewer checked:**
- The guard: the ref is set before `removeBooking` and cleared in `finally` on both paths. The trigger has its own guard in `onClick`. `disabled`, the label and `confirming` all read `deleting || removing`.
- Scope: no changes to `@clensy/ui`, Staff, Laundry or `packages/**`. Success and failure presentation is unchanged.
- The edge cases: unmount after success, the window after `finally` but before `loading` clears, and rapid sequences.
- That the harness models Apollo and React faithfully.
- That the README is accurate.

**Commands the reviewer re-ran:** `vitest run lib/bookings-delete.interaction.test.tsx` (8 passed), `pnpm --filter web test` (58 files, 2551 passed), `pnpm --filter web lint` (exit 0) and `tsc --noEmit` (exit 0). It did not repeat the break runs.

**Non-blocking observations, deferred and not acted on:**
1. The test file repeats `notifyRemove()`'s loop inline in the mock.
2. Test A's final Confirm click adds little beyond test B.
3. Test S does not pin the trigger's label after success. This is intentional (Review Focus 5).
4. Spec §9.7 still describes #194's "stays enabled" behavior. The reviewer agrees no amendment is needed, and the README records that this slice supersedes it.

The observation that this plan's Status row was out of date is addressed by this record.

## M8 — Not applicable

Recorded on 2026-11-01. The owner directed M8 through M10 ("m8-m10"), and M7 had approved the change.

No refactoring. The change to `BookingDetailDrawer` is small:
- one ref;
- one state;
- the guard and its clearing in `handleConfirmDelete`;
- one derived `deleteInProgress`, read by the trigger and the dialog.

It follows the page's existing pending-label pattern (`Creating…`, `Saving…`). The two deferred M7 observations are test-file tidy-ups: the inline repeat of `notifyRemove()`'s loop, and test A's extra Confirm click. Neither is a structural problem worth the risk. No code changed for M8.

## M9 — Documentation (2026-11-01)

**Scope:** `apps/web/README.md` and this plan. Each change follows from the M7-approved implementation, which is uncommitted on `feat/205-bookings-delete-guard`.

**`apps/web/README.md`, content (made in M6 as plan Task 3, confirmed here):**
- The **Pending confirmation** paragraph no longer says "Delete booking" stays enabled while a delete runs.
- A new **One Bookings delete at a time** paragraph states the shipped behavior: disabled and "Deleting…" until the mutation settles, including the loading window; at most one delete; the handler guard as the safeguard; and the button working again after a failure. It says this replaces the trigger behavior described in Amendment #194 §9.7, and links #205.

**Checked and not changed:**
- **The Accepted spec:** Dashboard UX Foundation §9.1 and §9.7 describe #194's scope at the time it was written. As the header's **Spec amendment** row explains, no amendment is needed, and the M5 and M7 reviewers agreed.
- **The #194 plan** (`2026-10-23-confirm-dialog-confirming-guard-plan.md`): its "Known limitation" and deferral lines are a closed slice's record, and line 581 already points to #205.
- **The bookings spec and plan** (`2026-08-22-*`): they describe the trigger's label and confirmation, not its state while a delete runs.
- **`docs/features/`:** it has only `laundry.md`.

**Editorial checks:**
- The README's heading lines are identical to `main`'s.
- The README's spec link resolves from `apps/web/`.
- No stale "stays enabled" wording is left in the README.
- The copy and terms match the page: "Delete booking", "Deleting…", "Unable to delete booking.".
- This plan's internal anchors resolve.

## M10 — Not applicable

No workflow asset under `docs/workflows/`, and no installer-managed file (`workflow.yaml`, `.claude/skills/`), changed: `git diff --name-only main -- docs/workflows workflow.yaml .claude` is empty.

## Slice Completion Report (M8–M10)

| Field | Result |
| --- | --- |
| Slice | #205: one Bookings delete at a time |
| Tracking | https://github.com/rexescario-dev/clensy-platform/issues/205 |
| M4 | Plan **Accepted** |
| M5 | Review **Accepted** (revision 2) |
| M6 | **Complete** (uncommitted) |
| M7 | **Approved** (fresh independent review) |
| M8 | **N/A** |
| M9 | **Complete** |
| Branch | `feat/205-bookings-delete-guard` (local only) |
| PR | None: commit, push and PR are not yet authorized |
| Status | **Ready for closeout** (needs the owner's authorization to commit, push and open the PR) |

### Shipped

- In the booking drawer, at most one `removeBooking` runs at a time. A handler-level in-flight guard blocks a second Confirm or trigger activation, even one that lands before React re-renders.
- While a delete runs, "Delete booking" is disabled and reads "Deleting…" until the mutation settles, including after the dialog closes but before Apollo clears `loading`. The confirmation stays confirming for the same period.
- After a failure, the error still shows under the trigger, and one retry starts exactly one delete. Success is unchanged: the list refreshes and the drawer closes.
- The Bookings page now has its first page-level test file: 8 tests, with break runs K1–K9 as evidence. The README documents the behavior.

### Validation

| Check | Result |
| --- | --- |
| Tests | **Passed**: `pnpm --filter web test`, 58 files, 2551 tests (M6; re-run by the M7 reviewer) |
| Typecheck | **Passed**: `tsc --noEmit` in `apps/web` |
| Lint | **Passed**: `pnpm --filter web lint` |
| Build | Skipped: not named in the plan |
| Package validation | N/A |

### Next Gate

**Closeout**: commit (`feat(205)` and `docs(205)`), push, open one PR for #205, merge, and close #205. Each step needs the owner's authorization.

## Owner decision

**2026-11-01.** While a booking delete runs, the "Delete booking" trigger is **disabled** and reads **"Deleting…"**. It stays that way until the mutation settles. That includes the brief window after `handleConfirmDelete`'s `finally` has closed the confirmation dialog but before Apollo's `loading` flag has cleared. The handler-level "already deleting" guard is the actual duplicate-prevention safeguard. The disabled trigger is the matching UI feedback, not a substitute for the guard. This intentionally changes the trigger's earlier behavior described in #194 §9.7 ("stays enabled while a delete runs"), for this separate slice.

## Goal

**Goal:** In the booking `DetailDrawer`, at most one `removeBooking` mutation runs at a time. The trigger shows that a delete is running, and success and failure behave as they do today.

**Architecture:** `BookingDetailDrawer` gets a synchronous in-flight ref that `handleConfirmDelete` checks and sets before it calls `removeBooking`, and clears in `finally`. It also gets a matching `deleting` state for rendering. The trigger and the `ConfirmDialog`'s `confirming` both read `deleting || removing`, where `removing` is Apollo's `loading`. A new jsdom test renders the real Bookings page with `@clensy/client` mocked so the test controls when the mutation's promise settles and, separately, when its `loading` clears.

**Tech Stack:** Next.js app router page (`'use client'`), React 19, Apollo 3 hooks from `@clensy/client`, `@clensy/ui` (`Button`, `ConfirmDialog`, `DetailDrawer`), vitest + jsdom with `react-dom/client` and `act`. This is the same harness style as `apps/web/lib/laundry-list-page.interaction.test.tsx`.

## Global Constraints

- Change only `apps/web/app/app/bookings/page.tsx` (`BookingDetailDrawer`), add `apps/web/lib/bookings-delete.interaction.test.tsx`, and update `apps/web/README.md` line 25.
- SHALL NOT change `ConfirmDialog` or any other `@clensy/ui` primitive. The #194 contract (§9.3, §9.5) stays as it is.
- SHALL NOT change the Staff (`apps/web/app/app/admin/page.tsx`) or Laundry callers.
- SHALL NOT change how delete success or failure is shown. On success: `onSaved()`, then `onClose()`, then the dialog closes. On failure: the text `Unable to delete booking.` under the trigger, and the dialog closes. The drawer stays open.
- Copy: the trigger reads exactly `Delete booking` when idle and exactly `Deleting…` (U+2026, matching `Creating…` and `Saving…` elsewhere on this page) while a delete is in progress. The page's copy is hard-coded English today; this slice keeps it that way.
- "In progress" for the trigger means `deleting || removing`. For the handler guard it means the ref: set synchronously before `removeBooking` is called, and cleared in `finally`.

## Review Focus

1. **Two activations before React re-renders.** Confirm clicked twice in one `act`, or Confirm then "Delete booking", leaves the DOM buttons enabled for the second click. Only the ref stops a second mutation. Covered by Task 2 test B.
2. **The `finally`-before-`loading` window.** The promise has settled and the dialog has closed, but `removing` is still `true`. The trigger must stay disabled and read `Deleting…`, and a click must not reopen the dialog. Covered by Task 2 test C.
3. **Keyboard activation.** A disabled `<button>` cannot be activated by Enter or Space. jsdom does not turn key presses into clicks, so the test asserts `disabled` and that `click()` on the disabled trigger opens nothing. Covered by Task 2 tests A and C.
4. **Retry after failure.** The ref must be cleared on rejection, not only on success, or the drawer stays locked forever. Covered by Task 2 test D.
5. **Success path unchanged.** After success the trigger re-enables while the drawer is closing. This is accepted: it is outside "while the delete is in progress", and the drawer's close is unchanged. Covered by Task 1 test S, which pins the observable success behavior, not the label afterwards.

---

## File map

| File | Change |
| --- | --- |
| `apps/web/lib/bookings-delete.interaction.test.tsx` | **Create.** Renders the real Bookings page with the drawer open. Holds the characterization tests (Task 1) and the guard tests (Task 2). |
| `apps/web/app/app/bookings/page.tsx` | **Modify** `BookingDetailDrawer` only: lines ~376–377 (state), ~415–429 (`handleConfirmDelete`), ~550–568 (trigger and `ConfirmDialog`). |
| `apps/web/README.md` | **Modify** line 25: the last sentence ("In Bookings, 'Delete booking' itself stays enabled while a delete runs") becomes the new behavior, citing #205. |

Not changed: `packages/ui/**`, `packages/web/**`, `packages/client/**`, `apps/api/**`, `apps/web/app/app/admin/page.tsx`, `apps/web/app/app/laundry/**`, and every existing test.

---

### Task 1 (type: `code`): Bookings page delete harness and characterization tests

These tests pin behavior that already works, so they are **characterization tests**. They pass on today's code. Their proof is the [break runs](#break-runs-task-1).

**Files:**
- Create: `apps/web/lib/bookings-delete.interaction.test.tsx`

**Interfaces:**
- Produces, for Task 2, in the same file:
  - `bookings` (a `vi.hoisted` state object) with `removeCalls: unknown[]` (every `removeBooking` options object, in call order), `removeLoading: boolean`, `listRefetchCalls: number`, `routerCalls: string[]`.
  - `settleRemove(outcome: 'resolve' | 'reject', options?: { clearLoading?: boolean }): Promise<void>` settles the **oldest** pending `removeBooking` promise inside `await act(async …)`. `clearLoading` defaults to `true`. When `true`, it first sets `removeLoading = false` and notifies, as Apollo clears `loading` before the awaited promise resumes. When `false`, `loading` stays `true`.
  - `clearRemoveLoading(): void` sets `removeLoading = false` and notifies, inside `act`.
  - `trigger(): HTMLButtonElement` returns the drawer's delete trigger, the destructive button whose text is `Delete booking` or `Deleting…`.
  - `confirmButton(): HTMLButtonElement | null` returns the `Delete` button inside the confirmation dialog, or `null` when no confirmation dialog is open.
  - `confirmDialog(): HTMLElement | null` returns the `[role="dialog"]` whose heading text is `Delete this booking?`.
  - `deleteError(): string | null` returns the text of the `p.text-red-600` that follows the trigger, or `null`.
  - `openConfirm(): void` clicks `trigger()` inside `act`.

**Harness decisions** (the implementer writes the code):
- `// @vitest-environment jsdom`, and `IS_REACT_ACT_ENVIRONMENT = true`, as in the laundry interaction test.
- `next/navigation` mock: `usePathname` → `'/app/bookings'`, `useSearchParams` → one stable `URLSearchParams('detail=<BOOKING_ID>')` created per test in `beforeEach` (the same object on every call, so `useCallback` dependencies in `use-detail-drawer.ts` and `use-booking-table-url-state.ts` do not churn), and `useRouter` → `{ back, push, replace }`, each pushing `"<verb> <url>"` to `bookings.routerCalls`. With no drawer marker in `history.state`, `useDetailDrawer().close` calls `router.replace('/app/bookings')`.
- `@clensy/web` mock: `BookingDataTable: () => null`, so the test does not depend on the table. The page still renders.
- `@clensy/client` mock: every query hook returns `{ data, error: undefined, loading: false, refetch }`. `useBookingsQuery` returns an empty list, and its `refetch` increments `bookings.listRefetchCalls`. `useBookingQuery` returns one booking with every field in `bookings.graphql` `query Booking`: customer `Ana Reyes`, service `Deep clean`, status `CONFIRMED`, team `null`. `useTeamsQuery` and `useJobsQuery` return empty nodes. `useCustomersQuery`, `useServicesQuery` and `useCustomerPropertiesQuery` return `data: undefined`; the page reads them through `?.`. The other mutations return `[vi.fn(), { loading: false }]`.
- `useRemoveBookingMutation` must model Apollo. Its `loading` is read with `useSyncExternalStore` over `bookings.removeLoading`. Calling the mutate function synchronously pushes its options to `removeCalls`, sets `removeLoading = true`, notifies subscribers, and returns a new pending promise whose resolve and reject are queued for `settleRemove`. Each call gets its own promise. Apollo 3.14 clears `loading` only for the latest mutation (`mutationId === ref.current.mutationId`); `settleRemove` always clears it. No assertion depends on the difference, because a passing implementation never has two mutations in flight.
- Render `<ToastProvider><BookingsPage /></ToastProvider>` in `beforeEach`. Unmount in `afterEach`. Reset `bookings`.

- [ ] **Step 1: Write the characterization tests**

```tsx
describe('Bookings delete (characterization)', () => {
  it('S: on success, refreshes the list, closes the drawer and closes the dialog', async () => {
    openConfirm();
    act(() => confirmButton()!.click());
    await settleRemove('resolve');
    expect(bookings.removeCalls).toEqual([{ variables: { id: BOOKING_ID } }]);
    expect(bookings.listRefetchCalls).toBe(1);
    expect(bookings.routerCalls).toEqual(['replace /app/bookings']);
    expect(confirmDialog()).toBeNull();
    expect(deleteError()).toBeNull();
  });

  it('F: on failure, shows the error under the trigger, closes the dialog and keeps the drawer', async () => {
    openConfirm();
    act(() => confirmButton()!.click());
    await settleRemove('reject');
    expect(bookings.removeCalls).toHaveLength(1);
    expect(deleteError()).toBe('Unable to delete booking.');
    expect(confirmDialog()).toBeNull();
    expect(bookings.routerCalls).toEqual([]);
    expect(bookings.listRefetchCalls).toBe(0);
    expect(trigger().disabled).toBe(false);
  });

  it('R: one retry after a failure starts exactly one new delete', async () => {
    openConfirm();
    act(() => confirmButton()!.click());
    await settleRemove('reject');
    openConfirm();
    expect(deleteError()).toBe('Unable to delete booking.'); // still shown until the retry is confirmed
    act(() => confirmButton()!.click());
    expect(bookings.removeCalls).toHaveLength(2);
    expect(deleteError()).toBeNull(); // cleared when the retry starts, as today
  });
});
```

- [ ] **Step 2: Run them on unchanged `page.tsx`**

Run: `pnpm --filter web exec vitest run lib/bookings-delete.interaction.test.tsx`
Expected: 3 passed. If any test fails on unchanged code, stop. Either the harness is wrong or today's behavior differs from #205's description, and the plan must be revised.

- [ ] **Step 3: Break runs** (see [Break runs (Task 1)](#break-runs-task-1)). Make each break in the working tree, run the file, record the failing test names, then restore `page.tsx` and confirm `git diff --quiet -- apps/web/app/app/bookings/page.tsx`. No break is committed.

#### Break runs (Task 1)

The implementer chooses the edit that produces each behavior. Record each run's failing test names in the M6 execution record.

| Run | Behavior deliberately broken | Tests expected to fail |
| --- | --- | --- |
| K1 | On success, the list is not refreshed (`onSaved` is not called). | S |
| K2 | On success, the drawer does not close (`onClose` is not called). | S |
| K3 | On failure, no error is shown under the trigger. | F, R |
| K4 | The dialog is not closed after the delete settles (no close in `finally`). | S, F |
| K5 | The error is not cleared when a new delete starts. | R |

---

### Task 2 (type: `code`): The in-flight guard and the "Deleting…" trigger

Traces to issue #205's criteria "Repeated clicks", "Reopen attempts", "One active delete" and "After failure", and to the [owner decision](#owner-decision).

**Files:**
- Modify: `apps/web/app/app/bookings/page.tsx` (`BookingDetailDrawer`)
- Test: `apps/web/lib/bookings-delete.interaction.test.tsx`

**Interfaces:**
- Consumes: the Task 1 harness and helpers.
- Produces: nothing used elsewhere.

- [ ] **Step 1: Write the failing tests** (a new `describe('Bookings delete (one at a time)')`)

```tsx
it('A: while a delete runs, the trigger is disabled and reads "Deleting…"; clicking it starts nothing', () => {
  openConfirm();
  act(() => confirmButton()!.click());
  expect(trigger().disabled).toBe(true);
  expect(trigger().textContent).toBe('Deleting…');
  act(() => { trigger().click(); trigger().click(); });
  act(() => confirmButton()?.click());
  expect(bookings.removeCalls).toHaveLength(1);
});

it('B: two activations before React re-renders start one delete', () => {
  openConfirm();
  act(() => {
    const confirm = confirmButton()!;
    confirm.click();
    confirm.click(); // still enabled in the DOM: only the handler guard stops it
    trigger().click();
  });
  expect(bookings.removeCalls).toHaveLength(1);
});

it('C: after the dialog closes but before loading clears, the trigger stays disabled and nothing reopens', async () => {
  openConfirm();
  act(() => confirmButton()!.click());
  await settleRemove('reject', { clearLoading: false });
  expect(confirmDialog()).toBeNull();
  expect(trigger().disabled).toBe(true);
  expect(trigger().textContent).toBe('Deleting…');
  act(() => trigger().click());
  expect(confirmDialog()).toBeNull();
  expect(deleteError()).toBe('Unable to delete booking.');
  clearRemoveLoading();
  expect(trigger().disabled).toBe(false);
  expect(trigger().textContent).toBe('Delete booking');
});

it('D: after a failure, the trigger works again and one retry starts exactly one new delete', async () => {
  openConfirm();
  act(() => confirmButton()!.click());
  await settleRemove('reject');
  expect(trigger().disabled).toBe(false);
  expect(trigger().textContent).toBe('Delete booking');
  openConfirm();
  act(() => { const confirm = confirmButton()!; confirm.click(); confirm.click(); });
  expect(bookings.removeCalls).toHaveLength(2);
});

it('E: the confirmation stays confirming while a delete runs', () => {
  openConfirm();
  act(() => confirmButton()!.click());
  expect(confirmButton()!.disabled).toBe(true);
  pressEscapeIn(confirmDialog()!); // the tabIndex={-1} dialog container; Cancel is disabled and cannot take focus
  expect(confirmDialog()).not.toBeNull();
  expect(bookings.routerCalls).toEqual([]); // the drawer underneath did not close
});
```

`pressEscapeIn(element)` is a helper Task 2 adds, copied from `packages/ui/src/base/dialogs/confirm-dialog.test.tsx:151`. It focuses `element`, asserts that it holds focus, and dispatches a cancelable, bubbling `keydown` `Escape` on it. It presses on the dialog container, as `confirm-dialog.test.tsx:202–206` does while confirming.

Test E is a **characterization test**. #194 already makes it pass (the `confirming` prop is `removing` today). It pins that the change keeps `confirming` true while the delete runs. Its break run is K6.

- [ ] **Step 2: Run them to see A–D fail**

Run: `pnpm --filter web exec vitest run lib/bookings-delete.interaction.test.tsx`
Expected: A, B, C and D fail. A and C fail on `trigger().disabled` (`false`). B and D fail on `removeCalls` length (2 and 3), because the second synchronous Confirm click reaches `handleConfirmDelete`. E and the Task 1 tests pass.

- [ ] **Step 3: Implement in `BookingDetailDrawer`**

- Add `const deletingRef = useRef(false);` and `const [deleting, setDeleting] = useState(false);`. Add `useRef` to the `react` import.
- `handleConfirmDelete`: return early when `!booking || deletingRef.current`. Otherwise set `deletingRef.current = true` and `setDeleting(true)` **before** `setDeleteError(undefined)` and the `removeBooking` call. In `finally`, set `deletingRef.current = false` and `setDeleting(false)`, alongside the existing `setConfirmDeleteOpen(false)`. The `try` and `catch` bodies are unchanged.
- `const deleteInProgress = deleting || removing;`
- Trigger: `disabled={deleteInProgress}`. `onClick` returns early when `deletingRef.current`, else `setConfirmDeleteOpen(true)`. Label: `{deleteInProgress ? 'Deleting…' : 'Delete booking'}`.
- `ConfirmDialog`: `confirming={deleteInProgress}`.
- Update the comment in `catch` only if it becomes inaccurate. Add one short comment at the ref saying that it, not `disabled`, is what prevents a second delete (#205).

- [ ] **Step 4: Run the file**

Run: `pnpm --filter web exec vitest run lib/bookings-delete.interaction.test.tsx`
Expected: 8 passed (S, F, R, A, B, C, D, E).

- [ ] **Step 5: Break runs** (outside the commit, restored and checked with `git diff` as in Task 1)

| Run | Behavior deliberately broken | Tests expected to fail |
| --- | --- | --- |
| K6 | The `ConfirmDialog` is not marked confirming while a delete runs. | E |
| K7 | The handler does not check the in-flight guard (the trigger stays disabled). | B, D |
| K8 | The trigger's `disabled` reads only the local `deleting` state, not Apollo's `loading`. Its label still reads `deleting \|\| removing`. | C |
| K9 | The in-flight **ref** is not cleared when the delete fails. `setDeleting(false)` stays in `finally`, so the trigger re-enables but its `onClick` and the handler both return early. | D, R |

- [ ] **Step 6: Full checks**

Run: `pnpm --filter web test`, `pnpm --filter web lint`, `pnpm --filter web exec tsc --noEmit`
Expected: all pass. Existing test count +8, no failures.

- [ ] **Step 7: Commit** (only with the owner's authorization, recorded in the M6 execution record)

```bash
git add apps/web/app/app/bookings/page.tsx apps/web/lib/bookings-delete.interaction.test.tsx
git commit -m "feat(205): one Bookings delete at a time"
```

---

### Task 3 (type: `docs/process`): apps/web README

TDD does not apply. Verification is reading the changed paragraph against the implemented behavior.

**Files:**
- Modify: `apps/web/README.md:25`

- [ ] **Step 1:** Replace the final sentence ("In Bookings, 'Delete booking' itself stays enabled while a delete runs …") with: while a delete runs, "Delete booking" is disabled and reads "Deleting…" until the mutation settles, and the page starts at most one delete at a time ([#205](https://github.com/rexescario-dev/clensy-platform/issues/205)). Keep the #194 link for the dialog behavior.
- [ ] **Step 2:** Commit this together with the plan's records in the docs commit (authorization as above).

---

## Traceability

| #205 criterion | Tests |
| --- | --- |
| Repeated clicks | A, B |
| Reopen attempts (trigger, keyboard, the `finally`-before-`loading` window) | A, C, E |
| One active delete (call count asserted) | A, B, D |
| After failure | F, R, D, C |
| After success | S |
| Tests: renders the page, with success and failure characterization | S, F, R, E, plus break runs K1–K6 |

## Revision 2 changes

The M5 review of revision 1 (independent, 2026-11-01) returned **Request changes**: one blocker and three required corrections.

1. **Blocker, test E.** E pressed Escape on Cancel, which is disabled while confirming, and jsdom will not focus a disabled button, so the helper's focus assertion would fail on any code. E now presses on the dialog container, as `confirm-dialog.test.tsx:202–206` does. The run-time fallback sentence is removed.
2. **K9.** Only the ref is left uncleared, and `setDeleting(false)` stays. The prediction is D and R.
3. **K8.** Only `disabled` changes. The label is unchanged.
4. **Harness.** `useSearchParams` returns one stable object per test. The customers, services and properties queries return `data: undefined`. The Apollo `mutationId` nuance is noted.

## Deferred / out of scope

- Any change to `ConfirmDialog`, the Staff or Laundry callers, or delete success and failure presentation (issue #205, Scope).
- The trigger re-enabling briefly after a **successful** delete while the drawer closes. This is not "while a delete is in progress" and is unchanged behavior.
- Translating the Bookings page copy.
