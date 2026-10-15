'use client';
import { useApolloClient } from '@apollo/client';
import {
  PreviewLaundryOrderPriceDocument,
  type PreviewLaundryOrderPriceQuery,
  type PreviewLaundryOrderPriceQueryVariables,
  type PriceLaundryOrderInput,
  type PricingUnit,
} from '@clensy/client';
import { useEffect, useRef, useState } from 'react';
import { graphQLErrorMessage } from './graphql-error-message';
import {
  EMPTY_LAUNDRY_SERVICE_SELECTION,
  laundryUnitKey,
  matchPreview,
  missingPriceTarget,
  previewCorresponds,
  previewInputFromSelection,
  type LaundryAddOnRow,
  type LaundryCatalogChoice,
  type LaundryMatchedPreview,
  type LaundryMissingPriceTarget,
  type LaundryPreview,
  type LaundryRememberedUnits,
  type LaundryServiceSelection,
} from './laundry-service-selection';

export const LAUNDRY_PREVIEW_DEBOUNCE_MS = 300;

type PreviewOutcome = { data: LaundryPreview; ok: true } | { message: string | undefined; ok: false };

export interface LaundryPreviewError {
  // The server's message, when there is one.
  message: string | undefined;
  // The selected line an exact missing-price message names (owner decision 2).
  target: LaundryMissingPriceTarget | null;
}

// The selection and its current preview, owned by the order page above the
// Services and Price sections (#158 Layout: "lift state to the detail
// page"). Price review (#162) reads this and starts no preview of its own.
export interface LaundryServiceSelectionState {
  // The current successful preview, matched to the rows; `null` while
  // loading, after a failure, or when the selection cannot be previewed.
  preview: LaundryMatchedPreview | null;
  previewError: LaundryPreviewError | null;
  // True through the debounce and the request.
  previewLoading: boolean;
  // The exact input `preview` was computed from; `null` whenever `preview` is.
  priceInput: PriceLaundryOrderInput | null;
  // Base chosen, every row chosen, every count valid, and a current
  // preview. #162 may offer Confirm only when this is true.
  ready: boolean;
  selection: LaundryServiceSelection;
  units: LaundryRememberedUnits;
  addAddOn: () => number;
  changeAddOnQuantity: (key: number, text: string) => void;
  changeAddOnQuery: (key: number, text: string) => void;
  changeBaseQuantity: (text: string) => void;
  changeBaseQuery: (text: string) => void;
  chooseAddOn: (key: number, choice: LaundryCatalogChoice) => void;
  chooseBase: (choice: LaundryCatalogChoice) => void;
  removeAddOn: (key: number) => void;
  touchAddOn: (key: number) => void;
  touchAddOnQuantity: (key: number) => void;
  touchBase: () => void;
  touchBaseQuantity: () => void;
}

export interface UseLaundryServiceSelectionOptions {
  // The Services view is `editor`; nothing is requested otherwise.
  enabled: boolean;
  orderId: string;
  weightGrams: number | null;
}

type ApolloQueryClient = Pick<ReturnType<typeof useApolloClient>, 'query'>;

// A resolved result with errors or without the payload is a failure too
// (planning decision e; #155 decision g). So is a payload whose lines do
// not correspond to the submitted input: it is rejected here, before it can
// reach `units` or `settled` (M5 part 4 P1).
async function runPreview(client: ApolloQueryClient, input: PriceLaundryOrderInput): Promise<PreviewOutcome> {
  try {
    const result = await client.query<PreviewLaundryOrderPriceQuery, PreviewLaundryOrderPriceQueryVariables>({
      fetchPolicy: 'network-only',
      query: PreviewLaundryOrderPriceDocument,
      variables: { input },
    });
    const payload = (result.data as PreviewLaundryOrderPriceQuery | null | undefined)?.previewLaundryOrderPrice;
    if ((result.errors?.length ?? 0) > 0 || !payload) {
      return { message: graphQLErrorMessage({ graphQLErrors: result.errors }), ok: false };
    }
    if (!previewCorresponds(input, payload)) return { message: undefined, ok: false };
    return { data: payload, ok: true };
  } catch (error) {
    return { message: graphQLErrorMessage(error), ok: false };
  }
}

function rememberUnits(units: LaundryRememberedUnits, lines: LaundryPreview['lines']): LaundryRememberedUnits {
  const next: Record<string, PricingUnit> = { ...units };
  for (const line of lines) {
    if (line.serviceId !== null) next[laundryUnitKey('service', line.serviceId)] = line.unit;
    if (line.addOnId !== null) next[laundryUnitKey('addOn', line.addOnId)] = line.unit;
  }
  return next;
}

function newRow(key: number): LaundryAddOnRow {
  return { choice: null, duplicateOf: null, key, quantity: '1', quantityTouched: false, query: '', touched: false };
}

