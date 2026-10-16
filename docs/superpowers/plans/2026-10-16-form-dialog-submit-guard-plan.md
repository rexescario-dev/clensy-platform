# Form Dialog Submit Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Draft (revision 3)** (M4), 2026-10-17. Awaiting Plan Review (M5). |
| M5 history | First pass (2026-10-17, owner, reviewed `af0dd9b`): **Returned for Revision**, required revisions M5-1 to M5-3 and four non-blocking items. All are resolved in [Revision 2 (M5 review 1)](#revision-2-m5-review-1). The owner approved the `requestClose` architecture and the `ConfirmDialog` characterization tests without changes. Second pass (2026-10-17, owner, reviewed `2e9a298`): **Returned for Revision**, one final correction, M5-4. M5-1 to M5-3 and the non-blocking items are recorded as resolved. M5-4 is resolved in [Revision 3 (M5 review 2)](#revision-3-m5-review-2). |
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

The script runs with `set -euo pipefail`, so any failed setup, check or cleanup command stops it with a non-zero exit. The `EXIT` trap removes the worktree on every exit path. The one expected failure, vitest's, is captured explicitly and then verified to be the right failure. Save the script to a scratch file outside the repository and run it with `bash <file>` from the repository root, so `exit` ends the script and not your shell.

```bash
set -euo pipefail
before="$(git status --porcelain=v1)"
proof="$(mktemp -d)"
wt="$proof/wt"
cleanup() {
  if [ -d "$wt" ]; then git worktree remove --force "$wt"; fi
  git worktree prune
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

