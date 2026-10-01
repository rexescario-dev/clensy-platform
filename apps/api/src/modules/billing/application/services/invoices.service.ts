import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { AUDIT_LOGGER } from '../../../../platform/audit/application/audit-logger.port';
import type { AuditLogger } from '../../../../platform/audit/application/audit-logger.port';
import { runAuditInTransaction } from '../../../../platform/audit/infrastructure/audit-logger.service';
import { AddOnsService } from '../../../catalog/application/services/add-ons.service';
import { ServicesService } from '../../../catalog/application/services/services.service';
import { LaundryOrdersService } from '../../../laundry/application/services/laundry-orders.service';
import type {
  OrderForInvoicing,
  OrderForInvoicingLine,
} from '../../../laundry/application/services/order-for-invoicing';
import { LaundryOrderStatus } from '../../../laundry/domain/laundry-order-status';
import { Invoice } from '../../domain/invoice';
import { computeInvoiceTotals } from '../../domain/invoice-totals';
import {
  formatInvoiceNumber,
  resolveManilaYear,
} from '../../domain/invoice-number';
import { InvoicePaymentStatus } from '../../domain/invoice-payment-status';
import { InvoicePaymentTerms } from '../../domain/invoice-payment-terms';
import { InvoiceEntity } from '../../infrastructure/persistence/invoice.entity';
import { allocateInvoiceNumber } from '../../infrastructure/persistence/invoice-number-counter';
import { InvoiceLineEntity } from '../../infrastructure/persistence/invoice-line.entity';
import { GenerateInvoiceFromOrderCommand } from '../commands/generate-invoice-from-order.command';
import { isPostgresUniqueViolation } from './unique-violation';
import { tenantAuditTags } from '../../../../platform/audit/application/audit-tags';

const ENTITY_TYPE = 'invoice';

// spec §4.3: an order is billable iff its pricing is frozen
// (`totalMinorUnits !== null`, the authoritative #37 signal for "passed
// PRICED") AND its status is not one of the exceptional exits. Those two
// conditions together admit exactly the ordinary-fulfilment range
// PRICED..COMPLETED. The excluded set is explicit so a new #37 exceptional
// state forces this spec to be revisited rather than silently becoming
// billable.
const EXCLUDED_STATUSES: ReadonlySet<LaundryOrderStatus> = new Set([
  LaundryOrderStatus.CANCELLED,
  LaundryOrderStatus.REJECTED,
  LaundryOrderStatus.LOST,
  LaundryOrderStatus.DAMAGED,
  LaundryOrderStatus.REFUNDED,
]);

