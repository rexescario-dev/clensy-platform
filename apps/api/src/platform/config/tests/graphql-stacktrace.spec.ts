import { includeStacktraceInErrorResponses } from '../graphql-stacktrace';

// H: the §4 truth table of the #236 spec, plus the §3 production variants.
type Row = readonly [string | undefined, string | undefined, boolean];

const optedIn: Row[] = (
  ['development', 'test', 'staging', undefined] as const
).map((nodeEnv) => [nodeEnv, 'true', true] as const);

const notOptedIn: Row[] = (
  [undefined, '', 'false', '1', 'TRUE'] as const
).flatMap((appDebug) =>
  (['development', undefined, 'production'] as const).map(
    (nodeEnv) => [nodeEnv, appDebug, false] as const,
  ),
);

const productionOverride: Row[] = (
  ['production', 'Production', ' production ', 'PRODUCTION'] as const
).map((nodeEnv) => [nodeEnv, 'true', false] as const);

describe('includeStacktraceInErrorResponses (H)', () => {
  it.each([...optedIn, ...notOptedIn, ...productionOverride])(
    'NODE_ENV=%j, APP_DEBUG=%j → %s',
    (nodeEnv, appDebug, expected) => {
      expect(includeStacktraceInErrorResponses(nodeEnv, appDebug)).toBe(
        expected,
      );
    },
  );
});
