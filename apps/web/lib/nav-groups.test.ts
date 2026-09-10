import { describe, expect, it } from 'vitest';
import { findActiveHref } from './nav-groups';

describe('findActiveHref', () => {
  it('returns the longest matching navigation prefix', () => {
    expect(findActiveHref('/app/cleaners/teams')).toBe('/app/cleaners/teams');
    expect(findActiveHref('/app/cleaners')).toBe('/app/cleaners');
    expect(findActiveHref('/app/catalog/add-ons')).toBe('/app/catalog/add-ons');
  });

  it('returns undefined outside the app navigation', () => {
    expect(findActiveHref('/login')).toBeUndefined();
  });
});
