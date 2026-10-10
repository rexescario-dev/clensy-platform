'use client';

import type { ChangeEvent } from 'react';
import {
  Button,
  DataTable,
  Input,
  Label,
  StatusBadge,
  type DataTableColumn,
  type DataTablePaginationProps,
} from '@clensy/ui';
import { useClensyTranslations } from '../i18n/use-clensy-translations';
import { formatWeightGrams } from './format-weight-grams';
import { clickedLaundrySortKey, nextLaundryOrderSort, type LaundryOrderSortState } from './laundry-order-sort';
import {
  LAUNDRY_ORDER_STATUSES,
  LAUNDRY_STATUS_TONE,
  type LaundryFulfillmentType,
  type LaundryOrderStatus,
} from './laundry-order-status';

export interface LaundryOrderRow {
  id: string;
  createdAt: unknown;
  customer: { id: string; fullName: string };
  fulfillmentType: LaundryFulfillmentType;
  status: LaundryOrderStatus;
  totalMinorUnits: number | null;
  weightGrams: number | null;
  [key: string]: unknown;
}

export interface LaundryOrderListFilters {
  fulfillment: LaundryFulfillmentType | null;
  search: string;
  status: LaundryOrderStatus | null;
}

export interface LaundryOrderDataTableProps {
  filters: LaundryOrderListFilters;
  filtersActive: boolean;
  formatPrice: (minorUnits: number) => string;
  hasError?: boolean;
  loading?: boolean;
  onClearFilters: () => void;
  onFulfillmentChange: (fulfillment: LaundryFulfillmentType | null) => void;
  onRowClick?: (order: LaundryOrderRow) => void;
  onSearchChange: (search: string) => void;
  // The next sort after a header click, or `null` to restore the default
  // (`nextLaundryOrderSort`).
  onSortChange: (sort: LaundryOrderSortState | null) => void;
  onStatusChange: (status: LaundryOrderStatus | null) => void;
  orders: LaundryOrderRow[];
  pagination: DataTablePaginationProps;
  refreshing?: boolean;
  sort: LaundryOrderSortState;
}

const FULFILLMENT_TYPES: readonly LaundryFulfillmentType[] = ['PICKUP', 'DELIVERY'];

// The existing laundry form select style (`@clensy/ui` has no Select).
const SELECT_CLASS =
  'rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400';

const SHORT_ID_LENGTH = 8;

