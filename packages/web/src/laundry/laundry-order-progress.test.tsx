import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ClensyI18nProvider } from '../i18n/i18n-context';
import { getDefaultMessages } from '../i18n/messages';
import { LaundryOrderProgress, laundryProgressSteps } from './laundry-order-progress';
import { LAUNDRY_ORDER_STATUSES, type LaundryFulfillmentType, type LaundryOrderStatus } from './laundry-order-status';

const FULFILLMENTS: readonly LaundryFulfillmentType[] = ['DELIVERY', 'PICKUP'];
const TERMINAL: readonly LaundryOrderStatus[] = ['CANCELLED', 'DAMAGED', 'LOST', 'REFUNDED', 'REJECTED'];
const NON_TERMINAL = LAUNDRY_ORDER_STATUSES.filter((s) => !TERMINAL.includes(s));
const { laundry } = getDefaultMessages();

// The §4.3 happy path, spelled out per fulfillment type: the displayed
// sequence every non-terminal status must render (Paid slot reads
// "Awaiting payment" only while that is the status).
const PATH: Record<LaundryFulfillmentType, LaundryOrderStatus[]> = {
  DELIVERY: ['RECEIVED', 'WEIGHED', 'PRICED', 'PAID', 'PROCESSING', 'READY', 'AWAITING_DELIVERY', 'COMPLETED'],
  PICKUP: ['RECEIVED', 'WEIGHED', 'PRICED', 'PAID', 'PROCESSING', 'READY', 'AWAITING_PICKUP', 'COMPLETED'],
};
const AWAITING_PAYMENT_PATH: Record<LaundryFulfillmentType, LaundryOrderStatus[]> = {
  DELIVERY: ['RECEIVED', 'WEIGHED', 'PRICED', 'AWAITING_PAYMENT', 'PROCESSING', 'READY', 'AWAITING_DELIVERY', 'COMPLETED'],
  PICKUP: ['RECEIVED', 'WEIGHED', 'PRICED', 'AWAITING_PAYMENT', 'PROCESSING', 'READY', 'AWAITING_PICKUP', 'COMPLETED'],
};
// Non-terminal statuses the server can write for this fulfillment type.
// The mismatched return statuses are asserted separately below.
const consistent = (fulfillment: LaundryFulfillmentType) =>
  NON_TERMINAL.filter((s) => s !== (fulfillment === 'PICKUP' ? 'AWAITING_DELIVERY' : 'AWAITING_PICKUP'));
const expectedPath = (status: LaundryOrderStatus, fulfillment: LaundryFulfillmentType) =>
  status === 'AWAITING_PAYMENT' ? AWAITING_PAYMENT_PATH[fulfillment] : PATH[fulfillment];

// renderToStaticMarkup escapes text (an apostrophe becomes &#x27;).
function escaped(text: string): string {
  return text.replaceAll("'", '&#x27;');
}

function render(status: LaundryOrderStatus, fulfillmentType: LaundryFulfillmentType) {
  return renderToStaticMarkup(
    <ClensyI18nProvider>
      <LaundryOrderProgress fulfillmentType={fulfillmentType} status={status} />
    </ClensyI18nProvider>,
  );
}

function stepItems(html: string): { current: boolean; label: string; state: string }[] {
  return [...html.matchAll(/<li( aria-current="step")?[^>]*>.*?<span[^>]*>([^<]*)<\/span><span class="sr-only">([^<]*)<\/span><\/li>/g)].map(
    (m) => ({ current: m[1] !== undefined, label: m[2], state: m[3] }),
  );
}

