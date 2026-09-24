import type { FieldErrors } from './types';

interface RawGraphQLError {
  extensions?: {
    originalError?: {
      message?: unknown;
    };
  };
}

/**
 * Maps a failed `createCustomer` (or any field-validated) GraphQL mutation
 * error onto the shared FieldErrors contract. Parses Nest's default
 * class-validator error shape observed in a real captured response (spec
 * §4.5): `extensions.originalError.message` is an array of
 * "<property> <constraint description>" strings — the leading token up to
 * the first space is the field name. Returns undefined when `error` is not
 * recognizably this shape, or when none of its constraint messages name a
 * field in `knownFields`, so the caller falls back to its own generic
 * message rather than silently swallowing an unrelated failure.
 */
export function normalizeApiValidationErrors(
  error: unknown,
  knownFields: string[],
): FieldErrors | undefined {
  const graphQLErrors = extractGraphQLErrors(error);
  if (!graphQLErrors) {
    return undefined;
  }

  const result: FieldErrors = {};

  for (const graphQLError of graphQLErrors) {
    const constraintMessages = graphQLError.extensions?.originalError?.message;
    if (!Array.isArray(constraintMessages)) {
      continue;
    }
    for (const constraintMessage of constraintMessages) {
      if (typeof constraintMessage !== 'string') {
        continue;
      }
      const field = constraintMessage.split(' ')[0];
      if (!field || !knownFields.includes(field)) {
        continue;
      }
      (result[field] ??= []).push(constraintMessage);
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Recognizes two shapes: an Apollo Client thrown error's own `graphQLErrors`
 * array, and a raw GraphQL response body's top-level `errors` array (the
 * shape a captured fixture — or a direct fetch/curl response — carries).
 */
function extractGraphQLErrors(error: unknown): RawGraphQLError[] | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }
  const withGraphQLErrors = error as { graphQLErrors?: unknown };
  if (Array.isArray(withGraphQLErrors.graphQLErrors)) {
    return withGraphQLErrors.graphQLErrors as RawGraphQLError[];
  }
  const withErrors = error as { errors?: unknown };
  if (Array.isArray(withErrors.errors)) {
    return withErrors.errors as RawGraphQLError[];
  }
  return undefined;
}
