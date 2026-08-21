# apps/web

The Clensy dashboard/site: Next.js (App Router) + TypeScript + Tailwind CSS, consuming `@clensy/ui` and `@clensy/client` against `apps/api`'s GraphQL endpoint.

Full application shell (sidebar/header/user menu/logout) mounted once for every route under `/app/*`. `/login` is the public sign-in page. `/app` itself is a redirect (currently to `/app/customers`, until a future Operations Dashboard milestone gives it real content) — the four migrated modules are `/app/admin` (staff/roles, Owner-only), `/app/customers`, `/app/cleaners` + `/app/cleaners/teams`, and `/app/catalog` + `/app/catalog/add-ons` (Admin, Customers, Cleaners/Teams, Catalog/Add-ons), all built on shared `@clensy/ui` primitives (data table, detail drawer, form dialog, confirmation dialog, feedback states).

- `docker compose up -d --build` (from the repo root) — runs this app on port 3001 (matches `apps/api`'s `WEB_ORIGIN` CORS default) alongside `apps/api` and Postgres. See the root `README.md`'s "Setup" section.
- `pnpm --filter web build` — production build.
- See `.env.example` for the `NEXT_PUBLIC_API_URL` env var consumed by `@clensy/client`.
