import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
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

  it('returns the principal (id + role) for an active admin id', async () => {
    repository.findOneBy.mockResolvedValue({
      id: 'active-id',
      email: 'active@example.com',
      passwordHash: 'hash',
      role: Role.FINANCE,
      isActive: true,
      createdAt: new Date(),
    });

    const result = await service.findActiveAdminById('active-id');

    expect(result).toEqual({ id: 'active-id', role: Role.FINANCE });
  });
});
