// Small local JSON-value union — gives the AuditEvent `metadata` field's
// "must be JSON-serializable" constraint (spec §4.6) a compile-time
// approximation, rather than typing it as `Record<string, unknown>`.
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
