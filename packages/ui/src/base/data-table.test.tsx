import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DataTable,
  nextSortState,
  toggleSelectionKey,
  togglePageSelection,
  resolvePath,
  resolveCellValue,
  type DataTableColumn,
} from './data-table';

interface Row extends Record<string, unknown> {
  id: string;
  name: string;
}

const sortableColumns: DataTableColumn<Row>[] = [{ key: 'name', header: 'Name', sortable: true }];
const mixedColumns: DataTableColumn<Row>[] = [
  { key: 'name', header: 'Name', sortable: true },
  { key: 'id', header: 'ID' },
];
const rows: Row[] = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' },
];

describe('nextSortState (pure)', () => {
  it('cycles none → asc → desc → none for the same key', () => {
    expect(nextSortState(null, 'name')).toEqual({ key: 'name', direction: 'asc' });
    expect(nextSortState({ key: 'name', direction: 'asc' }, 'name')).toEqual({ key: 'name', direction: 'desc' });
    expect(nextSortState({ key: 'name', direction: 'desc' }, 'name')).toBeNull();
  });

  it('resets to asc when a different column is clicked', () => {
    expect(nextSortState({ key: 'other', direction: 'desc' }, 'name')).toEqual({ key: 'name', direction: 'asc' });
  });
});

describe('toggleSelectionKey (pure)', () => {
  it('adds a key that is not yet selected', () => {
    expect(toggleSelectionKey(['a'], 'b')).toEqual(['a', 'b']);
  });

  it('removes a key that is already selected, preserving the rest', () => {
    expect(toggleSelectionKey(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });
});

describe('togglePageSelection (pure) — the M5 round-1 contract', () => {
  it("selecting all adds the current page's selectable keys without disturbing an existing out-of-page key", () => {
    const selectedKeys = ['other-page-row'];
    const selectableKeys = ['row-1', 'row-2'];
    const result = togglePageSelection(selectedKeys, selectableKeys, false);
    expect(result).toEqual(expect.arrayContaining(['other-page-row', 'row-1', 'row-2']));
    expect(result).toHaveLength(3);
  });

  it("deselecting all removes only the current page's selectable keys, preserving an out-of-page key", () => {
    const selectedKeys = ['other-page-row', 'row-1', 'row-2'];
    const selectableKeys = ['row-1', 'row-2'];
    expect(togglePageSelection(selectedKeys, selectableKeys, true)).toEqual(['other-page-row']);
  });

  it('never removes a selected key belonging to a non-selectable row on the current page', () => {
    // row-2 is selected despite not being in `selectableKeys` (e.g. it became
    // non-selectable after being selected) — select-all must leave it alone
    // in either direction, since it was never counted toward `allSelected`.
    const selectedKeys = ['row-2'];
    const selectableKeys = ['row-1']; // row-2 excluded — not selectable
    expect(togglePageSelection(selectedKeys, selectableKeys, false)).toEqual(['row-2', 'row-1']);
    expect(togglePageSelection(selectedKeys, selectableKeys, true)).toEqual(['row-2']);
  });
});

describe('resolvePath (pure)', () => {
  it('resolves a simple nested path', () => {
    expect(resolvePath({ customer: { fullName: 'John Doe' } }, 'customer.fullName')).toBe('John Doe');
  });

  it('resolves a deeper path', () => {
    expect(resolvePath({ pricingSnapshot: { priceMinorUnits: 12500 } }, 'pricingSnapshot.priceMinorUnits')).toBe(
      12500,
    );
  });

  it('returns undefined, not a throw, when an intermediate value is missing', () => {
    expect(resolvePath({}, 'customer.fullName')).toBeUndefined();
    expect(resolvePath({ customer: null }, 'customer.fullName')).toBeUndefined();
    expect(resolvePath(null, 'customer.fullName')).toBeUndefined();
  });
});

describe('resolveCellValue (pure)', () => {
  it('executes a function render with the complete row', () => {
    const row = { id: '1', name: 'Alice' };
    let received: unknown;
    resolveCellValue(row, (r) => {
      received = r;
      return null;
    });
    expect(received).toBe(row);
  });

  it('returns a computed/formatted value from a function render', () => {
    expect(resolveCellValue({ priceMinorUnits: 1250 }, (r) => `$${(r.priceMinorUnits / 100).toFixed(2)}`)).toBe(
      '$12.50',
    );
  });

  it('resolves a string render as a property path', () => {
    expect(resolveCellValue({ customer: { fullName: 'John Doe' } }, 'customer.fullName')).toBe('John Doe');
  });
});

describe('DataTable', () => {
  it('renders rows and columns through the Table primitive', () => {
    const html = renderToStaticMarkup(<DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} />);
    expect(html).toContain('data-slot="table"');
    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
  });

  it('renders the empty message when rows is empty', () => {
    const html = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={[]} rowKey={(r) => r.id} emptyMessage="Nothing here." />,
    );
    expect(html).toContain('Nothing here.');
  });

  it('renders LoadingState when loading', () => {
    const html = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} loading />,
    );
    expect(html).not.toContain('Alice');
  });

  it('renders ErrorState when error is set', () => {
    const html = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} error="Failed." />,
    );
    expect(html).toContain('Failed.');
  });

  it('never reorders rows regardless of sort state (rendering contract)', () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={sortableColumns}
        rows={rows}
        rowKey={(r) => r.id}
        sort={{ key: 'name', direction: 'desc' }}
      />,
    );
    expect(html.indexOf('Alice')).toBeLessThan(html.indexOf('Bob'));
  });

  it('renders a clickable header only for sortable columns, not for plain ones', () => {
    const html = renderToStaticMarkup(<DataTable columns={mixedColumns} rows={rows} rowKey={(r) => r.id} />);
    const nameHeaderIndex = html.indexOf('Name');
    const idHeaderIndex = html.indexOf('>ID<');
    expect(html.lastIndexOf('<button', nameHeaderIndex)).toBeGreaterThan(-1);
    const idCellStart = html.lastIndexOf('<th', idHeaderIndex);
    expect(html.slice(idCellStart, idHeaderIndex)).not.toContain('<button');
  });

  it('shows a distinct icon for unsorted, ascending, and descending states', () => {
    const unsorted = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} sort={null} />,
    );
    const ascending = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} sort={{ key: 'name', direction: 'asc' }} />,
    );
    const descending = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} sort={{ key: 'name', direction: 'desc' }} />,
    );
    expect(unsorted).not.toEqual(ascending);
    expect(unsorted).not.toEqual(descending);
    expect(ascending).not.toEqual(descending);
  });

  it('renders a select-all checkbox and per-row checkboxes when selection is set', () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={sortableColumns}
        rows={rows}
        rowKey={(r) => r.id}
        selection={{ selectedKeys: ['1'], onSelectionChange: () => {} }}
      />,
    );
    expect((html.match(/data-slot="checkbox"/g) ?? []).length).toBe(rows.length + 1);
  });

  // M7 finding: every row checkbox previously shared the identical
  // aria-label "Select row", giving assistive tech no way to distinguish
  // rows. Each row's checkbox must carry a distinct label.
  it('gives each row checkbox a distinct aria-label', () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={sortableColumns}
        rows={rows}
        rowKey={(r) => r.id}
        selection={{ selectedKeys: [], onSelectionChange: () => {} }}
      />,
    );
    expect(html).toContain('aria-label="Select row 1"');
    expect(html).toContain('aria-label="Select row 2"');
  });

  it('renders toolbar content when supplied', () => {
    const html = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} toolbar={<span>Search</span>} />,
    );
    expect(html).toContain('Search');
  });

  it('omits the page-size select for a pagination prop without pageSizeOptions (regression gate for the eleven untouched non-Bookings call sites)', () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={sortableColumns}
        rows={rows}
        rowKey={(r) => r.id}
        pagination={{ onPageChange: () => {}, page: 1, pageSize: 20, totalCount: 2 }}
      />,
    );
    expect(html).not.toContain('<select');
  });

  it('renders a string-path render as the resolved nested value', () => {
    interface NestedRow extends Record<string, unknown> {
      id: string;
      customer: { fullName: string };
    }
    const nestedRows: NestedRow[] = [{ id: '1', customer: { fullName: 'John Doe' } }];
    const columns: DataTableColumn<NestedRow>[] = [{ key: 'customer', header: 'Customer', render: 'customer.fullName' }];
    const html = renderToStaticMarkup(<DataTable columns={columns} rows={nestedRows} rowKey={(r) => r.id} />);
    expect(html).toContain('John Doe');
  });

  it('renders without throwing when a string-path render hits a missing intermediate value', () => {
    interface NestedRow extends Record<string, unknown> {
      id: string;
      customer: { fullName: string } | null;
    }
    const nestedRows: NestedRow[] = [{ id: '1', customer: null }];
    const columns: DataTableColumn<NestedRow>[] = [{ key: 'customer', header: 'Customer', render: 'customer.fullName' }];
    expect(() =>
      renderToStaticMarkup(<DataTable columns={columns} rows={nestedRows} rowKey={(r) => r.id} />),
    ).not.toThrow();
  });

  it('preserves the no-render fallback (resolves the raw column key from the row)', () => {
    const html = renderToStaticMarkup(<DataTable columns={mixedColumns} rows={rows} rowKey={(r) => r.id} />);
    expect(html).toContain('Alice');
    expect(html).toContain('1');
  });
});

