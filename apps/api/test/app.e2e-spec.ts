import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app/app.module';

describe('Bookings (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mirrors main.ts's bootstrap(), which this test doesn't go through.
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  // Self-contained — creates its own data rather than relying on `pnpm
  // db:seed` having been run first.
  it('creates a booking and finds it via GET /bookings', async () => {
    const server = app.getHttpServer();

    const createResponse = await request(server)
      .post('/bookings')
      .send({
        customerName: 'E2E Test Customer',
        serviceType: 'Standard Cleaning',
        scheduledAt: '2026-10-01T10:00:00.000Z',
      })
      .expect(201);

    const bookingId = createResponse.body.id as string;
    expect(bookingId).toBeDefined();

    await request(server)
      .get('/bookings')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
        expect(
          res.body.some((booking: { id: string }) => booking.id === bookingId),
        ).toBe(true);
      });

    await request(server).delete(`/bookings/${bookingId}`).expect(200);
  });

  afterEach(async () => {
    await app.close();
  });
});

describe('GraphQL (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    // Mirrors main.ts's bootstrap(), which this test doesn't go through.
    app.useStaticAssets(
      join(__dirname, '..', 'public', 'graphiql'),
      { prefix: '/graphiql-static' },
    );
    await app.init();
  });

  // The actual API contract — GraphiQL is just a UI client on top of this.
  it('POST /graphql — bookings query still works', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ bookings { id } }' })
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body.data.bookings)).toBe(true);
      });
  });

  // Dev-tooling smoke checks, not part of the GraphQL API contract itself.
  it('GET /graphiql — dev IDE HTML is served', () => {
    return request(app.getHttpServer())
      .get('/graphiql')
      .expect(200)
      .expect('Content-Type', /text\/html/);
  });

  it.each(['graphiql.js', 'editor.worker.js', 'json.worker.js', 'graphql.worker.js'])(
    'GET /graphiql-static/%s — locally-bundled asset is served',
    (asset) => {
      return request(app.getHttpServer())
        .get(`/graphiql-static/${asset}`)
        .expect(200)
        .expect('Content-Type', /javascript/);
    },
  );

  afterEach(async () => {
    await app.close();
  });
});
