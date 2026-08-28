import { NestjsQueryGraphQLModule } from '@ptc-org/nestjs-query-graphql';
import { NestjsQueryTypeOrmModule } from '@ptc-org/nestjs-query-typeorm';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../../platform/audit/audit.module';
import { AddOnsService } from './application/services/add-ons.service';
import { PricingRulesService } from './application/services/pricing-rules.service';
import { ServicesService } from './application/services/services.service';
import { AddOnEntity } from './infrastructure/persistence/add-on.entity';
import { PricingRuleEntity } from './infrastructure/persistence/pricing-rule.entity';
import { ServiceEntity } from './infrastructure/persistence/service.entity';
import { ActivePricingLoader } from './presentation/graphql/active-pricing.loader';
import { AddOnReadResolver } from './presentation/graphql/add-on-read.resolver';
import { AddOnResolver } from './presentation/graphql/add-on.resolver';
import { AddOnType } from './presentation/graphql/add-on.type';
import { PricingRuleResolver } from './presentation/graphql/pricing-rule.resolver';
import { ServiceReadResolver } from './presentation/graphql/service-read.resolver';
import { ServiceResolver } from './presentation/graphql/service.resolver';
import { ServiceType } from './presentation/graphql/service.type';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServiceEntity, AddOnEntity, PricingRuleEntity]),
    NestjsQueryTypeOrmModule.forFeature([ServiceEntity, AddOnEntity]),
    NestjsQueryGraphQLModule.forFeature({
      dtos: [{ DTOClass: ServiceType }, { DTOClass: AddOnType }],
    }),
    AuditModule,
  ],
  providers: [
    ServicesService,
    AddOnsService,
    PricingRulesService,
    ServiceResolver,
    ServiceReadResolver,
    AddOnResolver,
    AddOnReadResolver,
    PricingRuleResolver,
    ActivePricingLoader,
  ],
  exports: [ServicesService, AddOnsService, PricingRulesService],
})
export class CatalogModule {}
