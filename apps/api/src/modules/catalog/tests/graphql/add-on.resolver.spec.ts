import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { GraphQLObjectType } from 'graphql';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { ROLES_KEY } from '../../../../platform/auth/decorators/roles.decorator';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import type { AddOnsService } from '../../application/services/add-ons.service';
import { AddOn } from '../../domain/add-on';
import { AddOnReadResolver } from '../../presentation/graphql/add-on-read.resolver';
import { AddOnResolver } from '../../presentation/graphql/add-on.resolver';

type ResolverMethod = 'createAddOn' | 'updateAddOn';

const WRITE_ROLES = [Role.TENANT_OWNER, Role.OPS_MANAGER];

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

// Tenant isolation (#84, multi-tenant spec §4.5, controller ruling 2): the
// tenant comes only from the DB-loaded principal. Writes require it. A
// command's `tenantId` is set after `...input` so no input key can override
// it. `AddOn` is tenant-owned (RFC §4.4).
describe('AddOnResolver tenant scoping', () => {
  const principal: AuthenticatedPrincipal = {
    id: 'u',
    tenantId: 't-a',
    role: Role.OPS_MANAGER,
    scope: AdminScope.TENANT,
  };
  const noTenant: AuthenticatedPrincipal = { ...principal, tenantId: null };

  function makeAddOn(): AddOn {
    return {
      id: 'ao-1',
      tenantId: 't-a',
      active: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      description: null,
      name: 'Fridge',
      priceMinorUnits: 500,
      updatedAt: new Date('2026-01-01T00:00:00Z'),
    };
  }

  let addOnsService: { createAddOn: jest.Mock; updateAddOn: jest.Mock };
  let resolver: AddOnResolver;

  beforeEach(() => {
    addOnsService = {
      createAddOn: jest.fn(),
      updateAddOn: jest.fn(),
    };
    resolver = new AddOnResolver(addOnsService as unknown as AddOnsService);
  });

  it('createAddOn takes tenantId from the principal, after the input spread', async () => {
    addOnsService.createAddOn.mockResolvedValue(makeAddOn());
    await resolver.createAddOn(
      { name: 'Fridge', priceMinorUnits: 500, tenantId: 'evil' } as never,
      principal,
    );
    expect(addOnsService.createAddOn).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'u', tenantId: 't-a' }),
    );
  });

  it('updateAddOn takes tenantId from the principal, after the input spread', async () => {
    addOnsService.updateAddOn.mockResolvedValue(makeAddOn());
    await resolver.updateAddOn(
      'ao-1',
      { name: 'Oven', tenantId: 'evil' } as never,
      principal,
    );
    expect(addOnsService.updateAddOn).toHaveBeenCalledWith(
      'ao-1',
      expect.objectContaining({ actorId: 'u', tenantId: 't-a' }),
    );
  });

  it('createAddOn with a tenant-less principal is Forbidden before the service is called', async () => {
    await expect(
      resolver.createAddOn({ name: 'F', priceMinorUnits: 1 }, noTenant),
    ).rejects.toThrow(ForbiddenException);
    expect(addOnsService.createAddOn).not.toHaveBeenCalled();
  });

  it('updateAddOn with a tenant-less principal is Forbidden before the service is called', async () => {
    await expect(
      resolver.updateAddOn('ao-1', { name: 'F' }, noTenant),
    ).rejects.toThrow(ForbiddenException);
    expect(addOnsService.updateAddOn).not.toHaveBeenCalled();
  });
});
