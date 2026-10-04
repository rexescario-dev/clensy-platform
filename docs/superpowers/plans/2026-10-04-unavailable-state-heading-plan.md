# Unavailable-State Heading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Accepted |
| M5 decision | **Accepted** — 2026-10-04, at `a402219`, by the owner, on the second pass, with no further revision. M6 MUST implement Task 1 as written: `UnavailableState` stays module-local in `page-visibility-gate.tsx`, renders the existing message as its single `<h1 className="text-sm">` inside `EmptyState`'s copied container classes, keeps the conditional `landingHref` link, and drops only the `EmptyState` import; the four §8 item 2 tests assert `[['h1', UNAVAILABLE]]` via `expectUnavailableHeading`. |
| M5 history | First pass (2026-10-04) returned one required change and one optional hardening, both applied without changing the approach. **Required:** the plan no longer claims the static-markup test computes an accessible name. It verifies the `<h1>`'s text content, which is that heading's accessible name because it has no naming attributes (Task 1 Step 1, "What this verifies"). **Wording:** Step 3's RED state now says all four heading assertions fail because there are zero heading elements. **Hardening:** the helper no longer builds a regex from the message. It extracts `[tag, text]` pairs and compares them by equality. |
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

**Pre-validation (full).** Before M5, on 2026-10-04, Task 1's code was applied verbatim to a working tree at `93a56f0`, and every command named by an `Expected:` line in this plan ran with the stated result, including the planned RED state (4 failed, 17 passed). The tree was then reverted. After the first M5 pass revised the Step 1 helper, Task 1 was re-applied from the revised plan text at `fae3093`, and every command below was re-run with the same results. The tree was reverted again. Commands run:

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

1. **A duplicate or missing heading.** A future edit could add a visually hidden heading, or turn the message back into a `<p>`. The `expectUnavailableHeading` helper extracts every `<h1>`–`<h6>` in the gate's output and requires that the whole list is exactly one `<h1>` whose text content is the message.
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
// Spec §4.3 (#132): the state's only heading is an <h1> holding the message.
// Static markup can't compute accessible names, so this checks the text
// content; the <h1> carries no naming attributes, so that is its name.
function expectUnavailableHeading(html: string) {
  const headings = [...html.matchAll(/<(h[1-6])\b[^>]*>(.*?)<\/h[1-6]>/g)].map(([, tag, text]) => [tag, text]);
  expect(headings).toEqual([['h1', UNAVAILABLE]]);
}
```

  It extracts every `<h1>`–`<h6>` as `[tag, text]` and compares the whole list in one equality check. That checks three things together: there's exactly one heading, it's level 1, and its text content is the message. The message is compared as data and is never used as a regex pattern.

  **What this verifies.** The repo renders with `renderToStaticMarkup` and has no DOM or accessibility-tree test environment, and this slice adds no accessibility-testing dependency. So the test verifies the `<h1>`'s **text content**, not a computed accessible name. For this markup the two are the same, because the `<h1>` has no `aria-label`, `aria-labelledby` or `title`. That's how the plan satisfies spec §8 item 2's "accessible name".

- [ ] **Step 2: Assert it in the four §8 item 2 cases.** These are inside `describe('rows 1–2: principal present', …)`:

  - **Denied**, `it('replaces a denied page with the unavailable state and a home link', …)`. Replace `expect(html).toContain(UNAVAILABLE);` with `expectUnavailableHeading(html);`.
  - **Cross-scope, platform principal**, `it('denies a Super Admin a tenant page and links to the platform landing', …)`. Insert `expectUnavailableHeading(html);` between `expectNotMounted(html);` and `expect(html).toMatch(homeLink('/app/platform'));`.
  - **Cross-scope, tenant principal**, `it('denies a tenant principal the platform page', …)`. Replace `expect(html).toContain(UNAVAILABLE);` with `expectUnavailableHeading(html);`.
  - **No landing**, `it('omits the home link when the principal has no landing', …)`. Replace `expect(html).toContain(UNAVAILABLE);` with `expectUnavailableHeading(html);`.

  The link assertions (`homeLink(…)`, `not.toContain('<a ')`) stay unchanged. The other tests that check `toContain(UNAVAILABLE)` are not §8 Heading cases and stay as they are.

- [ ] **Step 3: Run it and watch it fail.**

Run: `pnpm --filter web exec vitest run lib/page-visibility-gate.test.tsx`
Expected: FAIL, with 4 failed and 17 passed. All four new heading assertions fail because the unavailable state currently contains zero heading elements, since `EmptyState` renders the message in a `<p>`. Each fails with `expected [] to deeply equal [ [ 'h1', …(1) ] ]`.

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

- **HTML escaping.** `renderToStaticMarkup` escapes `'` as `&#x27;`. The helper therefore compares the extracted heading text with the existing escaped `UNAVAILABLE` constant, as data.

