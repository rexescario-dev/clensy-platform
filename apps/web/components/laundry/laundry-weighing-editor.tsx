'use client';

import { useWeighLaundryOrderMutation } from '@clensy/client';
import { Button, FormField, useToast } from '@clensy/ui';
import { formatWeightGrams, useClensyTranslations } from '@clensy/web';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { graphQLErrorMessage } from '../../lib/graphql-error-message';
import { kilogramsInputFromGrams, summarizeWeightEntries } from '../../lib/laundry-weight-entries';

export interface LaundryWeighingEditorProps {
  // Every control is disabled, and a submit is dropped, while a price is
  // confirmed (#162 owner decision 6.3).
  disabled?: boolean;
  // Refetches the order after a recorded weight, so the summary's Weight
  // card and the "Recorded weight" line show the saved value (#155).
  onRecorded: () => Promise<unknown>;
  orderId: string;
  // The server's recorded weight, or `null` before the first weigh.
  weightGrams: number | null;
}

interface Entry {
  key: number;
  text: string;
  // Left at least once; its error shows from then on.
  touched: boolean;
}

// The total-level error ("Add at least one weight.", "The combined weight
// is too large to record.") describes Record weight, the control it blocks.
// The page has one editor, so a fixed id is unique.
const FORM_ERROR_ID = 'laundry-weighing-form-error';

function entryInputId(key: number): string {
  return `laundry-weight-entry-${String(key)}`;
}

function entry(key: number, text: string): Entry {
  return { key, text, touched: false };
}

