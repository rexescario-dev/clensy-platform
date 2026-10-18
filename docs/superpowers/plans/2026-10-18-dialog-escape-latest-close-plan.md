# Dialog Escape Latest-Close Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan and [#196](https://github.com/rexescario-dev/clensy-platform/issues/196) is merged to `main`.**

| Field | Value |
| --- | --- |
| Status | **Draft** (M4), 2026-10-18. Ready for M5 Plan Review. |
| Date | 2026-10-18 |
| Tracking issue | [#193](https://github.com/rexescario-dev/clensy-platform/issues/193) "Dialog Escape handler should read the latest dismissal policy without relying on effect timing". Deferred from [#180](https://github.com/rexescario-dev/clensy-platform/issues/180) / PR [#192](https://github.com/rexescario-dev/clensy-platform/pull/192), M7 non-blocking observation. Implementation guidance: the owner's `useEffect` audit comment on #193 (2026-10-18, at `d5d845e`, finding 3). |
| Branch | `feat/193-dialog-escape-latest-close`, from `main` at `d5d845e`. One PR for this plan, its M5 record and the implementation. Before Task 1 starts, the branch is rebased onto the `main` that contains #196's merge (see Hard prerequisite). |
| Implements (Accepted) | [Dashboard UX Foundation](../specs/2026-08-17-dashboard-ux-foundation-design.md), Status **Accepted** (2026-08-17), with [Amendment #180](../specs/2026-08-17-dashboard-ux-foundation-design.md#8-amendment-180--form-dialog-dismissal-while-submitting) **Accepted** (2026-10-16). Governing text: §8.3.1 (items 1, 5, 7), §8.3.2, §8.3.3, §8.5; §4.4 (`Modal`, `ConfirmDialog`, `DetailDrawer`) and §4.6 (focus in on open, restore on close). |
| No spec amendment | Owner decision, 2026-10-18 (brainstorm): #193 is an internal hook fix under the existing §8.3. No amendment and no M3 by default. §8.5 already states the guarantee unconditionally ("A submitting `FormDialog` MUST NOT close because of a user-initiated dismissal"), so making it hold however the `submitting` update is scheduled adds no product semantics. If planning or execution finds §8.3 ambiguous or insufficient, or that #193 needs a specified behavior to change, stop and return to M2/M3. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. File names, test names, helper names and task order are planning decisions, not product semantics. |
| Scope | `packages/ui`: `src/internal/use-dialog-behavior.ts` and two new test files. **No** change to `Modal`, `FormDialog`, `ConfirmDialog`, `DetailDrawer`, the existing `@clensy/ui` tests, any caller in `apps/web` or `packages/web`, `package.json`, `pnpm-lock.yaml`, copy, API, schema or GraphQL. |
| Package names | `pnpm --filter @clensy/ui` is `packages/ui`. `pnpm --filter web` is `apps/web`. |
| Baseline | On `main` at `d5d845e`, at planning time: `pnpm --filter @clensy/ui exec vitest run`, 9 files, 96/96 passed. `pnpm --filter web exec vitest run`, 48 files, 2185/2185 passed. This is a baseline, not pre-validation. Task 1 re-records it after the rebase. |
| Pre-validation | **Partial.** Two throwaway planning probes ran on `main` at `d5d845e` and were deleted, and the tree was restored (`git status` clean). (1) A single test equivalent to Task 2's `refuses an Escape pressed in the commit that starts a submit`, against unmodified code: **failed** at `expect(closes).toBe(0)`, which reproduces the #193 defect. (2) The same test with the hook temporarily changed to the Task 2 Step 3 mechanism: `pnpm --filter @clensy/ui exec vitest run` reported 10 files, 97/97 passed. **Not run:** every other test in this plan, lint (the #196 rules do not exist yet), `tsc`, the `web` suite and Task 3's commands. Every other `Expected:` line is a prediction until M6 records the actual result. |
| Red-phase evidence | Each "verify it fails" step gives the behavioral failure and a **predicted** count. The count is not a pass criterion. At every red phase the implementer records the actual totals and each failing test's name and first failure message in the Execution record. If the result differs from the prediction, stop and find out why before writing the implementation, and record the explanation. |
| M7 | Application code changes. `CLAUDE.md` requires a **fresh independent reviewer** on the most capable model, given the Accepted spec (with Amendment #180), this plan and the branch diff. |

**Goal:** The shared Escape handler in `useDialogBehavior` always calls the `onClose` from the latest commit, so Escape can never dismiss a `FormDialog` once its submit has started (and never stays refused once it has ended), however React schedules the `submitting` update.

**Architecture:** Today the `document` `keydown` listener is registered in a passive `useEffect` keyed on `[open, onClose]`. A new `onClose` reaches the listener only when that effect re-runs. Until then, an Escape press calls the previous `onClose`. `FormDialog`'s `requestClose` is a new function on every render, so the listener is also removed and re-added on every render. The fix wraps the Escape call in React 19.2's `useEffectEvent` and keys the effect on `[open]` only. React swaps in an effect event's latest function during the commit's before-mutation phase, before any layout or passive effect runs. So the listener reads the current callback from the moment a commit lands, and it is registered once per `open`. `FormDialog`'s `requestClose` guard, the `openDialogStack` topmost check, the backdrop handler and both focus effects are unchanged.

**Tech Stack:** React 19.2.8 (`useEffectEvent`), TypeScript, Vitest 5 with jsdom (per-file `// @vitest-environment jsdom`, as in `packages/ui/src/base/dialogs/*.test.tsx`), `eslint-plugin-react-hooks` 6+ (from #196), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-08-17-dashboard-ux-foundation-design.md` §4.4, §4.6, §8 (Amendment #180).

## Hard prerequisite

- **#196 is merged.** The owner's sequencing (#193 audit comment): adopt `useEffectEvent` only after #196 enables `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps`, so that its usage rules are enforced. Before Task 1: `gh issue view 196 --json state -q .state` prints `CLOSED`, the merge commit is on `origin/main`, and `grep -n "react-hooks/exhaustive-deps" packages/ui/eslint.config.mjs` matches. Then `git fetch && git rebase origin/main` on this branch. If #196 is not merged, stop. Do not install or configure the plugin in this slice.
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
- **(c) How the tests hit the timing window.** A passive-effect window cannot be hit reliably with real timers in jsdom. Instead, a test-only probe component calls `useLayoutEffect` and presses Escape when its `fire` prop turns true. Layout effects run after the DOM commit and before that commit's passive effects, however the update was scheduled (discrete, default, transition or timer). So an Escape press from a layout effect lands exactly in the window #193 describes, every time. The probe is rendered **before** the dialog in the tree, so its layout effect also runs before any layout effect inside the dialog. This makes the test independent of the mechanism's tree position. Pre-validation probe (1) shows the pattern reproduces the defect on `main`.
- **(d) Coverage in `@clensy/ui` only.** The issue requires `@clensy/ui` regression tests for the timing case and stacked dialogs. No new `web` test. `apps/web/lib/use-detail-drawer.test.tsx` (including `goes Back once for a double Escape…`) and the laundry interaction suites already exercise the hook through real callers, and Task 3 runs them unedited.
- **(e) `DetailDrawer` characterization tests.** Unlike #180, this slice edits the hook `DetailDrawer` uses, and `@clensy/ui` has no `DetailDrawer` test today. A new `detail-drawer.test.tsx` pins its Escape, backdrop and × dismissal and its stacking under a `ConfirmDialog` before the hook changes (§8.5, issue criterion 4). These are characterization tests. `ConfirmDialog` is already pinned by `confirm-dialog.test.tsx`, which stays unedited.
- **(f) Focus and Strict Mode characterization tests.** The owner's comment asks that focus capture on open, focus restoration on close or unmount, and correct behavior under Strict Mode's mount, unmount, remount sequence be preserved. Task 1 pins each one before the change.
- **(g) Docs.** No README or docs change in M6. `packages/ui/README.md` does not describe the hook. M9 decides.

## Review Focus

- **The submit ending, not starting:** an Escape in the commit that sets `submitting` back to false must close the dialog. A stale guard that still refuses it is the mirror image of #193 (§8.3.3, "no leftover blocked state"). Owned by Task 2 `closes on an Escape pressed in the commit that ends a submit`.
- **A dialog reopened after closing:** reopening must register exactly one new listener, and an Escape after close must call nothing. Owned by Task 2 `registers one keydown listener per open and removes it on close`.
- **Unmount while open (the `DetailDrawer` `?detail=` pattern):** the listener must be removed and focus restored, and a later Escape must call nothing. Owned by Task 1 `restores focus to the trigger and stops handling Escape when the dialog unmounts while open`.
- **Strict Mode's double mount:** this must not leave two listeners (Escape would call `onClose` twice) or a duplicate stack entry (topmost would be wrong). Owned by Task 1 `closes once per Escape under Strict Mode and restores focus`, Task 1 `keeps topmost-only Escape under Strict Mode`, and Task 2 `refuses the start-of-submit Escape under Strict Mode too`.
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

In `use-dialog-behavior.test.tsx`, `describe('useDialogBehavior focus and Strict Mode (#193) [C]')`:
- `moves focus into the dialog on open and restores it to the trigger on close`: focus Trigger, open a `Modal` containing `<button>First</button>` → `document.activeElement` is First; set `open` false → active element is Trigger.
- `restores focus to the trigger and stops handling Escape when the dialog unmounts while open`: focus Trigger, mount `<DetailDrawer open onClose={spy}>`, then rerender without it → active element is Trigger; `pressEscape()` → `spy` not called.
- `closes once per Escape under Strict Mode and restores focus`: same as the first test with the tree wrapped in `<StrictMode>` and `onClose` a `vi.fn()` that sets `open` false → after one Escape, `onClose` called exactly once and focus is on Trigger.
- `keeps topmost-only Escape under Strict Mode`: in `<StrictMode>`, open a `Modal` titled `Under`, then a `FormDialog` with `submitting` true on top → Escape → neither `onClose` is called and both dialogs are present; set `submitting` false → Escape → only the `FormDialog`'s `onClose` is called.

- [ ] **Step 3: Run them on unmodified code**

Run: `pnpm --filter @clensy/ui exec vitest run src/base/detail-drawer.test.tsx src/internal/use-dialog-behavior.test.tsx`
Expected: 2 files, 9/9 passed. Any failure → stop (see the Task 1 preamble).

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/base/detail-drawer.test.tsx packages/ui/src/internal/use-dialog-behavior.test.tsx
git commit -m "test(193): pin dialog dismissal, focus and Strict Mode behavior"
```

### Task 2: Escape always calls the latest `onClose` (type: `code`)

Implements spec §8.3.1 items 1 and 5, §8.3.2, §8.3.3 and §8.5 under every update schedule (#193 acceptance criteria 1–3). Planning decisions (a)–(c).

**Files:**
- Modify: `packages/ui/src/internal/use-dialog-behavior.ts` (import line 2; the `keydown` effect, lines 76–130; comments that describe it)
- Test: `packages/ui/src/internal/use-dialog-behavior.test.tsx` (second `describe` block)

**Interfaces:**
- Consumes: Task 1's `mount`, `rerender`, `pressEscape`, `dialogTitled`.
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

`describe('Escape uses the latest close callback (#193)')`:
- `calls the onClose from the commit the Escape lands in, not an earlier one`: mount `<Modal open onClose={a}>`; rerender with `onClose={b}` and `fire` true → `b` called once, `a` not called.
- `refuses an Escape pressed in the commit that starts a submit`: mount an open `FormDialog` (`submitting` false) whose `onClose` increments `closes`; rerender with `submitting` true and `fire` true → `closes` is 0 and the dialog is present.
- `closes on an Escape pressed in the commit that ends a submit`: mount with `submitting` true; rerender with `submitting` false and `fire` true → `closes` is 1.
- `refuses an Escape in the commit that starts a submit when the FormDialog is stacked on top`: open `Modal` `Under`, then an idle `FormDialog` on top; rerender with `submitting` true and `fire` true → neither `onClose` is called; both dialogs present.
- `refuses the start-of-submit Escape under Strict Mode too`: the second test with the tree in `<StrictMode>` → `closes` is 0.
- `registers one keydown listener per open and removes it on close`: `vi.spyOn(document, 'addEventListener')` and `removeEventListener`, counting only `'keydown'` calls. Mount an open `Modal`, then rerender it three times, each with a new inline `onClose` → 1 add, 0 removes. Set `open` false → 1 remove, of the same handler that was added; `pressEscape()` → no `onClose` called. Set `open` true again → 2 adds in total. Restore the spies.

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @clensy/ui exec vitest run src/internal/use-dialog-behavior.test.tsx`
Expected (predicted): 6 failed, 4 passed (Task 1's). The first five fail because the stale `onClose` runs: `a` called instead of `b`; `closes` 1 instead of 0; 0 instead of 1; the `FormDialog` closes; 1 instead of 0. The listener test fails on its add count: 4 instead of 1. Record actual names and first messages.

- [ ] **Step 3: Call the latest `onClose` through an effect event in `use-dialog-behavior.ts`**

Import `useEffectEvent` from `react`. In `useDialogBehavior`, before the `keydown` effect, declare `const closeOnEscape = useEffectEvent(() => onClose());`. In `handleKeyDown`, the topmost branch calls `closeOnEscape()` instead of `onClose()`. Change the effect's dependency array from `[open, onClose]` to `[open]`. Update the comments to match the surrounding style: one comment at the effect event saying why (#193: the listener lives for one `open`, the effect event gives it the `onClose` of the latest commit, before any effect of that commit runs, so the `FormDialog` guard is never stale), and fix the module-stack comment that says "see the dedicated effect below" only if its meaning changes. Do not touch the stack effect, the focus effect, the Tab branch, `backdropProps` (a render-time handler, already current) or `getFocusableElements`.

- [ ] **Step 4: Run the tests and lint**

Run: `pnpm --filter @clensy/ui exec vitest run && pnpm --filter @clensy/ui lint && pnpm --filter @clensy/ui build`
Expected: 11 files, 111/111 passed (96 + 9 + 6, on the `d5d845e` baseline; adjust by Step 0's recorded baseline); lint passes with no `react-hooks/*` finding and no `eslint-disable`; `tsc --noEmit` passes.

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
Expected: all succeed. `@clensy/ui` 111/111. `web` 48 files, 2185/2185, unchanged from the baseline (or Step 0's recorded post-#196 count). Record each command's actual result and every package's test totals.

- [ ] **Step 2: Account for every changed path**

Run: `git diff --name-only <rebased-base> HEAD | sort`, where `<rebased-base>` is `git merge-base HEAD origin/main` after the Task 1 Step 0 rebase.
Expected: exactly these four paths, with none missing and no others:
`docs/superpowers/plans/2026-10-18-dialog-escape-latest-close-plan.md`, `packages/ui/src/base/detail-drawer.test.tsx`, `packages/ui/src/internal/use-dialog-behavior.test.tsx`, `packages/ui/src/internal/use-dialog-behavior.ts`.
Any other path, or a missing one, means stop and investigate. Then `git diff --quiet <rebased-base> HEAD -- packages/ui/src/base packages/ui/package.json pnpm-lock.yaml apps packages/web ':!packages/ui/src/base/detail-drawer.test.tsx'` exits 0. Record the full output.

- [ ] **Step 3: Write the Execution record and the M6 Slice Completion Report, then commit**

Append `## Execution record` with each task's red and green results as actual output, and the Step 1 and Step 2 results. Then emit the M6 Slice Completion Report per `docs/workflows/conventions/reporting-conventions.md`, with Next Gate M7 (a fresh independent reviewer).

```bash
git add docs/superpowers/plans/2026-10-18-dialog-escape-latest-close-plan.md
git commit -m "docs(193): record M6 execution"
```

## Traceability

| Requirement | Task |
| --- | --- |
| #193 criterion 1; §8.3.1 item 1, §8.5 (submitting `FormDialog` never closes on Escape, however scheduled) | Task 2 `refuses an Escape pressed in the commit that starts a submit`, `…under Strict Mode too`; Step 3 |
| §8.3.3 (no leftover blocked state once submitting is false) | Task 2 `closes on an Escape pressed in the commit that ends a submit` |
| #193 criterion 2; §8.3.2 (topmost-only, stacked, submitting on top) | Task 1 `keeps topmost-only Escape under Strict Mode`, `closes only a ConfirmDialog opened on top of it…`; Task 2 `…stacked on top`; existing `form-dialog.test.tsx` stacking tests, unedited |
| #193 criterion 3 (regression tests in `@clensy/ui` for timing and stacking) | Task 2 Step 1 |
| #193 criterion 4; §8.5 (`ConfirmDialog`, `DetailDrawer` unchanged) | Task 1 `detail-drawer.test.tsx`; existing `confirm-dialog.test.tsx`, unedited; Task 3 Step 2 |
| §4.4, §4.6 (focus in on open, restored on close and unmount); owner comment (Strict Mode) | Task 1 Step 2 |
| §8.3.1 item 5 (no `onClose` call, no replay) | Existing `form-dialog.test.tsx` (`does not replay a refused Escape…`, `changes nothing visible…`), unedited; Task 3 Step 1 |
| Owner comment (listener registered once per `open`) | Task 2 `registers one keydown listener per open and removes it on close` |
| Owner sequencing (#196 first) | Hard prerequisite; Task 1 Step 0; Task 2 Step 4 lint |

## Deferred (not in this plan)

- The AppSidebar `useEffectEvent` follow-up named in #196. It is a separate issue.
- `ConfirmDialog` refusing dismissal while `confirming` (spec §8.7). It needs a separate issue if it is wanted.
- Any docs change. M9 decides.
