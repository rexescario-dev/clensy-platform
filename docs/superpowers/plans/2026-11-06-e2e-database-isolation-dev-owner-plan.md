# E2E Database Isolation & Development Owner Seeder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Draft** — M4 revision 1, 2026-11-06. Awaiting Plan Review (M5). |
| Date | 2026-11-06 |
| Tracking issue | [#227](https://github.com/rexescario-dev/clensy-platform/issues/227) "test(api): isolate the e2e database and add a persistent dev TENANT_OWNER seeder" |
| Branch | `docs/227-e2e-db-isolation-spec` carries the Accepted spec and this plan. M6 continues on this branch, or on `feat/227-e2e-db-isolation` cut from it. Spec, plan and implementation go in one PR (process spec §2.8). |
| Implements (Accepted) | [E2E Database Isolation & Development Owner Seeder](../specs/2026-11-06-e2e-database-isolation-dev-owner-design.md). Status **Accepted** 2026-11-06 (M3). Content as reviewed at `8ec06c3`; the acceptance was recorded in `98733e6`. |
| Relies on (Accepted) | [Multi-Tenant Architecture](../specs/2026-09-23-multi-tenant-architecture-design.md): Bootstrap tenant, `TENANT` scope, `CHECK` constraints. Unchanged. [Required CI checks](../specs/2026-10-06-required-ci-checks-design.md): job names **Release gate** and **API e2e** are unchanged. |
| Authority | Where this plan and the Accepted spec disagree, **the spec wins**, and this plan must be revised. File names, helper names, output wording, task order and test layout are planning decisions, not product semantics. |
| Scope | `apps/api`: `test/` infrastructure and e2e suites; new seeder files under `src/platform/database/`; `package.json` scripts. Root `package.json`: one alias. `.github/workflows/ci.yml`: two jobs. Docs: `docs/getting-started/local-development.md`, `docs/development/testing-and-ci.md`, `apps/api/README.md`. |
| Untouched | `docker-compose.yml`, `Dockerfile`, `Dockerfile.web`, `apps/api/src/platform/database/database.module.ts`, `data-source.ts`, `seed.ts`, every migration, all application modules, every `.env` / `.env.example`, `apps/web`, `packages/*`. #209 and its plan. |
| Pre-validation | **None.** No code in this plan has been run. Every `Expected:` line is a prediction until M6 records the actual result. |
| M7 | This slice changes test infrastructure, database setup and adds a seeder that writes `admin_user_entity`. `CLAUDE.md` therefore requires a **fresh independent reviewer** on the most capable model, given the Accepted spec, this plan and the branch diff. |
| Commits | Never add a `Co-Authored-By` trailer or a "Generated with" line (user instruction). |

**Goal:** `pnpm --filter api test:e2e` runs only against a `_test` database, both locally and in CI, and no e2e connection can reach `clensy`. Separately, `pnpm db:seed:dev-owner` creates or verifies one persistent Bootstrap `TENANT_OWNER`, and never changes anything else.

**Architecture:**

- **One pure settings module** (Task 1) defines missing values, effective connection settings, the Test-database rule and the local-host allowlist. Both the e2e resolver and the seeder use it.
- **A Jest `setupFiles` module and a `globalSetup`** resolve and publish the E2E target (Tasks 2 and 5). `globalSetup` also provisions it: it creates the database through its single maintenance connection, then migrates it through the TypeORM CLI.
- **A two-stage guard** patched onto TypeORM's public `DataSource` class in `setupFiles` (Tasks 4 and 7) covers the Nest application, the helper and scratch connections, with no per-site checks.
- **The seeder** is split into a pure config/guard layer, a DataSource-driven core and a thin CLI entrypoint (Tasks 9–11).

**Tech Stack:** NestJS 11, TypeORM 1.1.0 (`pg` 8.23), Jest 30 and ts-jest 29 (unit config rooted at `src`; e2e config `test/jest-e2e.json`), `dotenv` 17, `bcrypt` 6, GitHub Actions, Postgres 16.

**Spec:** `docs/superpowers/specs/2026-11-06-e2e-database-isolation-dev-owner-design.md`. Executors read the spec in full; section numbers below refer to it.

---

## Global Constraints

These are copied from the Accepted spec. Every task implicitly includes them.

- **Test-database rule:** `^(?=.{6,63}$)[a-z][a-z0-9_]*_test$`. The default E2E target is `clensy_test` (§4.1).
- **Local host allowlist:** exactly `localhost`, `127.0.0.1` and `postgres`. Case-insensitive, whole value. `::1`, suffixes and socket paths are rejected (§4.1, call 4).
- **Missing value:** unset, empty, or only whitespace. A missing value falls through to the next source and never reaches the driver (§4.1, call 13).
- **Effective settings:** host trimmed and non-empty; port a decimal integer from 1 to 65535; username trimmed and non-empty; database non-empty; password may be empty (§4.1).
- **E2E `DB_NAME`** comes from the launch environment only, never from a `.env` file (§4.2 item 1, invariant 2).
- **E2E connection settings:** each of `DB_HOST`, `DB_PORT`, `DB_USERNAME` and `DB_PASSWORD` comes from the launch environment, then `apps/api/.env`, then the defaults `localhost` / `5432` / `clensy` / `clensy_dev` (§4.2 item 2).
- **Guard stage 1, before any connection** (§4.5 item 1, invariant 3). Reject unless all of these hold:
  - `type === 'postgres'`;
  - no `url`;
  - no `replication`;
  - no `extra.database`;
  - no `extra.connectionString`;
  - no custom `driver`;
  - `database` is non-missing and passes the Test-database rule.
- **Guard stage 2, after connecting:** `SELECT current_database()` must equal the stage 1 name. Otherwise destroy and throw.
- **No application-code change.** `database.module.ts` stays untouched, even to avoid Nest's retries (§4.5 item 1, §7 note a).
- **Only one maintenance connection,** opened by `globalSetup` to `postgres`. It only checks for and creates the E2E target, and never opens inside a test environment (§4.4 item 2, invariant 1).
- **`CREATE`/`DROP DATABASE` in e2e code:** only on names generated by the same suite in the same run that pass the rule and differ from the E2E target. Scratch names are `clensy_migration_<32 lowercase hex>_test` (§4.5 item 2, invariant 4).
- **Activity queries:** each query over `pg_stat_activity` or `pg_locks`, taken as a whole, restricts what it observes to sessions of `current_database()` (§4.3 item 6, invariant 6).
- **Seeder guards, in order:** `NODE_ENV` (trimmed, lowercased) equals `production`; `ADMIN_SEED_EMAIL` or `ADMIN_SEED_PASSWORD` missing; invalid effective settings; host not on the allowlist; database passes the Test-database rule; Bootstrap tenant missing (checked after connecting) (§4.7).
- **Seeder lookup:** `toLowerCase()` with no trim; `lower(email) = $1` with a row lock; un-normalised or ambiguous matches fail. It writes only `passwordHash`, and only with `--reset-password`. bcrypt cost 10 (§4.7).
- **Seeder output:** outcome, id, database, host, and the source of each `ADMIN_SEED_*` value. On `unchanged`, `password: matches ADMIN_SEED_PASSWORD` or `password: differs from ADMIN_SEED_PASSWORD (run with --reset-password to apply it)`. Never an email, password, hash or salt (§4.7, invariant 9, call 12).
- **Never automatic:** nothing in `main.ts`, any module, `Dockerfile*`, `docker-compose.yml`, or `start`/`prestart`/`postinstall` scripts references either seeder (invariant 10).
- **Unchanged:** `pnpm db:seed` behaviour (invariant 11) and the CI job `name:` values (invariant 12).

## Review Focus

These are the failure modes the spec implies but that tests elsewhere do not cover. Each line names the task that adds the pinning test.

1. **A test file calls `jest.resetModules()`, `jest.isolateModules()` or `jest.mock('typeorm')`.** That gives it a `typeorm` instance without the guard. Expected: the static guard test forbids these in `apps/api/test/` (Task 7, Step 1).
2. **`ADMIN_SEED_EMAIL` contains capitals** (`Owner@Example.com`). Expected: stored and matched as `owner@example.com`; no duplicate row; the email never appears in output (Task 10, Step 1).
3. **A second e2e run reuses an already-migrated `clensy_test`.** Expected: `globalSetup` creates nothing, applies 0 migrations, confirms none pending, and the suites pass (Task 5, Step 1, the second-provision case).
4. **CI `DB_NAME` value has trailing whitespace** (`'clensy_test '`). Expected: the resolver rejects it, because the name contains whitespace and is not missing (Task 2, Step 1).
5. **The seeder runs from the repository root without `--filter`.** Then `cwd/.env` is the root `.env`. Expected: the same guards apply, and the output reports where each value came from. The entrypoint test pins that the `.env` location is derived from the working directory (Task 11, Step 1).

---

## File structure

| Path | Responsibility | Task |
| --- | --- | --- |
| `apps/api/src/platform/database/effective-connection-settings.ts` (new) | Pure helpers:<br>• rule constants;<br>• `isMissing`;<br>• layered resolution with a source for each value;<br>• validation.<br>Imports only Node built-ins and `dotenv` (for parsing). | 1 |
| `apps/api/src/platform/database/tests/effective-connection-settings.spec.ts` (new) | Unit tests for Task 1. | 1 |
| `apps/api/test/support/e2e-target.ts` (new) | `resolveE2eTarget`, `publishE2eTarget`, `readApiEnvFile`. | 2 |
| `apps/api/test/e2e-target.e2e-spec.ts` (new) | Resolver tests (pure; no database). | 2 |
| `apps/api/test/support/e2e-connection.ts` (new) | `e2eConnectionOptions` and `ScratchDatabases`. | 3 |
| `apps/api/test/support/datasource-guard.ts` (new) | `assertSafeDataSourceOptions`, `assertConnectedDatabase`, `installDataSourceGuard`. | 4 |
| `apps/api/test/datasource-guard.e2e-spec.ts` (new) | Guard tests: stage 1 zero-connection, stage 2, pass. | 4, 7 |
| `apps/api/test/support/provision-test-database.ts` (new) | `provisionTestDatabase`, `findPendingMigrations`. | 5 |
| `apps/api/test/support/provision-cli.ts` (new) | Child-process wrapper used by the `globalSetup` tests. | 5 |
| `apps/api/test/setup-e2e-env.ts` (new) | `setupFiles` module: resolve, publish, then install the guard (Task 7). | 5, 7 |
| `apps/api/test/global-setup.ts` (new) | Jest `globalSetup`: resolve, publish, provision. | 5 |
| `apps/api/test/jest-e2e.json` (modify) | Add `setupFiles` and `globalSetup`. | 5 |
| `apps/api/test/e2e-isolation.e2e-spec.ts` (new) | Ordering, `PG*` non-redirection, fail-closed child run, `globalSetup` child runs. | 5 |
| `apps/api/test/e2e-static-guards.e2e-spec.ts` (new) | Static scans: no literal fallbacks or direct `DB_*` reads; activity-query scoping; module-registry hooks; never-automatic seeders. | 6, 7, 11 |
| 19 e2e specs plus `test/helpers/migration-db.ts` (modify) | Switch to `e2eConnectionOptions` / `ScratchDatabases`. The list is in Task 6. | 6 |
| `.github/workflows/ci.yml` (modify) | `clensy_test` in **Release gate** and **API e2e**; `migration:run` steps kept. | 8 |
| `apps/api/src/platform/database/dev-owner/dev-owner-config.ts` (new) | Argument parsing; guards 1–5; source tracking. | 9 |
| `apps/api/src/platform/database/tests/dev-owner-config.spec.ts` (new) | Unit tests for Task 9. | 9 |
| `apps/api/src/platform/database/dev-owner/dev-owner-seeder.ts` (new) | `seedDevOwner` core (guard 6, lookup, outcomes) and `formatDevOwnerResult`. | 10 |
| `apps/api/src/platform/database/tests/dev-owner-output.spec.ts` (new) | Output-format unit tests. | 10 |
| `apps/api/test/seed-dev-owner.e2e-spec.ts` (new) | Core tests against the Test database. | 10 |
| `apps/api/src/platform/database/seed-dev-owner.ts` (new) | CLI entrypoint (the path the spec names). | 11 |
| `apps/api/test/seed-dev-owner-cli.e2e-spec.ts` (new) | Entrypoint child-process tests: guard exits, no connection. | 11 |
| `apps/api/package.json`, `package.json` (modify) | `db:seed:dev-owner` scripts. | 11 |
| Three docs (modify) | §4.8 content. | 12 |

**Planning decision: the shared settings module lives in `src/`.** Task 1's module is pure. It imports no application module, entity or TypeORM, and reads no environment when it loads. Both the seeder (in `src/`) and the e2e resolver (in `test/`) need its rules, and one copy prevents drift between them. That satisfies §4.2's "MUST NOT import application code, TypeORM entities, or any module that reads `process.env` when it loads". M5 may ask for a copy in `test/` instead; that changes nothing normative.

---

## Resolved planning questions

**Migration-loading path (§4.4 item 3, note b): the TypeORM CLI in a child process.**
- `globalSetup` runs `pnpm run migration:run` with `cwd` = `apps/api` and the published effective settings as its environment.
- **Why:**
  - It is the same path as Compose `migrate` and the CI step (§3 item 14), and it applies exactly `src/platform/database/migrations/*.ts` through `data-source.ts`.
  - It avoids depending on Jest's transform to load `.ts` migrations in the parent process.
  - On a fresh database, the CLI's own `DataSource.initialize()` installs `uuid-ossp`, which the migrations need (`uuid_generate_v4()` in `1786761567733-AddAdminUser.ts` and others). The migrations do not create it themselves.
- **"None pending" is confirmed without loading TypeScript:** a pure comparison of migration file timestamps (filenames `<13-digit timestamp>-<Name>.ts`) against `SELECT "timestamp" FROM "migrations"` in the Test database.
- **Proof:** Task 5's child-process `globalSetup` tests.

**`nativeDriver` (M3 confirmation note): not rejected; a test pins the evidence.**
- **Evidence:**
  - `pg-native` is not installed in the workspace (`node_modules/.pnpm` holds no `pg-native*`).
  - TypeORM switches to it only when it loads and `pg.native` exists (`PostgresDriver.js:1348–1350`).
  - Even then, libpq receives the validated `database` as `dbname`. A name passing `^[a-z][a-z0-9_]*_test$` contains neither `=` nor a URI prefix, so libpq cannot reinterpret it as a connection string. An explicit `dbname` also wins over `PGDATABASE`/`PGSERVICE`.
- **Why not reject it:** the switch cannot change the target. Adding a rejection would extend the Accepted stage 1 contract, which a plan must not do (planning instruction 4).
- **Pinning:** Task 4 adds a test asserting `pg-native` is not resolvable from `apps/api`. If someone installs it, that test fails, and this decision returns to M3 as a spec amendment.

**Running the seeder against `clensy`** is not part of M6. #227 says the owner seeds the development owner after the merge, and that #209 then verifies it read-only. The seeder's happy path is proven against the Test database, through the core (Task 10). The CLI is proven for its refusal paths (Task 11).

---

## Slice A: E2E database isolation (Tasks 1–8)

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
  - `export function resolveLayered(key: string, layers: readonly [EnvSource, EnvSource], fallback: string | undefined): { value: string | undefined; source: ValueSource }` (`layers[0]` = launch environment, `layers[1]` = `apps/api/.env`)
  - `export function isTestDatabaseName(name: string): boolean`
  - `export function isLocalHost(host: string): boolean` (trimmed, case-insensitive, whole value)
  - `export function validateEffectiveSettings(input: { host?: string; port?: string; username?: string; password?: string; database?: string }): EffectiveConnectionSettings` (throws `InvalidConnectionSettingsError` naming the key, never the password)
  - `export class InvalidConnectionSettingsError extends Error`
  - `export function parseEnvFile(path: string): EnvSource` (`dotenv.parse` of the file, or `{}` if absent; never applied to `process.env`)

- [ ] **Step 1: Write the failing tests**
  - `isMissing`: `undefined`, `''`, `'   '` and `'\t'` → `true`; `'a'` → `false`.
  - `isTestDatabaseName`:
    - accepts `clensy_test`, `a_test`, `feature_x_test`, and a 63-byte name ending `_test`;
    - accepts `clensy_migration_` + 32 hex + `_test` (54 bytes);
    - rejects `clensy`, `clensy_test2`, `Clensy_test`, `clensy-test`, `_test`, `' clensy_test'`, `'clensy_test '`, `clensy"_test`, `clénsy_test`, and a 64-byte name.
  - `isLocalHost`:
    - accepts `localhost`, `LOCALHOST`, `127.0.0.1` and `postgres`;
    - rejects `localhost.example.com`, `127.0.0.2`, `::1`, `/var/run/postgresql` and `''`.
  - `resolveLayered`:
    - launch `'  '` with file `'db'` → `{ value: 'db', source: 'apps/api/.env' }`;
    - both missing → `{ value: fallback, source: 'default' }`;
    - launch `'x'` → `{ value: 'x', source: 'launch environment' }`.
  - `validateEffectiveSettings`:
    - ports `'abc'`, `'0'`, `'65536'`, `'5432.5'` and `'-1'` throw; `'5432'` gives `5432`;
    - an empty host, username or database throws;
    - an empty password is allowed;
    - error messages never contain the password value (assert using a sentinel password).
- [ ] **Step 2: Run it to verify it fails.** Run: `pnpm --filter api test -- effective-connection-settings`. Expected: FAIL, because the module does not exist.
- [ ] **Step 3: Implement the module** with the signatures above. No top-level side effects.
- [ ] **Step 4: Run it to verify it passes.** Same command. Expected: PASS.
- [ ] **Step 5: Commit** `test(api): add effective connection settings and the Test-database rule (#227)`

### Task 2: E2E target resolver (`code`)

Spec §4.2 items 1–5, §6 (e2e table).

**Files:**
- Create: `apps/api/test/support/e2e-target.ts`
- Test: `apps/api/test/e2e-target.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `export function readApiEnvFile(): EnvSource`: parses `resolve(__dirname, '../../.env')`, that is `apps/api/.env`, located relative to the test tree, not `cwd`.
  - `export function resolveE2eTarget(launchEnv: EnvSource, envFile: EnvSource): EffectiveConnectionSettings`:
    - `DB_NAME` comes from `launchEnv` only: missing → `clensy_test`; otherwise it must pass `isTestDatabaseName`, or it throws `E2eTargetError`, naming the value and the rule;
    - the other keys come through `resolveLayered`, with the §4.2 defaults;
    - then `validateEffectiveSettings`;
    - then `isLocalHost`, or it throws.
  - `export function publishE2eTarget(target: EffectiveConnectionSettings, env: NodeJS.ProcessEnv = process.env): void`: writes `DB_HOST` (trimmed), `DB_PORT` (as a decimal string), `DB_USERNAME`, `DB_PASSWORD` and `DB_NAME`.
  - `export class E2eTargetError extends Error`

- [ ] **Step 1: Write the failing tests.** These are pure; none connects.
  - Every e2e row of spec §6, as one test per row:
    - no `DB_NAME` with file `DB_NAME=clensy` → `clensy_test`;
    - `'   '` → `clensy_test`;
    - `clensy` → throws;
    - `feature_x_test` → `feature_x_test`;
    - a 70-character `…_test` → throws;
    - remote host → throws;
    - `DB_PORT=abc` → throws;
    - launch `DB_HOST=''` with `PGHOST` set in `launchEnv` and file `DB_HOST=localhost` → host `localhost`;
    - `PGDATABASE=clensy` with no `DB_NAME` → `clensy_test`;
    - CI env `DB_NAME=clensy_test` with an empty file → `clensy_test`.
  - Whitespace: `'clensy_test '` throws (Review Focus 4).
  - The file's `DB_NAME=feature_test` is ignored when launch `DB_NAME` is missing → `clensy_test`.
  - Precedence for each of `DB_HOST`, `DB_PORT`, `DB_USERNAME` and `DB_PASSWORD`: launch beats file, and file beats default.
  - `publishE2eTarget` writes exactly the five keys into a supplied object.
- [ ] **Step 2: Run it to verify it fails.** Run: `pnpm --filter api test:e2e -- e2e-target.e2e-spec`. Expected: FAIL, because the module does not exist. No database is touched.
- [ ] **Step 3: Implement** the signatures above.
- [ ] **Step 4: Run it to verify it passes.** Same command. Expected: PASS.
- [ ] **Step 5: Commit** `test(api): resolve the e2e target from the launch environment (#227)`

### Task 3: Connection helper and scratch databases (`code`)

Spec §4.2 ("Single connection helper"), §4.5 item 2, invariant 4.

**Files:**
- Create: `apps/api/test/support/e2e-connection.ts`
- Test: `apps/api/test/e2e-connection.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 1 and Task 2 (`resolveE2eTarget`).
- Produces:
  - `export function e2eTarget(): EffectiveConnectionSettings`: reads the **published** `process.env.DB_*`. It throws if `DB_NAME` is not a Test database. It never applies defaults: if values are missing, setup did not run, and it throws.
  - `export function e2eConnectionOptions(database?: string): PostgresConnectionOptions`: `{ type: 'postgres', host, port, username, password, database: database ?? e2eTarget().database }`. It throws if `database` is given and fails `isTestDatabaseName`.
  - `export class ScratchDatabases`:
    - `generate(): string` returns `clensy_migration_${32 lowercase hex}_test` and records it;
    - `create(admin: DataSource, name: string): Promise<void>`;
    - `drop(admin: DataSource, name: string): Promise<void>` (`DROP DATABASE IF EXISTS`).
    - `create` and `drop` throw before any statement unless the name was produced by this instance's `generate()`, passes the rule, and differs from `e2eTarget().database`.

- [ ] **Step 1: Write the failing tests**
  - `generate()` matches `^clensy_migration_[0-9a-f]{32}_test$` and is 54 bytes long.
  - `create` and `drop` reject, without issuing any statement, each of these:
    - a name not generated by this instance;
    - `clensy_test` (the E2E target);
    - `clensy`;
    - a `generate()` result from a **different** instance.
    
    Use a stub `admin` whose `query` records calls, and assert zero calls.
  - `e2eConnectionOptions('clensy')` throws.
  - `e2eConnectionOptions()` returns the published target.
  - `e2eTarget()` throws when `DB_NAME` is unset in `process.env` (save and restore it inside the test).
- [ ] **Step 2: Run it to verify it fails.** Run: `pnpm --filter api test:e2e -- e2e-connection.e2e-spec`. Expected: FAIL. Until Task 5 adds `setupFiles`, this file publishes the target itself in `beforeAll`, with `publishE2eTarget(resolveE2eTarget(process.env, readApiEnvFile()))`. It needs no database: `admin` is a stub.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run it to verify it passes.** Same command. Expected: PASS.
- [ ] **Step 5: Commit** `test(api): add the e2e connection helper and scratch database registry (#227)`

### Task 4: Two-stage DataSource guard, standalone (`code`)

Spec §4.5 item 1, invariant 3, §7 (stage 1, stage 2, pass), the M3 `nativeDriver` note.

**Files:**
- Create: `apps/api/test/support/datasource-guard.ts`
- Test: `apps/api/test/datasource-guard.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 1 (`isMissing`, `isTestDatabaseName`). This task needs no real database. The stage 2 integration, pass and idempotence cases, which do, are in Task 7, after Task 5 has provisioned `clensy_test`.
- Produces:
  - `export function assertSafeDataSourceOptions(options: DataSourceOptions): string`: returns the validated name, or throws `UnsafeDataSourceError` naming the failed condition. It checks, in this order:
    1. `type === 'postgres'`;
    2. `url` is unset;
    3. `replication` is unset;
    4. `extra?.database` is unset;
    5. `extra?.connectionString` is unset;
    6. `driver` is unset;
    7. `database` is a non-missing string passing `isTestDatabaseName`.
  - `export function assertConnectedDatabase(expected: string, actual: unknown): void`: throws `UnsafeDataSourceError` unless `actual === expected`.
  - `export function installDataSourceGuard(DataSourceClass: typeof DataSource = DataSource): void`. Idempotent: it marks the prototype with a `Symbol.for('clensy.e2eDataSourceGuard')`. It replaces `DataSourceClass.prototype.initialize` with a wrapper that:
    1. calls `assertSafeDataSourceOptions(this.options)` **before** calling the original;
    2. awaits the original;
    3. runs `SELECT current_database() AS name` through `this.query`;
    4. calls `assertConnectedDatabase`;
    5. on failure, `await this.destroy()` and rethrows;
    6. returns `this`.
  - `export class UnsafeDataSourceError extends Error`

- [ ] **Step 1: Write the failing tests.** The file calls `installDataSourceGuard()` itself in `beforeAll`; from Task 7 on, `setupFiles` does this, and idempotence makes the repeat harmless.
  - **Zero-connection harness.** Start a `net.createServer` listener on `127.0.0.1:0`. It counts `connection` events and immediately destroys each socket. Every stage 1 case targets that host and port, and asserts `initialize()` rejects with `UnsafeDataSourceError` **and** the count is `0`.
  - **Stage 1 cases**, each a `new DataSource({...})` pointed at the listener:
    - `database: 'postgres'`;
    - `database: 'clensy'`;
    - `database: undefined`;
    - `database: '  '`;
    - `type: 'mysql'` with a valid name;
    - `url: 'postgres://u:p@127.0.0.1:<listenerPort>/clensy_test'`;
    - `replication: { master: {...listener, database: 'clensy_test'}, slaves: [] }`;
    - `database: 'clensy_test', extra: { database: 'clensy' }`;
    - `database: 'clensy_test', extra: { connectionString: 'postgres://u:p@127.0.0.1:<listenerPort>/clensy' }`;
    - `database: 'clensy_test', driver: recordingDriverStub`. The stub is an object shaped like `pg`, whose `Pool` constructor and `connect` increment a counter. Assert that counter is `0` as well as the listener count.
  - **Stage 2 (pure):** `assertConnectedDatabase('clensy_test', 'clensy')` throws; `('clensy_test', 'clensy_test')` passes.
  - **`nativeDriver` evidence pin:** `expect(() => require.resolve('pg-native', { paths: [apiRoot] })).toThrow()`. A comment cites this plan's "Resolved planning questions".
  - **Idempotence marker:** after two `installDataSourceGuard()` calls, `DataSource.prototype.initialize` is the same function both times.
- [ ] **Step 2: Run it to verify it fails.** Run: `pnpm --filter api test:e2e -- datasource-guard.e2e-spec`. Expected: FAIL, because the module does not exist.
- [ ] **Step 3: Implement** the signatures above. The wrapper must not open any connection before `assertSafeDataSourceOptions` returns. `new DataSource()` only loads the driver module; it connects in `initialize()` (`DataSource.js:137`).
- [ ] **Step 4: Run it to verify it passes.** Same command. Expected: PASS. Every stage 1 case has listener count `0`, and stub count `0`.
- [ ] **Step 5: Commit** `test(api): add the two-stage e2e DataSource guard (#227)`

### Task 5: Resolve, publish and provision in Jest setup (`code`)

Spec §4.2 (ordering contract), §4.4 items 1–6, invariant 1, §7 (ordering, `PG*`, fail-closed, `globalSetup`).

**Files:**
- Create: `apps/api/test/setup-e2e-env.ts`, `apps/api/test/global-setup.ts`, `apps/api/test/support/provision-test-database.ts`, `apps/api/test/support/provision-cli.ts`, `apps/api/test/e2e-isolation.e2e-spec.ts`
- Modify: `apps/api/test/jest-e2e.json`: add `"setupFiles": ["<rootDir>/setup-e2e-env.ts"]` and `"globalSetup": "<rootDir>/global-setup.ts"`.

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces:
  - `setup-e2e-env.ts`, top level: `publishE2eTarget(resolveE2eTarget(process.env, readApiEnvFile()))`. The guard is added in Task 7. It imports nothing else.
  - `global-setup.ts`: `export default async function globalSetup(): Promise<void>`. It resolves and publishes into the parent's `process.env`, then calls `provisionTestDatabase(target)` and logs `e2e target <db>@<host>:<port>: created=<bool>, applied=<n>, pending=0`.
  - `provision-test-database.ts`:
    - `export function migrationFileTimestamps(dir: string): string[]`: the 13-digit prefixes of `*.ts` files in `src/platform/database/migrations`.
    - `export function findPendingMigrations(fileTimestamps: readonly string[], appliedTimestamps: readonly string[]): string[]`
    - `export async function provisionTestDatabase(target: EffectiveConnectionSettings, run: MigrationRunner = runMigrationCli): Promise<{ created: boolean; applied: number }>`. In order:
      1. a `pg.Client` maintenance connection to database `postgres`, with the target's credentials;
      2. `SELECT 1 FROM pg_database WHERE datname = $1`;
      3. if absent, `CREATE DATABASE "<name>"`, treating `42P04` (duplicate database) as success;
      4. close the client;
      5. count the `migrations` rows before;
      6. `run(target)`;
      7. count again, and work out pending with `findPendingMigrations`;
      8. throw `ProvisionError` naming the step, the database and the host if anything is pending or any step failed. It never includes the password.
    - `export type MigrationRunner = (target: EffectiveConnectionSettings) => Promise<void>`
    - `export const runMigrationCli: MigrationRunner`: `spawn('pnpm', ['run', 'migration:run'], { cwd: apiRoot, env: { ...process.env, DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME } })`. Non-zero exit → throw.
  - `provision-cli.ts`: resolves from `process.env` plus the file, calls `provisionTestDatabase`, prints the result as JSON on stdout, and sets the exit code. It is run with `node -r ts-node/register -r tsconfig-paths/register`.

- [ ] **Step 1: Write the failing tests** in `e2e-isolation.e2e-spec.ts`:
  - **Ordering** (Review Focus 3 covered too):
    - inside this suite, with `apps/api/.env` saying `clensy`, `ConfigService.get('DB_NAME')` from `Test.createTestingModule({ imports: [AppConfigModule] })` equals the published target;
    - `(await import('../src/platform/database/data-source')).default.options.database` equals it;
    - a helper `DataSource`'s `current_database()` equals it.
  - **`PG*` non-redirection:** set `process.env.PGHOST='db.invalid'`, `PGPORT='1'`, `PGDATABASE='clensy'` and `PGUSER='nobody'` for the test, then restore them. A helper `DataSource` still connects, and `current_database()` equals the target.
  - **Fail-closed:** spawn `pnpm exec jest --config test/jest-e2e.json test/e2e-target.e2e-spec.ts` with `DB_NAME=clensy`, and `DB_HOST=127.0.0.1` / `DB_PORT=<counting listener port>`. Expect: non-zero exit, stderr containing the `E2eTargetError` message, and listener count `0`.
  - **`globalSetup`, through the child `provision-cli.ts`** with a generated `DB_NAME` (from `ScratchDatabases.generate()`):
    - the first run gives `created: true, applied: 30`, or the count of migration files;
    - a second run gives `created: false, applied: 0`;
    - `afterAll` drops it through `ScratchDatabases.drop` on an admin `DataSource` built with `e2eConnectionOptions()`.
  - **Pending detection** (pure):
    - `findPendingMigrations(['1','2'], ['1'])` gives `['2']`;
    - `provisionTestDatabase` with a no-op `run` against a fresh generated database fails with `ProvisionError` mentioning pending migrations, and the message does not contain the target's password. Drop that database afterwards.
- [ ] **Step 2: Run it to verify it fails.** Run: `pnpm --filter api test:e2e -- e2e-isolation.e2e-spec`. Expected: FAIL. The ordering test sees `clensy`, and the modules do not exist.
- [ ] **Step 3: Implement** the signatures above and update `jest-e2e.json`.
- [ ] **Step 4: Run it to verify it passes.** Same command. Expected: PASS. The `globalSetup` log shows `created=true` on a machine without `clensy_test`; on later runs it shows `created=false, applied=0, pending=0`.
- [ ] **Step 5: Commit** `test(api): resolve, publish and provision the e2e test database in Jest setup (#227)`

> **State after Task 5:** every suite already reaches `clensy_test`, because published `DB_*` beat both the `?? 'clensy'` fallbacks and `ConfigModule`'s file. The guard is not installed yet, so the migration suites' un-suffixed scratch names still work until Task 6.

### Task 6: Move every e2e connection onto the helper (`code`)

Spec §4.2 ("Single connection helper"), §4.5 item 2, invariants 2, 4 and 6, §7 static guards.

**Files:**
- Modify (raw `DataSource` construction → `...e2eConnectionOptions()`, entities kept):
  - `admins.service.e2e-spec.ts`
  - `admins.service.disable-concurrency.e2e-spec.ts`
  - `billing.service.e2e-spec.ts`
  - `bookings.service.e2e-spec.ts`
  - `catalog.service.e2e-spec.ts`
  - `cleaners-teams.service.e2e-spec.ts`
  - `customers-properties.service.e2e-spec.ts`
  - `jobs.service.e2e-spec.ts`
  - `laundry.service.e2e-spec.ts`
  - `remove-test-tenants.e2e-spec.ts`
- Modify (admin `DataSource(e2eConnectionOptions())`; `const scratch = new ScratchDatabases(); const database = scratch.generate();`; `scratch.create(admin, database)` / `scratch.drop(admin, database)` replacing the raw `CREATE`/`DROP DATABASE`; scratch `DataSource` from `e2eConnectionOptions(database)`):
  - `add-booking-tenant.migration.e2e-spec.ts`
  - `add-catalog-tenant.migration.e2e-spec.ts`
  - `add-customer-property-tenant.migration.e2e-spec.ts`
  - `add-job-checklist-tenant.migration.e2e-spec.ts`
  - `add-laundry-billing-tenant.migration.e2e-spec.ts`
  - `add-laundry-line-description.migration.e2e-spec.ts`
  - `add-team-cleaner-tenant.migration.e2e-spec.ts`
  - `add-tenant-and-admin-scope.migration.e2e-spec.ts`
  - `add-tenant-label-overrides.migration.e2e-spec.ts`
  - `create-payments.migration.e2e-spec.ts`
- Modify: `test/helpers/migration-db.ts`. Delete `connectionOptions`, keep `migrationsBefore`, and update its callers.
- Create: `apps/api/test/e2e-static-guards.e2e-spec.ts`

**Interfaces:**
- Consumes: Task 3.

- [ ] **Step 1: Write the failing static guard tests** over every `*.ts` under `apps/api/test/`, excluding `test/support/**`, `setup-e2e-env.ts` and `global-setup.ts`:
  - No file matches `process\.env\.DB_[A-Z]+`.
  - No file matches `\?\?\s*'clensy'`.
  - No file contains `CREATE DATABASE` or `DROP DATABASE` outside `test/support/`.
  - **Activity-query scoping (characterization, see below):** every string literal or template containing `pg_stat_activity` or `pg_locks` also contains `current_database()`, taken over the whole query text.
- [ ] **Step 2: Run it to verify it fails.** Run: `pnpm --filter api test:e2e -- e2e-static-guards`. Expected: FAIL. The first three checks list the 20 files above. The activity-query check passes already, because it is a characterization test.
- [ ] **Step 3: Rewrite the 20 files** as listed. Behaviour stays the same apart from the target and the scratch-name suffix.
- [ ] **Step 4: Run it to verify it passes.** Run: `pnpm --filter api test:e2e -- e2e-static-guards`, then `pnpm --filter api test:e2e -- --testPathPatterns 'migration.e2e-spec|service.e2e-spec|remove-test-tenants'`. Expected: PASS for both.
- [ ] **Step 5: Characterization run, outside the commit.**
  - **Break:** make one activity query in `payments.concurrency.e2e-spec.ts` observe sessions of all databases.
  - **Expected to fail:** the activity-query scoping test in `e2e-static-guards.e2e-spec.ts`.
  - Revert the break, record the run in the M6 notes, and do not commit it.
- [ ] **Step 6: Commit** `test(api): route every e2e connection through the e2e target helper (#227)`

### Task 7: Install the guard and prove coverage of every DataSource path (`code`; gate G6)

Spec §4.5 item 1, invariant 3, §9 G6, §7 (Nest retry, note a), Review Focus 1.

**Files:**
- Modify: `apps/api/test/setup-e2e-env.ts`: after publishing, `installDataSourceGuard()` from Task 4.
- Modify: `apps/api/test/datasource-guard.e2e-spec.ts`: add the coverage cases below. Remove its own `installDataSourceGuard()` call from Task 4, so that coverage comes from `setupFiles`.
- Modify: `apps/api/test/e2e-static-guards.e2e-spec.ts`

**Interfaces:**
- Consumes: Tasks 4–6.

- [ ] **Step 1: Write the failing tests**
  - **Static (Review Focus 1):** no file under `apps/api/test/` contains `jest.resetModules`, `jest.isolateModules`, or `jest.mock('typeorm'` / `jest.mock("typeorm"`.
  - **Coverage: Nest application path.**
    - Set `process.env.DB_NAME = 'clensy'` and `DB_PORT` to the counting listener's port, saving and restoring both.
    - Build `Test.createTestingModule({ imports: [AppConfigModule, DatabaseModule] }).compile()`.
    - Expect a rejection whose cause chain includes `UnsafeDataSourceError`, and listener count `0`.
    - Test timeout `60_000`. `@nestjs/typeorm` retries 9 times, 3000 ms apart (`typeorm.utils.js:123`), so it fails after about 24 s. **Do not change `database.module.ts`.**
  - **Coverage: helper path.** A `new DataSource({ ...e2eConnectionOptions(), database: 'clensy', host: '127.0.0.1', port: listenerPort })` rejects with count `0`, with no explicit install in this file.
  - **Coverage: scratch path.** `new DataSource(e2eConnectionOptions(scratch.generate()))` passes stage 1. Connecting fails, because the database does not exist; assert the error is **not** `UnsafeDataSourceError`. `new DataSource({ ...e2eConnectionOptions(), database: 'clensy_migration_' + hex })`, with no suffix, rejects with count `0`.
  - **Pass:** `new DataSource(e2eConnectionOptions())` initialises, `isInitialized` is `true`, and exactly one `current_database()` query is recorded by a `query` spy. That also proves the double install (`setupFiles` plus any explicit call) does not double-wrap.
  - **Stage 2 integration:** on a Test-database `DataSource` whose `query` is spied to return `[{ name: 'other_test' }]` once, `initialize()` rejects with `UnsafeDataSourceError` and leaves `isInitialized === false`, because the guard destroyed it.
  - **Coverage: whole suite.** The full `pnpm --filter api test:e2e` run in Step 4 is the proof that every existing suite initialises under the guard.
- [ ] **Step 2: Run it to verify it fails.** Run: `pnpm --filter api test:e2e -- datasource-guard.e2e-spec e2e-static-guards`. Expected: FAIL, because without the `setupFiles` install the Nest and helper coverage cases connect.
- [ ] **Step 3: Implement.** Add one line to `setup-e2e-env.ts`.
- [ ] **Step 4: Run it to verify it passes.** First `pnpm --filter api build:graphiql`, which a fresh checkout needs; then `pnpm --filter api test:e2e`. Expected: every suite passes, the coverage cases report count `0`, and the release gate passes.
- [ ] **Step 5: G6 gate.** If the Nest-path coverage case cannot be made to pass with a `setupFiles` hook on the public `DataSource` class and no application-code change, **stop M6**. Record the failure, and return the slice to M2 (spec §9 G6). Do not substitute per-site checks, drop stage 1, or edit `database.module.ts`.
- [ ] **Step 6: Commit** `test(api): install the e2e DataSource guard for every connection (#227)`

### Task 8: CI parity (`code`)

Spec §4.6, invariant 12. This edits an in-repository workflow file. No live setting outside the repository changes: the required-checks ruleset is untouched and the job names are unchanged. So there is no `configuration` task, and no Configuration Change section.

**Files:**
- Modify: `.github/workflows/ci.yml`, in jobs `release-gate` and `api-e2e` only:
  - `env.DB_NAME: clensy_test`;
  - `services.postgres.env.POSTGRES_DB: clensy_test`;
  - `--health-cmd "pg_isready -U clensy -d clensy_test"`.
  
  Keep `- run: pnpm --filter api migration:run` in both jobs, before the e2e command. Leave the `name:` values unchanged.

- [ ] **Step 1: Make the edit.**
- [ ] **Step 2: Verify locally.** Run: `git diff .github/workflows/ci.yml`. Expected: only the six value changes (three per job); both `migration:run` lines are present; both `name:` lines are unchanged.
- [ ] **Step 3: Verify in CI** (after the M6 push). Expected: **Release gate** and **API e2e** are green, and each job log shows `migration:run`, then `e2e target clensy_test@localhost:5432: created=false, applied=0, pending=0`.
- [ ] **Step 4: Commit** `ci: run the e2e jobs against clensy_test (#227)`

---

## Slice B: Development owner seeder (Tasks 9–11)

Slice B depends on Task 1. It also needs Tasks 3, 5 and 7 for its e2e tests against the Test database. It shares Slice A's acceptance evidence (Task 13).

### Task 9: Seeder configuration and guards 1–5 (`code`)

Spec §4.7 (invocation, effective settings, guards 1–5), call 5, call 13, note e.

**Files:**
- Create: `apps/api/src/platform/database/dev-owner/dev-owner-config.ts`
- Test: `apps/api/src/platform/database/tests/dev-owner-config.spec.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `export function parseDevOwnerArgs(argv: readonly string[]): { resetPassword: boolean }`: accepts `[]` or `['--reset-password']`; anything else throws `DevOwnerRefusal('unknown argument …')`.
  - `export interface DevOwnerConfig { settings: EffectiveConnectionSettings; email: string; password: string; emailSource: ValueSource; passwordSource: ValueSource }`. `email` is already `toLowerCase()`d.
  - `export function resolveDevOwnerConfig(launchEnv: EnvSource, envFile: EnvSource): DevOwnerConfig`. It applies the guards in spec order, throwing `DevOwnerRefusal` on the first failure:
    1. `NODE_ENV`, resolved in layers like every other key (launch, then file; spec §4.7 "launch-environment values win"), trimmed and lowercased, equals `production`;
    2. `ADMIN_SEED_EMAIL` or `ADMIN_SEED_PASSWORD` missing at both layers;
    3. the effective settings fail `validateEffectiveSettings`. `DB_NAME` is layered too: launch, then file, then default `clensy`;
    4. `!isLocalHost(host)`;
    5. `isTestDatabaseName(database)`.
  - `export class DevOwnerRefusal extends Error`: its message never contains an email, password or hash.
  - `export function devOwnerEnvFilePath(cwd: string = process.cwd()): string`, returning `resolve(cwd, '.env')` (note e).

- [ ] **Step 1: Write the failing tests**
  - Each guard rejects, and the order is checked: with `NODE_ENV=production` **and** a missing email, the production refusal is reported.
  - `NODE_ENV=' Production '` → refused.
  - Missing `ADMIN_SEED_PASSWORD='   '` → refused.
  - Launch `ADMIN_SEED_EMAIL=''` with the file value set → the file value, with `emailSource: 'apps/api/.env'`.
  - `DB_PORT=0` → refused.
  - `DB_HOST=::1` → refused.
  - `DB_NAME=clensy_test` exported → refused.
  - Launch `DB_NAME=''` with `PGDATABASE=clensy_test` and file `DB_NAME=clensy` → database `clensy`.
  - `ADMIN_SEED_EMAIL='Owner@Example.com'` → `email === 'owner@example.com'`.
  - `parseDevOwnerArgs(['--reset'])` throws.
  - No `DevOwnerRefusal` message contains the sentinel email or password (assert over every refusal case).
  - `devOwnerEnvFilePath('/x/apps/api') === '/x/apps/api/.env'`.
- [ ] **Step 2: Run it to verify it fails.** Run: `pnpm --filter api test -- dev-owner-config`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run it to verify it passes.** Same command. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): add dev owner seeder configuration and guards (#227)`

### Task 10: Seeder core and output (`code`)

Spec §4.7 (guard 6, lookup, behaviour table, password check, boundaries, output), invariants 7–9, calls 6, 8, 10 and 12, §6 (seeder table).

**Files:**
- Create: `apps/api/src/platform/database/dev-owner/dev-owner-seeder.ts`
- Test: `apps/api/test/seed-dev-owner.e2e-spec.ts` (the core, against the Test database) and `apps/api/src/platform/database/tests/dev-owner-output.spec.ts` (formatting)

**Interfaces:**
- Consumes: Task 9 (`DevOwnerConfig`, `ValueSource`); `AdminUserEntity`, `Role.TENANT_OWNER`, `AdminScope.TENANT`, `BOOTSTRAP_TENANT_ID`.
- Produces:
  - `export const DEV_OWNER_BCRYPT_ROUNDS = 10;`
  - `export type DevOwnerResult`, one of:
    - `{ outcome: 'created'; id: string }`
    - `{ outcome: 'unchanged'; id: string; password: 'matches' | 'differs' }`
    - `{ outcome: 'password reset'; id: string }`
    - `{ outcome: 'mismatch'; id: string; differing: readonly ('role' | 'scope' | 'tenantId' | 'isActive')[] }`
    - `{ outcome: 'not normalised' }`
    - `{ outcome: 'ambiguous'; count: number }`
    - `{ outcome: 'tenant missing' }`
  - `export async function seedDevOwner(dataSource: DataSource, input: { email: string; password: string; resetPassword: boolean; bootstrapTenantId?: string }): Promise<DevOwnerResult>`. The default tenant id is `BOOTSTRAP_TENANT_ID`; the parameter exists only so the "tenant missing" case can be tested. It runs in one transaction:
    - if the tenant is absent, return `tenant missing`;
    - `SELECT … FROM admin_user_entity WHERE lower(email) = $1 FOR UPDATE`;
    - then apply the behaviour table.
    
    Its only writes are an `INSERT` (with `created`), or `UPDATE … SET "passwordHash"` (with `password reset`). On `unchanged`, it compares the password with `bcrypt.compare`, read-only. A unique violation on insert propagates, and the transaction rolls back.
  - `export function formatDevOwnerResult(result: DevOwnerResult, context: { database: string; host: string; emailSource: ValueSource; passwordSource: ValueSource }): string`. One line, e.g. `dev-owner: unchanged id=<uuid> database=clensy host=localhost email-source=apps/api/.env password-source=apps/api/.env password: matches ADMIN_SEED_PASSWORD`.
    - `differs` uses the exact wording `password: differs from ADMIN_SEED_PASSWORD (run with --reset-password to apply it)` (spec §4.7).
    - Failures are prefixed `dev-owner: refused:` and give the id for `mismatch`, and the count for `ambiguous`.
  - `export function isFailure(result: DevOwnerResult): boolean`: true for `mismatch`, `not normalised`, `ambiguous` and `tenant missing`.

- [ ] **Step 1: Write the failing tests**
  - **e2e, using a `DataSource` from `e2eConnectionOptions()` with `AdminUserEntity` and `TenantEntity`**, each case with a generated email `dev-owner-<uuid>@example.com` and a random password. Each test deletes its own rows by id in `afterEach`.
    - **created:** the row has Bootstrap, `TENANT_OWNER`, `TENANT`, `isActive`; `bcrypt.getRounds(hash) === 10`.
    - **unchanged:** a second call → `unchanged`, `password: 'matches'`, and the hash is byte-identical (compared in the test, never printed).
    - **unchanged, `differs`:** a call with a different password → `password: 'differs'`, hash identical.
    - **mismatch:** one case each for role `FINANCE`, tenant = a `createTestTenant` tenant, and `isActive=false`, with no write (compare the full row before and after). Scope cannot differ alone, because the `CHECK` constraint ties it to the tenant, so it is covered together with `tenantId: null` and `scope: PLATFORM` → `differing` contains both.
    - **not normalised:** insert `Dev-Owner-<uuid>@example.com` through raw SQL; seeding the lowercase email → `not normalised`, no write (Review Focus 2).
    - **ambiguous:** insert two rows differing only in case → `ambiguous`, `count: 2`, no write.
    - **password reset:** with `resetPassword: true` on a correct row, only `passwordHash` changes; `bcrypt.compare(newPassword)` is true.
    - **reset with a mismatch:** `resetPassword: true` on a disabled row → `mismatch`, no write.
    - **reset with no row:** `resetPassword: true` and no row → `created` (call 6).
    - **tenant missing:** `bootstrapTenantId: randomUUID()` → `tenant missing`, no admin row written.
    - **boundaries:** before and after a `created` and a `password reset` run, row counts of every table except `admin_user_entity` are unchanged; `admin_user_entity` changes by exactly +1 / 0; and no other admin row's digest changes.
  - **Unit (`dev-owner-output.spec.ts`):** for every outcome, the line contains the outcome, the id or count, `database=`, `host=`, and both sources. The sentinel email, password and a sample bcrypt hash appear in **no** line. The `differs` line contains the exact spec wording.
- [ ] **Step 2: Run them to verify they fail.** Run: `pnpm --filter api test -- dev-owner-output` and `pnpm --filter api test:e2e -- seed-dev-owner.e2e-spec`. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them to verify they pass.** Same commands. Expected: PASS.
- [ ] **Step 5: Commit** `feat(api): add the dev owner seeder core (#227)`

### Task 11: Seeder entrypoint and scripts (`code`)

Spec §4.7 (invocation, "Never automatic", "Effective settings"), §2 (root alias, call 9), invariant 10, Review Focus 5.

**Files:**
- Create: `apps/api/src/platform/database/seed-dev-owner.ts`
- Modify:
  - `apps/api/package.json`: add `"db:seed:dev-owner": "ts-node -r tsconfig-paths/register src/platform/database/seed-dev-owner.ts"`.
  - Root `package.json`: add `"db:seed:dev-owner": "pnpm --filter api db:seed:dev-owner"`.
  - `apps/api/test/e2e-static-guards.e2e-spec.ts`
- Create: `apps/api/test/seed-dev-owner-cli.e2e-spec.ts`

**Interfaces:**
- Consumes: Tasks 9 and 10.
- Entrypoint, in this order:
  1. `parseDevOwnerArgs(process.argv.slice(2))`;
  2. `resolveDevOwnerConfig(process.env, parseEnvFile(devOwnerEnvFilePath()))`;
  3. build its own `new DataSource({ type: 'postgres', ...settings, entities: [AdminUserEntity, TenantEntity], installExtensions: false })` from the **validated** values only. It does not import `data-source.ts` or `AppModule`. `installExtensions: false` keeps every write inside `admin_user_entity`;
  4. `initialize`, `seedDevOwner`, `formatDevOwnerResult`, then print one line;
  5. `destroy` in `finally`;
  6. exit code `1` on `DevOwnerRefusal`, on an `isFailure` result, or on any error. Errors are printed as `dev-owner: error: <message>`, never with a stack containing input values.

- [ ] **Step 1: Write the failing tests**
  - **CLI (child process `pnpm --filter api db:seed:dev-owner`, `DB_HOST=127.0.0.1`, `DB_PORT=<counting listener>`):**
    - `NODE_ENV=production` → exit 1, `dev-owner: refused:`, listener count `0`;
    - `DB_NAME=clensy_test` → exit 1, count `0`;
    - `--bogus` → exit 1, count `0`;
    - `DB_HOST=db.example.com` → exit 1;
    - output never contains the sentinel email or password supplied through the env.
    
    For Review Focus 5, run the entrypoint directly, not through `pnpm --filter`, which would force `cwd` to `apps/api`. Use `node -r ts-node/register <abs path>/seed-dev-owner.ts`, with `TS_NODE_PROJECT=<abs>/apps/api/tsconfig.json`, and `cwd` set to a temporary directory holding a `.env` with `NODE_ENV=production`. Delete `NODE_ENV` from the child env: Jest sets it to `test`. The production refusal shows that the cwd `.env` was read and its value reached guard 1.
  - **Static never-automatic check (characterization for `seed.ts`):** `src/main.ts`, every file under `src/` except the two seeder entrypoints and `src/platform/database/dev-owner/**`, `Dockerfile`, `Dockerfile.web` and `docker-compose.yml` contain neither `seed-dev-owner` nor `seed.ts`/`/seed'`. The `start`, `prestart`, `start:prod`, `postinstall` and `prepare` scripts in both `package.json` files contain neither.
- [ ] **Step 2: Run them to verify they fail.** Run: `pnpm --filter api test:e2e -- seed-dev-owner-cli e2e-static-guards`. Expected: FAIL (no script).
- [ ] **Step 3: Implement** the entrypoint and both scripts.
- [ ] **Step 4: Run them to verify they pass.** Same command. Expected: PASS.
- [ ] **Step 5: Characterization run, outside the commit.**
  - **Break:** make the API's startup path invoke the existing `db:seed` entrypoint.
  - **Expected to fail:** the never-automatic check in `e2e-static-guards.e2e-spec.ts`.
  - Revert, record in the M6 notes, and do not commit.
- [ ] **Step 6: Commit** `feat(api): add the db:seed:dev-owner command (#227)`

---

## Slice C: Documentation and evidence (Tasks 12–13)

### Task 12: Documentation (`docs/process`)

Spec §4.8, §4.10, §9 G4/G5/G7. TDD does not apply. Verification is a content checklist plus a credentials scan.

**Files:**
- Modify: `docs/getting-started/local-development.md`, `docs/development/testing-and-ci.md`, `apps/api/README.md`

- [ ] **Step 1: Make `local-development.md` cover every §4.8 bullet:**
  - **The two databases:** both on one Compose server.
  - **e2e defaults:** e2e uses `clensy_test` by default and creates it.
  - **`DB_NAME`:** do not export it; check what Compose will use with `docker compose config | grep DB_NAME`.
  - **The mixed host/Docker table:** spec §4.3.
  - **`pnpm db:seed:dev-owner`:**
    - its first run, re-runs, `--reset-password` and the password check;
    - its output (outcome, id, sources; never the email);
    - the mismatch, un-normalised and ambiguous failures, each with manual resolution steps;
  - **The full `db:seed` effects:** it moves, re-scopes, re-roles, re-enables and re-hashes the owner, overriding the seeder's refusal; it is not a safe check.
  - **Stale or diverged `clensy_test` reset:** `dropdb -h localhost -p "$DB_PORT" -U "$DB_USERNAME" clensy_test`, or `docker compose exec postgres dropdb -U "$DB_USERNAME" clensy_test`. The next run recreates it, and the pending-migration check does not detect either case.
  - **The §4.10 residual risks.**
  
  Also correct the existing "Seed data" paragraph about the effects of re-running.
- [ ] **Step 2: Update `testing-and-ci.md`:**
  - replace "connect with the `DB_*` values in `apps/api/.env`" with the §4.2 rule;
  - remove the manual local `migration:run` prerequisite;
  - keep `migration:run` in the CI table, and add "then `globalSetup` confirms none pending".
- [ ] **Step 3: `apps/api/README.md`:** add `db:seed:dev-owner` to the command table, and note `clensy_test` beside `test:e2e`.
- [ ] **Step 4: Verify.**
  - Run: `grep -nE "clensy_test|db:seed:dev-owner|docker compose config|dropdb|moves|residual" docs/getting-started/local-development.md`. Expected: each §4.8 item is found.
  - Run: `git diff -U0 -- docs apps/api/README.md | grep -iE "password=|secret|@[a-z0-9-]+\.(com|dev)"`. Expected: no real credentials. Placeholder `example.com` only.
- [ ] **Step 5: Commit** `docs(227): document clensy_test and the dev owner seeder`

### Task 13: Acceptance evidence (`docs/process`)

Spec §4.5 item 4 (R8 snapshot modes), §7 (M6 evidence), #227 acceptance criteria. This task produces evidence only. Nothing is committed to the database, and the seeder is not run against `clensy`.

- [ ] **Step 1: Take the `clensy` "before" snapshot in `stopped` mode (the default).**
  - Run `docker compose stop api` and record `docker compose ps`; `api` must not be running.
  - All SQL below runs read-only:
    ```bash
    docker compose exec -T -e PGOPTIONS='-c default_transaction_read_only=on' \
      postgres psql -U "$DB_USERNAME" -d clensy -v ON_ERROR_STOP=1 -At -f - < <query file>
    ```
  - The queries:
    - **Activity:** `SELECT count(*) FROM pg_stat_activity WHERE datname = 'clensy' AND pid <> pg_backend_pid();` Expected: `0`.
    - **Row counts:** `SELECT table_name, (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY 1;`
    - **Digests:** `SELECT md5(coalesce(string_agg(t::text, '|' ORDER BY t.id), '')) FROM admin_user_entity t;` and the same for `audit_event_entity`.
  - The query file lives in the session scratchpad, not the repository.
- [ ] **Step 2: Run the full suite:** `pnpm --filter api build:graphiql && pnpm --filter api test:e2e`, then `pnpm --filter api test:e2e:release-gate`. Expected: PASS. The log shows `e2e target clensy_test@localhost:<port>`.
- [ ] **Step 3: Take the "after" snapshot,** the same as Step 1, including `docker compose ps` and the activity check. Expected: identical counts and digests, and activity `0` before and after.
  - Record "mode: `stopped`" and keep the outputs in the M6 record.
  - If stopping `api` is impractical, `idle` mode is permitted only with:
    - the reason recorded;
    - `pg_stat_activity` observations and the summed `n_tup_ins + n_tup_upd + n_tup_del` from `pg_stat_user_tables`, before and after;
    - the four spec limitations stated.
    
    Inconclusive `idle` evidence means repeating in `stopped` mode.
  - Run `docker compose start api` afterwards.
- [ ] **Step 4: CI-equivalent checks:** `pnpm run lint`, `pnpm --filter api exec tsc --noEmit`, `pnpm --filter web exec tsc --noEmit` and `pnpm run test`. Expected: all pass.
- [ ] **Step 5: Record the M6 Slice Completion Report** (reporting conventions). It contains:
  - the evidence above;
  - the two characterization runs (Tasks 6 and 11);
  - the G6 outcome (Task 7, Step 5);
  - the CI result (Task 8, Step 3).

---

## Implementation sequence and gates

1. **M5 Plan Review** must Accept this plan. Nothing starts before that.
2. **Slice A**, in order: Tasks 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8.
   - Tasks 1–4 are additive and leave existing suites unchanged.
   - Task 5 moves every suite onto `clensy_test`.
   - Task 6 must precede Task 7, because the guard would reject the old un-suffixed scratch names.
   - **Task 7 is the G6 gate:** if it fails, the slice stops and returns to M2.
3. **Slice B:** Tasks 9 → 10 → 11. Task 9 needs only Task 1; Tasks 10–11 need Tasks 3, 5 and 7.
4. **Slice C:** Task 12, then Task 13 last.
5. **Gates after M6:**
   - **M7:** fresh independent reviewer (`CLAUDE.md`), given the spec, this plan and the diff;
   - **M8:** refactoring, if any;
   - **M9:** documentation;
   - **M10:** workflow validation;
   - then a Slice Completion Report at each handoff.
   
   One PR for #227.
6. **After the merge (owner action, not this plan):** the owner runs `pnpm db:seed:dev-owner` against `clensy`. #209's own gate then verifies the account read-only.

## Traceability

| Spec requirement | Task(s) | Evidence |
| --- | --- | --- |
| §4.1 terms, rule (R2), allowlist, missing values (call 13) | 1 | Unit tests |
| §4.2 resolution, publication, single source, ordering | 2, 5 | Resolver tests; ordering test |
| §4.2 single connection helper; invariant 2 | 3, 6 | Static guard |
| §3 item 13 / invariant 5: no `PG*` redirection | 1, 2, 5, 9 | `PG*` tests |
| §4.3 mixed scenario; item 6 / invariant 6 activity scoping (N8, note d) | 5, 6, 12, 13 | Static characterization test; docs; snapshot |
| §4.4 maintenance connection, create, migrate, none pending (R4, R5), migration-loading path (note b) | 5 | Child-process `globalSetup` tests |
| §4.5 item 1: two-stage guard, `extra`/`driver` rejection (B1, rev. 4), no application change | 4, 7 | Zero-connection tests; Nest coverage |
| §4.5 item 2 / invariant 4: scratch names and `CREATE`/`DROP` limits | 3, 6 | `ScratchDatabases` tests; static guard |
| §4.5 item 3: Bootstrap never deleted | 6 (unchanged `removeTestTenants`) | Existing `remove-test-tenants` suite |
| §4.5 item 4 / R7, R8: snapshot, `stopped` default | 13 | Snapshot record |
| §4.6 / R5: CI `clensy_test`, `migration:run` kept, names unchanged | 8 | CI run |
| §4.7 guards 1–5, `.env` location (note e) | 9, 11 | Unit and CLI tests |
| §4.7 guard 6, lookup (N4), behaviour table, password check (call 12), output (N1), boundaries | 10 | Core e2e and output unit tests |
| §4.7 never automatic; invariant 10 | 11 | Static guard |
| §4.8 documentation; §4.10 residual risks (N2); G4 (R6); G5; G7 (N7, note c) | 12 | Content checklist |
| §9 G6 coverage proof; note a retries | 7 | Nest coverage test, 60 s timeout |
| Invariant 11 (`db:seed` unchanged) | All (no task edits `seed.ts`) | Diff shows `seed.ts` untouched |
| #227 "full e2e, release gate, CI-equivalent pass" | 7, 8, 13 | Runs |
| #227 "fresh independent M7" | Gate 5 | M7 record |

## Risks

- **G6 (Task 7):** an unknown path, in `@nestjs/typeorm` or nestjs-query, that builds a `DataSource` outside the patched prototype. Mitigation: the coverage tests plus the whole-suite run. Failing it means a return to M2, by rule.
- **Nest retry time:** the Nest coverage test takes about 24 s. Its 60 s timeout is local to that test.
- **CLI migration time:** `globalSetup` spawns `ts-node` once per e2e run, a few seconds even when nothing is pending. Accepted for parity with CI and Compose.
- **Child-process tests** need `pnpm` on `PATH` in CI. `pnpm/action-setup` provides it.
- **Concurrent runs:** two checkouts running e2e at once against one server share `clensy_test` and interfere. This is pre-existing (they shared `clensy` before) and out of scope.
- **Rollback:**
  - each task is a separate commit, so `git revert` restores the previous behaviour;
  - `clensy_test` can be dropped at any time (Task 12 procedure), and nothing depends on it;
  - no task alters `clensy`.

## Gate outcomes

*(Appended after M5.)*
