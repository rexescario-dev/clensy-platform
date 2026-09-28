import {
  createChecklistBatchFn,
  createJobTeamBatchFn,
  JobRelationLoaders,
} from '../../presentation/graphql/job-relation.loaders';

function makeTeam(id: string): { id: string; tenantId: string } {
  return { id, tenantId: 't-a' };
}

describe('JobRelationLoaders batch functions', () => {
  it('createChecklistBatchFn preserves order and gap-fills, calling only getChecklistsByJobIds', async () => {
    const checklistA = { id: 'c-a', jobId: 'a' };
    const checklistC = { id: 'c-c', jobId: 'c' };
    const jobsService = {
      getChecklistsByJobIds: jest
        .fn()
        .mockResolvedValue([checklistA, checklistC]),
    };

    const result = await createChecklistBatchFn(jobsService)(['a', 'b', 'c']);

    expect(jobsService.getChecklistsByJobIds).toHaveBeenCalledWith([
      'a',
      'b',
      'c',
    ]);
    expect(result).toEqual([checklistA, null, checklistC]);
  });
});

describe('teamLoader batch function (#83 tenant scope)', () => {
  it('asks the service for the ids within the given tenant and maps misses to null', async () => {
    const teamA = makeTeam('a');
    const teamsService = {
      getTeamsByIds: jest.fn().mockResolvedValue([teamA]),
    };
    const batchFn = createJobTeamBatchFn(teamsService, 't-a');
    await expect(batchFn(['a', 'foreign'])).resolves.toEqual([teamA, null]);
    expect(teamsService.getTeamsByIds).toHaveBeenCalledWith(
      ['a', 'foreign'],
      't-a',
    );
  });

  it('null tenant resolves every key to null without calling the service', async () => {
    const teamsService = { getTeamsByIds: jest.fn() };
    const batchFn = createJobTeamBatchFn(teamsService, null);
    await expect(batchFn(['a', 'b'])).resolves.toEqual([null, null]);
    expect(teamsService.getTeamsByIds).not.toHaveBeenCalled();
  });
});

describe('JobRelationLoaders.teamLoaderFor', () => {
  it('returns one DataLoader per tenant id, memoized for the request', () => {
    const loaders = new JobRelationLoaders(
      { getTeamsByIds: jest.fn() } as never,
      { getChecklistsByJobIds: jest.fn() } as never,
    );
    expect(loaders.teamLoaderFor('t-a')).toBe(loaders.teamLoaderFor('t-a'));
    expect(loaders.teamLoaderFor('t-a')).not.toBe(loaders.teamLoaderFor('t-b'));
    expect(loaders.teamLoaderFor(null)).toBe(loaders.teamLoaderFor(null));
  });

  it('batches loads within one tenant into one tenant-scoped call', async () => {
    const getTeamsByIds = jest.fn().mockResolvedValue([makeTeam('a')]);
    const loaders = new JobRelationLoaders(
      { getTeamsByIds } as never,
      { getChecklistsByJobIds: jest.fn() } as never,
    );
    const loader = loaders.teamLoaderFor('t-a');
    await Promise.all([loader.load('a'), loader.load('b')]);
    expect(getTeamsByIds).toHaveBeenCalledTimes(1);
    expect(getTeamsByIds).toHaveBeenCalledWith(['a', 'b'], 't-a');
  });

  it('checklistLoader is unchanged and still resolves via getChecklistsByJobIds', async () => {
    const checklistA = { id: 'c-a', jobId: 'a' };
    const getChecklistsByJobIds = jest.fn().mockResolvedValue([checklistA]);
    const loaders = new JobRelationLoaders(
      { getTeamsByIds: jest.fn() } as never,
      {
        getChecklistsByJobIds,
      } as never,
    );
    await expect(loaders.checklistLoader.load('a')).resolves.toEqual(
      checklistA,
    );
  });
});
