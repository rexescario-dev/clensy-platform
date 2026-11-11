# E2E Database Isolation & Development Owner Seeder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan, and the pre-M6 branch step (§"Implementation sequence and gates") is done.**

| Field | Value |
| --- | --- |
| Status | **Draft** — M4 revision 3, 2026-11-12. Revision 2 was returned by the independent M5 review (findings M5R2-01 to M5R2-18); revision 3 applies them. Awaiting an independent M5 confirmation. Not Accepted. |
| Date | 2026-11-06 (revision 1); 2026-11-12 (revisions 2 and 3) |
| Tracking issue | [#227](https://github.com/rexescario-dev/clensy-platform/issues/227) "test(api): isolate the e2e database and add a persistent dev TENANT_OWNER seeder" |
| Branch | **Drafting (M4/M5):** `docs/227-e2e-db-isolation-spec`, which carries the Accepted spec and this plan.<br>**Implementation (M6 on):** `feat/227-e2e-db-isolation-dev-owner`, cut from the head of `docs/227-e2e-db-isolation-spec` after M5 Accepts, with `--no-track` (owner decision D-M5-4).<br>**Deviation from `CONTRIBUTING.md` L16:** that rule says "from `main`". The branch is cut from the spec branch instead, so that one PR carries the spec, the plan and the implementation (process spec §2.8, "prefer one PR"). The owner approved this in D-M5-4. |
| Implements (Accepted) | [E2E Database Isolation & Development Owner Seeder](../specs/2026-11-06-e2e-database-isolation-dev-owner-design.md), **revisions 5 to 5c**: content as accepted at SHA-256 `88d56ee8d004acf0995cb353fbd86d5d3e75429b1aab93e5c4d337f326e93b21` (`fb7e602`). Acceptance recorded in `25af071`; the file is now SHA-256 `8885015d…1ea4`. |
| Relies on (Accepted) | [Multi-Tenant Architecture](../specs/2026-09-23-multi-tenant-architecture-design.md): Bootstrap tenant, `TENANT` scope, `CHECK` constraints. Unchanged.<br>[Required CI checks](../specs/2026-10-06-required-ci-checks-design.md): job names **Release gate** and **API e2e** are unchanged. |
| Authority | Where this plan and the Accepted spec disagree, **the spec wins**, and this plan must be revised.<br>**Planning decisions:** file names, helper names, task order and test layout.<br>**Not planning decisions:** output wording that the spec quotes (§4.7 L317–318, L326, L329, L337; §6 L455, L457; line numbers at `25af071`). That wording is spec-bound, and Task 10 pins it. |
| Scope | **`apps/api`:**<br>• `test/` infrastructure and e2e suites;<br>• the pure settings module `src/platform/database/effective-connection-settings.ts`;<br>• seeder files under `src/platform/database/` (`seed-dev-owner.ts`, `dev-owner/**`);<br>• `package.json` scripts.<br>**Elsewhere:** root `package.json` (one alias); `.github/workflows/ci.yml` (two jobs, values only); three docs. |
| Untouched | `docker-compose.yml`, `Dockerfile`, `Dockerfile.web`, `apps/api/src/platform/database/database.module.ts`, `data-source.ts`, `seed.ts`, every migration, all application modules, every `.env` / `.env.example`, `apps/web`, `packages/*`. Also #209 and its plan. |
| Pre-validation | **None.** No code in this plan has been run. Every `Expected:` line is a prediction until M6 records the actual result in the M6 evidence record (Task 13). |
| M7 | `CLAUDE.md` requires a **fresh, independent reviewer on the most capable model**, because this slice changes:<br>• **application code under `src/`:** the seeder and the shared settings module;<br>• **the database:** the seeder writes `admin_user_entity`, and test-database provisioning creates databases.<br>The reviewer gets the Accepted spec, this plan, the branch diff, final-head CI and the M6 evidence record. The M7 record cites that review. |
| Commits | Never add a `Co-Authored-By` trailer or a "Generated with" line (user instruction). |

**Goal:**
- `pnpm --filter api test:e2e` connects only to `_test` databases, locally and in CI.
- No e2e connection can be opened to `clensy`.
- Cross-database statements are limited by source-hygiene scans. They are not prevented (spec §4.3 item 1, §4.10).
- Separately, `pnpm db:seed:dev-owner` creates or verifies one persistent Bootstrap `TENANT_OWNER` and changes nothing else.

**Architecture:**
- **One pure settings module** (Task 1). It defines missing values, effective connection settings, the Test-database rule and the local-host allowlist. The e2e resolver and the seeder both use it.
- **A Jest `setupFiles` module and a `globalSetup`** resolve and publish the E2E target (Tasks 2 and 5). `globalSetup` also provisions it:
  - it creates the database through its single maintenance connection;
  - it then migrates it through the TypeORM CLI, in a child process whose environment is an **explicit allowlist**.
- **A two-stage guard**, patched onto TypeORM's public `DataSource` class in `setupFiles` (Tasks 4 and 7). It covers the Nest application, the helper and scratch connections, with no per-site checks.
- **One static guard test** (Tasks 6, 7, 11). It scans every e2e source file. It holds separate hygiene checks for invariants 2, 4, 6, 10, 13 and 14, and for the Jest registry.
- **The seeder** is split into three layers (Tasks 9–11):
  - a pure configuration and guard layer;
  - a core driven by a `DataSource`;
  - a thin CLI entrypoint.

**Tech Stack:** NestJS 11, TypeORM 1.1.0 (`pg` 8.23, `pg-pool` 3.14), Jest 30.4 and ts-jest 29 (unit config rooted at `src`; e2e config `test/jest-e2e.json`), `dotenv` 17.4, `bcrypt` 6, pnpm 10.30, GitHub Actions, Postgres 16 (`postgres:16-alpine`).

**Spec:** `docs/superpowers/specs/2026-11-06-e2e-database-isolation-dev-owner-design.md`. Executors read the spec in full. Section numbers and line numbers below refer to it at `25af071`.

---

## Global Constraints

These come from the Accepted spec and the owner's decisions. Every task implicitly includes them.

- **Test-database rule:** `^(?=.{6,63}$)[a-z][a-z0-9_]*_test$`. The default E2E target is `clensy_test` (§4.1).
- **Local host allowlist:** exactly `localhost`, `127.0.0.1` and `postgres`, compared case-insensitively against the whole trimmed value. `::1`, suffixes and socket paths are rejected (§4.1, call 4).
- **Missing value:** unset, empty, or whitespace only (§4.1, call 13).
  - For layered connection keys, a missing value falls through to the next source.
  - For the e2e `DB_NAME`, a missing value means the default `clensy_test`.
  - Stage 1 **rejects** a missing `database`.
  - A missing value never reaches the driver.
- **Effective settings (§4.1):**
  - **host:** trimmed, non-empty;
  - **port:** the trimmed value matches `/^[0-9]+$/` and is from 1 to 65535. Leading zeros are accepted (`05432` → 5432). `+5432`, `0x1538`, `1e3`, `5432.0` and `5432abc` are rejected;
  - **username:** trimmed, non-empty;
  - **database:** non-empty, kept verbatim;
  - **password:** kept verbatim, and may be empty.
- **E2E `DB_NAME`** comes from the launch environment only, never from a `.env` file, and is not trimmed. A non-missing value that fails the rule fails the run (§4.2 item 1, invariant 2).
- **E2E connection settings:** `DB_HOST`, `DB_PORT`, `DB_USERNAME` and `DB_PASSWORD` each come from the launch environment, then `apps/api/.env`, then the defaults `localhost`, `5432`, `clensy`, `clensy_dev` (§4.2 item 2).
- **Guard stage 1, before any connection** (§4.5 item 1, invariant 3). Reject unless all of these hold:
  - `type === 'postgres'`;
  - no `url`;
  - no `replication`;
  - no `extra.database`;
  - no `extra.connectionString`;
  - no `extra.Client`;
  - no custom `driver`;
  - `typeof database === 'string'`, non-missing, and passing the Test-database rule.

  **"Not set" means not an own key** (`Object.hasOwn(options, key)` / `Object.hasOwn(options.extra ?? {}, key)`). A present key with value `undefined` or `''` is rejected, because TypeORM's `Object.assign` would still overwrite the validated name.
- **Guard stage 2, after connecting:** `SELECT current_database()` must equal the stage 1 name. Otherwise the guard destroys the `DataSource` and throws. The guard error is the one thrown; a failing `destroy()` is attached as its `cause`.
- **No application-code change** for the guard. `database.module.ts` stays untouched, even to avoid Nest's retries (§4.5 item 1, §7 note a).
- **Maintenance connection (invariant 1, §4.4 item 2).**
  - **Limit:** one per provisioning run, to database `postgres`. It issues only `SELECT 1 FROM pg_database WHERE datname = $1` and, if absent, `CREATE DATABASE` of that run's target. It is then closed.
  - **Where it opens:** only in `globalSetup`, or in a `provision-cli.ts` child process that a §7 `globalSetup` test spawns. **Never inside a Jest test environment.**
  - **Source-import rule (not a runtime rule):**
    - Among the scanned e2e source files (Task 6), only `test/support/provision-test-database.ts` imports `pg` or any `pg-*` package, by static `import`, dynamic `import()` or `require`.
    - No `*.e2e-spec.ts` file reaches `provision-test-database.ts` through the import graph of the scanned files.
    - The entrypoints that do reach it, `global-setup.ts` and `provision-cli.ts`, never run inside a test environment.
    - The rule concerns source imports only. TypeORM's Postgres driver loads `pg` at run time in every test environment, and that is expected.
    - Anything that needs `pg` itself, such as the `pg.native` pin, runs in a child process.
- **Invariant 4: database DDL in e2e code.** The invariant applies to **all e2e code**, whatever the scans cover.
  - Scratch `CREATE DATABASE` and `DROP DATABASE` run only through `ScratchDatabases` in `test/support/e2e-connection.ts`, on names that instance generated, that pass the rule and that differ from the E2E target.
  - Scratch names are `clensy_migration_<32 lowercase hex>_test`.
  - **The one exception:** the provisioning routine's `CREATE DATABASE` of its run's target, in `test/support/provision-test-database.ts`. There is no `DROP` there and no other name (§4.5 item 2, invariant 4).
  - **E2e code MUST NOT issue `ALTER DATABASE`** against any database.
- **Invariant 13:** e2e code MUST NOT call `pg_terminate_backend` or `pg_cancel_backend`.
- **Invariant 14:** e2e code MUST NOT reference `dblink` or `postgres_fdw`. Other extensions are not restricted: the migration suites' `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` stays permitted.
- **The checks are hygiene, not boundaries.** Every static check in this plan is **source hygiene, not a security boundary** (spec §4.10). Each says so in its `describe` title or a comment.
- **Searched-for strings (spec §7 L512; obligation N1).**
  - In every file under `apps/api/test/`, never write these strings literally: `CREATE DATABASE`, `DROP DATABASE`, `ALTER DATABASE`, `createDatabase(`, `dropDatabase(`, `dblink`, `postgres_fdw`, `pg_terminate_backend`, `pg_cancel_backend`, `createdb`, `dropdb`.
  - The exception is the permitted statements in their permitted locations.
  - Build every such string from fragments, for example `['DROP', 'DATABASE'].join(' ')` or `` `${'pg_term'}inate_backend` ``. This applies to the static guard test itself, to tests that assert on captured SQL, and to statement traces.
- **Activity queries:** each query over `pg_stat_activity` or `pg_locks`, taken as a whole, restricts what it observes to sessions of `current_database()` (§4.3 item 6, invariant 6).
- **Migration child environment (owner decision on Q4: allowlist).** `migrationCliEnv(target, parentEnv)` builds the CLI child's environment **from nothing**.
  - **Required, always set:** `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` (from the target) and `PATH`.
  - **Passed through only if present in the parent:** `HOME`, `TMPDIR`, `LANG`, `LC_ALL`, `CI`, `PNPM_HOME`, `COREPACK_HOME`.
  - **Optional portability variables, passed through only if present:** `XDG_CACHE_HOME` and `XDG_CONFIG_HOME`. Corepack finds its cache through `COREPACK_HOME`, then `XDG_CACHE_HOME`, then `HOME/.cache`, so a developer who sets `XDG_CACHE_HOME` needs it passed through (finding M5R2-16).
  - **Never passed, among everything else:** `DOTENV_CONFIG_*`, `NODE_OPTIONS`, `NODE_PATH`, `TS_NODE_*`, `PG*`, `DATABASE_URL`, `npm_*`, `npm_config_*`, `JEST_*`.
  - **Missing `PATH`:** the builder throws `ProvisionError` if the parent has no `PATH`.
  - **Why `TS_NODE_PROJECT` can be dropped:** the `typeorm` script sets `TS_NODE_PROJECT=tsconfig.cli.json` inline.
  - **Rule:** the parent environment is never spread into the child.
- **Seeder guards, in order (§4.7):**
  1. `NODE_ENV` (trimmed, lowercased) equals `production`;
  2. `ADMIN_SEED_EMAIL` or `ADMIN_SEED_PASSWORD` is missing;
  3. invalid effective settings;
  4. the host is not on the allowlist;
  5. the database passes the Test-database rule;
  6. the Bootstrap tenant is missing (checked after connecting).
- **Seeder writes (invariants 7 and 8, §4.7).**
  - **When no row matches:** exactly one `INSERT` into `admin_user_entity` (`created`).
  - **When a correct row matches and `--reset-password` is given:** one `UPDATE` of `"passwordHash"` only.
  - **No write in any other case:** a mismatch, an un-normalised match, an ambiguous match, a missing tenant, a refusal, or a lost insert race.
  - **Other limits:** no other table and no other row is written, and no audit event is written. Everything runs in one transaction.
  - **Lookup:** `toLowerCase()` with no trim, matched by `lower(email) = $1 … FOR UPDATE`. bcrypt cost 10.
- **Seeder output (§4.7, invariant 9, call 12):**
  - it states the outcome, id, database, host, and the source of each `ADMIN_SEED_*` value;
  - it never contains an email, password, hash or salt. On error it shows the error **message** only, never `parameters`, `detail` or a stack.
- **Never automatic:** no startup, build, install, test or CI path references either seeder (invariant 10). The inventory is in Task 11.
- **Unchanged:** `pnpm db:seed` behaviour (invariant 11), and the CI job `name:` values (invariant 12).
- **Snapshot (§4.5 item 4, D-M5-6).**
  - The snapshot is **evidence of no observed change**: detection at two moments. It is not proof that nothing changed between them, and it prevents nothing.
  - No whole-database digest is added (owner decision).
- **No push without separate authorisation (D-M5-5).** Task 13 ends at push readiness. Every push names an explicit refspec. A bare `git push` is never used: this branch's configured upstream is `origin/main`.

## Review Focus

These are failure modes the spec implies but that no other test would catch. Each names the task whose test pins it.

1. **A test file defeats the guard's module registry**, through `jest.resetModules`, `isolateModules`, a factory mock of `typeorm`/`@nestjs/typeorm`/`pg`, `require('module')`, or `resetModules` in the config or scripts.
   - **Expected:** the static guard test forbids each form (Task 7, Step 1).
2. **`ADMIN_SEED_EMAIL` contains capitals** (`Owner@Example.com`).
   - **Expected:** it is lowercased at configuration time (Task 9). It is stored and matched as `owner@example.com`, with no duplicate row (Task 10). The email never appears in output (Tasks 10 and 11).
3. **A second e2e run reuses an already-migrated `clensy_test`.**
   - **Expected:** `globalSetup` creates nothing, applies 0 migrations and confirms none pending. The proof is a statement trace and unchanged identity, not a self-report (Task 5, Step 1).
4. **The launch environment's `DB_NAME` has trailing whitespace** (`'clensy_test '`), from a shell export or a CI variable.
   - **Expected:** the resolver rejects it. The name is not missing, and it fails the rule (Task 2, Step 1).
5. **The seeder runs from a directory other than `apps/api`** (direct `node` invocation).
   - **Expected:**
     - the `.env` comes from the working directory;
     - the same guards apply;
     - no connection opens on refusal.
   - **Limit:** the source label `apps/api/.env` is accurate only for the supported invocations. Task 12 documents this (Task 11, Step 1).

---

## File structure

| Path | Responsibility | Task |
| --- | --- | --- |
| `apps/api/src/platform/database/effective-connection-settings.ts` (new) | Pure helpers:<br>• rule constants;<br>• `isMissing`;<br>• layered resolution with a source per value;<br>• validation;<br>• `parseEnvFile`.<br>Imports only Node built-ins and `dotenv` (`parse` only). | 1 |
| `apps/api/src/platform/database/tests/effective-connection-settings.spec.ts` (new) | Unit tests for Task 1, plus a static purity pin. | 1 |
| `apps/api/test/support/e2e-target.ts` (new) | `resolveE2eTarget`, `publishE2eTarget`, `readApiEnvFile`, `E2eTargetError`. | 2 |
| `apps/api/test/e2e-target.e2e-spec.ts` (new) | Resolver tests (pure). | 2 |
| `apps/api/test/support/e2e-connection.ts` (new) | `e2eTarget`, `e2eConnectionOptions`, `ScratchDatabases`, `withE2eEnv`. | 3 |
| `apps/api/test/e2e-connection.e2e-spec.ts` (new) | Helper tests (stub admin). | 3 |
| `apps/api/test/support/counting-listener.ts` (new) | `startCountingListener()` → `{ host, port, count(), close() }`. | 4 |
| `apps/api/test/support/datasource-guard.ts` (new) | `assertSafeDataSourceOptions`, `assertConnectedDatabase`, `installDataSourceGuard`, `UnsafeDataSourceError`, `GUARD_MARKER`. | 4 |
| `apps/api/test/datasource-guard.e2e-spec.ts` (new) | Guard tests: stage 1 (zero connections), stage 2, idempotence, `pg.native` pin; then the Task 7 coverage cases. | 4, 7 |
| `.github/workflows/ci.yml` (modify) | `clensy_test` in **Release gate** and **API e2e**. The `migration:run` steps are kept. | 8 (runs before 5) |
| `apps/api/test/support/provision-error.ts` (new, **no `pg` import**) | `ProvisionError`. | 5 |
| `apps/api/test/support/migration-files.ts` (new, **no `pg` import**) | `migrationFileTimestamps`, `migrationNamesFromFiles`, `findPendingMigrations`, `readAppliedMigrations` (over a minimal `QueryClient` interface), `migrationCliEnv`, `MIGRATION_CHILD_ENV_PASSTHROUGH`, `apiRoot`, `QueryClient`. | 5 |
| `apps/api/test/support/provision-test-database.ts` (new, the **only** `pg` importer under `test/`) | `provisionTestDatabase`, `runMigrationCli`, `MigrationRunner`, `ProvisionResult`. | 5 |
| `apps/api/test/support/provision-cli.ts` (new) | Child entrypoint for the `globalSetup` tests. Supports the test-only `--skip-migrations` flag. | 5 |
| `apps/api/test/setup-e2e-env.ts` (new) | `setupFiles` module: resolve, publish, then install the guard (Task 7). | 5, 7 |
| `apps/api/test/global-setup.ts` (new) | Jest `globalSetup`: resolve, publish, provision. | 5 |
| `apps/api/test/jest-e2e.json` (modify) | Add `setupFiles` and `globalSetup`. | 5 |
| `apps/api/test/e2e-isolation.e2e-spec.ts` (new) | Ordering, `PG*` non-redirection, fail-closed child run, `globalSetup` child runs, the child environment. | 5 |
| `apps/api/test/migration-files.e2e-spec.ts` (new) | Migration file, class and `name` equivalence and uniqueness (characterization). | 5 |
| 20 e2e specs plus `test/helpers/migration-db.ts` (modify, **21 files**) | Switch to `e2eConnectionOptions`, `ScratchDatabases` and `withE2eEnv`. The list is in Task 6. | 6 |
| `apps/api/test/catalog.service.e2e-spec.ts` (one of the 21) | Also scope the unscoped `pg_stat_activity` query at L614–618 (invariant 6; existing defect). | 6 |
| `apps/api/test/support/static-scan.ts` (new) | `listE2eSourceFiles()` and the fragment-built pattern table. | 6 |
| `apps/api/test/e2e-static-guards.e2e-spec.ts` (new) | All static checks (see Task 6 for the scope and checks). | 6, 7, 11 |
| `apps/api/src/platform/database/dev-owner/dev-owner-config.ts` (new) | Argument parsing; guards 1–5; source tracking. | 9 |
| `apps/api/src/platform/database/tests/dev-owner-config.spec.ts` (new) | Unit tests for Task 9. | 9 |
| `apps/api/src/platform/database/dev-owner/dev-owner-seeder.ts` (new) | `seedDevOwner` (guard 6, lookup, outcomes), `formatDevOwnerResult`, `isFailure`. | 10 |
| `apps/api/src/platform/database/tests/dev-owner-output.spec.ts` (new) | Output-format unit tests, with the spec-quoted strings pinned. | 10 |
| `apps/api/test/seed-dev-owner.e2e-spec.ts` (new) | Core tests against the Test database. | 10 |
| `apps/api/src/platform/database/dev-owner/dev-owner-datasource.ts` (new) | `devOwnerDataSourceOptions(settings)`, a pure function. | 11 |
| `apps/api/src/platform/database/seed-dev-owner.ts` (new) | CLI entrypoint (the path the spec names). | 11 |
| `apps/api/src/platform/database/tests/dev-owner-datasource.spec.ts` (new) | Exact-key options test. | 11 |
| `apps/api/test/seed-dev-owner-cli.e2e-spec.ts` (new) | Entrypoint child-process tests: guard exits, no connection. | 11 |
| `apps/api/package.json`, `package.json` (modify) | `db:seed:dev-owner` scripts. | 11 |
| `docs/getting-started/local-development.md`, `docs/development/testing-and-ci.md`, `apps/api/README.md` (modify) | §4.8 content, including every §4.10 risk. | 12 |
| This plan (append) | The "M6 evidence" section (Task 13). | 13 |

**Planning decision: the shared settings module lives in `src/`.**
- **Why:** the seeder (in `src/`) and the e2e resolver (in `test/`) both need its rules, and one copy prevents drift between them.
- **Purity:** it imports no application module, entity or TypeORM, and reads no environment when it loads, which satisfies §4.2. Task 1 pins this with a static check.

---

## Resolved planning questions

**Migration-loading path (§4.4 item 3, note b): the TypeORM CLI in a child process.**
- **How:** `globalSetup` runs `pnpm run migration:run` with `cwd` = `apiRoot` (`apps/api`), and `env = migrationCliEnv(target, process.env)` (see the allowlist in Global Constraints).
- **Why:**
  - It is the same path as Compose `migrate` and the CI step (§3 item 14). It applies exactly `src/platform/database/migrations/*.ts` through `data-source.ts`.
  - `data-source.ts` imports `dotenv/config`, which never overrides an existing variable unless `DOTENV_CONFIG_OVERRIDE` is set. The allowlist drops `DOTENV_CONFIG_*`, so `apps/api/.env` (`DB_NAME=clensy`) cannot redirect the child. This closes blocker B-02.
  - On a fresh database, the CLI's own `DataSource.initialize()` installs `uuid-ossp`, which the migrations need.
- **"None pending":**
  - TypeORM decides "pending" by migration **name**. The timestamp is the last 13 characters of the name.
  - `findPendingMigrations` compares the file-derived **names** (`<ClassName><13-digit timestamp>`) with `SELECT name FROM migrations`.
  - Task 5's characterization test pins the file, class and `name` equivalence.
- **Proof:** Task 5's child-process `globalSetup` tests.

**`nativeDriver` (M3 confirmation note): not rejected; a test pins the evidence.**
- **Evidence:** `pg-native` is not installed, and TypeORM switches to it only when `pg.native` is non-null (`PostgresDriver.js:1348–1350`). A name that passes the rule cannot be read as a libpq connection string.
- **Why not reject it:** that would extend the Accepted stage 1 contract.
- **Pin:** Task 4 asserts, in a child process, that `require('pg').native === null`. If that ever fails, this decision returns to **M2, then M3**, as a spec amendment.

**Running the seeder against `clensy`** is not part of M6.
- The owner seeds the development owner after the merge, following the owner check in §"Implementation sequence and gates".
- The seeder's success path is proven against the Test database through the core (Task 10). The CLI is proven only for its refusal paths (Task 11).
- **Accepted limit (R-73):** the entrypoint's first successful run is the owner's post-merge run against `clensy`. Task 11 pins its options and import graph instead.

---

## Slice A: E2E database isolation (Tasks 1–8)

**Prerequisite from Task 5 on:** a reachable local Postgres (the Compose `postgres` service) whose role has `CREATEDB`. Every e2e invocation runs `globalSetup`, so every e2e run needs the server from then on, including "pure" files.

### Task 1: Effective connection settings and the Test-database rule (`code`)

Spec §4.1, §4.2 items 2–3, §4.7 (shared rules), call 13.

**Files:**
- Create: `apps/api/src/platform/database/effective-connection-settings.ts`
- Test: `apps/api/src/platform/database/tests/effective-connection-settings.spec.ts`

**Interfaces:**
- Produces:
  - `export const TEST_DATABASE_NAME_PATTERN = /^(?=.{6,63}$)[a-z][a-z0-9_]*_test$/;`
  - `export const LOCAL_HOST_ALLOWLIST: readonly string[] = ['localhost', '127.0.0.1', 'postgres'];`
  - `export type EnvSource = Readonly<Record<string, string | undefined>>;`
  - `export type ValueSource = 'launch environment' | 'apps/api/.env' | 'default';`
  - `export interface EffectiveConnectionSettings { host: string; port: number; username: string; password: string; database: string }`
  - `export function isMissing(value: string | undefined): boolean`
  - `export function resolveLayered(key: string, layers: readonly [EnvSource, EnvSource], fallback: string | undefined): { value: string | undefined; source: ValueSource }`
  - `export function isTestDatabaseName(name: string): boolean`
  - `export function isLocalHost(host: string): boolean`
  - `export function validateEffectiveSettings(input: { host?: string; port?: string; username?: string; password?: string; database?: string }): EffectiveConnectionSettings`
    - trims host and username;
    - keeps database and password verbatim;
    - parses port per Global Constraints;
    - throws `InvalidConnectionSettingsError` naming the key, never a value.
  - `export class InvalidConnectionSettingsError extends Error`
  - `export function parseEnvFile(path: string): EnvSource`
    - returns `dotenv.parse` of the file;
    - `{}` on `ENOENT`;
    - any other read error throws;
    - never touches `process.env`.

- [ ] **Step 1: Write the failing tests**
  - **`isMissing`:** `undefined`, `''`, `'   '`, `'\t'` and `'\n'` → `true`; `'a'` → `false`.
  - **`isTestDatabaseName`:**
    - **accepts:** `clensy_test`, `a_test`, `feature_x_test`, a 63-byte name ending in `_test`, and `clensy_migration_` + 32 hex + `_test` (54 bytes);
    - **rejects:** `clensy`, `clensy_test2`, `Clensy_test`, `clensy-test`, `_test`, `' clensy_test'`, `'clensy_test '`, `'clensy_test\n'`, `'clensy _test'`, `clensy"_test`, `clensy'_test`, `clénsy_test`, and a 64-byte name.
  - **`isLocalHost`:**
    - **accepts:** `localhost`, `LOCALHOST`, `' localhost '`, `127.0.0.1` and `postgres`;
    - **rejects:** `localhost.example.com`, `127.0.0.2`, `::1`, `/var/run/postgresql` and `''`.
  - **`resolveLayered`:** a table over every key × layer × form (unset, `''`, `'  '`, a value). For example:
    - launch `'  '`, file `'db'` → `{ value: 'db', source: 'apps/api/.env' }`;
    - both missing → `{ value: fallback, source: 'default' }`;
    - launch `'x'` → `'launch environment'`.
  - **`validateEffectiveSettings`:**
    - **ports** `'abc'`, `'0'`, `'65536'`, `'5432.5'`, `'5432.0'`, `'-1'`, `'+5432'`, `'0x1538'`, `'1e3'` and `'5432abc'` throw;
    - `'5432'`, `' 5432 '` and `'05432'` give `5432`;
    - an empty host, username or database throws;
    - `' host '` → `'host'`;
    - password `' pw '` is kept verbatim;
    - an empty password is allowed;
    - with a sentinel password, **no** thrown message contains it, in every throwing case.
  - **`parseEnvFile`:**
    - a missing path gives `{}`;
    - a directory path throws;
    - a file with `A=1` gives `{ A: '1' }`;
    - `process.env.A` is unchanged after every case.
  - **Purity pin (characterization).** The module's source imports only `node:*`, `fs`, `path` and `dotenv`. It has no top-level `process.env` read.
    - **Break, outside the commit:** add a top-level `process.env.X` read and expect this test to fail.
- [ ] **Step 2: Run it to verify it fails.** Run `pnpm --filter api test effective-connection-settings`. Expected: FAIL ("Cannot find module").
- [ ] **Step 3: Implement the module** with the signatures above. No top-level side effects.
- [ ] **Step 4: Run it to verify it passes.** Same command. Expected: PASS. Run the purity break, and record it in the M6 evidence record.
- [ ] **Step 5: Commit** `test(api): add effective connection settings and the Test-database rule (#227)`

### Task 2: E2E target resolver (`code`)

Spec §4.2 items 1–5, §6 (e2e table).

**Files:**
- Create: `apps/api/test/support/e2e-target.ts`
- Test: `apps/api/test/e2e-target.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - **`export function readApiEnvFile(): EnvSource`:** `parseEnvFile(resolve(__dirname, '../../.env'))`, which is `apps/api/.env`, located from the test tree, not from `cwd`.
  - **`export function resolveE2eTarget(launchEnv: EnvSource, envFile: EnvSource): EffectiveConnectionSettings`.** In this order:
    1. **`DB_NAME`** comes from `launchEnv` only. Missing → `clensy_test`. Otherwise it must pass `isTestDatabaseName` unchanged (not trimmed).
    2. **The other keys** come through `resolveLayered`, with the §4.2 defaults.
    3. **Validation:** `validateEffectiveSettings`.
    4. **Host:** `isLocalHost`.

    Every failure throws `E2eTargetError`, which carries the original error as `cause` where there is one. The `DB_NAME` failure message names the value (JSON-quoted) and the rule. No message contains the password.
  - **`export function publishE2eTarget(target: EffectiveConnectionSettings, env: NodeJS.ProcessEnv = process.env): void`:** writes the validated values:
    - `DB_HOST` (trimmed);
    - `DB_PORT` (as a decimal string);
    - `DB_USERNAME` (trimmed);
    - `DB_PASSWORD` and `DB_NAME` (verbatim).
  - **`export class E2eTargetError extends Error`**

- [ ] **Step 1: Write the failing tests.** These are pure; none connects.
  - **Every e2e row of spec §6, one test per row, with the spec's exact inputs:**
    - no `DB_NAME`, file `DB_NAME=clensy` → `clensy_test`;
    - `'   '` → `clensy_test`;
    - `''` → `clensy_test`;
    - `clensy` → throws;
    - `feature_x_test` → `feature_x_test`;
    - a 70-character `…_test` → throws;
    - `DB_HOST=db.example.com` → throws, and so do `localhost.example.com`, `127.0.0.2` and `::1`;
    - `DB_PORT=abc` → throws;
    - launch `DB_HOST=''` with `PGHOST` set in `launchEnv` and file `DB_HOST=localhost` → host `localhost`;
    - `PGDATABASE=clensy` with no `DB_NAME` → `clensy_test`;
    - CI env `DB_NAME=clensy_test` with an empty file → `clensy_test`.
  - **Rejected names:** `'clensy_test '` (Review Focus 4), `'clensy_test\n'`, `'clensy _test'` and `clensy"_test` all throw `E2eTargetError`. The message contains the JSON-quoted value and the rule text.
  - **File `DB_NAME` is ignored:** with launch `DB_NAME` missing, a file value of `feature_test` still gives `clensy_test`.
  - **Precedence for each of `DB_HOST`, `DB_PORT`, `DB_USERNAME` and `DB_PASSWORD`:** launch beats file, file beats default, and a missing launch value falls through.
  - **`publishE2eTarget`:** writes exactly the five keys into a supplied object, with the values described above (host and username trimmed; password and name verbatim).
  - **Settings and host failures:** both throw `E2eTargetError` with `cause` set. With a sentinel password, no message contains it.
- [ ] **Step 2: Run it to verify it fails.** Run `pnpm --filter api test:e2e e2e-target.e2e-spec`. Expected: FAIL ("Cannot find module"). No database is touched: `globalSetup` does not exist yet.
- [ ] **Step 3: Implement** the signatures above.
- [ ] **Step 4: Run it to verify it passes.** Same command. Expected: PASS.
- [ ] **Step 5: Commit** `test(api): resolve the e2e target from the launch environment (#227)`

### Task 3: Connection helper, scratch databases and `withE2eEnv` (`code`)

Spec §4.2 ("Single connection helper"), §4.5 item 2, invariants 4 and 5.

**Files:**
- Create: `apps/api/test/support/e2e-connection.ts`
- Test: `apps/api/test/e2e-connection.e2e-spec.ts`

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces:
  - **`export function e2eTarget(): EffectiveConnectionSettings`:**
    - reads the **published** `process.env.DB_*`;
    - runs them through `validateEffectiveSettings`, so host, port and username are validated and no `PG*` fallback is possible;
    - requires `DB_NAME` to pass the rule;
    - applies no defaults: missing values mean setup did not run, so it throws.
  - **`export function e2eConnectionOptions(database?: string): PostgresConnectionOptions`:**
    - returns `{ type: 'postgres', host, port, username, password, database: database ?? e2eTarget().database }`;
    - throws if a given `database` fails `isTestDatabaseName`.
  - **`export class ScratchDatabases`:**
    - `generate(): string` returns `clensy_migration_${32 lowercase hex}_test` and records it;
    - `create(admin: DataSource, name: string): Promise<void>`;
    - `drop(admin: DataSource, name: string): Promise<void>` issues `DROP DATABASE IF EXISTS`;
    - both quote the name as an identifier;
    - both throw **before any statement** unless the name came from this instance's `generate()`, passes the rule, and differs from `e2eTarget().database`. Each branch has its own message: `not generated by this registry`, `fails the Test-database rule`, `is the E2E target`;
    - the SQL keywords are assembled from fragments (Global Constraints).
  - **`export async function withE2eEnv<T>(overrides: Readonly<Record<string, string | undefined>>, fn: () => Promise<T> | T): Promise<T>`:**
    - snapshots each overridden key's own-property presence and value;
    - applies the overrides; an `undefined` value **deletes** the key (Jest would turn an assigned `undefined` into the string `"undefined"`);
    - awaits `fn`;
    - restores in `finally`, deleting keys that were absent before.

    This is the only place outside `e2e-target.ts` that may write `process.env.DB_*`. Tasks 5, 7, 10 and 11 use it.

- [ ] **Step 1: Write the failing tests**
  - **`generate()`:** matches `^clensy_migration_[0-9a-f]{32}_test$` and is 54 bytes long. Two calls differ.
  - **`create` and `drop` refuse, issuing nothing,** for each of these:
    - a name not generated by this instance;
    - the E2E target. No spy is used: `generate` must still record the name. Generate a name, then publish that same name as the target with `withE2eEnv({ DB_NAME: name }, …)`. The name is recorded and passes the rule, so only the "differs from the target" branch can refuse. Assert the error says the name `is the E2E target`;
    - `clensy`;
    - a `generate()` result from a **different** instance.

    The `admin` is a stub whose `query` records calls; assert zero calls. Each case also asserts its branch-specific message.
  - **Positive:** for a name this instance generated, `create` issues exactly one statement and `drop` exactly one. Each contains the quoted name. The test assembles the expected keywords from fragments (N1).
  - **`e2eConnectionOptions`:** `e2eConnectionOptions('clensy')` throws; `e2eConnectionOptions()` returns the published target.
  - **`e2eTarget()` throws** when, under `withE2eEnv`:
    - `DB_NAME` is unset;
    - `DB_PORT` is `'abc'`;
    - `DB_HOST` is `''`.
  - **`withE2eEnv`:**
    - an unset key stays unset after the call, and is never the string `"undefined"`;
    - an existing key is restored after `fn` throws;
    - an `undefined` override deletes the key inside `fn`.
- [ ] **Step 2: Run it to verify it fails.** Run `pnpm --filter api test:e2e e2e-connection.e2e-spec`. Expected: FAIL ("Cannot find module").
  - **Until Task 5 adds `setupFiles`:** this file publishes the target itself in `beforeAll`, with `publishE2eTarget(resolveE2eTarget(process.env, readApiEnvFile()))`. Task 5, Step 3 deletes that call.
  - **No database is needed:** `admin` is a stub.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run it to verify it passes.** Same command. Expected: PASS.
- [ ] **Step 5: Commit** `test(api): add the e2e connection helper, scratch registry and withE2eEnv (#227)`

### Task 4: Two-stage DataSource guard, standalone (`code`)

Spec §4.5 item 1, invariant 3, §7 (stage 1, stage 2, pass), the M3 `nativeDriver` note.

**Files:**
- Create: `apps/api/test/support/counting-listener.ts`, `apps/api/test/support/datasource-guard.ts`
- Test: `apps/api/test/datasource-guard.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 1 (`isMissing`, `isTestDatabaseName`).
- **No database needed.** The stage 2 integration, pass and coverage cases, which do need one, are in Task 7.
- Produces:
  - **`counting-listener.ts`:** `export async function startCountingListener(): Promise<{ host: '127.0.0.1'; port: number; count(): number; close(): Promise<void> }>`.
    - It wraps `net.createServer` on `127.0.0.1:0`;
    - each accepted socket increments the count and is destroyed at once.
    - Tasks 5, 7 and 11 use it.
  - **`export function assertSafeDataSourceOptions(options: DataSourceOptions): string`:** returns the validated name, or throws `UnsafeDataSourceError` naming the failed condition. It checks, in this order:
    1. `type === 'postgres'`;
    2. `url` is not an own key;
    3. `replication` is not an own key;
    4. `extra` has no own `database`;
    5. `extra` has no own `connectionString`;
    6. `extra` has no own `Client`;
    7. `driver` is not an own key;
    8. `database` is a string, non-missing, and passes `isTestDatabaseName`.
  - **`export function assertConnectedDatabase(expected: string, actual: unknown): void`:** throws `UnsafeDataSourceError` unless `actual === expected`.
  - **`export const GUARD_MARKER = Symbol.for('clensy.e2eDataSourceGuard');`**
  - **`export function installDataSourceGuard(DataSourceClass: { prototype: DataSource } = DataSource): void`:** idempotent. If the prototype has `GUARD_MARKER`, it does nothing. Otherwise it replaces `prototype.initialize` with a wrapper and sets the marker. The wrapper:
    1. calls `assertSafeDataSourceOptions(this.options)` **before** the original;
    2. awaits the original;
    3. runs `SELECT current_database() AS name` through `this.query`;
    4. calls `assertConnectedDatabase`;
    5. on failure, tries `await this.destroy()` and rethrows the **guard** error, attaching a `destroy()` failure as `cause`;
    6. returns `this`.
  - **`export class UnsafeDataSourceError extends Error`**

- [ ] **Step 1: Write the failing tests.** The file calls `installDataSourceGuard()` itself in `beforeAll`. From Task 7, `setupFiles` does this instead.
  - **Zero-connection harness:** `startCountingListener()`. Every stage 1 case targets the listener, and asserts that `initialize()` rejects with `UnsafeDataSourceError` **and** that `count()` is `0`.
  - **Stage 1 cases**, each a `new DataSource({...})` pointed at the listener:
    - `database: 'postgres'`;
    - `database: 'clensy'`;
    - `database: undefined`;
    - `database: '  '`;
    - `database: 42`;
    - `type: 'cockroachdb'` with a valid name. TypeORM's CockroachDB driver loads the installed `pg`, so the constructor succeeds and the guard is what rejects. The `mysql` driver is not installed, so a `mysql` case would throw `DriverPackageNotInstalledError` in the constructor instead (finding R-25);
    - `url: 'postgres://u:p@127.0.0.1:<listenerPort>/clensy_test'`;
    - `replication: { master: { ...listener, database: 'clensy_test' }, slaves: [] }`;
    - `database: 'clensy_test', extra: { database: 'clensy' }`;
    - `extra: { database: '' }`;
    - `extra: { database: undefined }`;
    - `extra: { connectionString: 'postgres://u:p@127.0.0.1:<listenerPort>/clensy' }`;
    - `extra: { Client: RecordingClientStub }`. The stub is a class whose `connect` increments a counter; assert the counter is `0`;
    - `driver: recordingDriverStub`, a `pg`-shaped object whose `Pool` constructor and `connect` count. Assert `0`.
  - **Stage 2 (pure):**
    - `assertConnectedDatabase('clensy_test', 'clensy')` throws;
    - `('clensy_test', 'clensy_test')` passes;
    - a wrapper whose `destroy` rejects still surfaces `UnsafeDataSourceError`, with the destroy error as `cause`.
  - **`nativeDriver` pin (characterization).** The spec file never imports `pg` itself (source-import rule).
    - **How it runs:** spawn `node -e "process.exit(require('pg').native === null ? 0 : 1)"` with `cwd` = `apps/api` and a 30 s timeout, so that `pg` resolves from `apps/api` as the application's does. Task 4 computes that directory locally, as `resolve(__dirname, '..')`, because `apiRoot` is not produced until Task 5.
    - **Expected:** exit `0`.
    - **Break, outside the commit:** spawn the same child with `-e "Object.defineProperty(require('pg'), 'native', { value: {}, configurable: true }); process.exit(require('pg').native === null ? 0 : 1)"`, expecting exit `1`. The property must be redefined **before** anything reads it: after the first read `pg` replaces its getter with a non-configurable, non-writable `null` (`pg/lib/index.js:66–69`). A fresh child guarantees no prior read.
  - **Idempotence**, on a stub class `class Stub { initialize() {} }`:
    - first, `Stub.prototype[GUARD_MARKER]` is undefined;
    - after the first install it is `true`, and `initialize` is wrapped;
    - after a second install, `initialize` is the **same** function.
  - **Early Nest-path probe (optional, recommended; needs no database).** Under `withE2eEnv({ DB_NAME: 'clensy', DB_HOST: '127.0.0.1', DB_PORT: listenerPort })`, compile `Test.createTestingModule({ imports: [AppConfigModule, DatabaseModule] })`. Expect:
    - a rejection with `UnsafeDataSourceError` in its cause chain;
    - `count() === 0`;
    - a 60 s timeout.

    This surfaces a G6 problem before Tasks 5–6.
- [ ] **Step 2: Run it to verify it fails.** Run `pnpm --filter api test:e2e datasource-guard.e2e-spec`. Expected: FAIL ("Cannot find module").
- [ ] **Step 3: Implement** the signatures above. The wrapper must not open any connection before `assertSafeDataSourceOptions` returns: `new DataSource()` only loads the driver module, and `initialize()` connects (`DataSource.js:137`).
- [ ] **Step 4: Run it to verify it passes.** Same command. Expected:
  - PASS;
  - every stage 1 case has listener count `0` and stub counts `0`;
  - the `cockroachdb` case fails on `type`, not in the constructor.

  Run the `pg.native` break, and record it.
- [ ] **Step 5: Commit** `test(api): add the two-stage e2e DataSource guard (#227)`

### Task 8: CI parity (`code`; **runs before Task 5**)

Spec §4.6, invariant 12.
- **Why it runs early:** from Task 5 on, the resolver rejects CI's current `DB_NAME: clensy`. Making this edit first keeps every later commit's CI meaningful (finding R-63).
- **No configuration task:** the edit touches only an in-repository file. No live setting changes, the required-checks ruleset is untouched, and job names stay the same. So there is no `configuration` task and no Configuration Change section.

**Files:**
- Modify: `.github/workflows/ci.yml`, in the jobs **Release gate** and **API e2e** only:
  - `env.DB_NAME: clensy_test`;
  - `services.postgres.env.POSTGRES_DB: clensy_test`;
  - `--health-cmd "pg_isready -U clensy -d clensy_test"`.

  Keep `- run: pnpm --filter api migration:run` in both jobs, before the e2e command. Leave every `name:` value unchanged.

- [ ] **Step 1: Make the edit.**
- [ ] **Step 2: Verify locally.** Run `git diff .github/workflows/ci.yml`. Expected:
  - exactly six changed values, three per job;
  - both `migration:run` lines present;
  - every `name:` line unchanged;
  - `POSTGRES_USER: clensy` unchanged.
- [ ] **Step 3: Commit** `ci: run the e2e jobs against clensy_test (#227)`.

  There is no CI verification in this task. CI evidence comes from the final-head PR run, after the separately authorised push (Task 13).

### Task 5: Resolve, publish and provision in Jest setup (`code`)

Spec §4.2 (ordering contract), §4.4 items 1–6, invariant 1, §7 (ordering, `PG*`, fail-closed, `globalSetup`). Blockers B-01 and B-02 are resolved here.

**Files:**
- Create:
  - `apps/api/test/setup-e2e-env.ts`
  - `apps/api/test/global-setup.ts`
  - `apps/api/test/support/provision-error.ts`
  - `apps/api/test/support/migration-files.ts`
  - `apps/api/test/support/provision-test-database.ts`
  - `apps/api/test/support/provision-cli.ts`
  - `apps/api/test/e2e-isolation.e2e-spec.ts`
  - `apps/api/test/migration-files.e2e-spec.ts`
- Modify:
  - `apps/api/test/jest-e2e.json`: add `"setupFiles": ["<rootDir>/setup-e2e-env.ts"]` and `"globalSetup": "<rootDir>/global-setup.ts"`;
  - `apps/api/test/e2e-connection.e2e-spec.ts`: delete Task 3's `beforeAll` self-publish.

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces:
  - **`setup-e2e-env.ts`**, at top level: `publishE2eTarget(resolveE2eTarget(process.env, readApiEnvFile()))`. Task 7 adds the guard install. It imports nothing else.
  - **`global-setup.ts`:** `export default async function globalSetup(): Promise<void>`.
    - It resolves the target and publishes it into the parent's `process.env`.
    - It calls `provisionTestDatabase(target)` with **exactly one argument**.
    - It logs `e2e target <db>@<host>:<port>: created=<bool>, applied=<n>, pending=0, unknown=<n>`.
  - **`provision-error.ts`** (imports nothing but Node built-ins; **no `pg`**): `export class ProvisionError extends Error`. It names the step, the database and the host, and never includes the password.
  - **`migration-files.ts`** (pure; imports only `node:*`, `./provision-error`, and the **type** `EffectiveConnectionSettings` from Task 1; **no `pg`, no TypeORM**):
    - `export interface QueryClient { query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }> }` (a `pg.Client` satisfies it);
    - `export async function readAppliedMigrations(client: QueryClient): Promise<string[]>`:
      - `SELECT to_regclass('public.migrations') AS t`;
      - null → `[]`;
      - otherwise `SELECT name FROM migrations ORDER BY id`;
    - `export const apiRoot: string` (= `resolve(__dirname, '../..')`);
    - `export function migrationFileTimestamps(dir?: string): string[]`;
    - `export function migrationNamesFromFiles(dir?: string): string[]`. It reads each `src/platform/database/migrations/*.ts` file as text and returns `<ClassName><timestamp>`;
    - `export function findPendingMigrations(fileNames: readonly string[], appliedNames: readonly string[]): string[]`;
    - `export const MIGRATION_CHILD_ENV_PASSTHROUGH = ['HOME', 'TMPDIR', 'LANG', 'LC_ALL', 'CI', 'PNPM_HOME', 'COREPACK_HOME', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME'] as const;` (the last two are optional portability variables);
    - `export function migrationCliEnv(target: EffectiveConnectionSettings, parentEnv: NodeJS.ProcessEnv): Record<string, string>`. It builds a new object with:
      - the five `DB_*` values from the target;
      - `PATH`, which is required: throw `ProvisionError` if missing;
      - each passthrough key, if present.

      Nothing else.
  - **`provision-test-database.ts`** (the only `pg` importer; imports `ProvisionError` and the `migration-files.ts` helpers):
    - **`export type MigrationRunner = (target: EffectiveConnectionSettings) => Promise<void>`**
    - **`export interface ProvisionResult { created: boolean; applied: number; unknown: number; maintenanceStatements: string[] }`**
    - **`export const runMigrationCli: MigrationRunner`:**
      - `spawn('pnpm', ['run', 'migration:run'], { cwd: apiRoot, env: migrationCliEnv(target, process.env) })`;
      - captures stdout and stderr;
      - a non-zero exit, or a 120 s timeout, throws `ProvisionError` with the last 2 KB of stderr, the password redacted.
    - **`export async function provisionTestDatabase(target: EffectiveConnectionSettings, run: MigrationRunner = runMigrationCli): Promise<ProvisionResult>`.** In order:
      1. a maintenance `pg.Client` to database `postgres`, with the target's credentials. It records each statement text in `maintenanceStatements`;
      2. `SELECT 1 FROM pg_database WHERE datname = $1`;
      3. if absent, `CREATE DATABASE "<target.database>"`, quoted as an identifier (`created = true`). SQLSTATE `42P04` counts as success, with `created = false`. This is the single permitted provisioning `CREATE` (invariant 4);
      4. close the maintenance client;
      5. a second `pg.Client` to `target.database`: `before = readAppliedMigrations`;
      6. `run(target)`;
      7. `after = readAppliedMigrations`; `applied = after.length − before.length`;
      8. `pending = findPendingMigrations(migrationNamesFromFiles(), after)`. If any are pending, throw `ProvisionError` naming the count and the first names;
      9. close the client.

      **Applied rows with no file** (schema ahead or diverged, spec §9 G7) are counted in `ProvisionResult.unknown`, reported in the log line as `unknown=<n>`, and do **not** fail the run, consistent with G7: documented, not detected.
  - **`provision-cli.ts`:**
    - resolves from `process.env` plus `readApiEnvFile()`;
    - parses argv: `[]` or `['--skip-migrations']`, anything else exits 2;
    - calls `provisionTestDatabase(target, skip ? async () => {} : runMigrationCli)`;
    - prints exactly one final line, `PROVISION_RESULT <json>`, on stdout;
    - exits 0 on success and 1 on `ProvisionError`, with the message on stderr.

    It is run as `node -r <apiRoot>/node_modules/ts-node/register -r <apiRoot>/node_modules/tsconfig-paths/register <apiRoot>/test/support/provision-cli.ts`, with `cwd: apiRoot` and `TS_NODE_PROJECT=<apiRoot>/tsconfig.cli.json`.

    **Only this child entrypoint parses `--skip-migrations`.**

- [ ] **Step 1: Write the failing tests.**
  - **In `e2e-isolation.e2e-spec.ts`.** No test in this file opens a maintenance connection. The file imports only the `pg`-free support modules (`migration-files.ts`, `provision-error.ts`, `e2e-connection.ts`, `counting-listener.ts`), never `provision-test-database.ts` or `pg` (source-import rule). Every provisioning case runs in a `provision-cli.ts` child (B-01).
    - **Ordering** (with Review Focus 3).
      - **Precondition, established before `AppConfigModule` loads.** `NestConfigModule.forRoot()` reads `.env` when the module is first evaluated, so the order matters.
        - If `apps/api/.env` does not exist, the test writes one containing `DB_NAME=clensy` and the sentinel `E2E_ORDERING_SENTINEL=present`, and removes it in `afterAll`.
        - If the file exists, the test asserts that it contains `DB_NAME=clensy`, and writes nothing.
        - **Only then** does it load the module, by dynamic `await import('../src/platform/config/config.module')` inside the test. A static import would run `forRoot()` before the file exists.
        - When it wrote the file, it also asserts `ConfigService.get('E2E_ORDERING_SENTINEL') === 'present'`. That proves the file was read, so the precondition is not vacuous in CI, which has no `.env`.
      - **Inside this suite, with `DOTENV_CONFIG_*` deleted through `withE2eEnv`,** each of these equals the published target:
        - `ConfigService.get('DB_NAME')` from `Test.createTestingModule({ imports: [AppConfigModule] })`, where `AppConfigModule` is the dynamically imported one;
        - `(await import('../src/platform/database/data-source')).default.options.database`;
        - a helper `DataSource`'s `current_database()`.
    - **`PG*` non-redirection.**
      - Under `withE2eEnv({ PGHOST: 'db.invalid', PGPORT: '1', PGDATABASE: 'clensy', PGUSER: 'nobody' })`, a helper `DataSource` still connects, and `current_database()` equals the target.
      - The keys are deleted afterwards if they were unset before.
    - **Fail-closed (`globalSetup` path).**
      - Spawn `pnpm exec jest --config test/jest-e2e.json test/e2e-target.e2e-spec.ts`, with `cwd: apiRoot`, a 60 s timeout, `DB_NAME=clensy`, `DB_HOST=127.0.0.1` and `DB_PORT=<listener>`.
      - Expect a non-zero exit, stderr containing the `E2eTargetError` message, and `count() === 0`.
      - **Optional:** a second nested run with `--globalSetup <a no-op module>` proves the `setupFiles` path too.
    - **`globalSetup`, first and second run** (child `provision-cli.ts`, 120 s timeout each).
      - **Setup:** `const scratch = new ScratchDatabases(); const name = scratch.generate();`, passed as the child's `DB_NAME` (F6).
      - **First run:** `created: true`. `applied` equals `migrationNamesFromFiles().length`. On that database, the set of `SELECT name FROM migrations` equals the set `migrationNamesFromFiles()`, and the row count equals the file count. These queries use a guarded `DataSource` from `e2eConnectionOptions(name)`.
      - **Second run:**
        - `created: false`, `applied: 0`;
        - `maintenanceStatements` equals exactly one `SELECT … pg_database …` and contains no database-creation statement. The forbidden keyword is assembled from fragments (N1);
        - the database's `pg_database` oid, the `migrations` ids and the `information_schema.columns` digest are unchanged from the first run.
      - **Cleanup:** `afterAll` drops the database through `scratch.drop(admin, name)`, on an admin `DataSource(e2eConnectionOptions())` (F6).
    - **Pending detection (B-01)** (child `provision-cli.ts --skip-migrations`, new `scratch.generate()` name, 120 s timeout).
      - **Expected exit and output:**
        - exit ≠ 0;
        - stderr matches `/pending/`, names the database and the host, and reports a pending count equal to the file count;
        - no `PROVISION_RESULT` line on stdout;
        - stderr does not contain the password (asserted when it is non-empty).
      - **Checked afterwards:** `SELECT 1 FROM pg_database WHERE datname = $1` on the guarded `clensy_test` `DataSource` returns 1 row, which shows the failure came after the create step.
      - **Cleanup:** `scratch.drop` in `afterAll` (F6).
    - **Unreachable server.** `provision-cli.ts` with `DB_HOST=127.0.0.1` and `DB_PORT=<listener>` gives exit 1, and stderr names the connect step and the host, without the password.
    - **Child environment boundary (Q4 allowlist).**
      - **Input:** `migrationCliEnv(target, poisonedParent)`. The parent holds:
        - **variables that must be excluded:** `DOTENV_CONFIG_OVERRIDE='true'`, `DOTENV_CONFIG_PATH='/x/.env'`, `NODE_OPTIONS='--require /x'`, `NODE_PATH='/x'`, `TS_NODE_PROJECT='/x'`, `PGDATABASE='clensy'`, `DATABASE_URL='postgres://x/clensy'`, `npm_config_x='1'`, `XDG_DATA_HOME='/d'`, `XDG_RUNTIME_DIR='/r'`, `DB_NAME='clensy'`;
        - **variables that must pass through:** `PATH='/bin'`, `HOME='/h'`, `XDG_CACHE_HOME='/c'`, `XDG_CONFIG_HOME='/g'`.
      - **Expected output:** exactly the keys `{DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME, PATH, HOME, XDG_CACHE_HOME, XDG_CONFIG_HOME}`, with `DB_NAME === target.database` and the four pass-through values unchanged.
        - Other XDG variables are **not** passed: the allowlist names two variables, not a prefix.
        - A second call with `XDG_CACHE_HOME` and `XDG_CONFIG_HOME` absent from the parent returns neither key. Optional variables are never invented.
      - **The allowlist constant:** `MIGRATION_CHILD_ENV_PASSTHROUGH` equals exactly the nine names listed in Global Constraints.
      - **Missing `PATH`:** a parent without `PATH` throws `ProvisionError`, imported from `provision-error.ts`.
      - **Static assertion:** `provision-test-database.ts` passes `env: migrationCliEnv(` to `spawn`, and contains no `...process.env`.
    - **Switch confinement (static).**
      - `global-setup.ts` calls `provisionTestDatabase(` with one argument.
      - `provision-test-database.ts` contains no `process.env` apart from inside `migrationCliEnv(target, process.env)`.
      - The literal `--skip-migrations` appears only in `provision-cli.ts` and this test.
    - **Unit (stub `QueryClient`, no `pg`):**
      - `readAppliedMigrations` with `to_regclass` null returns `[]`, and issues no second query;
      - with the table present, it returns the names in id order.
    - **The provisioning name is proven by the child tests, not by a unit test.** In the first-run case, a guarded `DataSource` on `e2eConnectionOptions(name)` connects to the created database. In the pending case, `pg_database` holds exactly `name`. Together they show that the provisioning `CREATE DATABASE` names `target.database`. No unit test exercises the `pg.Client` path directly.
  - **In `migration-files.e2e-spec.ts` (characterization).**
    - **What it checks.** Each file under `src/platform/database/migrations/`:
      - matches `^\d{13}-[A-Za-z0-9]+\.ts$`;
      - exports exactly one class named `<Name><timestamp>`;
      - sets `name = '<Name><timestamp>'`, if it sets one.

      The 13-digit prefixes are unique.
    - **Break, outside the commit:** change one class suffix and expect a fail.
- [ ] **Step 2: Run it to verify it fails.** Run `pnpm --filter api test:e2e e2e-isolation.e2e-spec migration-files.e2e-spec`. Expected: FAIL ("Cannot find module" for the new support modules).
- [ ] **Step 3: Implement** the signatures above. Update `jest-e2e.json`. Delete Task 3's self-publish.
- [ ] **Step 4: Run it to verify it passes.** Same command. Expected: PASS.
  - The `globalSetup` log shows `created=true` on a machine without `clensy_test`. Later runs show `created=false, applied=0, pending=0, unknown=0`.
  - Run the migration-file break, and record it.
  - **If `pnpm` cannot run with the allowlisted environment** (for example corepack needs another variable): **stop and report** the missing variable to the owner. Do not widen the allowlist silently, and never fall back to spreading the parent environment.
- [ ] **Step 5: Commit** `test(api): resolve, publish and provision the e2e test database in Jest setup (#227)`

> **State after Task 5 (interim, not mergeable on its own):**
> - Every suite reaches `clensy_test`, because the published `DB_*` beat the `?? 'clensy'` fallbacks and `ConfigModule`'s file.
> - The guard is not installed yet.
> - The migration suites still use un-suffixed scratch names until Task 6. That does not satisfy invariant 1 for scratch connections.
> - No path reaches `clensy`, because the B-02 allowlist covers the CLI child.
>
> This state is acceptable only as an unpushed intermediate commit.

### Task 6: Move every e2e connection onto the helper, and add the static guard test (`code`)

Spec §4.2 ("Single connection helper"), §4.5 item 2, invariants 2, 4, 6, 13 and 14, §7 L506–512.

**Files:**
- **Modify (raw `DataSource` construction → `...e2eConnectionOptions()`, entities kept):**
  - `admins.service.e2e-spec.ts`
  - `admins.service.disable-concurrency.e2e-spec.ts`
  - `billing.service.e2e-spec.ts`
  - `bookings.service.e2e-spec.ts`
  - `catalog.service.e2e-spec.ts`. Also scope the unscoped `pg_stat_activity` query at L614–618 with `datname = current_database()` (invariant 6, an existing defect).
  - `cleaners-teams.service.e2e-spec.ts`
  - `customers-properties.service.e2e-spec.ts`
  - `jobs.service.e2e-spec.ts`
  - `laundry.service.e2e-spec.ts`
  - `remove-test-tenants.e2e-spec.ts`
- **Modify (migration suites).** Each uses `admin = new DataSource(e2eConnectionOptions())` and **one module-level** `const scratch = new ScratchDatabases()` per file. `scratch.create(admin, name)` and `scratch.drop(admin, name)` replace the raw statements, and the scratch `DataSource` comes from `e2eConnectionOptions(name)`. Cleanup is `if (scratchDataSource?.isInitialized) await scratchDataSource.destroy();`, then always `scratch.drop`. The files:
  - `add-booking-tenant.migration.e2e-spec.ts`
  - `add-catalog-tenant.migration.e2e-spec.ts`
  - `add-customer-property-tenant.migration.e2e-spec.ts`
  - `add-job-checklist-tenant.migration.e2e-spec.ts`
  - `add-laundry-billing-tenant.migration.e2e-spec.ts`. Its module-level create/drop serves both `describe` blocks.
  - `add-laundry-line-description.migration.e2e-spec.ts`
  - `add-team-cleaner-tenant.migration.e2e-spec.ts`
  - `add-tenant-and-admin-scope.migration.e2e-spec.ts`
  - `add-tenant-label-overrides.migration.e2e-spec.ts`
  - `create-payments.migration.e2e-spec.ts`
- **Modify** `test/helpers/migration-db.ts`: delete `connectionOptions`, keep `migrationsBefore`, and update its callers. That makes 21 modified files in all.
- **Create:** `apps/api/test/support/static-scan.ts` and `apps/api/test/e2e-static-guards.e2e-spec.ts`.

**Interfaces:**
- Consumes: Tasks 3 and 5.
- Produces, in `static-scan.ts`:
  - **`export const E2E_SOURCE_EXTENSIONS = ['.ts', '.js', '.mjs', '.cjs', '.mts', '.cts'] as const;`**
  - **`export function listE2eSourceFiles(root = <apiRoot>/test): string[]`.** It returns every file under `apps/api/test/`, recursively, whose name ends in one of those extensions. That includes:
    - `support/**`, `helpers/**` and `release-gate/**`;
    - `setup-e2e-env.ts` and `global-setup.ts`;
    - `e2e-static-guards.e2e-spec.ts` itself.

    **It excludes no source file.** Configuration files such as `jest-e2e.json` are not source files, and are not listed.
  - **`export const SEARCHED: Record<string, RegExp>`.** Every pattern is built from fragments at run time, is case-insensitive (`i`), and allows `\s+` between keywords:
    - `createDatabase` → `/create\s+database/i`, from `['create', 'database']`;
    - `dropDatabase`;
    - `alterDatabase`;
    - `createDatabaseMethod` (`createDatabase(`), `dropDatabaseMethod` (`dropDatabase(`);
    - `createdb`, `dropdb` (as words);
    - `dblink`, `postgresFdw`;
    - `pgTerminateBackend`, `pgCancelBackend`.

    `static-scan.ts` itself contains none of these strings literally.

- [ ] **Step 1: Write the failing static guard tests.** **Scanned set:** `listE2eSourceFiles()` for every check below. The set defines what the checks scan; **it does not narrow invariants 2, 4, 6, 13 or 14, which apply to all e2e code** (spec §7 L512). Where a check permits something, it does so by a **location allowance for a specific statement** in a named file, never by excluding the file.
  - **Scanned-set self-check (characterization).** The set is non-empty. It contains `support/static-scan.ts`, `e2e-static-guards.e2e-spec.ts`, `helpers/migration-db.ts`, `setup-e2e-env.ts`, `global-setup.ts` and every one of the 20 converted specs. No listed file ends in `.json`. It passes from the day it is written, because `listE2eSourceFiles` is written alongside it. Its break is Step 5 (g).
  - **Invariant 2 hygiene.**
    - No file matches `process\.env\.DB_[A-Z]+`, except `support/e2e-target.ts` (publish) and `support/e2e-connection.ts` (`e2eTarget`, `withE2eEnv`).
    - No file matches `\?\?\s*['"]clensy['"]`.
    - No file imports `dotenv` or `dotenv/config`.
    - Hygiene, not a security boundary.
  - **Invariant 4 (DDL) hygiene,** with the `SEARCHED` DDL patterns and method patterns:
    - scratch creation and dropping occur only in `support/e2e-connection.ts`, inside `ScratchDatabases`;
    - the one other permitted creation statement is in `support/provision-test-database.ts`, with no drop and no `ALTER` there;
    - `alterDatabase`, `createdb` and `dropdb` occur nowhere.

    The test records this limit: the check verifies **where** the provisioning creation statement is, not **which** name it creates. The name is covered by the Task 5 **child** tests: the guarded connection to the created database, and the `pg_database` row in the pending case (F6).
  - **Pattern controls (N2).** Each of these, assembled from fragments in the test, is matched by its `SEARCHED` pattern:
    - lower case with two spaces (`alter  database`);
    - mixed case with a tab (`Drop\tDatabase`);
    - a newline between keywords (`CREATE\nDATABASE`);
    - an upper-case function name (`PG_CANCEL_BACKEND(`).

    This pins case-insensitive, whitespace-tolerant matching.
  - **Invariant 14 (extension references) hygiene.** `dblink` and `postgresFdw` occur nowhere.
    - **Positive control:** the line `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` (assembled in the test) matches no `SEARCHED` pattern.
    - **The ten migration suites still pass:** `add-booking-tenant`, `add-catalog-tenant`, `add-customer-property-tenant`, `add-job-checklist-tenant`, `add-laundry-billing-tenant`, `add-laundry-line-description`, `add-team-cleaner-tenant`, `add-tenant-and-admin-scope`, `add-tenant-label-overrides` and `create-payments`. Each still contains its `uuid-ossp` statement, and each passes this check.
    - Separate from the DDL check.
  - **Invariant 13 (session termination) hygiene.** `pgTerminateBackend` and `pgCancelBackend` occur nowhere. Separate from the DDL and extension checks.
  - **Invariant 6 (activity scoping) hygiene.**
    - **How queries are found:** through the TypeScript syntax tree, never the raw text. `ts.createSourceFile` is walked, and every `StringLiteral`, `NoSubstitutionTemplateLiteral` and `TemplateExpression` is collected. A template is taken as its head and span literals joined.
      - Comments are never examined. `payments.concurrency.e2e-spec.ts` L60 and L68 mention `pg_stat_activity` in comments, and they are not queries.
    - **What counts as a query:** a collected literal that contains `pg_stat_activity` or `pg_locks` (case-insensitive) **and** the keyword `select` or `from`.
    - **The rule:** each such query, taken as a whole, contains a scoping predicate matching `\b(\w+\.)?datname\s*=\s*current_database\s*\(\s*\)`.
    - **Negation ban, on the `datname` predicate only.** The query fails if it contains `datname\s*(<>|!=)\s*current_database`, or `not\s*\(?\s*(\w+\.)?datname\s*=`.
      - Other negations are **not** restricted. The legitimate `pid <> pg_backend_pid()` in `catalog.service.e2e-spec.ts:644` and `payments.concurrency.e2e-spec.ts:114`, `:119` must pass.
      - **Positive control:** the query assembled as `select … where datname = current_database() and pid <> pg_backend_pid()` passes.
    - **Exception:** a correlated `pg_locks` subquery is accepted when the enclosing literal, which is the whole query, carries the predicate.
    - **Fixtures:** any query fixture written in the guard test builds `pg_stat` + `_activity` and `pg_` + `locks` from fragments. The guard file is in its own scanned set.
  - **Self-matching meta-assertion.** For every `SEARCHED` pattern, the source of `e2e-static-guards.e2e-spec.ts` and of `support/static-scan.ts` contains no match. The guard file is part of the scanned set, and a match anywhere fails the check.
  - Each `describe` title ends with "(hygiene, not a security boundary — spec §4.10)".
- [ ] **Step 2: Run it to verify it fails.** Run `pnpm --filter api test:e2e e2e-static-guards`. Expected: FAIL.
  - **Invariant 2 check:** lists the 21 files that use `process.env.DB_*` or `?? 'clensy'`, and no others.
  - **Invariant 4 check:** lists the 10 migration suites, whose raw creation and dropping statements are outside `ScratchDatabases`.
  - **Invariant 6 check:** lists `catalog.service.e2e-spec.ts` (the L614–618 query). This is a regression test.
  - **Invariants 13 and 14:** PASS today. They are characterization tests, broken in Step 5.
- [ ] **Step 3: Rewrite the 21 files** as listed. Behaviour stays the same apart from the target, the scratch-name suffix, cleanup and the `catalog` scoping fix.
- [ ] **Step 4: Run it to verify it passes.**
  - Run `pnpm --filter api test:e2e e2e-static-guards`.
  - Then run `pnpm --filter api test:e2e --testPathPatterns 'migration\.e2e-spec|service\.e2e-spec|service\.disable-concurrency|remove-test-tenants'`. Under pnpm 10, flags after the script name pass straight to Jest; do not insert `--`.

  Expected: PASS for both.
  - **Leftover check.** No `clensy_migration_%_test` database remains afterwards. Check it read-only, outside Jest, with:
    ```bash
    docker compose exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d clensy_test -At -c "SELECT datname FROM pg_database WHERE datname LIKE '"'"'clensy\_migration\_%\_test'"'"'"'
    ```
    Expected: no output.
  - The guard is not installed until Task 7; this check does not depend on it.
  - Record the output in the M6 evidence record.
- [ ] **Step 5: Characterization runs, outside the commit.** Each break is reverted and recorded in the M6 evidence record:
  - **(a)** make one activity query in `payments.concurrency.e2e-spec.ts` observe all databases → the invariant 6 check fails;
  - **(b)** add a `pg_term` + `inate_backend(` call to a scratch file under `test/support/` → the invariant 13 check fails;
  - **(c)** add a `db` + `link` reference in `test/helpers/` → the invariant 14 check fails, while a `uuid-ossp` line in the same file does not;
  - **(d)** add `ALTER` + ` DATABASE` in `global-setup.ts` → the invariant 4 check fails. The file is not excluded;
  - **(e)** add a drop statement to `provision-test-database.ts` → the invariant 4 check fails;
  - **(f)** write `'DROP DATABASE'` literally in `e2e-static-guards.e2e-spec.ts` → the self-match meta-assertion fails;
  - **(g)** make `listE2eSourceFiles` skip `support/**` → the scanned-set self-check fails;
  - **(h)** add `datname <> current_database()` to a copy of the `catalog` query → the invariant 6 negation ban fails, while the unchanged `pid <> pg_backend_pid()` does not.
- [ ] **Step 6: Commit** `test(api): route every e2e connection through the e2e target helper (#227)`

### Task 7: Install the guard and prove coverage of every DataSource path (`code`; gate G6)

Spec §4.5 item 1, invariant 3, §9 G6, §7 (Nest retry, note a), Review Focus 1.

**Files:**
- Modify: `apps/api/test/setup-e2e-env.ts`. After publishing, call `installDataSourceGuard()` from Task 4.
- Modify: `apps/api/test/datasource-guard.e2e-spec.ts`. Add the coverage cases below. **Remove its own `installDataSourceGuard()` call**, so that coverage comes only from `setupFiles`.
- Modify: `apps/api/test/e2e-static-guards.e2e-spec.ts`.

**Interfaces:**
- Consumes: Tasks 3–6.

- [ ] **Step 1: Write the failing tests**
  - **Precondition assertion, first in the file:** `DataSource.prototype[GUARD_MARKER] === true` with no install in this file. That fails until Step 3.
  - **Static: Jest module registry (Review Focus 1; characterization).**
    - **Scope:** the same scanned set as Task 6. Patterns are built from fragments.
    - **Forbidden in source:**
      - `jest.resetModules` and `jest.isolateModules` / `isolateModulesAsync`;
      - `jest.mock(` / `jest.doMock(` with a factory for `typeorm`, `@nestjs/typeorm` or `pg`;
      - imports of `module` / `node:module`, or `require('module')`.
    - **Forbidden in `jest-e2e.json`:** `resetModules` or `resetMocks` set to `true`.
    - **`apps/api/package.json`:** no `test:e2e*` script passes `--resetModules`.
    - **Not forbidden:** `unstable_mockModule`, `moduleNameMapper` and `requireActual` are not bypasses (Jest 30.4 source).
    - **Structure:** one `it` per forbidden form, so that each break below is the cause of exactly one failure.
    - **Breaks, outside the commit,** one per form. Each is added to a scratch file, or to a temporary copy of the config or script, and must make its own `it` fail:
      - (r1) `jest.resetModules()`;
      - (r2) `jest.isolateModules(() => {})`;
      - (r3) `jest.mock('typeorm', () => ({}))`;
      - (r4) `require('module')`;
      - (r5) `"resetModules": true` in a temporary copy of `jest-e2e.json`, which the check is pointed at;
      - (r6) `--resetModules` in a temporary copy of the `test:e2e` script.
  - **Static: raw `pg` source imports (invariant 1; characterization).**
    - **Import graph:** built from the TypeScript AST (`ts.createSourceFile` and `forEachChild`), over the scanned set only. It collects static `import`, dynamic `import()` and `require` specifiers, and follows only relative specifiers that resolve to scanned files.
    - **The rule, stated for source imports and not for run-time loading.** TypeORM loads `pg` at run time in every test environment, and that is expected.
      - No scanned file other than `support/provision-test-database.ts` has a `pg` or `pg-*` specifier.
      - No `*.e2e-spec.ts` file reaches `support/provision-test-database.ts` through the graph.
      - The only scanned files that reach it are `global-setup.ts` and `support/provision-cli.ts`.
      - `support/migration-files.ts` and `support/provision-error.ts` have no `pg` specifier. The Task 4 `pg.native` pin passes `pg` only as text in a child's `-e` argument, which is a string, not an import.
    - **Breaks, outside the commit:**
      - (p1) add `import 'pg'` to a scratch spec → fails;
      - (p2) import `support/provision-test-database` from a scratch spec → fails.
  - **Coverage: Nest application path.**
    - Under `withE2eEnv({ DB_NAME: 'clensy', DB_HOST: '127.0.0.1', DB_PORT: String(listener.port) })`, build `Test.createTestingModule({ imports: [AppConfigModule, DatabaseModule] }).compile()`.
    - Expect a rejection whose cause chain includes `UnsafeDataSourceError`, and `count() === 0`.
    - Timeout `60_000`: `@nestjs/typeorm` retries 9 times, 3000 ms apart (`typeorm.utils.js:123`). **Do not change `database.module.ts`.**
  - **Coverage: helper path.** `new DataSource({ ...e2eConnectionOptions(), database: 'clensy', host: '127.0.0.1', port: listener.port })` rejects with `UnsafeDataSourceError` and `count() === 0`.
  - **Coverage: scratch path.**
    - `new DataSource({ ...e2eConnectionOptions(), host: '127.0.0.1', port: listener.port, database: 'clensy_migration_' + hex })`, with no suffix, rejects with `UnsafeDataSourceError` and `count() === 0`.
    - `new DataSource(e2eConnectionOptions(scratch.generate()))` passes stage 1 against the real server. It then fails with a Postgres `3D000` (invalid catalog name), because the database does not exist. Assert that code, which shows the server was reachable and the guard let it through.
  - **Pass.** `new DataSource(e2eConnectionOptions())` initialises, and `isInitialized` is `true`. A `query` spy installed before `initialize()` records exactly one `current_database()` query.
  - **Stage 2 integration.**
    - **Setup:** a Test-database `DataSource` whose `query` is spied to return `[{ name: 'other_test' }]` once.
    - **Expected:** `initialize()` rejects with `UnsafeDataSourceError`, and leaves `isInitialized === false`.
  - **Coverage: whole suite.** The full `pnpm --filter api test:e2e` run in Step 4.
- [ ] **Step 2: Run it to verify it fails.** Run `pnpm --filter api test:e2e datasource-guard.e2e-spec e2e-static-guards`. Expected: FAIL. The marker precondition fails, and without the `setupFiles` install the Nest and helper cases connect (`count() > 0`).
- [ ] **Step 3: Implement.** Add one line to `setup-e2e-env.ts`.
- [ ] **Step 4: Run it to verify it passes.** First run `pnpm --filter api build:graphiql`, which a fresh checkout needs. Then run `pnpm --filter api test:e2e`. Expected:
  - every suite passes;
  - the coverage cases report `count() === 0`;
  - the release gate suites pass.

  Run breaks (r1)–(r6) and (p1)–(p2), and record each one.
- [ ] **Step 5: G6 gate (objective).**
  - **G6 fails** if, with the guard installed by `setupFiles` and Task 4 green, any coverage case shows `count() > 0`, or rejects without `UnsafeDataSourceError` in its cause chain.
  - **On failure:**
    - **stop M6**;
    - record the case, its output and the commit;
    - leave Tasks 1–6 **unmerged**;
    - return the slice to **M2, then M3, then M5 re-accept** (spec §9 G6).

    Shipping part of the slice would be an owner decision.
  - **Forbidden workarounds:**
    - per-site checks;
    - dropping or weakening stage 1;
    - editing `database.module.ts` or any application code;
    - skipping, excluding or narrowing suites;
    - weakening the static pins;
    - stretching timeouts to hide a connection.
  - **Record** the G6 outcome and evidence in the M6 evidence record.
- [ ] **Step 6: Commit** `test(api): install the e2e DataSource guard for every connection (#227)`

---

## Slice B: Development owner seeder (Tasks 9–11)

**The order is strictly sequential.**
- Task 9 needs Task 1.
- Task 10 needs Tasks 3, 5, 7 and 9.
- Task 11 needs Tasks 4 (listener), 6 (static file), 9 and 10.

Slice B shares Slice A's acceptance evidence (Task 13).

### Task 9: Seeder configuration and guards 1–5 (`code`)

Spec §4.7 (invocation, effective settings, guards 1–5), call 5, call 13, note e.

**Files:**
- Create: `apps/api/src/platform/database/dev-owner/dev-owner-config.ts`
- Test: `apps/api/src/platform/database/tests/dev-owner-config.spec.ts`

**Interfaces:**
- Consumes: Task 1 (including `ValueSource`).
- Produces:
  - **`export function parseDevOwnerArgs(argv: readonly string[]): { resetPassword: boolean }`:** accepts `[]` or `['--reset-password']`. Anything else, including `['--', '--reset-password']`, throws `DevOwnerRefusal('unknown argument')`.
  - **`export interface DevOwnerConfig { settings: EffectiveConnectionSettings; email: string; password: string; emailSource: ValueSource; passwordSource: ValueSource }`:** `email` is already lowercased (`toLowerCase()`, no trim); `password` is verbatim.
  - **`export function resolveDevOwnerConfig(launchEnv: EnvSource, envFile: EnvSource): DevOwnerConfig`:** applies the guards in spec order, and throws `DevOwnerRefusal` on the first failure:
    1. `NODE_ENV`, layered (launch, then file), trimmed and lowercased, equals `production`;
    2. `ADMIN_SEED_EMAIL` or `ADMIN_SEED_PASSWORD` is missing at both layers;
    3. the effective settings fail `validateEffectiveSettings`. `DB_*` are layered: launch, then file, then the defaults `localhost`, `5432`, `clensy`, `clensy_dev`, `clensy`;
    4. `!isLocalHost(host)`;
    5. `isTestDatabaseName(database)`.
  - **`export class DevOwnerRefusal extends Error`:** the message names the guard. It never contains an email, password or hash.
  - **`export function devOwnerEnvFilePath(cwd: string = process.cwd()): string`:** returns `resolve(cwd, '.env')` (note e).

- [ ] **Step 1: Write the failing tests**
  - **Each guard rejects, and the order is checked through pairs:**
    - production with missing email → production;
    - missing email with a bad port → email;
    - bad port with a remote host → settings;
    - remote host with `DB_NAME=clensy_test` → host.
  - **Guard 1:** `NODE_ENV=' Production '` → refused.
  - **Guard 2:** `ADMIN_SEED_PASSWORD='   '` → refused.
  - **Layering:**
    - launch `ADMIN_SEED_EMAIL=''` with the file value set → the file value, with `emailSource: 'apps/api/.env'`;
    - the password keeps `' pw '` verbatim;
    - `DB_*` precedence and defaults: launch beats file beats default, for each key.
  - **Guards 3–5:** `DB_PORT=0` refused; `DB_HOST=::1` refused; `DB_NAME=clensy_test` refused.
  - **`PGDATABASE` is ignored:** launch `DB_NAME=''`, `PGDATABASE=clensy_test` and file `DB_NAME=clensy` → database `clensy`.
  - **Lowercasing (Review Focus 2):** `ADMIN_SEED_EMAIL='Owner@Example.com'` → `email === 'owner@example.com'`.
  - **Arguments:** `parseDevOwnerArgs(['--reset'])` and `(['--', '--reset-password'])` throw; `(['--reset-password'])` → `{ resetPassword: true }`.
  - **Redaction:** no `DevOwnerRefusal` message contains the sentinel email, the sentinel password or the sentinel `DB_PASSWORD`, asserted over every refusal case.
  - **`.env` location:** `devOwnerEnvFilePath('/x/apps/api') === '/x/apps/api/.env'`.
- [ ] **Step 2: Run it to verify it fails.** Run `pnpm --filter api test dev-owner-config`. Expected: FAIL ("Cannot find module").
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run it to verify it passes.** Same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): add dev owner seeder configuration and guards (#227)`

### Task 10: Seeder core and output (`code`)

Spec §4.7 (guard 6, lookup, behaviour table, password check, boundaries, output), invariants 7–9, calls 6, 8, 10 and 12, §6 (seeder table).

**Files:**
- Create: `apps/api/src/platform/database/dev-owner/dev-owner-seeder.ts`
- Test:
  - `apps/api/test/seed-dev-owner.e2e-spec.ts` (the core, against the Test database);
  - `apps/api/src/platform/database/tests/dev-owner-output.spec.ts` (formatting).

**Interfaces:**
- Consumes: Task 1 (`ValueSource`); Task 9 (`DevOwnerConfig`); `AdminUserEntity`, `Role.TENANT_OWNER`, `AdminScope.TENANT`, `BOOTSTRAP_TENANT_ID`.
- Produces:
  - **`export const DEV_OWNER_BCRYPT_ROUNDS = 10;`**
  - **`export type DevOwnerResult`**, one of:
    - `{ outcome: 'created'; id: string }`
    - `{ outcome: 'unchanged'; id: string; password: 'matches' | 'differs' }`
    - `{ outcome: 'password reset'; id: string }`
    - `{ outcome: 'mismatch'; id: string; differing: readonly ('role' | 'scope' | 'tenantId' | 'isActive')[] }`
    - `{ outcome: 'not normalised'; count: 1 }`. Spec §4.7 L337: the un-normalised and ambiguous failures give only the match count. Here the count is always 1, because a second matching row would make the result `ambiguous`.
    - `{ outcome: 'ambiguous'; count: number }`
    - `{ outcome: 'tenant missing' }`
  - **`export async function seedDevOwner(dataSource: DataSource, input: { email: string; password: string; resetPassword: boolean; bootstrapTenantId?: string }): Promise<DevOwnerResult>`.**
    - **Tenant id:** the default is `BOOTSTRAP_TENANT_ID`. The parameter exists only for the "tenant missing" test.
    - **Email:** it asserts `input.email === input.email.toLowerCase()`, and throws otherwise.
    - **Transaction:** everything runs inside **one** `dataSource.transaction(async (manager) => …)`:
      1. check the tenant; if it is absent, return `tenant missing`;
      2. `SELECT … FROM admin_user_entity WHERE lower(email) = $1 FOR UPDATE`;
      3. apply the behaviour table.
    - **Writes:** only an `INSERT` (`created`), or `UPDATE admin_user_entity SET "passwordHash" = $1 WHERE id = $2` (`password reset`).
    - **On `unchanged`:** it compares the password with `bcrypt.compare`, read-only.
    - **A unique violation on insert** (a lost race) propagates. The transaction rolls back, so nothing is written.
  - **`export function formatDevOwnerResult(result: DevOwnerResult, context: { database: string; host: string; emailSource: ValueSource; passwordSource: ValueSource }): string`:** one line.
    - **Example:** `dev-owner: unchanged id=<uuid> database=clensy host=localhost email-source=apps/api/.env password-source=apps/api/.env password: matches ADMIN_SEED_PASSWORD`.
    - **`differs` uses exactly** `password: differs from ADMIN_SEED_PASSWORD (run with --reset-password to apply it)`.
    - **Failures** are prefixed `dev-owner: refused:`.
      - `mismatch` gives the id, and names each differing attribute as `<attribute> differs`, for example `isActive differs` (spec §6 L455).
      - `not normalised` says `existing account email is not normalised` and gives `count=1`, with no id.
      - `ambiguous` says `ambiguous: <N> accounts match`, with no id.
  - **`export function isFailure(result: DevOwnerResult): boolean`:** true for `mismatch`, `not normalised`, `ambiguous` and `tenant missing`.

- [ ] **Step 1: Write the failing tests**
  - **e2e setup.**
    - **`DataSource`:** from `e2eConnectionOptions()`, with `AdminUserEntity` and `TenantEntity`.
    - **Fixtures:** each case uses a generated email `dev-owner-<uuid>@example.com` and a random password.
    - **Statement capture:** using `test/helpers/capture-sql.ts`, record every statement the core issues.
    - **Before and after each case:** take a per-table row-count and content digest of every table, plus the owner row's `xmin`.
    - **Cleanup:** each test deletes its own rows by id in `afterEach`, in foreign-key order.
  - **The cases.** "No write" means: the captured statements contain no `INSERT`, `UPDATE` or `DELETE`; every table digest is unchanged; and the owner row's `xmin` is unchanged.

    | Case | Setup | Expected |
    |---|---|---|
    | created | no row | One `INSERT` into `admin_user_entity`, and no other write. The row has Bootstrap, `TENANT_OWNER`, `TENANT`, `isActive`. `bcrypt.getRounds(hash) === 10`. Every other table's digest is unchanged. |
    | unchanged, matches | second call | `unchanged`, `password: 'matches'`. No write; hash byte-identical (compared in the test, never printed). |
    | unchanged, differs | a different password | `password: 'differs'`. No write. |
    | mismatch | role `FINANCE`; tenant = a `createTestTenant` tenant; `isActive=false`; and the valid scope fixture `SUPER_ADMIN` / `PLATFORM` / `tenantId NULL` → `differing = ['role', 'scope', 'tenantId']` | No write, in each sub-case. |
    | not normalised | insert `Dev-Owner-<uuid>@example.com` through raw SQL; seed the lowercase email | `{ outcome: 'not normalised', count: 1 }`. No write (Review Focus 2). |
    | ambiguous | two rows differing only in case | `count: 2`. No write. |
    | password reset | `resetPassword: true` on a correct row | Exactly one `UPDATE` touching only `passwordHash`. `bcrypt.compare(newPassword)` is true. Other columns and other tables unchanged. |
    | reset + each refusal | `resetPassword: true` with not normalised, ambiguous, each mismatch kind | The same refusal, and no write. |
    | reset with no row | `resetPassword: true`, no row | `created` (call 6). |
    | tenant missing | `bootstrapTenantId: randomUUID()` | `tenant missing`. No write. |
    | insert race | two sessions on two `DataSource`s, the first holding the transaction via a barrier | One `created`. The other's unique violation propagates, with no second row. |
    | caller contract | `email: 'Upper@Example.com'` | Throws before any statement. |

  - **Unit (`dev-owner-output.spec.ts`).** For every outcome:
    - the line contains the outcome, the id or count, `database=`, `host=` and both sources;
    - the sentinel email, the sentinel password and a sample bcrypt hash appear in **no** line;
    - the spec-quoted strings are pinned exactly: the `matches` line `password: matches ADMIN_SEED_PASSWORD`, the `differs` sentence, `existing account email is not normalised`, `ambiguous: 2 accounts match` and `isActive differs`;
    - `not normalised` and `ambiguous` lines contain their count and **no** `id=`; a `mismatch` line contains `id=`.
- [ ] **Step 2: Run them to verify they fail.** Run `pnpm --filter api test dev-owner-output` and `pnpm --filter api test:e2e seed-dev-owner.e2e-spec`. Expected: FAIL ("Cannot find module").
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to verify they pass.** Same commands. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): add the dev owner seeder core (#227)`

### Task 11: Seeder entrypoint and scripts (`code`)

Spec §4.7 (invocation, "Never automatic", "Effective settings"), §2 (root alias, call 9), invariants 9 and 10, Review Focus 5.

**Files:**
- Create:
  - `apps/api/src/platform/database/dev-owner/dev-owner-datasource.ts`
  - `apps/api/src/platform/database/seed-dev-owner.ts`
  - `apps/api/src/platform/database/tests/dev-owner-datasource.spec.ts`
  - `apps/api/test/seed-dev-owner-cli.e2e-spec.ts`
- Modify:
  - `apps/api/package.json`: add `"db:seed:dev-owner": "ts-node -r tsconfig-paths/register src/platform/database/seed-dev-owner.ts"`;
  - root `package.json`: add `"db:seed:dev-owner": "pnpm --filter api db:seed:dev-owner"`;
  - `apps/api/test/e2e-static-guards.e2e-spec.ts`.

**Interfaces:**
- Consumes: Tasks 4, 6, 9 and 10.
- Produces:
  - **`export function devOwnerDataSourceOptions(settings: EffectiveConnectionSettings): PostgresConnectionOptions`.** It returns exactly `{ type: 'postgres', host, port, username, password, database, entities: [AdminUserEntity, TenantEntity], installExtensions: false }`.
    - `installExtensions: false` keeps every write inside `admin_user_entity`.
    - No `synchronize`, `migrationsRun`, `dropSchema`, `extra`, `url` or `logging`.
  - **The entrypoint `seed-dev-owner.ts`**, in this order:
    1. `parseDevOwnerArgs(process.argv.slice(2))`;
    2. `resolveDevOwnerConfig(process.env, parseEnvFile(devOwnerEnvFilePath()))`;
    3. `new DataSource(devOwnerDataSourceOptions(config.settings))`. It does **not** import `data-source.ts`, `app.module`, `database.module` or `seed.ts`;
    4. `initialize`, then `seedDevOwner`, then `formatDevOwnerResult`, then print one line;
    5. in `finally`, `if (ds.isInitialized) await ds.destroy()`;
    6. a single top-level `catch`:
       - on `DevOwnerRefusal`, print its message;
       - on any other error, print `dev-owner: error: <error.message>`, never `parameters`, `detail` or a stack;
       - exit `1` on a refusal, an `isFailure` result or any error.

- [ ] **Step 1: Write the failing tests**
  - **Options (unit):**
    - `Object.keys(devOwnerDataSourceOptions(s)).sort()` equals the exact list above;
    - `installExtensions === false`;
    - the entities are exactly those two.
  - **CLI, as a child process.**
    - **Invocation of every case**, never `pnpm --filter`, which forces `cwd` to `apps/api` and would read the developer's real `apps/api/.env`:
      - **command:** `node -r <apiRoot>/node_modules/ts-node/register -r <apiRoot>/node_modules/tsconfig-paths/register <apiRoot>/src/platform/database/seed-dev-owner.ts`, with absolute paths and `TS_NODE_PROJECT=<apiRoot>/tsconfig.json`;
      - **working directory:** a fresh temporary directory per case, created with `mkdtemp` and removed afterwards. Its `.env` is written by the test: **empty** unless the case says otherwise. So `apps/api/.env` can never influence a case;
      - **precondition:** each case asserts its `cwd` is not `apiRoot`.
    - **Environment of every child:**
      - `DB_HOST=127.0.0.1`;
      - `DB_PORT=<counting listener>`;
      - an **explicit non-test sentinel `DB_NAME=dev_owner_cli_sentinel`**, which is never deleted. The child must never fall back to `apps/api/.env` and reach `clensy`;
      - sentinel `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD`;
      - `NODE_ENV` deleted.
    - **Timeout:** 60 s each.

    | Case | Variation | Expected |
    |---|---|---|
    | production | `NODE_ENV=production` | Exit 1; stdout contains the production refusal text; `count() === 0`. |
    | test database | `DB_NAME=clensy_test` | Exit 1; the Test-database refusal text; `count() === 0`. |
    | bad argument | argv `--bogus` | Exit 1; the argument refusal; `count() === 0`. |
    | remote host | `DB_HOST=db.example.com` | Exit 1; the host refusal; no DNS lookup is needed. |
    | missing email | `ADMIN_SEED_EMAIL` missing from the environment; the temporary `.env` is empty | Exit 1; the credentials refusal; `count() === 0`. |    | every case | — | Output never contains the sentinel email or password. |

    Each refusal text is matched specifically, so a later guard cannot mask an earlier one.
  - **Review Focus 5.** The same invocation, with the temporary directory's `.env` holding only `NODE_ENV=production`, and `NODE_ENV` deleted from the child environment.
    - **Expected:** exit 1, the production refusal text and `count() === 0`. That shows the working-directory `.env` was read.
  - **The scripts.** `apps/api/package.json` and the root `package.json` contain the exact `db:seed:dev-owner` lines from Files. This is a static assertion; the scripts are not executed by the tests.
  - **Static: never automatic (invariant 10; characterization).**
    - **Seeder references:** `seed-dev-owner`, `db:seed:dev-owner`, `db:seed`, `seed.ts`, `seed.js`, `/seed'`, `/seed"`, and imports of `dev-owner/`.
    - **Where none may appear:**
      - `src/main.ts`, and every `src/**` file outside the two entrypoints, `dev-owner/**` and `tests/**`. Comment lines are excluded by stripping `//` and `/* */` comments before matching. `booking.seed-data.ts:13` and `booking-fixtures.seed-data.ts:3` are comments;
      - `Dockerfile` and `Dockerfile.web`;
      - `docker-compose.yml`;
      - `.github/workflows/ci.yml`;
      - `turbo.json`;
      - `apps/api/test/setup-e2e-env.ts` and `global-setup.ts`;
      - in both `package.json` files, the scripts `start`, `start:dev`, `start:debug`, `start:prod`, `prestart`, `prestart:dev`, `prebuild`, `build`, `postinstall`, `prepare`, `dev`, `migration:run`, `test`, `test:e2e` and `test:e2e:release-gate`.
    - **Patterns** are built from fragments where they are searched-for strings.
  - **Static: entrypoint imports.** `seed-dev-owner.ts` and `dev-owner/**` import none of `data-source`, `app.module`, `database.module` or `seed`.
- [ ] **Step 2: Run them to verify they fail.** Run `pnpm --filter api test dev-owner-datasource` and `pnpm --filter api test:e2e seed-dev-owner-cli e2e-static-guards`. Expected: FAIL ("Cannot find module", and no script). The never-automatic check passes already: it is a characterization test.
- [ ] **Step 3: Implement** the entrypoint, the options function and both scripts.
- [ ] **Step 4: Run them to verify they pass.** Same commands. Expected: PASS.
- [ ] **Step 5: Characterization runs, outside the commit.** Revert each break, and record it.
  - **(a)** add `"prestart": "pnpm db:seed"` to `apps/api/package.json` → the never-automatic check fails;
  - **(b)** add `import './platform/database/seed'` to `src/main.ts` → it fails;
  - **(c)** add a `RUN pnpm db:seed:dev-owner` line to `Dockerfile` → it fails.
- [ ] **Step 6: Commit** `feat(api): add the db:seed:dev-owner command (#227)`

---

## Slice C: Documentation and evidence (Tasks 12–13)

### Task 12: Documentation (`docs/process`)

Spec §4.8, §4.10, §9 G4, G5 and G7. TDD does not apply. Verification is a per-item checklist plus a credentials scan.

**Files:**
- Modify: `docs/getting-started/local-development.md`, `docs/development/testing-and-ci.md`, `apps/api/README.md`

- [ ] **Step 1: Cover every §4.8 bullet in `local-development.md`:**
  - **The two databases** on one Compose server.
  - **The e2e default:** e2e uses `clensy_test` and creates it on first run.
  - **`DB_NAME`:** do not export it; check what Compose will use with `docker compose config | grep DB_NAME`.
  - **Concurrent checkouts** (D-M5-1, §4.10):
    - two checkouts running e2e at once share `clensy_test` and can silently diverge each other's schema;
    - this is out of scope by owner decision;
    - to isolate them, give each command its own name: `DB_NAME=<branch>_test pnpm --filter api test:e2e`, per command, never exported.
  - **The mixed host/Docker table** (spec §4.3).
  - **`pnpm db:seed:dev-owner`:**
    - its first run, re-runs and the password check;
    - `--reset-password`, spelled `pnpm db:seed:dev-owner --reset-password`. With `-- --reset-password` it is refused, which fails closed;
    - its output (outcome, id, sources; never the email);
    - the source-label limit when run from another directory;
    - the mismatch, un-normalised and ambiguous failures, each with manual resolution steps.
  - **The full `db:seed` effects:** it moves, re-scopes, re-roles, re-enables and re-hashes the owner, overriding the seeder's refusal. It is not a safe way to check the owner.
  - **Resetting a stale or diverged `clensy_test`:**
    - **On the host:** `dropdb -h localhost -p <DB_PORT from apps/api/.env> -U <DB_USERNAME> clensy_test`.
    - **Through Compose:** `docker compose exec postgres sh -c 'dropdb -U "$POSTGRES_USER" clensy_test'`.
    - **What follows:** the next run recreates it. The pending-migration check does not detect a stale or diverged database.
    - **Warning:** the same command with `clensy` would delete the development database. Run it only when no e2e run is active.
  - **Leftover scratch databases** (crash recovery):
    - list them with `SELECT datname FROM pg_database WHERE datname LIKE 'clensy\_migration\_%\_test'`;
    - drop only names matching `clensy_migration_<32 hex>_test`, and only when no e2e run is active.
  - **Every §4.10 risk** (spec L394–411), one item each:
    - the host-allowlist limits;
    - what still protects e2e: connection confinement only;
    - the seeder through a tunnel;
    - **superuser cross-database statements:** documented image behaviour, not observed. The examples are not a complete list. The scans are hygiene;
    - session termination;
    - concurrent runs: intended behaviour, not a guarantee;
    - **checkouts without this slice**, and the owner's inspection of every checkout and worktree before seeding.
  - **Troubleshooting:** a row for the resolver error, with its message and what to do.

  Also correct the existing "Seed data" paragraph about the effects of re-running.
- [ ] **Step 2: Update `testing-and-ci.md`:**
  - replace "connect with the `DB_*` values in `apps/api/.env`" with the §4.2 rule;
  - remove the manual local `migration:run` prerequisite, and state the `CREATEDB` prerequisite;
  - keep `migration:run` in the CI table, and add "then `globalSetup` confirms none pending".
- [ ] **Step 3: Update `apps/api/README.md`:** add `db:seed:dev-owner` to the command table, and note `clensy_test` beside `test:e2e`.
- [ ] **Step 4: Verify.**
  - **Checklist:** for each bullet in Steps 1–3, record the file, the heading and the line where it is covered, in the M6 evidence record. An item with no location fails the step.
  - **Credentials scan.**
    - **Command:** `git diff -U0 -- docs apps/api/README.md | grep -nEi "postgres(ql)?://[^ ]*:[^ @]*@|password\s*[:=]\s*[^<\s]|secret\s*[:=]|ADMIN_SEED_PASSWORD\s*=\s*[^<\s]" | grep -vE "password: (matches|differs from) ADMIN_SEED_PASSWORD"`.
    - **The excluded phrases** are the two spec-quoted output phrases (§4.7 L329), which the docs must show.
    - **Expected:** no output. Placeholders use `<…>` and `example.com`.
    - **Failure rule:** any remaining line is reviewed. A real credential is removed before the commit. A false positive is listed, with its line and the reason, in the M6 evidence record. Nothing is waved through silently.
- [ ] **Step 5: Commit** `docs(227): document clensy_test and the dev owner seeder`

### Task 13: Acceptance evidence and push readiness (`docs/process`)

Spec §4.5 item 4 (no observed change; `stopped`/`idle`), §7 (M6 evidence), the #227 acceptance criteria, D-M5-5 and D-M5-6.
- **Who runs it:** the operator is the M6 executor, named in the record.
- **What it writes:** apart from the e2e run's own writes to `_test` databases, this task writes nothing to any database. It does not run the seeder against `clensy`.
- **What the snapshot is:** evidence of no **observed** change. It detects gross damage after the fact. It does not prevent changes, and does not prove that none happened between the two moments. It covers only the Task 13 run, not Tasks 5–12.

- [ ] **Step 1: Take the "before" snapshot in `stopped` mode (the default).**
  - **Preconditions, all recorded in `before-preconditions.txt`, never in `before.txt`:**
    - `docker compose stop api`, then `docker compose ps -a`: `api` is not running. Its STATUS column holds durations, so it must not be in the diffed file;
    - `ss -ltn '( sport = :3000 )'` shows no listener;
    - the operator's attestation, labelled as an attestation, that no host tool targets `clensy` during the run.
  - **The queries.** They run read-only:
    ```bash
    docker compose exec -T postgres sh -c \
      'PGOPTIONS="-c default_transaction_read_only=on" psql -U "$POSTGRES_USER" -d clensy -v ON_ERROR_STOP=1 -At -f -' \
      < snapshot.sql > before.txt
    ```
  - **The query file `snapshot.sql`.** Its full text is copied into the M6 evidence record.
    1. `SHOW default_transaction_read_only;` (must be `on`; otherwise abort).
    2. **Identity:** `SELECT oid, datname FROM pg_database ORDER BY datname;`. This also lists any leftover scratch databases.
    3. **Activity:** `SELECT pid, usename, application_name, state FROM pg_stat_activity WHERE datname = 'clensy' AND backend_type = 'client backend' AND pid <> pg_backend_pid() ORDER BY pid;` (expected: no rows).
    4. **Row counts, every schema except `pg_catalog` and `information_schema`:** `SELECT table_schema || '.' || table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY 1;`
    5. **Digests:** `SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t.id), '')) FROM admin_user_entity t;`, and the same for `audit_event_entity`. No whole-database digest (owner decision).
- [ ] **Step 2: Run the full suite.**
  - **Commands:** `pnpm --filter api build:graphiql && pnpm --filter api test:e2e`, then `pnpm --filter api test:e2e:release-gate`.
  - **Expected:** PASS. The log shows `e2e target clensy_test@localhost:<port>`.
- [ ] **Step 3: Take the "after" snapshot.**
  - **How:** the same as Step 1. The SQL output goes into `after.txt`. The `docker compose ps -a` output, the port check and the attestation go into `after-preconditions.txt`.
  - **Comparison:** `diff before.txt after.txt` must exit `0`. Only the SQL output is diffed. The precondition files are checked by their own rules (`api` not running, no listener) and recorded, not diffed.
  - **Failure rule:** any difference, any activity row, read-only not `on`, or a missing precondition means **the evidence failed**. Stop M6, record the output, and do not proceed to M7.
  - **Record:** "mode: `stopped`", the operator, both files' contents, and the final `docker compose ps -a`.
  - **`idle` mode is an exception.** It is permitted only if stopping `api` is impractical, and the reason is recorded.
    - **Extra evidence:** the activity rows before and after (an "active" row is any `state <> 'idle'`); `pg_stat_database.stats_reset` for `clensy` before and after (a change is inconclusive); and the summed `n_tup_ins + n_tup_upd + n_tup_del` from `pg_stat_user_tables`.
    - **Lag:** wait 10 s before the "after" counters, to allow for statistics lag. That is a mitigation only.
    - **The four spec limitations** are stated.
    - **Inconclusive evidence** means repeating in `stopped` mode.
  - **Afterwards:** `docker compose start api`. Whether that re-runs `migrate` is open question Q3. It happens after the "after" snapshot, so it does not affect the evidence.
- [ ] **Step 4: Run the CI-equivalent checks:**
  - `pnpm run lint`, then `git status --porcelain`. That must be empty: the `api` lint script uses `--fix`, so any rewrite must be committed and Steps 2–4 repeated;
  - `pnpm --filter api exec tsc --noEmit`;
  - `pnpm --filter web exec tsc --noEmit`;
  - `pnpm run test`.

  Expected: all pass, and the working tree is clean.
- [ ] **Step 5: Write the M6 evidence record**, appended to this plan as the section "M6 evidence", and commit it. It contains:
  - the snapshot query text, both outputs, the mode, the operator and the diff result;
  - every characterization break run (Tasks 1, 4, 5, 6, 7 and 11);
  - the G6 outcome (Task 7, Step 5);
  - the docs checklist (Task 12, Step 4);
  - the Step 2 and Step 4 results.

  The M6 Slice Completion Report summarises it and cites the record (reporting conventions).
- [ ] **Step 6: Push readiness. STOP for separate authorisation (D-M5-5).** Present to the owner:
  - **Branch and upstream:** `git rev-parse --abbrev-ref HEAD` (expected `feat/227-e2e-db-isolation-dev-owner`), and `git rev-parse --abbrev-ref @{u}`, which must not be `origin/main`. A branch cut with `--no-track` has no upstream.
  - **The exact proposed push:** `git push origin feat/227-e2e-db-isolation-dev-owner:feat/227-e2e-db-isolation-dev-owner`. Never a bare `git push`.
  - **The PR:** the PR that will be opened or updated (one PR for #227).
  - **CI:** the expected runs, **Lint**, **Test**, **Release gate** and **API e2e**, on the final head. Their green results are the §7 "green CI on the PR" evidence.
  - **CI log evidence (spec §7, "CI evidence").** After the authorised push, the M6 evidence record captures, from the final-head logs of **both** **Release gate** and **API e2e**:
    - the `pnpm --filter api migration:run` step, present and successful;
    - the `globalSetup` line `e2e target clensy_test@localhost:5432: created=false, applied=0, pending=0`, with `unknown=0` following it.

    Either job missing either item fails the evidence.
  - **Re-recording:** the CI results and log evidence are recorded after the push, and re-recorded after any later push (M7 fixes, M8, M9).

  **No push happens until the owner authorises it explicitly.** Completing this step does not authorise a push.

---

## Implementation sequence and gates

1. **M5 Plan Review** must Accept this plan. Nothing starts before that.
2. **Pre-M6 branch step** (D-M5-4):
   1. Re-inspect local and remote branches and existing PRs for #227 (`git branch -a`, `git ls-remote --heads origin`, `gh pr list --state all --search 227`). Stop if any conflicts.
   2. Run `git switch --no-track -c feat/227-e2e-db-isolation-dev-owner docs/227-e2e-db-isolation-spec`.
   3. Record the `CONTRIBUTING.md` L16 deviation (header row "Branch") in the M6 Slice Completion Report.
3. **Slice A, strictly in this order:** Task 1 → 2 → 3 → 4 → **8** → 5 → 6 → 7.
   - Tasks 1–4 are additive.
   - Task 8 (CI values) comes before Task 5, so CI stays meaningful.
   - From Task 5 on, local Postgres with `CREATEDB` is required.
   - The state between Tasks 5 and 6 is an unpushed intermediate only.
   - Task 6 precedes Task 7, because the guard rejects the old un-suffixed scratch names and Task 7's full run needs the `catalog` fix.
   - **Task 7 is the G6 gate.**
4. **Slice B, strictly:** Task 9 → 10 → 11, with the dependencies listed at the head of Slice B.
5. **Slice C:** Task 12, then Task 13 last. Task 13 ends at push readiness.
6. **Push:** only after explicit owner authorisation (Task 13, Step 6).
7. **Gates after M6.** Each produces a Slice Completion Report at its handoff.
   - **M7.** A fresh, independent reviewer on the most capable model (`CLAUDE.md`). Inputs: the Accepted spec, this plan, the branch diff, final-head CI and the M6 evidence record. Output: an M7 outcome record that cites the review, plus an SCR.
   - **M8:** refactoring, if any, with an SCR.
   - **M9:** documentation, with an SCR.
   - **M10: not in scope.** The owner decided this in D-M5-7.
   - **Closeout** (process spec §2.12): the pre-merge stage check from M1 to M9, merge, post-merge verification, and the final SCR.

   One PR for #227.
8. **After the merge (owner actions, not this plan):**
   1. **Before seeding**, inspect every existing checkout and worktree (D-M5-2; spec §4.10). Today these are `.claude/worktrees/feat+53-web-i18n-architecture` at `68cd628` and the #209 scratch worktree `clensy-209-src` at `c9e449f`. Rebase or retire each one that lacks #227, or do not run e2e in it. Any of them would otherwise truncate `admin_user_entity` in `clensy`.
   2. Run `pnpm db:seed:dev-owner` against `clensy`.
   3. #209's own gate then verifies the account read-only.

## Traceability

**Status key:**
- **tested:** a test in this plan proves it.
- **hygiene:** a static scan; not a security boundary.
- **design only:** specified, with no automated proof.
- **residual risk:** documented, not prevented.

| Spec requirement | Task(s) | Evidence | Status |
| --- | --- | --- | --- |
| §4.1 terms, rule, allowlist, missing values (call 13) | 1 | Unit tests | tested |
| §4.2 resolution, publication, ordering, precedence | 2, 5 | Resolver tests; ordering test, with its own precondition | tested |
| §4.2 single connection helper | 3, 6 | Helper tests; invariant 2 scan | tested; hygiene |
| §4.3 item 1 (narrowed): connection confinement and database-scoped statements | 4, 5, 7 | Guard and coverage tests; B-02 allowlist | tested; cross-database statements are a residual risk |
| §4.4 items 1–4: maintenance connection, create, migrate, none pending, migration path | 5 | Child `globalSetup` tests; exact set; provable no-op | tested |
| §4.4 item 5 failure cases | 5 | Pending and unreachable cases tested; `CREATEDB` denial and a migration error | partly tested; the rest design only |
| §4.4 item 6: never drops or resets the target | 5 | Code review; no drop statement in the provisioning routine (invariant 4 scan) | hygiene |
| §4.5 item 2: scratch names and limits | 3, 6 | `ScratchDatabases` tests; DDL scan | tested; hygiene |
| §4.5 item 3: Bootstrap never deleted | 6 | Existing `remove-test-tenants` suite | tested (partial) |
| §4.5 item 4: no observed change; `stopped`/`idle` | 13 | Snapshot diff and failure rule | detection only |
| §4.6 and §7 "CI evidence": CI `clensy_test`; `migration:run` kept; `globalSetup` reports 0 applied, none pending; job names | 8, 13 | Task 8 diff; final-head PR CI; both jobs' `migration:run` step and `created=false, applied=0, pending=0` log line (Task 13, Step 6) | tested after the authorised push |
| §4.7 guards 1–5; `.env` location | 9, 11 | Unit and CLI tests | tested |
| §4.7 guard 6, lookup, behaviour table, password check, output (including the match count on un-normalised and ambiguous failures, L337) | 10 | Core e2e and output unit tests; spec-quoted strings pinned | tested |
| §4.8 documentation, including every §4.10 risk | 12 | Per-item checklist | design only (review) |
| §4.10 risks | 12, Risks | Docs and Risks | residual risk |
| §7 fail-closed run | 5 | Child Jest run, `count() === 0` | tested |
| §7 L509–512: three separate checks; scanned set; self-match | 6 | Static guard test; pattern controls; breaks (a)–(h) | hygiene |
| §9 G6: coverage; note a, retries | 7 | Coverage cases; objective G6 rule | tested |
| §9 G7: stale or diverged `clensy_test` | 5, 12 | `ProvisionResult.unknown` and `unknown=<n>` in the log; docs | residual risk |
| Call 6 (reset with no row → created) | 10 | Core test | tested |
| Call 9 (root alias) | 11 | Script present | design only |
| Call 10 (no audit writes) | 10 | Every table's digest unchanged | tested |
| **Invariant 1:** Test-database connections only; one maintenance connection outside test environments | 4, 5, 7 | B-01 child design; source-import rule for `pg` (AST pin, breaks p1–p2); `pg.native` pin in a child process; guard | tested; hygiene |
| **Invariant 2:** no `DB_NAME` from a file | 2, 5, 6 | Resolver tests; ordering test with `DOTENV_CONFIG_*` deleted; `dotenv` import ban | tested; hygiene |
| **Invariant 3:** both guard stages, including `extra.Client` | 4, 7 | Zero-connection tests; coverage | tested |
| **Invariant 4:** database DDL limits; no `ALTER`; the provisioning exception | 3, 5, 6 | `ScratchDatabases` tests; DDL scan with location allowances | tested; hygiene |
| **Invariant 5:** no `PG*` redirection | 1, 2, 3, 5, 9 | `PG*` tests; `e2eTarget` validation | tested |
| **Invariant 6:** database-scoped activity queries | 6 | Activity scan; `catalog` fix | hygiene |
| **Invariant 7:** seeder changes only `passwordHash`, only with the flag | 10 | Statement capture, digests, `xmin` | tested |
| **Invariant 8:** seeder fails closed | 9, 10, 11 | Refusal and no-write tests | tested |
| **Invariant 9:** seeder output redaction | 9, 10, 11 | Sentinel tests | tested |
| **Invariant 10:** never automatic | 11 | Inventory scan; breaks (a)–(c) | hygiene |
| **Invariant 11:** `db:seed` unchanged | all | The diff shows `seed.ts`, the pre-existing `src/**` it boots, and both `db:seed` script lines untouched | design only (diff) |
| **Invariant 12:** CI job names unchanged | 8 | Task 8 diff | tested (diff) |
| **Invariant 13:** no session-termination calls | 6 | Separate scan; break (b) | hygiene; residual risk remains |
| **Invariant 14:** no `dblink`/`postgres_fdw`; `uuid-ossp` permitted | 6 | Separate scan; positive control; 10 suites; break (c) | hygiene |
| #227 "full e2e, release gate, CI-equivalent pass" | 7, 13 | Runs | tested |
| #227 "fresh independent M7" | Gates | M7 record | gate |

## Risks

- **G6 (Task 7):** an unknown path in `@nestjs/typeorm` or nestjs-query could build a `DataSource` outside the patched prototype.
  - **Mitigation:** the coverage tests, the early probe and the whole-suite run.
  - **If it fails:** Tasks 1–6 stay unmerged, and the slice returns to M2, then M3, then M5.
- **Residual paths to `clensy`** (spec §4.10). These are not prevented:
  - **superuser cross-database statements** (`DROP` or `ALTER DATABASE`, `dblink`/`postgres_fdw` if installed, server-wide changes). The scans are hygiene;
  - **session termination;**
  - **child processes:** they are outside the guard. The migration child's environment is allowlisted, and seeder children use an explicit sentinel database;
  - **dependency or run-time-built SQL.**
- **Checkouts without this slice** (D-M5-2): they still run e2e on `clensy`, and can delete the seeded owner. The owner inspects them before seeding.
- **Concurrent runs** (D-M5-1):
  - two checkouts running e2e at once against one server share `clensy_test`;
  - each run migrates it automatically, with no lock, so branches can silently diverge each other's schema;
  - a first-create race is possible;
  - this never reaches `clensy`, by design;
  - it is out of scope by owner decision. A distinct `DB_NAME=<branch>_test` per command isolates the runs.
- **The seeder's success path first runs after the merge** (R-73), in the owner's run against `clensy`. This is an accepted limit. The options and import graph are pinned.
- **The source label** `apps/api/.env` is accurate only for the supported invocations. This is documented.
- **The Nest retry test takes about 24 s.** Its 60 s timeout is local to that test.
- **The CLI migration** spawns `ts-node` once per e2e run, a few seconds even when nothing is pending. That is accepted for parity with CI and Compose.
- **Child-process tests** need `pnpm` on `PATH`; `pnpm/action-setup` provides it in CI.
  - **If the allowlisted environment proves insufficient** for `pnpm` (Task 5, Step 4), M6 stops for an owner decision.
- **Upstream misconfiguration:** `docs/227-e2e-db-isolation-spec` tracks `origin/main`. The feature branch is cut with `--no-track`, and every push names an explicit refspec.
- **Rollback.**
  - **Slices A and B roll back as a unit:** revert the merge, or every slice commit in reverse order. Docs revert with the code they describe.
  - **Single reverts are unsafe for Tasks 5, 6 and 7,** which share files and depend on each other. Reverting `setupFiles` alone would send `AppModule` suites back to `clensy`.
  - **Task 8 alone can be reverted.** CI then fails closed.
  - **`clensy_test`** may be dropped only when no e2e run is active. CI recreates it.
  - **No task is designed to write to `clensy`.** The snapshot detects observed changes, and does not prove that none happened.

## Open questions (not blocking this plan)

| Question | Status in this plan |
| --- | --- |
| **Q1:** are `dblink` / `postgres_fdw` available? | Irrelevant to the plan. The scans forbid references either way. |
| **Q2:** `55006` on a concurrent `CREATE DATABASE` | Concurrency is out of scope; observed only if it occurs. |
| **Q3:** does `docker compose start api` re-run `migrate`? | After the evidence, so it does not affect it. |
| **Q4:** child environment | **Resolved by owner decision:** the allowlist in Global Constraints. |
| **Q5:** libpq `dbname` precedence | Moot while `pg.native === null`, which Task 4 pins. |
| **Q6:** `provision-cli.ts` under `ts-node` | Settled at Task 5, Step 4. |
| **Q7:** worktree activity | The owner's inspection before seeding. |

## Gate outcomes

*(Appended after M5.)*
