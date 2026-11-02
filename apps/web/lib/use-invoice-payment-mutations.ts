'use client';
import {
  useRecordInvoicePaymentMutation,
  useRefundInvoicePaymentMutation,
  type RecordInvoicePaymentInput,
  type RefundInvoicePaymentInput,
} from '@clensy/client';
import { useToast } from '@clensy/ui';
import { useClensyTranslations } from '@clensy/web';
import { useRef, useState } from 'react';
import { graphQLErrorMessage } from './graphql-error-message';
import type { LaundryMutationLock } from './use-laundry-mutation-lock';

export interface InvoicePaymentMutations {
  record: (input: Omit<RecordInvoicePaymentInput, 'invoiceId'>) => Promise<boolean>;
  refund: (input: RefundInvoicePaymentInput) => Promise<boolean>;
  // True through the mutation and the refetch that follows a success.
  pending: boolean;
  // The server message or the fallback copy; cleared when the next write starts.
  error: string | null;
}

export interface UseInvoicePaymentMutationsOptions {
  invoiceId: string;
  // Runs after a successful write, before `record`/`refund` resolve.
  refetch: () => Promise<unknown>;
  // The laundry page's shared lock (planning decision i). Without it, the
  // hook's own guard is the only one (billing drawer).
  lock?: LaundryMutationLock;
}

type Kind = 'recordPayment' | 'recordRefund';

// Record a payment or a refund, one write at a time (spec §4.10). The caller
// owns the idempotency key (spec §4.5) and passes it unchanged.
export function useInvoicePaymentMutations({ invoiceId, lock, refetch }: UseInvoicePaymentMutationsOptions): InvoicePaymentMutations {
  const t = useClensyTranslations('laundry');
  const toast = useToast();
  const [recordPayment] = useRecordInvoicePaymentMutation();
  const [refundPayment] = useRefundInvoicePaymentMutation();
  // Taken synchronously, so a second submit before React re-renders is dropped.
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: Kind, send: () => Promise<{ data?: unknown; errors?: readonly unknown[] }>, field: string) {
    if (inFlight.current) return false;
    const lease = lock ? lock.tryAcquire('payment') : undefined;
    if (lease === null) return false;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      let ok = false;
      let message: string | undefined;
      try {
        const result = await send();
        const payload = (result.data as Record<string, unknown> | null | undefined)?.[field];
        ok = (result.errors?.length ?? 0) === 0 && Boolean(payload);
        if (!ok) message = graphQLErrorMessage({ graphQLErrors: result.errors });
      } catch (caught) {
        message = graphQLErrorMessage(caught);
      }
      if (!ok) {
        setError(message ?? t(`payments.error.${kind}`));
        return false;
      }
      toast.success(t(`payments.success.${kind}`));
      try {
        await refetch();
      } catch {
        // The history and invoice queries report their own errors.
      }
      return true;
    } finally {
      inFlight.current = false;
      setPending(false);
      if (lease) lock?.release(lease);
    }
  }

  function record(input: Omit<RecordInvoicePaymentInput, 'invoiceId'>) {
    return run('recordPayment', () => recordPayment({ variables: { input: { ...input, invoiceId } } }), 'recordInvoicePayment');
  }

  function refund(input: RefundInvoicePaymentInput) {
    return run('recordRefund', () => refundPayment({ variables: { input } }), 'refundInvoicePayment');
  }

  return { error, pending, record, refund };
}
