import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { AddOnsService } from '../src/modules/catalog/application/services/add-ons.service';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { AddOnEntity } from '../src/modules/catalog/infrastructure/persistence/add-on.entity';
import { ServiceEntity } from '../src/modules/catalog/infrastructure/persistence/service.entity';
import {
  acquireCatalogDbTestLock,
  CatalogDbTestLock,
} from './helpers/catalog-db-test-lock';

// Shared by this file's `describe` blocks (Task 1 added `ServicesService`'s;
// Task 2 adds `AddOnsService`'s alongside it; Task 3 adds
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
    entities: [ServiceEntity, AddOnEntity, AuditEventEntity],
  });
}

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
    // Task 3 extends this truncation further with `pricing_rule_entity`.
    // `add_on_entity` is truncated here too (not just in the AddOnsService
    // block below) so this block's tests never see residue left behind by
    // an earlier-run describe block in the same file/process.
    await dataSource.query('TRUNCATE TABLE "service_entity", "add_on_entity"');
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
    // Truncates `service_entity` too (not just `add_on_entity`) so this
    // block's tests never see residue left behind by an earlier-run
    // describe block in the same file/process.
    await dataSource.query('TRUNCATE TABLE "service_entity", "add_on_entity"');
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
