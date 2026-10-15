import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LaundrySearchCombobox, type LaundrySearchComboboxProps } from './laundry-search-combobox';

interface Option {
  id: string;
  name: string;
}

const noop = () => {};
const COPY = {
  empty: 'Nothing found.',
  error: 'Search failed.',
  label: 'Service',
  more: 'More results exist.',
  searching: 'Looking…',
};
const WASH: Option = { id: 'w1', name: 'Wash and fold' };
const IRON: Option = { id: 'i1', name: 'Ironing' };

function input(html: string): string {
  return /<input[^>]*>/.exec(html)![0];
}

function render(props: Partial<LaundrySearchComboboxProps<Option>> = {}): string {
  return renderToStaticMarkup(
    <LaundrySearchCombobox<Option>
      id="svc"
      copy={COPY}
      query="wa"
      options={[]}
      status="idle"
      onQueryChange={noop}
      onSelect={noop}
      renderOption={(option) => <span>{option.name}</span>}
      {...props}
    />,
  );
}

describe('LaundrySearchCombobox', () => {
  it('labels a combobox that controls a listbox and starts collapsed', () => {
    const html = render();
    expect(html).toContain('<label for="svc"');
    expect(html).toContain('>Service</label>');
    const field = input(html);
    expect(field).toContain('role="combobox"');
    expect(field).toContain('aria-controls="svc-listbox"');
    expect(field).toContain('aria-expanded="false"');
    expect(field).toContain('aria-autocomplete="list"');
    expect(field).toContain('autoComplete="off"');
    expect(field).not.toContain('aria-activedescendant');
    expect(html).toMatch(/<ul[^>]*id="svc-listbox"[^>]*role="listbox"/);
    expect(html).toMatch(/<ul[^>]*aria-label="Service"/);
  });

  it('renders one option per result with the caller rendering inside it', () => {
    const html = render({ options: [WASH, IRON], status: 'ready' });
    expect(html).toContain('id="svc-option-w1"');
    expect(html).toContain('id="svc-option-i1"');
    expect((html.match(/role="option"/g) ?? []).length).toBe(2);
    expect(html).toContain('<span>Wash and fold</span>');
    expect(html).toContain('<span>Ironing</span>');
  });

  it('shows one line for searching, empty, error and truncation', () => {
    expect(render({ status: 'loading' })).toContain('Looking…');
    expect(render({ status: 'ready' })).toContain('Nothing found.');
    expect(render({ status: 'error' })).toMatch(/role="alert"[^>]*>Search failed\./);
    const idle = render({ status: 'idle' });
    for (const text of [COPY.searching, COPY.empty, COPY.error, COPY.more]) expect(idle).not.toContain(text);
    const ready = { options: [WASH], status: 'ready' as const };
    expect(render({ ...ready, truncated: true })).toContain('More results exist.');
    expect(render({ ...ready, truncated: false })).not.toContain('More results exist.');
    expect(render(ready)).not.toContain('More results exist.');
    expect(render({ status: 'loading', truncated: true })).not.toContain('More results exist.');
    expect(render({ status: 'error', truncated: true })).not.toContain('More results exist.');
    expect(render({ ...ready })).not.toContain('Nothing found.');
  });

  it('renders no option unless the status is ready', () => {
    for (const status of ['idle', 'loading', 'error'] as const) {
      expect(render({ options: [WASH], status })).not.toContain('role="option"');
    }
  });

  it('wires the error message to the input', () => {
    const html = render({ error: 'Pick a service.' });
    const field = input(html);
    expect(field).toContain('aria-invalid="true"');
    expect(field).toContain('aria-describedby="svc-error"');
    expect(html).toMatch(/<p id="svc-error"[^>]*>Pick a service\.<\/p>/);
    expect(input(render())).not.toContain('aria-invalid');
  });

  it('disables the input only when asked', () => {
    expect(input(render({ disabled: true }))).toContain('disabled=""');
    expect(input(render())).not.toContain('disabled');
  });
});
