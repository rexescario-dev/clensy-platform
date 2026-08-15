# apps/web

The Clensy dashboard/site: Next.js (App Router) + TypeScript + Tailwind CSS, consuming `@clensy/ui` and `@clensy/client` against `apps/api`'s GraphQL endpoint.

Currently infrastructure-only (bootstrap scaffolding — root layout, global styles, build/lint tooling); `/login` and `/admin` pages land in a later task.

- `pnpm --filter web dev` — starts the dev server on port 3001 (matches `apps/api`'s `WEB_ORIGIN` CORS default).
- `pnpm --filter web build` — production build.
- See `.env.example` for the `NEXT_PUBLIC_API_URL` env var consumed by `@clensy/client`.
