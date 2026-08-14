import { createGraphiQLFetcher } from '@graphiql/toolkit';
import { GraphiQL } from 'graphiql';
import React from 'react';
import { createRoot } from 'react-dom/client';
import 'graphiql/style.css';

// React.createElement rather than JSX/.tsx — avoids needing a JSX-aware
// tsconfig just for this one file (esbuild doesn't need one to bundle this;
// the editor's language server would, since it uses the nearest tsconfig.json,
// which has no "jsx" option set and is shared with the rest of the app).

// Monaco (GraphiQL's editor, via @graphiql/react) needs Web Worker scripts for
// language-service features (autocomplete, live validation) — must be set up
// before GraphiQL/Monaco does anything else, so it runs before render() below,
// not necessarily before this line in the file (imports evaluate first
// regardless of statement order). Worker base path matches main.ts's
// useStaticAssets prefix (deliberately not /graphiql — see graphiql.controller.ts).
// Label→worker mapping and source files verified against
// @graphiql/react/dist/setup-workers/{vite,webpack}.js — see build-graphiql.ts.
const WORKER_BASE_PATH = '/graphiql-static';

(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    switch (label) {
      case 'json':
        return new Worker(`${WORKER_BASE_PATH}/json.worker.js`);
      case 'graphql':
        return new Worker(`${WORKER_BASE_PATH}/graphql.worker.js`);
      default:
        return new Worker(`${WORKER_BASE_PATH}/editor.worker.js`);
    }
  },
};

const fetcher = createGraphiQLFetcher({ url: '/graphql' });

const container = document.getElementById('graphiql');
if (!container) {
  throw new Error('GraphiQL root element not found');
}

createRoot(container).render(React.createElement(GraphiQL, { fetcher }));
