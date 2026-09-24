export interface CreateCustomerCommand {
  actorId: string;
  // Owning tenant (#82; RFC §4.5). Server-derived from the principal
  // (`requireTenantId`) — never client input.
  tenantId: string;
  fullName: string;
  email: string;
  phone: string;
  notes?: string | null;
}
