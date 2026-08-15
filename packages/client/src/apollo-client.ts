import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';

// URL of apps/api's GraphQL endpoint (default Apollo path mounted by
// platform/graphql/graphql.module.ts). `NEXT_PUBLIC_` so Next.js inlines it
// into the browser bundle — this client is meant to run client-side, where
// the browser (not Next's server) is what needs to attach the session
// cookie. Falls back to the local dev API (apps/api/src/main.ts defaults to
// port 3000) so apps/web works against a local backend with zero config.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/graphql';

export const apolloClient = new ApolloClient({
  link: new HttpLink({
    uri: API_URL,
    // Required so the browser sends the HttpOnly session cookie set by
    // apps/api's `login` mutation across the apps/web <-> apps/api origin
    // boundary (spec §4; matches apps/api/src/main.ts's
    // `enableCors({ credentials: true, ... })`).
    credentials: 'include',
  }),
  cache: new InMemoryCache(),
});
