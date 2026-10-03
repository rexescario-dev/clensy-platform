# App i18n Boundary Guard: Remaining Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Accepted |
| M5 decision | **Accepted** — 2026-10-03, round 3, at `fc4f491`, by the owner. To be executed natively, task by task (Task 1 → Task 2 → Task 3 → Task 4). Carried-forward discipline: if the real repository contradicts any of the plan's stated preconditions or fixture expectations, stop rather than adapting the implementation to make the plan pass. **Round 2 (Changes Requested):** Three minor fixes, all applied. (1) `isLoadCall` is pinned to TypeScript 5.9.3's AST: dynamic `import(…)` is a `CallExpression` whose `expression` has kind `SyntaxKind.ImportKeyword`, and `require(…)` has an `Identifier` callee spelled `require`. Task 1 Step 3 states this, and the existing executed fixture rows (`import('@clensy/web')` → 1, `require('@clensy/web')` → 1, `require.resolve('@clensy/web')` → 0) are named in Step 4 as the pins. (2) The Task 3 fixture `an unimported literal tag (fails closed)` is renamed `a literal DashboardLayout tag without an import`, because literal spelling is recognised by rule, not by failing closed. The traceability row now states the literal-versus-binding distinction. (3) Task 4 deletes nothing it has not verified: each probe is written to `<PROBE_DIR>` first and copied into place, and it is removed only after `cmp` matches that copy. The `main` guard copy is removed only after `cmp` against `git show main:…`; a mismatch means stop and report. **Round 1 (Changes Requested):** Two fixes, both applied. (1) Task 4 no longer relies on `$PROBE_DIR` surviving between executor calls: Step 2 records the printed temporary directory, and every later command, including the `cmp` recovery, uses that recorded literal path, written `<PROBE_DIR>`. (2) `moduleSpecifierOf()`'s comment now ties each accepted syntax to its AST node: `ImportDeclaration` covers both normal and `import type` declarations, and `ImportTypeNode` covers type-position `import('…')`. The implementation is unchanged. Step 4 also restates the stop-don't-delete rule for unexpected probe content. |
| Date | 2026-10-03 |
| Tracking issue | [#120](https://github.com/rexescario-dev/clensy-platform/issues/120), the #117 / PR #119 final-review follow-ups |
| Scope | `apps/web/lib/web-shell-regressions.test.ts` only. No production code, package (no `exports` map), CI or catalog change. |
| Implements (Accepted) | [Single App-Level `ClensyI18nProvider` — Design](../specs/2026-10-02-single-app-i18n-provider-design.md) §3 (**package boundary violation**, **dashboard shell element**) and §6.1 as amended by #120. Status **Accepted** (M3, 2026-10-03, amendment at `3b2197c`). |
| Relies on (Accepted) | The #117 amendment of the same §6.1 and its plan, [2026-10-03-i18n-boundary-guard-hardening-plan.md](2026-10-03-i18n-boundary-guard-hardening-plan.md). This plan builds on that plan's helpers (`parseSource`, `nonTestSources`, `providerUses`, `wrapsDashboardInBoundary`) and changes none of their accepted behaviour, except that `providerUses` gains escape item 4. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. Helper names, file layout, task grouping, order and test names are planning decisions, not product semantics. M3 constraint: translate the invariants without weakening or broadening them. |
| Edit anchors | Every edit is located by the **quoted code**, not by line number. Line numbers are approximate, taken from `main` at `8d70e1b`. |
| Pre-validation | The helper code and every fixture expectation below were extracted from this plan's text, type-checked in strict mode, and run against TypeScript 5.9.3 in a throwaway harness outside the repo. All matched. On the real `apps/web` tree the new rules find 0 package boundary violations, 0 load-call escapes and exactly one dashboard shell element (`app/app/layout.tsx`). |


## Gate outcomes

**M6 (2026-10-03): Complete.** Tasks 1–4 were executed natively, in order and test-first:
- `eac1710`: Task 1
- `abec32c`: Task 2
- `ec603cf`: Task 3
- Task 4 committed nothing.

The planned RED states all occurred:
- Task 1: exactly the 8 planned rows received `{ escapes: 0 }` instead of 1.
- Task 2: the 21 boundary cases and the tree test failed with `boundaryViolations is not defined`.
- Task 3: the 8 shell cases and the tree test failed with `dashboardShellElements is not defined`. The characterisation row passed, as planned.

The `isLoadCall` AST pin rows pass. The final full web suite has 13 files and 219 tests passing, and `tsc --noEmit` and lint exit 0.

Task 4 demonstration: each bypass passes the #117 guard (on `main`) and fails the amended one.

| Probe | #117 guard | Amended guard |
| --- | --- | --- |
| (a) deep `@clensy/web/src` mount | PASS | FAIL: `has no package boundary violations…` lists `{ file: 'components/probe-deep.tsx', specifiers: ['@clensy/web/src'] }` |
| (b) `../../../packages/web/src` import | PASS | FAIL: boundary lists `components/probe-relative.tsx` |
| (c) `import('@clensy/web')` | PASS | FAIL: `has no provider escapes…` lists `{ file: 'lib/probe-load.ts', count: 1 }` |
| (d) a second shell in another file | PASS | FAIL: the shell test also lists `components/probe-shell.tsx` |
| (e) a conditional-branch shell in the layout | PASS | FAIL: the shell test reports `app/app/layout.tsx` with count 2; layout wiring still passes |

Every probe was removed only after `cmp` against its reference copy, and the `main` guard copy only after `cmp` against `git show main:…`. The layout is byte-identical. The diff against `main` outside `docs/` is the test file only.

Executor rulings:
1. **Task 1:** the plan's return type `ts.StringLiteral | ts.NoSubstitutionTemplateLiteral` failed the repo's `@typescript-eslint/sort-type-constituents` lint rule. The plan's pre-validation ran Vitest and tsc, but not ESLint. It was reordered to `ts.NoSubstitutionTemplateLiteral | ts.StringLiteral`, which is the identical type, so no semantics or fixtures changed. The final reviewer accepted this ruling.
2. **Task 4:** the first probe pass chained the guard runs with `&&`, and a `grep` exit status skipped the amended run for probes (a) and (b). That was a harness bug, not a guard result. Both probes were `cmp`-verified, removed and re-run; the table shows the re-run.

Final whole-branch review: one fresh reviewer, independent of the executor. Result: 0 Critical, 0 Important, 2 Minor, ready to merge. The reviewer ran about 60 extra probes outside the repo and found the implementation neither broader nor narrower than the amended §6.1.

**Spec-level gap for a follow-up** (the code stands, because closing it would broaden the Accepted §6.1, which M3 and M5 forbid): `'../../node_modules/@clensy/web'`, a pnpm symlink to `packages/web`, gets past the provider and boundary checks. §6.1 computes targets with plain path arithmetic against `<repo>/packages/web`, with no file-system lookup. The reviewer suggested this amendment: treat a relative, absolute or `@/` target that has a `node_modules` segment followed by `@clensy/web` as a violation.

**M7 (2026-10-03): Approved for merge.**
- Subject: PR [#121](https://github.com/rexescario-dev/clensy-platform/pull/121), head `3b7cad8`. It carries the #120 §6.1 amendment, this Accepted plan and the M6 change set, as process spec §2.8 requires.
- M6 gate: implementation started only after M5 Accept. Plan Accept is `0a1cedf`, and the first implementation commit, `eac1710`, follows it.
- Plan tasks: Task 1 ✓, Task 2 ✓, Task 3 ✓, Task 4 ✓ (demonstration recorded under M6; nothing committed). Nothing is deferred or missing, and there is no incremental delivery.
- Spec conformance:
  - §3 terms ✓ ("package boundary violation", "dashboard shell element").
  - §6.1 as amended by #120 ✓: escape item 4 (exact-package `require`/`import()`/import-equals, plus non-literal or missing specifiers); package boundary (every specifier form, deep `@clensy/web/…`, relative, absolute and `@/` targets by path arithmetic, segment-wise containment, bare package and lookalikes allowed, zero-violation assertion); dashboard shell (recognition, tree-wide count of one in `app/app/layout.tsx`, placement via the unchanged layout wiring); and the #120 fixture list.
  - The #117 behaviour is unchanged.
  - The independent reviewer found nothing broader or narrower than the amendment, which honours the M3 constraint.
- Scope: the only non-docs file changed is `apps/web/lib/web-shell-regressions.test.ts`. There are no production, package (`exports` map), CI or dependency changes.
- Plan deviation: one, the Task 1 union reorder required by lint. It is the identical type, it is recorded under M6, the reviewer accepted it, and it is disclosed in the PR description.
- Verification evidence:
  - CI run [37092218743](https://github.com/rexescario-dev/clensy-platform/actions/runs/37092218743) on `3b7cad8`: Lint, Test and Release gate all passed.
  - Locally, `pnpm --filter web test` passed (13 files, 219 tests), and tsc and lint exited 0.
  - TDD RED→GREEN evidence for Tasks 1–3 and the five before/after probes are in the M6 record.
  - The independent reviewer re-ran the guard (126/126) and lint, and ran about 60 extra probes outside the repo.
- Blocking findings: none.
- Non-blocking observation: the `node_modules/@clensy/web` symlink path is a spec-level gap for a follow-up (see M6). It does not affect the merge decision.
- This record was written by the implementer, based on the independent whole-branch review and the CI evidence (as for #117). Merge per human/project norms.

**M8 (2026-10-03): N/A.**
- Scope: the #120 change set, `apps/web/lib/web-shell-regressions.test.ts`.
- The three new checks are independent and each does one thing: `loadCallEscapes`, `boundaryViolations` (with `moduleSpecifierOf`, `specifierTarget`, `isInsidePackagesWeb` and `isBoundaryViolation`), and `dashboardShellElements`. Each is pinned by inline fixtures and its own tree test.
- `dashboardShellElements` and #117's `namedImportLocal` both read named imports, but with different semantics: imports from any module versus one exact path. Merging them would add a parameterised abstraction for no gain.
- As at #115 and #117, the helpers stay next to their only test. Moving them into `lib/` would put them in the tree the guard scans.
- No behaviour-preserving restructuring is worth its risk.

**M9 (2026-10-03): Complete.** Documentation scope: `apps/web/README.md` § i18n, the spec's Tracking cell, and this section.
- Content updates:
  - `apps/web/README.md`, "No local providers": the closing sentence claimed the guard "covers only `import … from '@clensy/web'`", which #120 made false. It now describes load-call escapes. Caused by Task 1 and §6.1 escape item 4.
  - `apps/web/README.md`: new "Public entry point only" and "One dashboard shell" bullets, plus a line stating the syntactic, no-module-resolution scope. Caused by Tasks 2–3 and the §6.1 package boundary and dashboard shell invariants.
  - The spec's Tracking cell links PR #121. Caused by the PR being opened.
  - This section. Caused by the M7–M9 gate outcomes.
- Editorial changes: none.
- Unchanged:
  - `packages/web/README.md`: says nothing about the guard.
  - `docs/README.md`: #115 and #117 have no index entry.
  - The #117 plan: left as the record of its own slice.
- Verification:
  - Links: the PR, issue and spec links resolve.
  - Status consistency: the #120 amendment and this plan are both Accepted, and the PR is open and green.
  - Terminology: "provider escape", "package boundary" and "app i18n boundary" are used as defined in spec §3.
  - No heading changes. No contradictory sections remain; the README's former "covers only…" claim is removed. No code or contract edits.

**M10 (2026-10-03): Accepted (workflow validated).** Subject: the installed workflow prompt library (`docs/workflows/`, generic 1.2.0), validated against `docs/workflows/specs/agent-workflow-design.md` §2.10. This slice ran the workflow on #120 from M2 to M9.

Asset inventory: unchanged from #117. There are nine prompts (M2–M10), `conventions/` (`prompt-library` M1, `reporting-conventions` §2.11) and the governing `specs/agent-workflow-design.md`.

Checks:
- All 9 prompts cite the governing contract. There are no orphan assets.
- Every relative link under `docs/workflows/` resolves (scripted scan).
- The M5→M6 hard prerequisite (§2.5) was honoured: plan Accept `0a1cedf` is an ancestor of the first implementation commit `eac1710`.
- The provider rule (`prompt-library.md` §12) was honoured: GitHub for the issue, the branch and the PR.
- Slice Completion Reports were emitted at M6 and at M7–M9.

Blocking findings: none.

Non-blocking observations:
1. **Plan pre-validation versus M6 "Expected" lines.** The M4 prompt does not say which checks a plan's pre-validation must cover. This plan was pre-validated with Vitest and tsc but not ESLint, so a lint-only deviation surfaced at M6 and was resolved by an executor ruling, which the reviewer accepted. A future M4 pre-validation would be stronger if it ran every command the plan's `Expected:` lines name.
2. **Carried forward from #117:**
   - The amendment of an already-Accepted spec has no written procedure; this slice again followed the in-place Draft→Accepted amendment precedent.
   - M10 has no conventional report location.
   - M7 reviewer independence is unspecified.
   - The order of the §2.12 merge and M10 is unstated. This slice again ran M10 before the human-authorized merge.

**Goal:** Close the three bypasses left by #117: deep or `packages/web` module specifiers, package load calls (`require`, `import()` and import-equals), and a second `DashboardLayout` shell. This implements the #120 amendment of spec §6.1 in the existing structural test.

**Architecture:** Three independent, syntactic checks sit beside the #117 helpers.
- `providerUses` gains one counter, `loadCallEscapes`, for escape item 4.
- `boundaryViolations(fileName, text)` lists every literal module specifier, in every form, that reaches `@clensy/web/…` or `packages/web`. Paths are computed with `node:path` arithmetic only.
- `dashboardShellElements(fileName, text)` counts JSX elements recognised as `DashboardLayout`.

Each check has inline fixtures and its own tree-wide assertion.

**Tech Stack:** the TypeScript 5.9 compiler API (`ts.createSourceFile` only), `node:path`, Vitest, and `pnpm --filter web`.

**Spec:** `docs/superpowers/specs/2026-10-02-single-app-i18n-provider-design.md` (§3, §6.1)

## Global Constraints

Copied from the Accepted spec (§6.1 as amended by #117 and #120). Every task implicitly includes these.

- The guard SHALL stay syntactic: the TypeScript parser plus `node:path` arithmetic. There SHALL be no type checker, no module resolution, no file-system lookup of import targets, no extension or index probing, and no `package.json` reading.
- **Escape item 4** SHALL count, one each:
  - a `require` call (callee identifier spelled `require`) or a dynamic `import(…)` call whose first argument is the literal `'@clensy/web'`;
  - `import X = require('@clensy/web')`;
  - any `require(…)` or `import(…)` call whose first argument is missing or is not a literal specifier.

  A literal specifier is a string literal, or a template literal with no substitutions.
- A load call whose literal specifier is deep or points into `packages/web` SHALL be a boundary violation, not an escape.
- **Package boundary:** every literal module specifier SHALL be checked, in all of these forms: `import` and `import type` declarations, `export … from` (including `export type`), import-equals `require`, `require(…)`, `import(…)`, and import type nodes. A specifier SHALL be a violation when:
  - it starts with `@clensy/web/`, or
  - its relative, absolute or `@/` target is `<repo>/packages/web` or inside it, compared segment by segment.

  Bare `@clensy/web` SHALL NOT be a violation, and neither SHALL other bare package names. Each violating specifier is one violation. `apps/web` SHALL have **zero**.
- **Dashboard shell:**
  - **Recognition:** a JSX opening or self-closing element whose tag name is literally `DashboardLayout`, or is a local name bound by a named import whose imported name is `DashboardLayout`, from any module.
  - **Placement:** exactly **one** such element across `apps/web`, in `app/app/layout.tsx`, and it SHALL be the element that Layout wiring finds as the provider's direct child.
  - `DashboardLayout` SHALL NOT get escape rules.
- Every #117 assertion and fixture stays as it is. The binding-aware Layout wiring check SHALL NOT change.
- The absolute-path fixture SHALL be built from the repository root at test time, never hard-coded to a machine path.
- No production code or package change.
- Commit messages use the repo's `type(120): …` style and carry **no** `Co-Authored-By` trailer and no "Generated with" line (owner's global instruction).

## Review Focus

Failure modes the amendment implies that a naïve implementation could miss, most likely first. Each one has a pinning test in the task named.

1. **Lookalike paths are flagged.** A string prefix test would flag `../packages/webby`, `my-packages/web` or `packages-web.ts`. The comparison must go segment by segment on resolved paths. Pinned in Task 2 with lookalike rows that must report `[]`.
2. **A deep load call is counted twice, or not at all.** `require('@clensy/web/src')` must be a boundary violation and must not be an escape. Pinned in Task 1 (escape table row: 0 escapes) and Task 2 (boundary table row: 1 violation).
3. **Calls that only look like loads are counted.** `require.resolve('@clensy/web')`, `require('node:path')` and `import('./page')` are not escapes. Pinned in Task 1.
4. **The conditional-branch shell passes.** `cond ? <DashboardLayout/> : <AppI18nProvider><DashboardLayout/></AppI18nProvider>` satisfies Layout wiring, which sees exactly one provider with one direct child, so only the new tree-wide count catches it. Pinned in Task 3 by a layout-wiring row that still returns `true` and a shell-count row that returns 2.
5. **Type-only access is missed.** `type T = import('@clensy/web/src').X` and `export type { X } from '@clensy/web/src'` load nothing at runtime, but they are still violations (confirmed at M3). Pinned in Task 2.

## File Map

| File | Change | Responsibility |
| --- | --- | --- |
| `apps/web/lib/web-shell-regressions.test.ts` | Modify | The `node:path` import, the §6.1 helper section (new helpers beside the #117 ones) and the `app i18n boundary structure` describe block |

---

### Task 1: Package load calls (escape item 4)

Implements §6.1 **Provider escapes** item 4.

**Files:**
- Modify: `apps/web/lib/web-shell-regressions.test.ts`: the helper section (new helpers before `packageReExportEscapes`), the `visit` function in `providerUses`, and the `provider-use detector` table

**Interfaces:**
- Consumes: `providerUses(fileName, text)` and `parseSource` (from #117).
- Produces:
  - `isLiteralSpecifier(node: ts.Node | undefined): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral`
  - `isLoadCall(node: ts.Node): node is ts.CallExpression`

  Task 2 consumes both.

- [ ] **Step 1: Write the failing tests**

In the `provider-use detector` table, directly after the row `['a nested namespace import-equals', 'fixture.ts', `${NAMESPACE}import X = W.Foo.Bar;`, 0, 1],`, add:

```ts
      // Package load calls (item 4, #120).
      ['a require of the package', 'fixture.js', "const { ClensyI18nProvider: P } = require('@clensy/web');", 0, 1],
      ['a dynamic import of the package', 'fixture.ts', "const m = await import('@clensy/web');", 0, 1],
      ['a template-literal require of the package', 'fixture.js', 'const m = require(`@clensy/web`);', 0, 1],
      ['an import-equals require of the package', 'fixture.ts', "import W = require('@clensy/web');", 0, 1],
      ['a non-literal require', 'fixture.js', "const name = '@clensy/web';\nconst m = require(name);", 0, 1],
      ['a non-literal dynamic import', 'fixture.ts', "const name = '@clensy/web';\nconst m = await import(name);", 0, 1],
      ['a template literal with a substitution', 'fixture.ts', 'const pkg = "web";\nconst m = await import(`@clensy/${pkg}`);', 0, 1],
      ['a require with no argument', 'fixture.js', 'require();', 0, 1],
      ['a require of another module', 'fixture.js', "const path = require('node:path');", 0, 0],
      ['a dynamic import of another module', 'fixture.ts', "const page = await import('./page');", 0, 0],
      ['require.resolve of the package', 'fixture.js', "const where = require.resolve('@clensy/web');", 0, 0],
      ['a deep load call (a boundary violation, not an escape)', 'fixture.js', "const m = require('@clensy/web/src');", 0, 0],
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: FAIL. Exactly 8 new rows fail, each receiving `{ mounts: 0, escapes: 0 }` instead of `{ mounts: 0, escapes: 1 }`:
- `a require of the package`
- `a dynamic import of the package`
- `a template-literal require of the package`
- `an import-equals require of the package`
- `a non-literal require`
- `a non-literal dynamic import`
- `a template literal with a substitution`
- `a require with no argument`

The four new zero-escape rows and all other tests pass.

- [ ] **Step 3: Implement escape item 4**

Directly before `function packageReExportEscapes(declaration: ts.ExportDeclaration) {`, add:

```ts
// §6.1: a literal module specifier is a string literal, or a template literal
// with no substitutions.
function isLiteralSpecifier(node: ts.Node | undefined): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return node !== undefined && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node));
}

// A `require(…)` call (callee spelled `require`, no scope analysis) or a
// dynamic `import(…)` call. In the TypeScript 5.9 AST, `import(…)` is a
// CallExpression whose `expression` has kind SyntaxKind.ImportKeyword.
// `require.resolve(…)` has a PropertyAccessExpression callee, so it is not a load.
function isLoadCall(node: ts.Node): node is ts.CallExpression {
  return (
    ts.isCallExpression(node) &&
    (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
  );
}

// §6.1 escape item 4 (#120): loading the package can destructure or alias the
// provider under any name, so the load itself is the escape. A load the guard
// cannot read (non-literal or missing specifier) fails closed. Deep and
// packages/web specifiers are boundary violations instead.
function loadCallEscapes(node: ts.Node) {
  if (isLoadCall(node)) {
    const [specifier] = node.arguments;
    if (!isLiteralSpecifier(specifier)) return 1;
    return specifier.text === '@clensy/web' ? 1 : 0;
  }
  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
    const { expression } = node.moduleReference;
    return isLiteralSpecifier(expression) && expression.text === '@clensy/web' ? 1 : 0;
  }
  return 0;
}
```

`isLoadCall` MUST recognise TypeScript 5.9.3's AST form of dynamic `import(…)` (a `CallExpression` whose `expression.kind` is `ts.SyntaxKind.ImportKeyword`), as well as an identifier-spelled `require(…)` callee. `require.resolve(…)` MUST stay excluded, because its callee is a `PropertyAccessExpression`. Step 4's executed fixture rows pin all three.

In `providerUses`, replace:

```ts
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && isProviderTag(node.tagName)) mounts += 1;
```

with:

```ts
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && isProviderTag(node.tagName)) mounts += 1;
    escapes += loadCallEscapes(node);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: PASS, all tests. The AST pins for `isLoadCall` are these executed rows:
- `counts a dynamic import of the package correctly`: `{ mounts: 0, escapes: 1 }`;
- `counts a require of the package correctly`: `{ mounts: 0, escapes: 1 }`;
- `counts require.resolve of the package correctly`: `{ mounts: 0, escapes: 0 }`.

`has no provider escapes anywhere in apps/web` still passes, because no scanned file uses `require` or `import()`.

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/web-shell-regressions.test.ts
git commit -m "test(120): count package load calls as provider escapes"
```

---

### Task 2: Package boundary

Implements §6.1 **Package boundary** and its zero-violation assertion.

**Files:**
- Modify: `apps/web/lib/web-shell-regressions.test.ts`:
  - the `node:path` import;
  - the helper section (new helpers before `function nonTestSources`);
  - the `app i18n boundary structure` describe block (a new describe after `provider-use detector`, and a new tree test after `has no provider escapes anywhere in apps/web`).

**Interfaces:**
- Consumes: `isLiteralSpecifier`, `isLoadCall` (Task 1); `parseSource`, `nonTestSources`, `webRoot`.
- Produces: `boundaryViolations(fileName: string, text: string): string[]`. It returns the violating specifier texts in source order. `fileName` must be absolute for relative specifiers to resolve correctly.

- [ ] **Step 1: Write the failing tests**

Directly after the closing `  });` of `describe('provider-use detector', …)`, add:

```ts
  describe('package-boundary check', () => {
    // A fixture at apps/web/app/app/fixture.tsx: four `..` segments reach the repository root.
    const FIXTURE = resolve(webRoot, 'app/app/fixture.tsx');
    const INTO_PACKAGE = JSON.stringify(resolve(webRoot, '../../packages/web/src/index.ts'));

    it.each([
      // Deep @clensy/web specifiers, one per form (§6.1 Package boundary, #120).
      ['an import', "import { ClensyI18nProvider as P } from '@clensy/web/src';", ['@clensy/web/src']],
      ['an import type', "import type { ClensyMessages } from '@clensy/web/src/i18n';", ['@clensy/web/src/i18n']],
      ['an export-from', "export { ClensyI18nProvider } from '@clensy/web/src';", ['@clensy/web/src']],
      ['an export type-from', "export type { ClensyMessages } from '@clensy/web/src';", ['@clensy/web/src']],
      ['an import-equals require', "import W = require('@clensy/web/src');", ['@clensy/web/src']],
      ['a require', "const m = require('@clensy/web/src');", ['@clensy/web/src']],
      ['a dynamic import', "const m = await import('@clensy/web/src');", ['@clensy/web/src']],
      ['an import type node', "type T = import('@clensy/web/src').ClensyMessages;", ['@clensy/web/src']],
      ['a template-literal require', 'const m = require(`@clensy/web/src`);', ['@clensy/web/src']],
      // Paths into packages/web.
      ['a relative path into packages/web', "import { X } from '../../../../packages/web/src/i18n/i18n-context';", ['../../../../packages/web/src/i18n/i18n-context']],
      ['a relative path to the packages/web directory itself', "import X from '../../../../packages/web';", ['../../../../packages/web']],
      ['an absolute path into packages/web', `import { X } from ${INTO_PACKAGE};`, [JSON.parse(INTO_PACKAGE)]],
      ['an @/ path into packages/web', "import { X } from '@/../../packages/web/src';", ['@/../../packages/web/src']],
      ['two violations in one file', "import a from '@clensy/web/a';\nimport b from '@clensy/web/b';", ['@clensy/web/a', '@clensy/web/b']],
      // Allowed.
      ['the bare package', "import { ClensyI18nProvider } from '@clensy/web';\nconst m = require('@clensy/web');", []],
      ['a relative path inside apps/web', "import { DashboardLayout } from '../../components/layout/dashboard-layout';", []],
      ['a my-packages/web lookalike', "import x from '../../../../my-packages/web/src';", []],
      ['a packages/webby lookalike', "import x from '../../../../packages/webby/src';", []],
      ['a packages-web file name', "import x from './packages-web';", []],
      ['another scoped package', "import { Button } from '@clensy/ui';\nimport x from '@clensy/webkit/y';", []],
      ['a non-literal load (an escape, not a violation)', 'const m = await import(name);', []],
    ])('reports %s', (_label, source, expected) => {
      expect(boundaryViolations(FIXTURE, source)).toEqual(expected);
    });
  });
