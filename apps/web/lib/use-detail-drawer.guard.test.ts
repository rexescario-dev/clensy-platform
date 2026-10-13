import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// #173 revision 5: the drawer's close decision reads a marker in
// `history.state` (`use-detail-drawer.ts`). Next.js drops custom history state
// when it rewrites the current entry for a `router.refresh()` or a server
// action that revalidates, refreshes or redirects, and gives the page no
// event to restore it from. So × would quietly
// fall back to replacing the entry, and the duplicate list entry of #173
// would return. Nothing uses either today; this test keeps it that way until
// someone handles the marker on purpose.
const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPO_ROOT = join(WEB_ROOT, '..', '..');

// All of the web app (the drawer pages, the dashboard shell mounted around
// them, the hooks, and any server-action file), and the shared component
// packages those pages render.
const SCANNED = [WEB_ROOT, join(REPO_ROOT, 'packages', 'web', 'src'), join(REPO_ROOT, 'packages', 'ui', 'src')];
const SKIPPED_DIRECTORIES = new Set(['.next', '.turbo', 'node_modules']);

// Every page that opens a drawer through `useDetailDrawer`, with its drawer
// defined in the same file.
const DRAWER_PAGES = [
  'apps/web/app/app/billing/page.tsx',
  'apps/web/app/app/bookings/page.tsx',
  'apps/web/app/app/catalog/add-ons/page.tsx',
  'apps/web/app/app/catalog/page.tsx',
  'apps/web/app/app/cleaners/page.tsx',
  'apps/web/app/app/cleaners/teams/page.tsx',
  'apps/web/app/app/customers/page.tsx',
  'apps/web/app/app/jobs/page.tsx',
  'apps/web/app/app/laundry/page.tsx',
];

const FORBIDDEN_IDENTIFIERS = new Map([
  ['useActionState', '`useActionState`'],
  ['useFormState', '`useFormState`'],
]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRECTORIES.has(entry.name) ? [] : sourceFiles(path);
    // `apps/web` allows JavaScript (`allowJs`), and Next accepts `.js`/`.jsx` pages.
    return /\.[cm]?[jt]sx?$/.test(entry.name) && !/\.test\.[cm]?[jt]sx?$/.test(entry.name) ? [path] : [];
  });
}

// A string-literal statement at the start of a file or function body.
function isUseServerDirective(statements: ts.NodeArray<ts.Statement>): boolean {
  for (const statement of statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) return false;
    if (statement.expression.text === 'use server') return true;
  }
  return false;
}

