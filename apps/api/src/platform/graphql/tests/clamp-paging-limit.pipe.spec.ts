import { ClampPagingLimitPipe } from '../clamp-paging-limit.pipe';
import { PLATFORM_PAGE_MAX } from '../paging';

describe('ClampPagingLimitPipe', () => {
  const pipe = new ClampPagingLimitPipe();

  it('clamps paging.limit above the platform max to 100', () => {
    const result = pipe.transform({ paging: { limit: 1000, offset: 0 } });
    expect(result).toEqual({ paging: { limit: PLATFORM_PAGE_MAX, offset: 0 } });
  });

  it('leaves a legal paging.limit unchanged', () => {
    const input = { paging: { limit: 20, offset: 40 } };
    expect(pipe.transform(input)).toEqual({ paging: { limit: 20, offset: 40 } });
  });

  it('does not invent a limit when paging is omitted', () => {
    expect(pipe.transform({})).toEqual({});
  });

  it('does not invent a limit when only offset is present', () => {
    expect(pipe.transform({ paging: { offset: 0 } })).toEqual({
      paging: { offset: 0 },
    });
  });
});
