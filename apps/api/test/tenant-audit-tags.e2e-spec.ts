import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource, In, Repository } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { PricingRulesService } from '../src/modules/catalog/application/services/pricing-rules.service';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { PricingUnit } from '../src/modules/catalog/domain/pricing-unit';
import { CustomerEntity } from '../src/modules/customers/infrastructure/persistence/customer.entity';
import { PropertyEntity } from '../src/modules/customers/infrastructure/persistence/property.entity';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { AdminScope } from '../src/platform/auth/domain/admin-scope';
import { Role } from '../src/platform/auth/domain/role';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import {
  createTestTenant,
  removeTestTenants,
  seedSuperAdmin,
  seedTenantAdmin,
} from './helpers/seed-tenant-admin';
import { uniqueEmail } from './helpers/unique-email';

// Audit tags end to end (#90 decision 6; RFC §4.6; audit invariants 1–3,
// 6). Booking create/update/remove go through GraphQL as tenant A and REST
// as tenant B, so a hard-coded tenant cannot pass, and every stored row is
// compared with the authenticated caller. Login rows: tenant success,
// Super Admin success, and failed login.
//
// Self-contained: two fresh test tenants and unique-per-run rows; afterAll
// deletes only this suite's audit rows (its actors and its failed-login
// email) before `removeTestTenants`. Mirrors
// `bookings.tenant-isolation.e2e-spec.ts`'s setup shape.
describe('Tenant audit tags (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let auditEventRepository: Repository<AuditEventEntity>;

  const run = randomUUID();
  const failedLoginEmail = uniqueEmail('audit-tags-failed');
  let tenantA: string;
  let tenantB: string;
  let cookieA: string;
  let cookieB: string;
  let ownerAId: string;
  let ownerBId: string;
  let superAdminId: string;
  let serviceA: { id: string };
  let serviceB: { id: string };
  let customerA: CustomerEntity;
  let customerB: CustomerEntity;
  let propertyA: PropertyEntity;
  let propertyB: PropertyEntity;

  const LOGIN_MUTATION = `
    mutation Login($input: LoginInput!) {
      login(loginInput: $input) { success }
    }
  `;
  const CREATE_BOOKING_MUTATION = `
    mutation CreateBooking($input: CreateBookingInput!) {
      createBooking(createBookingInput: $input) { id }
    }
  `;
  const UPDATE_BOOKING_MUTATION = `
    mutation UpdateBooking($input: UpdateBookingInput!) {
      updateBooking(updateBookingInput: $input) { id status }
    }
  `;
  const REMOVE_BOOKING_MUTATION = `
    mutation RemoveBooking($id: ID!) {
      removeBooking(id: $id) { id }
    }
  `;

  function login(email: string, password: string) {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: LOGIN_MUTATION,
        variables: { input: { email, password } },
      });
  }

  async function loginAs(email: string, password: string): Promise<string> {
    const response = await login(email, password);
    const setCookieHeader = response.headers['set-cookie'] as unknown as
      string[] | undefined;
    if (!setCookieHeader || setCookieHeader.length === 0) {
      throw new Error('Expected a Set-Cookie header on the login response');
    }
    return setCookieHeader[0].split(';')[0];
  }

  function gql(
    cookie: string,
    query: string,
    variables: Record<string, unknown> = {},
  ) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query, variables });
  }

  async function insertCustomerAndProperty(
    tenantId: string,
    label: string,
  ): Promise<{ customer: CustomerEntity; property: PropertyEntity }> {
    const customerRepository = dataSource.getRepository(CustomerEntity);
    const customer = await customerRepository.save(
      customerRepository.create({
        tenantId,
        email: uniqueEmail(`audit-tags-${label.toLowerCase()}`),
        fullName: `Customer ${label} ${run}`,
        notes: null,
        phone: '555-0100',
      }),
    );
    const propertyRepository = dataSource.getRepository(PropertyEntity);
    const property = await propertyRepository.save(
      propertyRepository.create({
        customerId: customer.id,
        tenantId,
        accessNotes: null,
        addressLine1: `1 ${label} Street`,
        addressLine2: null,
        city: `${label} City`,
        label: `Home ${label} ${run}`,
        postalCode: '00001',
        region: 'XX',
      }),
    );
    return { customer, property };
  }

  async function createServiceWithPrice(
    actorId: string,
    tenantId: string,
    label: string,
  ): Promise<{ id: string }> {
    const servicesService = app.get(ServicesService);
    const service = await servicesService.createService({
      actorId,
      tenantId,
      durationMinutes: 45,
      name: `Audit Tags ${label} ${run}`,
    });
    await app.get(PricingRulesService).createPricingRule({
      actorId,
      serviceId: service.id,
      tenantId,
      priceMinorUnits: 5000,
      unit: PricingUnit.PER_SERVICE,
    });
    return service;
  }

  function bookingEvents(entityId: string): Promise<AuditEventEntity[]> {
    return auditEventRepository.find({
      order: { occurredAt: 'ASC' },
      where: { entityId, entityType: 'booking' },
    });
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

    tenantA = await createTestTenant(dataSource);
    tenantB = await createTestTenant(dataSource);
    const ownerA = await seedTenantAdmin(
      dataSource,
      Role.TENANT_OWNER,
      tenantA,
    );
    const ownerB = await seedTenantAdmin(
      dataSource,
      Role.TENANT_OWNER,
      tenantB,
    );
    const superAdmin = await seedSuperAdmin(dataSource);
    ownerAId = ownerA.id;
    ownerBId = ownerB.id;
    superAdminId = superAdmin.id;
    cookieA = await loginAs(ownerA.email, ownerA.password);
    cookieB = await loginAs(ownerB.email, ownerB.password);
    await loginAs(superAdmin.email, superAdmin.password);

    serviceA = await createServiceWithPrice(ownerAId, tenantA, 'A');
    serviceB = await createServiceWithPrice(ownerBId, tenantB, 'B');
    ({ customer: customerA, property: propertyA } =
      await insertCustomerAndProperty(tenantA, 'A'));
    ({ customer: customerB, property: propertyB } =
      await insertCustomerAndProperty(tenantB, 'B'));
  });

  afterAll(async () => {
    try {
      if (dataSource) {
        // Audit rows this suite can attribute to itself — deleted before
        // `removeTestTenants` (which does not touch `audit_event_entity`).
        await auditEventRepository.delete({
          actorId: In([ownerAId, ownerBId, superAdminId]),
        });
        await auditEventRepository
          .createQueryBuilder()
          .delete()
          .where('action = :action', { action: 'admin.login.failed' })
          .andWhere(`metadata->>'email' = :email`, { email: failedLoginEmail })
          .execute();
        await removeTestTenants(dataSource, [tenantA, tenantB]);
      }
    } finally {
      await app?.close();
    }
  });

  it('tags booking.create/update/remove made through GraphQL with the caller tenant', async () => {
    const created = await gql(cookieA, CREATE_BOOKING_MUTATION, {
      input: {
        customerId: customerA.id,
        propertyId: propertyA.id,
        serviceId: serviceA.id,
        scheduledAt: '2031-02-01T09:00:00.000Z',
      },
    });
    expect(created.body.errors).toBeUndefined();
    const id: string = created.body.data.createBooking.id;

    const updated = await gql(cookieA, UPDATE_BOOKING_MUTATION, {
      input: { id, status: 'CANCELLED' },
    });
    expect(updated.body.errors).toBeUndefined();
    const removed = await gql(cookieA, REMOVE_BOOKING_MUTATION, { id });
    expect(removed.body.errors).toBeUndefined();

    const events = await bookingEvents(id);
    expect(events.map((event) => event.action)).toEqual([
      'booking.create',
      'booking.update',
      'booking.remove',
    ]);
    for (const event of events) {
      expect(event).toMatchObject({
        actorId: ownerAId,
        tenantId: tenantA,
        scope: AdminScope.TENANT,
      });
    }
  });

  it('tags booking.create/update/remove made through REST with the caller tenant', async () => {
    const server = app.getHttpServer();
    const created = await request(server)
      .post('/bookings')
      .set('Cookie', cookieB)
      .send({
        customerId: customerB.id,
        propertyId: propertyB.id,
        serviceId: serviceB.id,
        scheduledAt: '2031-02-02T09:00:00.000Z',
      });
    expect(created.status).toBe(201);
    const id: string = (created.body as { id: string }).id;

    const updated = await request(server)
      .patch(`/bookings/${id}`)
      .set('Cookie', cookieB)
      .send({ status: 'CANCELLED' });
    expect(updated.status).toBe(200);
    const removed = await request(server)
      .delete(`/bookings/${id}`)
      .set('Cookie', cookieB);
    expect(removed.status).toBe(200);

    const events = await bookingEvents(id);
    expect(events.map((event) => event.action)).toEqual([
      'booking.create',
      'booking.update',
      'booking.remove',
    ]);
    for (const event of events) {
      expect(event).toMatchObject({
        actorId: ownerBId,
        tenantId: tenantB,
        scope: AdminScope.TENANT,
      });
    }
  });

  it('tags a tenant login with TENANT + its tenant, and a Super Admin login with PLATFORM + null', async () => {
    const tenantLogin = await auditEventRepository.findOneOrFail({
      order: { occurredAt: 'DESC' },
      where: { action: 'admin.login.succeeded', actorId: ownerAId },
    });
    expect(tenantLogin).toMatchObject({
      tenantId: tenantA,
      scope: AdminScope.TENANT,
    });

    const platformLogin = await auditEventRepository.findOneOrFail({
      order: { occurredAt: 'DESC' },
      where: { action: 'admin.login.succeeded', actorId: superAdminId },
    });
    expect(platformLogin).toMatchObject({
      tenantId: null,
      scope: AdminScope.PLATFORM,
    });
  });

  it('records a failed login with no actor, scope or tenant, and issues no session', async () => {
    const response = await login(failedLoginEmail, 'wrong-password');
    expect(response.headers['set-cookie']).toBeUndefined();

    const failed = await auditEventRepository
      .createQueryBuilder('e')
      .where('e.action = :action', { action: 'admin.login.failed' })
      .andWhere(`e.metadata->>'email' = :email`, { email: failedLoginEmail })
      .getOneOrFail();
    expect(failed).toMatchObject({
      actorId: null,
      tenantId: null,
      scope: null,
    });
  });
});
