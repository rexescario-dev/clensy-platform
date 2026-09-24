import { UseGuards, BadRequestException } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  Filter,
  InjectQueryService,
  QueryService,
  getFilterOmitting,
  mergeFilter,
} from '@ptc-org/nestjs-query-core';
import { PropertiesService } from '../../application/services/properties.service';
import { CreatePropertyCommand } from '../../application/commands/create-property.command';
import { UpdatePropertyCommand } from '../../application/commands/update-property.command';
import { requireTenantId } from '../../../../platform/auth/authorization/require-tenant-id';
import { tenantFilterFor } from '../../../../platform/auth/authorization/tenant-read.authorizer';
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { PLATFORM_PAGE_DEFAULT } from '../../../../platform/graphql/paging';
import { PropertyEntity } from '../../infrastructure/persistence/property.entity';
import { CreatePropertyInput } from './create-property.input';
import { toPropertyType } from './mappers';
import { CustomerPropertiesQueryArgs, PropertyType } from './property.type';
import { UpdatePropertyInput } from './update-property.input';

const VIEW_ROLES = [
  Role.TENANT_OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
  Role.ANALYST,
];

// Exactly the `Property`-scoped operations of spec §4.5 — no others.
// `customerProperties` keeps its Clensy name and required `customerId`, and
// builds the page through 9.5.0 QueryArgsType / ConnectionType.createFromPromise
// / QueryService (not a hand-rolled connection).
//
// Tenant isolation (#82): the tenant comes only from the principal. Reads
// pass it through (the service / `tenantFilterFor` fail closed on `null`);
// writes require it. A command's `tenantId` is set after `...input` so no
// input key can override it.
@Resolver(() => PropertyType)
export class PropertyResolver {
  constructor(
    private readonly propertiesService: PropertiesService,
    @InjectQueryService(PropertyEntity)
    private readonly propertyQueryService: QueryService<PropertyType>,
  ) {}

  @Mutation(() => PropertyType)
  @UseGuards(AuthGuard)
  @Roles(Role.TENANT_OWNER, Role.OPS_MANAGER, Role.CUSTOMER_SUPPORT)
  async createProperty(
    @Args('customerId', { type: () => ID }) customerId: string,
    @Args('input') input: CreatePropertyInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<PropertyType> {
    const command: CreatePropertyCommand = {
      ...input,
      actorId: currentUser.id,
      customerId,
      tenantId: requireTenantId(currentUser),
    };
    const property = await this.propertiesService.create(command);
    return toPropertyType(property);
  }

  @Query(() => CustomerPropertiesQueryArgs.ConnectionType, {
    name: 'customerProperties',
  })
  @UseGuards(AuthGuard)
  @Roles(...VIEW_ROLES)
  async customerProperties(
    @Args('customerId', { type: () => ID }) customerId: string,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
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
    // `customerId` and `tenantId` are server-owned: any client predicate on
    // either is discarded before the server scope is ANDed in, for both the
    // page and the count. The tenant never comes from the GraphQL filter.
    // (`tenantId` is not a `PropertyType` field — hence the key cast; it is
    // omitted anyway as defense in depth, including inside `and`/`or`.)
    const serverScope = mergeFilter<PropertyType>(
      { customerId: { eq: customerId } },
      tenantFilterFor(currentUser.tenantId),
    );
    const scopeFilter = (clientFilter?: Filter<PropertyType>) =>
      mergeFilter(
        getFilterOmitting(
          clientFilter ?? {},
          'customerId',
          'tenantId' as never,
        ),
        serverScope,
      );
    const scoped = {
      filter: scopeFilter(filter),
      paging: paging ?? { limit: PLATFORM_PAGE_DEFAULT },
      sorting,
    };
    return CustomerPropertiesQueryArgs.ConnectionType.createFromPromise(
      (pageQuery) => this.propertyQueryService.query(pageQuery),
      scoped,
      (countFilter) =>
        this.propertyQueryService.count(scopeFilter(countFilter)),
    );
  }

  @Query(() => PropertyType, { name: 'property', nullable: true })
  @UseGuards(AuthGuard)
  @Roles(...VIEW_ROLES)
  async property(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<PropertyType | null> {
    const property = await this.propertiesService.getProperty(
      id,
      currentUser.tenantId,
    );
    return property ? toPropertyType(property) : null;
  }

  @Mutation(() => PropertyType)
  @UseGuards(AuthGuard)
  @Roles(Role.TENANT_OWNER, Role.OPS_MANAGER, Role.CUSTOMER_SUPPORT)
  async updateProperty(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdatePropertyInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<PropertyType> {
    const command: UpdatePropertyCommand = {
      ...input,
      actorId: currentUser.id,
      tenantId: requireTenantId(currentUser),
    };
    const property = await this.propertiesService.update(id, command);
    return toPropertyType(property);
  }
}
