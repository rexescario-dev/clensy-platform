# Clensy Platform

A NestJS + TypeORM + GraphQL comparison harness — built to evaluate TypeORM's developer experience against [`flash-sale-system`](https://github.com/rexescario-dev/flash-sale-system)'s NestJS + Prisma + GraphQL stack, to settle on a personal standard. It also runs REST and GraphQL side by side against the same business logic, to compare those two API styles directly.

pnpm workspace + Turborepo monorepo:

```text
apps/
├── api/      NestJS + TypeORM + GraphQL (code-first, Apollo) + REST
├── web/      Next.js (App Router) web console — /login, /admin, /customers, /cleaners
└── worker/   not yet implemented

packages/
├── ui/       shared React components: Button, DataTable, FormField, StatusBadge
├── client/   Apollo Client + graphql-codegen-generated hooks against apps/api's schema
├── graphql/  not yet implemented
├── auth/     not yet implemented
├── domain/   not yet implemented
├── config/   not yet implemented
└── testing/  not yet implemented
```

`packages/graphql`, `auth`, `domain`, `config`, `testing` stay empty stubs deliberately — the [Phase 1 design](docs/superpowers/specs/2026-08-14-clensy-platform-phase1-design.md) defers each extraction until a second consumer actually needs the shared code, rather than speculatively factoring it out now.

## `apps/api/src` structure

