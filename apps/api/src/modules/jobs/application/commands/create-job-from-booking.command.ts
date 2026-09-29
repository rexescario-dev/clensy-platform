// `tenantId` comes from `requireTenantId(currentUser)` in `JobResolver`
// (#85 Slice decision 11) — never optional, unlike Bookings' REST-facing
// commands: Jobs has no unauthenticated surface, so every caller has a
// principal and (per `requireTenantId`) a non-null tenant.
export interface CreateJobFromBookingCommand {
  actorId: string;
  bookingId: string;
  tenantId: string;
}
