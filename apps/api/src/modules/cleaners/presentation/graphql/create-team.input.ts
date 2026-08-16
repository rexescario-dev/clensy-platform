import { Field, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType()
export class CreateTeamInput {
  @Field()
  @IsString()
  name!: string;
}
