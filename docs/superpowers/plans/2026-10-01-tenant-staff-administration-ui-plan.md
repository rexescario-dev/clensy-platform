# Tenant-Scoped Staff Administration UI — Implementation Plan

| Field | Value |
| --- | --- |
| **Status** | Draft |
| **Kind** | Implementation plan (M4) for **one** delivery slice |
| **Date** | 2026-10-01 |
| **Tracking** | GitHub [#88](https://github.com/rexescario-dev/clensy-platform/issues/88) (program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81)). One PR for this plan (to be Accepted at M5) + implementation (process §2.8). Branch `feat/88-tenant-staff-administration-ui`. |
| **Package / repo** | `clensy-platform` — `packages/web` (`@clensy/web`) and `apps/web` only. **No** `apps/api`, `packages/client`, `packages/ui` changes. |
| **Depends on (Accepted)** | [Multi-Tenant Architecture](../specs/2026-09-23-multi-tenant-architecture-design.md) (Accepted, M3 2026-09-23) — §3 terminology, §4.2 (UI is not authorization), §4.3 (roles, staff lifecycle), §4.8 (presentation boundary), §10 (deferrals). **Where this plan and that specification disagree, the specification wins** — stop and return to M2/M3. Relies on the shipped [Tenant Identity Foundation plan](2026-09-23-tenant-identity-foundation-plan.md) (#68: `admins` / `createAdmin` / `disableAdmin` tenant-scoped API, `currentAdmin { id role scope tenantId }`, role contract on the staff page), [`@clensy/ui` Shared UI System](../specs/2026-09-16-shadcn-ui-boundary-design.md), [`@clensy/web` Login Form](../specs/2026-09-19-clensy-web-login-form-design.md) / [LoginForm self-translating](../specs/2026-09-20-login-form-self-translating-design.md) (component owns its copy through `@clensy/web` i18n) and [Reusable DataTable](../specs/2026-09-19-reusable-data-table-design.md) (`BookingDataTable` precedent). |

> **For agentic workers:** Status **Draft** — do **not** execute until M5 Accepts this plan. After Accept, execute tasks in order with TDD as written. Steps use checkbox (`- [ ]`) syntax. Each task ends green on its package's `vitest` and `tsc` before the next starts. Do not invent product semantics; stop and report on any need for a design or scope change. No push or PR as a side effect.

**Goal:** Align the staff console with the tenant identity model — Tenant Owner visibly distinct from operational Staff, human-readable translated role labels, domain components in `@clensy/web`, actionable error messages, no self-disable affordance, and a scope-aware page gate.

**Architecture:** Two presentation-only domain components (`StaffDataTable`, `CreateStaffForm`) and a `staff` i18n namespace move into `@clensy/web` (RFC §4.8). `apps/web/app/app/admin/page.tsx` keeps routing, the session redirect, Apollo queries/mutations and dialog state, and composes those components. A pure `apps/web/lib/staff-console.ts` holds the scope-aware gate predicate and maps Apollo errors (operation + `extensions.status`) to typed `StaffErrorKey`s, which the `staff` namespace translates.

**Tech Stack:** React 19, Next 16 App Router (client page), Apollo Client 3.14, `@clensy/ui` primitives, `@clensy/web` i18n context, Vitest (node environment, `renderToStaticMarkup`), pnpm + turbo.

**Spec:** `docs/superpowers/specs/2026-09-23-multi-tenant-architecture-design.md`

## Slice decisions (brainstorm, 2026-10-01 — developer-approved)

These are planning decisions recorded for this slice; they add no product semantics beyond the RFC.

1. **Scope: UI-only full alignment.** No API / GraphQL / `@clensy/ui` changes.
2. **Role presentation.** Roles render as translated labels. The `TENANT_OWNER` label renders as a distinct `Badge` (`secondary`); Staff roles render as plain text. The create form's role `<select>` groups options under **Tenant Owner** and **Staff** `<optgroup>`s; `SUPER_ADMIN` is never offered (RFC §4.3).
3. **Role labels live in a new `@clensy/web` `staff` namespace.** `apps/web/lib/role-presentation.ts` and `components/layout/user-menu.tsx` stay untouched (shell = #89). The temporary duplicate English labels are accepted; **#89 may consolidate** role presentation onto `@clensy/web` later. `staff.roles.OPS_MANAGER` is `'Ops Manager'`, matching the shell's existing label so the two surfaces do not disagree in the meantime.
4. **`STAFF_ROLE_OPTIONS` holds stable `Role` identifiers**, never display strings. Labels come only from the `staff` namespace.
5. **Component boundary.** `StaffDataTable` and `CreateStaffForm` are presentation-only in `@clensy/web`. The form's grouped `<select>` is a styled native element inside `CreateStaffForm` (no new `@clensy/ui` primitive). `apps/web` owns data, mutations, and orchestration.
6. **Self-row.** `Disable` is not rendered for `row.id === currentAdminId` (the API rejects self-disable; RFC §4.3). Inactive rows keep no action.
7. **Scope-aware gate.** The page renders the console only when `currentAdmin.scope === 'TENANT' && currentAdmin.role === 'TENANT_OWNER'` (RFC §3 / §4.1: branch on scope, never on `tenantId`). UX only — the API remains the authorization boundary (RFC §4.2, §5.13).
8. **Error mapping.** By **operation + GraphQL `extensions.status`**, never message text. The mapper returns a typed `StaffErrorKey`; the `staff` namespace resolves it to text:

   | Operation | Status | `StaffErrorKey` | en text |
   | --- | --- | --- | --- |
   | create | 409 | `emailInUse` | An account with this email already exists. |
   | create | 400 | `invalidInput` | Check the email and password and try again. |
   | create | 403 | `createForbidden` | You don't have permission to create staff accounts. |
   | disable | 409 | `lastTenantOwner` | You can't disable the last active Tenant Owner. Add another Tenant Owner first. |
   | disable | 404 | `accountNotFound` | This account no longer exists. The list has been refreshed. |
   | disable | 403 | `disableForbidden` | You don't have permission to disable this account. |
   | create | other / network | `createFailed` | Unable to create staff account. |
   | disable | other / network | `disableFailed` | Unable to disable staff account. |

   **400 verified:** `CreateAdminInput` uses `class-validator` (`@IsEmail`, `@MinLength(1)`) under the global `ValidationPipe` (`apps/api/src/platform/graphql/apply-platform-pipes.ts`), which throws `BadRequestException` → `extensions.status` 400, the same shape `jobs.e2e-spec.ts` asserts for 404/409. GraphQL-level validation errors (e.g. an unknown enum) carry no `status` and fall back to `createFailed`.
9. **Error placement unchanged.** Create errors show inline in the still-open `FormDialog`. Disable errors show inline on the page after `ConfirmDialog` closes (it has no error slot; changing it is `@clensy/ui` scope). On `accountNotFound` the page refetches `admins`.
10. **Page copy** (loading, not-authorized, title, action, dialog copy) also comes from the `staff` namespace via `useClensyTranslations('staff')` under `ClensyI18nProvider`, following the LoginForm precedent. No new `apps/web/messages/*.json` namespace, so the next-intl v1 namespace-set test is unchanged.

## Global Constraints

- SHALL NOT change `apps/api`, `packages/client` GraphQL operations, generated types, or `packages/ui`.
- SHALL NOT offer `SUPER_ADMIN` or any platform scope in the create form (RFC §4.3).
- SHALL NOT treat the page gate, hidden `Disable`, or nav as authorization (RFC §4.2, §4.8, §5.13).
- SHALL NOT branch on `tenantId === null`; the gate branches on `scope` (RFC §3).
- SHALL NOT reference the retired `'OWNER'` role anywhere in `apps/web` or `packages/web` (RFC §4.3).
- SHALL NOT add domain components to `packages/ui/src/domain/` or `apps/web` (RFC §4.8).
- SHALL NOT edit `apps/web/lib/role-presentation.ts`, `apps/web/components/layout/**`, or `apps/web/lib/nav-groups.ts` (#89).
- SHALL NOT add role-update / email-update, tenant name display, or Super Admin UX (RFC §10; #89).
- SHALL NOT match on GraphQL error `message` text.
- `@clensy/web` SHALL NOT depend on `@clensy/client` (existing package boundary — it declares its own `StaffRole` union, as `BookingDataTable` declares `BookingStatus`).

## Review Focus

1. **A row whose `role` is outside the six tenant roles** (e.g. a stray `SUPER_ADMIN` row if the API contract ever regressed) — the table must render the raw identifier, not crash or show `roles.SUPER_ADMIN`. Pinned in Task 2.
2. **Current admin is the only active Tenant Owner** — their own row shows the Tenant Owner badge and **no** `Disable`; other owners' rows still show `Disable`. Pinned in Task 2.
3. **A GraphQL error with no `extensions.status`, an empty `graphQLErrors`, a non-Apollo thrown value, or `undefined`** — mapper returns the operation's generic key, never throws. Pinned in Task 4.
4. **Platform principal whose role string happens to be `TENANT_OWNER`-like, or `scope: 'TENANT'` with a non-owner role** — gate returns `false` unless both hold; `null`/`undefined` admin → `false`. Pinned in Task 4.
5. **Every `StaffErrorKey` and every `STAFF_ROLE_OPTIONS` role resolves to real text** (not the key path) — a missing catalog entry would show `errors.emailInUse` to users. Pinned in Task 1.

---

## File structure

| File | Responsibility |
| --- | --- |
| Create `packages/web/src/i18n/messages/en/staff.ts` | Default `en` copy for the staff console (columns, roles, role groups, status, actions, errors, page copy). Only copy of these strings. |
| Modify `packages/web/src/i18n/messages.ts` | Register `staff` namespace. |
| Create `packages/web/src/staff/staff-roles.ts` | `StaffRole`, `STAFF_ROLE_GROUPS`, `STAFF_ROLE_OPTIONS`, `isStaffRole`. |
| Create `packages/web/src/staff/staff-errors.ts` | `STAFF_ERROR_KEYS`, `StaffErrorKey`. |
| Create `packages/web/src/staff/staff-data-table.tsx` | `StaffDataTable`, `buildStaffColumns`, `StaffMember`. |
| Create `packages/web/src/staff/create-staff-form.tsx` | `CreateStaffForm`, `CreateStaffFormValues`. |
| Create tests next to each (`*.test.ts[x]`) | Unit tests (node env, `renderToStaticMarkup`). |
| Modify `packages/web/src/index.ts` | Public exports. |
| Create `apps/web/lib/staff-console.ts` (+ `.test.ts`) | `canManageStaff`, `staffMutationErrorKey`. |
| Modify `apps/web/app/app/admin/page.tsx` | Compose components; gate; i18n; error keys; 404 refetch. |
| Modify `apps/web/lib/tenant-role-regressions.test.ts` | Consume `STAFF_ROLE_OPTIONS` and `canManageStaff` instead of regex-scanning page source. |

---

### Task 1: `staff` namespace, role and error-key contracts in `@clensy/web`

Traces: RFC §3 (Tenant Owner vs Staff terminology), §4.3 (role set, no `SUPER_ADMIN` for tenant creation), §4.8. Slice decisions 2–4, 8, 10.

**Files:**
- Create: `packages/web/src/staff/staff-roles.ts`, `packages/web/src/staff/staff-errors.ts`, `packages/web/src/i18n/messages/en/staff.ts`
- Modify: `packages/web/src/i18n/messages.ts`
- Test: `packages/web/src/staff/staff-contracts.test.tsx`

**Interfaces:**
- Produces:
  - `type StaffRole = 'TENANT_OWNER' | 'OPS_MANAGER' | 'SCHEDULER' | 'CUSTOMER_SUPPORT' | 'FINANCE' | 'ANALYST'`
  - `STAFF_ROLE_GROUPS: readonly { id: 'owner' | 'staff'; roles: readonly StaffRole[] }[]`
  - `STAFF_ROLE_OPTIONS: readonly StaffRole[]` (flattened, group order)
  - `isStaffRole(role: string): role is StaffRole`
  - `STAFF_ERROR_KEYS` (readonly tuple) and `type StaffErrorKey = (typeof STAFF_ERROR_KEYS)[number]`
  - `staff` messages namespace; `useClensyTranslations('staff')` keys: `columns.{email,role,status}`, `roles.<StaffRole>`, `roleGroups.{owner,staff}`, `roleHint.TENANT_OWNER`, `status.{active,disabled}`, `actions.disable`, `empty`, `loadError`, `errors.<StaffErrorKey>`, `page.*`, `form.*`, `confirmDisable.*`

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/src/staff/staff-contracts.test.tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { STAFF_ROLE_GROUPS, STAFF_ROLE_OPTIONS, isStaffRole } from './staff-roles';
import { STAFF_ERROR_KEYS } from './staff-errors';
import { useClensyTranslations } from '../i18n/use-clensy-translations';
import { ClensyI18nProvider } from '../i18n/i18n-context';

function Resolve({ keys }: { keys: string[] }) {
  const t = useClensyTranslations('staff');
  return <ul>{keys.map((key) => <li key={key} data-key={key}>{t(key)}</li>)}</ul>;
}

function resolvedTexts(keys: string[]): string[] {
  const html = renderToStaticMarkup(<Resolve keys={keys} />);
  return [...html.matchAll(/<li data-key="[^"]*">([^<]*)<\/li>/g)].map((m) => m[1]);
}

describe('staff role contract', () => {
  it('offers exactly the six tenant roles, owner group first, never SUPER_ADMIN', () => {
    expect(STAFF_ROLE_GROUPS.map((g) => g.id)).toEqual(['owner', 'staff']);
    expect(STAFF_ROLE_GROUPS[0].roles).toEqual(['TENANT_OWNER']);
    expect([...STAFF_ROLE_OPTIONS].sort()).toEqual(
      ['ANALYST', 'CUSTOMER_SUPPORT', 'FINANCE', 'OPS_MANAGER', 'SCHEDULER', 'TENANT_OWNER'].sort(),
    );
    expect(STAFF_ROLE_OPTIONS).not.toContain('SUPER_ADMIN');
    expect(STAFF_ROLE_OPTIONS).not.toContain('OWNER');
  });

  it('recognises only tenant roles', () => {
    expect(isStaffRole('FINANCE')).toBe(true);
    expect(isStaffRole('SUPER_ADMIN')).toBe(false);
    expect(isStaffRole('OWNER')).toBe(false);
  });
});

describe('staff namespace completeness', () => {
  it('resolves every role, group and error key to real text', () => {
    const keys = [
      ...STAFF_ROLE_OPTIONS.map((role) => `roles.${role}`),
      ...STAFF_ROLE_GROUPS.map((group) => `roleGroups.${group.id}`),
      ...STAFF_ERROR_KEYS.map((key) => `errors.${key}`),
    ];
    const texts = resolvedTexts(keys);
    expect(texts).toHaveLength(keys.length);
    texts.forEach((text, i) => expect(text).not.toBe(keys[i]));
  });

  it('uses the agreed English labels', () => {
    expect(resolvedTexts(['roles.TENANT_OWNER', 'roles.OPS_MANAGER', 'errors.lastTenantOwner'])).toEqual([
      'Tenant Owner',
      'Ops Manager',
      "You can&#x27;t disable the last active Tenant Owner. Add another Tenant Owner first.",
    ]);
  });

  it('lets an application override staff copy through ClensyI18nProvider', () => {
    const html = renderToStaticMarkup(
      <ClensyI18nProvider overrides={{ staff: { roles: { FINANCE: 'Billing' } } }}>
        <Resolve keys={['roles.FINANCE']} />
      </ClensyI18nProvider>,
    );
    expect(html).toContain('Billing');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @clensy/web exec vitest run src/staff/staff-contracts.test.tsx`
Expected: FAIL — cannot resolve `./staff-roles`.

- [ ] **Step 3: Write the implementation**

```ts
// packages/web/src/staff/staff-roles.ts
// Tenant-scope roles a Tenant Owner may assign (multi-tenant spec §4.3).
// Stable identifiers only — display labels live in the `staff` i18n
// namespace. Declared locally (not imported from @clensy/client) to keep
// @clensy/web free of the GraphQL client, as BookingStatus is.
export type StaffRole = 'TENANT_OWNER' | 'OPS_MANAGER' | 'SCHEDULER' | 'CUSTOMER_SUPPORT' | 'FINANCE' | 'ANALYST';

export const STAFF_ROLE_GROUPS: readonly { id: 'owner' | 'staff'; roles: readonly StaffRole[] }[] = [
  { id: 'owner', roles: ['TENANT_OWNER'] },
  { id: 'staff', roles: ['OPS_MANAGER', 'SCHEDULER', 'CUSTOMER_SUPPORT', 'FINANCE', 'ANALYST'] },
];

export const STAFF_ROLE_OPTIONS: readonly StaffRole[] = STAFF_ROLE_GROUPS.flatMap((group) => group.roles);

export function isStaffRole(role: string): role is StaffRole {
  return (STAFF_ROLE_OPTIONS as readonly string[]).includes(role);
}
```

```ts
// packages/web/src/staff/staff-errors.ts
// Typed message keys for staff mutation failures. apps/web maps API errors
// to one of these; the `staff` namespace (errors.<key>) owns the text.
export const STAFF_ERROR_KEYS = [
  'emailInUse',
  'invalidInput',
  'createForbidden',
  'createFailed',
  'lastTenantOwner',
  'accountNotFound',
  'disableForbidden',
  'disableFailed',
] as const;

export type StaffErrorKey = (typeof STAFF_ERROR_KEYS)[number];
```

```ts
// packages/web/src/i18n/messages/en/staff.ts
// Default `en` messages for the staff console (StaffDataTable,
// CreateStaffForm and the admin page's own copy). This is the ONLY copy of
// these strings' English text; apps/web may layer partial overrides via
// ClensyI18nProvider. Role labels intentionally duplicate
// apps/web/lib/role-presentation.ts for now — #89 may consolidate them.
export const staff = {
  actions: { disable: 'Disable' },
  columns: { email: 'Email', role: 'Role', status: 'Status' },
  confirmDisable: {
    confirm: 'Disable',
    description: 'This will disable {email}. They will no longer be able to sign in.',
    title: 'Disable this staff account?',
  },
  empty: 'No staff accounts.',
  errors: {
    accountNotFound: 'This account no longer exists. The list has been refreshed.',
    createFailed: 'Unable to create staff account.',
    createForbidden: "You don't have permission to create staff accounts.",
    disableFailed: 'Unable to disable staff account.',
    disableForbidden: "You don't have permission to disable this account.",
    emailInUse: 'An account with this email already exists.',
    invalidInput: 'Check the email and password and try again.',
    lastTenantOwner: "You can't disable the last active Tenant Owner. Add another Tenant Owner first.",
  },
  form: {
    creating: 'Creating…',
    email: 'Email',
    password: 'Password',
    role: 'Role',
    submit: 'Create staff account',
    title: 'Add staff account',
  },
  loadError: 'Unable to load staff accounts.',
  page: {
    loading: 'Loading…',
    newAccount: '+ New Staff Account',
    notAuthorized: 'You are not authorized to view this page.',
    title: 'Staff Accounts',
  },
  roleGroups: { owner: 'Tenant Owner', staff: 'Staff' },
  roleHint: { TENANT_OWNER: 'Tenant Owners can create and disable staff accounts for this organization.' },
  roles: {
    ANALYST: 'Analyst',
    CUSTOMER_SUPPORT: 'Customer Support',
    FINANCE: 'Finance',
    OPS_MANAGER: 'Ops Manager',
    SCHEDULER: 'Scheduler',
    TENANT_OWNER: 'Tenant Owner',
  },
  status: { active: 'Active', disabled: 'Disabled' },
};
```

In `packages/web/src/i18n/messages.ts`, add `import { staff } from './messages/en/staff';` and change the return to `return { auth, bookings, staff };`.

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `pnpm --filter @clensy/web test && pnpm --filter @clensy/web build && pnpm --filter @clensy/web lint`
Expected: PASS (existing bookings/i18n tests unaffected).

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/staff packages/web/src/i18n
git commit -m "feat(88): add staff i18n namespace and tenant role/error-key contracts to @clensy/web"
```

---

### Task 2: `StaffDataTable`

Traces: RFC §3, §4.3 (self-disable forbidden; Tenant Owner vs Staff), §4.8. Slice decisions 2, 5, 6. Review Focus 1–2.

**Files:**
- Create: `packages/web/src/staff/staff-data-table.tsx`
- Test: `packages/web/src/staff/staff-data-table.test.tsx`

**Interfaces:**
- Consumes: `isStaffRole` (Task 1), `staff` namespace (Task 1), `DataTable`, `Badge`, `Button`, `StatusBadge`, `DataTableColumn` from `@clensy/ui`.
- Produces:
  - `interface StaffMember { id: string; email: string; role: string; isActive: boolean; [key: string]: unknown }` (`role: string` so API `Role` rows are assignable; unknown roles render raw).
  - `interface StaffDataTableProps { staff: StaffMember[]; currentAdminId: string; loading?: boolean; hasError?: boolean; disabling?: boolean; onDisable: (member: StaffMember) => void }`
  - `StaffDataTable(props: StaffDataTableProps)`
  - `buildStaffColumns(t: (key: string) => string, options: { currentAdminId: string; disabling?: boolean; onDisable: (member: StaffMember) => void }): DataTableColumn<StaffMember>[]` — exported from the module for tests, not from the package index.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/src/staff/staff-data-table.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { isValidElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaffDataTable, buildStaffColumns, type StaffMember } from './staff-data-table';

const t = (key: string) => key;
const me: StaffMember = { id: 'me', email: 'me@a.test', role: 'TENANT_OWNER', isActive: true };
const otherOwner: StaffMember = { id: 'o2', email: 'o2@a.test', role: 'TENANT_OWNER', isActive: true };
const finance: StaffMember = { id: 'f1', email: 'f1@a.test', role: 'FINANCE', isActive: true };
const disabled: StaffMember = { id: 'd1', email: 'd1@a.test', role: 'ANALYST', isActive: false };

function actionsCell(member: StaffMember, onDisable = vi.fn()) {
  const column = buildStaffColumns(t, { currentAdminId: me.id, onDisable }).find((c) => c.key === 'actions');
  const render = column?.render;
  if (typeof render !== 'function') throw new Error('actions column must render a function');
  return render(member);
}

describe('StaffDataTable', () => {
  it('renders translated role labels, with Tenant Owner as a distinct badge', () => {
    const html = renderToStaticMarkup(
      <StaffDataTable staff={[otherOwner, finance]} currentAdminId={me.id} onDisable={() => {}} />,
    );
    expect(html).toContain('Tenant Owner');
    expect(html).toContain('Finance');
    expect(html).not.toContain('TENANT_OWNER');
    expect(html).not.toContain('roles.');
    expect(html).toMatch(/data-slot="badge"[^>]*>Tenant Owner</);
    expect(html).not.toMatch(/data-slot="badge"[^>]*>Finance</);
  });

  it('renders an unknown role identifier raw instead of a missing-key path', () => {
    const html = renderToStaticMarkup(
      <StaffDataTable
        staff={[{ id: 'x', email: 'x@a.test', role: 'SUPER_ADMIN', isActive: true }]}
        currentAdminId={me.id}
        onDisable={() => {}}
      />,
    );
    expect(html).toContain('SUPER_ADMIN');
    expect(html).not.toContain('roles.SUPER_ADMIN');
  });

  it('renders Active/Disabled status labels', () => {
    const html = renderToStaticMarkup(
      <StaffDataTable staff={[finance, disabled]} currentAdminId={me.id} onDisable={() => {}} />,
    );
    expect(html).toContain('Active');
    expect(html).toContain('Disabled');
  });

  it('offers no Disable on the current admin row or on inactive rows', () => {
    expect(actionsCell(me)).toBeNull();
    expect(actionsCell(disabled)).toBeNull();
  });

  it('offers Disable on other active rows, including other Tenant Owners, and reports the row', () => {
    const onDisable = vi.fn();
    const cell = actionsCell(otherOwner, onDisable);
    expect(isValidElement(cell)).toBe(true);
    (cell as ReactElement<{ onClick: () => void }>).props.onClick();
    expect(onDisable).toHaveBeenCalledWith(otherOwner);
    expect(isValidElement(actionsCell(finance))).toBe(true);
  });

  it('shows the translated empty and load-error messages', () => {
    expect(renderToStaticMarkup(<StaffDataTable staff={[]} currentAdminId={me.id} onDisable={() => {}} />)).toContain(
      'No staff accounts.',
    );
    expect(
      renderToStaticMarkup(<StaffDataTable staff={[]} currentAdminId={me.id} hasError onDisable={() => {}} />),
    ).toContain('Unable to load staff accounts.');
  });
});
```

(`data-slot="badge"` is the attribute `packages/ui/src/base/badge.tsx` renders on the badge root — verified at planning time.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @clensy/web exec vitest run src/staff/staff-data-table.test.tsx`
Expected: FAIL — cannot resolve `./staff-data-table`.

- [ ] **Step 3: Write the implementation**

```tsx
// packages/web/src/staff/staff-data-table.tsx
'use client';

import { Badge, Button, DataTable, StatusBadge, type DataTableColumn } from '@clensy/ui';
import { useClensyTranslations } from '../i18n/use-clensy-translations';
import { isStaffRole } from './staff-roles';

// `role: string` (not StaffRole) so rows from the API's wider `Role` type
// are assignable; the API only returns this tenant's rows (spec §4.9), and
// anything outside the tenant role set renders as its raw identifier.
export interface StaffMember {
  id: string;
  email: string;
  role: string;
  isActive: boolean;
  [key: string]: unknown;
}

export interface StaffDataTableProps {
  staff: StaffMember[];
  currentAdminId: string;
  loading?: boolean;
  hasError?: boolean;
  disabling?: boolean;
  onDisable: (member: StaffMember) => void;
}

type Translate = (key: string) => string;

function RoleLabel({ role, t }: { role: string; t: Translate }) {
  if (!isStaffRole(role)) return <>{role}</>;
  const label = t(`roles.${role}`);
  // Tenant Owner is the tenant's administrator, not an operational role
  // (spec §3) — shown as a badge so the distinction reads at a glance.
  return role === 'TENANT_OWNER' ? <Badge variant="secondary">{label}</Badge> : <>{label}</>;
}

function StatusLabel({ isActive, t }: { isActive: boolean; t: Translate }) {
  return isActive ? (
    <StatusBadge label={t('status.active')} tone="success" />
  ) : (
    <StatusBadge label={t('status.disabled')} tone="danger" />
  );
}

interface StaffActionOptions {
  currentAdminId: string;
  disabling?: boolean;
  onDisable: (member: StaffMember) => void;
}

// Self-disable is rejected by the API (spec §4.3); not offering it is UX
// only — the API stays the authorization boundary.
function renderDisableAction(row: StaffMember, t: Translate, options: StaffActionOptions) {
  if (!row.isActive || row.id === options.currentAdminId) return null;
  return (
    <Button variant="destructive" disabled={options.disabling} onClick={() => options.onDisable(row)}>
      {t('actions.disable')}
    </Button>
  );
}

export function buildStaffColumns(t: Translate, options: StaffActionOptions): DataTableColumn<StaffMember>[] {
  return [
    { header: t('columns.email'), key: 'email' },
    { header: t('columns.role'), key: 'role', render: (row) => <RoleLabel role={row.role} t={t} /> },
    { header: t('columns.status'), key: 'status', render: (row) => <StatusLabel isActive={row.isActive} t={t} /> },
    { header: '', key: 'actions', render: (row) => renderDisableAction(row, t, options) },
  ];
}

export function StaffDataTable({ staff, currentAdminId, loading, hasError, disabling, onDisable }: StaffDataTableProps) {
  const t = useClensyTranslations('staff');
  const actionOptions = { currentAdminId, disabling, onDisable };
  const columns = buildStaffColumns(t, actionOptions);

  // Same helpers as the desktop columns — no second mapping.
  function renderMobileRow(row: StaffMember) {
    return (
      <div className="rounded-lg border p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium">{row.email}</span>
          <StatusLabel isActive={row.isActive} t={t} />
        </div>
        <div className="flex items-center justify-between pt-1">
          <RoleLabel role={row.role} t={t} />
          {renderDisableAction(row, t, actionOptions)}
        </div>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      rows={staff}
      rowKey={(row) => row.id}
      emptyMessage={t('empty')}
      loading={loading}
      error={hasError ? t('loadError') : undefined}
      mobileRow={renderMobileRow}
    />
  );
}
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `pnpm --filter @clensy/web test && pnpm --filter @clensy/web build && pnpm --filter @clensy/web lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/staff/staff-data-table.tsx packages/web/src/staff/staff-data-table.test.tsx
git commit -m "feat(88): add StaffDataTable with Tenant Owner badge and no self-disable action"
```

---

### Task 3: `CreateStaffForm` and package exports

Traces: RFC §4.3 (Tenant Owner cannot create `SUPER_ADMIN` / platform scope), §4.8. Slice decisions 2, 4, 5, 8, 9.

**Files:**
- Create: `packages/web/src/staff/create-staff-form.tsx`
- Modify: `packages/web/src/index.ts`
- Test: `packages/web/src/staff/create-staff-form.test.tsx`

**Interfaces:**
- Consumes: `STAFF_ROLE_GROUPS`, `StaffRole` (Task 1), `StaffErrorKey` (Task 1), `FormField` from `@clensy/ui`.
- Produces:
  - `interface CreateStaffFormValues { email: string; password: string; role: StaffRole }`
  - `interface CreateStaffFormProps { values: CreateStaffFormValues; onChange: (values: CreateStaffFormValues) => void; errorKey?: StaffErrorKey }`
  - `CreateStaffForm(props)` — renders the fields only; the page wraps it in `FormDialog`.
  - Package index exports: `StaffDataTable`, `CreateStaffForm`, `STAFF_ROLE_OPTIONS`, `STAFF_ROLE_GROUPS`, `isStaffRole`, `STAFF_ERROR_KEYS`, and types `StaffMember`, `StaffDataTableProps`, `StaffRole`, `StaffErrorKey`, `CreateStaffFormValues`, `CreateStaffFormProps`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/web/src/staff/create-staff-form.test.tsx
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CreateStaffForm, type CreateStaffFormValues } from './create-staff-form';
import * as publicApi from '../index';

const base: CreateStaffFormValues = { email: '', password: '', role: 'CUSTOMER_SUPPORT' };
const render = (props: Partial<Parameters<typeof CreateStaffForm>[0]> = {}) =>
  renderToStaticMarkup(<CreateStaffForm values={base} onChange={() => {}} {...props} />);

describe('CreateStaffForm', () => {
  it('groups roles under Tenant Owner and Staff with translated labels', () => {
    const html = render();
    expect(html).toMatch(/<optgroup label="Tenant Owner"><option value="TENANT_OWNER">Tenant Owner<\/option><\/optgroup>/);
    expect(html).toMatch(/<optgroup label="Staff">.*<option value="OPS_MANAGER">Ops Manager<\/option>.*<\/optgroup>/);
    const values = [...html.matchAll(/<option value="([A-Z_]+)"/g)].map((m) => m[1]);
    expect(values.sort()).toEqual(
      ['ANALYST', 'CUSTOMER_SUPPORT', 'FINANCE', 'OPS_MANAGER', 'SCHEDULER', 'TENANT_OWNER'].sort(),
    );
    expect(html).not.toContain('SUPER_ADMIN');
  });

  it('shows the Tenant Owner hint only when Tenant Owner is selected', () => {
    const hint = 'Tenant Owners can create and disable staff accounts for this organization.';
    expect(render()).not.toContain(hint);
    expect(render({ values: { ...base, role: 'TENANT_OWNER' } })).toContain(hint);
  });

  it('renders the translated error for an error key', () => {
    expect(render({ errorKey: 'emailInUse' })).toContain('An account with this email already exists.');
    expect(render()).not.toContain('role="alert"');
  });

  it('is exported from the package with the role contract', () => {
    expect(publicApi.CreateStaffForm).toBe(CreateStaffForm);
    expect(publicApi.StaffDataTable).toBeTypeOf('function');
    expect(publicApi.STAFF_ROLE_OPTIONS).toContain('TENANT_OWNER');
    expect(publicApi.STAFF_ERROR_KEYS).toContain('lastTenantOwner');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @clensy/web exec vitest run src/staff/create-staff-form.test.tsx`
Expected: FAIL — cannot resolve `./create-staff-form`.

- [ ] **Step 3: Write the implementation**

```tsx
// packages/web/src/staff/create-staff-form.tsx
'use client';

import { FormField } from '@clensy/ui';
import { useClensyTranslations } from '../i18n/use-clensy-translations';
import type { StaffErrorKey } from './staff-errors';
import { STAFF_ROLE_GROUPS, type StaffRole } from './staff-roles';

export interface CreateStaffFormValues {
  email: string;
  password: string;
  role: StaffRole;
}

export interface CreateStaffFormProps {
  values: CreateStaffFormValues;
  onChange: (values: CreateStaffFormValues) => void;
  errorKey?: StaffErrorKey;
}

// Fields only — the page owns FormDialog, submission and the mutation.
// Only tenant roles are offered: a Tenant Owner never creates a Super Admin
// (spec §4.3). The API enforces that independently. Native <select> because
// @clensy/ui has no grouped-select primitive and this slice adds none.
export function CreateStaffForm({ values, onChange, errorKey }: CreateStaffFormProps) {
  const t = useClensyTranslations('staff');

  return (
    <>
      <FormField
        label={t('form.email')}
        name="new-email"
        type="email"
        required
        value={values.email}
        onChange={(event) => onChange({ ...values, email: event.target.value })}
      />
      <FormField
        label={t('form.password')}
        name="new-password"
        type="password"
        required
        value={values.password}
        onChange={(event) => onChange({ ...values, password: event.target.value })}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="new-role" className="text-sm font-medium text-slate-700">
          {t('form.role')}
        </label>
        <select
          id="new-role"
          name="new-role"
          aria-describedby={values.role === 'TENANT_OWNER' ? 'new-role-hint' : undefined}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          value={values.role}
          onChange={(event) => onChange({ ...values, role: event.target.value as StaffRole })}
        >
          {STAFF_ROLE_GROUPS.map((group) => (
            <optgroup key={group.id} label={t(`roleGroups.${group.id}`)}>
              {group.roles.map((role) => (
                <option key={role} value={role}>
                  {t(`roles.${role}`)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {values.role === 'TENANT_OWNER' ? (
          <p id="new-role-hint" className="text-xs text-slate-500">
            {t('roleHint.TENANT_OWNER')}
          </p>
        ) : null}
      </div>
      {errorKey ? (
        <p role="alert" className="text-sm text-red-600">
          {t(`errors.${errorKey}`)}
        </p>
      ) : null}
    </>
  );
}
```

Append to `packages/web/src/index.ts`:

```ts
export { StaffDataTable } from './staff/staff-data-table';
export type { StaffMember, StaffDataTableProps } from './staff/staff-data-table';
export { CreateStaffForm } from './staff/create-staff-form';
export type { CreateStaffFormValues, CreateStaffFormProps } from './staff/create-staff-form';
export { STAFF_ROLE_GROUPS, STAFF_ROLE_OPTIONS, isStaffRole } from './staff/staff-roles';
export type { StaffRole } from './staff/staff-roles';
export { STAFF_ERROR_KEYS } from './staff/staff-errors';
export type { StaffErrorKey } from './staff/staff-errors';
```

- [ ] **Step 4: Run tests, typecheck, lint**

Run: `pnpm --filter @clensy/web test && pnpm --filter @clensy/web build && pnpm --filter @clensy/web lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/staff/create-staff-form.tsx packages/web/src/staff/create-staff-form.test.tsx packages/web/src/index.ts
git commit -m "feat(88): add CreateStaffForm with grouped tenant roles and export staff components"
```

---

### Task 4: Gate predicate and error-key mapper in `apps/web`

Traces: RFC §3 / §4.1 (scope explicit, never inferred from `tenantId`), §4.2 (UI not authorization), §4.3 (last-owner, self-disable, no Super Admin creation), §4.5 (cross-tenant → not found). Slice decisions 7, 8. Review Focus 3–4.

**Files:**
- Create: `apps/web/lib/staff-console.ts`
- Test: `apps/web/lib/staff-console.test.ts`

**Interfaces:**
- Consumes: `StaffErrorKey` (Task 3 export from `@clensy/web`), `AdminScope` / `Role` types from `@clensy/client`.
- Produces:
  - `canManageStaff(admin: { role: Role; scope: AdminScope } | null | undefined): boolean`
  - `type StaffMutation = 'create' | 'disable'`
  - `staffMutationErrorKey(operation: StaffMutation, error: unknown): StaffErrorKey`

- [ ] **Step 1: Write the failing test**

```ts
// apps/web/lib/staff-console.test.ts
import { describe, expect, it } from 'vitest';
import { canManageStaff, staffMutationErrorKey } from './staff-console';

const gqlError = (status?: number) => ({
  graphQLErrors: [{ message: 'ignored text', extensions: status === undefined ? {} : { status } }],
});

describe('canManageStaff', () => {
  it('requires both TENANT scope and TENANT_OWNER role', () => {
    expect(canManageStaff({ role: 'TENANT_OWNER', scope: 'TENANT' })).toBe(true);
    expect(canManageStaff({ role: 'TENANT_OWNER', scope: 'PLATFORM' })).toBe(false);
    expect(canManageStaff({ role: 'SUPER_ADMIN', scope: 'PLATFORM' })).toBe(false);
    expect(canManageStaff({ role: 'FINANCE', scope: 'TENANT' })).toBe(false);
    expect(canManageStaff(null)).toBe(false);
    expect(canManageStaff(undefined)).toBe(false);
  });
});

describe('staffMutationErrorKey', () => {
  it.each([
    ['create', 409, 'emailInUse'],
    ['create', 400, 'invalidInput'],
    ['create', 403, 'createForbidden'],
    ['create', 500, 'createFailed'],
    ['create', 404, 'createFailed'],
    ['disable', 409, 'lastTenantOwner'],
    ['disable', 404, 'accountNotFound'],
    ['disable', 403, 'disableForbidden'],
    ['disable', 400, 'disableFailed'],
    ['disable', 500, 'disableFailed'],
  ] as const)('%s + %i → %s', (operation, status, key) => {
    expect(staffMutationErrorKey(operation, gqlError(status))).toBe(key);
  });

  it('never matches on message text', () => {
    const error = { graphQLErrors: [{ message: 'Email is already in use', extensions: {} }] };
    expect(staffMutationErrorKey('create', error)).toBe('createFailed');
  });

  it.each([
    ['no status', gqlError()],
    ['empty graphQLErrors', { graphQLErrors: [] }],
    ['network error', { networkError: new Error('offline'), graphQLErrors: [] }],
    ['plain Error', new Error('boom')],
    ['string', 'boom'],
    ['null', null],
    ['undefined', undefined],
  ])('falls back to the generic key for %s', (_label, error) => {
    expect(staffMutationErrorKey('create', error)).toBe('createFailed');
    expect(staffMutationErrorKey('disable', error)).toBe('disableFailed');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter web exec vitest run lib/staff-console.test.ts`
Expected: FAIL — cannot resolve `./staff-console`.

- [ ] **Step 3: Write the implementation**

```ts
// apps/web/lib/staff-console.ts
import type { AdminScope, Role } from '@clensy/client';
import type { StaffErrorKey } from '@clensy/web';

// UX gate for the staff console. Branches on the explicit scope, never on
// tenantId === null (multi-tenant spec §3/§4.1). Not authorization — the API
// enforces Tenant-Owner-only, same-tenant access regardless (§4.2).
export function canManageStaff(admin: { role: Role; scope: AdminScope } | null | undefined): boolean {
  return admin?.scope === 'TENANT' && admin.role === 'TENANT_OWNER';
}

export type StaffMutation = 'create' | 'disable';

const ERROR_KEYS: Record<StaffMutation, Partial<Record<number, StaffErrorKey>> & { fallback: StaffErrorKey }> = {
  create: { 400: 'invalidInput', 403: 'createForbidden', 409: 'emailInUse', fallback: 'createFailed' },
  disable: { 403: 'disableForbidden', 404: 'accountNotFound', 409: 'lastTenantOwner', fallback: 'disableFailed' },
};

// Maps a failed staff mutation to a typed message key by operation + the
// GraphQL error's `extensions.status` (the HTTP status Nest attaches). Never
// inspects message text. Read structurally so any Apollo error shape (or a
// non-Apollo throw) degrades to the operation's generic key.
export function staffMutationErrorKey(operation: StaffMutation, error: unknown): StaffErrorKey {
  const keys = ERROR_KEYS[operation];
  const status = (error as { graphQLErrors?: { extensions?: { status?: unknown } }[] } | null | undefined)
    ?.graphQLErrors?.[0]?.extensions?.status;
  return (typeof status === 'number' && keys[status]) || keys.fallback;
}
```

- [ ] **Step 4: Run tests, lint, typecheck**

Run: `pnpm --filter web test && pnpm --filter web lint && pnpm --filter web exec tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/staff-console.ts apps/web/lib/staff-console.test.ts
git commit -m "feat(88): add scope-aware staff gate and status-based staff error-key mapper"
```

---

### Task 5: Rewire the staff admin page and its regression test

Traces: RFC §4.2, §4.3, §4.8 (routes compose, do not own domain implementations). Slice decisions 5–10.

**Files:**
- Modify: `apps/web/app/app/admin/page.tsx` (full rewrite of the component body; route path unchanged)
- Modify: `apps/web/lib/tenant-role-regressions.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4 (`StaffDataTable`, `CreateStaffForm`, `CreateStaffFormValues`, `StaffErrorKey`, `STAFF_ROLE_OPTIONS`, `ClensyI18nProvider`, `useClensyTranslations`, `canManageStaff`, `staffMutationErrorKey`).
- Produces: no new exports.

- [ ] **Step 1: Update the regression test to the new contract (fails first)**

Replace the first two `it(...)` blocks of `apps/web/lib/tenant-role-regressions.test.ts` (keep the `it.each` `'OWNER'` check unchanged):

```ts
import { STAFF_ROLE_OPTIONS } from '@clensy/web';
// …existing readWebSource helper…

describe('tenant role contract in the staff console', () => {
  it('gates the staff admin page on the scope-aware canManageStaff predicate', () => {
    const adminPage = readWebSource('app/app/admin/page.tsx');

    expect(adminPage).toContain('canManageStaff(');
    expect(adminPage).not.toMatch(/role === 'TENANT_OWNER'/);
    expect(adminPage).not.toMatch(/tenantId === null/);
  });

  it('offers operational roles and TENANT_OWNER on create, never SUPER_ADMIN', () => {
    expect([...STAFF_ROLE_OPTIONS].sort()).toEqual(
      ['ANALYST', 'CUSTOMER_SUPPORT', 'FINANCE', 'OPS_MANAGER', 'SCHEDULER', 'TENANT_OWNER'].sort(),
    );
  });

  it('composes the @clensy/web staff components instead of a page-local table', () => {
    const adminPage = readWebSource('app/app/admin/page.tsx');

    expect(adminPage).toContain('<StaffDataTable');
    expect(adminPage).toContain('<CreateStaffForm');
    expect(adminPage).not.toContain('DataTableColumn');
    expect(adminPage).not.toContain('ROLE_OPTIONS');
  });

  // …existing it.each OWNER check unchanged…
});
```

Run: `pnpm --filter web exec vitest run lib/tenant-role-regressions.test.ts`
Expected: FAIL — page still has `role === 'TENANT_OWNER'`, `ROLE_OPTIONS`, `DataTableColumn`, and no `canManageStaff(` / `<StaffDataTable`. (The `STAFF_ROLE_OPTIONS` case passes already.) If importing `@clensy/web` itself fails to resolve under `apps/web` Vitest, **stop and report** — do not copy the list into the test.

- [ ] **Step 2: Rewrite `apps/web/app/app/admin/page.tsx`**

```tsx
'use client';

import {
  useAdminsQuery,
  useCreateAdminMutation,
  useCurrentAdminQuery,
  useDisableAdminMutation,
} from '@clensy/client';
import { Button, ConfirmDialog, FormDialog, PageHeader } from '@clensy/ui';
import {
  ClensyI18nProvider,
  CreateStaffForm,
  StaffDataTable,
  useClensyTranslations,
  type CreateStaffFormValues,
  type StaffErrorKey,
  type StaffMember,
} from '@clensy/web';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { canManageStaff, staffMutationErrorKey } from '../../../lib/staff-console';

const EMPTY_FORM: CreateStaffFormValues = { email: '', password: '', role: 'CUSTOMER_SUPPORT' };

// Staff copy (page, table, form, errors) comes from @clensy/web's `staff`
// namespace, as LoginForm owns its copy; this route only composes, wires
// GraphQL and routes (multi-tenant spec §4.8).
export default function AdminPage() {
  const locale = useLocale();
  return (
    <ClensyI18nProvider locale={locale}>
      <StaffAdminGate />
    </ClensyI18nProvider>
  );
}

// Spec §4.1 (Admin Foundation): `middleware.ts` only checks that the session
// cookie is present, not that it's still valid — an expired, invalid, or
// disabled-account session lands here, where the guarded `currentAdmin`
// surfaces it as an error (or a missing `currentAdmin`) and we send the user
// back to `/login`. `canManageStaff` is a UX nicety only — the API
// independently enforces Tenant-Owner-only, same-tenant access on
// `admins`/`createAdmin`/`disableAdmin` (multi-tenant spec §4.2).
function StaffAdminGate() {
  const t = useClensyTranslations('staff');
  const router = useRouter();
  const { data, loading, error } = useCurrentAdminQuery({ fetchPolicy: 'network-only' });
  const currentAdmin = data?.currentAdmin;

  useEffect(() => {
    if (!loading && (error || !currentAdmin)) {
      router.replace('/login');
    }
  }, [loading, error, currentAdmin, router]);

  if (loading) {
    return <p className="text-sm text-slate-500">{t('page.loading')}</p>;
  }

  if (error || !currentAdmin) {
    // Redirect already dispatched in the effect above.
    return null;
  }

  if (!canManageStaff(currentAdmin)) {
    return <p className="text-sm text-slate-700">{t('page.notAuthorized')}</p>;
  }

  return <StaffConsole currentAdminId={currentAdmin.id} />;
}

function StaffConsole({ currentAdminId }: { currentAdminId: string }) {
  const t = useClensyTranslations('staff');
  const { data, loading, error, refetch } = useAdminsQuery({ fetchPolicy: 'network-only' });
  const [createAdmin, { loading: creating }] = useCreateAdminMutation();
  const [disableAdmin, { loading: disabling }] = useDisableAdminMutation();

  const [formOpen, setFormOpen] = useState(false);
  const [formValues, setFormValues] = useState<CreateStaffFormValues>(EMPTY_FORM);
  const [formErrorKey, setFormErrorKey] = useState<StaffErrorKey | undefined>(undefined);

  // `ConfirmDialog` is open whenever `confirmTarget` is set.
  const [confirmTarget, setConfirmTarget] = useState<StaffMember | undefined>(undefined);
  const [disableErrorKey, setDisableErrorKey] = useState<StaffErrorKey | undefined>(undefined);

  function openCreateForm() {
    setFormValues(EMPTY_FORM);
    setFormErrorKey(undefined);
    setFormOpen(true);
  }

  async function handleCreateSubmit() {
    setFormErrorKey(undefined);
    try {
      await createAdmin({ variables: { createAdminInput: formValues } });
      setFormOpen(false);
      setFormValues(EMPTY_FORM);
      await refetch();
    } catch (createError) {
      // Dialog stays open so the owner can correct the input.
      setFormErrorKey(staffMutationErrorKey('create', createError));
    }
  }

  async function handleConfirmDisable() {
    if (!confirmTarget) return;
    setDisableErrorKey(undefined);
    try {
      await disableAdmin({ variables: { id: confirmTarget.id } });
      await refetch();
    } catch (disableError) {
      // `ConfirmDialog` has no error slot, so the dialog closes and the
      // failure shows inline on the page below it.
      const key = staffMutationErrorKey('disable', disableError);
      setDisableErrorKey(key);
      // The row is gone (or was never this tenant's — spec §4.5): refresh so
      // the list stops offering it.
      if (key === 'accountNotFound') await refetch();
    } finally {
      setConfirmTarget(undefined);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title={t('page.title')}
        actions={
          <Button type="button" onClick={openCreateForm}>
            {t('page.newAccount')}
          </Button>
        }
      />

      <StaffDataTable
        staff={data?.admins ?? []}
        currentAdminId={currentAdminId}
        loading={loading}
        hasError={Boolean(error)}
        disabling={disabling}
        onDisable={(member) => {
          setDisableErrorKey(undefined);
          setConfirmTarget(member);
        }}
      />

      <FormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={t('form.title')}
        onSubmit={handleCreateSubmit}
        submitLabel={creating ? t('form.creating') : t('form.submit')}
        submitting={creating}
      >
        <CreateStaffForm values={formValues} onChange={setFormValues} errorKey={formErrorKey} />
      </FormDialog>

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        onClose={() => {
          setConfirmTarget(undefined);
          setDisableErrorKey(undefined);
        }}
        onConfirm={handleConfirmDisable}
        title={t('confirmDisable.title')}
        // `t` has no interpolation; {email} is the only placeholder.
        description={confirmTarget ? t('confirmDisable.description').replace('{email}', confirmTarget.email) : ''}
        confirmLabel={t('confirmDisable.confirm')}
        confirming={disabling}
      />
      {disableErrorKey ? (
        <p role="alert" className="text-sm text-red-600">
          {t(`errors.${disableErrorKey}`)}
        </p>
      ) : null}
    </div>
  );
}
```

Type notes: `data.admins` rows (`Role` union) are assignable to `StaffMember` (`role: string` + index signature). `formValues.role` (`StaffRole`) is assignable to the client `Role`. If `useCurrentAdminQuery`'s `currentAdmin` type does not satisfy `canManageStaff`'s parameter, fix the parameter type in `staff-console.ts` to match the generated type — do not cast at the call site.

- [ ] **Step 3: Run tests, lint, typecheck**

Run: `pnpm --filter web test && pnpm --filter web lint && pnpm --filter web exec tsc --noEmit && pnpm --filter @clensy/web test`
Expected: PASS, including `tenant-role-regressions.test.ts` (all cases) and `web-shell-regressions.test.ts` unchanged.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/app/admin/page.tsx apps/web/lib/tenant-role-regressions.test.ts
git commit -m "feat(88): compose @clensy/web staff components with scope-aware gate and mapped errors"
```

---

### Task 6: Slice verification

Traces: whole slice; RFC §4.8 ("a resource is not migrated until … this presentation boundary hold[s]").

TDD does not apply to this task; it is the verification gate for M6 handoff.

- [ ] **Step 1: Full mechanical checks**

Run: `pnpm lint && pnpm test && pnpm --filter @clensy/web build && pnpm --filter web exec tsc --noEmit && pnpm --filter web build`
Expected: all PASS. Record each command's result in the M6 Slice Completion Report Validation table.

- [ ] **Step 2: Boundary greps**

```bash
git diff --stat main -- apps/api packages/client packages/ui apps/web/lib/role-presentation.ts apps/web/components apps/web/lib/nav-groups.ts
grep -rnE "(^|[^_])'OWNER'" apps/web/app apps/web/lib packages/web/src
grep -rn "@clensy/client" packages/web/src
```
Expected: first command prints nothing (untouched boundaries); second and third print nothing.

- [ ] **Step 3: Manual browser pass** (API + web against the seeded bootstrap tenant, signed in as the seeded Tenant Owner)

1. `/app/admin` shows "Staff Accounts"; own row shows the **Tenant Owner** badge and **no** Disable.
2. Create a `FINANCE` account → row appears labelled "Finance", Active, with Disable.
3. Create again with the same email → dialog stays open with "An account with this email already exists."
4. Select Tenant Owner in the form → the hint appears; the Staff group lists five roles; no Super Admin.
5. Last-owner protection: create a second Tenant Owner; its row shows the badge and **Disable**; disable it → succeeds and shows Disabled. The only remaining active owner is the signed-in admin, whose row offers no Disable — so the 409 `lastTenantOwner` path is not reachable from a single session by design (only via a concurrent second session). Record this as expected; the 409 → `lastTenantOwner` mapping is pinned by Task 4, and the API behaviour by `apps/api/test/admins.service.e2e-spec.ts` / `admins.service.disable-concurrency.e2e-spec.ts`.
6. Sign in as a non-owner (e.g. the new `FINANCE` account) → "You are not authorized to view this page."

Record outcomes (and any screenshots) in the M6 report. Any deviation → stop and report.

- [ ] **Step 4: Commit** only if Steps 1–3 required fixes (each fix gets its own `fix(88): …` commit with the test that pins it).

---

## Traceability

| RFC section | Tasks |
| --- | --- |
| §3 Terminology (Tenant Owner vs Staff; scope explicit) | 1, 2, 3, 4 |
| §4.1 Scope not inferred from `tenantId` | 4, 5 |
| §4.2 / §5.13 UI is not authorization | 4, 5 (comments + API untouched) |
| §4.3 Role set; no `SUPER_ADMIN` creation; self-disable; last Tenant Owner | 1, 2, 3, 4 |
| §4.5 Cross-tenant → not found | 4 (`accountNotFound` + refetch) |
| §4.8 Presentation boundary | 2, 3, 5, 6 |
| §10 Deferrals (role/email update; shell visibility) | Global Constraints |

## Explicit deferrals / out of scope

- Tenant name / `currentAdmin.tenant` display — #89.
- Shell, nav, user-menu role presentation, and consolidating `role-presentation.ts` onto `@clensy/web` labels — #89.
- Role-update / email-update for staff — RFC §10.
- Super Admin UX and any platform-scope console — RFC §2 out of scope.
- A `ConfirmDialog` error slot or a grouped-select `@clensy/ui` primitive — `@clensy/ui` scope, not needed here.
- Interpolation support in `useClensyTranslations` — single `{email}` placeholder handled locally.

## Execution risks

- **`@clensy/web` import under `apps/web` Vitest (Task 5 Step 1).** The bookings page already imports `@clensy/web` at build time, but no existing `apps/web` test imports it. If resolution fails, stop and report rather than duplicating the role list.
- **Manual last-owner path (Task 6 Step 5)** is not reachable from a single UI session by design; its coverage is the Task 4 unit mapping plus the existing API e2e for the 409.
