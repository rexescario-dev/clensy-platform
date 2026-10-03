# Adopt Context Forge Workflow `generic` 1.4.1 / `claude` 0.2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Accepted |
| M5 decision | **Accepted** — 2026-10-03, by the owner; Native execution. Two execution clarifications applied: Step 2 states that the fetch only refreshes the remote-tracking ref (all installer/build work happens inside the detached scratch worktree) and verifies the detached SHA; Step 6 makes the changed-path set an exact machine assertion. `written: 26` is an installer-level count — the Git diff is the authoritative evidence for repository scope. **M5 revision (2026-10-03, during M6, owner decision (a)):** Step 6's `SKILL.md` expectation was too narrow. The real diff also carries the published `claude` 0.1.0 reinforcement from upstream `2a367bc`, now accepted as expected published content (see Step 6). *Pre-validation gap:* pre-validation checked changed-path counts and installer and doctor results, but did not inspect the actual `SKILL.md` content diff. So the Step 6 expectation wrongly narrowed that diff to the #103 routing clause. |
| Date | 2026-10-03 |
| Tracking issue | [#126](https://github.com/rexescario-dev/clensy-platform/issues/126) |
| Branch | `feat/126-adopt-workflow-generic-1-4-1` (off `main` `bb358d3`) |
| Governed by (Accepted, upstream) | No clensy-side spec: the adoption adds no clensy semantics (owner decision). The behaviour adopted is defined upstream in `rexescario-dev/context-forge`: Workflow Process Gaps design + #103 slice-local amendment (`generic` 1.3.0/1.4.0, `claude` 0.2.0; PRs #102, #104), and the Workflow Package Management §10.3/§10.4 installed-set amendment plus `generic` 1.4.1 (PR #106, merge `cc20395`). |
| Authority | Upstream Accepted specs define the content; this plan only sequences the supported installer operation. |
| Pre-validation | **Partial** *(relabelled at M6 under the adopted 1.4.1 pre-validation rule)*. The Step 6 `SKILL.md` content diff was **not** inspected before M5 (see the M5 revision); otherwise every `Expected:` command was run on throwaway detached copies of clensy `main` with the installer built from a clean detached Context Forge checkout of `origin/master` `cc20395` (`ci-packages.sh` exit 0, 972 tests). **Update vs Replace measured on two copies:** both reach `generic` 1.4.1 / `claude` 0.2.0 and change the same 11 paths; Update leaves a DRIFT warning (M9 skipped, inventory still records 1.2.0), Replace yields doctor ok with no warnings and the M9 file **byte-identical** (no diff) — only `workflow.yaml`'s M9 inventory entry differs between the two. On the replaced copy: `pnpm install --frozen-lockfile`, `pnpm run lint`, `pnpm run test` all exit 0. |


## Gate outcomes

**M6 (2026-10-03): Complete.** Task 1, Steps 1–9, executed natively. Commit `0d147ef` holds the installer output; the plan commits are separate.

| Step | Evidence |
| --- | --- |
| 1 | branch `feat/126-adopt-workflow-generic-1-4-1`, clean tree |
| 2 | detached Context Forge checkout at `cc20395`; `generic` 1.4.1, `claude` 0.2.0; `ci-packages.sh` exit 0 (972 tests). Only the remote-tracking ref was fetched into the owner's checkout |
| 3 | doctor before: exit 1. Findings: `warning:DRIFT:docs/workflows/prompts/documentation-execution.md`, 2 × `error:PACKAGE_VERSION_UNAVAILABLE`, `info:PROVIDERS_CONFIGURED`. **Safety gate:** `cmp` of the local M9 file against the published 1.4.1 file is byte-identical, so Replace is allowed |
| 4 | `replace`: written 26 (installer-level count), skipped none; packages `generic` 1.4.1, `claude` 0.2.0, others unchanged; policy step empty |
| 5 | doctor after: exit 0, ok, findings `info:PROVIDERS_CONFIGURED` only |
| 6 | `exact-scope-ok`: exactly the 11 expected paths, and no diff on `documentation-execution.md`. `workflow.yaml` is inventory only (versions, digests, `installedAt`). `SKILL.md`: **expectation mismatch → stopped → owner decision (a) → M5 revision** (`8b9be74`). A line-level check then confirmed exactly 4 added and 2 replaced lines: the #103 routing clause plus the `2a367bc` rules 4, 6 and 7 |
| 7 | `pnpm run lint` exit 0; `pnpm run test` exit 0 (validation 6, ui 7, @clensy/web 8, web 13 test files, plus api) |
| 8 | commit `0d147ef` |
| 9 | scratch checkout removed; `/home/rex/Project/ContextForge` untouched |

There was no TDD (installer-managed files; M6 rule 4).

**Final review:** a fresh, independent agent context (M7 rule 4). Result: 0 Critical, 1 Important, 4 Minor. It verified:
- all 14 managed files are byte-identical to `origin/master` at `cc20395`;
- all 26 `workflow.yaml` digests equal the sha256 of the committed files;
- the scope is exactly the 11 managed paths plus this plan;
- the M9 blob is unchanged, and only its inventory digest refreshed (`8a2646db…` → `73ff6c63…`);
- the `2a367bc` provenance holds;
- the new text references no Context Forge internals.

**Fix pass**, all in this plan:
- **Important:** this Gate outcomes / M6 record was missing.
- **Minor, fixed:** pre-validation relabelled **Partial**, as the adopted rule requires.
- **Minor, fixed:** the stale "someone's WIP" description.
- **Minor, fixed:** a clause on the 09-24 `installedAt`.

Deferred minor: the M5 decision cell is long (wording only).

**M7 (2026-10-03): Approved for merge.**
- Subject: PR [#127](https://github.com/rexescario-dev/clensy-platform/pull/127), head `46c038b`. It carries this Accepted plan (plus its M5 revision) and the M6 change set (§2.8).
- M6 gate: the plan's M5 Accept `ba86045` precedes the installer commit `0d147ef`.
- Plan conformance: Steps 1–9 ✓. The Step 6 deviation was resolved by the owner's M5 revision (`8b9be74`) **before** the commit, under the stop-and-report rule. No other deviations.
- Upstream conformance: the content is byte-identical to `context-forge` `origin/master` `cc20395` for all 14 managed files, and all 26 inventory digests match the committed files (independent review).
- Scope: only the 11 installer-managed paths and this plan. No product code. No hand edits to managed files or `workflow.yaml`.
- Verification evidence:
  - CI run [37131001257](https://github.com/rexescario-dev/clensy-platform/actions/runs/37131001257) on `46c038b`: Lint, Test and Release gate passed.
  - Locally: `doctor` ok, `exact-scope-ok`, `pnpm run lint` and `pnpm run test` exit 0.
- **Reviewer independence (newly adopted M7 rule):** the implementer wrote this record, citing the independent fresh-context review under M6 (0 Critical, 1 Important (fixed), 4 Minor (3 fixed, 1 deferred)).
- Blocking findings: none. Merge per human/project norms.

**M8 (2026-10-03): N/A.** Installer output only; nothing to refactor.

**M9 (2026-10-03): Complete.** Documentation scope: this plan only.
- No clensy documentation outside `docs/workflows/**` mentions the installed workflow version. `docs/workflows/**` itself is installer-managed and must not be hand-edited.
- Content update: this Gate outcomes section, caused by the M6–M10 gates.
- Verification: the links in this plan resolve, and its status matches reality (plan Accepted with an M5 revision; PR open and green).

**M10 (2026-10-03): Accepted (workflow validated).** Subject: clensy-platform's **newly installed** workflow (`generic` 1.4.1, `claude` 0.2.0), against `docs/workflows/specs/agent-workflow-design.md` §2.10. The report is recorded here, per the adopted M10 rule (the slice plan's Gate outcomes).

Checks:
- 9 prompts, all citing the governing contract. No orphan assets.
- Every relative link under `docs/workflows/` resolves (scripted scan).
- The adopted rules are present and line up:
  - §2.6/§2.12: M10 (when in scope) before closeout;
  - "Gate outcomes" in M4 and M10;
  - characterization evidence in M6, M8 and M7;
  - the slice-local amendment path in M2 and M3, and in `.claude/skills/workflow/SKILL.md`.
- The installed workflow contains no Context Forge issue ids or repository identity (the scan is clean).
- `workflow.providers` (github) is honoured, per the adapter's new rule 6.

Blocking findings: none.

Non-blocking observations:
- This slice is the first run under the adopted rules. It used:
  - the stop-and-report rule, at Step 6;
  - an honest **Partial** pre-validation label;
  - M7 reviewer independence;
  - the M10 report location.

  All of these worked as written.
- Upstream note, recorded for the owner: `claude` 0.1.0's content changed (`2a367bc`) without a version bump. That is the same class of gap as the earlier in-place `generic` 1.2.0 edit (`6f7e599`). A catalog check that "content changed implies version changed" would prevent it, as a future context-forge item.

**Goal:** Bring clensy-platform's installed Context Forge workflow to the current catalog — `generic` 1.2.0 → **1.4.1**, `claude` 0.1.0 → **0.2.0** — through the supported installer, with `doctor` ok and no drift.

**Operation choice — Replace, not Update (decided by measurement):** the only drift is `docs/workflows/prompts/documentation-execution.md`, clensy's deliberate local fix (`e2dac80`) of the leaked `W1-10` id. Upstream `generic` 1.4.1 adopted **exactly** that wording, so the on-disk file is byte-identical to the 1.4.1 published file. Replace therefore rewrites identical bytes and refreshes the inventory digest (clean doctor), while Update would skip it and leave a permanent DRIFT warning. **Safety gate (Step 3):** Replace is only used if that byte-identity holds; otherwise stop.

**Tech Stack:** Context Forge `workflow-installer` API (`doctor`, `replace`, `applyProjectPolicy`) from a clean `origin/master` checkout; Node 20; pnpm/turbo for clensy's own checks.

## Global Constraints

- Run the installer **only** from a fresh detached Context Forge checkout of `origin/master` (`cc20395` or later) — never from `/home/rex/Project/ContextForge` (the owner's own checkout, which is on `feat/catalog-policy-profile` with uncommitted local changes, so it must not be used as the installer source).
- Only installer-managed paths may change: `docs/workflows/**`, `.claude/skills/workflow/SKILL.md`, `workflow.yaml`. No product code, no hand edits to managed files or `workflow.yaml`.
- No TDD applies (installer-managed documentation; M6 rule 4) — verification is `doctor`, the reviewed diff, and clensy's lint/test suites.
- Commits carry **no** `Co-Authored-By` trailer and no "Generated with" line.

## Verification helper (not committed)

Save outside the repository as `installer.mjs`:

```js
// Usage: node installer.mjs <contextForgeCheckout> <clensyRoot> <doctor|replace>
const [cf, dest, mode] = process.argv.slice(2);
const { doctor, replace, applyProjectPolicy } = await import(`${cf}/packages/workflow-installer/dist/index.js`);
const common = { destinationRoot: dest, catalogRoot: `${cf}/workflow-packages`, workflowVersion: "1" };
if (mode === "doctor") {
  const r = await doctor(common);
  console.log(JSON.stringify({ ok: r.ok, packages: r.manifest?.packages, findings: r.findings.map((f) => `${f.severity}:${f.code}:${f.path ?? ""}`) }, null, 1));
  process.exit(r.ok ? 0 : 1);
}
const r = await replace(common);
console.log(JSON.stringify({ written: r.written.length, skipped: r.skipped.map((s) => `${s.reason} ${s.path}`), packages: r.manifest.packages }, null, 1));
const p = await applyProjectPolicy({ destinationRoot: dest, contextForgeRoot: cf, project: "clensy-platform" });
console.log("policy", JSON.stringify({ written: p.written, updated: p.updated, removed: p.removed, preservedDrift: p.preservedDrift }));
```

---

### Task 1: Adopt via Replace

- [ ] **Step 1: Preconditions.** Run: `git branch --show-current && git status --short`
Expected: `feat/126-adopt-workflow-generic-1-4-1`; no output from status (apart from this plan once committed).

- [ ] **Step 2: Build the installer from a clean upstream checkout.** The `fetch` only refreshes the remote-tracking ref `origin/master`; it does not touch the existing checkout's working tree. Every installer and build operation happens inside the detached scratch worktree.
Run: `git -C /home/rex/Project/ContextForge fetch -q origin && git -C /home/rex/Project/ContextForge worktree add --detach <scratch>/cf origin/master && git -C <scratch>/cf rev-parse --short HEAD`
Expected: the SHA is `cc20395`, or a later `master` commit whose `workflow-packages/generic/package.yaml` says `version: 1.4.1` and whose `workflow-packages/claude/package.yaml` says `version: 0.2.0`. Otherwise stop and report.
Run: `(cd <scratch>/cf && bash .github/scripts/ci-packages.sh)`
Expected: exit 0 (972 tests).

- [ ] **Step 3: Doctor before + Replace safety gate.**
Run: `node <scratch>/installer.mjs <scratch>/cf /home/rex/Project/clensy-platform doctor`
Expected: exit 1; findings exactly `warning:DRIFT:docs/workflows/prompts/documentation-execution.md`, two `error:PACKAGE_VERSION_UNAVAILABLE` (generic 1.2.0, claude 0.1.0), `info:PROVIDERS_CONFIGURED`.
Run: `cmp docs/workflows/prompts/documentation-execution.md <scratch>/cf/workflow-packages/generic/prompts/documentation-execution.md`
Expected: no output (byte-identical). **If it differs, stop and report — do not run Replace.**

- [ ] **Step 4: Replace.** Run: `node <scratch>/installer.mjs <scratch>/cf /home/rex/Project/clensy-platform replace`
Expected: `written` 26, `skipped` [], packages `generic: 1.4.1`, `claude: 0.2.0` (others unchanged: `ui-ux-claude` 0.1.0, `ui-ux` 0.1.0, `javascript-conventions` 0.3.0, `javascript-conventions-claude` 0.1.0); policy all empty.

- [ ] **Step 5: Doctor after.** Run: `node <scratch>/installer.mjs <scratch>/cf /home/rex/Project/clensy-platform doctor`
Expected: exit 0; `ok: true`; findings only `info:PROVIDERS_CONFIGURED`.

- [ ] **Step 6: Reviewed diff (exact assertion).** Write the expected set to `<scratch>/expected-paths.txt`, one path per line and sorted:
```text
.claude/skills/workflow/SKILL.md
docs/workflows/prompts/code-review.md
docs/workflows/prompts/design-review.md
docs/workflows/prompts/implementation-execution.md
docs/workflows/prompts/implementation-planning.md
docs/workflows/prompts/plan-review.md
docs/workflows/prompts/refactoring.md
docs/workflows/prompts/specification.md
docs/workflows/prompts/workflow-validation.md
docs/workflows/specs/agent-workflow-design.md
workflow.yaml
```
Run: `git status --porcelain | cut -c4- | sort | diff - <scratch>/expected-paths.txt && git diff --quiet -- docs/workflows/prompts/documentation-execution.md && echo exact-scope-ok`
Expected: `exact-scope-ok`, which proves all of the following:
- `documentation-execution.md` is **not** modified;
- no product, source, test or config file outside the installer-managed set changed;
- the modified set is exactly the eleven paths above.

Then read two diffs:
- `git diff workflow.yaml`: inventory only (package versions, asset versions and digests, installation metadata).
- `git diff .claude/skills/workflow/SKILL.md` *(revised at M5, owner decision (a))* contains exactly:
  1. the accepted #103 routing clause ` or amending it (M2, then M3)`;
  2. the published `claude` 0.1.0 reinforcement introduced upstream by `2a367bc` (2026-09-06, "reinforce Claude activation"): Rule 4's "installer-managed operational state (packages, inventory, `providers`)" wording, Rule 6's `workflow.providers` routing requirement, and Rule 7's Slice Completion Report requirement.

  Those three lines are **published adapter content**, not new clensy semantics or #126 changes. They were absent from clensy's previously installed `claude` 0.1.0 copy because that copy (installed 2026-08-14, `192fa19`) predates the upstream content change (a version that changed content without a bump). The later 2026-09-24 installer run (`installedAt` in `workflow.yaml`) did not rewrite the unchanged-version `claude` asset. #126 makes no design decision about providers or Slice Completion Reports; it adopts published content.


- [ ] **Step 7: Clensy checks.** Run: `pnpm run lint && pnpm run test`
Expected: both exit 0.

- [ ] **Step 8: Commit.**
```bash
git add .claude/skills/workflow/SKILL.md docs/workflows workflow.yaml
git commit -m "chore(126): adopt Context Forge generic 1.4.1 and claude 0.2.0 via installer replace"
```

- [ ] **Step 9: Clean up.** Run: `git -C /home/rex/Project/ContextForge worktree remove --force <scratch>/cf && git -C /home/rex/Project/ContextForge worktree prune`
Expected: the throwaway checkout is gone; `/home/rex/Project/ContextForge` untouched.

## Traceability

| Requirement (#126 acceptance) | Step |
| --- | --- |
| `generic` 1.4.1, `claude` 0.2.0 with refreshed digests | 4 |
| `doctor` ok | 5 |
| Only installer-managed paths change | 6 |
| Installer from a clean Context Forge `master` | 2 |
| CI green | 7 (locally) + PR CI |
