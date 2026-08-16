import { CleanerTeamLoaders } from '../../presentation/graphql/cleaner-team.loaders';
import { Cleaner } from '../../domain/cleaner';
import { Team } from '../../domain/team';

// Unit tests for the loader batch functions in isolation (task brief):
// `DataLoader` normally dedupes/coalesces calls within a tick, so these
// tests reach past the public `.load()` API and invoke the underlying batch
// function directly (`(loader as any)._batchLoadFn` — the function passed to
// `new DataLoader(fn)`, stored under that name by the `dataloader` package
// and kept accessible here via a cast since it isn't part of DataLoader's
// public types) to assert ordering/grouping precisely and deterministically.

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
      const cleanersService = { listCleanersByTeamIds: jest.fn() };

      const loaders = new CleanerTeamLoaders(
        teamsService as never,
        cleanersService as never,
      );

      const batchFn = (
        loaders.teamLoader as unknown as {
          _batchLoadFn: (ids: readonly string[]) => Promise<Array<Team | null>>;
        }
      )._batchLoadFn;

      const result = await batchFn(['a', 'b', 'c']);

      expect(teamsService.getTeamsByIds).toHaveBeenCalledWith(['a', 'b', 'c']);
      expect(result).toEqual([teamA, null, teamC]);
    });
  });

  describe('teamCleanersLoader batch function', () => {
    it('groups cleaners by teamId and returns [] for a team with no matching cleaners, in input-key order', async () => {
      const cleanerForB1 = makeCleaner('b1', 'b');
      const cleanerForB2 = makeCleaner('b2', 'b');
      const teamsService = { getTeamsByIds: jest.fn() };
      const cleanersService = {
        listCleanersByTeamIds: jest
          .fn()
          .mockResolvedValue([cleanerForB1, cleanerForB2]),
      };

      const loaders = new CleanerTeamLoaders(
        teamsService as never,
        cleanersService as never,
      );

      const batchFn = (
        loaders.teamCleanersLoader as unknown as {
          _batchLoadFn: (teamIds: readonly string[]) => Promise<Cleaner[][]>;
        }
      )._batchLoadFn;

      const result = await batchFn(['a', 'b']);

      expect(cleanersService.listCleanersByTeamIds).toHaveBeenCalledWith([
        'a',
        'b',
      ]);
      expect(result).toEqual([[], [cleanerForB1, cleanerForB2]]);
    });
  });
});
