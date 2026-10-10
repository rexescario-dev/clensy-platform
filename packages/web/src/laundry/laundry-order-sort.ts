import type { DataTableSortState } from '@clensy/ui';

// The `LaundryOrderSortFields` members (lifecycle spec §8.4.4). Weight and
// total are not server sort fields.
export type LaundryOrderSortKey = 'createdAt' | 'customerId' | 'fulfillmentType' | 'id' | 'status';

export interface LaundryOrderSortState {
  direction: 'asc' | 'desc';
  key: LaundryOrderSortKey;
}

export const LAUNDRY_ORDER_SORT_KEYS: readonly LaundryOrderSortKey[] = [
  'createdAt',
  'customerId',
  'fulfillmentType',
  'id',
  'status',
];

// The list's default sort: newest first. `null` from a sort transition
// always means "restore this default", nothing else.
export const DEFAULT_LAUNDRY_ORDER_SORT: Readonly<LaundryOrderSortState> = { direction: 'desc', key: 'createdAt' };

// Which column a `DataTable` sort callback came from. `DataTable` reports
// the clicked column's next state, or `null` after its own asc → desc →
// none cycle ends on the currently sorted column. A key or direction this
// list does not support returns `undefined`, so it never reaches URL state.
export function clickedLaundrySortKey(
  current: LaundryOrderSortState,
  reported: DataTableSortState | null,
): LaundryOrderSortKey | undefined {
  if (reported === null) return current.key;
  if (reported.direction !== 'asc' && reported.direction !== 'desc') return undefined;
  return isLaundryOrderSortKey(reported.key) ? reported.key : undefined;
}

export function isLaundryOrderSortKey(value: unknown): value is LaundryOrderSortKey {
  return LAUNDRY_ORDER_SORT_KEYS.includes(value as LaundryOrderSortKey);
}

// The list's own click transitions, independent of `DataTable`'s cycle:
//
// | Current sort    | Click     | Next                           |
// | --------------- | --------- | ------------------------------ |
// | anything else   | column X  | X asc                          |
// | X asc           | X         | X desc                         |
// | X desc, X ≠ Created | X     | null (default: Created desc)   |
// | Created desc    | Created   | Created asc                    |
//
// Created desc is the default, so "back to default" from it would be a
// click that does nothing. Created therefore toggles asc ↔ desc.
export function nextLaundryOrderSort(
  current: LaundryOrderSortState,
  clicked: LaundryOrderSortKey,
): LaundryOrderSortState | null {
  if (current.key !== clicked) return { direction: 'asc', key: clicked };
  if (current.direction === 'asc') return { direction: 'desc', key: clicked };
  if (clicked === DEFAULT_LAUNDRY_ORDER_SORT.key) return { direction: 'asc', key: clicked };
  return null;
}
