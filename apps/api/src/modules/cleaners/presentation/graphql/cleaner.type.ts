import { Field, ID, ObjectType } from '@nestjs/graphql';
import { TeamType } from './team.type';

// Explicit, hand-defined presentation type — never `Cleaner` (the domain
// interface) or `CleanerEntity` (the TypeORM entity) returned directly as a
// GraphQL type (spec §4.5). Deliberately no `@Field()` for `teamId`: GraphQL
// schema/introspection exposure is controlled entirely by `@Field()`
// decorators, so `teamId` never appears in the public schema even though
// `toCleanerType()` (mappers.ts) still puts it on the runtime object for
// `team`'s `@ResolveField()` to read. `team` is presentation-layer-only
// computed data, populated exclusively by `CleanerResolver.team()`'s
// `@ResolveField(() => TeamType, { nullable: true })` method — the base
// `cleaner`/`cleaners`/`createCleaner`/`updateCleaner`/`assignCleanerToTeam`
// methods return an object typed `Omit<CleanerType, 'team'>` cast to
// `CleanerType`, since Apollo calls the field resolver for `team`
// independently of whatever the parent object carries for that key.
@ObjectType('Cleaner')
export class CleanerType {
  @Field(() => ID)
  id!: string;

  @Field()
  fullName!: string;

  @Field()
  phone!: string;

  @Field()
  email!: string;

  @Field(() => String, { nullable: true })
  notes!: string | null;

  @Field(() => TeamType, { nullable: true })
  team!: TeamType | null;

  @Field()
  createdAt!: Date;

  @Field()
  updatedAt!: Date;
}
