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

  getOrder(id: string): Promise<LaundryOrder | null> {
    return this.orderRepository.findOneBy({ id });
  }

  // Read-only projection for the Billing module (#38 spec §4.1). Returns
  // the order plus its lines' `serviceId`/`addOnId` and the four snapshot
  // fields Billing copies verbatim, or `null` if the order does not exist.
  // Adds no capability to mutate an order and changes no existing contract.
  async getOrderForInvoicing(id: string): Promise<OrderForInvoicing | null> {
    const order = await this.orderRepository.findOneBy({ id });
    if (!order) {
      return null;
    }
    const lines = await this.lineRepository.find({
      where: { laundryOrderId: id },
      order: { createdAt: 'ASC' },
    });
    return {
      id: order.id,
      customerId: order.customerId,
      status: order.status,
      totalMinorUnits: order.totalMinorUnits,
      lines: lines.map((line) => ({
        serviceId: line.serviceId,
        addOnId: line.addOnId,
        pricingSnapshot: {
          quantity: line.pricingSnapshot.quantity,
          unit: line.pricingSnapshot.unit,
          rateMinorUnits: line.pricingSnapshot.rateMinorUnits,
          amountMinorUnits: line.pricingSnapshot.amountMinorUnits,
        },
      })),
    };
  }

  // ---- intake ------------------------------------------------------------

  // `getCustomer` runs before the transaction for a clean `NotFoundException`;
  // `fk_laundry_order_customer` is the actual check/write-race guard (spec
  // §4.1). The order is created with zero lines — lines are created only by
  // `price` (spec §4.5).
  async receive(command: ReceiveLaundryOrderCommand): Promise<LaundryOrder> {
    const customer = await this.customersService.getCustomer(
      command.customerId,
    );
    if (!customer) {
      throw new NotFoundException(`Customer ${command.customerId} not found`);
    }

    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const entity = manager.create(LaundryOrderEntity, {
          customerId: command.customerId,
          fulfillmentType: command.fulfillmentType,
          status: S.RECEIVED,
          weightGrams: null,
          totalMinorUnits: null,
        });
        await manager.save(entity);
        await this.audit(command.actorId, 'laundry_order.received', entity.id);
        return manager.findOneByOrFail(LaundryOrderEntity, { id: entity.id });
      }),
    );
  }

  // ---- weigh -----------------------------------------------------------

  async weigh(command: WeighLaundryOrderCommand): Promise<LaundryOrder> {
    if (!Number.isInteger(command.weightGrams) || command.weightGrams < 0) {
      throw new BadRequestException(
        'weightGrams must be a non-negative integer',
      );
    }

    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const order = await this.lock(manager, command.orderId);

        if (order.status === S.RECEIVED) {
          this.policy.assertTransition(order.status, S.WEIGHED);
          await manager.update(
            LaundryOrderEntity,
            { id: order.id },
            {
              status: S.WEIGHED,
              weightGrams: command.weightGrams,
              updatedAt: new Date(),
            },
          );
        } else if (order.status === S.WEIGHED) {
          // State-preserving re-weigh (spec §3, §4.4) — no transition.
          await manager.update(
            LaundryOrderEntity,
            { id: order.id },
            { weightGrams: command.weightGrams, updatedAt: new Date() },
          );
        } else {
          throw new BadRequestException(
            `Cannot weigh a laundry order in status ${order.status}`,
          );
        }

        await this.audit(command.actorId, 'laundry_order.weighed', order.id);
        return manager.findOneByOrFail(LaundryOrderEntity, { id: order.id });
      }),
    );
  }

  // ---- price -----------------------------------------------------------

  // The immutable-snapshot operation, exactly once per order (spec §4.5).
  async price(command: PriceLaundryOrderCommand): Promise<LaundryOrder> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const order = await this.lock(manager, command.orderId);

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
          column: 'serviceId' | 'addOnId';
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
          const rule = await this.pricingRulesService.resolveEffectivePricing(
            target.column === 'serviceId'
              ? { serviceId: target.id }
              : { addOnId: target.id },
            asOf,
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
            unit: rule.unit,
            rateMinorUnits: rule.priceMinorUnits,
            quantity,
            minimumChargeMinorUnits: rule.minimumChargeMinorUnits,
          };
          const { amountMinorUnits, minimumChargeApplied } =
            computeLaundryLineAmount(input);

          const snapshot = Object.assign(
            new LaundryOrderLinePricingSnapshotEmbeddable(),
            {
              rateMinorUnits: rule.priceMinorUnits,
              unit: rule.unit,
              quantity,
              amountMinorUnits,
              minimumChargeMinorUnits: rule.minimumChargeMinorUnits,
              minimumChargeApplied,
              pricingRuleId: rule.id,
            },
          );

          const line = manager.create(LaundryOrderLineEntity, {
            laundryOrderId: order.id,
            serviceId: target.column === 'serviceId' ? target.id : null,
            addOnId: target.column === 'addOnId' ? target.id : null,
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
          { id: order.id },
          {
            status: S.PRICED,
            totalMinorUnits: total,
            updatedAt: new Date(),
          },
        );
        await this.audit(command.actorId, 'laundry_order.priced', order.id);
        return manager.findOneByOrFail(LaundryOrderEntity, { id: order.id });
      }),
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

  markPaid(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(c, S.PAID, 'laundry_order.paid');
  }

  startProcessing(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(
      c,
      S.PROCESSING,
      'laundry_order.processing_started',
    );
  }

  markReady(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(c, S.READY, 'laundry_order.ready');
  }

  markAwaitingPickup(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(
      c,
      S.AWAITING_PICKUP,
      'laundry_order.awaiting_pickup',
      (order) => this.requireFulfillment(order, LaundryFulfillmentType.PICKUP),
    );
  }

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

  complete(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(c, S.COMPLETED, 'laundry_order.completed');
  }

  cancel(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(c, S.CANCELLED, 'laundry_order.cancelled');
  }

  reject(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(c, S.REJECTED, 'laundry_order.rejected');
  }

  markLost(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(c, S.LOST, 'laundry_order.lost');
  }

  markDamaged(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(c, S.DAMAGED, 'laundry_order.damaged');
  }

  refund(c: LaundryOrderTransitionCommand): Promise<LaundryOrder> {
    return this.transitionVerb(c, S.REFUNDED, 'laundry_order.refunded');
  }

  // ---- internals ---------------------------------------------------------

  private async transitionVerb(
    command: LaundryOrderTransitionCommand,
    target: LaundryOrderStatus,
    action: string,
    precondition?: (order: LaundryOrderEntity) => void,
  ): Promise<LaundryOrder> {
    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const order = await this.lock(manager, command.orderId);
        precondition?.(order);
        await this.transition(manager, order, target, action, command.actorId);
        return manager.findOneByOrFail(LaundryOrderEntity, { id: order.id });
      }),
    );
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
      { id: lockedOrder.id },
      { status: target, updatedAt: new Date() },
    );
    await this.audit(actorId, action, lockedOrder.id);
  }

  private async lock(
    manager: EntityManager,
    id: string,
  ): Promise<LaundryOrderEntity> {
    const order = await manager.findOne(LaundryOrderEntity, {
      where: { id },
      lock: { mode: 'pessimistic_write' },
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

  private validateQuantity(quantity: number | undefined): void {
    if (
      quantity !== undefined &&
      (!Number.isInteger(quantity) || quantity < 1)
    ) {
      throw new BadRequestException('quantity must be an integer >= 1');
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

  private async audit(
    actorId: string,
    action: string,
    entityId: string,
  ): Promise<void> {
    await this.auditLogger.log({
      actorId,
      action,
      entityType: ENTITY_TYPE,
      entityId,
    });
  }
}
