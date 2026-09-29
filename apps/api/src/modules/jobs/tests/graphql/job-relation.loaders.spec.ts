import {
  createChecklistBatchFn,
  createJobTeamBatchFn,
  JobRelationLoaders,
} from '../../presentation/graphql/job-relation.loaders';

function makeTeam(id: string): { id: string; tenantId: string } {
  return { id, tenantId: 't-a' };
}

describe('JobRelationLoaders batch functions', () => {
  it('createChecklistBatchFn asks for the ids within the given tenant, preserving order and gap-filling', async () => {
    const checklistA = { id: 'c-a', jobId: 'a' };
    const checklistC = { id: 'c-c', jobId: 'c' };
    const jobsService = {
      getChecklistsByJobIds: jest
        .fn()
        .mockResolvedValue([checklistA, checklistC]),
    };

    const result = await createChecklistBatchFn(jobsService, 't-a')([
      'a',
      'b',
      'c',
    ]);

    expect(jobsService.getChecklistsByJobIds).toHaveBeenCalledWith(
      ['a', 'b', 'c'],
      't-a',
    );
    expect(result).toEqual([checklistA, null, checklistC]);
  });

  // #86 Slice decision 5, mirroring the team batch function.
  it('createChecklistBatchFn with a null tenant resolves every key to null without calling the service', async () => {
    const jobsService = { getChecklistsByJobIds: jest.fn() };
    await expect(
      createChecklistBatchFn(jobsService, null)(['a', 'b']),
    ).resolves.toEqual([null, null]);
    expect(jobsService.getChecklistsByJobIds).not.toHaveBeenCalled();
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

  // #86 Review Focus 4: a cached checklist is only served back to the
  // tenant it was loaded for.
  it('checklistLoaderFor returns one DataLoader per tenant id and batches within it', async () => {
    const checklistA = { id: 'c-a', jobId: 'a' };
    const getChecklistsByJobIds = jest.fn().mockResolvedValue([checklistA]);
    const loaders = new JobRelationLoaders(
      { getTeamsByIds: jest.fn() } as never,
      { getChecklistsByJobIds } as never,
    );
    expect(loaders.checklistLoaderFor('t-a')).toBe(
      loaders.checklistLoaderFor('t-a'),
    );
    expect(loaders.checklistLoaderFor('t-a')).not.toBe(
      loaders.checklistLoaderFor('t-b'),
    );
    const loader = loaders.checklistLoaderFor('t-a');
    await expect(
      Promise.all([loader.load('a'), loader.load('b')]),
    ).resolves.toEqual([checklistA, null]);
    expect(getChecklistsByJobIds).toHaveBeenCalledTimes(1);
    expect(getChecklistsByJobIds).toHaveBeenCalledWith(['a', 'b'], 't-a');
  });
});
