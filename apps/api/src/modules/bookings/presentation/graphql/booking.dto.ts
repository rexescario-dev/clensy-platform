import {
  FilterableField,
  FilterableRelation,
  IDField,
  PagingStrategies,
  QueryOptions,
} from '@ptc-org/nestjs-query-graphql';
import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CustomerType } from '../../../customers/presentation/graphql/customer.type';
import { PropertyType } from '../../../customers/presentation/graphql/property.type';
import { ServiceType } from '../../../catalog/presentation/graphql/service.type';
import { TeamType } from '../../../cleaners/presentation/graphql/team.type';
import { BookingStatus } from '../../domain/booking-status';
import { BookingPricingSnapshotType } from './booking-pricing-snapshot.type';

registerEnumType(BookingStatus, { name: 'BookingStatus' });

const VIEW_ROLES = [
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.FINANCE,
  Role.ANALYST,
];

const relationReadOpts = {
  update: { enabled: false },
  remove: { enabled: false },
  guards: [AuthGuard],
  decorators: [Roles(...VIEW_ROLES)],
};

@ObjectType('Booking')
@QueryOptions({ pagingStrategy: PagingStrategies.NONE })
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

export { VIEW_ROLES };
