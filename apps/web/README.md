# apps/web

The Clensy dashboard/site: Next.js (App Router) + TypeScript + Tailwind CSS, consuming `@clensy/ui` and `@clensy/client` against `apps/api`'s GraphQL endpoint.

Full application shell (sidebar/header/user menu/logout) mounted once for every route under `/app/*`. `/login` is the public sign-in page. `/app` itself is a role-aware landing ([#89 plan](../../docs/superpowers/plans/2026-10-01-tenant-aware-application-shell-plan.md) decision 5): a Super Admin goes to the `/app/platform` placeholder (platform administration is deferred), tenant users to their first visible nav item, and an invalid session to `/login`. The sidebar shows only the nav items whose API read gate includes the user's role (`viewRoles` in `lib/nav-groups.ts`, scope first — a Super Admin gets no tenant nav), and the user menu shows the role label and an "Organization account" / "Platform account" scope line. Nav visibility, the landing and the platform page are UX only; the API remains the authorization boundary, and typing a hidden page's URL still reaches that page's API error. The four migrated modules are `/app/admin` (staff/roles for the Tenant Owner's own tenant, Tenant-Owner-only), `/app/customers`, `/app/cleaners` + `/app/cleaners/teams`, and `/app/catalog` + `/app/catalog/add-ons` (Admin, Customers, Cleaners/Teams, Catalog/Add-ons), all built on shared `@clensy/ui` primitives (data table, detail drawer, form dialog, confirmation dialog, feedback states).

- `docker compose up -d --build` (from the repo root) — runs this app on port 3001 (matches `apps/api`'s `WEB_ORIGIN` CORS default) alongside `apps/api` and Postgres. See the root `README.md`'s "Setup" section.
- `pnpm --filter web build` — production build.
- See `.env.example` for the `NEXT_PUBLIC_API_URL` env var consumed by `@clensy/client`.

## UI

`apps/web` consumes UI only through [`@clensy/ui`](../../packages/ui/README.md)'s public API:

- `apps/web` MUST NOT contain shadcn-generated components.
- `apps/web` MUST NOT import shadcn or `radix-ui` components directly.
- `apps/web` MUST NOT depend on shadcn-specific configuration (no `components.json`).

`apps/web` does still keep `cn` and `lucide-react` as ordinary dependencies for its own non-primitive needs (its own `className` composition, its own icons) — that isn't an exception to the rule above, since neither is a shadcn-specific dependency.

`apps/web` also consumes reusable Clensy domain components (e.g. `LoginForm`, `BookingDataTable`, `StaffDataTable`, `CreateStaffForm`) through [`@clensy/web`](../../packages/web/README.md)'s public API. Unlike `@clensy/ui`, these are self-translating — they own their own UI copy via `@clensy/web`'s own i18n context, not via translated-strings-as-props from `apps/web`.

`apps/web` also still depends on the `shadcn` package itself, and `app/globals.css` still has `@import "shadcn/tailwind.css"`. This is not an exception to the rule above either: it's a CSS token dependency, not a component dependency. `apps/web/app/globals.css` owns the base theme-token layer that `@clensy/ui`'s primitives consume by class name (see the design spec §4.7), and that CSS import is the only reason the `shadcn` package stays in `apps/web/package.json`. Do not remove it — doing so breaks the Tailwind build.

## i18n

`next-intl` is wired for a single locale, `en` (see [the design spec](../../docs/superpowers/specs/2026-09-13-web-i18n-architecture-design.md) for the full architecture). No second language ships yet, and no locale-prefixed routing exists — this is about getting product copy behind translation keys, not about shipping translations.

**Catalogs** live at `apps/web/messages/en/*.json`, one file per namespace. Current namespaces: `common` (empty for now), `nav` (sidebar, plus the shell's `userMenu`, `landing` and `platform` copy), `validation`. Role labels are not here: they come from `@clensy/web`'s shared `roles` namespace. `apps/web/i18n/messages.ts` merges them; `apps/web/i18n/request.ts` is the next-intl plugin/runtime entry point that resolves the locale (always `en`) and calls it. (An `auth` namespace previously lived here for `LoginForm`'s copy — retired once `LoginForm` became self-translating via `@clensy/web`'s own i18n context; see [the LoginForm self-translating spec](../../docs/superpowers/specs/2026-09-20-login-form-self-translating-design.md).)

**`@clensy/web` copy and app-wide overrides.** `@clensy/web`'s components translate their own copy. Every route under `/app/*` resolves that copy through one **app i18n boundary**: `AppI18nProvider` (`components/layout/app-i18n-provider.tsx`), which `app/app/layout.tsx` mounts around `DashboardLayout` ([single app i18n provider spec](../../docs/superpowers/specs/2026-10-02-single-app-i18n-provider-design.md), #115).
- **Locale:** comes from next-intl's `useLocale()`.
- **Overrides:** application-owned overrides come only from `APP_I18N_OVERRIDES` in `lib/clensy-i18n-overrides.ts`, typed `DeepPartial<ClensyMessages>` and committed as `{}`.
- **No local providers:** a page or component that renders `@clensy/web` components relies on this boundary and MUST NOT mount its own `ClensyI18nProvider`. `lib/web-shell-regressions.test.ts` fails if a second mount appears in any scanned source file (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts`). It also fails on any **provider escape** (#117): a re-export of `ClensyI18nProvider` from `@clensy/web` (including `export *`), or any use of the imported provider other than as a JSX tag or in `typeof`. So a barrel, an alias or `createElement` can't be used to mount it under another name. Loading the package with `require('@clensy/web')` or `import('@clensy/web')`, or with a non-literal `require`/`import()`, is an escape too (#120).
- **Public entry point only:** `apps/web` imports `@clensy/web` through the bare `'@clensy/web'` specifier. The same test fails on any deep `@clensy/web/…` specifier, or any relative, absolute or `@/` path into `packages/web`, in any import, export, `require`, `import()` or type-only form (#120). A path through a `node_modules/@clensy/web` link (pnpm's symlink to `packages/web`), or anything beneath it, fails too (#122).
- **One dashboard shell:** `DashboardLayout` is rendered exactly once, in `app/app/layout.tsx`, as the boundary's direct child. Rendering it anywhere else fails the test (#120).
- These checks are syntactic. They read import specifiers as written and do not resolve modules.
- **`/login`** stays outside the boundary and uses `@clensy/web`'s package defaults.

**Adding a key:** add it to the right namespace's JSON file (or a new namespace file, if you also add it to `i18n/messages.ts`'s merge), then consume it:

```tsx
'use client';
import { useTranslations } from 'next-intl';

const t = useTranslations('nav');
t('sidebar.primary'); // -> the string at messages/en/nav.json's "sidebar.primary" key
```

A server component uses `getTranslations` (`next-intl/server`) against the same catalogs instead.

**Rules, enforced by lint (`apps/web/eslint.config.mjs`) where possible:**

- Never `import` a `messages/**` catalog file, or `i18n/messages`, directly outside `apps/web/i18n/` — always go through `useTranslations`/`getTranslations`.
- `@clensy/ui` MUST NOT import `next-intl` or hold a Clensy message catalog. It takes already-translated strings (`label`, `error`, `title`, …) as props; `apps/web` translates, `@clensy/ui` renders.
- A translation key is a stable identifier, not derived from its current English text — renaming the visible copy doesn't require renaming the key.

**Documented but not yet implemented** (see the design spec §4.5–§4.6 for the full rationale):

- `@clensy/validation` (#51, [package README](../../packages/validation/README.md)) now exists and is wired into the Add Customer form, but it ships fixed English messages today — it does not import `next-intl` or produce ICU keys. Rendering its rule/field structure via `t('validation.<rule>', { field })` against `messages/en/validation.json`'s ICU templates remains a future integration (its own [design spec](../../docs/superpowers/specs/2026-09-15-clensy-validation-design.md) §6), not something #51 implemented either.
- `normalizeApiError`: `API error → stable error metadata when available → rule key → validation.<rule>`, falling back to a generic `common.errors.requestFailed` key that doesn't exist in the catalog yet (no caller needs it today). `@clensy/validation`'s own `normalizeApiValidationErrors` (#51) solves a narrower, related problem — mapping a failed GraphQL mutation onto its `FieldErrors` contract directly, not onto this catalog's `validation.<rule>` keys.
