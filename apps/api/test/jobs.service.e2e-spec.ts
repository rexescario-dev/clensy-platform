import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { AdminScope } from '../src/platform/auth/domain/admin-scope';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { BookingsService } from '../src/modules/bookings/application/services/bookings.service';
import { BookingStatus } from '../src/modules/bookings/domain/booking-status';
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
import { CleanerEntity } from '../src/modules/cleaners/infrastructure/persistence/cleaner.entity';
import { TeamEntity } from '../src/modules/cleaners/infrastructure/persistence/team.entity';
import { JobsService } from '../src/modules/jobs/application/services/jobs.service';
import { DEFAULT_CHECKLIST_ITEMS } from '../src/modules/jobs/domain/default-checklist-items';
import { JobStatus } from '../src/modules/jobs/domain/job-status';
import { CleaningJobEntity } from '../src/modules/jobs/infrastructure/persistence/cleaning-job.entity';
import { ChecklistEntity } from '../src/modules/jobs/infrastructure/persistence/checklist.entity';
import { ChecklistItemEntity } from '../src/modules/jobs/infrastructure/persistence/checklist-item.entity';
import { TenantEntity } from '../src/modules/admins/infrastructure/persistence/tenant.entity';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import {
  acquireJobDbTestLock,
  JobDbTestLock,
} from './helpers/job-db-test-lock';

// This whole file runs under `acquireJobDbTestLock` and truncates
// `customer_entity`/`property_entity`/`booking_entity` (among others) in
// its own `beforeEach` — no other spec file's rows can be present, so
// every fixture here is safely attached to the bootstrap tenant (the one
// tenant row every migrated database is guaranteed to have) without
// colliding across runs or files.
const TENANT_ID = BOOTSTRAP_TENANT_ID;

function createTestDataSource(): DataSource {
  return new DataSource({
    database: process.env.DB_NAME ?? 'clensy',
    entities: [
      CleaningJobEntity,
      ChecklistEntity,
      ChecklistItemEntity,
      BookingEntity,
      CustomerEntity,
      PropertyEntity,
      ServiceEntity,
      PricingRuleEntity,
      TeamEntity,
      CleanerEntity, // TeamEntity#cleaners inverse metadata
      AuditEventEntity,
      TenantEntity, // CustomerEntity#tenant / PropertyEntity#tenant (#82)
    ],
    host: process.env.DB_HOST ?? 'localhost',
    password: process.env.DB_PASSWORD ?? 'clensy_dev',
    port: Number(process.env.DB_PORT ?? 5432),
    type: 'postgres',
    username: process.env.DB_USERNAME ?? 'clensy',
  });
}

// One combined `TRUNCATE ... CASCADE` — includes jobs tables first in
// spirit (FK order is not load-bearing for a single multi-table TRUNCATE)
// plus the booking fixtures this suite creates. `CASCADE` also clears
// `cleaner_entity` rows that reference `team_entity` (same reason as
// `bookings.service.e2e-spec.ts`). `maxWorkers: 1` already set.
const TRUNCATE_JOB_TABLES =
  'TRUNCATE TABLE "checklist_item_entity", "checklist_entity", "cleaning_job_entity", "booking_entity", "pricing_rule_entity", "customer_entity", "property_entity", "service_entity", "team_entity" CASCADE';

