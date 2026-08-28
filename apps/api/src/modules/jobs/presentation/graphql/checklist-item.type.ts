import { FilterableField, IDField } from '@ptc-org/nestjs-query-graphql';
import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('ChecklistItem')
export class ChecklistItemType {
  @IDField(() => ID)
  id!: string;

  @Field()
  label!: string;

  @FilterableField(() => Int)
  position!: number;

  @Field()
  completed!: boolean;

  @Field(() => Date, { nullable: true })
  completedAt!: Date | null;
}
