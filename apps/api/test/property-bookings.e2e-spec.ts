import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { AdminUserEntity } from '../src/modules/admins/infrastructure/persistence/admin-user.entity';
import { BookingsService } from '../src/modules/bookings/application/services/bookings.service';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { CustomersService } from '../src/modules/customers/application/services/customers.service';
import { PropertiesService } from '../src/modules/customers/application/services/properties.service';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import {
  assertNoPerParentChildSelect,
  withCapturedSql,
} from './helpers/capture-sql';
import { seedOwner } from './helpers/seed-owner';

describe('property.bookings nested connection (e2e)', () => {
  let app: INestApplication<App>;
  let adminUserRepository: Repository<AdminUserEntity>;
  let customersService: CustomersService;
  let propertiesService: PropertiesService;
  let servicesService: ServicesService;
  let bookingsService: BookingsService;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    applyPlatformPipes(app);
    await app.init();

    adminUserRepository = moduleFixture.get(
      getRepositoryToken(AdminUserEntity),
    );
    customersService = moduleFixture.get(CustomersService);
    propertiesService = moduleFixture.get(PropertiesService);
    servicesService = moduleFixture.get(ServicesService);
    bookingsService = moduleFixture.get(BookingsService);
    dataSource = moduleFixture.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  const LOGIN_MUTATION = `
    mutation Login($input: LoginInput!) {
      login(loginInput: $input) { success admin { id } }
    }
  `;

  function extractSessionCookie(response: request.Response): string {
    const setCookieHeader = response.headers['set-cookie'] as unknown as
      | string[]
      | undefined;
    if (!setCookieHeader || setCookieHeader.length === 0) {
      throw new Error('Expected a Set-Cookie header on the login response');
    }
    return setCookieHeader[0].split(';')[0];
  }

  async function login(email: string, password: string) {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: LOGIN_MUTATION,
        variables: { input: { email, password } },
      });
  }

  function authedRequest(sessionCookie: string) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', sessionCookie);
  }

  it('rejects nested totalCount, keeps root totalCount, clamps nested limit, and loads nested nodes in O(1)', async () => {
    const owner = await seedOwner(adminUserRepository);
    const ownerLogin = await login(owner.email, owner.password);
    expect(ownerLogin.body.errors).toBeUndefined();
    const cookie = extractSessionCookie(ownerLogin);
    const runId = owner.id;

    const customer = await customersService.create({
      actorId: owner.id,
      fullName: `Nest Customer ${runId}`,
      email: `nest-${runId}@example.com`,
      phone: '555-0200',
    });
    const service = await servicesService.createService({
      actorId: owner.id,
      name: `Nest Service ${runId}`,
      durationMinutes: 60,
    });
    const pricing = await authedRequest(cookie).send({
      query: `mutation CreatePricingRule($input: CreatePricingRuleInput!) {
        createPricingRule(input: $input) { id }
      }`,
      variables: {
        input: { serviceId: service.id, priceMinorUnits: 4000 },
      },
    });
    expect(pricing.body.errors).toBeUndefined();

    const properties: { id: string }[] = [];
    for (let index = 0; index < 6; index += 1) {
      properties.push(
        await propertiesService.create({
          actorId: owner.id,
          customerId: customer.id,
          label: `P${index}`,
          addressLine1: `${runId}-${index} Nest St`,
          city: 'City',
          region: 'Region',
          postalCode: '00000',
        }),
      );
    }

    for (let index = 0; index < 21; index += 1) {
      await bookingsService.create({
        actorId: owner.id,
        customerId: customer.id,
        propertyId: properties[0].id,
        serviceId: service.id,
        scheduledAt: new Date(
          `2026-09-${String(index + 1).padStart(2, '0')}T09:00:00.000Z`,
        ),
      });
    }
    for (let index = 1; index < 6; index += 1) {
      await bookingsService.create({
        actorId: owner.id,
        customerId: customer.id,
        propertyId: properties[index].id,
        serviceId: service.id,
        scheduledAt: new Date(`2026-08-0${index}T09:00:00.000Z`),
      });
    }

    const nestedCountError = await authedRequest(cookie).send({
      query: `query NestedCount($id: ID!) {
        property(id: $id) { bookings { totalCount nodes { id } } }
      }`,
      variables: { id: properties[0].id },
    });
    expect(nestedCountError.body.data).toBeUndefined();
    expect(JSON.stringify(nestedCountError.body.errors)).toMatch(/totalCount/);

    const rootCount = await authedRequest(cookie).send({
      query: `query RootCount {
        bookings { totalCount nodes { id } }
      }`,
    });
    expect(rootCount.body.errors).toBeUndefined();
    expect(rootCount.body.data.bookings.totalCount).toBeGreaterThanOrEqual(21);

    const clamp = await authedRequest(cookie).send({
      query: `query Clamp($id: ID!, $paging: OffsetPaging) {
        property(id: $id) {
          bookings(paging: $paging) {
            nodes { id }
            pageInfo { hasNextPage }
          }
        }
      }`,
      variables: {
        id: properties[0].id,
        paging: { limit: 1000, offset: 0 },
      },
    });
    expect(clamp.body.errors).toBeUndefined();
    expect(clamp.body.data.property.bookings.nodes.length).toBeLessThanOrEqual(
      100,
    );

    const omitted = await authedRequest(cookie).send({
      query: `query DefaultPage($id: ID!) {
        property(id: $id) {
          bookings { nodes { id } pageInfo { hasNextPage } }
        }
      }`,
      variables: { id: properties[0].id },
    });
    expect(omitted.body.errors).toBeUndefined();
    expect(omitted.body.data.property.bookings.nodes.length).toBeLessThanOrEqual(
      20,
    );
    expect(omitted.body.data.property.bookings.nodes).toHaveLength(20);
    expect(omitted.body.data.property.bookings.pageInfo.hasNextPage).toBe(true);

    const listParentQuery = `query ListParents($id: ID!) {
      customer(id: $id) {
        properties {
          id
          bookings { nodes { id } pageInfo { hasNextPage } }
        }
      }
    }`;

    const captureAtN = async (parentN: number) => {
      const { result, queries } = await withCapturedSql(dataSource, () =>
        authedRequest(cookie).send({
          query: listParentQuery,
          variables: { id: customer.id },
        }),
      );
      expect(result.body.errors).toBeUndefined();
      expect(result.body.data.customer.properties).toHaveLength(parentN);
      assertNoPerParentChildSelect(queries, parentN, 'booking_entity');
      return queries.length;
    };

    const atSix = await captureAtN(6);

    for (let index = 6; index < 12; index += 1) {
      const property = await propertiesService.create({
        actorId: owner.id,
        customerId: customer.id,
        label: `P${index}`,
        addressLine1: `${runId}-${index} Nest St`,
        city: 'City',
        region: 'Region',
        postalCode: '00000',
      });
      await bookingsService.create({
        actorId: owner.id,
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        scheduledAt: new Date(`2026-07-${String(index).padStart(2, '0')}T09:00:00.000Z`),
      });
    }

    const atTwelve = await captureAtN(12);
    const delta = Math.abs(atTwelve - atSix);
    expect(delta === 0 || delta <= 2).toBe(true);
  }, 120000);
});
