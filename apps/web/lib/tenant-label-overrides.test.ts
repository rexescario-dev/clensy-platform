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
