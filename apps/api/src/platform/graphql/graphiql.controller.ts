import { Controller, Get, Header } from '@nestjs/common';

// Locally-bundled GraphiQL — see src/platform/graphql/graphiql/graphiql.entry.ts
// (source) and scripts/build-graphiql.ts (build). No CDN: the bundle at
// /graphiql-static/graphiql.js is self-contained (React, GraphiQL,
// @graphiql/toolkit, and CSS all esbuild-bundled together — see main.ts for
// how it's served, and why the static prefix isn't /graphiql itself).
// Dev-only: only registered when NODE_ENV !== 'production' (see graphql.module.ts).
const GRAPHIQL_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>GraphiQL — Clensy Platform</title>
    <link rel="stylesheet" href="/graphiql-static/graphiql.css" />
    <style>
      body { height: 100%; margin: 0; width: 100%; overflow: hidden; }
      #graphiql { height: 100vh; }
    </style>
  </head>
  <body>
    <div id="graphiql">Loading GraphiQL...</div>
    <script src="/graphiql-static/graphiql.js"></script>
  </body>
</html>`;

@Controller('graphiql')
export class GraphiqlController {
  @Get()
  @Header('Content-Type', 'text/html')
  serve(): string {
    return GRAPHIQL_HTML;
  }
}
