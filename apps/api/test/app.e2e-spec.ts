import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app/app.module';

describe('GraphQL (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/graphql (POST) bookings query', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ bookings { id } }' })
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body.data.bookings)).toBe(true);
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
