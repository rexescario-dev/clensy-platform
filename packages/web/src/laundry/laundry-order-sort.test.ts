import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LAUNDRY_ORDER_SORT,
  clickedLaundrySortKey,
  nextLaundryOrderSort,
  type LaundryOrderSortKey,
  type LaundryOrderSortState,
} from './laundry-order-sort';

const sort = (key: LaundryOrderSortKey, direction: 'asc' | 'desc'): LaundryOrderSortState => ({ direction, key });

describe('nextLaundryOrderSort', () => {
  it.each([
    // [current, clicked, next]
    [DEFAULT_LAUNDRY_ORDER_SORT, 'createdAt', sort('createdAt', 'asc')],
    [sort('createdAt', 'asc'), 'createdAt', sort('createdAt', 'desc')],
    [DEFAULT_LAUNDRY_ORDER_SORT, 'status', sort('status', 'asc')],
    [sort('status', 'asc'), 'status', sort('status', 'desc')],
    [sort('status', 'desc'), 'status', null],
    [sort('status', 'desc'), 'createdAt', sort('createdAt', 'asc')],
    [sort('createdAt', 'asc'), 'fulfillmentType', sort('fulfillmentType', 'asc')],
    [sort('id', 'desc'), 'id', null],
  ] as const)('%j + click %s → %j', (current, clicked, next) => {
    expect(nextLaundryOrderSort(current, clicked)).toEqual(next);
  });

  it('cycles a non-default column asc → desc → default, and Created asc ↔ desc', () => {
    const statusCycle = [sort('status', 'asc'), sort('status', 'desc'), null];
    let current: LaundryOrderSortState = DEFAULT_LAUNDRY_ORDER_SORT;
    for (const expected of statusCycle) {
      const next = nextLaundryOrderSort(current, 'status');
      expect(next).toEqual(expected);
      current = next ?? DEFAULT_LAUNDRY_ORDER_SORT; // null restores the default
    }
    expect(current).toEqual(DEFAULT_LAUNDRY_ORDER_SORT);

    const createdCycle = [sort('createdAt', 'asc'), sort('createdAt', 'desc'), sort('createdAt', 'asc')];
    current = DEFAULT_LAUNDRY_ORDER_SORT;
    for (const expected of createdCycle) {
      const next = nextLaundryOrderSort(current, 'createdAt');
      expect(next).toEqual(expected);
      current = next ?? DEFAULT_LAUNDRY_ORDER_SORT;
    }
  });
});

describe('clickedLaundrySortKey', () => {
  it('takes the clicked column from what DataTable reports, including its null', () => {
    // DataTable's `nextSortState`: a new column starts asc; asc → desc;
    // desc → null ("none") on the column that is already sorted.
    expect(clickedLaundrySortKey(DEFAULT_LAUNDRY_ORDER_SORT, { direction: 'asc', key: 'status' })).toBe('status');
    expect(clickedLaundrySortKey(sort('status', 'asc'), { direction: 'desc', key: 'status' })).toBe('status');
    // A click on Created while Created desc is reported as null. It is still a Created click.
    expect(clickedLaundrySortKey(DEFAULT_LAUNDRY_ORDER_SORT, null)).toBe('createdAt');
    expect(clickedLaundrySortKey(sort('status', 'desc'), null)).toBe('status');
  });

  it('rejects a key or direction the list does not support', () => {
    expect(clickedLaundrySortKey(DEFAULT_LAUNDRY_ORDER_SORT, { direction: 'asc', key: 'weightGrams' })).toBeUndefined();
    expect(clickedLaundrySortKey(DEFAULT_LAUNDRY_ORDER_SORT, { direction: 'asc', key: 'customer' })).toBeUndefined();
    expect(
      clickedLaundrySortKey(DEFAULT_LAUNDRY_ORDER_SORT, { direction: 'sideways' as 'asc', key: 'status' }),
    ).toBeUndefined();
  });
});
