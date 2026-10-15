// @vitest-environment jsdom
import { PreviewLaundryOrderPriceDocument, type PreviewLaundryOrderPriceQuery, type PriceLaundryOrderInput, type PricingUnit } from '@clensy/client';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Payload = PreviewLaundryOrderPriceQuery['previewLaundryOrderPrice'];
type Line = Payload['lines'][number];

interface QueryCall {
  options: { fetchPolicy?: string; query: typeof PreviewLaundryOrderPriceDocument; variables: { input: PriceLaundryOrderInput } };
  reject: (error: unknown) => void;
  resolve: (result: unknown) => void;
}

// One stable client object: a fresh one per render would re-run the hook's
// effect on every render.
const preview = vi.hoisted(() => {
  const calls: unknown[] = [];
  const query = vi.fn();
  return { calls, client: { query }, query };
});
const priceMutation = vi.hoisted(() => vi.fn());
// Counts `laundryUnitKey` calls (the real function still runs). The hook calls
// it only to remember units from a response; after unmount no render happens,
// so a call then can only come from the response handler.
const unitKeySpy = vi.hoisted(() => vi.fn());
vi.mock('./laundry-service-selection', async (importOriginal) => {
  const original = await importOriginal<typeof import('./laundry-service-selection')>();
  unitKeySpy.mockImplementation(original.laundryUnitKey);
  return { ...original, laundryUnitKey: unitKeySpy };
});

vi.mock('@apollo/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@apollo/client')>()),
  useApolloClient: () => preview.client,
}));
vi.mock('@clensy/client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@clensy/client')>()),
  usePriceLaundryOrderMutation: priceMutation,
}));

const { useLaundryServiceSelection } = await import('./use-laundry-service-selection');
type Hook = ReturnType<typeof useLaundryServiceSelection>;

const ORDER = '00000000-0000-4000-8000-000000000001';
const BASE = '11111111-1111-4111-8111-111111111111';
const OTHER_BASE = '22222222-2222-4222-8222-222222222222';
const A1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const A2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
const A3 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3';
const BASE_CHOICE = { id: BASE, name: 'Wash and fold' };
const OTHER_BASE_CHOICE = { id: OTHER_BASE, name: 'Dry clean' };
const ADD_ON_1 = { id: A1, name: 'Ironing' };
const ADD_ON_2 = { id: A2, name: 'Starch' };
const ADD_ON_3 = { id: A3, name: 'Folding' };

interface Props {
  enabled: boolean;
  orderId: string;
  weightGrams: number | null;
}
const DEFAULT_PROPS: Props = { enabled: true, orderId: ORDER, weightGrams: 2505 };

let container: HTMLDivElement;
let root: Root | null;
let latest: Hook;
let props: Props;

function Probe(current: Props) {
  latest = useLaundryServiceSelection(current);
  return null;
}

function render(change: Partial<Props> = {}) {
  props = { ...props, ...change };
  act(() => root?.render(<Probe {...props} />));
}

function unmount() {
  act(() => root?.unmount());
  root = null;
}

