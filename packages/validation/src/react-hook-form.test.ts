import { describe, expect, it } from 'vitest';
import { clensyResolver } from './react-hook-form';

interface TestFormValues extends Record<string, unknown> {
  email: string;
  notes?: string;
}

const rules = { email: 'required|email' };

describe('clensyResolver', () => {
  it('returns RHF success shape for a passing validate() result', async () => {
    const resolver = clensyResolver<TestFormValues>(rules);
    const values: TestFormValues = { email: 'a@b.com' };
    const result = await resolver(values, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });
    expect(result).toEqual({ values, errors: {} });
  });

  it('returns RHF FieldErrors shape for a failing validate() result', async () => {
    const resolver = clensyResolver<TestFormValues>(rules);
    const result = await resolver({ email: '' }, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });
    expect(result.values).toEqual({});
    expect(result.errors.email).toMatchObject({
      type: 'validation',
      message: 'The email field is required.',
    });
  });

  it('uses the first message of a multi-message field as .message', async () => {
    // 'nope' is non-empty (so `email`/`min` both actually run) and fails
    // both rules, in declared order: `email` first, then `min:20`.
    const multiRules = { email: 'email|min:20' };
    const resolver = clensyResolver<TestFormValues>(multiRules);
    const result = await resolver({ email: 'nope' }, undefined, {
      fields: {},
      shouldUseNativeValidation: false,
    });
    expect(result.errors.email?.message).toBe('The email must be a valid email address.');
  });
});
