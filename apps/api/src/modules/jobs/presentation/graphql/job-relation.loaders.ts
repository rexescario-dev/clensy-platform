import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { Team } from '../../../cleaners/domain/team';
import { TeamsService } from '../../../cleaners/application/services/teams.service';
import { Checklist } from '../../domain/checklist';
import { JobsService } from '../../application/services/jobs.service';

export function createJobTeamBatchFn(
  teamsService: Pick<TeamsService, 'getTeamsByIds'>,
): DataLoader.BatchLoadFn<string, Team | null> {
  return async (ids) => {
    const teams = await teamsService.getTeamsByIds([...ids]);
    const byId = new Map(teams.map((team) => [team.id, team]));
    return ids.map((id) => byId.get(id) ?? null);
  };
}

export function createChecklistBatchFn(
  jobsService: Pick<JobsService, 'getChecklistsByJobIds'>,
): DataLoader.BatchLoadFn<string, Checklist | null> {
  return async (jobIds) => {
    const checklists = await jobsService.getChecklistsByJobIds([...jobIds]);
    const byJobId = new Map(
      checklists.map((checklist) => [checklist.jobId, checklist]),
    );
    return jobIds.map((id) => byJobId.get(id) ?? null);
  };
}

@Injectable({ scope: Scope.REQUEST })
export class JobRelationLoaders {
  readonly teamLoader: DataLoader<string, Team | null>;
  readonly checklistLoader: DataLoader<string, Checklist | null>;

  constructor(
    private readonly teamsService: TeamsService,
    private readonly jobsService: JobsService,
  ) {
    this.teamLoader = new DataLoader(createJobTeamBatchFn(this.teamsService));
    this.checklistLoader = new DataLoader(
      createChecklistBatchFn(this.jobsService),
    );
  }
}
