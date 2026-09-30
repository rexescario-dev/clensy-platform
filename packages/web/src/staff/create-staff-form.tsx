'use client';

import { FormField } from '@clensy/ui';
import { useClensyTranslations } from '../i18n/use-clensy-translations';
import type { StaffErrorKey } from './staff-errors';
import { STAFF_ROLE_GROUPS, type StaffRole } from './staff-roles';

export interface CreateStaffFormValues {
  email: string;
  password: string;
  role: StaffRole;
}

export interface CreateStaffFormProps {
  values: CreateStaffFormValues;
  onChange: (values: CreateStaffFormValues) => void;
  errorKey?: StaffErrorKey;
}

// Fields only — the page owns FormDialog, submission and the mutation.
// Only tenant roles are offered: a Tenant Owner never creates a Super Admin
// (spec §4.3). The API enforces that independently. Native <select> because
// @clensy/ui has no grouped-select primitive and this slice adds none.
export function CreateStaffForm({ values, onChange, errorKey }: CreateStaffFormProps) {
  const t = useClensyTranslations('staff');

  return (
    <>
      <FormField
        label={t('form.email')}
        name="new-email"
        type="email"
        required
        value={values.email}
        onChange={(event) => onChange({ ...values, email: event.target.value })}
      />
      <FormField
        label={t('form.password')}
        name="new-password"
        type="password"
        required
        value={values.password}
        onChange={(event) => onChange({ ...values, password: event.target.value })}
      />
      <div className="flex flex-col gap-1">
        <label htmlFor="new-role" className="text-sm font-medium text-slate-700">
          {t('form.role')}
        </label>
        <select
          id="new-role"
          name="new-role"
          aria-describedby={values.role === 'TENANT_OWNER' ? 'new-role-hint' : undefined}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          value={values.role}
          onChange={(event) => onChange({ ...values, role: event.target.value as StaffRole })}
        >
          {STAFF_ROLE_GROUPS.map((group) => (
            <optgroup key={group.id} label={t(`roleGroups.${group.id}`)}>
              {group.roles.map((role) => (
                <option key={role} value={role}>
                  {t(`roles.${role}`)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {values.role === 'TENANT_OWNER' ? (
          <p id="new-role-hint" className="text-xs text-slate-500">
            {t('roleHint.TENANT_OWNER')}
          </p>
        ) : null}
      </div>
      {errorKey ? (
        <p role="alert" className="text-sm text-red-600">
          {t(`errors.${errorKey}`)}
        </p>
      ) : null}
    </>
  );
}
