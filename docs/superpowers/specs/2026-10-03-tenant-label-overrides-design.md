# Tenant-Sourced Role Label Overrides for the App i18n Boundary — Design

| Field | Value |
| --- | --- |
| Status | Draft |
| Date | 2026-10-03 |
| Document kind | Architecture RFC |
| Tracking issue | [#118](https://github.com/rexescario-dev/clensy-platform/issues/118) — deferred from #115 ([single app i18n provider spec](2026-10-02-single-app-i18n-provider-design.md) §8). |
| Depends on (Accepted) | [Single App-Level `ClensyI18nProvider`](2026-10-02-single-app-i18n-provider-design.md) — the app i18n boundary, its one mount in `/app`, and `/login` outside it. This spec **amends** its §4.5 items 5, 6, 8 and 9 (§4.6 here) and fulfils its §8 deferral. Everything else in it stays as written. [Multi-Tenant Architecture](2026-09-23-multi-tenant-architecture-design.md) — tenant context comes only from the authenticated principal, each tenant user belongs to exactly one tenant, there is no tenant switching, and Super Admin has no tenant. This spec **relies upon** it unchanged and adds no tenant lookup. [App Router i18n Architecture (next-intl)](2026-09-13-web-i18n-architecture-design.md) — next-intl's `useLocale()` is `apps/web`'s only locale source. This spec **relies upon** it unchanged. [Reusable-Component `errorMessage` API](2026-09-20-component-error-message-api-design.md) — the provider's `locale` + `overrides` contract. **Relies upon**, unchanged. |
| Related (not a dependency) | [Admin Foundation](2026-08-14-admin-foundation-design.md) — owns `Query.currentAdmin`. This spec adds one nullable field to its `CurrentAdmin` type, and no root operation. |
| Followed by | A separate, future issue for the **write path** (a `TENANT_OWNER` mutation and a settings UI, §8). Not opened by this spec. |
| Governing references | This document. It does not change `ClensyI18nProvider`, `useClensyTranslations`, any message catalog, next-intl configuration, `/login`, or the structural guard rules of the single app i18n provider spec §6.1. |

## 1. Thesis

The app i18n boundary (single app i18n provider spec, §3) takes its application-owned overrides only from `APP_I18N_OVERRIDES`, which is committed as `{}`. Every tenant therefore sees the same labels. A tenant cannot, for example, show the `FINANCE` role as "Billing" to its own staff.

**Decision this document locks:**

- A tenant's role-label overrides are stored on the tenant row.
- The API validates them on every read and returns them as one typed, nullable field on `currentAdmin`, resolved only from the authenticated principal's tenant.
- `AppI18nProvider` layers that field over `APP_I18N_OVERRIDES`. It is the boundary's single runtime override source.

Only the `roles` namespace and only the `en` locale are supported. Values are populated by migration or by operations staff. There is no write path in this spec.

## 2. Scope

**In scope (normative):**

- A nullable `labelOverrides` `jsonb` column on `TenantEntity`, with its accepted stored shape (§4.1).
- A pure read-time validator in `apps/api` `modules/admins` (§4.2).
- A nullable `CurrentAdmin.tenantLabelOverrides` GraphQL field and its two object types (§4.3).
- Selecting that field in `@clensy/client`'s `CurrentAdmin` operation, and regenerating the client types (§4.3).
- One additive export of the existing `deepMerge` from `@clensy/web` (§4.5).
- A pure mapper in `apps/web/lib` and the change to `AppI18nProvider` that composes the tenant layer (§4.4, §4.5).
- Amending invariants 5, 6, 8 and 9 of the single app i18n provider spec §4.5 (§4.6).
- The tests in §6.

**Informative:**

- `Query.currentAdmin` is already fetched by the user menu, the sidebar, the `/app` landing page and the admin page. The admin page and the landing page use `fetchPolicy: 'network-only'`.
- Logout (`components/layout/user-menu.tsx`) and login (`app/login/page.tsx`) already call `apolloClient.clearStore()`.
- The admin page renders `StaffDataTable` and `CreateStaffForm` only after its `currentAdmin` query resolves.

**Out of scope:**

- Any write path: no mutation, settings UI, audit event, or clearing semantics (§8).
- Any namespace other than `roles`, and any locale other than `en`.
- A locale argument on the new field, or any other way for a request to name a locale (§8).
- A tenants GraphQL API, or any lookup by tenant id.
- Per-user overrides.
- Changes to `/login`, next-intl, `ClensyI18nProvider`, `useClensyTranslations`, or any message catalog.
- Any change to the structural guard rules of the single app i18n provider spec §6.1.

## 3. Terminology

- **Tenant label overrides**: the role-label values one tenant has stored for its own staff, after read-time validation.
- **Accepted stored shape**: the only `labelOverrides` value structure the API interprets: `{ "en": { "roles": { <Role>: <string> } } }` (§4.1). Anything outside it is ignored.
- **Relabelable role**: a `Role` value a tenant may override. It is every `Role` value except `SUPER_ADMIN` (§4.2).
- **Tenant layer**: the `DeepPartial<ClensyMessages>` value that `AppI18nProvider` builds from `currentAdmin.tenantLabelOverrides` (§4.4).
- **Static app layer**: `APP_I18N_OVERRIDES`, unchanged from the single app i18n provider spec §4.1.
- **Session-ending path**: any code path that ends an authenticated session in the browser, or starts a new one in its place. Today these are logout in the user menu and login on `/login`.

Reuses **app i18n boundary**, **provider**, **provider mount** and **application-owned override** as defined in the single app i18n provider spec §3.

## 4. Architecture & contracts

### 4.1 Storage (`apps/api`)

- `TenantEntity` gains `labelOverrides`, a PostgreSQL `jsonb` column that allows `NULL`. A migration adds the column and writes no data.
- The **accepted stored shape** is exactly:

  ```json
  { "en": { "roles": { "FINANCE": "Billing" } } }
  ```

  That is, `en` → `roles` → a relabelable role → a string.
- Operations staff populate the column directly. This spec adds no API, seed or UI that writes it.
- The application MUST NOT trust the column. Because it is `jsonb`, it can hold any valid JSON value, including a scalar, an array, unknown locales or namespaces, or wrong value types. Every read passes through the validator (§4.2).
- `TenantEntity` remains internal to `modules/admins`. There is still no tenants GraphQL API.

### 4.2 Read-time validator (`apps/api`, `modules/admins`)

A pure domain function takes the raw column value and the tenant id. It returns either the valid role labels or "none", and it logs each value it drops.

**Relabelable roles.** The allowlist is derived from the `Role` enum by removing `SUPER_ADMIN`. The six role names MUST NOT be written out a second time in the validation logic. `SUPER_ADMIN` is excluded because it is a platform identity, not tenant staff (multi-tenant spec §4.1), so tenant-owned data MUST NOT be able to relabel it.

**Leaf rule.** A value at `en.roles.<key>` is kept only if all of the following hold:

1. `<key>` is a relabelable role.
2. The value is a string.
3. After trimming leading and trailing whitespace, its length is 1–64 **Unicode code points**. JavaScript UTF-16 code units are not the measure: a character outside the Basic Multilingual Plane counts as 1.
4. The trimmed value contains no control characters, including `\r` and `\n`.

A kept value is returned **trimmed**.

**Everything else is dropped.** This covers:

- a top level that is not an object, or an `en` or `roles` value that is not an object;
- any top-level key other than `en`;
- any key under `en` other than `roles`;
- any key under `roles` that is not a relabelable role, including `SUPER_ADMIN`;
- any leaf that fails the leaf rule.

Arbitrary keys MUST NOT be preserved just because the column is `jsonb`.

**Result.** If at least one leaf is kept, the result is the kept role labels. If none is kept, or the column is `NULL`, the result is "none".

**Logging.** Each drop is logged at warning level with the tenant id, the key path (e.g. `en.roles.FINANCE`) and a reason (e.g. `unknown-key`, `not-a-string`, `too-long`). The log MUST NOT contain the stored value.

**Failure isolation.** A dropped value never makes the `currentAdmin` query fail. The affected key falls back to the package default on the client (§4.5).

### 4.3 GraphQL contract (`apps/api`, `@clensy/client`)

`CurrentAdmin` gains one nullable field:

```graphql
type CurrentAdmin {
  # existing: id, role, scope, tenantId
  tenantLabelOverrides: TenantLabelOverrides
}

type TenantLabelOverrides {
  locale: String!
  roles: RoleLabelOverrides!
}

type RoleLabelOverrides {
  TENANT_OWNER: String
  OPS_MANAGER: String
  SCHEDULER: String
  CUSTOMER_SUPPORT: String
  FINANCE: String
  ANALYST: String
}
```

Resolution rules:

- **Principal only.** The field takes no arguments. It is resolved from the authenticated principal's `tenantId` and from nothing else. No request input can select another tenant.
- **Platform scope.** For `scope = PLATFORM`, the field is `null`: a Super Admin has no tenant-owned override context.
- **Tenant scope.** The field is `null` when the validator returns "none". Otherwise it is `{ locale: "en", roles }`, where each relabelable role is its kept, trimmed value or `null`. A tenant whose stored values are all invalid or unset is intentionally indistinguishable from one with no overrides. The dropped values are visible only in the server log.
- **Locale.** `locale` is always `"en"`, the only supported locale. The field does not take or infer a request locale (§8).
- **Field set.** `RoleLabelOverrides` MUST have exactly one field per relabelable role. Code-first NestJS needs these fields declared explicitly, so a test asserts that the two sets are equal (§6.1).
- **No root operation.** No query or mutation is added, so the root-operation inventory (`apps/api/test/helpers/root-operation-inventory.ts`) does not change.

`@clensy/client`'s `CurrentAdmin` operation (`packages/client/src/operations/current-admin.graphql`) selects `tenantLabelOverrides { locale roles { …every field… } }`, and the generated types and hooks are regenerated.

### 4.4 Mapper (`apps/web/lib`)

A pure function, conceptually `tenantLabelOverrides(currentAdmin, locale): DeepPartial<ClensyMessages>`:

- It returns `{}` when `currentAdmin` is absent or `currentAdmin.tenantLabelOverrides` is `null`.
- It returns `{}` when `tenantLabelOverrides.locale` is not equal to the `locale` argument, which is next-intl's `useLocale()`. This is the client-side half of the rule that an override never applies to a different locale's catalog.
- Otherwise it returns `{ roles: { … } }`, containing only the non-`null` role entries. A `null` MUST NOT be forwarded, because `deepMerge` would replace the package default with `null`.
- It does **not** revalidate values. The API is authoritative for validation; the mapper only maps.

### 4.5 `AppI18nProvider` (`apps/web`) and the `deepMerge` export (`@clensy/web`)

- `@clensy/web` adds one export from its index: the existing `deepMerge` from `i18n/deep-merge.ts`. Its behavior does not change. `apps/web` MUST import it and MUST NOT reimplement merge semantics.
- `AppI18nProvider` stays a `'use client'` component whose only input is `children`. It:
  1. reads the locale with `useLocale()`, unchanged;
  2. reads `currentAdmin` with `useCurrentAdminQuery()` from `@clensy/client`, sharing the existing Apollo cache entry;
  3. builds the tenant layer with the mapper (§4.4);
  4. passes `overrides={deepMerge(APP_I18N_OVERRIDES, tenantLayer)}` to the provider, memoized on `[currentAdmin.tenantLabelOverrides, locale]`. A stable reference keeps the provider's own `useMemo` from recomputing on unrelated re-renders.
- **Precedence:** tenant layer > static app layer > package default.
- **Loading, error, `null`.** While `currentAdmin` is loading, has errored, or carries `tenantLabelOverrides: null`, the tenant layer is `{}`. The effective messages are then the same as before this spec. `AppI18nProvider` MAY render its children while `currentAdmin` is loading, and it MUST NOT block rendering of `/app` on that query.
- **Observed consequence, not a provider property.** Today no role label visibly changes from a default to a tenant value. This follows from how the existing consumers already behave: the user menu shows a skeleton until `currentAdmin` resolves, the admin page renders the staff table and form only after its own `currentAdmin` query resolves, and the bookings page shows no role labels. A future consumer that renders role labels before `currentAdmin` resolves may briefly show the default. This spec does not forbid that.
- **Session isolation.**
  - Every session-ending path MUST call `apolloClient.clearStore()` before it navigates. Both current paths already do.
  - `/login` is outside `/app`, so the boundary unmounts between sessions, and the next `/app` mount reads a fresh `currentAdmin`.
  - An expired or invalid session makes `currentAdmin` fail, so the tenant layer is `{}`.
  - The provider keeps no tenant state of its own. The effective overrides are derived only from the current query result.

### 4.6 Amendments to the single app i18n provider spec §4.5

These replace the named items. All other items (1–4, 7) are unchanged.

- **Item 5 (replaced):** Application-owned override values MUST enter the `/app` tree only through `AppI18nProvider`. It composes them from exactly two sources: the static app layer `APP_I18N_OVERRIDES` and the runtime `currentAdmin.tenantLabelOverrides`. `AppI18nProvider` MUST be the only application-owned provider mount.
- **Item 6 (replaced):** `APP_I18N_OVERRIDES` MUST be typed `DeepPartial<ClensyMessages>` and MUST be committed as `{}`. It is the static app layer, not the only override source.
- **Item 8 (replaced):** `@clensy/ui` is untouched. `@clensy/web`'s only change is the additive `deepMerge` export (§4.5). No other package API changes.
- **Item 9 (replaced):** `AppI18nProvider` MUST NOT accept or forward an override value from props, context, environment variables, browser storage, session state, or any API data other than `currentAdmin.tenantLabelOverrides`, read through `@clensy/client`'s `useCurrentAdminQuery()`.

The same section's §4.1 sentence "No runtime, build-time, or environment-dependent selection of override values is allowed, in this module or anywhere else" is narrowed accordingly. It still holds for the `APP_I18N_OVERRIDES` module. The one allowed runtime source is the one in amended item 9. Its §8 deferral is fulfilled by this spec, and its "Followed by" row points here.

### 4.7 Invariants

1. Tenant label overrides MUST be resolved only from the authenticated principal's `tenantId`. The field MUST take no arguments, and no other code path MAY read another tenant's `labelOverrides`.
2. A `PLATFORM`-scope principal MUST receive `tenantLabelOverrides: null`.
3. Every read of `labelOverrides` MUST pass through the validator (§4.2). No unvalidated value MAY reach a GraphQL response.
4. Only `en` → `roles` → relabelable role → bounded string is interpreted. Everything else MUST be dropped, not preserved.
5. The relabelable roles MUST be derived from `Role` minus `SUPER_ADMIN`, and `RoleLabelOverrides`' fields MUST equal that set.
6. Drop logs MUST NOT contain the stored value.
7. The web MUST apply the tenant layer only when its `locale` equals next-intl's locale, and MUST never forward `null` role values.
8. Precedence MUST be tenant layer > static app layer > package default, composed with `@clensy/web`'s `deepMerge`.
9. Every session-ending path MUST call `apolloClient.clearStore()`.
10. The amended single app i18n provider spec §4.5 (§4.6 here) holds. In particular, there is still exactly one provider mount, and `/login` stays outside the boundary.

## 5. Rationale

**Why a field on `currentAdmin` rather than a separate query?** `currentAdmin` is already the principal-scoped identity query. It is cached once, already fetched by every consumer that shows a role label, and already cleared at login and logout. A separate query would add a second request and a second loading state, and the boundary would then need its own synchronization policy to avoid labels changing on screen.

**Why typed and allowlisted rather than a JSON scalar over the whole catalog?** `apps/api` depends on no `@clensy/*` package, and the catalog lives in `@clensy/web`, which is a React package. Validating arbitrary catalog paths on the server would need a new dependency direction, or a package restructure to move the catalog shape somewhere React-free. It would also need placeholder-preservation rules for messages like `staff`'s `{email}`. A typed, roles-only contract lets the API own validation now. Making each new namespace an explicit contract decision is intentional.

**Why validate on read when the data is ops-seeded?** Ops-seeded does not mean trusted. A `jsonb` column accepts any valid JSON, and `deepMerge` copies whatever it receives. An object where a string belongs, or a 2,000-character label, would reach the UI unchecked. Dropping a single bad value, rather than failing the query, keeps one bad row from breaking sign-in for a tenant.

**Why code points for the 64 limit?** It is a limit on a user-visible label. Counting UTF-16 code units would let a label in a script outside the Basic Multilingual Plane hit the limit at half the visible length.

**Why locale-keyed storage when only `en` exists?** It costs one level of nesting. It means a future second locale needs no reshape of stored data, and an English override can never be applied to a different catalog. The `locale` field in the response lets the client enforce the same rule on its side.

**Why export `deepMerge` instead of merging locally?** `deepMerge` already defines how overrides combine with defaults. A second implementation in `apps/web` could drift from it, for example on `null`, arrays or nested objects. The mapper already removes `null`, so no tenant-specific merge semantics are needed.

**Why `clearStore()` as the isolation mechanism?** The multi-tenant RFC forbids tenant switching, so a different tenant can appear in the same browser only after a session-ending path. Both current paths already clear the Apollo store, and `/login` unmounts the boundary. Making that a MUST, with a regression guard, protects it without adding cache machinery.

## 6. Testing

### 6.1 API

- **Validator unit tests** (pure function):
  - a valid leaf is kept and returned trimmed;
  - a label of exactly 64 code points passes and one of 65 fails;
  - a non-BMP character counts as one code point;
  - blank and whitespace-only values are dropped;
  - values containing `\n`, `\r` or other control characters are dropped;
  - non-string values are dropped;
  - unknown role keys and `SUPER_ADMIN` are dropped;
  - unknown namespaces and non-`en` locales are dropped;
  - a non-object at the top level, at `en` and at `roles` is dropped;
  - an all-invalid input and a `NULL` input both return "none";
  - each drop is logged with tenant id, path and reason, and the log output does not contain the dropped value.
- **Drift tests:**
  - the derived relabelable-role set equals `Role` minus `SUPER_ADMIN`;
  - `RoleLabelOverrides`' declared field set equals the relabelable-role set.
- **Resolver / e2e:**
  - Two tenants with different stored overrides each receive only their own through `currentAdmin`. The existing two-tenant release-gate setup is the natural home for this.
  - A Super Admin receives `null`.
  - A tenant whose column is `NULL` receives `null`.
  - A tenant whose column holds a **structurally malformed JSONB** value with no valid leaf (a scalar, an array, only an unknown locale, or only wrong value types) receives `null`.
  - A tenant whose value mixes valid and invalid leaves receives only the valid ones.
  - In every case above, the query succeeds.
  - Schema introspection shows that `CurrentAdmin.tenantLabelOverrides` takes no arguments.
  - The root-operation inventory is unchanged.
- **Migration:** adds only the nullable column and writes no data.

### 6.2 Web

- **Mapper unit tests:**
  - absent `currentAdmin` → `{}`; `tenantLabelOverrides: null` → `{}`;
  - a `locale` that does not match → `{}`;
  - `null` role entries are omitted;
  - a mix of set and unset roles maps to exactly the set ones.
- **Boundary behavioral test** (extending `apps/web/lib/app-i18n-boundary.test.tsx`). The mocked `useCurrentAdminQuery` returns `tenantLabelOverrides: { locale: 'en', roles: { FINANCE: 'Billing', … others null } }`.
  - "Billing" appears in `UserMenu`, `StaffDataTable` and `CreateStaffForm`.
  - The package default for `FINANCE` appears in none of them.
  - Sibling roles keep their package defaults.
  - With a mocked `APP_I18N_OVERRIDES` also setting `FINANCE`, the tenant value wins.
  - With `tenantLabelOverrides: null`, the package defaults render.
- **Isolation test:** render the boundary with tenant A's `currentAdmin`, then re-render with tenant B's, then with `null`. No label from A appears after the switch. This proves the provider keeps no tenant state of its own.
- **Structural guard** (`apps/web/lib/web-shell-regressions.test.ts`):
  - the single app i18n provider spec §6.1 assertions (one mount, zero escapes, layout wiring) are unchanged and still pass;
  - a source assertion that both session-ending paths (`components/layout/user-menu.tsx`, `app/login/page.tsx`) call `clearStore()`;
  - `AppI18nProvider` still accepts only `children`.
- **Package:** a test that `@clensy/web`'s index exports `deepMerge`. Its behavior tests already exist and are unchanged.

### 6.3 Unchanged

`@clensy/web` message catalogs and their tests, the `/login` tests, and `tenant-role-regressions.test.ts` are untouched. The existing suites, type-check and lint must still pass across the workspace.

## 7. Non-goals

- A write path of any kind, including a mutation, settings UI, audit, or clearing semantics. These MUST NOT enter this work just because the data is ops-seeded.
- Namespaces other than `roles`, locales other than `en`, or a locale argument.
- A tenants API, a lookup by tenant id, or per-user overrides.
- Blocking `/app` rendering until overrides load.
- Client-side revalidation of API values.
- Any change to `/login`, next-intl, `ClensyI18nProvider`, message catalogs, or the §6.1 guard rules.

## 8. Follow-ons (explicit deferrals)

- **Write path.** A `TENANT_OWNER` mutation and a settings UI need their own issue and spec. They must decide authorization, form behavior, clearing semantics and audit behavior, and they MUST reuse this spec's validator and accepted stored shape.
- **Further namespaces.** Each is a new API contract decision with its own validation rules. For example, a `staff` namespace would need placeholder preservation for messages like `{email}`.
- **Locale negotiation.** How a request conveys its locale, and how the API selects among stored locales, is decided when a second locale is added. This spec does not invent a locale argument.

## 9. Acceptance criteria (for this specification)

- Names one storage location, one accepted stored shape, one validator with exact leaf rules (trimming, code-point length, control characters), and one GraphQL field with its null cases (§4.1–§4.3). These are precise enough that M4 does not need to invent any of them.
- States that the field resolves only from the principal's tenant, takes no arguments, and returns `null` for Super Admin (§4.3, §4.7 items 1–2).
- Derives the relabelable roles from `Role` minus `SUPER_ADMIN`, with drift tests (§4.2, §6.1).
- Defines the web mapper, the precedence, the loading and failure fallback, and session isolation. It states that "no flicker" is a consequence of how consumers behave, not a property of the provider (§4.4, §4.5).
- Explicitly replaces items 5, 6, 8 and 9 of the single app i18n provider spec §4.5, narrows its §4.1 runtime-selection sentence, and keeps the one-mount boundary and `/login` outside it (§4.6).
- Defines API, web and structural tests that prove tenant isolation, validation and the boundary (§6).
- Keeps the write path, further namespaces and locale negotiation out of scope with explicit deferrals (§7, §8).
- Covers #118's acceptance bullets: one tenant override applies everywhere the label is read (user menu, staff table, create-staff form) and never leaks to another tenant. It also covers the issue's four decisions: data source, loading and fallback, validation, and cache invalidation.
