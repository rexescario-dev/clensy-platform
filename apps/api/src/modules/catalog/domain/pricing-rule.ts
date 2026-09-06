import { PricingUnit } from './pricing-unit';

// Plain domain interface for a `PricingRule` — the append-only price history
// for a `Service` or an `AddOn` (Laundry Architecture & Catalog Foundation
// spec §4.2). Deliberately has NO `updatedAt` field: a `PricingRule` row is
// never mutated in place after creation — a repricing deactivates the old
// row (`active: false`) and inserts a brand-new one
// (`PricingRulesService#createPricingRule`), so there is nothing for an
// `updatedAt` column to ever record. Do not add one "for consistency" with
// `Service`/`AddOn` — those two are genuinely mutable; `PricingRule` is not.
//
// `serviceId`/`addOnId` are mutually exclusive: exactly one is non-null on
// any row (DB `CHECK (num_nonnulls("serviceId", "addOnId") = 1)`, spec §4.7).
// `effectiveTo` is never a creation input — every newly inserted row has
// `effectiveTo: null`; it is only ever set as the side effect of a later
// `createPricingRule` call closing it when it inserts the next row in the
// chain (spec §4.2, §4.4). `active`/`getActivePricing` remain the legacy,
// `Service`-only pricing mechanism, untouched by any of the fields below —
// see `pricing-rules.service.ts`'s `resolveEffectivePricing` for the new,
// separate effective-dated mechanism these fields exist for.
export interface PricingRule {
  id: string;
  serviceId: string | null;
  addOnId: string | null;
  priceMinorUnits: number;
  unit: PricingUnit;
  effectiveFrom: Date;
  effectiveTo: Date | null;
  minimumChargeMinorUnits: number | null;
  active: boolean;
  createdAt: Date;
}
