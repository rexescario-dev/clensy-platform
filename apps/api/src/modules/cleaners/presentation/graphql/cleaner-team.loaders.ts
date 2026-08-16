import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { Cleaner } from '../../domain/cleaner';
import { Team } from '../../domain/team';
import { CleanersService } from '../../application/services/cleaners.service';
import { TeamsService } from '../../application/services/teams.service';

// Extracted as standalone functions (M8) so unit tests can call them
// directly instead of reaching into `DataLoader`'s private `_batchLoadFn`
// property — behavior is unchanged, this only improves testability.
export function createTeamBatchFn(
  teamsService: Pick<TeamsService, 'getTeamsByIds'>,
): DataLoader.BatchLoadFn<string, Team | null> {
  return async (ids) => {
    const teams = await teamsService.getTeamsByIds([...ids]);
    const byId = new Map(teams.map((team) => [team.id, team]));
    return ids.map((id) => byId.get(id) ?? null);
  };
}

export function createTeamCleanersBatchFn(
  cleanersService: Pick<CleanersService, 'listCleanersByTeamIds'>,
): DataLoader.BatchLoadFn<string, Cleaner[]> {
  return async (teamIds) => {
    const cleaners = await cleanersService.listCleanersByTeamIds([
      ...teamIds,
    ]);
    const cleanersByTeamId = new Map<string, Cleaner[]>();
    for (const cleaner of cleaners) {
      if (cleaner.teamId === null) {
        continue;
      }
      const existing = cleanersByTeamId.get(cleaner.teamId);
      if (existing) {
        existing.push(cleaner);
      } else {
        cleanersByTeamId.set(cleaner.teamId, [cleaner]);
      }
    }
    return teamIds.map((teamId) => cleanersByTeamId.get(teamId) ?? []);
  };
}

// Request-scoped (Scope.REQUEST): a fresh instance — and fresh DataLoader
// caches — per GraphQL request, so results never leak across requests.
// Satisfies spec §4.5's normative "no one-query-per-parent-row when
// resolving a list" invariant for both `Cleaner.team` and `Team.cleaners`.
@Injectable({ scope: Scope.REQUEST })
export class CleanerTeamLoaders {
  readonly teamLoader: DataLoader<string, Team | null>;
  readonly teamCleanersLoader: DataLoader<string, Cleaner[]>;

  constructor(
    private readonly teamsService: TeamsService,
    private readonly cleanersService: CleanersService,
  ) {
    this.teamLoader = new DataLoader<string, Team | null>(
      createTeamBatchFn(this.teamsService),
    );
    this.teamCleanersLoader = new DataLoader<string, Cleaner[]>(
      createTeamCleanersBatchFn(this.cleanersService),
    );
  }
}
