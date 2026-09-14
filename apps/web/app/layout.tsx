import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { ApolloProvider } from './apollo-provider';
import './globals.css';

export const metadata: Metadata = {
  description: 'Clensy admin',
  title: 'Clensy',
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
