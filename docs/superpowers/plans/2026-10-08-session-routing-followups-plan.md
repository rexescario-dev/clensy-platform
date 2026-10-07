# Session Routing Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Draft |
| M5 decision | Pending. |
| Date | 2026-10-08 |
| Tracking issue | [#146](https://github.com/rexescario-dev/clensy-platform/issues/146) (follow-ups to #131's M7 minors) |
| Scope | `apps/web` only: `components/layout/session-guard.tsx`, `app/app/page.tsx`, and three test files. No `packages/*`, `apps/api`, `middleware.ts`, `PageVisibilityGate`, `user-menu.tsx`, `app/login`, copy, or lockfile changes. |
| Implements (Accepted) | The **#146 amendment** to [Consistent `/login` Routing for Missing or Invalid Sessions Across `/app` — Design](../specs/2026-10-07-session-routing-design.md): §4.3 item 1, §4.4, §8 items 2, 3 and 5, criterion 8. Status **Accepted** (M3, 2026-10-08, `95157b8`). The rest of that spec stays Accepted and unchanged. |
| Relies on (Accepted) | [Session routing plan](2026-10-07-session-routing-plan.md) (#131), whose code this changes; [Role-Aware Typed URLs](../specs/2026-10-04-role-aware-typed-urls-design.md) (#114), whose gate is untouched |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. The ref name `latest`, the helper name `loginLiteralsIn`, the constant `LOGIN_ROUTE`, test names and task order are planning decisions, not product semantics. |
| Edit anchors | Every edit is a unified diff against the branch base `4f84a4e`, which matches `main` at `0a8d87a` plus the amendment commits. The amendment commits touch no code. |
| Pre-validation | **Full.** See below. |

**Goal:** Deliver the #146 amendment, in three tasks:
1. The guard creates exactly one redirector per mount, no matter how the client or router identity changes.
2. The landing's account load error is announced as an alert, in the admin error's style.
3. The invariant 12 `/login` scan becomes literal-based and comment-blind.

**Architecture:**

- **Guard (Task 1).** A `latest` ref holds `{ client, router }`. An effect keyed on `[client, router]` keeps it in sync. The redirector effect now has `[]` dependencies, and its `clearStore` and `navigateToLogin` call `latest.current.client` and `latest.current.router`. The check effect (`[client, pathname]`) and `runSessionCheck` binding are unchanged. Effect order: sync, redirector, check, all in declaration order, so the latch exists before the mount check.
- **Landing (Task 2).** Only the error branch of `app/app/page.tsx` changes, to `<p role="alert" className="text-sm text-red-600">`. The loading and empty branches are untouched.
- **Scan (Task 3).** A test-local `loginLiteralsIn(fileName, text)` walks the TypeScript AST through the file's existing `parseSource` helper. It collects string and no-substitution template literals whose text matches `/^\/login(?:$|[?/])/`, plus the head text of template expressions. The invariant 12 test filters on it. An `it.each` pins what it catches and what it ignores.

**Tech Stack:** Next.js 16, React 19, Apollo Client 3.14, TypeScript 5's compiler API (already imported by `web-shell-regressions.test.ts`), and Vitest 5 in `node` with `renderToStaticMarkup`. There's no DOM environment, so effect wiring is pinned at source level.

**Spec:** [`docs/superpowers/specs/2026-10-07-session-routing-design.md`](../specs/2026-10-07-session-routing-design.md), the *(#146)*-marked passages.

**Pre-validation (full).** On 2026-10-08, every diff in Tasks 1–3 was applied to a working tree at `4f84a4e`, and every command named by an `Expected:` line ran with the stated result, including each RED state.
- **Mutation checks:**
  - adding `role="alert"` to the loading branch fails `renders no alert for loading` and `… a settled missing principal`;
  - adding it to the empty branch fails `… a principal with no destination`;
  - appending `const LOGIN_PATH = '/login';` to `app/app/page.tsx` fails the invariant 12 scan. The previous regex didn't catch that.
- **Final verification:**
  - `pnpm run lint` 6/6;
  - web and API `tsc` clean;
  - `pnpm run test` 10/10, with `web` 549/549 (baseline 536) and `@clensy/client` 10/10;
  - `pnpm --filter web build` exit 0;
  - the protected-area diff is empty.

After the plan was written, the tree was reset and Tasks 1–3 were replayed from this document's diffs. Every `Expected:` line matched. The tree was then reverted, and only this plan is committed.

## Global Constraints

- One redirector per mounted guard. Its creating effect has no dependencies and is never re-run by a `client` or `router` identity change. Its effects call the **current** client and router (spec §4.3 item 1).
- The session check effect stays `[client, pathname]`, bound to the captured redirector through `runSessionCheck` (unchanged #131 behavior).
- Landing error markup: exactly `<p role="alert" className="text-sm text-red-600">{t('landing.error')}</p>`. The loading and empty states are unchanged, with no `role="alert"`. No `@clensy/ui` change, and `ErrorState` is not used (spec §4.4).
- The `/login` scan counts string and template literals whose value is `/login` or starts with `/login?` or `/login/`. Comments and JSX text never count. The allowed set stays exactly `components/layout/session-guard.tsx` and `components/layout/user-menu.tsx` (spec §8 item 5, invariant 12).
- No change to session evidence, the signal, the latch, `runSessionCheck`, copy, or any protected area.

## Review Focus

1. **A real identity change while mounted.** Nothing in the app changes `client` or `router` today, so the fix is pinned at source level only. M7 should confirm that the redirector effect really has `[]` dependencies, and that the sync effect is declared before it.
2. **Strict-mode double mount** still disposes the first redirector and creates a second. The `[]` effect re-runs on remount, as #131 already relied on.
3. **The scan's blind spots.** A `/login` route assembled from pieces (`'/log' + 'in'`) or read from config is not caught. This is acceptable: the spec targets literals.
4. **The alert's announcement** in a real screen reader. Static markup pins only the role.

## File Map

| File | Task | Change |
| --- | --- | --- |
| `apps/web/components/layout/session-guard.tsx` | 1 | `latest` ref, sync effect, `[]` redirector effect |
| `apps/web/lib/session-routing-regressions.test.ts` | 1 | One-redirector-per-mount regression; old client/router literal assertions moved into it |
| `apps/web/app/app/page.tsx` | 2 | Error branch markup |
| `apps/web/lib/session-routing-pages.test.tsx` | 2 | Alert and no-alert render tests |
| `apps/web/lib/web-shell-regressions.test.ts` | 3 | `loginLiteralsIn`, `LOGIN_ROUTE`, the invariant 12 scan rewired, detector `it.each` |

Commit messages carry no `Co-Authored-By: Claude` trailer (owner's global instruction).

---

### Task 1: One redirector per guard mount (spec §4.3 item 1, invariant 3; §8 item 2)

**Files:** Modify `apps/web/lib/session-routing-regressions.test.ts`, `apps/web/components/layout/session-guard.tsx`.

**Interfaces:** No exported surface changes. `SessionGuard(): null` as before.

- [ ] **Step 1: Write the failing regression.** It replaces the two direct `client.clearStore()` / `router.replace('/login')` assertions with the ref-based ones. Apply:

```diff
diff --git a/apps/web/lib/session-routing-regressions.test.ts b/apps/web/lib/session-routing-regressions.test.ts
--- a/apps/web/lib/session-routing-regressions.test.ts
+++ b/apps/web/lib/session-routing-regressions.test.ts
@@ -40,8 +40,20 @@ describe('session routing regressions', () => {
 
     expect(guard).toContain('onSessionInvalid(');
     expect(guard).toContain('createSessionRedirector(');
-    expect(guard).toContain("navigateToLogin: () => router.replace('/login')");
-    expect(guard).toContain('clearStore: () => client.clearStore()');
+  });
+
+  // Spec §4.3 item 1 (#146): one redirector per mounted guard. It is created
+  // by an effect with no dependencies, so a client or router identity change
+  // cannot replace the latch, and its effects reach the current client and
+  // router through a ref kept in sync by its own effect.
+  it('creates one redirector per mount that calls the current client and router', () => {
+    const guard = readWebSource('components/layout/session-guard.tsx');
+    const redirectorEffect = /useEffect\(\(\) => \{\s*const current = createSessionRedirector\([\s\S]*?\n {2}\}, (\[[^\]]*\])\);/.exec(guard);
+
+    expect(redirectorEffect?.[1]).toBe('[]');
+    expect(redirectorEffect?.[0]).toContain('clearStore: () => latest.current.client.clearStore()');
+    expect(redirectorEffect?.[0]).toContain("navigateToLogin: () => latest.current.router.replace('/login')");
+    expect(guard).toMatch(/useEffect\(\(\) => \{\s*latest\.current = \{ client, router \};\s*\}, \[client, router\]\);/);
   });
 
   // Spec §4.2 / §4.3 item 4: a check acts only through the redirector captured
```

- [ ] **Step 2: Run to verify RED.**

Run: `pnpm --filter web exec vitest run lib/session-routing-regressions.test.ts`
Expected: 1 failed (`creates one redirector per mount that calls the current client and router`), 6 passed.

- [ ] **Step 3: Implement.** Apply:

```diff
diff --git a/apps/web/components/layout/session-guard.tsx b/apps/web/components/layout/session-guard.tsx
--- a/apps/web/components/layout/session-guard.tsx
+++ b/apps/web/components/layout/session-guard.tsx
@@ -20,13 +20,22 @@ export function SessionGuard() {
   const client = useApolloClient();
   const router = useRouter();
   const pathname = usePathname();
+  const latest = useRef({ client, router });
   const redirector = useRef<SessionRedirector | null>(null);
 
-  // Declared first so the latch exists before the mount check below starts.
+  // Keeps the redirect calling the current client and router (spec §4.3
+  // item 1) without re-creating the latch when their identity changes.
+  useEffect(() => {
+    latest.current = { client, router };
+  }, [client, router]);
+
+  // One redirector per mount: never replaced while the guard stays mounted
+  // (spec §4.3 item 1, invariant 3). Declared before the check below so the
+  // latch exists before the mount check starts.
   useEffect(() => {
     const current = createSessionRedirector({
-      clearStore: () => client.clearStore(),
-      navigateToLogin: () => router.replace('/login'),
+      clearStore: () => latest.current.client.clearStore(),
+      navigateToLogin: () => latest.current.router.replace('/login'),
     });
     redirector.current = current;
     const unsubscribe = onSessionInvalid(() => void current.report());
@@ -34,7 +43,7 @@ export function SessionGuard() {
       unsubscribe();
       current.dispose();
     };
-  }, [client, router]);
+  }, []);
 
   // Each check is bound to the redirector current when it starts, never read
   // from the ref when it settles (spec §4.2, §4.3 item 4).
```

- [ ] **Step 4: Verify GREEN.**

Run: `pnpm --filter web exec vitest run lib/session-routing-regressions.test.ts lib/session-guard.test.tsx lib/web-shell-regressions.test.ts && pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: all pass, with `tsc` and ESLint clean.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/components/layout/session-guard.tsx apps/web/lib/session-routing-regressions.test.ts
git commit -m "fix(146): create one SessionGuard redirector per mount"
```

---

### Task 2: Announce the landing's account load error (spec §4.4; §8 item 3)

**Files:** Modify `apps/web/lib/session-routing-pages.test.tsx`, `apps/web/app/app/page.tsx`.

**Interfaces:** none.

- [ ] **Step 1: Write the tests.** The three `renders no alert for …` cases pass before the change. They are **characterization tests**, pinning that the loading and empty states stay non-alerts. Apply:

```diff
diff --git a/apps/web/lib/session-routing-pages.test.tsx b/apps/web/lib/session-routing-pages.test.tsx
--- a/apps/web/lib/session-routing-pages.test.tsx
+++ b/apps/web/lib/session-routing-pages.test.tsx
@@ -42,6 +42,22 @@ describe('/app landing states', () => {
     expect(html).toContain('Unable to load your account.');
   });
 
+  // Spec §4.4 (#146): the error is announced and styled like the admin
+  // page's staff.loadError; the loading and empty states are not alerts.
+  it('announces the account load error as an alert in the admin error style', () => {
+    const html = render(<AppIndexPage />, { error: new Error('Failed to fetch'), loading: false });
+
+    expect(html).toBe('<p role="alert" class="text-sm text-red-600">Unable to load your account.</p>');
+  });
+
+  it.each([
+    ['loading', { loading: true }],
+    ['a settled missing principal', { data: { currentAdmin: null }, loading: false }],
+    ['a principal with no destination', { data: { currentAdmin: { id: 'admin-1', role: 'SUPER_ADMIN', scope: 'TENANT' } }, loading: false }],
+  ] as const)('renders no alert for %s', (_name, query) => {
+    expect(render(<AppIndexPage />, query)).not.toContain('role="alert"');
+  });
+
   it('keeps loading on a settled missing principal while the guard redirects', () => {
     const html = render(<AppIndexPage />, { data: { currentAdmin: null }, loading: false });
 
```

- [ ] **Step 2: Run to verify RED.**

Run: `pnpm --filter web exec vitest run lib/session-routing-pages.test.tsx`
Expected: 1 failed (`announces the account load error as an alert in the admin error style`; received `<p class="text-sm text-slate-500">…`), 8 passed.

- [ ] **Step 3: Implement.** Apply:

```diff
diff --git a/apps/web/app/app/page.tsx b/apps/web/app/app/page.tsx
--- a/apps/web/app/app/page.tsx
+++ b/apps/web/app/app/page.tsx
@@ -27,7 +27,12 @@ export default function AppIndexPage() {
   }, [target, router]);
 
   if (!loading && error) {
-    return <p className="text-sm text-slate-500">{t('landing.error')}</p>;
+    // Announced, in the admin page's staff.loadError style (spec §4.4, #146).
+    return (
+      <p role="alert" className="text-sm text-red-600">
+        {t('landing.error')}
+      </p>
+    );
   }
   if (!loading && currentAdmin && !target) {
     return <p className="text-sm text-slate-500">{t('landing.empty')}</p>;
```

- [ ] **Step 4: Verify GREEN.**

Run: `pnpm --filter web exec vitest run lib/session-routing-pages.test.tsx`
Expected: 9 passed.

- [ ] **Step 5: Characterization evidence** (not committed). Run each of the following, then restore `app/app/page.tsx` byte for byte:
  1. Add `role="alert"` to the `landing.loading` `<p>`. Expected: `renders no alert for loading` and `renders no alert for a settled missing principal` fail.
  2. Add it to the `landing.empty` `<p>`. Expected: `renders no alert for a principal with no destination` fails.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/app/app/page.tsx apps/web/lib/session-routing-pages.test.tsx
git commit -m "fix(146): announce the landing's account load error as an alert"
```

---

### Task 3: Literal-based `/login` scan (spec §8 item 5, invariant 12)

**Files:** Modify `apps/web/lib/web-shell-regressions.test.ts`.

**Interfaces:** Consumes the file's existing `parseSource(fileName, text)` and `nonTestSources(dir)`. Produces the test-local `loginLiteralsIn(fileName: string, text: string): string[]`.

- [ ] **Step 1: Write the failing tests.** Rewire the invariant 12 scan to `loginLiteralsIn`, and add the detector `it.each`. Apply:

```diff
diff --git a/apps/web/lib/web-shell-regressions.test.ts b/apps/web/lib/web-shell-regressions.test.ts
--- a/apps/web/lib/web-shell-regressions.test.ts
+++ b/apps/web/lib/web-shell-regressions.test.ts
@@ -95,19 +95,33 @@ describe('web shell regressions', () => {
 
   // Session routing spec §5 invariant 12: one session redirect and logout are
   // the only /app routes to the sign-in page. Scoped exactly to app/app/** and
-  // components/**; app/login and middleware.ts are outside the rule. Matches
-  // navigation (router calls, redirect(), links), not prose mentions.
+  // components/**; app/login and middleware.ts are outside the rule. Literal
+  // based, not call based (spec §8 item 5, #146): any string or template
+  // literal with a /login value counts, so constants and window.location are
+  // caught; comments never are.
   it('routes to /login only from the session guard and logout', () => {
-    const NAVIGATES_TO_LOGIN = /(?:\b(?:push|redirect|replace)\(\s*|href=\{?\s*)['"`]\/login['"`]/;
     const routesToLogin = [resolve(webRoot, 'app/app'), resolve(webRoot, 'components')]
       .flatMap((dir) => nonTestSources(dir))
-      .filter((path) => NAVIGATES_TO_LOGIN.test(readFileSync(path, 'utf8')))
+      .filter((path) => loginLiteralsIn(path, readFileSync(path, 'utf8')).length > 0)
       .map((path) => relative(webRoot, path))
       .sort();
 
     expect(routesToLogin).toEqual(['components/layout/session-guard.tsx', 'components/layout/user-menu.tsx']);
   });
 
+  it.each([
+    ['a navigation call', "router.replace('/login');", true],
+    ['a path constant', "const LOGIN_PATH = '/login';", true],
+    ['window.location', "window.location.assign('/login');", true],
+    ['a template with a query string', 'router.push(`/login?next=${encodeURIComponent(path)}`);', true],
+    ['a nested path', "const href = '/login/reset';", true],
+    ['a JSX href', 'const link = <a href="/login">Sign in</a>;', true],
+    ['a comment only', '// sends the user to `/login`\nconst x = 1;', false],
+    ['a different route', "const help = '/login-help';", false],
+  ] as const)('detects a /login literal in %s: %s', (_name, source, expected) => {
+    expect(loginLiteralsIn('probe.tsx', source).length > 0).toBe(expected);
+  });
+
   it('reads currentAdmin in the gate with the default cache-first policy and never redirects', () => {
     const gate = readWebSource('components/layout/page-visibility-gate.tsx');
 
```

- [ ] **Step 2: Run to verify RED.**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: 9 failed, with `ReferenceError: loginLiteralsIn is not defined` (the scan plus 8 detector cases).

- [ ] **Step 3: Implement the detector** below `parseSource`. Apply:

```diff
diff --git a/apps/web/lib/web-shell-regressions.test.ts b/apps/web/lib/web-shell-regressions.test.ts
--- a/apps/web/lib/web-shell-regressions.test.ts
+++ b/apps/web/lib/web-shell-regressions.test.ts
@@ -209,6 +223,25 @@ function parseSource(fileName: string, text: string) {
   return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, scriptKindFor(fileName));
 }
 
+const LOGIN_ROUTE = /^\/login(?:$|[?/])/;
+
+// Every string or template literal whose value is a /login route (session
+// routing spec §8 item 5, #146). Parsed with the TypeScript AST, so comments
+// and JSX text never count; a template counts by its leading text.
+function loginLiteralsIn(fileName: string, text: string) {
+  const found: string[] = [];
+  const visit = (node: ts.Node) => {
+    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && LOGIN_ROUTE.test(node.text)) {
+      found.push(node.text);
+    } else if (ts.isTemplateExpression(node) && LOGIN_ROUTE.test(node.head.text)) {
+      found.push(node.head.text);
+    }
+    ts.forEachChild(node, visit);
+  };
+  visit(parseSource(fileName, text));
+  return found;
+}
+
 function clensyProviderBindings(source: ts.SourceFile) {
   const named = new Set<string>();
   const namespaces = new Set<string>();
```

- [ ] **Step 4: Verify GREEN, and mutation-check.**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts && pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: all pass, with `tsc` and ESLint clean.

Then append `const LOGIN_PATH = '/login';` to `apps/web/app/app/page.tsx` and run `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts -t "routes to"`. Expected: 1 failed. Remove the line (not committed).

- [ ] **Step 5: Commit.**

```bash
git add apps/web/lib/web-shell-regressions.test.ts
git commit -m "test(146): make the /login navigation scan literal-based and comment-blind"
```

---

## Final verification (before the M6 handoff report)

1. `pnpm run lint`: 6/6 succeed.
2. `pnpm --filter web exec tsc --noEmit` and `pnpm --filter api exec tsc --noEmit`: clean.
3. `pnpm run test`: 10/10, with `web` 549/549 and `@clensy/client` 10/10.
4. `pnpm --filter web build`: exit 0.
5. `git diff --stat 4f84a4e -- apps/api packages apps/web/middleware.ts apps/web/components/layout/page-visibility-gate.tsx apps/web/components/layout/user-menu.tsx apps/web/app/login apps/web/messages pnpm-lock.yaml`: empty.

## Traceability

| Spec (#146 amendment) | Task |
| --- | --- |
| §4.3 item 1 (one latch per mount, current client/router), invariant 3 | 1 |
| §8 item 2 (one-latch-per-mount regression) | 1 |
| §4.4 (landing error `role="alert"`, admin style; loading and empty unchanged) | 2 |
| §8 item 3 (alert / no-alert tests) | 2 |
| §8 item 5 (literal-based, comment-blind scan), invariant 12 | 3 |
| Criterion 8 (no session-semantics, copy, `@clensy/ui` or #114 change) | Final verification step 5 |

## Deferred (not in this plan)

None from #146. The #131 spec §11 deferrals stand.

## Execution risks (operational only)

- **Changes to `main`.** If `main` moves under `session-guard.tsx`, `app/app/page.tsx` or the three test files before merge, re-apply the diffs by quoted anchor and re-run every `Expected:` line.

## Gate outcomes

*(Appended after M5.)*
