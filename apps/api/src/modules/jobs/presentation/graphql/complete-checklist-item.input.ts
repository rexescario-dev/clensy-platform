import { Field, ID, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType()
export class CompleteChecklistItemInput {
  @Field(() => ID)
  @IsString()
  jobId!: string;

  @Field(() => ID)
  @IsString()
  itemId!: string;
}
