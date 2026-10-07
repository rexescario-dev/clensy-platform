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
      error: 'Unable to load your account.',
      loading: 'Loading…',
    });
    expect(nav.platform).toEqual({
      description: 'Platform administration is not available yet.',
      title: 'Platform',
    });
  });

  it('carries the unavailable-page copy in nav.unavailable', () => {
    expect(getMessages().nav.unavailable).toEqual({
      action: 'Go to your home page',
      message: "This page isn't available to you.",
    });
  });

  it('carries the user menu copy in nav.userMenu', () => {
    expect(getMessages().nav.userMenu).toEqual({
      loadingIdentity: 'Loading user identity',
      open: 'Open user menu',
      scope: { platform: 'Platform account', tenant: 'Organization account' },
      signingOut: 'Logging out…',
      signOut: 'Sign out',
      signOutError: 'Unable to log out. Please try again.',
      theme: 'Theme',
      themes: { dark: 'Dark', light: 'Light', system: 'System' },
    });
  });
});
