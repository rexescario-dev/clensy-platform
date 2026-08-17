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
