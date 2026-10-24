'use client';
import { useGenerateInvoiceFromOrderMutation, type InvoicePaymentTerms } from '@clensy/client';
import { useToast } from '@clensy/ui';
import { useClensyTranslations } from '@clensy/web';
import { useRef, useState } from 'react';

export interface GenerateLaundryInvoiceState {
  generate: (paymentTerms: InvoicePaymentTerms) => Promise<void>;
  // True through the mutation and the invoice refetch that follows it.
  generating: boolean;
  // The last generate failed; cleared when the next one starts.
  failed: boolean;
}

export interface UseGenerateLaundryInvoiceOptions {
  orderId: string;
  // Reloads `InvoiceForOrder`. After a failure it shows an invoice another
  // user generated first (#166 F4).
  refetch: () => Promise<unknown>;
}

// `generateInvoiceFromOrder`, once per click (#166). The input is the order
// and the chosen terms only: generating never marks the order paid and
// always creates an UNPAID invoice (invoices spec §4.4).
export function useGenerateLaundryInvoice({ orderId, refetch }: UseGenerateLaundryInvoiceOptions): GenerateLaundryInvoiceState {
  const t = useClensyTranslations('laundry');
  const toast = useToast();
  const [generateInvoice] = useGenerateInvoiceFromOrderMutation();
  // Taken synchronously, so a second click that lands before React
  // re-renders (and disables the button) is dropped.
  const inFlight = useRef(false);
  const [generating, setGenerating] = useState(false);
  const [failed, setFailed] = useState(false);

  async function generate(paymentTerms: InvoicePaymentTerms) {
    if (inFlight.current) return;
    inFlight.current = true;
    setGenerating(true);
    setFailed(false);
    try {
      // As in `useConfirmLaundryPrice`: a rejection, a result with errors
      // and a result without the invoice are all failures.
      let ok = false;
      try {
        const result = await generateInvoice({ variables: { input: { laundryOrderId: orderId, paymentTerms } } });
        ok = (result.errors?.length ?? 0) === 0 && Boolean(result.data?.generateInvoiceFromOrder);
      } catch {
        ok = false;
      }
      if (ok) toast.success(t('success.generateInvoice'));
      else setFailed(true);
      try {
        await refetch();
      } catch {
        // Apollo leaves the invoice query in error, and the card shows
        // "Unable to load invoice." (#166 F5).
      }
    } finally {
      inFlight.current = false;
      setGenerating(false);
    }
  }

  return { failed, generate, generating };
}
