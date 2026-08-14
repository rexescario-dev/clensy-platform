import { Controller, Get, Header } from '@nestjs/common';

// GraphiQL via the CDN-bundle integration documented by the graphiql package
// itself — no local dependency, works against any GraphQL server. Dev-only:
// only registered when NODE_ENV !== 'production' (see graphql.module.ts).
const GRAPHIQL_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <title>GraphiQL — Clensy Platform</title>
    <style>
      body { height: 100%; margin: 0; width: 100%; overflow: hidden; }
      #graphiql { height: 100vh; }
    </style>
    <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/graphiql/graphiql.min.css" />
  </head>
  <body>
    <div id="graphiql">Loading GraphiQL...</div>
    <script src="https://unpkg.com/graphiql/graphiql.min.js" type="application/javascript"></script>
    <script>
      const root = ReactDOM.createRoot(document.getElementById('graphiql'));
      const fetcher = GraphiQL.createFetcher({ url: '/graphql' });
      root.render(
        React.createElement(GraphiQL, { fetcher, defaultEditorToolsVisibility: true }),
      );
    </script>
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
