// @vitest-environment jsdom
import { ServicesDocument } from '@clensy/client';
import { MockedProvider, type MockedResponse } from '@apollo/client/testing';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { laundryCatalogSearchVariables, useLaundryServiceSearch } from './use-laundry-catalog-search';

// The same race as the hook test, on real Apollo: new variables are never
// paired with old data (old data lives only in `previousData`, which the hook
// never reads).
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function service(id: string, name: string) {
  return { id, __typename: 'Service', active: true, activePricing: null, durationMinutes: 60, name };
}

function mock(text: string, nodes: ReturnType<typeof service>[], delay: number): MockedResponse {
  return {
    delay,
    request: { query: ServicesDocument, variables: laundryCatalogSearchVariables(text) },
    result: {
      data: {
        services: {
          __typename: 'ServiceConnection',
          nodes,
          pageInfo: { __typename: 'OffsetPageInfo', hasNextPage: false, hasPreviousPage: false },
          totalCount: nodes.length,
        },
      },
    },
  };
}

type Search = ReturnType<typeof useLaundryServiceSearch>;
let container: HTMLDivElement;
let root: Root;
let renders: { search: Search; text: string }[];

function Probe({ query }: { query: string }) {
  const found = useLaundryServiceSearch(query, true);
  renders.push({ search: found, text: query });
  return null;
}

function render(query: string) {
  act(() =>
    root.render(
      <MockedProvider
        mocks={[
          mock('wa', [service('s1', 'wa one')], 500),
          mock('wash', [service('s2', 'wash one'), service('s3', 'wash two')], 100),
        ]}
      >
        <Probe query={query} />
      </MockedProvider>,
    ),
  );
}

async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  renders = [];
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

describe('catalog search on real Apollo', () => {
  it('never returns a wa option while the text is wash', async () => {
    render('wa');
    await wait(300); // %wa% is sent, due at 800 ms
    render('wash');
    await wait(300); // %wash% is sent at 600 ms, due at 700 ms
    await wait(1000); // both delays pass
    for (const { search, text } of renders) {
      if (text === 'wash') expect(search.options.map((option) => option.name).join()).not.toContain('wa one');
    }
    const last = renders.at(-1)!.search;
    expect(last.status).toBe('ready');
    expect(last.options.map((option) => option.name)).toEqual(['wash one', 'wash two']);
  });
});
