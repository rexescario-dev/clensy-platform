import type { LaundryOrderVerb } from '@clensy/web';
import { describe, expect, it } from 'vitest';
import {
  isLaundryPaymentVerb,
  laundryActionFailure,
  laundryActionGroups,
  type LaundryActionVerb,
} from './laundry-order-lifecycle-actions';

describe('laundryActionGroups', () => {
  it.each<[string, LaundryOrderVerb[], LaundryActionVerb[], LaundryActionVerb[]]>([
    ['a forward verb and a destructive one', ['startProcessing', 'refund'], ['startProcessing'], ['refund']],
    // Helper order: cancel before reject (LAUNDRY_ORDER_VERBS).
    ['weigh is a form, not an Actions button', ['weigh', 'cancel', 'reject'], [], ['cancel', 'reject']],
    // #166 owns the payment verbs in Invoice and payment.
    ['payment verbs stay out of Actions', ['markAwaitingPayment', 'markPaid', 'cancel'], [], ['cancel']],
    ['invoice and price are not Actions buttons', ['generateInvoice', 'price'], [], []],
    ['nothing allowed', [], [], []],
  ])('%s', (_label, verbs, forward, destructive) => {
    expect(laundryActionGroups(verbs)).toEqual({ destructive, forward });
  });
});

describe('laundryActionFailure', () => {
  it('shows nothing without a failure', () => {
    expect(laundryActionFailure(null, null)).toBeNull();
  });

  it.each(['markPaid', 'markAwaitingPayment'] as const)(
    'leaves a failed %s to the Order payment card',
    (verb) => {
      expect(laundryActionFailure(verb, 'Server says no')).toBeNull();
    },
  );

  it('keeps the server message for a lifecycle verb', () => {
    expect(laundryActionFailure('cancel', 'Server says no')).toEqual({ message: 'Server says no', verb: 'cancel' });
  });

  it('leaves the message empty when the server gave none', () => {
    expect(laundryActionFailure('markReady', null)).toEqual({ message: null, verb: 'markReady' });
  });
});

describe('isLaundryPaymentVerb', () => {
  it.each(['markPaid', 'markAwaitingPayment'] as const)('is true for %s', (verb) => {
    expect(isLaundryPaymentVerb(verb)).toBe(true);
  });

  it.each<LaundryActionVerb | null>([
    null,
    'cancel',
    'complete',
    'markAwaitingDelivery',
    'markAwaitingPickup',
    'markDamaged',
    'markLost',
    'markReady',
    'refund',
    'reject',
    'startProcessing',
  ])('is false for %s', (verb) => {
    expect(isLaundryPaymentVerb(verb)).toBe(false);
  });
});
