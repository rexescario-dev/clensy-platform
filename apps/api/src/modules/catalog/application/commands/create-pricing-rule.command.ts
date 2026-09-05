import { PricingUnit } from '../../domain/pricing-unit';

// Exactly one of `serviceId`/`addOnId` must be provided — enforced in
// `PricingRulesService#createPricingRule`, not by this interface's shape
// (spec §4.7). `effectiveTo` is deliberately absent — it is never a creation
// input (spec §4.2, §4.4, §4.6).
export interface CreatePricingRuleCommand {
  actorId: string;
  serviceId?: string;
  addOnId?: string;
  priceMinorUnits: number;
  unit?: PricingUnit;
  effectiveFrom?: Date;
  minimumChargeMinorUnits?: number;
}