describe('laundryProgressSteps', () => {
  it('walks the pickup happy path with the current step marked', () => {
    expect(laundryProgressSteps('PRICED', 'PICKUP')).toEqual([
      { state: 'complete', status: 'RECEIVED' },
      { state: 'complete', status: 'WEIGHED' },
      { state: 'current', status: 'PRICED' },
      { state: 'upcoming', status: 'PAID' },
      { state: 'upcoming', status: 'PROCESSING' },
      { state: 'upcoming', status: 'READY' },
      { state: 'upcoming', status: 'AWAITING_PICKUP' },
      { state: 'upcoming', status: 'COMPLETED' },
    ]);
  });

  describe.each(FULFILLMENTS)('every status with %s', (fulfillment) => {
    it.each(consistent(fulfillment))('%s renders the full happy-path sequence with the right state on every step', (status) => {
      const steps = laundryProgressSteps(status, fulfillment) ?? [];
      const path = expectedPath(status, fulfillment);
      expect(steps.map((s) => s.status)).toEqual(path);
      const at = path.indexOf(status);
      expect(steps.map((s) => s.state)).toEqual(
        path.map((_, index) =>
          status === 'COMPLETED' || index < at ? 'complete' : index === at ? 'current' : 'upcoming',
        ),
      );
      expect(steps.filter((s) => s.state === 'current')).toHaveLength(status === 'COMPLETED' ? 0 : 1);
    });

    it.each(TERMINAL)('%s replaces the steps', (status) => {
      expect(laundryProgressSteps(status, fulfillment)).toBeNull();
    });
  });

  it('AWAITING_PAYMENT takes the Paid slot as current, never as a done Paid step', () => {
    expect(laundryProgressSteps('AWAITING_PAYMENT', 'DELIVERY')).toEqual([
      { state: 'complete', status: 'RECEIVED' },
      { state: 'complete', status: 'WEIGHED' },
      { state: 'complete', status: 'PRICED' },
      { state: 'current', status: 'AWAITING_PAYMENT' },
      { state: 'upcoming', status: 'PROCESSING' },
      { state: 'upcoming', status: 'READY' },
      { state: 'upcoming', status: 'AWAITING_DELIVERY' },
      { state: 'upcoming', status: 'COMPLETED' },
    ]);
    expect(laundryProgressSteps('AWAITING_PAYMENT', 'PICKUP')?.map((s) => s.status)).toEqual(AWAITING_PAYMENT_PATH.PICKUP);
  });

  it('PAID is the current Paid step', () => {
    expect(laundryProgressSteps('PAID', 'PICKUP')).toEqual([
      { state: 'complete', status: 'RECEIVED' },
      { state: 'complete', status: 'WEIGHED' },
      { state: 'complete', status: 'PRICED' },
      { state: 'current', status: 'PAID' },
      { state: 'upcoming', status: 'PROCESSING' },
      { state: 'upcoming', status: 'READY' },
      { state: 'upcoming', status: 'AWAITING_PICKUP' },
      { state: 'upcoming', status: 'COMPLETED' },
    ]);
  });

  it.each([
    ['AWAITING_PICKUP', 'PICKUP'],
    ['AWAITING_DELIVERY', 'DELIVERY'],
  ] as const)('%s is the current return step on its own branch', (status, fulfillment) => {
    expect(laundryProgressSteps(status, fulfillment)).toEqual([
      { state: 'complete', status: 'RECEIVED' },
      { state: 'complete', status: 'WEIGHED' },
      { state: 'complete', status: 'PRICED' },
      { state: 'complete', status: 'PAID' },
      { state: 'complete', status: 'PROCESSING' },
      { state: 'complete', status: 'READY' },
      { state: 'current', status },
      { state: 'upcoming', status: 'COMPLETED' },
    ]);
  });

  it('COMPLETED marks every step done and none current', () => {
    expect(laundryProgressSteps('COMPLETED', 'DELIVERY')).toEqual(
      PATH.DELIVERY.map((status) => ({ state: 'complete', status })),
    );
  });

  it.each(FULFILLMENTS)('after payment (%s) the Paid slot reads Paid: current at PAID, done from PROCESSING', (fulfillment) => {
    expect((laundryProgressSteps('PRICED', fulfillment) ?? [])[3]).toEqual({ state: 'upcoming', status: 'PAID' });
    expect((laundryProgressSteps('PAID', fulfillment) ?? [])[3]).toEqual({ state: 'current', status: 'PAID' });
    expect((laundryProgressSteps('PROCESSING', fulfillment) ?? [])[3]).toEqual({ state: 'complete', status: 'PAID' });
  });

  it('shows only the order\'s own return step', () => {
    expect((laundryProgressSteps('READY', 'PICKUP') ?? [])[6].status).toBe('AWAITING_PICKUP');
    expect((laundryProgressSteps('READY', 'DELIVERY') ?? [])[6].status).toBe('AWAITING_DELIVERY');
  });

  it.each([
    ['AWAITING_DELIVERY', 'PICKUP'],
    ['AWAITING_PICKUP', 'DELIVERY'],
  ] as const)('a mismatched %s + %s still shows the recorded status as the current step', (status, fulfillment) => {
    const steps = laundryProgressSteps(status, fulfillment) ?? [];
    expect(steps.map((s) => s.status)).toEqual(['RECEIVED', 'WEIGHED', 'PRICED', 'PAID', 'PROCESSING', 'READY', status, 'COMPLETED']);
    expect(steps[6]).toEqual({ state: 'current', status });
    expect(steps.filter((s) => s.state === 'current')).toHaveLength(1);
    const current = stepItems(render(status, fulfillment)).filter((i) => i.current);
    expect(current).toEqual([{ current: true, label: laundry.status[status], state: laundry.progress.state.current }]);
  });
});

describe('LaundryOrderProgress', () => {
  describe.each(FULFILLMENTS)('with %s', (fulfillment) => {
    it.each(consistent(fulfillment))('%s: the labeled sequence in an ordered list, accessible states, no controls', (status) => {
      const html = render(status, fulfillment);
      expect(html).toContain('<ol aria-label="Order progress"');
      expect(html).not.toContain('<button');
      expect(html).not.toContain('<a ');
      const items = stepItems(html);
      expect(items.map((i) => i.label)).toEqual(expectedPath(status, fulfillment).map((s) => laundry.status[s]));
      const steps = laundryProgressSteps(status, fulfillment) ?? [];
      expect(items.map((i) => i.state)).toEqual(steps.map((s) => laundry.progress.state[s.state]));
      expect(items.map((i) => i.current)).toEqual(steps.map((s) => s.state === 'current'));
      if (status === 'COMPLETED') {
        expect(html).not.toContain('aria-current');
        expect(items.every((i) => i.state === laundry.progress.state.complete)).toBe(true);
      } else {
        const current = items.filter((i) => i.current);
        expect(current).toHaveLength(1);
        expect(current[0]).toEqual({ current: true, label: laundry.status[status], state: laundry.progress.state.current });
      }
    });

    it.each(TERMINAL)('%s: a badge and its sentence, no steps', (status) => {
      const html = render(status, fulfillment);
      expect(html).not.toContain('<ol');
      expect(html).not.toContain('aria-current');
      expect(html).toContain(laundry.status[status]);
      expect(html).toContain(escaped(laundry.progress.terminal[status as keyof typeof laundry.progress.terminal]));
    });
  });

  it('labels AWAITING_PAYMENT as awaiting payment, not paid', () => {
    const items = stepItems(render('AWAITING_PAYMENT', 'PICKUP'));
    expect(items[3]).toEqual({ current: true, label: 'Awaiting payment', state: 'Current step' });
    expect(items.map((i) => i.label)).not.toContain('Paid');
  });
});
