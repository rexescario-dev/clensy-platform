'use client';
import { useEffect, useState } from 'react';

const STORAGE_KEY = 'clensy.sidebar.collapsed';

export function useSidebarCollapsed(): [boolean, (value: boolean) => void] {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored !== null) setCollapsed(stored === 'true');
  }, []);

  function update(value: boolean) {
    setCollapsed(value);
    window.localStorage.setItem(STORAGE_KEY, String(value));
  }

  return [collapsed, update];
}
