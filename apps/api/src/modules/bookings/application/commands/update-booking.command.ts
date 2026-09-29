import { BookingStatus } from '../../domain/booking-status';

// No `customerId`/`propertyId`/`serviceId` — immutable after creation
// (spec §4.1, §4.2). `teamId` is nullable and mutable: omitted retains the
// current value, explicit `null` clears it, a string reassigns it.
//
// `tenantId` is the caller's tenant from `requireTenantId(currentUser)`
// (GraphQL and REST alike, #85 Slice decisions 3, 7); never from client
// input (I-2). It is used both for the `teamId` lookup in
// `BookingsService.update` and as part of the row's WHERE predicate; it
// never reaches `manager.update()`'s SET list — `tenantId` is the row's
// owner, never a change.
export interface UpdateBookingCommand {
  actorId: string;
  tenantId: string;
  scheduledAt?: Date;
  status?: BookingStatus;
  teamId?: string | null;
}
