import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // `@clensy/client` and `@clensy/ui` ship TypeScript source directly
  // (package.json "main": "src/index.ts", no build step) rather than a
  // pre-built dist — Next.js has to transpile them itself.
  transpilePackages: ['@clensy/client', '@clensy/ui'],
};

export default nextConfig;
