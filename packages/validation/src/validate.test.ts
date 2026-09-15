import { describe, expect, it } from 'vitest';
import { validate } from './validate';

describe('validate — result shape', () => {
  it('omits a valid field from the result map entirely (not present with [])', () => {
    const errors = validate({ email: 'a@b.com' }, { email: 'required|email' });
    expect(errors).toEqual({});
    expect('email' in errors).toBe(false);
  });

  it('collects a required failure as a single message', () => {
    const errors = validate({ email: '' }, { email: 'required|email' });
    expect(errors.email).toEqual(['The email field is required.']);
  });
});

describe('validate — empty-value short-circuit matrix', () => {
  const cases: Array<[string, unknown]> = [
    ['undefined', undefined],
    ['null', null],
    ["''", ''],
  ];

  for (const [label, value] of cases) {
    it(`${label}: required|string produces exactly one required message`, () => {
      const errors = validate({ field: value }, { field: 'required|string' });
      expect(errors.field).toEqual(['The field field is required.']);
    });

    it(`${label}: nullable|string is valid (no error)`, () => {
      const errors = validate({ field: value }, { field: 'nullable|string' });
      expect(errors).toEqual({});
    });

    it(`${label}: bare string is valid (no error) — identical to nullable|string`, () => {
      const nullableErrors = validate({ field: value }, { field: 'nullable|string' });
      const bareErrors = validate({ field: value }, { field: 'string' });
      expect(bareErrors).toEqual({});
      expect(bareErrors).toEqual(nullableErrors);
    });
  }

  it('an empty, non-required field never evaluates a second rule that would otherwise fail (e.g. email)', () => {
    const errors = validate({ notes: '' }, { notes: 'nullable|email' });
    expect(errors).toEqual({});
  });
});

describe('validate — cross-field rules', () => {
  it('same reads the sibling value from the same values object', () => {
    const errors = validate(
      { password: 'secret', confirmation: 'secret' },
      { confirmation: 'required|same:password' },
    );
    expect(errors).toEqual({});

    const mismatched = validate(
      { password: 'secret', confirmation: 'other' },
      { confirmation: 'required|same:password' },
    );
    expect(mismatched.confirmation).toEqual(['The confirmation and password must match.']);
  });
});

describe('validate — required_if worked example (spec §4.2)', () => {
  const rules = {
    status: 'required',
    reason: 'required_if:status,rejected|string',
  };

  it('condition false + empty reason -> valid', () => {
    const errors = validate({ status: 'approved', reason: '' }, rules);
    expect(errors).toEqual({});
  });

  it('condition true + empty reason -> exactly one required message', () => {
    const errors = validate({ status: 'rejected', reason: '' }, rules);
    expect(errors.reason).toEqual(['The reason field is required.']);
  });

  it('condition true + non-empty reason -> remaining rules run normally', () => {
    const errors = validate({ status: 'rejected', reason: 'customer cancelled' }, rules);
    expect(errors).toEqual({});
  });

  it('condition true + non-empty but invalid reason -> the remaining rule fails normally', () => {
    const errors = validate({ status: 'rejected', reason: 123 as unknown as string }, rules);
    expect(errors.reason).toEqual(['The reason must be a string.']);
  });
});
