import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import { CustomerEntity } from '../src/modules/customers/infrastructure/persistence/customer.entity';
import { PropertyEntity } from '../src/modules/customers/infrastructure/persistence/property.entity';
import { BookingEntity } from '../src/modules/bookings/infrastructure/persistence/booking.entity';
import { BookingPricingSnapshotEmbeddable } from '../src/modules/bookings/infrastructure/persistence/booking-pricing-snapshot.embeddable';
import { BookingStatus } from '../src/modules/bookings/domain/booking-status';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { PricingRulesService } from '../src/modules/catalog/application/services/pricing-rules.service';

// Proves REST's fail-closed posture (#82 Slice decision 4) end-to-end over
// real HTTP, unauthenticated. `POST /bookings` always builds its command
// with `tenantId: null` (no principal ⇒ no tenant scope), and
// `CustomersService.getCustomer` / `PropertiesService.getProperty` never
// resolve a row for a null tenant — so create now fails closed with the
// pre-existing `NotFoundException`, even given a real customer/property.
// GET/PATCH/DELETE are unaffected (bookings are not tenant-owned yet;
// `UpdateBookingCommand` carries no customer/property) — proven against a
// booking inserted directly via repository, since REST can no longer
// create one itself. Distinct from bookings.e2e-spec.ts, which covers the
// GraphQL surface.
describe('Bookings REST (e2e)', () => {
  let app: INestApplication<App>;
  let auditEventRepository: Repository<AuditEventEntity>;
  let customerRepository: Repository<CustomerEntity>;
  let propertyRepository: Repository<PropertyEntity>;
  let bookingRepository: Repository<BookingEntity>;
  let servicesService: ServicesService;
  let pricingRulesService: PricingRulesService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    applyPlatformPipes(app);
    await app.init();

    auditEventRepository = moduleFixture.get(
      getRepositoryToken(AuditEventEntity),
    );
    customerRepository = moduleFixture.get(getRepositoryToken(CustomerEntity));
    propertyRepository = moduleFixture.get(getRepositoryToken(PropertyEntity));
    bookingRepository = moduleFixture.get(getRepositoryToken(BookingEntity));
    servicesService = moduleFixture.get(ServicesService);
    pricingRulesService = moduleFixture.get(PricingRulesService);
  });

  afterAll(async () => {
    await app.close();
  });

  // Direct-repository fixtures, not the services: `CustomersService.create`
  // / `PropertiesService.create` now require a real `tenantId` (#82) — the
  // bootstrap tenant here only because a NOT NULL FK target is needed, never
  // as request-path tenant scope. Unique email per run so repeated runs
  // against the shared e2e database never collide (spec §3).
  async function insertCustomerAndProperty(
    runId: string,
  ): Promise<{ customer: CustomerEntity; property: PropertyEntity }> {
    const customer = await customerRepository.save(
      customerRepository.create({
        tenantId: BOOTSTRAP_TENANT_ID,
        email: `rest-fixture-${runId}@example.com`,
        fullName: `REST Fixture Customer ${runId}`,
        notes: null,
        phone: '555-0100',
      }),
    );
    const property = await propertyRepository.save(
      propertyRepository.create({
        customerId: customer.id,
        tenantId: BOOTSTRAP_TENANT_ID,
        accessNotes: null,
        addressLine1: `${runId} Main St`,
        addressLine2: null,
        city: 'City',
        label: 'Home',
        postalCode: '00000',
        region: 'Region',
      }),
    );
    return { customer, property };
  }

  it('POST /bookings fails closed with 404 and creates no row — no principal means no tenant scope (interim behavior, #82 Slice decision 4)', async () => {
    const runId = randomUUID();
    const { customer, property } = await insertCustomerAndProperty(runId);
    const service = await servicesService.createService({
      actorId: 'e2e',
      durationMinutes: 60,
      name: `REST Fixture Service ${runId}`,
    });
    await pricingRulesService.createPricingRule({
      actorId: 'e2e',
      priceMinorUnits: 5000,
      serviceId: service.id,
    });

    // POST — unauthenticated, no Cookie header set anywhere in this file.
    // The customer/property are real rows, proving the 404 comes from the
    // REST controller's `tenantId: null`, not from a missing fixture.
    const createResponse = await request(app.getHttpServer())
      .post('/bookings')
      .send({
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        scheduledAt: '2026-09-01T09:00:00.000Z',
      });
    expect(createResponse.status).toBe(404);

    const createdRows = await bookingRepository.findBy({
      customerId: customer.id,
    });
    expect(createdRows).toHaveLength(0);
  });

  it('GET/PATCH/DELETE still succeed unauthenticated on a booking inserted directly (bookings are not tenant-owned yet), emitting no audit event', async () => {
    const runId = randomUUID();
    const { customer, property } = await insertCustomerAndProperty(runId);
    const service = await servicesService.createService({
      actorId: 'e2e',
      durationMinutes: 60,
      name: `REST Fixture Service ${runId}`,
    });
    await pricingRulesService.createPricingRule({
      actorId: 'e2e',
      priceMinorUnits: 5000,
      serviceId: service.id,
    });

    const seedEntity = bookingRepository.create({
      customerId: customer.id,
      propertyId: property.id,
      serviceId: service.id,
      teamId: null,
      scheduledAt: new Date('2026-09-01T09:00:00.000Z'),
      status: BookingStatus.PENDING,
    });
    // `manager.create()`/`repository.create()` does not populate an
    // embedded-column property from a plain object passed under its key —
    // matching `BookingsService.create`'s own documented workaround.
    seedEntity.pricingSnapshot = Object.assign(
      new BookingPricingSnapshotEmbeddable(),
      { priceMinorUnits: 5000 },
    );
    const booking = await bookingRepository.save(seedEntity);
    const bookingId = booking.id;

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
      customerId: customer.id,
      id: bookingId,
    });

    // PATCH — unauthenticated; only scheduledAt/status/teamId are settable
    // (customerId/propertyId/serviceId are not fields of UpdateBookingDto).
    const updateResponse = await request(app.getHttpServer())
      .patch(`/bookings/${bookingId}`)
      .send({ status: 'CONFIRMED' });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      id: bookingId,
      customerId: customer.id,
      propertyId: property.id,
      serviceId: service.id,
      status: 'CONFIRMED',
    });

    const updateAuditEvents = await auditEventRepository.findBy({
      action: 'booking.update',
      entityId: bookingId,
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
      action: 'booking.remove',
      entityId: bookingId,
    });
    expect(removeAuditEvents).toHaveLength(0);
  });
});
