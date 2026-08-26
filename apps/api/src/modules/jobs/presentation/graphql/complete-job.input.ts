import { Field, ID, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType()
export class CompleteJobInput {
  @Field(() => ID)
  @IsString()
  id!: string;
}
