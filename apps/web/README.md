# apps/web

The Clensy dashboard/site: Next.js (App Router) + TypeScript + Tailwind CSS, consuming `@clensy/ui` and `@clensy/client` against `apps/api`'s GraphQL endpoint.

Full application shell (sidebar/header/user menu/logout) mounted once for every route under `/app/*`. `/login` is the public sign-in page; `/app`, `/app/admin` (staff/roles, Owner-only), `/app/customers`, `/app/cleaners`, `/app/cleaners/teams`, `/app/catalog`, and `/app/catalog/add-ons` are the four migrated modules (Admin, Customers, Cleaners/Teams, Catalog/Add-ons), all built on shared `@clensy/ui` primitives (data table, detail drawer, form dialog, confirmation dialog, feedback states).

- `pnpm --filter web dev` — starts the dev server on port 3001 (matches `apps/api`'s `WEB_ORIGIN` CORS default).
- `pnpm --filter web build` — production build.
- See `.env.example` for the `NEXT_PUBLIC_API_URL` env var consumed by `@clensy/client`.
