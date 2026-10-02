import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { AdminUserEntity } from '../../src/modules/admins/infrastructure/persistence/admin-user.entity';
import { InvoicePaymentStatus } from '../../src/modules/billing/domain/invoice-payment-status';
import { InvoicePaymentTerms } from '../../src/modules/billing/domain/invoice-payment-terms';
import { InvoiceLineEntity } from '../../src/modules/billing/infrastructure/persistence/invoice-line.entity';
import { InvoiceEntity } from '../../src/modules/billing/infrastructure/persistence/invoice.entity';
import { BookingStatus } from '../../src/modules/bookings/domain/booking-status';
import { BookingEntity } from '../../src/modules/bookings/infrastructure/persistence/booking.entity';
import { PricingUnit } from '../../src/modules/catalog/domain/pricing-unit';
import { AddOnEntity } from '../../src/modules/catalog/infrastructure/persistence/add-on.entity';
import { PricingRuleEntity } from '../../src/modules/catalog/infrastructure/persistence/pricing-rule.entity';
import { ServiceEntity } from '../../src/modules/catalog/infrastructure/persistence/service.entity';
import { CleanerEntity } from '../../src/modules/cleaners/infrastructure/persistence/cleaner.entity';
import { TeamEntity } from '../../src/modules/cleaners/infrastructure/persistence/team.entity';
import { CustomerEntity } from '../../src/modules/customers/infrastructure/persistence/customer.entity';
import { PropertyEntity } from '../../src/modules/customers/infrastructure/persistence/property.entity';
import { JobStatus } from '../../src/modules/jobs/domain/job-status';
import { ChecklistItemEntity } from '../../src/modules/jobs/infrastructure/persistence/checklist-item.entity';
import { ChecklistEntity } from '../../src/modules/jobs/infrastructure/persistence/checklist.entity';
import { CleaningJobEntity } from '../../src/modules/jobs/infrastructure/persistence/cleaning-job.entity';
import { LaundryFulfillmentType } from '../../src/modules/laundry/domain/laundry-fulfillment-type';
import { LaundryOrderStatus } from '../../src/modules/laundry/domain/laundry-order-status';
import { LaundryOrderLineEntity } from '../../src/modules/laundry/infrastructure/persistence/laundry-order-line.entity';
import { LaundryOrderEntity } from '../../src/modules/laundry/infrastructure/persistence/laundry-order.entity';
import { Role } from '../../src/platform/auth/domain/role';
import {
  createTestTenant,
  removeTestTenants,
  SeededAdmin,
  seedSuperAdmin,
  seedTenantAdmin,
} from '../helpers/seed-tenant-admin';
import type { GateClient } from './client';
import { TENANT_ROLES } from './role-matrix';

// #92 two-tenant world (decision 7). Every row is inserted with TypeORM
// repositories — never through the GraphQL/REST surface under test — so the
// gate's setup cannot depend on the code it checks. `Fixtures` is also what
// probes' `prepare` hooks use to create fresh, disposable targets.
const PAST = new Date('2020-01-01T00:00:00.000Z');
const UNPRICED = new Set([
  LaundryOrderStatus.RECEIVED,
  LaundryOrderStatus.WEIGHED,
]);

export interface TenantWorld {
  addOnId: string;
  adminIds: string[];
  bookingId: string;
  cleanerId: string;
  cookies: Readonly<Record<Role, string>>;
  customerId: string;
  invoiceId: string;
  jobId: string;
  jobItemIds: string[];
  laundryOrderId: string;
  name: 'A' | 'B';
  pricingRuleId: string;
  principals: Readonly<Record<Role, SeededAdmin>>;
  propertyId: string;
  serviceId: string;
  teamId: string;
  tenantId: string;
}

export interface GateWorld {
  a: TenantWorld;
  b: TenantWorld;
  fixtures: Fixtures;
  run: string;
  superAdmin: SeededAdmin;
  superAdminCookie: string;
}

export class Fixtures {
  private sequence = 0;

  constructor(
    private readonly dataSource: DataSource,
    private readonly run: string,
  ) {}

  private label(): string {
    this.sequence += 1;
    return `${this.run}-${this.sequence}`;
  }

  private future(): Date {
    return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  }

  async customer(tenantId: string): Promise<string> {
    const repository = this.dataSource.getRepository(CustomerEntity);
    const label = this.label();
    const row = await repository.save(
      repository.create({
        tenantId,
        email: `gate-${label}@example.com`,
        fullName: `Gate Customer ${label}`,
        notes: null,
        phone: '555-0100',
      }),
    );
    return row.id;
  }

  async property(tenantId: string, customerId: string): Promise<string> {
    const repository = this.dataSource.getRepository(PropertyEntity);
    const row = await repository.save(
      repository.create({
        customerId,
        tenantId,
        accessNotes: null,
        addressLine1: '1 Gate Street',
        addressLine2: null,
        city: 'Gate City',
        label: `Gate Property ${this.label()}`,
        postalCode: '00000',
        region: 'GC',
      }),
    );
    return row.id;
  }

