# Clensy Platform

A NestJS + TypeORM + GraphQL comparison harness — built to evaluate TypeORM's developer experience against [`flash-sale-system`](https://github.com/rexescario-dev/flash-sale-system)'s NestJS + Prisma + GraphQL stack, to settle on a personal standard.

pnpm workspace + Turborepo monorepo:

```text
apps/
├── api/      NestJS + TypeORM + GraphQL (code-first, Apollo) — the only app with real code so far
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

`apps/api/src` is organized into `modules/` (business modules, currently just `bookings`, each split into `domain/` / `application/` / `infrastructure/` / `presentation/` / `tests/`) and `platform/` (shared Nest/TypeORM/GraphQL wiring).

## Setup

```bash
pnpm install
cp .env.example .env   # first time only
docker compose up -d   # starts Postgres
pnpm dev                # runs apps/api in watch mode
```

GraphQL endpoint: http://localhost:3000/graphql
REST health check: http://localhost:3000/

## Scripts (run from the repo root, via Turborepo)

```bash
pnpm dev      # apps/api in watch mode
pnpm build    # build all workspace packages that have a build script
pnpm test     # run all workspace test suites
pnpm lint     # lint all workspace packages that have a lint script
```

Package-specific commands can be run directly, e.g. `pnpm --filter api test:e2e`.
