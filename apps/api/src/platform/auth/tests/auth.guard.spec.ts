import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { ADMIN_IDENTITY_LOOKUP } from '../application/admin-identity-lookup.port';
import { Roles } from '../decorators/roles.decorator';
import { AdminScope } from '../domain/admin-scope';
import { Role } from '../domain/role';
import { AuthGuard } from '../guards/auth.guard';
import { JwtStrategy } from '../infrastructure/jwt.strategy';
import { TokenService } from '../infrastructure/token.service';
import { SESSION_COOKIE_NAME } from '../auth.constants';

// A dummy resolver-shaped class so `@Roles()` metadata can be attached the
// same way it would be on a real GraphQL resolver method — `Reflector`
// reads metadata off the actual method/class references via
// `context.getHandler()`/`context.getClass()`, so a plain object literal
// standing in for "the handler" wouldn't exercise the same code path.
class DummyResolver {
  noRolesDeclared(this: void) {}

  @Roles(Role.TENANT_OWNER)
  tenantOwnerOnly(this: void) {}

  @Roles(Role.TENANT_OWNER, Role.FINANCE)
  tenantOwnerOrFinance(this: void) {}
}

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let tokenService: TokenService;
  let lookup: { findActiveAdminById: jest.Mock };

  const configStub = {
    get: (key: string, fallback?: unknown) => {
      if (key === 'JWT_SECRET') return 'test-secret';
      if (key === 'JWT_EXPIRES_IN') return '8h';
      return fallback;
    },
  };

  beforeEach(async () => {
    lookup = { findActiveAdminById: jest.fn() };

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      providers: [
        AuthGuard,
        JwtStrategy,
        TokenService,
        Reflector,
        { provide: ConfigService, useValue: configStub },
        { provide: ADMIN_IDENTITY_LOOKUP, useValue: lookup },
      ],
    }).compile();

    guard = moduleRef.get(AuthGuard);
    tokenService = moduleRef.get(TokenService);
    // Instantiating JwtStrategy (already eagerly created by `.compile()`,
    // this just fetches the same instance) registers it with Passport under
    // the 'jwt' strategy name that `AuthGuard` (`PassportAuthGuard('jwt')`)
    // looks up at `canActivate()` time.
    moduleRef.get(JwtStrategy);
  });

  function buildContext(
    req: Record<string, unknown>,
    handler: () => unknown,
  ): ExecutionContext {
    const gqlContext = { req, res: {} };
    const args = [{}, {}, gqlContext, {}];
    return {
      getArgByIndex: (i: number) => args[i],
      getArgs: () => args,
      getClass: () => DummyResolver,
      getHandler: () => handler,
      getType: () => 'graphql',
      switchToHttp: () => ({
        getNext: () => undefined,
        getRequest: () => req,
        getResponse: () => gqlContext.res,
      }),
    } as unknown as ExecutionContext;
  }

  it('denies when there is no session cookie', async () => {
    const dummy = new DummyResolver();
    const context = buildContext({ cookies: {} }, dummy.noRolesDeclared);

    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  it('denies when the token is valid but ADMIN_IDENTITY_LOOKUP returns null (disabled/unknown account)', async () => {
    const token = tokenService.issue('admin-1');
    lookup.findActiveAdminById.mockResolvedValue(null);
    const dummy = new DummyResolver();
    const context = buildContext(
      { cookies: { [SESSION_COOKIE_NAME]: token } },
      dummy.noRolesDeclared,
    );

    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  it('allows when the token is valid, the account is active, and no @Roles() is declared', async () => {
    const token = tokenService.issue('admin-1');
    lookup.findActiveAdminById.mockResolvedValue({
      id: 'admin-1',
      tenantId: 'tenant-1',
      role: Role.SCHEDULER,
      scope: AdminScope.TENANT,
    });
    const dummy = new DummyResolver();
    const context = buildContext(
      { cookies: { [SESSION_COOKIE_NAME]: token } },
      dummy.noRolesDeclared,
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('denies when the principal role is not in the @Roles() list', async () => {
    const token = tokenService.issue('admin-1');
    lookup.findActiveAdminById.mockResolvedValue({
      id: 'admin-1',
      tenantId: 'tenant-1',
      role: Role.SCHEDULER,
      scope: AdminScope.TENANT,
    });
    const dummy = new DummyResolver();
    const context = buildContext(
      { cookies: { [SESSION_COOKIE_NAME]: token } },
      dummy.tenantOwnerOnly,
    );

    await expect(guard.canActivate(context)).rejects.toThrow();
  });

  it('allows when the principal role is in the @Roles() list (OR semantics)', async () => {
    const token = tokenService.issue('admin-1');
    lookup.findActiveAdminById.mockResolvedValue({
      id: 'admin-1',
      tenantId: 'tenant-1',
      role: Role.FINANCE,
      scope: AdminScope.TENANT,
    });
    const dummy = new DummyResolver();
    const context = buildContext(
      { cookies: { [SESSION_COOKIE_NAME]: token } },
      dummy.tenantOwnerOrFinance,
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  // Multi-tenant spec §4.2: Super Admin is NOT implicitly added to any
  // tenant role list — a platform principal is denied like any other role
  // not on `@Roles()`.
  it('denies a Super Admin on a TENANT_OWNER-only operation', async () => {
    const token = tokenService.issue('admin-1');
    lookup.findActiveAdminById.mockResolvedValue({
      id: 'admin-1',
      tenantId: null,
      role: Role.SUPER_ADMIN,
      scope: AdminScope.PLATFORM,
    });
    const dummy = new DummyResolver();
    const context = buildContext(
      { cookies: { [SESSION_COOKIE_NAME]: token } },
      dummy.tenantOwnerOnly,
    );

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
