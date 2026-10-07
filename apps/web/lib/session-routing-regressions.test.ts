import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const webRoot = resolve(import.meta.dirname, '..');

function readWebSource(relativePath: string) {
  return readFileSync(resolve(webRoot, relativePath), 'utf8');
}

// Session routing spec §8 item 5. No DOM test environment exists in this
// repo, so the guard's wiring is pinned at source level.
describe('session routing regressions', () => {
  it('mounts SessionGuard once in the /app layout, beside PageVisibilityGate inside DashboardLayout', () => {
    const layout = readWebSource('app/app/layout.tsx');

    expect(layout.match(/<SessionGuard\b/g)).toHaveLength(1);
    expect(layout).toMatch(
      /<DashboardLayout>\s*<SessionGuard \/>\s*<PageVisibilityGate>\{children\}<\/PageVisibilityGate>\s*<\/DashboardLayout>/,
    );
  });

  it('keeps the gate free of session handling', () => {
    const gate = readWebSource('components/layout/page-visibility-gate.tsx');

    expect(gate).not.toMatch(/onSessionInvalid|SessionGuard|session-redirect|\/login/);
  });

  it('checks the session network-only on mount and pathname changes only', () => {
    const guard = readWebSource('components/layout/session-guard.tsx');

    expect(guard).toContain("query({ query: CurrentAdminDocument, fetchPolicy: 'network-only' })");
    expect(guard).toContain('usePathname()');
    expect(guard).not.toContain('useSearchParams');
    expect(guard).toContain('}, [client, pathname]);');
  });

  it('subscribes to the session signal and redirects through the single-flight redirector', () => {
    const guard = readWebSource('components/layout/session-guard.tsx');

    expect(guard).toContain('onSessionInvalid(');
    expect(guard).toContain('createSessionRedirector(');
  });

  // Spec §4.3 item 1 (#146): one redirector per mounted guard. A structural
  // source regression, not a runtime proof (no DOM environment): parsed with
  // the TypeScript AST, so formatting changes don't break it. The effect that
  // creates the redirector has no dependencies, so a client or router identity
  // change cannot replace the latch. Its effects reach the current client and
  // router through `latest`, kept in sync by an earlier [client, router]
  // effect that only updates the ref.
  it('keeps the redirector mount-scoped while routing through the latest client and router (source)', () => {
    const effects = useEffectCalls(readWebSource('components/layout/session-guard.tsx'));
    const redirectorIndex = effects.findIndex((effect) => effect.body.includes('createSessionRedirector('));
    const syncIndex = effects.findIndex((effect) => effect.body === '{latest.current={client,router};}');

    expect(redirectorIndex).toBeGreaterThanOrEqual(0);
    expect(effects[redirectorIndex]?.deps).toBe('[]');
    expect(effects[redirectorIndex]?.body).toContain('clearStore:()=>latest.current.client.clearStore()');
    expect(effects[redirectorIndex]?.body).toContain("navigateToLogin:()=>latest.current.router.replace('/login')");
    expect(syncIndex).toBeGreaterThanOrEqual(0);
    expect(effects[syncIndex]?.deps).toBe('[client,router]');
    expect(syncIndex).toBeLessThan(redirectorIndex);
  });

  // Spec §4.2 / §4.3 item 4: a check acts only through the redirector captured
  // when it started (behavior unit-tested in session-redirect.test.ts). The ref
  // is read once, synchronously, at the start of each effect — never inside an
  // async callback, where it could name a newer redirector.
  it('binds each session check to the redirector captured when it starts', () => {
    const guard = readWebSource('components/layout/session-guard.tsx');

    expect(guard).toContain(
      "void runSessionCheck(() => client.query({ query: CurrentAdminDocument, fetchPolicy: 'network-only' }), current);",
    );
    expect(guard.match(/redirector\.current\b/g)).toHaveLength(2);
    expect(guard).toContain('redirector.current = current;');
    expect(guard).toContain('const current = redirector.current;');
    expect(guard).not.toMatch(/\.then\(/);
  });

  it('makes no visibility decision in the guard', () => {
    const guard = readWebSource('components/layout/session-guard.tsx');

    expect(guard).not.toMatch(/canViewPath|isGatedPath|landingHref|visibleNavGroups|viewRoles|nav-groups/);
  });
});

// Each useEffect(callback, deps) call in a component, in source order. The
// callback body and dependency list are compacted (all whitespace and trailing
// commas removed), so formatting never changes what the assertions see.
function useEffectCalls(text: string) {
  const source = ts.createSourceFile('component.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const normalize = (node: ts.Node | undefined) =>
    node ? node.getText(source).replace(/\s+/g, '').replace(/,(?=[\])}])/g, '') : undefined;
  const calls: Array<{ body: string; deps: string | undefined }> = [];
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useEffect') {
      const [callback, deps] = node.arguments;
      if (callback && ts.isArrowFunction(callback)) calls.push({ body: normalize(callback.body) ?? '', deps: normalize(deps) });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return calls;
}
