import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { getMetadataStorage } from 'class-validator';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { ROLES_KEY } from '../../../../platform/auth/decorators/roles.decorator';
import {
  VIEW_ROLES,
  WRITE_ROLES,
} from '../../presentation/graphql/booking.dto';
import { BookingController } from '../../presentation/rest/booking.controller';
import { UpdateBookingDto } from '../../presentation/rest/update-booking.dto';

// Same technique as the GraphQL resolver specs (e.g.
// `booking.resolver.spec.ts`): reads the method's own function value off
// the prototype — the exact function reference `@Roles()` would attach
// `Reflect` metadata to.
type ControllerMethod = 'create' | 'findAll' | 'findOne' | 'remove' | 'update';

function methodRef(method: ControllerMethod): (...args: unknown[]) => unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    BookingController.prototype,
    method,
  );
  return descriptor!.value as (...args: unknown[]) => unknown;
}

const tenantPrincipal: AuthenticatedPrincipal = {
  id: 'admin-1',
  tenantId: 'tenant-1',
  role: Role.TENANT_OWNER,
  scope: AdminScope.TENANT,
};

const noTenantPrincipal: AuthenticatedPrincipal = {
  id: 'admin-1',
  tenantId: null,
  role: Role.TENANT_OWNER,
  scope: AdminScope.PLATFORM,
};

const bookingRecord = {
  id: 'booking-1',
  customerId: 'customer-1',
  propertyId: 'property-1',
  serviceId: 'service-1',
  teamId: 'team-1',
  tenantId: 'tenant-1',
  createdAt: new Date('2026-08-01T00:00:00Z'),
  pricingSnapshot: { priceMinorUnits: 1000 },
  scheduledAt: new Date('2026-09-01T09:00:00Z'),
  status: 'PENDING',
};