describe('DataTable — aria-sort and sortKey (#65)', () => {
  const columnsWithSortKey: DataTableColumn<Row>[] = [
    { header: 'Name', key: 'name', sortable: true, sortKey: 'displayName' },
  ];

  it('renders aria-sort="none" when unsorted, keyed off sortKey not key', () => {
    const html = renderToStaticMarkup(
      <DataTable columns={columnsWithSortKey} rows={rows} rowKey={(r) => r.id} sort={null} />,
    );
    expect(html).toContain('aria-sort="none"');
  });

  it('renders aria-sort="ascending"/"descending" matched against sortKey, not key', () => {
    const asc = renderToStaticMarkup(
      <DataTable
        columns={columnsWithSortKey}
        rows={rows}
        rowKey={(r) => r.id}
        sort={{ key: 'displayName', direction: 'asc' }}
      />,
    );
    expect(asc).toContain('aria-sort="ascending"');
    const desc = renderToStaticMarkup(
      <DataTable
        columns={columnsWithSortKey}
        rows={rows}
        rowKey={(r) => r.id}
        sort={{ key: 'displayName', direction: 'desc' }}
      />,
    );
    expect(desc).toContain('aria-sort="descending"');
  });

  // M5 round-1 finding: a prior draft of this test rendered with an
  // onSortChange spy and then asserted the spy was NEVER called — which
  // proves nothing about what onSortChange *reports*, only that
  // renderToStaticMarkup doesn't simulate clicks (already known). The
  // actual click→report behavior is a pure computation
  // (nextSortState(sort, column.sortKey ?? column.key)) and is tested
  // directly, the same way nextSortState's own cycle tests already work —
  // no rendering or callback-spy involved.
  it('the value a click would report is sortKey, not key, when sortKey differs (pure)', () => {
    const column = columnsWithSortKey[0];
    expect(nextSortState(null, column.sortKey ?? column.key)).toEqual({ key: 'displayName', direction: 'asc' });
  });

  it('a sortable column without sortKey still keys off key (backward compatible)', () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={[{ key: 'name', header: 'Name', sortable: true }]}
        rows={rows}
        rowKey={(r) => r.id}
        sort={{ key: 'name', direction: 'asc' }}
      />,
    );
    expect(html).toContain('aria-sort="ascending"');
  });

  it('renders no aria-sort attribute on a non-sortable column', () => {
    const html = renderToStaticMarkup(<DataTable columns={mixedColumns} rows={rows} rowKey={(r) => r.id} />);
    const idHeaderIndex = html.indexOf('>ID<');
    const idCellStart = html.lastIndexOf('<th', idHeaderIndex);
    expect(html.slice(idCellStart, idHeaderIndex)).not.toContain('aria-sort');
  });
});

