import type { StatusTone } from '@clensy/ui';

// Stable laundry identifiers, declared locally (not imported from
// @clensy/client) to keep @clensy/web free of the GraphQL client — the
// `AdminRole` precedent. apps/web pins them to the generated client types
// (`apps/web/lib/laundry-presentation-contract.test.ts`).
export type LaundryOrderStatus =
  | 'AWAITING_DELIVERY'
  | 'AWAITING_PAYMENT'
  | 'AWAITING_PICKUP'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'DAMAGED'
  | 'LOST'
  | 'PAID'
  | 'PRICED'
  | 'PROCESSING'
  | 'READY'
  | 'RECEIVED'
  | 'REFUNDED'
  | 'REJECTED'
  | 'WEIGHED';

export type LaundryFulfillmentType = 'DELIVERY' | 'PICKUP';

// Accepted lifecycle spec §4.9 badge tones.
export const LAUNDRY_STATUS_TONE: Readonly<Record<LaundryOrderStatus, StatusTone>> = {
  AWAITING_DELIVERY: 'warning',
  AWAITING_PAYMENT: 'neutral',
  AWAITING_PICKUP: 'warning',
  CANCELLED: 'danger',
  COMPLETED: 'success',
  DAMAGED: 'danger',
  LOST: 'danger',
  PAID: 'warning',
  PRICED: 'neutral',
  PROCESSING: 'warning',
  READY: 'warning',
  RECEIVED: 'neutral',
  REFUNDED: 'danger',
  REJECTED: 'danger',
  WEIGHED: 'neutral',
};

export const LAUNDRY_ORDER_STATUSES = Object.keys(LAUNDRY_STATUS_TONE) as readonly LaundryOrderStatus[];
