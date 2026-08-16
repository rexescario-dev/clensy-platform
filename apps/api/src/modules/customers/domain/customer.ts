// Plain domain interface for a person or household Clensy provides service
// to (spec §4.1). Deliberately has no `properties` field — `Property` is
// reached only through `PropertiesService.listCustomerProperties`, never a
// domain- or ORM-level relation (spec §4.1, §4.5).
export interface Customer {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}
