// @vitest-environment jsdom
import { useClensyTranslations } from '@clensy/web';
import { NextIntlClientProvider } from 'next-intl';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppI18nProvider } from '../components/layout/app-i18n-provider';
import { getMessages } from '../i18n/messages';

// Tenant label overrides spec §6.2 isolation test: one mounted boundary,
// with the query result changed between steps. The provider must derive the
// tenant layer only from the current result and retain nothing.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
  app: {} as Record<string, unknown>,
  query: { data: undefined as unknown, loading: false },
}));

vi.mock('./clensy-i18n-overrides', () => ({
  get APP_I18N_OVERRIDES() {
    return state.app;
  },
}));
vi.mock('@clensy/client', () => ({ useCurrentAdminQuery: () => state.query }));

const UNSET = {
  ANALYST: null,
  CUSTOMER_SUPPORT: null,
  FINANCE: null,
  OPS_MANAGER: null,
  SCHEDULER: null,
  TENANT_OWNER: null,
};

function admin(tenantId: string, tenantLabelOverrides: unknown) {
  return { currentAdmin: { id: `admin-${tenantId}`, tenantId, role: 'FINANCE', scope: 'TENANT', tenantLabelOverrides } };
}

// Two role paths, so contamination of any stored role is visible: "FINANCE|SCHEDULER".
function RoleLabels() {
  const t = useClensyTranslations('roles');
  return <span>{`${t('FINANCE')}|${t('SCHEDULER')}`}</span>;
}

// A fresh element each call: re-rendering an identical element object lets
// React skip the subtree, so the provider would never re-read the query.
// Same component types at the same positions keep the same mounted instance.
function tree() {
  return (
    <NextIntlClientProvider locale="en" messages={getMessages()}>
      <AppI18nProvider>
        <RoleLabels />
      </AppI18nProvider>
    </NextIntlClientProvider>
  );
}

describe('app i18n boundary — isolation across identities', () => {
  let container: HTMLDivElement;
  let root: Root;

  function mount() {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  }

  // Rendering into the same root keeps the mounted AppI18nProvider instance;
  // React calls the mocked hook again, which returns the step's new result.
  function show(data: unknown) {
    state.query = { data, loading: false };
    act(() => root.render(tree()));
    return container.textContent;
  }

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    state.app = {};
  });

  it("never carries tenant A's label to tenant B or to a signed-out state, and keeps the static layer", () => {
    mount();
    // 1. Tenant A sets both roles.
    expect(show(admin('a', { locale: 'en', roles: { ...UNSET, FINANCE: 'Billing', SCHEDULER: 'Dispatch' } }))).toBe(
      'Billing|Dispatch',
    );
    expect(state.app).toEqual({}); // deepMerge did not write into the static layer
    // 2. Tenant B sets only FINANCE: A's SCHEDULER label must not survive.
    expect(show(admin('b', { locale: 'en', roles: { ...UNSET, FINANCE: 'Invoicing' } }))).toBe('Invoicing|Scheduler');
    expect(show(admin('b', null))).toBe('Finance|Scheduler');
    // 3. Signed out.
    expect(show(null)).toBe('Finance|Scheduler');

    // 4. Fresh mount: APP_I18N_OVERRIDES is a module constant in production
    // and cannot change under a mounted boundary.
    act(() => root.unmount());
    container.remove();
    state.app = { roles: { FINANCE: 'Static Finance' } };
    mount();
    expect(show(admin('b', null))).toBe('Static Finance|Scheduler');
    expect(state.app).toEqual({ roles: { FINANCE: 'Static Finance' } }); // unmutated
  });
});
