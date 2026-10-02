import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const webRoot = resolve(import.meta.dirname, '..');

function readWebSource(relativePath: string) {
  return readFileSync(resolve(webRoot, relativePath), 'utf8');
}

describe('web shell regressions', () => {
  it('lets Radix unmount the closed mobile sheet while retaining desktop hiding', () => {
    const sidebar = readWebSource('components/layout/app-sidebar.tsx');

    expect(sidebar).not.toContain('forceMount');
    expect(sidebar).not.toContain('key={mobileNavOpen');
    expect(sidebar).toContain('md:hidden');
  });

  it('redirects the public root into the authenticated app route', () => {
    const homePage = readWebSource('app/page.tsx');

    expect(homePage).toContain("redirect('/app')");
    expect(homePage).not.toContain('<p>Clensy</p>');
  });

  it('uses the pointer cursor for enabled buttons', () => {
    const globalStyles = readWebSource('app/globals.css');

    expect(globalStyles).toMatch(
      /@layer base\s*\{[\s\S]*button:not\(:disabled\)\s*\{[\s\S]*cursor:\s*pointer/,
    );
  });

  // No DOM test environment exists in this repo, so the shell's wiring to the
  // pure visibility rules (lib/nav-groups.test.ts) is pinned at source level.
  it('renders the sidebar from visibleNavGroups(currentAdmin), not the full NAV_GROUPS list', () => {
    const sidebar = readWebSource('components/layout/app-sidebar.tsx');

    expect(sidebar).toContain('useCurrentAdminQuery(');
    expect(sidebar).toContain('visibleNavGroups(data?.currentAdmin)');
    expect(sidebar).not.toContain('NAV_GROUPS');
    // Both variants (desktop <nav> and mobile Sheet) must receive the
    // filtered groups — neither may bypass visibleNavGroups.
    const usages = sidebar.match(/<SidebarNavigation\b[^>]*\/>/g) ?? [];
    expect(usages).toHaveLength(2);
    for (const usage of usages) expect(usage).toContain('groups={groups}');
    expect(sidebar).not.toMatch(/tenantId/);
  });

  it('lands /app through landingTarget (decision unit-tested in landing-target.test.ts)', () => {
    const landing = readWebSource('app/app/page.tsx');

    expect(landing).toContain('landingTarget({ currentAdmin, error, loading })');
    expect(landing).not.toContain('/app/customers');
    expect(landing).not.toMatch(/tenantId/);
  });

  it('keeps the platform placeholder presentational with no API calls', () => {
    const platform = readWebSource('app/app/platform/page.tsx');

    expect(platform).toContain("t('platform.title')");
    expect(platform).not.toContain('@clensy/client');
    expect(platform).not.toContain('@apollo/client');
    expect(platform).not.toContain('fetch(');
  });

  it('presents identity through @clensy/web roles and accountIdentity, with no hard-coded copy', () => {
    const userMenu = readWebSource('components/layout/user-menu.tsx');

    expect(userMenu).toContain("useClensyTranslations('roles')");
    expect(userMenu).toContain('accountIdentity(data?.currentAdmin)');
    expect(userMenu).not.toContain('role-presentation');
    expect(userMenu).not.toMatch(/tenantId/);
    for (const literal of ["'Sign out'", "'Theme'", "'Light'", 'Open user menu', 'Unable to log out']) {
      expect(userMenu).not.toContain(literal);
    }
  });

  it('retires the apps/web role-presentation helper', () => {
    expect(existsSync(resolve(webRoot, 'lib/role-presentation.ts'))).toBe(false);
  });

  // Final-review fix: a previous account's cached currentAdmin must not drive
  // the cache-first sidebar/user menu after another account logs in on the
  // same tab (no tenant-nav flash for a Super Admin, plan Review Focus 2).
  it('clears the Apollo cache on successful login before entering /app', () => {
    const login = readWebSource('app/login/page.tsx');
    const handleLogin = /async function handleLogin[\s\S]*?\n {2}\}/.exec(login)?.[0] ?? '';

    expect(handleLogin).toMatch(/await apolloClient\.clearStore\(\);\s*router\.push\('\/app'\)/);
  });
});

// Single app i18n provider spec §6.1. Syntactic import resolution, limited to
// `import` declarations whose module specifier is exactly '@clensy/web'.
const SKIPPED_DIRS = new Set(['node_modules', '.next']);

function parseTsx(fileName: string, text: string) {
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function clensyProviderBindings(source: ts.SourceFile) {
  const named = new Set<string>();
  const namespaces = new Set<string>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier) || statement.moduleSpecifier.text !== '@clensy/web') continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings) continue;
    if (ts.isNamespaceImport(bindings)) {
      namespaces.add(bindings.name.text);
      continue;
    }
    for (const element of bindings.elements) {
      if ((element.propertyName ?? element.name).text === 'ClensyI18nProvider') named.add(element.name.text);
    }
  }
  return { named, namespaces };
}

