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
    label: 'Operations',
    items: [
      { label: 'Bookings', href: '/app/bookings' },
      { label: 'Jobs', href: '/app/jobs' },
      { label: 'Laundry', href: '/app/laundry' },
      { label: 'Invoices', href: '/app/billing' },
    ],
  },
  {
    label: 'People',
    items: [
      { label: 'Customers', href: '/app/customers' },
      { label: 'Cleaners', href: '/app/cleaners' },
      { label: 'Teams', href: '/app/cleaners/teams' },
    ],
  },
  {
    label: 'Catalog',
    items: [
      { label: 'Services', href: '/app/catalog' },
      { label: 'Add-ons', href: '/app/catalog/add-ons' },
    ],
  },
  {
    label: 'Administration',
    items: [{ label: 'Staff', href: '/app/admin' }],
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