export function LaundryOrderDataTable({
  filters,
  filtersActive,
  formatPrice,
  hasError,
  loading,
  onClearFilters,
  onFulfillmentChange,
  onRowClick,
  onSearchChange,
  onSortChange,
  onStatusChange,
  orders,
  pagination,
  refreshing,
  sort,
}: LaundryOrderDataTableProps) {
  const t = useClensyTranslations('laundry');

  const statusBadge = (status: LaundryOrderStatus) => (
    <StatusBadge label={t(`status.${status}`)} tone={LAUNDRY_STATUS_TONE[status]} />
  );
  const weight = (grams: number | null) => (grams === null ? '—' : formatWeightGrams(grams));
  const total = (minorUnits: number | null) => (minorUnits === null ? '—' : formatPrice(minorUnits));

  const columns: DataTableColumn<LaundryOrderRow>[] = [
    // Not sortable: the server's only customer sort is `customerId`, which
    // groups orders but is not alphabetical, as a Customer heading implies.
    { header: t('list.columns.customer'), key: 'customer', render: 'customer.fullName' },
    { header: t('list.columns.order'), key: 'id', render: (row) => <OrderId id={row.id} />, sortable: true, sortKey: 'id' },
    {
      header: t('list.columns.fulfillment'),
      key: 'fulfillmentType',
      render: (row) => t(`fulfillment.${row.fulfillmentType}`),
      sortable: true,
      sortKey: 'fulfillmentType',
    },
    { header: t('list.columns.status'), key: 'status', render: (row) => statusBadge(row.status), sortable: true, sortKey: 'status' },
    { header: t('list.columns.weight'), key: 'weight', render: (row) => weight(row.weightGrams) },
    { header: t('list.columns.total'), key: 'total', render: (row) => total(row.totalMinorUnits) },
    {
      header: t('list.columns.created'),
      key: 'createdAt',
      render: (row) => formatCreatedAt(row.createdAt),
      sortable: true,
      sortKey: 'createdAt',
    },
  ];

  // Content only: `DataTable` wraps each card in the row hit target
  // (click, Enter, Space), so nothing here is a link or a button.
  function renderMobileRow(row: LaundryOrderRow) {
    return (
      <div className="flex min-w-0 flex-col gap-1 rounded-md border border-slate-200 p-3">
        <div className="flex items-start justify-between gap-2">
          <span className="min-w-0 break-words font-medium text-slate-900">{row.customer.fullName}</span>
          {statusBadge(row.status)}
        </div>
        <div className="text-sm text-slate-600">
          {t(`fulfillment.${row.fulfillmentType}`)} · <OrderId id={row.id} />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
          <span>
            {t('list.columns.weight')}: {weight(row.weightGrams)}
          </span>
          <span>
            {t('list.columns.total')}: {total(row.totalMinorUnits)}
          </span>
          <span>{formatCreatedAt(row.createdAt)}</span>
        </div>
      </div>
    );
  }

  function handleStatusChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.currentTarget.value;
    onStatusChange(value === '' ? null : (value as LaundryOrderStatus));
  }

  function handleFulfillmentChange(event: ChangeEvent<HTMLSelectElement>) {
    const value = event.currentTarget.value;
    onFulfillmentChange(value === '' ? null : (value as LaundryFulfillmentType));
  }

  const toolbar = (
    <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex min-w-0 flex-col gap-1 sm:w-72">
        <Label htmlFor="laundry-order-search">{t('list.search')}</Label>
        <Input
          id="laundry-order-search"
          type="search"
          value={filters.search}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
        />
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="laundry-order-status-filter">{t('list.filters.status')}</Label>
        <select
          id="laundry-order-status-filter"
          value={filters.status ?? ''}
          onChange={handleStatusChange}
          className={SELECT_CLASS}
        >
          <option value="">{t('list.filters.all')}</option>
          {LAUNDRY_ORDER_STATUSES.map((status) => (
            <option key={status} value={status}>
              {t(`status.${status}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor="laundry-order-fulfillment-filter">{t('list.filters.fulfillment')}</Label>
        <select
          id="laundry-order-fulfillment-filter"
          value={filters.fulfillment ?? ''}
          onChange={handleFulfillmentChange}
          className={SELECT_CLASS}
        >
          <option value="">{t('list.filters.all')}</option>
          {FULFILLMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {t(`fulfillment.${type}`)}
            </option>
          ))}
        </select>
      </div>
      {filtersActive ? (
        <Button type="button" variant="outline" onClick={onClearFilters}>
          {t('list.filters.clear')}
        </Button>
      ) : null}
    </div>
  );

  return (
    <DataTable
      columns={columns}
      rows={orders}
      rowKey={(row) => row.id}
      emptyMessage={filtersActive ? t('list.emptyFiltered') : t('empty')}
      loading={loading}
      error={hasError ? t('error.list') : undefined}
      onRowClick={onRowClick}
      pagination={pagination}
      sort={sort}
      // Only the clicked column is taken from DataTable. The next state is
      // the list's own transition, and an unsupported key is ignored.
      onSortChange={(reported) => {
        const clicked = clickedLaundrySortKey(sort, reported);
        if (clicked !== undefined) onSortChange(nextLaundryOrderSort(sort, clicked));
      }}
      refreshing={refreshing}
      mobileRow={renderMobileRow}
      toolbar={toolbar}
    />
  );
}

// Same rendering as the previous list's Created column and the bookings
// table's `formatScheduledAt`. No date library.
function formatCreatedAt(value: unknown): string {
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
}

// A short id is the visible label. The full id stays in `title` and in
// screen-reader text, so it is reachable for exact-id search.
function OrderId({ id }: { id: string }) {
  return (
    <span className="font-mono text-xs" title={id}>
      <span aria-hidden="true">{id.slice(0, SHORT_ID_LENGTH)}</span>
      <span className="sr-only">{id}</span>
    </span>
  );
}
