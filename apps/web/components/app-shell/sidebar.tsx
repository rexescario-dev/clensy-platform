'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useSidebarCollapsed } from '../../lib/use-sidebar-collapsed';

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

// Spec §4.2's grouped nav. Order and hrefs mirror the route table verified
// in Task 5 Step 0.
const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operations',
    items: [{ label: 'Bookings', href: '/app/bookings' }, { label: 'Jobs', href: '/app/jobs' }],
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

// Leading-segment match: a link is active when the current path equals its
// href or is nested under it. Multiple hrefs can match at once (e.g.
// `/app/cleaners` is a prefix of `/app/cleaners/teams`) — only the longest
// (most specific) match should be highlighted, so `/app/cleaners/teams`
// lights up "Teams", not "Cleaners".
function findActiveHref(pathname: string): string | undefined {
  const matches = ALL_HREFS.filter((href) => pathname === href || pathname.startsWith(`${href}/`));
  if (matches.length === 0) return undefined;
  return matches.reduce((longest, current) => (current.length > longest.length ? current : longest));
}

interface SidebarProps {
  mobileNavOpen: boolean;
  onMobileNavClose: () => void;
}

export function Sidebar({ mobileNavOpen, onMobileNavClose }: SidebarProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const activeHref = findActiveHref(pathname ?? '');

  // Spec §4.2: the off-canvas drawer "closes automatically after a
  // navigation" — watch the pathname and close it on every route change.
  // Intentionally depends only on `pathname`, not `onMobileNavClose` — the
  // latter is a fresh closure from `AppShell` on every render, and this
  // effect only needs to fire on route changes, not on every parent
  // re-render.
  useEffect(() => {
    onMobileNavClose();
  }, [pathname]);

  return (
    <>
      {/* Desktop rail/expanded sidebar (md: and above). */}
      <nav
        aria-label="Primary"
        className={`hidden shrink-0 flex-col border-r border-slate-200 bg-white py-4 md:flex ${
          collapsed ? 'w-16' : 'w-56'
        }`}
      >
        <SidebarContent collapsed={collapsed} activeHref={activeHref} />
        <div className="mt-auto px-2 pt-4">
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full rounded-md px-2 py-2 text-left text-xs font-medium text-slate-500 hover:bg-slate-50"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? '»' : '« Collapse'}
          </button>
        </div>
      </nav>

      {/* Mobile off-canvas drawer (below md:). `inert` (not just
          `aria-hidden`) when closed: the nav `<Link>`s inside stay mounted
          through the close transition, so they're still real, focusable DOM
          nodes — `aria-hidden` alone hides them from assistive tech but
          doesn't stop a keyboard user from Tabbing into them (WCAG 4.1.2).
          `inert` makes the whole subtree both unfocusable and hidden from
          assistive tech in one attribute; React supports it as a plain
          boolean DOM attribute. */}
      <div
        className={`fixed inset-0 z-40 md:hidden ${mobileNavOpen ? '' : 'pointer-events-none'}`}
        inert={!mobileNavOpen}
      >
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity ${
            mobileNavOpen ? 'opacity-100' : 'opacity-0'
          }`}
          onClick={onMobileNavClose}
        />
        <nav
          aria-label="Primary"
          className={`absolute inset-y-0 left-0 flex w-64 flex-col overflow-y-auto bg-white py-4 shadow-lg transition-transform duration-200 ${
            mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <SidebarContent collapsed={false} activeHref={activeHref} />
        </nav>
      </div>
    </>
  );
}

function SidebarContent({ collapsed, activeHref }: { collapsed: boolean; activeHref?: string }) {
  return (
    <div className="flex flex-col gap-6 px-2">
      {NAV_GROUPS.map((group) => (
        <div key={group.label} className="flex flex-col gap-1">
          {!collapsed ? (
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{group.label}</p>
          ) : null}
          {group.items.map((item) => {
            const isActive = item.href === activeHref;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium ${
                  isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-50'
                } ${collapsed ? 'justify-center' : ''}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded text-xs font-semibold ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {item.label.charAt(0)}
                </span>
                {!collapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
