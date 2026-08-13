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
│       │       └── booking.entity.ts  the GraphQL/REST types (see "Two presentation surfaces" below)
│       │
│       ├── presentation/
│       │   ├── graphql/               resolver, ObjectType, InputTypes (own class-validator rules)
│       │   └── rest/                  controller, DTOs (own class-validator rules + @ApiProperty)
│       │
│       └── tests/                     mirrors application/ · graphql/ · rest/
│
└── platform/                          shared infrastructure, not business logic
    ├── config/
    ├── database/                      TypeOrmModule wiring
    └── graphql/
        ├── graphql.module.ts          Apollo driver wiring
        ├── directives/                reserved, not yet implemented
        └── scalars/                   reserved, not yet implemented
```

**Two presentation surfaces, one application layer:** both `presentation/graphql/booking.resolver.ts` and `presentation/rest/booking.controller.ts` map their own transport input (`CreateBookingInput` / `CreateBookingDto`) into the same `CreateBookingCommand` before calling `BookingsService` — the command is the shared contract, not either DTO. This is also why the TypeORM entity, the domain type, and the GraphQL `BookingType` are three separate classes instead of one decorated class: it keeps persistence, business rules, and each transport's shape free to evolve independently.

## Setup

```bash
pnpm install
cp .env.example .env   # first time only
docker compose up -d   # starts Postgres
pnpm dev                # runs apps/api in watch mode
```

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
```

Package-specific commands can be run directly, e.g. `pnpm --filter api test:e2e`.
