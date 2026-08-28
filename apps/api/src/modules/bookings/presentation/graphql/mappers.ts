import { Booking } from '../../domain/booking';
import { BookingDTO } from './booking.dto';

// Mutation/Jobs return path: identity + scalars only. Relatable fills
// customer/property/service/team when those fields are selected. FK ids
// stay on the runtime object so Jobs nested parents can still load from
// them (jobs { booking { id } } stays Jobs-owned).
export function toBookingDto(booking: Booking): BookingDTO {
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
  } as unknown as BookingDTO;
}
