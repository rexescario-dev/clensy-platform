# Required CI Checks on `main` — Design

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-10-06 |
| Document kind | Process specification |
| Tracking issue | [#140](https://github.com/rexescario-dev/clensy-platform/issues/140) — follow-on from [#135](https://github.com/rexescario-dev/clensy-platform/issues/135), which created the **API e2e** job and deferred making it required, and [#138](https://github.com/rexescario-dev/clensy-platform/issues/138), which made the job's only known flaky test deterministic. |
| Depends on | No Accepted specification. **Relies upon**, unchanged: the four CI jobs in `.github/workflows/ci.yml` as created by [the two-tenant release gate plan](../plans/2026-10-02-two-tenant-release-gate-plan.md) (#92, `Release gate`) and [the tenant-read sweep and guard hardening plan](../plans/2026-10-06-tenant-read-sweep-and-guard-hardening-plan.md) (#135, `API e2e`). This spec **constrains** them: their job names become a contract (§5 invariant 3). |
| Followed by | None. |
| M3 decision | **Accepted** — 2026-10-06, at `c0b918f`, by the owner, on the first pass, with no revision. The owner's design-review conditions (verify the `pull_request` bypass semantics and the effective-rules endpoint rather than rely on UI wording; state the no-direct-push invariant directly; V4 from a disposable local commit; check for ruleset name collisions; allow only a comment edit in `ci.yml`) were applied in the Draft before acceptance. M4 implements it mechanically and MUST keep: one active ruleset on `refs/heads/main`; the four checks pinned to `integration_id` 15368; strict policy; the Admin role as the only bypass actor, `pull_request` mode; no CI behavior change; GitHub as the single source of truth; and the ruleset POST behind an explicit owner confirmation at the moment it runs. |

## 1. Primary question and thesis

**Question:** How is a pull request with a failing, or missing, CI check prevented from merging into `main`?

**Thesis:** One active **repository ruleset** on `main` requires the four existing GitHub Actions checks (`Lint`, `Test`, `Release gate`, `API e2e`), each pinned to the GitHub Actions app, with the strict up-to-date policy. Its only bypass is the repository **Admin** role, limited to pull requests. GitHub is the single source of truth for the configuration. The repository docs describe it and do not copy it. CI behavior does not change.

### 1.1 Background (state on `main` at `56a4b2a`, verified 2026-10-06)

- `rexescario-dev/clensy-platform` is a **public** repository owned by an organization on the **free** plan. Repository rulesets and classic branch protection are both available.
- `main` has no protection and no rulesets:
  - `GET /repos/{o}/{r}/branches/main/protection` → `404 Branch not protected`;
  - `GET /repos/{o}/{r}/rulesets?includes_parents=true` → `[]`, so no organization ruleset applies either;
  - `GET /repos/{o}/{r}/rules/branches/main` → `[]`.
- CI (`.github/workflows/ci.yml`, workflow `CI`) runs on every `pull_request` and every `push` to `main`. It has four jobs. Their check runs on `56a4b2a` are reported by the `github-actions` app, `app.id` **15368**:

  | Job id | Check-run name |
  | --- | --- |
  | `lint` | `Lint` |
  | `test` | `Test` |
  | `release-gate` | `Release gate` |
  | `api-e2e` | `API e2e` |

- **API e2e** history since #135, at job level: 8 runs, 6 green, 2 red. Both failures are triaged:
  - `6cf58d0` (PR #137): a real defect. `app.e2e-spec.ts` returned 404 for the unbuilt, gitignored GraphiQL bundle. It was fixed in that PR by the `build:graphiql` step.
  - `7f93ffb` (`main`, the #137 merge): the flaky concurrent `createPricingRule` test, made deterministic by #138.

  It has been green on all 3 runs since #138. `Lint`, `Test` and `Release gate` have been green on every run in the same window.
- The repository's docs state the opposite of the target:
  - root `README.md` ("CI's **API e2e** job …") ends with "The job is not a required status check.";
  - the `api-e2e` job comment in `ci.yml` says "Not a required status check: `main` has no branch protection, …".

## 2. Scope

### In scope (normative)

1. One repository ruleset on `main` with the content in §4.1.
2. Documentation of that configuration in root `README.md`, `docs/README.md` and the `api-e2e` job comment in `ci.yml` (§4.3).
3. Verification that the ruleset is in effect and enforces §6 (§8).

### Informative

- The ruleset changes how *every* change reaches `main`, not only how API e2e is treated. That is intended (owner decision, 2026-10-06).

### Out of scope (normative)

- Any change to CI behavior. See §5 invariant 4.
- Any other ruleset rule: required reviews, required pull requests as a separate rule, signed commits, linear history, deletion or force-push rules, merge-queue.
- Rulesets or protection for any branch other than `main`, and organization-level rulesets.
- Committing the ruleset as code: a JSON snapshot, Terraform, or a sync script.
- A stability-bar waiting period before enabling (§7.1).

## 3. Terminology

- **Ruleset** — a GitHub repository ruleset (REST: `/repos/{owner}/{repo}/rulesets`). It is not classic branch protection.
- **Required check** — an item of the ruleset's `required_status_checks` rule. Each item has a `context` (here, a check-run name) and an `integration_id` (the app that must report it).
- **Strict policy** — `strict_required_status_checks_policy: true`: "pull requests targeting a matching branch must be tested with the latest code" (GitHub REST docs). In practice, the PR branch must be up to date with `main`.
- **Bypass actor** — an entry of the ruleset's `bypass_actors`. `bypass_mode: pull_request` means, in GitHub's API docs, that the actor "can only bypass on pull requests". The ruleset docs ("Creating rulesets for a repository", option **For pull requests only**) say the actor "is now required to open a pull request to make changes to a repository … The actor can then choose to bypass any branch protections and merge that pull request."
- **Effective branch rules** — the response of `GET /repos/{owner}/{repo}/rules/branches/main`, which per GitHub's docs "returns all active rules that apply to the specified branch", from repository and organization rulesets. Rulesets with `evaluate` or `disabled` enforcement are excluded.

## 4. Contracts

### 4.1 The ruleset

Exactly one repository ruleset with this content. Field names are the REST API's.

| Field | Value |
| --- | --- |
| `name` | `main: required CI checks`. Verified on 2026-10-06 not to collide with any existing ruleset, since there are none. The name is a label, not a contract. The contract is the target, conditions, rules and bypass below. |
| `target` | `branch` |
| `enforcement` | `active` |
| `conditions.ref_name.include` | `["refs/heads/main"]`: `main` named explicitly, not `~DEFAULT_BRANCH` |
| `conditions.ref_name.exclude` | `[]` |
| `rules` | exactly one rule, of `type: required_status_checks`, with the parameters below |
| `rules[0].parameters.required_status_checks` | `{context: "Lint", integration_id: 15368}`, `{context: "Test", integration_id: 15368}`, `{context: "Release gate", integration_id: 15368}`, `{context: "API e2e", integration_id: 15368}` |
| `rules[0].parameters.strict_required_status_checks_policy` | `true` |
| `rules[0].parameters.do_not_enforce_on_create` | `false` |
| `bypass_actors` | exactly one: `{actor_type: "RepositoryRole", actor_id: <Admin role id>, bypass_mode: "pull_request"}` |

The Admin repository role's `actor_id` is conventionally `5`. GitHub's REST reference does not list role ids, so this spec does not treat `5` as verified. Before the ruleset is applied, M4/M6 MUST confirm the id. After it is applied, the read-back (§8 V1) MUST show that the bypass actor is the Admin role. If it isn't, the ruleset is corrected before verification continues.

The ruleset is applied with `POST /repos/rexescario-dev/clensy-platform/rulesets`, using the owner's authenticated `gh`. That POST is an outward-facing action. It MUST be confirmed explicitly by the owner at the moment it runs, not only by acceptance of this spec or of the M4 plan. The plan MAY fully state and validate the payload beforehand without sending it.

### 4.2 Bypass

- The only bypass actor is the repository **Admin** role, in `pull_request` mode (§4.1).
- The spec relies on GitHub's documented meaning of that mode (§3), not on any UI wording. §8 verifies the behavior it relies on:
  1. an Admin's direct push to `main` is rejected (V4);
  2. a PR is blocked until its checks pass (V2, V3).
- This spec does not require verifying the Admin's PR bypass by actually performing one. That would mean merging a PR with a failing check into `main`. It is the documented escape hatch, for example during a GitHub Actions outage. Using it is an owner decision at the time, outside the normal flow.

### 4.3 Documentation

GitHub is the single source of truth. The live ruleset can be inspected with `gh api repos/rexescario-dev/clensy-platform/rulesets`, with one caveat: per GitHub's docs, `bypass_actors` is returned only to callers with write access to the ruleset. The repository docs describe the configuration. They MUST NOT embed a copy of the payload.

1. **Root `README.md`**, "CI's **API e2e** job …" paragraph: replace "The job is not a required status check." with text stating:
   - that `main` is governed by the ruleset `main: required CI checks` (#140);
   - that it requires `Lint`, `Test`, `Release gate` and `API e2e`, each reported by GitHub Actions;
   - that the PR branch must be up to date with `main`;
   - that a missing check blocks the merge the same way a failing one does;
   - that the only bypass is repository admins, on pull requests only, so nobody pushes directly to `main`;
   - that renaming any of the four jobs requires updating the ruleset in the same change (§5 invariant 3);
   - how to inspect the live ruleset (above).
2. **`docs/README.md`**, the #135 sentence about CI's **API e2e** job: add that the job is a required check on `main` since #140, linking to the root README paragraph rather than repeating it.
3. **`.github/workflows/ci.yml`**, `api-e2e` job comment: replace the sentence "Not a required status check: `main` has no branch protection, and making this check required is a separate decision." with a comment saying that the check is required on `main` by the `main: required CI checks` ruleset (#140), and that its `name:` must not change without updating the ruleset. The comment change is the only edit to `ci.yml` (§5 invariant 4).

## 5. Invariants (MUST / MUST NOT)

1. `main` MUST have exactly the ruleset in §4.1 as its only source of rules from this slice. Classic branch protection MUST NOT be added alongside it.
2. **No direct push to `main`.** Every change reaches `main` through a pull request whose four required checks, reported by GitHub Actions, passed on a head that is up to date with `main`. The one exception is a deliberate admin bypass on a pull request.
3. **Job names are a contract.** The check-run names `Lint`, `Test`, `Release gate` and `API e2e` MUST stay exactly as they are. Renaming, removing or splitting any of the four jobs MUST update the ruleset in the same change. Otherwise every merge blocks.
4. **No CI behavior change.** #140 MUST NOT change any job id, job `name:`, trigger, step, condition, environment or other executable content of `.github/workflows/`. The ruleset consumes the four existing job names exactly as GitHub Actions currently reports them. The only permitted edit is the comment in §4.3 item 3.
5. A required check MUST be pinned to `integration_id` 15368 (GitHub Actions). A status of the same name from any other source MUST NOT satisfy it.
6. Repository docs MUST NOT contain a copy of the ruleset payload (§4.3).
7. Verification MUST NOT leave any artifact on the remote: no extra branch, commit, tag or PR beyond the #140 PR itself (§8 V4).

## 6. Goals and non-goals

**Goals**

- A PR into `main` whose `API e2e`, `Lint`, `Test` or `Release gate` check fails, or never reports, cannot be merged except through the admin PR bypass.
- The docs and the `ci.yml` comment no longer say the job is not required, and they name the configuration.

**Non-goals**

- Changing CI jobs, their triggers or their run time.
- Requiring reviews or approvals, or any rule other than required status checks.
- Codifying the ruleset in the repository, or automating drift detection.
- Protecting branches other than `main`.
- Retroactive stability gating (§7.1).

## 7. Rationale

### 7.1 Enable now, with no stability bar

Both API e2e failures are triaged: one real defect fixed in its PR, and one flake fixed by #138. A consecutive-green count or a time window would be an arbitrary delay with no new information. After this slice, any API e2e failure is treated as either a real regression or a CI reliability defect, and is investigated as such. It is not normalized by rerunning. Owner decision, 2026-10-06.

### 7.2 All four checks, not only API e2e

All four are consistently green. Requiring only API e2e would leave `Release gate`, the tenant-isolation release criterion from #92, and the `Lint` and `Test` baseline advisory. That is inconsistent with what `main` is meant to guarantee. Owner decision, 2026-10-06.

### 7.3 Ruleset over classic branch protection

A ruleset:
- pins each check to an app;
- has an explicit bypass list with a pull-request-only mode;
- can be read through the API on a public repo, apart from the bypass list;
- leaves a path to future rules without migrating from classic protection.

Classic protection has only a coarse "include administrators" toggle, and you need admin access to read it. Owner decision, 2026-10-06.

### 7.4 Admin bypass, pull requests only

With no bypass, a GitHub Actions outage or a broken CI dependency could only be worked around by disabling the ruleset. That is a larger and less visible step than a per-PR bypass. "Always" bypass would allow unchecked direct pushes. `pull_request` mode keeps an escape hatch that leaves a PR and an audit-log trail, and still forbids direct pushes. Owner decision, 2026-10-06.

### 7.5 Strict up-to-date policy

It makes the tested head effectively the merged tree, which catches PRs that each pass alone but conflict semantically. The cost is low here: `main` rarely moves while a PR is open, and catching up is one "Update branch" plus a CI rerun. Owner decision, 2026-10-06.

### 7.6 GitHub as the single source of truth

A committed JSON snapshot would drift silently from the live ruleset, and nothing enforces their equality. On a public repo the live ruleset can be inspected directly. The docs describe the intent and the rename contract, which is what a contributor needs.

## 8. Verification contract

Each item is checked after the ruleset is applied, with evidence recorded in the M6 outcome.

- **V1 — Ruleset read-back.** `GET /repos/{o}/{r}/rulesets/{id}`, as the owner, returns exactly the §4.1 content: name, target, enforcement, conditions, the one rule with the four `{context, integration_id: 15368}` items, strict `true`, `do_not_enforce_on_create` `false`, and one bypass actor with `actor_type: RepositoryRole`, the Admin role id and `bypass_mode: pull_request`.
- **V1b — Effective branch rules.** Per GitHub's docs, `GET /repos/{o}/{r}/rules/branches/main` returns the active rules for the branch. It returned `[]` before the change (§1.1). After the change, it returns exactly one `required_status_checks` rule whose parameters match V1, tagged with this ruleset's id. If the endpoint's observed behavior differs from its docs, M6 records that, and V1, V2, V3 and V4 remain the authority. The spec does not depend on this endpoint alone.
- **V2 — Pending blocks.** On the #140 PR, while any required check is pending, `gh pr view --json mergeStateStatus` reports `BLOCKED`.
- **V3 — Green unblocks.** On the #140 PR, once all four checks pass on a head up to date with `main`, `mergeStateStatus` is no longer `BLOCKED` (expected `CLEAN`), and the PR merges normally, without bypass.
- **V4 — No direct push.** From a disposable **local** commit, which is never pushed to any other ref, the owner pushes to `main`, for example `git push origin <local-sha>:refs/heads/main`. The push is rejected with a ruleset violation naming the required checks. Afterwards the local commit is discarded, and nothing exists on the remote except the #140 PR. A rejected push creates nothing on the remote. If the push unexpectedly succeeds, that is a §5 invariant 2 failure: M6 stops, reports it, and restores `main` only with the owner's explicit instruction.
- **V5 — Docs.** `README.md`, `docs/README.md` and the `ci.yml` comment satisfy §4.3. `git diff main -- .github/workflows/ci.yml` changes comment lines only.

Verifying a failing check by deliberately breaking a check is not required. Pending blocking (V2) and the strict ruleset content (V1) cover "fails or never reports" without creating a throwaway red PR.

## 9. Traceability

| Source | Relationship |
| --- | --- |
| [#135](https://github.com/rexescario-dev/clensy-platform/issues/135) / [plan](../plans/2026-10-06-tenant-read-sweep-and-guard-hardening-plan.md) | Created `API e2e` and deferred making it required. This spec **ends** that deferral. The job is otherwise **relied upon** unchanged. |
| [#138](https://github.com/rexescario-dev/clensy-platform/issues/138) / [plan](../plans/2026-10-06-deterministic-pricing-rule-race-tests-plan.md) | Removed the only known flake. **Relied upon** as the basis of §7.1. |
| [#92](https://github.com/rexescario-dev/clensy-platform/issues/92) / [plan](../plans/2026-10-02-two-tenant-release-gate-plan.md) | Created `Release gate`. **Relied upon** unchanged. Becoming required is consistent with its role as the multi-tenancy release criterion. |
| [Multi-Tenant Architecture](2026-09-23-multi-tenant-architecture-design.md) | Not changed. Requiring `Release gate` enforces in the merge flow the #92 release gate named in that spec's Tracking row. |

## 10. Acceptance criteria (for this specification)

This spec may move from Draft to Accepted at M3 when the reviewer agrees that:

1. §4.1 fully determines the ruleset payload, with the one stated open value (the Admin role id) and how it is confirmed.
2. §4.2 relies on GitHub's documented `pull_request` bypass semantics, not on UI wording, and §8 verifies the parts it relies on.
3. §5 invariant 2 states the no-direct-push invariant directly.
4. §5 invariant 4 rules out every CI behavior change, and allows only the §4.3 comment edit.
5. §8 V4 leaves no remote artifacts, and V1b does not make the spec depend on an unconfirmed endpoint.
6. The documentation scope (§4.3) and GitHub as the single source of truth (§7.6) are acceptable.

## 11. Explicit deferrals

- Required reviews or approvals on `main`, and any other ruleset rule.
- Codifying the ruleset in the repository, or drift detection between docs and the live ruleset.
- A merge queue, which strict mode makes more attractive as PR volume grows.
- Rules for other branches, and organization-level rulesets.
