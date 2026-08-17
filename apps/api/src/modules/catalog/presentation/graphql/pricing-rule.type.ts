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
@ObjectType('PricingRule')
export class PricingRuleType {
  @Field(() => ID)
  id!: string;

  @Field(() => ID)
  serviceId!: string;

  @Field(() => Int)
  priceMinorUnits!: number;

  @Field()
  createdAt!: Date;
}
