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
    decorators: [Roles(...VIEW_ROLES)],
    defaultResultSize: PLATFORM_PAGE_DEFAULT,
    defaultSort: [
      { direction: SortDirection.DESC, field: 'scheduledAt' },
      { direction: SortDirection.ASC, field: 'id' },
    ],
    enableTotalCount: true,
    guards: [AuthGuard],
    many: { name: 'bookings' },
    maxResultsSize: PLATFORM_PAGE_MAX,
    one: { name: 'booking' },
    pagingStrategy: PagingStrategies.OFFSET,
  }),
) {
  constructor(
    @InjectQueryService(BookingEntity)
    readonly service: QueryService<BookingDTO>,
  ) {
    super(service);
  }
}
