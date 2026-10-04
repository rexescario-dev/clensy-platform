'use client';

import { useCurrentAdminQuery } from '@clensy/client';
import { ClensyI18nProvider, deepMerge } from '@clensy/web';
import { useLocale } from 'next-intl';
import { useMemo, type ReactNode } from 'react';

import { APP_I18N_OVERRIDES } from '../../lib/clensy-i18n-overrides';
import { tenantLayer } from '../../lib/tenant-label-overrides';

// The app i18n boundary (single app i18n provider spec §3, §4.2, as amended
// by the tenant label overrides spec §4.6): the one application-owned
// ClensyI18nProvider mount, placed by app/app/layout.tsx. The locale comes
// only from next-intl. Overrides come from exactly two sources: the static
// APP_I18N_OVERRIDES and currentAdmin.tenantLabelOverrides. Precedence is
// tenant > static > package default, so the tenant layer is deepMerge's
// second argument. Children render while currentAdmin loads; cached data
// during a refetch still applies. There is deliberately no overrides/locale
// prop (amended §4.5 item 9).
export function AppI18nProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  const { data } = useCurrentAdminQuery();
  const tenantLabelOverrides = data?.currentAdmin?.tenantLabelOverrides;
  const overrides = useMemo(
    () => deepMerge(APP_I18N_OVERRIDES, tenantLayer(tenantLabelOverrides, locale)),
    [tenantLabelOverrides, locale],
  );
  return (
    <ClensyI18nProvider locale={locale} overrides={overrides}>
      {children}
    </ClensyI18nProvider>
  );
}
