import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { AddOnsService } from '../src/modules/catalog/application/services/add-ons.service';
import { PricingRulesService } from '../src/modules/catalog/application/services/pricing-rules.service';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { AddOnEntity } from '../src/modules/catalog/infrastructure/persistence/add-on.entity';
import { PricingRuleEntity } from '../src/modules/catalog/infrastructure/persistence/pricing-rule.entity';
import { ServiceEntity } from '../src/modules/catalog/infrastructure/persistence/service.entity';
import {
  acquireCatalogDbTestLock,
  CatalogDbTestLock,
} from './helpers/catalog-db-test-lock';

// Shared by this file's `describe` blocks (Task 1 added `ServicesService`'s;
// Task 2 added `AddOnsService`'s alongside it; Task 3 adds
// `PricingRulesService`'s). Each block still creates and destroys its own
// `DataSource`/lock independently (deliberate — Jest scopes
// `beforeAll`/`afterAll` per `describe`, so lock-acquire/release cycles run
// strictly sequentially and can never deadlock); only the stateless config
// shape is factored out here.
function createTestDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'clensy',
    password: process.env.DB_PASSWORD ?? 'clensy_dev',
    database: process.env.DB_NAME ?? 'clensy',
    entities: [ServiceEntity, AddOnEntity, PricingRuleEntity, AuditEventEntity],
  });
}

// Combined `TRUNCATE` of all three catalog tables in one statement — same
// technique the Cleaners plan used for `cleaner_entity`/`team_entity`. A
// single multi-table `TRUNCATE` truncates every listed table together
// regardless of listing order, so the ordering here is not load-bearing;
// what matters is that all three are truncated in ONE statement rather than
// as separate sequential `.clear()`/`TRUNCATE` calls, since a sequential
// truncate of `service_entity` before `pricing_rule_entity` would fail once
// the FK constraint (`pricing_rule_entity.serviceId → service_entity.id`)
// exists. Shared by all three `describe` blocks below so none of them can
// see residue left behind by another block earlier in the same file/process.
// CASCADE (Bookings migration regression fix, plan §3): `booking_entity`
// now carries its own FK into `service_entity`, a table outside this
// TRUNCATE's list — Postgres refuses to truncate a referenced table unless
// every referencing table is included or CASCADE is used, even an empty
// one. Safe here for the same reason `bookings.service.e2e-spec.ts`
// established: this file's own `beforeEach` re-seeds whatever it needs.
const TRUNCATE_CATALOG_TABLES =
  'TRUNCATE TABLE "pricing_rule_entity", "service_entity", "add_on_entity" CASCADE';

