// Formats a non-negative integer amount of minor units as pesos for
// user-facing server messages, e.g. 5000 -> "₱50.00". Integer arithmetic
// only (spec §4.5): no division result is ever formatted as a float.
export function formatPesos(minorUnits: number): string {
  const whole = Math.trunc(minorUnits / 100);
  const fraction = String(minorUnits % 100).padStart(2, '0');
  return `₱${whole}.${fraction}`;
}
