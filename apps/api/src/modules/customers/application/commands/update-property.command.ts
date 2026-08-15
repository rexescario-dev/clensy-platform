// Partial-update semantics (spec §4.2): all fields except `actorId` are
// optional. An omitted key retains the property's current value; a provided
// key (including `accessNotes: null`) is applied. No `customerId` field —
// immutable after creation; reassigning a property to a different customer
// is not an operation this slice supports. `PropertiesService.update` uses
// `Object.assign(entity, fields)` (after destructuring `actorId` out), which
// is safe only because this command is built by the resolver via spread — it
// never carries keys the caller didn't actually provide.
export interface UpdatePropertyCommand {
  actorId: string;
  label?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  region?: string;
  postalCode?: string;
  accessNotes?: string | null;
}
