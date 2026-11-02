import type { Role } from '@clensy/client';
import { ToastProvider } from '@clensy/ui';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { LaundryInvoiceCard, LaundryOrderPaymentCard } from '../components/laundry/laundry-invoice-payment';
import type { LaundryInvoiceView, LaundryPaymentVerb, LaundryPaymentView } from './laundry-invoice-payment';
import type { LaundryMutationLock } from './use-laundry-mutation-lock';

// The invoice the case passes, read by the payments panel's query stub
// (#39 Task 9): the card now mounts the real `InvoicePaymentsPanel`, so its
// client hooks are stubbed here, not the panel.
const card = vi.hoisted(() => ({
  invoice: undefined as
    { amountDueMinorUnits?: number; amountPaidMinorUnits?: number; id: string; paymentStatus: string; totalMinorUnits: number } | undefined,
}));

vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useApolloClient: () => ({ query: vi.fn() }),
}));

vi.mock('@clensy/client', () => ({
  InvoicePaymentsDocument: {},
  useAdminsQuery: () => ({ data: undefined }),
  useInvoicePaymentsQuery: () => {
    const invoice = card.invoice;
    return {
      data: invoice
        ? {
            invoice: {
              id: invoice.id,
              amountDueMinorUnits: invoice.amountDueMinorUnits ?? invoice.totalMinorUnits,
              amountPaidMinorUnits: invoice.amountPaidMinorUnits ?? 0,
              payments: { nodes: [], pageInfo: { hasNextPage: false } },
              paymentStatus: invoice.paymentStatus,
              totalMinorUnits: invoice.totalMinorUnits,
            },
          }
        : undefined,
      error: undefined,
      loading: false,
      refetch: vi.fn(),
    };
  },
  useRecordInvoicePaymentMutation: () => [vi.fn(), { loading: false }],
  useRefundInvoicePaymentMutation: () => [vi.fn(), { loading: false }],
}));

// The Invoice and Order payment cards (#166), rendered statically.
const INVOICE = {
  id: 'i1',
  amountDueMinorUnits: 45000,
  amountPaidMinorUnits: 0,
  invoiceNumber: 'INV-2026-000001',
  paymentStatus: 'UNPAID',
  paymentTerms: 'PAY_ON_DELIVERY',
  totalMinorUnits: 45000,
} as const;

const EXPLANATION =
  'The order must be marked paid before processing starts. That is separate from the invoice payment status.';

// A lock another mutation holds (#165): the panel's controls are disabled.
const HELD_BY_TRANSITION: LaundryMutationLock = {
  held: true,
  isHeld: () => true,
  release: () => undefined,
  tryAcquire: () => null,
};

function invoiceCard(
  view: LaundryInvoiceView,
  overrides: {
    failed?: boolean;
    generating?: boolean;
    invoice?: typeof INVOICE;
    lock?: LaundryMutationLock;
    role?: Role;
  } = {},
): string {
  card.invoice = overrides.invoice;
  return renderToStaticMarkup(
    <ToastProvider>
      <LaundryInvoiceCard
        failed={overrides.failed ?? false}
        generating={overrides.generating ?? false}
        invoice={overrides.invoice}
        lock={overrides.lock}
        role={overrides.role ?? 'ANALYST'}
        view={view}
        viewerId="staff-1"
        onGenerate={() => undefined}
      />
    </ToastProvider>,
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

// For each radio: its value, the text of the element its
// `aria-describedby` names, and the text of the label whose `for` is its id.
function termOptions(html: string): Array<{ help: string | undefined; label: string | undefined; value: string }> {
  const textOf = (pattern: RegExp) => pattern.exec(html)?.[1];
  const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...html.matchAll(/<input\b[^>]*type="radio"[^>]*>/g)].map(([input]) => {
    const id = /\bid="([^"]+)"/.exec(input)?.[1] ?? '';
    const describedBy = /\baria-describedby="([^"]+)"/.exec(input)?.[1] ?? '';
    return {
      help: textOf(new RegExp(`<p\\b[^>]*\\bid="${escape(describedBy)}"[^>]*>([^<]*)</p>`)),
      label: textOf(new RegExp(`<label\\b[^>]*\\bfor="${escape(id)}"[^>]*>([^<]*)</label>`)),
      value: /\bvalue="([^"]+)"/.exec(input)?.[1] ?? '',
    };
  });
}

