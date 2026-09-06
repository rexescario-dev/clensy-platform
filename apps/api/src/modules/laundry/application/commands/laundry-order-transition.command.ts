// Shared shape for the payload-free status-transition verbs
// (markAwaitingPayment, markPaid, startProcessing, markReady,
// markAwaitingPickup, markAwaitingDelivery, complete, cancel, reject,
// markLost, markDamaged, refund).
export interface LaundryOrderTransitionCommand {
  actorId: string;
  orderId: string;
}
