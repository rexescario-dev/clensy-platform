export interface UpdateAddOnCommand {
  actorId: string;
  tenantId: string;
  name?: string;
  description?: string | null;
  priceMinorUnits?: number;
  active?: boolean;
}
