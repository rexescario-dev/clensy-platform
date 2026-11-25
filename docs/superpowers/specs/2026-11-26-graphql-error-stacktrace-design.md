# GraphQL Error Stack Traces — Design

| Field | Value |
| --- | --- |
| Status | **Accepted** (revision 3), 2026-11-26 (M3 round 2). |
| M3 decision | **Accepted** — 2026-11-26, by the owner, on the independent reviewer's round 2 recommendation (no blocking findings). Q1 decided: fail-safe production match (§3). Acceptance-record edits applied with the status change: §3, §7 requirement 7, §10, and the §1.1 Compose wording (round 2 note 3). Carried into M4: round 2 notes 1 (`JWT_SECRET` in test setup) and 2 (config-source coverage with a temporary `apps/api/.env`), as owner instructions. Does not authorise implementation. |
| M3 history | **Round 1** (independent reviewer, 2026-11-26, reviewed revision 2): **Returned for Revision**. Blocking B1: the §1.1 config-timing claim and the invariant 8 GraphiQL sentence were wrong. Blocking B2: Apollo's default also excludes `NODE_ENV=test`, so a §7 req 1 test under `test` would pass on unfixed `main`. Non-blocking notes 1–6 and the isolation gap in check b: all adopted in revision 3. Q1: the reviewer recommends the fail-safe match. **Round 2** (same independent reviewer, 2026-11-26, reviewed revision 3): **recommended Accepted**. No blocking findings. B1, B2, notes 1–3, 5 and 6, and the check-b gap confirmed resolved. Q1 decided: fail-safe match. Non-blocking notes: (1) `JWT_SECRET` needed outside `test`; (2) no §7 requirement covers the `apps/api/.env` source; (3) the §1.1 Compose wording omitted shell-exported values. |
| Revision history | Revision 1: first draft. Revision 2: applies the owner's pre-M3 checks. It adds the config-loading facts (§1.1), the production-match question (§3, §10), tighter invariants 4 and 8, and the response-level, isolation and preservation requirements in §7. The §4 rule and both owner decisions are unchanged. Revision 3: applies M3 round 1. It corrects §1.1 (Apollo's default; config timing; Compose shadowing), restates the reason for invariant 4, scopes invariant 5, removes the false GraphiQL sentence from invariant 8, and tightens §7 requirements 1–4, 6 and 8. The §4 rule is unchanged. |
| Date | 2026-11-26 |
| Document kind | Architecture RFC (small). It defines what API clients receive in GraphQL error responses. |
| Tracking issue | [#236](https://github.com/rexescario-dev/clensy-platform/issues/236) "fix(api): don't include stack traces in GraphQL error responses outside production". Found during the #209 browser check (2026-11-14). Severity: low, hardening. |
| Depends on | No Accepted specification. **Relies upon**, unchanged: the `APP_DEBUG` operator debug flag and its exact-string rule (`apps/api/src/platform/config/app-debug.ts`, `.env.example`, [local development](../../getting-started/local-development.md#debugging)); the `NODE_ENV` defaults in `Dockerfile` (`production`) and `docker-compose.yml` (`development`, #109). **Constrains** `apps/api/src/platform/graphql/graphql.module.ts`. |
| Related, not changed | [#226](https://github.com/rexescario-dev/clensy-platform/issues/226) (JWT secret and runtime configuration); #109 / #91 (GraphiQL and Swagger exposure outside production). |
| Slice type | Application code (`apps/api`). Under `CLAUDE.md`, M7 needs a fresh, independent reviewer. No live setting outside the repository, so the [configuration-change convention](../../workflows/conventions/configuration-change.md) does not apply. |

## 1. Primary question and thesis

**Question:** When may a GraphQL error response from the API include a server stack trace?

**Thesis:** Only when the operator asks for one, by setting `APP_DEBUG` to the exact string `true`, and never when `NODE_ENV` is `production`. The API sets Apollo's `includeStacktraceInErrorResponses` explicitly to that result. Apollo no longer picks a default from `NODE_ENV`. Nothing else about error responses changes.

### 1.1 Background (state on `main` at `f0cd979`, verified 2026-11-26)

- `GraphqlModule` (`apps/api/src/platform/graphql/graphql.module.ts`) calls `NestGraphQLModule.forRoot<ApolloDriverConfig>({…})` with neither `includeStacktraceInErrorResponses` nor `formatError`. `apps/api/src` sets neither anywhere.
- Apollo Server (`@apollo/server` 5.5.1) therefore defaults `includeStacktraceInErrorResponses` to `NODE_ENV !== 'production' && NODE_ENV !== 'test'` (`dist/cjs/ApolloServer.js:138-139`), and puts `extensions.stacktrace` on every error when it is true. Under Jest's default `NODE_ENV=test`, today's code already returns no stack trace; under `development`, unset, or any other value, it does.
- `@nestjs/apollo` 13.4.4 wraps `formatError` with its HTTP-exception transform (`apollo-base.driver.js` `createTransformHttpErrorFn`). That transform builds a new error from `...formattedError.extensions`, so it carries the `stacktrace` Apollo already added. It also sets `extensions.code`, `extensions.status` (non-predefined statuses only) and `extensions.originalError` (the exception's `response` object).
- `Dockerfile` sets `ENV NODE_ENV=production`. `docker-compose.yml` sets `NODE_ENV: ${NODE_ENV:-development}`. The local stack therefore returns stack traces today. #209's example: a rejected `refundInvoicePayment` returned `BAD_REQUEST` with its message and a stack trace.
- `APP_DEBUG` already exists. `.env.example` describes it as the "operator debug umbrella", says only the exact string `true` enables it, and says later debug channels can use the same flag. Today it only turns on TypeORM query logging, read through `ConfigService` in `database.module.ts` and tested by `isAppDebugEnabled`. It reaches the API either from the root `.env` (via `docker-compose.yml`, `APP_DEBUG: ${APP_DEBUG:-}`) or from `apps/api/.env` (via Nest `ConfigModule`). Under Compose the variable is always defined (possibly empty), and the process environment wins, so only the value Compose substitutes takes effect there: one exported in the shell that runs `docker compose`, else the root `.env`. `apps/api/.env` is copied into the image (`.dockerignore` excludes only the root `.env`), so a value in it reaches a bare image; `ENV NODE_ENV=production` still applies there.
- **Config precedence and timing** (`@nestjs/config` 4.0.4, verified in `dist/config.module.js` and `dist/config.service.js`). `AppConfigModule` (`apps/api/src/platform/config/config.module.ts`) calls `ConfigModule.forRoot({ isGlobal: true })` in its own `@Module` decorator, with no validation schema. `forRoot` loads `.env` and runs `assignVariablesToProcess` synchronously, before its first `await`. `assignVariablesToProcess` copies file values only into keys not already in `process.env`, so the process environment (including Compose) wins over the file. `ConfigService.get` returns the merged value. `app.module.ts` imports `config.module` before `graphql.module`, so in the running app the import-time read `process.env.NODE_ENV` in `graphql.module.ts` does see `apps/api/.env`. That read still depends on module import order: a test that loads `graphql.module.ts` without `config.module.ts` sees the process environment only. `database.module.ts` reads `APP_DEBUG` through `ConfigService` in a `forRootAsync` factory, which does not depend on import order.
- **Production matching today.** `main.ts`, `graphql.module.ts` and `setup-api-docs.ts` compare `NODE_ENV` to `'production'` exactly. The dev-owner seed (`dev-owner-config.ts`), a safety refusal, treats `NODE_ENV` as production after trimming and lowercasing it.

### 1.2 Goals and non-goals

**Goals:**

1. No GraphQL error response contains a stack trace unless the operator opted in, whatever `NODE_ENV` is.
2. Production never contains one, even with the opt-in.
3. Local debugging keeps a documented, explicit way to see stack traces.

**Non-goals:**

1. Changing any other part of an error response (message, code, path, locations, other extensions).
2. Error masking, a custom `formatError`, or new error-reporting behavior.
3. Changing GraphiQL, Swagger, SQL logging, or how `NODE_ENV` is set anywhere.
4. A general configuration or validation layer for the API (#226).

## 2. Scope

**In scope (normative):**

1. The value of Apollo's `includeStacktraceInErrorResponses` for the API's GraphQL endpoint: set explicitly, by the rule in §4.
2. Tests that cover that rule and the resulting responses (§7).
3. Setup documentation of the opt-in: `docs/getting-started/local-development.md` (Debugging section) and the `APP_DEBUG` comment in `.env.example`.

**Informative:** Apollo Server's and `@nestjs/apollo`'s documented behavior, as installed.

**Out of scope:**

- JWT secret and other runtime configuration (#226).
- GraphiQL and Swagger exposure (#109, #91). They keep keying on `NODE_ENV` alone.
- Error wording, codes, `extensions.status`, `extensions.originalError`, and any other extension, for any error.
- A custom `formatError`, error masking, or changing how unexpected (non-HTTP) errors are reported. These are possible follow-ons, not this slice.
- REST (`/api-docs`, other controllers) error bodies and server-side logging.
- `Dockerfile` and `docker-compose.yml` `NODE_ENV` defaults.

## 3. Terminology

- **Stack trace in a response:** an `extensions.stacktrace` entry on any error in a GraphQL response body.
- **Opt-in:** `APP_DEBUG` set to exactly `true`, as `isAppDebugEnabled` decides. Unset, empty, `false`, `1`, `TRUE` and every other value are not the opt-in.
- **Production (for this rule):** `NODE_ENV` whose trimmed, lowercased value is `production`. This follows the dev-owner seed's safety refusal, not the exact match GraphiQL and Swagger use. The rule then fails safe: a mistyped `Production` or ` production` still suppresses stack traces. The difference from the exact match only ever removes stack traces, never adds them. GraphiQL and Swagger keep their exact match (out of scope). Decided in M3 round 2 (§10, Q1): `production`, `Production` and ` production ` all suppress stack traces.

## 4. Behavior

Stack traces are included **if and only if** the opt-in is set **and** `NODE_ENV` is not production.

| `NODE_ENV` | `APP_DEBUG` | Stack traces in responses |
| --- | --- | --- |
| `development` (Compose default) | unset, empty or `false` | No |
| `development` | `true` | Yes |
| `test` | unset | No |
| `test` | `true` | Yes |
| unset, or any other non-production value (e.g. `staging`) | not `true` | No |
| unset, or any other non-production value | `true` | Yes |
| `production` | unset, empty or `false` | No |
| `production` | `true` | **No** — production overrides the opt-in |

## 5. Invariants

1. The API MUST pass `includeStacktraceInErrorResponses` to Apollo explicitly, as a boolean, so that Apollo's `NODE_ENV`-based default never applies.
2. The value MUST be `true` only as §4 allows. Production MUST take precedence over the opt-in.
3. The opt-in MUST use the existing exact-string rule (`isAppDebugEnabled`) and no other truthiness test.
4. `APP_DEBUG` MUST be honored from the same sources the SQL-logging use honors (process environment, including Compose, and `apps/api/.env` through Nest `ConfigModule`), with the same precedence: process environment over file. The opt-in MUST NOT depend on which source sets it. The value MUST be read through `ConfigService` when the GraphQL module is configured, not from `process.env` when the module file is imported. Reasons: no dependence on module import order (§1.1), consistency with the existing `APP_DEBUG` read in `database.module.ts`, and testability. No second configuration-reading mechanism is introduced.
5. For every error that formats successfully, `message`, `path`, `locations`, `extensions.code` and every other extension except `stacktrace` MUST stay as they are today, whatever the setting. Acknowledged exception: if `formatError` itself throws, Apollo's fallback (`errorNormalize.js`) returns the formatting error's message and stack when the option is on, and `Internal server error` with code `INTERNAL_SERVER_ERROR` when it is off. That branch is Apollo's, and this slice does not change it.
6. No new environment variable is introduced.
7. GraphiQL registration, Swagger mounting and SQL logging MUST NOT change behavior. Setting `APP_DEBUG=true` keeps turning on SQL logging as well; that coupling is intended (§6).
8. `NODE_ENV` for this rule MUST be read through the same `ConfigService` read as `APP_DEBUG` (invariant 4). The production override then holds whether `NODE_ENV` comes from the process environment or from `apps/api/.env`, independent of module import order. GraphiQL's existing import-time read is unchanged (out of scope).

## 6. Rationale

- **Reuse `APP_DEBUG` (owner decision, 2026-11-26).** `APP_DEBUG` already expresses the operator's intent to debug, and `.env.example` already says later debug channels can use it. A separate `GRAPHQL_INCLUDE_STACKTRACE` would add a variable for the same intent. The cost is that one switch now turns on both SQL logging and stack traces. Those are acceptable together for local debugging.
- **Production overrides the opt-in (owner decision, 2026-11-26).** A stray or inherited `APP_DEBUG=true` must not expose file paths and call stacks to clients in production. Production never includes stack traces, which is acceptance criterion 2 of #236 in its stronger reading.
- **Off by default everywhere else.** #236's risk is any non-production `NODE_ENV`, set by default or by mistake. Making the opt-in explicit removes the dependence on `NODE_ENV` being set correctly.
- **`includeStacktraceInErrorResponses`, not a custom `formatError`.** It is Apollo's own switch and controls only the stack trace. A `formatError` would add a second transform beside `@nestjs/apollo`'s HTTP-exception wrapper and risk invariant 5.

## 7. Verification requirements

These are product acceptance requirements for the implementation, from #236:

1. With `APP_DEBUG` **unset** (not only set to `false`), a GraphQL error response has no `extensions.stacktrace`, under `NODE_ENV=development` and under `NODE_ENV` unset. These are values where Apollo's own default would include a stack trace, so the test fails on unfixed `main`. A test only under `NODE_ENV=test` does not satisfy this requirement (§1.1).
2. With `NODE_ENV=production`, no stack trace, both with `APP_DEBUG` unset and with `APP_DEBUG=true`. The `APP_DEBUG=true` case MUST be tested explicitly, against an actual GraphQL response body for an `HttpException`-derived error, which `@nestjs/apollo`'s HTTP-exception transform actually rewrites, not only against the computed option.
3. With `APP_DEBUG=true` and `NODE_ENV=development`, the response includes `extensions.stacktrace`. With `APP_DEBUG=true` and `NODE_ENV=test` it also does (a change from today, intended by §4).
4. For existing errors, the response is the same with and without stack traces apart from `extensions.stacktrace`: `message`, `path`, `locations`, and every extension, including `code`, `status` and `originalError`. At least one error MUST come from an `HttpException` that the transform maps to a predefined code (for example the `BAD_REQUEST` from #209). At least one MUST be an HTTP status the transform does not predefine (it predefines only 400, 401, 403 and 422), so `extensions.status` is present; for example a `NotFoundException` (404) or `ConflictException` (409) that resolvers already throw.
5. Requirements 1–3 MUST be checked on actual GraphQL response bodies. The existing unit and e2e suites keep passing.
6. Each test that sets `NODE_ENV` or `APP_DEBUG` MUST restore their previous values (including "unset") afterwards, so test order cannot change results. Tests MUST NOT depend on the contents of a developer's `apps/api/.env`, which loading `AppConfigModule` writes into `process.env`.
7. `NODE_ENV=Production` (or with surrounding whitespace) together with `APP_DEBUG=true` returns no stack trace.
8. `local-development.md` and `.env.example` document that `APP_DEBUG=true` also adds stack traces to GraphQL error responses, and that production ignores it. For the Compose stack, they point operators at the root `.env`, as the existing SQL-logging instruction does.

How tests are structured beyond these requirements (unit versus e2e, module isolation, where the rule lives) is left to M4.

## 8. Acceptance criteria for this specification

This specification may move from Draft to Accepted after M3 when the reviewer agrees that:

1. §4's rule and §5's invariants fully decide the setting for every `NODE_ENV` and `APP_DEBUG` combination.
2. The two owner decisions in §6 are recorded correctly.
3. The scope matches #236 and keeps its out-of-scope items out.
4. §7 covers each of #236's acceptance criteria 1–5.
5. §10 Q1 is decided, and §3 and §7 requirement 7 are adjusted to the decision. (Met: M3 round 2.)

## 9. Explicit deferrals

- Masking messages of unexpected (non-HTTP) errors in responses.
- Giving GraphiQL and Swagger an explicit opt-in instead of `NODE_ENV`.
- Splitting `APP_DEBUG` into separate debug channels, if the coupling in invariant 7 becomes a problem.

## 10. Questions for M3 (decided)

- **Q1. How is production matched for the override? Decided, M3 round 2: the fail-safe match (trimmed, lowercased).** The author proposes the fail-safe match (trimmed, lowercased; §3), because a misread can only remove stack traces. M3 round 1 recommends it: exact matches in the API gate exposure (GraphiQL, Swagger); the trimmed, lowercased match guards a safety refusal (dev-owner seed), and this override is a safety suppression. The alternative is the exact match used by GraphiQL and Swagger, for uniformity. The exact match was not chosen; §3 and §7 requirement 7 reflect the decision.
