import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAUNDRY_ORDER_LIST_STATE,
  hasActiveLaundryFilters,
  laundryListFiltersCleared,
  parseLaundryOrderListState,
  serializeLaundryOrderListState,
  withLaundryFilterChange,
  withLaundryPage,
  withLaundrySort,
  type LaundryOrderListState,
} from './use-laundry-order-list-url-state';

const onPage3: LaundryOrderListState = { ...DEFAULT_LAUNDRY_ORDER_LIST_STATE, offset: 40 };

describe('parseLaundryOrderListState', () => {
  it('defaults to createdAt desc, offset 0 and no search or filters', () => {
    expect(parseLaundryOrderListState(new URLSearchParams())).toEqual({
      fulfillment: null,
      offset: 0,
      search: '',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      status: null,
    });
  });

  it('reads every list key', () => {
    const params = new URLSearchParams('q=Ana&status=READY&fulfillment=PICKUP&sortBy=status&sortOrder=asc&offset=20');
    expect(parseLaundryOrderListState(params)).toEqual({
      fulfillment: 'PICKUP',
      offset: 20,
      search: 'Ana',
      sortBy: 'status',
      sortOrder: 'asc',
      status: 'READY',
    });
  });

  it('falls back to the default for malformed or unknown values', () => {
    const params = new URLSearchParams(
      'status=SHIPPED&fulfillment=COURIER&sortBy=weightGrams&sortOrder=up&offset=-20',
    );
    expect(parseLaundryOrderListState(params)).toEqual(DEFAULT_LAUNDRY_ORDER_LIST_STATE);
    expect(parseLaundryOrderListState(new URLSearchParams('offset=2.5')).offset).toBe(0);
    expect(parseLaundryOrderListState(new URLSearchParams('sortBy=totalMinorUnits')).sortBy).toBe('createdAt');
  });

  it('snaps the offset down to a page boundary', () => {
    expect(parseLaundryOrderListState(new URLSearchParams('offset=5')).offset).toBe(0);
    expect(parseLaundryOrderListState(new URLSearchParams('offset=45')).offset).toBe(40);
    expect(parseLaundryOrderListState(new URLSearchParams('offset=60')).offset).toBe(60);
  });

  // #171 (M7 P3-3): only plain decimal digits are an offset; `Number()`'s other spellings are not.
  it.each(['0x7fffffff', '1e3', '2.147483647e9', ' 60 ', '+20', '60abc'])('treats offset=%j as malformed', (raw) => {
    expect(parseLaundryOrderListState(new URLSearchParams({ offset: raw })).offset).toBe(0);
  });

  // #171: `OffsetPaging.offset` is a GraphQL Int; the API rejects anything above 2147483647.
  it('treats an offset outside the GraphQL Int range as malformed', () => {
    expect(parseLaundryOrderListState(new URLSearchParams('offset=2147483647')).offset).toBe(2147483640);
    expect(parseLaundryOrderListState(new URLSearchParams('offset=2147483648')).offset).toBe(0);
    expect(parseLaundryOrderListState(new URLSearchParams('offset=3000000000')).offset).toBe(0);
  });

  it('trims the search and caps it at 200 characters', () => {
    expect(parseLaundryOrderListState(new URLSearchParams('q=%20%20ana%20')).search).toBe('ana');
    expect(parseLaundryOrderListState(new URLSearchParams(`q=${'a'.repeat(250)}`)).search).toHaveLength(200);
  });
});

describe('serializeLaundryOrderListState', () => {
  it('writes sort and offset always, and search and filters only when set', () => {
    expect(serializeLaundryOrderListState(DEFAULT_LAUNDRY_ORDER_LIST_STATE).toString()).toBe(
      'sortBy=createdAt&sortOrder=desc&offset=0',
    );
    const state: LaundryOrderListState = {
      fulfillment: 'DELIVERY',
      offset: 20,
      search: 'Ana Reyes',
      sortBy: 'status',
      sortOrder: 'asc',
      status: 'PAID',
    };
    expect(parseLaundryOrderListState(serializeLaundryOrderListState(state))).toEqual(state);
  });

  it('keeps every param it does not own, and replaces its own', () => {
    const base = new URLSearchParams('detail=o1&q=old&status=READY&offset=40&utm_source=mail&tab=a&tab=b');
    const params = serializeLaundryOrderListState(laundryListFiltersCleared(parseLaundryOrderListState(base)), base);
    expect(params.get('detail')).toBe('o1');
    expect(params.get('utm_source')).toBe('mail');
    expect(params.getAll('tab')).toEqual(['a', 'b']);
    expect(params.has('q')).toBe(false);
    expect(params.has('status')).toBe(false);
    expect(params.get('offset')).toBe('0');
  });
});

