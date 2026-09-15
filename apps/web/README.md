# apps/web

The Clensy dashboard/site: Next.js (App Router) + TypeScript + Tailwind CSS, consuming `@clensy/ui` and `@clensy/client` against `apps/api`'s GraphQL endpoint.

Full application shell (sidebar/header/user menu/logout) mounted once for every route under `/app/*`. `/login` is the public sign-in page. `/app` itself is a redirect (currently to `/app/customers`, until a future Operations Dashboard milestone gives it real content) — the four migrated modules are `/app/admin` (staff/roles, Owner-only), `/app/customers`, `/app/cleaners` + `/app/cleaners/teams`, and `/app/catalog` + `/app/catalog/add-ons` (Admin, Customers, Cleaners/Teams, Catalog/Add-ons), all built on shared `@clensy/ui` primitives (data table, detail drawer, form dialog, confirmation dialog, feedback states).

- `docker compose up -d --build` (from the repo root) — runs this app on port 3001 (matches `apps/api`'s `WEB_ORIGIN` CORS default) alongside `apps/api` and Postgres. See the root `README.md`'s "Setup" section.
- `pnpm --filter web build` — production build.
- See `.env.example` for the `NEXT_PUBLIC_API_URL` env var consumed by `@clensy/client`.

## UI

`apps/web` consumes UI only through [`@clensy/ui`](../../packages/ui/README.md)'s public API:

- `apps/web` MUST NOT contain shadcn-generated components.
- `apps/web` MUST NOT import shadcn or `radix-ui` components directly.
- `apps/web` MUST NOT depend on shadcn-specific configuration (no `components.json`).

`apps/web` does still keep `cn` and `lucide-react` as ordinary dependencies for its own non-primitive needs (its own `className` composition, its own icons) — that isn't an exception to the rule above, since neither is a shadcn-specific dependency.

## i18n

`next-intl` is wired for a single locale, `en` (see [the design spec](../../docs/superpowers/specs/2026-09-13-web-i18n-architecture-design.md) for the full architecture). No second language ships yet, and no locale-prefixed routing exists — this is about getting product copy behind translation keys, not about shipping translations.

**Catalogs** live at `apps/web/messages/en/*.json`, one file per namespace. Current namespaces: `common` (empty for now), `nav`, `auth`, `validation`. `apps/web/i18n/messages.ts` merges them; `apps/web/i18n/request.ts` is the next-intl plugin/runtime entry point that resolves the locale (always `en`) and calls it.

**Adding a key:** add it to the right namespace's JSON file (or a new namespace file, if you also add it to `i18n/messages.ts`'s merge), then consume it:

```tsx
'use client';
import { useTranslations } from 'next-intl';

const t = useTranslations('auth');
t('title'); // -> the string at messages/en/auth.json's "title" key
```

A server component uses `getTranslations` (`next-intl/server`) against the same catalogs instead.

**Rules, enforced by lint (`apps/web/eslint.config.mjs`) where possible:**

- Never `import` a `messages/**` catalog file, or `i18n/messages`, directly outside `apps/web/i18n/` — always go through `useTranslations`/`getTranslations`.
- `@clensy/ui` MUST NOT import `next-intl` or hold a Clensy message catalog. It takes already-translated strings (`label`, `error`, `title`, …) as props; `apps/web` translates, `@clensy/ui` renders.
- A translation key is a stable identifier, not derived from its current English text — renaming the visible copy doesn't require renaming the key.

**Documented but not yet implemented** (see the design spec §4.5–§4.6 for the full rationale):

- `@clensy/validation` (#51, [package README](../../packages/validation/README.md)) now exists and is wired into the Add Customer form, but it ships fixed English messages today — it does not import `next-intl` or produce ICU keys. Rendering its rule/field structure via `t('validation.<rule>', { field })` against `messages/en/validation.json`'s ICU templates remains a future integration (its own [design spec](../../docs/superpowers/specs/2026-09-15-clensy-validation-design.md) §6), not something #51 implemented either.
- `normalizeApiError`: `API error → stable error metadata when available → rule key → validation.<rule>`, falling back to a generic `common.errors.requestFailed` key that doesn't exist in the catalog yet (no caller needs it today). `@clensy/validation`'s own `normalizeApiValidationErrors` (#51) solves a narrower, related problem — mapping a failed GraphQL mutation onto its `FieldErrors` contract directly, not onto this catalog's `validation.<rule>` keys.
