'use client';
import {
  useCancelLaundryOrderMutation,
  useCompleteLaundryOrderMutation,
  useMarkLaundryOrderAwaitingDeliveryMutation,
  useMarkLaundryOrderAwaitingPaymentMutation,
  useMarkLaundryOrderAwaitingPickupMutation,
  useMarkLaundryOrderDamagedMutation,
  useMarkLaundryOrderLostMutation,
  useMarkLaundryOrderPaidMutation,
  useMarkLaundryOrderReadyMutation,
  useRefundLaundryOrderMutation,
  useRejectLaundryOrderMutation,
  useStartLaundryProcessingMutation,
} from '@clensy/client';
import { useToast } from '@clensy/ui';
import { useClensyTranslations } from '@clensy/web';
import { useRef, useState } from 'react';
import { graphQLErrorMessage } from './graphql-error-message';
import type { LaundryPaymentVerb } from './laundry-invoice-payment';
import type { LaundryActionVerb } from './laundry-order-lifecycle-actions';
import type { LaundryMutationLock } from './use-laundry-mutation-lock';

// The lifecycle verbs this hook runs: the two payment verbs (#166) and the
// ten Actions verbs (#165).
export type LaundryTransitionVerb = LaundryActionVerb | LaundryPaymentVerb;

export interface LaundryOrderTransitionState {
  run: (verb: LaundryTransitionVerb) => Promise<void>;
  // True from `run` until the order refetch that follows the mutation
  // settles. Every lifecycle-verb control on the page is disabled meanwhile.
  pending: boolean;
  // The verb whose last run failed; cleared when the next run starts.
  failure: LaundryTransitionVerb | null;
  // The server's message for `failure`, or null when it gave none (a
  // network failure or a missing payload). Cleared with `failure`.
  message: string | null;
}

export interface UseLaundryOrderTransitionOptions {
  orderId: string;
  // Reloads the order, so the page shows its true status after any outcome.
  refetch: () => Promise<unknown>;
  // The order page's shared mutation lock (#165). Without it, the hook's
  // own guard is the only one, as before.
  lock?: LaundryMutationLock;
}

// A mutation result as these hooks see it: data keyed by the GraphQL field.
interface MutationResult {
  data?: Record<string, unknown> | null;
  errors?: readonly unknown[];
}

type Mutate = (options: { variables: { input: { orderId: string } } }) => Promise<MutationResult>;

type SendResult = { ok: false; message: string | null } | { ok: true };

// The order page's one in-flight guard for lifecycle verbs (#166, widened
// by #165). A verb changes the laundry order's status only: neither payment
// verb records money against the invoice (lifecycle spec §8.4.4).
export function useLaundryOrderTransition({
  lock,
  orderId,
  refetch,
}: UseLaundryOrderTransitionOptions): LaundryOrderTransitionState {
  const t = useClensyTranslations('laundry');
  const toast = useToast();
  const [cancel] = useCancelLaundryOrderMutation();
  const [complete] = useCompleteLaundryOrderMutation();
  const [markAwaitingDelivery] = useMarkLaundryOrderAwaitingDeliveryMutation();
  const [markAwaitingPayment] = useMarkLaundryOrderAwaitingPaymentMutation();
  const [markAwaitingPickup] = useMarkLaundryOrderAwaitingPickupMutation();
  const [markDamaged] = useMarkLaundryOrderDamagedMutation();
  const [markLost] = useMarkLaundryOrderLostMutation();
  const [markPaid] = useMarkLaundryOrderPaidMutation();
  const [markReady] = useMarkLaundryOrderReadyMutation();
  const [refund] = useRefundLaundryOrderMutation();
  const [reject] = useRejectLaundryOrderMutation();
  const [startProcessing] = useStartLaundryProcessingMutation();
  // Taken synchronously, so a second verb that lands before React
  // re-renders (and disables the buttons) is dropped, not queued.
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<LaundryTransitionVerb | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // Each verb's mutation and the GraphQL field its payload comes back in.
  const mutations: Record<LaundryTransitionVerb, { field: string; mutate: Mutate }> = {
    cancel: { field: 'cancelLaundryOrder', mutate: cancel },
    complete: { field: 'completeLaundryOrder', mutate: complete },
    markAwaitingDelivery: { field: 'markLaundryOrderAwaitingDelivery', mutate: markAwaitingDelivery },
    markAwaitingPayment: { field: 'markLaundryOrderAwaitingPayment', mutate: markAwaitingPayment },
    markAwaitingPickup: { field: 'markLaundryOrderAwaitingPickup', mutate: markAwaitingPickup },
    markDamaged: { field: 'markLaundryOrderDamaged', mutate: markDamaged },
    markLost: { field: 'markLaundryOrderLost', mutate: markLost },
    markPaid: { field: 'markLaundryOrderPaid', mutate: markPaid },
    markReady: { field: 'markLaundryOrderReady', mutate: markReady },
    refund: { field: 'refundLaundryOrder', mutate: refund },
    reject: { field: 'rejectLaundryOrder', mutate: reject },
    startProcessing: { field: 'startLaundryProcessing', mutate: startProcessing },
  };

  // Whether the server accepted the verb. A rejection, a result with
  // errors and a result without the order are all failures, as in
  // `useConfirmLaundryPrice`; the server's message is kept when it has one.
  async function send(verb: LaundryTransitionVerb): Promise<SendResult> {
    const { field, mutate } = mutations[verb];
    try {
      const result = await mutate({ variables: { input: { orderId } } });
      if ((result.errors?.length ?? 0) === 0 && Boolean(result.data?.[field])) return { ok: true };
      return { message: graphQLErrorMessage({ graphQLErrors: result.errors }) ?? null, ok: false };
    } catch (error) {
      return { message: graphQLErrorMessage(error) ?? null, ok: false };
    }
  }

  async function run(verb: LaundryTransitionVerb) {
    if (inFlight.current) return;
    // The page lock (#165 Rules item 2): refused before any state changes,
    // so a refused run sends nothing and clears no earlier failure.
    const lease = lock ? lock.tryAcquire('transition') : undefined;
    if (lease === null) return;
    inFlight.current = true;
    setPending(true);
    setFailure(null);
    setMessage(null);
    try {
      const sent = await send(verb);
      if (sent.ok) {
        toast.success(t(`success.${verb}`));
      } else {
        setFailure(verb);
        setMessage(sent.message);
      }
      try {
        await refetch();
      } catch {
        // Apollo leaves the order query in error, and the page shows its
        // order error state (#166 F10).
      }
    } finally {
      inFlight.current = false;
      setPending(false);
      if (lease) lock?.release(lease);
    }
  }

  return { failure, message, pending, run };
}
