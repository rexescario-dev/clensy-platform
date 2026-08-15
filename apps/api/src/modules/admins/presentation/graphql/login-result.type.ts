import { Field, ObjectType } from '@nestjs/graphql';
import { CurrentAdminType } from './current-admin.type';

// Deliberately does NOT carry the raw JWT — the token lives only in the
// HttpOnly session cookie the `login` resolver sets on the response, never
// in a GraphQL response body. `admin` reuses `CurrentAdminType`'s shape
// (`{ id, role }`) rather than the fuller `AdminType`, because that is
// exactly what `LoginService.login()` returns (an `AuthenticatedPrincipal`)
// — no extra lookup is performed just to populate fields the login call
// itself never produced.
@ObjectType('LoginResult')
export class LoginResultType {
  @Field()
  success!: boolean;

  @Field(() => CurrentAdminType)
  admin!: CurrentAdminType;
}
