# React Hooks Lint Rules — Design

| Field | Value |
| --- | --- |
| Status | **Draft** (M2), 2026-10-18. Ready for Design Review (M3). |
| Date | 2026-10-18 |
| Document kind | Process specification. It defines how React code in this repository is checked, not product behavior. |
| Tracking issue | [#196](https://github.com/rexescario-dev/clensy-platform/issues/196) "Enforce React Hooks lint rules in the React workspaces". Source: the `useEffect` audit at `d5d845e`, 2026-10-18, finding 1. |
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

1. `eslint-plugin-react-hooks`, major version 6 or later, as a devDependency of exactly `apps/web`, `packages/ui` and `packages/web`, each declaring it in its own `package.json` (the managed fragment's header requires per-package installation of plugins).
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

1. In each React workspace, the effective `react-hooks/*` rule set for that workspace's linted files is exactly the two rules, both at `error` (severity 2). The PR shows this with `eslint --print-config` output for at least one `.tsx` file per workspace.
2. The plugin is registered explicitly. The configs MUST NOT spread `reactHooks.configs.*` or any other preset that adds `react-hooks/*` rules.
3. `tooling/eslint.contextforge.mjs` is byte-for-byte unchanged, and its `workflow.yaml` digest still matches.
4. Each React workspace's `package.json` declares the plugin, and `pnpm-lock.yaml` agrees: `pnpm install --frozen-lockfile` succeeds.
5. The rules are demonstrably active. In each React workspace, a throwaway violation of each rule makes `pnpm --filter <workspace> lint` fail with that rule's id, and is reverted. The violation is never committed.
6. Existing findings MUST NOT be suppressed to pass lint. Each finding is either fixed by a change that alters no runtime behavior (test-only code, or configuration), or left unfixed and recorded in the PR with a link to a separate application-code issue. If any finding is left that way, this slice cannot make lint pass on its own. It then stops and the owner decides the order (§7).
7. `useEffectEvent` is recognized. A throwaway file shows two things: an effect event left out of an Effect's dependency array is reported by neither rule, and an effect event called outside an Effect (for example, during render) is reported by `rules-of-hooks`. The throwaway file is never committed.
8. The only files that change are the three `eslint.config.mjs` files, the three `package.json` files, `pnpm-lock.yaml`, this slice's spec and plan, and test-only code that §5 invariant 6 permits. No production source file changes.
9. `pnpm run lint` passes in CI on the PR head, as part of the required checks.

## 6. Rationale

- **Two rules, set explicitly (owner scope in #196).** These two are what the audit relied on reviewers for. Plugin 7's recommended presets add React Compiler–derived rules whose findings would be a separate review and a separate decision. Explicit registration keeps the effective set exactly what this spec names, and invariant 1 makes that checkable.
- **`error`, not `warn` (my call, matching the issue's gating criterion).** CI's `Lint` job passes no `--max-warnings`, so warnings never fail the build. Only `error` gates.
- **Project-owned configs, not the managed fragment.** The fragment is overwritten on installer update. The three project configs are the documented extension point, as their existing `no-restricted-imports` and `sort-keys` overrides show.
- **Per-package devDependency.** The fragment's header requires plugins to resolve from the package, not from `tooling/` or by hoisting.
- **Version 6 or later.** That floor is #196's own, and the latest stable (7.1.1) satisfies it. The exact version is a planning decision for M4 (§8).
- **No suppression.** The point of the slice is enforcement. A suppression added to pass lint would hide exactly what the rules exist to catch.

## 7. Worked examples (non-normative)

- A component calls `useState` inside an `if`. `rules-of-hooks` reports it at `error`, and `pnpm run lint` exits 1.
- An Effect reads `onClose` but its array is `[open]`. `exhaustive-deps` reports the missing dependency at `error`.
- An Effect calls `const onEscape = useEffectEvent(...)` and lists `[open]`. Neither rule reports it (goal 2).
- The rules find a missing dependency in `apps/web/lib/foo.ts` whose fix would change when an Effect re-runs. That is an application-code change. It is recorded in the PR with a link to a new issue, and the owner decides whether that issue lands first or this slice waits (invariant 6).

## 8. Deferrals and decisions left to M4

- **Exact plugin version and range** (for example `^7.1.1`): M4, within §2 item 1.
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
| #196 Scope: review every finding; no suppression; app-code fixes go to separate issues | §4; §5 invariant 6 |
| #196 Scope: verify with React 19.2.8, Next.js 16.3, flat config; `useEffectEvent` recognized | §5 invariant 7 |
| #196 Acceptance: throwaway violation per rule | §5 invariant 5 |
| #196 Acceptance: CI lint passes; severity gates CI | §5 invariants 1, 9; §6 |
| #196 Acceptance: no application behavior change | §4; §5 invariant 8 |
| [Required CI Checks](2026-10-06-required-ci-checks-design.md) (Accepted): `Lint` is a required check | **Relies upon**, unchanged |

## 10. Acceptance criteria for this specification

M3 may move this specification from Draft to Accepted when it confirms that:

1. The scope names exactly the three React workspaces and the two rules, and gives a reason for leaving out `apps/api` and `packages/client`.
2. The invariants make "exactly two rules, at `error`" and "no preset" checkable from the PR, not from prose.
3. The rules for handling findings forbid suppression and keep any application-code change out of this slice.
4. Gating is tied to the `Lint` job's actual severity behavior.
5. `useEffectEvent` recognition is a stated, verifiable requirement, because #193 depends on it.
6. Nothing in it conflicts with the Accepted Required CI Checks specification, or edits installer-managed files.
7. It leaves the version, the config shape and the task order to M4.
