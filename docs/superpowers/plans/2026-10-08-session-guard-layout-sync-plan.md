# SessionGuard Layout-Phase Ref Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Accepted |
| M5 decision | **Accepted** — 2026-10-08, at `8881eb2`, by the owner, on the second pass, with no further changes. To be executed natively. The architecture is locked: `useLayoutEffect` for the `[client, router]` ref sync, and `useEffect([])` for the single mount-scoped redirector. No spec amendment. M7 MUST use a fresh, independent reviewer (application-code slice) and MUST confirm there's no warning on the real Next.js server path. |
| M5 history | First pass (2026-10-08, at `414ffb4`): the owner found the mechanism and test strategy sound and requested changes, all applied with no design change. (1) The unsupported premise "React 19 doesn't warn about `useLayoutEffect` during server rendering" is removed. The plan now says only that the guard renders `null`, so its server markup can't change, and **verifies** the absence of warnings with a new test: `renders on the server without any console warning or error` in `session-guard.test.tsx`. That is a characterization test, with mutation evidence. (2) The runtime test ties `SignalInLayoutPhase`'s next-sibling position to React's tree-order layout effects, which is why its RED is deterministic. (3) It asserts the guard's listener is registered before the identity change. (4) The comment on the `effectCalls` normalization claims only whitespace and trailing-comma insensitivity. (5) The two runtime characterization tests are described as characterizing #146's existing mount-lifetime behavior. (6) The central invariant is stated concretely: before a later sibling's layout-phase signal, and before passive effects. |
| Date | 2026-10-08 |
| Tracking issue | [#148](https://github.com/rexescario-dev/clensy-platform/issues/148) (raised from #146's M7 Minor 1) |
| Scope | `apps/web` only: `components/layout/session-guard.tsx`, `lib/session-routing-regressions.test.ts`, `lib/session-guard.test.tsx`, and the new `lib/session-guard-runtime.test.tsx`. No `packages/*`, `apps/api`, `middleware.ts`, `PageVisibilityGate`, `user-menu.tsx`, `app/login`, copy, config or lockfile changes. |
| Implements (Accepted) | [Consistent `/login` Routing for Missing or Invalid Sessions Across `/app` — Design](../specs/2026-10-07-session-routing-design.md), §4.3 item 1 as amended by #146 (Accepted, M3 `95157b8`): "the redirect's effects call the current client and router". **No spec change.** The spec already requires the current objects, and today's code misses that for one commit after an identity change. This plan makes the code conform. |
| Relies on (Accepted) | [Session routing follow-ups plan](2026-10-08-session-routing-followups-plan.md) (#146), whose `latest` ref and mount-scoped redirector this keeps |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. Test names, the probe component `SignalInLayoutPhase`, and the helper rename `useEffectCalls` → `effectCalls` are planning decisions, not product semantics. |
| Edit anchors | `session-guard.tsx`, `session-routing-regressions.test.ts` and `session-guard.test.tsx` change by unified diff against the branch base, `78c071f` (`main`). The new test file is given in full. |
| Pre-validation | **Full.** See below. |

**Goal:** Close the one-commit window in which `SessionGuard`'s mount-scoped redirector could run a redirect step against a previous Apollo client or router.

**Central invariant (owner, M2 brainstorm, 2026-10-08; wording narrowed at M5):** On every `client`/`router` identity change, `latest.current` is updated **in `SessionGuard`'s layout effect**. That happens before a layout-phase signal fired by a later sibling in the same commit can invoke the redirector, and before that commit's passive effects run. The mount-scoped redirector keeps its identity, and its callbacks observe the current client and router.

**Architecture:** Only one hook changes. The `latest` ref's sync effect in `session-guard.tsx` goes from `useEffect` to `useLayoutEffect`, keyed on `[client, router]` as before. Everything else from #131 and #146 stays as it is:
- the redirector effect keeps `[]` dependencies and creates exactly one redirector per mount;
- its `clearStore` and `navigateToLogin` read `latest.current`;
- the check effect stays `[client, pathname]`, bound through `runSessionCheck`;
- `session-redirect.ts` is unchanged.

React runs all layout effects of a commit, in tree order, before any passive effect. So the guard's ref is current before:
- a sibling rendered after it fires the session signal from its own layout effect;
- any passive effect, including the guard's own check, runs.

**Server rendering.** Layout effects don't run during server rendering. `SessionGuard` renders `null`, so changing the sync hook doesn't change its server-rendered markup. This plan doesn't rely on any claim about React's server warnings. Instead it **verifies** them: a new test renders the guard with `renderToStaticMarkup` and fails on any `console.error` or `console.warn`. M7 should also confirm the project's server-rendering path shows no unexpected warning. (Supporting evidence only: the installed React 19.2.8 server renderers contain no "useLayoutEffect does nothing on the server" message.)

**Verification design.** There are two complementary proofs:

- **Runtime (new):** `lib/session-guard-runtime.test.tsx`. It uses `// @vitest-environment jsdom`, `createRoot` and `act()`, the same pattern as `app-i18n-tenant-isolation.test.tsx`. It mocks `@apollo/client`'s `useApolloClient`, `next/navigation` and `@clensy/client`'s signal registry, and wraps the real `createSessionRedirector` in a spy.
  - **Fresh-identity test.** It mounts with client A and router A, then re-renders with B. A sibling `SignalInLayoutPhase` fires the session signal in its layout effect during that commit. It asserts that B gets exactly one `clearStore()` and one `replace('/login')`, and that A gets neither.
    - This is a real regression test. Against today's passive sync, `clearStore()` runs synchronously on the stale client A. `replace('/login')` runs after an `await`, once the passive sync has run, so it reaches B. The `clearStore` assertion is the decisive one.
  - **Determinism.** The test renders `SignalInLayoutPhase` as `SessionGuard`'s **next sibling**. React runs a commit's layout effects in tree order, so the signal is guaranteed to fire after the guard's layout effect (where the fix syncs `latest`) and before any passive effect (where today's sync runs). The test also asserts the guard's listener is registered before the identity change.
  - **Two characterization tests of #146's existing mount-lifetime behavior:** one redirector and one listener across an identity change, and exactly one live listener after a strict-mode double mount. They don't independently prove every lifecycle rule; the source regression pins the `[]` dependency itself.
- **Source (extended):** the AST helper in `lib/session-routing-regressions.test.ts` is renamed `useEffectCalls` → `effectCalls`. It now also collects `useLayoutEffect` calls and records which hook each call uses. The existing regression additionally requires:
  - the redirector effect to be a `useEffect` with `[]` dependencies;
  - the `latest` sync to be a `useLayoutEffect`, still declared before it.

  The helper's comment is narrowed: compaction makes only ordinary whitespace and trailing-comma changes irrelevant.
- **Server render (new, characterization):** `renders on the server without any console warning or error` in `lib/session-guard.test.tsx`.

**Tech Stack:** React 19.2 (`useLayoutEffect`, `createRoot`, `act`), Vitest 5 (per-file jsdom, with `jsdom` already a devDependency), and the TypeScript compiler API.

**Spec:** [`docs/superpowers/specs/2026-10-07-session-routing-design.md`](../specs/2026-10-07-session-routing-design.md) §4.3 item 1.

**Pre-validation evidence (full).** This is evidence the author gathered before M5. It is not a record of the M6 execution, which must re-run every `Expected:` command itself. On 2026-10-08, the author applied every code block and diff below to a working tree at `78c071f` and independently ran every command named by an `Expected:` line. Each result is quoted as observed.
- **The RED is caused by the stale client.** A throwaway copy of the fresh-identity test, deleted afterwards, logged `{"a":1,"b":0,"ra":0,"rb":1}`: the stale client A received `clearStore()`, and router B received `replace('/login')`.
- **Characterization mutations** (not committed; the guard was restored byte for byte after each):
  - giving the redirector effect `[client, router]` dependencies fails `keeps one redirector and one listener across an identity change`;
  - dropping `unsubscribe()` from its cleanup fails `leaves exactly one live listener after a strict-mode double mount`;
  - adding `console.warn('probe');` to the guard's render fails `renders on the server without any console warning or error`. The test passes on both the pre-#148 and the #148 guard.
- **Final verification:**
  - `pnpm run lint` 6/6;
  - web and API `tsc` clean;
  - `pnpm run test` 10/10, with `web` 554/554 (baseline 550) and `@clensy/client` 10/10;
  - `pnpm --filter web build` exits 0, and its output contains no `warning` or `useLayoutEffect` text (case-insensitive search). This is supporting evidence for the real server-rendering path.
  - exactly the four planned files change.

After the plan was written, and again after the M5 revisions, the tree was reset and the task was replayed from this document's text. Every `Expected:` line matched. The tree was then reverted, and only this plan is committed.

## Global Constraints

- `latest.current = { client, router }` runs in a `useLayoutEffect` keyed on `[client, router]`, declared before the redirector effect. That is its only statement.
- The redirector effect stays a `useEffect` with `[]` dependencies, calling `latest.current.client.clearStore()` and `latest.current.router.replace('/login')`. It creates exactly one redirector per mount.
- The check effect (`[client, pathname]`, `runSessionCheck(..., current)` with the ref read synchronously) and `lib/session-redirect.ts` are unchanged.
- No spec, copy, config, dependency or protected-area change.

## Review Focus

1. **Layout-phase ordering in a real browser.** jsdom with `act()` exercises React's commit order, not paint timing. M7 should confirm the ordering argument against React 19's commit phases.
2. **Server rendering.** The guard is a client component, rendered on the server only as `null`. The new server-render test pins that there are no console warnings or errors under `renderToStaticMarkup`. M7 should confirm the same holds on the project's real server-rendering path (`next build`, or a dev request), and that there's no hydration difference.
3. **Mocks in the runtime test.** It mocks `useApolloClient`, `next/navigation` and the signal registry, but runs the real `createSessionRedirector` and `runSessionCheck`. Confirm the mocks can't make the fresh-identity test pass vacuously; the RED evidence above shows they don't.

## File Map

| File | Change |
| --- | --- |
| `apps/web/components/layout/session-guard.tsx` | `useLayoutEffect` import; the sync effect becomes `useLayoutEffect`; the comment is updated |
| `apps/web/lib/session-guard-runtime.test.tsx` (new) | jsdom runtime tests: fresh identity (regression), one redirector and listener, and strict mode (characterization) |
| `apps/web/lib/session-routing-regressions.test.ts` | `effectCalls` (collects both hooks, with their kind); the regression requires a layout-effect sync and a passive `[]` redirector; the normalization comment is narrowed |
| `apps/web/lib/session-guard.test.tsx` | Server-render test: no console warning or error (characterization) |

Commit messages carry no `Co-Authored-By: Claude` trailer (owner's global instruction).

---

### Task 1: Sync `latest` in the layout phase (spec §4.3 item 1, invariant 3)

**Files:** Create `apps/web/lib/session-guard-runtime.test.tsx`. Modify `apps/web/lib/session-guard.test.tsx`, `apps/web/lib/session-routing-regressions.test.ts` and `apps/web/components/layout/session-guard.tsx`.

**Interfaces:** No exported surface changes. `SessionGuard(): null` as before. The test-local helper is renamed `useEffectCalls` → `effectCalls(text): Array<{ body; deps; hook }>`.

- [ ] **Step 1: Write the runtime and server-render tests.** Create `apps/web/lib/session-guard-runtime.test.tsx`. Its two tests besides the fresh-identity one pass before the fix: they are **characterization tests** of #146's mount-lifetime behavior.

```tsx
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
```

Then add the server-render check, also a **characterization test**, to `apps/web/lib/session-guard.test.tsx`:

```diff
diff --git a/apps/web/lib/session-guard.test.tsx b/apps/web/lib/session-guard.test.tsx
--- a/apps/web/lib/session-guard.test.tsx
+++ b/apps/web/lib/session-guard.test.tsx
@@ -45,4 +45,21 @@ describe('SessionGuard rendering', () => {
     expect(mocks.query).not.toHaveBeenCalled();
     expect(mocks.onSessionInvalid).not.toHaveBeenCalled();
   });
+
+  // #148: the guard's ref sync is a useLayoutEffect, which never runs during
+  // server rendering. The guard renders null, so its server markup can't
+  // change. This pins that rendering it on the server logs no React warning
+  // or error.
+  it('renders on the server without any console warning or error', () => {
+    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
+    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
+    try {
+      expect(renderToStaticMarkup(<SessionGuard />)).toBe('');
+      expect(error).not.toHaveBeenCalled();
+      expect(warn).not.toHaveBeenCalled();
+    } finally {
+      error.mockRestore();
+      warn.mockRestore();
+    }
+  });
 });
```

- [ ] **Step 2: Run to verify RED.**

Run: `pnpm --filter web exec vitest run lib/session-guard-runtime.test.tsx lib/session-guard.test.tsx`
Expected: 1 failed (`redirects through the current client and router after an identity change`, with `expected "vi.fn()" to be called 1 times, but got 0 times` on client B's `clearStore`), 4 passed. No other failures.

- [ ] **Step 3: Extend the source regression.** Apply:

```diff
diff --git a/apps/web/lib/session-routing-regressions.test.ts b/apps/web/lib/session-routing-regressions.test.ts
--- a/apps/web/lib/session-routing-regressions.test.ts
+++ b/apps/web/lib/session-routing-regressions.test.ts
@@ -43,23 +43,27 @@ describe('session routing regressions', () => {
     expect(guard).toContain('createSessionRedirector(');
   });
 
-  // Spec §4.3 item 1 (#146): one redirector per mounted guard. A structural
-  // source regression, not a runtime proof (no DOM environment): parsed with
-  // the TypeScript AST, so formatting changes don't break it. The effect that
-  // creates the redirector has no dependencies, so a client or router identity
-  // change cannot replace the latch. Its effects reach the current client and
-  // router through `latest`, kept in sync by an earlier [client, router]
-  // effect that only updates the ref.
+  // Spec §4.3 item 1 (#146, #148): one redirector per mounted guard. A
+  // structural source regression, parsed with the TypeScript AST so formatting
+  // changes don't break it; the runtime behavior is proven in
+  // session-guard-runtime.test.tsx. The passive effect that creates the
+  // redirector has no dependencies, so a client or router identity change
+  // cannot replace the latch. Its effects reach the current client and router
+  // through `latest`, kept in sync by an earlier [client, router] LAYOUT effect
+  // that only updates the ref, so the ref is current before any passive effect
+  // or later signal of the same commit.
   it('keeps the redirector mount-scoped while routing through the latest client and router (source)', () => {
-    const effects = useEffectCalls(readWebSource('components/layout/session-guard.tsx'));
+    const effects = effectCalls(readWebSource('components/layout/session-guard.tsx'));
     const redirectorIndex = effects.findIndex((effect) => effect.body.includes('createSessionRedirector('));
     const syncIndex = effects.findIndex((effect) => effect.body === '{latest.current={client,router};}');
 
     expect(redirectorIndex).toBeGreaterThanOrEqual(0);
+    expect(effects[redirectorIndex]?.hook).toBe('useEffect');
     expect(effects[redirectorIndex]?.deps).toBe('[]');
     expect(effects[redirectorIndex]?.body).toContain('clearStore:()=>latest.current.client.clearStore()');
     expect(effects[redirectorIndex]?.body).toContain("navigateToLogin:()=>latest.current.router.replace('/login')");
     expect(syncIndex).toBeGreaterThanOrEqual(0);
+    expect(effects[syncIndex]?.hook).toBe('useLayoutEffect');
     expect(effects[syncIndex]?.deps).toBe('[client,router]');
     expect(syncIndex).toBeLessThan(redirectorIndex);
   });
@@ -87,18 +91,26 @@ describe('session routing regressions', () => {
   });
 });
 
-// Each useEffect(callback, deps) call in a component, in source order. The
+// Each useEffect / useLayoutEffect(callback, deps) call in a component, in
+// source order, with which hook it is. The
 // callback body and dependency list are compacted (all whitespace and trailing
-// commas removed), so formatting never changes what the assertions see.
-function useEffectCalls(text: string) {
+// commas removed), so ordinary whitespace and trailing-comma formatting
+// changes do not affect the assertions.
+function effectCalls(text: string) {
   const source = ts.createSourceFile('component.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
   const normalize = (node: ts.Node | undefined) =>
     node ? node.getText(source).replace(/\s+/g, '').replace(/,(?=[\])}])/g, '') : undefined;
-  const calls: Array<{ body: string; deps: string | undefined }> = [];
+  const calls: Array<{ body: string; deps: string | undefined; hook: string }> = [];
   const visit = (node: ts.Node) => {
-    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useEffect') {
+    if (
+      ts.isCallExpression(node) &&
+      ts.isIdentifier(node.expression) &&
+      (node.expression.text === 'useEffect' || node.expression.text === 'useLayoutEffect')
+    ) {
       const [callback, deps] = node.arguments;
-      if (callback && ts.isArrowFunction(callback)) calls.push({ body: normalize(callback.body) ?? '', deps: normalize(deps) });
+      if (callback && ts.isArrowFunction(callback)) {
+        calls.push({ body: normalize(callback.body) ?? '', deps: normalize(deps), hook: node.expression.text });
+      }
     }
     ts.forEachChild(node, visit);
   };
```

Run: `pnpm --filter web exec vitest run lib/session-routing-regressions.test.ts`
Expected: 1 failed (`keeps the redirector mount-scoped … (source)`, `Expected: "useLayoutEffect"`, `Received: "useEffect"`), 6 passed.

- [ ] **Step 4: Implement.** Apply:

```diff
diff --git a/apps/web/components/layout/session-guard.tsx b/apps/web/components/layout/session-guard.tsx
--- a/apps/web/components/layout/session-guard.tsx
+++ b/apps/web/components/layout/session-guard.tsx
@@ -3,7 +3,7 @@
 import { useApolloClient } from '@apollo/client';
 import { CurrentAdminDocument, onSessionInvalid } from '@clensy/client';
 import { usePathname, useRouter } from 'next/navigation';
-import { useEffect, useRef } from 'react';
+import { useEffect, useLayoutEffect, useRef } from 'react';
 
 import { createSessionRedirector, runSessionCheck, type SessionRedirector } from '../../lib/session-redirect';
 
@@ -24,8 +24,10 @@ export function SessionGuard() {
   const redirector = useRef<SessionRedirector | null>(null);
 
   // Keeps the redirect calling the current client and router (spec §4.3
-  // item 1) without re-creating the latch when their identity changes.
-  useEffect(() => {
+  // item 1) without re-creating the latch when their identity changes. A
+  // layout effect (#148): the ref is current before any passive effect or
+  // later signal of the same commit can run a redirect step.
+  useLayoutEffect(() => {
     latest.current = { client, router };
   }, [client, router]);
 
```

- [ ] **Step 5: Verify GREEN.**

Run: `pnpm --filter web exec vitest run lib/session-guard-runtime.test.tsx lib/session-routing-regressions.test.ts lib/session-guard.test.tsx && pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: 12 passed, and `tsc` and ESLint clean.

- [ ] **Step 6: Characterization evidence** (not committed). Run each of the following, then restore `session-guard.tsx` byte for byte:
  1. Change the redirector effect's `}, []);` to `}, [client, router]);`. Expected: `keeps one redirector and one listener across an identity change` fails.
  2. Remove `unsubscribe();` from the redirector effect's cleanup. Expected: `leaves exactly one live listener after a strict-mode double mount` fails.
  3. Add `console.warn('probe');` just before the guard's `return null;`. Expected: `renders on the server without any console warning or error` fails.

- [ ] **Step 7: Commit.**

```bash
git add apps/web/components/layout/session-guard.tsx apps/web/lib/session-guard-runtime.test.tsx apps/web/lib/session-guard.test.tsx apps/web/lib/session-routing-regressions.test.ts
git commit -m "fix(148): sync SessionGuard's latest ref in the layout phase"
```

---

## Final verification (before the M6 handoff report)

1. `pnpm run lint`: 6/6 succeed.
2. `pnpm --filter web exec tsc --noEmit` and `pnpm --filter api exec tsc --noEmit`: clean.
3. `pnpm run test`: 10/10, with `web` 554/554 and `@clensy/client` 10/10.
4. `pnpm --filter web build`: exit 0.
5. `git diff --name-only 78c071f -- . ':(exclude)docs'`: exactly these four lines:

   ```text
   apps/web/components/layout/session-guard.tsx
   apps/web/lib/session-guard-runtime.test.tsx
   apps/web/lib/session-guard.test.tsx
   apps/web/lib/session-routing-regressions.test.ts
   ```

## Traceability

| Spec | Task |
| --- | --- |
| §4.3 item 1 (#146): one latch per mount; the redirect calls the **current** client and router | 1 (fix, runtime regression, source regression) |
| Invariant 3 (one latch per guard lifetime) | 1 (characterization: one redirector across an identity change; strict-mode listener count) |
| §8 item 2 (#146): source regression for the one-latch-per-mount rule | 1 (extended to the hook kind) |
| §4.2 Rendering (the guard renders nothing) | 1 (server render: empty markup, no console warning or error) |

## Deferred (not in this plan)

- #146's other two M7 Minors (the literal-only `/login` scan; the exact-text sync-body assertion). Both were judged by design or fail-safe. This plan's helper change keeps the exact compacted-body match.

## Execution risks (operational only)

- **Changes to `main`.** If `main` moves under `session-guard.tsx` or `session-routing-regressions.test.ts` before merge, re-apply by quoted anchor and re-run every `Expected:` line.

## Gate outcomes

### M6 — Implementation complete (2026-10-08)

Executed natively (superpowers:executing-plans) on `feat/148-session-guard-layout-sync`, applying the plan's own code blocks and diffs.

| Step | Observed |
| --- | --- |
| 2 RED | 1 failed (`redirects through the current client and router after an identity change`: `expected "vi.fn()" to be called 1 times, but got 0 times`), 4 passed |
| 3 RED | 1 failed (`keeps the redirector mount-scoped … (source)`: `Expected: "useLayoutEffect"`, `Received: "useEffect"`), 6 passed |
| 5 GREEN | 12 passed; `tsc` and ESLint clean |
| Commit | `960a01e` |

- **Characterization tests** (M6 step 3.6). Each one failed against a mutation made outside the commit. The guard was restored byte for byte after each:
  - redirector dependencies `[client, router]` failed `keeps one redirector and one listener across an identity change` (`… called 1 times, but got 2 times`);
  - dropping `unsubscribe()` failed `leaves exactly one live listener after a strict-mode double mount`;
  - `console.warn('probe')` in render failed `renders on the server without any console warning or error`.
- **Deviations from the plan:** none. No rulings were needed.
- **Final verification** (steps 1–5), all as expected:
  - `pnpm run lint` 6/6;
  - web and API `tsc` clean;
  - `pnpm run test` 10/10, with `web` 554/554 and `@clensy/client` 10/10;
  - `pnpm --filter web build` exits 0, with no `warning` or `useLayoutEffect` text in its output;
  - `git diff --name-only 78c071f -- . ':(exclude)docs'` lists exactly the four planned files.
  - `main` had not moved since the branch was cut.

### M7 — Approved for merge (2026-10-08)

- **Subject:** PR [#149](https://github.com/rexescario-dev/clensy-platform/pull/149), head `b671e86`. It carries this Accepted plan and the M6 change set (process spec §2.8). `main` had not moved (`78c071f`).
- **Accepted specification:** `docs/superpowers/specs/2026-10-07-session-routing-design.md` §4.3 item 1 (#146). No spec change; the reviewer judged that correct.
- **Accepted implementation plan:** this document.
- **M6 gate:** plan Accept `8881eb2` (recorded `0f99122`) is an ancestor of the implementation commit `960a01e`.
- **Plan tasks reviewed:** Task 1, steps 1–7 ✓. The runtime test file is byte-identical to the plan's code block, and every diff matches.
- **Review basis:** an **independent review** by a fresh Opus agent context that did not implement the change, as CLAUDE.md requires for application-code slices. This record was written by the implementer and is based on that review. The reviewer:
  - re-ran `web` test (554/554), web `tsc` and lint, and the four-file scope check;
  - reproduced the RED by restoring the pre-#148 guard. The fresh-identity test failed, and a call-count probe showed the stale client A received `clearStore()`.
  - checked the **real Next.js server path**, as the owner required:
    - `next build`: every `/app/*` route prerendered through Next's server renderer, with no warning;
    - `next start`, with a session cookie: `/app`, `/app/bookings` and `/app/admin` returned 200, and the log was clean;
    - `next dev --webpack` (React's development server renderer, per request): 200s, and no warning beyond the pre-existing "middleware file convention is deprecated" notice.
  - reasoned that hydration can't produce a mismatch: the guard renders `null`, and `latest` is seeded from the same render.
  - checked the central invariant against React 19's commit phases: layout creates run depth-first, children before parents and siblings in order, before passive effects.
- **Verification evidence:** CI run [37657205016](https://github.com/rexescario-dev/clensy-platform/actions/runs/37657205016) on `b671e86`: Lint, Test, Release gate and API e2e all passed. The M6 RED/GREEN and mutation evidence is recorded above.
- **Blocking findings:** none (0 Critical, 0 Important).
- **Non-blocking observations:**
  1. `session-guard.test.tsx`'s comment "No DOM test environment exists in this repo…" was stale. It is fixed in M9 below: a comment-only edit in a file this slice already changes.
  2. A deferred Minor: the invariant covers *later* siblings. An earlier sibling's descendant that raised the session signal synchronously from its own layout effect, during the identity-change commit, would still see the stale objects. That can't happen, because `onSessionInvalid` is raised from Apollo's error link on an async network response.
- **Environment note.** The reviewer's dev-server run rewrote the gitignored, auto-generated `apps/web/next-env.d.ts` (`./.next/types/` → `./.next/dev/types/`) in the worktree, and its attempt to restore it was denied by the permission system. The file is not tracked, and the next `next build` regenerates it. No tracked file changed.
- **Gate:** merge per human/project norms.

### M8 — N/A (2026-10-08)

The change is one hook swap plus tests. M7 found nothing to refactor. Deferred Minor 2 is about effect timing, not a behavior-preserving refactor.

### M9 — Complete (2026-10-08)

**Documentation scope:** the comment at the head of `apps/web/lib/session-guard.test.tsx`'s render tests, the spec's Followed-by row, and this section.

**Content updates:**
- `apps/web/lib/session-guard.test.tsx` comment. "No DOM test environment exists in this repo" was false after this slice. It now points to the jsdom runtime test (`session-guard-runtime.test.tsx`) as well as the source regression and the latch unit tests. Comment-only, in a file already in this slice's change set. Caused by M7 observation 1.
- The #131 spec's Followed-by row now records #148 (PR #149) as code conformance to §4.3 item 1, with no spec change. Caused by the PR being opened.
- This section. Caused by the M7–M9 gate outcomes.

**Editorial changes:** none.

**Unchanged:** `apps/web/README.md`. It doesn't describe the guard's internal effect ordering, and nothing it describes changed.

**Verification:**
- `session-guard.test.tsx` passes 2/2 and web lint is clean after the comment edit.
- Relative links resolve (scripted scan).
- Status is consistent: the plan is Accepted, M7 is Approved, and the PR is open with CI green.

### M10 — Accepted, workflow validated (2026-10-08)

**Subject:** the installed workflow prompt library (`docs/workflows/`, generic 1.4.1 / claude 0.2.0), against `docs/workflows/specs/agent-workflow-design.md` §2.10. This slice ran it on #148.

**Checks:**
- **Entry at M4.** The workflow skill's selection rule held: an Accepted spec already required the behavior, so the slice entered at M4 with no amendment. The plan states that explicitly, and M7 confirmed it was correct.
- §2.5 was honoured: plan Accept `0f99122` is an ancestor of the implementation commit `960a01e`.
- M5 recorded an explicit Return before Accept. The first pass removed an unsupported premise about React's server warnings and replaced it with a test.
- Providers were honoured: GitHub for the issue (#148), branch and PR (#149).
- CLAUDE.md's M7 rule was honoured: a fresh, independent reviewer on the most capable model, citing CI.
- Slice Completion Reports were emitted at M6 and at M7–M9.
- §2.8 was honoured: one PR (#149) carries the plan, implementation and docs.

**Blocking findings:** none.

**Non-blocking observations:**
1. **Premises about framework behavior should be verified, not asserted.** M5 caught a plan stating React behavior as fact. Converting it into a test, plus the M7 real-server check, was the right pattern for future plans.
2. **Reviewer probes can touch gitignored generated files.** Running a dev server rewrote `next-env.d.ts` in the worktree. Reviewer prompts could ask for production-mode checks first, or say which generated files may be regenerated.
