import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ADMIN_IDENTITY_LOOKUP } from '../application/admin-identity-lookup.port';
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
      role: Role.OWNER,
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

  it('returns the AuthenticatedPrincipal (id + role) when the lookup succeeds', async () => {
    lookup.findActiveAdminById.mockResolvedValue({
      id: 'admin-1',
      role: Role.FINANCE,
    });

    await expect(strategy.validate({ sub: 'admin-1' })).resolves.toEqual({
      id: 'admin-1',
      role: Role.FINANCE,
    });
  });
});
