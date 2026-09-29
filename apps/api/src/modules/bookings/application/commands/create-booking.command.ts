// `tenantId` is the caller's tenant from `requireTenantId(currentUser)`
// (GraphQL and REST alike, #85 Slice decisions 3, 7); never from client
// input (I-2).
export interface CreateBookingCommand {
  actorId: string;
  tenantId: string;
  customerId: string;
  propertyId: string;
  serviceId: string;
  teamId?: string | null;
  scheduledAt: Date;
}
