import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CustomersService } from '../../application/services/customers.service';
import { CreateCustomerCommand } from '../../application/commands/create-customer.command';
import { UpdateCustomerCommand } from '../../application/commands/update-customer.command';
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CreateCustomerInput } from './create-customer.input';
import { CustomerType } from './customer.type';
import { toCustomerType } from './mappers';
import { UpdateCustomerInput } from './update-customer.input';

// Clensy nullable get-by-id plus writes. Root `customers` and nested
// `properties` are Relatable / ReadResolver owned.
@Resolver(() => CustomerType)
export class CustomerResolver {
  constructor(private readonly customersService: CustomersService) {}

  @Query(() => CustomerType, { name: 'customer', nullable: true })
  @UseGuards(AuthGuard)
  @Roles(
    Role.OWNER,
    Role.OPS_MANAGER,
    Role.SCHEDULER,
    Role.CUSTOMER_SUPPORT,
    Role.ANALYST,
  )
  async customer(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<CustomerType | null> {
    const customer = await this.customersService.getCustomer(id);
    return customer ? toCustomerType(customer) : null;
  }

  @Mutation(() => CustomerType)
  @UseGuards(AuthGuard)
  @Roles(Role.OWNER, Role.OPS_MANAGER, Role.CUSTOMER_SUPPORT)
  async createCustomer(
    @Args('input') input: CreateCustomerInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<CustomerType> {
    const command: CreateCustomerCommand = {
      ...input,
      actorId: currentUser.id,
    };
    const customer = await this.customersService.create(command);
    return toCustomerType(customer);
  }

  @Mutation(() => CustomerType)
  @UseGuards(AuthGuard)
  @Roles(Role.OWNER, Role.OPS_MANAGER, Role.CUSTOMER_SUPPORT)
  async updateCustomer(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateCustomerInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<CustomerType> {
    const command: UpdateCustomerCommand = {
      ...input,
      actorId: currentUser.id,
    };
    const customer = await this.customersService.update(id, command);
    return toCustomerType(customer);
  }
}
