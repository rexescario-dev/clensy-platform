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
import type { ServicesService } from '../../application/services/services.service';
import { Service } from '../../domain/service';
import { AddOnReadResolver } from '../../presentation/graphql/add-on-read.resolver';
import { AddOnResolver } from '../../presentation/graphql/add-on.resolver';
import type { ActivePricingLoader } from '../../presentation/graphql/active-pricing.loader';
import { PricingRuleResolver } from '../../presentation/graphql/pricing-rule.resolver';
import { ServiceReadResolver } from '../../presentation/graphql/service-read.resolver';
import { ServiceResolver } from '../../presentation/graphql/service.resolver';

type ResolverMethod = 'createService' | 'service' | 'updateService';

// View matrix per spec §4.3: deliberately BROADER than the Cleaners
// module's — all six roles, not just Owner/Ops Manager/Scheduler/Analyst.
const VIEW_ROLES = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];

const WRITE_ROLES = [Role.TENANT_OWNER, Role.OPS_MANAGER];

// Tenant isolation (#84, multi-tenant spec §4.5, controller ruling 2): the
// tenant comes only from the DB-loaded principal. Reads pass it through
// (the service fails closed on `null`); writes require it. A command's
// `tenantId` is set after `...input` so no input key can override it.
// `ActivePricingLoader`'s tenant comes from `@CurrentUser()`, never from the
// parent row — an undefined principal on the `@ResolveField` falls back to
// the null-tenant loader (#84 slice decision 7).
const principal: AuthenticatedPrincipal = {
  id: 'u',
  tenantId: 't-a',
  role: Role.OPS_MANAGER,
  scope: AdminScope.TENANT,
};
const noTenant: AuthenticatedPrincipal = { ...principal, tenantId: null };

function makeService(): Service {
  return {
    id: 's-1',
    tenantId: 't-a',
    active: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    description: null,
    durationMinutes: 60,
    name: 'Deep Clean',
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
}

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

  describe.each([['service', VIEW_ROLES]] as const)(
    '%s',
    (method, expectedRoles) => {
      it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — view matrix`, () => {
        expect(guardsOn(method)).toContain(AuthGuard);
        expect(rolesOn(method)).toEqual(expectedRoles);
      });
    },
  );

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
        ServiceReadResolver,
        ServiceResolver,
        AddOnReadResolver,
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
    it('calls loaderFor(tenantId).load(service.id) exactly once and maps the result', async () => {
      const rule = {
        id: 'rule-1',
        serviceId: 'service-1',
        active: true,
        createdAt: new Date(),
        priceMinorUnits: 1500,
      };
      const load = jest.fn().mockResolvedValue(rule);
      const loader = { loaderFor: jest.fn().mockReturnValue({ load }) };
      const resolver = new ServiceResolver({} as never, loader as never);

      const result = await resolver.activePricing(
        { id: 'service-1' },
        principal,
      );

      expect(loader.loaderFor).toHaveBeenCalledWith('t-a');
      expect(load).toHaveBeenCalledTimes(1);
      expect(load).toHaveBeenCalledWith('service-1');
      expect(result).toMatchObject({
        id: 'rule-1',
        priceMinorUnits: 1500,
        serviceId: 'service-1',
      });
    });

    it('returns null when the loader resolves null', async () => {
      const load = jest.fn().mockResolvedValue(null);
      const loader = { loaderFor: jest.fn().mockReturnValue({ load }) };
      const resolver = new ServiceResolver({} as never, loader as never);

      const result = await resolver.activePricing(
        { id: 'service-1' },
        principal,
      );

      expect(load).toHaveBeenCalledTimes(1);
      expect(result).toBeNull();
    });
  });
});

describe('ServiceResolver tenant scoping', () => {
  let servicesService: {
    getService: jest.Mock;
    createService: jest.Mock;
    updateService: jest.Mock;
  };
  let loader: { loaderFor: jest.Mock };
  let resolver: ServiceResolver;

  beforeEach(() => {
    servicesService = {
      getService: jest.fn(),
      createService: jest.fn(),
      updateService: jest.fn(),
    };
    loader = { loaderFor: jest.fn() };
    resolver = new ServiceResolver(
      servicesService as unknown as ServicesService,
      loader as unknown as ActivePricingLoader,
    );
  });

  it('service(id) passes the caller tenant', async () => {
    servicesService.getService.mockResolvedValue(null);
    await expect(resolver.service('s-1', principal)).resolves.toBeNull();
    expect(servicesService.getService).toHaveBeenCalledWith('s-1', 't-a');
  });

  it('createService takes tenantId from the principal, after the input spread', async () => {
    servicesService.createService.mockResolvedValue(makeService());
    await resolver.createService(
      { name: 'Deep', durationMinutes: 60, tenantId: 'evil' } as never,
      principal,
    );
    expect(servicesService.createService).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'u', tenantId: 't-a' }),
    );
  });

  it('updateService takes tenantId from the principal, after the input spread', async () => {
    servicesService.updateService.mockResolvedValue(makeService());
    await resolver.updateService(
      's-1',
      { name: 'New', tenantId: 'evil' } as never,
      principal,
    );
    expect(servicesService.updateService).toHaveBeenCalledWith(
      's-1',
      expect.objectContaining({ actorId: 'u', tenantId: 't-a' }),
    );
  });

  it('createService with a tenant-less principal is Forbidden before the service is called', async () => {
    await expect(
      resolver.createService({ name: 'Deep', durationMinutes: 60 }, noTenant),
    ).rejects.toThrow(ForbiddenException);
    expect(servicesService.createService).not.toHaveBeenCalled();
  });

  it('updateService with a tenant-less principal is Forbidden before the service is called', async () => {
    await expect(
      resolver.updateService('s-1', { name: 'X' }, noTenant),
    ).rejects.toThrow(ForbiddenException);
    expect(servicesService.updateService).not.toHaveBeenCalled();
  });

  it('Service.activePricing uses the loader for the caller tenant', async () => {
    const load = jest.fn().mockResolvedValue(null);
    loader.loaderFor.mockReturnValue({ load });
    await expect(
      resolver.activePricing({ id: 's-1' }, principal),
    ).resolves.toBeNull();
    expect(loader.loaderFor).toHaveBeenCalledWith('t-a');
    expect(load).toHaveBeenCalledWith('s-1');
  });

  it('Service.activePricing with no principal uses the null-tenant loader', async () => {
    const load = jest.fn().mockResolvedValue(null);
    loader.loaderFor.mockReturnValue({ load });
    await resolver.activePricing({ id: 's-1' }, undefined);
    expect(loader.loaderFor).toHaveBeenCalledWith(null);
  });
});
