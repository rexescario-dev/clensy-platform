# Single App-Level `ClensyI18nProvider` — Design

| Field | Value |
| --- | --- |
| Status | Accepted. **§6.1 amendment (#117): Accepted** 2026-10-03. |
| Date | 2026-10-02 (revised 2026-10-03 after first M3 pass; §6.1 amendment drafted 2026-10-03 for #117) |
| Document kind | Architecture RFC |
| Tracking issue | [#115](https://github.com/rexescario-dev/clensy-platform/issues/115) — deferred from #88/#89. Implemented in PR [#116](https://github.com/rexescario-dev/clensy-platform/pull/116). §6.1 amended by [#117](https://github.com/rexescario-dev/clensy-platform/issues/117) (deferred from PR #116's M7 review, Minor 1–3). |
| Depends on (Accepted) | [App Router i18n Architecture (next-intl)](2026-09-13-web-i18n-architecture-design.md) — next-intl is `apps/web`'s only locale source (`useLocale()` on the client). This spec reads the locale exactly that way (relies upon). [`LoginForm` — Self-Translating UI Copy](2026-09-20-login-form-self-translating-design.md) — its §2 deliberately keeps `/login` without a `ClensyI18nProvider`, relying on `useClensyI18nContext()`'s package-default fallback. This spec preserves that by placing the boundary under `/app` only (relies upon; does not reverse). [Reusable-Component `errorMessage` API](2026-09-20-component-error-message-api-design.md) — established the provider's `locale` + `overrides` contract and the "no provider is a valid state" guarantee (relies upon, unchanged). [Multi-Tenant Architecture](2026-09-23-multi-tenant-architecture-design.md) — §4.8's staff console and the tenant-aware shell are the consumers this spec re-homes; the API stays the authorization boundary (relies upon, unchanged). |
| Related (not a dependency) | [`@clensy/ui` as the Shared UI System](2026-09-16-shadcn-ui-boundary-design.md) — unaffected; this spec does not touch `@clensy/ui`. |
| Followed by | A future, separately specified issue for **tenant-sourced overrides** (§8). Not opened by this spec. |
| Governing references | This document. It does not change `ClensyI18nProvider`, `useClensyTranslations`, any `@clensy/web` message catalog, next-intl configuration, or `/login`. |
| M3 decision | **Accepted** — 2026-10-03, at `31b713a`, by the owner. M4 must stay mechanical and keep the locked decisions: a single AST-detectable provider mount, test-only override mocking, and no production or runtime override source. First pass (2026-10-03) returned nine clarifications, all applied: committed-`{}` wording (§4.1), application-owned override scope (§4.5 items 5 and 9), Vitest mock ordering (§6.2), AST import-resolution and location rules (§6.1), effective-messages equivalence (§4.4), `DashboardLayout` wrapping rationale (§4.3), type-level test framing (§6.3), a no-runtime-override-source invariant (§4.5 item 9), and one canonical term (§3). **§6.1 amendment (#117) — Accepted 2026-10-03, at `9a23c98`, by the owner, with no further clarification.** M4 implements it mechanically from the amended §6.1 and MUST keep the assertion of zero provider escapes anywhere in `apps/web`, independent of the mount assertion. It tightens the structural guard only: the scan covers `.js`/`.jsx`/`.mjs`/`.cjs`/`.mts`/`.cts` as well as `.ts`/`.tsx`, a new **provider escape** rule (§3, §6.1) fails any non-JSX use of the provider, including re-export barrels, and the layout wiring check binds both tag names to their imports. No production code, no other section, and no locked decision above changes. |

## 1. Thesis

`apps/web` currently mounts `ClensyI18nProvider` in three separate places, each passing only `locale`:

| Call site | Wraps |
| --- | --- |
| `apps/web/components/layout/user-menu.tsx:34` (`UserMenu`) | `UserMenuContent` (role label via `useClensyTranslations('roles')`) |
| `apps/web/app/app/admin/page.tsx:32` (`AdminPage`) | `StaffAdminGate` (`StaffDataTable`, `CreateStaffForm`) |
| `apps/web/app/app/bookings/page.tsx:191` | `BookingDataTable` only |

Because of this, `apps/web` has no single place to set an app-wide `@clensy/web` override, such as a role label. An override would have to be copied into each mount, and the copies could drift: the user menu and staff console could show different labels for the same role. Every new page that renders `@clensy/web` components would also have to remember to add its own provider.

**Decision this document locks:** `/app` owns the **app i18n boundary** (§3). Its locale comes from the existing next-intl locale mechanism. Its application-owned overrides come from one typed, static, app-level override module, committed as `{}`. Sourcing overrides from the tenant or the API is explicitly out of scope.

## 2. Scope

**In scope (normative):**

- A new app-level override module, `apps/web/lib/clensy-i18n-overrides.ts` (§4.1).
- A new client wrapper, `apps/web/components/layout/app-i18n-provider.tsx` (`AppI18nProvider`), which renders the app i18n boundary (§4.2).
- Mounting `AppI18nProvider` in `apps/web/app/app/layout.tsx`, the only layout for `/app/*` (§4.3).
- Removing the three existing per-component mounts (§4.4).
- Updating `apps/web/lib/web-shell-regressions.test.ts` and adding behavioural and type-level tests (§6).

**Informative:**

- `apps/web/app/app/layout.tsx`'s existing header comment (`PageHeader` placement) is unrelated and stays as it is.

**Out of scope:**

- Any change to `@clensy/web` or `@clensy/ui`. No package API, export, component, or message catalog changes.
- Any translation content change. `APP_I18N_OVERRIDES` is committed as `{}`, so the application has no override values.
- Tenant- or API-sourced overrides (§8).
- A second locale, or any change to next-intl configuration or `NextIntlClientProvider` placement.
- `/login`. It stays outside the boundary and unchanged.
- `DashboardLayout`, `AppHeader`, `AppSidebar`, or `PageHeader` placement, except that `AppI18nProvider` wraps `DashboardLayout` from the outside.
- Hard-coded English copy elsewhere on the bookings page (e.g. `title="Bookings"`). That is a separate concern.

## 3. Terminology

- **Provider**: `@clensy/web`'s `ClensyI18nProvider` component, i.e. the package API. This spec does not change it.
- **Provider mount**: a JSX element in non-test `apps/web` source whose tag resolves, under the rules in §6.1, to the provider imported from `@clensy/web`.
- **App i18n boundary**: the **sole application-owned provider mount**. It is rendered by `AppI18nProvider` and placed in `apps/web/app/app/layout.tsx`. "Provider" in this document always means the package component; "boundary" means this architectural mount.
- **Application-owned override**: a `DeepPartial<ClensyMessages>` value that `apps/web` supplies to the boundary, merged over `@clensy/web`'s package defaults for the whole `/app` tree. `DeepPartial` and `ClensyMessages` are the types `@clensy/web` already exports.
- **Provider escape** *(added by the #117 amendment)*: in non-test `apps/web` source, a re-export of the provider from `@clensy/web`, or any occurrence of a `@clensy/web` provider binding (named or namespace) other than a provider mount or an exempt position, as defined in §6.1. A re-export or value reference would let a mount happen elsewhere under a different name, so the structural guard treats every escape as a failure.

Reuses **component-owned default** and **override** as defined in the Accepted `errorMessage` spec §3.

## 4. Architecture & contracts

### 4.1 `apps/web/lib/clensy-i18n-overrides.ts`

- Exports exactly one value: `export const APP_I18N_OVERRIDES: DeepPartial<ClensyMessages> = {};`, with both types imported from `@clensy/web`.
- **It is committed as `{}`. The application has no override values.** Tests may replace this module through module mocking (§6.2). No runtime, build-time, or environment-dependent selection of override values is allowed, in this module or anywhere else.
- The explicit type annotation is the primary type contract. Because of it, an unknown namespace, an unknown key path, or a wrong value type fails `tsc`.
- It contains no React code, no hooks, no tenant/session/API logic, and no conditional logic. It is plain data.
- It is the only source of application-owned override values (§4.5 item 5).

### 4.2 `apps/web/components/layout/app-i18n-provider.tsx`

- A `'use client'` component: `AppI18nProvider({ children }: { children: ReactNode })`.
- Reads the locale with next-intl's `useLocale()`, the same source all three current call sites use.
- Renders the app i18n boundary: `<ClensyI18nProvider locale={locale} overrides={APP_I18N_OVERRIDES}>{children}</ClensyI18nProvider>`.
- Its only input is `children`. It accepts no `overrides`, `locale`, or `messages` prop, and it does not forward an override value from any other source (§4.5 item 9).
- `APP_I18N_OVERRIDES` is a module-level constant with a stable reference, so the provider's `useMemo([locale, overrides])` does not recompute the merged messages on re-render.

### 4.3 `apps/web/app/app/layout.tsx`

- Renders `<AppI18nProvider><DashboardLayout>{children}</DashboardLayout></AppI18nProvider>`.
- Stays a Server Component. `AppI18nProvider` is a client child, the same pattern as the root layout's `NextIntlClientProvider` and `ApolloProvider`.
- `NextIntlClientProvider` (root layout) stays above it, so `useLocale()` resolves.
- `DashboardLayout` itself is not an i18n consumer and does not need the boundary. Wrapping it is deliberate: everything under `/app`, including the header's `UserMenu` and every page in `children`, shares one boundary. The boundary MUST NOT be moved inside `DashboardLayout` or narrowed to only the components that consume it today.

### 4.4 Removal of per-component mounts

| File | After |
| --- | --- |
| `components/layout/user-menu.tsx` | `UserMenu` is a single component. `UserMenuContent`'s body moves into it, and the provider wrapper and its `useLocale()` call are removed. `useClensyTranslations('roles')` and `accountIdentity(data?.currentAdmin)` stay. |
| `app/app/admin/page.tsx` | `AdminPage` renders `StaffAdminGate` directly (or `StaffAdminGate` becomes the default export). The provider import and `useLocale()` are removed. |
| `app/app/bookings/page.tsx` | `BookingDataTable` renders without a wrapper. The provider import is removed, and `useLocale()` / the `next-intl` import are removed if nothing else uses them (today nothing does). |

**Equivalence:** with `APP_I18N_OVERRIDES = {}` and the same next-intl locale, all existing `@clensy/web` consumers receive the same effective messages as before. This statement is about effective messages, not about identical React context topology; the boundary now wraps `DashboardLayout` rather than individual consumers.

### 4.5 Invariants

1. Non-test `apps/web` source MUST contain exactly one provider mount, the app i18n boundary, and it MUST be in `components/layout/app-i18n-provider.tsx`.
2. `apps/web/app/app/layout.tsx` MUST mount `AppI18nProvider` around `DashboardLayout`.
3. No other page, layout, or component in `apps/web` MAY mount the provider. A new page that renders `@clensy/web` components MUST rely on the boundary.
4. `/login` MUST NOT be inside the boundary (preserves LoginForm spec §2).
5. Application-owned override values MUST enter the `/app` tree only through `APP_I18N_OVERRIDES`. `AppI18nProvider` MUST be the only application-owned provider mount.
6. `APP_I18N_OVERRIDES` MUST be typed `DeepPartial<ClensyMessages>` and MUST be committed as `{}`.
7. The boundary's locale MUST come from next-intl (`useLocale()`). It MUST NOT be hard-coded or come from another source.
8. `@clensy/web` and `@clensy/ui` are untouched. This spec introduces no package API changes.
9. `AppI18nProvider` MUST NOT accept or forward an override value from props, context, environment variables, session state, API data, or any other runtime source.

## 5. Rationale

**Why a dedicated wrapper in `/app/layout.tsx` rather than inside `DashboardLayout`?** `/app/layout.tsx` is already documented as the only layout for the `/app/*` tree, so the boundary is easy to find there and the regression test can check it directly. Putting the mount inside `DashboardLayout` would mix i18n with shell chrome (sidebar, header, toasts) and make the boundary harder to find. The wrapper also keeps the server layout thin, because `useLocale()` needs a client component.

**Why not the root layout?** It would wrap `/login`, which the Accepted LoginForm spec (§2) deliberately left without a provider as a YAGNI decision. Nothing on `/login` needs app-wide overrides today.

**Why a static, typed module rather than tenant-sourced overrides now?** The issue asks for a single app-wide override seam and forbids translation content changes. No override source exists today. A typed constant committed as `{}` gives the boundary a real, compile-checked contract without inventing tenant-settings storage or API work. A future tenant-sourced design can replace where the values come from behind the same boundary.

**Why no `overrides` prop on `AppI18nProvider`?** A prop would create a second entry point for override values that could drift from the module, which is the problem this spec removes. Tests replace the module instead (§6.2), so they exercise the real production wiring.

## 6. Testing

### 6.1 Structural regression (`apps/web/lib/web-shell-regressions.test.ts`)

The existing assertion `expect(userMenu).toContain('<ClensyI18nProvider')` is replaced. The other assertions in that `it` block stay (`useClensyTranslations('roles')`, `accountIdentity(...)`, no hard-coded copy).

**Primary guard (AST-based).** *(Amended by #117; see the M3 decision row.)* The guard is syntactic: it uses the TypeScript compiler API's parser, which `apps/web` already depends on, with no type checker and no module resolution.

**Scanned files.** Every file under `apps/web` whose name matches `/\.(m|c)?[jt]sx?$/` is scanned, except:

- anything under `node_modules` or `.next`;
- declaration files (`.d.ts`, `.d.mts`, `.d.cts`);
- test files (`*.test.*`).

Each file is parsed with the `ScriptKind` for its extension: `.ts`, `.mts`, `.cts` → `TS`; `.tsx` → `TSX`; `.js`, `.mjs`, `.cjs` → `JS`; `.jsx` → `JSX`. `apps/web/tsconfig.json` sets `allowJs: true`, so a JavaScript file can mount the provider as easily as a TypeScript one.

**Provider bindings.** Import resolution is limited to this boundary:

- Consider only `import` declarations whose module specifier is exactly `'@clensy/web'`.
- From those declarations, collect:
  - **named bindings**: named imports of `ClensyI18nProvider`, including aliases (`import { ClensyI18nProvider as P }` → local `P`);
  - **namespace bindings**: namespace imports (`import * as W from '@clensy/web'`).

**Provider mounts.** A JSX opening or self-closing element is a provider mount only if its tag is:

- an identifier that is a collected named binding, or
- a property access `W.ClensyI18nProvider` where `W` is a collected namespace binding.

Any other identifier or property access is **not** a mount, even if it is spelled `ClensyI18nProvider`.

**Provider escapes.** Each of the following is one escape:

1. **Package re-export.** An `export … from '@clensy/web'` declaration that is `export *`, is `export * as X`, or has an export specifier whose imported name is `ClensyI18nProvider` (aliased or not).
2. **Named-binding occurrence.** Every identifier occurrence of a collected named binding is an escape, unless it is:
   - the tag name of a JSX opening, closing or self-closing element;
   - the binding's own import specifier; or
   - in a type position: the expression name of a `typeof` type query (`typeof P`).

   For example, `export { P }`, `export default P`, `const Q = P`, `{ P }`, `fn(P)` and `createElement(P)` are all escapes. `createElement(P)` is a mount without JSX.
3. **Namespace-binding occurrence.** Every identifier occurrence of a collected namespace binding is an escape, unless it is:
   - the expression of `W.ClensyI18nProvider` used as the tag name of a JSX opening, closing or self-closing element (a mount); or
   - in a type position: inside a `typeof` type query (`typeof W.ClensyI18nProvider`), or the left side of a qualified type name (`W.SomeType`).

   For example, `W.ClensyI18nProvider` as a value, `W['ClensyI18nProvider']`, `W.foo`, and bare `W` (`const X = W`, `export { W }`) are all escapes.

An identifier is an "occurrence" by spelling. Property names (`obj.P`), property-assignment keys (`{ P: 1 }`), and JSX attribute names (`<X P="…" />`) are not identifier references and are not counted. The guard does **no scope analysis**: a local declaration that shadows a collected binding name is still counted. That false positive is intended, because the guard fails closed.

Assertions:

- The set of provider mounts across `apps/web` has exactly **one** member.
- That member is in `components/layout/app-i18n-provider.tsx`. The test MUST fail if the single mount is in any other file, not only if the count is wrong.
- `apps/web` has **zero** provider escapes, in every scanned file, including `components/layout/app-i18n-provider.tsx`.

This check does not depend on formatting, line breaks, or import style.

**Layout wiring.** Parse `app/app/layout.tsx` the same way and assert, syntactically:

- Exactly one JSX element has a tag that is the local name bound by a named import of `AppI18nProvider` from exactly `'../../components/layout/app-i18n-provider'`. Aliases pass.
- That provider element directly wraps exactly one non-whitespace child, and that child is a JSX element whose tag is the local name bound by a named import of `DashboardLayout` from exactly `'../../components/layout/dashboard-layout'`. Aliases pass.
- A tag spelled `AppI18nProvider` or `DashboardLayout` whose binding is imported from any other module, or not imported at all, fails.

**Fixtures.** Each bypass this amendment closes MUST have an inline fixture that fails against the pre-amendment guard and passes against the amended one:

- a JavaScript or `.jsx` source mounting the provider, and the file selection accepting and rejecting the right names;
- each escape form in items 1–3 above;
- layout sources with a wrong provider import path, a wrong `DashboardLayout` import path, and aliased imports.

The existing fixture "an import that is never rendered" (`export { ClensyI18nProvider }`) still has zero mounts, and now has one escape.

**Secondary text guard.** A source scan confirms that `user-menu.tsx`, `admin/page.tsx`, `bookings/page.tsx` and `app/login/page.tsx` do not contain `ClensyI18nProvider`.

### 6.2 Behavioural (new rendered test in `apps/web`)

- The test MUST mock `lib/clensy-i18n-overrides` before `AppI18nProvider` is imported or evaluated. Use Vitest's hoisted `vi.mock` semantics, with `vi.hoisted` or a dynamic import of `AppI18nProvider` if needed. Otherwise the real `{}` could be captured and the test would give a false negative.
- The mock supplies a **test-only** override, e.g. `{ roles: { FINANCE: 'Billing' } }`. The committed module is unchanged.
- Inside `NextIntlClientProvider` and the real `AppI18nProvider`, render:
  - `UserMenu`, with `@clensy/client` hooks and `next/navigation` mocked and `currentAdmin` returning a FINANCE admin;
  - `StaffDataTable` with a FINANCE staff row;
  - `CreateStaffForm`, whose role options include FINANCE.
- Assert that "Billing" appears in all three, and that the package default label for FINANCE appears in none of them.

### 6.3 Type-level

The explicit annotation on `APP_I18N_OVERRIDES` (§4.1) is the primary type-level enforcement. A supplemental type-only check runs under `apps/web`'s `tsc` in CI. It applies `@ts-expect-error` to representative invalid shapes (an unknown key path and a wrong value type) assigned to `DeepPartial<ClensyMessages>`, to confirm that the same exported types reject them.

### 6.4 Unchanged

`@clensy/web` package tests, `tenant-role-regressions.test.ts`, and the i18n rendering test are untouched. The existing suites, `apps/web` type-check and lint must still pass.

## 7. Non-goals

- Tenant-, session-, or API-sourced override values.
- Any `@clensy/web` / `@clensy/ui` change, including a new export or prop.
- Any translation content change, including a committed override value.
- Wrapping `/login`, or moving `NextIntlClientProvider`.
- A second locale.
- Converting the bookings page's remaining hard-coded copy.

## 8. Follow-ons (explicit deferrals)

- **Tenant-sourced overrides.** Per-tenant labels (e.g. a tenant renaming `FINANCE`) need a data source (tenant settings, API field, or `currentAdmin` extension), a loading and fallback story, and cache invalidation on tenant switch. That needs its own issue and spec. It would change only where the boundary's application-owned values come from, not the boundary set here. That change would also need to revise §4.5 items 6 and 9 explicitly.

## 9. Acceptance criteria (for this specification)

- States the three current mounts and their exact replacement (§1, §4.4) precisely enough that M4 does not need to invent them.
- Names a single owner, file, locale source, and override source for the app i18n boundary (§4.1–§4.3), with MUST-level invariants (§4.5).
- States that the override module is committed as `{}` with no environment-dependent selection (§4.1, §4.5 item 6).
- Preserves `/login`'s provider-less state from the Accepted LoginForm spec and states why (§4.5 item 4, §5).
- Defines the structural, behavioural, and type-level tests:
  - The structural test's import-resolution rules and location requirement are normative (§6.1).
  - The behavioural test's mock-ordering requirement and test-only override are explicit (§6.2).
  - The type-level test is framed as supplemental to the annotation (§6.3).
- *(#117 amendment.)* §6.1 states the scanned extension set and its exclusions, the provider escape forms and their exempt positions, the zero-escape assertion, the syntactic import binding of both layout tags, and the fixture requirement. These are precise enough that M4 does not need to invent any rule. The amendment changes nothing outside §3's new term and §6.1, and adds no production change.
- Explicitly defers tenant-sourced overrides (§8) and introduces no `@clensy/web` / `@clensy/ui` API changes (§4.5 item 8).
- Covers each acceptance bullet of #115: one app-level provider that the user menu, admin page and bookings page all render through; one override applying to the user menu, staff table and create-staff form; the regression test updated to check for the single provider; and consistency with the Web i18n spec and the package boundary.
