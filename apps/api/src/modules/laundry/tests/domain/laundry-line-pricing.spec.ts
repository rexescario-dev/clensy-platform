import { PricingUnit } from '../../../catalog/domain/pricing-unit';
import {
  computeLaundryLineAmount,
  divideRoundHalfUp,
} from '../../domain/laundry-line-pricing';

describe('divideRoundHalfUp', () => {
  it('rounds a fraction just below half down', () => {
    expect(divideRoundHalfUp(1499, 1000)).toBe(1);
  });

  it('rounds an exact half up', () => {
    expect(divideRoundHalfUp(1500, 1000)).toBe(2);
  });

  it('rounds a fraction just above half up', () => {
    expect(divideRoundHalfUp(1501, 1000)).toBe(2);
  });

  it('returns an exact quotient unchanged', () => {
    expect(divideRoundHalfUp(35250000, 1000)).toBe(35250);
  });

  it('handles a zero numerator', () => {
    expect(divideRoundHalfUp(0, 1000)).toBe(0);
  });
});

describe('computeLaundryLineAmount', () => {
  describe('PER_KG', () => {
    it('is grams * rate / 1000 (exact case)', () => {
      expect(
        computeLaundryLineAmount({
          minimumChargeMinorUnits: null,
          quantity: 2350,
          rateMinorUnits: 15000,
          unit: PricingUnit.PER_KG,
        }),
      ).toEqual({ amountMinorUnits: 35250, minimumChargeApplied: false });
    });

    it('rounds half up', () => {
      // 3 g * 500 = 1500 ; /1000 = 1.5 -> 2
      expect(
        computeLaundryLineAmount({
          minimumChargeMinorUnits: null,
          quantity: 3,
          rateMinorUnits: 500,
          unit: PricingUnit.PER_KG,
        }),
      ).toEqual({ amountMinorUnits: 2, minimumChargeApplied: false });
    });

    it('applies the minimum-charge floor after rounding', () => {
      // 100 g * 1000 = 100000 ; /1000 = 100 ; floor 500 wins
      expect(
        computeLaundryLineAmount({
          minimumChargeMinorUnits: 500,
          quantity: 100,
          rateMinorUnits: 1000,
          unit: PricingUnit.PER_KG,
        }),
      ).toEqual({ amountMinorUnits: 500, minimumChargeApplied: true });
    });

    it('a 0-gram order is floored to the minimum charge', () => {
      expect(
        computeLaundryLineAmount({
          minimumChargeMinorUnits: 300,
          quantity: 0,
          rateMinorUnits: 1000,
          unit: PricingUnit.PER_KG,
        }),
      ).toEqual({ amountMinorUnits: 300, minimumChargeApplied: true });
    });

    it('a 0-gram order with no floor is 0', () => {
      expect(
        computeLaundryLineAmount({
          minimumChargeMinorUnits: null,
          quantity: 0,
          rateMinorUnits: 1000,
          unit: PricingUnit.PER_KG,
        }),
      ).toEqual({ amountMinorUnits: 0, minimumChargeApplied: false });
    });

    it('does not apply the floor when the computed amount already meets it', () => {
      // 2000 g * 1000 / 1000 = 2000 ; floor 2000 -> equal, not "applied"
      expect(
        computeLaundryLineAmount({
          minimumChargeMinorUnits: 2000,
          quantity: 2000,
          rateMinorUnits: 1000,
          unit: PricingUnit.PER_KG,
        }),
      ).toEqual({ amountMinorUnits: 2000, minimumChargeApplied: false });
    });
  });

  describe('PER_ITEM', () => {
    it('is quantity * rate, no rounding', () => {
      expect(
        computeLaundryLineAmount({
          minimumChargeMinorUnits: null,
          quantity: 3,
          rateMinorUnits: 800,
          unit: PricingUnit.PER_ITEM,
        }),
      ).toEqual({ amountMinorUnits: 2400, minimumChargeApplied: false });
    });

    it('applies the floor when quantity * rate is below it', () => {
      expect(
        computeLaundryLineAmount({
          minimumChargeMinorUnits: 500,
          quantity: 1,
          rateMinorUnits: 100,
          unit: PricingUnit.PER_ITEM,
        }),
      ).toEqual({ amountMinorUnits: 500, minimumChargeApplied: true });
    });
  });

  describe('FLAT and PER_SERVICE', () => {
    it('FLAT is the flat rate', () => {
      expect(
        computeLaundryLineAmount({
          minimumChargeMinorUnits: null,
          quantity: 1,
          rateMinorUnits: 4200,
          unit: PricingUnit.FLAT,
        }),
      ).toEqual({ amountMinorUnits: 4200, minimumChargeApplied: false });
    });

    it('PER_SERVICE is the flat rate', () => {
      expect(
        computeLaundryLineAmount({
          minimumChargeMinorUnits: null,
          quantity: 1,
          rateMinorUnits: 999,
          unit: PricingUnit.PER_SERVICE,
        }),
      ).toEqual({ amountMinorUnits: 999, minimumChargeApplied: false });
    });

    it('FLAT still honours a higher floor', () => {
      expect(
        computeLaundryLineAmount({
          minimumChargeMinorUnits: 250,
          quantity: 1,
          rateMinorUnits: 100,
          unit: PricingUnit.FLAT,
        }),
      ).toEqual({ amountMinorUnits: 250, minimumChargeApplied: true });
    });
  });

  it('treats a null minimumChargeMinorUnits as a floor of 0 that never applies', () => {
    expect(
      computeLaundryLineAmount({
        minimumChargeMinorUnits: null,
        quantity: 1,
        rateMinorUnits: 1,
        unit: PricingUnit.PER_ITEM,
      }),
    ).toEqual({ amountMinorUnits: 1, minimumChargeApplied: false });
  });
});
