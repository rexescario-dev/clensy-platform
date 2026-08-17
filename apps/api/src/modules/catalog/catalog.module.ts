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
import { AddOnResolver } from './presentation/graphql/add-on.resolver';
import { PricingRuleResolver } from './presentation/graphql/pricing-rule.resolver';
import { ServiceResolver } from './presentation/graphql/service.resolver';

// Imports `AuditModule` directly (mirroring `cleaners.module.ts`'s precedent
// exactly) so `AUDIT_LOGGER` is DI-visible to `ServicesService`: Nest module
// encapsulation means a token exported by `AuditModule` is only visible to a
// module that itself imports `AuditModule`. `AuditModule` is not `@Global()`,
// so there is no ambient mechanism that makes this import optional.
//
// Task 1 registered `ServiceEntity`/`ServicesService`. Task 2 added
// `AddOnEntity`/`AddOnsService` alongside it — `AddOn` has no relationship to
// `Service` (fully independent, global add-ons). Task 3 extends this module
// further with `PricingRuleEntity`/`PricingRulesService` — unlike `AddOn`,
// `PricingRule` has a real FK relationship to `Service` (see
// `pricing-rule.entity.ts`). Task 4 adds the GraphQL presentation layer —
// three resolvers plus the request-scoped `ActivePricingLoader` — on top,
// with no changes to the application layer above.
@Module({
  imports: [
    TypeOrmModule.forFeature([ServiceEntity, AddOnEntity, PricingRuleEntity]),
    AuditModule,
  ],
  providers: [
    ServicesService,
    AddOnsService,
    PricingRulesService,
    ServiceResolver,
    AddOnResolver,
    PricingRuleResolver,
    ActivePricingLoader,
  ],
  exports: [ServicesService, AddOnsService, PricingRulesService],
})
export class CatalogModule {}