function wait(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

function edit(change: () => void) {
  act(change);
}

function call(index: number): QueryCall {
  return preview.calls[index] as QueryCall;
}

function input(index: number): PriceLaundryOrderInput {
  return call(index).options.variables.input;
}

const sent = () => preview.calls.length;

function line(overrides: Partial<Line>): Line {
  return {
    addOnId: null,
    serviceId: null,
    amountMinorUnits: 100,
    description: 'Line',
    minimumChargeApplied: false,
    minimumChargeMinorUnits: null,
    quantity: 1,
    rateMinorUnits: 100,
    unit: 'PER_KG',
    ...overrides,
  };
}
const baseLine = (unit: PricingUnit = 'PER_KG', id = BASE) => line({ serviceId: id, unit });
const addOnLine = (id: string, unit: PricingUnit = 'FLAT') => line({ addOnId: id, unit });
const payload = (lines: Line[], total = 1000): Payload => ({ estimatedTotalMinorUnits: total, lines });

async function resolveCall(index: number, value: Payload) {
  await act(async () => {
    call(index).resolve({ data: { previewLaundryOrderPrice: value } });
  });
}

async function rejectCall(index: number, error: unknown) {
  await act(async () => {
    call(index).reject(error);
  });
}

function missingPrice(message: string) {
  return { graphQLErrors: [{ extensions: { originalError: { message } }, message: 'Bad Request Exception' }] };
}

function chooseBase(choice = BASE_CHOICE) {
  edit(() => latest.chooseBase(choice));
}

function addRow(choice?: { id: string; name: string }): number {
  let key = -1;
  edit(() => {
    key = latest.addAddOn();
  });
  if (choice) edit(() => latest.chooseAddOn(key, choice));
  return key;
}

// Base chosen and previewed as PER_ITEM; request 2 (with the count) resolved.
async function learnBasePerItem() {
  chooseBase();
  wait(300);
  await resolveCall(0, payload([baseLine('PER_ITEM')]));
  wait(300);
  await resolveCall(1, payload([baseLine('PER_ITEM')]));
}

beforeEach(() => {
  vi.useFakeTimers();
  preview.calls.length = 0;
  preview.query.mockReset();
  preview.query.mockImplementation(
    (options: QueryCall['options']) =>
      new Promise((resolve, reject) => {
        preview.calls.push({ options, reject, resolve });
      }),
  );
  priceMutation.mockReset();
  unitKeySpy.mockClear();
  props = DEFAULT_PROPS;
  container = document.createElement('div');
  root = createRoot(container);
});

// Case 18: the hook only previews, never prices, on every path.
afterEach(() => {
  if (root) unmount();
  vi.useRealTimers();
  expect(priceMutation).not.toHaveBeenCalled();
  for (const recorded of preview.calls as QueryCall[]) {
    expect(recorded.options.query).toBe(PreviewLaundryOrderPriceDocument);
    const operation = recorded.options.query.definitions.find((definition) => 'operation' in definition) as
      | { name?: { value: string }; operation: string }
      | undefined;
    expect(operation?.name?.value).toBe('PreviewLaundryOrderPrice');
    expect(operation?.operation).toBe('query');
    expect(recorded.options.fetchPolicy).toBe('network-only');
  }
});

describe('useLaundryServiceSelection', () => {
  it('case 1: sends nothing when not enabled, or without a weight', () => {
    render({ enabled: false });
    chooseBase();
    wait(1000);
    expect(sent()).toBe(0);
    expect(latest.previewLoading).toBe(false);
    render({ enabled: true, weightGrams: null });
    wait(1000);
    expect(sent()).toBe(0);
    expect(latest.previewLoading).toBe(false);
    expect(latest.ready).toBe(false);
  });

  it('case 2: sends nothing without a base service', () => {
    render();
    addRow(ADD_ON_1);
    wait(1000);
    expect(sent()).toBe(0);
    expect(latest.ready).toBe(false);
    expect(latest.previewLoading).toBe(false);
  });

  it('case 3: debounces the request by 300 ms and is loading until the response', async () => {
    render();
    chooseBase();
    expect(latest.previewLoading).toBe(true);
    wait(299);
    expect(sent()).toBe(0);
    expect(latest.previewLoading).toBe(true);
    wait(1);
    expect(sent()).toBe(1);
    expect(input(0)).toEqual({ addOns: [], baseServiceId: BASE, orderId: ORDER });
    expect('baseQuantity' in input(0)).toBe(false);
    expect(latest.previewLoading).toBe(true);
    await resolveCall(0, payload([baseLine()]));
    expect(latest.previewLoading).toBe(false);
  });

  it('case 4: a PER_KG response is ready and priceInput is the request input', async () => {
    render();
    chooseBase();
    wait(300);
    await resolveCall(0, payload([baseLine('PER_KG')]));
    expect(latest.preview?.base.unit).toBe('PER_KG');
    expect(latest.ready).toBe(true);
    expect(latest.priceInput).toEqual(input(0));
  });

  it('case 5: learning PER_ITEM takes a second request carrying the count', async () => {
    render();
    chooseBase();
    wait(300);
    expect(sent()).toBe(1);
    expect('baseQuantity' in input(0)).toBe(false);

    await resolveCall(0, payload([baseLine('PER_ITEM')]));
    expect(latest.units[`service:${BASE}`]).toBe('PER_ITEM');
    expect(latest.preview).toBeNull();
    expect(latest.priceInput).toBeNull();
    expect(latest.previewError).toBeNull();
    expect(latest.ready).toBe(false);
    expect(latest.previewLoading).toBe(true);

    wait(299);
    expect(sent()).toBe(1);
    wait(1);
    expect(sent()).toBe(2);
    expect(input(1).baseQuantity).toBe(1);
    expect(latest.preview).toBeNull();
    expect(latest.priceInput).toBeNull();
    expect(latest.previewError).toBeNull();
    expect(latest.ready).toBe(false);
    expect(latest.previewLoading).toBe(true);

    await resolveCall(1, payload([baseLine('PER_ITEM')]));
    expect(latest.ready).toBe(true);
    expect(latest.priceInput?.baseQuantity).toBe(1);

    edit(() => latest.changeBaseQuantity('3'));
    expect(latest.ready).toBe(false);
    wait(300);
    expect(sent()).toBe(3);
    expect(input(2).baseQuantity).toBe(3);
  });

  it('case 6: an invalid count sends nothing, keeps the unit and re-requests when fixed', async () => {
    render();
    await learnBasePerItem();
    edit(() => latest.changeBaseQuantity('0'));
    wait(1000);
    expect(sent()).toBe(2);
    expect(latest.preview).toBeNull();
    expect(latest.priceInput).toBeNull();
    expect(latest.ready).toBe(false);
    expect(latest.units[`service:${BASE}`]).toBe('PER_ITEM');
    edit(() => latest.changeBaseQuantity('3'));
    wait(300);
    expect(sent()).toBe(3);
    expect(input(2).baseQuantity).toBe(3);
  });

  it('case 7: a failure after PER_ITEM clears the preview and keeps the unit', async () => {
    render();
    await learnBasePerItem();
    edit(() => latest.changeBaseQuantity('2'));
    wait(300);
    await rejectCall(2, new Error('down'));
    expect(latest.preview).toBeNull();
    expect(latest.ready).toBe(false);
    expect(latest.previewError).not.toBeNull();
    expect(latest.units[`service:${BASE}`]).toBe('PER_ITEM');
  });

  it('case 8: remembered units are keyed by kind and id', async () => {
    render();
    await learnBasePerItem();
    addRow({ id: BASE, name: 'Same id add-on' });
    wait(300);
    expect(sent()).toBe(3);
    expect(input(2).addOns).toEqual([{ addOnId: BASE }]);
    expect(input(2).baseQuantity).toBe(1);

    chooseBase(OTHER_BASE_CHOICE);
    wait(300);
    expect(sent()).toBe(4);
    expect(input(3).baseServiceId).toBe(OTHER_BASE);
    expect('baseQuantity' in input(3)).toBe(false);
  });

  it('case 9: add-on rows have distinct keys, and an unchosen row blocks ready', async () => {
    render();
    chooseBase();
    const first = addRow();
    const second = addRow();
    edit(() => latest.removeAddOn(second));
    const third = addRow();
    expect(new Set([first, second, third]).size).toBe(3);
    edit(() => latest.removeAddOn(third));

    wait(300);
    expect(input(0).addOns).toEqual([]);
    await resolveCall(0, payload([baseLine()]));
    expect(latest.preview).not.toBeNull();
    expect(latest.ready).toBe(false);

    // Both rows exist first; the later row is chosen first, so row order,
    // not choice order, must decide the sent order.
    const row2 = addRow();
    edit(() => latest.chooseAddOn(row2, ADD_ON_2));
    edit(() => latest.chooseAddOn(first, ADD_ON_1));
    wait(300);
    expect(input(1).addOns).toEqual([{ addOnId: A1 }, { addOnId: A2 }]);
    await resolveCall(1, payload([baseLine(), addOnLine(A1), addOnLine(A2)]));
    expect(latest.ready).toBe(true);
    expect(latest.preview?.addOns.get(first)?.addOnId).toBe(A1);
    expect(latest.preview?.addOns.get(row2)?.addOnId).toBe(A2);
  });

  it('case 10: removing a row leaves the other rows untouched', () => {
    render();
    const a = addRow(ADD_ON_1);
    const b = addRow(ADD_ON_2);
    const c = addRow(ADD_ON_3);
    edit(() => latest.changeAddOnQuantity(a, '4'));
    edit(() => latest.changeAddOnQuantity(c, '7'));
    const before = latest.selection.addOns;
    edit(() => latest.removeAddOn(b));
    expect(latest.selection.addOns).toEqual([before[0], before[2]]);
    expect(latest.selection.addOns.map((row) => row.key)).toEqual([a, c]);
    expect(latest.selection.addOns[1]).toMatchObject({ choice: ADD_ON_3, query: 'Folding', quantity: '7' });
  });

  it('case 11: a duplicate add-on is not applied and says so until the next edit, naming the add-on attempted', () => {
    render();
    addRow(ADD_ON_1);
    const second = addRow();
    edit(() => latest.changeAddOnQuery(second, 'iron'));
    edit(() => latest.chooseAddOn(second, ADD_ON_1));
    const row = latest.selection.addOns.find((candidate) => candidate.key === second);
    expect(row?.choice).toBeNull();
    expect(row?.query).toBe('iron');
    expect(row?.duplicateOf).toBe(A1);
    edit(() => latest.changeAddOnQuery(second, 'ironi'));
    expect(latest.selection.addOns.find((candidate) => candidate.key === second)?.duplicateOf).toBeNull();
  });

  it('case 12: editing the search text drops the choice', () => {
    render();
    chooseBase();
    const key = addRow(ADD_ON_1);
    edit(() => latest.changeBaseQuery('wash'));
    expect(latest.selection.base).toBeNull();
    expect(latest.selection.baseQuery).toBe('wash');
    edit(() => latest.changeAddOnQuery(key, 'iro'));
    expect(latest.selection.addOns[0]?.choice).toBeNull();
    expect(latest.selection.addOns[0]?.query).toBe('iro');
  });

  it('case 13: a re-weigh makes the old preview not current and requests again', async () => {
    render();
    chooseBase();
    wait(300);
    await resolveCall(0, payload([baseLine()]));
    expect(latest.ready).toBe(true);
    render({ weightGrams: 3000 });
    expect(latest.previewLoading).toBe(true);
    expect(latest.preview).toBeNull();
    expect(latest.ready).toBe(false);
    wait(300);
    expect(sent()).toBe(2);
  });

  describe('case 14: stale responses', () => {
    it('an older response arriving after a newer one changes nothing', async () => {
      render();
      chooseBase();
      wait(300);
      addRow(ADD_ON_1);
      wait(300);
      expect(sent()).toBe(2);
      await resolveCall(1, payload([baseLine('PER_KG'), addOnLine(A1)], 2222));
      await resolveCall(0, payload([baseLine('PER_ITEM')], 1111));
      expect(latest.preview?.estimatedTotalMinorUnits).toBe(2222);
      expect(latest.priceInput).toEqual(input(1));
      expect(latest.units).toEqual({ [`addOn:${A1}`]: 'FLAT', [`service:${BASE}`]: 'PER_KG' });
      wait(1000);
      expect(sent()).toBe(2);
    });

    it('a late success never replaces a current failure', async () => {
      render();
      chooseBase();
      wait(300);
      addRow(ADD_ON_1);
      wait(300);
      await rejectCall(1, new Error('B failed'));
      expect(latest.previewError).toEqual({ message: undefined, target: null });
      await resolveCall(0, payload([baseLine('PER_KG')]));
      expect(latest.previewError).toEqual({ message: undefined, target: null });
      expect(latest.preview).toBeNull();
      expect(latest.ready).toBe(false);
    });

    it('a late success does not replace a current failure that has a message', async () => {
      render();
      chooseBase();
      wait(300);
      addRow(ADD_ON_1);
      wait(300);
      await rejectCall(1, missingPrice('Server said no'));
      await resolveCall(0, payload([baseLine('PER_KG')]));
      expect(latest.previewError?.message).toBe('Server said no');
      expect(latest.preview).toBeNull();
    });

    it('a superseded failure never shows', async () => {
      render();
      chooseBase();
      wait(300);
      addRow(ADD_ON_1);
      await rejectCall(0, missingPrice(`No effective price for serviceId ${BASE}`));
      expect(latest.previewError).toBeNull();
      expect(latest.previewLoading).toBe(true);
      wait(300);
      expect(latest.previewError).toBeNull();
    });

    it('a response after unmount sets no state and remembers no units', async () => {
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      render();
      chooseBase();
      wait(300);
      unmount();
      const callsBefore = unitKeySpy.mock.calls.length;
      // A PER_KG line that `rememberUnits` would remember if the handler ran.
      await resolveCall(0, payload([baseLine('PER_KG')]));
      expect(unitKeySpy.mock.calls.length).toBe(callsBefore);
      expect(errors).not.toHaveBeenCalled();
      errors.mockRestore();
    });

    it('a returning input is requested again', () => {
      render();
      chooseBase();
      wait(300);
      const row = addRow(ADD_ON_1);
      wait(300);
      edit(() => latest.removeAddOn(row));
      wait(300);
      expect(sent()).toBe(3);
      expect(input(2)).toEqual(input(0));
    });
  });

  describe('case 15: lines that do not correspond to the input', () => {
    const cases: [string, () => Line[]][] = [
      ['an add-on out of order', () => [baseLine(), addOnLine(A2, 'PER_ITEM'), addOnLine(A1, 'PER_ITEM')]],
      ['an extra line', () => [baseLine(), addOnLine(A1, 'PER_ITEM'), addOnLine(A2, 'PER_ITEM'), addOnLine(A3, 'PER_ITEM')]],
      ['a base line naming another service', () => [baseLine('PER_KG', OTHER_BASE), addOnLine(A1, 'PER_ITEM'), addOnLine(A2, 'PER_ITEM')]],
    ];
    it.each(cases)('rejects %s and remembers none of it', async (_name, makeLines) => {
      render();
      chooseBase();
      addRow(ADD_ON_1);
      addRow(ADD_ON_2);
      wait(300);
      expect(input(0).addOns).toEqual([{ addOnId: A1 }, { addOnId: A2 }]);
      const unitsBefore = latest.units;
      await resolveCall(0, payload(makeLines()));
      expect(latest.preview).toBeNull();
      expect(latest.previewError).toStrictEqual({ message: undefined, target: null });
      expect(latest.ready).toBe(false);
      expect(latest.units).toEqual(unitsBefore);
      expect(latest.units).toEqual({});
      wait(1000);
      expect(sent()).toBe(1);

      // Ready only from a corresponding, current response: re-weigh to ask
      // for the current input again (planning decision f).
      render({ weightGrams: 3000 });
      expect(latest.ready).toBe(false);
      wait(300);
      expect(sent()).toBe(2);
      expect(latest.ready).toBe(false);
      expect(latest.previewLoading).toBe(true);
      await resolveCall(1, payload([baseLine(), addOnLine(A1), addOnLine(A2)]));
      expect(latest.ready).toBe(true);
      expect(latest.preview?.addOns.size).toBe(2);
    });
  });

  describe('case 16: missing price', () => {
    async function failWith(error: unknown) {
      render();
      chooseBase();
      const key = addRow(ADD_ON_1);
      wait(300);
      await rejectCall(0, error);
      return key;
    }

    it('names the add-on row', async () => {
      const key = await failWith(missingPrice(`No effective price for addOnId ${A1}`));
      expect(latest.previewError?.target).toEqual({ key, kind: 'addOn' });
    });

    it('names the base service', async () => {
      await failWith(missingPrice(`No effective price for serviceId ${BASE}`));
      expect(latest.previewError?.target).toEqual({ kind: 'service' });
    });

    it('keeps an unknown message raw with no target', async () => {
      await failWith(missingPrice('Something else broke'));
      expect(latest.previewError).toEqual({ message: 'Something else broke', target: null });
    });

    it('has no message for a network error', async () => {
      await failWith(new Error('Failed to fetch'));
      expect(latest.previewError).toStrictEqual({ message: undefined, target: null });
    });
  });

  describe('case 17: resolved errors', () => {
    async function resolveWith(result: unknown) {
      render();
      chooseBase();
      wait(300);
      await act(async () => {
        call(0).resolve(result);
      });
    }

    it('treats a result with errors as a failure', async () => {
      await resolveWith({
        data: { previewLaundryOrderPrice: payload([baseLine()]) },
        errors: [{ extensions: { originalError: { message: 'Boom' } }, message: 'x' }],
      });
      expect(latest.preview).toBeNull();
      expect(latest.previewError?.message).toBe('Boom');
      expect(latest.ready).toBe(false);
    });

    it('treats a result without the payload as a failure', async () => {
      await resolveWith({ data: {} });
      expect(latest.preview).toBeNull();
      expect(latest.previewError).toStrictEqual({ message: undefined, target: null });
      expect(latest.ready).toBe(false);
    });

    it('treats null data as a failure', async () => {
      await resolveWith({ data: null });
      expect(latest.preview).toBeNull();
      expect(latest.previewError).not.toBeNull();
    });
  });

  describe('case 19: only the exact current input is shown', () => {
    it('an outdated base count', async () => {
      render();
      await learnBasePerItem();
      edit(() => latest.changeBaseQuantity('3'));
      wait(300);
      expect(input(2).baseQuantity).toBe(3);
      edit(() => latest.changeBaseQuantity('4'));
      await resolveCall(2, payload([baseLine('FLAT')]));
      expect(latest.preview).toBeNull();
      expect(latest.ready).toBe(false);
      expect(latest.previewLoading).toBe(true);
      expect(latest.units[`service:${BASE}`]).toBe('PER_ITEM');
      wait(300);
      expect(sent()).toBe(4);
      expect(input(3).baseQuantity).toBe(4);
      expect(latest.ready).toBe(false);
      await resolveCall(3, payload([baseLine('PER_ITEM')]));
      expect(latest.ready).toBe(true);
      expect(latest.priceInput?.baseQuantity).toBe(4);
      wait(1000);
      expect(sent()).toBe(4);
    });

    it('an outdated add-on count', async () => {
      render();
      chooseBase();
      const key = addRow(ADD_ON_1);
      wait(300);
      await resolveCall(0, payload([baseLine(), addOnLine(A1, 'PER_ITEM')]));
      wait(300);
      expect(input(1).addOns).toEqual([{ addOnId: A1, quantity: 1 }]);
      await resolveCall(1, payload([baseLine(), addOnLine(A1, 'PER_ITEM')]));
      expect(latest.ready).toBe(true);

      edit(() => latest.changeAddOnQuantity(key, '3'));
      wait(300);
      expect(input(2).addOns).toEqual([{ addOnId: A1, quantity: 3 }]);
      edit(() => latest.changeAddOnQuantity(key, '4'));
      await resolveCall(2, payload([baseLine(), addOnLine(A1, 'FLAT')]));
      expect(latest.preview).toBeNull();
      expect(latest.ready).toBe(false);
      expect(latest.previewLoading).toBe(true);
      expect(latest.units[`addOn:${A1}`]).toBe('PER_ITEM');
      wait(300);
      expect(sent()).toBe(4);
      expect(input(3).addOns).toEqual([{ addOnId: A1, quantity: 4 }]);
      expect(latest.ready).toBe(false);
      await resolveCall(3, payload([baseLine(), addOnLine(A1, 'PER_ITEM')]));
      expect(latest.ready).toBe(true);
      expect(latest.priceInput?.addOns[0]?.quantity).toBe(4);
      wait(1000);
      expect(sent()).toBe(4);
    });

    it('an outdated weight', async () => {
      render({ weightGrams: 2505 });
      chooseBase();
      wait(300);
      render({ weightGrams: 3000 });
      await resolveCall(0, payload([baseLine('PER_ITEM')]));
      expect(latest.preview).toBeNull();
      expect(latest.ready).toBe(false);
      expect(latest.previewLoading).toBe(true);
      expect(latest.units).toEqual({});
      wait(300);
      expect(sent()).toBe(2);
      expect(latest.preview).toBeNull();
      expect(latest.ready).toBe(false);
      await resolveCall(1, payload([baseLine('PER_KG')]));
      expect(latest.ready).toBe(true);
      wait(1000);
      expect(sent()).toBe(2);
    });
  });
});
