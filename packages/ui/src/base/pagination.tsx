import type { ChangeEvent } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { Button } from './button';

export interface DataTableOffsetPaginationProps {
  mode?: 'page';
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
}

export interface DataTableNavigationPaginationProps {
  mode: 'navigation'; // not "cursor" — see spec Post-Accept correction
  pageSize: number;
  totalCount?: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNext: () => void;
  onPrevious: () => void;
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
}

export type DataTablePaginationProps = DataTableNavigationPaginationProps | DataTableOffsetPaginationProps;

export function Pagination(props: DataTablePaginationProps) {
  if (props.mode === 'navigation') {
    const { pageSize, totalCount, hasNextPage, hasPreviousPage, onNext, onPrevious, pageSizeOptions, onPageSizeChange } = props;
    return (
      <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-sm text-muted-foreground">
        <Button type="button" variant="outline" size="sm" aria-label="Previous page" disabled={!hasPreviousPage} onClick={onPrevious}>
          <ChevronLeftIcon /> Previous
        </Button>
        <div className="flex items-center gap-3">
          {totalCount !== undefined ? <span>Showing up to {pageSize} of {totalCount}</span> : null}
          {pageSizeOptions ? (
            <PageSizeSelect pageSize={pageSize} pageSizeOptions={pageSizeOptions} onPageSizeChange={onPageSizeChange} />
          ) : null}
        </div>
        <Button type="button" variant="outline" size="sm" aria-label="Next page" disabled={!hasNextPage} onClick={onNext}>
          Next <ChevronRightIcon />
        </Button>
      </div>
    );
  }

  const { page, pageSize, totalCount, onPageChange, pageSizeOptions, onPageSizeChange } = props;
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  return (
    <div className="flex items-center justify-between gap-3 border-t px-3 py-2 text-sm text-muted-foreground">
      <Button type="button" variant="outline" size="sm" aria-label="Previous page" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        <ChevronLeftIcon /> Previous
      </Button>
      <div className="flex items-center gap-3">
        <span>Page {page} of {pageCount}</span>
        {pageSizeOptions ? (
          <PageSizeSelect pageSize={pageSize} pageSizeOptions={pageSizeOptions} onPageSizeChange={onPageSizeChange} />
        ) : null}
      </div>
      <Button type="button" variant="outline" size="sm" aria-label="Next page" disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
        Next <ChevronRightIcon />
      </Button>
    </div>
  );
}

function PageSizeSelect({
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: {
  pageSize: number;
  pageSizeOptions: number[];
  onPageSizeChange?: (pageSize: number) => void;
}) {
  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    onPageSizeChange?.(Number(event.currentTarget.value));
  }
  const options = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b);
  return (
    <select
      aria-label="Rows per page"
      value={pageSize}
      onChange={handleChange}
      className="rounded-md border border-input bg-background px-2 py-1 text-sm"
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {option} / page
        </option>
      ))}
    </select>
  );
}
