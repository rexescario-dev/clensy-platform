import {
  PLATFORM_PAGE_DEFAULT,
  PLATFORM_PAGE_MAX,
} from '../paging';

describe('platform paging policy', () => {
  it('defaults list pages to 20', () => {
    expect(PLATFORM_PAGE_DEFAULT).toBe(20);
  });

  it('caps list pages at 100', () => {
    expect(PLATFORM_PAGE_MAX).toBe(100);
  });
});
