import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { SessionGuard } from '../components/layout/session-guard';

// vi.hoisted makes these exist before the hoisted vi.mock factories run.
const mocks = vi.hoisted(() => ({
  onSessionInvalid: vi.fn(() => () => {}),
  query: vi.fn(() => new Promise(() => {})),
}));

vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useApolloClient: () => ({ clearStore: vi.fn(), query: mocks.query }),
}));
vi.mock('@clensy/client', () => ({ CurrentAdminDocument: {}, onSessionInvalid: mocks.onSessionInvalid }));
vi.mock('next/navigation', () => ({
  usePathname: () => '/app/bookings',
  useRouter: () => ({ replace: vi.fn() }),
}));

// The page beside the guard. It must render on the first pass, before any
// session check exists, let alone settles (spec §4.2 Rendering, §5 invariant 6).
let pageRenders = 0;
function PageProbe() {
  pageRenders += 1;
  return <p>page-probe</p>;
}

// No DOM test environment exists in this repo, so this pins rendering only:
// static rendering runs no effects. The effect wiring is pinned at source level
// in session-routing-regressions.test.ts; the latch it drives is unit-tested in
// session-redirect.test.ts.
describe('SessionGuard rendering', () => {
  it('renders nothing and does not delay its sibling page', () => {
    const html = renderToStaticMarkup(
      <>
        <SessionGuard />
        <PageProbe />
      </>,
    );

    expect(html).toBe('<p>page-probe</p>');
    expect(pageRenders).toBe(1);
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.onSessionInvalid).not.toHaveBeenCalled();
  });
});