@Injectable()
export class InvoicesService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(InvoiceEntity)
    private readonly invoiceRepository: Repository<InvoiceEntity>,
    private readonly laundryOrdersService: LaundryOrdersService,
    private readonly servicesService: ServicesService,
    private readonly addOnsService: AddOnsService,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  // The one-time generation of an immutable invoice from a priced laundry
  // order (spec §4.3, §4.4, §4.6). All eligibility and catalog-resolution
  // checks run BEFORE the write transaction; `uq_invoice_laundry_order` —
  // not the pre-check — is the concurrency correctness mechanism.
  //
  // Tenancy (#87 slice decisions 6, 9, 11): the order is read in the
  // caller's tenant; the invoice, its number and its audit event take the
  // scoped order row's tenant. Allocation, the invoice/line saves and the
  // audit run on the one transaction manager, and a
  // `uq_invoice_laundry_order` loser's `ConflictException` is raised inside
  // the callback, so TypeORM rolls the counter increment back before the
  // caller sees it.
  async generateFromOrder(
    command: GenerateInvoiceFromOrderCommand,
  ): Promise<Invoice> {
    const issueDate = new Date();

    const order = await this.laundryOrdersService.getOrderForInvoicing(
      command.laundryOrderId,
      command.tenantId,
    );
    if (!order) {
      throw new NotFoundException(
        `Laundry order ${command.laundryOrderId} not found`,
      );
    }
    this.assertEligible(order);

    const existing = await this.invoiceRepository.findOneBy({
      laundryOrderId: order.id,
      tenantId: order.tenantId,
    });
    if (existing) {
      throw new ConflictException(
        'An invoice already exists for this laundry order',
      );
    }

    const linePayloads = await this.buildLinePayloads(
      order.lines,
      command.tenantId,
    );
    const { subtotalMinorUnits, totalMinorUnits } = computeInvoiceTotals({
      discountMinorUnits: 0,
      lineAmountsMinorUnits: linePayloads.map((l) => l.amountMinorUnits),
    });
    const dueDate =
      command.paymentTerms === InvoicePaymentTerms.PAY_NOW ? issueDate : null;

    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const raced = await manager.findOneBy(InvoiceEntity, {
          laundryOrderId: order.id,
          tenantId: order.tenantId,
        });
        if (raced) {
          throw new ConflictException(
            'An invoice already exists for this laundry order',
          );
        }

        const invoiceNumber = formatInvoiceNumber(
          await allocateInvoiceNumber(manager, order.tenantId),
          resolveManilaYear(issueDate),
        );

        const invoice = manager.create(InvoiceEntity, {
          customerId: order.customerId,
          laundryOrderId: order.id,
          tenantId: order.tenantId,
          amountPaidMinorUnits: 0,
          discountMinorUnits: 0,
          dueDate,
          invoiceNumber,
          issueDate,
          paymentStatus: InvoicePaymentStatus.UNPAID,
          paymentTerms: command.paymentTerms,
          subtotalMinorUnits,
          totalMinorUnits,
        });
        await this.saveInvoice(manager, invoice);

        for (const payload of linePayloads) {
          const line = manager.create(InvoiceLineEntity, {
            invoiceId: invoice.id,
            ...payload,
          });
          await manager.save(line);
        }

        await this.auditLogger.log({
          actorId: command.actorId,
          entityId: invoice.id,
          action: 'invoice.generated',
          entityType: ENTITY_TYPE,
          ...tenantAuditTags(invoice.tenantId),
        });

        return manager.findOneByOrFail(InvoiceEntity, {
          id: invoice.id,
          tenantId: invoice.tenantId,
        });
      }),
    );
  }

  // Tenant in the same query as the id (#87 slice decision 5). A null
  // tenant (a platform principal) reads nothing.
  async getInvoice(
    id: string,
    tenantId: string | null,
  ): Promise<Invoice | null> {
    if (tenantId === null) {
      return null;
    }
    return this.invoiceRepository.findOneBy({ id, tenantId });
  }

  private assertEligible(order: OrderForInvoicing): void {
    if (order.totalMinorUnits === null) {
      throw new BadRequestException(
        'Laundry order is not priced — no invoice can be generated',
      );
    }
    if (EXCLUDED_STATUSES.has(order.status)) {
      throw new BadRequestException(
        `Cannot generate an invoice for a laundry order in status ${order.status}`,
      );
    }
    if (order.lines.length === 0) {
      throw new BadRequestException('Laundry order has no priced lines');
    }
  }

  private async buildLinePayloads(
    lines: OrderForInvoicingLine[],
    tenantId: string,
  ): Promise<
    Array<{
      description: string;
      quantity: number;
      unit: OrderForInvoicingLine['pricingSnapshot']['unit'];
      rateMinorUnits: number;
      amountMinorUnits: number;
    }>
  > {
    const serviceIds = lines
      .map((l) => l.serviceId)
      .filter((id): id is string => id !== null);
    const addOnIds = lines
      .map((l) => l.addOnId)
      .filter((id): id is string => id !== null);

    // Application-level same-tenant check (#84 slice decision 9): a line
    // whose catalog row belongs to another tenant does not resolve here and
    // falls through to the existing "could not be resolved" 400 below.
    const [services, addOns] = await Promise.all([
      this.servicesService.getServicesByIds(serviceIds, tenantId),
      this.addOnsService.getAddOnsByIds(addOnIds, tenantId),
    ]);
    const serviceName = new Map(services.map((s) => [s.id, s.name]));
    const addOnName = new Map(addOns.map((a) => [a.id, a.name]));

    return lines.map((line) => {
      const { quantity, unit, rateMinorUnits, amountMinorUnits } =
        line.pricingSnapshot;
      let description: string;
      if (line.serviceId !== null) {
        const name = serviceName.get(line.serviceId);
        if (name === undefined) {
          throw new BadRequestException(
            `Service ${line.serviceId} could not be resolved`,
          );
        }
        description = name;
      } else {
        const name = addOnName.get(line.addOnId as string);
        if (name === undefined) {
          throw new BadRequestException(
            `Add-on ${line.addOnId as string} could not be resolved`,
          );
        }
        description = `${name} (add-on)`;
      }
      return { amountMinorUnits, description, quantity, rateMinorUnits, unit };
    });
  }

  private async saveInvoice(
    manager: EntityManager,
    invoice: InvoiceEntity,
  ): Promise<void> {
    try {
      await manager.save(invoice);
    } catch (error) {
      if (isPostgresUniqueViolation(error, 'uq_invoice_laundry_order')) {
        throw new ConflictException(
          'An invoice already exists for this laundry order',
        );
      }
      // `uq_invoice_tenant_number` and anything else: an integrity failure,
      // never a business conflict — rethrow unchanged (spec §4.6).
      throw error;
    }
  }
}
