import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

  it('lands /app through landingHref and sends a missing session to /login', () => {
    const landing = readWebSource('app/app/page.tsx');

    expect(landing).toContain('landingHref(currentAdmin)');
    expect(landing).toContain("'/login'");
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
});
