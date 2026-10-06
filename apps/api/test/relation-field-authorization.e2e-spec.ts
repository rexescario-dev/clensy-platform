import { INestApplication } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import {
  GraphQLSchemaHost,
  RESOLVER_NAME_METADATA,
  RESOLVER_PROPERTY_METADATA,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { getNamedType, GraphQLObjectType, isObjectType } from 'graphql';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { LaundryOrderStatus } from '../src/modules/laundry/domain/laundry-order-status';
import { ROLES_KEY } from '../src/platform/auth/decorators/roles.decorator';
import { Role } from '../src/platform/auth/domain/role';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import { withCapturedSql } from './helpers/capture-sql';
import { GateClient } from './release-gate/client';
import {
  buildGateWorld,
  destroyGateWorld,
  GateWorld,
} from './release-gate/two-tenant-world';

// #106 relation-field authorization (multi-tenant RFC §4.2 "Relation-field
// authorization", rules 1–8 and Required verification 1–7). The root
// operation is the unit of role authorization: a relation field is
// authorized by the root operation that reaches it, never by the target
// type's root roles, and it re-applies the tenant predicate. Items 1–6 pin
// behavior that already holds (characterization); item 7 is the metadata
// guard against relation-level guards / @Roles() on live @ResolveField()
// handlers.

interface GraphqlBody {
  data?: Record<string, unknown> | null;
  errors?: { extensions?: { code?: string }; message?: string }[];
}

interface FieldResolverRecord {
  field: string;
  guards: unknown[];
  owner: string;
  roles: Role[] | undefined;
}

interface FieldResolverInventory {
  // `@Resolver(...)` classes whose type name is not a schema object type.
  nonObjectResolverTypes: string[];
  records: FieldResolverRecord[];
}

describe('Relation-field authorization (#106, RFC §4.2)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let world: GateWorld;

  async function gql(
    cookie: string,
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<GraphqlBody> {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query, variables });
    return response.body as GraphqlBody;
  }

  function errorCodes(body: GraphqlBody): (string | undefined)[] {
    return (body.errors ?? []).map((error) => error.extensions?.code);
  }

  // Every discovered @ResolveField() handler whose schema field is
  // object-typed, read from the metadata Nest and nestjs-query attach to
  // the method and its resolver class. This includes the methods
  // nestjs-query generates for relations. It is not claimed to be
  // exhaustive over the RFC §3 relation-field definition. A typed resolver
  // whose type is not a schema object type is reported, not skipped (#135).
  function objectFieldResolvers(): FieldResolverInventory {
    const { schema } = app.get(GraphQLSchemaHost);
    const records: FieldResolverRecord[] = [];
    const nonObjectResolverTypes: string[] = [];
    for (const wrapper of app.get(DiscoveryService).getProviders()) {
      const instance = wrapper.instance as object | undefined;
      if (typeof instance !== 'object' || instance === null) continue;
      const resolverClass = instance.constructor;
      const typeName = Reflect.getMetadata(
        RESOLVER_NAME_METADATA,
        resolverClass,
      ) as string | undefined;
      if (!typeName) continue;
      const parentType = schema.getType(typeName);
      if (!isObjectType(parentType)) {
        nonObjectResolverTypes.push(`${resolverClass.name} -> ${typeName}`);
        continue;
      }
      // Class-level @UseGuards() / @Roles() apply to every handler (#135).
      // Read as Nest does: `Reflect.getMetadata` on the class, so metadata
      // inherited from a base class counts too. Guards are class + method
      // (Nest's guard context); roles are method ?? class (`AuthGuard`'s
      // getAllAndOverride([handler, class])).
      const classGuards =
        (Reflect.getMetadata(GUARDS_METADATA, resolverClass) as
          unknown[] | undefined) ?? [];
      const classRoles = Reflect.getMetadata(ROLES_KEY, resolverClass) as
        Role[] | undefined;
      const seen = new Set<string>();
      for (
        let proto = Object.getPrototypeOf(instance) as object | null;
        proto && proto !== Object.prototype;
        proto = Object.getPrototypeOf(proto) as object | null
      ) {
        for (const key of Object.getOwnPropertyNames(proto)) {
          if (seen.has(key)) continue;
          // Read the descriptor, so a getter is never invoked (#135).
          const handler = Object.getOwnPropertyDescriptor(proto, key)
            ?.value as unknown;
          if (typeof handler !== 'function') continue;
          if (Reflect.getMetadata(RESOLVER_PROPERTY_METADATA, handler) !== true)
            continue;
          seen.add(key);
          // `@ResolveField()` without an explicit name stores `undefined`;
          // Nest then uses the method name, as here.
          const field =
            (Reflect.getMetadata(RESOLVER_NAME_METADATA, handler) as
              string | undefined) ?? key;
          const schemaField = (parentType as GraphQLObjectType).getFields()[
            field
          ];
          if (!schemaField || !isObjectType(getNamedType(schemaField.type)))
            continue;
          records.push({
            field: `${typeName}.${field}`,
            guards: [
              ...classGuards,
              ...((Reflect.getMetadata(GUARDS_METADATA, handler) as
                unknown[] | undefined) ?? []),
            ],
            owner: `${resolverClass.name}.${key}`,
            roles:
              (Reflect.getMetadata(ROLES_KEY, handler) as Role[] | undefined) ??
              classRoles,
          });
        }
      }
    }
    return { nonObjectResolverTypes, records };
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule, DiscoveryModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    applyPlatformPipes(app);
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    world = await buildGateWorld(dataSource, new GateClient(app));
  }, 120_000);

  afterAll(async () => {
    try {
      if (dataSource) await destroyGateWorld(dataSource, world);
    } finally {
      await app?.close();
    }
  });

  // Required verification 1 (rule 1).
  it('FINANCE reads invoice.customer through the invoice root operation', async () => {
    const body = await gql(
      world.a.cookies[Role.FINANCE],
      `query ($id: ID!) { invoice(id: $id) { id customer { id fullName email } } }`,
      { id: world.a.invoiceId },
    );
    expect(body.errors).toBeUndefined();
    expect(body.data?.invoice).toMatchObject({
      id: world.a.invoiceId,
      customer: { id: world.a.customerId },
    });
  });

  // Required verification 2 (rule 1).
  it('FINANCE reads booking.customer, .property and .team through the booking root operation', async () => {
    const body = await gql(
      world.a.cookies[Role.FINANCE],
      `query ($id: ID!) { booking(id: $id) { id customer { id } property { id } team { id } } }`,
      { id: world.a.bookingId },
    );
    expect(body.errors).toBeUndefined();
    expect(body.data?.booking).toEqual({
      id: world.a.bookingId,
      customer: { id: world.a.customerId },
      property: { id: world.a.propertyId },
      team: { id: world.a.teamId },
    });
  });

  // Required verification 3 (rule 1).
  it('CUSTOMER_SUPPORT reads booking.team through the booking root operation', async () => {
    const body = await gql(
      world.a.cookies[Role.CUSTOMER_SUPPORT],
      `query ($id: ID!) { booking(id: $id) { id team { id name } } }`,
      { id: world.a.bookingId },
    );
    expect(body.errors).toBeUndefined();
    expect(body.data?.booking).toMatchObject({ team: { id: world.a.teamId } });
  });

  // Required verification 4 (rule 5: hand-written relation field).
  it.each([Role.FINANCE, Role.CUSTOMER_SUPPORT])(
    '%s reads the hand-written job.team through the job root operation',
    async (role) => {
      const body = await gql(
        world.a.cookies[role],
        `query ($id: ID!) { job(id: $id) { id team { id } } }`,
        { id: world.a.jobId },
      );
      expect(body.errors).toBeUndefined();
      expect(body.data?.job).toEqual({
        id: world.a.jobId,
        team: { id: world.a.teamId },
      });
    },
  );

  // Rule 1 at depth: job -> booking -> customer -> properties, none of
  // whose target types FINANCE can read at root.
  it('FINANCE reads nested relations at any depth under the job root operation', async () => {
    const body = await gql(
      world.a.cookies[Role.FINANCE],
      `query ($id: ID!) { job(id: $id) { booking { customer { id properties { nodes { id } } } } } }`,
      { id: world.a.jobId },
    );
    expect(body.errors).toBeUndefined();
    expect(body.data?.job).toEqual({
      booking: {
        customer: {
          id: world.a.customerId,
          properties: { nodes: [{ id: world.a.propertyId }] },
        },
      },
    });
  });

  // Rule 3: a mutation is the root operation for its returned selection.
  it('FINANCE reads customer on the return of a mutation it may call', async () => {
    const orderId = await world.fixtures.laundryOrder(
      world.a,
      LaundryOrderStatus.PRICED,
    );
    const body = await gql(
      world.a.cookies[Role.FINANCE],
      `mutation ($input: LaundryOrderRefInput!) { markLaundryOrderAwaitingPayment(input: $input) { id customer { id } } }`,
      { input: { orderId } },
    );
    expect(body.errors).toBeUndefined();
    expect(body.data?.markLaundryOrderAwaitingPayment).toEqual({
      id: orderId,
      customer: { id: world.a.customerId },
    });
  });

  // Required verification 5 (rules 2 and 4). Composite same-tenant FKs
  // (§4.4) make a stored cross-tenant reference impossible. As additional,
  // implementation-level evidence that does not weaken the schema, these
  // tests check that representative relation queries contain a tenant
  // predicate parameterized with the principal's tenant (a string-level
  // check of the logged SQL, parameters included), and that relation
  // filters cannot select another tenant's rows.
  it.each([
    [
      'invoice.customer (nestjs-query)',
      `query ($id: ID!) { invoice(id: $id) { customer { id } } }`,
      'invoiceId',
      'customer_entity',
    ],
    [
      'booking.team (nestjs-query)',
      `query ($id: ID!) { booking(id: $id) { team { id } } }`,
      'bookingId',
      'team_entity',
    ],
    [
      'job.team (hand-written loader)',
      `query ($id: ID!) { job(id: $id) { team { id } } }`,
      'jobId',
      'team_entity',
    ],
  ] as const)(
    '%s queries its target with the principal tenant predicate',
    async (_label, query, idKey, table) => {
      const { queries, result } = await withCapturedSql(dataSource, () =>
        gql(world.a.cookies[Role.FINANCE], query, { id: world.a[idKey] }),
      );
      expect(result.errors).toBeUndefined();
      const relationSelects = queries.filter(
        (sql) =>
          sql.toLowerCase().includes(`from "${table}"`) &&
          !sql.toLowerCase().startsWith('insert'),
      );
      expect(relationSelects.length).toBeGreaterThan(0);
      for (const sql of relationSelects) {
        expect({ sql, tenantPredicate: sql.includes('"tenantId"') }).toEqual({
          sql,
          tenantPredicate: true,
        });
        expect({ sql, tenantParam: sql.includes(world.a.tenantId) }).toEqual({
          sql,
          tenantParam: true,
        });
        expect({
          otherTenantParam: sql.includes(world.b.tenantId),
          sql,
        }).toEqual({ otherTenantParam: false, sql });
      }
    },
  );

  it('relation filters cannot select another tenant’s rows', async () => {
    const invoices = await gql(
      world.b.cookies[Role.FINANCE],
      `query ($customerId: ID!) { invoices(filter: { customer: { id: { eq: $customerId } } }) { nodes { id } } }`,
      { customerId: world.a.customerId },
    );
    expect(invoices.errors).toBeUndefined();
    expect(invoices.data?.invoices).toEqual({ nodes: [] });
    const jobs = await gql(
      world.b.cookies[Role.FINANCE],
      `query ($bookingId: ID!) { jobs(filter: { booking: { id: { eq: $bookingId } } }) { nodes { id } } }`,
      { bookingId: world.a.bookingId },
    );
    expect(jobs.errors).toBeUndefined();
    expect(jobs.data?.jobs).toEqual({ nodes: [] });
  });

  // Required verification 6 (rule 7): relation reach does not widen root
  // access.
  it.each([
    [Role.FINANCE, `query { customers { nodes { id } } }`, {}],
    [
      Role.FINANCE,
      `query ($id: ID!) { customer(id: $id) { id } }`,
      'customerId',
    ],
    [
      Role.FINANCE,
      `query ($id: ID!) { customerProperties(customerId: $id) { nodes { id } } }`,
      'customerId',
    ],
    [
      Role.FINANCE,
      `query ($id: ID!) { property(id: $id) { id } }`,
      'propertyId',
    ],
    [Role.FINANCE, `query { teams { nodes { id } } }`, {}],
    [Role.FINANCE, `query ($id: ID!) { team(id: $id) { id } }`, 'teamId'],
    [Role.CUSTOMER_SUPPORT, `query { teams { nodes { id } } }`, {}],
    [
      Role.CUSTOMER_SUPPORT,
      `query ($id: ID!) { team(id: $id) { id } }`,
      'teamId',
    ],
  ] as const)('%s stays Forbidden on root %s', async (role, query, idKey) => {
    const variables = typeof idKey === 'string' ? { id: world.a[idKey] } : {};
    const body = await gql(world.a.cookies[role], query, variables);
    expect(errorCodes(body)).toEqual(['FORBIDDEN']);
  });

  // Required verification 7 (rule 6).
  it('declares no guards or @Roles() on any relation field resolver', () => {
    const { nonObjectResolverTypes, records } = objectFieldResolvers();
    expect(nonObjectResolverTypes).toEqual([]);
    // Sentinels: both resolver kinds are inventoried, so an empty or
    // one-sided inventory cannot pass vacuously.
    expect(records.map((r) => r.field)).toEqual(
      expect.arrayContaining([
        'Booking.team',
        'CleaningJob.team',
        'Cleaner.team',
        'Invoice.customer',
        'Customer.properties',
      ]),
    );
    expect(
      records
        .filter((r) => r.guards.length > 0 || r.roles !== undefined)
        .map((r) => r.owner)
        .sort(),
    ).toEqual([]);
  });
});
