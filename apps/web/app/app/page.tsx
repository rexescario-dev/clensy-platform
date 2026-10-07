'use client';

import { useCurrentAdminQuery } from '@clensy/client';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { landingTarget } from '../../lib/landing-target';

// Sends each principal to a destination exposed for its scope and role in
// the shell. The decision lives in lib/landing-target.ts and uses the same
// visibility rule as the sidebar (lib/nav-groups.ts): Super Admin to the
// platform placeholder, tenant users to their first visible nav item. A
// missing or invalid session is the layout SessionGuard's to route (session
// routing spec §4.4): a failed read shows the account load error, and a
// settled missing principal keeps loading while the guard redirects. UX only —
// the API remains the authorization boundary (multi-tenant spec §4.2, §5.13).
export default function AppIndexPage() {
  const t = useTranslations('nav');
  const router = useRouter();
  const { data, loading, error } = useCurrentAdminQuery({ fetchPolicy: 'network-only' });
  const currentAdmin = data?.currentAdmin;
  const target = landingTarget({ currentAdmin, error, loading });

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (!loading && error) {
    return <p className="text-sm text-slate-500">{t('landing.error')}</p>;
  }
  if (!loading && currentAdmin && !target) {
    return <p className="text-sm text-slate-500">{t('landing.empty')}</p>;
  }
  return <p className="text-sm text-slate-500">{t('landing.loading')}</p>;
}
