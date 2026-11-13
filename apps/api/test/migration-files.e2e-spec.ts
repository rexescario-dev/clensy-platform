import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { apiRoot } from './support/migration-files';

// Characterization test (plan Task 5). TypeORM decides "pending" by
// migration name, and the timestamp is the name's last 13 characters, so
// every file name, class name and `name` must agree, with unique prefixes.
// Break, outside the commit: change one class suffix; this test must fail.
describe('migration files (characterization)', () => {
  const dir = join(apiRoot, 'src/platform/database/migrations');
  const files = readdirSync(dir).filter((file) => file.endsWith('.ts'));

  it('agree on file name, class name and name, with unique 13-digit prefixes', () => {
    expect(files.length).toBeGreaterThan(0);
    const prefixes = new Set<string>();
    for (const file of files) {
      const match = /^(\d{13})-([A-Za-z0-9]+)\.ts$/.exec(file);
      expect(match).not.toBeNull();
      const [, timestamp, stem] = match as RegExpExecArray;
      const expected = `${stem}${timestamp}`;
      const source = readFileSync(join(dir, file), 'utf8');
      const classes = [...source.matchAll(/export class (\w+)/g)].map(
        (m) => m[1],
      );
      expect({ classes, file }).toEqual({ classes: [expected], file });
      const named = /\bname\s*=\s*'([^']+)'/.exec(source);
      if (named) {
        expect({ file, name: named[1] }).toEqual({ file, name: expected });
      }
      prefixes.add(timestamp);
    }
    expect(prefixes.size).toBe(files.length);
  });
});
