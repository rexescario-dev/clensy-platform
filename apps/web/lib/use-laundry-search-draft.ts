'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LAUNDRY_SEARCH_DEBOUNCE_MS, parseLaundryOrderListState } from './use-laundry-order-list-url-state';

// The list's search box. The input shows every keystroke (`draft`); the
// committed search (the URL) follows once typing pauses for
// `LAUNDRY_SEARCH_DEBOUNCE_MS`.
//
// Back and Forward (`popstate`) cancel a keystroke still waiting, and the
// draft becomes the search of the entry the user went to; the browser's
// navigation wins. `window.location` already shows that entry when
// `popstate` fires, so the draft is read from it rather than from a
// `useSearchParams` render that may not have happened yet.
//
// The list's own updates never overwrite the draft: a committed search is
// always the draft's own text (debounced, or committed to the list entry
// just before a row click opens the drawer), and clearing empties both.
export function useLaundrySearchDraft(committedSearch: string, commit: (text: string) => void) {
  const [draft, setDraft] = useState(committedSearch);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingText = useRef<string | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  useEffect(() => {
    function handlePopState() {
      clearTimeout(timer.current);
      pendingText.current = undefined;
      setDraft(parseLaundryOrderListState(new URLSearchParams(window.location.search)).search);
    }
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const change = useCallback(
    (text: string) => {
      setDraft(text);
      pendingText.current = text;
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        pendingText.current = undefined;
        commit(text);
      }, LAUNDRY_SEARCH_DEBOUNCE_MS);
    },
    [commit],
  );

  // Cancels the waiting commit and returns its text, for a caller that
  // commits it itself (a row click, before it opens the drawer).
  const takePending = useCallback((): string | undefined => {
    clearTimeout(timer.current);
    const text = pendingText.current;
    pendingText.current = undefined;
    return text;
  }, []);

  // Cancels any waiting commit and empties the box (clear filters).
  const reset = useCallback(() => {
    takePending();
    setDraft('');
  }, [takePending]);

  return { change, draft, reset, takePending };
}
