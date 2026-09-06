import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { AddOnsService } from '../src/modules/catalog/application/services/add-ons.service';
import { PricingRulesService } from '../src/modules/catalog/application/services/pricing-rules.service';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { PricingUnit } from '../src/modules/catalog/domain/pricing-unit';
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

  async function seedAddOn(name: string) {
    return dataSource.getRepository(AddOnEntity).save(
      dataSource.getRepository(AddOnEntity).create({
        name,
        description: null,
        priceMinorUnits: 1000,
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

      // This is the "first-ever price" race — no predecessor existed before
      // firing the race, so exactly one row total should exist afterward
      // (the loser's attempted insert never persists); it is the fulfilled
      // call's own row. See the dedicated "extends an existing predecessor"
      // tests below for the race that closes/extends an already-open
      // interval, where a predecessor row does remain.
      const allRows = await dataSource
        .getRepository(PricingRuleEntity)
        .findBy({ serviceId: svc.id });
      expect(allRows).toHaveLength(1);

      const won = (fulfilled[0] as PromiseFulfilledResult<PricingRuleEntity>)
        .value;
      expect(allRows[0].id).toBe(won.id);
      expect(allRows[0].effectiveTo).toBeNull();
      expect(activeRows[0].id).toBe(won.id);
    });

    it("two concurrent createPricingRule calls extending an existing predecessor (serviceId): exactly one fulfills, the predecessor closes exactly at the winner's effectiveFrom, legacy active stays consistent", async () => {
      const svc = await seedService('Standard Clean');
      const predecessor = await service.createPricingRule({
        actorId: 'actor-1',
        serviceId: svc.id,
        priceMinorUnits: 5000,
      });

      const warmupA = dataSource.createQueryRunner();
      const warmupB = dataSource.createQueryRunner();
      await Promise.all([warmupA.connect(), warmupB.connect()]);
      await Promise.all([warmupA.query('SELECT 1'), warmupB.query('SELECT 1')]);
      await Promise.all([warmupA.release(), warmupB.release()]);

      const effFromA = new Date(Date.now() + 60 * 60 * 1000);
      const effFromB = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const [resultA, resultB] = await Promise.allSettled([
        service.createPricingRule({
          actorId: 'actor-1',
          serviceId: svc.id,
          priceMinorUnits: 6000,
          effectiveFrom: effFromA,
        }),
        service.createPricingRule({
          actorId: 'actor-2',
          serviceId: svc.id,
          priceMinorUnits: 7000,
          effectiveFrom: effFromB,
        }),
      ]);

      const fulfilled = [resultA, resultB].filter(
        (r): r is PromiseFulfilledResult<PricingRuleEntity> =>
          r.status === 'fulfilled',
      );
      expect(fulfilled).toHaveLength(1);
      expect(
        [resultA, resultB].filter((r) => r.status === 'rejected'),
      ).toHaveLength(1);

      const allRows = await dataSource
        .getRepository(PricingRuleEntity)
        .findBy({ serviceId: svc.id });
      expect(allRows).toHaveLength(2);

      const won = fulfilled[0].value;
      const openRows = allRows.filter((r) => r.effectiveTo === null);
      expect(openRows).toHaveLength(1);
      expect(openRows[0].id).toBe(won.id);

      const predecessorRow = allRows.find((r) => r.id === predecessor.id)!;
      expect(predecessorRow.effectiveTo).toEqual(won.effectiveFrom);

      // Legacy active state: the winner's effectiveFrom is always in the
      // future in this test, so it must never be active, and the
      // predecessor (still <= now) must remain the legacy-active row.
      expect(won.active).toBe(false);
      const activeRows = await dataSource
        .getRepository(PricingRuleEntity)
        .findBy({ serviceId: svc.id, active: true });
      expect(activeRows).toHaveLength(1);
      expect(activeRows[0].id).toBe(predecessor.id);
    });
  });

  describe('mutual exclusivity', () => {
    it('throws BadRequestException when both serviceId and addOnId are provided, and creates no row', async () => {
      const svc = await seedService('Standard Clean');
      const addOn = await seedAddOn('Same-Day Turnaround');

      await expect(
        service.createPricingRule({
          actorId: 'actor-1',
          serviceId: svc.id,
          addOnId: addOn.id,
          priceMinorUnits: 5000,
        }),
      ).rejects.toThrow(BadRequestException);

      const rows = await dataSource.getRepository(PricingRuleEntity).find();
      expect(rows).toHaveLength(0);
    });

    it('throws BadRequestException when neither serviceId nor addOnId is provided, and creates no row', async () => {
      await expect(
        service.createPricingRule({
          actorId: 'actor-1',
          priceMinorUnits: 5000,
        }),
      ).rejects.toThrow(BadRequestException);

      const rows = await dataSource.getRepository(PricingRuleEntity).find();
      expect(rows).toHaveLength(0);
    });
  });

  describe('effective-dated pricing', () => {
    it('immediate, serviceId-targeted: identical observable shape to the legacy call, plus correct new columns', async () => {
      const svc = await seedService('Standard Clean');
      const before = new Date();

      const created = await service.createPricingRule({
        actorId: 'actor-1',
        serviceId: svc.id,
        priceMinorUnits: 5000,
      });
      const after = new Date();

      const row = await dataSource
        .getRepository(PricingRuleEntity)
        .findOneByOrFail({ id: created.id });
      expect(row.active).toBe(true);
      expect(row.unit).toBe(PricingUnit.PER_SERVICE);
      expect(row.minimumChargeMinorUnits).toBeNull();
      expect(row.addOnId).toBeNull();
      expect(row.effectiveTo).toBeNull();
      expect(row.effectiveFrom.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(row.effectiveFrom.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('future-scheduled, serviceId-targeted: legacy active row is untouched, new row is active:false, date chain still closes', async () => {
      const svc = await seedService('Standard Clean');
      const current = await service.createPricingRule({
        actorId: 'actor-1',
        serviceId: svc.id,
        priceMinorUnits: 5000,
      });

      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const scheduled = await service.createPricingRule({
        actorId: 'actor-1',
        serviceId: svc.id,
        priceMinorUnits: 7000,
        effectiveFrom: future,
      });

      const currentRow = await dataSource
        .getRepository(PricingRuleEntity)
        .findOneByOrFail({ id: current.id });
      expect(currentRow.active).toBe(true);
      expect(currentRow.effectiveTo).toEqual(future);

      const scheduledRow = await dataSource
        .getRepository(PricingRuleEntity)
        .findOneByOrFail({ id: scheduled.id });
      expect(scheduledRow.active).toBe(false);
      expect(scheduledRow.effectiveTo).toBeNull();

      await expect(service.getActivePricing(svc.id)).resolves.toEqual(
        expect.objectContaining({ id: current.id }),
      );
    });

    it('addOnId-targeted (first-ever rule): always active:false regardless of effectiveFrom, serviceId is null', async () => {
      const addOn = await seedAddOn('Same-Day Turnaround');

      const created = await service.createPricingRule({
        actorId: 'actor-1',
        addOnId: addOn.id,
        priceMinorUnits: 1500,
        unit: PricingUnit.PER_ITEM,
      });

      const row = await dataSource
        .getRepository(PricingRuleEntity)
        .findOneByOrFail({ id: created.id });
      expect(row.active).toBe(false);
      expect(row.serviceId).toBeNull();
      expect(row.addOnId).toBe(addOn.id);
      expect(row.unit).toBe(PricingUnit.PER_ITEM);
      expect(row.effectiveTo).toBeNull();
    });

    it("forward-only rejection: effectiveFrom equal to, or before, the open interval's effectiveFrom is rejected and leaves the open interval unchanged", async () => {
      const svc = await seedService('Standard Clean');
      const t = new Date();
      const first = await service.createPricingRule({
        actorId: 'actor-1',
        serviceId: svc.id,
        priceMinorUnits: 5000,
        effectiveFrom: t,
      });

      await expect(
        service.createPricingRule({
          actorId: 'actor-1',
          serviceId: svc.id,
          priceMinorUnits: 6000,
          effectiveFrom: t,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.createPricingRule({
          actorId: 'actor-1',
          serviceId: svc.id,
          priceMinorUnits: 6000,
          effectiveFrom: new Date(t.getTime() - 1000),
        }),
      ).rejects.toThrow(BadRequestException);

      const firstRow = await dataSource
        .getRepository(PricingRuleEntity)
        .findOneByOrFail({ id: first.id });
      expect(firstRow.effectiveTo).toBeNull();

      const rows = await dataSource
        .getRepository(PricingRuleEntity)
        .findBy({ serviceId: svc.id });
      expect(rows).toHaveLength(1);
    });

    it("valid forward extension: the prior interval closes exactly at the new interval's effectiveFrom", async () => {
      const svc = await seedService('Standard Clean');
      const t1 = new Date();
      const t2 = new Date(t1.getTime() + 60 * 60 * 1000);

      const first = await service.createPricingRule({
        actorId: 'actor-1',
        serviceId: svc.id,
        priceMinorUnits: 5000,
        effectiveFrom: t1,
      });
      await service.createPricingRule({
        actorId: 'actor-1',
        serviceId: svc.id,
        priceMinorUnits: 6000,
        effectiveFrom: t2,
      });

      const firstRow = await dataSource
        .getRepository(PricingRuleEntity)
        .findOneByOrFail({ id: first.id });
      expect(firstRow.effectiveTo).toEqual(t2);
    });

    it('rolls back the close step (not just the insert) when the audit write fails on a forward extension', async () => {
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
          effectiveFrom: new Date(Date.now() + 60 * 60 * 1000),
        }),
      ).rejects.toThrow('audit down');

      const firstRow = await dataSource
        .getRepository(PricingRuleEntity)
        .findOneByOrFail({ id: first.id });
      expect(firstRow.effectiveTo).toBeNull();
    });

    it('two concurrent createPricingRule calls for the same addOnId: exactly one fulfills, one rejects, exactly one open row remains', async () => {
      const addOn = await seedAddOn('Same-Day Turnaround');

      const warmupA = dataSource.createQueryRunner();
      const warmupB = dataSource.createQueryRunner();
      await Promise.all([warmupA.connect(), warmupB.connect()]);
      await Promise.all([warmupA.query('SELECT 1'), warmupB.query('SELECT 1')]);
      await Promise.all([warmupA.release(), warmupB.release()]);

      const [resultA, resultB] = await Promise.allSettled([
        service.createPricingRule({
          actorId: 'actor-1',
          addOnId: addOn.id,
          priceMinorUnits: 1000,
        }),
        service.createPricingRule({
          actorId: 'actor-2',
          addOnId: addOn.id,
          priceMinorUnits: 1200,
        }),
      ]);

      const fulfilled = [resultA, resultB].filter(
        (r) => r.status === 'fulfilled',
      );
      expect(fulfilled).toHaveLength(1);
      expect(
        [resultA, resultB].filter((r) => r.status === 'rejected'),
      ).toHaveLength(1);

      const openRows = await dataSource
        .getRepository(PricingRuleEntity)
        .createQueryBuilder('rule')
        .where('rule."addOnId" = :id', { id: addOn.id })
        .andWhere('rule."effectiveTo" IS NULL')
        .getMany();
      expect(openRows).toHaveLength(1);
    });
  });

  describe('resolveEffectivePricing', () => {
    it('resolves the correct interval for past/current/future/boundary dates, half-open semantics', async () => {
      const svc = await seedService('Standard Clean');
      const t1 = new Date();
      const t2 = new Date(t1.getTime() + 60 * 60 * 1000);

      const a = await service.createPricingRule({
        actorId: 'actor-1',
        serviceId: svc.id,
        priceMinorUnits: 5000,
        effectiveFrom: t1,
      });
      const b = await service.createPricingRule({
        actorId: 'actor-1',
        serviceId: svc.id,
        priceMinorUnits: 6000,
        effectiveFrom: t2,
      });

      await expect(
        service.resolveEffectivePricing({ serviceId: svc.id }, t1),
      ).resolves.toEqual(expect.objectContaining({ id: a.id }));
      await expect(
        service.resolveEffectivePricing(
          { serviceId: svc.id },
          new Date(t1.getTime() + 30 * 60 * 1000),
        ),
      ).resolves.toEqual(expect.objectContaining({ id: a.id }));
      // Boundary: asOf === t2 (== a's effectiveTo == b's effectiveFrom)
      // resolves to b, per the half-open [effectiveFrom, effectiveTo) rule.
      await expect(
        service.resolveEffectivePricing({ serviceId: svc.id }, t2),
      ).resolves.toEqual(expect.objectContaining({ id: b.id }));
      await expect(
        service.resolveEffectivePricing(
          { serviceId: svc.id },
          new Date(t1.getTime() - 1000),
        ),
      ).resolves.toBeNull();
    });

    it('resolves correctly for an addOnId target, target-agnostic behavior', async () => {
      const addOn = await seedAddOn('Same-Day Turnaround');
      const t1 = new Date();
      const created = await service.createPricingRule({
        actorId: 'actor-1',
        addOnId: addOn.id,
        priceMinorUnits: 1500,
        effectiveFrom: t1,
      });

      await expect(
        service.resolveEffectivePricing({ addOnId: addOn.id }, t1),
      ).resolves.toEqual(expect.objectContaining({ id: created.id }));
    });

    it('returns null for a target that has never had a PricingRule, without throwing', async () => {
      const svc = await seedService('Standard Clean');

      await expect(
        service.resolveEffectivePricing({ serviceId: svc.id }, new Date()),
      ).resolves.toBeNull();
    });

    it('resolves normally for a Service/AddOn with active: false (catalog-retired) — does not check retirement status', async () => {
      const svc = await seedService('Retired Service');
      const t1 = new Date();
      const created = await service.createPricingRule({
        actorId: 'actor-1',
        serviceId: svc.id,
        priceMinorUnits: 5000,
        effectiveFrom: t1,
      });
      await dataSource
        .getRepository(ServiceEntity)
        .update({ id: svc.id }, { active: false });

      await expect(
        service.resolveEffectivePricing({ serviceId: svc.id }, t1),
      ).resolves.toEqual(expect.objectContaining({ id: created.id }));
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

  // Task 5 (plan §8): cross-cutting scenarios combining `getActivePricing`
  // and `resolveEffectivePricing` in a single assertion, proving the two
  // mechanisms' independence (spec §4.2, §4.4, §5) rather than any one
  // method's behavior in isolation — the thing no single prior task's tests
  // asserted together.
  describe('effective-dated pricing — cross-cutting', () => {
    it('serviceId: legacy active pricing and effective-dated resolution stay independently correct through an immediate + future scheduling', async () => {
      const svc = await seedService('Standard Clean');
      const immediate = await service.createPricingRule({
        actorId: 'actor-1',
        serviceId: svc.id,
        priceMinorUnits: 5000,
      });
      const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const scheduled = await service.createPricingRule({
        actorId: 'actor-1',
        serviceId: svc.id,
        priceMinorUnits: 7000,
        effectiveFrom: future,
      });

      // Legacy path — untouched by scheduling.
      await expect(service.getActivePricing(svc.id)).resolves.toEqual(
        expect.objectContaining({ id: immediate.id }),
      );

      // Effective-dated path — target-agnostic, correctly time-aware.
      await expect(
        service.resolveEffectivePricing({ serviceId: svc.id }, new Date()),
      ).resolves.toEqual(expect.objectContaining({ id: immediate.id }));
      await expect(
        service.resolveEffectivePricing({ serviceId: svc.id }, future),
      ).resolves.toEqual(expect.objectContaining({ id: scheduled.id }));
      await expect(
        service.resolveEffectivePricing(
          { serviceId: svc.id },
          new Date(future.getTime() - 24 * 60 * 60 * 1000),
        ),
      ).resolves.toEqual(expect.objectContaining({ id: immediate.id }));
    });

    it('addOnId: always active:false, resolveEffectivePricing resolves it correctly, legacy getActivePricing is not a valid call shape for this target', async () => {
      const addOn = await seedAddOn('Same-Day Turnaround');
      const t1 = new Date();
      const created = await service.createPricingRule({
        actorId: 'actor-1',
        addOnId: addOn.id,
        priceMinorUnits: 1500,
        unit: PricingUnit.PER_ITEM,
        effectiveFrom: t1,
      });

      const row = await dataSource
        .getRepository(PricingRuleEntity)
        .findOneByOrFail({ id: created.id });
      expect(row.active).toBe(false);

      await expect(
        service.resolveEffectivePricing({ addOnId: addOn.id }, t1),
      ).resolves.toEqual(expect.objectContaining({ id: created.id }));
      // `getActivePricing(serviceId: string)` has no overload accepting an
      // `addOnId` — this boundary is enforced at compile time, not runtime;
      // there is no call to make here that would even type-check.
    });
  });
});

// Task 1 (plan §8): schema-level invariants and the migration's backfill
// computation. A separate `describe` block — these tests exercise the raw
// database schema directly via `manager.query()`, not `PricingRulesService`,
// so they belong conceptually with the schema/migration, not the service.
describe('PricingRuleEntity schema (real Postgres)', () => {
  let dataSource: DataSource;
  let dbLock: CatalogDbTestLock;

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
    await dataSource.query(TRUNCATE_CATALOG_TABLES);
  });

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

  describe('mutual-exclusivity CHECK constraint', () => {
    it('rejects a row with both serviceId and addOnId set', async () => {
      const svc = await seedService('Standard Clean');
      const addOn = await dataSource.getRepository(AddOnEntity).save(
        dataSource.getRepository(AddOnEntity).create({
          name: 'Turnaround',
          description: null,
          priceMinorUnits: 1000,
          active: true,
        }),
      );

      await expect(
        dataSource.query(
          `INSERT INTO "pricing_rule_entity" ("serviceId", "addOnId", "priceMinorUnits", "effectiveFrom") VALUES ($1, $2, $3, now())`,
          [svc.id, addOn.id, 5000],
        ),
      ).rejects.toThrow(/ck_pricing_rule_target/);
    });

    it('rejects a row with neither serviceId nor addOnId set', async () => {
      await expect(
        dataSource.query(
          `INSERT INTO "pricing_rule_entity" ("priceMinorUnits", "effectiveFrom") VALUES ($1, now())`,
          [5000],
        ),
      ).rejects.toThrow(/ck_pricing_rule_target/);
    });
  });

  describe('open-interval partial unique indexes', () => {
    it('rejects a second open (effectiveTo IS NULL) row for the same serviceId', async () => {
      const svc = await seedService('Standard Clean');
      // `active: false` on both rows — isolates this test to the new
      // `uq_pricing_rule_open_service` index; otherwise two rows with
      // `active` at its column default (`true`) would also collide on the
      // unrelated, pre-existing `uq_pricing_rule_active_service` index
      // first, since Postgres reports whichever constraint it happens to
      // check first.
      await dataSource.query(
        `INSERT INTO "pricing_rule_entity" ("serviceId", "priceMinorUnits", "effectiveFrom", "active") VALUES ($1, $2, now(), false)`,
        [svc.id, 5000],
      );

      await expect(
        dataSource.query(
          `INSERT INTO "pricing_rule_entity" ("serviceId", "priceMinorUnits", "effectiveFrom", "active") VALUES ($1, $2, now(), false)`,
          [svc.id, 6000],
        ),
      ).rejects.toThrow(/uq_pricing_rule_open_service/);
    });

    it('rejects a second open (effectiveTo IS NULL) row for the same addOnId', async () => {
      const addOn = await dataSource.getRepository(AddOnEntity).save(
        dataSource.getRepository(AddOnEntity).create({
          name: 'Turnaround',
          description: null,
          priceMinorUnits: 1000,
          active: true,
        }),
      );
      await dataSource.query(
        `INSERT INTO "pricing_rule_entity" ("addOnId", "priceMinorUnits", "effectiveFrom") VALUES ($1, $2, now())`,
        [addOn.id, 1000],
      );

      await expect(
        dataSource.query(
          `INSERT INTO "pricing_rule_entity" ("addOnId", "priceMinorUnits", "effectiveFrom") VALUES ($1, $2, now())`,
          [addOn.id, 1200],
        ),
      ).rejects.toThrow(/uq_pricing_rule_open_addon/);
    });
  });

  describe('column defaults for post-migration inserts', () => {
    it('a row created through PricingRulesService with only the legacy call shape gets correct defaults', async () => {
      const svc = await seedService('Standard Clean');
      const auditLogger = { log: jest.fn().mockResolvedValue(undefined) };
      const service = new PricingRulesService(
        dataSource,
        dataSource.getRepository(PricingRuleEntity),
        dataSource.getRepository(ServiceEntity),
        auditLogger,
      );

      const created = await service.createPricingRule({
        actorId: 'actor-1',
        serviceId: svc.id,
        priceMinorUnits: 5000,
      });

      const row = await dataSource
        .getRepository(PricingRuleEntity)
        .findOneByOrFail({ id: created.id });
      expect(row.unit).toBe(PricingUnit.PER_SERVICE);
      expect(row.minimumChargeMinorUnits).toBeNull();
      expect(row.addOnId).toBeNull();
    });
  });

  // The migration's own backfill computation, replayed against a throwaway
  // temp table seeded with legacy-shaped data (plan §3, §7, §8's required
  // correction). This verifies the backfill SQL's own semantics —
  // partitioning and tie-breaking — against data shaped like it predates
  // this migration; it does not execute the migration file itself, and does
  // not touch the real `pricing_rule_entity` table (session-scoped TEMP
  // TABLE, dropped automatically). The UPDATE statements below are copied
  // verbatim from `ExtendPricingRuleEffectiveDating`'s `up()`, adapted only
  // to target the fixture table name.
  describe('migration backfill replay against legacy-shaped data', () => {
    async function seedFixtureAndBackfill(
      queryRunner: import('typeorm').QueryRunner,
      rows: { id: string; serviceId: string; createdAt: Date }[],
    ) {
      await queryRunner.query(`
        CREATE TEMP TABLE pricing_rule_backfill_fixture (
          "id" uuid PRIMARY KEY,
          "serviceId" uuid NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL,
          "effectiveFrom" TIMESTAMP WITH TIME ZONE,
          "effectiveTo" TIMESTAMP WITH TIME ZONE
        )
      `);
      for (const row of rows) {
        await queryRunner.query(
          `INSERT INTO pricing_rule_backfill_fixture ("id", "serviceId", "createdAt") VALUES ($1, $2, $3)`,
          [row.id, row.serviceId, row.createdAt],
        );
      }

      // Verbatim from the migration's up() (effectiveFrom backfill step).
      await queryRunner.query(
        `UPDATE pricing_rule_backfill_fixture SET "effectiveFrom" = "createdAt"`,
      );
      // Verbatim from the migration's up() (effectiveTo backfill step),
      // targeting the fixture table.
      await queryRunner.query(`
        UPDATE pricing_rule_backfill_fixture AS p
        SET "effectiveTo" = sub."nextCreatedAt"
        FROM (
          SELECT "id", LEAD("createdAt") OVER (PARTITION BY "serviceId" ORDER BY "createdAt", "id") AS "nextCreatedAt"
          FROM pricing_rule_backfill_fixture
        ) AS sub
        WHERE p."id" = sub."id"
      `);

      const result: {
        id: string;
        effectiveFrom: Date;
        effectiveTo: Date | null;
      }[] = await queryRunner.query(
        `SELECT "id", "effectiveFrom", "effectiveTo" FROM pricing_rule_backfill_fixture`,
      );
      await queryRunner.query(`DROP TABLE pricing_rule_backfill_fixture`);
      return result;
    }

    it('correctly partitions multi-row history per service and tie-breaks by id', async () => {
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      try {
        const serviceA = '00000000-0000-0000-0001-000000000000';
        const serviceB = '00000000-0000-0000-0002-000000000000';
        const serviceC = '00000000-0000-0000-0003-000000000000';
        const t1 = new Date('2026-01-01T00:00:00Z');
        const t2 = new Date('2026-02-01T00:00:00Z');
        const t3 = new Date('2026-03-01T00:00:00Z');
        const t4 = new Date('2026-04-01T00:00:00Z');
        const t5 = new Date('2026-05-01T00:00:00Z');

        const r1 = '00000000-0000-0000-0000-000000000001';
        const r2 = '00000000-0000-0000-0000-000000000002';
        const r3 = '00000000-0000-0000-0000-000000000003';
        const r4 = '00000000-0000-0000-0000-000000000004';
        const r5 = '00000000-0000-0000-0000-000000000005';
        const r6 = '00000000-0000-0000-0000-000000000006';

        const rows = await seedFixtureAndBackfill(queryRunner, [
          { id: r1, serviceId: serviceA, createdAt: t1 },
          { id: r2, serviceId: serviceA, createdAt: t2 },
          { id: r3, serviceId: serviceA, createdAt: t3 },
          { id: r4, serviceId: serviceB, createdAt: t4 },
          { id: r5, serviceId: serviceC, createdAt: t5 },
          { id: r6, serviceId: serviceC, createdAt: t5 }, // tied timestamp
        ]);
        const byId = new Map(rows.map((r) => [r.id, r]));

        // Service A: multi-row partitioning within one service.
        expect(byId.get(r1)!.effectiveTo).toEqual(t2);
        expect(byId.get(r2)!.effectiveTo).toEqual(t3);
        expect(byId.get(r3)!.effectiveTo).toBeNull();

        // Service B: a single-row partition is never spuriously chained to
        // a different service's rows.
        expect(byId.get(r4)!.effectiveTo).toBeNull();

        // Service C: the tied-timestamp pair deterministically orders the
        // lower id as superseded first.
        expect(byId.get(r5)!.effectiveTo).toEqual(t5);
        expect(byId.get(r6)!.effectiveTo).toBeNull();
      } finally {
        await queryRunner.release();
      }
    });

    it('tie-breaker determinism holds across repeated runs', async () => {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const queryRunner = dataSource.createQueryRunner();
        await queryRunner.connect();
        try {
          const serviceC = '00000000-0000-0000-0003-000000000000';
          const t5 = new Date('2026-05-01T00:00:00Z');
          const r5 = '00000000-0000-0000-0000-000000000005';
          const r6 = '00000000-0000-0000-0000-000000000006';

          const rows = await seedFixtureAndBackfill(queryRunner, [
            { id: r5, serviceId: serviceC, createdAt: t5 },
            { id: r6, serviceId: serviceC, createdAt: t5 },
          ]);
          const byId = new Map(rows.map((r) => [r.id, r]));

          expect(byId.get(r5)!.effectiveTo).toEqual(t5);
          expect(byId.get(r6)!.effectiveTo).toBeNull();
        } finally {
          await queryRunner.release();
        }
      }
    });
  });
});
