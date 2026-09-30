// Typed message keys for staff mutation failures. apps/web maps API errors
// to one of these; the `staff` namespace (errors.<key>) owns the text.
export const STAFF_ERROR_KEYS = [
  'emailInUse',
  'invalidInput',
  'createForbidden',
  'createFailed',
  'lastTenantOwner',
  'accountNotFound',
  'disableForbidden',
  'disableFailed',
] as const;

export type StaffErrorKey = (typeof STAFF_ERROR_KEYS)[number];
