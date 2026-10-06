import { INestApplication } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import {
  GraphQLSchemaHost,
  RESOLVER_NAME_METADATA,
  TypeMetadataStorage,
} from '@nestjs/graphql';
// Pinned-version dependency (9.5.0): no public accessor, no `exports` map.
import { getRelations } from '@ptc-org/nestjs-query-graphql/src/decorators';
import {
  AssemblerQueryService,
  NoOpQueryService,
  ProxyQueryService,
  RelationQueryService,
} from '@ptc-org/nestjs-query-core';
import { TypeOrmQueryService } from '@ptc-org/nestjs-query-typeorm';
import {
  getNamedType,
  GraphQLObjectType,
  GraphQLSchema,
  isObjectType,
} from 'graphql';
import { DataSource, EntityMetadata } from 'typeorm';
import {
  bootGraphqlSurface,
  collectRootHandlers,
} from './helpers/graphql-surface';

// Regression guard for the #90 sweep (decisions 7–8; RFC §4.5). Reads live
// GraphQL, nestjs-query, Nest discovery and TypeORM metadata. A metadata
// check of tenant *read filters* and inventory completeness; it does not
// prove runtime isolation (the module two-tenant suites do), relation-field
// authorization (relation-field-authorization.e2e-spec.ts, #106), or the
// scoping inside custom @Query handlers and loaders.

// `TypeMetadataStorage` types ObjectType targets as `Function`.
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type DtoClass = Function;

const CHILD_ROW_TYPES: Record<string, string> = {
  ChecklistItem:
    'No tenantId column; reachable only as Checklist.items, and Checklist is tenant-scoped.',
  InvoiceLine:
    'No tenantId column; reachable only as Invoice.lines, and Invoice is tenant-scoped.',
  LaundryOrderLine:
    'tenantId bound to its order by composite FK (#87); reachable only as LaundryOrder.lines, and LaundryOrder is tenant-scoped.',
};

// Every nestjs-query read resolver, as `Resolver->DTO` (M7 review: an
// exact set, so a new or unrecognized read resolver fails until classified
// here instead of being skipped). Sorted (lint).
const READ_RESOLVERS = [
  'AddOnReadResolver->AddOn',
  'BookingReadResolver->Booking',
  'ChecklistReadResolver->Checklist',
  'CleanerReadResolver->Cleaner',
  'CustomerReadResolver->Customer',
  'InvoiceReadResolver->Invoice',
  'JobReadResolver->CleaningJob',
  'LaundryOrderReadResolver->LaundryOrder',
  'PropertyReadResolver->Property',
  'ServiceReadResolver->Service',
  'TeamReadResolver->Team',
];

// nestjs-query query-service classes other than TypeOrmQueryService: a
// resolver whose `service` is one of these is a read surface this suite
// does not know how to map to an entity, so it fails rather than skipping.
const OTHER_QUERY_SERVICES = [
  AssemblerQueryService,
  NoOpQueryService,
  ProxyQueryService,
  RelationQueryService,
];

const CUSTOM_SURFACE_ENTITIES: Record<string, string> = {
  AdminUserEntity:
    'Read only via the custom `admins` query; AdminsService lists by the principal tenant (#68).',
  AuditEventEntity: 'Not exposed through GraphQL.',
  LaundryOrderLineEntity:
    'Child rows of LaundryOrder; read only via LaundryOrder.lines and LaundryOrdersService (#87).',
  PricingRuleEntity:
    'Read only via `activePricing` (query and Service.activePricing loader); PricingRulesService scopes by tenant (#84).',
};

const CUSTOM_OBJECT_FIELDS: Record<string, string> = {
  'Booking.pricingSnapshot': 'TypeORM embeddable stored on the booking row.',
  'Cleaner.team':
    'CleanerResolver @ResolveField via CleanerTeamLoaders keyed by the principal tenant (#83).',
  'CleaningJob.checklist':
    'JobResolver @ResolveField via JobRelationLoaders keyed by the principal tenant (#86).',
  'CleaningJob.team':
    'JobResolver @ResolveField via JobRelationLoaders keyed by the principal tenant (#86).',
  'CurrentAdmin.tenantLabelOverrides':
    "CurrentAdminLabelOverridesResolver @ResolveField; its parent is built only from the principal, so it reads the principal's own tenant's labels (#118).",
  'LaundryOrderLine.pricingSnapshot':
    'TypeORM embeddable stored on the line row.',
  'LoginResult.admin': "The caller's own principal, returned by login.",
  'Service.activePricing':
    'ServiceResolver @ResolveField via request-scoped ActivePricingLoader keyed by the principal tenant (#84).',
  'TenantLabelOverrides.roles':
    'Plain value object that CurrentAdmin.tenantLabelOverrides builds from those same labels; no resolver of its own (#118).',
};

const PROBE_TENANT = 'tenant-probe';
const READ_CONTEXT = {
  many: true,
  operationGroup: 'read',
  operationName: 'queryMany',
  readonly: true,
};

