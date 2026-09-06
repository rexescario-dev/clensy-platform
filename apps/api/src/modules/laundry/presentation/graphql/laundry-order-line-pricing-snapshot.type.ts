import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { PricingUnit } from '../../../catalog/domain/pricing-unit';

// A direct (non-computed) nested field of `LaundryOrderLineType` — frozen at
// `priceLaundryOrder` time, never re-resolved (spec §4.2, §4.7). `PricingUnit`
// is registered as a GraphQL enum by `modules/catalog`'s
// `create-pricing-rule.input.ts`; this module does not re-register it.
@ObjectType('LaundryOrderLinePricingSnapshot')
export class LaundryOrderLinePricingSnapshotType {
  @Field(() => Int)
  rateMinorUnits!: number;

  @Field(() => PricingUnit)
  unit!: PricingUnit;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Int)
  amountMinorUnits!: number;

  @Field(() => Int, { nullable: true })
  minimumChargeMinorUnits!: number | null;

  @Field()
  minimumChargeApplied!: boolean;

  @Field(() => ID, { nullable: true })
  pricingRuleId!: string | null;
}
