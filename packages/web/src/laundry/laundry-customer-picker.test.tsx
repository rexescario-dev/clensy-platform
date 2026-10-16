import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LaundryCustomerPicker, type LaundryCustomerPickerProps } from './laundry-customer-picker';

const noop = () => {};
const ANA = { id: 'c1', email: 'ana@example.com', fullName: 'Ana Reyes', phone: '555-0101' };
const ANA_NO_PHONE = { id: 'c2', email: 'ana.r@example.com', fullName: 'Ana Reyes', phone: '' };

function input(html: string): string {
  return /<input[^>]*>/.exec(html)![0];
}

function render(props: Partial<LaundryCustomerPickerProps> = {}): string {
  return renderToStaticMarkup(
    <LaundryCustomerPicker
      id="customer"
      query="ana"
      options={[]}
      status="idle"
      onQueryChange={noop}
      onSelect={noop}
      {...props}
    />,
  );
}

// Static markup: the closed state, the popup's content (rendered `hidden`
// while closed) and the error wiring. Keyboard and mouse are covered by
// apps/web/lib/laundry-customer-picker.interaction.test.tsx.
describe('LaundryCustomerPicker', () => {
  it('labels a combobox that controls a listbox and starts collapsed', () => {
    const html = render();
    expect(html).toContain('<label for="customer"');
    expect(html).toContain('>Customer</label>');
    const field = input(html);
    expect(field).toContain('id="customer"');
    expect(field).toContain('role="combobox"');
    expect(field).toContain('aria-controls="customer-listbox"');
    expect(field).toContain('aria-expanded="false"');
    expect(field).toContain('aria-autocomplete="list"');
    expect(field).toContain('autoComplete="off"');
    expect(field).not.toContain('aria-activedescendant');
    expect(html).toMatch(/<ul[^>]*id="customer-listbox"[^>]*role="listbox"/);
  });

  it('lists each match with phone, or email when there is no phone, as secondary text', () => {
    const html = render({ options: [ANA, ANA_NO_PHONE], status: 'ready' });
    expect(html).toContain('id="customer-option-c1"');
    expect(html).toContain('id="customer-option-c2"');
    expect((html.match(/role="option"/g) ?? []).length).toBe(2);
    expect(html).toContain('<span class="block text-sm text-slate-500">555-0101</span>');
    expect(html).toContain('<span class="block text-sm text-slate-500">ana.r@example.com</span>');
  });

  it('shows one line for searching, no matches, a failed search, and more matches than shown', () => {
    expect(render({ status: 'loading' })).toContain('Searching…');
    expect(render({ status: 'ready' })).toContain('No customers match.');
    const failed = render({ status: 'error' });
    expect(failed).toContain('<p class="px-3 py-2 text-sm text-red-600">Unable to search customers.</p>');
    expect(failed).not.toContain('role="alert"');
    expect(failed).toContain('<p id="customer-status" role="status" class="sr-only"></p>');
    expect(render({ options: [ANA], status: 'ready' })).not.toContain('No customers match.');
    expect(render({ options: [ANA], status: 'ready', truncated: true })).toContain(
      'More customers match. Type more of the name to narrow the search.',
    );
    expect(render({ options: [ANA], status: 'ready' })).not.toContain('More customers match.');
  });

  it('renders no option unless the search is ready', () => {
    for (const status of ['idle', 'loading', 'error'] as const) {
      expect(render({ options: [ANA], status })).not.toContain('role="option"');
    }
  });

  it('wires a validation error to the input', () => {
    const html = render({ error: 'Select a customer.' });
    const field = input(html);
    expect(field).toContain('aria-invalid="true"');
    expect(field).toContain('aria-describedby="customer-error"');
    expect(field).toContain('border-red-500');
    expect(html).toContain('<p id="customer-error" class="text-sm text-red-600">Select a customer.</p>');
  });
});
