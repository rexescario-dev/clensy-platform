import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, Repository } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { Role } from '../src/platform/auth/domain/role';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import { CustomerEntity } from '../src/modules/customers/infrastructure/persistence/customer.entity';
import { PropertyEntity } from '../src/modules/customers/infrastructure/persistence/property.entity';
import { BookingEntity } from '../src/modules/bookings/infrastructure/persistence/booking.entity';
import { BookingPricingSnapshotEmbeddable } from '../src/modules/bookings/infrastructure/persistence/booking-pricing-snapshot.embeddable';
import { BookingStatus } from '../src/modules/bookings/domain/booking-status';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { PricingRulesService } from '../src/modules/catalog/application/services/pricing-rules.service';
import { seedSuperAdmin, seedTenantAdmin } from './helpers/seed-tenant-admin';

// REST `/bookings`' contract suite (#85 Slice decision 3): every route now
// requires the session cookie and reuses GraphQL's exact VIEW_ROLES/
// WRITE_ROLES sets, with the tenant sourced only from
// `requireTenantId(currentUser)` and the actor from `currentUser.id` —
// never from client input (I-2). This suite proves that end-to-end over
// real HTTP, distinct from bookings.e2e-spec.ts's GraphQL surface.
//
// Self-contained against the bootstrap tenant (the one tenant row every
// migrated database is guaranteed to have): every admin/customer/property/
// service/booking row here is either random-per-run or the caller's own
// creation, so repeated runs against the shared, non-truncated e2e
// database never collide.
describe('Bookings REST (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let auditEventRepository: Repository<AuditEventEntity>;
  let customerRepository: Repository<CustomerEntity>;
  let propertyRepository: Repository<PropertyEntity>;
  let bookingRepository: Repository<BookingEntity>;
  let servicesService: ServicesService;
  let pricingRulesService: PricingRulesService;

  let customer: CustomerEntity;
  let property: PropertyEntity;
  let service: { id: string };
  let probeBooking: BookingEntity;

  function extractSessionCookie(response: request.Response): string {
    const setCookieHeader = response.headers['set-cookie'] as unknown as
      string[] | undefined;
    if (!setCookieHeader || setCookieHeader.length === 0) {
      throw new Error('Expected a Set-Cookie header on the login response');
    }
    return setCookieHeader[0].split(';')[0];
  }

  async function loginAs(email: string, password: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `mutation Login($input: LoginInput!) {
          login(loginInput: $input) { success }
        }`,
        variables: { input: { email, password } },
      });
    return extractSessionCookie(response);
  }

  async function cookieForRole(
    role: Exclude<Role, Role.SUPER_ADMIN>,
  ): Promise<string> {
    const admin = await seedTenantAdmin(dataSource, role, BOOTSTRAP_TENANT_ID);
    return loginAs(admin.email, admin.password);
  }

  async function cookieForSuperAdmin(): Promise<string> {
    const admin = await seedSuperAdmin(dataSource);
    return loginAs(admin.email, admin.password);
  }

  function createBookingBody() {
    return {
      customerId: customer.id,
      propertyId: property.id,
      serviceId: service.id,
      scheduledAt: '2026-09-01T09:00:00.000Z',
    };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    applyPlatformPipes(app);
    await app.init();

    dataSource = moduleFixture.get(DataSource);
    auditEventRepository = moduleFixture.get(
      getRepositoryToken(AuditEventEntity),
    );
    customerRepository = moduleFixture.get(getRepositoryToken(CustomerEntity));
    propertyRepository = moduleFixture.get(getRepositoryToken(PropertyEntity));
    bookingRepository = moduleFixture.get(getRepositoryToken(BookingEntity));
    servicesService = moduleFixture.get(ServicesService);
    pricingRulesService = moduleFixture.get(PricingRulesService);

    const runId = randomUUID();
    customer = await customerRepository.save(
      customerRepository.create({
        tenantId: BOOTSTRAP_TENANT_ID,
        email: `rest-fixture-${runId}@example.com`,
        fullName: `REST Fixture Customer ${runId}`,
        notes: null,
        phone: '555-0100',
      }),
    );
    property = await propertyRepository.save(
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
    service = await servicesService.createService({
      actorId: 'e2e',
      tenantId: BOOTSTRAP_TENANT_ID,
      durationMinutes: 60,
      name: `REST contract service ${runId}`,
    });
    await pricingRulesService.createPricingRule({
      actorId: 'e2e',
      serviceId: service.id,
      tenantId: BOOTSTRAP_TENANT_ID,
      priceMinorUnits: 5000,
    });

    // Read-only probe booking, reused by every case below that only needs
    // a real id to GET/PATCH/DELETE against (401s, 403s, and FINANCE's
    // read-only 200s) — item 4's TENANT_OWNER flow creates and deletes its
    // own booking instead, so this row is never mutated or removed.
    const probeEntity = bookingRepository.create({
      customerId: customer.id,
      propertyId: property.id,
      serviceId: service.id,
      teamId: null,
      tenantId: BOOTSTRAP_TENANT_ID,
      scheduledAt: new Date('2026-09-01T09:00:00.000Z'),
      status: BookingStatus.PENDING,
    });
    // `repository.create()` does not populate an embedded-column property
    // from a plain object passed under its key — matching
    // `BookingsService.create`'s own documented workaround.
    probeEntity.pricingSnapshot = Object.assign(
      new BookingPricingSnapshotEmbeddable(),
      { priceMinorUnits: 5000 },
    );
    probeBooking = await bookingRepository.save(probeEntity);
  });

  afterAll(async () => {
    await app.close();
  });

  // Item 1: unauthenticated is 401 on every route.
  it('rejects each of the five routes without a session cookie (401)', async () => {
    const server = app.getHttpServer();

    await request(server).get('/bookings').expect(401);
    await request(server).get(`/bookings/${probeBooking.id}`).expect(401);
    await request(server)
      .post('/bookings')
      .send(createBookingBody())
      .expect(401);
    await request(server)
      .patch(`/bookings/${probeBooking.id}`)
      .send({ status: 'CONFIRMED' })
      .expect(401);
    await request(server).delete(`/bookings/${probeBooking.id}`).expect(401);
  });

  // Item 2: FINANCE is in VIEW_ROLES but not WRITE_ROLES.
  it('rejects FINANCE on the three write routes (403) but allows both reads (200)', async () => {
    const server = app.getHttpServer();
    const cookie = await cookieForRole(Role.FINANCE);

    await request(server)
      .post('/bookings')
      .set('Cookie', cookie)
      .send(createBookingBody())
      .expect(403);
    await request(server)
      .patch(`/bookings/${probeBooking.id}`)
      .set('Cookie', cookie)
      .send({ status: 'CONFIRMED' })
      .expect(403);
    await request(server)
      .delete(`/bookings/${probeBooking.id}`)
      .set('Cookie', cookie)
      .expect(403);

    await request(server).get('/bookings').set('Cookie', cookie).expect(200);
    await request(server)
      .get(`/bookings/${probeBooking.id}`)
      .set('Cookie', cookie)
      .expect(200);
  });

  // Item 3: Super Admin holds no role in VIEW_ROLES/WRITE_ROLES (RFC §4.2
  // — SUPER_ADMIN is never added to a booking route).
  it('rejects Super Admin on all five routes (403)', async () => {
    const server = app.getHttpServer();
    const cookie = await cookieForSuperAdmin();

    await request(server).get('/bookings').set('Cookie', cookie).expect(403);
    await request(server)
      .get(`/bookings/${probeBooking.id}`)
      .set('Cookie', cookie)
      .expect(403);
    await request(server)
      .post('/bookings')
      .set('Cookie', cookie)
      .send(createBookingBody())
      .expect(403);
    await request(server)
      .patch(`/bookings/${probeBooking.id}`)
      .set('Cookie', cookie)
      .send({ status: 'CONFIRMED' })
      .expect(403);
    await request(server)
      .delete(`/bookings/${probeBooking.id}`)
      .set('Cookie', cookie)
      .expect(403);
  });

  // Item 4 + 5: TENANT_OWNER full CRUD in one flow, plus the create audit
  // event's actor (#85 Slice decision 3: REST mutations now emit the same
  // booking audit events GraphQL does, because an authenticated REST
  // request has a real actor).
  it('lets TENANT_OWNER create, read, update, and delete a booking, auditing the create under its own id', async () => {
    const server = app.getHttpServer();
    const owner = await seedTenantAdmin(
      dataSource,
      Role.TENANT_OWNER,
      BOOTSTRAP_TENANT_ID,
    );
    const cookie = await loginAs(owner.email, owner.password);

    const createResponse = await request(server)
      .post('/bookings')
      .set('Cookie', cookie)
      .send(createBookingBody());
    expect(createResponse.status).toBe(201);
    expect(createResponse.body).not.toHaveProperty('tenantId');
    const bookingId: string = createResponse.body.id;

    const listResponse = await request(server)
      .get('/bookings')
      .set('Cookie', cookie);
    expect(listResponse.status).toBe(200);
    expect(
      (listResponse.body as Array<{ id: string }>).map((b) => b.id),
    ).toContain(bookingId);

    const getResponse = await request(server)
      .get(`/bookings/${bookingId}`)
      .set('Cookie', cookie);
    expect(getResponse.status).toBe(200);
    expect(getResponse.body).toMatchObject({ id: bookingId });

    const updateResponse = await request(server)
      .patch(`/bookings/${bookingId}`)
      .set('Cookie', cookie)
      .send({ status: 'CONFIRMED' });
    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body).toMatchObject({
      id: bookingId,
      status: 'CONFIRMED',
    });

    const deleteResponse = await request(server)
      .delete(`/bookings/${bookingId}`)
      .set('Cookie', cookie);
    expect(deleteResponse.status).toBe(200);

    await request(server)
      .get(`/bookings/${bookingId}`)
      .set('Cookie', cookie)
      .expect(404);

    const createEvent = await auditEventRepository.findOneBy({
      action: 'booking.create',
      entityId: bookingId,
    });
    expect(createEvent?.actorId).toBe(owner.id);
  });
});
