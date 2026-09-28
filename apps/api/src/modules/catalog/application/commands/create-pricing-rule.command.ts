import { PricingUnit } from '../../domain/pricing-unit';

// Exactly one of `serviceId`/`addOnId` must be provided — enforced in
// `PricingRulesService#createPricingRule`, not by this interface's shape
// (spec §4.7). `effectiveTo` is deliberately absent — it is never a creation
// input (spec §4.2, §4.4, §4.6).
export interface CreatePricingRuleCommand {
  actorId: string;
  // Server-derived from the principal via `requireTenantId`, never client
  // input (RFC §4.5, invariant 1) — a `null` cannot type-check into this
  // field, so a caller with no tenant is rejected before this command is
  // even constructed (#84 slice decision 4).
  tenantId: string;
  serviceId?: string;
  addOnId?: string;
  priceMinorUnits: number;
  unit?: PricingUnit;
  effectiveFrom?: Date;
  minimumChargeMinorUnits?: number;
}
