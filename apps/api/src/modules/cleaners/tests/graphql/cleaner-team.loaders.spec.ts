import { createTeamBatchFn } from '../../presentation/graphql/cleaner-team.loaders';
import { Team } from '../../domain/team';

// Unit tests for the loader batch function in isolation (task brief).
// `DataLoader` normally dedupes/coalesces calls within a tick, so this test
// calls the standalone `createTeamBatchFn` factory directly (M8: extracted
// out of `CleanerTeamLoaders`'s constructor specifically so tests don't need
// to reach into `dataloader`'s private `_batchLoadFn` property) to assert
// ordering/grouping precisely and deterministically.
//
// `createTeamCleanersBatchFn`/`teamCleanersLoader` and their tests were
// removed here (#83 Task 3, Slice decision 5): `Team.cleaners` is served by
// nestjs-query's `@OffsetConnection`, not this loader.

function makeTeam(id: string): Team {
  return {
    id,
    tenantId: 't-a',
    createdAt: new Date(),
    name: `Team ${id}`,
    updatedAt: new Date(),
  };
}

describe('CleanerTeamLoaders', () => {
  describe('teamLoader batch function', () => {
    it('returns [team_a, null, team_c] in input-key order when the bulk result covers only a and c', async () => {
      const teamA = makeTeam('a');
      const teamC = makeTeam('c');
      const teamsService = {
        getTeamsByIds: jest.fn().mockResolvedValue([teamA, teamC]),
      };

      const batchFn = createTeamBatchFn(teamsService);

      const result = await batchFn(['a', 'b', 'c']);

      // Temporary `null` tenant argument (#83 Task 4 wires the real
      // principal tenant through this loader).
      expect(teamsService.getTeamsByIds).toHaveBeenCalledWith(
        ['a', 'b', 'c'],
        null,
      );
      expect(result).toEqual([teamA, null, teamC]);
    });
  });
});
