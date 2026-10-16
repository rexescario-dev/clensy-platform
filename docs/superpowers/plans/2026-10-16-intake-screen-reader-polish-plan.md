# Intake Screen-Reader Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Accepted (revision 3)** at M5, 2026-10-16. M6 complete ([Execution record](#execution-record)); M7 **Approved for merge** (independent review); M8 N/A; M9 complete; merged in PR [#190](https://github.com/rexescario-dev/clensy-platform/pull/190) (`9fd0ef6`); M10 validated (after merge, in a follow-up docs PR). Browser check and screen-reader pass **NOT RUN** (owner action before #181 closes). |
| M5 decision | **Accepted** — 2026-10-16, revision 3 (`9d43bea`), by the owner, after a third pass: "M5: Accept. The plan is ready to proceed to M6 native execution." M5-5, M5-6 and M5-7 are resolved. One execution-time check, not a blocker: verify that the query-recording mock exposes the asserted variables in the documented shape, and that the popup assertions target the actual visible result container. Conditions: record actual test results rather than treating predicted red-phase counts as pass criteria; investigate unexpected failures; do not broaden scope. M7 MUST be a fresh, independent review. The acceptance does not authorize a push or any other external action. |
| M5 history | First pass (2026-10-16, owner): **Returned for Revision**, findings M5-1 to M5-4, resolved in [Revision 2 (M5 review 1)](#revision-2-m5-review-1). Second pass (2026-10-16, owner, reviewed `e37ca44`): **Returned for Revision**, findings M5-5 to M5-7. The reviewer recorded M5-1 to M5-4 as satisfactory. M5-5 to M5-7 are resolved in [Revision 3 (M5 review 2)](#revision-3-m5-review-2). The owner directs **native** execution once accepted, with the required fresh, independent M7 review. |
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
| Red-phase evidence | Each "verify it fails" step gives the **behavioral** failure to expect and a **predicted** count. The count is not a pass criterion. At every red phase the implementer records the **actual** totals (failed / passed) and each failing test's name and first failure message in the Execution record. If the actual result differs from the prediction (another test fails, a test fails for another reason, or a test passes early), stop and find out why before writing the implementation. Record the explanation next to the result. |
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
  - The popup keeps its four conditional lines exactly as they are. Only their `role` attributes are removed.
  - A separate announcement message is derived from the same props (status, options, truncated), with no new state.
  - A `<p role="status" class="sr-only">` that is always mounted, outside the popup, holds that message while the list is expanded, and is empty otherwise.

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
  - **The `fieldErrors` contract (M5-7).**
    - `fieldErrors` is the normalized map `normalizeApiValidationErrors(error, API_FIELDS)` returns: `FieldErrors = Record<string, string[]>` (`packages/validation/src/types.ts`).
    - It is keyed by the leading token of each server constraint message, and **only** tokens in `knownFields` are kept (`packages/validation/src/normalize.ts`: `if (!field || !knownFields.includes(field)) continue`). Every kept key has at least one message.
    - The dialog passes `API_FIELDS`, whose entries are exactly the form's field names (`keyof CreateLaundryOrderFormValues`). So every key is a form field name, and the existing `field as keyof CreateLaundryOrderFormValues` cast is sound.
    - Focus selection does not rely on that alone: it iterates `API_FIELDS`, never the map's keys, so a key outside the form could never be chosen.
    - A server message for an unknown field (for example `notes must be a string`) is therefore dropped by the normalizer and ignored for focus. If only unknown fields come back, `normalizeApiValidationErrors` returns `undefined` and the dialog takes the generic `role="alert"` path, unchanged.
    - The reverse-order test (Task 2) includes such a message.
  - react-hook-form 7.88's `setFocus` focuses inside `setTimeout(0)` (read in `dist/index.esm.mjs` at planning time). The focus therefore runs after React commits the error markup, so the error id already exists when focus lands.
  - The jsdom suite uses fake timers, so the tests advance `vi.advanceTimersByTime(0)` inside `act` before asserting focus.
  - `setError(..., { shouldFocus: true })` was not used: it focuses synchronously, in the middle of the loop.
- **(e) The visible lines are unchanged; the announcement has its own priority rule** (revised for M5-1).
  - The popup keeps today's four independent conditions. A `ready` result with no options **and** `truncated` still shows both the empty and the more lines, and a static characterization test pins that.
  - The region carries one message, chosen in this order: loading → "Searching…"; error → the error line; ready with no options → the empty line; ready and truncated → the more line; otherwise empty.
  - For the empty-and-truncated combination, the region announces only the empty line. That line tells the user there is nothing to pick now, and the more line adds nothing they can act on in an empty list. A jsdom rendering test pins it.
  - The only markup change to a visible line is the removed `role` attribute.
- **(f) Region markup:**
  - `<p id="${id}-status" role="status" class="sr-only">`, placed right after the popup `<div>` and before the field error.
  - `role="status"` implies `aria-live="polite"` and `aria-atomic="true"`, so no extra attributes are added.
  - `sr-only` is absolutely positioned, so it adds no flex gap to the field's layout.
- **(g) The region is empty whenever the list is not expanded** (`expanded` is already `open && status !== 'idle'`). That covers Escape, blur, selection, a cleared text, and the idle status. Reopening (ArrowDown, typing, or focus with `openOnFocus`) fills it again from the same derived announcement.
  - Keystrokes while a search stays `loading` leave the text unchanged, so nothing is re-announced.
  - When results arrive with options and no truncation, the region empties. No result count is announced (out of scope).
- **(h) Manual screen-reader pass.** This is #181's first three acceptance criteria. DOM tests cannot prove what a screen reader announces.
  - Task 4 Step 3 gives the script.
  - If the M6 implementer has no screen reader, M6 records the pass **NOT RUN** with that reason. The owner runs it, alone or during #161's keyboard pass.
  - #181 is not closed until the pass is recorded. The PR may still merge on the owner's decision; that is the owner's call at closeout, not this plan's.
- **Inherited by the services editor (informative).** The services editor uses the same combobox, so it gets fix 3 with its own copy. A grep at planning time found no services or order-page test that queries a live role on a search line. `alerts()` in `laundry-services-editor.interaction.test.tsx` collects `[role="alert"]` for pricing messages only. Removing the search error's `role="alert"` can only remove an entry that no test expects.

## Revision 2 (M5 review 1)

The owner's first M5 pass (2026-10-16) returned the plan for revision, with no redesign. Each finding and its resolution:

| Finding | Severity | Resolution |
| --- | --- | --- |
| **M5-1** Visible popup changed: `searchMessage()` dropped the more line for an empty page that is also truncated. | Medium | **Changed.** The popup keeps its four conditional lines exactly; Task 3 Step 5 (3) removes only their `role` attributes. A separate `searchAnnouncement()` feeds the region only, with the priority rule in planning decision (e). A static characterization test pins both visible lines for that case. A jsdom rendering test pins the region's single message. |
| **M5-2** The transition tests forced states by re-rendering, but claimed user behavior. | Medium | **Changed.** Task 3 now has explicit test layers. (1) Static markup. (2) A combobox **rendering** test, labelled as props → announcement, including the priority rule and idle. (3) A combobox **interaction** test with fixed props, where only typing, Escape, ArrowDown, Enter, blur and clearing open and close the list. (4) A list-page **search lifecycle** test through the real hook, its 300 ms debounce (fake timers) and the query mock: Searching… → no match → more matches → failure → Searching… for the next search, all in one node. |
| **M5-3** Prove the ref follows the checked radio. | Medium | **Changed.** Task 2's fulfillment test now asserts, before the second submit, that `DELIVERY` is checked, `PICKUP` is not, and the first error and its ids are gone. It moves focus to the customer field so the next assertion can only pass if focus moves. After the second rejection it asserts the new message and ids, that `DELIVERY` is still checked, that focus is on `DELIVERY`, and that focus is not on `PICKUP`. The `customerId`-first test (server lists fulfillment first) is retained. |
| **M5-4** Predicted red-phase counts are brittle. | Low | **Changed.** A **Red-phase evidence** row in the header makes the counts predictions, not pass criteria. Every red step now names the behavioral failure to expect. The implementer records actual totals and failure messages, and investigates any difference before implementing. |

## Revision 3 (M5 review 2)

The owner's second M5 pass (2026-10-16, `e37ca44`) recorded M5-1 to M5-4 as satisfactory and returned three test-design and contract points:

| Finding | Severity | Resolution |
| --- | --- | --- |
| **M5-5** The rendering test mixed interaction state (`type('a')`, `type('al')`) with props-driven changes, and leaned on Harness defaults across `root.render`. | Medium | **Changed.** Task 3's rendering test now does only props → announcement.<br>• **Setup:** it opens the list once, by focus with `openOnFocus`, with no text typed.<br>• **Renders:** a local `renderSearch` passes `openOnFocus`, `options`, `status` and `truncated` explicitly on every render, so nothing falls back to a default. The component type and position never change, so React keeps the component and its `open` state.<br>• **Assertions:** each case asserts `aria-expanded="true"`, the identical region node, the message, one `role="status"` and no `role="alert"`. Idle collapses and a later `loading` re-expands without any user action.<br>• **Typing while loading** moved to the lifecycle test. Opening and closing are tested only in the interaction test. |
| **M5-6** The lifecycle test checked only the announcement, not that each state came from the intended request and response. | Medium | **Changed.** After each debounce the test asserts the last query: `skip: false`, the exact `iLike` pattern, `limit: 20`. Then it asserts the response-driven UI:<br>• **No match:** no options and the visible no-match line.<br>• **Truncated:** exactly the one node from the `%an%` response (`Ana Reyes555-0101`), the visible more line, and no no-match line.<br>• **Failure:** no options and the visible error line.<br>• **While each debounce runs:** no options are left over from the previous search.<br>• **Final in-flight search:** the error line disappears as soon as the next search starts, typing on keeps the same node and text, the `%anabe%` query is issued, and the popup shows Searching… with no stale error. |
| **M5-7** The focus-order contract relied on an unstated `fieldErrors` shape. | Low | **Changed.** Planning decision (d) now states the contract:<br>• `fieldErrors` is the normalized `Record<string, string[]>` keyed only by `API_FIELDS` names (the normalizer drops unknown fields).<br>• Focus selection iterates `API_FIELDS`, so only a form field can be focused.<br>• An all-unknown response takes the unchanged generic path.<br>The Task 2 code comment says the same. The reverse-order test now also lists an unknown field first (`notes must be a string`) and asserts that it is not shown and that the generic alert stays absent. |

## Global constraints

- **SHALL NOT** change any copy, visible class string, layout or row styling. The visible search lines keep their four existing conditions, their order and their classes: `px-3 py-2 text-sm text-slate-500`, or `text-red-600` for the error. The only change to them is the removed `role` attribute.
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
4. **A failed search, then the user types again.** Through the real search hook, debounce and query mock, the region switches from the error to "Searching…", and no stale error stays announced. Task 3, list-page lifecycle test.
5. **More typing while a search is still loading.** The same region node keeps the same text, so nothing is re-announced and no second region appears. Task 3, list-page lifecycle test (`anab` → `anabe`).

## File map

| File | Change | Task |
| --- | --- | --- |
| `packages/web/src/laundry/laundry-fulfillment-fieldset.tsx` | Radio naming, descriptions, invalid state, `inputRef` | 1 |
| `packages/web/src/laundry/laundry-fulfillment-fieldset.test.tsx` | Two tests changed | 1 |
| `apps/web/lib/laundry-list-page.interaction.test.tsx` | Fulfillment error assertions (Task 1); focus assertions and one new test (Task 2); search-error query and one new lifecycle test (Task 3) | 1, 2, 3 |
| `apps/web/components/laundry/create-laundry-order-dialog.tsx` | `inputRef`, focus the first errored field | 2 |
| `packages/web/src/laundry/laundry-search-combobox.tsx` | Derived message, persistent status region, no live roles on lines | 3 |
| `packages/web/src/laundry/laundry-search-combobox.test.tsx` | One test changed, one added | 3 |
| `packages/web/src/laundry/laundry-customer-picker.test.tsx` | One test changed | 3 |
| `apps/web/lib/laundry-search-combobox.interaction.test.tsx` | Harness props; a rendering test and an interaction test added | 3 |
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
Expected: FAIL. The behavior to see: the first changed test fails because the radios have no `aria-labelledby`; the second fails because the fieldset is still described by the error. Predicted: 2 failed, 2 passed. Record the actual totals and failure messages (see Red-phase evidence).

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
Expected: FAIL. The fieldset's `aria-describedby` is now `laundry-fulfillment-fixed`, but the test expects `laundry-fulfillment-fixed laundry-fulfillment-error`. Predicted: 1 failed. Record the actual result.

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
    const pickup = () => document.querySelector<HTMLInputElement>('#laundry-fulfillment-PICKUP')!;
    const delivery = () => document.querySelector<HTMLInputElement>('#laundry-fulfillment-DELIVERY')!;
    act(() => delivery().click());
    await act(async () => {}); // react-hook-form re-validates asynchronously
    // Before the second submit: DELIVERY is the checked radio and the first error is gone.
    expect(delivery().checked).toBe(true);
    expect(pickup().checked).toBe(false);
    expect(error()).toBeNull();
    expectFulfillmentDescribed(false);
    // Focus starts elsewhere, so the assertion below can only pass if focus moves.
    act(() => customerField().focus());
    await submitCreate();
    await rejectFulfillment('fulfillmentType should not be empty');
    runFocusTimer();
    // The new error is applied, and focus followed the ref to the newly checked radio.
    expect(error()!.textContent).toBe('fulfillmentType should not be empty');
    expectFulfillmentDescribed(true);
    expect(delivery().checked).toBe(true);
    expect(document.activeElement).toBe(delivery());
    expect(document.activeElement).not.toBe(pickup());
    expect(nav.receiveCalls).toEqual([
      { customerId: 'c1', fulfillmentType: 'PICKUP' },
      { customerId: 'c1', fulfillmentType: 'DELIVERY' },
    ]);
  });
