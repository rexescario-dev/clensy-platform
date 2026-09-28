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
//
// `tenantId` comes from the resolver (`@CurrentUser()`), never from ambient
// request state (#84 slice decision 7). `null` — no tenant scope — resolves
// every key to null without touching the service.
export function createActivePricingBatchFn(
  pricingRulesService: Pick<
    PricingRulesService,
    'getActivePricingForServiceIds'
  >,
  tenantId: string | null,
): DataLoader.BatchLoadFn<string, PricingRule | null> {
  return async (serviceIds) => {
    if (tenantId === null) {
      return serviceIds.map(() => null);
    }
    const rules = await pricingRulesService.getActivePricingForServiceIds(
      [...serviceIds],
      tenantId,
    );
    const byServiceId = new Map(rules.map((rule) => [rule.serviceId, rule]));
    return serviceIds.map((id) => byServiceId.get(id) ?? null);
  };
}

// Request-scoped (Scope.REQUEST): a fresh instance — and fresh DataLoader
// caches — per GraphQL request, so results never leak across requests. One
// DataLoader per tenant id, so a cached rule can only ever be served back to
// a caller of the tenant it was loaded for. Batches `Service.activePricing`
// resolution to avoid one query per parent row (spec §4.5).
@Injectable({ scope: Scope.REQUEST })
export class ActivePricingLoader {
  private readonly loaders = new Map<
    string | null,
    DataLoader<string, PricingRule | null>
  >();

  constructor(private readonly pricingRulesService: PricingRulesService) {}

  loaderFor(tenantId: string | null): DataLoader<string, PricingRule | null> {
    let loader = this.loaders.get(tenantId);
    if (!loader) {
      loader = new DataLoader(
        createActivePricingBatchFn(this.pricingRulesService, tenantId),
      );
      this.loaders.set(tenantId, loader);
    }
    return loader;
  }
}
