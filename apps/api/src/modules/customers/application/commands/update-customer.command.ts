// Partial-update semantics (spec §4.2): all fields except `actorId` and
// `tenantId` are optional. An omitted key retains the customer's current
// value; a provided key (including `notes: null`) is applied.
// `CustomersService.update` destructures `actorId` and `tenantId` out before
// `Object.assign(entity, fields)` — `tenantId` scopes the lookup (server-
// derived from the principal via `requireTenantId`, never client input) but,
// like `actorId`, is not itself a writable `Customer` field.
export interface UpdateCustomerCommand {
  actorId: string;
  tenantId: string;
  fullName?: string;
  email?: string;
  phone?: string;
  notes?: string | null;
}
