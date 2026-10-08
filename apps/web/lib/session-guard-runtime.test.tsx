// @vitest-environment jsdom
import { act, StrictMode, useLayoutEffect, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionGuard } from '../components/layout/session-guard';

// Session routing spec §4.3 item 1 (#131, #146), hardened by #148: the
// guard's one mount-scoped redirector must reach the CURRENT Apollo client and
// router. On every identity change, `latest` is updated in the layout phase,
// before any passive effect or later signal from that render can run.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface FakeClient {
  clearStore: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
}
interface FakeRouter {
  replace: ReturnType<typeof vi.fn>;
}

// vi.hoisted makes these exist before the hoisted vi.mock factories run.
const state = vi.hoisted(() => ({
  client: undefined as unknown,
  listeners: new Set<() => void>(),
  router: undefined as unknown,
}));

vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useApolloClient: () => state.client,
}));
vi.mock('@clensy/client', () => ({
  CurrentAdminDocument: {},
  onSessionInvalid: (listener: () => void) => {
    state.listeners.add(listener);
    return () => state.listeners.delete(listener);
  },
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/app/bookings',
  useRouter: () => state.router,
}));
vi.mock('./session-redirect', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./session-redirect')>();
  return { ...actual, createSessionRedirector: vi.fn(actual.createSessionRedirector) };
});

const { createSessionRedirector } = await import('./session-redirect');

// A check that never settles, so only the session signal drives redirects.
function fakeClient(): FakeClient {
  return { clearStore: vi.fn(() => Promise.resolve()), query: vi.fn(() => new Promise(() => {})) };
}

function fakeRouter(): FakeRouter {
  return { replace: vi.fn() };
}

function fireSessionSignal() {
  for (const listener of [...state.listeners]) listener();
}

// Fires the session signal from its own layout effect when `fire` is set.
// Tests render it as SessionGuard's NEXT SIBLING, and React runs a commit's
// layout effects in tree order, so its layout effect is guaranteed to run
// after the guard's (where #148 syncs `latest`) and before any passive effect
// of the same commit, where the pre-#148 sync ran. That ordering makes the
// fresh-identity test deterministic.
function SignalInLayoutPhase({ fire }: { fire: boolean }) {
  useLayoutEffect(() => {
    if (fire) fireSessionSignal();
  }, [fire]);
  return null;
}

let root: Root | undefined;

async function render(node: ReactNode) {
  if (!root) root = createRoot(document.createElement('div'));
  await act(async () => {
    root?.render(node);
  });
}

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = undefined;
  state.listeners.clear();
  vi.mocked(createSessionRedirector).mockClear();
});

describe('SessionGuard at runtime', () => {
  it('redirects through the current client and router after an identity change', async () => {
    const [clientA, routerA] = [fakeClient(), fakeRouter()];
    const [clientB, routerB] = [fakeClient(), fakeRouter()];
    state.client = clientA;
    state.router = routerA;
    await render(
      <>
        <SessionGuard />
        <SignalInLayoutPhase fire={false} />
      </>,
    );

    // The guard's own listener is registered before the identity change.
    expect(state.listeners.size).toBe(1);

    state.client = clientB;
    state.router = routerB;
    await render(
      <>
        <SessionGuard />
        <SignalInLayoutPhase fire />
      </>,
    );

    // Decisive: clearStore() runs synchronously in the signal's call stack, so
    // it sees exactly what `latest` holds at that moment. replace() runs only
    // after an await, so the router assertions confirm the final redirect but
    // do not on their own prove the ordering.
    expect(clientB.clearStore).toHaveBeenCalledTimes(1);
    expect(routerB.replace).toHaveBeenCalledTimes(1);
    expect(routerB.replace).toHaveBeenCalledWith('/login');
    expect(clientA.clearStore).not.toHaveBeenCalled();
    expect(routerA.replace).not.toHaveBeenCalled();
  });

  // Characterization of #146's existing mount-lifetime behavior (passes
  // before #148); the source regression pins the [] dependency itself.
  it('keeps one redirector and one listener across an identity change', async () => {
    state.client = fakeClient();
    state.router = fakeRouter();
    await render(<SessionGuard />);
    state.client = fakeClient();
    state.router = fakeRouter();
    await render(<SessionGuard />);

    expect(createSessionRedirector).toHaveBeenCalledTimes(1);
    expect(state.listeners.size).toBe(1);
  });

  it('leaves exactly one live listener after a strict-mode double mount', async () => {
    state.client = fakeClient();
    state.router = fakeRouter();
    await render(
      <StrictMode>
        <SessionGuard />
      </StrictMode>,
    );

    expect(createSessionRedirector).toHaveBeenCalledTimes(2);
    expect(state.listeners.size).toBe(1);
  });
});
