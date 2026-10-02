'use client';

import { ClensyI18nProvider } from '@clensy/web';
import { useLocale } from 'next-intl';
import type { ReactNode } from 'react';

import { APP_I18N_OVERRIDES } from '../../lib/clensy-i18n-overrides';

// The app i18n boundary (single app i18n provider spec §3, §4.2): the one
// application-owned ClensyI18nProvider mount, placed by app/app/layout.tsx.
// The locale comes only from next-intl, and application-owned overrides only
// from APP_I18N_OVERRIDES. There is deliberately no overrides/locale prop
// (§4.5 item 9).
export function AppI18nProvider({ children }: { children: ReactNode }) {
  const locale = useLocale();
  return (
    <ClensyI18nProvider locale={locale} overrides={APP_I18N_OVERRIDES}>
      {children}
    </ClensyI18nProvider>
  );
}
