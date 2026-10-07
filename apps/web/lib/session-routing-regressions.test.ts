import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
    expect(guard).toContain("navigateToLogin: () => router.replace('/login')");
    expect(guard).toContain('clearStore: () => client.clearStore()');
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
