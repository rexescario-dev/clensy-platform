import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditEventEntity } from '../src/platform/audit/infrastructure/persistence/audit-event.entity';
import { AddOnsService } from '../src/modules/catalog/application/services/add-ons.service';
import { PricingRulesService } from '../src/modules/catalog/application/services/pricing-rules.service';
import { ServicesService } from '../src/modules/catalog/application/services/services.service';
import { PricingUnit } from '../src/modules/catalog/domain/pricing-unit';
import { AddOnEntity } from '../src/modules/catalog/infrastructure/persistence/add-on.entity';
import { PricingRuleEntity } from '../src/modules/catalog/infrastructure/persistence/pricing-rule.entity';
import { ServiceEntity } from '../src/modules/catalog/infrastructure/persistence/service.entity';
import { CustomersService } from '../src/modules/customers/application/services/customers.service';
import { CustomerEntity } from '../src/modules/customers/infrastructure/persistence/customer.entity';
import { PropertyEntity } from '../src/modules/customers/infrastructure/persistence/property.entity';
import { BookingEntity } from '../src/modules/bookings/infrastructure/persistence/booking.entity';
import { TeamEntity } from '../src/modules/cleaners/infrastructure/persistence/team.entity';
import { CleanerEntity } from '../src/modules/cleaners/infrastructure/persistence/cleaner.entity';
import { LaundryOrdersService } from '../src/modules/laundry/application/services/laundry-orders.service';
import { LaundryFulfillmentType } from '../src/modules/laundry/domain/laundry-fulfillment-type';
import { LaundryOrderStatusTransitionPolicy } from '../src/modules/laundry/domain/laundry-order-status-transition-policy';
import { LaundryOrderEntity } from '../src/modules/laundry/infrastructure/persistence/laundry-order.entity';
import { LaundryOrderLineEntity } from '../src/modules/laundry/infrastructure/persistence/laundry-order-line.entity';
import { InvoicesService } from '../src/modules/billing/application/services/invoices.service';
import { InvoicePaymentTerms } from '../src/modules/billing/domain/invoice-payment-terms';
import { InvoiceEntity } from '../src/modules/billing/infrastructure/persistence/invoice.entity';
import { InvoiceLineEntity } from '../src/modules/billing/infrastructure/persistence/invoice-line.entity';
import {
  acquireBillingDbTestLock,
  BillingDbTestLock,
} from './helpers/billing-db-test-lock';

const ENTITIES = [
  InvoiceEntity,
  InvoiceLineEntity,
  LaundryOrderEntity,
  LaundryOrderLineEntity,
  CustomerEntity,
  PropertyEntity,
  BookingEntity,
  ServiceEntity,
  AddOnEntity,
  PricingRuleEntity,
  TeamEntity,
  CleanerEntity,
  AuditEventEntity,
];

const makeDataSource = () =>
  new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'clensy',
    password: process.env.DB_PASSWORD ?? 'clensy_dev',
    database: process.env.DB_NAME ?? 'clensy',
    entities: ENTITIES,
  });

const TRUNCATE =
  'TRUNCATE TABLE "invoice_line_entity", "invoice_entity", "laundry_order_line_entity", "laundry_order_entity", "booking_entity", "pricing_rule_entity", "add_on_entity", "service_entity", "customer_entity", "property_entity", "team_entity", "audit_event_entity" CASCADE';

interface AuditLoggerMock {
  log: jest.Mock;
}

function buildInvoicesService(
  ds: DataSource,
  auditLogger: AuditLoggerMock,
): InvoicesService {
  const customers = new CustomersService(
    ds,
    ds.getRepository(CustomerEntity),
    auditLogger,
  );
  const services = new ServicesService(
    ds,
    ds.getRepository(ServiceEntity),
    auditLogger,
  );
  const addOns = new AddOnsService(
    ds,
    ds.getRepository(AddOnEntity),
    auditLogger,
  );
  const pricing = new PricingRulesService(
    ds,
    ds.getRepository(PricingRuleEntity),
    ds.getRepository(ServiceEntity),
    auditLogger,
  );
  const laundry = new LaundryOrdersService(
    ds,
    ds.getRepository(LaundryOrderEntity),
    ds.getRepository(LaundryOrderLineEntity),
    new LaundryOrderStatusTransitionPolicy(),
    customers,
    pricing,
    auditLogger,
  );
  return new InvoicesService(
    ds,
    ds.getRepository(InvoiceEntity),
    ds.getRepository(InvoiceLineEntity),
    laundry,
    services,
    addOns,
    auditLogger,
  );
}

