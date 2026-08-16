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
import { TeamsService } from '../../application/services/teams.service';
import { CreateTeamCommand } from '../../application/commands/create-team.command';
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { CleanerTeamLoaders } from './cleaner-team.loaders';
import { CleanerType } from './cleaner.type';
import { CreateTeamInput } from './create-team.input';
import { toCleanerType, toTeamType } from './mappers';
import { TeamType } from './team.type';

// Exactly the `Team`-scoped operations of spec §4.5 — no others. There is
// no `updateTeam` mutation (task brief).
@Resolver(() => TeamType)
export class TeamResolver {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly loaders: CleanerTeamLoaders,
  ) {}

  @Query(() => TeamType, { name: 'team', nullable: true })
  @UseGuards(AuthGuard)
  @Roles(Role.OWNER, Role.OPS_MANAGER, Role.SCHEDULER, Role.ANALYST)
  async team(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<TeamType | null> {
    const team = await this.teamsService.getTeam(id);
    return team ? toTeamType(team) : null;
  }

  @Query(() => [TeamType], { name: 'teams' })
  @UseGuards(AuthGuard)
  @Roles(Role.OWNER, Role.OPS_MANAGER, Role.SCHEDULER, Role.ANALYST)
  async teams(): Promise<TeamType[]> {
    const teams = await this.teamsService.listTeams();
    return teams.map(toTeamType);
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

  // Presentation-layer-only computed field (spec §4.5), batched via
  // `CleanerTeamLoaders.teamCleanersLoader` to avoid one query per parent
  // row.
  @ResolveField(() => [CleanerType])
  async cleaners(@Parent() team: TeamType): Promise<CleanerType[]> {
    const cleaners = await this.loaders.teamCleanersLoader.load(team.id);
    return cleaners.map(toCleanerType);
  }
}