## Gate outcomes

### M6 — Implementation complete (2026-10-04)

Executed natively, in plan order, on `feat/132-unavailable-state-heading`. Plan Accept `ece4b7c` is the parent of the implementation commit.

| Task | Commit | RED observed | GREEN |
| --- | --- | --- | --- |
| 1. The unavailable state's `<h1>` | `5cc0b82` | Exactly the four §8 item 2 tests, each `expected [] to deeply equal [ [ 'h1', …(1) ] ]`; 17 passed | `lib/page-visibility-gate.test.tsx` 21/21 |

- **Characterization tests:** none. Every new assertion failed before the change.
- **Deviations from the plan:** none. The test and code edits are the plan's text verbatim.
- **Final whole-branch review:** a **self-review** by the implementer, because no fresh-agent reviewer was requested this session. There were no Critical, Important or Minor findings. It checked the three Review Focus items:
  1. The heading helper rejects any extra or missing heading.
  2. The No-landing test keeps the heading.
  3. Tailwind 4 preflight resets `h1` size and weight, and `globals.css` adds no heading styles.

  It also checked that the shell chrome renders no `<h1>`: the only other heading in the chrome is the mobile sidebar's `SheetTitle`, rendered only while that sheet is open. So the state is the page's single `<h1>`.
- **Final verification**, all exit 0 or empty as the plan expects:
  - `pnpm --filter web test`: 17 files, 496/496.
  - `pnpm --filter web exec tsc --noEmit`, `pnpm --filter web lint` and `pnpm --filter web build`: exit 0.
  - `git diff --stat main -- apps/api packages apps/web/middleware.ts apps/web/messages`: empty.

### M7 — Approved for merge (2026-10-04)

