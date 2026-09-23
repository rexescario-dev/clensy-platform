// Plain domain interface for a SaaS customer organization (multi-tenant spec
// §4.1). Deliberately minimal: slug, status/lifecycle, and any tenant
// management API are deferred by the spec.
export interface Tenant {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
