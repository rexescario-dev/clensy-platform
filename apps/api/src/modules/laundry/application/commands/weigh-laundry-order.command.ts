export interface WeighLaundryOrderCommand {
  actorId: string;
  orderId: string;
  // Non-negative integer grams (spec §4.2). `0` is permitted.
  weightGrams: number;
}
