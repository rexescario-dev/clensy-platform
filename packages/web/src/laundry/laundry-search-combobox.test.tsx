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
    // The lines keep their markup; only the live role goes (#181).
    expect(render({ status: 'error' })).toContain('<p class="px-3 py-2 text-sm text-red-600">Search failed.</p>');
    expect(render({ status: 'loading' })).toContain('<p class="px-3 py-2 text-sm text-slate-500">Looking…</p>');
    // Characterization: an empty page that is also truncated still shows both lines (planning decision (e)).
    const emptyAndMore = render({ status: 'ready', truncated: true });
    expect(emptyAndMore).toContain('<p class="px-3 py-2 text-sm text-slate-500">Nothing found.</p>');
    expect(emptyAndMore).toContain('<p class="px-3 py-2 text-sm text-slate-500">More results exist.</p>');
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

  it('keeps one empty polite status region after the popup, and no live role on the popup lines', () => {
    const cases: Partial<LaundrySearchComboboxProps<Option>>[] = [
      { status: 'idle' },
      { status: 'loading' },
      { status: 'ready' },
      { status: 'ready', truncated: true },
      { options: [WASH], status: 'ready', truncated: true },
      { status: 'error' },
      { error: 'Pick a service.', status: 'error' },
    ];
    for (const props of cases) {
      const html = render(props);
      expect((html.match(/role="status"/g) ?? []).length).toBe(1);
      expect(html).not.toContain('role="alert"');
      // Outside the `hidden` popup, and empty while the list is closed (static markup is never open).
      expect(html).toContain('</div><p id="svc-status" role="status" class="sr-only"></p>');
    }
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