function countProviderMounts(fileName: string, text: string): number {
  const source = parseTsx(fileName, text);
  const { named, namespaces } = clensyProviderBindings(source);
  const isProviderTag = (tag: ts.JsxTagNameExpression) =>
    ts.isIdentifier(tag)
      ? named.has(tag.text)
      : ts.isPropertyAccessExpression(tag) &&
        ts.isIdentifier(tag.expression) &&
        namespaces.has(tag.expression.text) &&
        tag.name.text === 'ClensyI18nProvider';
  let count = 0;
  const visit = (node: ts.Node) => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && isProviderTag(node.tagName)) count += 1;
    ts.forEachChild(node, visit);
  };
  visit(source);
  return count;
}

function nonTestSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : nonTestSources(path);
    const isSource = /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts');
    return isSource && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('app i18n boundary structure', () => {
  describe('provider-mount detector', () => {
    it.each([
      ['a named import', "import { ClensyI18nProvider } from '@clensy/web';\nconst x = <ClensyI18nProvider>a</ClensyI18nProvider>;", 1],
      ['an aliased import', "import { ClensyI18nProvider as P } from '@clensy/web';\nconst x = <P />;", 1],
      ['a namespace import', "import * as W from '@clensy/web';\nconst x = <W.ClensyI18nProvider>a</W.ClensyI18nProvider>;", 1],
      [
        'a multi-line opening element',
        "import { ClensyI18nProvider } from '@clensy/web';\nconst x = (\n  <ClensyI18nProvider\n    locale=\"en\"\n  >\n    a\n  </ClensyI18nProvider>\n);",
        1,
      ],
      ['a same-named import from another module', "import { ClensyI18nProvider } from './local';\nconst x = <ClensyI18nProvider />;", 0],
      ['an unrelated property access', "const Other = { ClensyI18nProvider: () => null };\nconst x = <Other.ClensyI18nProvider />;", 0],
      ['an import that is never rendered', "import { ClensyI18nProvider } from '@clensy/web';\nexport { ClensyI18nProvider };", 0],
    ])('counts %s correctly', (_label, source, expected) => {
      expect(countProviderMounts('fixture.tsx', source)).toBe(expected);
    });
  });

  it('has exactly one provider mount in apps/web, in app-i18n-provider.tsx', () => {
    const mounts = nonTestSources(webRoot)
      .map((path) => ({ file: relative(webRoot, path), count: countProviderMounts(path, readFileSync(path, 'utf8')) }))
      .filter(({ count }) => count > 0);

    // Fails on the wrong location as well as the wrong count.
    expect(mounts).toEqual([{ file: 'components/layout/app-i18n-provider.tsx', count: 1 }]);
  });

  it('mounts AppI18nProvider in the /app layout, directly around DashboardLayout', () => {
    const layout = parseTsx('layout.tsx', readWebSource('app/app/layout.tsx'));

    const imported = layout.statements.some(
      (statement) =>
        ts.isImportDeclaration(statement) &&
        ts.isStringLiteral(statement.moduleSpecifier) &&
        statement.moduleSpecifier.text === '../../components/layout/app-i18n-provider' &&
        statement.importClause?.namedBindings !== undefined &&
        ts.isNamedImports(statement.importClause.namedBindings) &&
        statement.importClause.namedBindings.elements.some((element) => element.name.text === 'AppI18nProvider'),
    );
    expect(imported).toBe(true);

    const boundaries: ts.JsxElement[] = [];
    const visit = (node: ts.Node) => {
      if (ts.isJsxElement(node) && ts.isIdentifier(node.openingElement.tagName) && node.openingElement.tagName.text === 'AppI18nProvider') {
        boundaries.push(node);
      }
      ts.forEachChild(node, visit);
    };
    visit(layout);
    expect(boundaries).toHaveLength(1);

    const children = boundaries[0].children.filter((child) => !(ts.isJsxText(child) && child.containsOnlyTriviaWhiteSpaces));
    expect(children).toHaveLength(1);
    const [child] = children;
    expect(ts.isJsxElement(child) && ts.isIdentifier(child.openingElement.tagName) && child.openingElement.tagName.text).toBe(
      'DashboardLayout',
    );
  });

  // Secondary text guard; the AST check above is the primary one.
  it.each(['components/layout/user-menu.tsx', 'app/app/admin/page.tsx', 'app/app/bookings/page.tsx', 'app/login/page.tsx'])(
    'keeps %s free of ClensyI18nProvider',
    (file) => {
      expect(readWebSource(file)).not.toContain('ClensyI18nProvider');
    },
  );
});
