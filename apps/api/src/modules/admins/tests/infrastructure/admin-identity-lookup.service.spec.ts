import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import { Role } from '../../../../platform/auth/domain/role';
import { AdminIdentityLookupService } from '../../infrastructure/admin-identity-lookup.service';
import { AdminUserEntity } from '../../infrastructure/persistence/admin-user.entity';

describe('AdminIdentityLookupService', () => {
  let service: AdminIdentityLookupService;
  let repository: { findOneBy: jest.Mock };

  beforeEach(async () => {
    repository = { findOneBy: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminIdentityLookupService,
        {
          provide: getRepositoryToken(AdminUserEntity),
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<AdminIdentityLookupService>(
      AdminIdentityLookupService,
    );
  });

  it('returns null for a nonexistent id', async () => {
    repository.findOneBy.mockResolvedValue(null);

    const result = await service.findActiveAdminById('missing-id');

    expect(result).toBeNull();
  });

  it('returns null for a disabled admin id (filters on isActive at the query level)', async () => {
    // The port's contract (§4.1: "current database values ... MUST NOT use a
    // cached representation") is that a disabled admin is never findable via
    // this method, not merely filtered out afterward — so the service
    // queries with `isActive: true` in the lookup itself.
    repository.findOneBy.mockResolvedValue(null);

    const result = await service.findActiveAdminById('disabled-id');

    expect(result).toBeNull();
    expect(repository.findOneBy).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'disabled-id', isActive: true }),
    );
  });

  it('returns the full tenant principal for an active tenant admin', async () => {
    repository.findOneBy.mockResolvedValue({
      id: 'active-id',
      tenantId: 'tenant-1',
      createdAt: new Date(),
      email: 'active@example.com',
      isActive: true,
      passwordHash: 'hash',
      role: Role.FINANCE,
      scope: AdminScope.TENANT,
    });

    const result = await service.findActiveAdminById('active-id');

    expect(result).toEqual({
      id: 'active-id',
      tenantId: 'tenant-1',
      role: Role.FINANCE,
      scope: AdminScope.TENANT,
    });
  });

  it('returns a platform principal with a null tenant for a Super Admin', async () => {
    repository.findOneBy.mockResolvedValue({
      id: 'super-id',
      tenantId: null,
      createdAt: new Date(),
      email: 'super@example.com',
      isActive: true,
      passwordHash: 'hash',
      role: Role.SUPER_ADMIN,
      scope: AdminScope.PLATFORM,
    });

    const result = await service.findActiveAdminById('super-id');

    expect(result).toEqual({
      id: 'super-id',
      tenantId: null,
      role: Role.SUPER_ADMIN,
      scope: AdminScope.PLATFORM,
    });
  });
});
