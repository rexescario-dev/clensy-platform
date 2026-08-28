import { FilterableField } from '@ptc-org/nestjs-query-graphql';
import { Field, ID, ObjectType } from '@nestjs/graphql';

// Explicit, hand-defined presentation type — never `Property` (the domain
// interface) or `PropertyEntity` (the TypeORM entity) returned directly as a
// GraphQL type (spec §4.5).
@ObjectType('Property')
export class PropertyType {
  @FilterableField(() => ID)
  id!: string;

  @Field(() => ID)
  customerId!: string;

  @Field()
  label!: string;

  @FilterableField()
  addressLine1!: string;

  @Field(() => String, { nullable: true })
  addressLine2!: string | null;

  @Field()
  city!: string;

  @Field()
  region!: string;

  @Field()
  postalCode!: string;

  @Field(() => String, { nullable: true })
  accessNotes!: string | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
