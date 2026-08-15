// Plain domain interface for a physical address a `Customer` wants cleaned
// (spec §4.1). Always belongs to exactly one `Customer` (`customerId`); has
// no lifecycle independent of its owning `Customer` (Phase 1 Design §2.3).
// `customerId` is immutable after creation — not present on
// `UpdatePropertyCommand` at all (spec §4.2).
export interface Property {
  id: string;
  customerId: string;
  label: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  region: string;
  postalCode: string;
  accessNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
