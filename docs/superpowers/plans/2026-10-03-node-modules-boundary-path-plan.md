# App i18n Boundary Guard: `node_modules/@clensy/web` Path Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Accepted |
| M5 decision | **Accepted** — 2026-10-03, by the owner, with two minor edits, both applied. (1) `passesThroughClensyWebLink` declares its `: boolean` return type. (2) Task 2 names its reference "`main` guard (pre-#122 amendment)" instead of "#120 guard", because the copy comes from `git show main:…`. Wording: Review Focus 5 now reads "The real tree must remain clean." To be executed natively. Carried-forward discipline: if the real repository contradicts a stated precondition or expected RED/GREEN state, stop and report rather than adapting the implementation. |
| Date | 2026-10-03 |
| Tracking issue | [#122](https://github.com/rexescario-dev/clensy-platform/issues/122), the #120 / PR #121 final-review follow-up |
| Scope | `apps/web/lib/web-shell-regressions.test.ts` only. No production code, package, CI or catalog change. |
| Implements (Accepted) | [Single App-Level `ClensyI18nProvider` — Design](../specs/2026-10-02-single-app-i18n-provider-design.md) §6.1 **Package boundary** item 3, as amended by #122. Status **Accepted** (M3, 2026-10-03, amendment at `e069965`). |
| Relies on (Accepted) | The #120 package-boundary implementation and its plan, [2026-10-03-boundary-guard-remaining-gaps-plan.md](2026-10-03-boundary-guard-remaining-gaps-plan.md). This plan reuses `specifierTarget`, `moduleSpecifierOf` and `boundaryViolations` unchanged, and changes only `isBoundaryViolation`'s return expression. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. Helper names, task grouping and test names are planning decisions. M3 constraint: implement item 3 mechanically, without broadening it. |
| Edit anchors | Every edit is located by the **quoted code**, not by line number. Line numbers are approximate, taken from `main` at `0cd53cb`. |
| Pre-validation | The code and every fixture expectation below were extracted from this plan's text and applied to a copy of the guard outside the repo. That copy was then checked with **every command this plan's `Expected:` lines name**: Vitest, `tsc` in strict mode, and ESLint with `apps/web`'s own config (this answers #120's M10 observation 1). All matched, and the RED state was confirmed. On the real `apps/web` tree the amended rule finds 0 violations. |


## Gate outcomes

**M6 (2026-10-03): Complete.** Tasks 1–2 were executed natively, in order and test-first:
- `2b0f73b`: Task 1
- Task 2 committed nothing.

The planned RED state occurred: exactly the 6 violation rows failed, each receiving `[]`. The 5 allowed rows passed before implementation. GREEN: the guard file passes 137/137, and the real tree has no violations. The final full web suite has 13 files and 230 tests passing, and `tsc --noEmit` and lint exit 0. Every `Expected:` line matched, and there were **no executor rulings**.

Task 2 demonstration (spec "Demonstration (#122)"): each guard run was separate, and every probe was removed only after `cmp`.

