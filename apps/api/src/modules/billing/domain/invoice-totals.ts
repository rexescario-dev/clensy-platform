// Pure, deterministic, integer-only invoice arithmetic (spec §4.5).
// `subtotal` is the exact integer sum of the (already-resolved, integer)
// line amounts; `total = subtotal - discount`. The `0 <= discount <=
// subtotal` guard is stated now for #40 — in #38 `discountMinorUnits` is
// always `0`, so it holds trivially and a `RangeError` here would be a bug.
// No rounding, no division, no floating point.
export interface InvoiceTotalsInput {
  lineAmountsMinorUnits: number[];
  discountMinorUnits: number;
}

export interface InvoiceTotalsResult {
  subtotalMinorUnits: number;
  totalMinorUnits: number;
}

export function computeInvoiceTotals(
  input: InvoiceTotalsInput,
): InvoiceTotalsResult {
  const subtotalMinorUnits = input.lineAmountsMinorUnits.reduce(
    (sum, amount) => sum + amount,
    0,
  );

  if (
    !Number.isInteger(input.discountMinorUnits) ||
    input.discountMinorUnits < 0 ||
    input.discountMinorUnits > subtotalMinorUnits
  ) {
    throw new RangeError(
      `discountMinorUnits must be an integer in [0, ${subtotalMinorUnits}], got ${input.discountMinorUnits}`,
    );
  }

  return {
    subtotalMinorUnits,
    totalMinorUnits: subtotalMinorUnits - input.discountMinorUnits,
  };
}
