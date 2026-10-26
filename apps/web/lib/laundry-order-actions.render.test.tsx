import type { LaundryOrderVerb } from '@clensy/web';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { LaundryOrderActions, type LaundryOrderActionsProps } from '../components/laundry/laundry-order-actions';
import type { LaundryActionVerb } from './laundry-order-lifecycle-actions';

// The Actions section (#165), rendered statically from fixture verb lists,
// not from the helper: the helper's table is the foundation's to test.
const CONFIRM_SENTENCES: Record<'cancel' | 'markDamaged' | 'markLost' | 'refund' | 'reject', [string, string]> = {
  cancel: ['Cancel order', 'Cancel this order? It will be called off before payment. This cannot be undone.'],
  markDamaged: ['Mark damaged', 'Mark this order damaged? This cannot be undone.'],
  markLost: ['Mark lost', 'Mark this order lost? This cannot be undone.'],
  refund: [
    'Refund order',
    "Refund this order? This records that the order's collected payment is returned. This cannot be undone.",
  ],
  reject: ['Reject order', 'Reject this order? The shop is refusing it at intake. This cannot be undone.'],
};

function render(verbs: LaundryOrderVerb[], overrides: Partial<LaundryOrderActionsProps> = {}): string {
  return renderToStaticMarkup(
    <LaundryOrderActions
      confirmVerb={null}
      confirming={false}
      disabled={false}
      failure={null}
      verbs={verbs}
      onCloseConfirm={() => undefined}
      onConfirm={() => Promise.resolve()}
      onRequestConfirm={() => undefined}
      onRun={() => undefined}
      {...overrides}
    />,
  );
}

// Each `<button …>label</button>` in markup order, with its attributes.
function buttons(html: string): { attributes: string; label: string }[] {
  return [...html.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)].map((match) => ({
    attributes: match[1]!,
    label: match[2]!,
  }));
}

function escaped(text: string): string {
  return text.replaceAll("'", '&#x27;');
}

describe('LaundryOrderActions', () => {
  it('puts the forward verb first, then a separator, then the destructive one', () => {
    const html = render(['startProcessing', 'refund']);
    const found = buttons(html);
    expect(found.map((button) => button.label)).toEqual(['Start processing', 'Refund order']);
    expect(found[0]!.attributes).toContain('data-variant="default"');
    expect(found[1]!.attributes).toContain('data-variant="secondary"');
    const separator = html.indexOf('data-slot="separator"');
    expect(separator).toBeGreaterThan(html.indexOf('Start processing'));
    expect(separator).toBeLessThan(html.indexOf('Refund order'));
  });

  it('shows one secondary button and no separator for a destructive verb alone', () => {
    const html = render(['cancel']);
    expect(buttons(html)).toEqual([{ attributes: expect.stringContaining('data-variant="secondary"'), label: 'Cancel order' }]);
    expect(html).not.toContain('data-slot="separator"');
  });

  it('shows one primary button and no separator for a forward verb alone', () => {
    const html = render(['markReady']);
    expect(buttons(html)).toEqual([{ attributes: expect.stringContaining('data-variant="default"'), label: 'Mark ready' }]);
    expect(html).not.toContain('data-slot="separator"');
  });

  it.each([
    ['markAwaitingDelivery', 'Mark awaiting delivery', 'Mark awaiting pickup'],
    ['markAwaitingPickup', 'Mark awaiting pickup', 'Mark awaiting delivery'],
  ] as const)('renders %s and not the other branch', (verb, shown, hidden) => {
    const html = render([verb]);
    expect(html).toContain(shown);
    expect(html).not.toContain(hidden);
  });

  it('never renders the payment verbs, weigh, price or generate invoice', () => {
    const html = render(['markPaid', 'markAwaitingPayment', 'weigh', 'price', 'generateInvoice']);
    for (const label of ['Mark paid', 'Mark awaiting payment', 'Record weight', 'Confirm price', 'Generate invoice']) {
      expect(html).not.toContain(label);
    }
    expect(html).toContain('No further actions for this order.');
  });

  it('says there is nothing to do, with no button, when no verb is allowed', () => {
    const html = render([]);
    expect(html).toContain('No further actions for this order.');
    expect(html).not.toContain('<button');
  });

  it('disables every button while disabled', () => {
    const found = buttons(render(['startProcessing', 'cancel', 'refund'], { disabled: true }));
    expect(found).toHaveLength(3);
    expect(found.every((button) => /\sdisabled=""/.test(button.attributes))).toBe(true);
  });

  it('renders no dialog until a destructive verb awaits confirmation, and calls nothing', () => {
    const onConfirm = vi.fn(() => Promise.resolve());
    const onRun = vi.fn();
    const html = render(['cancel'], { onConfirm, onRun });
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain(CONFIRM_SENTENCES.cancel[1]);
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onRun).not.toHaveBeenCalled();
  });

  it.each(Object.entries(CONFIRM_SENTENCES))('renders the %s dialog with its title, sentence and label', (verb, [label, sentence]) => {
    const onConfirm = vi.fn(() => Promise.resolve());
    const html = render([verb as LaundryActionVerb], { confirmVerb: verb as LaundryActionVerb, onConfirm });
    expect(html).toContain('role="dialog"');
    expect(html).toContain(`<h2 id=`);
    expect(html).toMatch(new RegExp(`<h2[^>]*>${label}</h2>`));
    expect(html).toContain(escaped(sentence));
    const dialog = html.slice(html.indexOf('role="dialog"'));
    expect(buttons(dialog).map((button) => button.label)).toEqual(['Cancel', label]);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('disables both dialog buttons while this dialog is confirming', () => {
    const html = render(['cancel'], { confirmVerb: 'cancel', confirming: true });
    const dialog = html.slice(html.indexOf('role="dialog"'));
    const found = buttons(dialog);
    expect(found).toHaveLength(2);
    expect(found.every((button) => /\sdisabled=""/.test(button.attributes))).toBe(true);
  });

  it('shows the server message in an alert', () => {
    const html = render(['reject'], { failure: { message: 'Server says no', verb: 'reject' } });
    expect(html).toMatch(/<p[^>]*role="alert"[^>]*>Server says no<\/p>/);
  });

  it('falls back to the catalog message without a server message', () => {
    const html = render(['cancel'], { failure: { message: null, verb: 'cancel' } });
    expect(html).toMatch(/<p[^>]*role="alert"[^>]*>Unable to cancel the order\.<\/p>/);
  });

  it('keeps the alert when no button is left', () => {
    const html = render([], { failure: { message: null, verb: 'cancel' } });
    expect(html).toContain('Unable to cancel the order.');
    expect(html).toContain('No further actions for this order.');
  });
});
