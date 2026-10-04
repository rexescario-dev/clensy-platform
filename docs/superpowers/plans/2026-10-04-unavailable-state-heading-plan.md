# Unavailable-State Heading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Draft |
| Date | 2026-10-04 |
| Tracking issue | [#132](https://github.com/rexescario-dev/clensy-platform/issues/132). Program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81). |
| Scope | `apps/web` only: `components/layout/page-visibility-gate.tsx` and `lib/page-visibility-gate.test.tsx`. No `apps/api`, `packages/client`, `packages/ui`, `packages/web`, middleware or message changes. |
| Implements (Accepted) | [Role-Aware Experience for Typed URLs of Role-Hidden Pages — Design](../specs/2026-10-04-role-aware-typed-urls-design.md), **§4.3 amendment (#132)**, Status **Accepted** (M3, 2026-10-04, `194c11d`; recorded at `93a56f0`). The amended rows are the Depends-on row, §4.3, §6, §8 item 2, §9, §10 criterion 8 and §11. |
| Relies on (Accepted) | The remainder of the same spec (Accepted at `4d1d4c0`, implemented by PR [#130](https://github.com/rexescario-dev/clensy-platform/pull/130)), unchanged; [`@clensy/ui` Shared UI System](../specs/2026-09-16-shadcn-ui-boundary-design.md) (`LoadingState` used as-is, `EmptyState` API untouched). |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. Helper names, test wording and the comment text below are planning decisions, not product semantics. |
| Edit anchors | Every edit is located by the **quoted code**, not by line number. The branch base is `ce2cd18` (`main`); the spec commits on top don't touch code. |

**Goal:** Deliver the #132 amendment to spec §4.3. `UnavailableState`, the module-local component in `page-visibility-gate.tsx`, renders the existing `nav.unavailable.message` as the page's single `<h1>` instead of composing `EmptyState`. It keeps the same visual treatment, the same `landingHref` link, and the same omission of the link when there's no landing page.

**Architecture:** This is a single-component change. The gate's six rendering rows, its hooks and its `LoadingState` row stay as they are. Only the JSX returned by `UnavailableState` changes:

- `EmptyState`'s outer `div` classes are copied verbatim, so the container looks the same.
- The `<p className="text-sm">` becomes an `<h1 className="text-sm">`. Tailwind 4 preflight sets `h1`–`h6` to `font-size: inherit; font-weight: inherit`, and `apps/web/app/globals.css` adds no heading styles, so `text-sm` renders the heading exactly as the paragraph rendered.
- The link, still wrapped in a `div` as `EmptyState` wrapped its action, appears only when `landingHref(principal)` is defined.

**Tech Stack:** Next.js 16 App Router (client component), React 19, next-intl 4, Tailwind CSS 4, Vitest in the `node` environment with `react-dom/server` `renderToStaticMarkup` (the repo has no DOM test environment).

**Pre-validation (full).** Before M5, on 2026-10-04, Task 1's code was applied verbatim to a working tree at `93a56f0`, and every command named by an `Expected:` line in this plan ran with the stated result, including the planned RED state (4 failed, 17 passed). The tree was then reverted. Commands run:

- `pnpm --filter web exec vitest run lib/page-visibility-gate.test.tsx` (RED, then GREEN: 21 passed)
- `pnpm --filter web test` (17 files, 496 tests passed)
- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web lint`
- `pnpm --filter web build`
- `git diff --stat main -- apps/api packages apps/web/middleware.ts apps/web/messages`

## Global Constraints

Copied from the Accepted spec. Every task's requirements implicitly include this section.

- `UnavailableState` stays a module-local component in `page-visibility-gate.tsx`. The gate renders it, and it doesn't compose `EmptyState` (§4.3).
- Its only heading is an `<h1>` whose text is `nav.unavailable.message`. There's no other heading, no generic "Unavailable" heading, and no visually hidden duplicate (§4.3).
- Its presentation is unchanged: the centered container styling previously used by `EmptyState`, and the message at `text-sm` slate. It doesn't use `PageHeader` (§4.3).
- The link to `landingHref(principal)`, labelled `nav.unavailable.action`, is unchanged, and it's omitted when `landingHref` is `undefined` (§4.3, §5 invariant 8).
- `@clensy/ui` is unchanged, `EmptyState`'s API included. There's no live region, no `role="status"`/`role="alert"`, no landmark, and no document `<title>` change (§4.3, §6, §9).
- The copy, the visibility rule, the gate's six rendering rows, the cache-first `useCurrentAdminQuery()` call and API behavior are unchanged (§4.2, §4.4, §5).

## Review Focus

1. **A duplicate or missing heading.** A future edit could add a visually hidden heading, or turn the message back into a `<p>`. The `expectUnavailableHeading` helper counts every `<h1>`–`<h6>` in the gate's output and requires exactly one `<h1>` carrying the message.
2. **The no-landing branch.** With no link, the heading must still be there, and still the only heading. This is pinned by the "omits the home link" test.
3. **Visual drift.** The `<h1>` must not pick up heading styles. This is guaranteed by Tailwind preflight plus `text-sm`, which pre-validation confirmed in the source. Optional manual smoke is listed in Final verification.

---

## File Map

| File | Change | Task |
| --- | --- | --- |
| `apps/web/lib/page-visibility-gate.test.tsx` | Add `expectUnavailableHeading`, and assert it in the Denied, both Cross-scope, and No-landing tests | 1 |
| `apps/web/components/layout/page-visibility-gate.tsx` | `UnavailableState` renders its own container with the message as `<h1>`, and drops the `EmptyState` import | 1 |

---

### Task 1: The unavailable state's `<h1>` (spec §4.3 as amended by #132; §8 item 2 Heading; §10 criterion 8)

**Files:**
- Modify: `apps/web/lib/page-visibility-gate.test.tsx`
- Modify: `apps/web/components/layout/page-visibility-gate.tsx`

- [ ] **Step 1: Add the heading assertion helper.** In `apps/web/lib/page-visibility-gate.test.tsx`, insert this directly above `function expectMounted(html: string) {`. `UNAVAILABLE` is the file's existing escaped-message constant.

```tsx
// Spec §4.3 (#132): the message is the state's single heading, at level 1.
// Its accessible name is its text content.
function expectUnavailableHeading(html: string) {
  expect(html.match(/<h[1-6][\s>]/g) ?? []).toHaveLength(1);
  expect(html).toMatch(new RegExp(`<h1[^>]*>${UNAVAILABLE}</h1>`));
}
```

- [ ] **Step 2: Assert it in the four §8 item 2 cases.** These are inside `describe('rows 1–2: principal present', …)`:

  - **Denied**, `it('replaces a denied page with the unavailable state and a home link', …)`. Replace `expect(html).toContain(UNAVAILABLE);` with `expectUnavailableHeading(html);`.
  - **Cross-scope, platform principal**, `it('denies a Super Admin a tenant page and links to the platform landing', …)`. Insert `expectUnavailableHeading(html);` between `expectNotMounted(html);` and `expect(html).toMatch(homeLink('/app/platform'));`.
  - **Cross-scope, tenant principal**, `it('denies a tenant principal the platform page', …)`. Replace `expect(html).toContain(UNAVAILABLE);` with `expectUnavailableHeading(html);`.
  - **No landing**, `it('omits the home link when the principal has no landing', …)`. Replace `expect(html).toContain(UNAVAILABLE);` with `expectUnavailableHeading(html);`.

  The link assertions (`homeLink(…)`, `not.toContain('<a ')`) stay unchanged. The other tests that check `toContain(UNAVAILABLE)` are not §8 Heading cases and stay as they are.

- [ ] **Step 3: Run it and watch it fail.**

Run: `pnpm --filter web exec vitest run lib/page-visibility-gate.test.tsx`
Expected: FAIL. 4 failed and 17 passed, each failure from `expectUnavailableHeading`'s count (`expected [] to have a length of 1 but got +0`), because `EmptyState` renders the message in a `<p>`.

- [ ] **Step 4: Render the message as the `<h1>`.** In `apps/web/components/layout/page-visibility-gate.tsx`:

  - Replace `import { EmptyState, LoadingState } from '@clensy/ui';` with `import { LoadingState } from '@clensy/ui';`.
  - Replace everything from `// The shared state for every denied path (spec §4.3): no roles or scopes` to the end of the file with:

```tsx
// The shared state for every denied path (spec §4.3): no roles or scopes
// named, one way home through the same landing rule as /app. Its message is
// the page's single <h1>, styled as the former EmptyState message.
function UnavailableState({ principal }: { principal: NavPrincipal }) {
  const t = useTranslations('nav');
  const home = landingHref(principal);

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-3 py-10 text-center text-slate-500">
      <h1 className="text-sm">{t('unavailable.message')}</h1>
      {home ? (
        <div>
          <Link href={home} className="text-sm font-medium text-slate-900 underline underline-offset-4">
            {t('unavailable.action')}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Run it and watch it pass.**

Run: `pnpm --filter web exec vitest run lib/page-visibility-gate.test.tsx`
Expected: PASS, 21 tests.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/components/layout/page-visibility-gate.tsx apps/web/lib/page-visibility-gate.test.tsx
git commit -m "feat(web): announce the unavailable state as the page's <h1> (#132)"
```

## Final verification (before the M6 handoff report)

Run each command and record its result in the M6 Slice Completion Report's Validation table:

| Command | Expected |
| --- | --- |
| `pnpm --filter web test` | PASS, every file (17 files, 496 tests at pre-validation) |
| `pnpm --filter web exec tsc --noEmit` | exit 0 |
| `pnpm --filter web lint` | exit 0 |
| `pnpm --filter web build` | exit 0 |
| `git diff --stat main -- apps/api packages apps/web/middleware.ts apps/web/messages` | empty: no API, shared-package, middleware or copy change (§4.3, §9) |

`@clensy/web` and `@clensy/ui` suites aren't run, because neither package changes. The empty diff above is the evidence for that.

**Optional manual smoke**, at M6's discretion and not a gate: sign in as a `FINANCE` seed user and open `/app/customers`. Check that the state looks the same as before, and that a screen reader's heading navigation (or the accessibility tree) shows one level-1 heading, "This page isn't available to you.".

## Traceability

| Spec | Implemented by |
| --- | --- |
| §4.3 (#132): module-local `UnavailableState`, single `<h1>` message, no `EmptyState`, unchanged presentation and link, omitted link | Task 1 Step 4 |
| §4.3 / §6 / §9 (#132) exclusions: no `@clensy/ui` change, no live region, no title change | Task 1 Step 4 (none added); Final verification diff |
| §8 item 2 Heading (#132) | Task 1 Steps 1–3, 5 |
| §10 criterion 8 | Task 1 and Final verification |

## Deferred (not in this plan)

Per spec §11 (#132): page-specific document titles, `Button asChild variant="link"` for the home link, and a `/app/admin/` trailing-slash row in `lib/nav-groups.test.ts`. Earlier deferrals (session/expiry routing, platform navigation, extra locales) are untouched.

## Execution risks (operational only)

- **HTML escaping.** `renderToStaticMarkup` escapes `'` as `&#x27;`. The helper therefore builds its regex from the existing escaped `UNAVAILABLE` constant. That constant contains no regex metacharacters other than `.`, which still matches itself.

## Gate outcomes
