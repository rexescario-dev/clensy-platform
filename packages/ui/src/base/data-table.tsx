import type { ReactNode } from 'react';
import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from 'lucide-react';
import { Checkbox } from './checkbox';
import { ErrorState } from './error-state';
import { LoadingState } from './loading-state';
import { Pagination, type DataTablePaginationProps } from './pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: string | ((row: T) => ReactNode);
  sortable?: boolean;
  sortKey?: string;
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
  refreshing?: boolean;
  mobileRow?: (row: T) => ReactNode;
}

const ALIGN_CLASS = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
} as const satisfies Record<NonNullable<DataTableColumn<unknown>['align']>, string>;

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
  refreshing = false,
  mobileRow,
}: DataTableProps<T>) {
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
    onSortChange?.(nextSortState(sort, column.sortKey ?? column.key));
  }

  const colSpan = columns.length + (selection ? 1 : 0);

  // Single source of truth for "what should the body currently show",
  // shared by the desktop `<TableBody>` and the mobile card list below.
  // `refreshing` short-circuits straight to 'rows' (even over
  // loading/error/empty). `error` only forces the full-replace 'error'
  // state when there are no rows to fall back on — e.g. the very first
  // load failing. A background request that fails *after* rows already
  // loaded (acceptance criterion: "preserve the existing displayed rows
  // where practical and show an appropriate error state") keeps showing
  // those rows; the error itself is surfaced via `backgroundError` below,
  // not by blanking the table.
  const bodyState: 'empty' | 'error' | 'loading' | 'rows' = refreshing
    ? 'rows'
    : loading
      ? 'loading'
      : error && rows.length === 0
        ? 'error'
        : rows.length === 0
          ? 'empty'
          : 'rows';

  // A background error while rows are still being shown (bodyState
  // resolved to 'rows' despite `error` being set). Excludes `refreshing`
  // deliberately: while a new request is in flight we don't yet know
  // whether it will succeed, so a stale error from a *previous* failure
  // shouldn't display alongside the progress indicator.
  const backgroundError = !refreshing && error && bodyState === 'rows' ? error : undefined;

  function renderRows(rowsToRender: T[]) {
    return rowsToRender.map((row) => {
      const key = rowKey(row);
      const rowSelectable = selection ? (selection.isRowSelectable?.(row) ?? true) : false;
      return (
        <TableRow
          key={key}
          data-state={selection?.selectedKeys.includes(key) ? 'selected' : undefined}
          className={onRowClick ? 'cursor-pointer' : undefined}
          {...rowInteractionProps(row, onRowClick)}
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
              {column.render !== undefined
                ? resolveCellValue(row, column.render)
                : String(row[column.key] ?? '')}
            </TableCell>
          ))}
        </TableRow>
      );
    });
  }

  // #65 finding 2: mirrors renderRows' click/keyboard wiring for the
  // mobile card list, which was previously plain non-interactive <div>s —
  // on a narrow viewport (where the desktop table is hidden), this was the
  // only way to open a row's detail drawer. `DataTable` owns `rowKey`, so
  // the wrapping <div> (not `mobileRow`'s own returned markup) carries the
  // key — `mobileRow` only needs to return content, matching how
  // `columns`/`render` never key their own output either.
  function renderMobileRows(rowsToRender: T[]) {
    return rowsToRender.map((row) => {
      const key = rowKey(row);
      return (
        <div key={key} className={onRowClick ? 'cursor-pointer' : undefined} {...rowInteractionProps(row, onRowClick)}>
          {mobileRow!(row)}
        </div>
      );
    });
  }

  const table = (
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
          {columns.map((column) => {
            const effectiveSortKey = column.sortKey ?? column.key;
            const isSorted = column.sortable && sort?.key === effectiveSortKey;
            return (
              <TableHead
                key={column.key}
                className={ALIGN_CLASS[column.align ?? 'left']}
                style={column.width ? { width: column.width } : undefined}
                aria-sort={column.sortable ? (isSorted ? (sort!.direction === 'asc' ? 'ascending' : 'descending') : 'none') : undefined}
              >
                {column.sortable ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 font-medium"
                    onClick={() => handleSortClick(column)}
                  >
                    {column.header}
                    {isSorted ? (
                      sort!.direction === 'asc' ? (
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
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {bodyState === 'loading' ? (
          <TableRow>
            <TableCell colSpan={colSpan}>
              <LoadingState />
            </TableCell>
          </TableRow>
        ) : bodyState === 'error' ? (
          <TableRow>
            <TableCell colSpan={colSpan}>
              <ErrorState message={error!} />
            </TableCell>
          </TableRow>
        ) : bodyState === 'empty' ? (
          <TableRow>
            <TableCell colSpan={colSpan} className="text-center text-muted-foreground">
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          renderRows(rows)
        )}
      </TableBody>
    </Table>
  );

  return (
    <div>
      {toolbar ? <div className="flex items-center justify-between gap-3 pb-3">{toolbar}</div> : null}
      {refreshing ? (
        <div role="progressbar" aria-label="Refreshing" className="h-0.5 w-full animate-pulse bg-primary/50" />
      ) : null}
      {backgroundError ? (
        <div role="alert" className="border-b border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {backgroundError}
        </div>
      ) : null}
      {mobileRow ? <div className="hidden sm:block">{table}</div> : table}
      {mobileRow ? (
        <div className="sm:hidden flex flex-col gap-2">
          {bodyState === 'loading' ? (
            <LoadingState />
          ) : bodyState === 'error' ? (
            <ErrorState message={error!} />
          ) : bodyState === 'empty' ? (
            <div className="text-center text-muted-foreground">{emptyMessage}</div>
          ) : (
            renderMobileRows(rows)
          )}
        </div>
      ) : null}
      {pagination ? <Pagination {...pagination} /> : null}
    </div>
  );
}

// Pure, independently-testable row-activation logic — the ONE mechanism
// behind both the desktop <TableRow>'s onKeyDown and the mobile card's
// onKeyDown (#65 finding 2: a mobile card must reuse the exact same
// click-handling mechanism as a desktop row, not a second one). The event
// parameter is intentionally the minimal structural shape actually used
// (not React's element-specific KeyboardEvent<HTMLTableRowElement>) so the
// same function type-checks against both a <tr>'s and a <div>'s onKeyDown,
// and so it can be unit-tested with a plain mock object — this repo's
// renderToStaticMarkup-only test setup cannot simulate real key events.
export function handleRowKeyDown<T>(
  event: { key: string; preventDefault: () => void },
  row: T,
  onRowClick: ((row: T) => void) | undefined,
): void {
  if (!onRowClick) return;
  if (event.key === 'Enter') {
    onRowClick(row);
  } else if (event.key === ' ') {
    event.preventDefault();
    onRowClick(row);
  }
}

export function nextSortState(
  current: DataTableSortState | null | undefined,
  key: string,
): DataTableSortState | null {
  if (!current || current.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return null;
}

// `DataTableColumn.render`'s two forms: a nested property path (resolved via
// `resolvePath`) or a callback (executed with the full row). Deliberately
// the only two forms — no separate accessor/accessorKey/accessorFn.
export function resolveCellValue<T>(row: T, render: string | ((row: T) => ReactNode)): ReactNode {
  if (typeof render === 'function') return render(row);
  return resolvePath(row, render) as ReactNode;
}

// Resolves a dot-separated property path against a value, returning
// `undefined` as soon as an intermediate value is missing/null rather than
// throwing. No array indexing, no expression syntax, no eval — a plain
// segment-by-segment property walk.
export function resolvePath(row: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, segment) => {
    if (value === null || value === undefined) return undefined;
    return (value as Record<string, unknown>)[segment];
  }, row);
}

// Pure, independently-testable interactive-attribute set for a clickable
// row/card — shared by the desktop <TableRow> and the mobile card wrapper
// so "is this row clickable" has exactly one derivation. Returns {} (no
// attributes at all) when onRowClick is omitted, so a non-interactive
// row/card renders with no false affordance (#65 finding 2c).
export function rowInteractionProps<T>(
  row: T,
  onRowClick: ((row: T) => void) | undefined,
):
  | Record<string, never>
  | {
      onClick: () => void;
      onKeyDown: (event: { key: string; preventDefault: () => void }) => void;
      role: 'button';
      tabIndex: 0;
    } {
  if (!onRowClick) return {};
  return {
    onClick: () => onRowClick(row),
    onKeyDown: (event) => handleRowKeyDown(event, row, onRowClick),
    role: 'button',
    tabIndex: 0,
  };
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

// Toggles a single row's key, preserving every other entry in `selectedKeys`
// untouched — including keys belonging to rows not currently rendered on
// this page.
export function toggleSelectionKey(selectedKeys: string[], key: string): string[] {
  return selectedKeys.includes(key)
    ? selectedKeys.filter((existingKey) => existingKey !== key)
    : [...selectedKeys, key];
}
