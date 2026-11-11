# E2E Database Isolation & Development Owner Seeder — Specification

| Field | Value |
| --- | --- |
| **Status** | Accepted — 2026-11-06 (M3), content as reviewed at `8ec06c3` (revision 4).<br>**Revision 5 (slice-local amendment): Draft** — 2026-11-11 (M2). Returned by the focused M3 for one correction, which revision 5a applies (Draft, 2026-11-11). Revision 5b applies the independent review's findings on revision 5a (Draft, 2026-11-11). Revision 5c corrects revision 5b's scanned-set wording (Draft, 2026-11-11). Revisions 5 to 5c go to a final focused M3 confirmation together. The remainder of the specification stays Accepted. |
| **Kind** | Architecture RFC: the contracts of the API's e2e test infrastructure and of one development-only command. This is not a process specification. |
| **Date** | 2026-11-06 |
| **Revision note** | **Revision 5c** applies the owner's decisions of 2026-11-11 on the independent final focused M3 review of revision 5b (findings R1, R2).<br>• **R1:** the §7 scanned set defines check coverage only; it no longer redefines "e2e code", so it does not narrow invariants 4, 13 and 14 (§7).<br>• **R2:** the scanned set is every source file under `apps/api/test/`, not only `.ts` files (§7, §10).<br>• Nothing else changes (§10, revision 5c).<br>**Revision 5b** applies the owner's decisions of 2026-11-11 on the independent focused M3 review of revision 5a (findings F1–F5).<br>• **F1:** §4.5 item 2 and §2 state the `globalSetup` exception that invariant 4 already states.<br>• **F2:** §7 defines the set of files scanned for invariants 4, 13 and 14, with no source file excluded, and how the static guard test avoids matching itself.<br>• **F3:** this note names invariant 14 for revision 5a.<br>• **F4, F5:** §4.10 names invariants 4 and 14, and describes unscanned code as code outside the scanned files.<br>• Nothing else changes (§10, revision 5b).<br>**Revision 5a** applies the focused M3 return of revision 5 and the owner's decisions on its two questions (2026-11-11).<br>• **R5-1:** the `globalSetup` `CREATE DATABASE` of the E2E target is the one statement outside invariant 4 and the §7 DDL check (§4.9 item 4, §7).<br>• **N5-1 to N5-4:** invariant 14 forbids referencing `dblink`/`postgres_fdw`, with a separate §7 reference check (§4.9 item 14, §7); the §4.10 superuser operations are examples, with the image documentation cited (§4.10); the §10 location list is complete.<br>• **M3 questions:** invariant 13 forbids session-termination calls, with its own §7 hygiene check (§4.9 item 13, §4.10, §7); the outright `ALTER DATABASE` prohibition stays.<br>• Nothing else changes (§10, revision 5a).<br>**Revision 5** applies the owner's M5 decisions of 2026-11-11 on the plan review's specification-level findings. No other owner decision is reopened.<br>• **D-M2-1:** stage 1 also rejects `extra.Client` (thesis, §4.5 item 1, §4.9 item 3, §5, §7, §8 call 11, §10).<br>• **D-M2-2:** §4.3 item 1 and §4.10 no longer claim more than connection confinement and database-scoped statements. §4.10 records the cross-database residual risk of a superuser e2e role, the separate session-termination consideration, and stale checkouts with the owner's inspection before seeding. Invariant 4 and §4.5 item 2 cover `ALTER DATABASE`. §7 adds a cross-database DDL hygiene check that is not a security boundary (§2, §4.3 item 1, §4.5 item 2, §4.9 item 4, §4.10, §7).<br>• **D-M2-3:** concurrent runs from separate checkouts are recorded as information, not an invariant (§4.10).<br>• **D-M2-4:** the snapshot is evidence of no *observed* change (§4.5 item 4).<br>• Nothing else changes (§10, revision 5).<br>**Revision 4** closes the remaining B1 gap: TypeORM connection settings could replace the checked target.<br>• Stage 1 now also rejects `extra.database`, `extra.connectionString` and a custom `driver` (§4.5 item 1, §4.9 item 3, §7, §8 call 11, §10).<br>• Nothing else changes.<br>**Revision 3** applies the M3 round 2 return. No owner decision is reopened.<br>• **B1:** the connection-level guard now has two stages. It validates the configured target **before connecting**, so no TypeORM statement can run on a wrong database. It then confirms `current_database()` **after connecting** (thesis, §4.4 item 2, §4.5 item 1, §4.9 item 3, §7, §8 call 11, §9 G6).<br>• **R8:** the snapshot's `stopped` mode is the default. `idle` is an exception with defined evidence and stated limits (§4.5 item 4, §5, §7, §8 call 14, §10).<br>• **R9:** the owner's decisions on calls 12–14 are recorded (status rows, §8, §10).<br>• **Notes a–e:** Nest retry delay (§9 G6); migration-loading path (§4.4 item 3); diverged `clensy_test` (§9 G7, §4.8); invariant 6 wording (§4.3 item 6, §4.9 item 6, §7); seeder `.env` location (§4.7).<br>**Revision 2** applies the seven Required Revisions from M3 round 1 and five of its Non-blocking Notes. No owner decision is reopened.<br>**Required Revisions:**<br>• **R1:** a connection-level guard on every e2e `DataSource` replaces the per-site checks (§4.5 item 1).<br>• **R2:** Test-database names are capped at 63 bytes (§4.1).<br>• **R3:** effective connection settings are validated; empty or whitespace values count as missing; `PG*` variables cannot redirect a connection (§4.1, §4.2, §4.7).<br>• **R4:** one maintenance connection, in `globalSetup` only; `CREATE`/`DROP DATABASE` is limited to names that are valid and generated by the same suite (§4.4, §4.5 item 2, §4.9).<br>• **R5:** CI keeps `migration:run`, and `globalSetup` confirms that no migration is pending (§4.4, §4.6).<br>• **R6:** the full effect of `pnpm db:seed` on the owner is stated (§3 item 10, §4.8, §9 G4).<br>• **R7:** the `clensy` snapshot is taken with no writer, and the record says how (§4.5 item 4).<br>**Non-blocking Notes adopted:**<br>• **N1:** seeder output shows the admin id and the configuration source, and reports a password comparison (§4.7).<br>• **N2:** limits of the host allowlist are listed as residual risks (§4.10).<br>• **N4:** email lookup is case-insensitive and fails closed on ambiguity (§4.7).<br>• **N7:** docs explain how to reset a stale `clensy_test` (§4.8).<br>• **N8:** lock-wait queries must filter on `current_database()` (§4.3 item 6, §4.9). |
| **M3 decision** | **Revision 5c: not yet reviewed.** It awaits a final focused M3 confirmation, together with revisions 5 to 5b (§10, revision 5c).<br>**Revision 5b** (independent final focused M3, 2026-11-11): **Returned for Revision**. One blocking finding (R1: the scanned-set definition narrowed invariants 4, 13 and 14) and one non-blocking finding (R2: `.ts`-only coverage), both applied in revision 5c. Notes N1 and N2 were assigned to M4.<br>**Revision 5a** (independent focused M3, 2026-11-11): the reviewer recommended acceptance with six non-blocking findings. The owner chose to apply F1–F5 as revision 5b before accepting, and assigned F6 to M4. The return of revision 5 below was a self-review by the author.<br>**Revision 5** (focused M3, 2026-11-11): **Returned for Revision**. One required change (R5-1: the §7 DDL check contradicted `globalSetup` provisioning) and four non-blocking notes (N5-1 to N5-4), all applied in revision 5a. The owner decided both M3 questions (§10, revision 5).<br>**Revision 4: Accepted — 2026-11-06 (M3), content as reviewed at `8ec06c3`** (revision 4). The focused confirmation of revision 4 found no blockers or required revisions: the `extra.database`, `extra.connectionString` and custom-`driver` paths are closed before connecting. One non-blocking note: `nativeDriver` is not a bypass (`pg-native` is not installed, and a database name that passes the Test-database rule cannot be read as a libpq connection string); M4 resolves it. This decision does not authorise implementation. M4 Implementation Planning is next.<br>**Round 1** (owner, 2026-11-06): **Returned for Revision**.<br>• **Required Revisions** R1–R7: applied in revision 2.<br>• **Non-blocking Notes** N1, N2, N4, N7 and N8: adopted. N3, N5, N6, N9, N10 and N11: not adopted. N12: accepted as recorded (§9 G5).<br>• **Author calls:** 1–6, 9 and 10 stand. Call 7 was overturned and is restated. Calls 8 and 11 were revised. Calls 12–14 are new and await confirmation.<br>• **Not yet Accepted:** this revision goes to M3 round 2.<br>**Round 2** (reviewing `7c7fa8c`, 2026-11-06): **Returned for Revision**.<br>• **Blocker B1:** the guard ran too late. TypeORM issues statements during `initialize()`.<br>• **Required Revisions** R8 (snapshot modes) and R9 (record calls 12–14).<br>• **Non-blocking notes** a–e.<br>• **Owner decisions:** call 12 approved; call 13 approved as written; call 14 approved as amended by R8.<br>• **Round 1 items** R1–R6, N1, N2, N4, N7 and N8 confirmed resolved.<br>• **Next step:** the reviewer stated that once B1, R8 and R9 are applied, the spec would be Accepted without another full round. Revision 3 applies them. **It is not Accepted** until the reviewer confirms.<br>**Round 2 confirmation** (reviewing `1eb5d50`, 2026-11-06): **REVISE**.<br>• **Blocker (B1-residual):** TypeORM's `PostgresDriver.createPool` applies `options.extra` last, so `extra.database` or `extra.connectionString` could replace the checked database name.<br>• **Non-blocking note:** a custom `options.driver` would bypass the same assumptions.<br>• **Confirmed:** R8, R9, notes a–e, and the round 1 items.<br>• **Revision 4** addresses the blocker and adopts the note. It is not Accepted until the reviewer confirms. |
| **Tracking** | [#227](https://github.com/rexescario-dev/clensy-platform/issues/227): isolate the e2e database and add a persistent dev `TENANT_OWNER` seeder |
| **Blocks** | [#209](https://github.com/rexescario-dev/clensy-platform/issues/209): browser verification of the invoice/payment UI. Its M6 browser pass needs a persistent `TENANT_OWNER` the developer can sign in as. |
| **Depends on** | [Multi-Tenant Architecture](2026-09-23-multi-tenant-architecture-design.md) (Accepted). **Relied upon, not changed:** the Bootstrap tenant, `TENANT`-scoped admins, and the `admin_user_entity` scope/tenant `CHECK` constraints.<br>[Required CI checks](2026-10-06-required-ci-checks-design.md) (Accepted). **Constrains this spec:** the CI job names **Release gate** and **API e2e** are required checks and MUST NOT be renamed. |
| **Related (informative)** | [#226](https://github.com/rexescario-dev/clensy-platform/issues/226) (runtime `JWT_SECRET`; `apps/api/.env` out of the image). It does not affect this host-run seeder or the e2e target. |
| **Governing process** | [Standardized Agent Workflows](../../workflows/specs/agent-workflow-design.md), stage M2 |
| **Source-material note** | Sources:<br>• the #227 ticket body, including its owner decisions of 2026-11-06;<br>• a read-only investigation of the repository on 2026-11-06 (§3);<br>• the M3 round 1 review.<br>The owner skipped the brainstorming questions and added one design requirement: the mixed host/Docker scenario must be addressed explicitly (§4.3). Every decision not in the ticket is an **author call**. §8 lists them, with their M3 status. §9 lists the genuine gaps. |

---

## 1. Primary question & thesis

**Question:** Local e2e suites and manual browser verification share the `clensy` database, and the e2e suites truncate whole tables in it. The developer runs e2e on the host, sometimes while the API and web run in Docker Compose. How do we make `clensy` safe from e2e cleanup in every such arrangement? And how do we give the developer one persistent `TENANT_OWNER` they can sign in as, without disturbing anything else?

**Thesis:**

- **One resolver, run first.** A shared resolver works out each e2e target once, **before any application code loads**. It never takes the database name from an `.env` file. It uses the launching environment's name if that name passes the Test-database rule, and `clensy_test` if none is set. Any other name **fails the run** before anything connects.
- **Validated settings, published.** The resolver validates the effective connection settings, so no empty or invalid value can let the driver fall back to `PG*` variables. It writes the settings into `process.env`. Nest `ConfigModule` and `dotenv` never overwrite an existing variable. So every connection path sees the same target: the Nest app, raw `DataSource`s, the TypeORM CLI data source, and the migration suites' admin connections.
- **Database setup.** A Jest `globalSetup` creates and migrates that database, then confirms that no migration is pending.
- **A two-stage connection-level guard.** Every `DataSource` initialised in an e2e test environment, the application's own included, is checked twice:
  - **Before it connects:** its configured target is validated against the Test-database rule, and every setting that could replace that target (`url`, `replication`, `extra.database`, `extra.connectionString`, `extra.Client`, a custom `driver`) is rejected. A wrong target never opens a connection to it, so neither TypeORM nor test code can issue any statement through a connection to it.
  - **After it connects:** it confirms `current_database()`, as an independent second check.
- **Compose is untouched.** It keeps serving `clensy` and never sees a `_test` name.
- **The seeder.** `pnpm db:seed:dev-owner` creates or verifies exactly one Bootstrap-tenant `TENANT_OWNER` from `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD`. It changes the password only on `--reset-password`. If the existing account differs, or the match is ambiguous, it fails closed with no writes.

---

## 2. Scope

### In scope (normative)

- **E2E target resolution:** a shared resolver that loads no application code, used by a Jest `setupFiles` module and by the Jest `globalSetup` (§4.1, §4.2).
- **E2E database provisioning:** `globalSetup` creates the resolved database if it is missing, migrates it idempotently, and confirms that no migration is pending (§4.4).
- **Confinement** (§4.5):
  - every `DataSource` initialised in an e2e test environment connects only to a Test database, enforced at the connection, not per destructive site;
  - `CREATE`/`DROP DATABASE` in e2e code targets only names the same suite generated that pass the Test-database rule (apart from `globalSetup`'s creation of the E2E target, §4.4 item 2), and e2e code does not use `ALTER DATABASE`.
- **CI parity:** the **Release gate** and **API e2e** jobs use `DB_NAME=clensy_test` and `POSTGRES_DB=clensy_test`, and keep their explicit `migration:run` step (§4.6).
- **Seeder:** `apps/api/src/platform/database/seed-dev-owner.ts`, the `api` script `db:seed:dev-owner`, and a root alias `pnpm db:seed:dev-owner` mirroring `pnpm db:seed` (§4.7).
- **Tests:** §7.
- **Documentation** (§4.8): `docs/getting-started/local-development.md`, `docs/development/testing-and-ci.md` and `apps/api/README.md` must describe:
  - `clensy_test`;
  - the mixed host/Docker setup;
  - the development owner;
  - the full effects of `pnpm db:seed`;
  - resetting a stale or diverged `clensy_test`;
  - the residual risks.
  
  M9 owns the final wording. This spec fixes what the docs must say.

### Informative

- §3 records the investigation that motivates the design.
- §4.3 walks through the mixed host/Docker scenario.

### Out of scope (normative)

- **Any change to `pnpm db:seed`**, including its owner upsert (owner decision). §9 G4 states how the two commands interact.
- **Any change to Compose, the Dockerfiles or the API's runtime database configuration.** `docker-compose.yml`, `Dockerfile`, `Dockerfile.web`, `database.module.ts` and the defaults in `data-source.ts` stay as they are. Their behaviour is relied upon (§4.3). The connection-level guard (§4.5) lives in test code only.
- **A runtime guard in the API that refuses a `_test` database** (§9 G5; accepted at M3 round 1).
- **Cleaning up existing leftovers in `clensy`.** The two `tenant-owner-<uuid>@example.com` rows and any other e2e residue stay. The seeder ignores them because their emails differ. Deleting them is a manual decision for the owner.
- **Audit events for seeder operations** (owner decision).
- **A dedicated tenant for the development owner** (owner decision: the Bootstrap tenant).
- **New environment variables for seeder credentials** (owner decision: reuse `ADMIN_SEED_*`). The e2e resolver reads one optional test-only input, the launching environment's `DB_NAME`. That is not a new variable.
- **Automatic detection of a `clensy_test` whose schema is ahead of the code, or whose migration history has diverged from it** (for example after switching branches). This is handled by documentation (§4.8, §9 G7).
- **Running e2e inside a container**, or adding a test stage to any image.
- **Parallel e2e workers**, or one database per worker. `maxWorkers: 1` stays.
- **A root `pnpm test:e2e` alias.** The command remains `pnpm --filter api test:e2e`. The ticket's `pnpm test:e2e` is shorthand for it (§8 call 9).

---

## 3. Investigation findings (2026-11-06, read-only)

These confirm the ticket's findings and add the facts that the mixed host/Docker scenario depends on.

1. **One Postgres server, one database today.** Compose's `postgres` service creates only `${DB_NAME}` (`clensy`, from the root `.env`) through `POSTGRES_DB`, and only when the volume is first initialised. The host reaches it at `localhost:${DB_PORT}`. Containers reach it at `postgres:5432`.
2. **Two env files say `DB_NAME=clensy`.**
   - The root `.env` feeds Compose `${…}` substitution.
   - `apps/api/.env` feeds the host-side API tools. Nest `ConfigModule` reads `process.cwd()/.env`, and `data-source.ts` runs `import 'dotenv/config'`.
   - `.dockerignore` excludes only the root `.env`, so `apps/api/.env` is also **baked into the API image**. Compose's `environment:` block then overrides `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD` and `DB_NAME` for `api` and `migrate`.
3. **Precedence is "existing environment wins" everywhere:**
   - `@nestjs/config` 4.0.4 `forRoot` merges `{...envFile, ...process.env}`. `assignVariablesToProcess` writes only keys **not already present** in `process.env`.
   - `ConfigService.get` consults `process.env` (`skipProcessEnv` is false).
   - `dotenv/config` does not override existing variables by default.
   - Compose substitution takes shell variables over the root `.env`.
4. **The e2e suites have two resolution paths today.**
   - Suites that boot `AppModule` get `DB_*` from `apps/api/.env` through `ConfigModule`.
   - About 25 suites and helpers build their own `DataSource` from `process.env.DB_* ?? <default>`, with a literal `'clensy'` fallback, and never load a `.env` file. They reach `clensy` only because the defaults happen to equal the file's values.
   
   `docs/development/testing-and-ci.md` says the suites "connect with the `DB_*` values in `apps/api/.env`". That is true only for the first path.
5. **Destructive statements are widespread (informative; not an exhaustive inventory).** Delete, remove, clear, `TRUNCATE`, `DROP` or `DELETE` statements appear in **33 files** under `apps/api/test/`. They include, but are not limited to:
   - whole-table `TRUNCATE` in `admins.service`, `admins.service.disable-concurrency`, `bookings.service`, `customers-properties.service`, `laundry.service` and `billing.service`;
   - `.clear()` on `audit_event_entity`;
   - row-level deletes in `catalog.service`, `bookings.tenant-isolation`, `catalog.tenant-isolation`, `jobs.service`, `cleaners-teams.service`, `bookings-rest`, `tenant-audit-tags` and `tenant-label-overrides`;
   - `removeTestTenants` in `seed-tenant-admin.ts`, which skips the Bootstrap tenant;
   - the release-gate world teardown;
   - the migration suites.
   
   The migration suites run `CREATE DATABASE "clensy_migration_<hex>"` and `DROP DATABASE IF EXISTS` through an admin connection to `process.env.DB_NAME ?? 'clensy'`. Because the set is this large and still growing, §4.5 guards the connection rather than relying on a list.
6. **Advisory locks are test-only and per-database.** The `*-db-test-lock.ts` helpers use `pg_advisory_lock`. Postgres scopes advisory locks to the current database, and no application code under `src/` takes one. So e2e locks in `clensy_test` cannot block the Compose API on `clensy`.
7. **E2E never binds a port.** No suite calls `app.listen`. Requests go through supertest in-process, so a host e2e run does not compete with the Compose `api` on port 3000.
8. **Nothing reaches `clensy_test` from Compose.** `migrate` and `api` take `DB_NAME` only from Compose substitution.
9. **No seeder runs at startup.** The `Dockerfile` `CMD` is `node dist/main.js`. The `migrate` command is `pnpm run migration:run`. `main.ts` does not import `seed.ts`.
10. **`pnpm db:seed` rewrites the owner row on every run.** It upserts on `email` (`seed.ts:100–108`), setting `tenantId: BOOTSTRAP_TENANT_ID`, `role: TENANT_OWNER`, `scope: TENANT`, `isActive: true` and a freshly hashed password. Run against an existing row with that email, it:
    - **moves** the account into the Bootstrap tenant from any other tenant;
    - **re-scopes** it to `TENANT`;
    - **re-roles** it to `TENANT_OWNER`;
    - **re-enables** it;
    - **re-hashes** its password.
    
    It also overwrites the booking fixtures. `local-development.md` currently mentions only the password, the role and re-enabling.
11. **Unit tests (`pnpm test`) use no database.**
12. **Lock-wait queries are filtered by database.** The barrier and diagnostic queries in `catalog.service.e2e-spec.ts:644` and `payments.concurrency.e2e-spec.ts:114,119` read `pg_stat_activity`/`pg_locks` with `datname = current_database()`. While both share `clensy`, sessions from the Compose API can show up as waiters. With a separate Test database, they cannot.
13. **The `pg` driver falls back to `PG*` variables on falsy values.** `connection-parameters.js` resolves each setting as `config[key] || process.env['PG' + KEY] || default`. `data-source.ts:27,49,52` uses `??`, which treats an empty string as a value. So:
    - `DB_NAME=''` reaches the driver as `''`, and the driver uses `PGDATABASE`;
    - `DB_PORT=''` or `DB_PORT=abc` becomes `0` or `NaN`, and the driver uses `PGPORT`;
    - `DB_HOST=''` makes the driver use `PGHOST`.
14. **CI runs migrations through the TypeORM CLI.** `ci.yml:93,141` run `pnpm --filter api migration:run`. That command uses the CLI (`TS_NODE_PROJECT=tsconfig.cli.json`, ts-node), the same path as Compose's `migrate` service.
15. **The admin row has no other relevant column.** `admin_user_entity` has `id`, `tenantId`, `email` (a plain unique constraint, not case-insensitive), `passwordHash`, `role`, `scope`, `isActive` and `createdAt`. It has no `updatedAt`, token-version or soft-delete column. "Disabled" means `isActive = false`.

---

## 4. Design

### 4.1 Terminology

| Term | Meaning |
| --- | --- |
| **Development database** | The database used by Compose's `api`/`migrate` and by the host tools (`db:seed`, `migration:run`, `db:seed:dev-owner`). `clensy` by default. |
| **Test database** | A database e2e code may connect to. Its name MUST match `^(?=.{6,63}$)[a-z][a-z0-9_]*_test$`: ASCII only, lowercase, ending in `_test`, at most 63 bytes (Postgres's identifier limit, so the name is never silently truncated). The default E2E target name is `clensy_test`. |
| **Launch environment** | `process.env` as Jest, or the seeder, receives it from the shell or CI, before any `.env` file is read. |
| **Missing value** | A variable that is unset, empty, or only whitespace. A missing value never reaches the driver (§3 item 13). |
| **Effective connection settings** | The final `{host, port, username, password, database}` handed to the driver. **Host:** trimmed and non-empty. **Port:** a decimal integer from 1 to 65535. **Username:** trimmed and non-empty. **Database:** non-empty. **Password:** may be empty; an empty password changes only how the driver authenticates, never which server or database it connects to. |
| **E2E target** | The effective connection settings of one e2e run. |
| **Local host allowlist** | `localhost`, `127.0.0.1`, `postgres`. The effective host is compared case-insensitively against the whole value. Nothing else matches: no suffixes, no other loopback addresses, no socket paths. It is a check on names, not on locality (§4.10). |
| **Development owner** | The single `admin_user_entity` row whose email is the normalised `ADMIN_SEED_EMAIL`. It is **correctly configured** when `tenantId = BOOTSTRAP_TENANT_ID`, `role = TENANT_OWNER`, `scope = TENANT` and `isActive = true`. |

### 4.2 E2E target resolution (normative)

One module, the **resolver**, produces the E2E target. It MUST NOT import application code, TypeORM entities, or any module that reads `process.env` when it loads. Apart from reading one env file, it is pure.

1. **Database name.** The resolver reads `DB_NAME` from the **launch environment only**.
   - If it is missing, the name is `clensy_test`.
   - If it matches the Test-database rule, that name is used.
   - **Anything else fails the run.** That includes:
     - `clensy`, `clensy_test2`, `Clensy_test` and `clensy-test`;
     - `_test` on its own;
     - a name longer than 63 bytes;
     - names with surrounding or embedded whitespace, quotes, or non-ASCII characters.
     
     The error names the rejected value and the rule.
   - The resolver never takes `DB_NAME` from `apps/api/.env` or the root `.env`, whatever value they hold.
2. **Connection settings.** Each of `DB_HOST`, `DB_PORT`, `DB_USERNAME` and `DB_PASSWORD` is resolved in this order:
   1. the launch environment, unless the value is missing;
   2. `apps/api/.env`, unless missing there too. The file is located relative to the Jest config, not `cwd`, and is parsed without being applied wholesale;
   3. the defaults `data-source.ts` uses today: `localhost`, `5432`, `clensy`, `clensy_dev`.
3. **Validation.** The result MUST be valid effective connection settings (§4.1); otherwise the run fails. The effective host MUST also be on the Local host allowlist; otherwise the run fails (author call 2). Every value reaching the driver is then non-empty and valid, except the password. So the driver never falls back to `PGHOST`, `PGPORT`, `PGDATABASE` or `PGUSER`, whatever those variables hold (author call 13).
4. **Publication.** The resolver writes the five effective values into `process.env`: the trimmed host, the port as a decimal string, and the database name. `ConfigModule`, `dotenv` and every raw read then see exactly the E2E target (§3 item 3).
5. **Single source.** Both the `setupFiles` module and `globalSetup` call the resolver. Neither relies on the other having changed `process.env`.

**Ordering contract (Jest).**

- **`globalSetup`** runs once, in the parent process, before any test file. It MUST call the resolver *before* it loads `data-source.ts` or any migration, because `data-source.ts` reads `process.env` when it loads. So it loads them only after resolution, for example with a dynamic `import`.
- **`setupFiles`** runs in every test file's environment, before the test framework is installed and before the test file's own imports. It therefore runs before `AppModule`, `ConfigModule.forRoot` and every helper are evaluated. It also installs the connection-level guard (§4.5 item 1).
- **A resolver failure** in either place stops the run before any test connects.

**Single connection helper.** E2E code builds connection options only through one shared test helper that reads the published E2E target. That covers raw `DataSource`s, the migration suites' admin connections, and their scratch-database connections (§4.5 item 2). No e2e file may contain a literal database-name fallback such as `?? 'clensy'`, and no e2e file may read `process.env.DB_*` directly. A static guard test enforces both rules (§7).

### 4.3 Mixed host/Docker scenario (normative)

The supported arrangement: Compose runs `postgres`, `migrate`, `api` and `web`, and the developer signs in at `localhost:3001` for manual verification. At the same time, or between sessions, the developer runs `pnpm --filter api test:e2e` on the host. The two are not mutually exclusive.

| Actor | Where | Database name from | Host:port | Database |
| --- | --- | --- | --- | --- |
| `postgres` | container | root `.env` → `POSTGRES_DB` (first init only) | — | creates `clensy` |
| `migrate`, `api` | container | Compose `environment:` ← root `.env` / shell | `postgres:5432` | `clensy` |
| `web` | container | — (talks to the API over HTTP at `localhost:3000`) | — | — |
| `db:seed`, `migration:run`, `db:seed:dev-owner` | host | `apps/api/.env`, unless the shell sets it | `localhost:${DB_PORT}` | `clensy` |
| `jest --config test/jest-e2e.json` | host | launch env, or the `clensy_test` default; never a file | `localhost:${DB_PORT}` | `clensy_test` |

**Required properties:**

1. **Same server, different databases.** The e2e target and the development database may share one Postgres server. Every e2e `DataSource`'s target is validated before it connects, and confirmed with `current_database()` after it connects (§4.5 item 1). `TRUNCATE`, `DELETE`, advisory locks and `current_database()`-filtered activity queries are all scoped to one database. So e2e data changes, cleanup and lock waits cannot change or block a row in `clensy`, whatever Compose is doing. This property covers database-scoped statements only. Statements that act on other databases or on other sessions are a residual risk (§4.10).
2. **Container configuration is unchanged, and already resolves to `clensy`:**
   - Compose `environment:` overrides the `DB_*` values in the baked-in `apps/api/.env`.
   - A container never runs Jest.
   - If Jest were run in a container anyway, the resolver would still apply. `postgres` is on the allowlist, and the name rule is the same.
3. **The host e2e run never reads `DB_NAME` from a file.** So the shared `DB_NAME=clensy` in both `.env` files cannot reach e2e.
4. **Shell exports are the one cross-over risk:**
   - **`DB_NAME=clensy` exported in the shell** (for example after `set -a; . ./.env`): e2e **fails closed** with the resolver error. That is the intended outcome, and it satisfies the ticket's negative criterion.
   - **`DB_NAME=clensy_test` exported in the shell, then Compose or a host tool run from that shell:** those tools target `clensy_test`. That does no harm to `clensy`, but manual data, or a `pnpm db:seed` owner, lands in a database that e2e truncates. `db:seed:dev-owner` refuses it (§4.7, author call 5). The docs MUST tell developers not to export `DB_NAME`, to rely on the default, and how to check what Compose will use (`docker compose config`). §9 G5 records that Compose and the API are not guarded.
5. **First run on an existing volume.** `clensy_test` does not exist yet, and `globalSetup` creates it (§4.4). `docker compose down -v` deletes both databases. The next e2e run recreates `clensy_test`. Recreating `clensy` takes `docker compose up` (the `migrate` service) followed by the seeders.
6. **Lock-wait and diagnostic queries stay database-scoped.** Each e2e query over `pg_stat_activity` or `pg_locks`, taken as a whole, MUST restrict what it observes to sessions of `current_database()`. A direct `datname = current_database()` filter does that. So does a `pg_locks` subquery correlated to a `pg_stat_activity` row filtered that way (`payments.concurrency.e2e-spec.ts:108–115`). Not every subquery needs its own filter. The Compose API's sessions on `clensy` are then never counted as test waiters (§3 item 12, §4.9 item 6).

### 4.4 Provisioning in `globalSetup` (normative)

1. It resolves the E2E target (§4.2).
2. It opens the run's **only maintenance connection**: to the server's `postgres` database, with the E2E target's credentials. On it:
   - it checks `pg_database` for the resolved name;
   - if the name is absent, it issues `CREATE DATABASE` with the name quoted as an identifier;
   - if `CREATE DATABASE` loses a race and fails with "already exists", that counts as success.
   
   It issues nothing else on that connection, and closes it before migrating. No test file opens a maintenance connection (§4.5 item 2, §4.9 item 1). A test-environment `DataSource` aimed at `postgres` is rejected by the guard before it connects (§4.5 item 1), so it never opens one.
3. It runs all pending migrations on the Test database, using the same migration set as `data-source.ts`. When none are pending, it makes no schema change. A repeated run is a no-op.

   **Migration-loading path: an M4 proof obligation (note b).** M4 MUST choose one of these two paths, and prove it with the `globalSetup` tests (§7):
   - load the `.ts` migrations in-process, under Jest's transform, through `data-source.ts`, after resolution;
   - invoke the TypeORM CLI (`pnpm --filter api migration:run`) in a child process, with the published effective settings as its environment.
   
   Either path MUST apply exactly the migration set in `src/platform/database/migrations/`. Neither may be assumed to work without that proof.
4. It then **confirms that no migration remains pending** on the Test database. If any does, the run fails. It reports how many migrations it applied. That number is `0` after CI's explicit `migration:run` (§4.6), or after a previous local run.
5. A failure stops the run with a message naming the step, the database name and the host. Failure cases: an unreachable server, no `CREATEDB` privilege, a migration error, a migration still pending. The message never includes the password.
6. It never drops, truncates or resets the Test database. Suites keep owning their own cleanup.

### 4.5 Confinement (normative)

1. **Connection-level guard, in two stages (author call 11).**
   - **What is checked:** every `DataSource` initialised in an e2e test environment. That includes:
     - the Nest application's own (`DatabaseModule`, through `@nestjs/typeorm`);
     - raw `DataSource`s built through the helper;
     - the migration suites' admin and scratch connections.
   - **Why a check after `initialize()` is too late:** TypeORM 1.1.0's `DataSource.initialize()` connects, then runs `driver.afterConnect()`, which issues `CREATE EXTENSION IF NOT EXISTS …` when entities have uuid columns. It then runs `dropSchema`, `migrationsRun` and `synchronize` if they are set (`typeorm/data-source/DataSource.js:137–157`, `typeorm/driver/postgres/PostgresDriver.js:321–359`). All of this happens before `initialize()` returns.
   - **Why checking `options.database` alone is not enough.** TypeORM's Postgres driver builds the pool settings from `url` (as `connectionString`), `host`, `username`, `password`, `database` and `port`, then applies `options.extra` **on top** (`typeorm/driver/postgres/PostgresDriver.js:1370–1381`). So `extra.database` replaces the database name. And when the `pg` driver gets a `connectionString`, from `url` or from `extra`, it parses it and lets it override the other settings (`pg/lib/connection-parameters.js:57–60`). A custom `options.driver` replaces the `pg` module altogether, so none of these assumptions would hold. `extra.Client` does the same one level down: `pg-pool` uses a caller-supplied `Client` class in place of `pg`'s (`pg-pool/index.js:95`).
   - **Stage 1, before connecting (the primary protection).** Before TypeORM opens any connection, the guard reads the `DataSource`'s options. It throws, opening no connection, unless all of these hold:
     - `type` is `postgres`;
     - `url` is not set;
     - `replication` is not set;
     - `extra.database` is not set;
     - `extra.connectionString` is not set;
     - `extra.Client` is not set;
     - no custom `driver` is supplied;
     - `database` is a non-missing value (§4.1) that matches the Test-database rule.
     
     With every substitution path rejected, the checked `database` value is the target the `pg` driver receives. It cannot be replaced by `url`, `replication`, `extra`, a custom driver or `PGDATABASE`: it is non-empty, so `pg` never falls back to `PGDATABASE` (§3 item 13). Postgres connects to exactly the database named, or the connection fails. So no TypeORM initialisation-time statement, migration, synchronisation or test statement can run through a connection to a target that has not passed validation.
   - **Stage 2, after connecting (an independent second check).** Once connected, and before the `DataSource` is handed back to its caller, the guard runs `SELECT current_database()`. It confirms that the result equals the stage 1 name. If it does not, it destroys the `DataSource` and throws. Stage 2 detects a target that changed between configuration and connection. Stage 1, not stage 2, is what stops initialisation-time statements.
   - **What else it covers:** `QueryRunner`s and repositories inherit from a checked `DataSource`. Every destructive statement e2e code can issue runs on a checked Test-database connection. This confines `TRUNCATE`, `.clear()`, `.delete()`, `.remove()`, `DELETE`, `UPDATE` and DDL operating on that database's own objects, whether or not §3 item 5 names its site. Statements that act on other databases or sessions are not confined by this guarantee (§4.10).
   - **Constraints:**
     - The guard is implemented once, in test code, and installed by `setupFiles`.
     - It MUST NOT require any call site to opt in.
     - It MUST NOT change application code, including `database.module.ts`.
     - It MUST be reached through TypeORM's public `DataSource` class and its options, not internal imports. The Nest path uses that class: `new DataSource(options)`, then `initialize()` (`@nestjs/typeorm/dist/typeorm-core.module.js:170,191`).
     - How it hooks initialisation is M4's choice, within these constraints. Proving it covers every path is an M4 obligation (§9 G6).
2. **Database creation and removal (author call 3).**
   - **Scratch names:** migration scratch databases are named `clensy_migration_<32 lowercase hex>_test`, which is 54 bytes. After that, every database any e2e file connects to matches the one Test-database rule.
   - **Admin connection:** the migration suites' admin connection goes through the shared helper to the **E2E target**, not to the `postgres` maintenance database.
   - **Limits on `CREATE`/`DROP DATABASE` in e2e code.** Its target name MUST:
     - match the Test-database rule;
     - have been generated by the same suite during the same run;
     - differ from the E2E target name.
     
     The shared helper records each name it generates and refuses any other target. No e2e code may drop the E2E target, the development database, or `postgres`. The `globalSetup` provisioning routine's `CREATE DATABASE` of the E2E target (§4.4 item 2) is outside these limits, as invariant 4 states; it creates no other name and drops nothing.
   - **No `ALTER DATABASE` in e2e code.** E2e code needs no database-level alteration, so it MUST NOT issue `ALTER DATABASE` against any database (§4.9 item 4).
   - **Ownership:** a scratch database is still created and dropped by the suite that owns it.
3. **The Bootstrap tenant.** `removeTestTenants` keeps its rule that it never deletes the Bootstrap tenant.
4. **Evidence of no observed change to `clensy` (author call 14).** This evidence detects a change by comparing two moments. It is not proof that no change happened between them, and it prevents nothing; prevention, within the limits in §4.10, comes from the confinement above. A full local run (§7) must leave the following identical before and after:
   - the row count of every table in `clensy`;
   - a content digest of `admin_user_entity` and `audit_event_entity`.
   
   Capturing them is read-only. The snapshot MUST be taken with **no writer on `clensy`**. There are two modes:
   - **`stopped` (the default).** The Compose `api` container is stopped (`docker compose stop api`), and no host tool targets `clensy` during the run. Required evidence, kept in the M6 record:
     - `docker compose ps` output showing `api` not running, before and after;
     - `pg_stat_activity` showing no client session on `clensy` other than the snapshot's own, before and after.
     
     The record states explicitly that `stopped` mode was used.
   - **`idle` (an exception).** Used only when stopping `api` is impractical; the M6 record explains why. `api` keeps running with no browser or client activity. Required evidence, before and after:
     - `pg_stat_activity` observations of sessions on `clensy`;
     - the sum of `n_tup_ins + n_tup_upd + n_tup_del` across `clensy`'s tables in `pg_stat_user_tables`.
     
     **Limitations, stated in the record:**
     - these are observations at two moments, not a guarantee;
     - a writer could start and finish between them;
     - Postgres statistics are updated asynchronously and can lag;
     - `pg_stat_reset` invalidates the counters.
     
     Idle-mode evidence is never presented as proof that no writer could have written during the run. If it is inconclusive (sessions active, counters changed, or a reset seen), the snapshot is repeated in `stopped` mode.

### 4.6 CI parity (normative)

- **Release gate** and **API e2e**:
  - job `env` `DB_NAME: clensy_test`;
  - service `POSTGRES_DB: clensy_test`;
  - health check `-d clensy_test`.
- Both jobs **keep** their explicit `pnpm --filter api migration:run` step before the e2e command (author call 7). That step keeps the TypeORM CLI path, which Compose's `migrate` service uses, covered (§3 item 14).
- `globalSetup` then runs too (§4.4). The database already exists, so it applies `0` migrations, confirms none is pending, and exercises the no-op path on every CI run. A dedicated test covers the "create if missing" path (§7).
- Job `name:` values are unchanged (required checks).
- **Lint** and **Test** are unchanged.

### 4.7 `pnpm db:seed:dev-owner` (normative)

**Invocation:** `pnpm db:seed:dev-owner [--reset-password]`, through the root alias or the `api` script. It takes no other arguments. An unknown argument fails before connecting. It reads `apps/api/.env` the way `pnpm db:seed` does: it reads `.env` relative to its working directory, and launch-environment values win. Under `pnpm --filter api`, which both the `api` script and the root alias use, the working directory is `apps/api` (note e). A missing value (§4.1) at either layer counts as unset.

**Effective settings.** The seeder resolves its effective connection settings once, in this order: launch environment, then `apps/api/.env`, then the `data-source.ts` defaults. The database name is included and is not restricted to the launch environment; the development database comes from the file. The seeder validates the settings and opens its connection only from the validated values. If it loads `data-source.ts`, it MUST first publish those values to `process.env`, as §4.2 item 4 does. So the guards below check exactly what the driver receives, and `PG*` variables cannot redirect the connection (§3 item 13).

**Guards** are checked in this order. The first failure exits non-zero before any write. All guards except guard 6 also run before connecting.

1. `NODE_ENV`, trimmed and lowercased, equals `production` → reject.
2. `ADMIN_SEED_EMAIL` or `ADMIN_SEED_PASSWORD` is missing → reject. Unlike `db:seed`, which skips quietly, this command has no other purpose.
3. The effective connection settings are not valid (§4.1) → reject. A missing value falls through to the next layer, so no empty value reaches this guard. In practice it rejects a non-numeric or out-of-range port, and any value that is invalid after resolution.
4. The effective host is not on the Local host allowlist → reject. Look-alikes fail: `localhost.example.com`, `127.0.0.2`, `::1` (author call 4), socket paths. §4.10 covers what this guard cannot detect.
5. The effective database name matches the Test-database rule → reject (author call 5).
6. After connecting: the Bootstrap tenant row (`BOOTSTRAP_TENANT_ID`) does not exist → reject (author call 10).

**Lookup (N4).**

- **Normalisation:** `toLowerCase()`, no trim. This is the same rule as `LoginService` and `db:seed` (§9 G3).
- **Query:** rows where `lower(email)` equals the normalised email, taking a row lock where one exists. The whole command runs in one transaction.
- **Results:**
  - **No rows:** the "no row" case below.
  - **Exactly one row whose stored `email` equals the normalised email:** the existing-row cases below.
  - **Exactly one row whose stored `email` differs from the normalised email** (stored un-normalised, for example `Owner@…`): fail with "existing account email is not normalised", no write.
  - **More than one row:** fail with "ambiguous: N accounts match", no write.

**Behaviour.**

| State | No flag | `--reset-password` |
| --- | --- | --- |
| No row | Insert the development owner, correctly configured, with the password hashed (bcrypt, the same cost as `db:seed`). Outcome `created`. | Same as no flag (author call 6). |
| One normalised row, correctly configured | No write. The hash is preserved byte for byte. Outcome `unchanged`, with a password check result (below). | Update only `passwordHash`, to a fresh hash of `ADMIN_SEED_PASSWORD`. Outcome `password reset`. |
| One normalised row that differs in role, scope or tenant, or is disabled | Fail. Exit non-zero. No write. The message names which attribute(s) differ. | Same failure. The flag never repairs, moves, escalates or re-enables an account. |
| Un-normalised or ambiguous match | Fail as described under Lookup. No write. | Same failure. |

**Password check (author call 12).** On `unchanged`, the seeder compares `ADMIN_SEED_PASSWORD` with the stored hash (bcrypt compare, read-only). It reports only `password: matches ADMIN_SEED_PASSWORD` or `password: differs from ADMIN_SEED_PASSWORD (run with --reset-password to apply it)`. It never reports the hash, the password, or any part of either.

**Boundaries.**

- **What it writes:** `admin_user_entity` only, and only the development owner's row. No audit event. No customer, property, service, team, booking, payment, tenant or other administrator row.
- **Races:** a unique-violation race on insert fails the run with no partial write. Running it again resolves the race.
- **Output (author call 8, revised by N1):** one line containing:
  - the outcome;
  - the admin row `id`, including on attribute-mismatch failures (the un-normalised and ambiguous failures give only the match count);
  - the database name and host;
  - where `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` were each taken from: `launch environment` or `apps/api/.env`;
  - on `unchanged`, the password check result.
  
  It never contains the email (either the configured one or any stored one), the password, a hash, or bcrypt salt material. Errors follow the same rule.
- **Never automatic.** Nothing references it from `main.ts`, any module, `Dockerfile`, `Dockerfile.web`, `docker-compose.yml`, or any `start`/`prestart`/`postinstall` script.
- **Testability.** The guards and the seeding core can be called separately:
  - The guards are pure functions of the environment, the parsed `apps/api/.env` and the arguments, so they can be unit-tested.
  - The core takes a connected `DataSource` and the inputs, so it can be e2e-tested against the Test database without passing guard 5.

### 4.8 Documentation (normative content)

- **`local-development.md`** must explain:
  - the development and test databases on the one Compose server;
  - that e2e defaults to `clensy_test` and creates it on first run;
  - not to export `DB_NAME`, and how to check what Compose will use (`docker compose config`);
  - the "Mixed host/Docker" table (§4.3);
  - `pnpm db:seed:dev-owner`:
    - its first run, re-runs, `--reset-password` and the password check;
    - its output (outcome, id, sources), including that the email is never printed;
    - the mismatch, un-normalised and ambiguous failures, and how to resolve each by hand;
  - the **full** effect of `pnpm db:seed` on the same email (§3 item 10, §9 G4):
    - it moves the account to the Bootstrap tenant, re-scopes it to `TENANT`, re-roles it to `TENANT_OWNER`, re-enables it and re-hashes its password, overriding a refusal from `db:seed:dev-owner`;
    - `db:seed` is not a safe way to check the development owner;
  - **resetting a stale or diverged `clensy_test`**, for example after switching to a branch with fewer or different migrations. The docs must say that the pending-migration check does not detect either case (§9 G7). Drop it, either on the host (`dropdb`) or through the Compose `postgres` service (`docker compose exec postgres dropdb …`), and the next e2e run recreates it;
  - the residual risks in §4.10.
- **`testing-and-ci.md`** must:
  - replace "connect with the `DB_*` values in `apps/api/.env`" with the §4.2 rule;
  - drop the manual local `migration:run` prerequisite;
  - keep `migration:run` in the CI table, and state that `globalSetup` confirms no migration is pending.
- **`apps/api/README.md`:** update the command table.
- Credentials appear in none of them.

### 4.9 Invariants (MUST / MUST NOT)

1. **Connections.** An e2e run MUST NOT use a connection to a database whose name does not match the Test-database rule. The one exception is the maintenance connection to `postgres` that `globalSetup` opens (§4.4 item 2). It is used only to check for and create the E2E target. It issues no DML, and it is never opened inside a test environment.
2. **No `DB_NAME` from a file.** No e2e code path MAY take `DB_NAME` from a `.env` file.
3. **Guarded connections.** Every `DataSource` initialised in an e2e test environment, the application's own included, MUST pass both guard stages (§4.5 item 1):
   - **before it opens any connection:** its configured settings are validated. `type` MUST be `postgres`. `url`, `replication`, `extra.database`, `extra.connectionString`, `extra.Client` and a custom `driver` MUST NOT be present. `database` MUST match the Test-database rule. Checking `database` alone does not satisfy this invariant;
   - **after connecting, before any caller can use it:** `current_database()` is confirmed.
   
   A `DataSource` that fails stage 1 MUST NOT open a connection.
4. **Database creation, removal and alteration.** `CREATE DATABASE` and `DROP DATABASE` in e2e code MUST target only names that the same suite generated in the same run, that match the Test-database rule, and that differ from the E2E target. E2e code MUST NOT issue `ALTER DATABASE`. The one statement outside this invariant is the `CREATE DATABASE` of the E2E target that the `globalSetup` provisioning routine issues on its maintenance connection (§4.4 item 2, §4.9 item 1). It creates no other name and drops nothing. This invariant is checked by a static hygiene scan (§7), which is not a security boundary (§4.10).
5. **No `PG*` redirection.** Effective connection settings MUST be valid (§4.1) wherever e2e or the seeder connects. No missing value may reach the driver.
6. **Database-scoped activity queries.** Each e2e query over `pg_stat_activity` or `pg_locks`, taken as a whole, MUST restrict what it observes to sessions of `current_database()` (§4.3 item 6).
7. **Seeder: one column, one flag.** The seeder MUST NOT change any column of an existing row except `passwordHash`, and only with `--reset-password`.
8. **Seeder: fail closed.** The seeder MUST NOT write when any guard fails, the account differs, or the match is un-normalised or ambiguous.
9. **Seeder output.** It MUST NOT contain emails, passwords, hashes or salt material.
10. **Nothing automatic.** Nothing MAY run either seeder automatically.
11. **`db:seed` unchanged.** `pnpm db:seed` behaviour MUST be unchanged.
12. **CI job names.** The CI required-check job names MUST be unchanged.
13. **No session termination.** E2e code MUST NOT call `pg_terminate_backend` or `pg_cancel_backend`. This invariant is checked by its own static hygiene scan (§7), separate from the invariant 4 scan. Neither scan is a security boundary (§4.10).
14. **No cross-database extensions.** E2e code MUST NOT reference `dblink` or `postgres_fdw`. This restricts no other extension: the migration suites' `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` stays permitted. This invariant is checked by its own static hygiene scan (§7). The scan cannot detect indirect use, SQL built at run time, or behaviour introduced outside the scanned e2e source files, so it is not a security boundary (§4.10).

### 4.10 Residual risks (informative, N2)

These are the limits of what this slice guarantees. The first group concerns the Local host allowlist, which checks names, not where the server actually is.

- **`postgres` can resolve to any address.** It resolves through `/etc/hosts` or DNS search domains, so on some machines it may reach a non-local server.
- **`localhost` / `127.0.0.1` can forward.** An SSH tunnel, `kubectl port-forward`, or a Docker port mapping can carry a local port to a remote server. `inet_server_addr()` cannot tell these apart from a local server: through a Docker mapping it already reports a container address.
- **What still protects e2e:** the Test-database rule and the connection-level guard (§4.5 item 1) mean every e2e connection is to a database whose name ends in `_test`, wherever that database is. E2e data changes, cleanup and lock waits are therefore confined to that database. Statements that act on other databases or sessions are the separate risks below.
- **What does not protect the seeder:** a tunnel to a remote server's `clensy` would pass every guard. The seeder would then create or verify an owner there (a password change still needs `--reset-password`).

The remaining risks do not depend on where the server is.

- **Cross-database statements from a superuser e2e role.** Under Compose and CI, e2e connects as the role that created the Postgres server (`POSTGRES_USER` in `docker-compose.yml` and in the CI service, both `postgres:16-alpine`). The official image's documentation states that `POSTGRES_USER` "will create the specified user with superuser power" (Docker Official Image `postgres`, Docker Hub, environment variable `POSTGRES_USER`). This is documented image behaviour; it has not been observed on this project's servers. A session confined to a Test database can still act on other databases on the same server, and on the server as a whole. Examples, not a complete list; a superuser capability that is not listed here is not thereby safe:
  - `DROP DATABASE` (including `WITH (FORCE)`) or `ALTER DATABASE` on `clensy`, for example `RENAME` or `ALLOW_CONNECTIONS false`;
  - `dblink` or `postgres_fdw`, if those extensions are installed on the server, to read or write `clensy`;
  - server-wide changes, such as `ALTER SYSTEM`, role changes, or `COPY … TO PROGRAM`, which runs a server-side command.
  
  Invariants 4 and 14 and their §7 hygiene scans limit the first two in committed e2e source. They cannot see SQL built at run time, computed names, statements in code outside the scanned files, or future dependencies, so they are not a security boundary. The only real boundary would be a dedicated non-superuser e2e role that owns only Test databases. That changes Compose, CI and developer setup (§4.3 item 2), and this slice does not adopt it.
- **Session termination (a separate consideration).** The same role can call `pg_terminate_backend()` or `pg_cancel_backend()` on sessions of any database, including the Compose API's sessions on `clensy`. That changes no data, but it can interrupt sessions and affect `clensy`'s availability. Invariant 13 forbids these calls in e2e code, and a separate §7 hygiene scan checks committed e2e source. The scan cannot see SQL built at run time or calls made through code outside the scanned files, such as a dependency, so it is not a security boundary, and this risk remains.
- **Concurrent runs from separate checkouts.** Two checkouts that run e2e at the same time against one server share `clensy_test`. Each run's `globalSetup` migrates it with its own branch's migrations, so one branch can silently leave the other's schema ahead or diverged (§9 G7). By design, each run connects only to its Test database and does not operate on `clensy`. That is intended behaviour, not a guarantee: a concurrent run carries the same cross-database and session-termination risks as any other e2e run (above). Giving each checkout its own Test-database name (`DB_NAME=<name>_test`, §4.2) isolates the runs from each other. This slice adds no detection or prevention.
- **Checkouts without this slice.** Any checkout or worktree that does not contain this slice still runs e2e against `clensy`, including its `TRUNCATE` of `admin_user_entity`, so it can delete the development owner. Nothing in this slice can reach code that lacks it, and the owner has accepted this risk. **Before seeding the development owner, the owner inspects every existing checkout and worktree**, and rebases or retires each one that lacks this slice, or does not run e2e in it.

The documentation states these limits (§4.8). This slice adds no guard against them.

---

## 5. Rationale

- **Name from the launch environment only, with a `_test` default.** This is the only rule that satisfies two ticket criteria at once: a default run works with no setup, and a non-`_test` `DB_NAME` fails. The shared `.env` files cannot defeat it, and they must keep `clensy` for Compose and the host tools. Deriving the name, for example `${DB_NAME}_test`, would read the file and tie the two databases together. A new variable was ruled out by the owner.
- **Publishing validated values into `process.env`, rather than changing each consumer.** "Existing environment wins" holds for Nest, `dotenv` and Compose (§3 item 3). Setting the values once, before anything loads, therefore steers every path, including paths nobody has listed. Validating first closes the driver's `PG*` fallback (§3 item 13).
- **A guard at the connection, not at each destructive site** (M3 round 1, R1). Destructive statements sit in at least 33 files and keep growing (§3 item 5). Checking at each site depends on every author remembering it. Checking once, when a `DataSource` initialises, covers every current and future statement. It also gives the ticket the demonstration it asks for (criterion 3) on top of the prevention (criterion 1).
- **Two stages, with the check before connecting as the primary one** (M3 round 2, B1). TypeORM issues its own statements inside `initialize()`, so a check made after `initialize()` would run too late. Validating the configured target before connecting is sound, provided nothing can replace it. So stage 1 also rejects every setting that could override the name, from TypeORM (`url`, `replication`, `extra.database`, `extra.connectionString`) or from the driver (a custom `driver`, or an `extra.Client` class, added in revision 5) (round 2 confirmation). R3 guarantees the name is never missing, so `pg` never substitutes `PGDATABASE`, and Postgres connects only to the database it names. Confirming `current_database()` after connecting adds an independent check at negligible cost.
- **`stopped` snapshots by default** (M3 round 2, R8). Stopping `api` removes the only expected writer. Activity and counter observations can't rule out a writer between two moments, so they are kept as a documented, limited exception.
- **Scratch databases renamed to `…_test`.** One rule is easier to check than "`_test`, or the migration prefix". Limiting `DROP DATABASE` to names the suite generated stops a valid but unrelated `_test` database from being dropped.
- **Keeping CI's `migration:run`** (M3 round 1, R5). The TypeORM CLI is the path Compose's `migrate` service uses. Without the CI step, a broken CLI would surface only on `docker compose up`. Keeping the step also makes every CI run exercise `globalSetup`'s no-op and nothing-pending checks.
- **Seeder separate from `db:seed`.** `db:seed` is a broad fixture loader that resets what it writes, by design, and the owner chose to keep it. The development owner needs the opposite: verify, never change. Case-insensitive lookup, failing on ambiguity, means a legacy row that differs only in letter case is never silently duplicated.
- **The id and configuration sources instead of the email** (N1). The ticket says credentials are never printed. The id lets #209's read-only check identify exactly one row. The sources tell the developer whether the shell's value won over the file's.

---

## 6. Worked examples (informative)

**E2E target:**

| Launch env | `apps/api/.env` | Result |
| --- | --- | --- |
| no `DB_NAME` | `DB_NAME=clensy` | target `clensy_test` |
| `DB_NAME="   "` | any | missing → target `clensy_test` |
| `DB_NAME=clensy` | any | **run fails** before connecting |
| `DB_NAME=feature_x_test` | any | target `feature_x_test`, created if missing |
| `DB_NAME=` 70-character `…_test` | any | **run fails** (over 63 bytes) |
| `DB_HOST=db.prod.example.com`, `DB_NAME=x_test` | any | **run fails** (host rule) |
| `DB_PORT=abc` | any | **run fails** (invalid port) |
| `DB_HOST=` (empty), `PGHOST=db.prod.example.com` | `DB_HOST=localhost` | host `localhost`; `PGHOST` has no effect |
| no `DB_NAME`, `PGDATABASE=clensy` | `DB_NAME=clensy` | target `clensy_test`; `PGDATABASE` has no effect |
| CI: `DB_NAME=clensy_test`, after `migration:run` | none | target `clensy_test`, exists; 0 applied, none pending |

**Seeder** (on success, output also shows the database, the host and both sources):

| Seeder situation | Result |
| --- | --- |
| Fresh `clensy`, `ADMIN_SEED_*` set | `created`, id |
| Run again | `unchanged`, id, `password: matches`; hash identical |
| `ADMIN_SEED_PASSWORD` changed in `.env`, run again | `unchanged`, id, `password: differs … --reset-password` |
| Owner disabled through the console, run again | fail, id, "isActive differs", no write |
| `--reset-password` on a correct row | `password reset`, id; only the hash changes |
| Stored row `Owner@example.com`, configured `owner@example.com` | fail, "email is not normalised", no write |
| `NODE_ENV=production` | fail before connecting |
| `DB_NAME=clensy_test` exported | fail before connecting |
| `DB_NAME=` (empty) exported, `PGDATABASE=clensy_test` | missing → `apps/api/.env` value `clensy`; `PGDATABASE` has no effect |
| `DB_PORT=0` | fail before connecting (invalid port) |

---

## 7. Test expectations

Every test expectation listed in this spec is documented here and executed in M6.

- **Resolver unit tests:**
  - every e2e row of §6;
  - every rejected name class in §4.2 item 1, including names over 63 bytes;
  - missing values (unset, empty, whitespace) at each layer, for each key;
  - invalid ports (non-numeric, `0`, `65536`, a decimal fraction). An empty port is a missing value and falls through to the next layer;
  - the host allowlist, accepted and rejected, including the look-alikes in §4.7;
  - proof that `DB_NAME` from the env file is ignored;
  - launch-environment precedence for each connection key.
- **`PG*` non-redirection test:** with `PGHOST`, `PGPORT`, `PGDATABASE` and `PGUSER` set to other values, the effective settings, and the `current_database()` of a connected helper `DataSource`, are the E2E target.
- **Ordering test:** inside an e2e suite, while `apps/api/.env` says `clensy`, all three of these report the resolved Test database:
  - `ConfigService.get('DB_NAME')`;
  - a raw `DataSource` built by the helper;
  - `data-source.ts`.
- **Fail-closed test:** a Jest run with `DB_NAME=clensy` exits non-zero, with the resolver error, before any connection. The test runs Jest as a child process and asserts that no connection was opened.
- **Connection-level guard tests:**
  - **Stage 1.** Each of these is rejected before connecting:
    - a helper `DataSource` and a Nest application `DataSource`, each configured with a non-`_test` database name (for example `postgres` or `clensy`);
    - a helper `DataSource` configured with `url`, with `replication`, with a non-`postgres` `type`, or with a missing `database`;
    - a helper `DataSource` with a valid Test-database `database` and `extra.database` set to a non-Test database;
    - a helper `DataSource` with a valid Test-database `database` and `extra.connectionString` naming a non-Test database;
    - a helper `DataSource` with a valid Test-database `database` and `extra.Client` set;
    - a helper `DataSource` with a valid Test-database `database` and a custom `driver`.
    
    Each throws during initialisation, and the test asserts that **no connection was opened**. Asserting only that `initialize()` rejects is not enough. For example, it points `host`/`port` at a local listener that counts accepted sockets, and requires zero. Each rejected path must aim at that same counter, so a bypass would be counted:
    - `url` and `extra.connectionString` name the listener's host and port;
    - the custom `driver`, and the `extra.Client` class, are recording stubs that count their connect calls, and the test requires zero. No database needs to be created for this test (§4.9 item 4).
  - **Stage 2.** When the name the server reports differs from the validated name, the guard destroys the `DataSource` and throws. For example, the test runs the guard's comparison against a simulated `current_database()` result.
  - **Pass.** The same `DataSource`s initialise normally on a Test database.
  - **Nest retry delay (note a).** When stage 1 rejects the application's `DataSource`, `@nestjs/typeorm` retries the initialisation: by default 9 attempts, 3000 ms apart (`@nestjs/typeorm/dist/common/typeorm.utils.js:123`). Each retry is rejected by stage 1 again and opens no connection. The test fails with the guard error after about 24 seconds, not at once. M4 MUST give this test a timeout long enough for that. It MUST NOT change `database.module.ts` or other application code to avoid the retries.
- **`CREATE`/`DROP DATABASE` tests:** the helper refuses a non-matching name, a name it did not generate, and the E2E target name. It accepts its own generated names.
- **`globalSetup` tests.** These run the provisioning routine in a child process, outside any test environment, as `globalSetup` itself runs. So its maintenance connection never opens inside a test environment (§4.9 item 1), and the connection-level guard does not reject it.
  - it creates a missing, uniquely named `_test` database and migrates it;
  - a second run is a no-op: no `CREATE DATABASE`, 0 migrations applied, none pending;
  - a pending migration left after migrating fails the run;
  - the chosen migration-loading path (§4.4 item 3) applies exactly the repository's migration set;
  - it cleans up its own scratch database.
- **Static guard tests:**
  - no e2e file contains a literal non-`_test` database fallback, or reads `process.env.DB_*` outside the helper;
  - every e2e query text over `pg_stat_activity` or `pg_locks`, taken as a whole, restricts to `current_database()` (§4.3 item 6);
  - nothing that starts the app or a container references `seed-dev-owner` or `seed.ts`;
  - **cross-database DDL hygiene (invariant 4):** scratch-database `CREATE DATABASE` and `DROP DATABASE` appear only in the shared helper that enforces invariant 4. The one other permitted `CREATE DATABASE` is the E2E target's, in the `globalSetup` provisioning routine (§4.4 item 2); no `DROP DATABASE` and no other name is permitted there. No e2e file contains `ALTER DATABASE`. This check is **hygiene, not a security boundary** (§4.10);
  - **cross-database extension hygiene (invariant 14):** no e2e source file references `dblink` or `postgres_fdw`. This check is separate from the DDL check. It does not forbid extension creation in general: the migration suites' `CREATE EXTENSION IF NOT EXISTS "uuid-ossp"` on their own databases stays permitted. It is **source hygiene, not a security boundary**: it cannot detect indirect use, SQL built at run time, or behaviour introduced outside the scanned e2e source files, such as an extension reached through another dependency;
  - **session-termination hygiene (invariant 13):** no e2e file calls `pg_terminate_backend` or `pg_cancel_backend`. This check is separate from the DDL and extension checks. It is **source hygiene, not a security boundary** (§4.10, session termination);
  - **scanned set for the three checks above (invariants 4, 13 and 14):** every source file under `apps/api/test/`, meaning every file ending in `.ts`, `.js`, `.mjs`, `.cjs`, `.mts` or `.cts` (today all are `.ts`; a file with one of these extensions added later is included). It includes support code (`test/support/**`, `test/helpers/**`), `setup-e2e-env.ts`, `global-setup.ts` and the static guard test itself. Configuration files such as `jest-e2e.json` are not source files and are not in the set. No source file is excluded from these three checks. In these three checks, "e2e file" and "e2e source file" mean a file in this set. The set defines what the checks scan; it does not narrow invariants 4, 13 and 14, which apply to all e2e code. The DDL check's location allowances (the shared helper; the `globalSetup` provisioning routine) are allowances for specific statements in those files, not exclusions of the files. **Self-matching:** the static guard test MUST NOT contain literally any of the strings these three checks search for. It builds its search patterns from fragments, so that its own source matches none of them and needs no exclusion. A match anywhere in the scanned set, the guard test included, fails the check.
- **Seeder tests**, against the Test database through the core, with test credentials:
  - create;
  - unchanged on re-run, with the hash compared in the test and never printed, and the password check reporting `matches`;
  - unchanged with a different password, reporting `differs`, with no write;
  - each attribute mismatch (role, scope, tenant, disabled), with no write;
  - un-normalised and ambiguous matches, with no write;
  - `--reset-password`, with only the hash changed;
  - no other table or admin row changed, checked with before/after counts and digests.
- **Seeder unit tests:**
  - each guard rejection in §4.7, in order, including the invalid-settings and `PG*` cases from §6;
  - output contains the outcome, id, database, host and sources;
  - output never contains the email, the password or the hash.
- **CI evidence:** both e2e jobs keep `migration:run`, and `globalSetup` reports 0 applied and none pending.
- **M6 evidence:**
  - the `clensy` before/after snapshot (§4.5 item 4):
    - in `stopped` mode, with its `docker compose ps` and `pg_stat_activity` evidence;
    - or in `idle` mode, with the reason, the evidence and the stated limitations;
  - the full `pnpm --filter api test:e2e` run;
  - `test:e2e:release-gate`;
  - lint and type-check;
  - green CI on the PR.

---

## 8. Author calls

| # | Call | M3 status |
| --- | --- | --- |
| 1 | The resolver takes `DB_NAME` from the launch environment only, with `clensy_test` as the default. It never reads `DB_NAME` from a file (§4.2). | Stands (round 1) |
| 2 | The e2e run also enforces the Local host allowlist, the same list as the seeder (§4.2 item 3). Its limits are in §4.10. | Stands (round 1) |
| 3 | Migration scratch databases are renamed to `clensy_migration_<hex>_test`, and `CREATE`/`DROP DATABASE` is limited to names the suite generated (§4.5 item 2). | Stands, with R4 applied |
| 4 | The allowlist is exactly the ticket's three hosts. `::1` and other loopback forms are rejected. | Stands (round 1) |
| 5 | The seeder refuses a Test database (§4.3 item 4, §4.7 guard 5). | Stands, with R3 applied |
| 6 | `--reset-password` with no existing row creates the account (§4.7). | Stands (round 1) |
| 7 | CI **keeps** its explicit `migration:run` steps. `globalSetup` then confirms that no migration is pending (§4.4, §4.6). | Overturned in round 1 (R5); restated here |
| 8 | Seeder output omits every email. It shows the admin id and the configuration sources instead (§4.7). | Revised (N1) |
| 9 | There is no root `pnpm test:e2e` alias. There is a root `pnpm db:seed:dev-owner` alias. | Stands (round 1) |
| 10 | A missing Bootstrap tenant is a guard failure, not a create (§4.7 guard 6). | Stands (round 1) |
| 11 | Confinement is enforced by one connection-level guard on every e2e `DataSource`, not at each destructive site. The guard has two stages. **Before connecting (primary):** it validates the target and rejects every path that could replace it (`url`, `replication`, `extra.database`, `extra.connectionString`, `extra.Client`, a custom `driver`). **After connecting:** it confirms `current_database()` (§4.5 item 1). | Revised (R1, round 1; B1, round 2; B1-residual, round 2 confirmation). `extra.Client` added by revision 5 (owner decision D-M2-1, 2026-11-11), pending focused M3 |
| 12 | On `unchanged` only, the seeder reports a read-only password comparison: `matches` or `differs`. It never prints the email, the password or the stored hash (§4.7). | Approved by the owner (round 2) |
| 13 | Missing values (empty or whitespace) count as unset at every layer and fall back to the next source. The final effective settings are validated before they reach the driver. Empty shell values do not hard-fail. A password may be empty (§4.1, §4.2). | Approved by the owner as written (round 2) |
| 14 | The snapshot uses `stopped` mode by default. `idle` mode is an exception, limited by its evidence: activity and write-counter observations with stated limitations, repeated in `stopped` mode if inconclusive (§4.5 item 4). | Approved by the owner as amended by R8 (round 2) |

## 9. Gaps (flagged, not reopened)

- **G1. A ticket ambiguity, resolved by call 1.** The ticket says `setupFiles` "sets `DB_NAME`". It also says a run with `DB_NAME=clensy` fails. Taken literally, the first would overwrite the second. Call 1 reconciles them.
- **G2. The mismatch failure leaves the developer to fix the row by hand.** For example, the account was disabled through the console. This follows the ticket ("fails closed"). The M9 docs must give the manual steps (§4.8). No repair flag is proposed.
- **G3. Email normalisation: checked, no gap.** `LoginService` (`login.service.ts:43`), `AdminsService.create` (`admins.service.ts:66`) and `db:seed` all apply `toLowerCase()` with no trim. The seeder uses the same rule. Its case-insensitive lookup (§4.7) also catches rows that some other path stored un-normalised.
- **G4. `pnpm db:seed` and `db:seed:dev-owner` share `ADMIN_SEED_EMAIL`, and `db:seed` overrides the seeder's protection.**
  - **What `db:seed` does:** on every run it upserts the row with that email. It moves the account into the Bootstrap tenant, re-scopes it to `TENANT`, re-roles it to `TENANT_OWNER`, re-enables it and re-hashes its password (§3 item 10).
  - **The consequence:** an account that `db:seed:dev-owner` refused as mismatched is silently "repaired" by `db:seed`. So the fail-closed rule protects only the dedicated command.
  - **Sign-in:** the new hash is of the same `ADMIN_SEED_PASSWORD`, so sign-in keeps working. Afterwards `db:seed:dev-owner` reports `unchanged`, `password: matches`.
  - **Not changed:** `db:seed`'s behaviour stays as it is, by owner decision. The docs must state all of this, and that `db:seed` is not a safe way to check the owner (§4.8).
- **G5. No guard covers Compose or the API.** If a developer exports `DB_NAME=clensy_test` in a shell and starts Compose from it, the stack uses the Test database. Its data is lost on the next e2e run, but `clensy` is not harmed. M3 round 1 accepted handling this with documentation only, including the `docker compose config` check (§4.3 item 4, §4.8). A runtime guard remains a possible follow-on.
- **G6. The connection-level guard without changing application code: an M4 proof obligation.** §4.5 item 1 requires a two-stage guard that covers the Nest application's `DataSource` without touching `database.module.ts`.
  - **Why it looks credible (round 2 review, read-only):**
    - the pnpm store holds one `typeorm` copy (`typeorm@1.1.0`);
    - `@nestjs/typeorm` builds its `DataSource` with the public class, `new DataSource(options)`, then calls `initialize()` (`typeorm-core.module.js:170,191`);
    - no e2e file calls `jest.resetModules`, `jest.isolateModules` or `jest.mock('typeorm')`.
    
    So a hook that `setupFiles` installs on the public `DataSource` class, in the test module registry, would reach the Nest application, the helper and the scratch connections alike.
  - **What M4 must prove:** that the hook intercepts all three paths, with stage 1 running before any connection opens.
  - **If it cannot:** the slice returns to M2. M4 MUST NOT weaken the guard into per-site checks, drop stage 1, or change application code.
  - **Retries:** Nest retries a guard rejection, so the test needs an adequate timeout (§7, note a).
- **G7. A stale or diverged `clensy_test` is not detected automatically.**
  - **What the pending-migration check catches:** a schema *behind* the current code (§4.4 item 4).
  - **What it does not catch:**
    - a schema *ahead* of the code, which happens after switching to a branch with fewer migrations;
    - a *diverged* history: a migration with the same name but different content on another branch is recorded as executed and not re-run.
  - **How this slice handles both:** the documented reset of `clensy_test` (§4.8).

## 10. Acceptance criteria for this specification

This Draft may move to **Accepted** once the M3 reviewer confirms the round 2 corrections (B1, R8, R9). The conditions are:

- B1 is resolved: §4.5 item 1, §4.9 item 3 and §7 require stage 1 to validate the target before connecting, rejecting `url`, `replication`, `extra.database`, `extra.connectionString` and a custom `driver`, with tests asserting that no connection opens (revision 5 adds `extra.Client` to this list; see below);
- R8 is resolved: §4.5 item 4 makes `stopped` the default, and limits `idle` to an exception with its evidence and stated limits;
- R9 is resolved: calls 12–14 are recorded with the owner's decisions (§8);
- the M3 round 1 Required Revisions R1–R7 are resolved, and the adopted notes N1, N2, N4, N7 and N8 are reflected;
- the round 1 additional acceptance criteria are represented in §7:
  - names over 63 bytes rejected;
  - missing values fall back to the next source (call 13), invalid final settings such as ports are rejected, and `PG*` is proved to have no effect;
  - the connection-level guard covers the application `DataSource`;
  - `CREATE`/`DROP DATABASE` limited to the suite's own generated names;
  - CI keeps `migration:run`, with none pending afterwards;
  - the snapshot's no-writer mode recorded, with `stopped` as the default;
- gaps G6 and G7 in §9 are recorded as an M4 proof obligation and a documented limitation;
- the §4.3 mixed-scenario table and properties are judged complete for host-run e2e alongside a running Compose stack;
- the invariants in §4.9 and the test expectations in §7 cover every acceptance criterion of #227;
- the owner decisions of 2026-11-06 are unchanged: one slice, `ADMIN_SEED_*` reused, no audit writes, the Bootstrap tenant.

### Revision 5 (slice-local amendment)

**What it changes.** It applies the owner's M5 decisions of 2026-11-11 on four specification-level findings from the review of the implementation plan:
- **D-M2-1:** `extra.Client` is rejected in stage 1 (thesis, §4.5 item 1, §4.9 item 3, §5, §7, §8 call 11).
- **D-M2-2:**
  - §4.3 item 1 and §4.10 claim no more than connection confinement and database-scoped statements;
  - §4.10 records the cross-database risk of a superuser e2e role;
  - §4.10 records session termination as a separate consideration;
  - §4.10 records the accepted risk from checkouts without this slice, and the owner's inspection before seeding;
  - invariant 4, §4.5 item 2 and §2 forbid `ALTER DATABASE` in e2e code;
  - §7 adds a cross-database DDL hygiene check.
- **D-M2-3:** concurrent runs from separate checkouts are recorded as information in §4.10, not as an invariant.
- **D-M2-4:** the §4.5 item 4 heading and framing say "no observed change".

**What it does not change.**
- It adds no requirement on Compose, CI, `.env` files or developer setup.
- It adds no new connection mechanism, and leaves the snapshot's required content unchanged.
- It does not reopen any owner decision or author call outcome.
- The acceptance criteria above (revision 4) are unaffected, except that the B1 path list now includes `extra.Client`.

**Revision 5 may move to Accepted once a focused M3 confirms:**
- `extra.Client` is in every list of rejected stage 1 paths (thesis, §4.5 item 1, §4.9 item 3, §5, §7, §8 call 11, §10), with a test asserting that no connection opens;
- neither §4.3 item 1 nor §4.10 claims that no e2e statement can change or block `clensy`, or that an e2e run can only affect `_test` databases;
- §4.10 records:
  - the cross-database residual risk;
  - session termination as a separate consideration;
  - concurrent runs as information only;
  - checkouts without this slice, with the owner's inspection before seeding;
- invariant 4 covers `ALTER DATABASE`;
- the §7 DDL check is labelled hygiene, not a security boundary, and does not forbid the migration suites' `uuid-ossp` extension;
- §4.5 item 4 claims no observed change, not that no change happened.

**Questions for the focused M3, and the owner's decisions (2026-11-11, applied in revision 5a):**
1. **Session termination.** Should `pg_terminate_backend` and `pg_cancel_backend` stay a §4.10 consideration only? The alternatives were a separate hygiene check, or a normative limit. They can interrupt sessions and affect availability, but change no data. **Decided:** a separate invariant (§4.9 item 13), with its own §7 hygiene check, separate from the DDL check. The §4.10 residual risk remains.
2. **The form of the `ALTER DATABASE` limit.** Revision 5 forbids it in e2e code outright, because e2e code has no use for it. The alternative was to apply the same three name limits as `CREATE`/`DROP DATABASE`. **Decided:** the outright prohibition stays, with no name-based exceptions.

### Revision 5a (correction to revision 5)

**What it changes.** It applies the focused M3 return of revision 5 (2026-11-11) and the owner's decisions on the two M3 questions:
- **R5-1:** invariant 4 and the §7 DDL check place one statement outside the prohibition: the `globalSetup` provisioning routine's `CREATE DATABASE` of the E2E target (§4.4 item 2). Scratch-database `CREATE` and `DROP DATABASE` stay confined to the shared helper. The exception covers no other name and no `DROP`.
- **N5-1:** invariant 14 (§4.9 item 14): e2e code MUST NOT reference `dblink` or `postgres_fdw`. A separate §7 hygiene check enforces it. `uuid-ossp` stays permitted.
- **N5-2:** the §4.10 superuser operations are examples, not a complete list.
- **N5-3:** §4.10 cites the official `postgres` image documentation for the superuser statement, as documented rather than observed behaviour.
- **N5-4:** the first revision 5 criterion lists §5 and §10.
- **M3 question 1:** invariant 13 forbids `pg_terminate_backend` and `pg_cancel_backend` in e2e code, with its own §7 hygiene check. The §4.10 residual risk remains.
- **M3 question 2:** the outright `ALTER DATABASE` prohibition stays.

**What it does not change.** It reopens no M2 decision or D-M2-2 amendment, removes none of the revision 5 criteria above, and adds no Compose, CI, `.env` or developer-setup requirement. Q1–Q7 of the M5 review are not answered by it.

**Revision 5a may move to Accepted, together with revision 5, once a focused M3 confirms:**
- the revision 5 criteria above still hold;
- invariant 4 and §7 permit only the `globalSetup` `CREATE DATABASE` of the E2E target outside the shared helper, and no other name or `DROP`;
- the `dblink`/`postgres_fdw` reference check, the DDL check and the session-termination check are separate §7 checks, each labelled hygiene, not a security boundary;
- invariant 14 exists, limited to `dblink` and `postgres_fdw`, and the §7 extension check enforces it;
- `uuid-ossp` stays permitted;
- invariant 13 exists, and §4.10 still records session termination as a residual risk;
- the §4.10 superuser list is presented as examples, with its documentation basis cited.

### Revision 5b (correction to revision 5a)

**What it changes.** It applies findings F1–F5 of the independent focused M3 review of revision 5a (2026-11-11), as the owner decided:
- **F1:** §4.5 item 2 and §2 state the `globalSetup` exception for the E2E target's `CREATE DATABASE` that invariant 4 already states.
- **F2:** §7 defines the scanned set for invariants 4, 13 and 14:
  - every source file under `apps/api/test/` (`.ts`, `.js`, `.mjs`, `.cjs`, `.mts` or `.cts`), support code, `setup-e2e-env.ts`, `global-setup.ts` and the static guard test included, with no source file excluded (as corrected by revision 5c);
  - the static guard test builds its search patterns from fragments, so it contains none of the searched-for strings and needs no exclusion.
- **F3:** the header Revision note names invariant 14 for revision 5a.
- **F4:** §4.10 names invariants 4 and 14 and their §7 scans.
- **F5:** §4.10 describes unscanned code as code outside the scanned files, such as a dependency.

**What it does not change.** It changes no invariant's prohibited behaviour and widens no exception. Its one new requirement is on how the static guard test is written (F2, self-matching), and its one new definition is the set of files the checks for invariants 4, 13 and 14 scan (F2). That set defines check coverage, not the scope of the invariants (revision 5c). It removes none of the revision 5 or 5a criteria above. Finding F6 (the `globalSetup` test's cleanup `DROP` goes through the shared helper; the static check verifies where that `CREATE DATABASE` appears, not which name it creates) is an M4 obligation and does not change this specification.

**Revision 5b may move to Accepted, together with revisions 5 and 5a, once a final focused M3 confirms:**
- the revision 5 and 5a criteria above still hold;
- §4.5 item 2, §2 and invariant 4 state the same `globalSetup` exception, limited to `CREATE DATABASE` of the E2E target;
- §7 defines the scanned set, excludes no source file under `apps/api/test/` from the three checks, and states how the guard test avoids matching itself without excluding any file;
- the DDL, extension and session-termination checks stay separate, and `uuid-ossp` stays permitted;
- §4.10 names invariants 4 and 14, and no longer implies that scanned helpers are unscanned.

### Revision 5c (correction to revision 5b)

**What it changes.** It applies findings R1 and R2 of the independent final focused M3 review of revision 5b (2026-11-11), as the owner decided:
- **R1:** revision 5b defined "e2e code", "e2e file" and "e2e source file" as the scanned set for invariants 4, 13 and 14, which narrowed those invariants to the files the checks scan. §7 now uses "e2e file" and "e2e source file" only within the three checks, and states that the scanned set defines check coverage and does not narrow invariants 4, 13 and 14, which apply to all e2e code.
- **R2:** the scanned set is every source file under `apps/api/test/` (`.ts`, `.js`, `.mjs`, `.cjs`, `.mts` or `.cts`, including files added later), not only `.ts` files. It names `test/helpers/**`, and states that configuration files such as `jest-e2e.json` are not source files. The revision 5b subsection above is corrected to match ("no source file excluded").

**What it does not change.** It adds no prohibition, widens no exception, and changes no invariant. Notes N1 (other files that need a searched-for string as test data build it from fragments too) and N2 (case and whitespace in the patterns) are M4 matters and do not change this specification.

**Revision 5c may move to Accepted, together with revisions 5, 5a and 5b, once a final focused M3 confirms:**
- the revision 5, 5a and 5b criteria above still hold;
- no text defines the scope of invariants 4, 13 or 14 by the scanned set;
- the scanned set covers every source file under `apps/api/test/` with the listed extensions, and excludes no source file.

Accepting this specification does not authorise implementation. M4 Implementation Planning comes next.
