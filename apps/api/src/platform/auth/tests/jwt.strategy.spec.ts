import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ADMIN_IDENTITY_LOOKUP } from '../application/admin-identity-lookup.port';
import { AdminScope } from '../domain/admin-scope';
import { Role } from '../domain/role';
import { JwtStrategy } from '../infrastructure/jwt.strategy';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let lookup: { findActiveAdminById: jest.Mock };

  beforeEach(async () => {
    lookup = { findActiveAdminById: jest.fn() };

    const configStub = {
      get: (key: string, fallback?: unknown) =>
        key === 'JWT_SECRET' ? 'test-secret' : fallback,
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: configStub },
        { provide: ADMIN_IDENTITY_LOOKUP, useValue: lookup },
      ],
    }).compile();

    strategy = moduleRef.get(JwtStrategy);
  });

  it('invokes the lookup port on every validate() call — proves no caching (spec §4.1)', async () => {
    lookup.findActiveAdminById.mockResolvedValue({
      id: 'admin-1',
      tenantId: 'tenant-1',
      role: Role.TENANT_OWNER,
      scope: AdminScope.TENANT,
    });

    await strategy.validate({ sub: 'admin-1' });
    await strategy.validate({ sub: 'admin-1' });
    await strategy.validate({ sub: 'admin-1' });

    expect(lookup.findActiveAdminById).toHaveBeenCalledTimes(3);
  });

  it('throws UnauthorizedException when the lookup returns null (unknown or disabled account)', async () => {
    lookup.findActiveAdminById.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'ghost-or-disabled' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('returns the full AuthenticatedPrincipal (id, role, scope, tenantId) when the lookup succeeds', async () => {
    const principal = {
      id: 'admin-1',
      tenantId: 'tenant-1',
      role: Role.FINANCE,
      scope: AdminScope.TENANT,
    };
    lookup.findActiveAdminById.mockResolvedValue(principal);

    await expect(strategy.validate({ sub: 'admin-1' })).resolves.toEqual(
      principal,
    );
  });
});
