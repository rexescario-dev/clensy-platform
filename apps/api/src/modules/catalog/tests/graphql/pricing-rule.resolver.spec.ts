import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
  TypeMetadataStorage,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { GraphQLObjectType } from 'graphql';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { ROLES_KEY } from '../../../../platform/auth/decorators/roles.decorator';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import type { PricingRulesService } from '../../application/services/pricing-rules.service';
import { PricingRule } from '../../domain/pricing-rule';
import { PricingUnit } from '../../domain/pricing-unit';
import { PricingRuleResolver } from '../../presentation/graphql/pricing-rule.resolver';
import { PricingRuleType } from '../../presentation/graphql/pricing-rule.type';
import { ServiceResolver } from '../../presentation/graphql/service.resolver';

type ResolverMethod = 'activePricing' | 'createPricingRule';

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

function methodRef(method: ResolverMethod): (...args: unknown[]) => unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    PricingRuleResolver.prototype,
    method,
  );
  return descriptor!.value as (...args: unknown[]) => unknown;
}

describe('PricingRuleResolver', () => {
  const reflector = new Reflector();

  function guardsOn(method: ResolverMethod): unknown[] {
    const guards = Reflect.getMetadata(GUARDS_METADATA, methodRef(method)) as
      unknown[] | undefined;
    return guards ?? [];
  }

  function rolesOn(method: ResolverMethod): Role[] | undefined {
    return reflector.get<Role[] | undefined>(ROLES_KEY, methodRef(method));
  }

  describe.each([['activePricing', VIEW_ROLES]] as const)(
    '%s',
    (method, expectedRoles) => {
      it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — view matrix`, () => {
        expect(guardsOn(method)).toContain(AuthGuard);
        expect(rolesOn(method)).toEqual(expectedRoles);
      });
    },
  );

  describe.each([['createPricingRule', WRITE_ROLES]] as const)(
    '%s',
    (method, expectedRoles) => {
      it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — write matrix`, () => {
        expect(guardsOn(method)).toContain(AuthGuard);
        expect(rolesOn(method)).toEqual(expectedRoles);
      });
    },
  );

  describe('PricingRuleType (schema field set)', () => {
    it('exposes exactly id, serviceId, addOnId, priceMinorUnits, createdAt — no active', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [GraphQLSchemaBuilderModule],
      }).compile();
      const schemaFactory = moduleRef.get(GraphQLSchemaFactory);
      const schema = await schemaFactory.create([
        PricingRuleResolver,
        ServiceResolver,
      ]);

      const pricingRuleType = schema.getType(
        'PricingRule',
      ) as GraphQLObjectType;
      expect(pricingRuleType).toBeDefined();

      const fieldNames = Object.keys(pricingRuleType.getFields()).sort();
      expect(fieldNames).toEqual(
        ['id', 'serviceId', 'addOnId', 'priceMinorUnits', 'createdAt'].sort(),
      );
      // Belt-and-suspenders (task brief, §3): `active` must never appear on
      // the public schema — every `PricingRule` reachable through GraphQL is
      // by construction always the currently-active one, so an always-`true`
      // field would be dead information. Same technique the Cleaners plan
      // used for `CleanerType`/`teamId`.
      expect(fieldNames).not.toContain('active');
    });
  });

  // Belt-and-suspenders metadata-storage assertion (task brief) — reads
  // `PricingRuleType`'s own `@Field()` decorator metadata directly off
  // `TypeMetadataStorage`, independent of whichever resolvers happen to be
  // passed to `GraphQLSchemaFactory.create` above.
  it('PricingRuleType metadata has no active field', () => {
    const metadata =
      TypeMetadataStorage.getObjectTypeMetadataByTarget(PricingRuleType);
    const fieldNames = (metadata?.properties ?? []).map(
      (property) => property.name,
    );

    expect(fieldNames).not.toContain('active');
    expect(fieldNames.sort()).toEqual(
      ['id', 'serviceId', 'addOnId', 'priceMinorUnits', 'createdAt'].sort(),
    );
  });

  // Task 4 (plan §8): proves the existing `{ ...input, actorId }` spread in
  // `createPricingRule` genuinely requires no resolver code change (plan §3)
  // — it isn't merely "the file happens to be unedited," the spread itself
  // structurally forwards the new field.
  it('forwards addOnId into CreatePricingRuleCommand via the existing spread, with serviceId left undefined', () => {
    const resolver = new PricingRuleResolver({
      createPricingRule: jest.fn().mockResolvedValue({
        id: 'rule-1',
        addOnId: 'add-on-1',
        serviceId: null,
        createdAt: new Date(),
        priceMinorUnits: 1500,
      }),
    } as never);

    const createSpy = (
      resolver as unknown as {
        pricingRulesService: { createPricingRule: jest.Mock };
      }
    ).pricingRulesService.createPricingRule;

    void resolver.createPricingRule(
      { addOnId: 'add-on-1', priceMinorUnits: 1500 },
      { id: 'actor-1' } as never,
    );

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'actor-1', addOnId: 'add-on-1' }),
    );
    const calls = createSpy.mock.calls as { serviceId?: string }[][];
    expect(calls[0][0].serviceId).toBeUndefined();
  });
});