Each business module is layered domain → application → infrastructure → presentation, so REST and GraphQL are thin adapters over the same business logic rather than separate implementations. `bookings` below is the worked example (it's also the only module with a REST surface, kept for the REST/GraphQL comparison this repo exists to run); `modules/admins`, `modules/customers`, and `modules/cleaners` follow the identical domain/application/infrastructure/presentation layering but are GraphQL-only, per the [Phase 1 design](docs/superpowers/specs/2026-08-14-clensy-platform-phase1-design.md)'s "Presentation: GraphQL only" default for every module after `bookings`. `platform/auth` (JWT session auth, `AuthGuard`, `@Roles()`/`@CurrentUser()`) and `platform/audit` (`AuditEvent`, `AuditLogger`) are shared platform infrastructure, not business modules — every mutation across `admins`/`customers`/`cleaners` is authenticated, role-gated, and audit-logged through them (see the [Admin Foundation](docs/superpowers/specs/2026-08-14-admin-foundation-design.md), [Customers & Properties](docs/superpowers/specs/2026-08-15-customers-properties-design.md), and [Cleaners & Teams](docs/superpowers/specs/2026-08-16-cleaners-teams-design.md) specs):

```text
src/
├── app/
│   └── app.module.ts       composition root — wires platform/ + modules/
├── main.ts                 bootstrap: global ValidationPipe, Swagger UI
│
├── modules/
│   └── bookings/
│       ├── domain/                    plain TypeScript — no NestJS/TypeORM/GraphQL decorators
│       │   ├── booking.ts
│       │   └── booking-status.ts
│       │
│       ├── application/
│       │   ├── commands/              transport-agnostic contracts (CreateBookingCommand, ...)
│       │   └── services/              use-case implementation (bookings.service.ts)
│       │
│       ├── infrastructure/
│       │   └── persistence/           TypeORM entity — kept separate from domain and from
│       │       ├── booking.entity.ts  the GraphQL/REST types (see "Two presentation surfaces" below)
│       │       └── seed/              seed-data.ts (plain data) + seeder.ts (TypeORM upsert)
│       │
│       ├── presentation/
│       │   ├── graphql/               resolver, ObjectType, InputTypes (own class-validator rules)
│       │   └── rest/                  controller, DTOs (own class-validator rules + @ApiProperty)
│       │
│       └── tests/                     mirrors application/ · graphql/ · rest/
│
└── platform/                          shared infrastructure, not business logic
    ├── config/
    ├── database/
    │   ├── database.module.ts         TypeOrmModule wiring (synchronize: false — schema comes
    │   │                               from migrations, see "Database migrations" below)
    │   ├── data-source.ts             plain DataSource for the TypeORM CLI
    │   ├── migrations/                generated migration files
    │   └── seed.ts                    `pnpm db:seed` entrypoint — calls each module's seeder
    └── graphql/
        ├── graphql.module.ts          Apollo driver wiring (playground: false — no landing
        │                               page at /graphql, see "GraphQL IDE" below)
        ├── graphiql.controller.ts     GET /graphiql (HTML) — dev-only (registered only when
        │                               NODE_ENV !== 'production')
        ├── graphiql/
        │   └── graphiql.entry.ts      browser entry point — bundled by scripts/build-graphiql.ts
        ├── directives/                reserved, not yet implemented
        └── scalars/                   reserved, not yet implemented

apps/api/
├── scripts/
│   └── build-graphiql.ts   esbuild: React + GraphiQL + CSS + Monaco's worker bundles, locally
│                            bundled and served entirely from application-owned static assets
│                            — no CDN (see "GraphQL IDE" below; NOT a single-file bundle)
└── public/graphiql/        generated, gitignored — served at /graphiql-static (see below)
```

**Two presentation surfaces, one application layer:** both `presentation/graphql/booking.resolver.ts` and `presentation/rest/booking.controller.ts` map their own transport input (`CreateBookingInput` / `CreateBookingDto`) into the same `CreateBookingCommand` before calling `BookingsService` — the command is the shared contract, not either DTO. This is also why the TypeORM entity, the domain type, and the GraphQL `BookingType` are three separate classes instead of one decorated class: it keeps persistence, business rules, and each transport's shape free to evolve independently.

## Setup

```bash
cp .env.example .env   # first time only
docker compose up -d --build
```

That's it — `docker compose up` builds and runs `apps/api` itself (not just Postgres), connecting to the `postgres` service over the container network. A `migrate` service runs the pending migrations once before `api` starts (`depends_on: condition: service_completed_successfully`); the table is then empty but schema-correct — see "Seeding fake data" below. `apps/web` has no `docker-compose.yml` service yet — this path gives you the API only; use the hot-reload path below to also run the web console.

For local iteration with hot-reload instead (edits reflected immediately, no rebuild):

```bash
pnpm install
docker compose up -d postgres   # Postgres only
pnpm --filter api migration:run # apply migrations — first time only, or after a new one is added
pnpm dev                         # apps/api AND apps/web in watch mode, in parallel (Turborepo)
```

## Database migrations

No `synchronize: true` — schema changes go through real, reviewable migrations, closer to how `flash-sale-system` uses Prisma migrations.

```bash
pnpm --filter api migration:generate add customer phone number  # after changing an entity
pnpm --filter api migration:run       # apply pending migrations
pnpm --filter api migration:revert    # roll back the last one
```

`migration:generate` takes a plain phrase (or an already-PascalCase name, or anything in between — `scripts/generate-migration.ts` normalizes it) and writes it into `src/platform/database/migrations/` as `<timestamp>-AddCustomerPhoneNumber.ts`.

`generate` diffs the TypeORM entities registered in `data-source.ts` (`BookingEntity`, `AdminUserEntity`, `AuditEventEntity`, `CustomerEntity`, `PropertyEntity`, `TeamEntity`, `CleanerEntity`) against the actual database, so run it against an environment that already has the *previous* migration applied (not a synchronized or ad-hoc schema) — otherwise the diff will be wrong. Two exceptions, same reason both times: `PropertyEntity.customerId` (see the [Customers & Properties spec](docs/superpowers/specs/2026-08-15-customers-properties-design.md) §4.5) and `CleanerEntity.teamId` (see the [Cleaners & Teams spec](docs/superpowers/specs/2026-08-16-cleaners-teams-design.md) §4.1) both carry no TypeORM relation decorator by design, so their foreign keys are hand-written directly into `1786807294116-AddProperty.ts`'s and `1786871992353-AddCleaner.ts`'s SQL respectively, rather than inferred by `generate` — re-running `generate` after touching either entity will propose dropping the constraint; don't apply that. `apps/api/src/platform/database/data-source.ts` is the plain `DataSource` these commands use (the CLI can't consume `database.module.ts`'s Nest-wrapped, `ConfigService`-driven config directly). It needs its own `tsconfig.cli.json` (forces `commonjs`/`node` module resolution) — TypeORM's CLI loads the datasource via Node's native ESM resolver, which the rest of the project's `nodenext` config doesn't satisfy for a plain `ts-node` script.

## Seeding fake data

Seeding is an explicit, separate step — it never runs automatically on boot, so starting the app never has a surprise side effect on the database.

```bash
pnpm db:seed
```

Inserts (or re-applies, if already present) 3 fake bookings with fixed, deterministic ids (`00000000-…-0001`, `…0002`, `…0003`) via `INSERT ... ON CONFLICT (id) DO UPDATE` — safe to run as many times as you like, it never duplicates rows. Run it once after `docker compose up` (or after `pnpm dev`, against the same Postgres) to have data to look at in either API.

Seed data lives at `apps/api/src/modules/bookings/infrastructure/persistence/seed/booking.seed-data.ts` (plain TypeScript, no TypeORM); `booking.seeder.ts` is what actually persists it. `apps/api/src/platform/database/seed.ts` is the runnable entrypoint — it boots a Nest application context (no HTTP server) and calls each module's seeder.

The same run also seeds a dev Owner `AdminUser` (needed to log into the web console at all) when `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` are set in `apps/api/.env` — it's a no-op, not an error, when either is unset, so `pnpm db:seed` stays safe to run without opting into it. `modules/customers` and `modules/cleaners` have no seeders; create data through the web console or the respective GraphQL mutations (`createCustomer`/`createProperty`, `createCleaner`/`createTeam`) once logged in.

## Endpoints

| | URL | Notes |
| --- | --- | --- |
| Web console | http://localhost:3001 | Next.js — `/login`, `/admin` (staff/roles, Owner-only), `/customers`, `/cleaners` |
| GraphQL API | http://localhost:3000/graphql | queries/mutations for `bookings`, `admins`, `customers`/`properties`, `cleaners`/`teams` — API only, no browser landing page |
| GraphQL IDE (GraphiQL) | http://localhost:3000/graphiql | separate route, dev-only (see below) |
| REST API | http://localhost:3000/bookings | full CRUD — `bookings` only; `admins`/`customers`/`cleaners` are GraphQL-only |
| REST docs (Swagger UI) | http://localhost:3000/docs | interactive explorer, equivalent to GraphiQL |
| OpenAPI spec | http://localhost:3000/docs-json | raw JSON |

## GraphQL IDE

`/graphql` is API-only — visiting it in a browser returns a CSRF-protection error instead of an interactive IDE (`playground: false` in `graphql.module.ts`). GraphiQL lives at a deliberately separate route, `/graphiql`, so the API endpoint and the dev tool never share a URL.

`@nestjs/apollo` also has a native `graphiql: true` option, but that serves GraphiQL *at* `/graphql` itself — deliberately not used here, to keep the API endpoint and the IDE on separate URLs.

GraphiQL is locally bundled with esbuild and served entirely from application-owned static assets, including Monaco's worker bundles — not CDN-loaded. `graphiql`, `@graphiql/toolkit`, `react`, `react-dom`, `monaco-editor`, and `monaco-graphql` are real devDependencies of `apps/api`, bundled by `scripts/build-graphiql.ts` into `public/graphiql/` — zero runtime CDN dependency. An earlier CDN-embed attempt (`unpkg`/`esm.sh`, dynamically resolving React/GraphiQL at request time) hit real breakage twice — a UMD bundle path that no longer exists in current `graphiql` releases, then a bare-module-specifier resolution error even after switching to an import map — which is why this project bundles it itself instead.

The build runs via `pnpm build:graphiql`, wired as a `turbo.json` task dependency (`build` and `start:dev` both depend on it — plain npm `pre`/`post` script hooks don't fire when Turborepo invokes a script directly, so the dependency has to be expressed in `turbo.json`, not just `package.json`). `main.ts` serves the output via `useStaticAssets` at `/graphiql-static` — deliberately not `/graphiql` itself, since Express's static middleware runs ahead of routing and would otherwise intercept the bare `/graphiql` request as a directory-index lookup before `GraphiqlController` ever saw it.

**Not one file — five.** GraphiQL's editor is Monaco (via `@graphiql/react` + `monaco-graphql`), and Monaco needs its own Web Worker scripts for language-service features (autocomplete, live validation) — those can't run inside the main bundle. The build produces:

```text
public/graphiql/
├── graphiql.js          main bundle: React + GraphiQL + @graphiql/toolkit + Monaco host
├── graphiql.css          (monaco-editor's font/icon assets inlined as data URIs)
├── editor.worker.js      Monaco's generic editor worker (default fallback)
├── json.worker.js        Monaco's JSON language worker
└── graphql.worker.js     monaco-graphql's language worker (schema-aware validation/completion)
```

`graphiql.entry.ts` wires `self.MonacoEnvironment.getWorker` to load these by label (`'json'`, `'graphql'`, default) as plain `new Worker('/graphiql-static/...')` calls. The exact worker source paths and label mapping came from `@graphiql/react`'s own `dist/setup-workers/{vite,webpack}.js` helpers (there's no esbuild-specific one shipped) — verified against the installed package rather than guessed, since `monaco-editor`/`monaco-graphql`'s internal file layout isn't part of any public API contract.

`public/graphiql/` is generated and gitignored — CI/build produces it, it's never committed.

## Scripts (run from the repo root, via Turborepo)

```bash
pnpm dev      # apps/api + apps/web in watch mode (Turborepo)
pnpm build    # build all workspace packages that have a build script
pnpm test     # run all workspace test suites
pnpm lint     # lint all workspace packages that have a lint script
pnpm db:seed  # insert/refresh fake bookings — see "Seeding fake data" above
```

Package-specific commands can be run directly, e.g. `pnpm --filter api test:e2e`, `pnpm --filter api migration:generate ...` (see "Database migrations" above).
