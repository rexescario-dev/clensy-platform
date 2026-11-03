import { Global, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AUDIT_LOGGER } from '../../../platform/audit/application/audit-logger.port';
import { AuditEventEntity } from '../../../platform/audit/infrastructure/persistence/audit-event.entity';
import { BillingModule } from '../../billing/billing.module';
import { InvoicePaymentWriter } from '../../billing/application/services/invoice-payment-writer';
import { InvoicesService } from '../../billing/application/services/invoices.service';
import { PaymentsService } from '../application/services/payments.service';
import { PaymentEntity } from '../infrastructure/persistence/payment.entity';
import { PaymentResolver } from '../presentation/graphql/payment.resolver';
import { PaymentsModule } from '../payments.module';

@Global()
@Module({
  exports: [DataSource],
  providers: [{ provide: DataSource, useValue: {} }],
})
class FakeGlobalDataSourceModule {}

// `BillingModule` is replaced by a fake exporting only what payments uses
// — the port and `InvoicesService` (`Payment.invoice`) — so this proves
// `PaymentsModule`'s own wiring (the `billing.module.di.spec.ts` precedent).
@Module({
  exports: [InvoicePaymentWriter, InvoicesService],
  providers: [
    { provide: InvoicePaymentWriter, useValue: {} },
    { provide: InvoicesService, useValue: {} },
  ],
})
class FakeBillingModule {}

describe('PaymentsModule — module-internal DI wiring', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [FakeGlobalDataSourceModule, PaymentsModule],
    })
      .overrideModule(BillingModule)
      .useModule(FakeBillingModule)
      .overrideProvider(getRepositoryToken(PaymentEntity))
      .useValue({ metadata: { columns: [] } })
      .overrideProvider(getRepositoryToken(AuditEventEntity))
      .useValue({ create: jest.fn(), save: jest.fn() })
      .compile();
  });

  it('resolves PaymentsService', () => {
    expect(moduleRef.get(PaymentsService)).toBeInstanceOf(PaymentsService);
  });

  // Request-scoped through `RefundableAmountLoader`, hence `resolve`.
  it('resolves PaymentResolver', async () => {
    await expect(moduleRef.resolve(PaymentResolver)).resolves.toBeInstanceOf(
      PaymentResolver,
    );
  });

  it('resolves AUDIT_LOGGER from the imported AuditModule', () => {
    expect(moduleRef.get(AUDIT_LOGGER)).toBeDefined();
  });

  it('imports BillingModule for the InvoicePaymentWriter port', () => {
    expect(
      Reflect.getMetadata('imports', PaymentsModule) as unknown[],
    ).toContain(BillingModule);
  });
});
