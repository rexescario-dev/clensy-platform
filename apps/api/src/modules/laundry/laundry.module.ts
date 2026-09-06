import { NestjsQueryGraphQLModule } from '@ptc-org/nestjs-query-graphql';
import { NestjsQueryTypeOrmModule } from '@ptc-org/nestjs-query-typeorm';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../platform/audit/audit.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CustomersModule } from '../customers/customers.module';
import { LaundryOrdersService } from './application/services/laundry-orders.service';
import { LaundryOrderStatusTransitionPolicy } from './domain/laundry-order-status-transition-policy';
import { LaundryOrderEntity } from './infrastructure/persistence/laundry-order.entity';
import { LaundryOrderLineEntity } from './infrastructure/persistence/laundry-order-line.entity';
import { LaundryOrderReadResolver } from './presentation/graphql/laundry-order-read.resolver';
import { LaundryOrderResolver } from './presentation/graphql/laundry-order.resolver';
import { LaundryOrderType } from './presentation/graphql/laundry-order.type';
import { LaundryOrderLineType } from './presentation/graphql/laundry-order-line.type';

// `CustomerEntity`/`ServiceEntity`/`AddOnEntity` are deliberately NOT
// registered on any `forFeature` here — their owning modules stay their
// sole registrants (spec §4.1). `LaundryOrderLineEntity`/`LaundryOrderLineType`
// ARE registered so the nested `LaundryOrder.lines` offset connection
// resolves (the `ChecklistItemEntity`/`ChecklistItemType` precedent in
// `jobs.module.ts`).
@Module({
  imports: [
    TypeOrmModule.forFeature([LaundryOrderEntity, LaundryOrderLineEntity]),
    NestjsQueryTypeOrmModule.forFeature([
      LaundryOrderEntity,
      LaundryOrderLineEntity,
    ]),
    NestjsQueryGraphQLModule.forFeature({
      dtos: [
        { DTOClass: LaundryOrderType },
        { DTOClass: LaundryOrderLineType },
      ],
    }),
    AuditModule,
    CustomersModule,
    CatalogModule,
  ],
  providers: [
    LaundryOrdersService,
    LaundryOrderStatusTransitionPolicy,
    LaundryOrderReadResolver,
    LaundryOrderResolver,
  ],
  exports: [LaundryOrdersService],
})
export class LaundryModule {}
