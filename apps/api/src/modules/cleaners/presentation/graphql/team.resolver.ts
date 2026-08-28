import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { TeamsService } from '../../application/services/teams.service';
import { CreateTeamCommand } from '../../application/commands/create-team.command';
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { VIEW_ROLES } from './cleaner.type';
import { CreateTeamInput } from './create-team.input';
import { toTeamType } from './mappers';
import { TeamType } from './team.type';

// Clensy nullable get-by-id plus create. Root `teams` and nested `cleaners`
// are Relatable / ReadResolver owned.
@Resolver(() => TeamType)
export class TeamResolver {
  constructor(private readonly teamsService: TeamsService) {}

  @Query(() => TeamType, { name: 'team', nullable: true })
  @UseGuards(AuthGuard)
  @Roles(...VIEW_ROLES)
  async team(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<TeamType | null> {
    const team = await this.teamsService.getTeam(id);
    return team ? toTeamType(team) : null;
  }

  @Mutation(() => TeamType)
  @UseGuards(AuthGuard)
  @Roles(Role.OWNER, Role.OPS_MANAGER)
  async createTeam(
    @Args('input') input: CreateTeamInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<TeamType> {
    const command: CreateTeamCommand = {
      ...input,
      actorId: currentUser.id,
    };
    const team = await this.teamsService.createTeam(command);
    return toTeamType(team);
  }
}
