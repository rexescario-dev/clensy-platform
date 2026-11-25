import { isAppDebugEnabled } from './app-debug';

// Whether GraphQL error responses include `extensions.stacktrace` (#236).
// Only when the operator opts in with APP_DEBUG exactly 'true', and never in
// production. Production is matched after trimming and lowercasing, so a
// mistyped `Production` still suppresses stack traces (spec §3, §4).
export function includeStacktraceInErrorResponses(
  nodeEnv: string | undefined,
  appDebug: string | undefined,
): boolean {
  const isProduction = (nodeEnv ?? '').trim().toLowerCase() === 'production';
  return isAppDebugEnabled(appDebug) && !isProduction;
}
