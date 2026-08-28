// 1:1 companion of `CleaningJob`. Items are not a collection field on this
// object (spec §4.1) — they are `ChecklistItem` children loaded separately.
export interface Checklist {
  id: string;
  jobId: string;
  createdAt: Date;
}
