import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import { AddOnsService } from '../../application/services/add-ons.service';
import { CreateAddOnCommand } from '../../application/commands/create-add-on.command';
import { UpdateAddOnCommand } from '../../application/commands/update-add-on.command';
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { AddOnType } from './add-on.type';
import { CreateAddOnInput } from './create-add-on.input';
import { toAddOnType } from './mappers';
import { UpdateAddOnInput } from './update-add-on.input';

// Exactly the `AddOn`-scoped operations of spec §4.5 — no others. `AddOn` is
// a fully independent domain object (global add-ons, not scoped to any
// `Service`), so there is no single-`addOn(id)` query (matching
// `AddOnsService`'s own lack of a `getAddOn(id)` read method) and no
// `@ResolveField` here.
@Resolver(() => AddOnType)
export class AddOnResolver {
  constructor(private readonly addOnsService: AddOnsService) {}

  @Mutation(() => AddOnType)
  @UseGuards(AuthGuard)
  @Roles(Role.OWNER, Role.OPS_MANAGER)
  async createAddOn(
    @Args('input') input: CreateAddOnInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<AddOnType> {
    const command: CreateAddOnCommand = {
      ...input,
      actorId: currentUser.id,
    };
    const addOn = await this.addOnsService.createAddOn(command);
    return toAddOnType(addOn);
  }

  @Mutation(() => AddOnType)
  @UseGuards(AuthGuard)
  @Roles(Role.OWNER, Role.OPS_MANAGER)
  async updateAddOn(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateAddOnInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<AddOnType> {
    const command: UpdateAddOnCommand = {
      ...input,
      actorId: currentUser.id,
    };
    const addOn = await this.addOnsService.updateAddOn(id, command);
    return toAddOnType(addOn);
  }
}
