// `tenantId` comes from `requireTenantId(currentUser)` in `JobResolver`
// (#86 Slice decision 9) — never from client input. The job, its
// checklist and the item are all resolved within it (#86 Slice decision 7).
export interface CompleteChecklistItemCommand {
  actorId: string;
  jobId: string;
  itemId: string;
  tenantId: string;
}
