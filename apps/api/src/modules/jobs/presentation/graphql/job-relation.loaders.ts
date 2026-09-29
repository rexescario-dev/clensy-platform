import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { Team } from '../../../cleaners/domain/team';
import { TeamsService } from '../../../cleaners/application/services/teams.service';
import { Checklist } from '../../domain/checklist';
import { JobsService } from '../../application/services/jobs.service';

// `tenantId` comes from the resolver (`@CurrentUser()`), never from the
// parent row (#86 Slice decision 5, as for teams). `null` — no tenant
// scope — resolves every key to null without touching the service.
export function createChecklistBatchFn(
  jobsService: Pick<JobsService, 'getChecklistsByJobIds'>,
  tenantId: string | null,
): DataLoader.BatchLoadFn<string, Checklist | null> {
  return async (jobIds) => {
    if (tenantId === null) {
      return jobIds.map(() => null);
    }
    const checklists = await jobsService.getChecklistsByJobIds(
      [...jobIds],
      tenantId,
    );
    const byJobId = new Map(
      checklists.map((checklist) => [checklist.jobId, checklist]),
    );
    return jobIds.map((id) => byJobId.get(id) ?? null);
  };
}

// `tenantId` comes from the resolver (`@CurrentUser()`), never from
// ambient request state (#83 slice decision 4). `null` — no tenant scope —
// resolves every key to null without touching the service.
export function createJobTeamBatchFn(
  teamsService: Pick<TeamsService, 'getTeamsByIds'>,
  tenantId: string | null,
): DataLoader.BatchLoadFn<string, Team | null> {
  return async (ids) => {
    if (tenantId === null) {
      return ids.map(() => null);
    }
    const teams = await teamsService.getTeamsByIds([...ids], tenantId);
    const byId = new Map(teams.map((team) => [team.id, team]));
    return ids.map((id) => byId.get(id) ?? null);
  };
}

// Request-scoped: fresh caches per GraphQL request. One DataLoader per
// tenant id for both teams and checklists (#83, #86), so a cached row can
// only ever be served back to a caller of the tenant it was loaded for.
@Injectable({ scope: Scope.REQUEST })
export class JobRelationLoaders {
  private readonly teamLoaders = new Map<
    string | null,
    DataLoader<string, Team | null>
  >();

  private readonly checklistLoaders = new Map<
    string | null,
    DataLoader<string, Checklist | null>
  >();

  constructor(
    private readonly teamsService: TeamsService,
    private readonly jobsService: JobsService,
  ) {}

  checklistLoaderFor(
    tenantId: string | null,
  ): DataLoader<string, Checklist | null> {
    let loader = this.checklistLoaders.get(tenantId);
    if (!loader) {
      loader = new DataLoader(
        createChecklistBatchFn(this.jobsService, tenantId),
      );
      this.checklistLoaders.set(tenantId, loader);
    }
    return loader;
  }

  teamLoaderFor(tenantId: string | null): DataLoader<string, Team | null> {
    let loader = this.teamLoaders.get(tenantId);
    if (!loader) {
      loader = new DataLoader(
        createJobTeamBatchFn(this.teamsService, tenantId),
      );
      this.teamLoaders.set(tenantId, loader);
    }
    return loader;
  }
}
