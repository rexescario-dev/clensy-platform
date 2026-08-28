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
// `cleaners` is ReadResolver-owned.
@Resolver(() => CleanerType)
export class CleanerResolver {
  constructor(
    private readonly cleanersService: CleanersService,
    private readonly loaders: CleanerTeamLoaders,
  ) {}

  @Query(() => CleanerType, { name: 'cleaner', nullable: true })
  @UseGuards(AuthGuard)
  @Roles(...VIEW_ROLES)
  async cleaner(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<CleanerType | null> {
    const cleaner = await this.cleanersService.getCleaner(id);
    return cleaner ? toCleanerType(cleaner) : null;
  }

  @Mutation(() => CleanerType)
  @UseGuards(AuthGuard)
  @Roles(Role.OWNER, Role.OPS_MANAGER)
  async createCleaner(
    @Args('input') input: CreateCleanerInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<CleanerType> {
    const command: CreateCleanerCommand = {
      ...input,
      actorId: currentUser.id,
    };
    const cleaner = await this.cleanersService.createCleaner(command);
    return toCleanerType(cleaner);
  }

  @Mutation(() => CleanerType)
  @UseGuards(AuthGuard)
  @Roles(Role.OWNER, Role.OPS_MANAGER)
  async updateCleaner(
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateCleanerInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<CleanerType> {
    const command: UpdateCleanerCommand = {
      ...input,
      actorId: currentUser.id,
    };
    const cleaner = await this.cleanersService.updateCleaner(id, command);
    return toCleanerType(cleaner);
  }

  @Mutation(() => CleanerType)
  @UseGuards(AuthGuard)
  @Roles(Role.OWNER, Role.OPS_MANAGER)
  async assignCleanerToTeam(
    @Args('cleanerId', { type: () => ID }) cleanerId: string,
    @Args('teamId', { type: () => ID }) teamId: string,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<CleanerType> {
    const command: AssignCleanerToTeamCommand = {
      actorId: currentUser.id,
      cleanerId,
      teamId,
    };
    const cleaner = await this.cleanersService.assignCleanerToTeam(command);
    return toCleanerType(cleaner);
  }

  @ResolveField(() => TeamType, { nullable: true })
  async team(
    @Parent() cleaner: Pick<Cleaner, 'id' | 'teamId'>,
  ): Promise<TeamType | null> {
    if (cleaner.teamId === null) {
      return null;
    }
    const team = await this.loaders.teamLoader.load(cleaner.teamId);
    return team ? toTeamType(team) : null;
  }
}
