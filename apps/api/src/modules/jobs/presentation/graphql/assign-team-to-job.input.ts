import { Field, ID, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

@InputType()
export class AssignTeamToJobInput {
  @Field(() => ID)
  @IsString()
  jobId!: string;

  @Field(() => ID)
  @IsString()
  teamId!: string;
}
