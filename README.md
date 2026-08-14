# Clensy Platform

A NestJS + TypeORM + GraphQL comparison harness — built to evaluate TypeORM's developer experience against [`flash-sale-system`](https://github.com/rexescario-dev/flash-sale-system)'s NestJS + Prisma + GraphQL stack, to settle on a personal standard. It also runs REST and GraphQL side by side against the same business logic, to compare those two API styles directly.

pnpm workspace + Turborepo monorepo:

```text
apps/
├── api/      NestJS + TypeORM + GraphQL (code-first, Apollo) + REST — the only app with real code so far
├── web/      not yet implemented
└── worker/   not yet implemented

packages/
├── ui/       not yet implemented
├── client/   not yet implemented
├── graphql/  not yet implemented
├── auth/     not yet implemented
├── domain/   not yet implemented
├── config/   not yet implemented
└── testing/  not yet implemented
```

## `apps/api/src` structure

Each business module is layered domain → application → infrastructure → presentation, so REST and GraphQL are thin adapters over the same business logic rather than separate implementations:

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
        ├── graphql.module.ts          Apollo driver wiring
        ├── directives/                reserved, not yet implemented
        └── scalars/                   reserved, not yet implemented
```

**Two presentation surfaces, one application layer:** both `presentation/graphql/booking.resolver.ts` and `presentation/rest/booking.controller.ts` map their own transport input (`CreateBookingInput` / `CreateBookingDto`) into the same `CreateBookingCommand` before calling `BookingsService` — the command is the shared contract, not either DTO. This is also why the TypeORM entity, the domain type, and the GraphQL `BookingType` are three separate classes instead of one decorated class: it keeps persistence, business rules, and each transport's shape free to evolve independently.

## Setup

```bash
cp .env.example .env   # first time only
docker compose up -d --build
```

That's it — `docker compose up` builds and runs `apps/api` itself (not just Postgres), connecting to the `postgres` service over the container network. A `migrate` service runs the pending migrations once before `api` starts (`depends_on: condition: service_completed_successfully`); the table is then empty but schema-correct — see "Seeding fake data" below.

For local iteration with hot-reload instead (edits reflected immediately, no rebuild):

```bash
pnpm install
docker compose up -d postgres   # Postgres only
pnpm --filter api migration:run # apply migrations — first time only, or after a new one is added
pnpm dev                         # apps/api in watch mode, against that Postgres
```

## Database migrations

No `synchronize: true` — schema changes go through real, reviewable migrations, closer to how `flash-sale-system` uses Prisma migrations.

```bash
pnpm --filter api migration:generate add customer phone number  # after changing an entity
pnpm --filter api migration:run       # apply pending migrations
pnpm --filter api migration:revert    # roll back the last one
```

`migration:generate` takes a plain phrase (or an already-PascalCase name, or anything in between — `scripts/generate-migration.ts` normalizes it) and writes it into `src/platform/database/migrations/` as `<timestamp>-AddCustomerPhoneNumber.ts`.

`generate` diffs the TypeORM entities (currently just `BookingEntity`) against the actual database, so run it against an environment that already has the *previous* migration applied (not a synchronized or ad-hoc schema) — otherwise the diff will be wrong. `apps/api/src/platform/database/data-source.ts` is the plain `DataSource` these commands use (the CLI can't consume `database.module.ts`'s Nest-wrapped, `ConfigService`-driven config directly). It needs its own `tsconfig.cli.json` (forces `commonjs`/`node` module resolution) — TypeORM's CLI loads the datasource via Node's native ESM resolver, which the rest of the project's `nodenext` config doesn't satisfy for a plain `ts-node` script.

## Seeding fake data

Seeding is an explicit, separate step — it never runs automatically on boot, so starting the app never has a surprise side effect on the database.

```bash
pnpm db:seed
```

Inserts (or re-applies, if already present) 3 fake bookings with fixed, deterministic ids (`00000000-…-0001`, `…0002`, `…0003`) via `INSERT ... ON CONFLICT (id) DO UPDATE` — safe to run as many times as you like, it never duplicates rows. Run it once after `docker compose up` (or after `pnpm dev`, against the same Postgres) to have data to look at in either API.

Seed data lives at `apps/api/src/modules/bookings/infrastructure/persistence/seed/booking.seed-data.ts` (plain TypeScript, no TypeORM); `booking.seeder.ts` is what actually persists it. `apps/api/src/platform/database/seed.ts` is the runnable entrypoint — it boots a Nest application context (no HTTP server) and calls each module's seeder.

## Endpoints

| | URL | Notes |
| --- | --- | --- |
| GraphQL API | http://localhost:3000/graphql | queries/mutations for `bookings` |
| GraphQL playground | http://localhost:3000/graphql | same URL, open in a browser (legacy GraphQL Playground, not Apollo Sandbox) |
| REST API | http://localhost:3000/bookings | full CRUD |
| REST docs (Swagger UI) | http://localhost:3000/docs | interactive explorer, equivalent to the GraphQL playground |
| OpenAPI spec | http://localhost:3000/docs-json | raw JSON |

## Scripts (run from the repo root, via Turborepo)

```bash
pnpm dev      # apps/api in watch mode
pnpm build    # build all workspace packages that have a build script
pnpm test     # run all workspace test suites
pnpm lint     # lint all workspace packages that have a lint script
pnpm db:seed  # insert/refresh fake bookings — see "Seeding fake data" above
```

Package-specific commands can be run directly, e.g. `pnpm --filter api test:e2e`, `pnpm --filter api migration:generate ...` (see "Database migrations" above).
