import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { TeamsService } from '../../application/services/teams.service';
import { CreateTeamCommand } from '../../application/commands/create-team.command';
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import { requireTenantId } from '../../../../platform/auth/authorization/require-tenant-id';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { VIEW_ROLES } from './cleaner.type';
import { CreateTeamInput } from './create-team.input';
import { toTeamType } from './mappers';
import { TeamType } from './team.type';

// Clensy nullable get-by-id plus create. Root `teams` and nested `cleaners`
// are Relatable / ReadResolver owned (tenant-scoped by `TeamType`'s
// `@Authorize`). The tenant comes only from the principal (#83): reads pass
// it through and the service fails closed on `null`; writes require it. A
// command's `tenantId` is set after `...input` so no input key can override
// it.
@Resolver(() => TeamType)
export class TeamResolver {
  constructor(private readonly teamsService: TeamsService) {}

  @Mutation(() => TeamType)
  @UseGuards(AuthGuard)
  @Roles(Role.TENANT_OWNER, Role.OPS_MANAGER)
  async createTeam(
    @Args('input') input: CreateTeamInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<TeamType> {
    const command: CreateTeamCommand = {
      ...input,
      actorId: currentUser.id,
      tenantId: requireTenantId(currentUser),
    };
    const team = await this.teamsService.createTeam(command);
    return toTeamType(team);
  }

  @Query(() => TeamType, { name: 'team', nullable: true })
  @UseGuards(AuthGuard)
  @Roles(...VIEW_ROLES)
  async team(
    @Args('id', { type: () => ID }) id: string,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<TeamType | null> {
    const team = await this.teamsService.getTeam(id, currentUser.tenantId);
    return team ? toTeamType(team) : null;
  }
}