```

Directly after the whole `it('has no provider escapes anywhere in apps/web', …)` block, add:

```ts
  // §6.1 package boundary (#120): zero violations anywhere, independent of the
  // provider assertions.
  it('has no package boundary violations anywhere in apps/web', () => {
    const violations = nonTestSources(webRoot)
      .map((path) => ({ file: relative(webRoot, path), specifiers: boundaryViolations(path, readFileSync(path, 'utf8')) }))
      .filter(({ specifiers }) => specifiers.length > 0);

    expect(violations).toEqual([]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: FAIL. Every `package-boundary check` case (21) and `has no package boundary violations…` fail with `ReferenceError: boundaryViolations is not defined`. All other tests pass.

- [ ] **Step 3: Implement the package boundary**

Replace:

```ts
import { relative, resolve } from 'node:path';
```

with:

```ts
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
```

Directly before `function nonTestSources(dir: string): string[] {`, add:

```ts
// §6.1 package boundary (#120): plain path arithmetic only. No module
// resolution, file-system lookup, extension or index probing, or package.json.
const packagesWebRoot = resolve(webRoot, '../../packages/web');

// Segment-by-segment containment, so `packages/webby` and `my-packages/web` are outside.
function isInsidePackagesWeb(target: string) {
  const fromPackage = relative(packagesWebRoot, target);
  return fromPackage === '' || (!isAbsolute(fromPackage) && fromPackage.split(sep)[0] !== '..');
}

// Relative specifiers resolve against the importing file's directory, absolute
// ones as is, and `@/…` against the apps/web root (tsconfig paths "@/*": ["./*"]).
// Bare package names have no path target.
function specifierTarget(fileName: string, specifier: string) {
  if (specifier === '.' || specifier === '..' || specifier.startsWith('./') || specifier.startsWith('../')) {
    return resolve(dirname(fileName), specifier);
  }
  if (isAbsolute(specifier)) return resolve(specifier);
  if (specifier.startsWith('@/')) return resolve(webRoot, specifier.slice(2));
  return undefined;
}

function isBoundaryViolation(fileName: string, specifier: string) {
  if (specifier.startsWith('@clensy/web/')) return true;
  const target = specifierTarget(fileName, specifier);
  return target !== undefined && isInsidePackagesWeb(target);
}

// Every module-specifier form the parser exposes, by AST node:
// - ImportDeclaration: both `import … from` and `import type … from`;
// - ExportDeclaration: both `export … from` and `export type … from`;
// - ImportEqualsDeclaration + ExternalModuleReference: `import X = require('…')`;
// - CallExpression via isLoadCall: `require(…)` and dynamic `import(…)`;
// - ImportTypeNode: type-position `import('…')`, e.g. `type T = import('…').X`.
// `import type` declarations and type-position `import('…')` are different
// nodes; both are needed. Type-only forms count: the invariant is structural
// access, not runtime loading.
function moduleSpecifierOf(node: ts.Node): ts.Node | undefined {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return node.moduleSpecifier;
  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) return node.moduleReference.expression;
  if (isLoadCall(node)) return node.arguments[0];
  if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) return node.argument.literal;
  return undefined;
}

function boundaryViolations(fileName: string, text: string) {
  const violations: string[] = [];
  const visit = (node: ts.Node) => {
    const specifier = moduleSpecifierOf(node);
    if (isLiteralSpecifier(specifier) && isBoundaryViolation(fileName, specifier.text)) violations.push(specifier.text);
    ts.forEachChild(node, visit);
  };
  visit(parseSource(fileName, text));
  return violations;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: PASS, all tests. The tree test reports no violations.

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/web-shell-regressions.test.ts
git commit -m "test(120): forbid deep @clensy/web and packages/web specifiers in apps/web"
```

---

### Task 3: One dashboard shell

Implements §6.1 **Dashboard shell** (recognition and placement).

**Files:**
- Modify: `apps/web/lib/web-shell-regressions.test.ts`: the helper section (a new function after `wrapsDashboardInBoundary`), the `layout-wiring check` table, and the `app i18n boundary structure` describe block

**Interfaces:**
- Consumes: `parseSource`, `nonTestSources`, `wrapsDashboardInBoundary` (unchanged).
- Produces: `dashboardShellElements(fileName: string, text: string): number`.

**Why the tree test is enough for placement:** Layout wiring already requires the provider element's single direct child to be an element whose tag is bound to a named `DashboardLayout` import. That child is therefore a recognised shell element. When the tree-wide set is exactly `[{ file: 'app/app/layout.tsx', count: 1 }]`, the one recognised element must be that child. Together, the two tests express "the same element that Layout wiring finds", without a new layout helper.

- [ ] **Step 1: Write the failing tests**

In the `layout-wiring check` table, directly after the `'two provider elements'` row (the array that ends with `false,` and `      ],`), add:

```ts
      [
        'a second shell in a conditional branch (caught by the dashboard-shell invariant, not here)',
        `${PROVIDER}${DASHBOARD}${layoutReturning('cond ? <DashboardLayout>{children}</DashboardLayout> : <AppI18nProvider><DashboardLayout>{children}</DashboardLayout></AppI18nProvider>')}`,
        true,
      ],
```

Directly after the whole `it('mounts AppI18nProvider in the /app layout, directly around DashboardLayout', …)` block, add:

```ts
  describe('dashboard-shell recognition', () => {
    const PROVIDER = "import { AppI18nProvider } from '../../components/layout/app-i18n-provider';\n";
    const DASHBOARD = "import { DashboardLayout } from '../../components/layout/dashboard-layout';\n";
    const layoutReturning = (jsx: string) => `export default function Layout({ children }) {\n  return ${jsx};\n}\n`;

    it.each([
      ['the canonical layout', `${PROVIDER}${DASHBOARD}${layoutReturning('<AppI18nProvider><DashboardLayout>{children}</DashboardLayout></AppI18nProvider>')}`, 1],
      [
        'a sibling shell outside the provider',
        `${PROVIDER}${DASHBOARD}${layoutReturning('<><AppI18nProvider><DashboardLayout>{children}</DashboardLayout></AppI18nProvider><DashboardLayout /></>')}`,
        2,
      ],
      [
        'a shell in a conditional branch',
        `${PROVIDER}${DASHBOARD}${layoutReturning('cond ? <DashboardLayout>{children}</DashboardLayout> : <AppI18nProvider><DashboardLayout>{children}</DashboardLayout></AppI18nProvider>')}`,
        2,
      ],
      ['a shell in another file', "import { DashboardLayout } from '../components/layout/dashboard-layout';\nexport default function Page() {\n  return <DashboardLayout>x</DashboardLayout>;\n}\n", 1],
      ['an aliased import from any module', "import { DashboardLayout as Shell } from './somewhere';\nexport const Page = () => <Shell />;\n", 1],
      ['a literal DashboardLayout tag without an import', 'export const Page = () => <DashboardLayout />;\n', 1],
      ['a property-access tag', "import * as Ui from './ui';\nexport const Page = () => <Ui.DashboardLayout />;\n", 0],
      ['a same-spelled attribute and an unrelated import', "import { DashboardLayoutProps } from './types';\nexport const Page = () => <div DashboardLayout=\"x\" />;\n", 0],
    ])('counts %s', (_label, source, expected) => {
      expect(dashboardShellElements('fixture.tsx', source)).toBe(expected);
    });
  });

  // §6.1 dashboard shell (#120): exactly one recognised element across apps/web,
  // in the /app layout. With the layout-wiring test above, it is the provider's
  // direct child.
  it('renders exactly one DashboardLayout shell in apps/web, in the /app layout', () => {
    const shells = nonTestSources(webRoot)
      .map((path) => ({ file: relative(webRoot, path), count: dashboardShellElements(path, readFileSync(path, 'utf8')) }))
      .filter(({ count }) => count > 0);

    expect(shells).toEqual([{ file: 'app/app/layout.tsx', count: 1 }]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: FAIL. Every `dashboard-shell recognition` case (8) and `renders exactly one DashboardLayout shell…` fail with `ReferenceError: dashboardShellElements is not defined`.

The new layout-wiring row (`a second shell in a conditional branch…`) **passes**, which is expected. It documents that Layout wiring alone accepts this layout (Review Focus 4). It is a characterisation row, not a red test.

All other tests pass.

- [ ] **Step 3: Implement shell recognition**

Directly after the closing `}` of `function wrapsDashboardInBoundary(fileName: string, text: string) {`, add:

```ts
// §6.1 dashboard shell (#120). Recognition: a JSX opening or self-closing
// element whose tag name is literally DashboardLayout, or a local name bound by
// a named import whose imported name is DashboardLayout, from any module (no
// module resolution). DashboardLayout gets no escape rules.
function dashboardShellElements(fileName: string, text: string) {
  const source = parseSource(fileName, text);
  const names = new Set(['DashboardLayout']);
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const element of bindings.elements) {
      if ((element.propertyName ?? element.name).text === 'DashboardLayout') names.add(element.name.text);
    }
  }
  let count = 0;
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && ts.isIdentifier(node.tagName) && names.has(node.tagName.text)) {
      count += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return count;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: PASS, all tests. The tree test reports `[{ file: 'app/app/layout.tsx', count: 1 }]`.

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/web-shell-regressions.test.ts
git commit -m "test(120): require exactly one DashboardLayout shell, in the /app layout"
```

---

### Task 4: Full verification and before/after demonstration

This task is a **demonstration**. It shows that each #120 bypass passes the #117 guard (now on `main`) and fails the amended one. It is not the acceptance criterion: that is the Accepted §6.1, pinned by the inline fixtures in Tasks 1–3. **No files are committed in this task.** Every probe file is temporary and removed. `layout.tsx` is restored byte-for-byte from a saved copy, never with `git checkout`.

**Files:**
- Temporary only (removed in Step 4):
  - `apps/web/lib/pre-120-guard.test.ts`
  - `apps/web/components/probe-deep.tsx`
  - `apps/web/components/probe-relative.tsx`
  - `apps/web/lib/probe-load.ts`
  - `apps/web/components/probe-shell.tsx`

- [ ] **Step 1: Full suite, type-check and lint on the clean branch**

Run: `pnpm --filter web test && pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: all pass, exit 0.

- [ ] **Step 2: Set up the #117 guard and save the layout**

Run: `git status --short && ls apps/web/lib/pre-120-guard.test.ts apps/web/components/probe-deep.tsx apps/web/components/probe-relative.tsx apps/web/lib/probe-load.ts apps/web/components/probe-shell.tsx 2>&1 | grep -v 'No such file'`
Expected: no output. The tree is clean and no probe path exists yet. If anything is printed, stop and report it. Do not overwrite or delete it.

Run: `PROBE_DIR=$(mktemp -d) && cp apps/web/app/app/layout.tsx "$PROBE_DIR/layout.tsx.orig" && echo "$PROBE_DIR"`
**Record the printed path.** Shell variables do not persist between executor calls, so the shell variable MUST NOT be used after this command. In every later step, `<PROBE_DIR>` means this recorded literal path, and it MUST be substituted before the command runs (for example `cmp "/tmp/tmp.AbC123/layout.tsx.orig" …`). An executor whose session provides a scratchpad directory may create the directory there instead (`mktemp -d -p <that directory>`); the save, restore and `cmp` steps work the same either way.

Run: `git show main:apps/web/lib/web-shell-regressions.test.ts > apps/web/lib/pre-120-guard.test.ts`

The guard skips `*.test.*` files, so this copy never shows up in either guard's tree scan.

- [ ] **Step 3: Probe each bypass against both guards**

For each probe below:
1. Write the probe content to `<PROBE_DIR>/<the probe's file name>` first (for example `<PROBE_DIR>/probe-deep.tsx`), then copy it into place with `cp`. The copy in `<PROBE_DIR>` is the reference that cleanup checks against. For probe (e), apply the layout edit instead.
2. Run: `pnpm --filter web exec vitest run lib/pre-120-guard.test.ts -t "app i18n boundary structure"` and record the result.
3. Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts -t "app i18n boundary structure"` and record the result.
4. Remove only that probe's file, and only after verifying it: `cmp "<PROBE_DIR>/<file name>" <probe path> && rm <probe path>`. If `cmp` reports a difference, stop and report it; do not delete the file. For probe (e), restore the layout with `cp "<PROBE_DIR>/layout.tsx.orig" apps/web/app/app/layout.tsx`, using the recorded literal path.

| Probe | Files | #117 guard | Amended guard |
| --- | --- | --- | --- |
| (a) Deep import mount | `components/probe-deep.tsx`: `import { ClensyI18nProvider as P } from '@clensy/web/src';\nexport const Probe = () => <P locale="en">x</P>;` | PASS | FAIL: `has no package boundary violations…` lists `{ file: 'components/probe-deep.tsx', specifiers: ['@clensy/web/src'] }` |
| (b) Relative path into `packages/web` | `components/probe-relative.tsx`: `import { ClensyI18nProvider } from '../../../packages/web/src';\nexport const Probe = () => <ClensyI18nProvider locale="en">x</ClensyI18nProvider>;` | PASS | FAIL: `has no package boundary violations…` lists `components/probe-relative.tsx` |
| (c) Dynamic import of the package | `lib/probe-load.ts`: `export const load = () => import('@clensy/web').then((m) => m.ClensyI18nProvider);` | PASS | FAIL: `has no provider escapes…` lists `{ file: 'lib/probe-load.ts', count: 1 }` |
| (d) A second shell in another file | `components/probe-shell.tsx`: `import { DashboardLayout } from './layout/dashboard-layout';\nexport const Probe = () => <DashboardLayout>x</DashboardLayout>;` | PASS | FAIL: `renders exactly one DashboardLayout shell…` also lists `components/probe-shell.tsx` |
| (e) A conditional-branch shell in the layout | In `app/app/layout.tsx`, replace `  return (\n    <AppI18nProvider>` with `  if (process.env.PROBE_SHELL) return <DashboardLayout>{children}</DashboardLayout>;\n  return (\n    <AppI18nProvider>` | PASS | FAIL: `renders exactly one DashboardLayout shell…` reports `{ file: 'app/app/layout.tsx', count: 2 }`. `mounts AppI18nProvider in the /app layout…` still passes |

If any cell differs from the table, stop and report it. Do not change a fixture, the guard or the implementation just to reproduce the table. The table is demonstrative; the Accepted §6.1 is normative.

- [ ] **Step 4: Clean up and confirm the tree**

Nothing is deleted without verification. Step 2 confirmed that none of the five paths existed before this task, and Step 3 removed each probe only after `cmp` matched its reference copy.

Run: `ls apps/web/components/probe-deep.tsx apps/web/components/probe-relative.tsx apps/web/lib/probe-load.ts apps/web/components/probe-shell.tsx 2>&1 | grep -v 'No such file'`
Expected: no output (every probe is already gone). If anything is printed, stop and report it; do not delete it.

Run: `git show main:apps/web/lib/web-shell-regressions.test.ts | cmp - apps/web/lib/pre-120-guard.test.ts && rm apps/web/lib/pre-120-guard.test.ts`
Expected: no output, and the guard copy is removed. If `cmp` reports a difference, stop and report it; do not delete the file.

Run, substituting the recorded literal path for `<PROBE_DIR>`: `cmp "<PROBE_DIR>/layout.tsx.orig" apps/web/app/app/layout.tsx && rm -r "<PROBE_DIR>" && git status --short`
Expected: no output. `cmp` confirms the layout is byte-identical and the tree is clean. If `cmp` reports a difference, restore with `cp "<PROBE_DIR>/layout.tsx.orig" apps/web/app/app/layout.tsx`, using the same recorded literal path, and re-run.

Run: `git diff --stat main -- apps packages .github`
Expected: only `apps/web/lib/web-shell-regressions.test.ts` changed.

- [ ] **Step 5: Record the outcome**

Record the filled-in Step 3 table in the M6 Slice Completion Report and the PR description. There is no commit for this task.

---

## Traceability

| Spec requirement (§6.1 as amended by #120) | Task |
| --- | --- |
| Escape item 4: exact-package `require` / `import()` / import-equals | 1 (four rows that expect 1) |
| Escape item 4: non-literal or missing specifier fails closed | 1 (`non-literal require`, `non-literal dynamic import`, `template literal with a substitution`, `require with no argument`) |
| Literal = string or no-substitution template | 1 and 2 (template-literal rows) |
| Deep or `packages/web` load calls are violations, not escapes | 1 (deep load-call row expects 0 escapes), 2 (deep `require` row expects 1 violation) |
| Package boundary: every specifier form | 2 (import, import type, export-from, export type-from, import-equals, require, import(), import type node) |
| Package boundary: relative, absolute (built at test time) and `@/` targets, the directory itself, segment-by-segment comparison | 2 |
| Package boundary: bare `@clensy/web`, other packages and lookalikes allowed | 2 |
| Zero boundary violations, an independent assertion | 2 (`has no package boundary violations anywhere in apps/web`) |
| Dashboard shell recognition: a literal `DashboardLayout` spelling is recognised regardless of binding; an alias is recognised only when bound by a named import whose imported name is `DashboardLayout` (from any module); no escape rules | 3 |
| Dashboard shell placement: exactly one, in `app/app/layout.tsx`, the provider's direct child | 3 (tree test plus the unchanged layout-wiring test; see the Task 3 note) |
| #120 fixture list | 1–3 (inline), 4 (before/after demonstration) |
| Layout wiring and all #117 assertions unchanged | No task edits them; Task 3 only adds one characterisation row |
| No production or package change | 4 Step 4 |
