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
import { InvoiceEntity } from '../../infrastructure/persistence/invoice.entity';
import { InvoiceType, VIEW_ROLES } from './invoice.type';

// Root offset connection `invoices` + the `customer` / `laundryOrder`
// relations and the nested `lines` connection (all declared on
// `InvoiceType`, wired by `Relatable`). `one` is disabled — the nullable
// single-invoice query is a hand-written `@Query` on `InvoiceResolver`
// (the `LaundryOrderResolver.laundryOrder` precedent). Every entry point
// is guarded by `AuthGuard` + `@Roles(...VIEW_ROLES)` (spec §4.7).
@Resolver(() => InvoiceType)
export class InvoiceReadResolver extends Relatable(InvoiceType, {
  enableAggregate: false,
  enableTotalCount: true,
})(
  ReadResolver(InvoiceType, {
    guards: [AuthGuard],
    decorators: [Roles(...VIEW_ROLES)],
    one: { disabled: true },
    many: { name: 'invoices' },
    pagingStrategy: PagingStrategies.OFFSET,
    enableTotalCount: true,
    defaultResultSize: PLATFORM_PAGE_DEFAULT,
    maxResultsSize: PLATFORM_PAGE_MAX,
    defaultSort: [
      { field: 'issueDate', direction: SortDirection.DESC },
      { field: 'createdAt', direction: SortDirection.DESC },
      { field: 'id', direction: SortDirection.ASC },
    ],
  }),
) {
  constructor(
    @InjectQueryService(InvoiceEntity)
    readonly service: QueryService<InvoiceType>,
  ) {
    super(service);
  }
}
