import {
  formatInvoiceNumber,
  resolveManilaYear,
} from '../../domain/invoice-number';

describe('formatInvoiceNumber', () => {
  it('zero-pads the sequence value to six digits', () => {
    expect(formatInvoiceNumber(42, 2026)).toBe('INV-2026-000042');
  });

  it('pads a single-digit value', () => {
    expect(formatInvoiceNumber(1, 2026)).toBe('INV-2026-000001');
  });

  it('renders a value above six digits without wrapping', () => {
    expect(formatInvoiceNumber(1234567, 2027)).toBe('INV-2027-1234567');
  });

  it('does not reset the sequence per year — the year is only a prefix', () => {
    expect(formatInvoiceNumber(101, 2027)).toBe('INV-2027-000101');
  });
});

describe('resolveManilaYear', () => {
  it('keeps the old year just before Manila midnight on Jan 1', () => {
    expect(resolveManilaYear(new Date('2026-12-31T15:59:59Z'))).toBe(2026);
  });

  it('rolls to the new year at Manila midnight (UTC+8) on Jan 1', () => {
    expect(resolveManilaYear(new Date('2026-12-31T16:00:00Z'))).toBe(2027);
  });

  it('is the new year for a UTC instant already in January', () => {
    expect(resolveManilaYear(new Date('2027-01-01T00:00:00Z'))).toBe(2027);
  });

  it('returns the calendar year for a clear mid-year instant', () => {
    expect(resolveManilaYear(new Date('2026-06-15T12:00:00Z'))).toBe(2026);
  });
});
