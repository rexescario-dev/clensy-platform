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
import { CustomerResolver } from '../../presentation/graphql/customer.resolver';
import { PropertyResolver } from '../../presentation/graphql/property.resolver';

type ResolverMethod =
  'customer' | 'customers' | 'createCustomer' | 'updateCustomer';

const VIEW_ROLES = [
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.ANALYST,
];

const WRITE_ROLES = [Role.OWNER, Role.OPS_MANAGER, Role.CUSTOMER_SUPPORT];

// Same technique as `admin.resolver.spec.ts`: reads the method's own
// function value off `CustomerResolver.prototype` — the exact function
// reference Nest's `@UseGuards()`/`@Roles()` attach `Reflect` metadata to,
// and the same reference `Reflector.getAllAndOverride` reads back at request
// time via `context.getHandler()`. A decorator/metadata assertion, not a
// runtime request simulation.
function methodRef(method: ResolverMethod): (...args: unknown[]) => unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    CustomerResolver.prototype,
    method,
  );
  return descriptor!.value as (...args: unknown[]) => unknown;
}

describe('CustomerResolver', () => {
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
    ['customer', VIEW_ROLES],
    ['customers', VIEW_ROLES],
  ] as const)('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — view matrix`, () => {
      expect(guardsOn(method)).toContain(AuthGuard);
      expect(rolesOn(method)).toEqual(expectedRoles);
    });
  });

  describe.each([
    ['createCustomer', WRITE_ROLES],
    ['updateCustomer', WRITE_ROLES],
  ] as const)('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — write matrix`, () => {
      expect(guardsOn(method)).toContain(AuthGuard);
      expect(rolesOn(method)).toEqual(expectedRoles);
    });
  });

  // Builds the actual GraphQL schema from both resolvers' decorator metadata
  // (same `GraphQLSchemaFactory` recipe as `admin.resolver.spec.ts`) — both
  // are needed because `CustomerType.properties` references `PropertyType`.
  // This is the compile-time/schema-level guarantee for `CustomerType`'s
  // field set: fixed by `@Field()` decorators alone, independent of what any
  // resolver method actually returns.
  describe('CustomerType (schema field set)', () => {
    it('exposes exactly id, fullName, email, phone, notes, properties, createdAt, updatedAt', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [GraphQLSchemaBuilderModule],
      }).compile();
      const schemaFactory = moduleRef.get(GraphQLSchemaFactory);
      const schema = await schemaFactory.create([
        CustomerResolver,
        PropertyResolver,
      ]);

      const customerType = schema.getType('Customer') as GraphQLObjectType;
      expect(customerType).toBeDefined();

      const fieldNames = Object.keys(customerType.getFields()).sort();
      expect(fieldNames).toEqual(
        [
          'createdAt',
          'email',
          'fullName',
          'id',
          'notes',
          'phone',
          'properties',
          'updatedAt',
        ].sort(),
      );
    });
  });
});
