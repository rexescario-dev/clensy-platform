import { DataTable, type DataTableColumn, type DataTablePaginationProps } from '@clensy/ui';

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
  error?: string;
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
  error,
  onRowClick,
  pagination,
}: BookingDataTableProps) {
  const columns: DataTableColumn<Booking>[] = [
    { header: 'Customer', key: 'customer', render: 'customer.fullName' },
    { header: 'Property', key: 'property', render: 'property.addressLine1' },
    { header: 'Service', key: 'service', render: 'service.name' },
    { header: 'Scheduled', key: 'scheduledAt', render: (row) => formatScheduledAt(row.scheduledAt) },
    { header: 'Status', key: 'status', render: 'status' },
    { header: 'Team', key: 'team', render: (row) => row.team?.name ?? 'Unassigned' },
    {
      header: 'Price',
      key: 'price',
      render: (row) => formatPrice(row.pricingSnapshot.priceMinorUnits),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={bookings}
      rowKey={(row) => row.id}
      emptyMessage="No bookings."
      loading={loading}
      error={error}
      onRowClick={onRowClick}
      pagination={pagination}
    />
  );
}
