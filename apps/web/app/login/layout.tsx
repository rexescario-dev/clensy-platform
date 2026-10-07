import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

// /login's one title source (document titles spec §4.4): the bare app title,
// now that the root layout sets none.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('documentTitle.app') };
}

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
