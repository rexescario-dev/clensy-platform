import { formatInvoiceNumber } from '../../domain/invoice-number';

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
