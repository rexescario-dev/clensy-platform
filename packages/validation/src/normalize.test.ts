import { describe, expect, it } from 'vitest';
import { normalizeApiValidationErrors } from './normalize';
import fixture from './__fixtures__/create-customer-validation-error.json';

const KNOWN_FIELDS = ['fullName', 'email', 'phone', 'notes'];

describe('normalizeApiValidationErrors', () => {
  it('maps the captured raw GraphQL response body (top-level `errors` array) onto FieldErrors', () => {
    const result = normalizeApiValidationErrors(fixture, KNOWN_FIELDS);
    expect(result).toEqual({ email: ['email must be an email'] });
  });

  it('maps an Apollo-Client-shaped thrown error (`graphQLErrors` array) the same way', () => {
    const apolloLikeError = { graphQLErrors: fixture.errors, message: 'GraphQL error' };
    const result = normalizeApiValidationErrors(apolloLikeError, KNOWN_FIELDS);
    expect(result).toEqual({ email: ['email must be an email'] });
  });

  it('returns undefined for an unrelated error (network failure)', () => {
    const result = normalizeApiValidationErrors(new Error('Network error'), KNOWN_FIELDS);
    expect(result).toBeUndefined();
  });

  it('returns undefined for a GraphQL error with no recognizable validation structure', () => {
    const unrelatedGraphQLError = {
      errors: [{ message: 'Forbidden resource', extensions: { code: 'FORBIDDEN' } }],
    };
    const result = normalizeApiValidationErrors(unrelatedGraphQLError, KNOWN_FIELDS);
    expect(result).toBeUndefined();
  });

  it('ignores a constraint message whose leading token is not a known field', () => {
    const unknownFieldError = {
      errors: [
        {
          message: 'Bad Request Exception',
          extensions: { originalError: { message: ['someUnknownField must be defined'] } },
        },
      ],
    };
    const result = normalizeApiValidationErrors(unknownFieldError, KNOWN_FIELDS);
    expect(result).toBeUndefined();
  });

  it('returns undefined for null/undefined input', () => {
    expect(normalizeApiValidationErrors(null, KNOWN_FIELDS)).toBeUndefined();
    expect(normalizeApiValidationErrors(undefined, KNOWN_FIELDS)).toBeUndefined();
  });
});
