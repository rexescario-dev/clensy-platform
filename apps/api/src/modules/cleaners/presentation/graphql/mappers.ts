import { Cleaner } from '../../domain/cleaner';
import { Team } from '../../domain/team';
import { CleanerType } from './cleaner.type';
import { TeamType } from './team.type';

// Never expose `Cleaner`/`Team` (the domain interfaces) or their TypeORM
// entities as GraphQL values — every service result is mapped through one
// of these before leaving a resolver.

// Returns `Omit<CleanerType, 'team'>` cast to `CleanerType` — `team` is
// presentation-layer-only computed data, populated exclusively by
// `CleanerResolver.team()`'s `@ResolveField`; Apollo calls that field
// resolver for the `team` key independently of whatever this mapper's
// return value carries for it.
//
// `teamId` IS included on the returned object even though `CleanerType` has
// no `@Field()` for it: GraphQL field exposure is controlled entirely by
// `@Field()` decorators, not by which properties exist on the runtime
// object, so a property with no matching `@Field()` is invisible to the
// schema but remains an ordinary readable property on the plain JS object.
// This is what lets `CleanerResolver.team()`'s `@ResolveField()` read
// `cleaner.teamId` at runtime despite `teamId` never appearing in the
// public schema.
export function toCleanerType(cleaner: Cleaner): CleanerType {
  return {
    id: cleaner.id,
    fullName: cleaner.fullName,
    phone: cleaner.phone,
    email: cleaner.email,
    notes: cleaner.notes,
    teamId: cleaner.teamId, // not a @Field() on CleanerType — see comment above
    // `team: null` is a type-level placeholder only, satisfying `CleanerType`'s
    // required field so this literal-with-an-extra-property (`teamId`) cast
    // type-checks — TS's `as` comparability check rejects an object literal
    // that both adds an unknown key AND omits a required target key. It is
    // never read: Apollo always calls `CleanerResolver.team()`'s
    // `@ResolveField()` for the `team` key independently of whatever this
    // object carries for it.
    team: null,
    createdAt: cleaner.createdAt,
    updatedAt: cleaner.updatedAt,
  } as CleanerType;
}

// Returns `Omit<TeamType, 'cleaners'>` cast to `TeamType` — `cleaners` is
// presentation-layer-only computed data, populated exclusively by
// `TeamResolver.cleaners()`'s `@ResolveField`.
export function toTeamType(team: Team): TeamType {
  return {
    id: team.id,
    name: team.name,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  } as TeamType;
}
