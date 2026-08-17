import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

// Explicit, hand-defined presentation type — never `AddOn` (the domain
// interface) or `AddOnEntity` (the TypeORM entity) returned directly as a
// GraphQL type (spec §4.5). `AddOn` is a fully independent domain object —
// global add-ons, not scoped to any `Service` — so unlike `ServiceType` there
// is no computed/`@ResolveField()` member here.
@ObjectType('AddOn')
export class AddOnType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  description!: string | null;

  @Field(() => Int)
  priceMinorUnits!: number;

  @Field()
  active!: boolean;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
