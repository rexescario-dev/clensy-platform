import { describe, expect, it } from 'vitest';
import { resolveBookingNavigationPagination } from './booking-navigation-pagination';

describe('resolveBookingNavigationPagination', () => {
  it('reflects pageInfo exactly when not loading — no regression to today\'s enabled/disabled behavior', () => {
    expect(resolveBookingNavigationPagination(false, { hasNextPage: true, hasPreviousPage: false })).toEqual({
      hasNextPage: true,
      hasPreviousPage: false,
    });
    expect(resolveBookingNavigationPagination(false, { hasNextPage: false, hasPreviousPage: true })).toEqual({
      hasNextPage: false,
      hasPreviousPage: true,
    });
    expect(resolveBookingNavigationPagination(false, { hasNextPage: true, hasPreviousPage: true })).toEqual({
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  // #65 finding 4: this is the fix itself — while a request is in flight
  // (loading), both flags are forced false regardless of what the
  // (possibly stale) pageInfo says, so Previous/Next are disabled for the
  // whole duration of any fetch/refetch, including the one a first Next
  // click itself triggers. A second rapid click therefore cannot land on
  // an enabled button while the first click's request/URL update is still
  // in flight.
  it('forces both hasNextPage and hasPreviousPage to false while loading, even if pageInfo says otherwise', () => {
    expect(resolveBookingNavigationPagination(true, { hasNextPage: true, hasPreviousPage: true })).toEqual({
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('defaults both flags to false when pageInfo is not yet available, whether or not loading', () => {
    expect(resolveBookingNavigationPagination(true, undefined)).toEqual({
      hasNextPage: false,
      hasPreviousPage: false,
    });
    expect(resolveBookingNavigationPagination(false, undefined)).toEqual({
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });
});
