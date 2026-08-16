import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { TeamsService } from '../src/modules/cleaners/application/services/teams.service';
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
    entities: [TeamEntity, AuditEventEntity],
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
    await dataSource.getRepository(TeamEntity).clear();
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
