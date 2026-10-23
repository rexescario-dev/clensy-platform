// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSidebarCollapsed } from './use-sidebar-collapsed';

// #197: collapse persists under `clensy.sidebar.collapsed` (web shell spec
// §4.4), read only in the mount Effect so the first render is always
// expanded. Storage is best-effort: when reading fails the sidebar starts
// expanded, and when writing fails the toggle still changes the state. The
// failures are stubbed here; they are not reproduced in a real browser.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const KEY = 'clensy.sidebar.collapsed';

let latest: [boolean, (value: boolean) => void];
let container: HTMLDivElement | undefined;
let root: Root | undefined;

function Probe() {
  latest = useSidebarCollapsed();
  return <output>{latest[0] ? 'collapsed' : 'expanded'}</output>;
}

function mount() {
  container = document.createElement('div');
  document.body.append(container);
  const target = createRoot(container);
  root = target;
  act(() => target.render(<Probe />));
}

function toggle(value: boolean) {
  act(() => latest[1](value));
}

function shown(): string | null {
  return container?.querySelector('output')?.textContent ?? null;
}

function blocked(): never {
  throw new DOMException('blocked', 'SecurityError');
}

function full(): never {
  throw new DOMException('full', 'QuotaExceededError');
}

afterEach(() => {
  try {
    act(() => root?.unmount());
  } finally {
    container?.remove();
    container = undefined;
    root = undefined;
    vi.restoreAllMocks();
    localStorage.clear();
  }
});

describe('useSidebarCollapsed persistence (characterization)', () => {
  it('renders expanded before mount even when collapsed is stored', () => {
    localStorage.setItem(KEY, 'true');

    expect(renderToString(<Probe />)).toContain('>expanded<');
  });

  it('starts expanded when nothing is stored', () => {
    mount();

    expect(shown()).toBe('expanded');
  });

  it.each([
    ['true', 'collapsed'],
    ['false', 'expanded'],
  ])('restores the stored value after mount (%s)', (stored, expected) => {
    localStorage.setItem(KEY, stored);

    mount();

    expect(shown()).toBe(expected);
  });

  it('persists each toggle', () => {
    mount();

    toggle(true);
    expect(shown()).toBe('collapsed');
    expect(localStorage.getItem(KEY)).toBe('true');

    toggle(false);
    expect(shown()).toBe('expanded');
    expect(localStorage.getItem(KEY)).toBe('false');
  });
});

describe('useSidebarCollapsed with unavailable storage', () => {
  it('starts expanded when reading storage throws, and still saves toggles', () => {
    localStorage.setItem(KEY, 'true');
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);

    expect(mount).not.toThrow();
    expect(getItem).toHaveBeenCalledWith(KEY);
    expect(shown()).toBe('expanded');

    expect(() => toggle(true)).not.toThrow();
    expect(shown()).toBe('collapsed');
    toggle(false);
    expect(shown()).toBe('expanded');

    vi.restoreAllMocks();
    expect(localStorage.getItem(KEY)).toBe('false');
  });

  it('starts expanded and toggles in memory when localStorage itself throws', () => {
    const accessor = vi.spyOn(window, 'localStorage', 'get').mockImplementation(blocked);

    expect(mount).not.toThrow();
    const readCalls = accessor.mock.calls.length;
    expect(readCalls).toBeGreaterThan(0);
    expect(shown()).toBe('expanded');

    expect(() => toggle(true)).not.toThrow();
    expect(shown()).toBe('collapsed');
    expect(() => toggle(false)).not.toThrow();
    expect(shown()).toBe('expanded');
    expect(accessor.mock.calls.length).toBe(readCalls + 2);
  });

  it('keeps toggling in memory when writing storage throws', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(full);
    mount();
    expect(shown()).toBe('expanded');

    expect(() => toggle(true)).not.toThrow();
    expect(setItem).toHaveBeenLastCalledWith(KEY, 'true');
    expect(shown()).toBe('collapsed');

    expect(() => toggle(false)).not.toThrow();
    expect(setItem).toHaveBeenLastCalledWith(KEY, 'false');
    expect(shown()).toBe('expanded');
  });

  it('still restores the stored value when only writing throws', () => {
    localStorage.setItem(KEY, 'true');
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(full);

    mount();
    expect(shown()).toBe('collapsed');

    expect(() => toggle(false)).not.toThrow();
    expect(setItem).toHaveBeenCalledWith(KEY, 'false');
    expect(shown()).toBe('expanded');
  });
});
