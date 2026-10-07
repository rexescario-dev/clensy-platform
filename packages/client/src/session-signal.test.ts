import { ApolloLink, execute, gql, Observable, type FetchResult } from '@apollo/client';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { onSessionInvalid, sessionErrorLink } from './session-signal';

const PROBE = gql`
  query Probe {
    probe
  }
`;

const unauthenticated = { message: 'Unauthorized', extensions: { code: 'UNAUTHENTICATED' } };
const forbidden = { message: 'Forbidden resource', extensions: { code: 'FORBIDDEN' } };

const unsubscribes: Array<() => void> = [];

afterEach(() => {
  for (const unsubscribe of unsubscribes.splice(0)) unsubscribe();
});

function listen() {
  const listener = vi.fn();
  unsubscribes.push(onSessionInvalid(listener));
  return listener;
}

// Runs one operation through the session link and a terminating stub, and
// resolves with what the caller observes.
function runOperation(outcome: { error: Error } | { result: FetchResult }) {
  const terminating = new ApolloLink(
    () =>
      new Observable<FetchResult>((observer) => {
        if ('error' in outcome) {
          observer.error(outcome.error);
          return;
        }
        observer.next(outcome.result);
        observer.complete();
      }),
  );
  return new Promise<{ error?: unknown; results: FetchResult[] }>((settle) => {
    const results: FetchResult[] = [];
    execute(ApolloLink.from([sessionErrorLink, terminating]), { query: PROBE }).subscribe({
      complete: () => settle({ results }),
      error: (error: unknown) => settle({ error, results }),
      next: (result) => results.push(result),
    });
  });
}

// Session routing spec §4.1 / §8 item 1.
describe('session signal', () => {
  it('notifies every registered listener once for an UNAUTHENTICATED result', async () => {
    const first = listen();
    const second = listen();

    await runOperation({ result: { data: null, errors: [unauthenticated] } });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('notifies each listener exactly once for a result carrying several errors', async () => {
    const listener = listen();

    await runOperation({ result: { data: null, errors: [unauthenticated, forbidden, unauthenticated] } });

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['FORBIDDEN', { result: { data: null, errors: [forbidden] } }],
    ['another error code', { result: { data: null, errors: [{ message: 'Bad input', extensions: { code: 'BAD_USER_INPUT' } }] } }],
    ['a success', { result: { data: { probe: 'ok' } } }],
    ['a network error', { error: new Error('Failed to fetch') }],
  ] as const)('does not notify for %s', async (_name, outcome) => {
    const listener = listen();

    await runOperation(outcome);

    expect(listener).not.toHaveBeenCalled();
  });

  it('passes the result to the caller unchanged, with or without a listener', async () => {
    const result = { data: null, errors: [unauthenticated] };

    expect((await runOperation({ result })).results).toEqual([result]);
    listen();
    expect((await runOperation({ result })).results).toEqual([result]);
  });

  it('stops notifying after unsubscribe', async () => {
    const listener = vi.fn();
    const unsubscribe = onSessionInvalid(listener);

    unsubscribe();
    await runOperation({ result: { data: null, errors: [unauthenticated] } });

    expect(listener).not.toHaveBeenCalled();
  });

  it('puts the session link ahead of the transport in the shared client', () => {
    const client = readFileSync(resolve(import.meta.dirname, 'apollo-client.ts'), 'utf8');

    expect(client).toMatch(/link: ApolloLink\.from\(\[\s*sessionErrorLink,\s*new HttpLink\(/);
  });

  // Invariant 5: the signal only notifies. No routing or cache reset lives in
  // this package.
  it('keeps routing and store resets out of packages/client source', () => {
    const srcRoot = resolve(import.meta.dirname);
    const sources = readdirSync(srcRoot, { recursive: true, encoding: 'utf8' })
      .filter((path) => /\.tsx?$/.test(path) && !/\.test\.tsx?$/.test(path))
      .map((path) => readFileSync(join(srcRoot, path), 'utf8'));

    expect(sources.length).toBeGreaterThan(0);
    for (const source of sources) {
      expect(source).not.toMatch(/\/login|next\/|clearStore|resetStore/);
    }
  });
});
