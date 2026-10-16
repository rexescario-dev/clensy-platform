# Form Dialog Submit Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Accepted (revision 4)** at M5, 2026-10-17. M6 complete ([Execution record](#execution-record)); M7 **Approved for merge** (independent review); M8 N/A; M9 complete; M10 pending (the slice carries the workflow update). PR [#192](https://github.com/rexescario-dev/clensy-platform/pull/192). |
| M5 decision | **Accepted** — 2026-10-17, revision 4 (`63f98a8`), by the owner: "The implementation plan is accepted for M6 execution." The execution contract the owner set: preserve the `requestClose` architecture and the `ConfirmDialog` characterization tests; implement only the agreed `@clensy/ui` behavior and the specified web regression test; run the disposable-worktree red proof and record all five results (a failure for any reason other than the expected regression assertion is not proof); record actual verification results, not predicted counts; audit changed paths against `fcd1c6f`, keeping the workflow update distinct from #180; do not merge or skip later gates; M7 requires a fresh, independent reviewer. Execution: **native**, as recommended. The acceptance is not a claim that anything has passed. |
| M5 history | First pass (2026-10-17, owner, reviewed `af0dd9b`): **Returned for Revision**, required revisions M5-1 to M5-3 and four non-blocking items. All are resolved in [Revision 2 (M5 review 1)](#revision-2-m5-review-1). The owner approved the `requestClose` architecture and the `ConfirmDialog` characterization tests without changes. Second pass (2026-10-17, owner, reviewed `2e9a298`): **Returned for Revision**, one final correction, M5-4. M5-1 to M5-3 and the non-blocking items are recorded as resolved. M5-4 is resolved in [Revision 3 (M5 review 2)](#revision-3-m5-review-2). Third pass (2026-10-17, owner, reviewed `6687d29`): **Returned for Revision**, one remaining M5-4 edge case: `cleanup` ran under `set -e`, so a failed `git worktree remove` could skip the prune and the directory removal. Everything else is recorded as resolved. The fix is in [Revision 4 (M5 review 3)](#revision-4-m5-review-3). |
| Date | 2026-10-16 |
| Tracking issue | [#180](https://github.com/rexescario-dev/clensy-platform/issues/180) "Keep form dialogs open while a submit is in flight". Follow-up from [#160](https://github.com/rexescario-dev/clensy-platform/issues/160) / PR [#179](https://github.com/rexescario-dev/clensy-platform/pull/179), M7 triage T5-a. |
| Branch | `feat/180-form-dialog-submit-guard`, from `main` at `fcd1c6f`. One PR for the amendment, this plan, its M5 record and the implementation. The branch also carries the Context Forge workflow update (generic 1.5.0), committed in `3a9c010` at the owner's request. |
| Implements (Accepted) | [Dashboard UX Foundation](../specs/2026-08-17-dashboard-ux-foundation-design.md), Status **Accepted** (2026-08-17), with **[Amendment #180](../specs/2026-08-17-dashboard-ux-foundation-design.md#8-amendment-180--form-dialog-dismissal-while-submitting)**, Accepted at M3 on 2026-10-16. Governing text: §8.3 (contract), §8.5 (invariants), §8.8 (verification). |
| Relies on (Accepted, merged) | The same spec's §4.4 (`Modal`, `FormDialog`, `ConfirmDialog`, `DetailDrawer`) and §4.6. The shipped topmost-only Escape handling in `packages/ui/src/internal/use-dialog-behavior.ts` (`openDialogStack`), which §8.2 and §8.3.2 make normative. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. File names, test names, helper names and task order are planning decisions, not product semantics. |
| Scope | `packages/ui`: `FormDialog`, two new test files, `package.json` (one devDependency). `apps/web`: one new test in an existing test file. `pnpm-lock.yaml`. **No** change to `Modal`, `use-dialog-behavior.ts`, `ConfirmDialog`, `DetailDrawer`, any `FormDialog` caller, copy, API, schema or GraphQL. |
| Package names | `pnpm --filter @clensy/ui` is `packages/ui`. `pnpm --filter web` is `apps/web`. |
| Baseline | On `main` at `fcd1c6f`, at planning time: `pnpm --filter @clensy/ui exec vitest run`, 7 files, 81/81 passed. `pnpm --filter web exec vitest run lib/laundry-list-page.interaction.test.tsx`, 35/35 passed. `pnpm --filter web exec vitest run`, 48 files, 2184/2184 passed. This is a baseline, not pre-validation. |
| Pre-validation | **None.** No code in this plan was run before M5. Every `Expected:` line is a prediction until M6 records the actual result. |
| Red-phase evidence | Each "verify it fails" step gives the behavioral failure and a **predicted** count. The count is not a pass criterion. At every red phase the implementer records the actual totals and each failing test's name and first failure message in the Execution record. If the result differs from the prediction, stop and find out why before writing the implementation, and record the explanation. |
| M7 | Application code changes. `CLAUDE.md` requires a **fresh independent reviewer** on the most capable model, given the Accepted spec (with Amendment #180), this plan and the branch diff. |

**Goal:** While a `FormDialog` is submitting, every user-initiated dismissal is refused with no feedback and no replay. A topmost submitting `FormDialog` consumes Escape. Once `submitting` is false, dismissal is unchanged, and programmatic close always works (spec §8.3).

**Architecture:** `FormDialog` gets one internal close guard, `requestClose`. It calls the caller's `onClose` only when `submitting` is false. `FormDialog` passes `requestClose`, not `onClose`, to `Modal` and to its Cancel button. Every user path into a `FormDialog`'s close (Escape and the backdrop through `Modal`'s `onClose`, Cancel, and any affordance `Modal` adds later through the same prop) therefore passes one check (§8.3.1 item 4). `useDialogBehavior` is untouched. Its topmost check still decides which dialog an Escape press belongs to. When that dialog is a submitting `FormDialog`, the press reaches the guard and stops there, so nothing beneath it closes (§8.3.2). `open` stays caller-owned, so a programmatic close is never refused (§8.3.1 item 7).

**Tech Stack:** React 19, TypeScript, Vitest 5 with jsdom (per-file `// @vitest-environment jsdom`, as in `apps/web/lib/*.interaction.test.tsx`), pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-08-17-dashboard-ux-foundation-design.md` §8 (Amendment #180).

## Global Constraints

- The change is confined to `@clensy/ui`. No `FormDialog` caller is edited (spec §8.5).
- `FormDialogProps` is unchanged as callers see it (§8.4).
- A refused dismissal calls no `onClose`, is not replayed, and changes nothing in the DOM: no attribute, class, text or live region (§8.3.1 item 5, §8.5).
- `Modal`, `use-dialog-behavior.ts`, `ConfirmDialog` and `DetailDrawer` are not modified (§8.4, §8.5).
- No copy change and no new UI state (§8.7).

## Planning decisions for M5 to confirm

- **(a) Guard location.** The guard goes in `FormDialog` (`requestClose`), not in `Modal` or `useDialogBehavior`. The spec leaves the mechanism to M4 (§8.6). This is the smallest change that puts the check in one place for the primitive. It leaves `ConfirmDialog` and `DetailDrawer`, which share `Modal` and the hook, unchanged by construction. A `dismissible` flag on `Modal` was considered. It would touch the shared hook for no behavior the guard doesn't already give.
- **(b) jsdom in `@clensy/ui` (a dependency change).** `@clensy/ui` tests run in `node` and render with `renderToStaticMarkup`, which can't dispatch key or click events. §8.8 requires `@clensy/ui` tests for both states, so `packages/ui/package.json` gains `"jsdom": "^29.1.1"` as a devDependency, the range `apps/web` already declares. `pnpm-lock.yaml` changes with it. The default environment in `vitest.config.ts` stays `node`. Only the new files opt in by pragma. jsdom resolves from `packages/ui` today only by hoisting, so it must be declared.
- **(c) `ConfirmDialog` characterization tests.** These pin §8.5: "`ConfirmDialog` … dismissal MUST NOT change". They record today's behavior, which is that it still closes while `confirming`. They do not endorse it. A future issue that changes it updates these tests.
- **(d) An intake regression test in `apps/web`.** This is the #180 motivating scenario end to end: Escape and the backdrop during a pending `receiveLaundryOrder`, then the failure alert in the still-open dialog. It is a test-only edit. No caller source changes.
- **(e) `DetailDrawer`.** No new test. Its code is untouched, and `apps/web/lib/use-detail-drawer.test.tsx` already covers its close paths. Task 3's full suite run covers it.
- **(f) Docs.** No README or docs change in M6. `packages/ui/README.md` does not describe dismissal behavior. M9 decides.

## Review Focus

- **Submitting flips back to false after a failure:** Escape must close on the very next press, without a stale guard. Owned by Task 1 (`closes on Escape and the backdrop again once submitting is false`).
- **A refused Escape followed by the submit settling:** the dialog must not close by itself. Owned by Task 1 (`does not replay a refused Escape when submitting ends`).
- **Escape pressed inside a focused field, not on `document`:** it bubbles to the hook's `document` listener and must still be refused. Every Task 1 `FormDialog` Escape is dispatched by `pressEscapeIn(element)`, which focuses the field, asserts it is `document.activeElement`, and dispatches on it (M5-2).
- **A drawer or modal underneath a submitting `FormDialog`:** one Escape must close neither. Owned by Task 1 (`consumes Escape when the submitting FormDialog is on top`).
- **A caller closing its dialog while still submitting** (setting `open` to `false` before clearing `submitting`, as some success paths do): it must close and restore focus. Owned by Task 1 (`still closes when the caller sets open to false while submitting, and restores focus`).

---

### Task 1: `FormDialog` refuses user dismissal while submitting (type: `code`)

Implements spec §8.3.1, §8.3.2, §8.3.3 and §8.5. Planning decisions (a)–(c).

**Files:**
- Modify: `packages/ui/package.json` (add the devDependency), `pnpm-lock.yaml` (from `pnpm install`)
- Create: `packages/ui/src/base/dialogs/form-dialog.test.tsx`
- Create: `packages/ui/src/base/dialogs/confirm-dialog.test.tsx`
- Modify: `packages/ui/src/base/dialogs/form-dialog.tsx`

**Interfaces:**
- Consumes: `Modal` (`../modal`), `FormDialog`, `ConfirmDialog`, all unchanged in their props.
- Produces: no new export. `FormDialogProps` is unchanged. Task 2 relies only on the behavior.

- [ ] **Step 1: Add jsdom to `@clensy/ui`**

Before: `TMPDIR_180="$(mktemp -d)"; pnpm why jsdom --recursive > "$TMPDIR_180/why-before.txt"` (a scratch directory outside the repository; the same shell runs the After command).
Run: `pnpm --filter @clensy/ui add -D jsdom@^29.1.1`
After: `pnpm why jsdom --recursive > "$TMPDIR_180/why-after.txt"` and `git diff --stat -- pnpm-lock.yaml`.
Expected: `packages/ui/package.json` lists `"jsdom": "^29.1.1"` under `devDependencies`. Do not assume which lockfile sections change; read them. Record in the Execution record: (1) every lockfile importer whose entries changed, (2) every package added to or removed from the `packages:` / `snapshots:` sections, and (3) the `diff` of the two `pnpm why` outputs. Expected (predicted): only the `packages/ui` importer changes (its new `jsdom` devDependency and possibly its `vitest` peer variant), no package is added or removed, and every other workspace's jsdom resolution is identical before and after. If any other importer's resolution changes, or a package is added or removed, stop and record why before continuing.

- [ ] **Step 2: Write `form-dialog.test.tsx`**

The file starts with `// @vitest-environment jsdom` and sets `IS_REACT_ACT_ENVIRONMENT = true`, as `apps/web/lib/use-detail-drawer.test.tsx` does. It renders with `createRoot` and `act` into a container appended to `document.body`, unmounted in `afterEach`.

The fixture is driven by a module-level `state = { formOpen, modalOpen, submitting }`. `paint()` re-renders it inside `act`. It renders, in order:
- a `<button>Trigger</button>`;
- `<Modal open={state.modalOpen} title="Under">` with one `<button>Under action</button>` child;
- `<FormDialog open={state.formOpen} title="Edit" submitLabel="Save" submitting={state.submitting} onSubmit={() => {}}>` with one `<input aria-label="Name" />` child.

Each `onClose` pushes its name (`'modal'` or `'form'`) onto `closes: string[]`, sets its open flag to `false`, and calls `root.render(<Fixture />)` without a nested `act`, because the dispatch is already inside one. The flag change matters: the dialog really closes when `onClose` runs, so "stays open" is observable in the DOM.

`beforeEach` resets `state` to `{ formOpen: false, modalOpen: false, submitting: false }` and `closes` to `[]`, creates a fresh container and root, and then each test arranges its own state. `afterEach` unmounts the root inside `act` and removes the container, so no dialog stays on the module-level `openDialogStack` between tests.

Helpers:
- `pressEscapeIn(element: HTMLElement)` calls `element.focus()`, asserts `expect(document.activeElement).toBe(element)`, then dispatches `new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })` **on `element`**, inside `act`. The event reaches the hook only by bubbling to `document` (M5-2).
- `nameField()` returns the `FormDialog`'s `input[aria-label="Name"]`. `underAction()` returns the `Modal`'s `Under action` button.
- `formDialog()` returns the `[role="dialog"]` containing a `form`, or `null`.
- `underDialog()` returns the `[role="dialog"]` without one.
- `clickBackdrop(dialog)` calls `dialog.parentElement!.click()` inside `act`.
- `cancel()` returns the Cancel button.

Stacking order follows the order dialogs become open, so a stacked test opens them in two separate `paint()` calls.

Tests in `describe('FormDialog dismissal (#180)')`. Each test lists its arrangement, then its assertions. [C] marks a characterization test, which pins behavior that is already correct.

| Test | Arrange | Assert |
| --- | --- | --- |
| `closes on Escape when idle` [C] | form open, idle | `pressEscapeIn(nameField())` → `closes` is `['form']`, `formDialog()` is `null` |
| `closes on a backdrop click when idle` [C] | form open, idle | `clickBackdrop(formDialog()!)` → `['form']` |
| `closes on Cancel when idle` [C] | form open, idle | `act(() => cancel().click())` → `['form']` |
| `ignores Escape while submitting` | form open, submitting | `pressEscapeIn(nameField())` → `closes` is `[]`, `formDialog()` is not `null` |
| `ignores a backdrop click while submitting` | form open, submitting | `clickBackdrop(formDialog()!)` → `[]`, still open |
| `keeps Cancel disabled while submitting` [C] | form open, submitting | `cancel().disabled` is `true`. `act(() => cancel().click())` → `[]` |
| `changes nothing visible when it refuses a dismissal` | form open, submitting; `before = document.body.innerHTML` | `pressEscapeIn(nameField())` then `clickBackdrop(formDialog()!)` → `document.body.innerHTML` is `before`, `[]` |
| `still closes when the caller sets open to false while submitting, and restores focus` [C] | focus Trigger, then form open, submitting | `state.formOpen = false; paint()` → `formDialog()` is `null`, `document.activeElement` is Trigger, `closes` is `[]` |
| `does not replay a refused Escape when submitting ends` | form open, submitting; `pressEscapeIn(nameField())` | `state.submitting = false; paint()` → `closes` is `[]`, still open |
| `closes on Escape and the backdrop again once submitting is false` [C] | form open, submitting, then `submitting = false; paint()` | `pressEscapeIn(nameField())` → `['form']`. Reopen (`formOpen = true; paint()`), `clickBackdrop(formDialog()!)` → `['form', 'form']` |
| `consumes Escape when the submitting FormDialog is on top` | `modalOpen = true; paint()`, then `formOpen = true; submitting = true; paint()` | `pressEscapeIn(nameField())` → `[]`, `formDialog()` and `underDialog()` both not `null` |
| `lets Escape close a dialog on top of a submitting FormDialog` [C] | `formOpen = true; submitting = true; paint()`, then `modalOpen = true; paint()` | `pressEscapeIn(underAction())` → `['modal']`, `formDialog()` not `null` |
| `closes only the top FormDialog when idle and stacked` [C] | `modalOpen = true; paint()`, then `formOpen = true; paint()` | `pressEscapeIn(nameField())` → `['form']`, `underDialog()` not `null` |

- [ ] **Step 3: Write `confirm-dialog.test.tsx`** (planning decision (c), all [C])

Same jsdom setup and reset in `beforeEach` / `afterEach`. Render `<ConfirmDialog open title="Delete" description="Sure?" confirmLabel="Delete" confirming onConfirm={() => {}} onClose={onClose} />` with `const onClose = vi.fn()`.
- `still closes on Escape while confirming` [C]: dispatch Escape on `document` → `onClose` called once. Both `ConfirmDialog` buttons are disabled while `confirming`, so the hook focuses the dialog container. A field-focus variant does not apply because there is no field.
- `still closes on a backdrop click while confirming` [C]: click the dialog's `parentElement` → `onClose` called once.

- [ ] **Step 4: Run the new tests to verify the red phase**

Run: `pnpm --filter @clensy/ui exec vitest run src/base/dialogs`
Expected (predicted): `form-dialog.test.tsx` 5 failed / 8 passed. The failing tests are `ignores Escape while submitting`, `ignores a backdrop click while submitting`, `changes nothing visible when it refuses a dismissal`, `does not replay a refused Escape when submitting ends` and `consumes Escape when the submitting FormDialog is on top`. Each fails because `closes` contains `'form'` (or because the dialog is gone). `confirm-dialog.test.tsx` 2/2 passed. Record actual counts and messages. Any other failure means stop and investigate.

- [ ] **Step 5: Implement the guard in `form-dialog.tsx`**

Add, inside `FormDialog`, `function requestClose(): void` that returns without calling `onClose` while `submitting` is true and otherwise calls `onClose()`. Pass `onClose={requestClose}` to `Modal` and `onClick={requestClose}` to the Cancel button. Keep `disabled={submitting}` on both buttons. Add a short comment that this is the single user-dismissal guard for #180 (spec §8.3) and that `open` stays caller-owned. Declare it after `handleSubmit`, keeping the nested functions alphabetical. Nothing else changes.

- [ ] **Step 6: Run the `@clensy/ui` checks**

Run: `pnpm --filter @clensy/ui exec vitest run && pnpm --filter @clensy/ui lint && pnpm --filter @clensy/ui build`
Expected: 9 files, 96/96 passed (81 baseline + 13 + 2). Lint and `tsc --noEmit` clean.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/package.json pnpm-lock.yaml packages/ui/src/base/dialogs/form-dialog.tsx packages/ui/src/base/dialogs/form-dialog.test.tsx packages/ui/src/base/dialogs/confirm-dialog.test.tsx
git commit -m "feat(ui): keep a submitting FormDialog open on user dismissal (#180)"
```

### Task 2: Intake regression test for the #180 scenario (type: `code`)

Implements spec §8.8 ("existing laundry intake page tests keep passing") and planning decision (d). This is a regression test. Because Task 1 already fixed the behavior, it passes on arrival, so Step 4 proves it would catch the bug.

**Files:**
- Modify: `apps/web/lib/laundry-list-page.interaction.test.tsx` (one new `it`, next to `stays open on failure with an alert, the fields intact, and submit re-enabled for a retry`)

**Interfaces:**
- Consumes: the file's existing helpers `start`, `openCreate`, `chooseCustomer`, `submitCreate`, `dialog`, and `nav.rejectReceive`. It also needs the Task 1 behavior.
- Produces: nothing.

- [ ] **Step 1: Write the test**

`it('keeps the dialog open on Escape and a backdrop click while the create is pending, then shows the failure in it (#180)', async () => { … })`:
1. `start(); openCreate(); chooseCustomer(); await submitCreate();`
2. Dispatch Escape on `document` inside `act` → `dialog()` not `null`.
3. `act(() => dialog()!.parentElement!.click())` → `dialog()` not `null`.
4. `await act(async () => nav.rejectReceive(new Error('Network down')));` → `dialog()!.querySelector('[role="alert"]')!.textContent` is `'Unable to create laundry order.'`. If the neighbouring failure test needs `runFocusTimer()` to settle, do the same.
5. Dispatch Escape on `document` again → `dialog()` is `null`, because dismissal is restored after the failure.
6. `expect(nav.receiveCalls).toHaveLength(1)`.

- [ ] **Step 2: Run it**

Run: `pnpm --filter web exec vitest run lib/laundry-list-page.interaction.test.tsx`
Expected: 36/36 passed.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/laundry-list-page.interaction.test.tsx
git commit -m "test(web): intake dialog stays open on dismissal while a create is pending (#180)"
```

- [ ] **Step 4: Prove it catches the bug, in a disposable worktree (M5-1, M5-4)**

The proof never writes to the working tree. It checks out the committed branch `HEAD` (Tasks 1 and 2) in a temporary detached worktree. There it puts back the original `FormDialog` from the pinned baseline `fcd1c6f`, and runs only the new test.

The script runs with `set -euo pipefail`, so any failed setup, check or cleanup command stops it with a non-zero exit. The `EXIT` trap runs a best-effort cleanup on every exit path. It attempts each step, removing the worktree, pruning worktree metadata and deleting the temporary directory, even if an earlier step fails. Check 5 then verifies independently that nothing remains. The one expected failure, vitest's, is captured explicitly and then verified to be the right failure. Save the script to a scratch file outside the repository and run it with `bash <file>` from the repository root, so `exit` ends the script and not your shell.

```bash
set -euo pipefail
before="$(git status --porcelain=v1)"
proof="$(mktemp -d)"
wt="$proof/wt"
# Best-effort: every step is attempted even if an earlier one fails.
# Check 5 below still fails the proof if anything remains.
cleanup() {
  if [ -d "$wt" ]; then
    git worktree remove --force "$wt" || true
  fi
  git worktree prune || true
  rm -rf "$proof"
}
trap cleanup EXIT

git worktree add --detach "$wt" HEAD
git -C "$wt" show fcd1c6f:packages/ui/src/base/dialogs/form-dialog.tsx \
  > "$wt/packages/ui/src/base/dialogs/form-dialog.tsx"

# Check 1: the worktree has the baseline FormDialog, without the guard.
if grep -q requestClose "$wt/packages/ui/src/base/dialogs/form-dialog.tsx"; then
  echo "CHECK 1 FAILED: baseline FormDialog contains requestClose"; exit 1
fi
echo "CHECK 1 OK: baseline FormDialog has no requestClose"

(cd "$wt" && pnpm install --frozen-lockfile --offline)   # a setup error stops the script here

# Check 2: exactly the new regression test fails, for the expected reason.
# The non-zero vitest exit is expected, so it is captured instead of stopping the script.
status=0
(cd "$wt" && pnpm --filter web exec vitest run lib/laundry-list-page.interaction.test.tsx -t "#180" \
  --reporter=default --reporter=json --outputFile.json="$proof/result.json") || status=$?
if [ "$status" -eq 0 ]; then echo "CHECK 2 FAILED: vitest passed; the test does not catch the bug"; exit 1; fi
[ -s "$proof/result.json" ] || { echo "CHECK 2 FAILED: no JSON result (setup or import error, exit $status)"; exit 1; }
node -e '
  const results = require(process.argv[1]).testResults.flatMap((file) => file.assertionResults);
  const failed = results.filter((test) => test.status === "failed");
  const passed = results.filter((test) => test.status === "passed");
  const ok = failed.length === 1 && passed.length === 0 && failed[0].title.includes("#180")
    && /not to be null/.test(failed[0].failureMessages.join("\n"));
  if (!ok) { console.error("CHECK 2 FAILED", JSON.stringify(failed.map((test) => [test.title, test.failureMessages[0]]), null, 1)); process.exit(1); }
  console.log("CHECK 2 OK:", failed[0].title);
  console.log(failed[0].failureMessages[0].split("\n").slice(0, 8).join("\n"));
' "$proof/result.json"

cleanup
trap - EXIT

# Check 3: the working tree is exactly as it was.
[ "$(git status --porcelain=v1)" = "$before" ] || { echo "CHECK 3 FAILED: working tree changed"; exit 1; }
echo "CHECK 3 OK: working tree unchanged"

# Check 4: the real implementation still has the guard.
grep -q requestClose packages/ui/src/base/dialogs/form-dialog.tsx || { echo "CHECK 4 FAILED: requestClose missing"; exit 1; }
echo "CHECK 4 OK: active FormDialog contains requestClose"

# Check 5: the temporary worktree is gone.
if [ -e "$proof" ] || git worktree list --porcelain | grep -qF "$wt"; then
  echo "CHECK 5 FAILED: temporary worktree remains"; exit 1
fi
echo "CHECK 5 OK: temporary worktree removed"
```

Expected: the script exits 0 and prints `CHECK 1 OK` to `CHECK 5 OK`. For check 2, the printed failure message is `expected null not to be null`, and the first stack frame in `laundry-list-page.interaction.test.tsx` is the line of the test's item 2 assertion, the `dialog()` check after the first Escape. Confirm that line number against the file.

Record the failure message and all five verification results:
1. The baseline file contains no `requestClose`.
2. Exactly the new regression test fails, for the expected reason, at item 2.
3. The original working-tree status is unchanged.
4. The active implementation still contains `requestClose`.
5. The temporary worktree has been removed.

If `pnpm install --offline` cannot resolve from the local store, the script stops there. Rerun with `--offline` removed from that one line, and record that you did. If any check fails, stop and investigate. A failed check means the test does not yet prove the fix.

### Task 3: Full verification and execution record (type: `docs/process`)

TDD does not apply. The verification below and the Execution record replace it.

**Files:**
- Modify: this plan (append `## Execution record`)

- [ ] **Step 1: Run the CI-equivalent checks**

Run: `pnpm install --frozen-lockfile && pnpm run lint && pnpm --filter web exec tsc --noEmit && pnpm run test`
Expected: all succeed. `@clensy/ui` 96/96. `web` 48 files, 2185/2185 (baseline 2184 + 1). Record each command's actual result and every package's test totals.

- [ ] **Step 2: Account for every changed path (M5-3)**

Run: `git diff --name-only fcd1c6f HEAD | sort`
Every path in the output must belong to exactly one of the three groups below, and every listed path must appear. Record the full output and the group of each path in the Execution record. A path in no group, or a missing path, means stop and investigate. Do not filter paths out of the command.

- **#180 implementation** (Tasks 1 and 2), exactly:
  `apps/web/lib/laundry-list-page.interaction.test.tsx`, `packages/ui/package.json`, `packages/ui/src/base/dialogs/confirm-dialog.test.tsx`, `packages/ui/src/base/dialogs/form-dialog.test.tsx`, `packages/ui/src/base/dialogs/form-dialog.tsx`, `pnpm-lock.yaml`.
- **#180 workflow artifacts**, exactly:
  `docs/superpowers/specs/2026-08-17-dashboard-ux-foundation-design.md` (Amendment #180) and `docs/superpowers/plans/2026-10-16-form-dialog-submit-guard-plan.md` (this plan and its records).
- **Authorized workflow update** (owner request, commit `3a9c010`), exactly:
  `.claude/skills/workflow/SKILL.md`, `docs/workflows/conventions/configuration-change.md`, `docs/workflows/prompts/code-review.md`, `docs/workflows/prompts/design-review.md`, `docs/workflows/prompts/documentation-execution.md`, `docs/workflows/prompts/implementation-execution.md`, `docs/workflows/prompts/implementation-planning.md`, `docs/workflows/prompts/plan-review.md`, `docs/workflows/prompts/specification.md`, `docs/workflows/prompts/workflow-validation.md`, `docs/workflows/specs/agent-workflow-design.md`, `workflow.yaml`.

Then verify the groups separately:
- Implementation: `git diff --stat fcd1c6f HEAD -- packages apps pnpm-lock.yaml` lists only the six implementation paths. `git diff --quiet fcd1c6f HEAD -- packages/ui/src/base/modal.tsx packages/ui/src/internal/use-dialog-behavior.ts packages/ui/src/base/dialogs/confirm-dialog.tsx` exits 0, and no `FormDialog` caller appears.
- Workflow update: `git diff --name-only fcd1c6f HEAD -- .claude docs/workflows workflow.yaml` lists exactly the twelve paths above, and `git log --format=%h fcd1c6f..HEAD -- .claude docs/workflows workflow.yaml` prints only `3a9c010`, so no later commit touched them.

- [ ] **Step 3: Write the Execution record and the M6 Slice Completion Report, then commit**

Append `## Execution record` with each task's red and green results as actual output, and the Step 1 and Step 2 results. Then emit the M6 Slice Completion Report per `docs/workflows/conventions/reporting-conventions.md`, with Next Gate M7 (a fresh independent reviewer).

```bash
git add docs/superpowers/plans/2026-10-16-form-dialog-submit-guard-plan.md
git commit -m "docs(180): record M6 execution"
```

## Traceability

| Spec | Task |
| --- | --- |
| §8.3.1 items 1, 2, 4 (Escape, backdrop, single guard) | Task 1 Step 5; tests `ignores Escape…`, `ignores a backdrop click…` |
| §8.3.1 item 3 (Cancel disabled) | Task 1 `keeps Cancel disabled while submitting` |
| §8.3.1 item 5, §8.5 (no feedback, no replay, no `onClose`) | Task 1 `changes nothing visible…`, `does not replay…` |
| §8.3.1 item 7 (programmatic close) | Task 1 `still closes when the caller sets open to false…` |
| §8.3.2 (stacking) | Task 1 `consumes Escape…`, `lets Escape close a dialog on top…`, `closes only the top FormDialog…` |
| §8.3.3 (idle and after settling) | Task 1 idle tests and `closes on Escape and the backdrop again…` |
| §8.4, §8.5 (`ConfirmDialog`, `DetailDrawer` unchanged; no caller edits) | Task 1 Step 3; Task 3 Steps 1 and 2 |
| §8.8 (intake tests keep passing) | Task 2; Task 3 Step 1 |

## Deferred (not in this plan)

- `ConfirmDialog` refusing dismissal while `confirming` (spec §8.7). It needs a separate issue if it is wanted.
- Any docs change. M9 decides.

## Revision 2 (M5 review 1)

| Finding | Resolution |
| --- | --- |
| **M5-1** (required): the Task 2 proof overwrote a tracked file and restored it with `git checkout`, against the mutable `main` ref. | Task 2 now commits first (Step 3). The proof (Step 4) runs in a disposable detached worktree of `HEAD`, restores `FormDialog` from the pinned `fcd1c6f`, cleans up through a `trap` on any exit, and checks that the working tree and `requestClose` are unchanged afterwards. |
| **M5-2** (required): `pressEscape()` used whatever was focused, often `body`. | Replaced by `pressEscapeIn(element)`, which focuses the element, asserts it is active, and dispatches on it. Every `FormDialog` Escape uses `nameField()`. The stacked "dialog on top" test uses the top `Modal`'s button. Review Focus updated. |
| **M5-3** (required): the scope audit excluded `docs`, `.claude` and `workflow.yaml`, so it could not account for the whole branch. | Task 3 Step 2 lists every changed path against `fcd1c6f` with no filtering. It sorts each into #180 implementation, #180 workflow artifacts or the authorized workflow update (`3a9c010`), then verifies each group separately. |
| Non-blocking: fixture isolation. | `beforeEach` resets `state`, `closes` and the root. `afterEach` unmounts, so `openDialogStack` is empty between tests. |
| Non-blocking: lockfile verification. | Task 1 Step 1 records changed importers, added or removed packages, and a before/after `pnpm why jsdom --recursive` diff, instead of assuming which sections change. |
| Non-blocking: red-phase reporting and test totals. | Kept as is. Counts stay predictions, not pass criteria. |

## Revision 3 (M5 review 2)

| Finding | Resolution |
| --- | --- |
| **M5-4** (required): the worktree proof used `set -u` only, so a failed `git worktree add`, baseline restore or other unguarded command could be followed by later ones. The final instruction also counted four results instead of five. | Task 2 Step 4 now runs as a script under `set -euo pipefail`, with an idempotent `EXIT` trap. The only expected failure, vitest's, is captured into `status`. It counts as proof only if vitest exited non-zero, the JSON result exists, and exactly one test failed (the `#180` test, with `not to be null`, at item 2) and none passed. Each of the five checks prints `CHECK n OK` or exits non-zero, and the record instruction lists all five. |

## Revision 4 (M5 review 3)

| Finding | Resolution |
| --- | --- |
| **M5-4, cleanup edge case** (required): `cleanup` ran under `set -e`, so a failed `git worktree remove --force` could exit before `git worktree prune` and `rm -rf "$proof"`. | `cleanup` is now best-effort. `git worktree remove` and `git worktree prune` each end in `\|\| true`, and `rm -rf "$proof"` always runs. Check 5 is unchanged and still fails the proof if the worktree or its directory remains, so a cleanup failure is not hidden. |


## Execution record

### M6 — 2026-10-17

Executed inline (native), in plan order, on `feat/180-form-dialog-submit-guard` from the M5 acceptance commit `5af5094`. Every `Expected:` line was compared with the real output. Red-phase counts are the **actual** results, and each matched the prediction.

| Task | Commit | Red (actual) | Green (actual) |
| --- | --- | --- | --- |
| 1 | `17fd073` | `vitest run src/base/dialogs`: 5 failed, 10 passed (15). `form-dialog.test.tsx` 5 failed / 8 passed, `confirm-dialog.test.tsx` 2/2 passed. Four failed with `expected [ 'form' ] to deeply equal []`: `ignores Escape while submitting`, `ignores a backdrop click while submitting`, `does not replay a refused Escape when submitting ends` and `consumes Escape when the submitting FormDialog is on top`. `changes nothing visible when it refuses a dismissal` failed with `TypeError: Cannot read properties of null (reading 'parentElement')`, because the Escape had already closed the dialog. The plan allows this case ("or because the dialog is gone"). | `@clensy/ui` 9 files, 96/96. `lint` clean. `build` (`tsc --noEmit`) clean. |
| 2 | `f1ffc65` | Passes on arrival (regression test after the Task 1 fix). The worktree proof is below. | `laundry-list-page.interaction.test.tsx` 36/36. `eslint` on the file clean. |

**Task 1 Step 1, the jsdom dependency (actual):**
- `packages/ui/package.json` gained `"jsdom": "^29.1.1"`.
- `pnpm-lock.yaml` changed in one importer, `packages/ui`: its new `jsdom` devDependency at `29.1.1`, and its `vitest` peer variant moved from `jsdom@30.1.1` to `jsdom@29.1.1`.
- No package was added to or removed from `packages:` / `snapshots:`. The diff is 5 lines, +4/−1.
- `pnpm why jsdom --recursive` before and after differs only in `@clensy/ui`: it now resolves `jsdom@29.1.1` directly and through vitest, where before it came through vitest's `30.1.1` variant. `web`, `@clensy/client`, `@clensy/validation` and `@clensy/web` are unchanged.
- The install's `unmet peer graphql` warnings are pre-existing and unrelated.

**Task 2 Step 4, the worktree red proof (actual):** the script was extracted verbatim from this plan, run with `bash`, and exited 0.
1. `CHECK 1 OK`: the baseline `FormDialog` from `fcd1c6f` has no `requestClose`.
2. `CHECK 2 OK`: vitest reported 1 failed and 35 skipped. The failure was the `#180` test, with `AssertionError: expected null not to be null` at `laundry-list-page.interaction.test.tsx:815:26`. Line 815 is the test's item 2 assertion, `expect(dialog()).not.toBeNull()` right after the first Escape.
3. `CHECK 3 OK`: the working-tree status is unchanged.
4. `CHECK 4 OK`: the active `FormDialog` contains `requestClose`.
5. `CHECK 5 OK`: the temporary worktree has been removed.

`pnpm install --frozen-lockfile --offline` succeeded, so the online fallback was not needed.

**Characterization tests.** M6 ([implementation-execution.md](../../workflows/prompts/implementation-execution.md) step 3.6) requires each characterization test to fail against a deliberate break made outside the committed change. The plan labels the [C] tests but did not plan that run, so it was added (ruling 2). The run used a disposable detached worktree of `17fd073`, with the same `set -euo pipefail`, best-effort cleanup and checks as the Task 2 proof. One mutation was applied at a time, `src/base/dialogs` was run, and the source was reverted before the next mutation.

| Mutation | [C] tests that failed |
| --- | --- |
| M1 `requestClose` never calls `onClose` | `closes on Escape when idle`, `closes on a backdrop click when idle`, `closes on Cancel when idle`, `closes on Escape and the backdrop again once submitting is false`, `closes only the top FormDialog when idle and stacked` |
| M2 Cancel not `disabled` while submitting | `keeps Cancel disabled while submitting` |
| M3 `Modal open={open \|\| submitting}` | `still closes when the caller sets open to false while submitting, and restores focus` |
| M4 the hook routes Escape to the bottom dialog | `lets Escape close a dialog on top of a submitting FormDialog`, `closes only the top FormDialog when idle and stacked` (and the non-[C] `consumes Escape…`) |
| M5 `ConfirmDialog` guards `onClose` while `confirming` | `still closes on Escape while confirming`, `still closes on a backdrop click while confirming` |

All 10 [C] tests failed under at least one mutation. Afterwards the working tree was unchanged and the worktree was removed. No mutation was committed.

**Rulings (deviations from the plan's text):**
1. Task 1: the first red run had a 6th failure, in the programmatic-close [C] test. The cause was an assertion I had added beyond the plan, that focus lands on the Name field after opening. jsdom always reports `offsetParent === null`, so the hook's focusable filter finds nothing and focuses the dialog container. I removed that one assertion, and the plan's assertions for the test are unchanged. The re-run matched the prediction exactly.
2. Task 1: the characterization mutation run above was added to satisfy M6 step 3.6. It changes no task, order or semantics.
3. Task 1: `contextforge/function-order` applies to test files under `packages/ui/src`, so the test file's top-level helpers are declared in name order. This is lint conformance, not a plan change.

### Task 3 — verification (actual results)

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS. Lockfile up to date. |
| `pnpm run lint` | PASS. turbo 6/6 tasks. |
| `pnpm --filter web exec tsc --noEmit` | PASS, exit 0 |
| `pnpm run test` | PASS. turbo 10/10 tasks: `@clensy/ui` 9 files 96/96; `web` 48 files 2185/2185 (baseline 2184 + 1); `@clensy/web` 16 files 418/418; `@clensy/validation` 6 files 79/79; `@clensy/client` 2 files 13/13; `api` 75 suites 1071/1071. |
| Scope (Step 2) | PASS. `git diff --name-only fcd1c6f HEAD` lists 20 paths, and each falls in exactly one group. **#180 implementation (6):** `apps/web/lib/laundry-list-page.interaction.test.tsx`, `packages/ui/package.json`, `packages/ui/src/base/dialogs/confirm-dialog.test.tsx`, `packages/ui/src/base/dialogs/form-dialog.test.tsx`, `packages/ui/src/base/dialogs/form-dialog.tsx`, `pnpm-lock.yaml`. **#180 workflow artifacts (2):** the spec (Amendment #180) and this plan. **Authorized workflow update (12):** exactly the twelve listed paths. `git diff --quiet` on `modal.tsx`, `use-dialog-behavior.ts` and `confirm-dialog.tsx` exits 0, and no `FormDialog` caller changed. Only `3a9c010` touched the workflow-update paths. |

Not run: a manual browser check of a `FormDialog` page. It is not required by the plan or by spec §8.8. An owner may do it at M7 or before merge.

## Gate outcomes

### M7 — Code Review (2026-10-17)

**Reviewer:** a fresh, independent, read-only agent on the most capable model (Opus 5.5). It did not write the change and made no changes to the repository. It reviewed `fcd1c6f..6385a0d` against the Accepted spec (Amendment #180), this plan, its Execution record, the ledger rulings and issue #180. **This is not a self-review.** It satisfies the `CLAUDE.md` M7 rule for application-code slices.

```text
Decision: Approved for merge
Subject: PR #192, branch feat/180-form-dialog-submit-guard, fcd1c6f..6385a0d
Accepted specification: docs/superpowers/specs/2026-08-17-dashboard-ux-foundation-design.md §8 (Amendment #180)
Accepted implementation plan: docs/superpowers/plans/2026-10-16-form-dialog-submit-guard-plan.md (revision 4)
Live configuration: n/a (application-code slice)

Plan tasks reviewed:
- Task 1: ✓ (17fd073)
- Task 2: ✓ (f1ffc65; worktree proof in the Execution record)
- Task 3: ✓ (656b134, 6385a0d)

Verification evidence (re-run by the reviewer):
- pnpm install --frozen-lockfile --offline: lockfile up to date
- pnpm --filter @clensy/ui exec vitest run: 9 files, 96/96
- pnpm --filter @clensy/ui lint / build: clean
- pnpm --filter web exec vitest run lib/laundry-list-page.interaction.test.tsx: 36/36
- pnpm --filter web exec tsc --noEmit: exit 0
- Scope: modal.tsx, use-dialog-behavior.ts, confirm-dialog.tsx and detail-drawer.tsx are unchanged; only 3a9c010 touches the workflow paths, and it holds no code
- gh pr checks 192 (run 38936748082): Lint, Test, Release gate and API e2e all pass (API e2e confirmed green after the review)
- Not re-run: the worktree red proof and the [C] mutation run (Execution record evidence accepted)

Review summary: requestClose (form-dialog.tsx:35-38) is the single guard, passed to Modal's onClose and to Cancel. FormDialogProps is unchanged, no caller was edited, and open stays caller-owned. Every Review Focus item was checked: no stale guard (the keydown effect re-subscribes on onClose identity, as it already did for callers' inline arrows), no replay, field Escape bubbles, stacking consumes, programmatic close restores focus. All 9 callers pass submitting. The lockfile change is minimal. The [C] labels are honest, and all three rulings are sound.
Blocking findings: None (no merge blockers)

Non-blocking observations:
- use-dialog-behavior.ts:76-130: the Escape closure refreshes in a passive effect, a theoretical window that predates #180 and is negligible for discrete events. Fixing it would touch the hook (out of plan scope).
- form-dialog.test.tsx:200 does not combine a refused press with the later close. The full sequence is covered end to end in laundry-list-page.interaction.test.tsx:805-824.
- §8.3.1 item 6 (focus trap while submitting) has no new ui test, because of the jsdom offsetParent limitation. The hook is unchanged.
- The hook does not stop Escape propagation to non-dialog document listeners (pre-existing; the spec is satisfied).
- @clensy/ui uses jsdom 29 like apps/web, while other importers resolve vitest's jsdom 30.1.1 (harmless, per decision (b)).

Gate: Merge per human/project norms. M8/M9 may follow.
```

**Triage of the non-blocking observations** (implementer, recorded for the owner):
- **Passive-effect window:** pre-existing hook behavior, outside #180's scope. It would need a hook change and its own issue if the owner wants it.
- **Combined refused-then-close ui test, and the focus trap while submitting:** both are test-only gaps already covered by other means (the web regression test, and the unchanged hook). Not fixed in this slice, so the Accepted scope is kept.
- **Propagation, and the jsdom version split:** no action.

### M8 — Refactoring: N/A (2026-10-17)

Scope considered: `packages/ui/src/base/dialogs/form-dialog.tsx` and the two new test files. The production change is one 4-line guard, with nothing to extract or deduplicate. The test helpers are already small and single-purpose. The only refactor-shaped idea from M7, a ref-held latest callback in `use-dialog-behavior.ts`, is outside the plan's ownership boundary. It also changes event-timing behavior, so it is not behavior-preserving M8 work. **N/A**: no worthwhile behavior-preserving improvement in scope.

### M9 — Documentation: Complete (2026-10-17)

Scope (exact paths): `apps/web/README.md`, `docs/superpowers/plans/2026-10-13-laundry-intake-modal-plan.md` and this plan's status and records.

| Change | Kind | Caused by |
| --- | --- | --- |
| `apps/web/README.md` § Laundry intake: a new **Pending create** bullet. While the create is in flight, Escape and the backdrop don't close the dialog and Cancel is disabled, so a failure always shows. It links #180 and Amendment #180 §8.3. | Content | Shipped behavior (Task 1, verified by Task 2) |
| Laundry Intake Modal plan, T5-a follow-up line: "resolved there by PR #192" plus a link to this plan | Content (cross-link) | #180 resolution |
| This plan's Status row: M7, M8, M9 and M10 positions | Content (status) | Gate outcomes above |

Not changed: `packages/ui/README.md`. It documents layout and the export surface, not primitive behavior, so there is nothing stale there. The spec's Amendment #180 status rows already read Accepted.

Editorial verification: the new relative links resolve (`../../docs/superpowers/specs/2026-08-17-dashboard-ux-foundation-design.md` from `apps/web/`, and `2026-10-16-form-dialog-submit-guard-plan.md` from `docs/superpowers/plans/`). Heading hierarchy is unchanged. There are no contradictory statements: the intake plan's "Escape … can close the dialog while a create is pending" is now marked resolved. Status is consistent: spec Amendment Accepted, plan Accepted, M7 Approved. Terms follow §8.2 ("user-initiated dismissal", "submitting").

