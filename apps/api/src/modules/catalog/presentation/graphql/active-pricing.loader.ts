import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { PricingRulesService } from '../../application/services/pricing-rules.service';
import { PricingRule } from '../../domain/pricing-rule';

// Extracted as a standalone function (from the outset — no later refactor
// needed, unlike the Cleaners plan's M8) so unit tests can call it directly
// instead of reaching into `DataLoader`'s private `_batchLoadFn` property.
// Batches via `PricingRulesService.getActivePricingForServiceIds`, which has
// no existence check and returns exactly the rows found — this function
// fills the gap with `null` for any `serviceId` with no active rule.
//
// This is a DIFFERENT code path from `PricingRuleResolver.activePricing`'s
// standalone query, which calls `PricingRulesService.getActivePricing`
// directly (existence-checked, single-key, not batched) — the two exist for
// two different reasons and are not meant to be unified (spec §3).
export function createActivePricingBatchFn(
  pricingRulesService: Pick<
    PricingRulesService,
    'getActivePricingForServiceIds'
  >,
): DataLoader.BatchLoadFn<string, PricingRule | null> {
  return async (serviceIds) => {
    const rules = await pricingRulesService.getActivePricingForServiceIds([
      ...serviceIds,
    ]);
    const byServiceId = new Map(rules.map((rule) => [rule.serviceId, rule]));
    return serviceIds.map((id) => byServiceId.get(id) ?? null);
  };
}

// Request-scoped (Scope.REQUEST): a fresh instance — and fresh DataLoader
// cache — per GraphQL request, so results never leak across requests.
// Batches `Service.activePricing` resolution to avoid one query per parent
// row (spec §4.5).
@Injectable({ scope: Scope.REQUEST })
export class ActivePricingLoader {
  readonly loader: DataLoader<string, PricingRule | null>;

  constructor(private readonly pricingRulesService: PricingRulesService) {
    this.loader = new DataLoader<string, PricingRule | null>(
      createActivePricingBatchFn(this.pricingRulesService),
    );
  }
}
