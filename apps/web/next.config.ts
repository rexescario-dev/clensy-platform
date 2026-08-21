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
      // more general `/cleaners/:id`: Next.js checks `redirects()` entries
      // in array order, and `:id` matches any single path segment —
      // including the literal "teams" — so a request for `/cleaners/teams`
      // would otherwise match `/cleaners/:id` first and redirect to
      // `/app/cleaners?detail=teams` instead of `/app/cleaners/teams`.
      // Reordering the more specific `/cleaners/teams*` entries first
      // avoids that.
      { source: '/cleaners/teams', destination: '/app/cleaners/teams', permanent: true },
      { source: '/cleaners/teams/:id', destination: '/app/cleaners/teams?detail=:id', permanent: true },
      { source: '/cleaners/:id', destination: '/app/cleaners?detail=:id', permanent: true },
      // Same `:id`-vs-literal-segment collision as `/cleaners/teams` above:
      // `/catalog/add-ons` and `/catalog/add-ons/:id` must be listed before
      // the more general `/catalog/:id`, or a request for `/catalog/add-ons`
      // would match `/catalog/:id` first and redirect to
      // `/app/catalog?detail=add-ons` instead of `/app/catalog/add-ons`.
      { source: '/catalog', destination: '/app/catalog', permanent: true },
      { source: '/catalog/add-ons', destination: '/app/catalog/add-ons', permanent: true },
      { source: '/catalog/add-ons/:id', destination: '/app/catalog/add-ons?detail=:id', permanent: true },
      { source: '/catalog/:id', destination: '/app/catalog?detail=:id', permanent: true },
    ];
  },
};

export default nextConfig;