```

Add a new test directly after it:

```tsx
  it('focuses the customer field when both fields fail, whatever order the server lists them in, ignoring unknown fields', async () => {
    start();
    openCreate();
    chooseCustomer();
    await submitCreate();
    expect(document.activeElement).not.toBe(customerField()); // focus has to move there
    await act(async () =>
      nav.rejectReceive({
        graphQLErrors: [
          {
            extensions: {
              originalError: {
                // An unknown field first, then fulfillment, then customer: the reverse of form order.
                message: [
                  'notes must be a string',
                  'fulfillmentType must be one of the following values: PICKUP, DELIVERY',
                  'customerId must be a string',
                ],
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
    expect(dialog()!.textContent).not.toContain('notes must be a string'); // dropped by the normalizer
    expect(dialog()!.querySelector('[role="alert"]')).toBeNull(); // field errors, not the generic path
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
Expected: FAIL. The behavior to see: the customer-error, fulfillment-error and both-fields tests fail on a `document.activeElement` assertion, because nothing moves focus after a server rejection yet. The fulfillment test must fail at its **first** focus assertion (`PICKUP`), not earlier. A failure before that point means the test or Task 1 is wrong; investigate. The generic-failure test passes already. It is a **characterization** assertion: no focus code runs on that path, today or after this task. Predicted: 3 failed, 31 passed. Record the actual totals and failure messages.

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
        // error, once; field errors carry no live role. `fieldErrors` holds
        // only `API_FIELDS` keys (the normalizer drops unknown fields), and
        // the search runs over `API_FIELDS`, so only a form field is focused.
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
- Test: `apps/web/lib/laundry-list-page.interaction.test.tsx` (the failed-search test, and a new lifecycle test)

**Interfaces:**
- Consumes: nothing new.
- Produces: element id `${id}-status` (`role="status"`, class `sr-only`). There is no prop or export change.

**Test layers** (M5-1, M5-2):

| Layer | File | What it proves |
| --- | --- | --- |
| Static markup | `packages/web` combobox and picker tests | The visible lines are unchanged except for the removed role, including both lines for empty-and-truncated. There is exactly one empty region, placed after the popup. |
| Rendering (props → announcement) | combobox jsdom, rendering test | The status-to-message mapping and its priority rule. The list is opened once, by focus with `openOnFocus` and no typing. After that only search props change, each render passing every prop explicitly, and the region node is asserted identical throughout. It deliberately does not claim to be user behavior. |
| Interaction | combobox jsdom, interaction test | With props fixed, typing, Escape, reopening, selection, blur and clearing open and close the list. The same region node fills and empties with it. This is the only layer that tests opening and closing. |
| Search lifecycle | list-page jsdom, lifecycle test | Through the real `useLaundryCustomerSearch` hook, its 300 ms debounce and the customers-query mock: Searching… → no match → more matches → failure → Searching… for the next search, all in one node. Each settled state is tied to its own request (asserted `iLike` and `limit: 20`) and its own response (the listed options and the visible popup line). The final in-flight search is shown to be issued, with no stale error left. |

- [ ] **Step 1: Write the failing static tests**

In `packages/web/src/laundry/laundry-search-combobox.test.tsx`, in `'shows one line for searching, empty, error and truncation'`, replace:

```tsx
    expect(render({ status: 'error' })).toMatch(/role="alert"[^>]*>Search failed\./);
```

with:

```tsx
    // The lines keep their markup; only the live role goes (#181).
    expect(render({ status: 'error' })).toContain('<p class="px-3 py-2 text-sm text-red-600">Search failed.</p>');
    expect(render({ status: 'loading' })).toContain('<p class="px-3 py-2 text-sm text-slate-500">Looking…</p>');
    // Characterization: an empty page that is also truncated still shows both lines (planning decision (e)).
    const emptyAndMore = render({ status: 'ready', truncated: true });
    expect(emptyAndMore).toContain('<p class="px-3 py-2 text-sm text-slate-500">Nothing found.</p>');
    expect(emptyAndMore).toContain('<p class="px-3 py-2 text-sm text-slate-500">More results exist.</p>');
```

Add a new test after it:

```tsx
  it('keeps one empty polite status region after the popup, and no live role on the popup lines', () => {
    const cases: Partial<LaundrySearchComboboxProps<Option>>[] = [
      { status: 'idle' },
      { status: 'loading' },
      { status: 'ready' },
      { status: 'ready', truncated: true },
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
Expected: FAIL. The behavior to see: the error line still carries `role="alert"` (in the two changed tests), and there is no `#svc-status` region (the new test). The empty-and-truncated characterization assertions already pass. If they fail, stop: they describe today's markup. Predicted: 3 failed, 9 passed. Record the actual totals and failure messages.

- [ ] **Step 3: Write the failing jsdom tests**

In `apps/web/lib/laundry-search-combobox.interaction.test.tsx`, replace the `Harness` signature:

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

Inside it, replace:

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

Add two tests at the end of the `describe` block. The first is the **rendering** layer: it opens the list once, then drives the search state through props.

```tsx
  it('maps each search state to one region message while the list stays open (rendering: props only)', () => {
    // Every render passes every search prop and the same `openOnFocus`, so
    // nothing falls back to a Harness default. The element type and position
    // never change, so React keeps the same component, and its `open` state,
    // across `root.render`. The test asserts that the region node is kept too.
    function renderSearch({ options = OPTIONS, status, truncated = false }: { options?: Option[]; status: LaundrySearchStatus; truncated?: boolean }) {
      act(() => root.render(<Harness openOnFocus options={options} status={status} truncated={truncated} />));
    }
    renderSearch({ status: 'loading' });
    const region = statusRegion();
    expect(region.getAttribute('role')).toBe('status');
    expect(region.closest('[hidden]')).toBeNull();
    expect(expanded()).toBe('false');
    expect(region.textContent).toBe(''); // not open yet
    // Setup: open the list once, by focus (`openOnFocus`), without typing.
    // Opening and closing by user action belongs to the interaction test.
    act(() => field().focus());
    const cases: [Parameters<typeof renderSearch>[0], string][] = [
      [{ status: 'loading' }, 'Looking…'],
      [{ options: [], status: 'ready' }, 'Nothing found.'],
      // Priority rule: an empty page that is also truncated announces only the empty line.
      [{ options: [], status: 'ready', truncated: true }, 'Nothing found.'],
      [{ status: 'ready', truncated: true }, 'More.'],
      [{ status: 'ready' }, ''], // results, nothing more to say
      [{ status: 'error' }, 'Search failed.'],
      [{ status: 'loading', truncated: true }, 'Looking…'],
      [{ status: 'error', truncated: true }, 'Search failed.'],
    ];
    for (const [props, message] of cases) {
      renderSearch(props);
      expect(expanded()).toBe('true');
      expect(statusRegion()).toBe(region);
      expect(region.textContent).toBe(message);
      expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
      expect(container.querySelectorAll('[role="alert"]')).toHaveLength(0);
    }
    renderSearch({ status: 'idle' });
    expect(expanded()).toBe('false'); // idle is never expanded
    expect(region.textContent).toBe('');
    renderSearch({ status: 'loading' }); // `open` was never cleared, so only idle collapsed it
    expect(expanded()).toBe('true');
    expect(statusRegion()).toBe(region);
    expect(region.textContent).toBe('Looking…');
  });
```

The second is the **interaction** layer. Props stay fixed (`truncated`, so an open list always has something to announce), and only user actions open and close the list:

```tsx
  it('keeps one region node through typing, closing, reopening and selection, empty whenever the list is closed', () => {
    act(() => root.render(<Harness truncated />));
    const region = statusRegion();
    act(() => field().focus());
    expect(expanded()).toBe('false'); // this picker opens on typing, not on focus
    expect(region.textContent).toBe('');
    type('a');
    expect(expanded()).toBe('true');
    expect(region.textContent).toBe('More.');
    press('Escape'); // dismissal
    expect(expanded()).toBe('false');
    expect(region.textContent).toBe('');
    press('ArrowDown'); // reopens, with the first option active
    expect(expanded()).toBe('true');
    expect(region.textContent).toBe('More.');
    press('Enter'); // selection
    expect(selected).toEqual(['a']);
    expect(expanded()).toBe('false');
    expect(region.textContent).toBe('');
    type('Alph');
    expect(region.textContent).toBe('More.');
    act(() => container.querySelector<HTMLButtonElement>('#elsewhere')!.focus()); // blur
    expect(expanded()).toBe('false');
    expect(region.textContent).toBe('');
    act(() => field().focus());
    type('Al');
    expect(region.textContent).toBe('More.');
    type(''); // a cleared text closes this picker
    expect(expanded()).toBe('false');
    expect(region.textContent).toBe('');
    expect(statusRegion()).toBe(region);
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1);
  });
```

In `apps/web/lib/laundry-list-page.interaction.test.tsx`, rename `'shows a failed search inline'` to `'shows a failed search inline and announces it politely'`, and replace its last two lines:

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

Add the **search lifecycle** test directly after it:

```tsx
  it('announces the search lifecycle in one region, and a failed search gives way to Searching… when the next one starts', () => {
    // Each response is keyed by the exact `iLike` pattern, so a state can only
    // come from the response for the text being searched.
    nav.customerResults['%an%'] = { nodes: [ANA], totalCount: 21 }; // 21 matches, 1 on this page
    nav.customerResults['%ana%'] = { error: new Error('down'), nodes: [] };
    start();
    openCreate();
    const region = document.querySelector('#laundry-customer-status')!;
    const popup = () => dialog()!.querySelector('#laundry-customer-listbox')!.parentElement!;
    const searched = (pattern: string) =>
      expect(nav.customerQueries.at(-1)).toMatchObject({
        skip: false,
        variables: { filter: { fullName: { iLike: pattern } }, paging: { limit: 20 } },
      });
    expect(region.textContent).toBe('');

    typeCustomer('zz'); // the preset empty response
    expect(region.textContent).toBe('Searching…'); // debouncing
    expect(customerOptions()).toHaveLength(0);
    act(() => vi.advanceTimersByTime(300));
    searched('%zz%');
    expect(customerOptions()).toHaveLength(0);
    expect(popup().textContent).toContain('No customers match.');
    expect(region.textContent).toBe('No customers match.');

    typeCustomer('an');
    expect(region.textContent).toBe('Searching…');
    expect(customerOptions()).toHaveLength(0); // nothing left over from "zz"
    act(() => vi.advanceTimersByTime(300));
    searched('%an%');
    // The truncated state comes from this response: its one node is listed, and totalCount 21 > 1.
    expect(customerOptions().map((option) => option.textContent)).toEqual(['Ana Reyes555-0101']);
    expect(popup().textContent).toContain('More customers match. Type more of the name to narrow the search.');
    expect(popup().textContent).not.toContain('No customers match.');
    expect(region.textContent).toBe('More customers match. Type more of the name to narrow the search.');

    typeCustomer('ana');
    expect(region.textContent).toBe('Searching…');
    expect(customerOptions()).toHaveLength(0);
    act(() => vi.advanceTimersByTime(300));
    searched('%ana%');
    expect(customerOptions()).toHaveLength(0);
    expect(popup().textContent).toContain('Unable to search customers.');
    expect(region.textContent).toBe('Unable to search customers.');

    typeCustomer('anab'); // the next search starts
    expect(region.textContent).toBe('Searching…');
    expect(popup().textContent).not.toContain('Unable to search customers.');
    typeCustomer('anabe'); // typing on while it loads: same node, same text, nothing re-announced
    expect(document.querySelector('#laundry-customer-status')).toBe(region);
    expect(region.textContent).toBe('Searching…');
    act(() => vi.advanceTimersByTime(300));
    searched('%anabe%'); // the next query is issued; it has no response, so it stays in flight
    expect(customerOptions()).toHaveLength(0);
    expect(popup().textContent).toContain('Searching…');
    expect(popup().textContent).not.toContain('Unable to search customers.');
    expect(region.textContent).toBe('Searching…');
    expect(document.querySelector('#laundry-customer-status')).toBe(region);
    expect(dialog()!.querySelectorAll('[role="status"]')).toHaveLength(1);
    expect(dialog()!.querySelector('[role="alert"]')).toBeNull();
  });
```

- [ ] **Step 4: Run the jsdom tests to verify they fail**

Run: `pnpm --filter web exec vitest run lib/laundry-search-combobox.interaction.test.tsx lib/laundry-list-page.interaction.test.tsx`
Expected: FAIL. The behavior to see: the two new combobox tests, the renamed failed-search test and the lifecycle test each fail at their first region lookup, because there is no `#svc-status` or `#laundry-customer-status` yet (a `null` dereference or a `null` attribute). Every other test passes. Predicted: 4 failed, 39 passed. Record the actual totals and failure messages. A new test that fails anywhere other than the region lookup must be investigated before Step 5.

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
// Search messages are announced by one status region that is always
// mounted outside the popup (#181). `hidden` takes the popup out of the
// accessibility tree, and some screen readers announce only changes to a
// live region that already exists. The region holds one message while the
// list is open and is empty otherwise. The popup's lines are unchanged but
// carry no live role, so nothing is read twice.
export function LaundrySearchCombobox<T extends { id: string }>({
```

(2) Derive the announcement. Replace:

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
  const announcement = searchAnnouncement(status, copy, options.length === 0, truncated);
```

(3) Remove the live roles from the four lines and add the region. Replace:

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
        {status === 'loading' ? <p className="px-3 py-2 text-sm text-slate-500">{copy.searching}</p> : null}
        {status === 'ready' && options.length === 0 ? (
          <p className="px-3 py-2 text-sm text-slate-500">{copy.empty}</p>
        ) : null}
        {status === 'ready' && truncated ? <p className="px-3 py-2 text-sm text-slate-500">{copy.more}</p> : null}
        {status === 'error' ? <p className="px-3 py-2 text-sm text-red-600">{copy.error}</p> : null}
      </div>
      <p id={statusId} role="status" className="sr-only">
        {expanded ? announcement : ''}
      </p>
```

(Line wrapping is whatever the formatter produces. Only the removed `role` attributes and the added region are intended.)

(4) Add the module-private helper after the component (`contextforge/function-order`: exported functions first, then private ones):

```tsx
// The one message the status region announces for a search state, or ''.
// The popup can show both the empty and the more line (a server count above
// zero with an empty page); the region then announces only the empty line,
// the one that says there is nothing to pick.
function searchAnnouncement(
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
Expected: PASS for every test in all four files: combobox 8, list page 35, and the customer-picker and services-editor files unchanged, as regression checks. Record the actual totals.

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
| Search lines announced on change, without duplicates | #181 acceptance 3; Owner decision 3 | 3 (rendering, interaction, lifecycle), 4 (manual) |
| Visible popup lines unchanged apart from the removed role | Owner design approval; M5-1 | 3 (static characterization) |
| Region reflects existing status; clears on close, selection, dismissal | Owner design approval | 3 |
| Static and jsdom tests updated; no visual or copy change | #181 acceptance 4 | 1–3, 4 (browser) |
| Intake remains the §8.4.4 dialog; no semantics change | Spec §8.4.4 | Global constraints |

## Deferred (not in this plan)

- Announcing result counts ("3 customers found"). `t()` has no interpolation, and #160's M5 already deferred it.
- Form dialogs closable mid-submit: [#180](https://github.com/rexescario-dev/clensy-platform/issues/180).
- Any change to `FormField`'s error pattern in `@clensy/ui`. Owner decision 1 aligns this dialog with it instead.

## Execution record

### M6 — 2026-10-16

Executed inline (Native), in plan order, on `feat/181-intake-screen-reader-polish` from the M5 acceptance commit `7aad64a`. Every `Expected:` line was compared with the real output. Red-phase counts are the **actual** results; each matched the prediction.

| Task | Commit | Red (actual) | Green (actual) |
| --- | --- | --- | --- |
| 1 | `1d9735c` | Static: 2 failed, 2 passed. The radios had no `aria-labelledby`, and the fieldset was still described by the error. jsdom (`-t "server fulfillment error"`): 1 failed, because the fieldset's `aria-describedby` was `laundry-fulfillment-fixed`. | Static 4/4; list page 33/33 |
| 2 | `863612b` | 3 failed, 31 passed. Each failed at its `document.activeElement` assertion, where focus was still on the dialog element. The fulfillment test failed at its **first** focus assertion (`PICKUP`, line 770), as the plan required. | List page 34/34 |
| 3 | `e8bf893` | Static: 3 failed, 9 passed. The error line still had `role="alert"`, and the new test found 0 `role="status"`. jsdom: 4 failed, 39 passed. All four failed at the first region lookup (`null` `getAttribute` / `textContent`). | Static 16/16; jsdom 89/89 across the combobox (8), list page (35), customer-picker and services-editor files |

**Characterization tests.** Each passes before the change. Each was shown to fail against a deliberate break made outside the committed change, then reverted:
- Task 2, the generic failure keeps focus: adding `form.setFocus('customerId')` to the generic branch made `'stays open on failure …'` fail.
- Task 3, the empty-and-truncated popup still shows both lines: hiding the more line when there are no options made `'shows one line for searching, empty, error and truncation'` fail.

**Rulings (deviations from the plan's text):**
1. Task 3 Step 2 said the empty-and-truncated characterization assertions "already pass" at red. They come after the first failing assertion in the same test, so the red run could not observe them. The mutation above is their evidence instead.

**M5 execution-time check:**
- **Mock shape:** `nav.customerQueries` records each options object passed to `useCustomersQuery`, with `variables.filter.fullName.iLike` and `variables.paging.limit` (the mock in `laundry-list-page.interaction.test.tsx`). That is the shape the lifecycle test asserts.
- **Popup container:** `popup()` is the listbox's parent element, which is the popup `<div>` holding the visible lines in `LaundrySearchCombobox`.

Both confirmed.

### Task 4 — verification (actual results)

| Check | Result |
| --- | --- |
| `pnpm --filter web test` | PASS — 48 files, 2184 tests, exit 0 |
| `pnpm --filter web lint` | PASS — exit 0, no warnings |
| `pnpm --filter web exec tsc --noEmit` | PASS — exit 0 |
| `pnpm --filter @clensy/web test` | PASS — 16 files, 418 tests, exit 0 |
| `pnpm --filter @clensy/web lint` | PASS — exit 0, no warnings |
| `pnpm --filter @clensy/web build` | PASS — exit 0 |
| `git diff --stat main...HEAD -- apps/api packages/client packages/ui packages/validation packages/web/src/i18n` | Empty |
| API suites | **NOT RUN** — no API code changes in this slice; not claimed as covered |

**Browser check: NOT RUN.**
- **Why:** the local Docker `web` container was built from an image about 10 hours old, so it does not serve this branch.
- **Why not another port:** the API's CORS origin is `WEB_ORIGIN` (default `http://localhost:3001`), so a dev server on another port cannot sign in.
- **Why not 3001:** using 3001 would mean stopping or rebuilding the owner's running container, which needs the owner's approval (as in #162).
- **Covered meanwhile by:** the static tests that pin the unchanged class strings and markup. They are not a substitute for the visual check.

**Screen-reader pass (planning decision (h)): NOT RUN** — no screen reader is available to the implementer. Steps 1–3 of Task 4 Step 3 are for the owner, alone or during #161's keyboard pass, before #181 is closed.

### M7 — Approved for merge (2026-10-16)

**Reviewer:** a fresh, independent agent on the most capable model (Opus 5.5) reviewed `8c7a11b..6db8d85` against the Accepted spec, this plan and issue #181. It did not write the change and made no changes to the repository. **This is not a self-review.**

**Re-ran:**
- `pnpm --filter web test`: 48 files, 2184 passed.
- `pnpm --filter web lint`, `pnpm --filter web exec tsc --noEmit`, `pnpm --filter @clensy/web lint` and `pnpm --filter @clensy/web build`: exit 0.
- `pnpm --filter @clensy/web test`: 16 files, 418 passed.
- The unchanged-paths diff, including `docs/workflows/**`: empty.
- Commit trailers: none.

**Conformance:** Tasks 1–4 match the plan's text, with no undeclared extras and no copy, class, API, `@clensy/ui` or i18n change. All five Review focus items are covered by tests that would fail on a regression. The reviewer also judged the following sound:
- the `aria-labelledby` precedence over the wrapping `<label>`;
- `setFocus`'s deferred focus, which has no stale target because the dialog remounts on each opening;
- the region's placement (absolute `sr-only`, no flex gap, and `sr-only` is generated through `@source`);
- the services editor's unique ids and unchanged visible lines;
- the M6 ruling and characterization evidence.

**Blocking findings:** none.

**Non-blocking (Low):**
1. The plan's Status row was stale ("M6 in progress"). Fixed in M9.
2. A successful search with untruncated results leaves the region empty, so no result count is announced. This is by design (planning decision (g); counts deferred).
3. Reopening the list re-announces the same message. This is by design (g); worth noting in the owner's screen-reader pass.

**Declined to judge:** real screen-reader output; visual appearance (browser check NOT RUN); re-running the M6 mutations; #180; API suites.

### M8 — N/A (2026-10-16)

No maintainability improvement worth its risk. The diff is three small source changes that match the plan's text, with one private helper (`searchAnnouncement`) already extracted, and M7 found no duplication or structure issue. No refactor commit.

### M9 — Complete (2026-10-16)

**Scope:** `packages/web/README.md`, `apps/web/README.md`, and this plan's Status and records. All are content updates, caused by the M6 implementation and M7 approval:
- **`packages/web/README.md`:**
  - `<LaundrySearchCombobox>` gains an **Announcements** bullet: the persistent polite region, when it is empty, and the priority for an empty page that is also truncated.
  - `<LaundryFulfillmentFieldset>` now describes the radio name and description, the error on each radio with `aria-invalid`, the helper-only fieldset, and `inputRef`.
- **`apps/web/README.md`**, Laundry intake **Form**: server field errors mark the field invalid, and focus moves to the first field with an error in form order; no live role.

**Editorial verification:**
- The new relative links (`../../docs/superpowers/plans/2026-10-16-intake-screen-reader-polish-plan.md`) resolve.
- No heading changed.
- No contradiction remains: the old "joins the group's `aria-describedby`" sentence was replaced.
- Terminology follows the plan and spec.
- No `docs/workflows/**` change.


### PR CI — 2026-10-16

PR [#190](https://github.com/rexescario-dev/clensy-platform/pull/190), run [38912141103](https://github.com/rexescario-dev/clensy-platform/actions/runs/38912141103) on `516420f`. All required checks pass: API e2e (1m43s), Lint (1m7s), Release gate (53s), Test (1m14s). Merge state: `CLEAN`. M10 was not run for this slice; the owner directed merge and closeout.

### M10 — Accepted, workflow validated (2026-10-16)

```text
Decision: Accepted
Subject: workflow prompt library
Governing specification: docs/workflows/specs/agent-workflow-design.md
```

**Subject.** The installed workflow (`docs/workflows/`, generic 1.4.1) was run on #181 from the brainstorm to closeout.
- **No M2 or M3.** #181 changes only how the §8.4.4 intake UI is exposed to assistive technology. The owner approved going without a spec amendment at the brainstorm.
- **Dispatch vs stage:** the Context Forge dispatch asked for "Brainstorm (project default)". The brainstorm settled three owner decisions before M4. The workflow's selection rule (an Accepted spec exists, so start at M4) governed the stage.

**Asset inventory.** Unchanged:
- `README.md`;
- `specs/agent-workflow-design.md`;
- `conventions/prompt-library.md` and `conventions/reporting-conventions.md`;
- `prompts/` for M2–M10 (`specification`, `design-review`, `implementation-planning`, `plan-review`, `implementation-execution`, `code-review`, `refactoring`, `documentation-execution`, `workflow-validation`).

Every asset `workflow.yaml` lists exists. `git diff 8c7a11b 9fd0ef6 -- docs/workflows .claude workflow.yaml` is empty, and there are no orphan assets.

**Checks:**
- **§2.5 gate:** the M5 acceptance record (`7aad64a`, 21:39:12) precedes the first M6 commit (`1d9735c`, 21:40:24).
- **M5 return path:** two rounds returned the plan (M5-1 to M5-4, then M5-5 to M5-7). Each finding has a row in the revision logs, and revision 3 was accepted.
- **Authority model:**
  - **Semantics:** the spec (§8.4.4) governed, and it was not changed.
  - **Sequencing:** the plan governed. M6 kept task order and per-task commits. Its one ruling concerned only how characterization evidence was obtained, and it is recorded.
- **Red-phase evidence (M5-4):** every red run's actual count is recorded and matched the prediction. Both characterization tests carry mutation evidence that was never committed (M6 prompt step 3).
- **M7 independence:** `CLAUDE.md`'s rule was honoured. A fresh, read-only Opus 5.5 reviewer was given the spec, the plan and the diff, and it re-ran the checks.
- **Providers:** GitHub was used for issues #181 and #154, the branch, PR #190, CI and the merge, all through `gh`. The GitHub MCP server failed to connect at session start, and nothing fell back to it.
- **Reporting:** Slice Completion Reports were emitted at M6, M7 and closeout.
- **§2.8:** one PR (#190) carried the plan, its M5 record, the implementation, the M7–M9 records and the CI record.
- **§2.12:** the merge was verified (`9fd0ef6`; the branch head is an ancestor of `main`) before closeout.
- **Attribution:** no commit carries a `Co-Authored-By` trailer or a "Generated with" line (user `CLAUDE.md`).

**Blocking findings:** none.

**Non-blocking observations:**
1. **M10 ran after the merge.** §2.6 places M10 before closeout, with its report in the slice PR (§2.8). Here the owner directed merge and closeout first and asked for M10 afterwards, so this report lands in a follow-up docs-only PR. The cost is one extra PR; traceability is kept by this record and its PR link.
2. **A characterization claim that red could not show.** The plan said two characterization assertions "already pass" at red, but they followed the first failing assertion in the same test. M6 used mutation evidence instead.
   - **M4 lesson:** put characterization assertions in their own test, or before a test's first expected failure.
3. **The local Docker stack had drifted behind the branch again,** as in #162. The browser check was recorded NOT RUN, because the API's CORS origin pins the web origin to `:3001` and a rebuild needs the owner's approval.
   - **Suggested project policy (not workflow):** record in `CLAUDE.md` whether an agent may rebuild the local stack for a browser check.
4. **Manual acceptance criteria outlive the slice.** #181's screen-reader criteria cannot be met by automated tests, so the PR said "Part of" and the issue stays open for the owner's pass (planning decision (h)). The workflow handled this through planning decision (h) and the closeout's Remaining work. Neither the workflow nor the issue template has a field for it.
5. **The plan's code passed the repo's custom lint rules on first run** (unlike #158 and #162). The M5 reviews' focus on test design (M5-2, M5-5, M5-6) produced tests that pinned the request, the response and the node identity, not only the announced text.

Gate: **Workflow validated.**

## Slice Completion Report (final)

| Field | Result |
| --- | --- |
| Slice | #181 Intake screen-reader polish |
| Tracking | https://github.com/rexescario-dev/clensy-platform/issues/181 |
| M4 | Plan **Accepted** (revision 3) |
| M5 | Review **Accepted** |
| M6 | **Complete** |
| M7 | **Approved** (fresh, independent reviewer) |
| M8 | **N/A** |
| M9 | **Complete** |
| Branch | `feat/181-intake-screen-reader-polish` (merged) |
| PR | https://github.com/rexescario-dev/clensy-platform/pull/190 |
| Status | **Slice complete** |

### Shipped

- **Fulfillment radios:** each is named by its title, and its description is read once. While a server error shows, both radios are marked invalid and each is described by the error. The fieldset is described by its helper only.
- **Server field errors:** focus moves to the first field with an error, in form order. Generic failures keep the dialog alert.
- **Search messages:** the customer picker and the services editor announce them through one persistent, polite status region. The popup is visually unchanged.

### Validation

| Check | Result |
| --- | --- |
| Tests | **Passed** (`web` 2184/2184; `@clensy/web` 418/418; CI Test and API e2e) |
| Typecheck | **Passed** |
| Lint | **Passed** (local and CI) |
| Build | **Passed** (`@clensy/web build`; CI Release gate) |
| Package validation | **Passed** (no API, client, `@clensy/ui`, validation, i18n or `docs/workflows` change) |

Manual: the browser check and the screen-reader pass are **NOT RUN**. The owner runs them before #181 closes.

### Next Gate

**None — slice complete**