describe('InvoicesService (real Postgres) — concurrent generation', () => {
  let dsA: DataSource;
  let dsB: DataSource;
  let dbLock: BillingDbTestLock;
  let auditA: AuditLoggerMock;
  let auditB: AuditLoggerMock;

  beforeAll(async () => {
    dsA = makeDataSource();
    dsB = makeDataSource();
    await dsA.initialize();
    await dsB.initialize();
    dbLock = await acquireBillingDbTestLock(dsA);
  });

  afterAll(async () => {
    await dbLock.release();
    await dsA.destroy();
    await dsB.destroy();
  });

  beforeEach(async () => {
    await dsA.query(TRUNCATE);
    auditA = { log: jest.fn().mockResolvedValue(undefined) };
    auditB = { log: jest.fn().mockResolvedValue(undefined) };
  });

  async function pricedOrderId(ds: DataSource): Promise<string> {
    const audit: AuditLoggerMock = {
      log: jest.fn().mockResolvedValue(undefined),
    };
    const customers = new CustomersService(
      ds,
      ds.getRepository(CustomerEntity),
      audit,
    );
    const services = new ServicesService(
      ds,
      ds.getRepository(ServiceEntity),
      audit,
    );
    const pricing = new PricingRulesService(
      ds,
      ds.getRepository(PricingRuleEntity),
      ds.getRepository(ServiceEntity),
      audit,
    );
    const laundry = new LaundryOrdersService(
      ds,
      ds.getRepository(LaundryOrderEntity),
      ds.getRepository(LaundryOrderLineEntity),
      new LaundryOrderStatusTransitionPolicy(),
      customers,
      pricing,
      audit,
    );

    const stamp = `${Date.now()}-${Math.random()}`;
    const customer = await customers.create({
      actorId: 'a',
      fullName: 'Race Jane',
      email: `race-${stamp}@example.com`,
      phone: '555-0',
    });
    const service = await services.createService({
      actorId: 'a',
      name: `Race Svc ${stamp}`,
      durationMinutes: 1,
    });
    await pricing.createPricingRule({
      actorId: 'a',
      serviceId: service.id,
      priceMinorUnits: 1000,
      unit: PricingUnit.PER_KG,
    });
    const order = await laundry.receive({
      actorId: 'a',
      customerId: customer.id,
      fulfillmentType: LaundryFulfillmentType.PICKUP,
    });
    await laundry.weigh({ actorId: 'a', orderId: order.id, weightGrams: 2000 });
    await laundry.price({
      actorId: 'a',
      orderId: order.id,
      baseServiceId: service.id,
      addOns: [],
    });
    return order.id;
  }

  it('two concurrent generateFromOrder calls: exactly one invoice, one conflict, no orphan rows', async () => {
    const orderId = await pricedOrderId(dsA);
    const a = buildInvoicesService(dsA, auditA);
    const b = buildInvoicesService(dsB, auditB);

    const cmd = {
      laundryOrderId: orderId,
      paymentTerms: InvoicePaymentTerms.PAY_NOW,
    };
    const [ra, rb] = await Promise.allSettled([
      a.generateFromOrder({ ...cmd, actorId: 'actor-a' }),
      b.generateFromOrder({ ...cmd, actorId: 'actor-b' }),
    ]);

    const outcomes = [ra, rb];
    const fulfilled = outcomes.filter((r) => r.status === 'fulfilled');
    const rejected = outcomes.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toBeInstanceOf(ConflictException);

    const invoices = await dsA.getRepository(InvoiceEntity).find();
    expect(invoices).toHaveLength(1);
    expect(invoices[0].invoiceNumber).toMatch(/^INV-\d{4}-\d{6,}$/);

    // no orphan lines from the failed attempt: every line belongs to the
    // one surviving invoice (the loser rolls back before inserting lines)
    const lines = await dsA.getRepository(InvoiceLineEntity).find();
    expect(lines.every((l) => l.invoiceId === invoices[0].id)).toBe(true);

    // exactly one `invoice.generated` across both connections' audit
    // loggers — the loser throws at the unique-constraint insert, before
    // ever reaching the audit call
    const genCalls = [
      ...(auditA.log.mock.calls as Array<[{ action: string }]>),
      ...(auditB.log.mock.calls as Array<[{ action: string }]>),
    ].filter(([e]) => e.action === 'invoice.generated');
    expect(genCalls).toHaveLength(1);

    // the losing attempt's drawn sequence value is burned — the test does
    // not assert contiguity, only that the surviving number is well-formed
  });
});
