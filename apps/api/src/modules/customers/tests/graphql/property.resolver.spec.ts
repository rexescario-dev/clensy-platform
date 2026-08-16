import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { GraphQLInputObjectType } from 'graphql';
import { ROLES_KEY } from '../../../../platform/auth/decorators/roles.decorator';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CustomerResolver } from '../../presentation/graphql/customer.resolver';
import { PropertyResolver } from '../../presentation/graphql/property.resolver';

type ResolverMethod =
  'property' | 'customerProperties' | 'createProperty' | 'updateProperty';

const VIEW_ROLES = [
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.ANALYST,
];

const WRITE_ROLES = [Role.OWNER, Role.OPS_MANAGER, Role.CUSTOMER_SUPPORT];

// Same technique as `admin.resolver.spec.ts`/`customer.resolver.spec.ts`.
function methodRef(method: ResolverMethod): (...args: unknown[]) => unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    PropertyResolver.prototype,
    method,
  );
  return descriptor!.value as (...args: unknown[]) => unknown;
}

describe('PropertyResolver', () => {
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
    ['property', VIEW_ROLES],
    ['customerProperties', VIEW_ROLES],
  ] as const)('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — view matrix`, () => {
      expect(guardsOn(method)).toContain(AuthGuard);
      expect(rolesOn(method)).toEqual(expectedRoles);
    });
  });

  describe.each([
    ['createProperty', WRITE_ROLES],
    ['updateProperty', WRITE_ROLES],
  ] as const)('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — write matrix`, () => {
      expect(guardsOn(method)).toContain(AuthGuard);
      expect(rolesOn(method)).toEqual(expectedRoles);
    });
  });

  // Belt-and-suspenders against a future edit accidentally reintroducing
  // `customerId` onto `UpdatePropertyInput` (task brief) — `customerId`'s
  // immutability is an explicit invariant (spec §4.1, §4.2), not just an
  // incidental omission. Built the same way as the `CustomerType`
  // field-set check: from the actual generated schema, not from reading the
  // TS class source.
  describe('UpdatePropertyInput (schema field set)', () => {
    it('does not include customerId', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [GraphQLSchemaBuilderModule],
      }).compile();
      const schemaFactory = moduleRef.get(GraphQLSchemaFactory);
      const schema = await schemaFactory.create([
        CustomerResolver,
        PropertyResolver,
      ]);

      const updatePropertyInput = schema.getType(
        'UpdatePropertyInput',
      ) as GraphQLInputObjectType;
      expect(updatePropertyInput).toBeDefined();

      const fieldNames = Object.keys(updatePropertyInput.getFields());
      expect(fieldNames).not.toContain('customerId');
      expect(fieldNames.sort()).toEqual(
        [
          'label',
          'addressLine1',
          'addressLine2',
          'city',
          'region',
          'postalCode',
          'accessNotes',
        ].sort(),
      );
    });
  });
});
