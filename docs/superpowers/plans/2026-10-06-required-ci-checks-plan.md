# Required CI Checks on `main` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Draft |
| Date | 2026-10-06 |
| M5 history | First pass (2026-10-06, owner): **revise and resubmit, no architectural change**. Eight items, all applied in this revision:<br>**(1)** Corrective `PUT` has its own confirmation gate, Task 3 Step 4. A Step 1 mismatch is corrected only after an explicit "yes". A Step 3 role mismatch stops and returns to M5, with no guessed id. V4 does not run until Steps 1–3 pass.<br>**(2)** The V5 comment-only check is an explicit `test -z` assertion, plus a guard that `ci.yml` did change, plus the parsed-YAML equality.<br>**(3)** Branch ancestry is stated: based on `56a4b2a`, carrying `c0b918f`, `a58dca5` and the plan. Comparisons use `merge-base HEAD origin/main`.<br>**(4)** V1b's fallback names each item's evidence instead of calling V1–V4 "the authority".<br>**(5)** On `BEHIND`, the branch is updated only to satisfy the up-to-date requirement, and V2/V3 are repeated on the new head.<br>**(6)** V3 asserts each of the four required CI check runs is `COMPLETED`/`SUCCESS` on the PR head, plus `CLEAN`, and does not rely on the `--watch` exit status.<br>**(7)** Task 1 Step 7 now proves what it claims. Constraint 7 is scoped to the documentation surfaces, because the spec and this plan state the payload by design.<br>**(8)** `$WORK` is removed after the M6 record (Task 5 Step 5). |
| Tracking issue | [#140](https://github.com/rexescario-dev/clensy-platform/issues/140) |
| Spec | [Required CI Checks on `main`](../specs/2026-10-06-required-ci-checks-design.md), Status **Accepted** (M3, 2026-10-06, at `c0b918f`, recorded at `a58dca5`). |
| Relies on | The four jobs of `.github/workflows/ci.yml` as on `main` at `56a4b2a`, used unchanged (spec §1.1, §5 invariant 4). |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. Task order, temporary file names, shell variable names and commit wording are planning decisions, not product semantics. |
| Scope | GitHub repository settings (one ruleset) plus three files: `README.md`, `docs/README.md` and `.github/workflows/ci.yml` (comment only). No change to `apps/`, `packages/`, migrations, tests or any executable CI content. |
| Branch | `feat/140-required-ci-checks`, based on `main` at `56a4b2a`. It already contains the M2 spec commit `c0b918f`, the M3 acceptance record `a58dca5` and this plan, from `7cc8421` onward, including its M5 revisions. M6 adds commits on top. No rebase, no other base. One PR carries the spec, this plan, the doc edits and the gate records (process spec §2.8). Comparisons against "the base" use `BASE=$(git merge-base HEAD origin/main)`, which is `56a4b2a` unless `main` has moved and been merged in. They never use a local `main`. |
| Edit anchors | Every edit is located by **quoted text**, not by line number. |

**Goal:** Put `main` under one active repository ruleset that requires `Lint`, `Test`, `Release gate` and `API e2e` from GitHub Actions on an up-to-date PR branch, with an Admin-only, PR-only bypass, and make the docs say so.

**Architecture:** One `POST /repos/rexescario-dev/clensy-platform/rulesets` call with the exact §4.1 payload. The payload is built in a temporary directory outside the repo and validated with `jq` before it is sent. Sending it is gated on an explicit owner confirmation at that moment. Three doc and comment edits describe the result without copying the payload. Verification reads the ruleset back by REST and GraphQL, checks the effective branch rules, watches the #140 PR go `BLOCKED` → mergeable, and shows that a direct push to `main` is rejected.

**Tech Stack:** `gh` 2.x, authenticated as `rexescario` (repository `ADMIN`; token scopes `repo`, `workflow`, `read:org`), GitHub REST (`2022-11-28`) and GraphQL, `jq`, `git`, Python 3 with PyYAML (for the comment-only check).

## TDD applicability

TDD does not apply. This slice changes repository settings and prose. No application code or test changes. In its place:
- **before the change**, preflight assertions fix the starting state (Task 1);
- **before sending**, the payload is checked field by field against spec §4.1 (Task 1);
- **after the change**, the ruleset is read back and the rules are shown to be enforced (spec §8 V1–V5; Tasks 3 and 4).

Each check states its expected output and fails loudly (`jq -e`, `test`, `set -e`).

## Global Constraints

Copied from the Accepted spec. Every task's requirements include these.

1. Exactly one ruleset. `name` `main: required CI checks`, `target` `branch`, `enforcement` `active`, `conditions.ref_name.include` `["refs/heads/main"]`, `exclude` `[]` (§4.1).
2. Exactly one rule: `required_status_checks`, with `{context, integration_id: 15368}` for `Lint`, `Test`, `Release gate` and `API e2e`, `strict_required_status_checks_policy: true` and `do_not_enforce_on_create: false` (§4.1).
3. Exactly one bypass actor: `{actor_type: "RepositoryRole", actor_id: 5, bypass_mode: "pull_request"}`. `5` is the Admin role (confirmed below; spec §4.1).
4. The POST is sent only after the owner explicitly confirms it at that moment. Acceptance of the spec or of this plan is not that confirmation (§4.1). The same applies to the V4 push to `main` (Task 3).
5. No classic branch protection (§5 invariant 1).
6. No CI behavior change. In `.github/workflows/`, only the `api-e2e` comment changes (§5 invariant 4, §4.3 item 3).
7. No copy of the payload in the documentation surfaces: `README.md`, `docs/README.md` and `.github/` (§5 invariant 6, §4.3). The executable payload lives only in a `mktemp -d` directory outside the repository. The spec (§4.1 table) and this plan (Task 1 Step 5) are workflow records that state the intended payload by design. Invariant 6 does not cover them, and the checks below exclude `docs/superpowers/`.
8. Verification leaves nothing on the remote except the #140 PR: no extra branch, commit, tag or PR (§5 invariant 7).

### Admin role id: pre-application confirmation (spec §4.1)

- **Before the POST:** `integrations/terraform-provider-github`, GitHub's own provider, at `docs/resources/repository_ruleset.md` under `bypass_actors`, says: "at the time of writing this, the following actor types correspond to the following actor IDs: `RepositoryRole` … `maintain` -> `2`, `write` -> `4`, `admin` -> `5`". Task 1 Step 4 re-reads that text at execution time.
- **After the POST, authoritative:** GraphQL `RepositoryRulesetBypassActor` exposes `repositoryRoleName` and `repositoryRoleDatabaseId`. Both fields were confirmed by introspection on 2026-10-06. Task 3 Step 3 asserts the bypass actor's role name is `admin` (case-insensitive) and its database id is `5`. If that assertion fails, the ruleset is corrected with `PUT` before any other verification, and the correction is recorded.

## Review Focus

These are the conditions most likely to break the outcome without being covered by a happy-path check. Each line names the task step that pins it.

1. **Check-name drift between planning and apply:** a commit on `main` renames or adds a job before Task 2 runs. Task 1 Step 3 re-reads the check runs on the current `main` head and stops if the four names or app id differ.
2. **A ruleset that appears out of nowhere:** someone creates a ruleset, or an organization ruleset starts applying, between M5 and apply. Task 1 Step 2 re-checks `rulesets?includes_parents=true` and `rules/branches/main`, and stops if either is non-empty.
3. **The PR opened before the ruleset exists:** V2 would then observe nothing. Task 5 opens or pushes the PR only after Task 2 has applied the ruleset. Task 5 Step 2 confirms `BLOCKED` while checks are pending.
4. **A direct push that succeeds:** that is an invariant 2 failure. Task 3 Step 6 uses `git commit-tree`, so no local branch or working tree is touched. It stops on success without attempting any repair and waits for the owner's instruction.
5. **A non-comment change smuggled into `ci.yml`:** Task 4 Step 4 compares the parsed YAML of `main` and the branch, and asserts the textual diff touches comment lines only.

---

### Task 1: Preflight and payload (read-only)

Spec §1.1, §4.1, §4.2. No commit. Nothing is sent to GitHub except GET requests.

**Files:** none in the repository. Creates `$WORK/ruleset.json`, where `WORK=$(mktemp -d)`.

**Interfaces:**
- Produces: the shell variable `WORK`, and `$WORK/ruleset.json`, validated, for Task 2.

- [ ] **Step 1: Confirm identity and permission**

```bash
gh api user --jq .login
gh api graphql -f query='{ repository(owner:"rexescario-dev",name:"clensy-platform"){ viewerPermission } }' --jq .data.repository.viewerPermission
```
Expected: `rexescario`, then `ADMIN`. Anything else: stop.

- [ ] **Step 2: Confirm there are no rules today (Review Focus 2)**

```bash
gh api 'repos/rexescario-dev/clensy-platform/rulesets?includes_parents=true' --jq 'length'
gh api repos/rexescario-dev/clensy-platform/rules/branches/main --jq 'length'
gh api repos/rexescario-dev/clensy-platform/branches/main/protection 2>&1 | grep -c 'Branch not protected'
```
Expected: `0`, `0`, `1`. If a ruleset exists, also confirm that no existing ruleset is named `main: required CI checks`. Then stop and report to the owner, because the spec assumed a clean start.

- [ ] **Step 3: Confirm check names and app on the current `main` head (Review Focus 1)**

```bash
git fetch origin main
gh api "repos/rexescario-dev/clensy-platform/commits/$(git rev-parse origin/main)/check-runs" \
  --jq '[.check_runs[] | select(.app.id == 15368) | .name] | sort'
```
Expected: `["API e2e","Lint","Release gate","Test"]`. If any check is still `in_progress`, wait for that run to finish and repeat. If the names differ: stop and return to M5.

- [ ] **Step 4: Re-read the Admin role id source**

```bash
gh api repos/integrations/terraform-provider-github/contents/docs/resources/repository_ruleset.md \
  -H 'Accept: application/vnd.github.raw' | grep -n -- '`admin` -> `5`'
```
Expected: one matching line. If there is none, stop and report. The payload's `actor_id` would then be unconfirmed before the POST.

- [ ] **Step 5: Write the payload**

```bash
WORK=$(mktemp -d)
cat > "$WORK/ruleset.json" <<'JSON'
{
  "name": "main: required CI checks",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["refs/heads/main"], "exclude": [] } },
  "rules": [
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "Lint", "integration_id": 15368 },
          { "context": "Test", "integration_id": 15368 },
          { "context": "Release gate", "integration_id": 15368 },
          { "context": "API e2e", "integration_id": 15368 }
        ]
      }
    }
  ],
  "bypass_actors": [
    { "actor_type": "RepositoryRole", "actor_id": 5, "bypass_mode": "pull_request" }
  ]
}
JSON
echo "$WORK"
```

- [ ] **Step 6: Validate the payload against spec §4.1**

```bash
jq -e '
  .name == "main: required CI checks" and .target == "branch" and .enforcement == "active"
  and .conditions.ref_name.include == ["refs/heads/main"] and .conditions.ref_name.exclude == []
  and (.rules | length) == 1 and .rules[0].type == "required_status_checks"
  and .rules[0].parameters.strict_required_status_checks_policy == true
  and .rules[0].parameters.do_not_enforce_on_create == false
  and ([.rules[0].parameters.required_status_checks[] | .context] | sort) == ["API e2e","Lint","Release gate","Test"]
  and ([.rules[0].parameters.required_status_checks[] | .integration_id] | unique) == [15368]
  and .bypass_actors == [{"actor_type":"RepositoryRole","actor_id":5,"bypass_mode":"pull_request"}]
' "$WORK/ruleset.json"
```
Expected: `true`, exit 0.

- [ ] **Step 7: Confirm the payload is outside the repository and in no documentation surface (Constraint 7)**

```bash
case "$WORK" in "$(git rev-parse --show-toplevel)"/*) echo "WORK is inside the repo"; false;; *) echo "WORK outside repo";; esac
git status --porcelain
payload_hits="$(git grep -l '"integration_id"' -- README.md docs/README.md .github/ || true)"
test -z "$payload_hits" && echo "no payload in documentation surfaces"
```
Expected:
- `WORK outside repo`;
- no `git status` output, which shows that creating the payload did not modify the repository;
- `no payload in documentation surfaces`.

### Task 2: Apply the ruleset (outward-facing; owner confirmation)

Spec §4.1, §4.2. No commit.

**Interfaces:**
- Consumes: `$WORK/ruleset.json` from Task 1.
- Produces: `RULESET_ID` (integer), for Tasks 3–5.

- [ ] **Step 1: Ask the owner for explicit confirmation**

Show the owner the validated `$WORK/ruleset.json` and the exact command in Step 2. Proceed only on an explicit "yes" given now (Constraint 4). If the owner declines, stop. The plan is then blocked, not failed.

- [ ] **Step 2: Send it**

```bash
RULESET_ID=$(gh api -X POST repos/rexescario-dev/clensy-platform/rulesets \
  -H 'X-GitHub-Api-Version: 2022-11-28' --input "$WORK/ruleset.json" --jq .id)
echo "$RULESET_ID"
```
Expected: a positive integer. On an HTTP error, record the message, change nothing else, and stop.

### Task 3: Read-back and direct-push verification (spec §8 V1, V1b, V4)

No commit. Evidence goes into the M6 record (Task 5).

**Interfaces:**
- Consumes: `RULESET_ID`.

- [ ] **Step 1: V1 — REST read-back**

```bash
gh api "repos/rexescario-dev/clensy-platform/rulesets/$RULESET_ID" > "$WORK/readback.json"
jq -e --slurpfile want "$WORK/ruleset.json" '
  .name == $want[0].name and .target == $want[0].target and .enforcement == $want[0].enforcement
  and .source_type == "Repository"
  and .conditions.ref_name == $want[0].conditions.ref_name
  and (.rules | length) == 1 and .rules[0].type == "required_status_checks"
  and .rules[0].parameters.strict_required_status_checks_policy == true
  and .rules[0].parameters.do_not_enforce_on_create == false
  and (.rules[0].parameters.required_status_checks | sort_by(.context)) == ($want[0].rules[0].parameters.required_status_checks | sort_by(.context))
  and ([.bypass_actors[] | {actor_type, actor_id, bypass_mode}]) == $want[0].bypass_actors
' "$WORK/readback.json"
```
Expected: `true`. If false, print `jq . "$WORK/readback.json"` and go to Step 4. Do not continue to Step 2.

- [ ] **Step 2: V1b — effective branch rules (secondary evidence)**

```bash
gh api repos/rexescario-dev/clensy-platform/rules/branches/main > "$WORK/effective.json"
jq -e --argjson id "$RULESET_ID" '
  length == 1 and .[0].type == "required_status_checks" and .[0].ruleset_id == $id
  and .[0].parameters.strict_required_status_checks_policy == true
  and ([.[0].parameters.required_status_checks[] | .context] | sort) == ["API e2e","Lint","Release gate","Test"]
' "$WORK/effective.json"
```
Expected: `true`. If the endpoint's shape differs from this, for example a missing `ruleset_id`, record the raw output in M6 and continue. The primary enforcement evidence is unaffected: V1 shows that the configuration matches the intended ruleset, V2 that pending checks block a PR, V3 that passing checks unblock it, and V4 that direct pushes are rejected (spec §8 V1b).

- [ ] **Step 3: Confirm the bypass actor is the Admin role (authoritative)**

```bash
gh api graphql -f query='{ repository(owner:"rexescario-dev",name:"clensy-platform"){
  rulesets(first:5){ nodes { databaseId name enforcement
    bypassActors(first:5){ nodes { bypassMode repositoryRoleName repositoryRoleDatabaseId } } } } } }' > "$WORK/graphql.json"
jq -e --argjson id "$RULESET_ID" '
  [.data.repository.rulesets.nodes[] | select(.databaseId == $id)] | length == 1
  and (.[0].bypassActors.nodes | length) == 1
  and (.[0].bypassActors.nodes[0].repositoryRoleName | ascii_downcase) == "admin"
  and .[0].bypassActors.nodes[0].repositoryRoleDatabaseId == 5
  and .[0].bypassActors.nodes[0].bypassMode == "PULL_REQUEST"
' "$WORK/graphql.json"
```
Expected: `true`. If false, report the observed `repositoryRoleName` and `repositoryRoleDatabaseId` and go to Step 4.

- [ ] **Step 4: Correction gate (only if Step 1 or Step 3 failed)**

Stop verification. A corrective `PUT` is an outward-facing change, like the POST, and needs its own explicit owner confirmation given now (Constraint 4). Which correction applies depends on which check failed:
- **Step 1 failed** (the stored ruleset differs from the validated payload): show the owner the difference and the command below. Only on an explicit "yes":
  ```bash
  gh api -X PUT "repos/rexescario-dev/clensy-platform/rulesets/$RULESET_ID" \
    -H 'X-GitHub-Api-Version: 2022-11-28' --input "$WORK/ruleset.json" --jq .id
  ```
  Then repeat Steps 1–3 from the start.
- **Step 3 failed** (the role behind `actor_id` 5 is not Admin): the payload itself is wrong, and this plan has no verified replacement id. Stop and return to M5. Leave the ruleset as it is unless the owner explicitly instructs otherwise, for example to disable or delete it. Do not guess another id.

If the owner declines, or the corrected ruleset does not pass Steps 1–3, M6 is blocked. Do not proceed to V4 until Steps 1–3 have all passed against the ruleset as it now stands. Record every correction, and its confirmation, in M6.

- [ ] **Step 5: Ask the owner for explicit confirmation of the V4 push**

This is a push to `main` that is expected to be rejected. Show the owner Step 6 and proceed only on an explicit "yes" given now (Constraint 4).

- [ ] **Step 6: V4 — a direct push to `main` is rejected (Review Focus 4)**

`git commit-tree` creates a commit object that no local branch, tag or working tree refers to. Nothing else in the repository changes.

```bash
git fetch origin main
PROBE=$(git commit-tree "origin/main^{tree}" -p origin/main -m "140 V4 probe: this push must be rejected")
git push origin "$PROBE:refs/heads/main" 2>&1 | tee "$WORK/v4.txt"; echo "exit=${PIPESTATUS[0]}"
git fetch origin main && test "$(git rev-parse origin/main)" != "$PROBE" && echo "main unchanged"
```
Expected:
- `exit=1`;
- `$WORK/v4.txt` contains `GH013` or "Repository rule violations", and names the required status checks;
- `main unchanged`.

If the push succeeds, that is a §5 invariant 2 failure. Stop, report the new `main` sha, and do nothing to `main` without the owner's explicit instruction.

- [ ] **Step 7: Clean up the probe locally**

```bash
git status --porcelain && git branch --contains "$PROBE" 2>/dev/null | wc -l
```
Expected: no `git status` output, and `0` branches. The dangling object is local and unreferenced, and normal `git gc` collects it. No remote cleanup is needed: the rejected push created nothing (Constraint 8).

### Task 4: Documentation and the `ci.yml` comment (spec §4.3)

**Files:**
- Modify: `README.md`, the "CI's **API e2e** job …" paragraph under "## Scripts (run from the repo root, via Turborepo)"
- Modify: `docs/README.md`, the paragraph under "## Tenant-aware audit & security sweep (#90)" that begins "These suites are metadata checks …"
- Modify: `.github/workflows/ci.yml`, the comment above `name: API e2e`

- [ ] **Step 1: Edit `README.md`**

Replace the sentence:

```text
The job is not a required status check.
```

with:

```text
Since [#140](https://github.com/rexescario-dev/clensy-platform/issues/140), `main` is governed by the repository ruleset **`main: required CI checks`**. It requires the **Lint**, **Test**, **Release gate** and **API e2e** checks, each reported by GitHub Actions, on a pull request branch that is up to date with `main`. A check that never reports blocks the merge just as a failing one does. The only bypass is the repository admin role, on pull requests only, so nothing is pushed directly to `main`. The four job names are part of the ruleset: renaming, removing or splitting one of those jobs in `.github/workflows/ci.yml` must update the ruleset in the same change, or every merge blocks. GitHub is the source of truth for this configuration: list the rulesets with `gh api repos/rexescario-dev/clensy-platform/rulesets` and read one with `gh api repos/rexescario-dev/clensy-platform/rulesets/<id>`. The bypass list is returned only to users with write access.
```

- [ ] **Step 2: Edit `docs/README.md`**

Replace:

```text
CI's **API e2e** job runs them, along with every other API e2e suite except the release gate, on every pull request and push to `main`.
```

with:

```text
CI's **API e2e** job runs them, along with every other API e2e suite except the release gate, on every pull request and push to `main`. Since [#140](https://github.com/rexescario-dev/clensy-platform/issues/140), it is a required check on `main`, as described in the root [README](../README.md#scripts-run-from-the-repo-root-via-turborepo).
```

- [ ] **Step 3: Edit the `ci.yml` comment**

Replace:

```yaml
    # without being classified fails CI instead of only local runs. Not a
    # required status check: `main` has no branch protection, and making
    # this check required is a separate decision.
```

with:

```yaml
    # without being classified fails CI instead of only local runs. Required
    # on `main` by the `main: required CI checks` ruleset (#140): do not
    # change `name:` without updating the ruleset in the same change.
```

- [ ] **Step 4: V5 — comment-only and docs checks (Review Focus 5)**

```bash
git fetch origin main
BASE=$(git merge-base HEAD origin/main)
git diff --quiet "$BASE" -- .github/workflows/ci.yml && { echo "ci.yml unchanged: expected a comment edit"; false; }
non_comment_diff="$(
  git diff --unified=0 "$BASE" -- .github/workflows/ci.yml |
    grep -E '^[+-][^+-]' |
    grep -vE '^[+-]\s*#' || true
)"
test -z "$non_comment_diff" && echo "non-comment workflow changes: none"
BASE="$BASE" python3 -c 'import os,subprocess,yaml; a=yaml.safe_load(subprocess.check_output(["git","show",os.environ["BASE"]+":.github/workflows/ci.yml"])); b=yaml.safe_load(open(".github/workflows/ci.yml")); assert a==b, "parsed YAML differs"; print("yaml equal: True")'
grep -c 'not a required status check' README.md; grep -c 'main: required CI checks' README.md .github/workflows/ci.yml; grep -c 'issues/140' docs/README.md
payload_hits="$(git grep -l '"integration_id"' -- README.md docs/README.md .github/ || true)"
test -z "$payload_hits" && echo "no payload in documentation surfaces"
```
Expected:
- no `ci.yml unchanged` line;
- `non-comment workflow changes: none`. Any other output, or a missing line, fails the check;
- `yaml equal: True`;
- `0`, then `README.md:1` and `.github/workflows/ci.yml:1`, then `1`;
- `no payload in documentation surfaces` (Constraint 7).

- [ ] **Step 5: Commit**

```bash
git add README.md docs/README.md .github/workflows/ci.yml
git commit -m "docs(140): document the main ruleset that requires the four CI checks"
```

### Task 5: PR, V2/V3, and the M6 record

**Interfaces:**
- Consumes: `RULESET_ID` and the evidence files in `$WORK`.

- [ ] **Step 1: Push the branch and open the PR (after Task 2, Review Focus 3)**

```bash
git push -u origin feat/140-required-ci-checks
gh pr create --base main --title "Require the four CI checks on main with a ruleset (#140)" --body "<summary; Closes #140; links to the spec and plan>"
```

The PR description ends with the attribution line the session requires for PR descriptions.

- [ ] **Step 2: V2 — pending blocks**

While at least one of the four checks is `pending` or `in_progress`:

```bash
gh pr view --json mergeStateStatus,statusCheckRollup --jq '{m: .mergeStateStatus, c: [.statusCheckRollup[] | {name, status, conclusion}]}'
```
Expected: `m == "BLOCKED"`, with at least one of the four not yet `COMPLETED`.

- [ ] **Step 3: V3 — green unblocks**

`gh pr checks --watch` only waits. Its exit status is not the assertion. The assertion is the `jq -e` below, made on the PR's current head:

```bash
gh pr checks --watch || true
gh pr view --json headRefOid,mergeStateStatus,statusCheckRollup > "$WORK/v3.json"
jq -e '
  ([.statusCheckRollup[]
     | select(.__typename == "CheckRun" and .workflowName == "CI"
              and (.name == "Lint" or .name == "Test" or .name == "Release gate" or .name == "API e2e"))
     | select(.status == "COMPLETED" and .conclusion == "SUCCESS")
     | .name] | sort) == ["API e2e","Lint","Release gate","Test"]
  and .mergeStateStatus == "CLEAN"
' "$WORK/v3.json" && jq -r .headRefOid "$WORK/v3.json"
```
Expected: `true`, then the head sha under test. All four required checks are `COMPLETED` with conclusion `SUCCESS` on that head, and `mergeStateStatus` is `CLEAN`. An unrelated check completing does not count.

If `mergeStateStatus` is `BEHIND`, `main` moved while the PR was open. Update the branch from `main` (`gh pr update-branch`) **only to satisfy the up-to-date requirement**. That creates a new PR head and a new CI cycle. Repeat V2 (Step 2) and V3 (this step) against the resulting head, and record both heads. Seeing `BEHIND` is itself evidence for the strict policy. If any required check fails, that is a real regression or a CI reliability defect (spec §7.1). Investigate it. Do not rerun until it is green.

The PR is merged at closeout, after M7–M9, without bypass.

- [ ] **Step 4: Record M6 in this plan and commit**

Append "### M6 — Implementation" under "## Gate outcomes". It records:
- `RULESET_ID`;
- the V1, V1b and GraphQL `jq` results;
- the V4 rejection message, quoted from `$WORK/v4.txt`;
- the V2 and V3 observations, with run ids;
- the V5 outputs;
- any deviation.

```bash
git add docs/superpowers/plans/2026-10-06-required-ci-checks-plan.md
git commit -m "docs(140): record the M6 outcome of the required CI checks plan"
git push
```
This push re-runs CI. The PR is again `BLOCKED` until green, which is further V2/V3 evidence.

- [ ] **Step 5: Remove the temporary directory**

Only after the M6 record (Step 4) is committed and contains every piece of evidence it lists:

```bash
rm -rf "$WORK" && test ! -e "$WORK" && echo "WORK removed"
```
Expected: `WORK removed`. The payload no longer exists outside GitHub, which is the source of truth (spec §7.6).

## Traceability

| Spec | Task |
| --- | --- |
| §4.1 ruleset content | 1 (Steps 5–6), 2, 3 (Steps 1, 3) |
| §4.1 Admin role id confirmation | Global Constraints, 1 (Step 4), 3 (Step 3) |
| §4.1 confirmation gate | 2 (Step 1), 3 (Steps 4–5) |
| §4.2 bypass semantics relied upon | 3 (Step 6), 5 (Steps 2–3) |
| §4.3 documentation | 4 |
| §5 invariants 1–7 | 1 (Steps 2, 7), 3 (Steps 6–7), 4 (Step 4), 5 (Step 5), Global Constraints |
| §8 V1, V1b | 3 (Steps 1–2) |
| §8 V2, V3 | 5 (Steps 2–3) |
| §8 V4 | 3 (Steps 5–7) |
| §8 V5 | 4 (Step 4) |

## Acceptance (M5/M6)

M6 is complete when:
- Task 1's preflight assertions held;
- the owner confirmed the POST and the V4 push;
- V1, the GraphQL role check, V4 and V5 printed their expected results;
- V1b is recorded, whether as expected or as a recorded difference;
- V2 and V3 were observed on the #140 PR.

## Out of scope

Spec §2 "Out of scope" and §11 deferrals: other rules, other branches, organization rulesets, ruleset as code, merge queue, required reviews, and any CI behavior change.

## Pre-validation

**Partial.** Run on 2026-10-06 against `main` at `56a4b2a`, with the expected results:
- Task 1 Steps 1–4, read-only;
- Task 1 Steps 5–6: the payload and the `jq` filter were extracted verbatim from this file into a scratch directory, and the filter printed `true`;
- the GraphQL introspection behind Task 3 Step 3, which confirmed that `repositoryRoleName`, `repositoryRoleDatabaseId` and `bypassMode` (`PULL_REQUEST`) exist.

Also run for the M5 revision:
- the V3 `jq` filter against PR #139's real `statusCheckRollup`: `true`;
- the V5 block against a scratch application of the Task 4 Step 3 comment edit: `non-comment workflow changes: none` and `yaml equal: True`;
- a negative V5 case, renaming `name: API e2e`, which the check detected; `ci.yml` was then restored;
- Task 1 Step 7: `WORK outside repo` and `no payload in documentation surfaces`.

Not run:
- Tasks 2–3, which need the outward-facing POST and push;
- Task 4 Step 4 on the committed doc edits (its README and docs/README `grep -c` lines have not run, because those edits do not exist yet);
- Task 5.

## Gate outcomes
