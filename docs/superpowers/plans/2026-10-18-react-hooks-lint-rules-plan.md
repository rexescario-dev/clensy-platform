# React Hooks Lint Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Accepted (revision 5)** at M5, 2026-10-19. M6 in progress. |
| M5 decision | **Accepted** — 2026-10-19, revision 5 (`70180fb`), by the owner ("accept. m6"). Execution: native, in this session. The acceptance is not a claim that any check has passed. Every result is recorded from actual runs in the Execution record. |
| M5 history | First pass (2026-10-19, owner, reviewed `e82fe07` verbatim): **Returned for Revision**, findings M5-1 to M5-3 (P1) and M5-4 (P2). All are addressed in [Revision 2 (M5 review 1)](#revision-2-m5-review-1). Second pass (2026-10-19, owner, reviewed the `081a660` text): **Returned for Revision**, findings M5-5 (P1) and M5-6 (P2). M5-1 to M5-4 are recorded as accepted. Both are resolved in [Revision 3 (M5 review 2)](#revision-3-m5-review-2). Third pass (2026-10-19, owner, reviewed the `449a79f` text): **Returned for Revision**, finding M5-7 (P1). M5-1 to M5-6 are recorded as resolved. It is resolved in [Revision 4 (M5 review 3)](#revision-4-m5-review-3). Fourth pass (2026-10-19, owner, reviewed `48f8ad6`): **Returned for Revision**, finding M5-8 (P1). M5-1 to M5-7 are recorded as resolved. It is resolved in [Revision 5 (M5 review 4)](#revision-5-m5-review-4). Fifth pass (2026-10-19, owner, revision 5 at `70180fb`): **Accepted**. The owner confirmed as sound: `^7.1.1` (confirmed 7.1.x and passing the compatibility cases), one unscoped config object after the managed spread, the inventory re-run on the branch before the configuration commit with the owner gate, red/green through the real lint scripts, exact rule IDs and lines for cases A–C, a labelled M7 self-review, and an authorized draft PR with no merge. |
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

**Head-pinned check verification `V(sha)` (M5-5, M5-7, M5-8), used in Steps 2 and 3.** `R=rexescario-dev/clensy-platform`. The CI **workflow run** for `sha` is the source of truth. Its latest attempt must have finished, and the four required checks must be that attempt's jobs. A successful check-run name alone is not enough, because a rerun that has not yet created its new check runs leaves the previous successful run visible. Every API call that errors, returns nothing or returns output that cannot be parsed fails closed. All nine parts (0–8) must hold, in this order:

0. **Workflow identity (M5-8).** `gh api "repos/$R/actions/workflows/ci.yml" --jq '{id, path, state}'` returns `id` `356997703`, `path` `.github/workflows/ci.yml` and `state` `active`. Those values were verified at planning time from `repos/$R/actions/workflows`, which listed that one workflow, and from run `38943527715` at `d5d845e`. Let `WF=356997703`. If the call errors, or any of the three values differs, fail closed. The identity is then the workflow id and path, never the display name `CI`, which another workflow could share.
1. **Head before.** `gh pr view <pr> --json headRefOid -q .headRefOid` equals `sha`. Record it.
2. **CI workflow runs for the SHA.** `gh api "repos/$R/actions/workflows/$WF/runs?head_sha=<sha>&per_page=100" --paginate --jq '.workflow_runs[] | {id, workflow_id, path, run_attempt, status, conclusion, event, head_sha, check_suite_id}'`. This is the workflow-scoped endpoint, with no display-name filter. Require at least one run, and require **every** returned run to have `workflow_id` = `WF` and `path` = `.github/workflows/ci.yml`. A run that fails this check fails closed. **Every** CI run for `sha` has `status` `completed`. Any other status (`queued`, `in_progress`, `waiting`, `requested`, `pending`, or one not listed) fails closed, because a newer execution may be underway. Let `W` be the run with the highest `id`. `W` has `head_sha` = `sha`, `event` `pull_request` and `conclusion` `success`. Record `W.id`, `W.workflow_id`, `W.path`, `W.run_attempt`, `W.status`, `W.conclusion` and `W.check_suite_id`.
3. **Jobs of `W`'s latest attempt.** `gh api "repos/$R/actions/runs/<W.id>/attempts/<W.run_attempt>/jobs" --paginate --jq '.jobs[] | {id, name, status, conclusion, head_sha, run_attempt}'`. Each required name (`Lint`, `Test`, `Release gate`, `API e2e`) appears **exactly once**, with `status` `completed`, `conclusion` `success`, `head_sha` = `sha` and `run_attempt` = `W.run_attempt`. Record each job's `id`.
4. **Check runs tied to those jobs.** `gh api "repos/$R/commits/<sha>/check-runs" --paginate --jq '.check_runs[] | {id, name, status, conclusion, head_sha, check_suite: .check_suite.id}'`. For each required name, the check run whose `id` equals that name's job `id` from part 3 exists. It has `check_suite` = `W.check_suite_id`, `head_sha` = `sha` and `conclusion` `success`. No check run for a required name has an `id` greater than that job's `id` while not yet `completed`. A GitHub Actions job's id is its check run's id; this was confirmed on `d5d845e` at planning time (CI run `38943527715`, check suite `105542006302`).
5. **No rerun started during collection.** Re-read `gh api "repos/$R/actions/runs/<W.id>" --jq '{workflow_id, path, run_attempt, status, conclusion}'`. `workflow_id` = `WF`, `path` = `.github/workflows/ci.yml`, `run_attempt` unchanged, `status` `completed` and `conclusion` `success`. Re-run part 2's workflow-scoped list, with the same per-run `workflow_id` and `path` checks: no CI run for `sha` has an `id` greater than `W.id`.
6. **Head after.** Read `headRefOid` again. It still equals `sha`.
7. **No advance, local or remote.** `git rev-parse HEAD` and `git ls-remote origin refs/heads/feat/196-react-hooks-lint-rules` both give `sha`.
8. **State recorded.** `gh pr view <pr> --json mergeStateStatus` is recorded for information. It is not an acceptance criterion, because the PR is a draft.

`gh pr checks` reports only the PR's current head and cannot tie a result to a SHA or a run attempt, so it is not used as evidence.

**Failure path (applies to Steps 2 and 3, M5-2).** Any part of `V(sha)` that does not hold counts as a failure, as does a required check that is failed, missing, pending past its normal run time, or not tied to the SHA being verified. Record the actual state: the workflow identity part 0 returned (`id`, `path`, `state`), every observed `headRefOid` and `git` SHA, each CI workflow run's `id`, `workflow_id`, `path`, `run_attempt`, `status` and `conclusion`, and each required job and check run's `id`, `status` and `conclusion` as far as they could be read. Then stop and report the blocker to the owner. Do not claim M6 complete, do not emit the M6 Slice Completion Report or an M7 hand-off, and do not merge. Resume only after the blocker is resolved, and then run `V` again on the resulting head. If the head moved, run `V` on the new head; never accept results observed for an earlier one.

- [ ] **Step 1: Push and open a draft PR (head `H1`)**

Run: `git push -u origin feat/196-react-hooks-lint-rules`, then `gh pr create --draft --base main`. The body links #196 and the spec and plan, says the PR is a draft with M6 in progress, and makes no claim about checks. Per the user's global instructions, the body and commits carry no Claude attribution trailer. Record `H1=$(git rev-parse HEAD)` and the PR URL.

- [ ] **Step 2: Verify the checks on `H1`, then record them in one commit (`H2`)**

Run `V(H1)`. If any part fails, take the failure path.
Then append the `H1` results, with the SHA, to the Execution record. That is the only edit. Commit with `docs(196): record the PR checks on H1` and push. Record `H2=$(git rev-parse HEAD)`. The Execution record states that `H1`'s results do not cover `H2`.

- [ ] **Step 3: Verify the checks on the final head `H2`, then emit the M6 report (not committed)**

Three gates, all required:

1. `V(H2)` holds in full.
2. **Committed boundary at `H2`:** `git diff --name-only "$BASE" H2 | sort` lists exactly the Task 2 Step 2 allowlist.
3. **Working tree at completion (M5-6):** `git status --porcelain --untracked-files=all` prints nothing, and the three `test ! -e …/zz-hooks-probe.tsx` checks from Task 2 Step 2 exit 0. This is a separate assertion from gate 2: gate 2 proves what was committed, and gate 3 proves nothing uncommitted or untracked was left behind.

If any gate fails, take the failure path. Only then emit the **M6 Slice Completion Report** in the conversation, per `docs/workflows/conventions/reporting-conventions.md`. It cites `H2`, the PR URL, the CI workflow run `W` (`id`, `workflow_id`, `path`, `run_attempt`, conclusion), each required job and check-run `id` with its conclusion from `V(H2)`, and the three gate results, with Next Gate M7 (labelled self-review permitted). It is **not** committed, because any commit would create a head that `H2`'s checks do not cover. The M7 record, the next commit on this branch, carries `H2`'s check results into the plan. The `main` ruleset's strict up-to-date policy re-verifies the eventual merge head in any case.
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
| Invariant 8 (only the listed files change) | Task 2 Step 2 (working tree, untracked files, committed diff, managed fragment); Task 3 Step 3 gates 2–3 (committed diff at `H2`, working tree at completion) |
| Invariant 9 (`Lint` passes in CI) | Task 3 Steps 2–3: `V(H1)` and `V(H2)`. Each is pinned to the CI workflow's id and path and to the head, with the workflow run's latest attempt completed, the jobs tied to check runs, a guard against a rerun starting during collection, and the failure path. |
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

## Revision 3 (M5 review 2)

M5 second pass (owner, 2026-10-19, reviewed the `081a660` text): **Request changes**. M5-1 to M5-4 are accepted.

| Finding | Resolution |
| --- | --- |
| M5-5 (P1) Race in verifying the final head's SHA | A single head-pinned procedure, `V(sha)`, is used for both `H1` and `H2`. Read `headRefOid` and require `sha`. Query the check runs **by commit** (`commits/<sha>/check-runs`), so each result carries its own `head_sha`, and take the latest run of each required name. Read `headRefOid` again and require `sha`. Require local `HEAD` and the remote branch to equal `sha`. `gh pr checks` is no longer used as evidence. Any failure, or a moved head, takes the failure path, and `V` re-runs on the new head. |
| M5-6 (P2) The working tree is not rechecked at completion | Task 3 Step 3 now has three gates before the M6 report: `V(H2)`; the committed allowlist at `H2`; and a separate working-tree check (`git status --porcelain --untracked-files=all` empty, plus the three probe `test ! -e` checks). |

## Revision 4 (M5 review 3)

M5 third pass (owner, 2026-10-19, reviewed the `449a79f` text): **Request changes**. M5-1 to M5-6 are resolved.

| Finding | Resolution |
| --- | --- |
| M5-7 (P1) `V(sha)` can accept stale successful checks during a rerun | `V(sha)` now treats the CI workflow run as the source of truth (parts 2–5). Every CI run for `sha` must be `completed`, and any other or unknown status fails closed. The latest run `W` must be `pull_request` and `success`. Its latest attempt's jobs must include each required name exactly once, completed and successful on `sha`. Each job is tied to its check run by id and check suite (job id = check-run id, confirmed on `d5d845e`). No newer check run for a required name may be pending. After collection, `W`'s `run_attempt` and status are re-read, and the run list is re-checked for a newer run, to catch a rerun that started mid-verification. Any API error or empty result fails closed. The head-before, head-after and local/remote checks are kept (parts 1, 6, 7). The failure path now also records the workflow run's identity, attempt and status, and each job and check-run id. |

## Revision 5 (M5 review 4)

M5 fourth pass (owner, 2026-10-19, reviewed `48f8ad6`): **Request changes**. M5-1 to M5-7 are resolved.

| Finding | Resolution |
| --- | --- |
| M5-8 (P1) `V(sha)` selects workflow runs by display name | The new `V(sha)` part 0 verifies the workflow identity through `repos/$R/actions/workflows/ci.yml`: `id` `356997703`, `path` `.github/workflows/ci.yml`, `state` `active`. It fails closed otherwise. Parts 2 and 5 use the workflow-scoped endpoint `actions/workflows/356997703/runs?head_sha=<sha>`, with no display-name filter. They require every returned run, and the re-read of `W`, to have that `workflow_id` and `path`. `W`'s `workflow_id` and `path` are recorded, as are the workflow identity and each run's `workflow_id` and `path` in the failure path and the M6 report. Parts 1, 3, 4 and 6–8, and the failure behavior, are unchanged. |


## Execution record

M6, native, 2026-10-19, on `feat/196-react-hooks-lint-rules`. `BASE` = `d5d845e` (`git merge-base HEAD origin/main` after `git fetch`; `origin/main` was still `d5d845e`). Every result below is actual output.

### Task 1

| Step | Result |
| --- | --- |
| 1 Red | Probe written to the three `zz-hooks-probe.tsx` paths. `pnpm --filter web lint`, `pnpm --filter @clensy/ui lint` and `pnpm --filter @clensy/web lint` each **exited 0** with no `react-hooks/*` message, so the rules were not active. Probes removed with literal paths. `git status --short --untracked-files=all` was empty. **Passed.** |
| 2 Install | `pnpm --filter <name> add -D 'eslint-plugin-react-hooks@^7.1.1'` for `web`, `@clensy/ui`, `@clensy/web`. Each `package.json` declares `"eslint-plugin-react-hooks": "^7.1.1"`. `pnpm --filter <name> list` resolved **7.1.1** in all three. `pnpm-lock.yaml`: +48/−0, adding only `eslint-plugin-react-hooks@7.1.1`, `hermes-estree@0.25.1`, `hermes-parser@0.25.1` and `zod-validation-error@4.0.2`. pnpm printed `unmet peer graphql@"^15.0.0 \|\| ^16.0.0": found 17.0.2`. The plugin's dependencies (`npm view eslint-plugin-react-hooks@7.1.1`) include no graphql, and the lockfile diff touches no graphql entry, so the warning comes from existing dependencies, not from this change. **Passed.** |
| 3 Config | The import and the two-rule object were added right after `...contextforgeJavascript({ eslint, tseslint }),` in the three `eslint.config.mjs` files, and nothing else. |
| 4 Inventory (binding, before any configuration commit) | `npx eslint -f json` on each `lint` target. `apps/web` (`.`): 114 files, all messages 0, `react-hooks/*` 0. `packages/ui` (`src`): 37 files, 0, 0. `packages/web` (`src`): 44 files, 0, 0. `apps/web` has one more file than the planning probe's 113: `apps/web/next-env.d.ts`, generated by Next.js and git-ignored (`.gitignore:10`). It is present in this checkout but not in a fresh worktree. All 113 tracked lintable files were linted. **No findings, so the invariant 6 gate did not trigger.** |
| 5 Green | Probes recreated. All three `lint` scripts **exited 1**, each with `5:5 error … react-hooks/rules-of-hooks` and `10:6 error … react-hooks/exhaustive-deps` in `zz-hooks-probe.tsx` ("✖ 2 problems (2 errors, 0 warnings)"). Probes removed. Status then listed only the seven Step 2–3 files. **Passed.** |
| 6 Effective rules | `--print-config` with `react-hooks/*` keys extracted. `apps/web` `app/apollo-provider.tsx` and `lib/laundry-list-page.interaction.test.tsx`; `packages/ui` `src/base/modal.tsx` and `src/base/dialogs/form-dialog.test.tsx`; `packages/web` `src/bookings/booking-data-table.tsx` and `src/bookings/booking-data-table.test.tsx`. All six: exactly `{"react-hooks/rules-of-hooks":[2],"react-hooks/exhaustive-deps":[2]}`. **Passed.** |
| 7 `useEffectEvent` (installed 7.1.1) | All three workspaces: exactly `[{"ruleId":"react-hooks/rules-of-hooks","line":14},{"ruleId":"react-hooks/exhaustive-deps","line":22}]`. Case A had no message, B was reported on line 14 (the call) and C on line 22 (the control). Probes removed, and no `zz-hooks-probe` remained in status. **Passed.** |
| 8 Managed fragment | `git diff --quiet -- tooling/eslint.contextforge.mjs` exit 0, and the digest check gave `tooling/eslint.contextforge.mjs: OK`. **Passed.** |
| 9 Commit | `5acc376` "build(196): enforce rules-of-hooks and exhaustive-deps in the React workspaces". Working tree clean afterwards. |

### Task 2

| Step | Result |
| --- | --- |
| 1 CI-equivalent | `pnpm install --frozen-lockfile`: **exit 0** ("Already up to date"). `pnpm run lint`: **exit 0**, Turbo "6 successful, 6 total". `pnpm run test`: **exit 0**, Turbo "10 successful, 10 total". Totals: `@clensy/ui` 9 files, 96/96; `@clensy/web` 16 files, 418/418; `web` 48 files, 2185/2185 (all three **cache miss, executed**). `api` 75 suites, 1071/1071; `@clensy/client` 2 files, 13/13; `@clensy/validation` 6 files, 79/79 (all three **cache hit, replayed**: their inputs are unchanged by this slice, so Turbo reused prior results and did not re-run them). |
| 2 Boundary | (1) `git status --porcelain --untracked-files=all` empty, and the three probe `test ! -e` checks exited 0. (2) `git diff --name-only "$BASE" HEAD` gave exactly the nine allowlisted paths. (3) The suppression `grep` and the `configs` `grep` both found nothing (exit 1). (4) `git diff --quiet "$BASE" HEAD -- tooling/eslint.contextforge.mjs` exit 0; digest `OK`. **All four passed.** |

### Not yet run

- Invariant 9 (`Lint` passes in CI on the PR head): Task 3, `V(H1)` and `V(H2)`.
- The M6 Slice Completion Report: Task 3 Step 3, emitted only after `V(H2)` and gates 2–3 pass.

### Task 3

- **Step 1.** Pushed `feat/196-react-hooks-lint-rules`. Opened draft PR [#199](https://github.com/rexescario-dev/clensy-platform/pull/199). `H1` = `61aa9ebab686b74192d80de805cf3fbf672b10a3`.
- **Step 2, `V(H1)`: passed**, all parts 0–8, run in order after every CI run for `H1` had completed:
  - Part 0: `{"id":356997703,"path":".github/workflows/ci.yml","state":"active"}`.
  - Part 1: `headRefOid` = `H1`.
  - Part 2: one CI run for `H1`. `W` = `39144563828`, `workflow_id` 356997703, `path` `.github/workflows/ci.yml`, `event` `pull_request`, `run_attempt` 1, `completed`/`success`, `check_suite_id` 106077004507.
  - Part 3: jobs of attempt 1, each exactly once, `completed`/`success` on `H1`: `Release gate` 117725662059, `Test` 117725662180, `API e2e` 117725662188, `Lint` 117725662253.
  - Part 4: the check runs with those same four ids exist, with `check_suite` 106077004507, `head_sha` `H1` and `success`. No newer check run is pending.
  - Part 5: re-read of `W`: same `workflow_id` and `path`, `run_attempt` 1, `completed`/`success`. Re-listed runs: only `39144563828`.
  - Part 6: `headRefOid` still `H1`.
  - Part 7: local `HEAD` and remote branch both `H1`.
  - Part 8: `mergeStateStatus` `CLEAN` (information only).
- These `H1` results do **not** cover `H2`, the commit that records them. `V(H2)` and Step 3's gates are still to run.
- **Step 3: passed**, all three gates, after every CI run for `H2` had completed. Recorded here by the M7 record below, as Step 3 requires. It was not committed at `H2`.
  - Gate 1, `V(H2)`, `H2` = `3571818610ccc9ac53cc3c6ea560a1ab3b2ffa6f`, parts 0–8: identity `{"id":356997703,"path":".github/workflows/ci.yml","state":"active"}`; `headRefOid` = `H2` before and after; one CI run, `W` = `39144822428` (`workflow_id` 356997703, `.github/workflows/ci.yml`, `pull_request`, attempt 1, `completed`/`success`, `check_suite_id` 106077696246); jobs of attempt 1, each once, `completed`/`success` on `H2`: `Test` 117726421486, `Lint` 117726421644, `Release gate` 117726421689, `API e2e` 117726421726; the check runs with those ids are in suite 106077696246, on `H2`, `success`, with none newer pending; the re-read of `W` was unchanged and the re-list showed only `39144822428`; local `HEAD` and remote both `H2`; `mergeStateStatus` `CLEAN`.
  - Gate 2: `git diff --name-only d5d845e H2` listed exactly the nine allowlisted paths.
  - Gate 3: `git status --porcelain --untracked-files=all` produced 0 lines, and the three probe `test ! -e` checks exited 0.
  - The M6 Slice Completion Report was emitted in the conversation on 2026-10-19, citing `H2`, PR #199 and the ids above (Status: Ready for M7).
- **Correction to that M6 report:** it attributed the CI typecheck to the `Test` job. In `.github/workflows/ci.yml`, `Type-check apps/api` and `Type-check apps/web` are steps of the **`Lint`** job (`117726421644` on `H2`). `packages/ui` and `packages/web` have no CI typecheck. This slice changes only `.mjs` and `package.json` files, which no `tsc` step checks, so the correction changes no result.

## Gate outcomes

### M7 — Code Review: Approved for merge (self-review, 2026-10-19)

**Self-review.** The M6 implementer wrote this record. `CLAUDE.md` permits a self-review for a configuration-only slice, and the owner did not ask for a fresh reviewer ("m7-m10"). The owner also reviewed PR #199's diff independently on 2026-10-19 and found no code-level blocker. That review's only blocker was the `V(H2)` record, which is resolved above.

```text
Decision: Approved for merge
Subject: PR #199, feat/196-react-hooks-lint-rules, reviewed at H2 = 3571818610ccc9ac53cc3c6ea560a1ab3b2ffa6f
Accepted specification: docs/superpowers/specs/2026-10-18-react-hooks-lint-rules-design.md (Accepted, revision 2)
Accepted implementation plan: docs/superpowers/plans/2026-10-18-react-hooks-lint-rules-plan.md (Accepted, revision 5)
Live configuration: n/a (no live setting outside the repository)

Plan tasks reviewed:
- Task 1 (enable the two rules): ✓ Steps 1–9 executed in order. The inventory (Step 4) ran before the configuration commit 5acc376, and M6 began after the M5 acceptance (c225e5b precedes 5acc376).
- Task 2 (full verification, Execution record): ✓
- Task 3 (draft PR, V(H1), V(H2), gates, M6 report): ✓

Verification evidence:
- CI on H2: workflow 356997703, run 39144822428 (attempt 1): Lint 117726421644, Test 117726421486, Release gate 117726421689, API e2e 117726421726, all success, verified by V(H2).
- Local: pnpm install --frozen-lockfile exit 0; pnpm run lint exit 0 (6/6); pnpm run test exit 0 (10/10; ui 96, @clensy/web 418, web 2185 executed; api 1071, client 13, validation 79 replayed from the Turbo cache with unchanged inputs).
- Rules active: red (lint exit 0 with the probes) then green (exit 1, rules-of-hooks 5:5 and exhaustive-deps 10:6) in all three workspaces.
- Effective rules: exactly {"react-hooks/rules-of-hooks":[2],"react-hooks/exhaustive-deps":[2]} on six files (one .tsx and one test file per workspace).
- useEffectEvent on installed 7.1.1: A silent, B rules-of-hooks on line 14, C exhaustive-deps on line 22, in all three workspaces.
- Inventory: 0 findings (195 files linted, including the git-ignored apps/web/next-env.d.ts).
- Boundary: nine allowlisted paths; no suppression, no preset; managed fragment unchanged with its digest OK; clean working tree.

Review summary: The diff adds one import and one config object, exactly the two rules at 'error', to each of the three project-owned ESLint configs, right after the managed spread. It adds eslint-plugin-react-hooks ^7.1.1 to the three package.json files, and the lockfile adds only the plugin and its dependencies (+48/-0). It conforms to spec §2 and invariants 1–9. No production or test source, CI, lint script or managed file changed. The rules found nothing on existing code, so there was no invariant 6 gate decision and no deferred issue.

Blocking findings: None (no merge blockers)

Non-blocking observations:
- pnpm prints an existing `unmet peer graphql@"^15.0.0 || ^16.0.0": found 17.0.2` warning. It is unrelated to this slice (the plugin has no graphql dependency, and the lockfile diff touches no graphql entry).
- packages/ui and packages/web have no CI typecheck step. That gap predates this slice, and this slice does not touch it.

Gate: Merge per human/project norms. M8/M9 may follow when appropriate.
```

### M8 — Refactoring: N/A (2026-10-19)

The change is two declarative config blocks per workspace and three dependency entries, with nothing to restructure. The repeated config object follows the existing per-package pattern that the managed fragment's header requires. Factoring it into a shared module would add a project-owned shared ESLint file, which neither the spec nor the plan authorizes.

### M9 — Documentation: Complete (2026-10-19)

Scope, exactly: `docs/superpowers/README.md`, `docs/development/testing-and-ci.md`, and the spec's tracking row. Out of scope: `docs/conventions/javascript/README.md`, which is installer-managed (`javascript-conventions`, `workflow.yaml`), and `docs/history/shipped-slices.md`, which records slices that change the API's behavior, which this slice does not.

| Path | Change | Kind | Caused by |
| --- | --- | --- | --- |
| `docs/superpowers/README.md` | Index row for the spec under "Platform and API", Status Accepted | Content | Spec Accepted at M3 |
| `docs/superpowers/README.md` | Plan count "65 so far" → "68 so far" (`ls docs/superpowers/plans \| wc -l` = 68 on this branch; `main` already had 67, so the count had been stale) | Content | This slice's plan |
| `docs/development/testing-and-ci.md` | The `pnpm lint` row names the two React Hooks rules, the three workspaces and their effect on the **Lint** check, and links the spec | Content | Task 1 (shipped configuration) |
| Spec tracking row | "Implemented in PR #199" | Content | PR #199 |

Editorial verification: both new relative links (`specs/2026-10-18-react-hooks-lint-rules-design.md` from `docs/superpowers/`, and `../superpowers/specs/…` from `docs/development/`) resolve to existing files. No heading changes. No contradictory text: the CI table's **Lint** row (`pnpm run lint`, then `tsc` for `apps/api` and `apps/web`) is still accurate. Terminology matches the spec (§3). No implementation change.

### M10 — Workflow Validation: N/A

This slice changes no workflow asset (`git diff --name-only d5d845e HEAD -- docs/workflows .claude workflow.yaml` is empty), so M10 does not apply (process spec §2.12).
