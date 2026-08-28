import {
  InjectQueryService,
  QueryService,
} from '@ptc-org/nestjs-query-core';
import { ReadResolver, Relatable } from '@ptc-org/nestjs-query-graphql';
import { Resolver } from '@nestjs/graphql';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { ChecklistEntity } from '../../infrastructure/persistence/checklist.entity';
import { VIEW_ROLES } from './cleaning-job.type';
import { ChecklistType } from './checklist.type';

@Resolver(() => ChecklistType)
export class ChecklistReadResolver extends Relatable(ChecklistType, {
  enableAggregate: false,
  enableTotalCount: false,
})(
  ReadResolver(ChecklistType, {
    guards: [AuthGuard],
    decorators: [Roles(...VIEW_ROLES)],
    one: { disabled: true },
    many: { disabled: true },
  }),
) {
  constructor(
    @InjectQueryService(ChecklistEntity)
    readonly service: QueryService<ChecklistType>,
  ) {
    super(service);
  }
}
