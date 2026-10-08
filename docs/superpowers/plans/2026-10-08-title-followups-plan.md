# #143/#134 Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Draft |
| M5 history | First pass (2026-10-08) returned three corrections, all applied without changing the approach: the M7 rationale now follows the `CLAUDE.md` risk rule, so a self-review is permitted for this test-and-docs slice (Final verification); the `createElement` detector is documented as deliberately failing closed on any `createElement('title', …)` call, React or not (Goal, Task 1 Step 2); the layout invariant is worded as "no additional Next-recognized layout source file", matching the matcher (Goal, Task 1 Step 3). Optional: the throwaway account's email is no longer named in the records (Task 2). |
| Date | 2026-10-08 |
| Tracking issue | [#151](https://github.com/rexescario-dev/clensy-platform/issues/151). Follow-up to [#143](https://github.com/rexescario-dev/clensy-platform/issues/143) (PR [#150](https://github.com/rexescario-dev/clensy-platform/pull/150)) and [#134](https://github.com/rexescario-dev/clensy-platform/issues/134) (PR [#144](https://github.com/rexescario-dev/clensy-platform/pull/144)). Program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81). |
| Scope | Test and documentation only: `apps/web/lib/web-shell-regressions.test.ts`; records in `docs/superpowers/specs/2026-10-04-role-aware-typed-urls-design.md`, `docs/superpowers/plans/2026-10-07-unavailable-link-trailing-slash-plan.md` and `docs/superpowers/plans/2026-10-08-app-document-titles-plan.md`. No production code. |
| Implements (Accepted) | [Page-Specific Document Titles for `/app` Pages — Design](../specs/2026-10-08-app-document-titles-design.md), Accepted: §5 invariant 2 ("no other `/app` source contributes a title") and §5 invariant 8 ("no layout file is added under `apps/web/app/app/`"). These invariants are unchanged; this plan adds regressions that pin them. No spec semantics change, so there is no M2/M3 stage. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins**. Helper and test names are planning decisions. |
| Edit anchors | Located by quoted code. Branch base `5d5fb6c` (`main`). |

**Goal:** Close the non-blocking findings of #143's M7 review and the open records:

1. **Non-JSX titles.** A regression fails if any non-test `apps/web` source calls `createElement('title', …)`, bare or as a member, or assigns `document.title`, including compound and element-access forms. Today only JSX `<title>` exists, in the gate. The `createElement` check is **deliberately syntactic and fails closed**: it flags *any* `x.createElement('title', …)`, whether or not `x` is React (for example `document.createElement('title')`). The invariant guards against any alternative way of producing a title, not only React's, so the check doesn't try to prove where the call comes from.
2. **Invariant 8.** A regression fails if any **additional Next-recognized layout source file** exists under `apps/web/app/app/`, that is, any file named `layout` with a JS/TS source extension (`.js`, `.jsx`, `.ts`, `.tsx`, and their `m`/`c` variants) other than `app/app/layout.tsx`. Files named `layout` with other extensions are not layouts to Next, and are out of scope.
3. **Records.**
   - The owner's acknowledgement of the clerical 10 → 11 renumbering of the #143 criterion in the role-aware typed-URL spec.
   - Post-merge evidence for #134 (the Button-link visual check) and for #143 (the cold-load transition into the unavailable state), recorded in their plans.

**Tech Stack:** Vitest, with the TypeScript compiler API already used by `web-shell-regressions.test.ts` (`parseSource`, `nonTestSources`).

**Pre-validation (full).** On 2026-10-08, Task 1 was applied verbatim at `5d5fb6c` and every `Expected:` command ran with the stated result. That covers GREEN, the five mutations and the read-only control, the full suite (22 files, 592), tsc and lint. The tree was then reverted. Task 2 is documentation. Its evidence was gathered on 2026-10-08 against the stack rebuilt from `main`'s #143 code (see Task 2).

## Global Constraints

- No production code changes. `git diff --stat main -- apps packages ':!apps/web/lib/web-shell-regressions.test.ts'` must be empty.
- The new tests are **characterization tests**: they pin existing, already-correct behavior and pass on first run. Each carries uncommitted mutation evidence (M6 step 3).
- Records state facts only; no Accepted contract changes.

---

## File Map

| File | Change | Task |
| --- | --- | --- |
| `apps/web/lib/web-shell-regressions.test.ts` | Import `basename`; add `setsTitleWithoutJsx`; add two tests to `document title ownership` | 1 |
| `docs/superpowers/specs/2026-10-04-role-aware-typed-urls-design.md` | Append the owner acknowledgement to the #143 M3 record | 2 |
| `docs/superpowers/plans/2026-10-07-unavailable-link-trailing-slash-plan.md` | Append a post-merge evidence section | 2 |
| `docs/superpowers/plans/2026-10-08-app-document-titles-plan.md` | Append a post-merge evidence and follow-ups section | 2 |

---

### Task 1: Non-JSX title and single-`/app`-layout regressions (titles spec §5 invariants 2 and 8)

**Files:** Modify `apps/web/lib/web-shell-regressions.test.ts`.

- [ ] **Step 1: Import `basename`.** Replace `import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';` with `import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';`.

- [ ] **Step 2: Add the detector.** Insert directly above `describe('document title ownership', () => {`:

```ts
// #151: a title set without JSX: `createElement('title', …)`, called bare or
// as a member, or an assignment to `document.title` (including compound and
// element-access forms). Deliberately syntactic and fail-closed: any
// `x.createElement('title', …)` counts, React or not (document.createElement
// included), since any alternative title producer breaks the one-owner rule.
function setsTitleWithoutJsx(source: ts.SourceFile): boolean {
  let found = false;
  const isDocumentTitle = (node: ts.Expression) =>
    (ts.isPropertyAccessExpression(node) && node.name.text === 'title' && ts.isIdentifier(node.expression) && node.expression.text === 'document') ||
    (ts.isElementAccessExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'document' &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      node.argumentExpression.text === 'title');
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
      const [first] = node.arguments;
      if (name === 'createElement' && first && ts.isStringLiteralLike(first) && first.text === 'title') found = true;
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
      node.operatorToken.kind <= ts.SyntaxKind.LastAssignment &&
      isDocumentTitle(node.left)
    ) {
      found = true;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

```

- [ ] **Step 3: Add the two tests.** Inside `describe('document title ownership', () => {`, insert directly above `  it('exports no metadata from any /app source, in any export form', () => {`:

```ts
  // #151: titles set without JSX would slip past the '<title' text scan.
  it('creates no title element and assigns no document.title outside JSX', () => {
    const offenders = sources()
      .filter(({ path, text }) => setsTitleWithoutJsx(parseSource(path, text)))
      .map(({ path }) => path);

    expect(offenders).toEqual([]);
  });

  // #151, document titles spec §5 invariant 8: no additional Next-recognized
  // layout source file (layout.{js,jsx,ts,tsx} and m/c variants) under /app.
  it('keeps app/app/layout.tsx the only layout under /app', () => {
    const layouts = sources()
      .filter(({ path }) => path.startsWith(`app${sep}app${sep}`) && /^layout\.(m|c)?[jt]sx?$/.test(basename(path)))
      .map(({ path }) => path);

    expect(layouts).toEqual([`app${sep}app${sep}layout.tsx`]);
  });

```

- [ ] **Step 4: Run it (characterization: passes on first run).**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: PASS, 196 tests (194 before plus the 2 new).

- [ ] **Step 5: Mutation checks (not committed).** For each, run the Step 4 command, check the result, then revert with `git checkout -- apps/web/app/app/jobs/page.tsx`, or `rm` for the new layout:
  - Append `import { createElement } from 'react';` and `export const t = () => createElement('title', null, 'x');` to `apps/web/app/app/jobs/page.tsx` → 1 failed (`creates no title element …`), 195 passed.
  - Append `import React from 'react';` and `export const t = () => React.createElement("title", null, 'x');` → the same single failure.
  - **Fail-closed (non-React):** append `export const t = () => document.createElement('title');` → the same single failure (pre-validated after the M5 first pass).
  - Append `export function setTitle() { document.title = 'x'; }` → the same single failure.
  - Append `export function setTitle() { document['title'] += 'x'; }` → the same single failure.
  - Create `apps/web/app/app/jobs/layout.tsx` containing `export default function L({ children }: { children: React.ReactNode }) { return children; }` → 1 failed (`keeps app/app/layout.tsx the only layout under /app`), 195 passed.
  - **Control:** append `export const read = () => document.title;` → PASS, 196 (reading isn't flagged).
  - Confirm `git status --short -- apps/web/app` is empty.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/lib/web-shell-regressions.test.ts
git commit -m "test(web): pin non-JSX title sources and the single /app layout (#151)"
```

### Task 2: Records

**Files:** the three docs in the File Map.

- [ ] **Step 1: Owner acknowledgement.** In `docs/superpowers/specs/2026-10-04-role-aware-typed-urls-design.md`, in the M3 decision row, replace the #143 record's final sentence `…including the visibility rule, the gate decision, the six rendering rows and their visible output, the unavailable state's heading, link and copy, and every earlier acceptance criterion.` with the same sentence followed by: ` *(#151)* The owner acknowledged, on 2026-10-08, that the #143 criterion was renumbered from 10 to 11 when merging with #131's amendment. The change is clerical, and the criterion's text and meaning are unchanged.`

- [ ] **Step 2: #134 post-merge evidence.** Append to `docs/superpowers/plans/2026-10-07-unavailable-link-trailing-slash-plan.md`:

```markdown

### Post-merge evidence (2026-10-08, #151)

The optional visual check that M7 noted was not performed. It was run against the stack rebuilt from `main` (`docker compose up -d --build`), signed in as a throwaway dev `FINANCE` account created for this check, on `/app/customers`. A throwaway headless-Chromium script (`playwright-core`) ran it, with screenshots kept outside the repo:

- **At rest:** the home link is `text-primary` (near-black), with no underline. Its anchor carries `data-slot="button"` and `data-variant="link"`, and it is 32px tall (Button's default box).
- **Hover:** underlined.
- **Keyboard focus:** `:focus-visible` matches, and Button's focus ring is visible around the link.
- **Activation:** it navigates to `landingHref` (`/app/bookings`).

This matches the presentation that spec §4.3 accepted for #134.
```

- [ ] **Step 3: #143 post-merge evidence and follow-ups.** Append to `docs/superpowers/plans/2026-10-08-app-document-titles-plan.md`:

```markdown

### Post-merge evidence and follow-ups (2026-10-08, #151)

- **Unavailable-state transition** (the optional part of Task 5 Step 2). It was recorded against the stack rebuilt from `main`, as a throwaway dev `FINANCE` account created for this check. On a cold load of `/app/customers`:
  - The server HTML had exactly one `<title>`: `Customers · Clensy` (the loading row).
  - Sampled `document.title` went `Customers · Clensy` → `Page unavailable · Clensy`.
  - The page then showed the unavailable `<h1>`, with exactly one `<title>` element.
  - The home link returned to `/app/bookings`, titled `Bookings · Clensy`.
- **Review gaps closed by #151:** regressions now fail on `createElement('title', …)` and on `document.title` assignments, and on any additional `layout.*` under `apps/web/app/app/` (spec §5 invariants 2 and 8).
- **Criterion renumbering:** the owner acknowledged it. It is recorded in the role-aware typed-URL spec's #143 M3 record.
```

- [ ] **Step 4: Commit.**

```bash
git add docs/superpowers/specs/2026-10-04-role-aware-typed-urls-design.md docs/superpowers/plans/2026-10-07-unavailable-link-trailing-slash-plan.md docs/superpowers/plans/2026-10-08-app-document-titles-plan.md
git commit -m "docs(151): record the renumbering acknowledgement and post-merge evidence"
```

## Final verification

| Command | Expected |
| --- | --- |
| `pnpm --filter web test` | PASS (22 files, 592 at pre-validation) |
| `pnpm --filter web exec tsc --noEmit` | exit 0 |
| `pnpm --filter web lint` | exit 0 |
| `git diff --stat main -- apps packages ':!apps/web/lib/web-shell-regressions.test.ts'` | empty |

M7 cites CI's repo-wide run. Under the `CLAUDE.md` M7 rule (risk-based), a fresh independent reviewer is required only for slices that change application code, authorization, tenant isolation, or schema/database. This slice changes only regression tests and documentation, so a **self-review is permitted**, and the M7 record MUST label it **self-review**. The owner may still request a fresh reviewer, which would override this.

## Traceability

| Source | Implemented by |
| --- | --- |
| Titles spec §5 invariant 2 (one title owner), #143 M7 observation (non-JSX titles) | Task 1 |
| Titles spec §5 invariant 8 (single `/app` layout), #143 M7 observation | Task 1 |
| #143 M7 observation (criterion renumbering) | Task 2 Step 1 |
| #134 M7 observation (visual check); titles spec §8 item 5 (optional transition) | Task 2 Steps 2–3 |

## Gate outcomes
