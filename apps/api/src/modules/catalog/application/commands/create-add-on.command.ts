export interface CreateAddOnCommand {
  actorId: string;
  name: string;
  description?: string | null;
  priceMinorUnits: number;
}
