import { describe, expect, it } from 'vitest';
import { escapeLikePattern, laundryOrdersQueryVariables } from './laundry-order-list-query';
import {
  DEFAULT_LAUNDRY_ORDER_LIST_STATE,
  parseLaundryOrderListState,
  withLaundrySort,
  type LaundryOrderListState,
} from './use-laundry-order-list-url-state';

const ORDER_ID = '3F2A9C1E-0B7D-4E55-9A10-6C2B8D4E7F01';

function variables(change: Partial<LaundryOrderListState>) {
  return laundryOrdersQueryVariables({ ...DEFAULT_LAUNDRY_ORDER_LIST_STATE, ...change });
}

describe('laundryOrdersQueryVariables', () => {
  it('defaults to page 1 of 20, createdAt DESC then id ASC, and no filter', () => {
    expect(laundryOrdersQueryVariables(DEFAULT_LAUNDRY_ORDER_LIST_STATE)).toEqual({
      filter: undefined,
      paging: { limit: 20, offset: 0 },
      sorting: [
        { direction: 'DESC', field: 'createdAt' },
        { direction: 'ASC', field: 'id' },
      ],
    });
  });

  it('searches customer.fullName with a server iLike contains match', () => {
    expect(variables({ search: 'ana' }).filter).toEqual({ customer: { fullName: { iLike: '%ana%' } } });
  });

  it('also matches the exact order id when the search is a full UUID', () => {
    expect(variables({ search: ORDER_ID }).filter).toEqual({
      or: [
        { customer: { fullName: { iLike: `%${ORDER_ID}%` } } },
        { id: { eq: ORDER_ID.toLowerCase() } },
      ],
    });
  });

  it.each([
    ['a v1 UUID', '6ba7b810-9dad-11d1-80b4-00c04fd430c8'],
    ['a v7 UUID', '01920c4e-7d2a-7cc3-9a40-1f0e5d6b8a21'],
    ['a nil-variant UUID', '00000000-0000-0000-0000-000000000000'],
    ['an uppercase UUID', ORDER_ID],
  ])('treats %s as a full id: any version or variant, either case', (_label, id) => {
    expect(variables({ search: id }).filter?.or?.[1]).toEqual({ id: { eq: id.toLowerCase() } });
  });

  it.each([
    ['a prefix', '3f2a9c1e'],
    ['one hex digit short', ORDER_ID.slice(0, -1)],
    ['no hyphens', ORDER_ID.replace(/-/g, '')],
    ['a non-hex digit', `${ORDER_ID.slice(0, -1)}g`],
    ['braces', `{${ORDER_ID}}`],
  ])('never sends an id match for %s', (_label, search) => {
    expect(JSON.stringify(variables({ search }).filter)).not.toContain('"id"');
  });

  it('filters status and fulfillment with eq, alongside the search', () => {
    expect(variables({ fulfillment: 'PICKUP', search: 'ana', status: 'READY' }).filter).toEqual({
      customer: { fullName: { iLike: '%ana%' } },
      fulfillmentType: { eq: 'PICKUP' },
      status: { eq: 'READY' },
    });
  });

  it('pages by offset and keeps id ASC as the tie-breaker for a non-unique sort', () => {
    expect(variables({ offset: 40, sortBy: 'status', sortOrder: 'asc' })).toMatchObject({
      paging: { limit: 20, offset: 40 },
      sorting: [
        { direction: 'ASC', field: 'status' },
        { direction: 'ASC', field: 'id' },
      ],
    });
  });

  it('does not repeat id when id is the primary sort', () => {
    expect(variables({ sortBy: 'id', sortOrder: 'desc' }).sorting).toEqual([{ direction: 'DESC', field: 'id' }]);
  });
});

describe('escapeLikePattern', () => {
  it('escapes the ILIKE wildcards and the escape character', () => {
    expect(escapeLikePattern('50% off_now\\x')).toBe('50\\% off\\_now\\\\x');
  });

  // Raw search text → server filter. Only the outer % pair is a wildcard.
  it.each([
    ['%', '50%', '%50\\%%'],
    ['_', 'a_b', '%a\\_b%'],
    ['\\', 'a\\b', '%a\\\\b%'],
  ])('escapes a user-typed %s in the customer filter', (_character, search, pattern) => {
    expect(variables({ search }).filter).toEqual({ customer: { fullName: { iLike: pattern } } });
  });
});

// The M5 sort table: URL / UI state → effective server sort.
describe('effective server sort', () => {
  const sortingFor = (query: string) =>
    laundryOrdersQueryVariables(parseLaundryOrderListState(new URLSearchParams(query))).sorting;
  const createdDesc = [
    { direction: 'DESC', field: 'createdAt' },
    { direction: 'ASC', field: 'id' },
  ];

  it.each([
    ['no sort parameters', '', createdDesc],
    ['explicit Created ascending', 'sortBy=createdAt&sortOrder=asc', [
      { direction: 'ASC', field: 'createdAt' },
      { direction: 'ASC', field: 'id' },
    ]],
    ['explicit Created descending', 'sortBy=createdAt&sortOrder=desc', createdDesc],
    ['an unsupported sort', 'sortBy=weightGrams&sortOrder=up', createdDesc],
  ])('%s → %j', (_label, query, expected) => {
    expect(sortingFor(query)).toEqual(expected);
  });

  it('cleared sort (null) → createdAt DESC, id ASC', () => {
    const statusAsc = parseLaundryOrderListState(new URLSearchParams('sortBy=status&sortOrder=asc'));
    expect(laundryOrdersQueryVariables(withLaundrySort(statusAsc, null)).sorting).toEqual(createdDesc);
  });
});
