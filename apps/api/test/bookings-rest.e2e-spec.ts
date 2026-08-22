import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { CustomersService } from '../src/modules/customers/application/services/customers.service';
import { PropertiesService } from '../src/modules/customers/application/services/properties.service';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { PricingRulesService } from '../src/modules/catalog/application/services/pricing-rules.service';

// Proves REST's posture (spec §4.4) end-to-end over real HTTP, unauthenticated
// — no route/verb/response-envelope change, and the response body carries
// the new customerId/propertyId/serviceId/teamId/pricingSnapshot shape, not
// the old fake customerName/serviceType fields (spec §5). Distinct from
// bookings.e2e-spec.ts, which covers the GraphQL surface.
describe('Bookings REST (e2e)', () => {
  let app: INestApplication<App>;
  let auditEventRepository: Repository<AuditEventEntity>;
  let customersService: CustomersService;
  let propertiesService: PropertiesService;
  let servicesService: ServicesService;
  let pricingRulesService: PricingRulesService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();

    auditEventRepository = moduleFixture.get(
      getRepositoryToken(AuditEventEntity),
    );
    customersService = moduleFixture.get(CustomersService);
    propertiesService = moduleFixture.get(PropertiesService);
    servicesService = moduleFixture.get(ServicesService);
    pricingRulesService = moduleFixture.get(PricingRulesService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST/GET/PATCH/DELETE all succeed unauthenticated, with the new field shape and no audit events', async () => {
    const runId = Date.now().toString();
    const customer = await customersService.create({
      actorId: 'e2e',
      fullName: `REST Fixture Customer ${runId}`,
      email: `rest-fixture-${runId}@example.com`,
      phone: '555-0100',
    });
    const property = await propertiesService.create({
      actorId: 'e2e',
      customerId: customer.id,
      label: 'Home',
      addressLine1: `${runId} Main St`,
      city: 'City',
      region: 'Region',
      postalCode: '00000',
    });
    const service = await servicesService.createService({
      actorId: 'e2e',
      name: `REST Fixture Service ${runId}`,
      durationMinutes: 60,
    });
    await pricingRulesService.createPricingRule({
      actorId: 'e2e',
      serviceId: service.id,
      priceMinorUnits: 5000,
    });

    // POST — unauthenticated, no Cookie header set anywhere in this file.
    const createResponse = await request(app.getHttpServer())
      .post('/bookings')
      .send({
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        scheduledAt: '2026-09-01T09:00:00.000Z',
      });
    expect(createResponse.status).toBe(201);
    expect(createResponse.body).toMatchObject({
      customerId: customer.id,
      propertyId: property.id,
      serviceId: service.id,
      teamId: null,
      status: 'PENDING',
      pricingSnapshot: { priceMinorUnits: 5000 },
    });
    expect(createResponse.body.customerName).toBeUndefined();
    expect(createResponse.body.serviceType).toBeUndefined();
    const bookingId: string = createResponse.body.id;

    // No audit event for the REST-originated create (spec §4.4).
    const createAuditEvents = await auditEventRepository.findBy({
      entityId: bookingId,
    });
    expect(createAuditEvents).toHaveLength(0);

    // GET (list) and GET (by id) — unauthenticated.
    const listResponse = await request(app.getHttpServer()).get('/bookings');
    expect(listResponse.status).toBe(200);
    expect(
      (listResponse.body as Array<{ id: string }>).map((b) => b.id),
    ).toContain(bookingId);

    const getResponse = await request(app.getHttpServer()).get(
      `/bookings/${bookingId}`,
    );
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toMatchObject({
      id: bookingId,
      customerId: customer.id,
    });

    // PATCH — unauthenticated; only scheduledAt/status/teamId are settable
    // (customerId/propertyId/serviceId are not fields of UpdateBookingDto).
    const updateResponse = await request(app.getHttpServer())
      .patch(`/bookings/${bookingId}`)
      .send({ status: 'CONFIRMED' });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      id: bookingId,
      status: 'CONFIRMED',
      customerId: customer.id,
      propertyId: property.id,
      serviceId: service.id,
    });

    const updateAuditEvents = await auditEventRepository.findBy({
      entityId: bookingId,
      action: 'booking.update',
    });
    expect(updateAuditEvents).toHaveLength(0);

    // DELETE — unauthenticated.
    const deleteResponse = await request(app.getHttpServer()).delete(
      `/bookings/${bookingId}`,
    );
    expect(deleteResponse.status).toBe(200);

    const afterDeleteResponse = await request(app.getHttpServer()).get(
      '/bookings',
    );
    expect(
      (afterDeleteResponse.body as Array<{ id: string }>).map((b) => b.id),
    ).not.toContain(bookingId);

    const removeAuditEvents = await auditEventRepository.findBy({
      entityId: bookingId,
      action: 'booking.remove',
    });
    expect(removeAuditEvents).toHaveLength(0);
  });
});
