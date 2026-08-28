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
import { CurrentUser } from '../../../../platform/auth/decorators/current-user.decorator';
import { Roles } from '../../../../platform/auth/decorators/roles.decorator';
import type { AuthenticatedPrincipal } from '../../../../platform/auth/domain/authenticated-principal';
import { Role } from '../../../../platform/auth/domain/role';
import { AuthGuard } from '../../../../platform/auth/guards/auth.guard';
import { toTeamType } from '../../../cleaners/presentation/graphql/mappers';
import { TeamType } from '../../../cleaners/presentation/graphql/team.type';
import { JobsService } from '../../application/services/jobs.service';
import { CleaningJob } from '../../domain/cleaning-job';
import { AssignTeamToJobInput } from './assign-team-to-job.input';
import { ChecklistType } from './checklist.type';
import { CleaningJobType, VIEW_ROLES } from './cleaning-job.type';
import { CompleteChecklistItemInput } from './complete-checklist-item.input';
import { CompleteJobInput } from './complete-job.input';
import { CreateJobFromBookingInput } from './create-job-from-booking.input';
import { JobRelationLoaders } from './job-relation.loaders';
import { toChecklistType, toCleaningJobType } from './mappers';

const CREATE_ROLES = [
  Role.OWNER,
  Role.OPS_MANAGER,
  Role.SCHEDULER,
  Role.CUSTOMER_SUPPORT,
];
const EXECUTE_ROLES = [Role.OWNER, Role.OPS_MANAGER, Role.SCHEDULER];

@Resolver(() => CleaningJobType)
export class JobResolver {
  constructor(
    private readonly jobsService: JobsService,
    private readonly loaders: JobRelationLoaders,
  ) {}

  @Query(() => CleaningJobType, { name: 'job', nullable: true })
  @UseGuards(AuthGuard)
  @Roles(...VIEW_ROLES)
  async job(
    @Args('id', { type: () => ID }) id: string,
  ): Promise<CleaningJobType | null> {
    const found = await this.jobsService.getJob(id);
    return found ? toCleaningJobType(found) : null;
  }

  @Mutation(() => CleaningJobType)
  @UseGuards(AuthGuard)
  @Roles(...CREATE_ROLES)
  async createJobFromBooking(
    @Args('input') input: CreateJobFromBookingInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<CleaningJobType> {
    const job = await this.jobsService.createFromBooking({
      actorId: currentUser.id,
      bookingId: input.bookingId,
    });
    return toCleaningJobType(job);
  }

  @Mutation(() => CleaningJobType)
  @UseGuards(AuthGuard)
  @Roles(...EXECUTE_ROLES)
  async assignTeamToJob(
    @Args('input') input: AssignTeamToJobInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<CleaningJobType> {
    const job = await this.jobsService.assignTeam({
      actorId: currentUser.id,
      jobId: input.jobId,
      teamId: input.teamId,
    });
    return toCleaningJobType(job);
  }

  @Mutation(() => CleaningJobType)
  @UseGuards(AuthGuard)
  @Roles(...EXECUTE_ROLES)
  async completeChecklistItem(
    @Args('input') input: CompleteChecklistItemInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<CleaningJobType> {
    const job = await this.jobsService.completeChecklistItem({
      actorId: currentUser.id,
      jobId: input.jobId,
      itemId: input.itemId,
    });
    return toCleaningJobType(job);
  }

  @Mutation(() => CleaningJobType)
  @UseGuards(AuthGuard)
  @Roles(...EXECUTE_ROLES)
  async completeJob(
    @Args('input') input: CompleteJobInput,
    @CurrentUser() currentUser: AuthenticatedPrincipal,
  ): Promise<CleaningJobType> {
    const job = await this.jobsService.completeJob({
      actorId: currentUser.id,
      jobId: input.id,
    });
    return toCleaningJobType(job);
  }

  @ResolveField(() => TeamType, { nullable: true })
  async team(
    @Parent() job: Pick<CleaningJob, 'teamId'>,
  ): Promise<TeamType | null> {
    if (job.teamId === null) {
      return null;
    }
    const team = await this.loaders.teamLoader.load(job.teamId);
    return team ? toTeamType(team) : null;
  }

  @ResolveField(() => ChecklistType)
  async checklist(
    @Parent() job: Pick<CleaningJob, 'id'>,
  ): Promise<ChecklistType> {
    const checklist = await this.loaders.checklistLoader.load(job.id);
    return toChecklistType(checklist!);
  }
}