// Real Postgres, single connection — NOT mocked repositories. The
// transactional-rollback assertions below ("the row does not exist
// afterward") are an actual transactional guarantee: a mock can only prove
// "we called manager.save then it threw," never that persistence didn't
// happen. Only the `AuditLogger` boundary is faked (so failures can be
// injected on demand); the DB write path is real. Points at the same local
// docker-compose Postgres the rest of the suite/e2e tests use (`apps/api`'s
// gitignored `.env`).
//
// Lives under `apps/api/test/` (the `pnpm test:e2e` path), not `src/`'s
// mocked/no-infra `pnpm test` path — this file opens a real `DataSource`
// and truncates real tables, which `pnpm test` must never do.
//
// Holds a Postgres advisory lock (see `./helpers/catalog-db-test-lock.ts`)
// for the whole `describe` block's run so its truncate/seed steps never
// overlap with another spec file touching the same tables, regardless of
// how Jest schedules files across parallel workers.
describe('ServicesService (real Postgres)', () => {
  let dataSource: DataSource;
  let dbLock: CatalogDbTestLock;
  let auditLogger: { log: jest.Mock };
  let service: ServicesService;

  beforeAll(async () => {
    dataSource = createTestDataSource();
    await dataSource.initialize();
    dbLock = await acquireCatalogDbTestLock(dataSource);
  });

  afterAll(async () => {
    await dbLock.release();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    // `pricing_rule_entity`/`add_on_entity` are truncated here too (not just
    // in their own blocks below) so this block's tests never see residue
    // left behind by an earlier-run describe block in the same file/process.
    // `pricing_rule_entity` must be truncated before `service_entity` — it
    // holds the FK (`fk_pricing_rule_service`) — see `TRUNCATE_CATALOG_TABLES`.
    await dataSource.query(TRUNCATE_CATALOG_TABLES);
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };
    service = new ServicesService(
      dataSource,
      dataSource.getRepository(ServiceEntity),
      auditLogger,
    );
  });

  describe('createService', () => {
    it('persists a ServiceEntity with active: true and records service.create', async () => {
      const created = await service.createService({
        actorId: 'actor-1',
        name: 'Standard Clean',
        description: 'A standard clean',
        durationMinutes: 60,
      });

      const row = await dataSource
        .getRepository(ServiceEntity)
        .findOneBy({ id: created.id });
      expect(row).not.toBeNull();
      expect(row?.name).toBe('Standard Clean');
      expect(row?.active).toBe(true);

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'actor-1',
          action: 'service.create',
          entityType: 'service',
          entityId: created.id,
        }),
      );
    });

    it('throws ConflictException for a case-insensitive duplicate name, leaving only one row persisted', async () => {
      await service.createService({
        actorId: 'actor-1',
        name: 'Standard Clean',
        durationMinutes: 60,
      });

      await expect(
        service.createService({
          actorId: 'actor-1',
          name: 'standard clean',
          durationMinutes: 45,
        }),
      ).rejects.toThrow(ConflictException);

      const rows = await dataSource.getRepository(ServiceEntity).find();
      expect(rows).toHaveLength(1);
    });

    it('rolls back the ServiceEntity row when the audit write fails inside the transaction', async () => {
      auditLogger.log.mockRejectedValueOnce(new Error('audit down'));

      await expect(
        service.createService({
          actorId: 'actor-1',
          name: 'Rollback Case',
          durationMinutes: 30,
        }),
      ).rejects.toThrow('audit down');

      const row = await dataSource
        .getRepository(ServiceEntity)
        .findOneBy({ name: 'Rollback Case' });
      expect(row).toBeNull();
    });
  });

  describe('updateService', () => {
    it('updates only the provided field, leaving the rest unchanged in the re-read row', async () => {
      const created = await service.createService({
        actorId: 'actor-1',
        name: 'Standard Clean',
        description: 'A standard clean',
        durationMinutes: 60,
      });

      await service.updateService(created.id, {
        actorId: 'actor-1',
        durationMinutes: 90,
      });

      const row = await dataSource
        .getRepository(ServiceEntity)
        .findOneByOrFail({ id: created.id });
      expect(row.durationMinutes).toBe(90);
      expect(row.name).toBe('Standard Clean');
      expect(row.description).toBe('A standard clean');
      expect(row.active).toBe(true);
    });

    // M5-round-3-equivalent fix (mirrors the Cleaners plan's equivalent
    // `updateCleaner` test): proves manager.update() (not save()) makes the
    // unconditional-write guarantee hold even for a no-effective-change
    // update, where save()'s change-diffing would otherwise risk a no-op
    // UPDATE and silently skip the updatedAt bump / audit event.
    it('a no-effective-change update (every field set to its own current value) still strictly advances updatedAt and still audits service.update', async () => {
      const created = await service.createService({
        actorId: 'actor-1',
        name: 'Standard Clean',
        description: 'A standard clean',
        durationMinutes: 60,
      });
      const before = await dataSource
        .getRepository(ServiceEntity)
        .findOneByOrFail({ id: created.id });

      // Ensure real wall-clock separation so a passing assertion can't be an
      // artifact of two Date.now() calls landing in the same millisecond.
      await new Promise((resolve) => setTimeout(resolve, 5));

      auditLogger.log.mockClear();
      await service.updateService(created.id, {
        actorId: 'actor-1',
        name: before.name,
        description: before.description,
        durationMinutes: before.durationMinutes,
        active: before.active,
      });

      const after = await dataSource
        .getRepository(ServiceEntity)
        .findOneByOrFail({ id: created.id });

      expect(after.updatedAt.getTime()).toBeGreaterThan(
        before.updatedAt.getTime(),
      );
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'actor-1',
          action: 'service.update',
          entityType: 'service',
          entityId: created.id,
        }),
      );
    });

    it('setting active: false is still returned by listServices — Catalog reads are unfiltered', async () => {
      const created = await service.createService({
        actorId: 'actor-1',
        name: 'Standard Clean',
        durationMinutes: 60,
      });

      await service.updateService(created.id, {
        actorId: 'actor-1',
        active: false,
      });

      const all = await service.listServices();
      const found = all.find((s) => s.id === created.id);
      expect(found).toBeDefined();
      expect(found?.active).toBe(false);
    });
  });
});

