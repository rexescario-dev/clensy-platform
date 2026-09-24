import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { AdminScope } from '../src/platform/auth/domain/admin-scope';
import { AuthenticatedPrincipal } from '../src/platform/auth/domain/authenticated-principal';
import { Role } from '../src/platform/auth/domain/role';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import { AdminsService } from '../src/modules/admins/application/services/admins.service';
import { AdminUserEntity } from '../src/modules/admins/infrastructure/persistence/admin-user.entity';
import { TenantEntity } from '../src/modules/admins/infrastructure/persistence/tenant.entity';
import {
  acquireAdminDbTestLock,
  AdminDbTestLock,
} from './helpers/admin-db-test-lock';
import {
  createTestTenant,
  removeTestTenants,
  seedSuperAdmin,
  seedTenantAdmin,
} from './helpers/seed-tenant-admin';

// Real Postgres, single connection — NOT mocked repositories. The brief's
// forced-audit-failure assertions ("the AdminUser row does not exist
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
// Holds a Postgres advisory lock (see `./helpers/admin-db-test-lock.ts`)
// for the whole file's run, so it can never overlap with
// `admins.service.disable-concurrency.e2e-spec.ts` — the only other spec
// file touching the same real `admin_user_entity` table — regardless of how
// Jest schedules the two files across parallel workers.
describe('AdminsService (real Postgres)', () => {
  let dataSource: DataSource;
  let dbLock: AdminDbTestLock;
  let auditLogger: { log: jest.Mock };
  let service: AdminsService;
  let otherTenantId: string;

  // A Tenant Owner principal whose row does not exist — lets a test reach
  // the last-owner lock without the actor itself being a second owner.
  const phantomOwner = (tenantId: string): AuthenticatedPrincipal => ({
    id: randomUUID(),
    tenantId,
    role: Role.TENANT_OWNER,
    scope: AdminScope.TENANT,
  });

  beforeAll(async () => {
    dataSource = new DataSource({
      database: process.env.DB_NAME ?? 'clensy',
      entities: [AdminUserEntity, AuditEventEntity, TenantEntity],
      host: process.env.DB_HOST ?? 'localhost',
      password: process.env.DB_PASSWORD ?? 'clensy_dev',
      port: Number(process.env.DB_PORT ?? 5432),
      type: 'postgres',
      username: process.env.DB_USERNAME ?? 'clensy',
    });
    await dataSource.initialize();
    dbLock = await acquireAdminDbTestLock(dataSource);
    otherTenantId = await createTestTenant(dataSource);
  });

  afterAll(async () => {
    await removeTestTenants(dataSource, [otherTenantId]);
    await dbLock.release();
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await dataSource.getRepository(AuditEventEntity).clear();
    await dataSource.getRepository(AdminUserEntity).clear();
    auditLogger = { log: jest.fn().mockResolvedValue(undefined) };
    service = new AdminsService(dataSource, auditLogger);
  });

  const findRow = (id: string) =>
    dataSource.getRepository(AdminUserEntity).findOneBy({ id });

  describe('create', () => {
    it("persists a TENANT admin in the actor's tenant with a bcrypt hash and records admin.created with the tenant", async () => {
      const owner = await seedTenantAdmin(dataSource);

      const created = await service.create({
        actor: owner.principal,
        email: 'New.Admin@Example.com',
        password: 'super-secret',
        role: Role.SCHEDULER,
      });

      expect(created.email).toBe('new.admin@example.com');
      expect(created.passwordHash).not.toBe('super-secret');
      expect(await bcrypt.compare('super-secret', created.passwordHash)).toBe(
        true,
      );
      expect(await findRow(created.id)).toMatchObject({
        tenantId: BOOTSTRAP_TENANT_ID,
        role: Role.SCHEDULER,
        scope: AdminScope.TENANT,
      });

      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: owner.id,
          entityId: created.id,
          tenantId: BOOTSTRAP_TENANT_ID,
          action: 'admin.created',
          entityType: 'AdminUser',
          metadata: { role: Role.SCHEDULER },
          scope: AdminScope.TENANT,
        }),
      );
    });

    it("creates into the actor's own tenant, not the bootstrap tenant", async () => {
      const owner = await seedTenantAdmin(
        dataSource,
        Role.TENANT_OWNER,
        otherTenantId,
      );

      const created = await service.create({
        actor: owner.principal,
        email: 'other-tenant-staff@example.com',
        password: 'super-secret',
        role: Role.FINANCE,
      });

      expect((await findRow(created.id))?.tenantId).toBe(otherTenantId);
    });

    it('rejects creating a SUPER_ADMIN and writes nothing', async () => {
      const owner = await seedTenantAdmin(dataSource);

      await expect(
        service.create({
          actor: owner.principal,
          email: 'would-be-super@example.com',
          password: 'super-secret',
          role: Role.SUPER_ADMIN,
        }),
      ).rejects.toThrow(/super admin/i);

      const row = await dataSource
        .getRepository(AdminUserEntity)
        .findOneBy({ email: 'would-be-super@example.com' });
      expect(row).toBeNull();
    });

    it('rejects an actor that is not a Tenant Owner (e.g. a platform Super Admin)', async () => {
      const superAdmin = await seedSuperAdmin(dataSource);

      await expect(
        service.create({
          actor: superAdmin.principal,
          email: 'from-platform@example.com',
          password: 'super-secret',
          role: Role.SCHEDULER,
        }),
      ).rejects.toThrow(/tenant owner/i);
    });

    it('rolls back the AdminUser row when the audit write fails inside the transaction', async () => {
      const owner = await seedTenantAdmin(dataSource);
      auditLogger.log.mockRejectedValueOnce(new Error('audit down'));

      await expect(
        service.create({
          actor: owner.principal,
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

    it('keeps email globally unique: rejects a case-variant duplicate even from another tenant', async () => {
      const ownerA = await seedTenantAdmin(dataSource);
      const ownerB = await seedTenantAdmin(
        dataSource,
        Role.TENANT_OWNER,
        otherTenantId,
      );
      await service.create({
        actor: ownerA.principal,
        email: 'dup@example.com',
        password: 'password-one',
        role: Role.SCHEDULER,
      });

      await expect(
        service.create({
          actor: ownerB.principal,
          email: 'DUP@Example.com',
          password: 'password-two',
          role: Role.FINANCE,
        }),
      ).rejects.toThrow(/already in use/i);

      const count = await dataSource
        .getRepository(AdminUserEntity)
        .count({ where: { email: 'dup@example.com' } });
      expect(count).toBe(1);
    });
  });

  describe('list', () => {
    it("returns only the actor's tenant — never another tenant's staff or Super Admins", async () => {
      const ownerA = await seedTenantAdmin(dataSource);
      const staffA = await seedTenantAdmin(dataSource, Role.SCHEDULER);
      await seedTenantAdmin(dataSource, Role.TENANT_OWNER, otherTenantId);
      await seedTenantAdmin(dataSource, Role.FINANCE, otherTenantId);
      await seedSuperAdmin(dataSource);

      const listed = await service.list(ownerA.principal);

      expect(listed.map((admin) => admin.id).sort()).toEqual(
        [ownerA.id, staffA.id].sort(),
      );
    });
  });

  describe('disable', () => {
    it('rejects self-disable', async () => {
      const owner = await seedTenantAdmin(dataSource);

      await expect(
        service.disable({ actor: owner.principal, targetId: owner.id }),
      ).rejects.toThrow(/own account/i);
    });

    it('rejects disabling the last active Tenant Owner of that tenant', async () => {
      const owner = await seedTenantAdmin(dataSource);

      await expect(
        service.disable({
          actor: phantomOwner(BOOTSTRAP_TENANT_ID),
          targetId: owner.id,
        }),
      ).rejects.toThrow(/last active tenant owner/i);

      expect((await findRow(owner.id))?.isActive).toBe(true);
    });

    it("counts only the target's tenant: other tenants' owners do not make it non-last", async () => {
      await seedTenantAdmin(dataSource);
      await seedTenantAdmin(dataSource);
      const onlyOwnerB = await seedTenantAdmin(
        dataSource,
        Role.TENANT_OWNER,
        otherTenantId,
      );

      await expect(
        service.disable({
          actor: phantomOwner(otherTenantId),
          targetId: onlyOwnerB.id,
        }),
      ).rejects.toThrow(/last active tenant owner/i);
    });

    it("treats another tenant's admin as not found and leaves it active", async () => {
      const ownerA = await seedTenantAdmin(dataSource);
      const staffB = await seedTenantAdmin(
        dataSource,
        Role.SCHEDULER,
        otherTenantId,
      );

      await expect(
        service.disable({ actor: ownerA.principal, targetId: staffB.id }),
      ).rejects.toThrow(/not found/i);

      expect((await findRow(staffB.id))?.isActive).toBe(true);
    });

    it('treats a platform Super Admin as not found', async () => {
      const ownerA = await seedTenantAdmin(dataSource);
      const superAdmin = await seedSuperAdmin(dataSource);

      await expect(
        service.disable({ actor: ownerA.principal, targetId: superAdmin.id }),
      ).rejects.toThrow(/not found/i);
    });

    it('allows disabling a non-last Tenant Owner and records admin.disabled with the tenant', async () => {
      const ownerA = await seedTenantAdmin(dataSource);
      const ownerB = await seedTenantAdmin(dataSource);

      const disabled = await service.disable({
        actor: ownerA.principal,
        targetId: ownerB.id,
      });

      expect(disabled.isActive).toBe(false);
      expect((await findRow(ownerB.id))?.isActive).toBe(false);
      expect(auditLogger.log).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: ownerA.id,
          entityId: ownerB.id,
          tenantId: BOOTSTRAP_TENANT_ID,
          action: 'admin.disabled',
          entityType: 'AdminUser',
          scope: AdminScope.TENANT,
        }),
      );
    });

    it('rolls back the disable when the audit write fails inside the transaction', async () => {
      const ownerA = await seedTenantAdmin(dataSource);
      const ownerB = await seedTenantAdmin(dataSource);
      auditLogger.log.mockRejectedValueOnce(new Error('audit down'));

      await expect(
        service.disable({ actor: ownerA.principal, targetId: ownerB.id }),
      ).rejects.toThrow('audit down');

      expect((await findRow(ownerB.id))?.isActive).toBe(true);
    });
  });
});
