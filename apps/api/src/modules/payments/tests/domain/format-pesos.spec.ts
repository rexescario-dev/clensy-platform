import { formatPesos } from '../../domain/format-pesos';

describe('formatPesos', () => {
  it.each([
    [0, '₱0.00'],
    [1, '₱0.01'],
    [99, '₱0.99'],
    [100, '₱1.00'],
    [5000, '₱50.00'],
    [30005, '₱300.05'],
    [2147483647, '₱21474836.47'],
  ])('formats %p as %s', (minorUnits, expected) => {
    expect(formatPesos(minorUnits)).toBe(expected);
  });
});
