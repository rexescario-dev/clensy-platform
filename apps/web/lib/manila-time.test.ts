import { describe, expect, it } from 'vitest';
import { formatManilaDateTime, manilaDateTimeLocalToIso, toManilaDateTimeLocal } from './manila-time';

describe('manila-time', () => {
  it('converts an instant to a Manila datetime-local value', () => {
    expect(toManilaDateTimeLocal('2026-11-01T16:30:00.000Z')).toBe('2026-11-02T00:30');
    expect(toManilaDateTimeLocal(new Date('2026-11-01T16:30:00.000Z'))).toBe('2026-11-02T00:30');
  });

  it('converts a Manila datetime-local value to an ISO string with +08:00', () => {
    const iso = manilaDateTimeLocalToIso('2026-11-02T00:30');
    expect(iso).toBe('2026-11-02T00:30:00+08:00');
    expect(new Date(iso as string).toISOString()).toBe('2026-11-01T16:30:00.000Z');
  });

  it('returns null for a value that is not YYYY-MM-DDTHH:mm', () => {
    expect(manilaDateTimeLocalToIso('2026-11-02')).toBeNull();
  });

  it('formats an instant in Manila time', () => {
    const formatted = formatManilaDateTime('2026-11-01T16:30:00.000Z');
    expect(formatted).toContain('12:30');
    expect(formatted).toContain('Nov 2');
  });
});
