// @vitest-environment jsdom
import type { PriceLaundryOrderInput, PricingUnit } from '@clensy/client';
import { PreviewLaundryOrderPriceDocument } from '@clensy/client';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Drives the real LaundryServicesEditor with the real selection hook, the
// way the order page wires them (#158). Every focus change is a real DOM
// event on the rendered combobox; the test never calls the hook's touch
// functions. Only the Apollo client and the two catalog queries are mocked.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ORDER = '00000000-0000-4000-8000-000000000001';
const WASH = '11111111-1111-4111-8111-111111111111';
const SHOES = '22222222-2222-4222-8222-222222222222';
const DRY = '33333333-3333-4333-8333-333333333333';
const DUVET = '44444444-4444-4444-8444-444444444444';
const IRON = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const SOFT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';

interface CatalogEntry {
  id: string;
  name: string;
  rate: number;
  unit: PricingUnit;
}

// In the server's order: by name.
const SERVICES: CatalogEntry[] = [
  { id: DRY, name: 'Dry clean', rate: 15000, unit: 'FLAT' },
  { id: DUVET, name: 'Duvet', rate: 20000, unit: 'PER_SERVICE' },
  { id: SHOES, name: 'Shoes', rate: 2500, unit: 'PER_ITEM' },
  { id: WASH, name: 'Wash', rate: 5000, unit: 'PER_KG' },
];
const ADD_ONS: CatalogEntry[] = [
  { id: IRON, name: 'Ironing', rate: 2500, unit: 'PER_ITEM' },
  { id: SOFT, name: 'Softener', rate: 15000, unit: 'FLAT' },
];

const WEIGHT = 2505;

interface PreviewCall {
  input: PriceLaundryOrderInput;
  query: unknown;
}

// What the preview mock does. `failIf` returns a rejection for an input;
// `rate` overrides every line's rate.
const preview = vi.hoisted(() => ({
  calls: [] as unknown[],
  failIf: null as ((input: unknown) => unknown) | null,
  handler: null as ((options: { query: unknown; variables: { input: unknown } }) => Promise<unknown>) | null,
  rate: null as number | null,
}));
const priceMutation = vi.hoisted(() => vi.fn());
const client = vi.hoisted(() => ({ query: vi.fn() }));

vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useApolloClient: () => client,
}));

// The catalog queries return the entries whose name contains the filter text,
// as the server does; every entry's list price is 99900 (case 17).
function catalogQuery(entries: () => CatalogEntry[], listKey: 'addOns' | 'services') {
  return (options: { skip?: boolean; variables: { filter: { name?: { iLike: string } } } }) => {
    if (options.skip) return { data: undefined, error: undefined, loading: false };
    const text = (options.variables.filter.name?.iLike ?? '').replaceAll('%', '').toLowerCase();
    const nodes = entries()
      .filter((entry) => entry.name.toLowerCase().includes(text))
      .map((entry) => ({ id: entry.id, activePricing: { priceMinorUnits: 99900 }, name: entry.name, priceMinorUnits: 99900 }));
    return { data: { [listKey]: { nodes, totalCount: nodes.length } }, error: undefined, loading: false };
  };
}

vi.mock('@clensy/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@clensy/client')>()),
  useAddOnsQuery: (options: never) => catalogQuery(() => ADD_ONS, 'addOns')(options),
  useServicesQuery: (options: never) => catalogQuery(() => SERVICES, 'services')(options),
  usePriceLaundryOrderMutation: priceMutation,
}));

const { useLaundryServiceSelection } = await import('./use-laundry-service-selection');
const { LaundryServicesEditor } = await import('../components/laundry/laundry-services-editor');

function Harness({ weightGrams }: { weightGrams: number | null }) {
  const state = useLaundryServiceSelection({ enabled: true, orderId: ORDER, weightGrams });
  return (
    <div>
      <LaundryServicesEditor state={state} />
      <button type="button" id="elsewhere">
        Elsewhere
      </button>
    </div>
  );
}

let container: HTMLDivElement;
let root: Root;

