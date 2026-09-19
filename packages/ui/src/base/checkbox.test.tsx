import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Checkbox } from './checkbox';

// Assertions verified directly against this file's real rendered output
// (Radix's own Checkbox.Root behavior) before being written here — not
// assumed from the generic Radix API docs.
describe('Checkbox primitive', () => {
  it('renders unchecked by default', () => {
    const html = renderToStaticMarkup(<Checkbox aria-label="pick" />);
    expect(html).toContain('data-state="unchecked"');
  });

  it('renders checked state', () => {
    const html = renderToStaticMarkup(<Checkbox aria-label="pick" checked />);
    expect(html).toContain('data-state="checked"');
  });

  it('renders indeterminate state', () => {
    const html = renderToStaticMarkup(<Checkbox aria-label="pick" checked="indeterminate" />);
    expect(html).toContain('data-state="indeterminate"');
  });

  it('renders disabled state', () => {
    const html = renderToStaticMarkup(<Checkbox aria-label="pick" disabled />);
    expect(html).toContain('disabled=""');
  });
});
