import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import {
  GraphQLSchemaBuilderModule,
  GraphQLSchemaFactory,
} from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { GraphQLEnumType, GraphQLObjectType } from 'graphql';
import { PLATFORM_PAGE_DEFAULT } from '../../../../platform/graphql/paging';
import { ROLES_KEY } from '../../../../platform/auth/decorators/roles.decorator';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CustomerResolver } from '../../../customers/presentation/graphql/customer.resolver';
import { PropertyResolver } from '../../../customers/presentation/graphql/property.resolver';
import { ServiceResolver } from '../../../catalog/presentation/graphql/service.resolver';
import { TeamResolver } from '../../../cleaners/presentation/graphql/team.resolver';
import { BookingReadResolver } from '../../presentation/graphql/booking-read.resolver';
import { BookingMutationResolver } from '../../presentation/graphql/booking.resolver';

type MutationMethod = 'createBooking' | 'updateBooking' | 'removeBooking';
type ReadMethod = 'findById' | 'queryMany';

const VIEW_ROLES = [
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];
const WRITE_ROLES = [
  Role.OWNER,
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

      const connection = schema.getType('BookingConnection') as GraphQLObjectType;
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
      const sortFieldNames = sortFields.getValues().map((value) => value.name);
      expect(sortFieldNames).toEqual(expect.arrayContaining(['id', 'scheduledAt']));

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

  describe('mutation actorId wiring', () => {
    it('createBooking/updateBooking/removeBooking always pass a non-null actorId', async () => {
      const bookingsService = {
        create: jest.fn().mockResolvedValue({
          id: 'booking-1',
          pricingSnapshot: { priceMinorUnits: 1 },
        }),
        update: jest.fn().mockResolvedValue({
          id: 'booking-1',
          pricingSnapshot: { priceMinorUnits: 1 },
        }),
        remove: jest.fn().mockResolvedValue({
          id: 'booking-1',
          pricingSnapshot: { priceMinorUnits: 1 },
        }),
      };
      const resolver = new BookingMutationResolver(bookingsService as never);
      const currentUser = { id: 'admin-1', role: Role.OWNER };

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
        expect.objectContaining({ actorId: 'admin-1' }),
      );

      await resolver.updateBooking(
        { id: 'booking-1', scheduledAt: new Date() },
        currentUser,
      );
      expect(bookingsService.update).toHaveBeenCalledWith(
        'booking-1',
        expect.objectContaining({ actorId: 'admin-1' }),
      );

      await resolver.removeBooking('booking-1', currentUser);
      expect(bookingsService.remove).toHaveBeenCalledWith(
        'booking-1',
        'admin-1',
      );
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
