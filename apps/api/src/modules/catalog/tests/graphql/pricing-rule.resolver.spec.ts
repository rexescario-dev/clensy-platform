import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
  TypeMetadataStorage,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { GraphQLObjectType } from 'graphql';
import { ROLES_KEY } from '../../../../platform/auth/decorators/roles.decorator';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { PricingRuleResolver } from '../../presentation/graphql/pricing-rule.resolver';
import { PricingRuleType } from '../../presentation/graphql/pricing-rule.type';
import { ServiceResolver } from '../../presentation/graphql/service.resolver';

type ResolverMethod = 'activePricing' | 'createPricingRule';

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
    it('exposes exactly id, serviceId, priceMinorUnits, createdAt — no active', async () => {
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
        ['id', 'serviceId', 'priceMinorUnits', 'createdAt'].sort(),
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
      ['id', 'serviceId', 'priceMinorUnits', 'createdAt'].sort(),
    );
  });
});