describe('withLaundryFilterChange', () => {
  it('resets the offset when the search, a filter or the sort changes', () => {
    expect(withLaundryFilterChange(onPage3, { search: 'ana' })).toMatchObject({ offset: 0, search: 'ana' });
    expect(withLaundryFilterChange(onPage3, { status: 'READY' })).toMatchObject({ offset: 0, status: 'READY' });
    expect(withLaundryFilterChange(onPage3, { fulfillment: 'PICKUP' })).toMatchObject({ fulfillment: 'PICKUP', offset: 0 });
    expect(withLaundryFilterChange(onPage3, { sortBy: 'status', sortOrder: 'asc' })).toMatchObject({
      offset: 0,
      sortBy: 'status',
      sortOrder: 'asc',
    });
    expect(withLaundryFilterChange(onPage3, { sortOrder: 'asc' })).toMatchObject({ offset: 0, sortOrder: 'asc' });
  });

  it('returns the same state when nothing changes, including whitespace-only search edits', () => {
    const searching = { ...onPage3, search: 'ana' };
    expect(withLaundryFilterChange(searching, { search: ' ana  ' })).toBe(searching);
    expect(withLaundryFilterChange(onPage3, { status: null })).toBe(onPage3);
  });
});

describe('withLaundryPage', () => {
  it('keeps a page whose offset is the last in the GraphQL Int range, and treats the next as page 1', () => {
    expect(withLaundryPage(DEFAULT_LAUNDRY_ORDER_LIST_STATE, 107374183).offset).toBe(2147483640);
    expect(withLaundryPage(DEFAULT_LAUNDRY_ORDER_LIST_STATE, 107374184).offset).toBe(0);
  });

  it('maps the 1-based page to an offset of 20 per page', () => {
    expect(withLaundryPage(DEFAULT_LAUNDRY_ORDER_LIST_STATE, 1).offset).toBe(0);
    expect(withLaundryPage(DEFAULT_LAUNDRY_ORDER_LIST_STATE, 3).offset).toBe(40);
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER])(
    'treats page %s as page 1',
    (page) => {
      expect(withLaundryPage(onPage3, page).offset).toBe(0);
    },
  );
});

describe('laundryListFiltersCleared and hasActiveLaundryFilters', () => {
  it('clears search and both filters, keeps the sort, and returns to page 1', () => {
    const state: LaundryOrderListState = {
      fulfillment: 'PICKUP',
      offset: 40,
      search: 'ana',
      sortBy: 'status',
      sortOrder: 'asc',
      status: 'READY',
    };
    expect(hasActiveLaundryFilters(state)).toBe(true);
    const cleared = laundryListFiltersCleared(state);
    expect(cleared).toEqual({ fulfillment: null, offset: 0, search: '', sortBy: 'status', sortOrder: 'asc', status: null });
    expect(hasActiveLaundryFilters(cleared)).toBe(false);
  });

  it('does not treat a sort as a filter', () => {
    expect(hasActiveLaundryFilters({ ...DEFAULT_LAUNDRY_ORDER_LIST_STATE, sortBy: 'status' })).toBe(false);
  });
});

describe('withLaundrySort', () => {
  // The four rows of the M5 sort table: URL state → effective server sort
  // is covered in laundry-order-list-query.test.ts; this pins the state.
  it('applies a column sort and returns to page 1', () => {
    expect(withLaundrySort(onPage3, { direction: 'asc', key: 'status' })).toMatchObject({
      offset: 0,
      sortBy: 'status',
      sortOrder: 'asc',
    });
    expect(withLaundrySort(onPage3, { direction: 'asc', key: 'createdAt' })).toMatchObject({
      sortBy: 'createdAt',
      sortOrder: 'asc',
    });
  });

  it('restores createdAt desc for null, always', () => {
    const statusAsc = { ...onPage3, sortBy: 'status' as const, sortOrder: 'asc' as const };
    expect(withLaundrySort(statusAsc, null)).toMatchObject({ offset: 0, sortBy: 'createdAt', sortOrder: 'desc' });
    const createdAsc = { ...onPage3, sortOrder: 'asc' as const };
    expect(withLaundrySort(createdAsc, null)).toMatchObject({ sortBy: 'createdAt', sortOrder: 'desc' });
    // Already the default: nothing changes, so the page is kept.
    expect(withLaundrySort(onPage3, null)).toBe(onPage3);
  });
});
