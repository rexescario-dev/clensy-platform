# Single App-Level `ClensyI18nProvider` — Design

| Field | Value |
| --- | --- |
| Status | Accepted. **§6.1 amendment (#117): Accepted** 2026-10-03. **§6.1 amendment (#120): Accepted** 2026-10-03. **§6.1 amendment (#122): Accepted** 2026-10-03. **§6.1 amendment (#124): Accepted** 2026-10-03. |
| Date | 2026-10-02 (revised 2026-10-03 after first M3 pass; §6.1 amendment drafted 2026-10-03 for #117; second §6.1 amendment drafted 2026-10-03 for #120; third §6.1 amendment drafted 2026-10-03 for #122; fourth §6.1 amendment drafted 2026-10-03 for #124) |
| Document kind | Architecture RFC |
| Tracking issue | [#115](https://github.com/rexescario-dev/clensy-platform/issues/115) — deferred from #88/#89. Implemented in PR [#116](https://github.com/rexescario-dev/clensy-platform/pull/116). §6.1 amended by [#117](https://github.com/rexescario-dev/clensy-platform/issues/117) (deferred from PR #116's M7 review, Minor 1–3), implemented in PR [#119](https://github.com/rexescario-dev/clensy-platform/pull/119). §6.1 amended again by [#120](https://github.com/rexescario-dev/clensy-platform/issues/120) (the #117 final-review follow-ups), implemented in PR [#121](https://github.com/rexescario-dev/clensy-platform/pull/121). §6.1 amended a third time by [#122](https://github.com/rexescario-dev/clensy-platform/issues/122) (the #120 final-review follow-up), implemented in PR [#123](https://github.com/rexescario-dev/clensy-platform/pull/123). §6.1 amended a fourth time by [#124](https://github.com/rexescario-dev/clensy-platform/issues/124) (the deferred #117 minors and the #122 fixture), implemented in PR [#125](https://github.com/rexescario-dev/clensy-platform/pull/125). |
| Depends on (Accepted) | [App Router i18n Architecture (next-intl)](2026-09-13-web-i18n-architecture-design.md) — next-intl is `apps/web`'s only locale source (`useLocale()` on the client). This spec reads the locale exactly that way (relies upon). [`LoginForm` — Self-Translating UI Copy](2026-09-20-login-form-self-translating-design.md) — its §2 deliberately keeps `/login` without a `ClensyI18nProvider`, relying on `useClensyI18nContext()`'s package-default fallback. This spec preserves that by placing the boundary under `/app` only (relies upon; does not reverse). [Reusable-Component `errorMessage` API](2026-09-20-component-error-message-api-design.md) — established the provider's `locale` + `overrides` contract and the "no provider is a valid state" guarantee (relies upon, unchanged). [Multi-Tenant Architecture](2026-09-23-multi-tenant-architecture-design.md) — §4.8's staff console and the tenant-aware shell are the consumers this spec re-homes; the API stays the authorization boundary (relies upon, unchanged). |
| Related (not a dependency) | [`@clensy/ui` as the Shared UI System](2026-09-16-shadcn-ui-boundary-design.md) — unaffected; this spec does not touch `@clensy/ui`. |
| Followed by | A future, separately specified issue for **tenant-sourced overrides** (§8). Not opened by this spec. Now [#118](https://github.com/rexescario-dev/clensy-platform/issues/118): [Tenant-Sourced Role Label Overrides](2026-10-03-tenant-label-overrides-design.md) (Accepted 2026-10-03), which amends §4.5 items 5, 6, 8 and 9 and narrows §4.1. |
| Governing references | This document. It does not change `ClensyI18nProvider`, `useClensyTranslations`, any `@clensy/web` message catalog, next-intl configuration, or `/login`. |
| M3 decision | **Accepted** — 2026-10-03, at `31b713a`, by the owner. M4 must stay mechanical and keep the locked decisions: a single AST-detectable provider mount, test-only override mocking, and no production or runtime override source. First pass (2026-10-03) returned nine clarifications, all applied: committed-`{}` wording (§4.1), application-owned override scope (§4.5 items 5 and 9), Vitest mock ordering (§6.2), AST import-resolution and location rules (§6.1), effective-messages equivalence (§4.4), `DashboardLayout` wrapping rationale (§4.3), type-level test framing (§6.3), a no-runtime-override-source invariant (§4.5 item 9), and one canonical term (§3). **§6.1 amendment (#117) — Accepted 2026-10-03, at `9a23c98`, by the owner, with no further clarification.** M4 implements it mechanically from the amended §6.1 and MUST keep the assertion of zero provider escapes anywhere in `apps/web`, independent of the mount assertion. It tightens the structural guard only: the scan covers `.js`/`.jsx`/`.mjs`/`.cjs`/`.mts`/`.cts` as well as `.ts`/`.tsx`, a new **provider escape** rule (§3, §6.1) fails any non-JSX use of the provider, including re-export barrels, and the layout wiring check binds both tag names to their imports. No production code, no other section, and no locked decision above changes. **§6.1 amendment (#120) — Accepted 2026-10-03, at `3b2197c`, by the owner, with no further clarification.** M4 translates these invariants into detector decomposition and fixtures, without weakening or broadening them. The owner explicitly confirmed that a type-position `import('@clensy/web/src')` is a boundary violation. It closes the three gaps the #117 final review found, still syntactically and still failing closed. It adds **two new invariants**, each with its own assertion, rather than folding them into the provider detector: the **package boundary** (no deep `@clensy/web/…` specifier, and no path into `packages/web`, in any module-specifier form) and **one dashboard shell** (exactly one `DashboardLayout` element across `apps/web`). It also extends **provider escapes** with item 4, **package load calls**. No production code changes, and no `exports` map is added to `packages/web`. No other section, and no locked decision above, changes. **§6.1 amendment (#122) — Accepted 2026-10-03, at `e069965`, by the owner, with no further clarification.** M4 implements item 3 mechanically, without broadening it. It extends the existing **package boundary** invariant with no new invariant or assertion. A relative, absolute or `@/` target that contains the consecutive path segments `node_modules`, `@clensy`, `web` is also a violation, which closes the pnpm-symlink path `../../node_modules/@clensy/web` into `packages/web`. Segments are matched whole, there is no symlink resolution or file-system lookup, and bare specifiers are untouched. Provider rules, escape item 4, the dashboard shell and every other #117/#120 rule and acceptance criterion are unchanged. **§6.1 amendment (#124) — Accepted 2026-10-03, at `03582a0`, by the owner, with no further clarification.** M4 must implement every exemption as an exact syntax-position test on the precise name node, never as "anything under" a construct (for example, not everything under an `InterfaceDeclaration` or `ImportTypeNode`). It must pair each newly exempt position with a retained-escape fixture wherever an over-broad predicate is plausible, and keep `class … extends W.X` pinned as an escape. It narrows five known false positives, which all failed closed, by exempting **only** syntactic positions that cannot load or mount the provider. Every value or runtime-capable position stays an escape and is pinned. The changes: (1) named binding: the leftmost name inside a `typeof` query; (2) namespace binding: type-only heritage (`implements`, interface `extends`), while class `extends` is runtime heritage and stays an escape; (3) and (4) more non-reference name positions (declaration names, labels, the right-hand side of a qualified name, import type qualifiers); (5) `ScriptKind` for `.mtsx`/`.ctsx` (TSX) and `.mjsx`/`.cjsx` (JSX), with the scan regex unchanged. It also requires a characterisation fixture for the #122 `node_modules` provider interaction. There is no new invariant or assertion. The package boundary, the dashboard shell, load calls and every other #117/#120/#122 rule are unchanged, and there is no production code change. |

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
- **Package boundary violation** *(added by the #120 amendment)*: in non-test `apps/web` source, a module specifier that targets a deep `@clensy/web/…` subpath or a path inside the `packages/web` package, as defined in §6.1. Bare `@clensy/web`, the package's public entry point, is not a violation.
- **Dashboard shell element** *(added by the #120 amendment)*: a JSX element in non-test `apps/web` source that is recognised as `DashboardLayout` under the rules in §6.1.

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

Each file is parsed with the `ScriptKind` for its extension: `.ts`, `.mts`, `.cts` → `TS`; `.tsx` → `TSX`; `.js`, `.mjs`, `.cjs` → `JS`; `.jsx` → `JSX`. *(#124)* The scan regex also admits `.mtsx`, `.ctsx`, `.mjsx` and `.cjsx`: any scanned name ending in `tsx` is parsed as `TSX`, and any ending in `jsx` as `JSX`, so a mount in them is seen. The regex itself, and therefore the scanned set, is unchanged. `apps/web/tsconfig.json` sets `allowJs: true`, so a JavaScript file can mount the provider as easily as a TypeScript one.

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
   - in a type position: the expression name of a `typeof` type query (`typeof P`), or *(#124)* the leftmost name of a qualified name inside a `typeof` type query (`typeof P.displayName`, `typeof P.a.b`). A value use such as `const Q = P.displayName` stays an escape.

   For example, `export { P }`, `export default P`, `const Q = P`, `{ P }`, `fn(P)` and `createElement(P)` are all escapes. `createElement(P)` is a mount without JSX.
3. **Namespace-binding occurrence.** Every identifier occurrence of a collected namespace binding is an escape, unless it is:
   - the expression of `W.ClensyI18nProvider` used as the tag name of a JSX opening, closing or self-closing element (a mount); or
   - in a type position: inside a `typeof` type query (`typeof W.ClensyI18nProvider`), or the left side of a qualified type name (`W.SomeType`); or
   - *(#124)* in type-only heritage: the leftmost name of the expression in a class `implements` clause (`class C implements W.Foo`) or an interface `extends` clause (`interface I extends W.Foo`). A class `extends` clause is **never** exempt: class `extends` is runtime heritage and can therefore depend on the provider binding (`class C extends W.ClensyI18nProvider` is an escape). The exemption does not generalise to other heritage clauses.

   For example, `W.ClensyI18nProvider` as a value, `W['ClensyI18nProvider']`, `W.foo`, and bare `W` (`const X = W`, `export { W }`) are all escapes.
4. **Package load call** *(added by #120)*. Each of the following is one escape, whatever happens to its result:
   - a call whose callee is the identifier `require` (by spelling, with no scope analysis), or a dynamic `import(…)` call, whose first argument is the specifier `'@clensy/web'`;
   - an import-equals declaration `import X = require('@clensy/web')`;
   - a `require(…)` or dynamic `import(…)` call whose first argument is missing or is not a literal specifier. The guard cannot tell what such a call loads.

   A "literal specifier" is a string literal, or a template literal with no substitutions. These forms can destructure or alias the provider under any name, so the load itself is the escape. Load calls whose specifier is a deep or `packages/web` path are boundary violations instead (see **Package boundary**), not escapes.

An identifier is an "occurrence" by spelling. Property names (`obj.P`), property-assignment keys (`{ P: 1 }`), and JSX attribute names (`<X P="…" />`) are not identifier references and are not counted. The guard does **no scope analysis**: a local declaration that shadows a collected binding name is still counted. That false positive is intended, because the guard fails closed.

*(#124)* These declaration-name positions are also names, not identifier references, and are not counted:
- the name of a property or method signature in an interface or type literal (`interface I { P: string }`);
- the name of a class property declaration, method, or get/set accessor (`class C { P = 1; P2() {} }`);
- the name of an object-literal method or get/set accessor (`{ P() {} }`);
- an enum member name (`enum E { P }`);
- a label, both on a labeled statement and in `break`/`continue` (`P: for (;;) { break P; }`);
- the right-hand side of a qualified name (`X.P` in a type position);
- a name inside an import type node's qualifier (`import('x').W`, `import('x').A.W`).

Each is exempt only when the identifier is in exactly that name position. Everything else is still counted, and these stay escapes:
- shorthand properties (`{ P }`);
- computed property names (`[P]`);
- parameters, and every other declaration that shadows a binding (the no-scope-analysis rule);
- any value use, such as `const X = W`.

Assertions:

- The set of provider mounts across `apps/web` has exactly **one** member.
- That member is in `components/layout/app-i18n-provider.tsx`. The test MUST fail if the single mount is in any other file, not only if the count is wrong.
- `apps/web` has **zero** provider escapes, in every scanned file, including `components/layout/app-i18n-provider.tsx`.
- *(#120)* `apps/web` has **zero** package boundary violations, in every scanned file.
- *(#120)* `apps/web` has exactly **one** dashboard shell element. It is in `app/app/layout.tsx`, and it is the provider element's direct child under **Layout wiring**.

This check does not depend on formatting, line breaks, or import style.

**Layout wiring.** Parse `app/app/layout.tsx` the same way and assert, syntactically:

- Exactly one JSX element has a tag that is the local name bound by a named import of `AppI18nProvider` from exactly `'../../components/layout/app-i18n-provider'`. Aliases pass.
- That provider element directly wraps exactly one non-whitespace child, and that child is a JSX element whose tag is the local name bound by a named import of `DashboardLayout` from exactly `'../../components/layout/dashboard-layout'`. Aliases pass.
- A tag spelled `AppI18nProvider` or `DashboardLayout` whose binding is imported from any other module, or not imported at all, fails.

**Package boundary** *(added by #120; a new invariant)*. `apps/web` consumes `@clensy/web` only through its public entry point, the bare specifier `'@clensy/web'`. Every module specifier in a scanned file is checked, in each form the parser exposes:

- `import` and `import type` declarations;
- `export … from` declarations, including `export type … from`;
- import-equals declarations `import X = require('…')`;
- calls whose callee is the identifier `require`;
- dynamic `import(…)` calls;
- import type nodes, `import('…')` in a type position.

Only literal specifiers (a string literal, or a template literal with no substitutions) are checked. Non-literal load calls are handled by provider escape item 4.

A specifier is a **package boundary violation** when any of these holds:

1. It is a **deep package specifier**: it starts with `@clensy/web/`. Bare `@clensy/web` is not a violation; it is governed by the provider rules above.
2. It is a **path into `packages/web`**. The specifier's target path is computed with plain path arithmetic, with no module resolution: no file-system lookup, no extension or index probing, and no `package.json` reading. The target is computed only for these specifier kinds:
   - **Relative** (`.`, `..`, or starting `./` or `../`): resolved against the importing file's directory.
   - **Absolute**: taken as is, normalised.
   - **`@/…`**: resolved against the `apps/web` root, mirroring `apps/web/tsconfig.json`'s `paths` entry `"@/*": ["./*"]`.

   The specifier is a violation only if the target is the `packages/web` directory itself (`<repo>/packages/web`) or lies inside it, compared path segment by path segment. So `../my-packages/web`, `../packages/webby` and a file named `packages-web.ts` are not violations. Bare package names other than `@clensy/web/…` are never violations.
3. *(Added by #122.)* It is a **path through a `node_modules/@clensy/web` link**. The target is computed exactly as in item 2: for relative, absolute and `@/` specifiers only, by the same path arithmetic. The specifier is a violation if that target contains the consecutive path segments `node_modules`, `@clensy`, `web`. That covers the `node_modules/@clensy/web` directory itself and anything beneath it, in any `node_modules` directory at any depth.
   - **Whole segments.** Segments are compared whole, never as string prefixes. `node_modules/@clensy/web` and `node_modules/@clensy/web/src` match. `node_modules/@clensy/webkit`, `node_modules/@clensy/web-extra`, `node_modules/@clensy/ui` and `my_node_modules/@clensy/web` do not.
   - **Computed targets only.** `node_modules/@clensy/web` is matched only when it occurs as computed path segments of a relative, absolute or `@/` target. A bare specifier such as `'node_modules/@clensy/web'` has no target under item 2, so it is never matched by this item.
   - **No symlink resolution.** The guard does not know or check that `apps/web/node_modules/@clensy/web` links to `packages/web`. The segment sequence is forbidden as written, with no symlink resolution and no file-system lookup.

   Provider bindings are unchanged. A mount reached through such a path still counts no provider mount, because bindings come only from the exact `'@clensy/web'`; it is caught here as a boundary violation instead. Load calls inherit this item through the specifier forms listed above.

Import type nodes are checked even though they load nothing at runtime: the invariant is about structural access to the package's internals, not about runtime loading. So `type T = import('@clensy/web/src').X` is a violation. What the deep module exports is never inspected; the path alone is forbidden. Each violating specifier is one violation.

**Dashboard shell** *(added by #120; a new invariant)*. Recognition and placement are separate.

- **Recognition.** A JSX opening or self-closing element counts as `DashboardLayout` if its tag name is literally `DashboardLayout`, or its local name comes from a named import whose imported name is `DashboardLayout`, from any module. No module resolution is involved. Closing tags are not counted separately.
- **Placement.** Across all scanned `apps/web` files, exactly one JSX element is recognised as `DashboardLayout`. That element is in `app/app/layout.tsx`, and it is the same element that **Layout wiring** finds as the provider element's direct child.

`DashboardLayout` gets no escape rules: it is an app-owned component, and the regression this invariant prevents is rendering a second shell. The binding-aware **Layout wiring** check above is unchanged.

**Fixtures.** Each bypass this amendment closes MUST have an inline fixture that fails against the pre-amendment guard and passes against the amended one:

- a JavaScript or `.jsx` source mounting the provider, and the file selection accepting and rejecting the right names;
- each escape form in items 1–3 above;
- layout sources with a wrong provider import path, a wrong `DashboardLayout` import path, and aliased imports.

The existing fixture "an import that is never rendered" (`export { ClensyI18nProvider }`) still has zero mounts, and now has one escape.

**Fixtures (#120).** Each bypass the #120 amendment closes MUST have an inline fixture that fails against the #117 guard and passes against the amended one:

- **Boundary:** a deep `@clensy/web/…` specifier in each form (`import`, `import type`, `export … from`, `export type … from`, `import X = require(…)`, `require(…)`, `import(…)`, an import type node, and a no-substitution template literal).
- **Boundary:** a relative path into `packages/web`, an absolute path into `packages/web` built from the repository root at test time (not hard-coded to a machine), and an `@/` path into `packages/web`.
- **Boundary, allowed:** bare `'@clensy/web'`, a relative path that stays inside `apps/web`, the `../my-packages/web` and `../packages/webby` lookalikes, and a `packages-web` file name.
- **Load calls:** `require('@clensy/web')`, `import('@clensy/web')`, `import X = require('@clensy/web')`, and non-literal `require(name)` and `import(name)`.
- **Dashboard shell:** a second `DashboardLayout` element in another file, an aliased `DashboardLayout` import rendered in another file, a second element inside the layout source (a sibling, and a conditional branch), and the real tree.

**Fixtures (#122).** Package boundary item 3 MUST have inline fixtures that fail against the #120 guard and pass against the amended one, plus pinned allowed cases:

- **Violations:** `../../node_modules/@clensy/web`; its `/src` form; a nested `…/some/node_modules/@clensy/web` target and its `/src` form; an `@/node_modules/@clensy/web` target; and a `require(…)` of the symlink path.
- **Allowed:** targets through `node_modules/@clensy/webkit`, `node_modules/@clensy/web-extra`, `node_modules/@clensy/ui` and `my_node_modules/@clensy/web`; and the bare specifier `'node_modules/@clensy/web'`.

**Demonstration (#122).** A before/after probe MUST show that the amendment closes the actual bypass, not just adds fixture coverage:
1. On the #120 guard (`main`), the exact symlink-shaped mount from #122 (`import { ClensyI18nProvider as P } from '../../node_modules/@clensy/web'`, rendered) is **not** reported.
2. With the amendment, that exact target **is** reported as a package boundary violation.
3. The `/src` form is also reported.
4. The lookalike targets are still allowed.

The probe is demonstrative; this section is normative.

**Fixtures (#124).** Each narrowed false positive MUST have an inline fixture that fails against the #122 guard and passes against the amended one. Each "stays an escape" case MUST also be pinned:
- **Newly exempt (0 escapes):**
  - `typeof P.displayName`;
  - `class C implements W.Foo` and `interface I extends W.Foo`;
  - `type T = import('x').W`;
  - each declaration-name position listed above;
  - a mount in a `.mtsx`/`.ctsx` file parsed as TSX, and in a `.mjsx`/`.cjsx` file parsed as JSX (1 mount, 0 escapes).
- **Still escapes (pinned):**
  - `const Q = P.displayName`;
  - `class C extends W.ClensyI18nProvider`;
  - `const X = W`;
  - `{ P }`;
  - `{ [P]: 1 }`;
  - a parameter named like the binding.
- **Characterisation (#122 interaction, already correct, not a red test):** a provider imported through `'../../node_modules/@clensy/web'` and rendered counts **0 mounts and 0 escapes**. It is caught as a package boundary violation instead.

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
- *(#120 amendment.)* §6.1 states the package-boundary invariant, the `DashboardLayout` recognition and placement invariant, provider escape item 4 (package load calls), their assertions, and the fixture requirement. These are precise enough that M4 does not need to invent any rule. The specifier forms, the path-arithmetic rule, literal handling and the lookalike exclusions are all explicit. The amendment changes nothing outside §3's two new terms and §6.1, and adds no production or package change.
- *(#122 amendment.)* §6.1 package boundary item 3 states the `node_modules`, `@clensy`, `web` segment rule, whole-segment matching with pinned lookalikes, that it applies to computed relative, absolute and `@/` targets only (bare specifiers untouched), that symlinks are not resolved, its interaction with provider bindings and load calls, the fixtures and the demonstration. It adds no invariant or assertion. It changes no #117 or #120 acceptance criterion beyond this path-segment case, and adds no production or package change.
- *(#124 amendment.)* §6.1 narrows exactly the five #117-deferred false positives:
  - the named `typeof` qualified-name exemption;
  - namespace type-only heritage, with class `extends` stated as runtime heritage and never exempt;
  - more declaration-name positions, with the shorthand, computed and parameter cases kept;
  - import type qualifiers;
  - the `*tsx`/`*jsx` `ScriptKind` mapping, with the regex unchanged.

  It also adds the #124 fixture list, including the #122 characterisation. It adds no invariant or assertion, changes no other #117/#120/#122 rule, and adds no production change.
- Explicitly defers tenant-sourced overrides (§8) and introduces no `@clensy/web` / `@clensy/ui` API changes (§4.5 item 8).
- Covers each acceptance bullet of #115: one app-level provider that the user menu, admin page and bookings page all render through; one override applying to the user menu, staff table and create-staff form; the regression test updated to check for the single provider; and consistency with the Web i18n spec and the package boundary.
