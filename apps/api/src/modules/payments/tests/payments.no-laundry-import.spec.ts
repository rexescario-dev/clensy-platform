import { readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, relative, resolve, sep } from 'path';

// spec §4.1: `payments` does not import from `laundry`. A source scan (the
// `paginated-collections-allowlist.spec.ts` style) over every file under
// `src/modules/payments`, resolving each relative module specifier and
// rejecting any that lands in `src/modules/laundry`, plus any bare
// specifier naming `modules/laundry`.
const PAYMENTS_ROOT = join(__dirname, '..');
const LAUNDRY_ROOT = join(__dirname, '../../laundry');
const SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*|jest\.(?:mock|requireActual)\s*\(\s*)['"]([^'"]+)['"]/g;

function laundryImports(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  return [...source.matchAll(SPECIFIER)]
    .map((m) => m[1])
    .filter((specifier) => {
      if (specifier.startsWith('.')) {
        const target = resolve(dirname(file), specifier);
        return target === LAUNDRY_ROOT || target.startsWith(LAUNDRY_ROOT + sep);
      }
      return /(^|\/)modules\/laundry(\/|$)/.test(specifier);
    });
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return path.endsWith('.ts') ? [path] : [];
  });
}

describe('payments does not import from laundry (spec §4.1)', () => {
  const files = sourceFiles(PAYMENTS_ROOT);

  it('scans the payments source tree', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(files).toContain(
      join(PAYMENTS_ROOT, 'application/services/payments.service.ts'),
    );
  });

  it('no file under src/modules/payments imports from src/modules/laundry', () => {
    const offenders = files.flatMap((file) =>
      laundryImports(file).map(
        (specifier) => `${relative(PAYMENTS_ROOT, file)}: ${specifier}`,
      ),
    );
    expect(offenders).toEqual([]);
  });

  it('detects a laundry import (guard self-check)', () => {
    const probe = join(PAYMENTS_ROOT, 'application/services/probe.ts');
    const specifier = '../../../laundry/domain/laundry-order-status';
    const target = resolve(dirname(probe), specifier);
    expect(target.startsWith(LAUNDRY_ROOT + sep)).toBe(true);
  });
});
