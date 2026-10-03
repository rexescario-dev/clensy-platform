import { CreateStaffForm, StaffDataTable } from '@clensy/web';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppI18nProvider } from '../components/layout/app-i18n-provider';
import { ShellChrome } from '../components/layout/shell-chrome';
import { UserMenu } from '../components/layout/user-menu';
import { getMessages } from '../i18n/messages';

// Tenant label overrides spec §4.5, §6.2. Both layers are mutable per test:
// vi.mock factories are hoisted ahead of the imports, and the getter is read
// at use time, so AppI18nProvider sees each test's static layer.
const state = vi.hoisted(() => ({
  app: {} as Record<string, unknown>,
  query: { data: undefined as unknown, loading: false } as { data: unknown; error?: Error; loading: boolean },
}));

vi.mock('./clensy-i18n-overrides', () => ({
  get APP_I18N_OVERRIDES() {
    return state.app;
  },
}));
vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useApolloClient: () => ({ clearStore: vi.fn() }),
}));
vi.mock('@clensy/client', () => ({
  useCurrentAdminQuery: () => state.query,
  useLogoutMutation: () => [vi.fn(), { loading: false }],
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

const UNSET = {
  ANALYST: null,
  CUSTOMER_SUPPORT: null,
  FINANCE: null,
  OPS_MANAGER: null,
  SCHEDULER: null,
  TENANT_OWNER: null,
};

function financeAdmin(tenantLabelOverrides: unknown) {
  return { currentAdmin: { id: 'admin-1', tenantId: 'tenant-a', role: 'FINANCE', scope: 'TENANT', tenantLabelOverrides } };
}

const BILLING = { locale: 'en', roles: { ...UNSET, FINANCE: 'Billing' } };

function renderInBoundary(node: ReactNode, locale = 'en') {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={getMessages()}>
      <AppI18nProvider>{node}</AppI18nProvider>
    </NextIntlClientProvider>,
  );
}

const renderUserMenu = (locale?: string) =>
  renderInBoundary(
    <ShellChrome>
      <UserMenu />
    </ShellChrome>,
    locale,
  );
const renderStaffTable = () =>
  renderInBoundary(
    <StaffDataTable
      staff={[{ id: 'staff-1', email: 'finance@example.com', isActive: true, role: 'FINANCE' }]}
      currentAdminId="admin-1"
      onDisable={() => {}}
    />,
  );
const renderCreateForm = () =>
  renderInBoundary(<CreateStaffForm values={{ email: '', password: '', role: 'CUSTOMER_SUPPORT' }} onChange={() => {}} />);

describe('app i18n boundary — tenant layer', () => {
  beforeEach(() => {
    state.app = {};
    state.query = { data: financeAdmin(BILLING), loading: false };
  });

  it('applies a tenant FINANCE label in the user menu, staff table and create-staff form', () => {
    expect(renderUserMenu()).toMatch(/>Billing<\/span>/);
    expect(renderStaffTable()).toMatch(/>Billing</);
    const form = renderCreateForm();
    expect(form).toContain('<option value="FINANCE">Billing</option>');
    for (const html of [renderUserMenu(), renderStaffTable(), form]) {
      expect(html).not.toMatch(/>Finance</);
    }
  });

  it('keeps sibling roles at their package defaults', () => {
    expect(renderCreateForm()).toContain('<option value="TENANT_OWNER">Tenant Owner</option>');
  });

  it('lets the tenant layer win over the static app layer (deepMerge argument order)', () => {
    state.app = { roles: { FINANCE: 'Static Finance' } };
    expect(renderStaffTable()).toMatch(/>Billing</);
    expect(renderStaffTable()).not.toContain('Static Finance');
  });

  it('renders package defaults when tenantLabelOverrides is null', () => {
    state.query = { data: financeAdmin(null), loading: false };
    expect(renderStaffTable()).toMatch(/>Finance</);
  });

  it('does not apply en tenant labels under another locale', () => {
    expect(renderUserMenu('fil')).not.toMatch(/>Billing</);
  });

  it('uses cached currentAdmin data while a refetch is in flight', () => {
    state.query = { data: financeAdmin(BILLING), loading: true };
    expect(renderStaffTable()).toMatch(/>Billing</);
  });

  it('renders package defaults while loading with no data, and on an error with no data', () => {
    state.query = { data: undefined, loading: true };
    expect(renderStaffTable()).toMatch(/>Finance</);
    state.query = { data: undefined, error: new Error('network'), loading: false };
    expect(renderStaffTable()).toMatch(/>Finance</);
  });
});
