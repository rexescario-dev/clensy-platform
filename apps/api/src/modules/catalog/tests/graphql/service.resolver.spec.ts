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
import { AddOnResolver } from '../../presentation/graphql/add-on.resolver';
import { PricingRuleResolver } from '../../presentation/graphql/pricing-rule.resolver';
import { ServiceResolver } from '../../presentation/graphql/service.resolver';

type ResolverMethod =
  'service' | 'services' | 'createService' | 'updateService';

// View matrix per spec §4.3: deliberately BROADER than the Cleaners
// module's — all six roles, not just Owner/Ops Manager/Scheduler/Analyst.
const VIEW_ROLES = [
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];

const WRITE_ROLES = [Role.OWNER, Role.OPS_MANAGER];

// Same technique as `cleaner.resolver.spec.ts`: reads the method's own
// function value off `ServiceResolver.prototype` — the exact function
// reference Nest's `@UseGuards()`/`@Roles()` attach `Reflect` metadata to.
function methodRef(method: ResolverMethod): (...args: unknown[]) => unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    ServiceResolver.prototype,
    method,
  );
  return descriptor!.value as (...args: unknown[]) => unknown;
}

describe('ServiceResolver', () => {
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
    ['service', VIEW_ROLES],
    ['services', VIEW_ROLES],
  ] as const)('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — view matrix`, () => {
      expect(guardsOn(method)).toContain(AuthGuard);
      expect(rolesOn(method)).toEqual(expectedRoles);
    });
  });

  describe.each([
    ['createService', WRITE_ROLES],
    ['updateService', WRITE_ROLES],
  ] as const)('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — write matrix`, () => {
      expect(guardsOn(method)).toContain(AuthGuard);
      expect(rolesOn(method)).toEqual(expectedRoles);
    });
  });

  // `activePricing` is a `@ResolveField`, not a guarded query/mutation —
  // reachable only after the guarded parent query already succeeded (task
  // brief). Belt-and-suspenders against a guard/roles pair being
  // accidentally added to it.
  it('activePricing has no AuthGuard/@Roles metadata of its own', () => {
    const ref = Object.getOwnPropertyDescriptor(
      ServiceResolver.prototype,
      'activePricing',
    )!.value as (...args: unknown[]) => unknown;
    expect(Reflect.getMetadata(GUARDS_METADATA, ref)).toBeUndefined();
    expect(reflector.get<Role[] | undefined>(ROLES_KEY, ref)).toBeUndefined();
  });

  // Builds the actual GraphQL schema from all three resolvers' decorator
  // metadata (same `GraphQLSchemaFactory` recipe as `cleaner.resolver.spec.ts`)
  // — all three are needed because `ServiceType.activePricing` references
  // `PricingRuleType`.
  describe('ServiceType (schema field set)', () => {
    it('exposes exactly id, name, description, durationMinutes, active, activePricing, createdAt, updatedAt', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [GraphQLSchemaBuilderModule],
      }).compile();
      const schemaFactory = moduleRef.get(GraphQLSchemaFactory);
      const schema = await schemaFactory.create([
        ServiceResolver,
        AddOnResolver,
        PricingRuleResolver,
      ]);

      const serviceType = schema.getType('Service') as GraphQLObjectType;
      expect(serviceType).toBeDefined();

      const fieldNames = Object.keys(serviceType.getFields()).sort();
      expect(fieldNames).toEqual(
        [
          'id',
          'name',
          'description',
          'durationMinutes',
          'active',
          'activePricing',
          'createdAt',
          'updatedAt',
        ].sort(),
      );
    });
  });

  describe('activePricing', () => {
    it('calls loader.loader.load(service.id) exactly once and maps the result', async () => {
      const rule = {
        id: 'rule-1',
        serviceId: 'service-1',
        priceMinorUnits: 1500,
        active: true,
        createdAt: new Date(),
      };
      const loader = {
        loader: { load: jest.fn().mockResolvedValue(rule) },
      };
      const resolver = new ServiceResolver({} as never, loader as never);

      const result = await resolver.activePricing({ id: 'service-1' });

      expect(loader.loader.load).toHaveBeenCalledTimes(1);
      expect(loader.loader.load).toHaveBeenCalledWith('service-1');
      expect(result).toMatchObject({
        id: 'rule-1',
        serviceId: 'service-1',
        priceMinorUnits: 1500,
      });
    });

    it('returns null when the loader resolves null', async () => {
      const loader = {
        loader: { load: jest.fn().mockResolvedValue(null) },
      };
      const resolver = new ServiceResolver({} as never, loader as never);

      const result = await resolver.activePricing({ id: 'service-1' });

      expect(loader.loader.load).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });
  });
});
