# Adopt Context Forge Workflow `generic` 1.4.1 / `claude` 0.2.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Accepted |
| M5 decision | **Accepted** — 2026-10-03, by the owner; Native execution. Two execution clarifications applied: Step 2 states that the fetch only refreshes the remote-tracking ref (all installer/build work happens inside the detached scratch worktree) and verifies the detached SHA; Step 6 makes the changed-path set an exact machine assertion. `written: 26` is an installer-level count — the Git diff is the authoritative evidence for repository scope. |
| Date | 2026-10-03 |
| Tracking issue | [#126](https://github.com/rexescario-dev/clensy-platform/issues/126) |
| Branch | `feat/126-adopt-workflow-generic-1-4-1` (off `main` `bb358d3`) |
| Governed by (Accepted, upstream) | No clensy-side spec: the adoption adds no clensy semantics (owner decision). The behaviour adopted is defined upstream in `rexescario-dev/context-forge`: Workflow Process Gaps design + #103 slice-local amendment (`generic` 1.3.0/1.4.0, `claude` 0.2.0; PRs #102, #104), and the Workflow Package Management §10.3/§10.4 installed-set amendment plus `generic` 1.4.1 (PR #106, merge `cc20395`). |
| Authority | Upstream Accepted specs define the content; this plan only sequences the supported installer operation. |
| Pre-validation | **Full** — every `Expected:` command was run on throwaway detached copies of clensy `main` with the installer built from a clean detached Context Forge checkout of `origin/master` `cc20395` (`ci-packages.sh` exit 0, 972 tests). **Update vs Replace measured on two copies:** both reach `generic` 1.4.1 / `claude` 0.2.0 and change the same 11 paths; Update leaves a DRIFT warning (M9 skipped, inventory still records 1.2.0), Replace yields doctor ok with no warnings and the M9 file **byte-identical** (no diff) — only `workflow.yaml`'s M9 inventory entry differs between the two. On the replaced copy: `pnpm install --frozen-lockfile`, `pnpm run lint`, `pnpm run test` all exit 0. |

**Goal:** Bring clensy-platform's installed Context Forge workflow to the current catalog — `generic` 1.2.0 → **1.4.1**, `claude` 0.1.0 → **0.2.0** — through the supported installer, with `doctor` ok and no drift.

**Operation choice — Replace, not Update (decided by measurement):** the only drift is `docs/workflows/prompts/documentation-execution.md`, clensy's deliberate local fix (`e2dac80`) of the leaked `W1-10` id. Upstream `generic` 1.4.1 adopted **exactly** that wording, so the on-disk file is byte-identical to the 1.4.1 published file. Replace therefore rewrites identical bytes and refreshes the inventory digest (clean doctor), while Update would skip it and leave a permanent DRIFT warning. **Safety gate (Step 3):** Replace is only used if that byte-identity holds; otherwise stop.

**Tech Stack:** Context Forge `workflow-installer` API (`doctor`, `replace`, `applyProjectPolicy`) from a clean `origin/master` checkout; Node 20; pnpm/turbo for clensy's own checks.

## Global Constraints

- Run the installer **only** from a fresh detached Context Forge checkout of `origin/master` (`cc20395` or later) — never from `/home/rex/Project/ContextForge` (its working tree is someone's `feat/catalog-policy-profile` WIP).
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
- `git diff .claude/skills/workflow/SKILL.md`: only the Accepted-spec routing clause ` or amending it (M2, then M3)`.


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
