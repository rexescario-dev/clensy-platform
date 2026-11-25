# GraphQL Error Stack Traces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Draft**, 2026-11-26 (M4). Awaiting Plan Review (M5). |
| Date | 2026-11-26 |
| Tracking issue | [#236](https://github.com/rexescario-dev/clensy-platform/issues/236) "fix(api): don't include stack traces in GraphQL error responses outside production" |
| Spec | [GraphQL Error Stack Traces](../specs/2026-11-26-graphql-error-stacktrace-design.md), Status **Accepted** (revision 3, M3 round 2, 2026-11-26, recorded at `4f0bd92`). |
| Owner instructions carried from M3 | (1) **`JWT_SECRET`:** set it in test setup for the `development`, unset-`NODE_ENV` and `production` scenarios wherever authentication is booted. (2) **Config-source coverage:** a test with a temporary `.env` proves `APP_DEBUG` and `NODE_ENV` are honored from the file source (spec invariant 4). It is isolated and removes its temporary file. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. File names, helper names, step order and commit wording are planning decisions, not product semantics. |
| Branch | `fix/236-graphql-stacktrace`, from `origin/main` at `f0cd979`, in worktree `.worktrees/236-graphql-stacktrace`, carrying the spec (`4f0bd92`) and this plan. One PR for the spec, this plan, its gate records and the change (process spec §2.8). |
| Scope | Exactly: `apps/api/src/platform/graphql/graphql.module.ts`; a new helper under `apps/api/src/platform/config/`; new tests under `apps/api/src/platform/config/tests/` and `apps/api/src/platform/graphql/tests/`; `docs/getting-started/local-development.md` (Debugging); `.env.example` (`APP_DEBUG` comment); the spec and this plan. **No** change to GraphiQL registration, `main.ts`, `setup-api-docs.ts`, `database.module.ts`, `config.module.ts`, `app-debug.ts`, `dev-owner-config.ts`, `Dockerfile`, `docker-compose.yml`, `src/schema.gql`, or any resolver or service (spec §2, §5 invariant 7). |
| Task types | Task 1 `code` (refactor, no behavior change). Task 2 `code` (the fix, TDD). Task 3 `code` (config-source coverage). Task 4 `docs/process`. Task 5 `docs/process` (verification and gate records). No `configuration` task: nothing outside the repository changes. |
| Characterization tests | One group, in Task 2 Step 6 (error preservation, spec §7 req 4). The required break run is recorded there. |
| Pre-validation | **None.** No code in this plan was run before M5. |
| M7 | Application code: under `CLAUDE.md`, a **fresh, independent reviewer** on the most capable model, given the Accepted spec, the Accepted plan and the branch diff. |

**Goal:** The API passes `includeStacktraceInErrorResponses` to Apollo explicitly. It is `true` if and only if `APP_DEBUG` is exactly `true` and `NODE_ENV`, trimmed and lowercased, is not `production`. Both values are read through `ConfigService` when the GraphQL module is configured. Nothing else about GraphQL error responses changes.

**Architecture:** A pure helper decides the boolean from the two raw values. It reuses `isAppDebugEnabled` for the opt-in, and its own trimmed, lowercased production check. `GraphqlModule` switches from `NestGraphQLModule.forRoot` to `forRootAsync` with `imports: [ConfigModule]` and `inject: [ConfigService]`, the same pattern as `database.module.ts`. An exported options factory returns the existing options unchanged, plus the new boolean. Tests drive real HTTP GraphQL requests against a minimal Nest app that uses the same factory and a test-only resolver.

**Tech stack:** NestJS 11, `@nestjs/graphql` + `@nestjs/apollo` 13.4.4, `@apollo/server` 5.5.1, `@nestjs/config` 4.0.4, Jest 30 + ts-jest, supertest 7.

## Non-goals of this plan

Everything in spec §2 "Out of scope" and §1.2 non-goals. In particular: no `formatError`, no error masking, no change to GraphiQL or Swagger gating, no new environment variable, no refactor of `dev-owner-config.ts`'s own production check, and no general config layer (#226).

## Global constraints (from the Accepted spec)

- **C1** (inv. 1): `includeStacktraceInErrorResponses` SHALL always be passed explicitly as a boolean.
- **C2** (§4, inv. 2, §3): SHALL be `true` only when `isAppDebugEnabled(APP_DEBUG)` holds and `NODE_ENV?.trim().toLowerCase() !== 'production'`.
- **C3** (inv. 3): the opt-in SHALL use `isAppDebugEnabled`, and no other truthiness test.
- **C4** (inv. 4, 8): `APP_DEBUG` and `NODE_ENV` SHALL be read through `ConfigService` in the module's async factory, not from `process.env` at import time. No second config mechanism.
- **C5** (inv. 5): every other option currently passed to `NestGraphQLModule` SHALL be kept exactly: `autoSchemaFile`, `context`, `driver`, `fieldResolverEnhancers`, `playground`, `sortSchema`, and the existing comments. No `formatError`.
- **C6** (inv. 7): the import-time `isProduction` that gates `GraphiqlController` SHALL stay as it is.
- **C7** (§7 req 6): every test that sets `NODE_ENV` or `APP_DEBUG` SHALL restore the previous value, deleting the key if it was unset. No test SHALL read a developer's `apps/api/.env`.
- **C8:** tests SHALL NOT write `src/schema.gql`. The test app uses an in-memory schema (`autoSchemaFile: true`), overriding only that one option of the real factory.

## Traceability

| Spec item | Task |
| --- | --- |
| §4 rule, §3 production match, inv. 1–3 | Task 2 (helper + truth-table tests; module wiring) |
| Inv. 4, 8 (ConfigService, no import-order dependence) | Task 1 (forRootAsync), Task 3 (file-source test) |
| Inv. 5, §7 req 4 (preservation) | Task 2 Step 6 (characterization group) |
| Inv. 7 (GraphiQL, Swagger, SQL logging unchanged) | Task 1 Step 4, Task 5 (existing suites) |
| §7 req 1–3, 5, 7 (response-level) | Task 2 Steps 2–5 |
| §7 req 6 (isolation) | C7, applied in Tasks 2–3 |
| §7 req 8 (docs) | Task 4 |
| Owner instruction 1 (`JWT_SECRET`) | Task 2 Step 1 note, Task 5 |
| Owner instruction 2 (config-source coverage) | Task 3 |

## Task 1 — Move `GraphqlModule` to `forRootAsync` (`code`, refactor, no behavior change)

Implements C4 and C5 structurally. Behavior is unchanged: the factory does not yet set the stack-trace option, so Apollo's default still applies.

- [ ] **Step 1.** In `graphql.module.ts`, export a factory `graphqlModuleOptions(config: ConfigService): ApolloDriverConfig` (name is a planning choice). It returns the current options object verbatim, comments included. Replace `NestGraphQLModule.forRoot<ApolloDriverConfig>({...})` with `NestGraphQLModule.forRootAsync<ApolloDriverConfig>({ driver: ApolloDriver, imports: [ConfigModule], inject: [ConfigService], useFactory: graphqlModuleOptions })`. Keep `const isProduction` and `controllers` unchanged (C6). `config` is unused in this task. Add an eslint-disable only if lint requires one, or reference it in Task 2 instead. M6 chooses.
- [ ] **Step 2.** Run `pnpm --filter api exec jest src/platform/graphql`. **Expected:** all existing graphql specs pass, including `field-resolver-enhancers.spec.ts` (which imports `GraphqlModule` alone and reads `GRAPHQL_MODULE_OPTIONS`) and `graphiql-dev-only.spec.ts`. If `field-resolver-enhancers.spec.ts` cannot resolve `ConfigService`, that is a defect in Step 1's `imports`, not a reason to edit the test.
- [ ] **Step 3.** Run `pnpm --filter api build` and `pnpm --filter api lint`. **Expected:** both succeed. `git diff --stat` shows that `src/schema.gql` is unchanged. A change to `src/schema.gql` would mean the options moved.
- [ ] **Step 4.** Run `pnpm --filter api test`. **Expected:** pass.
- [ ] **Step 5.** Commit: `refactor(api): configure GraphQL through forRootAsync (#236)`.

## Task 2 — Explicit stack-trace setting (`code`, TDD)

- [ ] **Step 1 — test harness.** Create `src/platform/graphql/tests/error-stacktrace.spec.ts` (the name is a planning choice). It contains:
  - a test-only `@Resolver()` with queries that throw `BadRequestException` (predefined → `BAD_REQUEST`) and `NotFoundException` (404, not predefined → `INTERNAL_SERVER_ERROR` with `extensions.status: 404`, spec §7 req 4). Each query has a `@Args`-free signature and returns `String`;
  - `bootApp(env: { NODE_ENV?: string; APP_DEBUG?: string })`. It saves the previous values of both keys, sets or deletes each one, then builds `Test.createTestingModule({ imports: [ConfigModule.forRoot({ ignoreEnvFile: true }), NestGraphQLModule.forRootAsync({ driver: ApolloDriver, imports: [ConfigModule], inject: [ConfigService], useFactory: (c) => ({ ...graphqlModuleOptions(c), autoSchemaFile: true }) })], providers: [TestResolver] })`. It calls `app.init()` and returns the app plus a `restore()` that closes the app and restores both keys (deleting the ones that were unset) (C7, C8). `ignoreEnvFile: true` keeps the developer's `apps/api/.env` out (C7);
  - `query(app, field)` posts `{ query: "{ <field> }" }` to `/graphql` with supertest and returns `body.errors[0]`.

  **`JWT_SECRET` (owner instruction 1):** this harness does not boot `AuthModule`, so `JwtStrategy` and `TokenService` are not constructed and `JWT_SECRET` is not needed. If M6 has to add anything that boots auth under a non-`test` `NODE_ENV`, set `JWT_SECRET` to a fixed test value in `bootApp`, save it first, and restore it in `restore()`.
- [ ] **Step 2 — red: spec §7 req 1.** Add tests. With `APP_DEBUG` unset, for each of `NODE_ENV=development` and `NODE_ENV` unset, and for both test queries, `extensions.stacktrace` is `undefined`. Run the file. **Expected:** these tests **fail** on the Task 1 code, because Apollo's default includes a stack trace for those `NODE_ENV` values (spec §1.1). Record the failure output.
- [ ] **Step 3 — helper and wiring (green).**
  - Create `src/platform/config/graphql-stacktrace.ts` (name is a planning choice) exporting `includeStacktraceInErrorResponses(nodeEnv: string | undefined, appDebug: string | undefined): boolean`, which returns `isAppDebugEnabled(appDebug) && (nodeEnv ?? '').trim().toLowerCase() !== 'production'` (C2, C3).
  - In `graphqlModuleOptions`, add `includeStacktraceInErrorResponses: includeStacktraceInErrorResponses(config.get('NODE_ENV'), config.get('APP_DEBUG'))` (C1, C4).
  - Run the file. **Expected:** Step 2's tests pass.
- [ ] **Step 4 — helper truth table.** Create `src/platform/config/tests/graphql-stacktrace.spec.ts`, with `it.each` over every §4 row plus §3's variants. **Expected:** `true` only for (`development`|`test`|`staging`|unset) × `'true'`; `false` for `APP_DEBUG` ∈ {unset, `''`, `'false'`, `'1'`, `'TRUE'`} under any `NODE_ENV`; `false` for `NODE_ENV` ∈ {`production`, `Production`, `' production '`, `'PRODUCTION'`} × `'true'`. Run. **Expected:** pass. These tests were written after the helper. They are not labelled characterization tests, because they pin the new behavior and not already-correct behavior, so M6 SHALL confirm they can fail by running them once with the helper returning a constant `true`, outside the commit.
- [ ] **Step 5 — response-level cases (spec §7 req 2, 3, 5, 7).** Add these tests to `error-stacktrace.spec.ts`:
  - **Req 3:** `APP_DEBUG=true` with `NODE_ENV=development`, and `APP_DEBUG=true` with `NODE_ENV=test`, each include a non-empty `extensions.stacktrace` array.
  - **Req 2:** `NODE_ENV=production` with `APP_DEBUG` unset, and `NODE_ENV=production` with `APP_DEBUG=true`, give no `extensions.stacktrace`, on the `BadRequestException` query (an `HttpException`-derived error that the Nest transform rewrites).
  - **Req 7:** `NODE_ENV=Production` and `NODE_ENV=' production '`, each with `APP_DEBUG=true`, give no stack trace.
  - Run. **Expected:** all pass.
- [ ] **Step 6 — preservation (spec §7 req 4), characterization group.** For each test query, boot once with `NODE_ENV=development, APP_DEBUG=true` (on) and once with `NODE_ENV=development` and `APP_DEBUG` unset (off). Compare the two `errors[0]` objects with `extensions.stacktrace` deleted from the "on" copy: they SHALL be deep-equal. That covers `message`, `path`, `locations`, `extensions.code`, `extensions.status` (404 case) and `extensions.originalError`. Also assert the expected literal values (`code` `BAD_REQUEST`, and for 404: `INTERNAL_SERVER_ERROR` and `status: 404`), so that an equal-but-wrong pair cannot pass.
  - **Label:** characterization tests. They pin the existing behavior of `@nestjs/apollo`'s transform, which this slice must not change.
  - **Break run (outside the commit, not committed):** make the GraphQL error formatting drop `extensions.originalError` (and, separately, change `extensions.code`) only when stack traces are on. **Expected:** the Step 6 tests fail for the affected query. Then revert the break and confirm they pass. Record both runs. M6 chooses the source edit that produces this behavior.
- [ ] **Step 7.** Run `pnpm --filter api test`, `pnpm --filter api lint` and `pnpm --filter api build`. **Expected:** all pass, and `src/schema.gql` is unchanged.
- [ ] **Step 8.** Commit: `fix(api): set GraphQL stack-trace inclusion explicitly from APP_DEBUG (#236)`.

## Task 3 — Config-source coverage (`code`, owner instruction 2, spec inv. 4)

Uses the precedent in `test/e2e-isolation.e2e-spec.ts`: a temporary directory holding a `.env` and `process.chdir` into it. This is the same file `ConfigModule.forRoot()` reads as `apps/api/.env` when the cwd is `apps/api`. It never creates, overwrites or deletes the developer's real `apps/api/.env`.

- [ ] **Step 1.** In `error-stacktrace.spec.ts` (or a sibling file; M6 chooses), add a `describe` block that:
  - creates a temporary directory with `mkdtempSync(join(tmpdir(), 'gql-stacktrace-'))`;
  - saves `process.cwd()` and the previous `NODE_ENV` and `APP_DEBUG`, and deletes both from `process.env`;
  - writes `.env` into the temporary directory and `chdir`s there;
  - boots the module with `ConfigModule.forRoot()` (default `envFilePath`, no `ignoreEnvFile`) in place of the harness's `ignoreEnvFile: true`;
  - in `afterEach`: closes the app, `chdir`s back, removes the directory with `rmSync(..., { recursive: true, force: true })`, deletes any `NODE_ENV` or `APP_DEBUG` that `forRoot` copied into `process.env`, and restores the saved values (C7).
- [ ] **Step 2.** Cases:
  - **(a)** `.env` = `APP_DEBUG=true\nNODE_ENV=development\n`: the response includes a stack trace. This proves `APP_DEBUG` is honored from the file.
  - **(b)** `.env` = `APP_DEBUG=true\nNODE_ENV=production\n`: no stack trace. This proves `NODE_ENV` is honored from the file.
  - **(c)** `.env` = `APP_DEBUG=true\n` with `process.env.APP_DEBUG='false'` set before boot: no stack trace. This proves process environment wins over the file (inv. 4 precedence). Restore as in C7.
- [ ] **Step 3.** Run the file. **Expected:** pass. Then `git status --short apps/api` shows no new `.env` and no other untracked file. Run it twice in a row to confirm no leakage between runs.
- [ ] **Step 4.** If `process.chdir` is unavailable in the Jest worker, M6 stops and reports. It does not fall back to writing `apps/api/.env`.
- [ ] **Step 5.** Commit: `test(api): cover APP_DEBUG and NODE_ENV from the .env source (#236)`.

## Task 4 — Setup documentation (`docs/process`, spec §7 req 8)

- [ ] **Step 1.** `docs/getting-started/local-development.md`, Debugging section. Next to the SQL-logging bullet, add a bullet saying that `APP_DEBUG=true` also adds `extensions.stacktrace` to GraphQL error responses. Off by default, and `NODE_ENV=production` (any case, surrounding whitespace ignored) always suppresses it. For the Compose stack, set it in the root `.env` (or export it in the shell that runs `docker compose`), then `docker compose up -d api`. Keep the existing bullet's wording unchanged.
- [ ] **Step 2.** `.env.example`, `APP_DEBUG` comment: add one line, "also adds stack traces to GraphQL error responses; ignored when `NODE_ENV` is production". Do not change the variable or its other lines.
- [ ] **Step 3.** Verify: `git diff` touches only those lines. Every relative link in the changed section resolves.
- [ ] **Step 4.** Commit: `docs: document APP_DEBUG stack traces in GraphQL errors (#236)`.

## Task 5 — Verification and gate records (`docs/process`)

- [ ] **Step 1.** Full runs from the worktree root:
  - `pnpm --filter api test`;
  - `pnpm --filter api lint`;
  - `pnpm --filter api build`;
  - `pnpm --filter api test:e2e` (needs the local Postgres stack; `DB_NAME` must not be exported in the shell);
  - `pnpm run lint`.

  **Expected:** all pass. Record the exact counts in the Execution record. If e2e cannot run (no database), record **NOT RUN** with the reason. It is not a pass.
- [ ] **Step 2 — optional manual check, local stack.** With `NODE_ENV` unset in the root `.env` (Compose default `development`) and `APP_DEBUG` empty, a rejected mutation (for example `refundInvoicePayment` with an invalid amount, as in #209) returns its message and `BAD_REQUEST` without `extensions.stacktrace`. With `APP_DEBUG=true` and `docker compose up -d --build api`, the same call includes it. Record what ran, or "not run".
- [ ] **Step 3.** Append the M6 Execution record and a Slice Completion Report (per `docs/workflows/conventions/reporting-conventions.md`) to this plan. Commit.
- [ ] **Step 4.** Hand off to M7: a fresh, independent reviewer (CLAUDE.md), given the Accepted spec, the Accepted plan and `git diff $(git merge-base HEAD origin/main)..HEAD`.

## Execution and scheduling risks

- **`forRootAsync` and `GRAPHQL_MODULE_OPTIONS`.** `field-resolver-enhancers.spec.ts` reads the options token after `compile()`. With an async factory the token is still provided; Task 1 Step 2 checks this before any behavior change.
- **Test env and Apollo construction time.** Apollo reads the option when the server is created (`app.init()`), so `bootApp` sets the environment before `init`. `ConfigService.get` reads `process.env` live (no cache configured), so values set before boot are seen.
- **`process.env` leakage from `ConfigModule.forRoot()`.** `assignVariablesToProcess` writes file values into `process.env` permanently. Task 3's `afterEach` deletes them explicitly.
- **Jest workers.** Jest gives each test file its own copy of `process.env`, but several files can run one after another in the same worker process, and `process.chdir` changes that whole process. Task 3 therefore always `chdir`s back in `afterEach`, even when a test fails. Inside a file, tests run serially.

## Gate outcomes

*(M5–M10 records are appended here.)*
