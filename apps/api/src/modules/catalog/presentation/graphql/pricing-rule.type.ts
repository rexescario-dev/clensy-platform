import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

// Explicit, hand-defined presentation type — never `PricingRule` (the domain
// interface) or `PricingRuleEntity` (the TypeORM entity) returned directly as
// a GraphQL type (spec §4.5). Deliberately NO `active` field, unlike the
// domain interface: every `PricingRule` reachable through this GraphQL
// surface is by construction always the currently-active one for its
// `Service` (no price-history query exists on this schema — `activePricing`
// on `Service` and the standalone `activePricing(serviceId)` query are the
// only two ways to reach a `PricingRule` at all), so an always-`true` field
// would be dead information (spec §3). Do not add one "for parity" with the
// domain interface.
//
// `serviceId`/`addOnId` are both nullable — a forced consequence of
// `CreatePricingRuleInput` accepting `addOnId` (Laundry Architecture &
// Catalog Foundation spec §4.6 post-acceptance addendum), not an
// independent decision: exactly one is populated on any value this type
// represents, mirroring the domain object's own mutual-exclusivity
// invariant. No other new domain field (`unit`, `effectiveFrom`,
// `minimumChargeMinorUnits`) is exposed here — not required by any
// acceptance criterion, and adding them would be new scope, unlike this
// nullability change.
@ObjectType('PricingRule')
export class PricingRuleType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID, { nullable: true })
  serviceId!: string | null;

  @Field(() => ID, { nullable: true })
  addOnId!: string | null;

  @Field(() => Int)
  priceMinorUnits!: number;

  @Field()
  createdAt!: Date;
}
