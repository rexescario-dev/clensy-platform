import { UseGuards } from '@nestjs/common';
import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { CustomersService } from '../../application/services/customers.service';
import { PropertiesService } from '../../application/services/properties.service';
import { CreateCustomerCommand } from '../../application/commands/create-customer.command';
import { UpdateCustomerCommand } from '../../application/commands/update-customer.command';
import { Customer } from '../../domain/customer';
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CreateCustomerInput } from './create-customer.input';
import { CustomerType } from './customer.type';
import { PropertyType } from './property.type';
import { toPropertyType } from './property.resolver';
import { UpdateCustomerInput } from './update-customer.input';

// Never expose `Customer` (the domain interface) or the TypeORM entity as a
// GraphQL value. Returns `Omit<CustomerType, 'properties'>` cast to
// `CustomerType` — `properties` is presentation-layer-only computed data
// (spec §4.5), populated exclusively by `properties()`'s `@ResolveField`
// below; Apollo calls that field resolver for the `properties` key
// independently of whatever this mapper's return value carries for it, so
// no caller of `toCustomerType()` needs to (or can) populate it here.
function toCustomerType(customer: Customer): CustomerType {
  return {
    id: customer.id,
    fullName: customer.fullName,
    email: customer.email,
    phone: customer.phone,
    notes: customer.notes,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  } as CustomerType;
}

// Exactly the `Customer`-scoped operations of spec §4.5 — no others.
@Resolver(() => CustomerType)
export class CustomerResolver {
  constructor(
    private readonly customersService: CustomersService,
    private readonly propertiesService: PropertiesService,
  ) {}

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

  @Query(() => [CustomerType], { name: 'customers' })
  @UseGuards(AuthGuard)
  @Roles(
    Role.OWNER,
    Role.OPS_MANAGER,
    Role.SCHEDULER,
    Role.CUSTOMER_SUPPORT,
    Role.ANALYST,
  )
  async customers(): Promise<CustomerType[]> {
    const customers = await this.customersService.listCustomers();
    return customers.map(toCustomerType);
  }

  @Mutation(() => CustomerType)
  @UseGuards(AuthGuard)
  @Roles(Role.OWNER, Role.OPS_MANAGER, Role.CUSTOMER_SUPPORT)
  async createCustomer(
    @Args('input') input: CreateCustomerInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<CustomerType> {
    // Object spread, never manual field-by-field listing (task brief) — kept
    // consistent with `updateCustomer` below even though every
    // `CreateCustomerInput` field is required.
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
    // Object spread (task brief, spec §4.2) — `input` only carries keys the
    // caller actually provided, so an omitted field retains its current
    // value once `CustomersService.update` does `Object.assign(entity,
    // fields)`. Manually re-listing fields here would silently break that
    // partial-update guarantee.
    const command: UpdateCustomerCommand = {
      ...input,
      actorId: currentUser.id,
    };
    const customer = await this.customersService.update(id, command);
    return toCustomerType(customer);
  }

  // Presentation-layer-only computed field (spec §4.5) — `customer` here is
  // whatever `toCustomerType()`-mapped object the base `customer`/
  // `customers`/`createCustomer`/`updateCustomer` methods returned; only its
  // `id` is used. Calls the same `PropertiesService.listCustomerProperties`
  // the standalone `customerProperties` query uses (§4.5) — the GraphQL
  // layer is the only place the two are connected.
  @ResolveField(() => [PropertyType])
  async properties(@Parent() customer: CustomerType): Promise<PropertyType[]> {
    const properties = await this.propertiesService.listCustomerProperties(
      customer.id,
    );
    return properties.map(toPropertyType);
  }
}
