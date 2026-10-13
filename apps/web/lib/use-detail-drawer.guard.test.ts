import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

// #173 revision 5: the drawer's close decision reads a marker in
// `history.state` (`use-detail-drawer.ts`). Next.js drops custom history state
// when it rewrites the current entry for a `router.refresh()` or a server
// action that revalidates, refreshes or redirects, and gives the page no
// event to restore it from. So × would quietly fall back to replacing the
// entry, and the duplicate list entry of #173 would return. Nothing uses
// either today; this test keeps it that way until someone handles the marker
// on purpose.
const WEB_ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPO_ROOT = join(WEB_ROOT, '..', '..');

// All of the web app (the drawer pages, the dashboard shell mounted around
// them, the hooks, and any server-action file), and the shared component
// packages those pages render.
const SCANNED = [WEB_ROOT, join(REPO_ROOT, 'packages', 'web', 'src'), join(REPO_ROOT, 'packages', 'ui', 'src')];

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

// The files git tracks or would track under the scanned roots: tracked files,
// plus new ones not yet added, minus anything gitignored (dependencies,
// `.next`, and local build, coverage or `public/` output). So ignored output
// never turns the guard red, and tracked code is never skipped, whatever its
// directory is called. `apps/web` allows JavaScript (`allowJs`), and Next
// accepts `.js`/`.jsx` pages, so those count too.
function sourceFiles(): string[] {
  const listed = execFileSync(
    'git',
    [
      'ls-files',
      '-z',
      '--cached',
      '--others',
      '--exclude-standard',
      '--',
      ...SCANNED.map((root) => relative(REPO_ROOT, root)),
    ],
    { cwd: REPO_ROOT, encoding: 'utf8' },
  );
  return listed
    .split('\0')
    .filter((file) => /\.[cm]?[jt]sx?$/.test(file) && !/\.test\.[cm]?[jt]sx?$/.test(file))
    .map((file) => join(REPO_ROOT, file))
    .filter((file) => existsSync(file));
}

// A string-literal statement at the start of a file or function body.
function isUseServerDirective(statements: ts.NodeArray<ts.Statement>): boolean {
  for (const statement of statements) {
    if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) return false;
    if (statement.expression.text === 'use server') return true;
  }
  return false;
}

// Parsed as what the extension says: a `.ts` file read as TSX would misread
// an angle-bracket type assertion as JSX.
function scriptKind(fileName: string): ts.ScriptKind {
  if (/\.tsx$/.test(fileName)) return ts.ScriptKind.TSX;
  if (/\.[cm]?ts$/.test(fileName)) return ts.ScriptKind.TS;
  if (/\.jsx$/.test(fileName)) return ts.ScriptKind.JSX;
  return ts.ScriptKind.JS;
}

function parse(fileName: string, source: string): ts.SourceFile {
  return ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, scriptKind(fileName));
}

function isUseRouterCall(node: ts.Node): boolean {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useRouter';
}

// Names bound to `useRouter()` anywhere in this file: `const router =
// useRouter()`. Not scope-aware: a different `router` in an inner scope (a
// parameter that shadows it) is treated as the router too. In that shadowing
// case the guard raises a false alarm rather than missing the outer router;
// rename the inner one if it trips.
function routerNames(file: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node) => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      isUseRouterCall(node.initializer)
    ) {
      names.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return names;
}

// `useRouter()` itself, or a name bound to it.
function isRouter(node: ts.Expression, routers: ReadonlySet<string>): boolean {
  return isUseRouterCall(node) || (ts.isIdentifier(node) && routers.has(node.text));
}

// `router.refresh` or `router['refresh']`, called or not
// (`onClick={router.refresh}`, `startTransition(router.refresh)`).
function isRouterRefreshAccess(node: ts.Node, routers: ReadonlySet<string>): boolean {
  if (ts.isPropertyAccessExpression(node)) return node.name.text === 'refresh' && isRouter(node.expression, routers);
  return (
    ts.isElementAccessExpression(node) &&
    ts.isStringLiteralLike(node.argumentExpression) &&
    node.argumentExpression.text === 'refresh' &&
    isRouter(node.expression, routers)
  );
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

// `const { refresh } = useRouter()` or `= router`, renamed or not.
function isRefreshDestructuredFromRouter(node: ts.Node, routers: ReadonlySet<string>): boolean {
  return (
    ts.isVariableDeclaration(node) &&
    ts.isObjectBindingPattern(node.name) &&
    node.initializer !== undefined &&
    isRouter(node.initializer, routers) &&
    node.name.elements.some((element) => (element.propertyName ?? element.name).getText() === 'refresh')
  );
}

// Reads the syntax tree, so comments and strings that merely name these APIs
// never count; only code that uses them does.
function drawerHistoryHazards(fileName: string, source: string): string[] {
  const file = parse(fileName, source);
  const routers = routerNames(file);
  const found = new Set<string>();
  const visit = (node: ts.Node) => {
    if (isRefreshCall(node) || isRouterRefreshAccess(node, routers) || isRefreshDestructuredFromRouter(node, routers)) {
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
  const files = sourceFiles();
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
    // Nothing git ignores is scanned (dependencies, `.next`, local output).
    expect(scanned.some((file) => /(^|\/)(node_modules|\.next|\.turbo)\//.test(file))).toBe(false);
    // A file that starts calling the hook must be added to DRAWER_PAGES.
    const callsHook = (file: string) => {
      let calls = false;
      const visit = (node: ts.Node) => {
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          node.expression.text === 'useDetailDrawer'
        ) {
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

  // Git's list, not a directory walk: a new file nobody has added yet must
  // still be scanned, in each root. A harmless file is written and always
  // removed.
  it.each(SCANNED.map((root) => [relative(REPO_ROOT, root), root]))(
    'discovers a new, untracked source file in %s',
    (_label, root) => {
      const planted = join(root, `zz-guard-discovery-${process.pid}.ts`);
      try {
        writeFileSync(planted, 'export {};\n');
        expect(sourceFiles()).toContain(planted);
      } finally {
        rmSync(planted, { force: true });
      }
    },
  );

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
    ['a refresh reference', 'const router = useRouter();\nconst onClick = router.refresh;', ['`router.refresh()`']],
    ['a refresh passed on', 'const router = useRouter();\nstartTransition(router.refresh);', ['`router.refresh()`']],
    ['a bracket reference', "const router = useRouter();\nretry(router['refresh']);", ['`router.refresh()`']],
    [
      'refresh destructured from a router',
      'const router = useRouter();\nconst { refresh } = router;',
      ['`router.refresh()`'],
    ],
    ['a reference on useRouter()', 'const reload = useRouter().refresh;', ['`router.refresh()`']],
    ['a refresh reference on another object', 'const reload = cache.refresh;', []],
    // Known limit, pinned: the inner `router` shadows the hook's, but the
    // guard is not scope-aware, so this is (wrongly but safely) flagged.
    [
      'a shadowing parameter named like the router',
      'const router = useRouter();\nfunction inspect(router: Cache) {\n  return router.refresh;\n}',
      ['`router.refresh()`'],
    ],
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

  // A `.ts` file is parsed as TS: as TSX, `<Router>router;` would open a JSX
  // element and swallow the call after it.
  it('parses a .ts file as TypeScript, not TSX', () => {
    const source = 'const r = <Router>router;\nr.refresh();';
    expect(drawerHistoryHazards('inline.ts', source)).toEqual(['`router.refresh()`']);
    expect(drawerHistoryHazards('inline.tsx', source)).toEqual([]);
  });
});