// `AddOn` is a fully independent domain object (spec §4.1) — no
// relationship to `Service`. Own `DataSource`/lock (see the top-of-file
// comment on `createTestDataSource` for why each block does this
// independently), real Postgres, only `AuditLogger` faked — same shape as
// `ServicesService (real Postgres)` above.
describe('AddOnsService (real Postgres)', () => {
  let dataSource: DataSource;
  let dbLock: CatalogDbTestLock;
  let auditLogger: { log: jest.Mock };
  let service: AddOnsService;

  beforeAll(async () => {
    dataSource = createTestDataSource();
    await dataSource.initialize();
    dbLock = await acquireCatalogDbTestLock(dataSource);
  });

  afterAll(async () => {
    await dbLock.release();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    // Truncates `service_entity`/`pricing_rule_entity` too (not just
    // `add_on_entity`) so this block's tests never see residue left behind
    // by an earlier-run describe block in the same file/process.
    await dataSource.query(TRUNCATE_CATALOG_TABLES);
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };
    service = new AddOnsService(
      dataSource,
      dataSource.getRepository(AddOnEntity),
      auditLogger,
    );
  });

  describe('createAddOn', () => {
    it('persists an AddOnEntity with active: true and records add_on.create', async () => {
      const created = await service.createAddOn({
        actorId: 'actor-1',
        name: 'Extra Towels',
        description: 'Two additional bath towels',
        priceMinorUnits: 500,
      });

      const row = await dataSource
        .getRepository(AddOnEntity)
        .findOneBy({ id: created.id });
      expect(row).not.toBeNull();
      expect(row?.name).toBe('Extra Towels');
      expect(row?.active).toBe(true);

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'actor-1',
          action: 'add_on.create',
          entityType: 'add_on',
          entityId: created.id,
        }),
      );
    });

    it('throws ConflictException for a case-insensitive duplicate name, leaving only one row persisted', async () => {
      await service.createAddOn({
        actorId: 'actor-1',
        name: 'Extra Towels',
        priceMinorUnits: 500,
      });

      await expect(
        service.createAddOn({
          actorId: 'actor-1',
          name: 'extra towels',
          priceMinorUnits: 700,
        }),
      ).rejects.toThrow(ConflictException);

      const rows = await dataSource.getRepository(AddOnEntity).find();
      expect(rows).toHaveLength(1);
    });

    it('rolls back the AddOnEntity row when the audit write fails inside the transaction', async () => {
      auditLogger.log.mockRejectedValueOnce(new Error('audit down'));

      await expect(
        service.createAddOn({
          actorId: 'actor-1',
          name: 'Rollback Case',
          priceMinorUnits: 300,
        }),
      ).rejects.toThrow('audit down');

      const row = await dataSource
        .getRepository(AddOnEntity)
        .findOneBy({ name: 'Rollback Case' });
      expect(row).toBeNull();
    });
  });

  describe('updateAddOn', () => {
    it('updates only the provided field, leaving the rest unchanged in the re-read row', async () => {
      const created = await service.createAddOn({
        actorId: 'actor-1',
        name: 'Extra Towels',
        description: 'Two additional bath towels',
        priceMinorUnits: 500,
      });

      await service.updateAddOn(created.id, {
        actorId: 'actor-1',
        priceMinorUnits: 750,
      });

      const row = await dataSource
        .getRepository(AddOnEntity)
        .findOneByOrFail({ id: created.id });
      expect(row.priceMinorUnits).toBe(750);
      expect(row.name).toBe('Extra Towels');
      expect(row.description).toBe('Two additional bath towels');
      expect(row.active).toBe(true);
    });

    // Mirrors `updateService`'s equivalent test (M5-round-3-equivalent fix):
    // proves manager.update() (not save()) makes the unconditional-write
    // guarantee hold even for a no-effective-change update, where save()'s
    // change-diffing would otherwise risk a no-op UPDATE and silently skip
    // the updatedAt bump / audit event.
    it('a no-effective-change update (every field set to its own current value) still strictly advances updatedAt and still audits add_on.update', async () => {
      const created = await service.createAddOn({
        actorId: 'actor-1',
        name: 'Extra Towels',
        description: 'Two additional bath towels',
        priceMinorUnits: 500,
      });
      const before = await dataSource
        .getRepository(AddOnEntity)
        .findOneByOrFail({ id: created.id });

      // Ensure real wall-clock separation so a passing assertion can't be an
      // artifact of two Date.now() calls landing in the same millisecond.
      await new Promise((resolve) => setTimeout(resolve, 5));

      auditLogger.log.mockClear();
      await service.updateAddOn(created.id, {
        actorId: 'actor-1',
        name: before.name,
        description: before.description,
        priceMinorUnits: before.priceMinorUnits,
        active: before.active,
      });

      const after = await dataSource
        .getRepository(AddOnEntity)
        .findOneByOrFail({ id: created.id });

      expect(after.updatedAt.getTime()).toBeGreaterThan(
        before.updatedAt.getTime(),
      );
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'actor-1',
          action: 'add_on.update',
          entityType: 'add_on',
          entityId: created.id,
        }),
      );
    });

    it('setting active: false is still returned by listAddOns — Catalog reads are unfiltered', async () => {
      const created = await service.createAddOn({
        actorId: 'actor-1',
        name: 'Extra Towels',
        priceMinorUnits: 500,
      });

      await service.updateAddOn(created.id, {
        actorId: 'actor-1',
        active: false,
      });

      const all = await service.listAddOns();
      const found = all.find((a) => a.id === created.id);
      expect(found).toBeDefined();
      expect(found?.active).toBe(false);
    });
  });
});

