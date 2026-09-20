import { describe, expect, it } from 'vitest';
import { deepMerge } from './deep-merge';

describe('deepMerge', () => {
  it('returns base unchanged when override is undefined', () => {
    const base = { a: 1, b: { c: 2 } };
    expect(deepMerge(base, undefined)).toEqual(base);
  });

  it('overrides only the specified leaf, preserving sibling keys', () => {
    const base = {
      columns: {
        customer: 'Customer',
        property: 'Property',
        service: 'Service',
      },
    };
    const result = deepMerge(base, { columns: { customer: 'Client' } });
    expect(result).toEqual({
      columns: {
        customer: 'Client',
        property: 'Property',
        service: 'Service',
      },
    });
  });

  it('merges recursively at any depth, never shallow-replacing a nested object', () => {
    const base = { a: { b: { c: 1, d: 2 }, e: 3 } };
    const result = deepMerge(base, { a: { b: { c: 99 } } });
    expect(result).toEqual({ a: { b: { c: 99, d: 2 }, e: 3 } });
  });
});
