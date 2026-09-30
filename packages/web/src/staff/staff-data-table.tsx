'use client';

import { Badge, Button, DataTable, StatusBadge, type DataTableColumn } from '@clensy/ui';
import { useClensyTranslations } from '../i18n/use-clensy-translations';
import { isStaffRole } from './staff-roles';

// `role: string` (not StaffRole) so rows from the API's wider `Role` type
// are assignable; the API only returns this tenant's rows (spec §4.9), and
// anything outside the tenant role set renders as its raw identifier.
export interface StaffMember {
  id: string;
  email: string;
  isActive: boolean;
  role: string;
  [key: string]: unknown;
}

export interface StaffDataTableProps {
  staff: StaffMember[];
  currentAdminId: string;
  loading?: boolean;
  hasError?: boolean;
  disabling?: boolean;
  onDisable: (member: StaffMember) => void;
}

type Translate = (key: string) => string;

interface StaffActionOptions {
  currentAdminId: string;
  disabling?: boolean;
  onDisable: (member: StaffMember) => void;
}

export function buildStaffColumns(t: Translate, options: StaffActionOptions): DataTableColumn<StaffMember>[] {
  return [
    { header: t('columns.email'), key: 'email' },
    { header: t('columns.role'), key: 'role', render: (row) => <RoleLabel role={row.role} t={t} /> },
    { header: t('columns.status'), key: 'status', render: (row) => <StatusLabel isActive={row.isActive} t={t} /> },
    { header: '', key: 'actions', render: (row) => renderDisableAction(row, t, options) },
  ];
}

export function StaffDataTable({ staff, currentAdminId, loading, hasError, disabling, onDisable }: StaffDataTableProps) {
  const t = useClensyTranslations('staff');
  const actionOptions = { currentAdminId, disabling, onDisable };
  const columns = buildStaffColumns(t, actionOptions);

  // Same helpers as the desktop columns — no second mapping.
  function renderMobileRow(row: StaffMember) {
    return (
      <div className="rounded-lg border p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium">{row.email}</span>
          <StatusLabel isActive={row.isActive} t={t} />
        </div>
        <div className="flex items-center justify-between pt-1">
          <RoleLabel role={row.role} t={t} />
          {renderDisableAction(row, t, actionOptions)}
        </div>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      rows={staff}
      rowKey={(row) => row.id}
      emptyMessage={t('empty')}
      loading={loading}
      error={hasError ? t('loadError') : undefined}
      mobileRow={renderMobileRow}
    />
  );
}

// Self-disable is rejected by the API (spec §4.3); not offering it is UX
// only — the API stays the authorization boundary.
function renderDisableAction(row: StaffMember, t: Translate, options: StaffActionOptions) {
  if (!row.isActive || row.id === options.currentAdminId) return null;
  return (
    <Button variant="destructive" disabled={options.disabling} onClick={() => options.onDisable(row)}>
      {t('actions.disable')}
    </Button>
  );
}

function RoleLabel({ role, t }: { role: string; t: Translate }) {
  if (!isStaffRole(role)) return <>{role}</>;
  const label = t(`roles.${role}`);
  // Tenant Owner is the tenant's administrator, not an operational role
  // (spec §3) — shown as a badge so the distinction reads at a glance.
  return role === 'TENANT_OWNER' ? <Badge variant="secondary">{label}</Badge> : <>{label}</>;
}

function StatusLabel({ isActive, t }: { isActive: boolean; t: Translate }) {
  return isActive ? (
    <StatusBadge label={t('status.active')} tone="success" />
  ) : (
    <StatusBadge label={t('status.disabled')} tone="danger" />
  );
}