describe('DataTable — refreshing (#65)', () => {
  it('renders rows normally (not the loading branch) when refreshing is true, even if loading is also true', () => {
    const html = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} loading refreshing />,
    );
    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
  });

  it('renders a progress indicator when refreshing is true', () => {
    const html = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} refreshing />,
    );
    expect(html).toContain('role="progressbar"');
  });

  it('omits the progress indicator when refreshing is false or omitted', () => {
    const html = renderToStaticMarkup(<DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} />);
    expect(html).not.toContain('role="progressbar"');
  });

  it('loading alone (refreshing omitted) still replaces the body as today (regression)', () => {
    const html = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} loading />,
    );
    expect(html).not.toContain('Alice');
  });

  // M5 round-1 finding: refreshing takes priority even over an empty rows
  // array — this is a deliberate consequence of the contract above (the
  // consumer's responsibility, not DataTable's to second-guess), pinned
  // here so a future change to this precedence is a visible, intentional
  // diff rather than an accidental regression.
  it('refreshing with an empty rows array renders the empty branch\'s absence, not a crash, and still shows the indicator', () => {
    const html = renderToStaticMarkup(
      <DataTable columns={sortableColumns} rows={[]} rowKey={(r) => r.id} refreshing emptyMessage="Nothing here." />,
    );
    expect(html).toContain('role="progressbar"');
    expect(html).not.toContain('Nothing here.');
  });
});

describe('DataTable — mobileRow (#65)', () => {
  it('renders mobileRow output for each row when supplied', () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={sortableColumns}
        rows={rows}
        rowKey={(r) => r.id}
        mobileRow={(row) => <div key={row.id}>Card: {row.name}</div>}
      />,
    );
    expect(html).toContain('Card: Alice');
    expect(html).toContain('Card: Bob');
  });

  it('renders no card content when mobileRow is omitted (backward-compatible default)', () => {
    const html = renderToStaticMarkup(<DataTable columns={sortableColumns} rows={rows} rowKey={(r) => r.id} />);
    expect(html).not.toContain('Card:');
  });

  it('still renders the desktop table when mobileRow is supplied', () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={sortableColumns}
        rows={rows}
        rowKey={(r) => r.id}
        mobileRow={(row) => <div key={row.id}>Card: {row.name}</div>}
      />,
    );
    expect(html).toContain('data-slot="table"');
    expect(html).toContain('Alice'); // still present in the desktop table's own cell content
  });

  it('mobileRow respects loading/error/empty state the same as the desktop table', () => {
    const html = renderToStaticMarkup(
      <DataTable
        columns={sortableColumns}
        rows={[]}
        rowKey={(r) => r.id}
        emptyMessage="Nothing here."
        mobileRow={(row) => <div key={row.id}>Card: {row.name}</div>}
      />,
    );
    expect(html).toContain('Nothing here.');
    expect(html).not.toContain('Card:');
  });
});
