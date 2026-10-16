# apps/api

The Clensy backend: NestJS + TypeORM + PostgreSQL, serving a code-first GraphQL API (Apollo) at `/graphql` and one REST resource (`/bookings`). Every business operation is authenticated, role-gated, tenant-scoped and audit-logged.

- How the API fits with the web app: [architecture overview](../../docs/architecture/overview.md)
- How a request is authenticated, authorized and tenant-scoped: [authentication and tenancy](../../docs/architecture/auth-and-tenancy.md)
- Schema changes and the migration catalogue: [database migrations](../../docs/development/database-migrations.md)
- Test suites, CI jobs and the release gate: [testing and CI](../../docs/development/testing-and-ci.md)

## Commands

Run from the repository root.

| Command | What it does |
| --- | --- |
| `pnpm --filter api start:dev` | Watch mode on port 3000 (builds GraphiQL first). Needs Postgres and `apps/api/.env`. |
| `pnpm --filter api build` | Production build to `dist/` (builds GraphiQL first). |
| `pnpm --filter api test` | Unit tests (Jest). |
| `pnpm --filter api test:e2e` | Every e2e suite against a real Postgres. Run `pnpm --filter api build:graphiql` once first on a fresh checkout. |
| `pnpm --filter api test:e2e:release-gate` | The two-tenant release gate only. |
| `pnpm --filter api lint` | ESLint (with `--fix`). |
| `pnpm --filter api migration:generate <phrase>` | Diff entities against the database into a new migration. |
| `pnpm --filter api migration:run` / `migration:revert` | Apply pending migrations / roll back the last one. |
| `pnpm db:seed` | Upsert fixture data and the optional dev Tenant Owner. See [local development](../../docs/getting-started/local-development.md#seed-data). |

The usual way to run the API is the Docker Compose stack in the [root README](../../README.md).

## Configuration

Nest's `ConfigModule` reads `apps/api/.env` (the working directory), and the TypeORM CLI reads the same file through `dotenv`. Variables set by the environment, such as the ones `docker-compose.yml` passes in, take precedence. The variable names and their meaning are documented in [`.env.example`](../../.env.example); `JWT_SECRET` is required outside tests.

## Source layout

Each business module is layered **domain → application → infrastructure → presentation**, so REST and GraphQL are thin adapters over the same business logic. `bookings` is the worked example below; it is also the only module with a REST surface.

```text
src/
├── app/app.module.ts      composition root: wires platform/ and modules/
├── main.ts                bootstrap: cookie-parser, credentialed CORS, ValidationPipe,
│                          GraphiQL static assets and Swagger (both dev-only)
├── schema.gql             generated GraphQL schema (input to @clensy/client codegen)
│
├── modules/               business modules
│   ├── admins/            AdminUser, login/logout, staff administration
│   ├── customers/         Customer, Property
│   ├── cleaners/          Cleaner, Team
│   ├── catalog/           Service, AddOn, PricingRule
│   ├── bookings/          Booking (GraphQL + REST)
│   ├── jobs/              CleaningJob, Checklist, ChecklistItem
│   ├── laundry/           LaundryOrder, LaundryOrderLine, pricing and preview
│   └── billing/           Invoice, InvoiceLine
│
│   bookings/ in detail:
│   ├── domain/                  plain TypeScript, no framework decorators
│   ├── application/
│   │   ├── commands/            transport-agnostic contracts (CreateBookingCommand, …)
│   │   └── services/            use cases (bookings.service.ts)
│   ├── infrastructure/
│   │   └── persistence/         TypeORM entity, separate from domain and transport types
│   │       └── seed/            seed data + seeder
│   ├── presentation/
│   │   ├── graphql/             read resolver (nestjs-query), mutation resolver, DTO, inputs
│   │   └── rest/                controller and DTOs (class-validator + @ApiProperty)
│   └── tests/
│
└── platform/              shared infrastructure, not business logic
    ├── auth/              JWT session cookie, AuthGuard, @Roles(), @CurrentUser(), tenant authorizers
    ├── audit/             AuditEvent, AuditLogger
    ├── config/            global ConfigModule
    ├── database/          TypeORM wiring (synchronize: false), data-source.ts for the CLI,
    │                      migrations/, seed.ts, bootstrap tenant
    ├── graphql/           Apollo driver + nestjs-query; GraphiQL controller and entry;
    │                      directives/ and scalars/ are reserved, not implemented
    └── openapi/           Swagger setup (dev-only)
```

**Two presentation surfaces, one application layer.** The GraphQL `BookingMutationResolver` and the REST `BookingController` each map their own input (`CreateBookingInput` / `CreateBookingDto`) into the same `CreateBookingCommand` before calling `BookingsService`; the command is the shared contract. GraphQL reads for Booking go through nestjs-query (`BookingReadResolver` = `Relatable(ReadResolver)` over `BookingDTO`); writes stay on the service. That is why the TypeORM entity, the domain type and the GraphQL object type are three classes: persistence, business rules and each transport can evolve independently.

Every other module follows the same layering but is GraphQL-only, per the [Phase 1 design](../../docs/superpowers/specs/2026-08-14-clensy-platform-phase1-design.md). REST `/bookings` is kept deliberately as the REST/GraphQL comparison surface (#91), with the same session, roles and tenant scope as GraphQL.

## HTTP surface

| URL (local) | What | Availability |
| --- | --- | --- |
| `http://localhost:3000/graphql` | GraphQL API. A browser visit returns a CSRF error: there is no landing page. | Always |
| `http://localhost:3000/graphiql` | GraphiQL IDE | Not served when `NODE_ENV=production` |
| `http://localhost:3000/bookings` | REST CRUD for bookings | Always (authenticated) |
| `http://localhost:3000/docs` | Swagger UI for the REST routes | Not served when `NODE_ENV=production` |
| `http://localhost:3000/docs-json`, `/docs-yaml` | OpenAPI document | Not served when `NODE_ENV=production` |

The Docker image defaults to `NODE_ENV=production` (GraphiQL, Swagger and introspection off); `docker-compose.yml` runs it as `development` unless `.env` sets `NODE_ENV=production`.

## GraphQL IDE (GraphiQL)

`/graphql` is API-only (`playground: false` in `graphql.module.ts`). GraphiQL lives at a separate route, `/graphiql`, so the API endpoint and the dev tool never share a URL. `@nestjs/apollo`'s own `graphiql: true` option is deliberately not used, because it serves the IDE *at* `/graphql`.

GraphiQL is bundled locally with esbuild and served from application-owned static assets, with no CDN. `graphiql`, `@graphiql/toolkit`, `react`, `react-dom`, `monaco-editor` and `monaco-graphql` are devDependencies of `apps/api`, bundled by `scripts/build-graphiql.ts` into `public/graphiql/`. An earlier CDN embed (`unpkg`/`esm.sh`) broke twice: a UMD bundle path that no longer exists in current `graphiql` releases, then a bare-module-specifier error even with an import map.

- **Build wiring.** The `build:graphiql` script (`pnpm --filter api build:graphiql` from the root) runs before `build` and `start:dev` through `prebuild`/`prestart:dev` and through `turbo.json` task dependencies. Turborepo does not fire npm `pre`/`post` hooks when it invokes a script directly, so the dependency must also be in `turbo.json`.
- **Serving.** `main.ts` serves the output at `/graphiql-static`, not `/graphiql`: Express's static middleware runs before routing and would otherwise treat `/graphiql` as a directory lookup before `GraphiqlController` saw it.
- **Five files, not one.** Monaco needs its own Web Worker scripts for autocomplete and validation:

  ```text
  public/graphiql/
  ├── graphiql.js         React + GraphiQL + @graphiql/toolkit + Monaco host
  ├── graphiql.css        Monaco font/icon assets inlined as data URIs
  ├── editor.worker.js    Monaco's generic editor worker (default)
  ├── json.worker.js      Monaco's JSON language worker
  └── graphql.worker.js   monaco-graphql's schema-aware worker
  ```

  `graphiql.entry.ts` sets `self.MonacoEnvironment.getWorker` to load them by label (`'json'`, `'graphql'`, default) with `new Worker('/graphiql-static/...')`. The paths and labels come from `@graphiql/react`'s own `dist/setup-workers/{vite,webpack}.js` helpers (there is no esbuild one), verified against the installed package because Monaco's internal layout is not a public contract.
- `public/graphiql/` is generated and gitignored.
