// Partial-update semantics (spec §4.2): all fields except `actorId` and
// `tenantId` are optional. An omitted key retains the property's current
// value; a provided key (including `accessNotes: null`) is applied. No
// `customerId` field — immutable after creation; reassigning a property to a
// different customer is not an operation this slice supports.
// `PropertiesService.update` destructures `actorId` and `tenantId` out
// before `Object.assign(entity, fields)` — `tenantId` scopes the lookup
// (server-derived from the principal via `requireTenantId`, never client
// input) but, like `actorId`, is not itself a writable `Property` field.
// Safe only because this command is built by the resolver via spread — it
// never carries keys the caller didn't actually provide.
export interface UpdatePropertyCommand {
  actorId: string;
  tenantId: string;
  label?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  region?: string;
  postalCode?: string;
  accessNotes?: string | null;
}
