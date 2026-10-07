# Session Routing Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Accepted |
| M5 decision | **Accepted** — 2026-10-08, at `3ab7dd6`, by the owner, on the second pass, with no further changes. To be executed natively. M7 MUST use a fresh, independent reviewer (application-code slice), and MUST specifically verify five things: (1) the mount-scoped redirector and the current `client` and `router` ref behavior; (2) that #131's session-check binding semantics are preserved; (3) the exact landing error markup, with the loading and empty branches unchanged; (4) the literal-based, comment-blind `/login` detection and its declared template-head semantics; and (5) the exact five-file scope, with no protected-area changes. |
| M5 history | First pass (2026-10-08, at `3d5fb65`): the owner found the scope and approach sound and returned the plan with these changes, all applied with no design change. (1) Task 1's regression is renamed to what it proves: a structural source regression, `… (source)`. (2) The regression now locates the `useEffect` calls through the TypeScript AST, with bodies and dependencies compacted, instead of a formatting-dependent multiline regex. It still fails against the #131 guard and against `[client, router]` dependencies, and still passes on a reformatted guard. (3) The sync effect's purpose is stated: it only updates the ref and never triggers the redirector effect. (4) Task 3's contract states that templates are judged by their head text only. A `${base}/login` detector case now pins that blind spot as intentional, so there are 9 cases. (5) Final verification gains an exact five-file `git diff --name-only` scope check. (6) The wording separates pre-validation evidence from execution criteria, and the Task 2 test comment claims the admin error's visual classes rather than "style". |
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

- **Guard (Task 1).** A `latest` ref holds `{ client, router }`. An effect keyed on `[client, router]` keeps it in sync. That effect's only purpose is to update the ref before future redirector callbacks run. It never triggers the redirector effect, which has no dependencies. The redirector effect now has `[]` dependencies, and its `clearStore` and `navigateToLogin` call `latest.current.client` and `latest.current.router`. The check effect (`[client, pathname]`) and `runSessionCheck` binding are unchanged. Effect order: sync, redirector, check, all in declaration order, so the latch exists before the mount check. On a later identity change, only the sync and check effects re-run. The check stays bound to the existing redirector through `runSessionCheck`.
- **Landing (Task 2).** Only the error branch of `app/app/page.tsx` changes, to `<p role="alert" className="text-sm text-red-600">`. The loading and empty branches are untouched.
- **Scan (Task 3).** A test-local `loginLiteralsIn(fileName, text)` walks the TypeScript AST through the file's existing `parseSource` helper. It collects string and no-substitution template literals whose text matches `/^\/login(?:$|[?/])/`. For a template with substitutions it examines **only the head text**, so `` `/login?next=${x}` `` is caught but `` `${base}/login` `` deliberately is not. The invariant 12 test filters on it. An `it.each` pins what it catches and what it ignores.

**Tech Stack:** Next.js 16, React 19, Apollo Client 3.14, TypeScript 5's compiler API (already imported by `web-shell-regressions.test.ts`), and Vitest 5 in `node` with `renderToStaticMarkup`. There's no DOM environment, so effect wiring is pinned at source level.

