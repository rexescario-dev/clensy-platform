# Laundry Intake Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | **Accepted (revision 3)**. M6 complete; M7 Approved for merge (independent review); M8 N/A; M9 complete; M10 validated. |
| M5 decision | **Accepted** — 2026-10-14, at `40e2888` (revision 3), by the owner, after a consistency check of revision 3: every second-pass finding has a log row; planned test counts match the stated expectations (e2e 4, fieldset 4, picker static 5, picker interaction 10, variables 2, hook 9, intake 16, plus the list-error characterization test); the picker clears its stored active id; the hook skips at once on an empty input; the fulfillment error describes the radio group. This accepts the plan only. No planned suite, lint, typecheck, build or e2e has run. M6 runs **subagent-driven** from `40e2888`: task order and per-task commits as written, `git status --short` before each commit, stop on any unexpected failure (Task 1: never change API code to make it pass), subagent reports checked against the actual diff and command output, and actual results recorded in the M6 Slice Completion Report. M7 MUST be a fresh independent review (`CLAUDE.md`: application code). |
| M5 second pass | 2026-10-13/14, owner, reviewed `be71c1c` in five topical parts: **Returned for Revision**. Part 1 acceptable. Part 2 blocking: an emptied input must skip the query at once, and a lingering earlier result must stay unavailable during a search change. Part 3 blocking: a stale active id could come back; the blur test should move focus for real. Part 4 P2: test a `fulfillmentType` server error and its clearing. Part 5 P2: prove the list's error after a failed background refresh; tighten the Step 2 expected failure. All resolved in [Revision 3 (M5 review 2)](#revision-3-m5-review-2). |
| M5 history | First pass (2026-10-13, owner, reviewed in five parts): **Returned for Revision**. Findings covered customer-search completeness, stale search results, the submit guard's lifecycle, picker active-option state, hook-level tests, a search mock keyed on variables, a create response without an order id, the success ordering, and test and command details. Every finding is resolved or answered in [Revision 2 (M5 review 1)](#revision-2-m5-review-1). |
| Date | 2026-10-13 |
| Tracking issue | [#160](https://github.com/rexescario-dev/clensy-platform/issues/160) "Redesign the laundry order creation modal". Epic [#154](https://github.com/rexescario-dev/clensy-platform/issues/154). Depends on [#157](https://github.com/rexescario-dev/clensy-platform/issues/157) (closed; shared `laundry` copy, `canReceiveLaundryOrder`) and [#163](https://github.com/rexescario-dev/clensy-platform/issues/163) (closed; the list and its create button, merged in #170). Cutover navigation is [#161](https://github.com/rexescario-dev/clensy-platform/issues/161) (open). The order page is [#156](https://github.com/rexescario-dev/clensy-platform/issues/156) (open). |
| Branch | `feat/160-laundry-intake-modal`, from `main` at `47503f5`. One PR for this plan, its M5 record and the implementation. |
| Scope | `packages/web` (two presentational components, `laundry` copy, exports, static tests), `apps/web` (new intake dialog component, customer-search module, page wiring, tests), one new `apps/api/test` e2e characterization file. No API source, schema, migration, GraphQL operation, generated client, or `@clensy/ui` change. No new dependency. |
| Implements (Accepted) | [Laundry Orders & Lifecycle](../specs/2026-09-06-laundry-orders-lifecycle-design.md), Status **Accepted** (2026-09-06), with **Amendment #164**, Accepted 2026-10-10. Governing text: §8.4.4, second bullet: "Intake stays a `FormDialog` on the list. Customer selection can reach any customer the customers query returns, not only the first 100. Fulfillment is `PICKUP` (customer pickup) or `DELIVERY`, chosen at intake and immutable. The form says that the choice is fixed and that delivery does not schedule a route. Creating a customer inline is out of scope. Success opens `/app/laundry/[id]` for the new order." Also §8.2 ("No inline customer creation in the intake modal"), §8.6 (deferral of inline customer creation), §4.4 (`receiveLaundryOrder` RBAC: OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT). |
| Relies on (Accepted, merged) | [Laundry UI Foundation plan](2026-10-10-laundry-ui-foundation-plan.md) (#157): `canReceiveLaundryOrder`, `LaundryFulfillmentType`, the `laundry` message catalog (including the existing `fulfillment.PICKUP` / `fulfillment.DELIVERY` labels). [Laundry Order List plan](2026-10-10-laundry-order-list-plan.md) (#163): `escapeLikePattern`, `useDetailDrawer().openWithHref`, `hrefFor`, the native-History create-success open, and the jsdom page harness. [Role-aware typed URLs](../specs/2026-10-04-role-aware-typed-urls-design.md): `canViewPath`. [Clensy validation](../specs/2026-09-15-clensy-validation-design.md): `clensyResolver`, `normalizeApiValidationErrors`. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. Issue #160 refines the spec's bullet with copy, layout and test requirements; it adds no product semantics beyond §8.4.4. File names, component and hook names, copy keys, element ids and task order are planning decisions, not product semantics. |
| Edit anchors | New files are given in full. Edits to existing files are given against `main` at `47503f5`. Apply each by the quoted code, not by line number. |
| Package names | `pnpm --filter web` is `apps/web` (package `web`). `pnpm --filter @clensy/web` is `packages/web`. They are two different packages; both appear in verification on purpose. `pnpm --filter api` is `apps/api`. |
| Pre-validation | **None claimed.** Read-only spikes ran at planning time and are recorded under [Planning spikes](#planning-spikes); no task's `Expected:` commands were run. |
| M7 | Application code changes, so `CLAUDE.md` requires a **fresh independent reviewer** on the most capable model, given this plan, the Accepted spec and the branch diff. |

**Goal:** Replace the intake dialog on `/app/laundry` with the one §8.4.4 describes: a searchable customer picker that reaches every customer by name (not the first 100), an explained, fixed-at-intake fulfillment choice, `react-hook-form` validation, an in-dialog failure alert, one mutation per submit, and a success toast. Until the cutover (#161), a successful create still opens the existing drawer on the new order so it can be weighed.

**Architecture:**

- **Presentational pieces in `@clensy/web`** (the #163 `LaundryOrderDataTable` precedent: props-driven, copy from the `laundry` namespace, no `@clensy/client` import):
  - `LaundryCustomerPicker`: a WAI-ARIA combobox built from a native `<input>` and a `role="listbox"` popup. It owns only open/closed and the active option, which it tracks by **customer id**, never by position, so a changed result set can never move it onto a different customer. The caller owns the text, the options, the search status and the selection.
  - `LaundryFulfillmentFieldset`: a `fieldset`/`legend` with two native radios, each with its label and description.
- **Data and form in `apps/web`:**
  - `lib/use-laundry-customer-search.ts`: the GraphQL variables (`fullName.iLike`, limit 20, escaped like the list) and a hook that debounces the trimmed text 300 ms. The searched text **starts empty**, so even the first non-empty text waits out the debounce. While the searched text differs from the input, or the query is loading, the hook returns `loading` and **no options**. An empty text sends no query (`skip`) and returns `idle`. It also reports `truncated` when the server counts more matches than the page holds.
  - `components/laundry/create-laundry-order-dialog.tsx`: `FormDialog` + `react-hook-form` + `clensyResolver`, the `receiveLaundryOrder` mutation, server field errors via `normalizeApiValidationErrors`, the generic `role="alert"`, and a synchronous in-flight guard taken **before validation** and released when the attempt settles.
  - `app/app/laundry/page.tsx`: opens the dialog (a new React `key` per opening remounts it, which resets the form, the search, the alert and the guard), shows the "Add a customer" link only when `canViewPath(principal, '/app/customers')`, and on success closes, toasts, **opens the drawer with the id the mutation returned**, then refreshes the list behind it without awaiting.
- **Escape inside the dialog.** `Modal` closes on a `document`-level `keydown` Escape. The picker stops propagation of Escape only while its list is open, so the first Escape closes the list and the next one closes the dialog.

**Tech Stack:** React 19, Next.js 16 app router, Apollo Client (`@clensy/client` generated hooks), `react-hook-form` 7, `@clensy/validation`, Tailwind, Vitest (`renderToStaticMarkup` in `packages/web`; jsdom in `apps/web`), Jest + supertest e2e in `apps/api`.

**Spec:** `docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md` §8.4.4 (with §8.2, §8.6, §4.4).

## Global Constraints

Derived from the Accepted spec and issue #160. Every task's requirements implicitly include this section.

- **SHALL** keep intake a `FormDialog` on the list (`Modal` + form + Cancel / submit), at the existing modal width (`max-w-lg`). No full-page wizard, no second page. Content stays `flex flex-col gap-4` (provided by `FormDialog`).
- **SHALL** title the dialog "New laundry order"; submit "Create order", and "Creating…" while submitting.
- **SHALL** search customers on the server: `customers(filter: { fullName: { iLike: "%<text>%" } }, paging: { limit: 20 })`, debounced ~300 ms, with `%`, `_` and `\` escaped as the list does. **SHALL NOT** query `customers` with `limit: 100` or unfiltered.
- **Search guarantee (what "reach any customer" means here).** Every customer can be found by searching their name: the filter runs on the server over all of the tenant's customers, not over a preloaded page. Each search shows at most 20 matches. When the server counts more matches than that, the list says "More customers match. Type more of the name to narrow the search." There is no load-more control. Narrowing the text is the supported way to reach a customer beyond the first 20 matches. More than 20 customers whose full names are identical is a known limit (see [Deferred](#deferred-not-in-this-plan)).
- **SHALL** show `fullName` with `phone`, or `email` when `phone` is empty, as `text-sm text-slate-500` secondary text. Both fields are non-null in the generated `CustomersQuery` and required by `createCustomer`, so every option shows one of them.
- **SHALL** offer only results for the text currently in the input. While a newer search is pending, no option is rendered, none is active, and Enter selects nothing.
- **SHALL** give the input `role="combobox"`, `aria-expanded`, `aria-controls`, `aria-activedescendant`; the list `role="listbox"`; each row `role="option"`. ArrowUp/ArrowDown move the active option, Enter selects, Escape closes the list. `aria-activedescendant` only ever names an option that is rendered.
- **SHALL** show "Searching…" (one line in the list), "No customers match.", and "Unable to search customers." inline. No full-page `LoadingState`.
- **Selection contract.** Choosing an option sets the selected customer id and shows that customer's name in the input. Any later user edit of the input, including clearing it, clears the selected id. Submit is then refused with "Select a customer." until an option is chosen again.
- **SHALL** require a customer with the message "Select a customer.", through `react-hook-form` + `clensyResolver`. Three failure paths stay distinct:
  - **Client validation:** no customer selected → "Select a customer." on the field, field focused, no mutation.
  - **Server field validation:** errors that `normalizeApiValidationErrors` maps to `customerId` or `fulfillmentType` → shown on that field; no generic alert. The error clears when the field's value changes.
  - **Anything else** (network, unexpected): "Unable to create laundry order." with `role="alert"` inside the dialog.
  In every failure path the dialog stays open, the fields keep their values, and submit is re-enabled.
- **SHALL**, if the mutation succeeds but its response carries no order id, keep the dialog open, open nothing, show no success toast, and show "The order may have been created. Check the laundry list before trying again." with `role="alert"`. Nothing is retried automatically.
- **SHALL** render fulfillment as a `fieldset` with `legend` "Fulfillment", helper "This choice is fixed at intake.", and two native radios: `PICKUP` "Customer pickup" / "The customer collects the finished laundry."; `DELIVERY` "Delivery" / "The shop returns the finished laundry. This does not schedule a route." Rows `rounded-md border px-3 py-2`, `border-slate-300`, selected `border-slate-900`, `sm:grid sm:grid-cols-2 sm:gap-3`. These classes are the issue's own visual contract, which is why tests assert them. Default `PICKUP`. Required.
- **SHALL NOT** add inline customer creation (spec §8.2, §8.6). An "Add a customer" link to `/app/customers` shows only when `canViewPath` allows that path. No nested dialog. No customer-create permission logic in this modal. Three authorization concerns stay separate: `canReceiveLaundryOrder` shows the create button; `canViewPath` shows the link; the server authorizes `receiveLaundryOrder` and every customer operation.
- **SHALL** call `receiveLaundryOrder({ customerId, fulfillmentType })`, the existing mutation. **SHALL NOT** add or change any GraphQL operation, resolver, schema or migration.
- **SHALL** on success: close the dialog, `useToast().success("Laundry order created.")`, and open the existing drawer for the **id the mutation returned** via `openWithHref`, at once (pre-cutover). The list refresh runs after that and is not awaited; a slow or failed refresh cannot keep the drawer closed. The `/app/laundry/[id]` navigation is #161's. The PR body MUST say so (see Task 6).
- **SHALL** send at most one mutation per submit, including two submits fired in the same turn, before React re-renders. The guard is taken synchronously before validation and released when the attempt settles, so a failed attempt can be retried.
- **SHALL** reset customer, fulfillment (`PICKUP`), errors and the submit guard on every opening.
- **SHALL** keep the create button limited to `canReceiveLaundryOrder` (FINANCE and ANALYST never see it; unchanged from #163).
- **SHALL** put every new user-facing string in `packages/web/src/i18n/messages/en/laundry.ts` and read it with `useClensyTranslations('laundry')`. Fulfillment labels reuse the existing `fulfillment.PICKUP` / `fulfillment.DELIVERY` keys.
- **SHALL NOT** modify `@clensy/ui`, `apps/api/src`, `apps/api/src/schema.gql`, any migration, `packages/client`, or `docs/workflows/**`. Add no dependency. `@clensy/web` does not import `@clensy/client`.
- **SHALL NOT** change the list, the drawer, `useDetailDrawer`, or the URL state. The page's only changes are the intake block, its imports, and the success handler.

## Review Focus

Inputs and conditions the spec implies that a person will meet. Each has a test in the owning task.

1. **Typing after a selection.** A user picks "Ana Reyes", then edits the text to "Ana R". The selection must clear, and submit must say "Select a customer." → Task 3 (`clears the selected id when the text is edited after choosing`), Task 5 (`clears the selection when the text changes after choosing`).
2. **Escape with the list open.** Escape must close the list, not the whole dialog and the typed text with it. → Task 3 (`closes the list with Escape...`), Task 5 (`closes the list on the first Escape and the dialog on the next`), with the real `Modal`.
3. **Namesakes.** Two customers with the same name must be told apart by phone, or email when phone is empty. → Task 1 e2e, Task 3 static test, Task 5 results test.
4. **Fast typing and stale results.** "an" → "ana" → "an", and clearing while a request is in flight: an older text's results are never offered for a newer text. → Task 4 hook tests, Task 3 (`offers nothing while a newer search loads`), Task 5 (`never lets a result for an earlier text be chosen`).
5. **Wildcard characters in a name.** "50% Off" is matched literally. → Task 4 variables test (escaping reuses the list's `escapeLikePattern`, already e2e-pinned for `%` in `laundry-order-list-filters.e2e-spec.ts`).
6. **More than 20 matches.** A common name must not silently hide customers: the list says more match and asks for more of the name. → Task 4 (`flags more matches than the page holds`), Task 3 static test.

## Planning spikes

Read-only checks run at planning time, for M5. They are not pre-validation of any task.

- **Baseline suites at `47503f5`:** `pnpm --filter web test` → 29 files, 712 tests passed. `pnpm --filter @clensy/web test` → 13 files, 402 tests passed.
- **`next/link` under jsdom:** a throwaway `apps/web/lib` test rendered `<Link href="/app/customers">` with `next/navigation` mocked as the page harness mocks it. It rendered `href="/app/customers"` and passed. The file was deleted.
- **Customers query:** `packages/client/src/operations/customers.graphql` already declares `$filter: CustomerFilter` and `$sorting`, and selects `totalCount`; `CustomerFilter.fullName` is a `StringFieldComparison` (has `iLike`); `CustomerSortFields` includes `fullName` and `id`; nodes carry non-null `email` and `phone`. No client change or regeneration is needed.
- **RBAC:** `customer.type.ts` `VIEW_ROLES` (mirrored in `nav-groups.ts`) include every intake role (TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT), so `canViewPath` shows the link to all of them. `createCustomer` is OWNER, OPS_MANAGER, CUSTOMER_SUPPORT; a SCHEDULER `createCustomer` → `FORBIDDEN` is already e2e-pinned in `customers-properties.e2e-spec.ts` and is not duplicated here.
- **Escape:** `useDialogBehavior` listens for Escape on `document` (bubble). React 19 dispatches from the root container, so a synthetic `stopPropagation()` on the input's `keydown` keeps the event from `document`. Task 3 pins it against a stand-in listener and Task 5 against the real `Modal`. **Corrected in M6 (fix round `9a0e67a`):** that holds only for a non-document root. Next.js hydrates React on `document`, so React's listener and `Modal`'s share a node and `stopPropagation()` does not stop `Modal`'s; the picker also calls `nativeEvent.stopImmediatePropagation()`. See Gate outcomes → M6.
- **Validation:** `required` treats `''` as empty (`packages/validation/src/rules.ts`, `isEmpty`). `formatMessage` substitutes `:attribute` from `options.attributes`, so a template of `':attribute'` with a per-field attribute prints a whole localized sentence per field.
- **Server field-error shape:** `normalizeApiValidationErrors` reads Apollo's thrown `graphQLErrors` array, and in it `extensions.originalError.message` (an array of `"<field> <constraint>"` strings). `packages/validation/src/normalize.test.ts` pins that Apollo-shaped case against `__fixtures__/create-customer-validation-error.json`, a captured real response (`"email must be an email"`). The Task 5 mock uses that shape with `customerId` as the field.
- **Typing in jsdom:** the merged `laundry-list-page.interaction.test.tsx` already types into a controlled input with the native `HTMLInputElement.prototype.value` setter plus a bubbling `input` event (`typeSearch`), and that suite passes today. The repo has no `@testing-library/user-event`. The new tests use the same helper rather than add a dependency.
- **E2e fixtures:** `laundry-order-list-filters.e2e-spec.ts` (#163) keeps its customers and orders in the shared bootstrap tenant and isolates them with a per-run name tag, with no cleanup. Task 1 follows that convention.
- **Apollo on a variable change (M5 review 2 spike, 2026-10-14):** a throwaway jsdom test drove the real `useQuery` of the installed `@apollo/client` 3.14.1 under `MockedProvider`, `fetchPolicy: 'network-only'`, changing `fullName.iLike` from `%an%` to a delayed `%ana%`. Per-render trace: `%an% loading=true data=none` → `%an% loading=false data=an` → `%ana% loading=true data=none prev=an` → `%ana% loading=false data=ana`. Apollo never pairs the new variables with the old data; the old data appears only in `previousData`, which the hook does not read. The hook does not rely on that alone: it also returns `loading` with no options whenever `result.loading` is true, and Task 4 pins that against a mock that returns lingering data with `loading: true`. The file was deleted.
- **Apollo on a failed `refetch()` (M5 review 2 spike, 2026-10-14):** same setup, a successful first response, then a refetch that errors. Trace: `loading=false error=none data=1` → `loading=true data=1` → `loading=false error="network down" data=1`, and the `refetch()` promise rejected with "network down". So the page's `.catch(() => undefined)` only stops an unhandled rejection; the failure still reaches `ordersQuery.error`, which the page passes as `hasError`. `LaundryOrderDataTable` then renders "Unable to load laundry orders." (pinned in `laundry-order-data-table.test.tsx`), and the rows stay on screen. Task 5 adds a page-level test of that wiring. The file was deleted.

## File map

| File | Change | Responsibility |
| --- | --- | --- |
| `apps/api/test/laundry-intake-customer-search.e2e-spec.ts` | Create | Characterization: SCHEDULER name search (mixed-case fragment, server page limit vs total count, namesakes distinguishable) and SCHEDULER intake. |
| `packages/web/src/i18n/messages/en/laundry.ts` | Modify | `create.*` copy. |
| `packages/web/src/laundry/laundry-fulfillment-fieldset.tsx` (+ `.test.tsx`) | Create | Fulfillment fieldset. |
| `packages/web/src/laundry/laundry-customer-picker.tsx` (+ `.test.tsx`) | Create | Combobox markup and keyboard. |
| `packages/web/src/index.ts` | Modify | Export both components and their types. |
| `apps/web/lib/laundry-customer-picker.interaction.test.tsx` | Create | jsdom keyboard, mouse, blur, Escape, result-change and selection-contract tests of the picker. |
| `apps/web/lib/use-laundry-customer-search.ts` | Create | Search variables, debounce, status, truncation. |
| `apps/web/lib/use-laundry-customer-search.test.ts` | Create | Variables and escaping (node). |
| `apps/web/lib/use-laundry-customer-search.hook.test.tsx` | Create | The hook in jsdom: debounce, skip, statuses, stale-text safety, truncation. |
| `apps/web/components/laundry/create-laundry-order-dialog.tsx` | Create | The intake form. |
| `apps/web/app/app/laundry/page.tsx` | Modify | Mount the dialog, link visibility, success handler. |
| `apps/web/lib/laundry-list-page.test.tsx` | Modify | Wrap in `ToastProvider`. |
| `apps/web/lib/laundry-list-page.interaction.test.tsx` | Modify | Mocks, the existing create-race test, new intake tests. |

## Traceability

| Requirement | Source | Task |
| --- | --- | --- |
| Intake stays a `FormDialog`; title, labels, width | §8.4.4; #160 §Modal | 5 |
| Any customer reachable, not the first 100 | §8.4.4; #160 §Customer, AC1 | 1, 4, 5 |
| Searchable picker, keyboard, ARIA, states | #160 §Customer, §Accessibility | 3, 5 |
| Required customer, server errors, alert | #160 §Customer, §Submit | 5 |
| Fulfillment explained, fixed at intake, no route | §8.4.4; #160 §Fulfillment, AC2 | 2 |
| No inline customer creation; link gated by `canViewPath` | §8.2, §8.6; #160 §Inline customer creation, AC5 | 1, 5 |
| `receiveLaundryOrder`; no new mutation | §4.4; #160 AC6 | 1, 5 |
| Success: close, toast, drawer until #161 | §8.4.4 (navigation at #161); #160 §Submit, AC3 | 5, 6 |
| One mutation per submit | #160 §Submit, AC4 | 5 |
| Reset on open | #160 §States | 5 |
| FINANCE / ANALYST see no create button | §4.4; #160 §States | existing `laundry-list-page.test.tsx` (unchanged, re-run in 6) |

## Deferred (not in this plan)

- Navigating to `/app/laundry/[id]` on success, and removing the drawer: #161 (after #156).
- Inline customer creation: spec §8.6.
- Editing fulfillment after create, the customer form, and order-page sections: #160 §Out of scope.
- A load-more or second page of customer matches. Narrowing the text is the supported path (Global Constraints, Search guarantee). A tenant with more than 20 customers whose full names are identical cannot reach the 21st by name alone. Searching by phone or email would need a filter the `customers` query does not offer today. Filed as a product question, with the same-phone namesake observation, as [#182](https://github.com/rexescario-dev/clensy-platform/issues/182).
- A live result-count announcement (for example "3 customers found"). Neither #160 nor the spec asks for it, and `useClensyTranslations`' `t()` has no interpolation for a count. Screen readers already hear the expanded state, the active option, and the Searching / no-match / more-match / error lines, which use `role="status"` or `role="alert"`. This can be a follow-up if the owner wants it.
- **Follow-up from M7 (T5-a):** Escape or a backdrop click can close the dialog while a create is pending (`FormDialog` disables only Cancel and does not pass `submitting` to `Modal`). The create still completes (toast and drawer), but a failure after the close is silent, and reopening can start a second create. The fix belongs in `@clensy/ui` (`FormDialog`/`Modal` ignore close while `submitting`), for every form dialog, which this slice could not change. Filed as [#180](https://github.com/rexescario-dev/clensy-platform/issues/180), and resolved there by PR [#192](https://github.com/rexescario-dev/clensy-platform/pull/192) ([plan](2026-10-16-form-dialog-submit-guard-plan.md)).
- **Live-region timing (M7 observation):** the picker's status lines mount with their text inside a container that leaves `hidden`; some screen readers announce only changes to a live region that already exists. A persistent, initially empty status node would be more robust. Not required by #160 or the spec. Filed, with M7 T2-a and T2-b, as [#181](https://github.com/rexescario-dev/clensy-platform/issues/181).

## Revision 2 (M5 review 1)

The owner reviewed revision 1 in five parts on 2026-10-13 and returned it for revision. Each finding is listed with its resolution. **Changed** means this revision changes the plan. **Covered** means revision 1 already did it, and the location is given. **Answered** means a fact or convention resolves it without a plan change.

| Part / finding | Resolution |
| --- | --- |
| 1 · P1 Search completeness | **Changed.** Global Constraints now states the search guarantee: server-side name search over every customer, at most 20 per search, an explicit "More customers match…" line when the server counts more (`truncated`, Tasks 3–4), no load-more, narrowing as the supported path. The identical-names limit is listed under Deferred. The e2e paging test is renamed to what it asserts (Task 1). |
| 1 · P1 Stale search results | **Changed.** The hook's searched text starts empty; options are returned only when the searched text equals the input and the query is not loading. New jsdom hook tests (Task 4, `use-laundry-customer-search.hook.test.tsx`) cover "an" → "ana" → "an", clearing in flight, and a response arriving after clearing. The page mock now answers per search text (Task 5). |
| 1 · P1 Submit guard lifecycle | **Changed.** The guard is taken synchronously in the submit handler **before** `react-hook-form` validation and released in `finally` (Task 5 Step 5). The remount per opening gives a clean guard. Tests: two submits in one turn → one mutation; failure then retry → second mutation (Task 5). |
| 1 · P2 Picker interaction | **Covered** for blur-before-click (`onMouseDown` `preventDefault`, Task 3 test), arrows, Enter not submitting, and Escape. **Changed:** the active option is tracked by id, and new Task 3 tests pin that `aria-activedescendant` names only a rendered option through result changes, loading, and clearing. The selection-clearing contract is now a stated picker contract and is tested at picker level too. |
| 1 · P2 Failure paths | **Covered** in revision 1 (Task 5 tests for client validation, server field error, network failure with fields kept). **Changed:** the three paths are stated in Global Constraints; the server-field-error test now also asserts submit is re-enabled and that the error clears when the customer is chosen again. |
| 1 · P2 Success ordering | **Changed.** The drawer opens at once with the id the mutation returned; the list refresh is no longer awaited. The test makes the refresh hang and still sees the drawer open on the returned id, with one mutation and the dialog closed. |
| 1 · P2 RBAC boundary | **Covered.** The SCHEDULER test (Task 5) checks create, the link, and no customer form. The existing static test pins the create button by role. **Changed:** the three separate concerns are now stated in Global Constraints. |
| 2 · P2 E2e mixed-case fragment; paging test name | **Changed.** New test searching a mixed-case fragment from inside the name. Paging test renamed to "applies the page limit on the server while totalCount still counts every match". |
| 2 · P2 Existing `fulfillment.*` keys | **Answered.** `fulfillment.PICKUP: 'Customer pickup'` and `fulfillment.DELIVERY: 'Delivery'` exist on `main` (`laundry.ts`). **Changed:** Task 2's Interfaces now list them as consumed. |
| 2 · P3 Class-name assertions | **Answered.** Issue #160 specifies those exact classes, so they are a stated visual contract (now said in Global Constraints). The radio state is also asserted (`checked`). |
| 2 · P3 E2e cleanup | **Answered.** This follows the #163 `laundry-order-list-filters.e2e-spec.ts` convention: rows stay in the bootstrap tenant, with a per-run tag (Planning spikes). |
| 3 · P1 Edit after select | **Changed.** Stated as the picker's selection contract (Task 3 Interfaces); a picker-level test with a selected-id harness, plus the Task 5 page test (covered in revision 1). |
| 3 · P1 Stale active option | **Changed.** The active option is a customer id, not an index. A changed result set keeps it on the same customer or drops it; loading or empty results leave nothing active. New tests. |
| 3 · P1 Typing helper | **Answered.** This is the repo's established helper (`typeSearch` in the merged list interaction test); no user-event dependency exists. See Planning spikes. |
| 3 · P2 Empty-query behavior | **Changed.** Stated: an empty or blank text is `idle`, the list is collapsed, nothing is active, no query is sent. New picker test for clearing; hook test for blank text. |
| 3 · P2 Stale results at picker level | **Changed.** New test: after an option was active, switching to `loading` renders no option, sets no `aria-activedescendant`, and Enter selects nothing. The hook side is in Task 4. |
| 3 · P2 Result announcement | **Answered / deferred** (see Deferred): not asked for by #160 or the spec, and `t()` has no interpolation. Status lines are already live regions. |
| 3 · notes | Real-`Modal` Escape: **covered** by the Task 5 page test. Empty phone and email: **answered** (both non-null and required). `JSX.Element` return type: **changed**, removed from Interfaces; the component has no explicit return type, like the other `@clensy/web` components. |
| 4 · P1 Debounce on first value | **Changed.** `useState('')`, so a first non-empty text waits 300 ms. Hook test pins it at 299 and 300 ms. |
| 4 · P1 Hook-level tests | **Changed.** New `use-laundry-customer-search.hook.test.tsx` (jsdom), with a mocked `useCustomersQuery` that answers per variables as Apollo's cache does. |
| 4 · P1 Page mock lifecycle | **Changed.** The page mock answers by search text; an unknown text stays in flight (`loading: true`). A new page test pins that an earlier text's result cannot be chosen while the next search runs. |
| 4 · P1 Guard at the mutation boundary | **Changed.** See Part 1 · P1 Submit guard. Both submit events are dispatched synchronously in one `act`; the second returns at the guard before validation. |
| 4 · P2 Server error shape | **Answered.** The shape is the normalizer's pinned Apollo case (Planning spikes). The test asserts the message lands in `#laundry-customer-error` and no generic alert shows. |
| 4 · P2 No-match test rerender | **Changed.** No mid-test mutation of mock data: "zz" has its own preset empty response, reached by typing and waiting out the debounce. |
| 4 · P2 Harness breadth | **Changed.** Every added mock field is reset in `beforeEach` (listed in Task 5 Step 1); Task 5 Step 2 runs the existing page tests alone first; Step 7 runs focused files before the full suite. |
| 5 · P1 Selection vs edit | **Covered.** `onSelect` sets the text through `setCustomerQuery` directly, not through `onQueryChange`, so a selection never clears itself; only the input's `onChange` calls `onQueryChange`. The success test submits right after choosing. **Changed:** stated in the Selection contract. |
| 5 · P1 Response without an id | **Changed.** New copy `create.unconfirmed`, kept open with `role="alert"`, no toast, no drawer, no automatic retry. New Task 5 test. |
| 5 · P1 Package filters | **Answered.** `web` and `@clensy/web` are two different workspace packages (header row "Package names"; both verified at planning time). |
| 5 · P2 Commit file list | **Covered.** Tasks 2, 3 and 4 each commit their own files; Task 5 commits only its own. **Changed:** each commit step now runs `git status --short` first and expects only that task's files. |
| 5 · P2 Drawer waits on refetch | **Changed.** See Part 1 · P2 Success ordering. |
| 5 · P2 Clearing a server field error | **Changed.** `react-hook-form`'s default `reValidateMode: 'onChange'` re-runs the resolver when the field changes after a submit, which removes the server error once the value is valid. The server-field-error test now pins it. |
| 5 · P2 Missing-id test | **Changed.** See Part 5 · P1. |

## Revision 3 (M5 review 2)

The owner reviewed revision 2 (`be71c1c`) in five topical parts. Same legend as above.

| Part / finding | Resolution |
| --- | --- |
| 1 · Mixed-case e2e (withdrawn by the reviewer) | **Answered.** No change. The test stays unrun until M6 (header "Pre-validation"), and Task 1 Step 2 still says to stop and report on failure, with no API change. |
| 2 · Blocking: emptied input must skip at once | **Changed.** `skip: text === '' \|\| searched === ''` (Task 4 Step 4). The clear-in-flight hook test now asserts the last query call after clearing is skipped. |
| 2 · Blocking: lingering result during a search change | **Changed.** New hook test: the mock returns the previous search's nodes **with** `loading: true` for the new pattern; the hook returns `loading` with no options. The real Apollo trace is recorded under Planning spikes. |
| 3 · Blocking: stale active id can come back | **Changed.** The picker clears the stored `activeId` during render whenever the search is not `ready` or that customer is not in the rendered results (a guarded state update during render, React's documented pattern for adjusting state to props). A reorder that keeps the customer keeps it active. New regression test: active `c2` → loading → results without `c2` → results with `c2` again → nothing active until an arrow key. |
| 3 · Blur test with a real focus move | **Changed.** The harness has a second focusable button; the test calls `.focus()` on it, so jsdom fires the real focus events. The mouse-selection test is unchanged. |
| 4 · P2 `fulfillmentType` server error | **Changed.** `LaundryFulfillmentFieldset` gains an optional `error` (Task 2). It was missing, so a server error on that field had nowhere to show. The dialog passes it (Task 5). New page test: the message appears on the fulfillment field, no generic alert, dialog open, submit enabled; choosing the other radio clears it; a second submit sends a second mutation. |
| 5 · P2 Failed background refresh shows the list's error | **Changed.** Evidence under Planning spikes (Apollo sets `error` after a failed refetch). New page test in `laundry-list-page.test.tsx`: an orders query with rows and an error renders "Unable to load laundry orders." and keeps the rows. |
| 5 · P2 Step 2 expected failure | **Changed.** Task 5 Step 2 now states the acceptance criterion: every other existing page test passes, and the create-race test fails only because the old dialog has no `#laundry-customer` combobox. Any other failure in that test or elsewhere is a harness defect to fix first. |

---

### Task 1: Characterize the API reads and writes intake relies on

**Characterization test.** It pins behavior that already works and is expected to pass on first run. No API code changes.

**Files:**
- Create: `apps/api/test/laundry-intake-customer-search.e2e-spec.ts`

**Interfaces:**
- Consumes: `seedTenantAdmin(dataSource, role, tenantId)` from `apps/api/test/helpers/seed-tenant-admin.ts`; `BOOTSTRAP_TENANT_ID`; the `login`, `createCustomer`, `customers`, `receiveLaundryOrder`, `laundryOrder` GraphQL operations.
- Produces: nothing used by later tasks.

- [ ] **Step 1: Write the test**

```ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app/app.module';
import { Role } from '../src/platform/auth/domain/role';
import { BOOTSTRAP_TENANT_ID } from '../src/platform/database/bootstrap-tenant';
import { applyPlatformPipes } from '../src/platform/graphql/apply-platform-pipes';
import { seedTenantAdmin } from './helpers/seed-tenant-admin';

// Characterization (#160): pins the existing reads and writes the laundry
// intake modal relies on, as a SCHEDULER: the one intake role that cannot
// create customers (its createCustomer FORBIDDEN is pinned in
// customers-properties.e2e-spec.ts). No API code changes in #160. As in
// laundry-order-list-filters.e2e-spec.ts, rows stay in the shared bootstrap
// tenant and every name carries a per-run tag.
describe('laundry intake customer search (e2e)', () => {
  let app: INestApplication<App>;
  let ownerCookie: string;
  let schedulerCookie: string;
  let tag: string;
  const customerIds = { anaFirst: '', anaSecond: '' };

  const SEARCH = `query($f: CustomerFilter, $p: OffsetPaging, $s: [CustomerSort!]) {
    customers(filter: $f, paging: $p, sorting: $s) {
      totalCount
      nodes { id fullName email phone }
    }
  }`;

  function gql(cookie: string, query: string, variables?: object) {
    return request(app.getHttpServer())
      .post('/graphql')
      .set('Cookie', cookie)
      .send({ query, variables });
  }

  async function login(email: string, password: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({
        query: `mutation L($i: LoginInput!) { login(loginInput: $i) { success } }`,
        variables: { i: { email, password } },
      });
    return (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0];
  }

  async function customer(name: string, slug: string, phone: string): Promise<string> {
    const res = await gql(
      ownerCookie,
      `mutation($i: CreateCustomerInput!){ createCustomer(input:$i){ id } }`,
      { i: { email: `${slug}-${tag}@example.com`, fullName: `${name} ${tag}`, phone } },
    );
    expect(res.body.errors).toBeUndefined();
    return res.body.data.createCustomer.id;
  }

  // The modal's variables (apps/web/lib/use-laundry-customer-search.ts).
  function searchVariables(text: string, limit = 20) {
    return {
      f: { fullName: { iLike: `%${text}%` } },
      p: { limit },
      s: [
        { direction: 'ASC', field: 'fullName' },
        { direction: 'ASC', field: 'id' },
      ],
    };
  }

  async function searchIds(text: string): Promise<string[]> {
    const res = await gql(schedulerCookie, SEARCH, searchVariables(text));
    expect(res.body.errors).toBeUndefined();
    return res.body.data.customers.nodes.map((node: { id: string }) => node.id).sort();
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    applyPlatformPipes(app);
    await app.init();

    const dataSource = moduleFixture.get(DataSource);
    const owner = await seedTenantAdmin(dataSource, Role.TENANT_OWNER, BOOTSTRAP_TENANT_ID);
    const scheduler = await seedTenantAdmin(dataSource, Role.SCHEDULER, BOOTSTRAP_TENANT_ID);
    ownerCookie = await login(owner.email, owner.password);
    schedulerCookie = await login(scheduler.email, scheduler.password);
    tag = `${scheduler.id.slice(0, 8)}${Date.now()}`;

    customerIds.anaFirst = await customer('Ana Reyes', 'ana-first', '555-0101');
    customerIds.anaSecond = await customer('Ana Reyes', 'ana-second', '555-0102');
    await customer('Ben Cruz', 'ben', '555-0103');
  });

  afterAll(async () => {
    await app.close();
  });

  it('finds customers by name for a SCHEDULER, with phone and email to tell namesakes apart', async () => {
    const res = await gql(schedulerCookie, SEARCH, searchVariables(`ana reyes ${tag}`));
    expect(res.body.errors).toBeUndefined();
    const { nodes, totalCount } = res.body.data.customers;
    expect(totalCount).toBe(2);
    expect(nodes.map((node: { id: string }) => node.id).sort()).toEqual(
      [customerIds.anaFirst, customerIds.anaSecond].sort(),
    );
    expect(nodes.map((node: { phone: string }) => node.phone).sort()).toEqual(['555-0101', '555-0102']);
    expect(new Set(nodes.map((node: { email: string }) => node.email)).size).toBe(2);
  });

  it('matches a mixed-case fragment from inside the name', async () => {
    // "eYeS <TAG>" starts mid-word and flips the case of the stored name.
    expect(await searchIds(`eYeS ${tag.toUpperCase()}`)).toEqual(
      [customerIds.anaFirst, customerIds.anaSecond].sort(),
    );
  });

  it('applies the page limit on the server while totalCount still counts every match', async () => {
    const res = await gql(schedulerCookie, SEARCH, searchVariables(`ana reyes ${tag}`, 1));
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.customers.nodes).toHaveLength(1);
    expect(res.body.data.customers.totalCount).toBe(2);
  });

  it('lets a SCHEDULER receive an order for a customer found by search', async () => {
    const received = await gql(
      schedulerCookie,
      `mutation($i: ReceiveLaundryOrderInput!){ receiveLaundryOrder(input:$i){ id } }`,
      { i: { customerId: customerIds.anaSecond, fulfillmentType: 'DELIVERY' } },
    );
    expect(received.body.errors).toBeUndefined();
    const id = received.body.data.receiveLaundryOrder.id;
    const read = await gql(
      schedulerCookie,
      `query($id: ID!){ laundryOrder(id:$id){ id status fulfillmentType customer { id } } }`,
      { id },
    );
    expect(read.body.errors).toBeUndefined();
    expect(read.body.data.laundryOrder).toEqual({
      id,
      customer: { id: customerIds.anaSecond },
      fulfillmentType: 'DELIVERY',
      status: 'RECEIVED',
    });
  });
});
```

- [ ] **Step 2: Run it (characterization: expected to pass first time)**

Run: `pnpm --filter api test:e2e -- laundry-intake-customer-search`
Expected: PASS, 4 tests. If any fails, **stop**: the API does not behave as the spec and the #160 issue assume, and M6 must report it rather than change API code.

- [ ] **Step 3: Commit**

```bash
git status --short   # expect only: ?? apps/api/test/laundry-intake-customer-search.e2e-spec.ts
git add apps/api/test/laundry-intake-customer-search.e2e-spec.ts
git commit -m "test(api): characterize the customer search and intake the laundry modal relies on (#160)"
```

---

### Task 2: Intake copy and the fulfillment fieldset

**Files:**
- Modify: `packages/web/src/i18n/messages/en/laundry.ts`
- Create: `packages/web/src/laundry/laundry-fulfillment-fieldset.tsx`
- Create: `packages/web/src/laundry/laundry-fulfillment-fieldset.test.tsx`
- Modify: `packages/web/src/index.ts`

**Interfaces:**
- Consumes: `LaundryFulfillmentType` (`./laundry-order-status`), `useClensyTranslations`; the existing catalog keys `fulfillment.PICKUP` ("Customer pickup") and `fulfillment.DELIVERY` ("Delivery"), present on `main` and not changed.
- Produces: `LaundryFulfillmentFieldset({ name, error, onChange, value })` (`error?: string`, shown as `<p id="${name}-error">` and added to the fieldset's `aria-describedby`), `LaundryFulfillmentFieldsetProps`; copy keys under `laundry.create.*` used by Tasks 3 and 5:
  `create.addCustomer`, `create.creating`, `create.customer.{empty,error,label,more,required,searching}`, `create.failure`, `create.fulfillment.{description.DELIVERY,description.PICKUP,fixed,legend,required}`, `create.submit`, `create.success`, `create.title`, `create.unconfirmed`.

- [ ] **Step 1: Write the failing test**

`packages/web/src/laundry/laundry-fulfillment-fieldset.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LaundryFulfillmentFieldset } from './laundry-fulfillment-fieldset';

const noop = () => {};

// Static markup, as in the other @clensy/web tests. Clicks are covered by
// apps/web's jsdom page test. The row classes are #160's stated visual
// contract, so they are asserted alongside the radio state.
describe('LaundryFulfillmentFieldset', () => {
  it('explains both options and says the choice is fixed at intake', () => {
    const html = renderToStaticMarkup(<LaundryFulfillmentFieldset name="fulfillment" value="PICKUP" onChange={noop} />);
    expect(html).toContain('<legend');
    expect(html).toContain('>Fulfillment</legend>');
    expect(html).toContain('This choice is fixed at intake.');
    expect(html).toContain('Customer pickup');
    expect(html).toContain('The customer collects the finished laundry.');
    expect(html).toContain('>Delivery<');
    expect(html).toContain('The shop returns the finished laundry. This does not schedule a route.');
  });

  it('uses two real radios in one group, each labelled and described', () => {
    const html = renderToStaticMarkup(<LaundryFulfillmentFieldset name="fulfillment" value="PICKUP" onChange={noop} />);
    for (const option of ['PICKUP', 'DELIVERY']) {
      const input = new RegExp(`<input[^>]*id="fulfillment-${option}"[^>]*>`).exec(html)?.[0];
      expect(input).toBeDefined();
      expect(input).toContain('type="radio"');
      expect(input).toContain('name="fulfillment"');
      expect(input).toContain(`value="${option}"`);
      expect(input).toContain(`aria-describedby="fulfillment-${option}-description"`);
      expect(html).toContain(`for="fulfillment-${option}"`);
      expect(html).toContain(`id="fulfillment-${option}-description"`);
    }
    expect(html).toMatch(/<fieldset[^>]*aria-describedby="fulfillment-fixed"/);
  });

  it('shows a field error under the radios and describes the group with it', () => {
    const html = renderToStaticMarkup(
      <LaundryFulfillmentFieldset name="fulfillment" value="PICKUP" error="fulfillmentType must be one of the following values: PICKUP, DELIVERY" onChange={noop} />,
    );
    expect(html).toMatch(/<fieldset[^>]*aria-describedby="fulfillment-fixed fulfillment-error"/);
    expect(html).toContain(
      '<p id="fulfillment-error" class="text-sm text-red-600">fulfillmentType must be one of the following values: PICKUP, DELIVERY</p>',
    );
    const clean = renderToStaticMarkup(<LaundryFulfillmentFieldset name="fulfillment" value="PICKUP" onChange={noop} />);
    expect(clean).not.toContain('fulfillment-error');
  });

  it('checks the current value and borders the selected row darker', () => {
    const html = renderToStaticMarkup(<LaundryFulfillmentFieldset name="fulfillment" value="DELIVERY" onChange={noop} />);
    expect(/<input[^>]*id="fulfillment-DELIVERY"[^>]*>/.exec(html)?.[0]).toContain('checked=""');
    expect(/<input[^>]*id="fulfillment-PICKUP"[^>]*>/.exec(html)?.[0]).not.toContain('checked');
    expect(/<label[^>]*for="fulfillment-DELIVERY"[^>]*>/.exec(html)?.[0]).toContain('border-slate-900');
    expect(/<label[^>]*for="fulfillment-PICKUP"[^>]*>/.exec(html)?.[0]).toContain('border-slate-300');
    expect(html).toContain('rounded-md border px-3 py-2');
    expect(html).toContain('sm:grid sm:grid-cols-2 sm:gap-3');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-fulfillment-fieldset.test.tsx`
Expected: FAIL — cannot resolve `./laundry-fulfillment-fieldset`.

- [ ] **Step 3: Add the copy**

In `packages/web/src/i18n/messages/en/laundry.ts`, insert after the `confirm` block (keys stay in `sort-keys` order):

```ts
  create: {
    addCustomer: 'Add a customer',
    creating: 'Creating…',
    customer: {
      empty: 'No customers match.',
      error: 'Unable to search customers.',
      label: 'Customer',
      more: 'More customers match. Type more of the name to narrow the search.',
      required: 'Select a customer.',
      searching: 'Searching…',
    },
    failure: 'Unable to create laundry order.',
    fulfillment: {
      description: {
        DELIVERY: 'The shop returns the finished laundry. This does not schedule a route.',
        PICKUP: 'The customer collects the finished laundry.',
      },
      fixed: 'This choice is fixed at intake.',
      legend: 'Fulfillment',
      required: 'Select how the finished laundry comes back.',
    },
    submit: 'Create order',
    success: 'Laundry order created.',
    title: 'New laundry order',
    unconfirmed: 'The order may have been created. Check the laundry list before trying again.',
  },
```

`create.fulfillment.required` is never shown in practice (a radio is always checked). It exists so the `required` rule never falls back to untranslated English.

- [ ] **Step 4: Write the component**

`packages/web/src/laundry/laundry-fulfillment-fieldset.tsx`:

```tsx
'use client';

import { useClensyTranslations } from '../i18n/use-clensy-translations';
import type { LaundryFulfillmentType } from './laundry-order-status';

export interface LaundryFulfillmentFieldsetProps {
  name: string;
  error?: string;
  onChange: (value: LaundryFulfillmentType) => void;
  value: LaundryFulfillmentType;
}

const OPTIONS: readonly LaundryFulfillmentType[] = ['PICKUP', 'DELIVERY'];

// How the finished laundry comes back, chosen once at intake (lifecycle spec
// §8.4.4: immutable after create; delivery does not schedule a route). Two
// native radios in a fieldset; each whole row is the radio's label. A field
// error (in practice only a server one: a radio is always checked) shows
// under the rows and describes the group.
export function LaundryFulfillmentFieldset({ name, error, onChange, value }: LaundryFulfillmentFieldsetProps) {
  const t = useClensyTranslations('laundry');
  const helperId = `${name}-fixed`;
  const errorId = `${name}-error`;

  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={error ? `${helperId} ${errorId}` : helperId}>
      <legend className="text-sm font-medium text-slate-700">{t('create.fulfillment.legend')}</legend>
      <p id={helperId} className="text-sm text-slate-500">
        {t('create.fulfillment.fixed')}
      </p>
      <div className="flex flex-col gap-2 sm:grid sm:grid-cols-2 sm:gap-3">
        {OPTIONS.map((option) => {
          const inputId = `${name}-${option}`;
          const descriptionId = `${inputId}-description`;
          const checked = value === option;
          return (
            <label
              key={option}
              htmlFor={inputId}
              className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 ${checked ? 'border-slate-900' : 'border-slate-300'}`}
            >
              <input
                id={inputId}
                type="radio"
                name={name}
                value={option}
                checked={checked}
                required
                aria-describedby={descriptionId}
                onChange={() => onChange(option)}
                className="mt-0.5 focus:outline-none focus:ring-2 focus:ring-slate-400"
              />
              <span className="flex flex-col">
                <span className="text-sm font-medium text-slate-900">{t(`fulfillment.${option}`)}</span>
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

- [ ] **Step 5: Export it**

In `packages/web/src/index.ts`, after the `LaundryOrderProgress` exports:

```ts
export { LaundryFulfillmentFieldset } from './laundry/laundry-fulfillment-fieldset';
export type { LaundryFulfillmentFieldsetProps } from './laundry/laundry-fulfillment-fieldset';
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @clensy/web test && pnpm --filter @clensy/web lint && pnpm --filter @clensy/web build`
Expected: all pass (the new file's 4 tests included); lint clean (`sort-keys` on the catalog); `tsc --noEmit` clean.

- [ ] **Step 7: Commit**

```bash
git status --short   # expect only the four files below
git add packages/web/src/i18n/messages/en/laundry.ts packages/web/src/laundry/laundry-fulfillment-fieldset.tsx packages/web/src/laundry/laundry-fulfillment-fieldset.test.tsx packages/web/src/index.ts
git commit -m "feat(web): explain the laundry fulfillment choice at intake (#160)"
```

---

### Task 3: The customer picker

**Files:**
- Create: `packages/web/src/laundry/laundry-customer-picker.tsx`
- Create: `packages/web/src/laundry/laundry-customer-picker.test.tsx`
- Modify: `packages/web/src/index.ts`
- Create: `apps/web/lib/laundry-customer-picker.interaction.test.tsx`

**Interfaces:**
- Consumes: Task 2's `create.customer.*` copy.
- Produces (Tasks 4–5 rely on these exact names):

```ts
export interface LaundryCustomerOption { id: string; email: string; fullName: string; phone: string }
export type LaundryCustomerSearchStatus = 'error' | 'idle' | 'loading' | 'ready';
export interface LaundryCustomerPickerProps {
  id: string;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
  onQueryChange: (text: string) => void;
  onSelect: (option: LaundryCustomerOption) => void;
  options: readonly LaundryCustomerOption[];
  query: string;
  status: LaundryCustomerSearchStatus;
  truncated?: boolean;
}
export function LaundryCustomerPicker(props: LaundryCustomerPickerProps)
```

- **Selection contract (the caller's side).** `onQueryChange` fires only for a user edit of the input. `onSelect` fires when an option is chosen, and the caller then sets the text to `option.fullName` itself, without going through `onQueryChange`. The caller MUST clear its selected customer id on every `onQueryChange`, so a selection never survives an edit and is never cleared by its own display text.
- Options are rendered only when `status === 'ready'`. `idle` (empty or blank text) keeps the list collapsed.
- Element ids: input `${id}`, listbox `${id}-listbox`, option `${id}-option-${option.id}`, error `${id}-error`.

- [ ] **Step 1: Write the failing static test**

`packages/web/src/laundry/laundry-customer-picker.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LaundryCustomerPicker, type LaundryCustomerPickerProps } from './laundry-customer-picker';

const noop = () => {};
const ANA = { id: 'c1', email: 'ana@example.com', fullName: 'Ana Reyes', phone: '555-0101' };
const ANA_NO_PHONE = { id: 'c2', email: 'ana.r@example.com', fullName: 'Ana Reyes', phone: '' };

function render(props: Partial<LaundryCustomerPickerProps> = {}): string {
  return renderToStaticMarkup(
    <LaundryCustomerPicker
      id="customer"
      query="ana"
      options={[]}
      status="idle"
      onQueryChange={noop}
      onSelect={noop}
      {...props}
    />,
  );
}

function input(html: string): string {
  return /<input[^>]*>/.exec(html)![0];
}

// Static markup: the closed state, the popup's content (rendered `hidden`
// while closed) and the error wiring. Keyboard and mouse are covered by
// apps/web/lib/laundry-customer-picker.interaction.test.tsx.
describe('LaundryCustomerPicker', () => {
  it('labels a combobox that controls a listbox and starts collapsed', () => {
    const html = render();
    expect(html).toContain('<label for="customer"');
    expect(html).toContain('>Customer</label>');
    const field = input(html);
    expect(field).toContain('id="customer"');
    expect(field).toContain('role="combobox"');
    expect(field).toContain('aria-controls="customer-listbox"');
    expect(field).toContain('aria-expanded="false"');
    expect(field).toContain('aria-autocomplete="list"');
    expect(field).toContain('autocomplete="off"');
    expect(field).not.toContain('aria-activedescendant');
    expect(html).toMatch(/<ul[^>]*id="customer-listbox"[^>]*role="listbox"/);
  });

  it('lists each match with phone, or email when there is no phone, as secondary text', () => {
    const html = render({ options: [ANA, ANA_NO_PHONE], status: 'ready' });
    expect(html).toContain('id="customer-option-c1"');
    expect(html).toContain('id="customer-option-c2"');
    expect((html.match(/role="option"/g) ?? []).length).toBe(2);
    expect(html).toContain('<span class="block text-sm text-slate-500">555-0101</span>');
    expect(html).toContain('<span class="block text-sm text-slate-500">ana.r@example.com</span>');
  });

  it('shows one line for searching, no matches, a failed search, and more matches than shown', () => {
    expect(render({ status: 'loading' })).toContain('Searching…');
    expect(render({ status: 'ready' })).toContain('No customers match.');
    expect(render({ status: 'error' })).toMatch(/role="alert"[^>]*>Unable to search customers\./);
    expect(render({ options: [ANA], status: 'ready' })).not.toContain('No customers match.');
    expect(render({ options: [ANA], status: 'ready', truncated: true })).toContain(
      'More customers match. Type more of the name to narrow the search.',
    );
    expect(render({ options: [ANA], status: 'ready' })).not.toContain('More customers match.');
  });

  it('renders no option unless the search is ready', () => {
    for (const status of ['idle', 'loading', 'error'] as const) {
      expect(render({ options: [ANA], status })).not.toContain('role="option"');
    }
  });

  it('wires a validation error to the input', () => {
    const html = render({ error: 'Select a customer.' });
    const field = input(html);
    expect(field).toContain('aria-invalid="true"');
    expect(field).toContain('aria-describedby="customer-error"');
    expect(field).toContain('border-red-500');
    expect(html).toContain('<p id="customer-error" class="text-sm text-red-600">Select a customer.</p>');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-customer-picker.test.tsx`
Expected: FAIL — cannot resolve `./laundry-customer-picker`.

- [ ] **Step 3: Write the component**

`packages/web/src/laundry/laundry-customer-picker.tsx`:

```tsx
'use client';

import { useState, type KeyboardEvent, type Ref } from 'react';
import { useClensyTranslations } from '../i18n/use-clensy-translations';

export interface LaundryCustomerOption {
  id: string;
  email: string;
  fullName: string;
  phone: string;
}

export type LaundryCustomerSearchStatus = 'error' | 'idle' | 'loading' | 'ready';

export interface LaundryCustomerPickerProps {
  id: string;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
  onQueryChange: (text: string) => void;
  onSelect: (option: LaundryCustomerOption) => void;
  options: readonly LaundryCustomerOption[];
  query: string;
  status: LaundryCustomerSearchStatus;
  truncated?: boolean;
}

const INPUT_CLASSES =
  'rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400';

// The laundry intake customer search (#160). @clensy/ui has no Combobox and
// this slice adds no dependency, so this is the WAI-ARIA editable combobox
// with a listbox popup, built from a native input. It owns only whether the
// list is open and which option is active; the caller owns the text, the
// server search, the options and the selection. The label, input and error
// follow FormField's markup and classes.
//
// `onQueryChange` fires only for a user edit; the caller clears its
// selection there. On `onSelect` the caller sets the text to the chosen
// name itself, so a selection is never cleared by its own display text.
//
// The active option is a customer id, not a position: when the results
// change, it stays on the same customer or, if that customer is gone, it is
// cleared and stays cleared until the user moves again. Options render only
// for a `ready` search, so nothing from an older search can be active or
// chosen while a newer one loads.
//
// Escape closes an open list and stops there, so the surrounding Modal,
// which listens for Escape on `document`, stays open. With the list closed,
// Escape reaches the Modal as usual.
export function LaundryCustomerPicker({
  id,
  error,
  inputRef,
  onQueryChange,
  onSelect,
  options,
  query,
  status,
  truncated = false,
}: LaundryCustomerPickerProps) {
  const t = useClensyTranslations('laundry');
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const listboxId = `${id}-listbox`;
  const errorId = `${id}-error`;
  const expanded = open && status !== 'idle';
  const rendered = status === 'ready' ? options : [];
  // A stored active id that no longer names a rendered option (the search
  // left `ready`, or that customer left the results) is dropped here, so it
  // cannot come back by itself when a later result set includes it again.
  // Guarded, so it settles in one extra render (React's pattern for
  // adjusting state to props during render).
  if (activeId !== null && !rendered.some((option) => option.id === activeId)) setActiveId(null);
  const active = expanded ? rendered.findIndex((option) => option.id === activeId) : -1;

  function close() {
    setOpen(false);
    setActiveId(null);
  }

  function select(option: LaundryCustomerOption) {
    onSelect(option);
    close();
  }

  function move(step: -1 | 1) {
    const count = rendered.length;
    if (count === 0) {
      setActiveId(null);
      return;
    }
    const next = active === -1 ? (step === 1 ? 0 : count - 1) : (active + step + count) % count;
    setActiveId(rendered[next].id);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!expanded) setOpen(true);
      move(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Enter' && expanded) {
      // Enter belongs to the list while it is open; it never submits the form.
      event.preventDefault();
      if (active >= 0) select(rendered[active]);
      return;
    }
    if (event.key === 'Escape' && expanded) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  }

  return (
    <div className="relative flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {t('create.customer.label')}
      </label>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={expanded}
        aria-activedescendant={active >= 0 ? `${id}-option-${rendered[active].id}` : undefined}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        value={query}
        onChange={(event) => {
          onQueryChange(event.target.value);
          setOpen(event.target.value.trim() !== '');
          setActiveId(null);
        }}
        onKeyDown={handleKeyDown}
        onBlur={close}
        className={`${INPUT_CLASSES} ${error ? 'border-red-500' : 'border-slate-300'}`}
      />
      <div
        hidden={!expanded}
        className="absolute left-0 right-0 top-full z-10 mt-1 rounded-md border border-slate-200 bg-white py-1 shadow-lg"
      >
        <ul id={listboxId} role="listbox" aria-label={t('create.customer.label')} className="max-h-60 overflow-y-auto">
          {rendered.map((option, index) => {
            const secondary = option.phone !== '' ? option.phone : option.email;
            return (
              <li
                key={option.id}
                id={`${id}-option-${option.id}`}
                role="option"
                aria-selected={index === active}
                // Keeps focus in the input, so blur does not close the list
                // before the click selects.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(option)}
                className={`cursor-pointer px-3 py-2 ${index === active ? 'bg-slate-100' : ''}`}
              >
                <span className="block text-sm text-slate-900">{option.fullName}</span>
                <span className="block text-sm text-slate-500">{secondary}</span>
              </li>
            );
          })}
        </ul>
        {status === 'loading' ? (
          <p role="status" className="px-3 py-2 text-sm text-slate-500">
            {t('create.customer.searching')}
          </p>
        ) : null}
        {status === 'ready' && options.length === 0 ? (
          <p role="status" className="px-3 py-2 text-sm text-slate-500">
            {t('create.customer.empty')}
          </p>
        ) : null}
        {status === 'ready' && truncated ? (
          <p role="status" className="px-3 py-2 text-sm text-slate-500">
            {t('create.customer.more')}
          </p>
        ) : null}
        {status === 'error' ? (
          <p role="alert" className="px-3 py-2 text-sm text-red-600">
            {t('create.customer.error')}
          </p>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Export it**

In `packages/web/src/index.ts`, after the Task 2 exports:

```ts
export { LaundryCustomerPicker } from './laundry/laundry-customer-picker';
export type {
  LaundryCustomerOption,
  LaundryCustomerPickerProps,
  LaundryCustomerSearchStatus,
} from './laundry/laundry-customer-picker';
```

- [ ] **Step 5: Run the static test**

Run: `pnpm --filter @clensy/web exec vitest run src/laundry/laundry-customer-picker.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 6: Write the keyboard test**

`apps/web/lib/laundry-customer-picker.interaction.test.tsx`:

```tsx
// @vitest-environment jsdom
import {
  LaundryCustomerPicker,
  type LaundryCustomerOption,
  type LaundryCustomerSearchStatus,
} from '@clensy/web';
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// Drives the real @clensy/web picker in jsdom: keyboard, mouse, blur,
// result changes, and Escape against a `document` listener standing in for
// Modal's (the real Modal is covered by the page test). The harness keeps a
// selected id the way the intake dialog does: set on select, cleared on
// every `onQueryChange`. Typing uses the native value setter plus an
// `input` event, the helper the merged list interaction test uses.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const C1 = { id: 'c1', email: 'ana@example.com', fullName: 'Ana Reyes', phone: '555-0101' };
const C2 = { id: 'c2', email: 'ana.r@example.com', fullName: 'Ana Reyes', phone: '' };
const C3 = { id: 'c3', email: 'ben@example.com', fullName: 'Ben Cruz', phone: '555-0103' };
const OPTIONS: LaundryCustomerOption[] = [C1, C2, C3];

let container: HTMLDivElement;
let root: Root;
let selected: string[];
const submits = vi.fn();
const documentEscapes = vi.fn();

function Harness({ options, status }: { options: LaundryCustomerOption[]; status: LaundryCustomerSearchStatus }) {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        submits();
      }}
    >
      <LaundryCustomerPicker
        id="customer"
        query={query}
        options={options}
        status={query.trim() === '' ? 'idle' : status}
        onQueryChange={(text) => {
          setQuery(text);
          setSelectedId('');
        }}
        onSelect={(option) => {
          selected.push(option.id);
          setSelectedId(option.id);
          setQuery(option.fullName);
        }}
      />
      <output id="selected-id">{selectedId}</output>
      <button type="button" id="elsewhere">
        Elsewhere
      </button>
    </form>
  );
}

// Stands in for Modal's `document`-level Escape listener.
function onDocumentKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape') documentEscapes();
}

function field(): HTMLInputElement {
  return container.querySelector<HTMLInputElement>('#customer')!;
}

function activeDescendant(): string | null {
  return field().getAttribute('aria-activedescendant');
}

function selectedId(): string {
  return container.querySelector('#selected-id')!.textContent ?? '';
}

function type(text: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field(), text);
    field().dispatchEvent(new Event('input', { bubbles: true }));
  });
}

// Returns whether the event was not cancelled, as dispatchEvent does.
function press(key: string): boolean {
  let notCancelled = true;
  act(() => {
    notCancelled = field().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }));
  });
  return notCancelled;
}

// Renders, or re-renders with new props (state is kept: same component).
function render(status: LaundryCustomerSearchStatus = 'ready', options: LaundryCustomerOption[] = OPTIONS) {
  act(() => root.render(<Harness options={options} status={status} />));
}

beforeAll(() => document.addEventListener('keydown', onDocumentKeyDown));
afterAll(() => document.removeEventListener('keydown', onDocumentKeyDown));

beforeEach(() => {
  selected = [];
  submits.mockReset();
  documentEscapes.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('LaundryCustomerPicker interactions', () => {
  it('opens the list as the user types and closes it when focus moves elsewhere', () => {
    render();
    act(() => field().focus());
    expect(field().getAttribute('aria-expanded')).toBe('false');
    type('an');
    expect(field().getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelector<HTMLElement>('#customer-listbox')!.parentElement!.hidden).toBe(false);
    // A real focus move: jsdom fires blur/focusout on the input.
    act(() => container.querySelector<HTMLButtonElement>('#elsewhere')!.focus());
    expect(document.activeElement!.id).toBe('elsewhere');
    expect(field().getAttribute('aria-expanded')).toBe('false');
  });

  it('moves the active option with ArrowDown and ArrowUp, wrapping at both ends', () => {
    render();
    type('a');
    expect(activeDescendant()).toBeNull();
    press('ArrowDown');
    expect(activeDescendant()).toBe('customer-option-c1');
    expect(container.querySelector('#customer-option-c1')!.getAttribute('aria-selected')).toBe('true');
    press('ArrowDown');
    expect(activeDescendant()).toBe('customer-option-c2');
    press('ArrowDown');
    expect(activeDescendant()).toBe('customer-option-c3');
    press('ArrowDown');
    expect(activeDescendant()).toBe('customer-option-c1');
    press('ArrowUp');
    expect(activeDescendant()).toBe('customer-option-c3');
  });

  it('selects the active option with Enter, and Enter does not reach the form', () => {
    render();
    type('a');
    press('ArrowDown');
    press('ArrowDown');
    expect(press('Enter')).toBe(false); // cancelled
    expect(selected).toEqual(['c2']);
    expect(selectedId()).toBe('c2');
    expect(field().value).toBe('Ana Reyes');
    expect(field().getAttribute('aria-expanded')).toBe('false');
    expect(submits).not.toHaveBeenCalled();
  });

  it('clears the selected id when the text is edited after choosing', () => {
    render();
    type('a');
    press('ArrowDown');
    press('Enter');
    expect(selectedId()).toBe('c1');
    type('Ana Reyesx');
    expect(selectedId()).toBe('');
    press('ArrowDown');
    press('Enter');
    expect(selectedId()).toBe('c1');
    type('');
    expect(selectedId()).toBe('');
  });

  it('closes the list with Escape without letting the dialog see it, then lets the next Escape through', () => {
    render();
    type('a');
    press('Escape');
    expect(field().getAttribute('aria-expanded')).toBe('false');
    expect(field().value).toBe('a');
    expect(documentEscapes).not.toHaveBeenCalled();
    press('Escape');
    expect(documentEscapes).toHaveBeenCalledTimes(1);
  });

  it('selects an option by click, keeping focus in the input', () => {
    render();
    type('b');
    const option = container.querySelector<HTMLElement>('#customer-option-c3')!;
    let notCancelled = true;
    act(() => {
      notCancelled = option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });
    expect(notCancelled).toBe(false);
    act(() => option.click());
    expect(selected).toEqual(['c3']);
    expect(field().value).toBe('Ben Cruz');
  });

  it('keeps the active option on the same customer when results change, and drops it when that customer leaves', () => {
    render();
    type('a');
    press('ArrowDown');
    press('ArrowDown');
    expect(activeDescendant()).toBe('customer-option-c2');
    render('ready', [C3, C2]); // reordered: c2 is now second, still the same customer
    expect(activeDescendant()).toBe('customer-option-c2');
    expect(container.querySelector('#customer-option-c2')!.getAttribute('aria-selected')).toBe('true');
    render('ready', [C1, C3]); // c2 left the results
    expect(activeDescendant()).toBeNull();
    expect(container.querySelector('[aria-selected="true"]')).toBeNull();
    press('Enter');
    expect(selected).toEqual([]);
  });

  it('offers nothing while a newer search loads, even after an option was active', () => {
    render();
    type('a');
    press('ArrowDown');
    expect(activeDescendant()).toBe('customer-option-c1');
    render('loading');
    expect(field().getAttribute('aria-expanded')).toBe('true');
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
    expect(activeDescendant()).toBeNull();
    expect(container.textContent).toContain('Searching…');
    press('ArrowDown');
    expect(activeDescendant()).toBeNull();
    press('Enter');
    expect(selected).toEqual([]);
  });

  it('does not bring back an active customer that left the results, until the user moves again', () => {
    render();
    type('a');
    press('ArrowDown');
    press('ArrowDown');
    expect(activeDescendant()).toBe('customer-option-c2');
    render('loading');
    expect(activeDescendant()).toBeNull();
    render('ready', [C1, C3]); // results without c2
    expect(activeDescendant()).toBeNull();
    render('ready', OPTIONS); // c2 is back
    expect(activeDescendant()).toBeNull();
    expect(container.querySelector('[aria-selected="true"]')).toBeNull();
    press('Enter');
    expect(selected).toEqual([]);
    press('ArrowDown');
    expect(activeDescendant()).toBe('customer-option-c1');
  });

  it('collapses with nothing active when the text is cleared', () => {
    render();
    type('a');
    press('ArrowDown');
    type('');
    expect(field().getAttribute('aria-expanded')).toBe('false');
    expect(activeDescendant()).toBeNull();
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(0);
  });
});
```

Every `aria-activedescendant` assertion above also checks, by construction, that the named element exists: `active` is an index into the rendered options, so the id is only ever built from a rendered option.

- [ ] **Step 7: Run it**

Run: `pnpm --filter web exec vitest run lib/laundry-customer-picker.interaction.test.tsx`
Expected: PASS, 10 tests. (It is red without Steps 3–4: `LaundryCustomerPicker` is not exported from `@clensy/web` on `main`. M6 MUST confirm red by running this step once with the Step 4 export temporarily reverted, and record it.)

- [ ] **Step 8: Lint, typecheck, full package tests**

Run: `pnpm --filter @clensy/web test && pnpm --filter @clensy/web lint && pnpm --filter @clensy/web build && pnpm --filter web lint`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git status --short   # expect only the four files below
git add packages/web/src/laundry/laundry-customer-picker.tsx packages/web/src/laundry/laundry-customer-picker.test.tsx packages/web/src/index.ts apps/web/lib/laundry-customer-picker.interaction.test.tsx
git commit -m "feat(web): searchable laundry customer picker (#160)"
```

---

### Task 4: Customer search variables and debounce

**Files:**
- Create: `apps/web/lib/use-laundry-customer-search.ts`
- Create: `apps/web/lib/use-laundry-customer-search.test.ts`
- Create: `apps/web/lib/use-laundry-customer-search.hook.test.tsx`

**Interfaces:**
- Consumes: `escapeLikePattern` (`./laundry-order-list-query`), `useCustomersQuery`, `CustomersQueryVariables` (`@clensy/client`), `LaundryCustomerOption`, `LaundryCustomerSearchStatus` (`@clensy/web`, Task 3).
- Produces (Task 5):
  - `LAUNDRY_CUSTOMER_SEARCH_LIMIT = 20`, `LAUNDRY_CUSTOMER_SEARCH_DEBOUNCE_MS = 300`
  - `laundryCustomerSearchVariables(text: string): CustomersQueryVariables`
  - `interface LaundryCustomerSearch { options: readonly LaundryCustomerOption[]; status: LaundryCustomerSearchStatus; truncated: boolean }`
  - `useLaundryCustomerSearch(query: string): LaundryCustomerSearch`

- [ ] **Step 1: Write the failing variables test**

`apps/web/lib/use-laundry-customer-search.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  LAUNDRY_CUSTOMER_SEARCH_DEBOUNCE_MS,
  LAUNDRY_CUSTOMER_SEARCH_LIMIT,
  laundryCustomerSearchVariables,
} from './use-laundry-customer-search';

describe('laundryCustomerSearchVariables', () => {
  it('filters fullName with a contains iLike, 20 at most, by name then id', () => {
    expect(laundryCustomerSearchVariables('ana')).toEqual({
      filter: { fullName: { iLike: '%ana%' } },
      paging: { limit: 20 },
      sorting: [
        { direction: 'ASC', field: 'fullName' },
        { direction: 'ASC', field: 'id' },
      ],
    });
    expect(LAUNDRY_CUSTOMER_SEARCH_LIMIT).toBe(20);
    expect(LAUNDRY_CUSTOMER_SEARCH_DEBOUNCE_MS).toBe(300);
  });

  it('matches %, _ and \\ literally, as the list search does', () => {
    expect(laundryCustomerSearchVariables('50% off_a\\b').filter).toEqual({
      fullName: { iLike: '%50\\% off\\_a\\\\b%' },
    });
  });
});
```

- [ ] **Step 2: Write the failing hook test**

`apps/web/lib/use-laundry-customer-search.hook.test.tsx`:

```tsx
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
```

- [ ] **Step 3: Run both to verify they fail**

Run: `pnpm --filter web exec vitest run lib/use-laundry-customer-search.test.ts lib/use-laundry-customer-search.hook.test.tsx`
Expected: FAIL — cannot resolve `./use-laundry-customer-search`.

- [ ] **Step 4: Implement**

`apps/web/lib/use-laundry-customer-search.ts`:

```ts
'use client';
import { useCustomersQuery, type CustomersQueryVariables } from '@clensy/client';
import type { LaundryCustomerOption, LaundryCustomerSearchStatus } from '@clensy/web';
import { useEffect, useState } from 'react';
import { escapeLikePattern } from './laundry-order-list-query';

export const LAUNDRY_CUSTOMER_SEARCH_LIMIT = 20;
export const LAUNDRY_CUSTOMER_SEARCH_DEBOUNCE_MS = 300;

export interface LaundryCustomerSearch {
  options: readonly LaundryCustomerOption[];
  status: LaundryCustomerSearchStatus;
  truncated: boolean;
}

const IDLE: LaundryCustomerSearch = { options: [], status: 'idle', truncated: false };
const LOADING: LaundryCustomerSearch = { options: [], status: 'loading', truncated: false };
const FAILED: LaundryCustomerSearch = { options: [], status: 'error', truncated: false };

// The intake modal's customer search (lifecycle spec §8.4.4: any customer
// the customers query returns, not only the first 100). A contains match on
// the name, on the server, escaped like the list's own search.
export function laundryCustomerSearchVariables(text: string): CustomersQueryVariables {
  return {
    filter: { fullName: { iLike: `%${escapeLikePattern(text)}%` } },
    paging: { limit: LAUNDRY_CUSTOMER_SEARCH_LIMIT },
    sorting: [
      { direction: 'ASC', field: 'fullName' },
      { direction: 'ASC', field: 'id' },
    ],
  };
}

// The trimmed text is searched once typing pauses. The searched text starts
// empty, so even a first non-empty text waits out the debounce, and an
// empty input sends no query, at once rather than after the debounce. Options are returned only when the searched
// text is the input's text and its query has settled: while they differ,
// or the query is loading, the result is `loading` with no options, so a
// result for an older text is never offered for a newer one. `truncated`
// says the server counted more matches than the page holds.
export function useLaundryCustomerSearch(query: string): LaundryCustomerSearch {
  const text = query.trim();
  const [searched, setSearched] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setSearched(text), LAUNDRY_CUSTOMER_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const result = useCustomersQuery({
    fetchPolicy: 'network-only',
    // An empty input skips at once; a pending debounce never re-enables it.
    skip: text === '' || searched === '',
    variables: laundryCustomerSearchVariables(searched),
  });

  if (text === '') return IDLE;
  if (searched !== text || result.loading) return LOADING;
  if (result.error) return FAILED;
  const nodes = result.data?.customers.nodes ?? [];
  return {
    options: nodes,
    status: 'ready',
    truncated: (result.data?.customers.totalCount ?? nodes.length) > nodes.length,
  };
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter web exec vitest run lib/use-laundry-customer-search.test.ts lib/use-laundry-customer-search.hook.test.tsx && pnpm --filter web lint`
Expected: PASS, 2 + 9 tests; lint clean.

- [ ] **Step 6: Commit**

```bash
git status --short   # expect only the three files below
git add apps/web/lib/use-laundry-customer-search.ts apps/web/lib/use-laundry-customer-search.test.ts apps/web/lib/use-laundry-customer-search.hook.test.tsx
git commit -m "feat(web): server-side customer search for laundry intake (#160)"
```

---

### Task 5: The intake dialog on `/app/laundry`

**Files:**
- Create: `apps/web/components/laundry/create-laundry-order-dialog.tsx`
- Modify: `apps/web/app/app/laundry/page.tsx`
- Modify: `apps/web/lib/laundry-list-page.test.tsx`
- Modify: `apps/web/lib/laundry-list-page.interaction.test.tsx`

**Interfaces:**
- Consumes: Task 2 `LaundryFulfillmentFieldset` and copy; Task 3 `LaundryCustomerPicker` and its selection contract; Task 4 `useLaundryCustomerSearch`; `useReceiveLaundryOrderMutation`; `FormDialog`, `useToast`, `ToastProvider` (`@clensy/ui`); `clensyResolver`, `normalizeApiValidationErrors`, `Rules` (`@clensy/validation`); `canViewPath` (`apps/web/lib/nav-groups.ts`); the page's existing `hrefFor`, `openWithHref`, `ordersQuery`.
- Produces: `CreateLaundryOrderDialog({ onClose, onCreated, open, showAddCustomerLink })`, where `onCreated(orderId)` receives the id the mutation returned. #161 changes only the page's `handleCreated`.

Element ids used by the tests: customer input `#laundry-customer`, error `#laundry-customer-error`, radios `#laundry-fulfillment-PICKUP` / `#laundry-fulfillment-DELIVERY`.

- [ ] **Step 1: Update the page tests' mocks and harness (no new intake behavior asserted yet)**

`apps/web/lib/laundry-list-page.test.tsx`, wrap the render in `ToastProvider` (the page now calls `useToast`, which throws outside a provider; the app provides it in `dashboard-layout.tsx`):

```diff
+import { ToastProvider } from '@clensy/ui';
 import { renderToStaticMarkup } from 'react-dom/server';
@@
 async function renderPage(): Promise<string> {
   const { default: LaundryPage } = await import('../app/app/laundry/page');
-  return renderToStaticMarkup(<LaundryPage />);
+  return renderToStaticMarkup(
+    <ToastProvider>
+      <LaundryPage />
+    </ToastProvider>,
+  );
 }
```

Also in `apps/web/lib/laundry-list-page.test.tsx`, let a test give the orders query an error (M5 review 2, Part 5). Add `ordersError: undefined as Error | undefined,` to the hoisted `page` object, reset it in `beforeEach` (`page.ordersError = undefined;`), and use it in the `useLaundryOrdersQuery` mock:

```diff
       return {
         data: { laundryOrders: { nodes: [order], totalCount: page.totalCount } },
-        error: undefined,
+        error: page.ordersError,
         loading: false,
```

Then add, inside `describe('/app/laundry list', …)`:

```tsx
  it('shows the list error after a failed background refresh, and keeps the rows', async () => {
    // A failed refetch leaves Apollo's `data` in place and sets `error`
    // (plan, Planning spikes); the page passes it on as `hasError`.
    page.ordersError = new Error('network down');
    const html = await renderPage();
    expect(html).toContain('Unable to load laundry orders.');
    expect(html).toContain('Ana Reyes');
  });
```

This is a **characterization test**: the page already passes `hasError={Boolean(ordersQuery.error)}` on `main`, so it passes before and after this task. It pins the wiring that the success handler's unawaited `refetch().catch(() => undefined)` relies on.

`apps/web/lib/laundry-list-page.interaction.test.tsx`:

1. Above the `vi.hoisted` block, add the types and fixtures:

```ts
type Customer = { id: string; email: string; fullName: string; phone: string };
type CustomerQueryOptions = {
  skip?: boolean;
  variables?: { filter?: { fullName?: { iLike?: string } }; paging?: { limit?: number } };
};
type CustomerResult = { error?: Error; nodes: Customer[]; totalCount?: number };

const ANA: Customer = { id: 'c1', email: 'ana@example.com', fullName: 'Ana Reyes', phone: '555-0101' };
const ANA_NO_PHONE: Customer = { id: 'c2', email: 'ana.r@example.com', fullName: 'Ana Reyes', phone: '' };
```

2. Add to the `nav` hoisted object (keep its keys sorted):

```ts
  // Every `useCustomersQuery` options object, in render order.
  customerQueries: [] as CustomerQueryOptions[],
  // Responses by lower-cased `iLike` pattern (the search is case-insensitive).
  // A pattern with no entry is still in flight, as in Apollo.
  customerResults: {} as Record<string, CustomerResult>,
  // Every `receiveLaundryOrder` input, in call order.
  receiveCalls: [] as unknown[],
  // The list's `refetch`; a test may make it hang.
  refetch: (() => Promise.resolve()) as () => Promise<unknown>,
  refetchCalls: 0,
  // Settles the pending `receiveLaundryOrder` call with an error.
  rejectReceive: (() => {}) as (error: unknown) => void,
  // Settles the pending `receiveLaundryOrder` call with no order in the response.
  resolveReceiveWithoutId: (() => {}) as () => void,
  role: 'TENANT_OWNER',
```

3. Replace these entries of the `@clensy/client` mock:

```diff
-    useCurrentAdminQuery: () => ({ data: { currentAdmin: { role: 'TENANT_OWNER' } } }),
-    useCustomersQuery: () => ({ data: { customers: { nodes: [{ id: 'c1', fullName: 'Ana Reyes' }] } } }),
+    useCurrentAdminQuery: () => ({ data: { currentAdmin: { role: nav.role, scope: 'TENANT' } } }),
+    useCustomersQuery: (options: CustomerQueryOptions) => {
+      nav.customerQueries.push(options);
+      if (options.skip) return { data: undefined, error: undefined, loading: false };
+      const response = nav.customerResults[options.variables!.filter!.fullName!.iLike!.toLowerCase()];
+      if (!response) return { data: undefined, error: undefined, loading: true };
+      if (response.error) return { data: undefined, error: response.error, loading: false };
+      return {
+        data: { customers: { nodes: response.nodes, totalCount: response.totalCount ?? response.nodes.length } },
+        error: undefined,
+        loading: false,
+      };
+    },
@@
       return {
         data: { laundryOrders: { nodes: [row], totalCount: 1 } },
         error: undefined,
         loading: false,
-        refetch: () => Promise.resolve(),
+        refetch: () => {
+          nav.refetchCalls += 1;
+          return nav.refetch();
+        },
       };
@@
-    useReceiveLaundryOrderMutation: () => [
-      () =>
-        new Promise((resolve) => {
-          nav.resolveReceive = (id: string) => resolve({ data: { receiveLaundryOrder: { id } } });
-        }),
-      { loading: false },
-    ],
+    useReceiveLaundryOrderMutation: () => [
+      (options: { variables: { input: unknown } }) => {
+        nav.receiveCalls.push(options.variables.input);
+        return new Promise((resolve, reject) => {
+          nav.resolveReceive = (id: string) => resolve({ data: { receiveLaundryOrder: { id } } });
+          nav.resolveReceiveWithoutId = () => resolve({ data: null });
+          nav.rejectReceive = reject;
+        });
+      },
+      { loading: false },
+    ],
```

4. Import `ToastProvider` and render inside it in `start`:

```diff
+import { ToastProvider } from '@clensy/ui';
@@
-  act(() => root.render(<LaundryPage />));
+  act(() =>
+    root.render(
+      <ToastProvider>
+        <LaundryPage />
+      </ToastProvider>,
+    ),
+  );
```

5. Reset every added field in `beforeEach`:

```ts
  nav.customerQueries = [];
  nav.customerResults = {
    '%ana%': { nodes: [ANA, ANA_NO_PHONE] },
    '%zz%': { nodes: [] },
  };
  nav.receiveCalls = [];
  nav.refetch = () => Promise.resolve();
  nav.refetchCalls = 0;
  nav.rejectReceive = () => {};
  nav.resolveReceive = () => {};
  nav.resolveReceiveWithoutId = () => {};
  nav.role = 'TENANT_OWNER';
```

6. Add helpers after `statusSelect`:

```ts
function dialog(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[role="dialog"]');
}

function customerField(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('#laundry-customer')!;
}

function customerOptions(): HTMLElement[] {
  return [...document.querySelectorAll<HTMLElement>('#laundry-customer-listbox [role="option"]')];
}

// The same native-setter helper as `typeSearch`, on the customer field.
function typeCustomer(text: string) {
  act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(customerField(), text);
    customerField().dispatchEvent(new Event('input', { bubbles: true }));
  });
}

function pressInCustomer(key: string) {
  act(() => {
    customerField().dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key }));
  });
}

function openCreate() {
  act(() => button('+ New Laundry Order').click());
}

// Types, waits out the debounce, and clicks the first match.
function chooseCustomer(text = 'Ana') {
  typeCustomer(text);
  act(() => vi.advanceTimersByTime(300));
  act(() => customerOptions()[0].click());
}

// Dispatches `times` submit events synchronously, in one turn, then lets
// react-hook-form's asynchronous validation and the handlers settle.
async function submitCreate(times = 1) {
  await act(async () => {
    for (let index = 0; index < times; index += 1) {
      dialog()!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  });
}
```

7. Update the existing create-race test. A customer must now be chosen, and the submit must settle (the mutation is called after async validation) before the URL race is staged:

```diff
   it('opens the new order after create with the live list URL, natively, before React re-renders', async () => {
     start('tab=a&status=PAID', '#orders');
-    act(() => button('+ New Laundry Order').click());
-    act(() => {
-      document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
-    });
+    openCreate();
+    chooseCustomer();
+    await submitCreate();
+    expect(nav.receiveCalls).toHaveLength(1);
```

The rest of that test is unchanged.

- [ ] **Step 2: Run the existing page tests alone**

Run: `pnpm --filter web exec vitest run lib/laundry-list-page.test.tsx lib/laundry-list-page.interaction.test.tsx`
Expected, as the acceptance criterion for this step:
- every existing test except the create-race test passes with the new harness; and
- the create-race test fails **only** because the old dialog provides no `#laundry-customer` combobox: the failure is thrown from `chooseCustomer` / `typeCustomer` reaching for that element (a `null` dereference or a not-found error, depending on which helper line throws first).

Any other failure, in that test or elsewhere, is a harness defect. Fix the harness before going on. Record the observed failure message in the M6 report.

- [ ] **Step 3: Write the failing intake tests**

Append to `apps/web/lib/laundry-list-page.interaction.test.tsx`:

```tsx
describe('/app/laundry intake modal', () => {
  it('searches customers by name on the server, 20 at most, never the first 100 unfiltered', () => {
    start();
    expect(nav.customerQueries.every((options) => options.skip === true)).toBe(true);
    openCreate();
    typeCustomer('  ana ');
    expect(nav.customerQueries.at(-1)?.skip).toBe(true); // debouncing
    act(() => vi.advanceTimersByTime(300));
    expect(nav.customerQueries.at(-1)).toMatchObject({
      skip: false,
      variables: { filter: { fullName: { iLike: '%ana%' } }, paging: { limit: 20 } },
    });
    for (const options of nav.customerQueries) {
      expect(options.skip === true || options.variables?.paging?.limit === 20).toBe(true);
      expect(options.skip === true || options.variables?.filter !== undefined).toBe(true);
    }
  });

  it('shows Searching…, then results with phone or email', () => {
    start();
    openCreate();
    typeCustomer('ana');
    expect(dialog()!.textContent).toContain('Searching…');
    expect(customerOptions()).toHaveLength(0);
    act(() => vi.advanceTimersByTime(300));
    expect(customerOptions().map((option) => option.textContent)).toEqual([
      'Ana Reyes555-0101',
      'Ana Reyesana.r@example.com',
    ]);
  });

  it('says No customers match. for a search with no result', () => {
    start();
    openCreate();
    typeCustomer('zz'); // preset empty response
    act(() => vi.advanceTimersByTime(300));
    expect(customerOptions()).toHaveLength(0);
    expect(dialog()!.textContent).toContain('No customers match.');
  });

  it('shows a failed search inline', () => {
    nav.customerResults['%ana%'] = { error: new Error('down'), nodes: [] };
    start();
    openCreate();
    typeCustomer('ana');
    act(() => vi.advanceTimersByTime(300));
    expect(dialog()!.querySelector('[role="alert"]')!.textContent).toBe('Unable to search customers.');
  });

  it('never lets a result for an earlier text be chosen while the next search runs', async () => {
    start();
    openCreate();
    typeCustomer('ana');
    act(() => vi.advanceTimersByTime(300));
    expect(customerOptions()).toHaveLength(2);
    pressInCustomer('ArrowDown');
    typeCustomer('anaz'); // no response: stays in flight
    expect(customerOptions()).toHaveLength(0);
    act(() => vi.advanceTimersByTime(300));
    expect(customerOptions()).toHaveLength(0);
    expect(dialog()!.textContent).toContain('Searching…');
    expect(customerField().getAttribute('aria-activedescendant')).toBeNull();
    pressInCustomer('Enter');
    await submitCreate();
    expect(nav.receiveCalls).toEqual([]);
    expect(document.querySelector('#laundry-customer-error')!.textContent).toBe('Select a customer.');
  });

  it('requires a customer: "Select a customer.", focus on the field, and no mutation', async () => {
    start();
    openCreate();
    await submitCreate();
    expect(nav.receiveCalls).toEqual([]);
    expect(document.querySelector('#laundry-customer-error')!.textContent).toBe('Select a customer.');
    expect(customerField().getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(customerField());
  });

  it('clears the selection when the text changes after choosing', async () => {
    start();
    openCreate();
    chooseCustomer();
    expect(customerField().value).toBe('Ana Reyes');
    typeCustomer('Ana R');
    await submitCreate();
    expect(nav.receiveCalls).toEqual([]);
    expect(document.querySelector('#laundry-customer-error')!.textContent).toBe('Select a customer.');
    typeCustomer('');
    await submitCreate();
    expect(nav.receiveCalls).toEqual([]);
  });

  it('creates with the chosen customer and fulfillment, toasts, and opens the drawer on the returned id without waiting for the refresh', async () => {
    nav.refetch = () => new Promise(() => {}); // the list refresh never settles
    start('status=PAID');
    openCreate();
    expect(dialog()!.textContent).toContain('New laundry order');
    expect(document.querySelector<HTMLInputElement>('#laundry-fulfillment-PICKUP')!.checked).toBe(true);
    chooseCustomer();
    act(() => document.querySelector<HTMLInputElement>('#laundry-fulfillment-DELIVERY')!.click());
    await submitCreate();
    expect(nav.receiveCalls).toEqual([{ customerId: 'c1', fulfillmentType: 'DELIVERY' }]);
    await act(async () => nav.resolveReceive('new-order'));
    expect(dialog()).toBeNull();
    expect(document.body.textContent).toContain('Laundry order created.');
    // Until #161, the new order opens in the drawer so it can be weighed.
    expect(url().get('detail')).toBe('new-order');
    expect(url().get('status')).toBe('PAID');
    expect(nav.orderQueryIds.at(-1)).toBe('new-order');
    expect(nav.refetchCalls).toBe(1);
    expect(nav.receiveCalls).toHaveLength(1);
    expect(nav.routerCalls).toEqual([]);
  });

  it('sends one mutation for two submits fired in the same turn', async () => {
    start();
    openCreate();
    chooseCustomer();
    await submitCreate(2);
    expect(nav.receiveCalls).toHaveLength(1);
    expect(button('Creating…').disabled).toBe(true);
    await act(async () => nav.resolveReceive('new-order'));
    expect(nav.receiveCalls).toHaveLength(1);
  });

  it('stays open on failure with an alert, the fields intact, and submit re-enabled for a retry', async () => {
    start();
    openCreate();
    chooseCustomer();
    act(() => document.querySelector<HTMLInputElement>('#laundry-fulfillment-DELIVERY')!.click());
    await submitCreate();
    await act(async () => nav.rejectReceive(new Error('Network down')));
    expect(dialog()).not.toBeNull();
    expect(dialog()!.querySelector('[role="alert"]')!.textContent).toBe('Unable to create laundry order.');
    expect(customerField().value).toBe('Ana Reyes');
    expect(document.querySelector<HTMLInputElement>('#laundry-fulfillment-DELIVERY')!.checked).toBe(true);
    expect(button('Create order').disabled).toBe(false);
    expect(url().get('detail')).toBeNull();
    await submitCreate();
    expect(nav.receiveCalls).toEqual([
      { customerId: 'c1', fulfillmentType: 'DELIVERY' },
      { customerId: 'c1', fulfillmentType: 'DELIVERY' },
    ]);
  });

  it('shows a server field error on the customer field, re-enables submit, and clears it when a customer is chosen again', async () => {
    start();
    openCreate();
    chooseCustomer();
    await submitCreate();
    // The Apollo-shaped error normalize.test.ts pins (captured fixture), with customerId as the field.
    await act(async () =>
      nav.rejectReceive({
        graphQLErrors: [{ extensions: { originalError: { message: ['customerId must be a string'] } } }],
      }),
    );
    expect(document.querySelector('#laundry-customer-error')!.textContent).toBe('customerId must be a string');
    expect(dialog()!.querySelector('[role="alert"]')).toBeNull();
    expect(button('Create order').disabled).toBe(false);
    chooseCustomer();
    expect(document.querySelector('#laundry-customer-error')).toBeNull();
  });

  it('shows a server fulfillment error on the fulfillment field, and clears it when fulfillment changes', async () => {
    start();
    openCreate();
    chooseCustomer();
    await submitCreate();
    await act(async () =>
      nav.rejectReceive({
        graphQLErrors: [
          { extensions: { originalError: { message: ['fulfillmentType must be one of the following values: PICKUP, DELIVERY'] } } },
        ],
      }),
    );
    const error = () => document.querySelector('#laundry-fulfillment-error');
    expect(error()!.textContent).toBe('fulfillmentType must be one of the following values: PICKUP, DELIVERY');
    expect(document.querySelector('fieldset')!.getAttribute('aria-describedby')).toBe(
      'laundry-fulfillment-fixed laundry-fulfillment-error',
    );
    expect(dialog()).not.toBeNull();
    expect(dialog()!.querySelector('[role="alert"]')).toBeNull();
    expect(button('Create order').disabled).toBe(false);
    // The checked radio fires no change; choosing the other one does.
    act(() => document.querySelector<HTMLInputElement>('#laundry-fulfillment-DELIVERY')!.click());
    expect(error()).toBeNull();
    await submitCreate();
    expect(nav.receiveCalls).toEqual([
      { customerId: 'c1', fulfillmentType: 'PICKUP' },
      { customerId: 'c1', fulfillmentType: 'DELIVERY' },
    ]);
  });

  it('keeps the dialog open and asks to check the list when the create response names no order', async () => {
    start();
    openCreate();
    chooseCustomer();
    await submitCreate();
    await act(async () => nav.resolveReceiveWithoutId());
    expect(dialog()).not.toBeNull();
    expect(dialog()!.querySelector('[role="alert"]')!.textContent).toBe(
      'The order may have been created. Check the laundry list before trying again.',
    );
    expect(document.body.textContent).not.toContain('Laundry order created.');
    expect(url().get('detail')).toBeNull();
    expect(nav.receiveCalls).toHaveLength(1);
    expect(button('Create order').disabled).toBe(false);
  });

  it('resets customer, fulfillment and errors each time it opens', async () => {
    start();
    openCreate();
    await submitCreate(); // "Select a customer."
    chooseCustomer();
    act(() => document.querySelector<HTMLInputElement>('#laundry-fulfillment-DELIVERY')!.click());
    act(() => button('Cancel').click());
    expect(dialog()).toBeNull();
    openCreate();
    expect(customerField().value).toBe('');
    expect(document.querySelector<HTMLInputElement>('#laundry-fulfillment-PICKUP')!.checked).toBe(true);
    expect(document.querySelector('#laundry-customer-error')).toBeNull();
  });

  it('closes the list on the first Escape and the dialog on the next', () => {
    start();
    openCreate();
    typeCustomer('ana');
    act(() => vi.advanceTimersByTime(300));
    expect(customerField().getAttribute('aria-expanded')).toBe('true');
    pressInCustomer('Escape');
    expect(dialog()).not.toBeNull();
    expect(customerField().getAttribute('aria-expanded')).toBe('false');
    pressInCustomer('Escape');
    expect(dialog()).toBeNull();
  });

  it('lets a SCHEDULER create, offers a link to customers, and no customer form', async () => {
    nav.role = 'SCHEDULER';
    start();
    openCreate();
    const link = dialog()!.querySelector<HTMLAnchorElement>('a[href="/app/customers"]');
    expect(link?.textContent).toBe('Add a customer');
    expect(dialog()!.querySelectorAll('input:not([type="radio"])')).toHaveLength(1); // the customer search only
    expect(dialog()!.textContent).not.toContain('Full name');
    chooseCustomer();
    await submitCreate();
    expect(nav.receiveCalls).toEqual([{ customerId: 'c1', fulfillmentType: 'PICKUP' }]);
  });
});
```

- [ ] **Step 4: Run them to verify they fail**

Run: `pnpm --filter web exec vitest run lib/laundry-list-page.interaction.test.tsx`
Expected: FAIL. `#laundry-customer` is not a combobox (the old `<select>`), and there is no toast and no link. The static page test still passes.

- [ ] **Step 5: Write the dialog**

`apps/web/components/laundry/create-laundry-order-dialog.tsx`:

```tsx
'use client';

import { useReceiveLaundryOrderMutation } from '@clensy/client';
import { FormDialog } from '@clensy/ui';
import { clensyResolver, normalizeApiValidationErrors, type Rules } from '@clensy/validation';
import {
  LaundryCustomerPicker,
  LaundryFulfillmentFieldset,
  useClensyTranslations,
  type LaundryFulfillmentType,
} from '@clensy/web';
import Link from 'next/link';
import { useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useLaundryCustomerSearch } from '../../lib/use-laundry-customer-search';

interface CreateLaundryOrderFormValues {
  customerId: string;
  fulfillmentType: LaundryFulfillmentType;
}

export interface CreateLaundryOrderDialogProps {
  onClose: () => void;
  onCreated: (orderId: string) => void;
  open: boolean;
  showAddCustomerLink: boolean;
}

const DEFAULT_VALUES: CreateLaundryOrderFormValues = { customerId: '', fulfillmentType: 'PICKUP' };

const RULES = {
  customerId: 'required',
  fulfillmentType: 'required|in:DELIVERY,PICKUP',
} satisfies Rules<CreateLaundryOrderFormValues>;

const API_FIELDS: (keyof CreateLaundryOrderFormValues)[] = ['customerId', 'fulfillmentType'];

// The laundry intake form (lifecycle spec §8.4.4, #160): a customer found by
// server-side search and a fulfillment chosen once. The page owns opening,
// remounting per opening (which resets the form, search, alert and guard),
// and what happens after a create. Creating a customer here is out of
// scope (§8.2, §8.6); the optional link leaves for the customers page.
export function CreateLaundryOrderDialog({ onClose, onCreated, open, showAddCustomerLink }: CreateLaundryOrderDialogProps) {
  const t = useClensyTranslations('laundry');
  const [receive, { loading: creating }] = useReceiveLaundryOrderMutation();
  const form = useForm<CreateLaundryOrderFormValues>({
    defaultValues: DEFAULT_VALUES,
    // Each field's whole sentence is its `:attribute`, so the `required`
    // and `in` templates print the catalog copy ("Select a customer.").
    resolver: clensyResolver<CreateLaundryOrderFormValues>(RULES, {
      attributes: {
        customerId: t('create.customer.required'),
        fulfillmentType: t('create.fulfillment.required'),
      },
      messages: { in: ':attribute', required: ':attribute' },
    }),
  });
  const [customerQuery, setCustomerQuery] = useState('');
  const [formError, setFormError] = useState<string | undefined>(undefined);
  const search = useLaundryCustomerSearch(customerQuery);
  const inFlight = useRef(false);
  const submitting = creating || form.formState.isSubmitting;
  const validateAndCreate = form.handleSubmit(handleValid);

  // Taken synchronously before validation and released when the attempt
  // settles. A second submit fired before React re-renders (and disables
  // the buttons) is dropped, and a failed attempt can be retried.
  async function handleSubmit() {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      await validateAndCreate();
    } finally {
      inFlight.current = false;
    }
  }

  async function handleValid(values: CreateLaundryOrderFormValues) {
    setFormError(undefined);
    let orderId: string | undefined;
    try {
      const result = await receive({ variables: { input: values } });
      orderId = result.data?.receiveLaundryOrder.id;
    } catch (error) {
      const fieldErrors = normalizeApiValidationErrors(error, API_FIELDS);
      if (fieldErrors) {
        for (const [field, messages] of Object.entries(fieldErrors)) {
          form.setError(field as keyof CreateLaundryOrderFormValues, { message: messages[0], type: 'server' });
        }
      } else {
        setFormError(t('create.failure'));
      }
      return;
    }
    if (orderId) {
      onCreated(orderId);
      return;
    }
    // The request succeeded but did not name the order. It may exist, so
    // the user is asked to check the list instead of being invited to
    // create it again.
    setFormError(t('create.unconfirmed'));
  }

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={t('create.title')}
      onSubmit={handleSubmit}
      submitLabel={submitting ? t('create.creating') : t('create.submit')}
      submitting={submitting}
    >
      <Controller
        control={form.control}
        name="customerId"
        render={({ field, fieldState }) => (
          <LaundryCustomerPicker
            id="laundry-customer"
            inputRef={field.ref}
            query={customerQuery}
            options={search.options}
            status={search.status}
            truncated={search.truncated}
            error={fieldState.error?.message}
            // A user edit drops any selection: the input must name the
            // customer the order is created for (picker selection contract).
            onQueryChange={(text) => {
              setCustomerQuery(text);
              if (field.value !== '') field.onChange('');
            }}
            // The chosen name is shown without going through
            // `onQueryChange`, so it does not clear the selection.
            onSelect={(option) => {
              setCustomerQuery(option.fullName);
              field.onChange(option.id);
            }}
          />
        )}
      />
      {showAddCustomerLink ? (
        <Link
          href="/app/customers"
          className="self-start text-sm text-slate-700 underline focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          {t('create.addCustomer')}
        </Link>
      ) : null}
      <Controller
        control={form.control}
        name="fulfillmentType"
        render={({ field, fieldState }) => (
          <LaundryFulfillmentFieldset
            name="laundry-fulfillment"
            value={field.value}
            error={fieldState.error?.message}
            onChange={field.onChange}
          />
        )}
      />
      {formError ? (
        <p role="alert" className="text-sm text-red-600">
          {formError}
        </p>
      ) : null}
    </FormDialog>
  );
}
```

A server field error is cleared by `react-hook-form` itself. After a submit, its default `reValidateMode: 'onChange'` re-runs the resolver on every `field.onChange`, and a valid value removes the field's error.

- [ ] **Step 6: Wire the page**

`apps/web/app/app/laundry/page.tsx`. `FormDialog` and `LaundryFulfillmentType` are used in this file only by the intake block (checked on `47503f5`), so both imports go.

Imports:

```diff
   useCurrentAdminQuery,
-  useCustomersQuery,
   useGenerateInvoiceFromOrderMutation,
@@
   usePriceLaundryOrderMutation,
-  useReceiveLaundryOrderMutation,
   useRefundLaundryOrderMutation,
@@
-import type {
-  LaundryFulfillmentType,
-  LaundryOrderStatus,
-} from '@clensy/client';
+import type { LaundryOrderStatus } from '@clensy/client';
 import {
   Button,
   ConfirmDialog,
   DetailDrawer,
   ErrorState,
-  FormDialog,
   LoadingState,
   PageHeader,
   StatusBadge,
+  useToast,
 } from '@clensy/ui';
@@
 import { Suspense, useState } from 'react';
+import { CreateLaundryOrderDialog } from '../../../components/laundry/create-laundry-order-dialog';
 import { formatMinorUnits } from '../../../lib/format-price';
 import { laundryOrdersQueryVariables } from '../../../lib/laundry-order-list-query';
+import { canViewPath } from '../../../lib/nav-groups';
 import { useDetailDrawer } from '../../../lib/use-detail-drawer';
```

In `LaundryPageContent`:

```diff
   const { data: adminData } = useCurrentAdminQuery();
   const canCreate = canReceiveLaundryOrder(adminData?.currentAdmin.role);
+  const principal = adminData?.currentAdmin;
+  const toast = useToast();
@@
-  const { data: customersData } = useCustomersQuery({
-    fetchPolicy: 'network-only',
-    variables: { paging: { limit: 100 } },
-  });
-  const [receive, { loading: creating }] = useReceiveLaundryOrderMutation();
   // Only the History-API entry points: `open`/`close` would route through
```

Replace the form state and `handleCreate`:

```diff
   const [formOpen, setFormOpen] = useState(false);
-  const [customerId, setCustomerId] = useState('');
-  const [fulfillmentType, setFulfillmentType] =
-    useState<LaundryFulfillmentType>('PICKUP');
-  const [formError, setFormError] = useState<string | undefined>(undefined);
+  // A new key per opening remounts the dialog, so every opening starts with
+  // no customer, customer pickup, no errors and a released submit guard (#160).
+  const [formKey, setFormKey] = useState(0);

   function openCreateForm() {
-    setCustomerId('');
-    setFulfillmentType('PICKUP');
-    setFormError(undefined);
+    setFormKey((key) => key + 1);
     setFormOpen(true);
   }

-  async function handleCreate() {
-    setFormError(undefined);
-    try {
-      const result = await receive({
-        variables: { input: { customerId, fulfillmentType } },
-      });
-      setFormOpen(false);
-      await ordersQuery.refetch();
-      const newId = result.data?.receiveLaundryOrder.id;
-      // Only the destination URL is built here (live list state, hash,
-      // `detail`), so this open is a native write like the rest of the
-      // list. The create flow itself belongs to #160.
-      if (newId) openWithHref(hrefFor((current) => current, { set: { detail: newId } }));
-    } catch {
-      setFormError('Unable to create laundry order.');
-    }
-  }
+  // Until the order page cutover (#161), a new order opens in the drawer,
+  // so it can still be weighed; #161 sends it to `/app/laundry/[id]`. It
+  // opens at once, with the id the mutation returned. The list refresh runs
+  // behind it and is not awaited, so a slow or failed refresh cannot keep
+  // it closed; the list shows its own error. Only the destination URL is
+  // built here (live list state, hash, `detail`), so this open is a native
+  // write like the rest of the list.
+  function handleCreated(orderId: string) {
+    setFormOpen(false);
+    toast.success(t('create.success'));
+    openWithHref(hrefFor((current) => current, { set: { detail: orderId } }));
+    void ordersQuery.refetch().catch(() => undefined);
+  }
```

Remove `const customers = customersData?.customers.nodes ?? [];`.

Replace the whole `<FormDialog …>…</FormDialog>` intake block with:

```tsx
      <CreateLaundryOrderDialog
        key={formKey}
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={handleCreated}
        showAddCustomerLink={principal ? canViewPath(principal, '/app/customers') : false}
      />
```

- [ ] **Step 7: Run the focused tests, then the page tests**

Run, in order:

```bash
pnpm --filter web exec vitest run lib/laundry-customer-picker.interaction.test.tsx lib/use-laundry-customer-search.test.ts lib/use-laundry-customer-search.hook.test.tsx
pnpm --filter web exec vitest run lib/laundry-list-page.test.tsx lib/laundry-list-page.interaction.test.tsx
```

Expected: PASS. Every existing page test (create-race included) and the 16 new intake tests pass, and the new static list-error test.

- [ ] **Step 8: Typecheck, lint, the whole web suite**

Run: `pnpm --filter web test && pnpm --filter web lint && pnpm --filter web exec tsc --noEmit`
Expected: all pass. The `use-detail-drawer.guard.test.ts` guard (no `router.refresh`, no marker-dropping writes) MUST stay green with the new `components/laundry` file in its scan.

- [ ] **Step 9: Commit**

```bash
git status --short   # expect only the four files below; Tasks 1–4 are already committed
git add apps/web/components/laundry/create-laundry-order-dialog.tsx apps/web/app/app/laundry/page.tsx apps/web/lib/laundry-list-page.test.tsx apps/web/lib/laundry-list-page.interaction.test.tsx
git diff --cached --stat
git commit -m "feat(web): redesign the laundry order creation modal (#160)"
```

---

### Task 6: Final verification and PR

**Files:** none changed, except this plan's gate records.

- [ ] **Step 1: Scope check**

Run: `git diff --name-only main...HEAD`
Expected: exactly the files in the [File map](#file-map), plus this plan. Nothing under `apps/api/src`, `packages/ui`, `packages/client`, `packages/validation`, `docs/workflows`, or any lockfile/`package.json`.

- [ ] **Step 2: Every suite and build**

Run, each to completion. `web` is `apps/web` and `@clensy/web` is `packages/web` (see the header's "Package names" row).

```bash
pnpm --filter @clensy/web test
pnpm --filter @clensy/web lint
pnpm --filter @clensy/web build
pnpm --filter web test
pnpm --filter web lint
pnpm --filter web exec tsc --noEmit
pnpm --filter web build
pnpm --filter api test:e2e -- laundry-intake-customer-search laundry-order-list-filters laundry.e2e
pnpm lint
```

Expected: all pass. Record each command's result in the M6 Slice Completion Report's Validation table.

- [ ] **Step 3: Manual browser checks**

Run the app (`pnpm dev`, web on :3001) against the local API and database. Check each item, and record the viewport, role and result in the PR:

1. Desktop, TENANT_OWNER: open "+ New Laundry Order". Focus is in the Customer field. Type part of a name: "Searching…", then matches with phone or email. ArrowDown/ArrowUp/Enter choose one; Escape closes the list and a second Escape closes the dialog. Click an option with the mouse: it is chosen. Fulfillment rows show both descriptions and "This choice is fixed at intake."; the selected row has the dark border; the two rows sit side by side.
2. Submit with no customer: "Select a customer." under the field, field focused, no request in the network panel. Choose, then edit the name: submit is refused again.
3. Create: dialog closes, "Laundry order created." toast, the drawer opens on the new order, which can be weighed.
4. A customer created after the first 100 (by name order) is found by name. A common fragment matching more than 20 customers shows "More customers match…".
5. Below 640 px: the dialog fits without horizontal scroll; the fulfillment rows stack; the result list is usable with the soft keyboard.
6. SCHEDULER: can create; the dialog has the "Add a customer" link and no customer form.
7. FINANCE and ANALYST: no "+ New Laundry Order" button.

- [ ] **Step 4: Open the PR**

Push `feat/160-laundry-intake-modal` and open the PR against `main` with `gh pr create` (`workflow.providers.pullRequests: github`). The body MUST include:
- "Closes #160."
- **Cutover:** "Until the end-to-end issue (#161) switches it to `/app/laundry/[id]`, a successful create still opens the existing drawer on the new order, so it can be weighed."
- No new GraphQL mutation, no API, schema or `@clensy/ui` change, no new dependency.
- The search guarantee (name search on the server, 20 per search, "More customers match…", no load-more).
- The manual check table from Step 3.

---

## Self-review (planner)

| Check | Result |
| --- | --- |
| Every major task traces to the Accepted spec | Yes; see [Traceability](#traceability). |
| No task introduces new product semantics | Yes. UI decisions called out for M5: any edit after a selection clears it (Selection contract); the "More customers match…" line and the "may have been created" message (new copy for the search guarantee and the missing-id case); the drawer opens before the list refresh. None changes an API contract or a stored value. |
| Task order executable without inventing work | Yes: 1 is independent; 2 → 3 (copy) → 4 (types) → 5 → 6. |
| Deferred work explicitly identified | Yes; see [Deferred](#deferred-not-in-this-plan). |
| Missing design semantics | None found. |
| Pre-validation claim | None claimed. |
| Characterization tests labelled | Task 1, and the Task 5 Step 1 list-error test. |
| Every M5 review 1 finding answered | Yes; see [Revision 2 (M5 review 1)](#revision-2-m5-review-1). |
| Every M5 review 2 finding answered | Yes; see [Revision 3 (M5 review 2)](#revision-3-m5-review-2). |

## Gate outcomes

### M5 — Accepted (2026-10-14, third pass)

Accepted at `40e2888` (revision 3) by the owner, recorded at `59cfffb`. The first two passes returned findings, each resolved in the Revision 2 and Revision 3 logs. The acceptance covers the plan only.

### M6 — Implementation complete (2026-10-14)

Implemented on `feat/160-laundry-intake-modal` from the Accepted plan (`40e2888`) and the Accepted lifecycle spec with Amendment #164, **subagent-driven**: a fresh implementer per task, then a task-scoped review (spec compliance and code quality) of each task's diff. Tasks 1–5 in plan order, one commit each, plus one lint follow-up on Task 1 and one fix round on Task 3 found by the manual browser check. The controller re-ran each task's tests rather than relying on subagent reports. No task was split, merged or reordered, and no product semantics were added.

| Task | Commit | Evidence |
| --- | --- | --- |
| 1 API search and intake (**characterization**) | `8b26fc3`, lint follow-up `de3204c` | 4 passed (controller re-run). Failure evidence, not committed: expected phone mutated to `555-9999` → 1 failed / 3 passed, then restored byte-identical. The follow-up commits the formatting that `pnpm --filter api lint` (`eslint --fix`) applied and types the search result, clearing a new `no-unsafe-argument` warning; assertions unchanged. |
| 2 Copy and fulfillment fieldset | `f50d6af` | RED `Cannot find module` → GREEN 4 passed. `@clensy/web` 406 passed (controller re-run), lint and build clean. |
| 3 Customer picker | `216d8b0`, fix round `9a0e67a` | Static RED → GREEN 5 passed. Interaction test RED with the export reverted (10 failed) → GREEN 10 passed (controller re-run). Fix round: 2 new tests RED before the fix, then 12 passed. |
| 4 Search hook | `d4b97fa` | RED `Cannot find module` → GREEN 2 + 9 passed (controller re-run). Lint clean. |
| 5 Dialog and page | `6f5b7a8` | Step 2 gate: only the create-race test failed (`'set value' called on an object that is not a valid instance of HTMLInputElement`, thrown from `typeCustomer`). The list-error **characterization** test failed against `hasError={false}` (not committed) and passes restored. GREEN: 16 new intake tests, the static list-error test and every existing page test pass. `web` 750 passed, lint and `tsc` clean. |

Deviations, each a test-only or lint-only change recorded as a ruling during execution:

- Task 3 static test asserts `autoComplete="off"`: React 19 server markup emits the camelCase attribute. Its `input`/`render` helpers were swapped in source order for `contextforge/function-order`.
- Task 5 test file: the hoisted `nav` keys were reordered for `record-key-order`. `dialog()` matches only the `role="dialog"` element that contains a form, because the `DetailDrawer` (also `role="dialog"`) opens after a create and has no form. Two server-error-clearing assertions wait one `act` turn, because react-hook-form clears asynchronously.
- Task 5 Step 2 and Step 4: the RED runs were wider than the plan predicted. The per-variables customer mock crashes on the old page's unfiltered `limit: 100` query. A temporary mock guard, not committed, ran the Step 2 gate.
- Task 1 follow-up `de3204c`: as above.
- Task 3 fix round `9a0e67a`, from the manual check below. The Escape branch also calls `event.nativeEvent.stopImmediatePropagation()`. Next.js hydrates React on `document`, so React's root listener and `Modal`'s `document` keydown listener share a node, and a synthetic `stopPropagation()` did not stop `Modal`'s listener. The jsdom tests render into a `<div>`, so they could not see it. A regression test now puts the stand-in `Modal` listener on the React root node. The same round moved the option `onMouseDown` `preventDefault` to the popup container (a deferred task-review minor), so a mousedown on padding, the scrollbar or a status line no longer closes the list.

Final verification, after the fix round:

| Command | Result |
| --- | --- |
| `pnpm --filter @clensy/web test` | 15 files, 411 passed |
| `pnpm --filter @clensy/web lint` / `build` | clean / clean |
| `pnpm --filter web test` | 32 files, 752 passed |
| `pnpm --filter web lint` / `exec tsc --noEmit` / `build` | clean / clean / compiled |
| `pnpm --filter api lint` | clean, 0 warnings |
| `pnpm --filter api test:e2e -- laundry-intake-customer-search laundry-order-list-filters laundry.e2e` | 3 suites, 13 passed (before the fix round; it touched no API file) |
| `pnpm lint` | exit 0 (before the fix round; its only warning was the one `de3204c` cleared) |
| Scope: `git diff --name-only main...HEAD` | exactly the File map plus this plan |

Manual browser check, on the real `/app/laundry`. Setup: this branch's API on port 3010 (`WEB_ORIGIN=http://localhost:3011`) and this branch's web as a production build on 3011 (the dev server hit the OS file-watch limit), with the local Postgres. Throwaway local staff (`qa160-{owner,scheduler,finance,analyst}-…@example.com`) were created through `createAdmin` and disabled afterwards with `disableAdmin`. Two laundry orders created during the check remain in the local dev data. Driven with Playwright; screenshots in `.playwright-mcp/` (gitignored).

| # | Viewport, role | Result |
| --- | --- | --- |
| 1 | 1280, TENANT_OWNER | Focus starts in Customer. Both descriptions and "This choice is fixed at intake." show; the selected row has the dark border; rows sit side by side. Typing "ana re" sent one `Customers` query (`%ana re%`, limit 20, `fullName` then `id` ASC), listed 20 options and "More customers match…" (52 match). Arrows move the active option. Escape: **failed on the first build** (closed the dialog); **passes after `9a0e67a`**: the first Escape closes the list and keeps the dialog, text and focus; the second closes the dialog. |
| 2 | 1280, TENANT_OWNER | Submit with no customer: "Select a customer.", `aria-invalid="true"`, focus in the field, no `ReceiveLaundryOrder`. |
| 3 | 1280, TENANT_OWNER | Mouse-chosen customer, Delivery: one `ReceiveLaundryOrder {customerId, DELIVERY}`; dialog closed; "Laundry order created."; the drawer opened on the returned id with the weigh form. |
| 4 | 1280, TENANT_OWNER | "Laundry Jane", past position 100 by name among 126 customers, is found by name. |
| 5 | 390, TENANT_OWNER | No horizontal scroll (`scrollWidth` 375); dialog 343 px; fulfillment rows stacked; the result list is usable. |
| 6 | 1280, SCHEDULER | "Add a customer" link, one text input, no customer form. ArrowDown + Enter chose without submitting; create succeeded with toast and drawer. |
| 7 | 1280, FINANCE and ANALYST | List visible; no "+ New Laundry Order". |

An observation for the owner, not a defect: the local e2e fixtures include many namesakes sharing the phone `555-1`. Under the issue's "phone, or email when phone is empty" rule those rows cannot be told apart. Real customers rarely share a phone, but the rule cannot separate two people with the same name and phone.

Deferred task-review minors (for M7 triage), from the execution ledger:

- Task 2: the fieldset's server error `<p>` has no `role="alert"` and the fieldset no `aria-invalid`. The option description is inside the label and also in `aria-describedby`, so it may be announced twice. Both are plan-mandated markup.
- Task 3: Arrow keys while the search is `idle` set the list open (cosmetic). The click test does not assert that the list closes.
- Task 4: clearing and retyping the same text within 300 ms sends a query without a fresh debounce; no stale option is offered.
- Task 5: Escape can close the dialog while a create is pending (Cancel is disabled, Escape is not). The create still completes (toast and drawer), and a reopened dialog has a fresh guard. A malformed `receiveLaundryOrder: null` response would show "Unable to create…" rather than the "may have been created" message (the schema is non-nullable). No test pins guard release after a client-validation failure followed by a successful submit.

Next gate: **M7 — Code Review**. A fresh independent reviewer on the most capable model is required (`CLAUDE.md`: application code).

### M7 — Approved for merge (2026-10-14, fresh independent review)

A fresh agent context on Opus 5.5 reviewed this slice. It did not implement the change (`CLAUDE.md`: application code). It was given the Accepted spec, this Accepted plan, the issue and the branch diff `47503f5..e3f27fd`, and it made no repository edits. This record cites that review; it is **not** a self-review.

```text
Decision: Approved for merge
Subject: PR #179, branch feat/160-laundry-intake-modal, merge-base 47503f5 → head e3f27fd (12 commits)
Accepted specification: docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md
  (Amendment #164 §8.4.4 second bullet; §8.2; §8.6; §4.4)
Accepted implementation plan: this plan (revision 3, M5 Accepted at 40e2888, recorded at 59cfffb)

Plan tasks reviewed:
- Task 1 (API characterization e2e): ✓ — 8b26fc3, lint follow-up de3204c
- Task 2 (copy + LaundryFulfillmentFieldset): ✓ — f50d6af
- Task 3 (LaundryCustomerPicker): ✓ — 216d8b0, fix round 9a0e67a
- Task 4 (search variables + hook): ✓ — d4b97fa
- Task 5 (dialog + page): ✓ — 6f5b7a8
- Task 6 (verification + PR): ✓ — PR #179 body carries "Closes #160.", the Cutover sentence, "Not changed",
  the search guarantee and the manual check table

Verification evidence (re-run by the reviewer at e3f27fd; working tree clean before and after):
- @clensy/web test 411 passed; lint and build clean
- web test 752 passed; lint, tsc --noEmit and build clean
- api e2e laundry-intake-customer-search 4 passed
- api lint / root lint not re-run (the api script applies --fix); M6 recorded both clean
- Scope: 16 files, exactly the File map plus this plan; nothing under apps/api/src, schema, migrations,
  packages/ui, packages/client, packages/validation or docs/workflows; no package.json or lockfile change
- Plan fidelity: the dialog, hook and fieldset are identical to the plan's code (whitespace-insensitive);
  the picker differs only by the recorded 9a0e67a fix round
- Commit hygiene: no Co-Authored-By or "Generated with" line in any commit or in the PR body
- M6 gate: the first implementation commit 8b26fc3 follows the M5 record 59cfffb

Review summary: Tasks 1–6 implemented faithfully; no invented semantics. The 9a0e67a Escape fix is correct for
Next.js's document-root hydration (only nativeEvent.stopImmediatePropagation() stops a same-node listener) and is
pinned by a regression test. "Success opens /app/laundry/[id]" is authorized staged delivery (#161).

Blocking findings: None (no merge blockers)

Deferred task-review minors, triaged — required before merge: none.
- T2-a fieldset error <p> without role="alert" / aria-invalid: may be deferred (plan-mandated; practically unreachable)
- T2-b description announced twice: may be deferred (verbosity only)
- T3-a arrows while idle set `open`: may be deferred (no observable effect)
- T3-b click test does not assert close: may be deferred (shared select() → close(); Enter test asserts it)
- T4 clear-and-retype within 300 ms skips a fresh debounce: may be deferred (no stale option; one extra request)
- T5-a Escape/backdrop can close the dialog while a create is pending: may be deferred; follow-up issue
  recommended, fixed once in @clensy/ui FormDialog/Modal (listed under Deferred)
- T5-b receiveLaundryOrder: null in non-null data: may be deferred (schema non-null; data: null case is handled)
- T5-c no test of guard release after a validation failure then success: may be deferred (release is structural)

Non-blocking observations (do not affect the decision): the T5-a follow-up; the Planning-spikes Escape line
(annotated in M9); one extra search per selection (harmless); live-region timing (listed under Deferred);
stopImmediatePropagation also hides Escape from later same-node listeners (intended; none besides Modal);
namesakes sharing a phone (product/data question outside #160).

Gate: Merge per human/project norms. M8/M9 may follow when appropriate.
```

### M8 — N/A (2026-10-14)

```text
Decision: N/A
Subject: PR #179, branch feat/160-laundry-intake-modal, head e3f27fd
Accepted specification: docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md (Amendment #164 §8.4.4)
Accepted implementation plan: this plan (revision 3)
M7 / authorization: Approved for merge (e3f27fd); M7–M10 requested by the owner ("m7-m10")

Candidates considered, and why none is an M8 refactor:
- The page tests' typeCustomer duplicates the list's typeSearch helper (native value setter + input event).
  Both are four-line test helpers bound to different element ids in the same file; extracting a shared helper
  saves little and touches #163's tests outside this slice's need.
- T3-a (arrows while idle set `open`) would change state-transition behaviour, however invisibly — not M8.
- T5-a/T5-b/T5-c are a @clensy/ui behaviour change, an error-path change and a test addition — none is a
  behaviour-preserving refactor; all are recorded under Deferred or in the M7 triage.
- The dialog, hook, picker and fieldset are each one small, single-purpose module, already matching the plan;
  no duplication or complexity worth the risk.
No code changed in M8.
```

### M9 — Complete (2026-10-14)

```text
Decision: Complete
Subject: #160 Laundry intake modal, PR #179
Accepted specification: docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md (with Amendment #164)
Accepted implementation plan: this plan (revision 3)
M7: Approved for merge (e3f27fd). M8: N/A.

Documentation scope:
- packages/web/README.md (laundry section)
- apps/web/README.md (UI component list; new laundry intake section)
- this plan (Planning-spikes Escape line, Deferred list, Status row, Gate outcomes)

Updated artifacts:
- packages/web/README.md ← M6 Tasks 2–3 and fix 9a0e67a: the section intro names the intake dialog (#160);
  new bullets for <LaundryCustomerPicker> (ownership, selection contract, id-tracked active option, keyboard and
  the document-root Escape handling, row and status lines) and <LaundryFulfillmentFieldset>; the copy bullet names
  the `create` keys.
- apps/web/README.md ← M6 Tasks 4–5: the two components added to the consumed @clensy/web list; a new
  "Laundry intake (`/app/laundry`)" section (search hook and its stale-result rule, form and the three failure
  paths plus the missing-id message, one-mutation guard, key reset, roles and link, pre-#161 success behaviour).
- this plan ← M7: the Escape planning-spike line now carries the M6 correction; the T5-a follow-up and the
  live-region observation are under Deferred; the Status row and the M7–M10 records.

Editorial changes: none needed beyond the above; existing links were already correct.

Unchanged, with reason:
- docs/README.md records API and tenant-isolation slices; this slice adds only a test under apps/api.
- The lifecycle spec: #160 implements §8.4.4 without amending it; implementation slices are tracked by epic #154
  (#157/#163 precedent).
- No changelog or roadmap file exists in the repository.

Verification:
- Links: every relative link and in-page anchor in both READMEs and this plan resolves (scripted scan,
  48 checked, 0 broken).
- Heading hierarchy: the new `##` section in apps/web/README.md follows "Laundry list" and precedes i18n; in
  packages/web/README.md the new content is bullets inside the existing `##` laundry section.
- Status consistency: plan Accepted (revision 3); M6 complete; M7 Approved; M8 N/A; M9 complete; PR #179 open.
- Terminology follows the spec and the plan: intake, fulfillment, pickup/delivery, drawer / `?detail=`,
  cutover (#161), `receiveLaundryOrder`.
- Duplicates / outdated refs: the plan's Escape spike line was the only outdated statement; it is annotated
  rather than rewritten (Accepted text keeps its history).

Gate: Documentation complete. Code, behaviour and contracts are unchanged by this stage.
```

### M10 — Accepted, workflow validated (2026-10-14)

```text
Decision: Accepted
Subject: workflow prompt library
Governing specification: docs/workflows/specs/agent-workflow-design.md
```

**Subject:** the installed workflow prompt library (`docs/workflows/`, generic 1.4.1 / claude 0.2.0), run on #160 from M4 to M9. There was no M2/M3 for this slice: #160 implements the already-Accepted Amendment #164 §8.4.4, as #157 and #163 did. The Context Forge dispatch asked for "Brainstorm (project default)"; the workflow's own selection rule (an Accepted spec exists → M4) governed, and the owner accepted that route by reviewing the plan.

**Asset inventory:** unchanged. Nine prompts map to M2–M10, with `conventions/prompt-library.md` as M1 and `conventions/reporting-conventions.md` for Slice Completion Reports. There are no orphan assets.

**Checks:**
- §2.5: M5 Accept of revision 3 (`40e2888`, recorded `59cfffb`) precedes the first M6 commit `8b26fc3`.
- M5's Return path worked as specified twice: revision 1 and revision 2 were each Returned with findings, revised at M4 with a resolution log, and re-reviewed; no Accepted artifact was rewritten silently.
- The authority model held: the spec governed semantics (the search guarantee and the missing-id message were decided against §8.4.4 and the issue); the plan governed sequencing (Tasks 1–5 in order, one commit each; the deviations were test- or lint-only rulings and one fix round, all recorded).
- CLAUDE.md's M7 rule was honoured: a fresh, independent reviewer on the most capable model, read-only, given the spec, plan and diff.
- Providers were honoured: GitHub for issues #160/#154/#161/#156, the branch and PR #179, all through `gh`.
- Slice Completion Reports were emitted at M6, M7 and M8–M10.
- §2.8 was honoured: one PR (#179) carries the plan, implementation, fix round and docs.
- No commit on the branch carries a `Co-Authored-By` trailer or "Generated with" line (M7 checked; the PR body has none).

**Blocking findings:** none.

**Non-blocking observations:**
1. **jsdom renders into a `<div>`; Next.js hydrates on `document`.** Every unit and page test passed while the real app's first Escape closed the whole dialog, because a same-node listener is invisible to a div-rooted test. Only the manual browser check found it. Lesson: when a component stops an event that a `document`-level listener also handles, M4 should add a test that puts that listener on the React root node, and the manual checks must include the interaction.
2. **Topic-based M5 parts worked better than line-range parts.** The second pass split the plan by topic (search, hook, picker, submission, page) with the matching revision-log rows; the reviewer could judge each finding's resolution in one place.
3. **Small real spikes settled review disputes quickly.** Two throwaway jsdom traces of the real Apollo 3.14.1 `useQuery` (a change of variables; a failed refetch) answered M5 questions that mocks alone could not.
4. **Subagent-driven M6 with controller re-runs** caught nothing the implementers misreported, but the per-task reviews did surface the minors that M7 later triaged, and the ledger kept every ruling. The API lint script runs `eslint --fix`, so a verification run can change files; Task 6 should note that, or use `eslint` without `--fix` for checking.
5. **The local dev web container serves a stale build without source mounts**, and CORS allows only port 3001, so manual checks need the branch API and web on spare ports with `WEB_ORIGIN` set; the Next dev server can hit the OS file-watch limit beside `nest --watch`, so a production build is the reliable path.

Gate: **Workflow validated.**

**Follow-ups filed after M10 (2026-10-14):** [#180](https://github.com/rexescario-dev/clensy-platform/issues/180) (form dialogs closable mid-submit, M7 T5-a), [#181](https://github.com/rexescario-dev/clensy-platform/issues/181) (intake screen-reader polish, M7 T2-a/T2-b and the live-region observation), [#182](https://github.com/rexescario-dev/clensy-platform/issues/182) (namesakes and more than 20 identical names, a product question). The T3-b and T5-c test gaps were added to [#161](https://github.com/rexescario-dev/clensy-platform/issues/161#issuecomment-6150819168) for its verification pass. M7 T3-a, T4 and T5-b stay recorded in the M7 triage only (no observable effect or schema-unreachable).
