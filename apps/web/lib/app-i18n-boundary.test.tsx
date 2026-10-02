import { CreateStaffForm, StaffDataTable, useClensyI18nContext } from '@clensy/web';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AppI18nProvider } from '../components/layout/app-i18n-provider';
import { ShellChrome } from '../components/layout/shell-chrome';
import { UserMenu } from '../components/layout/user-menu';
import { getMessages } from '../i18n/messages';

// Spec §6.2: the overrides module must be mocked before AppI18nProvider is
// evaluated, or the committed `{}` could be captured. Vitest hoists this
// vi.mock call ahead of the static imports, which guarantees that ordering.
// The committed module is unchanged (pinned unmocked in
// clensy-i18n-overrides.test.ts).
vi.mock('./clensy-i18n-overrides', () => ({
  APP_I18N_OVERRIDES: { roles: { FINANCE: 'Billing' } },
}));

// UserMenu's data and navigation dependencies, mocked: this test is about the
// i18n boundary, not GraphQL or routing.
vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useApolloClient: () => ({ clearStore: vi.fn() }),
}));
vi.mock('@clensy/client', () => ({
  useCurrentAdminQuery: () => ({
    data: { currentAdmin: { id: 'admin-1', role: 'FINANCE', scope: 'TENANT' } },
    loading: false,
  }),
  useLogoutMutation: () => [vi.fn(), { loading: false }],
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

function renderInBoundary(node: ReactNode, locale = 'en') {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={getMessages()}>
      <AppI18nProvider>{node}</AppI18nProvider>
    </NextIntlClientProvider>,
  );
}

function LocaleProbe() {
  return <span data-testid="locale">{useClensyI18nContext().locale}</span>;
}

describe('app i18n boundary', () => {
  it('applies the app-wide role override in the user menu', () => {
    const html = renderInBoundary(
      <ShellChrome>
        <UserMenu />
      </ShellChrome>,
    );
    // The role label renders as the text of an element (the trigger's label
    // span); match it as element text, not as a bare substring.
    expect(html).toMatch(/>Billing<\/span>/);
    expect(html).not.toMatch(/>Finance</);
  });

  it('applies the same override in the staff table', () => {
    const html = renderInBoundary(
      <StaffDataTable
        staff={[{ id: 'staff-1', email: 'finance@example.com', isActive: true, role: 'FINANCE' }]}
        currentAdminId="admin-1"
        onDisable={() => {}}
      />,
    );
    expect(html).toMatch(/>Billing</);
    expect(html).not.toMatch(/>Finance</);
  });

  it('applies the same override in the create-staff form and keeps sibling defaults', () => {
    const html = renderInBoundary(
      <CreateStaffForm values={{ email: '', password: '', role: 'CUSTOMER_SUPPORT' }} onChange={() => {}} />,
    );
    expect(html).toContain('<option value="FINANCE">Billing</option>');
    expect(html).not.toContain('>Finance<');
    expect(html).toContain('<option value="TENANT_OWNER">Tenant Owner</option>');
  });

  it("forwards next-intl's locale to @clensy/web rather than the package default", () => {
    expect(renderInBoundary(<LocaleProbe />, 'fil')).toContain('>fil</span>');
  });
});
