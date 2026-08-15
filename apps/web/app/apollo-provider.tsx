'use client';

import { ApolloProvider as ApolloClientProvider } from '@apollo/client';
import { apolloClient } from '@clensy/client';
import type { ReactNode } from 'react';

// Thin client-component wrapper so `app/layout.tsx` (a server component) can
// still provide Apollo context to every page below it. `apolloClient` itself
// (packages/client/src/apollo-client.ts) is a plain module-level singleton —
// this component's only job is bridging it into React context inside the
// 'use client' boundary that `@apollo/client`'s hooks require.
export function ApolloProvider({ children }: { children: ReactNode }) {
  return <ApolloClientProvider client={apolloClient}>{children}</ApolloClientProvider>;
}
