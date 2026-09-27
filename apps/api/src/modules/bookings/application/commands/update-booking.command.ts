import { BookingStatus } from '../../domain/booking-status';

// No `customerId`/`propertyId`/`serviceId` — immutable after creation
// (spec §4.1, §4.2). `teamId` is nullable and mutable: omitted retains the
// current value, explicit `null` clears it, a string reassigns it.
// `actorId` is nullable for the same REST-audit-suppression reason as
// `CreateBookingCommand` (spec §4.4).
//
// `tenantId` is nullable too, for the same reason as `CreateBookingCommand`
// (#82 Slice decision 4, extended by #83 Slice decision 6): GraphQL passes
// the principal's tenant; the unauthenticated REST controller passes
// `null`, which `TeamsService.getTeam` treats as "no tenant scope" and
// never resolves a row for — a non-null `teamId` therefore fails closed
// with the existing `NotFoundException`. It is consumed only by the
// `teamId` lookup in `BookingsService.update` and never reaches
// `manager.update()` (`booking_entity` has no `tenantId` column until #85).
export interface UpdateBookingCommand {
  actorId: string | null;
  tenantId: string | null;
  scheduledAt?: Date;
  status?: BookingStatus;
  teamId?: string | null;
}
