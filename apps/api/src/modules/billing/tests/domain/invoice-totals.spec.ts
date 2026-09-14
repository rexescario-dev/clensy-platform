import { computeInvoiceTotals } from '../../domain/invoice-totals';

describe('computeInvoiceTotals', () => {
  it('sums no lines to a zero subtotal and total', () => {
    expect(
      computeInvoiceTotals({
        discountMinorUnits: 0,
        lineAmountsMinorUnits: [],
      }),
    ).toEqual({ subtotalMinorUnits: 0, totalMinorUnits: 0 });
  });

  it('sums line amounts and subtracts a zero discount', () => {
    expect(
      computeInvoiceTotals({
        discountMinorUnits: 0,
        lineAmountsMinorUnits: [1200, 800, 50],
      }),
    ).toEqual({ subtotalMinorUnits: 2050, totalMinorUnits: 2050 });
  });

  it('subtracts a discount equal to the subtotal to a zero total', () => {
    expect(
      computeInvoiceTotals({
        discountMinorUnits: 2050,
        lineAmountsMinorUnits: [1200, 800, 50],
      }),
    ).toEqual({ subtotalMinorUnits: 2050, totalMinorUnits: 0 });
  });

  it('subtracts a partial discount', () => {
    expect(
      computeInvoiceTotals({
        discountMinorUnits: 250,
        lineAmountsMinorUnits: [1000],
      }),
    ).toEqual({ subtotalMinorUnits: 1000, totalMinorUnits: 750 });
  });

  it('rejects a discount larger than the subtotal', () => {
    expect(() =>
      computeInvoiceTotals({
        discountMinorUnits: 1001,
        lineAmountsMinorUnits: [1000],
      }),
    ).toThrow(RangeError);
  });

  it('rejects a negative discount', () => {
    expect(() =>
      computeInvoiceTotals({
        discountMinorUnits: -1,
        lineAmountsMinorUnits: [1000],
      }),
    ).toThrow(RangeError);
  });

  it('rejects a non-integer discount', () => {
    expect(() =>
      computeInvoiceTotals({
        discountMinorUnits: 1.5,
        lineAmountsMinorUnits: [1000],
      }),
    ).toThrow(RangeError);
  });

  it('is deterministic for identical inputs', () => {
    const input = {
      discountMinorUnits: 0,
      lineAmountsMinorUnits: [333, 667, 1000],
    };
    expect(computeInvoiceTotals(input)).toEqual(computeInvoiceTotals(input));
  });
});
