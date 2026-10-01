# Tenant-Aware Application Shell — Implementation Plan

| Field | Value |
| --- | --- |
| **Status** | Accepted |
| **Kind** | Implementation plan (M4) for **one** delivery slice |
| **Date** | 2026-10-01 |
| **Tracking** | GitHub [#89](https://github.com/rexescario-dev/clensy-platform/issues/89) (program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81); depends on [#88](https://github.com/rexescario-dev/clensy-platform/issues/88), merged). One PR for this plan (to be Accepted at M5) + implementation (process §2.8). Branch `feat/89-tenant-aware-app-shell`. |
| **Package / repo** | `clensy-platform` — `packages/web` (`@clensy/web`) and `apps/web` only. **No** `apps/api`, `packages/client`, `packages/ui` changes. |
| **Depends on (Accepted)** | [Multi-Tenant Architecture](../specs/2026-09-23-multi-tenant-architecture-design.md) (Accepted, M3 2026-09-23) — §3 terminology (scope is explicit), §4.1 (`currentAdmin { id role scope tenantId }`; clients branch on `scope`, never `tenantId`), §4.2 (Super Admin is denied every tenant business resolver; UI visibility is not authorization), §4.3 (roles), §4.8 (presentation boundary; shell/nav MAY reflect scope/role for UX), §5.13 (navigation and middleware are not the security boundary), §10 (deferral: "Shell/nav item visibility per role (UX follow-on; not a security control)" — this slice is that follow-on). **Where this plan and that specification disagree, the specification wins** — stop and return to M2/M3. Relies on the shipped [#88 plan](2026-10-01-tenant-staff-administration-ui-plan.md) (`@clensy/web` `staff` namespace, `StaffDataTable`, `CreateStaffForm`, decision 3: "#89 may consolidate role presentation onto `@clensy/web`"), [Web Shell and Design System](../specs/2026-09-10-web-shell-and-design-system-design.md) (shell is not an authorization boundary), [`@clensy/ui` Shared UI System](../specs/2026-09-16-shadcn-ui-boundary-design.md), [Web i18n Architecture](../specs/2026-09-13-web-i18n-architecture-design.md) and [LoginForm self-translating](../specs/2026-09-20-login-form-self-translating-design.md) (components own copy through `@clensy/web` i18n). |

> **For agentic workers:** **M5 Accepted 2026-10-01** (developer review, after the two pre-M5 revisions below). Tracking [#89](https://github.com/rexescario-dev/clensy-platform/issues/89). Execution method: **Native**, inline (superpowers:executing-plans) in the developer's session, chosen at M5, with one independent whole-branch review as the final gate. The Accept is plan acceptance only, not merge, push or deploy authorization. If implementation reveals a contract mismatch with #88 or the RFC, stop and report rather than altering the plan. Execute tasks in order with TDD as written. Steps use checkbox (`- [ ]`) syntax. Each task ends green on its package's `test`, `exec tsc --noEmit` and `lint` (the exact commands are in each task's last Run step) before the next starts; `build` runs only in Task 5. Do not invent product semantics; stop and report on any need for a design or scope change. No push or PR as a side effect.
>
> **Pre-M5 review revision (2026-10-01):** returned for two small test/verification refinements; no design or scope change.
> 1. Task 1 gains an explicit consumer audit (new Step 4) before `staff.roles` is deleted. The planning-time result is recorded there, and the audit is re-run as a gate.
> 2. Task 3's sidebar regression test now asserts that **both** `<SidebarNavigation>` usages (desktop `<nav>` and mobile `Sheet`) receive `groups={groups}`, so neither variant can bypass the filter.
>
> **Second pre-M5 review revision (2026-10-01):** returned for small corrections; no design redirect.
> 1. Task 1 makes the #88 → #89 role contract explicit. `STAFF_ROLE_OPTIONS` / `StaffRole` must already be exactly the six tenant roles (verified at planning time). The contract test asserts this directly, and the implementer stops rather than filtering `OWNER` inside `ADMIN_ROLES`.
> 2. Task 1's consumer audit uses focused searches. The planning-time inventory plus TypeScript and test failures are the authoritative consumer check; `grep` only supplements it.
> 3. Task 2 states what its matrix test guarantees: it pins decision 2, not the live API constants (the drift check stays deferred).
> 4. The `/app` landing comment no longer says "a destination it can use", which could read as authorization.
> 5. `accountIdentity` fails closed on an unknown scope: no scope line, rather than defaulting to "Organization account".
> 6. Task 5's boundary checks exit non-zero on a violation. The manual pass records why the inconsistent-principal cases are covered by pure tests only (the database forbids seeding them).

**Goal:** Make the application shell reflect the principal's scope and role — Super Admin gets a minimal platform shell, tenant users see only the nav items their role can read, `/app` lands every user on a destination they can use, and role/menu copy has one translated home — without the shell becoming an authorization boundary.

**Architecture:** `apps/web/lib/nav-groups.ts` gains a `viewRoles` list per nav item (a UX copy of the named API `VIEW_ROLES` constant) and one pure `visibleNavGroups(principal)` function; `landingHref(principal)` is derived from it, so the sidebar and the `/app` redirect cannot drift. A new presentation-only `/app/platform` page is Super Admin's landing. Role labels move to a new `@clensy/web` `roles` namespace (all seven roles) with fixed `ROLE_INITIALS`, consumed by the staff components and by the shell user menu; `apps/web/lib/role-presentation.ts` is deleted. The user menu's own copy and a scope line move into the existing apps/web `nav` next-intl namespace.

**Tech Stack:** React 19, Next 16 App Router (client pages/components), Apollo Client 3.14 (`useCurrentAdminQuery`), next-intl (apps/web), `@clensy/web` i18n context, `@clensy/ui` primitives, Vitest (node environment, `renderToStaticMarkup`, source-level regression tests), pnpm + turbo.

**Spec:** `docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md`

## Slice decisions (brainstorm, 2026-10-01 — developer-approved)

These are planning decisions recorded for this slice; they add no product semantics beyond the RFC.

1. **Scope: option C — scope + per-role nav + consolidation.** UI-only. No API / GraphQL / `@clensy/ui` changes, no tenant name (the API exposes none), no tenant switching or platform control plane (RFC §10).
2. **Visibility matrix.** Mirrors each destination's API read gate exactly:

   | Nav item (href) | Mirrors API constant | Visible to |
   | --- | --- | --- |
   | Bookings `/app/bookings` | `apps/api/src/modules/bookings/presentation/graphql/booking.dto.ts` `VIEW_ROLES` | all six tenant roles |
   | Jobs `/app/jobs` | `apps/api/src/modules/jobs/presentation/graphql/cleaning-job.type.ts` `VIEW_ROLES` | all six tenant roles |
   | Laundry `/app/laundry` | `apps/api/src/modules/laundry/presentation/graphql/laundry-order.type.ts` `VIEW_ROLES` | all six tenant roles |
   | Invoices `/app/billing` | `apps/api/src/modules/billing/presentation/graphql/invoice.type.ts` `VIEW_ROLES` | all six tenant roles |
   | Customers `/app/customers` | `apps/api/src/modules/customers/presentation/graphql/customer.type.ts` `VIEW_ROLES` | all except `FINANCE` |
   | Cleaners `/app/cleaners` | `apps/api/src/modules/cleaners/presentation/graphql/cleaner.type.ts` `VIEW_ROLES` | `TENANT_OWNER`, `OPS_MANAGER`, `SCHEDULER`, `ANALYST` |
   | Teams `/app/cleaners/teams` | `apps/api/src/modules/cleaners/presentation/graphql/team.type.ts` `VIEW_ROLES` | `TENANT_OWNER`, `OPS_MANAGER`, `SCHEDULER`, `ANALYST` |
   | Services `/app/catalog` | `apps/api/src/modules/catalog/presentation/graphql/service.type.ts` `VIEW_ROLES` | all six tenant roles |
   | Add-ons `/app/catalog/add-ons` | same `service.type.ts` `VIEW_ROLES` (imported by `add-on-read.resolver.ts`) | all six tenant roles |
   | Staff `/app/admin` | `apps/api/src/modules/admins/presentation/graphql/admin.resolver.ts` `@Roles(Role.TENANT_OWNER)` on `admins` | `TENANT_OWNER` only |

   Per role: `TENANT_OWNER` all; `OPS_MANAGER` / `SCHEDULER` / `ANALYST` all except Staff; `CUSTOMER_SUPPORT` all except Cleaners, Teams, Staff; `FINANCE` all except Customers, Cleaners, Teams, Staff. `SUPER_ADMIN` (platform scope): no tenant nav groups.
3. **One web-side map, on the nav items.** Each `NAV_GROUPS` item declares `viewRoles`, with a comment naming the exact API constant it mirrors. It is a presentation copy; the API remains the authorization source of truth. No cross-app drift test (deferred unless drift recurs) and no API-provided nav (would break UI-only).
4. **One visibility function.** `visibleNavGroups(principal)` feeds both the sidebar and `landingHref(principal)`. Branches on `scope` first (RFC §3/§4.1): `PLATFORM` → no groups; `TENANT` → items whose `viewRoles` include the role, empty groups dropped, nav order preserved; no principal → no groups.
5. **Landing.** `/app` resolves `currentAdmin`, then: session error / no principal → `/login` (same rule as the admin page); `PLATFORM` → `/app/platform`; `TENANT` → the first visible item in nav order. Consequence of the current order: every tenant role lands on `/app/bookings` (previously everyone was sent to `/app/customers`, which Finance cannot read).
6. **Super Admin placeholder.** New `/app/platform` page: a `PageHeader` with a neutral "not available yet" message, presentation only, **no API calls**. It is not linked from the nav and not route-guarded.
7. **Role labels: one home.** New `@clensy/web` `roles` namespace with all seven roles (including `SUPER_ADMIN: 'Super Admin'`). `StaffDataTable` and `CreateStaffForm` read it; `staff.roles` is deleted; `apps/web/lib/role-presentation.ts` and its test are deleted (only consumer: `user-menu.tsx`, verified at planning time). `StaffDataTable` keeps rendering a non-tenant role (e.g. `SUPER_ADMIN`) as its raw identifier.
8. **Initials stay fixed.** `ROLE_INITIALS` (`AN`, `CS`, `FI`, `OM`, `SC`, `SA`, `TO` — today's values) lives beside the role identifiers in `@clensy/web`; never derived from translated labels.
9. **User menu copy.** Theme / Light / Dark / System, Sign out / Logging out…, the logout error, and the menu's accessible labels move to apps/web's existing `nav` namespace under `userMenu` (no new namespace, so the v1 namespace-set test is unchanged). Role labels come from `@clensy/web` `roles` through `ClensyI18nProvider`, as the bookings and admin pages do.
10. **Scope line.** Under the role label: "Platform account" when `scope === 'PLATFORM'`, "Organization account" when `scope === 'TENANT'`. Driven by `scope`, never by role or `tenantId`.
11. **Typed-URL guards deferred.** No route-level role guard in this slice. A Finance user who types `/app/customers` still sees that page's existing API-error state — an acknowledged UX limitation, recorded as a follow-up (see Explicit deferrals). The landing page and platform page copy also live in `nav` (`landing`, `platform`) for the same namespace-set reason as decision 9.

## Global Constraints

- SHALL NOT change `apps/api`, `packages/client`, `packages/ui`, or any GraphQL operation/schema.
- SHALL branch on `currentAdmin.scope`; SHALL NOT infer Super Admin or tenant membership from `tenantId` (RFC §3, §4.1).
- SHALL treat nav visibility, landing redirects and the platform page as UX only; SHALL NOT describe them as authorization in code comments (RFC §4.2, §5.13).
- SHALL keep `viewRoles` identical to decision 2; every item's comment SHALL name the exact API file and constant it mirrors.
- SHALL NOT add a role guard to existing pages (decision 11) or link `/app/platform` from the nav.
- `@clensy/web` SHALL NOT import `@clensy/client`, `@apollo/client`, `next-intl`, or `apps/web` (package README boundary). Role identifiers there are declared locally.
- apps/web shell code SHALL import UI only through `@clensy/ui` (never `apps/web/components/ui/*`, `radix-ui`, `class-variance-authority`).
- English copy (exact): roles — `ANALYST` "Analyst", `CUSTOMER_SUPPORT` "Customer Support", `FINANCE` "Finance", `OPS_MANAGER` "Ops Manager", `SCHEDULER` "Scheduler", `SUPER_ADMIN` "Super Admin", `TENANT_OWNER` "Tenant Owner"; scope — "Platform account", "Organization account"; platform page — title "Platform", description "Platform administration is not available yet."; user menu strings unchanged from today's literals.
- No new apps/web `messages/*.json` namespace; `i18n/messages.test.ts`'s namespace-set expectation (`['common', 'nav', 'validation']`) SHALL stay unchanged.
- Follow `docs/conventions/javascript/README.md` (record-key order, named exports except framework entry files, file name matches primary export); ESLint is the enforcement.
- Tests run in Vitest's node environment (no DOM): pure functions are unit-tested; component wiring is pinned by `renderToStaticMarkup` where it renders without Apollo/router, and by source-level regression tests otherwise (repo precedent: `apps/web/lib/tenant-role-regressions.test.ts`, `web-shell-regressions.test.ts`).

## Review Focus

1. **Platform principal holding a tenant role, or tenant principal holding `SUPER_ADMIN`** (inconsistent data the DB forbids). Expected: scope wins — `PLATFORM` always gets no groups and lands on `/app/platform`; `TENANT` + `SUPER_ADMIN` sees nothing and gets no landing href (the landing page shows its empty message rather than looping). Pinned in Task 2.
2. **`currentAdmin` still loading or errored in the sidebar.** Expected: no nav groups flash (no full tenant nav shown to a Super Admin before the query resolves). Pinned in Task 2 (`visibleNavGroups(undefined)` → `[]`) and Task 3 (sidebar passes the query result straight through).
3. **Expired / invalid session reaching `/app`.** Expected: `/login`, never a redirect loop between `/app` and a forbidden page. Pinned in Task 3 (source-level: landing page routes error/no-principal to `/login`).
4. **Role-label overrides through `ClensyI18nProvider`.** Expected: an app-level `roles` override changes the label everywhere (staff table, create form, user menu) because there is one namespace. Pinned in Task 1 (table and form both honor a `roles` override).
5. **Unknown role string from the API** (e.g. a future role the web build doesn't know). Expected: user menu renders no identity (as today), staff table renders the raw identifier, nav shows nothing. Pinned in Tasks 1, 2 and 4.

---

### Task 1: `@clensy/web` `roles` namespace and role identity contract (RFC §4.3, §4.8; decisions 7, 8)

**Files:**
- Create: `packages/web/src/roles/admin-roles.ts`
- Create: `packages/web/src/roles/admin-roles.test.tsx`
- Create: `packages/web/src/i18n/messages/en/roles.ts`
- Modify: `packages/web/src/i18n/messages.ts`
- Modify: `packages/web/src/i18n/messages/en/staff.ts` (delete `roles`, update header comment)
- Modify: `packages/web/src/staff/staff-data-table.tsx` (`RoleLabel`)
- Modify: `packages/web/src/staff/create-staff-form.tsx` (role `<option>` labels)
- Modify: `packages/web/src/staff/staff-contracts.test.tsx`
- Modify: `packages/web/src/staff/staff-data-table.test.tsx`
- Modify: `packages/web/src/staff/create-staff-form.test.tsx`
- Modify: `packages/web/src/index.ts`

**Interfaces:**
- Consumes: `STAFF_ROLE_OPTIONS`, `StaffRole` from `packages/web/src/staff/staff-roles.ts` (unchanged). **Precondition from #88:** both are exactly the six tenant roles `ANALYST`, `CUSTOMER_SUPPORT`, `FINANCE`, `OPS_MANAGER`, `SCHEDULER`, `TENANT_OWNER`, with no `OWNER` (verified at planning time, `main` @ `f2ed2ad`: `staff-roles.ts:5`). If either still contains `OWNER` or any other role, **stop and report**. Do not filter or redefine roles in #89 (e.g. hiding `OWNER` inside `ADMIN_ROLES`); that would mean #88 did not establish the expected contract.
- Produces (exported from `@clensy/web`): `type AdminRole = StaffRole | 'SUPER_ADMIN'`; `ADMIN_ROLES: readonly AdminRole[]`; `isAdminRole(role: string): role is AdminRole`; `ROLE_INITIALS: Readonly<Record<AdminRole, string>>`; i18n namespace `roles` (`useClensyTranslations('roles')`, key = role identifier). `ClensyMessages` gains `roles`; `staff.roles` no longer exists.

- [ ] **Step 1: Write the failing contract test**

Create `packages/web/src/roles/admin-roles.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ADMIN_ROLES, ROLE_INITIALS, isAdminRole } from './admin-roles';
import { STAFF_ROLE_OPTIONS } from '../staff/staff-roles';
import { ClensyI18nProvider } from '../i18n/i18n-context';
import { getDefaultMessages } from '../i18n/messages';
import { useClensyTranslations } from '../i18n/use-clensy-translations';
import * as publicApi from '../index';

function Resolve({ keys }: { keys: string[] }) {
  const t = useClensyTranslations('roles');
  return <ul>{keys.map((key) => <li key={key} data-key={key}>{t(key)}</li>)}</ul>;
}

function resolvedTexts(keys: string[], overrides?: Parameters<typeof ClensyI18nProvider>[0]['overrides']): string[] {
  const html = renderToStaticMarkup(
    <ClensyI18nProvider overrides={overrides}>
      <Resolve keys={keys} />
    </ClensyI18nProvider>,
  );
  return [...html.matchAll(/<li data-key="[^"]*">([^<]*)<\/li>/g)].map((m) => m[1]);
}

describe('admin role contract', () => {
  // #88 precondition: ADMIN_ROLES is built from STAFF_ROLE_OPTIONS, so pin
  // that list itself rather than letting ADMIN_ROLES mask a stale entry.
  it('builds on exactly the six tenant roles from #88', () => {
    expect([...STAFF_ROLE_OPTIONS].sort()).toEqual(
      ['ANALYST', 'CUSTOMER_SUPPORT', 'FINANCE', 'OPS_MANAGER', 'SCHEDULER', 'TENANT_OWNER'].sort(),
    );
  });

  it('lists exactly the seven AdminUser roles, never the retired OWNER', () => {
    expect([...ADMIN_ROLES].sort()).toEqual(
      ['ANALYST', 'CUSTOMER_SUPPORT', 'FINANCE', 'OPS_MANAGER', 'SCHEDULER', 'SUPER_ADMIN', 'TENANT_OWNER'].sort(),
    );
    expect(ADMIN_ROLES).not.toContain('OWNER');
  });

  it('recognises every AdminUser role and nothing else', () => {
    expect(isAdminRole('SUPER_ADMIN')).toBe(true);
    expect(isAdminRole('FINANCE')).toBe(true);
    expect(isAdminRole('OWNER')).toBe(false);
    expect(isAdminRole('')).toBe(false);
  });

  it('keeps fixed two-letter initials per role, independent of labels', () => {
    expect(ROLE_INITIALS).toEqual({
      ANALYST: 'AN',
      CUSTOMER_SUPPORT: 'CS',
      FINANCE: 'FI',
      OPS_MANAGER: 'OM',
      SCHEDULER: 'SC',
      SUPER_ADMIN: 'SA',
      TENANT_OWNER: 'TO',
    });
    expect(resolvedTexts(['FINANCE'], { roles: { FINANCE: 'Billing' } })).toEqual(['Billing']);
    expect(ROLE_INITIALS.FINANCE).toBe('FI');
  });

  it('exports the role contract from the package entry', () => {
    expect(publicApi.ADMIN_ROLES).toBe(ADMIN_ROLES);
    expect(publicApi.ROLE_INITIALS).toBe(ROLE_INITIALS);
    expect(publicApi.isAdminRole).toBe(isAdminRole);
  });
});

describe('roles namespace', () => {
  it('resolves every AdminUser role to the agreed English label', () => {
    expect(resolvedTexts([...ADMIN_ROLES])).toEqual(
      ADMIN_ROLES.map((role) => ({
        ANALYST: 'Analyst',
        CUSTOMER_SUPPORT: 'Customer Support',
        FINANCE: 'Finance',
        OPS_MANAGER: 'Ops Manager',
        SCHEDULER: 'Scheduler',
        SUPER_ADMIN: 'Super Admin',
        TENANT_OWNER: 'Tenant Owner',
      })[role]),
    );
  });

  it('is the only home of role labels — the staff namespace no longer carries them', () => {
    expect('roles' in getDefaultMessages().staff).toBe(false);
  });
});
```

- [ ] **Step 2: Write the failing staff-component tests**

Append to the `describe('StaffDataTable', …)` block in `packages/web/src/staff/staff-data-table.test.tsx` (add `import { ClensyI18nProvider } from '../i18n/i18n-context';` to the imports):

```tsx
  it('reads role labels from the shared roles namespace', () => {
    const html = renderToStaticMarkup(
      <ClensyI18nProvider overrides={{ roles: { FINANCE: 'Billing', TENANT_OWNER: 'Org Owner' } }}>
        <StaffDataTable staff={[otherOwner, finance]} currentAdminId={me.id} onDisable={() => {}} />
      </ClensyI18nProvider>,
    );
    expect(html).toContain('Billing');
    expect(html).toMatch(/data-slot="badge"[^>]*>Org Owner</);
  });
```

Append to the `describe('CreateStaffForm', …)` block in `packages/web/src/staff/create-staff-form.test.tsx` (add `import { ClensyI18nProvider } from '../i18n/i18n-context';`):

```tsx
  it('reads role option labels from the shared roles namespace', () => {
    const html = renderToStaticMarkup(
      <ClensyI18nProvider overrides={{ roles: { FINANCE: 'Billing' } }}>
        <CreateStaffForm values={base} onChange={() => {}} />
      </ClensyI18nProvider>,
    );
    expect(html).toContain('<option value="FINANCE">Billing</option>');
  });
```

In `packages/web/src/staff/staff-contracts.test.tsx`, replace the whole `describe('staff namespace completeness', …)` block with (role labels are now covered by `admin-roles.test.tsx`):

```tsx
describe('staff namespace completeness', () => {
  it('resolves every role group and error key to real text', () => {
    const keys = [
      ...STAFF_ROLE_GROUPS.map((group) => `roleGroups.${group.id}`),
      ...STAFF_ERROR_KEYS.map((key) => `errors.${key}`),
    ];
    const texts = resolvedTexts(keys);
    expect(texts).toHaveLength(keys.length);
    texts.forEach((text, i) => expect(text).not.toBe(keys[i]));
  });

  it('uses the agreed English labels', () => {
    expect(resolvedTexts(['roleGroups.owner', 'roleGroups.staff', 'errors.lastTenantOwner'])).toEqual([
      'Tenant Owner',
      'Staff',
      "You can&#x27;t disable the last active Tenant Owner. Add another Tenant Owner first.",
    ]);
  });

  it('lets an application override staff copy through ClensyI18nProvider', () => {
    const html = renderToStaticMarkup(
      <ClensyI18nProvider overrides={{ staff: { status: { active: 'Enabled' } } }}>
        <Resolve keys={['status.active']} />
      </ClensyI18nProvider>,
    );
    expect(html).toContain('Enabled');
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `pnpm --filter @clensy/web exec vitest run src/roles src/staff`
Expected: FAIL — `admin-roles.test.tsx` cannot resolve `./admin-roles`; the two new "shared roles namespace" tests fail (labels still come from `staff.roles`, so `Billing` / `Org Owner` are absent).

- [ ] **Step 4: Audit every consumer of the staff-namespace role labels**

**Authoritative check:** the planning-time inventory below, plus TypeScript and test failures. Once `staff.roles` is gone, `tsc` rejects a `staff: { roles: … }` override (`DeepPartial<ClensyMessages>`), and the Task 1 tests fail on any component still resolving labels from `staff`. The searches below supplement that check; they do not replace it.

Planning-time inventory (2026-10-01, `main` @ `f2ed2ad`). Every consumer is handled in this task:

| Consumer | Disposition |
| --- | --- |
| `packages/web/src/staff/create-staff-form.tsx:61` `` t(`roles.${role}`) `` | Migrated in Step 6 to `tRoles(role)` |
| `packages/web/src/staff/staff-data-table.tsx:91` `` t(`roles.${role}`) `` | Migrated in Step 6 (`RoleLabel` reads `roles`) |
| `packages/web/src/i18n/messages/en/staff.ts:42` `roles: {` | Deleted in Step 5 |
| `packages/web/src/staff/staff-contracts.test.tsx:47,57,66-67` | Replaced in Step 2 |
| `packages/web/src/staff/staff-data-table.test.tsx:27,41` `not.toContain('roles.…')` | Unaffected: negative assertions that no raw key path leaks |

No apps/web file passes a `staff.roles` override (the admin page's `ClensyI18nProvider` has no `overrides`).

Supplementary searches (from the repo root):

```bash
grep -rnE "staff\.roles|t\(['\"]roles\.|roles\.\$\{|\`roles\." packages/web/src apps/web \
  --include='*.ts' --include='*.tsx' --include='*.json' --exclude-dir=node_modules --exclude-dir=.next
grep -rnE "staff[[:space:]]*:[[:space:]]*\{[^}]*roles" packages/web/src apps/web \
  --include='*.ts' --include='*.tsx' --exclude-dir=node_modules --exclude-dir=.next
grep -rnE "['\"]roles\.['\"][[:space:]]*\+" packages/web/src apps/web \
  --include='*.ts' --include='*.tsx' --exclude-dir=node_modules --exclude-dir=.next
```

Planning-time output: the first search matches `staff-data-table.tsx:91`, `create-staff-form.tsx:61` and `staff-contracts.test.tsx:47`. The second matches `staff-contracts.test.tsx:66`. The third matches nothing. All of these are in the inventory. If a search or a type/test failure surfaces a consumer not in the inventory, migrate it to `useClensyTranslations('roles')` in this task, or stop and report if that would need a design change. Do not delete `staff.roles` until every consumer is dispositioned.

- [ ] **Step 5: Implement the role contract and namespace**

Create `packages/web/src/roles/admin-roles.ts`:

```ts
import { STAFF_ROLE_OPTIONS, type StaffRole } from '../staff/staff-roles';

// Every AdminUser role (multi-tenant spec §4.3): the six tenant roles plus
// the platform-scope SUPER_ADMIN. Stable identifiers only — display labels
// live in the `roles` i18n namespace. Declared locally (not imported from
// @clensy/client) to keep @clensy/web free of the GraphQL client.
export type AdminRole = StaffRole | 'SUPER_ADMIN';

export const ADMIN_ROLES: readonly AdminRole[] = [...STAFF_ROLE_OPTIONS, 'SUPER_ADMIN'];

// Fixed per role rather than derived from the translated label, so the
// avatar initials stay stable across locales and label overrides.
export const ROLE_INITIALS: Readonly<Record<AdminRole, string>> = {
  ANALYST: 'AN',
  CUSTOMER_SUPPORT: 'CS',
  FINANCE: 'FI',
  OPS_MANAGER: 'OM',
  SCHEDULER: 'SC',
  SUPER_ADMIN: 'SA',
  TENANT_OWNER: 'TO',
};

export function isAdminRole(role: string): role is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}
```

Create `packages/web/src/i18n/messages/en/roles.ts`:

```ts
// Default `en` labels for every AdminUser role. This is the ONLY copy of
// this English text: the staff console (StaffDataTable, CreateStaffForm)
// and the apps/web shell user menu all read it. apps/web may layer partial
// overrides via ClensyI18nProvider.
export const roles = {
  ANALYST: 'Analyst',
  CUSTOMER_SUPPORT: 'Customer Support',
  FINANCE: 'Finance',
  OPS_MANAGER: 'Ops Manager',
  SCHEDULER: 'Scheduler',
  SUPER_ADMIN: 'Super Admin',
  TENANT_OWNER: 'Tenant Owner',
};
```

In `packages/web/src/i18n/messages.ts`, add the import and the namespace:

```ts
import { auth } from './messages/en/auth';
import { bookings } from './messages/en/bookings';
import { roles } from './messages/en/roles';
import { staff } from './messages/en/staff';
```

```ts
export function getDefaultMessages() {
  return { auth, bookings, roles, staff };
}
```

In `packages/web/src/i18n/messages/en/staff.ts`, delete the whole `roles: { … },` entry and replace the header comment with:

```ts
// Default `en` messages for the staff console (StaffDataTable,
// CreateStaffForm and the admin page's own copy). This is the ONLY copy of
// these strings' English text; apps/web may layer partial overrides via
// ClensyI18nProvider. Role labels live in the shared `roles` namespace.
```

- [ ] **Step 6: Point the staff components at the `roles` namespace**

In `packages/web/src/staff/staff-data-table.tsx`, replace `RoleLabel` and its two call sites. `RoleLabel` becomes a component that reads its own namespace:

```tsx
function RoleLabel({ role }: { role: string }) {
  const tRoles = useClensyTranslations('roles');
  if (!isStaffRole(role)) return <>{role}</>;
  const label = tRoles(role);
  // Tenant Owner is the tenant's administrator, not an operational role
  // (spec §3) — shown as a badge so the distinction reads at a glance.
  return role === 'TENANT_OWNER' ? <Badge variant="secondary">{label}</Badge> : <>{label}</>;
}
```

Call sites: in `buildStaffColumns`, `render: (row) => <RoleLabel role={row.role} />`; in `renderMobileRow`, `<RoleLabel role={row.role} />`.

In `packages/web/src/staff/create-staff-form.tsx`, add `const tRoles = useClensyTranslations('roles');` after `const t = useClensyTranslations('staff');` and change the option label from `{t(\`roles.${role}\`)}` to `{tRoles(role)}`.

In `packages/web/src/index.ts`, after the `staff-roles` exports, add:

```ts
export { ADMIN_ROLES, ROLE_INITIALS, isAdminRole } from './roles/admin-roles';
export type { AdminRole } from './roles/admin-roles';
```

- [ ] **Step 7: Run the package gate**

Run: `pnpm --filter @clensy/web test && pnpm --filter @clensy/web exec tsc --noEmit && pnpm --filter @clensy/web lint`
Expected: all PASS (the existing "renders an unknown role identifier raw" test still passes: `SUPER_ADMIN` is not a `StaffRole`).

Re-run the three Step 4 searches. Expected: no output from any of them. The `tsc` and test runs above are the authoritative part of this gate.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src
git commit -m "feat(89): consolidate role labels into a shared @clensy/web roles namespace with fixed initials"
```

---

### Task 2: Scope- and role-aware nav visibility (RFC §3, §4.1, §4.2, §5.13, §10; decisions 2–5)

**Files:**
- Modify: `apps/web/lib/nav-groups.ts`
- Modify: `apps/web/lib/nav-groups.test.ts`

**Interfaces:**
- Consumes: `Role`, `AdminScope` types from `@clensy/client` (type-only).
- Produces: `NavItem { href; labelKey; viewRoles: readonly Role[] }`; `NavPrincipal { role: Role; scope: AdminScope }`; `visibleNavGroups(principal: NavPrincipal | null | undefined): NavGroup[]`; `landingHref(principal: NavPrincipal | null | undefined): string | undefined`; `PLATFORM_HOME_HREF = '/app/platform'`. `NAV_GROUPS` and `findActiveHref` keep their current behavior.

- [ ] **Step 1: Write the failing table-driven test**

Replace `apps/web/lib/nav-groups.test.ts` with:

```ts
import type { AdminScope, Role } from '@clensy/client';
import { describe, expect, it } from 'vitest';
import { NAV_GROUPS, PLATFORM_HOME_HREF, findActiveHref, landingHref, visibleNavGroups } from './nav-groups';

const BOOKINGS = '/app/bookings';
const JOBS = '/app/jobs';
const LAUNDRY = '/app/laundry';
const INVOICES = '/app/billing';
const CUSTOMERS = '/app/customers';
const CLEANERS = '/app/cleaners';
const TEAMS = '/app/cleaners/teams';
const SERVICES = '/app/catalog';
const ADD_ONS = '/app/catalog/add-ons';
const STAFF = '/app/admin';

const ALL_TENANT_HREFS = [BOOKINGS, JOBS, LAUNDRY, INVOICES, CUSTOMERS, CLEANERS, TEAMS, SERVICES, ADD_ONS, STAFF];

// Pins the approved plan decision 2 matrix. It does NOT independently check
// the live API VIEW_ROLES constants named in nav-groups.ts; that cross-app
// drift check is deliberately deferred (plan decision 3).
const VISIBLE_BY_ROLE: Record<Exclude<Role, 'SUPER_ADMIN'>, string[]> = {
  ANALYST: ALL_TENANT_HREFS.filter((href) => href !== STAFF),
  CUSTOMER_SUPPORT: ALL_TENANT_HREFS.filter((href) => ![CLEANERS, TEAMS, STAFF].includes(href)),
  FINANCE: ALL_TENANT_HREFS.filter((href) => ![CUSTOMERS, CLEANERS, TEAMS, STAFF].includes(href)),
  OPS_MANAGER: ALL_TENANT_HREFS.filter((href) => href !== STAFF),
  SCHEDULER: ALL_TENANT_HREFS.filter((href) => href !== STAFF),
  TENANT_OWNER: ALL_TENANT_HREFS,
};

function tenant(role: Role) {
  return { role, scope: 'TENANT' as AdminScope };
}

function visibleHrefs(principal: Parameters<typeof visibleNavGroups>[0]) {
  return visibleNavGroups(principal).flatMap((group) => group.items.map((item) => item.href));
}

describe('findActiveHref', () => {
  it('returns the longest matching navigation prefix', () => {
    expect(findActiveHref('/app/cleaners/teams')).toBe('/app/cleaners/teams');
    expect(findActiveHref('/app/cleaners')).toBe('/app/cleaners');
    expect(findActiveHref('/app/catalog/add-ons')).toBe('/app/catalog/add-ons');
  });

  it('returns undefined outside the app navigation', () => {
    expect(findActiveHref('/login')).toBeUndefined();
    expect(findActiveHref(PLATFORM_HOME_HREF)).toBeUndefined();
  });
});

describe('NAV_GROUPS view roles', () => {
  it('covers every tenant destination, each with at least one tenant role and never SUPER_ADMIN', () => {
    const items = NAV_GROUPS.flatMap((group) => group.items);
    expect(items.map((item) => item.href)).toEqual(ALL_TENANT_HREFS);
    for (const item of items) {
      expect(item.viewRoles.length).toBeGreaterThan(0);
      expect(item.viewRoles).not.toContain('SUPER_ADMIN');
    }
  });
});

describe('visibleNavGroups', () => {
  it.each(Object.entries(VISIBLE_BY_ROLE))('shows %s exactly its readable destinations, in nav order', (role, hrefs) => {
    expect(visibleHrefs(tenant(role as Role))).toEqual(hrefs);
  });

  it('drops a group with no visible items (Finance has no People group)', () => {
    const groups = visibleNavGroups(tenant('FINANCE')).map((group) => group.labelKey);
    expect(groups).toEqual(['groups.operations', 'groups.catalog']);
  });

  it('shows Staff only to the Tenant Owner', () => {
    for (const role of Object.keys(VISIBLE_BY_ROLE) as Role[]) {
      expect(visibleHrefs(tenant(role)).includes(STAFF)).toBe(role === 'TENANT_OWNER');
    }
  });

  it('gives a platform principal no tenant navigation, whatever its role', () => {
    expect(visibleNavGroups({ role: 'SUPER_ADMIN', scope: 'PLATFORM' })).toEqual([]);
    expect(visibleNavGroups({ role: 'TENANT_OWNER', scope: 'PLATFORM' })).toEqual([]);
  });

  it('shows nothing while there is no principal or for a role it does not know', () => {
    expect(visibleNavGroups(undefined)).toEqual([]);
    expect(visibleNavGroups(null)).toEqual([]);
    expect(visibleNavGroups(tenant('SUPER_ADMIN'))).toEqual([]);
    expect(visibleNavGroups({ role: 'OWNER' as unknown as Role, scope: 'TENANT' })).toEqual([]);
  });
});

describe('landingHref', () => {
  it('sends a platform principal to the platform placeholder', () => {
    expect(landingHref({ role: 'SUPER_ADMIN', scope: 'PLATFORM' })).toBe(PLATFORM_HOME_HREF);
    expect(PLATFORM_HOME_HREF).toBe('/app/platform');
  });

  it.each(Object.entries(VISIBLE_BY_ROLE))('sends %s to its first visible destination', (role, hrefs) => {
    expect(landingHref(tenant(role as Role))).toBe(hrefs[0]);
  });

  it('never lands Finance on Customers', () => {
    expect(landingHref(tenant('FINANCE'))).not.toBe(CUSTOMERS);
  });

  it('has no landing for a missing principal or a tenant principal with nothing visible', () => {
    expect(landingHref(undefined)).toBeUndefined();
    expect(landingHref(tenant('SUPER_ADMIN'))).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web exec vitest run lib/nav-groups.test.ts`
Expected: FAIL — `PLATFORM_HOME_HREF`, `visibleNavGroups`, `landingHref` are not exported.

- [ ] **Step 3: Implement visibility**

Replace `apps/web/lib/nav-groups.ts` with:

```ts
import type { AdminScope, Role } from '@clensy/client';

export interface NavItem {
  href: string;
  labelKey: string;
  // UX copy of the destination's API read gate — not authorization
  // (multi-tenant spec §4.2, §5.13). When the named API constant changes,
  // change this list and the matrix in nav-groups.test.ts with it.
  viewRoles: readonly Role[];
}

export interface NavGroup {
  items: NavItem[];
  labelKey: string;
}

export interface NavPrincipal {
  role: Role;
  scope: AdminScope;
}

// Super Admin's landing. Not a nav item: there is no platform navigation
// yet (multi-tenant spec §10 defers the platform control plane).
export const PLATFORM_HOME_HREF = '/app/platform';

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      {
        href: '/app/bookings',
        labelKey: 'items.bookings',
        // apps/api/src/modules/bookings/presentation/graphql/booking.dto.ts VIEW_ROLES
        viewRoles: ['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER', 'CUSTOMER_SUPPORT', 'FINANCE', 'ANALYST'],
      },
      {
        href: '/app/jobs',
        labelKey: 'items.jobs',
        // apps/api/src/modules/jobs/presentation/graphql/cleaning-job.type.ts VIEW_ROLES
        viewRoles: ['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER', 'CUSTOMER_SUPPORT', 'FINANCE', 'ANALYST'],
      },
      {
        href: '/app/laundry',
        labelKey: 'items.laundry',
        // apps/api/src/modules/laundry/presentation/graphql/laundry-order.type.ts VIEW_ROLES
        viewRoles: ['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER', 'CUSTOMER_SUPPORT', 'FINANCE', 'ANALYST'],
      },
      {
        href: '/app/billing',
        labelKey: 'items.invoices',
        // apps/api/src/modules/billing/presentation/graphql/invoice.type.ts VIEW_ROLES
        viewRoles: ['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER', 'CUSTOMER_SUPPORT', 'FINANCE', 'ANALYST'],
      },
    ],
    labelKey: 'groups.operations',
  },
  {
    items: [
      {
        href: '/app/customers',
        labelKey: 'items.customers',
        // apps/api/src/modules/customers/presentation/graphql/customer.type.ts VIEW_ROLES
        viewRoles: ['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER', 'CUSTOMER_SUPPORT', 'ANALYST'],
      },
      {
        href: '/app/cleaners',
        labelKey: 'items.cleaners',
        // apps/api/src/modules/cleaners/presentation/graphql/cleaner.type.ts VIEW_ROLES
        viewRoles: ['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER', 'ANALYST'],
      },
      {
        href: '/app/cleaners/teams',
        labelKey: 'items.teams',
        // apps/api/src/modules/cleaners/presentation/graphql/team.type.ts VIEW_ROLES
        viewRoles: ['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER', 'ANALYST'],
      },
    ],
    labelKey: 'groups.people',
  },
  {
    items: [
      {
        href: '/app/catalog',
        labelKey: 'items.services',
        // apps/api/src/modules/catalog/presentation/graphql/service.type.ts VIEW_ROLES
        viewRoles: ['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER', 'CUSTOMER_SUPPORT', 'FINANCE', 'ANALYST'],
      },
      {
        href: '/app/catalog/add-ons',
        labelKey: 'items.addOns',
        // apps/api/src/modules/catalog/presentation/graphql/service.type.ts VIEW_ROLES
        // (imported by add-on-read.resolver.ts)
        viewRoles: ['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER', 'CUSTOMER_SUPPORT', 'FINANCE', 'ANALYST'],
      },
    ],
    labelKey: 'groups.catalog',
  },
  {
    items: [
      {
        href: '/app/admin',
        labelKey: 'items.staff',
        // apps/api/src/modules/admins/presentation/graphql/admin.resolver.ts
        // @Roles(Role.TENANT_OWNER) on `admins`
        viewRoles: ['TENANT_OWNER'],
      },
    ],
    labelKey: 'groups.administration',
  },
];

const ALL_HREFS = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));

export function findActiveHref(pathname: string): string | undefined {
  return ALL_HREFS.filter(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  ).reduce<string | undefined>(
    (longest, current) =>
      longest === undefined || current.length > longest.length ? current : longest,
    undefined,
  );
}

// The one landing rule, derived from visibleNavGroups so the sidebar and the
// `/app` redirect cannot disagree. UX only (multi-tenant spec §5.13).
export function landingHref(principal: NavPrincipal | null | undefined): string | undefined {
  if (principal?.scope === 'PLATFORM') return PLATFORM_HOME_HREF;
  return visibleNavGroups(principal)[0]?.items[0]?.href;
}

// Scope first, never tenantId (multi-tenant spec §3/§4.1): a platform
// principal gets no tenant navigation, since the API denies Super Admin
// every tenant business operation (§4.2). Hiding an item is UX only.
export function visibleNavGroups(principal: NavPrincipal | null | undefined): NavGroup[] {
  if (principal?.scope !== 'TENANT') return [];
  const { role } = principal;
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.viewRoles.includes(role)),
  })).filter((group) => group.items.length > 0);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run lib/nav-groups.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the package gate**

Run: `pnpm --filter web test && pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/nav-groups.ts apps/web/lib/nav-groups.test.ts
git commit -m "feat(89): add scope- and role-aware nav visibility mirroring API view roles"
```

---

### Task 3: Sidebar, `/app` landing and `/app/platform` placeholder (RFC §4.2, §4.8, §10; decisions 4–6, 11)

**Files:**
- Modify: `apps/web/components/layout/app-sidebar.tsx`
- Modify: `apps/web/app/app/page.tsx`
- Create: `apps/web/app/app/platform/page.tsx`
- Modify: `apps/web/messages/en/nav.json` (add `landing`, `platform`)
- Modify: `apps/web/i18n/messages.test.ts`
- Modify: `apps/web/lib/web-shell-regressions.test.ts`

**Interfaces:**
- Consumes: `visibleNavGroups`, `landingHref`, `NavGroup` from `apps/web/lib/nav-groups.ts` (Task 2); `useCurrentAdminQuery` from `@clensy/client`; `PageHeader` from `@clensy/ui`.
- Produces: route `/app/platform`; `nav.landing.{loading,empty}`, `nav.platform.{title,description}` message keys.

- [ ] **Step 1: Write the failing tests**

Append to `apps/web/i18n/messages.test.ts` (inside the existing `describe('getMessages', …)`):

```ts
  it('carries the landing and platform placeholder copy in nav', () => {
    const { nav } = getMessages();
    expect(nav.landing).toEqual({
      empty: 'No areas are available for your account.',
      loading: 'Loading…',
    });
    expect(nav.platform).toEqual({
      description: 'Platform administration is not available yet.',
      title: 'Platform',
    });
  });
```

Append to `describe('web shell regressions', …)` in `apps/web/lib/web-shell-regressions.test.ts`:

```ts
  // No DOM test environment exists in this repo, so the shell's wiring to the
  // pure visibility rules (lib/nav-groups.test.ts) is pinned at source level.
  it('renders the sidebar from visibleNavGroups(currentAdmin), not the full NAV_GROUPS list', () => {
    const sidebar = readWebSource('components/layout/app-sidebar.tsx');

    expect(sidebar).toContain('useCurrentAdminQuery(');
    expect(sidebar).toContain('visibleNavGroups(data?.currentAdmin)');
    expect(sidebar).not.toContain('NAV_GROUPS');
    // Both variants (desktop <nav> and mobile Sheet) must receive the
    // filtered groups — neither may bypass visibleNavGroups.
    const usages = sidebar.match(/<SidebarNavigation\b[^>]*\/>/g) ?? [];
    expect(usages).toHaveLength(2);
    for (const usage of usages) expect(usage).toContain('groups={groups}');
    expect(sidebar).not.toMatch(/tenantId/);
  });

  it('lands /app through landingHref and sends a missing session to /login', () => {
    const landing = readWebSource('app/app/page.tsx');

    expect(landing).toContain('landingHref(currentAdmin)');
    expect(landing).toContain("'/login'");
    expect(landing).not.toContain('/app/customers');
    expect(landing).not.toMatch(/tenantId/);
  });

  it('keeps the platform placeholder presentational with no API calls', () => {
    const platform = readWebSource('app/app/platform/page.tsx');

    expect(platform).toContain("t('platform.title')");
    expect(platform).not.toContain('@clensy/client');
    expect(platform).not.toContain('@apollo/client');
    expect(platform).not.toContain('fetch(');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run i18n/messages.test.ts lib/web-shell-regressions.test.ts`
Expected: FAIL — `nav.landing`/`nav.platform` undefined; sidebar still maps `NAV_GROUPS`; landing still redirects to `/app/customers`; `app/app/platform/page.tsx` does not exist (ENOENT).

- [ ] **Step 3: Add the nav copy**

In `apps/web/messages/en/nav.json`, add after `"sidebar": { … }` (keep the existing keys unchanged):

```json
  "landing": {
    "empty": "No areas are available for your account.",
    "loading": "Loading…"
  },
  "platform": {
    "description": "Platform administration is not available yet.",
    "title": "Platform"
  }
```

- [ ] **Step 4: Drive the sidebar from `visibleNavGroups`**

In `apps/web/components/layout/app-sidebar.tsx`:

1. Add `import { useCurrentAdminQuery } from '@clensy/client';` and change the nav import to `import { findActiveHref, visibleNavGroups, type NavGroup } from '../../lib/nav-groups';`.
2. In `AppSidebar`, after `const activeHref = …`, add:

```tsx
  // Until currentAdmin resolves (or if it fails) no groups render, so a
  // Super Admin never sees a flash of tenant navigation. UX only — the API
  // stays the authorization boundary (multi-tenant spec §4.2, §5.13).
  const { data } = useCurrentAdminQuery();
  const groups = visibleNavGroups(data?.currentAdmin);
```

3. Pass `groups={groups}` to both `<SidebarNavigation … />` usages.
4. In `SidebarNavigation`, add `groups` to the destructured props and its type (`groups: NavGroup[];`, keeping the type members alphabetical: `activeHref`, `collapsed`, `groups`, `portalContainer`, `t`), and replace `{NAV_GROUPS.map((group) => (` with `{groups.map((group) => (`.

- [ ] **Step 5: Make `/app` a role-aware landing**

Replace `apps/web/app/app/page.tsx` with:

```tsx
'use client';

import { useCurrentAdminQuery } from '@clensy/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { landingHref } from '../../lib/nav-groups';

// Sends each principal to a destination exposed for its scope and role
// in the shell, via the same
// visibility rule as the sidebar (lib/nav-groups.ts): Super Admin to the
// platform placeholder, tenant users to their first visible nav item. A
// missing or invalid session (middleware only checks the cookie exists)
// goes to /login, as on the admin page. UX only — the API remains the
// authorization boundary (multi-tenant spec §4.2, §5.13).
export default function AppIndexPage() {
  const t = useTranslations('nav');
  const router = useRouter();
  const { data, loading, error } = useCurrentAdminQuery({ fetchPolicy: 'network-only' });
  const currentAdmin = data?.currentAdmin;
  const target = loading ? undefined : error || !currentAdmin ? '/login' : landingHref(currentAdmin);

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (!loading && !target) {
    return <p className="text-sm text-slate-500">{t('landing.empty')}</p>;
  }
  return <p className="text-sm text-slate-500">{t('landing.loading')}</p>;
}
```

- [ ] **Step 6: Add the platform placeholder**

Create `apps/web/app/app/platform/page.tsx`:

```tsx
'use client';

import { PageHeader } from '@clensy/ui';
import { useTranslations } from 'next-intl';

// Super Admin's landing. The platform control plane is deferred
// (multi-tenant spec §10), so this page is presentation only and makes no
// API calls. Reaching it grants nothing: the API still denies Super Admin
// every tenant business operation (§4.2).
export default function PlatformPage() {
  const t = useTranslations('nav');
  return <PageHeader title={t('platform.title')} description={t('platform.description')} />;
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run i18n/messages.test.ts lib/web-shell-regressions.test.ts`
Expected: PASS (the namespace-set test still expects `['common', 'nav', 'validation']`).

- [ ] **Step 8: Run the package gate**

Run: `pnpm --filter web test && pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/components/layout/app-sidebar.tsx apps/web/app/app/page.tsx apps/web/app/app/platform/page.tsx apps/web/messages/en/nav.json apps/web/i18n/messages.test.ts apps/web/lib/web-shell-regressions.test.ts
git commit -m "feat(89): render scope-aware sidebar, role-aware /app landing and Super Admin platform placeholder"
```

---

### Task 4: User menu — shared role labels, scope line, translated copy (RFC §3, §4.1, §4.8; decisions 7–10)

**Files:**
- Create: `apps/web/lib/account-identity.ts`
- Create: `apps/web/lib/account-identity.test.ts`
- Modify: `apps/web/components/layout/user-menu.tsx`
- Modify: `apps/web/messages/en/nav.json` (add `userMenu`)
- Modify: `apps/web/i18n/messages.test.ts`
- Modify: `apps/web/lib/web-shell-regressions.test.ts`
- Delete: `apps/web/lib/role-presentation.ts`, `apps/web/lib/role-presentation.test.ts`

**Interfaces:**
- Consumes: `ROLE_INITIALS`, `isAdminRole`, `AdminRole`, `ClensyI18nProvider`, `useClensyTranslations('roles')` from `@clensy/web` (Task 1); `AdminScope` from `@clensy/client`.
- Produces: `accountIdentity(admin: { role: string; scope: AdminScope } | null | undefined): AccountIdentity | undefined` with `AccountIdentity { initials: string; role: AdminRole; scopeKey?: 'userMenu.scope.platform' | 'userMenu.scope.tenant' }` (`scopeKey` undefined for an unknown scope); `nav.userMenu.*` message keys.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/lib/account-identity.test.ts`:

```ts
import type { AdminScope } from '@clensy/client';
import { describe, expect, it } from 'vitest';
import { accountIdentity } from './account-identity';

describe('accountIdentity', () => {
  it('presents a Super Admin as a platform account', () => {
    expect(accountIdentity({ role: 'SUPER_ADMIN', scope: 'PLATFORM' })).toEqual({
      initials: 'SA',
      role: 'SUPER_ADMIN',
      scopeKey: 'userMenu.scope.platform',
    });
  });

  it('presents a tenant user as an organization account', () => {
    expect(accountIdentity({ role: 'ANALYST', scope: 'TENANT' })).toEqual({
      initials: 'AN',
      role: 'ANALYST',
      scopeKey: 'userMenu.scope.tenant',
    });
  });

  it('derives the scope line from scope, not from role', () => {
    expect(accountIdentity({ role: 'TENANT_OWNER', scope: 'PLATFORM' })?.scopeKey).toBe('userMenu.scope.platform');
    expect(accountIdentity({ role: 'SUPER_ADMIN', scope: 'TENANT' })?.scopeKey).toBe('userMenu.scope.tenant');
  });

  it('shows no scope line for a scope it does not know, rather than guessing', () => {
    const identity = accountIdentity({ role: 'ANALYST', scope: 'PARTNER' as unknown as AdminScope });
    expect(identity).toEqual({ initials: 'AN', role: 'ANALYST', scopeKey: undefined });
  });

  it('presents no identity without a principal or for an unknown role', () => {
    expect(accountIdentity(undefined)).toBeUndefined();
    expect(accountIdentity(null)).toBeUndefined();
    expect(accountIdentity({ role: 'OWNER', scope: 'TENANT' })).toBeUndefined();
    expect(accountIdentity({ role: '', scope: 'TENANT' })).toBeUndefined();
  });
});
```

Append to `describe('getMessages', …)` in `apps/web/i18n/messages.test.ts`:

```ts
  it('carries the user menu copy in nav.userMenu', () => {
    expect(getMessages().nav.userMenu).toEqual({
      loadingIdentity: 'Loading user identity',
      open: 'Open user menu',
      scope: { platform: 'Platform account', tenant: 'Organization account' },
      signOut: 'Sign out',
      signOutError: 'Unable to log out. Please try again.',
      signingOut: 'Logging out…',
      theme: 'Theme',
      themes: { dark: 'Dark', light: 'Light', system: 'System' },
    });
  });
```

Append to `describe('web shell regressions', …)` in `apps/web/lib/web-shell-regressions.test.ts` (add `existsSync` to the `node:fs` import):

```ts
  it('presents identity through @clensy/web roles and accountIdentity, with no hard-coded copy', () => {
    const userMenu = readWebSource('components/layout/user-menu.tsx');

    expect(userMenu).toContain('<ClensyI18nProvider');
    expect(userMenu).toContain("useClensyTranslations('roles')");
    expect(userMenu).toContain('accountIdentity(data?.currentAdmin)');
    expect(userMenu).not.toContain('role-presentation');
    expect(userMenu).not.toMatch(/tenantId/);
    for (const literal of ["'Sign out'", "'Theme'", "'Light'", 'Open user menu', 'Unable to log out']) {
      expect(userMenu).not.toContain(literal);
    }
  });

  it('retires the apps/web role-presentation helper', () => {
    expect(existsSync(resolve(webRoot, 'lib/role-presentation.ts'))).toBe(false);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/account-identity.test.ts i18n/messages.test.ts lib/web-shell-regressions.test.ts`
Expected: FAIL — `./account-identity` missing; `nav.userMenu` undefined; user menu still imports `role-presentation` and holds literals; `role-presentation.ts` exists.

- [ ] **Step 3: Add the user menu copy**

In `apps/web/messages/en/nav.json`, add after `"platform": { … }`:

```json
  "userMenu": {
    "loadingIdentity": "Loading user identity",
    "open": "Open user menu",
    "scope": {
      "platform": "Platform account",
      "tenant": "Organization account"
    },
    "signOut": "Sign out",
    "signOutError": "Unable to log out. Please try again.",
    "signingOut": "Logging out…",
    "theme": "Theme",
    "themes": {
      "dark": "Dark",
      "light": "Light",
      "system": "System"
    }
  }
```

- [ ] **Step 4: Implement `accountIdentity`**

Create `apps/web/lib/account-identity.ts`:

```ts
import type { AdminScope } from '@clensy/client';
import { ROLE_INITIALS, isAdminRole, type AdminRole } from '@clensy/web';

export interface AccountIdentity {
  initials: string;
  role: AdminRole;
  // Undefined for a scope this build does not know: no scope line rather
  // than a guessed one.
  scopeKey?: 'userMenu.scope.platform' | 'userMenu.scope.tenant';
}

const SCOPE_KEYS: Readonly<Record<AdminScope, NonNullable<AccountIdentity['scopeKey']>>> = {
  PLATFORM: 'userMenu.scope.platform',
  TENANT: 'userMenu.scope.tenant',
};

// The user menu's identity line. The scope line comes from the explicit
// scope, never from role or tenantId (multi-tenant spec §3/§4.1). Display
// only — not authorization. An unknown role presents no identity.
export function accountIdentity(admin: { role: string; scope: AdminScope } | null | undefined): AccountIdentity | undefined {
  if (!admin || !isAdminRole(admin.role)) return undefined;
  return {
    initials: ROLE_INITIALS[admin.role],
    role: admin.role,
    scopeKey: Object.prototype.hasOwnProperty.call(SCOPE_KEYS, admin.scope) ? SCOPE_KEYS[admin.scope] : undefined,
  };
}
```

- [ ] **Step 5: Rewrite the user menu**

Replace `apps/web/components/layout/user-menu.tsx` with:

```tsx
'use client';

import { useApolloClient } from '@apollo/client';
import { useCurrentAdminQuery, useLogoutMutation } from '@clensy/client';
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
} from '@clensy/ui';
import { ClensyI18nProvider, useClensyTranslations } from '@clensy/web';
import { Check, ChevronDown } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { accountIdentity } from '../../lib/account-identity';
import { useShellTheme } from './shell-chrome';

const THEME_OPTIONS = ['light', 'dark', 'system'] as const;

// Role labels come from @clensy/web's shared `roles` namespace (the same
// labels as the staff console); the menu's own copy from apps/web's
// `nav.userMenu`.
export function UserMenu() {
  const locale = useLocale();
  return (
    <ClensyI18nProvider locale={locale}>
      <UserMenuContent />
    </ClensyI18nProvider>
  );
}

function UserMenuContent() {
  const t = useTranslations('nav');
  const tRoles = useClensyTranslations('roles');
  const apolloClient = useApolloClient();
  const router = useRouter();
  const { data, loading: adminLoading } = useCurrentAdminQuery();
  const [logout, { loading: logoutLoading }] = useLogoutMutation();
  const [logoutFailed, setLogoutFailed] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const { preference, setPreference } = useShellTheme();

  async function handleLogout() {
    setLogoutFailed(false);
    try {
      const result = await logout();
      if (!result.data?.logout) throw new Error('logout returned false');
      await apolloClient.clearStore();
      router.replace('/login');
    } catch {
      setLogoutFailed(true);
    }
  }

  const identity = accountIdentity(data?.currentAdmin);
  const roleLabel = identity ? tRoles(identity.role) : undefined;

  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-auto min-h-9 gap-2 px-2 text-foreground"
            aria-label={t('userMenu.open')}
          >
            {adminLoading ? (
              <Skeleton className="h-8 w-24" aria-label={t('userMenu.loadingIdentity')} />
            ) : identity ? (
              <>
                <Avatar>
                  <AvatarFallback>{identity.initials}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{roleLabel}</span>
              </>
            ) : null}
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48" portalContainer={portalContainer}>
          {identity ? (
            <>
              <DropdownMenuLabel>
                <span className="block">{roleLabel}</span>
                {identity.scopeKey ? (
                  <span className="block text-xs font-normal text-muted-foreground">{t(identity.scopeKey)}</span>
                ) : null}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuLabel>{t('userMenu.theme')}</DropdownMenuLabel>
          {THEME_OPTIONS.map((option) => (
            <DropdownMenuItem key={option} onSelect={() => setPreference(option)}>
              <Check className={preference === option ? 'opacity-100' : 'opacity-0'} aria-hidden="true" />
              {t(`userMenu.themes.${option}`)}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={logoutLoading} onSelect={() => void handleLogout()}>
            {logoutLoading ? t('userMenu.signingOut') : t('userMenu.signOut')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {logoutFailed ? <p className="text-xs text-destructive">{t('userMenu.signOutError')}</p> : null}
      <div ref={setPortalContainer} data-shell-portal-root="" className="contents" />
    </div>
  );
}
```

If `tsc` rejects the template key `` `userMenu.themes.${option}` `` or `t(identity.scopeKey)` under next-intl's typed messages, keep the keys and narrow with `as const` literals (`'userMenu.themes.light' | …`) — do not change the copy or key names.

- [ ] **Step 6: Delete the retired helper**

```bash
git rm apps/web/lib/role-presentation.ts apps/web/lib/role-presentation.test.ts
grep -rn "role-presentation\|presentRole" apps/web --include=*.ts --include=*.tsx --exclude-dir=node_modules --exclude-dir=.next
```

Expected: the `grep` prints nothing.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/account-identity.test.ts i18n/messages.test.ts lib/web-shell-regressions.test.ts`
Expected: PASS.

- [ ] **Step 8: Run the package gate**

Run: `pnpm --filter web test && pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/web/lib/account-identity.ts apps/web/lib/account-identity.test.ts apps/web/components/layout/user-menu.tsx apps/web/messages/en/nav.json apps/web/i18n/messages.test.ts apps/web/lib/web-shell-regressions.test.ts
git commit -m "feat(89): show shared role label and scope line in a translated user menu; retire role-presentation"
```

---

### Task 5: Whole-slice verification

**Files:** none (verification only; fix-forward in the owning task's files if anything fails, then re-run).

- [ ] **Step 1: Run both package gates and builds**

Run: `pnpm --filter @clensy/web test && pnpm --filter @clensy/web exec tsc --noEmit && pnpm --filter @clensy/web lint && pnpm --filter @clensy/web build`
Run: `pnpm --filter web test && pnpm --filter web exec tsc --noEmit && pnpm --filter web lint && pnpm --filter web build`
Expected: all PASS; `next build` lists the new `/app/platform` route.

- [ ] **Step 2: Confirm the boundaries held**

Run: `test -z "$(git diff --name-only main...HEAD -- apps/api packages/client packages/ui)"`
Expected: exit 0 (non-zero means a protected package changed).

Run: `test -z "$(grep -rnE '@clensy/client|@apollo/client|next-intl' packages/web/src --include='*.ts' --include='*.tsx')"`
Expected: exit 0 (non-zero means `@clensy/web` crossed its package boundary).

- [ ] **Step 3: Manual pass against the running app (API + web dev servers, bootstrap tenant)**

For a Super Admin and for each tenant role available in the local database (at minimum Tenant Owner and one non-owner role; Finance if a Finance account can be created through the staff console):

1. Visit `/app` — expect the landing from decision 5 (Super Admin → `/app/platform` with the "Platform" header and placeholder text; tenant roles → `/app/bookings`).
2. Check the sidebar shows exactly that role's row of decision 2 (Super Admin: brand and collapse control only, no groups).
3. Open the user menu — expect the role label, the scope line ("Platform account" / "Organization account"), the initials, working theme options and sign-out.
4. Sign out, then visit `/app` with no cookie — expect `/login`.

Not seeded manually: the inconsistent principals from Review Focus 1 (`PLATFORM` + `TENANT_OWNER`, `TENANT` + `SUPER_ADMIN`). The database forbids them (RFC §4.1 check constraints), so they cannot reach `currentAdmin` from a real account. Their shell behavior is pinned by the pure `visibleNavGroups` / `landingHref` / `accountIdentity` tests, and the query-to-shell wiring is exercised by the consistent principals above.

Typed-URL access to hidden pages is not part of this pass (decision 11); its denial is the API's existing authorization, already covered by the API's tenant-isolation e2e suites.

---

## Traceability

| Task | RFC section(s) | Decisions |
| --- | --- | --- |
| 1 | §4.3 (roles), §4.8 (presentation boundary) | 7, 8 |
| 2 | §3, §4.1 (scope explicit), §4.2 (Super Admin denied; UI not authz), §5.13, §10 (nav visibility follow-on) | 2, 3, 4, 5 |
| 3 | §4.2, §4.8, §5.13, §10 (platform control plane deferred) | 4, 5, 6, 11 |
| 4 | §3, §4.1 (`scope` not `tenantId`), §4.8 | 7, 8, 9, 10 |
| 5 | §5.13 (API remains the boundary) | all |

## Explicit deferrals

- **Typed-URL role guards** (decision 11): a role that navigates directly to a hidden page sees that page's existing API-error state. Follow-up ticket to be opened for a role-aware "not available for your role" experience.
- Cross-app `VIEW_ROLES` drift check (decision 3) — revisit only if drift recurs.
- Tenant name in the shell (needs an API field), tenant switching, and any platform navigation or control plane (RFC §10).
- Translating other shell copy outside the user menu (e.g. the mobile "Toggle navigation menu" label, brand text).
- Docs (`packages/web/README.md` roles/i18n paragraphs, `docs/README.md`, the RFC tracking row) — M9.
