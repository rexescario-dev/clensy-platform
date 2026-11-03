import { NestjsQueryGraphQLModule } from '@ptc-org/nestjs-query-graphql';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../platform/audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { PaymentsService } from './application/services/payments.service';
import { PaymentEntity } from './infrastructure/persistence/payment.entity';
import { PaymentResolver } from './presentation/graphql/payment.resolver';
import { PaymentObjectType } from './presentation/graphql/payment.type';
import { RefundableAmountLoader } from './presentation/graphql/refundable-amount.loader';

// `modules/payments` (#39 spec §4.1). `InvoiceEntity.payments` makes
// `PaymentEntity` mandatory wherever `InvoiceEntity` is registered, and
// `autoLoadEntities` (`database.module.ts`) picks it up from this
// `forFeature`, which keeps `AppModule` bootable.
//
// Imports `BillingModule` for its exported `InvoicePaymentWriter` port —
// billing stays the sole writer of `invoice_entity` — and `InvoicesService`
// (the `Payment.invoice` read), and `AuditModule` for `AUDIT_LOGGER`.
// `BillingModule` does not import this module (planning decision l).
//
// GraphQL (spec §4.7): `PaymentObjectType` is registered with
// nestjs-query only for its `@Authorize` tenant-read authorizer, which the
// `Invoice.payments` nested connection resolves by token (decision l). It
// gets no read resolver and no root query (decision e).
@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity]),
    NestjsQueryGraphQLModule.forFeature({
      dtos: [{ DTOClass: PaymentObjectType }],
    }),
    AuditModule,
    BillingModule,
  ],
  providers: [PaymentsService, PaymentResolver, RefundableAmountLoader],
})
export class PaymentsModule {}
