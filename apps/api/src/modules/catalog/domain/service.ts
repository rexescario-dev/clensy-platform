// Plain domain interface for a `Service` Clensy sells (spec §4.1). Catalog
// reads are unfiltered — `active: false` services still round-trip through
// `getService`/`listServices` unchanged; filtering-by-active is a
// presentation-layer concern, not a domain- or persistence-layer one.
export interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
