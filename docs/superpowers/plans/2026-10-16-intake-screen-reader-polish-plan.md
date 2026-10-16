# Intake Screen-Reader Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Draft** (M4). Awaiting Plan Review (M5). |
| Date | 2026-10-16 |
| Tracking issue | [#181](https://github.com/rexescario-dev/clensy-platform/issues/181) "Laundry intake dialog: screen-reader polish for the fulfillment error and customer search status". Epic [#154](https://github.com/rexescario-dev/clensy-platform/issues/154). Follow-up from [#160](https://github.com/rexescario-dev/clensy-platform/issues/160) / PR [#179](https://github.com/rexescario-dev/clensy-platform/pull/179): M7 triage T2-a, T2-b and the M7 live-region observation, listed under Deferred in the [Laundry Intake Modal plan](2026-10-13-laundry-intake-modal-plan.md#deferred-not-in-this-plan). The manual keyboard pass is [#161](https://github.com/rexescario-dev/clensy-platform/issues/161) (open). |
| Branch | `feat/181-intake-screen-reader-polish`, from `main` at `8c7a11b`. One PR for this plan, its M5 record and the implementation. |
| Scope | `packages/web`: `LaundryFulfillmentFieldset`, `LaundrySearchCombobox`, and their static tests (plus the customer picker's static test). `apps/web`: `CreateLaundryOrderDialog` and two jsdom test files. **No** API, schema, migration, GraphQL operation, generated client, `@clensy/ui` (including `FormField`), copy or dependency change. |
| Implements (Accepted) | [Laundry Orders & Lifecycle](../specs/2026-09-06-laundry-orders-lifecycle-design.md), Status **Accepted** (2026-09-06), with **Amendment #164**, Accepted 2026-10-10. Governing text: §8.4.4, second bullet (intake stays a `FormDialog`; server-side customer search; fulfillment chosen at intake and immutable; the form says the choice is fixed). This plan changes only how that existing UI is exposed to assistive technology. It adds no product semantics. |
| Relies on (Accepted, merged) | [Laundry Intake Modal plan](2026-10-13-laundry-intake-modal-plan.md) (#160): the dialog, the fieldset, the picker, the server field-error path, the jsdom page harness. [Laundry Services Selection plan](2026-10-15-laundry-services-selection-plan.md) (#158): the extraction of `LaundrySearchCombobox`, which the services editor also uses. [Clensy validation](../specs/2026-09-15-clensy-validation-design.md): `normalizeApiValidationErrors`. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. Element ids, helper names and task order are planning decisions, not product semantics. |
| Owner decisions (brainstorm, 2026-10-16) | See [Owner decisions](#owner-decisions) 1–3. None changes product semantics, so **no spec amendment** (owner-approved). |
| Planning decisions for M5 to confirm | See [Planning decisions](#planning-decisions-for-m5-to-confirm) (a)–(h). |
| Edit anchors | Edits are given against `main` at `8c7a11b`. Apply each by the quoted code, not by line number. One file is given in full (Task 1). |
| Package names | `pnpm --filter web` is `apps/web` (package `web`). `pnpm --filter @clensy/web` is `packages/web`. Two different packages; both appear in verification on purpose. |
| Baseline | At planning time, on `8c7a11b`, the five affected test files passed: `pnpm --filter @clensy/web exec vitest run` on the three static files, 15/15; `pnpm --filter web exec vitest run` on the two jsdom files, 39/39. This is a baseline, not pre-validation. |
| Pre-validation | **None.** No code in this plan was run before M5. Every `Expected:` line is a prediction until M6 records the actual result. |
| M7 | Application code changes. `CLAUDE.md` requires a **fresh independent reviewer** on the most capable model, given this plan, the Accepted spec and the branch diff. |

**Goal:** Close the three #181 findings without visual or copy change:
1. A server error on the customer or fulfillment field is announced once, by moving focus to the first field with an error. That field is marked invalid and described by the error.
2. Each fulfillment radio is named by its title only, and its description is read once.
3. The search combobox announces "Searching…", the no-match line, the more-matches line and the search error through one persistent, polite status region.

**Architecture:**
- **`LaundryFulfillmentFieldset`** (`packages/web`):
  - Each radio gets `aria-labelledby` (its title span) and `aria-describedby` (its description, then the error while one shows), plus `aria-invalid` while an error shows.
  - The fieldset is described by the helper only.
  - A new optional `inputRef` goes on the checked radio.
- **`CreateLaundryOrderDialog`** (`apps/web`):
  - Passes the Controller's `field.ref` to the fieldset as `inputRef`.
  - After setting every server field error, calls `form.setFocus` on the first field in form order (`customerId`, then `fulfillmentType`) that has one.
- **`LaundrySearchCombobox`** (`packages/web`, used by the customer picker and the services editor):
  - Derives one search message from its existing props (status, options, truncated). The popup shows that message as before, but without a live role.
  - A `<p role="status" class="sr-only">` that is always mounted, outside the popup, carries the same message while the list is expanded, and is empty otherwise. There is no new state.

**Tech Stack:** React 19, react-hook-form 7.88, Vitest (`renderToStaticMarkup` in `packages/web`; jsdom with fake timers in `apps/web`), Tailwind (`sr-only`).

**Spec:** `docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md` §8.4.4.

## Owner decisions

From the brainstorm on 2026-10-16. The owner approved the design and asked for points 1–5 under [M4 lock-downs](#m4-lock-downs-owner-design-approval) to be made explicit.

1. **Server field errors: focus plus `aria-describedby`, no live role.** "`role="alert"` announces content assertively and can be disruptive if applied to every field error." The customer and fulfillment fields follow one pattern:
   - The error is associated with its field through `aria-describedby`.
   - `aria-invalid="true"` is set while it shows.
   - After a server rejection, focus moves to the first field with an error.
   - The error stays visible next to the field.

   Generic or unknown failures keep the dialog-level `role="alert"` and do not move focus. Client validation is unchanged: it already focuses the field.
2. **Radio name is the title.** `aria-labelledby` points at the title span, and the description stays in `aria-describedby`. The `<label>` wrapper stays, so clicking anywhere on the row still selects it.
3. **One persistent polite status region** in the shared combobox:
   - It is always mounted outside the hidden popup, visually hidden, and starts empty.
   - It reflects the existing status (it is not a second, independently kept state).
   - It is empty when the list closes, including on selection and dismissal.

   The visible popup lines keep their look and text, but lose `role="status"` and `role="alert"`. The search error becomes polite.

Out of scope (owner-confirmed): an M2 amendment, any `FormField` or other `@clensy/ui` change, announcing result counts (`t()` has no interpolation), and [#180](https://github.com/rexescario-dev/clensy-platform/issues/180).

## M4 lock-downs (owner design approval)

| # | Owner point | Where it is locked |
| --- | --- | --- |
| 1 | Focus timing: errors set before `setFocus`; refs registered and usable; `customerId` wins whatever order the errors arrive in. | Planning decision (d); Task 2. Tests: focus lands on the real element (customer input, checked radio), after the DELIVERY radio became the checked one, and with the server listing fulfillment first. |
| 2 | Radio error cleanup: clearing or replacing an error removes or keeps the error id and `aria-invalid` correctly; the helper stays. | Task 1 (static, with and without error); Task 1 and Task 2 (jsdom, cleared then replaced). |
| 3 | Status transitions: searching, no matches, more matches, failure, reopening, closing, selection; idle empty; no live role on popup lines. | Task 3 (static and jsdom). |
| 4 | Regression: existing live-role queries updated; region found while the popup is hidden; no accidental match of unrelated alerts. | Task 3. The region is queried by id and asserted outside any `[hidden]` ancestor. The dialog's `[role="alert"]` is asserted absent during a search error. |
| 5 | Manual screen-reader pass kept as an explicit acceptance check, alongside #161's keyboard pass. | Planning decision (h); Task 4 Step 3. |

## Planning decisions for M5 to confirm

- **(a) No spec change.** The work is accessibility markup and focus inside the UI §8.4.4 already specifies. The owner approved this at the brainstorm.
- **(b) The fieldset keeps only the helper in its `aria-describedby`.** The error id moves to each radio, after the description.
  - **Why:** if the error described both the fieldset and the radios, a screen reader that reads a group's description when focus enters it (JAWS does) would read the error twice.
  - **Test impact:** this changes one existing jsdom assertion, which expected `laundry-fulfillment-fixed laundry-fulfillment-error` on the fieldset (Task 1).
- **(c) `inputRef` is attached to the checked radio only** (`ref={checked ? inputRef : undefined}`).
  - React detaches the old radio and attaches the new one when the value changes.
  - react-hook-form's Controller ref callback ignores `null` and keeps the last element it was given, so `setFocus` always reaches the checked radio.
  - Attaching it to both radios would leave the last one rendered (`DELIVERY`) as the target.
- **(d) Focus after all errors are set.**
  - `handleValid` first calls `form.setError` for every field `normalizeApiValidationErrors` returned. Only then does it call `form.setFocus(first)`, where `first` is the first entry of `API_FIELDS` (`['customerId', 'fulfillmentType']`, form order) present in the result.
  - react-hook-form 7.88's `setFocus` focuses inside `setTimeout(0)` (read in `dist/index.esm.mjs` at planning time). The focus therefore runs after React commits the error markup, so the error id already exists when focus lands.
  - The jsdom suite uses fake timers, so the tests advance `vi.advanceTimersByTime(0)` inside `act` before asserting focus.
  - `setError(..., { shouldFocus: true })` was not used: it focuses synchronously, in the middle of the loop.
- **(e) One message per status, in this order:** loading → "Searching…"; error → the error line; ready with no options → the empty line; ready and truncated → the more line; otherwise none.
  - Today a `ready` result with no options **and** `truncated` would render both the empty and the more lines. That needs a server count above zero with an empty page, which does not occur in practice. It now renders the empty line only.
  - This is the only markup difference in a visible line apart from the removed role. It is pinned by a static test.
- **(f) Region markup:**
  - `<p id="${id}-status" role="status" class="sr-only">`, placed right after the popup `<div>` and before the field error.
  - `role="status"` implies `aria-live="polite"` and `aria-atomic="true"`, so no extra attributes are added.
  - `sr-only` is absolutely positioned, so it adds no flex gap to the field's layout.
- **(g) The region is empty whenever the list is not expanded** (`expanded` is already `open && status !== 'idle'`). That covers Escape, blur, selection, a cleared text, and the idle status. Reopening (ArrowDown, typing, or focus with `openOnFocus`) fills it again from the same derived message.
  - Keystrokes while a search stays `loading` leave the text unchanged, so nothing is re-announced.
  - When results arrive with options and no truncation, the region empties. No result count is announced (out of scope).
- **(h) Manual screen-reader pass.** This is #181's first three acceptance criteria. DOM tests cannot prove what a screen reader announces.
  - Task 4 Step 3 gives the script.
  - If the M6 implementer has no screen reader, M6 records the pass **NOT RUN** with that reason. The owner runs it, alone or during #161's keyboard pass.
  - #181 is not closed until the pass is recorded. The PR may still merge on the owner's decision; that is the owner's call at closeout, not this plan's.
- **Inherited by the services editor (informative).** The services editor uses the same combobox, so it gets fix 3 with its own copy. A grep at planning time found no services or order-page test that queries a live role on a search line. `alerts()` in `laundry-services-editor.interaction.test.tsx` collects `[role="alert"]` for pricing messages only. Removing the search error's `role="alert"` can only remove an entry that no test expects.

## Global constraints

- **SHALL NOT** change any copy, visible class string, layout or row styling. The visible search lines keep the classes `px-3 py-2 text-sm text-slate-500` (or `text-red-600` for the error).
- **SHALL NOT** add `role="alert"` or `aria-live` to any field error.
- **SHALL NOT** change `FormField`, `FormDialog`, `Modal` or anything else in `@clensy/ui`, or any API, schema, operation or generated client.
- **SHALL** keep the dialog's generic failure (`Unable to create laundry order.`) and the unconfirmed-create message on the existing `role="alert"`, without moving focus.
- **SHALL** keep client validation unchanged ("Select a customer.", field focused, no mutation).
- **SHALL** keep exactly one `role="status"` node per combobox and no `role="alert"` inside it.
- **SHALL** keep every #160 and #158 behavior these files already pin: Escape handling, the active-option contract, the selection contract, `openOnFocus`, `onFocus` and `onBlur`.

## Review focus

The input classes most likely to bite a user that no existing test exercises. Each has its test in the owning task.

1. **A server fulfillment error while `DELIVERY` is checked.** Focus must land on the `DELIVERY` radio, not the stale `PICKUP` one. Task 2, `fulfillment` test.
2. **The server lists the fulfillment error before the customer error.** Focus goes to the customer field (form order), and both errors show. Task 2, new test.
3. **A second server error replaces a cleared one.** The error id appears once, after the description, the text is the new message, and `aria-invalid` is back. Task 2, `fulfillment` test.
4. **A failed search, then the user types again.** The region switches from the error to "Searching…", and no stale error stays announced. Task 3, jsdom transitions test.
5. **More typing while a search is still loading.** The same region node keeps the same text, so nothing is re-announced and no second region appears. Task 3, jsdom transitions test.

## File map

| File | Change | Task |
| --- | --- | --- |
| `packages/web/src/laundry/laundry-fulfillment-fieldset.tsx` | Radio naming, descriptions, invalid state, `inputRef` | 1 |
| `packages/web/src/laundry/laundry-fulfillment-fieldset.test.tsx` | Two tests changed | 1 |
| `apps/web/lib/laundry-list-page.interaction.test.tsx` | Fulfillment error assertions (Task 1); focus assertions and one new test (Task 2); search-error query (Task 3) | 1, 2, 3 |
| `apps/web/components/laundry/create-laundry-order-dialog.tsx` | `inputRef`, focus the first errored field | 2 |
| `packages/web/src/laundry/laundry-search-combobox.tsx` | Derived message, persistent status region, no live roles on lines | 3 |
| `packages/web/src/laundry/laundry-search-combobox.test.tsx` | One test changed, one added | 3 |
| `packages/web/src/laundry/laundry-customer-picker.test.tsx` | One test changed | 3 |
| `apps/web/lib/laundry-search-combobox.interaction.test.tsx` | Harness props, two tests added | 3 |
| This plan | Execution record | 4 |

---

### Task 1: Fulfillment radios: name, description, invalid state, ref

Implements Owner decisions 1 (markup half) and 2; planning decisions (b), (c). Issue findings 1 and 2.

**Files:**
- Modify: `packages/web/src/laundry/laundry-fulfillment-fieldset.tsx` (given in full)
- Test: `packages/web/src/laundry/laundry-fulfillment-fieldset.test.tsx`
- Test: `apps/web/lib/laundry-list-page.interaction.test.tsx` (the fulfillment server-error test)

**Interfaces:**
- Produces: `LaundryFulfillmentFieldsetProps.inputRef?: Ref<HTMLInputElement>`, attached to the checked radio. Element ids: `${name}-${option}-title` (new), `${name}-${option}-description`, `${name}-error`, `${name}-fixed` (unchanged).

- [ ] **Step 1: Write the failing static tests**

In `packages/web/src/laundry/laundry-fulfillment-fieldset.test.tsx`, replace the test `'uses two real radios in one group, each labelled and described'` with:

```tsx
  it('uses two real radios in one group, each named by its title and described by its description', () => {
    const html = renderToStaticMarkup(<LaundryFulfillmentFieldset name="fulfillment" value="PICKUP" onChange={noop} />);
    for (const option of ['PICKUP', 'DELIVERY']) {
      const input = new RegExp(`<input[^>]*id="fulfillment-${option}"[^>]*>`).exec(html)?.[0];
      expect(input).toBeDefined();
      expect(input).toContain('type="radio"');
      expect(input).toContain('name="fulfillment"');
      expect(input).toContain(`value="${option}"`);
      expect(input).toContain(`aria-labelledby="fulfillment-${option}-title"`);
      expect(input).toContain(`aria-describedby="fulfillment-${option}-description"`);
      expect(input).not.toContain('aria-invalid');
      expect(html).toContain(`for="fulfillment-${option}"`);
      expect(html).toMatch(new RegExp(`<span id="fulfillment-${option}-title"[^>]*>[^<]+</span>`));
      expect(html).toContain(`id="fulfillment-${option}-description"`);
    }
    expect(html).toMatch(/<fieldset[^>]*aria-describedby="fulfillment-fixed"/);
  });
```

Replace the test `'shows a field error under the radios and describes the group with it'` with:

```tsx
  it('shows a field error under the radios, marks both invalid and describes each with it after its description', () => {
    const message = 'fulfillmentType must be one of the following values: PICKUP, DELIVERY';
    const html = renderToStaticMarkup(
      <LaundryFulfillmentFieldset name="fulfillment" value="PICKUP" error={message} onChange={noop} />,
    );
    // The group keeps only the helper, so the error is not read twice.
    expect(html).toMatch(/<fieldset[^>]*aria-describedby="fulfillment-fixed"/);
    for (const option of ['PICKUP', 'DELIVERY']) {
      const input = new RegExp(`<input[^>]*id="fulfillment-${option}"[^>]*>`).exec(html)![0];
      expect(input).toContain('aria-invalid="true"');
      expect(input).toContain(`aria-describedby="fulfillment-${option}-description fulfillment-error"`);
    }
    expect(html).toContain(`<p id="fulfillment-error" class="text-sm text-red-600">${message}</p>`);
    expect(html).not.toContain('role="alert"');
    const clean = renderToStaticMarkup(<LaundryFulfillmentFieldset name="fulfillment" value="PICKUP" onChange={noop} />);
    expect(clean).not.toContain('fulfillment-error');
    expect(clean).not.toContain('aria-invalid');
  });
```

The `/<fieldset[^>]*aria-describedby="fulfillment-fixed"/` pattern requires the closing quote right after `fixed`, so it fails on today's `"fulfillment-fixed fulfillment-error"`.

- [ ] **Step 2: Run the static tests to verify they fail**

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-fulfillment-fieldset.test.tsx`
Expected: FAIL, 2 failed and 2 passed. The first changed test fails on `aria-labelledby`. The second fails on the fieldset's `aria-describedby`.

- [ ] **Step 3: Implement**

Replace `packages/web/src/laundry/laundry-fulfillment-fieldset.tsx` with:

```tsx
'use client';

import type { Ref } from 'react';
import { useClensyTranslations } from '../i18n/use-clensy-translations';
import type { LaundryFulfillmentType } from './laundry-order-status';

export interface LaundryFulfillmentFieldsetProps {
  name: string;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
  onChange: (value: LaundryFulfillmentType) => void;
  value: LaundryFulfillmentType;
}

const OPTIONS: readonly LaundryFulfillmentType[] = ['PICKUP', 'DELIVERY'];

// How the finished laundry comes back, chosen once at intake (lifecycle spec
// §8.4.4: immutable after create; delivery does not schedule a route). Two
// native radios in a fieldset; each whole row is the radio's label, but the
// radio is named by its title alone and described by its description, so
// the description is read once (#181).
//
// A field error (in practice only a server one: a radio is always checked)
// shows under the rows. It marks both radios invalid and describes each,
// after its description. The fieldset keeps only the helper, so a screen
// reader that reads the group's description does not read the error twice.
// `inputRef` goes on the checked radio, so the form can focus it.
export function LaundryFulfillmentFieldset({ name, error, inputRef, onChange, value }: LaundryFulfillmentFieldsetProps) {
  const t = useClensyTranslations('laundry');
  const helperId = `${name}-fixed`;
  const errorId = `${name}-error`;

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={helperId}>
      <legend className="text-sm font-medium text-slate-700">{t('create.fulfillment.legend')}</legend>
      <p id={helperId} className="text-sm text-slate-500">
        {t('create.fulfillment.fixed')}
      </p>
      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:gap-3">
        {OPTIONS.map((option) => {
          const inputId = `${name}-${option}`;
          const titleId = `${inputId}-title`;
          const descriptionId = `${inputId}-description`;
          const checked = value === option;
          return (
            <label
              key={option}
              htmlFor={inputId}
              className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 ${checked ? 'border-slate-900' : 'border-slate-300'}`}
            >
              <input
                ref={checked ? inputRef : undefined}
                id={inputId}
                type="radio"
                name={name}
                value={option}
                checked={checked}
                required
                aria-labelledby={titleId}
                aria-describedby={error ? `${descriptionId} ${errorId}` : descriptionId}
                aria-invalid={error ? true : undefined}
                onChange={() => onChange(option)}
                className="mt-0.5 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <span className="flex flex-col">
                <span id={titleId} className="text-sm font-medium text-slate-900">
                  {t(`fulfillment.${option}`)}
                </span>
                <span id={descriptionId} className="text-sm text-slate-500">
                  {t(`create.fulfillment.description.${option}`)}
                </span>
              </span>
            </label>
          );
        })}
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
```

- [ ] **Step 4: Run the static tests to verify they pass**

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-fulfillment-fieldset.test.tsx`
Expected: PASS, 4/4.

- [ ] **Step 5: Update the jsdom fulfillment-error test to the new markup**

The fieldset change breaks one existing assertion in `apps/web/lib/laundry-list-page.interaction.test.tsx`. Confirm that first:

Run: `pnpm --filter web exec vitest run lib/laundry-list-page.interaction.test.tsx -t "server fulfillment error"`
Expected: FAIL. The fieldset's `aria-describedby` is `laundry-fulfillment-fixed`, but the test expects `laundry-fulfillment-fixed laundry-fulfillment-error`.

In the test `'shows a server fulfillment error on the fulfillment field, and clears it when fulfillment changes'`, replace:

```tsx
    expect(document.querySelector('fieldset')!.getAttribute('aria-describedby')).toBe(
      'laundry-fulfillment-fixed laundry-fulfillment-error',
    );
```

with:

```tsx
    expectFulfillmentDescribed(true);
```

Then replace:

```tsx
    expect(error()).toBeNull();
    await submitCreate();
```

with:

```tsx
    expect(error()).toBeNull();
    expectFulfillmentDescribed(false);
    await submitCreate();
```

Add this helper after `customerOptions()`:

```tsx
// The fulfillment group keeps only its helper. While an error shows, each
// radio is invalid and described by its description, then the error (#181).
function expectFulfillmentDescribed(withError: boolean) {
  expect(document.querySelector('fieldset')!.getAttribute('aria-describedby')).toBe('laundry-fulfillment-fixed');
  for (const option of ['PICKUP', 'DELIVERY']) {
    const radio = document.querySelector(`#laundry-fulfillment-${option}`)!;
    expect(radio.getAttribute('aria-invalid')).toBe(withError ? 'true' : null);
    expect(radio.getAttribute('aria-describedby')).toBe(
      withError ? `laundry-fulfillment-${option}-description laundry-fulfillment-error` : `laundry-fulfillment-${option}-description`,
    );
  }
}
```

- [ ] **Step 6: Run the jsdom file to verify it passes**

Run: `pnpm --filter web exec vitest run lib/laundry-list-page.interaction.test.tsx`
Expected: PASS, 33/33.

- [ ] **Step 7: Commit**

```bash
git status --short
git add packages/web/src/laundry/laundry-fulfillment-fieldset.tsx packages/web/src/laundry/laundry-fulfillment-fieldset.test.tsx apps/web/lib/laundry-list-page.interaction.test.tsx
git commit -m "fix(181): name each fulfillment radio by its title and describe it with the error"
```

---

### Task 2: Focus the first field with a server error

Implements Owner decision 1 (focus half); planning decisions (c), (d); lock-down 1. Issue finding 1. Review focus 1–3.

**Files:**
- Modify: `apps/web/components/laundry/create-laundry-order-dialog.tsx`
- Test: `apps/web/lib/laundry-list-page.interaction.test.tsx`

**Interfaces:**
- Consumes: `LaundryFulfillmentFieldsetProps.inputRef` (Task 1). `LaundryCustomerPicker`'s existing `inputRef`.
- Produces: no new export.

- [ ] **Step 1: Write the failing tests**

In `apps/web/lib/laundry-list-page.interaction.test.tsx`, add this helper after `submitCreate`:

```tsx
// react-hook-form's `setFocus` focuses in a zero-delay timeout (7.88).
function runFocusTimer() {
  act(() => vi.advanceTimersByTime(0));
}
```

In `'shows a server field error on the customer field, re-enables submit, and clears it when a customer is chosen again'`, replace:

```tsx
    expect(document.querySelector('#laundry-customer-error')!.textContent).toBe('customerId must be a string');
    expect(dialog()!.querySelector('[role="alert"]')).toBeNull();
```

with:

```tsx
    runFocusTimer();
    expect(document.querySelector('#laundry-customer-error')!.textContent).toBe('customerId must be a string');
    expect(customerField().getAttribute('aria-invalid')).toBe('true');
    expect(customerField().getAttribute('aria-describedby')).toBe('laundry-customer-error');
    expect(document.activeElement).toBe(customerField());
    expect(dialog()!.querySelector('[role="alert"]')).toBeNull();
```

Also, in the same test, insert this line directly before `await act(async () =>` (the `rejectReceive` call):

```tsx
    expect(document.activeElement).not.toBe(customerField()); // focus has to move there
```

Replace the whole test `'shows a server fulfillment error on the fulfillment field, and clears it when fulfillment changes'`, as Task 1 left it, with:

```tsx
  it('shows a server fulfillment error on the fulfillment field, focuses the checked radio, clears it when fulfillment changes, and shows a later one again', async () => {
    const rejectFulfillment = (message: string) =>
      act(async () => nav.rejectReceive({ graphQLErrors: [{ extensions: { originalError: { message: [message] } } }] }));
    start();
    openCreate();
    chooseCustomer();
    await submitCreate();
    expect(document.activeElement).not.toBe(document.querySelector('#laundry-fulfillment-PICKUP'));
    await rejectFulfillment('fulfillmentType must be one of the following values: PICKUP, DELIVERY');
    runFocusTimer();
    const error = () => document.querySelector('#laundry-fulfillment-error');
    expect(error()!.textContent).toBe('fulfillmentType must be one of the following values: PICKUP, DELIVERY');
    expectFulfillmentDescribed(true);
    expect(document.activeElement).toBe(document.querySelector('#laundry-fulfillment-PICKUP'));
    expect(dialog()).not.toBeNull();
    expect(dialog()!.querySelector('[role="alert"]')).toBeNull();
    expect(button('Create order').disabled).toBe(false);
    // The checked radio fires no change; choosing the other one does.
    act(() => document.querySelector<HTMLInputElement>('#laundry-fulfillment-DELIVERY')!.click());
    await act(async () => {}); // react-hook-form re-validates asynchronously
    expect(error()).toBeNull();
    expectFulfillmentDescribed(false);
    // A later server error on the new choice: the ref followed the checked radio.
    act(() => customerField().focus());
    await submitCreate();
    await rejectFulfillment('fulfillmentType should not be empty');
    runFocusTimer();
    expect(error()!.textContent).toBe('fulfillmentType should not be empty');
    expectFulfillmentDescribed(true);
    expect(document.activeElement).toBe(document.querySelector('#laundry-fulfillment-DELIVERY'));
    expect(nav.receiveCalls).toEqual([
      { customerId: 'c1', fulfillmentType: 'PICKUP' },
      { customerId: 'c1', fulfillmentType: 'DELIVERY' },
    ]);
  });
```

Add a new test directly after it:

```tsx
  it('focuses the customer field when both fields fail, whatever order the server lists them in', async () => {
    start();
    openCreate();
    chooseCustomer();
    await submitCreate();
    await act(async () =>
      nav.rejectReceive({
        graphQLErrors: [
          {
            extensions: {
              originalError: {
                message: ['fulfillmentType must be one of the following values: PICKUP, DELIVERY', 'customerId must be a string'],
              },
            },
          },
        ],
      }),
    );
    runFocusTimer();
    expect(document.querySelector('#laundry-customer-error')!.textContent).toBe('customerId must be a string');
    expect(document.querySelector('#laundry-fulfillment-error')!.textContent).toBe(
      'fulfillmentType must be one of the following values: PICKUP, DELIVERY',
    );
    expectFulfillmentDescribed(true);
    expect(document.activeElement).toBe(customerField());
  });
```

In `'stays open on failure with an alert, the fields intact, and submit re-enabled for a retry'`, replace:

```tsx
    await submitCreate();
    await act(async () => nav.rejectReceive(new Error('Network down')));
```

with:

```tsx
    await submitCreate();
    const focused = document.activeElement;
    await act(async () => nav.rejectReceive(new Error('Network down')));
    runFocusTimer();
    expect(document.activeElement).toBe(focused); // a generic failure does not move focus
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/laundry-list-page.interaction.test.tsx`
Expected: FAIL, 3 failed and 31 passed. The customer-error, fulfillment-error and both-fields tests fail on `document.activeElement`. The generic-failure test passes already: it is a **characterization** assertion, since no focus code runs on that path today or after this task.

- [ ] **Step 3: Implement**

In `apps/web/components/laundry/create-laundry-order-dialog.tsx`, replace:

```tsx
      if (fieldErrors) {
        for (const [field, messages] of Object.entries(fieldErrors)) {
          form.setError(field as keyof CreateLaundryOrderFormValues, { message: messages[0], type: 'server' });
        }
      } else {
```

with:

```tsx
      if (fieldErrors) {
        for (const [field, messages] of Object.entries(fieldErrors)) {
          form.setError(field as keyof CreateLaundryOrderFormValues, { message: messages[0], type: 'server' });
        }
        // Every error is set before focus moves (#181). Focus goes to the
        // first field in form order, whatever order the server listed them
        // in. Landing there reads the field, its invalid state and its
        // error, once; field errors carry no live role.
        const first = API_FIELDS.find((field) => field in fieldErrors);
        if (first) form.setFocus(first);
      } else {
```

Replace:

```tsx
          <LaundryFulfillmentFieldset
            name="laundry-fulfillment"
            value={field.value}
```

with:

```tsx
          <LaundryFulfillmentFieldset
            name="laundry-fulfillment"
            inputRef={field.ref}
            value={field.value}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter web exec vitest run lib/laundry-list-page.interaction.test.tsx`
Expected: PASS, 34/34.

- [ ] **Step 5: Commit**

```bash
git status --short
git add apps/web/components/laundry/create-laundry-order-dialog.tsx apps/web/lib/laundry-list-page.interaction.test.tsx
git commit -m "fix(181): focus the first intake field the server rejected"
```

---

### Task 3: One persistent polite status region in the search combobox

Implements Owner decision 3; planning decisions (e)–(g); lock-downs 3 and 4. Issue finding 3. Review focus 4 and 5.

**Files:**
- Modify: `packages/web/src/laundry/laundry-search-combobox.tsx`
- Test: `packages/web/src/laundry/laundry-search-combobox.test.tsx`
- Test: `packages/web/src/laundry/laundry-customer-picker.test.tsx`
- Test: `apps/web/lib/laundry-search-combobox.interaction.test.tsx`
- Test: `apps/web/lib/laundry-list-page.interaction.test.tsx` (the failed-search test)

**Interfaces:**
- Consumes: nothing new.
- Produces: element id `${id}-status` (`role="status"`, class `sr-only`). There is no prop or export change.

- [ ] **Step 1: Write the failing static tests**

In `packages/web/src/laundry/laundry-search-combobox.test.tsx`, in `'shows one line for searching, empty, error and truncation'`, replace:

```tsx
    expect(render({ status: 'error' })).toMatch(/role="alert"[^>]*>Search failed\./);
```

with:

```tsx
    expect(render({ status: 'error' })).toContain('<p class="px-3 py-2 text-sm text-red-600">Search failed.</p>');
    expect(render({ status: 'loading' })).toContain('<p class="px-3 py-2 text-sm text-slate-500">Looking…</p>');
    // One line at most: an empty page is not also "more" (planning decision (e)).
    expect(render({ status: 'ready', truncated: true })).not.toContain('More results exist.');
```

Add a new test after it:

```tsx
  it('keeps one empty polite status region after the popup, and no live role on the popup lines', () => {
    const cases: Partial<LaundrySearchComboboxProps<Option>>[] = [
      { status: 'idle' },
      { status: 'loading' },
      { status: 'ready' },
      { options: [WASH], status: 'ready', truncated: true },
      { status: 'error' },
      { error: 'Pick a service.', status: 'error' },
    ];
    for (const props of cases) {
      const html = render(props);
      expect((html.match(/role="status"/g) ?? []).length).toBe(1);
      expect(html).not.toContain('role="alert"');
      // Outside the `hidden` popup, and empty while the list is closed (static markup is never open).
      expect(html).toContain('</div><p id="svc-status" role="status" class="sr-only"></p>');
    }
  });
```

In `packages/web/src/laundry/laundry-customer-picker.test.tsx`, in `'shows one line for searching, no matches, a failed search, and more matches than shown'`, replace:

```tsx
    expect(render({ status: 'error' })).toMatch(/role="alert"[^>]*>Unable to search customers\./);
```

with:

```tsx
    const failed = render({ status: 'error' });
    expect(failed).toContain('<p class="px-3 py-2 text-sm text-red-600">Unable to search customers.</p>');
    expect(failed).not.toContain('role="alert"');
    expect(failed).toContain('<p id="customer-status" role="status" class="sr-only"></p>');
```

- [ ] **Step 2: Run the static tests to verify they fail**

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-search-combobox.test.tsx src/laundry/laundry-customer-picker.test.tsx`
Expected: FAIL, 3 failed and 9 passed. Two tests fail on the error line's `role="alert"`; the new region test fails on the missing region.

- [ ] **Step 3: Write the failing jsdom tests**

In `apps/web/lib/laundry-search-combobox.interaction.test.tsx`, replace the `Harness` signature and its `options` prop:

```tsx
function Harness({ openOnFocus, status = 'ready' }: { openOnFocus?: boolean; status?: LaundrySearchStatus }) {
```

with:

```tsx
function Harness({
  openOnFocus,
  options = OPTIONS,
  status = 'ready',
  truncated,
}: {
  openOnFocus?: boolean;
  options?: Option[];
  status?: LaundrySearchStatus;
  truncated?: boolean;
}) {
```

and, inside it, replace:

```tsx
        options={OPTIONS}
        status={status}
```

with:

```tsx
        options={options}
        status={status}
        truncated={truncated}
```

Add after `expanded()`:

```tsx
function statusRegion(): HTMLElement {
  return container.querySelector<HTMLElement>('#svc-status')!;
}
```

Add two tests at the end of the `describe` block:

```tsx
  it('announces each search message through one persistent polite region outside the popup', () => {
    act(() => root.render(<Harness status="loading" />));
    const region = statusRegion();
    expect(region.getAttribute('role')).toBe('status');
    expect(region.closest('[hidden]')).toBeNull();
    expect(region.textContent).toBe(''); // closed
    type('a');
    expect(region.textContent).toBe('Looking…');
    type('al'); // still loading: the same node keeps the same text, so nothing is re-announced
    expect(statusRegion()).toBe(region);
    expect(region.textContent).toBe('Looking…');
    act(() => root.render(<Harness options={[]} />));
    expect(region.textContent).toBe('Nothing found.');
    act(() => root.render(<Harness truncated />));
    expect(region.textContent).toBe('More.');
    act(() => root.render(<Harness />));
    expect(region.textContent).toBe(''); // results, nothing more to say
    act(() => root.render(<Harness status="error" />));
    expect(region.textContent).toBe('Search failed.');
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0);
    act(() => root.render(<Harness status="loading" />)); // the user types again after a failure
    type('alp');
    expect(region.textContent).toBe('Looking…');
    expect(statusRegion()).toBe(region);
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
  });

  it('empties the region whenever the list closes, and fills it again when it reopens', () => {
    act(() => root.render(<Harness options={[]} />));
    act(() => field().focus());
    type('a');
    expect(statusRegion().textContent).toBe('Nothing found.');
    press('Escape');
    expect(expanded()).toBe('false');
    expect(statusRegion().textContent).toBe('');
    press('ArrowDown'); // reopens
    expect(expanded()).toBe('true');
    expect(statusRegion().textContent).toBe('Nothing found.');
    act(() => container.querySelector<HTMLButtonElement>('#elsewhere')!.focus()); // blur
    expect(statusRegion().textContent).toBe('');
    act(() => root.render(<Harness truncated />));
    act(() => field().focus());
    type('al');
    expect(statusRegion().textContent).toBe('More.');
    press('ArrowDown');
    press('Enter'); // selection
    expect(selected).toEqual(['a']);
    expect(statusRegion().textContent).toBe('');
    type('Alph');
    expect(statusRegion().textContent).toBe('More.');
    type(''); // cleared text
    expect(statusRegion().textContent).toBe('');
    act(() => root.render(<Harness openOnFocus status="idle" />));
    act(() => field().focus());
    expect(statusRegion().textContent).toBe(''); // idle
  });
```

In `apps/web/lib/laundry-list-page.interaction.test.tsx`, replace the body of `'shows a failed search inline'`:

```tsx
    act(() => vi.advanceTimersByTime(300));
    expect(dialog()!.querySelector('[role="alert"]')!.textContent).toBe('Unable to search customers.');
```

with:

```tsx
    act(() => vi.advanceTimersByTime(300));
    expect(dialog()!.querySelector('#laundry-customer-listbox')!.parentElement!.textContent).toContain(
      'Unable to search customers.',
    );
    const region = document.querySelector('#laundry-customer-status')!;
    expect(region.getAttribute('role')).toBe('status');
    expect(region.textContent).toBe('Unable to search customers.');
    // A search failure is polite; the dialog's own alert is for create failures.
    expect(dialog()!.querySelector('[role="alert"]')).toBeNull();
```

Rename that test to `'shows a failed search inline and announces it politely'`.

- [ ] **Step 4: Run the jsdom tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/laundry-search-combobox.interaction.test.tsx lib/laundry-list-page.interaction.test.tsx`
Expected: FAIL, 3 failed and 39 passed: the two new combobox tests, and the failed-search test, which finds no `#svc-status` or `#laundry-customer-status`.

- [ ] **Step 5: Implement**

In `packages/web/src/laundry/laundry-search-combobox.tsx`:

(1) Extend the header comment. Replace:

```tsx
// Escape closes an open list and stops there, so the surrounding Modal,
// which listens for Escape on `document`, stays open. With the list closed,
// Escape reaches the Modal as usual.
export function LaundrySearchCombobox<T extends { id: string }>({
```

with:

```tsx
// Escape closes an open list and stops there, so the surrounding Modal,
// which listens for Escape on `document`, stays open. With the list closed,
// Escape reaches the Modal as usual.
//
// The search message (searching, empty, more, error) is shown in the popup
// and announced by one status region that is always mounted outside it
// (#181). `hidden` takes the popup out of the accessibility tree, and some
// screen readers announce only changes to a live region that already
// exists. The region holds the message while the list is open and is empty
// otherwise; the popup line carries no live role, so nothing is read twice.
export function LaundrySearchCombobox<T extends { id: string }>({
```

(2) Derive the message. Replace:

```tsx
  const listboxId = `${id}-listbox`;
  const errorId = `${id}-error`;
  const expanded = open && status !== 'idle';
```

with:

```tsx
  const listboxId = `${id}-listbox`;
  const errorId = `${id}-error`;
  const statusId = `${id}-status`;
  const expanded = open && status !== 'idle';
  const message = searchMessage(status, copy, options.length === 0, truncated);
```

(3) Replace the four status lines and add the region. Replace:

```tsx
        {status === 'loading' ? (
          <p role="status" className="px-3 py-2 text-sm text-slate-500">
            {copy.searching}
          </p>
        ) : null}
        {status === 'ready' && options.length === 0 ? (
          <p role="status" className="px-3 py-2 text-sm text-slate-500">
            {copy.empty}
          </p>
        ) : null}
        {status === 'ready' && truncated ? (
          <p role="status" className="px-3 py-2 text-sm text-slate-500">
            {copy.more}
          </p>
        ) : null}
        {status === 'error' ? (
          <p role="alert" className="px-3 py-2 text-sm text-red-600">
            {copy.error}
          </p>
        ) : null}
      </div>
```

with:

```tsx
        {message ? (
          <p className={`px-3 py-2 text-sm ${status === 'error' ? 'text-red-600' : 'text-slate-500'}`}>{message}</p>
        ) : null}
      </div>
      <p id={statusId} role="status" className="sr-only">
        {expanded ? message : ''}
      </p>
```

(4) Add the module-private helper after the component (`contextforge/function-order`: exported functions first, then private ones):

```tsx
// The one search line for a status, or '' for none. An empty result is not
// also "more": that needs a server count above zero with no page.
function searchMessage(
  status: LaundrySearchStatus,
  copy: LaundrySearchComboboxCopy,
  empty: boolean,
  truncated: boolean,
): string {
  if (status === 'loading') return copy.searching;
  if (status === 'error') return copy.error;
  if (status !== 'ready') return '';
  if (empty) return copy.empty;
  return truncated ? copy.more : '';
}
```

- [ ] **Step 6: Run all affected tests to verify they pass**

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-search-combobox.test.tsx src/laundry/laundry-customer-picker.test.tsx src/laundry/laundry-fulfillment-fieldset.test.tsx`
Expected: PASS, 16/16.

Run: `pnpm --filter web exec vitest run lib/laundry-search-combobox.interaction.test.tsx lib/laundry-list-page.interaction.test.tsx lib/laundry-customer-picker.interaction.test.tsx lib/laundry-services-editor.interaction.test.tsx`
Expected: PASS, every test in all four files. The customer picker and services editor files are unchanged regression checks.

- [ ] **Step 7: Commit**

```bash
git status --short
git add packages/web/src/laundry/laundry-search-combobox.tsx packages/web/src/laundry/laundry-search-combobox.test.tsx packages/web/src/laundry/laundry-customer-picker.test.tsx apps/web/lib/laundry-search-combobox.interaction.test.tsx apps/web/lib/laundry-list-page.interaction.test.tsx
git commit -m "fix(181): announce search status through one persistent polite region"
```

---

### Task 4: Verification, browser check and screen-reader pass

No new behavior. This task records evidence for M6.

- [ ] **Step 1: Run the full checks**

Run each command and record the **actual** result (pass or fail, file and test counts, exit code) in the Execution record:
- `pnpm --filter web test`
- `pnpm --filter web lint`
- `pnpm --filter web exec tsc --noEmit`
- `pnpm --filter @clensy/web test`
- `pnpm --filter @clensy/web lint`
- `pnpm --filter @clensy/web build`

Expected: all pass. A failure is fixed in the task that owns the code, re-run, and recorded with both results.

- [ ] **Step 2: Confirm the unchanged paths**

Run: `git diff --stat main...HEAD -- apps/api packages/client packages/ui packages/validation packages/web/src/i18n`
Expected: empty. The API suites are recorded **NOT RUN**: this slice changes no API code, and they are not claimed as covered.

- [ ] **Step 3: Browser check and screen-reader pass**

With the dev stack running and seeded data, sign in as an OPS_MANAGER and open "+ New Laundry Order" on `/app/laundry`.

*Visual (no change expected), at 1280 px and at 375 px:*
- The customer list's "Searching…", "No customers match." and "More customers match…" lines look as before.
- The fulfillment rows look as before.
- The field layout has no extra gap where the hidden region sits.
- Also open the services editor on an order whose services can still be edited, and check its search lines look as before.

*Screen reader (planning decision (h)):* use VoiceOver (Safari) or NVDA (Firefox or Chrome). Record which.
1. Tab to the fulfillment radios. Each is announced as its title ("Customer pickup" or "Delivery"), with its description read once.
2. Type a customer name. "Searching…" is announced once. Then type a name with no match: "No customers match." is announced. Type a short common prefix that returns more than 20 matches, if the seed data allows: "More customers match…" is announced.
3. Stop the API (or block `/graphql` in devtools) and type again. "Unable to search customers." is announced, politely, once.
4. A server field error cannot be produced from the UI, because a radio is always checked and only listed customers can be chosen. Record steps 1–3. Record the server-error announcement as covered by the jsdom focus tests plus step 1's reading of a focused radio, **not** as a manual result.

If no screen reader is available to the implementer, record steps 1–3 as **NOT RUN (no screen reader)**. The owner runs them, alone or during #161's keyboard pass, before #181 is closed. Record each check separately from the automated tests. Do not substitute another check for one that was not run.

- [ ] **Step 4: Commit the Execution record**

```bash
git add docs/superpowers/plans/2026-10-16-intake-screen-reader-polish-plan.md
git commit -m "docs(181): record the M6 verification"
```

---

## Traceability

| Requirement | Source | Task |
| --- | --- | --- |
| Fulfillment error announced once; group marked invalid while it shows | #181 acceptance 1; Owner decision 1 | 1 (markup), 2 (focus), 4 (manual) |
| Customer server error follows the same pattern | #181 proposal 1 ("so customer and fulfillment errors behave the same"); Owner decision 1 | 2 |
| Generic failures stay on the dialog alert and do not move focus | Owner decision 1; #160 plan Global Constraints | 2 (characterization) |
| Each radio's name is its title; description read once | #181 acceptance 2; Owner decision 2 | 1, 4 (manual) |
| Search lines announced on change, without duplicates | #181 acceptance 3; Owner decision 3 | 3, 4 (manual) |
| Region reflects existing status; clears on close, selection, dismissal | Owner design approval | 3 |
| Static and jsdom tests updated; no visual or copy change | #181 acceptance 4 | 1–3, 4 (browser) |
| Intake remains the §8.4.4 dialog; no semantics change | Spec §8.4.4 | Global constraints |

## Deferred (not in this plan)

- Announcing result counts ("3 customers found"). `t()` has no interpolation, and #160's M5 already deferred it.
- Form dialogs closable mid-submit: [#180](https://github.com/rexescario-dev/clensy-platform/issues/180).
- Any change to `FormField`'s error pattern in `@clensy/ui`. Owner decision 1 aligns this dialog with it instead.
