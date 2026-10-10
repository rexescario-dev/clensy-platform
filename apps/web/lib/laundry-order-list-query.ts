import type { LaundryOrderFilter, LaundryOrderSort, LaundryOrdersQueryVariables } from '@clensy/client';
import { LAUNDRY_ORDER_PAGE_SIZE, type LaundryOrderListState } from './use-laundry-order-list-url-state';

// Any canonical 8-4-4-4-12 hex UUID, either case. Version and variant are
// deliberately not checked: Postgres accepts every value of this shape,
// and rejects anything else with "invalid input syntax for type uuid".
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Postgres `ILIKE` treats `%` and `_` as wildcards and `\` as the default
// escape, so a customer named "50% Off" is matched literally.
export function escapeLikePattern(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`);
}

// The server-side filter for the list (lifecycle spec §8.4.4). Customer
// name is a contains match on the `customer` relation. A full UUID also
// matches the order id exactly: partial `iLike` on the uuid column is
// rejected by Postgres (#163 spike), and `eq` with a non-UUID errors, so
// `id` is only added for a full UUID.
export function laundryOrderListFilter(state: LaundryOrderListState): LaundryOrderFilter | undefined {
  const filter: LaundryOrderFilter = {};
  if (state.search !== '') {
    const byName: LaundryOrderFilter = { customer: { fullName: { iLike: `%${escapeLikePattern(state.search)}%` } } };
    if (UUID.test(state.search)) {
      filter.or = [byName, { id: { eq: state.search.toLowerCase() } }];
    } else {
      Object.assign(filter, byName);
    }
  }
  if (state.status !== null) filter.status = { eq: state.status };
  if (state.fulfillment !== null) filter.fulfillmentType = { eq: state.fulfillment };
  return Object.keys(filter).length === 0 ? undefined : filter;
}

// Primary sort, then `id ASC` as the tie-breaker whenever the primary key
// is not already `id`. The API does not add a tie-breaker; this does. It
// stays ASC for a DESC primary sort: it only makes equal rows page stably.
export function laundryOrderListSorting(state: LaundryOrderListState): LaundryOrderSort[] {
  const primary: LaundryOrderSort = { direction: state.sortOrder === 'asc' ? 'ASC' : 'DESC', field: state.sortBy };
  return state.sortBy === 'id' ? [primary] : [primary, { direction: 'ASC', field: 'id' }];
}

export function laundryOrdersQueryVariables(state: LaundryOrderListState): LaundryOrdersQueryVariables {
  return {
    filter: laundryOrderListFilter(state),
    paging: { limit: LAUNDRY_ORDER_PAGE_SIZE, offset: state.offset },
    sorting: laundryOrderListSorting(state),
  };
}
