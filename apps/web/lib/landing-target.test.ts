import { describe, expect, it } from 'vitest';
import { landingTarget } from './landing-target';

// Characterizes the /app landing decision as shipped in #89 (plan decision 5).
describe('landingTarget', () => {
  it('waits while currentAdmin is loading, even if stale data or an error is present', () => {
    expect(landingTarget({ currentAdmin: undefined, error: undefined, loading: true })).toBeUndefined();
    expect(
      landingTarget({ currentAdmin: { role: 'FINANCE', scope: 'TENANT' }, error: new Error('x'), loading: true }),
    ).toBeUndefined();
  });

  it('sends an errored or missing session to /login', () => {
    expect(landingTarget({ currentAdmin: undefined, error: new Error('unauthenticated'), loading: false })).toBe('/login');
    expect(landingTarget({ currentAdmin: null, error: undefined, loading: false })).toBe('/login');
    expect(
      landingTarget({ currentAdmin: { role: 'TENANT_OWNER', scope: 'TENANT' }, error: new Error('x'), loading: false }),
    ).toBe('/login');
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
