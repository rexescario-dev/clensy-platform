import { describe, expect, it } from 'vitest';
import {
  parseThemePreference,
  resolveAppearance,
  THEME_STORAGE_KEY,
} from './theme-preference';

describe('parseThemePreference', () => {
  it('defaults missing and invalid values to system', () => {
    expect(parseThemePreference(null)).toBe('system');
    expect(parseThemePreference('')).toBe('system');
    expect(parseThemePreference('auto')).toBe('system');
    expect(parseThemePreference('DARK')).toBe('system');
  });

  it('accepts light, dark, and system', () => {
    expect(parseThemePreference('light')).toBe('light');
    expect(parseThemePreference('dark')).toBe('dark');
    expect(parseThemePreference('system')).toBe('system');
  });
});

describe('resolveAppearance', () => {
  it('light and dark ignore OS', () => {
    expect(resolveAppearance('light', true)).toBe('light');
    expect(resolveAppearance('light', false)).toBe('light');
    expect(resolveAppearance('dark', true)).toBe('dark');
    expect(resolveAppearance('dark', false)).toBe('dark');
  });

  it('system follows prefers-color-scheme', () => {
    expect(resolveAppearance('system', true)).toBe('dark');
    expect(resolveAppearance('system', false)).toBe('light');
  });
});

describe('THEME_STORAGE_KEY', () => {
  it('is clensy.theme', () => {
    expect(THEME_STORAGE_KEY).toBe('clensy.theme');
  });
});
