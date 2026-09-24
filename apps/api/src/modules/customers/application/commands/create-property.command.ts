export interface CreatePropertyCommand {
  actorId: string;
  // Owning tenant (#82; RFC §4.5). Server-derived from the principal
  // (`requireTenantId`) — never client input. Must match `customerId`'s
  // tenant (enforced by the `create` customer lookup and, at the DB level,
  // by `fk_property_customer_tenant`).
  tenantId: string;
  customerId: string;
  label: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  region: string;
  postalCode: string;
  accessNotes?: string | null;
}
