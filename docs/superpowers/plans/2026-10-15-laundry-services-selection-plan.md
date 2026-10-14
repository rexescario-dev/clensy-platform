# Laundry Services and Add-ons Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not start any task until M5 has Accepted this plan.**

| Field | Value |
| --- | --- |
| Status | **Draft (revision 3)** (M4), 2026-10-15. In Plan Review (M5), reviewed in six parts. |
| M5 history | Part 1 (2026-10-15, owner): **no P1**; overall acceptance reserved until all six parts are reviewed.<br>• **P2 (planning decision c):** the first `PER_ITEM` choice's two-request transition must be proven by test, with the first response never leaving the UI ready while the second input is current. Resolved in revision 2: Task 4 case 5 asserts each step of the transition.<br>• **Suggestion (owner decision 4):** make the view matrix exhaustive against the real status and role types. Taken in revision 2: the Task 1 table test iterates `LAUNDRY_ORDER_STATUSES` (keys of a `Record<LaundryOrderStatus, …>`) × both fulfillment types × saved lines yes/no × role loading and every `ADMIN_ROLES` entry. This adds `SUPER_ADMIN`, which revision 1's hand-written role list missed. A count check pins 15 statuses and 7 roles.<br>• **Suggestion (planning decision e):** test stale-result rejection, not request cancellation. Taken in revision 2: Task 4 case 14 resolves the superseded request for real and covers an out-of-order success, a late success after a current failure, a superseded failure, and unmount, with `console.error` spied.<br>Part 2 (2026-10-15, owner): **no P1**.<br>• **P2 (Task 1 `matchPreview`):** it checked ids, not that the input was the current one; it could accept a preview for an outdated quantity. Resolved in revision 3 by the reviewer's second option. The `matchPreview` contract is now stated as line correspondence only (no quantity, order id or weight), with a test pinning that. Exact current-input identity is the hook's `[weightGrams, input]` key, proven by the new Task 4 case 19: an outdated base count, add-on count and weight each resolve with matching ids and never become current.<br>• **Suggestion 1 (matrix independence):** taken. Literal-role tests pin the editor to exactly `WEIGHED` × TENANT_OWNER, OPS_MANAGER, SCHEDULER. `laundryServicesView` now also requires `status === 'WEIGHED'`, so the "whatever the verbs claim" test forces a `price` verb on every other status. Revision 2's version of that test only used the helper's own verbs.<br>• **Suggestion 2 (duplicate ids):** taken. `missingPriceTarget` declines (`null`, so the raw message shows) when more than one row holds the named add-on, with a test.<br>• **Suggestion 3 (guards):** taken. `matchPreview` guards `base`, each line and each sent add-on explicitly. Checked: `apps/web` sets `strict` without `noUncheckedIndexedAccess`, and its lint has no type-checked rules, so the guards compile and lint as written. |
| Date | 2026-10-15 |
| Tracking issue | [#158](https://github.com/rexescario-dev/clensy-platform/issues/158) "Laundry services and add-ons selection". Epic [#154](https://github.com/rexescario-dev/clensy-platform/issues/154). Depends on [#156](https://github.com/rexescario-dev/clensy-platform/issues/156) (merged in #183: the order page) and [#159](https://github.com/rexescario-dev/clensy-platform/issues/159) (closed, merged in #184: `previewLaundryOrderPrice` and the frozen line `description`). Followed by [#162](https://github.com/rexescario-dev/clensy-platform/issues/162) (price preview card and Confirm), which reads the state this slice lifts. |
| Branch | `feat/158-laundry-services-selection`, from `main` at `18ceeb8`. One PR for this plan, its M5 record and the implementation. |
| Scope | `apps/web`: a new pure module, two new hooks, a new editor component, the order page's Overview and Services sections, tests. `packages/web`: a generic combobox extracted from the customer picker (the picker becomes a wrapper with unchanged behavior), new `laundry.order.services.*` and `laundry.order.overview.*` copy. **No** API, schema, migration, resolver, GraphQL type, operation document, codegen or `@clensy/ui` change. No new dependency. The list page and drawer are not edited. |
| Implements (Accepted) | [Laundry Orders & Lifecycle](../specs/2026-09-06-laundry-orders-lifecycle-design.md), Status **Accepted** (2026-09-06), with **Amendment #164**, Accepted 2026-10-10. Governing text: **§8.4.4**, Services bullet ("Services follow §4.5 step 3a. A `PER_KG` line shows weight and no item quantity. A `PER_ITEM` line shows an item count. `FLAT` / `PER_SERVICE` show no quantity. The client does not compute the amount.") and estimate bullet ("Before `priceLaundryOrder`, displayed amounts are an estimate from §8.4.5 … After `PRICED`, the page shows the frozen snapshot, not a new estimate."). **§8.4.5** (the preview: same input as `priceLaundryOrder`, `WEIGHED` only, writes nothing, OPERATIONAL roles, per-line `unit`, canonical `quantity`, `rateMinorUnits`, `minimumChargeApplied`). **§8.4.3** (repeated add-ons stay legal on the server; the page may offer each add-on once, "presentation only … not a server rule"). **§8.4.2** (a priced line shows its frozen `description`). **§4.5 step 3a** (quantity resolution keyed on the resolved unit; a supplied quantity is ignored unless `PER_ITEM`). **§4.4** (`priceLaundryOrder` roles OWNER, OPS_MANAGER, SCHEDULER). **§4.5** (post-`PRICED` immutability). |
| Relies on (Accepted, merged) | [Laundry Order Page plan](2026-10-14-laundry-order-page-plan.md) (#156): the route, `OrderSection`, `Fact`, the render-test harness, `currentLaundryOrderSection` (unchanged: `price` marks Services). [Multi-entry Laundry Weighing plan](2026-10-14-multi-entry-laundry-weighing-plan.md) (#155): `LAUNDRY_PRICED_STATUSES`, the touched/blur error rule, the stable-row-key and focus idioms, `graphQLErrorMessage`, the jsdom harness. [Laundry Intake Modal plan](2026-10-13-laundry-intake-modal-plan.md) (#160): `LaundryCustomerPicker`, `useLaundryCustomerSearch` (debounce, stale-result rule, `escapeLikePattern`). [Laundry Price Preview API plan](2026-10-14-laundry-price-preview-api-plan.md) (#159): the `PreviewLaundryOrderPrice` operation and its result shape. [Laundry UI Foundation plan](2026-10-10-laundry-ui-foundation-plan.md) (#157): `laundryOrderActions` (its `price` verb is `WEIGHED` ∩ OPERATIONAL), `formatWeightGrams`. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. Issue #158 refines §8.4.4 with layout, copy, validation and test requirements. File names, helper names, copy keys, element ids and task order are planning decisions, not product semantics. |
| Owner decisions (brainstorm, 2026-10-14/15) | See [Owner decisions](#owner-decisions). Summary: **(1)** Services owns the priced-line list; Overview shows a pointer. **(2)** A missing price is one section alert plus an inline marker on the row the server message names, only on an exact match. **(3)** Pickers list the first 20 active entries on focus. **(4)** The Services view table, including role loading and `CANCELLED`/`REJECTED`. **(5)** Units and boundaries, with the combobox extracted, not copied. **(6)** Data flow: remembered units vs current preview, staleness key, empty rows, duplicates, focus, errors, the #162 contract. **(7)** Testing, verification and delivery. |
| Planning decisions for M5 to confirm | See [Planning decisions](#planning-decisions-for-m5-to-confirm) (a)–(j). |
| Edit anchors | New files are given in full. Edits to existing files are given against `main` at `18ceeb8`. Apply each by the quoted code, not by line number. |
| Package names | `pnpm --filter web` is `apps/web`. `pnpm --filter @clensy/web` is `packages/web`. `pnpm --filter api` is `apps/api`. |
| Pre-validation | **None.** No code in this plan was run before M5. Every `Expected:` line is a prediction until M6 records the actual result. |
| M7 | Application code changes. `CLAUDE.md` requires a **fresh independent reviewer** on the most capable model, given this plan, the Accepted spec and the branch diff. M5 acceptance of this plan is not a substitute for that review. |

**Goal:** On `/app/laundry/<id>`, staff with an operational role choose the base service and any add-ons for a `WEIGHED` order. The page shows each line's unit, any item count, and its rate, all from `previewLaundryOrderPrice`. It then hands the selection and the current preview to the Price section, which #162 builds. This slice never calls `priceLaundryOrder` and never computes an amount.

**Architecture:**

- **Pure module (`apps/web/lib/laundry-service-selection.ts`):**
  - `laundryServicesView`: the Services view table (owner decision 4).
  - The selection shape: base choice, add-on rows with stable keys, and quantity text.
  - `parseItemCount`.
  - `previewInputFromSelection`: builds the `PriceLaundryOrderInput`, or returns `null`.
  - `matchPreview`: maps preview lines to rows by position and by kind/id.
  - `missingPriceTarget`: the exact-match parser for the server's missing-price message.
  - Remembered-unit keys and the rate-phrase key.
- **Generic combobox (`packages/web/src/laundry/laundry-search-combobox.tsx`):**
  - The WAI-ARIA editable combobox and listbox, extracted from `LaundryCustomerPicker`.
  - Generic over an option with an `id`. The caller supplies the copy and the option rendering.
  - `LaundryCustomerPicker` becomes a wrapper with unchanged markup and behavior.
- **Catalog search (`apps/web/lib/use-laundry-catalog-search.ts`):**
  - `useLaundryServiceSearch` and `useLaundryAddOnSearch`, over `useServicesQuery` / `useAddOnsQuery`.
  - Always `active: { is: true }`, a limit of 20, sorted by name.
  - On first focus, fetch the first page at once with no name filter. Typed text waits out a 300 ms debounce, then searches `name.iLike`.
- **Selection hook (`apps/web/lib/use-laundry-service-selection.ts`):**
  - Owns the selection, the remembered units, and the debounced preview, run through `useApolloClient().query`.
  - A result counts only for the exact `[weightGrams, input]` key that requested it.
  - Returns the state #162 consumes.
- **Editor (`apps/web/components/laundry/laundry-services-editor.tsx`):** renders the base block, the add-on rows, the section alert and the preview note, from the hook's state. It holds no preview logic.
- **Page (`apps/web/app/app/laundry/[id]/page.tsx`):**
  - A new `PricingSections` renders the Services and Price sections and owns the selection hook, so #162 reads the same state.
  - `ServicesBody` picks the view. `SavedLines` is the line list moved from Overview, with names.
  - Overview shows the pointer.

**Tech Stack:** React 19, Next.js 16, Apollo Client 3.14 (`@clensy/client` generated hooks and documents), Tailwind, Vitest (node `renderToStaticMarkup`, and jsdom with `createRoot` + `act`).

**Spec:** `docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md` §8.4.4, §8.4.5, §8.4.3, §8.4.2 (with §4.5 step 3a, §4.4).

---

## Owner decisions

Recorded from the brainstorm with the owner (2026-10-14/15). Each is binding on this plan.

1. **Priced-line list (decision A).** Services is the one visible list of a priced order's saved lines.
   - Each line shows its frozen `description`, unit, quantity in that unit, amount, and the minimum-charge flag.
   - Overview drops its line list. Once lines exist, it shows a one-line pointer, such as "2 services priced. See Services.", linking to `#laundry-order-services` (the existing section anchor).
   - The count comes from the order's **saved lines**, never from the selection or the preview.
   - Before any line exists, Overview keeps its current sentence.
2. **Missing price (decision A).** One debounced preview for the whole selection.
   - **Exact match.** The message is parsed only when it is exactly `No effective price for serviceId <uuid>` or `No effective price for addOnId <uuid>`. The id must also be a UUID and equal the currently selected base service (`serviceId`) or one add-on row's choice (`addOnId`).
   - **On a match:** the section alert reads "{name} has no current price.", and that row shows "No current price." inline. The raw server text is not repeated.
   - **Otherwise** (unknown format, malformed id, or no selected match), the alert shows the raw server text once. The UI never guesses a row.
   - **Stale errors.** A preview error belongs to the input that produced it. A new input hides it at once.
   - **No partial preview.** After a failed preview, no line has a valid preview, so no stale unit display, rate, or ready state survives.
3. **Picker browse on focus (decision A).**
   - **Browse:** focusing an empty picker fetches the first 20 active entries in name order, with no name filter.
   - **Search:** typed text uses the same server query with `name.iLike`, after a 300 ms debounce. Nothing is filtered in the browser.
   - **Truncation:** more matches than shown adds "Showing the first 20. Type to narrow."
   - **No duplicate request** when focus and typing overlap.
   - **Distinct states.** Loading, empty and error stay separate, so a failed query never reads as "no services".
4. **Services view table (approved as written).**

   | Order | Role | Services section |
   |---|---|---|
   | `WEIGHED` | may `price` (OWNER, OPS_MANAGER, SCHEDULER) | Editor |
   | `WEIGHED` | role still loading | Nothing |
   | `WEIGHED` | CUSTOMER_SUPPORT, FINANCE, ANALYST | "No services selected yet." |
   | `RECEIVED` | any | "Weigh the order before choosing services." |
   | `LAUNDRY_PRICED_STATUSES` (`PRICED` … `REFUNDED`) | any | "Services are locked because this order has been priced." and the saved lines |
   | `CANCELLED` / `REJECTED` with saved lines | any | The saved lines, no locked sentence |
   | `CANCELLED` / `REJECTED` without lines | any | "No services selected yet." |

   The logic lives in one pure function, with a table test over every combination of status, role loading, role eligibility and saved lines.
5. **Units and boundaries (Section 1, option i).**
   - **One combobox.** Extract `LaundrySearchCombobox` from the customer picker. The customer picker keeps its behavior: its existing tests stay unchanged, and its test, lint and type-check stay in scope.
   - **No domain logic in the combobox.** Catalog loading, duplicates and selection belong to the wrappers and hooks.
   - **Stable rows.** Rows have stable keys, so removing a row never moves another row's state.
   - **Explicit #162 contract.** The page owns the selection and preview state. #162 consumes it and starts no preview of its own.
6. **Data flow (Section 2).**
   - **Count input.** A `PER_ITEM` count input shows when the **remembered** unit for that line is `PER_ITEM`. The remembered unit comes from the last server reply that named the line, keyed `service:<id>` / `addOn:<id>`, and never carries over to a different choice.
   - **Current preview only.** Unit display ("Priced by weight", "Flat price"), the rate phrase, and `ready` come **only** from the current successful preview: the one whose input and order weight equal the current ones.
   - **Count input survives failures.** If a `PER_ITEM` response showed the count input and the count then becomes invalid, or a later preview fails, the input stays. The old rate, unit display, preview and `ready` do not.
   - **Empty rows.** An add-on row with no choice is left out of the preview input, but blocks `ready`. After blur it shows "Choose an add-on or remove this row."
   - **Invalid counts.** An invalid count is never sent and blocks `ready`.
   - **Line matching.** Preview lines are matched by position and by kind/id. Any mismatch rejects the whole preview.
   - **Weight in the staleness key.** The key includes `weightGrams`, so a re-weigh invalidates the quote.
   - **Loading.** `previewLoading` is true through the debounce and the request.
   - **Duplicates.** A duplicate add-on choice is not applied, and the row keeps its typed text.
   - **Focus.** "Add add-on" focuses the new row's search. Removing a row focuses "Add add-on".
   - **Contract for #162.** The exact previewed `PriceLaundryOrderInput` is exposed to #162. A test asserts that #158 never calls `priceLaundryOrder`.
7. **Testing and delivery (Section 3).**
   - **Red/green evidence.** Each new test is shown failing before its implementation and passing after. M6 records the actual results.
   - **Page matrix.** The page test covers `CANCELLED` **and** `REJECTED`, each with and without saved lines.
   - **API suites.** Reported **NOT RUN** (no API change), never as passed.
   - **Browser checks.** Recorded separately from the automated tests.
   - **M7.** An independent review on the most capable model.

## Planning decisions for M5 to confirm

These are not in the issue, the spec, or the owner decisions above. Each is the smallest choice that keeps the stated contract, and M5 may return any of them.

- **(a) Item-count range.** `parseItemCount` accepts only ASCII digits, with no whitespace trim (#155 decision d), and a value from 1 to 2,147,483,647, the GraphQL `Int` maximum. Anything else gets the issue's one message, "Enter a whole number of items, at least 1.". A larger value cannot be sent as `Int!`, so it gets no separate message.
- **(b) Base-service blur error.** Left with no choice, the base-service search shows "Choose a base service." This mirrors the empty-row rule (owner decision 6). The issue says only that the base service is required.
- **(c) Count prefill.** A new choice starts its count text at `"1"`. The first preview sends no count, and the server prices a `PER_ITEM` line without one at 1 (§4.5 step 3a: `suppliedQuantity ?? 1`). So when the reply reveals `PER_ITEM`, the input appears holding the value that was priced. Once the unit is remembered, the input carries the count. That changes the key, so a first `PER_ITEM` choice costs one extra preview request. This is accepted, not optimized.
- **(d) Count error timing.** The count error shows once the count input has been left (blur), as in #155 decision c. There is no submit in this slice.
- **(e) Request transport.** The preview goes through `useApolloClient().query({ fetchPolicy: 'network-only' })`. A per-request generation number, plus the effect cleanup, drop every superseded or unmounted response. The declarative `usePreviewLaundryOrderPriceQuery` is not used, for two reasons. Its variables cannot carry `weightGrams`, so a re-weigh would not re-query. And it could serve a cached result for an input repeated after an edit. `useApolloClient` is already used by `login/page.tsx` and `user-menu.tsx`. Following #155 decision g, a resolved result with errors, or without the payload, counts as a failure.
- **(f) A returning input is re-requested.** Going back to an input previewed earlier (A, then B, then A again) issues a new request rather than reviving A's old result. The exception is a return within the same debounce window, before B was ever requested: then A's result is still current.
- **(g) Overview pointer copy.** One line: "1 service priced." / "{n} services priced.", then a "See Services" link. When the loaded lines are a partial page (`hasNextPage`), the count is unknown, so the pointer reads "Services are priced." with the same link. The "More lines are not loaded." note moves to Services with the list.
- **(h) Copy removed.** `order.services.priced` ("Services are priced. The lines are listed under Overview.") and `order.lines.service` / `order.lines.addOn` are removed. Overview no longer lists lines, and the frozen `description` now names each line, already ending in " (add-on)" for an add-on (§8.4.2). Task 5 greps for other users first.
- **(i) Error copy wording.** The brainstorm approved "Couldn't load services.", "Couldn't load add-ons." and "Couldn't preview the price.". The repository's laundry copy otherwise says "Unable to …" (for example "Unable to record weight."). The plan uses the approved strings. M5 may switch them to "Unable to load services." etc. for consistency, which is a copy-only change.
- **(j) No `<form>`.** The editor renders no `<form>` and no submit button: Confirm belongs to #162. Enter inside an open listbox selects an option (combobox behavior). Enter elsewhere does nothing.

## Global constraints

- SHALL NOT call `priceLaundryOrder`, `generateInvoiceFromOrder`, `markLaundryOrderPaid`, or any mutation. The only network calls this slice adds are `previewLaundryOrderPrice`, `services` and `addOns` reads (§8.4.5; issue Out of scope).
- SHALL NOT compute an amount, a rate × quantity, or a total in the client. Every rate and unit shown comes from a preview line (§8.4.4; issue Acceptance).
- SHALL NOT send `baseQuantity` or an add-on `quantity` unless the remembered unit for that line is `PER_ITEM` (issue Fields; §4.5 step 3a).
- SHALL NOT call the preview with no base service, with an invalid count, without a recorded weight, or unless the Services view is `editor`. The server would reject the last two anyway (§8.4.5: `WEIGHED` with `weightGrams` set).
- SHALL NOT read `activePricing.priceMinorUnits` or `AddOn.priceMinorUnits` for display (issue Data).
- SHALL NOT filter the catalog in the browser. `active` and `name` are server filters (issue Data).
- SHALL NOT add a server rule for repeated add-ons, or describe the UI block as one (§8.4.3; #158 comment).
- SHALL NOT change `currentLaundryOrderSection`, the Price, Invoice or Actions bodies, the Weighing section, the list page, or the drawer.
- SHALL keep `LaundryCustomerPicker`'s rendered markup and keyboard/mouse behavior unchanged. Its existing static and interaction tests are not edited.

## File map

| File | Change | Task |
|---|---|---|
| `apps/web/lib/laundry-service-selection.ts` | new | 1 |
| `apps/web/lib/laundry-service-selection.test.ts` | new | 1 |
| `packages/web/src/laundry/laundry-search-combobox.tsx` | new (extracted) | 2 |
| `packages/web/src/laundry/laundry-search-combobox.test.tsx` | new | 2 |
| `packages/web/src/laundry/laundry-customer-picker.tsx` | becomes a wrapper | 2 |
| `packages/web/src/index.ts` | export the combobox and its types | 2 |
| `apps/web/lib/laundry-search-combobox.interaction.test.tsx` | new (jsdom: open on focus, empty-text browse) | 2 |
| `apps/web/lib/use-laundry-catalog-search.ts` | new | 3 |
| `apps/web/lib/use-laundry-catalog-search.test.ts` | new (variables) | 3 |
| `apps/web/lib/use-laundry-catalog-search.hook.test.tsx` | new (jsdom) | 3 |
| `apps/web/lib/use-laundry-service-selection.ts` | new | 4 |
| `apps/web/lib/use-laundry-service-selection.hook.test.tsx` | new (jsdom) | 4 |
| `packages/web/src/i18n/messages/en/laundry.ts` | `order.services.*`, `order.overview.*` copy | 5 |
| `apps/web/components/laundry/laundry-services-editor.tsx` | new | 5 |
| `apps/web/lib/laundry-services-editor.interaction.test.tsx` | new (jsdom) | 5 |
| `apps/web/app/app/laundry/[id]/page.tsx` | `PricingSections`, `ServicesBody`, `SavedLines`, Overview pointer | 6 |
| `apps/web/lib/laundry-order-page.render.test.tsx` | updated and new cases | 6 |
| this plan | Execution record | 7 |

Tests for `apps/web` must live under `apps/web/lib/` (the Vitest `include` is `lib/**/*.test.{ts,tsx}`).

---

## Task 1: Pure selection module

Implements owner decisions 2, 4, 6; planning decisions a, c; §8.4.4 Services bullet; §4.5 step 3a.

**Files:** create `apps/web/lib/laundry-service-selection.ts`, `apps/web/lib/laundry-service-selection.test.ts`.

- [ ] **Step 1: Write the failing tests.** Create `apps/web/lib/laundry-service-selection.test.ts`:

```ts
import type { PreviewLaundryOrderPriceQuery } from '@clensy/client';
import {
  ADMIN_ROLES,
  LAUNDRY_ORDER_STATUSES,
  laundryOrderActions,
  type AdminRole,
  type LaundryOrderStatus,
} from '@clensy/web';
import { describe, expect, it } from 'vitest';
import {
  EMPTY_LAUNDRY_SERVICE_SELECTION,
  laundryRateKey,
  laundryServicesView,
  laundryUnitKey,
  matchPreview,
  missingPriceTarget,
  parseItemCount,
  previewInputFromSelection,
  type LaundryAddOnRow,
  type LaundryServiceSelection,
} from './laundry-service-selection';
import { LAUNDRY_PRICED_STATUSES } from './laundry-order-page';

type Line = PreviewLaundryOrderPriceQuery['previewLaundryOrderPrice']['lines'][number];

const ORDER = '3f2a9c1e-0b7d-4e55-9a10-6c2b8d4e7f01';
const WASH = { id: '11111111-1111-4111-8111-111111111111', name: 'Wash & fold' };
const IRON = { id: '22222222-2222-4222-8222-222222222222', name: 'Ironing' };
const SOFT = { id: '33333333-3333-4333-8333-333333333333', name: 'Softener' };

function row(key: number, choice: LaundryAddOnRow['choice'], quantity = '1'): LaundryAddOnRow {
  return { key, choice, duplicate: false, quantity, quantityTouched: false, query: choice?.name ?? '', touched: false };
}

function selection(overrides: Partial<LaundryServiceSelection> = {}): LaundryServiceSelection {
  return { ...EMPTY_LAUNDRY_SERVICE_SELECTION, base: WASH, baseQuery: WASH.name, baseQuantity: '1', ...overrides };
}

function line(overrides: Partial<Line>): Line {
  return {
    addOnId: null,
    amountMinorUnits: 0,
    description: '',
    minimumChargeApplied: false,
    minimumChargeMinorUnits: null,
    quantity: 1,
    rateMinorUnits: 0,
    serviceId: null,
    unit: 'FLAT',
    ...overrides,
  };
}

// The roles that may price (spec §4.4). Every other `ADMIN_ROLES` entry,
// including the platform SUPER_ADMIN, is ineligible.
const OPERATIONAL: ReadonlySet<AdminRole> = new Set<AdminRole>(['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER']);

describe('laundryServicesView', () => {
  // Owner decision 4 (M5 part 1 suggestion: exhaustive against the real
  // types). `LAUNDRY_ORDER_STATUSES` is the keys of a
  // `Record<LaundryOrderStatus, …>`, and `ADMIN_ROLES` is every
  // `AdminRole`, so a new status or role joins this matrix without an edit
  // here. Every status × both fulfillment types × role loading and each
  // role × saved lines yes/no.
  function expected(status: LaundryOrderStatus, role: AdminRole | undefined, hasLines: boolean) {
    if (status === 'WEIGHED') {
      if (role === undefined) return 'hidden';
      return OPERATIONAL.has(role) ? 'editor' : 'none';
    }
    if (status === 'RECEIVED') return 'beforeWeigh';
    if (LAUNDRY_PRICED_STATUSES.has(status)) return 'locked';
    return hasLines ? 'lines' : 'none';
  }

  it('covers all 15 statuses and all 7 roles', () => {
    expect(LAUNDRY_ORDER_STATUSES).toHaveLength(15);
    expect(ADMIN_ROLES).toHaveLength(7);
  });

  for (const status of LAUNDRY_ORDER_STATUSES) {
    for (const fulfillment of ['PICKUP', 'DELIVERY'] as const) {
      for (const hasLines of [false, true]) {
        for (const role of [undefined, ...ADMIN_ROLES]) {
          it(`${status}, ${fulfillment}, lines ${String(hasLines)}: ${role ?? 'role loading'}`, () => {
            const verbs = laundryOrderActions(status, fulfillment, role);
            expect(laundryServicesView({ hasLines, roleResolved: role !== undefined, status, verbs })).toBe(
              expected(status, role, hasLines),
            );
          });
        }
      }
    }
  }

  // M5 part 2 suggestion 1: pinned by literal roles and statuses, not by the
  // `expected` helper, so a change to `laundryOrderActions` or to the view
  // cannot widen or narrow who edits without failing here.
  it.each(['TENANT_OWNER', 'OPS_MANAGER', 'SCHEDULER'] as const)('shows the editor to %s on a WEIGHED order', (role) => {
    for (const fulfillment of ['PICKUP', 'DELIVERY'] as const) {
      const verbs = laundryOrderActions('WEIGHED', fulfillment, role);
      expect(laundryServicesView({ hasLines: false, roleResolved: true, status: 'WEIGHED', verbs })).toBe('editor');
    }
  });

  it('shows the editor for exactly WEIGHED × TENANT_OWNER, OPS_MANAGER, SCHEDULER and nothing else', () => {
    const editors = new Set<string>();
    for (const status of LAUNDRY_ORDER_STATUSES) {
      for (const role of ADMIN_ROLES) {
        for (const fulfillment of ['PICKUP', 'DELIVERY'] as const) {
          const verbs = laundryOrderActions(status, fulfillment, role);
          for (const hasLines of [false, true]) {
            if (laundryServicesView({ hasLines, roleResolved: true, status, verbs }) === 'editor') editors.add(`${status}:${role}`);
          }
        }
      }
    }
    expect([...editors].sort()).toEqual(['WEIGHED:OPS_MANAGER', 'WEIGHED:SCHEDULER', 'WEIGHED:TENANT_OWNER']);
  });

  it('never shows the editor outside WEIGHED, whatever the verbs claim', () => {
    for (const status of LAUNDRY_ORDER_STATUSES.filter((s) => s !== 'WEIGHED')) {
      // A forced `price` verb: the view checks the status itself, not only the verbs.
      expect(laundryServicesView({ hasLines: false, roleResolved: true, status, verbs: ['price'] })).not.toBe('editor');
    }
  });

  it('shows the locked sentence for CANCELLED and REJECTED never, with or without lines', () => {
    for (const status of ['CANCELLED', 'REJECTED'] as const) {
      expect(laundryServicesView({ hasLines: true, roleResolved: true, status, verbs: [] })).toBe('lines');
      expect(laundryServicesView({ hasLines: false, roleResolved: true, status, verbs: [] })).toBe('none');
    }
  });
});

describe('parseItemCount', () => {
  it.each([
    ['1', 1],
    ['2', 2],
    ['007', 7],
    ['2147483647', 2147483647],
  ])('accepts %j', (text, value) => {
    expect(parseItemCount(text)).toBe(value);
  });

  it.each(['', ' ', '0', '00', '-1', '1.5', '1.0', ' 2', '2 ', '+2', '1e3', 'two', '2147483648', '99999999999999999999'])(
    'rejects %j',
    (text) => {
      expect(parseItemCount(text)).toBeNull();
    },
  );
});

describe('previewInputFromSelection', () => {
  it('is null without a base service', () => {
    expect(previewInputFromSelection(ORDER, EMPTY_LAUNDRY_SERVICE_SELECTION, {})).toBeNull();
  });

  it('sends no count for a unit that is unknown or not PER_ITEM', () => {
    for (const unit of [undefined, 'PER_KG', 'FLAT', 'PER_SERVICE'] as const) {
      const units = unit ? { [laundryUnitKey('service', WASH.id)]: unit, [laundryUnitKey('addOn', IRON.id)]: unit } : {};
      expect(previewInputFromSelection(ORDER, selection({ addOns: [row(0, IRON, '5')], baseQuantity: '5' }), units)).toEqual({
        addOns: [{ addOnId: IRON.id }],
        baseServiceId: WASH.id,
        orderId: ORDER,
      });
    }
  });

  it('sends the count for a remembered PER_ITEM base service and add-on', () => {
    const units = { [laundryUnitKey('service', WASH.id)]: 'PER_ITEM', [laundryUnitKey('addOn', IRON.id)]: 'PER_ITEM' } as const;
    expect(previewInputFromSelection(ORDER, selection({ addOns: [row(0, IRON, '4')], baseQuantity: '3' }), units)).toEqual({
      addOns: [{ addOnId: IRON.id, quantity: 4 }],
      baseQuantity: 3,
      baseServiceId: WASH.id,
      orderId: ORDER,
    });
  });

  it('keys remembered units by kind: a service unit never applies to an add-on with the same id', () => {
    const shared = { id: WASH.id, name: 'Same id' };
    const units = { [laundryUnitKey('service', WASH.id)]: 'PER_ITEM' } as const;
    expect(previewInputFromSelection(ORDER, selection({ addOns: [row(0, shared, '9')] }), units)?.addOns).toEqual([{ addOnId: WASH.id }]);
  });

  it('is null for an invalid remembered PER_ITEM count, base or add-on', () => {
    const units = { [laundryUnitKey('service', WASH.id)]: 'PER_ITEM', [laundryUnitKey('addOn', IRON.id)]: 'PER_ITEM' } as const;
    expect(previewInputFromSelection(ORDER, selection({ baseQuantity: '0' }), units)).toBeNull();
    expect(previewInputFromSelection(ORDER, selection({ addOns: [row(0, IRON, '')] }), units)).toBeNull();
  });

  it('leaves out a row with no choice, keeping the others in row order', () => {
    expect(previewInputFromSelection(ORDER, selection({ addOns: [row(0, SOFT), row(1, null), row(2, IRON)] }), {})?.addOns).toEqual([
      { addOnId: SOFT.id },
      { addOnId: IRON.id },
    ]);
  });
});

describe('matchPreview', () => {
  const current = selection({ addOns: [row(4, IRON), row(7, null), row(9, SOFT)] });
  const input = previewInputFromSelection(ORDER, current, {})!;
  const base = line({ serviceId: WASH.id, unit: 'PER_KG' });
  const iron = line({ addOnId: IRON.id, unit: 'PER_ITEM' });
  const soft = line({ addOnId: SOFT.id });

  it('maps the base line and each chosen row, by row key', () => {
    const matched = matchPreview(input, current, { estimatedTotalMinorUnits: 0, lines: [base, iron, soft] })!;
    expect(matched.base).toBe(base);
    expect(matched.addOns.get(4)).toBe(iron);
    expect(matched.addOns.get(9)).toBe(soft);
    expect(matched.addOns.has(7)).toBe(false);
  });

  it.each([
    ['a missing line', [base, iron]],
    ['an extra line', [base, iron, soft, soft]],
    ['add-ons out of order', [base, soft, iron]],
    ['a base line that is an add-on', [iron, iron, soft]],
    ['an add-on line that names a service', [base, line({ serviceId: IRON.id }), soft]],
    ['a base line for another service', [line({ serviceId: IRON.id }), iron, soft]],
  ])('rejects the whole preview for %s', (_name, lines) => {
    expect(matchPreview(input, current, { estimatedTotalMinorUnits: 0, lines })).toBeNull();
  });

  // M5 part 2 P2: the contract is line correspondence only. Quantities,
  // order id and weight are the caller's to check (Task 4's exact
  // `[weightGrams, input]` key; cases 13, 14 and 19), so a line whose
  // quantity differs from the input still corresponds.
  it('compares no quantity: whether the input is current is the caller\'s contract', () => {
    const counted = { ...input, addOns: [{ addOnId: IRON.id, quantity: 4 }, { addOnId: SOFT.id }], baseQuantity: 2 };
    const lines = [line({ quantity: 9, serviceId: WASH.id }), line({ addOnId: IRON.id, quantity: 7 }), soft];
    expect(matchPreview(counted, current, { estimatedTotalMinorUnits: 0, lines })).not.toBeNull();
  });
});

describe('missingPriceTarget', () => {
  const current = selection({ addOns: [row(3, IRON), row(5, null)] });

  it('names the base service for its exact serviceId message', () => {
    expect(missingPriceTarget(`No effective price for serviceId ${WASH.id}`, current)).toEqual({ kind: 'service' });
  });

  it('names the add-on row for its exact addOnId message', () => {
    expect(missingPriceTarget(`No effective price for addOnId ${IRON.id}`, current)).toEqual({ key: 3, kind: 'addOn' });
  });

  it('declines when two selected rows hold the named add-on, rather than marking the first', () => {
    const repeated = selection({ addOns: [row(3, IRON), row(8, IRON)] });
    expect(missingPriceTarget(`No effective price for addOnId ${IRON.id}`, repeated)).toBeNull();
  });

  it.each([
    ['the wrong kind for the base id', `No effective price for addOnId ${WASH.id}`],
    ['the wrong kind for the add-on id', `No effective price for serviceId ${IRON.id}`],
    ['an id that is not selected', `No effective price for addOnId ${SOFT.id}`],
    ['a malformed id', 'No effective price for addOnId not-a-uuid'],
    ['a trailing period', `No effective price for addOnId ${IRON.id}.`],
    ['a prefix', `Error: No effective price for addOnId ${IRON.id}`],
    ['another message', 'Cannot price a laundry order in status PRICED'],
    ['an empty message', ''],
  ])('returns null for %s', (_name, message) => {
    expect(missingPriceTarget(message, current)).toBeNull();
  });
});

describe('laundryRateKey', () => {
  it.each([
    ['PER_KG', 'perKg'],
    ['PER_ITEM', 'perItem'],
    ['FLAT', 'flat'],
    ['PER_SERVICE', 'flat'],
  ] as const)('%s → %s', (unit, key) => {
    expect(laundryRateKey(unit)).toBe(key);
  });
});
```

- [ ] **Step 2: Run, expect failure.** `pnpm --filter web exec vitest run lib/laundry-service-selection.test.ts`. Expected: FAIL, cannot resolve `./laundry-service-selection`. Record the actual output.

- [ ] **Step 3: Implement.** Create `apps/web/lib/laundry-service-selection.ts`:

```ts
import type { PreviewLaundryOrderPriceQuery, PriceLaundryOrderInput, PricingUnit } from '@clensy/client';
import type { LaundryOrderStatus, LaundryOrderVerb } from '@clensy/web';
import { isUuid } from './laundry-order-list-query';
import { LAUNDRY_PRICED_STATUSES } from './laundry-order-page';

// What the Services section shows (owner decision 4, #158). The editor
// only when the actor may price (`laundryOrderActions` already intersects
// WEIGHED with the operational roles, spec §4.4). Nothing on a WEIGHED
// order until the role is known, so read-only copy never flashes before
// the editor. CANCELLED and REJECTED never show the locked sentence: the
// status alone does not prove pricing (#155 decision a).
export type LaundryServicesView = 'beforeWeigh' | 'editor' | 'hidden' | 'lines' | 'locked' | 'none';

export interface LaundryServicesViewInput {
  // The order has saved (priced) lines.
  hasLines: boolean;
  // `currentAdmin.role` has loaded.
  roleResolved: boolean;
  status: LaundryOrderStatus;
  // `laundryOrderActions(status, fulfillmentType, role)`.
  verbs: readonly LaundryOrderVerb[];
}

export function laundryServicesView({ hasLines, roleResolved, status, verbs }: LaundryServicesViewInput): LaundryServicesView {
  // The status is checked as well as the verb (M5 part 2): the editor can
  // never appear outside WEIGHED, even if the client verb table changes.
  if (status === 'WEIGHED' && verbs.includes('price')) return 'editor';
  if (status === 'WEIGHED' && !roleResolved) return 'hidden';
  if (status === 'RECEIVED') return 'beforeWeigh';
  if (LAUNDRY_PRICED_STATUSES.has(status)) return 'locked';
  return hasLines ? 'lines' : 'none';
}

export interface LaundryCatalogChoice {
  id: string;
  name: string;
}

// One add-on row. `key` is stable for the row's life, so removing a row
// never moves another row's text, choice or errors (owner decision 5).
export interface LaundryAddOnRow {
  choice: LaundryCatalogChoice | null;
  // The last choice was already on another row (§8.4.3: presentation only).
  duplicate: boolean;
  key: number;
  // Item-count text; shown only for a remembered PER_ITEM unit.
  quantity: string;
  quantityTouched: boolean;
  // The search text.
  query: string;
  // The search was left at least once.
  touched: boolean;
}

export interface LaundryServiceSelection {
  addOns: readonly LaundryAddOnRow[];
  base: LaundryCatalogChoice | null;
  baseQuantity: string;
  baseQuantityTouched: boolean;
  baseQuery: string;
  baseTouched: boolean;
}

export const EMPTY_LAUNDRY_SERVICE_SELECTION: LaundryServiceSelection = {
  addOns: [],
  base: null,
  baseQuantity: '1',
  baseQuantityTouched: false,
  baseQuery: '',
  baseTouched: false,
};

export type LaundryLineKind = 'addOn' | 'service';

// The unit the server last reported for a line, by kind and id (owner
// decision 6). A presentation hint for which input to show, never
// evidence of a current price.
export type LaundryRememberedUnits = Readonly<Record<string, PricingUnit>>;

export function laundryUnitKey(kind: LaundryLineKind, id: string): string {
  return `${kind}:${id}`;
}

// The GraphQL `Int` maximum; a larger count cannot be sent (planning decision a).
const MAX_ITEM_COUNT = 2_147_483_647;

// A whole number of items, at least 1: ASCII digits only, no trim
// (#155 decision d). `null` for anything else.
export function parseItemCount(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value >= 1 && value <= MAX_ITEM_COUNT ? value : null;
}

// The preview input for the current selection, or `null` when it must not
// be sent: no base service, or an invalid count on a line remembered as
// PER_ITEM. A count goes only with a remembered PER_ITEM unit (§4.5 step
// 3a; issue Fields). A row with no choice is left out; it blocks `ready`
// in the hook instead (owner decision 6).
export function previewInputFromSelection(
  orderId: string,
  selection: LaundryServiceSelection,
  units: LaundryRememberedUnits,
): PriceLaundryOrderInput | null {
  const { base } = selection;
  if (!base) return null;
  let baseQuantity: number | undefined;
  if (units[laundryUnitKey('service', base.id)] === 'PER_ITEM') {
    const count = parseItemCount(selection.baseQuantity);
    if (count === null) return null;
    baseQuantity = count;
  }
  const addOns: PriceLaundryOrderInput['addOns'] = [];
  for (const row of selection.addOns) {
    if (!row.choice) continue;
    if (units[laundryUnitKey('addOn', row.choice.id)] === 'PER_ITEM') {
      const count = parseItemCount(row.quantity);
      if (count === null) return null;
      addOns.push({ addOnId: row.choice.id, quantity: count });
    } else {
      addOns.push({ addOnId: row.choice.id });
    }
  }
  return baseQuantity === undefined
    ? { addOns, baseServiceId: base.id, orderId }
    : { addOns, baseQuantity, baseServiceId: base.id, orderId };
}

export type LaundryPreview = PreviewLaundryOrderPriceQuery['previewLaundryOrderPrice'];
export type LaundryPreviewLine = LaundryPreview['lines'][number];

export interface LaundryMatchedPreview {
  // Add-on lines by row key, for rows with a choice.
  addOns: ReadonlyMap<number, LaundryPreviewLine>;
  base: LaundryPreviewLine;
  estimatedTotalMinorUnits: number;
  // In server order, for the price review (#162).
  lines: readonly LaundryPreviewLine[];
}

// Line correspondence only (M5 part 2): the server returns the base line,
// then one line per `addOns` entry in input order (spec §8.4.5; the shared
// quote path). Each line is matched by position and by kind and id to
// `input`, and each chosen row (in row order) must carry that same id, so
// the result can be keyed by row. Any mismatch rejects the whole preview
// (owner decision 6).
//
// It does NOT decide that `input` is the current input: it compares no
// quantity, order id or weight. The caller must pass only a preview whose
// request input and order weight are exactly the current ones.
// `useLaundryServiceSelection` does this with its `[weightGrams, input]`
// key (Task 4 cases 13, 14 and 19).
export function matchPreview(
  input: PriceLaundryOrderInput,
  selection: LaundryServiceSelection,
  preview: LaundryPreview,
): LaundryMatchedPreview | null {
  const chosen = selection.addOns.filter((row) => row.choice !== null);
  if (preview.lines.length !== 1 + input.addOns.length || chosen.length !== input.addOns.length) return null;
  const [base, ...rest] = preview.lines;
  if (!base || base.serviceId !== String(input.baseServiceId) || base.addOnId !== null) return null;
  const addOns = new Map<number, LaundryPreviewLine>();
  for (const [index, row] of chosen.entries()) {
    const line = rest[index];
    const sent = input.addOns[index];
    if (!line || !sent) return null;
    const id = String(sent.addOnId);
    if (line.serviceId !== null || line.addOnId !== id || row.choice?.id !== id) return null;
    addOns.set(row.key, line);
  }
  return { addOns, base, estimatedTotalMinorUnits: preview.estimatedTotalMinorUnits, lines: preview.lines };
}

export type LaundryMissingPriceTarget = { key: number; kind: 'addOn' } | { kind: 'service' };

// The quote path's missing-price message (laundry-orders.service.ts,
// `No effective price for ${column} ${id}`). Matched only exactly, with a
// UUID that equals the selected line of that kind; otherwise `null`, and
// the caller shows the raw text (owner decision 2). Never a guess.
const MISSING_PRICE = /^No effective price for (serviceId|addOnId) (\S+)$/;

// More than one row holding the id cannot happen through the editor
// (duplicates are blocked), but the server allows repeats (§8.4.3) and this
// module is pure. With no unique row, it declines rather than marking the
// first one (M5 part 2 suggestion 2).
export function missingPriceTarget(message: string, selection: LaundryServiceSelection): LaundryMissingPriceTarget | null {
  const match = MISSING_PRICE.exec(message);
  if (!match) return null;
  const [, column, id] = match;
  if (!isUuid(id)) return null;
  if (column === 'serviceId') return selection.base?.id === id ? { kind: 'service' } : null;
  const rows = selection.addOns.filter((candidate) => candidate.choice?.id === id);
  return rows.length === 1 ? { key: rows[0].key, kind: 'addOn' } : null;
}

export type LaundryRateKey = 'flat' | 'perItem' | 'perKg';

// The rate phrase's copy key (issue Fields: "{price} per kg", "{price} per
// item", "{price} flat").
export function laundryRateKey(unit: PricingUnit): LaundryRateKey {
  if (unit === 'PER_KG') return 'perKg';
  if (unit === 'PER_ITEM') return 'perItem';
  return 'flat';
}
```

`matchPreview` guards `base`, `line` and `sent` explicitly as runtime checks (M5 part 2 suggestion 3), with no non-null assertion. Checked at planning: `apps/web/tsconfig.json` sets `strict` but not `noUncheckedIndexedAccess`, and the web ESLint preset (`tooling/eslint.contextforge.mjs`) has no type-checked rules such as `no-unnecessary-condition`. So the guards compile and lint as written. They must not be removed as redundant.

- [ ] **Step 4: Run, expect pass.** `pnpm --filter web exec vitest run lib/laundry-service-selection.test.ts`. Expected: PASS. Then `pnpm --filter web lint` and `pnpm --filter web exec tsc --noEmit`. Expected: clean.

- [ ] **Step 5: Commit.** `feat(web): pure laundry services selection rules (#158)`.

---

## Task 2: Extract `LaundrySearchCombobox`

Implements owner decisions 3 and 5; issue Fields ("same combobox behavior as the customer picker").

**Files:** create `packages/web/src/laundry/laundry-search-combobox.tsx`, `packages/web/src/laundry/laundry-search-combobox.test.tsx`, `apps/web/lib/laundry-search-combobox.interaction.test.tsx`. Modify `packages/web/src/laundry/laundry-customer-picker.tsx` and `packages/web/src/index.ts`.

**Regression net:** `packages/web/src/laundry/laundry-customer-picker.test.tsx` and `apps/web/lib/laundry-customer-picker.interaction.test.tsx` are **not edited**. They must pass before and after this task.

- [ ] **Step 1: Baseline the regression net.** Run `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-customer-picker.test.tsx` and `pnpm --filter web exec vitest run lib/laundry-customer-picker.interaction.test.tsx`. Expected: PASS. Record the test counts.

- [ ] **Step 2: Write the failing generic tests.**

  **Static markup** (`packages/web/src/laundry/laundry-search-combobox.test.tsx`, `renderToStaticMarkup`, options `{ id, name }`, `renderOption` returns the name in a `<span>`):
  1. The `label` copy labels a combobox with `aria-controls="<id>-listbox"`, `aria-expanded="false"`, `aria-autocomplete="list"`, `autoComplete="off"`, and no `aria-activedescendant`. The listbox's `aria-label` is the same label.
  2. A `ready` status renders one `role="option"` per option with id `<id>-option-<option id>`, and the caller's rendering inside it.
  3. `loading` renders the `searching` copy. `ready` with no options renders `empty`. `error` renders `error` in `role="alert"`. `truncated` renders `more`. `idle` renders none of them.
  4. No option renders unless the status is `ready`.
  5. `error` prop: `aria-invalid="true"` and `aria-describedby="<id>-error"`, with the message in `<p id="<id>-error">`.
  6. `disabled` sets the input's `disabled` attribute. Without it, there is no `disabled` attribute.

  **Interaction** (`apps/web/lib/laundry-search-combobox.interaction.test.tsx`, jsdom with `createRoot` + `act`, the same harness as `laundry-customer-picker.interaction.test.tsx`; the component is imported from `@clensy/web`):
  1. `openOnFocus`: focus with an empty query calls `onFocus` once, and opens the list (`aria-expanded="true"`) once the status is not `idle`.
  2. `openOnFocus`: clearing the text to empty keeps the list open. Without `openOnFocus`, clearing closes it (the customer rule).
  3. ArrowDown/ArrowUp wrap through the options and set `aria-activedescendant`. Enter selects the active option, calls `onSelect` with it, and closes the list. Escape closes an open list and calls `stopImmediatePropagation`.
  4. Blur closes the list and calls `onBlur`.
  5. Clicking an option selects it. A `mousedown` on the popup does not blur the input.

- [ ] **Step 3: Run, expect failure.** Both new files fail to resolve `laundry-search-combobox` / the `LaundrySearchCombobox` export. Record the output.

- [ ] **Step 4: Implement the combobox.** Create `packages/web/src/laundry/laundry-search-combobox.tsx` by moving the body of `LaundryCustomerPicker` into a generic component. Changes from the picker, and only these:

```tsx
'use client';

import { useState, type KeyboardEvent, type ReactNode, type Ref } from 'react';

export type LaundrySearchStatus = 'error' | 'idle' | 'loading' | 'ready';

export interface LaundrySearchComboboxCopy {
  empty: string;
  error: string;
  label: string;
  more: string;
  searching: string;
}

export interface LaundrySearchComboboxProps<T extends { id: string }> {
  id: string;
  copy: LaundrySearchComboboxCopy;
  disabled?: boolean;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
  onBlur?: () => void;
  onFocus?: () => void;
  onQueryChange: (text: string) => void;
  onSelect: (option: T) => void;
  // Opens on focus and stays open for an empty text: the catalog pickers
  // browse the first page (#158 owner decision 3). The customer picker
  // leaves it off and opens only for a non-empty text (#160).
  openOnFocus?: boolean;
  options: readonly T[];
  query: string;
  renderOption: (option: T) => ReactNode;
  status: LaundrySearchStatus;
  truncated?: boolean;
}
```

- The comment block above `LaundryCustomerPicker` (WAI-ARIA, caller-owned text and selection, active option by id, Escape and the Modal) moves above `LaundrySearchCombobox` verbatim, with "customer" generalized to "option".
- `select`, `move`, `handleKeyDown`, the `rendered`/`active`/`expanded` logic and the popup's `onMouseDown` are unchanged.
- `<label>` and the listbox `aria-label` use `copy.label`. The status lines use `copy.searching`, `copy.empty`, `copy.more` and `copy.error`, with the same elements, roles and classes.
- Each `<li>` keeps its id, role, `aria-selected`, `onClick` and classes, and renders `{renderOption(option)}` as its children.
- The input adds `disabled={disabled}` and `onFocus={() => { onFocus?.(); if (openOnFocus) setOpen(true); }}`.
- `onBlur` becomes `() => { close(); onBlur?.(); }`.
- `onChange` becomes `setOpen(openOnFocus || event.target.value.trim() !== '')`; the rest is unchanged.

- [ ] **Step 5: Make the customer picker a wrapper.** In `packages/web/src/laundry/laundry-customer-picker.tsx`:
  - Keep `LaundryCustomerOption`, `LaundryCustomerPickerProps` and the exported names.
  - `LaundryCustomerSearchStatus` becomes `export type LaundryCustomerSearchStatus = LaundrySearchStatus;`.
  - The component renders:

```tsx
export function LaundryCustomerPicker(props: LaundryCustomerPickerProps) {
  const t = useClensyTranslations('laundry');
  return (
    <LaundrySearchCombobox
      {...props}
      copy={{
        empty: t('create.customer.empty'),
        error: t('create.customer.error'),
        label: t('create.customer.label'),
        more: t('create.customer.more'),
        searching: t('create.customer.searching'),
      }}
      renderOption={(option) => (
        <>
          <span className="block text-sm text-slate-900">{option.fullName}</span>
          <span className="block text-sm text-slate-500">{option.phone !== '' ? option.phone : option.email}</span>
        </>
      )}
    />
  );
}
```

  Add a short comment: the combobox behavior lives in `LaundrySearchCombobox` (#158); this wrapper supplies the customer copy and option text.

- [ ] **Step 6: Export.** In `packages/web/src/index.ts`, after the customer picker exports:

```ts
export { LaundrySearchCombobox } from './laundry/laundry-search-combobox';
export type {
  LaundrySearchComboboxCopy,
  LaundrySearchComboboxProps,
  LaundrySearchStatus,
} from './laundry/laundry-search-combobox';
```

- [ ] **Step 7: Run, expect pass.**
  - `pnpm --filter @clensy/web test`, `lint` and `build`, then `pnpm --filter web exec vitest run lib/laundry-customer-picker.interaction.test.tsx lib/laundry-search-combobox.interaction.test.tsx lib/laundry-list-page.interaction.test.tsx`. Expected: PASS, with the regression-net counts equal to Step 1's.
  - `pnpm --filter web lint` and `pnpm --filter web exec tsc --noEmit`. Expected: clean.

- [ ] **Step 8: Commit.** `refactor(web): extract the laundry search combobox from the customer picker (#158)`.

---

## Task 3: Catalog search hooks

Implements owner decision 3; issue Data.

**Files:** create `apps/web/lib/use-laundry-catalog-search.ts`, `apps/web/lib/use-laundry-catalog-search.test.ts`, `apps/web/lib/use-laundry-catalog-search.hook.test.tsx`.

- [ ] **Step 1: Write the failing tests.**

  **Variables** (`use-laundry-catalog-search.test.ts`, node):
  1. `laundryCatalogSearchVariables('')` equals `{ filter: { active: { is: true } }, paging: { limit: 20 }, sorting: [{ direction: 'ASC', field: 'name' }, { direction: 'ASC', field: 'id' }] }`, with no `name` key.
  2. `laundryCatalogSearchVariables('wa_sh%')` adds `name: { iLike: '%wa\\_sh\\%%' }`, the `escapeLikePattern` result wrapped in `%`.

  **Hook** (`use-laundry-catalog-search.hook.test.tsx`, jsdom, fake timers):
  - Mock `@clensy/client`'s `useServicesQuery` and `useAddOnsQuery` with the per-variables response map of `use-laundry-customer-search.hook.test.tsx`. Key the map by `filter.name?.iLike ?? ''`.
  - Record every non-skipped call's variables as a "request".
  - A `Probe({ query, active, kind })` component calls the matching hook.

  Cases, run for both `kind`s:
  1. **Inactive:** `idle`, and every call is `skip: true`.
  2. **Browse on focus:** going active with `''` sends exactly one request, with no `name` filter and `active: { is: true }`, after a 0 ms timer. While pending the result is `loading`. With a response, it is `ready` with options mapped to `{ id, name }`.
  3. **Typed search:** typing `wa` sends nothing before 300 ms and one `%wa%` request at 300 ms.
  4. **No duplicate when focus and typing overlap:** going active with `''` then typing `w` within the 0 ms tick sends only the `%w%` request. Going active, letting the browse request go, then typing sends exactly one more request per settled text.
  5. **Stale results:** never offers an older text's results for a newer text, even if the older response lingers with `loading: true`.
  6. **Distinct states:** error → `error`; empty nodes → `ready` with no options; more matches than the page holds → `truncated: true`. The trimmed text is what is searched.

- [ ] **Step 2: Run, expect failure.** The module does not exist. Record the output.

- [ ] **Step 3: Implement.** Create `apps/web/lib/use-laundry-catalog-search.ts`:

```ts
'use client';
import { useAddOnsQuery, useServicesQuery, type AddOnsQueryVariables, type ServicesQueryVariables } from '@clensy/client';
import type { LaundrySearchStatus } from '@clensy/web';
import { useEffect, useState } from 'react';
import { escapeLikePattern } from './laundry-order-list-query';
import type { LaundryCatalogChoice } from './laundry-service-selection';

export const LAUNDRY_CATALOG_SEARCH_LIMIT = 20;
export const LAUNDRY_CATALOG_SEARCH_DEBOUNCE_MS = 300;

export interface LaundryCatalogSearch {
  options: readonly LaundryCatalogChoice[];
  status: LaundrySearchStatus;
  truncated: boolean;
}

const IDLE: LaundryCatalogSearch = { options: [], status: 'idle', truncated: false };
const LOADING: LaundryCatalogSearch = { options: [], status: 'loading', truncated: false };
const FAILED: LaundryCatalogSearch = { options: [], status: 'error', truncated: false };

// Active entries only, on the server, the first 20 by name (issue Data;
// owner decision 3). An empty text browses with no name filter; otherwise a
// contains match on the name, escaped like the customer search.
export function laundryCatalogSearchVariables(text: string) {
  return {
    filter: text === '' ? { active: { is: true } } : { active: { is: true }, name: { iLike: `%${escapeLikePattern(text)}%` } },
    paging: { limit: LAUNDRY_CATALOG_SEARCH_LIMIT },
    sorting: [
      { direction: 'ASC', field: 'name' },
      { direction: 'ASC', field: 'id' },
    ],
  } satisfies AddOnsQueryVariables & ServicesQueryVariables;
}

// The searched text, once the picker has been focused (`active`). The
// browse list for an empty text is requested on the next tick; typed text
// waits out the debounce. Each text change clears the pending timer, so
// focus and typing that overlap send one request, for the latest text.
function useSearchedText(query: string, active: boolean): { searched: string | null; text: string } {
  const text = query.trim();
  const [searched, setSearched] = useState<string | null>(null);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setSearched(text), text === '' ? 0 : LAUNDRY_CATALOG_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [active, text]);
  return { searched, text };
}

// Options only for the searched text's settled query, as in
// `useLaundryCustomerSearch`: while the texts differ or the query loads, the
// result is `loading` with no options. Loading, empty and error stay
// distinct (owner decision 3).
function catalogResult(
  active: boolean,
  searched: string | null,
  text: string,
  query: { error?: unknown; loading: boolean },
  connection: { nodes: readonly LaundryCatalogChoice[]; totalCount: number } | undefined,
): LaundryCatalogSearch {
  if (!active) return IDLE;
  if (searched !== text || query.loading) return LOADING;
  if (query.error) return FAILED;
  const nodes = connection?.nodes ?? [];
  return {
    options: nodes.map(({ id, name }) => ({ id, name })),
    status: 'ready',
    truncated: (connection?.totalCount ?? nodes.length) > nodes.length,
  };
}

export function useLaundryServiceSearch(query: string, active: boolean): LaundryCatalogSearch {
  const { searched, text } = useSearchedText(query, active);
  const result = useServicesQuery({
    fetchPolicy: 'network-only',
    skip: !active || searched !== text,
    variables: laundryCatalogSearchVariables(searched ?? ''),
  });
  return catalogResult(active, searched, text, result, result.data?.services);
}

export function useLaundryAddOnSearch(query: string, active: boolean): LaundryCatalogSearch {
  const { searched, text } = useSearchedText(query, active);
  const result = useAddOnsQuery({
    fetchPolicy: 'network-only',
    skip: !active || searched !== text,
    variables: laundryCatalogSearchVariables(searched ?? ''),
  });
  return catalogResult(active, searched, text, result, result.data?.addOns);
}
```

If `satisfies` does not narrow `direction`/`field` to their literal unions under this TypeScript version, add `as const` to each sorting entry instead.

- [ ] **Step 4: Run, expect pass.** `pnpm --filter web exec vitest run lib/use-laundry-catalog-search.test.ts lib/use-laundry-catalog-search.hook.test.tsx`, then lint and `tsc --noEmit`. Expected: PASS / clean.

- [ ] **Step 5: Commit.** `feat(web): search active laundry services and add-ons (#158)`.

---

## Task 4: Selection hook

Implements owner decisions 2, 5, 6; planning decisions c, e, f; issue Data, Validation; §8.4.5.

**Files:** create `apps/web/lib/use-laundry-service-selection.ts`, `apps/web/lib/use-laundry-service-selection.hook.test.tsx`.

- [ ] **Step 1: Write the failing tests.** In `use-laundry-service-selection.hook.test.tsx` (jsdom, fake timers):
  - Mock `@apollo/client` with `importOriginal`, overriding `useApolloClient` to return `{ query: preview.query }`, as `session-guard.test.tsx` does.
  - `preview.query` records each call's `variables.input` and returns a promise the test resolves or rejects.
  - Also mock `@clensy/client`, keeping the real `PreviewLaundryOrderPriceDocument` through `importOriginal`, plus `usePriceLaundryOrderMutation: vi.fn()`.
  - A `Probe` exposes the hook's return value and calls the edit actions inside `act`.
  - Fixtures: preview payloads typed as `PreviewLaundryOrderPriceQuery['previewLaundryOrderPrice']`.

  Cases:
  1. **Not enabled, or no weight:** no request, ever, and `previewLoading` is false.
  2. **No base service:** no request, and `ready` is false.
  3. **Debounce:** choosing a base sends nothing at 299 ms and one request at 300 ms, with input `{ orderId, baseServiceId, addOns: [] }` and no `baseQuantity`. `previewLoading` is true from the choice until the response.
  4. **PER_KG:** with a `PER_KG` response, `preview.base.unit === 'PER_KG'` and `ready` is true. `priceInput` equals the request's input.
  5. **PER_ITEM learned (planning decision c; M5 part 1 P2).** The two-request transition, asserted step by step:
     1. Choosing the base sends request 1 with **no** `baseQuantity`.
     2. Request 1 resolves `PER_ITEM`. In the same `act`, `units['service:<id>']` becomes `PER_ITEM`, and the current input now carries `baseQuantity: 1`.
     3. Right after that, before request 2: `preview`, `priceInput` and `previewError` are `null`, `ready` is **false**, and `previewLoading` is **true**. The first response is never current, because its input lacks the count the current input carries.
     4. At 300 ms, exactly one request 2 is sent, with `baseQuantity: 1`. Until it resolves, the step 3 assertions still hold.
     5. Request 2 resolves. Now `ready` is true, and `priceInput.baseQuantity === 1`.
     6. Changing the count to `3` makes `ready` false at once, and sends `baseQuantity: 3` after 300 ms.
  6. **Invalid count (owner decision 6):** after `PER_ITEM` is learned, setting the count to `0` sends nothing.
     - `preview` and `priceInput` become `null`, and `ready` is false.
     - The remembered unit still says `PER_ITEM`, so the count input stays available (`units['service:<id>'] === 'PER_ITEM'`).
     - Setting it back to `3` re-requests (planning decision f).
  7. **Failed after PER_ITEM (owner decision 6):** after `PER_ITEM` is learned, a later preview rejects. `preview` is `null`, `ready` is false, `previewError` is set, and the remembered `PER_ITEM` unit stays.
  8. **Kind/id keyed units:** a remembered `service:X` unit never makes an add-on with id `X` send a quantity. Choosing a different base never inherits the previous base's unit.
  9. **Add-on rows:**
     - `addAddOn` returns a new key, distinct from all earlier ones.
     - A row with no choice is left out of the input and makes `ready` false, even with a successful preview.
     - Choosing it adds it to the input in row order.
  10. **Stable rows:** with three rows A, B, C, removing B leaves A's and C's keys, text, choice and quantity unchanged.
  11. **Duplicates (§8.4.3):** choosing an add-on already on another row does not apply it. The row's `choice` stays `null`, its `query` keeps the typed text, and `duplicate` is true. The next text edit clears `duplicate`.
  12. **Edit drops a choice:** editing a row's or the base's search text drops its choice.
  13. **Re-weigh (owner decision 6):** re-rendering with a new `weightGrams` and the same selection makes the old preview not current (`previewLoading` true, `preview` null) and sends a new request after 300 ms.
  14. **Stale responses (M5 part 1 suggestion).** The guarantee is that a stale result is rejected, not that the request is cancelled. Requests are never aborted, so each case resolves the older request's promise for real:
      - **Out of order:** request A is in flight; the input changes to B and request B is sent. B resolves first, then A. The preview stays B's, `priceInput` stays B's input, and A's lines do not reach `units`.
      - **A late success never replaces a current failure:** A in flight, then B fails, then A resolves successfully. `previewError` stays B's and `preview` stays `null`.
      - **A superseded failure never shows:** A in flight; the input changes to B; A rejects with a missing-price message. No `previewError` appears for B.
      - **Unmount:** a response that resolves after unmount sets no state. No React act or update warning is logged; `console.error` is spied and must not be called.
      - **Returning input:** A, then B, then A again re-requests A (planning decision f).
  15. **Mismatched lines:** a response whose lines do not match (an add-on out of order) gives `preview: null`, `previewError: { message: undefined, target: null }`, and `ready: false`.
  16. **Missing price (owner decision 2):**
      - A rejection whose `graphQLErrors[0].extensions.originalError.message` is `No effective price for addOnId <row id>` gives `previewError.target` `{ kind: 'addOn', key }`.
      - The same for `serviceId <base id>` gives `{ kind: 'service' }`.
      - An unknown message gives `target: null` with the raw message.
      - A network error with no GraphQL errors gives `message: undefined`.
  17. **Resolved errors (planning decision e):** a resolved result with `errors`, or without `previewLaundryOrderPrice`, is a failure.
  18. **Never prices:** across every case above, `usePriceLaundryOrderMutation` is never called, and `preview.query` is never called with any document other than `PreviewLaundryOrderPriceDocument`.
  19. **Exact current input (M5 part 2 P2).** `matchPreview` checks line correspondence only, so this case proves currency. Each outdated request resolves with lines whose ids match the current selection, so only the hook's key, not `matchPreview`, can reject it:
      - **Outdated base count:** with `PER_ITEM` remembered, the count-3 request is in flight; the count changes to 4. The count-3 response resolves with matching ids. `preview` stays `null`, `ready` false, `previewLoading` true. Only the count-4 response makes `ready` true, with `priceInput.baseQuantity === 4`.
      - **Outdated add-on count:** the same, for an add-on row's `quantity`.
      - **Outdated weight:** the request for weight 2505 is in flight; a re-render passes 3000 with the same selection. The 2505 response resolves. `preview` stays `null` until the 3000 request's response.

- [ ] **Step 2: Run, expect failure.** The module does not exist. Record the output.

- [ ] **Step 3: Implement.** Create `apps/web/lib/use-laundry-service-selection.ts`:

```ts
'use client';
import { useApolloClient } from '@apollo/client';
import {
  PreviewLaundryOrderPriceDocument,
  type PreviewLaundryOrderPriceQuery,
  type PreviewLaundryOrderPriceQueryVariables,
  type PriceLaundryOrderInput,
  type PricingUnit,
} from '@clensy/client';
import { useEffect, useRef, useState } from 'react';
import { graphQLErrorMessage } from './graphql-error-message';
import {
  EMPTY_LAUNDRY_SERVICE_SELECTION,
  laundryUnitKey,
  matchPreview,
  missingPriceTarget,
  previewInputFromSelection,
  type LaundryAddOnRow,
  type LaundryCatalogChoice,
  type LaundryMatchedPreview,
  type LaundryMissingPriceTarget,
  type LaundryPreview,
  type LaundryRememberedUnits,
  type LaundryServiceSelection,
} from './laundry-service-selection';

export const LAUNDRY_PREVIEW_DEBOUNCE_MS = 300;

type PreviewOutcome = { data: LaundryPreview; ok: true } | { message: string | undefined; ok: false };

export interface LaundryPreviewError {
  // The server's message, when there is one.
  message: string | undefined;
  // The selected line an exact missing-price message names (owner decision 2).
  target: LaundryMissingPriceTarget | null;
}

// The selection and its current preview, owned by the order page above the
// Services and Price sections (#158 Layout: "lift state to the detail
// page"). Price review (#162) reads this and starts no preview of its own.
export interface LaundryServiceSelectionState {
  // The current successful preview, matched to the rows; `null` while
  // loading, after a failure, or when the selection cannot be previewed.
  preview: LaundryMatchedPreview | null;
  previewError: LaundryPreviewError | null;
  // True through the debounce and the request.
  previewLoading: boolean;
  // The exact input `preview` was computed from; `null` whenever `preview` is.
  priceInput: PriceLaundryOrderInput | null;
  // Base chosen, every row chosen, every count valid, and a current
  // preview. #162 may offer Confirm only when this is true.
  ready: boolean;
  selection: LaundryServiceSelection;
  units: LaundryRememberedUnits;
  addAddOn: () => number;
  changeAddOnQuantity: (key: number, text: string) => void;
  changeAddOnQuery: (key: number, text: string) => void;
  changeBaseQuantity: (text: string) => void;
  changeBaseQuery: (text: string) => void;
  chooseAddOn: (key: number, choice: LaundryCatalogChoice) => void;
  chooseBase: (choice: LaundryCatalogChoice) => void;
  removeAddOn: (key: number) => void;
  touchAddOn: (key: number) => void;
  touchAddOnQuantity: (key: number) => void;
  touchBase: () => void;
  touchBaseQuantity: () => void;
}

export interface UseLaundryServiceSelectionOptions {
  // The Services view is `editor`; nothing is requested otherwise.
  enabled: boolean;
  orderId: string;
  weightGrams: number | null;
}

type ApolloQueryClient = Pick<ReturnType<typeof useApolloClient>, 'query'>;

// A resolved result with errors or without the payload is a failure too
// (planning decision e; #155 decision g).
async function runPreview(client: ApolloQueryClient, input: PriceLaundryOrderInput): Promise<PreviewOutcome> {
  try {
    const result = await client.query<PreviewLaundryOrderPriceQuery, PreviewLaundryOrderPriceQueryVariables>({
      fetchPolicy: 'network-only',
      query: PreviewLaundryOrderPriceDocument,
      variables: { input },
    });
    const payload = (result.data as PreviewLaundryOrderPriceQuery | null | undefined)?.previewLaundryOrderPrice;
    if ((result.errors?.length ?? 0) > 0 || !payload) {
      return { message: graphQLErrorMessage({ graphQLErrors: result.errors }), ok: false };
    }
    return { data: payload, ok: true };
  } catch (error) {
    return { message: graphQLErrorMessage(error), ok: false };
  }
}

function rememberUnits(units: LaundryRememberedUnits, lines: LaundryPreview['lines']): LaundryRememberedUnits {
  const next: Record<string, PricingUnit> = { ...units };
  for (const line of lines) {
    if (line.serviceId !== null) next[laundryUnitKey('service', line.serviceId)] = line.unit;
    if (line.addOnId !== null) next[laundryUnitKey('addOn', line.addOnId)] = line.unit;
  }
  return next;
}

function newRow(key: number): LaundryAddOnRow {
  return { choice: null, duplicate: false, key, quantity: '1', quantityTouched: false, query: '', touched: false };
}

export function useLaundryServiceSelection({
  enabled,
  orderId,
  weightGrams,
}: UseLaundryServiceSelectionOptions): LaundryServiceSelectionState {
  const client = useApolloClient();
  const nextKey = useRef(0);
  const generation = useRef(0);
  const [selection, setSelection] = useState<LaundryServiceSelection>(EMPTY_LAUNDRY_SERVICE_SELECTION);
  const [units, setUnits] = useState<LaundryRememberedUnits>({});
  // The request sent for a key, and the outcome that came back for it.
  // Both carry a generation, so a key that returns after another one was
  // requested is requested again (planning decision f).
  const [requested, setRequested] = useState<{ generation: number; key: string } | null>(null);
  const [settled, setSettled] = useState<{ generation: number; key: string; outcome: PreviewOutcome } | null>(null);

  const input = enabled && weightGrams !== null ? previewInputFromSelection(orderId, selection, units) : null;
  // The staleness key: the input and the weight it was quoted against
  // (owner decision 6: a re-weigh invalidates the quote).
  const key = input === null ? null : JSON.stringify([weightGrams, input]);

  useEffect(() => {
    if (key === null) return;
    const [, keyInput] = JSON.parse(key) as [number, PriceLaundryOrderInput];
    let live = true;
    const timer = setTimeout(() => {
      generation.current += 1;
      const sent = { generation: generation.current, key };
      setRequested(sent);
      void runPreview(client, keyInput).then((outcome) => {
        // Dropped once the key changed or the page unmounted.
        if (!live) return;
        if (outcome.ok) setUnits((current) => rememberUnits(current, outcome.data.lines));
        setSettled({ ...sent, outcome });
      });
    }, LAUNDRY_PREVIEW_DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [client, key]);

  const outcome =
    key !== null && requested?.key === key && settled?.key === key && settled.generation === requested.generation
      ? settled.outcome
      : null;
  const preview = outcome?.ok && input ? matchPreview(input, selection, outcome.data) : null;
  let previewError: LaundryPreviewError | null = null;
  if (outcome && !outcome.ok) {
    previewError = {
      message: outcome.message,
      target: outcome.message === undefined ? null : missingPriceTarget(outcome.message, selection),
    };
  } else if (outcome?.ok && !preview) {
    previewError = { message: undefined, target: null };
  }
  const previewLoading = key !== null && outcome === null;
  const complete = input !== null && selection.addOns.every((row) => row.choice !== null);

  function updateRow(rowKey: number, change: (row: LaundryAddOnRow) => LaundryAddOnRow) {
    setSelection((current) => ({
      ...current,
      addOns: current.addOns.map((row) => (row.key === rowKey ? change(row) : row)),
    }));
  }

  return {
    preview,
    previewError,
    previewLoading,
    priceInput: preview ? input : null,
    ready: complete && preview !== null && !previewLoading,
    selection,
    units,
    addAddOn: () => {
      const rowKey = nextKey.current;
      nextKey.current += 1;
      setSelection((current) => ({ ...current, addOns: [...current.addOns, newRow(rowKey)] }));
      return rowKey;
    },
    changeAddOnQuantity: (rowKey, text) => updateRow(rowKey, (row) => ({ ...row, quantity: text })),
    // A user edit drops the row's choice (the picker selection contract, #160).
    changeAddOnQuery: (rowKey, text) =>
      updateRow(rowKey, (row) => ({ ...row, choice: null, duplicate: false, query: text })),
    changeBaseQuantity: (text) => setSelection((current) => ({ ...current, baseQuantity: text })),
    changeBaseQuery: (text) => setSelection((current) => ({ ...current, base: null, baseQuery: text })),
    // The same add-on twice is blocked here, in the UI only (§8.4.3): the
    // row keeps its typed text and says so.
    chooseAddOn: (rowKey, choice) =>
      setSelection((current) => {
        const taken = current.addOns.some((row) => row.key !== rowKey && row.choice?.id === choice.id);
        return {
          ...current,
          addOns: current.addOns.map((row) => {
            if (row.key !== rowKey) return row;
            if (taken) return { ...row, choice: null, duplicate: true };
            return { ...row, choice, duplicate: false, quantity: '1', quantityTouched: false, query: choice.name };
          }),
        };
      }),
    chooseBase: (choice) =>
      setSelection((current) => ({
        ...current,
        base: choice,
        baseQuantity: '1',
        baseQuantityTouched: false,
        baseQuery: choice.name,
      })),
    removeAddOn: (rowKey) =>
      setSelection((current) => ({ ...current, addOns: current.addOns.filter((row) => row.key !== rowKey) })),
    touchAddOn: (rowKey) => updateRow(rowKey, (row) => ({ ...row, touched: true })),
    touchAddOnQuantity: (rowKey) => updateRow(rowKey, (row) => ({ ...row, quantityTouched: true })),
    touchBase: () => setSelection((current) => ({ ...current, baseTouched: true })),
    touchBaseQuantity: () => setSelection((current) => ({ ...current, baseQuantityTouched: true })),
  };
}
```

Notes for the implementer:
- `generation` is a ref, mutated only inside the timer callback, never during render.
- If lint (`react-hooks`) objects to reading `key` through `JSON.parse` inside the effect, keep the parse. It is what lets the effect depend on `key` alone, without a fresh `input` object on every render.
- If `@typescript-eslint/no-unnecessary-condition` flags the `payload` check, the widening cast above is the intended fix. Do not add a non-null assertion.

- [ ] **Step 4: Run, expect pass.** `pnpm --filter web exec vitest run lib/use-laundry-service-selection.hook.test.tsx`, then lint and `tsc --noEmit`. Expected: PASS / clean.

- [ ] **Step 5: Commit.** `feat(web): laundry services selection state and debounced price preview (#158)`.

---

## Task 5: Copy and the services editor

Implements owner decisions 2, 3, 6; planning decisions b, d, i, j; issue Fields, Layout, Validation; §8.4.4 Services bullet.

**Files:** modify `packages/web/src/i18n/messages/en/laundry.ts`. Create `apps/web/components/laundry/laundry-services-editor.tsx`, `apps/web/lib/laundry-services-editor.interaction.test.tsx`.

- [ ] **Step 1: Copy.** In `packages/web/src/i18n/messages/en/laundry.ts`, replace the `order.services` block:

```ts
    services: {
      none: 'No services selected yet.',
      priced: 'Services are priced. The lines are listed under Overview.',
    },
```

with:

```ts
    services: {
      addAddOn: 'Add add-on',
      addOn: 'Add-on {n}',
      base: 'Base service',
      beforeWeigh: 'Weigh the order before choosing services.',
      byWeight: 'Priced by weight',
      count: 'Number of items',
      duplicate: 'This add-on is already on the order.',
      error: {
        base: 'Choose a base service.',
        count: 'Enter a whole number of items, at least 1.',
        emptyRow: 'Choose an add-on or remove this row.',
      },
      flat: 'Flat price',
      locked: 'Services are locked because this order has been priced.',
      none: 'No services selected yet.',
      noPrice: '{name} has no current price.',
      noPriceRow: 'No current price.',
      note: 'This is a preview. The price is final only after you confirm it.',
      previewFailure: 'Couldn’t preview the price.',
      rate: {
        flat: '{price} flat',
        perItem: '{price} per item',
        perKg: '{price} per kg',
      },
      removeAddOn: 'Remove add-on {n}',
      search: {
        addOn: { empty: 'No active add-ons match.', error: 'Couldn’t load add-ons.' },
        more: 'Showing the first 20. Type to narrow.',
        searching: 'Searching…',
        service: { empty: 'No active services match.', error: 'Couldn’t load services.' },
      },
    },
```

  Replace the `order.overview` block:

```ts
    overview: {
      noLines: 'No lines yet. Lines are added when the order is priced.',
    },
```

  with:

```ts
    overview: {
      noLines: 'No lines yet. Lines are added when the order is priced.',
      priced: '{n} services priced.',
      pricedOne: '1 service priced.',
      pricedPartial: 'Services are priced.',
      seeServices: 'See Services',
    },
```

  In `order.lines`, remove `addOn: 'Add-on',` and `service: 'Base service',` (planning decision h). First run `grep -rn "lines\.service\|lines\.addOn\|services\.priced" apps/web packages/web/src --include=*.ts --include=*.tsx`, excluding `.next`. The only users must be `page.tsx` and its render test, which Task 6 changes. Use the typographic apostrophe (’) to match the file's existing "…" style; if the file uses straight quotes in its other strings, match that instead.

- [ ] **Step 2: Write the failing editor tests.** In `apps/web/lib/laundry-services-editor.interaction.test.tsx` (jsdom, fake timers):
  - Mount the **real** hook and editor through a harness component that calls `useLaundryServiceSelection({ enabled: true, orderId, weightGrams })` and renders `<LaundryServicesEditor state={state} />`. This mirrors how the page wires them.
  - Mock `@apollo/client`'s `useApolloClient`, and `@clensy/client`'s `useServicesQuery` / `useAddOnsQuery`, with fixed catalogs: services Wash (PER_KG), Shoes (PER_ITEM), Dry clean (FLAT), Duvet (PER_SERVICE); add-ons Ironing (PER_ITEM), Softener (FLAT).
  - The preview mock answers per input from a unit table, with `rateMinorUnits` of 5000 / 2500 / 15000 / 20000.

  Cases (each run to the preview, i.e. past 300 ms with the promise resolved):
  1. **Layout:** the root is `flex flex-col gap-4`. The base search's label is "Base service". There is no `<form>` and no submit button (planning decision j). The note "This is a preview. The price is final only after you confirm it." is present.
  2. **Browse on focus:** focusing the base search opens a listbox of the services. Focusing an add-on search lists the add-ons.
  3. **PER_KG:** shows "Priced by weight" and `2.505 kg` (the preview line's quantity through `formatWeightGrams`). There is no "Number of items" input. The rate reads "₱50.00 per kg".
  4. **PER_ITEM:** a "Number of items" input appears holding `1` (planning decision c), with `inputmode="numeric"`. No label anywhere in the base block contains "kg". The rate reads "₱25.00 per item".
  5. **FLAT and PER_SERVICE:** show "Flat price" and the rate "₱150.00 flat" / "₱200.00 flat". There is no count input.
  6. **Add-on rows follow the same rule per row:** Ironing shows its own "Number of items" input. Softener shows "Flat price". Labels are "Add-on 1" and "Add-on 2", and remove buttons "Remove add-on 1" and "Remove add-on 2".
  7. **Count `0` (owner decision 6):** after blur, shows "Enter a whole number of items, at least 1.". The input stays, and the old rate phrase is gone. Blank, `-1` and `1.5` behave the same.
  8. **Failed after PER_ITEM (owner decision 6):** the count input stays and the old rate phrase is gone.
  9. **Duplicate:** choosing Ironing in row 2 while row 1 holds it shows "This add-on is already on the order." on row 2, keeps row 2's typed text, and sends no request with Ironing twice.
  10. **Empty row:** leaving an empty add-on row shows "Choose an add-on or remove this row.". Leaving the base empty shows "Choose a base service." (planning decision b).
  11. **Missing price, matched:** a rejection naming Softener's id shows one `role="alert"` reading "Softener has no current price." (the catalog choice name, not a `description`). The Softener row shows "No current price.". The raw text `No effective price for addOnId …` appears nowhere.
  12. **Missing price, fallback:** a rejection with an unknown message shows that message once, in the alert, and no row marker.
  13. **Other failure without a message:** "Couldn’t preview the price.".
  14. **Stale error cleared:** after case 11, removing the Softener row removes the alert and the marker at once, before the next preview.
  15. **Focus:** "Add add-on" moves focus to the new row's search input. "Remove add-on 1" moves focus to "Add add-on".
  16. **Stable rows:** with three rows, removing row 2 keeps row 3's text and count in its inputs (now labelled "Add-on 2").
  17. **Amounts come from the preview:** with a preview whose `rateMinorUnits` differs from the catalog list's `activePricing.priceMinorUnits` / `AddOn.priceMinorUnits`, the page shows the preview's figure only. The test sets the list price to 99900 and asserts "₱999.00" is absent.
  18. **Never prices:** `usePriceLaundryOrderMutation` is never called.

- [ ] **Step 3: Run, expect failure.** The editor does not exist. Record the output.

- [ ] **Step 4: Implement.** Create `apps/web/components/laundry/laundry-services-editor.tsx`:

```tsx
'use client';

import type { PricingUnit } from '@clensy/client';
import { Button, FormField } from '@clensy/ui';
import { LaundrySearchCombobox, formatWeightGrams, useClensyTranslations } from '@clensy/web';
import { useEffect, useRef, useState } from 'react';
import { formatMinorUnits } from '../../lib/format-price';
import {
  laundryRateKey,
  laundryUnitKey,
  parseItemCount,
  type LaundryAddOnRow,
  type LaundryCatalogChoice,
  type LaundryPreviewLine,
} from '../../lib/laundry-service-selection';
import { useLaundryAddOnSearch, useLaundryServiceSearch } from '../../lib/use-laundry-catalog-search';
import type { LaundryServiceSelectionState } from '../../lib/use-laundry-service-selection';

type Translate = (key: string) => string;

const BASE_SEARCH_ID = 'laundry-base-service';
const BASE_COUNT_ID = 'laundry-base-count';

function addOnSearchId(key: number): string {
  return `laundry-add-on-${String(key)}`;
}

function addOnCountId(key: number): string {
  return `laundry-add-on-count-${String(key)}`;
}

export interface LaundryServicesEditorProps {
  // From `useLaundryServiceSelection`, owned by the page (#158).
  state: LaundryServiceSelectionState;
}

// Base service and add-ons for a WEIGHED order (lifecycle spec §8.4.4,
// #158). Every unit, count input and rate comes from the server: the count
// input from the remembered unit, the unit display and rate from the
// current preview only (owner decision 6). It never prices (#162 does) and
// computes no amount.
export function LaundryServicesEditor({ state }: LaundryServicesEditorProps) {
  const t = useClensyTranslations('laundry');
  const { preview, previewError, selection, units } = state;
  const addRef = useRef<HTMLButtonElement>(null);
  // A row to focus once it has rendered; a new object per request.
  const [focusRow, setFocusRow] = useState<{ key: number } | null>(null);
  const [focusAdd, setFocusAdd] = useState<object | null>(null);

  useEffect(() => {
    if (focusRow) document.getElementById(addOnSearchId(focusRow.key))?.focus();
  }, [focusRow]);
  useEffect(() => {
    if (focusAdd) addRef.current?.focus();
  }, [focusAdd]);

  const target = previewError?.target ?? null;
  let alert: string | null = null;
  if (previewError) {
    const name =
      target?.kind === 'service'
        ? selection.base?.name
        : target?.kind === 'addOn'
          ? selection.addOns.find((row) => row.key === target.key)?.choice?.name
          : undefined;
    alert =
      name !== undefined
        ? t('order.services.noPrice').replace('{name}', name)
        : (previewError.message ?? t('order.services.previewFailure'));
  }

  const baseError = (() => {
    if (selection.baseTouched && !selection.base) return t('order.services.error.base');
    if (target?.kind === 'service') return t('order.services.noPriceRow');
    return undefined;
  })();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1">
          <CatalogPicker
            id={BASE_SEARCH_ID}
            kind="service"
            label={t('order.services.base')}
            error={baseError}
            query={selection.baseQuery}
            onBlur={state.touchBase}
            onQueryChange={state.changeBaseQuery}
            onSelect={state.chooseBase}
            t={t}
          />
        </div>
        <LineDetail
          countId={BASE_COUNT_ID}
          count={selection.baseQuantity}
          countTouched={selection.baseQuantityTouched}
          line={preview?.base ?? null}
          rememberedUnit={selection.base ? units[laundryUnitKey('service', selection.base.id)] : undefined}
          onCountBlur={state.touchBaseQuantity}
          onCountChange={state.changeBaseQuantity}
          t={t}
        />
      </div>

      {selection.addOns.map((row, index) => (
        <AddOnRowEditor
          key={row.key}
          n={index + 1}
          noPrice={target?.kind === 'addOn' && target.key === row.key}
          line={preview?.addOns.get(row.key) ?? null}
          row={row}
          rememberedUnit={row.choice ? units[laundryUnitKey('addOn', row.choice.id)] : undefined}
          state={state}
          onRemove={() => {
            state.removeAddOn(row.key);
            setFocusAdd({});
          }}
          t={t}
        />
      ))}

      <Button
        ref={addRef}
        type="button"
        variant="secondary"
        className="self-start"
        onClick={() => setFocusRow({ key: state.addAddOn() })}
      >
        {t('order.services.addAddOn')}
      </Button>

      {alert ? (
        <p role="alert" className="text-red-600">
          {alert}
        </p>
      ) : null}

      <p className="text-slate-600">{t('order.services.note')}</p>
    </div>
  );
}

function AddOnRowEditor({
  line,
  n,
  noPrice,
  onRemove,
  rememberedUnit,
  row,
  state,
  t,
}: {
  line: LaundryPreviewLine | null;
  n: number;
  noPrice: boolean;
  onRemove: () => void;
  rememberedUnit: PricingUnit | undefined;
  row: LaundryAddOnRow;
  state: LaundryServiceSelectionState;
  t: Translate;
}) {
  const label = t('order.services.addOn').replace('{n}', String(n));
  // One message per row, most specific first.
  const error = row.duplicate
    ? t('order.services.duplicate')
    : row.touched && !row.choice
      ? t('order.services.error.emptyRow')
      : noPrice
        ? t('order.services.noPriceRow')
        : undefined;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="flex-1">
          <CatalogPicker
            id={addOnSearchId(row.key)}
            kind="addOn"
            label={label}
            error={error}
            query={row.query}
            onBlur={() => state.touchAddOn(row.key)}
            onQueryChange={(text) => state.changeAddOnQuery(row.key, text)}
            onSelect={(choice) => state.chooseAddOn(row.key, choice)}
            t={t}
          />
        </div>
        <LineDetail
          countId={addOnCountId(row.key)}
          count={row.quantity}
          countTouched={row.quantityTouched}
          line={line}
          rememberedUnit={rememberedUnit}
          onCountBlur={() => state.touchAddOnQuantity(row.key)}
          onCountChange={(text) => state.changeAddOnQuantity(row.key, text)}
          t={t}
        />
      </div>
      <Button type="button" variant="secondary" className="self-start" onClick={onRemove}>
        {t('order.services.removeAddOn').replace('{n}', String(n))}
      </Button>
    </div>
  );
}

// The count input from the remembered unit; the unit display and the rate
// from the current preview line only (owner decision 6).
function LineDetail({
  count,
  countId,
  countTouched,
  line,
  onCountBlur,
  onCountChange,
  rememberedUnit,
  t,
}: {
  count: string;
  countId: string;
  countTouched: boolean;
  line: LaundryPreviewLine | null;
  onCountBlur: () => void;
  onCountChange: (text: string) => void;
  rememberedUnit: PricingUnit | undefined;
  t: Translate;
}) {
  const countError = countTouched && parseItemCount(count) === null ? t('order.services.error.count') : undefined;
  return (
    <div className="flex flex-col gap-2 sm:w-56">
      {line?.unit === 'PER_KG' ? (
        <div>
          <p className="font-medium text-slate-900">{t('order.services.byWeight')}</p>
          <p>{formatWeightGrams(line.quantity)}</p>
        </div>
      ) : null}
      {line?.unit === 'FLAT' || line?.unit === 'PER_SERVICE' ? (
        <p className="font-medium text-slate-900">{t('order.services.flat')}</p>
      ) : null}
      {rememberedUnit === 'PER_ITEM' ? (
        <FormField
          label={t('order.services.count')}
          name={countId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={count}
          error={countError}
          onChange={(event) => onCountChange(event.currentTarget.value)}
          onBlur={onCountBlur}
        />
      ) : null}
      {line ? (
        <p className="text-slate-600">
          {t(`order.services.rate.${laundryRateKey(line.unit)}`).replace('{price}', formatMinorUnits(line.rateMinorUnits))}
        </p>
      ) : null}
    </div>
  );
}

// A catalog search on the shared combobox. It browses on focus (owner
// decision 3); the server does every filter.
function CatalogPicker({
  error,
  id,
  kind,
  label,
  onBlur,
  onQueryChange,
  onSelect,
  query,
  t,
}: {
  error: string | undefined;
  id: string;
  kind: 'addOn' | 'service';
  label: string;
  onBlur: () => void;
  onQueryChange: (text: string) => void;
  onSelect: (choice: LaundryCatalogChoice) => void;
  query: string;
  t: Translate;
}) {
  const [active, setActive] = useState(false);
  const serviceSearch = useLaundryServiceSearch(query, active && kind === 'service');
  const addOnSearch = useLaundryAddOnSearch(query, active && kind === 'addOn');
  const search = kind === 'service' ? serviceSearch : addOnSearch;
  return (
    <LaundrySearchCombobox
      id={id}
      copy={{
        empty: t(`order.services.search.${kind}.empty`),
        error: t(`order.services.search.${kind}.error`),
        label,
        more: t('order.services.search.more'),
        searching: t('order.services.search.searching'),
      }}
      error={error}
      openOnFocus
      options={search.options}
      query={query}
      status={search.status}
      truncated={search.truncated}
      renderOption={(option) => <span className="block text-sm text-slate-900">{option.name}</span>}
      onBlur={onBlur}
      onFocus={() => setActive(true)}
      onQueryChange={onQueryChange}
      onSelect={onSelect}
    />
  );
}
```

Notes for the implementer:
- `CatalogPicker` calls both search hooks so that hook order never changes. The hook for the other kind stays `active: false`, which means skipped with no request.
- Case 11's expected alert uses the **choice name** as the catalog lists it ("Softener"), not the server's `description`, because a failed preview returns no lines.

- [ ] **Step 5: Run, expect pass.** `pnpm --filter web exec vitest run lib/laundry-services-editor.interaction.test.tsx`, `pnpm --filter @clensy/web test`, then lint and `tsc --noEmit` for both packages. Expected: PASS / clean.

- [ ] **Step 6: Commit.** `feat(web): laundry services and add-ons editor (#158)`.

---

## Task 6: Page wiring, saved lines and the Overview pointer

Implements owner decisions 1, 4, 5; planning decision g; issue When it shows, Role and lifecycle; §8.4.4, §8.4.2.

**Files:** modify `apps/web/app/app/laundry/[id]/page.tsx`, `apps/web/lib/laundry-order-page.render.test.tsx`.

- [ ] **Step 1: Write the failing render tests.** In `laundry-order-page.render.test.tsx`:

  **Harness changes:**
  - Add `description: string` to `Line['pricingSnapshot']`. `line()` sets `description: 'Wash & fold'` by default; tests override it per line.
  - The `@clensy/client` mock gains `useServicesQuery` and `useAddOnsQuery` (return `{ data: undefined, error: undefined, loading: false }` for a skipped call, and record every call), plus `PreviewLaundryOrderPriceDocument: {}` and `usePriceLaundryOrderMutation: vi.fn()`.
  - Add `vi.mock('@apollo/client', async (importOriginal) => ({ ...(await importOriginal()), useApolloClient: () => ({ query: page.previewQuery }) }))`, where `page.previewQuery` is a `vi.fn()` reset in `beforeEach`.

  **Changed cases:**
  - "shows em dashes and no line list for a received order": Services now contains "Weigh the order before choosing services." and not "No services selected yet.".
  - "shows the recorded weight, the total and the lines once priced":
    - The descriptions are `Wash & fold`, `Ironing (add-on)` and `Softener (add-on)`.
    - **Overview** contains `3 services priced.` and a link `href="#laundry-order-services"` reading "See Services". It has no `<li`, no "Base service" and no "Minimum charge applied".
    - **Services** contains "Services are locked because this order has been priced.", three `<li`, each description, "Per kg" with `>Weight</dt>` and `2.505 kg`, "Per item" with `>Items</dt>` and `>3</dd>`, "Flat", `₱300.00`, and one "Minimum charge applied".
    - Price is unchanged.
  - "warns when more lines exist than were loaded": the note is in **Services**. Overview reads "Services are priced." with the link and no count (planning decision g).

  **New cases:**
  1. **Overview pointer, singular:** one line → "1 service priced.".
  2. **`WEIGHED` × OPS_MANAGER (editor):**
     - Services contains a combobox labelled "Base service", "Add add-on", and the preview note.
     - It contains no "Weigh the order", no "No services selected yet." and no "locked".
     - Controls appear only in Weighing and Services: with both sections removed, the page has no `<button`, `<form` or `<input` (the #156 comment's narrowing).
     - No preview request is sent by a static render (`page.previewQuery` not called).
     - `usePriceLaundryOrderMutation` is never called.
  3. **`WEIGHED` with the role loading** (`page.role = undefined`): the Services section's body is empty. It has its `<h2>` and nothing else: no "No services selected yet." and no input.
  4. **`WEIGHED` × CUSTOMER_SUPPORT, FINANCE, ANALYST** (`it.each`): "No services selected yet.", no `<input` in Services, no "Base service".
  5. **`RECEIVED` × each of the six roles:** "Weigh the order before choosing services.", no `role="combobox"` in Services.
  6. **`PRICED` × CUSTOMER_SUPPORT:** the locked sentence and the saved lines; no search input.
  7. **`CANCELLED` and `REJECTED`, with saved lines** (`it.each` over both): the saved lines, **no** "Services are locked", and no input.
  8. **`CANCELLED` and `REJECTED`, without lines:** "No services selected yet.", no locked sentence.
  9. **Nav unchanged:** the existing current-section cases still pass. `WEIGHED` × OPS_MANAGER still marks Services.

- [ ] **Step 2: Run, expect failure.** `pnpm --filter web exec vitest run lib/laundry-order-page.render.test.tsx`. Expected: the changed and new cases FAIL; the rest pass. Record which.

- [ ] **Step 3: Implement.** In `apps/web/app/app/laundry/[id]/page.tsx`:

  **Imports.** Add:

```ts
import { LaundryServicesEditor } from '../../../../components/laundry/laundry-services-editor';
import { laundryServicesView, type LaundryServicesView } from '../../../../lib/laundry-service-selection';
import {
  useLaundryServiceSelection,
  type LaundryServiceSelectionState,
} from '../../../../lib/use-laundry-service-selection';
```

  **Header comment.** Update the comment above `LaundryOrderPage`: "Weighing records a weight (#155). Services chooses the base service and add-ons and previews their units and rates (#158). Price (#162), Invoice (#166) and Actions (#165) still show facts until their issues add controls. The list still opens the drawer until the cutover (#161)."

  **Sections.** Replace:

```tsx
      <OrderSection section="services" t={t}>
        <p>{t(order.lines.nodes.length > 0 ? 'order.services.priced' : 'order.services.none')}</p>
      </OrderSection>

      <OrderSection section="price" t={t}>
        {order.totalMinorUnits === null ? (
          <p>{t('order.price.notPriced')}</p>
        ) : (
          <Fact term={t('order.price.total')}>{formatMinorUnits(order.totalMinorUnits)}</Fact>
        )}
      </OrderSection>
```

  with:

```tsx
      <PricingSections order={order} roleResolved={role !== undefined} verbs={verbs} t={t} />
```

  **New components.** Add after `WeighingBody`:

```tsx
// Services and Price share the selection and its current preview (#158).
// The state lives here, above both sections, so price review (#162) reads
// it instead of starting a second preview. The workspace is keyed by order
// id, so another order starts with an empty selection.
function PricingSections({
  order,
  roleResolved,
  t,
  verbs,
}: {
  order: LaundryOrderDetail;
  roleResolved: boolean;
  t: Translate;
  verbs: readonly LaundryOrderVerb[];
}) {
  const view = laundryServicesView({
    hasLines: order.lines.nodes.length > 0,
    roleResolved,
    status: order.status,
    verbs,
  });
  const selection = useLaundryServiceSelection({
    enabled: view === 'editor',
    orderId: order.id,
    weightGrams: order.weightGrams,
  });
  return (
    <>
      <OrderSection section="services" t={t}>
        <ServicesBody order={order} selection={selection} t={t} view={view} />
      </OrderSection>

      <OrderSection section="price" t={t}>
        {order.totalMinorUnits === null ? (
          <p>{t('order.price.notPriced')}</p>
        ) : (
          <Fact term={t('order.price.total')}>{formatMinorUnits(order.totalMinorUnits)}</Fact>
        )}
      </OrderSection>
    </>
  );
}

// Owner decision 4 (#158).
function ServicesBody({
  order,
  selection,
  t,
  view,
}: {
  order: LaundryOrderDetail;
  selection: LaundryServiceSelectionState;
  t: Translate;
  view: LaundryServicesView;
}) {
  switch (view) {
    case 'hidden':
      return null;
    case 'editor':
      return <LaundryServicesEditor state={selection} />;
    case 'beforeWeigh':
      return <p>{t('order.services.beforeWeigh')}</p>;
    case 'none':
      return <p>{t('order.services.none')}</p>;
    case 'locked':
      return (
        <div className="flex flex-col gap-3">
          <p>{t('order.services.locked')}</p>
          <SavedLines order={order} t={t} />
        </div>
      );
    case 'lines':
      return <SavedLines order={order} t={t} />;
  }
}

// The saved lines, by their frozen names (§8.4.2; owner decision 1). After
// pricing the page shows the snapshot, never a new estimate (§8.4.4).
function SavedLines({ order, t }: { order: LaundryOrderDetail; t: Translate }) {
  const { nodes, pageInfo } = order.lines;
  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {nodes.map((line) => {
          const { amountMinorUnits, description, minimumChargeApplied, quantity, unit } = line.pricingSnapshot;
          const shown = laundryLineQuantity(unit, quantity);
          return (
            <li key={line.id} className="rounded-md border border-slate-200 p-3">
              <p className="font-medium text-slate-900">{description}</p>
              <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div>
                  <dt className="text-slate-500">{t('order.lines.unit')}</dt>
                  <dd>{t(`order.unit.${unit}`)}</dd>
                </div>
                {shown ? (
                  <div>
                    <dt className="text-slate-500">{t(`order.lines.${shown.kind}`)}</dt>
                    <dd>{shown.value}</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-slate-500">{t('order.lines.amount')}</dt>
                  <dd>{formatMinorUnits(amountMinorUnits)}</dd>
                </div>
              </dl>
              {minimumChargeApplied ? <p className="mt-2 text-slate-600">{t('order.lines.minimumCharge')}</p> : null}
            </li>
          );
        })}
      </ul>
      {pageInfo.hasNextPage === true ? <p className="text-slate-600">{t('order.lines.more')}</p> : null}
    </div>
  );
}
```

  **Overview.** Replace the body of `OverviewBody` with:

```tsx
// Before pricing, the existing sentence; afterwards one line that points
// at Services, which owns the line list (owner decision 1). The count is
// the saved lines, never the selection or the preview. A partial page has
// no reliable count (planning decision g).
function OverviewBody({ order, t }: { order: LaundryOrderDetail; t: Translate }) {
  const { nodes, pageInfo } = order.lines;
  if (nodes.length === 0) return <p>{t('order.overview.noLines')}</p>;
  const summary =
    pageInfo.hasNextPage === true
      ? t('order.overview.pricedPartial')
      : nodes.length === 1
        ? t('order.overview.pricedOne')
        : t('order.overview.priced').replace('{n}', String(nodes.length));
  return (
    <p>
      {summary}{' '}
      <a href={`#${laundryOrderSectionId('services')}`} className="underline">
        {t('order.overview.seeServices')}
      </a>
    </p>
  );
}
```

  `laundryLineQuantity` stays imported (now used by `SavedLines`).

- [ ] **Step 4: Run, expect pass.** `pnpm --filter web test`, `pnpm --filter web lint`, `pnpm --filter web exec tsc --noEmit`. Expected: PASS / clean.

- [ ] **Step 5: Commit.** `feat(web): choose laundry services on the order page (#158)`.

---

## Task 7: Verification, browser check and report

- [ ] **Step 1: Full automated run.** Record each command as PASS, FAIL or NOT RUN, with counts:
  - `pnpm --filter web test`
  - `pnpm --filter web lint`
  - `pnpm --filter web exec tsc --noEmit`
  - `pnpm --filter @clensy/web test`
  - `pnpm --filter @clensy/web lint`
  - `pnpm --filter @clensy/web build`
  - **API suites: NOT RUN.** This slice changes no file under `apps/api` or `packages/client` (verify with `git diff --stat main...HEAD -- apps/api packages/client`, expected empty). The release-gate and tenant-isolation suites are excluded and are not claimed as covered.
- [ ] **Step 2: Browser check (recorded separately from the automated tests).** Against the local dev stack, on a `WEIGHED` order as OPS_MANAGER:
  1. Focus "Base service": the first page of active services lists.
  2. Choose a `PER_KG` service: "Priced by weight" with the order weight, and the rate.
  3. Choose a `PER_ITEM` service: "Number of items" holding 1. Change it to 3, then 0 (error, rate gone), then 2.
  4. Choose a flat service.
  5. Add two add-on rows: choose the same add-on twice (blocked with the message), remove a row (focus returns to "Add add-on").
  6. Make an add-on with no active pricing rule (or use one if seeded): the alert names it and the row is marked.
  7. Narrow the viewport to 375 px: no horizontal scroll; search and count stack.
  8. As CUSTOMER_SUPPORT on the same order: "No services selected yet.", no search.
  9. In the browser network panel: no `priceLaundryOrder` request at any point.

  Record each item as observed, not observed, or not run.
- [ ] **Step 3: Record M6.** Append an Execution record to this plan:
  - each task's red/green results as actually observed;
  - any deviation, and why;
  - the Step 1 and Step 2 results;
  - a statement that authorization and status enforcement stay server-side (§8.4.5 RBAC; the UI view is presentation only).
- [ ] **Step 4: Slice Completion Report** per `docs/workflows/conventions/reporting-conventions.md`, then hand off to M7 (fresh independent reviewer on the most capable model, with this plan, the Accepted spec and the branch diff).

---

## Traceability

| Requirement | Source | Task |
|---|---|---|
| Editable only for `WEIGHED` ∩ OPERATIONAL; read-only copy otherwise | Issue When it shows, Role and lifecycle; §4.4; owner decision 4 | 1, 6 |
| Active services/add-ons, server filters, `name.iLike`, limit 20 | Issue Data; owner decision 3 | 3 |
| Combobox behavior same as the customer picker | Issue Fields; owner decision 5 | 2 |
| Unit only from the preview; count input only for `PER_ITEM`; no quantity for `PER_KG`/flat | §8.4.4 Services bullet; §4.5 step 3a; issue Fields | 1, 4, 5 |
| Rate phrases with `formatMinorUnits` | Issue Fields | 5 |
| No client amounts | §8.4.4; issue Acceptance | 4, 5 (case 17) |
| Preview debounced ~300 ms, refetch on change, latest cached for price review | Issue Data; §8.4.5 | 4 |
| Item count: whole number ≥ 1 | Issue Validation | 1, 5 |
| Duplicate add-on blocked in the UI only | Issue Fields; §8.4.3 | 4, 5 |
| Preview failure shows the server message; no Confirm-ready state | Issue Fields; owner decision 2 | 1, 4, 5 |
| `previewLoading` exposed for #162 | Issue Validation | 4 |
| Layout, note, mobile stacking | Issue Layout | 5, 7 |
| Saved lines after price, with frozen names; locked copy | Issue When it shows; §8.4.2; owner decisions 1, 4 | 6 |
| Never calls `priceLaundryOrder` | Issue Acceptance, Out of scope | 4, 5, 6, 7 |

## Deferred / out of scope

- `priceLaundryOrder`, the breakdown card, "Estimate"/"Final price", Confirm and its disabled rules: **#162**. #162 consumes `LaundryServiceSelectionState` (`ready`, `previewLoading`, `priceInput`, `preview`) and must not start its own preview.
- Any server rule for repeated add-ons (§8.6).
- Catalog CRUD; exposing `PricingRule.unit` on the catalog (§8.4.5: not exposed).
- Changing quantity-resolution rules.
- Narrowing the services catalog to laundry-only services. The `Service` filter has no kind or category, so the picker lists every active service. A service with no laundry pricing rule surfaces through the missing-price alert (owner decision 2).
- Price, Invoice and Actions sections; the list page and the drawer cutover (#161).

## Execution / scheduling risks

- **Combobox extraction (Task 2)** touches #160's shipped picker. Mitigation: the regression net is run before and after, unedited, and Task 2 is a separate commit.
- **Apollo `client.query` typing (Task 4):** the generic call and the `errors` field differ slightly between Apollo 3.x minors. Mitigation: the widening cast in `runPreview`; `tsc --noEmit` is the gate.
- **A first `PER_ITEM` choice sends two previews** (planning decision c). Accepted cost; not a correctness risk.
- **#162 depends on this state's shape.** Changing `LaundryServiceSelectionState` after merge is a #162 planning concern, not a reason to widen this slice.
