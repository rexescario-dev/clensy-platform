import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { Team } from '../../domain/team';
import { TeamsService } from '../../application/services/teams.service';

// Extracted as a standalone function (M8) so unit tests can call it directly
// instead of reaching into `DataLoader`'s private `_batchLoadFn` property —
// behavior is unchanged, this only improves testability.
//
// `tenantId` comes from the resolver (`@CurrentUser()`), never from
// ambient request state (#83 slice decision 4). `null` — no tenant scope —
// resolves every key to null without touching the service.
export function createTeamBatchFn(
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

// `createTeamCleanersBatchFn`/`teamCleanersLoader` were removed here (#83
// Task 3, Slice decision 5): `Team.cleaners` is served by nestjs-query's
// `@OffsetConnection`, not this loader, and `CleanersService.listCleanersByTeamIds`
// (its only caller) is deleted alongside it.

// Request-scoped: fresh caches per GraphQL request. One DataLoader per
// tenant id, so a cached Team can only ever be served back to a caller of
// the tenant it was loaded for.
@Injectable({ scope: Scope.REQUEST })
export class CleanerTeamLoaders {
  private readonly teamLoaders = new Map<
    string | null,
    DataLoader<string, Team | null>
  >();

  constructor(private readonly teamsService: TeamsService) {}

  teamLoaderFor(tenantId: string | null): DataLoader<string, Team | null> {
    let loader = this.teamLoaders.get(tenantId);
    if (!loader) {
      loader = new DataLoader(createTeamBatchFn(this.teamsService, tenantId));
      this.teamLoaders.set(tenantId, loader);
    }
    return loader;
  }
}
