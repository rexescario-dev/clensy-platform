import { describe, expect, it } from 'vitest';
import { canManageStaff, staffMutationErrorKey } from './staff-console';

// Mirrors what the API actually sends (@nestjs/apollo 13, probed against the
// running API): a status with a dedicated Apollo code (400 BAD_REQUEST, 403
// FORBIDDEN) carries it only at `extensions.originalError.statusCode`; any
// other status (404, 409, 500) also gets a top-level `extensions.status`.
const APOLLO_CODES: Partial<Record<number, string>> = { 400: 'BAD_REQUEST', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN' };

const gqlError = (status?: number) => ({
  graphQLErrors: [
    {
      message: 'ignored text',
      extensions:
        status === undefined
          ? {}
          : APOLLO_CODES[status]
            ? { code: APOLLO_CODES[status], originalError: { statusCode: status } }
            : { code: 'INTERNAL_SERVER_ERROR', originalError: { statusCode: status }, status },
    },
  ],
});

describe('canManageStaff', () => {
  it('requires both TENANT scope and TENANT_OWNER role', () => {
    expect(canManageStaff({ role: 'TENANT_OWNER', scope: 'TENANT' })).toBe(true);
    expect(canManageStaff({ role: 'TENANT_OWNER', scope: 'PLATFORM' })).toBe(false);
    expect(canManageStaff({ role: 'SUPER_ADMIN', scope: 'PLATFORM' })).toBe(false);
    expect(canManageStaff({ role: 'FINANCE', scope: 'TENANT' })).toBe(false);
    expect(canManageStaff(null)).toBe(false);
    expect(canManageStaff(undefined)).toBe(false);
  });
});

describe('staffMutationErrorKey', () => {
  it.each([
    ['create', 409, 'emailInUse'],
    ['create', 400, 'invalidInput'],
    ['create', 403, 'createForbidden'],
    ['create', 500, 'createFailed'],
    ['create', 404, 'createFailed'],
    ['disable', 409, 'lastTenantOwner'],
    ['disable', 404, 'accountNotFound'],
    ['disable', 403, 'disableForbidden'],
    ['disable', 400, 'disableFailed'],
    ['disable', 500, 'disableFailed'],
  ] as const)('%s + %i → %s', (operation, status, key) => {
    expect(staffMutationErrorKey(operation, gqlError(status))).toBe(key);
  });

  it('reads the status from originalError.statusCode when extensions.status is absent', () => {
    const forbidden = { graphQLErrors: [{ message: 'Forbidden', extensions: { code: 'FORBIDDEN', originalError: { statusCode: 403 } } }] };
    expect(staffMutationErrorKey('create', forbidden)).toBe('createForbidden');
    expect(staffMutationErrorKey('disable', forbidden)).toBe('disableForbidden');
  });

  it('never matches on the Apollo code alone', () => {
    const error = { graphQLErrors: [{ message: 'x', extensions: { code: 'BAD_REQUEST' } }] };
    expect(staffMutationErrorKey('create', error)).toBe('createFailed');
  });

  it('never matches on message text', () => {
    const error = { graphQLErrors: [{ message: 'Email is already in use', extensions: {} }] };
    expect(staffMutationErrorKey('create', error)).toBe('createFailed');
  });

  it.each([
    ['no status', gqlError()],
    ['empty graphQLErrors', { graphQLErrors: [] }],
    ['network error', { networkError: new Error('offline'), graphQLErrors: [] }],
    ['plain Error', new Error('boom')],
    ['string', 'boom'],
    ['null', null],
    ['undefined', undefined],
  ])('falls back to the generic key for %s', (_label, error) => {
    expect(staffMutationErrorKey('create', error)).toBe('createFailed');
    expect(staffMutationErrorKey('disable', error)).toBe('disableFailed');
  });
});
