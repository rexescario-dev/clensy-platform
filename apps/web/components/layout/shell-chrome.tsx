'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  parseThemePreference,
  resolveAppearance,
  THEME_STORAGE_KEY,
  type ResolvedAppearance,
  type ThemePreference,
} from '../../lib/theme-preference';
import { cn } from '../../lib/utils';

type ShellThemeContextValue = {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  resolved: ResolvedAppearance;
};

type ThemeState = {
  preference: ThemePreference;
  prefersDark: boolean;
  ready: boolean;
};

const ShellThemeContext = createContext<ShellThemeContextValue | undefined>(undefined);

export function useShellTheme(): ShellThemeContextValue {
  const context = useContext(ShellThemeContext);

  if (!context) {
    throw new Error('useShellTheme must be used within ShellChrome');
  }

  return context;
}

export function ShellChrome({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const [theme, setTheme] = useState<ThemeState>({
    preference: 'system',
    prefersDark: false,
    ready: false,
  });

  useEffect(() => {
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)');
    let storedPreference: string | null = null;

    try {
      storedPreference = window.localStorage.getItem(THEME_STORAGE_KEY);
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }

    setTheme({
      preference: parseThemePreference(storedPreference),
      prefersDark: colorScheme.matches,
      ready: true,
    });

    const handleColorSchemeChange = (event: MediaQueryListEvent) => {
      setTheme((current) => ({ ...current, prefersDark: event.matches }));
    };

    colorScheme.addEventListener('change', handleColorSchemeChange);
    return () => colorScheme.removeEventListener('change', handleColorSchemeChange);
  }, []);

  const setPreference = useCallback((preference: ThemePreference) => {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Keep the in-memory preference usable when persistence is unavailable.
    }

    setTheme((current) => ({ ...current, preference }));
  }, []);

  const resolved = resolveAppearance(theme.preference, theme.prefersDark);
  const contextValue = useMemo(
    () => ({ preference: theme.preference, setPreference, resolved }),
    [resolved, setPreference, theme.preference],
  );

  return (
    <ShellThemeContext.Provider value={contextValue}>
      <div
        id="clensy-shell-chrome"
        className={cn(resolved, className)}
        style={theme.ready ? undefined : { visibility: 'hidden' }}
      >
        {children}
      </div>
    </ShellThemeContext.Provider>
  );
}
