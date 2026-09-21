'use client';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export type BookingSortKey = 'scheduledAt' | 'status';
export type BookingPageSize = 10 | 20 | 25 | 50 | 100;

export interface BookingTableUrlState {
  limit: BookingPageSize;
  offset: number;
  sortBy: BookingSortKey;
  sortOrder: 'asc' | 'desc';
}

const DEFAULT_STATE: BookingTableUrlState = { limit: 20, offset: 0, sortBy: 'scheduledAt', sortOrder: 'desc' };
const SORT_KEYS: readonly BookingSortKey[] = ['scheduledAt', 'status'];
const LIMITS: readonly BookingPageSize[] = [10, 20, 25, 50, 100];

// Pure: no next/navigation dependency, independently unit-testable.
// Every branch MUST fall back to DEFAULT_STATE's corresponding field for
// any missing, malformed, or out-of-whitelist value — never forwards an
// unvalidated value to a caller that will use it in a GraphQL variable.
export function parseBookingTableUrlState(searchParams: URLSearchParams): BookingTableUrlState {
  const sortByRaw = searchParams.get('sortBy');
  const sortBy = SORT_KEYS.includes(sortByRaw as BookingSortKey) ? (sortByRaw as BookingSortKey) : DEFAULT_STATE.sortBy;

  const sortOrderRaw = searchParams.get('sortOrder');
  const sortOrder = sortOrderRaw === 'asc' || sortOrderRaw === 'desc' ? sortOrderRaw : DEFAULT_STATE.sortOrder;

  const limitRaw = Number(searchParams.get('limit'));
  const limit = LIMITS.includes(limitRaw as BookingPageSize) ? (limitRaw as BookingPageSize) : DEFAULT_STATE.limit;

  const offsetRaw = Number(searchParams.get('offset'));
  const offset = Number.isInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : DEFAULT_STATE.offset;

  return { limit, offset, sortBy, sortOrder };
}

// Named "offset", never "cursor" (spec §3/§4.6/§8) — the value is a literal
// offset, not an opaque token. Every field is always written explicitly
// (not omitted at default values) for deterministic, easily-testable URLs.
export function serializeBookingTableUrlState(state: BookingTableUrlState): URLSearchParams {
  const params = new URLSearchParams();
  params.set('sortBy', state.sortBy);
  params.set('sortOrder', state.sortOrder);
  params.set('limit', String(state.limit));
  params.set('offset', String(state.offset));
  return params;
}

type BookingTableUrlStateUpdate = BookingTableUrlState | ((current: BookingTableUrlState) => BookingTableUrlState);

export function useBookingTableUrlState() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const state = parseBookingTableUrlState(searchParams);

  // Accepts a value or an updater function so rapid, back-to-back calls
  // (e.g. fast Next clicks) each compute from the state the previous call
  // just wrote, not from a `state` closure captured once per render.
  const setState = useCallback(
    (update: BookingTableUrlStateUpdate) => {
      const current = parseBookingTableUrlState(new URLSearchParams(window.location.search));
      const next = typeof update === 'function' ? update(current) : update;
      router.replace(`${pathname}?${serializeBookingTableUrlState(next).toString()}`);
    },
    [router, pathname],
  );

  return { state, setState };
}
