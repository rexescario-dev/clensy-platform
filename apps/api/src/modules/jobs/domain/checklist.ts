// 1:1 companion of `CleaningJob`. Items are not a collection field on this
// object (spec §4.1) — they are `ChecklistItem` children loaded separately.
// `tenantId` (#86) always equals its job's (`fk_checklist_job_tenant`);
// items have no tenant of their own and are owned via this checklist
// (#86 slice decision 2).
export interface Checklist {
  id: string;
  tenantId: string;
  jobId: string;
  createdAt: Date;
}
