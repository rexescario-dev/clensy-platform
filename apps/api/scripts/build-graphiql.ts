import { build } from 'esbuild';
import { resolve } from 'path';

// Bundles the GraphiQL dev UI (React + GraphiQL + @graphiql/toolkit + CSS)
// into self-contained static assets — no CDN, no runtime module resolution.
// Run via `pnpm build:graphiql` (chained before `nest build`, and once before
// `start:dev` — not on every watch-mode restart).
//
// GraphiQL's editor is Monaco (via @graphiql/react + monaco-graphql), and
// Monaco needs its own Web Worker scripts for language-service features
// (autocomplete, live validation) — it can't run those on the main thread
// bundle alone. The exact worker source paths and label mapping below are
// taken directly from @graphiql/react's own dist/setup-workers/{vite,webpack}.js
// helpers (verified against the installed package, not guessed) — there's no
// esbuild-specific helper shipped, so this replicates the same mapping.
// graphiql.entry.ts wires these up via self.MonacoEnvironment.getWorker.
async function run(): Promise<void> {
  await build({
    // GraphiQL uses Monaco Editor for the query editor. Monaco's
    // language-service features execute in Web Workers, so these workers
    // must be emitted as separate browser assets. Do not collapse this into
    // a single bundle without preserving the MonacoEnvironment.getWorker
    // wiring in graphiql.entry.ts.
    entryPoints: {
      graphiql: resolve(
        __dirname,
        '../src/platform/graphql/graphiql/graphiql.entry.ts',
      ),
      'editor.worker': require.resolve(
        'monaco-editor/esm/vs/editor/editor.worker.js',
      ),
      'json.worker': require.resolve(
        'monaco-editor/esm/vs/language/json/json.worker.js',
      ),
      'graphql.worker': require.resolve('monaco-graphql/esm/graphql.worker.js'),
    },
    bundle: true,
    minify: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    outdir: resolve(__dirname, '../public/graphiql'),
    loader: {
      '.css': 'css',
      // graphiql pulls in monaco-editor, whose CSS references font/icon
      // assets. dataurl embeds them directly in the CSS output rather than
      // emitting separate files — keeps the build genuinely self-contained.
      '.ttf': 'dataurl',
      '.woff': 'dataurl',
      '.woff2': 'dataurl',
      '.eot': 'dataurl',
      '.svg': 'dataurl',
    },
  });
  console.log('GraphiQL bundle built: public/graphiql/');
}

run().catch((error: unknown) => {
  console.error('GraphiQL bundle build failed:', error);
  process.exit(1);
});
