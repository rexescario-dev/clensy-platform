# React Hooks Lint Rules — Design

| Field | Value |
| --- | --- |
| Status | **Accepted** (revision 2), 2026-10-18 (M3). |
| M3 decision | **Accepted** — 2026-10-18, second pass, by the owner. The owner's qualification: the acceptance is of the revision 2 changes as described in the hand-off message for `3e42a14`, not a review of the complete committed file, so it does not certify that the rest of the document has no unrelated regressions. Execution constraints carried into M4: (1) the finding inventory is completed before any lint-configuration change is committed, and any production-source finding triggers the invariant 6 stop; (2) the acceptance evidence comes from actual runs (installed plugin version, rule IDs, file paths). The spec's assertions are requirements, not evidence that they pass. Does not authorize implementation and does not lift the pause on #193. |
| M3 history | First pass (2026-10-18, owner, reviewed `fe96b24`): **Returned for Revision**, findings M3-1 and M3-2 (P1) and M3-3 and M3-4 (P2). All are addressed in [Revision 2 (M3 review 1)](#revision-2-m3-review-1). Second pass (2026-10-18, owner, reviewed the revision summary for `3e42a14`): **Accepted**, with the qualification in the M3 decision row. The owner asked to keep unchanged: the three workspaces; exactly two explicitly registered rules at `error`; no preset; per-workspace dependencies with a consistent lockfile; the managed fragment untouched; no suppression, source-behavior change or CI change; separate issues and reviews for app-code fixes; version, config shape and task order left to M4. |
| Date | 2026-10-18 |
| Document kind | Process specification. It defines how React code in this repository is checked, not product behavior. |
| Tracking issue | [#196](https://github.com/rexescario-dev/clensy-platform/issues/196) "Enforce React Hooks lint rules in the React workspaces". Source: the `useEffect` audit at `d5d845e`, 2026-10-18, finding 1. Implemented in PR [#199](https://github.com/rexescario-dev/clensy-platform/pull/199). |
| Depends on | No Accepted specification. **Relies upon**, unchanged: the `Lint` CI job (`.github/workflows/ci.yml`, `pnpm run lint`) and its status as a required check on `main` ([Required CI Checks](2026-10-06-required-ci-checks-design.md), Accepted); the installer-managed fragment `tooling/eslint.contextforge.mjs` (`javascript-conventions` 0.3.0, `workflow.yaml`). |
| Followed by | [#193](https://github.com/rexescario-dev/clensy-platform/issues/193), whose Accepted plan adopts `useEffectEvent` only after this slice merges. The AppSidebar `useEffectEvent` follow-up named in #196. |
| Slice type | Configuration-only, in-repository (ESLint config, dev dependencies, lockfile). No live setting outside the repository, so the [configuration-change convention](../../workflows/conventions/configuration-change.md) does not apply. Under `CLAUDE.md`, M7 may be a labelled **self-review**. |

## 1. Primary question and thesis

**Question:** How does this repository enforce the Rules of Hooks and complete Effect dependency arrays in the code that uses React hooks, so that later work adopting `useEffectEvent` (#193 first) is checked by a tool rather than by review alone?

**Thesis:** The three workspaces that author React code each enable exactly two rules from `eslint-plugin-react-hooks`, `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps`, at `error` severity, in their own project-owned `eslint.config.mjs`. The existing required `Lint` job then fails any pull request that breaks either rule. Nothing else about linting, CI or application behavior changes.

### 1.1 Background (state on `main` at `d5d845e`, verified 2026-10-18)

- No ESLint config enables `eslint-plugin-react-hooks`. It is absent from every `package.json` and from `pnpm-lock.yaml`.
- Workspaces with React code: `apps/web` (55 `.tsx` files, 35 files calling hooks), `packages/ui` (34 and 3), `packages/web` (21 and 3). `apps/api` declares `react` but has no `.tsx` file and calls no hooks. `packages/client`'s hooks are generated (`src/generated/graphql.ts`).
- Each of the three workspaces has a project-owned `eslint.config.mjs` built with `tseslint.config(...)`, spreading `contextforgeJavascript({ eslint, tseslint })` from the managed fragment. Lint scripts: `apps/web` runs `eslint .`; `packages/ui` and `packages/web` run `eslint src`. ESLint is 9.39.5 in all three.
- CI's `Lint` job runs `pnpm run lint` (Turbo, every workspace's `lint`). No `--max-warnings` flag is passed, so ESLint warnings do not fail it and errors do.
- The latest stable `eslint-plugin-react-hooks` is 7.1.1 (2026-04-17). Its peer range includes ESLint 9. Its recommended presets add React Compiler–derived rules beyond the two above.
- The audit checked all 27 production Effects by hand and found no missing dependencies.

## 2. Scope

**In scope (normative):**

1. `eslint-plugin-react-hooks` as a devDependency of exactly `apps/web`, `packages/ui` and `packages/web`, each declaring it in its own `package.json` (the managed fragment's header requires per-package installation of plugins). The version is one M4 selects whose **installed** behavior passes §5 invariants 5 and 7. #196's floor of major version 6 is a lower bound only. This spec does not claim that every release from 6 on recognizes `useEffectEvent` (M3-4).
2. In each of those three packages' project-owned `eslint.config.mjs`: the plugin registered under the `react-hooks` namespace, and the two rules `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` set to `error`, for every file that package's `lint` script checks.
3. `pnpm-lock.yaml` updated to match.
4. Every finding the new rules raise on the existing code, handled per §5 invariant 6.

**Informative:** the plugin's own documentation; the audit at `d5d845e`.

**Out of scope:** see §4 (non-goals) and §8 (deferrals).

## 3. Terminology

- **The two rules:** `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps`, and no other `react-hooks/*` rule.
- **React workspaces:** `apps/web`, `packages/ui`, `packages/web`.
- **Effective rule set:** the rules ESLint actually applies to a given file, as reported by `eslint --print-config <file>`.
- **Finding:** a diagnostic either rule reports on the code as it stands when the rules are turned on.
- **Gating:** a rule violation makes `pnpm run lint` exit non-zero, so the required `Lint` check fails.

## 4. Goals, non-goals and anti-goals

**Goals**

1. A violation of either rule in any React workspace fails `pnpm run lint` and therefore the required `Lint` check.
2. The rules recognize `useEffectEvent` (React 19.2.8): its call-site restrictions are enforced, and an effect event is not demanded as an Effect dependency.
3. Every existing finding is either fixed without an application-code change, or recorded in the PR with a link to its own issue.

**Non-goals**

- No React Compiler–derived rule, and no other `react-hooks/*` rule beyond the two. Adopting those needs its own decision.
- No edit to `tooling/eslint.contextforge.mjs`. It is installer-managed and can be overwritten.
- No plugin in `apps/api`, `packages/client` or any other workspace.
- No change to any application or library source behavior. A finding whose fix needs one gets its own issue and its own fresh independent review; it does not widen this slice.
- No change to the `Lint` job, Turbo pipeline, lint scripts or CI configuration.
- No `useEffectEvent` adoption (that is #193 and the AppSidebar follow-up).

**Anti-goals (a failure even if lint passes)**

- Passing lint by suppressing findings (`eslint-disable`, per-file overrides, `off` severity or narrowed `files` globs).
- Rules at `warn`, which CI would ignore.
- A preset spread that silently brings in extra rules.

## 5. Invariants and boundaries

1. In each React workspace, the effective `react-hooks/*` rule set for that workspace's linted files is exactly the two rules, both at `error`. It is checked **separately for each workspace**, on at least one non-test `.tsx` file and one test file that the workspace's `lint` script covers (M3-3):
   - Run `eslint --print-config <file>` from the workspace directory and extract every rule ID that starts with `react-hooks/`, for example with `jq '.rules | with_entries(select(.key | startswith("react-hooks/")))'`.
   - The extracted set must be exactly `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps`, each at severity `2` (printed as `2` or as an array whose first element is `2`). Any other `react-hooks/*` key, at any severity including `0`, fails the check.
   - `--print-config` reports the final merged config, so the check covers rules inherited from any spread or base config, not only the block this slice adds.
   - The PR records, for each workspace, the file paths checked and the extracted output.
2. The plugin is registered explicitly. The configs MUST NOT spread `reactHooks.configs.*` or any other preset that adds `react-hooks/*` rules.
3. `tooling/eslint.contextforge.mjs` is byte-for-byte unchanged, and its `workflow.yaml` digest still matches.
4. Each React workspace's `package.json` declares the plugin, and `pnpm-lock.yaml` agrees: `pnpm install --frozen-lockfile` succeeds.
5. The rules are demonstrably active. In each React workspace, a throwaway violation of each rule makes `pnpm --filter <workspace> lint` fail with that rule's id, and is reverted. The violation is never committed.
6. **Finding inventory and owner decision gate (M3-1).** Existing findings MUST NOT be suppressed, and the rules MUST NOT be weakened, to pass lint. The suppressions and weakenings forbidden here include `eslint-disable` comments, `off` or `warn` severity, rule options that narrow either rule, and `files`/`ignores` globs that exclude linted code.
   1. **Inventory first.** Before any implementation commit, the two rules are run, at `error`, over every file each React workspace's `lint` script covers. Every finding is recorded with workspace, file, line, rule ID and message. M4 decides whether the inventory is a throwaway planning probe or the first M6 step. It is taken against the base the slice will merge into.
   2. **Classify each finding.** Either (a) it can be fixed by a change that alters no runtime behavior, in test-only code or in configuration this spec allows, or (b) its fix needs a production-source change.
   3. **Gate.** If every finding is class (a), the slice fixes them and proceeds. If any finding is class (b), the slice **stops** before committing the lint configuration. It presents the class (b) findings and affected files to the owner, each with a draft issue. The owner then chooses one of three paths: the application fix lands first in its own issue and slice (with its own fresh independent review), and this slice resumes on the updated base; this slice waits; or another sequencing the owner authorizes explicitly and records in the PR. Whichever path is chosen, no class (b) fix is made in this slice.
   4. **No merge on red.** This slice is not merged while `Lint` fails. A path that would merge it with a failing required check is not available under this gate.
7. **`useEffectEvent` is recognized by the installed version (M3-2).** This is checked against the exact plugin version in `pnpm-lock.yaml`, through each React workspace's real config, using a throwaway component file that is never committed. Each case's diagnostics are read as structured output (for example `eslint --format json`), and the assertions are on rule IDs, not on whether lint failed:
   - **Case A, omitted from deps (accepted):** an Effect calls an effect event from `useEffectEvent` and lists only its other dependencies. No message has rule ID `react-hooks/exhaustive-deps` or `react-hooks/rules-of-hooks`.
   - **Case B, called outside an Effect (rejected):** the same effect event is called during render. At least one message has rule ID exactly `react-hooks/rules-of-hooks`, and its line is the line of the call.
   - **Case C, control:** an ordinary missing dependency in the same file produces a message with rule ID exactly `react-hooks/exhaustive-deps`. This shows that Case A's silence comes from recognition of the effect event, not from the rule being inactive.
   The PR records the plugin version and each case's rule IDs and lines. A version that fails any case does not satisfy §2 item 1.
8. The only files that change are the three `eslint.config.mjs` files, the three `package.json` files, `pnpm-lock.yaml`, this slice's spec and plan, and test-only code that §5 invariant 6 permits. No production source file changes.
9. `pnpm run lint` passes in CI on the PR head, as part of the required checks.

## 6. Rationale

- **Two rules, set explicitly (owner scope in #196).** These two are what the audit relied on reviewers for. Plugin 7's recommended presets add React Compiler–derived rules whose findings would be a separate review and a separate decision. Explicit registration keeps the effective set exactly what this spec names, and invariant 1 makes that checkable.
- **`error`, not `warn` (my call, matching the issue's gating criterion).** CI's `Lint` job passes no `--max-warnings`, so warnings never fail the build. Only `error` gates.
- **Project-owned configs, not the managed fragment.** The fragment is overwritten on installer update. The three project configs are the documented extension point, as their existing `no-restricted-imports` and `sort-keys` overrides show.
- **Per-package devDependency.** The fragment's header requires plugins to resolve from the package, not from `tooling/` or by hoisting.
- **Version chosen by behavior, not by range.** The floor of 6 is #196's own. It is not evidence of `useEffectEvent` support, so M4 picks a version and invariant 7 proves that version on the installed copy. The latest stable at drafting was 7.1.1, which this spec has not verified (§8).
- **No suppression, and an explicit gate instead.** The point of the slice is enforcement. A suppression added to pass lint would hide exactly what the rules exist to catch. Because `Lint` is a required check, an unfixed finding blocks the merge, so invariant 6 makes the owner's sequencing decision an explicit step taken before implementation, not something found at merge time.

## 7. Worked examples (non-normative)

- A component calls `useState` inside an `if`. `rules-of-hooks` reports it at `error`, and `pnpm run lint` exits 1.
- An Effect reads `onClose` but its array is `[open]`. `exhaustive-deps` reports the missing dependency at `error`.
- An Effect calls `const onEscape = useEffectEvent(...)` and lists `[open]`. Neither rule reports it (goal 2).
- The rules find a missing dependency in `apps/web/lib/foo.ts` whose fix would change when an Effect re-runs. That is an application-code change, class (b). The inventory finds it before implementation. The slice stops and presents it with a draft issue, and the owner chooses the path (invariant 6.3).

## 8. Deferrals and decisions left to M4

- **Exact plugin version and range** (for example `^7.1.1`): M4, which must select a version whose installed behavior passes invariants 5 and 7.
- **When the finding inventory runs** (planning probe or first M6 step): M4, within invariant 6.1.
- **Config shape** (one block per config with `files` matching what the lint script checks, or another layout): M4, within invariants 1–2.
- **Task order and how findings are reviewed**: M4.
- **React Compiler–derived rules**: a later issue, if wanted.
- **AppSidebar `useEffectEvent` adoption, and #193**: separate slices that follow this one.

## 9. Traceability

| Source | This spec |
| --- | --- |
| #196 Scope: plugin 6+, per package, flat config | §2 items 1–2; §5 invariant 4 |
| #196 Scope: project-owned configs only; do not edit the managed fragment | §2 item 2; §4; §5 invariant 3 |
| #196 Scope: explicit rules, no preset; show the effective set | §5 invariants 1–2 |
| #196 Scope: lockfile | §2 item 3; §5 invariant 4 |
| #196 Scope: review every finding; no suppression; app-code fixes go to separate issues | §4; §5 invariant 6 (inventory, classification, owner gate, no merge on red) |
| #196 Scope: verify with React 19.2.8, Next.js 16.3, flat config; `useEffectEvent` recognized | §5 invariant 7 |
| #196 Acceptance: throwaway violation per rule | §5 invariant 5 |
| #196 Acceptance: CI lint passes; severity gates CI | §5 invariants 1, 9; §6 |
| #196 Acceptance: no application behavior change | §4; §5 invariant 8 |
| [Required CI Checks](2026-10-06-required-ci-checks-design.md) (Accepted): `Lint` is a required check | **Relies upon**, unchanged |

## 10. Acceptance criteria for this specification

M3 may move this specification from Draft to Accepted when it confirms that:

1. The scope names exactly the three React workspaces and the two rules, and gives a reason for leaving out `apps/api` and `packages/client`. The version is tied to verified behavior, not to a range.
2. The invariants make "exactly two rules, at `error`" and "no preset" checkable from the PR, per workspace, through an extraction of the effective `react-hooks/*` rule set.
3. The rules for handling findings forbid suppression, keep any application-code change out of this slice, and define an inventory and an owner decision gate that runs before implementation.
4. Gating is tied to the `Lint` job's actual severity behavior.
5. `useEffectEvent` recognition is verified on the installed version, through rule-ID assertions with a control case, because #193 depends on it.
6. Nothing in it conflicts with the Accepted Required CI Checks specification, or edits installer-managed files.
7. It leaves the version, the config shape and the task order to M4.

## Revision 2 (M3 review 1)

M3 first pass (owner, 2026-10-18, reviewed `fe96b24`): **Request changes**.

| Finding | Resolution |
| --- | --- |
| M3-1 (P1) Invariant 6's stop condition is ambiguous | Invariant 6 is now an explicit gate: inventory every finding before any implementation commit; classify each as (a) fixable with no runtime change or (b) needing a production-source change; on any (b), stop before committing the config and present the findings, the affected files and draft issues to the owner. The owner chooses: the app fix lands first, this slice waits, or another sequencing the owner authorizes and records. No suppression or weakening (each kind listed), and no merge while `Lint` is red. Rationale and worked example updated. |
| M3-2 (P1) Invariant 7 does not isolate `rules-of-hooks` | Invariant 7 now runs on the exact installed version, through each workspace's real config, and asserts rule IDs from structured output. Case A: an omitted effect event gets no `react-hooks/*` message. Case B: a call during render gets `react-hooks/rules-of-hooks` on the call's line. Case C (control): an ordinary missing dependency gets `react-hooks/exhaustive-deps`, which shows that A's silence is recognition, not an inactive rule. |
| M3-3 (P2) Effective rule-set inspection is imprecise | Invariant 1 now extracts the `react-hooks/*` keys from `--print-config` per workspace, on a non-test `.tsx` file and a test file. The set must be exactly the two rules at severity `2`; any other key, even at `0`, fails. The merged config covers inherited rules. The PR records the paths and outputs. |
| M3-4 (P2) The version floor overstates compatibility | §2 item 1 now requires M4 to select a version whose installed behavior passes invariants 5 and 7. The floor of 6 is called a lower bound, and the spec does not claim the range is verified. Rationale and §8 updated. |