// Tenant isolation (#84, multi-tenant spec §4.5, controller ruling 2): the
// tenant comes only from the DB-loaded principal. Reads pass it through
// (the service fails closed on `null`/NotFound); writes require it. A
// command's `tenantId` is set after `...input` so no input key can override
// it. `PricingRuleType` carries no `@Authorize` of its own (#84 slice
// decision 8) — its only read paths are this query and
// `Service.activePricing`, both tenant-scoped here and in
// `ActivePricingLoader`.
describe('PricingRuleResolver tenant scoping', () => {
  const principal: AuthenticatedPrincipal = {
    id: 'u',
    tenantId: 't-a',
    role: Role.OPS_MANAGER,
    scope: AdminScope.TENANT,
  };
  const noTenant: AuthenticatedPrincipal = { ...principal, tenantId: null };

  function makeRule(serviceId: string): PricingRule {
    return {
      id: `rule-${serviceId}`,
      addOnId: null,
      serviceId,
      tenantId: 't-a',
      active: true,
      createdAt: new Date('2026-01-01T00:00:00Z'),
      effectiveFrom: new Date('2026-01-01T00:00:00Z'),
      effectiveTo: null,
      minimumChargeMinorUnits: null,
      priceMinorUnits: 100,
      unit: PricingUnit.FLAT,
    };
  }

  let pricingRulesService: {
    getActivePricing: jest.Mock;
    createPricingRule: jest.Mock;
  };
  let resolver: PricingRuleResolver;

  beforeEach(() => {
    pricingRulesService = {
      getActivePricing: jest.fn(),
      createPricingRule: jest.fn(),
    };
    resolver = new PricingRuleResolver(
      pricingRulesService as unknown as PricingRulesService,
    );
  });

  it('activePricing(serviceId) passes the caller tenant', async () => {
    pricingRulesService.getActivePricing.mockResolvedValue(null);
    await expect(resolver.activePricing('s-1', principal)).resolves.toBeNull();
    expect(pricingRulesService.getActivePricing).toHaveBeenCalledWith(
      's-1',
      't-a',
    );
  });

  it('createPricingRule takes tenantId from the principal, after the input spread', async () => {
    pricingRulesService.createPricingRule.mockResolvedValue(makeRule('s-1'));
    await resolver.createPricingRule(
      { serviceId: 's-1', priceMinorUnits: 100, tenantId: 'evil' } as never,
      principal,
    );
    expect(pricingRulesService.createPricingRule).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: 'u', tenantId: 't-a' }),
    );
  });

  it('createPricingRule with a tenant-less principal is Forbidden before the service is called', async () => {
    await expect(
      resolver.createPricingRule(
        { serviceId: 's-1', priceMinorUnits: 100 },
        noTenant,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(pricingRulesService.createPricingRule).not.toHaveBeenCalled();
  });
});
