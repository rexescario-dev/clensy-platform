import { Field, ID, ObjectType } from '@nestjs/graphql';
import { FilterableField, IDField } from '@ptc-org/nestjs-query-graphql';
import { LaundryOrderLinePricingSnapshotType } from './laundry-order-line-pricing-snapshot.type';

@ObjectType('LaundryOrderLine')
export class LaundryOrderLineType {
  @IDField(() => ID)
  id!: string;

  @Field(() => ID, { nullable: true })
  serviceId!: string | null;

  @Field(() => ID, { nullable: true })
  addOnId!: string | null;

  @Field(() => LaundryOrderLinePricingSnapshotType)
  pricingSnapshot!: LaundryOrderLinePricingSnapshotType;

  // `@FilterableField` (not plain `@Field`) so `createdAt` is a member of
  // the generated `LaundryOrderLineSortFields` enum the nested connection's
  // default sort references.
  @FilterableField()
  createdAt!: Date;
}