function parse(fileName: string, source: string): ts.SourceFile {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

// `x.refresh()` or `x['refresh']()`, with no arguments.
function isRefreshCall(node: ts.Node): boolean {
  if (!ts.isCallExpression(node) || node.arguments.length > 0) return false;
  const callee = node.expression;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text === 'refresh';
  return (
    ts.isElementAccessExpression(callee) &&
    ts.isStringLiteralLike(callee.argumentExpression) &&
    callee.argumentExpression.text === 'refresh'
  );
}

// `const { refresh } = useRouter()`, renamed or not.
function isRefreshDestructuredFromRouter(node: ts.Node): boolean {
  return (
    ts.isVariableDeclaration(node) &&
    ts.isObjectBindingPattern(node.name) &&
    node.initializer !== undefined &&
    ts.isCallExpression(node.initializer) &&
    ts.isIdentifier(node.initializer.expression) &&
    node.initializer.expression.text === 'useRouter' &&
    node.name.elements.some((element) => (element.propertyName ?? element.name).getText() === 'refresh')
  );
}

// Reads the syntax tree, so comments and strings that merely name these APIs
// never count; only code that uses them does.
function drawerHistoryHazards(fileName: string, source: string): string[] {
  const file = parse(fileName, source);
  const found = new Set<string>();
  const visit = (node: ts.Node) => {
    if (isRefreshCall(node) || isRefreshDestructuredFromRouter(node)) {
      found.add('`router.refresh()`');
    }
    if ((ts.isSourceFile(node) || ts.isBlock(node)) && isUseServerDirective(node.statements)) {
      found.add("a `'use server'` module or function");
    }
    if (ts.isIdentifier(node) && FORBIDDEN_IDENTIFIERS.has(node.text)) {
      found.add(FORBIDDEN_IDENTIFIERS.get(node.text)!);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return [...found];
}

describe('drawer history marker guard (#173)', () => {
  const files = SCANNED.flatMap(sourceFiles);
  const scanned = files.map((file) => relative(REPO_ROOT, file));

  it('scans every drawer page, the dashboard shell, the hooks and the shared components', () => {
    expect(scanned).toEqual(
      expect.arrayContaining([
        ...DRAWER_PAGES,
        'apps/web/app/app/layout.tsx',
        'apps/web/components/layout/user-menu.tsx',
        'apps/web/lib/use-detail-drawer.ts',
        'apps/web/middleware.ts',
      ]),
    );
    expect(scanned.some((file) => file.startsWith('packages/web/src/'))).toBe(true);
    expect(scanned.some((file) => file.startsWith('packages/ui/src/'))).toBe(true);
    expect(scanned).toContain('apps/web/eslint.config.mjs');
    expect(scanned.some((file) => /(^|\/)(node_modules|\.next|\.turbo)\//.test(file))).toBe(false);
    // A file that starts calling the hook must be added to DRAWER_PAGES.
    const callsHook = (file: string) => {
      let calls = false;
      const visit = (node: ts.Node) => {
        if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useDetailDrawer') {
          calls = true;
        }
        ts.forEachChild(node, visit);
      };
      visit(parse(file, readFileSync(file, 'utf8')));
      return calls;
    };
    const usingHook = files.filter(callsHook).map((file) => relative(REPO_ROOT, file));
    expect(usingHook.sort()).toEqual([...DRAWER_PAGES].sort());
  });

  it('finds no router.refresh() or server action in the web app or the shared components', () => {
    const hazards = files.flatMap((file) =>
      drawerHistoryHazards(file, readFileSync(file, 'utf8')).map((what) => `${relative(REPO_ROOT, file)} uses ${what}`),
    );
    // If this fails: these drop the drawer marker from the current history
    // entry, so × would replace it instead of going Back. Re-mark the entry
    // after the refresh or action (see the header of use-detail-drawer.ts),
    // with a test, before allowing it here.
    expect(hazards).toEqual([]);
  });

  // What the detector counts, pinned on inline sources.
  it.each([
    ['a call', 'router.refresh();', ['`router.refresh()`']],
    ['a spaced call', 'router.refresh ( );', ['`router.refresh()`']],
    ['a bracket call', "router['refresh']();", ['`router.refresh()`']],
    ['a destructured refresh', 'const { refresh } = useRouter();', ['`router.refresh()`']],
    ['a renamed destructured refresh', 'const { refresh: reload } = useRouter();', ['`router.refresh()`']],
    ['an aliased import', "import { useActionState as useAction } from 'react';", ['`useActionState`']],
    ['a module directive', "'use server';\nexport async function save() {}", ["a `'use server'` module or function"]],
    ['a function directive', "async function save() {\n  'use server';\n}", ["a `'use server'` module or function"]],
    ['an import', "import { useActionState } from 'react';", ['`useActionState`']],
    ['a line comment', '// router.refresh()', []],
    ['a trailing comment', "const value = true; // router.refresh() and 'use server'", []],
    ['a block comment', '/* useFormState; router.refresh(); */', []],
    ['a string', "const text = 'router.refresh() useActionState';", []],
    ['a non-directive string', "save();\n'use server';", []],
    ['refresh with arguments', 'cache.refresh(key);', []],
  ])('%s', (_label, source, expected) => {
    expect(drawerHistoryHazards('inline.tsx', source)).toEqual(expected);
  });
});
