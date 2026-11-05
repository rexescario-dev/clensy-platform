# E2E Database Isolation & Development Owner Seeder — Specification

| Field | Value |
| --- | --- |
| **Status** | Draft — 2026-11-06 (M2). Awaiting Design Review (M3). |
| **Kind** | Architecture RFC: the contracts of the API's e2e test infrastructure and of one development-only command. This is not a process specification. |
| **Date** | 2026-11-06 |
| **Tracking** | [#227](https://github.com/rexescario-dev/clensy-platform/issues/227): isolate the e2e database and add a persistent dev `TENANT_OWNER` seeder |
| **Blocks** | [#209](https://github.com/rexescario-dev/clensy-platform/issues/209): browser verification of the invoice/payment UI. Its M6 browser pass needs a persistent, sign-in-able `TENANT_OWNER`. |
| **Depends on** | [Multi-Tenant Architecture](2026-09-23-multi-tenant-architecture-design.md) (Accepted). **Relied upon, not changed:** the Bootstrap tenant, `TENANT`-scoped admins, and the `admin_user_entity` scope/tenant `CHECK` constraints. [Required CI checks](2026-10-06-required-ci-checks-design.md) (Accepted). **Constrained by it:** the CI job names **Release gate** and **API e2e** are required checks and MUST NOT be renamed. |
| **Related (informative)** | [#226](https://github.com/rexescario-dev/clensy-platform/issues/226) (runtime `JWT_SECRET`; `apps/api/.env` out of the image). It does not affect this host-run seeder or the e2e target. |
| **Governing process** | [Standardized Agent Workflows](../../workflows/specs/agent-workflow-design.md), stage M2 |
| **Source-material note** | Built from the #227 ticket body, including its owner decisions of 2026-11-06, and from a read-only investigation of the repository on 2026-11-06 (§3). The owner skipped the brainstorming questions. They added one design requirement: the mixed host/Docker scenario must be addressed explicitly (§4.3). Every decision that is not in the ticket is an **author call**. §8 lists them for M3 to confirm or overturn. §9 lists the genuine gaps. |

---

## 1. Primary question & thesis

**Question:** Local e2e suites and manual browser verification share the `clensy` database, and the e2e suites truncate whole tables in it. How do we make `clensy` safe from e2e cleanup in every way a developer actually runs things: e2e on the host, with the API and web in Docker Compose or not? And how do we give the developer one persistent `TENANT_OWNER` they can sign in as, without disturbing anything else?

**Thesis:** Each e2e database name is resolved once, **before any application code loads**, by one shared resolver. The resolver never takes the name from an `.env` file. It uses the name in the launching environment if that name ends in `_test`. It defaults to `clensy_test` when none is set. Any other name **fails the run** before anything connects. The resolver writes the resolved `DB_*` values into `process.env`. Nest `ConfigModule` and `dotenv` both refuse to overwrite an existing variable, so every connection path then sees the same target: the Nest app, raw `DataSource`s, the TypeORM CLI data source, and the migration-suite admin connections. A Jest `globalSetup` creates and migrates that database. Every destructive cleanup checks `current_database()` against the `_test` rule before it writes. Compose keeps serving `clensy` and never sees `_test`. Separately, `pnpm db:seed:dev-owner` creates or verifies exactly one Bootstrap-tenant `TENANT_OWNER` from `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`. It changes a password only on `--reset-password`. If the existing account differs in any way, it fails closed with no writes.

---

## 2. Scope

### In scope (normative)

- **E2E target resolution:** a shared, application-free resolver used by a Jest `setupFiles` module and by the Jest `globalSetup` (§4.1, §4.2).
- **E2E database provisioning:** `globalSetup` creates the resolved database if it is missing and migrates it to the latest migration, idempotently (§4.4).
- **Confinement:** every e2e connection and every destructive cleanup path targets only a `_test` database. That covers `TRUNCATE`, `.clear()`, `DELETE`, the release-gate world teardown, `removeTestTenants`, the `seedTenantAdmin` helpers, and the migration suites' scratch databases (§4.5).
- **CI parity:** the **Release gate** and **API e2e** jobs use `DB_NAME=clensy_test` and `POSTGRES_DB=clensy_test` (§4.6).
- **Seeder:** `apps/api/src/platform/database/seed-dev-owner.ts`, the `api` script `db:seed:dev-owner`, and a root alias `pnpm db:seed:dev-owner` mirroring `pnpm db:seed` (§4.7).
- **Tests:** §7.
- **Documentation:** `docs/getting-started/local-development.md`, `docs/development/testing-and-ci.md` and `apps/api/README.md` describe `clensy_test`, the mixed host/Docker setup, and the development owner (§4.8). M9 owns the final wording. This spec fixes what the docs must say.

### Informative

- §3 records the investigation that motivates the design.
- §4.3 walks through the mixed host/Docker scenario.

### Out of scope (normative)

- **Any change to `pnpm db:seed`**, including its owner upsert (owner decision). §9 G4 notes how the two commands interact.
- **Any change to Compose, the Dockerfiles or the API's runtime database configuration.** `docker-compose.yml`, `Dockerfile`, `Dockerfile.web`, `database.module.ts` and the defaults in `data-source.ts` stay as they are. Their behaviour is relied upon (§4.3).
- **A runtime guard in the API that refuses a `_test` database.** See §9 G5.
- **Cleaning up existing leftovers in `clensy`.** The two `tenant-owner-<uuid>@example.com` rows and any other e2e residue stay. The seeder ignores them. Deleting them is a manual, owner-decided action.
- **Audit events for seeder operations** (owner decision).
- **A dedicated tenant for the development owner** (owner decision: the Bootstrap tenant).
- **New environment variables for seeder credentials** (owner decision: reuse `ADMIN_SEED_*`). One optional test-only input exists: the launching environment's `DB_NAME`, read by the e2e resolver. It is not a new variable.
- **Running e2e inside a container**, or adding a test stage to any image.
- **Parallel e2e workers**, or one database per worker. `maxWorkers: 1` stays.
- **A root `pnpm test:e2e` alias.** The command remains `pnpm --filter api test:e2e`. The ticket's `pnpm test:e2e` is shorthand for it (§8 call 9).

---

## 3. Investigation findings (2026-11-06, read-only)

These confirm the ticket's findings and add the facts that the mixed host/Docker scenario depends on.

1. **One Postgres server, one database today.** Compose's `postgres` service creates only `${DB_NAME}` (`clensy`, from the root `.env`) through `POSTGRES_DB`, and only when the volume is first initialised. The host reaches it at `localhost:${DB_PORT}`. Containers reach it at `postgres:5432`.
2. **Two env files say `DB_NAME=clensy`.** The root `.env` feeds Compose `${…}` substitution. `apps/api/.env` feeds the host-side API tools: Nest `ConfigModule` reads `process.cwd()/.env`, and `data-source.ts` runs `import 'dotenv/config'`. `.dockerignore` excludes only the root `.env`, so `apps/api/.env` is also **baked into the API image**. Compose's `environment:` block overrides `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD` and `DB_NAME` for `api` and `migrate`.
3. **Precedence is "existing environment wins" everywhere:**
   - `@nestjs/config` 4.0.4 `forRoot` merges `{...envFile, ...process.env}`. `assignVariablesToProcess` writes only keys **not already present** in `process.env`.
   - `ConfigService.get` consults `process.env` (`skipProcessEnv` is false).
   - `dotenv/config` does not override existing variables by default.
   - Compose substitution takes shell variables over the root `.env`.
4. **The e2e suites have two resolution paths today.** Suites that boot `AppModule` get `DB_*` from `apps/api/.env` through `ConfigModule`. About 25 suites and helpers build their own `DataSource` from `process.env.DB_* ?? <default>`, with a literal `'clensy'` fallback, and never load a `.env` file. They reach `clensy` only because the defaults happen to equal the file's values. Today `docs/development/testing-and-ci.md` says the suites "connect with the `DB_*` values in `apps/api/.env`". That is true only for the first path.
5. **Destructive paths.**
   - Whole-table: `TRUNCATE` in `admins.service`, `admins.service.disable-concurrency`, `bookings.service`, `customers-properties.service`, `laundry.service` and `billing.service`; `.clear()` on `audit_event_entity`.
   - Row-level: `DELETE` in `seed-tenant-admin.ts` (`removeTestTenants`, which skips the Bootstrap tenant), in the release-gate world teardown, and inside the migration suites.
   - The migration suites `CREATE DATABASE "clensy_migration_<hex>"` / `DROP DATABASE IF EXISTS` through an admin connection to `process.env.DB_NAME ?? 'clensy'`.
6. **Advisory locks are test-only and per-database.** The `*-db-test-lock.ts` helpers use `pg_advisory_lock`. Postgres scopes advisory locks to the current database, and no application code under `src/` takes one. So e2e locks in `clensy_test` cannot block the Compose API on `clensy`.
7. **E2E never binds a port.** No suite calls `app.listen`. Requests go through supertest in-process, so a host e2e run does not compete with the Compose `api` on 3000.
8. **Nothing reaches `clensy_test` from Compose.** `migrate` and `api` take `DB_NAME` only from Compose substitution.
9. **No seeder runs at startup.** The `Dockerfile` `CMD` is `node dist/main.js`. The `migrate` command is `pnpm run migration:run`. `main.ts` does not import `seed.ts`.
10. **`pnpm db:seed`** upserts the owner by email on every run. It re-hashes the password, forces `TENANT_OWNER`/`TENANT`/Bootstrap and re-enables the account. It also overwrites the booking fixtures.
11. **Unit tests (`pnpm test`) use no database.**

---

## 4. Design

### 4.1 Terminology

| Term | Meaning |
| --- | --- |
| **Development database** | The database Compose's `api`/`migrate` and the host tools (`db:seed`, `migration:run`, `db:seed:dev-owner`) use: `clensy` by default. |
| **Test database** | The database an e2e run targets. Its name MUST match `^[a-z][a-z0-9_]*_test$`. The default is `clensy_test`. |
| **Launch environment** | `process.env` as Jest receives it from the shell or CI, before any `.env` file is read. |
| **E2E target** | The resolved `{host, port, username, password, database}` of one e2e run. |
| **Local host allowlist** | `localhost`, `127.0.0.1`, `postgres`, compared case-insensitively against the whole trimmed value. Nothing else matches: no suffixes, no other loopback addresses, no socket paths. |
| **Development owner** | The single `admin_user_entity` row whose email is the normalised `ADMIN_SEED_EMAIL`. When **correctly configured**, it has: `tenantId = BOOTSTRAP_TENANT_ID`, `role = TENANT_OWNER`, `scope = TENANT`, `isActive = true`. |

### 4.2 E2E target resolution (normative)

One module (the **resolver**) produces the E2E target. It MUST NOT import application code, TypeORM entities, or any module that reads `process.env` when it loads. It is pure apart from reading one env file.

1. **Database name.** The resolver reads `DB_NAME` from the **launch environment only**.
   - If it is unset or empty, the name is `clensy_test`.
   - If it matches the Test-database pattern, that name is used.
   - **Anything else fails the run.** That includes `clensy`, `clensy_test2`, `Clensy_test`, `clensy-test`, names with whitespace or quotes, and `_test` on its own. The error names the rejected value and the rule.
   - The resolver never takes `DB_NAME` from `apps/api/.env` or the root `.env`, whatever value it holds.
2. **Connection settings.** `DB_HOST`, `DB_PORT`, `DB_USERNAME` and `DB_PASSWORD` come from the launch environment. A key that is missing there is taken from `apps/api/.env`. That file is located relative to the Jest config, not `cwd`, and is parsed without being applied wholesale. A key missing from both falls back to the defaults `data-source.ts` uses today (`localhost`, `5432`, `clensy`, `clensy_dev`).
3. **Host rule.** The resolved `DB_HOST` MUST be on the Local host allowlist. Otherwise the run fails (author call 2).
4. **Publication.** The resolver writes the five resolved values into `process.env`, so `ConfigModule`, `dotenv` and every raw read see exactly the E2E target (§3 item 3).
5. **Single source.** Both the `setupFiles` module and `globalSetup` call the resolver. Neither relies on the other having changed `process.env`.

**Ordering contract (Jest).**

- `globalSetup` runs once, in the parent process, before any test file. It MUST call the resolver *before* it loads `data-source.ts` or any migration, because `data-source.ts` reads `process.env` when it loads. So it loads them after resolution, for example with a dynamic `import`.
- `setupFiles` runs in every test file's environment before the test framework is installed and before the test file's own imports. It therefore runs before `AppModule`, `ConfigModule.forRoot` and every helper are evaluated.
- A resolver failure in either place stops the run before any test connects.

**Single connection helper.** E2E code builds connection options only through one shared test helper that reads the published E2E target. That covers raw `DataSource`s and the migration suites' admin connections. No e2e file may contain a literal database-name fallback such as `?? 'clensy'`, and no e2e file may read `process.env.DB_*` directly. A static guard test enforces both rules (§7).

### 4.3 Mixed host/Docker scenario (normative)

The supported arrangement: Compose runs `postgres`, `migrate`, `api` and `web`, and the developer signs in at `localhost:3001` for manual verification. At the same time, or between sessions, the developer runs `pnpm --filter api test:e2e` on the host. The two are not mutually exclusive.

| Actor | Where | Database name from | Host:port | Database |
| --- | --- | --- | --- | --- |
| `postgres` | container | root `.env` → `POSTGRES_DB` (first init only) | — | creates `clensy` |
| `migrate`, `api` | container | Compose `environment:` ← root `.env` / shell | `postgres:5432` | `clensy` |
| `web` | container | — (talks to API over HTTP at `localhost:3000`) | — | — |
| `db:seed`, `migration:run`, `db:seed:dev-owner` | host | `apps/api/.env` (unless the shell sets it) | `localhost:${DB_PORT}` | `clensy` |
| `jest --config test/jest-e2e.json` | host | launch env, or the `clensy_test` default; never a file | `localhost:${DB_PORT}` | `clensy_test` |

**Required properties:**

1. **Same server, different databases.** The e2e target and the development database may share one Postgres server. Every destructive statement e2e issues runs inside a connection whose `current_database()` is a Test database (§4.5). `TRUNCATE`, `DELETE` and advisory locks are all database-scoped. So no e2e statement can change or block a row in `clensy`, whatever Compose is doing.
2. **Container configuration is unchanged.** It already resolves to `clensy`:
   - Compose `environment:` overrides the `DB_*` values in the baked-in `apps/api/.env`.
   - A container never runs Jest.
   - If Jest were run in a container anyway, the resolver would still apply. `postgres` is on the allowlist, and the name rule is the same.
3. **The host e2e run never reads `DB_NAME` from a file.** So the shared `DB_NAME=clensy` in both `.env` files cannot reach e2e.
4. **Shell exports are the one cross-over risk:**
   - **`DB_NAME=clensy` exported in the shell** (for example after `set -a; . ./.env`): e2e **fails closed** with the resolver error. That is the intended outcome, and it satisfies the ticket's negative criterion.
   - **`DB_NAME=clensy_test` exported in the shell, then Compose or a host tool run from that shell:** those tools would target `clensy_test`. That is not destructive to `clensy`, but manual data or the development owner would land in a database e2e truncates. The seeder refuses it (§4.7, author call 5). The docs MUST tell developers not to export `DB_NAME` and to rely on the default. §9 G5 records that Compose and the API are not guarded.
5. **First run on an existing volume.** `clensy_test` does not exist. `globalSetup` creates it (§4.4). `docker compose down -v` deletes both databases. The next e2e run recreates `clensy_test`. Recreating `clensy` takes `docker compose up` (the `migrate` service) followed by the seeders.

### 4.4 Provisioning in `globalSetup` (normative)

1. It resolves the E2E target (§4.2).
2. It connects to the server's `postgres` maintenance database with the E2E target's credentials. It checks `pg_database` for the resolved name. If the name is absent, it issues `CREATE DATABASE` with the name quoted as an identifier. The name is already constrained by the pattern. If `CREATE DATABASE` loses a race, failing with "already exists", that counts as success.
3. It runs all pending migrations on the Test database, using the same migration set as `data-source.ts`. When none are pending, it makes no schema change: a repeated run is a no-op.
4. A failure stops the run with a message that names the step, the database name and the host. Failure cases: an unreachable server, no `CREATEDB` privilege, a migration error. The message never includes the password.
5. It never drops, truncates or resets the Test database. Suites keep owning their own cleanup.
6. The explicit `migration:run` steps in CI become redundant. Author call 7 removes them, so local runs and CI take the same path.

### 4.5 Confinement of destructive paths (normative)

1. Every destructive e2e cleanup path checks `SELECT current_database()` against the Test-database pattern before its first destructive statement. If the check fails, the path throws and writes nothing. The paths are listed in §3 item 5: whole-table `TRUNCATE`/`.clear()`, row-level `DELETE` in shared helpers and teardown, `removeTestTenants`, `seedTenantAdmin` cleanup, and the release-gate world teardown. The check runs once per `DataSource` or `QueryRunner`. It is implemented once, as a shared helper. This is defence in depth on top of §4.2.
2. **Migration scratch databases** are renamed to `clensy_migration_<hex>_test` (author call 3; 54 characters, under the 63-byte limit). After that, every database any e2e file writes to matches the same `_test` rule. Their admin connection uses the shared connection helper, so it targets the Test database. A scratch database is still created and dropped by the suite that owns it.
3. `removeTestTenants` keeps its rule that it never deletes the Bootstrap tenant.
4. Isolation from the development database is shown by evidence from a full local run (§7): the row counts of every table in `clensy`, and a content digest of `admin_user_entity` and `audit_event_entity`, are identical before and after the run. Capturing them is read-only.

### 4.6 CI parity (normative)

- **Release gate** and **API e2e**: job `env` `DB_NAME: clensy_test`. The service's `POSTGRES_DB: clensy_test`. The health-check `-d clensy_test`.
- Job `name:` values are unchanged (required checks).
- Both jobs exercise `globalSetup` (§4.4). With `POSTGRES_DB` set, it takes the "already exists, migrate" path. A dedicated test covers the "create if missing" path (§7).
- **Lint** and **Test** are unchanged.

### 4.7 `pnpm db:seed:dev-owner` (normative)

**Invocation:** `pnpm db:seed:dev-owner [--reset-password]`, from the root alias or the `api` script. It takes no other arguments. An unknown argument fails before connecting. It reads `apps/api/.env` the way `pnpm db:seed` does: launch-environment values win.

**Guards** are evaluated in this order. The first failure exits non-zero, before any write and, apart from step 3, before connecting.

1. `NODE_ENV`, trimmed and lowercased, equals `production` → reject.
2. `ADMIN_SEED_EMAIL` or `ADMIN_SEED_PASSWORD` missing or blank → reject. Unlike `db:seed`, which skips quietly, this command has no other purpose.
3. The resolved `DB_HOST` is not on the Local host allowlist → reject. The check uses the exact value that the connection options are built from, defaults included. So `PG*` environment variables, a socket path or a look-alike host (`localhost.example.com`, `127.0.0.2`, `::1`) cannot pass it (author call 4 on `::1`).
4. The resolved database name matches the Test-database pattern → reject (author call 5).
5. After connecting: the Bootstrap tenant row (`BOOTSTRAP_TENANT_ID`) does not exist → reject.

**Behaviour.** One transaction. The email is normalised with `toLowerCase()` and no trim, the same rule as `LoginService` and `db:seed` (§9 G3). The row is looked up by that email.

| State | No flag | `--reset-password` |
| --- | --- | --- |
| No row | Insert the development owner, correctly configured, with the password hashed (bcrypt, the same cost as `db:seed`). Outcome `created`. | Same as no flag (author call 6). |
| Row exists, correctly configured | No write. The hash is preserved byte for byte. Outcome `unchanged`. | Update only `passwordHash`, to a fresh hash of `ADMIN_SEED_PASSWORD`. Outcome `password reset`. |
| Row exists, differs in role, scope, tenant, or is disabled | Fail. Exit non-zero. No write. The message names which attribute(s) differ. | Same failure. The flag never repairs, moves, escalates or re-enables an account. |

**Boundaries.**

- It writes to `admin_user_entity` only, and only the development owner's row. It writes no audit event, and no customer, property, service, team, booking, payment, tenant or other administrator row.
- A unique-violation race on insert fails the run with no partial write. Re-running resolves it.
- **Output:** one line with the outcome, the database name and the host. It never contains the password, a hash or bcrypt salt material. Author call 8: it does not contain the email either. Errors follow the same rule.
- **Never automatic.** No reference from `main.ts`, any module, `Dockerfile`, `Dockerfile.web`, `docker-compose.yml`, or any `start`/`prestart`/`postinstall` script.
- **Testability.** The guards and the seeding core are separately callable. The guards are pure, over the environment and the parsed arguments, so they can be unit-tested. The core takes a connected `DataSource` and the inputs, so it can be e2e-tested against the Test database without passing guard 4.

### 4.8 Documentation (normative content)

- **`local-development.md`:** it explains:
  - the development and test databases on the one Compose server;
  - that e2e defaults to `clensy_test` and creates it on first run;
  - not to export `DB_NAME`;
  - the "Mixed host/Docker" table (§4.3);
  - `pnpm db:seed:dev-owner`: its first run, re-runs, `--reset-password`, and the mismatch failure and how to resolve it by hand;
  - that `pnpm db:seed` also upserts the same email (§9 G4).
- **`testing-and-ci.md`:** it corrects "connect with the `DB_*` values in `apps/api/.env`" to the §4.2 rule. It drops the manual `migration:run` prerequisite and updates the CI table.
- **`apps/api/README.md`:** it updates the command table.
- Credentials appear in none of them.

### 4.9 Invariants (MUST / MUST NOT)

1. An e2e run MUST NOT open a connection to a database whose name does not match the Test-database pattern. The one exception is the `postgres` maintenance connection used for `CREATE DATABASE` in `globalSetup` and by the migration suites, and that connection issues no DML.
2. No e2e code path MAY take `DB_NAME` from a `.env` file.
3. Every destructive e2e statement MUST run after a successful `current_database()` check.
4. The seeder MUST NOT change any column of an existing row except `passwordHash`, and only with `--reset-password`.
5. The seeder MUST NOT write when any guard fails or the account differs.
6. Seeder output MUST NOT contain secrets or hashes.
7. Nothing MAY run either seeder automatically.
8. `pnpm db:seed` behaviour MUST be unchanged.
9. The CI required-check job names MUST be unchanged.

---

## 5. Rationale

- **Name from the launch environment only, with a `_test` default.** This is the only rule that satisfies two ticket criteria at once: the default run works with no setup, and a non-`_test` `DB_NAME` fails. It also cannot be defeated by the shared `.env` files, which must keep `clensy` for Compose and the host tools. Deriving the name, for example `${DB_NAME}_test`, would read the file and tie the two databases together. A new variable was ruled out by the owner.
- **Publishing into `process.env`, not patching each consumer.** "Existing environment wins" holds for Nest, `dotenv` and Compose (§3 item 3). Setting the values once before anything loads therefore steers every path, including ones nobody has listed. The static guard and the `current_database()` check catch whatever slips through.
- **Two layers: the resolver, then a runtime check.** The resolver prevents a wrong target. The `current_database()` check proves the target at the point of harm. The ticket requires both prevention (criterion 1) and demonstration (criterion 3).
- **Scratch databases renamed to `…_test`.** One rule is easier to check than "`_test`, or the migration prefix".
- **Seeder separate from `db:seed`.** `db:seed` is a broad, resetting fixture loader by design, and the owner chose to keep it. The development owner needs the opposite: verify, never mutate.

---

## 6. Worked examples (informative)

| Launch env | `apps/api/.env` | Result |
| --- | --- | --- |
| no `DB_NAME` | `DB_NAME=clensy` | target `clensy_test` |
| `DB_NAME=clensy` | any | **run fails** before connecting |
| `DB_NAME=feature_x_test` | any | target `feature_x_test`, created if missing |
| `DB_HOST=db.prod.example.com`, `DB_NAME=x_test` | any | **run fails** (host rule) |
| CI: `DB_NAME=clensy_test` | none | target `clensy_test`, already exists → migrate |

| Seeder situation | Result |
| --- | --- |
| Fresh `clensy`, `ADMIN_SEED_*` set | `created` |
| Run again | `unchanged`; hash identical |
| Owner disabled through the console, run again | fail, "isActive differs", no write |
| `--reset-password` on a correct row | `password reset`; only the hash changes |
| `NODE_ENV=production` | fail before connecting |
| `DB_NAME=clensy_test` exported | fail before connecting |

---

## 7. Test expectations

Every test expectation listed in this spec is documented here and executed in M6.

- **Resolver unit tests:**
  - every row of the first table in §6;
  - every rejected name class in §4.2 step 1;
  - the host allowlist, accepted and rejected, including the look-alikes in §4.7;
  - proof that `DB_NAME` from the env file is ignored;
  - launch-environment precedence for each connection key.
- **Ordering test:** in an e2e suite, `ConfigService.get('DB_NAME')`, a raw `DataSource` built by the helper, and `data-source.ts` all report the resolved Test database while `apps/api/.env` says `clensy`.
- **Fail-closed test:** a Jest run with `DB_NAME=clensy` exits non-zero before any connection. The test runs Jest as a child process and asserts no connection was opened.
- **`globalSetup` tests:**
  - it creates a missing, uniquely named `_test` database and migrates it;
  - a second invocation is a no-op: no `CREATE DATABASE`, no migration;
  - it cleans up its scratch database.
- **Static guard tests:**
  - No e2e file contains a literal non-`_test` database fallback or a direct `process.env.DB_*` read outside the helper.
  - Nothing that starts the app or a container references `seed-dev-owner` or `seed.ts`.
- **Destructive-check tests:** the shared check throws on a non-`_test` `current_database()` and passes on a Test database.
- **Seeder tests**, against the Test database through the core:
  - create;
  - unchanged on re-run, with the hash compared in the test and never printed;
  - each mismatch (role, scope, tenant, disabled), with no write;
  - `--reset-password`, with only the hash changed;
  - no other table or admin row changed, checked with before/after counts and digests.
- **Seeder unit tests:** each guard rejection in §4.7, and output never containing the password, the hash or the email.
- **Evidence (M6):**
  - the `clensy` before/after snapshot from §4.5 item 4;
  - the full `pnpm --filter api test:e2e` run;
  - `test:e2e:release-gate`;
  - lint and type-check;
  - green CI on the PR.

---

## 8. Author calls (for M3 to confirm or overturn)

1. The resolver takes `DB_NAME` from the launch environment only, with `clensy_test` as the default. It never reads `DB_NAME` from a file (§4.2).
2. The e2e run also enforces the Local host allowlist, the same list as the seeder (§4.2 step 3).
3. The migration scratch databases are renamed to `clensy_migration_<hex>_test` (§4.5).
4. The allowlist is exactly the ticket's three hosts. `::1` and other loopback forms are rejected.
5. The seeder refuses a Test database (§4.3 item 4, §4.7 guard 4).
6. `--reset-password` with no existing row creates the account (§4.7).
7. The explicit CI `migration:run` steps are removed in favour of `globalSetup` (§4.4).
8. Seeder output omits the email (§4.7).
9. There is no root `pnpm test:e2e` alias. There is a root `pnpm db:seed:dev-owner` alias.
10. A missing Bootstrap tenant is a guard failure, not a create (§4.7 guard 5).
11. Destructive confinement is proven by a `current_database()` check at each path, implemented once (§4.5).

## 9. Genuine gaps (flagged, not reopened)

- **G1. A ticket ambiguity, resolved by call 1.** The ticket says `setupFiles` "sets `DB_NAME`", and also that a run with `DB_NAME=clensy` fails. Taken literally, the first would overwrite the second. Call 1 reconciles them.
- **G2. The mismatch failure leaves the developer to fix the row by hand.** For example, the account was disabled through the console. This follows the ticket ("fails closed"). M9 docs must give the manual steps. No repair flag is proposed.
- **G3. Email normalisation: checked, no gap.** `LoginService` (`login.service.ts:43`), `AdminsService.create` and `db:seed` all apply `toLowerCase()` with no trim. The seeder uses the same rule, so all of them resolve to the same row.
- **G4. `pnpm db:seed` and `db:seed:dev-owner` share `ADMIN_SEED_EMAIL`.** Running `db:seed` re-hashes the development owner's password to the same `ADMIN_SEED_PASSWORD`, so sign-in still works. It also re-enables the account and resets its role. That behaviour is unchanged by owner decision, and documented (§4.8).
- **G5. No guard covers Compose or the API.** If a developer exports `DB_NAME=clensy_test` in a shell and starts Compose from it, the stack uses the Test database. The data is lost on the next e2e run, but `clensy` is not harmed. This spec handles it with documentation only. A runtime guard is a possible follow-on. The owner may ask for it at M3.

## 10. Acceptance criteria for this specification

This Draft may move to **Accepted** after M3 when:

- the owner has confirmed or overturned every author call in §8, and resolved or deferred each gap in §9;
- the §4.3 mixed-scenario table and properties are judged complete for host-run e2e alongside a running Compose stack;
- the invariants in §4.9 and the test expectations in §7 cover every acceptance criterion of #227;
- the owner decisions of 2026-11-06 are unchanged: one slice, `ADMIN_SEED_*` reused, no audit writes, the Bootstrap tenant.

Accepting this specification does not authorise implementation. M4 Implementation Planning comes next.
