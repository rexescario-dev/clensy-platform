import { isAppDebugEnabled } from '../app-debug';

describe('isAppDebugEnabled', () => {
  it.each([
    ['true', true],
    [undefined, false],
    ['false', false],
    ['1', false],
    ['TRUE', false],
  ] as const)('APP_DEBUG=%j → %s', (value, expected) => {
    expect(isAppDebugEnabled(value)).toBe(expected);
  });
});
