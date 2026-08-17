import { UseGuards } from '@nestjs/common';
import {
  Args,
  ID,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { ServicesService } from '../../application/services/services.service';
import { CreateServiceCommand } from '../../application/commands/create-service.command';
import { UpdateServiceCommand } from '../../application/commands/update-service.command';
import { Service } from '../../domain/service';
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { ActivePricingLoader } from './active-pricing.loader';
import { CreateServiceInput } from './create-service.input';
import { toPricingRuleType, toServiceType } from './mappers';
import { PricingRuleType } from './pricing-rule.type';
import { ServiceType } from './service.type';
import { UpdateServiceInput } from './update-service.input';

// Exactly the `Service`-scoped operations of spec §4.5 — no others.
@Resolver(() => ServiceType)
export class ServiceResolver {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly loader: ActivePricingLoader,
  ) {}

  // View matrix (spec §4.3) — deliberately broader than the Cleaners
  // module's: all six roles, not just Owner/Ops Manager/Scheduler/Analyst.
  @Query(() => ServiceType, { name: 'service', nullable: true })
  @UseGuards(AuthGuard)
  @Roles(
    Role.OWNER,
    Role.OPS_MANAGER,
    Role.SCHEDULER,
    Role.CUSTOMER_SUPPORT,
    Role.FINANCE,
    Role.ANALYST,
  )
  async service(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ServiceType | null> {
    const service = await this.servicesService.getService(id);
    return service ? toServiceType(service) : null;
  }

  @Query(() => [ServiceType], { name: 'services' })
  @UseGuards(AuthGuard)
  @Roles(
    Role.OWNER,
    Role.OPS_MANAGER,
    Role.SCHEDULER,
    Role.CUSTOMER_SUPPORT,
    Role.FINANCE,
    Role.ANALYST,
  )
  async services(): Promise<ServiceType[]> {
    const services = await this.servicesService.listServices();
    return services.map(toServiceType);
  }

  @Mutation(() => ServiceType)
  @UseGuards(AuthGuard)
  @Roles(Role.OWNER, Role.OPS_MANAGER)
  async createService(
    @Args('input') input: CreateServiceInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<ServiceType> {
    // Object spread, never manual field-by-field listing (task brief).
    const command: CreateServiceCommand = {
      ...input,
      actorId: currentUser.id,
    };
    const service = await this.servicesService.createService(command);
    return toServiceType(service);
  }

  @Mutation(() => ServiceType)
  @UseGuards(AuthGuard)
  @Roles(Role.OWNER, Role.OPS_MANAGER)
  async updateService(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateServiceInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<ServiceType> {
    // Object spread (task brief) — `input` only carries keys the caller
    // actually provided, so an omitted field retains its current value.
    const command: UpdateServiceCommand = {
      ...input,
      actorId: currentUser.id,
    };
    const service = await this.servicesService.updateService(id, command);
    return toServiceType(service);
  }

  // Presentation-layer-only computed field (spec §4.5), batched via
  // `ActivePricingLoader` (request-scoped, constructor-injected — not
  // `@Context()`) to avoid one query per parent row. No separate
  // `@UseGuards`/`@Roles()`: reachable only after the guarded parent query
  // already succeeded, the same precedent `Cleaner.team`/`Team.cleaners`
  // established.
  @ResolveField(() => PricingRuleType, { nullable: true })
  async activePricing(
    @Parent() service: Pick<Service, 'id'>,
  ): Promise<PricingRuleType | null> {
    const rule = await this.loader.loader.load(service.id);
    return rule ? toPricingRuleType(rule) : null;
  }
}
