import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditLogEvent } from '../src/platform/audit/application/audit-logger.port';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { CleanersService } from '../src/modules/cleaners/application/services/cleaners.service';
import { TeamsService } from '../src/modules/cleaners/application/services/teams.service';
import { CleanerEntity } from '../src/modules/cleaners/infrastructure/persistence/cleaner.entity';
import { TeamEntity } from '../src/modules/cleaners/infrastructure/persistence/team.entity';
import {
  acquireCleanerDbTestLock,
  CleanerDbTestLock,
} from './helpers/cleaner-db-test-lock';

// Shared by this file's `describe` blocks (this task adds `TeamsService`'s;
// Task 2 adds `CleanersService`'s alongside it). Each block still creates
// and destroys its own `DataSource`/lock independently (deliberate — Jest
// scopes `beforeAll`/`afterAll` per `describe`, so lock-acquire/release
// cycles run strictly sequentially and can never deadlock); only the
// stateless config shape is factored out here.
function createTestDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'clensy',
    password: process.env.DB_PASSWORD ?? 'clensy_dev',
    database: process.env.DB_NAME ?? 'clensy',
    entities: [TeamEntity, CleanerEntity, AuditEventEntity],
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
// Holds a Postgres advisory lock (see `./helpers/cleaner-db-test-lock.ts`)
// for the whole `describe` block's run so its truncate/seed steps never
// overlap with another spec file touching the same tables, regardless of
// how Jest schedules files across parallel workers.
describe('TeamsService (real Postgres)', () => {
  let dataSource: DataSource;
  let dbLock: CleanerDbTestLock;
  let auditLogger: { log: jest.Mock };
  let service: TeamsService;

  beforeAll(async () => {
    dataSource = createTestDataSource();
    await dataSource.initialize();
    dbLock = await acquireCleanerDbTestLock(dataSource);
  });

  afterAll(async () => {
    await dbLock.release();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    // Task 2's `fk_cleaner_team` (`cleaner_entity.teamId` -> `team_entity.id`)
    // makes a plain `dataSource.getRepository(TeamEntity).clear()` alone
    // fail with "cannot truncate a table referenced in a foreign key
    // constraint" — Postgres's TRUNCATE refuses a referenced table unless
    // the referencing table is truncated in the *same* statement (this is
    // structural, not row-count-based: it fails even when `cleaner_entity`
    // is already empty). Both tables must be truncated together.
    await dataSource.query('TRUNCATE TABLE "cleaner_entity", "team_entity"');
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };
    service = new TeamsService(
      dataSource,
      dataSource.getRepository(TeamEntity),
      auditLogger,
    );
  });

  describe('createTeam', () => {
    it('persists a TeamEntity with the given name and records team.create', async () => {
      const created = await service.createTeam({
        actorId: 'actor-1',
        name: 'Alpha Team',
      });

      const row = await dataSource
        .getRepository(TeamEntity)
        .findOneBy({ id: created.id });
      expect(row).not.toBeNull();
      expect(row?.name).toBe('Alpha Team');

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'actor-1',
          action: 'team.create',
          entityType: 'team',
          entityId: created.id,
        }),
      );
    });

    it('throws ConflictException for a duplicate name, leaving only one row persisted', async () => {
      await service.createTeam({ actorId: 'actor-1', name: 'Alpha Team' });

      await expect(
        service.createTeam({ actorId: 'actor-1', name: 'Alpha Team' }),
      ).rejects.toThrow(ConflictException);

      const rows = await dataSource
        .getRepository(TeamEntity)
        .findBy({ name: 'Alpha Team' });
      expect(rows).toHaveLength(1);
    });

    it('rolls back the TeamEntity row when the audit write fails inside the transaction', async () => {
      auditLogger.log.mockRejectedValueOnce(new Error('audit down'));

      await expect(
        service.createTeam({ actorId: 'actor-1', name: 'Rollback Case' }),
      ).rejects.toThrow('audit down');

      const row = await dataSource
        .getRepository(TeamEntity)
        .findOneBy({ name: 'Rollback Case' });
      expect(row).toBeNull();
    });
  });
});

