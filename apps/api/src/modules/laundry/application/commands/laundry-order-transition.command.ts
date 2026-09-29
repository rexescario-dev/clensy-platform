// Shared shape for the payload-free status-transition verbs
// (markAwaitingPayment, markPaid, startProcessing, markReady,
// markAwaitingPickup, markAwaitingDelivery, complete, cancel, reject,
// markLost, markDamaged, refund).
export interface LaundryOrderTransitionCommand {
  actorId: string;
  orderId: string;
  // The principal's tenant (`requireTenantId`, #87 slice decision 8). The
  // order is locked by `{ id, tenantId }`, so another tenant's order is a
  // missing order (slice decision 7).
  tenantId: string;
}
