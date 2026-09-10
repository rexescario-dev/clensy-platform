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
});
