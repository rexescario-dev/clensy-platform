import { INestApplication, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { Role } from '../src/platform/auth/domain/role';
import type { LabelOverrideRejectionReason } from '../src/modules/admins/domain/tenant-label-overrides';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import {
  createTestTenant,
  removeTestTenants,
  SeededAdmin,
  seedTenantAdmin,
} from './helpers/seed-tenant-admin';

// #118 (tenant label overrides spec §4.2, §4.3, §6.1): structurally
// malformed JSONB, mixed values, log-once redacted warnings and the login
// path, through real HTTP and a real tenant row. Cross-tenant isolation and
// Super Admin are release-gate Phase 8 (CI).
const SELECTION =
  'tenantLabelOverrides { locale roles { ANALYST CUSTOMER_SUPPORT FINANCE OPS_MANAGER SCHEDULER TENANT_OWNER } }';
const CURRENT_ADMIN_QUERY = `{ currentAdmin { ${SELECTION} } }`;
// The session login never selects the new field, so a missing field fails
// each case with a GraphQL error instead of breaking beforeAll.
const SESSION_LOGIN_MUTATION =
  'mutation Login($input: LoginInput!) { login(loginInput: $input) { success } }';
const LOGIN_MUTATION = `mutation Login($input: LoginInput!) { login(loginInput: $input) { admin { ${SELECTION} } } }`;
const UNSET = {
  ANALYST: null,
  CUSTOMER_SUPPORT: null,
  FINANCE: null,
  OPS_MANAGER: null,
  SCHEDULER: null,
  TENANT_OWNER: null,
};

type Rejection = [path: string, reason: LabelOverrideRejectionReason];

// [label, stored jsonb value, expected rejections, rejected stored strings
// that must never appear in a log line]
const MALFORMED: [string, unknown, Rejection[], string[]][] = [
  ['a scalar', 'Billing', [['$', 'not-an-object']], ['Billing']],
  ['an array', ['Billing'], [['$', 'not-an-object']], ['Billing']],
  [
    'only an unknown locale',
    { fr: { roles: { FINANCE: 'Facturation' } } },
    [['fr', 'unknown-key']],
    ['Facturation'],
  ],
  [
    'only wrong value types',
    { en: { roles: { ANALYST: true, FINANCE: 42 } } },
    [
      ['en.roles.ANALYST', 'not-a-string'],
      ['en.roles.FINANCE', 'not-a-string'],
    ],
    [],
  ],
  [
    'a roles array of 100 items',
    { en: { roles: Array.from({ length: 100 }, () => 'Billing') } },
    [['en.roles', 'not-an-object']],
    ['Billing'],
  ],
];

interface GraphqlBody {
  data?: {
    currentAdmin?: { tenantLabelOverrides: unknown };
    login?: { admin: { tenantLabelOverrides: unknown } };
  };
  errors?: unknown[];
}

describe('Tenant label overrides (e2e, #118)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let owner: SeededAdmin;
  let cookie: string;
  let tenantId: string;
  let warn: jest.SpyInstance;

  function login(query: string) {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({
        query,
        variables: { input: { email: owner.email, password: owner.password } },
      });
  }

  async function currentAdminOverrides(): Promise<unknown> {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query: CURRENT_ADMIN_QUERY });
    const body = response.body as GraphqlBody;
    expect(body.errors).toBeUndefined();
    return body.data?.currentAdmin?.tenantLabelOverrides;
  }

  // jsonb, passed as text: node-postgres would turn a JS array into a
  // Postgres array literal, not JSON.
  async function store(value: unknown): Promise<void> {
    await dataSource.query(
      `UPDATE "tenant_entity" SET "labelOverrides" = $2::jsonb WHERE "id" = $1`,
      [tenantId, JSON.stringify(value)],
    );
  }

  async function storeSqlNull(): Promise<void> {
    await dataSource.query(
      `UPDATE "tenant_entity" SET "labelOverrides" = NULL WHERE "id" = $1`,
      [tenantId],
    );
  }

  function warnings(): string[] {
    return warn.mock.calls.map(([message]) => String(message)).sort();
  }

  // The exact line TenantLabelOverridesService writes per rejection.
  function expectedWarnings(...rejections: Rejection[]): string[] {
    return rejections
      .map(
        ([path, reason]) =>
          `tenant ${tenantId}: dropped label override at ${path} (${reason})`,
      )
      .sort();
  }

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    applyPlatformPipes(app);
    await app.init();
    dataSource = moduleFixture.get(DataSource);
    tenantId = await createTestTenant(dataSource);
    owner = await seedTenantAdmin(dataSource, Role.TENANT_OWNER, tenantId);
    const response = await login(SESSION_LOGIN_MUTATION);
    const setCookie = response.headers['set-cookie'] as unknown as string[];
    cookie = setCookie[0].split(';')[0];
  });

  beforeEach(() => {
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => warn.mockRestore());

  afterAll(async () => {
    await removeTestTenants(dataSource, [tenantId]);
    await app.close();
  });

  it('returns null for a NULL column and logs nothing', async () => {
    await storeSqlNull();
    expect(await currentAdminOverrides()).toBeNull();
    expect(warnings()).toEqual([]);
  });

  it.each(MALFORMED)(
    'returns null for structurally malformed JSONB with no valid leaf: %s',
    async (_label, value, rejections, rejectedValues) => {
      await store(value);
      expect(await currentAdminOverrides()).toBeNull();
      expect(warnings()).toEqual(expectedWarnings(...rejections));
      const logged = warnings().join('\n');
      for (const rejected of rejectedValues) {
        expect(logged).not.toContain(rejected);
      }
    },
  );

  it('keeps only the valid, trimmed leaves of a mixed value and logs only the rejected ones', async () => {
    await store({
      en: {
        roles: {
          ANALYST: 'x'.repeat(65),
          FINANCE: '  Billing  ',
          SCHEDULER: 'Sched\nUler',
          SUPER_ADMIN: 'Root-Label-SA',
        },
      },
      fr: {},
    });
    expect(await currentAdminOverrides()).toEqual({
      locale: 'en',
      roles: { ...UNSET, FINANCE: 'Billing' },
    });
    expect(warnings()).toEqual(
      expectedWarnings(
        ['en.roles.ANALYST', 'too-long'],
        ['en.roles.SCHEDULER', 'control-character'],
        ['en.roles.SUPER_ADMIN', 'unknown-key'],
        ['fr', 'unknown-key'],
      ),
    );
    const logged = warnings().join('\n');
    // No rejected value, exactly as stored, reaches the log.
    for (const rejected of ['x'.repeat(65), 'Sched\nUler', 'Root-Label-SA']) {
      expect(logged).not.toContain(rejected);
    }
    // Deliberately also the kept value: a warning carries no stored value at all.
    expect(logged).not.toContain('Billing');
  });

  // #129 (spec §4.2 Path rendering, §6.1): a hostile stored key yields one
  // escaped, bounded, single-line warning and never its stored value.
  it('logs one single-line, bounded warning per hostile stored key', async () => {
    await store({
      en: {
        roles: {
          'A\nB': 'Line-Value',
          FINANCE: 'Billing',
          ['x'.repeat(5_000)]: 'Long-Value',
        },
      },
    });
    expect(await currentAdminOverrides()).toEqual({
      locale: 'en',
      roles: { ...UNSET, FINANCE: 'Billing' },
    });
    expect(warnings()).toEqual(
      expectedWarnings(
        ['en.roles["A\\u000AB"]', 'unknown-key'],
        [`en.roles["${'x'.repeat(64)}"...(+4936)]`, 'unknown-key'],
      ),
    );
    for (const line of warnings()) {
      expect(line).toMatch(/^[\x20-\x7E]+$/);
      expect(line.length).toBeLessThan(256);
    }
    const logged = warnings().join('\n');
    for (const stored of ['Line-Value', 'Long-Value', 'Billing']) {
      expect(logged).not.toContain(stored);
    }
  });

  it('resolves the same tenant labels on the login result', async () => {
    await store({ en: { roles: { FINANCE: 'Billing' } } });
    const body = (await login(LOGIN_MUTATION)).body as GraphqlBody;
    expect(body.errors).toBeUndefined();
    expect(body.data?.login?.admin.tenantLabelOverrides).toEqual({
      locale: 'en',
      roles: { ...UNSET, FINANCE: 'Billing' },
    });
  });
});
