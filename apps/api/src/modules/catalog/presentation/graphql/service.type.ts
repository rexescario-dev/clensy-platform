import { FilterableField } from '@ptc-org/nestjs-query-graphql';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { PricingRuleType } from './pricing-rule.type';

// Explicit, hand-defined presentation type — never `Service` (the domain
// interface) or `ServiceEntity` (the TypeORM entity) returned directly as a
// GraphQL type (spec §4.5). `activePricing` is presentation-layer-only
// computed data, populated exclusively by `ServiceResolver.activePricing()`'s
// `@ResolveField(() => PricingRuleType, { nullable: true })` method, which
// batches via `ActivePricingLoader` — the base `service`/`services`/
// `createService`/`updateService` methods return an object typed
// `Omit<ServiceType, 'activePricing'>` cast to `ServiceType`, since Apollo
// calls the field resolver for `activePricing` independently of whatever the
// parent object carries for that key.
@ObjectType('Service')
export class ServiceType {
  @FilterableField(() => ID)
  id!: string;

  @FilterableField()
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => Int)
  durationMinutes!: number;

  @Field()
  active!: boolean;

  @Field(() => PricingRuleType, { nullable: true })
  activePricing!: PricingRuleType | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
