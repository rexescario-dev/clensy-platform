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

  it.each(['app/app/admin/page.tsx', 'app/app/laundry/page.tsx'])(
    'no longer references the retired OWNER role in %s',
    (path) => {
      expect(readWebSource(path)).not.toMatch(/(?<!TENANT_)'OWNER'/);
    },
  );
});