// `PricingRule` has a real FK relationship to `Service` (spec §4.1, §4.7) —
// unlike `AddOn`. Own `DataSource`/lock (see the top-of-file comment on
// `createTestDataSource` for why each block does this independently), real
// Postgres, only `AuditLogger` faked — same shape as
// `ServicesService (real Postgres)`/`AddOnsService (real Postgres)` above.
// The concurrency test below is the one test in this file that a mocked
// unit test cannot substitute for — it is the only thing that actually
// exercises the hand-added PARTIAL unique index
// (`uq_pricing_rule_active_service`) under real concurrent transactions.
describe('PricingRulesService (real Postgres)', () => {
  let dataSource: DataSource;
  let dbLock: CatalogDbTestLock;
  let auditLogger: { log: jest.Mock };
  let service: PricingRulesService;

  beforeAll(async () => {
    dataSource = createTestDataSource();
    await dataSource.initialize();
    dbLock = await acquireCatalogDbTestLock(dataSource);
  });

  afterAll(async () => {
    await dbLock.release();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    // Truncates `service_entity`/`add_on_entity` too (not just
    // `pricing_rule_entity`) so this block's tests never see residue left
    // behind by an earlier-run describe block in the same file/process.
    await dataSource.query(TRUNCATE_CATALOG_TABLES);
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };
    service = new PricingRulesService(
      dataSource,
      dataSource.getRepository(PricingRuleEntity),
      dataSource.getRepository(ServiceEntity),
      auditLogger,
    );
  });

  // Seeds a persisted `Service` directly via the repository (not through
  // `ServicesService`) — this block is testing `PricingRulesService` in
  // isolation, and going through the sibling service would just be extra
  // indirection for a fixture that only needs a valid `serviceId` to exist.
  async function seedService(name: string) {
    return dataSource.getRepository(ServiceEntity).save(
      dataSource.getRepository(ServiceEntity).create({
        name,
        description: null,
        durationMinutes: 60,
        active: true,
      }),
    );
  }

  describe('createPricingRule', () => {
    it('creates an active PricingRule, records pricing_rule.create, and getActivePricing returns it', async () => {
      const svc = await seedService('Standard Clean');

      const created = await service.createPricingRule({
        actorId: 'actor-1',
        serviceId: svc.id,
        priceMinorUnits: 5000,
      });

      const row = await dataSource
        .getRepository(PricingRuleEntity)
        .findOneBy({ id: created.id });
      expect(row).not.toBeNull();
      expect(row?.active).toBe(true);
      expect(row?.priceMinorUnits).toBe(5000);

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'actor-1',
          action: 'pricing_rule.create',
          entityType: 'pricing_rule',
          entityId: created.id,
        }),
      );

      await expect(service.getActivePricing(svc.id)).resolves.toEqual(
        expect.objectContaining({ id: created.id, priceMinorUnits: 5000 }),
      );
    });

    it('a second createPricingRule for the same service deactivates the first rule and activates the second, leaving the first row unchanged apart from active', async () => {
      const svc = await seedService('Standard Clean');

      const first = await service.createPricingRule({
        actorId: 'actor-1',
        serviceId: svc.id,
        priceMinorUnits: 5000,
      });
      const firstRowBefore = await dataSource
        .getRepository(PricingRuleEntity)
        .findOneByOrFail({ id: first.id });

      const second = await service.createPricingRule({
        actorId: 'actor-1',
        serviceId: svc.id,
        priceMinorUnits: 6000,
      });

      const activeRows = await dataSource
        .getRepository(PricingRuleEntity)
        .findBy({ serviceId: svc.id, active: true });
      expect(activeRows).toHaveLength(1);
      expect(activeRows[0].id).toBe(second.id);

      const firstRowAfter = await dataSource
        .getRepository(PricingRuleEntity)
        .findOneByOrFail({ id: first.id });
      expect(firstRowAfter.active).toBe(false);
      expect(firstRowAfter.priceMinorUnits).toBe(
        firstRowBefore.priceMinorUnits,
      );
      expect(firstRowAfter.createdAt).toEqual(firstRowBefore.createdAt);

      await expect(service.getActivePricing(svc.id)).resolves.toEqual(
        expect.objectContaining({ id: second.id, priceMinorUnits: 6000 }),
      );
    });

    it('rolls back the entire transaction (including the deactivate step) when the audit write fails', async () => {
      const svc = await seedService('Standard Clean');

      const first = await service.createPricingRule({
        actorId: 'actor-1',
        serviceId: svc.id,
        priceMinorUnits: 5000,
      });

      auditLogger.log.mockRejectedValueOnce(new Error('audit down'));

      await expect(
        service.createPricingRule({
          actorId: 'actor-1',
          serviceId: svc.id,
          priceMinorUnits: 6000,
        }),
      ).rejects.toThrow('audit down');

      const firstRow = await dataSource
        .getRepository(PricingRuleEntity)
        .findOneByOrFail({ id: first.id });
      expect(firstRow.active).toBe(true);

      const rows = await dataSource
        .getRepository(PricingRuleEntity)
        .findBy({ serviceId: svc.id });
      expect(rows).toHaveLength(1);
    });

    // The most important test in this task (spec §7, added to the Accepted
    // spec's Tests scope at M3 round 1): proves the hand-added PARTIAL
    // unique index (`uq_pricing_rule_active_service`, `WHERE active = true`)
    // is what actually prevents two simultaneously-active rows when two
    // `createPricingRule` calls for the same `serviceId` race each other —
    // both can successfully run the deactivate step (each believing it's the
    // sole active rule), but only one insert can win. No mocked unit test can
    // produce this signal; it requires real concurrent Postgres transactions.
    //
    // The two-connection pre-warm below is load-bearing, not decoration:
    // without it, this test is flaky toward the WRONG side — investigated at
    // length while writing this task (raw SQL and a delayed-insert probe both
    // independently confirmed the partial index itself always correctly
    // blocks/rejects a genuine conflicting concurrent insert). The failure
    // mode without pre-warming is connection-acquisition asymmetry, not an
    // index defect: `Promise.allSettled` constructs both `createPricingRule`
    // promises in the same tick, but if the pool has zero idle connections at
    // that instant, whichever call's `dataSource.createQueryRunner().connect()`
    // resolves first gets a head start large enough (a fresh TCP handshake
    // vs. an already-idle connection) that it completes its entire
    // transaction — deactivate, insert, COMMIT — before the second call's
    // deactivate step even runs, which then correctly sees the first call's
    // now-committed row and cleanly deactivates it before inserting its own:
    // a legitimate, safe, but non-racing outcome (both fulfill, exactly one
    // active row) that doesn't exercise the index's conflict path this test
    // exists to prove. Explicitly warming two idle pool connections
    // immediately before firing the race removes that asymmetry so both
    // calls' deactivate/insert steps genuinely overlap.
    it('two concurrent createPricingRule calls for the same service: exactly one fulfills, one rejects with ConflictException, and exactly one row ends up active', async () => {
      const svc = await seedService('Standard Clean');

      const warmupA = dataSource.createQueryRunner();
      const warmupB = dataSource.createQueryRunner();
      await Promise.all([warmupA.connect(), warmupB.connect()]);
      await Promise.all([warmupA.query('SELECT 1'), warmupB.query('SELECT 1')]);
      await Promise.all([warmupA.release(), warmupB.release()]);

      const [resultA, resultB] = await Promise.allSettled([
        service.createPricingRule({
          actorId: 'actor-1',
          serviceId: svc.id,
          priceMinorUnits: 5000,
        }),
        service.createPricingRule({
          actorId: 'actor-2',
          serviceId: svc.id,
          priceMinorUnits: 6000,
        }),
      ]);

      const fulfilled = [resultA, resultB].filter(
        (r) => r.status === 'fulfilled',
      );
      const rejected = [resultA, resultB].filter(
        (r) => r.status === 'rejected',
      );

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect(rejected[0].reason).toBeInstanceOf(ConflictException);

      const activeRows = await dataSource
        .getRepository(PricingRuleEntity)
        .findBy({ serviceId: svc.id, active: true });
      expect(activeRows).toHaveLength(1);
    });
  });

  describe('getActivePricing', () => {
    it('throws NotFoundException for a nonexistent serviceId', async () => {
      await expect(
        service.getActivePricing('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns null for an existing service that has never had a PricingRule', async () => {
      const svc = await seedService('Standard Clean');

      await expect(service.getActivePricing(svc.id)).resolves.toBeNull();
    });
  });
});
