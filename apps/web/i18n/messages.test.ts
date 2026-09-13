import { describe, expect, it } from 'vitest';
import { getMessages } from './messages';

describe('getMessages', () => {
  it('exposes exactly the v1 namespace set', () => {
    expect(Object.keys(getMessages()).sort()).toEqual(['auth', 'common', 'nav', 'validation']);
  });
});
