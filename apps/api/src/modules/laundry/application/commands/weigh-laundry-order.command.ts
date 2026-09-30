export interface WeighLaundryOrderCommand {
  actorId: string;
  orderId: string;
  // The principal's tenant (`requireTenantId`, #87 slice decision 8).
  tenantId: string;
  // Non-negative integer grams (spec §4.2). `0` is permitted.
  weightGrams: number;
}
