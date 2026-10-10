import { describe, expect, it } from 'vitest';
import { formatWeightGrams } from './format-weight-grams';

describe('formatWeightGrams', () => {
  it.each([
    [0, '0.00 kg'],
    [1, '0.001 kg'],
    [10, '0.01 kg'],
    [100, '0.10 kg'],
    [101, '0.101 kg'],
    [110, '0.11 kg'],
    [999, '0.999 kg'],
    [1000, '1.00 kg'],
    [1005, '1.005 kg'],
    [1250, '1.25 kg'],
    [2500, '2.50 kg'],
    [Number.MAX_SAFE_INTEGER, '9007199254740.991 kg'],
  ])('renders %i g as %s', (grams, expected) => {
    expect(formatWeightGrams(grams)).toBe(expected);
  });

  it.each([-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1])('rejects %s', (grams) => {
    expect(() => formatWeightGrams(grams)).toThrow(RangeError);
  });
});
