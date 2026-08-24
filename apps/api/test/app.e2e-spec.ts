import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { AppModule } from './../src/app/app.module';
import { AdminUserEntity } from '../src/modules/admins/infrastructure/persistence/admin-user.entity';
import { CustomersService } from '../src/modules/customers/application/services/customers.service';
import { PropertiesService } from '../src/modules/customers/application/services/properties.service';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { PricingRulesService } from '../src/modules/catalog/application/services/pricing-rules.service';
import { seedOwner } from './helpers/seed-owner';

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
  // db:seed` having been run first. Bookings' cross-module migration (spec
  // §4.1) replaced the old fake customerName/serviceType body with real
  // customerId/propertyId/serviceId references, resolved via each owning
  // module's own application service — this smoke test's fixture chain
  // mirrors bookings.e2e-spec.ts's own createFixture() for the same reason.
  it('creates a booking and finds it via GET /bookings', async () => {
    const server = app.getHttpServer();

    const customersService = app.get(CustomersService);
    const propertiesService = app.get(PropertiesService);
    const servicesService = app.get(ServicesService);
    const pricingRulesService = app.get(PricingRulesService);

    const customer = await customersService.create({
      actorId: 'e2e',
      fullName: 'E2E Test Customer',
      email: `e2e-${Date.now()}@example.com`,
      phone: '555-0100',
    });
    const property = await propertiesService.create({
      actorId: 'e2e',
      customerId: customer.id,
      label: 'Home',
      addressLine1: '1 Test St',
      city: 'City',
      region: 'Region',
      postalCode: '00000',
    });
    const service = await servicesService.createService({
      actorId: 'e2e',
      name: `E2E Test Service ${Date.now()}`,
      durationMinutes: 60,
    });
    await pricingRulesService.createPricingRule({
      actorId: 'e2e',
      serviceId: service.id,
      priceMinorUnits: 5000,
    });

    const createResponse = await request(server)
      .post('/bookings')
      .send({
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
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
  // `NestExpressApplication`, not the base `INestApplication<App>` this
  // suite's other describe block uses — `useStaticAssets()` below is
  // Express-specific and isn't on the base interface.
  let app: NestExpressApplication;
  let adminUserRepository: Repository<AdminUserEntity>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    // `bookings`/`booking` require `AuthGuard` as of the Bookings migration
    // (spec §4.3) — this suite predates Admin Foundation's RBAC entirely,
    // so it now needs cookie-parser + a real session, mirroring every other
    // module's e2e suite.
    app.use(cookieParser());
    // Mirrors main.ts's bootstrap(), which this test doesn't go through.
    app.useStaticAssets(join(__dirname, '..', 'public', 'graphiql'), {
      prefix: '/graphiql-static',
    });
    await app.init();

    adminUserRepository = moduleFixture.get(
      getRepositoryToken(AdminUserEntity),
    );
  });

  // The actual API contract — GraphiQL is just a UI client on top of this.
  it('POST /graphql — bookings query still works (authenticated)', async () => {
    const owner = await seedOwner(adminUserRepository);

    const loginResponse = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `mutation Login($input: LoginInput!) {
          login(loginInput: $input) { success }
        }`,
        variables: { input: { email: owner.email, password: owner.password } },
      });
    expect(loginResponse.body.errors).toBeUndefined();
    const setCookieHeader = loginResponse.headers['set-cookie'] as unknown as
      string[] | undefined;
    const sessionCookie = setCookieHeader?.[0].split(';')[0];
    expect(sessionCookie).toBeDefined();

    await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', sessionCookie!)
      .send({ query: '{ bookings { id } }' })
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body.data.bookings)).toBe(true);
      });
  });

  // Confirms the flip side of the above: unauthenticated access is now
  // rejected, not silently served — the behavior change this migration
  // introduced to the GraphQL surface (spec §4.3), distinct from REST's
  // deliberately-unchanged unauthenticated posture (spec §4.4).
  it('POST /graphql — bookings query is rejected without a session', () => {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ bookings { id } }' })
      .expect(200)
      .expect((res) => {
        expect(res.body.data).toBeNull();
        expect(res.body.errors?.[0]?.extensions?.code).toBe('UNAUTHENTICATED');
      });
  });

  // Dev-tooling smoke checks, not part of the GraphQL API contract itself.
  it('GET /graphiql — dev IDE HTML is served', () => {
    return request(app.getHttpServer())
      .get('/graphiql')
      .expect(200)
      .expect('Content-Type', /text\/html/);
  });

  it.each([
    'graphiql.js',
    'editor.worker.js',
    'json.worker.js',
    'graphql.worker.js',
  ])('GET /graphiql-static/%s — locally-bundled asset is served', (asset) => {
    return request(app.getHttpServer())
      .get(`/graphiql-static/${asset}`)
      .expect(200)
      .expect('Content-Type', /javascript/);
  });

  afterEach(async () => {
    await app.close();
  });
});
