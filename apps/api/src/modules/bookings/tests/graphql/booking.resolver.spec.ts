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
import { CustomerResolver } from '../../../customers/presentation/graphql/customer.resolver';
import { PropertyResolver } from '../../../customers/presentation/graphql/property.resolver';
import { ServiceResolver } from '../../../catalog/presentation/graphql/service.resolver';
import { TeamResolver } from '../../../cleaners/presentation/graphql/team.resolver';
import { BookingResolver } from '../../presentation/graphql/booking.resolver';
import { BookingType } from '../../presentation/graphql/booking.type';

type ResolverMethod =
  'booking' | 'bookings' | 'createBooking' | 'updateBooking' | 'removeBooking';

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

function methodRef(method: ResolverMethod): (...args: unknown[]) => unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    BookingResolver.prototype,
    method,
  );
  return descriptor!.value as (...args: unknown[]) => unknown;
}

describe('BookingResolver', () => {
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
    ['booking', VIEW_ROLES],
    ['bookings', VIEW_ROLES],
  ] as const)('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — view matrix`, () => {
      expect(guardsOn(method)).toContain(AuthGuard);
      expect(rolesOn(method)).toEqual(expectedRoles);
    });
  });

  describe.each([
    ['createBooking', WRITE_ROLES],
    ['updateBooking', WRITE_ROLES],
    ['removeBooking', WRITE_ROLES],
  ] as const)('%s', (method, expectedRoles) => {
    it(`is guarded by AuthGuard and @Roles(${expectedRoles.join(', ')}) — write matrix`, () => {
      expect(guardsOn(method)).toContain(AuthGuard);
      expect(rolesOn(method)).toEqual(expectedRoles);
    });
  });

  // Builds the actual GraphQL schema from the full resolver set
  // `BookingType` transitively references (same `GraphQLSchemaFactory`
  // recipe as `cleaner.resolver.spec.ts`/`pricing-rule.resolver.spec.ts`) —
  // this both proves the schema is buildable and is what actually
  // populates `TypeMetadataStorage`'s lazy field metadata.
  describe('BookingType (schema field set)', () => {
    it('exposes exactly id, scheduledAt, status, pricingSnapshot, customer, property, service, team, createdAt', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [GraphQLSchemaBuilderModule],
      }).compile();
      const schemaFactory = moduleRef.get(GraphQLSchemaFactory);
      const schema = await schemaFactory.create([
        BookingResolver,
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
      // Belt-and-suspenders (plan §3/Task 4): `customerId`/`propertyId`/
      // `serviceId`/`teamId` must never appear in the public schema, even
      // though `toBookingType()` puts them on the runtime object for the
      // four `@ResolveField()`s to read.
      expect(fieldNames).not.toContain('customerId');
      expect(fieldNames).not.toContain('propertyId');
      expect(fieldNames).not.toContain('serviceId');
      expect(fieldNames).not.toContain('teamId');
    });
  });

  it('BookingType metadata has no customerId/propertyId/serviceId/teamId field', () => {
    const metadata =
      TypeMetadataStorage.getObjectTypeMetadataByTarget(BookingType);
    const fieldNames = (metadata?.properties ?? []).map(
      (property) => property.name,
    );

    expect(fieldNames).not.toContain('customerId');
    expect(fieldNames).not.toContain('propertyId');
    expect(fieldNames).not.toContain('serviceId');
    expect(fieldNames).not.toContain('teamId');
  });

  describe('resolve fields', () => {
    function makeResolver(
      loaders: Record<string, { load: jest.Mock }>,
    ): BookingResolver {
      return new BookingResolver({} as never, loaders as never);
    }

    it('customer calls loaders.customerLoader.load exactly once with the parent id', async () => {
      const customer = {
        id: 'customer-1',
        fullName: 'Jane',
        email: 'j@x.com',
        phone: '1',
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const loaders = {
        customerLoader: { load: jest.fn().mockResolvedValue(customer) },
      };
      const resolver = makeResolver(loaders);

      await resolver.customer({ customerId: 'customer-1' });

      expect(loaders.customerLoader.load).toHaveBeenCalledTimes(1);
      expect(loaders.customerLoader.load).toHaveBeenCalledWith('customer-1');
    });

    it('property calls loaders.propertyLoader.load exactly once with the parent id', async () => {
      const property = {
        id: 'property-1',
        customerId: 'customer-1',
        label: 'Home',
        addressLine1: '1 Main St',
        addressLine2: null,
        city: 'City',
        region: 'Region',
        postalCode: '0000',
        accessNotes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const loaders = {
        propertyLoader: { load: jest.fn().mockResolvedValue(property) },
      };
      const resolver = makeResolver(loaders);

      await resolver.property({ propertyId: 'property-1' });

      expect(loaders.propertyLoader.load).toHaveBeenCalledTimes(1);
      expect(loaders.propertyLoader.load).toHaveBeenCalledWith('property-1');
    });

    it('service calls loaders.serviceLoader.load exactly once with the parent id', async () => {
      const service = {
        id: 'service-1',
        name: 'Standard Clean',
        description: null,
        durationMinutes: 60,
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const loaders = {
        serviceLoader: { load: jest.fn().mockResolvedValue(service) },
      };
      const resolver = makeResolver(loaders);

      await resolver.service({ serviceId: 'service-1' });

      expect(loaders.serviceLoader.load).toHaveBeenCalledTimes(1);
      expect(loaders.serviceLoader.load).toHaveBeenCalledWith('service-1');
    });

    it('team returns null synchronously and never calls loaders.teamLoader.load when teamId is null', async () => {
      const loaders = { teamLoader: { load: jest.fn() } };
      const resolver = makeResolver(loaders);

      await expect(resolver.team({ teamId: null })).resolves.toBeNull();
      expect(loaders.teamLoader.load).not.toHaveBeenCalled();
    });

    it('team calls loaders.teamLoader.load exactly once with the parent id when teamId is set', async () => {
      const team = {
        id: 'team-1',
        name: 'Team A',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const loaders = {
        teamLoader: { load: jest.fn().mockResolvedValue(team) },
      };
      const resolver = makeResolver(loaders);

      await resolver.team({ teamId: 'team-1' });

      expect(loaders.teamLoader.load).toHaveBeenCalledTimes(1);
      expect(loaders.teamLoader.load).toHaveBeenCalledWith('team-1');
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
      const resolver = new BookingResolver(
        bookingsService as never,
        {} as never,
      );
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
});
