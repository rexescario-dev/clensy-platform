import { GUARDS_METADATA } from '@nestjs/common/constants';
import { getMetadataStorage } from 'class-validator';
import { BookingController } from '../../presentation/rest/booking.controller';
import { UpdateBookingDto } from '../../presentation/rest/update-booking.dto';

// Same technique as the GraphQL resolver specs (e.g.
// `cleaner.resolver.spec.ts`): reads the method's own function value off
// the prototype — the exact function reference `@UseGuards()` would attach
// `Reflect` metadata to, if it were ever added here by mistake.
type ControllerMethod = 'create' | 'findAll' | 'findOne' | 'update' | 'remove';

function methodRef(method: ControllerMethod): (...args: unknown[]) => unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    BookingController.prototype,
    method,
  );
  return descriptor!.value as (...args: unknown[]) => unknown;
}

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
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };
    controller = new BookingController(bookingsService as never);
  });

  it.each<ControllerMethod>([
    'create',
    'findAll',
    'findOne',
    'update',
    'remove',
  ])(
    'carries no AuthGuard/@UseGuards metadata on %s (REST unauthenticated posture, spec §4.4)',
    (method) => {
      expect(
        Reflect.getMetadata(GUARDS_METADATA, methodRef(method)),
      ).toBeUndefined();
    },
  );

  it('create maps every DTO field into the command via spread, with actorId: null', () => {
    const scheduledAt = new Date('2026-09-01T09:00:00Z');
    void controller.create({
      customerId: 'customer-1',
      propertyId: 'property-1',
      serviceId: 'service-1',
      teamId: 'team-1',
      scheduledAt,
    });

    expect(bookingsService.create).toHaveBeenCalledWith({
      customerId: 'customer-1',
      propertyId: 'property-1',
      serviceId: 'service-1',
      teamId: 'team-1',
      scheduledAt,
      actorId: null,
    });
  });

  it('update maps every DTO field into the command via spread, with actorId: null', () => {
    const scheduledAt = new Date('2026-09-01T09:00:00Z');
    void controller.update('booking-1', { scheduledAt, teamId: null });

    expect(bookingsService.update).toHaveBeenCalledWith('booking-1', {
      scheduledAt,
      teamId: null,
      actorId: null,
    });
  });

  it('remove calls BookingsService.remove(id, null)', () => {
    void controller.remove('booking-1');

    expect(bookingsService.remove).toHaveBeenCalledWith('booking-1', null);
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
