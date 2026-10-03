# Tenant-Sourced Role Label Overrides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Draft (revised after the first M5 pass) |
| M5 history | First pass (2026-10-04) requested changes without architectural redesign, all applied. MUST: validator treats only `null` as a NULL column (Task 1); the migration test counts rows before `up()` and checks its own inserted row, with no bootstrap assumption (Task 2); e2e warning expectations are explicit `(path, reason)` tuples, and redaction checks the exact rejected values (Task 3); the mapper accepts `null` (Task 7); the Phase 8 RED check backs up and restores the file byte for byte, never `git checkout --` (Task 4); Phase 8 stores more tenant-specific labels (Task 4); the schema test owns only the new field (Task 3); the provider is pinned to the default cache-first, data-only `useCurrentAdminQuery()` (Task 9). SHOULD: the mapper indexes the typed `roles` directly (Task 7); the Task 9 provider assertions pin the provider's actual invariants (Task 9); the service follows the module's `@InjectRepository` read pattern, verified (Task 3, decision 2); "exactly" is reworded as "only retained shape" (Global Constraints). Also: the isolation test probes two role paths and checks the static layer is not mutated (Task 8); the e2e commands follow the verified pattern-forwarding convention (Environment prerequisites, Final verification); the `implements` comment is corrected (Task 3). |
| Date | 2026-10-03 |
| Tracking issue | [#118](https://github.com/rexescario-dev/clensy-platform/issues/118) |
| Scope | `apps/api` (domain, application, persistence, GraphQL, migration, tests, generated `schema.gql`), `packages/client` (one operation document and generated code), `packages/web` (one additive export and its test), `apps/web` (mapper, `AppI18nProvider`, tests, one dev dependency). |
| Implements (Accepted) | [Tenant-Sourced Role Label Overrides — Design](../specs/2026-10-03-tenant-label-overrides-design.md), Status **Accepted** (M3, 2026-10-03, `f78c36a`) |
| Relies on (Accepted) | [Single App-Level `ClensyI18nProvider`](../specs/2026-10-02-single-app-i18n-provider-design.md), as amended by the spec above (§4.6); [Multi-Tenant Architecture](../specs/2026-09-23-multi-tenant-architecture-design.md); [App Router i18n Architecture](../specs/2026-09-13-web-i18n-architecture-design.md) |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. File layout, task grouping, order, helper names and test names below are planning decisions, not product semantics. |
| Edit anchors | Every edit is located by the **quoted code**, not by line number. Line numbers, where given, are approximate, taken from the branch at `c2d5009`. |

**Goal:** Deliver spec §4.1–§4.7: a validated, tenant-scoped `CurrentAdmin.tenantLabelOverrides` field that `AppI18nProvider` layers over `APP_I18N_OVERRIDES`.

**Architecture:**

- **Storage and validation (API).** Raw `jsonb` on `TenantEntity` (`select: false`) is read by exactly one service method. That method passes the value through a pure validator and logs each rejection.
- **GraphQL.** A field resolver on `CurrentAdmin` maps the kept labels to a typed, roles-only, `en`-only object.
- **Web.** The `CurrentAdmin` operation selects the field. A data-only mapper turns it into a `DeepPartial<ClensyMessages>`, and `AppI18nProvider` composes `deepMerge(APP_I18N_OVERRIDES, tenantLayer)`.

**Tech Stack:** NestJS 11 + `@nestjs/graphql` code-first, TypeORM 1.x / PostgreSQL `jsonb`, Jest (API unit + e2e), GraphQL Code Generator, Next.js App Router + next-intl, Apollo Client 3, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-03-tenant-label-overrides-design.md`

## Global Constraints

Copied from the Accepted spec. Every task's requirements implicitly include this section.

- Retained shape: only `{ "en": { "roles": { <Role>: <string> } } }` survives. Every other node or leaf is rejected and dropped **individually**; it is never preserved, and it does not invalidate valid siblings (§4.1, §4.2, §4.7 item 4).
- Relabelable roles: `Role` minus `SUPER_ADMIN`, **derived** from the enum. The six names are not written a second time in validation logic (§4.2).
- Leaf rule: string; trimmed; 1–64 **Unicode code points**; no control characters, including `\r` and `\n`. A kept value is returned **trimmed** (§4.2).
- *Object* means a non-null, non-array JSON object with string keys. Never rely on `typeof value === 'object'` alone (§4.2).
- Each rejected node or leaf is logged **once**, at warning level, at its own path (`$` for the top level), with tenant id and reason, **never the value**. Nothing beneath a rejected node is logged. A `NULL` column (`null`) is not logged. `undefined` is not a database value and gets no special case; the service normalizes a missing row to `null` (§4.2, §4.7 item 6).
- One application-service method is the only application code that reads `TenantEntity.labelOverrides`. The resolver never reads the column or `TenantEntity` (§4.2, §4.7 item 3).
- `CurrentAdmin.tenantLabelOverrides: TenantLabelOverrides` is nullable and takes **no arguments**. It is `null` for `PLATFORM` scope and when nothing is kept. `locale` is always `"en"` (§4.3).
- No new root query or mutation; the root-operation inventory does not change (§4.3).
- `@clensy/web` change: only the additive `deepMerge` export (§4.5, §4.6 item 8).
- The web mapper receives `currentAdmin` data only, never `loading`/`error`. It returns `{}` on absent data or a locale mismatch, never forwards `null`, and does not revalidate (§4.4).
- Composition: `deepMerge(APP_I18N_OVERRIDES, tenantLayer)`, memoized on `[tenantLabelOverrides, locale]`. `AppI18nProvider` stays children-only and never blocks rendering (§4.5).
- Session transitions: confirm the server-side change, then `clearStore()`, then navigate (§4.5, §4.7 item 9).
- Not in this plan: any write path, other namespaces, other locales, a locale argument, a tenants API, per-user overrides (§7, §8).

## Review Focus

Inputs and conditions the spec implies but does not list as test cases, most likely first. Each one is pinned by a test in the task named.

1. **A label with a leading or trailing newline** (`"Billing\n"`). The spec validates the *trimmed* value, so trimming removes the newline and the label is kept as `"Billing"`. Only an *interior* control character is rejected. → Task 1, Step 1 (`trims surrounding newlines before checking control characters`).
2. **Apollo's runtime `__typename` inside `roles`.** `InMemoryCache` adds `__typename: 'RoleLabelOverrides'` to the object. It must not be forwarded as a message key. → Task 7, Step 1 (`ignores __typename and any non-role key`).
3. **An empty or partial shape** (`{}`, `{ en: {} }`, `{ en: { roles: {} } }`). Nothing is rejected, so nothing is logged, and the field is `null`. → Task 1, Step 1 (`returns none without rejections for empty shapes`).
4. **The `login` mutation's `admin` result is also a `CurrentAdmin`.** Selecting the field there must resolve the just-verified principal's own tenant labels and nothing else. → Task 3, Step 1 (e2e `resolves the same tenant labels on the login result`).
5. **A next-intl locale other than `en`** reaching the boundary while the API returns `locale: "en"`. The tenant layer must not apply. → Task 8, Step 1 (`does not apply en tenant labels under another locale`).

---

## Ownership boundaries

| Area | Owns in this plan | Must stay untouched |
| --- | --- | --- |
| `apps/api/src/modules/admins` | validator (domain), `TenantLabelOverridesService`, GraphQL types, field resolver, module registration, `TenantEntity` column | `AdminResolver`, `AdminsService`, `LoginService`, the `Tenant` domain interface |
| `apps/api/src/platform/database/migrations` | `1790870400000-AddTenantLabelOverrides.ts` | every existing migration |
| `apps/api/test` | migration e2e, standalone label-overrides e2e, release-gate Phase 8 | `root-operation-inventory.ts`, other gate phases, helpers |
| `packages/client` | `current-admin.graphql`, regenerated `src/generated/graphql.ts` | `apollo-client.ts`, codegen config |
| `packages/web` | one export line in `src/index.ts`, one test in `deep-merge.test.ts` | `deepMerge` behavior, provider, catalogs |
| `apps/web` | `lib/tenant-label-overrides.ts`, `components/layout/app-i18n-provider.tsx`, two new test files, additions to `web-shell-regressions.test.ts`, `jsdom` dev dependency | `clensy-i18n-overrides.ts` (stays `{}`), `app-i18n-boundary.test.tsx`, `/login`, `user-menu.tsx`, the §6.1 AST guard rules |

## Planning decisions for M5 to judge

These are planning choices, not product semantics. They are listed here so M5 can accept or reject them explicitly.

1. **Logging sits at the service, not in the validator.** Spec §4.2 calls the validator a "pure domain function" that "logs each node or leaf it rejects". Logging is a side effect, and the repository conventions keep pure helpers pure. So the validator returns its rejections (`{ path, reason }`, never a value), and `TenantLabelOverridesService` writes exactly one warning per rejection. The observable behavior is the same: one warning per rejected node or leaf, at its own path, without the value. The log tests sit at the e2e level (Task 3), and the one-per-node and path tests sit at the validator level (Task 1).
2. **`labelOverrides` is declared with `select: false`, and the service injects `Repository<TenantEntity>`.** An ordinary `TenantEntity` load then never reads the column. Only the service's explicit `addSelect` does. This enforces invariant 3 mechanically. Verified against the existing pattern: `admins` read services inject TypeORM repositories with `@InjectRepository` (`LoginService`, `AdminIdentityLookupService`), and `DataSource` is used only where a transaction is needed (`AdminsService`). `TenantEntity` is already in `AdminsModule`'s `TypeOrmModule.forFeature`. No new repository abstraction is introduced.
3. **The field resolver reads the tenant from its parent `CurrentAdmin`, not from `@CurrentUser()`.** `login` also returns a `CurrentAdmin` and has no `AuthGuard`, so there is no request principal there. Every `CurrentAdmin` value is built only by `toCurrentAdminType(principal)`, from the guarded `currentAdmin` or from the credential-verified `login`. So `parent.tenantId` is the principal's tenant, and the field still takes no input (§4.3, §4.7 item 1).
4. **Cross-tenant isolation runs as release-gate Phase 8.** CI runs only `test:e2e:release-gate` among the e2e suites. Spec §6.1 names the two-tenant release gate as the natural home, and putting it there gives the isolation test CI coverage. The malformed-shape, logging and login cases go in a standalone e2e file, which runs locally like every other non-gate e2e suite here.
5. **`jsdom` becomes a dev dependency of `apps/web` only**, enabled per file with `// @vitest-environment jsdom`. Spec §6.2 requires one *mounted* boundary whose query result changes between steps, and the workspace has no DOM test environment. React's own `createRoot` and `act` are used; Testing Library is not added. All other tests stay on `environment: 'node'`.
6. **In the isolation test, step 4 (the static layer) runs on a fresh mount, and the probe renders two role paths (`FINANCE|SCHEDULER`).** In production `APP_I18N_OVERRIDES` is a module constant and cannot change under a mounted boundary, and steps 1–3 need it to be `{}` so step 3 can show the package default. Steps 1–3 share one mounted root.
7. **The mapper takes the `tenantLabelOverrides` value, not the whole `currentAdmin`.** It is named `tenantLayer(overrides, locale)` and accepts `null | undefined`. This keeps the `useMemo` dependency list exactly `[tenantLabelOverrides, locale]` (§4.5) and remains data-only (§4.4). It iterates `STAFF_ROLE_OPTIONS` (the six tenant roles `@clensy/web` already exports) and indexes the generated, typed `roles` object directly. Apollo's runtime `__typename` is never visited, without any widening cast or value validation.

## File map

| File | Create / Modify | Responsibility |
| --- | --- | --- |
| `apps/api/src/modules/admins/domain/tenant-label-overrides.ts` | Create | Pure validator, relabelable roles, `TENANT_LABEL_LOCALE` |
| `apps/api/src/modules/admins/tests/domain/tenant-label-overrides.spec.ts` | Create | Validator and drift unit tests |
| `apps/api/src/platform/database/migrations/1790870400000-AddTenantLabelOverrides.ts` | Create | Add / drop the nullable `jsonb` column |
| `apps/api/src/modules/admins/infrastructure/persistence/tenant.entity.ts` | Modify | `labelOverrides` column, `select: false` |
| `apps/api/test/add-tenant-label-overrides.migration.e2e-spec.ts` | Create | Migration up/down on a throwaway database |
| `apps/api/src/modules/admins/application/services/tenant-label-overrides.service.ts` | Create | The only reader of the column; logs rejections |
| `apps/api/src/modules/admins/presentation/graphql/tenant-label-overrides.type.ts` | Create | `TenantLabelOverrides`, `RoleLabelOverrides` object types |
| `apps/api/src/modules/admins/presentation/graphql/current-admin-label-overrides.resolver.ts` | Create | `@ResolveField` on `CurrentAdmin` |
| `apps/api/src/modules/admins/admins.module.ts` | Modify | Register service and resolver |
| `apps/api/src/modules/admins/tests/graphql/current-admin-label-overrides.resolver.spec.ts` | Create | Schema shape, drift, no-args, resolver behavior |
| `apps/api/test/tenant-label-overrides.e2e-spec.ts` | Create | NULL / malformed / mixed / logging / login cases |
| `apps/api/src/schema.gql` | Regenerated | By booting `AppModule` (e2e run) |
| `apps/api/test/two-tenant-release-gate.e2e-spec.ts` | Modify | Phase 8 |
| `packages/client/src/operations/current-admin.graphql` | Modify | Select the new field |
| `packages/client/src/generated/graphql.ts` | Regenerated | Codegen |
| `packages/web/src/index.ts` | Modify | Export `deepMerge` |
| `packages/web/src/i18n/deep-merge.test.ts` | Modify | Same-function export test |
| `apps/web/lib/tenant-label-overrides.ts` | Create | `tenantLayer(overrides, locale)` mapper |
| `apps/web/lib/tenant-label-overrides.test.ts` | Create | Mapper unit tests |
| `apps/web/components/layout/app-i18n-provider.tsx` | Modify | Compose the tenant layer |
| `apps/web/lib/app-i18n-tenant-overrides.test.tsx` | Create | Static-render behavioral tests |
| `apps/web/lib/app-i18n-tenant-isolation.test.tsx` | Create | Mounted (jsdom) isolation test |
| `apps/web/package.json`, `pnpm-lock.yaml` | Modify | `jsdom` dev dependency |
| `apps/web/lib/web-shell-regressions.test.ts` | Modify | Session-transition order, children-only provider |

## Environment prerequisites (M6)

- Work happens in the #118 worktree, `/home/rex/Project/clensy-platform/.claude/worktrees/feat+118-tenant-label-overrides`, never in the shared main checkout. Run `pnpm install --frozen-lockfile` there once before Task 1 (a new worktree has no `node_modules`).
- Command convention: `pnpm --filter <pkg> test -- <patterns>` and `pnpm --filter api test:e2e -- <patterns>` forward a literal `--`, so Jest treats **everything** after it as test-path patterns (several are ORed). Verified during M5 review. Never put a Jest option after `--`. Where an option is needed (`-t`), call `pnpm --filter api exec jest …` directly.

- PostgreSQL reachable with the defaults in `apps/api/test/helpers/migration-db.ts` (`localhost:5432`, `clensy` / `clensy_dev`). In this workspace, the `clensy-platform-postgres-1` container provides it.
- Before any e2e run against the `clensy` database (Tasks 3 and 4): `pnpm --filter api migration:run`. The migration e2e (Task 2) uses its own throwaway database and does not need it.

---

### Task 1: Read-time validator (spec §4.2)

**Files:**
- Create: `apps/api/src/modules/admins/domain/tenant-label-overrides.ts`
- Test: `apps/api/src/modules/admins/tests/domain/tenant-label-overrides.spec.ts`

**Interfaces:**
- Consumes: `Role` from `apps/api/src/platform/auth/domain/role.ts`.
- Produces (used by Tasks 3 and 4):
  - `type RelabelableRole = Exclude<Role, Role.SUPER_ADMIN>`
  - `type RoleLabels = Readonly<Partial<Record<RelabelableRole, string>>>`
  - `type LabelOverrideRejectionReason = 'blank' | 'control-character' | 'not-a-string' | 'not-an-object' | 'too-long' | 'unknown-key'`
  - `interface LabelOverrideRejection { path: string; reason: LabelOverrideRejectionReason }`
  - `interface LabelOverrideValidation { labels: RoleLabels | null; rejections: readonly LabelOverrideRejection[] }`
  - `const RELABELABLE_ROLES: readonly RelabelableRole[]`
  - `const MAX_LABEL_CODE_POINTS = 64`
  - `const TENANT_LABEL_LOCALE = 'en'`
  - `function validateTenantLabelOverrides(raw: unknown): LabelOverrideValidation`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/modules/admins/tests/domain/tenant-label-overrides.spec.ts`:

```ts
import { Role } from '../../../../platform/auth/domain/role';
import {
  MAX_LABEL_CODE_POINTS,
  RELABELABLE_ROLES,
  validateTenantLabelOverrides,
} from '../../domain/tenant-label-overrides';

const roles = (value: unknown) => ({ en: { roles: value } });

describe('validateTenantLabelOverrides (spec §4.2)', () => {
  describe('relabelable roles (drift)', () => {
    it('equals Role minus SUPER_ADMIN', () => {
      expect([...RELABELABLE_ROLES].sort()).toEqual(
        Object.values(Role)
          .filter((role) => role !== Role.SUPER_ADMIN)
          .sort(),
      );
      expect(MAX_LABEL_CODE_POINTS).toBe(64);
    });
  });

  describe('kept leaves', () => {
    it('keeps a valid leaf and returns it trimmed', () => {
      expect(
        validateTenantLabelOverrides(roles({ FINANCE: '  Billing  ' })),
      ).toEqual({ labels: { FINANCE: 'Billing' }, rejections: [] });
    });

    it('trims surrounding newlines before checking control characters', () => {
      expect(
        validateTenantLabelOverrides(roles({ FINANCE: '\nBilling\r\n' })),
      ).toEqual({ labels: { FINANCE: 'Billing' }, rejections: [] });
    });

    it('accepts exactly 64 code points and counts a non-BMP character as one', () => {
      const emoji = '\u{1F9FE}'; // two UTF-16 code units, one code point
      expect(emoji.length).toBe(2);
      const label = emoji.repeat(64);
      expect(validateTenantLabelOverrides(roles({ FINANCE: label }))).toEqual(
        { labels: { FINANCE: label }, rejections: [] },
      );
      expect(
        validateTenantLabelOverrides(roles({ FINANCE: 'a'.repeat(64) })).labels,
      ).toEqual({ FINANCE: 'a'.repeat(64) });
    });
  });

  describe('rejected leaves', () => {
    it.each([
      ['65 code points', 'a'.repeat(65), 'too-long'],
      ['65 non-BMP code points', '\u{1F9FE}'.repeat(65), 'too-long'],
      ['an empty string', '', 'blank'],
      ['whitespace only', ' \t \n ', 'blank'],
      ['an interior newline', 'Bill\ning', 'control-character'],
      ['an interior carriage return', 'Bill\ring', 'control-character'],
      ['another control character', 'Bill\u0007ing', 'control-character'],
      ['a leading NUL (not whitespace, so not trimmed)', '\u0000Billing', 'control-character'],
      ['a number', 42, 'not-a-string'],
      ['a boolean', true, 'not-a-string'],
      ['null', null, 'not-a-string'],
      ['an object', { text: 'Billing' }, 'not-a-string'],
    ])('drops %s', (_label, value, reason) => {
      expect(validateTenantLabelOverrides(roles({ FINANCE: value }))).toEqual({
        labels: null,
        rejections: [{ path: 'en.roles.FINANCE', reason }],
      });
    });

    it('drops SUPER_ADMIN and unknown role keys as unknown-key', () => {
      expect(
        validateTenantLabelOverrides(
          roles({ NOT_A_ROLE: 'x', SUPER_ADMIN: 'Root' }),
        ),
      ).toEqual({
        labels: null,
        rejections: [
          { path: 'en.roles.NOT_A_ROLE', reason: 'unknown-key' },
          { path: 'en.roles.SUPER_ADMIN', reason: 'unknown-key' },
        ],
      });
    });
  });

  describe('structure', () => {
    it.each([
      ['null', null],
      ['an array', ['Billing']],
      ['a string', 'Billing'],
      ['a number', 7],
      ['a boolean', false],
    ])('rejects %s at each level as not-an-object, once, without descending', (_label, value) => {
      if (value !== null) {
        expect(validateTenantLabelOverrides(value)).toEqual({
          labels: null,
          rejections: [{ path: '$', reason: 'not-an-object' }],
        });
      }
      expect(validateTenantLabelOverrides({ en: value })).toEqual({
        labels: null,
        rejections: [{ path: 'en', reason: 'not-an-object' }],
      });
      expect(validateTenantLabelOverrides(roles(value))).toEqual({
        labels: null,
        rejections: [{ path: 'en.roles', reason: 'not-an-object' }],
      });
    });

    it('reports one rejection for a roles array of many items', () => {
      const result = validateTenantLabelOverrides(
        roles(Array.from({ length: 100 }, () => 'Billing')),
      );
      expect(result.rejections).toEqual([
        { path: 'en.roles', reason: 'not-an-object' },
      ]);
    });

    it('drops unknown locales and unknown namespaces at their own path', () => {
      expect(
        validateTenantLabelOverrides({
          en: { roles: { FINANCE: 'Billing' }, staff: { title: 'Team' } },
          fr: { roles: { FINANCE: 'Facturation' } },
        }),
      ).toEqual({
        labels: { FINANCE: 'Billing' },
        rejections: [
          { path: 'fr', reason: 'unknown-key' },
          { path: 'en.staff', reason: 'unknown-key' },
        ],
      });
    });

    it('returns none without rejections for a NULL column and for empty shapes', () => {
      for (const raw of [null, {}, { en: {} }, roles({})]) {
        expect(validateTenantLabelOverrides(raw)).toEqual({
          labels: null,
          rejections: [],
        });
      }
    });

    it('returns none when every leaf is invalid', () => {
      const result = validateTenantLabelOverrides(
        roles({ ANALYST: '', FINANCE: 42 }),
      );
      expect(result.labels).toBeNull();
      expect(result.rejections).toHaveLength(2);
    });
  });

  it('never puts a stored value into a rejection', () => {
    const { rejections } = validateTenantLabelOverrides({
      en: {
        roles: { ANALYST: 'Secret\nLabel', SUPER_ADMIN: 'Root-Label' },
        staff: 'Team-Label',
      },
      fr: 'Facturation',
    });
    const serialized = JSON.stringify(rejections);
    for (const value of ['Secret', 'Root-Label', 'Team-Label', 'Facturation']) {
      expect(serialized).not.toContain(value);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter api test -- tenant-label-overrides`
Expected: FAIL. `Cannot find module '../../domain/tenant-label-overrides'`.

- [ ] **Step 3: Write the minimal implementation**

Create `apps/api/src/modules/admins/domain/tenant-label-overrides.ts`:

```ts
import { Role } from '../../../platform/auth/domain/role';

// Tenant label overrides spec §4.1, §4.2. Pure: returns the kept labels and
// every rejection (path + reason, never the stored value).
// TenantLabelOverridesService, the only reader of the column, owns logging.

export type RelabelableRole = Exclude<Role, Role.SUPER_ADMIN>;

export type RoleLabels = Readonly<Partial<Record<RelabelableRole, string>>>;

export type LabelOverrideRejectionReason =
  | 'blank'
  | 'control-character'
  | 'not-a-string'
  | 'not-an-object'
  | 'too-long'
  | 'unknown-key';

export interface LabelOverrideRejection {
  path: string;
  reason: LabelOverrideRejectionReason;
}

export interface LabelOverrideValidation {
  labels: RoleLabels | null;
  rejections: readonly LabelOverrideRejection[];
}

type JsonObject = Readonly<Record<string, unknown>>;

// Derived from the enum, never listed (§4.2): a new Role joins this set and
// fails the drift test until someone decides whether tenants may relabel it.
// SUPER_ADMIN is a platform identity, not tenant staff.
export const RELABELABLE_ROLES: readonly RelabelableRole[] = Object.values(
  Role,
).filter((role): role is RelabelableRole => role !== Role.SUPER_ADMIN);

export const MAX_LABEL_CODE_POINTS = 64;

// The only supported locale. Also the `locale` the GraphQL field reports.
export const TENANT_LABEL_LOCALE = 'en';

const SUPPORTED_NAMESPACE = 'roles';
const CONTROL_CHARACTER = /\p{Cc}/u;

export function validateTenantLabelOverrides(
  raw: unknown,
): LabelOverrideValidation {
  const rejections: LabelOverrideRejection[] = [];
  const roles = rolesNode(raw, rejections);
  const labels: Partial<Record<RelabelableRole, string>> = {};
  for (const [key, value] of Object.entries(roles ?? {})) {
    const path = `${TENANT_LABEL_LOCALE}.${SUPPORTED_NAMESPACE}.${key}`;
    if (!isRelabelableRole(key)) {
      rejections.push({ path, reason: 'unknown-key' });
      continue;
    }
    const checked = checkLabel(value);
    if ('label' in checked) {
      labels[key] = checked.label;
    } else {
      rejections.push({ path, reason: checked.reason });
    }
  }
  return {
    labels: Object.keys(labels).length > 0 ? labels : null,
    rejections,
  };
}

function checkLabel(
  value: unknown,
): { label: string } | { reason: LabelOverrideRejectionReason } {
  if (typeof value !== 'string') return { reason: 'not-a-string' };
  const label = value.trim();
  if (label.length === 0) return { reason: 'blank' };
  // Code points, not UTF-16 code units: a non-BMP character counts as one.
  if ([...label].length > MAX_LABEL_CODE_POINTS) return { reason: 'too-long' };
  if (CONTROL_CHARACTER.test(label)) return { reason: 'control-character' };
  return { label };
}

// An object is a non-null, non-array JSON object (§4.2); `typeof` alone is
// also true of null and arrays.
function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRelabelableRole(key: string): key is RelabelableRole {
  return (RELABELABLE_ROLES as readonly string[]).includes(key);
}

// Rejects every key of `node` other than `key` as unknown, then returns
// `node[key]` if it is an object. A missing key is absence, not a rejection.
// A rejected node is never descended into, so nothing beneath it is reported.
function onlyChild(
  node: JsonObject,
  key: string,
  prefix: string,
  rejections: LabelOverrideRejection[],
): JsonObject | null {
  for (const other of Object.keys(node)) {
    if (other !== key) {
      rejections.push({ path: `${prefix}${other}`, reason: 'unknown-key' });
    }
  }
  if (!Object.hasOwn(node, key)) return null;
  const child = node[key];
  if (!isJsonObject(child)) {
    rejections.push({ path: `${prefix}${key}`, reason: 'not-an-object' });
    return null;
  }
  return child;
}

// A NULL column (`null`) is "no overrides", not a rejection. `undefined` is
// not a database value: it falls through and is rejected as not-an-object.
// The service normalizes a missing row to `null`.
function rolesNode(
  raw: unknown,
  rejections: LabelOverrideRejection[],
): JsonObject | null {
  if (raw === null) return null;
  if (!isJsonObject(raw)) {
    rejections.push({ path: '$', reason: 'not-an-object' });
    return null;
  }
  const locale = onlyChild(raw, TENANT_LABEL_LOCALE, '', rejections);
  if (!locale) return null;
  return onlyChild(
    locale,
    SUPPORTED_NAMESPACE,
    `${TENANT_LABEL_LOCALE}.`,
    rejections,
  );
}
```

Note on the expected rejection order in Step 1's `drops unknown locales and unknown namespaces` test: `onlyChild` reports a level's unknown keys before descending, so `fr` (top level) comes before `en.staff`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter api test -- tenant-label-overrides`
Expected: PASS, all cases.

- [ ] **Step 5: Lint and commit**

Run: `pnpm --filter api exec eslint src/modules/admins/domain/tenant-label-overrides.ts src/modules/admins/tests/domain/tenant-label-overrides.spec.ts`
Expected: no errors. If `contextforge/function-order` or `record-key-order` reports, reorder declarations only, without changing behavior.

```bash
git add apps/api/src/modules/admins/domain/tenant-label-overrides.ts apps/api/src/modules/admins/tests/domain/tenant-label-overrides.spec.ts
git commit -m "feat(118): add the tenant label overrides read-time validator"
```

---

### Task 2: Storage column and migration (spec §4.1)

**Files:**
- Create: `apps/api/src/platform/database/migrations/1790870400000-AddTenantLabelOverrides.ts`
- Modify: `apps/api/src/modules/admins/infrastructure/persistence/tenant.entity.ts`
- Test: `apps/api/test/add-tenant-label-overrides.migration.e2e-spec.ts`

**Interfaces:**
- Consumes: `connectionOptions`, `migrationsBefore` from `apps/api/test/helpers/migration-db.ts`.
- Produces: column `tenant_entity."labelOverrides" jsonb NULL`; entity property `TenantEntity.labelOverrides: unknown` with `select: false` (used by Task 3's service).

- [ ] **Step 1: Write the failing migration test**

Create `apps/api/test/add-tenant-label-overrides.migration.e2e-spec.ts`:

```ts
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { AddTenantLabelOverrides1790870400000 } from '../src/platform/database/migrations/1790870400000-AddTenantLabelOverrides';
import { connectionOptions, migrationsBefore } from './helpers/migration-db';

// #118 (tenant label overrides spec §4.1, §6.1): adds only the nullable
// jsonb column, writes no data (every existing tenant row stays NULL), and
// down() drops it — on a throwaway database migrated to just before it.
describe('AddTenantLabelOverrides migration (real Postgres)', () => {
  const database = `clensy_migration_${randomUUID().replace(/-/g, '')}`;
  let admin: DataSource;
  let dataSource: DataSource;

  async function labelOverridesColumn(): Promise<
    { data_type: string; is_nullable: string } | undefined
  > {
    const rows = (await dataSource.query(
      `SELECT "data_type", "is_nullable" FROM information_schema.columns WHERE "table_name" = 'tenant_entity' AND "column_name" = 'labelOverrides'`,
    )) as { data_type: string; is_nullable: string }[];
    return rows[0];
  }

  const preMigrationName = `pre-migration-${randomUUID()}`;

  async function tenantCount(): Promise<{ total: number; unset: number }> {
    const [counts] = (await dataSource.query(
      `SELECT COUNT(*)::int AS "total", (COUNT(*) FILTER (WHERE "labelOverrides" IS NULL))::int AS "unset" FROM "tenant_entity"`,
    )) as { total: number; unset: number }[];
    return counts;
  }

  beforeAll(async () => {
    admin = new DataSource(connectionOptions(process.env.DB_NAME ?? 'clensy'));
    await admin.initialize();
    await admin.query(`CREATE DATABASE "${database}"`);
    dataSource = new DataSource({
      ...connectionOptions(database),
      migrations: migrationsBefore('1790870400000'),
    });
    await dataSource.initialize();
    await dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await dataSource.runMigrations();
    await dataSource.query(`INSERT INTO "tenant_entity" ("name") VALUES ($1)`, [
      preMigrationName,
    ]);
  }, 120_000);

  afterAll(async () => {
    await dataSource?.destroy();
    await admin?.query(`DROP DATABASE IF EXISTS "${database}"`);
    await admin?.destroy();
  });

  it('adds a nullable jsonb column, leaves every existing tenant NULL, and down() drops it', async () => {
    const migration = new AddTenantLabelOverrides1790870400000();
    const queryRunner = dataSource.createQueryRunner();
    try {
      expect(await labelOverridesColumn()).toBeUndefined();
      const [{ count: before }] = (await dataSource.query(
        `SELECT COUNT(*)::int AS "count" FROM "tenant_entity"`,
      )) as { count: number }[];

      await migration.up(queryRunner);
      expect(await labelOverridesColumn()).toEqual({
        data_type: 'jsonb',
        is_nullable: 'YES',
      });
      // Writes no data: the same rows, every one still NULL — including the
      // row this test inserted, independent of any baseline seed data.
      const { total, unset } = await tenantCount();
      expect(total).toBe(before);
      expect(unset).toBe(total);
      const [inserted] = (await dataSource.query(
        `SELECT "labelOverrides" FROM "tenant_entity" WHERE "name" = $1`,
        [preMigrationName],
      )) as { labelOverrides: unknown }[];
      expect(inserted.labelOverrides).toBeNull();

      await migration.down(queryRunner);
      expect(await labelOverridesColumn()).toBeUndefined();
    } finally {
      await queryRunner.release();
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter api test:e2e -- add-tenant-label-overrides`
Expected: FAIL. `Cannot find module '../src/platform/database/migrations/1790870400000-AddTenantLabelOverrides'`.

- [ ] **Step 3: Write the migration and the entity column**

Create `apps/api/src/platform/database/migrations/1790870400000-AddTenantLabelOverrides.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

// Tenant label overrides (#118; spec §4.1). Adds the nullable, untrusted
// `labelOverrides` jsonb column and writes no data: operations staff
// populate it. Every read goes through the validator (spec §4.2).
export class AddTenantLabelOverrides1790870400000 implements MigrationInterface {
  name = 'AddTenantLabelOverrides1790870400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenant_entity" ADD "labelOverrides" jsonb`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tenant_entity" DROP COLUMN "labelOverrides"`,
    );
  }
}
```

In `apps/api/src/modules/admins/infrastructure/persistence/tenant.entity.ts`, after the `name` column:

```ts
  @Column()
  name!: string;
```

add:

```ts
  // Tenant label overrides spec §4.1, §4.2: raw, untrusted jsonb. With
  // `select: false`, an ordinary TenantEntity load never reads it; only
  // TenantLabelOverridesService selects it, and only through the validator.
  // Deliberately not part of the `Tenant` domain interface.
  @Column({ type: 'jsonb', nullable: true, select: false })
  labelOverrides!: unknown;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter api test:e2e -- add-tenant-label-overrides`
Expected: PASS.

- [ ] **Step 5: Type-check, lint, and commit**

Run: `pnpm --filter api exec tsc --noEmit && pnpm --filter api exec eslint src/platform/database/migrations/1790870400000-AddTenantLabelOverrides.ts src/modules/admins/infrastructure/persistence/tenant.entity.ts test/add-tenant-label-overrides.migration.e2e-spec.ts`
Expected: no errors.

```bash
git add apps/api/src/platform/database/migrations/1790870400000-AddTenantLabelOverrides.ts apps/api/src/modules/admins/infrastructure/persistence/tenant.entity.ts apps/api/test/add-tenant-label-overrides.migration.e2e-spec.ts
git commit -m "feat(118): add the nullable tenant labelOverrides jsonb column"
```

---

### Task 3: Service, GraphQL field and field resolver (spec §4.2, §4.3)

**Files:**
- Create: `apps/api/src/modules/admins/application/services/tenant-label-overrides.service.ts`
- Create: `apps/api/src/modules/admins/presentation/graphql/tenant-label-overrides.type.ts`
- Create: `apps/api/src/modules/admins/presentation/graphql/current-admin-label-overrides.resolver.ts`
- Modify: `apps/api/src/modules/admins/admins.module.ts`
- Test: `apps/api/src/modules/admins/tests/graphql/current-admin-label-overrides.resolver.spec.ts`
- Test: `apps/api/test/tenant-label-overrides.e2e-spec.ts`
- Regenerated: `apps/api/src/schema.gql`

**Interfaces:**
- Consumes: Task 1's `validateTenantLabelOverrides`, `RELABELABLE_ROLES`, `RelabelableRole`, `RoleLabels`, `TENANT_LABEL_LOCALE`; Task 2's `TenantEntity.labelOverrides`; existing `CurrentAdminType`, `AdminScope`.
- Produces:
  - `TenantLabelOverridesService.labelsFor(tenantId: string): Promise<RoleLabels | null>`. It logs one `Logger.warn` per rejection, formatted `tenant <tenantId>: dropped label override at <path> (<reason>)`.
  - GraphQL `CurrentAdmin.tenantLabelOverrides: TenantLabelOverrides` (nullable, no args).
  - `type TenantLabelOverrides { locale: String! roles: RoleLabelOverrides! }`.
  - `type RoleLabelOverrides { ANALYST CUSTOMER_SUPPORT FINANCE OPS_MANAGER SCHEDULER TENANT_OWNER: String }`.
  - Task 5 relies on these names.

- [ ] **Step 1: Write the failing unit and e2e tests**

Create `apps/api/src/modules/admins/tests/graphql/current-admin-label-overrides.resolver.spec.ts`:

```ts
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { GraphQLObjectType, GraphQLSchema } from 'graphql';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import { Role } from '../../../../platform/auth/domain/role';
import type { TenantLabelOverridesService } from '../../application/services/tenant-label-overrides.service';
import { RELABELABLE_ROLES } from '../../domain/tenant-label-overrides';
import { AdminResolver } from '../../presentation/graphql/admin.resolver';
import { CurrentAdminLabelOverridesResolver } from '../../presentation/graphql/current-admin-label-overrides.resolver';
import type { CurrentAdminType } from '../../presentation/graphql/current-admin.type';

const UNSET = {
  ANALYST: null,
  CUSTOMER_SUPPORT: null,
  FINANCE: null,
  OPS_MANAGER: null,
  SCHEDULER: null,
  TENANT_OWNER: null,
};

describe('CurrentAdmin.tenantLabelOverrides', () => {
  describe('schema (spec §4.3)', () => {
    let schema: GraphQLSchema;

    beforeAll(async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [GraphQLSchemaBuilderModule],
      }).compile();
      schema = await moduleRef
        .get(GraphQLSchemaFactory)
        .create([AdminResolver, CurrentAdminLabelOverridesResolver]);
    });

    // Owns only the new field. The rest of CurrentAdmin's field set is
    // pinned by admin.resolver.spec.ts.
    it('adds a nullable tenantLabelOverrides field with no arguments to CurrentAdmin', () => {
      const fields = (
        schema.getType('CurrentAdmin') as GraphQLObjectType
      ).getFields();
      expect(fields.tenantLabelOverrides).toBeDefined();
      expect(String(fields.tenantLabelOverrides.type)).toBe(
        'TenantLabelOverrides',
      );
      expect(fields.tenantLabelOverrides.args).toEqual([]);
    });

    it('types TenantLabelOverrides as { locale: String!, roles: RoleLabelOverrides! }', () => {
      const fields = (
        schema.getType('TenantLabelOverrides') as GraphQLObjectType
      ).getFields();
      expect(Object.keys(fields).sort()).toEqual(['locale', 'roles']);
      expect(String(fields.locale.type)).toBe('String!');
      expect(String(fields.roles.type)).toBe('RoleLabelOverrides!');
    });

    it('declares exactly one nullable String field per relabelable role (drift)', () => {
      const fields = (
        schema.getType('RoleLabelOverrides') as GraphQLObjectType
      ).getFields();
      expect(Object.keys(fields).sort()).toEqual([...RELABELABLE_ROLES].sort());
      for (const field of Object.values(fields)) {
        expect(String(field.type)).toBe('String');
      }
    });
  });

  describe('resolution (spec §4.3, §4.7 items 1–2)', () => {
    const labelsFor = jest.fn();
    const resolver = new CurrentAdminLabelOverridesResolver({
      labelsFor,
    } as unknown as TenantLabelOverridesService);
    const tenantAdmin: CurrentAdminType = {
      id: 'admin-1',
      role: Role.FINANCE,
      scope: AdminScope.TENANT,
      tenantId: 'tenant-1',
    };

    beforeEach(() => labelsFor.mockReset());

    it('returns null for PLATFORM scope without reading any tenant', async () => {
      await expect(
        resolver.tenantLabelOverrides({
          id: 'super-1',
          role: Role.SUPER_ADMIN,
          scope: AdminScope.PLATFORM,
          tenantId: null,
        }),
      ).resolves.toBeNull();
      expect(labelsFor).not.toHaveBeenCalled();
    });

    it("reads only the parent principal's tenant and maps kept labels, others null", async () => {
      labelsFor.mockResolvedValue({ FINANCE: 'Billing' });
      await expect(resolver.tenantLabelOverrides(tenantAdmin)).resolves.toEqual(
        { locale: 'en', roles: { ...UNSET, FINANCE: 'Billing' } },
      );
      expect(labelsFor).toHaveBeenCalledWith('tenant-1');
    });

    it('returns null when the service keeps nothing', async () => {
      labelsFor.mockResolvedValue(null);
      await expect(
        resolver.tenantLabelOverrides(tenantAdmin),
      ).resolves.toBeNull();
    });
  });
});
```

Create `apps/api/test/tenant-label-overrides.e2e-spec.ts`:

```ts
import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { Role } from '../src/platform/auth/domain/role';
import type { LabelOverrideRejectionReason } from '../src/modules/admins/domain/tenant-label-overrides';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import {
  createTestTenant,
  removeTestTenants,
  SeededAdmin,
  seedTenantAdmin,
} from './helpers/seed-tenant-admin';

// #118 (tenant label overrides spec §4.2, §4.3, §6.1): structurally
// malformed JSONB, mixed values, log-once redacted warnings and the login
// path, through real HTTP and a real tenant row. Cross-tenant isolation and
// Super Admin are release-gate Phase 8 (CI).
const SELECTION =
  'tenantLabelOverrides { locale roles { ANALYST CUSTOMER_SUPPORT FINANCE OPS_MANAGER SCHEDULER TENANT_OWNER } }';
const CURRENT_ADMIN_QUERY = `{ currentAdmin { ${SELECTION} } }`;
// The session login never selects the new field, so a missing field fails
// each case with a GraphQL error instead of breaking beforeAll.
const SESSION_LOGIN_MUTATION =
  'mutation Login($input: LoginInput!) { login(loginInput: $input) { success } }';
const LOGIN_MUTATION = `mutation Login($input: LoginInput!) { login(loginInput: $input) { admin { ${SELECTION} } } }`;
const UNSET = {
  ANALYST: null,
  CUSTOMER_SUPPORT: null,
  FINANCE: null,
  OPS_MANAGER: null,
  SCHEDULER: null,
  TENANT_OWNER: null,
};

type Rejection = [path: string, reason: LabelOverrideRejectionReason];

// [label, stored jsonb value, expected rejections, rejected stored strings
// that must never appear in a log line]
const MALFORMED: [string, unknown, Rejection[], string[]][] = [
  ['a scalar', 'Billing', [['$', 'not-an-object']], ['Billing']],
  ['an array', ['Billing'], [['$', 'not-an-object']], ['Billing']],
  [
    'only an unknown locale',
    { fr: { roles: { FINANCE: 'Facturation' } } },
    [['fr', 'unknown-key']],
    ['Facturation'],
  ],
  [
    'only wrong value types',
    { en: { roles: { ANALYST: true, FINANCE: 42 } } },
    [
      ['en.roles.ANALYST', 'not-a-string'],
      ['en.roles.FINANCE', 'not-a-string'],
    ],
    [],
  ],
  [
    'a roles array of 100 items',
    { en: { roles: Array.from({ length: 100 }, () => 'Billing') } },
    [['en.roles', 'not-an-object']],
    ['Billing'],
  ],
];

interface GraphqlBody {
  data?: {
    currentAdmin?: { tenantLabelOverrides: unknown };
    login?: { admin: { tenantLabelOverrides: unknown } };
  };
  errors?: unknown[];
}

describe('Tenant label overrides (e2e, #118)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let owner: SeededAdmin;
  let cookie: string;
  let tenantId: string;
  let warn: jest.SpyInstance;

  function login(query: string) {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        query,
        variables: { input: { email: owner.email, password: owner.password } },
      });
  }

  async function currentAdminOverrides(): Promise<unknown> {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query: CURRENT_ADMIN_QUERY });
    const body = response.body as GraphqlBody;
    expect(body.errors).toBeUndefined();
    return body.data?.currentAdmin?.tenantLabelOverrides;
  }

  // jsonb, passed as text: node-postgres would turn a JS array into a
  // Postgres array literal, not JSON.
  async function store(value: unknown): Promise<void> {
    await dataSource.query(
      `UPDATE "tenant_entity" SET "labelOverrides" = $2::jsonb WHERE "id" = $1`,
      [tenantId, JSON.stringify(value)],
    );
  }

  async function storeSqlNull(): Promise<void> {
    await dataSource.query(
      `UPDATE "tenant_entity" SET "labelOverrides" = NULL WHERE "id" = $1`,
      [tenantId],
    );
  }

  function warnings(): string[] {
    return warn.mock.calls.map(([message]) => String(message)).sort();
  }

  // The exact line TenantLabelOverridesService writes per rejection.
  function expectedWarnings(...rejections: Rejection[]): string[] {
    return rejections
      .map(
        ([path, reason]) =>
          `tenant ${tenantId}: dropped label override at ${path} (${reason})`,
      )
      .sort();
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    applyPlatformPipes(app);
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    tenantId = await createTestTenant(dataSource);
    owner = await seedTenantAdmin(dataSource, Role.TENANT_OWNER, tenantId);
    const response = await login(SESSION_LOGIN_MUTATION);
    const setCookie = response.headers['set-cookie'] as unknown as string[];
    cookie = setCookie[0].split(';')[0];
  });

  beforeEach(() => {
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  afterAll(async () => {
    await removeTestTenants(dataSource, [tenantId]);
    await app.close();
  });

  it('returns null for a NULL column and logs nothing', async () => {
    await storeSqlNull();
    expect(await currentAdminOverrides()).toBeNull();
    expect(warnings()).toEqual([]);
  });

  it.each(MALFORMED)(
    'returns null for structurally malformed JSONB with no valid leaf: %s',
    async (_label, value, rejections, rejectedValues) => {
      await store(value);
      expect(await currentAdminOverrides()).toBeNull();
      expect(warnings()).toEqual(expectedWarnings(...rejections));
      const logged = warnings().join('\n');
      for (const rejected of rejectedValues) {
        expect(logged).not.toContain(rejected);
      }
    },
  );

  it('keeps only the valid, trimmed leaves of a mixed value and logs only the rejected ones', async () => {
    await store({
      en: {
        roles: {
          ANALYST: 'x'.repeat(65),
          FINANCE: '  Billing  ',
          SCHEDULER: 'Sched\nUler',
          SUPER_ADMIN: 'Root-Label-SA',
        },
      },
      fr: {},
    });
    expect(await currentAdminOverrides()).toEqual({
      locale: 'en',
      roles: { ...UNSET, FINANCE: 'Billing' },
    });
    expect(warnings()).toEqual(
      expectedWarnings(
        ['en.roles.ANALYST', 'too-long'],
        ['en.roles.SCHEDULER', 'control-character'],
        ['en.roles.SUPER_ADMIN', 'unknown-key'],
        ['fr', 'unknown-key'],
      ),
    );
    const logged = warnings().join('\n');
    // No rejected value, exactly as stored, reaches the log.
    for (const rejected of ['x'.repeat(65), 'Sched\nUler', 'Root-Label-SA']) {
      expect(logged).not.toContain(rejected);
    }
    // Deliberately also the kept value: a warning carries no stored value at all.
    expect(logged).not.toContain('Billing');
  });

  it('resolves the same tenant labels on the login result', async () => {
    await store({ en: { roles: { FINANCE: 'Billing' } } });
    const body = (await login(LOGIN_MUTATION)).body as GraphqlBody;
    expect(body.errors).toBeUndefined();
    expect(body.data?.login?.admin.tenantLabelOverrides).toEqual({
      locale: 'en',
      roles: { ...UNSET, FINANCE: 'Billing' },
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter api test -- current-admin-label-overrides`
Expected: FAIL. `Cannot find module '../../presentation/graphql/current-admin-label-overrides.resolver'`.

Run: `pnpm --filter api migration:run && pnpm --filter api test:e2e -- tenant-label-overrides.e2e`
Expected: FAIL. Every case reports a GraphQL validation error, `Cannot query field "tenantLabelOverrides" on type "CurrentAdmin"`, so `body.errors` is defined. `beforeAll` still logs in, because the session login selects only `success`. (`migration:run` applies Task 2's migration to the `clensy` database.)

- [ ] **Step 3: Write the service, types and resolver, and register them**

Create `apps/api/src/modules/admins/application/services/tenant-label-overrides.service.ts`:

```ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  RoleLabels,
  validateTenantLabelOverrides,
} from '../../domain/tenant-label-overrides';
import { TenantEntity } from '../../infrastructure/persistence/tenant.entity';

// Tenant label overrides spec §4.2, §4.7 item 3: the ONLY application code
// that reads `TenantEntity.labelOverrides` (a `select: false` column), and
// it always passes the raw value through the validator. One warning per
// rejected node or leaf, at its own path, never with the stored value.
@Injectable()
export class TenantLabelOverridesService {
  private readonly logger = new Logger(TenantLabelOverridesService.name);

  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
  ) {}

  async labelsFor(tenantId: string): Promise<RoleLabels | null> {
    const tenant = await this.tenantRepository
      .createQueryBuilder('tenant')
      .select('tenant.id')
      .addSelect('tenant.labelOverrides')
      .where('tenant.id = :tenantId', { tenantId })
      .getOne();
    const { labels, rejections } = validateTenantLabelOverrides(
      tenant?.labelOverrides ?? null,
    );
    for (const { path, reason } of rejections) {
      this.logger.warn(
        `tenant ${tenantId}: dropped label override at ${path} (${reason})`,
      );
    }
    return labels;
  }
}
```

Create `apps/api/src/modules/admins/presentation/graphql/tenant-label-overrides.type.ts`:

```ts
import { Field, ObjectType } from '@nestjs/graphql';
import type { RelabelableRole } from '../../domain/tenant-label-overrides';

// Spec §4.3. Code-first NestJS needs each field declared by hand, so the six
// names appear here by necessity. Two complementary guards keep them aligned
// with RELABELABLE_ROLES: `implements Record<RelabelableRole, …>` fails to
// compile if a relabelable role has no property, and the schema drift test
// (current-admin-label-overrides.resolver.spec.ts) fails on any difference
// between the declared GraphQL fields and RELABELABLE_ROLES.
@ObjectType('RoleLabelOverrides')
export class RoleLabelOverridesType implements Record<
  RelabelableRole,
  string | null
> {
  @Field(() => String, { nullable: true })
  ANALYST!: string | null;

  @Field(() => String, { nullable: true })
  CUSTOMER_SUPPORT!: string | null;

  @Field(() => String, { nullable: true })
  FINANCE!: string | null;

  @Field(() => String, { nullable: true })
  OPS_MANAGER!: string | null;

  @Field(() => String, { nullable: true })
  SCHEDULER!: string | null;

  @Field(() => String, { nullable: true })
  TENANT_OWNER!: string | null;
}

// `locale` identifies the catalog the overrides belong to — a statement
// about the data, not negotiation. Always "en" in this version.
@ObjectType('TenantLabelOverrides')
export class TenantLabelOverridesType {
  @Field(() => String)
  locale!: string;

  @Field(() => RoleLabelOverridesType)
  roles!: RoleLabelOverridesType;
}
```

Create `apps/api/src/modules/admins/presentation/graphql/current-admin-label-overrides.resolver.ts`:

```ts
import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import { TenantLabelOverridesService } from '../../application/services/tenant-label-overrides.service';
import {
  RoleLabels,
  TENANT_LABEL_LOCALE,
} from '../../domain/tenant-label-overrides';
import { CurrentAdminType } from './current-admin.type';
import {
  RoleLabelOverridesType,
  TenantLabelOverridesType,
} from './tenant-label-overrides.type';

// Spec §4.3, §4.7 items 1–2. No arguments and no request input: the parent
// `CurrentAdmin` is built only by `toCurrentAdminType(principal)` — from the
// AuthGuard'd `currentAdmin` query or the credential-verified `login` — so
// `parent.tenantId` is the principal's own tenant. Never reads TenantEntity;
// TenantLabelOverridesService is the column's only reader (§4.2).
@Resolver(() => CurrentAdminType)
export class CurrentAdminLabelOverridesResolver {
  constructor(
    private readonly tenantLabelOverridesService: TenantLabelOverridesService,
  ) {}

  @ResolveField('tenantLabelOverrides', () => TenantLabelOverridesType, {
    nullable: true,
  })
  async tenantLabelOverrides(
    @Parent() admin: CurrentAdminType,
  ): Promise<TenantLabelOverridesType | null> {
    if (admin.scope === AdminScope.PLATFORM || admin.tenantId === null) {
      return null;
    }
    const labels = await this.tenantLabelOverridesService.labelsFor(
      admin.tenantId,
    );
    return labels
      ? { locale: TENANT_LABEL_LOCALE, roles: toRoleLabelOverrides(labels) }
      : null;
  }
}

function toRoleLabelOverrides(labels: RoleLabels): RoleLabelOverridesType {
  return {
    ANALYST: labels.ANALYST ?? null,
    CUSTOMER_SUPPORT: labels.CUSTOMER_SUPPORT ?? null,
    FINANCE: labels.FINANCE ?? null,
    OPS_MANAGER: labels.OPS_MANAGER ?? null,
    SCHEDULER: labels.SCHEDULER ?? null,
    TENANT_OWNER: labels.TENANT_OWNER ?? null,
  };
}
```

In `apps/api/src/modules/admins/admins.module.ts`, add the imports:

```ts
import { TenantLabelOverridesService } from './application/services/tenant-label-overrides.service';
import { CurrentAdminLabelOverridesResolver } from './presentation/graphql/current-admin-label-overrides.resolver';
```

and replace:

```ts
  providers: [AdminsService, LoginService, AdminIdentityLookupService],
```

with:

```ts
  // `CurrentAdminLabelOverridesResolver` needs only this module's own
  // `TenantLabelOverridesService`, so unlike `AdminResolver` (see above) it
  // can be registered here (#118).
  providers: [
    AdminsService,
    LoginService,
    AdminIdentityLookupService,
    TenantLabelOverridesService,
    CurrentAdminLabelOverridesResolver,
  ],
```

- [ ] **Step 4: Run the tests to verify they pass, and regenerate the schema**

Run: `pnpm --filter api test -- current-admin-label-overrides admin.resolver`
Expected: PASS. The existing `admin.resolver.spec.ts` builds its schema from `[AdminResolver]` alone and remains the one owner of `CurrentAdmin`'s base field set (four fields). It is unchanged and still passes, as a **characterization** check.

Run: `pnpm --filter api test:e2e -- tenant-label-overrides.e2e`
Expected: PASS, all six cases. Booting `AppModule` rewrites `apps/api/src/schema.gql`.

Run: `git diff apps/api/src/schema.gql`
Expected: `type CurrentAdmin` gains `tenantLabelOverrides: TenantLabelOverrides`, and two new types `RoleLabelOverrides` and `TenantLabelOverrides` appear. No other change.

- [ ] **Step 5: Type-check, lint, and commit**

Run: `pnpm --filter api exec tsc --noEmit && pnpm --filter api exec eslint "src/modules/admins/**/*.ts" test/tenant-label-overrides.e2e-spec.ts`
Expected: no errors.

```bash
git add apps/api/src/modules/admins apps/api/test/tenant-label-overrides.e2e-spec.ts apps/api/src/schema.gql
git commit -m "feat(118): expose validated tenant label overrides on CurrentAdmin"
```

---

### Task 4: Release-gate Phase 8, cross-tenant isolation (spec §4.7 items 1–2, §6.1)

**Files:**
- Modify: `apps/api/test/two-tenant-release-gate.e2e-spec.ts`

**Interfaces:**
- Consumes: `world.a` / `world.b` (`tenantId`, `name`, `cookies: Record<Role, string>`), `world.superAdminCookie`, `app`, `dataSource` (all already in the file); Task 1's `RELABELABLE_ROLES`, `RelabelableRole`.
- Produces: a CI-run assertion that each tenant's principals receive only their own labels and Super Admin receives `null`.

- [ ] **Step 1: Add the phase**

Add imports at the top of `apps/api/test/two-tenant-release-gate.e2e-spec.ts`, next to the existing ones:

```ts
import request from 'supertest';
import { isDeepStrictEqual } from 'util';
import {
  RELABELABLE_ROLES,
  RelabelableRole,
} from '../src/modules/admins/domain/tenant-label-overrides';
```

Append this test as the last test inside `describe('Two-tenant isolation release gate (#92)', …)`, after the closing `}` of the `for (const [label, attackerOf, victimOf, step] of …)` loop:

```ts
  // #118 (tenant label overrides spec §4.7 items 1–2, §6.1): each tenant's
  // stored role labels reach only that tenant's principals, through every
  // tenant role; Super Admin receives null. Restores both columns to NULL.
  it('Phase 8 — label overrides: each tenant receives only its own; Super Admin receives null', async () => {
    // Independent of earlier phases (the world is built in beforeAll), so it
    // can run alone with `-t 'Phase 8'`.
    const stored: Readonly<
      Record<'A' | 'B', Readonly<Partial<Record<RelabelableRole, string>>>>
    > = {
      // Every stored label is tenant-specific, and each tenant leaves some
      // roles unset, so a leak in either direction changes a value.
      A: { FINANCE: 'Billing A', SCHEDULER: 'Scheduling A' },
      B: { ANALYST: 'Insights B', FINANCE: 'Billing B', TENANT_OWNER: 'Owners B' },
    };
    const query =
      '{ currentAdmin { tenantLabelOverrides { locale roles { ANALYST CUSTOMER_SUPPORT FINANCE OPS_MANAGER SCHEDULER TENANT_OWNER } } } }';
    const overridesFor = async (cookie: string): Promise<unknown> => {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Cookie', cookie)
        .send({ query });
      return (
        response.body as {
          data?: { currentAdmin?: { tenantLabelOverrides: unknown } };
        }
      ).data?.currentAdmin?.tenantLabelOverrides;
    };
    const failures: string[] = [];
    try {
      for (const tenant of [world.a, world.b]) {
        await dataSource.query(
          `UPDATE "tenant_entity" SET "labelOverrides" = $2::jsonb WHERE "id" = $1`,
          [tenant.tenantId, JSON.stringify({ en: { roles: stored[tenant.name] } })],
        );
      }
      for (const tenant of [world.a, world.b]) {
        const expected = {
          locale: 'en',
          roles: Object.fromEntries(
            RELABELABLE_ROLES.map((role) => [
              role,
              stored[tenant.name][role] ?? null,
            ]),
          ),
        };
        for (const role of RELABELABLE_ROLES) {
          const actual = await overridesFor(tenant.cookies[role]);
          if (!isDeepStrictEqual(actual, expected)) {
            failures.push(
              `[isolation] tenant ${tenant.name} ${role}: expected its own labels, got ${JSON.stringify(actual)}`,
            );
          }
        }
      }
      const platform = await overridesFor(world.superAdminCookie);
      if (platform !== null) {
        failures.push(
          `[isolation] SUPER_ADMIN: expected null, got ${JSON.stringify(platform)}`,
        );
      }
    } finally {
      await dataSource.query(
        `UPDATE "tenant_entity" SET "labelOverrides" = NULL WHERE "id" = ANY($1)`,
        [[world.a.tenantId, world.b.tenantId]],
      );
    }
    expect(failures).toEqual([]);
  });
```

- [ ] **Step 2: Verify the phase fails without the feature (RED check)**

Task 3 is already committed, so the RED state is made by a temporary edit. The edit is backed up and restored byte for byte, so any unrelated uncommitted change in the file survives. Never use `git checkout --` for this.

Run, from the worktree root:

```bash
module=apps/api/src/modules/admins/admins.module.ts
backup=$(mktemp)
cp "$module" "$backup"
sed -i '/CurrentAdminLabelOverridesResolver/d' "$module"
grep -c CurrentAdminLabelOverridesResolver "$module"   # Expected: 0
pnpm --filter api exec jest --config ./test/jest-e2e.json two-tenant-release-gate -t 'Phase 8'
cp "$backup" "$module" && cmp "$backup" "$module" && rm "$backup"
```

Expected:
- The `jest` run: Phase 8 FAILS. With the resolver unregistered (its import line and providers entry are the only lines naming it), each query returns a GraphQL error, so every `[isolation] tenant … got undefined` line and the `SUPER_ADMIN` line appear.
- `cmp` prints nothing: the file is restored exactly.

- [ ] **Step 3: Run the gate with the feature**

Run: `pnpm --filter api test:e2e:release-gate`
Expected: PASS, every phase including Phase 8. Phase 1a passing confirms the root-operation inventory is unchanged (§4.3).

- [ ] **Step 4: Lint and commit**

Run: `pnpm --filter api exec eslint test/two-tenant-release-gate.e2e-spec.ts`
Expected: no errors.

```bash
git add apps/api/test/two-tenant-release-gate.e2e-spec.ts
git commit -m "test(118): add release-gate Phase 8 for tenant label override isolation"
```

---

### Task 5: Client operation and codegen (spec §4.3)

**Files:**
- Modify: `packages/client/src/operations/current-admin.graphql`
- Regenerated: `packages/client/src/generated/graphql.ts`

**Interfaces:**
- Consumes: Task 3's regenerated `apps/api/src/schema.gql`.
- Produces: `CurrentAdminQuery['currentAdmin']['tenantLabelOverrides']` typed `{ locale: string, roles: { ANALYST: string | null, … } } | null`, used by Task 7.

- [ ] **Step 1: Select the field**

Replace the contents of `packages/client/src/operations/current-admin.graphql` with:

```graphql
query CurrentAdmin {
  currentAdmin {
    id
    role
    scope
    tenantId
    tenantLabelOverrides {
      locale
      roles {
        ANALYST
        CUSTOMER_SUPPORT
        FINANCE
        OPS_MANAGER
        SCHEDULER
        TENANT_OWNER
      }
    }
  }
}
```

- [ ] **Step 2: Regenerate and verify**

Run: `pnpm --filter @clensy/client codegen && grep -n "export type CurrentAdminQuery " packages/client/src/generated/graphql.ts`
Expected: the `CurrentAdminQuery` line now includes `tenantLabelOverrides: { locale: string, roles: { ANALYST: string | null, CUSTOMER_SUPPORT: string | null, FINANCE: string | null, OPS_MANAGER: string | null, SCHEDULER: string | null, TENANT_OWNER: string | null } } | null`. `CurrentAdminDocument` includes the new selection.

Run: `pnpm --filter @clensy/client build && pnpm --filter web exec tsc --noEmit`
Expected: no errors. Existing consumers only gain a field.

- [ ] **Step 3: Commit**

```bash
git add packages/client/src/operations/current-admin.graphql packages/client/src/generated/graphql.ts
git commit -m "feat(118): select tenantLabelOverrides in the CurrentAdmin operation"
```

---

### Task 6: `deepMerge` export from `@clensy/web` (spec §4.5, §4.6 item 8)

**Files:**
- Modify: `packages/web/src/index.ts`
- Test: `packages/web/src/i18n/deep-merge.test.ts`

**Interfaces:**
- Produces: `import { deepMerge } from '@clensy/web'`, the same function as `packages/web/src/i18n/deep-merge.ts`'s `deepMerge`. Used by Task 8.

- [ ] **Step 1: Write the failing test**

In `packages/web/src/i18n/deep-merge.test.ts`, replace:

```ts
import { describe, expect, it } from 'vitest';
import { deepMerge } from './deep-merge';
```

with:

```ts
import { describe, expect, it } from 'vitest';
import * as publicApi from '../index';
import { deepMerge } from './deep-merge';
```

and add as the first test inside `describe('deepMerge', () => {`:

```ts
  it('is exported from the package entry as the same function, not a wrapper', () => {
    expect(publicApi.deepMerge).toBe(deepMerge);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @clensy/web test -- deep-merge`
Expected: FAIL on the new test. `expected undefined to be [Function deepMerge]`.

- [ ] **Step 3: Add the export**

In `packages/web/src/index.ts`, replace:

```ts
export type { DeepPartial } from './i18n/deep-merge';
```

with:

```ts
export { deepMerge } from './i18n/deep-merge';
export type { DeepPartial } from './i18n/deep-merge';
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @clensy/web test -- deep-merge && pnpm --filter @clensy/web build`
Expected: PASS. The existing `deepMerge` behavior tests are unchanged (**characterization**), and the build has no errors.

- [ ] **Step 5: Commit**

```bash
git add packages/web/src/index.ts packages/web/src/i18n/deep-merge.test.ts
git commit -m "feat(118): export deepMerge from the @clensy/web entry"
```

---

### Task 7: Web mapper (spec §4.4)

**Files:**
- Create: `apps/web/lib/tenant-label-overrides.ts`
- Test: `apps/web/lib/tenant-label-overrides.test.ts`

**Interfaces:**
- Consumes: Task 5's `CurrentAdminQuery` type from `@clensy/client`; `STAFF_ROLE_OPTIONS`, `ClensyMessages`, `DeepPartial` from `@clensy/web`.
- Produces: `tenantLayer(overrides: TenantLabelOverrides | null | undefined, locale: string): DeepPartial<ClensyMessages>`, where `TenantLabelOverrides = NonNullable<CurrentAdminQuery['currentAdmin']['tenantLabelOverrides']>`. Used by Task 8.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/lib/tenant-label-overrides.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { tenantLayer } from './tenant-label-overrides';

const UNSET = {
  ANALYST: null,
  CUSTOMER_SUPPORT: null,
  FINANCE: null,
  OPS_MANAGER: null,
  SCHEDULER: null,
  TENANT_OWNER: null,
};

// Spec §4.4: data only, no revalidation (the API is authoritative).
describe('tenantLayer', () => {
  it('returns {} when there is no tenantLabelOverrides data', () => {
    expect(tenantLayer(undefined, 'en')).toEqual({});
    expect(tenantLayer(null, 'en')).toEqual({});
  });

  it('returns {} when the overrides belong to another locale', () => {
    expect(tenantLayer({ locale: 'en', roles: { ...UNSET, FINANCE: 'Billing' } }, 'fil')).toEqual({});
  });

  it('maps exactly the set roles and never forwards null', () => {
    expect(
      tenantLayer({ locale: 'en', roles: { ...UNSET, ANALYST: 'Insights', FINANCE: 'Billing' } }, 'en'),
    ).toEqual({ roles: { ANALYST: 'Insights', FINANCE: 'Billing' } });
  });

  it('ignores __typename and any non-role key', () => {
    const roles = { ...UNSET, FINANCE: 'Billing', __typename: 'RoleLabelOverrides', SUPER_ADMIN: 'Root' };
    expect(tenantLayer({ locale: 'en', roles }, 'en')).toEqual({ roles: { FINANCE: 'Billing' } });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/tenant-label-overrides.test.ts`
Expected: FAIL. `Failed to load url ./tenant-label-overrides` (module not found).

- [ ] **Step 3: Write the mapper**

Create `apps/web/lib/tenant-label-overrides.ts`:

```ts
import type { CurrentAdminQuery } from '@clensy/client';
import { STAFF_ROLE_OPTIONS, type ClensyMessages, type DeepPartial, type StaffRole } from '@clensy/web';

type TenantLabelOverrides = NonNullable<CurrentAdminQuery['currentAdmin']['tenantLabelOverrides']>;

// The tenant layer of the app i18n boundary (tenant label overrides spec
// §4.4). Data only: it never sees the query's loading/error flags, and it
// does not revalidate values (the API is authoritative). It applies nothing
// for another locale's catalog, and never forwards null, which deepMerge
// would otherwise write over the package default. Keys are bounded to the
// six tenant roles, which also drops Apollo's runtime __typename.
export function tenantLayer(
  overrides: TenantLabelOverrides | null | undefined,
  locale: string,
): DeepPartial<ClensyMessages> {
  if (!overrides || overrides.locale !== locale) return {};
  const roles: Partial<Record<StaffRole, string>> = {};
  for (const role of STAFF_ROLE_OPTIONS) {
    const label = overrides.roles[role];
    if (typeof label === 'string') roles[role] = label;
  }
  return { roles };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/tenant-label-overrides.test.ts && pnpm --filter web exec tsc --noEmit`
Expected: PASS, and no type errors. The test passes object literals with extra keys (`__typename`, `SUPER_ADMIN`) through a variable, so excess-property checks do not apply.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/tenant-label-overrides.ts apps/web/lib/tenant-label-overrides.test.ts
git commit -m "feat(118): add the tenant layer mapper for the app i18n boundary"
```

---

### Task 8: `AppI18nProvider` composes the tenant layer (spec §4.5, §6.2)

**Files:**
- Modify: `apps/web/components/layout/app-i18n-provider.tsx`
- Modify: `apps/web/package.json`, `pnpm-lock.yaml` (`jsdom` dev dependency)
- Test: `apps/web/lib/app-i18n-tenant-overrides.test.tsx` (static render, node)
- Test: `apps/web/lib/app-i18n-tenant-isolation.test.tsx` (mounted, jsdom)

**Interfaces:**
- Consumes: Task 5's `useCurrentAdminQuery`, Task 6's `deepMerge`, Task 7's `tenantLayer`.
- Produces: the composed boundary. Its only input is still `children`.

- [ ] **Step 1: Add `jsdom` and write the failing tests**

Run: `pnpm --filter web add -D jsdom`
Expected: `apps/web/package.json` `devDependencies` gains `jsdom`, and `pnpm-lock.yaml` updates.

Create `apps/web/lib/app-i18n-tenant-overrides.test.tsx`:

```tsx
import { CreateStaffForm, StaffDataTable } from '@clensy/web';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppI18nProvider } from '../components/layout/app-i18n-provider';
import { ShellChrome } from '../components/layout/shell-chrome';
import { UserMenu } from '../components/layout/user-menu';
import { getMessages } from '../i18n/messages';

// Tenant label overrides spec §4.5, §6.2. Both layers are mutable per test:
// vi.mock factories are hoisted ahead of the imports, and the getter is read
// at use time, so AppI18nProvider sees each test's static layer.
const state = vi.hoisted(() => ({
  app: {} as Record<string, unknown>,
  query: { data: undefined as unknown, loading: false } as { data: unknown; error?: Error; loading: boolean },
}));

vi.mock('./clensy-i18n-overrides', () => ({
  get APP_I18N_OVERRIDES() {
    return state.app;
  },
}));
vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useApolloClient: () => ({ clearStore: vi.fn() }),
}));
vi.mock('@clensy/client', () => ({
  useCurrentAdminQuery: () => state.query,
  useLogoutMutation: () => [vi.fn(), { loading: false }],
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const UNSET = {
  ANALYST: null,
  CUSTOMER_SUPPORT: null,
  FINANCE: null,
  OPS_MANAGER: null,
  SCHEDULER: null,
  TENANT_OWNER: null,
};

function financeAdmin(tenantLabelOverrides: unknown) {
  return { currentAdmin: { id: 'admin-1', role: 'FINANCE', scope: 'TENANT', tenantId: 'tenant-a', tenantLabelOverrides } };
}

const BILLING = { locale: 'en', roles: { ...UNSET, FINANCE: 'Billing' } };

function renderInBoundary(node: ReactNode, locale = 'en') {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={getMessages()}>
      <AppI18nProvider>{node}</AppI18nProvider>
    </NextIntlClientProvider>,
  );
}

const renderUserMenu = (locale?: string) =>
  renderInBoundary(
    <ShellChrome>
      <UserMenu />
    </ShellChrome>,
    locale,
  );
const renderStaffTable = () =>
  renderInBoundary(
    <StaffDataTable
      staff={[{ id: 'staff-1', email: 'finance@example.com', isActive: true, role: 'FINANCE' }]}
      currentAdminId="admin-1"
      onDisable={() => {}}
    />,
  );
const renderCreateForm = () =>
  renderInBoundary(<CreateStaffForm values={{ email: '', password: '', role: 'CUSTOMER_SUPPORT' }} onChange={() => {}} />);

describe('app i18n boundary — tenant layer', () => {
  beforeEach(() => {
    state.app = {};
    state.query = { data: financeAdmin(BILLING), loading: false };
  });

  it('applies a tenant FINANCE label in the user menu, staff table and create-staff form', () => {
    expect(renderUserMenu()).toMatch(/>Billing<\/span>/);
    expect(renderStaffTable()).toMatch(/>Billing</);
    const form = renderCreateForm();
    expect(form).toContain('<option value="FINANCE">Billing</option>');
    for (const html of [renderUserMenu(), renderStaffTable(), form]) {
      expect(html).not.toMatch(/>Finance</);
    }
  });

  it('keeps sibling roles at their package defaults', () => {
    expect(renderCreateForm()).toContain('<option value="TENANT_OWNER">Tenant Owner</option>');
  });

  it('lets the tenant layer win over the static app layer (deepMerge argument order)', () => {
    state.app = { roles: { FINANCE: 'Static Finance' } };
    expect(renderStaffTable()).toMatch(/>Billing</);
    expect(renderStaffTable()).not.toContain('Static Finance');
  });

  it('renders package defaults when tenantLabelOverrides is null', () => {
    state.query = { data: financeAdmin(null), loading: false };
    expect(renderStaffTable()).toMatch(/>Finance</);
  });

  it('does not apply en tenant labels under another locale', () => {
    expect(renderUserMenu('fil')).not.toMatch(/>Billing</);
  });

  it('uses cached currentAdmin data while a refetch is in flight', () => {
    state.query = { data: financeAdmin(BILLING), loading: true };
    expect(renderStaffTable()).toMatch(/>Billing</);
  });

  it('renders package defaults while loading with no data, and on an error with no data', () => {
    state.query = { data: undefined, loading: true };
    expect(renderStaffTable()).toMatch(/>Finance</);
    state.query = { data: undefined, error: new Error('network'), loading: false };
    expect(renderStaffTable()).toMatch(/>Finance</);
  });
});
```

Create `apps/web/lib/app-i18n-tenant-isolation.test.tsx`:

```tsx
// @vitest-environment jsdom
import { useClensyTranslations } from '@clensy/web';
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppI18nProvider } from '../components/layout/app-i18n-provider';
import { getMessages } from '../i18n/messages';

// Tenant label overrides spec §6.2 isolation test: one mounted boundary,
// with the query result changed between steps. The provider must derive the
// tenant layer only from the current result and retain nothing.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
  app: {} as Record<string, unknown>,
  query: { data: undefined as unknown, loading: false },
}));

vi.mock('./clensy-i18n-overrides', () => ({
  get APP_I18N_OVERRIDES() {
    return state.app;
  },
}));
vi.mock('@clensy/client', () => ({ useCurrentAdminQuery: () => state.query }));

const UNSET = {
  ANALYST: null,
  CUSTOMER_SUPPORT: null,
  FINANCE: null,
  OPS_MANAGER: null,
  SCHEDULER: null,
  TENANT_OWNER: null,
};

function admin(tenantId: string, tenantLabelOverrides: unknown) {
  return { currentAdmin: { id: `admin-${tenantId}`, role: 'FINANCE', scope: 'TENANT', tenantId, tenantLabelOverrides } };
}

// Two role paths, so contamination of any stored role is visible: "FINANCE|SCHEDULER".
function RoleLabels() {
  const t = useClensyTranslations('roles');
  return <span>{`${t('FINANCE')}|${t('SCHEDULER')}`}</span>;
}

const tree = (
  <NextIntlClientProvider locale="en" messages={getMessages()}>
    <AppI18nProvider>
      <RoleLabels />
    </AppI18nProvider>
  </NextIntlClientProvider>
);

describe('app i18n boundary — isolation across identities', () => {
  let container: HTMLDivElement;
  let root: Root;

  function mount() {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  }

  // Re-rendering the same tree into the same root keeps the mounted
  // AppI18nProvider instance; React calls the mocked hook again, which
  // returns the step's new result.
  function show(data: unknown) {
    state.query = { data, loading: false };
    act(() => root.render(tree));
    return container.textContent;
  }

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    state.app = {};
  });

  it("never carries tenant A's label to tenant B or to a signed-out state, and keeps the static layer", () => {
    mount();
    // 1. Tenant A sets both roles.
    expect(show(admin('a', { locale: 'en', roles: { ...UNSET, FINANCE: 'Billing', SCHEDULER: 'Dispatch' } }))).toBe(
      'Billing|Dispatch',
    );
    expect(state.app).toEqual({}); // deepMerge did not write into the static layer
    // 2. Tenant B sets only FINANCE: A's SCHEDULER label must not survive.
    expect(show(admin('b', { locale: 'en', roles: { ...UNSET, FINANCE: 'Invoicing' } }))).toBe('Invoicing|Scheduler');
    expect(show(admin('b', null))).toBe('Finance|Scheduler');
    // 3. Signed out.
    expect(show(null)).toBe('Finance|Scheduler');

    // 4. Fresh mount: APP_I18N_OVERRIDES is a module constant in production
    // and cannot change under a mounted boundary.
    act(() => root.unmount());
    container.remove();
    state.app = { roles: { FINANCE: 'Static Finance' } };
    mount();
    expect(show(admin('b', null))).toBe('Static Finance|Scheduler');
    expect(state.app).toEqual({ roles: { FINANCE: 'Static Finance' } }); // unmutated
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/app-i18n-tenant-overrides.test.tsx lib/app-i18n-tenant-isolation.test.tsx`
Expected: FAIL. Every case that expects a tenant value fails (for example `expected '…Finance…' to match />Billing<\/span>/`, and `expected 'Finance|Scheduler' to be 'Billing|Dispatch'`), because the provider does not read `currentAdmin` yet. Cases that expect only defaults or the static layer pass already.

- [ ] **Step 3: Compose the tenant layer in `AppI18nProvider`**

Replace the contents of `apps/web/components/layout/app-i18n-provider.tsx` with:

```tsx
'use client';

import { useCurrentAdminQuery } from '@clensy/client';
import { ClensyI18nProvider, deepMerge } from '@clensy/web';
import { useLocale } from 'next-intl';
import { useMemo, type ReactNode } from 'react';

import { APP_I18N_OVERRIDES } from '../../lib/clensy-i18n-overrides';
import { tenantLayer } from '../../lib/tenant-label-overrides';

// The app i18n boundary (single app i18n provider spec §3, §4.2, as amended
// by the tenant label overrides spec §4.6): the one application-owned
// ClensyI18nProvider mount, placed by app/app/layout.tsx. The locale comes
// only from next-intl. Overrides come from exactly two sources: the static
// APP_I18N_OVERRIDES and currentAdmin.tenantLabelOverrides. Precedence is
// tenant > static > package default, so the tenant layer is deepMerge's
// second argument. Children render while currentAdmin loads; cached data
// during a refetch still applies. There is deliberately no overrides/locale
// prop (amended §4.5 item 9).
export function AppI18nProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const { data } = useCurrentAdminQuery();
  const tenantLabelOverrides = data?.currentAdmin?.tenantLabelOverrides;
  const overrides = useMemo(
    () => deepMerge(APP_I18N_OVERRIDES, tenantLayer(tenantLabelOverrides, locale)),
    [tenantLabelOverrides, locale],
  );
  return (
    <ClensyI18nProvider locale={locale} overrides={overrides}>
      {children}
    </ClensyI18nProvider>
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/app-i18n-tenant-overrides.test.tsx lib/app-i18n-tenant-isolation.test.tsx lib/app-i18n-boundary.test.tsx`
Expected: PASS. The unchanged `app-i18n-boundary.test.tsx` is a **characterization** run: its `@clensy/client` mock carries no `tenantLabelOverrides`, so the tenant layer is `{}` and its static-layer `Billing` still applies.

Run: `pnpm --filter web exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/layout/app-i18n-provider.tsx apps/web/lib/app-i18n-tenant-overrides.test.tsx apps/web/lib/app-i18n-tenant-isolation.test.tsx apps/web/package.json pnpm-lock.yaml
git commit -m "feat(118): layer tenant label overrides over the static app layer"
```

---

### Task 9: Structural guard additions (spec §4.5, §4.6 item 9, §6.2)

**Files:**
- Modify: `apps/web/lib/web-shell-regressions.test.ts`

**Interfaces:**
- Consumes: `readWebSource` (already in the file).
- Produces: source-level pins for the session-transition order and for the children-only provider with its two override sources.

Every new assertion here pins behavior that Tasks 1–8 leave correct. These are **characterization tests**: they pass when written, and the RED check is done by deliberate mutation in Step 2. Each mutation is reverted by undoing that one edit (or by restoring a `mktemp` backup taken first), never by `git checkout --`, so unrelated uncommitted work is safe.

- [ ] **Step 1: Add the assertions**

In `apps/web/lib/web-shell-regressions.test.ts`, replace:

```ts
    expect(handleLogin).toMatch(/await apolloClient\.clearStore\(\);\s*router\.push\('\/app'\)/);
  });
```

with:

```ts
    expect(handleLogin).toMatch(/await apolloClient\.clearStore\(\);\s*router\.push\('\/app'\)/);
    // Tenant label overrides spec §4.5: confirm the session, then clear, then navigate.
    expect(handleLogin).toMatch(
      /if \(!result\.data\?\.login\.success\)[\s\S]*await apolloClient\.clearStore\(\);\s*router\.push\('\/app'\)/,
    );
  });

  // Tenant label overrides spec §4.5, §4.7 item 9: the logout session
  // transition confirms the server-side logout, then clears the Apollo
  // store, then navigates.
  it('ends the session, then clears the Apollo cache, then leaves /app on logout', () => {
    const userMenu = readWebSource('components/layout/user-menu.tsx');
    const handleLogout = /async function handleLogout\(\)[\s\S]*?\n {2}\}/.exec(userMenu)?.[0] ?? '';

    expect(handleLogout).toMatch(
      /await logout\(\);\s*if \(!result\.data\?\.logout\) throw[\s\S]*await apolloClient\.clearStore\(\);\s*router\.replace\('\/login'\)/,
    );
  });

  // Amended single app i18n provider spec §4.5 items 5 and 9; tenant label
  // overrides spec §4.4, §4.5. Pins the provider's invariants directly.
  it('keeps AppI18nProvider children-only, composing exactly the static and currentAdmin layers', () => {
    const provider = readWebSource('components/layout/app-i18n-provider.tsx');

    // 1. Children-only signature.
    expect(provider).toContain('export function AppI18nProvider({ children }: { children: ReactNode })');
    // 2. Locale only from next-intl.
    expect(provider).toContain('const locale = useLocale();');
    // 3. Default cache-first query, data only: no options (so no fetchPolicy /
    //    network-only), and no loading or error destructured, so neither gates
    //    rendering nor clears the tenant layer.
    expect(provider).toContain('const { data } = useCurrentAdminQuery();');
    expect(provider.match(/useCurrentAdminQuery\(/g)).toHaveLength(1);
    expect(provider).not.toMatch(/fetchPolicy|network-only/);
    // 4–6. Static layer first, tenant layer second (tenant wins), memoized on
    //      the tenant overrides and locale.
    expect(provider).toMatch(
      /useMemo\(\s*\(\) => deepMerge\(APP_I18N_OVERRIDES, tenantLayer\(tenantLabelOverrides, locale\)\),\s*\[tenantLabelOverrides, locale\],?\s*\)/,
    );
    // 7. The merged value is the only overrides input to the provider mount.
    expect(provider).toContain('<ClensyI18nProvider locale={locale} overrides={overrides}>');
  });
```

- [ ] **Step 2: Run, then confirm each new assertion fails when it should (mutation RED check)**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: PASS, including the existing §6.1 AST guard (one mount, zero escapes, layout wiring). The new `deepMerge` import from `@clensy/web` is not a provider binding and not a deep import.

Then mutate and revert, one at a time:

- In `user-menu.tsx`, swap the `clearStore()` and `router.replace('/login')` lines. Expected: the logout test FAILS. Revert.
- In `login/page.tsx`, move `await apolloClient.clearStore();` above `const result = await login(…)`. Expected: the login test FAILS. Revert.
- In `app-i18n-provider.tsx`, swap the `deepMerge` arguments. Expected: the children-only test FAILS, and so does Task 8's `lets the tenant layer win` test. Revert.
- In `app-i18n-provider.tsx`, change `useCurrentAdminQuery()` to `useCurrentAdminQuery({ fetchPolicy: 'network-only' })`. Expected: the children-only test FAILS. Revert.

Run: `git diff --stat -- apps/web/components apps/web/app`
Expected: no change introduced by the mutations; the output matches what it was before Step 2 (empty on a clean tree).

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/web-shell-regressions.test.ts
git commit -m "test(118): pin session-transition order and the two-layer provider"
```

---

### Final verification

- [ ] Run: `pnpm run lint`
  Expected: no errors.
- [ ] Run: `pnpm --filter api exec tsc --noEmit && pnpm --filter web exec tsc --noEmit && pnpm --filter @clensy/client build && pnpm --filter @clensy/web build`
  Expected: no errors.
- [ ] Run: `pnpm run test`
  Expected: every workspace suite passes. This includes the API unit tests (Tasks 1 and 3), `@clensy/web` (Task 6) and `apps/web` (Tasks 7–9).
- [ ] Run each e2e suite separately:
  - `pnpm --filter api exec jest --config ./test/jest-e2e.json add-tenant-label-overrides`
  - `pnpm --filter api exec jest --config ./test/jest-e2e.json tenant-label-overrides.e2e`
  - `pnpm --filter api exec jest --config ./test/jest-e2e.json admin-foundation`

  Expected: each PASSES. `admin-foundation` is a **characterization** run: it shows the `currentAdmin` and `login` selections without the new field are unchanged.
- [ ] Run: `pnpm --filter api test:e2e:release-gate`
  Expected: PASS, every phase including Phase 8.
- [ ] Run: `git status --short`
  Expected: clean. `apps/api/src/schema.gql` and `packages/client/src/generated/graphql.ts` match their committed versions.

## Traceability

| Spec section | Task(s) |
| --- | --- |
| §4.1 storage, accepted stored shape | 2 (column, migration), 1 (shape) |
| §4.2 read-path ownership | 2 (`select: false`), 3 (service is the only reader) |
| §4.2 object meaning, leaf rule, relabelable roles | 1 |
| §4.2 log-once, own path, no value, `NULL` silent | 1 (rejections), 3 (warnings) |
| §4.3 field, types, null cases, no args, `locale` | 3; 4 (isolation, Super Admin) |
| §4.3 root inventory unchanged | 4 (Phase 1a still passes) |
| §4.3 client operation | 5 |
| §4.4 mapper | 7 |
| §4.5 `deepMerge` export | 6 |
| §4.5 composition, precedence, loading/cached data, session transitions | 8, 9 |
| §4.6 amended invariants | 8 (provider), 9 (guards) |
| §4.7 items 1–10 | 1: items 4–5; 3: items 1, 3, 6; 4: items 1–2; 7: item 7; 8: item 8; 9: items 9–10 |
| §6.1 API tests, migration | 1, 2, 3, 4 |
| §6.2 web tests | 6, 7, 8, 9 |
| §6.3 unchanged suites | Final verification |

**Deferred (spec §7, §8), not in any task:** the write path (mutation, settings UI, audit, clearing), other namespaces, other locales, locale negotiation, a tenants API, per-user overrides.

## Execution risks (operational only)

- The release gate is slow (minutes) and needs the `clensy` database migrated (`pnpm --filter api migration:run`). The RED check in Task 4, Step 2 runs only Phase 8 (`-t 'Phase 8'`). The world is still built in `beforeAll`.
- `pnpm --filter web add -D jsdom` needs registry access. If it is unavailable, stop and report: Task 8's isolation test cannot run without a DOM.
- The dev API container shares the `clensy` database. Adding a nullable column does not affect it.

## Gate outcomes

*(Appended after M5. M6–M10 records are added here as they arrive.)*
