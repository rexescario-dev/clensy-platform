import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { AuditEventEntity } from '../../../../platform/audit/infrastructure/persistence/audit-event.entity';
import { Role } from '../../../../platform/auth/domain/role';
import { AdminsService } from '../../application/services/admins.service';
import { AdminUserEntity } from '../../infrastructure/persistence/admin-user.entity';
import {
  acquireAdminDbTestLock,
  AdminDbTestLock,
} from '../support/admin-db-test-lock';

// Real Postgres, single connection — NOT mocked repositories. The brief's
// forced-audit-failure assertions ("the AdminUser row does not exist
// afterward") are an actual transactional guarantee: a mock can only prove
// "we called manager.save then it threw," never that persistence didn't
// happen. Only the `AuditLogger` boundary is faked (so failures can be
// injected on demand); the DB write path is real. Points at the same local
// docker-compose Postgres the rest of the suite/e2e tests use (`apps/api`'s
// gitignored `.env`).
//
// Holds a Postgres advisory lock (see `../support/admin-db-test-lock.ts`)
// for the whole file's run, so it can never overlap with
// `admins.service.disable-concurrency.spec.ts` — the only other spec file
// touching the same real `admin_user_entity` table — regardless of how Jest
// schedules the two files across parallel workers.
describe('AdminsService (real Postgres)', () => {
  let dataSource: DataSource;
  let dbLock: AdminDbTestLock;
  let auditLogger: { log: jest.Mock };
  let service: AdminsService;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'clensy',
      password: process.env.DB_PASSWORD ?? 'clensy_dev',
      database: process.env.DB_NAME ?? 'clensy',
      entities: [AdminUserEntity, AuditEventEntity],
    });
    await dataSource.initialize();
    dbLock = await acquireAdminDbTestLock(dataSource);
  });

  afterAll(async () => {
    await dbLock.release();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.getRepository(AuditEventEntity).clear();
    await dataSource.getRepository(AdminUserEntity).clear();
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };
    service = new AdminsService(dataSource, auditLogger);
  });

  const seedOwner = async (email?: string) => {
    const repo = dataSource.getRepository(AdminUserEntity);
    return repo.save(
      repo.create({
        email: email ?? `owner-${Math.random()}@example.com`,
        passwordHash: await bcrypt.hash('irrelevant', 4),
        role: Role.OWNER,
        isActive: true,
      }),
    );
  };

  describe('create', () => {
    it('persists an AdminUser with a bcrypt hash (never the plaintext) and records admin.created', async () => {
      const created = await service.create({
        actorId: 'owner-1',
        email: 'New.Admin@Example.com',
        password: 'super-secret',
        role: Role.SCHEDULER,
      });

      expect(created.email).toBe('new.admin@example.com');
      expect(created.passwordHash).not.toBe('super-secret');
      expect(await bcrypt.compare('super-secret', created.passwordHash)).toBe(
        true,
      );

      const row = await dataSource
        .getRepository(AdminUserEntity)
        .findOneBy({ id: created.id });
      expect(row).not.toBeNull();

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'owner-1',
          action: 'admin.created',
          entityType: 'AdminUser',
          entityId: created.id,
          metadata: { role: Role.SCHEDULER },
        }),
      );
    });

    it('rolls back the AdminUser row when the audit write fails inside the transaction', async () => {
      auditLogger.log.mockRejectedValueOnce(new Error('audit down'));

      await expect(
        service.create({
          actorId: 'owner-1',
          email: 'rollback@example.com',
          password: 'super-secret',
          role: Role.SCHEDULER,
        }),
      ).rejects.toThrow('audit down');

      const row = await dataSource
        .getRepository(AdminUserEntity)
        .findOneBy({ email: 'rollback@example.com' });
      expect(row).toBeNull();
    });

    it('rejects a second create with an email already in use, differing only in case', async () => {
      await service.create({
        actorId: 'owner-1',
        email: 'dup@example.com',
        password: 'password-one',
        role: Role.SCHEDULER,
      });

      await expect(
        service.create({
          actorId: 'owner-1',
          email: 'DUP@Example.com',
          password: 'password-two',
          role: Role.FINANCE,
        }),
      ).rejects.toThrow();

      const count = await dataSource
        .getRepository(AdminUserEntity)
        .count({ where: { email: 'dup@example.com' } });
      expect(count).toBe(1);
    });
  });

  describe('disable', () => {
    it('rejects self-disable', async () => {
      const owner = await seedOwner();

      await expect(
        service.disable({ actorId: owner.id, targetId: owner.id }),
      ).rejects.toThrow(/own account/i);
    });

    it('rejects disabling the last active Owner', async () => {
      const owner = await seedOwner();

      await expect(
        service.disable({ actorId: 'some-other-actor', targetId: owner.id }),
      ).rejects.toThrow(/last active owner/i);

      const row = await dataSource
        .getRepository(AdminUserEntity)
        .findOneBy({ id: owner.id });
      expect(row?.isActive).toBe(true);
    });

    it('allows disabling a non-last Owner and records admin.disabled', async () => {
      const ownerA = await seedOwner();
      const ownerB = await seedOwner();

      const disabled = await service.disable({
        actorId: ownerA.id,
        targetId: ownerB.id,
      });

      expect(disabled.isActive).toBe(false);

      const row = await dataSource
        .getRepository(AdminUserEntity)
        .findOneBy({ id: ownerB.id });
      expect(row?.isActive).toBe(false);

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: ownerA.id,
          action: 'admin.disabled',
          entityType: 'AdminUser',
          entityId: ownerB.id,
        }),
      );
    });

    it('rolls back the disable when the audit write fails inside the transaction', async () => {
      const ownerA = await seedOwner();
      const ownerB = await seedOwner();
      auditLogger.log.mockRejectedValueOnce(new Error('audit down'));

      await expect(
        service.disable({ actorId: ownerA.id, targetId: ownerB.id }),
      ).rejects.toThrow('audit down');

      const row = await dataSource
        .getRepository(AdminUserEntity)
        .findOneBy({ id: ownerB.id });
      expect(row?.isActive).toBe(true);
    });
  });
});
