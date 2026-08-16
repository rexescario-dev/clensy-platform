// Plain domain interface for a cleaner staff member who can be assigned to a
// `Team` (spec §4.1). `teamId` is a plain nullable field, not a resolved
// `Team` reference — `Team` is reached only through `TeamsService`
// (Task 1)/Task 3's loader, never a domain- or ORM-level relation here,
// mirroring `Property.customerId`'s precedent.
export interface Cleaner {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  notes: string | null;
  teamId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
