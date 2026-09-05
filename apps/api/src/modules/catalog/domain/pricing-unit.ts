// The pricing basis a `PricingRule` expresses (spec §4.2/§3 of the plan).
// `PER_SERVICE` is the flat-per-booking basis every pre-existing `PricingRule`
// row implicitly used before this enum existed — the migration backfills it
// to every legacy row (see the ExtendPricingRuleEffectiveDating migration).
export enum PricingUnit {
  PER_KG = 'PER_KG',
  PER_ITEM = 'PER_ITEM',
  FLAT = 'FLAT',
  PER_SERVICE = 'PER_SERVICE',
}
