'use client';
import { useCustomersQuery, type CustomersQueryVariables } from '@clensy/client';
import type { LaundryCustomerOption, LaundryCustomerSearchStatus } from '@clensy/web';
import { useEffect, useState } from 'react';
import { escapeLikePattern } from './laundry-order-list-query';

export const LAUNDRY_CUSTOMER_SEARCH_LIMIT = 20;
export const LAUNDRY_CUSTOMER_SEARCH_DEBOUNCE_MS = 300;

export interface LaundryCustomerSearch {
  options: readonly LaundryCustomerOption[];
  status: LaundryCustomerSearchStatus;
  truncated: boolean;
}

const IDLE: LaundryCustomerSearch = { options: [], status: 'idle', truncated: false };
const LOADING: LaundryCustomerSearch = { options: [], status: 'loading', truncated: false };
const FAILED: LaundryCustomerSearch = { options: [], status: 'error', truncated: false };

// The intake modal's customer search (lifecycle spec §8.4.4: any customer
// the customers query returns, not only the first 100). A contains match on
// the name, on the server, escaped like the list's own search.
export function laundryCustomerSearchVariables(text: string): CustomersQueryVariables {
  return {
    filter: { fullName: { iLike: `%${escapeLikePattern(text)}%` } },
    paging: { limit: LAUNDRY_CUSTOMER_SEARCH_LIMIT },
    sorting: [
      { direction: 'ASC', field: 'fullName' },
      { direction: 'ASC', field: 'id' },
    ],
  };
}

// The trimmed text is searched once typing pauses. The searched text starts
// empty, so even a first non-empty text waits out the debounce, and an
// empty input sends no query, at once rather than after the debounce. Options are returned only when the searched
// text is the input's text and its query has settled: while they differ,
// or the query is loading, the result is `loading` with no options, so a
// result for an older text is never offered for a newer one. `truncated`
// says the server counted more matches than the page holds.
export function useLaundryCustomerSearch(query: string): LaundryCustomerSearch {
  const text = query.trim();
  const [searched, setSearched] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearched(text), LAUNDRY_CUSTOMER_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const result = useCustomersQuery({
    fetchPolicy: 'network-only',
    // An empty input skips at once; a pending debounce never re-enables it.
    skip: text === '' || searched === '',
    variables: laundryCustomerSearchVariables(searched),
  });

  if (text === '') return IDLE;
  if (searched !== text || result.loading) return LOADING;
  if (result.error) return FAILED;
  const nodes = result.data?.customers.nodes ?? [];
  return {
    options: nodes,
    status: 'ready',
    truncated: (result.data?.customers.totalCount ?? nodes.length) > nodes.length,
  };
}
