import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
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
  if (fileName.endsWith('tsx')) return ts.ScriptKind.TSX;
  if (fileName.endsWith('jsx')) return ts.ScriptKind.JSX;
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

// §6.1 item 2: `typeof P`, or (#124) P as the leftmost name of a qualified name
// inside a `typeof` query (`typeof P.displayName`). `const Q = P.displayName`
// is a value use and stays an escape.
function isNamedTypeQuery(identifier: ts.Identifier) {
  let entityName: ts.Node = identifier;
  while (ts.isQualifiedName(entityName.parent) && entityName.parent.left === entityName) entityName = entityName.parent;
  return ts.isTypeQueryNode(entityName.parent) && entityName.parent.exprName === entityName;
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

// §6.1: a literal module specifier is a string literal, or a template literal
// with no substitutions.
function isLiteralSpecifier(node: ts.Node | undefined): node is ts.NoSubstitutionTemplateLiteral | ts.StringLiteral {
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
    escapes += loadCallEscapes(node);
    if (ts.isIdentifier(node) && !isNonReferenceName(node)) {
      if (named.has(node.text) && !isJsxTagName(node) && !isNamedTypeQuery(node)) escapes += 1;
      if (namespaces.has(node.text) && !isNamespaceMountTag(node) && !isNamespaceTypePosition(node) && !isTypeOnlyHeritageName(node)) {
        escapes += 1;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return { mounts, escapes };
}

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

// §6.1 package boundary (#120): plain path arithmetic only. No module
// resolution, file-system lookup, extension or index probing, or package.json.
const packagesWebRoot = resolve(webRoot, '../../packages/web');

// Segment-by-segment containment, so `packages/webby` and `my-packages/web` are outside.
function isInsidePackagesWeb(target: string) {
  const fromPackage = relative(packagesWebRoot, target);
  return fromPackage === '' || (!isAbsolute(fromPackage) && fromPackage.split(sep)[0] !== '..');
}

// §6.1 package boundary item 3 (#122): the consecutive whole segments
// node_modules / @clensy / web, in any node_modules at any depth. There is no
// symlink resolution: apps/web/node_modules/@clensy/web links to packages/web,
// but the segment sequence is forbidden as written. Whole segments, so
// `@clensy/webkit`, `@clensy/web-extra` and `my_node_modules` do not match.
function passesThroughClensyWebLink(target: string): boolean {
  const segments = target.split(sep);
  return segments.some(
    (segment, index) => segment === 'node_modules' && segments[index + 1] === '@clensy' && segments[index + 2] === 'web',
  );
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
  return target !== undefined && (isInsidePackagesWeb(target) || passesThroughClensyWebLink(target));
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
      // #124: *tsx files parse as TSX, *jsx as JSX (§6.1 Scanned files).
      ['a .mtsx mount', 'fixture.mtsx', `${NAMED}export const x = <ClensyI18nProvider />;`, 1, 0],
      ['a .ctsx mount', 'fixture.ctsx', `${NAMED}export const x = <ClensyI18nProvider />;`, 1, 0],
      ['a .mjsx mount', 'fixture.mjsx', `${NAMED}export const x = <ClensyI18nProvider />;`, 1, 0],
      ['a .cjsx mount', 'fixture.cjsx', `${NAMED}export const x = <ClensyI18nProvider />;`, 1, 0],
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
      ['an object-literal setter name', 'fixture.ts', `${ALIASED}const o = {\n  set P(value: number) {},\n};`, 0, 0],
      ['a class property initializer under an exempt name', 'fixture.ts', `${ALIASED}class C {\n  P = P;\n}`, 0, 1],
      ['an object-literal getter body under an exempt name', 'fixture.ts', `${ALIASED}const o = {\n  get P() {\n    return P;\n  },\n};`, 0, 1],
      // #124: characterisation of the #122 interaction (already correct; not a red test).
      ['a provider imported through the node_modules link (a boundary violation, not a mount)', 'fixture.tsx', "import { ClensyI18nProvider as P } from '../../node_modules/@clensy/web';\nconst x = <P />;", 0, 0],
    ])('counts %s correctly', (_label, fileName, source, mounts, escapes) => {
      expect(providerUses(fileName, source)).toEqual({ mounts, escapes });
    });
  });

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
      // Paths through a node_modules/@clensy/web link (item 3, #122). The
      // fixture is at apps/web/app/app, so `../../node_modules` is apps/web's.
      ['the node_modules/@clensy/web link', "import { ClensyI18nProvider as P } from '../../node_modules/@clensy/web';", ['../../node_modules/@clensy/web']],
      ['a path beneath the node_modules/@clensy/web link', "import x from '../../node_modules/@clensy/web/src';", ['../../node_modules/@clensy/web/src']],
      ['a nested node_modules/@clensy/web link', "import x from '../../some/node_modules/@clensy/web';", ['../../some/node_modules/@clensy/web']],
      ['a path beneath a nested link', "import x from '../../some/node_modules/@clensy/web/src/i18n';", ['../../some/node_modules/@clensy/web/src/i18n']],
      ['an @/ path to the link', "import x from '@/node_modules/@clensy/web';", ['@/node_modules/@clensy/web']],
      ['a require of the link', "const m = require('../../node_modules/@clensy/web');", ['../../node_modules/@clensy/web']],
      ['two violations in one file', "import a from '@clensy/web/a';\nimport b from '@clensy/web/b';", ['@clensy/web/a', '@clensy/web/b']],
      // Allowed.
      ['the bare package', "import { ClensyI18nProvider } from '@clensy/web';\nconst m = require('@clensy/web');", []],
      ['a relative path inside apps/web', "import { DashboardLayout } from '../../components/layout/dashboard-layout';", []],
      ['a my-packages/web lookalike', "import x from '../../../../my-packages/web/src';", []],
      ['a packages/webby lookalike', "import x from '../../../../packages/webby/src';", []],
      ['a packages-web file name', "import x from './packages-web';", []],
      ['another scoped package', "import { Button } from '@clensy/ui';\nimport x from '@clensy/webkit/y';", []],
      ['a node_modules/@clensy/webkit lookalike', "import x from '../../node_modules/@clensy/webkit';", []],
      ['a node_modules/@clensy/web-extra lookalike', "import x from '../../node_modules/@clensy/web-extra/src';", []],
      ['another package under node_modules/@clensy', "import x from '../../node_modules/@clensy/ui';", []],
      ['a my_node_modules lookalike', "import x from '../../my_node_modules/@clensy/web';", []],
      ['the bare node_modules/@clensy/web specifier', "import x from 'node_modules/@clensy/web';", []],
      ['a non-literal load (an escape, not a violation)', 'const m = await import(name);', []],
    ])('reports %s', (_label, source, expected) => {
      expect(boundaryViolations(FIXTURE, source)).toEqual(expected);
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

  // §6.1 package boundary (#120): zero violations anywhere, independent of the
  // provider assertions.
  it('has no package boundary violations anywhere in apps/web', () => {
    const violations = nonTestSources(webRoot)
      .map((path) => ({ file: relative(webRoot, path), specifiers: boundaryViolations(path, readFileSync(path, 'utf8')) }))
      .filter(({ specifiers }) => specifiers.length > 0);

    expect(violations).toEqual([]);
  });

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
      [
        'a second shell in a conditional branch (caught by the dashboard-shell invariant, not here)',
        `${PROVIDER}${DASHBOARD}${layoutReturning('cond ? <DashboardLayout>{children}</DashboardLayout> : <AppI18nProvider><DashboardLayout>{children}</DashboardLayout></AppI18nProvider>')}`,
        true,
      ],
    ])('checks %s', (_label, source, expected) => {
      expect(wrapsDashboardInBoundary('layout.tsx', source)).toBe(expected);
    });
  });

  it('mounts AppI18nProvider in the /app layout, directly around DashboardLayout', () => {
    expect(wrapsDashboardInBoundary('app/app/layout.tsx', readWebSource('app/app/layout.tsx'))).toBe(true);
  });

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

  // Secondary text guard; the AST check above is the primary one.
  it.each(['components/layout/user-menu.tsx', 'app/app/admin/page.tsx', 'app/app/bookings/page.tsx', 'app/login/page.tsx'])(
    'keeps %s free of ClensyI18nProvider',
    (file) => {
      expect(readWebSource(file)).not.toContain('ClensyI18nProvider');
    },
  );
});
