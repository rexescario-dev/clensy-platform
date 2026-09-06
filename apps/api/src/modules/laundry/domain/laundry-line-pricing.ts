import { PricingUnit } from '../../catalog/domain/pricing-unit';

// Integer-safe half-up division for non-negative integer inputs. Half-up
// means the fractional part `>= 0.5` rounds away from zero. Named and
// tested on its own so the monetary rounding rule (spec §4.5) is explicit
// and cannot be silently changed by a `Math.round` "simplification".
export function divideRoundHalfUp(
  numerator: number,
  denominator: number,
): number {
  if (
    !Number.isInteger(numerator) ||
    !Number.isInteger(denominator) ||
    numerator < 0 ||
    denominator <= 0
  ) {
    throw new Error(
      `divideRoundHalfUp expects non-negative integer numerator and positive integer denominator, got ${numerator} / ${denominator}`,
    );
  }
  return Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}

export interface LaundryLinePricingInput {
  unit: PricingUnit;
  rateMinorUnits: number;
  // Integer, in the unit's canonical representation: grams for `PER_KG`,
  // item count for `PER_ITEM`, `1` for `FLAT`/`PER_SERVICE`.
  quantity: number;
  minimumChargeMinorUnits: number | null;
}

export interface LaundryLinePricingResult {
  amountMinorUnits: number;
  minimumChargeApplied: boolean;
}

// Spec §4.5: `raw` is `grams * rate / 1000` (half-up) for `PER_KG`,
// `quantity * rate` for `PER_ITEM`, and the flat `rate` for
// `FLAT`/`PER_SERVICE`. The minimum-charge floor is applied AFTER rounding;
// `minimumChargeApplied` is `true` exactly when the floor beat `raw`.
export function computeLaundryLineAmount(
  input: LaundryLinePricingInput,
): LaundryLinePricingResult {
  const { unit, rateMinorUnits, quantity, minimumChargeMinorUnits } = input;

  let raw: number;
  switch (unit) {
    case PricingUnit.PER_KG:
      raw = divideRoundHalfUp(quantity * rateMinorUnits, 1000);
      break;
    case PricingUnit.PER_ITEM:
      raw = quantity * rateMinorUnits;
      break;
    case PricingUnit.FLAT:
    case PricingUnit.PER_SERVICE:
      raw = rateMinorUnits;
      break;
  }

  const floor = minimumChargeMinorUnits ?? 0;
  return {
    amountMinorUnits: Math.max(raw, floor),
    minimumChargeApplied: raw < floor,
  };
}
