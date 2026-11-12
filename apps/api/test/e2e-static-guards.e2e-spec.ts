import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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

/** Invariant 2: a direct `DB_*` read, dotted or bracketed (M7 observation 3). */
const DB_ENV_READ = /process\.env(\.DB_[A-Z]+|\[\s*['"`]DB_[A-Z]+['"`]\s*\])/;
/** Invariant 2: a literal `clensy` fallback after `??` or `||`. */
const CLENSY_FALLBACK = /(\?\?|\|\|)\s*['"`]clensy['"`]/;
/** A `pg` or `pg-*` package specifier, or a subpath of one. */
const PG_SPECIFIER = /^pg(-[\w-]+)?(\/.*)?$/;

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
        offenders(DB_ENV_READ, [
          'support/e2e-connection.ts',
          'support/e2e-target.ts',
        ]),
      ).toEqual([]);
    });

    it('has no literal clensy fallback', () => {
      expect(offenders(CLENSY_FALLBACK)).toEqual([]);
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

  // M7 observation 3: the forms each pattern must and must not see. The
  // samples are built from fragments, because this file is scanned too.
  describe(`invariant 2 and pg pattern controls ${HYGIENE}`, () => {
    const env = ['process', 'env'].join('.');
    const q = (text: string, quote = "'"): string => quote + text + quote;

    it.each([
      `${env}.DB_NAME`,
      `${env}[${q('DB_NAME')}]`,
      `${env}[${q('DB_HOST', '"')}]`,
      `${env}[ ${q('DB_PORT')} ]`,
      `${env}[${q('DB_USERNAME', '`')}]`,
    ])('DB_* read %p is detected', (text) => {
      expect(DB_ENV_READ.test(text)).toBe(true);
    });

    it.each([`${env}[key]`, `${env}.NODE_ENV`, `${env}[${q('NODE_ENV')}]`])(
      '%p is not a DB_* read',
      (text) => {
        expect(DB_ENV_READ.test(text)).toBe(false);
      },
    );

    it.each([
      `x ?? ${q('clensy')}`,
      `x || ${q('clensy')}`,
      `x||${q('clensy', '"')}`,
      `x ?? ${q('clensy', '`')}`,
    ])('fallback %p is detected', (text) => {
      expect(CLENSY_FALLBACK.test(text)).toBe(true);
    });

    it.each([`x ?? ${q('clensy_test')}`, `x || ${q('clensy_e2e')}`])(
      '%p is not a clensy fallback',
      (text) => {
        expect(CLENSY_FALLBACK.test(text)).toBe(false);
      },
    );

    it.each([
      'pg',
      'pg-pool',
      'pg-native',
      'pg/lib/client',
      'pg/lib/native/index.js',
    ])('specifier %p is a pg import', (specifier) => {
      expect(PG_SPECIFIER.test(specifier)).toBe(true);
    });

    it.each(['pgsql-ast-parser', 'typeorm', './pg', '@types/pg'])(
      'specifier %p is not a pg import',
      (specifier) => {
        expect(PG_SPECIFIER.test(specifier)).toBe(false);
      },
    );
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

  // Jest module registry (Review Focus 1; characterization). One test per
  // bullet below; sub-variants share their bullet's test. Breaks (Task 7
  // Step 4, outside the commit): r1 resetModules, r2 isolateModules, r3 a
  // typeorm factory mock, r4 require of the module builtin, r5
  // resetModules in a jest-e2e.json copy, r6 the flag in a script copy.
  describe(`Jest module registry ${HYGIENE}`, () => {
    const jestCall = (name: string): RegExp =>
      new RegExp(`\\b${'jest'}\\.${name}\\s*\\(`);
    const apiRoot = resolve(__dirname, '..');
    // Two test-only overrides (M7 observation 5), read nowhere else. They
    // exist only so characterization breaks r5 and r6 can point these two
    // checks at a temporary copy instead of editing the real file:
    //   E2E_GUARD_JEST_CONFIG  — path of the Jest config to check; default
    //                            apps/api/test/jest-e2e.json;
    //   E2E_GUARD_PACKAGE_JSON — path of the package.json whose test:e2e
    //                            scripts are checked; default
    //                            apps/api/package.json.
    // Each value must be a path to a readable JSON file. No script, CI job
    // or config sets them (pinned below); an unset value means the default.
    const jestConfigPath =
      process.env.E2E_GUARD_JEST_CONFIG ?? join(apiRoot, 'test/jest-e2e.json');
    const packageJsonPath =
      process.env.E2E_GUARD_PACKAGE_JSON ?? join(apiRoot, 'package.json');

    it('no script, CI workflow or Jest config sets an E2E_GUARD_* override', () => {
      const repoRoot = resolve(apiRoot, '../..');
      const workflows = join(repoRoot, '.github/workflows');
      const checked = [
        join(apiRoot, 'package.json'),
        join(apiRoot, 'test/jest-e2e.json'),
        join(apiRoot, 'jest.config.ts'),
        join(repoRoot, 'package.json'),
        join(repoRoot, 'turbo.json'),
        ...readdirSync(workflows)
          .filter((name) => /\.ya?ml$/.test(name))
          .map((name) => join(workflows, name)),
      ].filter((file) => existsSync(file));
      const seam = ['E2E', 'GUARD', ''].join('_');
      expect(
        checked
          .filter((file) => readFileSync(file, 'utf8').includes(seam))
          .map((file) => file.slice(repoRoot.length + 1)),
      ).toEqual([]);
    });

    it('never resets the module registry', () => {
      expect(offenders(jestCall(['reset', 'Modules'].join('')))).toEqual([]);
    });

    it('never isolates modules (isolateModules, isolateModulesAsync)', () => {
      expect(
        offenders(jestCall(`${['isolate', 'Modules'].join('')}(Async)?`)),
      ).toEqual([]);
    });

    it('never factory-mocks typeorm, @nestjs/typeorm or pg', () => {
      const factoryMock = new RegExp(
        `\\b${'jest'}\\.(mock|doMock)\\s*\\(\\s*['"](typeorm|@nestjs/typeorm|pg)['"]\\s*,`,
      );
      expect(offenders(factoryMock)).toEqual([]);
    });

    it('never loads the module builtin', () => {
      const builtin = ['module', 'node:module'].join('|');
      const pattern = new RegExp(
        `(from\\s+|require\\(\\s*|import\\(\\s*)['"](${builtin})['"]`,
      );
      expect(offenders(pattern)).toEqual([]);
    });

    it('jest-e2e.json sets neither resetModules nor resetMocks', () => {
      const config = JSON.parse(readFileSync(jestConfigPath, 'utf8')) as Record<
        string,
        unknown
      >;
      expect(config[['reset', 'Modules'].join('')]).not.toBe(true);
      expect(config[['reset', 'Mocks'].join('')]).not.toBe(true);
    });

    it('no test:e2e script passes the resetModules flag', () => {
      const scripts = (
        JSON.parse(readFileSync(packageJsonPath, 'utf8')) as {
          scripts: Record<string, string>;
        }
      ).scripts;
      const flag = `--${['reset', 'Modules'].join('')}`;
      for (const [name, script] of Object.entries(scripts)) {
        if (name.startsWith('test:e2e')) {
          expect({ name, script: script.includes(flag) }).toEqual({
            name,
            script: false,
          });
        }
      }
    });
  });

  // Invariant 1, source-import rule (characterization). TypeORM loads pg at
  // run time in every test environment; this checks source imports only.
  // Breaks (Task 7 Step 4): p1 a pg import in a spec, p2 a spec importing
  // provision-test-database.
  describe(`raw pg source imports ${HYGIENE}`, () => {
    const provisioner = 'support/provision-test-database.ts';

    function specifiers(rel: string, source: string): string[] {
      const sourceFile = ts.createSourceFile(
        rel,
        source,
        ts.ScriptTarget.Latest,
        true,
      );
      const found: string[] = [];
      const visit = (node: ts.Node): void => {
        if (
          (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
          node.moduleSpecifier !== undefined &&
          ts.isStringLiteral(node.moduleSpecifier)
        ) {
          found.push(node.moduleSpecifier.text);
        } else if (
          ts.isCallExpression(node) &&
          (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
            (ts.isIdentifier(node.expression) &&
              node.expression.text === 'require')) &&
          node.arguments.length > 0 &&
          ts.isStringLiteralLike(node.arguments[0])
        ) {
          found.push(node.arguments[0].text);
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
      return found;
    }

    const graph = new Map<string, { local: string[]; pg: boolean }>();
    const byRel = new Map(files.map((f) => [f.rel, f]));
    for (const { file, rel, source } of files) {
      const specs = specifiers(rel, source);
      const local: string[] = [];
      for (const spec of specs.filter((sp) => sp.startsWith('.'))) {
        const base = resolve(dirname(file), spec);
        for (const candidate of [
          base,
          ...['.ts', '.js', '/index.ts'].map((ext) => base + ext),
        ]) {
          const candidateRel = testRelative(candidate);
          if (byRel.has(candidateRel)) {
            local.push(candidateRel);
            break;
          }
        }
      }
      graph.set(rel, { local, pg: specs.some((sp) => PG_SPECIFIER.test(sp)) });
    }

    function reaches(from: string, target: string): boolean {
      const seen = new Set<string>();
      const stack = [from];
      while (stack.length > 0) {
        const current = stack.pop() as string;
        if (current === target) {
          return true;
        }
        if (!seen.has(current)) {
          seen.add(current);
          stack.push(...(graph.get(current)?.local ?? []));
        }
      }
      return false;
    }

    it('only provision-test-database.ts imports pg', () => {
      const importers = [...graph.entries()]
        .filter(([, node]) => node.pg)
        .map(([rel]) => rel);
      expect(importers).toEqual([provisioner]);
    });

    it('no spec reaches provision-test-database.ts; only the two entrypoints do', () => {
      const reachers = [...graph.keys()]
        .filter((rel) => rel !== provisioner && reaches(rel, provisioner))
        .sort();
      expect(reachers).toEqual(['global-setup.ts', 'support/provision-cli.ts']);
    });
  });

  // Invariant 10, never automatic (characterization). Comments are
  // stripped first: two src files mention the seeder in comments only.
  // Breaks (Task 11 Step 5): a prestart script, an import in main.ts, a
  // Dockerfile RUN line.
  describe(`invariant 10: seeders are never run automatically ${HYGIENE}`, () => {
    const repoRoot = resolve(__dirname, '../../..');
    const apiDir = resolve(__dirname, '..');
    const references = new RegExp(
      [
        ['seed', 'dev', 'owner'].join('-'),
        ['db', 'seed'].join(':'),
        ['seed', 'ts'].join('\\.'),
        ['seed', 'js'].join('\\.'),
        `/${'seed'}['"]`,
        `['"][^'"]*${['dev', 'owner'].join('-')}/`,
      ].join('|'),
    );

    function withoutComments(text: string): string {
      const scanner = ts.createScanner(ts.ScriptTarget.Latest, true);
      scanner.setText(text);
      const out: string[] = [];
      for (
        let token = scanner.scan();
        token !== ts.SyntaxKind.EndOfFileToken;
        token = scanner.scan()
      ) {
        out.push(scanner.getTokenText());
      }
      return out.join(' ');
    }

    function sourceFilesUnder(dir: string): string[] {
      return listE2eSourceFiles(dir).filter((file) => file.endsWith('.ts'));
    }

    it('no startup, build, install, test or CI path references a seeder', () => {
      const srcDir = join(apiDir, 'src');
      const exempt = (file: string): boolean =>
        file.endsWith(join('platform', 'database', 'seed.ts')) ||
        file.endsWith(
          join(
            'platform',
            'database',
            `${['seed', 'dev', 'owner'].join('-')}.ts`,
          ),
        ) ||
        file.includes(join('platform', 'database', 'dev-owner')) ||
        (file.includes(`${join('src')}/`) && file.includes(`${'/tests/'}`));
      const hits = sourceFilesUnder(srcDir)
        .filter((file) => !exempt(file))
        .filter((file) =>
          references.test(withoutComments(readFileSync(file, 'utf8'))),
        )
        .map((file) => file.slice(apiDir.length + 1));
      const configs = [
        join(repoRoot, 'Dockerfile'),
        join(repoRoot, 'Dockerfile.web'),
        join(repoRoot, 'docker-compose.yml'),
        join(repoRoot, '.github/workflows/ci.yml'),
        join(repoRoot, 'turbo.json'),
        join(apiDir, 'test/setup-e2e-env.ts'),
        join(apiDir, 'test/global-setup.ts'),
      ].filter((file) => references.test(readFileSync(file, 'utf8')));
      const scriptNames = [
        'start',
        'start:dev',
        'start:debug',
        'start:prod',
        'prestart',
        'prestart:dev',
        'prebuild',
        'build',
        'postinstall',
        'prepare',
        'dev',
        'migration:run',
        'test',
        'test:e2e',
        'test:e2e:release-gate',
      ];
      const scriptHits: string[] = [];
      for (const pkg of [
        join(repoRoot, 'package.json'),
        join(apiDir, 'package.json'),
      ]) {
        const scripts = (
          JSON.parse(readFileSync(pkg, 'utf8')) as {
            scripts: Record<string, string>;
          }
        ).scripts;
        for (const name of scriptNames) {
          if (scripts[name] !== undefined && references.test(scripts[name])) {
            scriptHits.push(`${pkg.slice(repoRoot.length + 1)}:${name}`);
          }
        }
      }
      expect({ configs, hits, scriptHits }).toEqual({
        configs: [],
        hits: [],
        scriptHits: [],
      });
    });

    it('the dev-owner entrypoint and core import no app module, data source or seed.ts', () => {
      const banned = /(data-source|app\.module|database\.module|\/seed)['"]/;
      const devOwnerFiles = [
        join(
          apiDir,
          'src/platform/database',
          `${['seed', 'dev', 'owner'].join('-')}.ts`,
        ),
        ...sourceFilesUnder(join(apiDir, 'src/platform/database/dev-owner')),
      ];
      const hits = devOwnerFiles
        .filter((file) =>
          banned.test(withoutComments(readFileSync(file, 'utf8'))),
        )
        .map((file) => file.slice(apiDir.length + 1));
      expect(hits).toEqual([]);
    });

    it('both package.json files define db:seed:dev-owner as planned', () => {
      const name = ['db', 'seed', 'dev-owner'].join(':');
      const api = (
        JSON.parse(readFileSync(join(apiDir, 'package.json'), 'utf8')) as {
          scripts: Record<string, string>;
        }
      ).scripts;
      const root = (
        JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
          scripts: Record<string, string>;
        }
      ).scripts;
      expect(api[name]).toBe(
        `ts-node -r tsconfig-paths/register src/platform/database/${['seed', 'dev', 'owner'].join('-')}.ts`,
      );
      expect(root[name]).toBe(`pnpm --filter api ${name}`);
    });
  });
});
