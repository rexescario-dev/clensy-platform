import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { FilterableField, IDField } from '@ptc-org/nestjs-query-graphql';
import { PricingUnit } from '../../../catalog/domain/pricing-unit';

// One frozen invoice line (spec §4.2, §4.7). All fields read-only. `unit`
// reuses the shared `PricingUnit` TS enum; `registerEnumType(PricingUnit)`
// is already called by the catalog module.
@ObjectType('InvoiceLine')
export class InvoiceLineType {
  @IDField(() => ID)
  id!: string;

  @Field()
  description!: string;

  @Field(() => Int)
  quantity!: number;

  @Field(() => PricingUnit)
  unit!: PricingUnit;

  @Field(() => Int)
  rateMinorUnits!: number;

  @Field(() => Int)
  amountMinorUnits!: number;

  // `@FilterableField` so `createdAt` is a member of the generated
  // `InvoiceLineSortFields` enum the nested connection's default sort
  // references (the `LaundryOrderLineType` precedent).
  @FilterableField()
  createdAt!: Date;
}
