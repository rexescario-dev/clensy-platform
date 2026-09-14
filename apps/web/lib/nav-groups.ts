export interface NavItem {
  href: string;
  labelKey: string;
}

export interface NavGroup {
  items: NavItem[];
  labelKey: string;
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/app/bookings', labelKey: 'items.bookings' },
      { href: '/app/jobs', labelKey: 'items.jobs' },
      { href: '/app/laundry', labelKey: 'items.laundry' },
      { href: '/app/billing', labelKey: 'items.invoices' },
    ],
    labelKey: 'groups.operations',
  },
  {
    items: [
      { href: '/app/customers', labelKey: 'items.customers' },
      { href: '/app/cleaners', labelKey: 'items.cleaners' },
      { href: '/app/cleaners/teams', labelKey: 'items.teams' },
    ],
    labelKey: 'groups.people',
  },
  {
    items: [
      { href: '/app/catalog', labelKey: 'items.services' },
      { href: '/app/catalog/add-ons', labelKey: 'items.addOns' },
    ],
    labelKey: 'groups.catalog',
  },
  {
    items: [{ href: '/app/admin', labelKey: 'items.staff' }],
    labelKey: 'groups.administration',
  },
];

const ALL_HREFS = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));

export function findActiveHref(pathname: string): string | undefined {
  return ALL_HREFS.filter(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  ).reduce<string | undefined>(
    (longest, current) =>
      longest === undefined || current.length > longest.length ? current : longest,
    undefined,
  );
}
