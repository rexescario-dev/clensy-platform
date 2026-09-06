import { computeInvoiceTotals } from '../../domain/invoice-totals';

describe('computeInvoiceTotals', () => {
  it('sums no lines to a zero subtotal and total', () => {
    expect(
      computeInvoiceTotals({
        lineAmountsMinorUnits: [],
        discountMinorUnits: 0,
      }),
    ).toEqual({ subtotalMinorUnits: 0, totalMinorUnits: 0 });
  });

  it('sums line amounts and subtracts a zero discount', () => {
    expect(
      computeInvoiceTotals({
        lineAmountsMinorUnits: [1200, 800, 50],
        discountMinorUnits: 0,
      }),
    ).toEqual({ subtotalMinorUnits: 2050, totalMinorUnits: 2050 });
  });

  it('subtracts a discount equal to the subtotal to a zero total', () => {
    expect(
      computeInvoiceTotals({
        lineAmountsMinorUnits: [1200, 800, 50],
        discountMinorUnits: 2050,
      }),
    ).toEqual({ subtotalMinorUnits: 2050, totalMinorUnits: 0 });
  });

  it('subtracts a partial discount', () => {
    expect(
      computeInvoiceTotals({
        lineAmountsMinorUnits: [1000],
        discountMinorUnits: 250,
      }),
    ).toEqual({ subtotalMinorUnits: 1000, totalMinorUnits: 750 });
  });

  it('rejects a discount larger than the subtotal', () => {
    expect(() =>
      computeInvoiceTotals({
        lineAmountsMinorUnits: [1000],
        discountMinorUnits: 1001,
      }),
    ).toThrow(RangeError);
  });

  it('rejects a negative discount', () => {
    expect(() =>
      computeInvoiceTotals({
        lineAmountsMinorUnits: [1000],
        discountMinorUnits: -1,
      }),
    ).toThrow(RangeError);
  });

  it('rejects a non-integer discount', () => {
    expect(() =>
      computeInvoiceTotals({
        lineAmountsMinorUnits: [1000],
        discountMinorUnits: 1.5,
      }),
    ).toThrow(RangeError);
  });

  it('is deterministic for identical inputs', () => {
    const input = {
      lineAmountsMinorUnits: [333, 667, 1000],
      discountMinorUnits: 0,
    };
    expect(computeInvoiceTotals(input)).toEqual(computeInvoiceTotals(input));
  });
});
