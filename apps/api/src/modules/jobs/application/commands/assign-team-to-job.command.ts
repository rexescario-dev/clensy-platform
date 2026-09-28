// `tenantId` comes from `requireTenantId(currentUser)` in `JobResolver`
// (#83 Slice decision 6) — never optional, unlike Bookings' REST-facing
// commands: Jobs has no unauthenticated surface, so every caller has a
// principal and (per `requireTenantId`) a non-null tenant.
export interface AssignTeamToJobCommand {
  actorId: string;
  jobId: string;
  teamId: string;
  tenantId: string;
}
