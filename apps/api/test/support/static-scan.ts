import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

// The scanned set and search patterns for the static guard test (E2E
// isolation spec §7 L509–512). Every pattern is assembled from fragments,
// so this file contains none of the strings it searches for.

export const E2E_SOURCE_EXTENSIONS = [
  '.ts',
  '.js',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
] as const;

const TEST_ROOT = join(__dirname, '..');

function words(...parts: string[]): RegExp {
  return new RegExp(`\\b${parts.join('\\s+')}\\b`, 'i');
}

function call(name: string): RegExp {
  return new RegExp(`\\b${name}\\s*\\(`, 'i');
}

/** Case-insensitive, whitespace-tolerant, fragment-built patterns. */
export const SEARCHED: Readonly<Record<string, RegExp>> = {
  alterDatabase: words('alter', 'database'),
  createDatabase: words('create', 'database'),
  createDatabaseMethod: call(['create', 'Database'].join('')),
  createdbCommand: new RegExp(`\\b${'create'}${'db'}\\b`, 'i'),
  dblinkRef: new RegExp(`\\b${'db'}${'link'}\\b`, 'i'),
  dropDatabase: words('drop', 'database'),
  dropDatabaseMethod: call(['drop', 'Database'].join('')),
  dropdbCommand: new RegExp(`\\b${'drop'}${'db'}\\b`, 'i'),
  pgCancelBackend: new RegExp(['pg', 'cancel', 'backend'].join('_'), 'i'),
  pgTerminateBackend: new RegExp(['pg', 'terminate', 'backend'].join('_'), 'i'),
  postgresFdw: new RegExp(['postgres', 'fdw'].join('_'), 'i'),
};

/**
 * Every source file under apps/api/test/, support code, helpers, setup
 * files and the guard test included. Configuration such as jest-e2e.json
 * is not source. No source file is excluded; the set defines what the
 * checks scan, not the scope of the invariants.
 */
export function listE2eSourceFiles(root = TEST_ROOT): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        return walk(full);
      }
      return E2E_SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))
        ? [full]
        : [];
    });
  return walk(root).sort();
}

/** A path relative to apps/api/test, with forward slashes. */
export function testRelative(file: string, root = TEST_ROOT): string {
  return relative(root, file).split('\\').join('/');
}