| Spec point | Probe | `main` guard (pre-#122 amendment) | Amended guard |
| --- | --- | --- | --- |
| 1–2 | the exact #122 mount, `'../../node_modules/@clensy/web'` | PASS (not reported) | FAIL: `has no package boundary violations…` lists `{ file: 'app/app/probe-link.tsx', specifiers: ['../../node_modules/@clensy/web'] }` |
| 3 | the `/src` form | PASS | FAIL: boundary lists `app/app/probe-link-src.tsx` |
| 4 | the lookalikes (`webkit`, `web-extra`, `ui`, `my_node_modules`) | PASS | PASS (still allowed) |

The `main` guard copy was removed after `cmp` against `git show main:…`. The tree is clean, and the diff against `main` outside `docs/` is the test file only.

Final whole-branch review: one fresh reviewer, independent of the executor. Result: 0 Critical, 0 Important, 1 Minor, ready to merge. The implementation conforms exactly to item 3, and the #117 and #120 code is byte-identical. The reviewer's extra probes confirmed whole-segment matching, any depth (including `.pnpm` and repo-root `node_modules`), and normalisation cases (`web/`, `./`, `//`, `web/../ui`).

**Deferred minor:** spec §6.1 item 3's sentence "a mount reached through such a path still counts no provider mount" has no provider-detector fixture. It is not required by "Fixtures (#122)", and its behaviour is correct today (0 mounts, 0 escapes, 1 boundary violation). Pinning it would be optional hardening.

**M7 (2026-10-03): Approved for merge.**
- Subject: PR [#123](https://github.com/rexescario-dev/clensy-platform/pull/123), head `3807ba0`. It carries the #122 §6.1 amendment, this Accepted plan and the M6 change set (§2.8).
- M6 gate: plan Accept `77a16b7` precedes the implementation commit `2b0f73b`.
- Plan tasks: Task 1 ✓, Task 2 ✓ (demonstration recorded under M6; nothing committed). Nothing is deferred or missing.
- Spec conformance: §6.1 package boundary item 3 ✓, with the segment rule, whole-segment matching, computed targets only, no symlink resolution, and load calls inherited. "Fixtures (#122)" and "Demonstration (#122)" points 1–4 ✓. The #117 and #120 code is byte-identical (confirmed by the independent reviewer).
- Scope: the only non-docs file changed is the test file. There are no plan deviations and no executor rulings.
- Verification evidence:
  - CI run [37095249116](https://github.com/rexescario-dev/clensy-platform/actions/runs/37095249116) on `3807ba0`: Lint, Test and Release gate all passed.
  - Locally, 13 files and 230 tests pass, and tsc and lint exit 0. The RED→GREEN evidence is in the M6 record.
  - The independent reviewer re-ran the guard (137/137), tsc and lint.
- Blocking findings: none.
- Non-blocking observation: the optional provider-detector fixture recorded under M6.
- This record was written by the implementer, based on the independent whole-branch review and CI. Merge per human/project norms.

**M8 (2026-10-03): N/A.**
- The change is one 6-line predicate and one extra disjunct, beside its sibling `isInsidePackagesWeb`, and every row of its fixtures is pinned.
- There is nothing worth restructuring.

**M9 (2026-10-03): Complete.** Documentation scope: `apps/web/README.md` § i18n, the spec's Tracking cell, and this section.
- Content updates:
  - `apps/web/README.md`, "Public entry point only": it now names the `node_modules/@clensy/web` path, and anything beneath it, as a failure. Caused by Task 1 and §6.1 package boundary item 3.
  - The spec's Tracking cell links PR #123. Caused by the PR being opened.
  - This section. Caused by the M7–M9 gate outcomes.
- Editorial changes: none.
- Unchanged: `packages/web/README.md`, `docs/README.md` (no index entries for these slices) and the earlier slice plans.
- Verification: the links resolve; status is consistent (the #122 amendment and this plan are Accepted, and the PR is open and green); the terminology matches spec §3; there are no heading changes and no contradictory sections.

**Goal:** Close #122's bypass, where `'../../node_modules/@clensy/web'` reaches `packages/web` through pnpm's workspace symlink. A computed target that contains the whole segments `node_modules`, `@clensy`, `web` becomes a package boundary violation.

**Architecture:** One new pure predicate, `passesThroughClensyWebLink(target)`, joins the existing `isInsidePackagesWeb(target)` inside `isBoundaryViolation`. Both run only on the target `specifierTarget` computes, which is `undefined` for bare specifiers. So every specifier form, the literal-only handling and the tree-wide zero-violation assertion from #120 apply unchanged.

**Tech Stack:** the TypeScript 5.9 compiler API, `node:path`, Vitest, ESLint, and `pnpm --filter web`.

**Spec:** `docs/superpowers/specs/2026-10-02-single-app-i18n-provider-design.md` (§6.1 Package boundary item 3, "Fixtures (#122)", "Demonstration (#122)")

## Global Constraints

Copied from the Accepted spec (§6.1 package boundary item 3). Every task implicitly includes these.

- Item 3 SHALL apply only to the target computed as in item 2: relative, absolute and `@/` specifiers, by the same path arithmetic. Bare specifiers (including `'node_modules/@clensy/web'`) SHALL NOT be matched.
- A target SHALL be a violation if it contains the consecutive whole path segments `node_modules`, `@clensy`, `web`, in any `node_modules` directory at any depth. That includes the directory itself and anything beneath it.
- Segments SHALL be compared whole, never as string prefixes:
  - `node_modules/@clensy/web` and `node_modules/@clensy/web/src` match;
  - `node_modules/@clensy/webkit`, `node_modules/@clensy/web-extra`, `node_modules/@clensy/ui` and `my_node_modules/@clensy/web` do not.
- There SHALL be no symlink resolution and no file-system lookup.
- No new invariant or assertion. Provider bindings, escape item 4, the dashboard shell and every other #117/#120 rule SHALL stay unchanged.
- No production code or package change.
- Commit messages use the repo's `type(122): …` style and carry **no** `Co-Authored-By` trailer and no "Generated with" line (owner's global instruction).

## Review Focus

Failure modes item 3 implies that a naïve implementation could miss, most likely first. Each one has a pinning test in the task named.

1. **Prefix matching.** `includes('node_modules/@clensy/web')` would flag `webkit` and `web-extra`, and `endsWith`-style checks would miss `/src`. Pinned in Task 1 by the four lookalike rows and the `/src` rows.
2. **The bare specifier is matched.** Matching on the raw specifier text, instead of on the computed target, would flag `'node_modules/@clensy/web'`. Pinned in Task 1 by the bare row, which must report `[]`.
3. **Only the top-level layout is matched.** Anchoring the check to `apps/web/node_modules` would miss `some/node_modules/@clensy/web`. Pinned in Task 1 by the nested rows.
4. **Load calls bypass item 3.** `require('../../node_modules/@clensy/web')` must be a violation through the existing specifier forms. Pinned in Task 1.
5. **The real tree must remain clean.** `eslint.config.mjs` contains the string `'node_modules/**'`, but only as an ignore glob, not a module specifier. The tree test must stay `[]`. Pinned by Task 1 Step 4.

## File Map

| File | Change | Responsibility |
| --- | --- | --- |
| `apps/web/lib/web-shell-regressions.test.ts` | Modify | A new `passesThroughClensyWebLink` beside `isInsidePackagesWeb`, the `isBoundaryViolation` return expression, and rows in the `package-boundary check` table |

---

### Task 1: The `node_modules/@clensy/web` segment rule

Implements §6.1 **Package boundary** item 3 and "Fixtures (#122)".

**Files:**
- Modify: `apps/web/lib/web-shell-regressions.test.ts`: the package-boundary helpers (`isInsidePackagesWeb`, `isBoundaryViolation`) and the `package-boundary check` table

**Interfaces:**
- Consumes: `specifierTarget`, `isInsidePackagesWeb` and `boundaryViolations` (from #120), all unchanged.
- Produces: `passesThroughClensyWebLink(target: string): boolean`.

- [ ] **Step 1: Write the failing tests**

In the `package-boundary check` table, directly after the row `['an @/ path into packages/web', "import { X } from '@/../../packages/web/src';", ['@/../../packages/web/src']],`, add:

```ts
      // Paths through a node_modules/@clensy/web link (item 3, #122). The
      // fixture is at apps/web/app/app, so `../../node_modules` is apps/web's.
      ['the node_modules/@clensy/web link', "import { ClensyI18nProvider as P } from '../../node_modules/@clensy/web';", ['../../node_modules/@clensy/web']],
      ['a path beneath the node_modules/@clensy/web link', "import x from '../../node_modules/@clensy/web/src';", ['../../node_modules/@clensy/web/src']],
      ['a nested node_modules/@clensy/web link', "import x from '../../some/node_modules/@clensy/web';", ['../../some/node_modules/@clensy/web']],
      ['a path beneath a nested link', "import x from '../../some/node_modules/@clensy/web/src/i18n';", ['../../some/node_modules/@clensy/web/src/i18n']],
      ['an @/ path to the link', "import x from '@/node_modules/@clensy/web';", ['@/node_modules/@clensy/web']],
      ['a require of the link', "const m = require('../../node_modules/@clensy/web');", ['../../node_modules/@clensy/web']],
```

Directly after the row `['another scoped package', "import { Button } from '@clensy/ui';\nimport x from '@clensy/webkit/y';", []],`, add:

```ts
      ['a node_modules/@clensy/webkit lookalike', "import x from '../../node_modules/@clensy/webkit';", []],
      ['a node_modules/@clensy/web-extra lookalike', "import x from '../../node_modules/@clensy/web-extra/src';", []],
      ['another package under node_modules/@clensy', "import x from '../../node_modules/@clensy/ui';", []],
      ['a my_node_modules lookalike', "import x from '../../my_node_modules/@clensy/web';", []],
      ['the bare node_modules/@clensy/web specifier', "import x from 'node_modules/@clensy/web';", []],
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: FAIL. Exactly the 6 new violation rows fail, each receiving `[]`:
- `reports the node_modules/@clensy/web link`
- `reports a path beneath the node_modules/@clensy/web link`
- `reports a nested node_modules/@clensy/web link`
- `reports a path beneath a nested link`
- `reports an @/ path to the link`
- `reports a require of the link`

The 5 new allowed rows already pass. They pin Review Focus 1–2 for Step 3. All other tests pass.

- [ ] **Step 3: Implement item 3**

Directly after the closing `}` of `function isInsidePackagesWeb(target: string) {`, add:

```ts
// §6.1 package boundary item 3 (#122): the consecutive whole segments
// node_modules / @clensy / web, in any node_modules at any depth. There is no
// symlink resolution: apps/web/node_modules/@clensy/web links to packages/web,
// but the segment sequence is forbidden as written. Whole segments, so
// `@clensy/webkit`, `@clensy/web-extra` and `my_node_modules` do not match.
function passesThroughClensyWebLink(target: string): boolean {
  const segments = target.split(sep);
  return segments.some(
    (segment, index) => segment === 'node_modules' && segments[index + 1] === '@clensy' && segments[index + 2] === 'web',
  );
}
```

In `isBoundaryViolation`, replace:

```ts
  return target !== undefined && isInsidePackagesWeb(target);
```

with:

```ts
  return target !== undefined && (isInsidePackagesWeb(target) || passesThroughClensyWebLink(target));
```

`specifierTarget` returns `undefined` for bare specifiers, so item 3 never sees them (Review Focus 2).

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: PASS, all tests. `has no package boundary violations anywhere in apps/web` still reports `[]`. No scanned file has a `node_modules` specifier; `eslint.config.mjs`'s `'node_modules/**'` is an ignore glob, not a specifier.

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/web-shell-regressions.test.ts
git commit -m "test(122): forbid node_modules/@clensy/web paths in apps/web"
```

---

### Task 2: Full verification and before/after demonstration

Implements spec "Demonstration (#122)". This task is a **demonstration**: the Accepted §6.1 is normative, pinned by Task 1's fixtures. **No files are committed in this task.** Every probe is written to a temporary directory first, copied into place, and removed only after `cmp` matches its reference copy. No tracked file is edited.

**Files:**
- Temporary only (removed in Step 4):
  - `apps/web/lib/pre-122-guard.test.ts`
  - `apps/web/app/app/probe-link.tsx`
  - `apps/web/app/app/probe-link-src.tsx`
  - `apps/web/app/app/probe-lookalikes.ts`

  None of these is a Next.js route file (`page`/`layout`), and all are removed before any commit.

- [ ] **Step 1: Full suite, type-check and lint on the clean branch**

Run: `pnpm --filter web test && pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: all pass, exit 0.

- [ ] **Step 2: Set up the `main` guard (pre-#122 amendment) and the probe directory**

Run: `git status --short && ls apps/web/lib/pre-122-guard.test.ts apps/web/app/app/probe-link.tsx apps/web/app/app/probe-link-src.tsx apps/web/app/app/probe-lookalikes.ts 2>&1 | grep -v 'No such file'`
Expected: no output. If anything is printed, stop and report it. Do not overwrite or delete it.

Run: `PROBE_DIR=$(mktemp -d) && echo "$PROBE_DIR"`
**Record the printed path.** Shell variables do not persist between executor calls, so the shell variable MUST NOT be used after this command. In every later step, `<PROBE_DIR>` means this recorded literal path and MUST be substituted before the command runs. An executor whose session provides a scratchpad directory may create the directory there instead (`mktemp -d -p <that directory>`).

Run: `git show main:apps/web/lib/web-shell-regressions.test.ts > apps/web/lib/pre-122-guard.test.ts`

This copy is `main`'s current guard, which is the **pre-#122-amendment** reference. The demonstration compares it with the amended guard; it does not assume `main` is any particular earlier slice's implementation.

- [ ] **Step 3: Probe against both guards**

For each probe below:
1. Write its content to `<PROBE_DIR>/<file name>`, then copy it into place with `cp`.
2. Run: `pnpm --filter web exec vitest run lib/pre-122-guard.test.ts -t "app i18n boundary structure"` and record the result.
3. Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts -t "app i18n boundary structure"` and record the result.
4. Remove it only after verifying it: `cmp "<PROBE_DIR>/<file name>" <probe path> && rm <probe path>`. If `cmp` reports a difference, stop and report it; do not delete the file.

Run each guard command on its own, so one command's exit status cannot skip the next (lesson from #120 Task 4).

| Spec point | Probe | Content | `main` guard (pre-#122 amendment) | Amended guard |
| --- | --- | --- | --- | --- |
| 1–2 | (a) The exact #122 mount | `app/app/probe-link.tsx`: `import { ClensyI18nProvider as P } from '../../node_modules/@clensy/web';\nexport const Probe = () => <P locale="en">x</P>;` | PASS (not reported) | FAIL: `has no package boundary violations…` lists `{ file: 'app/app/probe-link.tsx', specifiers: ['../../node_modules/@clensy/web'] }` |
| 3 | (b) The `/src` form | `app/app/probe-link-src.tsx`: `import { ClensyI18nProvider as P } from '../../node_modules/@clensy/web/src';\nexport const Probe = () => <P locale="en">x</P>;` | PASS | FAIL: boundary lists `app/app/probe-link-src.tsx` with `'../../node_modules/@clensy/web/src'` |
| 4 | (c) The lookalikes | `app/app/probe-lookalikes.ts`: `export * as a from '../../node_modules/@clensy/webkit';\nexport * as b from '../../node_modules/@clensy/web-extra';\nexport * as c from '../../node_modules/@clensy/ui';\nexport * as d from '../../my_node_modules/@clensy/web';` | PASS | PASS (still allowed) |

If any cell differs from the table, stop and report it. Do not change a fixture, the guard or the implementation just to reproduce the table. The table is demonstrative; the Accepted §6.1 is normative.

- [ ] **Step 4: Clean up and confirm the tree**

Run: `ls apps/web/app/app/probe-link.tsx apps/web/app/app/probe-link-src.tsx apps/web/app/app/probe-lookalikes.ts 2>&1 | grep -v 'No such file'`
Expected: no output (every probe is already gone). If anything is printed, stop and report it; do not delete it.

Run: `git show main:apps/web/lib/web-shell-regressions.test.ts | cmp - apps/web/lib/pre-122-guard.test.ts && rm apps/web/lib/pre-122-guard.test.ts`
Expected: no output, and the guard copy is removed. If `cmp` reports a difference, stop and report it.

Run, substituting the recorded literal path: `rm -r "<PROBE_DIR>" && git status --short`
Expected: no output (clean tree).

Run: `git diff --stat main -- apps packages .github`
Expected: only `apps/web/lib/web-shell-regressions.test.ts` changed.

- [ ] **Step 5: Record the outcome**

Record the filled-in Step 3 table in the M6 Slice Completion Report and the PR description. There is no commit for this task.

---

## Traceability

| Spec requirement (§6.1 package boundary item 3, #122) | Task |
| --- | --- |
| Segment sequence `node_modules`, `@clensy`, `web`: the directory itself and anything beneath it | 1 (link row and the `/src` rows) |
| Any `node_modules` at any depth | 1 (nested rows) |
| Computed relative, absolute and `@/` targets only; bare specifier untouched | 1 (`@/` row; bare row expects `[]`; `specifierTarget` unchanged) |
| Whole-segment matching: `webkit`, `web-extra`, `ui`, `my_node_modules` allowed | 1 (four lookalike rows) |
| No symlink resolution or file-system lookup | 1 (pure `split(sep)` predicate) |
| Load calls inherit item 3 | 1 (`require` row) |
| Provider bindings and all other #117/#120 rules unchanged | No task edits them; `isBoundaryViolation` only gains a disjunct |
| No new invariant or assertion | No new tree test; the existing zero-violation test covers item 3 |
| Fixtures (#122) | 1 |
| Demonstration (#122), points 1–4 | 2 |
| No production or package change | 2 Step 4 |
