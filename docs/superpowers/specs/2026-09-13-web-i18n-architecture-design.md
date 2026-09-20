# App Router i18n Architecture (next-intl) — Design

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-09-13 |
| Tracking issue | [#53](https://github.com/rexescario-dev/clensy-platform/issues/53) |
| Depends on (Accepted) | [Admin Foundation](2026-08-14-admin-foundation-design.md) — `/login` ownership, the non-discriminating failed-login error semantics (§4.3), `CurrentAdmin`. [Dashboard UX Foundation](2026-08-17-dashboard-ux-foundation-design.md) — `/app/*` boundary, cookie-presence UX-only middleware gate. [Web Application Shell & Design System](2026-09-10-web-shell-and-design-system-design.md) — current `AppSidebar` composition, `NAV_GROUPS` rendering, sidebar collapse/per-item `aria-label`s, `@clensy/ui` vs `apps/web/components/ui` boundary. |
| Related (not a dependency) | **#51** (shared validation messages) — this spec's validation contract is designed to compose with #51 once it lands. Neither ticket blocks the other (§5). |
| Followed by | None yet. A future slice may add a second locale, locale-prefixed routing, and migrate remaining module screens. |
| Governing references | This document. It does not redefine Admin Foundation's login security/error semantics, Dashboard UX Foundation's `/app/*` boundary, or the Shell spec's sidebar visual/behavioral contract — it wraps their existing English copy in translation keys without changing behavior. |

**Revision (Accepted):** two owner review passes tightened the design in place: (1) explicit translation-vs-formatting-locale separation, a normative message-loading/merge contract, corrected validation namespace/key usage, key-only `NavItem`/`NavGroup`, and a stronger translation-resolution test replacing a JSON-only assertion; (2) `getLocale()` as the public API for `<html lang>` (not `i18n/request.ts` directly), "single supported/resolved locale" replacing "fallback" terminology, an architecture-vs-v1-acceptance split for the namespace count, `validation.json` reframed as representative ICU entries rather than a stub, `NextIntlClientProvider` inheriting request config automatically instead of manual message-passing, typed keys demoted to a non-goal, a direct-catalog-import lint/script check, and `common.json` shipping empty with `requestFailed` documented as a forward contract only.

**Post-Accept correction (2026-09-20, under #63):** the `auth` namespace/`apps/web/messages/en/auth.json` is retired — `LoginForm` (via [the LoginForm self-translating spec](2026-09-20-login-form-self-translating-design.md)) now owns its entire UI-copy surface through `@clensy/web`'s own i18n context instead of receiving translated strings from `apps/web`'s next-intl catalog. The v1 namespace set (§this document's own acceptance invariant, explicitly "expected to be updated... whenever a later slice adds a namespace") shrinks from four to three: `common`, `nav`, `validation`. This is a retirement, not the addition the original wording anticipated, but the same invariant-is-a-v1-snapshot principle applies — `apps/web/i18n/messages.test.ts`'s namespace-set assertion is updated accordingly, not treated as an architecture break. No other part of this spec's architecture (locale resolution, message-loading contract, `nav`/`validation` namespaces, the translation-resolution test) changes.

## 1. Thesis

`apps/web` (Next 16.3 App Router, React 19) has no i18n library, no locale routing, and no translation catalog. User-facing English is hard-coded across the login page, `@clensy/ui` `FormField`/`FormDialog` callers, `NAV_GROUPS`, sidebar `aria-label`s, and helpers such as `parsePriceOrReportError`. This spec establishes a centralized i18n architecture — **next-intl**, wired for a single `en` catalog — so product copy lives behind translation keys, `@clensy/ui` stays presentation-only and locale-agnostic, and a second language can be added later without a rewrite. It ships a narrow proof of concept (login + shell nav) rather than translating the admin UI.

## 2. Scope

**In scope (normative):**

- Add `next-intl` to `apps/web` only: `createNextIntlPlugin` wrapping `next.config.ts`, `i18n/request.ts` (`getRequestConfig`, locale `en`), `NextIntlClientProvider` in `apps/web/app/layout.tsx`.
- `<html lang>` sourced from `getLocale()` (`next-intl/server`) instead of the hardcoded string literal at `apps/web/app/layout.tsx:13`.
- Namespaced message catalogs under `apps/web/messages/en/`: `common.json` (empty in v1), `nav.json`, `auth.json`, `validation.json` (representative entries only — see §5).
- Migrate the login page (`apps/web/app/login/page.tsx`) to `useTranslations('auth')`: title (`"Clensy Admin Login"`), field labels (`"Email"`, `"Password"`), submit button states (`"Sign in"` / `"Signing in…"`), and the generic failed-login copy (`"Invalid email or password."`) — same non-discriminating string, now behind a key.
- Migrate `NAV_GROUPS` (`apps/web/lib/nav-groups.ts`) and the sidebar (`apps/web/components/layout/app-sidebar.tsx`) to render labels and `aria-label`s (`"Expand sidebar"` / `"Collapse sidebar"`, per-item collapsed `aria-label`) from `useTranslations('nav')`. Labels, hrefs, and `findActiveHref` behavior are unchanged — only the string source moves.
- Document the locale strategy: single supported/resolved translation locale `en` (no locale-fallback chain), `<html lang>` via `getLocale()`, formatting locale intent `en-PH` / timezone `Asia/Manila` for future date display.
- Document the validation-message contract that composes with #51 (§5), demonstrated with representative catalog entries, and an API-error-normalization strategy that keeps login's error generic (§6).
- Developer documentation: how to add a key and consume it from a client component.
- A rendered-component test proving the full `useTranslations` resolution path (catalog → request config → provider → hook → output), not just a JSON-object assertion, plus a catalog-integrity check that the merged message object exposes exactly the four namespaces (§6).

**Informative:** existing GraphQL operations (`login`, `currentAdmin`), Apollo client setup, three-layer auth (middleware UX hint / `AuthGuard` / `@Roles()`), `formatMinorUnits` / `parsePesosToMinorUnits` (`apps/web/lib/format-price.ts`).

**Out of scope:**

- Translating any module screen beyond login + shell nav (Bookings, Jobs, Laundry, Billing, Customers, Cleaners, Teams, Catalog, Add-ons, Admin, `FormDialog`/`FormField` call sites elsewhere).
- Shipping a second language/locale.
- Locale-prefixed URLs (`/en/app/...`) or any change to `apps/web/middleware.ts`'s cookie-presence matcher (`/app/:path*`) or `next.config.ts`'s legacy-path `redirects()` table.
- Rewriting Nest `class-validator` messages or defining a full API error-code schema; no `apps/api` changes.
- Changing the login page's non-discriminating failure UX or the underlying `admin.login.failed` audit semantics (Admin Foundation §4.3/§4.6) — the copy is relocated behind a key, not reworded or made field-specific.
- Replacing `formatMinorUnits`'s integer arithmetic with `Intl.NumberFormat` float-based currency math.
- Adding `next-intl` (or any i18n dependency, or a Clensy message catalog) to `packages/ui`.
- A new `@clensy/i18n` workspace package or a custom translation engine.
- Fixing the pre-existing hardcoded `'Cancel'` literal in `packages/ui/src/form-dialog.tsx:36` — a real `@clensy/ui` boundary gap (product copy baked into the presentation kit), but not introduced or widened by this spec; left for a future slice that actually localizes a screen using `FormDialog`.
- A language switcher or locale-detection/persistence mechanism (moot with one locale).

## 3. Terminology

- **Message catalog:** a JSON file of translation keys → ICU message strings for one locale (e.g. `apps/web/messages/en/auth.json`).
- **Namespace:** the top-level key grouping passed to `useTranslations(namespace)` (`auth`, `nav`, `common`, `validation`), matching one catalog file.
- **PoC locale:** the single supported and always-resolved translation locale, `en`. This slice has no locale-fallback chain (there is no second locale to fall back from); "supported," "resolved," and "default" are synonyms for `en` here, not three independent settings.
- **Structured validation error:** a `{ field, rule, params }`-shaped error (or equivalent) that a UI layer renders via `t('validation.<rule>', params)`, as opposed to a frozen English sentence returned by the validator. This spec documents the shape; it does not implement a validator that produces it (that is #51's surface).
- **`normalizeApiError`:** the documented (not necessarily implemented in this slice) helper concept that maps known GraphQL/`class-validator` constraint names to validation rule keys, falling back to a generic translated string (`common.errors.requestFailed`) when a constraint isn't recognized. Distinct from parsing English error sentences.
- **Presentation-only (`@clensy/ui`):** `@clensy/ui` components accept already-translated strings (`label`, `error`, `title`, `submitLabel`, …) as props. They MUST NOT import `next-intl` or hold a Clensy message catalog.
- **Key notation:** this document writes a full key as `namespace.key` (e.g. `auth.title`, `validation.email`) purely for readability. That notation is never a literal string passed to a single catalog-wide translator. It always denotes `useTranslations('<namespace>')` followed by `t('<key>')` — e.g. `auth.title` is `useTranslations('auth')` then `t('title')`; `validation.email` is `useTranslations('validation')` then `t('email')`. There is no `t('namespace.key')` call anywhere in this architecture.
- **Translation locale vs. formatting locale:** two distinct, non-interchangeable concepts in this slice. The **translation locale** (the only one next-intl resolves, and the only value `<html lang>` may take) is `en`. The **formatting locale** (`en-PH`, for a future `Intl.DateTimeFormat`/`Intl.NumberFormat` call) is a display-formatting intent only — it is not a second message catalog and MUST NOT be passed to next-intl's locale resolution or appear as `<html lang>`.
- **Stable key:** a translation key is a stable application identifier, not derived from its current English text. Renaming the visible English string (e.g. `auth.submit` from "Sign in" to "Log in") MUST NOT require renaming the key unless the key's semantic meaning changes. Keys are load-bearing once a second locale exists; treat them as an internal API.

## 4. Architecture & behavioral contracts

### 4.1 Placement

```text
apps/web/
  i18n/
    request.ts             ← getRequestConfig(); resolved locale 'en' (no fallback chain)
  messages/
    en/
      common.json           ← empty in v1; reserved namespace for shell-wide/generic copy
      nav.json               ← NAV_GROUPS labels, sidebar aria-labels
      auth.json              ← login copy + generic failed-login string
      validation.json        ← representative rule-key → ICU template entries (#51 contract)
  next.config.ts            ← wrapped by createNextIntlPlugin(...)
  app/
    layout.tsx              ← <NextIntlClientProvider> (inherits request config); <html lang={await getLocale()}>
    login/page.tsx           ← useTranslations('auth')
  lib/nav-groups.ts          ← items carry a stable labelKey; no hardcoded English
  components/layout/
    app-sidebar.tsx          ← useTranslations('nav') for labels + toggle/per-item aria-labels
packages/ui/                 ← unchanged: no next-intl dependency, no message catalog
```

`i18n/request.ts` and the plugin wrapper are additive to `next.config.ts`; the existing `transpilePackages: ['@clensy/client', '@clensy/ui']` entry and the legacy `redirects()` table are untouched.

**Message loading (normative).** `i18n/request.ts` is the single authoritative place that resolves the locale and loads catalogs. It reads all four files under `messages/en/` and merges them into one namespaced object keyed by filename, e.g.:

```ts
{
  common: { /* messages/en/common.json */ },
  nav: { /* messages/en/nav.json */ },
  auth: { /* messages/en/auth.json */ },
  validation: { /* messages/en/validation.json */ },
}
```

This merged object is what `getRequestConfig` returns. `apps/web/app/layout.tsx` renders `NextIntlClientProvider` as a Server Component child with no explicit `messages`/`locale` props — next-intl's App Router integration has the provider inherit the request configuration automatically. §4.1's placement diagram (`layout.tsx ← NextIntlClientProvider`) and this merge shape describe what `i18n/request.ts` produces internally, not a `messages` prop that `layout.tsx` reads and forwards by hand. `i18n/request.ts` itself is configuration consumed by the next-intl plugin/runtime — it is not imported by application components, and it is not the application's public i18n API; components only ever call `useTranslations` / `getTranslations`.

**Architecture invariant:** every catalog file `i18n/request.ts` includes in the merge becomes exactly one top-level namespace, keyed by filename. This is open-ended by design — adding a fifth catalog file means adding it to the merge, not inventing a second loading mechanism.

**v1 acceptance invariant (distinct from the architecture invariant above):** the initial implementation includes exactly four files — `common.json`, `nav.json`, `auth.json`, `validation.json` — and therefore exposes exactly those four namespaces. §6's catalog-integrity check asserts this v1 set; it is expected to be updated (not treated as an architecture break) whenever a later slice adds a namespace.

`common.json` ships in this slice **empty** (`{}`), to establish the catalog convention (a namespace reserved for shell-wide/generic copy) without pre-filling speculative content. §4.6 documents `common.errors.requestFailed` as the future key `normalizeApiError`'s generic fallback will use — it is a forward-referenced contract, not a key this slice actually writes into `common.json`, since no PoC surface renders it yet.

**Server/client boundary (normative).** Client components (all PoC surfaces in this slice) call `useTranslations`; a future server component uses next-intl's server API (`getTranslations`) against the same `i18n/request.ts` configuration. The reason PoC surfaces use `useTranslations` is simply that they are Client Components today, not a general preference — nothing here blocks a future server component from using `getTranslations`. Neither API involves a direct `import` of a JSON catalog file into a component. A repository check (lint rule or a lightweight grep-based script is sufficient — no bespoke tooling required) MUST prevent any file under `apps/web` other than `i18n/request.ts` from importing `messages/**` directly, so the abstraction boundary can't be silently bypassed later.

### 4.2 Locale strategy (v1)

| Concern | Decision |
| --- | --- |
| Supported translation locale | `en` — the only one. |
| Resolved translation locale | Always `en`. No locale-fallback chain is implemented in this slice, because there is no second locale to fall back from; next-intl's ordinary missing-message behavior applies within the single `en` catalog, but that is not a locale fallback. |
| `html lang` | `layout.tsx` MUST obtain the resolved translation locale via next-intl's server API, `getLocale()` (`next-intl/server`) — not by hardcoding the literal at `apps/web/app/layout.tsx:13`, and not by importing `i18n/request.ts` directly (that file is plugin/runtime configuration, not the application's public i18n API). The resulting value MUST be `en`, never the formatting locale `en-PH`. |
| Detection / persistence | None. Single locale; no cookie, no `Accept-Language` negotiation, no user-profile field. Add when a second locale ships. |
| URL | Unchanged. No `/en/...` prefix; `middleware.ts` matcher and `next.config.ts` redirects are not touched. |
| Server vs. client | PoC surfaces (login, sidebar) are Client Components today, so they use `useTranslations`; that is a consequence of what they already are, not a stated preference. A future server component uses `getTranslations` against the same `i18n/request.ts` configuration; this spec does not require converting any existing client page to a server component. |
| Money | `formatMinorUnits` / `parsePesosToMinorUnits` (`apps/web/lib/format-price.ts:8-22`) keep their integer arithmetic and hardcoded `₱` symbol verbatim. Not touched by this slice beyond documentation. |
| Formatting locale | `en-PH`, for a future `Intl.DateTimeFormat`/`Intl.NumberFormat` call. Documented intent only in this slice (see §3 "Translation locale vs. formatting locale") — never passed to next-intl's locale resolution, never a `getLocale()`/`<html lang>` value. |
| Timezone | `Asia/Manila`, paired with the formatting locale above for future date display. |

**The next-intl resolved locale MUST remain `en` throughout this slice.** `en-PH` never becomes a second translation locale, a `getRequestConfig` return value, a `getLocale()` result, or a `NextIntlClientProvider` `locale` prop.

### 4.3 PoC surfaces

**Login (`apps/web/app/login/page.tsx`):**

| Current (hardcoded) | Key |
| --- | --- |
| `"Clensy Admin Login"` | `auth.title` |
| `"Email"` | `auth.email` |
| `"Password"` | `auth.password` |
| `"Sign in"` / `"Signing in…"` | `auth.submit` / `auth.submitting` |
| `"Invalid email or password."` | `auth.errors.invalidCredentials` |

The translated string for `auth.errors.invalidCredentials` MUST remain the same non-discriminating message Admin Foundation §4.3 specifies (no "email not found" / "wrong password" distinction). This spec relocates the string; it does not reword or branch it.

**Shell nav (`apps/web/lib/nav-groups.ts`, `apps/web/components/layout/app-sidebar.tsx`):**

`NavItem`/`NavGroup` (`apps/web/lib/nav-groups.ts:1-9`) are replaced with a key-only shape:

```ts
export interface NavItem {
  href: string;
  labelKey: string; // e.g. 'items.bookings' — resolved via useTranslations('nav')
}

export interface NavGroup {
  labelKey: string; // e.g. 'groups.operations'
  items: NavItem[];
}
```

**Normative invariant: once migrated, `NavItem`/`NavGroup` MUST NOT carry a `label` field alongside `labelKey`.** A `label` fallback field would create two sources of truth for the same rendered text; `nav-groups.ts` is key-only for anything rendered to a user. The sidebar resolves every rendered label via `useTranslations('nav')` — never `item.label`. `href` values, grouping, and `findActiveHref` matching logic (`apps/web/lib/nav-groups.ts:44-52`) are unchanged. The toggle `aria-label` (`"Expand sidebar"` / `"Collapse sidebar"`, `app-sidebar.tsx:72`) and the collapsed per-item `aria-label` (`app-sidebar.tsx:172`) move to `nav.json` keys; the `"Primary"` landmark `aria-label` (lines 45, 94) is included for consistency.

This resolves Open design decision 2 in the tracking issue: `labelKey` next to `href`, not translation-at-render-from-href, and English is never the source of truth once the migration lands.

### 4.4 `@clensy/ui` boundary

`FormField` (`packages/ui/src/form-field.tsx:3-7`) and `FormDialog` (`packages/ui/src/form-dialog.tsx:6-14`) keep taking plain `label` / `error` / `title` / `submitLabel` strings. `packages/ui/package.json` gets no `next-intl` dependency and no Clensy message catalog. Callers in `apps/web` are responsible for calling `t(...)` before passing a string in. This spec does not touch `FormDialog`'s own hardcoded `'Cancel'` literal (`form-dialog.tsx:36`) — see §2 out-of-scope.

### 4.5 Validation integration (relationship to #51)

Documented target flow (this slice ships the representative `validation.json` entries below; #51 owns the rule engine that produces structured errors):

```text
React Hook Form → @clensy/validation (rule + params) → i18n (`validation.<rule>`) → localized string → @clensy/ui FormField error={...}
```

This spec does not block on #51, and #51 is not blocked on this spec. `messages/en/validation.json` ships with a small set of **representative validation catalog entries** — real ICU templates, not a placeholder file — covering the `required` and `email` rule keys in the `validation` namespace:

```json
{
  "required": "{field} is required",
  "email": "{field} must be a valid email address"
}
```

The field name is always an interpolated `{field}` parameter — never baked into the message text — which is precisely the property that makes these ICU-based keys worth introducing instead of frozen English sentences. Demonstrated using only namespaces this slice already establishes (no forward reference to an unbuilt namespace such as a customer-fields catalog):

```ts
const tValidation = useTranslations('validation');
const tAuth = useTranslations('auth');

tValidation('email', { field: tAuth('email') }); // "Email must be a valid email address"
```

If #51 merges first with fixed English sentences, the follow-up is swapping the renderer, not restructuring the rule engine.

### 4.6 API error strategy

Documented, no `apps/api` change in this slice:

- Do not parse English GraphQL/`class-validator` error strings in `apps/web`.
- The documented flow is: `API error → stable error metadata when available → rule key → validation.<rule>`. `normalizeApiError` (concept, §3) is the name for whichever helper performs that mapping; this spec fixes the flow, not a specific constraint-name table (`isEmail` → `email`-style mappings are an implementation/#51 decision, not something this design pins).
- When no recognized metadata is available, render the generic `common.errors.requestFailed` rather than surfacing the raw API message.
- Login stays exactly as generic as Admin Foundation §4.3 requires (`auth.errors.invalidCredentials`) regardless of the underlying GraphQL failure reason — never a field-level message for login.
- Longer-term (explicitly out of scope): a stable `extensions.code` / `extensions.field` / `extensions.rule` contract from `apps/api`. Documenting it here is a forward pointer, not a commitment this slice implements.

### 4.7 Developer docs

Add a short doc (README section under `apps/web` or a `docs/` note) covering: where catalogs live, how to add a key to an existing namespace, how to consume it (`useTranslations`), and the rule that `@clensy/ui` never imports `next-intl`.

## 5. Rationale

**Why next-intl?** It is built for the App Router (server + client), supports ICU messages and can provide typed message keys as the catalog grows (not a requirement of this slice — see §7), and its plugin wraps `next.config.ts` the same way this repo already wraps config for other concerns — no Pages-router `i18n` config, no custom framework. `NextIntlClientProvider` fits `apps/web`'s current client-heavy tree (login, dashboard modules, `AppSidebar` are all `'use client'`) without forcing a conversion to server components first.

**Why not `/en/...` locale-prefixed routing now?** `middleware.ts`'s matcher (`/app/:path*`) and `next.config.ts`'s legacy `redirects()` table (`apps/web/next.config.ts:14-41`) assume unprefixed paths; every `NAV_GROUPS` `href` does too. Introducing a locale segment here would touch three Accepted specs' routing contracts (Admin Foundation, Dashboard UX Foundation, Web Shell) for a repo shipping one locale. Defer until a second language is real.

**Why keep `formatMinorUnits` integer-only?** The existing helper (`apps/web/lib/format-price.ts:8-12`) is explicitly documented as never performing floating-point arithmetic on a currency value. Swapping to `Intl.NumberFormat` here would reintroduce float risk this repo has already deliberately avoided, for a spec whose thesis is about strings, not money math.

**Why not implement #51's validator in this slice?** #51 owns the validation package's shape; this spec only needs a real target namespace (`validation.json`) so #51 isn't designed against a fiction. Implementing both in one slice would couple two independently-sequenced tickets.

**Why not put message catalogs or `next-intl` in `packages/ui`?** `@clensy/ui` is a shared presentation kit; a Clensy-specific catalog there would mix concerns the way the Shell spec already avoided by keeping shadcn primitives out of `packages/ui`. Callers translate; components render translated strings.

**Why leave `FormDialog`'s `'Cancel'` literal alone?** It's a pre-existing boundary gap, not something this spec's PoC surfaces (login, nav) touch. Fixing it without a concrete localized `FormDialog` caller in scope risks a speculative API change to a shared component for no PoC benefit.

## 6. Testing and acceptance

**Automated (architecture, not just data):**

- A test renders a minimal client component that calls `useTranslations('auth')` and asserts the rendered output resolves through the full path — JSON catalog → `i18n/request.ts` → `NextIntlClientProvider` → `useTranslations` → rendered text (e.g. asserts `"Clensy Admin Login"` appears), using the existing Vitest setup in `apps/web`. A test that only asserts against the raw JSON object (e.g. `messages.auth.title === '...'`) is insufficient — it can pass while the provider wiring is broken.
- A catalog-integrity test/check asserting `i18n/request.ts`'s merged message object has exactly the **v1 acceptance set** of top-level namespaces — `common`, `nav`, `auth`, `validation` (§4.1). This is a v1 snapshot, not an architecture ceiling: a later slice that adds a namespace updates this test's expected set rather than treating the addition as an architecture break.
- A repository check (lint rule or a lightweight script) asserting no file under `apps/web` other than `i18n/request.ts` imports `messages/**` directly (§4.1).
- `NAV_GROUPS` contains only `labelKey`/`href` fields (no `label`) — a type-level or lint-level check is acceptable.

**Automated/manual:**

- Login still shows the same generic, non-discriminating failure copy after migration — same UX, now sourced from `auth.errors.invalidCredentials`.
- `layout.tsx` obtains `<html lang>` via `getLocale()` (§4.2) rather than a hardcoded literal; the rendered value is `en`.

**Manual golden path:**

- `/login` renders title/labels/button/error via keys, same visible English as before.
- Every `NAV_GROUPS` sidebar item renders the same visible label as before, now via `useTranslations('nav')`; sidebar expand/collapse and collapsed per-item `aria-label`s remain correct; `findActiveHref` behavior and every href are unchanged.

**Regression:**

- Existing middleware redirect (`/app/:path*` → `/login` on missing cookie) and legacy `next.config.ts` redirects still work — no locale prefix introduced.
- `formatMinorUnits` output is byte-identical to before this change.

**Build gates:** `pnpm --filter web lint` and `pnpm --filter web build` succeed with the `next-intl` plugin wrapping `next.config.ts`.

## 7. Non-goals

- Translating the entire admin UI or shipping a second language in this ticket.
- Locale-prefixed URLs or any rewrite of session middleware / legacy redirects for i18n.
- Rewriting Nest / `class-validator` or inventing a full API error-code schema.
- Putting product catalogs or `useTranslations` inside `@clensy/ui`.
- A custom i18n framework or a new `@clensy/i18n` package.
- Replacing integer `formatMinorUnits` math with floating `Intl` currency formatting.
- Migrating every existing component/page beyond login + shell nav.
- Changing login's non-discriminating auth-error UX or audit semantics.
- Fixing `FormDialog`'s pre-existing hardcoded `'Cancel'` literal.
- A language switcher or locale detection/persistence mechanism.
- Typed translation keys (a generated `Messages`/global typing setup) and any associated typecheck acceptance criterion. next-intl can support this as the catalog grows, but this slice does not require or configure it.
