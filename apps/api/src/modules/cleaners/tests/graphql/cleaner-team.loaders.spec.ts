import {
  createTeamBatchFn,
  createTeamCleanersBatchFn,
} from '../../presentation/graphql/cleaner-team.loaders';
import { Cleaner } from '../../domain/cleaner';
import { Team } from '../../domain/team';

// Unit tests for the loader batch functions in isolation (task brief).
// `DataLoader` normally dedupes/coalesces calls within a tick, so these
// tests call the standalone `createTeamBatchFn`/`createTeamCleanersBatchFn`
// factories directly (M8: extracted out of `CleanerTeamLoaders`'s
// constructor specifically so tests don't need to reach into `dataloader`'s
// private `_batchLoadFn` property) to assert ordering/grouping precisely and
// deterministically.

function makeTeam(id: string): Team {
  return {
    id,
    name: `Team ${id}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeCleaner(id: string, teamId: string | null): Cleaner {
  return {
    id,
    fullName: `Cleaner ${id}`,
    phone: '555-0000',
    email: `${id}@example.com`,
    notes: null,
    teamId,
    createdAt: new Date(),
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

      expect(teamsService.getTeamsByIds).toHaveBeenCalledWith(['a', 'b', 'c']);
      expect(result).toEqual([teamA, null, teamC]);
    });
  });

  describe('teamCleanersLoader batch function', () => {
    it('groups cleaners by teamId and returns [] for a team with no matching cleaners, in input-key order', async () => {
      const cleanerForB1 = makeCleaner('b1', 'b');
      const cleanerForB2 = makeCleaner('b2', 'b');
      const cleanersService = {
        listCleanersByTeamIds: jest
          .fn()
          .mockResolvedValue([cleanerForB1, cleanerForB2]),
      };

      const batchFn = createTeamCleanersBatchFn(cleanersService);

      const result = await batchFn(['a', 'b']);

      expect(cleanersService.listCleanersByTeamIds).toHaveBeenCalledWith([
        'a',
        'b',
      ]);
      expect(result).toEqual([[], [cleanerForB1, cleanerForB2]]);
    });
  });
});
