import { formatWeightGrams } from '@clensy/web';

// The largest weight `weighLaundryOrder` can carry: `weightGrams` is a
// GraphQL `Int!` (lifecycle spec §4.7), a signed 32-bit integer.
export const MAX_WEIGHT_GRAMS = 2_147_483_647;

// 9,999,999 kg: past this, whole kilograms exceed MAX_WEIGHT_GRAMS anyway,
// and the gram arithmetic below stays far inside MAX_SAFE_INTEGER.
const MAX_WHOLE_KILOGRAM_DIGITS = 7;

export type WeightEntryError = 'blank' | 'format' | 'notPositive' | 'tooLarge';

export type WeightEntryResult = { error: WeightEntryError; ok: false } | { grams: number; ok: true };

// One weight row (#155 §Calculation, lifecycle spec §8.4.4): a decimal
// kilogram string with at most three decimal places, so it is an exact
// whole number of grams. Split on the decimal point and add integers;
// never multiply a float (1.005 * 1000 is not 1005). Only ASCII digits and
// one point are accepted: no sign, exponent, comma or whitespace.
// Precedence (Global Constraints): blank; then one leading minus is set
// aside; then the format checks run on the rest, so a malformed negative
// (`-abc`, `-1.2345`) is `format`; then a negative that is otherwise a
// valid decimal (`-1`, `-0.5`, `-99999999`) is `notPositive`, as is zero
// (lifecycle spec §8.4.1); only then is a positive value `tooLarge`.
export function parseWeightEntry(text: string): WeightEntryResult {
  if (text.trim() === '') return { error: 'blank', ok: false };
  const negative = text.startsWith('-');
  const body = negative ? text.slice(1) : text;
  if (!/^[0-9.]+$/.test(body)) return { error: 'format', ok: false };
  const parts = body.split('.');
  if (parts.length > 2) return { error: 'format', ok: false };
  const [whole, fraction = ''] = parts;
  if (whole === '' && fraction === '') return { error: 'format', ok: false };
  if (fraction.length > 3) return { error: 'format', ok: false };
  if (negative) return { error: 'notPositive', ok: false };
  const wholeDigits = whole.replace(/^0+/, '');
  if (wholeDigits.length > MAX_WHOLE_KILOGRAM_DIGITS) return { error: 'tooLarge', ok: false };
  const grams = Number(wholeDigits === '' ? '0' : wholeDigits) * 1000 + Number(fraction.padEnd(3, '0'));
  if (grams === 0) return { error: 'notPositive', ok: false };
  if (grams > MAX_WEIGHT_GRAMS) return { error: 'tooLarge', ok: false };
  return { grams, ok: true };
}

export type WeightFormError = 'noEntries' | 'totalTooLarge';

export interface WeightEntrySummary {
  // `noEntries` with no rows; `totalTooLarge` when the valid rows add up
  // past MAX_WEIGHT_GRAMS; otherwise `null`.
  formError: WeightFormError | null;
  // One result per row, in row order.
  results: WeightEntryResult[];
  // At least one row, every row valid, and a total the mutation can carry.
  submittable: boolean;
  // The sum of the valid rows only. Shown live, even while a row is invalid.
  totalGrams: number;
}

export function summarizeWeightEntries(texts: readonly string[]): WeightEntrySummary {
  const results = texts.map(parseWeightEntry);
  const totalGrams = results.reduce((sum, result) => (result.ok ? sum + result.grams : sum), 0);
  const formError: WeightFormError | null =
    texts.length === 0 ? 'noEntries' : totalGrams > MAX_WEIGHT_GRAMS ? 'totalTooLarge' : null;
  const submittable = formError === null && results.every((result) => result.ok);
  return { formError, results, submittable, totalGrams };
}

// The re-weigh prefill (#155 §Re-weigh): the recorded grams as a kilogram
// entry, three decimals with trailing zeros trimmed to at least two. That
// is the shared formatter's number without its unit, so the field and the
// "Recorded weight" line always agree.
export function kilogramsInputFromGrams(grams: number): string {
  return formatWeightGrams(grams).replace(/ kg$/, '');
}
