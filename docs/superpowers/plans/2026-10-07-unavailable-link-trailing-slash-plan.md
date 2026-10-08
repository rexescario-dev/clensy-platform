# Unavailable-State Button Link and Trailing-Slash Row Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Accepted |
| M5 decision | **Accepted** — 2026-10-07, at `95e5ae6`, by the owner, on the first pass, with one wording correction applied: Final verification no longer uses the absence of package changes as the sole reason for not running the `@clensy/ui`/`@clensy/web` suites locally, and points to CI's repo-wide `pnpm run test`. The optional manual smoke stays as written. M6 MUST implement Tasks 1–2 as written; M7 MUST be a fresh independent review (`CLAUDE.md`). |
| Date | 2026-10-07 |
| Tracking issue | [#134](https://github.com/rexescario-dev/clensy-platform/issues/134) (items 2 and 3; item 1, page titles, moved to [#143](https://github.com/rexescario-dev/clensy-platform/issues/143)). Program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81). |
| Scope | `apps/web` only: `components/layout/page-visibility-gate.tsx`, `lib/page-visibility-gate.test.tsx` and `lib/nav-groups.test.ts`. No `apps/api`, `packages/*`, middleware, `next.config.ts` or message changes. |
| Implements (Accepted) | [Role-Aware Experience for Typed URLs of Role-Hidden Pages — Design](../specs/2026-10-04-role-aware-typed-urls-design.md), **§4.3 amendment (#134)**, Status **Accepted** (M3, 2026-10-07, `86cd2b8`; recorded at `4c23e5c`). The amended rows are §4.1 (one example), §4.3, §6, §8 items 1 and 2, §9, §10 criterion 9 and §11. |
| Relies on (Accepted) | The remainder of the same spec, including the §4.3 amendment (#132), unchanged; [`@clensy/ui` Shared UI System](../specs/2026-09-16-shadcn-ui-boundary-design.md) (`Button` and `LoadingState` used as-is). |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. Helper names, test wording, comment text and task order are planning decisions, not product semantics. |
| Edit anchors | Every edit is located by the **quoted code**, not by line number. The branch base is `61b6fb8` (`main`); the spec commits on top don't touch code. |

**Goal:** Deliver the #134 amendment. The unavailable state's home link is rendered through `@clensy/ui` `Button asChild variant="link"` wrapping the existing `next/link` `Link`, and `lib/nav-groups.test.ts` pins `/app/admin/` as segment-matching `/app/admin`.

**Architecture:** Two independent changes.

- **Trailing-slash row (Task 1).** Test only. `segmentMatches` already treats `/app/admin/` as beneath `/app/admin` (`pathname.startsWith(`${href}/`)`), so the new tests are **characterization tests**: they pass on first run and pin existing behavior (spec §4.1 example, §8 item 1).
- **Button link (Task 2).** One JSX change inside the module-local `UnavailableState`. `Button` with `asChild` renders Radix `Slot.Root`, which merges Button's `className`, `data-slot="button"`, `data-variant="link"` and `data-size="default"` onto its single child. The child is the `Link`, so the rendered element is still one `<a>` with the same `href` and text. The hand-written link classes are removed, and no class overrides are added (§4.3 Presentation).

**Tech Stack:** Next.js 16 App Router (client component), React 19, next-intl 4, Tailwind CSS 4, `@clensy/ui` `Button` (radix-ui `Slot`, cva), Vitest in the `node` environment with `react-dom/server` `renderToStaticMarkup`.

**Pre-validation (full).** Before M5, on 2026-10-07, Tasks 1 and 2 were applied verbatim from this plan's text to a working tree at `4c23e5c`, and every command named by an `Expected:` line ran with the stated result, including the Task 1 mutation check (14 failed, then reverted) and the Task 2 RED state (3 failed, 18 passed). The tree was then reverted. Commands run:

- `pnpm --filter web exec vitest run lib/nav-groups.test.ts` (GREEN 226; mutated: 14 failed, 212 passed)
- `pnpm --filter web exec vitest run lib/page-visibility-gate.test.tsx` (RED 3 failed / 18 passed, then GREEN 21)
- `pnpm --filter web test` (17 files, 511 tests passed)
- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter web lint`
- `pnpm --filter web build`
- `git diff --stat main -- apps/api packages apps/web/middleware.ts apps/web/messages apps/web/next.config.ts apps/web/lib/nav-groups.ts apps/web/app` (empty)

## Global Constraints

Copied from the Accepted spec. Every task's requirements implicitly include this section.

- The home link is `@clensy/ui` `Button` with `asChild` and `variant="link"`, wrapping the `next/link` `Link`. It renders a single anchor, with the same `landingHref(principal)` href and `nav.unavailable.action` label, and it's omitted when `landingHref` is `undefined` (§4.3 Action).
- The link takes the `link` variant as-is at the default size. There are no class overrides on the `Button` or the `Link` (§4.3 Presentation, §6).
- The heading, its `text-sm` styling, the container styling, the copy and the module-local `UnavailableState` are unchanged (§4.3).
- The billing and laundry inline `<dd>` links are not touched. No `@clensy/ui` export, variant or size is added or changed (§4.3 Shell-link convention, §6, §9).
- `findActiveHref`, `isGatedPath`, `canViewPath`, `NAV_GROUPS`, `next.config.ts` and the gate's six rendering rows are unchanged. The trailing-slash row pins behavior; it changes none (§4.1, §8 item 1).
- The existing accessible-name and href assertions on the anchor (`homeLink(…)`) stay. The `data-slot`/`data-variant` assertions complement them and don't replace them (M3 decision, #134).

## Review Focus

1. **Testing the wrapper instead of the anchor.** The new helper inspects the rendered `<a>` opening tag itself, requires exactly one anchor, and requires no `<button>`. So a regression that wraps the `Link` in a real `<button>`, or drops `asChild`, fails.
2. **Styling overrides creeping in.** Task 2's JSX passes no `className` to either `Button` or `Link`.
3. **A vacuous characterization test.** Task 1's rows must be able to fail. A mutation check (Task 1 Step 3) shows that a `segmentMatches` that rejects trailing slashes turns them red.

---

## File Map

| File | Change | Task |
| --- | --- | --- |
| `apps/web/lib/nav-groups.test.ts` | Add a `trailing slash` describe block: `findActiveHref`, `isGatedPath` and per-principal `canViewPath` for `/app/admin/` | 1 |
| `apps/web/lib/page-visibility-gate.test.tsx` | Add `expectButtonLink`, and assert it in the Denied and both Cross-scope tests | 2 |
| `apps/web/components/layout/page-visibility-gate.tsx` | Import `Button`; render the home link as `Button asChild variant="link"` around `Link`; update the component comment | 2 |

---

### Task 1: The `/app/admin/` trailing-slash row (spec §4.1 example, §8 item 1 Trailing slash; §10 criterion 9)

**Files:**
- Modify: `apps/web/lib/nav-groups.test.ts`

- [ ] **Step 1: Add the characterization tests.** In `apps/web/lib/nav-groups.test.ts`, insert this directly above `describe('PLATFORM_HOME_HREF reservation', () => {`. `STAFF`, `ALL_PRINCIPALS`, `findActiveHref`, `isGatedPath` and `canViewPath` already exist in the file.

```ts
// Characterization (already true on main): spec §4.1 and §8 item 1 (#134)
// pin a trailing slash as segment-matching its nav href. next.config.ts sets
// no trailingSlash, so Next's 308 normalizes this today; these rows stop a
// future `trailingSlash: true` from silently changing gating.
describe('trailing slash', () => {
  const STAFF_TRAILING = `${STAFF}/`;

  it('resolves /app/admin/ to /app/admin and gates it', () => {
    expect(findActiveHref(STAFF_TRAILING)).toBe(STAFF);
    expect(isGatedPath(STAFF_TRAILING)).toBe(true);
  });

  it.each(ALL_PRINCIPALS)('gives %s the same answer for /app/admin/ as for /app/admin', (_label, principal) => {
    expect(canViewPath(principal, STAFF_TRAILING)).toBe(canViewPath(principal, STAFF));
  });
});
```

- [ ] **Step 2: Run it and watch it pass (characterization).**

Run: `pnpm --filter web exec vitest run lib/nav-groups.test.ts`
Expected: PASS, 226 tests. The new block adds 15 (1 + 14 principals), all passing on first run because the behavior already exists.

- [ ] **Step 3: Mutation check (not committed).** Show that the rows can fail. In `apps/web/lib/nav-groups.ts`, temporarily replace `return pathname === href || pathname.startsWith(`${href}/`);` with `return pathname === href || (pathname.startsWith(`${href}/`) && !pathname.endsWith('/'));`, then run `pnpm --filter web exec vitest run lib/nav-groups.test.ts`.
Expected: FAIL, with 14 failed and 212 passed, all in the new `trailing slash` block. The mutation makes `/app/admin/` ungated and therefore viewable, so the `resolves /app/admin/ …` test fails, and so does the `canViewPath` row for every principal that **cannot** view `/app/admin` (13 rows). `TENANT_OWNER/TENANT` passes, because it can view both. Then revert the mutation with `git checkout -- apps/web/lib/nav-groups.ts` and confirm `git diff --quiet -- apps/web/lib/nav-groups.ts` exits 0.

- [ ] **Step 4: Commit.**

```bash
git add apps/web/lib/nav-groups.test.ts
git commit -m "test(web): pin /app/admin/ as segment-matching /app/admin (#134)"
```

### Task 2: The home link through `Button asChild variant="link"` (spec §4.3 Action, Presentation and Shell-link convention as amended by #134; §8 item 2 Home link; §10 criterion 9)

**Files:**
- Modify: `apps/web/lib/page-visibility-gate.test.tsx`
- Modify: `apps/web/components/layout/page-visibility-gate.tsx`

- [ ] **Step 1: Add the Button-link assertion helper.** In `apps/web/lib/page-visibility-gate.test.tsx`, insert this directly above `function expectMounted(html: string) {`:

```tsx
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
```

- [ ] **Step 2: Assert it in the three §8 item 2 Home-link cases.** These are inside `describe('rows 1–2: principal present', …)`. In each, insert the line directly after the existing `expect(html).toMatch(homeLink(…));`, which stays:

  - **Denied**, `it('replaces a denied page with the unavailable state and a home link', …)`: `expectButtonLink(html, '/app/bookings');`
  - **Cross-scope, platform principal**, `it('denies a Super Admin a tenant page and links to the platform landing', …)`: `expectButtonLink(html, '/app/platform');`
  - **Cross-scope, tenant principal**, `it('denies a tenant principal the platform page', …)`: `expectButtonLink(html, '/app/bookings');`

  The No-landing test (`it('omits the home link when the principal has no landing', …)`) and its `not.toContain('<a ')` assertion stay as they are.

- [ ] **Step 3: Run it and watch it fail.**

Run: `pnpm --filter web exec vitest run lib/page-visibility-gate.test.tsx`
Expected: FAIL, with 3 failed and 18 passed: exactly the three tests from Step 2, each with `expected '<a class="text-sm font-medium text-sl…' to contain 'data-slot="button"'` (the current anchor has only `class` and `href`).

- [ ] **Step 4: Render the link through `Button`.** In `apps/web/components/layout/page-visibility-gate.tsx`:

  - Replace `import { LoadingState } from '@clensy/ui';` with `import { Button, LoadingState } from '@clensy/ui';`.
  - Replace the comment block that starts `// The shared state for every denied path (spec §4.3): no roles or scopes` (three lines) with:

```tsx
// The shared state for every denied path (spec §4.3): no roles or scopes
// named, one way home through the same landing rule as /app. Its message is
// the page's single <h1>, styled as the former EmptyState message. The home
// link follows the shell-link convention (#134): Button's link variant,
// as-is, rendered onto the Link by asChild.
```

  - Replace:

```tsx
          <Link href={home} className="text-sm font-medium text-slate-900 underline underline-offset-4">
            {t('unavailable.action')}
          </Link>
```

  with:

```tsx
          <Button asChild variant="link">
            <Link href={home}>{t('unavailable.action')}</Link>
          </Button>
```

- [ ] **Step 5: Run it and watch it pass.**

Run: `pnpm --filter web exec vitest run lib/page-visibility-gate.test.tsx`
Expected: PASS, 21 tests.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/components/layout/page-visibility-gate.tsx apps/web/lib/page-visibility-gate.test.tsx
git commit -m "feat(web): render the unavailable state's home link as a Button link (#134)"
```

## Final verification (before the M6 handoff report)

Run each command and record its result in the M6 Slice Completion Report's Validation table:

| Command | Expected |
| --- | --- |
| `pnpm --filter web test` | PASS, every file (17 files, 511 tests at pre-validation) |
| `pnpm --filter web exec tsc --noEmit` | exit 0 |
| `pnpm --filter web lint` | exit 0 |
| `pnpm --filter web build` | exit 0 |
| `git diff --stat main -- apps/api packages apps/web/middleware.ts apps/web/messages apps/web/next.config.ts apps/web/lib/nav-groups.ts apps/web/app` | empty: no API, shared-package, middleware, copy, config, path-rule or page change (§4.1, §4.3, §6, §9) |

The slice consumes the existing, Accepted `@clensy/ui` `Button` contract without modifying the package, so this plan doesn't require the `@clensy/ui` or `@clensy/web` suites locally. The empty diff above is the evidence that neither package changes. The repository's normal validation still covers them: CI's Test job runs `pnpm run test` across every workspace, and M7 cites that run.

**Optional manual smoke**, at M6's discretion and not a gate: sign in as a `FINANCE` seed user and open `/app/customers`. Check that the home link shows in `text-primary` with an underline on hover only, shows Button's focus ring on keyboard focus, and still navigates to `/app/bookings`.

## Traceability

| Spec | Implemented by |
| --- | --- |
| §4.1 example (#134): `/app/admin/` segment-matches `/app/admin` | Task 1 Steps 1–3 |
| §8 item 1 Trailing slash (#134) | Task 1 Steps 1–3 |
| §4.3 Action and Presentation (#134): `Button asChild variant="link"`, single anchor, unchanged href/label/omission, no overrides | Task 2 Step 4 |
| §4.3 Shell-link convention, §6, §9 (#134): inline links and `@clensy/ui` unchanged | Task 2 Step 4 (none touched); Final verification diff |
| §8 item 2 Home link (#134) | Task 2 Steps 1–3, 5 |
| §10 criterion 9 | Tasks 1–2 and Final verification |

## Deferred (not in this plan)

- Page-specific document titles: [#143](https://github.com/rexescario-dev/clensy-platform/issues/143) (spec §11).
- Migrating the billing and laundry inline links: out of scope by §4.3 and §6 (#134).
- Earlier deferrals (session/expiry routing, platform navigation, extra locales) are untouched.

## Execution risks (operational only)

- **Attribute order.** `renderToStaticMarkup` emits the merged attributes in an order the plan doesn't rely on. The helper checks each attribute with `toContain` on the anchor's opening tag, not with one ordered regex.
- **Task independence.** Tasks 1 and 2 touch different files and can run in either order. The plan orders the test-only task first.

## Gate outcomes

### M6 — Implementation complete (2026-10-07)

Executed natively, in plan order, on `feat/134-unavailable-link-trailing-slash`. Plan Accept `bb21c1a` is the parent of the first implementation commit.

| Task | Commit | RED observed | GREEN |
| --- | --- | --- | --- |
| 1. The `/app/admin/` trailing-slash row | `69a36ac` | **Characterization test**: passed on first run (226). Mutation check, not committed: with `segmentMatches` rejecting a trailing slash, 14 failed and 212 passed (the `resolves /app/admin/ …` test plus the 13 principals that cannot view `/app/admin`); reverted, and `git diff --quiet -- apps/web/lib/nav-groups.ts` exited 0 | `lib/nav-groups.test.ts` 226/226 |
| 2. The home link through `Button asChild variant="link"` | `18c0f0f` | Exactly the three Step 2 tests, each `expected '<a class="text-sm font-medium text-sl…' to contain 'data-slot="button"'`; 18 passed | `lib/page-visibility-gate.test.tsx` 21/21 |

- **Characterization tests:** Task 1's 15 tests, with mutation evidence as above.
- **Deviations from the plan:** none. The test and code edits are the plan's text verbatim.
- **Final verification**, all exit 0 or empty as the plan expects:
  - `pnpm --filter web test`: 17 files, 511/511.
  - `pnpm --filter web exec tsc --noEmit`, `pnpm --filter web lint` and `pnpm --filter web build`: exit 0.
  - `git diff --stat main -- apps/api packages apps/web/middleware.ts apps/web/messages apps/web/next.config.ts apps/web/lib/nav-groups.ts apps/web/app`: empty.

### M7 — Approved for merge (2026-10-07)

- **Subject:** PR [#144](https://github.com/rexescario-dev/clensy-platform/pull/144), head `947b9da`, base `main` (`61b6fb8`). It carries the spec amendment, this Accepted plan and the M6 change set (process spec §2.8).
- **Accepted specification:** `docs/superpowers/specs/2026-10-04-role-aware-typed-urls-design.md`, §4.3 amendment (#134).
- **Accepted implementation plan:** this document.
- **Review basis: an independent review.** Per `CLAUDE.md` (application-code slice), a fresh agent context on the most capable model, which did not implement the change, reviewed it. It was given the Accepted spec, the Accepted plan and the branch diff. This record is written by the implementer and cites that review.
- **M6 gate:** plan Accept `bb21c1a` is the direct parent of the first implementation commit `69a36ac`.
- **Plan tasks reviewed:**
  - Task 1, the `/app/admin/` trailing-slash row (`69a36ac`) ✓
  - Task 2, the home link through `Button asChild variant="link"` (`18c0f0f`) ✓

  Both match the plan text verbatim. No reordering, no skipped task, no extras; the diff touches only the File Map plus the spec and plan.
- **Spec conformance:** amended §4.1, §4.3, §6 and §9 ✓. No `className` on `Button` or `Link`; href, label and omission unchanged; heading, container, copy and gate rows byte-identical; `Button` imported from `@clensy/ui` (UI boundary held); billing, laundry and `@clensy/ui` untouched.
- **Verification evidence:**
  - The reviewer re-ran `pnpm --filter web test` (511/511), `tsc --noEmit` and `lint` (exit 0).
  - The reviewer reproduced the Task 1 mutation check (14 failed, 212 passed, restored) and the Task 2 RED state (3 failed with main's component). A second mutation dropping `asChild` also failed the same 3 tests, confirming that `expectButtonLink` catches a wrapping `<button>`.
  - CI run [37641998918](https://github.com/rexescario-dev/clensy-platform/actions/runs/37641998918) on `947b9da`: Lint, Test (repo-wide `pnpm run test`, covering `@clensy/ui` and `@clensy/web`) and Release gate passed. API e2e was pending at review time; it is unrelated to this web-only diff but must finish green before merge.
  - `pnpm --filter web build` was not re-run by the reviewer; the M6 record has it at exit 0.
- **Blocking findings:** none.
- **Non-blocking observations:** the accepted visual change (Button box, `text-primary`, hover-only underline) is verified only by the plan's optional manual smoke, which M6 did not perform. `expectButtonLink` doesn't assert `data-size="default"`, which the plan doesn't require.
- **Gate:** merge per human/project norms once API e2e is green.

### M8 — N/A (2026-10-07)

The change replaces one link's JSX with a three-line `Button` wrapper and adds two small test blocks. There's no duplication or complexity worth a behavior-preserving refactor, and risk would exceed benefit.

### M9 — Complete (2026-10-07)

**Documentation scope:** `apps/web/README.md` (the shell paragraph), the spec's Tracking issue cell, and this section.

**Content updates:**
- `apps/web/README.md`, shell paragraph: after the #132 heading sentence, one sentence says the home link is a `@clensy/ui` `Button` link rendered onto the `Link`, the convention for standalone shell actions, linking #134. Caused by Task 2 and amended spec §4.3.
- The spec's Tracking issue cell links PR #144 for the #134 amendment. Caused by the PR being opened.
- This section. Caused by the M7–M9 gate outcomes.

**Editorial changes:** none.

**Unchanged:** the #132 plan's Deferred section, which lists these two items. It's a historical record, and spec §11 now marks both resolved by #134.

**Verification:**
- Links in the spec, this plan and the README resolve (scripted scan).
- Status is consistent: the spec and its #134 amendment are Accepted, this plan is Accepted, and PR #144 is open.
- Terminology follows spec §3 and §4.3 (shell-hidden, unavailable state, shell-link convention).
- No heading changes, contradictions or stale references.

### M10 — Accepted, workflow validated (2026-10-07)

**Subject:** the installed workflow prompt library (`docs/workflows/`, generic 1.4.1 / claude 0.2.0), against `docs/workflows/specs/agent-workflow-design.md` §2.10. This slice ran it on #134 from M2 (a slice-local amendment) to M9.

**Asset inventory:** unchanged, and the branch diff against `main` for `docs/workflows/` and `workflow.yaml` is empty. Nine prompts (`specification`, `design-review`, `implementation-planning`, `plan-review`, `implementation-execution`, `code-review`, `refactoring`, `documentation-execution`, `workflow-validation`) map to M2–M10. `conventions/` holds M1 and the reporting conventions; the governing process spec is under `specs/`.

**Checks:**
- All nine prompts cite the governing contract. There are no orphan assets.
- All 61 relative links under `docs/workflows/` resolve, as do those in the #114 spec, this plan and `apps/web/README.md` (scripted scan).
- The slice-local amendment procedure (M2 prompt) was followed: the amendment was made in place with its own Draft → Accepted lifecycle against #134, the remainder stayed Accepted, the delta is stated, and §10 criterion 9 was added.
- §2.4 was honoured: amendment Accept `4c23e5c` is an ancestor of the M4 draft `95e5ae6`.
- §2.5 was honoured: plan Accept `bb21c1a` is the parent of the first implementation commit `69a36ac`.
- M5 returned one wording correction before Accept, applied at `bb21c1a`. M3 accepted on the first pass with an M4 condition, which the plan and M7 both honoured.
- M7 followed the project rule in `CLAUDE.md`: a fresh, independent reviewer for an application-code slice, cited in the record.
- Characterization tests (Task 1) carry uncommitted mutation evidence, as M6 step 3 requires; M7 reproduced it.
- Providers were honoured: GitHub for the issues (#134, and the split-out #143), branch and PR (`workflow.providers`).
- Slice Completion Reports were emitted at M6 and at M7–M9.
- §2.8 was honoured: one PR (#144) carries the amendment, plan, implementation and docs.

**Blocking findings:** none.

**Non-blocking observations:**
1. **Splitting a multi-item issue.** #134 bundled one architectural item with two bounded ones. Splitting the architectural item out to #143 before M2 kept the amendment slice-local. The workflow has no explicit step for that split; it was handled as an owner scope decision recorded on the issue, which worked without friction. No change to the workflow is suggested.
2. **M5 correction about package suites.** The plan's first wording justified skipping the `@clensy/ui` suite only by "no package changes", although the slice consumes `Button`. The accepted wording points to CI's repo-wide test run instead. Future plans that consume a shared component should cite the repository's validation policy in the same way.

### Post-merge evidence (2026-10-08, #151)

The optional visual check that M7 noted was not performed. It was run against the stack rebuilt from `main` (`docker compose up -d --build`), signed in as a throwaway dev `FINANCE` account created for this check, on `/app/customers`. A throwaway headless-Chromium script (`playwright-core`) ran it, with screenshots kept outside the repo:

- **At rest:** the home link is `text-primary` (near-black), with no underline. Its anchor carries `data-slot="button"` and `data-variant="link"`, and it is 32px tall (Button's default box).
- **Hover:** underlined.
- **Keyboard focus:** `:focus-visible` matches, and Button's focus ring is visible around the link.
- **Activation:** it navigates to `landingHref` (`/app/bookings`).

This matches the presentation that spec §4.3 accepted for #134.
