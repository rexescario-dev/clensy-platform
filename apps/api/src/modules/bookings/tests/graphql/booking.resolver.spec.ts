import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import {
  GraphQLEnumType,
  GraphQLInputObjectType,
  GraphQLObjectType,
} from 'graphql';
// @ptc-org/nestjs-query-graphql 9.5.0 does not re-export getAuthorizer from
// the package root, so this deep import is required (same pattern as #82-#84
// in service-read.resolver.spec.ts).
import { getAuthorizer } from '@ptc-org/nestjs-query-graphql/src/decorators';
import { PLATFORM_PAGE_DEFAULT } from '../../../../platform/graphql/paging';
import { ROLES_KEY } from '../../../../platform/auth/decorators/roles.decorator';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CustomerResolver } from '../../../customers/presentation/graphql/customer.resolver';
import { PropertyResolver } from '../../../customers/presentation/graphql/property.resolver';
import { ServiceResolver } from '../../../catalog/presentation/graphql/service.resolver';
import { TeamResolver } from '../../../cleaners/presentation/graphql/team.resolver';
import { BookingDTO } from '../../presentation/graphql/booking.dto';
import { BookingReadResolver } from '../../presentation/graphql/booking-read.resolver';
import { BookingMutationResolver } from '../../presentation/graphql/booking.resolver';

type MutationMethod = 'createBooking' | 'removeBooking' | 'updateBooking';
type ReadMethod = 'findById' | 'queryMany';

const VIEW_ROLES = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];
const WRITE_ROLES = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
];

const ALLOWED_BOOKING_MUTATIONS = new Set([
  'createBooking',
  'updateBooking',
  'removeBooking',
]);
const DENYLIST =
  /^(create|update|delete)(One|Many)Booking$|^set(Customer|Property|Service|Team)OnBooking$|^(add|remove).*(Booking|Customer|Property|Service|Team)/;

function mutationMethodRef(
  method: MutationMethod,
): (...args: unknown[]) => unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    BookingMutationResolver.prototype,
    method,
  );
  return descriptor!.value as (...args: unknown[]) => unknown;
}

function readMethodRef(method: ReadMethod): (...args: unknown[]) => unknown {
  let proto: object | null = BookingReadResolver.prototype;
  while (proto) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, method);
    if (descriptor?.value) {
      return descriptor.value as (...args: unknown[]) => unknown;
    }
    proto = Object.getPrototypeOf(proto) as object | null;
  }
  throw new Error(`Read method ${method} not found on BookingReadResolver`);
}

