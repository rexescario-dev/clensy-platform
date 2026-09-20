'use client';

import { DataTable, type DataTableColumn, type DataTablePaginationProps } from '@clensy/ui';
import { resolveMessage } from '../i18n/resolve-message';
import { useClensyTranslations } from '../i18n/use-clensy-translations';

export type BookingStatus = 'CANCELLED' | 'COMPLETED' | 'CONFIRMED' | 'PENDING';

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
}

// Copied verbatim from apps/web/app/app/bookings/page.tsx (2026-09-19) — not
// reconstructed. Date formatting has enough locale/timezone subtlety that a
// re-derivation would risk a silent behavior change.
function formatScheduledAt(value: unknown): string {
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

export function BookingDataTable({
  bookings,
  formatPrice,
  loading,
  hasError,
  errorMessage,
  onRowClick,
  pagination,
}: BookingDataTableProps) {
  const t = useClensyTranslations('bookings');
  const resolvedErrorMessage = hasError ? resolveMessage(errorMessage, t('error')) : undefined;

  const columns: DataTableColumn<Booking>[] = [
    { header: t('columns.customer'), key: 'customer', render: 'customer.fullName' },
    { header: t('columns.property'), key: 'property', render: 'property.addressLine1' },
    { header: t('columns.service'), key: 'service', render: 'service.name' },
    { header: t('columns.scheduled'), key: 'scheduledAt', render: (row) => formatScheduledAt(row.scheduledAt) },
    { header: t('columns.status'), key: 'status', render: 'status' },
    { header: t('columns.team'), key: 'team', render: (row) => row.team?.name ?? t('unassigned') },
    {
      header: t('columns.price'),
      key: 'price',
      render: (row) => formatPrice(row.pricingSnapshot.priceMinorUnits),
    },
  ];

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
    />
  );
}
