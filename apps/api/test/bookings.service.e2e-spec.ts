import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { BookingsService } from '../src/modules/bookings/application/services/bookings.service';
import { BookingEntity } from '../src/modules/bookings/infrastructure/persistence/booking.entity';
import { CustomersService } from '../src/modules/customers/application/services/customers.service';
import { PropertiesService } from '../src/modules/customers/application/services/properties.service';
import { CustomerEntity } from '../src/modules/customers/infrastructure/persistence/customer.entity';
import { PropertyEntity } from '../src/modules/customers/infrastructure/persistence/property.entity';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { PricingRulesService } from '../src/modules/catalog/application/services/pricing-rules.service';
import { ServiceEntity } from '../src/modules/catalog/infrastructure/persistence/service.entity';
import { PricingRuleEntity } from '../src/modules/catalog/infrastructure/persistence/pricing-rule.entity';
import { TeamsService } from '../src/modules/cleaners/application/services/teams.service';
import { TeamEntity } from '../src/modules/cleaners/infrastructure/persistence/team.entity';
import {
  acquireBookingDbTestLock,
  BookingDbTestLock,
} from './helpers/booking-db-test-lock';

function createTestDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'clensy',
    password: process.env.DB_PASSWORD ?? 'clensy_dev',
    database: process.env.DB_NAME ?? 'clensy',
    entities: [
      BookingEntity,
      CustomerEntity,
      PropertyEntity,
      ServiceEntity,
      PricingRuleEntity,
      TeamEntity,
      AuditEventEntity,
    ],
  });
}

// One combined `TRUNCATE ... CASCADE` — plain `TRUNCATE` (no `CASCADE`)
// fails if any listed table is referenced by a FK from a table NOT in the
// list, even an empty one; `cleaner_entity.teamId → team_entity` is
// exactly that case here (`cleaner_entity` is otherwise unrelated to
// bookings). `CASCADE` also clears any `cleaner_entity` rows, which is
// safe: `apps/api/test/jest-e2e.json` runs with `maxWorkers: 1`, so e2e
// spec files never run concurrently — every file re-establishes its own
// required state at the start of its own `beforeEach`/`beforeAll`.
const TRUNCATE_BOOKING_TABLES =
  'TRUNCATE TABLE "booking_entity", "pricing_rule_entity", "customer_entity", "property_entity", "service_entity", "team_entity" CASCADE';

