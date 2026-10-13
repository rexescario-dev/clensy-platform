import { describe, expect, it } from 'vitest';
import {
  LAUNDRY_CUSTOMER_SEARCH_DEBOUNCE_MS,
  LAUNDRY_CUSTOMER_SEARCH_LIMIT,
  laundryCustomerSearchVariables,
} from './use-laundry-customer-search';

describe('laundryCustomerSearchVariables', () => {
  it('filters fullName with a contains iLike, 20 at most, by name then id', () => {
    expect(laundryCustomerSearchVariables('ana')).toEqual({
      filter: { fullName: { iLike: '%ana%' } },
      paging: { limit: 20 },
      sorting: [
        { direction: 'ASC', field: 'fullName' },
        { direction: 'ASC', field: 'id' },
      ],
    });
    expect(LAUNDRY_CUSTOMER_SEARCH_LIMIT).toBe(20);
    expect(LAUNDRY_CUSTOMER_SEARCH_DEBOUNCE_MS).toBe(300);
  });

  it('matches %, _ and \\ literally, as the list search does', () => {
    expect(laundryCustomerSearchVariables('50% off_a\\b').filter).toEqual({
      fullName: { iLike: '%50\\% off\\_a\\\\b%' },
    });
  });
});
