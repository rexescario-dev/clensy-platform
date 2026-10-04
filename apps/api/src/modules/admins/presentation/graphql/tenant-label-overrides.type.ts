import { Field, ObjectType } from '@nestjs/graphql';
import type { RelabelableRole } from '../../domain/tenant-label-overrides';

// Spec §4.3. Code-first NestJS needs each field declared by hand, so the six
// names appear here by necessity. Two complementary guards keep them aligned
// with RELABELABLE_ROLES: `implements Record<RelabelableRole, …>` fails to
// compile if a relabelable role has no property, and the schema drift test
// (current-admin-label-overrides.resolver.spec.ts) fails on any difference
// between the declared GraphQL fields and RELABELABLE_ROLES.
@ObjectType('RoleLabelOverrides')
export class RoleLabelOverridesType implements Record<
  RelabelableRole,
  string | null
> {
  @Field(() => String, { nullable: true })
  ANALYST!: string | null;

  @Field(() => String, { nullable: true })
  CUSTOMER_SUPPORT!: string | null;

  @Field(() => String, { nullable: true })
  FINANCE!: string | null;

  @Field(() => String, { nullable: true })
  OPS_MANAGER!: string | null;

  @Field(() => String, { nullable: true })
  SCHEDULER!: string | null;

  @Field(() => String, { nullable: true })
  TENANT_OWNER!: string | null;
}

// `locale` identifies the catalog the overrides belong to — a statement
// about the data, not negotiation. Always "en" in this version.
@ObjectType('TenantLabelOverrides')
export class TenantLabelOverridesType {
  @Field(() => String)
  locale!: string;

  @Field(() => RoleLabelOverridesType)
  roles!: RoleLabelOverridesType;
}
