'use client';
import { usePriceLaundryOrderMutation, type PriceLaundryOrderInput } from '@clensy/client';
import { useToast } from '@clensy/ui';
import { useClensyTranslations } from '@clensy/web';
import { useRef, useState } from 'react';
import { graphQLErrorMessage } from './graphql-error-message';
import type { LaundryServiceSelection } from './laundry-service-selection';

export interface LaundryPriceConfirmFailure {
  message: string;
  // The selection Confirm was pressed with. The page shows the alert only
  // while the selection is this same object: any edit or touch replaces it,
  // which clears the alert (#162 owner decision 6.5; planning decision e).
  selection: LaundryServiceSelection;
}

export interface ConfirmLaundryPriceState {
  confirm: (input: PriceLaundryOrderInput, selection: LaundryServiceSelection) => Promise<void>;
  // True through the mutation and the refetch that follows it. The page
  // disables both editors meanwhile (owner decision 6.3).
  confirming: boolean;
  failure: LaundryPriceConfirmFailure | null;
}

export interface UseConfirmLaundryPriceOptions {
  // Reloads the order. On success the status becomes PRICED; on failure it
  // shows whatever the order now is (owner decision 6.5).
  refetch: () => Promise<unknown>;
}

// `priceLaundryOrder`, once per Confirm (§8.4.4). The input is the previewed
// one, unchanged (owner decision 6.1). It never calls an invoice or payment
// mutation (issue Confirm behavior).
export function useConfirmLaundryPrice({ refetch }: UseConfirmLaundryPriceOptions): ConfirmLaundryPriceState {
  const t = useClensyTranslations('laundry');
  const toast = useToast();
  const [price] = usePriceLaundryOrderMutation();
  // Taken synchronously, so a second Confirm that lands before React
  // re-renders (and disables the button) is dropped (owner decision 6.2).
  const inFlight = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState<LaundryPriceConfirmFailure | null>(null);

  async function confirm(input: PriceLaundryOrderInput, selection: LaundryServiceSelection) {
    if (inFlight.current) return;
    inFlight.current = true;
    setConfirming(true);
    setFailure(null);
    try {
      // As in the weighing editor (#155): Apollo's default `errorPolicy`
      // rejects on GraphQL errors, and a resolved result with errors or
      // without the order still counts as a failure.
      let failed: string | undefined;
      try {
        const result = await price({ variables: { input } });
        if ((result.errors?.length ?? 0) > 0 || !result.data?.priceLaundryOrder) {
          failed = graphQLErrorMessage({ graphQLErrors: result.errors }) ?? t('order.price.failure');
        }
      } catch (error) {
        failed = graphQLErrorMessage(error) ?? t('order.price.failure');
      }
      if (failed === undefined) toast.success(t('order.price.success'));
      else setFailure({ message: failed, selection });
      try {
        await refetch();
      } catch {
        // Apollo puts the order query in error, and the page shows its order
        // error state. Nothing here assumes the order is still priceable.
      }
    } finally {
      inFlight.current = false;
      setConfirming(false);
    }
  }

  return { confirm, confirming, failure };
}
