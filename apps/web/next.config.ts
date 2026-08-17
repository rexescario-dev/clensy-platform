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
    ];
  },
};

export default nextConfig;
