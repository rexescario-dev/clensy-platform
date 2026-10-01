import { describe, expect, it } from 'vitest';
import { getMessages } from './messages';

describe('getMessages', () => {
  it('exposes exactly the v1 namespace set', () => {
    expect(Object.keys(getMessages()).sort()).toEqual(['common', 'nav', 'validation']);
  });

  it('carries the landing and platform placeholder copy in nav', () => {
    const { nav } = getMessages();
    expect(nav.landing).toEqual({
      empty: 'No areas are available for your account.',
      loading: 'Loading…',
    });
    expect(nav.platform).toEqual({
      description: 'Platform administration is not available yet.',
      title: 'Platform',
    });
  });
});
