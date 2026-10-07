import { onError } from '@apollo/client/link/error';
import type { GraphQLFormattedError } from 'graphql';

// The session signal (session routing spec §4.1). Any operation whose result
// carries a GraphQL error with code UNAUTHENTICATED notifies the registered
// listeners, once per result. It only notifies: it never redirects, clears
// the store or knows about routing (spec §5 invariant 5), so with no
// listener — e.g. a wrong password on the sign-in page, outside the /app layout — it
// does nothing. Network and HTTP-level failures are not session evidence and
// never notify. Results pass through to the caller unchanged.
type SessionInvalidListener = () => void;

const listeners = new Set<SessionInvalidListener>();

export const sessionErrorLink = onError(({ graphQLErrors, networkError }) => {
  if (networkError) return;
  if (hasUnauthenticatedError(graphQLErrors)) notifySessionInvalid();
});

export function onSessionInvalid(listener: SessionInvalidListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function hasUnauthenticatedError(errors: ReadonlyArray<GraphQLFormattedError> | undefined): boolean {
  return errors?.some((error) => error.extensions?.code === 'UNAUTHENTICATED') ?? false;
}

function notifySessionInvalid(): void {
  for (const listener of [...listeners]) listener();
}
