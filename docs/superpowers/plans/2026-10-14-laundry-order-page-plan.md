# Laundry Order Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

| Field | Value |
| --- | --- |
| Status | **Accepted (revision 4)** — M5, 2026-10-14. Ready for M6. |
| M5 decision | **Accepted** — 2026-10-14, revision 4 (`76650be`), by the owner, after a fourth pass on the changed pieces: `resolvedInvoiceNodes` validates the result shape; a confirmed empty list alone means no invoice; missing or malformed data and loading or failed queries stay unresolved; the nav and the Invoice section read one validated value; the two page regressions check that an incomplete result neither selects Invoice nor shows the empty-invoice or error message. One P3 coverage suggestion (an explicit `nodes: null` case) was folded into Task 2 at acceptance, as an eighth `resolvedInvoiceNodes` test; no other change. This accepts the plan only: no planned suite, lint, type-check or build has run. M7 MUST be a fresh independent review (`CLAUDE.md`: application code). |
| M5 history | First pass (2026-10-14, owner): **Returned for Revision**. One P2 finding: the current-section rule could read invoice data that Apollo retains while the invoice query is loading or has failed. Resolved in [Revision 2 (M5 review 1)](#revision-2-m5-review-1). Second pass (2026-10-14, owner): **Returned for Revision**. The invoice finding confirmed resolved. One new P2 finding: the loading check skipped `LoadingState` when Apollo retains earlier order data while the order query loads. Resolved in [Revision 3 (M5 review 2)](#revision-3-m5-review-2). Third pass (2026-10-14, owner, reviewed in five parts): **Returned for Revision**. Both earlier findings confirmed resolved. One P2: a finished invoice result without the invoice connection must stay unresolved, never "no invoice", and needs a regression test. Resolved in [Revision 4 (M5 review 3)](#revision-4-m5-review-3). |
| Date | 2026-10-14 |
| Tracking issue | [#156](https://github.com/rexescario-dev/clensy-platform/issues/156) "Dedicated laundry order detail page and overview". Epic [#154](https://github.com/rexescario-dev/clensy-platform/issues/154). Depends on [#157](https://github.com/rexescario-dev/clensy-platform/issues/157) (closed: `LaundryOrderProgress`, `formatWeightGrams`, `laundryOrderActions`, the `laundry` copy). The sections are filled later by #155, #158, #162, #166 and #165. The list cutover is [#161](https://github.com/rexescario-dev/clensy-platform/issues/161). |
| Branch | `feat/156-laundry-order-page`, from `main` at `55a84a7`. One PR for this plan, its M5 record and the implementation. |
| Scope | `apps/web` (new route `app/app/laundry/[id]/page.tsx`, a new helper module, one exported helper in an existing module, tests), `packages/web` (`laundry.order` copy), `packages/client` (one operation-document change, regenerated client, one test). No API source, schema, migration, resolver or `@clensy/ui` change. The list page `apps/web/app/app/laundry/page.tsx` is **not** edited. No new dependency. |
| Implements (Accepted) | [Laundry Orders & Lifecycle](../specs/2026-09-06-laundry-orders-lifecycle-design.md), Status **Accepted** (2026-09-06), with **Amendment #164**, Accepted 2026-10-10. Governing text: §8.4.4, third bullet: "`/app/laundry/[id]` is the order workspace: back link to the list, customer, order id, fulfillment, status, progress through the §4.3 happy path (the `AWAITING_PAYMENT` branch is shown when that is the status, not as a required step), summary, weighing, services, price, invoice, and lifecycle actions. `AWAITING_PICKUP` and `AWAITING_DELIVERY` stay mutually exclusive by `fulfillmentType`." Also §8.4.4, fourth bullet (the `?detail=` redirect; this slice ships only its pure helper, see Deferred), the services bullet (how a line's quantity is shown per unit), the actions bullet (matrix ∩ fulfillment branch ∩ role), §8.2 ("The order page may show `createdAt`, `updatedAt`, and current status. It must not present that as an event history."), §4.9 badge tones, §4.4 RBAC (`laundryOrder` read: VIEW roles). |
| Relies on (Accepted, merged) | [Laundry UI Foundation plan](2026-10-10-laundry-ui-foundation-plan.md) (#157): `LaundryOrderProgress`, `laundryProgressSteps`, `LAUNDRY_STATUS_TONE`, `formatWeightGrams`, `laundryOrderActions`, `LaundryOrderVerb`, the `laundry` message catalog. [Laundry Order List plan](2026-10-10-laundry-order-list-plan.md) (#163): the UUID shape check in `laundry-order-list-query.ts`, the static page-test harness. [Paginated GraphQL collections](../specs/2026-08-28-paginated-graphql-collections-design.md): nested connections default to 20, max 100 (`PLATFORM_PAGE_MAX`). [Role-aware typed URLs](../specs/2026-10-04-role-aware-typed-urls-design.md): `findActiveHref` segment matching. |
| Authority | Where this plan and the Accepted spec disagree, the **spec wins** and this plan must be revised. Issue #156 refines §8.4.4 with layout, copy and test requirements; it adds no product semantics. File names, helper names, copy keys, element ids and task order are planning decisions, not product semantics. |
| Owner decisions (M4, 2026-10-14) | Asked during planning, because #156 leaves them open: **(1) Placeholder sections** show read-only facts the order already records (Weighing: the weight or "Not weighed yet."; Services: whether lines exist; Price: the total or "Not priced yet."; Invoice: the invoice's number, total and payment status, or "No invoice yet."; Actions: the lifecycle actions the role may take, as plain text, or "No further actions for this order."). No buttons or forms. **(2) Current section** is the next step forward, not any legal verb: a `WEIGHED` order marks **Services**, not Weighing, because re-weighing is a correction. |
| Edit anchors | New files are given in full. Edits to existing files are given against `main` at `55a84a7`. Apply each by the quoted code, not by line number. |
| Package names | `pnpm --filter web` is `apps/web` (package `web`). `pnpm --filter @clensy/web` is `packages/web`. `pnpm --filter @clensy/client` is `packages/client`. |
| Pre-validation | **None claimed.** Read-only spikes ran at planning time and are recorded under [Planning spikes](#planning-spikes); no task's `Expected:` commands were run. |
| M7 | Application code changes, so `CLAUDE.md` requires a **fresh independent reviewer** on the most capable model, given this plan, the Accepted spec and the branch diff. |

**Goal:** Ship `/app/laundry/<id>`: a focused, read-only page for one laundry order. It has a back link, a header (customer, order id, status, fulfillment), the shared progress, a four-card summary, an in-page section nav, and six sections. Overview lists the order's lines. Weighing, Services, Price, Invoice and Actions show the facts the order already records, with no forms or buttons, until their own issues replace them. The page is reachable by direct URL and refresh. The list keeps opening the drawer until #161.

**Architecture:**

- **Data (`packages/client`):** the existing `LaundryOrder` query, through the shared `LaundryOrderDetail` fragment. The fragment's `lines` connection gains `paging: { limit: 100 }`, so a normal order's lines are complete (the server default is 20). The existing `InvoiceForOrder` query supplies the Invoice section. Both read queries allow the same six VIEW roles.
- **Pure helpers (`apps/web/lib/laundry-order-page.ts`):** the section list and their element ids, the order URL, the `?detail=` redirect target (for #161), the current-section rule, the lifecycle-verb filter for the Actions section, and how a line's quantity is shown per unit.
- **Route (`apps/web/app/app/laundry/[id]/page.tsx`):** a client page. It reads `id` with `useParams`, skips both queries for an id that is not UUID-shaped, and renders the loading, error and loaded states. It keys the workspace by `id`, so a navigation between orders starts fresh.
- **Copy (`packages/web`):** new keys under `laundry.order`. Existing keys (`status`, `fulfillment`, `actions`, `invoicePaymentStatus`, `error.order`, `noActions`, `progress.*`) are reused.

**Tech Stack:** React 19, Next.js 16 app router (`useParams`), Apollo Client (`@clensy/client` generated hooks), `graphql` 17 (`visit`, `print`), Tailwind, Vitest (`renderToStaticMarkup` in node).

**Spec:** `docs/superpowers/specs/2026-09-06-laundry-orders-lifecycle-design.md` §8.4.4 (with §8.2, §4.9, §4.4).

## Global Constraints

Derived from the Accepted spec, issue #156 and the owner decisions above. Every task's requirements implicitly include this section.

- **SHALL** add the route at `apps/web/app/app/laundry/[id]/page.tsx`. **SHALL NOT** edit `apps/web/app/app/laundry/page.tsx`: the list, its drawer, `useDetailDrawer`, row clicks and post-create navigation stay as they are until #161 (#156 §Integration boundary).
- **SHALL** load the order with the existing `laundryOrder(id)` query (`LaundryOrderDetail`), `fetchPolicy: 'network-only'`. A `null` order, any query error, or an id that is not UUID-shaped renders `ErrorState` "Unable to load laundry order." (the existing `laundry.error.order` key) with the back link. It never redirects to login: session handling stays with the existing session guard.
- **SHALL NOT** send a request for an id that is not UUID-shaped (both queries `skip`). Postgres rejects such an id with "invalid input syntax for type uuid", so it can never be an order.
- **SHALL** request `lines(paging: { limit: 100 })` in `LaundryOrderDetail`, and **SHALL NOT** exceed `PLATFORM_PAGE_MAX` (100). When `lines.pageInfo.hasNextPage` is `true`, show "More lines are not loaded." The fragment is shared by the detail query and the laundry mutations, so the drawer gets the same 100-line page; that is intended.
- **SHALL** lay the page out as `flex flex-col gap-8`, in this order: back link, header, progress, summary, section nav, sections.
- **Back link:** a Next `Link` to `/app/laundry`, text "Back to laundry orders", `text-sm text-slate-600 underline`. No breadcrumb component.
- **Header:** `PageHeader` with `title` = customer full name (the page's only `h1`) and `description` = the full order id. `actions` = `StatusBadge` (human label `t('status.<STATUS>')`, tone `LAUNDRY_STATUS_TONE`) and the fulfillment label ("Customer pickup" / "Delivery"), in a local `flex flex-wrap items-center justify-end gap-2` wrapper. **SHALL NOT** modify `PageHeader`.
- **Progress:** `LaundryOrderProgress` from `@clensy/web`, unchanged. It already shows the `AWAITING_PAYMENT` branch only when that is the status, keeps pickup and delivery mutually exclusive by `fulfillmentType`, and replaces the steps for terminal statuses.
- **Summary:** a `dl` with `grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4`. Each item is `rounded-md border border-slate-200 p-3` holding a `dt` and a `dd`. Terms in order: Customer, Fulfillment, Weight, Total. Weight is `formatWeightGrams`; Total is `formatMinorUnits`; either is an em dash (`—`) when `null`. A missing total is never shown as zero.
- **Section nav:** `nav aria-label="Order sections"` around a `ul` with `flex gap-3 overflow-x-auto`. Links, in order: Overview, Weighing, Services, Price, Invoice, Actions. Each is a plain `<a href="#laundry-order-<section>">`. No tabs. The current section's link has `aria-current="true"` and `font-medium text-slate-900`; every other link is `text-slate-600`. At most one link is current.
- **Current section (owner decision 2):** from `laundryOrderActions(status, fulfillmentType, role)`:
  1. **Weighing** when the status is `RECEIVED` and `weigh` is offered;
  2. else **Services** when `price` is offered;
  3. else **Invoice** when `generateInvoice` is offered and the invoice query has resolved with no invoice;
  4. else **Actions** when any other verb is offered;
  5. else none.

  Overview and Price are never current: Overview has no action, and pricing starts in Services. While the role or the invoice query is unresolved, a rule that needs it does not match.
- **Invoice result (one source for nav and body):** the invoice query counts as resolved only when it is not loading, has no error, and its data carries the `invoices` connection with a `nodes` array (`resolvedInvoiceNodes`, built on `resolvedQueryData`). Only that confirmed list decides: empty means no invoice; one node means an invoice exists. A finished result with no data, with no `invoices` connection, or with no `nodes` array is **unresolved**, exactly like loading: no current-section match, no "No invoice yet.", no error message, and no exception. Data that Apollo retains while a query is loading or after it fails is **never** read: the current-section rule gets `invoiceExists: undefined`, and the Invoice section shows the error message (on an error) or nothing (while loading), never the retained invoice or "No invoice yet."
- **Sections:** each is a `section` with `id="laundry-order-<section>"`, `scroll-mt-6`, an `h2` with `text-base font-semibold text-slate-900`, and a body with `mt-3`. Contents (owner decision 1):
  - **Overview:** the lines, when `lines.nodes` is non-empty; otherwise "No lines yet. Lines are added when the order is priced." The summary facts are not repeated. Each line shows "Base service" (`serviceId` set) or "Add-on", its unit label, its quantity per §8.4.4 (`PER_KG`: weight via `formatWeightGrams`; `PER_ITEM`: item count; `FLAT` / `PER_SERVICE`: none), its amount, and "Minimum charge applied" when `minimumChargeApplied` is true. No line name until #159's line-label API exists.
  - **Weighing:** "Recorded weight" and the weight, or "Not weighed yet."
  - **Services:** "Services are priced. The lines are listed under Overview." when lines exist, otherwise "No services selected yet."
  - **Price:** "Order total" and the total, or "Not priced yet."
  - **Invoice:** the invoice number, total and payment status label; "No invoice yet." when the query returns none; "Unable to load the invoice." on a query error; nothing while it loads.
  - **Actions:** "Available to your role:" and a list of the offered lifecycle verbs' labels (`t('actions.<verb>')`), excluding `weigh`, `price` and `generateInvoice`, which belong to other sections; "No further actions for this order." when there are none; nothing while the role loads.
- **SHALL NOT** render any `button`, form, input or mutation hook on this page. A verb is named as text, never offered as a control (#156 §Role and lifecycle). Copy never says a section is "not on this page yet".
- **SHALL NOT** present `createdAt` or `updatedAt` as an event history (§8.2). This page shows neither.
- **Loading:** whenever the order query is loading, `LoadingState` under the back link, with no header, summary, nav or sections, **even if Apollo retains an earlier order's data** (decision for M5 review 2: retained order data is hidden while loading). **Not found / error:** `ErrorState` "Unable to load laundry order." under the back link, also when an error arrives with retained order data. The order is rendered only from a finished, successful query.
- **SHALL NOT** add a nav item. `findActiveHref('/app/laundry/<id>')` already returns `/app/laundry` (segment match), so the sidebar keeps Laundry active, `canViewPath` gates the page like the list, and the document title is the Laundry title.
- **SHALL** put every new user-facing string in `packages/web/src/i18n/messages/en/laundry.ts` under `order`, and read it with `useClensyTranslations('laundry')`.
- **SHALL NOT** modify `@clensy/ui`, `apps/api/**`, any migration, `docs/workflows/**`, or any `package.json` or lockfile. `@clensy/web` does not import `@clensy/client`.
- **Redirect helper only.** `laundryDetailRedirectHref` is implemented and tested here, and **not** wired into the list. #161 wires it at cutover (#156 §Acceptance criteria: "The `?detail=` redirect is implemented at cutover").

## Review Focus

Conditions a person will meet. Each has a test in the owning task.

1. **An id that cannot be an order.** `/app/laundry/abc` sends no request and shows the error state with the back link. → Task 2 (`isUuid`), Task 3 (`shows the error state and sends no request for an id that is not a UUID`).
2. **An order with no lines or price yet.** No line list, em dashes for weight and total, no fake zero. → Task 3 (`shows em dashes and no line list for a received order`).
3. **More than 100 lines.** A warning, not a silently short list. → Task 1 (limit), Task 3 (`warns when more lines exist than were loaded`).
4. **A role that can only look.** ANALYST sees the page, no controls, no current section, and "No further actions for this order." → Task 3 (`marks no section and names no action for ANALYST`).
5. **Re-weigh versus next step.** A `WEIGHED` order marks Services, not Weighing (owner decision 2). → Task 2 (`currentLaundryOrderSection` table), Task 3 (`marks the next step forward as current`).
6. **The payment branch and terminal statuses.** `AWAITING_PAYMENT` is current in the Paid slot; `CANCELLED` replaces the steps with its sentence. → Task 3 (`renders the shared progress …` tests). The step logic itself is pinned by #157's `laundry-progress-steps` tests.
7. **Invoice already generated.** A `PRICED` order whose invoice exists marks Actions, not Invoice. → Task 2 table, Task 3 (`shows the invoice and marks Actions once an invoice exists`).
8. **Section-nav clicks and Back.** The section links are native in-page anchors, so each click adds a history entry, as any in-page link does. Back from the page without such clicks returns to the list. This is a planning choice, flagged for M5: avoiding the extra entries needs a scripted scroll that replaces the URL, which #156 does not ask for.
9. **Retained invoice data (M5 review 1).** Apollo can keep earlier `data` while a query reloads or after it fails. With retained "no invoice" data and an error, the nav must not mark Invoice, and the Invoice section must show the error, not "No invoice yet." → Task 2 (`resolvedQueryData`), Task 3 (`ignores retained invoice data while the invoice query has failed`, `ignores retained invoice data while the invoice query reloads`).
10. **Retained order data (M5 review 2).** Apollo can keep an earlier order's data while the order query loads or after it fails. The page shows the loading state, or the error state, and never the retained order's header or sections. → Task 3 (`shows the loading state, not a retained order, while the order query loads`, `shows the error state, not a retained order, when the order query fails`).
11. **Incomplete invoice result (M5 review 3).** A finished, error-free invoice result with no data or without the `invoices` connection is not proof that no invoice exists. The nav must not mark Invoice, the section must not say "No invoice yet.", and the page must not throw. → Task 2 (`resolvedInvoiceNodes`), Task 3 (`treats a finished invoice result with no data as unresolved`, `treats a finished invoice result without the invoice connection as unresolved`).

## Planning spikes

Read-only checks run at planning time, for M5. They are not pre-validation of any task.

- **Baseline suites at `55a84a7`:** `pnpm --filter web test` → 32 files, 752 tests passed. `pnpm --filter @clensy/web test` → 15 files, 411 tests passed. `pnpm --filter @clensy/client test` → 10 tests passed.
- **Codegen is offline and reproducible:** `pnpm --filter @clensy/client codegen` at `55a84a7` reads `apps/api/src/schema.gql` and produced no diff. With `lines {` changed to `lines(paging: { limit: 100 }) {` in `laundry.graphql`, codegen changed exactly one line of `src/generated/graphql.ts` (the fragment text). Both files were restored.
- **Argument printing:** a throwaway `packages/client` test visited the `lines` field of `LaundryOrderDocument` and printed its arguments: `""` today, and `paging: { limit: 100 }` for a parsed document with that argument (`graphql` 17 `print`). Task 1's test compares against that exact string. The file was deleted.
- **`next/link` and `useParams` under the node static harness:** a throwaway `apps/web/lib` test, with `next/navigation` mocked to return `useParams: () => ({ id: 'abc' })`, rendered `<Link href="/app/laundry">` through `renderToStaticMarkup` and passed. The file was deleted.
- **Next 16 dynamic segments:** `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/dynamic-routes.md`: a client page reads params with `use(params)` or `useParams`. The page uses `useParams`, which renders synchronously under `renderToStaticMarkup`; `use(params)` would suspend on the promise.
- **API read behavior:** `LaundryOrderResolver.laundryOrder` is a hand-written nullable `@Query` guarded by `VIEW_ROLES` (TENANT_OWNER, OPS_MANAGER, SCHEDULER, CUSTOMER_SUPPORT, FINANCE, ANALYST). A missing or cross-tenant order returns `null`. `invoices` (`InvoiceForOrder`) uses the same six roles, so every viewer can run both queries.
- **Lines connection:** `LaundryOrder.lines(paging: OffsetPaging! = { limit: 20 })`, sorted `createdAt ASC, id ASC`, `maxResultsSize: PLATFORM_PAGE_MAX` (100).
- **Nav matching:** `findActiveHref` keeps the longest nav href whose segment matches, so `/app/laundry/<id>` → `/app/laundry`. `pageTitleKey` and `canViewPath` use the same match.
- **`resolvedInvoiceNodes` typing (M5 review 3 spike):** a throwaway `apps/web/lib` module held the Task 2 helper and called it with the real `useInvoiceForOrderQuery` result. `pnpm exec tsc --noEmit` reported no error for it, `invoices?.[0]?.invoiceNumber` typed as `string`, and `eslint` on the file was clean (no unnecessary-condition complaint about the runtime checks). The file was deleted.
- **i18n:** `useClensyTranslations`' `t()` has no interpolation, so no copy contains a count or name placeholder.

## File map

| File | Change | Responsibility |
| --- | --- | --- |
| `packages/client/src/operations/laundry.graphql` | Modify | `lines(paging: { limit: 100 })` in `LaundryOrderDetail`. |
| `packages/client/src/generated/graphql.ts` | Regenerate | Codegen output. |
| `packages/client/src/laundry-operations.test.ts` | Create | Pins the lines page size on the detail query. |
| `apps/web/lib/laundry-order-list-query.ts` | Modify | Export `isUuid`. |
| `apps/web/lib/laundry-order-page.ts` | Create | Section list, ids, order URL, redirect target, current section, lifecycle verbs, line quantity. |
| `apps/web/lib/laundry-order-page.test.ts` | Create | Helper tests (node). |
| `packages/web/src/i18n/messages/en/laundry.ts` | Modify | `order.*` copy. |
| `apps/web/app/app/laundry/[id]/page.tsx` | Create | The order page. |
| `apps/web/lib/laundry-order-page.render.test.tsx` | Create | Static render tests of the page. |

## Traceability

| Requirement | Source | Task |
| --- | --- | --- |
| `/app/laundry/<id>` loads that order without the list table | §8.4.4; #156 AC1 | 3 |
| Direct URL works on refresh | #156 AC6 | 3 (client page reads `useParams`; no list state), 4 (manual) |
| Back link to the list; Browser Back returns to the list | §8.4.4; #156 AC3 | 3, 4 (manual) |
| Header: customer, id, fulfillment, status (human label) | §8.4.4, §4.9; #156 AC4 | 3 |
| Progress with payment branch and terminal statuses | §8.4.4; #156 AC5 | 3 (wiring); #157 tests (step logic) |
| Summary grid, em dashes | #156 §Page structure 4, §States | 3 |
| Section nav, current section | #156 §Page structure 5; owner decision 2 | 2, 3 |
| Unresolved or incomplete invoice result never decides the nav or the Invoice body | Global Constraints (Invoice result); M5 reviews 1 and 3 | 2, 3 |
| Sections and their read-only facts | §8.4.4; #156 §Page structure 6; owner decision 1 | 2, 3 |
| Lines complete up to 100, warning beyond | #156 §Overview | 1, 3 |
| Line quantity per unit | §8.4.4 services bullet | 2, 3 |
| Actions = matrix ∩ fulfillment ∩ role, as text | §8.4.4 actions bullet, §4.4; #156 §Role and lifecycle | 2, 3 |
| Not-found / error / loading states, including retained order data | #156 §States, §Tests; M5 review 2 | 3 |
| Sidebar still highlights Laundry; no second nav item | #156 AC7 | existing `nav-groups.test.ts` segment-match tests (re-run in 4), 4 (manual) |
| Redirect helper: `detail` becomes the path id and is removed | §8.4.4 fourth bullet; #156 §Tests | 2 (helper only) |
| No `DetailDrawer` markup on the page | #156 §Tests | 3 |

## Deferred (not in this plan)

- **Wiring the `?detail=` redirect into the list, row clicks to this route, post-create navigation to this route, and deleting the laundry drawer:** #161 (#156 §Integration boundary and AC2). `laundryDetailRedirectHref` and `laundryOrderHref` are ready for it.
- **Weighing form, service picker, price preview and confirm, invoice generation, lifecycle buttons:** #155, #158, #162, #166, #165. Each replaces its section's read-only body in its own PR.
- **Line names:** #159 (line-label API), then the Overview line list shows the frozen `description`.
- **Deleting `DetailDrawer` from `@clensy/ui`, and a breadcrumb component:** out of scope (#156).
- **Section links without extra history entries:** see Review Focus 8. Not planned unless M5 asks for it.

## Revision 2 (M5 review 1)

| Finding | Resolution |
| --- | --- |
| **P2: invoice-query errors can leave the current section based on stale data.** `invoiceExists` was derived from `invoiceQuery.data` alone, so data Apollo retains while the query reloads or after it fails could decide the nav while the Invoice section showed an error. | New pure helper `resolvedQueryData` (Task 2) returns a query's data only when it is not loading and has no error. The page derives `invoices` once through it (Task 3, Step 4), and both the current-section input (`invoiceExists`) and the Invoice body (`resolved`) read that one value, so they cannot disagree. A new Global Constraint (Invoice result) states the rule. Regression tests: four `resolvedQueryData` cases in Task 2, including data retained while loading and after an error; and two render tests in Task 3, where the mock retains "no invoice" data while the query has failed, or reloads, and the page must mark Actions, not Invoice, and must not say "No invoice yet." Review Focus 9 records it. The same rule also covers the loading case, where the Invoice body previously would have shown retained data. |

## Revision 3 (M5 review 2)

| Finding | Resolution |
| --- | --- |
| **P2: the loading state could be bypassed when Apollo retains order data.** The check was `validId && orderQuery.loading && !orderQuery.data`, so a load with retained data fell through and rendered the earlier order. | Decision: retained order data is **hidden** while loading, as the loading constraint already required. The check is now `validId && orderQuery.loading` (Task 3, Step 4); the error and not-found checks after it are unchanged, so an error with retained data also shows the error state. The Global Constraints Loading bullet now says so explicitly. The render-test mock can retain order data (`orderRetained`), and two regression tests pin it: loading with a retained order shows the back link and `LoadingState` with no heading, customer name, summary, nav or sections; an error with a retained order shows the error state with none of them. Review Focus 10 records it. The invoice finding from review 1 is confirmed resolved and is unchanged. |

## Revision 4 (M5 review 3)

| Finding | Resolution |
| --- | --- |
| **P2: invoice absence is inferred from an incomplete result.** Only a confirmed, successful result with the invoice connection and an empty node list may show "No invoice yet." or let the nav pass over Invoice as resolved; the plan did not pin that. | Confirmed, and worse than the review assumed: revision 3's `resolvedQueryData(invoiceQuery)?.invoices.nodes` had no optional step before `.nodes`, so a finished result without the `invoices` connection would have **thrown**, not stayed unresolved. New pure helper `resolvedInvoiceNodes` (Task 2) returns the node array only from a finished, error-free result whose `invoices.nodes` is an array, and `undefined` otherwise (no data, `invoices` missing or `null`, `nodes` missing or `null`, loading, error). The page derives `invoices` through it (Task 3, Step 4); nav and Invoice body still read that one value. The Global Constraints bullet "Invoice result" states the rule. Regression tests: seven `resolvedInvoiceNodes` cases in Task 2 (eight after the M5 acceptance added `nodes: null`), and two render tests in Task 3 (`invoiceShape: 'noData'` and `'noConnection'`), each asserting a `PRICED` order seen by TENANT_OWNER marks Actions, not Invoice, and shows neither "No invoice yet." nor the error message. The schema makes `invoices` non-null, so this guards a contract break rather than a normal response. Review Focus 11 records it. |

---

### Task 1: Request up to 100 lines on the detail query

**Traces to:** #156 §Overview ("request `paging: { limit: 100 }` on the lines connection in the detail query").

**Files:**
- Create: `packages/client/src/laundry-operations.test.ts`
- Modify: `packages/client/src/operations/laundry.graphql`
- Regenerate: `packages/client/src/generated/graphql.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/client/src/laundry-operations.test.ts`:

```ts
import { print, visit, type DocumentNode } from 'graphql';
import { describe, expect, it } from 'vitest';
import { LaundryOrderDocument } from './generated/graphql';

// The arguments of every `lines` field in a document, printed.
function linesArguments(document: DocumentNode): string[] {
  const found: string[] = [];
  visit(document, {
    Field(node) {
      if (node.name.value === 'lines') {
        found.push((node.arguments ?? []).map((argument) => print(argument)).join(', '));
      }
    },
  });
  return found;
}

describe('laundry operations', () => {
  // A laundry order is one base service plus its add-ons. The server's
  // nested default page is 20 and its maximum is PLATFORM_PAGE_MAX (100),
  // so the order page asks for 100 and warns past that (#156).
  it('requests up to 100 lines on the order detail query', () => {
    expect(linesArguments(LaundryOrderDocument)).toEqual(['paging: { limit: 100 }']);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @clensy/client test -- laundry-operations`
Expected: FAIL. `expected [ '' ] to deeply equal [ 'paging: { limit: 100 }' ]`.

- [ ] **Step 3: Change the fragment**

In `packages/client/src/operations/laundry.graphql`, inside `fragment LaundryOrderDetail on LaundryOrder`, replace:

```graphql
  ...LaundryOrderRow
  lines {
```

with:

```graphql
  ...LaundryOrderRow
  lines(paging: { limit: 100 }) {
```

- [ ] **Step 4: Regenerate the client**

Run: `pnpm --filter @clensy/client codegen`
Expected: "Generate outputs" succeeds. `git diff --stat packages/client/src/generated/graphql.ts` shows exactly one line changed (the fragment text).

- [ ] **Step 5: Run the client checks**

Run: `pnpm --filter @clensy/client test && pnpm --filter @clensy/client build && pnpm --filter @clensy/client lint`
Expected: all pass; the new test passes (11 tests in total).

- [ ] **Step 6: Commit**

```bash
git status --short
git add packages/client/src/laundry-operations.test.ts packages/client/src/operations/laundry.graphql packages/client/src/generated/graphql.ts
git commit -m "feat(client): load up to 100 lines on the laundry order detail (#156)"
```

---

### Task 2: Order-page helpers

**Traces to:** §8.4.4 (services bullet, actions bullet, `?detail=` bullet); #156 §Page structure 5, §Tests ("Redirect helper"); owner decisions 1 and 2.

**Files:**
- Modify: `apps/web/lib/laundry-order-list-query.ts`
- Create: `apps/web/lib/laundry-order-page.ts`
- Create: `apps/web/lib/laundry-order-page.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/web/lib/laundry-order-page.test.ts`:

```ts
import { laundryOrderActions, type AdminRole, type LaundryOrderStatus } from '@clensy/web';
import { describe, expect, it } from 'vitest';
import { isUuid } from './laundry-order-list-query';
import {
  LAUNDRY_ORDER_SECTIONS,
  currentLaundryOrderSection,
  laundryDetailRedirectHref,
  laundryLifecycleVerbs,
  laundryLineQuantity,
  laundryOrderHref,
  laundryOrderSectionId,
  resolvedInvoiceNodes,
  resolvedQueryData,
} from './laundry-order-page';

const ID = '3f2a9c1e-0b7d-4e55-9a10-6c2b8d4e7f01';

describe('isUuid', () => {
  it.each([
    [ID, true],
    [ID.toUpperCase(), true],
    ['abc', false],
    ['', false],
    [`${ID} `, false],
    [`${ID}0`, false],
  ])('%j → %s', (text, expected) => {
    expect(isUuid(text)).toBe(expected);
  });
});

describe('laundry order sections', () => {
  it('lists the six sections in page order', () => {
    expect(LAUNDRY_ORDER_SECTIONS).toEqual(['overview', 'weighing', 'services', 'price', 'invoice', 'actions']);
  });

  it('gives each section a stable element id', () => {
    expect(laundryOrderSectionId('weighing')).toBe('laundry-order-weighing');
  });
});

describe('laundryOrderHref', () => {
  it('puts the id in the path', () => {
    expect(laundryOrderHref(ID)).toBe(`/app/laundry/${ID}`);
  });

  it('encodes the id as one path segment', () => {
    expect(laundryOrderHref('a/b?c')).toBe('/app/laundry/a%2Fb%3Fc');
  });
});

describe('laundryDetailRedirectHref', () => {
  it.each([
    ['', null],
    ['status=PAID', null],
    [`detail=${ID}`, `/app/laundry/${ID}`],
    [`?detail=${ID}`, `/app/laundry/${ID}`],
    [`status=PAID&detail=${ID}&sortBy=CREATED_AT`, `/app/laundry/${ID}`],
    ['detail=', '/app/laundry'],
    ['detail=not-an-id', '/app/laundry'],
    ['status=PAID&detail=not-an-id&search=ana', '/app/laundry?status=PAID&search=ana'],
  ])('%j → %j', (search, expected) => {
    expect(laundryDetailRedirectHref(search)).toBe(expected);
  });

  it('accepts URLSearchParams', () => {
    expect(laundryDetailRedirectHref(new URLSearchParams({ detail: ID }))).toBe(`/app/laundry/${ID}`);
  });
});

describe('currentLaundryOrderSection', () => {
  function current(
    status: LaundryOrderStatus,
    role: AdminRole | undefined,
    invoiceExists: boolean | undefined = false,
  ) {
    return currentLaundryOrderSection({
      invoiceExists,
      status,
      verbs: laundryOrderActions(status, 'PICKUP', role),
    });
  }

  it.each<[LaundryOrderStatus, AdminRole | undefined, boolean | undefined, string | null]>([
    ['RECEIVED', 'OPS_MANAGER', false, 'weighing'],
    ['RECEIVED', 'CUSTOMER_SUPPORT', false, 'actions'],
    ['RECEIVED', 'ANALYST', false, null],
    ['RECEIVED', undefined, false, null],
    // Re-weighing a WEIGHED order is a correction; the next step is services.
    ['WEIGHED', 'OPS_MANAGER', false, 'services'],
    ['WEIGHED', 'FINANCE', false, null],
    ['PRICED', 'TENANT_OWNER', false, 'invoice'],
    ['PRICED', 'TENANT_OWNER', true, 'actions'],
    ['PRICED', 'TENANT_OWNER', undefined, 'actions'],
    ['PRICED', 'SCHEDULER', false, null],
    ['PAID', 'SCHEDULER', true, 'actions'],
    ['COMPLETED', 'FINANCE', false, 'invoice'],
    ['COMPLETED', 'ANALYST', false, null],
    ['CANCELLED', 'TENANT_OWNER', false, null],
  ])('%s as %s, invoice exists %s → %s', (status, role, invoiceExists, expected) => {
    expect(current(status, role, invoiceExists)).toBe(expected);
  });
});

describe('resolvedQueryData', () => {
  const data = { invoices: { nodes: [] } };

  it('returns the data of a finished, successful query', () => {
    expect(resolvedQueryData({ data, error: undefined, loading: false })).toBe(data);
  });

  // Apollo can keep earlier data while a query reloads or after it fails
  // (M5 review 1). That data is never treated as the answer.
  it('ignores data retained while the query loads', () => {
    expect(resolvedQueryData({ data, error: undefined, loading: true })).toBeUndefined();
  });

  it('ignores data retained after the query fails', () => {
    expect(resolvedQueryData({ data, error: new Error('network down'), loading: false })).toBeUndefined();
  });

  it('returns undefined before any data', () => {
    expect(resolvedQueryData({ data: undefined, error: undefined, loading: false })).toBeUndefined();
  });
});

describe('resolvedInvoiceNodes', () => {
  const done = { error: undefined, loading: false };

  it('returns the nodes of a finished result, empty or not', () => {
    expect(resolvedInvoiceNodes({ ...done, data: { invoices: { nodes: [] } } })).toEqual([]);
    expect(resolvedInvoiceNodes({ ...done, data: { invoices: { nodes: [{ id: 'i1' }] } } })).toEqual([{ id: 'i1' }]);
  });

  // Only a confirmed node list says whether an invoice exists (M5 review 3).
  it.each<[string, unknown]>([
    ['no data', undefined],
    ['null data', null],
    ['no invoices connection', {}],
    ['a null invoices connection', { invoices: null }],
    ['no nodes array', { invoices: {} }],
    ['null nodes', { invoices: { nodes: null } }],
  ])('treats a finished result with %s as unresolved', (_label, data) => {
    expect(resolvedInvoiceNodes({ ...done, data: data as never })).toBeUndefined();
  });

  it('treats a loading or failed query as unresolved, whatever data it retains', () => {
    const data = { invoices: { nodes: [] } };
    expect(resolvedInvoiceNodes({ data, error: undefined, loading: true })).toBeUndefined();
    expect(resolvedInvoiceNodes({ data, error: new Error('network down'), loading: false })).toBeUndefined();
  });
});

describe('laundryLifecycleVerbs', () => {
  it('drops the verbs that belong to the weighing, services and invoice sections', () => {
    expect(laundryLifecycleVerbs(['weigh', 'price', 'generateInvoice', 'markPaid', 'cancel'])).toEqual([
      'markPaid',
      'cancel',
    ]);
  });
});

describe('laundryLineQuantity', () => {
  it('shows a per-kg line as its weight', () => {
    expect(laundryLineQuantity('PER_KG', 2505)).toEqual({ kind: 'weight', value: '2.505 kg' });
  });

  it('shows a per-item line as its item count', () => {
    expect(laundryLineQuantity('PER_ITEM', 3)).toEqual({ kind: 'items', value: '3' });
  });

  it.each(['FLAT', 'PER_SERVICE'] as const)('shows no quantity for %s', (unit) => {
    expect(laundryLineQuantity(unit, 1)).toBeNull();
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `pnpm --filter web test -- laundry-order-page.test`
Expected: FAIL. The suite cannot resolve `./laundry-order-page` (so `resolvedQueryData`, `resolvedInvoiceNodes` and the other helpers are missing), and `isUuid` is not exported from `./laundry-order-list-query`.

- [ ] **Step 3: Export `isUuid`**

In `apps/web/lib/laundry-order-list-query.ts`, replace:

```ts
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

with:

```ts
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(text: string): boolean {
  return UUID.test(text);
}
```

and replace:

```ts
    if (UUID.test(state.search)) {
```

with:

```ts
    if (isUuid(state.search)) {
```

- [ ] **Step 4: Write the helpers**

Create `apps/web/lib/laundry-order-page.ts`:

```ts
import type { PricingUnit } from '@clensy/client';
import { formatWeightGrams, type LaundryOrderStatus, type LaundryOrderVerb } from '@clensy/web';
import { isUuid } from './laundry-order-list-query';

// The order page's sections, in page and nav order (#156). Later issues
// fill Weighing (#155), Services (#158), Price (#162), Invoice (#166) and
// Actions (#165).
export const LAUNDRY_ORDER_SECTIONS = ['overview', 'weighing', 'services', 'price', 'invoice', 'actions'] as const;

export type LaundryOrderSection = (typeof LAUNDRY_ORDER_SECTIONS)[number];

export function laundryOrderSectionId(section: LaundryOrderSection): string {
  return `laundry-order-${section}`;
}

export function laundryOrderHref(id: string): string {
  return `/app/laundry/${encodeURIComponent(id)}`;
}

// Where `/app/laundry?<search>` should go (lifecycle spec §8.4.4): `null`
// with no `detail` param; the order page for a UUID-shaped `detail`; and
// otherwise the list without `detail`, keeping every other list param.
// Not wired in yet: #161 replaces the drawer with this at cutover.
export function laundryDetailRedirectHref(search: string | URLSearchParams): string | null {
  const params = new URLSearchParams(search);
  if (!params.has('detail')) return null;
  const id = params.get('detail') ?? '';
  if (isUuid(id)) return laundryOrderHref(id);
  params.delete('detail');
  const rest = params.toString();
  return rest === '' ? '/app/laundry' : `/app/laundry?${rest}`;
}

// A query's data only once it has finished without an error. Apollo can
// keep earlier `data` while a query reloads or after it fails; that data is
// never the answer (M5 review 1), so the nav and the section it describes
// read the same value.
export function resolvedQueryData<T>(query: { data?: T; error?: unknown; loading: boolean }): T | undefined {
  return query.loading || query.error ? undefined : query.data;
}

// The invoice query's nodes, only from a finished, error-free result that
// carries the `invoices` connection with a `nodes` array. Anything else,
// including a result with no data or no connection, is unresolved
// (`undefined`), never "no invoice" (M5 review 3). The parameter type is
// looser than the generated result on purpose, so the checks below are
// real runtime checks and not flagged as unnecessary.
export function resolvedInvoiceNodes<T>(query: {
  data?: { invoices?: { nodes?: readonly T[] | null } | null } | null;
  error?: unknown;
  loading: boolean;
}): readonly T[] | undefined {
  const nodes = resolvedQueryData(query)?.invoices?.nodes;
  return Array.isArray(nodes) ? nodes : undefined;
}

// Verbs that the Weighing, Services and Invoice sections own. The Actions
// section names the rest.
const SECTION_VERBS: ReadonlySet<LaundryOrderVerb> = new Set<LaundryOrderVerb>(['weigh', 'price', 'generateInvoice']);

export function laundryLifecycleVerbs(verbs: readonly LaundryOrderVerb[]): LaundryOrderVerb[] {
  return verbs.filter((verb) => !SECTION_VERBS.has(verb));
}

export interface CurrentLaundryOrderSectionInput {
  // `undefined` unless `resolvedInvoiceNodes` returned a node list:
  // while loading (even with retained data), after an error, and for a
  // finished result without the invoice connection.
  invoiceExists: boolean | undefined;
  status: LaundryOrderStatus;
  // `laundryOrderActions(status, fulfillmentType, role)`.
  verbs: readonly LaundryOrderVerb[];
}

// The section the nav marks current: the next step forward the actor may
// take (owner decision, #156 M4). Re-weighing a WEIGHED order is a
// correction, so Weighing is current only while RECEIVED. Pricing starts
// with choosing services, so `price` marks Services. Overview and Price are
// never current. `null` when the actor has nothing to do.
export function currentLaundryOrderSection({
  invoiceExists,
  status,
  verbs,
}: CurrentLaundryOrderSectionInput): LaundryOrderSection | null {
  if (status === 'RECEIVED' && verbs.includes('weigh')) return 'weighing';
  if (verbs.includes('price')) return 'services';
  if (invoiceExists === false && verbs.includes('generateInvoice')) return 'invoice';
  if (laundryLifecycleVerbs(verbs).length > 0) return 'actions';
  return null;
}

export type LaundryLineQuantity = { kind: 'items' | 'weight'; value: string } | null;

// Lifecycle spec §8.4.4: a PER_KG line shows weight, a PER_ITEM line an
// item count, FLAT and PER_SERVICE no quantity. A PER_KG snapshot stores
// grams (§3).
export function laundryLineQuantity(unit: PricingUnit, quantity: number): LaundryLineQuantity {
  if (unit === 'PER_KG') return { kind: 'weight', value: formatWeightGrams(quantity) };
  if (unit === 'PER_ITEM') return { kind: 'items', value: String(quantity) };
  return null;
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter web test -- laundry-order-page.test laundry-order-list-query`
Expected: PASS. The new file's tests all pass, and `laundry-order-list-query.test.ts` is unchanged and still passes.

- [ ] **Step 6: Commit**

```bash
git status --short
git add apps/web/lib/laundry-order-list-query.ts apps/web/lib/laundry-order-page.ts apps/web/lib/laundry-order-page.test.ts
git commit -m "feat(web): laundry order page helpers (#156)"
```

---

### Task 3: The order page

**Traces to:** §8.4.4 third bullet, services and actions bullets; §8.2; §4.9; #156 §Route, §Page structure, §States, §Role and lifecycle, §Accessibility, §Tests; owner decisions 1 and 2.

**Files:**
- Modify: `packages/web/src/i18n/messages/en/laundry.ts`
- Create: `apps/web/lib/laundry-order-page.render.test.tsx`
- Create: `apps/web/app/app/laundry/[id]/page.tsx`

- [ ] **Step 1: Add the copy**

In `packages/web/src/i18n/messages/en/laundry.ts`, replace:

```ts
  noActions: 'No further actions for this order.',
```

with:

```ts
  noActions: 'No further actions for this order.',
  order: {
    actions: {
      available: 'Available to your role:',
    },
    back: 'Back to laundry orders',
    invoice: {
      error: 'Unable to load the invoice.',
      none: 'No invoice yet.',
      number: 'Invoice number',
      paymentStatus: 'Payment status',
      total: 'Invoice total',
    },
    lines: {
      addOn: 'Add-on',
      amount: 'Amount',
      items: 'Items',
      minimumCharge: 'Minimum charge applied',
      more: 'More lines are not loaded.',
      service: 'Base service',
      unit: 'Unit',
      weight: 'Weight',
    },
    overview: {
      noLines: 'No lines yet. Lines are added when the order is priced.',
    },
    price: {
      notPriced: 'Not priced yet.',
      total: 'Order total',
    },
    sections: {
      actions: 'Actions',
      invoice: 'Invoice',
      overview: 'Overview',
      price: 'Price',
      services: 'Services',
      weighing: 'Weighing',
    },
    sectionsLabel: 'Order sections',
    services: {
      none: 'No services selected yet.',
      priced: 'Services are priced. The lines are listed under Overview.',
    },
    summary: {
      customer: 'Customer',
      fulfillment: 'Fulfillment',
      total: 'Total',
      weight: 'Weight',
    },
    unit: {
      FLAT: 'Flat',
      PER_ITEM: 'Per item',
      PER_KG: 'Per kg',
      PER_SERVICE: 'Per service',
    },
    weighing: {
      notWeighed: 'Not weighed yet.',
      recorded: 'Recorded weight',
    },
  },
```

Run: `pnpm --filter @clensy/web test && pnpm --filter @clensy/web build`
Expected: PASS (copy only; 411 tests).

- [ ] **Step 2: Write the failing render tests**

Create `apps/web/lib/laundry-order-page.render.test.tsx`:

```tsx
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The `/app/laundry/[id]` order page (#156), rendered statically.
const ID = '3f2a9c1e-0b7d-4e55-9a10-6c2b8d4e7f01';

type Line = {
  addOnId: string | null;
  createdAt: string;
  id: string;
  pricingSnapshot: {
    amountMinorUnits: number;
    minimumChargeApplied: boolean;
    minimumChargeMinorUnits: number | null;
    pricingRuleId: string | null;
    quantity: number;
    rateMinorUnits: number;
    unit: 'FLAT' | 'PER_ITEM' | 'PER_KG' | 'PER_SERVICE';
  };
  serviceId: string | null;
};

function line(id: string, unit: Line['pricingSnapshot']['unit'], quantity: number, amount: number, extra: Partial<Line> = {}): Line {
  return {
    addOnId: null,
    createdAt: '2026-10-01T09:00:00.000Z',
    id,
    pricingSnapshot: {
      amountMinorUnits: amount,
      minimumChargeApplied: false,
      minimumChargeMinorUnits: null,
      pricingRuleId: null,
      quantity,
      rateMinorUnits: 0,
      unit,
    },
    serviceId: 's1',
    ...extra,
  };
}

function order(overrides: Record<string, unknown> = {}) {
  return {
    createdAt: '2026-10-01T09:00:00.000Z',
    customer: { fullName: 'Ana Reyes', id: 'c1' },
    fulfillmentType: 'DELIVERY',
    id: ID,
    lines: { nodes: [] as Line[], pageInfo: { hasNextPage: false } },
    status: 'AWAITING_PAYMENT',
    totalMinorUnits: 45000,
    weightGrams: 2505,
    ...overrides,
  };
}

const page = vi.hoisted(() => ({
  id: '',
  invoiceError: undefined as Error | undefined,
  invoiceLoading: false,
  invoiceNodes: [] as unknown[],
  invoiceOptions: [] as Array<{ skip?: boolean; variables?: unknown }>,
  // Apollo keeps earlier data while a query reloads or after it fails.
  invoiceRetained: false,
  // A finished result that lacks data or the invoice connection (M5 review 3).
  invoiceShape: 'nodes' as 'noConnection' | 'noData' | 'nodes',
  order: undefined as unknown,
  orderError: undefined as Error | undefined,
  orderLoading: false,
  orderOptions: [] as Array<{ fetchPolicy?: string; skip?: boolean; variables?: unknown }>,
  // Apollo keeps an earlier order's data while the query reloads or after it fails.
  orderRetained: false,
  role: 'TENANT_OWNER' as string | undefined,
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: page.id }),
  usePathname: () => `/app/laundry/${page.id}`,
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('@clensy/client', () => ({
  useCurrentAdminQuery: () => ({
    data: page.role === undefined ? undefined : { currentAdmin: { role: page.role } },
  }),
  useInvoiceForOrderQuery: (options: { skip?: boolean; variables?: unknown }) => {
    page.invoiceOptions.push(options);
    if (page.invoiceShape !== 'nodes') {
      return { data: page.invoiceShape === 'noData' ? undefined : {}, error: undefined, loading: false };
    }
    return {
      data:
        page.invoiceRetained || (!page.invoiceLoading && !page.invoiceError)
          ? { invoices: { nodes: page.invoiceNodes } }
          : undefined,
      error: page.invoiceError,
      loading: page.invoiceLoading,
    };
  },
  useLaundryOrderQuery: (options: { fetchPolicy?: string; skip?: boolean; variables?: unknown }) => {
    page.orderOptions.push(options);
    if (options.skip) return { data: undefined, error: undefined, loading: false };
    return {
      data:
        page.orderRetained || (!page.orderLoading && !page.orderError) ? { laundryOrder: page.order } : undefined,
      error: page.orderError,
      loading: page.orderLoading,
    };
  },
}));

async function renderPage(): Promise<string> {
  const { default: LaundryOrderPage } = await import('../app/app/laundry/[id]/page');
  return renderToStaticMarkup(<LaundryOrderPage />);
}

function count(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

// The markup of one section, from its opening tag to the next section.
function section(html: string, name: string): string {
  const start = html.indexOf(`id="laundry-order-${name}"`);
  expect(start).toBeGreaterThan(-1);
  const end = html.indexOf('<section', start);
  return html.slice(start, end === -1 ? undefined : end);
}

const BACK_LINK = 'href="/app/laundry"';

beforeEach(() => {
  page.id = ID;
  page.invoiceError = undefined;
  page.invoiceLoading = false;
  page.invoiceNodes = [];
  page.invoiceOptions.length = 0;
  page.invoiceRetained = false;
  page.invoiceShape = 'nodes';
  page.order = order();
  page.orderError = undefined;
  page.orderLoading = false;
  page.orderOptions.length = 0;
  page.orderRetained = false;
  page.role = 'TENANT_OWNER';
});

describe('laundry order page', () => {
  it('loads the order from the URL id, network-only, and its invoice', async () => {
    await renderPage();
    expect(page.orderOptions[0]).toMatchObject({ fetchPolicy: 'network-only', skip: false, variables: { id: ID } });
    expect(page.invoiceOptions[0]).toMatchObject({ skip: false, variables: { laundryOrderId: ID } });
  });

  it('renders the header, back link and no list, drawer or controls', async () => {
    const html = await renderPage();
    expect(count(html, '<h1')).toBe(1);
    expect(html).toMatch(/<h1[^>]*>Ana Reyes<\/h1>/);
    expect(html).toContain(ID);
    expect(html).toContain('Awaiting payment');
    expect(html).not.toContain('>AWAITING_PAYMENT<');
    expect(html).toContain('Delivery');
    expect(html).toMatch(/<a[^>]*class="text-sm text-slate-600 underline"[^>]*href="\/app\/laundry"|<a[^>]*href="\/app\/laundry"[^>]*class="text-sm text-slate-600 underline"/);
    expect(html).toContain('Back to laundry orders');
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain('<table');
    expect(html).not.toContain('<button');
    expect(html).not.toContain('<form');
    expect(html).not.toContain('<input');
  });

  it('renders the summary as a responsive definition list', async () => {
    const html = await renderPage();
    expect(html).toContain('<dl class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">');
    expect(count(html, 'class="rounded-md border border-slate-200 p-3"')).toBeGreaterThanOrEqual(4);
    for (const term of ['Customer', 'Fulfillment', 'Weight', 'Total']) {
      expect(html).toContain(`>${term}</dt>`);
    }
    expect(html).toContain('2.505 kg');
    expect(html).toContain('₱450.00');
  });

  it('renders the section nav and six sections in order', async () => {
    const html = await renderPage();
    expect(html).toContain('<nav aria-label="Order sections">');
    expect(html).toContain('<ul class="flex gap-3 overflow-x-auto">');
    const names = ['overview', 'weighing', 'services', 'price', 'invoice', 'actions'];
    const positions = names.map((name) => html.indexOf(`href="#laundry-order-${name}"`));
    expect(positions.every((position) => position > -1)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(count(html, '<h2')).toBe(6);
    for (const heading of ['Overview', 'Weighing', 'Services', 'Price', 'Invoice', 'Actions']) {
      expect(html).toContain(`<h2 class="text-base font-semibold text-slate-900">${heading}</h2>`);
    }
    expect(count(html, 'class="scroll-mt-6"')).toBe(6);
  });

  it('shows em dashes and no line list for a received order', async () => {
    page.order = order({ status: 'RECEIVED', totalMinorUnits: null, weightGrams: null });
    const html = await renderPage();
    expect(count(html, '>—</dd>')).toBe(2);
    expect(html).not.toContain('₱0.00');
    expect(section(html, 'overview')).toContain('No lines yet. Lines are added when the order is priced.');
    expect(section(html, 'overview')).not.toContain('<li');
    expect(section(html, 'weighing')).toContain('Not weighed yet.');
    expect(section(html, 'services')).toContain('No services selected yet.');
    expect(section(html, 'price')).toContain('Not priced yet.');
  });

  it('shows the recorded weight, the total and the lines once priced', async () => {
    page.order = order({
      lines: {
        nodes: [
          line('l1', 'PER_KG', 2505, 30000, { pricingSnapshot: { ...line('x', 'PER_KG', 2505, 30000).pricingSnapshot, minimumChargeApplied: true } }),
          line('l2', 'PER_ITEM', 3, 9000, { addOnId: 'a1', serviceId: null }),
          line('l3', 'FLAT', 1, 6000, { addOnId: 'a2', serviceId: null }),
        ],
        pageInfo: { hasNextPage: false },
      },
      status: 'PRICED',
    });
    const html = await renderPage();
    const overview = section(html, 'overview');
    expect(count(overview, '<li')).toBe(3);
    expect(overview).toContain('Base service');
    expect(count(overview, '>Add-on<')).toBe(2);
    expect(overview).toContain('Per kg');
    expect(overview).toContain('>Weight</dt>');
    expect(overview).toContain('2.505 kg');
    expect(overview).toContain('Per item');
    expect(overview).toContain('>Items</dt>');
    expect(overview).toContain('>3</dd>');
    expect(overview).toContain('Flat');
    expect(count(overview, '>Weight</dt>') + count(overview, '>Items</dt>')).toBe(2);
    expect(overview).toContain('₱300.00');
    expect(count(overview, 'Minimum charge applied')).toBe(1);
    expect(overview).not.toContain('More lines are not loaded.');
    expect(section(html, 'weighing')).toContain('Recorded weight');
    expect(section(html, 'weighing')).toContain('2.505 kg');
    expect(section(html, 'services')).toContain('Services are priced. The lines are listed under Overview.');
    expect(section(html, 'price')).toContain('Order total');
    expect(section(html, 'price')).toContain('₱450.00');
  });

  it('warns when more lines exist than were loaded', async () => {
    page.order = order({ lines: { nodes: [line('l1', 'FLAT', 1, 100)], pageInfo: { hasNextPage: true } } });
    const html = await renderPage();
    expect(section(html, 'overview')).toContain('More lines are not loaded.');
  });

  it.each([
    ['RECEIVED', 'OPS_MANAGER', 'weighing'],
    ['WEIGHED', 'OPS_MANAGER', 'services'],
    ['PRICED', 'TENANT_OWNER', 'invoice'],
    ['PAID', 'SCHEDULER', 'actions'],
  ])('marks the next step forward as current: %s as %s → %s', async (status, role, current) => {
    page.order = order({ status });
    page.role = role;
    const html = await renderPage();
    expect(count(html, 'aria-current="true"')).toBe(1);
    expect(html).toMatch(new RegExp(`<a[^>]*href="#laundry-order-${current}"[^>]*aria-current="true"|<a[^>]*aria-current="true"[^>]*href="#laundry-order-${current}"`));
    expect(html).toMatch(new RegExp(`<a[^>]*href="#laundry-order-${current}"[^>]*class="[^"]*font-medium text-slate-900|<a[^>]*class="[^"]*font-medium text-slate-900[^"]*"[^>]*href="#laundry-order-${current}"`));
    expect(count(html, 'text-slate-600 whitespace-nowrap') + count(html, 'whitespace-nowrap text-slate-600')).toBe(5);
  });

  it('marks no section and names no action for ANALYST', async () => {
    page.role = 'ANALYST';
    const html = await renderPage();
    expect(html).not.toContain('aria-current="true"');
    expect(section(html, 'actions')).toContain('No further actions for this order.');
    expect(html).not.toContain('<button');
  });

  it('names the role-allowed lifecycle actions as text in Actions', async () => {
    page.order = order({ status: 'PRICED' });
    page.role = 'TENANT_OWNER';
    page.invoiceNodes = [{ id: 'i1', invoiceNumber: 'INV-0001', paymentStatus: 'UNPAID', totalMinorUnits: 45000 }];
    const html = await renderPage();
    const actions = section(html, 'actions');
    expect(actions).toContain('Available to your role:');
    expect(actions).toContain('Mark awaiting payment');
    expect(actions).toContain('Mark paid');
    expect(actions).toContain('Cancel order');
    expect(actions).not.toContain('Generate invoice');
    expect(actions).not.toContain('Record weight');
    expect(actions).not.toContain('<button');
  });

  it('names nothing in Actions while the role loads', async () => {
    page.role = undefined;
    const html = await renderPage();
    const actions = section(html, 'actions');
    expect(actions).not.toContain('Available to your role:');
    expect(actions).not.toContain('No further actions for this order.');
    expect(html).not.toContain('aria-current="true"');
  });

  it('shows the invoice and marks Actions once an invoice exists', async () => {
    page.order = order({ status: 'PRICED' });
    page.invoiceNodes = [{ id: 'i1', invoiceNumber: 'INV-0001', paymentStatus: 'UNPAID', totalMinorUnits: 45000 }];
    const html = await renderPage();
    const invoice = section(html, 'invoice');
    expect(invoice).toContain('INV-0001');
    expect(invoice).toContain('₱450.00');
    expect(invoice).toContain('Unpaid');
    expect(invoice).not.toContain('>UNPAID<');
    expect(html).toMatch(/<a[^>]*href="#laundry-order-actions"[^>]*aria-current="true"|<a[^>]*aria-current="true"[^>]*href="#laundry-order-actions"/);
  });

  it('says when there is no invoice yet', async () => {
    const html = await renderPage();
    expect(section(html, 'invoice')).toContain('No invoice yet.');
  });

  it('says when the invoice cannot be loaded', async () => {
    page.invoiceError = new Error('network down');
    const html = await renderPage();
    expect(section(html, 'invoice')).toContain('Unable to load the invoice.');
    expect(section(html, 'invoice')).not.toContain('No invoice yet.');
  });

  // M5 review 1: retained "no invoice" data would mark Invoice and say
  // "No invoice yet." if it were read. It is not: the nav falls through to
  // Actions (TENANT_OWNER may mark a PRICED order paid) and the section
  // shows the error.
  it('ignores retained invoice data while the invoice query has failed', async () => {
    page.order = order({ status: 'PRICED' });
    page.invoiceNodes = [];
    page.invoiceRetained = true;
    page.invoiceError = new Error('network down');
    const html = await renderPage();
    expect(html).not.toMatch(/<a[^>]*href="#laundry-order-invoice"[^>]*aria-current="true"/);
    expect(html).toMatch(/<a[^>]*href="#laundry-order-actions"[^>]*aria-current="true"/);
    expect(section(html, 'invoice')).toContain('Unable to load the invoice.');
    expect(section(html, 'invoice')).not.toContain('No invoice yet.');
  });

  it('ignores retained invoice data while the invoice query reloads', async () => {
    page.order = order({ status: 'PRICED' });
    page.invoiceNodes = [];
    page.invoiceRetained = true;
    page.invoiceLoading = true;
    const html = await renderPage();
    expect(html).not.toMatch(/<a[^>]*href="#laundry-order-invoice"[^>]*aria-current="true"/);
    expect(html).toMatch(/<a[^>]*href="#laundry-order-actions"[^>]*aria-current="true"/);
    expect(section(html, 'invoice')).not.toContain('No invoice yet.');
    expect(section(html, 'invoice')).not.toContain('Unable to load the invoice.');
  });

  // M5 review 3: only a confirmed node list says whether an invoice exists.
  it.each([
    ['with no data', 'noData'],
    ['without the invoice connection', 'noConnection'],
  ] as const)('treats a finished invoice result %s as unresolved', async (_label, shape) => {
    page.order = order({ status: 'PRICED' });
    page.invoiceShape = shape;
    const html = await renderPage();
    expect(html).not.toMatch(/<a[^>]*href="#laundry-order-invoice"[^>]*aria-current="true"/);
    expect(html).toMatch(/<a[^>]*href="#laundry-order-actions"[^>]*aria-current="true"/);
    expect(section(html, 'invoice')).not.toContain('No invoice yet.');
    expect(section(html, 'invoice')).not.toContain('Unable to load the invoice.');
  });

  it('renders the shared progress with the payment branch current', async () => {
    const html = await renderPage();
    expect(html).toContain('aria-label="Order progress"');
    expect(html).toMatch(/<li aria-current="step"[^>]*>.*?Awaiting payment/);
  });

  it('renders the shared progress terminal sentence for a cancelled order', async () => {
    page.order = order({ status: 'CANCELLED', totalMinorUnits: null });
    const html = await renderPage();
    expect(html).toContain('This order was cancelled before payment.');
    expect(html).not.toContain('aria-label="Order progress"');
  });

  it('shows the loading state under the back link', async () => {
    page.orderLoading = true;
    const html = await renderPage();
    expect(html).toContain(BACK_LINK);
    expect(html).toContain('role="status"');
    expect(html).not.toContain('<h1');
  });

  // M5 review 2: an earlier order retained by Apollo is never shown while
  // the order query loads.
  it('shows the loading state, not a retained order, while the order query loads', async () => {
    page.orderRetained = true;
    page.orderLoading = true;
    const html = await renderPage();
    expect(html).toContain(BACK_LINK);
    expect(html).toContain('role="status"');
    expect(html).not.toContain('<h1');
    expect(html).not.toContain('Ana Reyes');
    expect(html).not.toContain('<nav');
    expect(html).not.toContain('<section');
    expect(html).not.toContain('<dl');
  });

  it('shows the error state, not a retained order, when the order query fails', async () => {
    page.orderRetained = true;
    page.orderError = new Error('boom');
    const html = await renderPage();
    expect(html).toContain('Unable to load laundry order.');
    expect(html).toContain(BACK_LINK);
    expect(html).not.toContain('<h1');
    expect(html).not.toContain('Ana Reyes');
    expect(html).not.toContain('<section');
  });

  it.each([
    ['a missing order', () => { page.order = null; }],
    ['a query error', () => { page.orderError = new Error('boom'); }],
  ])('shows the error state and the back link for %s', async (_label, arrange) => {
    arrange();
    const html = await renderPage();
    expect(html).toContain('Unable to load laundry order.');
    expect(html).toContain(BACK_LINK);
    expect(html).not.toContain('<h1');
  });

  it('shows the error state and sends no request for an id that is not a UUID', async () => {
    page.id = 'not-an-id';
    const html = await renderPage();
    expect(html).toContain('Unable to load laundry order.');
    expect(html).toContain(BACK_LINK);
    expect(page.orderOptions[0]).toMatchObject({ skip: true });
    expect(page.invoiceOptions[0]).toMatchObject({ skip: true });
  });
});
```

Notes for the implementer:
- Attribute order in React's static markup follows JSX prop order. The two-way regexes accept either order, so they do not depend on it. If a class assertion fails only because the page's class string differs from the plan's, change the page to match the plan's classes, not the test.
- The progress-branch regex relies on `LaundryOrderProgress`' existing markup (`<li aria-current="step" …>`), pinned by #157.

- [ ] **Step 3: Run them and watch them fail**

Run: `pnpm --filter web test -- laundry-order-page.render`
Expected: FAIL. The suite cannot resolve `../app/app/laundry/[id]/page`.

- [ ] **Step 4: Write the page**

Create `apps/web/app/app/laundry/[id]/page.tsx`:

```tsx
'use client';

import { useCurrentAdminQuery, useInvoiceForOrderQuery, useLaundryOrderQuery } from '@clensy/client';
import type { InvoiceForOrderQuery, LaundryOrderQuery } from '@clensy/client';
import { ErrorState, LoadingState, PageHeader, StatusBadge } from '@clensy/ui';
import {
  LAUNDRY_STATUS_TONE,
  LaundryOrderProgress,
  formatWeightGrams,
  laundryOrderActions,
  useClensyTranslations,
  type LaundryOrderVerb,
} from '@clensy/web';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import { formatMinorUnits } from '../../../../lib/format-price';
import { isUuid } from '../../../../lib/laundry-order-list-query';
import {
  LAUNDRY_ORDER_SECTIONS,
  currentLaundryOrderSection,
  laundryLifecycleVerbs,
  laundryLineQuantity,
  laundryOrderSectionId,
  resolvedInvoiceNodes,
  type LaundryOrderSection,
} from '../../../../lib/laundry-order-page';

type LaundryOrderDetail = NonNullable<LaundryOrderQuery['laundryOrder']>;
type Invoice = InvoiceForOrderQuery['invoices']['nodes'][number];
type Translate = (key: string) => string;

// The order workspace (lifecycle spec §8.4.4, #156). Read-only for now:
// Weighing (#155), Services (#158), Price (#162), Invoice (#166) and
// Actions (#165) replace their section's facts with controls. The list
// still opens the drawer until the cutover (#161).
export default function LaundryOrderPage() {
  const { id } = useParams<{ id: string }>();
  // A new key per order, so moving between orders starts fresh.
  return <LaundryOrderWorkspace key={id} id={id} />;
}

function LaundryOrderWorkspace({ id }: { id: string }) {
  const t = useClensyTranslations('laundry');
  // Postgres rejects an id that is not UUID-shaped, so it is never an
  // order: show not-found without a request.
  const validId = isUuid(id);
  const orderQuery = useLaundryOrderQuery({ fetchPolicy: 'network-only', skip: !validId, variables: { id } });
  const invoiceQuery = useInvoiceForOrderQuery({
    fetchPolicy: 'network-only',
    skip: !validId,
    variables: { laundryOrderId: id },
  });
  const { data: adminData } = useCurrentAdminQuery();
  const role = adminData?.currentAdmin.role;

  const backLink = (
    <div>
      <Link href="/app/laundry" className="text-sm text-slate-600 underline">
        {t('order.back')}
      </Link>
    </div>
  );

  // Loading wins over any data Apollo retains from an earlier result, and
  // an error wins over it below: the order is shown only from a finished,
  // successful query (M5 review 2).
  if (validId && orderQuery.loading) {
    return (
      <div className="flex flex-col gap-8">
        {backLink}
        <LoadingState />
      </div>
    );
  }

  const order = orderQuery.data?.laundryOrder;
  if (!validId || orderQuery.error || !order) {
    return (
      <div className="flex flex-col gap-8">
        {backLink}
        <ErrorState message={t('error.order')} />
      </div>
    );
  }

  // Only a finished, successful invoice result with its node list decides
  // the nav and the Invoice section. Data retained while it reloads or
  // after it fails (M5 review 1), and a result without the connection
  // (M5 review 3), leave both unresolved.
  const invoices = resolvedInvoiceNodes(invoiceQuery);
  const verbs = laundryOrderActions(order.status, order.fulfillmentType, role);
  const current = currentLaundryOrderSection({
    invoiceExists: invoices === undefined ? undefined : invoices.length > 0,
    status: order.status,
    verbs,
  });

  return (
    <div className="flex flex-col gap-8">
      {backLink}

      <PageHeader
        title={order.customer.fullName}
        description={order.id}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <StatusBadge label={t(`status.${order.status}`)} tone={LAUNDRY_STATUS_TONE[order.status]} />
            <span className="text-sm text-slate-600">{t(`fulfillment.${order.fulfillmentType}`)}</span>
          </div>
        }
      />

      <LaundryOrderProgress status={order.status} fulfillmentType={order.fulfillmentType} />

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryItem term={t('order.summary.customer')}>{order.customer.fullName}</SummaryItem>
        <SummaryItem term={t('order.summary.fulfillment')}>{t(`fulfillment.${order.fulfillmentType}`)}</SummaryItem>
        <SummaryItem term={t('order.summary.weight')}>
          {order.weightGrams === null ? '—' : formatWeightGrams(order.weightGrams)}
        </SummaryItem>
        <SummaryItem term={t('order.summary.total')}>
          {order.totalMinorUnits === null ? '—' : formatMinorUnits(order.totalMinorUnits)}
        </SummaryItem>
      </dl>

      <nav aria-label={t('order.sectionsLabel')}>
        <ul className="flex gap-3 overflow-x-auto">
          {LAUNDRY_ORDER_SECTIONS.map((section) => (
            <li key={section} className="shrink-0">
              <a
                href={`#${laundryOrderSectionId(section)}`}
                aria-current={section === current ? 'true' : undefined}
                className={`text-sm whitespace-nowrap ${section === current ? 'font-medium text-slate-900' : 'text-slate-600'}`}
              >
                {t(`order.sections.${section}`)}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <OrderSection section="overview" t={t}>
        <OverviewBody order={order} t={t} />
      </OrderSection>

      <OrderSection section="weighing" t={t}>
        {order.weightGrams === null ? (
          <p>{t('order.weighing.notWeighed')}</p>
        ) : (
          <Fact term={t('order.weighing.recorded')}>{formatWeightGrams(order.weightGrams)}</Fact>
        )}
      </OrderSection>

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

      <OrderSection section="invoice" t={t}>
        <InvoiceBody
          error={Boolean(invoiceQuery.error)}
          invoice={invoices?.[0]}
          resolved={invoices !== undefined}
          t={t}
        />
      </OrderSection>

      <OrderSection section="actions" t={t}>
        {role === undefined ? null : <ActionsBody verbs={laundryLifecycleVerbs(verbs)} t={t} />}
      </OrderSection>
    </div>
  );
}

function SummaryItem({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <dt className="text-sm text-slate-500">{term}</dt>
      <dd className="mt-1 text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}

function OrderSection({ section, t, children }: { section: LaundryOrderSection; t: Translate; children: ReactNode }) {
  return (
    <section id={laundryOrderSectionId(section)} className="scroll-mt-6">
      <h2 className="text-base font-semibold text-slate-900">{t(`order.sections.${section}`)}</h2>
      <div className="mt-3 text-sm text-slate-700">{children}</div>
    </section>
  );
}

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <dl className="flex flex-col gap-1">
      <dt className="text-slate-500">{term}</dt>
      <dd className="font-medium text-slate-900">{children}</dd>
    </dl>
  );
}

function OverviewBody({ order, t }: { order: LaundryOrderDetail; t: Translate }) {
  const { nodes, pageInfo } = order.lines;
  return (
    <div className="flex flex-col gap-3">
      {nodes.length === 0 ? (
        <p>{t('order.overview.noLines')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {nodes.map((line) => {
            const { amountMinorUnits, minimumChargeApplied, quantity, unit } = line.pricingSnapshot;
            const shown = laundryLineQuantity(unit, quantity);
            return (
              <li key={line.id} className="rounded-md border border-slate-200 p-3">
                <p className="font-medium text-slate-900">
                  {t(line.serviceId ? 'order.lines.service' : 'order.lines.addOn')}
                </p>
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
      )}
      {pageInfo.hasNextPage === true ? <p className="text-slate-600">{t('order.lines.more')}</p> : null}
    </div>
  );
}

function InvoiceBody({
  error,
  invoice,
  resolved,
  t,
}: {
  error: boolean;
  invoice: Invoice | undefined;
  // `resolvedInvoiceNodes` returned a node list: finished, no error,
  // connection present.
  resolved: boolean;
  t: Translate;
}) {
  if (error) return <p className="text-red-600">{t('order.invoice.error')}</p>;
  if (!resolved) return null;
  if (!invoice) return <p>{t('order.invoice.none')}</p>;
  return (
    <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      <div>
        <dt className="text-slate-500">{t('order.invoice.number')}</dt>
        <dd className="font-medium text-slate-900">{invoice.invoiceNumber}</dd>
      </div>
      <div>
        <dt className="text-slate-500">{t('order.invoice.total')}</dt>
        <dd className="font-medium text-slate-900">{formatMinorUnits(invoice.totalMinorUnits)}</dd>
      </div>
      <div>
        <dt className="text-slate-500">{t('order.invoice.paymentStatus')}</dt>
        <dd className="font-medium text-slate-900">{t(`invoicePaymentStatus.${invoice.paymentStatus}`)}</dd>
      </div>
    </dl>
  );
}

// Names what the actor may do next, as text. The server re-checks every
// verb; this page offers no control (#156 §Role and lifecycle).
function ActionsBody({ verbs, t }: { verbs: LaundryOrderVerb[]; t: Translate }) {
  if (verbs.length === 0) return <p>{t('noActions')}</p>;
  return (
    <>
      <p>{t('order.actions.available')}</p>
      <ul className="mt-2 list-disc pl-5">
        {verbs.map((verb) => (
          <li key={verb}>{t(`actions.${verb}`)}</li>
        ))}
      </ul>
    </>
  );
}
```

- [ ] **Step 5: Run the render tests**

Run: `pnpm --filter web test -- laundry-order-page`
Expected: PASS, both `laundry-order-page.test.ts` and `laundry-order-page.render.test.tsx`.

- [ ] **Step 6: Run the whole web suite, lint and types**

Run: `pnpm --filter web test && pnpm --filter web lint && pnpm --filter web exec tsc --noEmit`
Expected: all pass. The app i18n boundary and shell-regression guards scan the new page and stay green.

- [ ] **Step 7: Commit**

```bash
git status --short
git add packages/web/src/i18n/messages/en/laundry.ts apps/web/lib/laundry-order-page.render.test.tsx 'apps/web/app/app/laundry/[id]/page.tsx'
git commit -m "feat(web): dedicated laundry order page (#156)"
```

---

### Task 4: Final verification and PR

**Files:** none changed, except this plan's gate records.

- [ ] **Step 1: Scope check**

Run: `git diff --name-only main...HEAD`
Expected: exactly the files in the [File map](#file-map), plus this plan. Nothing under `apps/api`, `packages/ui`, `docs/workflows`, `apps/web/app/app/laundry/page.tsx`, or any lockfile or `package.json`.

- [ ] **Step 2: Every suite and build**

Run, each to completion:

```bash
pnpm --filter @clensy/client test
pnpm --filter @clensy/client build
pnpm --filter @clensy/client lint
pnpm --filter @clensy/web test
pnpm --filter @clensy/web lint
pnpm --filter @clensy/web build
pnpm --filter web test
pnpm --filter web lint
pnpm --filter web exec tsc --noEmit
pnpm --filter web build
pnpm lint
```

Expected: all pass. `pnpm --filter web build` lists the dynamic route `/app/laundry/[id]`. Record each command's result in the M6 Slice Completion Report's Validation table. No API e2e runs: no API code, schema or operation the API serves changed (the lines page size is a client argument within the existing maximum).

- [ ] **Step 3: Manual browser checks**

Run the app (`pnpm dev`, web on :3001) against the local API and database, with a few orders at different statuses. Record the viewport, role and result of each in the PR:

1. Desktop, TENANT_OWNER: paste `/app/laundry/<id>` of a priced order. Back link, customer name heading, the order id, status badge and fulfillment; progress; four summary cards in one row; six section links; lines in Overview. The sidebar highlights Laundry. The tab title is the Laundry title.
2. Refresh the page: it loads the same order.
3. Open the list with a search or filter, then type the order URL into the address bar, then press Back: the list comes back with its search or filter.
4. Click "Back to laundry orders": the list opens.
5. Click a section link: the page scrolls to that section, with its heading clear of the top.
6. `/app/laundry/not-an-id` and the URL of a deleted or other-tenant order: "Unable to load laundry order." and the back link.
7. Below 640 px: one summary column, sections stacked, the section nav scrolls sideways without the page scrolling sideways, the header badge and fulfillment fit or wrap without overflow.
8. ANALYST: the page opens, no buttons, no current section link, "No further actions for this order."

- [ ] **Step 4: Open the PR**

Push `feat/156-laundry-order-page` and open the PR against `main` with `gh pr create` (`workflow.providers.pullRequests: github`). The body MUST include:
- "Closes #156."
- **Cutover:** "The list still opens the drawer, and `?detail=` links still open it. #161 sends rows, post-create navigation and `?detail=` to this route, using `laundryOrderHref` and `laundryDetailRedirectHref`, and removes the drawer."
- **Read-only:** "The Weighing, Services, Price, Invoice and Actions sections show the facts the order already has, with no controls, until #155, #158, #162, #166 and #165 replace them."
- No API, schema or `@clensy/ui` change; no new dependency. The detail query now loads up to 100 lines (was the server default of 20), which also applies to the laundry mutations' responses.
- The manual check table from Step 3.

---

## Self-review (planner)

| Check | Result |
| --- | --- |
| Every major task traces to the Accepted spec | Yes; see [Traceability](#traceability). |
| No task introduces new product semantics | Yes. Presentation decisions for M5: the owner's two decisions (read-only facts; next-step-forward current section), the "Base service" / "Add-on" line label until #159, native in-page anchors (Review Focus 8), skipping the request for a non-UUID id. None changes an API contract, a stored value or an authorization rule. |
| Task order executable without inventing work | Yes: 1 (client) and 2 (helpers) are independent; 3 needs 1's generated types and 2's helpers; 4 last. |
| Deferred work explicitly identified | Yes; see [Deferred](#deferred-not-in-this-plan). |
| Missing design semantics | None found. #156's redirect bullet and its AC2 disagree on timing; the AC and the Integration boundary both put the redirect at #161, and §8.4.4 says only that the drawer is removed once the page is verified, so the helper ships now and the wiring at #161. |
| Pre-validation claim | None claimed. |
| Characterization tests labelled | None in this plan: every new test fails before its implementation. |
| Every M5 review 1 finding answered | Yes; see [Revision 2 (M5 review 1)](#revision-2-m5-review-1). |
| Every M5 review 2 finding answered | Yes; see [Revision 3 (M5 review 2)](#revision-3-m5-review-2). |
| Every M5 review 3 finding answered | Yes; see [Revision 4 (M5 review 3)](#revision-4-m5-review-3). |

## Gate outcomes

### M5 — Accepted (2026-10-14, fourth pass)

Owner review of revision 4, on the changed pieces after a five-part review of revision 3. Disposition:

| Finding | Severity | Status |
| --- | --- | --- |
| Invoice nav based on retained Apollo data (review 1) | P2 | Resolved in revision 2 |
| Order page renders retained order data while loading (review 2) | P2 | Resolved in revision 3 |
| Invoice absence inferred from an incomplete result; revision 3 could throw (review 3) | P2 | Resolved in revision 4 |
| Explicit `nodes: null` test (review 4) | P3 | Added to Task 2 at acceptance |

Verdict: **Accepted.** This is a plan review, not execution evidence. The type-check and lint spike for `resolvedInvoiceNodes` is the only code that ran; every planned test, lint, type-check and build runs in M6.

### M6 — Implementation complete (2026-10-14)

Executed inline from `4df0667`, in plan order, one commit per task: Task 1 `662be9b`, Task 2 `7a3fa31`, Task 3 `6148073`. Code was taken verbatim from the plan's fenced blocks.

**TDD evidence.** Each task's new tests failed first for the planned reason: Task 1 `expected [ '' ] to deeply equal [ 'paging: { limit: 100 }' ]`; Task 2 "Cannot find module './laundry-order-page'"; Task 3 29 render tests failing on "Cannot find module '…/app/laundry/[id]/page'". No characterization tests.

**Deviations from the plan text (no change to behavior or scope):**

1. **Task 2 test helper default.** The plan's `current(status, role, invoiceExists = false)` turned the explicit `undefined` row into `false`, so `PRICED as TENANT_OWNER, invoice exists undefined → actions` failed (`'invoice'`). The implementation was right and the test was not; the default was removed (all rows pass three arguments). Commit `7a3fa31` says so.
2. **Lint ordering.** `pnpm --filter web lint` flagged the repository's `contextforge/record-key-order` rule on four render-test fixture objects and `@typescript-eslint/sort-type-constituents` on `string | URLSearchParams`. Keys and the union were reordered (`URLSearchParams | string`). Folded into `6148073`.

**Validation (Task 4, Step 2), run at `6148073`:**

| Command | Result |
| --- | --- |
| `pnpm --filter @clensy/client test` | Passed, 11 tests |
| `pnpm --filter @clensy/client build` | Passed |
| `pnpm --filter @clensy/client lint` | Passed |
| `pnpm --filter @clensy/web test` | Passed, 15 files, 411 tests |
| `pnpm --filter @clensy/web lint` | Passed |
| `pnpm --filter @clensy/web build` | Passed |
| `pnpm --filter web test` | Passed, 34 files, 831 tests (752 before; +79) |
| `pnpm --filter web lint` | Passed |
| `pnpm --filter web exec tsc --noEmit` | Passed |
| `pnpm --filter web build` | Passed; route list shows `ƒ /app/laundry/[id]` |
| `pnpm lint` | Passed |

Scope check (Step 1): `git diff --name-only main...HEAD` lists exactly the File map plus this plan.

**Manual browser check (Step 3).** Setup per the #160 precedent: this branch's API built and run on 3010 (`WEB_ORIGIN=http://localhost:3011`), this branch's web as a production build on 3011 (`NEXT_PUBLIC_API_URL=http://localhost:3010/graphql`), local Postgres; Docker containers untouched. Driven with Playwright; screenshot `.playwright-mcp/156-order-page-mobile.png` (gitignored).

| # | Viewport | Role | Result |
| --- | --- | --- | --- |
| 1 | 1850 px | TENANT_OWNER | PRICED order with invoice: back link, `h1` customer, id, "Priced" badge, "Customer pickup"; progress; summary 4 columns; six links; one line (Base service, Per kg, 2.00 kg, ₱20.00); Invoice INV-2026-000317 / ₱20.00 / Unpaid; Actions lists Mark awaiting payment, Mark paid, Cancel order; current = Actions (invoice exists); sidebar Laundry `aria-current="page"`; title "Laundry · Clensy"; 0 buttons/inputs/forms in `main`. **Pass** |
| 1b | 1850 px | TENANT_OWNER | RECEIVED: em dashes for weight and total, all "not yet" facts, current = Weighing, Actions = Cancel order, Reject order. WEIGHED: Recorded weight 1.20 kg, current = Services. **Pass** |
| 2 | 1850 px | TENANT_OWNER | Reload of the order URL renders the same order. **Pass** |
| 3 | 1850 px | TENANT_OWNER | `/app/laundry?status=PRICED` → order URL → Back returns to `/app/laundry?status=PRICED`. **Pass** |
| 4 | 1850 px | TENANT_OWNER | "Back to laundry orders" opens `/app/laundry`. **Pass** |
| 5 | 1850 / 375 px | TENANT_OWNER | Section links set the hash and scroll; `scroll-margin-top` 24px applied. On this data the target sections sit near the page end, so the scroll stopped at the document bottom (`scrollY` = max) rather than at 24px. **Pass** (behavior as specified; noted) |
| 6 | 1850 px | TENANT_OWNER | `/app/laundry/not-an-id`: error + back link; only GraphQL request was the shell's `CurrentAdmin` (no order or invoice query). Non-existent UUID: error + back link. No other-tenant order exists locally; the API returns `null` for cross-tenant exactly as for missing, which this case covers. **Pass** |
| 7 | 375 px | TENANT_OWNER | Document scroll width 360 ≤ viewport; summary one column; section nav scrolls in its own box (365 > 312, `overflow-x: auto`); header badge and fulfillment fit, id wraps. **Pass** |
| 8 | 375 px | ANALYST | Page opens; 0 controls; no current link; "No further actions for this order."; invoice facts visible. **Pass** |

A throwaway `qa156-analyst-…@example.com` ANALYST was created through `createAdmin` for row 8 and disabled afterwards with `disableAdmin`. Console showed only the existing favicon 404 and the Apollo DevTools notice.

## Slice Completion Report

| Field | Result |
| --- | --- |
| Slice | #156 Laundry order page |
| Tracking | https://github.com/rexescario-dev/clensy-platform/issues/156 |
| M4 | Plan **Accepted** |
| M5 | Review **Accepted** |
| M6 | **Complete** |
| M7 | Pending |
| M8 | Pending |
| M9 | Pending |
| Branch | `feat/156-laundry-order-page` |
| PR | (opened after this record) |
| Status | **Ready for M7** |

### Shipped

- `/app/laundry/<id>`: read-only order page reachable by direct URL and refresh; back link, header, shared progress, summary, section nav, six sections.
- Next-step current section (Weighing / Services / Invoice / Actions) by status, role and a validated invoice result.
- Loading and error states take precedence over Apollo-retained order data; an unresolved or incomplete invoice result never reads as "no invoice".
- The detail query loads up to 100 lines and warns when more exist.
- Pure helpers ready for #161: `laundryOrderHref`, `laundryDetailRedirectHref` (not wired).

### Validation

| Check | Result |
| --- | --- |
| Tests | **Passed** |
| Typecheck | **Passed** |
| Lint | **Passed** |
| Build | **Passed** |
| Package validation | N/A |

### Next Gate

**M7 — Code Review**