describe('BookingController', () => {
  let bookingsService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };
  let controller: BookingController;

  beforeEach(() => {
    bookingsService = {
      create: jest.fn().mockResolvedValue(bookingRecord),
      findAll: jest.fn().mockResolvedValue([bookingRecord]),
      findOne: jest.fn().mockResolvedValue(bookingRecord),
      remove: jest.fn().mockResolvedValue(bookingRecord),
      update: jest.fn().mockResolvedValue(bookingRecord),
    };
    controller = new BookingController(bookingsService as never);
  });

  it('carries AuthGuard as class-level metadata (every route is authenticated, #85 Slice decision 3)', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, BookingController) as
      unknown[] | undefined;
    expect(guards ?? []).toContain(AuthGuard);
  });

  it.each<[ControllerMethod, Role[]]>([
    ['findAll', VIEW_ROLES],
    ['findOne', VIEW_ROLES],
    ['create', WRITE_ROLES],
    ['update', WRITE_ROLES],
    ['remove', WRITE_ROLES],
  ])(
    '%s requires %s (same role sets GraphQL uses)',
    (method, expectedRoles) => {
      expect(Reflect.getMetadata(ROLES_KEY, methodRef(method))).toEqual(
        expectedRoles,
      );
    },
  );

  it('create maps the DTO and principal into the command', async () => {
    const scheduledAt = new Date('2026-09-01T09:00:00Z');
    await controller.create(
      {
        customerId: 'customer-1',
        propertyId: 'property-1',
        serviceId: 'service-1',
        teamId: 'team-1',
        scheduledAt,
      },
      tenantPrincipal,
    );

    expect(bookingsService.create).toHaveBeenCalledWith({
      actorId: 'admin-1',
      customerId: 'customer-1',
      propertyId: 'property-1',
      serviceId: 'service-1',
      teamId: 'team-1',
      tenantId: 'tenant-1',
      scheduledAt,
    });
  });

  it('findAll calls BookingsService.findAll(principal.tenantId)', async () => {
    await controller.findAll(tenantPrincipal);

    expect(bookingsService.findAll).toHaveBeenCalledWith('tenant-1');
  });

  it('findOne calls BookingsService.findOne(id, principal.tenantId)', async () => {
    await controller.findOne('booking-1', tenantPrincipal);

    expect(bookingsService.findOne).toHaveBeenCalledWith(
      'booking-1',
      'tenant-1',
    );
  });

  it('update maps the DTO and principal into the command', async () => {
    const scheduledAt = new Date('2026-09-01T09:00:00Z');
    await controller.update(
      'booking-1',
      { scheduledAt, teamId: null },
      tenantPrincipal,
    );

    expect(bookingsService.update).toHaveBeenCalledWith('booking-1', {
      actorId: 'admin-1',
      teamId: null,
      tenantId: 'tenant-1',
      scheduledAt,
    });
  });

  it('remove calls BookingsService.remove(id, principal.id, principal.tenantId)', async () => {
    await controller.remove('booking-1', tenantPrincipal);

    expect(bookingsService.remove).toHaveBeenCalledWith(
      'booking-1',
      'admin-1',
      'tenant-1',
    );
  });

  describe('null tenant', () => {
    it.each<ControllerMethod>([
      'create',
      'findAll',
      'findOne',
      'update',
      'remove',
    ])(
      '%s is forbidden without a principal tenant, and the service is never called',
      async (method) => {
        const call =
          method === 'create'
            ? controller.create(
                {
                  customerId: 'c1',
                  propertyId: 'p1',
                  serviceId: 's1',
                  scheduledAt: new Date(),
                },
                noTenantPrincipal,
              )
            : method === 'findAll'
              ? controller.findAll(noTenantPrincipal)
              : method === 'findOne'
                ? controller.findOne('booking-1', noTenantPrincipal)
                : method === 'update'
                  ? controller.update(
                      'booking-1',
                      { teamId: 'team-a' },
                      noTenantPrincipal,
                    )
                  : controller.remove('booking-1', noTenantPrincipal);

        await expect(call).rejects.toBeInstanceOf(ForbiddenException);
        expect(bookingsService.create).not.toHaveBeenCalled();
        expect(bookingsService.findAll).not.toHaveBeenCalled();
        expect(bookingsService.findOne).not.toHaveBeenCalled();
        expect(bookingsService.update).not.toHaveBeenCalled();
        expect(bookingsService.remove).not.toHaveBeenCalled();
      },
    );
  });

  describe('response shape', () => {
    it('create/findOne/update/remove responses omit tenantId', async () => {
      for (const result of await Promise.all([
        controller.create(
          {
            customerId: 'customer-1',
            propertyId: 'property-1',
            serviceId: 'service-1',
            scheduledAt: new Date(),
          },
          tenantPrincipal,
        ),
        controller.findOne('booking-1', tenantPrincipal),
        controller.update('booking-1', { teamId: 'team-1' }, tenantPrincipal),
        controller.remove('booking-1', tenantPrincipal),
      ])) {
        expect(result).not.toHaveProperty('tenantId');
        expect(result).toMatchObject({ id: 'booking-1' });
      }
    });

    it('findAll maps every element to omit tenantId', async () => {
      const result = await controller.findAll(tenantPrincipal);

      expect(result).toHaveLength(1);
      for (const element of result) {
        expect(element).not.toHaveProperty('tenantId');
      }
      expect(result[0]).toMatchObject({ id: 'booking-1' });
    });
  });

  it('UpdateBookingDto has no customerId/propertyId/serviceId property (spec §4.2)', () => {
    // class-validator's metadata storage — a real introspection of every
    // property carrying a validation decorator, not merely a TS-level
    // compile-time guarantee — mirrors the belt-and-suspenders technique
    // the Catalog plan used for `PricingRuleType`'s absent `active` field.
    const propertyNames = getMetadataStorage()
      .getTargetValidationMetadatas(UpdateBookingDto, '', false, false)
      .map((metadata) => metadata.propertyName);

    expect(propertyNames).not.toContain('customerId');
    expect(propertyNames).not.toContain('propertyId');
    expect(propertyNames).not.toContain('serviceId');
    expect(propertyNames).toEqual(
      expect.arrayContaining(['scheduledAt', 'status', 'teamId']),
    );
  });
});