export function useLaundryServiceSelection({
  enabled,
  orderId,
  weightGrams,
}: UseLaundryServiceSelectionOptions): LaundryServiceSelectionState {
  const client = useApolloClient();
  const nextKey = useRef(0);
  // The newest request sent, and the key of the latest committed render.
  // Both are written only in effects and callbacks, never during render.
  const generation = useRef(0);
  const latestKey = useRef<string | null>(null);
  const [selection, setSelection] = useState<LaundryServiceSelection>(EMPTY_LAUNDRY_SERVICE_SELECTION);
  const [units, setUnits] = useState<LaundryRememberedUnits>({});
  // The request sent for a key, and the outcome that came back for it.
  // Both carry a generation, so a key that returns after another one was
  // requested is requested again (planning decision f).
  const [requested, setRequested] = useState<{ generation: number; key: string } | null>(null);
  const [settled, setSettled] = useState<{ generation: number; key: string; outcome: PreviewOutcome } | null>(null);

  const input = enabled && weightGrams !== null ? previewInputFromSelection(orderId, selection, units) : null;
  // The staleness key: the input and the weight it was quoted against
  // (owner decision 6: a re-weigh invalidates the quote).
  const key = input === null ? null : JSON.stringify([weightGrams, input]);

  useEffect(() => {
    latestKey.current = key;
  }, [key]);

  useEffect(() => {
    if (key === null) return;
    const [, keyInput] = JSON.parse(key) as [number, PriceLaundryOrderInput];
    let live = true;
    const timer = setTimeout(() => {
      generation.current += 1;
      const sent = { generation: generation.current, key };
      setRequested(sent);
      void runPreview(client, keyInput).then((outcome) => {
        // Every side effect of a response, `units` included, needs all three
        // (M5 part 4 P2): this effect is still live (the key has not changed
        // and the page is mounted), no newer request has been sent, and the
        // latest committed key is still this request's key.
        if (!live || generation.current !== sent.generation || latestKey.current !== sent.key) return;
        if (outcome.ok) setUnits((current) => rememberUnits(current, outcome.data.lines));
        setSettled({ ...sent, outcome });
      });
    }, LAUNDRY_PREVIEW_DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [client, key]);

  const outcome =
    key !== null && requested?.key === key && settled?.key === key && settled.generation === requested.generation
      ? settled.outcome
      : null;
  const preview = outcome?.ok && input ? matchPreview(input, selection, outcome.data) : null;
  let previewError: LaundryPreviewError | null = null;
  if (outcome && !outcome.ok) {
    previewError = {
      message: outcome.message,
      target: outcome.message === undefined ? null : missingPriceTarget(outcome.message, selection),
    };
  } else if (outcome?.ok && !preview) {
    // The lines corresponded to the input (checked on arrival) but not to
    // the current rows; shown as a general failure.
    previewError = { message: undefined, target: null };
  }
  const previewLoading = key !== null && outcome === null;
  const complete = input !== null && selection.addOns.every((row) => row.choice !== null);

  function updateRow(rowKey: number, change: (row: LaundryAddOnRow) => LaundryAddOnRow) {
    setSelection((current) => ({
      ...current,
      addOns: current.addOns.map((row) => (row.key === rowKey ? change(row) : row)),
    }));
  }

  return {
    addAddOn: () => {
      const rowKey = nextKey.current;
      nextKey.current += 1;
      setSelection((current) => ({ ...current, addOns: [...current.addOns, newRow(rowKey)] }));
      return rowKey;
    },
    changeAddOnQuantity: (rowKey, text) => updateRow(rowKey, (row) => ({ ...row, quantity: text })),
    // A user edit drops the row's choice (the picker selection contract, #160).
    changeAddOnQuery: (rowKey, text) =>
      updateRow(rowKey, (row) => ({ ...row, choice: null, duplicateOf: null, query: text })),
    changeBaseQuantity: (text) => setSelection((current) => ({ ...current, baseQuantity: text })),
    changeBaseQuery: (text) => setSelection((current) => ({ ...current, base: null, baseQuery: text })),
    // The same add-on twice is blocked here, in the UI only (§8.4.3): the
    // row keeps its typed text and says so.
    chooseAddOn: (rowKey, choice) =>
      setSelection((current) => {
        const taken = current.addOns.some((row) => row.key !== rowKey && row.choice?.id === choice.id);
        return {
          ...current,
          addOns: current.addOns.map((row) => {
            if (row.key !== rowKey) return row;
            if (taken) return { ...row, choice: null, duplicateOf: choice.id };
            return { ...row, choice, duplicateOf: null, quantity: '1', quantityTouched: false, query: choice.name };
          }),
        };
      }),
    chooseBase: (choice) =>
      setSelection((current) => ({
        ...current,
        base: choice,
        baseQuantity: '1',
        baseQuantityTouched: false,
        baseQuery: choice.name,
      })),
    preview,
    previewError,
    previewLoading,
    priceInput: preview ? input : null,
    ready: complete && preview !== null && !previewLoading,
    removeAddOn: (rowKey) =>
      setSelection((current) => ({ ...current, addOns: current.addOns.filter((row) => row.key !== rowKey) })),
    selection,
    touchAddOn: (rowKey) => updateRow(rowKey, (row) => ({ ...row, touched: true })),
    touchAddOnQuantity: (rowKey) => updateRow(rowKey, (row) => ({ ...row, quantityTouched: true })),
    touchBase: () => setSelection((current) => ({ ...current, baseTouched: true })),
    touchBaseQuantity: () => setSelection((current) => ({ ...current, baseQuantityTouched: true })),
    units,
  };
}
