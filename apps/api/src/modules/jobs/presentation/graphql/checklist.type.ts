import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ChecklistItemType } from './checklist-item.type';

@ObjectType('Checklist')
export class ChecklistType {
  @Field(() => ID)
  id!: string;

  @Field(() => [ChecklistItemType])
  items!: ChecklistItemType[];
}
