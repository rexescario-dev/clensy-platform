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

function clensyProviderBindings(source: ts.SourceFile) {
  const named = new Set<string>();
  const namespaces = new Set<string>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !isClensyWebSpecifier(statement.moduleSpecifier)) continue;
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
  const source = parseSource(fileName, text);
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

function nonTestSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : nonTestSources(path);
    return isScannedSource(entry.name) ? [path] : [];
  });
}

describe('app i18n boundary structure', () => {
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
      ['a .jsx mount', 'fixture.jsx', `${NAMED}const x = <ClensyI18nProvider />;`, 1, 0],
      ['a .js mount', 'fixture.js', `${NAMED}const x = <ClensyI18nProvider />;`, 1, 0],
      ['an .mjs mount', 'fixture.mjs', `${NAMED}export const x = <ClensyI18nProvider />;`, 1, 0],
      ['an escape after a generic arrow in a .ts file', 'fixture.ts', `${ALIASED}export const identity = <T>(value: T) => value;\nexport default P;`, 0, 1],
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

  it('has exactly one provider mount in apps/web, in app-i18n-provider.tsx', () => {
    const mounts = nonTestSources(webRoot)
      .map((path) => ({ file: relative(webRoot, path), count: providerUses(path, readFileSync(path, 'utf8')).mounts }))
      .filter(({ count }) => count > 0);

    // Fails on the wrong location as well as the wrong count.
    expect(mounts).toEqual([{ file: 'components/layout/app-i18n-provider.tsx', count: 1 }]);
  });

  // §6.1: zero provider escapes anywhere, independent of the mount assertion.
  it('has no provider escapes anywhere in apps/web', () => {
    const escapes = nonTestSources(webRoot)
      .map((path) => ({ file: relative(webRoot, path), count: providerUses(path, readFileSync(path, 'utf8')).escapes }))
      .filter(({ count }) => count > 0);

    expect(escapes).toEqual([]);
  });

  it('mounts AppI18nProvider in the /app layout, directly around DashboardLayout', () => {
    const layout = parseSource('layout.tsx', readWebSource('app/app/layout.tsx'));

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
