import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// #173 revision 5: the drawer's close decision reads a marker in
// `history.state` (`use-detail-drawer.ts`). Next.js drops custom history state
// when it rewrites the current entry for a `router.refresh()` or a server
// action, and gives the page no event to restore it from. So × would quietly
// fall back to replacing the entry, and the duplicate list entry of #173
// would return. Nothing uses either today; this test keeps it that way until
// someone handles the marker on purpose.
const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPO_ROOT = join(WEB_ROOT, '..', '..');

// The authenticated app (every drawer page and its drawer), the hooks, and
// the shared domain components those pages render.
const SCANNED = [join(WEB_ROOT, 'app', 'app'), join(WEB_ROOT, 'lib'), join(REPO_ROOT, 'packages', 'web', 'src')];

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
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
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

// Reads the syntax tree, so comments and strings that merely name these APIs
// never count; only code that uses them does.
function drawerHistoryHazards(fileName: string, source: string): string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = new Set<string>();
  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'refresh' &&
      node.arguments.length === 0
    ) {
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

  it('scans every drawer page, the hooks and the shared components', () => {
    expect(scanned).toEqual(expect.arrayContaining([...DRAWER_PAGES, 'apps/web/lib/use-detail-drawer.ts']));
    expect(scanned.some((file) => file.startsWith('packages/web/src/'))).toBe(true);
    // A page that starts using the hook must be added to DRAWER_PAGES.
    const usingHook = files
      .filter((file) => /\buseDetailDrawer\(/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(REPO_ROOT, file))
      .filter((file) => file.startsWith('apps/web/app/'));
    expect(usingHook.sort()).toEqual([...DRAWER_PAGES].sort());
  });

  it('finds no router.refresh() or server action where a drawer could be open', () => {
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
