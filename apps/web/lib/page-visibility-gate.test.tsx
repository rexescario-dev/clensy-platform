import type { AdminScope, Role } from '@clensy/client';
import { NextIntlClientProvider } from 'next-intl';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PageVisibilityGate } from '../components/layout/page-visibility-gate';
import { getMessages } from '../i18n/messages';

interface QueryState {
  data?: { currentAdmin: { id: string; role: Role; scope: AdminScope } | null };
  error?: Error;
  loading: boolean;
}

// Mutable inputs for the mocked hooks below. vi.hoisted makes them exist
// before the hoisted vi.mock factories run.
const inputs = vi.hoisted(() => ({
  pathname: '/app' as string | null,
  query: { loading: true } as QueryState,
  queryCalls: [] as unknown[][],
}));

vi.mock('next/navigation', () => ({ usePathname: () => inputs.pathname }));
vi.mock('@clensy/client', () => ({
  useCurrentAdminQuery: (...args: unknown[]) => {
    inputs.queryCalls.push(args);
    return inputs.query;
  },
}));

// The page under the gate. "Not mounted" (spec §3) is asserted as zero
// function-body runs and zero calls to its data-query hook, not merely as
// absence from the markup.
const pageDataQuery = vi.fn();
let pageRenders = 0;
function PageProbe() {
  pageRenders += 1;
  pageDataQuery();
  return <p>page-probe</p>;
}

const UNAVAILABLE = 'This page isn&#x27;t available to you.';
const LOADING = 'role="status" aria-label="Loading…"';

function admin(role: Role, scope: AdminScope) {
  return { data: { currentAdmin: { id: 'admin-1', role, scope } }, loading: false };
}

function renderGate(pathname: string | null, query: QueryState) {
  inputs.pathname = pathname;
  inputs.query = query;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={getMessages()}>
      <PageVisibilityGate>
        <PageProbe />
      </PageVisibilityGate>
    </NextIntlClientProvider>,
  );
}

function homeLink(href: string) {
  return new RegExp(`<a [^>]*href="${href}"[^>]*>Go to your home page</a>`);
}

// Spec §4.3 (#132): the state's only heading is an <h1> holding the message.
// Static markup can't compute accessible names, so this checks the text
// content; the <h1> carries no naming attributes, so that is its name.
function expectUnavailableHeading(html: string) {
  const headings = [...html.matchAll(/<(h[1-6])\b[^>]*>(.*?)<\/h[1-6]>/g)].map(([, tag, text]) => [tag, text]);
  expect(headings).toEqual([['h1', UNAVAILABLE]]);
}

function expectMounted(html: string) {
  expect(html).toContain('page-probe');
  expect(pageRenders).toBe(1);
  expect(pageDataQuery).toHaveBeenCalledTimes(1);
}

function expectNotMounted(html: string) {
  expect(html).not.toContain('page-probe');
  expect(pageRenders).toBe(0);
  expect(pageDataQuery).not.toHaveBeenCalled();
}

beforeEach(() => {
  pageRenders = 0;
  pageDataQuery.mockClear();
  inputs.queryCalls.length = 0;
});

describe('PageVisibilityGate', () => {
  describe('row 0: ungated paths', () => {
    it.each(['/app', '/app/does-not-exist', '/app/customers-old', null])(
      'mounts the page on %j at once, while currentAdmin is still loading',
      (pathname) => {
        const html = renderGate(pathname, { loading: true });

        expectMounted(html);
        expect(html).not.toContain(LOADING);
      },
    );

    // "Ungated" means the rendering decision ignores the currentAdmin result,
    // not that the hook is skipped (spec §4.2 Inputs): the hook still runs,
    // and no query state changes what an ungated path renders.
    it.each([
      ['loading', { loading: true }],
      ['an error', { error: new Error('session expired'), loading: false }],
      ['a settled null', { data: { currentAdmin: null }, loading: false }],
      ['a principal with no tenant pages', admin('SUPER_ADMIN', 'PLATFORM')],
      ['a principal denied every gated page', admin('SUPER_ADMIN', 'TENANT')],
    ] as [string, QueryState][])('mounts an unknown/unlisted path whatever the query state: %s', (_label, query) => {
      const html = renderGate('/app/does-not-exist', query);

      expectMounted(html);
      expect(html).not.toContain(LOADING);
      expect(html).not.toContain(UNAVAILABLE);
      expect(inputs.queryCalls).toEqual([[]]);
    });
  });

  describe('rows 1–2: principal present', () => {
    it('mounts an allowed page', () => {
      expectMounted(renderGate('/app/admin', admin('TENANT_OWNER', 'TENANT')));
    });

    it('replaces a denied page with the unavailable state and a home link', () => {
      const html = renderGate('/app/customers', admin('FINANCE', 'TENANT'));

      expectNotMounted(html);
      expectUnavailableHeading(html);
      expect(html).toMatch(homeLink('/app/bookings'));
    });

    it('denies a deep link beneath a hidden page', () => {
      const html = renderGate('/app/customers/123', admin('FINANCE', 'TENANT'));

      expectNotMounted(html);
      expect(html).toContain(UNAVAILABLE);
    });

    it('denies a Super Admin a tenant page and links to the platform landing', () => {
      const html = renderGate('/app/bookings', admin('SUPER_ADMIN', 'PLATFORM'));

      expectNotMounted(html);
      expectUnavailableHeading(html);
      expect(html).toMatch(homeLink('/app/platform'));
    });

    it('denies a tenant principal the platform page', () => {
      const html = renderGate('/app/platform', admin('SCHEDULER', 'TENANT'));

      expectNotMounted(html);
      expectUnavailableHeading(html);
      expect(html).toMatch(homeLink('/app/bookings'));
    });

    it('omits the home link when the principal has no landing', () => {
      const html = renderGate('/app/bookings', admin('SUPER_ADMIN', 'TENANT'));

      expectNotMounted(html);
      expectUnavailableHeading(html);
      expect(html).not.toContain('<a ');
    });

    it('decides from a cached principal during a refetch, never showing LoadingState', () => {
      const refetching = { ...admin('FINANCE', 'TENANT'), loading: true };

      expectMounted(renderGate('/app/bookings', refetching));

      pageRenders = 0;
      pageDataQuery.mockClear();
      const denied = renderGate('/app/customers', refetching);
      expectNotMounted(denied);
      expect(denied).toContain(UNAVAILABLE);
      expect(denied).not.toContain(LOADING);
    });

    it('decides from a cached principal even when the query also reports an error', () => {
      const html = renderGate('/app/customers', { ...admin('FINANCE', 'TENANT'), error: new Error('refetch failed') });

      expectNotMounted(html);
      expect(html).toContain(UNAVAILABLE);
    });
  });

  describe('rows 3–5: no principal on a gated path', () => {
    it('passes the page through on a query error', () => {
      expectMounted(renderGate('/app/cleaners', { error: new Error('session expired'), loading: false }));
    });

    it('shows LoadingState and does not mount the page while loading', () => {
      const html = renderGate('/app/customers', { loading: true });

      expectNotMounted(html);
      expect(html).toContain(LOADING);
    });

    it('passes the page through when the query settles with no currentAdmin', () => {
      expectMounted(renderGate('/app/admin', { data: { currentAdmin: null }, loading: false }));
    });
  });

  // The generated hook's default fetch policy is cache-first; passing no
  // options is the spec §4.2 mechanism for using it.
  it('calls useCurrentAdminQuery with no options', () => {
    renderGate('/app/bookings', admin('FINANCE', 'TENANT'));

    expect(inputs.queryCalls).toEqual([[]]);
  });
});
