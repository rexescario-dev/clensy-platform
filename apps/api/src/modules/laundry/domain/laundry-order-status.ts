// The operational lifecycle state of a `LaundryOrder` (spec §4.3). Every
// legal transition between these values is defined by the matrix in
// `LaundryOrderStatusTransitionPolicy` — a bare enum assignment is never a
// valid way to change an order's status.
export enum LaundryOrderStatus {
  RECEIVED = 'RECEIVED',
  WEIGHED = 'WEIGHED',
  PRICED = 'PRICED',
  AWAITING_PAYMENT = 'AWAITING_PAYMENT',
  PAID = 'PAID',
  PROCESSING = 'PROCESSING',
  READY = 'READY',
  AWAITING_PICKUP = 'AWAITING_PICKUP',
  AWAITING_DELIVERY = 'AWAITING_DELIVERY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
  LOST = 'LOST',
  DAMAGED = 'DAMAGED',
  REFUNDED = 'REFUNDED',
}
