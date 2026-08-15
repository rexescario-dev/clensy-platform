import { Field, ID, ObjectType } from '@nestjs/graphql';
import { Role } from '../../../../platform/auth/domain/role';

// Presentation type for `Query.currentAdmin`. Happens to have the same
// shape as `AuthenticatedPrincipal` (`{ id, role }`) today, but is kept as
// its own hand-defined GraphQL type — per the plan's §3 GraphQL-type-
// boundary constraint, `AuthenticatedPrincipal` (a `platform/auth` domain
// interface) is never returned directly as a GraphQL type, so this class
// is free to diverge from it later without touching `platform/auth`.
@ObjectType('CurrentAdmin')
export class CurrentAdminType {
  @Field(() => ID)
  id!: string;

  @Field(() => Role)
  role!: Role;
}
