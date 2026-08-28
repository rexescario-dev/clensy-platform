import {
  createChecklistBatchFn,
  createJobTeamBatchFn,
} from '../../presentation/graphql/job-relation.loaders';

describe('JobRelationLoaders batch functions', () => {
  it('createJobTeamBatchFn preserves order and gap-fills, calling only getTeamsByIds', async () => {
    const teamA = { id: 'a' };
    const teamC = { id: 'c' };
    const teamsService = {
      getTeamsByIds: jest.fn().mockResolvedValue([teamA, teamC]),
    };

    const result = await createJobTeamBatchFn(teamsService)(['a', 'b', 'c']);

    expect(teamsService.getTeamsByIds).toHaveBeenCalledWith(['a', 'b', 'c']);
    expect(result).toEqual([teamA, null, teamC]);
  });

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
