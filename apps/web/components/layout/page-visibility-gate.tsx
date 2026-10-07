'use client';

import { useCurrentAdminQuery } from '@clensy/client';
import { Button, LoadingState } from '@clensy/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { canViewPath, isGatedPath, landingHref, pageTitleKey, type NavPrincipal } from '../../lib/nav-groups';

// The one /app page-visibility gate (role-aware typed URLs spec §4.2),
// mounted by app/app/layout.tsx. A client-side presentation rule derived from
// the shell navigation policy, not authorization: the API stays the boundary
// (multi-tenant spec §4.2, §5.13). It never redirects and makes no session
// decision; with no principal the page mounts and keeps its own behavior. A
// denied page is never rendered, so its hooks and queries never run. It also
// owns the /app document title (document titles spec §4.3): every row renders
// exactly one <title>, describing the row actually rendered.
export function PageVisibilityGate({ children }: { children: ReactNode }) {
  const t = useTranslations('nav');
  const pathname = usePathname() ?? '';
  // Default cache-first, sharing the sidebar's and user menu's read. Called
  // on every render (rules of hooks) even where the result is unused.
  const { data, error, loading } = useCurrentAdminQuery();
  const principal = data?.currentAdmin;
  // The requested path's title, shared by every row except the unavailable
  // state; the loading row uses it too, without implying the page is viewable.
  const titleKey = pageTitleKey(pathname);
  const title = titleKey ? t('documentTitle.page', { page: t(titleKey) }) : t('documentTitle.app');

  if (!isGatedPath(pathname)) return <Titled title={title}>{children}</Titled>;
  if (principal) {
    return canViewPath(principal, pathname) ? (
      <Titled title={title}>{children}</Titled>
    ) : (
      <Titled title={t('documentTitle.page', { page: t('unavailable.title') })}>
        <UnavailableState principal={principal} />
      </Titled>
    );
  }
  if (!error && loading) {
    return (
      <Titled title={title}>
        <LoadingState message={t('landing.loading')} />
      </Titled>
    );
  }
  return <Titled title={title}>{children}</Titled>;
}

// One React <title> contribution, which React hoists into <head>; it has no
// DOM relationship to the row it accompanies (document titles spec §4.3).
function Titled({ children, title }: { children: ReactNode; title: string }) {
  return (
    <>
      <title>{title}</title>
      {children}
    </>
  );
}

// The shared state for every denied path (spec §4.3): no roles or scopes
// named, one way home through the same landing rule as /app. Its message is
// the page's single <h1>, styled as the former EmptyState message. The home
// link follows the shell-link convention (#134): Button's link variant,
// as-is, rendered onto the Link by asChild.
function UnavailableState({ principal }: { principal: NavPrincipal }) {
  const t = useTranslations('nav');
  const home = landingHref(principal);

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-3 py-10 text-center text-slate-500">
      <h1 className="text-sm">{t('unavailable.message')}</h1>
      {home ? (
        <div>
          <Button asChild variant="link">
            <Link href={home}>{t('unavailable.action')}</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
