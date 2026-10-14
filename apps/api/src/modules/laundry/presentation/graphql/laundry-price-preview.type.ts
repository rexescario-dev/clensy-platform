import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { PricingUnit } from '../../../catalog/domain/pricing-unit';

// One quoted line of the price preview (Amendment #164 §8.4.5). Same field
// names as `LaundryOrderLine` and its snapshot (M4 owner decision 1). `unit`
// reuses the `PricingUnit` enum the snapshot type uses; this does not expose
// `unit` on the catalog `PricingRule` type. Exactly one of `serviceId` /
// `addOnId` is set.
@ObjectType('LaundryPricePreviewLine')
export class LaundryPricePreviewLineType {
  @Field(() => ID, { nullable: true })
  serviceId!: string | null;

  @Field(() => ID, { nullable: true })
  addOnId!: string | null;

  // The current catalog name: nothing is frozen before pricing (§8.4.2).
  @Field()
  description!: string;

  @Field(() => PricingUnit)
  unit!: PricingUnit;

  @Field(() => Int)
  quantity!: number;

  @Field(() => Int)
  rateMinorUnits!: number;

  @Field(() => Int)
  amountMinorUnits!: number;

  @Field(() => Int, { nullable: true })
  minimumChargeMinorUnits!: number | null;

  @Field()
  minimumChargeApplied!: boolean;
}

// An estimate, not a price: the committed total is
// `LaundryOrder.totalMinorUnits` after `priceLaundryOrder` (§8.4.5).
@ObjectType('LaundryPricePreview')
export class LaundryPricePreviewType {
  @Field(() => Int)
  estimatedTotalMinorUnits!: number;

  @Field(() => [LaundryPricePreviewLineType])
  lines!: LaundryPricePreviewLineType[];
}
