export interface CreateAddOnCommand {
  actorId: string;
  tenantId: string;
  name: string;
  description?: string | null;
  priceMinorUnits: number;
}
