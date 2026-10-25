import { LAUNDRY_DESTRUCTIVE_VERBS, type LaundryOrderVerb } from '@clensy/web';
import type { LaundryPaymentVerb } from './laundry-invoice-payment';
import { laundryLifecycleVerbs } from './laundry-order-page';

// The lifecycle verbs the Actions section offers as buttons (#165). Weigh
// and price are forms; generating an invoice and the two payment verbs live
// in Invoice and payment (#166).
export type LaundryActionVerb =
  | 'cancel'
  | 'complete'
  | 'markAwaitingDelivery'
  | 'markAwaitingPickup'
  | 'markDamaged'
  | 'markLost'
  | 'markReady'
  | 'refund'
  | 'reject'
  | 'startProcessing';

export interface LaundryActionFailure {
  verb: LaundryActionVerb;
  // The server's message, or null for the catalog fallback.
  message: string | null;
}

export interface LaundryActionGroups {
  // Confirmed first (lifecycle spec §8.4.4): cancel, reject, lost, damaged,
  // refund.
  destructive: LaundryActionVerb[];
  forward: LaundryActionVerb[];
}

export function isLaundryPaymentVerb(verb: LaundryActionVerb | LaundryPaymentVerb | null): verb is LaundryPaymentVerb {
  return verb === 'markPaid' || verb === 'markAwaitingPayment';
}

// Forward actions, then destructive ones, each in helper order. The verbs
// are `laundryOrderActions(...)` for the order; this only sorts them.
export function laundryActionGroups(verbs: readonly LaundryOrderVerb[]): LaundryActionGroups {
  const groups: LaundryActionGroups = { destructive: [], forward: [] };
  // `laundryLifecycleVerbs` leaves exactly the Actions verbs.
  for (const verb of laundryLifecycleVerbs(verbs) as LaundryActionVerb[]) {
    (LAUNDRY_DESTRUCTIVE_VERBS.has(verb) ? groups.destructive : groups.forward).push(verb);
  }
  return groups;
}

// The Actions alert for the transition hook's last failure. A failed payment
// verb belongs to the Order payment card (#166), so it is not shown here.
export function laundryActionFailure(
  failure: LaundryActionVerb | LaundryPaymentVerb | null,
  message: string | null,
): LaundryActionFailure | null {
  if (failure === null || isLaundryPaymentVerb(failure)) return null;
  return { message, verb: failure };
}
