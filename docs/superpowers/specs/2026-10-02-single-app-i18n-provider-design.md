# Single App-Level `ClensyI18nProvider` — Design

| Field | Value |
| --- | --- |
| Status | Draft |
| Date | 2026-10-02 |
| Document kind | Architecture RFC |
| Tracking issue | [#115](https://github.com/rexescario-dev/clensy-platform/issues/115) — deferred from #88/#89 |
| Depends on (Accepted) | [App Router i18n Architecture (next-intl)](2026-09-13-web-i18n-architecture-design.md) — next-intl is `apps/web`'s only locale source (`useLocale()` on the client). This spec reads the locale exactly that way (relies upon). [`LoginForm` — Self-Translating UI Copy](2026-09-20-login-form-self-translating-design.md) — its §2 deliberately keeps `/login` without a `ClensyI18nProvider`, relying on `useClensyI18nContext()`'s package-default fallback. This spec preserves that by mounting below `/login`'s level, under `/app` only (relies upon; does not reverse). [Reusable-Component `errorMessage` API](2026-09-20-component-error-message-api-design.md) — established `ClensyI18nProvider`'s `locale` + `overrides` contract and the "no Provider is a valid state" guarantee (relies upon, unchanged). [Multi-Tenant Architecture](2026-09-23-multi-tenant-architecture-design.md) — §4.8's staff console and the tenant-aware shell are the consumers this spec re-homes; the API stays the authorization boundary (relies upon, unchanged). |
| Related (not a dependency) | [`@clensy/ui` as the Shared UI System](2026-09-16-shadcn-ui-boundary-design.md) — unaffected; this spec does not touch `@clensy/ui`. |
| Followed by | A future, separately specified issue for **tenant-sourced overrides** (§8). Not opened by this spec. |
| Governing references | This document. It does not change `ClensyI18nProvider`, `useClensyTranslations`, any `@clensy/web` message catalog, next-intl configuration, or `/login`. |
| M3 decision | Pending. |

## 1. Thesis

`apps/web` currently mounts `ClensyI18nProvider` in three separate places, each passing only `locale`:

| Call site | Wraps |
| --- | --- |
| `apps/web/components/layout/user-menu.tsx:34` (`UserMenu`) | `UserMenuContent` (role label via `useClensyTranslations('roles')`) |
| `apps/web/app/app/admin/page.tsx:32` (`AdminPage`) | `StaffAdminGate` (`StaffDataTable`, `CreateStaffForm`) |
| `apps/web/app/app/bookings/page.tsx:191` | `BookingDataTable` only |

Because of this, `apps/web` has no single place to set an app-wide `@clensy/web` override, such as a role label. An override would have to be copied into each mount, and the copies could drift: the user menu and staff console could show different labels for the same role. Every new page that renders `@clensy/web` components would also have to remember to add its own provider.

**Decision this document locks:** `/app` owns the single application-wide `ClensyI18nProvider`. Its locale comes from the existing next-intl locale mechanism. Its overrides come from one typed, static, app-level override module that is empty in production. Sourcing overrides from the tenant or the API is explicitly out of scope.

## 2. Scope

**In scope (normative):**

- A new app-level override module, `apps/web/lib/clensy-i18n-overrides.ts` (§4.1).
- A new client wrapper, `apps/web/components/layout/app-i18n-provider.tsx` (`AppI18nProvider`) (§4.2).
- Mounting `AppI18nProvider` in `apps/web/app/app/layout.tsx`, the only layout for `/app/*` (§4.3).
- Removing the three existing per-component mounts (§4.4).
- Updating `apps/web/lib/web-shell-regressions.test.ts` and adding behavioural and type-level tests (§6).

**Informative:**

- `apps/web/app/app/layout.tsx`'s existing header comment (`PageHeader` placement) is unrelated and stays as it is.

**Out of scope:**

- Any change to `@clensy/web` or `@clensy/ui`. No package API, export, component, or message catalog changes.
- Any translation content change. The production override object ships empty.
- Tenant- or API-sourced overrides (§8).
- A second locale, or any change to next-intl configuration or `NextIntlClientProvider` placement.
- `/login`. It stays outside the provider and unchanged.
- `DashboardLayout`, `AppHeader`, `AppSidebar`, or `PageHeader` placement, except that `AppI18nProvider` wraps `DashboardLayout` from the outside.
- Hard-coded English copy elsewhere on the bookings page (e.g. `title="Bookings"`). That is a separate concern.

## 3. Terminology

- **Provider mount**: a JSX element in non-test `apps/web` source that renders `@clensy/web`'s `ClensyI18nProvider` under any local binding (named import, aliased import, or namespace member).
- **App-wide override**: a `DeepPartial<ClensyMessages>` value merged over `@clensy/web`'s package defaults for the whole `/app` tree. `DeepPartial` and `ClensyMessages` are the types `@clensy/web` already exports.
- **App i18n boundary**: the `AppI18nProvider` element in `apps/web/app/app/layout.tsx`.

Reuses **component-owned default** and **override** as defined in the Accepted `errorMessage` spec §3.

## 4. Architecture & contracts

### 4.1 `apps/web/lib/clensy-i18n-overrides.ts`

- Exports exactly one value: `APP_I18N_OVERRIDES`, typed `DeepPartial<ClensyMessages>`, with both types imported from `@clensy/web`.
- In production its value is `{}`.
- The explicit type annotation is the contract. Because of it, an unknown namespace, an unknown key path, or a wrong value type fails `tsc`.
- It contains no React code, no hooks, no tenant/session/API logic, and no conditional logic. It is plain data.
- It is the **only** way overrides enter the `/app` tree.

### 4.2 `apps/web/components/layout/app-i18n-provider.tsx`

- A `'use client'` component: `AppI18nProvider({ children }: { children: ReactNode })`.
- Reads the locale with next-intl's `useLocale()`, the same source all three current call sites use.
- Renders `<ClensyI18nProvider locale={locale} overrides={APP_I18N_OVERRIDES}>{children}</ClensyI18nProvider>`.
- Has **no** `overrides`, `locale`, or `messages` prop. Its only input is `children`. This keeps the override module the single source of overrides, so a caller or test cannot bypass it through a prop.
- `APP_I18N_OVERRIDES` is a module-level constant with a stable reference, so `ClensyI18nProvider`'s `useMemo([locale, overrides])` does not recompute the merged messages on re-render.

### 4.3 `apps/web/app/app/layout.tsx`

- Renders `<AppI18nProvider><DashboardLayout>{children}</DashboardLayout></AppI18nProvider>`.
- Stays a Server Component. `AppI18nProvider` is a client child, the same pattern as the root layout's `NextIntlClientProvider` and `ApolloProvider`.
- `NextIntlClientProvider` (root layout) stays above it, so `useLocale()` resolves.
- Because `AppHeader`/`UserMenu` render inside `DashboardLayout`, the one mount covers the user menu and every `/app/*` page.

### 4.4 Removal of per-component mounts

| File | After |
| --- | --- |
| `components/layout/user-menu.tsx` | `UserMenu` is a single component. `UserMenuContent`'s body moves into it, and the provider wrapper and its `useLocale()` call are removed. `useClensyTranslations('roles')` and `accountIdentity(data?.currentAdmin)` stay. |
| `app/app/admin/page.tsx` | `AdminPage` renders `StaffAdminGate` directly (or `StaffAdminGate` becomes the default export). The `ClensyI18nProvider` import and `useLocale()` are removed. |
| `app/app/bookings/page.tsx` | `BookingDataTable` renders without a wrapper. The `ClensyI18nProvider` import is removed, and `useLocale()` / the `next-intl` import are removed if nothing else uses them (today nothing does). |

No component's rendered output changes: with `APP_I18N_OVERRIDES = {}` and the same locale, each consumer gets exactly the messages it gets today.

### 4.5 Invariants

1. Non-test `apps/web` source MUST contain exactly one provider mount (§3), and it MUST be in `components/layout/app-i18n-provider.tsx`.
2. `apps/web/app/app/layout.tsx` MUST mount `AppI18nProvider` around `DashboardLayout`.
3. No other page, layout, or component in `apps/web` MAY mount `ClensyI18nProvider`. A new page that renders `@clensy/web` components MUST rely on the app boundary.
4. `/login` MUST NOT be wrapped by `ClensyI18nProvider` (preserves LoginForm spec §2).
5. Overrides MUST enter the `/app` tree only through `APP_I18N_OVERRIDES`, and `AppI18nProvider` MUST NOT accept an override prop.
6. `APP_I18N_OVERRIDES` MUST be typed `DeepPartial<ClensyMessages>` and MUST be `{}` in production.
7. The provider's locale MUST come from next-intl (`useLocale()`). It MUST NOT be hard-coded or come from another source.
8. `@clensy/web` and `@clensy/ui` are untouched. This spec introduces no package API changes.

## 5. Rationale

**Why a dedicated wrapper in `/app/layout.tsx` rather than inside `DashboardLayout`?** `/app/layout.tsx` is already documented as the only layout for the `/app/*` tree, so the app i18n boundary is easy to find there and the regression test can check it directly. Putting the mount inside `DashboardLayout` would mix i18n with shell chrome (sidebar, header, toasts) and make the single mount harder to find. The wrapper also keeps the server layout thin, because `useLocale()` needs a client component.

**Why not the root layout?** It would wrap `/login`, which the Accepted LoginForm spec (§2) deliberately left without a provider as a YAGNI decision. Nothing on `/login` needs app-wide overrides today.

**Why a static, typed module rather than tenant-sourced overrides now?** The issue asks for a single app-wide override seam and forbids translation content changes. No override source exists today. A typed constant gives the provider a real, compile-checked contract without inventing tenant-settings storage or API work. A future tenant-sourced design can replace the module's data source behind the same boundary.

**Why no `overrides` prop on `AppI18nProvider`?** A prop would create a second override entry point that could drift from the module, which is the problem this spec removes. Tests replace the module instead (§6.2), so they exercise the real production wiring.

## 6. Testing

### 6.1 Structural regression (`apps/web/lib/web-shell-regressions.test.ts`)

The existing assertion `expect(userMenu).toContain('<ClensyI18nProvider')` is replaced. The other assertions in that `it` block stay (`useClensyTranslations('roles')`, `accountIdentity(...)`, no hard-coded copy).

- **Primary guard (AST-based).** Parse every non-test `.ts`/`.tsx` file under `apps/web` (excluding `node_modules`, `.next`, and generated output) with the TypeScript compiler API, which `apps/web` already depends on. For each file:
  - Find the local bindings imported from `@clensy/web` for `ClensyI18nProvider`, both named (including `as` aliases) and namespace (`* as X` → `X.ClensyI18nProvider`).
  - Count JSX opening and self-closing elements whose tag resolves to one of those bindings.
  - Assert that the total across `apps/web` is exactly **1**, all in `components/layout/app-i18n-provider.tsx`.

  This check does not depend on formatting, line breaks, or import style.
- **Layout wiring.** Parse `app/app/layout.tsx` the same way and assert that it renders an `AppI18nProvider` element (imported from `components/layout/app-i18n-provider`) whose child is `DashboardLayout`.
- **Secondary text guard.** A source scan confirms that `user-menu.tsx`, `admin/page.tsx`, `bookings/page.tsx` and `app/login/page.tsx` do not contain `ClensyI18nProvider`.

### 6.2 Behavioural (new rendered test in `apps/web`)

- `vi.mock` replaces `lib/clensy-i18n-overrides` with a **test-only** override, e.g. `{ roles: { FINANCE: 'Billing' } }`. Production content is not changed.
- Inside `NextIntlClientProvider` and the real `AppI18nProvider`, render:
  - `UserMenu`, with `@clensy/client` hooks and `next/navigation` mocked and `currentAdmin` returning a FINANCE admin;
  - `StaffDataTable` with a FINANCE staff row;
  - `CreateStaffForm`, whose role options include FINANCE.
- Assert that "Billing" appears in all three, and that the package default label for FINANCE appears in none of them.

### 6.3 Type-level

A type-only check (e.g. `@ts-expect-error` on an unknown key path and on a wrong value type assigned to `DeepPartial<ClensyMessages>`) runs under `apps/web`'s `tsc` in CI. It proves the override type actually constrains the shape.

### 6.4 Unchanged

`@clensy/web` package tests, `tenant-role-regressions.test.ts`, and the i18n rendering test are untouched. The existing suites, `apps/web` type-check and lint must still pass.

## 7. Non-goals

- Tenant-, session-, or API-sourced override values.
- Any `@clensy/web` / `@clensy/ui` change, including a new export or prop.
- Any translation content change, including a production override value.
- Wrapping `/login`, or moving `NextIntlClientProvider`.
- A second locale.
- Converting the bookings page's remaining hard-coded copy.

## 8. Follow-ons (explicit deferrals)

- **Tenant-sourced overrides.** Per-tenant labels (e.g. a tenant renaming `FINANCE`) need a data source (tenant settings, API field, or `currentAdmin` extension), a loading and fallback story, and cache invalidation on tenant switch. That needs its own issue and spec. It would change only where `AppI18nProvider` gets its override value, not the boundary set here.

## 9. Acceptance criteria (for this specification)

- States the three current mounts and their exact replacement (§1, §4.4) precisely enough that M4 does not need to invent them.
- Names a single owner, file, locale source, and override source for the app-level provider (§4.1–§4.3), with MUST-level invariants (§4.5).
- Preserves `/login`'s provider-less state from the Accepted LoginForm spec and states why (§4.5 item 4, §5).
- Defines structural, behavioural, and type-level tests. The structural test must not rely only on a raw text count (§6.1), and the behavioural test must use a test-only override and leave production content unchanged (§6.2).
- Explicitly defers tenant-sourced overrides (§8) and introduces no `@clensy/web` / `@clensy/ui` API changes (§4.5 item 8).
- Covers each acceptance bullet of #115: one app-level provider that the user menu, admin page and bookings page all render through; one override applying to the user menu, staff table and create-staff form; the regression test updated to check for the single provider; and consistency with the Web i18n spec and the package boundary.
