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
import { InvoiceLineEntity } from '../../infrastructure/persistence/invoice-line.entity';
import { GenerateInvoiceFromOrderCommand } from '../commands/generate-invoice-from-order.command';
import { isPostgresUniqueViolation } from './unique-violation';

const ENTITY_TYPE = 'invoice';
const NUMBER_SEQUENCE = 'billing_invoice_number_seq';

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
    @InjectRepository(InvoiceLineEntity)
    private readonly invoiceLineRepository: Repository<InvoiceLineEntity>,
    private readonly laundryOrdersService: LaundryOrdersService,
    private readonly servicesService: ServicesService,
    private readonly addOnsService: AddOnsService,
    @Inject(AUDIT_LOGGER) private readonly auditLogger: AuditLogger,
  ) {}

  getInvoice(id: string): Promise<Invoice | null> {
    return this.invoiceRepository.findOneBy({ id });
  }

  // The one-time generation of an immutable invoice from a priced laundry
  // order (spec §4.3, §4.4, §4.6). All eligibility and catalog-resolution
  // checks run BEFORE the write transaction; `uq_invoice_laundry_order` —
  // not the pre-check — is the concurrency correctness mechanism.
  async generateFromOrder(
    command: GenerateInvoiceFromOrderCommand,
  ): Promise<Invoice> {
    const issueDate = new Date();

    const order = await this.laundryOrdersService.getOrderForInvoicing(
      command.laundryOrderId,
    );
    if (!order) {
      throw new NotFoundException(
        `Laundry order ${command.laundryOrderId} not found`,
      );
    }
    this.assertEligible(order);

    const existing = await this.invoiceRepository.findOneBy({
      laundryOrderId: command.laundryOrderId,
    });
    if (existing) {
      throw new ConflictException(
        'An invoice already exists for this laundry order',
      );
    }

    const linePayloads = await this.buildLinePayloads(order.lines);
    const { subtotalMinorUnits, totalMinorUnits } = computeInvoiceTotals({
      lineAmountsMinorUnits: linePayloads.map((l) => l.amountMinorUnits),
      discountMinorUnits: 0,
    });
    const dueDate =
      command.paymentTerms === InvoicePaymentTerms.PAY_NOW ? issueDate : null;

    return this.dataSource.transaction((manager) =>
      runAuditInTransaction(manager, async () => {
        const raced = await manager.findOneBy(InvoiceEntity, {
          laundryOrderId: command.laundryOrderId,
        });
        if (raced) {
          throw new ConflictException(
            'An invoice already exists for this laundry order',
          );
        }

        const rows: Array<{ n: string }> = await manager.query(
          `SELECT nextval('${NUMBER_SEQUENCE}') AS n`,
        );
        const invoiceNumber = formatInvoiceNumber(
          Number(rows[0].n),
          resolveManilaYear(issueDate),
        );

        const invoice = manager.create(InvoiceEntity, {
          invoiceNumber,
          laundryOrderId: order.id,
          customerId: order.customerId,
          subtotalMinorUnits,
          discountMinorUnits: 0,
          totalMinorUnits,
          amountPaidMinorUnits: 0,
          paymentStatus: InvoicePaymentStatus.UNPAID,
          paymentTerms: command.paymentTerms,
          issueDate,
          dueDate,
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
          action: 'invoice.generated',
          entityType: ENTITY_TYPE,
          entityId: invoice.id,
        });

        return manager.findOneByOrFail(InvoiceEntity, { id: invoice.id });
      }),
    );
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

  private async buildLinePayloads(lines: OrderForInvoicingLine[]): Promise<
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

    const [services, addOns] = await Promise.all([
      this.servicesService.getServicesByIds(serviceIds),
      this.addOnsService.getAddOnsByIds(addOnIds),
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
      return { description, quantity, unit, rateMinorUnits, amountMinorUnits };
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
      // `uq_invoice_number` and anything else: an integrity failure, never
      // a business conflict — rethrow unchanged (spec §4.6).
      throw error;
    }
  }
}
