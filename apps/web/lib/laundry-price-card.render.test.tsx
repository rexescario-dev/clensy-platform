import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LaundryPriceCard, type LaundryPriceCardProps } from '../components/laundry/laundry-price-card';
import type { LaundryEstimateState, LaundryPriceRow } from './laundry-price-review';

const ROWS: LaundryPriceRow[] = [
  {
    amountMinorUnits: 12345,
    key: 'preview-0',
    minimumCharge: { minorUnits: 15000 },
    name: 'Wash & fold with a very long name that has to wrap on a phone',
    quantity: { kind: 'weight', value: '2.505 kg' },
    rateKey: 'perKg',
    rateMinorUnits: 5000,
  },
  {
    amountMinorUnits: 7500,
    key: 'preview-1',
    minimumCharge: null,
    name: 'Ironing (add-on)',
    quantity: { kind: 'items', value: '3' },
    rateKey: 'perItem',
    rateMinorUnits: 2500,
  },
  {
    amountMinorUnits: 2500,
    key: 'preview-2',
    minimumCharge: { minorUnits: null },
    name: 'Shoes',
    quantity: { kind: 'items', value: '1' },
    rateKey: 'perItem',
    rateMinorUnits: 2500,
  },
  {
    amountMinorUnits: 15000,
    key: 'preview-3',
    minimumCharge: null,
    name: 'Softener (add-on)',
    quantity: null,
    rateKey: 'flat',
    rateMinorUnits: 15000,
  },
];

function estimate(change: Partial<Extract<LaundryPriceCardProps, { kind: 'estimate' }>> = {}): string {
  return renderToStaticMarkup(
    <LaundryPriceCard
      kind="estimate"
      confirming={false}
      failure={undefined}
      onConfirm={() => {}}
      onRetry={() => {}}
      rows={ROWS}
      state="ready"
      totalMinorUnits={99999}
      {...change}
    />,
  );
}

function final(change: Partial<Extract<LaundryPriceCardProps, { kind: 'final' }>> = {}): string {
  return renderToStaticMarkup(<LaundryPriceCard kind="final" more={false} rows={ROWS} totalMinorUnits={45000} {...change} />);
}

function confirmTag(html: string): string {
  const tag = /<button\b[^>]*>(Confirm price|Confirming…)<\/button>/.exec(html)?.[0];
  expect(tag).toBeDefined();
  return tag!;
}

const CAPTION =
  'Confirming sets the final price. Weight, services, and total cannot be changed afterward. To correct a mistake before payment, cancel the order and start a new one.';

describe('LaundryPriceCard', () => {
  it('case 1: an estimate says Estimate, never Final price, Total due or Invoice', () => {
    const html = estimate();
    expect(html).toContain('<div class="rounded-md border border-slate-200 p-4">');
    expect(html).toMatch(/<p class="text-xs font-medium uppercase tracking-wide text-slate-500">Estimate<\/p>/);
    expect(html).not.toContain('Final price');
    expect(html).not.toContain('Total due');
    expect(html).not.toContain('Invoice');
  });

  it('case 2: a ready estimate lists every server figure and enables Confirm', () => {
    const html = estimate();
    expect(html).toContain('Wash &amp; fold with a very long name');
    expect(html).toContain('2.505 kg');
    expect(html).toContain('₱50.00 per kg');
    expect(html).toContain('₱123.45');
    expect(html).toContain('3 items');
    expect(html).toContain('1 item<');
    expect(html).not.toContain('1 items');
    expect(html).toContain('₱25.00 per item');
    expect(html).toContain('₱150.00 flat');
    expect(html).toContain('Estimated total');
    expect(html).toMatch(/<p class="[^"]*text-lg font-semibold[^"]*">₱999\.99<\/p>/);
    expect(confirmTag(html)).not.toContain('disabled=""');
    expect(html).toContain(CAPTION);
  });

  it.each<[LaundryEstimateState, string]>([
    ['noBase', 'Select a base service to see an estimate.'],
    ['incomplete', 'Finish choosing services to see an estimate.'],
    ['loading', 'Updating estimate…'],
    ['failed', 'Couldn’t calculate the estimate.'],
  ])('case 3: %s shows its sentence, no rows or total, a disabled Confirm and the caption', (state, sentence) => {
    const html = estimate({ state });
    expect(html).toContain('>Estimate<');
    expect(html).toMatch(new RegExp(`<div aria-live="polite"><p[^>]*>${sentence}</p></div>`));
    for (const absent of ['Wash &amp; fold', '₱123.45', '₱50.00 per kg', 'Estimated total', '₱999.99']) {
      expect(html).not.toContain(absent);
    }
    expect(confirmTag(html)).toContain('disabled=""');
    expect(html).toContain(CAPTION);
    expect(html.includes('>Try again</button>')).toBe(state === 'failed');
  });

  it('case 4: confirming says Confirming… and is disabled; a failure is an alert', () => {
    const html = estimate({ confirming: true, failure: 'Unable to price order.' });
    expect(confirmTag(html)).toContain('Confirming…');
    expect(confirmTag(html)).toContain('disabled=""');
    expect(html).toMatch(/<p role="alert"[^>]*>Unable to price order\.<\/p>/);
    expect(estimate()).not.toContain('role="alert"');
  });

  it('case 5: minimum-charge notes use the server minimum, or none when it is null', () => {
    const html = estimate();
    expect(html).toContain('Minimum charge applied (₱150.00).');
    expect(html).toContain('Minimum charge applied.');
    expect(html.split('Minimum charge applied').length - 1).toBe(2);
  });

  it('case 6: a final card reads Final price, the order total, no Confirm and no estimate wording', () => {
    const html = final();
    expect(html).toMatch(/>Final price<\/p>/);
    expect(html).not.toContain('Estimate');
    expect(html).not.toContain('Confirm price');
    expect(html).not.toContain('<button');
    expect(html).not.toContain(CAPTION);
    expect(html).toContain('Order total');
    expect(html).toContain('₱450.00');
    expect(html).toContain('Minimum charge applied (₱150.00).');
    expect(html).not.toContain('More lines are not loaded.');
    expect(final({ more: true })).toContain('More lines are not loaded.');
    const empty = final({ rows: [] });
    expect(empty).not.toContain('<li');
    expect(empty).toContain('₱450.00');
  });

  it('case 7: rows are a two-column grid that wraps the name, with tabular figures', () => {
    const html = final();
    expect(html.split('class="grid grid-cols-[minmax(0,1fr)_auto] gap-2"').length - 1).toBe(4);
    expect(html).toContain('<div class="min-w-0">');
    expect(html).toContain('tabular-nums');
    expect(html).not.toContain('<table');
  });

  // M5 round 1: an inconsistent `ready` with no server total is never a
  // blank estimate and never shows rows or an invented total.
  it('case 8: ready without a total shows the failed state, no rows, and a disabled Confirm', () => {
    const html = estimate({ state: 'ready', totalMinorUnits: null });
    expect(html).toContain('Couldn’t calculate the estimate.');
    expect(html).toContain('>Try again</button>');
    for (const absent of ['Wash &amp; fold', '₱123.45', 'Estimated total', '₱999.99']) {
      expect(html).not.toContain(absent);
    }
    expect(confirmTag(html)).toContain('disabled=""');
  });
});
