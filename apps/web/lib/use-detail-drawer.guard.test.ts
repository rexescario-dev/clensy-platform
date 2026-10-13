import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

// Git exports repository-local variables (`GIT_DIR`, `GIT_INDEX_FILE` and
// others) to hooks. Inherited, they would point these git calls at the
// repository that ran the hook, not the one in `cwd` (#175). Git lists them
// itself, as the ones it clears before working in a submodule; it is asked
// with no `GIT_*` variable set, so the question cannot be redirected either.
function envWithout(drop: (name: string) => boolean): NodeJS.ProcessEnv {
  const env = { ...process.env };
  for (const name of Object.keys(env)) if (drop(name)) delete env[name];
  return env;
}

const GIT_LOCAL_ENV_VARS = new Set(
  execFileSync('git', ['rev-parse', '--local-env-vars'], {
    encoding: 'utf8',
    env: envWithout((name) => name.startsWith('GIT_')),
  })
    .split('\n')
    .filter(Boolean),
);

// The environment as it is now, without those variables.
function gitEnv(): NodeJS.ProcessEnv {
  return envWithout((name) => GIT_LOCAL_ENV_VARS.has(name));
}

// The files git tracks or would track under the scanned roots: tracked files,
// plus new ones not yet added, minus anything gitignored (dependencies,
// `.next`, and local build, coverage or `public/` output). So ignored output
// never turns the guard red, and tracked code is never skipped, whatever its
// directory is called. `apps/web` allows JavaScript (`allowJs`), and Next
// accepts `.js`/`.jsx` pages, so those count too.
function sourceFiles(repoRoot = REPO_ROOT, roots = SCANNED): string[] {
  const listed = execFileSync(
    'git',
    [
      'ls-files',
      '-z',
      '--cached',
      '--others',
      '--exclude-standard',
      '--',
      ...roots.map((root) => relative(repoRoot, root)),
    ],
    { cwd: repoRoot, encoding: 'utf8', env: gitEnv() },
  );
  return listed
    .split('\0')
    .filter((file) => /\.[cm]?[jt]sx?$/.test(file) && !/\.test\.[cm]?[jt]sx?$/.test(file))
    .map((file) => join(repoRoot, file))
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
    node.name.elements.some((element) => {
      const key = element.propertyName ?? element.name;
      // `refresh`, `'refresh'` or `["refresh"]`.
      if (ts.isIdentifier(key) || ts.isStringLiteralLike(key)) return key.text === 'refresh';
      return (
        ts.isComputedPropertyName(key) &&
        ts.isStringLiteralLike(key.expression) &&
        key.expression.text === 'refresh'
      );
    })
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

// Sets these variables while `run` runs, then puts back what was there,
// unsetting any that were unset.
function withEnv(vars: Record<string, string>, run: () => void): void {
  const saved = Object.keys(vars).map((name) => [name, process.env[name]] as const);
  Object.assign(process.env, vars);
  try {
    run();
  } finally {
    for (const [name, value] of saved) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

// `sourceFiles` on a throwaway repository with, in each root, a tracked file,
// a new one, an ignored one and a force-added one under an ignored directory.
function expectGitFileList(): void {
  const repo = mkdtempSync(join(tmpdir(), 'drawer-guard-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, env: gitEnv() });
  try {
    git('init', '-q');
    // Created here, not in a repository named by an inherited `GIT_DIR`.
    expect(existsSync(join(repo, '.git'))).toBe(true);
    writeFileSync(join(repo, '.gitignore'), 'public/\n');
    const roots = SCANNED.map((root) => join(repo, relative(REPO_ROOT, root)));
    for (const root of roots) {
      mkdirSync(join(root, 'public'), { recursive: true });
      for (const name of ['tracked.ts', 'new.ts', join('public', 'ignored.js'), join('public', 'forced.js')]) {
        writeFileSync(join(root, name), 'export {};\n');
      }
      git('add', join(root, 'tracked.ts'));
      git('add', '-f', join(root, 'public', 'forced.js'));
    }
    const expected = roots.flatMap((root) => [
      join(root, 'tracked.ts'),
      join(root, 'new.ts'),
      join(root, 'public', 'forced.js'),
    ]);
    expect(sourceFiles(repo, roots).sort()).toEqual(expected.sort());
  } finally {
    rmSync(repo, { force: true, recursive: true });
  }
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

  // Git's list, not a directory walk. In each root: a tracked file and a new,
  // untracked one are listed; an ignored one is not, unless it is tracked
  // anyway (force-added). Proved in a throwaway repository, so nothing is
  // written into the real source tree, which other test files walk in
  // parallel.
  it('lists tracked and new files and skips ignored ones, in every root', () => {
    expectGitFileList();
  });

  // #175: run from a git hook, the guard inherits `GIT_DIR` and
  // `GIT_INDEX_FILE` pointing at the hook's repository (here, another
  // throwaway one). The proof must still act on its own repository and leave
  // the other untouched.
  it('keeps the temporary repository isolated from an inherited GIT_DIR', () => {
    const other = mkdtempSync(join(tmpdir(), 'drawer-guard-other-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: other, env: gitEnv() });
      withEnv({ GIT_DIR: join(other, '.git'), GIT_INDEX_FILE: join(other, '.git', 'index') }, expectGitFileList);
      expect(existsSync(join(other, '.git', 'index'))).toBe(false);
      expect(execFileSync('git', ['ls-files'], { cwd: other, encoding: 'utf8', env: gitEnv() })).toBe('');
    } finally {
      rmSync(other, { force: true, recursive: true });
    }
  });

  // #175: and the real scan still lists the real files. The other
  // repository ignores everything (`info/exclude`), so a scan that read its
  // `GIT_DIR` would come back empty.
  it('scans the real repository despite an inherited GIT_DIR', () => {
    const other = mkdtempSync(join(tmpdir(), 'drawer-guard-other-'));
    try {
      execFileSync('git', ['init', '-q'], { cwd: other, env: gitEnv() });
      writeFileSync(join(other, '.git', 'info', 'exclude'), '*\n');
      withEnv({ GIT_DIR: join(other, '.git'), GIT_INDEX_FILE: join(other, '.git', 'index') }, () => {
        expect(sourceFiles()).toEqual(files);
      });
    } finally {
      rmSync(other, { force: true, recursive: true });
    }
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
    ['a refresh reference', 'const router = useRouter();\nconst onClick = router.refresh;', ['`router.refresh()`']],
    ['a refresh passed on', 'const router = useRouter();\nstartTransition(router.refresh);', ['`router.refresh()`']],
    ['a bracket reference', "const router = useRouter();\nretry(router['refresh']);", ['`router.refresh()`']],
    [
      'a quoted destructured refresh',
      "const router = useRouter();\nconst { 'refresh': reload } = router;",
      ['`router.refresh()`'],
    ],
    ['a computed destructured refresh', 'const { ["refresh"]: reload } = useRouter();', ['`router.refresh()`']],
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
