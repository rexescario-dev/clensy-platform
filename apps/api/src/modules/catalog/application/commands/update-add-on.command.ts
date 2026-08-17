export interface UpdateAddOnCommand {
  actorId: string;
  name?: string;
  description?: string | null;
  priceMinorUnits?: number;
  active?: boolean;
}