  async service(
    tenantId: string,
    options: { priced?: boolean } = {},
  ): Promise<{ pricingRuleId: string | null; serviceId: string }> {
    const services = this.dataSource.getRepository(ServiceEntity);
    const service = await services.save(
      services.create({
        tenantId,
        active: true,
        description: null,
        durationMinutes: 60,
        name: `Gate Service ${this.label()}`,
      }),
    );
    if (options.priced === false)
      return { pricingRuleId: null, serviceId: service.id };
    const rules = this.dataSource.getRepository(PricingRuleEntity);
    const rule = await rules.save(
      rules.create({
        addOnId: null,
        serviceId: service.id,
        tenantId,
        active: true,
        effectiveFrom: PAST,
        effectiveTo: null,
        minimumChargeMinorUnits: null,
        priceMinorUnits: 1000,
        unit: PricingUnit.PER_KG,
      }),
    );
    return { pricingRuleId: rule.id, serviceId: service.id };
  }

  async addOn(
    tenantId: string,
    options: { priced?: boolean } = {},
  ): Promise<string> {
    const addOns = this.dataSource.getRepository(AddOnEntity);
    const addOn = await addOns.save(
      addOns.create({
        tenantId,
        active: true,
        description: null,
        name: `Gate Add-on ${this.label()}`,
        priceMinorUnits: 300,
      }),
    );
    if (options.priced !== false) {
      const rules = this.dataSource.getRepository(PricingRuleEntity);
      await rules.save(
        rules.create({
          addOnId: addOn.id,
          serviceId: null,
          tenantId,
          active: true,
          effectiveFrom: PAST,
          effectiveTo: null,
          minimumChargeMinorUnits: null,
          priceMinorUnits: 300,
          unit: PricingUnit.FLAT,
        }),
      );
    }
    return addOn.id;
  }

  async team(tenantId: string): Promise<string> {
    const repository = this.dataSource.getRepository(TeamEntity);
    return (
      await repository.save(
        repository.create({ name: `Gate Team ${this.label()}`, tenantId }),
      )
    ).id;
  }

  async cleaner(tenantId: string, teamId: string): Promise<string> {
    const repository = this.dataSource.getRepository(CleanerEntity);
    const label = this.label();
    const row = await repository.save(
      repository.create({
        teamId,
        tenantId,
        email: `gate-cleaner-${label}@example.com`,
        fullName: `Gate Cleaner ${label}`,
        notes: null,
        phone: '555-0101',
      }),
    );
    return row.id;
  }

  async booking(world: TenantWorld): Promise<string> {
    const repository = this.dataSource.getRepository(BookingEntity);
    const row = await repository.save(
      repository.create({
        customerId: world.customerId,
        propertyId: world.propertyId,
        serviceId: world.serviceId,
        teamId: world.teamId,
        tenantId: world.tenantId,
        pricingSnapshot: { priceMinorUnits: 1000 },
        scheduledAt: this.future(),
        status: BookingStatus.PENDING,
      }),
    );
    return row.id;
  }

  async job(
    world: TenantWorld,
    options: { itemsCompleted: boolean },
  ): Promise<{ itemIds: string[]; jobId: string }> {
    const bookingId = await this.booking(world);
    const jobs = this.dataSource.getRepository(CleaningJobEntity);
    const job = await jobs.save(
      jobs.create({
        bookingId,
        teamId: world.teamId,
        tenantId: world.tenantId,
        scheduledAt: this.future(),
        status: JobStatus.PENDING,
      }),
    );
    const checklists = this.dataSource.getRepository(ChecklistEntity);
    const checklist = await checklists.save(
      checklists.create({ jobId: job.id, tenantId: world.tenantId }),
    );
    const items = this.dataSource.getRepository(ChecklistItemEntity);
    const itemIds: string[] = [];
    for (const position of [1, 2, 3]) {
      const item = await items.save(
        items.create({
          checklistId: checklist.id,
          completed: options.itemsCompleted,
          completedAt: options.itemsCompleted ? new Date() : null,
          label: `Gate item ${position}`,
          position,
        }),
      );
      itemIds.push(item.id);
    }
    return { itemIds, jobId: job.id };
  }

  async laundryOrder(
    world: TenantWorld,
    status: LaundryOrderStatus,
    fulfillmentType: LaundryFulfillmentType = LaundryFulfillmentType.PICKUP,
  ): Promise<string> {
    const priced = !UNPRICED.has(status);
    const orders = this.dataSource.getRepository(LaundryOrderEntity);
    const order = await orders.save(
      orders.create({
        customerId: world.customerId,
        tenantId: world.tenantId,
        fulfillmentType,
        status,
        totalMinorUnits: priced ? 2000 : null,
        weightGrams: status === LaundryOrderStatus.RECEIVED ? null : 2000,
      }),
    );
    if (priced) {
      const lines = this.dataSource.getRepository(LaundryOrderLineEntity);
      await lines.save(
        lines.create({
          addOnId: null,
          laundryOrderId: order.id,
          serviceId: world.serviceId,
          tenantId: world.tenantId,
          pricingSnapshot: {
            pricingRuleId: world.pricingRuleId,
            amountMinorUnits: 2000,
            minimumChargeApplied: false,
            minimumChargeMinorUnits: null,
            quantity: 2,
            rateMinorUnits: 1000,
            unit: PricingUnit.PER_KG,
          },
        }),
      );
    }
    return order.id;
  }

