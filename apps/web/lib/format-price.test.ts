import { describe, expect, it } from 'vitest';
import { formatMinorUnits } from './format-price';

describe('formatMinorUnits', () => {
  describe('positive formatting unchanged', () => {
    it('formats 0', () => {
      expect(formatMinorUnits(0)).toBe('₱0.00');
    });
    it('formats 150', () => {
      expect(formatMinorUnits(150)).toBe('₱1.50');
    });
    it('formats the maximum minor units', () => {
      expect(formatMinorUnits(2147483647)).toBe('₱21474836.47');
    });
  });

  describe('negative amounts', () => {
    it.each<[number, string]>([
      [-50, '−₱0.50'],
      [-150, '−₱1.50'],
      [-200, '−₱2.00'],
    ])('formats %i as %s with U+2212', (input, expected) => {
      expect(formatMinorUnits(input)).toBe(expected);
    });
  });
});
