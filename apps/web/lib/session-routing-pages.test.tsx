import type { AdminScope, Role } from '@clensy/client';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import AppIndexPage from '../app/app/page';
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
