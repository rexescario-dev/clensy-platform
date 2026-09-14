export interface NavItem {
  label: string;
  href: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: '/app/bookings', label: 'Bookings' },
      { href: '/app/jobs', label: 'Jobs' },
      { href: '/app/laundry', label: 'Laundry' },
      { href: '/app/billing', label: 'Invoices' },
    ],
    label: 'Operations',
  },
  {
    items: [
      { href: '/app/customers', label: 'Customers' },
      { href: '/app/cleaners', label: 'Cleaners' },
      { href: '/app/cleaners/teams', label: 'Teams' },
    ],
    label: 'People',
  },
  {
    items: [
      { href: '/app/catalog', label: 'Services' },
      { href: '/app/catalog/add-ons', label: 'Add-ons' },
    ],
    label: 'Catalog',
  },
  {
    items: [{ href: '/app/admin', label: 'Staff' }],
    label: 'Administration',
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
