import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Pagination } from './pagination';

// Extracts one <button>...</button> element by its aria-label, so an
// assertion about ITS disabled state can't accidentally match the OTHER
// button or depend on attribute ordering within the tag.
function extractButtonByLabel(html: string, label: string): string {
  const marker = `aria-label="${label}"`;
  const markerIndex = html.indexOf(marker);
  if (markerIndex === -1) throw new Error(`No element with ${marker} found`);
  const start = html.lastIndexOf('<button', markerIndex);
  const end = html.indexOf('</button>', start) + '</button>'.length;
  if (start === -1 || end === -1) throw new Error(`No <button aria-label="${label}"> found`);
  return html.slice(start, end);
}

describe('Pagination', () => {
  // Note: `disabled` alone is NOT a safe substring check — Button's own
  // className always contains the literal text `disabled:pointer-events-none`
  // (a Tailwind variant), present whether or not the element is actually
  // disabled. The real signal is the rendered boolean attribute `disabled=""`.
  it('disables Previous on the first page, enables Next', () => {
    const html = renderToStaticMarkup(
      <Pagination page={1} pageSize={20} totalCount={100} onPageChange={() => {}} />,
    );
    expect(extractButtonByLabel(html, 'Previous page')).toContain('disabled=""');
    expect(extractButtonByLabel(html, 'Next page')).not.toContain('disabled=""');
  });

  it('enables Previous, disables Next on the last page', () => {
    const html = renderToStaticMarkup(
      <Pagination page={5} pageSize={20} totalCount={100} onPageChange={() => {}} />,
    );
    expect(extractButtonByLabel(html, 'Previous page')).not.toContain('disabled=""');
    expect(extractButtonByLabel(html, 'Next page')).toContain('disabled=""');
  });

  it('omits the page-size select when pageSizeOptions is not supplied', () => {
    const html = renderToStaticMarkup(
      <Pagination page={1} pageSize={20} totalCount={100} onPageChange={() => {}} />,
    );
    expect(html).not.toContain('<select');
  });

  it('renders the page-size select only when pageSizeOptions is supplied', () => {
    const html = renderToStaticMarkup(
      <Pagination
        page={1}
        pageSize={20}
        totalCount={100}
        onPageChange={() => {}}
        pageSizeOptions={[10, 20, 50]}
        onPageSizeChange={() => {}}
      />,
    );
    expect(html).toContain('<select');
    expect(html).toContain('50 / page');
  });

  // M7 finding: a `pageSize` not present in `pageSizeOptions` left the
  // native <select> silently displaying its first option while `value`
  // pointed at the real (unrendered) pageSize.
  it("always renders an <option> matching the current pageSize, even when it isn't in pageSizeOptions", () => {
    const html = renderToStaticMarkup(
      <Pagination
        page={1}
        pageSize={25}
        totalCount={100}
        onPageChange={() => {}}
        pageSizeOptions={[10, 20, 50]}
        onPageSizeChange={() => {}}
      />,
    );
    expect(html).toContain('value="25"');
    expect(html).toContain('25 / page');
  });
});