// Real Postgres, single connection — NOT mocked repositories or services.
// Only `auditLogger` is faked (so failures can be injected on demand); the
// DB write path, and the full cross-module validation chain against real
// `CustomersService`/`PropertiesService`/`ServicesService`/
// `PricingRulesService`/`TeamsService` instances, are real (plan §7).
describe('BookingsService (real Postgres)', () => {
  let dataSource: DataSource;
  let dbLock: BookingDbTestLock;
  let auditLogger: { log: jest.Mock };
  let customersService: CustomersService;
  let propertiesService: PropertiesService;
  let servicesService: ServicesService;
  let pricingRulesService: PricingRulesService;
  let teamsService: TeamsService;
  let bookingsService: BookingsService;

  beforeAll(async () => {
    dataSource = createTestDataSource();
    await dataSource.initialize();
    dbLock = await acquireBookingDbTestLock(dataSource);
  });

  afterAll(async () => {
    await dbLock.release();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query(TRUNCATE_BOOKING_TABLES);
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };

    customersService = new CustomersService(
      dataSource,
      dataSource.getRepository(CustomerEntity),
      auditLogger,
    );
    propertiesService = new PropertiesService(
      dataSource,
      dataSource.getRepository(PropertyEntity),
      dataSource.getRepository(CustomerEntity),
      auditLogger,
    );
    servicesService = new ServicesService(
      dataSource,
      dataSource.getRepository(ServiceEntity),
      auditLogger,
    );
    pricingRulesService = new PricingRulesService(
      dataSource,
      dataSource.getRepository(PricingRuleEntity),
      dataSource.getRepository(ServiceEntity),
      auditLogger,
    );
    teamsService = new TeamsService(
      dataSource,
      dataSource.getRepository(TeamEntity),
      auditLogger,
    );
    bookingsService = new BookingsService(
      dataSource,
      dataSource.getRepository(BookingEntity),
      customersService,
      propertiesService,
      servicesService,
      pricingRulesService,
      teamsService,
      auditLogger,
    );
  });

  // Fixture: a Customer, a Property belonging to it, an active Service
  // with an active PricingRule at the given price, and a Team.
  async function createFixture(priceMinorUnits = 5000) {
    const customer = await customersService.create({
      actorId: 'actor-1',
      fullName: 'Jane Doe',
      email: 'jane@example.com',
      phone: '555-0100',
    });
    const property = await propertiesService.create({
      actorId: 'actor-1',
      customerId: customer.id,
      label: 'Home',
      addressLine1: '1 Main St',
      city: 'City',
      region: 'Region',
      postalCode: '00000',
    });
    const service = await servicesService.createService({
      actorId: 'actor-1',
      name: 'Standard Clean',
      durationMinutes: 60,
    });
    await pricingRulesService.createPricingRule({
      actorId: 'actor-1',
      serviceId: service.id,
      priceMinorUnits,
    });
    const team = await teamsService.createTeam({
      actorId: 'actor-1',
      name: 'Team A',
    });

    return { customer, property, service, team };
  }

  describe('create', () => {
    it('persists a booking with the expected pricingSnapshot and records booking.create', async () => {
      const { customer, property, service, team } = await createFixture(5000);

      const booking = await bookingsService.create({
        actorId: 'actor-1',
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        teamId: team.id,
        scheduledAt: new Date('2026-09-01T09:00:00Z'),
      });

      const row = await dataSource
        .getRepository(BookingEntity)
        .findOneBy({ id: booking.id });
      expect(row).not.toBeNull();
      expect(row?.pricingSnapshot.priceMinorUnits).toBe(5000);

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'actor-1',
          action: 'booking.create',
          entityType: 'booking',
          entityId: booking.id,
        }),
      );
    });

    it('throws BadRequestException when the property belongs to a different customer, persisting no row', async () => {
      const { property, service } = await createFixture();
      const otherCustomer = await customersService.create({
        actorId: 'actor-1',
        fullName: 'Other Customer',
        email: 'other@example.com',
        phone: '555-0101',
      });

      await expect(
        bookingsService.create({
          actorId: 'actor-1',
          customerId: otherCustomer.id,
          propertyId: property.id,
          serviceId: service.id,
          scheduledAt: new Date(),
        }),
      ).rejects.toThrow(BadRequestException);

      expect(await dataSource.getRepository(BookingEntity).find()).toHaveLength(
        0,
      );
    });

    it('throws BadRequestException for an inactive service, persisting no row', async () => {
      const { customer, property, service } = await createFixture();
      await servicesService.updateService(service.id, {
        actorId: 'actor-1',
        active: false,
      });

      await expect(
        bookingsService.create({
          actorId: 'actor-1',
          customerId: customer.id,
          propertyId: property.id,
          serviceId: service.id,
          scheduledAt: new Date(),
        }),
      ).rejects.toThrow(BadRequestException);

      expect(await dataSource.getRepository(BookingEntity).find()).toHaveLength(
        0,
      );
    });

    it('throws BadRequestException when the service has no active price, persisting no row', async () => {
      const customer = await customersService.create({
        actorId: 'actor-1',
        fullName: 'Jane Doe',
        email: 'jane@example.com',
        phone: '555-0100',
      });
      const property = await propertiesService.create({
        actorId: 'actor-1',
        customerId: customer.id,
        label: 'Home',
        addressLine1: '1 Main St',
        city: 'City',
        region: 'Region',
        postalCode: '00000',
      });
      const service = await servicesService.createService({
        actorId: 'actor-1',
        name: 'Unpriced Service',
        durationMinutes: 30,
      });

      await expect(
        bookingsService.create({
          actorId: 'actor-1',
          customerId: customer.id,
          propertyId: property.id,
          serviceId: service.id,
          scheduledAt: new Date(),
        }),
      ).rejects.toThrow(BadRequestException);

      expect(await dataSource.getRepository(BookingEntity).find()).toHaveLength(
        0,
      );
    });

    it('pricing snapshot immutability: a later catalog price change does not alter an existing booking (spec §2/§6)', async () => {
      const { customer, property, service, team } = await createFixture(5000);
      const booking = await bookingsService.create({
        actorId: 'actor-1',
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        teamId: team.id,
        scheduledAt: new Date('2026-09-01T09:00:00Z'),
      });

      await pricingRulesService.createPricingRule({
        actorId: 'actor-1',
        serviceId: service.id,
        priceMinorUnits: 6000,
      });

      const refetched = await bookingsService.findOne(booking.id);
      expect(refetched.pricingSnapshot.priceMinorUnits).toBe(5000);
    });

    it("scheduledAt in the future does not consult a future price — snapshot reflects today's active price (spec §4.1)", async () => {
      const { customer, property, service } = await createFixture(5000);

      const booking = await bookingsService.create({
        actorId: 'actor-1',
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        scheduledAt: new Date('2027-01-01T09:00:00Z'),
      });

      expect(booking.pricingSnapshot.priceMinorUnits).toBe(5000);
    });

    it('does not emit an audit event when actorId is null (REST posture, spec §4.4)', async () => {
      const { customer, property, service } = await createFixture();

      const booking = await bookingsService.create({
        actorId: null,
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        scheduledAt: new Date(),
      });

      const events = await dataSource
        .getRepository(AuditEventEntity)
        .findBy({ entityId: booking.id });
      expect(events).toHaveLength(0);
    });

    it('rolls back the booking row when the audit write fails inside the transaction', async () => {
      const { customer, property, service } = await createFixture();
      auditLogger.log.mockRejectedValueOnce(new Error('audit down'));

      await expect(
        bookingsService.create({
          actorId: 'actor-1',
          customerId: customer.id,
          propertyId: property.id,
          serviceId: service.id,
          scheduledAt: new Date(),
        }),
      ).rejects.toThrow('audit down');

      expect(await dataSource.getRepository(BookingEntity).find()).toHaveLength(
        0,
      );
    });
  });

  describe('update', () => {
    it('sets, clears, and preserves teamId across separate update calls', async () => {
      const { customer, property, service, team } = await createFixture();
      const booking = await bookingsService.create({
        actorId: 'actor-1',
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        scheduledAt: new Date('2026-09-01T09:00:00Z'),
      });

      await bookingsService.update(booking.id, {
        actorId: 'actor-1',
        teamId: team.id,
      });
      let row = await dataSource
        .getRepository(BookingEntity)
        .findOneByOrFail({ id: booking.id });
      expect(row.teamId).toBe(team.id);

      await bookingsService.update(booking.id, {
        actorId: 'actor-1',
        teamId: null,
      });
      row = await dataSource
        .getRepository(BookingEntity)
        .findOneByOrFail({ id: booking.id });
      expect(row.teamId).toBeNull();

      await bookingsService.update(booking.id, {
        actorId: 'actor-1',
        scheduledAt: new Date('2026-09-02T09:00:00Z'),
      });
      row = await dataSource
        .getRepository(BookingEntity)
        .findOneByOrFail({ id: booking.id });
      expect(row.teamId).toBeNull();
    });

    it('emits a booking.update audit event even on a no-effective-change resubmit', async () => {
      const { customer, property, service } = await createFixture();
      const booking = await bookingsService.create({
        actorId: 'actor-1',
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        scheduledAt: new Date('2026-09-01T09:00:00Z'),
      });
      auditLogger.log.mockClear();

      await bookingsService.update(booking.id, {
        actorId: 'actor-1',
        scheduledAt: booking.scheduledAt,
      });

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'booking.update',
          entityId: booking.id,
        }),
      );
    });

    it('rolls back the update when the audit write fails inside the transaction', async () => {
      const { customer, property, service } = await createFixture();
      const booking = await bookingsService.create({
        actorId: 'actor-1',
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        scheduledAt: new Date('2026-09-01T09:00:00Z'),
      });
      auditLogger.log.mockRejectedValueOnce(new Error('audit down'));

      await expect(
        bookingsService.update(booking.id, {
          actorId: 'actor-1',
          scheduledAt: new Date('2026-12-25T09:00:00Z'),
        }),
      ).rejects.toThrow('audit down');

      const row = await dataSource
        .getRepository(BookingEntity)
        .findOneByOrFail({ id: booking.id });
      expect(row.scheduledAt).toEqual(booking.scheduledAt);
    });

    it('does not emit an audit event when actorId is null (REST posture)', async () => {
      const { customer, property, service } = await createFixture();
      const booking = await bookingsService.create({
        actorId: 'actor-1',
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        scheduledAt: new Date('2026-09-01T09:00:00Z'),
      });

      await bookingsService.update(booking.id, {
        actorId: null,
        scheduledAt: new Date('2026-12-25T09:00:00Z'),
      });

      const events = await dataSource
        .getRepository(AuditEventEntity)
        .findBy({ entityId: booking.id, action: 'booking.update' });
      expect(events).toHaveLength(0);
    });
  });

  describe('remove', () => {
    it('hard-deletes the row and emits a booking.remove audit event', async () => {
      const { customer, property, service } = await createFixture();
      const booking = await bookingsService.create({
        actorId: 'actor-1',
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        scheduledAt: new Date('2026-09-01T09:00:00Z'),
      });

      const removed = await bookingsService.remove(booking.id, 'actor-1');

      // Regression guard against a real bug this level caught (a mocked
      // unit test could not): TypeORM's `manager.remove()` strips the id
      // off the entity it's given, so the returned value must still carry
      // it, not the now-mutated object `manager.remove()` produced.
      expect(removed.id).toBe(booking.id);

      expect(
        await dataSource
          .getRepository(BookingEntity)
          .findOneBy({ id: booking.id }),
      ).toBeNull();
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'booking.remove',
          entityId: booking.id,
        }),
      );
    });
  });

  // REST-audit-suppression (spec §4.4, plan §3's revision): the test that
  // would have caught this plan's own first-draft defect (auditing REST
  // calls under a placeholder actor string instead of skipping audit
  // entirely).
  it('REST-audit-suppression: create/update/remove with actorId null produce zero audit_event rows', async () => {
    const { customer, property, service } = await createFixture();

    const booking = await bookingsService.create({
      actorId: null,
      customerId: customer.id,
      propertyId: property.id,
      serviceId: service.id,
      scheduledAt: new Date('2026-09-01T09:00:00Z'),
    });
    await bookingsService.update(booking.id, {
      actorId: null,
      scheduledAt: new Date('2026-09-02T09:00:00Z'),
    });
    await bookingsService.remove(booking.id, null);

    const events = await dataSource
      .getRepository(AuditEventEntity)
      .findBy({ entityId: booking.id });
    expect(events).toHaveLength(0);
  });
});
