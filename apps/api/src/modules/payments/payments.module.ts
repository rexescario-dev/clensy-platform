import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PaymentEntity } from './infrastructure/persistence/payment.entity';

// `modules/payments` (#39 spec §4.1). Skeletal at this point: it only
// registers `PaymentEntity`. `InvoiceEntity.payments` makes `PaymentEntity`
// mandatory wherever `InvoiceEntity` is registered, and `autoLoadEntities`
// (`database.module.ts`) picks it up from this `forFeature`, which keeps
// `AppModule` bootable. The application service and GraphQL surface follow.
@Module({
  imports: [TypeOrmModule.forFeature([PaymentEntity])],
})
export class PaymentsModule {}
