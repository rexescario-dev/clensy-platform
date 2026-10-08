import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { STAFF_ROLE_OPTIONS } from '@clensy/web';
import { describe, expect, it } from 'vitest';

const webRoot = resolve(import.meta.dirname, '..');

function readWebSource(relativePath: string) {
  return readFileSync(resolve(webRoot, relativePath), 'utf8');
}

// Multi-tenant spec §4.3 / plan Task 9: the retired OWNER role must not be
// checked or offered anywhere in the console. These are UX gates only — the
// API enforces RBAC independently.
describe('tenant role contract in the staff console', () => {
  // Role-aware typed URLs spec §4.5: the /app layout's PageVisibilityGate
  // decides whether the staff page is shown. Session routing spec §4.5: the
  // layout's SessionGuard owns the /login redirect; the page keeps its own
  // currentAdmin read and shows the load error when it fails.
  it('leaves visibility to the layout gate and the session redirect to the layout guard', () => {
    const adminPage = readWebSource('app/app/admin/page.tsx');

    expect(adminPage).not.toContain('canManageStaff');
    expect(adminPage).not.toContain('notAuthorized');
    expect(adminPage).not.toMatch(/role === 'TENANT_OWNER'/);
    expect(adminPage).not.toMatch(/tenantId === null/);
    expect(adminPage).toContain("useCurrentAdminQuery({ fetchPolicy: 'network-only' })");
    expect(adminPage).not.toContain('/login');
    expect(adminPage).not.toContain('useRouter');
    expect(adminPage).toContain("t('loadError')");
    expect(adminPage).toContain('<StaffConsole currentAdminId={currentAdmin.id} />');
  });

  it('retires the canManageStaff helper', () => {
    expect(readWebSource('lib/staff-console.ts')).not.toContain('canManageStaff');
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

  it('fills the disable confirmation through disableConfirmDescription, not a raw String.replace', () => {
    const adminPage = readWebSource('app/app/admin/page.tsx');

    expect(adminPage).toContain('disableConfirmDescription(');
    expect(adminPage).not.toMatch(/\.replace\('\{email\}'/);
  });

  // No DOM test environment exists in this repo, so the page's error-state
  // transition is pinned at source level: starting a new create clears a
  // stale disable error, so it can't linger after a later successful create.
  it('clears a stale disable error when the create dialog opens', () => {
    const adminPage = readWebSource('app/app/admin/page.tsx');
    const openCreateForm = /function openCreateForm\(\) \{([^}]*)\}/.exec(adminPage)?.[1];

    expect(openCreateForm).toBeDefined();
    expect(openCreateForm).toContain('setDisableErrorKey(undefined)');
  });

  it.each(['app/app/admin/page.tsx', 'app/app/laundry/page.tsx'])(
    'no longer references the retired OWNER role in %s',
    (path) => {
      expect(readWebSource(path)).not.toMatch(/(?<!TENANT_)'OWNER'/);
    },
  );
});
