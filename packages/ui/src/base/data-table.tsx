import type { KeyboardEvent, ReactNode } from 'react';
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from 'lucide-react';
import { Checkbox } from './checkbox';
import { ErrorState } from './error-state';
import { LoadingState } from './loading-state';
import { Pagination, type DataTablePaginationProps } from './pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  sortable?: boolean;
  align?: 'center' | 'left' | 'right';
  width?: string;
}

export interface DataTableSortState {
  key: string;
  direction: 'asc' | 'desc';
}

export interface DataTableSelectionProps<T> {
  selectedKeys: string[];
  onSelectionChange: (keys: string[]) => void;
  isRowSelectable?: (row: T) => boolean;
}

export type { DataTablePaginationProps };

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  emptyMessage?: string;
  loading?: boolean;
  error?: string;
  onRowClick?: (row: T) => void;
  pagination?: DataTablePaginationProps;
  sort?: DataTableSortState | null;
  onSortChange?: (sort: DataTableSortState | null) => void;
  selection?: DataTableSelectionProps<T>;
  toolbar?: ReactNode;
}

const ALIGN_CLASS = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const satisfies Record<NonNullable<DataTableColumn<unknown>['align']>, string>;

export function nextSortState(
  current: DataTableSortState | null | undefined,
  key: string,
): DataTableSortState | null {
  if (!current || current.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return null;
}

// Toggles a single row's key, preserving every other entry in `selectedKeys`
// untouched — including keys belonging to rows not currently rendered on
// this page.
export function toggleSelectionKey(selectedKeys: string[], key: string): string[] {
  return selectedKeys.includes(key)
    ? selectedKeys.filter((existingKey) => existingKey !== key)
    : [...selectedKeys, key];
}

// Toggles "select all" for the current page. Contract: select-all only ever
// adds or removes keys in `selectableKeys` (the current page's *selectable*
// rows) — never a key belonging to another page, and never a key for a row
// on this page that `isRowSelectable` returned false for. A pre-existing
// selected key that happens to belong to a non-selectable row on this page
// (or another page entirely) is left exactly as-is either way.
export function togglePageSelection(
  selectedKeys: string[],
  selectableKeys: string[],
  allSelected: boolean,
): string[] {
  const withoutSelectablePageKeys = selectedKeys.filter((key) => !selectableKeys.includes(key));
  return allSelected ? withoutSelectablePageKeys : [...withoutSelectablePageKeys, ...selectableKeys];
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
  sort,
  onSortChange,
  selection,
  toolbar,
}: DataTableProps<T>) {
  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: T) {
    if (!onRowClick) return;
    if (event.key === 'Enter') {
      onRowClick(row);
    } else if (event.key === ' ') {
      event.preventDefault();
      onRowClick(row);
    }
  }

  const selectableKeys = selection
    ? rows.filter((row) => selection.isRowSelectable?.(row) ?? true).map(rowKey)
    : [];
  const selectedOnPage = selection
    ? selectableKeys.filter((key) => selection.selectedKeys.includes(key))
    : [];
  const allSelected = selection ? selectableKeys.length > 0 && selectedOnPage.length === selectableKeys.length : false;
  const someSelected = selection ? selectedOnPage.length > 0 && !allSelected : false;

  function toggleSelectAll() {
    if (!selection) return;
    selection.onSelectionChange(togglePageSelection(selection.selectedKeys, selectableKeys, allSelected));
  }

  function toggleRow(row: T) {
    if (!selection) return;
    selection.onSelectionChange(toggleSelectionKey(selection.selectedKeys, rowKey(row)));
  }

  function handleSortClick(column: DataTableColumn<T>) {
    if (!column.sortable) return;
    onSortChange?.(nextSortState(sort, column.key));
  }

  const colSpan = columns.length + (selection ? 1 : 0);

  return (
    <div>
      {toolbar ? <div className="flex items-center justify-between gap-3 pb-3">{toolbar}</div> : null}
      <Table>
        <TableHeader>
          <TableRow>
            {selection ? (
              <TableHead className="w-10">
                <Checkbox
                  aria-label="Select all rows on this page"
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleSelectAll}
                  disabled={selectableKeys.length === 0}
                />
              </TableHead>
            ) : null}
            {columns.map((column) => (
              <TableHead
                key={column.key}
                className={ALIGN_CLASS[column.align ?? 'left']}
                style={column.width ? { width: column.width } : undefined}
              >
                {column.sortable ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium"
                    onClick={() => handleSortClick(column)}
                  >
                    {column.header}
                    {sort?.key === column.key ? (
                      sort.direction === 'asc' ? (
                        <ArrowUpIcon className="size-3.5" />
                      ) : (
                        <ArrowDownIcon className="size-3.5" />
                      )
                    ) : (
                      <ChevronsUpDownIcon className="size-3.5 opacity-50" />
                    )}
                  </button>
                ) : (
                  column.header
                )}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={colSpan}>
                <LoadingState />
              </TableCell>
            </TableRow>
          ) : error ? (
            <TableRow>
              <TableCell colSpan={colSpan}>
                <ErrorState message={error} />
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colSpan} className="text-center text-muted-foreground">
                {emptyMessage}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const key = rowKey(row);
              const rowSelectable = selection ? (selection.isRowSelectable?.(row) ?? true) : false;
              return (
                <TableRow
                  key={key}
                  data-state={selection?.selectedKeys.includes(key) ? 'selected' : undefined}
                  className={onRowClick ? 'cursor-pointer' : undefined}
                  {...(onRowClick
                    ? {
                        onClick: () => onRowClick(row),
                        onKeyDown: (event: KeyboardEvent<HTMLTableRowElement>) => handleRowKeyDown(event, row),
                        role: 'button',
                        tabIndex: 0,
                      }
                    : {})}
                >
                  {selection ? (
                    // Stop both click and keydown (Space/Enter on the
                    // checkbox's own <button>) from bubbling to the row's
                    // onRowClick/onKeyDown handlers above — a consumer using
                    // `selection` and `onRowClick` together must be able to
                    // toggle a row's checkbox without also "opening" the row.
                    <TableCell
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        aria-label={`Select row ${key}`}
                        checked={selection.selectedKeys.includes(key)}
                        onCheckedChange={() => toggleRow(row)}
                        disabled={!rowSelectable}
                      />
                    </TableCell>
                  ) : null}
                  {columns.map((column) => (
                    <TableCell key={column.key} className={ALIGN_CLASS[column.align ?? 'left']}>
                      {column.render ? column.render(row) : String(row[column.key] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
      {pagination ? <Pagination {...pagination} /> : null}
    </div>
  );
}
