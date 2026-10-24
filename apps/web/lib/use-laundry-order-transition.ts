'use client';
import { useMarkLaundryOrderAwaitingPaymentMutation, useMarkLaundryOrderPaidMutation } from '@clensy/client';
import { useToast } from '@clensy/ui';
import { useClensyTranslations } from '@clensy/web';
import { useRef, useState } from 'react';
import type { LaundryPaymentVerb } from './laundry-invoice-payment';

// The lifecycle verbs this guard runs. #165 widens this union and adds a
// mutation for each new member below (#166 plan, guard contract item 6).
export type LaundryTransitionVerb = LaundryPaymentVerb;

export interface LaundryOrderTransitionState {
  run: (verb: LaundryTransitionVerb) => Promise<void>;
  // True from `run` until the order refetch that follows the mutation
  // settles. Every lifecycle-verb control on the page is disabled meanwhile.
  pending: boolean;
  // The verb whose last run failed; cleared when the next run starts.
  failure: LaundryTransitionVerb | null;
}

export interface UseLaundryOrderTransitionOptions {
  orderId: string;
  // Reloads the order, so the page shows its true status after any outcome.
  refetch: () => Promise<unknown>;
}

// The order page's one in-flight guard for lifecycle verbs (#166, shared
// with #165). A verb changes the laundry order's status only: neither
// payment verb records money against the invoice (lifecycle spec §8.4.4).
export function useLaundryOrderTransition({ orderId, refetch }: UseLaundryOrderTransitionOptions): LaundryOrderTransitionState {
  const t = useClensyTranslations('laundry');
  const toast = useToast();
  const [markAwaitingPayment] = useMarkLaundryOrderAwaitingPaymentMutation();
  const [markPaid] = useMarkLaundryOrderPaidMutation();
  // Taken synchronously, so a second verb that lands before React
  // re-renders (and disables the buttons) is dropped, not queued.
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<LaundryTransitionVerb | null>(null);

  // Whether the server accepted the verb. A rejection, a result with
  // errors and a result without the order are all failures, as in
  // `useConfirmLaundryPrice`.
  async function send(verb: LaundryTransitionVerb): Promise<boolean> {
    const variables = { input: { orderId } };
    try {
      if (verb === 'markPaid') {
        const result = await markPaid({ variables });
        return (result.errors?.length ?? 0) === 0 && Boolean(result.data?.markLaundryOrderPaid);
      }
      const result = await markAwaitingPayment({ variables });
      return (result.errors?.length ?? 0) === 0 && Boolean(result.data?.markLaundryOrderAwaitingPayment);
    } catch {
      return false;
    }
  }

  async function run(verb: LaundryTransitionVerb) {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setFailure(null);
    try {
      if (await send(verb)) toast.success(t(`success.${verb}`));
      else setFailure(verb);
      try {
        await refetch();
      } catch {
        // Apollo leaves the order query in error, and the page shows its
        // order error state (#166 F10).
      }
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return { failure, pending, run };
}
