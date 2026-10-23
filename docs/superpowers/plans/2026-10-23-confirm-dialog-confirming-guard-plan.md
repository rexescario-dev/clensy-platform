# Confirm Dialog Confirming Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Accepted** at M5, 2026-10-23, with one clarification applied ([Revision 2 (M5 review 1)](#revision-2-m5-review-1)). Spec Amendment #194 is Accepted at M3. M6 **complete** ([Execution record](#execution-record)); ready for M7. |
| M5 decision | **Accepted** — 2026-10-23, by the owner, reviewing `13cd4ca`. All areas pass: scope, close guard, stacked Escape (test 13 must still show both dialogs open and the drawer's `onClose` not called), the caller-modelled rejection tests, the characterization tests, the B1–B4 breaks (predictions until executed), verification, and the deferred Bookings trigger. One clarification before M6: keep user-initiated close, the disabled buttons and programmatic close distinct. The owner also confirmed that the spec stays Accepted at M3. Execution contract: record actual test and break outcomes, not predicted counts; M7 needs a fresh independent review of the actual diff, including the dialog stack behavior and the caller-modelled rejection tests. |
| Date | 2026-10-23 |
| Tracking issue | [#194](https://github.com/rexescario-dev/clensy-platform/issues/194) "Decide whether ConfirmDialog should refuse dismissal while confirming". |
| Branch | `feat/194-confirm-dialog-confirming-guard`, from `main` at `4257fb7`. One PR for the amendment, this plan, its M5 record and the implementation. |
| Implements (Accepted) | [Dashboard UX Foundation](../specs/2026-08-17-dashboard-ux-foundation-design.md), Status **Accepted** (2026-08-17), with **[Amendment #194](../specs/2026-08-17-dashboard-ux-foundation-design.md#9-amendment-194--confirmation-dialog-dismissal-while-confirming)**, Accepted at M3 on 2026-10-23 (`7f57aaf`). Governing text: §9.3 (contract), §9.5 (invariants), §9.7 (non-goals), §9.8 (verification). |
| Relies on (Accepted, merged) | The same spec's §4.4 (`Modal`, `ConfirmDialog`, `DetailDrawer`) and §4.6. Amendment #180 §8.2 and §8.3.2. The shipped topmost-only Escape handling in `packages/ui/src/internal/use-dialog-behavior.ts` (`openDialogStack`, and the `useEffectEvent` that always calls the latest `onClose`, #193). The `FormDialog` guard (`requestClose`) that #180 shipped, as precedent. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. File names, test names, helper names and task order are planning decisions, not product semantics. |
| Scope | `packages/ui`: `confirm-dialog.tsx` and `confirm-dialog.test.tsx` only. **No** change to `Modal`, `use-dialog-behavior.ts`, `FormDialog`, `DetailDrawer`, any `ConfirmDialog` caller, any other test file, copy, dependency, API, schema or GraphQL. |
| Package names | `pnpm --filter @clensy/ui` is `packages/ui`. `pnpm --filter web` is `apps/web`. `pnpm --filter @clensy/web` is `packages/web`. |
| Baseline | On this branch at `7f57aaf` (code identical to `main` `4257fb7`), at planning time: `pnpm --filter @clensy/ui exec vitest run`, 11 files, 112/112 passed. `pnpm --filter web exec vitest run`, 50 files, 2202/2202 passed. `pnpm --filter @clensy/web exec vitest run`, 16 files, 418/418 passed. This is a baseline, not pre-validation. |
| Pre-validation | **None.** No code in this plan was run before M5. Every `Expected:` line is a prediction until M6 records the actual result. |
| Red-phase evidence | Each "verify it fails" step gives the behavioral failure and a **predicted** count. The count is not a pass criterion. At every red phase the implementer records the actual totals and each failing test's name and first failure message in the Execution record. If the result differs from the prediction, stop and find out why before writing the implementation, and record the explanation. |
| M7 | Application code changes. `CLAUDE.md` requires a **fresh independent reviewer** on the most capable model, given the Accepted spec (with Amendment #194), this plan and the branch diff. |

**Goal:** While a `ConfirmDialog` is confirming, every user-initiated dismissal is refused with no feedback and no replay. A topmost confirming `ConfirmDialog` consumes Escape, so a `DetailDrawer` under it stays open. Once the caller clears `confirming`, after success or failure, dismissal is unchanged, and programmatic close always works (spec §9.3).

**Architecture:** `ConfirmDialog` gets one internal close guard, `requestClose`, the same shape as `FormDialog`'s. It calls the caller's `onClose` only when `confirming` is false. `ConfirmDialog` passes `requestClose`, not `onClose`, to `Modal` and to its Cancel button. Every user path into a `ConfirmDialog`'s close (Escape and the backdrop through `Modal`'s `onClose`, Cancel, and any affordance `Modal` adds later through the same prop) therefore passes one check (§9.3.1 item 4). The guard reads only the `confirming` prop and holds no state, so it lifts on the render where the caller clears `confirming` (§9.5).

**Why the stacked Escape is consumed (clarification 1 of M3).** This was checked in `use-dialog-behavior.ts` before choosing the tests, not assumed. Every open dialog registers its own `document` `keydown` listener. On Escape, each listener calls its dialog's `onClose` only if that dialog is the last entry in `openDialogStack`. A `DetailDrawer` under a `ConfirmDialog` is not last, so its listener does nothing whatever the `ConfirmDialog` decides. The `ConfirmDialog` is last, so its listener calls `requestClose`, which drops the press. Neither dialog closes. The hook never calls `preventDefault` or `stopPropagation` on Escape, so this outcome relies on the stack, not on event propagation. Task 1 therefore observes both outcomes in the DOM, with a real `DetailDrawer` underneath (§9.3.2).

**Tech Stack:** React 19, TypeScript, Vitest with jsdom (per-file `// @vitest-environment jsdom`, as in `form-dialog.test.tsx`; `jsdom` is already a `@clensy/ui` devDependency since #180), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-08-17-dashboard-ux-foundation-design.md` §9 (Amendment #194).

## Global Constraints

**Three close-related behaviors, kept distinct (M5 clarification).** The guard must not treat every close as the same request:

| Behavior | While `confirming` | Mechanism | Verified by |
| --- | --- | --- | --- |
| User-initiated close (Escape, backdrop, Cancel, any later affordance) | **Refused**, no feedback, not replayed (§9.3.1 items 1, 2, 4, 5) | `requestClose`, the one new guard | Tests 4, 5, 7, 9, 11, 13 |
| Cancel and Confirm buttons | **Disabled**, as today (§4.4, §9.3.1 item 3) | The existing `disabled={confirming}`, unchanged. Not the guard. | Test 6 [C]; B2 |
| Programmatic close (the caller sets `open` to `false`) | **Unchanged**: closes and restores focus (§9.3.1 item 7) | `open` stays caller-owned. The guard sits only on the `onClose` path and never reads or overrides `open`. | Test 8 [C]; B3 |


- The change is confined to `@clensy/ui`. No `ConfirmDialog` caller is edited (spec §9.5, §9.7).
- `ConfirmDialogProps` is unchanged as callers see it (§9.4).
- A refused dismissal calls no `onClose`, is not replayed, and changes nothing in the DOM: no attribute, class, text or live region (§9.3.1 item 5, §9.5).
- The guard depends only on `confirming`. `ConfirmDialog` does not observe `onConfirm`'s promise to decide dismissal, and keeps no in-flight state of its own (§9.2, §9.5).
- `onConfirm`'s rejection handling (`handleConfirmClick`'s swallowed rejection) is unchanged (§9.3.1 item 6).
- `Modal`, `use-dialog-behavior.ts`, `FormDialog` and `DetailDrawer` are not modified (§9.4, §9.5).
- No copy change and no new UI state (§9.7).

## Planning decisions for M5 to confirm

- **(a) Guard location.** The guard goes in `ConfirmDialog` (`requestClose`), not in `Modal` or `useDialogBehavior`. The spec leaves the mechanism to M4 (§9.6). This mirrors `FormDialog` (#180), puts the check in one place for the primitive, and leaves `FormDialog` and `DetailDrawer` unchanged by construction.
- **(b) Replace `confirm-dialog.test.tsx` whole.** Its two tests pin "still closes while confirming", which §9.3 reverses (§9.8). The new file follows `form-dialog.test.tsx`: a state-driven fixture whose `onClose` handlers really close their dialog, so "stays open" is observable in the DOM.
- **(c) A real `DetailDrawer` in the fixture.** §9.3.2 and §9.8 name the booking `DetailDrawer` as the dialog underneath, so the stacked test uses `DetailDrawer`, not a second `Modal`.
- **(d) A caller-modelling `onConfirm` for the rejection tests (clarification 2 of M3).** The fixture's `onConfirm` sets `confirming` to `true`, awaits a promise the test rejects, and then, only when the test asks for it, sets `confirming` back to `false`, as a mutation's loading flag does. A second test leaves `confirming` true after the rejection and checks that dismissal is still refused, which shows that `ConfirmDialog` does not infer settlement from the rejection.
- **(e) No `apps/web` test.** §9.8 makes the verification component-level, and no app suite opens a caller's `ConfirmDialog` today (see [Coverage](#coverage-component-tests-vs-regression-suites)). A caller-level test is not required by the spec and is not added. Unlike #180 Task 2, there is no caller regression test to prove.
- **(f) Idle-and-stacked case.** `packages/ui/src/base/detail-drawer.test.tsx` already has `closes only a ConfirmDialog opened on top of it, then itself on the next Escape`, an idle `ConfirmDialog` over a `DetailDrawer`. It stays as is and is not duplicated.
- **(g) Docs.** No README or docs change in M6. `packages/ui/README.md` does not describe dismissal behavior. M9 decides.

## Review Focus

- **`confirming` goes back to false after a rejected `onConfirm`:** Escape must close on the very next press, with no stale guard. Owned by `recovers once the caller clears confirming after a rejected onConfirm`.
- **`onConfirm` rejected but the caller still reports `confirming`:** dismissal stays refused. Owned by `keeps refusing after onConfirm rejects while the caller still reports confirming`.
- **`onConfirm` pending but `confirming` false:** the dialog is not locked. Owned by `does not lock itself while onConfirm is pending if confirming is false` [C].
- **A refused Escape followed by `confirming` clearing:** the dialog must not close by itself. Owned by `does not replay a refused Escape when confirming ends`.
- **A `DetailDrawer` under a confirming `ConfirmDialog`:** one Escape must close neither. Owned by `consumes Escape when the confirming ConfirmDialog is on top of a DetailDrawer`.
- **A caller closing its dialog while still confirming** (both shipped callers do this in a `finally` that runs before the mutation's loading flag clears): it must close and restore focus. Owned by `still closes when the caller sets open to false while confirming, and restores focus` [C].

## Coverage: component tests vs regression suites

Required by M3 (review decision 4). The passing app suites must not be read as proof of the caller flows.

| Suite | What it exercises | Role here |
| --- | --- | --- |
| `packages/ui/src/base/dialogs/confirm-dialog.test.tsx` (rewritten, Task 1) | Every §9.3 behavior, on `ConfirmDialog` with a real `DetailDrawer` and `Modal` | **Proves** §9.3 at the component level |
| `packages/ui/src/base/detail-drawer.test.tsx` | Idle `ConfirmDialog` over a `DetailDrawer`; drawer Escape and close paths | Regression: idle stacking unchanged (§9.3.3) |
| `packages/ui/src/base/dialogs/form-dialog.test.tsx`, `packages/ui/src/internal/use-dialog-behavior.test.tsx` | `FormDialog` guard; the shared hook | Regression: §9.5 "FormDialog … MUST NOT change" |
| `apps/web/lib/session-routing-pages.test.tsx` | Renders the Staff page (`AdminPage`) for session states only; never opens its `ConfirmDialog` | Regression only. Does **not** prove the Staff disable flow |
| `apps/web/lib/laundry-list-page.test.tsx`, `apps/web/lib/laundry-list-page.interaction.test.tsx` | Render the Laundry page and its drawer; no test opens the Laundry `ConfirmDialog` | Regression only. Laundry is outside §9.3 anyway (it never passes `confirming`) |
| Bookings page | No test renders `apps/web/app/app/bookings/page.tsx` | None. The Bookings delete flow is **not** covered by any suite |
| Rest of `web` and `@clensy/web` | Unrelated to `ConfirmDialog` | Regression only |

**Known limitation (spec §9.7).** In Bookings, the "Delete booking" trigger stays enabled while a delete runs. This plan closes the Escape-and-reopen route to a second delete: while `confirming`, the dialog cannot be dismissed and Confirm is disabled. It does not prevent duplicate actions on every path, and it does not change the trigger. That is caller-side hardening for a separate issue, if wanted.

---

### Task 1: `ConfirmDialog` refuses user dismissal while confirming (type: `code`)

Implements spec §9.3.1, §9.3.2, §9.3.3 and §9.5. Planning decisions (a)–(d), (f).

**Files:**
- Modify (rewrite): `packages/ui/src/base/dialogs/confirm-dialog.test.tsx`
- Modify: `packages/ui/src/base/dialogs/confirm-dialog.tsx`

**Interfaces:**
- Consumes: `Modal` (`../modal`), `DetailDrawer` (`../detail-drawer`), `ConfirmDialog`, all unchanged in their props.
- Produces: no new export. `ConfirmDialogProps` is unchanged.

- [ ] **Step 1: Rewrite `confirm-dialog.test.tsx`**

The file starts with `// @vitest-environment jsdom` and sets `IS_REACT_ACT_ENVIRONMENT = true`. It renders with `createRoot` and `act` into a container appended to `document.body`, unmounted in `afterEach`. Its header comment says what it covers (#194, Amendment #194 §9.3), that each fixture `onClose` really closes its dialog, and that [C] marks characterization tests. It replaces the old #180 header, which said a future issue would update these tests.

The fixture is driven by a module-level `state`:

```ts
const state = {
  drawerOpen: false,
  confirmOpen: false,
  modalOpen: false,
  confirming: false,
  confirmMode: 'none' as 'none' | 'clears' | 'keeps' | 'pending',
};
```

`paint()` re-renders it inside `act`. It renders, in order:
- a `<button>Trigger</button>`;
- `<DetailDrawer open={state.drawerOpen} title="Booking">` with one `<button>Drawer action</button>` child;
- `<ConfirmDialog open={state.confirmOpen} title="Delete" description="Sure?" confirmLabel="Delete" confirming={state.confirming} onConfirm={onConfirm}>`;
- `<Modal open={state.modalOpen} title="Over">` with one `<button>Over action</button>` child.

Each `onClose` pushes its name (`'drawer'`, `'confirm'` or `'modal'`) onto `closes: string[]`, sets its open flag to `false`, and calls `root.render(<Fixture />)` without a nested `act`.

`onConfirm` models a caller (planning decision (d)):
- `'none'`: returns immediately (the default, for tests that never click Confirm).
- `'clears'`: sets `state.confirming = true` and re-renders, awaits a promise whose `reject` is stored in `rejectConfirm`, and in a `finally` sets `state.confirming = false` and re-renders. The rejection propagates to `ConfirmDialog`, which swallows it, as it does today.
- `'keeps'`: the same, but the `finally` leaves `state.confirming` true. It is a caller that has not reported settlement yet.
- `'pending'`: does not touch `confirming`, and returns a promise that never settles in the test, like a caller that never passes `confirming`.

`beforeEach` resets `state` to its initial values, `closes` to `[]` and `rejectConfirm` to `undefined`, and creates a fresh container and root. `afterEach` unmounts inside `act` and removes the container, so no dialog stays on `openDialogStack` between tests.

Helpers (names are planning decisions):
- `pressEscapeIn(element)`: focus `element`, assert it is `document.activeElement`, dispatch `new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })` on it inside `act`. As in `form-dialog.test.tsx`, the press reaches the hook only by bubbling to `document`.
- `dialogTitled(title)`: the `[role="dialog"]` whose `aria-labelledby` element has that text, or `null` (as in `detail-drawer.test.tsx`).
- `confirmDialog()`: `dialogTitled('Delete')`. `drawer()`: `dialogTitled('Booking')`.
- `button(text)`: the button with that text. Within the confirm dialog, `cancel()` and `confirmButton()` (not `confirm`, which would shadow `window.confirm`).
- `clickBackdrop(dialog)`: `dialog.parentElement!.click()` inside `act`.

Where to press Escape: while confirming, both `ConfirmDialog` buttons are disabled, so the hook focuses the dialog container (`tabIndex={-1}`). Confirming tests use `pressEscapeIn(confirmDialog()!)`. Idle tests use `pressEscapeIn(cancel())`.

Stacking order follows the order dialogs become open, so a stacked test opens them in separate `paint()` calls.

Tests in `describe('ConfirmDialog dismissal (#194)')`. [C] marks a characterization test, which pins behavior that is already correct.

| # | Test | Arrange | Assert |
| --- | --- | --- | --- |
| 1 | `closes on Escape when idle` [C] | confirm open, idle | `pressEscapeIn(cancel())` → `closes` is `['confirm']`, `confirmDialog()` is `null` |
| 2 | `closes on a backdrop click when idle` [C] | confirm open, idle | `clickBackdrop(confirmDialog()!)` → `['confirm']` |
| 3 | `closes on Cancel when idle` [C] | confirm open, idle | `act(() => cancel().click())` → `['confirm']` |
| 4 | `ignores Escape while confirming` | confirm open, confirming | `pressEscapeIn(confirmDialog()!)` → `[]`, `confirmDialog()` not `null` |
| 5 | `ignores a backdrop click while confirming` | confirm open, confirming | `clickBackdrop(confirmDialog()!)` → `[]`, still open |
| 6 | `keeps Cancel and Confirm disabled while confirming` [C] | confirm open, confirming | `cancel().disabled` and `confirmButton().disabled` are `true`. `act(() => cancel().click())` → `[]` |
| 7 | `changes nothing visible when it refuses a dismissal` | confirm open, confirming; `before = document.body.innerHTML` | `pressEscapeIn(confirmDialog()!)` then `clickBackdrop(confirmDialog()!)` → `document.body.innerHTML` is `before`, `[]` |
| 8 | `still closes when the caller sets open to false while confirming, and restores focus` [C] | focus Trigger, then confirm open, confirming | `state.confirmOpen = false; paint()` → `confirmDialog()` is `null`, `document.activeElement` is Trigger, `[]` |
| 9 | `does not replay a refused Escape when confirming ends` | confirm open, confirming; `pressEscapeIn(confirmDialog()!)` | `state.confirming = false; paint()` → `[]`, still open |
| 10 | `recovers once the caller clears confirming after a rejected onConfirm` | `confirmMode = 'clears'`, confirm open, idle; `act(() => confirmButton().click())` | `confirmButton().disabled` is `true`. `pressEscapeIn(confirmDialog()!)` → `[]`, still open. `await act(async () => rejectConfirm!(new Error('Network down')))` → `state.confirming` is `false`, `confirmButton().disabled` is `false`, still open, `[]`. `pressEscapeIn(cancel())` → `['confirm']` |
| 11 | `keeps refusing after onConfirm rejects while the caller still reports confirming` | `confirmMode = 'keeps'`, confirm open, idle; click Confirm; `await act(async () => rejectConfirm!(new Error('Network down')))` | `pressEscapeIn(confirmDialog()!)` → `[]`, still open; `clickBackdrop(confirmDialog()!)` → `[]` |
| 12 | `does not lock itself while onConfirm is pending if confirming is false` [C] | `confirmMode = 'pending'`, confirm open, idle; click Confirm | `pressEscapeIn(cancel())` → `['confirm']` |
| 13 | `consumes Escape when the confirming ConfirmDialog is on top of a DetailDrawer` | `drawerOpen = true; paint()`, then `confirmOpen = true; confirming = true; paint()` | `pressEscapeIn(confirmDialog()!)` → `closes` is `[]`, **and** `confirmDialog()` not `null`, **and** `drawer()` not `null` |
| 14 | `lets Escape close a dialog on top of a confirming ConfirmDialog` [C] | `confirmOpen = true; confirming = true; paint()`, then `modalOpen = true; paint()` | `pressEscapeIn(button('Over action'))` → `['modal']`, `confirmDialog()` not `null` |

Tests 10 and 11 also rely on the default vitest behavior that fails a run on an unhandled rejection. They therefore check that the rejected `onConfirm` is still consumed (§9.3.1 item 6).

- [ ] **Step 2: Run the tests to verify the red phase**

Run: `pnpm --filter @clensy/ui exec vitest run src/base/dialogs/confirm-dialog.test.tsx`
Expected (predicted): 7 failed / 7 passed. The failing tests are 4, 5, 7, 9, 10, 11 and 13. Each fails because `closes` contains `'confirm'` or the confirm dialog is gone. Test 10 fails at its first Escape. The [C] tests 1, 2, 3, 6, 8, 12 and 14 pass. Record actual counts and messages. Any other failure (an import, act or unhandled-rejection error) means stop and investigate.

- [ ] **Step 3: Implement the guard in `confirm-dialog.tsx`**

Add, inside `ConfirmDialog`, `function requestClose(): void` that returns without calling `onClose` while `confirming` is true, and otherwise calls `onClose()`. Pass `onClose={requestClose}` to `Modal` and `onClick={requestClose}` to the Cancel button. Keep `disabled={confirming}` on both buttons and leave `handleConfirmClick` as it is. Add a short comment, matching `FormDialog`'s: this is the single user-dismissal guard for #194 (spec §9.3), the request is dropped, not queued, the guard reads only `confirming`, and `open` stays caller-owned. Declare it after `handleConfirmClick`, keeping the nested functions alphabetical. Nothing else changes.

- [ ] **Step 4: Run the `@clensy/ui` checks**

Run: `pnpm --filter @clensy/ui exec vitest run && pnpm --filter @clensy/ui lint && pnpm --filter @clensy/ui build`
Expected (predicted): 11 files, 124/124 passed (112 baseline − 2 replaced + 14). Lint and `tsc --noEmit` clean.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/base/dialogs/confirm-dialog.tsx packages/ui/src/base/dialogs/confirm-dialog.test.tsx
git commit -m "feat(ui): keep a confirming ConfirmDialog open on user dismissal (#194)"
```

- [ ] **Step 6: Prove the characterization tests, in a disposable worktree**

The [C] tests pin behavior that is already correct, so the red phase cannot show that they would catch a regression. Each break below is a behavior to produce in a disposable worktree of the committed `HEAD` (Step 5). M6 chooses the source edit that produces it. The run is made outside the committed change, and nothing from it is committed.

| Break | Behavior deliberately broken | Tests expected to fail (exactly) |
| --- | --- | --- |
| B1 | `ConfirmDialog` never calls `onClose` for a user-initiated dismissal, even when `confirming` is false. | 1, 2, 3, 10, 12 |
| B2 | Cancel and Confirm stay enabled while `confirming`. | 6, 10 |
| B3 | While `confirming`, the dialog stays rendered after the caller sets `open` to `false`. | 8 |
| B4 | A confirming `ConfirmDialog` consumes Escape even when it is not the topmost dialog. | 14 |

Notes on the expected sets: under B1, test 10 fails at its last step (Escape after recovery). Under B2, test 10 fails at its first assertion (`confirmButton().disabled` after the click). Tests 4, 5, 7, 9, 11 and 13 are not [C]. They are proven by Step 2's red phase and are not expected to fail under any break.

For each break, run this script from the repository root, saved to a scratch file outside the repository, as `bash <file> <B1|B2|B3|B4>`. Before running it, fill in `apply_break` with M6's edit for that break, operating only on files under `"$wt"`, and `expected` with the break's test numbers mapped to their titles. Both stay in the scratch file and are recorded in the Execution record.

```bash
set -euo pipefail
break_id="$1"
before="$(git status --porcelain=v1)"
proof="$(mktemp -d)"
wt="$proof/wt"
cleanup() {
  if [ -d "$wt" ]; then
    git worktree remove --force "$wt" || true
  fi
  git worktree prune || true
  rm -rf "$proof"
}
trap cleanup EXIT

apply_break() {
  : # M6: produce the behavior for "$break_id" in "$wt/packages/ui/src/...". Never touch the main working tree.
}
expected='[]' # M6: JSON array of the exact titles expected to fail for "$break_id"

git worktree add --detach "$wt" HEAD
apply_break
# Check 1: the break changed something in the worktree only.
if git -C "$wt" diff --quiet; then echo "CHECK 1 FAILED: break $break_id changed nothing"; exit 1; fi
echo "CHECK 1 OK: break $break_id applied in the worktree"

(cd "$wt" && pnpm install --frozen-lockfile --offline)

# Check 2: exactly the expected tests fail.
status=0
(cd "$wt" && pnpm --filter @clensy/ui exec vitest run src/base/dialogs/confirm-dialog.test.tsx \
  --reporter=default --reporter=json --outputFile.json="$proof/result.json") || status=$?
if [ "$status" -eq 0 ]; then echo "CHECK 2 FAILED: vitest passed under $break_id"; exit 1; fi
[ -s "$proof/result.json" ] || { echo "CHECK 2 FAILED: no JSON result (exit $status)"; exit 1; }
node -e '
  const expected = JSON.parse(process.argv[2]).sort();
  const results = require(process.argv[1]).testResults.flatMap((file) => file.assertionResults);
  const failed = results.filter((test) => test.status === "failed").map((test) => test.title).sort();
  const ok = results.length === 14 && JSON.stringify(failed) === JSON.stringify(expected);
  if (!ok) { console.error("CHECK 2 FAILED", JSON.stringify({ total: results.length, failed, expected }, null, 1)); process.exit(1); }
  console.log("CHECK 2 OK:", failed.join(" | "));
' "$proof/result.json" "$expected"

cleanup
trap - EXIT

# Check 3: the working tree is exactly as it was.
[ "$(git status --porcelain=v1)" = "$before" ] || { echo "CHECK 3 FAILED: working tree changed"; exit 1; }
echo "CHECK 3 OK: working tree unchanged"

# Check 4: the committed implementation still has the guard.
grep -q requestClose packages/ui/src/base/dialogs/confirm-dialog.tsx || { echo "CHECK 4 FAILED: requestClose missing"; exit 1; }
echo "CHECK 4 OK: active ConfirmDialog contains requestClose"

# Check 5: the temporary worktree is gone.
if [ -e "$proof" ] || git worktree list --porcelain | grep -qF "$wt"; then
  echo "CHECK 5 FAILED: temporary worktree remains"; exit 1
fi
echo "CHECK 5 OK: temporary worktree removed"
```

Expected: for each of B1–B4, the script exits 0 and prints `CHECK 1 OK` to `CHECK 5 OK`. Record, per break: the edit used (as a diff), the failing titles and their first failure message, and all five check results. If `pnpm install --offline` cannot resolve from the local store, the script stops there. Rerun with `--offline` removed from that one line, and record that you did. If any check fails, stop and investigate. A failed check means the characterization tests do not yet prove what they pin.

### Task 2: Full verification and execution record (type: `docs/process`)

TDD does not apply. The verification below and the Execution record replace it.

**Files:**
- Modify: this plan (append `## Execution record`)

- [ ] **Step 1: Run the CI-equivalent checks**

Run: `pnpm install --frozen-lockfile && pnpm run lint && pnpm --filter web exec tsc --noEmit && pnpm run test`
Expected: all succeed. `@clensy/ui` 124/124. `web` 50 files, 2202/2202, and `@clensy/web` 16 files, 418/418, both unchanged from the baseline. Record each command's actual result and every package's test totals. In the record, describe the `web` and `@clensy/web` results as regression coverage, per [Coverage](#coverage-component-tests-vs-regression-suites), not as proof of the Staff or Bookings flows.

- [ ] **Step 2: Account for every changed path**

Run: `git diff --name-only 4257fb7 HEAD | sort`
Every path in the output must belong to exactly one group below, and every listed path must appear. Record the full output and each path's group. A path in no group, or a missing path, means stop and investigate. Do not filter the command.

- **#194 implementation** (Task 1), exactly: `packages/ui/src/base/dialogs/confirm-dialog.test.tsx`, `packages/ui/src/base/dialogs/confirm-dialog.tsx`.
- **#194 workflow artifacts**, exactly: `docs/superpowers/specs/2026-08-17-dashboard-ux-foundation-design.md` (Amendment #194) and `docs/superpowers/plans/2026-10-23-confirm-dialog-confirming-guard-plan.md` (this plan and its records).

Then verify: `git diff --quiet 4257fb7 HEAD -- packages/ui/src/base/modal.tsx packages/ui/src/internal/use-dialog-behavior.ts packages/ui/src/base/dialogs/form-dialog.tsx packages/ui/src/base/detail-drawer.tsx apps packages/web pnpm-lock.yaml` exits 0, so no shared primitive, caller or dependency changed.

- [ ] **Step 3: Write the Execution record and the M6 Slice Completion Report, then commit**

Append `## Execution record` with Task 1's red and green results and Step 6's four break proofs as actual output, and the Step 1 and Step 2 results. Then emit the M6 Slice Completion Report per `docs/workflows/conventions/reporting-conventions.md`, with Next Gate M7 (a fresh independent reviewer).

```bash
git add docs/superpowers/plans/2026-10-23-confirm-dialog-confirming-guard-plan.md
git commit -m "docs(194): record M6 execution"
```

## Traceability

Each §9.8 acceptance criterion, and the §9.3 and §9.5 text it points to, maps to the tests that verify it. "Proves" means a component-level test. Suites listed under [Coverage](#coverage-component-tests-vs-regression-suites) as regression only are not cited as proof.

| Spec | Verified by |
| --- | --- |
| §9.3.1 items 1, 2, 4; §9.8 bullet 1 (Escape, backdrop, single guard) | Task 1 Step 3; tests 4, 5 |
| §9.3.1 item 3; §9.8 bullet 1 (Cancel and Confirm disabled) | Test 6 [C]; B2 |
| §9.3.1 item 5, §9.5; §9.8 bullet 1 (no feedback, no replay, no `onClose`) | Tests 7, 9 |
| §9.3.1 item 6 (rejection still consumed) | Tests 10, 11 (no unhandled rejection) |
| §9.3.1 item 7, §9.5 (programmatic close) | Test 8 [C]; B3 |
| §9.3.2; §9.8 bullet 3 (topmost consumes Escape, both dialogs still open) | Test 13; test 14 [C] and B4 for "anything else on top" |
| §9.3.3; §9.8 bullet 2 (idle, and after settling) | Tests 1, 2, 3 [C], 10; B1 |
| §9.2, §9.5; §9.8 bullets 2 and 8 (settled = caller clears `confirming`; no own lock) | Tests 10, 11, 12 [C]; B1 |
| §9.4, §9.5; §9.8 bullet 4 (`FormDialog`, `DetailDrawer`, callers unchanged) | Task 2 Step 2 (no other path changed); `form-dialog.test.tsx`, `detail-drawer.test.tsx` as regression |
| §9.8 bullet 7 (old characterization tests replaced; existing suites pass) | Task 1 Step 1; Task 2 Step 1 |
| §9.8 bullet 9 (component-level; app suites are regression only) | [Coverage](#coverage-component-tests-vs-regression-suites); Task 2 Step 1 record wording |
| §9.7 (Bookings trigger stays enabled; no duplicate-action guarantee) | Known limitation above; Task 2 Step 2 (no `apps` change) |

## Revision 2 (M5 review 1)

| Finding | Resolution |
| --- | --- |
| **Clarification** (before M6): make the relationship between the close guard and the disabled buttons explicit, and keep programmatic close separate. | Added the three-behavior table at the top of [Global Constraints](#global-constraints). The guard covers only user-initiated close. The disabled buttons stay the existing `disabled={confirming}`. Programmatic close goes through caller-owned `open` and is untouched. Each row names its tests and break. No task, test or prediction changed. |
| Spec status. | The owner confirmed that Amendment #194 stays **Accepted** at M3, and that this is distinct from implementation completion. No spec edit. |

## Deferred (not in this plan)

- Disabling the Bookings "Delete booking" trigger while a delete runs, or any other caller-side duplicate-action hardening (spec §9.7). It needs a separate issue if it is wanted.
- A caller-level test for the Staff or Bookings confirm flow. The spec does not require one (§9.8). It would be a separate test-only issue.
- Any docs change. M9 decides.

## Execution record

### M6 — 2026-10-23

Executed inline (native), in plan order, on `feat/194-confirm-dialog-confirming-guard` from the M5 acceptance commit `8a559f5`. Every `Expected:` line was compared with the real output. All counts below are **actual** results. Each matched its prediction.

| Task | Commit | Red (actual) | Green (actual) |
| --- | --- | --- | --- |
| 1 | `3185379` | `vitest run src/base/dialogs/confirm-dialog.test.tsx`: 7 failed, 7 passed (14). The failures were tests 4, 5, 9, 10, 11 and 13, each with `AssertionError: expected [ 'confirm' ] to deeply equal []`, and test 7 with `TypeError: Cannot read properties of null (reading 'parentElement')`, because the Escape had already closed the dialog before the backdrop click. The plan allows this ("or the confirm dialog is gone"). Test 10 failed at its first Escape. The 7 [C] tests passed. | `@clensy/ui` 11 files, 124/124. `lint` clean. `build` (`tsc --noEmit`) clean. |

**Task 1 Step 6, characterization breaks (actual).** The plan's script was used as written, with `apply_break` and `expected` filled in from scratch files outside the repository (one Python edit per break, applied only under the worktree, and a title list per break). Each break ran in its own disposable detached worktree of `3185379`. `pnpm install --frozen-lockfile --offline` succeeded every time, so the online fallback was not needed. Each run exited 0 with `CHECK 1 OK` to `CHECK 5 OK`: the break changed the worktree, exactly the assigned tests failed out of 14, the working-tree status was unchanged, the active `ConfirmDialog` still contains `requestClose`, and the worktree was removed. Nothing from these runs was committed.

| Break | Edit used (worktree only) | Failed (exactly the assigned set) and first failure |
| --- | --- | --- |
| B1 | `requestClose` body replaced by `return;` | Tests 1, 2, 3, 12 [C] and 10: each `expected [] to deeply equal [ 'confirm' ]`, at lines 186, 193, 199, 288 and 268. Line 268 is test 10's last step (Escape after recovery), as predicted. |
| B2 | Both `disabled={confirming}` → `disabled={false}` | Test 6 [C], `expected false to be true` at line 220 (`cancel().disabled`), and test 10 at line 258, its first assertion (`confirmButton().disabled` after the click), as predicted. |
| B3 | `<Modal open={open \|\| confirming}` | Test 8 [C], `expected <div role="dialog" …> to be null` at line 240. |
| B4 | While `open && confirming`, a capture-phase `document` `keydown` listener calls `stopImmediatePropagation()` on Escape | Test 14 [C], `expected [] to deeply equal [ 'modal' ]` at line 306. |

All 7 [C] tests failed under their assigned break, for the expected reason. No assigned test passed or failed for an unrelated reason. Tests 4, 5, 7, 9, 11 and 13 did not fail under any break, as predicted. They are proven by the red phase.

**Rulings (deviations from the plan's text):**
1. Task 1: `contextforge/record-key-order` applies to test files under `packages/ui/src`. The fixture's `state` keys and their `beforeEach` resets are therefore in the rule's order (`confirming`, `confirmMode`, `confirmOpen`, `drawerOpen`, `modalOpen`), not the plan's listing order. Top-level helpers are in name order for `contextforge/function-order`. This is lint conformance, not a plan change.
2. Task 1: the test-10/11 caller model is wrapped in a helper, `rejectAndSettle()`, and the confirm-dialog open step in `openConfirm(confirming)`. These are planning-level helper names. The plan's arrangements and assertions are unchanged.

### Task 2 — verification (actual results)

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS, exit 0 |
| `pnpm run lint` | PASS. turbo 6/6 tasks. |
| `pnpm --filter web exec tsc --noEmit` | PASS, exit 0 |
| `pnpm run test` | PASS. turbo 10/10 tasks: `@clensy/ui` 11 files 124/124 (baseline 112 − 2 replaced + 14); `web` 50 files 2202/2202; `@clensy/web` 16 files 418/418; `@clensy/validation` 79/79; `@clensy/client` 13/13; `api` 75 suites 1071/1071. `api`, `@clensy/client` and `@clensy/validation` were turbo cache hits, because none of their inputs changed. |
| Scope (Step 2) | PASS. `git diff --name-only 4257fb7 HEAD` lists 4 paths, each in exactly one group. **#194 implementation (2):** `packages/ui/src/base/dialogs/confirm-dialog.test.tsx`, `packages/ui/src/base/dialogs/confirm-dialog.tsx`. **#194 workflow artifacts (2):** the spec (Amendment #194) and this plan. `git diff --quiet 4257fb7 HEAD -- modal.tsx use-dialog-behavior.ts form-dialog.tsx detail-drawer.tsx apps packages/web pnpm-lock.yaml` exits 0. |

**What the results prove.** The §9.3 behavior is proven at the component level by `confirm-dialog.test.tsx`: the red phase for the new behaviors, and B1–B4 for the [C] tests. The `web` and `@clensy/web` results are **regression coverage only**. Per [Coverage](#coverage-component-tests-vs-regression-suites), no suite opens the Staff or Bookings `ConfirmDialog`, and no suite renders the Bookings page. Their passing shows nothing else regressed. It does not show that the Staff or Bookings flows behave as §9.3 requires.

Not run: a manual browser check of the Staff disable or Bookings delete flow. It is not required by the plan or by spec §9.8. An owner may do it at M7 or before merge.

## Slice Completion Report (M6)

| Field | Result |
| --- | --- |
| Slice | #194 ConfirmDialog confirming guard |
| Tracking | https://github.com/rexescario-dev/clensy-platform/issues/194 |
| M4 | Plan **Accepted** |
| M5 | Review **Accepted** |
| M6 | **Complete** |
| M7 | Pending |
| M8 | Pending |
| M9 | Pending |
| Branch | `feat/194-confirm-dialog-confirming-guard` |
| PR | Not yet opened |
| Status | **Ready for M7** |

### Shipped

- While `confirming`, a `ConfirmDialog` refuses Escape, backdrop and Cancel dismissal, with no feedback and no replay (spec §9.3.1).
- A topmost confirming `ConfirmDialog` consumes Escape. A `DetailDrawer` underneath stays open (§9.3.2).
- Dismissal returns to normal on the render where the caller clears `confirming`, including after a rejected `onConfirm`. The guard keeps no lock of its own (§9.3.3, §9.5).
- Programmatic close and the disabled buttons are unchanged. No caller, shared primitive or dependency changed.
- The #180 characterization tests that pinned "still closes while confirming" are replaced by 14 tests of §9.3, with B1–B4 break evidence for the 7 [C] tests.

### Validation

| Check | Result |
| --- | --- |
| Tests | **Passed** (`pnpm run test`, 10/10 turbo tasks; `@clensy/ui` 124/124) |
| Typecheck | **Passed** (`pnpm --filter web exec tsc --noEmit`; `@clensy/ui` `tsc --noEmit`) |
| Lint | **Passed** (`pnpm run lint`, 6/6) |
| Build | **Passed** (`@clensy/ui` `build` = `tsc --noEmit`) |
| Package validation | **Passed** (`pnpm install --frozen-lockfile`; scope audit, 4 paths) |

### Next Gate

**M7 — Code Review** (a fresh, independent reviewer, per `CLAUDE.md`)

## Gate outcomes

### M7 — Code Review (2026-10-23)

**Reviewer:** a fresh, independent, read-only agent on the most capable model (Opus 5.5). It did not write the change and made no changes to the repository. It reviewed `4257fb7..b46383b` against the Accepted spec (Amendment #194), this plan, its Execution record and issue #194. **This is not a self-review.** It satisfies the `CLAUDE.md` M7 rule for application-code slices.

**Decision: Approved for merge.** No blocking findings.

- **Plan tasks:** Task 1 Steps 1–6 ✓, Task 2 Steps 1–3 ✓. The two recorded rulings (lint-driven order, helper names) were accepted as planning-level.
- **M6 gate:** the implementation (`3185379`) follows the M5 acceptance (`8a559f5`).
- **Verification the reviewer ran at `b46383b`:** `@clensy/ui` vitest 124/124 (fresh), lint and `tsc --noEmit` clean; `confirm-dialog.test.tsx` 14/14 with titles matching plan tests 1–14 and no unhandled rejections; `pnpm run lint` 6/6; `web` `tsc --noEmit` clean; `pnpm run test` 10/10 (turbo cache replays); the scope audit found exactly 4 paths and `git diff --quiet` on every shared primitive, `apps`, `packages/web`, `pnpm-lock.yaml` and both `package.json` files; the spec diff removes no lines and does not edit §8.
- **Independent re-runs, in a disposable worktree:** the red phase and B1–B4 reproduced the recorded failing titles, messages and line numbers exactly. Three extra probes:
  - P1, the topmost-only check removed from the hook, fails exactly test 13, with `['drawer']`. So test 13 detects the drawer underneath closing.
  - P2, `ConfirmDialog` unlocking itself on a caught rejection, fails exactly test 11.
  - P3, `ConfirmDialog` keeping its own in-flight lock, fails exactly tests 10 and 12.
- **Owner focus points:**
  - (1) Stacked Escape is proven both ways, by the red phase and by P1.
  - (2) The rejection tests model the caller, and P2 and P3 show they rule out inferred settlement and an own lock.
  - (3) The three close behaviors stay distinct.
  - (4) The B1–B4 evidence meets `code-review.md` step 7.
  - (5) Scope and coverage claims do not overclaim.
- **Non-blocking observations:**
  - The repo-wide lint and test runs were turbo cache replays. `pnpm run test --force` before merge would give fully fresh app-suite evidence.
  - The task checkboxes are still unticked, which is cosmetic.
  - No manual browser check of the Staff or Bookings flows was done. It is not required by §9.8.
