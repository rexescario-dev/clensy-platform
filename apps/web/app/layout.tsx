import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ApolloProvider } from './apollo-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Clensy',
  description: 'Clensy admin',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ApolloProvider>{children}</ApolloProvider>
      </body>
    </html>
  );
}