function lineFor(entry: CatalogEntry, kind: 'addOn' | 'service', quantity: number | undefined) {
  return {
    addOnId: kind === 'addOn' ? entry.id : null,
    serviceId: kind === 'service' ? entry.id : null,
    amountMinorUnits: 1,
    description: entry.name,
    minimumChargeApplied: false,
    minimumChargeMinorUnits: null,
    quantity: entry.unit === 'PER_KG' ? WEIGHT : (quantity ?? 1),
    rateMinorUnits: preview.rate ?? entry.rate,
    unit: entry.unit,
  };
}

// Answers per input from the unit table; no amount is computed here.
function answer(input: PriceLaundryOrderInput) {
  const base = SERVICES.find((entry) => entry.id === input.baseServiceId)!;
  const lines = [lineFor(base, 'service', input.baseQuantity ?? undefined)];
  for (const sent of input.addOns) {
    lines.push(lineFor(ADD_ONS.find((entry) => entry.id === sent.addOnId)!, 'addOn', sent.quantity ?? undefined));
  }
  return { data: { previewLaundryOrderPrice: { estimatedTotalMinorUnits: 1, lines } } };
}

const calls = () => preview.calls as PreviewCall[];

function missingPrice(message: string) {
  return { graphQLErrors: [{ extensions: { originalError: { message } }, message: 'Bad Request Exception' }] };
}

beforeEach(() => {
  vi.useFakeTimers();
  preview.calls.length = 0;
  preview.failIf = null;
  preview.rate = null;
  priceMutation.mockReset();
  client.query.mockReset();
  client.query.mockImplementation((options: { query: unknown; variables: { input: PriceLaundryOrderInput } }) => {
    preview.calls.push({ input: options.variables.input, query: options.query });
    const failure = preview.failIf?.(options.variables.input);
    if (failure !== null && failure !== undefined) return Promise.reject(failure);
    return Promise.resolve(answer(options.variables.input));
  });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

// Case 18: the editor and its hook only preview, never price.
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  expect(priceMutation).not.toHaveBeenCalled();
  for (const recorded of calls()) expect(recorded.query).toBe(PreviewLaundryOrderPriceDocument);
});

function mount(weightGrams: number | null = WEIGHT) {
  act(() => root.render(<Harness weightGrams={weightGrams} />));
}

// Runs the debounce and the request, then lets the promise settle. Called
// repeatedly when a PER_ITEM unit has to be learned first.
async function settle(rounds = 1) {
  for (let round = 0; round < rounds; round += 1) {
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
  }
}

function el<T extends Element = HTMLElement>(selector: string): T {
  const found = container.querySelector<T>(selector);
  expect(found, selector).not.toBeNull();
  return found!;
}

const baseInput = () => el<HTMLInputElement>('#laundry-base-service');

function addOnInputs(): HTMLInputElement[] {
  return [...container.querySelectorAll<HTMLInputElement>('input')].filter((input) =>
    /^laundry-add-on-\d+$/.test(input.id),
  );
}

function button(name: string): HTMLButtonElement {
  const found = [...container.querySelectorAll('button')].find((candidate) => candidate.textContent === name);
  expect(found, `button "${name}"`).toBeDefined();
  return found!;
}

function hasButton(name: string): boolean {
  return [...container.querySelectorAll('button')].some((candidate) => candidate.textContent === name);
}

function labelTexts(): string[] {
  return [...container.querySelectorAll('label')].map((label) => label.textContent ?? '');
}

function text(): string {
  return container.textContent ?? '';
}

function paragraphs(match: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('p')].filter((p) => p.textContent === match);
}

function rates(): string[] {
  return [...container.querySelectorAll('p')]
    .map((p) => p.textContent ?? '')
    .filter((value) => /^₱\d+\.\d\d (per kg|per item|flat)$/.test(value));
}

function alerts(): string[] {
  return [...container.querySelectorAll('[role="alert"]')].map((alert) => alert.textContent ?? '');
}

function type(target: HTMLInputElement, value: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(target, value);
    target.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function focus(target: HTMLElement) {
  act(() => target.focus());
}

// Moves focus to another rendered control: jsdom fires blur and focusout on
// the control that had focus, as in the customer-picker interaction test.
function leave(target: HTMLElement) {
  focus(target);
  act(() => el<HTMLButtonElement>('#elsewhere').focus());
}

function press(target: HTMLElement, key: string) {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }));
  });
}