function ids(html: string): string[] {
  return [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]!);
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
    // Each radio is described by its own help text and named by its own
    // label, whatever ids React generates.
    expect(termOptions(html)).toEqual([
      { help: 'Due when the invoice is issued.', label: 'Pay now', value: 'PAY_NOW' },
      { help: 'Due when the work is complete. No due date is set yet.', label: 'Pay on completion', value: 'PAY_ON_COMPLETION' },
      { help: 'Due when the laundry is delivered. No due date is set yet.', label: 'Pay on delivery', value: 'PAY_ON_DELIVERY' },
    ]);
    const [generate] = buttons(html);
    expect(generate).toContain('Generate invoice');
    expect(generate).not.toContain('disabled=""');
    expect(html).not.toContain('role="alert"');

    const busy = buttons(invoiceCard('generate', { generating: true }))[0];
    expect(busy).toContain('disabled=""');
    expect(busy).toContain('Generating…');

    expect(invoiceCard('generate', { failed: true })).toMatch(/<p role="alert"[^>]*>Unable to generate invoice\.<\/p>/);
  });

  // Review fix: ids and the radio group come from `useId()`, so two mounted
  // forms neither share an id nor join one radio group.
  it('two generate forms on one page share no id and no radio group', () => {
    const html = renderToStaticMarkup(
      <>
        <LaundryInvoiceCard
          failed={false}
          generating={false}
          invoice={undefined}
          role="TENANT_OWNER"
          view="generate"
          viewerId="staff-1"
          onGenerate={() => undefined}
        />
        <LaundryInvoiceCard
          failed={false}
          generating={false}
          invoice={undefined}
          role="TENANT_OWNER"
          view="generate"
          viewerId="staff-1"
          onGenerate={() => undefined}
        />
      </>,
    );
    const all = ids(html);
    expect(all).toHaveLength(12);
    expect(new Set(all).size).toBe(all.length);
    const names = [...html.matchAll(/<input\b[^>]*\bname="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(names).size).toBe(2);
    expect(termOptions(html).every((option) => option.help !== undefined && option.label !== undefined)).toBe(true);
  });

  it('case 5: existing invoice shows number, terms and the billing link; the payments panel shows the total and badge', () => {
    const html = invoiceCard('invoice', { invoice: INVOICE, role: 'ANALYST' });
    const heading = html.search(/<h4[^>]*>Payments<\/h4>/);
    expect(heading).toBeGreaterThan(-1);
    const facts = html.slice(0, heading);
    const panel = html.slice(heading);
    expect(facts).toContain('INV-2026-000001');
    expect(facts).toContain('Pay on delivery');
    expect(facts).toContain('href="/app/billing?detail=i1"');
    expect(facts).toContain('Open invoice');
    expect(facts).not.toContain('₱450.00');
    expect(facts).not.toContain('>Unpaid<');
    expect(facts).not.toContain('<button');
    expect(facts).not.toContain('<input');
    expect(panel).toContain('₱450.00');
    expect(panel).toContain('>Unpaid<');
    expect(html).not.toContain('>UNPAID<');
    expect(html.split('>Unpaid<')).toHaveLength(2);
    // ANALYST may read payments but neither record nor refund.
    expect(html).not.toContain('Record payment');
    expect(html).not.toContain('Refund payment');
  });

  it('disables Record payment while another mutation holds the page lock', () => {
    const free = buttons(invoiceCard('invoice', { invoice: INVOICE, role: 'TENANT_OWNER' })).find((button) =>
      button.includes('Record payment'),
    );
    expect(free).toBeDefined();
    expect(free).not.toContain('disabled=""');
    const held = buttons(
      invoiceCard('invoice', { invoice: INVOICE, lock: HELD_BY_TRANSITION, role: 'TENANT_OWNER' }),
    ).find((button) => button.includes('Record payment'));
    expect(held).toBeDefined();
    expect(held).toContain('disabled=""');
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

  // Characterization (spec §4.10): the card's copy and verbs are unchanged
  // by the invoice payments panel.
  it('keeps the Order payment explanation', () => {
    for (const view of ['choose', 'markPaid', 'paid', 'none'] as const) {
      expect(paymentCard(view)).toContain(EXPLANATION);
    }
    expect(buttons(paymentCard('choose')).map((button) => button.replace(/<[^>]*>/g, ''))).toEqual([
      'Mark paid',
      'Mark awaiting payment',
    ]);
    expect(buttons(paymentCard('markPaid')).map((button) => button.replace(/<[^>]*>/g, ''))).toEqual(['Mark paid']);
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