interface Authorizer {
  authorize(context: unknown, authorizationContext: unknown): Promise<unknown>;
}

interface ReadResolverRecord {
  resolver: string;
  dtoName: string | undefined;
  entity: EntityMetadata;
}

interface RelationRecord {
  parent: string;
  name: string;
  target: string | undefined;
}

describe('Tenant read surfaces (#90 sweep guard)', () => {
  let app: INestApplication;
  let schema: GraphQLSchema;
  const typesByName = new Map<string, DtoClass>();
  const readResolvers: ReadResolverRecord[] = [];
  const unrecognizedReadResolvers: string[] = [];
  const relations: RelationRecord[] = [];
  let tenantEntityNames: string[] = [];

  function relationsOf(target: DtoClass): { name: string; dto: DtoClass }[] {
    const declared = getRelations(target as never) as {
      one?: Record<string, { DTO: DtoClass }>;
      many?: Record<string, { DTO: DtoClass }>;
    };
    return [
      ...Object.entries(declared.one ?? {}),
      ...Object.entries(declared.many ?? {}),
    ].map(([name, relation]) => ({ name, dto: relation.DTO }));
  }

  function nameOf(target: DtoClass): string | undefined {
    return TypeMetadataStorage.getObjectTypesMetadata().find(
      (type) => type.target === target,
    )?.name;
  }

  function isConnection(type: GraphQLObjectType): boolean {
    return 'nodes' in type.getFields();
  }

  // Throws (failing the test) if nestjs-query registered no authorizer for
  // a surface: a missing provider is never treated as an exclusion.
  async function tenantScopeOf(
    name: string,
  ): Promise<{ name: string; tenantScoped: boolean }> {
    const target = typesByName.get(name);
    if (!target) throw new Error(`${name}: not a live ObjectType`);
    let authorizer: Authorizer;
    try {
      authorizer = app.get<Authorizer>(`${target.name}Authorizer`, {
        strict: false,
      });
    } catch {
      throw new Error(
        `${name}: no nestjs-query authorizer provider (${target.name}Authorizer)`,
      );
    }
    const tenant = await authorizer.authorize(
      { req: { user: { tenantId: PROBE_TENANT } } },
      READ_CONTEXT,
    );
    const none = await authorizer.authorize(
      { req: { user: undefined } },
      READ_CONTEXT,
    );
    return {
      name,
      tenantScoped:
        JSON.stringify(tenant) ===
          JSON.stringify({ tenantId: { eq: PROBE_TENANT } }) &&
        JSON.stringify(none) === JSON.stringify({ id: { is: null } }),
    };
  }

  beforeAll(async () => {
    app = await bootGraphqlSurface();
    schema = app.get(GraphQLSchemaHost).schema;
    for (const meta of TypeMetadataStorage.getObjectTypesMetadata()) {
      const live = schema.getType(meta.name);
      if (isObjectType(live) && !isConnection(live)) {
        typesByName.set(meta.name, meta.target);
      }
    }
    for (const wrapper of app.get(DiscoveryService).getProviders()) {
      const instance = wrapper.instance as { service?: unknown } | undefined;
      if (!(instance?.service instanceof TypeOrmQueryService)) {
        if (
          OTHER_QUERY_SERVICES.some(
            (queryService) => instance?.service instanceof queryService,
          )
        ) {
          unrecognizedReadResolvers.push((instance as object).constructor.name);
        }
        continue;
      }
      const service = instance.service as TypeOrmQueryService<object>;
      readResolvers.push({
        dtoName: Reflect.getMetadata(
          RESOLVER_NAME_METADATA,
          instance.constructor,
        ) as string | undefined,
        entity: service.repo.metadata,
        resolver: instance.constructor.name,
      });
    }
    for (const [parent, target] of typesByName) {
      for (const relation of relationsOf(target)) {
        relations.push({
          name: relation.name,
          parent,
          target: nameOf(relation.dto),
        });
      }
    }
    tenantEntityNames = app
      .get(DataSource)
      .entityMetadatas.filter((entity) =>
        entity.columns.some((column) => column.propertyName === 'tenantId'),
      )
      .map((entity) => entity.name);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('inventories read resolvers, relations and tenant entities from live metadata (sentinels)', () => {
    expect(typeof getRelations).toBe('function');
    // Exact set, including the relation-only ChecklistReadResolver.
    expect(
      readResolvers.map((r) => `${r.resolver}->${r.dtoName}`).sort(),
    ).toEqual(READ_RESOLVERS);
    expect(relations).toEqual(
      expect.arrayContaining([
        { name: 'customer', parent: 'Invoice', target: 'Customer' },
      ]),
    );
    expect(tenantEntityNames).toEqual(
      expect.arrayContaining(['CustomerEntity']),
    );
  });

  it('fails on read resolvers it cannot recognize instead of skipping them', () => {
    expect(unrecognizedReadResolvers).toEqual([]);
    // Every generated (inherited) root handler belongs to a recognized
    // nestjs-query read resolver, so a root list cannot bypass this suite.
    const recognized = new Set(readResolvers.map((r) => r.resolver));
    const generatedOwners = collectRootHandlers(app)
      .filter((handler) => !handler.ownMethod)
      .map((handler) => handler.owner.split('.')[0]);
    expect(generatedOwners.length).toBeGreaterThan(0);
    expect(generatedOwners.filter((owner) => !recognized.has(owner))).toEqual(
      [],
    );
  });

  it('resolves every read resolver to a live DTO type and a tenant-owned entity', () => {
    for (const record of readResolvers) {
      expect({
        resolver: record.resolver,
        dtoLive:
          record.dtoName !== undefined && typesByName.has(record.dtoName),
        entityHasTenantId: tenantEntityNames.includes(record.entity.name),
      }).toEqual({
        resolver: record.resolver,
        dtoLive: true,
        entityHasTenantId: true,
      });
    }
  });

  it('exposes every declared relation as a live schema field targeting a live type', () => {
    for (const relation of relations) {
      const parentType = schema.getType(relation.parent) as GraphQLObjectType;
      expect({
        relation: `${relation.parent}.${relation.name}`,
        exposed: relation.name in parentType.getFields(),
        targetLive:
          relation.target !== undefined && typesByName.has(relation.target),
      }).toEqual({
        relation: `${relation.parent}.${relation.name}`,
        exposed: true,
        targetLive: true,
      });
    }
  });

  it('accounts for every object-typed field: declared relation or allowlisted custom field', () => {
    const seen: string[] = [];
    for (const [typeName] of typesByName) {
      const liveType = schema.getType(typeName) as GraphQLObjectType;
      const declared = new Set(
        relations.filter((r) => r.parent === typeName).map((r) => r.name),
      );
      for (const [fieldName, field] of Object.entries(liveType.getFields())) {
        if (!isObjectType(getNamedType(field.type))) continue;
        const fieldKey = `${typeName}.${fieldName}`;
        seen.push(fieldKey);
        expect({
          fieldKey,
          recognized:
            declared.has(fieldName) || fieldKey in CUSTOM_OBJECT_FIELDS,
        }).toEqual({ fieldKey, recognized: true });
      }
    }
    for (const fieldKey of Object.keys(CUSTOM_OBJECT_FIELDS)) {
      const [typeName, fieldName] = fieldKey.split('.');
      expect({
        fieldKey,
        live: seen.includes(fieldKey),
        isDeclaredRelation: relations.some(
          (r) => r.parent === typeName && r.name === fieldName,
        ),
      }).toEqual({ fieldKey, live: true, isDeclaredRelation: false });
    }
  });

  it('tenant-scopes every read-resolver DTO and relation target (child rows excepted)', async () => {
    const surfaces = new Set<string>([
      ...readResolvers.map((r) => r.dtoName ?? '<unresolved>'),
      ...relations.map((r) => r.target ?? '<unresolved>'),
    ]);
    expect(surfaces.size).toBeGreaterThan(0);
    for (const name of surfaces) {
      if (name in CHILD_ROW_TYPES) continue;
      expect(await tenantScopeOf(name)).toEqual({ name, tenantScoped: true });
    }
  });

  it('never lets an unscoped type own a nestjs-query relation', async () => {
    const parents = new Set(relations.map((r) => r.parent));
    expect(parents.size).toBeGreaterThan(0);
    for (const name of parents) {
      expect(await tenantScopeOf(name)).toEqual({ name, tenantScoped: true });
    }
  });

  it('keeps the child-row allowlist narrow and live', () => {
    const readDtos = readResolvers.map((r) => r.dtoName);
    for (const name of Object.keys(CHILD_ROW_TYPES)) {
      expect({
        isReadResolverDto: readDtos.includes(name),
        live: typesByName.has(name),
        name,
        ownRelations: relations.filter((r) => r.parent === name).length,
        parentRelations: relations.filter((r) => r.target === name).length > 0,
      }).toEqual({
        isReadResolverDto: false,
        live: true,
        name,
        ownRelations: 0,
        parentRelations: true,
      });
    }
  });

  it('accounts for every tenant-owned entity (read resolver or allowlisted custom surface)', () => {
    const resolverEntities = new Set(readResolvers.map((r) => r.entity.name));
    for (const entity of tenantEntityNames) {
      expect({
        entity,
        covered:
          resolverEntities.has(entity) || entity in CUSTOM_SURFACE_ENTITIES,
      }).toEqual({ entity, covered: true });
    }
    for (const entity of Object.keys(CUSTOM_SURFACE_ENTITIES)) {
      expect({
        entity,
        tenantOwned: tenantEntityNames.includes(entity),
        servedByReadResolver: resolverEntities.has(entity),
      }).toEqual({ entity, tenantOwned: true, servedByReadResolver: false });
    }
  });
});