function click(name: string) {
  act(() => button(name).click());
}

// Browses the picker, then clicks the entry's option.
async function pick(target: HTMLInputElement, id: string) {
  focus(target);
  await settle();
  act(() => el(`#${target.id}-option-${id}`).click());
}

async function chooseBase(id: string) {
  await pick(baseInput(), id);
  await settle(3);
}

async function addRow(id?: string): Promise<HTMLInputElement> {
  click('Add add-on');
  const inputs = addOnInputs();
  const created = inputs[inputs.length - 1]!;
  if (id) {
    await pick(created, id);
    await settle(3);
  }
  return created;
}

function countInput(near: HTMLElement): HTMLInputElement | null {
  return near.closest('.flex-1')?.parentElement?.querySelector<HTMLInputElement>('input[inputmode="numeric"]') ?? null;
}

function rowOf(input: HTMLElement): HTMLElement {
  return input.closest<HTMLElement>('div.rounded-md')!;
}

describe('LaundryServicesEditor', () => {
  it('case 1: lays out with the base search, no form or submit, and the preview note', () => {
    mount();
    expect(container.firstElementChild!.firstElementChild!.className).toBe('flex flex-col gap-4');
    expect(labelTexts()).toContain('Base service');
    expect(el<HTMLLabelElement>('label[for="laundry-base-service"]').textContent).toBe('Base service');
    expect(container.querySelector('form')).toBeNull();
    expect(container.querySelector('button[type="submit"]')).toBeNull();
    expect(text()).toContain('This is a preview. The price is final only after you confirm it.');
  });

  it('case 2: browses the services on focus, and the add-ons in an add-on search', async () => {
    mount();
    focus(baseInput());
    await settle();
    expect(baseInput().getAttribute('aria-expanded')).toBe('true');
    const listbox = el('#laundry-base-service-listbox');
    expect(listbox.getAttribute('role')).toBe('listbox');
    expect([...listbox.querySelectorAll('[role="option"]')].map((o) => o.textContent)).toEqual([
      'Dry clean',
      'Duvet',
      'Shoes',
      'Wash',
    ]);
    const row = await addRow();
    await settle();
    expect(row.getAttribute('aria-expanded')).toBe('true');
    expect([...el(`#${row.id}-listbox`).querySelectorAll('[role="option"]')].map((o) => o.textContent)).toEqual([
      'Ironing',
      'Softener',
    ]);
  });

  it('case 3: PER_KG shows the weight and the per-kg rate, with no count input', async () => {
    mount();
    await chooseBase(WASH);
    expect(text()).toContain('Priced by weight');
    expect(text()).toContain('2.505 kg');
    expect(container.querySelector('input[inputmode="numeric"]')).toBeNull();
    expect(labelTexts()).not.toContain('Number of items');
    expect(rates()).toEqual(['₱50.00 per kg']);
  });

  it('case 4: PER_ITEM shows a numeric count input holding 1, and the per-item rate', async () => {
    mount();
    await chooseBase(SHOES);
    const count = el<HTMLInputElement>('#laundry-base-count');
    expect(count.value).toBe('1');
    expect(count.getAttribute('inputmode')).toBe('numeric');
    expect(el<HTMLLabelElement>('label[for="laundry-base-count"]').textContent).toBe('Number of items');
    expect(labelTexts().filter((label) => label.includes('kg'))).toEqual([]);
    expect(text()).not.toContain('Priced by weight');
    expect(rates()).toEqual(['₱25.00 per item']);
  });

  it.each([
    [DRY, '₱150.00 flat'],
    [DUVET, '₱200.00 flat'],
  ])('case 5: %s shows a flat price and its flat rate, with no count input', async (id, rate) => {
    mount();
    await chooseBase(id);
    expect(text()).toContain('Flat price');
    expect(rates()).toEqual([rate]);
    expect(container.querySelector('input[inputmode="numeric"]')).toBeNull();
  });

  it('case 6: each add-on row follows the same unit rule, with numbered labels and remove buttons', async () => {
    mount();
    await chooseBase(WASH);
    const first = await addRow(IRON);
    const second = await addRow(SOFT);
    expect(labelTexts()).toEqual(expect.arrayContaining(['Add-on 1', 'Add-on 2']));
    expect(el<HTMLLabelElement>(`label[for="${first.id}"]`).textContent).toBe('Add-on 1');
    expect(el<HTMLLabelElement>(`label[for="${second.id}"]`).textContent).toBe('Add-on 2');
    expect(hasButton('Remove add-on 1')).toBe(true);
    expect(hasButton('Remove add-on 2')).toBe(true);
    expect(countInput(first)?.value).toBe('1');
    expect(rowOf(first).textContent).toContain('Number of items');
    expect(countInput(second)).toBeNull();
    expect(rowOf(second).textContent).toContain('Flat price');
    expect(rowOf(second).textContent).not.toContain('Number of items');
  });

  describe('case 7: an invalid count', () => {
    it.each([['0'], [''], ['-1'], ['1.5']])('"%s" shows the error after blur and drops the rate', async (value) => {
      mount();
      await chooseBase(SHOES);
      expect(rates()).toEqual(['₱25.00 per item']);
      const count = el<HTMLInputElement>('#laundry-base-count');
      type(count, value);
      leave(count);
      expect(text()).toContain('Enter a whole number of items, at least 1.');
      expect(container.querySelector('#laundry-base-count')).not.toBeNull();
      expect(rates()).toEqual([]);
      await settle(2);
      expect(rates()).toEqual([]);
    });

    it('recovers: typing 2 clears the error at once, and one request shows that response', async () => {
      mount();
      await chooseBase(SHOES);
      const count = el<HTMLInputElement>('#laundry-base-count');
      type(count, '0');
      leave(count);
      expect(text()).toContain('Enter a whole number of items, at least 1.');
      const before = calls().length;
      preview.rate = 3700;
      type(count, '2');
      leave(count);
      expect(text()).not.toContain('Enter a whole number of items, at least 1.');
      expect(rates()).toEqual([]);
      await act(async () => {
        vi.advanceTimersByTime(299);
      });
      expect(calls().length).toBe(before);
      await act(async () => {
        vi.advanceTimersByTime(1);
      });
      expect(calls().length).toBe(before + 1);
      expect(calls()[before]!.input.baseQuantity).toBe(2);
      expect(rates()).toEqual(['₱37.00 per item']);
    });
  });

  it('case 8: after a failed preview of a PER_ITEM base, the count input stays and the rate is gone', async () => {
    mount();
    await chooseBase(SHOES);
    expect(rates()).toEqual(['₱25.00 per item']);
    preview.failIf = () => new Error('network down');
    type(el<HTMLInputElement>('#laundry-base-count'), '3');
    await settle();
    expect(alerts()).toEqual(['Couldn’t preview the price.']);
    expect(container.querySelector('#laundry-base-count')).not.toBeNull();
    expect(el<HTMLInputElement>('#laundry-base-count').value).toBe('3');
    expect(rates()).toEqual([]);
  });

  it('case 9: a duplicate add-on is flagged on its row, keeps its text and is never sent twice', async () => {
    mount();
    await chooseBase(WASH);
    await addRow(IRON);
    const second = await addRow();
    type(second, 'Iron');
    await settle();
    act(() => el(`#${second.id}-option-${IRON}`).click());
    await settle(3);
    expect(rowOf(second).textContent).toContain('This add-on is already on the order.');
    expect(paragraphs('This add-on is already on the order.')).toHaveLength(1);
    expect(second.value).toBe('Iron');
    for (const recorded of calls()) {
      expect(recorded.input.addOns.filter((sent) => sent.addOnId === IRON).length).toBeLessThanOrEqual(1);
    }
  });

  describe('case 10: empty base and empty row, through the real picker', () => {
    it('base: the error follows blur, the choice and the dropped choice', async () => {
      mount();
      focus(baseInput());
      await settle();
      expect(text()).not.toContain('Choose a base service.');
      expect(baseInput().getAttribute('aria-invalid')).toBeNull();
      leave(baseInput());
      expect(text()).toContain('Choose a base service.');
      expect(baseInput().getAttribute('aria-invalid')).toBe('true');
      const describedBy = baseInput().getAttribute('aria-describedby')!;
      expect(describedBy).toBe('laundry-base-service-error');
      expect(el(`#${describedBy}`).textContent).toBe('Choose a base service.');

      focus(baseInput());
      type(baseInput(), 'Wash');
      await settle();
      press(baseInput(), 'ArrowDown');
      press(baseInput(), 'Enter');
      expect(text()).not.toContain('Choose a base service.');
      expect(baseInput().value).toBe('Wash');
      expect(baseInput().getAttribute('aria-invalid')).toBeNull();

      type(baseInput(), 'Wash!');
      leave(baseInput());
      expect(text()).toContain('Choose a base service.');
      expect(baseInput().getAttribute('aria-invalid')).toBe('true');
    });

    it('add-on row: the error is on that row only, goes on a pick, and goes with the row', async () => {
      mount();
      await chooseBase(WASH);
      const chosen = await addRow(IRON);
      const empty = await addRow();
      expect(paragraphs('Choose an add-on or remove this row.')).toHaveLength(0);
      leave(empty);
      expect(paragraphs('Choose an add-on or remove this row.')).toHaveLength(1);
      expect(rowOf(empty).textContent).toContain('Choose an add-on or remove this row.');
      expect(rowOf(chosen).textContent).not.toContain('Choose an add-on or remove this row.');
      expect(empty.getAttribute('aria-invalid')).toBe('true');
      expect(empty.getAttribute('aria-describedby')).toBe(`${empty.id}-error`);

      await pick(empty, SOFT);
      expect(text()).not.toContain('Choose an add-on or remove this row.');

      const third = await addRow();
      leave(third);
      expect(paragraphs('Choose an add-on or remove this row.')).toHaveLength(1);
      click('Remove add-on 3');
      expect(text()).not.toContain('Choose an add-on or remove this row.');
    });
  });

  describe('case 11: a missing price, matched', () => {
    it('shows the choice name once in the alert and marks only that row', async () => {
      mount();
      await chooseBase(WASH);
      await addRow(IRON);
      preview.failIf = () => missingPrice(`No effective price for addOnId ${SOFT}`);
      const soft = await addRow(SOFT);
      expect(alerts()).toEqual(['Softener has no current price.']);
      const markers = paragraphs('No current price.');
      expect(markers).toHaveLength(1);
      expect(rowOf(soft).contains(markers[0]!)).toBe(true);
      expect(text()).not.toContain('No effective price for addOnId');
    });

    it('the add-on marker follows the current choice: editing the row clears it and the alert at once', async () => {
      mount();
      await chooseBase(WASH);
      preview.failIf = () => missingPrice(`No effective price for addOnId ${SOFT}`);
      const soft = await addRow(SOFT);
      await addRow();
      expect(alerts()).toEqual(['Softener has no current price.']);
      expect(paragraphs('No current price.')).toHaveLength(1);
      expect(soft.value).toBe('Softener');

      preview.failIf = null;
      const before = calls().length;
      type(soft, 'Iron');
      expect(calls().length).toBe(before);
      expect(alerts()).toEqual([]);
      expect(paragraphs('No current price.')).toHaveLength(0);
      await settle();
      act(() => el(`#${soft.id}-option-${IRON}`).click());
      expect(alerts()).toEqual([]);
      expect(paragraphs('No current price.')).toHaveLength(0);
      await settle(3);
      expect(alerts()).toEqual([]);
      expect(rates()).toEqual(['₱50.00 per kg', '₱25.00 per item']);
    });

    it('the base marker follows the current choice: switching Wash to Dry clean clears it at once', async () => {
      mount();
      preview.failIf = () => missingPrice(`No effective price for serviceId ${WASH}`);
      await chooseBase(WASH);
      expect(alerts()).toEqual(['Wash has no current price.']);
      const markers = paragraphs('No current price.');
      expect(markers).toHaveLength(1);
      expect(baseInput().getAttribute('aria-describedby')).toBe('laundry-base-service-error');
      expect(el('#laundry-base-service-error').textContent).toBe('No current price.');

      preview.failIf = null;
      const before = calls().length;
      type(baseInput(), 'Dry');
      expect(calls().length).toBe(before);
      expect(alerts()).toEqual([]);
      expect(paragraphs('No current price.')).toHaveLength(0);
      await settle();
      act(() => el(`#laundry-base-service-option-${DRY}`).click());
      expect(alerts()).toEqual([]);
      expect(paragraphs('No current price.')).toHaveLength(0);
      await settle(2);
      expect(alerts()).toEqual([]);
      expect(rates()).toEqual(['₱150.00 flat']);
    });
  });

  it('case 12: an unknown message is shown once, in the alert, with no row marker', async () => {
    mount();
    await chooseBase(WASH);
    preview.failIf = () => missingPrice('Something the server said');
    await addRow(IRON);
    expect(alerts()).toEqual(['Something the server said']);
    expect(text().split('Something the server said')).toHaveLength(2);
    expect(paragraphs('No current price.')).toHaveLength(0);
  });

  it('case 13: any other failure without a message shows the generic copy', async () => {
    mount();
    preview.failIf = () => new Error('boom');
    await chooseBase(WASH);
    expect(alerts()).toEqual(['Couldn’t preview the price.']);
    expect(paragraphs('No current price.')).toHaveLength(0);
  });

  it('case 14: removing the matched row clears the alert and the marker at once', async () => {
    mount();
    await chooseBase(WASH);
    preview.failIf = () => missingPrice(`No effective price for addOnId ${SOFT}`);
    await addRow(SOFT);
    expect(alerts()).toEqual(['Softener has no current price.']);
    expect(paragraphs('No current price.')).toHaveLength(1);
    const before = calls().length;
    click('Remove add-on 1');
    expect(calls().length).toBe(before);
    expect(alerts()).toEqual([]);
    expect(paragraphs('No current price.')).toHaveLength(0);
  });

  describe('case 15: focus, asserted against the rendered rows', () => {
    it('add: renders the second search first, then focuses it', async () => {
      mount();
      await addRow();
      click('Add add-on');
      const inputs = addOnInputs();
      expect(inputs).toHaveLength(2);
      expect(el<HTMLLabelElement>(`label[for="${inputs[1]!.id}"]`).textContent).toBe('Add-on 2');
      expect(document.activeElement).toBe(el(`#${inputs[1]!.id}`));
    });

    it('remove: renders the remaining row first, then focuses Add add-on', async () => {
      mount();
      await chooseBase(WASH);
      await addRow(IRON);
      await addRow(SOFT);
      click('Remove add-on 1');
      const inputs = addOnInputs();
      expect(inputs).toHaveLength(1);
      expect(el<HTMLLabelElement>(`label[for="${inputs[0]!.id}"]`).textContent).toBe('Add-on 1');
      expect(inputs[0]!.value).toBe('Softener');
      expect(hasButton('Remove add-on 2')).toBe(false);
      expect(document.activeElement).toBe(button('Add add-on'));
    });

    it('remove the last row: no add-on search remains, and focus is on Add add-on', async () => {
      mount();
      await addRow();
      click('Remove add-on 1');
      expect(addOnInputs()).toHaveLength(0);
      expect(document.activeElement).toBe(button('Add add-on'));
    });
  });

  it('case 16: removing the middle row keeps the next row text and count, relabelled', async () => {
    mount();
    await chooseBase(WASH);
    await addRow(SOFT);
    const middle = await addRow();
    type(middle, 'Zzz');
    const last = await addRow(IRON);
    type(countInput(last)!, '4');
    await settle(2);
    click('Remove add-on 2');
    const inputs = addOnInputs();
    expect(inputs.map((input) => input.value)).toEqual(['Softener', 'Ironing']);
    expect(el<HTMLLabelElement>(`label[for="${inputs[1]!.id}"]`).textContent).toBe('Add-on 2');
    expect(countInput(inputs[1]!)?.value).toBe('4');
  });

  it('case 17: every rate is the preview rate, never the catalog list price', async () => {
    mount();
    await chooseBase(WASH);
    await addRow(IRON);
    expect(rates()).toEqual(['₱50.00 per kg', '₱25.00 per item']);
    expect(text().match(/₱/g)).toHaveLength(2);
    expect(text()).not.toContain('₱999.00');
  });

  it('case 18: the first preview request uses only the preview query', async () => {
    mount();
    await chooseBase(SHOES);
    expect(calls().length).toBeGreaterThan(0);
    expect(priceMutation).not.toHaveBeenCalled();
  });
});
