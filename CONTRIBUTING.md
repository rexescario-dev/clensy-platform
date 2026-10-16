# Contributing

How changes get from an issue to `main`. To set up the project first, see the [README](README.md#run-locally).

## Workflow

Work follows the installed engineering workflow's gates: M1 conventions, M2 specification, M3 design review, M4 implementation planning, M5 plan review, M6 implementation, M7 code review, M8 refactoring, M9 documentation, M10 workflow validation. Start at [`docs/workflows/README.md`](docs/workflows/README.md); it decides which gate a piece of work starts at and which reviews it needs.

- **One tracking issue per delivery slice**, on GitHub. Prefer one pull request per issue, carrying the plan and its implementation.
- **Specs and plans** are written to [`docs/superpowers/`](docs/superpowers/README.md). An Accepted spec or plan is authoritative; later stages do not redesign it.
- **Code review (M7)** for a slice that changes application code, authorization, tenant isolation, or the schema or database needs a fresh, independent reviewer. Docs-only and configuration-only slices may be self-reviewed. The policy is in [`CLAUDE.md`](CLAUDE.md).
- `docs/workflows/`, `docs/skills/`, `docs/conventions/`, `.claude/skills/` and `tooling/eslint.contextforge.mjs` are installed and updated by the workflow installer (listed in `workflow.yaml`). Don't edit them to record project policy; record it in `CLAUDE.md` or this file.

## Branches, commits and pull requests

- **Branch:** `<type>/<issue>-<short-slug>` from `main`, for example `feat/162-laundry-price-review` or `fix/173-drawer-history-entry-marker`.
- **Commits:** conventional style, `<type>(<scope>): <summary>`, where the scope is a package (`api`, `web`, `ui`) or the issue number for workflow records, for example `feat(web): …` or `docs(162): record M7`.
- **Pull requests** target `main` and need the four required checks (**Lint**, **Test**, **Release gate**, **API e2e**) passing on a branch that is up to date with `main`. Direct pushes to `main` are blocked. Details: [testing and CI](docs/development/testing-and-ci.md#required-checks-on-main).

## Before you open a pull request

```bash
pnpm lint
pnpm --filter api exec tsc --noEmit
pnpm --filter web exec tsc --noEmit
pnpm test
```

If you changed the API, also run the e2e suites ([how](docs/development/testing-and-ci.md#api-end-to-end-suites)). If you changed the GraphQL schema, run `pnpm --filter @clensy/client codegen`. If you changed an entity, generate and review a migration ([how](docs/development/database-migrations.md)).

## Rules that tests enforce

- New GraphQL operations, REST routes, relations and tenant-owned entities must be classified in the authorization guard suites and the release gate. See [authentication and tenancy](docs/architecture/auth-and-tenancy.md#how-this-is-enforced-in-tests).
- Frontend package boundaries (`apps/web` uses only `@clensy/ui` for UI, never shadcn or Radix directly; one app i18n provider; no deep imports into `@clensy/web`) are checked by lint and guard tests. See the [architecture overview](docs/architecture/overview.md#frontend-package-boundaries).

## Documentation

Update documentation in the same pull request as the change. Where things go:

| You changed… | Update |
| --- | --- |
| Setup, environment variables, Docker, ports | [`docs/getting-started/local-development.md`](docs/getting-started/local-development.md), and the README's run steps if they changed |
| A migration with hand-written SQL | [`docs/development/database-migrations.md`](docs/development/database-migrations.md) |
| CI jobs, test commands, the release gate | [`docs/development/testing-and-ci.md`](docs/development/testing-and-ci.md) |
| Auth, roles, tenant scoping, audit | [`docs/architecture/auth-and-tenancy.md`](docs/architecture/auth-and-tenancy.md) |
| A module, package or how parts communicate | [`docs/architecture/overview.md`](docs/architecture/overview.md) and the package's README |
| API behavior worth a slice note | A new section in [`docs/history/shipped-slices.md`](docs/history/shipped-slices.md), plus the feature page |
| A web page or component behavior | `apps/web/README.md` or the package README |
| A feature with a lifecycle or business rules | Its page under [`docs/features/`](docs/features/) |

Writing conventions are in the [documentation home](docs/README.md#writing-conventions).
