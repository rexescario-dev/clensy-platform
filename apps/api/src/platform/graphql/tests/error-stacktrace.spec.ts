import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import {
  BadRequestException,
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
import { Test } from '@nestjs/testing';
import type { Server } from 'http';
import request from 'supertest';
import { GraphqlModule, graphqlModuleOptions } from '../graphql.module';

// #236: GraphQL error responses include `extensions.stacktrace` only when
// APP_DEBUG is exactly 'true' and NODE_ENV (trimmed, lowercased) is not
// 'production'. Every case below sends a real request through Apollo and
// @nestjs/apollo's HTTP-exception transform, using the real options factory
// with only `autoSchemaFile` replaced (in-memory, so `src/schema.gql` is
// never written). Test IDs (T*, C*, P*) match the plan's test inventory.

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
// set it first. `configImport` is the ConfigModule import to use.
async function startApp(
  configImport: ReturnType<typeof ConfigModule.forRoot>,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      configImport,
      NestGraphQLModule.forRootAsync<ApolloDriverConfig>({
        driver: ApolloDriver,
        imports: [ConfigModule],
        inject: [ConfigService],
        useFactory: (config: ConfigService): ApolloDriverConfig => ({
          ...graphqlModuleOptions(config),
          autoSchemaFile: true,
        }),
      }),
    ],
    providers: [StacktraceTestResolver],
  }).compile();
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
): Promise<T> {
  const saved = snapshotEnv(ENV_KEYS);
  let app: INestApplication | undefined;
  let workFailed = false;
  try {
    applyEnv(env);
    app = await startApp(ConfigModule.forRoot({ ignoreEnvFile: true }));
    return await fn(app);
  } catch (error) {
    workFailed = true;
    throw error;
  } finally {
    await cleanUp([() => app?.close(), () => restoreEnv(saved)], workFailed);
  }
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
});
