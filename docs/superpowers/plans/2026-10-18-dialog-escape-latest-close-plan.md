# Dialog Escape Latest-Close Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan and [#196](https://github.com/rexescario-dev/clensy-platform/issues/196) is merged to `main`.**

| Field | Value |
| --- | --- |
| Status | **Accepted (revision 6)** at M5, 2026-10-19. M6 in progress. #196 merged as `66b55f9`. M6 resumes at Task 1 Step 3 ([Revision 6](#revision-6-m6-return-from-task-1-step-3)). |
| M5 decision | **Accepted** — 2026-10-19, revision 6 (`52372ae`), by the owner, reviewing the complete diff from revision 5 (`d825d84`): "Accepted — revision 6. This accepts the plan revision; it does not mean Step 3 has passed or authorize implementation beyond the plan's gates." Earlier: **Accepted** — 2026-10-18, revision 5 (`11e0d37`), by the owner, reviewing the complete committed file: "Accepted. No further plan revision is required." The owner's caveats: the acceptance validates the plan's design and review criteria; it does not mean the characterization breaks have been run or the implementation verified. M6 stays blocked until #196 is merged; then run the Task 1 Step 0 prerequisite checks and rebase first, and record actual results, not the predicted counts or planned break signatures. Execution method: **native** (owner decision, 2026-10-18), followed by a fresh independent M7 reviewer that does not rely only on the implementing session's reasoning or test report. |
| M5 history | First pass (2026-10-18, owner, reviewed `8c9b613`): **Returned for Revision** ("Request changes"), findings M5-1 to M5-6 and one execution guard. All are addressed in [Revision 2 (M5 review 1)](#revision-2-m5-review-1). Second pass (2026-10-18, owner, reviewed `e9bfc3e`): **Returned for Revision**, findings M5-7 (P1) and M5-8 (P2). The six earlier findings are recorded as addressed. Both are resolved in [Revision 3 (M5 review 2)](#revision-3-m5-review-2). Third pass (2026-10-18, owner, reviewed `6fe0f29`): **Returned for Revision**, findings M5-9 and M5-10 (P1) and M5-11 (P2), plus five non-blocking observations. All are resolved in [Revision 4 (M5 review 3)](#revision-4-m5-review-3). Fourth pass (2026-10-18, owner, reviewed the Revision 4 text as quoted from `fb5f8ed`): **Returned for Revision**. M5-9 to M5-11 are recorded as addressed. One wording correction, M5-12, is resolved in [Revision 5 (M5 review 4)](#revision-5-m5-review-4). Fifth pass (2026-10-18, owner, reviewed the full `11e0d37` file): **Accepted**. M5-9 to M5-12 and the earlier safeguards are recorded as resolved. M6 return (2026-10-19): Task 1 Step 3 found C1's open assertion false on unmodified code. The owner chose Option A, and [Revision 6](#revision-6-m6-return-from-task-1-step-3) went to M5 for a sixth pass. Sixth pass (2026-10-19, owner, reviewed the `d825d84`..`52372ae` diff): **Accepted**. The owner asked to preserve: the #196 prerequisite, no spec amendment, the layout-effect probe (with its claim narrowed), the split between characterization and regression tests, the hook-and-tests-only scope, and the fresh independent M7 reviewer. |
| Date | 2026-10-18 |
| Tracking issue | [#193](https://github.com/rexescario-dev/clensy-platform/issues/193) "Dialog Escape handler should read the latest dismissal policy without relying on effect timing". Deferred from [#180](https://github.com/rexescario-dev/clensy-platform/issues/180) / PR [#192](https://github.com/rexescario-dev/clensy-platform/pull/192), M7 non-blocking observation. Implementation guidance: the owner's `useEffect` audit comment on #193 (2026-10-18, at `d5d845e`, finding 3). |
| Branch | `feat/193-dialog-escape-latest-close`, from `main` at `d5d845e`. One PR for this plan, its M5 record and the implementation. The branch also carries the Context Forge workflow update (generic 1.5.0 → 1.6.0), committed in `ffcf7a6` at the owner's request, before M5. Before Task 1 starts, the branch is rebased onto the `main` that contains #196's merge (see Hard prerequisite). |
| Implements (Accepted) | [Dashboard UX Foundation](../specs/2026-08-17-dashboard-ux-foundation-design.md), Status **Accepted** (2026-08-17), with [Amendment #180](../specs/2026-08-17-dashboard-ux-foundation-design.md#8-amendment-180--form-dialog-dismissal-while-submitting) **Accepted** (2026-10-16). Governing text: §8.3.1 (items 1, 5, 7), §8.3.2, §8.3.3, §8.5; §4.4 (`Modal`, `ConfirmDialog`, `DetailDrawer`) and §4.6 (focus in on open, restore on close). |
| No spec amendment | Owner decision, 2026-10-18 (brainstorm): #193 is an internal hook fix under the existing §8.3. No amendment and no M3 by default. §8.5 already states the guarantee unconditionally ("A submitting `FormDialog` MUST NOT close because of a user-initiated dismissal"), so making it hold however the `submitting` update is scheduled adds no product semantics. If planning or execution finds §8.3 ambiguous or insufficient, or that #193 needs a specified behavior to change, stop and return to M2/M3. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. File names, test names, helper names and task order are planning decisions, not product semantics. |
| Scope | `packages/ui`: `src/internal/use-dialog-behavior.ts` and two new test files. Separately, the authorized workflow update in `ffcf7a6` (six paths, listed in Task 3 Step 2). **No** change to `Modal`, `FormDialog`, `ConfirmDialog`, `DetailDrawer`, the existing `@clensy/ui` tests, any caller in `apps/web` or `packages/web`, `package.json`, `pnpm-lock.yaml`, copy, API, schema or GraphQL. |
| Package names | `pnpm --filter @clensy/ui` is `packages/ui`. `pnpm --filter web` is `apps/web`. |
| Baseline | On `main` at `d5d845e`, at planning time: `pnpm --filter @clensy/ui exec vitest run`, 9 files, 96/96 passed. `pnpm --filter web exec vitest run`, 48 files, 2185/2185 passed. This is a baseline, not pre-validation. Task 1 re-records it after the rebase. |
| Pre-validation | **Partial.** Two throwaway planning probes ran on `main` at `d5d845e` and were deleted, and the tree was restored (`git status` clean). (1) A single test equivalent to Task 2's `refuses an Escape pressed in the commit that starts a submit`, against unmodified code: **failed** at `expect(closes).toBe(0)`, which reproduces the #193 defect. (2) The same test with the hook temporarily changed to the Task 2 Step 3 mechanism: `pnpm --filter @clensy/ui exec vitest run` reported 10 files, 97/97 passed. **Not run:** every other test in this plan, lint (the #196 rules do not exist yet), `tsc`, the `web` suite and Task 3's commands. Every other `Expected:` line is a prediction until M6 records the actual result. |
| Red-phase evidence | Each "verify it fails" step gives the behavioral failure and a **predicted** count. The count is not a pass criterion. At every red phase the implementer records the actual totals and each failing test's name and first failure message in the Execution record. If the result differs from the prediction, stop and find out why before writing the implementation, and record the explanation. |
| M7 | Application code changes. `CLAUDE.md` requires a **fresh independent reviewer** on the most capable model, given the Accepted spec (with Amendment #180), this plan and the branch diff. |
| M10 | **Applies**: the slice changes workflow assets (`ffcf7a6`). The validation report is recorded in this plan under `## Gate outcomes` → `### M10 — Workflow Validation`, after M9 and before closeout. See [M10 validation](#m10-validation-record-location-and-evidence) for its location and required evidence. |
| Workflow version | Planned under generic **1.6.0**, including its characterization-test rule (M4 step 9): each labelled characterization test records the behavior broken, the tests that break covers, and an outside-the-commit run. See [Characterization breaks](#characterization-breaks-task-1). |

**Goal:** The shared Escape handler in `useDialogBehavior` calls the `onClose` from the latest commit, so an Escape that lands in the commit changing `submitting` sees the new dismissal policy: it cannot dismiss a `FormDialog` whose submit has just started, and it is not refused once the submit has ended.

**Architecture:** Today the `document` `keydown` listener is registered in a passive `useEffect` keyed on `[open, onClose]`. A new `onClose` reaches the listener only when that effect re-runs. Until then, an Escape press calls the previous `onClose`. `FormDialog`'s `requestClose` is a new function on every render, so the listener is also removed and re-added on every render. The fix wraps the Escape call in React 19.2's `useEffectEvent` and keys the effect on `[open]` only. React swaps in an effect event's latest function during the commit's before-mutation phase, before any layout or passive effect runs. So the listener reads the current callback from the moment a commit lands, and it is registered once per `open`. `FormDialog`'s `requestClose` guard, the `openDialogStack` topmost check, the backdrop handler and both focus effects are unchanged.

**Tech Stack:** React 19.2.8 (`useEffectEvent`), TypeScript, Vitest 5 with jsdom (per-file `// @vitest-environment jsdom`, as in `packages/ui/src/base/dialogs/*.test.tsx`), `eslint-plugin-react-hooks` 6+ (from #196), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-08-17-dashboard-ux-foundation-design.md` §4.4, §4.6, §8 (Amendment #180).

## Hard prerequisite

- **#196 is merged.** The owner's sequencing (#193 audit comment): adopt `useEffectEvent` only after #196 enables `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps`, so that its usage rules are enforced. Before Task 1: `gh issue view 196 --json state -q .state` prints `CLOSED`, the merge commit is on `origin/main`, and `grep -n "react-hooks/exhaustive-deps" packages/ui/eslint.config.mjs` matches. Then `git fetch && git rebase origin/main` on this branch. If #196 is not merged, stop. Do not install or configure the plugin in this slice.
- If, after #196, `react-hooks/rules-of-hooks` or `react-hooks/exhaustive-deps` flags the Task 2 `useEffectEvent` usage itself, stop and reassess the mechanism with the owner (M5-guard). Do not suppress the rule, change its configuration or widen this issue's scope.
- If #196 lands and its lint run reports a finding in `use-dialog-behavior.ts` that it deferred to a separate issue, stop and ask the owner whether that issue is folded into this slice. Do not fix it silently.

## Global Constraints

- The change is confined to `packages/ui/src/internal/use-dialog-behavior.ts` plus two new test files (spec §8.5: confined to `@clensy/ui`; no caller edit).
- `useDialogBehavior(open: boolean, onClose: () => void)` keeps its signature and return value `{ backdropProps, containerRef }`. No prop contract changes (§8.4).
- Escape is still handled only by the topmost dialog, and a topmost submitting `FormDialog` consumes it (§8.3.2). `openDialogStack` and its push/pop effect are unchanged.
- A refused Escape still calls no `onClose`, changes nothing in the DOM and is not replayed (§8.3.1 item 5, §8.5).
- `ConfirmDialog` and `DetailDrawer` dismissal is unchanged (§8.5), including `ConfirmDialog` still closing while `confirming` (pinned by `confirm-dialog.test.tsx`).
- Focus still moves into the dialog on open and is restored to the trigger on close and on unmount (§4.4, §4.6). The focus-capture/restore effect is not edited.
- Every existing `@clensy/ui` and `web` test passes unedited.
- `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` report nothing for the changed files, with no `eslint-disable` comment.

## Planning decisions for M5 to confirm

- **(a) Mechanism: `useEffectEvent`.** The owner's audit comment names it as the approach to evaluate first, and it holds up. It is exported by React 19.2.8, and react-dom 19.2.8 assigns an effect event's new function in `commitBeforeMutationEffects`, so it is current before any layout effect of the same commit. The alternative in the issue's Scope, a ref updated in a layout effect, fails the strictest form of the timing test (decision c). A layout effect elsewhere in the tree that runs before the hook's own layout effect would still see the stale ref, so its freshness depends on where the dialog sits in the tree. `useEffectEvent` does not have that dependency. Only the Escape call moves into the effect event. The Tab focus trap reads refs and the DOM, not props, so it stays in the listener as it is.
- **(b) Listener lifecycle.** The `keydown` effect is keyed on `[open]` only: one registration when `open` becomes true, one removal when it becomes false or the component unmounts. This follows from (a), and the owner's comment asks for it. Test `registers one keydown listener per open and removes it on close` pins it.
- **(c) How the tests hit the timing window (narrowed, M5-1).** A test-only probe component calls `useLayoutEffect` and presses Escape when its `fire` prop turns true, so the press lands after that commit's DOM changes and before its passive effects. That is the window #193 describes. The probe is rendered **before** the dialog in the tree, so its layout effect also runs before any layout effect inside the dialog, which keeps the test independent of where the mechanism sits in the tree. Pre-validation probe (1) shows the pattern reproduces the defect on `main`.
  **What the tests establish:** an Escape dispatched during the commit that changes `submitting` (or `onClose`) observes the new dismissal policy, for the commits those tests produce. They run updates through `act`, plus one variant whose update is scheduled with `startTransition`. They do **not** exercise every scheduling mode, and this plan does not claim they do. No timer-scheduled variant is added. The general claim, that the fix holds however the update is scheduled (#193 criterion 1), rests on the mechanism in (a): React assigns an effect event's new function during every commit, before that commit's layout and passive effects, whatever lane produced it. That is a design argument for M7 to check, not a test result.
- **(d) Coverage in `@clensy/ui` only.** The issue requires `@clensy/ui` regression tests for the timing case and stacked dialogs. No new `web` test. `apps/web/lib/use-detail-drawer.test.tsx` (including `goes Back once for a double Escape…`) and the laundry interaction suites already exercise the hook through real callers, and Task 3 runs them unedited.
- **(e) `DetailDrawer` characterization tests.** Unlike #180, this slice edits the hook `DetailDrawer` uses, and `@clensy/ui` has no `DetailDrawer` test today. A new `detail-drawer.test.tsx` pins its Escape, backdrop and × dismissal and its stacking under a `ConfirmDialog` before the hook changes (§8.5, issue criterion 4). These are characterization tests. `ConfirmDialog` is already pinned by `confirm-dialog.test.tsx`, which stays unedited.
- **(f) Focus and Strict Mode characterization tests.** The owner's comment asks that focus capture on open, focus restoration on close or unmount, and correct behavior under Strict Mode's mount, unmount, remount sequence be preserved. Task 1 pins each one before the change.
- **(g) Docs.** No README or docs change in M6. `packages/ui/README.md` does not describe the hook. M9 decides.

## Review Focus

- **The submit ending, not starting:** an Escape in the commit that sets `submitting` back to false must close the dialog. A stale guard that still refuses it is the mirror image of #193 (§8.3.3, "no leftover blocked state"). Owned by Task 2 `closes on an Escape pressed in the commit that ends a submit`.
- **A dialog reopened after closing:** reopening must register exactly one new listener, and an Escape after close must call nothing. Owned by Task 2 `registers one keydown listener per open and removes it on close`.
- **Unmount while open (the `DetailDrawer` `?detail=` pattern):** the listener must be removed and focus restored, and a later Escape must call nothing. Owned by Task 1 `restores focus to the trigger and stops handling Escape when the dialog unmounts while open`.
- **Strict Mode's double mount:** this must not leave two active listeners (Escape would call `onClose` twice), a listener after close, or a stale topmost entry for a closed dialog (the dialog beneath would never become topmost; C4 checks this for the closed `FormDialog` only, not for duplicate entries of the dialog that stays open). Owned by Task 1 `closes once per Escape under Strict Mode, cleans up on close and restores focus`, Task 1 `keeps topmost-only Escape under Strict Mode, and closes the dialog beneath next`, and Task 2 `refuses the start-of-submit Escape under Strict Mode too`.
- **A caller-supplied `onClose` that changes identity without any submit** (an inline arrow, as most callers pass): Escape must call the newest one. Owned by Task 2 `calls the onClose from the commit the Escape lands in, not an earlier one`.

---

### Task 1: Characterization tests for the hook's current guarantees (type: `code`)

Implements nothing new. Pins spec §4.4, §4.6, §8.3.2 and §8.5 before Task 2 edits the hook. Planning decisions (e), (f). Every test here is a **characterization test [C]** and is expected to pass on unmodified code. A test that fails before Task 2 means the fixture is wrong, or the shipped behavior differs from what this plan assumed: stop and record it.

**Files:**
- Create: `packages/ui/src/base/detail-drawer.test.tsx`
- Create: `packages/ui/src/internal/use-dialog-behavior.test.tsx` (the `describe` block below; Task 2 adds a second block)

**Interfaces:**
- Consumes: `Modal`, `FormDialog`, `ConfirmDialog`, `DetailDrawer` as exported today; `StrictMode`, `act` from `react`; `createRoot` from `react-dom/client`.
- Produces, in `use-dialog-behavior.test.tsx`, test-local helpers that Task 2 reuses: `mount(ui: ReactNode): void` (renders into a fresh root inside `act`, tracked for `afterEach` unmount), `rerender(ui: ReactNode): void`, `pressEscape(): void` (dispatches a bubbling, cancelable `keydown` `Escape` on `document.activeElement ?? document` inside `act`), `dialogTitled(title: string): HTMLElement | null`.

- [ ] **Step 0: Confirm the hard prerequisite and re-record the baseline**

Run the four checks in [Hard prerequisite](#hard-prerequisite), rebase, then:
Run: `pnpm --filter @clensy/ui exec vitest run && pnpm --filter @clensy/ui lint`
Expected: 9 files, 96/96 passed (or the post-#196 count, recorded as the new baseline); lint passes. Record both.

- [ ] **Step 1: Write the `DetailDrawer` characterization tests**

File header: `// @vitest-environment jsdom`, `IS_REACT_ACT_ENVIRONMENT = true`, and a comment that these pin §8.5 for #193 and are [C]. A fixture renders a Trigger button and `<DetailDrawer open={state.drawer} onClose={…} title="Details">` with one button inside, and optionally `<ConfirmDialog open={state.confirm} … title="Delete" confirmLabel="Delete">` after it. Each `onClose` pushes its name to `closes` and sets its state to false.

`describe('DetailDrawer dismissal (#193) [C]')`:
- `closes on Escape`: open drawer, `pressEscape()` → `closes` equals `['drawer']`, drawer gone.
- `closes on a backdrop click`: click the dialog's `parentElement` → `['drawer']`.
- `closes on ×`: click the button labelled `Close` → `['drawer']`.
- `does not close on a click inside the panel`: click the inner button → `closes` equals `[]`, drawer present.
- `closes only a ConfirmDialog opened on top of it, then itself on the next Escape`: drawer open, then confirm open (not `confirming`) → Escape → `['confirm']`, drawer present → Escape → `['confirm', 'drawer']`.

- [ ] **Step 2: Write the focus and Strict Mode characterization tests**

In `use-dialog-behavior.test.tsx`, `describe('useDialogBehavior focus and Strict Mode (#193) [C]')`. These tests check the §4.4/§4.6 contract only through the DOM: which element is `document.activeElement`, which dialogs are present and which `onClose` spies were called. They do not read the hook's refs or the dialog stack (M5-2).

Shared fixture rules: every tree renders a real `<button type="button">Trigger</button>` in the same root as the dialog, **before** it. Each test first mounts the tree with the dialog closed or absent, focuses Trigger with `act(() => trigger.focus())` and asserts `document.activeElement` is Trigger. Only then does it open the dialog, by a `rerender`. Every open, close and unmount is a `rerender` inside `act`, so its effects have flushed before the next assertion. **Close** means rerendering the same mounted dialog with `open={false}`. **Unmount** means rerendering the tree without the dialog element.

- `moves focus into the dialog on open and restores it to the trigger on close`: a `Modal` (title `Focus`) containing `<button type="button">First</button>`. Open → focus has moved into the dialog: `document.activeElement` is the `Focus` dialog element or one of its descendants, and is not Trigger. Close → active element is Trigger. The open assertion does not name First (revision 6). jsdom has no layout, so every element's `offsetParent` is `null`, and the hook's `getFocusableElements` treats such elements as hidden and finds nothing focusable. The hook then takes its documented fallback and focuses the dialog container. In a browser, First would receive focus. This test pins what jsdom can observe, and does not assert which branch ran.
- `restores focus to the trigger and stops handling Escape when the dialog unmounts while open`: a `DetailDrawer` (title `Details`, `onClose` = `spy`) that appears in the tree already `open`, the `?detail=` pattern. Before the rerender that adds it, install the same calling-through `addEventListener`/`removeEventListener` spies as the Strict Mode test, keeping the set of active `'keydown'` handlers, and record the set's size as `before`. After the rerender that adds the drawer, the active element is inside the drawer and the set's size is `before + 1`. Unmount → the set's size is back to `before`, the active element is Trigger, and `dialogTitled('Details')` is null. Then `pressEscape()` → `spy` not called. Every assertion after the drawer mounts uses `expect.soft`, so a break run reports **each** failed assertion, not only the first (needed to tell B8 from B9). Restore the spies in a `finally` (or `afterEach`), so a failing assertion does not leak them into later tests (M5-7). The size check is what proves cleanup: the Escape check alone would pass with a leaked listener, because the unmounted drawer is no longer topmost.
- `closes once per Escape under Strict Mode, cleans up on close and restores focus`: the first test's tree inside `<StrictMode>`. The `Modal`'s `onClose` is a `vi.fn()` that closes it. Spies on `document.addEventListener` and `removeEventListener` (calling through) keep a set of the **currently active** `'keydown'` handlers: add on add, delete on remove. The test asserts the active set, never the number of add or remove calls, because Strict Mode's extra development setup and cleanup are not the product contract (M5-3, M5-4). While open: active set size 1; one Escape → `onClose` called exactly once and the dialog is gone; active set size 0; active element is Trigger. Then one more `pressEscape()` → `onClose` still called once. Reopen: active set size 1; one Escape → `onClose` called twice in total. Every assertion after the first open uses `expect.soft`, for the same reason as the unmount test. Restore the spies in a `finally` (or `afterEach`).
- `keeps topmost-only Escape under Strict Mode, and closes the dialog beneath next`: in `<StrictMode>`, open a `Modal` titled `Under`, then a `FormDialog` (title `Edit`) with `submitting` true on top. Escape → neither `onClose` is called, and `dialogTitled('Edit')` and `dialogTitled('Under')` are both present (M5-5). Set `submitting` false, then Escape → only the `FormDialog`'s `onClose` is called, `Edit` is gone and `Under` is still present. Then one more Escape → `Under`'s `onClose` is called once and `Under` is gone (M5-9). This last step checks that Strict Mode's simulated cleanup left no stale topmost entry for the closed `FormDialog`: a leftover entry for `Edit` would still be topmost and would keep `Under` from closing. The test does not inspect the private stack or independently prove that `Under` has no duplicate entries.

#### Characterization breaks (Task 1)

Each row is one behavior deliberately broken in the code under test. Every test listed in the row must fail **because of that break** (its failure message shows the broken behavior, not a fixture or import error). The edit that produces the break is M6's choice; this plan names only the behavior. Each run is made outside the committed change (Step 4) and nothing from it is committed. A test may sit in more than one row.

Short names used below: **D1** `closes on Escape`, **D2** `closes on a backdrop click`, **D3** `closes on ×`, **D4** `does not close on a click inside the panel`, **D5** `closes only a ConfirmDialog opened on top of it, then itself on the next Escape`, **C1** `moves focus into the dialog on open and restores it to the trigger on close`, **C2** `restores focus to the trigger and stops handling Escape when the dialog unmounts while open`, **C3** `closes once per Escape under Strict Mode, cleans up on close and restores focus`, **C4** `keeps topmost-only Escape under Strict Mode, and closes the dialog beneath next`.

| Break | Behavior deliberately broken | Assigned test → the assertion that must fail because of it |
| --- | --- | --- |
| B1 | Escape never closes any dialog. | D1 → `closes` is `['drawer']` (gets `[]`). D5 → first Escape gives `['confirm']` (gets `[]`). |
| B2 | One Escape press closes every open dialog, not only the topmost. | D5 → first Escape gives `['confirm']` (the drawer closes too). C4 → first Escape calls neither `onClose` (`Under`'s is called). |
| B3 | A click on the backdrop does not close the dialog. | D2 → `closes` is `['drawer']` (gets `[]`). |
| B4 | A click anywhere inside the overlay, including inside the panel, closes the dialog as a backdrop click would. | D4 → `closes` is `[]` (gets `['drawer']`). |
| B5 | The `DetailDrawer` × button does not close the drawer. | D3 → `closes` is `['drawer']` (gets `[]`). |
| B6 | Focus does not move into the dialog when it opens. | C1 → after open, the active element is the dialog or inside it (it stays on Trigger). |
| B7 | Focus is not restored to the trigger when the dialog closes or unmounts. | C1 → active element is Trigger after close. C2 → active element is Trigger after unmount. C3 → active element is Trigger after the first Escape. |
| B8 | Cleanup leaves **both** the dialog's `keydown` listener and its topmost-order entry in place, so a cleaned-up dialog still answers Escape. | C2 → after unmount, `pressEscape()` calls `spy` (and the active set does not return to `before`). C3 → one Escape calls `onClose` twice. |
| B9 | Cleanup leaves the `keydown` listener registered but removes the dialog's topmost-order entry normally, so the leaked listener never acts. | C2 → after unmount the active set's size is not back to `before`, **while `spy` is still not called**. C3 → the active set has size 2 while open. |
| B10 | Cleanup removes the `keydown` listener normally but leaves the dialog's topmost-order entry in place (so after Strict Mode's simulated cleanup, a dialog has two entries). | C4 → the final Escape does not close `Under`. D5 → the second Escape does not close the drawer (`closes` stays `['confirm']`). |

**Telling B8, B9 and B10 apart (M5-10).** The three rows break the same cleanup in different ways, and a row is evidence only if its run shows **its** failure:

- **C2 is the test that tells B8 and B9 apart.** Under B8 the run must show the `spy` assertion failing. Under B9 it must show the size assertion failing **and** the `spy` assertion passing. A B9 run in which `spy` is called is not B9 (the edit also kept the topmost entry), so the row is **unsuccessful**. A B8 run in which `spy` is not called is also unsuccessful. `expect.soft` makes both assertions visible in one run.
- **C3 cannot tell B8 from B9, and this plan does not claim it can.** The dialog keeps the same identity through Strict Mode's simulated unmount and remount. So under either break, the leaked first listener still finds the dialog topmost, and `onClose` runs twice. Each row records C3's actual output, and must show its own assigned assertion failing (B8: the call count; B9: the active-set size).
- **B10 changes no listener.** Its run must show C3 passing, and C4 and D5 failing at the steps named above. A B10 run in which C3 fails means the edit also touched the listener, so the row is unsuccessful.

All nine Task 1 tests appear in at least one row. B1–B10 assign D1–D5 and C1–C4, and no other test.

- [ ] **Step 3: Run them on unmodified code**

Run: `pnpm --filter @clensy/ui exec vitest run src/base/detail-drawer.test.tsx src/internal/use-dialog-behavior.test.tsx`
Expected: 2 files, 9/9 passed. Any failure → stop (see the Task 1 preamble).

Then reconcile the names (M5-11). Run the same command with `--reporter=verbose` and copy the nine reported test names into the Execution record. They must match the nine short names D1–D5 and C1–C4 in [Characterization breaks](#characterization-breaks-task-1) exactly, one to one: same text, and no extra, missing or renamed test. Every name must also appear in at least one B1–B10 row. If anything differs, fix the test name, or stop and return the plan to M4/M5 if the difference is in coverage, not spelling. Resolve it before Step 4. Task 2 does not start with an unreconciled name.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/base/detail-drawer.test.tsx packages/ui/src/internal/use-dialog-behavior.test.tsx
git commit -m "test(193): pin dialog dismissal, focus and Strict Mode behavior"
```

- [ ] **Step 5: Record the characterization evidence outside the commit**

For each of B1–B10 in turn: create a disposable worktree at the Step 4 commit, outside the repository (`git worktree add --detach "$(mktemp -d)" HEAD`, then `pnpm install --frozen-lockfile --offline` in it). Make an edit to the code under test that produces that row's behavior, and run `pnpm --filter @clensy/ui exec vitest run src/base/detail-drawer.test.tsx src/internal/use-dialog-behavior.test.tsx` there. Record, per row: the edit made (a one-line description), and for each assigned test its result and every failed assertion with its message (from `expect.soft`, where used), followed by the totals. Each row is then judged against its named assertion and, for B8–B10, the distinguishing conditions above. Then remove the worktree (`git worktree remove --force` it, then `git worktree prune`), even when the run fails. Confirm `git status --short` in the main checkout is empty after each row. Nothing from these runs is committed. The results go in the Execution record (Task 3 Step 3).

A row is evidence only when **every** test assigned to it fails because of that break. If any assigned test passes, or fails for another reason, record that row as **unsuccessful** with the planned behavior, each assigned test and what the run showed. Do not invent a different break and continue. Stop and return the plan to M4/M5 for a replacement break (M6 step 3.6). Task 2 does not start until every row is evidence.

#### Test inventory (predicted totals reconciled)

| Group | Tests | Count |
| --- | --- | --- |
| Task 1, `detail-drawer.test.tsx` | D1–D5 | 5 |
| Task 1, `use-dialog-behavior.test.tsx`, first `describe` | C1–C4 | 4 |
| Task 2, `use-dialog-behavior.test.tsx`, second `describe` | the seven tests in Task 2 Step 1 | 7 |
| New in this slice | | **16** |
| `@clensy/ui` baseline at `d5d845e` | existing, unedited | 96 |
| `@clensy/ui` after Task 2 | | **112**, in 11 files (9 + 2) |

Task 1 Step 3 predicts 9 passed. Task 2 Step 2 predicts 11 in the file: 7 failing, 4 passing. Task 2 Step 4 and Task 3 Step 1 predict 112. If Step 0's post-#196 baseline differs from 96, every total shifts by the same amount. Record the shift, not a new prediction.

### Task 2: Escape always calls the latest `onClose` (type: `code`)

Implements spec §8.3.1 items 1 and 5, §8.3.2, §8.3.3 and §8.5 for an Escape that lands in the commit changing `submitting` (#193 acceptance criteria 1–3, with criterion 1's scope as narrowed in decision (c)). Planning decisions (a)–(c).

**Files:**
- Modify: `packages/ui/src/internal/use-dialog-behavior.ts` (import line 2; the `keydown` effect, lines 76–130; comments that describe it)
- Test: `packages/ui/src/internal/use-dialog-behavior.test.tsx` (second `describe` block)

**Interfaces:**
- Consumes: Task 1's `mount`, `rerender`, `pressEscape`, `dialogTitled`; `startTransition` and `useLayoutEffect` from `react`.
- Produces: no new export. `useDialogBehavior`'s signature and return value are unchanged.

- [ ] **Step 1: Write the failing tests**

Add a test-local probe. Its body is fixed by decision (c) and is not determined by the tests alone:

```tsx
// Presses Escape from a layout effect: after the DOM commit that turns
// `fire` true, before that commit's passive effects. Rendered before the
// dialog, so it also runs before any layout effect inside the dialog.
function EscapeInCommit({ fire }: { fire: boolean }) {
  useLayoutEffect(() => {
    if (!fire) return;
    (document.activeElement ?? document).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
  }, [fire]);
  return null;
}
```

In every test below, `<EscapeInCommit fire={…} />` is the first child of the rendered tree, and `fire` changes in the same `rerender` as the prop under test.

`describe('Escape uses the latest close callback (#193)')`. Wherever Escape must be refused, the test asserts the refused dialog is still present and, when stacked, that the dialog underneath is still present. Callback counts alone are not enough (M5-5).
- `calls the onClose from the commit the Escape lands in, not an earlier one`: mount `<Modal open onClose={a} title="Plain">`; rerender with `onClose={b}` and `fire` true → `b` called once, `a` not called.
- `refuses an Escape pressed in the commit that starts a submit`: mount an open `FormDialog` (title `Edit`, `submitting` false) whose `onClose` increments `closes`; rerender with `submitting` true and `fire` true → `closes` is 0 and `dialogTitled('Edit')` is present.
- `refuses an Escape pressed in the commit that starts a submit scheduled as a transition`: as the previous test, but the rerender runs inside `act(() => startTransition(() => root.render(…)))` → `closes` is 0 and `Edit` is present.
- `closes on an Escape pressed in the commit that ends a submit`: mount with `submitting` true; rerender with `submitting` false and `fire` true → `closes` is 1 and `Edit` is gone.
- `refuses an Escape in the commit that starts a submit when the FormDialog is stacked on top`: open `Modal` `Under`, then an idle `FormDialog` `Edit` on top; rerender with `submitting` true and `fire` true → neither `onClose` is called; `Edit` and `Under` are both present.
- `refuses the start-of-submit Escape under Strict Mode too`: the second test with the tree in `<StrictMode>` → `closes` is 0 and `Edit` is present.
- `registers one keydown listener per open and removes it on close`: **not** under Strict Mode. Its exact call counts describe a normal (non–Strict Mode) render only; Strict Mode's lifecycle is covered by the active-set assertions in Task 1 (M5-3). `vi.spyOn(document, 'addEventListener')` and `removeEventListener`, counting only `'keydown'` calls. Mount an open `Modal`, then rerender it three times, each with a new inline `onClose` → 1 add, 0 removes. Set `open` false → 1 remove, of the same handler that was added; `pressEscape()` → no `onClose` called. Set `open` true again → 2 adds in total. Restore the spies.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @clensy/ui exec vitest run src/internal/use-dialog-behavior.test.tsx`
Expected (predicted): 7 failed, 4 passed (Task 1's). The first six fail because the stale `onClose` runs: `a` called instead of `b`; `closes` 1 instead of 0 (`act` and transition variants); 0 instead of 1; the `FormDialog` closes; 1 instead of 0. The listener test fails on its add count: 4 instead of 1. The transition variant's failure is the least certain prediction: if it passes on `main`, stop and record why before Step 3. Record actual names and first messages.

- [ ] **Step 3: Call the latest `onClose` through an effect event in `use-dialog-behavior.ts`**

Import `useEffectEvent` from `react`. In `useDialogBehavior`, before the `keydown` effect, declare `const closeOnEscape = useEffectEvent(() => onClose());`. In `handleKeyDown`, the topmost branch calls `closeOnEscape()` instead of `onClose()`. Change the effect's dependency array from `[open, onClose]` to `[open]`. Update the comments to match the surrounding style: one comment at the effect event saying why (#193: the listener lives for one `open`, the effect event gives it the `onClose` of the latest commit, before any effect of that commit runs, so the `FormDialog` guard is never stale), and fix the module-stack comment that says "see the dedicated effect below" only if its meaning changes. Do not touch the stack effect, the focus effect, the Tab branch, `backdropProps` (a render-time handler, already current) or `getFocusableElements`.

- [ ] **Step 4: Run the tests and lint**

Run: `pnpm --filter @clensy/ui exec vitest run && pnpm --filter @clensy/ui lint && pnpm --filter @clensy/ui build`
Expected: 11 files, 112/112 passed (96 + 9 + 7, on the `d5d845e` baseline; adjust by Step 0's recorded baseline); lint passes with no `react-hooks/*` finding and no `eslint-disable`; `build` passes. `@clensy/ui`'s `build` script is `tsc --noEmit` (`packages/ui/package.json`), so this command is the package's type check. Record it as `pnpm --filter @clensy/ui build` (`tsc --noEmit`) with its actual exit status. If the script has changed by M6, record what it ran instead, and do not report a type check that did not run (M5-6). A `react-hooks/*` finding on the `useEffectEvent` usage → stop (Hard prerequisite, M5-guard).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/internal/use-dialog-behavior.ts packages/ui/src/internal/use-dialog-behavior.test.tsx
git commit -m "fix(193): call the latest onClose from the dialog Escape handler"
```

### Task 3: Full verification and execution record (type: `docs/process`)

TDD does not apply. The verification below and the Execution record replace it.

**Files:**
- Modify: this plan (append `## Execution record`)

- [ ] **Step 1: Run the CI-equivalent checks**

Run: `pnpm install --frozen-lockfile && pnpm run lint && pnpm --filter web exec tsc --noEmit && pnpm run test`
Expected: all succeed. `@clensy/ui` 112/112. `web` 48 files, 2185/2185, unchanged from the baseline (or Step 0's recorded post-#196 count). Record each command's actual result and every package's test totals.

- [ ] **Step 2: Account for every changed path**

Run: `git diff --name-only <rebased-base> HEAD | sort`, where `<rebased-base>` is `git merge-base HEAD origin/main` after the Task 1 Step 0 rebase.
Expected: exactly the ten paths below, in two groups, with none missing and no others. Record the full output and each path's group. Any other path, or a missing one, means stop and investigate.

- **#193 implementation and plan**, exactly: `docs/superpowers/plans/2026-10-18-dialog-escape-latest-close-plan.md`, `packages/ui/src/base/detail-drawer.test.tsx`, `packages/ui/src/internal/use-dialog-behavior.test.tsx`, `packages/ui/src/internal/use-dialog-behavior.ts`.
- **Authorized workflow update** (owner request, `ffcf7a6`, or its rebased equivalent), exactly: `docs/workflows/README.md`, `docs/workflows/prompts/code-review.md`, `docs/workflows/prompts/implementation-execution.md`, `docs/workflows/prompts/implementation-planning.md`, `docs/workflows/prompts/plan-review.md`, `workflow.yaml`. `git log --format='%h %s' <rebased-base>..HEAD -- docs/workflows workflow.yaml` prints only that one commit.
 Then `git diff --quiet <rebased-base> HEAD -- packages/ui/src/base packages/ui/package.json pnpm-lock.yaml apps packages/web ':!packages/ui/src/base/detail-drawer.test.tsx'` exits 0. Record the full output.

- [ ] **Step 3: Write the Execution record and the M6 Slice Completion Report, then commit**

Append `## Execution record` with each task's red and green results as actual output, Task 1 Step 5's B1–B10 rows (edit, per-test result, evidence or unsuccessful), and the Step 1 and Step 2 results. Then emit the M6 Slice Completion Report per `docs/workflows/conventions/reporting-conventions.md`, with Next Gate M7 (a fresh independent reviewer). The Execution record holds M6 evidence only. It is not the M10 report, and passing M6 tests do not validate the workflow update ([M10 validation](#m10-validation-record-location-and-evidence)).

```bash
git add docs/superpowers/plans/2026-10-18-dialog-escape-latest-close-plan.md
git commit -m "docs(193): record M6 execution"
```

## M10 validation: record location and evidence

M10 is not an M6 task. It runs after M9 and before closeout (process spec §2.6, §2.12), and it is listed here so its record cannot be confused with M6's (M5-8).

- **Location.** The plan gets one `## Gate outcomes` section, appended after the M5 decision, with one subsection per gate as each happens (`### M5`, `### M6`, … `### M10 — Workflow Validation`). That is the default home the M10 prompt names. The M10 report is recorded **only** there, not in the Execution record. The Execution record (Task 3) holds M6 evidence. The M10 subsection may cite it, but cannot be replaced by it.
- **Form.** The M10 prompt's outcome template (`Decision`, `Subject`, `Governing specification`, `Asset inventory`, `Blocking findings`, `Non-blocking observations`, `Gate`), with `Subject: workflow prompt library (as updated in ffcf7a6, generic 1.6.0)`. Then the M10 Slice Completion Report row.
- **Required evidence**, each recorded as the command run and its actual output:
  1. **Installed files match the manifest:** `awk '/- path:/{p=$3} /digest:/{print substr($2,8)"  "p}' workflow.yaml | sha256sum -c` reports `OK` for every asset (27 at planning time, all OK on `8c9b613`'s tree), and `grep -c 'version: 1.6.0' workflow.yaml` matches the number of `generic` assets.
  2. **Only the update commit touched them:** Task 3 Step 2's workflow-update group, with `git log` showing a single commit.
  3. **The M10 checklist** in `docs/workflows/prompts/workflow-validation.md`, each row marked pass or fail with the reason. At minimum, for the 1.6.0 delta: the characterization-test rule reads consistently across the M4 prompt (step 9 and its self-check), M5 (step 6 and its checklist), M6 (step 3.6 and its checklist) and M7 (step 7); and the `README.md` layout lists every file under `conventions/`.
  4. **Executability observation:** whether this slice could follow the 1.6.0 characterization rule without inventing instructions, citing Task 1 Step 5's B1–B10 results in the Execution record as the worked case.
- **Decision rule.** M10 is **Accepted** only with no blocking finding. A failing digest, an unexplained extra commit on the workflow paths, or a failing checklist row is blocking. M6, M7 and test results never stand in for any item above.
- The implementer may perform M10. It is not an independent review, and the M10 prompt does not require one.

## Traceability

| Requirement | Task |
| --- | --- |
| #193 criterion 1; §8.3.1 item 1, §8.5 (submitting `FormDialog` never closes on Escape) | Task 2 `refuses an Escape pressed in the commit that starts a submit`, `…scheduled as a transition`, `…under Strict Mode too`; Step 3. Scheduling modes beyond those tested rest on decision (a) (decision (c)) |
| §8.3.3 (no leftover blocked state once submitting is false) | Task 2 `closes on an Escape pressed in the commit that ends a submit` |
| #193 criterion 2; §8.3.2 (topmost-only, stacked, submitting on top) | Task 1 `keeps topmost-only Escape under Strict Mode, and closes the dialog beneath next`, `closes only a ConfirmDialog opened on top of it…`; Task 2 `…stacked on top`; existing `form-dialog.test.tsx` stacking tests, unedited |
| #193 criterion 3 (regression tests in `@clensy/ui` for timing and stacking) | Task 2 Step 1 |
| #193 criterion 4; §8.5 (`ConfirmDialog`, `DetailDrawer` unchanged) | Task 1 `detail-drawer.test.tsx`; existing `confirm-dialog.test.tsx`, unedited; Task 3 Step 2 |
| §4.4, §4.6 (focus in on open, restored on close and unmount); owner comment (Strict Mode) | Task 1 Step 2 |
| §8.3.1 item 5 (no `onClose` call, no replay) | Existing `form-dialog.test.tsx` (`does not replay a refused Escape…`, `changes nothing visible…`), unedited; Task 3 Step 1 |
| Owner comment (listener registered once per `open`) | Task 2 `registers one keydown listener per open and removes it on close` |
| Owner sequencing (#196 first) | Hard prerequisite; Task 1 Step 0; Task 2 Step 4 lint |
| Workflow 1.6.0 characterization rule (M4 step 9, M6 step 3.6) | [Characterization breaks](#characterization-breaks-task-1); Task 1 Step 5 |
| Workflow update validated (process spec §2.10, §2.12 M10) | [M10 validation](#m10-validation-record-location-and-evidence) |

## Deferred (not in this plan)

- The AppSidebar `useEffectEvent` follow-up named in #196. It is a separate issue.
- `ConfirmDialog` refusing dismissal while `confirming` (spec §8.7). It needs a separate issue if it is wanted.
- Any docs change. M9 decides.

## Revision 2 (M5 review 1)

M5 first pass (owner, 2026-10-18, reviewed `8c9b613`): **Request changes**. Each finding and how this revision resolves it:

| Finding | Resolution |
| --- | --- |
| M5-1 (P1) The probe does not prove every scheduling mode | Decision (c) and the Goal are narrowed to what the tests establish: an Escape in the commit that changes `submitting` sees the new policy. Added one `startTransition` variant; no timer variant. The wider claim is stated as a design argument resting on decision (a), for M7 to check. Task 2 preamble and Traceability updated. |
| M5-2 (P1) Focus tests need a reliable trigger and restoration contract | Task 1 Step 2 now has shared fixture rules: a real Trigger in the same root, focused and asserted before the dialog opens; every open, close and unmount flushed by an `act` rerender; close and unmount defined separately. Assertions use the DOM only. The unmount test asserts restoration to Trigger, that the drawer is gone, and that a later Escape does not call its `onClose`. |
| M5-3 (P1) Listener counts could pin Strict Mode's development lifecycle | The exact-count test is explicitly non–Strict Mode. Strict Mode is checked through the set of active `keydown` handlers, never through call counts. |
| M5-4 (P2) Strict Mode does not cover the listener lifecycle | Task 1's Strict Mode test now asserts one active listener while open, one `onClose` per Escape, no active listener and no call after close, and one active listener again after reopening. It is renamed `closes once per Escape under Strict Mode, cleans up on close and restores focus`. Its characterization breaks (B7, B8) still cover it. |
| M5-5 (P2) Refusal tests should assert the dialogs stay open | Every Task 1 and Task 2 test where Escape is refused now asserts the refused dialog, and any dialog underneath, by title. |
| M5-6 (P2) The type check is not clearly identified | Task 2 Step 4 names `@clensy/ui build` as `tsc --noEmit` from `packages/ui/package.json` and records it under that name. It must not report a type check that did not run. |
| Guard: hooks lint flags `useEffectEvent` | Added to Hard prerequisite and Task 2 Step 4: stop and reassess with the owner; no suppression, no rule change, no scope growth. |

Counts change: Task 2 has 7 tests (was 6); predicted red is 7 failed, 4 passed; the `@clensy/ui` total is 112 (was 111). Task 1 is still 9 tests, and the B1–B8 rows are unchanged apart from the renamed test.

## Revision 3 (M5 review 2)

M5 second pass (owner, 2026-10-18, reviewed `e9bfc3e`): **Request changes**. The six Revision 2 findings are recorded as addressed. The owner asked to keep the mechanism and the narrowed test claims.

| Finding | Resolution |
| --- | --- |
| M5-7 (P1) The unmount test does not prove the listener was removed | The unmount test now tracks the active `keydown` handlers. It records their count before the drawer mounts, asserts one more while it is open and the original count after unmount, then asserts Escape does not call the removed drawer's `onClose`. Spies are restored in `finally`/`afterEach`. New break **B9** ("the listener stays registered after cleanup, while the dialog still leaves the topmost order") is assigned to this test and to the Strict Mode lifecycle test, so the cleanup assertion itself has characterization evidence. |
| M5-8 (P2) Where the M10 report and its evidence go is unclear | New section [M10 validation](#m10-validation-record-location-and-evidence): the record lives only in `## Gate outcomes` → `### M10 — Workflow Validation`, not in the Execution record. It names the template, four required evidence items (manifest digests, single update commit, the M10 checklist with the 1.6.0 cross-prompt consistency check, the executability observation) and the decision rule. Task 3 Step 3 states that the Execution record is M6 evidence only. |

Counts: Task 1 is still 9 tests. Its breaks are now B1–B9. Task 2 and the totals (112) are unchanged.

## Revision 4 (M5 review 3)

M5 third pass (owner, 2026-10-18, reviewed `6fe0f29`): **Request changes**. Resolutions:

| Finding | Resolution |
| --- | --- |
| M5-9 (P1) Strict Mode does not establish that no duplicate stack entry is left | C4 gains a final step: after the top `FormDialog` closes, one more Escape must close `Under`. A leftover entry from Strict Mode's simulated cleanup would stay topmost and block it. This is observable through the DOM and `onClose` only, not the private stack. C4 is renamed `keeps topmost-only Escape under Strict Mode, and closes the dialog beneath next`. New break **B10** (the topmost entry stays after cleanup; the listener is removed normally) is assigned to C4 and D5. |
| M5-10 (P1) B8 and B9 are not distinguished | B8, B9 and B10 are now defined as three separate cleanup defects: both kept, listener only, entry only. Each assigned test names the exact assertion that must fail. C2 is the test that tells B8 from B9 (B8: `spy` called; B9: size not restored **and** `spy` not called). The plan states that C3 cannot tell them apart and why. A run that shows another row's signature is **unsuccessful**. C2 and C3 use `expect.soft` after setup, so one run shows every failed assertion. The evidence rule is not weakened. |
| M5-11 (P2) Test names and break assignments need reconciling | Short names D1–D5 and C1–C4 are now defined once. Task 1 Step 3 adds a reconciliation: the verbose reporter's nine names must match them one to one and appear in a B row, before Step 4. A new Test inventory reconciles every predicted total (9, 7 failing and 4 passing, 16 new, 112). |
| Non-blocking observations | Kept as written: the narrowed effect-event rationale (M7 to verify), the submit-ending regression test, the #196 gate and lint-reject stop, separate M10 evidence, and post-rebase actual results replacing the historical baseline (Task 1 Step 0). |

## Revision 5 (M5 review 4)

M5 fourth pass (owner, 2026-10-18, reviewed the Revision 4 text as quoted from `fb5f8ed`): **Request changes**, one narrow clarification. M5-9, M5-10 and M5-11 are recorded as addressed.

| Finding | Resolution |
| --- | --- |
| M5-12 C4's explanation claims more than the test proves | C4's last sentence claimed that no duplicate entry was left "for either dialog". The final Escape proves only that no stale `Edit` entry blocks `Under`. A duplicate `Under` entry would still let `Under` close. The sentence is replaced with the owner's wording: it checks for a stale topmost entry for the closed `FormDialog`, and it states that the test neither inspects the private stack nor proves that `Under` has no duplicate entries. The same narrowing is applied to the Strict Mode line in Review Focus, which cited C4 for "a duplicate stack entry" without saying whose. No test, break assignment or count changes. B10's assigned failure signature is unaffected. |

## Gate outcomes

### M5 — Plan Review: Accepted (2026-10-18)

Five passes by the owner. Passes 1–4 returned the plan (M5-1 to M5-12, and one execution guard), and pass 5 accepted revision 5 (`11e0d37`), reviewing the complete committed file. Accepted findings, rechecked on that pass: M5-9 (C4 and D5 check the stale entry through public behavior), M5-10 (B8, B9 and B10 have separate definitions, signatures and rejection rules), M5-11 (a fixed D1–D5/C1–C4 inventory with verbose-reporter reconciliation), and M5-12 (the narrowed duplicate-entry claim, in both places). The safeguards are kept: the #196 prerequisite, the scoped timing claim with the mechanism argument left for M7, the hook-and-tests scope, and separate M10 evidence.

The acceptance does not claim that any characterization break has run or that the implementation is verified.

## Slice Completion Report

| Field | Result |
| --- | --- |
| Slice | #193 Dialog Escape latest-close |
| Tracking | https://github.com/rexescario-dev/clensy-platform/issues/193 |
| M4 | Plan **Accepted** (revision 5) |
| M5 | Review **Accepted** |
| M6 | Blocked — hard prerequisite #196 not merged |
| M7 | Pending |
| M8 | Pending |
| M9 | Pending |
| Branch | `feat/193-dialog-escape-latest-close` (local, not pushed) |
| PR | None yet |
| Status | **Blocked on #196**, then Ready for M6 |

### Shipped

- The accepted implementation plan for #193 (no implementation yet).
- The Context Forge workflow update to generic 1.6.0 (`ffcf7a6`), which M10 still has to validate.

### Validation

| Check | Result |
| --- | --- |
| Tests | N/A — no code changed. Baseline at `d5d845e`: `@clensy/ui` 96/96, `web` 2185/2185 |
| Typecheck | N/A |
| Lint | N/A |
| Build | N/A |
| Package validation | Workflow manifest digests: 27/27 OK (`sha256sum -c`) |

### Next Gate

**M6 — Implementation**, once #196 is merged to `main`.

## Revision 6 (M6 return from Task 1 Step 3)

M6 started on 2026-10-19 after #196 merged (`66b55f9`, PR #199). Task 1 Step 0 passed: #196 `CLOSED`, `66b55f9` on `origin/main`, `react-hooks/exhaustive-deps` present in `packages/ui/eslint.config.mjs`, a clean rebase onto `origin/main`, frozen install exit 0, `@clensy/ui` 9 files 96/96, `@clensy/ui` lint exit 0.

Task 1 Step 3 on unmodified code: **8 passed, 1 failed**. C1 failed at its open assertion (`expect(document.activeElement).toBe(button('First'))`). The active element was the dialog container `<div role="dialog">`. Cause, confirmed: jsdom returns `null` for `offsetParent`, so `getFocusableElements` (`packages/ui/src/internal/use-dialog-behavior.ts:154-162`) finds nothing focusable, and the hook focuses the container, its documented fallback. That is shipped behavior. The plan had assumed jsdom would focus First. Per the Task 1 preamble, M6 stopped and returned the plan. No commit was made.

| Change | Resolution |
| --- | --- |
| C1 open assertion (owner chose Option A, 2026-10-19) | After open, `document.activeElement` is the `Focus` dialog or one of its descendants, and is not Trigger. Its close assertion is unchanged. |
| B6 row | Its C1 assertion is restated to match. B6 (focus does not move in) still fails C1, because focus would stay on Trigger. |
| Not changed | C2's "focus inside the drawer" assertion (it passed), every other test, break and count, and all production code. Option B, stubbing `offsetParent`, was rejected: it would make the test depend on simulated layout rather than shipped behavior. |

The two new test files and the plan's "Execution: native" edit stay uncommitted until M5 accepts this revision. Then Step 3 is rerun and its actual results are recorded.

