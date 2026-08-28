import {
  InjectQueryService,
  QueryService,
} from '@ptc-org/nestjs-query-core';
import { ReadResolver, Relatable } from '@ptc-org/nestjs-query-graphql';
import { Resolver } from '@nestjs/graphql';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { Role } from '../../../../platform/auth/domain/role';
import { PropertyEntity } from '../../infrastructure/persistence/property.entity';
import { PropertyType } from './property.type';

const VIEW_ROLES = [
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.ANALYST,
];

@Resolver(() => PropertyType)
export class PropertyReadResolver extends Relatable(PropertyType, {
  enableAggregate: false,
  enableTotalCount: false,
})(
  ReadResolver(PropertyType, {
    guards: [AuthGuard],
    decorators: [Roles(...VIEW_ROLES)],
    one: { disabled: true },
    many: { disabled: true },
  }),
) {
  constructor(
    @InjectQueryService(PropertyEntity)
    readonly service: QueryService<PropertyType>,
  ) {
    super(service);
  }
}
