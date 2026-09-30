import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import type { AuditLogger } from '../../../../platform/audit/application/audit-logger.port';
import { runAuditInTransaction } from '../../../../platform/audit/infrastructure/audit-logger.service';
import { AdminScope } from '../../../../platform/auth/domain/admin-scope';
import { PricingRulesService } from '../../../catalog/application/services/pricing-rules.service';
import { PricingUnit } from '../../../catalog/domain/pricing-unit';
import { CustomersService } from '../../../customers/application/services/customers.service';
import { LaundryFulfillmentType } from '../../domain/laundry-fulfillment-type';
import { LaundryLinePricingInput } from '../../domain/laundry-line-pricing';
import { computeLaundryLineAmount } from '../../domain/laundry-line-pricing';
import { LaundryOrder } from '../../domain/laundry-order';
import { LaundryOrderStatus } from '../../domain/laundry-order-status';
import { LaundryOrderStatusTransitionPolicy } from '../../domain/laundry-order-status-transition-policy';
import { LaundryOrderEntity } from '../../infrastructure/persistence/laundry-order.entity';
import { LaundryOrderLineEntity } from '../../infrastructure/persistence/laundry-order-line.entity';
import { LaundryOrderLinePricingSnapshotEmbeddable } from '../../infrastructure/persistence/laundry-order-line-pricing-snapshot.embeddable';
import { LaundryOrderTransitionCommand } from '../commands/laundry-order-transition.command';
import { OrderForInvoicing } from './order-for-invoicing';
import { PriceLaundryOrderCommand } from '../commands/price-laundry-order.command';
import { ReceiveLaundryOrderCommand } from '../commands/receive-laundry-order.command';
import { WeighLaundryOrderCommand } from '../commands/weigh-laundry-order.command';

const S = LaundryOrderStatus;
const ENTITY_TYPE = 'laundry_order';

