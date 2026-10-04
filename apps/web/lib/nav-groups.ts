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

// Whether the principal may be shown the page at pathname (role-aware typed
// URLs spec §4.1). A client-side presentation rule derived from the shell
// navigation policy; it does not grant, deny, or replace API authorization
// (multi-tenant spec §4.2, §5.13). A nav item path follows the sidebar, a
// platform path needs PLATFORM scope, and an ungated path (/app, or a path
// with no shell rule) is always viewable.
export function canViewPath(principal: NavPrincipal, pathname: string): boolean {
  const href = findActiveHref(pathname);
  if (href !== undefined) {
    return visibleNavGroups(principal).some((group) => group.items.some((item) => item.href === href));
  }
  if (isPlatformPath(pathname)) return principal.scope === 'PLATFORM';
  return true;
}

export function findActiveHref(pathname: string): string | undefined {
  return ALL_HREFS.filter((href) => segmentMatches(pathname, href)).reduce<string | undefined>(
    (longest, current) =>
      longest === undefined || current.length > longest.length ? current : longest,
    undefined,
  );
}

// Whether pathname needs a visibility decision at all: a nav item path or a
// platform path (spec §4.1). /app and unknown/unlisted paths need no
// principal. Presentation only, like canViewPath.
export function isGatedPath(pathname: string): boolean {
  return findActiveHref(pathname) !== undefined || isPlatformPath(pathname);
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

// PLATFORM_HOME_HREF is a reserved non-nav shell path (spec §5 invariant 9).
function isPlatformPath(pathname: string): boolean {
  return segmentMatches(pathname, PLATFORM_HOME_HREF);
}

// The one segment-match definition (spec §3): the href itself or a path
// beneath it, never a bare string prefix (/app/customers-old is no match).
function segmentMatches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
