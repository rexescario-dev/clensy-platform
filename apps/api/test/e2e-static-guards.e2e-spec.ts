import { readFileSync } from 'node:fs';
import * as ts from 'typescript';
import {
  listE2eSourceFiles,
  SEARCHED,
  testRelative,
} from './support/static-scan';

// Static guard checks over every e2e source file (E2E isolation spec §7
// L506–512). Each is hygiene, not a security boundary (spec §4.10): a scan
// cannot see SQL built at run time or code outside the scanned files. The
// scanned set defines what the checks scan; it does not narrow invariants
// 2, 4, 6, 13 or 14, which apply to all e2e code. Searched-for strings are
// assembled from fragments here, because this file is in its own scanned set.

const HYGIENE = '(hygiene, not a security boundary — spec §4.10)';

const files = listE2eSourceFiles().map((file) => ({
  file,
  rel: testRelative(file),
  source: readFileSync(file, 'utf8'),
}));

function offenders(pattern: RegExp, allowed: readonly string[] = []): string[] {
  return files
    .filter(({ rel, source }) => pattern.test(source) && !allowed.includes(rel))
    .map(({ rel }) => rel)
    .sort();
}

/** String and template literals, found through the syntax tree. */
function literals(rel: string, source: string): string[] {
  const sourceFile = ts.createSourceFile(
    rel,
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      found.push(node.text);
    } else if (ts.isTemplateExpression(node)) {
      found.push(
        [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(
          '',
        ),
      );
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

const ACTIVITY_TABLE = new RegExp(
  [['pg', 'stat', 'activity'].join('_'), ['pg', 'locks'].join('_')].join('|'),
  'i',
);
const SQL_KEYWORD = /\b(select|from)\b/i;
const SCOPED = /\b(\w+\.)?datname\s*=\s*current_database\s*\(\s*\)/i;
const NEGATED = [
  /datname\s*(<>|!=)\s*current_database/i,
  /\bnot\b\s*\(?\s*(\w+\.)?datname\s*=/i,
];

/** Invariant 6: an activity query must scope to current_database(). */
function activityQueryViolates(text: string): boolean {
  if (!ACTIVITY_TABLE.test(text) || !SQL_KEYWORD.test(text)) {
    return false;
  }
  return !SCOPED.test(text) || NEGATED.some((pattern) => pattern.test(text));
}

describe(`e2e static guards ${HYGIENE}`, () => {
  // Characterization test. Break (Task 6 Step 5 g): make
  // listE2eSourceFiles skip support/**; this test must then fail.
  it('scans every source file, including support, helpers, setup and itself', () => {
    const rels = files.map(({ rel }) => rel);
    expect(rels.length).toBeGreaterThan(0);
    for (const expected of [
      'support/static-scan.ts',
      'e2e-static-guards.e2e-spec.ts',
      'helpers/migration-db.ts',
      'setup-e2e-env.ts',
      'global-setup.ts',
      'admins.service.e2e-spec.ts',
      'create-payments.migration.e2e-spec.ts',
    ]) {
      expect(rels).toContain(expected);
    }
    expect(rels.filter((rel) => rel.endsWith('.json'))).toEqual([]);
  });

  describe(`invariant 2: DB_* only through the helper ${HYGIENE}`, () => {
    it('reads process.env.DB_* only in the target and connection helpers', () => {
      expect(
        offenders(/process\.env\.DB_[A-Z]+/, [
          'support/e2e-connection.ts',
          'support/e2e-target.ts',
        ]),
      ).toEqual([]);
    });

    it('has no literal clensy fallback', () => {
      expect(offenders(/\?\?\s*['"]clensy['"]/)).toEqual([]);
    });

    it('imports no dotenv', () => {
      expect(
        offenders(/(from\s+|require\(\s*)['"]dotenv(\/config)?['"]/),
      ).toEqual([]);
    });
  });

  describe(`invariant 4: database DDL ${HYGIENE}`, () => {
    // The check verifies where the provisioning creation statement is, not
    // which name it creates; the Task 5 child tests cover the name (F6).
    it('creates and drops scratch databases only through ScratchDatabases', () => {
      for (const key of [
        'dropDatabase',
        'dropDatabaseMethod',
        'createDatabaseMethod',
      ]) {
        expect({
          key,
          files: offenders(SEARCHED[key], ['support/e2e-connection.ts']),
        }).toEqual({ files: [], key });
      }
      expect(
        offenders(SEARCHED.createDatabase, [
          'support/e2e-connection.ts',
          'support/provision-test-database.ts',
        ]),
      ).toEqual([]);
    });

    it('never alters a database, and never shells out to the create or drop commands', () => {
      for (const key of ['alterDatabase', 'createdbCommand', 'dropdbCommand']) {
        expect({ files: offenders(SEARCHED[key]), key }).toEqual({
          files: [],
          key,
        });
      }
    });
  });

  describe(`invariant 14: no cross-database extension references ${HYGIENE}`, () => {
    it('references neither extension anywhere', () => {
      expect(offenders(SEARCHED.dblinkRef)).toEqual([]);
      expect(offenders(SEARCHED.postgresFdw)).toEqual([]);
    });

    it('leaves uuid-ossp permitted, in all ten migration suites', () => {
      const uuidLine = [
        'CREATE',
        'EXTENSION IF NOT EXISTS',
        '"uuid-ossp"',
      ].join(' ');
      for (const pattern of Object.values(SEARCHED)) {
        expect(pattern.test(uuidLine)).toBe(false);
      }
      const suites = [
        'add-booking-tenant',
        'add-catalog-tenant',
        'add-customer-property-tenant',
        'add-job-checklist-tenant',
        'add-laundry-billing-tenant',
        'add-laundry-line-description',
        'add-team-cleaner-tenant',
        'add-tenant-and-admin-scope',
        'add-tenant-label-overrides',
        'create-payments',
      ];
      for (const suite of suites) {
        const entry = files.find(
          ({ rel }) => rel === `${suite}.migration.e2e-spec.ts`,
        );
        expect({ suite, uuid: entry?.source.includes('"uuid-ossp"') }).toEqual({
          suite,
          uuid: true,
        });
        expect(SEARCHED.dblinkRef.test(entry?.source ?? '')).toBe(false);
        expect(SEARCHED.postgresFdw.test(entry?.source ?? '')).toBe(false);
      }
    });
  });

  describe(`invariant 13: no session termination ${HYGIENE}`, () => {
    it('calls neither function anywhere', () => {
      expect(offenders(SEARCHED.pgTerminateBackend)).toEqual([]);
      expect(offenders(SEARCHED.pgCancelBackend)).toEqual([]);
    });
  });

  describe(`pattern controls (case and whitespace) ${HYGIENE}`, () => {
    it.each<[string, string]>([
      ['alterDatabase', ['alter', 'database'].join('  ')],
      ['dropDatabase', ['Drop', 'Database'].join('\t')],
      ['createDatabase', ['CREATE', 'DATABASE'].join('\n')],
      ['pgCancelBackend', ['PG', 'CANCEL', 'BACKEND('].join('_')],
    ])('%s matches %p', (key, text) => {
      expect(SEARCHED[key].test(text)).toBe(true);
    });
  });

  describe(`invariant 6: activity queries scope to current_database() ${HYGIENE}`, () => {
    const activity = ['pg', 'stat', 'activity'].join('_');

    it('every activity query in the scanned files is scoped, and not negated', () => {
      const bad = files.flatMap(({ rel, source }) =>
        literals(rel, source)
          .filter(activityQueryViolates)
          .map(() => rel),
      );
      expect([...new Set(bad)].sort()).toEqual([]);
    });

    it('accepts pid <> pg_backend_pid() alongside the scoping predicate', () => {
      expect(
        activityQueryViolates(
          `select pid from ${activity} where datname = current_database() and pid <> pg_backend_pid()`,
        ),
      ).toBe(false);
    });

    it.each([
      `SELECT 1 FROM ${activity} WHERE NOT datname = current_database()`,
      `SELECT 1 FROM ${activity} a WHERE NOT (a.datname = current_database())`,
      `select 1 from ${activity} where datname <> current_database()`,
      `select 1 from ${activity}`,
    ])('rejects %p', (text) => {
      expect(activityQueryViolates(text)).toBe(true);
    });
  });

  describe(`self-matching ${HYGIENE}`, () => {
    it('neither this file nor static-scan.ts contains a searched-for string', () => {
      for (const rel of [
        'e2e-static-guards.e2e-spec.ts',
        'support/static-scan.ts',
      ]) {
        const source = files.find((f) => f.rel === rel)?.source ?? '';
        for (const [key, pattern] of Object.entries(SEARCHED)) {
          expect({ key, match: pattern.test(source), rel }).toEqual({
            key,
            match: false,
            rel,
          });
        }
      }
    });
  });
});
