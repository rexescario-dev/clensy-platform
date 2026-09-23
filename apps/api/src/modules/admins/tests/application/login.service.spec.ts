import * as bcrypt from 'bcrypt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import type { AuditLogEvent } from '../../../../platform/audit/application/audit-logger.port';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import { Role } from '../../../../platform/auth/domain/role';
import { LoginService } from '../../application/services/login.service';
import { AdminUserEntity } from '../../infrastructure/persistence/admin-user.entity';

// Mocked repository (matches `bookings.service.spec.ts`'s style) — login has
// no accompanying state change, so there's no transactional guarantee to
// prove at this layer (unlike `AdminsService.create`/`disable`); a plain
// repository mock is sufficient to prove the lookup/compare/audit-call
// behavior spec §4.3 and §4.6 require.
describe('LoginService', () => {
  let service: LoginService;
  let repository: { findOneBy: jest.Mock };
  let auditLogger: { log: jest.Mock<Promise<void>, [AuditLogEvent]> };

  const activeAdminId = 'admin-1';
  let activeAdminPasswordHash: string;

  beforeAll(async () => {
    activeAdminPasswordHash = await bcrypt.hash('correct-password', 4);
  });

  beforeEach(async () => {
    repository = { findOneBy: jest.fn() };
    auditLogger = {
      log: jest
        .fn<Promise<void>, [AuditLogEvent]>()
        .mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginService,
        {
          provide: getRepositoryToken(AdminUserEntity),
          useValue: repository,
        },
        { provide: AUDIT_LOGGER, useValue: auditLogger },
      ],
    }).compile();

    service = module.get<LoginService>(LoginService);
  });

  it('returns null and records admin.login.failed for an unknown email', async () => {
    repository.findOneBy.mockResolvedValue(null);

    const result = await service.login('nobody@example.com', 'whatever');

    expect(result).toBeNull();
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.login.failed',
        actorId: null,
      }),
    );
  });

  it('returns null and records admin.login.failed for a wrong password', async () => {
    repository.findOneBy.mockResolvedValue({
      id: activeAdminId,
      createdAt: new Date(),
      email: 'active@example.com',
      isActive: true,
      passwordHash: activeAdminPasswordHash,
      role: Role.SCHEDULER,
    });

    const result = await service.login('active@example.com', 'wrong-password');

    expect(result).toBeNull();
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.login.failed',
        actorId: null,
      }),
    );
  });

  it('returns null and records admin.login.failed for a disabled account, even with the correct password', async () => {
    repository.findOneBy.mockResolvedValue({
      id: activeAdminId,
      createdAt: new Date(),
      email: 'disabled@example.com',
      isActive: false,
      passwordHash: activeAdminPasswordHash,
      role: Role.SCHEDULER,
    });

    const result = await service.login(
      'disabled@example.com',
      'correct-password',
    );

    expect(result).toBeNull();
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'admin.login.failed',
        actorId: null,
      }),
    );
  });

  it('the unknown-email, wrong-password, and disabled-account failures are indistinguishable outward', async () => {
    repository.findOneBy.mockResolvedValueOnce(null);
    const unknownEmailResult = await service.login(
      'nobody@example.com',
      'whatever',
    );

    repository.findOneBy.mockResolvedValueOnce({
      id: activeAdminId,
      createdAt: new Date(),
      email: 'active@example.com',
      isActive: true,
      passwordHash: activeAdminPasswordHash,
      role: Role.SCHEDULER,
    });
    const wrongPasswordResult = await service.login(
      'active@example.com',
      'wrong-password',
    );

    repository.findOneBy.mockResolvedValueOnce({
      id: activeAdminId,
      createdAt: new Date(),
      email: 'disabled@example.com',
      isActive: false,
      passwordHash: activeAdminPasswordHash,
      role: Role.SCHEDULER,
    });
    const disabledResult = await service.login(
      'disabled@example.com',
      'correct-password',
    );

    expect(unknownEmailResult).toBeNull();
    expect(wrongPasswordResult).toBeNull();
    expect(disabledResult).toBeNull();

    // Same generic failure path for all three — every recorded audit call
    // used the exact same action/actorId shape, never a discriminating
    // reason tied to which case occurred (spec §4.3/§4.6).
    const failedCalls = auditLogger.log.mock.calls
      .map(([event]) => event)
      .filter((event) => event.action === 'admin.login.failed');
    expect(failedCalls).toHaveLength(3);
    failedCalls.forEach((event) => {
      expect(event.actorId).toBeNull();
      expect(event.entityType).toBeNull();
      expect(event.entityId).toBeNull();
    });
  });

  it('returns the full principal and records admin.login.succeeded with the tenant for a tenant admin', async () => {
    repository.findOneBy.mockResolvedValue({
      id: activeAdminId,
      tenantId: 'tenant-1',
      createdAt: new Date(),
      email: 'active@example.com',
      isActive: true,
      passwordHash: activeAdminPasswordHash,
      role: Role.TENANT_OWNER,
      scope: AdminScope.TENANT,
    });

    const result = await service.login(
      'Active@Example.com',
      'correct-password',
    );

    expect(result).toEqual({
      id: activeAdminId,
      tenantId: 'tenant-1',
      role: Role.TENANT_OWNER,
      scope: AdminScope.TENANT,
    });
    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: activeAdminId,
        entityId: activeAdminId,
        tenantId: 'tenant-1',
        action: 'admin.login.succeeded',
        entityType: 'AdminUser',
        scope: AdminScope.TENANT,
      }),
    );
  });

  it('records a Super Admin login with explicit PLATFORM scope and no tenant (spec §4.6)', async () => {
    repository.findOneBy.mockResolvedValue({
      id: activeAdminId,
      tenantId: null,
      createdAt: new Date(),
      email: 'active@example.com',
      isActive: true,
      passwordHash: activeAdminPasswordHash,
      role: Role.SUPER_ADMIN,
      scope: AdminScope.PLATFORM,
    });

    await service.login('active@example.com', 'correct-password');

    expect(auditLogger.log).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: null,
        action: 'admin.login.succeeded',
        scope: AdminScope.PLATFORM,
      }),
    );
  });

  it('records a failed login with no scope and no tenant — not PLATFORM (spec §4.6)', async () => {
    repository.findOneBy.mockResolvedValue(null);

    await service.login('nobody@example.com', 'whatever');

    const [event] = auditLogger.log.mock.calls[0];
    expect(event.action).toBe('admin.login.failed');
    expect(event.scope ?? null).toBeNull();
    expect(event.tenantId ?? null).toBeNull();
  });
});
