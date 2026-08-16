// Plain domain interface for a group of cleaners that can be assigned
// bookings together (spec §4.1). No `cleaners` field — `Cleaner` is reached
// only through `CleanersService` (Task 2), never a domain- or ORM-level
// relation here, mirroring `Customer`'s deliberate omission of `properties`.
export interface Team {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
