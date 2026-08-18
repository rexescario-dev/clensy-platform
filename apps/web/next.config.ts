import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `@clensy/client` and `@clensy/ui` ship TypeScript source directly
  // (package.json "main": "src/index.ts", no build step) rather than a
  // pre-built dist — Next.js has to transpile them itself.
  transpilePackages: ['@clensy/client', '@clensy/ui'],

  // Legacy pre-`/app/*` URLs, redirected to their new locations. Task 5
  // adds the Admin entry; Tasks 6-8 each append their own module's
  // entries to this same array — never replace it. Before committing any
  // task that touches this array, re-read it in full and confirm every
  // entry added by an earlier task is still present.
  async redirects() {
    return [
      { source: '/admin', destination: '/app/admin', permanent: true },
      { source: '/customers', destination: '/app/customers', permanent: true },
      { source: '/customers/:id', destination: '/app/customers?detail=:id', permanent: true },
      { source: '/cleaners', destination: '/app/cleaners', permanent: true },
      // `/cleaners/teams` and `/cleaners/teams/:id` are listed before the
      // more general `/cleaners/:id` even though the brief's snippet had
      // them after it: Next.js checks `redirects()` entries in array order,
      // and `:id` matches any single path segment — including the literal
      // "teams" — so with the brief's original ordering, a request for
      // `/cleaners/teams` would have matched `/cleaners/:id` first and
      // redirected to `/app/cleaners?detail=teams` instead of
      // `/app/cleaners/teams`. Reordering the more specific `/cleaners/teams*`
      // entries first (same fix Task 5/6 already apply implicitly by not
      // having this collision) avoids that. See task-7-report.md for the
      // verification that confirmed this.
      { source: '/cleaners/teams', destination: '/app/cleaners/teams', permanent: true },
      { source: '/cleaners/teams/:id', destination: '/app/cleaners/teams?detail=:id', permanent: true },
      { source: '/cleaners/:id', destination: '/app/cleaners?detail=:id', permanent: true },
    ];
  },
};

export default nextConfig;
