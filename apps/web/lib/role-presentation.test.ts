import { describe, expect, it } from 'vitest';
import { presentRole } from './role-presentation';

const CASES = [
  ['SUPER_ADMIN', 'Super Admin', 'SA'],
  ['TENANT_OWNER', 'Tenant Owner', 'TO'],
  ['OPS_MANAGER', 'Ops Manager', 'OM'],
  ['SCHEDULER', 'Scheduler', 'SC'],
  ['CUSTOMER_SUPPORT', 'Customer Support', 'CS'],
  ['FINANCE', 'Finance', 'FI'],
  ['ANALYST', 'Analyst', 'AN'],
] as const;

describe('presentRole', () => {
  it.each(CASES)('%s → %s / %s', (role, label, initials) => {
    expect(presentRole(role)).toEqual({ initials, label });
  });

  it('returns undefined for null, undefined, empty, and unknown', () => {
    expect(presentRole(null)).toBeUndefined();
    expect(presentRole(undefined)).toBeUndefined();
    expect(presentRole('')).toBeUndefined();
    expect(presentRole('SUPERADMIN')).toBeUndefined();
  });

  it('no longer presents the retired OWNER role', () => {
    expect(presentRole('OWNER')).toBeUndefined();
  });
});
