// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Drives the real hooks with mocked `useServicesQuery` / `useAddOnsQuery` that
// answer per variables, as Apollo's cache does: a name pattern with a stored
// response returns it; any other is still in flight (`loading: true`, no
// data). `lingering` returns the nodes while still `loading: true`, stricter
// than real Apollo; the hook must not offer them either way.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Node = { id: string; name: string };
type Response = { error?: Error; lingering?: boolean; nodes?: Node[]; totalCount?: number };
type Call = { skip?: boolean; variables: { filter: { active?: unknown; name?: { iLike?: string } } } };

const search = vi.hoisted(() => ({
  calls: [] as unknown[],
  responses: new Map<string, unknown>(),
}));

function answer(field: 'addOns' | 'services', options: Call) {
  search.calls.push(options);
  if (options.skip) return { data: undefined, error: undefined, loading: false };
  const response = search.responses.get(options.variables.filter.name?.iLike ?? '') as Response | undefined;
  if (!response) return { data: undefined, error: undefined, loading: true };
  if (response.error) return { data: undefined, error: response.error, loading: false };
  const nodes = (response.nodes ?? []).map((node) => ({ ...node, extra: 'x' }));
  return {
    data: { [field]: { nodes, totalCount: response.totalCount ?? nodes.length } },
    error: undefined,
    loading: response.lingering === true,
  };
}

vi.mock('@clensy/client', () => ({
  useAddOnsQuery: (options: Call) => answer('addOns', options),
  useServicesQuery: (options: Call) => answer('services', options),
}));

const { useLaundryAddOnSearch, useLaundryServiceSearch } = await import('./use-laundry-catalog-search');
type Search = ReturnType<typeof useLaundryServiceSearch>;
type Kind = 'addOns' | 'services';

const WA = { id: 'a1', name: 'Wa' };
const WASH = { id: 'a2', name: 'Wash' };
const W = { id: 'a3', name: 'Wool' };

let container: HTMLDivElement;
let root: Root;
let latest: Search;
let renders: Search[];

function Probe({ active, kind, query }: { active: boolean; kind: Kind; query: string }) {
  latest = (kind === 'services' ? useLaundryServiceSearch : useLaundryAddOnSearch)(query, active);
  renders.push(latest);
  return null;
}

function render(kind: Kind, query: string, active = true) {
  act(() => root.render(<Probe active={active} kind={kind} query={query} />));
}

function wait(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

function requests(): Call['variables'][] {
  return (search.calls as Call[]).filter((call) => !call.skip).map((call) => call.variables);
}

function patterns(): string[] {
  return requests().map((variables) => variables.filter.name?.iLike ?? '');
}

beforeEach(() => {
  vi.useFakeTimers();
  search.calls = [];
  search.responses = new Map();
  renders = [];
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

describe.each<Kind>(['services', 'addOns'])('catalog search hook (%s)', (kind) => {
  it('is idle and always skipped while inactive', () => {
    render(kind, '', false);
    render(kind, 'wa', false);
    wait(1000);
    expect(latest).toEqual({ options: [], status: 'idle', truncated: false });
    expect((search.calls as Call[]).every((call) => call.skip === true)).toBe(true);
  });

  it('browses on focus with one active-only request after a 0 ms timer', () => {
    render(kind, '');
    expect(requests()).toEqual([]);
    expect(latest.status).toBe('loading');
    wait(0);
    expect(requests()).toHaveLength(1);
    expect(requests()[0]!.filter).toEqual({ active: { is: true } });
    expect(requests()[0]!.filter).not.toHaveProperty('name');
    expect(latest).toEqual({ options: [], status: 'loading', truncated: false });
    search.responses.set('', { nodes: [WA, WASH] });
    render(kind, '');
    expect(latest).toEqual({ options: [WA, WASH], status: 'ready', truncated: false });
    wait(1000);
    // Re-renders re-call the hook with the same variables; no other text is sent.
    expect([...new Set(patterns())]).toEqual(['']);
  });

  it('sends a typed search only after 300 ms', () => {
    render(kind, '');
    wait(0);
    render(kind, 'wa');
    wait(299);
    expect(patterns()).toEqual(['']);
    wait(1);
    expect(patterns()).toEqual(['', '%wa%']);
    expect(requests()[1]!.filter.active).toEqual({ is: true });
  });

  it('sends no duplicate when focus and typing overlap', () => {
    render(kind, '', false);
    render(kind, '');
    render(kind, 'w');
    wait(0);
    expect(requests()).toEqual([]);
    wait(300);
    expect(patterns()).toEqual(['%w%']);
  });

  it('sends exactly one more request per settled text after the browse request', () => {
    render(kind, '');
    wait(0);
    expect(patterns()).toEqual(['']);
    render(kind, 'w');
    wait(300);
    expect(patterns()).toEqual(['', '%w%']);
    render(kind, 'wo');
    wait(300);
    expect(patterns()).toEqual(['', '%w%', '%wo%']);
  });

  it.each([
    ['wa then wash settles first', ['%wash%', '%wa%']],
    ['wash settles after late wa', ['%wa%', '%wash%']],
  ])('never offers a stale result in the race: %s', (_name, order) => {
    render(kind, 'wa');
    wait(300);
    expect(patterns().at(-1)).toBe('%wa%');
    render(kind, 'wash');
    for (const pattern of order) {
      search.responses.set(pattern, {
        lingering: true,
        nodes: pattern === '%wa%' ? [WA] : [WASH],
      });
      render(kind, 'wash');
    }
    // Neither text's response is settled yet: both linger, loading.
    wait(300);
    expect(patterns().at(-1)).toBe('%wash%');
    // The latest request is still unsettled: loading, no options, ever.
    for (const state of renders) {
      if (state.status !== 'ready') expect(state.options).toEqual([]);
      expect(state.options).not.toContainEqual(WA);
    }
    expect(latest).toEqual({ options: [], status: 'loading', truncated: false });
    search.responses.set('%wa%', { nodes: [WA] });
    render(kind, 'wash');
    expect(latest).toEqual({ options: [], status: 'loading', truncated: false });
    search.responses.set('%wash%', { nodes: [WASH] });
    render(kind, 'wash');
    expect(latest).toEqual({ options: [WASH], status: 'ready', truncated: false });
    expect(renders.some((state) => state.options.some((option) => option.id === WA.id))).toBe(false);
  });

  it('maps an error, an empty result and a truncated page, searching the trimmed text', () => {
    search.responses.set('%zz%', { error: new Error('down') });
    search.responses.set('%no%', { nodes: [] });
    search.responses.set('%wo%', { nodes: [W], totalCount: 21 });
    render(kind, 'zz');
    wait(300);
    expect(latest).toEqual({ options: [], status: 'error', truncated: false });
    render(kind, 'no');
    wait(300);
    expect(latest).toEqual({ options: [], status: 'ready', truncated: false });
    render(kind, '  wo ');
    wait(300);
    expect(patterns().at(-1)).toBe('%wo%');
    expect(latest).toEqual({ options: [W], status: 'ready', truncated: true });
  });
});
