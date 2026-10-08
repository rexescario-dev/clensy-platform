import { describe, expect, it } from 'vitest';
import { landingTarget } from './landing-target';

// The /app landing decision: #89 plan decision 5, minus its /login outcome,
// which the layout's SessionGuard owns (session routing spec §4.4).
describe('landingTarget', () => {
  it('waits while currentAdmin is loading, even if stale data or an error is present', () => {
    expect(landingTarget({ currentAdmin: undefined, error: undefined, loading: true })).toBeUndefined();
    expect(
      landingTarget({ currentAdmin: { role: 'FINANCE', scope: 'TENANT' }, error: new Error('x'), loading: true }),
    ).toBeUndefined();
  });

  it('has no target on an error or a missing principal, and never /login', () => {
    expect(landingTarget({ currentAdmin: undefined, error: new Error('unauthenticated'), loading: false })).toBeUndefined();
    expect(landingTarget({ currentAdmin: null, error: undefined, loading: false })).toBeUndefined();
    expect(
      landingTarget({ currentAdmin: { role: 'TENANT_OWNER', scope: 'TENANT' }, error: new Error('x'), loading: false }),
    ).toBeUndefined();
  });

  it('otherwise lands the principal via landingHref', () => {
    expect(landingTarget({ currentAdmin: { role: 'SUPER_ADMIN', scope: 'PLATFORM' }, error: undefined, loading: false })).toBe(
      '/app/platform',
    );
    expect(landingTarget({ currentAdmin: { role: 'FINANCE', scope: 'TENANT' }, error: undefined, loading: false })).toBe(
      '/app/bookings',
    );
  });

  it('has no target for a tenant principal with nothing visible, so the page shows its empty message', () => {
    expect(landingTarget({ currentAdmin: { role: 'SUPER_ADMIN', scope: 'TENANT' }, error: undefined, loading: false })).toBeUndefined();
  });
});
