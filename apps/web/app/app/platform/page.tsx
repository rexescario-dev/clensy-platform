'use client';

import { PageHeader } from '@clensy/ui';
import { useTranslations } from 'next-intl';

// Super Admin's landing. The platform control plane is deferred
// (multi-tenant spec §10), so this page is presentation only and makes no
// API calls. Reaching it grants nothing: the API still denies Super Admin
// every tenant business operation (§4.2).
export default function PlatformPage() {
  const t = useTranslations('nav');
  return <PageHeader title={t('platform.title')} description={t('platform.description')} />;
}
