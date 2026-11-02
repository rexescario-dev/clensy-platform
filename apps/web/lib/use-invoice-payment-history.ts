'use client';
import { useApolloClient } from '@apollo/client';
import {
  InvoicePaymentsDocument,
  useInvoicePaymentsQuery,
  type InvoicePaymentsQuery,
  type InvoicePaymentsQueryVariables,
  type PaymentRowFragment,
} from '@clensy/client';
import { useRef, useState } from 'react';
import { mergePaymentPages } from './invoice-payments';

export interface InvoicePaymentHistory {
  // The page-0 result: amounts and status.
  invoice: InvoicePaymentsQuery['invoice'] | undefined;
  // Merged, de-duplicated, in server order.
  payments: PaymentRowFragment[];
  hasNextPage: boolean;
  loading: boolean;
  error: boolean;
  loadingMore: boolean;
  loadMoreFailed: boolean;
  loadMore: () => Promise<void>;
  reload: () => Promise<void>;
}

interface ExtraPage {
  hasNextPage: boolean;
  nodes: readonly PaymentRowFragment[];
  offset: number;
}

// One invoice's payment history (planning decision h). Page 0 is a normal
// query; later pages are fetched with `client.query` and kept in this hook's
// state, never merged in the Apollo cache. The next offset is the last
// page's offset plus its raw length, so a page of duplicates still advances.
// `reload` bumps a generation, and a page fetched under an older generation
// is dropped.
export function useInvoicePaymentHistory(invoiceId: string): InvoicePaymentHistory {
  const client = useApolloClient();
  const query = useInvoicePaymentsQuery({
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: true,
    variables: { id: invoiceId, offset: 0 },
  });
  // Tagged with the invoice, so a new invoice id starts with no extra pages.
  const [extra, setExtra] = useState<{ invoiceId: string; pages: ExtraPage[] }>({ invoiceId, pages: [] });
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const generation = useRef(0);
  const inFlight = useRef(false);

  const invoice = query.data?.invoice ?? undefined;
  const firstPage = invoice?.payments;
  const pages = extra.invoiceId === invoiceId ? extra.pages : [];
  const lastPage = pages.at(-1);
  const hasNextPage = Boolean(lastPage ? lastPage.hasNextPage : firstPage?.pageInfo.hasNextPage);
  const nextOffset = lastPage ? lastPage.offset + lastPage.nodes.length : (firstPage?.nodes.length ?? 0);
  const payments = mergePaymentPages([firstPage?.nodes ?? [], ...pages.map((page) => page.nodes)]);

  async function loadMore() {
    if (inFlight.current || !hasNextPage) return;
    inFlight.current = true;
    const started = generation.current;
    const offset = nextOffset;
    setLoadingMore(true);
    setLoadMoreFailed(false);
    let page: ExtraPage | null = null;
    try {
      const result = await client.query<InvoicePaymentsQuery, InvoicePaymentsQueryVariables>({
        fetchPolicy: 'network-only',
        query: InvoicePaymentsDocument,
        variables: { id: invoiceId, offset },
      });
      const payload = result.data.invoice?.payments;
      if (payload) page = { hasNextPage: Boolean(payload.pageInfo.hasNextPage), nodes: payload.nodes, offset };
    } catch {
      page = null;
    }
    // `reload` ran meanwhile: it already reset the flags and the guard.
    if (generation.current !== started) return;
    inFlight.current = false;
    setLoadingMore(false);
    if (page) {
      const fetched = page;
      setExtra((current) => ({
        invoiceId,
        pages: current.invoiceId === invoiceId ? [...current.pages, fetched] : [fetched],
      }));
    } else {
      setLoadMoreFailed(true);
    }
  }

  async function reload() {
    generation.current += 1;
    inFlight.current = false;
    setExtra({ invoiceId, pages: [] });
    setLoadingMore(false);
    setLoadMoreFailed(false);
    try {
      await query.refetch({ id: invoiceId, offset: 0 });
    } catch {
      // The query's own error state reports it.
    }
  }

  return {
    error: query.error !== undefined && invoice === undefined,
    hasNextPage,
    invoice,
    loading: query.loading && invoice === undefined,
    loadingMore,
    loadMore,
    loadMoreFailed,
    payments,
    reload,
  };
}
