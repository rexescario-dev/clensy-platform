import { AddOn } from '../../domain/add-on';
import { PricingRule } from '../../domain/pricing-rule';
import { Service } from '../../domain/service';
import { AddOnType } from './add-on.type';
import { PricingRuleType } from './pricing-rule.type';
import { ServiceType } from './service.type';

// Never expose `Service`/`AddOn`/`PricingRule` (the domain interfaces) or
// their TypeORM entities as GraphQL values — every service result is mapped
// through one of these before leaving a resolver.

// Returns `Omit<ServiceType, 'activePricing'>` cast to `ServiceType` —
// `activePricing` is presentation-layer-only computed data, populated
// exclusively by `ServiceResolver.activePricing()`'s `@ResolveField`; Apollo
// calls that field resolver for the `activePricing` key independently of
// whatever this mapper's return value carries for it.
export function toServiceType(service: Service): ServiceType {
  return {
    id: service.id,
    active: service.active,
    // `activePricing: null` is a type-level placeholder only, satisfying
    // `ServiceType`'s required field — it is never read: Apollo always calls
    // `ServiceResolver.activePricing()`'s `@ResolveField()` for the
    // `activePricing` key independently of whatever this object carries for
    // it. Same pattern `toCleanerType()`'s `team: null` established.
    activePricing: null,
    createdAt: service.createdAt,
    description: service.description,
    durationMinutes: service.durationMinutes,
    name: service.name,
    updatedAt: service.updatedAt,
  };
}

export function toAddOnType(addOn: AddOn): AddOnType {
  return {
    id: addOn.id,
    active: addOn.active,
    createdAt: addOn.createdAt,
    description: addOn.description,
    name: addOn.name,
    priceMinorUnits: addOn.priceMinorUnits,
    updatedAt: addOn.updatedAt,
  };
}

// Deliberately omits `active`/`unit`/`effectiveFrom`/`minimumChargeMinorUnits`
// — `PricingRuleType` has no `@Field()` for any of them (see
// `pricing-rule.type.ts`), so they are dropped here rather than carried
// through as unused extra properties. `addOnId` is mapped alongside
// `serviceId` (both now nullable, spec §4.6 post-acceptance addendum) — a
// plain pass-through in both directions, no branching needed.
export function toPricingRuleType(rule: PricingRule): PricingRuleType {
  return {
    id: rule.id,
    addOnId: rule.addOnId,
    serviceId: rule.serviceId,
    createdAt: rule.createdAt,
    priceMinorUnits: rule.priceMinorUnits,
  };
}
