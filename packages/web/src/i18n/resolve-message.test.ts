import { describe, expect, it } from 'vitest';
import { resolveMessage } from './resolve-message';

describe('resolveMessage', () => {
  it('returns the fallback when override is undefined', () => {
    expect(resolveMessage(undefined, 'default')).toBe('default');
  });

  it('returns the override when supplied', () => {
    expect(resolveMessage('custom', 'default')).toBe('custom');
  });

  it('treats an empty-string override as a valid override, not "use the default"', () => {
    expect(resolveMessage('', 'default')).toBe('');
  });
});
