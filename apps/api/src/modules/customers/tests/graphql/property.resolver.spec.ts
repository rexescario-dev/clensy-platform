import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Filter, QueryService } from '@ptc-org/nestjs-query-core';
import { Reflector } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { GraphQLInputObjectType } from 'graphql';
import { ROLES_KEY } from '../../../../platform/auth/decorators/roles.decorator';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CustomerResolver } from '../../presentation/graphql/customer.resolver';
import { PropertiesService } from '../../application/services/properties.service';
import { Property } from '../../domain/property';
import { PropertyResolver } from '../../presentation/graphql/property.resolver';
import { PropertyType } from '../../presentation/graphql/property.type';

type ResolverMethod =
  'createProperty' | 'customerProperties' | 'property' | 'updateProperty';

const VIEW_ROLES = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.ANALYST,
];

const WRITE_ROLES = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.CUSTOMER_SUPPORT,
];

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

// Tenant isolation (#82, multi-tenant spec §4.5, controller ruling 2).
describe('PropertyResolver tenant scoping', () => {
  const principal: AuthenticatedPrincipal = {
    id: 'admin-1',
    tenantId: 't-a',
    role: Role.TENANT_OWNER,
    scope: AdminScope.TENANT,
  };
  const property: Property = {
    id: 'p-1',
    customerId: 'c-1',
    tenantId: 't-a',
    accessNotes: null,
    addressLine1: '1 Main St',
    addressLine2: null,
    city: 'City',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    label: 'Home',
    postalCode: '00001',
    region: 'RG',
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
  let service: {
    create: jest.Mock;
    getProperty: jest.Mock;
    update: jest.Mock;
  };
  let queryService: { count: jest.Mock; query: jest.Mock };
  let resolver: PropertyResolver;

  beforeEach(() => {
    service = {
      create: jest.fn().mockResolvedValue(property),
      getProperty: jest.fn().mockResolvedValue(property),
      update: jest.fn().mockResolvedValue(property),
    };
    queryService = {
      count: jest.fn().mockResolvedValue(0),
      query: jest.fn().mockResolvedValue([]),
    };
    resolver = new PropertyResolver(
      service as unknown as PropertiesService,
      queryService as unknown as QueryService<PropertyType>,
    );
  });

  it('property(id) looks up within the principal tenant', async () => {
    await expect(resolver.property('p-1', principal)).resolves.toMatchObject({
      id: 'p-1',
    });
    expect(service.getProperty).toHaveBeenCalledWith('p-1', 't-a');
  });

  it('property(id) passes a null tenant through (the service fails closed)', async () => {
    service.getProperty.mockResolvedValue(null);
    await expect(
      resolver.property('p-1', { ...principal, tenantId: null }),
    ).resolves.toBeNull();
    expect(service.getProperty).toHaveBeenCalledWith('p-1', null);
  });

  it('createProperty builds the command with the principal tenant, never the input', async () => {
    await resolver.createProperty(
      'c-1',
      {
        tenantId: 't-evil',
        addressLine1: '1 Main St',
        city: 'City',
        label: 'Home',
        postalCode: '00001',
        region: 'RG',
      } as never,
      principal,
    );
    expect(service.create).toHaveBeenCalledWith({
      actorId: 'admin-1',
      customerId: 'c-1',
      tenantId: 't-a',
      addressLine1: '1 Main St',
      city: 'City',
      label: 'Home',
      postalCode: '00001',
      region: 'RG',
    });
  });

  it('updateProperty builds the command with the principal tenant, never the input', async () => {
    await resolver.updateProperty(
      'p-1',
      { label: 'Office', tenantId: 't-evil' } as never,
      principal,
    );
    expect(service.update).toHaveBeenCalledWith('p-1', {
      actorId: 'admin-1',
      label: 'Office',
      tenantId: 't-a',
    });
  });

  it.each(['createProperty', 'updateProperty'] as const)(
    '%s is forbidden without a principal tenant',
    async (method) => {
      const noTenant = { ...principal, tenantId: null };
      const call =
        method === 'createProperty'
          ? resolver.createProperty('c-1', {} as never, noTenant)
          : resolver.updateProperty('p-1', {}, noTenant);
      await expect(call).rejects.toBeInstanceOf(ForbiddenException);
      expect(service.create).not.toHaveBeenCalled();
      expect(service.update).not.toHaveBeenCalled();
    },
  );

  describe('customerProperties', () => {
    async function runPage(
      filter: Filter<PropertyType> | undefined,
      currentUser: AuthenticatedPrincipal = principal,
    ): Promise<{ pageFilter: unknown; countFilter: unknown }> {
      const page = await resolver.customerProperties(
        'c-1',
        currentUser,
        { limit: 10 },
        filter,
      );
      await page.totalCount;
      const [pageQuery] = queryService.query.mock.calls[0] as [
        { filter: unknown },
      ];
      const [countFilter] = queryService.count.mock.calls[0] as [unknown];
      return { countFilter, pageFilter: pageQuery.filter };
    }

    const serverScope = [
      { customerId: { eq: 'c-1' } },
      { tenantId: { eq: 't-a' } },
    ];

    it('scopes both the page and the count to the customer and the principal tenant', async () => {
      const { countFilter, pageFilter } = await runPage(undefined);
      for (const filter of [pageFilter, countFilter]) {
        const { and } = filter as { and: unknown[] };
        expect(and).toEqual(expect.arrayContaining(serverScope));
      }
    });

    it('ANDs a client filter instead of replacing the server scope', async () => {
      const { countFilter, pageFilter } = await runPage({
        addressLine1: { eq: '1 Main St' },
      });
      for (const filter of [pageFilter, countFilter]) {
        const serialized = JSON.stringify(filter);
        expect(serialized).toContain('"addressLine1":{"eq":"1 Main St"}');
        expect(serialized).toContain('"customerId":{"eq":"c-1"}');
        expect(serialized).toContain('"tenantId":{"eq":"t-a"}');
      }
    });

    it('discards a client tenantId/customerId predicate before merging', async () => {
      const { countFilter, pageFilter } = await runPage({
        customerId: { eq: 'c-other' },
        tenantId: { eq: 't-evil' },
      } as never);
      for (const filter of [pageFilter, countFilter]) {
        const serialized = JSON.stringify(filter);
        expect(serialized).not.toContain('t-evil');
        expect(serialized).not.toContain('c-other');
        expect(serialized.match(/"tenantId"/g)).toHaveLength(1);
        expect(serialized).toContain('"tenantId":{"eq":"t-a"}');
      }
    });

    it('matches no rows for a principal without a tenant', async () => {
      const { countFilter, pageFilter } = await runPage(undefined, {
        ...principal,
        tenantId: null,
      });
      for (const filter of [pageFilter, countFilter]) {
        expect(JSON.stringify(filter)).toContain('"id":{"is":null}');
      }
    });

    // Task 5 review hardening item (b): `getFilterOmitting` recurses into
    // `and`/`or` (verified against the installed nestjs-query-core source),
    // so a client can't smuggle `tenantId` past the top-level omit by
    // nesting it inside a boolean group either.
    it('discards a client tenantId predicate nested inside and/or before merging', async () => {
      const { countFilter, pageFilter } = await runPage({
        and: [{ tenantId: { eq: 't-evil' } }],
        or: [{ tenantId: { eq: 't-evil' } }, { label: { eq: 'x' } }],
      } as never);
      for (const filter of [pageFilter, countFilter]) {
        const serialized = JSON.stringify(filter);
        expect(serialized).not.toContain('t-evil');
        expect(serialized.match(/"tenantId"/g)).toHaveLength(1);
        expect(serialized).toContain('"tenantId":{"eq":"t-a"}');
        expect(serialized).toContain('"label":{"eq":"x"}');
      }
    });
  });
});
