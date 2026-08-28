import {
  InjectQueryService,
  QueryService,
  SortDirection,
} from '@ptc-org/nestjs-query-core';
import {
  PagingStrategies,
  ReadResolver,
  Relatable,
} from '@ptc-org/nestjs-query-graphql';
import { Resolver } from '@nestjs/graphql';
import {
  PLATFORM_PAGE_DEFAULT,
  PLATFORM_PAGE_MAX,
} from '../../../../platform/graphql/paging';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { BookingEntity } from '../../infrastructure/persistence/booking.entity';
import { BookingDTO, VIEW_ROLES } from './booking.dto';

@Resolver(() => BookingDTO)
export class BookingReadResolver extends Relatable(BookingDTO, {
  enableAggregate: false,
  enableTotalCount: true,
})(
  ReadResolver(BookingDTO, {
    guards: [AuthGuard],
    decorators: [Roles(...VIEW_ROLES)],
    one: { name: 'booking' },
    many: { name: 'bookings' },
    pagingStrategy: PagingStrategies.OFFSET,
    enableTotalCount: true,
    defaultResultSize: PLATFORM_PAGE_DEFAULT,
    maxResultsSize: PLATFORM_PAGE_MAX,
    defaultSort: [
      { field: 'scheduledAt', direction: SortDirection.DESC },
      { field: 'id', direction: SortDirection.ASC },
    ],
  }),
) {
  constructor(
    @InjectQueryService(BookingEntity)
    readonly service: QueryService<BookingDTO>,
  ) {
    super(service);
  }
}
