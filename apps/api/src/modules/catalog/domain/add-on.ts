// Plain domain interface for an `AddOn` Clensy sells (spec §4.1). AddOn is a
// fully independent domain object — global add-ons, not scoped to any
// `Service`. Catalog reads are unfiltered — `active: false` add-ons still
// round-trip through `listAddOns` unchanged; filtering-by-active is a
// presentation-layer concern, not a domain- or persistence-layer one.
export interface AddOn {
  id: string;
  name: string;
  description: string | null;
  priceMinorUnits: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}
