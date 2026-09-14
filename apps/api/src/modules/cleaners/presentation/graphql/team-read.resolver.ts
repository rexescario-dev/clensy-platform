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
import { TeamEntity } from '../../infrastructure/persistence/team.entity';
import { VIEW_ROLES } from './cleaner.type';
import { TeamType } from './team.type';

@Resolver(() => TeamType)
export class TeamReadResolver extends Relatable(TeamType, {
  enableAggregate: false,
  enableTotalCount: false,
})(
  ReadResolver(TeamType, {
    decorators: [Roles(...VIEW_ROLES)],
    defaultResultSize: PLATFORM_PAGE_DEFAULT,
    defaultSort: [
      { direction: SortDirection.DESC, field: 'createdAt' },
      { direction: SortDirection.ASC, field: 'id' },
    ],
    enableTotalCount: true,
    guards: [AuthGuard],
    many: { name: 'teams' },
    maxResultsSize: PLATFORM_PAGE_MAX,
    one: { disabled: true },
    pagingStrategy: PagingStrategies.OFFSET,
  }),
) {
  constructor(
    @InjectQueryService(TeamEntity)
    readonly service: QueryService<TeamType>,
  ) {
    super(service);
  }
}
