import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PropertiesService } from '../../application/services/properties.service';
import { CreatePropertyCommand } from '../../application/commands/create-property.command';
import { UpdatePropertyCommand } from '../../application/commands/update-property.command';
import { Property } from '../../domain/property';
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CreatePropertyInput } from './create-property.input';
import { PropertyType } from './property.type';
import { UpdatePropertyInput } from './update-property.input';

// Never expose `Property` (the domain interface) or the TypeORM entity as a
// GraphQL value — every `PropertiesService` result is mapped through this
// before leaving either resolver (also used by `CustomerResolver`'s
// `properties` field resolver, spec §4.5).
export function toPropertyType(property: Property): PropertyType {
  return {
    id: property.id,
    customerId: property.customerId,
    label: property.label,
    addressLine1: property.addressLine1,
    addressLine2: property.addressLine2,
    city: property.city,
    region: property.region,
    postalCode: property.postalCode,
    accessNotes: property.accessNotes,
    createdAt: property.createdAt,
    updatedAt: property.updatedAt,
  };
}

// Exactly the `Property`-scoped operations of spec §4.5 — no others.
@Resolver(() => PropertyType)
export class PropertyResolver {
  constructor(private readonly propertiesService: PropertiesService) {}

  @Query(() => PropertyType, { name: 'property', nullable: true })
  @UseGuards(AuthGuard)
  @Roles(
    Role.OWNER,
    Role.OPS_MANAGER,
    Role.SCHEDULER,
    Role.CUSTOMER_SUPPORT,
    Role.ANALYST,
  )
  async property(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<PropertyType | null> {
    const property = await this.propertiesService.getProperty(id);
    return property ? toPropertyType(property) : null;
  }

  @Query(() => [PropertyType], { name: 'customerProperties' })
  @UseGuards(AuthGuard)
  @Roles(
    Role.OWNER,
    Role.OPS_MANAGER,
    Role.SCHEDULER,
    Role.CUSTOMER_SUPPORT,
    Role.ANALYST,
  )
  async customerProperties(
    @Args('customerId', { type: () => ID }) customerId: string,
  ): Promise<PropertyType[]> {
    const properties =
      await this.propertiesService.listCustomerProperties(customerId);
    return properties.map(toPropertyType);
  }

  @Mutation(() => PropertyType)
  @UseGuards(AuthGuard)
  @Roles(Role.OWNER, Role.OPS_MANAGER, Role.CUSTOMER_SUPPORT)
  async createProperty(
    @Args('customerId', { type: () => ID }) customerId: string,
    @Args('input') input: CreatePropertyInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<PropertyType> {
    // Object spread, never manual field-by-field listing (task brief) — a
    // fully-optional `PartialType` input re-listed field-by-field would
    // materialize explicit `key: undefined` for every omitted field, and
    // `PropertiesService.update`'s `Object.assign(entity, fields)` would
    // then overwrite the entity's existing value with `undefined`. Not load
    // -bearing for `createProperty` (all `CreatePropertyInput` fields are
    // required), but kept consistent with `updateProperty` below.
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
    // Object spread (task brief, spec §4.2) — `input` only carries keys the
    // caller actually provided, so an omitted field retains its current
    // value once `PropertiesService.update` does `Object.assign(entity,
    // fields)`. Manually re-listing fields here would silently break that
    // partial-update guarantee.
    const command: UpdatePropertyCommand = {
      ...input,
      actorId: currentUser.id,
    };
    const property = await this.propertiesService.update(id, command);
    return toPropertyType(property);
  }
}
