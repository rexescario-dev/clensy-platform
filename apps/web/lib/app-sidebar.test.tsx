// @vitest-environment jsdom
import { IntlErrorCode, NextIntlClientProvider, type IntlError } from 'next-intl';
import { act, StrictMode, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// #198: the mobile nav Sheet closes on every pathname change (web shell spec
// §4.7), whatever caused it (link click, back/forward, redirect), and
// returning to an earlier pathname does not reopen it. These are
// characterization tests: they pin today's behavior before the
// latest-callback ref is replaced.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const inputs = vi.hoisted(() => ({ pathname: '/app/customers' }));

vi.mock('next/navigation', () => ({ usePathname: () => inputs.pathname }));
vi.mock('@clensy/client', () => ({
  useCurrentAdminQuery: () => ({
    data: { currentAdmin: { id: 'admin-1', role: 'TENANT_OWNER', scope: 'TENANT' } },
    loading: false,
  }),
}));

const { AppSidebar } = await import('../components/layout/app-sidebar');

// Only the two labels the assertions use. getMessages() is reserved for the
// i18n boundary tests (eslint no-restricted-imports), and these tests are
// not about copy: the group and item labels fall back to their keys.
const messages = {
  nav: { sidebar: { primary: 'Primary', mobileTitle: 'Primary navigation' } },
};

function ignoreMissingMessage(error: IntlError) {
  if (error.code !== IntlErrorCode.MISSING_MESSAGE) throw error;
}

interface HarnessProps {
  label?: string;
  calls?: string[];
}

// Wired like DashboardLayout: local open state, a toggle, and a new inline
// onMobileNavClose on every render.
function Harness({ label = 'first', calls }: HarnessProps) {
  const [open, setOpen] = useState(false);
  return (
    <NextIntlClientProvider locale="en" messages={messages} onError={ignoreMissingMessage}>
      <button type="button" aria-label="Toggle navigation menu" onClick={() => setOpen((o) => !o)}>
        Menu
      </button>
      <AppSidebar
        mobileNavOpen={open}
        onMobileNavClose={() => {
          calls?.push(label);
          setOpen(false);
        }}
      />
    </NextIntlClientProvider>
  );
}

let container: HTMLDivElement;
let root: Root;
let strict = false;

// Always a new element: React skips root.render when handed the same element
// object again, so Harness would not re-render and usePathname would not be
// read again.
function harness(props: HarnessProps) {
  const element = <Harness {...props} />;
  return strict ? <StrictMode>{element}</StrictMode> : element;
}

function mount(props: HarnessProps = {}, options: { strict?: boolean } = {}) {
  strict = options.strict ?? false;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root.render(harness(props)));
}

function rerender(props: HarnessProps = {}) {
  act(() => root.render(harness(props)));
}

function navigateTo(path: string, props: HarnessProps = {}) {
  inputs.pathname = path;
  rerender(props);
}

function toggleNav() {
  const toggle = document.querySelector<HTMLButtonElement>(
    'button[aria-label="Toggle navigation menu"]',
  );
  act(() => toggle!.click());
}

function sheetIsOpen() {
  return [...document.querySelectorAll('[role="dialog"]')].some((dialog) =>
    dialog.textContent?.includes('Primary navigation'),
  );
}

function desktopNav() {
  return [...document.querySelectorAll('nav[aria-label="Primary"]')].filter(
    (nav) => !nav.closest('[role="dialog"]'),
  );
}

afterEach(() => {
  try {
    act(() => root.unmount());
  } finally {
    container.remove();
    inputs.pathname = '/app/customers';
  }
});

describe('AppSidebar mobile nav closes on route change (§4.7)', () => {
  it('starts closed after mount', () => {
    mount();

    expect(sheetIsOpen()).toBe(false);
    expect(desktopNav()).toHaveLength(1);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('closes the open nav when the pathname changes', () => {
    mount();
    toggleNav();
    expect(sheetIsOpen()).toBe(true);

    navigateTo('/app/bookings');
    expect(sheetIsOpen()).toBe(false);
  });

  it('stays open when the parent re-renders on the same pathname', () => {
    mount();
    toggleNav();
    expect(sheetIsOpen()).toBe(true);

    rerender();
    expect(sheetIsOpen()).toBe(true);
  });

  it('does not reopen when returning to an earlier pathname', () => {
    mount();
    toggleNav();
    expect(sheetIsOpen()).toBe(true);
    navigateTo('/app/bookings');
    expect(sheetIsOpen()).toBe(false);
    navigateTo('/app/customers');
    expect(sheetIsOpen()).toBe(false);

    toggleNav();
    expect(sheetIsOpen()).toBe(true);
    navigateTo('/app/bookings');
    expect(sheetIsOpen()).toBe(false);
    navigateTo('/app/customers');
    expect(sheetIsOpen()).toBe(false);
  });

  it('stays closed when navigating while closed, and still opens afterwards', () => {
    mount();
    navigateTo('/app/bookings');
    expect(sheetIsOpen()).toBe(false);
    navigateTo('/app/jobs');
    expect(sheetIsOpen()).toBe(false);

    toggleNav();
    expect(sheetIsOpen()).toBe(true);
  });

  it('closes on each of several route changes in a row', () => {
    mount();
    for (const path of ['/app/bookings', '/app/jobs', '/app/laundry']) {
      toggleNav();
      expect(sheetIsOpen()).toBe(true);
      navigateTo(path);
      expect(sheetIsOpen()).toBe(false);
    }
  });

  it('calls the newest onMobileNavClose once on mount and once per pathname change', () => {
    const calls: string[] = [];
    mount({ label: 'first', calls });
    expect(calls).toEqual(['first']);

    rerender({ label: 'second', calls });
    expect(calls).toEqual(['first']);

    navigateTo('/app/bookings', { label: 'second', calls });
    expect(calls).toEqual(['first', 'second']);
  });

  it('opens and closes on route change under Strict Mode', () => {
    mount({}, { strict: true });
    expect(sheetIsOpen()).toBe(false);
    toggleNav();
    expect(sheetIsOpen()).toBe(true);

    navigateTo('/app/bookings');
    expect(sheetIsOpen()).toBe(false);
  });
});
