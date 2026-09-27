import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { Team } from '../../domain/team';
import { TeamsService } from '../../application/services/teams.service';

// Extracted as a standalone function (M8) so unit tests can call it directly
// instead of reaching into `DataLoader`'s private `_batchLoadFn` property —
// behavior is unchanged, this only improves testability.
export function createTeamBatchFn(
  teamsService: Pick<TeamsService, 'getTeamsByIds'>,
): DataLoader.BatchLoadFn<string, Team | null> {
  return async (ids) => {
    // `null` fails closed (never leaks a cross-tenant team) until Task 4
    // wires the caller's principal tenant through this loader.
    const teams = await teamsService.getTeamsByIds([...ids], null); // #83 Task 4
    const byId = new Map(teams.map((team) => [team.id, team]));
    return ids.map((id) => byId.get(id) ?? null);
  };
}

// `createTeamCleanersBatchFn`/`teamCleanersLoader` were removed here (#83
// Task 3, Slice decision 5): `Team.cleaners` is served by nestjs-query's
// `@OffsetConnection`, not this loader, and `CleanersService.listCleanersByTeamIds`
// (its only caller) is deleted alongside it.

// Request-scoped (Scope.REQUEST): a fresh instance — and fresh DataLoader
// cache — per GraphQL request, so results never leak across requests.
// Satisfies spec §4.5's normative "no one-query-per-parent-row when
// resolving a list" invariant for `Cleaner.team`.
@Injectable({ scope: Scope.REQUEST })
export class CleanerTeamLoaders {
  readonly teamLoader: DataLoader<string, Team | null>;

  constructor(private readonly teamsService: TeamsService) {
    this.teamLoader = new DataLoader<string, Team | null>(
      createTeamBatchFn(this.teamsService),
    );
  }
}
