import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LaundryInvoiceCard, LaundryOrderPaymentCard } from '../components/laundry/laundry-invoice-payment';
import type { LaundryInvoiceView, LaundryPaymentVerb, LaundryPaymentView } from './laundry-invoice-payment';

// The Invoice and Order payment cards (#166), rendered statically.
const INVOICE = {
  id: 'i1',
  amountDueMinorUnits: 45000,
  invoiceNumber: 'INV-2026-000001',
  paymentStatus: 'UNPAID',
  paymentTerms: 'PAY_ON_DELIVERY',
  totalMinorUnits: 45000,
} as const;

const EXPLANATION =
  'The order must be marked paid before processing starts. That is separate from the invoice payment status.';

function invoiceCard(
  view: LaundryInvoiceView,
  overrides: { failed?: boolean; generating?: boolean; invoice?: typeof INVOICE } = {},
): string {
  return renderToStaticMarkup(
    <LaundryInvoiceCard
      failed={overrides.failed ?? false}
      generating={overrides.generating ?? false}
      invoice={overrides.invoice}
      view={view}
      onGenerate={() => undefined}
    />,
  );
}

function paymentCard(
  view: LaundryPaymentView,
  overrides: { failure?: LaundryPaymentVerb | null; pending?: boolean } = {},
): string {
  return renderToStaticMarkup(
    <LaundryOrderPaymentCard
      failure={overrides.failure ?? null}
      pending={overrides.pending ?? false}
      view={view}
      onRun={() => undefined}
    />,
  );
}

function buttons(html: string): string[] {
  return [...html.matchAll(/<button\b[^>]*>(.*?)<\/button>/g)].map((match) => match[0]);
}

describe('LaundryInvoiceCard', () => {
  it('case 1: loading shows LoadingState only', () => {
    const html = invoiceCard('loading');
    expect(html).toContain('role="status"');
    expect(html).not.toContain('No invoice yet.');
    expect(html).not.toContain('<button');
  });

  it('case 2: error says it cannot load', () => {
    const html = invoiceCard('error');
    expect(html).toContain('Unable to load invoice.');
    expect(html).not.toContain('No invoice yet.');
  });

  it('case 3: unresolved shows no body', () => {
    const html = invoiceCard('unresolved');
    expect(html).not.toContain('No invoice yet.');
    expect(html).not.toContain('Unable to load invoice.');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('role="status"');
  });

  it('case 4: generate shows the three terms in human language with help, Pay on completion checked', () => {
    const html = invoiceCard('generate');
    expect(html).toMatch(/<legend[^>]*>Payment terms<\/legend>/);
    for (const label of ['Pay now', 'Pay on completion', 'Pay on delivery']) expect(html).toContain(`>${label}<`);
    expect(html).toContain('Due when the invoice is issued.');
    expect(html).toContain('Due when the work is complete. No due date is set yet.');
    expect(html).toContain('Due when the laundry is delivered. No due date is set yet.');
    expect(html).toMatch(/<input[^>]*value="PAY_ON_COMPLETION"[^>]*checked=""|<input[^>]*checked=""[^>]*value="PAY_ON_COMPLETION"/);
    for (const term of ['PAY_NOW', 'PAY_ON_DELIVERY']) {
      expect(html).not.toMatch(new RegExp(`<input[^>]*value="${term}"[^>]*checked=""`));
    }
    expect(html).not.toMatch(/>PAY_[A-Z_]+</);
    expect(html).not.toContain('type="date"');
    expect(html).toMatch(/aria-describedby="laundry-invoice-terms-PAY_NOW-help"/);
    expect(html).toContain('id="laundry-invoice-terms-PAY_NOW-help"');
    const [generate] = buttons(html);
    expect(generate).toContain('Generate invoice');
    expect(generate).not.toContain('disabled=""');
    expect(html).not.toContain('role="alert"');

    const busy = buttons(invoiceCard('generate', { generating: true }))[0];
    expect(busy).toContain('disabled=""');
    expect(busy).toContain('Generating…');

    expect(invoiceCard('generate', { failed: true })).toMatch(/<p role="alert"[^>]*>Unable to generate invoice\.<\/p>/);
  });

  it('case 5: existing invoice shows number, amount, badge, terms and the billing link', () => {
    const html = invoiceCard('invoice', { invoice: INVOICE });
    expect(html).toContain('INV-2026-000001');
    expect(html).toContain('₱450.00');
    expect(html).toContain('>Unpaid<');
    expect(html).not.toContain('>UNPAID<');
    expect(html).toContain('Pay on delivery');
    expect(html).toContain('href="/app/billing?detail=i1"');
    expect(html).toContain('Open invoice');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<input');
    expect(html).not.toContain('Amount due');
  });

  it('case 11: no estimate wording', () => {
    for (const view of ['generate', 'none', 'loading'] as const) expect(invoiceCard(view)).not.toContain('Estimate');
    expect(invoiceCard('invoice', { invoice: INVOICE })).not.toContain('Estimate');
  });

  it('case 12: the generate alert shows only beside the generate form', () => {
    const withInvoice = invoiceCard('invoice', { failed: true, invoice: INVOICE });
    expect(withInvoice).toContain('INV-2026-000001');
    expect(withInvoice).not.toContain('role="alert"');
    expect(withInvoice).not.toContain('Unable to generate invoice.');
    const error = invoiceCard('error', { failed: true });
    expect(error).toContain('Unable to load invoice.');
    expect(error).not.toContain('Unable to generate invoice.');
    for (const view of ['loading', 'unresolved', 'none'] as const) {
      expect(invoiceCard(view, { failed: true })).not.toContain('Unable to generate invoice.');
    }
  });

  it('says there is no invoice yet when the actor may not generate', () => {
    const html = invoiceCard('none');
    expect(html).toContain('No invoice yet.');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<input');
  });

  it('is a bordered card titled Invoice', () => {
    const html = invoiceCard('none');
    expect(html).toMatch(/^<div class="rounded-md border border-slate-200 p-4">/);
    expect(html).toMatch(/<h3[^>]*>Invoice<\/h3>/);
  });
});

