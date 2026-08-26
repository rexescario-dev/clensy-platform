import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('ChecklistItem')
export class ChecklistItemType {
  @Field(() => ID)
  id!: string;

  @Field()
  label!: string;

  @Field(() => Int)
  position!: number;

  @Field()
  completed!: boolean;

  @Field(() => Date, { nullable: true })
  completedAt!: Date | null;
}
