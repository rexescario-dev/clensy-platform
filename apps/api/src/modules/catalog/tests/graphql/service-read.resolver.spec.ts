import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { GraphQLObjectType } from 'graphql';
// @ptc-org/nestjs-query-graphql 9.5.0 does not re-export getAuthorizer from
// the package root, so this deep import is required.
import { getAuthorizer } from '@ptc-org/nestjs-query-graphql/src/decorators';
import { PLATFORM_PAGE_DEFAULT } from '../../../../platform/graphql/paging';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import { ROLES_KEY } from '../../../../platform/auth/decorators/roles.decorator';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { AddOnReadResolver } from '../../presentation/graphql/add-on-read.resolver';
import { AddOnResolver } from '../../presentation/graphql/add-on.resolver';
import { AddOnType } from '../../presentation/graphql/add-on.type';
import { PricingRuleResolver } from '../../presentation/graphql/pricing-rule.resolver';
import { ServiceReadResolver } from '../../presentation/graphql/service-read.resolver';
import { ServiceResolver } from '../../presentation/graphql/service.resolver';
import { ServiceType } from '../../presentation/graphql/service.type';

const VIEW_ROLES = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];

function readMethodRef(ctor: {
  prototype: object;
}): (...args: unknown[]) => unknown {
  let proto: object | null = ctor.prototype;
  while (proto) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, 'queryMany');
    if (descriptor?.value) {
      return descriptor.value as (...args: unknown[]) => unknown;
    }
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  throw new Error('queryMany not found');
}

describe('Catalog GraphQL collections', () => {
  const reflector = new Reflector();

  describe.each([
    [ServiceReadResolver, 'services'],
    [AddOnReadResolver, 'addOns'],
  ] as const)('%s queryMany', (ctor) => {
    it('is guarded by AuthGuard and the catalog view matrix', () => {
      const method = readMethodRef(ctor);
      const guards = Reflect.getMetadata(GUARDS_METADATA, method) as
        unknown[] | undefined;
      expect(guards ?? []).toContain(AuthGuard);
      expect(reflector.get<Role[] | undefined>(ROLES_KEY, method)).toEqual(
        VIEW_ROLES,
      );
    });
  });

  it('exposes services and addOns as root connections with totalCount and no pricings root', async () => {
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

    const servicesQuery = schema.getQueryType()!.getFields().services;
    expect(servicesQuery.type.toString()).toBe('ServiceConnection!');
    expect(servicesQuery.args.map((arg) => arg.name)).toEqual(
      expect.arrayContaining(['paging']),
    );
    const servicesPaging = servicesQuery.args.find(
      (arg) => arg.name === 'paging',
    );
    expect(servicesPaging?.defaultValue).toEqual({
      limit: PLATFORM_PAGE_DEFAULT,
    });
    const serviceConnection = schema.getType(
      'ServiceConnection',
    ) as GraphQLObjectType;
    expect(Object.keys(serviceConnection.getFields()).sort()).toEqual(
      ['nodes', 'pageInfo', 'totalCount'].sort(),
    );

    const addOnsQuery = schema.getQueryType()!.getFields().addOns;
    expect(addOnsQuery.type.toString()).toBe('AddOnConnection!');
    const addOnConnection = schema.getType(
      'AddOnConnection',
    ) as GraphQLObjectType;
    expect(Object.keys(addOnConnection.getFields()).sort()).toEqual(
      ['nodes', 'pageInfo', 'totalCount'].sort(),
    );

    const serviceType = schema.getType('Service') as GraphQLObjectType;
    expect(serviceType.getFields().activePricing.type.toString()).toBe(
      'PricingRule',
    );
    expect(schema.getQueryType()!.getFields().pricings).toBeUndefined();
    expect(schema.getQueryType()!.getFields().service.type.toString()).toBe(
      'Service',
    );
    expect(schema.getQueryType()!.getFields().addOn).toBeUndefined();
  });
});

// @Authorize metadata (mirrors #83's team.resolver.spec.ts). Security
// invariant: every nestjs-query read of `ServiceType`/`AddOnType` — the root
// list/count and every relation that targets one — is ANDed with the
// principal's tenant.
describe.each([
  ['ServiceType', ServiceType],
  ['AddOnType', AddOnType],
])('%s tenant authorizer', (_name, DTO) => {
  it('is registered and constrains reads to the principal tenant', async () => {
    const Authorizer = getAuthorizer(DTO as never);
    expect(Authorizer).toBeDefined();
    const authorizer = new Authorizer!({}, undefined);
    await expect(
      authorizer.authorize(
        {
          req: {
            user: {
              id: 'u',
              tenantId: 't-a',
              role: Role.OPS_MANAGER,
              scope: AdminScope.TENANT,
            },
          },
        },
        { operationGroup: 'read' } as never,
      ),
    ).resolves.toEqual({ tenantId: { eq: 't-a' } });
  });
});
