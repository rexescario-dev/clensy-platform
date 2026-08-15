import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Role } from '../../../../platform/auth/domain/role';

registerEnumType(Role, { name: 'Role' });

// Explicit, hand-defined presentation type — never `AdminUser` (the domain
// interface) or `AdminUserEntity` (the TypeORM entity) returned directly as
// a GraphQL type (plan's GraphQL-type-boundary constraint). MUST NEVER
// expose `passwordHash`; `createdAt` is omitted too since no current
// consumer needs it — both are simply absent from this class's `@Field()`s,
// which is what makes their exclusion a schema-level guarantee rather than
// a per-resolver discipline.
@ObjectType('Admin')
export class AdminType {
  @Field(() => ID)
  id!: string;

  @Field()
  email!: string;

  @Field(() => Role)
  role!: Role;

  @Field()
  isActive!: boolean;
}
