import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot = resolve(import.meta.dirname, '..');

function readWebSource(relativePath: string) {
  return readFileSync(resolve(webRoot, relativePath), 'utf8');
}

// Multi-tenant spec §4.3 / plan Task 9: the retired OWNER role must not be
// checked or offered anywhere in the console. These are UX gates only — the
// API enforces RBAC independently.
describe('tenant role contract in the staff console', () => {
  it('gates the staff admin page on TENANT_OWNER', () => {
    const adminPage = readWebSource('app/app/admin/page.tsx');

    expect(adminPage).toContain("currentAdmin?.role === 'TENANT_OWNER'");
  });

  it('offers operational roles and TENANT_OWNER on create, never SUPER_ADMIN', () => {
    const adminPage = readWebSource('app/app/admin/page.tsx');
    const roleOptions = /const ROLE_OPTIONS: Role\[\] = \[([^\]]*)\]/.exec(
      adminPage,
    )?.[1];

    expect(roleOptions).toBeDefined();
    const options = roleOptions!.match(/'[A-Z_]+'/g)?.map((o) => o.slice(1, -1));
    expect(options?.sort()).toEqual(
      [
        'ANALYST',
        'CUSTOMER_SUPPORT',
        'FINANCE',
        'OPS_MANAGER',
        'SCHEDULER',
        'TENANT_OWNER',
      ].sort(),
    );
  });

  it.each(['app/app/admin/page.tsx', 'app/app/laundry/page.tsx'])(
    'no longer references the retired OWNER role in %s',
    (path) => {
      expect(readWebSource(path)).not.toMatch(/(?<!TENANT_)'OWNER'/);
    },
  );
});
