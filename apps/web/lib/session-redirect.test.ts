import { describe, expect, it, vi } from 'vitest';

import { createSessionRedirector, isNoPrincipalResult, runSessionCheck, type SessionCheckResult } from './session-redirect';

// A clearStore whose settlement the test controls, recording call order.
function harness() {
  const calls: string[] = [];
  let settleClear: { reject: (reason: unknown) => void; resolve: () => void } | undefined;
  const clearStore = vi.fn(
    () =>
      new Promise<void>((resolve, reject) => {
        calls.push('clearStore');
        settleClear = { reject, resolve };
      }),
  );
  const navigateToLogin = vi.fn(() => {
    calls.push('navigateToLogin');
  });
  const redirector = createSessionRedirector({ clearStore, navigateToLogin });
  return {
    calls,
    clearStore,
    navigateToLogin,
    redirector,
    rejectClear: (reason: unknown) => settleClear?.reject(reason),
    resolveClear: () => settleClear?.resolve(),
  };
}

// Session routing spec §4.3 (single-flight session redirect), §5 invariants
// 3, 4 and 10, §8 item 2.
describe('createSessionRedirector', () => {
  it('clears the store, then navigates to the sign-in page, once', async () => {
    const h = harness();

    const sequence = h.redirector.report();
    expect(h.calls).toEqual(['clearStore']);
    h.resolveClear();
    await sequence;

    expect(h.calls).toEqual(['clearStore', 'navigateToLogin']);
  });

  it('runs one sequence however many reports arrive, before or after it settles', async () => {
    const h = harness();

    const first = h.redirector.report();
    const second = h.redirector.report();
    h.resolveClear();
    await Promise.all([first, second, h.redirector.report()]);
    await h.redirector.report();

    expect(h.clearStore).toHaveBeenCalledTimes(1);
    expect(h.navigateToLogin).toHaveBeenCalledTimes(1);
  });

  it('still navigates once when clearStore rejects', async () => {
    const h = harness();

    const sequence = h.redirector.report();
    h.rejectClear(new Error('store busy'));
    await sequence;

    expect(h.calls).toEqual(['clearStore', 'navigateToLogin']);
  });

  it('ignores new evidence after dispose while the latch is open', async () => {
    const h = harness();

    h.redirector.dispose();
    await h.redirector.report();

    expect(h.clearStore).not.toHaveBeenCalled();
    expect(h.navigateToLogin).not.toHaveBeenCalled();
  });

  it('completes a committed sequence across dispose', async () => {
    const h = harness();

    const sequence = h.redirector.report();
    h.redirector.dispose();
    h.resolveClear();
    await sequence;
    await h.redirector.report();

    expect(h.calls).toEqual(['clearStore', 'navigateToLogin']);
  });
});

// Session evidence (2) (spec §3): a successful check with no principal. A
// failed check is never evidence.
describe('isNoPrincipalResult', () => {
  it('is evidence for a successful result with a null or absent currentAdmin', () => {
    expect(isNoPrincipalResult({ data: { currentAdmin: null } })).toBe(true);
    expect(isNoPrincipalResult({ data: {} })).toBe(true);
    expect(isNoPrincipalResult({ data: null })).toBe(true);
    expect(isNoPrincipalResult({})).toBe(true);
  });

  it('is not evidence when a principal is present', () => {
    expect(isNoPrincipalResult({ data: { currentAdmin: { id: 'admin-1' } } })).toBe(false);
  });

  it('is not evidence when the result carries an error, even with no principal', () => {
    expect(isNoPrincipalResult({ data: { currentAdmin: null }, error: new Error('Failed to fetch') })).toBe(false);
    expect(isNoPrincipalResult({ data: null, errors: [{ message: 'Forbidden resource' }] })).toBe(false);
  });
});

// A query whose settlement the test controls, standing in for one
// network-only currentAdmin check.
function deferredQuery() {
  let settle: { reject: (reason: unknown) => void; resolve: (result: SessionCheckResult) => void } | undefined;
  const promise = new Promise<SessionCheckResult>((resolve, reject) => {
    settle = { reject, resolve };
  });
  return {
    query: () => promise,
    reject: (reason: unknown) => settle?.reject(reason),
    resolve: (result: SessionCheckResult) => settle?.resolve(result),
  };
}

function immediateRedirector() {
  const navigateToLogin = vi.fn();
  const redirector = createSessionRedirector({ clearStore: () => Promise.resolve(), navigateToLogin });
  return { navigateToLogin, redirector };
}

// Spec §4.2 proactive evidence, §4.3 item 4, §5 invariant 10: out-of-order
// checks and checks that outlive their redirector.
describe('runSessionCheck', () => {
  it('redirects on an out-of-order null result after a later check found a principal', async () => {
    const { navigateToLogin, redirector } = immediateRedirector();
    const earlier = deferredQuery();
    const later = deferredQuery();

    const earlierCheck = runSessionCheck(earlier.query, redirector);
    const laterCheck = runSessionCheck(later.query, redirector);
    later.resolve({ data: { currentAdmin: { id: 'admin-1' } } });
    await laterCheck;
    expect(navigateToLogin).not.toHaveBeenCalled();
    earlier.resolve({ data: { currentAdmin: null } });
    await earlierCheck;

    expect(navigateToLogin).toHaveBeenCalledTimes(1);
  });

  it('does not undo a started redirect when a later principal result arrives', async () => {
    const { navigateToLogin, redirector } = immediateRedirector();
    const first = deferredQuery();
    const second = deferredQuery();

    const firstCheck = runSessionCheck(first.query, redirector);
    const secondCheck = runSessionCheck(second.query, redirector);
    first.resolve({ data: { currentAdmin: null } });
    second.resolve({ data: { currentAdmin: { id: 'admin-1' } } });
    await Promise.all([firstCheck, secondCheck]);

    expect(navigateToLogin).toHaveBeenCalledTimes(1);
  });

  it('acts only through the redirector it started with, never a newer one', async () => {
    const old = immediateRedirector();
    const current = immediateRedirector();
    const pending = deferredQuery();

    const staleCheck = runSessionCheck(pending.query, old.redirector);
    old.redirector.dispose();
    pending.resolve({ data: { currentAdmin: null } });
    await staleCheck;

    expect(old.navigateToLogin).not.toHaveBeenCalled();
    expect(current.navigateToLogin).not.toHaveBeenCalled();
  });

  it('treats a rejected check as no evidence', async () => {
    const { navigateToLogin, redirector } = immediateRedirector();
    const failing = deferredQuery();

    const check = runSessionCheck(failing.query, redirector);
    failing.reject(new Error('Failed to fetch'));
    await check;

    expect(navigateToLogin).not.toHaveBeenCalled();
  });
});
