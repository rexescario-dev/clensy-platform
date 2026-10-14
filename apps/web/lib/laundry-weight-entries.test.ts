import { formatWeightGrams } from '@clensy/web';
import { describe, expect, it } from 'vitest';
import {
  MAX_WEIGHT_GRAMS,
  kilogramsInputFromGrams,
  parseWeightEntry,
  summarizeWeightEntries,
} from './laundry-weight-entries';

// #155 §Calculation: kilogram strings become whole grams by splitting on
// the decimal point, never by multiplying a float.
describe('parseWeightEntry', () => {
  it.each([
    ['1.25', 1250],
    ['0.80', 800],
    ['0.45', 450],
    ['0.001', 1],
    // 1.005 * 1000 is 1004.9999999999999 in binary floating point.
    ['1.005', 1005],
    ['2', 2000],
    ['1.', 1000],
    ['.5', 500],
    ['007.5', 7500],
    ['2147483.647', MAX_WEIGHT_GRAMS],
  ])('%j → %i g', (text, grams) => {
    expect(parseWeightEntry(text)).toEqual({ grams, ok: true });
  });

  it.each(['', '   '])('%j is blank', (text) => {
    expect(parseWeightEntry(text)).toEqual({ error: 'blank', ok: false });
  });

  it.each(['abc', '1.2.3', '1.2345', '+1', '1e3', '1,5', ' 1.25', '1.25 ', '.', '-', '-abc', '-1.2345', '--1', '1-', '0x10', '1_000'])(
    '%j is not a decimal kilogram',
    (text) => {
      expect(parseWeightEntry(text)).toEqual({ error: 'format', ok: false });
    },
  );

  // A negative is `notPositive` even when it is also too large.
  it.each(['0', '0.000', '00', '-1', '-0.5', '-0', '-99999999'])('%j is not greater than zero', (text) => {
    expect(parseWeightEntry(text)).toEqual({ error: 'notPositive', ok: false });
  });

  // GraphQL Int is signed 32-bit; a longer digit string must not reach the
  // formatter (which throws past MAX_SAFE_INTEGER) or the mutation.
  it.each(['2147483.648', '99999999', '12345678.5', '99999999999999999999'])('%j is too large', (text) => {
    expect(parseWeightEntry(text)).toEqual({ error: 'tooLarge', ok: false });
  });
});

describe('summarizeWeightEntries', () => {
  it('sums three valid rows to whole grams and allows submit', () => {
    const summary = summarizeWeightEntries(['1.25', '0.80', '0.45']);
    expect(summary.totalGrams).toBe(2500);
    expect(formatWeightGrams(summary.totalGrams)).toBe('2.50 kg');
    expect(summary.submittable).toBe(true);
    expect(summary.formError).toBeNull();
  });

  it('totals the valid rows but blocks submit while any row is invalid', () => {
    const summary = summarizeWeightEntries(['1.25', 'abc', '']);
    expect(summary.totalGrams).toBe(1250);
    expect(summary.submittable).toBe(false);
    expect(summary.formError).toBeNull();
    expect(summary.results.map((result) => result.ok)).toEqual([true, false, false]);
  });

  it('asks for at least one weight when there are no rows', () => {
    expect(summarizeWeightEntries([])).toEqual({ formError: 'noEntries', results: [], submittable: false, totalGrams: 0 });
  });

  it('blocks a combined total above the GraphQL Int maximum', () => {
    const summary = summarizeWeightEntries(['2000000', '2000000']);
    expect(summary.totalGrams).toBe(4_000_000_000);
    expect(summary.formError).toBe('totalTooLarge');
    expect(summary.submittable).toBe(false);
  });

  it('allows a total of exactly the maximum', () => {
    const summary = summarizeWeightEntries(['2147483', '0.647']);
    expect(summary.totalGrams).toBe(MAX_WEIGHT_GRAMS);
    expect(summary.submittable).toBe(true);
  });
});

describe('kilogramsInputFromGrams', () => {
  it.each([
    [2500, '2.50'],
    [1250, '1.25'],
    [1005, '1.005'],
    [1000, '1.00'],
    [1200, '1.20'],
    [1, '0.001'],
    [0, '0.00'],
  ])('%i g → %j', (grams, text) => {
    expect(kilogramsInputFromGrams(grams)).toBe(text);
  });

  it.each([1, 450, 1005, 2500, 123456, MAX_WEIGHT_GRAMS])('round-trips %i g through parseWeightEntry', (grams) => {
    expect(parseWeightEntry(kilogramsInputFromGrams(grams))).toEqual({ grams, ok: true });
  });
});
