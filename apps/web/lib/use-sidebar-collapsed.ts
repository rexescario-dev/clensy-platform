'use client';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'clensy.sidebar.collapsed';

export function useSidebarCollapsed(): [boolean, (value: boolean) => void] {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let stored: string | null = null;

    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // Storage can be unavailable in restricted browser contexts.
    }

    if (stored !== null) setCollapsed(stored === 'true');
  }, []);

  function update(value: boolean) {
    setCollapsed(value);

    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Keep the in-memory state usable when persistence is unavailable.
    }
  }

  return [collapsed, update];
}
