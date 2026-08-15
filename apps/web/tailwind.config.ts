import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    // `@clensy/ui` components are consumed as source (see next.config.ts
    // transpilePackages), so their Tailwind classes must be scanned here
    // too or Tailwind will purge them from apps/web's build.
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
