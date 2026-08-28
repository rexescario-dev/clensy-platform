import { FilterableField } from '@ptc-org/nestjs-query-graphql';
import { Field, ID, ObjectType } from '@nestjs/graphql';
import { PropertyType } from './property.type';

// Explicit, hand-defined presentation type — never `Customer` (the domain
// interface) or `CustomerEntity` (the TypeORM entity) returned directly as a
// GraphQL type (spec §4.5). `properties` is presentation-layer-only computed
// data (spec §4.5): it is populated exclusively by `CustomerResolver`'s
// `@ResolveField(() => [PropertyType], 'properties')` method, never by the
// base `customer`/`customers`/`createCustomer`/`updateCustomer` methods —
// those return an object typed `Omit<CustomerType, 'properties'>` cast to
// `CustomerType`, since Apollo calls the field resolver for `properties`
// independently of whatever the parent object carries for that key.
@ObjectType('Customer')
export class CustomerType {
  @FilterableField(() => ID)
  id!: string;

  @FilterableField()
  fullName!: string;

  @Field()
  email!: string;

  @Field()
  phone!: string;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field(() => [PropertyType])
  properties!: PropertyType[];

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