describe('JobsService (real Postgres)', () => {
  let dataSource: DataSource;
  let dbLock: JobDbTestLock;
  let auditLogger: { log: jest.Mock };
  let customersService: CustomersService;
  let propertiesService: PropertiesService;
  let servicesService: ServicesService;
  let pricingRulesService: PricingRulesService;
  let teamsService: TeamsService;
  let bookingsService: BookingsService;
  let jobsService: JobsService;

  beforeAll(async () => {
    dataSource = createTestDataSource();
    await dataSource.initialize();
    dbLock = await acquireJobDbTestLock(dataSource);
  });

  afterAll(async () => {
    await dbLock.release();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.query(TRUNCATE_JOB_TABLES);
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
    jobsService = new JobsService(
      dataSource,
      dataSource.getRepository(CleaningJobEntity),
      dataSource.getRepository(ChecklistEntity),
      dataSource.getRepository(ChecklistItemEntity),
      bookingsService,
      teamsService,
      auditLogger,
    );
  });

  async function createFixture() {
    const customer = await customersService.create({
      actorId: 'actor-1',
      tenantId: TENANT_ID,
      email: 'jane@example.com',
      fullName: 'Jane Doe',
      phone: '555-0100',
    });
    const property = await propertiesService.create({
      actorId: 'actor-1',
      customerId: customer.id,
      tenantId: TENANT_ID,
      addressLine1: '1 Main St',
      city: 'City',
      label: 'Home',
      postalCode: '00000',
      region: 'Region',
    });
    const service = await servicesService.createService({
      actorId: 'actor-1',
      tenantId: TENANT_ID,
      durationMinutes: 60,
      name: 'Standard Clean',
    });
    await pricingRulesService.createPricingRule({
      actorId: 'actor-1',
      serviceId: service.id,
      tenantId: TENANT_ID,
      priceMinorUnits: 5000,
    });
    const team = await teamsService.createTeam({
      actorId: 'actor-1',
      tenantId: TENANT_ID,
      name: 'Team A',
    });

    return { customer, property, service, team };
  }

  async function createBooking(status?: BookingStatus) {
    const fixture = await createFixture();
    let booking = await bookingsService.create({
      actorId: 'actor-1',
      customerId: fixture.customer.id,
      propertyId: fixture.property.id,
      serviceId: fixture.service.id,
      teamId: fixture.team.id,
      tenantId: TENANT_ID,
      scheduledAt: new Date('2026-09-01T09:00:00Z'),
    });
    if (status !== undefined) {
      booking = await bookingsService.update(booking.id, {
        actorId: 'actor-1',
        tenantId: TENANT_ID,
        status,
      });
    }
    return { ...fixture, booking };
  }

  it('creates a job from a PENDING booking with the observed snapshot, three default items, and job.create audit', async () => {
    const { booking, team } = await createBooking();

    const job = await jobsService.createFromBooking({
      actorId: 'actor-1',
      bookingId: booking.id,
      tenantId: TENANT_ID,
    });

    expect(job.status).toBe(JobStatus.PENDING);
    expect(job.bookingId).toBe(booking.id);
    expect(job.scheduledAt).toEqual(booking.scheduledAt);
    expect(job.teamId).toBe(team.id);
    expect(job.createdAt).toEqual(job.updatedAt);

    const checklists = await jobsService.getChecklistsByJobIds(
      [job.id],
      TENANT_ID,
    );
    expect(checklists).toHaveLength(1);
    const items = await jobsService.getChecklistItemsByChecklistIds(
      [checklists[0].id],
      TENANT_ID,
    );
    // #86 slice decisions 2/6: items are scoped through their checklist's
    // tenant in SQL — another tenant id finds none of them.
    await expect(
      jobsService.getChecklistItemsByChecklistIds(
        [checklists[0].id],
        randomUUID(),
      ),
    ).resolves.toEqual([]);
    expect(
      [...items]
        .sort((a, b) => a.position - b.position)
        .map((item) => ({ label: item.label, position: item.position })),
    ).toEqual([...DEFAULT_CHECKLIST_ITEMS]);

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'actor-1',
        entityId: job.id,
        tenantId: TENANT_ID,
        action: 'job.create',
        entityType: 'job',
        scope: AdminScope.TENANT,
      }),
    );
  });

  it('creates a job from a CONFIRMED booking', async () => {
    const { booking } = await createBooking(BookingStatus.CONFIRMED);

    await expect(
      jobsService.createFromBooking({
        actorId: 'actor-1',
        bookingId: booking.id,
        tenantId: TENANT_ID,
      }),
    ).resolves.toMatchObject({
      bookingId: booking.id,
      status: JobStatus.PENDING,
    });
  });

  it('creates a job from a COMPLETED booking', async () => {
    const { booking } = await createBooking(BookingStatus.COMPLETED);

    await expect(
      jobsService.createFromBooking({
        actorId: 'actor-1',
        bookingId: booking.id,
        tenantId: TENANT_ID,
      }),
    ).resolves.toMatchObject({
      bookingId: booking.id,
      status: JobStatus.PENDING,
    });
  });

  it('rejects a CANCELLED booking and persists no job row', async () => {
    const { booking } = await createBooking(BookingStatus.CANCELLED);

    await expect(
      jobsService.createFromBooking({
        actorId: 'actor-1',
        bookingId: booking.id,
        tenantId: TENANT_ID,
      }),
    ).rejects.toThrow(
      new BadRequestException('Cannot create a job from a cancelled booking'),
    );

    expect(
      await dataSource
        .getRepository(CleaningJobEntity)
        .findBy({ bookingId: booking.id }),
    ).toHaveLength(0);
  });

  it('does not change the job snapshot after updateBooking of scheduledAt and teamId', async () => {
    const { booking, team } = await createBooking();
    const job = await jobsService.createFromBooking({
      actorId: 'actor-1',
      bookingId: booking.id,
      tenantId: TENANT_ID,
    });

    await bookingsService.update(booking.id, {
      actorId: 'actor-1',
      teamId: null,
      tenantId: TENANT_ID,
      scheduledAt: new Date('2026-12-25T09:00:00Z'),
    });

    const refetched = await jobsService.getJob(job.id, TENANT_ID);
    expect(refetched).not.toBeNull();
    expect(refetched?.scheduledAt).toEqual(job.scheduledAt);
    expect(refetched?.teamId).toBe(team.id);
  });

  it('two concurrent createFromBooking calls for the same booking: one row, loser ConflictException', async () => {
    const { booking } = await createBooking();

    const warmupA = dataSource.createQueryRunner();
    const warmupB = dataSource.createQueryRunner();
    await Promise.all([warmupA.connect(), warmupB.connect()]);
    await Promise.all([warmupA.query('SELECT 1'), warmupB.query('SELECT 1')]);
    await Promise.all([warmupA.release(), warmupB.release()]);

    const [resultA, resultB] = await Promise.allSettled([
      jobsService.createFromBooking({
        actorId: 'actor-1',
        bookingId: booking.id,
        tenantId: TENANT_ID,
      }),
      jobsService.createFromBooking({
        actorId: 'actor-2',
        bookingId: booking.id,
        tenantId: TENANT_ID,
      }),
    ]);

    const fulfilled = [resultA, resultB].filter(
      (r) => r.status === 'fulfilled',
    );
    const rejected = [resultA, resultB].filter((r) => r.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);
    expect(rejected[0].reason.message).toBe(
      'A job already exists for this booking',
    );

    expect(
      await dataSource
        .getRepository(CleaningJobEntity)
        .findBy({ bookingId: booking.id }),
    ).toHaveLength(1);
  });

  it('rolls back the job, checklist, and items when the audit write fails inside the transaction', async () => {
    const { booking } = await createBooking();
    auditLogger.log.mockRejectedValueOnce(new Error('audit down'));

    await expect(
      jobsService.createFromBooking({
        actorId: 'actor-1',
        bookingId: booking.id,
        tenantId: TENANT_ID,
      }),
    ).rejects.toThrow('audit down');

    expect(
      await dataSource
        .getRepository(CleaningJobEntity)
        .findBy({ bookingId: booking.id }),
    ).toHaveLength(0);
    expect(await dataSource.getRepository(ChecklistEntity).find()).toHaveLength(
      0,
    );
    expect(
      await dataSource.getRepository(ChecklistItemEntity).find(),
    ).toHaveLength(0);
  });

  it('remove of a booking that has a job returns the generic FK ConflictException', async () => {
    const { booking } = await createBooking();
    await jobsService.createFromBooking({
      actorId: 'actor-1',
      bookingId: booking.id,
      tenantId: TENANT_ID,
    });

    await expect(
      bookingsService.remove(booking.id, 'actor-1', TENANT_ID),
    ).rejects.toThrow(
      new ConflictException(
        'Booking cannot be deleted because other records reference it',
      ),
    );

    expect(
      await dataSource
        .getRepository(BookingEntity)
        .findOneBy({ id: booking.id }),
    ).not.toBeNull();
  });

  // #86 replaced the three id-only parent FKs with composite
  // `_tenant` FKs, keeping each ON DELETE action.
  it('named unique and FK constraints exist with the specified delete actions', async () => {
    const rows: Array<{
      conname: string;
      contype: string;
      confdeltype: string;
    }> = await dataSource.query(
      `SELECT c.conname, c.contype, c.confdeltype
       FROM pg_constraint c
       WHERE c.conname IN (
         'UQ_cleaning_job_booking_id',
         'UQ_checklist_job_id',
         'fk_cleaning_job_booking_tenant',
         'fk_cleaning_job_team_tenant',
         'fk_checklist_job_tenant',
         'fk_checklist_item_checklist'
       )
       ORDER BY c.conname`,
    );

    const byName = Object.fromEntries(rows.map((row) => [row.conname, row]));

    expect(byName.UQ_cleaning_job_booking_id).toMatchObject({
      contype: 'u',
    });
    expect(byName.UQ_checklist_job_id).toMatchObject({ contype: 'u' });
    expect(byName.fk_cleaning_job_booking_tenant).toMatchObject({
      confdeltype: 'r',
      contype: 'f',
    });
    expect(byName.fk_cleaning_job_team_tenant).toMatchObject({
      confdeltype: 'r',
      contype: 'f',
    });
    expect(byName.fk_checklist_job_tenant).toMatchObject({
      confdeltype: 'c',
      contype: 'f',
    });
    expect(byName.fk_checklist_item_checklist).toMatchObject({
      confdeltype: 'c',
      contype: 'f',
    });
  });

  describe('assign / complete item / complete job', () => {
    async function createdJob() {
      const { booking, team } = await createBooking();
      const job = await jobsService.createFromBooking({
        actorId: 'actor-1',
        bookingId: booking.id,
        tenantId: TENANT_ID,
      });
      const [checklist] = await jobsService.getChecklistsByJobIds(
        [job.id],
        TENANT_ID,
      );
      const items = [
        ...(await jobsService.getChecklistItemsByChecklistIds(
          [checklist.id],
          TENANT_ID,
        )),
      ].sort((a, b) => a.position - b.position);
      return { checklist, items, job, team };
    }

    it('assignTeam on PENDING updates teamId, bumps updatedAt, and audits; missing team is NotFound', async () => {
      const { job } = await createdJob();
      const otherTeam = await teamsService.createTeam({
        actorId: 'actor-1',
        tenantId: TENANT_ID,
        name: 'Team B',
      });

      await expect(
        jobsService.assignTeam({
          actorId: 'actor-1',
          jobId: job.id,
          teamId: '00000000-0000-0000-0000-000000000000',
          tenantId: TENANT_ID,
        }),
      ).rejects.toThrow(
        new NotFoundException(
          'Team 00000000-0000-0000-0000-000000000000 not found',
        ),
      );

      const assigned = await jobsService.assignTeam({
        actorId: 'actor-1',
        jobId: job.id,
        teamId: otherTeam.id,
        tenantId: TENANT_ID,
      });
      expect(assigned.teamId).toBe(otherTeam.id);
      expect(assigned.status).toBe(JobStatus.PENDING);
      expect(assigned.updatedAt.getTime()).toBeGreaterThan(
        job.updatedAt.getTime(),
      );
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: job.id,
          tenantId: TENANT_ID,
          action: 'job.assign_team',
          scope: AdminScope.TENANT,
        }),
      );
    });

    it('same-state assignTeam still bumps updatedAt and writes audit', async () => {
      const { job, team } = await createdJob();
      const first = await jobsService.assignTeam({
        actorId: 'actor-1',
        jobId: job.id,
        teamId: team.id,
        tenantId: TENANT_ID,
      });
      auditLogger.log.mockClear();

      const second = await jobsService.assignTeam({
        actorId: 'actor-1',
        jobId: job.id,
        teamId: team.id,
        tenantId: TENANT_ID,
      });
      expect(second.teamId).toBe(team.id);
      expect(second.updatedAt.getTime()).toBeGreaterThan(
        first.updatedAt.getTime(),
      );
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'job.assign_team',
          tenantId: TENANT_ID,
          scope: AdminScope.TENANT,
        }),
      );
    });

    it('first item completion moves PENDING → IN_PROGRESS; last item does not complete the job', async () => {
      const { job, items } = await createdJob();

      const afterFirst = await jobsService.completeChecklistItem({
        actorId: 'actor-1',
        itemId: items[0].id,
        jobId: job.id,
        tenantId: TENANT_ID,
      });
      expect(afterFirst.status).toBe(JobStatus.IN_PROGRESS);

      await jobsService.completeChecklistItem({
        actorId: 'actor-1',
        itemId: items[1].id,
        jobId: job.id,
        tenantId: TENANT_ID,
      });
      const afterLast = await jobsService.completeChecklistItem({
        actorId: 'actor-1',
        itemId: items[2].id,
        jobId: job.id,
        tenantId: TENANT_ID,
      });
      expect(afterLast.status).toBe(JobStatus.IN_PROGRESS);

      const persistedItems = await jobsService.getChecklistItemsByChecklistIds(
        [items[0].checklistId],
        TENANT_ID,
      );
      expect(persistedItems.every((item) => item.completed)).toBe(true);
    });

    it('same-state completeChecklistItem bumps updatedAt and audits without changing status', async () => {
      const { job, items } = await createdJob();
      const first = await jobsService.completeChecklistItem({
        actorId: 'actor-1',
        itemId: items[0].id,
        jobId: job.id,
        tenantId: TENANT_ID,
      });
      auditLogger.log.mockClear();

      const again = await jobsService.completeChecklistItem({
        actorId: 'actor-1',
        itemId: items[0].id,
        jobId: job.id,
        tenantId: TENANT_ID,
      });
      expect(again.status).toBe(JobStatus.IN_PROGRESS);
      expect(again.updatedAt.getTime()).toBeGreaterThan(
        first.updatedAt.getTime(),
      );
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'job.checklist_item.complete',
          tenantId: TENANT_ID,
          scope: AdminScope.TENANT,
        }),
      );
    });

    it('completeJob with incomplete items is rejected; succeeding then same-state still bumps updatedAt', async () => {
      const { job, items } = await createdJob();

      await expect(
        jobsService.completeJob({
          actorId: 'actor-1',
          jobId: job.id,
          tenantId: TENANT_ID,
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Cannot complete a job with incomplete checklist items',
        ),
      );

      for (const item of items) {
        await jobsService.completeChecklistItem({
          actorId: 'actor-1',
          itemId: item.id,
          jobId: job.id,
          tenantId: TENANT_ID,
        });
      }

      const completed = await jobsService.completeJob({
        actorId: 'actor-1',
        jobId: job.id,
        tenantId: TENANT_ID,
      });
      expect(completed.status).toBe(JobStatus.COMPLETED);

      auditLogger.log.mockClear();
      const again = await jobsService.completeJob({
        actorId: 'actor-1',
        jobId: job.id,
        tenantId: TENANT_ID,
      });
      expect(again.status).toBe(JobStatus.COMPLETED);
      expect(again.updatedAt.getTime()).toBeGreaterThan(
        completed.updatedAt.getTime(),
      );
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'job.complete',
          tenantId: TENANT_ID,
          scope: AdminScope.TENANT,
        }),
      );
    });

    it('assignTeam and completeChecklistItem on a COMPLETED job are rejected', async () => {
      const { job, items, team } = await createdJob();
      for (const item of items) {
        await jobsService.completeChecklistItem({
          actorId: 'actor-1',
          itemId: item.id,
          jobId: job.id,
          tenantId: TENANT_ID,
        });
      }
      await jobsService.completeJob({
        actorId: 'actor-1',
        jobId: job.id,
        tenantId: TENANT_ID,
      });

      await expect(
        jobsService.assignTeam({
          actorId: 'actor-1',
          jobId: job.id,
          teamId: team.id,
          tenantId: TENANT_ID,
        }),
      ).rejects.toThrow(
        new BadRequestException('Cannot assign a team to a completed job'),
      );
      await expect(
        jobsService.completeChecklistItem({
          actorId: 'actor-1',
          itemId: items[0].id,
          jobId: job.id,
          tenantId: TENANT_ID,
        }),
      ).rejects.toThrow(
        new BadRequestException(
          'Cannot complete a checklist item on a completed job',
        ),
      );
    });

    it('completeJob allows a null teamId', async () => {
      const { customer, property, service } = await createFixture();
      const booking = await bookingsService.create({
        actorId: 'actor-1',
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service.id,
        tenantId: TENANT_ID,
        scheduledAt: new Date('2026-09-01T09:00:00Z'),
      });
      const job = await jobsService.createFromBooking({
        actorId: 'actor-1',
        bookingId: booking.id,
        tenantId: TENANT_ID,
      });
      expect(job.teamId).toBeNull();
      const [checklist] = await jobsService.getChecklistsByJobIds(
        [job.id],
        TENANT_ID,
      );
      const items = await jobsService.getChecklistItemsByChecklistIds(
        [checklist.id],
        TENANT_ID,
      );
      for (const item of items) {
        await jobsService.completeChecklistItem({
          actorId: 'actor-1',
          itemId: item.id,
          jobId: job.id,
          tenantId: TENANT_ID,
        });
      }
      await expect(
        jobsService.completeJob({
          actorId: 'actor-1',
          jobId: job.id,
          tenantId: TENANT_ID,
        }),
      ).resolves.toMatchObject({ status: JobStatus.COMPLETED, teamId: null });
    });
  });
});
