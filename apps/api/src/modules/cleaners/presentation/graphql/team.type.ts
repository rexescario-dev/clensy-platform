import { Field, ID, ObjectType } from '@nestjs/graphql';
import { CleanerType } from './cleaner.type';

// Explicit, hand-defined presentation type — never `Team` (the domain
// interface) or `TeamEntity` (the TypeORM entity) returned directly as a
// GraphQL type (spec §4.5). `cleaners` is presentation-layer-only computed
// data, populated exclusively by `TeamResolver.cleaners()`'s
// `@ResolveField(() => [CleanerType])` method; the base `team`/`teams`/
// `createTeam` methods return an object typed `Omit<TeamType, 'cleaners'>`
// cast to `TeamType`, since Apollo calls the field resolver for `cleaners`
// independently of whatever the parent object carries for that key.
@ObjectType('Team')
export class TeamType {
  @Field(() => ID)
  id!: string;

  @Field()
  name!: string;

  @Field(() => [CleanerType])
  cleaners!: CleanerType[];

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
