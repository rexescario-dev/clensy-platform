import { Booking } from '../../domain/booking';
import { BookingType } from './booking.type';

// `customer`/`property`/`service`/`team` are presentation-layer-only
// computed data (spec §4.5), populated exclusively by `BookingResolver`'s
// `@ResolveField()` methods — Apollo calls those field resolvers for those
// keys independently of whatever this mapper's return value carries for
// them, mirroring `toCleanerType`'s `team: null` placeholder pattern.
// Also carries `customerId`/`propertyId`/`serviceId`/`teamId` on the
// runtime object even though `BookingType`'s declared fields (and
// therefore the public GraphQL schema) omit them — `@Field()` decorators
// control schema exposure, not what a resolver's `@Parent()` can read off
// the actual object; the four `@ResolveField()` methods below need these
// ids to load from, exactly the mechanism `toCleanerType`'s own comment
// documents for `teamId`.
export function toBookingType(booking: Booking): BookingType {
  return {
    id: booking.id,
    customerId: booking.customerId,
    propertyId: booking.propertyId,
    serviceId: booking.serviceId,
    teamId: booking.teamId,
    scheduledAt: booking.scheduledAt,
    status: booking.status,
    pricingSnapshot: booking.pricingSnapshot,
    createdAt: booking.createdAt,
    customer: null,
    property: null,
    service: null,
    team: null,
  } as unknown as BookingType;
}
