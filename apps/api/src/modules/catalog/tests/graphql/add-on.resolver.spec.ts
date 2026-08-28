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
import { AddOnReadResolver } from '../../presentation/graphql/add-on-read.resolver';
import { AddOnResolver } from '../../presentation/graphql/add-on.resolver';

type ResolverMethod = 'createAddOn' | 'updateAddOn';

const WRITE_ROLES = [Role.OWNER, Role.OPS_MANAGER];

function methodRef(method: ResolverMethod): (...args: unknown[]) => unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    AddOnResolver.prototype,
    method,
  );
  return descriptor!.value as (...args: unknown[]) => unknown;
}

describe('AddOnResolver', () => {
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
    ['createAddOn', WRITE_ROLES],
    ['updateAddOn', WRITE_ROLES],
  ] as const)('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — write matrix`, () => {
      expect(guardsOn(method)).toContain(AuthGuard);
      expect(rolesOn(method)).toEqual(expectedRoles);
    });
  });

  // No single-`addOn(id)` query exists (task brief) — `AddOn` is a fully
  // independent domain object with no `getAddOn(id)` read method on
  // `AddOnsService` for a resolver to call.
  it('has no addOn method', () => {
    expect(
      Object.getOwnPropertyDescriptor(AddOnResolver.prototype, 'addOn'),
    ).toBeUndefined();
  });

  describe('AddOnType (schema field set)', () => {
    it('exposes exactly id, name, description, priceMinorUnits, active, createdAt, updatedAt', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [GraphQLSchemaBuilderModule],
      }).compile();
      const schemaFactory = moduleRef.get(GraphQLSchemaFactory);
      const schema = await schemaFactory.create([
        AddOnReadResolver,
        AddOnResolver,
      ]);

      const addOnType = schema.getType('AddOn') as GraphQLObjectType;
      expect(addOnType).toBeDefined();

      const fieldNames = Object.keys(addOnType.getFields()).sort();
      expect(fieldNames).toEqual(
        [
          'id',
          'name',
          'description',
          'priceMinorUnits',
          'active',
          'createdAt',
          'updatedAt',
        ].sort(),
      );
    });
  });
});
