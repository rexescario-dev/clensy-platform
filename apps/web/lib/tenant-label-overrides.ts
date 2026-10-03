import type { CurrentAdminQuery } from '@clensy/client';
import { STAFF_ROLE_OPTIONS, type ClensyMessages, type DeepPartial, type StaffRole } from '@clensy/web';

type TenantLabelOverrides = NonNullable<CurrentAdminQuery['currentAdmin']['tenantLabelOverrides']>;

// The tenant layer of the app i18n boundary (tenant label overrides spec
// §4.4). Data only: it never sees the query's loading/error flags, and it
// does not revalidate values (the API is authoritative). It applies nothing
// for another locale's catalog, and never forwards null, which deepMerge
// would otherwise write over the package default. Keys are bounded to the
// six tenant roles, which also drops Apollo's runtime __typename.
export function tenantLayer(
  overrides: TenantLabelOverrides | null | undefined,
  locale: string,
): DeepPartial<ClensyMessages> {
  if (!overrides || overrides.locale !== locale) return {};
  const roles: Partial<Record<StaffRole, string>> = {};
  for (const role of STAFF_ROLE_OPTIONS) {
    const label = overrides.roles[role];
    if (typeof label === 'string') roles[role] = label;
  }
  return { roles };
}
