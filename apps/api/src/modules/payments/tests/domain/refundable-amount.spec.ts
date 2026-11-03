import { refundableMinorUnits } from '../../domain/refundable-amount';

describe('refundableMinorUnits', () => {
  it('returns the full amount when nothing is refunded', () => {
    expect(refundableMinorUnits(600, [])).toBe(600);
  });

  it('returns the remainder after partial refunds', () => {
    expect(refundableMinorUnits(600, [100])).toBe(500);
  });

  it('returns zero when fully refunded', () => {
    expect(refundableMinorUnits(600, [100, 500])).toBe(0);
  });

  it('throws RangeError when refunds exceed the original', () => {
    expect(() => refundableMinorUnits(600, [700])).toThrow(RangeError);
  });
});
