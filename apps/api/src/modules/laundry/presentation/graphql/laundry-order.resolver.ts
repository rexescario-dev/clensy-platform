import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { LaundryOrdersService } from '../../application/services/laundry-orders.service';
import { LaundryOrderTransitionCommand } from '../../application/commands/laundry-order-transition.command';
import { LaundryOrder } from '../../domain/laundry-order';
import {
  LaundryOrderRefInput,
  PriceLaundryOrderInput,
  ReceiveLaundryOrderInput,
  WeighLaundryOrderInput,
} from './laundry-order.inputs';
import { toLaundryOrderType } from './mappers';
import { LaundryOrderType, VIEW_ROLES } from './laundry-order.type';

// Per-verb RBAC — spec §4.4 table (Accepted as proposed).
const OPERATIONAL = [Role.OWNER, Role.OPS_MANAGER, Role.SCHEDULER];
const INTAKE = [...OPERATIONAL, Role.CUSTOMER_SUPPORT];
const PAYMENT = [
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.FINANCE,
  Role.CUSTOMER_SUPPORT,
];
const CANCEL = [Role.OWNER, Role.OPS_MANAGER, Role.CUSTOMER_SUPPORT];
const EXCEPTION = [Role.OWNER, Role.OPS_MANAGER];
const REFUND = [Role.OWNER, Role.OPS_MANAGER, Role.FINANCE];

@Resolver(() => LaundryOrderType)
export class LaundryOrderResolver {
  constructor(private readonly service: LaundryOrdersService) {}

  @Query(() => LaundryOrderType, { name: 'laundryOrder', nullable: true })
  @UseGuards(AuthGuard)
  @Roles(...VIEW_ROLES)
  async laundryOrder(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<LaundryOrderType | null> {
    const order = await this.service.getOrder(id);
    return order ? toLaundryOrderType(order) : null;
  }

  @Mutation(() => LaundryOrderType)
  @UseGuards(AuthGuard)
  @Roles(...INTAKE)
  async receiveLaundryOrder(
    @Args('input') input: ReceiveLaundryOrderInput,
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<LaundryOrderType> {
    return toLaundryOrderType(
      await this.service.receive({ ...input, actorId: user.id }),
    );
  }

  @Mutation(() => LaundryOrderType)
  @UseGuards(AuthGuard)
  @Roles(...OPERATIONAL)
  async weighLaundryOrder(
    @Args('input') input: WeighLaundryOrderInput,
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<LaundryOrderType> {
    return toLaundryOrderType(
      await this.service.weigh({ ...input, actorId: user.id }),
    );
  }

  @Mutation(() => LaundryOrderType)
  @UseGuards(AuthGuard)
  @Roles(...OPERATIONAL)
  async priceLaundryOrder(
    @Args('input') input: PriceLaundryOrderInput,
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<LaundryOrderType> {
    return toLaundryOrderType(
      await this.service.price({ ...input, actorId: user.id }),
    );
  }

  @Mutation(() => LaundryOrderType)
  @UseGuards(AuthGuard)
  @Roles(...PAYMENT)
  markLaundryOrderAwaitingPayment(
    @Args('input') input: LaundryOrderRefInput,
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<LaundryOrderType> {
    return this.run(input, user, (c) => this.service.markAwaitingPayment(c));
  }

  @Mutation(() => LaundryOrderType)
  @UseGuards(AuthGuard)
  @Roles(...PAYMENT)
  markLaundryOrderPaid(
    @Args('input') input: LaundryOrderRefInput,
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<LaundryOrderType> {
    return this.run(input, user, (c) => this.service.markPaid(c));
  }

  @Mutation(() => LaundryOrderType)
  @UseGuards(AuthGuard)
  @Roles(...OPERATIONAL)
  startLaundryProcessing(
    @Args('input') input: LaundryOrderRefInput,
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<LaundryOrderType> {
    return this.run(input, user, (c) => this.service.startProcessing(c));
  }

  @Mutation(() => LaundryOrderType)
  @UseGuards(AuthGuard)
  @Roles(...OPERATIONAL)
  markLaundryOrderReady(
    @Args('input') input: LaundryOrderRefInput,
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<LaundryOrderType> {
    return this.run(input, user, (c) => this.service.markReady(c));
  }

  @Mutation(() => LaundryOrderType)
  @UseGuards(AuthGuard)
  @Roles(...OPERATIONAL)
  markLaundryOrderAwaitingPickup(
    @Args('input') input: LaundryOrderRefInput,
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<LaundryOrderType> {
    return this.run(input, user, (c) => this.service.markAwaitingPickup(c));
  }

  @Mutation(() => LaundryOrderType)
  @UseGuards(AuthGuard)
  @Roles(...OPERATIONAL)
  markLaundryOrderAwaitingDelivery(
    @Args('input') input: LaundryOrderRefInput,
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<LaundryOrderType> {
    return this.run(input, user, (c) => this.service.markAwaitingDelivery(c));
  }

  @Mutation(() => LaundryOrderType)
  @UseGuards(AuthGuard)
  @Roles(...INTAKE)
  completeLaundryOrder(
    @Args('input') input: LaundryOrderRefInput,
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<LaundryOrderType> {
    return this.run(input, user, (c) => this.service.complete(c));
  }

  @Mutation(() => LaundryOrderType)
  @UseGuards(AuthGuard)
  @Roles(...CANCEL)
  cancelLaundryOrder(
    @Args('input') input: LaundryOrderRefInput,
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<LaundryOrderType> {
    return this.run(input, user, (c) => this.service.cancel(c));
  }

  @Mutation(() => LaundryOrderType)
  @UseGuards(AuthGuard)
  @Roles(...EXCEPTION)
  rejectLaundryOrder(
    @Args('input') input: LaundryOrderRefInput,
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<LaundryOrderType> {
    return this.run(input, user, (c) => this.service.reject(c));
  }

  @Mutation(() => LaundryOrderType)
  @UseGuards(AuthGuard)
  @Roles(...EXCEPTION)
  markLaundryOrderLost(
    @Args('input') input: LaundryOrderRefInput,
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<LaundryOrderType> {
    return this.run(input, user, (c) => this.service.markLost(c));
  }

  @Mutation(() => LaundryOrderType)
  @UseGuards(AuthGuard)
  @Roles(...EXCEPTION)
  markLaundryOrderDamaged(
    @Args('input') input: LaundryOrderRefInput,
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<LaundryOrderType> {
    return this.run(input, user, (c) => this.service.markDamaged(c));
  }

  @Mutation(() => LaundryOrderType)
  @UseGuards(AuthGuard)
  @Roles(...REFUND)
  refundLaundryOrder(
    @Args('input') input: LaundryOrderRefInput,
    @CurrentUser() user: AuthenticatedPrincipal,
  ): Promise<LaundryOrderType> {
    return this.run(input, user, (c) => this.service.refund(c));
  }

  private async run(
    input: LaundryOrderRefInput,
    user: AuthenticatedPrincipal,
    op: (command: LaundryOrderTransitionCommand) => Promise<LaundryOrder>,
  ): Promise<LaundryOrderType> {
    return toLaundryOrderType(
      await op({ actorId: user.id, orderId: input.orderId }),
    );
  }
}
