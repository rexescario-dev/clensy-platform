'use client';
import { useAddOnsQuery, useServicesQuery, type AddOnsQueryVariables, type ServicesQueryVariables } from '@clensy/client';
import type { LaundrySearchStatus } from '@clensy/web';
import { useEffect, useState } from 'react';
import { escapeLikePattern } from './laundry-order-list-query';
import type { LaundryCatalogChoice } from './laundry-service-selection';

export const LAUNDRY_CATALOG_SEARCH_LIMIT = 20;
export const LAUNDRY_CATALOG_SEARCH_DEBOUNCE_MS = 300;

export interface LaundryCatalogSearch {
  options: readonly LaundryCatalogChoice[];
  status: LaundrySearchStatus;
  truncated: boolean;
}

const IDLE: LaundryCatalogSearch = { options: [], status: 'idle', truncated: false };
const LOADING: LaundryCatalogSearch = { options: [], status: 'loading', truncated: false };
const FAILED: LaundryCatalogSearch = { options: [], status: 'error', truncated: false };

// Active entries only, on the server, the first 20 by name (issue Data;
// owner decision 3). An empty text browses with no name filter; otherwise a
// contains match on the name, escaped like the customer search.
export function laundryCatalogSearchVariables(text: string) {
  return {
    filter: text === '' ? { active: { is: true } } : { active: { is: true }, name: { iLike: `%${escapeLikePattern(text)}%` } },
    paging: { limit: LAUNDRY_CATALOG_SEARCH_LIMIT },
    sorting: [
      { direction: 'ASC', field: 'name' },
      { direction: 'ASC', field: 'id' },
    ],
  } satisfies AddOnsQueryVariables & ServicesQueryVariables;
}

// The searched text, once the picker has been focused (`active`). The
// browse list for an empty text is requested on the next tick; typed text
// waits out the debounce. Each text change clears the pending timer, so
// focus and typing that overlap send one request, for the latest text.
function useSearchedText(query: string, active: boolean): { searched: string | null; text: string } {
  const text = query.trim();
  const [searched, setSearched] = useState<string | null>(null);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setSearched(text), text === '' ? 0 : LAUNDRY_CATALOG_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [active, text]);
  return { searched, text };
}

// Options only for the searched text's settled query, as in
// `useLaundryCustomerSearch`: while the texts differ or the query loads, the
// result is `loading` with no options. Loading, empty and error stay
// distinct (owner decision 3).
function catalogResult(
  active: boolean,
  searched: string | null,
  text: string,
  query: { error?: unknown; loading: boolean },
  connection: { nodes: readonly LaundryCatalogChoice[]; totalCount: number } | undefined,
): LaundryCatalogSearch {
  if (!active) return IDLE;
  if (searched !== text || query.loading) return LOADING;
  if (query.error) return FAILED;
  const nodes = connection?.nodes ?? [];
  return {
    options: nodes.map(({ id, name }) => ({ id, name })),
    status: 'ready',
    truncated: (connection?.totalCount ?? nodes.length) > nodes.length,
  };
}

export function useLaundryServiceSearch(query: string, active: boolean): LaundryCatalogSearch {
  const { searched, text } = useSearchedText(query, active);
  const result = useServicesQuery({
    fetchPolicy: 'network-only',
    skip: !active || searched !== text,
    variables: laundryCatalogSearchVariables(searched ?? ''),
  });
  return catalogResult(active, searched, text, result, result.data?.services);
}

export function useLaundryAddOnSearch(query: string, active: boolean): LaundryCatalogSearch {
  const { searched, text } = useSearchedText(query, active);
  const result = useAddOnsQuery({
    fetchPolicy: 'network-only',
    skip: !active || searched !== text,
    variables: laundryCatalogSearchVariables(searched ?? ''),
  });
  return catalogResult(active, searched, text, result, result.data?.addOns);
}