@Injectable()
export class LaundryOrdersService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(LaundryOrderEntity)
    private readonly orderRepository: Repository<LaundryOrderEntity>,
    @InjectRepository(LaundryOrderLineEntity)
    private readonly lineRepository: Repository<LaundryOrderLineEntity>,
    private readonly policy: LaundryOrderStatusTransitionPolicy,
    private readonly customersService: CustomersService,
    private readonly pricingRulesService: PricingRulesService,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  // ---- reads --------------------------------------------------------------

  cancel(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(c, S.CANCELLED, 'laundry_order.cancelled');
  }

  complete(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(c, S.COMPLETED, 'laundry_order.completed');
  }

  // ---- intake ------------------------------------------------------------

  // Tenant in the same query as the id (#87 slice decision 5). A null
  // tenant (a platform principal) reads nothing.
  async getOrder(
    id: string,
    tenantId: string | null,
  ): Promise<LaundryOrder | null> {
    if (tenantId === null) {
      return null;
    }
    return this.orderRepository.findOneBy({ id, tenantId });
  }

  // ---- weigh -----------------------------------------------------------

  // Read-only projection for the Billing module (#38 spec §4.1). Returns
  // the order plus its lines' `serviceId`/`addOnId` and the four snapshot
  // fields Billing copies verbatim, or `null` if the order does not exist in
  // `tenantId` (#87 slice decision 6: order and lines by `{ …, tenantId }`).
  // Adds no capability to mutate an order and changes no existing contract.
  async getOrderForInvoicing(
    id: string,
    tenantId: string,
  ): Promise<OrderForInvoicing | null> {
    const order = await this.orderRepository.findOneBy({ id, tenantId });
    if (!order) {
      return null;
    }
    const lines = await this.lineRepository.find({
      order: { createdAt: 'ASC' },
      where: { laundryOrderId: id, tenantId },
    });
    return {
      id: order.id,
      customerId: order.customerId,
      tenantId: order.tenantId,
      lines: lines.map((line) => ({
        addOnId: line.addOnId,
        pricingSnapshot: {
          amountMinorUnits: line.pricingSnapshot.amountMinorUnits,
          quantity: line.pricingSnapshot.quantity,
          rateMinorUnits: line.pricingSnapshot.rateMinorUnits,
          unit: line.pricingSnapshot.unit,
        },
        serviceId: line.serviceId,
      })),
      status: order.status,
      totalMinorUnits: order.totalMinorUnits,
    };
  }

  // ---- price -----------------------------------------------------------

  markAwaitingDelivery(
    c: LaundryOrderTransitionCommand,
  ): Promise<LaundryOrder> {
    return this.transitionVerb(
      c,
      S.AWAITING_DELIVERY,
      'laundry_order.awaiting_delivery',
      (order) =>
        this.requireFulfillment(order, LaundryFulfillmentType.DELIVERY),
    );
  }

  // ---- status-transition verbs ---------------------------------------------

  markAwaitingPayment(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(
      c,
      S.AWAITING_PAYMENT,
      'laundry_order.awaiting_payment',
    );
  }

  markAwaitingPickup(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(
      c,
      S.AWAITING_PICKUP,
      'laundry_order.awaiting_pickup',
      (order) => this.requireFulfillment(order, LaundryFulfillmentType.PICKUP),
    );
  }

  markDamaged(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(c, S.DAMAGED, 'laundry_order.damaged');
  }

  markLost(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(c, S.LOST, 'laundry_order.lost');
  }

  markPaid(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(c, S.PAID, 'laundry_order.paid');
  }

  markReady(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(c, S.READY, 'laundry_order.ready');
  }

  // The immutable-snapshot operation, exactly once per order (spec §4.5).
  async price(command: PriceLaundryOrderCommand): Promise<LaundryOrder> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const order = await this.lock(
          manager,
          command.orderId,
          command.tenantId,
        );

        // Precondition guard (no re-pricing). The load-bearing transition
        // assertion is immediately before the status write below.
        if (order.status !== S.WEIGHED) {
          throw new BadRequestException(
            `Cannot price a laundry order in status ${order.status}`,
          );
        }
        if (order.weightGrams === null) {
          throw new BadRequestException('Laundry order has no recorded weight');
        }
        this.validateQuantity(command.baseQuantity);
        for (const addOn of command.addOns) {
          this.validateQuantity(addOn.quantity);
        }

        const asOf = new Date();
        const targets: Array<{
          column: 'addOnId' | 'serviceId';
          id: string;
          suppliedQuantity: number | undefined;
        }> = [
          {
            column: 'serviceId',
            id: command.baseServiceId,
            suppliedQuantity: command.baseQuantity,
          },
          ...command.addOns.map((addOn) => ({
            column: 'addOnId' as const,
            id: addOn.addOnId,
            suppliedQuantity: addOn.quantity,
          })),
        ];

        const lines: LaundryOrderLineEntity[] = [];
        let total = 0;

        for (const target of targets) {
          // Application-level same-tenant check (#84 slice decision 9): a
          // cross-tenant `baseServiceId` / `addOnId` has no pricing rule in
          // this tenant, so it falls through to the existing "no effective
          // price" 400 below. Application half of I-1;
          // `fk_laundry_order_line_service_tenant` / `_add_on_tenant` are
          // the database half (#87 slice decision 4).
          const rule = await this.pricingRulesService.resolveEffectivePricing(
            target.column === 'serviceId'
              ? { serviceId: target.id }
              : { addOnId: target.id },
            asOf,
            command.tenantId,
          );
          if (!rule) {
            throw new BadRequestException(
              `No effective price for ${target.column} ${target.id}`,
            );
          }

          const quantity = this.resolveQuantity(
            rule.unit,
            order.weightGrams,
            target.suppliedQuantity,
          );
          const input: LaundryLinePricingInput = {
            minimumChargeMinorUnits: rule.minimumChargeMinorUnits,
            quantity,
            rateMinorUnits: rule.priceMinorUnits,
            unit: rule.unit,
          };
          const { amountMinorUnits, minimumChargeApplied } =
            computeLaundryLineAmount(input);

          const snapshot = Object.assign(
            new LaundryOrderLinePricingSnapshotEmbeddable(),
            {
              pricingRuleId: rule.id,
              amountMinorUnits,
              minimumChargeApplied,
              minimumChargeMinorUnits: rule.minimumChargeMinorUnits,
              quantity,
              rateMinorUnits: rule.priceMinorUnits,
              unit: rule.unit,
            },
          );

          // The locked order row's tenant (#87 slice decision 6).
          const line = manager.create(LaundryOrderLineEntity, {
            addOnId: target.column === 'addOnId' ? target.id : null,
            laundryOrderId: order.id,
            serviceId: target.column === 'serviceId' ? target.id : null,
            tenantId: order.tenantId,
          });
          line.pricingSnapshot = snapshot;
          lines.push(line);
          total += amountMinorUnits;
        }

        for (const line of lines) {
          await manager.save(line);
        }

        this.policy.assertTransition(order.status, S.PRICED);
        await manager.update(
          LaundryOrderEntity,
          { id: order.id, tenantId: order.tenantId },
          {
            status: S.PRICED,
            totalMinorUnits: total,
            updatedAt: new Date(),
          },
        );
        await this.audit(
          command.actorId,
          'laundry_order.priced',
          order.id,
          order.tenantId,
        );
        return manager.findOneByOrFail(LaundryOrderEntity, {
          id: order.id,
          tenantId: order.tenantId,
        });
      }),
    );
  }

  // `getCustomer` runs before the transaction for a clean `NotFoundException`;
  // `fk_laundry_order_customer_tenant` is the actual check/write-race guard
  // (spec §4.1; #87 slice decision 4). The order is created with zero
  // lines — lines are created only by `price` (spec §4.5).
  async receive(command: ReceiveLaundryOrderCommand): Promise<LaundryOrder> {
    const customer = await this.customersService.getCustomer(
      command.customerId,
      command.tenantId,
    );
    if (!customer) {
      throw new NotFoundException(`Customer ${command.customerId} not found`);
    }

    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const entity = manager.create(LaundryOrderEntity, {
          customerId: command.customerId,
          tenantId: command.tenantId,
          fulfillmentType: command.fulfillmentType,
          status: S.RECEIVED,
          totalMinorUnits: null,
          weightGrams: null,
        });
        await manager.save(entity);
        await this.audit(
          command.actorId,
          'laundry_order.received',
          entity.id,
          command.tenantId,
        );
        return manager.findOneByOrFail(LaundryOrderEntity, {
          id: entity.id,
          tenantId: command.tenantId,
        });
      }),
    );
  }

  refund(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(c, S.REFUNDED, 'laundry_order.refunded');
  }

  reject(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(c, S.REJECTED, 'laundry_order.rejected');
  }

  startProcessing(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(
      c,
      S.PROCESSING,
      'laundry_order.processing_started',
    );
  }

  async weigh(command: WeighLaundryOrderCommand): Promise<LaundryOrder> {
    if (!Number.isInteger(command.weightGrams) || command.weightGrams < 0) {
      throw new BadRequestException(
        'weightGrams must be a non-negative integer',
      );
    }

    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const order = await this.lock(
          manager,
          command.orderId,
          command.tenantId,
        );
        const where = { id: order.id, tenantId: order.tenantId };

        if (order.status === S.RECEIVED) {
          this.policy.assertTransition(order.status, S.WEIGHED);
          await manager.update(LaundryOrderEntity, where, {
            status: S.WEIGHED,
            updatedAt: new Date(),
            weightGrams: command.weightGrams,
          });
        } else if (order.status === S.WEIGHED) {
          // State-preserving re-weigh (spec §3, §4.4) — no transition.
          await manager.update(LaundryOrderEntity, where, {
            updatedAt: new Date(),
            weightGrams: command.weightGrams,
          });
        } else {
          throw new BadRequestException(
            `Cannot weigh a laundry order in status ${order.status}`,
          );
        }

        await this.audit(
          command.actorId,
          'laundry_order.weighed',
          order.id,
          order.tenantId,
        );
        return manager.findOneByOrFail(LaundryOrderEntity, where);
      }),
    );
  }

  // ---- internals ---------------------------------------------------------

  // Tagged with the scoped order's tenant (#87 slice decision 11; RFC §4.6).
  private async audit(
    actorId: string,
    action: string,
    entityId: string,
    tenantId: string,
  ): Promise<void> {
    await this.auditLogger.log({
      actorId,
      entityId,
      tenantId,
      action,
      entityType: ENTITY_TYPE,
      scope: AdminScope.TENANT,
    });
  }

  // Locks by `{ id, tenantId }` in one query (#87 slice decision 6): another
  // tenant's order is a missing order (slice decision 7).
  private async lock(
    manager: EntityManager,
    id: string,
    tenantId: string,
  ): Promise<LaundryOrderEntity> {
    const order = await manager.findOne(LaundryOrderEntity, {
      lock: { mode: 'pessimistic_write' },
      where: { id, tenantId },
    });
    if (!order) {
      throw new NotFoundException(`Laundry order ${id} not found`);
    }
    return order;
  }

  private requireFulfillment(
    order: LaundryOrderEntity,
    expected: LaundryFulfillmentType,
  ): void {
    if (order.fulfillmentType !== expected) {
      throw new BadRequestException(
        `Laundry order fulfillment type is ${order.fulfillmentType}, not ${expected}`,
      );
    }
  }

  private resolveQuantity(
    unit: PricingUnit,
    weightGrams: number,
    suppliedQuantity: number | undefined,
  ): number {
    switch (unit) {
      case PricingUnit.PER_KG:
        return weightGrams;
      case PricingUnit.PER_ITEM:
        return suppliedQuantity ?? 1;
      case PricingUnit.FLAT:
      case PricingUnit.PER_SERVICE:
        return 1;
    }
  }

  // The only place `LaundryOrder.status` is written by a transition. Asserts
  // against the status of the pessimistically-locked row (`lockedOrder`),
  // never a re-read or a caller-supplied value (spec §4.3 load-bearing
  // invariant, plan §2).
  private async transition(
    manager: EntityManager,
    lockedOrder: LaundryOrderEntity,
    target: LaundryOrderStatus,
    action: string,
    actorId: string,
  ): Promise<void> {
    this.policy.assertTransition(lockedOrder.status, target);
    await manager.update(
      LaundryOrderEntity,
      { id: lockedOrder.id, tenantId: lockedOrder.tenantId },
      { status: target, updatedAt: new Date() },
    );
    await this.audit(actorId, action, lockedOrder.id, lockedOrder.tenantId);
  }

  private async transitionVerb(
    command: LaundryOrderTransitionCommand,
    target: LaundryOrderStatus,
    action: string,
    precondition?: (order: LaundryOrderEntity) => void,
  ): Promise<LaundryOrder> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const order = await this.lock(
          manager,
          command.orderId,
          command.tenantId,
        );
        precondition?.(order);
        await this.transition(manager, order, target, action, command.actorId);
        return manager.findOneByOrFail(LaundryOrderEntity, {
          id: order.id,
          tenantId: order.tenantId,
        });
      }),
    );
  }

  private validateQuantity(quantity: number | undefined): void {
    if (
      quantity !== undefined &&
      (!Number.isInteger(quantity) || quantity < 1)
    ) {
      throw new BadRequestException('quantity must be an integer >= 1');
    }
  }
}
