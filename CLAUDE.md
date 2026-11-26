# Repository guidance for Claude

This repository uses the installed engineering workflow. Start at `docs/workflows/README.md`. `docs/workflows/` is installer-managed: do not edit it to record project policy. Record project policy here instead.

## M7 code review: who reviews

Owner decision, 2026-10-06. The M7 prompt (`docs/workflows/prompts/code-review.md`) says the reviewer SHOULD be independent of the M6 implementer. This project applies that by risk:

- **A fresh, independent reviewer is required** when a slice changes:
  - application code;
  - authorization;
  - tenant isolation;
  - schema or database.

  Dispatch a fresh agent, on the most capable model, that did not implement the change. Give it the Accepted spec, the Accepted plan and the branch diff. The M7 record cites that review.
- **A self-review is permitted** for docs-only and settings/configuration-only slices. The M7 record MUST label it **self-review**.
- **On any slice**, the owner may request a fresh reviewer. That request overrides the rule above.

This standing instruction counts as the owner's request to dispatch a reviewer agent at M7 whenever the first bullet applies.

## Follow-up work on a shipped slice

Owner decision, pending approval (proposed 2026-11-26 from the #236 retrospective; precedents: #230 for #227, #240 for #236).

A **follow-up** resolves observations recorded at M7 or later for a slice whose specification and implementation plan are both Accepted.

- **Test-only path: M6 and M7 only.** It applies when every condition below holds:
  - every changed file is a test, a test helper or fixture, or the slice's own plan record;
  - no production code, configuration, migration or dependency changes;
  - no requirement in the Accepted specification and no task in the Accepted plan is added, removed or changed.

  Then M2–M5 are not re-run. M8 is N/A. M9 is Complete if the plan record is updated, otherwise N/A. M10 is N/A unless a workflow asset changes.
- **M7 on the test-only path** follows the reviewer rule above. Test code under `apps/**` and `packages/**` counts as application code, so a fresh independent reviewer is required.
- **Recording.** The plan's "Post-closeout follow-ups" section records each observation, its resolving commit, the break run or failing-first evidence, the M7 record and the gates table, and cites this section as the reason M2–M5 were not re-run.
- **Anything else is not a follow-up.** A production code change, a new or changed behavior, or a changed requirement is a new slice, or a specification amendment (M2/M3) or a plan amendment (M4/M5) before M6.
- **When unsure, ask the owner** which path applies before starting M6. Do not decide it silently.

## Merge preflight

Owner decision, pending approval. Run this check before reporting a pull request as ready to merge (the **readiness run**), and again immediately before a merge the owner has explicitly requested (the **merge run**). This section authorizes no merge and no push: a merge happens only on the owner's explicit request (generic spec §2.12 step 1), and a push only as step 3 says. `main` requires up-to-date branches: the ruleset "main: required CI checks" (active) uses a strict required-status-checks policy with Lint, Test, API e2e and Release gate.

1. Run `git fetch origin`, then `gh pr view <n> --json headRefOid,baseRefName,mergeStateStatus,mergeable,statusCheckRollup`. If `mergeStateStatus` is `UNKNOWN`, retry up to three times, a few seconds apart, before reporting it.
2. Act on the state:

   | `mergeStateStatus` | Action |
   | --- | --- |
   | `CLEAN` | Readiness run: report the PR as ready to merge (step 5). Merge run: continue to the M1–M10 stage check, then merge with `--match-head-commit <headRefOid>`, behind the configuration guard when the session has one. |
   | `BEHIND` | Update the branch (step 3). |
   | `DIRTY` | Stop. Report the conflicting files to the owner. Do not resolve a conflict by rebasing or force-pushing. |
   | `BLOCKED`, `UNSTABLE` | A required check failed or is pending. Investigate a failure; wait for a pending check. Do not merge. |
   | anything else | Stop and report the state. |

3. **Updating a `BEHIND` branch.** No rebase and no force-push, ever.
   1. In the slice's worktree, record the approved head `A` (the head M7 approved) and the slice's merge base `M=$(git merge-base A origin/main)`. Fetching a newer `main` does not change `M`.
   2. Run `git merge --no-ff origin/main`. If it conflicts, run `git merge --abort` and treat the PR as `DIRTY`. The new head is `N=$(git rev-parse HEAD)`, and the `main` commit it merged is `B=$(git rev-parse HEAD^2)`.
   3. Run the slice's local checks: `api` lint and unit tests, plus e2e when the slice's plan requires e2e.
   4. Push with an ordinary (fast-forward) push, behind the configuration guard when the session has one, **only with the owner's explicit approval** of the update push, or under an owner request to update the branch. A request to merge is **not** a request to update the branch: if the merge run finds `BEHIND`, stop and ask for approval of the update push. Without that approval, stop and report the PR as `BEHIND` with the prepared, unpushed merge.
   5. Wait for all four required checks on `N`, then repeat step 1.
4. **M7 approval carries over to `N` only when every condition holds.**
   1. **No conflicts:** the merge in step 3.2 completed without conflicts.
   2. **Identical slice diff:** `git diff M A | git patch-id --stable` and `git diff B N | git patch-id --stable` print the same patch ID.
   3. **No overlap:** `git diff --no-renames --name-only M B` (what the update brought in) shares no file with `git diff --no-renames --name-only M A` (the slice's files). `--no-renames` makes a rename list both the old and the new path.
   4. **No dependency or shared-configuration change:** `git diff --no-renames --name-only M B` contains none of the following, at any depth unless a path is given:
      - `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `patches/**`;
      - `turbo.json`, `tooling/**`, `packages/config/**`;
      - `tsconfig*.json`, `eslint.config.*`, `.prettierrc*`, `jest*.json`, `jest.config.*`, `vitest.config.*`;
      - `next.config.*`, `postcss.config.*`, `nest-cli.json`, `components.json`, `packages/client/codegen.ts`;
      - `.github/**`, `Dockerfile*`, `docker-compose.yml`, `.dockerignore`, `.gitignore`, `infrastructure/**`;
      - `.env.example`, `workflow.yaml`, `.claude/**`.

      Keep this list in step with the repository: when a new build, test or tooling configuration file is added, add it here.

   If any condition fails, M7 is repeated as a fresh review on `N`, following the reviewer rule above. A focused re-check is not a substitute.

   Record in the PR description or the plan's gate record: `A`, `M`, `B`, `N`, both patch IDs, the two file lists and the outcome of each condition.
5. Report a PR as "ready to merge" only when `mergeStateStatus` is `CLEAN` and all four required checks passed on the current `headRefOid`. Reporting it ready is not a merge request.

## Post-merge cleanup

Owner decision, pending approval.

**Closeout inventory (pilot).** Every implementation plan written at M4 from now on includes a "Closeout inventory" section. Each row names:
- the resource by exact name: branch, worktree, database, container, image, volume or temporary file;
- whether this slice created it;
- its fate after the merge: keep, archive or remove;
- its authorization from the table below;
- the evidence archive location.

M5 Plan Review checks the inventory. Accepting the plan makes a listed resource *eligible* for the cleanup the table allows; it does not approve any destructive removal. **Fallback** for a plan with no inventory, such as one accepted before this rule: at closeout, the agent proposes the inventory, with the evidence that the slice created each resource, inside the single approval request below. The owner approves the proposed inventory and the archive location as their own named items. Approving the inventory makes its resources eligible, as M5 acceptance does; it does not approve any destructive removal, and each database drop still needs its own named approval. Until the inventory and the archive location are approved, nothing is removed. No worktree is removed until an archive location is approved, and the local branch is never deleted while its worktree exists.

**Precondition for every action:** the merge is verified. The PR is merged, its merge commit is reachable from `origin/main`, and the merged head equals the head M7 approved, or the head the approval carried over to under "Merge preflight" step 4.

| Action | When it is allowed | Authorization |
| --- | --- | --- |
| **Archive evidence** (`.superpowers/sdd/<plan>/` and any other slice evidence) | Before the worktree is removed. Copy it to the archive location named in the plan's closeout inventory, or approved under the fallback, never only to a session scratchpad. Write a `sha256sum` manifest and verify it. | Automatic (local copy). |
| **Remove the slice worktree** | After the archive is verified. `git status --porcelain` is empty, and `git status --porcelain --ignored` lists only regenerable paths (`node_modules/`, `dist/`, `coverage/`, `.turbo/`, generated `src/schema.gql`) plus the archived evidence. Never `--force`. | Automatic when every condition holds. Otherwise ask, listing what would be lost. |
| **Delete the local branch** | Only once its worktree has been removed: `git worktree list --porcelain` shows no worktree with the branch checked out. `git branch -d` only, never `-D`. | Automatic. |
| **Delete the remote branch** | Only this slice's own branch, and only when its remote tip equals the verified merged head. Delete with `git push origin --delete --force-with-lease=<branch>:<merged-head>` behind the configuration guard, then verify with `git ls-remote`. A tip mismatch means stop and report. | **Explicit approval at closeout, naming the branch and its tip.** No configuration setting authorizes it. This stays approval-only until ContextForge's managed cleanup tooling enforces the tip check and has been independently verified, and the owner then changes this row. |
| **Drop a slice-ephemeral test database** | The database is named exactly in the Accepted plan's closeout inventory, or in an inventory the owner approved under the fallback. It was created by this slice (for example `fix236_test`), and it has no active connections. No name patterns. | Explicit approval at closeout that names each database, separate from any approval of the inventory. Listing it in an inventory is not approval to drop it. |
| **Drop a legacy or shared database** (`clensy`, `clensy_test`, `clensy_e2e`, `clensy_e2e_<n>`, `postgres`, or any database in neither the plan's inventory nor an inventory approved under the fallback) | Never as part of a slice closeout. Report it as found. | A separate task with its own explicit approval naming each database. |
| **Docker images, containers, volumes** | Never as part of a slice closeout. | A separate task. |

**One approval request.** List every approval-required action in a single message, with exact names. An approval such as "approve all" covers only the items listed in that message.
