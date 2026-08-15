import { Field, InputType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { Role } from '../../../../platform/auth/domain/role';

@InputType()
export class CreateAdminInput {
  @Field()
  @IsEmail()
  email!: string;

  @Field()
  @IsString()
  @MinLength(1)
  password!: string;

  @Field(() => Role)
  @IsNotEmpty()
  role!: Role;
}
