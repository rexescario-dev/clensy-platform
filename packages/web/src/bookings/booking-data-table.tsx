'use client';

import { Badge, DataTable, type DataTableColumn, type DataTablePaginationProps } from '@clensy/ui';
import { useClensyTranslations } from '../i18n/use-clensy-translations';

export type BookingStatus = 'CANCELLED' | 'COMPLETED' | 'CONFIRMED' | 'PENDING';

export type BookingSortKey = 'scheduledAt' | 'status';

export interface BookingSortState {
  key: BookingSortKey;
  direction: 'asc' | 'desc';
}

export interface Booking {
  id: string;
  scheduledAt: unknown;
  status: BookingStatus;
  pricingSnapshot: { priceMinorUnits: number };
  customer: { id: string; fullName: string };
  property: { id: string; addressLine1: string };
  service: { id: string; name: string };
  team: { id: string; name: string } | null;
  [key: string]: unknown;
}

export interface BookingDataTableProps {
  bookings: Booking[];
  formatPrice: (minorUnits: number) => string;
  loading?: boolean;
  hasError?: boolean;
  errorMessage?: string;
  onRowClick?: (booking: Booking) => void;
  pagination: DataTablePaginationProps;
  sort?: BookingSortState | null;
  onSortChange?: (sort: BookingSortState | null) => void;
  refreshing?: boolean;
}

// Copied verbatim from apps/web/app/app/bookings/page.tsx (2026-09-19) — not
// reconstructed. Date formatting has enough locale/timezone subtlety that a
// re-derivation would risk a silent behavior change.
function formatScheduledAt(value: unknown): string {
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

type BadgeVariant = 'default' | 'destructive' | 'outline' | 'secondary';

interface BookingStatusConfig {
  variant: BadgeVariant;
  labelKey: string;
}

// One centralized status → { Badge variant, translation key } lookup — not
// two independently-maintained maps. row.status crosses a GraphQL API
// boundary this component does not control, so a status value outside the
// four known members (e.g. the backend ships a fifth status before this
// table is updated) must degrade safely rather than render undefined/throw.
const BOOKING_STATUS_CONFIG: Record<BookingStatus, BookingStatusConfig> = {
  CANCELLED: { variant: 'destructive', labelKey: 'status.cancelled' },
  COMPLETED: { variant: 'secondary', labelKey: 'status.completed' },
  CONFIRMED: { variant: 'default', labelKey: 'status.confirmed' },
  PENDING: { variant: 'outline', labelKey: 'status.pending' },
};

function bookingStatusBadge(status: BookingStatus, t: (key: string) => string): { variant: BadgeVariant; label: string } {
  const config = BOOKING_STATUS_CONFIG[status];
  if (!config) return { variant: 'outline', label: status };
  const label = t(config.labelKey);
  return { variant: config.variant, label: label === config.labelKey ? status : label }; // t() returns the key itself on a miss
}

export function BookingDataTable({
  bookings,
  formatPrice,
  loading,
  hasError,
  errorMessage,
  onRowClick,
  pagination,
  sort,
  onSortChange,
  refreshing,
}: BookingDataTableProps) {
  const t = useClensyTranslations('bookings');
  // Not resolveMessage(errorMessage, t('error')): DataTable's `error` prop
  // (below) is an @clensy/ui primitive and out of bounds to change — it is
  // itself truthy-gated and can never display an empty-string override as
  // "an error occurred." An empty override therefore falls back to the
  // default here, specifically because of that downstream constraint.
  const resolvedErrorMessage = hasError ? errorMessage || t('error') : undefined;

  const columns: DataTableColumn<Booking>[] = [
    { header: t('columns.customer'), key: 'customer', render: 'customer.fullName' },
    { header: t('columns.property'), key: 'property', render: 'property.addressLine1' },
    { header: t('columns.service'), key: 'service', render: 'service.name' },
    { header: t('columns.scheduled'), key: 'scheduledAt', render: (row) => formatScheduledAt(row.scheduledAt), sortable: true, sortKey: 'scheduledAt' },
    {
      header: t('columns.status'),
      key: 'status',
      render: (row) => {
        const { variant, label } = bookingStatusBadge(row.status, t);
        return <Badge variant={variant}>{label}</Badge>;
      },
      sortable: true,
      sortKey: 'status',
    },
    { header: t('columns.team'), key: 'team', render: (row) => row.team?.name ?? t('unassigned') },
    {
      header: t('columns.price'),
      key: 'price',
      render: (row) => formatPrice(row.pricingSnapshot.priceMinorUnits),
    },
  ];

  // Reuses the exact same formatScheduledAt/formatPrice/bookingStatusBadge
  // helpers as the desktop columns above — no second data mapping.
  function renderMobileRow(row: Booking) {
    const { variant, label } = bookingStatusBadge(row.status, t);
    return (
      <div key={row.id} className="rounded-lg border p-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-muted-foreground">{row.id}</span>
          <Badge variant={variant}>{label}</Badge>
        </div>
        <div className="font-medium">{row.customer.fullName}</div>
        <div className="text-muted-foreground">{formatScheduledAt(row.scheduledAt)}</div>
        <div className="text-muted-foreground">{row.property.addressLine1}</div>
        <div className="flex items-center justify-between pt-1">
          <span>{row.service.name}</span>
          <span>{formatPrice(row.pricingSnapshot.priceMinorUnits)}</span>
        </div>
      </div>
    );
  }

  return (
    <DataTable
      columns={columns}
      rows={bookings}
      rowKey={(row) => row.id}
      emptyMessage={t('empty')}
      loading={loading}
      error={resolvedErrorMessage}
      onRowClick={onRowClick}
      pagination={pagination}
      sort={sort}
      onSortChange={onSortChange}
      refreshing={refreshing}
      mobileRow={renderMobileRow}
    />
  );
}
