'use client';

import { useClensyI18nContext } from './i18n-context';
import type { ClensyMessages } from './messages';

function resolveMessagePath(messages: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (value === null || value === undefined) return undefined;
    return (value as Record<string, unknown>)[segment];
  }, messages);
}

// const t = useClensyTranslations('bookings'); t('columns.customer')
// A component requests its own namespace and never touches locale/messages
// directly — those are resolved from context (or @clensy/web's own
// defaults, if no ClensyI18nProvider wraps the tree).
export function useClensyTranslations<N extends keyof ClensyMessages>(namespace: N) {
  const { messages } = useClensyI18nContext();
  const namespaceMessages = messages[namespace];

  return function t(key: string): string {
    const value = resolveMessagePath(namespaceMessages, key);
    return typeof value === 'string' ? value : key;
  };
}
