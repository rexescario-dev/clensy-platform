const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Syntax check for the client-generated idempotency key (spec §4.5 A1).
// No trimming: surrounding whitespace is invalid.
export function isCanonicalUuid(value: string): boolean {
  return CANONICAL_UUID.test(value);
}
