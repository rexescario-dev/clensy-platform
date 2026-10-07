# Session Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Accepted |
| M5 decision | **Accepted** — 2026-10-07, at `17df9f6`, by the owner, on the second pass, with no further changes. Executed natively in this session, task by task. M6 MUST stay bounded to this plan: the subscriber-scoped signal; the single-flight latch; `runSessionCheck` bound to the redirector captured at check start; one render-less `SessionGuard` with a `network-only` check on mount and pathname changes only; the landing and admin retirements; and the `/login` navigation scan. M7 MUST use a fresh, independent reviewer (application-code and session-routing slice). |
| M5 history | First pass (2026-10-07, at `52d26b6`): the owner found the architecture and sequencing sound and requested two changes, both applied. (1) **Out-of-order and stale-check lifecycle pinned directly.** The check-to-report step moves into a pure `runSessionCheck(query, redirector)` in Task 2, bound to the redirector captured when the check starts. Four unit tests cover an out-of-order null after a later principal, a later principal not undoing a started redirect, a stale check not acting through a newer redirector, and a rejected check. Task 3 adds a source regression: the guard passes the captured `current`, reads the ref only synchronously at effect start, and has no `.then(` callback. (2) **The `isNoPrincipalResult` comment** now states that a null or absent `currentAdmin` (including an absent `data`) is deliberate defensive evidence under the Accepted spec. One optional rename was applied: the render test is now `renders nothing and does not delay its sibling page`. No product semantics changed. |
| Date | 2026-10-07 |
| Tracking issue | [#131](https://github.com/rexescario-dev/clensy-platform/issues/131) |
| Scope | `packages/client`: the session signal, the link wiring, an export, and a Vitest setup for the package's first tests. `apps/web`: a new layout component, a pure redirect helper, the `/app` layout, the `/app` landing, `/app/admin`, one `nav` copy key, one ESLint test exception, and tests. `pnpm-lock.yaml`: the `vitest` devDependency for `packages/client`. No `apps/api`, `middleware.ts`, `PageVisibilityGate`, `user-menu.tsx`, `app/login` or `packages/ui`/`packages/web` source changes. |
| Implements (Accepted) | [Consistent `/login` Routing for Missing or Invalid Sessions Across `/app` — Design](../specs/2026-10-07-session-routing-design.md), Status **Accepted** (M3, 2026-10-07, `0e81e98`) |
| Relies on (Accepted) | [Role-Aware Typed URLs](../specs/2026-10-04-role-aware-typed-urls-design.md) §4.2, §5 invariants 4–7, plus its #131 cross-reference amendment (Accepted 2026-10-07); [Admin Foundation](../specs/2026-08-14-admin-foundation-design.md) §4.8; [Multi-Tenant Architecture](../specs/2026-09-23-multi-tenant-architecture-design.md) §5 invariant 13; [Web Shell and Design System](../specs/2026-09-10-web-shell-and-design-system-design.md) |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. File layout, task grouping, order, helper names (`sessionErrorLink`, `createSessionRedirector`, `isNoPrincipalResult`, `runSessionCheck`, `SessionCheckResult`), test names and CSS classes are planning decisions, not product semantics. |
| Edit anchors | New files are given in full. Edits to existing files are given as unified diffs against the branch base, `61b6fb8` (`main`). The spec commits on top touch no code. |
| Pre-validation | **Full.** See below. |

**Goal:** Deliver spec §4.1–§4.6. A subscriber-scoped `UNAUTHENTICATED` signal in `packages/client`, and one render-less `SessionGuard` in the `/app` layout. The guard redirects through a single-flight `clearStore()` → `router.replace('/login')` on session evidence. The `/app` and `/app/admin` page-local `/login` redirects are retired.

**Architecture:**

- **Signal (`packages/client/src/session-signal.ts`).** An Apollo `onError` link, `sessionErrorLink`, is composed ahead of the `HttpLink` in the shared `apolloClient`.
  - It notifies listeners registered through `onSessionInvalid`, once per result that carries an `UNAUTHENTICATED` GraphQL error.
  - It ignores anything that arrives with a `networkError`. The API returns `UNAUTHENTICATED` with HTTP 200, which Apollo 3.14 passes as `graphQLErrors` with no `networkError`.
  - It never touches routing or the store.
- **Latch (`apps/web/lib/session-redirect.ts`).** This is pure, so it can be unit-tested in Vitest's `node` environment; the repo has no DOM test environment.
  - `createSessionRedirector({ clearStore, navigateToLogin })` returns `{ report, dispose }`. The first `report()` commits one `clearStore()` → `navigateToLogin()` sequence (spec §4.3), and later reports join it.
  - `dispose()` stops new evidence but never cancels a committed sequence.
  - `isNoPrincipalResult(result)` is spec §3 evidence (2).
  - `runSessionCheck(query, redirector)` runs one check and reports only to the redirector it was given, the one captured when the check started. So a check that outlives its guard can't act through a newer one. Out-of-order results need no cancellation.
- **Guard (`apps/web/components/layout/session-guard.tsx`).** It renders `null`, with two effects:
  - **Mount:** create the redirector with `client.clearStore()` and `router.replace('/login')`, subscribe to the signal, and on unmount unsubscribe and dispose.
  - **Session check:** keyed on `[client, pathname]`, so it runs on mount and on each pathname change. It reads the ref once, synchronously, and calls `runSessionCheck(() => client.query({ query: CurrentAdminDocument, fetchPolicy: 'network-only' }), current)`. A no-principal result reports; a rejection is ignored, because an `UNAUTHENTICATED` rejection has already raised the signal.
  - The guard is mounted beside `PageVisibilityGate` in `app/app/layout.tsx`.
- **Retirements.**
  - `landingTarget` loses its `'/login'` outcome. The landing page shows `nav.landing.error` on a failed read.
  - The admin page loses its redirect effect and shows `staff.loadError` on a failed or missing `currentAdmin`.

**Tech Stack:** Next.js 16 App Router (client components), React 19, Apollo Client 3.14 (`@apollo/client/link/error` `onError`), `@clensy/client` generated documents, next-intl 4, TypeScript 5, and Vitest 5 in the `node` environment with `react-dom/server` `renderToStaticMarkup`. Static rendering runs no effects, so effect wiring is pinned at source level, the house pattern.

**Spec:** [`docs/superpowers/specs/2026-10-07-session-routing-design.md`](../specs/2026-10-07-session-routing-design.md). Executors read both.

**Pre-validation (full).** Before M5, on 2026-10-07, every code block and diff in Tasks 1–5 was applied to a working tree at `a0f0e46`. The M5 first-pass revisions were applied the same way and re-validated at `52d26b6`, and every command named by an `Expected:` line ran with the stated result.

- **Gaps found and folded in.** The first application found two gaps, both now part of the plan:
  1. Task 3 must also update #114's existing gate-mount regression in `web-shell-regressions.test.ts` (Task 3 Step 5).
  2. Task 5's `/login` scan must match navigation, not prose. An existing layout comment quotes `` `/login` `` (Task 5 Step 1).
- **Mutation checks.** Planting `// router.replace('/login');` in `app/app/page.tsx` makes the Task 5 scan fail. Changing the guard to pass `redirector.current ?? current` to `runSessionCheck` makes the Task 3 binding regression fail. Both were then reverted.
- **Commands run:**
  - `pnpm install`
  - `pnpm --filter @clensy/client test`
  - `pnpm --filter @clensy/client build`
  - `pnpm --filter @clensy/client lint`
  - each task's `pnpm --filter web exec vitest run …`
  - `pnpm --filter web test`
  - `pnpm --filter web exec tsc --noEmit`
  - `pnpm --filter web lint`
  - Final verification: `pnpm run lint`, `pnpm --filter web exec tsc --noEmit`, `pnpm --filter api exec tsc --noEmit`, `pnpm run test`.
- **Final counts:** `@clensy/client` 10 tests, `web` 521 tests (baseline 496), and every other workspace green.

- **Replay from the plan text.** After each revision, the tree was reset and Tasks 1–5 were re-applied **from this document's own code blocks and diffs**, in order, mechanically. Every RED and GREEN `Expected:` line was re-run, and every result matched.
  - The first replay caught one plan-assembly defect: Task 5's "append" block began with a stray fragment of Task 4's tests. It was corrected before the first M5 pass.
  - Final verification steps 1–4 and the mutation check then passed on the replayed tree.

The tree was then reverted. Only this plan is committed.

## Global Constraints

- Session evidence is exactly: a GraphQL error with `extensions.code === 'UNAUTHENTICATED'`; or a successful `currentAdmin` check with `data.currentAdmin == null` and no error. Nothing else redirects (spec §3, §5 invariant 2).
- At most one `clearStore()` → `router.replace('/login')` per guard lifetime, `clearStore()` first. A rejected `clearStore()` still navigates (spec §4.3, invariants 3–4).
- A latched sequence completes across unmount, while new evidence after unmount does nothing. No "still mounted?" check sits between the two steps (spec §4.3 item 4, invariant 10).
- `packages/client` MUST NOT redirect, clear or reset the store, or reference `/login` or `next/*` (invariant 5).
- The guard renders `null`, never wraps or delays the page, and uses no visibility helper (`canViewPath`, `isGatedPath`, `landingHref`, `visibleNavGroups`, `viewRoles`) (invariants 6–7).
- The check is `fetchPolicy: 'network-only'`, keyed on `usePathname()` only, never `useSearchParams` (invariant 9).
- `PageVisibilityGate`, `middleware.ts`, `user-menu.tsx`, `app/login/page.tsx` and `apps/api` stay byte-identical (spec §2 Out of scope, invariants 11, 13).
- Copy: `nav.landing.error` = `Unable to load your account.` (spec §4.6). The admin page uses the existing `staff.loadError` = `Unable to load staff accounts.`.
- `apps/web` navigates to `/login` only from `components/layout/session-guard.tsx` and `components/layout/user-menu.tsx`, within `app/app/**` and `components/**` (invariant 12).

## Review Focus

These are behaviors no single task's tests can fully exercise, because of the node-only test environment. Each line names where it is pinned.

1. **A real expired session in a browser:** the page's error may flash, then exactly one navigation to `/login` happens. Pinned by the latch unit tests (Task 2) and the guard's source wiring (Task 3), not by an end-to-end test. M7 should read the guard's two effects against spec §4.2 line by line.
2. **The hidden-page case:** a cached principal and a gate-denied page, with the guard's check producing the redirect. Pinned by Task 3's wiring regressions (the check runs on mount and on each pathname change).
3. **Search-parameter-only navigation (bookings paging)** must not re-check. Pinned by Task 3's source assertions (`[client, pathname]`, no `useSearchParams`).
4. **React strict-mode double mount in dev:** mount, unmount, mount. Dispose stops the first redirector, and the second subscribes afresh. A check started under the disposed redirector does not act, and it cannot reach the new one. Pinned by Task 2's dispose and `runSessionCheck` tests and Task 3's binding regression.
5. **The wrong password on `/login`:** the guard isn't mounted there, so nothing listens. Pinned by Task 1's "no listener" test and the layout-only mount (Task 3).

## File Map

| File | Task | Responsibility |
| --- | --- | --- |
| `packages/client/src/session-signal.ts` (new) | 1 | `sessionErrorLink`, `onSessionInvalid` |
| `packages/client/src/session-signal.test.ts` (new) | 1 | Signal, wiring and package-scan tests |
| `packages/client/vitest.config.ts` (new) | 1 | `node` Vitest config (mirrors `packages/web`) |
| `packages/client/package.json`, `pnpm-lock.yaml` | 1 | `test` script, `vitest` devDependency |
| `packages/client/src/apollo-client.ts`, `src/index.ts` | 1 | Link composition, export |
| `apps/web/lib/session-redirect.ts` (new) | 2 | Single-flight latch, evidence (2) predicate |
| `apps/web/lib/session-redirect.test.ts` (new) | 2 | Latch and predicate unit tests |
| `apps/web/components/layout/session-guard.tsx` (new) | 3 | The guard |
| `apps/web/app/app/layout.tsx` | 3 | Mount |
| `apps/web/lib/session-guard.test.tsx` (new) | 3 | Render-less / non-blocking |
| `apps/web/lib/session-routing-regressions.test.ts` (new) | 3 | Wiring and boundary source regressions |
| `apps/web/lib/web-shell-regressions.test.ts` | 3, 4, 5 | Gate-mount regex; landing has no `/login`; the `/login` navigation scan |
| `apps/web/lib/landing-target.ts`, `.test.ts`; `apps/web/app/app/page.tsx` | 4 | Landing |
| `apps/web/messages/en/nav.json`, `apps/web/i18n/messages.test.ts` | 4 | `nav.landing.error` |
| `apps/web/lib/session-routing-pages.test.tsx` (new) | 4, 5 | Landing and admin render states |
| `apps/web/eslint.config.mjs` | 4 | `getMessages` test exception for the new render test |
| `apps/web/app/app/admin/page.tsx`, `apps/web/lib/tenant-role-regressions.test.ts` | 5 | Admin retirement |

Commit messages carry no `Co-Authored-By: Claude` trailer (owner's global instruction).

---

### Task 1: Session signal in `packages/client` (spec §4.1; §5 invariant 5; §8 item 1)

**Files:**
- Create: `packages/client/vitest.config.ts`, `packages/client/src/session-signal.ts`, `packages/client/src/session-signal.test.ts`
- Modify: `packages/client/package.json`, `pnpm-lock.yaml` (via `pnpm install`), `packages/client/src/apollo-client.ts`, `packages/client/src/index.ts`

**Interfaces:**
- Produces: `onSessionInvalid(listener: () => void): () => void`, exported from `@clensy/client`. Also `sessionErrorLink: ApolloLink`, exported from `./session-signal` only (not from the package index), for the client and the tests.

- [ ] **Step 1: Add the test runner.** Apply:

```diff
diff --git a/packages/client/package.json b/packages/client/package.json
--- a/packages/client/package.json
+++ b/packages/client/package.json
@@ -6,7 +6,8 @@
   "scripts": {
     "build": "tsc --noEmit",
     "lint": "eslint src",
-    "codegen": "graphql-codegen --config codegen.ts"
+    "codegen": "graphql-codegen --config codegen.ts",
+    "test": "vitest run"
   },
   "dependencies": {
     "@apollo/client": "^3.14.1",
@@ -24,6 +25,7 @@
     "globals": "^17.0.0",
     "react": "^19.2.8",
     "typescript": "^5.7.3",
-    "typescript-eslint": "^8.20.0"
+    "typescript-eslint": "^8.20.0",
+    "vitest": "^5.0.0"
   }
 }
```

Create `packages/client/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

Run: `pnpm install`
Expected: the lockfile gains `vitest` under the `packages/client` importer (3 lines), and nothing else changes.

- [ ] **Step 2: Write the failing tests.** Create `packages/client/src/session-signal.test.ts`:

```ts
import { ApolloLink, execute, gql, Observable, type FetchResult } from '@apollo/client';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { onSessionInvalid, sessionErrorLink } from './session-signal';

const PROBE = gql`
  query Probe {
    probe
  }
`;

const unauthenticated = { message: 'Unauthorized', extensions: { code: 'UNAUTHENTICATED' } };
const forbidden = { message: 'Forbidden resource', extensions: { code: 'FORBIDDEN' } };

const unsubscribes: Array<() => void> = [];

afterEach(() => {
  for (const unsubscribe of unsubscribes.splice(0)) unsubscribe();
});

function listen() {
  const listener = vi.fn();
  unsubscribes.push(onSessionInvalid(listener));
  return listener;
}

// Runs one operation through the session link and a terminating stub, and
// resolves with what the caller observes.
function runOperation(outcome: { error: Error } | { result: FetchResult }) {
  const terminating = new ApolloLink(
    () =>
      new Observable<FetchResult>((observer) => {
        if ('error' in outcome) {
          observer.error(outcome.error);
          return;
        }
        observer.next(outcome.result);
        observer.complete();
      }),
  );
  return new Promise<{ error?: unknown; results: FetchResult[] }>((settle) => {
    const results: FetchResult[] = [];
    execute(ApolloLink.from([sessionErrorLink, terminating]), { query: PROBE }).subscribe({
      complete: () => settle({ results }),
      error: (error: unknown) => settle({ error, results }),
      next: (result) => results.push(result),
    });
  });
}

// Session routing spec §4.1 / §8 item 1.
describe('session signal', () => {
  it('notifies every registered listener once for an UNAUTHENTICATED result', async () => {
    const first = listen();
    const second = listen();

    await runOperation({ result: { data: null, errors: [unauthenticated] } });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('notifies each listener exactly once for a result carrying several errors', async () => {
    const listener = listen();

    await runOperation({ result: { data: null, errors: [unauthenticated, forbidden, unauthenticated] } });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['FORBIDDEN', { result: { data: null, errors: [forbidden] } }],
    ['another error code', { result: { data: null, errors: [{ message: 'Bad input', extensions: { code: 'BAD_USER_INPUT' } }] } }],
    ['a success', { result: { data: { probe: 'ok' } } }],
    ['a network error', { error: new Error('Failed to fetch') }],
  ] as const)('does not notify for %s', async (_name, outcome) => {
    const listener = listen();

    await runOperation(outcome);

    expect(listener).not.toHaveBeenCalled();
  });

  it('passes the result to the caller unchanged, with or without a listener', async () => {
    const result = { data: null, errors: [unauthenticated] };

    expect((await runOperation({ result })).results).toEqual([result]);
    listen();
    expect((await runOperation({ result })).results).toEqual([result]);
  });

  it('stops notifying after unsubscribe', async () => {
    const listener = vi.fn();
    const unsubscribe = onSessionInvalid(listener);

    unsubscribe();
    await runOperation({ result: { data: null, errors: [unauthenticated] } });

    expect(listener).not.toHaveBeenCalled();
  });

  it('puts the session link ahead of the transport in the shared client', () => {
    const client = readFileSync(resolve(import.meta.dirname, 'apollo-client.ts'), 'utf8');

    expect(client).toMatch(/link: ApolloLink\.from\(\[\s*sessionErrorLink,\s*new HttpLink\(/);
  });

  // Invariant 5: the signal only notifies. No routing or cache reset lives in
  // this package.
  it('keeps routing and store resets out of packages/client source', () => {
    const srcRoot = resolve(import.meta.dirname);
    const sources = readdirSync(srcRoot, { recursive: true, encoding: 'utf8' })
      .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
      .map((path) => readFileSync(join(srcRoot, path), 'utf8'));

    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source).not.toMatch(/\/login|next\/|clearStore|resetStore/);
    }
  });
});
```

- [ ] **Step 3: Run to verify RED.**

Run: `pnpm --filter @clensy/client test`
Expected: FAIL, `Cannot find module './session-signal'`.

- [ ] **Step 4: Implement the signal.** Create `packages/client/src/session-signal.ts`. The comment deliberately says "the sign-in page", not the path: the package scan forbids the path literal in this package's source.

```ts
import { onError } from '@apollo/client/link/error';
import type { GraphQLFormattedError } from 'graphql';

// The session signal (session routing spec §4.1). Any operation whose result
// carries a GraphQL error with code UNAUTHENTICATED notifies the registered
// listeners, once per result. It only notifies: it never redirects, clears
// the store or knows about routing (spec §5 invariant 5), so with no
// listener — e.g. a wrong password on the sign-in page, outside the /app layout — it
// does nothing. Network and HTTP-level failures are not session evidence and
// never notify. Results pass through to the caller unchanged.
type SessionInvalidListener = () => void;

const listeners = new Set<SessionInvalidListener>();

export const sessionErrorLink = onError(({ graphQLErrors, networkError }) => {
  if (networkError) return;
  if (hasUnauthenticatedError(graphQLErrors)) notifySessionInvalid();
});

export function onSessionInvalid(listener: SessionInvalidListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function hasUnauthenticatedError(errors: ReadonlyArray<GraphQLFormattedError> | undefined): boolean {
  return errors?.some((error) => error.extensions?.code === 'UNAUTHENTICATED') ?? false;
}

function notifySessionInvalid(): void {
  for (const listener of [...listeners]) listener();
}
```

Run: `pnpm --filter @clensy/client test`
Expected: 9 passed, 1 failed (`puts the session link ahead of the transport in the shared client`).

- [ ] **Step 5: Wire and export.** Apply:

```diff
diff --git a/packages/client/src/apollo-client.ts b/packages/client/src/apollo-client.ts
--- a/packages/client/src/apollo-client.ts
+++ b/packages/client/src/apollo-client.ts
@@ -1,4 +1,6 @@
-import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
+import { ApolloClient, ApolloLink, HttpLink, InMemoryCache } from '@apollo/client';
+
+import { sessionErrorLink } from './session-signal';
 
 // URL of apps/api's GraphQL endpoint (default Apollo path mounted by
 // platform/graphql/graphql.module.ts). `NEXT_PUBLIC_` so Next.js inlines it
@@ -10,12 +12,17 @@ const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/graphq
 
 export const apolloClient = new ApolloClient({
   cache: new InMemoryCache(),
-  link: new HttpLink({
-    // Required so the browser sends the HttpOnly session cookie set by
-    // apps/api's `login` mutation across the apps/web <-> apps/api origin
-    // boundary (spec §4; matches apps/api/src/main.ts's
-    // `enableCors({ credentials: true, ... })`).
-    credentials: 'include',
-    uri: API_URL,
-  }),
+  // The session error link observes every operation's GraphQL errors ahead
+  // of the transport (session routing spec §4.1).
+  link: ApolloLink.from([
+    sessionErrorLink,
+    new HttpLink({
+      // Required so the browser sends the HttpOnly session cookie set by
+      // apps/api's `login` mutation across the apps/web <-> apps/api origin
+      // boundary (spec §4; matches apps/api/src/main.ts's
+      // `enableCors({ credentials: true, ... })`).
+      credentials: 'include',
+      uri: API_URL,
+    }),
+  ]),
 });
```

```diff
diff --git a/packages/client/src/index.ts b/packages/client/src/index.ts
--- a/packages/client/src/index.ts
+++ b/packages/client/src/index.ts
@@ -1,2 +1,3 @@
 export { apolloClient } from './apollo-client';
+export { onSessionInvalid } from './session-signal';
 export * from './generated/graphql';
```

- [ ] **Step 6: Verify GREEN.**

Run: `pnpm --filter @clensy/client test && pnpm --filter @clensy/client build && pnpm --filter @clensy/client lint`
Expected: 10 passed; `tsc --noEmit` and ESLint clean.

- [ ] **Step 7: Commit.**

```bash
git add packages/client pnpm-lock.yaml
git commit -m "feat(131): add the subscriber-scoped UNAUTHENTICATED session signal to @clensy/client"
```

---

### Task 2: Single-flight redirect latch and session check (spec §3 evidence (2), §4.2 proactive evidence, §4.3; §5 invariants 3, 4, 10; §8 item 2)

**Files:**
- Create: `apps/web/lib/session-redirect.ts`, `apps/web/lib/session-redirect.test.ts`

**Interfaces:**
- Produces:
  - `createSessionRedirector(effects: SessionRedirectEffects): SessionRedirector`, where `SessionRedirectEffects = { clearStore: () => Promise<unknown>; navigateToLogin: () => void }` and `SessionRedirector = { dispose: () => void; report: () => Promise<void> }`.
  - `isNoPrincipalResult(result: SessionCheckResult): boolean`, where `SessionCheckResult = { data?: { currentAdmin?: unknown } | null; error?: unknown; errors?: readonly unknown[] }`.
  - `runSessionCheck(query: () => Promise<SessionCheckResult>, redirector: SessionRedirector): Promise<void>`.

- [ ] **Step 1: Write the failing tests.** Create `apps/web/lib/session-redirect.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify RED.**

Run: `pnpm --filter web exec vitest run lib/session-redirect.test.ts`
Expected: FAIL, `Cannot find module './session-redirect'`.

- [ ] **Step 3: Implement.** Create `apps/web/lib/session-redirect.ts`:

```ts
// The single-flight session redirect behind SessionGuard (session routing
// spec §4.3). Pure: the guard supplies the effects, so the latch is
// unit-tested without a DOM. The first report closes the latch and commits one
// clearStore() -> navigateToLogin() sequence; later reports join it. Dispose
// (the guard's unmount) stops new evidence from starting a sequence, but a
// committed sequence always runs to completion — there is deliberately no
// "still mounted?" check between its two steps (spec §5 invariant 10).
export interface SessionRedirectEffects {
  clearStore: () => Promise<unknown>;
  navigateToLogin: () => void;
}

export interface SessionRedirector {
  dispose: () => void;
  report: () => Promise<void>;
}

// The parts of a currentAdmin query result the session check reads.
export interface SessionCheckResult {
  data?: { currentAdmin?: unknown } | null;
  error?: unknown;
  errors?: readonly unknown[];
}

export function createSessionRedirector(effects: SessionRedirectEffects): SessionRedirector {
  let committed: Promise<void> | undefined;
  let disposed = false;

  return {
    dispose: () => {
      disposed = true;
    },
    report: () => {
      if (committed) return committed;
      if (disposed) return Promise.resolve();
      committed = runSessionRedirect(effects);
      return committed;
    },
  };
}

// Session evidence (2) (spec §3). The Accepted spec deliberately treats any
// successful, error-free result whose currentAdmin is null OR absent as
// no-principal evidence — including an absent `data` — as defensive client
// behavior; the API declares currentAdmin non-null, so neither is expected.
// Any error on the result means the check failed, which is never evidence.
export function isNoPrincipalResult(result: SessionCheckResult): boolean {
  if (result.error || result.errors?.length) return false;
  return result.data?.currentAdmin == null;
}

// One session check (spec §4.2). It reports to the redirector captured when
// the check started — never to whichever redirector is current when it
// settles — so a check outliving its guard (unmount, strict-mode remount)
// cannot act through a newer one. Checks are not cancelled: an out-of-order
// null still reports, and a later principal result never undoes a report. A
// rejection is not evidence (an UNAUTHENTICATED rejection has already raised
// the session signal).
export async function runSessionCheck(
  query: () => Promise<SessionCheckResult>,
  redirector: SessionRedirector,
): Promise<void> {
  let result: SessionCheckResult;
  try {
    result = await query();
  } catch {
    return;
  }
  if (isNoPrincipalResult(result)) await redirector.report();
}

async function runSessionRedirect(effects: SessionRedirectEffects): Promise<void> {
  try {
    await effects.clearStore();
  } catch {
    // Navigate regardless: a failed clear must not strand the user (spec §4.3).
  }
  effects.navigateToLogin();
}
```

- [ ] **Step 4: Verify GREEN.**

Run: `pnpm --filter web exec vitest run lib/session-redirect.test.ts`
Expected: 12 passed.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/lib/session-redirect.ts apps/web/lib/session-redirect.test.ts
git commit -m "feat(131): add the single-flight session redirect latch and session check"
```

---

### Task 3: `SessionGuard` and its layout mount (spec §4.2; §5 invariants 6–9, 11; §8 items 2, 5)

**Files:**
- Create: `apps/web/components/layout/session-guard.tsx`, `apps/web/lib/session-guard.test.tsx`, `apps/web/lib/session-routing-regressions.test.ts`
- Modify: `apps/web/app/app/layout.tsx`, `apps/web/lib/web-shell-regressions.test.ts` (the #114 gate-mount regex)

**Interfaces:**
- Consumes: `onSessionInvalid` and `CurrentAdminDocument` from `@clensy/client` (Task 1, generated); `createSessionRedirector`, `runSessionCheck` and `SessionRedirector` from `lib/session-redirect` (Task 2).
- Produces: `SessionGuard(): null`, a named export.

- [ ] **Step 1: Write the failing render test.** Create `apps/web/lib/session-guard.test.tsx`:

```tsx
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
```

- [ ] **Step 2: Write the failing source regressions.** Create `apps/web/lib/session-routing-regressions.test.ts`. `keeps the gate free of session handling` passes before and after. It is a **characterization test** pinning that the gate stays untouched (invariant 11).

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const webRoot = resolve(import.meta.dirname, '..');

function readWebSource(relativePath: string) {
  return readFileSync(resolve(webRoot, relativePath), 'utf8');
}

// Session routing spec §8 item 5. No DOM test environment exists in this
// repo, so the guard's wiring is pinned at source level.
describe('session routing regressions', () => {
  it('mounts SessionGuard once in the /app layout, beside PageVisibilityGate inside DashboardLayout', () => {
    const layout = readWebSource('app/app/layout.tsx');

    expect(layout.match(/<SessionGuard\b/g)).toHaveLength(1);
    expect(layout).toMatch(
      /<DashboardLayout>\s*<SessionGuard \/>\s*<PageVisibilityGate>\{children\}<\/PageVisibilityGate>\s*<\/DashboardLayout>/,
    );
  });

  it('keeps the gate free of session handling', () => {
    const gate = readWebSource('components/layout/page-visibility-gate.tsx');

    expect(gate).not.toMatch(/onSessionInvalid|SessionGuard|session-redirect|\/login/);
  });

  it('checks the session network-only on mount and pathname changes only', () => {
    const guard = readWebSource('components/layout/session-guard.tsx');

    expect(guard).toContain("query({ query: CurrentAdminDocument, fetchPolicy: 'network-only' })");
    expect(guard).toContain('usePathname()');
    expect(guard).not.toContain('useSearchParams');
    expect(guard).toContain('}, [client, pathname]);');
  });

  it('subscribes to the session signal and redirects through the single-flight redirector', () => {
    const guard = readWebSource('components/layout/session-guard.tsx');

    expect(guard).toContain('onSessionInvalid(');
    expect(guard).toContain('createSessionRedirector(');
    expect(guard).toContain("navigateToLogin: () => router.replace('/login')");
    expect(guard).toContain('clearStore: () => client.clearStore()');
  });

  // Spec §4.2 / §4.3 item 4: a check acts only through the redirector captured
  // when it started (behavior unit-tested in session-redirect.test.ts). The ref
  // is read once, synchronously, at the start of each effect — never inside an
  // async callback, where it could name a newer redirector.
  it('binds each session check to the redirector captured when it starts', () => {
    const guard = readWebSource('components/layout/session-guard.tsx');

    expect(guard).toContain(
      "void runSessionCheck(() => client.query({ query: CurrentAdminDocument, fetchPolicy: 'network-only' }), current);",
    );
    expect(guard.match(/redirector\.current\b/g)).toHaveLength(2);
    expect(guard).toContain('redirector.current = current;');
    expect(guard).toContain('const current = redirector.current;');
    expect(guard).not.toMatch(/\.then\(/);
  });

  it('makes no visibility decision in the guard', () => {
    const guard = readWebSource('components/layout/session-guard.tsx');

    expect(guard).not.toMatch(/canViewPath|isGatedPath|landingHref|visibleNavGroups|viewRoles|nav-groups/);
  });
});
```

- [ ] **Step 3: Run to verify RED.**

Run: `pnpm --filter web exec vitest run lib/session-guard.test.tsx lib/session-routing-regressions.test.ts`
Expected: FAIL. `session-guard.test.tsx` cannot find `../components/layout/session-guard`, and 5 of the 6 regressions fail. The characterization test passes.

- [ ] **Step 4: Implement the guard and mount it.** Create `apps/web/components/layout/session-guard.tsx`:

```tsx
'use client';

import { useApolloClient } from '@apollo/client';
import { CurrentAdminDocument, onSessionInvalid } from '@clensy/client';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { createSessionRedirector, runSessionCheck, type SessionRedirector } from '../../lib/session-redirect';

// The one /app session rule (session routing spec §4.2), mounted once by
// app/app/layout.tsx beside PageVisibilityGate. It renders nothing and never
// blocks the page. It redirects to /login only on session evidence (spec §3):
// an UNAUTHENTICATED operation (the packages/client session signal), or a
// network-only currentAdmin check, run on mount and on each pathname change,
// that settles with no principal. A failed check is not evidence and is
// ignored; an UNAUTHENTICATED check has already raised the signal. It decides
// only whether a session exists — page visibility stays with the gate. UX
// only: the API remains the authentication and authorization authority.
export function SessionGuard() {
  const client = useApolloClient();
  const router = useRouter();
  const pathname = usePathname();
  const redirector = useRef<SessionRedirector | null>(null);

  // Declared first so the latch exists before the mount check below starts.
  useEffect(() => {
    const current = createSessionRedirector({
      clearStore: () => client.clearStore(),
      navigateToLogin: () => router.replace('/login'),
    });
    redirector.current = current;
    const unsubscribe = onSessionInvalid(() => void current.report());
    return () => {
      unsubscribe();
      current.dispose();
    };
  }, [client, router]);

  // Each check is bound to the redirector current when it starts, never read
  // from the ref when it settles (spec §4.2, §4.3 item 4).
  useEffect(() => {
    const current = redirector.current;
    if (!current) return;
    void runSessionCheck(() => client.query({ query: CurrentAdminDocument, fetchPolicy: 'network-only' }), current);
  }, [client, pathname]);

  return null;
}
```

Apply:

```diff
diff --git a/apps/web/app/app/layout.tsx b/apps/web/app/app/layout.tsx
--- a/apps/web/app/app/layout.tsx
+++ b/apps/web/app/app/layout.tsx
@@ -2,6 +2,7 @@ import type { ReactNode } from 'react';
 import { AppI18nProvider } from '../../components/layout/app-i18n-provider';
 import { DashboardLayout } from '../../components/layout/dashboard-layout';
 import { PageVisibilityGate } from '../../components/layout/page-visibility-gate';
+import { SessionGuard } from '../../components/layout/session-guard';
 
 // The only layout file for the entire `/app/*` tree (Task 5 brief, Step 6).
 // Tasks 6-8 add pages under this layout, not new layout files.
@@ -26,10 +27,15 @@ import { PageVisibilityGate } from '../../components/layout/page-visibility-gate
 // `PageVisibilityGate` is the one page-visibility gate (role-aware typed URLs
 // spec §4.2): inside DashboardLayout, so shell chrome renders on every path
 // and only the page body is replaced. UX only, never authorization.
+//
+// `SessionGuard` is the one /app session rule (session routing spec §4.2): a
+// render-less sibling of the gate that sends a user with an invalid session
+// to /login. It never blocks the page and makes no visibility decision.
 export default function AppLayout({ children }: { children: ReactNode }) {
   return (
     <AppI18nProvider>
       <DashboardLayout>
+        <SessionGuard />
         <PageVisibilityGate>{children}</PageVisibilityGate>
       </DashboardLayout>
     </AppI18nProvider>
```

- [ ] **Step 5: Update #114's gate-mount regression.** That test pins the old layout exactly. The Accepted #131 spec §4.2 places `<SessionGuard />` immediately before the gate inside `DashboardLayout`. The #114 invariant ("mounted exactly once, inside `DashboardLayout`") is unchanged. Apply:

```diff
diff --git a/apps/web/lib/web-shell-regressions.test.ts b/apps/web/lib/web-shell-regressions.test.ts
--- a/apps/web/lib/web-shell-regressions.test.ts
+++ b/apps/web/lib/web-shell-regressions.test.ts
@@ -80,8 +82,10 @@ describe('web shell regressions', () => {
   it('mounts the page-visibility gate once, directly inside DashboardLayout', () => {
     const layout = readWebSource('app/app/layout.tsx');
 
+    // Its only sibling is the render-less SessionGuard (session routing spec
+    // §4.2), which never wraps or replaces the page.
     expect(layout).toMatch(
-      /<DashboardLayout>\s*<PageVisibilityGate>\{children\}<\/PageVisibilityGate>\s*<\/DashboardLayout>/,
+      /<DashboardLayout>\s*<SessionGuard \/>\s*<PageVisibilityGate>\{children\}<\/PageVisibilityGate>\s*<\/DashboardLayout>/,
     );
     const mounts = nonTestSources(webRoot)
       .filter((path) => readFileSync(path, 'utf8').includes('<PageVisibilityGate'))
```

- [ ] **Step 6: Verify GREEN.**

Run: `pnpm --filter web exec vitest run lib/session-guard.test.tsx lib/session-routing-regressions.test.ts lib/web-shell-regressions.test.ts && pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: all pass, with `tsc` and ESLint clean.

Run: `pnpm --filter web test`
Expected: all pass.

- [ ] **Step 7: Commit.**

```bash
git add apps/web/components/layout/session-guard.tsx apps/web/app/app/layout.tsx apps/web/lib/session-guard.test.tsx apps/web/lib/session-routing-regressions.test.ts apps/web/lib/web-shell-regressions.test.ts
git commit -m "feat(131): mount the render-less SessionGuard beside PageVisibilityGate"
```

---

### Task 4: Retire the `/app` landing's `/login` outcome (spec §4.4, §4.6; §8 items 3, 6)

**Files:**
- Create: `apps/web/lib/session-routing-pages.test.tsx` (the landing part)
- Modify: `apps/web/lib/landing-target.ts`, `apps/web/lib/landing-target.test.ts`, `apps/web/app/app/page.tsx`, `apps/web/messages/en/nav.json`, `apps/web/i18n/messages.test.ts`, `apps/web/lib/web-shell-regressions.test.ts` (the landing assertion), `apps/web/eslint.config.mjs`

**Interfaces:**
- Consumes: none from earlier tasks. The guard (Task 3) is what makes the removed outcome safe.
- Produces: `landingTarget(...)` that never returns `'/login'`. The copy key `nav.landing.error`.

- [ ] **Step 1: Update the tests to the new behavior.** Apply the following.

`landing-target.test.ts`: the `/login` case changes from a characterization to the new contract.

```diff
diff --git a/apps/web/lib/landing-target.test.ts b/apps/web/lib/landing-target.test.ts
--- a/apps/web/lib/landing-target.test.ts
+++ b/apps/web/lib/landing-target.test.ts
@@ -1,7 +1,8 @@
 import { describe, expect, it } from 'vitest';
 import { landingTarget } from './landing-target';
 
-// Characterizes the /app landing decision as shipped in #89 (plan decision 5).
+// The /app landing decision: #89 plan decision 5, minus its /login outcome,
+// which the layout's SessionGuard owns (session routing spec §4.4).
 describe('landingTarget', () => {
   it('waits while currentAdmin is loading, even if stale data or an error is present', () => {
     expect(landingTarget({ currentAdmin: undefined, error: undefined, loading: true })).toBeUndefined();
@@ -10,12 +11,12 @@ describe('landingTarget', () => {
     ).toBeUndefined();
   });
 
-  it('sends an errored or missing session to /login', () => {
-    expect(landingTarget({ currentAdmin: undefined, error: new Error('unauthenticated'), loading: false })).toBe('/login');
-    expect(landingTarget({ currentAdmin: null, error: undefined, loading: false })).toBe('/login');
+  it('has no target on an error or a missing principal, and never /login', () => {
+    expect(landingTarget({ currentAdmin: undefined, error: new Error('unauthenticated'), loading: false })).toBeUndefined();
+    expect(landingTarget({ currentAdmin: null, error: undefined, loading: false })).toBeUndefined();
     expect(
       landingTarget({ currentAdmin: { role: 'TENANT_OWNER', scope: 'TENANT' }, error: new Error('x'), loading: false }),
-    ).toBe('/login');
+    ).toBeUndefined();
   });
 
   it('otherwise lands the principal via landingHref', () => {
```

```diff
diff --git a/apps/web/i18n/messages.test.ts b/apps/web/i18n/messages.test.ts
--- a/apps/web/i18n/messages.test.ts
+++ b/apps/web/i18n/messages.test.ts
@@ -10,6 +10,7 @@ describe('getMessages', () => {
     const { nav } = getMessages();
     expect(nav.landing).toEqual({
       empty: 'No areas are available for your account.',
+      error: 'Unable to load your account.',
       loading: 'Loading…',
     });
     expect(nav.platform).toEqual({
```

```diff
diff --git a/apps/web/lib/web-shell-regressions.test.ts b/apps/web/lib/web-shell-regressions.test.ts
--- a/apps/web/lib/web-shell-regressions.test.ts
+++ b/apps/web/lib/web-shell-regressions.test.ts
@@ -53,6 +53,8 @@ describe('web shell regressions', () => {
     const landing = readWebSource('app/app/page.tsx');
 
     expect(landing).toContain('landingTarget({ currentAdmin, error, loading })');
+    // Session routing spec §4.4: the landing never routes to /login itself.
+    expect(landing).not.toContain('/login');
     expect(landing).not.toContain('/app/customers');
     expect(landing).not.toMatch(/tenantId/);
   });
```

Create `apps/web/lib/session-routing-pages.test.tsx`. Two of its three tests ("keeps loading on a settled missing principal …" and "shows the empty message …") pass before the change. They are **characterization tests** pinning landing states the change must keep.

```tsx
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
```

Allow the new render test to import `getMessages`, as the other render tests do:

```diff
diff --git a/apps/web/eslint.config.mjs b/apps/web/eslint.config.mjs
--- a/apps/web/eslint.config.mjs
+++ b/apps/web/eslint.config.mjs
@@ -14,12 +14,13 @@ export default tseslint.config(
   },
   {
     files: ['**/*.{ts,tsx}'],
-    // `lib/i18n-rendering.test.tsx`, the app i18n boundary tests and
-    // `lib/page-visibility-gate.test.tsx` are the deliberate exceptions
-    // outside `i18n/**`: they render through the real getMessages() ->
-    // NextIntlClientProvider path (i18n spec §6; single app i18n provider spec
-    // §6.2; tenant label overrides spec §6.2; role-aware typed URLs spec §8.2)
-    // and must import getMessages directly.
+    // `lib/i18n-rendering.test.tsx`, the app i18n boundary tests,
+    // `lib/page-visibility-gate.test.tsx` and `lib/session-routing-pages.test.tsx`
+    // are the deliberate exceptions outside `i18n/**`: they render through the
+    // real getMessages() -> NextIntlClientProvider path (i18n spec §6; single
+    // app i18n provider spec §6.2; tenant label overrides spec §6.2;
+    // role-aware typed URLs spec §8.2; session routing spec §8 items 3-4) and
+    // must import getMessages directly.
     ignores: [
       'i18n/**',
       'lib/i18n-rendering.test.tsx',
@@ -27,6 +28,7 @@ export default tseslint.config(
       'lib/app-i18n-tenant-overrides.test.tsx',
       'lib/app-i18n-tenant-isolation.test.tsx',
       'lib/page-visibility-gate.test.tsx',
+      'lib/session-routing-pages.test.tsx',
     ],
     rules: {
       'no-restricted-imports': [
```

- [ ] **Step 2: Run to verify RED.**

Run: `pnpm --filter web exec vitest run lib/landing-target.test.ts i18n/messages.test.ts lib/web-shell-regressions.test.ts lib/session-routing-pages.test.tsx`
Expected: 4 failed:
- `has no target on an error or a missing principal, and never /login`
- `carries the landing and platform placeholder copy in nav`
- `lands /app through landingTarget …`
- `shows the account load error on a failed currentAdmin read`

Everything else passes.

- [ ] **Step 3: Implement.** Apply:

```diff
diff --git a/apps/web/lib/landing-target.ts b/apps/web/lib/landing-target.ts
--- a/apps/web/lib/landing-target.ts
+++ b/apps/web/lib/landing-target.ts
@@ -6,12 +6,12 @@ export interface LandingState {
   loading: boolean;
 }
 
-// The /app landing decision (plan decision 5): wait while loading; an errored
-// or missing session goes to /login (middleware only checks the cookie
-// exists); otherwise the shared landingHref rule. Undefined after loading
-// means a principal with nothing visible. UX only (multi-tenant spec §5.13).
+// The /app landing decision (plan decision 5): wait while loading; no target
+// on an error or a missing principal; otherwise the shared landingHref rule.
+// An invalid session is the layout SessionGuard's to route (session routing
+// spec §4.4), so this never targets the sign-in page. UX only (multi-tenant
+// spec §5.13).
 export function landingTarget({ currentAdmin, error, loading }: LandingState): string | undefined {
-  if (loading) return undefined;
-  if (error || !currentAdmin) return '/login';
+  if (loading || error || !currentAdmin) return undefined;
   return landingHref(currentAdmin);
 }
```

```diff
diff --git a/apps/web/app/app/page.tsx b/apps/web/app/app/page.tsx
--- a/apps/web/app/app/page.tsx
+++ b/apps/web/app/app/page.tsx
@@ -11,9 +11,10 @@ import { landingTarget } from '../../lib/landing-target';
 // the shell. The decision lives in lib/landing-target.ts and uses the same
 // visibility rule as the sidebar (lib/nav-groups.ts): Super Admin to the
 // platform placeholder, tenant users to their first visible nav item. A
-// missing or invalid session (middleware only checks the cookie exists)
-// goes to /login, as on the admin page. UX only — the API remains the
-// authorization boundary (multi-tenant spec §4.2, §5.13).
+// missing or invalid session is the layout SessionGuard's to route (session
+// routing spec §4.4): a failed read shows the account load error, and a
+// settled missing principal keeps loading while the guard redirects. UX only —
+// the API remains the authorization boundary (multi-tenant spec §4.2, §5.13).
 export default function AppIndexPage() {
   const t = useTranslations('nav');
   const router = useRouter();
@@ -25,7 +26,10 @@ export default function AppIndexPage() {
     if (target) router.replace(target);
   }, [target, router]);
 
-  if (!loading && !target) {
+  if (!loading && error) {
+    return <p className="text-sm text-slate-500">{t('landing.error')}</p>;
+  }
+  if (!loading && currentAdmin && !target) {
     return <p className="text-sm text-slate-500">{t('landing.empty')}</p>;
   }
   return <p className="text-sm text-slate-500">{t('landing.loading')}</p>;
```

```diff
diff --git a/apps/web/messages/en/nav.json b/apps/web/messages/en/nav.json
--- a/apps/web/messages/en/nav.json
+++ b/apps/web/messages/en/nav.json
@@ -26,6 +26,7 @@
   },
   "landing": {
     "empty": "No areas are available for your account.",
+    "error": "Unable to load your account.",
     "loading": "Loading…"
   },
   "unavailable": {
```

- [ ] **Step 4: Verify GREEN.**

Run: `pnpm --filter web test && pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: all pass, with `tsc` and ESLint clean.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/lib/landing-target.ts apps/web/lib/landing-target.test.ts apps/web/app/app/page.tsx apps/web/messages/en/nav.json apps/web/i18n/messages.test.ts apps/web/lib/web-shell-regressions.test.ts apps/web/lib/session-routing-pages.test.tsx apps/web/eslint.config.mjs
git commit -m "feat(131): retire the /app landing's /login outcome and add nav.landing.error"
```

---

### Task 5: Retire the `/app/admin` redirect and pin the single `/login` route (spec §4.5; §5 invariant 12; §8 items 4, 5)

**Files:**
- Modify: `apps/web/app/app/admin/page.tsx`, `apps/web/lib/tenant-role-regressions.test.ts`, `apps/web/lib/web-shell-regressions.test.ts` (the `/login` scan), `apps/web/lib/session-routing-pages.test.tsx` (the admin part)

**Interfaces:**
- Consumes: the `nonTestSources` helper already in `web-shell-regressions.test.ts`. The `render` helper and `inputs` mock in `session-routing-pages.test.tsx` (Task 4).
- Produces: none.

- [ ] **Step 1: Write the failing tests.** Apply the following.

```diff
diff --git a/apps/web/lib/tenant-role-regressions.test.ts b/apps/web/lib/tenant-role-regressions.test.ts
--- a/apps/web/lib/tenant-role-regressions.test.ts
+++ b/apps/web/lib/tenant-role-regressions.test.ts
@@ -14,9 +14,10 @@ function readWebSource(relativePath: string) {
 // API enforces RBAC independently.
 describe('tenant role contract in the staff console', () => {
   // Role-aware typed URLs spec §4.5: the /app layout's PageVisibilityGate
-  // decides whether the staff page is shown; the page keeps its own session
-  // handling and its own currentAdmin read.
-  it('leaves staff page visibility to the layout gate and keeps its session handling', () => {
+  // decides whether the staff page is shown. Session routing spec §4.5: the
+  // layout's SessionGuard owns the /login redirect; the page keeps its own
+  // currentAdmin read and shows the load error when it fails.
+  it('leaves visibility to the layout gate and the session redirect to the layout guard', () => {
     const adminPage = readWebSource('app/app/admin/page.tsx');
 
     expect(adminPage).not.toContain('canManageStaff');
@@ -24,7 +25,9 @@ describe('tenant role contract in the staff console', () => {
     expect(adminPage).not.toMatch(/role === 'TENANT_OWNER'/);
     expect(adminPage).not.toMatch(/tenantId === null/);
     expect(adminPage).toContain("useCurrentAdminQuery({ fetchPolicy: 'network-only' })");
-    expect(adminPage).toContain("router.replace('/login')");
+    expect(adminPage).not.toContain('/login');
+    expect(adminPage).not.toContain('useRouter');
+    expect(adminPage).toContain("t('loadError')");
     expect(adminPage).toContain('<StaffConsole currentAdminId={currentAdmin.id} />');
   });
 
```

This is the `/login` navigation scan. It matches router calls, `redirect()` and links, not prose: `app/app/layout.tsx` has an existing comment quoting `` `/login` ``.

```diff
diff --git a/apps/web/lib/web-shell-regressions.test.ts b/apps/web/lib/web-shell-regressions.test.ts
--- a/apps/web/lib/web-shell-regressions.test.ts
+++ b/apps/web/lib/web-shell-regressions.test.ts
@@ -89,6 +93,21 @@ describe('web shell regressions', () => {
     expect(mounts).toEqual(['app/app/layout.tsx']);
   });
 
+  // Session routing spec §5 invariant 12: one session redirect and logout are
+  // the only /app routes to the sign-in page. Scoped exactly to app/app/** and
+  // components/**; app/login and middleware.ts are outside the rule. Matches
+  // navigation (router calls, redirect(), links), not prose mentions.
+  it('routes to /login only from the session guard and logout', () => {
+    const NAVIGATES_TO_LOGIN = /(?:\b(?:push|redirect|replace)\(\s*|href=\{?\s*)['"`]\/login['"`]/;
+    const routesToLogin = [resolve(webRoot, 'app/app'), resolve(webRoot, 'components')]
+      .flatMap((dir) => nonTestSources(dir))
+      .filter((path) => NAVIGATES_TO_LOGIN.test(readFileSync(path, 'utf8')))
+      .map((path) => relative(webRoot, path))
+      .sort();
+
+    expect(routesToLogin).toEqual(['components/layout/session-guard.tsx', 'components/layout/user-menu.tsx']);
+  });
+
   it('reads currentAdmin in the gate with the default cache-first policy and never redirects', () => {
     const gate = readWebSource('components/layout/page-visibility-gate.tsx');
 
```

In `apps/web/lib/session-routing-pages.test.tsx`, replace the line `import AppIndexPage from '../app/app/page';` with:

```tsx
import AdminPage from '../app/app/admin/page';
import AppIndexPage from '../app/app/page';
import { AppI18nProvider } from '../components/layout/app-i18n-provider';
```

Append at the end of the file:

```tsx
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
```

- [ ] **Step 2: Run to verify RED.**

Run: `pnpm --filter web exec vitest run lib/tenant-role-regressions.test.ts lib/session-routing-pages.test.tsx lib/web-shell-regressions.test.ts`
Expected: 4 failed:
- the two `/app/admin session states` cases (`expected '' to contain 'Unable to load staff accounts.'`)
- `leaves visibility to the layout gate and the session redirect to the layout guard`
- `routes to /login only from the session guard and logout` (it also lists `app/app/admin/page.tsx`)

- [ ] **Step 3: Implement.** Apply:

```diff
diff --git a/apps/web/app/app/admin/page.tsx b/apps/web/app/app/admin/page.tsx
--- a/apps/web/app/app/admin/page.tsx
+++ b/apps/web/app/app/admin/page.tsx
@@ -15,8 +15,7 @@ import {
   type StaffErrorKey,
   type StaffMember,
 } from '@clensy/web';
-import { useRouter } from 'next/navigation';
-import { useEffect, useState } from 'react';
+import { useState } from 'react';
 import { disableConfirmDescription, staffMutationErrorKey } from '../../../lib/staff-console';
 
 const EMPTY_FORM: CreateStaffFormValues = { email: '', password: '', role: 'CUSTOMER_SUPPORT' };
@@ -27,32 +26,31 @@ const EMPTY_FORM: CreateStaffFormValues = { email: '', password: '', role: 'CUST
 // GraphQL and routes (multi-tenant spec §4.8).
 //
 // Spec §4.1 (Admin Foundation): `middleware.ts` only checks that the session
-// cookie is present, not that it's still valid — an expired, invalid, or
-// disabled-account session lands here, where the guarded `currentAdmin`
-// surfaces it as an error (or a missing `currentAdmin`) and we send the user
-// back to `/login`. Whether this page is shown at all is the /app layout's
+// cookie is present, not that it's still valid. An expired, invalid, or
+// disabled-account session is routed to sign-in by the /app layout's
+// SessionGuard (session routing spec §4.5), not by this page: a failed or
+// missing `currentAdmin` here shows the staff load error. Whether this page
+// is shown at all is the /app layout's
 // PageVisibilityGate (role-aware typed URLs spec §4.2, §4.5), a UX rule only
 // — the API independently enforces Tenant-Owner-only, same-tenant access on
 // `admins`/`createAdmin`/`disableAdmin` (multi-tenant spec §4.2).
 export default function AdminPage() {
   const t = useClensyTranslations('staff');
-  const router = useRouter();
   const { data, loading, error } = useCurrentAdminQuery({ fetchPolicy: 'network-only' });
   const currentAdmin = data?.currentAdmin;
 
-  useEffect(() => {
-    if (!loading && (error || !currentAdmin)) {
-      router.replace('/login');
-    }
-  }, [loading, error, currentAdmin, router]);
-
   if (loading) {
     return <p className="text-sm text-slate-500">{t('page.loading')}</p>;
   }
 
   if (error || !currentAdmin) {
-    // Redirect already dispatched in the effect above.
-    return null;
+    // If the session is invalid, the layout's SessionGuard is already
+    // redirecting; otherwise this is a plain load failure.
+    return (
+      <p role="alert" className="text-sm text-red-600">
+        {t('loadError')}
+      </p>
+    );
   }
 
   return <StaffConsole currentAdminId={currentAdmin.id} />;
```

- [ ] **Step 4: Verify GREEN.**

Run: `pnpm --filter web test && pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: 521 passed, with `tsc` and ESLint clean.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/app/app/admin/page.tsx apps/web/lib/tenant-role-regressions.test.ts apps/web/lib/web-shell-regressions.test.ts apps/web/lib/session-routing-pages.test.tsx
git commit -m "feat(131): retire the /app/admin page-local /login redirect"
```

---

## Final verification (before the M6 handoff report)

Run each and record the result:

1. `pnpm run lint`: all workspaces succeed.
2. `pnpm --filter web exec tsc --noEmit` and `pnpm --filter api exec tsc --noEmit`: clean.
3. `pnpm run test`: all workspaces succeed, including `@clensy/client` (10) and `web` (521).
4. `git diff --stat 61b6fb8 -- apps/api apps/web/middleware.ts apps/web/components/layout/page-visibility-gate.tsx apps/web/components/layout/user-menu.tsx apps/web/app/login packages/ui packages/web`: empty.

## Traceability

| Spec | Task |
| --- | --- |
| §3 evidence (1), §4.1, invariant 5 | 1 |
| §3 evidence (2), §4.3, invariants 3, 4, 10 | 2 |
| §4.2, invariants 6–9, 11 | 3 |
| §4.4, §4.6 | 4 |
| §4.5, invariant 12 | 5 |
| §4.7 worked examples | 1–5 collectively (signal, latch, guard wiring, landing, admin) |
| Invariants 1, 13; §2 Out of scope | Final verification step 4 (no changes to API, middleware, gate, logout or login) |
| §8 items 1–7 | 1 (item 1), 2–3 (item 2), 4 (items 3, 6), 5 (items 4–5), Final verification (item 7) |

## Deferred (not in this plan)

As in the spec §11:
- returning to the original page after sign-in;
- "session expired" messaging on `/login`;
- idle detection;
- token refresh and session lifetime;
- non-`en` locales for `nav.landing.error`.

## Execution risks (operational only)

- **Merge overlap with #134.** `feat/134-unavailable-link-trailing-slash` edits `apps/web/lib/nav-groups.test.ts` and `page-visibility-gate.tsx`/its test, and amends the same #114 spec header rows. If #134 merges first, rebase this branch. Expect conflicts only in the #114 spec's Status, Date and M3-decision table rows. The `web-shell-regressions.test.ts` gate-mount regex may also conflict if #134 touches it, and must keep the `<SessionGuard />` sibling.
- **Lockfile.** Task 1 changes `pnpm-lock.yaml`. CI runs `pnpm install --frozen-lockfile`, so the lockfile change must be committed with Task 1.

## Gate outcomes

### M6 — Implementation complete (2026-10-07)

Executed natively (superpowers:executing-plans), task by task, in plan order, on `feat/131-session-routing`. Each task's steps were applied from this plan's own code blocks and diffs.

| Task | Commit | RED observed | GREEN |
| --- | --- | --- | --- |
| 1. Session signal | `9b21216` | `Cannot find module './session-signal'`; then 9/1, with only the wiring test failing | `@clensy/client` 10/10; `build`, `lint` clean |
| 2. Latch and session check | `22cc1f0` | `Cannot find module './session-redirect'` | 12/12 |
| 3. Guard and mount | `90a4345` | Guard module missing; 5 of 6 regressions failing; the characterization test passing | Targeted 187/187; `apps/web` 515/515; `tsc`, lint clean |
| 4. Landing | `bf63efa` | Exactly the four Step 2 failures | `apps/web` 518/518; `tsc`, lint clean |
| 5. Admin and `/login` scan | `60fd374` | Exactly the four Step 2 failures | `apps/web` 521/521; `tsc`, lint clean |

- **Characterization tests** (M6 step 3.6). Each one failed against a mutation made outside the commit, and the code was then restored:
  - `keeps the gate free of session handling` failed with `// onSessionInvalid` appended to `page-visibility-gate.tsx`.
  - `keeps loading on a settled missing principal …` failed with the landing's `currentAdmin &&` guard removed.
  - `shows the empty message …` failed with `landing.empty` swapped for `landing.loading`.
- **Deviations from the plan:** none. No rulings were needed.
- **Final verification** (plan steps 1–4), all as expected:
  - `pnpm run lint` 6/6;
  - web and API `tsc --noEmit` clean;
  - `pnpm run test` 10/10 tasks, with `@clensy/client` 10/10 and `web` 521/521;
  - the protected-area diff against `61b6fb8` is empty;
  - `pnpm --filter web build` exits 0.

**Integration with `main`** (after M6). #134 (PR #144) merged into `main` after this branch was cut, as the plan's execution risks anticipated. `origin/main` was merged in.
- **Conflicts.** The only conflicts were in the #114 spec's Status, Date and M3-decision rows and its acceptance criteria. They were resolved as a union: #134's §4.3 amendment keeps criterion 9, and the #131 cross-reference amendment follows it as criterion 10.
- **No code conflicts.** #134 changed the gate's link rendering, not its session contract, and the guard is untouched.
- **Merged tree:**
  - `pnpm install --frozen-lockfile` passes;
  - lint 6/6;
  - web and API `tsc` clean;
  - `pnpm run test` 10/10, with `web` 536/536 (521 plus #134's 15) and `@clensy/client` 10/10;
  - `next build` exits 0;
  - the protected-area diff against `origin/main` is empty.

### M7 — Approved for merge (2026-10-07)

- **Subject:** PR [#145](https://github.com/rexescario-dev/clensy-platform/pull/145), head `7fac4f9`. It carries the spec, this Accepted plan, the M6 change set and the `main` integration merge (process spec §2.8).
- **Accepted specification:** `docs/superpowers/specs/2026-10-07-session-routing-design.md`, plus the #114 spec's cross-reference amendment (criterion 10).
- **Accepted implementation plan:** this document.
- **M6 gate:** plan Accept `94cb9d7` is an ancestor of the first implementation commit `9b21216`.
- **Plan tasks reviewed:** Tasks 1–5 (`9b21216`, `22cc1f0`, `90a4345`, `bf63efa`, `60fd374`) ✓. No reordering, no skipped task, and no extras beyond the recorded `main` merge.
- **Review basis:** an **independent review** by a fresh Opus agent context that did not implement the change, as CLAUDE.md requires for application-code slices. This record was written by the implementer and is based on that review.
  - The reviewer re-ran `@clensy/client` test (10/10), `web` test (536/536), web `tsc`, both lints, client `build` and `next build`, all exit 0.
  - It confirmed by script that the three implementation files are byte-identical to the plan's code blocks.
  - It found the protected-area diff empty.
  - It checked all five Review Focus items against the Apollo 3.14.1 and Next 16.3.1 sources.
- **Verification evidence:** CI run [37647157494](https://github.com/rexescario-dev/clensy-platform/actions/runs/37647157494) on `7fac4f9`: Lint, Test, Release gate and API e2e all passed. Local runs and the M6 RED/GREEN and mutation evidence are recorded above.
- **Blocking findings:** none (0 Critical, 0 Important).
- **Non-blocking observations** (deferred Minors; these MUST NOT affect the merge decision):
  1. `session-guard.tsx`'s `[client, router]` effect dependencies would reset the latch within one mounted lifetime if either identity changed. This is unreachable today, because both are module singletons.
  2. The `/login` navigation scan matches literal `'/login'` navigation only. A path constant or `window.location` would evade it. This is the plan's chosen trade-off: match navigation, not prose.
  3. The landing's `nav.landing.error` renders without `role="alert"`, unlike the admin page's error. The spec doesn't specify it, and the landing keeps its existing plain-text style.
- **Gate:** merge per human/project norms.

### M8 — N/A (2026-10-07)

- The slice adds three small single-purpose modules (`session-signal.ts`, `session-redirect.ts`, `session-guard.tsx`). It removes code from the landing and admin pages. M7 found no duplication or complexity to refactor.
- None of the deferred Minors is a behavior-preserving refactor:
  - (1) changes effect semantics;
  - (2) changes a test's matching rule;
  - (3) changes markup.

  They belong to a follow-up, not to M8.

### M9 — Complete (2026-10-07)

**Documentation scope:** `apps/web/README.md` (the shell paragraph), the spec's Tracking cell, and this section.

**Content updates:**
- `apps/web/README.md`, shell paragraph. "…and an invalid session to `/login`" (the landing) was no longer true after Task 4. It is replaced by a description of the one `SessionGuard` in `app/app/layout.tsx`: it sends an invalid session to `/login` from any `/app` page, on positive evidence only, so an outage shows the page's own error and the landing shows "Unable to load your account.". Caused by Tasks 3–4 and spec §4.2–§4.4.
- The spec's Tracking cell links PR #145. Caused by the PR being opened.
- This section. Caused by the M7–M9 gate outcomes.

**Editorial changes:** none.

**Unchanged, with reason:**
- **The `apps/web/middleware.ts` header comment.** It still says that other `/app/*` routes have no downstream redirect for an invalid session "yet", which is now stale. It was **not** edited: the Accepted plan locks `middleware.ts` byte-identical, and M9 MUST NOT change implementation files. It is raised with the owner as a follow-up (a comment-only change).
- **The README's `nav` catalog list.** It already lists `landing`.
- **Earlier slice plans and specs that describe the page-local redirects** (#88, #89, #114). They are historical records. The #114 spec carries its Accepted cross-reference amendment.

**Verification:**
- The relative links in the README, this spec, this plan and the #114 spec all resolve (scripted scan: 0 broken).
- Status is consistent: spec and plan Accepted, M7 Approved, PR open with CI green.
- Terminology follows spec §3 (session evidence, session check, session redirect).
- No heading changes, contradictions or stale references in scope.

### M10 — Accepted, workflow validated (2026-10-07)

**Subject:** the installed workflow prompt library (`docs/workflows/`, generic 1.4.1 / claude 0.2.0), against `docs/workflows/specs/agent-workflow-design.md` §2.10. This slice ran it on #131 from M2 to M9.

**Asset inventory:** unchanged. Nine prompts map to M2–M10; `conventions/` holds M1 and the reporting conventions. There are no orphan assets.

**Checks:**
- §2.4 was honoured: spec Accept `a0f0e46` (recorded at `0e81e98`) precedes the M4 draft `52d26b6`.
- §2.5 was honoured: plan Accept `94cb9d7` is an ancestor of the first implementation commit `9b21216`.
- Both review gates recorded explicit Returns before Accept:
  - M3 returned nine clarifications on its first pass.
  - M5 returned two required changes on its first pass.
- Providers were honoured: GitHub for the issue, branch and PR (`workflow.providers`).
- CLAUDE.md's M7 rule was honoured: a fresh, independent reviewer on the most capable model for an application-code slice.
- Slice Completion Reports were emitted at M6 and at M7–M9.
- §2.8 was honoured: one PR (#145) carries the spec, plan, implementation and docs.

**Blocking findings:** none.

**Non-blocking observations:**
1. **A slice-local spec amendment can race another slice's amendment of the same spec.** #131's cross-reference amendment and #134's §4.3 amendment both edited the #114 spec's Status, Date and M3-decision rows and appended acceptance criterion "9". The conflict was predicted in the plan's execution risks and resolved mechanically at the `main` merge, with #131's criterion renumbered to 10. Numbering amendment criteria by issue (e.g. "#131-1") would remove that renumbering.
2. **M9 cannot fix stale comments in plan-locked files.** The `middleware.ts` comment is documentation in a file the plan locks byte-identical. The prompts give no route other than a follow-up.
