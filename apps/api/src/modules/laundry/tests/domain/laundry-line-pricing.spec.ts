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
          unit: PricingUnit.PER_KG,
          rateMinorUnits: 15000,
          quantity: 2350,
          minimumChargeMinorUnits: null,
        }),
      ).toEqual({ amountMinorUnits: 35250, minimumChargeApplied: false });
    });

    it('rounds half up', () => {
      // 3 g * 500 = 1500 ; /1000 = 1.5 -> 2
      expect(
        computeLaundryLineAmount({
          unit: PricingUnit.PER_KG,
          rateMinorUnits: 500,
          quantity: 3,
          minimumChargeMinorUnits: null,
        }),
      ).toEqual({ amountMinorUnits: 2, minimumChargeApplied: false });
    });

    it('applies the minimum-charge floor after rounding', () => {
      // 100 g * 1000 = 100000 ; /1000 = 100 ; floor 500 wins
      expect(
        computeLaundryLineAmount({
          unit: PricingUnit.PER_KG,
          rateMinorUnits: 1000,
          quantity: 100,
          minimumChargeMinorUnits: 500,
        }),
      ).toEqual({ amountMinorUnits: 500, minimumChargeApplied: true });
    });

    it('a 0-gram order is floored to the minimum charge', () => {
      expect(
        computeLaundryLineAmount({
          unit: PricingUnit.PER_KG,
          rateMinorUnits: 1000,
          quantity: 0,
          minimumChargeMinorUnits: 300,
        }),
      ).toEqual({ amountMinorUnits: 300, minimumChargeApplied: true });
    });

    it('a 0-gram order with no floor is 0', () => {
      expect(
        computeLaundryLineAmount({
          unit: PricingUnit.PER_KG,
          rateMinorUnits: 1000,
          quantity: 0,
          minimumChargeMinorUnits: null,
        }),
      ).toEqual({ amountMinorUnits: 0, minimumChargeApplied: false });
    });

    it('does not apply the floor when the computed amount already meets it', () => {
      // 2000 g * 1000 / 1000 = 2000 ; floor 2000 -> equal, not "applied"
      expect(
        computeLaundryLineAmount({
          unit: PricingUnit.PER_KG,
          rateMinorUnits: 1000,
          quantity: 2000,
          minimumChargeMinorUnits: 2000,
        }),
      ).toEqual({ amountMinorUnits: 2000, minimumChargeApplied: false });
    });
  });

  describe('PER_ITEM', () => {
    it('is quantity * rate, no rounding', () => {
      expect(
        computeLaundryLineAmount({
          unit: PricingUnit.PER_ITEM,
          rateMinorUnits: 800,
          quantity: 3,
          minimumChargeMinorUnits: null,
        }),
      ).toEqual({ amountMinorUnits: 2400, minimumChargeApplied: false });
    });

    it('applies the floor when quantity * rate is below it', () => {
      expect(
        computeLaundryLineAmount({
          unit: PricingUnit.PER_ITEM,
          rateMinorUnits: 100,
          quantity: 1,
          minimumChargeMinorUnits: 500,
        }),
      ).toEqual({ amountMinorUnits: 500, minimumChargeApplied: true });
    });
  });

  describe('FLAT and PER_SERVICE', () => {
    it('FLAT is the flat rate', () => {
      expect(
        computeLaundryLineAmount({
          unit: PricingUnit.FLAT,
          rateMinorUnits: 4200,
          quantity: 1,
          minimumChargeMinorUnits: null,
        }),
      ).toEqual({ amountMinorUnits: 4200, minimumChargeApplied: false });
    });

    it('PER_SERVICE is the flat rate', () => {
      expect(
        computeLaundryLineAmount({
          unit: PricingUnit.PER_SERVICE,
          rateMinorUnits: 999,
          quantity: 1,
          minimumChargeMinorUnits: null,
        }),
      ).toEqual({ amountMinorUnits: 999, minimumChargeApplied: false });
    });

    it('FLAT still honours a higher floor', () => {
      expect(
        computeLaundryLineAmount({
          unit: PricingUnit.FLAT,
          rateMinorUnits: 100,
          quantity: 1,
          minimumChargeMinorUnits: 250,
        }),
      ).toEqual({ amountMinorUnits: 250, minimumChargeApplied: true });
    });
  });

  it('treats a null minimumChargeMinorUnits as a floor of 0 that never applies', () => {
    expect(
      computeLaundryLineAmount({
        unit: PricingUnit.PER_ITEM,
        rateMinorUnits: 1,
        quantity: 1,
        minimumChargeMinorUnits: null,
      }),
    ).toEqual({ amountMinorUnits: 1, minimumChargeApplied: false });
  });
});
