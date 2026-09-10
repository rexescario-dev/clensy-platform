export const THEME_STORAGE_KEY = 'clensy.theme';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedAppearance = 'light' | 'dark';

export function parseThemePreference(stored: string | null): ThemePreference {
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system';
}

export function resolveAppearance(
  preference: ThemePreference,
  prefersColorSchemeDark: boolean,
): ResolvedAppearance {
  if (preference === 'light') return 'light';
  if (preference === 'dark') return 'dark';
  return prefersColorSchemeDark ? 'dark' : 'light';
}
