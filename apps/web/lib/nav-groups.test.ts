import type { AdminScope, Role } from '@clensy/client';
import { describe, expect, it } from 'vitest';
import {
  NAV_GROUPS,
  PLATFORM_HOME_HREF,
  canViewPath,
  findActiveHref,
  isGatedPath,
  landingHref,
  visibleNavGroups,
  type NavPrincipal,
} from './nav-groups';

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

const ALL_ROLES: Role[] = ['ANALYST', 'CUSTOMER_SUPPORT', 'FINANCE', 'OPS_MANAGER', 'SCHEDULER', 'SUPER_ADMIN', 'TENANT_OWNER'];
const ALL_SCOPES: AdminScope[] = ['PLATFORM', 'TENANT'];

// Every role × scope pair, including the inconsistent ones (SUPER_ADMIN in
// TENANT scope), so the rules are pinned for any principal shape.
const ALL_PRINCIPALS: [string, NavPrincipal][] = ALL_ROLES.flatMap((role) =>
  ALL_SCOPES.map((scope): [string, NavPrincipal] => [`${role}/${scope}`, { role, scope }]),
);

// Paths that share only a string prefix with a shell path, plus the
// landing, an unknown path and the empty pathname: all ungated (spec §3).
const UNGATED_PATHS = ['/app', '', '/app/does-not-exist', '/app/customers-old', '/app/customers2', '/app/platformx'];

// The spec §3 segment match, restated independently of the implementation.
function segmentMatches(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
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

  // Characterization (already true on main): spec §4.1 makes these
  // segment-boundary semantics a contract.
  it('matches on path segments, not string prefixes', () => {
    expect(findActiveHref('/app/customers-old')).toBeUndefined();
    expect(findActiveHref('/app/customers2')).toBeUndefined();
    expect(findActiveHref('/app/cleaners/teams/x')).toBe(TEAMS);
    expect(findActiveHref('/app/catalog/add-ons/x')).toBe(ADD_ONS);
    // Beneath /app/cleaners, not a Teams match.
    expect(findActiveHref('/app/cleaners/teams-extra')).toBe(CLEANERS);
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
    expect(landingHref({ role: 'TENANT_OWNER', scope: 'PLATFORM' })).toBe(PLATFORM_HOME_HREF);
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

describe('isGatedPath', () => {
  it.each(ALL_TENANT_HREFS)('gates %s and the paths beneath it', (href) => {
    expect(isGatedPath(href)).toBe(true);
    expect(isGatedPath(`${href}/nested`)).toBe(true);
  });

  it('gates the platform path and the paths beneath it', () => {
    expect(isGatedPath(PLATFORM_HOME_HREF)).toBe(true);
    expect(isGatedPath(`${PLATFORM_HOME_HREF}/x`)).toBe(true);
  });

  it.each(UNGATED_PATHS)('does not gate %j', (pathname) => {
    expect(isGatedPath(pathname)).toBe(false);
  });
});

describe('canViewPath', () => {
  describe.each(ALL_PRINCIPALS)('for %s', (_label, principal) => {
    it.each(ALL_TENANT_HREFS)('agrees with the sidebar on %s and on the paths beneath it', (href) => {
      const shownInSidebar = visibleHrefs(principal).includes(href);
      expect(canViewPath(principal, href)).toBe(shownInSidebar);
      expect(canViewPath(principal, `${href}/nested`)).toBe(canViewPath(principal, href));
    });

    it('views the platform path and the paths beneath it only in PLATFORM scope', () => {
      expect(canViewPath(principal, PLATFORM_HOME_HREF)).toBe(principal.scope === 'PLATFORM');
      expect(canViewPath(principal, `${PLATFORM_HOME_HREF}/x`)).toBe(principal.scope === 'PLATFORM');
    });

    it('views every ungated path', () => {
      for (const pathname of UNGATED_PATHS) expect(canViewPath(principal, pathname)).toBe(true);
    });
  });

  it('applies the Cleaners rule to /app/cleaners/teams-extra', () => {
    expect(canViewPath(tenant('CUSTOMER_SUPPORT'), '/app/cleaners/teams-extra')).toBe(false);
    expect(canViewPath(tenant('ANALYST'), '/app/cleaners/teams-extra')).toBe(true);
  });

  // Spec §4.6 worked examples.
  it('denies and allows the worked examples', () => {
    expect(canViewPath(tenant('FINANCE'), CUSTOMERS)).toBe(false);
    expect(canViewPath(tenant('FINANCE'), `${CUSTOMERS}/123`)).toBe(false);
    expect(canViewPath(tenant('CUSTOMER_SUPPORT'), TEAMS)).toBe(false);
    expect(canViewPath(tenant('OPS_MANAGER'), STAFF)).toBe(false);
    expect(canViewPath({ role: 'SUPER_ADMIN', scope: 'PLATFORM' }, BOOKINGS)).toBe(false);
    expect(canViewPath(tenant('SCHEDULER'), PLATFORM_HOME_HREF)).toBe(false);
    expect(canViewPath(tenant('TENANT_OWNER'), STAFF)).toBe(true);
    expect(canViewPath({ role: 'SUPER_ADMIN', scope: 'PLATFORM' }, PLATFORM_HOME_HREF)).toBe(true);
  });
});

describe('PLATFORM_HOME_HREF reservation', () => {
  // Spec §5 invariant 9: rule 1 (nav items) can never shadow rule 2
  // (platform path), or the reverse.
  it('neither segment-matches nor is segment-matched by any nav href', () => {
    for (const { href } of NAV_GROUPS.flatMap((group) => group.items)) {
      expect(segmentMatches(PLATFORM_HOME_HREF, href)).toBe(false);
      expect(segmentMatches(href, PLATFORM_HOME_HREF)).toBe(false);
    }
  });
});
