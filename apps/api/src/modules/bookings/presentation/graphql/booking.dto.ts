import { SortDirection } from '@ptc-org/nestjs-query-core';
import {
  Authorize,
  FilterableField,
  FilterableRelation,
  IDField,
  PagingStrategies,
  QueryOptions,
} from '@ptc-org/nestjs-query-graphql';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  PLATFORM_PAGE_DEFAULT,
  PLATFORM_PAGE_MAX,
} from '../../../../platform/graphql/paging';
import { tenantReadAuthorizer } from '../../../../platform/auth/authorization/tenant-read.authorizer';
import { Role } from '../../../../platform/auth/domain/role';
import { CustomerType } from '../../../customers/presentation/graphql/customer.type';
import { PropertyType } from '../../../customers/presentation/graphql/property.type';
import { ServiceType } from '../../../catalog/presentation/graphql/service.type';
import { TeamType } from '../../../cleaners/presentation/graphql/team.type';
import { BookingStatus } from '../../domain/booking-status';
import { BookingPricingSnapshotType } from './booking-pricing-snapshot.type';

registerEnumType(BookingStatus, { name: 'BookingStatus' });

const VIEW_ROLES = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];

const WRITE_ROLES = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
];

// No relation-level guards or `@Roles()`: a relation field is authorized
// by the root operation that reaches it, and its target's authorizer
// re-applies the tenant predicate (multi-tenant RFC §4.2 relation-field
// rules, #106).
const relationReadOpts = {
  remove: { enabled: false },
  update: { enabled: false },
};

@ObjectType('Booking')
// Security invariant (#85 multi-tenant spec §4.5): every nestjs-query read
// of this type — the root list/count, `booking(id)`, and every relation
// targeting this type — is ANDed with the principal's tenant. `tenantId` is
// deliberately not a GraphQL field; the filter applies to the entity column.
@Authorize(tenantReadAuthorizer<BookingDTO>())
@QueryOptions({
  defaultResultSize: PLATFORM_PAGE_DEFAULT,
  defaultSort: [
    { direction: SortDirection.DESC, field: 'scheduledAt' },
    { direction: SortDirection.ASC, field: 'id' },
  ],
  enableTotalCount: true,
  maxResultsSize: PLATFORM_PAGE_MAX,
  pagingStrategy: PagingStrategies.OFFSET,
})
@FilterableRelation('customer', () => CustomerType, {
  nullable: false,
  ...relationReadOpts,
})
@FilterableRelation('property', () => PropertyType, {
  nullable: false,
  ...relationReadOpts,
})
@FilterableRelation('service', () => ServiceType, {
  nullable: false,
  ...relationReadOpts,
})
@FilterableRelation('team', () => TeamType, {
  nullable: true,
  ...relationReadOpts,
})
export class BookingDTO {
  @IDField(() => ID)
  id!: string;

  @FilterableField()
  scheduledAt!: Date;

  @FilterableField(() => BookingStatus)
  status!: BookingStatus;

  @Field(() => BookingPricingSnapshotType)
  pricingSnapshot!: BookingPricingSnapshotType;

  @FilterableField()
  createdAt!: Date;
}

export { VIEW_ROLES, WRITE_ROLES };
