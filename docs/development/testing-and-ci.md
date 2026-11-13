# Testing and CI

Which test suites exist, how to run them, what CI checks on every pull request, and how `main` is protected.

## Running tests

Run from the repository root after `pnpm install`.

| Command | Runs |
| --- | --- |
| `pnpm test` | Every workspace `test` script through Turborepo: API unit tests (Jest), web and package tests (Vitest). No database needed. |
| `pnpm lint` | Every workspace `lint` script (ESLint). In `apps/web`, `packages/ui` and `packages/web` this includes `react-hooks/rules-of-hooks` and `react-hooks/exhaustive-deps` at `error`, so a violation fails the **Lint** check ([spec](../superpowers/specs/2026-10-18-react-hooks-lint-rules-design.md)). |
| `pnpm --filter api exec tsc --noEmit` | Type-check `apps/api` (CI runs this in the Lint job). |
| `pnpm --filter web exec tsc --noEmit` | Type-check `apps/web` (CI runs this in the Lint job). |
| `pnpm build` | Every workspace `build` script. |
| `pnpm --filter <name> test` | One package, e.g. `web`, `api`, `@clensy/ui`, `@clensy/web`, `@clensy/validation`, `@clensy/client`. |

### API end-to-end suites

The e2e suites in `apps/api/test/` (`*.e2e-spec.ts`) boot the real API against PostgreSQL.

```bash
pnpm --filter api build:graphiql     # once on a fresh checkout: app.e2e-spec.ts serves the bundle
pnpm --filter api test:e2e           # every e2e suite, including the release gate
pnpm --filter api test:e2e:release-gate
```

