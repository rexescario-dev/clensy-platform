// Integer grams → kilograms for display. Contract:
// - input: a non-negative safe integer number of grams; anything else
//   throws `RangeError` (`null` "not weighed" is the caller's to render);
// - output: `<kg>.<fraction> kg`, where `<kg>` is the whole kilograms with
//   no grouping and `<fraction>` is the three gram digits with one trailing
//   zero dropped, so it is always two or three digits:
//   1000 → 1.00 kg, 1250 → 1.25 kg, 1005 → 1.005 kg, 1 → 0.001 kg;
// - integer arithmetic only, so no value rounds: 1 g never renders as
//   0.00 kg, and the largest safe integer renders exactly.
// Money stays `formatMinorUnits` in apps/web.
export function formatWeightGrams(grams: number): string {
  if (!Number.isSafeInteger(grams) || grams < 0) {
    throw new RangeError(`weight must be a non-negative integer number of grams, got ${grams}`);
  }
  const remainder = grams % 1000;
  const kilograms = (grams - remainder) / 1000;
  const fraction = String(remainder).padStart(3, '0');
  const decimals = fraction.endsWith('0') ? fraction.slice(0, 2) : fraction;
  return `${kilograms}.${decimals} kg`;
}
