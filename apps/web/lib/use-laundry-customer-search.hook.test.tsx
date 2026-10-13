// @vitest-environment jsdom
import type { LaundryCustomerOption } from '@clensy/web';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Drives the real hook with a mocked `useCustomersQuery` that answers per
// variables, as Apollo's cache does: a pattern with a stored response
// returns it; any other pattern is still in flight (`loading: true`, no
// data). So a response for one text can never come back for another.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// `lingering` returns `nodes` while still `loading: true`: stricter than the
// real Apollo 3.14.1 trace (Planning spikes), which shows no data until the
// new variables settle. The hook must not offer them either way.
type Response = { error?: Error; lingering?: boolean; nodes?: LaundryCustomerOption[]; totalCount?: number };

const search = vi.hoisted(() => ({
  calls: [] as { skip?: boolean; variables: { filter?: { fullName?: { iLike?: string } } } }[],
  responses: new Map<string, Response>(),
}));

vi.mock('@clensy/client', () => ({
  useCustomersQuery: (options: (typeof search.calls)[number]) => {
    search.calls.push(options);
    if (options.skip) return { data: undefined, error: undefined, loading: false };
    const response = search.responses.get(options.variables.filter!.fullName!.iLike!);
    if (!response) return { data: undefined, error: undefined, loading: true };
    if (response.error) return { data: undefined, error: response.error, loading: false };
    const nodes = response.nodes ?? [];
    return {
      data: { customers: { nodes, totalCount: response.totalCount ?? nodes.length } },
      error: undefined,
      loading: response.lingering === true,
    };
  },
}));

const { useLaundryCustomerSearch } = await import('./use-laundry-customer-search');
type Search = ReturnType<typeof useLaundryCustomerSearch>;

const AN = { id: 'c1', email: 'an@example.com', fullName: 'An Li', phone: '555-0101' };
const ANA = { id: 'c2', email: 'ana@example.com', fullName: 'Ana Reyes', phone: '555-0102' };

let container: HTMLDivElement;
let root: Root;
let latest: Search;

function Probe({ query }: { query: string }) {
  latest = useLaundryCustomerSearch(query);
  return null;
}

function render(query: string) {
  act(() => root.render(<Probe query={query} />));
}

function wait(ms: number) {
  act(() => vi.advanceTimersByTime(ms));
}

function searchedPatterns(): string[] {
  return search.calls.filter((call) => !call.skip).map((call) => call.variables.filter!.fullName!.iLike!);
}

beforeEach(() => {
  vi.useFakeTimers();
  search.calls = [];
  search.responses = new Map([
    ['%an%', { nodes: [AN, ANA] }],
    ['%ana%', { nodes: [ANA] }],
  ]);
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

describe('useLaundryCustomerSearch', () => {
  it('is idle and sends no query for an empty or blank text', () => {
    render('');
    expect(latest).toEqual({ options: [], status: 'idle', truncated: false });
    render('   ');
    wait(300);
    expect(latest.status).toBe('idle');
    expect(searchedPatterns()).toEqual([]);
  });

  it('waits out the debounce even for the first non-empty text', () => {
    render('an');
    expect(latest).toEqual({ options: [], status: 'loading', truncated: false });
    wait(299);
    expect(searchedPatterns()).toEqual([]);
    wait(1);
    expect(searchedPatterns().at(-1)).toBe('%an%');
    expect(latest).toEqual({ options: [AN, ANA], status: 'ready', truncated: false });
  });

  it('never offers an older text’s results for a newer text', () => {
    render('an');
    wait(300);
    expect(latest.options).toEqual([AN, ANA]);
    search.responses.delete('%ana%'); // the "ana" request will be in flight
    render('ana');
    expect(latest).toEqual({ options: [], status: 'loading', truncated: false });
    wait(300);
    expect(searchedPatterns().at(-1)).toBe('%ana%');
    expect(latest).toEqual({ options: [], status: 'loading', truncated: false });
    search.responses.set('%ana%', { nodes: [ANA] });
    render('ana'); // the response arrives
    expect(latest).toEqual({ options: [ANA], status: 'ready', truncated: false });
  });

  it('returns to the searched text’s results at once when the text goes back to it', () => {
    render('an');
    wait(300);
    render('ana');
    expect(latest.status).toBe('loading');
    render('an'); // before the "ana" debounce elapses
    expect(latest).toEqual({ options: [AN, ANA], status: 'ready', truncated: false });
    wait(300);
    expect(searchedPatterns()).not.toContain('%ana%');
  });

  it('goes idle when cleared during a search, and stays idle when the response arrives', () => {
    search.responses.delete('%ana%');
    render('ana');
    wait(300);
    expect(latest.status).toBe('loading');
    render('');
    expect(latest).toEqual({ options: [], status: 'idle', truncated: false });
    // Skipped at once, not after the debounce: the empty input sends no query.
    expect(search.calls.at(-1)?.skip).toBe(true);
    search.responses.set('%ana%', { nodes: [ANA] });
    render('');
    expect(latest).toEqual({ options: [], status: 'idle', truncated: false });
    expect(search.calls.at(-1)?.skip).toBe(true);
    wait(300);
    expect(search.calls.at(-1)?.skip).toBe(true);
  });

  it('offers nothing while a new search is loading, even if the previous result lingers', () => {
    render('an');
    wait(300);
    expect(latest.options).toEqual([AN, ANA]);
    // The "ana" query reports loading but still carries the "an" nodes.
    search.responses.set('%ana%', { lingering: true, nodes: [AN, ANA] });
    render('ana');
    wait(300);
    expect(searchedPatterns().at(-1)).toBe('%ana%');
    expect(latest).toEqual({ options: [], status: 'loading', truncated: false });
    search.responses.set('%ana%', { nodes: [ANA] }); // settles
    render('ana');
    expect(latest).toEqual({ options: [ANA], status: 'ready', truncated: false });
  });

  it('maps a failed search and an empty result', () => {
    search.responses.set('%zz%', { error: new Error('down') });
    search.responses.set('%no%', { nodes: [] });
    render('zz');
    wait(300);
    expect(latest).toEqual({ options: [], status: 'error', truncated: false });
    render('no');
    wait(300);
    expect(latest).toEqual({ options: [], status: 'ready', truncated: false });
  });

  it('flags more matches than the page holds', () => {
    search.responses.set('%ana%', { nodes: [ANA], totalCount: 21 });
    render('ana');
    wait(300);
    expect(latest).toEqual({ options: [ANA], status: 'ready', truncated: true });
  });

  it('searches the trimmed text', () => {
    render('  an ');
    wait(300);
    expect(searchedPatterns().at(-1)).toBe('%an%');
    expect(latest.status).toBe('ready');
  });
});