// Real Postgres, single connection — see the `TeamsService (real Postgres)`
// block above for the full rationale (only `AuditLogger` is faked, the DB
// write path is real, and the shared `CLEANER_DB_TEST_LOCK_KEY` advisory
// lock serializes this file's runs against any other spec touching
// `team_entity`/`cleaner_entity`). Task 2's own `describe` block, added
// alongside Task 1's `TeamsService` block in the same file per the plan.
describe('CleanersService (real Postgres)', () => {
  let dataSource: DataSource;
  let dbLock: CleanerDbTestLock;
  let auditLogger: { log: jest.Mock };
  let service: CleanersService;

  beforeAll(async () => {
    dataSource = createTestDataSource();
    await dataSource.initialize();
    dbLock = await acquireCleanerDbTestLock(dataSource);
  });

  afterAll(async () => {
    await dbLock.release();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    // See the `TeamsService` block's `beforeEach` comment above: both
    // tables must be truncated together because of `fk_cleaner_team`.
    await dataSource.query('TRUNCATE TABLE "cleaner_entity", "team_entity"');
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };
    service = new CleanersService(
      dataSource,
      dataSource.getRepository(CleanerEntity),
      dataSource.getRepository(TeamEntity),
      auditLogger,
    );
  });

  async function createTeam(name: string) {
    return dataSource
      .getRepository(TeamEntity)
      .save(dataSource.getRepository(TeamEntity).create({ name }));
  }

  describe('createCleaner', () => {
    it('persists a CleanerEntity with teamId: null and records cleaner.create', async () => {
      const created = await service.createCleaner({
        actorId: 'actor-1',
        fullName: 'Jane Doe',
        phone: '555-0100',
        email: 'jane@example.com',
        notes: 'Prefers mornings',
      });

      const row = await dataSource
        .getRepository(CleanerEntity)
        .findOneBy({ id: created.id });
      expect(row).not.toBeNull();
      expect(row?.fullName).toBe('Jane Doe');
      expect(row?.teamId).toBeNull();

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'actor-1',
          action: 'cleaner.create',
          entityType: 'cleaner',
          entityId: created.id,
        }),
      );
    });

    it('throws ConflictException for a duplicate email, leaving only one row persisted', async () => {
      await service.createCleaner({
        actorId: 'actor-1',
        fullName: 'Jane Doe',
        phone: '555-0100',
        email: 'jane@example.com',
      });

      await expect(
        service.createCleaner({
          actorId: 'actor-1',
          fullName: 'Jane Two',
          phone: '555-0200',
          email: 'jane@example.com',
        }),
      ).rejects.toThrow(ConflictException);

      const rows = await dataSource
        .getRepository(CleanerEntity)
        .findBy({ email: 'jane@example.com' });
      expect(rows).toHaveLength(1);
    });

    it('rolls back the CleanerEntity row when the audit write fails inside the transaction', async () => {
      auditLogger.log.mockRejectedValueOnce(new Error('audit down'));

      await expect(
        service.createCleaner({
          actorId: 'actor-1',
          fullName: 'Rollback Case',
          phone: '555-0300',
          email: 'rollback@example.com',
        }),
      ).rejects.toThrow('audit down');

      const row = await dataSource
        .getRepository(CleanerEntity)
        .findOneBy({ email: 'rollback@example.com' });
      expect(row).toBeNull();
    });
  });

  describe('updateCleaner', () => {
    it('updates only the provided field, leaving the rest unchanged in the re-read row', async () => {
      const created = await service.createCleaner({
        actorId: 'actor-1',
        fullName: 'Jane Doe',
        phone: '555-0100',
        email: 'jane@example.com',
        notes: 'Prefers mornings',
      });

      await service.updateCleaner(created.id, {
        actorId: 'actor-1',
        phone: '555-9999',
      });

      const row = await dataSource
        .getRepository(CleanerEntity)
        .findOneByOrFail({ id: created.id });
      expect(row.phone).toBe('555-9999');
      expect(row.fullName).toBe('Jane Doe');
      expect(row.email).toBe('jane@example.com');
      expect(row.notes).toBe('Prefers mornings');
    });

    it('explicit notes: null clears an existing value', async () => {
      const created = await service.createCleaner({
        actorId: 'actor-1',
        fullName: 'Jane Doe',
        phone: '555-0100',
        email: 'jane@example.com',
        notes: 'Prefers mornings',
      });

      await service.updateCleaner(created.id, {
        actorId: 'actor-1',
        notes: null,
      });

      const row = await dataSource
        .getRepository(CleanerEntity)
        .findOneByOrFail({ id: created.id });
      expect(row.notes).toBeNull();
    });

    it('throws NotFoundException for a nonexistent id', async () => {
      await expect(
        service.updateCleaner('00000000-0000-0000-0000-000000000000', {
          actorId: 'actor-1',
          fullName: 'Nobody',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("throws ConflictException when updating email to another cleaner's email, leaving the target row unchanged", async () => {
      const cleanerA = await service.createCleaner({
        actorId: 'actor-1',
        fullName: 'Cleaner A',
        phone: '555-0001',
        email: 'a@example.com',
      });
      const cleanerB = await service.createCleaner({
        actorId: 'actor-1',
        fullName: 'Cleaner B',
        phone: '555-0002',
        email: 'b@example.com',
      });

      await expect(
        service.updateCleaner(cleanerB.id, {
          actorId: 'actor-1',
          email: cleanerA.email,
        }),
      ).rejects.toThrow(ConflictException);

      const row = await dataSource
        .getRepository(CleanerEntity)
        .findOneByOrFail({ id: cleanerB.id });
      expect(row.email).toBe('b@example.com');
    });

    // M5 round-3 fix: proves manager.update() (not save()) makes the
    // unconditional-write guarantee hold even for a no-effective-change
    // update, where save()'s change-diffing would otherwise risk a no-op
    // UPDATE and silently skip the updatedAt bump / audit event.
    it('a no-effective-change update (every field set to its own current value) still strictly advances updatedAt and still audits cleaner.update', async () => {
      const created = await service.createCleaner({
        actorId: 'actor-1',
        fullName: 'Jane Doe',
        phone: '555-0100',
        email: 'jane@example.com',
        notes: 'Prefers mornings',
      });
      const before = await dataSource
        .getRepository(CleanerEntity)
        .findOneByOrFail({ id: created.id });

      // Ensure real wall-clock separation so a passing assertion can't be an
      // artifact of two Date.now() calls landing in the same millisecond.
      await new Promise((resolve) => setTimeout(resolve, 5));

      auditLogger.log.mockClear();
      await service.updateCleaner(created.id, {
        actorId: 'actor-1',
        fullName: before.fullName,
        phone: before.phone,
        email: before.email,
        notes: before.notes,
      });

      const after = await dataSource
        .getRepository(CleanerEntity)
        .findOneByOrFail({ id: created.id });

      expect(after.updatedAt.getTime()).toBeGreaterThan(
        before.updatedAt.getTime(),
      );
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'actor-1',
          action: 'cleaner.update',
          entityType: 'cleaner',
          entityId: created.id,
        }),
      );
    });
  });

  describe('assignCleanerToTeam', () => {
    it('sets teamId and audits cleaner.assign_team', async () => {
      const cleaner = await service.createCleaner({
        actorId: 'actor-1',
        fullName: 'Jane Doe',
        phone: '555-0100',
        email: 'jane@example.com',
      });
      const teamA = await createTeam('Team A');

      const updated = await service.assignCleanerToTeam({
        actorId: 'actor-1',
        cleanerId: cleaner.id,
        teamId: teamA.id,
      });

      expect(updated.teamId).toBe(teamA.id);

      const row = await dataSource
        .getRepository(CleanerEntity)
        .findOneByOrFail({ id: cleaner.id });
      expect(row.teamId).toBe(teamA.id);

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'actor-1',
          action: 'cleaner.assign_team',
          entityType: 'cleaner',
          entityId: cleaner.id,
        }),
      );
    });

    // M5 round-3 fix: same-state re-assignment must succeed (not error),
    // strictly advance updatedAt, and emit a SECOND cleaner.assign_team
    // audit event — proving manager.update() issues the UPDATE
    // unconditionally regardless of whether teamId actually changed.
    it('assigning to the same team again succeeds, strictly advances updatedAt, and emits a second cleaner.assign_team audit event', async () => {
      const cleaner = await service.createCleaner({
        actorId: 'actor-1',
        fullName: 'Jane Doe',
        phone: '555-0100',
        email: 'jane@example.com',
      });
      const teamA = await createTeam('Team A');

      await service.assignCleanerToTeam({
        actorId: 'actor-1',
        cleanerId: cleaner.id,
        teamId: teamA.id,
      });
      const before = await dataSource
        .getRepository(CleanerEntity)
        .findOneByOrFail({ id: cleaner.id });

      await new Promise((resolve) => setTimeout(resolve, 5));

      const updated = await service.assignCleanerToTeam({
        actorId: 'actor-1',
        cleanerId: cleaner.id,
        teamId: teamA.id,
      });

      expect(updated.teamId).toBe(teamA.id);
      expect(updated.updatedAt.getTime()).toBeGreaterThan(
        before.updatedAt.getTime(),
      );

      const assignEvents = (
        auditLogger.log.mock.calls as [AuditLogEvent][]
      ).filter(([event]) => event.action === 'cleaner.assign_team');
      expect(assignEvents).toHaveLength(2);
    });

    it("throws NotFoundException for a nonexistent teamId, leaving the cleaner's teamId unchanged", async () => {
      const cleaner = await service.createCleaner({
        actorId: 'actor-1',
        fullName: 'Jane Doe',
        phone: '555-0100',
        email: 'jane@example.com',
      });

      await expect(
        service.assignCleanerToTeam({
          actorId: 'actor-1',
          cleanerId: cleaner.id,
          teamId: '00000000-0000-0000-0000-000000000000',
        }),
      ).rejects.toThrow(NotFoundException);

      const row = await dataSource
        .getRepository(CleanerEntity)
        .findOneByOrFail({ id: cleaner.id });
      expect(row.teamId).toBeNull();
    });
  });
});
