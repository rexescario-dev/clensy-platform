import {
  createBookingBatchFn,
  createChecklistBatchFn,
  createChecklistItemsBatchFn,
  createJobTeamBatchFn,
} from '../../presentation/graphql/job-relation.loaders';

describe('JobRelationLoaders batch functions', () => {
  it('createBookingBatchFn preserves order and gap-fills, calling only getBookingsByIds', async () => {
    const bookingA = { id: 'a' };
    const bookingC = { id: 'c' };
    const bookingsService = {
      getBookingsByIds: jest.fn().mockResolvedValue([bookingA, bookingC]),
    };

    const result = await createBookingBatchFn(bookingsService)(['a', 'b', 'c']);

    expect(bookingsService.getBookingsByIds).toHaveBeenCalledWith([
      'a',
      'b',
      'c',
    ]);
    expect(result).toEqual([bookingA, null, bookingC]);
  });

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

  it('createChecklistItemsBatchFn groups by checklist id, sorts by position, and gap-fills []', async () => {
    const itemC1 = { id: 'i2', checklistId: 'c', position: 1 };
    const itemA = { id: 'i0', checklistId: 'a', position: 0 };
    const itemC0 = { id: 'i1', checklistId: 'c', position: 0 };
    const jobsService = {
      getChecklistItemsByChecklistIds: jest
        .fn()
        .mockResolvedValue([itemC1, itemA, itemC0]),
    };

    const result = await createChecklistItemsBatchFn(jobsService)([
      'a',
      'b',
      'c',
    ]);

    expect(jobsService.getChecklistItemsByChecklistIds).toHaveBeenCalledWith([
      'a',
      'b',
      'c',
    ]);
    expect(result).toEqual([[itemA], [], [itemC0, itemC1]]);
  });
});
