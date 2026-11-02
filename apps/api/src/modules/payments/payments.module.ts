import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../platform/audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { PaymentsService } from './application/services/payments.service';
import { PaymentEntity } from './infrastructure/persistence/payment.entity';

// `modules/payments` (#39 spec §4.1). `InvoiceEntity.payments` makes
// `PaymentEntity` mandatory wherever `InvoiceEntity` is registered, and
// `autoLoadEntities` (`database.module.ts`) picks it up from this
// `forFeature`, which keeps `AppModule` bootable.
//
// Imports `BillingModule` for its exported `InvoicePaymentWriter` port only
// — billing stays the sole writer of `invoice_entity` — and `AuditModule`
// for `AUDIT_LOGGER`. `BillingModule` does not import this module
// (planning decision l). The GraphQL surface follows.
@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity]),
    AuditModule,
    BillingModule,
  ],
  providers: [PaymentsService],
})
export class PaymentsModule {}
