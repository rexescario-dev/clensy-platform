import { describe, expect, it } from 'vitest';
import { canManageStaff, staffMutationErrorKey } from './staff-console';

const gqlError = (status?: number) => ({
  graphQLErrors: [{ message: 'ignored text', extensions: status === undefined ? {} : { status } }],
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
