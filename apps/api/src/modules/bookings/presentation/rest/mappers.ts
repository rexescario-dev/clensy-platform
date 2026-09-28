import { Booking } from '../../domain/booking';

// REST response shape is unchanged by #85 (Slice decision 3): the owning
// tenant is the caller's own and is not part of the REST contract.
export function toBookingResponse(booking: Booking): Omit<Booking, 'tenantId'> {
  const { tenantId, ...response } = booking;
  void tenantId;
  return response;
}
