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
import { Cleaner } from '../../domain/cleaner';
import { CleanersService } from '../../application/services/cleaners.service';
import { AssignCleanerToTeamCommand } from '../../application/commands/assign-cleaner-to-team.command';
import { CreateCleanerCommand } from '../../application/commands/create-cleaner.command';
import { UpdateCleanerCommand } from '../../application/commands/update-cleaner.command';
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import { requireTenantId } from '../../../../platform/auth/authorization/require-tenant-id';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CleanerTeamLoaders } from './cleaner-team.loaders';
import { CleanerType, VIEW_ROLES } from './cleaner.type';
import { CreateCleanerInput } from './create-cleaner.input';
import { toCleanerType, toTeamType } from './mappers';
import { TeamType } from './team.type';
import { UpdateCleanerInput } from './update-cleaner.input';

// Clensy nullable get-by-id, writes, and `team` object field. Root
// `cleaners` is ReadResolver-owned (tenant-scoped by `CleanerType`'s
// `@Authorize`). The tenant comes only from the principal (#83): reads pass
// it through and the service/loader fail closed on `null`; writes require
// it. A command's `tenantId` is set after `...input` so no input key can
// override it.
@Resolver(() => CleanerType)
export class CleanerResolver {
  constructor(
    private readonly cleanersService: CleanersService,
    private readonly loaders: CleanerTeamLoaders,
  ) {}

  @Mutation(() => CleanerType)
  @UseGuards(AuthGuard)
  @Roles(Role.TENANT_OWNER, Role.OPS_MANAGER)
  async assignCleanerToTeam(
    @Args('cleanerId', { type: () => ID }) cleanerId: string,
    @Args('teamId', { type: () => ID }) teamId: string,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<CleanerType> {
    const command: AssignCleanerToTeamCommand = {
      actorId: currentUser.id,
      cleanerId,
      teamId,
      tenantId: requireTenantId(currentUser),
    };
    const cleaner = await this.cleanersService.assignCleanerToTeam(command);
    return toCleanerType(cleaner);
  }

  @Query(() => CleanerType, { name: 'cleaner', nullable: true })
  @UseGuards(AuthGuard)
  @Roles(...VIEW_ROLES)
  async cleaner(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<CleanerType | null> {
    const cleaner = await this.cleanersService.getCleaner(
      id,
      currentUser.tenantId,
    );
    return cleaner ? toCleanerType(cleaner) : null;
  }

  @Mutation(() => CleanerType)
  @UseGuards(AuthGuard)
  @Roles(Role.TENANT_OWNER, Role.OPS_MANAGER)
  async createCleaner(
    @Args('input') input: CreateCleanerInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<CleanerType> {
    const command: CreateCleanerCommand = {
      ...input,
      actorId: currentUser.id,
      tenantId: requireTenantId(currentUser),
    };
    const cleaner = await this.cleanersService.createCleaner(command);
    return toCleanerType(cleaner);
  }

  // Tenant from the principal, never from the parent row (#83 slice decision
  // 4). No principal ⇒ null-tenant loader ⇒ null.
  @ResolveField(() => TeamType, { nullable: true })
  async team(
    @Parent() cleaner: Pick<Cleaner, 'id' | 'teamId'>,
    @CurrentUser() currentUser: AuthenticatedPrincipal | undefined,
  ): Promise<TeamType | null> {
    if (cleaner.teamId === null) {
      return null;
    }
    const team = await this.loaders
      .teamLoaderFor(currentUser?.tenantId ?? null)
      .load(cleaner.teamId);
    return team ? toTeamType(team) : null;
  }

  @Mutation(() => CleanerType)
  @UseGuards(AuthGuard)
  @Roles(Role.TENANT_OWNER, Role.OPS_MANAGER)
  async updateCleaner(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateCleanerInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<CleanerType> {
    const command: UpdateCleanerCommand = {
      ...input,
      actorId: currentUser.id,
      tenantId: requireTenantId(currentUser),
    };
    const cleaner = await this.cleanersService.updateCleaner(id, command);
    return toCleanerType(cleaner);
  }
}
