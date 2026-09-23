import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { GraphQLEnumType, GraphQLObjectType } from 'graphql';
import { ROLES_KEY } from '../../../../platform/auth/decorators/roles.decorator';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import type { AdminsService } from '../../application/services/admins.service';
import type { LoginService } from '../../application/services/login.service';
import { AdminResolver } from '../../presentation/graphql/admin.resolver';
import type { ConfigService } from '@nestjs/config';
import type { TokenService } from '../../../../platform/auth/infrastructure/token.service';

type ResolverMethod =
  | 'admins'
  | 'createAdmin'
  | 'currentAdmin'
  | 'disableAdmin'
  | 'login'
  | 'logout';

// Reads the method's own function value off `AdminResolver.prototype` via
// `Object.getOwnPropertyDescriptor` rather than a plain member access — the
// exact function reference Nest's `@UseGuards()`/`@Roles()` (built on
// `SetMetadata`) attach `Reflect` metadata to (see `use-guards.decorator.js`
// and the shared `SetMetadata` implementation), and the same function
// reference `Reflector.getAllAndOverride(key, [context.getHandler(), ...])`
// reads back at request time via `context.getHandler()`. This is a
// decorator/metadata assertion, not a runtime request simulation.
function methodRef(method: ResolverMethod): (...args: unknown[]) => unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    AdminResolver.prototype,
    method,
  );
  return descriptor!.value as (...args: unknown[]) => unknown;
}

