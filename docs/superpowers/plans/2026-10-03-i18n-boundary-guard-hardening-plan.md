# App i18n Boundary Guard Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Accepted |
| M5 decision | **Accepted** — 2026-10-03, round 2, at `7e27c1c`, by the owner. To be executed natively, task by task (Task 1 → Task 2 → Task 3 → Task 4). Carried-forward constraint: do not broaden the detector during implementation. If an implementation detail suggests a different reading of the amended §6.1, stop and raise it. **Round 1 (Changes Requested):** Two blockers, both applied: (1) nested qualified namespace type names are now pinned (`W.Foo.Bar`, `W.ClensyMessages.Foo`, `W.Foo<string>`, `typeof W.ClensyI18nProvider.displayName`, `typeof W`, plus `import X = W.Foo.Bar` as an escape), and `isNamespaceTypePosition` is rewritten so its comment and branches follow the §6.1 item 3 wording; (2) explicit zero-escape fixtures show that the provider's own named, aliased, namespace and mixed `@clensy/web` import declarations are exempt, while an other-module import with the same local name still fails closed. Non-blocking refinements also applied: Task 2's red/green wording for the JS/JSX rows, the filename-versus-directory split between `isScannedSource()` and `nonTestSources()`, Task 4 cleanup that restores the exact original `layout.tsx` instead of running `git checkout`, and Task 4 marked as demonstrative. |
| Date | 2026-10-03 |
| Tracking issue | [#117](https://github.com/rexescario-dev/clensy-platform/issues/117), deferred from #115 / PR #116 (M7 Minor 1–3) |
| Scope | `apps/web/lib/web-shell-regressions.test.ts` only. No production code, package, CI or catalog change. |
| Implements (Accepted) | [Single App-Level `ClensyI18nProvider` — Design](../specs/2026-10-02-single-app-i18n-provider-design.md) §3 (**provider escape**) and §6.1 as amended by #117. Status **Accepted** (M3, 2026-10-03, amendment at `9a23c98`). |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. Helper names, file layout, task grouping, order and test names below are planning decisions, not product semantics. |
| Edit anchors | Every edit is located by the **quoted code**, not by line number. Line numbers are approximate, taken from `main` at `11c2a15`. |
| Pre-validation | The detector, file-selection and layout logic below was prototyped against TypeScript 5.9.3 (the version `apps/web` resolves) in a throwaway script outside the repo. Every fixture expectation in this plan, including the round-1 additions, matched both with per-extension parsing and with Task 1's TSX-only parsing, and the real `apps/web` tree gave exactly one mount (in `components/layout/app-i18n-provider.tsx`) and zero escapes. |


## Gate outcomes

**M6 (2026-10-03): Complete.** Tasks 1–4 were executed natively, in order and test-first:
- `c833aed`: Task 1
- `64f3479`: Task 2
- `4db3d86`: Task 3
- Task 4 committed nothing.

The planned RED states all occurred:
- Task 1: 40 failures, `providerUses is not defined`.
- Task 2: the 15 file-selection cases (`isScannedSource is not defined`) plus the generic-arrow `.ts` row, which received `{ mounts: 0, escapes: 0 }`. The `.js`/`.jsx`/`.mjs` rows already passed, as predicted.
- Task 3: 10 failures, `wrapsDashboardInBoundary is not defined`.

Every `Expected:` line matched. The final full web suite has 13 files and 175 tests passing, and `tsc --noEmit` and lint exit 0.

Task 4 demonstration: each bypass passes `main`'s guard and fails the amended one.

| Probe | Pre-amendment guard | Amended guard |
| --- | --- | --- |
| (a) `.jsx` mount | PASS | FAIL: `has exactly one provider mount…` lists `components/probe-mount.jsx` |
| (b) re-export barrel | PASS | FAIL: `has no provider escapes…` lists `{ file: 'lib/probe-barrel.ts', count: 1 }` |
| (c) `DashboardLayout` imported from `app-sidebar` | PASS | FAIL: `mounts AppI18nProvider in the /app layout…` (expected `true`, got `false`) |
| (d) `.ts` generic arrow + `export default P` | PASS | FAIL: `has no provider escapes…` lists `lib/probe-generic.ts` |

After the probes, `cmp` confirmed `layout.tsx` is byte-identical to the saved copy and the tree was clean. The diff against `main` outside `docs/` is `apps/web/lib/web-shell-regressions.test.ts` only.

Executor rulings:
1. The Task 3 fixture title `'accepts %s: %s'` became `'checks %s'`. The second `%s` was being filled with the layout source, not the expected boolean, and "accepts" misread the rejected cases. No assertion changed.
2. Task 4 created its temp directory in the session scratchpad rather than `/tmp`. Behaviour is the same.

Final whole-branch review: one fresh reviewer, independent of the executor. Result: 0 Critical, 0 Important, 5 Minor, ready to merge. The reviewer checked §6.1 rule by rule and found the implementation neither broader nor narrower than the amendment.

**Spec-level gaps for a follow-up** (the code stands, because closing either would broaden the Accepted §6.1, which M5 forbade):
- A deep import such as `'@clensy/web/src'` bypasses both assertions. §6.1 binds only the exact `'@clensy/web'` specifier, and `packages/web` has no `exports` map.
- A second `DashboardLayout` outside the boundary still passes the layout check. §6.1 limits only the number of provider elements.

**Deferred minors.** All follow the letter of §6.1 and fail closed:
- `typeof P.displayName` counts as an escape, while `typeof W.ClensyI18nProvider.displayName` does not.
- `extends`/`implements W.Foo` and `import('x').W` type positions count as namespace escapes.
- Member, method, enum and label names spelled like a binding count as escapes.
- `.mjsx`/`.cjsx`/`.mtsx`/`.ctsx` match the scan regex but are parsed as TS.

**M7 (2026-10-03): Approved for merge.**
- Subject: PR [#119](https://github.com/rexescario-dev/clensy-platform/pull/119), head `2e5306c`. It carries the §6.1 amendment, this Accepted plan and the M6 change set, as process spec §2.8 requires.
- M6 gate: implementation started only after M5 Accept. Plan Accept is `bbab9dc`, and the first implementation commit, `c833aed`, follows it.
- Plan tasks: Task 1 ✓, Task 2 ✓, Task 3 ✓, Task 4 ✓ (demonstration recorded under M6; nothing committed). Nothing is deferred or missing, and there is no incremental delivery.
- Spec conformance:
  - §3 "provider escape" ✓.
  - §6.1 rule by rule ✓: parser only; scanned extensions, exclusions and `ScriptKind`; exact `'@clensy/web'` bindings; mounts; escape items 1–3 and their exemptions; non-reference names; no scope analysis; one-mount and zero-escape assertions; binding-aware layout wiring; fixtures; secondary text guard unchanged.
  - The independent reviewer found the implementation neither broader nor narrower than the amendment, which honours the M5 "do not broaden" constraint.
- Scope: the only non-docs file changed is `apps/web/lib/web-shell-regressions.test.ts`. There are no production, package, CI or dependency changes, and no drive-by edits.
- Verification evidence:
  - CI run [37042020082](https://github.com/rexescario-dev/clensy-platform/actions/runs/37042020082) on `2e5306c`: Lint, Test and Release gate all passed.
  - Locally, `pnpm --filter web test` passed (13 files, 175 tests), and `pnpm --filter web exec tsc --noEmit` and `pnpm --filter web lint` exited 0.
  - TDD RED→GREEN evidence for Tasks 1–3 is in the M6 record above.
  - The independent reviewer re-ran the suite (82/82 in the guard file, 175 overall) and about 45 extra probes outside the repo.
- Blocking findings: none.
- Non-blocking observations (these do not affect the merge decision): the spec-level follow-ups and the four deferred minors recorded under M6. The executor's two rulings, the Task 3 title and the scratchpad temp directory, are cosmetic, and the reviewer agreed with both.
- This record was written by the implementer, based on the independent whole-branch review and the CI evidence. That is the same arrangement as #115's non-blocking observation 2. Merge per human/project norms.

**M8 (2026-10-03): N/A.**
- Scope: the #117 change set, `apps/web/lib/web-shell-regressions.test.ts`.
- Each helper does one thing: `isScannedSource`, `scriptKindFor`, `parseSource`, `providerUses` and its position predicates, and `wrapsDashboardInBoundary`. Each is pinned by inline fixtures.
- `clensyProviderBindings` and `namedImportLocal` both walk import declarations, but they collect different shapes (provider bindings versus one named local). Merging them would add a parameterised abstraction for no gain.
- Moving the helpers into a separate `lib/` module was considered and rejected. It would put a non-test module into the very tree this guard scans, and import `typescript` into app source, for no maintainability benefit. The helpers stay next to the only test that uses them, as in #115's M8.
- No behaviour-preserving restructuring is worth its risk.

**M9 (2026-10-03): Complete.** Documentation scope: `apps/web/README.md` § i18n, the spec's Tracking cell, and this section.
- Content updates:
  - `apps/web/README.md`: the "No local providers" bullet now describes the hardened guard, with the scanned extension set, provider escapes (including barrels, aliases and `createElement`) and its syntactic `import … from '@clensy/web'` scope. Caused by Tasks 1–2 and spec §3/§6.1 as amended.
  - The spec's Tracking cell links PR #119. Caused by the PR being opened.
  - This section. Caused by the M7–M9 gate outcomes.
- Editorial changes: none.
- Unchanged:
  - `packages/web/README.md`: says nothing about the guard.
  - `docs/README.md`: #115 has no index entry, so #117 gets none, following that slice's precedent.
  - Historical plans (#115, #88/#89): left as the record of their own slices.
- Verification:
  - Links: the PR, issue and spec links resolve, and the README's relative spec link is unchanged.
  - Status consistency: the spec's amendment and the plan are both Accepted, and the PR is open and green.
  - Terminology: "provider escape" and "app i18n boundary" are used as defined in spec §3.
  - No heading changes, no duplicate or contradictory sections, no code or contract edits.

**M10 (2026-10-03): Accepted (workflow validated).** Subject: the installed workflow prompt library (`docs/workflows/`, generic 1.2.0), validated against `docs/workflows/specs/agent-workflow-design.md` §2.10. This slice ran the workflow on #117 from M2 to M9.

Asset inventory:
- `prompts/`: `specification` M2, `design-review` M3, `implementation-planning` M4, `plan-review` M5, `implementation-execution` M6, `code-review` M7, `refactoring` M8, `documentation-execution` M9, `workflow-validation` M10.
- `conventions/`: `prompt-library` M1, `reporting-conventions` (§2.11).
- `specs/agent-workflow-design.md`: the governing contract.

Checks:
- All 9 prompts cite the governing contract and declare exactly one stage. There are no orphan assets.
- Every relative link under `docs/workflows/` resolves (scripted scan, no broken links).
- The M5→M6 hard prerequisite is stated in both process spec §2.5 and the M6 prompt, and this slice honoured it: plan Accept `bbab9dc` precedes the first implementation commit `c833aed`.
- The provider rule (`prompt-library.md` §12) was honoured: GitHub for the issue, the branch and the PR.
- Slice Completion Reports were emitted at M6 and at M7–M9.

Blocking findings: none. The M2→M9 path for #117 was executed using only these assets plus the process spec.

Non-blocking observations:
1. **Amending an Accepted spec has no written procedure.** §2.8 permits "slice-local specification amendments", but `specification.md` describes only a fresh Draft spec ("exactly one Draft specification"). This slice ran M2/M3 on an in-place §6.1 amendment, with Draft and then Accepted recorded in the header and M3 rows, following the bookings-spec precedent. That worked, but it was inferred rather than instructed.
2. **Carried forward from #115** (observations 1–3, still open):
   - M10 has no conventional report location, so the report again lives in the slice plan.
   - `code-review.md` does not say whether the M7 reviewer must be independent of the M6 implementer. Here, too, the M7 record was written by the implementer, based on an independent whole-branch review.
   - The §2.12 merge and M10 have no stated order between them. This slice again ran M10 before the human-authorized merge.

**Goal:** Close the three bypasses of the app i18n boundary guard. These are unscanned JavaScript files, provider escapes (re-export barrels and value references), and name-only layout wiring. The fix is to implement the amended spec §6.1 in the existing structural test.

**Architecture:** The guard stays a syntactic, parser-only check in `apps/web/lib/web-shell-regressions.test.ts`.
- One pure detector, `providerUses(fileName, text)`, returns `{ mounts, escapes }` for one source.
- `isScannedSource(fileName)` decides which files the tree walk reads, and `parseSource` picks the `ScriptKind` from the file extension.
- `wrapsDashboardInBoundary(fileName, text)` checks the layout wiring.
- Each helper is run against inline fixtures and against the real tree or layout file.

**Tech Stack:** The TypeScript 5.9 compiler API (`ts.createSourceFile` only; no type checker), Vitest, and `pnpm --filter web`.

**Spec:** `docs/superpowers/specs/2026-10-02-single-app-i18n-provider-design.md` (§3 terminology, §6.1)

## Global Constraints

Copied from the Accepted spec (§6.1 as amended). Every task implicitly includes these.

- The guard SHALL be syntactic: the TypeScript compiler API's parser, with no type checker and no module resolution.
- Scanned files SHALL be every file under `apps/web` matching `/\.(m|c)?[jt]sx?$/`, except anything under `node_modules` or `.next`, declaration files (`.d.ts`, `.d.mts`, `.d.cts`), and test files (`*.test.*`).
- `ScriptKind` SHALL follow the extension: `.ts`, `.mts`, `.cts` → `TS`; `.tsx` → `TSX`; `.js`, `.mjs`, `.cjs` → `JS`; `.jsx` → `JSX`.
- Only `import` declarations whose module specifier is exactly `'@clensy/web'` create provider bindings (named, including aliases, and namespace).
- Exactly **one** provider mount SHALL exist across `apps/web`, in `components/layout/app-i18n-provider.tsx`. That assertion is unchanged.
- `apps/web` SHALL have **zero provider escapes anywhere**, including `components/layout/app-i18n-provider.tsx`. This is an independent assertion and SHALL NOT be weakened (M3, 2026-10-03).
- There is no scope analysis. A shadowing declaration is still counted, and that false positive is intended (fails closed).
- Layout wiring SHALL bind both the `AppI18nProvider` and `DashboardLayout` tags to named imports from exactly `'../../components/layout/app-i18n-provider'` and `'../../components/layout/dashboard-layout'`. Aliases pass, and the provider element SHALL directly wrap the `DashboardLayout` element.
- Every closed bypass SHALL have an inline fixture. Task 4 shows each one passing the pre-amendment guard and failing the amended one.
- No production code change.
- Commit messages use the repo's `type(117): …` style and carry **no** `Co-Authored-By` trailer and no "Generated with" line (owner's global instruction).

## Review Focus

Failure modes the amended §6.1 implies that a naïve implementation could miss, most likely first. Each one has a pinning test in the task named.

1. **The real boundary file reports an escape.** `app-i18n-provider.tsx` has an import specifier and a JSX opening and closing tag. Counting any of them as an escape would make the zero-escape assertion unsatisfiable. Pinned in Task 1 by the closing-tag fixtures and the tree-wide zero-escape test.
2. **Allowed spellings get counted as escapes**: `typeof P`, `typeof W.ClensyI18nProvider`, `W.SomeType`, `obj.P`, `{ P: 1 }`, `<div P="1" />`, and `export { Button } from '@clensy/web'` (a re-export of a different component). Pinned in Task 1 with one zero-escape fixture each.
3. **A `.ts` file parsed as TSX hides an escape.** Today every file is parsed as TSX. In TSX, an old-style generic arrow (`<T>(value: T) => value`) is read as a JSX element and swallows the rest of the file, so a later `export default P` is never seen. This was confirmed against TypeScript 5.9.3. Pinned in Task 2 with a `fixture.ts` row that currently reports 0 escapes and must report 1.
4. **Namespace exemptions drift from §6.1 item 3.** `W.foo`, `<W.Button />`, `import X = W.ClensyI18nProvider` and `import X = W.Foo.Bar` are escapes, even though they look like property access or a type name. Nested qualified type names (`W.Foo.Bar`, `W.ClensyMessages.Foo`) and nested `typeof` queries are exempt, because `W` is still the leftmost name of a qualified type name or inside a type query. Pinned in Task 1.
5. **The layout check accepts a near-miss**: an extra sibling inside the provider, a `DashboardLayout` nested one level deeper, a second provider element, or an impostor `AppI18nProvider` from another module. Pinned in Task 3.

**Not covered, by spec definition:** `require('@clensy/web')` and dynamic `import('@clensy/web')`. §6.1 limits bindings to `import` declarations, so neither form creates a binding, and this plan does not add one. Closing that gap would need a spec change, not a plan change.

## File Map

| File | Change | Responsibility |
| --- | --- | --- |
| `apps/web/lib/web-shell-regressions.test.ts` | Modify | The §6.1 helpers (the code between the `// Single app i18n provider spec §6.1.` comment and `describe('app i18n boundary structure'`) and that `describe` block |

The spec gets no further change, apart from a link to the PR in its Tracking cell, which M9 adds.

---

### Task 1: Provider escapes (`providerUses`)

Implements §3 **Provider escape** and §6.1 **Provider escapes** items 1–3 and the zero-escape assertion.

**Files:**
- Modify: `apps/web/lib/web-shell-regressions.test.ts`: the `clensyProviderBindings` and `countProviderMounts` helpers, the `provider-mount detector` describe block, and the `has exactly one provider mount…` test

**Interfaces:**
- Consumes: the existing `parseTsx(fileName, text)`, `nonTestSources(dir)`, `webRoot`.
- Produces: `providerUses(fileName: string, text: string): { mounts: number; escapes: number }`. It replaces `countProviderMounts`. Task 2 changes only its parser call.

- [ ] **Step 1: Write the failing tests**

Replace the whole `describe('provider-mount detector', …)` block, from `  describe('provider-mount detector', () => {` through its closing `  });`, with:

```ts
  describe('provider-use detector', () => {
    const NAMED = "import { ClensyI18nProvider } from '@clensy/web';\n";
    const ALIASED = "import { ClensyI18nProvider as P } from '@clensy/web';\n";
    const NAMESPACE = "import * as W from '@clensy/web';\n";

    it.each([
      // Mounts (§6.1 Provider mounts).
      ['a named import', 'fixture.tsx', `${NAMED}const x = <ClensyI18nProvider>a</ClensyI18nProvider>;`, 1, 0],
      ['an aliased import', 'fixture.tsx', `${ALIASED}const x = <P />;`, 1, 0],
      ['a namespace import', 'fixture.tsx', `${NAMESPACE}const x = <W.ClensyI18nProvider>a</W.ClensyI18nProvider>;`, 1, 0],
      [
        'a multi-line opening element',
        'fixture.tsx',
        `${NAMED}const x = (\n  <ClensyI18nProvider\n    locale="en"\n  >\n    a\n  </ClensyI18nProvider>\n);`,
        1,
        0,
      ],
      ['a same-named import from another module', 'fixture.tsx', "import { ClensyI18nProvider } from './local';\nconst x = <ClensyI18nProvider />;", 0, 0],
      ['an unrelated property access', 'fixture.tsx', 'const Other = { ClensyI18nProvider: () => null };\nconst x = <Other.ClensyI18nProvider />;', 0, 0],
      // Package re-exports (§6.1 Provider escapes item 1).
      ['a package re-export', 'fixture.ts', "export { ClensyI18nProvider } from '@clensy/web';", 0, 1],
      ['an aliased package re-export', 'fixture.ts', "export { ClensyI18nProvider as P } from '@clensy/web';", 0, 1],
      ['a package star re-export', 'fixture.ts', "export * from '@clensy/web';", 0, 1],
      ['a package namespace re-export', 'fixture.ts', "export * as W from '@clensy/web';", 0, 1],
      ['a package re-export of another component', 'fixture.ts', "export { Button } from '@clensy/web';", 0, 0],
      // The provider's own import declarations are exempt (items 2 and 3).
      ['a named provider import on its own', 'fixture.ts', NAMED, 0, 0],
      ['an aliased provider import on its own', 'fixture.ts', ALIASED, 0, 0],
      ['a namespace import on its own', 'fixture.ts', NAMESPACE, 0, 0],
      ['an aliased provider import beside another component', 'fixture.ts', "import { ClensyI18nProvider as P, Button } from '@clensy/web';\n", 0, 0],
      ['an other-module import with the same local name (fails closed)', 'fixture.ts', `${ALIASED}import { P } from './other';\n`, 0, 1],
      // Named-binding occurrences (item 2).
      ['an import that is never rendered', 'fixture.tsx', `${NAMED}export { ClensyI18nProvider };`, 0, 1],
      ['a default export of the binding', 'fixture.ts', `${ALIASED}export default P;`, 0, 1],
      ['a value alias', 'fixture.ts', `${ALIASED}const Q = P;`, 0, 1],
      ['a shorthand property', 'fixture.ts', `${ALIASED}const o = { P };`, 0, 1],
      ['a createElement mount', 'fixture.ts', `${ALIASED}import { createElement } from 'react';\ncreateElement(P, null);`, 0, 1],
      ['a typeof type query', 'fixture.ts', `${ALIASED}import type { ComponentProps } from 'react';\ntype Props = ComponentProps<typeof P>;`, 0, 0],
      ['a shadowing local (fails closed)', 'fixture.ts', `${ALIASED}function f() {\n  const P = 1;\n  return P;\n}`, 0, 2],
      ['non-reference names', 'fixture.tsx', `${ALIASED}const o = { P: 1 };\no.P;\nconst x = <div P="1" />;`, 0, 0],
      // Namespace-binding occurrences (item 3).
      ['a namespace provider value', 'fixture.ts', `${NAMESPACE}const Q = W.ClensyI18nProvider;`, 0, 1],
      ['a namespace element access', 'fixture.ts', `${NAMESPACE}const Q = W['ClensyI18nProvider'];`, 0, 1],
      ['another namespace member', 'fixture.ts', `${NAMESPACE}const Q = W.foo;`, 0, 1],
      ['another namespace JSX member', 'fixture.tsx', `${NAMESPACE}const x = <W.Button />;`, 0, 1],
      ['a bare namespace', 'fixture.ts', `${NAMESPACE}export { W };`, 0, 1],
      ['a namespace import-equals', 'fixture.ts', `${NAMESPACE}import X = W.ClensyI18nProvider;`, 0, 1],
      ['a namespace typeof type query', 'fixture.ts', `${NAMESPACE}type T = typeof W.ClensyI18nProvider;`, 0, 0],
      ['a namespace qualified type name', 'fixture.ts', `${NAMESPACE}type T = W.ClensyMessages;`, 0, 0],
      ['a nested namespace qualified type name', 'fixture.ts', `${NAMESPACE}type T = W.Foo.Bar;`, 0, 0],
      ['a member of a namespace qualified type name', 'fixture.ts', `${NAMESPACE}type T = W.ClensyMessages.Foo;`, 0, 0],
      ['a namespace qualified type name with type arguments', 'fixture.ts', `${NAMESPACE}type T = W.Foo<string>;`, 0, 0],
      ['a nested namespace typeof type query', 'fixture.ts', `${NAMESPACE}type T = typeof W.ClensyI18nProvider.displayName;`, 0, 0],
      ['a bare namespace typeof type query', 'fixture.ts', `${NAMESPACE}type T = typeof W;`, 0, 0],
      ['a nested namespace import-equals', 'fixture.ts', `${NAMESPACE}import X = W.Foo.Bar;`, 0, 1],
    ])('counts %s correctly', (_label, fileName, source, mounts, escapes) => {
      expect(providerUses(fileName, source)).toEqual({ mounts, escapes });
    });
  });
```

Then, in `it('has exactly one provider mount in apps/web, in app-i18n-provider.tsx', …)`, replace:

```ts
      .map((path) => ({ file: relative(webRoot, path), count: countProviderMounts(path, readFileSync(path, 'utf8')) }))
```

with:

```ts
      .map((path) => ({ file: relative(webRoot, path), count: providerUses(path, readFileSync(path, 'utf8')).mounts }))
```

and add this test directly after that `it` block:

```ts
  // §6.1: zero provider escapes anywhere, independent of the mount assertion.
  it('has no provider escapes anywhere in apps/web', () => {
    const escapes = nonTestSources(webRoot)
      .map((path) => ({ file: relative(webRoot, path), count: providerUses(path, readFileSync(path, 'utf8')).escapes }))
      .filter(({ count }) => count > 0);

    expect(escapes).toEqual([]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: FAIL. Every `provider-use detector` case, `has exactly one provider mount…` and `has no provider escapes…` fail with `ReferenceError: providerUses is not defined`. The other tests pass.

- [ ] **Step 3: Implement `providerUses`**

In the helper section, replace the opening check of `clensyProviderBindings`:

```ts
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== '@clensy/web') continue;
```

with:

```ts
    if (!ts.isImportDeclaration(statement) || !isClensyWebSpecifier(statement.moduleSpecifier)) continue;
```

Then replace the whole `countProviderMounts` function, from `function countProviderMounts(fileName: string, text: string): number {` through its closing `}`, with:

```ts
function isClensyWebSpecifier(specifier: ts.Expression | undefined) {
  return specifier !== undefined && ts.isStringLiteral(specifier) && specifier.text === '@clensy/web';
}

function isJsxTagName(node: ts.Node) {
  const { parent } = node;
  return (ts.isJsxOpeningElement(parent) || ts.isJsxSelfClosingElement(parent) || ts.isJsxClosingElement(parent)) && parent.tagName === node;
}

// Occurrences are by spelling, with no scope analysis. These positions are
// names rather than references, so they are never counted.
function isNonReferenceName(identifier: ts.Identifier) {
  const { parent } = identifier;
  return (
    (ts.isPropertyAccessExpression(parent) && parent.name === identifier) ||
    (ts.isPropertyAssignment(parent) && parent.name === identifier) ||
    (ts.isJsxAttribute(parent) && parent.name === identifier)
  );
}

function isNamedTypeQuery(identifier: ts.Identifier) {
  return ts.isTypeQueryNode(identifier.parent) && identifier.parent.exprName === identifier;
}

function isNamespaceMountTag(identifier: ts.Identifier) {
  const { parent } = identifier;
  return (
    ts.isPropertyAccessExpression(parent) &&
    parent.expression === identifier &&
    parent.name.text === 'ClensyI18nProvider' &&
    isJsxTagName(parent)
  );
}

// §6.1 item 3 type positions for a namespace binding W:
// - inside a `typeof` type query: `typeof W`, `typeof W.ClensyI18nProvider`,
//   `typeof W.ClensyI18nProvider.displayName`;
// - the left side of a qualified type name: `W.SomeType`, `W.Foo.Bar`.
// `W.Foo.Bar` parses as QualifiedName(QualifiedName(W, Foo), Bar), so W is the
// leftmost name of the entity name, and what decides the position is that
// entity name's parent. `import X = W.Foo` is a qualified name whose parent is
// an import-equals declaration, so it is not a type position and stays an escape.
function isNamespaceTypePosition(identifier: ts.Identifier) {
  let entityName: ts.Node = identifier;
  while (ts.isQualifiedName(entityName.parent) && entityName.parent.left === entityName) entityName = entityName.parent;
  const isQualified = entityName !== identifier;
  if (ts.isTypeQueryNode(entityName.parent)) return true;
  return isQualified && ts.isTypeReferenceNode(entityName.parent);
}

function packageReExportEscapes(declaration: ts.ExportDeclaration) {
  const clause = declaration.exportClause;
  if (!clause || ts.isNamespaceExport(clause)) return 1;
  return clause.elements.filter((element) => (element.propertyName ?? element.name).text === 'ClensyI18nProvider').length;
}

function providerUses(fileName: string, text: string) {
  const source = parseTsx(fileName, text);
  const { named, namespaces } = clensyProviderBindings(source);
  const isProviderTag = (tag: ts.JsxTagNameExpression) =>
    ts.isIdentifier(tag)
      ? named.has(tag.text)
      : ts.isPropertyAccessExpression(tag) &&
        ts.isIdentifier(tag.expression) &&
        namespaces.has(tag.expression.text) &&
        tag.name.text === 'ClensyI18nProvider';
  let mounts = 0;
  let escapes = 0;
  const visit = (node: ts.Node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && isClensyWebSpecifier(node.moduleSpecifier)) {
      // Only declarations whose specifier is exactly '@clensy/web' are skipped:
      // the provider's own import specifiers are exempt (pinned by the
      // import-only fixtures), and a package re-export is always an escape.
      // Every other import or export declaration is still walked, so a
      // same-spelled binding from another module fails closed.
      if (ts.isExportDeclaration(node)) escapes += packageReExportEscapes(node);
      return;
    }
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && isProviderTag(node.tagName)) mounts += 1;
    if (ts.isIdentifier(node) && !isNonReferenceName(node)) {
      if (named.has(node.text) && !isJsxTagName(node) && !isNamedTypeQuery(node)) escapes += 1;
      if (namespaces.has(node.text) && !isNamespaceMountTag(node) && !isNamespaceTypePosition(node)) escapes += 1;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { mounts, escapes };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: PASS, all tests.

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/web-shell-regressions.test.ts
git commit -m "test(117): fail the app i18n boundary guard on any provider escape"
```

---

### Task 2: Scanned files and `ScriptKind`

Implements §6.1 **Scanned files**.

**Files:**
- Modify: `apps/web/lib/web-shell-regressions.test.ts`: `parseTsx` and its two callers, `nonTestSources`, and the `app i18n boundary structure` describe block

**Interfaces:**
- Consumes: `providerUses` (Task 1).
- Produces: `isScannedSource(fileName: string): boolean` and `parseSource(fileName: string, text: string): ts.SourceFile`. `parseSource` replaces `parseTsx`, and Task 3 uses it.

**Responsibility split (planning decision):** `isScannedSource()` decides only whether a *file name* is eligible: the extension set, declaration files and test files. `nonTestSources()` keeps sole responsibility for directory exclusion through the existing `SKIPPED_DIRS` (`node_modules`, `.next`). That set is unchanged, so the selection table below tests base names only, and `isScannedSource()` is never given a directory path.

- [ ] **Step 1: Write the failing tests**

At the top of `describe('app i18n boundary structure', () => {`, before `describe('provider-use detector'`, add:

```ts
  describe('scanned-file selection', () => {
    it.each([
      ['page.ts', true],
      ['page.tsx', true],
      ['page.js', true],
      ['page.jsx', true],
      ['config.mjs', true],
      ['config.cjs', true],
      ['module.mts', true],
      ['module.cts', true],
      ['types.d.ts', false],
      ['types.d.mts', false],
      ['types.d.cts', false],
      ['page.test.ts', false],
      ['page.test.jsx', false],
      ['styles.css', false],
      ['messages.json', false],
    ])('scans %s: %s', (fileName, scanned) => {
      expect(isScannedSource(fileName)).toBe(scanned);
    });
  });
```

In the `provider-use detector` table, add these rows directly after the `'a multi-line opening element'` row:

```ts
      ['a .jsx mount', 'fixture.jsx', `${NAMED}const x = <ClensyI18nProvider />;`, 1, 0],
      ['a .js mount', 'fixture.js', `${NAMED}const x = <ClensyI18nProvider />;`, 1, 0],
      ['an .mjs mount', 'fixture.mjs', `${NAMED}export const x = <ClensyI18nProvider />;`, 1, 0],
      ['an escape after a generic arrow in a .ts file', 'fixture.ts', `${ALIASED}export const identity = <T>(value: T) => value;\nexport default P;`, 0, 1],
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: FAIL.
- Every `scanned-file selection` case fails with `ReferenceError: isScannedSource is not defined`.
- `counts an escape after a generic arrow in a .ts file correctly` fails with received `{ mounts: 0, escapes: 0 }`, because the `.ts` file is parsed as TSX (Review Focus 3).
- The `.jsx`, `.js` and `.mjs` mount rows may already pass, because before Step 3 every file is forced through TSX, which accepts JSX. They are not red tests for this task. They are regression fixtures for the per-extension `ScriptKind` once Step 3 lands. The generic-arrow `.ts` row is the red test that shows the parser change matters.

- [ ] **Step 3: Implement file selection and per-extension parsing**

Replace:

```ts
function parseTsx(fileName: string, text: string) {
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}
```

with:

```ts
const SCANNED_SOURCE = /\.(m|c)?[jt]sx?$/;
const DECLARATION_FILE = /\.d\.(m|c)?ts$/;
const TEST_FILE = /\.test\./;

// Filename eligibility only. Directory exclusion (node_modules, .next) belongs
// to nonTestSources() through SKIPPED_DIRS.
function isScannedSource(fileName: string) {
  return SCANNED_SOURCE.test(fileName) && !DECLARATION_FILE.test(fileName) && !TEST_FILE.test(fileName);
}

function scriptKindFor(fileName: string) {
  if (fileName.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (fileName.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (/\.(m|c)?js$/.test(fileName)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function parseSource(fileName: string, text: string) {
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, scriptKindFor(fileName));
}
```

Rename the two callers:
- in `providerUses`, `const source = parseTsx(fileName, text);` → `const source = parseSource(fileName, text);`
- in the layout test, `const layout = parseTsx('layout.tsx', readWebSource('app/app/layout.tsx'));` → `const layout = parseSource('layout.tsx', readWebSource('app/app/layout.tsx'));` (Task 3 replaces that test body)

In `nonTestSources`, replace:

```ts
    const isSource = /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts');
    return isSource && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
```

with:

```ts
    return isScannedSource(entry.name) ? [path] : [];
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: PASS, all tests. The tree-wide tests now also read `eslint.config.mjs` and `postcss.config.mjs`, and still report exactly one mount and no escapes.

Run: `grep -n "parseTsx" apps/web/lib/web-shell-regressions.test.ts`
Expected: no output.

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/web-shell-regressions.test.ts
git commit -m "test(117): scan JavaScript sources and parse each file by its extension"
```

---

### Task 3: Binding-aware layout wiring

Implements §6.1 **Layout wiring**.

**Files:**
- Modify: `apps/web/lib/web-shell-regressions.test.ts`: the helper section (new functions after `providerUses`) and the `mounts AppI18nProvider in the /app layout…` test

**Interfaces:**
- Consumes: `parseSource` (Task 2).
- Produces: `wrapsDashboardInBoundary(fileName: string, text: string): boolean`.

- [ ] **Step 1: Write the failing tests**

Replace the whole `it('mounts AppI18nProvider in the /app layout, directly around DashboardLayout', …)` block, through its closing `  });`, with:

```ts
  describe('layout-wiring check', () => {
    const PROVIDER = "import { AppI18nProvider } from '../../components/layout/app-i18n-provider';\n";
    const DASHBOARD = "import { DashboardLayout } from '../../components/layout/dashboard-layout';\n";
    const WRAPPED =
      'export default function Layout({ children }) {\n  return (\n    <AppI18nProvider>\n      <DashboardLayout>{children}</DashboardLayout>\n    </AppI18nProvider>\n  );\n}\n';
    const layoutReturning = (jsx: string) => `export default function Layout({ children }) {\n  return ${jsx};\n}\n`;

    it.each([
      ['the canonical wiring', `${PROVIDER}${DASHBOARD}${WRAPPED}`, true],
      [
        'aliased imports',
        "import { AppI18nProvider as Boundary } from '../../components/layout/app-i18n-provider';\nimport { DashboardLayout as Shell } from '../../components/layout/dashboard-layout';\n" +
          layoutReturning('<Boundary><Shell>{children}</Shell></Boundary>'),
        true,
      ],
      ['a wrong provider import path', `import { AppI18nProvider } from './app-i18n-provider';\n${DASHBOARD}${WRAPPED}`, false],
      ['a wrong DashboardLayout import path', `${PROVIDER}import { DashboardLayout } from '../../components/layout/other-layout';\n${WRAPPED}`, false],
      ['DashboardLayout not imported', `${PROVIDER}${WRAPPED}`, false],
      [
        'an impostor AppI18nProvider tag',
        "import { AppI18nProvider as Real } from '../../components/layout/app-i18n-provider';\nimport { AppI18nProvider } from './fake';\n" +
          `${DASHBOARD}${WRAPPED}`,
        false,
      ],
      ['an extra sibling inside the provider', `${PROVIDER}${DASHBOARD}${layoutReturning('<AppI18nProvider><DashboardLayout>{children}</DashboardLayout><div /></AppI18nProvider>')}`, false],
      ['DashboardLayout not a direct child', `${PROVIDER}${DASHBOARD}${layoutReturning('<AppI18nProvider><div><DashboardLayout>{children}</DashboardLayout></div></AppI18nProvider>')}`, false],
      [
        'two provider elements',
        `${PROVIDER}${DASHBOARD}${layoutReturning('<><AppI18nProvider><DashboardLayout>{children}</DashboardLayout></AppI18nProvider><AppI18nProvider /></>')}`,
        false,
      ],
    ])('accepts %s: %s', (_label, source, expected) => {
      expect(wrapsDashboardInBoundary('layout.tsx', source)).toBe(expected);
    });
  });

  it('mounts AppI18nProvider in the /app layout, directly around DashboardLayout', () => {
    expect(wrapsDashboardInBoundary('app/app/layout.tsx', readWebSource('app/app/layout.tsx'))).toBe(true);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: FAIL. Every `layout-wiring check` case and `mounts AppI18nProvider in the /app layout…` fail with `ReferenceError: wrapsDashboardInBoundary is not defined`. All other tests pass.

- [ ] **Step 3: Implement `wrapsDashboardInBoundary`**

Directly after the `providerUses` function, add:

```ts
function namedImportLocal(source: ts.SourceFile, moduleSpecifier: string, importedName: string) {
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (statement.moduleSpecifier.text !== moduleSpecifier) continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    const element = bindings.elements.find((candidate) => (candidate.propertyName ?? candidate.name).text === importedName);
    if (element) return element.name.text;
  }
  return undefined;
}

function jsxTagName(node: ts.Node) {
  if (ts.isJsxElement(node)) return node.openingElement.tagName;
  if (ts.isJsxSelfClosingElement(node)) return node.tagName;
  return undefined;
}

// §6.1 layout wiring: both tags must be the local names bound by named imports
// from these exact paths (aliases pass), and the provider element must directly
// wrap the DashboardLayout element.
function wrapsDashboardInBoundary(fileName: string, text: string) {
  const source = parseSource(fileName, text);
  const provider = namedImportLocal(source, '../../components/layout/app-i18n-provider', 'AppI18nProvider');
  const dashboard = namedImportLocal(source, '../../components/layout/dashboard-layout', 'DashboardLayout');
  if (!provider || !dashboard) return false;

  const hasTag = (node: ts.Node, localName: string) => {
    const tag = jsxTagName(node);
    return tag !== undefined && ts.isIdentifier(tag) && tag.text === localName;
  };
  const boundaries: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    if (hasTag(node, provider)) boundaries.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);

  const [boundary] = boundaries;
  if (boundaries.length !== 1 || !ts.isJsxElement(boundary)) return false;
  const children = boundary.children.filter((child) => !(ts.isJsxText(child) && child.containsOnlyTriviaWhiteSpaces));
  return children.length === 1 && hasTag(children[0], dashboard);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: PASS, all tests.

Run: `grep -n "openingElement.tagName.text === 'DashboardLayout'\|tagName.text === 'AppI18nProvider'" apps/web/lib/web-shell-regressions.test.ts`
Expected: no output (the name-only checks are gone).

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/web-shell-regressions.test.ts
git commit -m "test(117): bind the layout wiring check to the boundary and DashboardLayout imports"
```

---

### Task 4: Full verification and before/after demonstration

This task is a **demonstration**. It shows that each bypass from #117, plus Review Focus 3, passes the pre-amendment guard and fails the amended one. It is not the acceptance criterion: that is the Accepted §6.1 behaviour, pinned by the inline fixtures in Tasks 1–3. **No files are committed in this task.** Every probe file is temporary and removed in Step 4, and `layout.tsx` is restored byte-for-byte from a saved copy, never with `git checkout`.

**Files:**
- Temporary only (deleted in Step 4): `apps/web/lib/pre-117-guard.test.ts`, `apps/web/components/probe-mount.jsx`, `apps/web/lib/probe-barrel.ts`, `apps/web/components/probe-barrel-user.tsx`, `apps/web/lib/probe-generic.ts`

- [ ] **Step 1: Full suite, type-check and lint on the clean branch**

Run: `pnpm --filter web test && pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: all pass, exit 0.

- [ ] **Step 2: Set up the pre-amendment guard and save the layout**

Run: `git status --short && ls apps/web/lib/pre-117-guard.test.ts apps/web/components/probe-mount.jsx apps/web/lib/probe-barrel.ts apps/web/components/probe-barrel-user.tsx apps/web/lib/probe-generic.ts 2>&1 | grep -v 'No such file'`
Expected: no output. The tree is clean and no probe path exists yet. If anything is printed, stop and report it. Do not overwrite or delete it.

Run: `PROBE_DIR=$(mktemp -d) && cp apps/web/app/app/layout.tsx "$PROBE_DIR/layout.tsx.orig" && echo "$PROBE_DIR"`
Note the printed directory; it is used as `$PROBE_DIR` below. Shell variables do not persist between separate tool calls, so substitute the literal path.

Run: `git show main:apps/web/lib/web-shell-regressions.test.ts > apps/web/lib/pre-117-guard.test.ts`

The amended guard skips `*.test.*` files, so this copy never shows up in the tree scan.

- [ ] **Step 3: Probe each bypass against both guards**

For each probe below:
1. Create the probe files.
2. Run: `pnpm --filter web exec vitest run lib/pre-117-guard.test.ts -t "app i18n boundary structure"` and record the result.
3. Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts -t "app i18n boundary structure"` and record the result.
4. Remove only that probe's own files with `rm` on their exact paths. For probe (c), restore the layout with `cp "$PROBE_DIR/layout.tsx.orig" apps/web/app/app/layout.tsx`.

| Probe | Files | Pre-amendment guard | Amended guard |
| --- | --- | --- | --- |
| (a) `.jsx` mount (#117 item 1) | `components/probe-mount.jsx`: `import { ClensyI18nProvider } from '@clensy/web';\nexport const Probe = () => <ClensyI18nProvider locale="en">x</ClensyI18nProvider>;` | PASS (not scanned) | FAIL: `has exactly one provider mount…` lists `components/probe-mount.jsx`, and `has no provider escapes…` passes |
| (b) Re-export barrel (#117 item 2) | `lib/probe-barrel.ts`: `export { ClensyI18nProvider as P } from '@clensy/web';` and `components/probe-barrel-user.tsx`: `import { P } from '../lib/probe-barrel';\nexport const Probe = () => <P locale="en">x</P>;` | PASS | FAIL: `has no provider escapes…` lists `{ file: 'lib/probe-barrel.ts', count: 1 }` |
| (c) Name-only layout wiring (#117 item 3) | In `app/app/layout.tsx`, change the `DashboardLayout` import path to `'../../components/layout/app-sidebar'` (a file that exists, so only the guard can catch it) | PASS | FAIL: `mounts AppI18nProvider in the /app layout…` (expected `true`, got `false`) |
| (d) `.ts` generic arrow hides an escape (Review Focus 3) | `lib/probe-generic.ts`: `import { ClensyI18nProvider as P } from '@clensy/web';\nexport const identity = <T>(value: T) => value;\nexport default P;` | PASS | FAIL: `has no provider escapes…` lists `lib/probe-generic.ts` |

If any cell differs from the table, stop and report it. Do not change a fixture, the guard or the implementation just to reproduce the table. The table is demonstrative; the Accepted §6.1 is normative.

- [ ] **Step 4: Clean up and confirm the tree**

Run: `rm -f apps/web/lib/pre-117-guard.test.ts apps/web/components/probe-mount.jsx apps/web/lib/probe-barrel.ts apps/web/components/probe-barrel-user.tsx apps/web/lib/probe-generic.ts && cmp "$PROBE_DIR/layout.tsx.orig" apps/web/app/app/layout.tsx && rm -r "$PROBE_DIR" && git status --short`
Expected: no output. `cmp` confirms the layout is byte-identical to the saved copy, and the tree is clean. If `cmp` reports a difference, restore with `cp "$PROBE_DIR/layout.tsx.orig" apps/web/app/app/layout.tsx` and re-run.

Run: `git diff --stat main -- apps packages .github`
Expected: only `apps/web/lib/web-shell-regressions.test.ts` changed (no production code, §6.1 / #117 acceptance).

- [ ] **Step 5: Record the outcome**

Paste the filled-in Step 3 table into the M6 Slice Completion Report and the PR description. There is no commit for this task.

---

## Traceability

| Spec requirement (§6.1 as amended) | Task |
| --- | --- |
| Syntactic parser-only guard | 1–3 (only `ts.createSourceFile`) |
| Scanned files: extension set and exclusions | 2 (`isScannedSource`, selection table) |
| `ScriptKind` by extension | 2 (`scriptKindFor`, the `.js`/`.jsx`/`.mjs`/generic-arrow rows) |
| Provider bindings (exact `'@clensy/web'`, named and aliased, namespace) | 1 (unchanged `clensyProviderBindings`, with a shared specifier check) |
| Provider mounts; exactly one, in `app-i18n-provider.tsx` | 1 (mount rows, tree test now reading `.mounts`) |
| Escape item 1, package re-exports | 1 (four re-export rows plus one non-provider re-export row) |
| Escape item 2, named-binding occurrences and exemptions | 1 (value, default, shorthand, `createElement`, `typeof`, non-reference rows) |
| Escape item 3, namespace occurrences and exemptions | 1 (value, element access, `W.foo`, `<W.Button />`, bare `W`, import-equals including nested, `typeof` including nested and bare, qualified-type rows including nested and with type arguments) |
| Exempt import specifiers (items 2 and 3) | 1 (the named, aliased, namespace and mixed import-only rows; the other-module same-name row fails closed) |
| No scope analysis; shadowing fails closed | 1 (`a shadowing local` row expects 2) |
| Zero escapes anywhere, an independent assertion | 1 (`has no provider escapes anywhere in apps/web`) |
| Layout wiring bound to imports, aliases pass, direct wrap | 3 |
| Fixture for every closed bypass, failing pre-amendment | 1–3 (inline fixtures), 4 (before/after demonstration) |
| No production code change | 4 Step 4 |
| Secondary text guard unchanged | Not touched by any task |
