import type { AdminScope, Role } from '@clensy/client';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import AdminPage from '../app/app/admin/page';
import AppIndexPage from '../app/app/page';
import { AppI18nProvider } from '../components/layout/app-i18n-provider';
import { getMessages } from '../i18n/messages';

interface QueryState {
  data?: { currentAdmin: { id: string; role: Role; scope: AdminScope } | null };
  error?: Error;
  loading: boolean;
}

// vi.hoisted makes these exist before the hoisted vi.mock factories run.
const inputs = vi.hoisted(() => ({
  query: { loading: true } as QueryState,
  replace: vi.fn(),
}));

vi.mock('@clensy/client', () => ({ useCurrentAdminQuery: () => inputs.query }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: inputs.replace }) }));

function render(node: ReactNode, query: QueryState) {
  inputs.query = query;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={getMessages()} timeZone="UTC">
      {node}
    </NextIntlClientProvider>,
  );
}

// Session routing spec §4.4 / §8 item 3. Static rendering runs no effects;
// the redirect-to-target effect is unchanged and pinned at source level.
describe('/app landing states', () => {
  it('shows the account load error on a failed currentAdmin read', () => {
    const html = render(<AppIndexPage />, { error: new Error('Failed to fetch'), loading: false });

    expect(html).toContain('Unable to load your account.');
  });

  // Spec §4.4 (#146): the error is announced, with the admin page's
  // staff.loadError visual classes; the loading and empty states are not alerts.
  it('announces the account load error as an alert in the admin error style', () => {
    const html = render(<AppIndexPage />, { error: new Error('Failed to fetch'), loading: false });

    expect(html).toBe('<p role="alert" class="text-sm text-red-600">Unable to load your account.</p>');
  });

  it.each([
    ['loading', { loading: true }],
    ['a settled missing principal', { data: { currentAdmin: null }, loading: false }],
    ['a principal with no destination', { data: { currentAdmin: { id: 'admin-1', role: 'SUPER_ADMIN', scope: 'TENANT' } }, loading: false }],
  ] as const)('renders no alert for %s', (_name, query) => {
    expect(render(<AppIndexPage />, query)).not.toContain('role="alert"');
  });

  it('keeps loading on a settled missing principal while the guard redirects', () => {
    const html = render(<AppIndexPage />, { data: { currentAdmin: null }, loading: false });

    expect(html).toContain('Loading…');
    expect(html).not.toContain('Unable to load your account.');
  });

  it('shows the empty message for a principal with no destination', () => {
    const html = render(<AppIndexPage />, {
      data: { currentAdmin: { id: 'admin-1', role: 'SUPER_ADMIN', scope: 'TENANT' } },
      loading: false,
    });

    expect(html).toContain('No areas are available for your account.');
  });
});

// Session routing spec §4.5 / §8 item 4. The page renders inside the app i18n
// boundary for its @clensy/web staff copy.
describe('/app/admin session states', () => {
  it.each([
    ['a failed currentAdmin read', { error: new Error('Failed to fetch'), loading: false }],
    ['a settled missing principal', { data: { currentAdmin: null }, loading: false }],
  ] as const)('shows the staff load error and does not route on %s', (_name, query) => {
    inputs.replace.mockClear();

    const html = render(
      <AppI18nProvider>
        <AdminPage />
      </AppI18nProvider>,
      query,
    );

    expect(html).toContain('Unable to load staff accounts.');
    expect(inputs.replace).not.toHaveBeenCalled();
  });
});
