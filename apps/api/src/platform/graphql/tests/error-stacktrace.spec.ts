import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import {
  BadRequestException,
  DynamicModule,
  INestApplication,
  NotFoundException,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  GRAPHQL_MODULE_OPTIONS,
  GraphQLModule as NestGraphQLModule,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { FileSystemHelper } from '@nestjs/graphql/dist/schema-builder/helpers/file-system.helper.js';
import { Test } from '@nestjs/testing';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import type { Server } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { GraphqlModule, graphqlModuleOptions } from '../graphql.module';

// #236: GraphQL error responses include `extensions.stacktrace` only when
// APP_DEBUG is exactly 'true' and NODE_ENV (trimmed, lowercased) is not
// 'production'. Every case below sends a real request through Apollo and
// @nestjs/apollo's HTTP-exception transform, using the real options factory
// with only `autoSchemaFile` replaced (in-memory, so `src/schema.gql` is
// never written). R1–R3 boot the real GraphqlModule instead. Test IDs (T*, C*,
// P*, F-*) match the plan's test inventory; F-d and R1–R3 are the post-closeout
// follow-ups for M7-2 and M7-3.

type EnvKey = 'APP_DEBUG' | 'NODE_ENV';
type EnvOverrides = Partial<Record<EnvKey, string>>;
type EnvSnapshot = Map<string, string | undefined>;
type Field = 'badRequest' | 'notFound';

interface GraphqlErrorBody {
  extensions?: Record<string, unknown>;
  locations?: ReadonlyArray<{ column: number; line: number }>;
  message: string;
  path?: ReadonlyArray<number | string>;
}

interface GraphqlResponseBody {
  errors?: GraphqlErrorBody[];
}

const ENV_KEYS: readonly EnvKey[] = ['APP_DEBUG', 'NODE_ENV'];
const BAD_REQUEST_MESSAGE = 'stacktrace test: bad request';
const NOT_FOUND_MESSAGE = 'stacktrace test: not found';

// Stands in for @nestjs/graphql's schema-file writer, so booting the real
// GraphqlModule (whose `autoSchemaFile` is src/schema.gql) never writes a file.
const writeSchemaFile = jest.fn<Promise<void>, [string, string]>();

@Resolver()
class StacktraceTestResolver {
  @Query(() => String)
  badRequest(): string {
    throw new BadRequestException(BAD_REQUEST_MESSAGE);
  }

  @Query(() => String)
  notFound(): string {
    throw new NotFoundException(NOT_FOUND_MESSAGE);
  }
}

// Sets or deletes each of NODE_ENV and APP_DEBUG; `undefined` means unset.
function applyEnv(env: EnvOverrides): void {
  for (const key of ENV_KEYS) {
    const value = env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

// Runs every cleanup step even if an earlier one throws. Rethrows the first
// cleanup error only when the guarded work itself succeeded, so a cleanup
// failure never hides the original error.
async function cleanUp(
  steps: ReadonlyArray<() => unknown>,
  workFailed: boolean,
): Promise<void> {
  let firstFailure: Error | undefined;
  for (const step of steps) {
    try {
      await step();
    } catch (error) {
      firstFailure ??=
        error instanceof Error ? error : new Error(String(error));
    }
  }
  if (firstFailure && !workFailed) {
    throw firstFailure;
  }
}

// Returns a ConfigModule that reads `.env` from `dir`, the same way the app
// reads apps/api/.env from apps/api. forRoot() resolves the cwd's `.env` and
// reads it synchronously, before its first await, so `dir` is the cwd only
// for this synchronous call: no await happens while it is changed, and no
// other test can observe it, even one Jest starts after a timeout (#236
// M7-2). If forRoot() ever read the file later, F-a would fail.
function configModuleIn(dir: string): ReturnType<typeof ConfigModule.forRoot> {
  const previousCwd = process.cwd();
  process.chdir(dir);
  try {
    return ConfigModule.forRoot();
  } finally {
    process.chdir(previousCwd);
  }
}

function expectStacktrace(stacktrace: unknown): void {
  expect(Array.isArray(stacktrace)).toBe(true);
  expect((stacktrace as unknown[]).length).toBeGreaterThan(0);
}

async function firstError(
  app: INestApplication,
  field: Field,
): Promise<GraphqlErrorBody> {
  const response = await request(app.getHttpServer() as Server)
    .post('/graphql')
    .send({ query: `{ ${field} }` });
  const body = response.body as GraphqlResponseBody;
  const error = body.errors?.[0];
  if (!error) {
    throw new Error(`expected a GraphQL error for ${field}`);
  }
  return error;
}

function restoreEnv(snapshot: EnvSnapshot): void {
  for (const [key, value] of snapshot) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function snapshotEnv(keys: readonly string[]): EnvSnapshot {
  return new Map(keys.map((key) => [key, process.env[key]]));
}

async function stacktraceFor(
  env: EnvOverrides,
  field: Field = 'badRequest',
): Promise<unknown> {
  return withApp(env, async (app) => {
    const error = await firstError(app, field);
    return error.extensions?.stacktrace;
  });
}

// Builds and starts the test app. It never touches the environment; callers
// set it first. `configImport` is the ConfigModule import to use, and
// `graphqlImport` the GraphQL module under test.
async function startApp(
  configImport: ReturnType<typeof ConfigModule.forRoot>,
  graphqlImport: DynamicModule | typeof GraphqlModule = wrappedGraphqlModule(),
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [configImport, graphqlImport],
    providers: [StacktraceTestResolver],
  })
    .overrideProvider(FileSystemHelper)
    .useValue({ writeFile: writeSchemaFile })
    .compile();
  const app = moduleRef.createNestApplication();
  try {
    await app.init();
  } catch (error) {
    await app.close().catch(() => undefined);
    throw error;
  }
  return app;
}

// Runs `fn` against an app booted under `env`. State is saved before any
// change and restored in `finally`, whatever fails (spec §7 req 6).
// `ignoreEnvFile` keeps a developer's apps/api/.env out of these tests.
async function withApp<T>(
  env: EnvOverrides,
  fn: (app: INestApplication) => Promise<T>,
  graphqlImport?: DynamicModule | typeof GraphqlModule,
): Promise<T> {
  const saved = snapshotEnv(ENV_KEYS);
  let app: INestApplication | undefined;
  let workFailed = false;
  try {
    applyEnv(env);
    app = await startApp(
      ConfigModule.forRoot({ ignoreEnvFile: true }),
      graphqlImport,
    );
    return await fn(app);
  } catch (error) {
    workFailed = true;
    throw error;
  } finally {
    await cleanUp([() => app?.close(), () => restoreEnv(saved)], workFailed);
  }
}

// Runs `fn` against an app whose ConfigModule reads `.env` from a temporary
// directory, the same way it reads apps/api/.env from apps/api. The
// developer's real apps/api/.env is never read or touched. It builds its own
// app rather than calling `withApp`, whose env reset would wipe
// `processEnv`. Every cleanup step runs whatever fails (spec §7 req 6).
async function withEnvDir<T>(
  fileEnv: Readonly<Record<string, string>>,
  processEnv: EnvOverrides,
  fn: (app: INestApplication) => Promise<T>,
): Promise<T> {
  const saved = snapshotEnv([...ENV_KEYS, ...Object.keys(fileEnv)]);
  let dir: string | undefined;
  let app: INestApplication | undefined;
  let workFailed = false;
  try {
    dir = mkdtempSync(join(tmpdir(), 'gql-stacktrace-'));
    writeFileSync(
      join(dir, '.env'),
      Object.entries(fileEnv)
        .map(([key, value]) => `${key}=${value}\n`)
        .join(''),
    );
    applyEnv(processEnv);
    app = await startApp(configModuleIn(dir));
    return await fn(app);
  } catch (error) {
    workFailed = true;
    throw error;
  } finally {
    await cleanUp(
      [
        () => app?.close(),
        () => dir && rmSync(dir, { force: true, recursive: true }),
        () => restoreEnv(saved),
      ],
      workFailed,
    );
  }
}

// The forRootAsync wrapper most cases use: the real options factory with only
// `autoSchemaFile` replaced, so the schema is built in memory.
function wrappedGraphqlModule(): DynamicModule {
  return NestGraphQLModule.forRootAsync<ApolloDriverConfig>({
    driver: ApolloDriver,
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (config: ConfigService): ApolloDriverConfig => ({
      ...graphqlModuleOptions(config),
      autoSchemaFile: true,
    }),
  });
}

describe('GraphQL error stack traces (#236)', () => {
  describe('red-first', () => {
    it.each(['badRequest', 'notFound'] as const)(
      'T1: NODE_ENV=development, APP_DEBUG unset → no stack trace (%s)',
      async (field) => {
        expect(
          await stacktraceFor({ NODE_ENV: 'development' }, field),
        ).toBeUndefined();
      },
    );

    it.each(['badRequest', 'notFound'] as const)(
      'T2: NODE_ENV unset, APP_DEBUG unset → no stack trace (%s)',
      async (field) => {
        expect(await stacktraceFor({}, field)).toBeUndefined();
      },
    );

    it('T3: NODE_ENV=test, APP_DEBUG=true → stack trace', async () => {
      expectStacktrace(
        await stacktraceFor({ APP_DEBUG: 'true', NODE_ENV: 'test' }),
      );
    });

    it('T4: NODE_ENV=Production, APP_DEBUG=true → no stack trace', async () => {
      expect(
        await stacktraceFor({ APP_DEBUG: 'true', NODE_ENV: 'Production' }),
      ).toBeUndefined();
    });

    it("T5: NODE_ENV=' production ', APP_DEBUG=true → no stack trace", async () => {
      expect(
        await stacktraceFor({ APP_DEBUG: 'true', NODE_ENV: ' production ' }),
      ).toBeUndefined();
    });

    it('T6: the real GraphqlModule passes includeStacktraceInErrorResponses as a boolean', async () => {
      const moduleRef = await Test.createTestingModule({
        imports: [GraphqlModule],
      }).compile();
      try {
        const options = moduleRef.get<ApolloDriverConfig>(
          GRAPHQL_MODULE_OPTIONS,
        );
        expect(typeof options.includeStacktraceInErrorResponses).toBe(
          'boolean',
        );
      } finally {
        await moduleRef.close();
      }
    });
  });

  // M7-3: the same requests through the real GraphqlModule, so its own
  // forRootAsync wiring (imports, inject, useFactory) is covered end to end.
  describe('real GraphqlModule', () => {
    beforeEach(() => {
      writeSchemaFile.mockClear();
    });

    it.each([
      {
        id: 'R1',
        env: { APP_DEBUG: 'true', NODE_ENV: 'development' },
        label: 'NODE_ENV=development, APP_DEBUG=true → stack trace',
        stacktrace: true,
      },
      {
        id: 'R2',
        env: { NODE_ENV: 'development' },
        label: 'NODE_ENV=development, APP_DEBUG unset → no stack trace',
        stacktrace: false,
      },
      {
        id: 'R3',
        env: { APP_DEBUG: 'true', NODE_ENV: 'production' },
        label: 'NODE_ENV=production, APP_DEBUG=true → no stack trace',
        stacktrace: false,
      },
    ] as const)('$id: $label', async ({ env, stacktrace }) => {
      const error = await withApp(
        env,
        (app) => firstError(app, 'badRequest'),
        GraphqlModule,
      );

      // The real options were used: their schema file, written to the stub.
      expect(writeSchemaFile).toHaveBeenCalledWith(
        expect.stringMatching(/[\\/]src[\\/]schema\.gql$/),
        expect.any(String),
      );
      if (stacktrace) {
        expectStacktrace(error.extensions?.stacktrace);
      } else {
        expect(error.extensions?.stacktrace).toBeUndefined();
      }
    });
  });

  describe('characterization (already-correct on Apollo defaults)', () => {
    it('C1: NODE_ENV=production, APP_DEBUG unset → no stack trace', async () => {
      expect(await stacktraceFor({ NODE_ENV: 'production' })).toBeUndefined();
    });

    it('C2: NODE_ENV=production, APP_DEBUG=true → no stack trace', async () => {
      expect(
        await stacktraceFor({ APP_DEBUG: 'true', NODE_ENV: 'production' }),
      ).toBeUndefined();
    });

    it('C3: NODE_ENV=development, APP_DEBUG=true → stack trace', async () => {
      expectStacktrace(
        await stacktraceFor({ APP_DEBUG: 'true', NODE_ENV: 'development' }),
      );
    });
  });

  // Characterization: the rest of the error is the same with and without
  // stack traces (spec §7 req 4, invariant 5).
  describe('preservation', () => {
    const cases = [
      {
        id: 'P1',
        code: 'BAD_REQUEST',
        field: 'badRequest',
        message: BAD_REQUEST_MESSAGE,
        status: undefined,
        statusCode: 400,
      },
      {
        id: 'P2',
        code: 'INTERNAL_SERVER_ERROR',
        field: 'notFound',
        message: NOT_FOUND_MESSAGE,
        status: 404,
        statusCode: 404,
      },
    ] as const;

    function expectLiterals(
      error: GraphqlErrorBody,
      expected: (typeof cases)[number],
    ): void {
      expect(error.message).toBe(expected.message);
      expect(error.path).toEqual([expected.field]);
      expect(error.locations?.length).toBeGreaterThan(0);
      expect(error.extensions?.code).toBe(expected.code);
      expect(error.extensions?.status).toBe(expected.status);
      expect(error.extensions?.originalError).toEqual(
        expect.objectContaining({ statusCode: expected.statusCode }),
      );
    }

    it.each(cases)(
      '$id: the $field error is unchanged apart from extensions.stacktrace',
      async (expected) => {
        const on = await withApp(
          { APP_DEBUG: 'true', NODE_ENV: 'development' },
          (app) => firstError(app, expected.field),
        );
        const off = await withApp({ NODE_ENV: 'development' }, (app) =>
          firstError(app, expected.field),
        );

        // Mode preconditions: the two responses really are on and off.
        expectStacktrace(on.extensions?.stacktrace);
        expect(off.extensions?.stacktrace).toBeUndefined();

        // Literal values on both copies, so an equal-but-wrong pair fails.
        expectLiterals(on, expected);
        expectLiterals(off, expected);

        const onExtensions = { ...on.extensions };
        delete onExtensions.stacktrace;
        expect({ ...on, extensions: onExtensions }).toEqual(off);
      },
    );
  });

  // Characterization: APP_DEBUG and NODE_ENV are honored from the `.env`
  // file source, and the process environment wins over it (invariant 4).
  describe('file source', () => {
    async function fileStacktrace(
      fileEnv: Readonly<Record<string, string>>,
      processEnv: EnvOverrides = {},
    ): Promise<unknown> {
      return withEnvDir(fileEnv, processEnv, async (app) => {
        const error = await firstError(app, 'badRequest');
        return error.extensions?.stacktrace;
      });
    }

    it('F-a: file APP_DEBUG=true, NODE_ENV=development → stack trace', async () => {
      expectStacktrace(
        await fileStacktrace({ APP_DEBUG: 'true', NODE_ENV: 'development' }),
      );
    });

    it('F-b: file APP_DEBUG=true, NODE_ENV=production → no stack trace', async () => {
      expect(
        await fileStacktrace({ APP_DEBUG: 'true', NODE_ENV: 'production' }),
      ).toBeUndefined();
    });

    it('F-c: process APP_DEBUG=false wins over file APP_DEBUG=true → no stack trace', async () => {
      expect(
        await fileStacktrace({ APP_DEBUG: 'true' }, { APP_DEBUG: 'false' }),
      ).toBeUndefined();
    });

    // M7-2: the temporary directory is never the cwd across an await, so a
    // test Jest starts after this one times out cannot inherit it.
    it('F-d: the cwd is unchanged while the app boots and serves', async () => {
      const cwd = process.cwd();
      expect(
        await withEnvDir({}, {}, () => Promise.resolve(process.cwd())),
      ).toBe(cwd);
    });
  });
});
