import { describe, expect, it } from 'vitest';
import { graphQLErrorMessage } from './graphql-error-message';

describe('graphQLErrorMessage', () => {
  it("reads a service exception's message", () => {
    const error = {
      graphQLErrors: [
        {
          extensions: { originalError: { message: 'Cannot weigh a laundry order in status PRICED' } },
          message: 'Cannot weigh a laundry order in status PRICED',
        },
      ],
    };
    expect(graphQLErrorMessage(error)).toBe('Cannot weigh a laundry order in status PRICED');
  });

  it("reads the first constraint of a ValidationPipe failure, not Nest's generic message", () => {
    const error = {
      graphQLErrors: [
        {
          extensions: { originalError: { message: ['weightGrams must not be less than 1'] } },
          message: 'Bad Request Exception',
        },
      ],
    };
    expect(graphQLErrorMessage(error)).toBe('weightGrams must not be less than 1');
  });

  it('falls back to the GraphQL message without an original error', () => {
    expect(graphQLErrorMessage({ graphQLErrors: [{ message: 'Forbidden resource' }] })).toBe('Forbidden resource');
  });

  it.each([
    ['a network error', new Error('Failed to fetch')],
    ['an empty error list', { graphQLErrors: [] }],
    ['an empty message', { graphQLErrors: [{ message: '' }] }],
    ['a null first error', { graphQLErrors: [null] }],
    ['a string first error', { graphQLErrors: ['boom'] }],
    ['an extensions-less, message-less error', { graphQLErrors: [{}] }],
    ['null', null],
    ['a string', 'boom'],
  ])('has no server message for %s', (_label, error) => {
    expect(graphQLErrorMessage(error)).toBeUndefined();
  });
});
