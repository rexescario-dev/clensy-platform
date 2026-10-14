interface ServerGraphQLError {
  extensions?: { originalError?: { message?: unknown } };
  message?: unknown;
}

// The server's own message on a failed Apollo mutation, for an inline
// alert (#155 §Submit: "the server message when Apollo exposes one").
// Nest puts a service exception's text, or a ValidationPipe failure's
// constraint list, in `extensions.originalError.message`; the top-level
// message of a pipe failure is only "Bad Request Exception". A network
// failure, or any other shape, has none: the caller shows its own copy.
export function graphQLErrorMessage(error: unknown): string | undefined {
  const errors = (error as { graphQLErrors?: unknown } | null | undefined)?.graphQLErrors;
  if (!Array.isArray(errors) || errors.length === 0) return undefined;
  const candidate: unknown = errors[0];
  if (typeof candidate !== 'object' || candidate === null) return undefined;
  const first = candidate as ServerGraphQLError;
  const original = first.extensions?.originalError?.message;
  if (typeof original === 'string' && original !== '') return original;
  if (Array.isArray(original) && typeof original[0] === 'string' && original[0] !== '') return original[0];
  return typeof first.message === 'string' && first.message !== '' ? first.message : undefined;
}
