'use client';
import {
  DEFAULT_LAUNDRY_ORDER_SORT,
  LAUNDRY_ORDER_STATUSES,
  isLaundryOrderSortKey,
  type LaundryFulfillmentType,
  type LaundryOrderSortKey,
  type LaundryOrderSortState,
  type LaundryOrderStatus,
} from '@clensy/web';
import { useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

// `/app/laundry` list state, kept in the URL so a refresh, or back from an
// order, restores it (lifecycle spec §8.4.4). Params the list does not own,
// such as the drawer's `detail`, and the hash are carried through untouched.
export interface LaundryOrderListState {
  fulfillment: LaundryFulfillmentType | null;
  offset: number;
  search: string;
  sortBy: LaundryOrderSortKey;
  sortOrder: 'asc' | 'desc';
  status: LaundryOrderStatus | null;
}

export type LaundryOrderListFilterChange = Partial<
  Pick<LaundryOrderListState, 'fulfillment' | 'search' | 'sortBy' | 'sortOrder' | 'status'>
>;

export type LaundryOrderListUpdate = (current: LaundryOrderListState) => LaundryOrderListState;

// Params outside the list state that a URL also sets or removes: the
// drawer's `detail` on open, and its removal on close.
export interface LaundryOrderHrefParams {
  remove?: readonly string[];
  set?: Readonly<Record<string, string>>;
}

export const LAUNDRY_ORDER_PAGE_SIZE = 20;
export const LAUNDRY_SEARCH_DEBOUNCE_MS = 300;
export const LAUNDRY_SEARCH_MAX_LENGTH = 200;

export const DEFAULT_LAUNDRY_ORDER_LIST_STATE: Readonly<LaundryOrderListState> = {
  fulfillment: null,
  offset: 0,
  search: '',
  sortBy: DEFAULT_LAUNDRY_ORDER_SORT.key,
  sortOrder: DEFAULT_LAUNDRY_ORDER_SORT.direction,
  status: null,
};

const PARAM = {
  fulfillment: 'fulfillment',
  offset: 'offset',
  search: 'q',
  sortBy: 'sortBy',
  sortOrder: 'sortOrder',
  status: 'status',
} as const;

const FULFILLMENT_TYPES: readonly LaundryFulfillmentType[] = ['DELIVERY', 'PICKUP'];

// Search, status or fulfillment narrows the list. Sort does not.
export function hasActiveLaundryFilters(state: LaundryOrderListState): boolean {
  return state.search !== '' || state.status !== null || state.fulfillment !== null;
}

// Clears search and both filters, keeps the sort, and returns to page 1.
export function laundryListFiltersCleared(state: LaundryOrderListState): LaundryOrderListState {
  return { ...state, fulfillment: null, offset: 0, search: '', status: null };
}

// Pure. Every missing, malformed or unknown value falls back to the
// default, so nothing unvalidated reaches a GraphQL variable.
export function parseLaundryOrderListState(params: URLSearchParams): LaundryOrderListState {
  const sortByRaw = params.get(PARAM.sortBy);
  const sortOrderRaw = params.get(PARAM.sortOrder);
  const statusRaw = params.get(PARAM.status);
  const fulfillmentRaw = params.get(PARAM.fulfillment);
  const offsetRaw = Number(params.get(PARAM.offset));

  return {
    fulfillment: FULFILLMENT_TYPES.includes(fulfillmentRaw as LaundryFulfillmentType)
      ? (fulfillmentRaw as LaundryFulfillmentType)
      : null,
    // Snapped down to a page boundary, so a hand-edited offset never shows
    // a fractional page.
    offset:
      Number.isSafeInteger(offsetRaw) && offsetRaw >= 0
        ? offsetRaw - (offsetRaw % LAUNDRY_ORDER_PAGE_SIZE)
        : DEFAULT_LAUNDRY_ORDER_LIST_STATE.offset,
    search: normalizeLaundrySearch(params.get(PARAM.search) ?? ''),
    sortBy: isLaundryOrderSortKey(sortByRaw) ? sortByRaw : DEFAULT_LAUNDRY_ORDER_LIST_STATE.sortBy,
    sortOrder: sortOrderRaw === 'asc' || sortOrderRaw === 'desc' ? sortOrderRaw : DEFAULT_LAUNDRY_ORDER_LIST_STATE.sortOrder,
    status: LAUNDRY_ORDER_STATUSES.includes(statusRaw as LaundryOrderStatus) ? (statusRaw as LaundryOrderStatus) : null,
  };
}

// Writes the list keys onto a copy of `base`, so params this list does not
// own survive. Search and filters are omitted when empty. Sort and offset
// are always written, as on the bookings list.
export function serializeLaundryOrderListState(
  state: LaundryOrderListState,
  base: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const params = new URLSearchParams(base);
  for (const key of Object.values(PARAM)) params.delete(key);
  if (state.search !== '') params.set(PARAM.search, state.search);
  if (state.status !== null) params.set(PARAM.status, state.status);
  if (state.fulfillment !== null) params.set(PARAM.fulfillment, state.fulfillment);
  params.set(PARAM.sortBy, state.sortBy);
  params.set(PARAM.sortOrder, state.sortOrder);
  params.set(PARAM.offset, String(state.offset));
  return params;
}

// The list writes its URL with the native History API, which Next.js
// integrates with `useSearchParams` (Next 16 "Native History API"; verified
// at planning time on 16.3.1). `window.history.replaceState` and
// `pushState` change `window.location` at once; the re-render with the new
// `useSearchParams` follows. Nothing is ever in flight, so there is no
// queue to reconcile with Back/Forward, and each update can build on the
// live `window.location`, even before React has rendered the previous one.
//
// - List updates (search, filters, sort, page) `replaceState`: they add no
//   history entry, as with the bookings list's `router.replace`.
// - Opening the drawer, from a row or after creating an order,
//   `pushState`s the same kind of URL plus `detail`
//   (`useDetailDrawer().openWithHref(href)`), so Back, and the drawer's
//   own `router.back()`, return to the list.
// - Closing a drawer reached by a direct link or refresh `replaceState`s
//   the URL without `detail` (`useDetailDrawer().closeWithHref(href)`). The page
//   therefore makes no `router.push` or `router.replace` of its own, so no
//   async router navigation can land over a native write.
// - Back and Forward are the browser's: the URL, and therefore the list
//   state, is whatever entry the user went to.
export function useLaundryOrderListUrlState() {
  const searchParams = useSearchParams();
  const state = parseLaundryOrderListState(searchParams);

  // The exact URL for `update`, plus `set` and minus `remove` params (the
  // drawer's `detail`), built on the live URL: same pathname, every param
  // the list does not own, and the hash. Always a URL, so every caller
  // writes natively. `setState` skips the write only when the URL string is
  // identical; an equivalent URL in another encoding (`a%20b` vs `a+b`) is
  // rewritten, which is harmless because `replaceState` adds no entry.
  const hrefFor = useCallback(
    (update: LaundryOrderListUpdate, { remove = [], set = {} }: LaundryOrderHrefParams = {}): string => {
      const base = new URLSearchParams(window.location.search);
      const current = parseLaundryOrderListState(base);
      const next = update(current);
      const params = next === current ? new URLSearchParams(base) : serializeLaundryOrderListState(next, base);
      for (const [key, value] of Object.entries(set)) params.set(key, value);
      for (const key of remove) params.delete(key);
      const query = params.toString();
      return `${window.location.pathname}${query === '' ? '' : `?${query}`}${window.location.hash}`;
    },
    [],
  );

  const setState = useCallback(
    (update: LaundryOrderListUpdate) => {
      const href = hrefFor(update);
      const live = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (href !== live) window.history.replaceState(null, '', href);
    },
    [hrefFor],
  );

  return { hrefFor, setState, state };
}

// Applies a search, filter or sort change. Any real change returns to page
// 1 (the bookings reset rule). No change returns `state` itself, so a
// keystroke that only adds trailing space does not reset the page.
export function withLaundryFilterChange(
  state: LaundryOrderListState,
  change: LaundryOrderListFilterChange,
): LaundryOrderListState {
  const next: LaundryOrderListState = {
    ...state,
    ...change,
    search: change.search === undefined ? state.search : normalizeLaundrySearch(change.search),
  };
  const changed =
    next.search !== state.search ||
    next.status !== state.status ||
    next.fulfillment !== state.fulfillment ||
    next.sortBy !== state.sortBy ||
    next.sortOrder !== state.sortOrder;
  return changed ? { ...next, offset: 0 } : state;
}

// Pagination is 1-based in `DataTable`, offset-based in the URL. Anything
// but a positive safe integer page, or a page whose offset is not a safe
// integer, means page 1.
export function withLaundryPage(state: LaundryOrderListState, page: number): LaundryOrderListState {
  const offset = Number.isSafeInteger(page) && page >= 1 ? (page - 1) * LAUNDRY_ORDER_PAGE_SIZE : 0;
  return { ...state, offset: Number.isSafeInteger(offset) ? offset : 0 };
}

// A sort transition from the table. `null` always restores the default
// sort (`nextLaundryOrderSort`). Changing the sort returns to page 1.
export function withLaundrySort(
  state: LaundryOrderListState,
  sort: LaundryOrderSortState | null,
): LaundryOrderListState {
  const { direction, key } = sort ?? DEFAULT_LAUNDRY_ORDER_SORT;
  return withLaundryFilterChange(state, { sortBy: key, sortOrder: direction });
}

function normalizeLaundrySearch(text: string): string {
  return text.trim().slice(0, LAUNDRY_SEARCH_MAX_LENGTH);
}
