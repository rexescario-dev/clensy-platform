import type { ClensyMessages, DeepPartial } from '@clensy/web';
import { describe, expect, it } from 'vitest';
import { APP_I18N_OVERRIDES } from './clensy-i18n-overrides';

// Unmocked on purpose: vi.mock is file-scoped, so the behavioural test's
// test-only override can never reach this file (spec §4.1, §6.2).
describe('APP_I18N_OVERRIDES', () => {
  it('is committed as {} — the application has no override values', () => {
    expect(APP_I18N_OVERRIDES).toEqual({});
  });
});

// Spec §6.3: the annotation on APP_I18N_OVERRIDES is the primary type
// contract. These supplemental cases confirm the same exported types reject
// representative invalid shapes. They are checked by `tsc` (CI "Type-check
// apps/web"), not by Vitest — an unused @ts-expect-error is itself an error.
// @ts-expect-error unknown namespace
export const unknownNamespace: DeepPartial<ClensyMessages> = { notANamespace: {} };
// @ts-expect-error unknown key path inside a known namespace
export const unknownKey: DeepPartial<ClensyMessages> = { roles: { NOT_A_ROLE: 'x' } };
// @ts-expect-error wrong leaf value type
export const wrongValueType: DeepPartial<ClensyMessages> = { roles: { FINANCE: 42 } };
