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

// Spec §4.3 (#134): the home link is the anchor itself, rendered through
// Button's link variant by asChild, with no wrapping <button>. Complements
// homeLink(), which checks the same anchor's href and text.
function expectButtonLink(html: string, href: string) {
  const anchors = [...html.matchAll(/<a\b[^>]*>/g)].map(([tag]) => tag);
  expect(anchors).toHaveLength(1);
  expect(anchors[0]).toContain(`href="${href}"`);
  expect(anchors[0]).toContain('data-slot="button"');
  expect(anchors[0]).toContain('data-variant="link"');
  expect(html).not.toContain('<button');
}

// Document titles spec §4.3 (#143): the gate's output holds exactly one
// <title>, whose text describes the row actually rendered.
function expectTitle(html: string, title: string) {
  expect([...html.matchAll(/<title>(.*?)<\/title>/g)].map(([, text]) => text)).toEqual([title]);
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
      expectButtonLink(html, '/app/bookings');
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
      expectButtonLink(html, '/app/platform');
    });

    it('denies a tenant principal the platform page', () => {
      const html = renderGate('/app/platform', admin('SCHEDULER', 'TENANT'));

      expectNotMounted(html);
      expectUnavailableHeading(html);
      expect(html).toMatch(homeLink('/app/bookings'));
      expectButtonLink(html, '/app/bookings');
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

  // Document titles spec §4.3, §4.5 and §8 item 2 (#143).
  describe('document title', () => {
    const UNAVAILABLE_TITLE = 'Page unavailable · Clensy';

    it.each([
      ['/app', 'Clensy'],
      ['/app/does-not-exist', 'Clensy'],
      [null, 'Clensy'],
    ])('titles the ungated path %j as %j', (pathname, title) => {
      expectTitle(renderGate(pathname, { loading: true }), title);
    });

    it('titles an allowed page by its nav label', () => {
      expectTitle(renderGate('/app/catalog', admin('OPS_MANAGER', 'TENANT')), 'Services · Clensy');
      expectTitle(renderGate('/app/cleaners/teams/x', admin('ANALYST', 'TENANT')), 'Teams · Clensy');
      expectTitle(renderGate('/app/admin', admin('TENANT_OWNER', 'TENANT')), 'Staff · Clensy');
    });

    it('titles the platform page for a platform principal', () => {
      expectTitle(renderGate('/app/platform', admin('SUPER_ADMIN', 'PLATFORM')), 'Platform · Clensy');
    });

    it.each([
      ['a denied role', '/app/customers', admin('FINANCE', 'TENANT')],
      ['a platform principal on a tenant page', '/app/bookings', admin('SUPER_ADMIN', 'PLATFORM')],
      ['a tenant principal on the platform page', '/app/platform', admin('SCHEDULER', 'TENANT')],
      ['a principal with no landing', '/app/bookings', admin('SUPER_ADMIN', 'TENANT')],
    ] as [string, string, QueryState][])('titles the unavailable state for %s', (_label, pathname, query) => {
      expectTitle(renderGate(pathname, query), UNAVAILABLE_TITLE);
    });

    it('titles the loading row by the requested page, as the allowed row', () => {
      const loading = renderGate('/app/customers', { loading: true });
      const allowed = renderGate('/app/customers', admin('ANALYST', 'TENANT'));

      expectTitle(loading, 'Customers · Clensy');
      expectTitle(allowed, 'Customers · Clensy');
    });

    it.each([
      ['an error', { error: new Error('session expired'), loading: false }],
      ['a settled null', { data: { currentAdmin: null }, loading: false }],
    ] as [string, QueryState][])('titles the passed-through page on %s', (_label, query) => {
      expectTitle(renderGate('/app/bookings', query), 'Bookings · Clensy');
    });

    it('titles a cached principal during a refetch by the settled row', () => {
      expectTitle(renderGate('/app/customers', { ...admin('ANALYST', 'TENANT'), loading: true }), 'Customers · Clensy');
      expectTitle(renderGate('/app/customers', { ...admin('FINANCE', 'TENANT'), loading: true }), UNAVAILABLE_TITLE);
    });
  });
});