- **Subject:** PR [#133](https://github.com/rexescario-dev/clensy-platform/pull/133), head `4051923`, mergeable with `main` (`ce2cd18`). It carries the spec amendment, this Accepted plan and the M6 change set (process spec §2.8).
- **Accepted specification:** `docs/superpowers/specs/2026-10-04-role-aware-typed-urls-design.md`, §4.3 amendment (#132).
- **Accepted implementation plan:** this document.
- **M6 gate:** plan Accept `ece4b7c` is the parent of the implementation commit `5cc0b82`.
- **Plan tasks reviewed:**
  - Task 1, the unavailable state's `<h1>` (`5cc0b82`) ✓

  No reordering, no skipped task, no extras.
- **Spec conformance:** amended §4.3 ✓.
  - `UnavailableState` is module-local and doesn't compose `EmptyState`.
  - Its single `<h1>` is `nav.unavailable.message`, with no other or hidden heading.
  - Presentation is unchanged, with no `PageHeader`.
  - The `landingHref` link and its omission are unchanged.
  - There's no live region, `role` or landmark, and no `<title>` change.
  - §8 item 2 Heading is covered in the Denied, both Cross-scope, and No-landing tests.
  - §5 invariants 1–11 are untouched; the gate function is byte-identical.
- **Scope:** two `apps/web` files plus the #132 docs. The out-of-scope diff against `main` is empty.
- **Verification evidence:**
  - CI run [37210044278](https://github.com/rexescario-dev/clensy-platform/actions/runs/37210044278) on `4051923`: Lint, Test and Release gate all succeeded.
  - Local runs and the RED/GREEN evidence are in the M6 record.
- **Review basis:** a **self-review**. The implementer wrote this record and performed the review in the same session; no independent or fresh-agent reviewer was used. Its basis is the whole-branch diff, the Review Focus checks and the shell-heading check in the M6 record, plus CI.
- **Blocking findings:** none.
- **Non-blocking observations:** none beyond the spec §11 (#132) deferrals.
- **Gate:** merge per human/project norms.

### M8 — N/A (2026-10-04)

The change replaces one component's JSX: a container, an `<h1>` and a conditional link. It adds one five-line test helper. There's no duplication or complexity worth a behavior-preserving refactor. The two styling deferrals (`Button asChild`, and the trailing-slash test row) aren't refactors.

### M9 — Complete (2026-10-04)

**Documentation scope:** `apps/web/README.md` (the shell paragraph), the spec's Tracking issue cell, and this section.

**Content updates:**
- `apps/web/README.md`, shell paragraph. After the unavailable-state sentence, one sentence now says the message is the page's `<h1>` and reachable by heading navigation, with a link to #132. Caused by Task 1 and amended spec §4.3.
- The spec's Tracking issue cell links #132 and PR #133 for the §4.3 amendment. Caused by the PR being opened.
- This section. Caused by the M7–M9 gate outcomes.

**Editorial changes:** none.

**Unchanged:** the #114 plan's M6 record, which lists the missing heading as a deferred minor. It's a historical record, and #132 is its follow-up.

**Verification:**
- Links in the spec, this plan and the README resolve (scripted scan).
- Status is consistent: the spec and its §4.3 amendment are Accepted, this plan is Accepted, and PR #133 is open with CI green.
- Terminology follows spec §3 (shell-hidden, unavailable state).
- No heading changes, contradictions or stale references.

### M10 — Accepted, workflow validated (2026-10-04)

**Subject:** the installed workflow prompt library (`docs/workflows/`, generic 1.4.1 / claude 0.2.0), against `docs/workflows/specs/agent-workflow-design.md` §2.10. This slice ran it on #132 from M2 (a slice-local amendment) to M9.

**Asset inventory:** unchanged, and the branch diff against `main` for `docs/workflows/` and `workflow.yaml` is empty. Nine prompts (`specification`, `design-review`, `implementation-planning`, `plan-review`, `implementation-execution`, `code-review`, `refactoring`, `documentation-execution`, `workflow-validation`) map to M2–M10. `conventions/` holds M1 and the reporting conventions; the governing process spec is under `specs/`.

**Checks:**
- All nine prompts cite the governing contract. There are no orphan assets.
- Every relative link under `docs/workflows/`, in the #114 spec, in this plan and in `apps/web/README.md` resolves (scripted scan).
- The slice-local amendment procedure (M2 prompt) was followed. The amendment was made in place, with its own Draft → Accepted lifecycle against #132, while the remainder stayed Accepted. It states its delta, and adds §10 criterion 8.
- §2.4 was honoured: amendment Accept `93a56f0` is an ancestor of the M4 draft `fae3093`.
- §2.5 was honoured: plan Accept `ece4b7c` is the parent of the implementation commit `5cc0b82`.
- Both review gates recorded an explicit first-pass return before Accept: M3 returned two wording fixes, and M5 returned one required change, one wording fix and one hardening.
- Providers were honoured: GitHub for the issue, branch and PR (`workflow.providers`).
- Slice Completion Reports were emitted at M6 and at M7–M9.
- §2.8 was honoured: one PR (#133) carries the amendment, plan, implementation and docs.

**Blocking findings:** none.

**Non-blocking observations:**
1. **M7 by self-review.** No fresh-agent reviewer was used this time. The M7 prompt allows a self-review when it is labelled, and the record labels it. For a two-file presentation change with CI green, the owner may judge that sufficient. Slices with wider blast radius should keep the independent reviewer that #114 and #124 used.
2. **The #114 M6 deferred minors became an issue and a spec amendment cleanly.** The amendment procedure handled a follow-up to an already-implemented Accepted spec without friction. No change to the workflow is suggested.
