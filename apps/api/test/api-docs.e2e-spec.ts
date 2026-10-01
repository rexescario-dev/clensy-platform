import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app/app.module';
import { setupApiDocs } from '../src/platform/openapi/setup-api-docs';
import { collectRegisteredRoutes } from './helpers/http-surface';

// #91 decision 3: Swagger is a documentation/schema-disclosure surface,
// mounted only outside production (the GraphiQL rule). The document itself
// documents the same paths and operations; the expected values were
// captured from `main` at planning.
async function bootWithDocs(nodeEnv: string): Promise<INestApplication<App>> {
  const moduleFixture = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleFixture.createNestApplication<INestApplication<App>>();
  setupApiDocs(app, nodeEnv);
  await app.init();
  return app;
}

describe('API docs (Swagger) mounting (#91)', () => {
  describe('production', () => {
    let app: INestApplication<App>;
    beforeAll(async () => {
      app = await bootWithDocs('production');
    });
    afterAll(async () => {
      await app.close();
    });

    it('registers no /docs route', () => {
      expect(
        collectRegisteredRoutes(app).filter((key) =>
          key.split(' ')[1].startsWith('/docs'),
        ),
      ).toEqual([]);
    });

    it('serves none of /docs, /docs-json, /docs-yaml', async () => {
      const server = app.getHttpServer();
      for (const path of ['/docs', '/docs-json', '/docs-yaml']) {
        expect({
          path,
          status: (await request(server).get(path)).status,
        }).toEqual({
          path,
          status: 404,
        });
      }
    });
  });

  describe('non-production', () => {
    let app: INestApplication<App>;
    beforeAll(async () => {
      app = await bootWithDocs('development');
    });
    afterAll(async () => {
      await app.close();
    });

    it('serves the Swagger UI and the YAML document', async () => {
      const ui = await request(app.getHttpServer()).get('/docs');
      expect(ui.status).toBe(200);
      expect(ui.headers['content-type']).toMatch(/text\/html/);
      expect(
        (await request(app.getHttpServer()).get('/docs-yaml')).status,
      ).toBe(200);
    });

    // Mounting slice: pins the same info and documented paths/operations,
    // not a byte-identical OpenAPI document (decision 3).
    it('documents the same REST paths and operations', async () => {
      const res = await request(app.getHttpServer()).get('/docs-json');
      expect(res.status).toBe(200);
      const doc = res.body as {
        info: Record<string, unknown>;
        paths: Record<string, Record<string, unknown>>;
      };
      expect(doc.info).toEqual({
        contact: {},
        description: 'REST surface — see /graphql for the GraphQL equivalent',
        title: 'Clensy Platform API',
        version: '0.0.1',
      });
      expect(
        Object.fromEntries(
          Object.entries(doc.paths).map(([path, ops]) => [
            path,
            Object.keys(ops).sort(),
          ]),
        ),
      ).toEqual({
        '/graphiql': ['get'],
        '/bookings': ['get', 'post'],
        '/bookings/{id}': ['delete', 'get', 'patch'],
      });
    });
  });
});
