# GraphQL Error Stack Traces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Accepted** (revision 3), 2026-11-26 (M5). M6 complete (see [M6 execution record](#m6-execution-record)). M7 **Approved for merge** (see [M7 code review](#m7-code-review)). M8 **N/A**, M9 **Complete**, M10 **N/A** (see [M8–M10](#m8-refactoring)). Ready for closeout. |
| M5 decision | **Accepted** — 2026-11-26, revision 3 (`c75c8c9`), by the owner, on the independent reviewer's round 3 **ACCEPT** verdict (R1–R7 and N14–N16 resolved; no new findings). The owner's qualification: the real `pnpm --filter api exec` run with the `env -u` prefix and the repository's own suites were not run during review. They are implementation-stage verification gaps, closed in M6 by actual runs. The acceptance is not a claim that any check has passed. |
| M5 history | **Round 1** (independent reviewer, 2026-11-26, reviewed revision 1 at `d642247`): **REVISE**. No blocking findings. Required: R1 (tests that pass on Task 1 code neither red-first nor labelled characterization), R2 (constant-`true` break cannot fail the `true` rows), R3 (preservation break runs not assigned to named tests), R4 (`src/schema.gql` is gitignored, so the `git diff` check was vacuous), R5 (cleanup not failure-safe). Non-blocking notes N1–N13. **Round 2** (same reviewer, 2026-11-26, reviewed revision 2 at `2b324c0`): **REVISE**. R1–R5 resolved, both departures confirmed correct (C1 → K1; the import-time break split into K4a/K4b), every break-catalogue assignment reproduced exactly in a clean-shell probe. New required: R6 (K4a/K4b depend on `NODE_ENV`/`APP_DEBUG` exported in the launching shell), R7 (the fixed break command can miss F tests placed in a sibling file). Non-blocking: N14 (schema checks compared only per group), N15 (`withEnvDir` must not call `withApp`), N16 (K5's tmpdir guard assumes the worktree is not under `os.tmpdir()`). **Round 3** (same reviewer, 2026-11-26, reviewed revision 3 at `c75c8c9`): **ACCEPT**. R1–R7 and N14–N16 resolved. K4a/K4b were re-probed with the `env -u` prefix from shells exporting `APP_DEBUG=true` and `NODE_ENV=production`, and matched the catalogue exactly. The K5 precondition command was verified. No new findings. Only the plan changed since `4f0bd92`. |
| Revision history | Revision 1 (`d642247`): first draft. Revision 2: addresses R1–R5 and the notes the owner selected (N1, N2, N6, N10, N11), and carries N4, N5, N9 and N13 forward; see [Revision 2 (M5 round 1)](#revision-2-m5-round-1). Revision 3: addresses R6, R7 and N14–N16, as the owner directed; see [Revision 3 (M5 round 2)](#revision-3-m5-round-2). The spec is unchanged. |
| Date | 2026-11-26 |
| Tracking issue | [#236](https://github.com/rexescario-dev/clensy-platform/issues/236) "fix(api): don't include stack traces in GraphQL error responses outside production" |
| Spec | [GraphQL Error Stack Traces](../specs/2026-11-26-graphql-error-stacktrace-design.md), Status **Accepted** (revision 3, M3 round 2, 2026-11-26, recorded at `4f0bd92`). |
| Owner instructions carried from M3 | (1) **`JWT_SECRET`:** set it in test setup for the `development`, unset-`NODE_ENV` and `production` scenarios wherever authentication is booted. The owner approved (M5 round 1) that a harness which does not boot authentication does not set it. (2) **Config-source coverage:** a temporary `.env` proves that `APP_DEBUG` and `NODE_ENV` are honored from the file source (spec invariant 4). It is isolated and removed afterwards. The owner approved (M5 round 1) a temporary directory plus `chdir`, so the developer's real `apps/api/.env` is never read or modified. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. File names, helper names, test IDs, step order and commit wording are planning decisions, not product semantics. |
| Branch | `fix/236-graphql-stacktrace`, from `origin/main` at `f0cd979`, in worktree `.worktrees/236-graphql-stacktrace`, carrying the spec (`4f0bd92`) and this plan. One PR for the spec, this plan, its gate records and the change (process spec §2.8). |
| Scope | Exactly: `apps/api/src/platform/graphql/graphql.module.ts`; a new helper under `apps/api/src/platform/config/`; new tests under `apps/api/src/platform/config/tests/` and `apps/api/src/platform/graphql/tests/`; `docs/getting-started/local-development.md` (Debugging); `.env.example` (`APP_DEBUG` comment); the spec and this plan. **No** change to GraphiQL registration, `main.ts`, `setup-api-docs.ts`, `database.module.ts`, `config.module.ts`, `app-debug.ts`, `dev-owner-config.ts`, `Dockerfile`, `docker-compose.yml`, or any resolver or service (spec §2, §5 invariant 7). Tests never create or change `src/schema.gql` (C8). |
| Task types | Task 0 `code` (environment preparation; no file change). Task 1 `code` (refactor, no behavior change). Task 2 `code` (the fix, TDD). Task 3 `code` (config-source coverage). Task 4 `docs/process`. Task 5 `docs/process` (verification and gate records). No `configuration` task: nothing outside the repository changes. |
| Characterization tests | C1, C2, C3 (Task 2 Step 2), P1, P2 (Task 2 Step 5), F-a, F-b, F-c (Task 3). Each is assigned to one or more named breaks in the [break catalogue](#break-catalogue). Every break run is made outside the committed change and is not committed. |
| Pre-validation | **None.** No code in this plan was run before M5. The M5 round 1 reviewer's scratchpad probes are review evidence, not plan pre-validation. |
| M7 | Application code: under `CLAUDE.md`, a **fresh, independent reviewer** on the most capable model, given the Accepted spec, the Accepted plan and the branch diff. It is not the M6 implementer. |
| Commits | No `Co-Authored-By` trailer and no generated-with line (the owner's global instructions, M5 round 1 N13). |

**Goal:** The API passes `includeStacktraceInErrorResponses` to Apollo explicitly. It is `true` if and only if `APP_DEBUG` is exactly `true` and `NODE_ENV`, trimmed and lowercased, is not `production`. Both values are read through `ConfigService` when the GraphQL module is configured. Nothing else about GraphQL error responses changes.

**Architecture:** A pure helper decides the boolean from the two raw values. It reuses `isAppDebugEnabled` for the opt-in, and its own trimmed, lowercased production check. `GraphqlModule` switches from `NestGraphQLModule.forRoot` to `forRootAsync` with `imports: [ConfigModule]` and `inject: [ConfigService]`, the same pattern as `database.module.ts`. An exported options factory returns the existing options unchanged, plus the new boolean. Tests drive real HTTP GraphQL requests against a minimal Nest app that uses the same factory and a test-only resolver.

**Tech stack:** NestJS 11, `@nestjs/graphql` + `@nestjs/apollo` 13.4.4, `@apollo/server` 5.5.1, `@nestjs/config` 4.0.4, Jest 30 + ts-jest, supertest 7.

## Non-goals of this plan

Everything in spec §2 "Out of scope" and §1.2 non-goals. In particular: no `formatError` in committed code, no error masking, no change to GraphiQL or Swagger gating, no new environment variable, no refactor of `dev-owner-config.ts`'s own production check, and no general config layer (#226).

## Global constraints (from the Accepted spec)

- **C1** (inv. 1): `includeStacktraceInErrorResponses` SHALL always be passed explicitly as a boolean.
- **C2** (§4, inv. 2, §3): SHALL be `true` only when `isAppDebugEnabled(APP_DEBUG)` holds and `NODE_ENV?.trim().toLowerCase() !== 'production'`.
- **C3** (inv. 3): the opt-in SHALL use `isAppDebugEnabled`, and no other truthiness test.
- **C4** (inv. 4, 8): `APP_DEBUG` and `NODE_ENV` SHALL be read through `ConfigService` in the module's async factory, not from `process.env` at import time. No second config mechanism.
- **C5** (inv. 5): every other option currently passed to `NestGraphQLModule` SHALL be kept exactly: `autoSchemaFile`, `context`, `driver`, `fieldResolverEnhancers`, `playground`, `sortSchema`, and the existing comments. No `formatError` in committed code.
- **C6** (inv. 7): the import-time `isProduction` that gates `GraphiqlController` SHALL stay as it is.
- **C7** (§7 req 6): every test that changes `NODE_ENV`, `APP_DEBUG` or the cwd SHALL save the previous state before changing anything. It SHALL restore that state in a `finally` path that runs even when env setup, boot, assertions or `app.close()` fail. A key that was unset SHALL be deleted again. No test SHALL read or modify a developer's `apps/api/.env`.
- **C8:** tests and builds in Tasks 1–3 SHALL NOT create or change `src/schema.gql`. The test app uses an in-memory schema (`autoSchemaFile: true`), overriding only that one option of the real factory. The file is gitignored (`.gitignore:21`), so this is checked by existence and hash against the Task 0 baseline (the [schema-file check](#schema-file-check)), never by `git diff`.

## Traceability

| Spec item | Implementation | Verification |
| --- | --- | --- |
| §3, §4, inv. 1–3 | Task 2 Step 3 | T1–T6 (red-first), truth table H with breaks K1/K2/K3, C1–C3 |
| Inv. 4, 8 | Task 1, Task 2 Step 3 | F-a, F-b, F-c with breaks K4a, K4b, K5 |
| Inv. 5, §7 req 4 | Unchanged by design (C5) | P1, P2 with breaks K6, K7 (and K1, K2) |
| Inv. 6 | Scope (no new variable) | Diff review in Task 5 and M7 |
| Inv. 7 | Scope list, C6 | `graphiql-dev-only.spec.ts`, `api-docs.e2e-spec.ts`, `app-debug.spec.ts` (Task 5) |
| §7 req 1 | Task 2 Step 3 | T1, T2 (red-first) |
| §7 req 2 | Task 2 Step 3 | C1, C2 (characterization) |
| §7 req 3 | Task 2 Step 3 | T3 (red-first), C3 (characterization) |
| §7 req 5 | — | Task 5 Step 2 (unit and e2e must pass; NOT RUN blocks the gate) |
| §7 req 6 | C7 | `withApp` / `withEnvDir` harnesses (Task 2 Step 1, Task 3 Step 1) |
| §7 req 7 | Task 2 Step 3 | T4, T5 (red-first) |
| §7 req 8 | Task 4 | Task 4 Step 3 |
| Owner instruction 1 | Not needed by this harness | Task 2 Step 1 note |
| Owner instruction 2 | Task 3 | F-a, F-b, F-c |

## Test inventory

The IDs are planning labels. M6 may use them in test names so that `-t` filters are exact.

| ID | File | Env (`NODE_ENV`, `APP_DEBUG`) | Query | Expected | On Task 1 code | Kind |
| --- | --- | --- | --- | --- | --- | --- |
| T1 | `error-stacktrace.spec.ts` | `development`, unset | 400 and 404 | no `stacktrace` | fails | red-first (req 1) |
| T2 | same | unset, unset | 400 and 404 | no `stacktrace` | fails | red-first (req 1) |
| T3 | same | `test`, `true` | 400 | `stacktrace` present | fails | red-first (req 3) |
| T4 | same | `Production`, `true` | 400 | no `stacktrace` | fails | red-first (req 7) |
| T5 | same | `' production '`, `true` | 400 | no `stacktrace` | fails | red-first (req 7) |
| T6 | same | Jest default, unset | — (real `GraphqlModule`, `GRAPHQL_MODULE_OPTIONS`) | `typeof includeStacktraceInErrorResponses === 'boolean'` | fails (`undefined`) | red-first (inv. 1, N9) |
| C1 | same | `production`, unset | 400 | no `stacktrace` | passes | characterization (req 2) |
| C2 | same | `production`, `true` | 400 | no `stacktrace` | passes | characterization (req 2) |
| C3 | same | `development`, `true` | 400 | `stacktrace` present | passes | characterization (req 3) |
| P1 | same | on: `development`, `true`; off: `development`, unset | 400 | preserved (Step 5) | — (written after the fix) | characterization (req 4) |
| P2 | same | as P1 | 404 | preserved (Step 5) | — | characterization (req 4) |
| H | `graphql-stacktrace.spec.ts` | truth table (Step 4) | — | per row | — (written after the helper) | broken by K1/K2/K3 |
| F-a | file-source block (Task 3) | file: `APP_DEBUG=true`, `NODE_ENV=development`; process: both unset | 400 | `stacktrace` present | — (Task 3 runs after Task 2) | characterization (inv. 4) |
| F-b | same | file: `APP_DEBUG=true`, `NODE_ENV=production`; process: both unset | 400 | no `stacktrace` | — | characterization (inv. 4, 8) |
| F-c | same | file: `APP_DEBUG=true`; process: `APP_DEBUG=false`, `NODE_ENV` unset | 400 | no `stacktrace` | — | characterization (inv. 4 precedence) |

"400" is the test query that throws `BadRequestException` (code `BAD_REQUEST`). "404" throws `NotFoundException` (code `INTERNAL_SERVER_ERROR`, `extensions.status: 404`). A test with "400 and 404" asserts on both.

## Break catalogue

Each break is stated in behavioral terms. The source edit is M6's choice (M4 step 9). The example edit is illustrative only and not binding. Every break uses the same procedure:

1. Before applying the break: `git status --short` shows nothing outside the committed state.
2. Apply an **uncommitted** edit that produces the named behavior.
3. Run the **break command**, exactly:

   `env -u NODE_ENV -u APP_DEBUG pnpm --filter api exec jest src/platform/graphql/tests/error-stacktrace.spec.ts src/platform/config/tests/graphql-stacktrace.spec.ts`

   The `env -u` prefix is mandatory for every break run (R6). Jest sets `NODE_ENV=test` only when it is unset and inherits any exported `APP_DEBUG`. The assignments below, K4a and K4b in particular, assume Jest's state at import is `NODE_ENV=test` with `APP_DEBUG` unset. With the prefix, that holds whatever the launching shell exports (for example after `set -a; . ./.env`). The break command names the only two files that hold the assigned tests: F-a, F-b and F-c MUST be in `error-stacktrace.spec.ts` (R7, Task 3 Step 1).
4. **Expected:** exactly the assigned tests fail, and every other test in both files passes. Record the output (the failing test names and the counts).
5. **Recovery:** `git restore <every file the break edited>`. Then `git status --short` shows nothing outside the committed state, and the same break command, with the same `env -u` prefix, passes in full. Record that output.
6. If any assigned test passes, or any unassigned test fails, stop and report. Do not adjust the tests to fit the break.

| Break | Behavior | Example edit (non-binding) | Assigned tests (must fail) |
| --- | --- | --- | --- |
| **K1** | Stack traces are always included. | Helper returns `true`. | T1, T2, T4, T5, C1, C2, P1, P2, F-b, F-c; every H row whose expected value is `false` |
| **K2** | Stack traces are never included. | Helper returns `false`. | T3, C3, P1, P2, F-a; every H row whose expected value is `true` |
| **K3** | Production does not override the opt-in. | Helper returns `isAppDebugEnabled(appDebug)` alone. | T4, T5, C2, F-b; the H rows (`production`, `Production`, `' production '`, `'PRODUCTION'`) × `'true'` |
| **K4a** | The values are read from `process.env` at import time: `APP_DEBUG` is captured when `graphql.module.ts` is imported. `NODE_ENV` is still read through `ConfigService`. | A module-level `const` that captures `process.env.APP_DEBUG`, used by the factory. | T3, C3, P1, P2, F-a |
| **K4b** | The values are read from `process.env` at import time: `NODE_ENV` is captured when `graphql.module.ts` is imported (Jest's `test`). `APP_DEBUG` is still read through `ConfigService`. | A module-level `const` that captures `process.env.NODE_ENV`, used by the factory. | T4, T5, C2, F-b |
| **K5** | The file wins over the process environment for `APP_DEBUG`. | When the cwd is under `os.tmpdir()`, the factory parses that directory's `.env` and prefers its `APP_DEBUG`. The restriction keeps the break from reading the developer's `apps/api/.env` during the `withApp` tests (C7). It is safe only while the worktree is **not** under `os.tmpdir()` (today: tmpdir `/tmp`, worktree under `/home`; N16). Precondition, checked before K5 from `apps/api`: `node -p "require('path').relative(require('os').tmpdir(), process.cwd()).startsWith('..')"` prints `true`. If it prints `false`, stop and report; do not run K5. | F-c |
| **K6** | `extensions.originalError` is dropped when stack traces are on. | A temporary `formatError` that deletes `extensions.originalError` when `extensions.stacktrace` is present. | P1, P2 |
| **K7** | `extensions.code` is changed when stack traces are on. | A temporary `formatError` that sets `extensions.code` to another value when `extensions.stacktrace` is present. | P1, P2 |

Notes on the assignments:

- The owner's R1 instruction named "production does not override the opt-in" for production both with and without `APP_DEBUG=true`. C2 (with the opt-in) fails under K3. C1 (without the opt-in) cannot fail under K3: with `APP_DEBUG` unset there is no opt-in to override. So C1 is assigned to K1, the behavior that would expose it.
- The M5 round 1 review said one import-time break fails both F-a and F-b. That is not the case. Captured at import, Jest's state is `NODE_ENV=test` and `APP_DEBUG` unset. A capture of both gives "never included": F-a fails, but F-b (expects none) still passes. The plan therefore names two variants of the owner's break "the values are read from `process.env` at import time": K4a (`APP_DEBUG`) fails F-a, and K4b (`NODE_ENV`) fails F-b.
- Reading `process.env` directly at **factory** time is not a break the file-source tests can detect. `ConfigModule.forRoot()` has already copied the file's values into `process.env` (`assignVariablesToProcess`), so the result is the same. Invariant 4's "through `ConfigService`" is therefore checked by code review (C4, M7), not by a test.
- P1 and P2 also fail under K1 and K2 because of their mode preconditions (Step 5).

## Schema-file check

`S=apps/api/src/schema.gql; if [ -e "$S" ]; then sha256sum "$S"; else echo ABSENT; fi`

Task 0 Step 2 records the **baseline** (expected `ABSENT`; the worktree is fresh). If the baseline is not `ABSENT`, record its hash and use that as the baseline. Every later check is compared with **that Task 0 baseline**, not only with the check just before it (N14). This includes the checks between task groups: Task 1 Steps 2 and 4, Task 2 Steps 2, 3, 6 and 7, Task 3 Steps 3 and 4, and Task 5 Step 1. **Expected:** every check prints exactly the baseline. Any difference is a C8 failure: stop and report. Do not rely on `git diff` or `git status`; the file is gitignored. e2e boots `AppModule`, which writes the file. That is existing behavior, outside C8, so Task 5 Step 2 (e2e) runs after the last check and is not compared. An e2e schema comparison against `f0cd979` is optional and not required.

## Task 0 — Prepare the worktree (`code`, no file change)

- [ ] **Step 1.** From the worktree root: `pnpm install --frozen-lockfile`. **Expected:** it succeeds and `git status --short` is empty. The worktree has no `node_modules` (M5 round 1 N10).
- [ ] **Step 2.** Record the [schema-file check](#schema-file-check) baseline (expected `ABSENT`).

## Task 1 — Move `GraphqlModule` to `forRootAsync` (`code`, refactor, no behavior change)

Implements C4 and C5 structurally. Behavior is unchanged: the factory does not yet set the stack-trace option, so Apollo's default still applies.

- [ ] **Step 1.** In `graphql.module.ts`:
  - Export a factory `graphqlModuleOptions(config: ConfigService): ApolloDriverConfig` (the name is a planning choice). It returns the current options object verbatim, comments included.
  - Replace `NestGraphQLModule.forRoot<ApolloDriverConfig>({...})` with `NestGraphQLModule.forRootAsync<ApolloDriverConfig>({ driver: ApolloDriver, imports: [ConfigModule], inject: [ConfigService], useFactory: graphqlModuleOptions })`.
  - Keep `const isProduction` and `controllers` unchanged (C6).
  - `config` is unused in this task. M6 chooses how to satisfy `no-unused-vars` (for example an `_config` name) until Task 2 uses it (N3).
  - Under `forRootAsync`, `join(process.cwd(), 'src/schema.gql')` is evaluated when the factory runs, not at import (N5). Nothing changes the cwd before `AppModule` boots, so the resolved path is the same.
- [ ] **Step 2.** Schema-file check (= baseline). Run `pnpm --filter api exec jest src/platform/graphql`. **Expected:** every existing graphql spec passes, including `field-resolver-enhancers.spec.ts` (imports `GraphqlModule` alone and reads `GRAPHQL_MODULE_OPTIONS`) and `graphiql-dev-only.spec.ts`. If `field-resolver-enhancers.spec.ts` cannot resolve `ConfigService`, that is a defect in Step 1's `imports`, not a reason to edit the test.
- [ ] **Step 3.** Run `pnpm --filter api build` and `pnpm --filter api lint`. **Expected:** both succeed. The lint script runs `eslint --fix` (N1), so then run `git status --short`. **Expected:** nothing beyond the Step 1 edit. Inspect any other change and either revert it or record why it is kept.
- [ ] **Step 4.** Run `pnpm --filter api test`. **Expected:** pass. Schema-file check: equals the Task 0 baseline.
- [ ] **Step 5.** Commit: `refactor(api): configure GraphQL through forRootAsync (#236)`.

## Task 2 — Explicit stack-trace setting (`code`, TDD)

- [ ] **Step 1 — test harness.** Create `src/platform/graphql/tests/error-stacktrace.spec.ts` (the name is a planning choice). It contains:
  - A test-only `@Resolver()` with two `String` queries: one throws `BadRequestException` ("400") and the other `NotFoundException` ("404").
  - `withApp(env, fn)`, where `env` is `{ NODE_ENV?: string; APP_DEBUG?: string }`, with `undefined` meaning unset. Its order is fixed (C7):
    1. Save `previous = { NODE_ENV: process.env.NODE_ENV, APP_DEBUG: process.env.APP_DEBUG }`, together with whether each key was present, before changing anything.
    2. Declare `let app: INestApplication | undefined`.
    3. `try`: set or delete each key, then build `Test.createTestingModule({ imports: [ConfigModule.forRoot({ ignoreEnvFile: true }), NestGraphQLModule.forRootAsync({ driver: ApolloDriver, imports: [ConfigModule], inject: [ConfigService], useFactory: (c) => ({ ...graphqlModuleOptions(c), autoSchemaFile: true }) })], providers: [TestResolver] })`. Then create the app, `await app.init()`, and `return await fn(app)`.
    4. `finally`: inside its own `try/catch`, `await app?.close()`, keeping any close error. Then restore both keys from `previous` (deleting the absent ones). Restoration happens whether boot, `fn` or `close` failed. After restoring, rethrow a close error only if no earlier error is already propagating.

    `withApp` does not return a `restore()` callback. `ignoreEnvFile: true` keeps the developer's `apps/api/.env` out. The file does not import `AppConfigModule` (N6). `autoSchemaFile: true` keeps the schema in memory (C8).
  - `firstError(app, field)` posts `{ query: "{ <field> }" }` to `/graphql` with supertest. It returns `body.errors[0]`, typed through a local interface (for example `GraphqlErrorBody { message: string; path?: ...; locations?: ...; extensions?: Record<string, unknown> }`), so that `res.body` is not used as `any`. `apps/api/eslint.config.mjs` relaxes `no-unsafe-*` only for `test/**` (N2).

  **`JWT_SECRET` (owner instruction 1, as approved):** this harness does not boot `AuthModule`, so `JwtStrategy` and `TokenService` are not constructed and `JWT_SECRET` is not set. If M6 has to boot anything that needs it under a non-`test` `NODE_ENV`, `withApp` saves `JWT_SECRET` in step 1, sets a fixed test value in step 3 and restores it in step 4.

  **Timing (N4):** the factory, and with it `ConfigService.get`, runs during `compile()`. Apollo reads its own `NODE_ENV` when `ApolloServer` is constructed, during `app.init()`. `ConfigService.get` reads `process.env` live, with no cache configured. `withApp` sets the environment before `createTestingModule`, so both reads see it.
- [ ] **Step 2 — tests before the fix.** Add T1–T6 and C1–C3 ([test inventory](#test-inventory)). For T6, compile the real `GraphqlModule` alone (as `field-resolver-enhancers.spec.ts` does) and read `GRAPHQL_MODULE_OPTIONS`. Run `pnpm --filter api exec jest src/platform/graphql/tests/error-stacktrace.spec.ts`. **Expected on the Task 1 code:**
  - T1–T6 **fail**: T1 and T2 because Apollo's default includes a stack trace for `development` and for unset `NODE_ENV`; T3 because Apollo's default omits it for `test`; T4 and T5 because Apollo's exact match treats `Production` and `' production '` as non-production; T6 because the option is `undefined`.
  - C1–C3 **pass**. They are characterization tests: Apollo's default already gives these results. Their breaks are K1 (C1), K3 and K4b (C2), and K2 and K4a (C3), run in Step 6.

  Record the output, and run the schema-file check (= baseline). If any of T1–T6 passes, or any of C1–C3 fails, stop and report.
- [ ] **Step 3 — helper and wiring (green).**
  - Create `src/platform/config/graphql-stacktrace.ts` (the name is a planning choice). It exports `includeStacktraceInErrorResponses(nodeEnv: string | undefined, appDebug: string | undefined): boolean`, returning `isAppDebugEnabled(appDebug) && (nodeEnv ?? '').trim().toLowerCase() !== 'production'` (C2, C3).
  - In `graphqlModuleOptions`, add `includeStacktraceInErrorResponses: includeStacktraceInErrorResponses(config.get('NODE_ENV'), config.get('APP_DEBUG'))` (C1, C4).
  - Run the Step 2 command. **Expected:** T1–T6 and C1–C3 all pass. Record the output, and run the schema-file check (= baseline).
- [ ] **Step 4 — helper truth table (H).** Create `src/platform/config/tests/graphql-stacktrace.spec.ts`, with `it.each` rows:
  - `true` for `NODE_ENV` ∈ {`development`, `test`, `staging`, unset} × `APP_DEBUG` `'true'`;
  - `false` for `APP_DEBUG` ∈ {unset, `''`, `'false'`, `'1'`, `'TRUE'`} × `NODE_ENV` ∈ {`development`, unset, `production`};
  - `false` for `NODE_ENV` ∈ {`production`, `Production`, `' production '`, `'PRODUCTION'`} × `APP_DEBUG` `'true'`.

  Run. **Expected:** pass. H is written after the helper, so the K1 and K2 break runs in Step 6 show that it can fail in both directions: K1 fails every `false` row, and K2 fails every `true` row. K3 additionally fails the four production × `'true'` rows.
- [ ] **Step 5 — preservation (P1, P2; spec §7 req 4).** For each of the 400 and 404 queries, get `on = firstError(...)` under `development` with `APP_DEBUG=true`, and `off = firstError(...)` under `development` with `APP_DEBUG` unset. Assert:
  1. **Mode preconditions:** `on.extensions.stacktrace` is a non-empty array, and `off.extensions.stacktrace` is `undefined`.
  2. **Literal values, on both `on` and `off`:**
     - `message` equals the thrown exception's message;
     - `path` equals `[<field>]`;
     - `extensions.code` is `BAD_REQUEST` (400) or `INTERNAL_SERVER_ERROR` (404);
     - `extensions.status` is absent (400) or `404` (404);
     - `extensions.originalError` is an object whose `statusCode` is 400 or 404;
     - `locations` is a non-empty array.

     An equal-but-wrong pair therefore cannot pass.
  3. **Equality:** `on` with `extensions.stacktrace` removed deep-equals `off`.

  Run. **Expected:** pass. P1 and P2 are characterization tests. They pin `@nestjs/apollo`'s existing transform, which this slice must not change. Breaks K6 and K7 are run in Step 6.
- [ ] **Step 6 — break runs.** Run K1, K2, K3, K4a, K4b, K6 and K7 from the [break catalogue](#break-catalogue), one at a time, each with its full procedure (including the `env -u` break command) and recovery. (K5 runs in Task 3, where F-a, F-b and F-c exist. Before Task 3, K1, K2, K4a and K4b have no F tests to fail; Task 3 Step 4 reruns them.) Record every result in the Execution record. After the last recovery, run the schema-file check (= baseline).
- [ ] **Step 7.** Schema-file check (= baseline). Run `pnpm --filter api test`, `pnpm --filter api lint`, then `git status --short` (inspect any `--fix` change, N1), then `pnpm --filter api build`. **Expected:** all pass, and `git status --short` shows only the Task 2 files. Schema-file check: equals the Task 0 baseline.
- [ ] **Step 8.** Commit: `fix(api): set GraphQL stack-trace inclusion explicitly from APP_DEBUG (#236)`.

## Task 3 — Config-source coverage (`code`, owner instruction 2, spec inv. 4)

Uses the precedent in `test/e2e-isolation.e2e-spec.ts`: a temporary directory holding a `.env`, with `process.chdir` into it. That is the same file `ConfigModule.forRoot()` reads as `apps/api/.env` when the cwd is `apps/api`. The developer's real `apps/api/.env` is never read, created, modified or deleted.

- [ ] **Step 1 — harness.** In `error-stacktrace.spec.ts` — mandatory, not a sibling file, so the break command runs F-a, F-b and F-c (R7) — add `withEnvDir(fileContents, processEnv, fn)`. Its order is fixed (C7):
  1. Save `previousCwd = process.cwd()`, and the presence and value of `NODE_ENV`, `APP_DEBUG` and every key named in `fileContents`, before changing anything.
  2. Declare `let dir: string | undefined` and `let app: INestApplication | undefined`.
  3. `try`:
     - `dir = mkdtempSync(join(tmpdir(), 'gql-stacktrace-'))`;
     - write `join(dir, '.env')`;
     - delete `NODE_ENV` and `APP_DEBUG`, then apply `processEnv`;
     - `process.chdir(dir)`;
     - only now call `ConfigModule.forRoot()` (default `envFilePath`, no `ignoreEnvFile`) inside the test, and build the module **itself**, with the same imports and providers as `withApp` but with this `forRoot()` result in place of `ConfigModule.forRoot({ ignoreEnvFile: true })`. `withEnvDir` MUST NOT call `withApp`: `withApp`'s set-or-delete env step would wipe `processEnv`, which F-c relies on (`APP_DEBUG=false`) (N15). A shared module-builder function that takes the `ConfigModule` import as a parameter and touches no env is allowed. `forRoot` loads the file synchronously when called (N6);
     - init the app, then `return await fn(app)`.
  4. `finally`, each part in its own `try/catch` so that one failure cannot skip the rest:
     - `await app?.close()`;
     - `process.chdir(previousCwd)`;
     - `if (dir) rmSync(dir, { recursive: true, force: true })`;
     - restore every saved key, deleting the ones that were absent, including any that `assignVariablesToProcess` copied in from the file.

     After all parts, rethrow the first cleanup error only if no earlier error is already propagating.

  The test file does not statically import `AppConfigModule` (N6), and does not import `dotenv`.
- [ ] **Step 2 — cases.** F-a, F-b and F-c ([test inventory](#test-inventory)). F-a also shows that the file is read at all, so F-c's result cannot come from the file being ignored (N7).
- [ ] **Step 3.** Run the file twice in a row. **Expected:** both runs pass. `git status --short` shows no new `.env` or other untracked file under `apps/api`. `ls -d "$(node -p "require('os').tmpdir()")"/gql-stacktrace-* 2>/dev/null` lists nothing. Schema-file check: equals the Task 0 baseline.
- [ ] **Step 4 — break runs.** Run K5. Rerun K1, K2, K4a and K4b so that their F assignments are exercised. Each uses its full procedure, including the `env -u` break command and, for K5, the tmpdir precondition. Their assignments now include F-a, F-b and F-c. Record every result. After the last recovery, run the schema-file check (= baseline).
- [ ] **Step 5.** If `process.chdir` is unavailable in the Jest worker, stop and report. Do not fall back to writing `apps/api/.env`.
- [ ] **Step 6.** Run `pnpm --filter api lint`, then `git status --short` (N1). Commit: `test(api): cover APP_DEBUG and NODE_ENV from the .env source (#236)`.

## Task 4 — Setup documentation (`docs/process`, spec §7 req 8)

- [ ] **Step 1.** `docs/getting-started/local-development.md`, Debugging section. Next to the SQL-logging bullet, add a bullet saying that `APP_DEBUG=true` also adds `extensions.stacktrace` to GraphQL error responses. It is off by default, and `NODE_ENV=production` (any case, surrounding whitespace ignored) always suppresses it. For the Compose stack, set it in the root `.env` (or export it in the shell that runs `docker compose`), then run `docker compose up -d api`. Keep the existing bullet's wording unchanged.
- [ ] **Step 2.** `.env.example`, `APP_DEBUG` comment: add one line, "also adds stack traces to GraphQL error responses; ignored when `NODE_ENV` is production". Do not change the variable or its other lines.
- [ ] **Step 3.** Verify: `git diff` touches only those lines, and every relative link in the changed section resolves.
- [ ] **Step 4.** Commit: `docs: document APP_DEBUG stack traces in GraphQL errors (#236)`.

## Task 5 — Verification and gate records (`docs/process`)

- [ ] **Step 1.** From the worktree root, run:
  - `pnpm --filter api test`;
  - `pnpm --filter api lint`, then `git status --short` (N1);
  - `pnpm --filter api build`;
  - `pnpm run lint`, then `git status --short`;
  - the schema-file check (equals the Task 0 baseline).

  **Expected:** all pass, and `git status --short` is empty. Record the exact counts.
- [ ] **Step 2.** `pnpm --filter api test:e2e`. It needs the local Postgres stack, and `DB_NAME` must not be exported in the shell. **Expected:** pass. Record the counts. If it cannot run, record **NOT RUN** with the reason. NOT RUN leaves spec §7 req 5 unmet: the verification gate stays **incomplete**, and the Slice Completion Report MUST NOT say Ready for M7 unless the owner explicitly decides otherwise (N11).
- [ ] **Step 3 — optional manual check, local stack.**
  - With `NODE_ENV` unset in the root `.env` (Compose default `development`) and `APP_DEBUG` empty, a rejected mutation (for example `refundInvoicePayment` with an invalid amount, as in #209) returns its message and `BAD_REQUEST` without `extensions.stacktrace`.
  - With `APP_DEBUG=true` and `docker compose up -d --build api`, the same call includes it.

  Record what ran, or "not run".
- [ ] **Step 4.** Diff review for invariant 6: `git diff $(git merge-base HEAD origin/main)..HEAD` adds no new environment variable name. Record the result.
- [ ] **Step 5.** Append the M6 Execution record (every red, green and break run, with outputs) and a Slice Completion Report (per `docs/workflows/conventions/reporting-conventions.md`) to this plan. Commit.
- [ ] **Step 6.** Hand off to M7: a fresh, independent reviewer (CLAUDE.md), given the Accepted spec, the Accepted plan and `git diff $(git merge-base HEAD origin/main)..HEAD`.

## Execution and scheduling risks

- **`forRootAsync` and `GRAPHQL_MODULE_OPTIONS`.** `field-resolver-enhancers.spec.ts` reads the options token after `compile()`. M5 round 1 confirmed the token is still provided under `forRootAsync`; Task 1 Step 2 checks this before any behavior change.
- **`process.env` leakage from `ConfigModule.forRoot()`.** `assignVariablesToProcess` writes file values into `process.env` permanently. `withEnvDir` saves and restores every key the file names.
- **Jest workers.** Jest gives each test file its own copy of `process.env`, but several files can run one after another in the same worker process, and `process.chdir` changes that whole process. `withEnvDir` restores the cwd in `finally`. M5 round 1 confirmed that `chdir` works in Jest 30 child-process workers.
- **Break edits.** Break edits are never committed. Each one is recovered with `git restore` and checked with `git status --short` before the next step. `git stash` is not used, because the stash is shared across worktrees.

## Revision 2 (M5 round 1)

| Finding | Resolution |
| --- | --- |
| R1 | T1–T6 are written and shown red before the helper (Task 2 Step 2). T3 (`test` + `true`) and T4/T5 (`Production`, `' production '`) are now red-first, not after the fix. Tests that already pass on Task 1 code are labelled characterization (C1–C3, F-a–F-c). Each has named breaks with assigned tests, a procedure and recovery ([break catalogue](#break-catalogue)). The owner's break names are kept. Two assignments differ from the instruction's literal reading, with reasons: C1 → K1, and the import-time break split into K4a/K4b. |
| R2 | H keeps its order, with two break runs: K1 (constant `true`) must fail every `false` row, and K2 (constant `false`) must fail every `true` row. Both are recorded. |
| R3 | Two separate breaks: K6 (drop `originalError` when on) and K7 (change `code` when on). Each is assigned to both P1 (400) and P2 (404). The literal-value assertions run on both the `on` and `off` copies (Task 2 Step 5). |
| R4 | The `git diff` checks are replaced by the [schema-file check](#schema-file-check) (existence or `sha256sum`). Revision 3 compares every check with the Task 0 baseline (N14). The e2e comparison stays optional. |
| R5 | `withApp` and `withEnvDir` save all state first and restore env, cwd and the temporary directory in `finally`, each part guarded, whatever fails. There is no `restore()` callback that depends on a successful `init`. |
| N1 | `git status --short` after every lint run, with any `--fix` change inspected. |
| N2 | `res.body` is typed through a local interface. |
| N6 | `ConfigModule.forRoot()` is called inside the test, after `chdir`. There is no static import of `AppConfigModule`. |
| N10 | Task 0 runs `pnpm install --frozen-lockfile`. |
| N11 | e2e NOT RUN keeps the gate incomplete and blocks a Ready-for-M7 report. |
| N4, N5, N9, N13 | Carried forward: timing note (Task 2 Step 1), `autoSchemaFile` resolution (Task 1 Step 1), T6 boolean check, and no `Co-Authored-By` trailer (header). |
| N3, N7, N8, N12 | N3: Task 1 Step 1. N7: Task 3 Step 2. N8: Task 5 Step 4. N12: no change needed. |

## Revision 3 (M5 round 2)

| Finding | Resolution |
| --- | --- |
| R6 | Every break run uses one fixed break command, prefixed with `env -u NODE_ENV -u APP_DEBUG`, including its recovery rerun ([break catalogue](#break-catalogue) step 3). The reason and the assumed import-time state are stated there. Normal red, green and suite runs set their env per test and do not depend on the shell (M5 round 2 probe), so they are unchanged. |
| R7 | F-a, F-b and F-c MUST be in `error-stacktrace.spec.ts` (Task 3 Step 1). The break command names that file. |
| N14 | Every schema-file check is compared with the Task 0 baseline, including the checks between groups ([schema-file check](#schema-file-check)). |
| N15 | `withEnvDir` builds its own module and MUST NOT call `withApp`. A shared env-free module builder is allowed (Task 3 Step 1). |
| N16 | K5's tmpdir guard keeps its restriction, with its assumption stated and a precondition command that stops K5 if the worktree is under `os.tmpdir()` (K5 row). |

## Gate outcomes

*(M5–M10 records are appended here.)*

### M6 execution record

Executed 2026-11-26, inline (superpowers:executing-plans), in worktree `.worktrees/236-graphql-stacktrace` on `fix/236-graphql-stacktrace`, after the M5 acceptance record (`81e3b29`). The owner authorized M6 in the same message as M5 ("m6"). Every result below comes from an actual run.

**Commits**

| Task | Commit | Subject |
| --- | --- | --- |
| 0 | — | `pnpm install --frozen-lockfile` succeeded, `git status` clean, schema-file baseline `ABSENT` |
| 1 | `f1fafb8` | refactor(api): configure GraphQL through forRootAsync (#236) |
| 2 | `bb2709c` | fix(api): set GraphQL stack-trace inclusion explicitly from APP_DEBUG (#236) |
| 3 | `e03c339` | test(api): cover APP_DEBUG and NODE_ENV from the .env source (#236) |
| 4 | `348e179` | docs: document APP_DEBUG stack traces in GraphQL errors (#236) |
| 5 | this commit | the execution record and Slice Completion Report |

**Rulings (deviations from the plan's letter)**

1. **Task 1:** lint rejects an unused `_config` parameter (`no-unused-vars` has no `_` ignore pattern). The Task 1 factory therefore took no parameter, and Task 2 added `config: ConfigService` when it used it. `inject: [ConfigService]` was unchanged. The plan had delegated this choice to M6 (N3).
2. **Task 2:** the break procedure needs a clean committed state and recovers with `git restore`. Run before the commit, that would have erased the uncommitted Task 2 edits in the same files. Steps 7 and 8 (verification and commit) were therefore run before the Step 6 break runs. The break edits were never committed either way.
3. **Task 3:** Step 4 lists K5 plus reruns of K1, K2, K4a and K4b, but K3 is also assigned F-b. The full catalogue K1–K7 was therefore rerun against `e03c339`, so every assignment has evidence on the final test code.

**Task 1 (refactor).** `jest src/platform/graphql`: 5 suites, 12 tests passed, including `field-resolver-enhancers.spec.ts` and `graphiql-dev-only.spec.ts`. `pnpm --filter api build` and `lint` passed, with `git status` showing only `graphql.module.ts`. `pnpm --filter api test`: 89 suites, 1382 tests passed. Schema file `ABSENT`.

**Task 2, red (Step 2, on the Task 1 code).** `error-stacktrace.spec.ts`: 8 failed, 3 passed, all as planned.
- T1 (both queries) and T2 (both queries) failed: a stack trace was present.
- T3 failed: no stack trace under `test`.
- T4 and T5 failed: `Production` and `' production '` returned stack traces.
- T6 failed: the option was `undefined`.
- C1, C2 and C3 passed (characterization).

**Task 2, green and verification.** After Step 3, 11/11 passed. H: 23/23 passed (4 `true` rows, 19 `false` rows). After Step 5 (P1, P2): `error-stacktrace.spec.ts` 13/13 passed. Step 7: `pnpm --filter api test` 91 suites, 1418 tests passed; `lint` passed, with `git status` showing only the Task 2 files; `build` passed. Schema file `ABSENT` before and after.

**Task 3.** `error-stacktrace.spec.ts`: 16/16 passed, run twice in a row. Afterwards no `gql-stacktrace-*` directory was left in tmpdir, there was no `.env` under `apps/api`, and the schema file was `ABSENT`. `lint` passed. The K5 precondition command printed `true`.

**Break runs.** Every run used the break command `env -u NODE_ENV -u APP_DEBUG pnpm --filter api exec jest src/platform/graphql/tests/error-stacktrace.spec.ts src/platform/config/tests/graphql-stacktrace.spec.ts`. Each was recovered with `git restore`, after which `git status` was clean and the full command passed (36/36 against `bb2709c`, 39/39 against `e03c339`). Every assigned test failed, and every unassigned test passed, in every run, so every run is characterization evidence for its full assignment.

| Break | Against `bb2709c` (Task 2 Step 6) | Against `e03c339` (Task 3 Step 4) |
| --- | --- | --- |
| K1 always included | 29 failed: T1×2, T2×2, T4, T5, C1, C2, P1, P2 and all 19 `false` H rows | 31 failed: the same, plus F-b and F-c |
| K2 never included | 8 failed: T3, C3, P1, P2 and the 4 `true` H rows | 9 failed: the same, plus F-a |
| K3 production does not override the opt-in | 7 failed: T4, T5, C2 and the 4 production × `'true'` H rows | 8 failed: the same, plus F-b |
| K4a `APP_DEBUG` read at import time | 4 failed: T3, C3, P1, P2 | 5 failed: the same, plus F-a |
| K4b `NODE_ENV` read at import time | 3 failed: T4, T5, C2 | 4 failed: the same, plus F-b |
| K5 the file wins over the process environment | — (no F tests yet) | 1 failed: F-c |
| K6 `originalError` dropped when on | P1, P2 (failed on the `originalError` assertion) | P1, P2 |
| K7 `code` changed when on | P1, P2 (`Expected "BAD_REQUEST"`, `Received "CHANGED_BY_BREAK"`) | P1, P2 |

**Task 4.** One bullet added to `local-development.md` (Debugging) and one comment line to `.env.example`. `git diff` showed only those two lines. The new text adds no links.

**Task 5.**
- **Step 1.** `pnpm --filter api test`: 91 suites, 1421 tests passed. `pnpm --filter api lint` passed, with `git status` clean. `pnpm --filter api build` passed. Root `pnpm run lint`: 6/6 turbo tasks succeeded, with `git status` clean. Schema file `ABSENT`, equal to the baseline.
- **Step 2, e2e.** Run as the owner directed, with a branch-specific Test database: `DB_NAME=fix236_test env -u NODE_ENV -u APP_DEBUG pnpm --filter api test:e2e`.
  - **Result:** exit **0**; 65 suites passed, 0 failed; 731 tests passed, 0 failed, 0 skipped; 170 s.
  - **Target:** global setup printed `e2e target fix236_test@localhost:5432: created=true, applied=30, pending=0, unknown=0`. It created `fix236_test`, which did not exist before, and applied 30 migrations. The run did not target `clensy` or `clensy_test`, and used the default connection settings: the worktree has no `apps/api/.env`, and no env file was copied. No container was started, stopped or rebuilt. `fix236_test` was kept.
  - **Expected log noise, not failures:** `UnsafeDataSourceError: refused: database "clensy" is not a Test database`, with nine TypeORM retries, comes from `datasource-guard.e2e-spec.ts` ("rejects the Nest application DataSource before connecting"). It targets a fake local listener and asserts zero connections. `QueryFailedError: operator does not exist: uuid ~~* unknown` comes from `laundry-order-list-filters.e2e-spec.ts` ("rejects a partial iLike on the uuid id"). There is also a `pg` `DeprecationWarning` about concurrent `client.query()` calls. None is related to #236.
  - **Schema file:** `ABSENT` before the run. The run generated it (modified 01:26:52, after the start at 01:23:57); it is gitignored and untracked. That generated file was removed, so the schema file is `ABSENT` again, equal to the Task 0 baseline.
- **Step 3, optional manual check:** **NOT RUN**. It is optional in the plan and not a gate.
- **Step 4, invariant 6:** the merge-base diff reads only `config.get('NODE_ENV')` and `config.get('APP_DEBUG')`. No new environment variable name is added.
- **Environment note, unrelated to #236:** the main checkout's Compose container `clensy-platform-api-1` was already in a restart loop before this run (`JWT_SECRET must be set`, from its built image). It was observed only, not touched, and does not affect this slice's verification.
- **Final state:** `git status` clean apart from this record; schema file `ABSENT`.

## Slice Completion Report

| Field | Result |
| --- | --- |
| Slice | #236 GraphQL error stack traces |
| Tracking | [#236](https://github.com/rexescario-dev/clensy-platform/issues/236) |
| M4 | Plan **Accepted** (revision 3, `c75c8c9`) |
| M5 | Review **Accepted** (owner, on the independent reviewer's round 3 ACCEPT; recorded at `81e3b29`) |
| M6 | **Complete** |
| M7 | Pending (fresh, independent reviewer required: application code, `CLAUDE.md`) |
| M8 | Pending |
| M9 | Pending |
| Branch | `fix/236-graphql-stacktrace` (local only, not pushed) |
| PR | None yet |
| Status | **Ready for M7** |

### Shipped

- GraphQL error responses include `extensions.stacktrace` only when `APP_DEBUG` is exactly `true` and `NODE_ENV`, trimmed and lowercased, is not `production`. Apollo's implicit `NODE_ENV` default no longer applies.
- Production always suppresses stack traces, even with `APP_DEBUG=true` and for `Production` or ` production `.
- `NODE_ENV` and `APP_DEBUG` are read through `ConfigService` when the module is configured. The setting is honored from the process environment and from `.env`, and the process environment wins.
- Error message, path, locations, code, status and `originalError` are unchanged.
- GraphiQL, Swagger and SQL logging are unchanged. No new environment variable.
- Setup docs (`local-development.md`, `.env.example`) document the opt-in and the production override.

### Validation

| Check | Result |
| --- | --- |
| Tests | **Passed**: unit 91 suites / 1421 tests; e2e 65 suites / 731 tests (`fix236_test`, exit 0); every K1–K7 break run matched its assignment |
| Typecheck | **Passed**: `nest build` (tsc) |
| Lint | **Passed**: `pnpm --filter api lint` and root `pnpm run lint` (6/6), `git status` clean afterwards |
| Build | **Passed**: `pnpm --filter api build` |
| Package validation | N/A |

### Next Gate

**M7 — Code Review**, by a fresh, independent reviewer on the most capable model, given the Accepted spec, the Accepted plan and `git diff $(git merge-base HEAD origin/main)..HEAD`.

### M7 code review

| Field | Result |
| --- | --- |
| Decision | **APPROVED FOR MERGE** — 2026-11-26 |
| Reviewer | A fresh, independent agent on the most capable model (Opus). It did not implement the change and took part in no M3 or M5 review, as `CLAUDE.md` requires for application code. It was given the Accepted spec, the Accepted plan with the M6 record, and `git diff f0cd979..cd7abd9`. |
| Owner decision | The owner recorded M7 as Approved for merge on the reviewer's verdict (2026-11-26). This does not authorize a push, a PR or a merge. |
| Subject | `fix/236-graphql-stacktrace` at `cd7abd9`; merge base `f0cd979`. Spec `4f0bd92` and plan revision 3 (`c75c8c9`) are unchanged, apart from the plan's Status cell and its appended gate records. |
| Findings | **0 blocking, 1 minor (documentation), 2 nits.** All remain open as listed below; none is marked resolved here. |

**Review summary (reviewer).** The change meets spec §3, §4 and invariants 1–8 and stays within the plan's Scope row:
- The option is explicit and boolean.
- The opt-in is the exact string `true`, via `isAppDebugEnabled`.
- Production is matched after trimming and lowercasing.
- Both values are read through `ConfigService` in the `forRootAsync` factory.
- No new environment variable is added.
- GraphiQL's import-time gate, Swagger, `main.ts` and `database.module.ts` are untouched.
- Apart from the move into the factory and the new key, every option and comment is byte-identical (checked with a de-indented diff against `f0cd979`).
- The tests verify what they claim, and their cleanup is failure-safe.

**Findings**

| # | Severity | Location | Finding | Disposition |
| --- | --- | --- | --- | --- |
| M7-1 | Minor (docs) | `.env.example:26` | "ignored when NODE_ENV is production" can be read as "`APP_DEBUG` is ignored in production", but SQL logging still turns on in production (invariant 7). An operator could leave `APP_DEBUG=true` in production expecting no effect and get query logging. It is not a spec violation (§7 req 8 is met, and the wording follows plan Task 4 Step 2). | **Open.** Owner decision: fix in M9 with the wording "Stack traces are never added when NODE_ENV is production.", keeping the separate fact that `APP_DEBUG` also controls SQL logging. |
| M7-2 | Nit (test robustness) | `error-stacktrace.spec.ts:201–227` | If a `withEnvDir` test exceeded Jest's 5 s timeout during boot, the next test could start while the cwd is still the temporary directory, and could carry a deleted cwd into a later file in the same worker. This is theoretical: measured per-test times are 16–146 ms. | **Open, non-blocking observation.** Owner decision: no scope expansion unless M9 or a later review shows a practical failure. |
| M7-3 | Nit (coverage) | `error-stacktrace.spec.ts:272` | T6 checks only that the real `GraphqlModule`'s option is a boolean. Response-level cases run through the test's own `forRootAsync` wrapper around the shared factory. The reviewer's probe confirmed the real module's end-to-end behavior. | **Open, non-blocking observation.** |

**Observation (intended behavior, not a finding).** For non-HTTP errors (a plain `Error` thrown from a resolver) under `NODE_ENV=development`, the stack trace is now suppressed by default. The message, path, locations, code `INTERNAL_SERVER_ERROR` and Nest's server-side `ExceptionsHandler` log are unchanged. Apollo's other uses of the option (`errorResponse()` for HTTP-level request errors, and the fallback when `formatError` throws, which is invariant 5's acknowledged exception) change in line with the spec. The gateway-only use is not reached. The app has no subscriptions or other transports.

**Verification by the reviewer (run)**
- `env -u NODE_ENV -u APP_DEBUG pnpm --filter api exec jest src/platform/graphql src/platform/config`: 8 suites, 56 tests passed.
- From a hostile shell environment (`APP_DEBUG=true NODE_ENV=production`): `error-stacktrace`, `field-resolver-enhancers` and `graphiql-dev-only` passed, 19/19.
- `env -u NODE_ENV -u APP_DEBUG pnpm --filter api test`: 91 suites, 1421 tests passed.
- `pnpm --filter api lint` passed, with `git status --short` clean afterwards. `tsc --noEmit -p apps/api/tsconfig.json` exited 0.
- **Red-first reproduction:** the HEAD tests, run against the `f1fafb8` `graphql.module.ts` in a scratch `git archive` copy, failed T1×2, T2×2, T3, T4, T5 and T6, and passed C1–C3.
- **Edge probe:**

  | Input | Result |
  | --- | --- |
  | `NODE_ENV='production\n'` + `APP_DEBUG=true` | no stack trace |
  | `NODE_ENV='\tPRODUCTION\r\n'` | suppressed |
  | `APP_DEBUG=' true'` and `'true\n'` | no stack trace |
  | `NODE_ENV='prod'` | not production |

  The real `GraphqlModule` writes its schema to `<cwd>/src/schema.gql`.
- `apps/api/src/schema.gql` was `ABSENT` after every run.

**Verification by the reviewer (read):** the spec, the plan and the M6 record; the full diff and each commit; `app.module.ts`, `main.ts`, `database.module.ts` and `config.module.ts`; and the installed sources of `@nestjs/config` 4.0.4, `@apollo/server` 5.5.1 and `@nestjs/apollo` 13.4.4. The M6 rulings (1)–(3) were found sound.

**Not re-verified by the reviewer:**
- e2e (65 suites / 731 tests) and the K1–K7 break runs: on record from M6 only. The review brief did not allow them.
- Root `pnpm run lint` and `pnpm --filter api build`: not rerun; `tsc --noEmit` and `api` lint stood in for them.
- The live Compose stack: the plan's optional Task 5 Step 3 was not run by anyone.

**Side effect:** `tsc --noEmit` (the project uses `incremental: true`) rewrote `apps/api/dist/tsconfig.tsbuildinfo`. That file is gitignored, no tracked file changed, and `git status --short` stayed clean.

### M8 refactoring

```text
Decision: N/A
Subject: fix/236-graphql-stacktrace, range f0cd979..59dbd12 (implementation commits f1fafb8, bb2709c, e03c339, 348e179)
Scope considered:
- apps/api/src/platform/graphql/graphql.module.ts
- apps/api/src/platform/config/graphql-stacktrace.ts
- apps/api/src/platform/graphql/tests/error-stacktrace.spec.ts
- apps/api/src/platform/config/tests/graphql-stacktrace.spec.ts
Accepted specification: docs/superpowers/specs/2026-11-26-graphql-error-stacktrace-design.md
Accepted implementation plan: docs/superpowers/plans/2026-11-26-graphql-error-stacktrace-plan.md (revision 3)
M7 / authorization: Approved for merge (59dbd12); owner authorized M8–M10 (2026-11-26)
Rationale:
- The production change is a 13-line pure helper plus one option in an existing factory. M7 found no maintainability issue in it.
- The only candidate is the test file: applyEnv and restoreEnv have similar loops, and withApp and withEnvDir share a cleanup shape. They stay separate on purpose. Each states its own C7 ordering, and the K1–K7 break evidence was recorded against this exact test code. A refactor would need that characterization evidence to be re-established, so the risk outweighs the small benefit.
- M7-2 (the cwd carried over on a timeout) and M7-3 (T6 checks only the type) are not behavior-preserving maintainability changes. By the owner's decision they remain open observations, not M8 work.
Changes: none
Verification: not applicable (no change). Last recorded runs: unit 91/1421 and e2e 65/731 (M6); reviewer rerun unit 91/1421 (M7)
Externally observable behavior changes: None
Gate: N/A
```

### M9 documentation

```text
Decision: Complete
Subject: #236 GraphQL error stack traces, fix/236-graphql-stacktrace (M7-approved, not pushed, not merged)
Accepted specification: docs/superpowers/specs/2026-11-26-graphql-error-stacktrace-design.md
Accepted implementation plan: docs/superpowers/plans/2026-11-26-graphql-error-stacktrace-plan.md (revision 3)
M7: Approved for merge (59dbd12). M8: N/A
Documentation scope (paths that could be edited):
- .env.example (the APP_DEBUG comment)
- docs/superpowers/README.md (specs index, plan count)
- this plan (gate records only)
Content updates (commit 859e27c):
- .env.example: "ignored when NODE_ENV is production" replaced by "Stack traces are never added when NODE_ENV is production." The SQL-logging lines are unchanged. Cause: M7-1, with the wording the owner decided.
- docs/superpowers/README.md: a Platform and API row for the Accepted spec, and the plan count 80 → 81. Cause: the spec is Accepted at 4f0bd92, and this plan is the 81st file in plans/.
Editorial updates: none
Not changed, by design:
- docs/getting-started/local-development.md: its Debugging bullet (348e179, Task 4) is accurate; M7 confirmed it.
- docs/history/shipped-slices.md: notes are written when a slice ships. #236 is not merged, so its note belongs to closeout after merge, not here.
- docs/superpowers/plans/2026-11-03-laundry-invoice-payment-browser-check-plan.md: it records the #209 observation that led to #236. Plans are historical (docs/superpowers/README.md), so it is not updated.
- The Accepted spec: unchanged. Its Status (Accepted) matches reality.
Editorial verification:
- Internal links: the new index link resolves (specs/2026-11-26-graphql-error-stacktrace-design.md exists); the plan's anchors (#m6-execution-record, #m7-code-review, #m8-refactoring) resolve.
- Heading hierarchy: the gate records are ### under "## Gate outcomes".
- Contradictions: none. .env.example, local-development.md and spec §3/§4 agree (opt-in exactly `true`; production always suppresses).
- Status consistency: spec Accepted; plan Accepted, with the M6/M7/M8/M9/M10 records appended.
- Terminology: "stack trace", "opt-in" and "production" are used as defined in spec §3.
Gate: Complete
```

M7-1 is **resolved** by `859e27c`. M7-2 and M7-3 remain **open**, non-blocking observations (owner decision: no scope expansion).

### M10 workflow validation

**N/A.** This slice changes no workflow asset: `git diff --name-only f0cd979 HEAD -- docs/workflows .claude workflow.yaml` is empty. Under process spec §2.12, M10 applies only when a slice changes workflow assets, so it does not apply here.

## Slice Completion Report (M8–M10)

| Field | Result |
| --- | --- |
| Slice | #236 GraphQL error stack traces |
| Tracking | [#236](https://github.com/rexescario-dev/clensy-platform/issues/236) |
| M4 | Plan **Accepted** (revision 3, `c75c8c9`) |
| M5 | Review **Accepted** (`81e3b29`) |
| M6 | **Complete** (`cd7abd9`) |
| M7 | **Approved** for merge (independent reviewer; recorded at `59dbd12`) |
| M8 | **N/A** (rationale recorded above) |
| M9 | **Complete** (`859e27c`) |
| M10 | N/A (no workflow asset changed) |
| Branch | `fix/236-graphql-stacktrace` (local only, not pushed) |
| PR | None. Push and PR are not authorized. |
| Status | **Ready for closeout** (push, PR and a human-authorized merge are pending) |

### Shipped

- GraphQL error responses include `extensions.stacktrace` only when `APP_DEBUG` is exactly `true` and `NODE_ENV`, trimmed and lowercased, is not `production`. The setting is passed to Apollo explicitly and read through `ConfigService`.
- Production always suppresses stack traces. The process environment wins over `.env`.
- Error message, path, locations, code, status and `originalError` are unchanged. GraphiQL, Swagger and SQL logging are unchanged.
- Setup docs and `.env.example` describe the opt-in and the production rule. The spec is indexed.

### Validation

| Check | Result |
| --- | --- |
| Tests | **Passed**: unit 91 suites / 1421 tests; e2e 65 suites / 731 tests (`fix236_test`); K1–K7 break runs matched their assignments |
| Typecheck | **Passed**: `nest build` (M6), `tsc --noEmit` (M7) |
| Lint | **Passed**: `api` and root lint (M6), `api` lint (M7) |
| Build | **Passed**: `pnpm --filter api build` (M6) |
| Package validation | N/A |

### Next Gate

**Closeout (§2.12)**: push the branch and open the single issue PR, CI, then a human-authorized merge. After the merge, add the shipped-slices note. None of this is authorized yet.
