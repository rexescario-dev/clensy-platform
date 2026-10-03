# App i18n Boundary Guard: False-Positive Narrowing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Draft |
| Date | 2026-10-03 |
| Tracking issue | [#124](https://github.com/rexescario-dev/clensy-platform/issues/124): the #117 deferred minors, plus the #122 characterisation fixture |
| Scope | `apps/web/lib/web-shell-regressions.test.ts` only. No production code, package, CI or catalog change. The workflow-process observations are out of scope and go upstream to `rexescario-dev/context-forge` as a separate PR. |
| Implements (Accepted) | [Single App-Level `ClensyI18nProvider` — Design](../specs/2026-10-02-single-app-i18n-provider-design.md) §6.1 as amended by #124: Scanned files `ScriptKind`, Provider escapes items 2–3, the non-reference names paragraph, and "Fixtures (#124)". Status **Accepted** (M3, 2026-10-03, amendment at `03582a0`). |
| Relies on (Accepted) | The #117, #120 and #122 implementations of the same §6.1. This plan changes only `scriptKindFor`, `isNamedTypeQuery`, `isNonReferenceName` (plus a new `isImportTypeQualifierName`), a new `isTypeOnlyHeritageName`, and one condition in `providerUses`. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. Helper names, grouping and test names are planning decisions. M3 constraint: every exemption is an **exact syntax-position test on the precise name node**, never "anything under" a construct. Each newly exempt position is paired with a retained-escape fixture wherever an over-broad predicate is plausible, and `class … extends W.X` stays pinned as an escape. |
| Edit anchors | Every edit is located by the **quoted code**, not by line number. Line numbers are approximate, taken from `main` at `c339812`. |
| Pre-validation | This plan's text was replayed task by task: each task's code blocks were extracted from the plan and applied in order to a copy of the guard outside the repo. That copy was checked with **every command the `Expected:` lines name**: Vitest, `tsc` in strict mode, and ESLint with `apps/web`'s own config. Each task's RED set was measured, not inferred: Task 1 had 4 failing rows, Task 2 had 5, Task 3 had 14, and Task 4 had 0. The GREEN counts were 141, 150, 171 and 172. On the real tree there are still 0 escapes. These changes only remove escapes, so the real tree's zero cannot regress, but the full-suite and tree-zero checks are kept as confirmation. |

**Goal:** Remove the five #117-deferred false positives from the provider-escape detector, without exempting any position that can load or mount the provider. Also pin the #122 `node_modules` interaction.

**Architecture:** Every change is a narrower predicate at one exact syntax position:
- `scriptKindFor` maps by suffix (`tsx` → TSX, `jsx` → JSX).
- `isNamedTypeQuery` walks only the `.left` chain of a qualified name up to its `typeof` query.
- `isTypeOnlyHeritageName` walks only the `.expression` chain of a property access up to an `ExpressionWithTypeArguments`, whose heritage clause is `implements`, or `extends` on an interface.
- `isNonReferenceName` adds name-node checks of the form `parent.name === identifier`, `parent.label === identifier` and `parent.right === identifier`, plus `isImportTypeQualifierName`, which requires the climbed qualified name to *be* the import type node's `qualifier`.

**Tech Stack:** the TypeScript 5.9 compiler API, Vitest, ESLint, and `pnpm --filter web`.

**Spec:** `docs/superpowers/specs/2026-10-02-single-app-i18n-provider-design.md` (§6.1)

## Global Constraints

Copied from the Accepted spec (§6.1 as amended by #124). Every task implicitly includes these.

- **Exact positions.** Each exemption SHALL test that the identifier *is* the specific name node: the `name`, `label`, qualified-name `right`, import-type `qualifier`, query `exprName`, or heritage expression. It SHALL NOT exempt anything merely because it sits under an `InterfaceDeclaration`, `ClassDeclaration`, `ImportTypeNode`, `TypeQueryNode` or `HeritageClause`.
- **Named binding (item 2).** Additionally exempt as the leftmost name of a qualified name inside a `typeof` query. `const Q = P.displayName` SHALL stay an escape. There SHALL be no named heritage exemption (`class C implements P` stays an escape).
- **Namespace binding (item 3).** Additionally exempt as the leftmost name of the expression in a class `implements` clause or an interface `extends` clause. A class `extends` clause is runtime heritage and SHALL NEVER be exempt. This covers class declarations and class expressions alike.
- **Non-reference names.** Add exactly these positions:
  - interface and type-literal property and method signature names;
  - class property, method and accessor names;
  - object-literal method and accessor names;
  - enum member names;
  - labels (labeled statement, `break`, `continue`);
  - the right-hand side of a qualified name;
  - names in an import type node's qualifier.

  These SHALL stay counted: shorthand `{ P }`, computed `[P]`, parameters and other shadowing declarations, value uses, import type *arguments*, and member *types*.
- **ScriptKind.** A scanned name ending `tsx` → TSX; ending `jsx` → JSX. The scan regex SHALL NOT change.
- No new invariant or assertion. The package boundary, the dashboard shell, load calls and every other rule SHALL stay unchanged.
- No production code or package change.
- Commit messages use the repo's `type(124): …` style and carry **no** `Co-Authored-By` trailer and no "Generated with" line (owner's global instruction).

## Review Focus

Over-broad exemptions are the risk this time, most likely first. Each one has a pinning fixture in the task named.

1. **A heritage exemption that includes class `extends`.** Checking only "is in a heritage clause" would exempt `class C extends W.ClensyI18nProvider`, a runtime subclass. Pinned in Task 2 (class declaration and class expression).
2. **An "under the construct" exemption.** Exempting anything inside an interface or an import type node would exempt `interface I { a: W }` (a member *type*) and `import('x').A<W>` (a type *argument*). Pinned in Task 3.
3. **Exemptions that leak into value positions.** A label exemption must not exempt `f(P)` inside the labelled loop. An enum exemption must not exempt `A = P`. Computed names `[P]` and parameters must stay counted. Pinned in Task 3.
4. **A `typeof` walk that climbs too far.** Only the `.left` chain up to the query counts. `const Q = P.displayName` stays an escape. Pinned in Task 2.
5. **Named heritage.** The spec gives the named binding no heritage exemption, so `class C implements P` stays an escape. Pinned in Task 2.

## File Map

| File | Change | Responsibility |
| --- | --- | --- |
| `apps/web/lib/web-shell-regressions.test.ts` | Modify | `scriptKindFor`, `isNamedTypeQuery`, `isNonReferenceName` and the new `isImportTypeQualifierName`, the new `isTypeOnlyHeritageName`, one condition in `providerUses`, and rows in the `provider-use detector` table |

All new rows go into the `provider-use detector` table, directly after the row `['a deep load call (a boundary violation, not an escape)', 'fixture.js', "const m = require('@clensy/web/src');", 0, 0],`. Each task appends its block after the previous task's block.

---

### Task 1: `ScriptKind` by suffix

Implements §6.1 Scanned files (#124).

**Files:** Modify `apps/web/lib/web-shell-regressions.test.ts`: `scriptKindFor` and the `provider-use detector` table.

**Interfaces:** Consumes `providerUses`. Produces no new name.

- [ ] **Step 1: Write the failing tests**

Add directly after the row `['a deep load call (a boundary violation, not an escape)', …],`:

```ts
      // #124: *tsx files parse as TSX, *jsx as JSX (§6.1 Scanned files).
      ['a .mtsx mount', 'fixture.mtsx', `${NAMED}export const x = <ClensyI18nProvider />;`, 1, 0],
      ['a .ctsx mount', 'fixture.ctsx', `${NAMED}export const x = <ClensyI18nProvider />;`, 1, 0],
      ['a .mjsx mount', 'fixture.mjsx', `${NAMED}export const x = <ClensyI18nProvider />;`, 1, 0],
      ['a .cjsx mount', 'fixture.cjsx', `${NAMED}export const x = <ClensyI18nProvider />;`, 1, 0],
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: FAIL. Exactly these 4 rows fail, because the files are parsed as TS and the mount is missed (`mounts` is not 1):
- `counts a .mtsx mount correctly`
- `counts a .ctsx mount correctly`
- `counts a .mjsx mount correctly`
- `counts a .cjsx mount correctly`

All other tests pass.

- [ ] **Step 3: Implement**

In `scriptKindFor`, replace:

```ts
  if (fileName.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (fileName.endsWith('.jsx')) return ts.ScriptKind.JSX;
```

with:

```ts
  if (fileName.endsWith('tsx')) return ts.ScriptKind.TSX;
  if (fileName.endsWith('jsx')) return ts.ScriptKind.JSX;
```

Only scanned names reach this function, and `SCANNED_SOURCE` admits only `.(m|c)?[jt]sx?`. So a `tsx` suffix means `.tsx`/`.mtsx`/`.ctsx`, and a `jsx` suffix means `.jsx`/`.mjsx`/`.cjsx`. `SCANNED_SOURCE` is unchanged.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: PASS, all tests.

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/web-shell-regressions.test.ts
git commit -m "test(124): parse *tsx scanned files as TSX and *jsx as JSX"
```

---

### Task 2: The named `typeof` exemption and namespace type-only heritage

Implements §6.1 Provider escapes item 2 (`typeof P.x`) and item 3 (type-only heritage).

**Files:** Modify `apps/web/lib/web-shell-regressions.test.ts`: `isNamedTypeQuery`, a new `isTypeOnlyHeritageName` (before `function packageReExportEscapes`), the namespace condition in `providerUses`, and the table.

**Interfaces:** Produces `isTypeOnlyHeritageName(identifier: ts.Identifier): boolean`.

- [ ] **Step 1: Write the failing tests**

Add directly after Task 1's block:

```ts
      // #124: the named typeof exemption and namespace type-only heritage (§6.1 items 2–3).
      ['a qualified typeof of the named binding', 'fixture.ts', `${ALIASED}type T = typeof P.displayName;`, 0, 0],
      ['a deeper qualified typeof of the named binding', 'fixture.ts', `${ALIASED}type T = typeof P.a.b;`, 0, 0],
      ['a namespace in a class implements clause', 'fixture.ts', `${NAMESPACE}class C implements W.Foo {}`, 0, 0],
      ['a namespace in a class-expression implements clause', 'fixture.ts', `${NAMESPACE}const C = class implements W.Foo {};`, 0, 0],
      ['a namespace in an interface extends clause', 'fixture.ts', `${NAMESPACE}interface I extends W.Foo {}`, 0, 0],
      ['a value use of a provider property', 'fixture.ts', `${ALIASED}const Q = P.displayName;`, 0, 1],
      ['a namespace in a class extends clause (runtime heritage)', 'fixture.ts', `${NAMESPACE}class C extends W.ClensyI18nProvider {}`, 0, 1],
      ['a namespace in a class-expression extends clause (runtime heritage)', 'fixture.ts', `${NAMESPACE}const C = class extends W.Foo {};`, 0, 1],
      ['a named binding in an implements clause (no named heritage exemption)', 'fixture.ts', `${ALIASED}class C implements P {}`, 0, 1],
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: FAIL. Exactly these 5 rows fail, each receiving `{ mounts: 0, escapes: 1 }` instead of `{ mounts: 0, escapes: 0 }`:
- `counts a qualified typeof of the named binding correctly`
- `counts a deeper qualified typeof of the named binding correctly`
- `counts a namespace in a class implements clause correctly`
- `counts a namespace in a class-expression implements clause correctly`
- `counts a namespace in an interface extends clause correctly`

The 4 retained-escape rows already pass (value use, class `extends` ×2, named `implements`). They pin Review Focus 1, 4 and 5 for Step 3. All other tests pass.

- [ ] **Step 3: Implement**

Replace:

```ts
function isNamedTypeQuery(identifier: ts.Identifier) {
  return ts.isTypeQueryNode(identifier.parent) && identifier.parent.exprName === identifier;
}
```

with:

```ts
// §6.1 item 2: `typeof P`, or (#124) P as the leftmost name of a qualified name
// inside a `typeof` query (`typeof P.displayName`). `const Q = P.displayName`
// is a value use and stays an escape.
function isNamedTypeQuery(identifier: ts.Identifier) {
  let entityName: ts.Node = identifier;
  while (ts.isQualifiedName(entityName.parent) && entityName.parent.left === entityName) entityName = entityName.parent;
  return ts.isTypeQueryNode(entityName.parent) && entityName.parent.exprName === entityName;
}
```

Directly before `function packageReExportEscapes(declaration: ts.ExportDeclaration) {`, add:

```ts
// §6.1 item 3 (#124): type-only heritage. W is exempt only as the leftmost name
// of the expression in a class `implements` clause or an interface `extends`
// clause. A class `extends` clause is runtime heritage and is never exempt.
function isTypeOnlyHeritageName(identifier: ts.Identifier) {
  let expression: ts.Node = identifier;
  while (ts.isPropertyAccessExpression(expression.parent) && expression.parent.expression === expression) expression = expression.parent;
  const heritageType = expression.parent;
  if (!ts.isExpressionWithTypeArguments(heritageType) || heritageType.expression !== expression) return false;
  const clause = heritageType.parent;
  if (!ts.isHeritageClause(clause)) return false;
  return clause.token === ts.SyntaxKind.ImplementsKeyword || ts.isInterfaceDeclaration(clause.parent);
}
```

In `providerUses`, replace:

```ts
      if (namespaces.has(node.text) && !isNamespaceMountTag(node) && !isNamespaceTypePosition(node)) escapes += 1;
```

with:

```ts
      if (namespaces.has(node.text) && !isNamespaceMountTag(node) && !isNamespaceTypePosition(node) && !isTypeOnlyHeritageName(node)) {
        escapes += 1;
      }
```

The heritage exemption applies to namespace bindings only. Item 2 gives the named binding none.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: PASS, all tests. The class `extends` rows still report 1 escape.

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/web-shell-regressions.test.ts
git commit -m "test(124): exempt typeof P.x and namespace type-only heritage, keeping class extends an escape"
```

---

### Task 3: Declaration-name positions and import type qualifiers

Implements the §6.1 non-reference names paragraph (#124).

**Files:** Modify `apps/web/lib/web-shell-regressions.test.ts`: `isNonReferenceName` (and its comment), a new `isImportTypeQualifierName` placed directly after it, and the table.

**Interfaces:** Produces `isImportTypeQualifierName(identifier: ts.Identifier): boolean`.

- [ ] **Step 1: Write the failing tests**

Add directly after Task 2's block:

```ts
      // #124: declaration-name positions and import type qualifiers (§6.1 non-reference names).
      ['a namespace name in an import type qualifier', 'fixture.ts', `${NAMESPACE}type T = import('x').W;`, 0, 0],
      ['a namespace name in a nested import type qualifier', 'fixture.ts', `${NAMESPACE}type T = import('x').A.W;`, 0, 0],
      ['an interface property signature name', 'fixture.ts', `${ALIASED}interface I {\n  P: string;\n}`, 0, 0],
      ['a type-literal method signature name', 'fixture.ts', `${ALIASED}type T = { P(): void };`, 0, 0],
      ['a class property name', 'fixture.ts', `${ALIASED}class C {\n  P = 1;\n}`, 0, 0],
      ['a class method name', 'fixture.ts', `${ALIASED}class C {\n  P() {}\n}`, 0, 0],
      ['class accessor names', 'fixture.ts', `${ALIASED}class C {\n  get P() {\n    return 1;\n  }\n  set P(value: number) {}\n}`, 0, 0],
      ['an object-literal method name', 'fixture.ts', `${ALIASED}const o = { P() {} };`, 0, 0],
      ['an object-literal getter name', 'fixture.ts', `${ALIASED}const o = {\n  get P() {\n    return 1;\n  },\n};`, 0, 0],
      ['an enum member name', 'fixture.ts', `${ALIASED}enum E {\n  P,\n}`, 0, 0],
      ['a label with break', 'fixture.ts', `${ALIASED}P: for (;;) {\n  break P;\n}`, 0, 0],
      ['a label with continue', 'fixture.ts', `${ALIASED}P: for (;;) {\n  continue P;\n}`, 0, 0],
      ['the right side of a qualified type name', 'fixture.ts', `${ALIASED}type T = X.P;`, 0, 0],
      ['a value use inside a labeled loop', 'fixture.ts', `${ALIASED}P: for (;;) {\n  f(P);\n}`, 0, 1],
      ['a namespace as an import type argument (not the qualifier)', 'fixture.ts', `${NAMESPACE}type T = import('x').A<W>;`, 0, 1],
      ['a namespace as an interface member type (not a name position)', 'fixture.ts', `${NAMESPACE}interface I {\n  a: W;\n}`, 0, 1],
      ['a namespace value alias', 'fixture.ts', `${NAMESPACE}const X = W;`, 0, 1],
      ['a computed property name', 'fixture.ts', `${ALIASED}const o = { [P]: 1 };`, 0, 1],
      ['a computed class member name', 'fixture.ts', `${ALIASED}class C {\n  [P] = 1;\n}`, 0, 1],
      ['a parameter named like the binding', 'fixture.ts', `${ALIASED}function f(P: number) {\n  return 1;\n}`, 0, 1],
      ['an enum member initializer', 'fixture.ts', `${ALIASED}enum E {\n  A = P,\n}`, 0, 1],
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: FAIL. Exactly these 14 rows fail:
- 13 newly exempt rows, each receiving at least one escape:
  - `a namespace name in an import type qualifier`
  - `a namespace name in a nested import type qualifier`
  - `an interface property signature name`
  - `a type-literal method signature name`
  - `a class property name`
  - `a class method name`
  - `class accessor names`
  - `an object-literal method name`
  - `an object-literal getter name`
  - `an enum member name`
  - `a label with break`
  - `a label with continue`
  - `the right side of a qualified type name`
- `counts a value use inside a labeled loop correctly`. This is a retained-escape pin whose expected value is **1**, but it currently receives **2**, because the label `P` is also counted. It turns GREEN only when labels become non-reference and `f(P)` stays counted. That is the Review Focus 3 pin.

The other 7 retained-escape rows already pass and pin Review Focus 2–3:
- the import type argument;
- the interface member type;
- the namespace value alias;
- the computed property;
- the computed class member;
- the parameter;
- the enum initializer.

All other tests pass.

- [ ] **Step 3: Implement**

Replace the whole comment and function:

```ts
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
```

with:

```ts
// Occurrences are by spelling, with no scope analysis. These exact name
// positions are names rather than references, so they are never counted
// (§6.1; the declaration-name positions were added by #124). Each test checks
// that the identifier IS the name/label/right/qualifier node itself, never
// merely that it sits somewhere under the construct.
function isNonReferenceName(identifier: ts.Identifier) {
  const { parent } = identifier;
  return (
    (ts.isPropertyAccessExpression(parent) && parent.name === identifier) ||
    (ts.isPropertyAssignment(parent) && parent.name === identifier) ||
    (ts.isJsxAttribute(parent) && parent.name === identifier) ||
    ((ts.isPropertySignature(parent) || ts.isMethodSignature(parent)) && parent.name === identifier) ||
    ((ts.isPropertyDeclaration(parent) || ts.isMethodDeclaration(parent) || ts.isGetAccessorDeclaration(parent) || ts.isSetAccessorDeclaration(parent)) &&
      parent.name === identifier) ||
    (ts.isEnumMember(parent) && parent.name === identifier) ||
    ((ts.isLabeledStatement(parent) || ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) && parent.label === identifier) ||
    (ts.isQualifiedName(parent) && parent.right === identifier) ||
    isImportTypeQualifierName(identifier)
  );
}

// `import('x').W`, `import('x').A.W`: names inside an import type node's
// qualifier. Type arguments (`import('x').A<W>`) are not part of the qualifier.
function isImportTypeQualifierName(identifier: ts.Identifier) {
  let name: ts.Node = identifier;
  while (ts.isQualifiedName(name.parent)) name = name.parent;
  return ts.isImportTypeNode(name.parent) && name.parent.qualifier === name;
}
```

Each new disjunct compares the identifier with the exact name node. `isImportTypeQualifierName` climbs only qualified names and then requires the result to *be* `qualifier`, so a type argument (`import('x').A<W>`) is never exempt.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: PASS, all tests. `has no provider escapes anywhere in apps/web` still passes.

Run: `pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/web-shell-regressions.test.ts
git commit -m "test(124): treat declaration names, labels and import type qualifiers as non-references"
```

---

### Task 4: The #122 characterisation row and full verification

Implements the "Fixtures (#124)" characterisation requirement. This row is **not a red test**: the behaviour is already correct, and the row pins it.

**Files:** Modify `apps/web/lib/web-shell-regressions.test.ts`: the table.

- [ ] **Step 1: Add the characterisation row**

Add directly after Task 3's block:

```ts
      // #124: characterisation of the #122 interaction (already correct; not a red test).
      ['a provider imported through the node_modules link (a boundary violation, not a mount)', 'fixture.tsx', "import { ClensyI18nProvider as P } from '../../node_modules/@clensy/web';\nconst x = <P />;", 0, 0],
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: PASS, all tests, including `counts a provider imported through the node_modules link (a boundary violation, not a mount) correctly`. It passes on first run because it characterises existing behaviour. The same specifier is already a boundary violation (pinned by #122's `reports the node_modules/@clensy/web link`).

- [ ] **Step 3: Full suite, type-check, lint and scope**

Run: `pnpm --filter web test && pnpm --filter web exec tsc --noEmit && pnpm --filter web lint`
Expected: all pass, exit 0. The tree tests for provider escapes, boundary violations and the dashboard shell are unchanged.

Run: `git status --short && git diff --stat main -- apps packages .github`
Expected: a clean tree, with only `apps/web/lib/web-shell-regressions.test.ts` changed.

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/web-shell-regressions.test.ts
git commit -m "test(124): pin the node_modules/@clensy/web provider interaction"
```

---

## Traceability

| Spec requirement (§6.1 as amended by #124) | Task |
| --- | --- |
| `*tsx` → TSX, `*jsx` → JSX; scan regex unchanged | 1 (four mount rows) |
| Named binding: leftmost name in a `typeof` qualified name exempt; value use stays an escape | 2 (two exempt rows, `a value use of a provider property`) |
| Namespace: type-only heritage (`implements`, interface `extends`) exempt; class `extends` never exempt; named binding gets no heritage exemption | 2 (three exempt rows, class and class-expression `extends`, named `implements`) |
| Non-reference names: signatures, class and object members and accessors, enum members, labels, the right-hand side of a qualified name, import type qualifiers | 3 (13 exempt rows) |
| Still counted: shorthand, computed names, parameters and shadowing, value uses, import type arguments, member types | 3 (seven passing pins plus the labelled-loop pin), and the #117 shorthand and shadowing rows |
| Exact syntax positions, never "under a construct" | 2 and 3 (the interface member type, import type argument and labelled-loop pins) |
| #122 characterisation: `node_modules` provider import gives 0 mounts and 0 escapes | 4 |
| No invariant or assertion change; no production change | 4 Step 3 |
