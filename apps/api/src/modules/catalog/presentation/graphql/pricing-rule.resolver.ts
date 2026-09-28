import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PricingRulesService } from '../../application/services/pricing-rules.service';
import { CreatePricingRuleCommand } from '../../application/commands/create-pricing-rule.command';
import { requireTenantId } from '../../../../platform/auth/authorization/require-tenant-id';
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CreatePricingRuleInput } from './create-pricing-rule.input';
import { toPricingRuleType } from './mappers';
import { PricingRuleType } from './pricing-rule.type';

// Exactly the `PricingRule`-scoped operations of spec §4.5 — no others.
// `activePricing(serviceId)` here is the standalone, existence-checked,
// single-key query path — it calls `PricingRulesService.getActivePricing`
// DIRECTLY, never through `ActivePricingLoader` (that loader exists solely
// for `ServiceResolver.activePricing`'s batched `@ResolveField` path; spec
// §3's reconciliation note — the two are separate code paths for separate
// reasons, not meant to be unified). The tenant comes only from the
// principal (#84): the read passes it through and the service fails closed
// (NotFound) on `null`; the write requires it. `PricingRuleType` is not a
// nestjs-query DTO (#84 slice decision 8) — it has no `@Authorize` of its
// own; its only read paths are this query and `Service.activePricing`, both
// tenant-scoped.
@Resolver(() => PricingRuleType)
export class PricingRuleResolver {
  constructor(private readonly pricingRulesService: PricingRulesService) {}

  // View matrix (spec §4.3) — deliberately broader than the Cleaners
  // module's: all six roles, not just Owner/Ops Manager/Scheduler/Analyst.
  @Query(() => PricingRuleType, { name: 'activePricing', nullable: true })
  @UseGuards(AuthGuard)
  @Roles(
    Role.TENANT_OWNER,
    Role.OPS_MANAGER,
    Role.SCHEDULER,
    Role.CUSTOMER_SUPPORT,
    Role.FINANCE,
    Role.ANALYST,
  )
  async activePricing(
    @Args('serviceId', { type: () => ID }) serviceId: string,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<PricingRuleType | null> {
    const rule = await this.pricingRulesService.getActivePricing(
      serviceId,
      currentUser.tenantId,
    );
    return rule ? toPricingRuleType(rule) : null;
  }

  @Mutation(() => PricingRuleType)
  @UseGuards(AuthGuard)
  @Roles(Role.TENANT_OWNER, Role.OPS_MANAGER)
  async createPricingRule(
    @Args('input') input: CreatePricingRuleInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<PricingRuleType> {
    const command: CreatePricingRuleCommand = {
      ...input,
      actorId: currentUser.id,
      tenantId: requireTenantId(currentUser),
    };
    const rule = await this.pricingRulesService.createPricingRule(command);
    return toPricingRuleType(rule);
  }
}
