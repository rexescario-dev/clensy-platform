import type { AdminRole } from '../roles/admin-roles';
import type { LaundryFulfillmentType, LaundryOrderStatus } from './laundry-order-status';

// Every order-scoped laundry verb a screen can offer. `receive` is not
// order-scoped; see `canReceiveLaundryOrder`.
export type LaundryOrderVerb =
  | 'cancel'
  | 'complete'
  | 'generateInvoice'
  | 'markAwaitingDelivery'
  | 'markAwaitingPayment'
  | 'markAwaitingPickup'
  | 'markDamaged'
  | 'markLost'
  | 'markPaid'
  | 'markReady'
  | 'price'
  | 'refund'
  | 'reject'
  | 'startProcessing'
  | 'weigh';

// Presentation order: forward lifecycle first, destructive last.
export const LAUNDRY_ORDER_VERBS: readonly LaundryOrderVerb[] = [
  'weigh',
  'price',
  'markAwaitingPayment',
  'markPaid',
  'startProcessing',
  'markReady',
  'markAwaitingPickup',
  'markAwaitingDelivery',
  'complete',
  'generateInvoice',
  'cancel',
  'reject',
  'markLost',
  'markDamaged',
  'refund',
];

// Verbs whose confirmation copy lives under `laundry.confirm`.
export const LAUNDRY_DESTRUCTIVE_VERBS: ReadonlySet<LaundryOrderVerb> = new Set<LaundryOrderVerb>([
  'cancel',
  'markDamaged',
  'markLost',
  'refund',
  'reject',
]);

// Client mirror of `LaundryOrderStatusTransitionPolicy` (lifecycle spec
// §4.3), plus the state-preserving re-weigh of a `WEIGHED` order (§4.4).
// Presentation only: the server re-checks every verb.
const LEGAL_VERBS: Readonly<Record<LaundryOrderStatus, readonly LaundryOrderVerb[]>> = {
  AWAITING_DELIVERY: ['complete', 'markLost', 'markDamaged', 'refund'],
  AWAITING_PAYMENT: ['markPaid', 'cancel'],
  AWAITING_PICKUP: ['complete', 'markLost', 'markDamaged', 'refund'],
  CANCELLED: [],
  COMPLETED: ['refund'],
  DAMAGED: ['refund'],
  LOST: ['refund'],
  PAID: ['startProcessing', 'refund'],
  PRICED: ['markAwaitingPayment', 'markPaid', 'cancel'],
  PROCESSING: ['markReady', 'markLost', 'markDamaged', 'refund'],
  READY: ['markAwaitingPickup', 'markAwaitingDelivery', 'markLost', 'markDamaged', 'refund'],
  RECEIVED: ['weigh', 'reject', 'cancel'],
  REFUNDED: [],
  REJECTED: [],
  WEIGHED: ['weigh', 'price', 'reject', 'cancel'],
};

// Invoice eligibility (laundry invoices spec §4.3): PRICED through
// COMPLETED, excluding the exceptional exits. Whether an invoice already
// exists is the screen's check; this helper only sees the order.
const INVOICEABLE: ReadonlySet<LaundryOrderStatus> = new Set<LaundryOrderStatus>([
  'AWAITING_DELIVERY',
  'AWAITING_PAYMENT',
  'AWAITING_PICKUP',
  'COMPLETED',
  'PAID',
  'PRICED',
  'PROCESSING',
  'READY',
]);

// Role sets exactly as `laundry-order.resolver.ts` and
// `invoice.resolver.ts` implement them. Do not widen.
const OPERATIONAL: readonly AdminRole[] = ['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER'];
const INTAKE: readonly AdminRole[] = [...OPERATIONAL, 'CUSTOMER_SUPPORT'];
const PAYMENT: readonly AdminRole[] = ['TENANT_OWNER', 'OPS_MANAGER', 'FINANCE', 'CUSTOMER_SUPPORT'];
const CANCEL: readonly AdminRole[] = ['TENANT_OWNER', 'OPS_MANAGER', 'CUSTOMER_SUPPORT'];
const EXCEPTION: readonly AdminRole[] = ['TENANT_OWNER', 'OPS_MANAGER'];
const REFUND: readonly AdminRole[] = ['TENANT_OWNER', 'OPS_MANAGER', 'FINANCE'];
const INVOICE: readonly AdminRole[] = ['FINANCE', 'TENANT_OWNER'];

const VERB_ROLES: Readonly<Record<LaundryOrderVerb, readonly AdminRole[]>> = {
  cancel: CANCEL,
  complete: INTAKE,
  generateInvoice: INVOICE,
  markAwaitingDelivery: OPERATIONAL,
  markAwaitingPayment: PAYMENT,
  markAwaitingPickup: OPERATIONAL,
  markDamaged: EXCEPTION,
  markLost: EXCEPTION,
  markPaid: PAYMENT,
  markReady: OPERATIONAL,
  price: OPERATIONAL,
  refund: REFUND,
  reject: EXCEPTION,
  startProcessing: OPERATIONAL,
  weigh: OPERATIONAL,
};

// Intake is not order-scoped, so it is not a `laundryOrderActions` verb.
export function canReceiveLaundryOrder(role: AdminRole | undefined): boolean {
  return role !== undefined && INTAKE.includes(role);
}

// The verbs a screen may show: matrix-legal ∩ fulfillment branch ∩ the
// actor's role (lifecycle spec §4.9, Amendment #164 §8.4.4), in
// `LAUNDRY_ORDER_VERBS` order. A missing role (still loading) sees nothing.
export function laundryOrderActions(
  status: LaundryOrderStatus,
  fulfillmentType: LaundryFulfillmentType,
  role: AdminRole | undefined,
): LaundryOrderVerb[] {
  if (role === undefined) return [];
  return LAUNDRY_ORDER_VERBS.filter((verb) => {
    const legal = verb === 'generateInvoice' ? INVOICEABLE.has(status) : LEGAL_VERBS[status].includes(verb);
    if (!legal || !VERB_ROLES[verb].includes(role)) return false;
    if (verb === 'markAwaitingPickup') return fulfillmentType === 'PICKUP';
    if (verb === 'markAwaitingDelivery') return fulfillmentType === 'DELIVERY';
    return true;
  });
}
