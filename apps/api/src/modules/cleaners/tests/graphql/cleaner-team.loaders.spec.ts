import {
  createTeamBatchFn,
  CleanerTeamLoaders,
} from '../../presentation/graphql/cleaner-team.loaders';
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

describe('teamLoader batch function (#83 tenant scope)', () => {
  it('asks the service for the ids within the given tenant and maps misses to null', async () => {
    const teamA = makeTeam('a');
    const teamsService = { getTeamsByIds: jest.fn().mockResolvedValue([teamA]) };
    const batchFn = createTeamBatchFn(teamsService, 't-a');
    await expect(batchFn(['a', 'foreign'])).resolves.toEqual([teamA, null]);
    expect(teamsService.getTeamsByIds).toHaveBeenCalledWith(
      ['a', 'foreign'],
      't-a',
    );
  });

  it('null tenant resolves every key to null without calling the service', async () => {
    const teamsService = { getTeamsByIds: jest.fn() };
    const batchFn = createTeamBatchFn(teamsService, null);
    await expect(batchFn(['a', 'b'])).resolves.toEqual([null, null]);
    expect(teamsService.getTeamsByIds).not.toHaveBeenCalled();
  });
});

describe('CleanerTeamLoaders.teamLoaderFor', () => {
  it('returns one DataLoader per tenant id, memoized for the request', () => {
    const loaders = new CleanerTeamLoaders({ getTeamsByIds: jest.fn() } as never);
    expect(loaders.teamLoaderFor('t-a')).toBe(loaders.teamLoaderFor('t-a'));
    expect(loaders.teamLoaderFor('t-a')).not.toBe(loaders.teamLoaderFor('t-b'));
    expect(loaders.teamLoaderFor(null)).toBe(loaders.teamLoaderFor(null));
  });

  it('batches loads within one tenant into one tenant-scoped call', async () => {
    const getTeamsByIds = jest.fn().mockResolvedValue([makeTeam('a')]);
    const loaders = new CleanerTeamLoaders({ getTeamsByIds } as never);
    const loader = loaders.teamLoaderFor('t-a');
    await Promise.all([loader.load('a'), loader.load('b')]);
    expect(getTeamsByIds).toHaveBeenCalledTimes(1);
    expect(getTeamsByIds).toHaveBeenCalledWith(['a', 'b'], 't-a');
  });
});
