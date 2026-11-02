// Refundable amount of a payment (spec §3): the original amount minus the
// sum of its COMPLETED refunds. Never negative; a negative result means the
// refund ceiling was already breached, which is a bug, so it throws.
export function refundableMinorUnits(
  originalAmountMinorUnits: number,
  completedRefundAmountsMinorUnits: readonly number[],
): number {
  const refunded = completedRefundAmountsMinorUnits.reduce(
    (sum, amount) => sum + amount,
    0,
  );
  const remaining = originalAmountMinorUnits - refunded;
  if (!Number.isSafeInteger(remaining) || remaining < 0) {
    throw new RangeError('Refunds exceed the original payment amount');
  }
  return remaining;
}
