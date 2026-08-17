// Plain domain interface for a `PricingRule` — the append-only price history
// for a `Service` (spec §4.1). Deliberately has NO `updatedAt` field: a
// `PricingRule` row is never mutated in place after creation — a repricing
// deactivates the old row (`active: false`) and inserts a brand-new one
// (`PricingRulesService#createPricingRule`), so there is nothing for an
// `updatedAt` column to ever record. Do not add one "for consistency" with
// `Service`/`AddOn` — those two are genuinely mutable; `PricingRule` is not.
export interface PricingRule {
  id: string;
  serviceId: string;
  priceMinorUnits: number;
  active: boolean;
  createdAt: Date;
}
