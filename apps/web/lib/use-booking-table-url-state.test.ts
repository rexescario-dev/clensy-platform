import { describe, expect, it } from 'vitest';
import { parseBookingTableUrlState, serializeBookingTableUrlState } from './use-booking-table-url-state';

describe('parseBookingTableUrlState', () => {
  it('returns the canonical defaults for an empty URLSearchParams', () => {
    expect(parseBookingTableUrlState(new URLSearchParams())).toEqual({
      limit: 20,
      offset: 0,
      sortBy: 'scheduledAt',
      sortOrder: 'desc',
    });
  });

  it('parses every valid explicit value', () => {
    const params = new URLSearchParams('sortBy=status&sortOrder=asc&limit=50&offset=100');
    expect(parseBookingTableUrlState(params)).toEqual({ limit: 50, offset: 100, sortBy: 'status', sortOrder: 'asc' });
  });

  it('falls back to the default sortBy for an unwhitelisted value', () => {
    expect(parseBookingTableUrlState(new URLSearchParams('sortBy=createdAt')).sortBy).toBe('scheduledAt');
    expect(parseBookingTableUrlState(new URLSearchParams('sortBy=customer')).sortBy).toBe('scheduledAt');
  });

  it('falls back to the default sortOrder for an invalid value', () => {
    expect(parseBookingTableUrlState(new URLSearchParams('sortOrder=up')).sortOrder).toBe('desc');
  });

  it('falls back to the default limit for an unsupported value', () => {
    expect(parseBookingTableUrlState(new URLSearchParams('limit=17')).limit).toBe(20);
    expect(parseBookingTableUrlState(new URLSearchParams('limit=abc')).limit).toBe(20);
  });

  it('accepts every supported page size, including the default (20)', () => {
    for (const limit of [10, 20, 25, 50, 100]) {
      expect(parseBookingTableUrlState(new URLSearchParams(`limit=${limit}`)).limit).toBe(limit);
    }
  });

  it('falls back to offset 0 for a negative or non-numeric offset', () => {
    expect(parseBookingTableUrlState(new URLSearchParams('offset=-5')).offset).toBe(0);
    expect(parseBookingTableUrlState(new URLSearchParams('offset=abc')).offset).toBe(0);
  });

  it('never names the offset parameter "cursor"', () => {
    // Documents the spec §4.6/§8 requirement directly: a URL using `cursor`
    // instead of `offset` must NOT be treated as carrying pagination state.
    expect(parseBookingTableUrlState(new URLSearchParams('cursor=25')).offset).toBe(0);
  });
});

describe('serializeBookingTableUrlState', () => {
  it('round-trips every valid state through parseBookingTableUrlState', () => {
    const state = { limit: 50 as const, offset: 100, sortBy: 'status' as const, sortOrder: 'asc' as const };
    expect(parseBookingTableUrlState(serializeBookingTableUrlState(state))).toEqual(state);
  });

  it('produces a URL using "offset", never "cursor"', () => {
    const params = serializeBookingTableUrlState({ limit: 20, offset: 40, sortBy: 'scheduledAt', sortOrder: 'desc' });
    expect(params.has('offset')).toBe(true);
    expect(params.has('cursor')).toBe(false);
  });
});
