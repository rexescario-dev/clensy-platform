import type { ChangeEvent } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from './button';

export interface DataTablePaginationProps {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
}

export function Pagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
}: DataTablePaginationProps) {
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));

  function handlePageSizeChange(event: ChangeEvent<HTMLSelectElement>) {
    onPageSizeChange?.(Number(event.currentTarget.value));
  }

  return (
    <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-sm text-muted-foreground">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="Previous page"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        <ChevronLeftIcon /> Previous
      </Button>
      <div className="flex items-center gap-3">
        <span>
          Page {page} of {pageCount}
        </span>
        {pageSizeOptions ? (
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={handlePageSizeChange}
            className="rounded-md border border-input bg-background px-2 py-1 text-sm"
          >
            {/* M7 finding: if the caller's current `pageSize` isn't itself one
                of `pageSizeOptions`, a native <select> silently falls back to
                its first <option> while `value` keeps pointing at the
                (unrendered) real pageSize — the dropdown then visibly lies
                about the active page size. Always including the current
                value as an option guarantees `value` always matches a real
                <option>, regardless of what the caller passed. */}
            {(pageSizeOptions.includes(pageSize) ? pageSizeOptions : [...pageSizeOptions, pageSize].sort((a, b) => a - b)).map(
              (option) => (
                <option key={option} value={option}>
                  {option} / page
                </option>
              ),
            )}
          </select>
        ) : null}
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-label="Next page"
        disabled={page >= pageCount}
        onClick={() => onPageChange(page + 1)}
      >
        Next <ChevronRightIcon />
      </Button>
    </div>
  );
}