describe('AdminResolver', () => {
  const reflector = new Reflector();

  function guardsOn(method: ResolverMethod): unknown[] {
    const guards = Reflect.getMetadata(GUARDS_METADATA, methodRef(method)) as
      unknown[] | undefined;
    return guards ?? [];
  }

  function rolesOn(method: ResolverMethod): Role[] | undefined {
    return reflector.get<Role[] | undefined>(ROLES_KEY, methodRef(method));
  }

  describe.each([
    ['createAdmin', [Role.TENANT_OWNER]],
    ['disableAdmin', [Role.TENANT_OWNER]],
    ['admins', [Role.TENANT_OWNER]],
  ] as const)('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')})`, () => {
      expect(guardsOn(method)).toContain(AuthGuard);
      expect(rolesOn(method)).toEqual(expectedRoles);
    });
  });

  describe('currentAdmin', () => {
    it('is guarded by AuthGuard only — no @Roles() declared (any authenticated role)', () => {
      expect(guardsOn('currentAdmin')).toContain(AuthGuard);
      expect(rolesOn('currentAdmin')).toBeUndefined();
    });
  });

  describe('login', () => {
    it('has neither AuthGuard nor @Roles() — public operation', () => {
      expect(guardsOn('login')).toEqual([]);
      expect(rolesOn('login')).toBeUndefined();
    });
  });

  describe('logout', () => {
    it('has neither AuthGuard nor @Roles() — callable without a session', () => {
      expect(guardsOn('logout')).toEqual([]);
      expect(rolesOn('logout')).toBeUndefined();
    });
  });

  // Builds the actual GraphQL schema from `AdminResolver`'s decorator
  // metadata (the same `GraphQLSchemaFactory` NestJS's own "Generating SDL"
  // testing recipe uses) rather than inspecting `AdminType` instances at
  // runtime — this is the compile-time/schema-level guarantee the brief
  // asks for: even a bug that accidentally populated a `passwordHash`
  // property on a returned object could never make it into the `Admin`
  // GraphQL type, because the type's field set is fixed by `@Field()`
  // decorators alone, independent of what the resolver returns.
  describe('AdminType (schema field set)', () => {
    it('exposes exactly id, email, role, isActive, scope, tenantId — never passwordHash', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [GraphQLSchemaBuilderModule],
      }).compile();
      const schemaFactory = moduleRef.get(GraphQLSchemaFactory);
      const schema = await schemaFactory.create([AdminResolver]);

      const adminType = schema.getType('Admin') as GraphQLObjectType;
      expect(adminType).toBeDefined();

      const fieldNames = Object.keys(adminType.getFields()).sort();
      expect(fieldNames).toEqual([
        'email',
        'id',
        'isActive',
        'role',
        'scope',
        'tenantId',
      ]);
      expect(fieldNames).not.toContain('passwordHash');
    });
  });

  describe('CurrentAdmin / AdminScope (schema)', () => {
    it('exposes id, role, scope, tenantId on CurrentAdmin with a PLATFORM | TENANT AdminScope enum and a nullable tenantId', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [GraphQLSchemaBuilderModule],
      }).compile();
      const schema = await moduleRef
        .get(GraphQLSchemaFactory)
        .create([AdminResolver]);

      const currentAdmin = schema.getType('CurrentAdmin') as GraphQLObjectType;
      const fields = currentAdmin.getFields();
      expect(Object.keys(fields).sort()).toEqual([
        'id',
        'role',
        'scope',
        'tenantId',
      ]);
      expect(String(fields.scope.type)).toBe('AdminScope!');
      expect(String(fields.tenantId.type)).toBe('ID');

      const scope = schema.getType('AdminScope') as GraphQLEnumType;
      expect(
        scope
          .getValues()
          .map((value) => value.name)
          .sort(),
      ).toEqual(['PLATFORM', 'TENANT']);

      const role = schema.getType('Role') as GraphQLEnumType;
      expect(role.getValues().map((value) => value.name)).not.toContain(
        'OWNER',
      );
    });
  });

  describe('principal passthrough', () => {
    const principal: AuthenticatedPrincipal = {
      id: 'owner-1',
      tenantId: 'tenant-1',
      role: Role.TENANT_OWNER,
      scope: AdminScope.TENANT,
    };
    const adminRow = {
      id: 'admin-2',
      tenantId: 'tenant-1',
      createdAt: new Date(),
      email: 'staff@example.com',
      isActive: true,
      passwordHash: 'hash',
      role: Role.SCHEDULER,
      scope: AdminScope.TENANT,
    };
    let adminsService: {
      create: jest.Mock;
      disable: jest.Mock;
      list: jest.Mock;
    };
    let resolver: AdminResolver;

    beforeEach(() => {
      adminsService = {
        create: jest.fn().mockResolvedValue(adminRow),
        disable: jest.fn().mockResolvedValue(adminRow),
        list: jest.fn().mockResolvedValue([adminRow]),
      };
      resolver = new AdminResolver(
        adminsService as unknown as AdminsService,
        {} as LoginService,
        {} as TokenService,
        {} as ConfigService,
      );
    });

    it('currentAdmin returns the full principal', () => {
      expect(resolver.currentAdmin(principal)).toEqual({
        id: 'owner-1',
        tenantId: 'tenant-1',
        role: Role.TENANT_OWNER,
        scope: AdminScope.TENANT,
      });
    });

    it('currentAdmin returns a null tenant for a Super Admin', () => {
      expect(
        resolver.currentAdmin({
          id: 'super-1',
          tenantId: null,
          role: Role.SUPER_ADMIN,
          scope: AdminScope.PLATFORM,
        }),
      ).toEqual({
        id: 'super-1',
        tenantId: null,
        role: Role.SUPER_ADMIN,
        scope: AdminScope.PLATFORM,
      });
    });

    it('createAdmin passes the acting principal, never a client-chosen tenant', async () => {
      await resolver.createAdmin(
        { email: 'staff@example.com', password: 'pw', role: Role.SCHEDULER },
        principal,
      );

      expect(adminsService.create).toHaveBeenCalledWith({
        actor: principal,
        email: 'staff@example.com',
        password: 'pw',
        role: Role.SCHEDULER,
      });
    });

    it('disableAdmin passes the acting principal', async () => {
      await resolver.disableAdmin('admin-2', principal);

      expect(adminsService.disable).toHaveBeenCalledWith({
        actor: principal,
        targetId: 'admin-2',
      });
    });

    it('admins lists for the acting principal and maps scope/tenantId', async () => {
      const result = await resolver.admins(principal);

      expect(adminsService.list).toHaveBeenCalledWith(principal);
      expect(result).toEqual([
        {
          id: 'admin-2',
          tenantId: 'tenant-1',
          email: 'staff@example.com',
          isActive: true,
          role: Role.SCHEDULER,
          scope: AdminScope.TENANT,
        },
      ]);
    });
  });
});