describe('Booking GraphQL reads and mutations', () => {
  const reflector = new Reflector();

  describe.each([
    ['createBooking', WRITE_ROLES],
    ['updateBooking', WRITE_ROLES],
    ['removeBooking', WRITE_ROLES],
  ] as const)('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — write matrix`, () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        mutationMethodRef(method),
      ) as unknown[] | undefined;
      expect(guards ?? []).toContain(AuthGuard);
      expect(
        reflector.get<Role[] | undefined>(ROLES_KEY, mutationMethodRef(method)),
      ).toEqual(expectedRoles);
    });
  });

  describe.each([
    ['findById', VIEW_ROLES],
    ['queryMany', VIEW_ROLES],
  ] as const)('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — view matrix`, () => {
      const guards = Reflect.getMetadata(
        GUARDS_METADATA,
        readMethodRef(method),
      ) as unknown[] | undefined;
      expect(guards ?? []).toContain(AuthGuard);
      expect(
        reflector.get<Role[] | undefined>(ROLES_KEY, readMethodRef(method)),
      ).toEqual(expectedRoles);
    });
  });

  describe('schema allowlist', () => {
    it('exposes Booking fields, Booking!, BookingConnection with offset paging, and only Clensy booking mutations', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [GraphQLSchemaBuilderModule],
      }).compile();
      const schemaFactory = moduleRef.get(GraphQLSchemaFactory);
      const schema = await schemaFactory.create([
        BookingReadResolver,
        BookingMutationResolver,
        CustomerResolver,
        PropertyResolver,
        ServiceResolver,
        TeamResolver,
      ]);

      const bookingType = schema.getType('Booking') as GraphQLObjectType;
      expect(bookingType).toBeDefined();
      const fieldNames = Object.keys(bookingType.getFields()).sort();
      expect(fieldNames).toEqual(
        [
          'id',
          'scheduledAt',
          'status',
          'pricingSnapshot',
          'customer',
          'property',
          'service',
          'team',
          'createdAt',
        ].sort(),
      );
      expect(fieldNames).not.toContain('customerId');
      expect(fieldNames).not.toContain('propertyId');
      expect(fieldNames).not.toContain('serviceId');
      expect(fieldNames).not.toContain('teamId');

      expect(bookingType.getFields().customer.type.toString()).toBe(
        'Customer!',
      );
      expect(bookingType.getFields().property.type.toString()).toBe(
        'Property!',
      );
      expect(bookingType.getFields().service.type.toString()).toBe('Service!');
      expect(bookingType.getFields().team.type.toString()).toBe('Team');

      const bookingQuery = schema.getQueryType()!.getFields().booking;
      expect(bookingQuery.type.toString()).toBe('Booking!');

      const bookingsQuery = schema.getQueryType()!.getFields().bookings;
      expect(bookingsQuery.type.toString()).toBe('BookingConnection!');
      const argNames = bookingsQuery.args.map((arg) => arg.name).sort();
      expect(argNames).toEqual(['filter', 'paging', 'sorting']);

      const connection = schema.getType(
        'BookingConnection',
      ) as GraphQLObjectType;
      expect(connection).toBeDefined();
      expect(Object.keys(connection.getFields()).sort()).toEqual(
        ['nodes', 'pageInfo', 'totalCount'].sort(),
      );
      expect(connection.getFields()).not.toHaveProperty('edges');

      const pagingArg = bookingsQuery.args.find((arg) => arg.name === 'paging');
      expect(pagingArg?.type.toString()).toMatch(/OffsetPaging/);
      expect(pagingArg?.defaultValue).toEqual({
        limit: PLATFORM_PAGE_DEFAULT,
      });
      expect(schema.getType('OffsetPageInfo')).toBeDefined();
      expect(schema.getType('PageInfo')).toBeUndefined();
      expect(schema.getType('CursorPaging')).toBeUndefined();

      const sortFields = schema.getType('BookingSortFields') as GraphQLEnumType;
      expect(sortFields).toBeDefined();
      const sortFieldNames = sortFields
        .getValues()
        .map((value) => value.name)
        .sort();
      // Whitelist proof (#65 spec §4.2 item 2): BookingSortFields exposes
      // exactly the four fields the schema currently permits sorting on
      // (id, scheduledAt, status, createdAt) — none of Booking's four
      // relations (customer/property/service/team) and no non-filterable
      // field (pricingSnapshot) is sortable.
      expect(sortFieldNames).toEqual(
        ['createdAt', 'id', 'scheduledAt', 'status'].sort(),
      );

      const queryNames = Object.keys(schema.getQueryType()!.getFields());
      for (const name of queryNames) {
        expect(name).not.toMatch(/aggregate/i);
      }

      const mutationNames = Object.keys(schema.getMutationType()!.getFields());
      expect(mutationNames).toEqual(
        expect.arrayContaining([
          'createBooking',
          'updateBooking',
          'removeBooking',
        ]),
      );
      for (const name of mutationNames) {
        if (ALLOWED_BOOKING_MUTATIONS.has(name)) {
          continue;
        }
        expect(name).not.toMatch(DENYLIST);
      }
    });
  });

  // Local schema-invariant check (#85 Global constraints): `tenantId` is
  // deliberately never a GraphQL field, filterable field, or input field on
  // Booking. Easier to diagnose here than in the final generated-schema
  // diff. Built exactly as service-read.resolver.spec.ts's schema test
  // (#82-#84 precedent).
  it('never exposes tenantId as a GraphQL field, filter field, or input field', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [GraphQLSchemaBuilderModule],
    }).compile();
    const schemaFactory = moduleRef.get(GraphQLSchemaFactory);
    const schema = await schemaFactory.create([
      BookingReadResolver,
      BookingMutationResolver,
    ]);

    const bookingType = schema.getType('Booking') as GraphQLObjectType;
    expect(Object.keys(bookingType.getFields())).not.toContain('tenantId');

    const bookingFilter = schema.getType(
      'BookingFilter',
    ) as GraphQLInputObjectType;
    expect(Object.keys(bookingFilter.getFields())).not.toContain('tenantId');

    const createInput = schema.getType(
      'CreateBookingInput',
    ) as GraphQLInputObjectType;
    expect(Object.keys(createInput.getFields())).not.toContain('tenantId');

    const updateInput = schema.getType(
      'UpdateBookingInput',
    ) as GraphQLInputObjectType;
    expect(Object.keys(updateInput.getFields())).not.toContain('tenantId');
  });

  describe('mutation actorId wiring', () => {
    it('createBooking/updateBooking/removeBooking always pass a non-null actorId', async () => {
      const bookingsService = {
        create: jest.fn().mockResolvedValue({
          id: 'booking-1',
          pricingSnapshot: { priceMinorUnits: 1 },
        }),
        remove: jest.fn().mockResolvedValue({
          id: 'booking-1',
          pricingSnapshot: { priceMinorUnits: 1 },
        }),
        update: jest.fn().mockResolvedValue({
          id: 'booking-1',
          pricingSnapshot: { priceMinorUnits: 1 },
        }),
      };
      const resolver = new BookingMutationResolver(bookingsService as never);
      const currentUser = {
        id: 'admin-1',
        tenantId: 'tenant-1',
        role: Role.TENANT_OWNER,
        scope: AdminScope.TENANT,
      };

      await resolver.createBooking(
        {
          customerId: 'c1',
          propertyId: 'p1',
          serviceId: 's1',
          scheduledAt: new Date(),
        },
        currentUser,
      );
      expect(bookingsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: 'admin-1',
          tenantId: 'tenant-1',
        }),
      );

      await resolver.updateBooking(
        { id: 'booking-1', scheduledAt: new Date() },
        currentUser,
      );
      expect(bookingsService.update).toHaveBeenCalledWith(
        'booking-1',
        expect.objectContaining({ actorId: 'admin-1', tenantId: 'tenant-1' }),
      );

      await resolver.removeBooking('booking-1', currentUser);
      expect(bookingsService.remove).toHaveBeenCalledWith(
        'booking-1',
        'admin-1',
        'tenant-1',
      );
    });
  });

  // Tenant isolation (#83 Slice decision 6): the caller's tenant comes only
  // from the DB-loaded principal, never from GraphQL input.
  describe('BookingMutationResolver tenant scoping', () => {
    it('updateBooking passes the caller tenant', async () => {
      const bookingsService = {
        update: jest.fn().mockResolvedValue({
          id: 'b-1',
          pricingSnapshot: { priceMinorUnits: 1 },
        }),
      };
      const resolver = new BookingMutationResolver(bookingsService as never);
      const principal = {
        id: 'u',
        tenantId: 't-a',
        role: Role.TENANT_OWNER,
        scope: AdminScope.TENANT,
      };

      await resolver.updateBooking({ id: 'b-1', teamId: 'team-a' }, principal);

      expect(bookingsService.update).toHaveBeenCalledWith(
        'b-1',
        expect.objectContaining({ tenantId: 't-a' }),
      );
    });

    it('removeBooking passes the caller tenant', async () => {
      const bookingsService = {
        remove: jest.fn().mockResolvedValue({
          id: 'b-1',
          pricingSnapshot: { priceMinorUnits: 1 },
        }),
      };
      const resolver = new BookingMutationResolver(bookingsService as never);
      const principal = {
        id: 'u',
        tenantId: 't-a',
        role: Role.TENANT_OWNER,
        scope: AdminScope.TENANT,
      };

      await resolver.removeBooking('b-1', principal);

      expect(bookingsService.remove).toHaveBeenCalledWith('b-1', 'u', 't-a');
    });

    // Defense in depth (#85 Slice decision 7 / require-tenant-id.ts): every
    // mutation resolver sits behind `@Roles(...WRITE_ROLES)`, which excludes
    // SUPER_ADMIN — the only role that can carry `tenantId: null`. A null
    // tenant here is unreachable in practice; this guards against that
    // invariant breaking silently, mirroring customer.resolver.spec.ts.
    it.each(['createBooking', 'updateBooking', 'removeBooking'] as const)(
      '%s is forbidden without a principal tenant',
      async (method) => {
        const bookingsService = {
          create: jest.fn(),
          remove: jest.fn(),
          update: jest.fn(),
        };
        const resolver = new BookingMutationResolver(bookingsService as never);
        const noTenant = {
          id: 'u',
          tenantId: null,
          role: Role.TENANT_OWNER,
          scope: AdminScope.PLATFORM,
        };

        const call =
          method === 'createBooking'
            ? resolver.createBooking(
                {
                  customerId: 'c1',
                  propertyId: 'p1',
                  serviceId: 's1',
                  scheduledAt: new Date(),
                },
                noTenant,
              )
            : method === 'updateBooking'
              ? resolver.updateBooking({ id: 'b-1' }, noTenant)
              : resolver.removeBooking('b-1', noTenant);

        await expect(call).rejects.toBeInstanceOf(ForbiddenException);
        expect(bookingsService.create).not.toHaveBeenCalled();
        expect(bookingsService.update).not.toHaveBeenCalled();
        expect(bookingsService.remove).not.toHaveBeenCalled();
      },
    );
  });

  // @Authorize metadata (mirrors #82-#84's service-read.resolver.spec.ts /
  // team.resolver.spec.ts precedent). Security invariant: every nestjs-query
  // read of BookingDTO — the root list/count, `booking(id)`, and every
  // relation targeting this type — is ANDed with the principal's tenant.
  describe('BookingDTO tenant authorizer', () => {
    it('is registered and constrains reads to the principal tenant', async () => {
      const Authorizer = getAuthorizer(BookingDTO as never);
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

    it('fails closed (matches no row) when there is no req.user', async () => {
      const Authorizer = getAuthorizer(BookingDTO as never);
      const authorizer = new Authorizer!({}, undefined);
      await expect(
        authorizer.authorize({ req: {} }, { operationGroup: 'read' } as never),
      ).resolves.toEqual({ id: { is: null } });
    });
  });

  it('BookingMutationResolver and BookingReadResolver have no @ResolveField for the four relations', () => {
    const graphqlDir = join(__dirname, '../../presentation/graphql');
    const mutationSrc = readFileSync(
      join(graphqlDir, 'booking.resolver.ts'),
      'utf8',
    );
    const readSrc = readFileSync(
      join(graphqlDir, 'booking-read.resolver.ts'),
      'utf8',
    );
    for (const src of [mutationSrc, readSrc]) {
      expect(src).not.toMatch(/@ResolveField[\s\S]*\bcustomer\b/);
      expect(src).not.toMatch(/@ResolveField[\s\S]*\bproperty\b/);
      expect(src).not.toMatch(/@ResolveField[\s\S]*\bservice\b/);
      expect(src).not.toMatch(/@ResolveField[\s\S]*\bteam\b/);
    }
  });

  it('application/domain/REST layers do not read or assign Booking relation properties', () => {
    const roots = [
      join(__dirname, '../../domain'),
      join(__dirname, '../../application'),
      join(__dirname, '../../presentation/rest'),
    ];
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (full.endsWith('.ts')) {
          files.push(full);
        }
      }
    };
    for (const root of roots) {
      walk(root);
    }

    const relationProp =
      /\b(?:booking|entity|existing|removed|row|record)\.(customer|property|service|team)(?![A-Za-z])/;
    for (const file of files) {
      const src = readFileSync(file, 'utf8')
        .split('\n')
        .filter((line) => !/^\s*(\/\/|\*|import\s)/.test(line))
        .join('\n');
      expect(src).not.toMatch(relationProp);
    }
  });
});
