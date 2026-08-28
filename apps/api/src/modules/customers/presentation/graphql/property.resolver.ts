import { UseGuards, BadRequestException } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  InjectQueryService,
  QueryService,
  getFilterOmitting,
  mergeFilter,
  mergeQuery,
} from '@ptc-org/nestjs-query-core';
import { PropertiesService } from '../../application/services/properties.service';
import { CreatePropertyCommand } from '../../application/commands/create-property.command';
import { UpdatePropertyCommand } from '../../application/commands/update-property.command';
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { PLATFORM_PAGE_DEFAULT } from '../../../../platform/graphql/paging';
import { PropertyEntity } from '../../infrastructure/persistence/property.entity';
import { CreatePropertyInput } from './create-property.input';
import { toPropertyType } from './mappers';
import {
  CustomerPropertiesQueryArgs,
  PropertyType,
} from './property.type';
import { UpdatePropertyInput } from './update-property.input';

const VIEW_ROLES = [
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.ANALYST,
];

// Exactly the `Property`-scoped operations of spec §4.5 — no others.
// `customerProperties` keeps its Clensy name and required `customerId`, and
// builds the page through 9.5.0 QueryArgsType / ConnectionType.createFromPromise
// / QueryService (not a hand-rolled connection).
@Resolver(() => PropertyType)
export class PropertyResolver {
  constructor(
    private readonly propertiesService: PropertiesService,
    @InjectQueryService(PropertyEntity)
    private readonly propertyQueryService: QueryService<PropertyType>,
  ) {}

  @Query(() => PropertyType, { name: 'property', nullable: true })
  @UseGuards(AuthGuard)
  @Roles(...VIEW_ROLES)
  async property(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PropertyType | null> {
    const property = await this.propertiesService.getProperty(id);
    return property ? toPropertyType(property) : null;
  }

  @Query(() => CustomerPropertiesQueryArgs.ConnectionType, {
    name: 'customerProperties',
  })
  @UseGuards(AuthGuard)
  @Roles(...VIEW_ROLES)
  async customerProperties(
    @Args('customerId', { type: () => ID }) customerId: string,
    @Args('paging', {
      type: () => CustomerPropertiesQueryArgs.PageType,
      nullable: true,
      defaultValue: { limit: PLATFORM_PAGE_DEFAULT },
    })
    paging?: InstanceType<typeof CustomerPropertiesQueryArgs.PageType>,
    @Args('filter', {
      type: () => CustomerPropertiesQueryArgs.FilterType,
      nullable: true,
    })
    filter?: InstanceType<typeof CustomerPropertiesQueryArgs.FilterType>,
    @Args('sorting', {
      type: () => [CustomerPropertiesQueryArgs.SortType],
      nullable: true,
    })
    sorting?: InstanceType<typeof CustomerPropertiesQueryArgs.SortType>[],
  ) {
    if (!customerId.trim()) {
      throw new BadRequestException('customerId is required');
    }
    const withoutClientScope = {
      paging: paging ?? { limit: PLATFORM_PAGE_DEFAULT },
      sorting,
      filter: getFilterOmitting(filter ?? {}, 'customerId'),
    };
    const scoped = mergeQuery(withoutClientScope, {
      filter: { customerId: { eq: customerId } },
    });
    return CustomerPropertiesQueryArgs.ConnectionType.createFromPromise(
      (pageQuery) => this.propertyQueryService.query(pageQuery),
      scoped,
      (countFilter) =>
        this.propertyQueryService.count(
          mergeFilter(getFilterOmitting(countFilter ?? {}, 'customerId'), {
            customerId: { eq: customerId },
          }),
        ),
    );
  }

  @Mutation(() => PropertyType)
  @UseGuards(AuthGuard)
  @Roles(Role.OWNER, Role.OPS_MANAGER, Role.CUSTOMER_SUPPORT)
  async createProperty(
    @Args('customerId', { type: () => ID }) customerId: string,
    @Args('input') input: CreatePropertyInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<PropertyType> {
    const command: CreatePropertyCommand = {
      ...input,
      customerId,
      actorId: currentUser.id,
    };
    const property = await this.propertiesService.create(command);
    return toPropertyType(property);
  }

  @Mutation(() => PropertyType)
  @UseGuards(AuthGuard)
  @Roles(Role.OWNER, Role.OPS_MANAGER, Role.CUSTOMER_SUPPORT)
  async updateProperty(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePropertyInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<PropertyType> {
    const command: UpdatePropertyCommand = {
      ...input,
      actorId: currentUser.id,
    };
    const property = await this.propertiesService.update(id, command);
    return toPropertyType(property);
  }
}
