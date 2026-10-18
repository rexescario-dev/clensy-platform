# React Hooks Lint Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Draft, revision 2** (M4), 2026-10-19. Ready for M5 Plan Review (second pass). |
| M5 history | First pass (2026-10-19, owner, reviewed `e82fe07` verbatim): **Returned for Revision**, findings M5-1 to M5-3 (P1) and M5-4 (P2). All are addressed in [Revision 2 (M5 review 1)](#revision-2-m5-review-1). The owner confirmed as sound: `^7.1.1` (confirmed 7.1.x and passing the compatibility cases), one unscoped config object after the managed spread, the inventory re-run on the branch before the configuration commit with the owner gate, red/green through the real lint scripts, exact rule IDs and lines for cases A–C, a labelled M7 self-review, and an authorized draft PR with no merge. |
| Date | 2026-10-18 |
| Tracking issue | [#196](https://github.com/rexescario-dev/clensy-platform/issues/196) "Enforce React Hooks lint rules in the React workspaces" |
| Spec | [React Hooks Lint Rules](../specs/2026-10-18-react-hooks-lint-rules-design.md), Status **Accepted** (M3, 2026-10-18, revision 2, recorded at `2ed3b9f`). The M3 constraints are carried here: the finding inventory is completed before any lint configuration is committed (Task 1 Step 4, before Step 9), and every acceptance claim comes from an actual run. |
| Relies on | The `Lint` job in `.github/workflows/ci.yml` (`pnpm run lint`) and its required status on `main` ([Required CI Checks](../specs/2026-10-06-required-ci-checks-design.md), Accepted), unchanged. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. File names, step order and commit wording are planning decisions. |
| Branch | `feat/196-react-hooks-lint-rules`, from `main` at `d5d845e`, carrying the spec (`fe96b24`, `3e42a14`, `2ed3b9f`) and this plan. One PR for the spec, this plan, its gate records and the configuration (process spec §2.8). `BASE=$(git merge-base HEAD origin/main)`. |
| Scope | Exactly: `apps/web/eslint.config.mjs`, `packages/ui/eslint.config.mjs`, `packages/web/eslint.config.mjs`, the same three `package.json` files, `pnpm-lock.yaml`, plus the spec and this plan. **No** change to `tooling/eslint.contextforge.mjs`, CI, Turbo, lint scripts, any other workspace, or any production or test source (spec §5 invariants 3, 8). |
| Task types | Task 1 `code` (in-repo ESLint configuration, verified by running ESLint). Task 2 `docs/process`. Task 3 `docs/process` (PR and CI evidence). No `configuration` task: nothing outside the repository changes. |
| Characterization tests | None. This plan labels no characterization tests, so the 1.6.0 break rule records nothing (M4 step 9). |
| Baseline | `main` at `d5d845e`: no `eslint-plugin-react-hooks` in any `package.json` or in `pnpm-lock.yaml`. |
| Pre-validation | **Partial.** A throwaway planning probe ran in a disposable worktree at `2ed3b9f`, under the session scratchpad, and was then removed (`git worktree remove --force`, `git worktree prune`; main checkout `git status` clean). It installed `eslint-plugin-react-hooks@7.1.1` in the three workspaces and added the Task 1 Step 3 block. Results: (1) **inventory**: `eslint -f json` over each `lint` target found **0 messages of any kind** (`apps/web` 113 files, `packages/ui` 37, `packages/web` 44); (2) **effective rules** (`--print-config`, `react-hooks/*` keys): exactly `{"react-hooks/rules-of-hooks":[2],"react-hooks/exhaustive-deps":[2]}` on all six Task 1 Step 6 files; (3) **`useEffectEvent` cases** in all three workspaces: A no message, B `react-hooks/rules-of-hooks` at line 14 (the call), C `react-hooks/exhaustive-deps` at line 22. **Not run:** Step 1 and Step 5 through the `lint` scripts, the `^7.1.1` range (the probe wrote an exact `7.1.1`), root `pnpm run lint`, the test suites, Task 2 and Task 3. The probe is planning evidence only. M6 re-runs every check on the branch and records its own results. |
| M7 | Configuration-only slice: `CLAUDE.md` permits a labelled **self-review**. The owner may still ask for a fresh reviewer. |

**Goal:** `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps`, and no other `react-hooks/*` rule, run at `error` in `apps/web`, `packages/ui` and `packages/web`, so the required `Lint` check fails on any violation.

**Architecture:** Each project-owned `eslint.config.mjs` imports the plugin and adds one config object, `{ plugins: { 'react-hooks': reactHooks }, rules: { … } }`, right after the managed `contextforgeJavascript(...)` spread. The object has no `files` key, so it applies to everything the workspace's `lint` script lints, including test files and the `.ts` files with hooks. No preset is spread. Each workspace declares `eslint-plugin-react-hooks` `^7.1.1` as a devDependency.

**Tech Stack:** ESLint 9.39.5 (flat config, `typescript-eslint` `tseslint.config`), `eslint-plugin-react-hooks` 7.1.1, React 19.2.8, pnpm workspaces, Turbo.

## Global Constraints

- Exactly the two rules, both `'error'`. No `reactHooks.configs.*` spread and no rule options (spec §5 invariants 1–2).
- `tooling/eslint.contextforge.mjs` is not edited (invariant 3).
- No `eslint-disable`, no `off` or `warn`, no `files`/`ignores` narrowing, anywhere in the diff (invariant 6).
- Throwaway files are never committed. Each is removed with a literal or `${VAR:?}`-guarded path (invariants 5, 7).
- If any step finds a `react-hooks/*` finding on existing code, stop at the invariant 6 gate (Task 1 Step 4) and do not commit the configuration.

## Planning decisions for M5 to confirm

- **(a) Version `^7.1.1`.** It is the latest stable release (2026-04-17), it is within #196's floor of 6, its peer range covers ESLint 9, and the probe shows its installed behavior passes invariant 7. The caret matches the workspaces' other devDependencies. M6 re-verifies the behavior on the version the lockfile actually resolves.
- **(b) One unscoped config object per workspace**, placed after the managed spread. Without `files`, it covers exactly what each `lint` script lints (`apps/web`: `.`; the packages: `src`). That includes the `.ts` hook files and the test files, so invariant 1 holds for test files without a second block.
- **(c) The inventory runs in M6, on the branch, before the configuration commit** (spec §8 left this to M4). The planning probe already found 0 findings at `d5d845e`. Task 1 Step 4 re-takes the inventory against the branch's actual base, in case `main` has moved. That is the authoritative inventory.
- **(d) Red then green through the real `lint` scripts.** Before the configuration, a throwaway violation of each rule passes `pnpm --filter <ws> lint`, which shows the rules are not yet active. After it, the same files fail with each rule's ID (invariant 5).
- **(e) CI evidence is part of M6, verified on the final head (M5-1, M5-3).** Invariant 9 (`Lint` passes on the PR head) needs a pushed branch and an open PR. The owner authorized opening the PR for #196 (2026-10-18). Task 3 pushes, opens it as a draft and verifies the required checks. Any commit changes the head SHA, so evidence is tied to a SHA: the checks on the first pushed head `H1` are recorded in one commit `H2`, and then the required checks are verified again on `H2` itself, the final M6 head. The M6 Slice Completion Report is **emitted in the conversation, not committed**, and only after `H2` passes. No committed text claims a result that was not yet observed. The M7 record later cites `H2`'s checks. Task 3 does not merge.

## Review Focus

- **`.ts` files that call hooks** (for example `apps/web/lib/use-detail-drawer.ts`) must be linted by both rules, not only `.tsx`. Decision (b) covers them. Task 1 Step 4's inventory runs over the full `lint` targets.
- **Test files** must get the same two rules. Task 1 Step 6 checks a test file in every workspace.
- **A future installer update** that adds `react-hooks` to the managed fragment would merge with these blocks. Out of scope here. Task 1 Step 6's exact-set check is the guard for this slice.
- **`apps/web`'s `no-restricted-imports` block** must keep working. Task 2 Step 1's full lint run covers it.
- **Lockfile drift:** `pnpm install --frozen-lockfile` must pass on a clean install. Task 2 Step 1.

---

### Task 1: Enable the two rules in the three React workspaces (type: `code`)

Implements spec §2 items 1–4 and §5 invariants 1–7. Planning decisions (a)–(d).

**Files:**
- Modify: `apps/web/eslint.config.mjs`, `packages/ui/eslint.config.mjs`, `packages/web/eslint.config.mjs`
- Modify: `apps/web/package.json`, `packages/ui/package.json`, `packages/web/package.json`, `pnpm-lock.yaml`
- Throwaway, never committed: `apps/web/lib/zz-hooks-probe.tsx`, `packages/ui/src/zz-hooks-probe.tsx`, `packages/web/src/zz-hooks-probe.tsx`

**Interfaces:** none. ESLint configuration only.

- [ ] **Step 1: Red — show the rules are not active yet**

Write the throwaway violation file below into each of the three paths. Its body is fixed, because the expected line numbers depend on it:

```tsx
import { useEffect, useState } from 'react';

export function HooksProbe({ on, value }: { on: boolean; value: number }) {
  if (on) {
    useState(0);
  }
  const [, setSeen] = useState(0);
  useEffect(() => {
    setSeen(value);
  }, []);
  return null;
}
```

Run: `pnpm --filter web lint`, `pnpm --filter @clensy/ui lint`, `pnpm --filter @clensy/web lint` (the package names of `apps/web`, `packages/ui` and `packages/web`).
Expected: each exits 0, with no `react-hooks/*` message, because the rules are not configured yet. Record the output, then remove the three files with literal paths. `git status --short` shows nothing.

- [ ] **Step 2: Install the plugin per workspace**

Run, for each of `web`, `@clensy/ui` and `@clensy/web`: `pnpm --filter <name> add -D 'eslint-plugin-react-hooks@^7.1.1'`.
Expected: each `package.json` gains `"eslint-plugin-react-hooks": "^7.1.1"` in `devDependencies`, and `pnpm-lock.yaml` changes. Record the resolved version from `pnpm --filter <ws> list eslint-plugin-react-hooks`. If it resolves to anything other than 7.1.x, stop: invariant 7 was probed on 7.1.1 only.

- [ ] **Step 3: Add the config object to each `eslint.config.mjs`**

Add `import reactHooks from 'eslint-plugin-react-hooks';` after the `globals` import. Then insert this object right after the `...contextforgeJavascript({ eslint, tseslint }),` line:

```js
  {
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
    },
  },
```

Add nothing else. Do not stage yet.

- [ ] **Step 4: Inventory — the invariant 6 gate (before any commit of Steps 2–3)**

Run, in each workspace directory: `npx eslint -f json <lint target> > <scratchpad>/inv-<ws>.json`, where the target is `.` for `apps/web` and `src` for the packages. Then, on each file: `jq length` (files linted) and `jq -c '[.[] | .messages[]] | {all: length, hooks: map(select((.ruleId // "") | startswith("react-hooks/"))) | length}'`.
Expected (from the probe): `hooks` 0 in every workspace. Record the files linted, all messages and `react-hooks/*` messages for each workspace.
- If `hooks` > 0 anywhere: list every finding (workspace, file, line, rule ID, message) and classify it (a) or (b) per spec §5 invariant 6.2. Class (a) only: fix it in test-only code or configuration, re-run this step, and record the fix. **Any class (b): stop.** Do not commit. Present the findings, the files and a draft issue for each to the owner, and wait for the owner's choice of path (invariant 6.3).
- Any non-`react-hooks` message: stop and investigate. Step 1 showed lint passing before the change.

- [ ] **Step 5: Green — the rules are active (invariant 5)**

Recreate the Step 1 file in each workspace and run each workspace's `lint` script again.
Expected: each exits non-zero, with `react-hooks/rules-of-hooks` at line 5 and `react-hooks/exhaustive-deps` at line 10 of `zz-hooks-probe.tsx`. Record both rule IDs and lines per workspace. Then remove the three files with literal paths. `git status --short` lists only the Step 2–3 files.

- [ ] **Step 6: Effective rule set (invariant 1)**

For each pair, run `npx eslint --print-config <file> | jq -c '.rules | with_entries(select(.key | startswith("react-hooks/")))'` from the workspace directory:

| Workspace | Non-test `.tsx` | Test file |
| --- | --- | --- |
| `apps/web` | `app/apollo-provider.tsx` | `lib/laundry-list-page.interaction.test.tsx` |
| `packages/ui` | `src/base/modal.tsx` | `src/base/dialogs/form-dialog.test.tsx` |
| `packages/web` | `src/bookings/booking-data-table.tsx` | `src/bookings/booking-data-table.test.tsx` |

Expected for all six: exactly `{"react-hooks/rules-of-hooks":[2],"react-hooks/exhaustive-deps":[2]}`. Any other key, or any other severity, fails the check. Record each path and output.

- [ ] **Step 7: `useEffectEvent` cases (invariant 7)**

Write this throwaway file at the three `zz-hooks-probe.tsx` paths (its body is fixed for the line numbers), run `npx eslint -f json <path> | jq -c '[.[0].messages[] | {ruleId, line}]'` in each workspace, then remove the files with literal paths:

```tsx
import { useEffect, useEffectEvent, useState } from 'react';

export function CaseA({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeOnEscape = useEffectEvent(() => onClose());
  useEffect(() => {
    if (!open) return;
    closeOnEscape();
  }, [open]);
  return null;
}

export function CaseB({ onClose }: { onClose: () => void }) {
  const closeNow = useEffectEvent(() => onClose());
  closeNow();
  return null;
}

export function CaseC({ value }: { value: number }) {
  const [, setSeen] = useState(0);
  useEffect(() => {
    setSeen(value);
  }, []);
  return null;
}
```

Expected in every workspace: exactly `[{"ruleId":"react-hooks/rules-of-hooks","line":14},{"ruleId":"react-hooks/exhaustive-deps","line":22}]`. Case A (lines 3–10) has no message; B is the call on line 14; C is the control on line 22. Record the plugin version from Step 2 and each workspace's output. Any difference: stop. The version does not satisfy spec §2 item 1.

- [ ] **Step 8: Managed fragment unchanged (invariant 3)**

Run: `git diff --quiet -- tooling/eslint.contextforge.mjs && awk '/- path:/{p=$3} /digest:/{print substr($2,8)"  "p}' workflow.yaml | grep 'tooling/eslint.contextforge.mjs' | sha256sum -c`
Expected: exit 0, and `tooling/eslint.contextforge.mjs: OK`.

- [ ] **Step 9: Commit**

Only after Steps 4–8 pass:

```bash
git add apps/web/eslint.config.mjs packages/ui/eslint.config.mjs packages/web/eslint.config.mjs apps/web/package.json packages/ui/package.json packages/web/package.json pnpm-lock.yaml
git commit -m "build(196): enforce rules-of-hooks and exhaustive-deps in the React workspaces"
```

### Task 2: Full verification and execution record (type: `docs/process`)

TDD does not apply. The checks below and the Execution record replace it.

**Files:** Modify this plan (append `## Execution record`).

- [ ] **Step 1: CI-equivalent checks**

Run: `pnpm install --frozen-lockfile && pnpm run lint && pnpm run test`
Expected: all exit 0. Record each command's actual result and every package's test totals. Tests are run to show no behavior change (spec §5 invariant 8), not as evidence for the rules.

- [ ] **Step 2: Changed paths (invariant 8) and no suppression (invariant 6)**

Four checks; all must pass before the Execution record may say the file boundary held (M5-4).

1. **Working tree clean, nothing untracked:** `git status --porcelain --untracked-files=all` prints nothing. `test ! -e apps/web/lib/zz-hooks-probe.tsx && test ! -e packages/ui/src/zz-hooks-probe.tsx && test ! -e packages/web/src/zz-hooks-probe.tsx` exits 0. This catches leftover probe files and staged or unstaged edits that the committed diff alone would miss.
2. **Committed diff against the base:** `git diff --name-only "$BASE" HEAD | sort`. Expected: exactly `apps/web/eslint.config.mjs`, `apps/web/package.json`, `docs/superpowers/plans/2026-10-18-react-hooks-lint-rules-plan.md`, `docs/superpowers/specs/2026-10-18-react-hooks-lint-rules-design.md`, `packages/ui/eslint.config.mjs`, `packages/ui/package.json`, `packages/web/eslint.config.mjs`, `packages/web/package.json`, `pnpm-lock.yaml`. Any other path: stop.
3. **No suppression and no preset:** `git diff "$BASE" HEAD -- '*.mjs' '*.ts' '*.tsx' | grep -nE "^\+.*(eslint-disable|'off'|'warn'|ignores:|files:)"` prints nothing, and `git diff "$BASE" HEAD -- '*.mjs' | grep -n 'configs'` prints nothing.
4. **Managed fragment, independently:** `git diff --quiet "$BASE" HEAD -- tooling/eslint.contextforge.mjs` exits 0, and the Task 1 Step 8 digest command reports `tooling/eslint.contextforge.mjs: OK` on the committed tree.

- [ ] **Step 3: Write the Execution record, then commit (no completion report yet)**

Append `## Execution record` with the actual output of Task 1 Steps 1–8 and Task 2 Steps 1–2. Mark each check as passed, failed or **not yet run**. Invariant 9 is recorded as not yet run. Do **not** emit the M6 Slice Completion Report here (M5-1): M6 is not complete until Task 3 Step 3.

```bash
git add docs/superpowers/plans/2026-10-18-react-hooks-lint-rules-plan.md
git commit -m "docs(196): record M6 execution"
```

### Task 3: Draft PR, required checks on the final head, M6 report (type: `docs/process`)

Implements spec §5 invariant 9. Planning decision (e). Outward-facing, authorized by the owner on 2026-10-18 ("Open the PR and wait for #196 to merge through the normal process"). Not authorized: merging, marking the PR ready, or any change to repository settings.

**Required checks:** `Lint`, `Test`, `Release gate`, `API e2e` ([Required CI Checks](../specs/2026-10-06-required-ci-checks-design.md)).

**Failure path (applies to Steps 2 and 3, M5-2).** If any required check is failed, missing, pending past its normal run time, or cannot be tied to the SHA being verified, record its actual state and the observed `headRefOid`. Then stop and report the blocker to the owner. Do not claim M6 complete, do not emit the M6 Slice Completion Report or an M7 hand-off, and do not merge. Resume only after the blocker is resolved, and then verify the required checks again on the resulting head.

- [ ] **Step 1: Push and open a draft PR (head `H1`)**

Run: `git push -u origin feat/196-react-hooks-lint-rules`, then `gh pr create --draft --base main`. The body links #196 and the spec and plan, says the PR is a draft with M6 in progress, and makes no claim about checks. Per the user's global instructions, the body and commits carry no Claude attribution trailer. Record `H1=$(git rev-parse HEAD)` and the PR URL.

- [ ] **Step 2: Verify the checks on `H1`, then record them in one commit (`H2`)**

After the checks finish, run `gh pr view <pr> --json headRefOid,mergeStateStatus,statusCheckRollup` and `gh pr checks <pr> --required`.
Acceptance on `H1`: `headRefOid` equals `H1`, and all four required checks are `SUCCESS`, each with its check-run name and conclusion recorded. Otherwise, take the failure path.
Then append the `H1` results, with the SHA, to the Execution record. That is the only edit. Commit with `docs(196): record the PR checks on H1` and push. Record `H2=$(git rev-parse HEAD)`. The Execution record states that `H1`'s results do not cover `H2`.

- [ ] **Step 3: Verify the checks on the final head `H2`, then emit the M6 report (not committed)**

After the checks for `H2` finish, run the same two commands.
Acceptance on `H2`: `headRefOid` equals `H2`, all four required checks are `SUCCESS`, and `git diff --name-only "$BASE" H2` still lists exactly the Task 2 Step 2 allowlist. Otherwise, take the failure path.
Only then emit the **M6 Slice Completion Report** in the conversation, per `docs/workflows/conventions/reporting-conventions.md`. It cites `H2`, the PR URL and each required check's conclusion on `H2`, with Next Gate M7 (labelled self-review permitted). It is **not** committed, because any commit would create a head that `H2`'s checks do not cover. The M7 record, the next commit on this branch, carries `H2`'s check results into the plan. The `main` ruleset's strict up-to-date policy re-verifies the eventual merge head in any case.
Do not merge. Merging belongs to closeout, after M7–M9.

## Traceability

| Spec | Task |
| --- | --- |
| §2 item 1; invariant 4 (per-workspace dependency, lockfile agrees) | Task 1 Step 2; Task 2 Step 1 |
| §2 item 2; invariants 1–2 (exactly two rules at `error`, no preset) | Task 1 Steps 3, 6; Task 2 Step 2 |
| Invariant 3 (managed fragment unchanged) | Task 1 Step 8; Task 2 Step 2 |
| Invariant 5 (rules demonstrably active) | Task 1 Steps 1, 5 |
| Invariant 6 (inventory, classification, owner gate, no suppression) | Task 1 Step 4; Task 2 Step 2 |
| Invariant 7 (`useEffectEvent` A/B/C on the installed version) | Task 1 Steps 2, 7 |
| Invariant 8 (only the listed files change) | Task 2 Step 2 (working tree, untracked files, committed diff, managed fragment); Task 3 Step 3 (diff at `H2`) |
| Invariant 9 (`Lint` passes in CI) | Task 3 Steps 2–3, verified on the final head `H2`, with the failure path |
| M3 constraints (inventory before the configuration commit; evidence from actual runs) | Task 1 Steps 4 and 9; every Execution record entry |

## Deferred

- React Compiler–derived rules (spec §8).
- `useEffectEvent` adoption: #193, which resumes after this PR merges, and the AppSidebar follow-up.

## Revision 2 (M5 review 1)

M5 first pass (owner, 2026-10-19, reviewed `e82fe07` verbatim): **Request changes**.

| Finding | Resolution |
| --- | --- |
| M5-1 (P1) The M6 report precedes the CI evidence | Task 2 Step 3 now writes and commits only the Execution record, with invariant 9 marked not yet run. The M6 Slice Completion Report moves to Task 3 Step 3, after the checks pass on the final head. |
| M5-2 (P1) No stop path for failed or missing checks | Task 3 has an explicit failure path for Steps 2 and 3. A check that is failed, missing, pending or not tied to the SHA leads to recording its actual state and the observed SHA, then stopping and reporting the blocker. No M6-complete claim, no report or M7 hand-off, no merge. Checks are verified again on the resulting head after any fix. |
| M5-3 (P1) The check-recording commit invalidates the evidence | The evidence is tied to SHAs. `H1`'s checks are recorded in one commit, `H2`. The checks are then verified again on `H2` itself, with `headRefOid` matched. The M6 report is emitted in the conversation and not committed, so no commit follows the verified head inside M6. The M7 record carries `H2`'s results. |
| M5-4 (P2) The file-boundary check misses uncommitted and untracked files | Task 2 Step 2 now has four checks: the working tree is clean including untracked files, with explicit `test ! -e` checks for the three probe files; the committed diff matches the allowlist; there is no suppression or preset; and the managed fragment is unchanged against the base, with its digest re-checked. Task 3 Step 3 re-checks the diff at `H2`. The Execution record distinguishes passed checks from those not yet run. |

