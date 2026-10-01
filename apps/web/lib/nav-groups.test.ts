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
