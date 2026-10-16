# Clensy documentation

Start here. Pages are grouped by what you are trying to do. Current guides describe the system as it is on `main`; design records and history explain how it got there.

## Find what you need

| I want to… | Read |
| --- | --- |
| Run the project on my machine | [Local development](getting-started/local-development.md) |
| Understand the parts and how they talk | [Architecture overview](architecture/overview.md) |
| Understand sessions, roles and tenant isolation | [Authentication and tenancy](architecture/auth-and-tenancy.md) |
| Change the database schema | [Database migrations](development/database-migrations.md) |
| Run tests, or understand a CI failure | [Testing and CI](development/testing-and-ci.md) |
| Work on laundry orders | [Laundry orders](features/laundry.md) |
| Work on the API | [`apps/api` README](../apps/api/README.md) |
| Work on the web console | [`apps/web` README](../apps/web/README.md), [`@clensy/ui`](../packages/ui/README.md), [`@clensy/web`](../packages/web/README.md), [`@clensy/validation`](../packages/validation/README.md) |
| Open a pull request | [Contributing](../CONTRIBUTING.md) |
| Find out why something was designed a certain way | [Design records](superpowers/README.md) |

## Reading paths

- **New developer.** [README](../README.md) → [local development](getting-started/local-development.md) → [architecture overview](architecture/overview.md) → [authentication and tenancy](architecture/auth-and-tenancy.md) → [contributing](../CONTRIBUTING.md).
- **Feature developer.** The Accepted spec for the area ([design records](superpowers/README.md)) → the app or package README → [testing and CI](development/testing-and-ci.md) → [database migrations](development/database-migrations.md) if the schema changes.
- **Reviewer.** [Authentication and tenancy](architecture/auth-and-tenancy.md) (the rules every change must keep) → the slice's spec and plan → the [M7 code review prompt](workflows/prompts/code-review.md).
- **Operator.** [Local development](getting-started/local-development.md) (stack, environment, logs) → [database migrations](development/database-migrations.md#migrating-an-existing-database) (pre-checks on existing data) → the [release gate](development/testing-and-ci.md#two-tenant-release-gate). There is no deployment guide: the repository has no deployment configuration beyond the local Docker Compose stack.

## Map

```text
docs/
├── README.md                  this page
├── getting-started/
│   └── local-development.md   environment files, Docker stack, seed, URLs, troubleshooting
├── architecture/
│   ├── overview.md            system context, containers, packages, modules, repository map
│   └── auth-and-tenancy.md    request lifecycle, roles, isolation layers, guard suites
├── development/
│   ├── database-migrations.md workflow and the hand-written SQL catalogue
│   └── testing-and-ci.md      commands, CI jobs, required checks, release gate
├── features/
│   └── laundry.md             laundry order lifecycle, weighing, preview and pricing
├── history/
│   └── shipped-slices.md      one note per API delivery slice (historical)
├── superpowers/               design records: specs/ and plans/ (see its README)
├── workflows/                 engineering workflow M1–M10 (installer-managed)
├── skills/                    UI/UX skill references (installer-managed)
└── conventions/               JavaScript/TypeScript conventions (installer-managed)
```

App and package READMEs live next to their code: [`apps/api`](../apps/api/README.md), [`apps/web`](../apps/web/README.md), [`packages/ui`](../packages/ui/README.md), [`packages/web`](../packages/web/README.md), [`packages/validation`](../packages/validation/README.md).

## Which document wins

| Kind | Examples | Authority |
| --- | --- | --- |
| **Accepted spec** | `superpowers/specs/*` | Binding contract for the behavior it covers. |
| **Code-pinned policy** | `apps/api/test/release-gate/role-matrix.ts`, guard tests, the GitHub ruleset | The executable source of truth; docs describe it and link to it. |
| **Current guide** | `getting-started/`, `architecture/`, `development/`, `features/`, app and package READMEs | Describes `main` today. Must agree with the spec; if not, the guide is wrong. |
| **Record** | `superpowers/plans/*`, `history/*` | True when written. Never rewritten to match later code. |
| **Installer-managed** | [`workflows/`](workflows/README.md), [`skills/ui-ux/`](skills/ui-ux/README.md), [`conventions/javascript/`](conventions/javascript/README.md) | Owned by the workflow installer; don't edit for project policy. The JavaScript/TypeScript conventions apply to all code; the UI/UX guidance applies to UI work. |

Each subject has one current home, and other pages link to it instead of repeating it:

| Subject | Current home |
| --- | --- |
| Setup, environment variables, local URLs | [Local development](getting-started/local-development.md) |
| Sessions, roles, tenant isolation, audit | [Authentication and tenancy](architecture/auth-and-tenancy.md) |
| Role permissions per operation | `apps/api/test/release-gate/role-matrix.ts` |
| Schema changes and hand-written SQL | [Database migrations](development/database-migrations.md) |
| CI, tests, required checks, release gate | [Testing and CI](development/testing-and-ci.md) |
| API layering, HTTP surface, GraphiQL | [`apps/api` README](../apps/api/README.md) |
| Web routes, page behavior, i18n | [`apps/web` README](../apps/web/README.md) |
| UI and domain component boundaries | [`@clensy/ui`](../packages/ui/README.md), [`@clensy/web`](../packages/web/README.md) |
| Laundry lifecycle and pricing | [Laundry orders](features/laundry.md) |
| Contribution process, where docs go | [Contributing](../CONTRIBUTING.md#documentation) |

## Writing conventions

- **Put the answer first.** Open each page with one or two sentences saying what it covers.
- **Plain English, short paragraphs.** Numbered steps for procedures, tables for comparisons and reference, code blocks for anything to copy.
- **Link, don't repeat.** If a subject has a current home (table above), link to it.
- **Relative links** for anything in the repository. Name files in `lower-kebab-case.md`.
- **Diagrams in Mermaid**, inside the Markdown they explain, each followed by an italic sentence saying what it shows. Draw only what the code does.
- **No secrets.** Name environment variables; never copy their values.
- **Records stay records.** Add a new note or amendment instead of editing a plan or history note to match today's code.
- **Verify before writing.** Commands come from `package.json`, `docker-compose.yml` and `.github/workflows/ci.yml`; behavior comes from the code or an Accepted spec.
