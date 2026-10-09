import { Role } from '../../../platform/auth/domain/role';
import { appendPathSegment } from './label-override-path';

// Tenant label overrides spec §4.1, §4.2. Pure: returns the kept labels and
// every rejection (path + reason, never the stored value). Each path is
// rendered by appendPathSegment (§4.2 Path rendering, #129), so a stored key
// never reaches it raw.
// TenantLabelOverridesService, the only reader of the column, owns logging.

export type RelabelableRole = Exclude<Role, Role.SUPER_ADMIN>;

export type RoleLabels = Readonly<Partial<Record<RelabelableRole, string>>>;

export type LabelOverrideRejectionReason =
  | 'blank'
  | 'control-character'
  | 'not-a-string'
  | 'not-an-object'
  | 'too-long'
  | 'unknown-key';

export interface LabelOverrideRejection {
  path: string;
  reason: LabelOverrideRejectionReason;
}

export interface LabelOverrideValidation {
  labels: RoleLabels | null;
  rejections: readonly LabelOverrideRejection[];
}

type JsonObject = Readonly<Record<string, unknown>>;

// Derived from the enum, never listed (§4.2): a new Role joins this set and
// fails the drift test until someone decides whether tenants may relabel it.
// SUPER_ADMIN is a platform identity, not tenant staff.
export const RELABELABLE_ROLES: readonly RelabelableRole[] = Object.values(
  Role,
).filter((role): role is RelabelableRole => role !== Role.SUPER_ADMIN);

export const MAX_LABEL_CODE_POINTS = 64;

// The only supported locale. Also the `locale` the GraphQL field reports.
export const TENANT_LABEL_LOCALE = 'en';

const SUPPORTED_NAMESPACE = 'roles';
const ROLES_PATH = appendPathSegment(
  appendPathSegment('', TENANT_LABEL_LOCALE),
  SUPPORTED_NAMESPACE,
);
const CONTROL_CHARACTER = /\p{Cc}/u;

export function validateTenantLabelOverrides(
  raw: unknown,
): LabelOverrideValidation {
  const rejections: LabelOverrideRejection[] = [];
  const roles = rolesNode(raw, rejections);
  const labels: Partial<Record<RelabelableRole, string>> = {};
  for (const [key, value] of Object.entries(roles ?? {})) {
    const path = appendPathSegment(ROLES_PATH, key);
    if (!isRelabelableRole(key)) {
      rejections.push({ path, reason: 'unknown-key' });
      continue;
    }
    const checked = checkLabel(value);
    if ('label' in checked) {
      labels[key] = checked.label;
    } else {
      rejections.push({ path, reason: checked.reason });
    }
  }
  return {
    labels: Object.keys(labels).length > 0 ? labels : null,
    rejections,
  };
}

function checkLabel(
  value: unknown,
): { label: string } | { reason: LabelOverrideRejectionReason } {
  if (typeof value !== 'string') return { reason: 'not-a-string' };
  const label = value.trim();
  if (label.length === 0) return { reason: 'blank' };
  // Code points, not UTF-16 code units: a non-BMP character counts as one.
  if ([...label].length > MAX_LABEL_CODE_POINTS) return { reason: 'too-long' };
  if (CONTROL_CHARACTER.test(label)) return { reason: 'control-character' };
  return { label };
}

// An object is a non-null, non-array JSON object (§4.2); `typeof` alone is
// also true of null and arrays.
function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRelabelableRole(key: string): key is RelabelableRole {
  return (RELABELABLE_ROLES as readonly string[]).includes(key);
}

// Rejects every key of `node` other than `key` as unknown, then returns
// `node[key]` if it is an object. A missing key is absence, not a rejection.
// A rejected node is never descended into, so nothing beneath it is reported.
// `parent` is the node's rendered path, or '' for the top level.
function onlyChild(
  node: JsonObject,
  key: string,
  parent: string,
  rejections: LabelOverrideRejection[],
): JsonObject | null {
  for (const other of Object.keys(node)) {
    if (other !== key) {
      rejections.push({
        path: appendPathSegment(parent, other),
        reason: 'unknown-key',
      });
    }
  }
  if (!Object.hasOwn(node, key)) return null;
  const child = node[key];
  if (!isJsonObject(child)) {
    rejections.push({
      path: appendPathSegment(parent, key),
      reason: 'not-an-object',
    });
    return null;
  }
  return child;
}

// A NULL column (`null`) is "no overrides", not a rejection. `undefined` is
// not a database value: it falls through and is rejected as not-an-object.
// The service normalizes a missing row to `null`.
function rolesNode(
  raw: unknown,
  rejections: LabelOverrideRejection[],
): JsonObject | null {
  if (raw === null) return null;
  if (!isJsonObject(raw)) {
    rejections.push({ path: '$', reason: 'not-an-object' });
    return null;
  }
  const locale = onlyChild(raw, TENANT_LABEL_LOCALE, '', rejections);
  if (!locale) return null;
  return onlyChild(
    locale,
    SUPPORTED_NAMESPACE,
    TENANT_LABEL_LOCALE,
    rejections,
  );
}
