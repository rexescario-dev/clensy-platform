'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { deepMerge, type DeepPartial } from './deep-merge';
import { getDefaultMessages, type ClensyMessages } from './messages';

// Framework-agnostic — no next-intl import. apps/web owns pulling its own
// (next-intl) locale and passing it in here; @clensy/web only ever sees a
// plain string.
export function ClensyI18nProvider({ locale, overrides, children }: ClensyI18nProviderProps) {
  const value = useMemo<ClensyI18nContextValue>(
    () => ({
      locale: resolveLocale(locale),
      messages: deepMerge(getDefaultMessages(), overrides),
    }),
    [locale, overrides],
  );

  return <ClensyI18nContext.Provider value={value}>{children}</ClensyI18nContext.Provider>;
}

interface ClensyI18nContextValue {
  locale: string;
  messages: ClensyMessages;
}

const ClensyI18nContext = createContext<ClensyI18nContextValue | undefined>(undefined);

export interface ClensyI18nProviderProps {
  locale?: string;
  overrides?: DeepPartial<ClensyMessages>;
  children: ReactNode;
}

// One application/global locale, not per-component — resolved once here.
// Only "en" messages exist today (spec scope explicitly excludes adding a
// second locale); this still resolves a real locale string rather than
// hardcoding "en" everywhere, so adding one later doesn't touch call sites.
export function resolveLocale(locale?: string): string {
  return locale ?? 'en';
}

// A reusable component must work using only @clensy/web's own defaults with
// no application-level integration at all — no Provider in the tree is a
// valid, fully-supported state, not an error.
export function useClensyI18nContext(): ClensyI18nContextValue {
  const context = useContext(ClensyI18nContext);
  if (context) return context;
  return { locale: resolveLocale(undefined), messages: getDefaultMessages() };
}
