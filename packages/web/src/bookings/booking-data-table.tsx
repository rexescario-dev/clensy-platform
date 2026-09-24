'use client';

import type { ChangeEvent } from 'react';
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
  // No key here: `DataTable` owns `rowKey` and now keys the wrapping
  // element it renders around each mobileRow(row) itself (#65 finding 2) —
  // this stays a plain content renderer, matching how columns/render never
  // key their own output either.
  function renderMobileRow(row: Booking) {
    const { variant, label } = bookingStatusBadge(row.status, t);
    return (
      <div className="rounded-lg border p-3 text-sm">
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

  // Only rendered (as `toolbar`) when onSortChange is supplied — a
  // sort control with nothing to call would be a false affordance.
  const mobileSortControl = onSortChange ? (
    <BookingMobileSortControl sort={sort} onSortChange={onSortChange} t={t} />
  ) : undefined;

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
      // DataTable's onSortChange accepts DataTableSortState (key: string),
      // wider than BookingSortState (key: BookingSortKey). Narrowing cast is
      // safe here because DataTable only ever reports a `key` that round-
      // trips one of this component's own columns' sortKey values above
      // ('scheduledAt' | 'status', both BookingSortKey members) — never an
      // arbitrary string.
      onSortChange={onSortChange ? (sort) => onSortChange(sort as BookingSortState | null) : undefined}
      refreshing={refreshing}
      mobileRow={renderMobileRow}
      toolbar={mobileSortControl}
    />
  );
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

// #65 finding 1 (final review): changing the sort key from the mobile
// select preserves whatever direction is currently active (or the
// table-wide default direction, 'desc', if there is no active sort yet) —
// it never resets to a hardcoded direction. Pure/exported so the reducer
// itself is directly testable without simulating a <select> change event
// (this repo's renderToStaticMarkup-only test setup can't do that).
export function nextMobileSortState(
  current: BookingSortState | null | undefined,
  changedKey: BookingSortKey,
): BookingSortState {
  return { key: changedKey, direction: current?.direction ?? 'desc' };
}

// Flips the current direction, defaulting to the same table-wide default
// (scheduledAt desc) as everything else in this table when there is no
// active sort yet. Pure/exported for the same reason as above.
export function toggledMobileSortDirection(current: BookingSortState | null | undefined): BookingSortState {
  const key = current?.key ?? 'scheduledAt';
  const direction = current?.direction === 'asc' ? 'desc' : 'asc';
  return { key, direction };
}

// #65 finding 1 (final review): DataTable's `toolbar` prop renders above
// BOTH the desktop table and the mobile card list (see data-table.tsx) —
// wrapping this control's own markup in `sm:hidden` makes it visible only
// on the mobile card list, giving mobile a sort affordance without adding
// any sort-domain knowledge to the generic `@clensy/ui` DataTable. It
// calls the exact same `onSortChange` the desktop sortable headers already
// use — no separate, disconnected sort state.
function BookingMobileSortControl({
  sort,
  onSortChange,
  t,
}: {
  sort: BookingSortState | null | undefined;
  onSortChange: (sort: BookingSortState | null) => void;
  t: (key: string) => string;
}) {
  const activeKey: BookingSortKey = sort?.key ?? 'scheduledAt';
  const activeDirection: 'asc' | 'desc' = sort?.direction ?? 'desc';

  function handleKeyChange(event: ChangeEvent<HTMLSelectElement>) {
    onSortChange(nextMobileSortState(sort, event.currentTarget.value as BookingSortKey));
  }

  function handleDirectionToggle() {
    onSortChange(toggledMobileSortDirection(sort));
  }

  return (
    <div className="sm:hidden flex w-full items-center gap-2">
      <select
        aria-label={t('sort.label')}
        value={activeKey}
        onChange={handleKeyChange}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
      >
        <option value="scheduledAt">{t('columns.scheduled')}</option>
        <option value="status">{t('columns.status')}</option>
      </select>
      <button
        type="button"
        onClick={handleDirectionToggle}
        aria-label={activeDirection === 'asc' ? t('sort.ascending') : t('sort.descending')}
        className="rounded-md border border-input bg-background px-2 py-1 text-sm"
      >
        {activeDirection === 'asc' ? '↑' : '↓'}
      </button>
    </div>
  );
}

function bookingStatusBadge(status: BookingStatus, t: (key: string) => string): { variant: BadgeVariant; label: string } {
  const config = BOOKING_STATUS_CONFIG[status];
  if (!config) return { variant: 'outline', label: status };
  const label = t(config.labelKey);
  return { variant: config.variant, label: label === config.labelKey ? status : label }; // t() returns the key itself on a miss
}

// Copied verbatim from apps/web/app/app/bookings/page.tsx (2026-09-19) — not
// reconstructed. Date formatting has enough locale/timezone subtlety that a
// re-derivation would risk a silent behavior change.
function formatScheduledAt(value: unknown): string {
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}