- **Which database.** e2e runs only against a **Test database**: a name that matches `^(?=.{6,63}$)[a-z][a-z0-9_]*_test$`, so it uses only lowercase ASCII letters, digits and underscores, starts with a letter, ends in `_test`, and is 6 to 63 bytes long (Postgres's identifier limit, so the name is never silently truncated). The name is `DB_NAME` from the launch environment if it is set, otherwise `clensy_test`. It never takes `DB_NAME` from a file, and fails before connecting if the name breaks the rule, so `Clensy_test`, `clensy-test` or a 64-byte name fails just as `clensy` does. Host, port, user and password come from the launch environment, then `apps/api/.env`, then the defaults. See [development and e2e databases](../getting-started/local-development.md#development-and-e2e-databases).
- **Setup is automatic.** Jest's `globalSetup` creates the Test database if it is missing, runs every pending migration, and confirms that none is pending; there is no manual `migration:run` step. It needs a reachable local Postgres whose user may `CREATE DATABASE`. The migration suites (`*.migration.e2e-spec.ts`) also create and drop scratch databases named `clensy_migration_<32 hex>_test`.
- **A guard on every connection.** Every `DataSource` in an e2e test is checked before it connects and again after, so no e2e connection can be opened to a database that is not a Test database. A static test (`e2e-static-guards.e2e-spec.ts`) checks the e2e sources for forbidden patterns; it is hygiene, not a security boundary: it cannot see SQL or settings built at run time, so it does not prove that every database access path is covered.
- **Two test-only overrides.** `E2E_GUARD_JEST_CONFIG` and `E2E_GUARD_PACKAGE_JSON` are read only by `e2e-static-guards.e2e-spec.ts`. Each names the path of a JSON file that one check reads instead of its default (`apps/api/test/jest-e2e.json` and `apps/api/package.json`); unset means the default. They exist only so a characterization break can point those checks at a temporary copy. Do not set them otherwise. The static test fails if either name appears in `apps/api/package.json`, `apps/api/test/jest-e2e.json`, `apps/api/jest.config.ts` (if present), the root `package.json`, `turbo.json` or a `.github/workflows/*.yml` file; it does not see a value exported in a shell or set anywhere else.
- No `JWT_SECRET` is needed: under Jest (`NODE_ENV=test`) the auth services fall back to a test-only secret.
- CI always runs them against a fresh Postgres 16 service container.

## CI

`.github/workflows/ci.yml` runs on every pull request and every push to `main`. All jobs use Node 20 and `pnpm install --frozen-lockfile`.

| Job | Steps |
| --- | --- |
| **Lint** | `pnpm run lint`, then `tsc --noEmit` for `apps/api` and `apps/web` |
| **Test** | `pnpm run test` |
| **Release gate** | Fresh Postgres (`clensy_test`) → `migration:run` → `test:e2e:release-gate`, whose `globalSetup` then confirms none pending |
| **API e2e** | Fresh Postgres (`clensy_test`) → `build:graphiql` → `migration:run` → every e2e suite except the release gate, whose `globalSetup` then confirms none pending |

### Required checks on `main`

Since [#140](https://github.com/rexescario-dev/clensy-platform/issues/140), `main` is governed by the repository ruleset **`main: required CI checks`**:

- It requires **Lint**, **Test**, **Release gate** and **API e2e**, each reported by GitHub Actions, on a pull request branch that is up to date with `main`. A check that never reports blocks the merge just as a failing one does.
- The only bypass is the repository admin role, on pull requests only, so nothing is pushed directly to `main`.
- **The four job names are part of the ruleset.** Renaming, removing or splitting one of those jobs must update the ruleset in the same change, or every merge blocks.
- GitHub is the source of truth for this configuration: `gh api repos/rexescario-dev/clensy-platform/rulesets` lists the rulesets, and `gh api repos/rexescario-dev/clensy-platform/rulesets/<id>` reads one. The bypass list is returned only to users with write access.

Design record: [required CI checks spec](../superpowers/specs/2026-10-06-required-ci-checks-design.md).

## Two-tenant release gate

`apps/api/test/two-tenant-release-gate.e2e-spec.ts` is the multi-tenancy release criterion ([#92](https://github.com/rexescario-dev/clensy-platform/issues/92)). It boots the real API against two fresh tenants and checks, in order:

1. **Inventory.** Every live GraphQL root field and controller route is classified (`test/helpers/root-operation-inventory.ts`, `test/helpers/http-route-inventory.ts`), and every tenant operation or route has exactly one role-matrix entry and one probe. A new operation fails the gate until it has both.
2. **Policy.** The pinned role matrix (`test/release-gate/role-matrix.ts`, transcribed from the Accepted specs) equals the live `@Roles()`. `SUPER_ADMIN` is on no tenant operation.
3. **Authentication.** Every tenant operation and route rejects a request with no session.
4. **Authorization.** Each of the 7 roles gets exactly the matrix's answer on its own tenant's data.
5. **Isolation.** Every allowed role's cross-tenant read, write, reference and filter answers as "missing", indistinguishable from an id that never existed; unfiltered lists return only the caller's own rows, counted against the database.
6. **Integrity.** Those cross-tenant calls changed no row in either tenant and wrote no audit row.
7. **Symmetry.** Steps 4–6 again with the tenants swapped.

- **Provisioning rule.** The interim rule "do not provision a second production tenant" (program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81)) was lifted by the #92 PR merging with this gate passing; a local pass alone does not lift it. Before provisioning another production tenant after later changes, run the gate again.
- **Changing the matrix.** Update `role-matrix.ts` only when an Accepted authorization spec changes.
- **Not covered by the gate:** relation-field authorization ([#106](https://github.com/rexescario-dev/clensy-platform/issues/106), pinned by `relation-field-authorization.e2e-spec.ts`), the web UI, and query counts.

The other authorization and isolation guard suites are listed in [authentication and tenancy](../architecture/auth-and-tenancy.md#how-this-is-enforced-in-tests).

## Web and package tests

- `apps/web` and the `@clensy/*` packages use Vitest. Several web tests are **guard tests** that scan source files for forbidden imports or patterns (for example the i18n provider boundary and the drawer history rules). They are described where the rule lives: [`apps/web/README.md`](../../apps/web/README.md), [`packages/web/README.md`](../../packages/web/README.md), [`packages/ui/README.md`](../../packages/ui/README.md).
- After a GraphQL schema change, regenerate the typed client with `pnpm --filter @clensy/client codegen`. It reads `apps/api/src/schema.gql` and the `.graphql` documents in `packages/client/src`.