**Spec:** [`docs/superpowers/specs/2026-10-07-session-routing-design.md`](../specs/2026-10-07-session-routing-design.md), the *(#146)*-marked passages.

**Pre-validation evidence (full).** This is evidence the author gathered before M5. It is not a record of the M6 execution, which must re-run every `Expected:` command itself. On 2026-10-08, the author applied every diff in Tasks 1–3 to a working tree at `4f84a4e` and independently ran every command named by an `Expected:` line. Each result, including each RED state, is quoted below as observed. The plan was re-validated the same way after the M5 first-pass revisions.
- **Mutation checks:**
  - adding `role="alert"` to the loading branch fails `renders no alert for loading` and `… a settled missing principal`;
  - adding it to the empty branch fails `… a principal with no destination`;
  - appending `const LOGIN_PATH = '/login';` to `app/app/page.tsx` fails the invariant 12 scan. The previous regex didn't catch that.
  - restoring the #131 guard, or giving the redirector effect `[client, router]` dependencies, fails Task 1's regression. Reformatting the guard (line-broken dependency arrays, trailing commas) does not.
- **Final verification:**
  - `pnpm run lint` 6/6;
  - web and API `tsc` clean;
  - `pnpm run test` 10/10, with `web` 550/550 (baseline 536) and `@clensy/client` 10/10;
  - `pnpm --filter web build` exit 0;
  - the protected-area diff is empty, and exactly the five planned files change.

After the plan was written, and again after the M5 revisions, the tree was reset and Tasks 1–3 were replayed from this document's diffs. Every `Expected:` line matched. The tree was then reverted, and only this plan is committed.

## Global Constraints

- One redirector per mounted guard. Its creating effect has no dependencies and is never re-run by a `client` or `router` identity change. Its effects call the **current** client and router (spec §4.3 item 1).
- The session check effect stays `[client, pathname]`, bound to the captured redirector through `runSessionCheck` (unchanged #131 behavior).
- Landing error markup: exactly `<p role="alert" className="text-sm text-red-600">{t('landing.error')}</p>`. The loading and empty states are unchanged, with no `role="alert"`. No `@clensy/ui` change, and `ErrorState` is not used (spec §4.4).
- The `/login` scan counts string and no-substitution template literals whose value is `/login` or starts with `/login?` or `/login/`. A template with substitutions counts only if its **head text** does: a `/login` in a later span (`` `${base}/login` ``) is intentionally not detected. Comments and JSX text never count. The allowed set stays exactly `components/layout/session-guard.tsx` and `components/layout/user-menu.tsx` (spec §8 item 5, invariant 12).
- No change to session evidence, the signal, the latch, `runSessionCheck`, copy, or any protected area.

## Review Focus

1. **A real identity change while mounted.** Nothing in the app changes `client` or `router` today, so the fix is pinned at source level only. M7 should confirm that the redirector effect really has `[]` dependencies, and that the sync effect is declared before it.
2. **Strict-mode double mount** still disposes the first redirector and creates a second. The `[]` effect re-runs on remount, as #131 already relied on.
3. **The scan's blind spots.** These are not caught: a `/login` route assembled from pieces (`'/log' + 'in'`), one read from config, or a `/login` in a later template span (`` `${base}/login` ``), which a detector case pins as intentional. This is acceptable: the spec targets route literals.
4. **The alert's announcement** in a real screen reader. Static markup pins only the role.

## File Map

| File | Task | Change |
| --- | --- | --- |
| `apps/web/components/layout/session-guard.tsx` | 1 | `latest` ref, sync effect, `[]` redirector effect |
| `apps/web/lib/session-routing-regressions.test.ts` | 1 | AST-based one-redirector-per-mount regression and its `useEffectCalls` helper; the old client/router literal assertions are replaced by it |
| `apps/web/app/app/page.tsx` | 2 | Error branch markup |
| `apps/web/lib/session-routing-pages.test.tsx` | 2 | Alert and no-alert render tests |
| `apps/web/lib/web-shell-regressions.test.ts` | 3 | `loginLiteralsIn`, `LOGIN_ROUTE`, the invariant 12 scan rewired, detector `it.each` |

Commit messages carry no `Co-Authored-By: Claude` trailer (owner's global instruction).

---

### Task 1: One redirector per guard mount (spec §4.3 item 1, invariant 3; §8 item 2)

**Files:** Modify `apps/web/lib/session-routing-regressions.test.ts`, `apps/web/components/layout/session-guard.tsx`.

**Interfaces:** No exported surface changes. `SessionGuard(): null` as before.

- [ ] **Step 1: Write the failing regression.** It replaces the two direct `client.clearStore()` / `router.replace('/login')` assertions with a structural source regression, named `… (source)` because it proves source structure, not runtime behavior. It reads the guard's `useEffect` calls through the TypeScript AST, with each callback body and dependency list compacted, so formatting doesn't matter. It asserts three things: the redirector effect's dependencies are `[]`; its effects call through `latest`; and the `[client, router]` sync effect, which only assigns `latest.current`, comes before it. Apply:

```diff
diff --git a/apps/web/lib/session-routing-regressions.test.ts b/apps/web/lib/session-routing-regressions.test.ts
--- a/apps/web/lib/session-routing-regressions.test.ts
+++ b/apps/web/lib/session-routing-regressions.test.ts
@@ -1,5 +1,6 @@
 import { readFileSync } from 'node:fs';
 import { resolve } from 'node:path';
+import ts from 'typescript';
 import { describe, expect, it } from 'vitest';
 
 const webRoot = resolve(import.meta.dirname, '..');
@@ -40,8 +41,27 @@ describe('session routing regressions', () => {
 
     expect(guard).toContain('onSessionInvalid(');
     expect(guard).toContain('createSessionRedirector(');
-    expect(guard).toContain("navigateToLogin: () => router.replace('/login')");
-    expect(guard).toContain('clearStore: () => client.clearStore()');
+  });
+
+  // Spec §4.3 item 1 (#146): one redirector per mounted guard. A structural
+  // source regression, not a runtime proof (no DOM environment): parsed with
+  // the TypeScript AST, so formatting changes don't break it. The effect that
+  // creates the redirector has no dependencies, so a client or router identity
+  // change cannot replace the latch. Its effects reach the current client and
+  // router through `latest`, kept in sync by an earlier [client, router]
+  // effect that only updates the ref.
+  it('keeps the redirector mount-scoped while routing through the latest client and router (source)', () => {
+    const effects = useEffectCalls(readWebSource('components/layout/session-guard.tsx'));
+    const redirectorIndex = effects.findIndex((effect) => effect.body.includes('createSessionRedirector('));
+    const syncIndex = effects.findIndex((effect) => effect.body === '{latest.current={client,router};}');
+
+    expect(redirectorIndex).toBeGreaterThanOrEqual(0);
+    expect(effects[redirectorIndex]?.deps).toBe('[]');
+    expect(effects[redirectorIndex]?.body).toContain('clearStore:()=>latest.current.client.clearStore()');
+    expect(effects[redirectorIndex]?.body).toContain("navigateToLogin:()=>latest.current.router.replace('/login')");
+    expect(syncIndex).toBeGreaterThanOrEqual(0);
+    expect(effects[syncIndex]?.deps).toBe('[client,router]');
+    expect(syncIndex).toBeLessThan(redirectorIndex);
   });
 
   // Spec §4.2 / §4.3 item 4: a check acts only through the redirector captured
@@ -66,3 +86,22 @@ describe('session routing regressions', () => {
     expect(guard).not.toMatch(/canViewPath|isGatedPath|landingHref|visibleNavGroups|viewRoles|nav-groups/);
   });
 });
+
+// Each useEffect(callback, deps) call in a component, in source order. The
+// callback body and dependency list are compacted (all whitespace and trailing
+// commas removed), so formatting never changes what the assertions see.
+function useEffectCalls(text: string) {
+  const source = ts.createSourceFile('component.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
+  const normalize = (node: ts.Node | undefined) =>
+    node ? node.getText(source).replace(/\s+/g, '').replace(/,(?=[\])}])/g, '') : undefined;
+  const calls: Array<{ body: string; deps: string | undefined }> = [];
+  const visit = (node: ts.Node) => {
+    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useEffect') {
+      const [callback, deps] = node.arguments;
+      if (callback && ts.isArrowFunction(callback)) calls.push({ body: normalize(callback.body) ?? '', deps: normalize(deps) });
+    }
+    ts.forEachChild(node, visit);
+  };
+  visit(source);
+  return calls;
+}
```

- [ ] **Step 2: Run to verify RED.**

Run: `pnpm --filter web exec vitest run lib/session-routing-regressions.test.ts`
Expected: 1 failed (`keeps the redirector mount-scoped while routing through the latest client and router (source)`), 6 passed.

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
 
+  // Spec §4.4 (#146): the error is announced, with the admin page's
+  // staff.loadError visual classes; the loading and empty states are not alerts.
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

**Contract:** a literal counts when its value is `/login` or starts with `/login?` or `/login/`. For a template expression, the detector evaluates **only the template's head text**, so a `/login` in a later template span (`` `${base}/login` ``) is intentionally not detected. The `it.each` pins that case as `false`.

- [ ] **Step 1: Write the failing tests.** Rewire the invariant 12 scan to `loginLiteralsIn`, and add the detector `it.each`. Apply:

```diff
diff --git a/apps/web/lib/web-shell-regressions.test.ts b/apps/web/lib/web-shell-regressions.test.ts
--- a/apps/web/lib/web-shell-regressions.test.ts
+++ b/apps/web/lib/web-shell-regressions.test.ts
@@ -95,19 +95,34 @@ describe('web shell regressions', () => {
 
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
+    ['a later template span (head text only)', 'const url = `${base}/login`;', false],
+  ] as const)('detects a /login literal in %s: %s', (_name, source, expected) => {
+    expect(loginLiteralsIn('probe.tsx', source).length > 0).toBe(expected);
+  });
+
   it('reads currentAdmin in the gate with the default cache-first policy and never redirects', () => {
     const gate = readWebSource('components/layout/page-visibility-gate.tsx');
 
```

- [ ] **Step 2: Run to verify RED.**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: `Failed Tests 10`, each with `ReferenceError: loginLiteralsIn is not defined`: the invariant 12 scan plus the 9 detector cases. That was the observed output during pre-validation.

- [ ] **Step 3: Implement the detector** below `parseSource`. Apply:

```diff
diff --git a/apps/web/lib/web-shell-regressions.test.ts b/apps/web/lib/web-shell-regressions.test.ts
--- a/apps/web/lib/web-shell-regressions.test.ts
+++ b/apps/web/lib/web-shell-regressions.test.ts
@@ -209,6 +224,27 @@ function parseSource(fileName: string, text: string) {
   return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, scriptKindFor(fileName));
 }
 
+const LOGIN_ROUTE = /^\/login(?:$|[?/])/;
+
+// Every string or template literal whose value is a /login route (session
+// routing spec §8 item 5, #146). Parsed with the TypeScript AST, so comments
+// and JSX text never count. For a template with substitutions only its head
+// text is examined, so `${base}/login` (/login in a later span) is
+// deliberately not detected; the scan targets route literals, not built URLs.
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
3. `pnpm run test`: 10/10, with `web` 550/550 and `@clensy/client` 10/10.
4. `pnpm --filter web build`: exit 0.
5. `git diff --stat 4f84a4e -- apps/api packages apps/web/middleware.ts apps/web/components/layout/page-visibility-gate.tsx apps/web/components/layout/user-menu.tsx apps/web/app/login apps/web/messages pnpm-lock.yaml`: empty.
6. `git diff --name-only 4f84a4e -- . ':(exclude)docs'`: exactly these five lines, in this order:

   ```text
   apps/web/app/app/page.tsx
   apps/web/components/layout/session-guard.tsx
   apps/web/lib/session-routing-pages.test.tsx
   apps/web/lib/session-routing-regressions.test.ts
   apps/web/lib/web-shell-regressions.test.ts
   ```

## Traceability

| Spec (#146 amendment) | Task |
| --- | --- |
| §4.3 item 1 (one latch per mount, current client/router), invariant 3 | 1 |
| §8 item 2 (one-latch-per-mount regression) | 1 |
| §4.4 (landing error `role="alert"`, admin style; loading and empty unchanged) | 2 |
| §8 item 3 (alert / no-alert tests) | 2 |
| §8 item 5 (literal-based, comment-blind scan), invariant 12 | 3 |
| Criterion 8 (no session-semantics, copy, `@clensy/ui` or #114 change) | Final verification steps 5–6 |

## Deferred (not in this plan)

None from #146. The #131 spec §11 deferrals stand.

## Execution risks (operational only)

- **Changes to `main`.** If `main` moves under `session-guard.tsx`, `app/app/page.tsx` or the three test files before merge, re-apply the diffs by quoted anchor and re-run every `Expected:` line.

## Gate outcomes

### M6 — Implementation complete (2026-10-08)

Executed natively (superpowers:executing-plans), task by task, in plan order, on `feat/146-session-routing-followups`. Each task's diffs were applied from this plan's own text.

| Task | Commit | RED observed | GREEN |
| --- | --- | --- | --- |
| 1. One redirector per mount | `a1725a0` | 1 failed (`keeps the redirector mount-scoped … (source)`), 6 passed | 189/189; `tsc`, lint clean |
| 2. Landing error alert | `4078ed6` | 1 failed (`announces the account load error …`), 8 passed | 9/9 |
| 3. Literal-based `/login` scan | `54f7dca` | `Failed Tests 10`, each `ReferenceError: loginLiteralsIn is not defined` | 190/190; `tsc`, lint clean |

- **Characterization tests** (M6 step 3.6). Each one failed against a mutation made outside the commit, and the code was then restored:
  - `role="alert"` added to the `landing.loading` `<p>` failed `renders no alert for loading` and `… a settled missing principal`;
  - added to the `landing.empty` `<p>`, it failed `… a principal with no destination`;
  - `page.tsx` was restored byte for byte.
- **Scan mutation:** appending `const LOGIN_PATH = '/login';` to `app/app/page.tsx` failed the invariant 12 scan. It was then removed.
- **Deviations from the plan:** none. No rulings were needed.
- **Final verification** (steps 1–6), all as expected:
  - `pnpm run lint` 6/6;
  - web and API `tsc` clean;
  - `pnpm run test` 10/10, with `web` 550/550 and `@clensy/client` 10/10;
  - `pnpm --filter web build` exits 0;
  - the protected-area diff is empty;
  - `git diff --name-only 4f84a4e -- . ':(exclude)docs'` lists exactly the five planned files.
  - `main` had not moved since the branch was cut.

### M7 — Approved for merge (2026-10-08)

- **Subject:** PR [#147](https://github.com/rexescario-dev/clensy-platform/pull/147), head `a6c9803`. It carries the #146 spec amendment, this Accepted plan and the M6 change set (process spec §2.8). `main` had not moved (`0a8d87a`).
- **Accepted specification:** the #146 amendment in `docs/superpowers/specs/2026-10-07-session-routing-design.md`. The rest of that spec (#131) is unchanged.
- **Accepted implementation plan:** this document.
- **M6 gate:** plan Accept `3ab7dd6` (recorded `298377a`) is an ancestor of the first implementation commit `a1725a0`.
- **Plan tasks reviewed:** Tasks 1–3 (`a1725a0`, `4078ed6`, `54f7dca`) ✓. No reordering, no skipped task, no extras.
- **Review basis:** an **independent review** by a fresh Opus agent context that did not implement the change, as CLAUDE.md requires for application-code slices. This record was written by the implementer and is based on that review. The reviewer:
  - re-ran `web` test (550/550), web `tsc` and lint, the five-file scope check and the protected-area diff;
  - checked all five owner-required points;
  - wrote a temporary jsdom runtime probe under `<StrictMode>`, since deleted. It passed on HEAD: a strict-mode double mount leaves one listener; an identity change while mounted creates no new redirector; a later signal reaches only the new client and router, exactly once. Against the #131 guard it failed (`expected 3 to be 2`).
  - mutation-checked the AST regression, the landing tests and the scan. None of the new tests is vacuous.
- **Verification evidence:** CI run [37651795446](https://github.com/rexescario-dev/clensy-platform/actions/runs/37651795446) on `a6c9803`: Lint, Test, Release gate and API e2e all passed. Local runs and the M6 RED/GREEN and mutation evidence are recorded above.
- **Blocking findings:** none (0 Critical, 0 Important).
- **Non-blocking observations** (deferred Minors; these MUST NOT affect the merge decision):
  1. The `latest` ref is synced by a passive effect, so it lags one commit after a client or router identity change. A redirect step in that window would use the previous object. Nothing in the app changes these identities. `useLayoutEffect` or `useEffectEvent` would close the window; that is a preference.
  2. The `/login` scan's declared literal-only blind spots: `${base}/login` (pinned), concatenation, and computed paths. These are in scope as specified.
  3. The sync-effect assertion is an exact match on the compacted body. A harmless rewrite fails it (fails safe: churn, never false confidence).
- **Gate:** merge per human/project norms.

### M8 — N/A (2026-10-08)

- The change is three small, targeted edits: one ref and one effect-dependency change, one markup branch, and one test-local detector. M7 found no duplication or complexity to refactor.
- None of the deferred Minors is a behavior-preserving refactor:
  - (1) changes effect timing;
  - (2) changes a test's detection rule;
  - (3) changes a test assertion.

### M9 — Complete (2026-10-08)

**Documentation scope:** the spec's Tracking cell, and this section.

**Content updates:**
- The #131 spec's Tracking cell now links PR #147 from its #146 amendment note. Caused by the PR being opened.
- This section. Caused by the M7–M9 gate outcomes.

**Editorial changes:** none.

**Unchanged, with reason:**
- `apps/web/README.md`. Its shell paragraph says the landing shows "Unable to load your account." on a failed read. That is still true. Neither the alert role nor the guard's internal ref change alters any behavior the README describes.
- `apps/web/middleware.ts`. Its comment already names `SessionGuard` (#131 M9).

**Verification:**
- Relative links in the spec and this plan resolve (scripted scan).
- Status is consistent: the #146 amendment and this plan are Accepted, M7 is Approved, and the PR is open with CI green.
- Terminology follows the spec (session redirect, latch, session check).

### M10 — Accepted, workflow validated (2026-10-08)

**Subject:** the installed workflow prompt library (`docs/workflows/`, generic 1.4.1 / claude 0.2.0), against `docs/workflows/specs/agent-workflow-design.md` §2.10. This slice ran it on #146 from M2 (a slice-local amendment) to M9.

**Asset inventory:** unchanged. Nine prompts map to M2–M10. There are no orphan assets.

**Checks:**
- §2.4 and the slice-local amendment rules were honoured. The amendment was made in place, with its own Draft → Accepted lifecycle, a stated delta, and criterion 8. The #131 remainder stayed Accepted throughout.
- M3 Accept `4f84a4e` (recorded) precedes the M4 draft `3d5fb65`.
- §2.5 was honoured: plan Accept `298377a` is an ancestor of the first implementation commit `a1725a0`.
- M5 recorded an explicit Return before Accept: five changes and wording on its first pass.
- Providers were honoured: GitHub for the issue (#146), branch and PR (#147).
- CLAUDE.md's M7 rule was honoured: a fresh, independent reviewer on the most capable model, citing CI.
- Slice Completion Reports were emitted at M6 and at M7–M9.
- §2.8 was honoured: one PR (#147) carries the amendment, plan, implementation and docs.

**Blocking findings:** none.

**Non-blocking observations:**
1. **Review minors become their own slice cheaply.** The #131 M7 Minors became a complete M2–M10 slice through a slice-local amendment. That path worked well for a small, bounded follow-up, and it kept the original spec's acceptance intact.