// Several temporary weight rows summed into one `weightGrams` (lifecycle
// spec §8.4.4, #155). Rows are never persisted (§8.2): a re-weigh starts
// from one row holding the recorded total. The server stays authoritative
// (§8.4.1); this form only stops input it would reject anyway.
export function LaundryWeighingEditor({ disabled = false, onRecorded, orderId, weightGrams }: LaundryWeighingEditorProps) {
  const t = useClensyTranslations('laundry');
  const toast = useToast();
  const [weigh] = useWeighLaundryOrderMutation();
  const nextKey = useRef(1);
  const [entries, setEntries] = useState<Entry[]>(() => [
    entry(0, weightGrams === null ? '' : kilogramsInputFromGrams(weightGrams)),
  ]);
  const [attempted, setAttempted] = useState(false);
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | undefined>(undefined);
  // Taken synchronously, so a second submit that lands before React
  // re-renders (and disables the button) is dropped.
  const inFlight = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const recordRef = useRef<HTMLButtonElement>(null);
  const wasPending = useRef(false);
  // The row to focus after a blocked submit has rendered its error. A new
  // object per submit, so a repeat submit on the same row focuses it again.
  const [focusRow, setFocusRow] = useState<{ key: number } | null>(null);
  const summary = summarizeWeightEntries(entries.map((row) => row.text));
  // A save in flight or a price being confirmed (#162).
  const locked = pending || disabled;

  // Every control is disabled while a save and its refetch run, so a
  // browser drops focus to <body>. Once they settle, focus goes back to
  // Record weight, unless the user has since moved it outside the form.
  useEffect(() => {
    if (wasPending.current && !pending) {
      const active = document.activeElement;
      if (!active || active === document.body || formRef.current?.contains(active)) {
        recordRef.current?.focus();
      }
    }
    wasPending.current = pending;
  }, [pending]);

  // A submit blocked by an invalid row moves focus to the first such row,
  // once its error is rendered, so the input is announced with it. A
  // form-level error ("Add at least one weight.") keeps focus on Record
  // weight, which it describes.
  useEffect(() => {
    if (focusRow) document.getElementById(entryInputId(focusRow.key))?.focus();
  }, [focusRow]);

  function takeKey(): number {
    const key = nextKey.current;
    nextKey.current += 1;
    return key;
  }

  // Any edit makes an earlier server error stale, so it is cleared.
  function addEntry() {
    const key = takeKey();
    setFailure(undefined);
    setEntries((current) => [...current, entry(key, '')]);
  }

  function removeEntry(key: number) {
    setFailure(undefined);
    setEntries((current) => current.filter((row) => row.key !== key));
  }

  function changeEntry(key: number, text: string) {
    setFailure(undefined);
    setEntries((current) => current.map((row) => (row.key === key ? { ...row, text } : row)));
  }

  function touchEntry(key: number) {
    setEntries((current) => current.map((row) => (row.key === key ? { ...row, touched: true } : row)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || disabled) return;
    setAttempted(true);
    setFailure(undefined);
    if (!summary.submittable) {
      const invalid = entries.find((_row, index) => !summary.results[index]!.ok);
      if (invalid) setFocusRow({ key: invalid.key });
      return;
    }
    inFlight.current = true;
    setPending(true);
    const total = summary.totalGrams;
    try {
      // The client sets no `errorPolicy`, so Apollo's default `'none'`
      // rejects on GraphQL errors (planning spike). A resolved result with
      // errors or without the order is still treated as a failure, so a
      // future policy change can never report a rejected weight as saved.
      let failed: string | undefined;
      try {
        const result = await weigh({ variables: { input: { orderId, weightGrams: total } } });
        if ((result.errors?.length ?? 0) > 0 || !result.data?.weighLaundryOrder) {
          failed = graphQLErrorMessage({ graphQLErrors: result.errors }) ?? t('order.weighing.failure');
        }
      } catch (error) {
        failed = graphQLErrorMessage(error) ?? t('order.weighing.failure');
      }
      if (failed !== undefined) {
        setFailure(failed);
        return;
      }
      toast.success(t('order.weighing.success'));
      setEntries([entry(takeKey(), kilogramsInputFromGrams(total))]);
      setAttempted(false);
      try {
        await onRecorded();
      } catch {
        // The weight is recorded; a failed reload is never a weighing
        // failure. Apollo puts the query in error, and the page shows its
        // order error state (Task 5 test).
      }
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <form ref={formRef} noValidate onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-3">
      <p className="text-slate-600">{t('order.weighing.description')}</p>
      {entries.map((row, index) => {
        const n = String(index + 1);
        const result = summary.results[index];
        const error =
          (attempted || row.touched) && !result.ok ? t(`order.weighing.error.${result.error}`) : undefined;
        return (
          <div key={row.key} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <FormField
                label={t('order.weighing.bag').replace('{n}', n)}
                name={entryInputId(row.key)}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={row.text}
                error={error}
                disabled={locked}
                onChange={(event) => changeEntry(row.key, event.currentTarget.value)}
                onBlur={() => touchEntry(row.key)}
              />
            </div>
            <Button type="button" variant="secondary" disabled={locked} onClick={() => removeEntry(row.key)}>
              {t('order.weighing.remove').replace('{n}', n)}
            </Button>
          </div>
        );
      })}
      <Button type="button" variant="secondary" disabled={locked} onClick={addEntry} className="self-start">
        {t('order.weighing.add')}
      </Button>
      <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
        <p className="text-slate-500">{t('order.weighing.combined')}</p>
        <p role="status" aria-live="polite" className="text-lg font-semibold text-slate-900">
          {formatWeightGrams(summary.totalGrams)}
        </p>
      </div>
      {summary.formError ? (
        <p id={FORM_ERROR_ID} className="text-red-600">
          {t(`order.weighing.error.${summary.formError}`)}
        </p>
      ) : null}
      {failure ? (
        <p role="alert" className="text-red-600">
          {failure}
        </p>
      ) : null}
      <Button
        ref={recordRef}
        type="submit"
        disabled={locked}
        aria-describedby={summary.formError ? FORM_ERROR_ID : undefined}
        className="w-full sm:w-auto sm:self-start"
      >
        {t('order.weighing.record')}
      </Button>
    </form>
  );
}
