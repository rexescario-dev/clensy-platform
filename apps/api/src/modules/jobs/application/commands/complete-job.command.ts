// `tenantId` comes from `requireTenantId(currentUser)` in `JobResolver`
// (#86 Slice decision 9) — never from client input.
export interface CompleteJobCommand {
  actorId: string;
  jobId: string;
  tenantId: string;
}
