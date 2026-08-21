// Deterministic money helpers (M5 round 1 fix — see task-6-brief.md): both
// functions operate purely on integers/strings and never perform floating-
// point arithmetic on a currency value. `formatMinorUnits` never calls
// `.toFixed()` on a divided float; `parsePesosToMinorUnits` never calls
// `parseFloat`/multiplies by 100. The GraphQL API is minor-units-only
// everywhere (spec §4.5/§2) — these are purely UI input/display affordances.

export function formatMinorUnits(minorUnits: number): string {
  const whole = Math.trunc(minorUnits / 100);
  const fraction = String(minorUnits % 100).padStart(2, '0');
  return `₱${whole}.${fraction}`;
}

export function parsePesosToMinorUnits(input: string): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input.trim());
  if (!match) {
    throw new Error('Enter a valid amount, e.g. 19.99');
  }
  const [, wholePart, fractionPartRaw = ''] = match;
  const fractionPart = fractionPartRaw.padEnd(2, '0');
  return parseInt(wholePart + fractionPart, 10);
}

// Pre-fills an editable price input from a persisted value — the inverse
// display step of `formatMinorUnits`, without its `₱` prefix, so the result
// is directly re-parseable by `parsePesosToMinorUnits`. Kept next to
// `formatMinorUnits` rather than inlining `.replace('₱', '')` at each call
// site, since the prefix is this file's own formatting detail, not
// something a page should need to know about to strip back off.
export function toEditableAmount(minorUnits: number): string {
  return formatMinorUnits(minorUnits).replace('₱', '');
}

// Shared by every price-entry form (Catalog service pricing, Add-on
// create/edit): parses a pesos-string input and reports a user-facing
// error via the caller's own error-state setter on failure, instead of
// each call site repeating the same try/catch/`instanceof Error` shape.
// Returns `undefined` on failure — the caller should treat that as "stop,
// the error is already set" (matching the previous per-call-site
// `catch { ...; return; }` control flow).
export function parsePriceOrReportError(
  input: string,
  setError: (message: string) => void,
): number | undefined {
  try {
    return parsePesosToMinorUnits(input);
  } catch (parseError) {
    setError(parseError instanceof Error ? parseError.message : 'Enter a valid amount, e.g. 19.99');
    return undefined;
  }
}
