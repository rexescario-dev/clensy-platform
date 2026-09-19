import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

describe('Table primitive', () => {
  it('renders a table wrapped in a scroll container', () => {
    const html = renderToStaticMarkup(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Alice</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(html).toContain('data-slot="table-container"');
    expect(html).toContain('<table');
    expect(html).toContain('Alice');
  });

  it('passes through className on every sub-component', () => {
    const html = renderToStaticMarkup(
      <Table className="custom-table">
        <TableHeader className="custom-header">
          <TableRow className="custom-row">
            <TableHead className="custom-head">H</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody className="custom-body">
          <TableRow>
            <TableCell className="custom-cell">C</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    for (const cls of ['custom-table', 'custom-header', 'custom-row', 'custom-head', 'custom-body', 'custom-cell']) {
      expect(html).toContain(cls);
    }
  });
});
