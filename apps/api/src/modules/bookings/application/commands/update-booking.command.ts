import { BookingStatus } from '../../domain/booking-status';

// No `customerId`/`propertyId`/`serviceId` — immutable after creation
// (spec §4.1, §4.2). `teamId` is nullable and mutable: omitted retains the
// current value, explicit `null` clears it, a string reassigns it.
// `actorId` is nullable for the same REST-audit-suppression reason as
// `CreateBookingCommand` (spec §4.4).
export interface UpdateBookingCommand {
  actorId: string | null;
  scheduledAt?: Date;
  status?: BookingStatus;
  teamId?: string | null;
}
