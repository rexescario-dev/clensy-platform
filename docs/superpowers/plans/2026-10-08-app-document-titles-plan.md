# `/app` Document Titles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | Accepted |
| M5 decision | **Accepted** — 2026-10-08, at `5f766df`, by the owner, on the second pass, with no further revision. M6 MUST implement Tasks 1–4 as written, including the syntax-tree ownership regressions and their mutation checks, and record Task 5's server-render and before/after client-navigation evidence; M7 MUST be a fresh independent review (`CLAUDE.md`). |
| M5 history | First pass (2026-10-08) returned two required changes and three improvements, all applied without changing the approach. **Required:** `NAV_ITEMS` is stated as a derived view of `NAV_GROUPS`, not a configuration source (Architecture, Task 2 Step 3); the `/app` and `/login` metadata regressions read exported names from the syntax tree, so every export form counts and `export *` fails closed (Task 4 Steps 1 and 3). **Improvements:** one-contribution versus one-effective-title wording (Global Constraints); the root-title regression reads the `metadata` object's properties from the syntax tree instead of a formatting-dependent regex (Task 4 Step 1); Task 5 records the title and announcer text before and after the navigation. Task 4 was re-pre-validated after the change (Pre-validation). |
| Date | 2026-10-08 |
| Tracking issue | [#143](https://github.com/rexescario-dev/clensy-platform/issues/143). Program [#81](https://github.com/rexescario-dev/clensy-platform/issues/81). |
| Scope | `apps/web` only: `messages/en/nav.json`, `i18n/messages.test.ts`, `lib/nav-groups.ts`, `lib/nav-groups.test.ts`, `components/layout/page-visibility-gate.tsx`, `lib/page-visibility-gate.test.tsx`, `app/layout.tsx`, a new `app/login/layout.tsx`, and `lib/web-shell-regressions.test.ts`. No `apps/api`, `packages/*`, middleware, `next.config.ts`, page or `/app` layout changes. |
| Implements (Accepted) | [Page-Specific Document Titles for `/app` Pages — Design](../specs/2026-10-08-app-document-titles-design.md), Status **Accepted** (M3, 2026-10-08, `c780fbc`; recorded at `ac8e101`), together with the [role-aware typed-URL spec](../specs/2026-10-04-role-aware-typed-urls-design.md)'s **title amendment (#143)**, Accepted at the same pass. |
| Relies on (Accepted) | The remainder of the role-aware typed-URL spec, unchanged (`findActiveHref`, `isGatedPath`, `canViewPath`, the gate's rows and mount rules); [Web Shell and Design System](../specs/2026-09-10-web-shell-and-design-system-design.md) (single `/app` layout); [Single App-Level `ClensyI18nProvider`](../specs/2026-10-02-single-app-i18n-provider-design.md). |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. Helper names (`NAV_ITEMS`, `Titled`, `expectTitle`), test wording, comment text and task order are planning decisions, not product semantics. |
| Edit anchors | Every edit is located by the **quoted code**, not by line number. The branch base is `e74fae6` (`main`); the spec commits on top don't touch code. |

**Goal:** Deliver the Accepted document titles spec. `pageTitleKey` names a path's page from `NAV_GROUPS` and `PLATFORM_HOME_HREF`. `PageVisibilityGate` renders exactly one React `<title>` per row, describing the row actually rendered. Titles are formatted only through three new `nav` keys. The root layout stops setting a title, and `/login` keeps "Clensy" through its own server layout.

**Architecture:**

- **Copy (Task 1).** `nav.documentTitle.app` (`Clensy`), `nav.documentTitle.page` (`{page} · Clensy`) and `nav.unavailable.title` (`Page unavailable`).
- **Resolver (Task 2).** `pageTitleKey(pathname)` in `lib/nav-groups.ts`: `findActiveHref` → that item's `labelKey`; else a platform path → `platform.title`; else `undefined`. A module-local `NAV_ITEMS` is introduced as a **derived view of `NAV_GROUPS`** (its items, flattened), not an independent configuration source or mapping, and `ALL_HREFS` is derived from it so the flattening happens once. `findActiveHref`'s contract is unchanged; `pageTitleKey` looks up the item for the href it returns.
- **Gate (Task 3).** The gate computes the requested path's title once, `nav.documentTitle.page` with `t(pageTitleKey)` or `nav.documentTitle.app`, and wraps every row's existing output in a module-local `Titled` component: a fragment of `<title>{title}</title>` plus the row. The denied row uses `nav.documentTitle.page` with `nav.unavailable.title`. The gate's branches, hooks, decision and visible output are unchanged.
- **Root and `/login` (Task 4).** `metadata.title` is removed from `app/layout.tsx`. **`/login` mechanism (the M4 decision the spec delegates, §4.4):** a new server `app/login/layout.tsx` exports `generateMetadata` returning `title: t('documentTitle.app')` through `next-intl/server` `getTranslations('nav')`. This is chosen over a React `<title>` in the client login page because it keeps `<title>` JSX unique to the gate (spec §8 item 3), is Next-native, and adds no layout under `/app`.

**Tech Stack:** Next.js 16 App Router, React 19 (hoisted `<title>`), next-intl 4 (`useTranslations`, `getTranslations`), Vitest in the `node` environment with `react-dom/server` `renderToStaticMarkup`. In static markup React emits a rendered `<title>` at the front of the output, which is what the gate tests extract.

**Pre-validation (full).** Before M5, on 2026-10-08, all four tasks were applied verbatim from this plan's text to a working tree at `ac8e101`, in task order and each test-first. Every command named by an `Expected:` line ran with the stated result: each RED state, each GREEN state, both Task 4 mutation checks, and the final verification. The tree was then reverted. Commands run:

- `pnpm --filter web exec vitest run i18n/messages.test.ts` (RED 2 failed / 3 passed, then GREEN 5)
- `pnpm --filter web exec vitest run lib/nav-groups.test.ts` (RED 18 failed / 226 passed, then GREEN 244)
- `pnpm --filter web exec vitest run lib/page-visibility-gate.test.tsx` (RED 13 failed / 21 passed, then GREEN 34)
- `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts` (RED 2 failed / 182 passed; GREEN 184). After the M5 first pass the Task 4 test block was replaced with the syntax-tree version and re-run: RED 2 failed / 182 passed; GREEN 184; the declaration, export-list, star and root-spread mutations each 1 failed / 183 passed; the `<title>` mutation 1 failed / 183 passed in the first run. With it, the full suite (547), tsc and lint were re-run and passed.
- `pnpm --filter web test` (17 files, 547 tests passed)
- `pnpm --filter web exec tsc --noEmit`, `pnpm --filter web lint`, `pnpm --filter web build` (exit 0)
- The Final verification diff (empty)
- The server-render half of the recorded evidence (Task 5 Step 1), against that build. It gave exactly one `<title>` per route: `/app` `Clensy`, `/app/customers` `Customers · Clensy`, `/app/platform` `Platform · Clensy`, `/app/catalog` `Services · Clensy`, `/login` `Clensy`. The gated routes' HTML contained the `LoadingState` markup, so the server rendered the loading row.

The client-navigation half (Task 5 Step 2) needs a running API with a seeded session and was **not** pre-run.

## Global Constraints

Copied from the Accepted spec. Every task's requirements implicitly include this section.

- `NAV_GROUPS` and `PLATFORM_HOME_HREF` are the only page-specific title sources. `pageTitleKey` adds no list, map or table of paths or titles, shares `canViewPath`'s path matching only, and never inspects or calls the principal decision. It returns `undefined` when nothing resolves; only the gate turns that into `nav.documentTitle.app` (§4.1, §5 invariant 1).
- For every gate row, `PageVisibilityGate` renders exactly one React `<title>` **contribution**, and no other `/app` source contributes a title (§4.3, §5 invariant 2). React hoists it into `<head>`, so it has no DOM relationship to the row. The **effective document** then has exactly one title, after React's head processing, with no root-layout title competing (§5 invariant 4, verified by Task 5).
- The title describes the rendered row: the denied row is always the unavailable title; the loading row uses the requested path's title from the same resolver as the allowed row (§4.3, §5 invariant 3).
- Titles come only from the §4.2 patterns; no code concatenates a page name, separator and app name (§4.2, §5 invariant 5).
- The visibility rule, the gate decision, its visible rows, hooks and mount rules, and API behavior are unchanged (§4.3, §5 invariant 7).
- The root `metadata` sets no `title`. `/login` has exactly one title source, whose text is `nav.documentTitle.app`. No layout is added under `/app` (§4.4, §5 invariant 8).

## Review Focus

1. **Gate behavior drift.** Task 3 only wraps each existing return value in `Titled`. Every pre-existing gate test (mounting, `LoadingState`, unavailable heading, home link) must still pass unchanged.
2. **A second title source.** The Task 4 regressions fail if any other non-test source contains `<title`, or if any `/app` source exports `metadata`/`generateMetadata` in any export form (read from the syntax tree; `export *` fails closed). Their mutation checks prove each form is caught. (A comment containing the literal text `<title` also trips the first, so comments say "title element".)
3. **The loading row.** Its title must equal the allowed row's for the same path (a dedicated Task 3 test).

---

## File Map

| File | Change | Task |
| --- | --- | --- |
| `apps/web/i18n/messages.test.ts` | Pin `nav.unavailable.title` and `nav.documentTitle` | 1 |
| `apps/web/messages/en/nav.json` | Add `documentTitle.app`, `documentTitle.page`, `unavailable.title` | 1 |
| `apps/web/lib/nav-groups.test.ts` | Import `pageTitleKey`; add a `pageTitleKey` describe block | 2 |
| `apps/web/lib/nav-groups.ts` | Add `NAV_ITEMS`; derive `ALL_HREFS` from it; add `pageTitleKey` | 2 |
| `apps/web/lib/page-visibility-gate.test.tsx` | Add `expectTitle`; add a `document title` describe block | 3 |
| `apps/web/components/layout/page-visibility-gate.tsx` | Import `pageTitleKey`; compute the title; wrap every row in `Titled`; add `Titled` | 3 |
| `apps/web/lib/web-shell-regressions.test.ts` | Add a `document title ownership` describe block | 4 |
| `apps/web/app/layout.tsx` | Remove `title` from `metadata`; add a comment | 4 |
| `apps/web/app/login/layout.tsx` | New server layout with `generateMetadata` | 4 |

---

### Task 1: Title copy (spec §4.2; §8 item 4)

**Files:**
- Modify: `apps/web/i18n/messages.test.ts`
- Modify: `apps/web/messages/en/nav.json`

- [ ] **Step 1: Pin the copy.** In `apps/web/i18n/messages.test.ts`, replace:

```ts
      message: "This page isn't available to you.",
    });
  });
```

with:

```ts
      message: "This page isn't available to you.",
      title: 'Page unavailable',
    });
  });

  // Document titles spec §4.2 (#143): the format is message-owned.
  it('carries the document title patterns in nav.documentTitle', () => {
    expect(getMessages().nav.documentTitle).toEqual({
      app: 'Clensy',
      page: '{page} · Clensy',
    });
  });
```

- [ ] **Step 2: Run it and watch it fail.**

Run: `pnpm --filter web exec vitest run i18n/messages.test.ts`
Expected: FAIL, 2 failed and 3 passed: the `nav.unavailable` test (no `title`) and the new `nav.documentTitle` test (`undefined`).

- [ ] **Step 3: Add the keys.** In `apps/web/messages/en/nav.json`, replace `{` + newline + `  "groups": {` (the file's opening) with:

```json
{
  "documentTitle": {
    "app": "Clensy",
    "page": "{page} · Clensy"
  },
  "groups": {
```

  and replace `    "message": "This page isn't available to you."` + newline + `  },` with:

```json
    "message": "This page isn't available to you.",
    "title": "Page unavailable"
  },
```

- [ ] **Step 4: Run it and watch it pass.**

Run: `pnpm --filter web exec vitest run i18n/messages.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/i18n/messages.test.ts apps/web/messages/en/nav.json
git commit -m "feat(web): add the document title copy (#143)"
```

### Task 2: `pageTitleKey` (spec §4.1; §8 item 1)

**Files:**
- Modify: `apps/web/lib/nav-groups.test.ts`
- Modify: `apps/web/lib/nav-groups.ts`

- [ ] **Step 1: Write the resolver tests.** In `apps/web/lib/nav-groups.test.ts`, add `  pageTitleKey,` to the `./nav-groups` import, directly after `  landingHref,`. Then insert this directly above `describe('PLATFORM_HOME_HREF reservation', () => {`. `SERVICES`, `ADD_ONS`, `STAFF` and `UNGATED_PATHS` already exist in the file; `UNGATED_PATHS` is `['/app', '', '/app/does-not-exist', '/app/customers-old', '/app/customers2', '/app/platformx']`.

```ts
// Document titles spec §4.1 and §8 item 1 (#143).
describe('pageTitleKey', () => {
  it.each(NAV_GROUPS.flatMap((group) => group.items))('names $href and the paths beneath it by $labelKey', ({ href, labelKey }) => {
    expect(pageTitleKey(href)).toBe(labelKey);
    expect(pageTitleKey(`${href}/nested`)).toBe(labelKey);
  });

  it('shares findActiveHref segment matching', () => {
    expect(pageTitleKey(SERVICES)).toBe('items.services');
    expect(pageTitleKey(ADD_ONS)).toBe('items.addOns');
    expect(pageTitleKey('/app/cleaners/teams-extra')).toBe('items.cleaners');
    expect(pageTitleKey(`${STAFF}/`)).toBe('items.staff');
  });

  it('names the platform path and the paths beneath it by platform.title', () => {
    expect(pageTitleKey(PLATFORM_HOME_HREF)).toBe('platform.title');
    expect(pageTitleKey(`${PLATFORM_HOME_HREF}/x`)).toBe('platform.title');
  });

  it.each(UNGATED_PATHS)('has no page title key for %j', (pathname) => {
    expect(pageTitleKey(pathname)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and watch it fail.**

Run: `pnpm --filter web exec vitest run lib/nav-groups.test.ts`
Expected: FAIL, 18 failed and 226 passed: every new test (10 nav items + 1 + 1 + 6 paths), with `pageTitleKey is not a function`.

- [ ] **Step 3: Add the resolver.** In `apps/web/lib/nav-groups.ts`. `NAV_ITEMS` is a derived view of `NAV_GROUPS`, not a second configuration source; don't add data to it or build it from anything else.

  - Replace `const ALL_HREFS = NAV_GROUPS.flatMap((group) => group.items.map((item) => item.href));` with:

```ts
const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);
const ALL_HREFS = NAV_ITEMS.map((item) => item.href);
```

  - Insert this directly after the closing `}` of `export function isGatedPath(pathname: string): boolean {` (whose body is `  return findActiveHref(pathname) !== undefined || isPlatformPath(pathname);`):

```ts

// The nav message key naming a path's page, for its document title (document
// titles spec §4.1): the nav item's labelKey, then the platform title, else
// undefined, which the gate renders as the bare app title. It shares
// canViewPath's path matching only, never its principal decision: a
// client-side presentation rule, not authorization.
export function pageTitleKey(pathname: string): string | undefined {
  const href = findActiveHref(pathname);
  if (href !== undefined) return NAV_ITEMS.find((item) => item.href === href)?.labelKey;
  if (isPlatformPath(pathname)) return 'platform.title';
  return undefined;
}
```

- [ ] **Step 4: Run it and watch it pass.**

Run: `pnpm --filter web exec vitest run lib/nav-groups.test.ts`
Expected: PASS, 244 tests.

- [ ] **Step 5: Commit.**

```bash
git add apps/web/lib/nav-groups.ts apps/web/lib/nav-groups.test.ts
git commit -m "feat(web): resolve a path's page title key from the nav config (#143)"
```

### Task 3: The gate owns the title (spec §4.3, §4.5; §8 item 2)

**Files:**
- Modify: `apps/web/lib/page-visibility-gate.test.tsx`
- Modify: `apps/web/components/layout/page-visibility-gate.tsx`

- [ ] **Step 1: Add the title helper.** In `apps/web/lib/page-visibility-gate.test.tsx`, insert this directly above `function expectMounted(html: string) {`:

```tsx
// Document titles spec §4.3 (#143): the gate's output holds exactly one
// <title>, whose text describes the row actually rendered.
function expectTitle(html: string, title: string) {
  expect([...html.matchAll(/<title>(.*?)<\/title>/g)].map(([, text]) => text)).toEqual([title]);
}

```

- [ ] **Step 2: Add the row tests.** Insert this as the last block inside `describe('PageVisibilityGate', () => {`, directly before that describe's closing `});` at the end of the file. `renderGate`, `admin` and `QueryState` already exist.

```tsx
  // Document titles spec §4.3, §4.5 and §8 item 2 (#143).
  describe('document title', () => {
    const UNAVAILABLE_TITLE = 'Page unavailable · Clensy';

    it.each([
      ['/app', 'Clensy'],
      ['/app/does-not-exist', 'Clensy'],
      [null, 'Clensy'],
    ])('titles the ungated path %j as %j', (pathname, title) => {
      expectTitle(renderGate(pathname, { loading: true }), title);
    });

    it('titles an allowed page by its nav label', () => {
      expectTitle(renderGate('/app/catalog', admin('OPS_MANAGER', 'TENANT')), 'Services · Clensy');
      expectTitle(renderGate('/app/cleaners/teams/x', admin('ANALYST', 'TENANT')), 'Teams · Clensy');
      expectTitle(renderGate('/app/admin', admin('TENANT_OWNER', 'TENANT')), 'Staff · Clensy');
    });

    it('titles the platform page for a platform principal', () => {
      expectTitle(renderGate('/app/platform', admin('SUPER_ADMIN', 'PLATFORM')), 'Platform · Clensy');
    });

    it.each([
      ['a denied role', '/app/customers', admin('FINANCE', 'TENANT')],
      ['a platform principal on a tenant page', '/app/bookings', admin('SUPER_ADMIN', 'PLATFORM')],
      ['a tenant principal on the platform page', '/app/platform', admin('SCHEDULER', 'TENANT')],
      ['a principal with no landing', '/app/bookings', admin('SUPER_ADMIN', 'TENANT')],
    ] as [string, string, QueryState][])('titles the unavailable state for %s', (_label, pathname, query) => {
      expectTitle(renderGate(pathname, query), UNAVAILABLE_TITLE);
    });

    it('titles the loading row by the requested page, as the allowed row', () => {
      const loading = renderGate('/app/customers', { loading: true });
      const allowed = renderGate('/app/customers', admin('ANALYST', 'TENANT'));

      expectTitle(loading, 'Customers · Clensy');
      expectTitle(allowed, 'Customers · Clensy');
    });

    it.each([
      ['an error', { error: new Error('session expired'), loading: false }],
      ['a settled null', { data: { currentAdmin: null }, loading: false }],
    ] as [string, QueryState][])('titles the passed-through page on %s', (_label, query) => {
      expectTitle(renderGate('/app/bookings', query), 'Bookings · Clensy');
    });

    it('titles a cached principal during a refetch by the settled row', () => {
      expectTitle(renderGate('/app/customers', { ...admin('ANALYST', 'TENANT'), loading: true }), 'Customers · Clensy');
      expectTitle(renderGate('/app/customers', { ...admin('FINANCE', 'TENANT'), loading: true }), UNAVAILABLE_TITLE);
    });
  });
```

- [ ] **Step 3: Run it and watch it fail.**

Run: `pnpm --filter web exec vitest run lib/page-visibility-gate.test.tsx`
Expected: FAIL, 13 failed and 21 passed: every new title test, each with `expected [] to deeply equal [ '…' ]` (the gate renders no `<title>` yet). All 21 existing tests pass.

- [ ] **Step 4: Render the title from the gate.** In `apps/web/components/layout/page-visibility-gate.tsx`:

  - Replace `import { canViewPath, isGatedPath, landingHref, type NavPrincipal } from '../../lib/nav-groups';` with `import { canViewPath, isGatedPath, landingHref, pageTitleKey, type NavPrincipal } from '../../lib/nav-groups';`.
  - Replace `// denied page is never rendered, so its hooks and queries never run.` with:

```tsx
// denied page is never rendered, so its hooks and queries never run. It also
// owns the /app document title (document titles spec §4.3): every row renders
// exactly one <title>, describing the row actually rendered.
```

  - Replace:

```tsx
  const principal = data?.currentAdmin;

  if (!isGatedPath(pathname)) return children;
  if (principal) {
    return canViewPath(principal, pathname) ? children : <UnavailableState principal={principal} />;
  }
  if (!error && loading) return <LoadingState message={t('landing.loading')} />;
  return children;
}
```

  with:

```tsx
  const principal = data?.currentAdmin;
  // The requested path's title, shared by every row except the unavailable
  // state; the loading row uses it too, without implying the page is viewable.
  const titleKey = pageTitleKey(pathname);
  const title = titleKey ? t('documentTitle.page', { page: t(titleKey) }) : t('documentTitle.app');

  if (!isGatedPath(pathname)) return <Titled title={title}>{children}</Titled>;
  if (principal) {
    return canViewPath(principal, pathname) ? (
      <Titled title={title}>{children}</Titled>
    ) : (
      <Titled title={t('documentTitle.page', { page: t('unavailable.title') })}>
        <UnavailableState principal={principal} />
      </Titled>
    );
  }
  if (!error && loading) {
    return (
      <Titled title={title}>
        <LoadingState message={t('landing.loading')} />
      </Titled>
    );
  }
  return <Titled title={title}>{children}</Titled>;
}

// One React <title> contribution, which React hoists into <head>; it has no
// DOM relationship to the row it accompanies (document titles spec §4.3).
function Titled({ children, title }: { children: ReactNode; title: string }) {
  return (
    <>
      <title>{title}</title>
      {children}
    </>
  );
}
```

  `<title>` gets a single string child, as React 19 requires for a hoisted title.

- [ ] **Step 5: Run it and watch it pass.**

Run: `pnpm --filter web exec vitest run lib/page-visibility-gate.test.tsx`
Expected: PASS, 34 tests.

- [ ] **Step 6: Commit.**

```bash
git add apps/web/components/layout/page-visibility-gate.tsx apps/web/lib/page-visibility-gate.test.tsx
git commit -m "feat(web): render the /app document title from the visibility gate (#143)"
```

### Task 4: Root layout and `/login` title ownership (spec §4.4; §8 item 3)

**Files:**
- Modify: `apps/web/lib/web-shell-regressions.test.ts`
- Modify: `apps/web/app/layout.tsx`
- Create: `apps/web/app/login/layout.tsx`

- [ ] **Step 1: Add the ownership regressions.** Append this at the end of `apps/web/lib/web-shell-regressions.test.ts`, after the file's last `});`. `nonTestSources`, `readWebSource`, `webRoot`, `relative`, `readFileSync` and `sep` already exist or are imported in the file.

```ts

// Document titles spec §4.3, §4.4 and §8 item 3 (#143).
const METADATA_EXPORTS = ['metadata', 'generateMetadata'];

// Every name a module exports, read from its syntax tree so any export form
// counts: exported declarations, export lists (renames and re-exports
// included) and default exports. An `export * from`, or an exported
// destructuring, can't be named without resolving it, so it yields '*' and
// fails closed.
function exportedNames(source: ts.SourceFile): string[] {
  return source.statements.flatMap((statement) => {
    if (ts.isExportDeclaration(statement)) {
      const clause = statement.exportClause;
      if (!clause) return ['*'];
      return ts.isNamedExports(clause) ? clause.elements.map((element) => element.name.text) : [clause.name.text];
    }
    if (ts.isExportAssignment(statement)) return ['default'];
    const modifiers = ts.canHaveModifiers(statement) ? (ts.getModifiers(statement) ?? []) : [];
    if (!modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) return [];
    if (modifiers.some((modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword)) return ['default'];
    if (ts.isVariableStatement(statement)) {
      return statement.declarationList.declarations.map((declaration) =>
        ts.isIdentifier(declaration.name) ? declaration.name.text : '*',
      );
    }
    const named = ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement);
    return named && statement.name ? [statement.name.text] : [];
  });
}

function exportsMetadata(path: string, text: string) {
  return exportedNames(parseSource(path, text)).some((name) => name === '*' || METADATA_EXPORTS.includes(name));
}

// The property names of the root layout's `metadata` object, or undefined
// when it declares none. A spread or computed property yields '*'.
function rootMetadataProperties(): string[] | undefined {
  const source = parseSource('app/layout.tsx', readWebSource('app/layout.tsx'));
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || declaration.name.text !== 'metadata') continue;
      let value = declaration.initializer;
      while (value && (ts.isSatisfiesExpression(value) || ts.isAsExpression(value) || ts.isParenthesizedExpression(value))) {
        value = value.expression;
      }
      if (!value || !ts.isObjectLiteralExpression(value)) return ['*'];
      return value.properties.map((property) =>
        property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ? property.name.text : '*',
      );
    }
  }
  return undefined;
}

describe('document title ownership', () => {
  const sources = () => nonTestSources(webRoot).map((path) => ({ path: relative(webRoot, path), text: readFileSync(path, 'utf8') }));

  it('sets no title in the root layout metadata', () => {
    const properties = rootMetadataProperties();

    expect(properties).toBeDefined();
    expect(properties).not.toContain('title');
    expect(properties).not.toContain('*');
    expect(exportedNames(parseSource('app/layout.tsx', readWebSource('app/layout.tsx')))).not.toContain('generateMetadata');
  });

  it('renders <title> only in the page-visibility gate', () => {
    const owners = sources()
      .filter(({ text }) => text.includes('<title'))
      .map(({ path }) => path);

    expect(owners).toEqual(['components/layout/page-visibility-gate.tsx']);
  });

  it('exports no metadata from any /app source, in any export form', () => {
    const exporters = sources()
      .filter(({ path }) => path.startsWith(`app${sep}app${sep}`))
      .filter(({ path, text }) => exportsMetadata(path, text))
      .map(({ path }) => path);

    expect(exporters).toEqual([]);
  });

  it('gives /login exactly one title source, the bare app title', () => {
    const exporters = sources()
      .filter(({ path }) => path.startsWith(`app${sep}login${sep}`))
      .filter(({ path, text }) => exportsMetadata(path, text))
      .map(({ path }) => path);

    expect(exporters).toEqual([`app${sep}login${sep}layout.tsx`]);
    expect(readWebSource('app/login/layout.tsx')).toContain("title: t('documentTitle.app')");
  });
});
```

- [ ] **Step 2: Run it and watch it fail.**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: FAIL, 2 failed and 182 passed: `sets no title in the root layout metadata` and `gives /login exactly one title source, the bare app title`. The other two new tests pass already. They are **characterization tests**: after Task 3 the gate is already the only `<title>` source, and no `/app` source exports metadata.

- [ ] **Step 3: Mutation checks for the two characterization tests (not committed).** For each mutation, run `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`, check the result, then revert with `git checkout -- <file>`:
  - **Declaration export:** append `export const metadata = { title: 'x' };` to `apps/web/app/app/jobs/page.tsx`. Expect 1 failed (`exports no metadata from any /app source, in any export form`) and 183 passed.
  - **Export list with a rename:** append `const pageMetadata = { title: 'x' };` and `export { pageMetadata as metadata };` to the same file. Expect the same single failure.
  - **Star re-export:** append `export * from '../../../lib/nav-groups';` to the same file. Expect the same single failure (fails closed).
  - **A second `<title>`:** in `apps/web/app/app/platform/page.tsx`, change `return <PageHeader title={t('platform.title')} description={t('platform.description')} />;` to `return <><title>x</title><PageHeader title={t('platform.title')} description={t('platform.description')} /></>;`, keeping the quotes as they are. Expect 1 failed (`renders <title> only in the page-visibility gate`) and 183 passed.
  - Confirm `git status --short -- apps/web/app/app` is empty.

  The root-layout test is pinned by its RED run in Step 2 and, after Step 4, by its syntax-tree property check. A spread in the root `metadata` object (`...{ title: 'x' }`) also fails it (pre-validated).

- [ ] **Step 4: Remove the root title.** In `apps/web/app/layout.tsx`, replace:

```tsx
export const metadata: Metadata = {
  description: 'Clensy admin',
  title: 'Clensy',
};
```

with:

```tsx
// No title here (document titles spec §4.4): a root title would be
// server-rendered ahead of the /app gate's title element and win document.title.
// /app titles come from PageVisibilityGate, /login's from app/login/layout.tsx.
export const metadata: Metadata = {
  description: 'Clensy admin',
};
```

  The comment must not contain the literal text `<title`, or the Step 1 ownership scan counts it.

- [ ] **Step 5: Give `/login` its own title.** Create `apps/web/app/login/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';

// /login's one title source (document titles spec §4.4): the bare app title,
// now that the root layout sets none.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('nav');
  return { title: t('documentTitle.app') };
}

export default function LoginLayout({ children }: { children: ReactNode }) {
  return children;
}
```

- [ ] **Step 6: Run it and watch it pass.**

Run: `pnpm --filter web exec vitest run lib/web-shell-regressions.test.ts`
Expected: PASS, 184 tests.

- [ ] **Step 7: Commit.**

```bash
git add apps/web/lib/web-shell-regressions.test.ts apps/web/app/layout.tsx apps/web/app/login/layout.tsx
git commit -m "feat(web): drop the root title and give /login its own (#143)"
```

### Task 5: Recorded acceptance evidence (spec §5 invariant 4; §8 item 5)

Not a code task. Run it after Final verification, and record the results in the M6 record; M7 cites them.

- [ ] **Step 1: Server render.** Build and start the app, then fetch representative routes with a session cookie present (the middleware only checks that the cookie exists):

```bash
pnpm --filter web build
pnpm --filter web exec next start -p 3999 &   # note its PID; stop it with kill <PID> afterwards
for p in /app /app/customers /app/platform /app/catalog /login; do
  printf '%s ' "$p"; curl -s -b clensy_admin_session=x "http://localhost:3999$p" | grep -o '<title>[^<]*</title>' | tr '\n' ' '; echo
done
curl -s -b clensy_admin_session=x http://localhost:3999/app/customers | grep -c 'role="status" aria-label="Loading…"'
```

Expected: exactly one `<title>` per route: `/app` `Clensy`, `/app/customers` `Customers · Clensy`, `/app/platform` `Platform · Clensy`, `/app/catalog` `Services · Clensy`, `/login` `Clensy`. The last command prints a non-zero count, confirming that the server rendered the gated route's loading row. Record which row was rendered, as the spec requires.

- [ ] **Step 2: Client navigation.** Run the stack (`docker compose up -d --build`, then `pnpm db:seed` with `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD` set, as `README.md` describes) and sign in as the seeded `TENANT_OWNER` in a real browser. Through the sidebar, navigate between two pages with distinct titles, for example Bookings → Customers. Record a transition, not only the end state:
  - **before** the navigation, on Bookings: `document.title` (`Bookings · Clensy`) and the text of Next's route-announcer region (`next-route-announcer`);
  - **after** navigating to Customers through the sidebar: `document.title` (`Customers · Clensy`) and the announcer region's text, which must now equal the new title.

  Where practical, also record a gate-state transition into the unavailable state: for example, as a `FINANCE` account (created through `/app/admin`), a cold load of `/app/customers` showing `Customers · Clensy` and then `Page unavailable · Clensy`.

## Final verification (before the M6 handoff report)

Run each command and record its result in the M6 Slice Completion Report's Validation table:

| Command | Expected |
| --- | --- |
| `pnpm --filter web test` | PASS, every file (17 files, 547 tests at pre-validation) |
| `pnpm --filter web exec tsc --noEmit` | exit 0 |
| `pnpm --filter web lint` | exit 0 |
| `pnpm --filter web build` | exit 0 |
| `git diff --stat main -- apps/api packages apps/web/middleware.ts apps/web/next.config.ts apps/web/app/app` | empty: no API, shared-package, middleware, config, page or `/app` layout change (§5 invariants 7–8) |

The slice consumes existing `@clensy/ui` and `@clensy/web` exports without modifying them, so this plan doesn't require their suites locally. CI's Test job runs `pnpm run test` across every workspace, and M7 cites that run.

## Traceability

| Spec | Implemented by |
| --- | --- |
| §4.2 copy | Task 1 |
| §4.1 `pageTitleKey`; §5 invariant 1 | Task 2 |
| §4.3 gate ownership, row titles, loading row; §4.5 examples; §5 invariants 2, 3, 5, 6, 7 | Task 3 |
| §4.4 root and `/login`; §5 invariants 2, 8 | Task 4 |
| §5 invariant 4; §8 item 5 | Task 5 |
| §8 items 1–4, 6 | Tasks 1–4; Final verification |
| Role-aware typed-URL spec title amendment (#143) | Task 3 (the gate now changes the title, as the amendment permits) |

## Deferred (not in this plan)

Per spec §11: per-record titles, heading/label alignment, titles for `/`, not-found and error pages, automated browser tests, and additional locales.

## Execution risks (operational only)

- **The ownership scan reads raw text.** Any non-test source that mentions `<title` in a comment fails the Task 4 scan. Comments outside the gate should say "title element".
- **Next's agent file.** `next dev`/`next build` may re-create `apps/web/AGENTS.md`/`CLAUDE.md` content; if either shows up as modified, leave it out of the task commits.
- **Port for Task 5.** Use a free port (3999 above) and stop the server by PID, not `pkill -f`, which can match the invoking shell.

## Gate outcomes

### M6 — In progress (2026-10-08)

Executed natively, in plan order, on `feat/143-app-document-titles`. Plan Accept `e8d8385` is the parent of the first implementation commit.

| Task | Commit | RED observed | GREEN |
| --- | --- | --- | --- |
| 1. Title copy | `9b45f4b` | 2 failed / 3 passed | 5/5 |
| 2. `pageTitleKey` | `5f8da63` | 18 failed / 226 passed, `pageTitleKey is not a function` | 244/244 |
| 3. Gate owns the title | `3fa62d5` | 13 failed / 21 passed, `expected [] to deeply equal [ 'Clensy' ]` | 34/34 |
| 4. Root and `/login` | `4152553` | 2 failed / 182 passed (root title, `/login` source) | 184/184 |

- **Characterization tests (Task 4):** in Step 3 order, the declaration, export-list, `export *` and second-`<title>` mutations each failed their targeted test. They showed 3 failed rather than the plan's "1 failed / 183 passed", because the two Step 2 RED tests were still failing at that point. Repeated after GREEN, each gave exactly 1 failed / 183 passed. All were reverted, and `apps/web/app/app` is clean.
- **Deviations:** none in code; the test and code edits are the plan's text verbatim.
- **Final verification:** `pnpm --filter web test` 17 files, 547/547; tsc, lint and build exit 0; the out-of-scope diff is empty.
- **Task 5 Step 1 (server render), recorded:** exactly one `<title>` per route:

  | Route | Title |
  | --- | --- |
  | `/app` | `Clensy` |
  | `/app/customers` | `Customers · Clensy` |
  | `/app/platform` | `Platform · Clensy` |
  | `/app/catalog` | `Services · Clensy` |
  | `/login` | `Clensy` |

  `/app/customers`'s HTML contains the `LoadingState` markup, so the server rendered the **loading row**.
- **Task 5 Step 2 (client navigation): pending.** The running API only accepts `WEB_ORIGIN=http://localhost:3001`, which the existing `web` container occupies. This build has to be served on 3001 (stop the `web` container temporarily, or rebuild it from this branch), and the seeded `TENANT_OWNER` signs in, before the before/after title and announcer evidence can be recorded.
