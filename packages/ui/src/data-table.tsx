import type { KeyboardEvent, ReactNode } from 'react';

import { Button } from './button';
import { ErrorState } from './error-state';
import { LoadingState } from './loading-state';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
}

export interface DataTablePaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  loading?: boolean;
  error?: string;
  onRowClick?: (row: T) => void;
  pagination?: DataTablePaginationProps;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  rowKey,
  emptyMessage = 'No data.',
  loading = false,
  error,
  onRowClick,
  pagination,
}: DataTableProps<T>) {
  const handleRowKeyDown = (event: KeyboardEvent<HTMLTableRowElement>, row: T) => {
    if (!onRowClick) return;
    if (event.key === 'Enter') {
      onRowClick(row);
    } else if (event.key === ' ') {
      event.preventDefault();
      onRowClick(row);
    }
  };

  const pageCount = pagination ? Math.max(1, Math.ceil(pagination.totalCount / pagination.pageSize)) : 0;

  return (
    <div>
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200">
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-2 font-medium text-slate-600">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-2">
                <LoadingState />
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-2">
                <ErrorState message={error} />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-6 text-center text-slate-500">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                className={`border-b border-slate-100${onRowClick ? ' cursor-pointer hover:bg-slate-50' : ''}`}
                {...(onRowClick
                  ? {
                      role: 'button',
                      tabIndex: 0,
                      onClick: () => onRowClick(row),
                      onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => handleRowKeyDown(event, row),
                    }
                  : {})}
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-2">
                    {column.render ? column.render(row) : String(row[column.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {pagination ? (
        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2 text-sm text-slate-600">
          <Button
            variant="secondary"
            disabled={pagination.page <= 1}
            onClick={() => pagination.onPageChange(pagination.page - 1)}
          >
            Previous
          </Button>
          <span>
            Page {pagination.page} of {pageCount}
          </span>
          <Button
            variant="secondary"
            disabled={pagination.page >= pageCount}
            onClick={() => pagination.onPageChange(pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