describe('LaundryOrderPaymentCard', () => {
  it('case 6: explains the separation in every view', () => {
    for (const view of ['choose', 'markPaid', 'paid', 'none'] as const) {
      const html = paymentCard(view);
      expect(html).toMatch(/<h3[^>]*>Order payment<\/h3>/);
      expect(html).toContain(EXPLANATION);
      expect(html).toMatch(/^<div class="rounded-md border border-slate-200 p-4">/);
    }
  });

  it('case 7: choose offers Mark paid first, then Mark awaiting payment as secondary', () => {
    const html = paymentCard('choose');
    const [first, second] = buttons(html);
    expect(first).toContain('Mark paid');
    expect(first).not.toContain('data-variant="secondary"');
    expect(second).toContain('Mark awaiting payment');
    expect(second).toContain('data-variant="secondary"');
    expect(html).toContain('Mark paid if the customer pays at the counter. Mark awaiting payment if they will pay later.');
    for (const button of buttons(paymentCard('choose', { pending: true }))) expect(button).toContain('disabled=""');
    expect(paymentCard('choose', { failure: 'markAwaitingPayment' })).toMatch(
      /<p role="alert"[^>]*>Unable to mark the order awaiting payment\.<\/p>/,
    );
  });

  it('case 8: markPaid offers Mark paid only', () => {
    const html = paymentCard('markPaid');
    expect(buttons(html)).toHaveLength(1);
    expect(buttons(html)[0]).toContain('Mark paid');
    expect(html).not.toContain('Mark awaiting payment');
    expect(html).not.toContain('Mark paid if the customer pays at the counter.');
  });

  it('case 9: paid says processing can start, with no button', () => {
    const html = paymentCard('paid');
    expect(html).toContain('Paid. Processing can start.');
    expect(html).not.toContain('<button');
  });

  it('case 10: none offers no button and no paid sentence', () => {
    const html = paymentCard('none');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('Paid. Processing can start.');
  });

  it('case 11: no estimate wording', () => {
    for (const view of ['choose', 'markPaid', 'paid', 'none'] as const) expect(paymentCard(view)).not.toContain('Estimate');
  });

  // Decision (k): the page filters with `laundryPaymentFailureAlert`; the
  // card shows what it is given, even where no button remains.
  it('case 13: shows the alert it is given in every view, and none without one', () => {
    const cancelled = paymentCard('none', { failure: 'markPaid' });
    expect(cancelled).toMatch(/<p role="alert"[^>]*>Unable to mark the order paid\.<\/p>/);
    expect(cancelled).not.toContain('<button');
    const awaiting = paymentCard('markPaid', { failure: 'markAwaitingPayment' });
    expect(buttons(awaiting)[0]).toContain('Mark paid');
    expect(awaiting).toMatch(/<p role="alert"[^>]*>Unable to mark the order awaiting payment\.<\/p>/);
    expect(paymentCard('markPaid', { failure: 'markPaid' })).toMatch(/<p role="alert"[^>]*>Unable to mark the order paid\.<\/p>/);
    const paid = paymentCard('paid', { failure: null });
    expect(paid).toContain('Paid. Processing can start.');
    expect(paid).not.toContain('role="alert"');
    for (const html of [cancelled, awaiting, paid]) {
      expect(html).not.toMatch(/amount paid|payment received|recorded/i);
    }
  });
});
