'use client';

import { useCurrentAdminQuery } from '@clensy/client';
import { LoadingState } from '@clensy/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { canViewPath, isGatedPath, landingHref, type NavPrincipal } from '../../lib/nav-groups';

// The one /app page-visibility gate (role-aware typed URLs spec §4.2),
// mounted by app/app/layout.tsx. A client-side presentation rule derived from
// the shell navigation policy, not authorization: the API stays the boundary
// (multi-tenant spec §4.2, §5.13). It never redirects and makes no session
// decision; with no principal the page mounts and keeps its own behavior. A
// denied page is never rendered, so its hooks and queries never run.
export function PageVisibilityGate({ children }: { children: ReactNode }) {
  const t = useTranslations('nav');
  const pathname = usePathname() ?? '';
  // Default cache-first, sharing the sidebar's and user menu's read. Called
  // on every render (rules of hooks) even where the result is unused.
  const { data, error, loading } = useCurrentAdminQuery();
  const principal = data?.currentAdmin;

  if (!isGatedPath(pathname)) return children;
  if (principal) {
    return canViewPath(principal, pathname) ? children : <UnavailableState principal={principal} />;
  }
  if (!error && loading) return <LoadingState message={t('landing.loading')} />;
  return children;
}

// The shared state for every denied path (spec §4.3): no roles or scopes
// named, one way home through the same landing rule as /app. Its message is
// the page's single <h1>, styled as the former EmptyState message.
function UnavailableState({ principal }: { principal: NavPrincipal }) {
  const t = useTranslations('nav');
  const home = landingHref(principal);

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-3 py-10 text-center text-slate-500">
      <h1 className="text-sm">{t('unavailable.message')}</h1>
      {home ? (
        <div>
          <Link href={home} className="text-sm font-medium text-slate-900 underline underline-offset-4">
            {t('unavailable.action')}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
