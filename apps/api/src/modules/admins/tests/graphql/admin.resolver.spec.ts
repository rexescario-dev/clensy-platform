import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { GraphQLObjectType } from 'graphql';
import { ROLES_KEY } from '../../../../platform/auth/decorators/roles.decorator';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { AdminResolver } from '../../presentation/graphql/admin.resolver';

type ResolverMethod =
  'login' | 'createAdmin' | 'disableAdmin' | 'admins' | 'currentAdmin';

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
    ['createAdmin', [Role.OWNER]],
    ['disableAdmin', [Role.OWNER]],
    ['admins', [Role.OWNER]],
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

  // Builds the actual GraphQL schema from `AdminResolver`'s decorator
  // metadata (the same `GraphQLSchemaFactory` NestJS's own "Generating SDL"
  // testing recipe uses) rather than inspecting `AdminType` instances at
  // runtime — this is the compile-time/schema-level guarantee the brief
  // asks for: even a bug that accidentally populated a `passwordHash`
  // property on a returned object could never make it into the `Admin`
  // GraphQL type, because the type's field set is fixed by `@Field()`
  // decorators alone, independent of what the resolver returns.
  describe('AdminType (schema field set)', () => {
    it('exposes exactly id, email, role, isActive — never passwordHash', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [GraphQLSchemaBuilderModule],
      }).compile();
      const schemaFactory = moduleRef.get(GraphQLSchemaFactory);
      const schema = await schemaFactory.create([AdminResolver]);

      const adminType = schema.getType('Admin') as GraphQLObjectType;
      expect(adminType).toBeDefined();

      const fieldNames = Object.keys(adminType.getFields()).sort();
      expect(fieldNames).toEqual(['email', 'id', 'isActive', 'role']);
      expect(fieldNames).not.toContain('passwordHash');
    });
  });
});