  async invoice(world: TenantWorld): Promise<string> {
    const laundryOrderId = await this.laundryOrder(
      world,
      LaundryOrderStatus.PRICED,
    );
    const invoices = this.dataSource.getRepository(InvoiceEntity);
    const invoice = await invoices.save(
      invoices.create({
        customerId: world.customerId,
        laundryOrderId,
        tenantId: world.tenantId,
        amountPaidMinorUnits: 0,
        discountMinorUnits: 0,
        dueDate: null,
        invoiceNumber: `GATE-${this.label()}`,
        issueDate: new Date(),
        paymentStatus: InvoicePaymentStatus.UNPAID,
        paymentTerms: InvoicePaymentTerms.PAY_NOW,
        subtotalMinorUnits: 2000,
        totalMinorUnits: 2000,
      }),
    );
    const lines = this.dataSource.getRepository(InvoiceLineEntity);
    await lines.save(
      lines.create({
        invoiceId: invoice.id,
        amountMinorUnits: 2000,
        description: 'Gate line',
        quantity: 2,
        rateMinorUnits: 1000,
        unit: PricingUnit.PER_KG,
      }),
    );
    return invoice.id;
  }

  async staffAdmin(tenantId: string): Promise<string> {
    return (await seedTenantAdmin(this.dataSource, Role.SCHEDULER, tenantId))
      .id;
  }
}

async function buildTenantWorld(
  name: 'A' | 'B',
  dataSource: DataSource,
  fixtures: Fixtures,
  client: GateClient,
): Promise<TenantWorld> {
  const tenantId = await createTestTenant(dataSource);
  const principals = {} as Record<Role, SeededAdmin>;
  const cookies = {} as Record<Role, string>;
  for (const role of TENANT_ROLES) {
    principals[role] = await seedTenantAdmin(
      dataSource,
      role as Exclude<Role, Role.SUPER_ADMIN>,
      tenantId,
    );
    cookies[role] = await client.login(
      principals[role].email,
      principals[role].password,
    );
  }
  const customerId = await fixtures.customer(tenantId);
  const propertyId = await fixtures.property(tenantId, customerId);
  const { pricingRuleId, serviceId } = await fixtures.service(tenantId);
  const addOnId = await fixtures.addOn(tenantId);
  const teamId = await fixtures.team(tenantId);
  const cleanerId = await fixtures.cleaner(tenantId, teamId);
  const partial = {
    addOnId,
    bookingId: '',
    cleanerId,
    customerId,
    invoiceId: '',
    jobId: '',
    laundryOrderId: '',
    pricingRuleId: pricingRuleId as string,
    propertyId,
    serviceId,
    teamId,
    tenantId,
    adminIds: Object.values(principals).map((p) => p.id),
    cookies,
    jobItemIds: [] as string[],
    name,
    principals,
  };
  partial.bookingId = await fixtures.booking(partial);
  const job = await fixtures.job(partial, { itemsCompleted: false });
  partial.jobId = job.jobId;
  partial.jobItemIds = job.itemIds;
  partial.laundryOrderId = await fixtures.laundryOrder(
    partial,
    LaundryOrderStatus.RECEIVED,
  );
  partial.invoiceId = await fixtures.invoice(partial);
  return partial;
}

export async function buildGateWorld(
  dataSource: DataSource,
  client: GateClient,
): Promise<GateWorld> {
  const run = randomUUID();
  const fixtures = new Fixtures(dataSource, run);
  const a = await buildTenantWorld('A', dataSource, fixtures, client);
  const b = await buildTenantWorld('B', dataSource, fixtures, client);
  const superAdmin = await seedSuperAdmin(dataSource);
  const superAdminCookie = await client.login(
    superAdmin.email,
    superAdmin.password,
  );
  return { a, b, fixtures, run, superAdmin, superAdminCookie };
}

// Audit rows of every seeded principal (logins, role-phase writes), then
// both tenants (removeTestTenants deletes admins created by createAdmin
// probes with them), then the Super Admin.
export async function destroyGateWorld(
  dataSource: DataSource,
  world: GateWorld | undefined,
): Promise<void> {
  if (!world) return;
  const actorIds = [
    ...world.a.adminIds,
    ...world.b.adminIds,
    world.superAdmin.id,
  ];
  const tenantIds = [world.a.tenantId, world.b.tenantId];
  await dataSource.query(
    `DELETE FROM "audit_event_entity" WHERE "actorId" = ANY($1) OR "tenantId" = ANY($2)`,
    [actorIds, tenantIds],
  );
  await removeTestTenants(dataSource, tenantIds);
  await dataSource
    .getRepository(AdminUserEntity)
    .delete({ id: world.superAdmin.id });
}
