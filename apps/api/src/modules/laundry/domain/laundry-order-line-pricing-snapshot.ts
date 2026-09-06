import { PricingUnit } from '../../catalog/domain/pricing-unit';

// A `LaundryOrderLine`-owned value object capturing the price resolved for
// that line at `priceLaundryOrder` time (spec §4.2, §4.5). Frozen once and
// never recomputed — the same discipline as `BookingPricingSnapshot`.
//
// Self-contained: `amountMinorUnits` and `minimumChargeApplied` are fully
// re-derivable from `rateMinorUnits`, `unit`, `quantity`, and
// `minimumChargeMinorUnits` with no read of `PricingRule`. `pricingRuleId`
// is a soft traceability pointer (no foreign key) — the snapshot, not the
// rule, is authoritative for what was charged.
//
// Plain TS, no framework dependency — the TypeORM embeddable that persists
// this shape lives in
// `infrastructure/persistence/laundry-order-line-pricing-snapshot.embeddable.ts`.
export interface LaundryOrderLinePricingSnapshot {
  // The resolved `PricingRule.priceMinorUnits`.
  rateMinorUnits: number;
  unit: PricingUnit;
  // Integer, in the unit's canonical representation: grams for `PER_KG`,
  // item count for `PER_ITEM`, `1` for `FLAT`/`PER_SERVICE`. The kilogram
  // conversion for `PER_KG` happens only inside the amount calculation and
  // is never stored here.
  quantity: number;
  // Integer minor units, computed once (spec §4.5).
  amountMinorUnits: number;
  // The rule's floor, copied verbatim at pricing time; `null` when the rule
  // carried none.
  minimumChargeMinorUnits: number | null;
  // `true` iff the minimum-charge floor determined `amountMinorUnits`.
  minimumChargeApplied: boolean;
  // The `PricingRule.id` that priced this line. No foreign key.
  pricingRuleId: string | null;
}
