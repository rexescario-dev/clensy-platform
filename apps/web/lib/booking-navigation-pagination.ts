// #65 finding 4 (final review): `useBookingTableUrlState`'s `setState`
// reads `window.location.search` synchronously to compute the "current"
// state before calling `router.replace()`, which is asynchronous — the
// URL/history doesn't update instantly. Two rapid Next clicks landing
// within that window both read the same pre-update `window.location.search`
// and both compute `offset + limit` from the same stale `offset`, so one
// increment is silently dropped.
//
// This derivation gates the Bookings table's Previous/Next enabled state on
// `loading` (true both during the initial fetch and during any background
// refetch, per `notifyOnNetworkStatusChange: true` — including the refetch
// a first Next click itself triggers). `@clensy/ui`'s `Pagination` already
// disables Previous/Next from these two booleans, so for the full duration
// of any in-flight request — not merely until the click handler returns —
// both buttons are disabled. A second click physically cannot land on an
// enabled button while the first request (and its URL update) is still in
// flight, which closes the race by construction rather than by timing.
//
// Pure and independently testable: no GraphQL, no routing, no rendering.
export function resolveBookingNavigationPagination(
  loading: boolean,
  pageInfo: { hasNextPage: boolean | null; hasPreviousPage: boolean | null } | undefined,
): { hasNextPage: boolean; hasPreviousPage: boolean } {
  return {
    hasNextPage: !loading && (pageInfo?.hasNextPage ?? false),
    hasPreviousPage: !loading && (pageInfo?.hasPreviousPage ?? false),
  };
}
