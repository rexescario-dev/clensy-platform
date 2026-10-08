import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { ApolloProvider } from './apollo-provider';
import './globals.css';

// No title here (document titles spec §4.4): a root title would be
// server-rendered ahead of the /app gate's title element and win document.title.
// /app titles come from PageVisibilityGate, /login's from app/login/layout.tsx.
export const metadata: Metadata = {
  description: 'Clensy admin',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider>
          <ApolloProvider>{children}</ApolloProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
